'use strict';
// ===== Modified Nodal Analysis solver with transient companion models =====
// Ideal conductors (wires, breadboard strips, closed switches) are merged into
// super-nodes by the app before the netlist is built, so they introduce no
// resistance error. Node 0 = ground. Nodes 1..N map to matrix rows 0..N-1,
// voltage-source branch currents follow.
// Linear algebra: small systems use dense LU with partial pivoting; larger systems
// use a sparse LU (Markowitz pivot ordering with threshold pivoting). The pivot
// order and fill-in pattern are compiled into a flat "elimination program" so
// Newton iterations only re-run numeric elimination (like SPICE's refactor);
// if a pivot becomes numerically poor the ordering is recomputed.
// Integration: trapezoidal, with 3 Backward-Euler steps after every re-stamp.
// Non-linear devices are generic N-terminal elements that return a linearised
// conductance matrix G and current vector J each Newton iteration.
const GMIN = 1e-12;
const G_OFF = 1e-10;       // open switch / blown fuse
const R_SRC = 1e-9;        // minimum series resistance of ideal V-sources (keeps loops solvable)
const VT = 0.025852;
const SPARSE_MIN_N = 40;   // use the sparse solver from this many unknowns up
// user-adjustable solver options (Settings › 高级仿真设置); defaults need no tuning
const SIMOPT_DEFAULTS = { maxIter: 100, reltol: 1e-4, vntol: 1e-6, abstol: 1e-6, gmin: 1e-12, autoStep: true, minStep: 1e-9, homotopy: true, kclCheck: true };
const SIMOPT = Object.assign({}, SIMOPT_DEFAULTS);
const SIMOPT_KEY = 'dcaclab-simopt';
function saveSimOpt() { try { const d = {}; for (const k in SIMOPT) if (SIMOPT[k] !== SIMOPT_DEFAULTS[k]) d[k] = SIMOPT[k]; if (Object.keys(d).length) localStorage.setItem(SIMOPT_KEY, JSON.stringify(d)); else localStorage.removeItem(SIMOPT_KEY); } catch (e) { /* ignore */ } }
try { if (typeof localStorage !== 'undefined' && !/[?&]fresh=1/.test(location.search)) { const d = JSON.parse(localStorage.getItem(SIMOPT_KEY) || '{}'); for (const k in d) if (k in SIMOPT_DEFAULTS && typeof d[k] === typeof SIMOPT_DEFAULTS[k]) SIMOPT[k] = d[k]; } } catch (e) { /* ignore */ }

function luFactor(A, n, piv) {
  for (let k = 0; k < n; k++) {
    let p = k, mx = Math.abs(A[k * n + k]);
    for (let i = k + 1; i < n; i++) { const v = Math.abs(A[i * n + k]); if (v > mx) { mx = v; p = i; } }
    piv[k] = p;
    if (p !== k) { const rk = k * n, rp = p * n; for (let j = 0; j < n; j++) { const t = A[rk + j]; A[rk + j] = A[rp + j]; A[rp + j] = t; } }
    let d = A[k * n + k];
    if (Math.abs(d) < 1e-300) { d = A[k * n + k] = 1e-300; }
    const rk = k * n;
    for (let i = k + 1; i < n; i++) {
      const ri = i * n, f = A[ri + k] / d;
      if (f === 0) continue;
      A[ri + k] = f;
      for (let j = k + 1; j < n; j++) { const a = A[rk + j]; if (a !== 0) A[ri + j] -= f * a; }
    }
  }
}
function luSolve(A, n, piv, b) {
  for (let k = 0; k < n; k++) { const p = piv[k]; if (p !== k) { const t = b[k]; b[k] = b[p]; b[p] = t; } }
  for (let i = 0; i < n; i++) { let s = b[i]; const ri = i * n; for (let j = 0; j < i; j++) s -= A[ri + j] * b[j]; b[i] = s; }
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; const ri = i * n; for (let j = i + 1; j < n; j++) s -= A[ri + j] * b[j]; b[i] = s / A[ri + i]; }
}

// ---- dense backend ----
class DenseLU {
  constructor(n) { this.n = n; this.nnz = n * n; this.LU = new Float64Array(n * n); this.piv = new Int32Array(n); this.kind = 'dense'; this.rc = new Int32Array(2 * n * n); for (let i = 0; i < n * n; i++) { this.rc[2 * i] = Math.floor(i / n); this.rc[2 * i + 1] = i % n; } }
  idx(r, c) { return r * this.n + c; }
  factor(vals) { this.LU.set(vals); luFactor(this.LU, this.n, this.piv); return true; }
  solve(b) { luSolve(this.LU, this.n, this.piv, b); return b; }
}

