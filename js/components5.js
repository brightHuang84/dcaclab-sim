'use strict';
// ===== v6: common everyday parts =====
// regulators (78xx / LM317 / LM2596 buck), batteries (AA holder, CR2032, 18650), solar panel, bench PSU (CV/CC),
// electrolytic & ceramic capacitors, diode / BJT / MOSFET / op-amp part-number presets, Schottky & rectifier diodes,
// bridge rectifier, RGB & bi-colour LEDs, TIP120 Darlington, PC817 optocoupler, SCR & TRIAC (latching),
// tactile button, SPDT slide / DPDT toggle / rotary / DIP switches, 7-segment digit, LED bar graph, servo, fan,
// vibration motor.
const ledIs = (vf) => 0.02 / Math.exp(vf / (2 * VT));      // same LED law as the LED part (Vf at 20 mA, n = 2)
const sub = (st, k) => (st[k] || (st[k] = {}));           // per-junction NR state kept as plain objects (static-solve clone safe)
const txt = (ctx, s, x, y, font, col, align) => { ctx.fillStyle = col || '#eee'; ctx.font = font || 'bold 7px sans-serif'; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); };
const stampPair = (G, J, m, i, j, g, I, v) => { G[i * m + i] += g; G[i * m + j] -= g; G[j * m + i] -= g; G[j * m + j] += g; const Jv = I - g * v; J[i] += Jv; J[j] -= Jv; };
// smooth current limiter shared by the regulator / PSU models: I = IL·f(x), f(x) = x/(1+|x|^8)^(1/8)
function softLimit(Iraw, IL) { const x = Iraw / IL, a8 = Math.pow(Math.abs(x), 8), q = Math.pow(1 + a8, -1 / 8); return { I: IL * x * q, d: q / (1 + a8), x }; }

// ---------------- linear regulator (78xx / LM317): nodes [in, out, ref]; ref = GND (78xx) or ADJ (LM317) ----------------
//   b = V(out) − V(ref) → smooth-min(Vref, a − Vdo)   (a = V(in) − V(ref));  Iin = Iout + Iq,  I(ref) = −Iq
function linregEval(p, a, b) {
  const st = p.st, en = st.hot ? 0 : 1, w = 0.02;
  const u = (p.Vref - (a - p.Vdo)) / w;
  let Vt = p.Vref - w * _softplus(u), dVt = _sig(u);
  const u2 = Vt / w; dVt *= _sig(u2); Vt = w * _softplus(u2);                 // target ≥ 0
  const g = 1 / p.Ro, Iraw = en * g * (Vt - b);
  const L = softLimit(Iraw, Iraw >= 0 ? p.Ilim : p.Ilim * 1e-3);              // cannot sink (pass transistor)
  // pass-transistor headroom: no output current once V(out) approaches V(in) (h = a − b)
  const hs = _sig((a - b - 0.25) / 0.05), dhs = hs * (1 - hs) / 0.05;
  const dIo_a = hs * L.d * en * g * dVt + L.I * dhs, dIo_b = -hs * L.d * en * g - L.I * dhs;
  L.I *= hs;
  const qa = Math.max(a, 0), eq = Math.exp(-qa / 0.5), Iq = p.Iq * (1 - eq), dIq = a > 0 ? p.Iq * eq / 0.5 : 0;
  return { Iout: L.I, dIo_a, dIo_b, Iq, dIq, Vt, x: L.x, drop: a - p.Vdo < p.Vref + 0.01, en };
}
NLMODELS.linreg = function (p, V) {
  const st = p.st, ra = V[0] - V[2], rb = V[1] - V[2];
  const a0 = st.a === undefined ? ra : st.a, b0 = st.b === undefined ? 0 : st.b;
  const a = clampStep(ra, a0, 1);   // small steps on Vin−Vref: the dropout corner (Vt = a − Vdo) otherwise makes Newton 2-cycle
  let b = clampStep(rb, b0, 3);
  { const E0 = linregEval(p, a, b0); b = crossClamp(b, b0, E0.Vt, p.Ilim * p.Ro); }
  st.a = a; st.b = b;
  const E = linregEval(p, a, b), G = p.G, J = p.J, GO = 1e-9;
  // in current limit (source or sink) the true slope is ~0 → Newton would overshoot by I·R_load; use the secant slope
  // through the regulation point, |I| / |Vt − b| (≤ 1/Ro, equals the true slope when not limiting)
  const dIb = Math.min(E.dIo_b, -Math.abs(E.Iout) / Math.max(Math.abs(E.Vt - b), 1e-9));
  const r0 = [E.dIo_a + E.dIq, dIb], r1 = [-E.dIo_a, -dIb + GO];
  const I0 = E.Iout + E.Iq, I1 = -E.Iout + GO * b;
  G[0] = r0[0]; G[1] = r0[1]; G[2] = -(r0[0] + r0[1]);
  G[3] = r1[0]; G[4] = r1[1]; G[5] = -(r1[0] + r1[1]);
  G[6] = -(G[0] + G[3]); G[7] = -(G[1] + G[4]); G[8] = -(G[2] + G[5]);
  J[0] = I0 - (r0[0] * a + r0[1] * b); J[1] = I1 - (r1[0] * a + r1[1] * b); J[2] = -(J[0] + J[1]);
  return Math.abs(a - ra) > 1e-9 || Math.abs(b - rb) > 1e-9;
};

// ---------------- bench power supply CV/CC: nodes [+, −] ----------------
NLMODELS.psu = function (p, V) {
  const st = p.st, rb = V[0] - V[1], b0 = st.b === undefined ? 0 : st.b;
  let b = clampStep(rb, b0, 5); b = crossClamp(b, b0, p.Vset, p.Iset * p.Ro * 2); st.b = b;
  const g = 1 / p.Ro, Iraw = g * (p.Vset - b), L = softLimit(Iraw, Iraw >= 0 ? p.Iset : p.Iset * 0.02);
  const I = -L.I + 1e-9 * b, dI = Math.max(L.d * g, Math.abs(L.I) / Math.max(Math.abs(p.Vset - b), 1e-9)) + 1e-9;      // current INTO the + terminal (secant slope when limiting)
  const G = p.G, J = p.J; G[0] = dI; G[1] = -dI; G[2] = -dI; G[3] = dI; J[0] = I - dI * b; J[1] = -J[0];
  p.x = L.x;
  return Math.abs(b - rb) > 1e-9;
};

// phototransistor output shape: tanh(v/Vs) forward, 2 % gain when reversed (Newton steps on vce are damped, see below)
function optoSat(v, Vs) { const k = v >= 0 ? 1 : 0.02, t = Math.tanh(v / Vs); return [k * t, k * (1 - t * t) / Vs]; }
// ---------------- optocoupler: nodes [A, K, C, E]; IR LED + phototransistor Ic = CTR·If·tanh(Vce/Vs) ----------------
NLMODELS.opto = function (p, V) {
  const st = p.st, G = p.G, J = p.J; G.fill(0); J.fill(0);
  const vr = V[0] - V[1], vd = pnjlim(vr, st.vd || 0, p.nVt, p.vcrit); st.vd = vd;
  const e = Math.exp(Math.min(vd / p.nVt, 700)), If = p.Is * (e - 1), gd = p.Is / p.nVt * e + GMIN;
  stampPair(G, J, 4, 0, 1, gd, If, vd);
  const vcer = V[2] - V[3], vce = st.vce === undefined ? U.clamp(vcer, -1, 1) : clampStep(vcer, st.vce, Math.max(p.Vs, 0.5 * Math.abs(st.vce))); st.vce = vce;
  const ifp = Math.max(If, 0), difp = If > 0 ? gd : 0;
  const [s, ds] = optoSat(vce, p.Vs);
  const Ic = p.ctr * ifp * s + p.gl * vce, dvd = p.ctr * difp * s, dvce = p.ctr * ifp * ds + p.gl;
  G[8] = dvd; G[9] = -dvd; G[10] = dvce; G[11] = -dvce; J[2] = Ic - (dvd * vd + dvce * vce);
  G[12] = -dvd; G[13] = dvd; G[14] = -dvce; G[15] = dvce; J[3] = -J[2];
  p.If = If; p.Ic = Ic;
  return Math.abs(vd - vr) > 1e-9 || Math.abs(vce - vcer) > 1e-9;
};

// ---------------- thyristor (SCR) / TRIAC: nodes [A (MT2), K (MT1), G]; latching state switched per accepted step ----------------
function thyrJ(p, v, Is, nVt) {   // junction current and conductance (bidirectional = sinh law)
  const e = Math.exp(Math.min(v / nVt, 700));
  if (!p.bidir) return [Is * (e - 1), Is / nVt * e + GMIN];
  const f = Math.exp(Math.min(-v / nVt, 700)); return [Is * (e - f), Is / nVt * (e + f) + GMIN];
}
function thyrLim(p, vnew, vold, nVt, vcrit) {
  if (!p.bidir || vnew >= 0) return pnjlim(vnew, vold, nVt, vcrit);
  return -pnjlim(-vnew, -vold, nVt, vcrit);
}
NLMODELS.thyr = function (p, V) {
  const st = p.st, G = p.G, J = p.J; G.fill(0); J.fill(0);
  const vgr = V[2] - V[1], vg = thyrLim(p, vgr, st.vg || 0, VT, p.vcritG); st.vg = vg;
  const [ig, gg] = thyrJ(p, vg, p.IsG, VT); stampPair(G, J, 3, 2, 1, gg, ig, vg);
  const var_ = V[0] - V[1]; let va = var_;
  if (st.on) { va = thyrLim(p, var_, st.va || 0, p.nVtM, p.vcritM); const [ia, ga] = thyrJ(p, va, p.IsM, p.nVtM); stampPair(G, J, 3, 0, 1, ga + p.gon, ia + p.gon * va, va); }
  else stampPair(G, J, 3, 0, 1, 1e-9, 1e-9 * va, va);
  st.va = va;
  return Math.abs(vg - vgr) > 1e-9 || Math.abs(va - var_) > 1e-9;
};
NLACCEPT.thyr = function (p, Vf) {
  const st = p.st, vg = Vf(p.n[2]) - Vf(p.n[1]), va = Vf(p.n[0]) - Vf(p.n[1]);
  const ig = thyrJ(p, vg, p.IsG, VT)[0];
  const ia = st.on ? thyrJ(p, va, p.IsM, p.nVtM)[0] + p.gon * va : 1e-9 * va;
  p.ig = ig; p.ia = ia;
  const gate = p.bidir ? Math.abs(ig) > p.Igt : ig > p.Igt;
  if (!st.on) {
    const trig = gate && (p.bidir ? Math.abs(va) > 0.3 : va > 0.3);
    if (trig) return () => { st.on = true; st.va = va; };
  } else if ((p.bidir ? Math.abs(ia) : ia) < p.Ih && !gate) return () => { st.on = false; };   // a driven gate keeps it conducting below I_H
};

// ---------------- part-number presets ----------------
const PRESETS = {
  diode: { '1N4148': { Is: 2.52e-9, nf: 1.752, Rs: 0.568 }, '1N4007': { Is: 7.03e-9, nf: 1.808, Rs: 0.034 }, '1N5819': { Is: 3.17e-5, nf: 1.373, Rs: 0.051 }, '1N5408': { Is: 1.4e-8, nf: 1.9, Rs: 0.012 } },
  npn: { '2N2222': { BF: 200, Is: 1.4e-14, VAF: 74 }, 'S8050': { BF: 160, Is: 2e-14, VAF: 100 }, 'BC547': { BF: 290, Is: 1.8e-14, VAF: 63 }, '2N3904': { BF: 300, Is: 6.7e-15, VAF: 74 } },
  pnp: { '2N2907': { BF: 200, Is: 6.5e-14, VAF: 115 }, 'S8550': { BF: 160, Is: 2e-14, VAF: 100 }, 'BC557': { BF: 250, Is: 1e-14, VAF: 80 }, '2N3906': { BF: 180, Is: 1.4e-14, VAF: 18.7 } },
  nmos: { '2N7000': { Vth: 2.1, K: 0.035 }, 'IRF540': { Vth: 3.0, K: 1.6 }, 'IRLZ44N': { Vth: 1.5, K: 6.5 }, 'AO3400': { Vth: 1.0, K: 8 } },
  pmos: { 'IRF9540': { Vth: 3.0, K: 1.0 }, 'AO3401': { Vth: 0.9, K: 5 } },
  opamp: { LM358: { vpos: 10.5, vneg: 0, A: 1e5, gbw: 1e6, slew: 0.3, imax: 0.03 }, TL072: { vpos: 13.5, vneg: -13.5, A: 2e5, gbw: 3e6, slew: 13, imax: 0.02 },
    NE5532: { vpos: 13, vneg: -13, A: 1e5, gbw: 10e6, slew: 9, imax: 0.038 }, LM741: { vpos: 13, vneg: -13, A: 2e5, gbw: 1e6, slew: 0.5, imax: 0.025 } },
};
function addPartPreset(type, def) {
  const d = DEFS[type]; if (!d || !PRESETS[type]) return;
  const opts = [['custom', _t('parts.custom')]].concat(Object.keys(PRESETS[type]).map(k => [k, k]));
  if (!d.props.some(p => p.k === 'part')) d.props.unshift({ k: 'part', label: _t('parts.part_no'), kind: 'select', opts, def: def || 'custom' });
  const oldOn = d.onProp;
  d.onProp = (c, k) => { if (oldOn) oldOn(c, k); if (k === 'part' && PRESETS[type][c.props.part]) { for (const [pk, v] of Object.entries(PRESETS[type][c.props.part])) if (d.props.some(p => p.k === pk)) c.props[pk] = v; } };
  const oldLabel = d.label;
  d.label = (c) => (c.props.part && c.props.part !== 'custom' ? c.props.part : (oldLabel ? oldLabel(c) : ''));
}
// diode gets a series resistance (for the rectifier presets)
if (!DEFS.diode.props.some(p => p.k === 'Rs')) DEFS.diode.props.push({ k: 'Rs', label: '串联电阻 Rs', unit: 'Ω', def: 0, min: 0 });
DEFS.diode.build = function (c, n, m) {
  const P = c.props;
  if (P.Rs > 0) { const x = m.newNode(); c._p = m.addD(n[0], x, P.Is, P.nf * VT, c.state); m.addR(x, n[1], 1 / P.Rs); }
  else c._p = m.addD(n[0], n[1], P.Is, P.nf * VT, c.state);
};
for (const t of ['diode', 'npn', 'pnp', 'nmos', 'pmos', 'opamp']) addPartPreset(t);

