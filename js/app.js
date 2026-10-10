'use strict';
// ===== Main application: model, netlist building, simulation loop, rendering =====
const GRID = 20;
const STORE_KEY = 'dcaclab-sim-autosave';
const SAVE_KEY = 'dcaclab-sim-saved';
const DESIG = { battery: 'B', ac: 'AC', resistor: 'R', rheostat: 'RV', pot: 'RP', capacitor: 'C', inductor: 'L', diode: 'D', zener: 'DZ', bulb: 'H', led: 'LED', switch: 'S', button: 'SB', fuse: 'F', ammeter: 'A', voltmeter: 'V', multimeter: 'XMM', ground: 'GND', npn: 'Q', pnp: 'Q', nmos: 'M', ic555: 'U', scope: 'OSC', breadboard: 'BB' };

function defaultProps(type) {
  const p = {};
  for (const d of DEFS[type].props) p[d.k] = d.def;
  return p;
}
const snap = (v) => Math.round(v / GRID) * GRID;
const $ = (s) => document.querySelector(s);
const pkey = (x, y) => x + ',' + y;

const app = {
  comps: [], wires: [], nextId: 1,
  view: { s: 1, ox: 0, oy: 0 },
  sel: null, hover: null, hoverPt: null, hoverStrip: null,
  running: false, t: 0, dt: 2e-4, speed: 1,
  net: null, dirty: true, hasRun: false,
  history: [], hIdx: -1,
  showCurrent: true, electron: false, showNodes: false,
  wireColor: '#d62828', wireMode: false,
  drag: null, ghost: null, warn: '', mouse: [0, 0], acWin: 0.2, eventLoc: true, evComps: [],

  // ---------- geometry ----------
  termPos(c, i) { const t = DEFS[c.type].terms[i]; const [x, y] = U.rot(t[0], t[1], c.rot); return [c.x + x, c.y + y]; },
  localBox(c) { const d = DEFS[c.type]; return d.boxOf ? d.boxOf(c) : d.box; },
  worldBox(c) {
    const b = this.localBox(c);
    const pts = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([x, y]) => U.rot(x, y, c.rot));
    const xs = pts.map(p => p[0] + c.x), ys = pts.map(p => p[1] + c.y);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  },
  wEnd(w, e) { return e === 1 ? w.pts[0] : w.pts[w.pts.length - 1]; },
  // rendered path with rounded corners
  wirePts(w) {
    const P = w.pts, out = [P[0]];
    for (let i = 1; i < P.length - 1; i++) {
      const [px, py] = P[i - 1], [vx, vy] = P[i], [nx, ny] = P[i + 1];
      const l1 = Math.hypot(px - vx, py - vy), l2 = Math.hypot(nx - vx, ny - vy);
      const r = Math.min(12, l1 / 2, l2 / 2);
      if (r < 0.5) { out.push([vx, vy]); continue; }
      const ax = vx + (px - vx) / l1 * r, ay = vy + (py - vy) / l1 * r, bx = vx + (nx - vx) / l2 * r, by = vy + (ny - vy) / l2 * r;
      out.push([ax, ay]);
      for (let k = 1; k < 5; k++) { const t = k / 5, u = 1 - t; out.push([u * u * ax + 2 * u * t * vx + t * t * bx, u * u * ay + 2 * u * t * vy + t * t * by]); }
      out.push([bx, by]);
    }
    out.push(P[P.length - 1]);
    return out;
  },
  toWorld(sx, sy) { return [(sx - this.view.ox) / this.view.s, (sy - this.view.oy) / this.view.s]; },
  compAt(wx, wy, boards = true) {
    const hit = (c) => { const b = this.localBox(c); const [lx, ly] = U.rot(wx - c.x, wy - c.y, 4 - c.rot); return (lx >= b[0] - 3 && lx <= b[2] + 3 && ly >= b[1] - 3 && ly <= b[3] + 3) ? { c, lx, ly } : null; };
    for (let i = this.comps.length - 1; i >= 0; i--) { const c = this.comps[i]; if (DEFS[c.type].board) continue; const h = hit(c); if (h) return h; }
    if (boards) for (let i = this.comps.length - 1; i >= 0; i--) { const c = this.comps[i]; if (!DEFS[c.type].board) continue; const h = hit(c); if (h) return h; }
    return null;
  },
  // wire under point: returns {w, seg, q:[x,y] projection, d}
  wireHit(wx, wy, exclude) {
    const tol = Math.max(5, 7 / this.view.s);
    let best = null;
    for (let i = this.wires.length - 1; i >= 0; i--) {
      const w = this.wires[i]; if (w === exclude) continue;
      const P = w.pts;
      for (let j = 0; j < P.length - 1; j++) {
        const d = U.distSeg(wx, wy, P[j][0], P[j][1], P[j + 1][0], P[j + 1][1]);
        if (d < tol && (!best || d < best.d)) {
          const [ax, ay] = P[j], [bx, by] = P[j + 1], L2 = (bx - ax) ** 2 + (by - ay) ** 2;
          const t = L2 ? U.clamp(((wx - ax) * (bx - ax) + (wy - ay) * (by - ay)) / L2, 0, 1) : 0;
          best = { w, seg: j, q: [ax + t * (bx - ax), ay + t * (by - ay)], d };
        }
      }
    }
    return best;
  },
  wireAt(wx, wy) { const h = this.wireHit(wx, wy); return h ? h.w : null; },
  // nearest terminal / wire endpoint (optionally breadboard holes)
  pointAt(wx, wy, holes, exclude) {
    const tol = Math.max(8, 11 / this.view.s);
    let best = null, bd = tol;
    const test = (x, y, info) => { const d = Math.hypot(x - wx, y - wy); if (d < bd) { bd = d; best = Object.assign({ x, y }, info); } };
    for (const c of this.comps) DEFS[c.type].terms.forEach((_, i) => { const [x, y] = this.termPos(c, i); test(x, y, { comp: c, term: i }); });
    for (const w of this.wires) { if (w === exclude) continue; const a = w.pts[0], b = w.pts[w.pts.length - 1]; test(a[0], a[1], { wire: w, end: 1 }); test(b[0], b[1], { wire: w, end: 2 }); }
    if (holes && !best) for (const c of this.comps) if (DEFS[c.type].board) for (const h of bbHoles(c)) test(h.x, h.y, { hole: h, board: c });
    return best;
  },
  holeAt(wx, wy) {
    for (let i = this.comps.length - 1; i >= 0; i--) {
      const c = this.comps[i]; if (!DEFS[c.type].board) continue;
      for (const h of bbHoles(c)) if (Math.abs(h.x - wx) < 9 && Math.abs(h.y - wy) < 9) return { c, strip: h.strip, h };
    }
    return null;
  },
  attachedEnds(c) {
    const res = [];
    DEFS[c.type].terms.forEach((_, i) => {
      const [x, y] = this.termPos(c, i);
      for (const w of this.wires) for (const e of [1, 2]) { const p = this.wEnd(w, e); if (p[0] === x && p[1] === y) res.push({ w, end: e, term: i }); }
    });
    return res;
  },
  followTerms(c, att) { for (const a of att) { const [x, y] = this.termPos(c, a.term); this.setEnd(a.w, a.end, x, y); } },
  // move one wire end, keeping the adjacent segment orthogonal where possible
  setEnd(w, end, x, y) {
    const P = w.pts;
    const I = () => (end === 1 ? 0 : P.length - 1), J = () => (end === 1 ? 1 : P.length - 2);
    const old = P[I()];
    if (old[0] === x && old[1] === y) return;
    // collapse a neighbour vertex that coincides with the end (would lose the orthogonal direction)
    while (P.length > 2 && P[J()][0] === P[I()][0] && P[J()][1] === P[I()][1]) P.splice(J(), 1);
    const i = I(), j = J();
    if (P.length >= 3) {
      const nb = P[j], o = P[i];
      if (nb[1] === o[1] && nb[0] !== o[0]) P[j] = [nb[0], y];
      else if (nb[0] === o[0] && nb[1] !== o[1]) P[j] = [x, nb[1]];
    }
    P[i] = [x, y];
    if (P.length === 2 && P[0][0] !== P[1][0] && P[0][1] !== P[1][1]) P.splice(1, 0, w.bend ? [P[0][0], P[1][1]] : [P[1][0], P[0][1]]);
  },
  normalizeWire(w) {
    let P = w.pts.filter((p, i) => i === 0 || p[0] !== w.pts[i - 1][0] || p[1] !== w.pts[i - 1][1]);
    for (let i = P.length - 2; i >= 1; i--) {
      const a = P[i - 1], b = P[i], c = P[i + 1];
      if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) {
        // drop collinear vertex only if it lies between neighbours
        const between = (a[0] === c[0]) ? (b[1] - a[1]) * (b[1] - c[1]) <= 0 : (b[0] - a[0]) * (b[0] - c[0]) <= 0;
        if (between) P.splice(i, 1);
      }
    }
    if (P.length < 2) P = [P[0], P[0]];
    w.pts = P;
  },
  lPath(x1, y1, x2, y2, bend) {
    if (x1 === x2 || y1 === y2) return [[x1, y1], [x2, y2]];
    return [[x1, y1], bend ? [x1, y2] : [x2, y1], [x2, y2]];
  },
  // split wire hit.w at point q -> junction
  splitWire(hit, q) {
    const w = hit.w, P = w.pts, k = hit.seg;
    const A = P.slice(0, k + 1).concat([q]), B = [q].concat(P.slice(k + 1));
    w.pts = A; this.normalizeWire(w);
    const nw = { id: this.nextId++, pts: B, color: w.color, _i: 0, _phase: 0 };
    this.normalizeWire(nw);
    this.wires.push(nw); this.dirty = true;
    return nw;
  },
  pointOccupied(x, y, exclude) {
    for (const c of this.comps) for (let i = 0; i < DEFS[c.type].terms.length; i++) { const p = this.termPos(c, i); if (p[0] === x && p[1] === y) return true; }
    for (const w of this.wires) { if (w === exclude) continue; for (const e of [1, 2]) { const p = this.wEnd(w, e); if (p[0] === x && p[1] === y) return true; } }
    return false;
  },
  // if (x,y) is a free wire end lying on another wire's body, split that wire there
  autoJunction(w, end) {
    const [x, y] = this.wEnd(w, end);
    if (this.pointOccupied(x, y, w)) return false;
    const h = this.wireHit(x, y, w);
    if (!h || h.d > 0.5) return false;
    this.splitWire(h, [x, y]);
    return true;
  },
  // ---- wires running exactly over terminals / other wire ends ----
  // index of the segment of w whose interior contains (x,y), or -1 (the wire's own end points do not count)
  _interiorSeg(w, x, y) {
    const P = w.pts, a = P[0], b = P[P.length - 1];
    if ((a[0] === x && a[1] === y) || (b[0] === x && b[1] === y)) return -1;
    for (let j = 0; j < P.length - 1; j++) if (U.distSeg(x, y, P[j][0], P[j][1], P[j + 1][0], P[j + 1][1]) < 0.5) return j;
    return -1;
  },
  // every terminal / wire end lying on the interior of a wire (restricted to `wires` when given)
  findPassOvers(wires) {
    const pts = [], byX = new Map(), byY = new Map();
    const put = (m, k, p) => { let l = m.get(k); if (!l) m.set(k, l = []); l.push(p); };
    for (const c of this.comps) { if (DEFS[c.type].board) continue; DEFS[c.type].terms.forEach((_, i) => { const [x, y] = this.termPos(c, i); pts.push({ x, y, comp: c, term: i }); }); }
    for (const w of this.wires) for (const e of [1, 2]) { const [x, y] = this.wEnd(w, e); pts.push({ x, y, wire: w }); }
    for (const p of pts) { put(byX, p.x, p); put(byY, p.y, p); }
    const res = [];
    for (const w of (wires || this.wires)) {
      const P = w.pts, a0 = P[0], a1 = P[P.length - 1], seen = new Set();
      for (let j = 0; j < P.length - 1; j++) {
        const [ax, ay] = P[j], [bx, by] = P[j + 1];
        const cand = ay === by ? (byY.get(ay) || []).filter(p => (p.x - ax) * (p.x - bx) <= 0)
          : ax === bx ? (byX.get(ax) || []).filter(p => (p.y - ay) * (p.y - by) <= 0)
          : pts.filter(p => U.distSeg(p.x, p.y, ax, ay, bx, by) < 0.5);
        for (const p of cand) {
          if (p.wire === w || (p.x === a0[0] && p.y === a0[1]) || (p.x === a1[0] && p.y === a1[1])) continue;
          const k = pkey(p.x, p.y) + (p.comp ? 'c' + p.comp.id + ':' + p.term : 'w' + p.wire.id);
          if (seen.has(k)) continue; seen.add(k);
          res.push({ w, seg: j, x: p.x, y: p.y, comp: p.comp, term: p.term, wire: p.wire });
        }
      }
    }
    return res;
  },
  // split wires at the given pass-over points so they really connect; returns the number of joins
  _joinAt(list, guard) {
    const byW = new Map(), skipped = [];
    let n = 0;
    for (const p of list) { if (!byW.has(p.w)) byW.set(p.w, []); byW.get(p.w).push(p); }
    for (const [w, L] of byW) {
      // a wire lying over two terminals of the same part would short it: leave those marked instead
      const cc = new Map(); for (const p of L) if (p.comp) cc.set(p.comp, (cc.get(p.comp) || 0) + 1);
      // parts already attached to this wire's ends: joining another of their pins would short the part
      const own = new Set(), e1 = w.pts[0], e2 = w.pts[w.pts.length - 1];
      for (const c of this.comps) if (!DEFS[c.type].board) DEFS[c.type].terms.forEach((_, i) => { const q = this.termPos(c, i); if ((q[0] === e1[0] && q[1] === e1[1]) || (q[0] === e2[0] && q[1] === e2[1])) own.add(c); });
      const bad = new Set(); // locations of pins of those parts (also blocks other wires' ends sitting on them)
      if (guard) for (const p of L) if (p.comp && (cc.get(p.comp) > 1 || own.has(p.comp))) bad.add(pkey(p.x, p.y));
      const pieces = [w], done = new Set();
      for (const p of L) {
        if (guard && bad.has(pkey(p.x, p.y))) { skipped.push(p); continue; }
        const k = pkey(p.x, p.y); if (done.has(k)) continue; done.add(k);
        for (const q of pieces) { const j = this._interiorSeg(q, p.x, p.y); if (j >= 0) { pieces.push(this.splitWire({ w: q, seg: j }, [p.x, p.y])); n++; break; } }
      }
    }
    return { n, skipped };
  },
  // called after a wire was drawn / edited or parts were moved / rotated
  autoJoin(wires, comps) {
    wires = (wires || []).filter(w => this.wires.includes(w));
    let n = 0;
    for (const w of wires) for (const e of [1, 2]) if (this.wires.includes(w) && this.autoJunction(w, e)) n++;
    let cand = this.findPassOvers(wires);
    if (comps && comps.length) {
      const set = new Set(comps), ws = new Set(wires);
      cand = cand.concat(this.findPassOvers().filter(p => p.comp && set.has(p.comp) && !ws.has(p.w)));
    }
    const r = this._joinAt(cand, true);
    n += r.n;
    if (n) { this.dirty = true; this.toast(_t('app.auto_connected') + n + _t('app.spot_s_terminals_under_the_wire_are')); }
    if (r.skipped.length) this.toast((n ? _t('app.auto_connected') + n + _t('app.spot_s') : '') + _t('app.a_wire_crosses_other_pins_of_the_sam'));
    return n;
  },
  // J key: connect every remaining pass-over
  joinPassOvers() {
    const r = this._joinAt(this.findPassOvers(), false);
    if (r.n) { this.dirty = true; this.changed(); this.toast(_t('app.connected') + r.n + _t('app.wire_s_passing_over_terminals')); } else this.toast(_t('app.no_wire_overlaps_to_connect'));
    return r.n;
  },
  designators() {
    const cnt = {}, map = new Map();
    for (const c of this.comps) { const p = DEFS[c.type].desig || DESIG[c.type] || '?'; cnt[p] = (cnt[p] || 0) + 1; map.set(c, p + cnt[p]); }
    return map;
  },

  // ---------- model ----------
  addComp(type, x, y, rot = 0, props) {
    const c = { id: this.nextId++, type, x: snap(x), y: snap(y), rot, props: Object.assign(defaultProps(type), props || {}), state: {}, _m: {} };
    if (DEFS[type].board) this.comps.unshift(c); else this.comps.push(c);
    this.dirty = true; return c;
  },
  addWire(x1, y1, x2, y2, bend = 0, color) {
    const w = { id: this.nextId++, pts: this.lPath(x1, y1, x2, y2, bend), bend, color: color || this.wireColor, _i: 0, _phase: 0 };
    this.wires.push(w); this.dirty = true; return w;
  },
  deleteSel() {
    if (!this.sel) return;
    if (this.sel.multi) { this.deleteGroup(); return; }
    if (this.sel.comp) this.comps = this.comps.filter(c => c !== this.sel.comp);
    if (this.sel.wire) this.wires = this.wires.filter(w => w !== this.sel.wire);
    this.sel = null; this.dirty = true; this.changed(); this.refreshProps();
  },
  rotateSel() {
    if (this.sel && this.sel.multi) { this.rotateGroup(); return; }
    const c = this.sel && this.sel.comp;
    if (c && DEFS[c.type].board) { // rotate the board together with everything plugged into it
      const keys = new Set(bbHoles(c).map(h => pkey(h.x, h.y)));
      const R = (p) => { const [x, y] = U.rot(p[0] - c.x, p[1] - c.y, 1); return [c.x + x, c.y + y]; };
      const parts = this.comps.filter(o => o !== c && !DEFS[o.type].board && DEFS[o.type].terms.length && DEFS[o.type].terms.every((_, i) => keys.has(pkey(...this.termPos(o, i)))));
      const moves = [];
      for (const w of this.wires) {
        const e1 = keys.has(pkey(...w.pts[0])), e2 = keys.has(pkey(...w.pts[w.pts.length - 1]));
        if (e1 && e2) w.pts = w.pts.map(R); else if (e1 || e2) moves.push([w, e1 ? 1 : 2, R(this.wEnd(w, e1 ? 1 : 2))]);
      }
      for (const o of parts) { const att = this.attachedEnds(o).filter(a => !keys.has(pkey(...this.wEnd(a.w, a.end)))); [o.x, o.y] = R([o.x, o.y]); o.rot = (o.rot + 1) % 4; this.followTerms(o, att); }
      c.rot = (c.rot + 1) % 4;
      for (const [w, e, q] of moves) { this.setEnd(w, e, q[0], q[1]); this.normalizeWire(w); }
      this.dirty = true; this.changed(); return;
    }
    if (c) { const att = this.attachedEnds(c); c.rot = (c.rot + 1) % 4; this.followTerms(c, att); att.forEach(a => this.normalizeWire(a.w)); this.autoJoin([], [c]); this.dirty = true; this.changed(); }
    else if (this.sel && this.sel.wire) {
      const w = this.sel.wire, a = w.pts[0], b = w.pts[w.pts.length - 1];
      w.bend = w.bend ? 0 : 1; w.pts = this.lPath(a[0], a[1], b[0], b[1], w.bend); this.changed();
    }
  },
  duplicateSel() {
    if (this.sel && this.sel.multi) { this.duplicateGroup(); return; }
    const c = this.sel && this.sel.comp; if (!c) return;
    const n = this.addComp(c.type, c.x + 40, c.y + 40, c.rot, JSON.parse(JSON.stringify(c.props)));
    this.sel = { comp: n }; this.changed(); this.refreshProps();
  },
  clearAll() { this.comps = []; this.wires = []; this.sel = null; this.resetSim(); this.dirty = true; this.changed(); this.refreshProps(); },
  serialize() {
    return {
      app: 'dcaclab-sim', version: 2, ...(this.title ? { title: this.title } : {}),
      comps: this.comps.map(c => ({ id: c.id, type: c.type, x: c.x, y: c.y, rot: c.rot, props: c.props })),
      wires: this.wires.map(w => ({ id: w.id, pts: w.pts.map(p => [p[0], p[1]]), color: w.color })),
    };
  },
  load(data, keepHistory) {
    if (typeof data === 'string') data = JSON.parse(data);
    if (!data || !Array.isArray(data.comps)) throw new Error(_t('app.invalid_circuit_file'));
    const comps = data.comps.filter(c => DEFS[c.type]).map(c => ({ id: c.id, type: c.type, x: c.x, y: c.y, rot: c.rot || 0, props: Object.assign(defaultProps(c.type), JSON.parse(JSON.stringify(c.props || {}))), state: {}, _m: {} }));
    this.comps = comps.filter(c => DEFS[c.type].board).concat(comps.filter(c => !DEFS[c.type].board));
    this.wires = (data.wires || []).map(w => ({
      id: w.id, color: w.color || '#d62828', _i: 0, _phase: 0,
      pts: Array.isArray(w.pts) && w.pts.length >= 2 ? w.pts.map(p => [p[0], p[1]]) : this.lPath(w.x1, w.y1, w.x2, w.y2, w.bend || 0),
    }));
    this.nextId = 1 + Math.max(0, ...this.comps.map(c => c.id || 0), ...this.wires.map(w => w.id || 0));
    this.title = typeof data.title === 'string' ? data.title : '';
    this.sel = null; this.mergeWires(); this.resetSim(); this.dirty = true;
    if (!keepHistory) this.changed();
    this.refreshProps();
  },
  changed() {
    if (!this.drag || this.drag.kind === 'pan' || this.drag.kind === 'box') this.mergeWires();   // wire chains become one wire (same undo step)
    const s = JSON.stringify(this.serialize());
    if (this.history[this.hIdx] === s) return;
    this.history = this.history.slice(0, this.hIdx + 1); this.history.push(s);
    if (this.history.length > 100) this.history.shift();
    this.hIdx = this.history.length - 1;
    try { localStorage.setItem(STORE_KEY, s); } catch (e) { /* ignore */ }
  },
  undo() { if (this.hIdx > 0) { this.hIdx--; this.restoreHist(); } },
  redo() { if (this.hIdx < this.history.length - 1) { this.hIdx++; this.restoreHist(); } },
  restoreHist() {
    const t = this.t, running = this.running;
    const st = new Map(this.comps.map(c => [c.id, c.state]));
    const S = this.selItems ? this.selItems() : { comps: [], wires: [] }, sc = new Set(S.comps.map(c => c.id)), sw = new Set(S.wires.map(w => w.id));
    this.load(this.history[this.hIdx], true);
    this.comps.forEach(c => { if (st.has(c.id)) c.state = st.get(c.id); });
    if (this.setSelection && (sc.size || sw.size)) this.setSelection(this.comps.filter(c => sc.has(c.id)), this.wires.filter(w => sw.has(w.id)));
    this.t = t; this.hasRun = t > 0; this.running = running; this.updateRunBtn();
    try { localStorage.setItem(STORE_KEY, this.history[this.hIdx]); } catch (e) { /* ignore */ }
  },
  loadExample(id) {
    const ex = EXAMPLES.find(e => e.id === id) || EXAMPLES[0];
    if (typeof MCU !== 'undefined') MCU.closeEditor();
    this.load(ex.build());
    // v14: audio examples may ask for a finer time step (the default 0.2 ms only represents audio up to ~1 kHz well); restore the user's value afterwards
    if (ex.dt) { if (!this._userDt) this._userDt = this.dt; this.dt = ex.dt; } else if (this._userDt) { this.dt = this._userDt; this._userDt = 0; }
    { const e = document.getElementById('set-dt'); if (e && typeof U !== 'undefined') e.value = U.fmt(this.dt, 's'); }
    this.fitView();
    this.toast(_t('app.example_loaded') + ex.name);
  },

  // ---------- simulation ----------
  resetSim() {
    if (typeof AUD !== 'undefined') AUD.silence(); else if (typeof stopBuzzers === 'function') stopBuzzers();
    this.t = 0; this.hasRun = false; this.net = null; this.dirty = true; this.warn = ''; this.conv = null;
    for (const c of this.comps) { c.state = {}; c._m = {}; }
    for (const w of this.wires) { w._i = 0; w._phase = 0; }
  },
  // connectivity: terminal points, ideal-conductor union-find, ground merge -> point->node map (works on any comp objects)
  _topology(comps) {
    const idx = new Map(), P = [];
    const pid = (x, y) => { const k = pkey(x, y); let i = idx.get(k); if (i === undefined) { i = P.length; idx.set(k, i); P.push([x, y]); } return i; };
    const cpts = comps.map(c => DEFS[c.type].terms.map((_, i) => pid(...this.termPos(c, i))));
    const wpts = this.wires.map(w => { const a = w.pts[0], b = w.pts[w.pts.length - 1]; return [pid(a[0], a[1]), pid(b[0], b[1])]; });
    // ideal connections (merged into super-nodes): wires, closed switches, breadboard strips
    const edges = [];
    this.wires.forEach((w, k) => edges.push({ a: wpts[k][0], b: wpts[k][1], owner: w, i: 0 }));
    comps.forEach((c, k) => {
      const d = DEFS[c.type];
      if (d.shorted) { const pr = d.shorted(c); if (pr) for (const [i, j] of pr) edges.push({ a: cpts[k][i], b: cpts[k][j], owner: c, i: 0, inner: !!d.innerShort }); }
      if (d.board) {
        const strips = new Map();
        for (const h of bbHoles(c)) { const q = idx.get(pkey(h.x, h.y)); if (q === undefined) continue; if (!strips.has(h.strip)) strips.set(h.strip, []); strips.get(h.strip).push(q); }
        for (const list of strips.values()) for (let i = 1; i < list.length; i++) edges.push({ a: list[i - 1], b: list[i], owner: c, strip: true, i: 0 });
      }
    });
    const np = P.length, par = Array.from({ length: np }, (_, i) => i);
    const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    for (const e of edges) { const a = find(e.a), b = find(e.b); if (a !== b) par[a] = b; }
    const gndPts = new Set();
    comps.forEach((c, k) => { if (c.type === 'ground') gndPts.add(cpts[k][0]); });
    const gndRoots = new Set([...gndPts].map(find));
    const rootNode = new Map(); let N = 0;
    const pointNode = new Int32Array(np);
    for (let i = 0; i < np; i++) { const r = find(i); if (gndRoots.has(r)) { pointNode[i] = 0; continue; } if (!rootNode.has(r)) rootNode.set(r, ++N); pointNode[i] = rootNode.get(r); }
    return { idx, P, cpts, wpts, edges, find, gndPts, pointNode, N };
  },
  // stamp every component into a new MNA (not finalized); floating islands get a reference
  _buildMNA(comps, T) {
    const m = new MNA();
    m.N = T.N;
    comps.forEach((c, k) => {
      c._pts = T.cpts[k];
      c._nodes = c._pts.map(p => T.pointNode[p]);
      c._p = c._p2 = c._pi = c._q = null; if (!c._m) c._m = {};
      m.tp = c._nodes.map((n, i) => [n, c._pts[i]]);
      DEFS[c.type].build(c, c._nodes, m);
    });
    m.tp = null;
    const NN = m.N, ip = Array.from({ length: NN + 1 }, (_, i) => i);
    const f2 = (i) => { while (ip[i] !== i) { ip[i] = ip[ip[i]]; i = ip[i]; } return i; };
    const un = (a, b) => { a = f2(a); b = f2(b); if (a !== b) ip[a] = b; };
    for (const p of m.prims) {
      if (p.t === 'K') { un(p.n[0], p.n[1]); un(p.n[2], p.n[3]); continue; }   // transformer windings are isolated
      if (p.iso) { for (const g of p.iso) for (let k = 1; k < g.length; k++) un(p.n[g[k - 1]], p.n[g[k]]); continue; }   // isolated device (optocoupler)
      if (p.n) { const g = p.model === 'opamp' ? p.n.slice(2) : p.n; for (let k = 1; k < g.length; k++) un(g[k - 1], g[k]); continue; }
      if (p.t === 'R' && p.g < 1e-7) continue; un(p.a, p.b);
    }
    const refd = new Set([f2(0)]);
    for (const c of comps) if (c.type === 'battery' || c.type === 'ac') { const n0 = c._nodes[0], r = f2(n0); if (!refd.has(r)) { refd.add(r); m.addR(n0, 0, 1); } }
    for (let i = 1; i <= NN; i++) { const r = f2(i); if (!refd.has(r)) { refd.add(r); m.addR(i, 0, 1); } }
    return m;
  },
  rebuild() {
    this.passOvers = this.findPassOvers();
    const T = this._topology(this.comps);
    const { P, edges, find, gndPts, pointNode, N } = T;
    this.wires.forEach((w, k) => { w._pa = T.wpts[k][0]; w._pb = T.wpts[k][1]; });
    const m = this._buildMNA(this.comps, T);
    for (const w of this.wires) w._nodes = [pointNode[w._pa], pointNode[w._pb]];
    m.finalize(this.dt);
    // groups of ideal conductors, for reconstructing wire currents (min-norm split in loops)
    const groups = new Map();
    for (const e of edges) { if (e.a === e.b) continue; const r = find(e.a); if (!groups.has(r)) groups.set(r, { pts: new Set(), edges: [] }); const g = groups.get(r); g.pts.add(e.a); g.pts.add(e.b); g.edges.push(e); }
    this.groups = [];
    for (const g of groups.values()) {
      const pts = [...g.pts];
      let ref = pts.find(p => gndPts.has(p)); if (ref === undefined) ref = pts[0];
      const others = pts.filter(p => p !== ref), k = others.length, li = new Map(others.map((p, i) => [p, i]));
      if (k > 120) { this.groups.push(this.treeGroup(ref, pts, g.edges)); continue; } // large nets: spanning-tree currents (O(n))
      const L = new Float64Array(k * k);
      for (const e of g.edges) { const a = li.get(e.a), b = li.get(e.b); if (a !== undefined) L[a * k + a] += 1; if (b !== undefined) L[b * k + b] += 1; if (a !== undefined && b !== undefined) { L[a * k + b] -= 1; L[b * k + a] -= 1; } }
      const piv = new Int32Array(k); luFactor(L, k, piv);
      this.groups.push({ others, li, L, piv, k, edges: g.edges });
    }
    this.edges = edges; this.P = P; this.pointNode = pointNode;
    // RMS averaging window: integer number of periods of the slowest AC source
    let fmin = Infinity;
    for (const c of this.comps) if (c.type === 'ac' && c.props.f > 0) fmin = Math.min(fmin, c.props.f);
    if (isFinite(fmin)) { const T = 1 / fmin; this.acWin = T * Math.max(1, Math.ceil(0.2 / T)); } else this.acWin = 0.2;
    this.evComps = this.comps.filter(c => DEFS[c.type].event);
    this.mcuComps = this.comps.filter(c => DEFS[c.type].mcu);
    // v11 sensors: hooks after every (sub-)step solve, parts with timed digital edges, direct MCU-pin → sensor-input links
    this.subComps = this.comps.filter(c => DEFS[c.type].sub);
    this.edgeComps = this.comps.filter(c => DEFS[c.type].nextEdge);
    this._dlink = null;
    for (const c of this.comps) { const d = DEFS[c.type]; if (!d.dins) continue; for (const i of d.dins) { const nd = c._nodes[i]; if (!(nd > 0)) continue; if (!this._dlink) this._dlink = new Map(); if (!this._dlink.has(nd)) this._dlink.set(nd, []); this._dlink.get(nd).push([c, i]); } }
    this.net = m; this.nodeCount = N; this.dirty = false;
  },
  computeWireCurrents() {
    const m = this.net; if (!m || !this.P) return;
    const inj = new Float64Array(this.P.length);
    for (const p of m.prims) {
      if (p.pts) { if (p.cur) for (let k = 0; k < p.pts.length; k++) if (p.pts[k] !== undefined) inj[p.pts[k]] -= p.cur[k]; continue; }
      if (p.pa !== undefined) inj[p.pa] -= p.i;
      if (p.pb !== undefined) inj[p.pb] += p.i;
    }
    for (const g of this.groups) {
      if (g.tree) { this.treeCurrents(g, inj); continue; }
      const b = new Float64Array(g.k);
      g.others.forEach((p, i) => { b[i] = inj[p]; });
      if (g.k) luSolve(g.L, g.k, g.piv, b);
      const phi = (p) => { const i = g.li.get(p); return i === undefined ? 0 : b[i]; };
      for (const e of g.edges) {
        e.i = phi(e.a) - phi(e.b);
        if (e.owner && e.owner.pts) e.owner._i = e.i;
        else if (e.owner && !e.strip && !e.inner && e.owner._m) { e.owner._m.I = e.i; e.owner._m.V = 0; e.owner._m.P = 0; }
      }
    }
    for (const e of this.edges) if (e.a === e.b && e.owner && e.owner.pts) e.owner._i = 0;
  },
  // BFS spanning tree of an ideal-conductor group; loop (chord) edges carry no current
  treeGroup(ref, pts, edges) {
    const adj = new Map(pts.map(p => [p, []]));
    edges.forEach((e, i) => { adj.get(e.a).push([e.b, i, 1]); adj.get(e.b).push([e.a, i, -1]); });
    const order = [ref], parent = new Map([[ref, null]]);
    for (let q = 0; q < order.length; q++) { const u = order[q]; for (const [v, i, dir] of adj.get(u)) if (!parent.has(v)) { parent.set(v, [u, i, dir]); order.push(v); } }
    return { tree: true, order, parent, edges };
  },
  treeCurrents(g, inj) {
    for (const e of g.edges) e.i = 0;
    const acc = new Map();
    for (let q = g.order.length - 1; q > 0; q--) {
      const v = g.order[q], [u, i, dir] = g.parent.get(v);
      const s = (acc.get(v) || 0) + inj[v];            // net current that must leave v towards its parent
      const e = g.edges[i]; e.i = dir === 1 ? -s : s;  // edge a->b current (dir=1: parent is e.a, child e.b)
      acc.set(u, (acc.get(u) || 0) + s);
    }
    for (const e of g.edges) {
      if (e.owner && e.owner.pts) e.owner._i = e.i;
      else if (e.owner && !e.strip && !e.inner && e.owner._m) { e.owner._m.I = e.i; e.owner._m.V = 0; e.owner._m.P = 0; }
    }
  },
  // v11: earliest timed digital edge of a sensor after tc (splits MCU sub-steps so edges land exactly)
  nextDEdge(tc) {
    let e = Infinity; const L = this.edgeComps; if (!L || !L.length) return e;
    for (const c of L) { const x = DEFS[c.type].nextEdge(c, tc + 1e-9); if (x < e) e = x; }
    return e;
  },
  runSubs(m, ta, tb) { const L = this.subComps; if (L && L.length) for (const c of L) DEFS[c.type].sub(c, m, ta, tb, this); },
  simStep() {
    if (this.dirty || !this.net) this.rebuild();
    const m = this.net, t0 = this.t, h = this.dt, t = t0 + h;
    const ok = this.mcuComps && this.mcuComps.length ? this._mcuStep(m, t0, h, t) : this._stepLoc(m, t0, h, t);
    this.t = t; this.hasRun = true;
    for (const c of this.comps) {
      const n = c._nodes, mm = c._m;
      mm.V = n.length > 1 ? m.v(n[0]) - m.v(n[1]) : 0; // drop along terminal 1 -> 2 (same direction as the positive current)
      mm.I = c._p ? c._p.i : 0; mm.P = undefined;
      const d = DEFS[c.type];
      if (d.measure) d.measure(c, m);
      if (mm.P === undefined) mm.P = Math.abs(mm.V * mm.I);
    }
    for (const c of this.comps) { const d = DEFS[c.type]; if (d.post) d.post(c, this.dt, this); }
    let maxI = 0;
    for (const p of m.prims) if (p.t === 'V') maxI = Math.max(maxI, Math.abs(p.i));
    this.maxSrcI = maxI;
    if (!ok) this.noteConvFail(m, t);
    this.warn = !ok ? _t('app.convergence_difficulty_continuing_wi') : (maxI > 500 ? _t('app.short_circuit_detected_current') + U.fmt(maxI, 'A', 3) : '');
  },
  // one time step with event localisation for switching parts (555): rewind and split the step at the event
  _stepLoc(m, t0, h, t) {
    const evc = this.evComps;
    const snap = evc.length && this.eventLoc ? m.snapshot() : null;
    let ok = m.step(t);
    this.runSubs(m, t0, t);
    if (snap) {
      // event localisation: find the earliest switching event inside the step, rewind and split the step there
      let best = null;
      for (const c of evc) { const e = DEFS[c.type].event(c, m, this); if (e && (!best || e.theta < best.theta)) best = e; }
      if (best) {
        const th = U.clamp(best.theta, 0, 1);
        if (th < 0.999) {
          m.restore(snap);
          if (th > 1e-4) { m.finalize(h * th, 'be'); m.step(t0 + h * th); }
          best.fire(t0 + h * th);
          m.finalize(h * (1 - th), 'be'); ok = m.step(t);
          m.dt = h; m.needStamp = true;
        } else { best.fire(t); m.needStamp = true; }
        this.events = (this.events || 0) + 1;
      }
    }
    return ok;
  },
  // v10: microcontrollers run their programs up to the end of the step; every timed pin change inside the step
  // splits it (backward-Euler sub-steps), so edges land at their exact simulated time
  _mcuStep(m, t0, h, t1) {
    const mc = this.mcuComps, minsp = Math.max(1e-6, h / 64);
    let tc = t0, n = 0, ok = true;
    const adv = () => {
      let e = Infinity;
      for (const c of mc) { const rt = c.state.rt; if (rt) { rt.minsp = minsp; const x = rt.advance(tc, t1, !!m._solved || tc > t0); if (x < e) e = x; } }
      return e;
    };
    const nde = () => (this.edgeComps && this.edgeComps.length ? this.nextDEdge(tc) : Infinity);
    let te = Math.min(adv(), nde());
    if (!(te < t1 - minsp)) ok = this._stepLoc(m, t0, h, t1);
    else {
      while (te < t1 - minsp && n < 256) {
        m.finalize(te - tc, 'be'); if (!m.step(te)) ok = false;
        this.runSubs(m, tc, te);
        tc = te; n++; te = Math.min(adv(), nde());
      }
      m.finalize(t1 - tc, 'be'); if (!m.step(t1)) ok = false;
      this.runSubs(m, tc, t1);
      m.dt = h; m.needStamp = true;
      this.mcuSplits = (this.mcuSplits || 0) + n;
    }
    m._solved = true;   // (events due exactly at t1 fire at the start of the next step, after the measurements)
    return ok;
  },
  // a step that still failed after every automatic remedy: remember it, mark the components around the worst unknown,
  // show one friendly (throttled) toast; the simulation keeps running with the best-effort solution
  noteConvFail(m, t) {
    const cv = this.conv || (this.conv = { n: 0, at: 0, toastAt: -1e9, comps: [] });
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    cv.n++; cv.t = t; cv.at = now;
    let nodes = [];
    if (m.worst >= 0 && m.worst < m.N) nodes = [m.worst + 1];
    else if (m.worst >= m.N) { const p = m.vs.find(q => q.k === m.worst); if (p) nodes = [p.a, p.b].filter(x => x > 0); }
    const passive = new Set(['resistor', 'ground', 'ammeter', 'voltmeter', 'multimeter', 'scope', 'breadboard', 'capacitor', 'switch']);
    const at = this.comps.filter(c => (c._nodes || []).some(n => nodes.includes(n)));
    const act = at.filter(c => !passive.has(c.type));
    cv.comps = (act.length ? act : at).slice(0, 4);
    if (now - cv.toastAt > 8000) {
      cv.toastAt = now;
      const des = this.designators(), names = cv.comps.map(c => des.get(c) || DEFS[c.type].name).join(_t('app.x445'));
      const tried = [SIMOPT.autoStep && _t('app.smaller_time_steps'), SIMOPT.homotopy && _t('app.gmin_source_stepping')].filter(Boolean).join(_t('app.x445'));
      this.toast('⚠ t = ' + t.toFixed(4) + _t('app.s_convergence_difficulty') + (tried ? _t('app.tried') + tried + _t('app.x450') : '') + _t('app.continuing_with_an_approximate_solut') + (names ? _t('app.parts') + names + _t('app.are_outlined_in_red') : '') + _t('app.you_can_adjust_this_under_advanced_s'));
    }
  },
  advance(seconds) { const n = Math.round(seconds / this.dt); for (let i = 0; i < n; i++) this.simStep(); this.computeWireCurrents(); },
  run() { this.running = true; this.updateRunBtn(); },
  pause() { this.running = false; if (typeof AUD !== 'undefined') AUD.silence(); else if (typeof stopBuzzers === 'function') stopBuzzers(); this.updateRunBtn(); },
  toggleRun() { this.running ? this.pause() : this.run(); },

  // ---------- Kirchhoff analysis table ----------
  analysis() {
    const m = this.net; if (!m) return null;
    const des = this.designators(), nodes = new Map();
    const node = (n) => { if (!nodes.has(n)) nodes.set(n, { n, V: m.v(n), members: [], kcl: 0 }); return nodes.get(n); };
    node(0);
    for (const c of this.comps) {
      const d = DEFS[c.type];
      (c._nodes || []).forEach((n, i) => node(n).members.push(des.get(c) + '.' + (d.termNames ? d.termNames[i].split(' ')[0] : (i + 1))));
    }
    for (const p of m.prims) {
      if (p.n) { p.n.forEach((n, k) => { if (p.cur) node(n).kcl -= p.cur[k]; }); continue; }
      node(p.a).kcl -= p.i; node(p.b).kcl += p.i;
    }
    const list = [...nodes.values()].filter(x => x.members.length).sort((a, b) => a.n - b.n);
    const comps = this.comps.filter(c => !DEFS[c.type].board && c.type !== 'ground').map(c => ({ c, name: des.get(c), def: DEFS[c.type], V: c._m.V, I: c._m.I, P: c._m.P }));
    return { nodes: list, comps };
  },

  // ---------- rendering ----------
  resize() {
    const cv = this.cv, r = cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    this.dpr = dpr; this.W = r.width; this.H = r.height;
  },
  fitView() {
    if (!this.W) this.resize();
    if (!this.comps.length && !this.wires.length) { this.view = { s: 1, ox: this.W / 2 - 400, oy: this.H / 2 - 300 }; return; }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const c of this.comps) { const b = this.worldBox(c); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
    for (const w of this.wires) for (const p of w.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const pad = 60, s = U.clamp(Math.min((this.W - 2 * pad) / (x1 - x0 || 1), (this.H - 2 * pad) / (y1 - y0 || 1)), 0.3, 1.6);
    this.view = { s, ox: this.W / 2 - s * (x0 + x1) / 2, oy: this.H / 2 - s * (y0 + y1) / 2 };
  },
  zoomAt(sx, sy, f) {
    const v = this.view, ns = U.clamp(v.s * f, 0.2, 4);
    v.ox = sx - (sx - v.ox) * ns / v.s; v.oy = sy - (sy - v.oy) * ns / v.s; v.s = ns;
  },
  drawComp(ctx, c, env) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot * Math.PI / 2); DEFS[c.type].draw(ctx, c, env); ctx.restore(); },
  render() {
    const ctx = this.ctx, v = this.view;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#eef2f6'; ctx.fillRect(0, 0, this.W, this.H);
    const step = GRID * v.s;
    if (step > 6) {
      const x0 = ((v.ox % step) + step) % step, y0 = ((v.oy % step) + step) % step;
      ctx.fillStyle = '#c4ccd6';
      for (let x = x0; x < this.W; x += step) for (let y = y0; y < this.H; y += step) ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
      const big = step * 5, bx = ((v.ox % big) + big) % big, by = ((v.oy % big) + big) % big;
      ctx.strokeStyle = 'rgba(150,165,185,0.18)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = bx; x < this.W; x += big) { ctx.moveTo(x, 0); ctx.lineTo(x, this.H); }
      for (let y = by; y < this.H; y += big) { ctx.moveTo(0, y); ctx.lineTo(this.W, y); }
      ctx.stroke();
    }
    ctx.setTransform(this.dpr * v.s, 0, 0, this.dpr * v.s, this.dpr * v.ox, this.dpr * v.oy);
    const cnt = new Map();
    const inc = (x, y) => { const k = pkey(x, y); cnt.set(k, (cnt.get(k) || 0) + 1); };
    for (const c of this.comps) DEFS[c.type].terms.forEach((_, i) => inc(...this.termPos(c, i)));
    for (const w of this.wires) { inc(...w.pts[0]); inc(...w.pts[w.pts.length - 1]); }
    const env = { running: this.running, hasRun: this.hasRun, t: this.t, hoverStrip: this.hoverStrip };
    for (const c of this.comps) if (DEFS[c.type].board) this.drawComp(ctx, c, env);
    if (this.showCurrent && this.hasRun && this.edges) for (const e of this.edges) if (e.strip && Math.abs(e.i) > 1e-6) {
      const a = this.P[e.a], b = this.P[e.b];
      this.drawDotsOn(ctx, [a, b], e.phase || 0, 0.7);
    }
    const selW = this.sel && this.sel.wire;
    for (const w of this.wires) this.drawWire(ctx, w, w === selW);
    for (const c of this.comps) if (!DEFS[c.type].board) this.drawComp(ctx, c, env);
    if (this.showCurrent && this.hasRun) for (const w of this.wires) if (Math.abs(w._i) > 1e-6) this.drawDotsOn(ctx, this.wirePts(w), w._phase, 1, w.color);
    for (const c of this.comps) DEFS[c.type].terms.forEach((_, i) => {
      const [x, y] = this.termPos(c, i), n = cnt.get(pkey(x, y)) || 0;
      ctx.fillStyle = '#6e5212'; ctx.beginPath(); ctx.arc(x, y, 4.6, 0, 7); ctx.fill();
      ctx.fillStyle = n > 1 ? '#d9b44a' : '#fff4cf'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill();
      if (n > 1) { ctx.fillStyle = '#6e5212'; ctx.beginPath(); ctx.arc(x, y, 1.3, 0, 7); ctx.fill(); }
    });
    const onHole = (x, y) => this.comps.some(c => DEFS[c.type].board && bbHoles(c).some(h => h.x === x && h.y === y));
    for (const w of this.wires) for (const [x, y] of [w.pts[0], w.pts[w.pts.length - 1]]) {
      const n = cnt.get(pkey(x, y)) || 0;
      if (n === 1 && !onHole(x, y)) { ctx.strokeStyle = '#e03131'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.stroke(); }
      else if (n > 2) { ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(x, y, 4.4, 0, 7); ctx.fill(); }
      else if (n === 1) { ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
    }
    // wire running over a terminal / wire end without connecting: orange dashed marker
    if (this.passOvers && this.passOvers.length) {
      ctx.save(); ctx.strokeStyle = '#ff7a00'; ctx.lineWidth = 2; ctx.setLineDash([3, 2.5]);
      for (const p of this.passOvers) { ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, 7); ctx.stroke(); }
      ctx.restore();
    }
    ctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const c of this.comps) {
      const txt = DEFS[c.type].label(c); if (!txt) continue;
      const b = this.worldBox(c);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(238,242,246,0.9)'; ctx.strokeText(txt, (b[0] + b[2]) / 2, b[3] + 5);
      ctx.fillStyle = '#3d4a5c'; ctx.fillText(txt, (b[0] + b[2]) / 2, b[3] + 5);
    }
    if (this.showNodes && this.net && this.P) this.drawNodeTags(ctx);
    const cv = this.conv, now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (cv && cv.comps.length && now - cv.at < 6000) {   // components around a non-converged step
      ctx.save(); ctx.strokeStyle = '#e03131'; ctx.lineWidth = 2 / v.s; ctx.setLineDash([6 / v.s, 3 / v.s]);
      for (const c of cv.comps) {
        if (!this.comps.includes(c)) continue;
        const b = this.worldBox(c); D.rrect(ctx, b[0] - 9, b[1] - 9, b[2] - b[0] + 18, b[3] - b[1] + 18, 7); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = '#e03131'; ctx.beginPath(); ctx.arc(b[2] + 9, b[1] - 9, 8, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', b[2] + 9, b[1] - 8.5);
        ctx.setLineDash([6 / v.s, 3 / v.s]);
      }
      ctx.restore();
    }
    if (this.sel && this.sel.multi) this.drawMultiSel(ctx, this.sel.comps, this.sel.wires, false);
    if (this.drag && this.drag.kind === 'box' && this.drag.pick) this.drawMultiSel(ctx, this.drag.pick.comps, this.drag.pick.wires, true);
    if (this.sel && this.sel.comp) {
      const b = this.worldBox(this.sel.comp);
      ctx.strokeStyle = '#1e88e5'; ctx.lineWidth = 1.5 / v.s; ctx.setLineDash([5 / v.s, 4 / v.s]);
      D.rrect(ctx, b[0] - 6, b[1] - 6, b[2] - b[0] + 12, b[3] - b[1] + 12, 6); ctx.stroke(); ctx.setLineDash([]);
    }
    if (selW) selW.pts.forEach((p, i) => {
      const endp = i === 0 || i === selW.pts.length - 1;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1e88e5'; ctx.lineWidth = 2; ctx.beginPath();
      if (endp) ctx.arc(p[0], p[1], 6, 0, 7); else ctx.rect(p[0] - 4.5, p[1] - 4.5, 9, 9);
      ctx.fill(); ctx.stroke();
    });
    if (this.hoverPt) { ctx.strokeStyle = 'rgba(40,180,80,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(this.hoverPt.x, this.hoverPt.y, 8, 0, 7); ctx.stroke(); }
    if (this.ghost && this.ghost.over) {
      const g = { type: this.ghost.type, x: snap(this.ghost.x), y: snap(this.ghost.y), rot: 0, props: defaultProps(this.ghost.type), state: {}, _m: {} };
      ctx.save(); ctx.globalAlpha = 0.55; ctx.translate(g.x, g.y); DEFS[g.type].draw(ctx, g, env); ctx.restore();
    }
    if (this.drag && this.drag.kind === 'box') this.drawBox(ctx, this.drag);
  },
  drawNodeTags(ctx) {
    const seen = new Set(), m = this.net;
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    this.P.forEach((p, i) => {
      const n = this.pointNode[i]; if (seen.has(n)) return; seen.add(n);
      const vv = m.v(n), txt = (n === 0 ? 'GND' : 'N' + n) + ' ' + U.fmt(Math.abs(vv) < 1e-6 ? 0 : vv, 'V', 3);
      const w = ctx.measureText(txt).width + 6;
      ctx.fillStyle = 'rgba(30,95,184,0.9)'; D.rrect(ctx, p[0] + 6, p[1] - 16, w, 12, 3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(txt, p[0] + 9, p[1] - 10);
    });
  },
  drawWire(ctx, w, selected) {
    const p = this.wirePts(w);
    const path = () => { ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (selected) { path(); ctx.strokeStyle = 'rgba(30,136,229,0.45)'; ctx.lineWidth = 12; ctx.stroke(); }
    ctx.save(); ctx.translate(1.2, 2); path(); ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 6; ctx.stroke(); ctx.restore();
    const light = typeof hexLum === 'function' && hexLum(w.color) > 0.55;
    path(); ctx.strokeStyle = U.shade(w.color, light ? -0.62 : -0.45); ctx.lineWidth = light ? 6.6 : 6; ctx.stroke();
    path(); ctx.strokeStyle = w.color; ctx.lineWidth = 4.2; ctx.stroke();
    ctx.save(); ctx.translate(-0.6, -0.9); path(); ctx.strokeStyle = 'rgba(255,255,255,0.38)'; ctx.lineWidth = 1.3; ctx.stroke(); ctx.restore();
  },
  drawDotsOn(ctx, p, phase, alpha, color) {
    const SP = 16, lens = []; let L = 0;
    for (let i = 0; i < p.length - 1; i++) { const l = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); lens.push(l); L += l; }
    const ph = ((phase % SP) + SP) % SP;
    // yellow dots with a dark rim; on light / yellow wires (v10.1 colours) dark-blue dots with a white rim instead
    const light = color && typeof hexLum === 'function' && hexLum(color) > 0.45;
    ctx.globalAlpha = alpha; ctx.fillStyle = light ? '#14304f' : '#ffe14a'; ctx.strokeStyle = light ? 'rgba(255,255,255,0.95)' : 'rgba(90,60,0,0.8)'; ctx.lineWidth = light ? 1.1 : 0.8;
    for (let s = ph; s < L; s += SP) {
      let d = s, i = 0; while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
      const f = lens[i] ? d / lens[i] : 0, x = p[i][0] + (p[i + 1][0] - p[i][0]) * f, y = p[i][1] + (p[i + 1][1] - p[i][1]) * f;
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
  dotSpeed(I) { const a = Math.abs(I); if (a < 1e-6) return 0; return Math.sign(I) * Math.min(160, 38 * Math.log10(1 + a / 1e-3)) * (this.electron ? -1 : 1); },

  // ---------- loop ----------
  frame(ts) {
    const dtF = Math.min(0.05, ((ts - (this.lastTs || ts)) / 1000) || 0.016);
    this.lastTs = ts;
    if (this.running) {
      const t0 = performance.now();
      let steps = Math.max(1, Math.round(this.speed * dtF / this.dt));
      steps = Math.min(steps, 5000);
      for (let i = 0; i < steps; i++) { this.simStep(); if (performance.now() - t0 > 28) { this.lagging = true; break; } }
      this.computeWireCurrents();
      if (this.showCurrent) {
        for (const w of this.wires) w._phase += this.dotSpeed(w._i) * dtF;
        if (this.edges) for (const e of this.edges) if (e.strip) e.phase = (e.phase || 0) + this.dotSpeed(e.i) * dtF;
      }
    }
    this.render();
    if (!this._uiT || ts - this._uiT > 120) { this._uiT = ts; this.updateHud(); this.updateReadings(); this.updateTooltip(); this.updateAnalysis && this.updateAnalysis(); if (typeof MCU !== 'undefined') MCU.tick(); }
    requestAnimationFrame((t) => this.frame(t));
  },
  updateHud() {
    const running = this.running ? _t('app.running') : (this.hasRun ? _t('app.paused') : _t('app.stopped_press_to_run'));
    const cv = this.conv, now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const cw = cv && cv.n && now - cv.at < 6000 ? _t('app.convergence_difficulty') + cv.n + _t('app.handled_automatically_continuing_wit') : '';
    const w = this.warn && this.warn !== _t('app.convergence_difficulty_continuing_wi') ? this.warn : cw;
    $('#hud').innerHTML = running + ' &nbsp; t = ' + this.t.toFixed(3) + ' s' + (w ? _t('app.x460') + w + '</span>' : '') + (this.wireMode ? _t('app.wire_mode') : '') + (this.selectMode ? ' &nbsp;<span class="wm"><span class="ic-sel"></span> ' + _t('sel.mode_hud') + '</span>' : '');
    $('#status-stats').textContent = _t('app.parts_462') + this.comps.length + _t('app.wires') + this.wires.length + _t('app.nodes') + (this.nodeCount || 0) + _t('app.zoom') + Math.round(this.view.s * 100) + '%';
  },
  updateTooltip() {
    const tt = $('#tooltip'), h = this.hover;
    const meterHover = h && h.comp && typeof METER_TYPES !== 'undefined' && METER_TYPES.has(h.comp.type);
    if (!h || (!this.hasRun && !meterHover) || this.drag) { tt.style.display = 'none'; return; }
    let html;
    const z = (v, e) => (Math.abs(v) < e ? 0 : v);
    if (h.comp) {
      const c = h.comp, d = DEFS[c.type], m = c._m || {};
      if (d.board) { tt.style.display = 'none'; return; }
      if (d.readings) html = '<b>' + (this.designators().get(c) || '') + ' ' + d.name + '</b> ' + (I18N.isZh() ? d.en : '') + d.readings(c).map(r => '<br>' + r[0] + ' = ' + r[1]).join('');
      else html = '<b>' + (this.designators().get(c) || '') + ' ' + d.name + '</b> ' + (I18N.isZh() ? d.en : '') + _t('app.voltage_u') + U.fmt(z(m.V, 1e-6), 'V') + _t('app.current_i') + U.fmt(z(m.I, 1e-8), 'A') + _t('app.power_p') + U.fmt(z(m.P, 1e-9), 'W');
    } else if (h.wire) html = _t('app.wire_current_i') + U.fmt(z(h.wire._i, 1e-8), 'A') + _t('app.node_voltage') + U.fmt(this.net && h.wire._nodes ? this.net.v(h.wire._nodes[0]) : 0, 'V');
    else { tt.style.display = 'none'; return; }
    tt.innerHTML = html; tt.style.display = 'block';
    tt.style.left = (this.mouse[0] + 16) + 'px'; tt.style.top = (this.mouse[1] + 16) + 'px';
  },
  toast(msg) {
    const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('show');
    clearTimeout(this._toastT); this._toastT = setTimeout(() => t.classList.remove('show'), 2600);
  },
  updateRunBtn() {
    const b = $('#btn-run'); if (!b) return;
    b.innerHTML = this.running ? _t('app.pause') : _t('app.run');
    b.classList.toggle('active', this.running);
  },
};
window.app = app;