// ---- sparse backend ----
class SparseLU {
  constructor(n, pairs) {
    this.n = n; this.kind = 'sparse';
    this.map = new Map();
    let k = 0;
    for (let i = 0; i < n; i++) this.map.set(i * n + i, k++);           // structural diagonal
    for (const [r, c] of pairs) { const key = r * n + c; if (!this.map.has(key)) this.map.set(key, k++); }
    this.nnz = k;
    this.rc = new Int32Array(2 * k);
    for (const [key, i] of this.map) { this.rc[2 * i] = Math.floor(key / n); this.rc[2 * i + 1] = key % n; }
    this.prog = null; this.F = null; this.x = new Float64Array(n);
    this.fullFactors = 0; this.refactors = 0;
  }
  idx(r, c) { const i = this.map.get(r * this.n + c); return i === undefined ? -1 : i; }
  factor(vals) {
    if (this.prog && this._refactor(vals)) { this.refactors++; return true; }
    this._full(vals); this.fullFactors++; return true;
  }
  // Markowitz ordering + numeric factorisation; records the elimination program
  _full(vals) {
    const n = this.n, nnz = this.nnz;
    const F = Array.from(vals.subarray(0, nnz));
    const rows = Array.from({ length: n }, () => new Map()), cols = Array.from({ length: n }, () => new Map());
    for (let i = 0; i < nnz; i++) { const r = this.rc[2 * i], c = this.rc[2 * i + 1]; rows[r].set(c, i); cols[c].set(r, i); }
    const rowDone = new Uint8Array(n), colDone = new Uint8Array(n);
    const piv = new Int32Array(n), pr = new Int32Array(n), pc = new Int32Array(n);
    const Ls = [0], Li = [], Lx = [], Us = [0], Uc = [], Ux = [], T = [];
    const U_THR = 0.01;
    for (let k = 0; k < n; k++) {
      // candidate columns: the few with the smallest active count
      let cand = [];
      for (let j = 0; j < n; j++) {
        if (colDone[j]) continue;
        const cnt = cols[j].size;
        if (cand.length < 4) { cand.push([cnt, j]); cand.sort((a, b) => a[0] - b[0]); }
        else if (cnt < cand[3][0]) { cand[3] = [cnt, j]; cand.sort((a, b) => a[0] - b[0]); }
      }
      let best = null;
      for (const [cc, j] of cand) {
        let mx = 0;
        for (const [, fi] of cols[j]) { const a = Math.abs(F[fi]); if (a > mx) mx = a; }
        for (const [i, fi] of cols[j]) {
          const a = Math.abs(F[fi]);
          if (mx > 0 && a < U_THR * mx) continue;
          const cost = (rows[i].size - 1) * (cc - 1);
          if (!best || cost < best.cost || (cost === best.cost && a > best.a)) best = { i, j, fi, cost, a };
        }
      }
      if (!best) { // structurally/numerically empty column: use any active entry, else fabricate
        for (const [, j] of cand) { for (const [i, fi] of cols[j]) { best = { i, j, fi }; break; } if (best) break; }
      }
      const r = best.i, c = best.j;
      if (Math.abs(F[best.fi]) < 1e-300) F[best.fi] = 1e-300;
      piv[k] = best.fi; pr[k] = r; pc[k] = c;
      const pv = F[best.fi];
      const urow = [...rows[r]].filter(([cc]) => cc !== c);
      for (const [cc, fi] of urow) { Uc.push(cc); Ux.push(fi); }
      Us.push(Uc.length);
      for (const [i, li] of cols[c]) {
        if (i === r) continue;
        F[li] /= pv; const f = F[li];
        Li.push(i); Lx.push(li);
        const ri = rows[i];
        for (const [cc, ui] of urow) {
          let ti = ri.get(cc);
          if (ti === undefined) { ti = F.length; F.push(0); ri.set(cc, ti); cols[cc].set(i, ti); }
          F[ti] -= f * F[ui]; T.push(ti);
        }
      }
      Ls.push(Li.length);
      // retire pivot row/column from the active sub-matrix
      for (const [cc] of rows[r]) cols[cc].delete(r);
      for (const [i] of cols[c]) rows[i].delete(c);
      rows[r].clear(); cols[c].clear(); rowDone[r] = 1; colDone[c] = 1;
    }
    this.F = Float64Array.from(F);
    this.prog = { piv, pr, pc, Ls: Int32Array.from(Ls), Li: Int32Array.from(Li), Lx: Int32Array.from(Lx), Us: Int32Array.from(Us), Uc: Int32Array.from(Uc), Ux: Int32Array.from(Ux), T: Int32Array.from(T) };
  }
  _refactor(vals) {
    const F = this.F, P = this.prog, n = this.n;
    F.fill(0); F.set(vals.subarray(0, this.nnz));
    const { piv, Ls, Lx, Us, Ux, T } = P;
    let t = 0;
    for (let k = 0; k < n; k++) {
      const pv = F[piv[k]];
      let mx = Math.abs(pv);
      for (let q = Ls[k]; q < Ls[k + 1]; q++) { const a = Math.abs(F[Lx[q]]); if (a > mx) mx = a; }
      if (!(Math.abs(pv) >= 1e-3 * mx) || mx === 0) return false; // poor pivot -> re-order
      const u0 = Us[k], u1 = Us[k + 1];
      for (let q = Ls[k]; q < Ls[k + 1]; q++) {
        const li = Lx[q]; const f = (F[li] /= pv);
        if (f === 0) { t += u1 - u0; continue; }
        for (let u = u0; u < u1; u++) F[T[t++]] -= f * F[Ux[u]];
      }
    }
    return true;
  }
  solve(b) {
    const P = this.prog, F = this.F, n = this.n, x = this.x;
    const { piv, pr, pc, Ls, Li, Lx, Us, Uc, Ux } = P;
    for (let k = 0; k < n; k++) { const y = b[pr[k]]; if (y === 0) continue; for (let q = Ls[k]; q < Ls[k + 1]; q++) b[Li[q]] -= F[Lx[q]] * y; }
    for (let k = n - 1; k >= 0; k--) { let s = b[pr[k]]; for (let u = Us[k]; u < Us[k + 1]; u++) s -= F[Ux[u]] * x[Uc[u]]; x[pc[k]] = s / F[piv[k]]; }
    b.set(x); return b;
  }
}