function drawAxial(ctx, c, body, band, label, glass) {
  D.lead(ctx, -40, 0, -16, 0); D.lead(ctx, 16, 0, 40, 0);
  ctx.fillStyle = glass ? D.vgrad(ctx, -6, 6, [[0, '#ffd7a8'], [0.5, '#e08a3a'], [1, '#a0521a']]) : D.vgrad(ctx, -7, 7, [[0, U.shade(body, 0.35)], [0.5, body], [1, U.shade(body, -0.4)]]);
  D.rrect(ctx, -16, glass ? -5 : -7, 32, glass ? 10 : 14, glass ? 4 : 3); ctx.fill();
  ctx.fillStyle = band; ctx.fillRect(8, glass ? -5 : -7, 4, glass ? 10 : 14);
  if (label) D.upright(ctx, c, 0, 14, (ctx) => txt(ctx, label, 0, 0, '6px sans-serif', '#555'));
}

// ---------------- chip / module drawing helpers ----------------
function drawDIP(ctx, c, pins, w, h, label, col) {   // pins: [[x,y,side]] leads from pin to body edge
  for (const [x, y] of pins) D.lead(ctx, x, y, x, Math.sign(y) * (h / 2));
  ctx.fillStyle = D.vgrad(ctx, -h / 2, h / 2, [[0, U.shade(col || '#2a2a2a', 0.25)], [1, col || '#111']]); D.rrect(ctx, -w / 2, -h / 2, w, h, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(-w / 2 + 6, h / 2 - 6, 2, 0, 7); ctx.fill();
  D.upright(ctx, c, 0, 0, (ctx) => txt(ctx, label, 0, 0, 'bold 7px sans-serif', col === '#f4f4f0' ? '#333' : '#e8e8e8'));
}
function drawCell(ctx, x, y, w, h, wrap, cap, label, c) {   // cylindrical cell lying horizontally, + at right
  ctx.fillStyle = D.vgrad(ctx, y - h / 2, y + h / 2, [[0, U.shade(wrap, 0.35)], [0.5, wrap], [1, U.shade(wrap, -0.45)]]); D.rrect(ctx, x - w / 2, y - h / 2, w, h, 4); ctx.fill();
  ctx.fillStyle = D.vgrad(ctx, y - h / 2, y + h / 2, [[0, '#f4f4f4'], [0.5, '#b8bcc2'], [1, '#7c828a']]);
  ctx.fillRect(x + w / 2 - 6, y - h / 2, 6, h); ctx.fillRect(x + w / 2, y - 4, 3, 8);
  if (cap) { ctx.fillStyle = cap; ctx.fillRect(x - w / 2 + 3, y - h / 2, 10, h); }
  if (!label) return;
  if (c.rot % 2) txt(ctx, label, x, y, 'bold 7px sans-serif', '#fff');   // rotated part: text runs along the cell
  else D.upright(ctx, c, x, y, (ctx) => txt(ctx, label, 0, 0, 'bold 7px sans-serif', '#fff'));
}
const LIPO_OCV = [[0, 3.0], [0.05, 3.3], [0.1, 3.45], [0.2, 3.6], [0.4, 3.72], [0.6, 3.82], [0.8, 3.97], [0.9, 4.06], [1, 4.2]];
function ocv18650(soc) { soc = U.clamp(soc, 0, 1); for (let i = 1; i < LIPO_OCV.length; i++) { const [s1, v1] = LIPO_OCV[i], [s0, v0] = LIPO_OCV[i - 1]; if (soc <= s1) return v0 + (v1 - v0) * (soc - s0) / (s1 - s0); } return 4.2; }
const REG_PARTS = { '7805': [5, 2.0], '7809': [9, 2.0], '7812': [12, 2.0], '7815': [15, 2.0], '7833': [3.3, 2.0], 'AMS1117-3.3': [3.3, 1.1], 'AMS1117-5.0': [5, 1.1] };
function regThermal(c, dt, app, Pd) {
  const st = c.state, Rth = c.props.heatsink ? 8 : 65;
  st.tj = st.tj === undefined ? 25 : st.tj; st.tj += (25 + Rth * Pd - st.tj) * Math.min(1, dt / (c.props.heatsink ? 20 : 5));
  if (!st.hot && st.tj > 150) { st.hot = true; app.toast('🔥 ' + DEFS[c.type].name + _t('parts.thermal_shutdown_tj_150_c_add_a_heat')); }
  else if (st.hot && st.tj < 120) st.hot = false;
}
function regReadings(c, title) {
  const M = c._m, st = c.state, z = (v, e) => (Math.abs(v || 0) < e ? 0 : v || 0);
  const status = st.hot ? _t('parts.thermal_shutdown') : M.x > 1.02 ? _t('parts.current_limit') : M.drop ? _t('parts.dropout_vin_too_low') : _t('parts.regulating');
  return [[_t('common.input_voltage_vin'), U.fmt(z(M.Vin, 1e-6), 'V')], [_t('common.output_voltage_vout'), U.fmt(z(M.Vout, 1e-6), 'V')], [_t('common.output_current_iout'), U.fmt(z(M.Iout, 1e-7), 'A')],
    [_t('common.input_current_iin'), U.fmt(z(M.Iin, 1e-7), 'A')], [_t('parts.power_dissipation_pd'), U.fmt(z(M.P, 1e-7), 'W')], [_t('parts.junction_temp_tj'), (st.tj === undefined ? 25 : st.tj).toFixed(0) + ' °C' + (c.props.heatsink ? _t('parts.heatsink') : _t('parts.no_heatsink'))], [_t('common.state'), status]].concat(title ? [[_t('common.note'), title]] : []);
}
function regMeasure(c, m, iIn, iOut, iRef) {   // node indices of IN, OUT, REF (GND / ADJ)
  const n = c._nodes, p = c._q, M = c._m;
  const a = m.v(n[iIn]) - m.v(n[iRef]), b = m.v(n[iOut]) - m.v(n[iRef]), E = linregEval(p, a, b);
  const g = c.type === 'lm317' ? 0 : m.v(n[iRef]);      // 78xx: relative to its GND pin; LM317 (no GND pin): relative to circuit ground
  M.Vin = m.v(n[iIn]) - g; M.Vout = m.v(n[iOut]) - g;
  M.Iout = E.Iout; M.Iin = E.Iout + E.Iq; M.x = E.x; M.drop = E.drop;
  M.P = Math.max(0, (a - b) * E.Iout + a * E.Iq); M.V = b; M.I = E.Iout;
}

Object.assign(DEFS, {
  // ======================= power =======================
  reg78xx: {
    name: '三端稳压器 78xx', en: 'Linear Regulator', cat: 'module', desig: 'U',
    terms: [[-20, 20], [0, 20], [20, 20]], termNames: ['IN 输入', 'GND 地', 'OUT 输出'], box: [-20, -36, 20, 20],
    props: [{ k: 'part', label: '型号 Part No.', kind: 'select', opts: Object.keys(REG_PARTS).map(k => [k, k + ' (' + REG_PARTS[k][0] + ' V)']), def: '7805' },
      { k: 'Imax', label: '限流 Current limit', unit: 'A', def: 1.5, min: 0.01 }, { k: 'heatsink', label: '安装散热片', kind: 'bool', def: false }],
    label: (c) => (c.props.part || '7805').replace(/^78/, 'LM78'),
    build(c, n, m) {
      const [Vref, Vdo] = REG_PARTS[c.props.part] || REG_PARTS['7805'];
      c._q = m.addNL('linreg', [n[0], n[2], n[1]], { Vref, Vdo, Ro: 0.005, Ilim: Math.max(c.props.Imax, 0.01), Iq: 0.005 }, c.state); c._p = null;
    },
    measure(c, m) { regMeasure(c, m, 0, 2, 1); },
    post(c, dt, app) { regThermal(c, dt, app, c._m.P || 0); },
    readings(c) { return regReadings(c, 'IN ≥ Vout + ' + (REG_PARTS[c.props.part] || [0, 2])[1] + _t('reg78xx.v_to_regulate')); },
    draw(ctx, c) { drawTO220(ctx, c, (c.props.part || '7805').replace(/^78/, 'L78'), 'I G O', c.state.hot ? '#6a2a1a' : '#1f1f1f'); if (c.props.heatsink) { ctx.fillStyle = 'rgba(160,170,180,0.9)'; for (let i = 0; i < 5; i++) ctx.fillRect(-18 + i * 8, -52, 4, 16); } },
  },
  lm317: {
    name: '可调稳压器 LM317', en: 'LM317 Adjustable Regulator', cat: 'module', desig: 'U',
    terms: [[-20, 20], [0, 20], [20, 20]], termNames: ['ADJ 调整', 'OUT 输出', 'IN 输入'], box: [-20, -36, 20, 20],
    props: [{ k: 'Imax', label: '限流 Current limit', unit: 'A', def: 1.5, min: 0.01 }, { k: 'heatsink', label: '安装散热片', kind: 'bool', def: false }],
    label: () => 'LM317',
    build(c, n, m) { c._q = m.addNL('linreg', [n[2], n[1], n[0]], { Vref: 1.25, Vdo: 1.7, Ro: 0.005, Ilim: Math.max(c.props.Imax, 0.01), Iq: 50e-6 }, c.state); c._p = null; },
    measure(c, m) { regMeasure(c, m, 2, 1, 0); },
    post(c, dt, app) { regThermal(c, dt, app, c._m.P || 0); },
    readings(c) { const r = regReadings(c, 'Vout = 1.25 V·(1 + R2/R1) + 50 µA·R2'); r.splice(2, 0, ['OUT − ADJ', U.fmt(c._m.V || 0, 'V')]); return r; },
    draw(ctx, c) { drawTO220(ctx, c, 'LM317', 'A O I', c.state.hot ? '#6a2a1a' : '#1f1f1f'); if (c.props.heatsink) { ctx.fillStyle = 'rgba(160,170,180,0.9)'; for (let i = 0; i < 5; i++) ctx.fillRect(-18 + i * 8, -52, 4, 16); } },
  },
  aaholder: {
    name: 'AA 电池盒', en: 'AA Battery Holder', cat: 'source', desig: 'BT', terms: [[-80, 0], [80, 0]], termNames: ['− 黑线', '+ 红线'], box: [-80, -34, 80, 34],
    props: [{ k: 'n', label: '节数', kind: 'select', num: true, opts: [[1, '1 × AA'], [2, '2 × AA'], [3, '3 × AA'], [4, '4 × AA']], def: 2 },
      { k: 'chem', label: '电池类型', kind: 'select', opts: [['alk', '碱性 1.5 V'], ['nimh', '镍氢 1.2 V'], ['weak', '旧电池 1.3 V (高内阻)']], def: 'alk' }],
    cell(c) { return { alk: [1.5, 0.15], nimh: [1.2, 0.05], weak: [1.3, 1.0] }[c.props.chem] || [1.5, 0.15]; },
    label: (c) => (+c.props.n) + '×AA ' + U.fmtShort((+c.props.n) * DEFS.aaholder.cell(c)[0], 'V'),
    build(c, n, m) { const [v, r] = DEFS.aaholder.cell(c), N = +c.props.n || 1; c._p = m.addV(n[1], n[0], () => N * v, N * r); },
    measure(c, m) { c._m.I = -c._p.i; c._m.V = m.v(c._nodes[1]) - m.v(c._nodes[0]); c._m.P = c._m.V * c._m.I; },
    readings(c) { const [v, r] = DEFS.aaholder.cell(c), N = +c.props.n || 1; return [[_t('aaholder.emf'), U.fmt(N * v, 'V')], [_t('common.internal_resistance'), U.fmt(N * r, 'Ω')], [_t('common.terminal_voltage'), U.fmt(c._m.V || 0, 'V')], [_t('common.output_current'), U.fmt(c._m.I || 0, 'A')]]; },
    draw(ctx, c) {
      D.lead(ctx, -80, 0, -70, 0); D.lead(ctx, 70, 0, 80, 0);
      ctx.fillStyle = D.vgrad(ctx, -32, 32, [[0, '#3a3a3a'], [1, '#111']]); D.rrect(ctx, -70, -32, 140, 64, 5); ctx.fill();
      const N = +c.props.n || 1, h = Math.min(26, 56 / N);
      for (let i = 0; i < N; i++) drawCell(ctx, 0, -28 + h / 2 + 2 + i * ((56 - h) / Math.max(1, N - 1) || 0), 100, h - 3, c.props.chem === 'nimh' ? '#2a7a3a' : '#c8912a', '#222', 'AA ' + (c.props.chem === 'nimh' ? '1.2V' : '1.5V'), c);
      ctx.strokeStyle = '#d62828'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(62, 0); ctx.lineTo(70, 0); ctx.stroke();
      D.upright(ctx, c, 0, 0, () => {});
    },
  },
  coincell: {
    name: '纽扣电池 CR2032', en: 'Coin Cell CR2032', cat: 'source', desig: 'BT', terms: [[-40, 0], [40, 0]], termNames: ['−', '+'], box: [-40, -26, 40, 26],
    props: [{ k: 'type', label: '型号', kind: 'select', opts: [['CR2032', 'CR2032 3 V 220 mAh'], ['CR2025', 'CR2025 3 V 160 mAh'], ['CR1220', 'CR1220 3 V 40 mAh'], ['LR44', 'LR44 1.5 V']], def: 'CR2032' },
      { k: 'r', label: '内阻', unit: 'Ω', def: 15, min: 0.01 }],
    label: (c) => c.props.type,
    emf(c) { return c.props.type === 'LR44' ? 1.5 : 3.0; },
    build(c, n, m) { c._p = m.addV(n[1], n[0], () => DEFS.coincell.emf(c), c.props.r); },
    measure(c, m) { c._m.I = -c._p.i; c._m.V = m.v(c._nodes[1]) - m.v(c._nodes[0]); c._m.P = c._m.V * c._m.I; },
    readings(c) { return [[_t('coincell.emf'), U.fmt(DEFS.coincell.emf(c), 'V')], [_t('common.internal_resistance'), U.fmt(c.props.r, 'Ω')], [_t('common.terminal_voltage'), U.fmt(c._m.V || 0, 'V')], [_t('common.current'), U.fmt(c._m.I || 0, 'A')]]; },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -24, 0); D.lead(ctx, 24, 0, 40, 0);
      const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, 24); g.addColorStop(0, '#fafafa'); g.addColorStop(0.6, '#b9bec5'); g.addColorStop(1, '#7a8088');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.fill(); ctx.strokeStyle = '#6a7078'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.stroke();
      D.upright(ctx, c, 0, 0, (ctx) => { txt(ctx, '+', 0, -11, 'bold 9px sans-serif', '#333'); txt(ctx, c.props.type, 0, 2, 'bold 7px sans-serif', '#333'); txt(ctx, DEFS.coincell.emf(c) + 'V', 0, 11, '6px sans-serif', '#444'); });
    },
  },
  li18650: {
    name: '18650 锂电池', en: '18650 Li-ion Cell', cat: 'source', desig: 'BT', terms: [[-60, 0], [60, 0]], termNames: ['−', '+'], box: [-60, -18, 60, 18],
    props: [{ k: 'pos', label: '电量 SOC', kind: 'range', def: 0.8 }, { k: 'cap', label: '容量', unit: 'mAh', def: 2600, min: 1 }, { k: 'r', label: '内阻', unit: 'Ω', def: 0.05, min: 0.001 }],
    wheel: true,
    soc(c) { return U.clamp(c.props.pos - (c.state.q || 0) / (c.props.cap * 3.6), 0, 1); },
    label: (c) => U.fmtShort(ocv18650(DEFS.li18650.soc(c)), 'V') + ' ' + Math.round(DEFS.li18650.soc(c) * 100) + '%',
    build(c, n, m) { c._p = m.addV(n[1], n[0], () => ocv18650(DEFS.li18650.soc(c)), c.props.r); },
    measure(c, m) { c._m.I = -c._p.i; c._m.V = m.v(c._nodes[1]) - m.v(c._nodes[0]); c._m.P = c._m.V * c._m.I; },
    post(c, dt) { c.state.q = (c.state.q || 0) + c._m.I * dt; },
    readings(c) { const s = DEFS.li18650.soc(c); return [[_t('li18650.state_of_charge_soc'), (s * 100).toFixed(1) + ' %'], [_t('li18650.open_circuit_voltage_ocv'), U.fmt(ocv18650(s), 'V')], [_t('common.terminal_voltage'), U.fmt(c._m.V || 0, 'V')], [_t('common.current'), U.fmt(c._m.I || 0, 'A')], [_t('common.internal_resistance'), U.fmt(c.props.r, 'Ω')], [_t('li18650.discharged'), U.fmt((c.state.q || 0) / 3.6, 'mAh')]]; },
    draw(ctx, c) {
      D.lead(ctx, -60, 0, -50, 0); D.lead(ctx, 50, 0, 60, 0);
      drawCell(ctx, 0, 0, 100, 32, '#2f6fb0', null, '18650  3.7V  ' + c.props.cap + 'mAh', c);
      const s = DEFS.li18650.soc(c); ctx.fillStyle = s > 0.2 ? '#43d17a' : '#ff4d4d'; ctx.fillRect(-46, 10, 30 * s, 3); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.6; ctx.strokeRect(-46, 10, 30, 3);
    },
  },
  solar: {
    name: '太阳能电池板', en: 'Solar Panel', cat: 'source', desig: 'PV', terms: [[-60, 40], [60, 40]], termNames: ['−', '+'], box: [-60, -40, 60, 40],
    props: [{ k: 'pos', label: '光照强度', kind: 'range', def: 0.8 }, { k: 'Voc', label: '开路电压 Voc (满光照)', unit: 'V', def: 6, min: 0.1 },
      { k: 'Isc', label: '短路电流 Isc (满光照)', unit: 'A', def: 0.2, min: 1e-6 }, { k: 'Ns', label: '串联片数', unit: '', def: 12, min: 1 }],
    wheel: true,
    label: (c) => Math.round(c.props.pos * 100) + '% ☀',
    build(c, n, m) {
      const P = c.props, nVt = Math.max(1, Math.round(P.Ns)) * 1.3 * VT, Is = P.Isc / (Math.exp(P.Voc / nVt) - 1);
      m.addI(n[0], n[1], () => P.Isc * U.clamp(P.pos, 0, 1));
      c._q = m.addD(n[1], n[0], Is, nVt, c.state); m.addR(n[1], n[0], 1 / (Math.max(1, P.Ns) * 200));
      c._p = null;
    },
    measure(c, m) { const V = m.v(c._nodes[1]) - m.v(c._nodes[0]), P = c.props; c._m.V = V; c._m.I = P.Isc * U.clamp(P.pos, 0, 1) - c._q.i - V / (Math.max(1, P.Ns) * 200); c._m.P = V * c._m.I; },
    readings(c) { return [[_t('common.light'), Math.round(c.props.pos * 100) + ' %'], [_t('common.voltage'), U.fmt(c._m.V || 0, 'V')], [_t('common.output_current'), U.fmt(c._m.I || 0, 'A')], [_t('common.output_power'), U.fmt(c._m.P || 0, 'W')], [_t('solar.full_light_voc_isc'), U.fmt(c.props.Voc, 'V') + ' / ' + U.fmt(c.props.Isc, 'A')]]; },
    draw(ctx, c) {
      D.lead(ctx, -60, 40, -50, 36); D.lead(ctx, 60, 40, 50, 36);
      ctx.fillStyle = '#c9ced6'; D.rrect(ctx, -56, -38, 112, 76, 3); ctx.fill();
      const L = U.clamp(c.props.pos, 0, 1);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
        const x = -52 + i * 17.5, y = -34 + j * 34;
        ctx.fillStyle = D.vgrad(ctx, y, y + 32, [[0, U.shade('#1d3f8a', 0.2 + 0.3 * L)], [1, '#0e2356']]); ctx.fillRect(x, y, 16, 32);
        ctx.strokeStyle = 'rgba(200,210,240,0.5)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(x, y + 16); ctx.lineTo(x + 16, y + 16); ctx.moveTo(x + 8, y); ctx.lineTo(x + 8, y + 32); ctx.stroke();
      }
      if (L > 0.02) { ctx.fillStyle = 'rgba(255,255,255,' + (0.25 * L) + ')'; ctx.beginPath(); ctx.moveTo(-56, -38); ctx.lineTo(-10, -38); ctx.lineTo(-56, 10); ctx.fill(); glow(ctx, 44, -46, 16, '#ffd84a', L); }
      txt(ctx, U.fmtShort(c.props.Voc, 'V') + ' / ' + U.fmtShort(c.props.Isc, 'A'), -30, -38 + 2, '5px sans-serif', '#445');
    },
  },
  psu: {
    name: '直流稳压电源', en: 'Bench DC Power Supply', cat: 'source', desig: 'PS', terms: [[-20, 50], [20, 50]], termNames: ['− 黑', '+ 红'], box: [-70, -50, 70, 50],
    props: [{ k: 'V', label: '输出电压设定 (CV)', unit: 'V', def: 12, min: 0, max: 30 }, { k: 'I', label: '限流设定 (CC)', unit: 'A', def: 1, min: 0.001, max: 5 }, { k: 'on', label: '输出开启 OUTPUT', kind: 'bool', def: true }],
    label: (c) => U.fmtShort(c.props.V, 'V') + ' / ' + U.fmtShort(c.props.I, 'A'),
    onWheel(c, dir, lx) { if (lx < 0) c.props.V = U.clamp(Math.round((c.props.V + dir * 0.1) * 10) / 10, 0, 30); else c.props.I = U.clamp(Math.round((c.props.I + dir * 0.01) * 100) / 100, 0.001, 5); },
    click(c, app, lx, ly) { if (ly > 18 && lx > 30) { c.props.on = !c.props.on; app.dirty = true; app.changed(); } },
    build(c, n, m) {
      if (!c.props.on) { c._q = null; c._p = m.addR(n[1], n[0], G_OFF); return; }
      c._q = m.addNL('psu', [n[1], n[0]], { Vset: U.clamp(c.props.V, 0, 30), Iset: U.clamp(c.props.I, 0.001, 5), Ro: 0.001 }, c.state); c._p = null;
    },
    measure(c, m) {
      const V = m.v(c._nodes[1]) - m.v(c._nodes[0]); c._m.V = V;
      if (!c._q) { c._m.I = 0; c._m.cc = false; c._m.P = 0; return; }
      const L = softLimit((c.props.V - V) / 0.001, (c.props.V - V) >= 0 ? c.props.I : c.props.I * 0.02); c._m.I = L.I; c._m.cc = L.x > 1.02; c._m.P = V * L.I;
    },
    readings(c) { return [[_t('psu.mode'), !c.props.on ? _t('psu.output_off') : c._m.cc ? _t('psu.cc_constant_current_limiting') : _t('psu.cv_constant_voltage')], [_t('common.output_voltage'), U.fmt(c._m.V || 0, 'V')], [_t('common.output_current'), U.fmt(c._m.I || 0, 'A')], [_t('common.output_power'), U.fmt(c._m.P || 0, 'W')], [_t('psu.setpoint'), U.fmt(c.props.V, 'V') + ' / ' + U.fmt(c.props.I, 'A')]]; },
    draw(ctx, c, env) {
      D.lead(ctx, -20, 50, -20, 40); D.lead(ctx, 20, 50, 20, 40);
      ctx.fillStyle = D.vgrad(ctx, -50, 44, [[0, '#e9ecef'], [1, '#aeb4bb']]); D.rrect(ctx, -70, -50, 140, 94, 6); ctx.fill();
      ctx.fillStyle = '#2b2f33'; D.rrect(ctx, -64, -44, 128, 50, 4); ctx.fill();
      const live = env && (env.running || env.hasRun) && c.props.on, M = c._m || {};
      const fmt = (v, d) => (live ? Math.abs(v || 0).toFixed(d) : (d === 2 ? c.props.V.toFixed(2) : c.props.I.toFixed(3)));
      ctx.font = 'bold 15px "Consolas", "DejaVu Sans Mono", monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      D.upright(ctx, c, 0, -19, (ctx) => {
        ctx.fillStyle = '#ff3b30'; ctx.font = 'bold 15px "Consolas", "DejaVu Sans Mono", monospace'; ctx.textAlign = 'right'; ctx.fillText(fmt(M.V, 2), -8, -6); txt(ctx, 'V', -2, -6, 'bold 8px sans-serif', '#ff3b30', 'left');
        ctx.fillStyle = '#39d353'; ctx.font = 'bold 15px "Consolas", "DejaVu Sans Mono", monospace'; ctx.textAlign = 'right'; ctx.fillText(fmt(M.I, 3), 50, -6); txt(ctx, 'A', 54, -6, 'bold 8px sans-serif', '#39d353', 'left');
        const cc = live && M.cc;
        ctx.fillStyle = live && !cc ? '#39d353' : '#244'; ctx.beginPath(); ctx.arc(-50, 12, 3, 0, 7); ctx.fill(); txt(ctx, 'CV', -40, 12, 'bold 6px sans-serif', '#bbb');
        ctx.fillStyle = cc ? '#ff3b30' : '#422'; ctx.beginPath(); ctx.arc(-24, 12, 3, 0, 7); ctx.fill(); txt(ctx, 'CC', -14, 12, 'bold 6px sans-serif', '#bbb');
      });
      for (const [x, lab] of [[-44, 'VOLTAGE'], [0, 'CURRENT']]) { const g = ctx.createRadialGradient(x - 3, 17, 1, x, 20, 11); g.addColorStop(0, '#777'); g.addColorStop(1, '#1a1a1a'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, 21, 10, 0, 7); ctx.fill(); D.upright(ctx, c, x, 36, (ctx) => txt(ctx, lab, 0, 0, '5px sans-serif', '#333')); }
      ctx.fillStyle = c.props.on ? '#39d353' : '#888'; D.rrect(ctx, 34, 14, 26, 12, 3); ctx.fill(); D.upright(ctx, c, 47, 20, (ctx) => txt(ctx, 'OUT', 0, 0, 'bold 6px sans-serif', '#fff'));
      D.jack(ctx, -20, 38, '#222'); D.jack(ctx, 20, 38, '#d62828');
    },
  },
  buck: Object.assign({}, DEFS.boost, {
    name: 'DC-DC 降压模块', en: 'Buck Module (LM2596)',
    props: [{ k: 'Vout', label: '输出电压 (多圈电位器)', unit: 'V', def: 5, min: 1.25, max: 35 }, { k: 'eff', label: '效率 η', unit: '%', def: 88, min: 10, max: 100 },
      { k: 'Imax', label: '最大输出电流 (限流)', unit: 'A', def: 3, min: 0.01 }, { k: 'Vmin', label: '最低输入电压 (欠压锁定)', unit: 'V', def: 4.5, min: 0.5 }],
    label: (c) => 'Buck → ' + U.fmtShort(DEFS.buck.vset(c), 'V'),
    vset(c) { return U.clamp(+c.props.Vout || 0, 1.25, 35); },
    onWheel(c, dir) { c.props.Vout = U.clamp(Math.round((DEFS.buck.vset(c) + dir * 0.1) * 10) / 10, 1.25, 35); },
    build(c, n, m) {
      const P = c.props;
      c._q = m.addNL('boost', [n[0], n[2], n[1]], { kind: 'buck', Vdo: 1.5, Vset: DEFS.buck.vset(c), eff: U.clamp(P.eff, 10, 100) / 100, Ilim: Math.max(P.Imax, 0.01), Vmin: Math.max(P.Vmin, 0.5) }, c.state);
      c._p = null;
    },
    status(c) {
      const M = c._m, st = c.state;
      if (st.hot) return _t('common.thermal_shutdown');
      if (!(M.en > 0.5)) return st.brown ? _t('buck.brown_out') : _t('common.input_too_low_uvlo_vin') + U.fmtShort(c.props.Vmin, 'V') + ')';
      if (st.ol || M.x > 1.05) return _t('common.over_current_limit_foldback');
      if (M.pass) return _t('buck.dropout_vin_vout_1_5_v');
      return _t('common.regulating');
    },
    readings(c) { const r = DEFS.boost.readings.call(DEFS.buck, c); r[7] = [_t('common.setpoint_vset'), U.fmt(DEFS.buck.vset(c), 'V')]; r[8] = [_t('common.state'), DEFS.buck.status(c)]; return r; },
    post(c, dt, app) {
      const st = c.state, M = c._m; st.vo = M.Vout;
      if (st.ol) { if (M.x < 0.9) st.ol = false; } else if (M.x > 1.2 && M.en > 0.5) st.ol = true;
      st.heat = Math.max(0, (st.heat || 0) + dt * (st.ol ? 1 : -0.5));
      if (!st.hot && st.heat > 3) { st.hot = true; app.toast(_t('buck.buck_module_overheated_sustained_ove')); } else if (st.hot && st.heat < 1) st.hot = false;
    },
    draw(ctx, c, env) {
      const st = c.state, M = c._m || {};
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; D.rrect(ctx, -76, -42, 156, 90, 5); ctx.fill();
      ctx.fillStyle = D.vgrad(ctx, -46, 46, [[0, '#2f6fd6'], [1, '#1a4aa3']]); D.rrect(ctx, -80, -46, 160, 92, 5); ctx.fill();
      ctx.strokeStyle = '#123577'; ctx.lineWidth = 1; ctx.stroke();
      for (const [x, y] of DEFS.buck.terms) { ctx.fillStyle = '#d9b44a'; ctx.beginPath(); ctx.arc(x + Math.sign(-x) * 8, y, 6.5, 0, 7); ctx.fill(); ctx.fillStyle = '#6b5a24'; ctx.beginPath(); ctx.arc(x + Math.sign(-x) * 8, y, 2.4, 0, 7); ctx.fill(); D.lead(ctx, x, y, x + Math.sign(-x) * 8, y); }
      // input / output electrolytics
      for (const x of [-52, 50]) { ctx.fillStyle = D.vgrad(ctx, -40, -10, [[0, '#3a3a3a'], [1, '#111']]); ctx.beginPath(); ctx.arc(x, -24, 11, 0, 7); ctx.fill(); ctx.strokeStyle = '#9aa'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - 5, -24); ctx.lineTo(x + 5, -24); ctx.moveTo(x, -29); ctx.lineTo(x, -19); ctx.stroke(); }
      // big toroid inductor
      ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(-10, -12, 20, 0, 7); ctx.fill(); ctx.strokeStyle = '#c47a2c'; ctx.lineWidth = 2.2; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(-10 + Math.cos(a) * 9, -12 + Math.sin(a) * 9); ctx.lineTo(-10 + Math.cos(a) * 19, -12 + Math.sin(a) * 19); ctx.stroke(); }
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(-10, -12, 8, 0, 7); ctx.fill();
      // LM2596 (TO-263)
      ctx.fillStyle = '#c9ccd1'; ctx.fillRect(18, -40, 24, 6); ctx.fillStyle = '#151515'; ctx.fillRect(16, -34, 28, 22); txt(ctx, 'LM2596', 30, -23, 'bold 5px sans-serif', '#ddd');
      // multi-turn trimmer (blue 3296)
      ctx.fillStyle = '#2a58c8'; ctx.fillRect(16, 2, 30, 16); ctx.strokeStyle = '#0f2e7a'; ctx.strokeRect(16, 2, 30, 16);
      ctx.fillStyle = '#e8c35a'; ctx.beginPath(); ctx.arc(22, 10, 4.5, 0, 7); ctx.fill();
      const ang = DEFS.buck.vset(c) / 35 * Math.PI * 6; ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(22 - Math.cos(ang) * 3.5, 10 - Math.sin(ang) * 3.5); ctx.lineTo(22 + Math.cos(ang) * 3.5, 10 + Math.sin(ang) * 3.5); ctx.stroke();
      const on = env && (env.running || env.hasRun) ? (M.en > 0.5 && !st.hot) : false;
      if (on) glow(ctx, -40, 12, 10, '#ff3030', 0.9); ctx.fillStyle = on ? '#ff4040' : '#6a2020'; ctx.fillRect(-44, 9, 7, 5);
      D.upright(ctx, c, 0, 0, (ctx) => {
        if (c.rot % 2 === 1) { txt(ctx, 'BUCK', 0, 0); return; }
        txt(ctx, 'LM2596 DC-DC BUCK', 0, 36, 'bold 7px sans-serif', '#f2f6ff');
        ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#f2f6ff'; ctx.fillText('IN+', -68, -32); ctx.fillText('IN−', -68, 32);
        ctx.textAlign = 'right'; ctx.fillText('OUT+', 68, -38); ctx.fillText('OUT−', 68, 32);
        if (st.hot) txt(ctx, _t('common.hot'), -40, 24, 'bold 8px sans-serif', '#ffdd33');
      });
    },
  }),
});
DEFS.buck.terms = DEFS.boost.terms.slice(); DEFS.buck.termNames = ['IN+', 'IN− (GND)', 'OUT+', 'OUT− (GND)'];