function pnjlim(vnew, vold, vt, vcrit) {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    } else {
      vnew = vt * Math.log(Math.max(vnew / vt, 1e-30));
    }
  }
  return vnew;
}
// SPICE DEVfetlim: limit the change of a FET gate drive depending on the region of the previous iterate
function fetlim(vnew, vold, vto) {
  const vtsthi = Math.abs(2 * (vold - vto)) + 2, vtstlo = vtsthi / 2 + 2, vtox = vto + 3.5, delv = vnew - vold;
  if (vold >= vto) {
    if (vold >= vtox) {
      if (delv <= 0) { if (vnew >= vtox) { if (-delv > vtstlo) vnew = vold - vtstlo; } else vnew = Math.max(vnew, vto + 2); }
      else if (delv >= vtsthi) vnew = vold + vtsthi;
    } else if (delv <= 0) vnew = Math.max(vnew, vto - 0.5);
    else vnew = Math.min(vnew, vto + 4);
  } else if (delv <= 0) { if (-delv > vtsthi) vnew = vold - vtsthi; }
  else { const vt = vto + 0.5; if (vnew <= vt) { if (delv > vtstlo) vnew = vold + vtstlo; } else vnew = vt; }
  return vnew;
}
// SPICE DEVlimvds
function limvds(vnew, vold) {
  if (vold >= 3.5) { if (vnew > vold) vnew = Math.min(vnew, 3 * vold + 2); else if (vnew < 3.5) vnew = Math.max(vnew, 2); }
  else if (vnew > vold) vnew = Math.min(vnew, 4); else vnew = Math.max(vnew, -0.5);
  return vnew;
}
const clampStep = (vnew, vold, lim) => (Math.abs(vnew - vold) > lim ? vold + Math.sign(vnew - vold) * lim : vnew);

// ---- non-linear device models: ev(p, V) fills p.G (m×m, row = terminal current INTO the device) and p.J; returns true if limited ----
const NLMODELS = {
  diode(p, V) {
    const vraw = V[0] - V[1], st = p.st;
    let vd;
    if (p.bv && vraw < Math.min(0, -p.bv + 10 * p.nVz)) { const vr = pnjlim(-(vraw + p.bv), -(st.vd + p.bv), p.nVz, p.vcritZ); vd = -(vr + p.bv); }
    else vd = pnjlim(vraw, st.vd, p.nVt, p.vcrit);
    st.vd = vd;
    const e = Math.exp(Math.min(vd / p.nVt, 700));
    let Id = p.Is * (e - 1), gd = p.Is / p.nVt * e;
    if (p.bv) { const er = Math.exp(Math.min(-(vd + p.bv) / p.nVz, 700)); Id -= p.Isz * er; gd += p.Isz / p.nVz * er; }
    gd += GMIN;
    const J = Id - gd * vd, G = p.G;
    G[0] = gd; G[1] = -gd; G[2] = -gd; G[3] = gd; p.J[0] = J; p.J[1] = -J;
    return Math.abs(vd - vraw) > 1e-9;
  },
  // BJT, terminals [b, c, e]; transport Ebers-Moll with optional Early effect (VAF)
  bjt(p, V) {
    const pol = p.pol, st = p.st;
    const rbe = pol * (V[0] - V[2]), rbc = pol * (V[0] - V[1]);
    const vbe = pnjlim(rbe, st.vbe, VT, p.vcrit), vbc = pnjlim(rbc, st.vbc, VT, p.vcrit);
    st.vbe = vbe; st.vbc = vbc;
    const ef = Math.exp(Math.min(vbe / VT, 700)), er = Math.exp(Math.min(vbc / VT, 700));
    const If = p.Is * (ef - 1), Ir = p.Is * (er - 1);
    const gf = p.Is / VT * ef + GMIN, gr = p.Is / VT * er + GMIN;
    let kq = 1, dkq = 0; // Early effect: transport current × (1 − vbc/VAF)
    if (p.VAF > 0) { kq = 1 - vbc / p.VAF; dkq = -1 / p.VAF; if (kq < 0.2) { kq = 0.2; dkq = 0; } }
    const It = If - Ir;
    const Ic = It * kq - Ir / p.BR, Ib = If / p.BF + Ir / p.BR;
    const cbe = gf * kq, cbc = -gr * kq + It * dkq - gr / p.BR, bbe = gf / p.BF, bbc = gr / p.BR;
    const G = p.G, J = p.J;
    G[3] = cbe + cbc; G[4] = -cbc; G[5] = -cbe;       // collector row
    G[0] = bbe + bbc; G[1] = -bbc; G[2] = -bbe;       // base row
    for (let j = 0; j < 3; j++) G[6 + j] = -(G[j] + G[3 + j]);
    J[1] = pol * (Ic - cbe * vbe - cbc * vbc); J[0] = pol * (Ib - bbe * vbe - bbc * vbc); J[2] = -(J[0] + J[1]);
    return Math.abs(vbe - rbe) > 1e-9 || Math.abs(vbc - rbc) > 1e-9;
  },
  // MOSFET / JFET channel, terminals [g, d, s]; Shichman-Hodges (level 1)
  fet(p, V) {
    const pol = p.pol, st = p.st;
    const rgs = pol * (V[0] - V[2]), rds = pol * (V[1] - V[2]);
    // SPICE MOS1 voltage limiting (fetlim on the gate drive of the conducting side, limvds on vds)
    let vgs, vds;
    if (st.vds >= 0) { vgs = fetlim(rgs, st.vgs, p.Vth); vds = limvds(vgs - (rgs - rds), st.vds); }
    else { const vgd = fetlim(rgs - rds, st.vgs - st.vds, p.Vth); vds = -limvds(-(rgs - vgd), -st.vds); vgs = vgd + vds; }
    st.vgs = vgs; st.vds = vds;
    const sq = (vg, vd) => {
      const vov = vg - p.Vth, l = 1 + p.lam * vd;
      if (vov <= 0) return [0, 0, 0];
      if (vd < vov) return [p.K * (2 * vov * vd - vd * vd) * l, 2 * p.K * vd * l, p.K * (2 * vov - 2 * vd) * l + p.K * (2 * vov * vd - vd * vd) * p.lam];
      return [p.K * vov * vov * l, 2 * p.K * vov * l, p.K * vov * vov * p.lam];
    };
    let I, dg, dd;
    if (vds >= 0) [I, dg, dd] = sq(vgs, vds);
    else { const r = sq(vgs - vds, -vds); I = -r[0]; dg = -r[1]; dd = r[1] + r[2]; }
    dd += GMIN;
    const G = p.G, J = p.J;
    G[0] = G[1] = G[2] = 0;
    G[3] = dg; G[4] = dd; G[5] = -(dg + dd);
    G[6] = -dg; G[7] = -dd; G[8] = dg + dd;
    J[0] = 0; J[1] = pol * (I - dg * vgs - dd * vds); J[2] = -J[1];
    return Math.abs(vgs - rgs) > 1e-9 || Math.abs(vds - rds) > 1e-9;
  },
  // op-amp gain stage, terminals [in+, in−, x, out]:
  // i(x) = sat(A·vd)/R1 into x (x has R1 ∥ C1 to ground → dominant pole), out = Norton (gout) of v(x)
  opamp(p, V) {
    const st = p.st, A = p.A, mid = p.mid, h = p.h;
    const vd = V[0] - V[1];
    let z = (A * vd - mid) / h, limited = false;
    z = Math.max(-4, Math.min(4, z));
    if (st.z !== undefined && Math.abs(z - st.z) > 0.5) { z = st.z + Math.sign(z - st.z) * 0.5; limited = true; }
    st.z = z;
    const th = Math.tanh(z), s0 = mid + h * th, ds = A * (1 - th * th); // ds = d sat / d vd
    const vd0 = (z * h + mid) / A, g1 = 1 / p.R1, G = p.G, J = p.J;
    G.fill(0); J.fill(0);
    // x row (index 2): current into device = −sat/R1
    G[2 * 4 + 0] = -ds * g1; G[2 * 4 + 1] = ds * g1; J[2] = -(s0 - ds * vd0) * g1;
    // out row (index 3): current into device = gout·(v_out − v_x)
    G[3 * 4 + 3] = p.gout; G[3 * 4 + 2] = -p.gout;
    return limited;
  },
};

const NLACCEPT = {};   // optional per-model hooks run once per accepted time step