const RGB_VF = { r: 1.9, g: 3.0, b: 3.1 };
function mixHex(r, g, b) { const m = Math.max(r, g, b, 1e-9), f = (v) => Math.round(255 * U.clamp(v / m, 0, 1)).toString(16).padStart(2, '0'); return '#' + f(r) + f(g) + f(b); }
const SEG_ORDER = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'];
const BAR_COLORS = { red: '#ff2a2a', green: '#2bff4a', yellow: '#ffe01a', blue: '#2a7bff' };
function ledAvg(st, k, I, dt) { st[k] = (st[k] || 0) + (Math.max(0, I) - (st[k] || 0)) * Math.min(1, dt / 0.01); return st[k]; }
function capCode(C) { const pf = C * 1e12; if (pf < 10) return pf.toFixed(0); const e = Math.floor(Math.log10(pf)) - 1, m = Math.round(pf / Math.pow(10, e)); return String(m) + String(Math.max(0, e)); }

Object.assign(DEFS, {
  // ======================= passive =======================
  ecap: {
    name: '电解电容', en: 'Electrolytic Capacitor', cat: 'basic', desig: 'C', terms: [[-40, 0], [40, 0]], termNames: ['+ 长脚', '− 短脚 (白条)'], box: [-40, -30, 40, 12],
    props: [{ k: 'C', label: '电容', unit: 'F', def: 100e-6, min: 1e-9 }, { k: 'Vr', label: '额定电压', unit: 'V', def: 25, min: 1 }],
    label: (c) => U.fmtShort(c.props.C, 'F') + ' ' + U.fmtShort(c.props.Vr, 'V'),
    build(c, n, m) {
      if (c.state.burnt) { c._p = m.addR(n[0], n[1], G_OFF); return; }
      c._p = m.addC(n[0], n[1], c.props.C, c.state); m.addR(n[0], n[1], 1e-8);   // + ~100 MΩ leakage
    },
    measure(c, m) { c._m.V = m.v(c._nodes[0]) - m.v(c._nodes[1]); c._m.I = c._p ? c._p.i : 0; c._m.P = 0; },
    post(c, dt, app) {
      const st = c.state, v = c._m.V; if (st.burnt) return;
      const rev = v < -1.0, ov = v > 1.15 * c.props.Vr;
      if (rev && !st.warnRev) { st.warnRev = true; app.toast(_t('ecap.electrolytic_capacitor_reversed') + U.fmt(v, 'V', 3) + _t('ecap.connect_the_lead_to_the_higher_poten')); }
      if (ov && !st.warnOv) { st.warnOv = true; app.toast(_t('ecap.electrolytic_capacitor_over_voltage') + U.fmt(v, 'V', 3) + _t('ecap.rated') + U.fmt(c.props.Vr, 'V')); }
      st.stress = rev || ov ? (st.stress || 0) + dt * (rev ? Math.min(3, -v / 2) : 1) : Math.max(0, (st.stress || 0) - dt * 0.2);
      if (st.stress > 0.5) { st.burnt = true; st.pop = rev ? 'rev' : 'ov'; app.dirty = true; app.toast(_t('ecap.electrolytic_capacitor') + (rev ? _t('ecap.reversed') : _t('ecap.over_voltage')) + _t('ecap.burst_damaged_open_circuit')); }
    },
    readings(c) { const st = c.state, v = c._m.V || 0; return [[_t('common.capacitor'), U.fmt(c.props.C, 'F')], [_t('ecap.voltage_to'), U.fmt(v, 'V')], [_t('ecap.rated_voltage'), U.fmt(c.props.Vr, 'V')], [_t('common.state'), st.burnt ? _t('ecap.burst') + (st.pop === 'rev' ? _t('ecap.reversed') : _t('ecap.over_voltage')) + ')' : v < -1 ? _t('ecap.reversed_polarity') : v > 1.15 * c.props.Vr ? _t('ecap.over_voltage_585') : _t('common.normal')]]; },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -6, 0); D.lead(ctx, 40, 0, 6, 0); D.lead(ctx, -6, 0, -6, 4); D.lead(ctx, 6, 0, 6, 4);
      const burnt = c.state.burnt;
      ctx.fillStyle = D.vgrad(ctx, -28, 4, [[0, burnt ? '#5a3a2a' : '#2c4fa8'], [1, burnt ? '#2a1a10' : '#16285e']]); D.rrect(ctx, -14, -28, 28, 32, 3); ctx.fill();
      ctx.fillStyle = burnt ? '#6b5a4a' : '#dfe6f2'; ctx.fillRect(6, -28, 5, 32);
      ctx.fillStyle = burnt ? '#333' : '#1b2a4a'; for (let i = 0; i < 4; i++) ctx.fillRect(7.5, -25 + i * 8, 2, 3);
      ctx.fillStyle = D.vgrad(ctx, -31, -27, [[0, '#e8eaee'], [1, '#9aa0a8']]); D.rrect(ctx, -14, -31, 28, 5, 2); ctx.fill();
      if (burnt) { ctx.fillStyle = 'rgba(70,60,50,0.55)'; ctx.beginPath(); ctx.arc(-4, -38, 7, 0, 7); ctx.arc(5, -44, 6, 0, 7); ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-8, -31); ctx.lineTo(0, -35); ctx.lineTo(8, -31); ctx.stroke(); }
      else { ctx.strokeStyle = '#8a9099'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-6, -29); ctx.lineTo(6, -29); ctx.stroke(); }
      D.upright(ctx, c, -3, -12, (ctx) => txt(ctx, U.fmtShort(c.props.C, 'F').replace(' ', ''), 0, 0, 'bold 5.5px sans-serif', '#fff'));
      txt(ctx, '+', -26, -6, 'bold 9px sans-serif', '#c33');
    },
  },
  ccap: {
    name: '瓷片电容', en: 'Ceramic Capacitor', cat: 'basic', desig: 'C', terms: [[-40, 0], [40, 0]], box: [-40, -30, 40, 6],
    props: [{ k: 'C', label: '电容', unit: 'F', def: 100e-9, min: 1e-13 }, { k: 'Vr', label: '额定电压', unit: 'V', def: 50, min: 1 }],
    label: (c) => U.fmtShort(c.props.C, 'F') + ' (' + capCode(c.props.C) + ')',
    build(c, n, m) { c._p = m.addC(n[0], n[1], c.props.C, c.state); },
    readings(c) { return [[_t('common.capacitor'), U.fmt(c.props.C, 'F') + _t('ccap.code') + capCode(c.props.C) + ')'], [_t('common.voltage'), U.fmt(c._m.V || 0, 'V')], [_t('common.current'), U.fmt(c._m.I || 0, 'A')]]; },
    draw(ctx, c) {
      D.poly(ctx, [[-40, 0], [-6, 0], [-6, -8]]); D.poly(ctx, [[40, 0], [6, 0], [6, -8]]);
      const g = ctx.createRadialGradient(-4, -22, 2, 0, -18, 14); g.addColorStop(0, '#f7d98a'); g.addColorStop(1, '#c98e2c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -18, 13, 11, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#a06a18'; ctx.lineWidth = 0.8; ctx.stroke();
      D.upright(ctx, c, 0, -18, (ctx) => txt(ctx, capCode(c.props.C), 0, 0, 'bold 7px sans-serif', '#5a3a0a'));
    },
  },

  // ======================= semiconductors =======================
  schottky: Object.assign({}, DEFS.diode, {
    name: '肖特基二极管', en: 'Schottky Diode 1N5819', label: (c) => c.props.part && c.props.part !== 'custom' ? c.props.part : _t('schottky.schottky'),
    draw(ctx, c) { drawAxial(ctx, c, '#1c1c1c', '#c9ccd1', c.props.part !== 'custom' ? c.props.part : ''); },
  }),
  rectifier: Object.assign({}, DEFS.diode, {
    name: '整流二极管', en: 'Rectifier Diode 1N4007', label: (c) => c.props.part && c.props.part !== 'custom' ? c.props.part : _t('rectifier.rectifier'),
    draw(ctx, c) { drawAxial(ctx, c, '#1c1c1c', '#c9ccd1', c.props.part !== 'custom' ? c.props.part : ''); },
  }),
  sigdiode: Object.assign({}, DEFS.diode, {
    name: '开关二极管', en: 'Signal Diode 1N4148', label: (c) => c.props.part && c.props.part !== 'custom' ? c.props.part : '1N4148',
    draw(ctx, c) { drawAxial(ctx, c, '#e08a3a', '#1c1c1c', c.props.part !== 'custom' ? c.props.part : '', true); },
  }),
  bridge: {
    name: '整流桥', en: 'Bridge Rectifier', cat: 'semi', desig: 'BR', terms: [[-40, 40], [-20, 40], [20, 40], [40, 40]],
    termNames: ['+ 直流正', '~ 交流', '~ 交流', '− 直流负'], box: [-48, -30, 48, 40],
    props: [{ k: 'part', label: '型号', kind: 'select', opts: [['DB107', 'DB107 (1 A, 1N4007 ×4)'], ['KBP307', 'KBP307 (3 A)']], def: 'DB107' }],
    label: (c) => c.props.part,
    build(c, n, m) {
      const P = c.props.part === 'KBP307' ? { Is: 1.4e-8, nf: 1.9, Rs: 0.012 } : PRESETS.diode['1N4007'], st = c.state;
      const D2 = (a, b, k) => { const x = m.newNode(); m.addR(x, b, 1 / P.Rs); const d = m.addD(a, x, P.Is, P.nf * VT, sub(st, k)); d.bk = b; m.addR(a, b, 1e-8); return d; };   // 100 MΩ leakage fixes the floating DC side's common mode
      c._d = [D2(n[1], n[0], 'd1'), D2(n[2], n[0], 'd2'), D2(n[3], n[1], 'd3'), D2(n[3], n[2], 'd4')]; c._p = null;
    },
    measure(c, m) { const n = c._nodes; c._m.V = m.v(n[0]) - m.v(n[3]); c._m.I = c._d[0].i + c._d[1].i; c._m.Vac = m.v(n[1]) - m.v(n[2]); c._m.P = c._d.reduce((s, d) => s + Math.abs(d.i * ((m.v(d.a) - m.v(d.bk)))), 0); },
    readings(c) { return [[_t('bridge.ac_input'), U.fmt(c._m.Vac || 0, 'V')], [_t('bridge.dc_output'), U.fmt(c._m.V || 0, 'V')], [_t('common.output_current'), U.fmt(c._m.I || 0, 'A')], [_t('bridge.loss'), U.fmt(c._m.P || 0, 'W')]]; },
    draw(ctx, c) {
      for (const [x] of DEFS.bridge.terms) D.lead(ctx, x, 40, x, 22);
      ctx.fillStyle = D.vgrad(ctx, -24, 24, [[0, '#3a3a3a'], [1, '#111']]); D.rrect(ctx, -48, -26, 96, 48, 3); ctx.fill();
      D.upright(ctx, c, 0, 0, (ctx) => txt(ctx, c.props.part, 0, -8, 'bold 8px sans-serif', '#eee'));
      [['+', -40, '#ff6b6b'], ['~', -20, '#ddd'], ['~', 20, '#ddd'], ['−', 40, '#9ecbff']].forEach(([s, x, col]) => txt(ctx, s, x, 14, 'bold 9px sans-serif', col));
    },
  },
  rgbled: {
    name: 'RGB 三色 LED', en: 'RGB LED', cat: 'light', desig: 'LED', terms: [[-40, 20], [-20, 20], [0, 20], [20, 20]], termNames: ['R 红', '公共端 (长脚)', 'G 绿', 'B 蓝'], box: [-44, -44, 24, 20],
    props: [{ k: 'ca', label: '共阳极 (Common Anode)', kind: 'bool', def: false }, { k: 'Imax', label: '每色最大电流', unit: 'A', def: 0.03, min: 1e-4 }],
    label: (c) => (c.props.ca ? _t('rgbled.ca') : _t('rgbled.cc')) + ' RGB',
    build(c, n, m) {
      if (c.state.burnt) { c._d = null; c._p = null; return; }
      const st = c.state, ch = [['r', 0], ['g', 2], ['b', 3]];
      c._d = ch.map(([k, i]) => (c.props.ca ? m.addD(n[1], n[i], ledIs(RGB_VF[k]), 2 * VT, sub(st, k)) : m.addD(n[i], n[1], ledIs(RGB_VF[k]), 2 * VT, sub(st, k)))); c._p = null;
    },
    measure(c) { const d = c._d; c._m.Ir = d ? d[0].i : 0; c._m.Ig = d ? d[1].i : 0; c._m.Ib = d ? d[2].i : 0; c._m.I = c._m.Ir + c._m.Ig + c._m.Ib; c._m.V = 0; c._m.P = 0; },
    post(c, dt, app) {
      const st = c.state, M = c._m; if (st.burnt) return;
      const r = ledAvg(st, 'ar', M.Ir, dt), g = ledAvg(st, 'ag', M.Ig, dt), b = ledAvg(st, 'ab', M.Ib, dt);
      if (Math.max(r, g, b) > c.props.Imax) { st.over = (st.over || 0) + dt; if (st.over > 0.05) { st.burnt = true; app.dirty = true; app.toast(_t('rgbled.rgb_led_burnt_out_by_excessive_curre')); } } else st.over = 0;
    },
    mix(c) { const st = c.state; const k = [(st.ar || 0) / 0.02, (st.ag || 0) / 0.02 * 1.0, (st.ab || 0) / 0.02]; return { hex: mixHex(k[0], k[1], k[2]), b: Math.max(k[0], k[1], k[2]), k }; },
    readings(c) { const M = c._m, x = DEFS.rgbled.mix(c); return [[_t('rgbled.i_red_r'), U.fmt(M.Ir || 0, 'A')], [_t('rgbled.i_green_g'), U.fmt(M.Ig || 0, 'A')], [_t('rgbled.i_blue_b'), U.fmt(M.Ib || 0, 'A')], [_t('rgbled.mixed_color'), '<span style="display:inline-block;width:12px;height:12px;border-radius:6px;background:' + x.hex + ';vertical-align:middle"></span> ' + x.hex], [_t('rgbled.brightness'), Math.round(U.clamp(x.b, 0, 9.99) * 100) + '%'], [_t('common.state'), c.state.burnt ? _t('common.burnt_out') : _t('common.normal')]]; },
    draw(ctx, c) {
      for (const [x] of DEFS.rgbled.terms) D.poly(ctx, [[x, 20], [x, 2], [-10 + (x + 10) * 0.25, -6]]);
      const x = DEFS.rgbled.mix(c), b = c.state.burnt ? 0 : U.clamp(x.b, 0, 1.5);
      if (b > 0.02) glow(ctx, -10, -26, 18 + 34 * Math.min(1, b), x.hex, Math.min(1, 0.3 + b));
      const g = ctx.createLinearGradient(-20, 0, 0, 0); g.addColorStop(0, 'rgba(235,240,245,0.85)'); g.addColorStop(0.4, b > 0.05 ? '#ffffff' : '#f7f9fb'); g.addColorStop(1, 'rgba(200,208,216,0.9)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-20, -8); ctx.lineTo(-20, -30); ctx.arc(-10, -30, 10, Math.PI, 0); ctx.lineTo(0, -8); ctx.closePath(); ctx.fill();
      if (b > 0.05) { ctx.fillStyle = U.rgba(x.hex, Math.min(0.85, b)); ctx.beginPath(); ctx.arc(-10, -26, 7, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#d5dbe1'; ctx.fillRect(-22, -9, 24, 3.5);
      D.upright(ctx, c, -10, 28, (ctx) => txt(ctx, 'R  ' + (c.props.ca ? '+' : '−') + '  G  B', 0, 0, '6px sans-serif', '#666'));
    },
  },
  bicolor: {
    name: '双色 LED (红/绿)', en: 'Bi-colour LED', cat: 'light', desig: 'LED', terms: [[-40, 0], [40, 0]], termNames: ['脚1 (正向=红)', '脚2 (正向=绿)'], box: [-40, -36, 40, 6],
    props: [{ k: 'Imax', label: '最大电流', unit: 'A', def: 0.03, min: 1e-4 }],
    label: () => _t('bicolor.red_green'),
    build(c, n, m) { if (c.state.burnt) { c._d = null; return; } c._d = [m.addD(n[0], n[1], ledIs(1.9), 2 * VT, sub(c.state, 'r')), m.addD(n[1], n[0], ledIs(2.1), 2 * VT, sub(c.state, 'g'))]; c._p = null; },
    measure(c, m) { c._m.V = m.v(c._nodes[0]) - m.v(c._nodes[1]); c._m.Ir = c._d ? c._d[0].i : 0; c._m.Ig = c._d ? c._d[1].i : 0; c._m.I = c._m.Ir - c._m.Ig; c._m.P = Math.abs(c._m.V * c._m.I); },
    post(c, dt, app) { const st = c.state; if (st.burnt) return; const r = ledAvg(st, 'ar', c._m.Ir, dt), g = ledAvg(st, 'ag', c._m.Ig, dt); if (Math.max(r, g) > c.props.Imax) { st.over = (st.over || 0) + dt; if (st.over > 0.05) { st.burnt = true; app.dirty = true; app.toast(_t('bicolor.bi_color_led_burnt_out_by_excessive')); } } else st.over = 0; },
    readings(c) { const st = c.state; return [[_t('bicolor.red_1_2'), U.fmt(c._m.Ir || 0, 'A')], [_t('bicolor.green_2_1'), U.fmt(c._m.Ig || 0, 'A')], [_t('bicolor.color'), (st.ar || 0) > 1e-3 && (st.ag || 0) > 1e-3 ? _t('bicolor.yellow_orange_ac_mixing') : (st.ar || 0) > 1e-4 ? _t('bicolor.red') : (st.ag || 0) > 1e-4 ? _t('bicolor.green') : _t('bicolor.off')]]; },
    draw(ctx, c) {
      D.poly(ctx, [[-40, 0], [-4, 0], [-4, -6]]); D.poly(ctx, [[40, 0], [4, 0], [4, -6]]);
      const st = c.state, r = (st.ar || 0) / 0.02, g = (st.ag || 0) / 0.02, b = c.state.burnt ? 0 : U.clamp(Math.max(r, g), 0, 1.5), hex = mixHex(r * 1.0, g * 0.85, 0);
      if (b > 0.02) glow(ctx, 0, -20, 16 + 30 * Math.min(1, b), hex, Math.min(1, 0.3 + b));
      ctx.fillStyle = b > 0.05 ? U.rgba(hex, 0.9) : 'rgba(225,230,225,0.85)'; ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(-9, -24); ctx.arc(0, -24, 9, Math.PI, 0); ctx.lineTo(9, -9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#999'; ctx.lineWidth = 0.8; ctx.stroke(); ctx.fillStyle = '#ccc'; ctx.fillRect(-11, -9, 22, 3.5);
      txt(ctx, 'R', -22, -6, 'bold 7px sans-serif', '#d33'); txt(ctx, 'G', 22, -6, 'bold 7px sans-serif', '#2a2');
    },
  },
  tip120: {
    name: '达林顿管 TIP120', en: 'Darlington TIP120', cat: 'semi', desig: 'Q', terms: [[-20, 20], [0, 20], [20, 20]], termNames: ['B 基极', 'C 集电极', 'E 发射极'], box: [-20, -36, 20, 20],
    props: [{ k: 'BF1', label: 'Q1 β', unit: '', def: 150, min: 1 }, { k: 'BF2', label: 'Q2 β', unit: '', def: 50, min: 1 }],
    label: () => 'TIP120',
    build(c, n, m) {
      const x = m.newNode(), st = c.state;
      c._q1 = m.addQ(n[0], n[1], x, 1, { BF: c.props.BF1, Is: 1e-14, BR: 1, VAF: 100 }, sub(st, 'q1'));
      c._q2 = m.addQ(x, n[1], n[2], 1, { BF: c.props.BF2, Is: 1e-12, BR: 1, VAF: 100 }, sub(st, 'q2'));
      c._r1 = m.addR(n[0], x, 1 / 8000); m.addR(x, n[2], 1 / 120);
      c._dce = m.addD(n[2], n[1], 1e-12, 1.5 * VT, sub(st, 'd'));   // built-in flyback diode E→C
      c._p = null;
    },
    measure(c, m) {
      const n = c._nodes; c._m.Ib = c._q1.ib + c._r1.i; c._m.I = c._q1.ic + c._q2.ic - c._dce.i;
      c._m.V = m.v(n[1]) - m.v(n[2]); c._m.Vbe = m.v(n[0]) - m.v(n[2]); c._m.P = Math.abs(c._m.V * c._m.I);
    },
    readings(c) { const M = c._m; return [[_t('common.collector_current_ic'), U.fmt(M.I || 0, 'A')], [_t('tip120.base_current_ib'), U.fmt(M.Ib || 0, 'A')], ['Ic/Ib', Math.abs(M.Ib) > 1e-9 ? (M.I / M.Ib).toFixed(0) : '—'], ['Vbe', U.fmt(M.Vbe || 0, 'V')], ['Vce', U.fmt(M.V || 0, 'V')], [_t('tip120.dissipation'), U.fmt(M.P || 0, 'W')]]; },
    draw(ctx, c) { drawTO220(ctx, c, 'TIP120', 'B C E', '#1f1f1f'); },
  },
  opto: {
    name: '光耦 PC817', en: 'Optocoupler PC817', cat: 'semi', desig: 'U', terms: [[-40, -20], [-40, 20], [40, -20], [40, 20]], termNames: ['1 阳极 A', '2 阴极 K', '4 集电极 C', '3 发射极 E'], box: [-40, -30, 40, 30],
    props: [{ k: 'ctr', label: '电流传输比 CTR', unit: '%', def: 100, min: 1, max: 1000 }],
    label: (c) => 'PC817 CTR ' + Math.round(c.props.ctr) + '%',
    build(c, n, m) {
      const Is = 0.02 / Math.exp(1.2 / (1.9 * VT));
      c._q = m.addNL('opto', [n[0], n[1], n[2], n[3]], { Is, nVt: 1.9 * VT, vcrit: 1.9 * VT * Math.log(1.9 * VT / (Math.SQRT2 * Is)), ctr: c.props.ctr / 100, Vs: 0.12, gl: 1e-9 }, c.state);
      c._q.iso = [[0, 1], [2, 3]]; c._p = null;
    },
    measure(c, m) {
      const n = c._nodes, p = c._q, vd = m.v(n[0]) - m.v(n[1]), vce = m.v(n[2]) - m.v(n[3]);
      const If = p.Is * (Math.exp(Math.min(vd / p.nVt, 700)) - 1), s = optoSat(vce, p.Vs)[0];
      c._m.If = If; c._m.Vf = vd; c._m.Vce = vce; c._m.Ic = p.ctr * Math.max(If, 0) * s + p.gl * vce; c._m.I = c._m.Ic; c._m.V = vce; c._m.P = vd * If + vce * c._m.Ic;
    },
    readings(c) { const M = c._m; return [[_t('opto.led_current_if'), U.fmt(M.If || 0, 'A')], [_t('opto.led_forward_voltage_vf'), U.fmt(M.Vf || 0, 'V')], [_t('common.collector_current_ic'), U.fmt(M.Ic || 0, 'A')], ['Vce', U.fmt(M.Vce || 0, 'V')], [_t('opto.actual_ic_if'), (M.If || 0) > 1e-6 ? (M.Ic / M.If * 100).toFixed(0) + ' %' : '—'], [_t('common.state'), (M.If || 0) < 1e-5 ? _t('opto.off_led_not_lit') : (M.Vce || 0) < 0.4 ? _t('common.saturated_on') : _t('opto.linear_region')]]; },
    draw(ctx, c) {
      drawDIP(ctx, c, [], 56, 44, '', '#f4f4f0');
      for (const [x, y] of DEFS.opto.terms) D.lead(ctx, x, y, Math.sign(x) * 28, y);
      const on = (c._m.If || 0) > 1e-4;
      D.upright(ctx, c, 0, 0, (ctx) => { txt(ctx, 'PC817', 0, -8, 'bold 8px sans-serif', '#333'); txt(ctx, on ? '◉ IR' : '○', 0, 7, 'bold 7px sans-serif', on ? '#c0392b' : '#999'); });
      ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(-20, -14, 2, 0, 7); ctx.fill();
    },
  },
  scr: {
    name: '可控硅 SCR', en: 'Thyristor (SCR)', cat: 'semi', desig: 'Q', terms: [[-20, 20], [0, 20], [20, 20]], termNames: ['K 阴极', 'A 阳极', 'G 门极'], box: [-20, -36, 20, 20],
    props: [{ k: 'Igt', label: '触发电流 Igt', unit: 'A', def: 1e-3, min: 1e-6 }, { k: 'Ih', label: '维持电流 Ih', unit: 'A', def: 5e-3, min: 1e-6 }],
    label: () => 'BT151',
    thyrPar(c, bidir) { const IsG = 1e-14, IsM = 1e-12, nVtM = 1.5 * VT; return { bidir, IsG, IsM, nVtM, vcritG: VT * Math.log(VT / (Math.SQRT2 * IsG)), vcritM: nVtM * Math.log(nVtM / (Math.SQRT2 * IsM)), Igt: c.props.Igt, Ih: c.props.Ih, gon: 0 }; },
    build(c, n, m) { c._q = m.addNL('thyr', [n[1], n[0], n[2]], DEFS.scr.thyrPar(c, false), c.state); c._p = null; },
    measure(c, m) {
      const n = c._nodes, p = c._q, va = m.v(n[1]) - m.v(n[0]), vg = m.v(n[2]) - m.v(n[0]);
      c._m.V = va; c._m.Vg = vg; c._m.Ig = thyrJ(p, vg, p.IsG, VT)[0]; c._m.I = c.state.on ? thyrJ(p, va, p.IsM, p.nVtM)[0] : 1e-9 * va; c._m.P = Math.abs(va * c._m.I);
    },
    readings(c) { const M = c._m; return [[_t('common.state'), c.state.on ? _t('scr.on_latched') : _t('scr.off')], [_t('scr.anode_current_ia'), U.fmt(M.I || 0, 'A')], [_t('scr.a_k_voltage_drop'), U.fmt(M.V || 0, 'V')], [_t('scr.gate_current_ig'), U.fmt(M.Ig || 0, 'A')], [_t('scr.trigger_hold'), U.fmt(c.props.Igt, 'A') + ' / ' + U.fmt(c.props.Ih, 'A')]]; },
    draw(ctx, c) { drawTO220(ctx, c, c.type === 'triac' ? 'BT136' : 'BT151', c.type === 'triac' ? 'T1 T2 G' : 'K A G', c.state.on ? '#2a3a1f' : '#1f1f1f'); if (c.state.on) { ctx.fillStyle = '#39d353'; ctx.beginPath(); ctx.arc(12, -8, 2.5, 0, 7); ctx.fill(); } },
  },
});
DEFS.triac = Object.assign({}, DEFS.scr, {
  name: '双向可控硅 TRIAC', en: 'TRIAC', termNames: ['T1 (MT1)', 'T2 (MT2)', 'G 门极'], label: () => 'BT136',
  props: [{ k: 'Igt', label: '触发电流 |Igt|', unit: 'A', def: 5e-3, min: 1e-6 }, { k: 'Ih', label: '维持电流 Ih', unit: 'A', def: 5e-3, min: 1e-6 }],
  build(c, n, m) { c._q = m.addNL('thyr', [n[1], n[0], n[2]], DEFS.scr.thyrPar(c, true), c.state); c._p = null; },
});
for (const t of ['schottky', 'rectifier', 'sigdiode']) {
  DEFS[t].props = DEFS.diode.props.map(p => Object.assign({}, p));
  const def = { schottky: '1N5819', rectifier: '1N4007', sigdiode: '1N4148' }[t];
  const pp = DEFS[t].props.find(p => p.k === 'part'); pp.def = def;
  for (const [k, v] of Object.entries(PRESETS.diode[def])) { const q = DEFS[t].props.find(p => p.k === k); if (q) q.def = v; }
  DEFS[t].onProp = (c, k) => { if (k === 'part' && PRESETS.diode[c.props.part]) Object.assign(c.props, PRESETS.diode[c.props.part]); };
  DEFS[t].build = DEFS.diode.build; DEFS[t].cat = 'semi'; DEFS[t].desig = 'D';
}

// ======================= switches / inputs =======================
function drawPinHead(ctx, x, y) { ctx.fillStyle = '#c9a53a'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); }
Object.assign(DEFS, {
  tactile: {
    name: '轻触按键 (4 脚)', en: 'Tactile Button 6×6', cat: 'control', desig: 'SW', momentary: true, innerShort: true,
    terms: [[-20, -20], [20, -20], [-20, 20], [20, 20]], termNames: ['1 (与 2 内部相连)', '2', '3 (与 4 内部相连)', '4'], box: [-24, -24, 24, 24],
    props: [], label: (c) => (c.state.pressed ? _t('tactile.pressed') : _t('tactile.released')),
    shorted: (c) => (c.state.pressed ? [[0, 1], [2, 3], [0, 2]] : [[0, 1], [2, 3]]),
    build(c, n, m) { if (!c.state.pressed) m.addR(n[0], n[2], G_OFF); c._p = null; },
    measure(c) { c._m.V = 0; c._m.I = 0; c._m.P = 0; },
    readings(c) { return [[_t('common.state'), c.state.pressed ? _t('tactile.pressed_1_2_and_3_4_connected') : _t('tactile.released_1_2_and_3_4_open')], [_t('common.note'), _t('tactile.hold_the_mouse_button_press_1_2_and')]]; },
    draw(ctx, c) {
      for (const [x, y] of DEFS.tactile.terms) D.lead(ctx, x, y, x * 0.6, y * 0.6);
      ctx.fillStyle = D.vgrad(ctx, -14, 14, [[0, '#d7dbe0'], [1, '#8a9099']]); D.rrect(ctx, -15, -15, 30, 30, 2); ctx.fill();
      ctx.fillStyle = '#222'; for (const [x, y] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill(); }
      const p = c.state.pressed; ctx.fillStyle = D.vgrad(ctx, -9, 9, [[0, p ? '#222' : '#555'], [1, p ? '#000' : '#1a1a1a']]); ctx.beginPath(); ctx.arc(0, 0, p ? 8 : 9, 0, 7); ctx.fill();
      if (!p) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(-2, -3, 4, 0, 7); ctx.fill(); }
    },
  },
  spdt: {
    name: '拨动开关 (单刀双掷)', en: 'Slide Switch SPDT', cat: 'control', desig: 'SW', innerShort: true,
    terms: [[-20, 20], [0, 20], [20, 20]], termNames: ['A (左)', 'COM 公共端', 'B (右)'], box: [-30, -20, 30, 20],
    props: [{ k: 'right', label: '拨到 B (右)', kind: 'bool', def: false }], label: (c) => (c.props.right ? 'COM→B' : 'COM→A'),
    click(c, app) { c.props.right = !c.props.right; app.dirty = true; app.changed(); },
    shorted: (c) => [[1, c.props.right ? 2 : 0]],
    build(c, n, m) { m.addR(n[1], c.props.right ? n[0] : n[2], G_OFF); c._p = null; },
    measure(c) { c._m.V = 0; c._m.I = 0; c._m.P = 0; },
    readings(c) { return [[_t('common.position'), c.props.right ? _t('spdt.b_com_connected_to_b') : _t('spdt.a_com_connected_to_a')]]; },
    draw(ctx, c) {
      for (const [x] of DEFS.spdt.terms) D.lead(ctx, x, 20, x, 6);
      ctx.fillStyle = D.vgrad(ctx, -12, 8, [[0, '#e6e9ed'], [1, '#8c939c']]); D.rrect(ctx, -28, -10, 56, 18, 2); ctx.fill();
      ctx.fillStyle = '#222'; D.rrect(ctx, -18, -7, 36, 8, 2); ctx.fill();
      const x = c.props.right ? 6 : -18; ctx.fillStyle = D.vgrad(ctx, -18, 0, [[0, '#444'], [1, '#111']]); ctx.fillRect(x, -18, 12, 18);
      D.upright(ctx, c, 0, 14, (ctx) => txt(ctx, 'A    B', 0, 0, '6px sans-serif', '#888'));
    },
  },
  dpdt: {
    name: '钮子开关 (双刀双掷)', en: 'Toggle Switch DPDT', cat: 'control', desig: 'SW', innerShort: true,
    terms: [[-40, -20], [0, -20], [40, -20], [-40, 20], [0, 20], [40, 20]], termNames: ['1A', '1COM', '1B', '2A', '2COM', '2B'], box: [-44, -40, 44, 24],
    props: [{ k: 'up', label: '拨到 B', kind: 'bool', def: false }], label: (c) => (c.props.up ? 'COM→B' : 'COM→A'),
    click(c, app) { c.props.up = !c.props.up; app.dirty = true; app.changed(); },
    shorted: (c) => (c.props.up ? [[1, 2], [4, 5]] : [[1, 0], [4, 3]]),
    build(c, n, m) { if (c.props.up) { m.addR(n[1], n[0], G_OFF); m.addR(n[4], n[3], G_OFF); } else { m.addR(n[1], n[2], G_OFF); m.addR(n[4], n[5], G_OFF); } c._p = null; },
    measure(c) { c._m.V = 0; c._m.I = 0; c._m.P = 0; },
    readings(c) { return [[_t('common.position'), c.props.up ? _t('dpdt.b_1com_1b_2com_2b_connected') : _t('dpdt.a_1com_1a_2com_2a_connected')]]; },
    draw(ctx, c) {
      for (const [x, y] of DEFS.dpdt.terms) D.lead(ctx, x, y, x * 0.75, y * 0.5);
      ctx.fillStyle = D.vgrad(ctx, -16, 16, [[0, '#3a3f46'], [1, '#15181c']]); D.rrect(ctx, -34, -14, 68, 28, 3); ctx.fill();
      ctx.fillStyle = D.vgrad(ctx, -10, 10, [[0, '#f0f2f4'], [1, '#8a9099']]); ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
      const a = c.props.up ? 0.55 : -0.55; ctx.save(); ctx.rotate(a); ctx.fillStyle = D.vgrad(ctx, -34, 0, [[0, '#fff'], [1, '#9aa0a8']]); D.rrect(ctx, -3, -36, 6, 34, 3); ctx.fill(); ctx.restore();
      D.upright(ctx, c, 0, 0, (ctx) => { txt(ctx, 'A', -26, 0, 'bold 7px sans-serif', '#bbb'); txt(ctx, 'B', 26, 0, 'bold 7px sans-serif', '#bbb'); });
    },
  },
  rotary: {
    name: '旋转波段开关 (1刀4掷)', en: 'Rotary Switch 1P4T', cat: 'control', desig: 'SW', innerShort: true,
    terms: [[-60, 0], [60, -40], [60, -20], [60, 20], [60, 40]], termNames: ['COM', '1', '2', '3', '4'], box: [-60, -44, 60, 44],
    props: [{ k: 'sel', label: '档位', kind: 'select', num: true, opts: [[1, '1'], [2, '2'], [3, '3'], [4, '4']], def: 1 }], label: (c) => _t('rotary.pos') + c.props.sel,
    click(c, app) { c.props.sel = (+c.props.sel % 4) + 1; app.dirty = true; app.changed(); },
    onWheel(c, dir) { c.props.sel = U.clamp((+c.props.sel || 1) + dir, 1, 4); },
    shorted: (c) => [[0, U.clamp(+c.props.sel || 1, 1, 4)]],
    build(c, n, m) { const s = U.clamp(+c.props.sel || 1, 1, 4); for (let k = 1; k <= 4; k++) if (k !== s) m.addR(n[0], n[k], G_OFF); c._p = null; },
    measure(c) { c._m.V = 0; c._m.I = 0; c._m.P = 0; },
    readings(c) { return [[_t('common.range'), 'COM → ' + c.props.sel], [_t('common.operation'), _t('rotary.click_next_position_wheel_select')]]; },
    draw(ctx, c) {
      D.lead(ctx, -60, 0, -34, 0); for (const [x, y] of DEFS.rotary.terms.slice(1)) D.poly(ctx, [[x, y], [44, y], [30, y * 0.55]]);
      ctx.fillStyle = D.vgrad(ctx, -34, 34, [[0, '#d8dce1'], [1, '#7c838c']]); ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fill();
      const s = U.clamp(+c.props.sel || 1, 1, 4), angs = [-0.93, -0.5, 0.5, 0.93];
      angs.forEach((a, i) => { ctx.fillStyle = i + 1 === s ? '#39d353' : '#555'; ctx.beginPath(); ctx.arc(Math.cos(a) * 27, Math.sin(a) * 27, 2.6, 0, 7); ctx.fill(); });
      const g = ctx.createRadialGradient(-5, -5, 2, 0, 0, 20); g.addColorStop(0, '#666'); g.addColorStop(1, '#111'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill();
      const a = angs[s - 1]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18); ctx.stroke();
      D.upright(ctx, c, 0, 0, (ctx) => txt(ctx, String(s), 0, 0, 'bold 9px sans-serif', '#39d353'));
    },
  },
  dip4: {
    name: 'DIP 拨码开关 (4 位)', en: 'DIP Switch ×4', cat: 'control', desig: 'SW', innerShort: true,
    terms: [0, 1, 2, 3].map(i => [-40 + 20 * i, 40]).concat([0, 1, 2, 3].map(i => [-40 + 20 * i, -40])), termNames: ['1 下', '2 下', '3 下', '4 下', '1 上', '2 上', '3 上', '4 上'], box: [-50, -40, 30, 40],
    props: [1, 2, 3, 4].map(i => ({ k: 's' + i, label: '开关 ' + i + ' ON', kind: 'bool', def: false })),
    label: (c) => [1, 2, 3, 4].map(i => (c.props['s' + i] ? '1' : '0')).join(''),
    click(c, app, lx) { const i = U.clamp(Math.round((lx + 40) / 20), 0, 3) + 1; c.props['s' + i] = !c.props['s' + i]; app.dirty = true; app.changed(); },
    shorted: (c) => { const r = []; for (let i = 0; i < 4; i++) if (c.props['s' + (i + 1)]) r.push([i, i + 4]); return r.length ? r : null; },
    build(c, n, m) { for (let i = 0; i < 4; i++) if (!c.props['s' + (i + 1)]) m.addR(n[i], n[i + 4], G_OFF); c._p = null; },
    measure(c) { c._m.V = 0; c._m.I = 0; c._m.P = 0; },
    readings(c) { return [[_t('dip4.state_1_4'), [1, 2, 3, 4].map(i => (c.props['s' + i] ? 'ON' : 'off')).join(' ')], [_t('common.operation'), _t('dip4.click_a_lever_to_toggle_it')]]; },
    draw(ctx, c) {
      for (const [x, y] of DEFS.dip4.terms) D.lead(ctx, x, y, x, y * 0.55);
      ctx.fillStyle = D.vgrad(ctx, -22, 22, [[0, '#2f6fd6'], [1, '#173f8c']]); D.rrect(ctx, -50, -22, 80, 44, 3); ctx.fill();
      for (let i = 0; i < 4; i++) {
        const x = -40 + 20 * i, on = c.props['s' + (i + 1)]; ctx.fillStyle = '#e8e8e8'; ctx.fillRect(x - 5, -13, 10, 26);
        ctx.fillStyle = '#222'; ctx.fillRect(x - 4, on ? -12 : 1, 8, 11);
        D.upright(ctx, c, x, 17, (ctx) => txt(ctx, String(i + 1), 0, 0, 'bold 6px sans-serif', '#fff'));
      }
      D.upright(ctx, c, -10, -17, (ctx) => txt(ctx, 'ON ↑', 0, 0, 'bold 6px sans-serif', '#fff'));
    },
  },

  // ======================= outputs =======================
  seg7cc: {
    name: '七段数码管 (单位, 段驱动)', en: '7-Segment Digit (segment pins)', cat: 'light', desig: 'DS', innerShort: true,
    terms: [[-40, -60], [-20, -60], [0, -60], [20, -60], [40, -60], [-40, 60], [-20, 60], [0, 60], [20, 60], [40, 60]],
    termNames: ['g', 'f', 'COM 公共端', 'a', 'b', 'e', 'd', 'COM 公共端', 'c', 'dp'], box: [-46, -60, 46, 60],
    props: [{ k: 'ca', label: '共阳极 (CA)', kind: 'bool', def: false }, { k: 'color', label: '颜色', kind: 'select', opts: [['red', '红 Red'], ['green', '绿 Green'], ['blue', '蓝 Blue'], ['yellow', '黄 Yellow']], def: 'red' },
      { k: 'Imax', label: '每段最大电流', unit: 'A', def: 0.03, min: 1e-4 }],
    SEGPIN: { a: 3, b: 4, c: 8, d: 6, e: 5, f: 1, g: 0, dp: 9 },
    label: (c) => (c.props.ca ? _t('seg7cc.ca') : _t('seg7cc.cc')),
    shorted: () => [[2, 7]],
    vf(c) { return { red: 1.9, green: 2.1, blue: 3.0, yellow: 2.0 }[c.props.color] || 1.9; },
    build(c, n, m) {
      const S = DEFS.seg7cc.SEGPIN, Is = ledIs(DEFS.seg7cc.vf(c)), st = c.state; c._d = {};
      if (st.burnt) return;
      for (const k of SEG_ORDER) { const p = n[S[k]]; c._d[k] = c.props.ca ? m.addD(n[2], p, Is, 2 * VT, sub(st, 's' + k)) : m.addD(p, n[2], Is, 2 * VT, sub(st, 's' + k)); }
      c._p = null;
    },
    measure(c) { c._m.V = 0; c._m.P = 0; c._m.I = 0; for (const k of SEG_ORDER) { c._m['I' + k] = c._d[k] ? c._d[k].i : 0; c._m.I += c._m['I' + k]; } },
    post(c, dt, app) {
      const st = c.state; if (st.burnt) return; let mx = 0;
      for (const k of SEG_ORDER) mx = Math.max(mx, ledAvg(st, 'b' + k, c._m['I' + k], dt));
      if (mx > c.props.Imax) { st.over = (st.over || 0) + dt; if (st.over > 0.05) { st.burnt = true; app.dirty = true; app.toast(_t('seg7cc.display_segment_burnt_out_by_excessi')); } } else st.over = 0;
    },
    lit(c) { const st = c.state; let b = 0; SEG_ORDER.forEach((k, i) => { if ((st['b' + k] || 0) > 1e-3) b |= 1 << i; }); return b; },
    digit(c) { const v = DEFS.seg7cc.lit(c) & 0x7f, SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71]; const i = SEG.indexOf(v); return v === 0 ? _t('seg7cc.blank') : i >= 0 ? i.toString(16).toUpperCase() : '?'; },
    readings(c) { const M = c._m; return [[_t('common.display'), DEFS.seg7cc.digit(c) + ((DEFS.seg7cc.lit(c) & 0x80) ? ' .' : '')], [_t('seg7cc.lit_segments'), SEG_ORDER.filter((k, i) => (DEFS.seg7cc.lit(c) >> i) & 1).join(' ') || '—'], [_t('common.total_current'), U.fmt(Math.abs(M.I || 0), 'A')], [_t('common.state'), c.state.burnt ? _t('common.burnt_out') : _t('common.normal')]]; },
    draw(ctx, c) {
      for (const [x, y] of DEFS.seg7cc.terms) D.lead(ctx, x, y, x, y * 0.8);
      ctx.fillStyle = '#1a1c20'; D.rrect(ctx, -44, -48, 88, 96, 4); ctx.fill(); ctx.fillStyle = '#26292e'; D.rrect(ctx, -38, -42, 76, 84, 3); ctx.fill();
      const col = { red: '#ff2a1f', green: '#2bff4a', blue: '#3b8bff', yellow: '#ffd21f' }[c.props.color] || '#ff2a1f', st = c.state;
      D.upright(ctx, c, 0, 0, (ctx) => {
        const W = 30, H = 34, t = 6, sk = 0.1;
        const seg = { a: [-W / 2, -H, W, 0], b: [W / 2, -H, 0, H], c: [W / 2, 0, 0, H], d: [-W / 2, H, W, 0], e: [-W / 2, 0, 0, H], f: [-W / 2, -H, 0, H], g: [-W / 2, 0, W, 0] };
        for (const k of SEG_ORDER.slice(0, 7)) {
          const [x, y, dx, dy] = seg[k], b = st.burnt ? 0 : U.clamp((st['b' + k] || 0) / 0.01, 0, 1);
          ctx.strokeStyle = b > 0.03 ? U.rgba(col, 0.35 + 0.65 * b) : 'rgba(255,255,255,0.07)'; ctx.lineWidth = t; ctx.lineCap = 'round';
          if (b > 0.03) { ctx.shadowColor = col; ctx.shadowBlur = 10 * b; }
          const X = (xx, yy) => xx - yy * sk; ctx.beginPath(); ctx.moveTo(X(x + (dx ? 4 : 0), y + (dy ? 4 : 0)), y + (dy ? 4 : 0)); ctx.lineTo(X(x + dx - (dx ? 4 : 0), y + dy - (dy ? 4 : 0)), y + dy - (dy ? 4 : 0)); ctx.stroke(); ctx.shadowBlur = 0;
        }
        const bd = st.burnt ? 0 : U.clamp((st.bdp || 0) / 0.01, 0, 1); ctx.fillStyle = bd > 0.03 ? col : 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.arc(W / 2 + 6, H, 3.2, 0, 7); ctx.fill();
      });
      ['g', 'f', '⏚', 'a', 'b'].forEach((s, i) => txt(ctx, s, -40 + 20 * i, -45, '6px sans-serif', '#9aa3ad')); ['e', 'd', '⏚', 'c', 'dp'].forEach((s, i) => txt(ctx, s, -40 + 20 * i, 45, '6px sans-serif', '#9aa3ad'));
    },
  },
  ledbar: {
    name: 'LED 光柱 (10 段)', en: 'LED Bar Graph ×10', cat: 'light', desig: 'DS',
    terms: Array.from({ length: 10 }, (_, i) => [-100 + 20 * i, -40]).concat(Array.from({ length: 10 }, (_, i) => [-100 + 20 * i, 40])),
    termNames: Array.from({ length: 10 }, (_, i) => '阳极 ' + (i + 1)).concat(Array.from({ length: 10 }, (_, i) => '阴极 ' + (i + 1))), box: [-110, -40, 90, 40],
    props: [{ k: 'color', label: '颜色', kind: 'select', opts: [['mixed', '绿/黄/红'], ['red', '红'], ['green', '绿'], ['yellow', '黄'], ['blue', '蓝']], def: 'mixed' }, { k: 'Imax', label: '每段最大电流', unit: 'A', def: 0.03, min: 1e-4 }],
    label: () => '',
    segCol(c, i) { const k = c.props.color === 'mixed' ? (i < 6 ? 'green' : i < 8 ? 'yellow' : 'red') : c.props.color; return k; },
    build(c, n, m) {
      c._d = []; const st = c.state; if (st.burnt) return;
      for (let i = 0; i < 10; i++) { const k = DEFS.ledbar.segCol(c, i), vf = { red: 1.9, green: 2.1, yellow: 2.0, blue: 3.0 }[k]; c._d.push(m.addD(n[i], n[i + 10], ledIs(vf), 2 * VT, sub(st, 'd' + i))); }
      c._p = null;
    },
    measure(c) { c._m.V = 0; c._m.P = 0; c._m.I = 0; c._m.Is = (c._d || []).map(d => d.i); for (const i of c._m.Is) c._m.I += i; },
    post(c, dt, app) {
      const st = c.state; if (st.burnt) return; let mx = 0;
      (c._m.Is || []).forEach((I, i) => { mx = Math.max(mx, ledAvg(st, 'b' + i, I, dt)); });
      if (mx > c.props.Imax) { st.over = (st.over || 0) + dt; if (st.over > 0.05) { st.burnt = true; app.dirty = true; app.toast(_t('ledbar.led_bar_graph_burnt_out_by_excessive')); } } else st.over = 0;
    },
    count(c) { let k = 0; for (let i = 0; i < 10; i++) if ((c.state['b' + i] || 0) > 1e-3) k++; return k; },
    readings(c) { return [[_t('ledbar.lit_segments'), DEFS.ledbar.count(c) + ' / 10'], [_t('common.total_current'), U.fmt(Math.abs(c._m.I || 0), 'A')], [_t('common.state'), c.state.burnt ? _t('common.burnt_out') : _t('common.normal')]]; },
    draw(ctx, c) {
      for (const [x, y] of DEFS.ledbar.terms) D.lead(ctx, x, y, x, y * 0.55);
      ctx.fillStyle = '#1a1c20'; D.rrect(ctx, -110, -22, 200, 44, 3); ctx.fill();
      for (let i = 0; i < 10; i++) {
        const x = -100 + 20 * i, hex = BAR_COLORS[DEFS.ledbar.segCol(c, i)], b = c.state.burnt ? 0 : U.clamp((c.state['b' + i] || 0) / 0.01, 0, 1.3);
        if (b > 0.05) glow(ctx, x, 0, 14 + 8 * b, hex, Math.min(1, b));
        ctx.fillStyle = b > 0.05 ? U.rgba(hex, 0.45 + 0.55 * Math.min(1, b)) : U.rgba(hex, 0.14); ctx.fillRect(x - 6, -15, 12, 30);
      }
    },
  },
  servo: {
    name: '舵机 SG90', en: 'Servo SG90', cat: 'light', desig: 'M', terms: [[-80, -20], [-80, 0], [-80, 20]], termNames: ['GND (棕)', 'VCC 5V (红)', 'SIG 信号 (橙)'], box: [-80, -40, 64, 34],
    props: [{ k: 'min', label: '0° 脉宽', unit: 's', def: 1e-3, min: 1e-4 }, { k: 'max', label: '180° 脉宽', unit: 's', def: 2e-3, min: 2e-4 }],
    label: (c) => Math.round(c.state.ang === undefined ? 90 : c.state.ang) + '°',
    build(c, n, m) { const st = c.state; m.addR(n[1], n[0], 1 / 500); c._im = m.addI(n[1], n[0], () => st.im || 0); m.addR(n[2], n[0], 1 / 100e3); c._p = null; },
    measure(c, m) { const n = c._nodes; c._m.Vcc = m.v(n[1]) - m.v(n[0]); c._m.Vs = m.v(n[2]) - m.v(n[0]); c._m.I = c._m.Vcc / 500 + (c.state.im || 0); c._m.V = c._m.Vcc; c._m.P = c._m.V * c._m.I; },
    post(c, dt, app) {
      const st = c.state, M = c._m, t = app.t, v = M.Vs, v0 = st.vprev === undefined ? v : st.vprev;
      st.vhi = Math.max(v, (st.vhi || 0) * (1 - dt / 0.5)); const TH = Math.max(0.8, 0.5 * st.vhi);   // mid-level threshold (3.3 V or 5 V logic)
      if (st.ang === undefined) st.ang = 90;
      const eAt = app._edgeAt && app._edgeAt.get(c._nodes[2]);   // v10: exact edge time of a microcontroller pin
      const cross = () => (eAt !== undefined && eAt > t - dt - 1e-12 && eAt <= t + 1e-12 ? eAt : t - dt * (v - TH) / ((v - v0) || 1e-12));
      if (v0 < TH && v >= TH) { const tr = cross(); if (st.tr !== undefined) st.T = tr - st.tr; st.tr = tr; }
      if (v0 >= TH && v < TH && st.tr !== undefined) { const pw = cross() - st.tr; if (pw > 0.3e-3 && pw < 3e-3) { st.pw = pw; st.tp = t; } }
      st.vprev = v;
      const powered = M.Vcc > 4;
      if (st.pw !== undefined && powered && t - st.tp < 0.1) st.tgt = U.clamp((st.pw - c.props.min) / (c.props.max - c.props.min), 0, 1) * 180;
      const tgt = st.tgt === undefined ? st.ang : st.tgt, e = tgt - st.ang, step = powered ? U.clamp(e, -600 * dt, 600 * dt) : 0;
      st.ang += step; st.moving = Math.abs(e) > 0.5 && powered;
      const want = st.moving ? 0.15 * Math.min(1, Math.abs(e) / 10) : Math.abs(e) > 0.05 && powered ? 0.02 : 0;
      st.im = (st.im || 0) + (want * U.clamp(M.Vcc / 5, 0, 1.2) - (st.im || 0)) * Math.min(1, dt / 0.005);
    },
    readings(c) { const st = c.state; return [[_t('servo.angle'), (st.ang === undefined ? 90 : st.ang).toFixed(1) + '°'], [_t('servo.target_angle'), st.tgt === undefined ? '—' : st.tgt.toFixed(1) + '°'], [_t('servo.pulse_width'), st.pw === undefined ? _t('servo.no_signal') : U.fmt(st.pw, 's')], [_t('servo.signal_period'), st.T ? U.fmt(st.T, 's') + ' (' + U.fmt(1 / st.T, 'Hz') + ')' : '—'], [_t('common.supply'), U.fmt(c._m.Vcc || 0, 'V') + (c._m.Vcc > 4 ? '' : _t('servo.undervoltage_idle'))], [_t('common.current'), U.fmt(c._m.I || 0, 'A')]]; },
    draw(ctx, c) {
      const cols = ['#6b3a1a', '#d62828', '#f28c28'];
      DEFS.servo.terms.forEach(([x, y], i) => { ctx.strokeStyle = cols[i]; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(-58, y * 0.3); ctx.stroke(); });
      ctx.fillStyle = '#222'; ctx.fillRect(-62, -8, 8, 16);
      ctx.fillStyle = D.vgrad(ctx, -22, 22, [[0, '#3a7bd5'], [1, '#1f4f99']]); D.rrect(ctx, -50, -20, 96, 40, 4); ctx.fill();
      ctx.fillStyle = 'rgba(40,90,170,0.9)'; ctx.fillRect(-58, -6, 112, 6);
      ctx.fillStyle = '#e8e8e8'; ctx.beginPath(); ctx.arc(22, 0, 11, 0, 7); ctx.fill();
      const a = ((c.state.ang === undefined ? 90 : c.state.ang) - 90) * Math.PI / 180 - Math.PI / 2;
      ctx.save(); ctx.translate(22, 0); ctx.rotate(a); ctx.fillStyle = '#f7f7f7'; ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-3, -34); ctx.arc(0, -34, 3, Math.PI, 0); ctx.lineTo(5, 0); ctx.arc(0, 0, 5, 0, Math.PI); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#bbb'; for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.arc(0, -7 * k, 1, 0, 7); ctx.fill(); } ctx.restore();
      ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(22, 0, 2.5, 0, 7); ctx.fill();
      D.upright(ctx, c, -16, 10, (ctx) => txt(ctx, 'SG90', 0, 0, 'bold 7px sans-serif', '#fff'));
    },
  },
  fan: {
    name: '散热风扇 (12 V)', en: 'Cooling Fan', cat: 'light', desig: 'M', terms: [[-40, 40], [40, 40]], termNames: ['+ 红', '− 黑'], box: [-40, -38, 40, 40],
    props: [{ k: 'Vr', label: '额定电压', unit: 'V', def: 12, min: 1 }, { k: 'Ir', label: '额定电流', unit: 'A', def: 0.15, min: 1e-3 }, { k: 'rpm', label: '额定转速', unit: 'rpm', def: 3000, min: 1 }],
    label: (c) => Math.round(c.state.rpm || 0) + ' rpm',
    build(c, n, m) { const x = m.newNode(); c._p = m.addD(n[0], x, 1e-9, 1.8 * VT, c.state); m.addR(x, n[1], c.props.Ir / Math.max(0.5, c.props.Vr - 0.6)); },
    post(c, dt) {
      const st = c.state, P = c.props, V = c._m.V, v0 = 0.3 * P.Vr;
      const target = V > v0 ? P.rpm * U.clamp((V - v0 * 0.6) / (P.Vr - v0 * 0.6), 0, 1.3) : (st.rpm || 0) > 1 && V > 0.2 * P.Vr ? P.rpm * U.clamp((V - v0 * 0.6) / (P.Vr - v0 * 0.6), 0, 1.3) : 0;
      st.rpm = (st.rpm || 0) + (target - (st.rpm || 0)) * Math.min(1, dt / 0.8);
      st.ang = ((st.ang || 0) + st.rpm / 60 * 2 * Math.PI * dt) % (2 * Math.PI);
    },
    readings(c) { return [[_t('common.speed'), Math.round(c.state.rpm || 0) + ' rpm'], [_t('common.voltage'), U.fmt(c._m.V || 0, 'V')], [_t('common.current'), U.fmt(c._m.I || 0, 'A')], [_t('common.note'), _t('fan.built_in_reverse_polarity_protection')]]; },
    draw(ctx, c) {
      D.poly(ctx, [[-40, 40], [-40, 32], [-30, 30]]); D.poly(ctx, [[40, 40], [40, 32], [30, 30]]);
      ctx.fillStyle = D.vgrad(ctx, -36, 36, [[0, '#3a3a3a'], [1, '#141414']]); D.rrect(ctx, -36, -36, 72, 72, 6); ctx.fill();
      ctx.fillStyle = '#555'; for (const [x, y] of [[-29, -29], [29, -29], [-29, 29], [29, 29]]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#0c0c0c'; ctx.beginPath(); ctx.arc(0, 0, 32, 0, 7); ctx.fill();
      const rpm = c.state.rpm || 0, a = (c.state.ang || 0) + (rpm > 200 ? (performance.now() / 1000) * Math.min(rpm / 60, 25) * 2 * Math.PI * 0.05 : 0);
      ctx.fillStyle = rpm > 1500 ? 'rgba(80,80,80,0.75)' : '#4a4a4a';
      for (let i = 0; i < 7; i++) { const q = a + i * 2 * Math.PI / 7; ctx.save(); ctx.rotate(q); ctx.beginPath(); ctx.moveTo(8, -3); ctx.quadraticCurveTo(22, -14, 30, -2); ctx.quadraticCurveTo(20, 4, 8, 4); ctx.closePath(); ctx.fill(); ctx.restore(); }
      if (rpm > 1500) { ctx.fillStyle = 'rgba(90,90,90,0.35)'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); D.upright(ctx, c, 0, 0, (ctx) => txt(ctx, U.fmtShort(c.props.Vr, 'V'), 0, 0, 'bold 5px sans-serif', '#bbb'));
    },
  },
  vibmotor: {
    name: '振动马达 (扁平)', en: 'Vibration Motor', cat: 'light', desig: 'M', terms: [[-40, 0], [40, 0]], termNames: ['+ 红', '− 蓝'], box: [-40, -22, 40, 22],
    props: [{ k: 'Vr', label: '额定电压', unit: 'V', def: 3, min: 0.5 }, { k: 'Ir', label: '额定电流', unit: 'A', def: 0.08, min: 1e-3 }],
    label: (c) => ((c.state.vib || 0) > 0.05 ? _t('vibmotor.vibrating') : _t('vibmotor.stopped')),
    build(c, n, m) { c._p = m.addR(n[0], n[1], c.props.Ir / c.props.Vr); },
    post(c, dt) { const V = Math.abs(c._m.V), tg = V > 0.35 * c.props.Vr ? U.clamp(V / c.props.Vr, 0, 1.5) : 0; c.state.vib = (c.state.vib || 0) + (tg - (c.state.vib || 0)) * Math.min(1, dt / 0.1); },
    readings(c) { const v = c.state.vib || 0; return [[_t('vibmotor.vibration_strength'), Math.round(v * 100) + ' %'], [_t('vibmotor.speed_approx'), Math.round(v * 12000) + ' rpm'], [_t('common.voltage'), U.fmt(c._m.V || 0, 'V')], [_t('common.current'), U.fmt(c._m.I || 0, 'A')]]; },
    draw(ctx, c) {
      const v = c.state.vib || 0, j = v > 0.05 ? v * 2 : 0, t = performance.now() / 20, dx = j * Math.sin(t * 3.1), dy = j * Math.cos(t * 2.3);
      ctx.strokeStyle = '#d62828'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.quadraticCurveTo(-26, -2, -14 + dx, 6 + dy); ctx.stroke();
      ctx.strokeStyle = '#1d5fd1'; ctx.beginPath(); ctx.moveTo(40, 0); ctx.quadraticCurveTo(26, -2, 14 + dx, 6 + dy); ctx.stroke();
      const g = ctx.createRadialGradient(-4 + dx, -5 + dy, 2, dx, dy, 18); g.addColorStop(0, '#f4f4f4'); g.addColorStop(1, '#8c9299');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(dx, dy, 18, 0, 7); ctx.fill(); ctx.strokeStyle = '#777'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = '#e8c35a'; ctx.beginPath(); ctx.arc(dx, dy, 7, 0, 7); ctx.fill();
      if (j) { ctx.strokeStyle = 'rgba(120,120,120,0.6)'; ctx.lineWidth = 1; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(0, 0, 22 + 2 * v, s > 0 ? -0.6 : Math.PI - 0.6, s > 0 ? 0.6 : Math.PI + 0.6); ctx.stroke(); } }
    },
  },
});
{ const i = CATEGORIES.findIndex(x => x[0] === 'module'); if (i >= 0) CATEGORIES[i] = ['module', '稳压与电源模块 Regulators']; }