class MNA {
  constructor() {
    this.N = 0; this.prims = []; this.vs = []; this.nl = [];
    this.x = null; this.converged = true; this.iters = 0; this.tp = null;
    this.needStamp = false;
    this.stats = { hard: 0, cut: 0, gmin: 0, src: 0, fail: 0, damped: 0 };
  }
  newNode() { return ++this.N; }
  // map a node index back to the terminal point (for wire-current reconstruction)
  _pt(n) { if (!this.tp) return undefined; for (let i = 0; i < this.tp.length; i++) if (this.tp[i][0] === n) return this.tp[i][1]; return undefined; }
  _add(p) { p.pa = this._pt(p.a); p.pb = this._pt(p.b); this.prims.push(p); return p; }
  addR(a, b, g, owner) { return this._add({ t: 'R', a, b, g, i: 0, owner }); }
  addV(a, b, fn, r) { const p = this._add({ t: 'V', a, b, fn, r: Math.max(r || 0, R_SRC), k: -1, i: 0 }); this.vs.push(p); return p; }
  addI(a, b, fn) { return this._add({ t: 'I', a, b, fn, i: 0 }); }
  // be = always Backward-Euler (L-stable; for internal stiff poles such as op-amp compensation)
  addC(a, b, C, st, be) { if (st.v === undefined) st.v = 0; return this._add({ t: 'C', a, b, C: Math.max(C, 1e-15), st, g: 0, i: 0, be: !!be }); }
  addL(a, b, L, R, st) { if (st.i === undefined) st.i = 0; return this._add({ t: 'L', a, b, L: Math.max(L, 1e-9), R: Math.max(R || 0, 0), st, g: 0, i: 0 }); }
  // coupled inductor pair (transformer): windings a1-b1, a2-b2, inductances L1, L2, coupling k
  addK(a1, b1, a2, b2, L1, L2, k, st) {
    if (!st.i1) { st.i1 = 0; st.i2 = 0; st.v1 = 0; st.v2 = 0; }
    const M = k * Math.sqrt(L1 * L2), det = L1 * L2 - M * M;
    const p = { t: 'K', n: [a1, b1, a2, b2], L1, L2, M, det, st, cur: [0, 0, 0, 0], i1: 0, i2: 0 };
    p.pts = p.n.map(q => this._pt(q)); this.prims.push(p); return p;
  }
  // generic non-linear device
  addNL(model, nodes, par, st) {
    const m = nodes.length;
    const p = Object.assign({ t: 'N', model, ev: NLMODELS[model], n: nodes, st, G: new Float64Array(m * m), J: new Float64Array(m), cur: new Array(m).fill(0), i: 0 }, par);
    p.pts = nodes.map(q => this._pt(q));
    if (NLACCEPT[model]) { p.acc = NLACCEPT[model]; this.hasAcc = true; }
    this.prims.push(p); this.nl.push(p); return p;
  }
  // diode a->k; optional reverse breakdown (zener) bv>0
  addD(a, b, Is, nVt, st, bv, Isz, nVz) {
    if (st.vd === undefined) st.vd = 0;
    const par = { a, b, Is, nVt, vcrit: nVt * Math.log(nVt / (Math.SQRT2 * Is)) };
    if (bv > 0) { par.bv = bv; par.Isz = Isz || 1e-3; par.nVz = nVz || nVt; par.vcritZ = par.nVz * Math.log(par.nVz / (Math.SQRT2 * par.Isz)); }
    const p = this.addNL('diode', [a, b], par, st);
    p.pa = this._pt(a); p.pb = this._pt(b);
    return p;
  }
  // BJT: nodes base, collector, emitter; pol = +1 NPN, -1 PNP
  addQ(nb, nc, ne, pol, par, st) {
    if (st.vbe === undefined) { st.vbe = 0; st.vbc = 0; }
    const Is = par.Is || 1e-14;
    return this.addNL('bjt', [nb, nc, ne], { pol, Is, BF: par.BF || 100, BR: par.BR || 1, VAF: par.VAF || 0, vcrit: VT * Math.log(VT / (Math.SQRT2 * Is)), ic: 0, ib: 0, ie: 0 }, st);
  }
  // MOSFET/JFET channel: nodes gate, drain, source; pol = +1 N-channel, -1 P-channel. Level-1 square law.
  addM(ng, nd, ns, pol, par, st) {
    if (st.vgs === undefined) { st.vgs = 0; st.vds = 0; }
    return this.addNL('fet', [ng, nd, ns], { pol, Vth: par.Vth, K: par.K, lam: par.lam || 0.01, id: 0 }, st);
  }
  v(node) { return node > 0 && this.x ? this.x[node - 1] : 0; }

  finalize(dt, method) {
    this.method = method || 'be';
    if (this.method === 'be') this.beSteps = 3;
    this.needStamp = false;
    const trap = this.method === 'trap';
    const N = this.N;
    this.vs.forEach((p, j) => { p.k = N + j; });
    const n = this.n = N + this.vs.length;
    this.dt = dt;
    // (re)create the linear-algebra backend when the structure changes
    if (!this.lin || this.lin.n !== n) {
      if (n >= SPARSE_MIN_N && !MNA.forceDense || (MNA.forceSparse && n > 0)) {
        const pairs = [];
        const two = (a, b) => { if (a > 0) pairs.push([a - 1, a - 1]); if (b > 0) pairs.push([b - 1, b - 1]); if (a > 0 && b > 0) { pairs.push([a - 1, b - 1], [b - 1, a - 1]); } };
        for (const p of this.prims) {
          if (p.t === 'V') { if (p.a > 0) pairs.push([p.k, p.a - 1], [p.a - 1, p.k]); if (p.b > 0) pairs.push([p.k, p.b - 1], [p.b - 1, p.k]); }
          else if (p.n) { for (const a of p.n) for (const b of p.n) if (a > 0 && b > 0) pairs.push([a - 1, b - 1]); }
          else two(p.a, p.b);
        }
        this.lin = new SparseLU(n, pairs);
      } else this.lin = new DenseLU(n);
    }
    const L = this.lin, A = this.A0 = new Float64Array(L.nnz);
    const add = (r, c, g) => { const i = L.idx(r, c); if (i >= 0) A[i] += g; };
    const gs = (a, b, g) => {
      if (a > 0) add(a - 1, a - 1, g);
      if (b > 0) add(b - 1, b - 1, g);
      if (a > 0 && b > 0) { add(a - 1, b - 1, -g); add(b - 1, a - 1, -g); }
    };
    for (let i = 0; i < N; i++) add(i, i, SIMOPT.gmin);
    this.dIdx = new Int32Array(N); for (let i = 0; i < N; i++) this.dIdx[i] = L.idx(i, i);
    for (const p of this.prims) {
      switch (p.t) {
        case 'R': gs(p.a, p.b, p.g); break;
        case 'C': p.g = (trap && !p.be ? 2 : 1) * p.C / dt; gs(p.a, p.b, p.g); break;
        case 'L': p.g = 1 / (p.R + (trap ? 2 : 1) * p.L / dt); gs(p.a, p.b, p.g); break;
        case 'K': { // Γ = (h/α) L⁻¹, α = 2 (trap) or 1 (BE)
          const f = (trap ? dt / 2 : dt) / p.det;
          p.g11 = f * p.L2; p.g22 = f * p.L1; p.g12 = -f * p.M;
          const [a1, b1, a2, b2] = p.n;
          gs(a1, b1, p.g11); gs(a2, b2, p.g22);
          const cross = (a, b, c, d, g) => { if (a > 0 && c > 0) add(a - 1, c - 1, g); if (a > 0 && d > 0) add(a - 1, d - 1, -g); if (b > 0 && c > 0) add(b - 1, c - 1, -g); if (b > 0 && d > 0) add(b - 1, d - 1, g); };
          cross(a1, b1, a2, b2, p.g12); cross(a2, b2, a1, b1, p.g12);
          break;
        }
        case 'V': {
          const k = p.k;
          if (p.a > 0) { add(k, p.a - 1, 1); add(p.a - 1, k, 1); }
          if (p.b > 0) { add(k, p.b - 1, -1); add(p.b - 1, k, -1); }
          add(k, k, -p.r);
          break;
        }
      }
    }
    // pre-compute stamp indices of non-linear devices
    for (const p of this.nl) {
      const m = p.n.length; p.ix = new Int32Array(m * m);
      for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) p.ix[a * m + b] = (p.n[a] > 0 && p.n[b] > 0) ? L.idx(p.n[a] - 1, p.n[b] - 1) : -1;
      p.Vb = new Float64Array(m);
    }
    this.b0 = new Float64Array(n);
    this.linear = this.nl.length === 0;
    if (this.linear) L.factor(A); else this.Aw = new Float64Array(L.nnz);
    if (!this.x || this.x.length !== n) { const old = this.x; this.x = new Float64Array(n); if (old) this.x.set(old.subarray(0, Math.min(old.length, n))); }
  }

  _stampNL(A, b, x) {
    let limited = false;
    for (const d of this.nl) {
      const nn = d.n, m = nn.length, Vb = d.Vb;
      for (let k = 0; k < m; k++) Vb[k] = nn[k] > 0 ? x[nn[k] - 1] : 0;
      if (d.ev(d, Vb)) limited = true;
      const G = d.G, J = d.J, ix = d.ix;
      for (let k = 0; k < m; k++) {
        const nk = nn[k]; if (nk <= 0) continue;
        for (let j = 0; j < m; j++) { const q = ix[k * m + j]; if (q >= 0) A[q] += G[k * m + j]; }
        b[nk - 1] -= J[k];
      }
    }
    return limited;
  }

  // ---- right-hand side: independent sources (scaled by lam for source stepping) + companion models ----
  _assemble(t, lam) {
    const b0 = this.b0, trap = this.method === 'trap';
    b0.fill(0);
    const inj = (a, b, J) => { if (a > 0) b0[a - 1] -= J; if (b > 0) b0[b - 1] += J; };
    for (const p of this.prims) {
      switch (p.t) {
        case 'V': b0[p.k] = lam * p.fn(t); break;
        case 'I': inj(p.a, p.b, lam * p.fn(t)); break;
        case 'C': p.J = trap && !p.be ? -p.g * p.st.v - (p.st.i || 0) : -p.g * p.st.v; inj(p.a, p.b, p.J); break;
        case 'L': p.J = trap ? p.g * ((p.st.v || 0) - (p.R - 2 * p.L / this.dt) * p.st.i) : p.g * (p.L / this.dt) * p.st.i; inj(p.a, p.b, p.J); break;
        case 'K': { // i = Γ v + J ; J = i_prev (+ Γ v_prev for trapezoidal)
          const s = p.st;
          p.J1 = s.i1 + (trap ? p.g11 * s.v1 + p.g12 * s.v2 : 0);
          p.J2 = s.i2 + (trap ? p.g12 * s.v1 + p.g22 * s.v2 : 0);
          inj(p.n[0], p.n[1], p.J1); inj(p.n[2], p.n[3], p.J2);
          break;
        }
      }
    }
  }
  // ---- damped Newton-Raphson on the current stamp / RHS; gsh = extra shunt conductance on every node (gmin stepping) ----
  // Convergence (SPICE style): every unknown's update ≤ reltol·max(|x_new|,|x_old|) + vntol (node voltages) / abstol
  // (branch currents), and no device limited its junction voltage in the last iteration.
  _newton(maxIter, gsh) {
    const n = this.n, N = this.N, A = this.Aw, L = this.lin, b = this._bw || (this._bw = new Float64Array(n));
    const rt = SIMOPT.reltol, vn = SIMOPT.vntol, at = SIMOPT.abstol, dI = this.dIdx;
    let x = this.x, prev = Infinity, worst = -1, it, ok = false, bad = 0;
    for (it = 0; it < maxIter; it++) {
      A.set(this.A0); b.set(this.b0);
      if (gsh) for (let i = 0; i < N; i++) A[dI[i]] += gsh;
      const limited = this._stampNL(A, b, x);
      // KCL residual of the (exact) linearisation at x: r = A·x − b. Small residual ⇒ x already satisfies the circuit
      // equations; lets ill-conditioned nodes (e.g. a rectifier output island floating on reverse-biased diodes,
      // whose common-mode voltage is defined only by pA leakage) converge despite round-off jitter in the update.
      let resOK = SIMOPT.kclCheck && !limited && it > 0;
      if (resOK) {
        const rc = L.rc, nz = L.nnz, r = this._rw || (this._rw = new Float64Array(n)), ra = this._ra || (this._ra = new Float64Array(n));
        for (let i = 0; i < n; i++) { r[i] = -b[i]; ra[i] = Math.abs(b[i]); }
        for (let q = 0; q < nz; q++) { const a = A[q]; if (a === 0) continue; const v = a * x[rc[2 * q + 1]], i = rc[2 * q]; r[i] += v; ra[i] += Math.abs(v); }
        for (let i = 0; i < n; i++) if (Math.abs(r[i]) > (i < N ? 1e-12 : vn) + rt * ra[i]) { resOK = false; break; }
      }
      L.factor(A); L.solve(b);
      let maxd = 0, finite = true;
      for (let i = 0; i < n; i++) {
        const bi = b[i], xi = x[i];
        if (!(bi === bi) || bi === Infinity || bi === -Infinity) { finite = false; break; }
        const dd = Math.abs(bi - xi) / ((i < N ? vn : at) + rt * Math.max(Math.abs(bi), Math.abs(xi)));
        if (dd > maxd) { maxd = dd; worst = i; }
      }
      if (!finite) { bad++; break; }
      // damping: when the iteration stops contracting (limit cycle / overshoot), take a partial Newton step
      if (it >= 6 && maxd > 1 && maxd > 0.7 * prev) { const a = (it & 1) ? 0.5 : 0.8; for (let i = 0; i < n; i++) b[i] = x[i] + a * (b[i] - x[i]); this.stats.damped++; }
      prev = maxd;
      x = this.x = Float64Array.from(b);
      if (!limited && it > 0 && (maxd < 1 || (resOK && maxd < 100))) { ok = true; break; }
    }
    this.iters += it + 1; this.worst = worst;
    if (bad && this.xStart) this.x = Float64Array.from(this.xStart);
    return ok;
  }
  // continuation methods for one hard time point: gmin stepping, then source stepping
  _homotopy(t, devSnap) {
    const x0 = this.xStart, mi = SIMOPT.maxIter, rs = () => { for (const [st, c] of devSnap) Object.assign(st, c); };
    // gmin stepping: a large shunt makes every node well-defined, then relax it decade by decade
    this.x = Float64Array.from(x0); rs();
    let ok = true;
    for (let g = 1e-2; g > SIMOPT.gmin * 5; g /= 10) if (!this._newton(mi, g)) { ok = false; break; }
    if (ok && this._newton(mi, 0)) { this.stats.gmin++; return true; }
    // source stepping: ramp all independent sources from 0 to 100 %
    this.x = Float64Array.from(x0); rs();
    let lam = 0, dl = 0.1, good = Float64Array.from(x0), n = 0;
    while (lam < 1 && n++ < 200) {
      const l2 = Math.min(1, lam + dl);
      this._assemble(t, l2);
      if (this._newton(mi, 0)) { lam = l2; good = Float64Array.from(this.x); dl = Math.min(dl * 2, 0.5); }
      else { this.x = Float64Array.from(good); dl /= 4; if (dl < 1e-4) break; }
    }
    this._assemble(t, 1);
    if (lam >= 1) { this.stats.src++; return true; }
    return false;
  }

  // Solve one time step ending at t (step size this.dt). Returns true if converged.
  // If Newton fails, the step is retried automatically: (1) cut the time step (down to SIMOPT.minStep, Backward
  // Euler restart), (2) gmin stepping and source stepping at the hard time point; only if all of these fail is
  // the best-effort solution kept and converged = false reported.
  step(t) {
    if (this._nest || this.nl.length === 0) return this._stepOnce(t, false);
    this.iters = 0;
    const s0 = this.snapshot(), h = this.dt, meth = this.method, beSteps = this.beSteps, need = this.needStamp;
    let ok = this._stepOnce(t, false);
    if (ok) return true;
    const it0 = this.iters, worst0 = this.worst;
    this.stats.hard++;
    this._nest = true;
    try {
      const again = (m) => { this.restore(s0); this.finalize(h, m); if (m === meth) this.beSteps = beSteps; };
      if (SIMOPT.autoStep && !this.noCut) {
        again('be');
        this.minH = Math.max(SIMOPT.minStep, h / 4096);
        ok = this._cutStep(t - h, h, 0);
        if (ok) { this.stats.cut++; this.dt = h; this.needStamp = true; this.converged = true; return true; }
      }
      if (SIMOPT.homotopy) {
        again(this.noCut ? meth : 'be');
        ok = this._stepOnce(t, true);
        if (ok) { if (!this.noCut) this.needStamp = true; return true; }
      }
      // give up: redo the plain attempt so the state is the same best-effort solution as before, flag it
      this.restore(s0); this.finalize(h, meth); this.beSteps = beSteps; this.needStamp = need;
      this._stepOnce(t, false);
      this.converged = false; this.worst = worst0; this.iters = Math.max(this.iters, it0); this.stats.fail++;
      return false;
    } finally { this._nest = false; }
  }
  // integrate [t0, t0+h] with recursively halved Backward-Euler steps
  _cutStep(t0, h, depth) {
    const s = this.snapshot();
    this.finalize(h, 'be');
    if (this._stepOnce(t0 + h, false)) return true;
    if (h / 2 < this.minH) return false;
    this.restore(s);
    return this._cutStep(t0, h / 2, depth + 1) && this._cutStep(t0 + h / 2, h / 2, depth + 1);
  }
  _stepOnce(t, homo) {
    const snap = this.hasAcc && !this._redo ? this.snapshot() : null;
    if (this.needStamp) this.finalize(this.dt, 'be');
    else if (this.method === 'be' && this.beSteps-- <= 0) this.finalize(this.dt, 'trap');
    const n = this.n;
    if (n === 0) return true;
    this._assemble(t, 1);
    let x = this.x;
    const L = this.lin;
    if (this.linear) {
      const b = Float64Array.from(this.b0);
      L.solve(b);
      x = this.x = b; this.converged = true; this.iters = 1;
    } else {
      this.xStart = Float64Array.from(this.x);
      const devSnap = homo ? this.nl.map(p => [p.st, Object.assign({}, p.st)]) : null;
      let ok = this._newton(SIMOPT.maxIter, 0);
      if (!ok && homo) ok = this._homotopy(t, devSnap);
      this.converged = ok; x = this.x;
    }
    const V = (k) => (k > 0 ? x[k - 1] : 0);
    for (const p of this.prims) {
      switch (p.t) {
        case 'R': p.i = p.g * (V(p.a) - V(p.b)); break;
        case 'V': p.i = x[p.k]; break;
        case 'I': p.i = p.fn(t); break;
        case 'C': { const vab = V(p.a) - V(p.b); p.i = p.g * vab + p.J; p.st.v = vab; p.st.i = p.i; break; }
        case 'L': { const vab = V(p.a) - V(p.b); p.i = p.g * vab + p.J; p.st.i = p.i; p.st.v = vab; break; }
        case 'K': {
          const v1 = V(p.n[0]) - V(p.n[1]), v2 = V(p.n[2]) - V(p.n[3]), s = p.st;
          const i1 = p.g11 * v1 + p.g12 * v2 + p.J1, i2 = p.g12 * v1 + p.g22 * v2 + p.J2;
          s.i1 = i1; s.i2 = i2; s.v1 = v1; s.v2 = v2; p.i1 = i1; p.i2 = i2;
          p.cur[0] = i1; p.cur[1] = -i1; p.cur[2] = i2; p.cur[3] = -i2;
          break;
        }
        case 'N': {
          const m = p.n.length, cur = p.cur;
          for (let k = 0; k < m; k++) { let s = p.J[k]; for (let j = 0; j < m; j++) s += p.G[k * m + j] * V(p.n[j]); cur[k] = s; }
          if (p.model === 'diode') p.i = cur[0];
          else if (p.model === 'bjt') { p.ib = cur[0]; p.ic = cur[1]; p.ie = cur[2]; }
          else if (p.model === 'fet') p.id = cur[1];
          break;
        }
      }
    }
    // accepted-step hook for devices with discrete internal state (e.g. boost-module UVLO hysteresis)
    // a hook may change the device state and ask for the step to be redone (e.g. brown-out when no operating point exists)
    if (this.hasAcc) {
      const fixes = [];   // a hook returns a function that applies its state change (after the rewind)
      for (const p of this.nl) if (p.acc) { const f = p.acc(p, V, this.dt, this.converged); if (typeof f === 'function') fixes.push(f); }
      if (fixes.length && snap) { this.restore(snap); for (const f of fixes) f(); this._redo = true; try { return this._stepOnce(t, homo); } finally { this._redo = false; } }
    }
    return this.converged;
  }
  // state snapshot / restore (event localisation)
  snapshot() {
    const s = { x: this.x ? Float64Array.from(this.x) : null, method: this.method, beSteps: this.beSteps, dt: this.dt, st: [] };
    for (const p of this.prims) if (p.st) s.st.push([p.st, Object.assign({}, p.st)]);
    return s;
  }
  restore(s) {
    for (const [st, copy] of s.st) Object.assign(st, copy);
    if (s.x) this.x = Float64Array.from(s.x);
  }
}
MNA.forceDense = false; MNA.forceSparse = false;
