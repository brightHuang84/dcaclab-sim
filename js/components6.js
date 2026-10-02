'use strict';
// ===== v7: protection parts, ICs, sensors, driver / display modules =====
// varistor (MOV), TVS diode, resettable PPTC fuse, TL431 shunt reference, LM393 dual comparator, active crystal
// oscillator, active / passive buzzers, Hall sensors (A3144 switch, SS49E linear), reed switch, phototransistor,
// 1-channel relay module, 4×4 membrane keypad, LCD1602 character display, L298N dual H-bridge motor driver.

// ---------------- generic helper models ----------------
// conductance held in the device state (changed between time steps by post(): PPTC, relay-module coil, …)
NLMODELS.gvar = function (p) { const g = p.st[p.key] || p.g0 || 1e-12, G = p.G; G[0] = g; G[1] = -g; G[2] = -g; G[3] = g; p.J[0] = 0; p.J[1] = 0; return false; };
// ratiometric output stage, nodes [vcc, gnd, out]: V(out) − V(gnd) → s·(V(vcc) − V(gnd)) through 1/g (s from p.sf())
NLMODELS.ratio = function (p) {
  const s = p.sf(), g = p.g, G = p.G; G.fill(0); p.J.fill(0);
  G[6] = -g * s; G[7] = -g + g * s; G[8] = g;         // out row
  G[3] = g * s; G[4] = g - g * s; G[5] = -g;          // gnd row (returns the output current)
  return false;
};
// open-collector sink, nodes [out, gnd]: I = on·Imax·tanh(vo/Vs) (+ leakage); on ∈ [0,1] from p.onf()
NLMODELS.ocsink = function (p, V) {
  const st = p.st, vr = V[0] - V[1], vo = st.vo === undefined ? vr : clampStep(vr, st.vo, Math.max(0.5, Math.abs(st.vo) * 0.5)); st.vo = vo;
  const on = p.onf(), t = Math.tanh(vo / p.Vs), I = on * p.Imax * t + 1e-9 * vo, g = on * p.Imax * (1 - t * t) / p.Vs + 1e-9;
  const G = p.G; G[0] = g; G[1] = -g; G[2] = -g; G[3] = g; p.J[0] = I - g * vo; p.J[1] = -p.J[0];
  return Math.abs(vo - vr) > 1e-9;
};
// unidirectional power switch with saturation drop (L298 output transistors), nodes [a, b]:
//   I = on/Ron · w·softplus((v − Vd)/w)
NLMODELS.satsw = function (p, V) {
  const on = p.st[p.key] || 0, v = V[0] - V[1], u = (v - p.Vd) / p.w, sp = _softplus(u), sg = _sig(u);
  const I = on / p.Ron * p.w * sp + 1e-9 * v, g = on / p.Ron * sg + 1e-9, G = p.G;
  G[0] = g; G[1] = -g; G[2] = -g; G[3] = g; p.J[0] = I - g * v; p.J[1] = -p.J[0];
  return false;
};
// phototransistor (C, E): Ic = IL·sat(Vce) + Idark, IL set by the light level
NLMODELS.photoq = function (p, V) {
  const st = p.st, vr = V[0] - V[1], vce = st.vce === undefined ? U.clamp(vr, -1, 1) : clampStep(vr, st.vce, Math.max(p.Vs, 0.5 * Math.abs(st.vce))); st.vce = vce;
  const IL = p.ILf() + p.Idark, [s, ds] = optoSat(vce, p.Vs), I = IL * s + 1e-9 * vce, g = IL * ds + 1e-9, G = p.G;
  G[0] = g; G[1] = -g; G[2] = -g; G[3] = g; p.J[0] = I - g * vce; p.J[1] = -p.J[0];
  return Math.abs(vce - vr) > 1e-9;
};
// TL431 programmable shunt reference, nodes [K, A, REF]: Ika = sat(gm·w·softplus((Vref − 2.495)/w)) · h(Vka)
NLMODELS.tl431 = function (p, V) {
  const st = p.st, rr = V[2] - V[1], rk = V[0] - V[1];
  const vr = st.vr === undefined ? rr : clampStep(rr, st.vr, 1), vk = st.vk === undefined ? rk : clampStep(rk, st.vk, 5);
  st.vr = vr; st.vk = vk;
  const u = (vr - p.Vref) / p.w, raw = p.gm * p.w * _softplus(u), draw = p.gm * _sig(u);
  const L = softLimit(raw, p.Imax), hs = _sig((vk - 1.0) / 0.08), dhs = hs * (1 - hs) / 0.08;
  const I = hs * L.I + 1e-9 * vk, dIr = hs * L.d * draw, dIk = dhs * L.I + 1e-9;
  const G = p.G; G.fill(0);
  // K row: current into K;  columns K, A, REF
  G[0] = dIk; G[2] = dIr; G[1] = -(dIk + dIr);
  G[3] = -G[0]; G[4] = -G[1]; G[5] = -G[2];
  const J0 = I - (dIk * vk + dIr * vr); p.J[0] = J0; p.J[1] = -J0; p.J[2] = 0;
  p.ika = I;
  return Math.abs(vr - rr) > 1e-9 || Math.abs(vk - rk) > 1e-9;
};
// LM393 comparator (one channel), nodes [IN+, IN−, OUT, GND, VCC]: open-collector sink when IN− > IN+
NLMODELS.cmp393 = function (p, V) {
  const st = p.st, Z = 12;
  let z = (V[1] - V[0]) / p.w, limited = false;
  z = Math.max(-Z, Math.min(Z, z));
  if (st.z !== undefined && Math.abs(z - st.z) > 2) { z = st.z + Math.sign(z - st.z) * 2; limited = true; }
  st.z = z;
  const f = _sig(z), df = f * (1 - f) / p.w * (Math.abs(z) < Z ? 1 : 0.05);
  const vsr = V[4] - V[3], en = _sig((vsr - 1.8) / 0.1), den = en * (1 - en) / 0.1;
  const vr = V[2] - V[3], vo = st.vo === undefined ? vr : clampStep(vr, st.vo, Math.max(0.5, Math.abs(st.vo) * 0.5)); if (vo !== vr) limited = true; st.vo = vo;
  const t = Math.tanh(vo / p.Vs), A = p.Imax * t, I = A * f * en + 1e-9 * vo;
  const dvo = p.Imax * (1 - t * t) / p.Vs * f * en + 1e-9, dvm = A * df * en, dvp = -dvm, dvs = A * f * den;
  const G = p.G, J = p.J; G.fill(0); J.fill(0);
  // OUT row (index 2): columns IN+ 0, IN− 1, OUT 2, GND 3, VCC 4
  G[10] = dvp; G[11] = dvm; G[12] = dvo; G[14] = dvs; G[13] = -(dvp + dvm + dvo + dvs);
  for (let k = 0; k < 5; k++) G[15 + k] = -G[10 + k];
  J[2] = I - (dvm * z * p.w + dvo * vo + dvs * vsr); J[3] = -J[2];   // linearised about the (limited) z: dvp·vp + dvm·vm = dvm·(vm − vp)
  p.isink = I; p.f = f;
  return limited;
};

const MT = (pos) => -100 + 200 * U.clamp(pos, 0, 1);   // magnetic field slider → mT
function drawMagnet(ctx, x, y, a) {   // bar magnet, a = 0…1 opacity
  if (a < 0.05) return; ctx.save(); ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = '#d62828'; ctx.fillRect(x - 14, y - 6, 14, 12); ctx.fillStyle = '#1d5fd1'; ctx.fillRect(x, y - 6, 14, 12);
  txt(ctx, 'N', x - 7, y, 'bold 7px sans-serif', '#fff'); txt(ctx, 'S', x + 7, y, 'bold 7px sans-serif', '#fff'); ctx.restore();
}
function absorbE(c, dt, app, Emax, Pcont, what) {   // surge energy bookkeeping for MOV / TVS; returns true when it just failed
  const st = c.state, P = Math.abs((c._m.V || 0) * (c._m.I || 0));
  st.E = Math.max(0, (st.E || 0) + (P - Pcont) * dt); st.Epk = Math.max(st.Epk || 0, st.E);
  st.Ipk = Math.max(st.Ipk || 0, Math.abs(c._m.I || 0)); if (Math.abs(c._m.I || 0) > 0.01) st.Vcl = Math.max(st.Vcl || 0, Math.abs(c._m.V || 0));
  if (!st.burnt && st.E > Emax) { st.burnt = true; app.dirty = true; app.toast('💥 ' + what + ' 吸收能量 ' + U.fmt(st.E, 'J') + ' 超过额定 ' + U.fmt(Emax, 'J') + '，已击穿短路（通常会使上游保险丝熔断）'); return true; }
  return false;
}

const MOV_PARTS = { '07D220K': [22, 8.9, 1.5, 0.02], '10D390K': [39, 10, 4, 0.05], '10D471K': [470, 15, 45, 0.4], '14D471K': [470, 16.7, 100, 0.6], '14D681K': [680, 16.7, 140, 0.6] };   // V1mA, α, Emax (J), P (W)
const TVS_PARTS = { 'SMBJ5.0A': [6.4, 9.2, 65.2, 0], 'SMBJ12A': [13.3, 19.9, 30.2, 0], 'SMBJ24A': [26.7, 38.9, 15.4, 0], 'SMBJ5.0CA': [6.4, 9.2, 65.2, 1], 'P6KE15CA': [14.3, 21.2, 28, 1] };  // Vbr, Vc, Ipp, bidirectional
const PPTC_PARTS = { 'MF-R010': [0.1, 0.2, 2.5], 'MF-R050': [0.5, 1.0, 0.18], 'MF-R110': [1.1, 2.2, 0.1], 'MF-R250': [2.5, 5.0, 0.035] };   // Ihold, Itrip, R
const presetProp = (tbl, def) => ({ k: 'part', label: '型号 Part No.', kind: 'select', opts: Object.keys(tbl).map(k => [k, k]), def });

Object.assign(DEFS, {
  // ======================= protection =======================
  mov: {
    name: '压敏电阻 (MOV)', en: 'Varistor (MOV)', cat: 'protect', desig: 'RV', terms: [[-40, 0], [40, 0]], termNames: ['1', '2'], box: [-40, -22, 40, 18],
    props: [presetProp(MOV_PARTS, '14D471K'), { k: 'V1', label: '压敏电压 V1mA', unit: 'V', def: 470, min: 1 }, { k: 'alpha', label: '非线性系数 α (指数形式)', unit: '', def: 16.7, min: 2, max: 60 },
      { k: 'Emax', label: '最大能量', unit: 'J', def: 100, min: 1e-3 }, { k: 'Pc', label: '额定功耗', unit: 'W', def: 0.6, min: 1e-3 }],
    onProp(c, k) { if (k === 'part' && MOV_PARTS[c.props.part]) { const [V1, a, E, P] = MOV_PARTS[c.props.part]; Object.assign(c.props, { V1, alpha: a, Emax: E, Pc: P }); } },
    label: (c) => c.props.part || U.fmtShort(c.props.V1, 'V'),
    build(c, n, m) {
      const P = c.props, st = c.state;
      if (st.burnt) { c._p = m.addR(n[0], n[1], 1 / 0.5); return; }       // failed short
      const nVt = P.V1 / P.alpha, Is = 1e-3 * Math.exp(-P.alpha);
      c._d1 = m.addD(n[0], n[1], Is, nVt, sub(st, 'f')); c._d2 = m.addD(n[1], n[0], Is, nVt, sub(st, 'r')); c._p = null;
    },
    measure(c) { c._m.I = c.state.burnt ? c._m.V * 2 : (c._d1.i - c._d2.i); c._m.P = Math.abs(c._m.V * c._m.I); },
    post(c, dt, app) { if (!c.state.burnt) absorbE(c, dt, app, c.props.Emax, c.props.Pc, '压敏电阻'); },
    readings(c) {
      const M = c._m, st = c.state, I = Math.abs(M.I || 0);
      return [['端电压', U.fmt(M.V || 0, 'V')], ['电流', U.fmt(I < 1e-9 ? 0 : M.I, 'A')], ['状态', st.burnt ? '已击穿 (短路失效)' : I > 1e-3 ? '钳位导通 Clamping' : '高阻 (待机)'],
        ['峰值电流 / 钳位电压', U.fmt(st.Ipk || 0, 'A') + ' / ' + U.fmt(st.Vcl || 0, 'V')], ['吸收能量', U.fmt(st.E || 0, 'J') + ' / ' + U.fmt(c.props.Emax, 'J')]];
    },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -10, 0); D.lead(ctx, 10, 0, 40, 0);
      const b = c.state.burnt, g = ctx.createRadialGradient(-5, -8, 2, 0, -2, 18);
      g.addColorStop(0, b ? '#6b5a4a' : '#5aa0e8'); g.addColorStop(1, b ? '#2a2018' : '#1d4f9a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -2, 17, 0, 7); ctx.fill();
      if (b) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(5, -6, 5, 0, 7); ctx.fill(); }
      const I = Math.abs(c._m.I || 0); if (!b && I > 0.01) glow(ctx, 0, -2, 22, '#ffd27a', Math.min(0.9, 0.2 + Math.log10(I / 0.01) / 4));
      D.upright(ctx, c, 0, -2, (ctx) => { txt(ctx, (c.props.part || '').slice(0, 3), 0, -5, 'bold 6px sans-serif', '#fff'); txt(ctx, (c.props.part || '').slice(3), 0, 4, 'bold 6px sans-serif', '#fff'); });
    },
  },
  tvs: {
    name: 'TVS 瞬态抑制二极管', en: 'TVS Diode', cat: 'protect', desig: 'D', terms: [[-40, 0], [40, 0]], termNames: ['阳极 A (单向)', '阴极 K (单向)'], box: [-40, -14, 40, 14],
    props: [presetProp(TVS_PARTS, 'SMBJ5.0A'), { k: 'Vbr', label: '击穿电压 Vbr', unit: 'V', def: 6.4, min: 0.5 }, { k: 'Vc', label: '钳位电压 Vc @ Ipp', unit: 'V', def: 9.2, min: 0.6 },
      { k: 'Ipp', label: '峰值脉冲电流 Ipp', unit: 'A', def: 65.2, min: 1e-3 }, { k: 'bidir', label: '双向 (CA)', kind: 'bool', def: false }, { k: 'Emax', label: '最大能量', unit: 'J', def: 1, min: 1e-4 }],
    onProp(c, k) { if (k === 'part' && TVS_PARTS[c.props.part]) { const [Vbr, Vc, Ipp, bi] = TVS_PARTS[c.props.part]; Object.assign(c.props, { Vbr, Vc, Ipp, bidir: !!bi }); } },
    label: (c) => c.props.part || U.fmtShort(c.props.Vbr, 'V'),
    par(c) { const P = c.props, nVz = Math.max(0.02, (Math.max(P.Vc, P.Vbr * 1.01) - P.Vbr) / Math.log(Math.max(P.Ipp, 0.02) / 0.01)); return { nVz, Isz: 0.01 }; },
    build(c, n, m) {
      const P = c.props, st = c.state; if (st.burnt) { c._p = m.addR(n[0], n[1], 1 / 0.2); return; }
      const { nVz, Isz } = DEFS.tvs.par(c);
      if (P.bidir) { const Is = Isz * Math.exp(-P.Vbr / nVz); c._d1 = m.addD(n[0], n[1], Is, nVz, sub(st, 'f')); c._d2 = m.addD(n[1], n[0], Is, nVz, sub(st, 'r')); }
      else { c._d1 = m.addD(n[0], n[1], 1e-12, 1.6 * VT, sub(st, 'f'), P.Vbr, Isz, nVz); c._d2 = null; }
      c._p = null;
    },
    measure(c) { c._m.I = c.state.burnt ? c._m.V * 5 : c._d1.i - (c._d2 ? c._d2.i : 0); c._m.P = Math.abs(c._m.V * c._m.I); },
    post(c, dt, app) { if (!c.state.burnt) absorbE(c, dt, app, c.props.Emax, 5, 'TVS 二极管'); },
    readings(c) {
      const M = c._m, st = c.state, I = M.I || 0, P = c.props;
      const mode = st.burnt ? '已击穿 (短路失效)' : Math.abs(I) < 1e-4 ? '截止 (待机)' : (!P.bidir && I > 0) ? '正向导通' : '雪崩钳位 Clamping';
      return [[P.bidir ? '端电压' : 'K−A 电压', U.fmt(P.bidir ? (M.V || 0) : -(M.V || 0), 'V')], ['电流', U.fmt(Math.abs(I) < 1e-9 ? 0 : I, 'A')], ['状态', mode], ['峰值电流 / 钳位电压', U.fmt(st.Ipk || 0, 'A') + ' / ' + U.fmt(st.Vcl || 0, 'V')], ['吸收能量', U.fmt(st.E || 0, 'J')]];
    },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -14, 0); D.lead(ctx, 14, 0, 40, 0);
      ctx.fillStyle = c.state.burnt ? '#3a2a20' : D.vgrad(ctx, -9, 9, [[0, '#555'], [1, '#111']]); D.rrect(ctx, -14, -9, 28, 18, 2); ctx.fill();
      if (!c.props.bidir) { ctx.fillStyle = '#ddd'; ctx.fillRect(8, -9, 3, 18); }
      ctx.fillStyle = '#c9a53a'; ctx.fillRect(-17, -5, 3, 10); ctx.fillRect(14, -5, 3, 10);
      D.upright(ctx, c, 0, 0, (ctx) => txt(ctx, c.props.bidir ? 'TVS↔' : 'TVS', 0, 0, 'bold 6px sans-serif', '#eee'));
      const I = Math.abs(c._m.I || 0); if (!c.state.burnt && I > 0.05) glow(ctx, 0, 0, 18, '#ffb347', Math.min(0.8, 0.2 + Math.log10(I / 0.05) / 3));
    },
  },
  pptc: {
    name: '自恢复保险丝 PPTC', en: 'Resettable Fuse (PPTC)', cat: 'protect', desig: 'F', terms: [[-40, 0], [40, 0]], termNames: ['1', '2'], box: [-40, -18, 40, 18],
    props: [presetProp(PPTC_PARTS, 'MF-R050'), { k: 'Ih', label: '维持电流 Ihold', unit: 'A', def: 0.5, min: 1e-3 }, { k: 'It', label: '动作电流 Itrip', unit: 'A', def: 1.0, min: 2e-3 }, { k: 'R0', label: '常温电阻', unit: 'Ω', def: 0.18, min: 1e-4 }],
    onProp(c, k) { if (k === 'part' && PPTC_PARTS[c.props.part]) { const [Ih, It, R0] = PPTC_PARTS[c.props.part]; Object.assign(c.props, { Ih, It, R0 }); } },
    label: (c) => c.props.part || U.fmtShort(c.props.Ih, 'A'),
    th(c) {   // thermal constants: run-away just above (Ihold+Itrip)/2, ~1 s to trip at 5·Ihold, R rises ×10⁴ around 125 °C
      const P = c.props, Ic = 0.5 * (P.Ih + Math.max(P.It, P.Ih * 1.05)), Tsw = 125, w = 3;
      return { Rth: (Tsw - 25 - 3 * w) / (Ic * Ic * P.R0), Cth: 1.0 * 25 * P.Ih * P.Ih * P.R0 / (Tsw - 25), Tsw, w };
    },
    R(c) { const st = c.state, k = DEFS.pptc.th(c), T = st.T === undefined ? 25 : st.T; return c.props.R0 * (1 + Math.min(2e5, Math.exp((T - k.Tsw) / k.w))); },
    build(c, n, m) { c.state.g = 1 / DEFS.pptc.R(c); c._q = m.addNL('gvar', [n[0], n[1]], { key: 'g' }, c.state); c._p = null; },
    measure(c) { c._m.I = (c.state.g || 0) * c._m.V; c._m.P = c._m.V * c._m.I; },
    post(c, dt, app) {
      const st = c.state, k = DEFS.pptc.th(c); st.T = st.T === undefined ? 25 : st.T;
      const P = Math.abs(c._m.P || 0), T1 = st.T + dt * (P - (st.T - 25) / k.Rth) / k.Cth;
      const was = st.T > k.Tsw; st.T = U.clamp(T1, 25, 250); st.g = 1 / DEFS.pptc.R(c);
      if (!was && st.T > k.Tsw) { st.trips = (st.trips || 0) + 1; app.toast('🔶 自恢复保险丝动作 (过流 → 高阻)，断电冷却后自动恢复'); }
    },
    readings(c) {
      const st = c.state, T = st.T === undefined ? 25 : st.T, R = DEFS.pptc.R(c), trip = T > DEFS.pptc.th(c).Tsw;
      return [['电流', U.fmt(Math.abs(c._m.I || 0) < 1e-9 ? 0 : c._m.I, 'A')], ['压降', U.fmt(c._m.V || 0, 'V')], ['电阻', U.fmt(R, 'Ω')], ['温度', T.toFixed(0) + ' °C'],
        ['状态', trip ? '已动作 Tripped (高阻限流)' : T > 60 ? '发热中…' : '正常 (低阻)'], ['Ihold / Itrip', U.fmt(c.props.Ih, 'A') + ' / ' + U.fmt(c.props.It, 'A')]];
    },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -14, 0); D.lead(ctx, 14, 0, 40, 0);
      const T = c.state.T || 25, f = U.clamp((T - 25) / 110, 0, 1);
      ctx.fillStyle = D.vgrad(ctx, -14, 14, [[0, f > 0.8 ? '#ffb15c' : '#ffe066'], [1, f > 0.8 ? '#c4581a' : '#c9a227']]); D.rrect(ctx, -14, -15, 28, 30, 5); ctx.fill();
      if (f > 0.5) glow(ctx, 0, 0, 22, '#ff7a00', (f - 0.5));
      D.upright(ctx, c, 0, 0, (ctx) => { txt(ctx, 'PPTC', 0, -4, 'bold 6px sans-serif', '#4a3a00'); txt(ctx, U.fmtShort(c.props.Ih, 'A'), 0, 5, '6px sans-serif', '#4a3a00'); });
    },
  },

  // ======================= ICs =======================
  tl431: {
    name: '可调基准 TL431', en: 'Shunt Reference TL431', cat: 'semi', desig: 'U', terms: [[-20, 20], [0, 20], [20, 20]], termNames: ['REF 参考', 'A 阳极', 'K 阴极'], box: [-20, -30, 20, 20],
    props: [{ k: 'Vref', label: '基准电压 Vref', unit: 'V', def: 2.495, min: 1, max: 3 }],
    label: () => 'TL431',
    build(c, n, m) {
      c._q = m.addNL('tl431', [n[2], n[1], n[0]], { Vref: c.props.Vref, w: 0.005, gm: 10, Imax: 0.15 }, c.state);
      m.addR(n[0], n[1], 1 / 1.25e6);                                   // ≈ 2 µA REF input current
      c._d = m.addD(n[1], n[2], 1e-12, 1.6 * VT, sub(c.state, 'bd'));  // anode → cathode substrate diode
      c._p = null;
    },
    measure(c, m) { const n = c._nodes; c._m.Vka = m.v(n[2]) - m.v(n[1]); c._m.Vref = m.v(n[0]) - m.v(n[1]); c._m.Ika = (c._q.ika || 0) - c._d.i; c._m.V = c._m.Vka; c._m.I = c._m.Ika; c._m.P = Math.abs(c._m.Vka * c._m.Ika); },
    readings(c) {
      const M = c._m, I = M.Ika || 0;
      return [['阴极电压 Vka', U.fmt(M.Vka || 0, 'V')], ['阴极电流 Ika', U.fmt(Math.abs(I) < 1e-9 ? 0 : I, 'A')], ['REF−A 电压', U.fmt(M.Vref || 0, 'V')],
        ['状态', I > 1e-3 ? '稳压 Regulating (Ika ≥ 1 mA)' : I > 1e-5 ? '电流过小 (需 ≥1 mA)' : '截止 Off'], ['公式', 'Vka = Vref·(1 + R1/R2)']];
    },
    draw(ctx, c) { drawTO92(ctx, c, ['TL431', 'R A K']); },
  },
  lm393: {
    name: '双比较器 LM393', en: 'Dual Comparator LM393', cat: 'semi', desig: 'U',
    terms: [[-30, 30], [-10, 30], [10, 30], [30, 30], [30, -30], [10, -30], [-10, -30], [-30, -30]],
    termNames: ['1 OUT A', '2 IN− A', '3 IN+ A', '4 GND', '5 IN+ B', '6 IN− B', '7 OUT B', '8 VCC'], box: [-40, -30, 40, 30],
    props: [{ k: 'Imax', label: '输出灌电流', unit: 'A', def: 0.016, min: 1e-4 }],
    label: () => 'LM393',
    build(c, n, m) {
      const P = { w: 1e-3, Imax: c.props.Imax, Vs: 0.12 };
      c._a = m.addNL('cmp393', [n[2], n[1], n[0], n[3], n[7]], Object.assign({}, P), sub(c.state, 'a'));
      c._b = m.addNL('cmp393', [n[4], n[5], n[6], n[3], n[7]], Object.assign({}, P), sub(c.state, 'b'));
      m.addR(n[7], n[3], 1 / 12.5e3);   // ≈ 0.4 mA supply current at 5 V
      c._p = null;
    },
    measure(c, m) {
      const n = c._nodes, M = c._m, g = m.v(n[3]);
      M.Vcc = m.v(n[7]) - g; M.oa = m.v(n[0]) - g; M.ob = m.v(n[6]) - g; M.ia = c._a.isink || 0; M.ib = c._b.isink || 0;
      M.da = m.v(n[2]) - m.v(n[1]); M.db = m.v(n[4]) - m.v(n[5]); M.V = M.Vcc; M.I = M.Vcc / 12.5e3 + M.ia + M.ib; M.P = M.Vcc * M.Vcc / 12.5e3 + M.oa * M.ia + M.ob * M.ib;
    },
    readings(c) {
      const M = c._m, st = (d, i) => (Math.abs(d) < 2e-3 ? '临界' : d < 0 ? '输出低 (导通灌电流 ' + U.fmt(i, 'A') + ')' : '输出高阻 (需上拉)');
      return [['VCC', U.fmt(M.Vcc || 0, 'V') + ((M.Vcc || 0) < 2 ? ' (欠压)' : '')], ['A: IN+ − IN−', U.fmt(M.da || 0, 'V')], ['A: 输出', U.fmt(M.oa || 0, 'V') + ' · ' + st(M.da || 0, M.ia || 0)],
        ['B: IN+ − IN−', U.fmt(M.db || 0, 'V')], ['B: 输出', U.fmt(M.ob || 0, 'V') + ' · ' + st(M.db || 0, M.ib || 0)], ['说明', '集电极开路输出：OUT 需接上拉电阻到 VCC']];
    },
    draw(ctx, c) {
      for (const [x, y] of DEFS.lm393.terms) D.lead(ctx, x, y, x, Math.sign(y) * 16);
      ctx.fillStyle = D.vgrad(ctx, -16, 16, [[0, '#3a3a3a'], [1, '#111']]); D.rrect(ctx, -40, -16, 80, 32, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(-34, 10, 2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(-40, 0, 4, -Math.PI / 2, Math.PI / 2); ctx.fill();
      D.upright(ctx, c, 0, 0, (ctx) => { txt(ctx, 'LM393', 0, -3, 'bold 8px sans-serif', '#e8e8e8'); txt(ctx, '1↓  …  8↑', 0, 7, '5px sans-serif', '#999'); });
    },
  },
  xosc: {
    name: '有源晶振', en: 'Crystal Oscillator Module', cat: 'logic', desig: 'Y', terms: [[-20, 30], [0, 30], [20, 30]], termNames: ['VCC', 'GND', 'OUT 输出'], box: [-30, -24, 30, 30],
    props: [{ k: 'f', label: '频率', kind: 'select', num: true, opts: [[1, '1 Hz (32.768k÷2¹⁵)'], [50, '50 Hz'], [100, '100 Hz'], [1000, '1 kHz'], [32768, '32.768 kHz'], [1e6, '1 MHz'], [8e6, '8 MHz'], [16e6, '16 MHz']], def: 1000 }],
    label: (c) => U.fmtShort(c.props.f, 'Hz'),
    // fraction of [t0, t1] during which the 50 % square wave is high (box-filtered: exact average at any frequency)
    frac(f, t0, t1) { const F = (t) => { const k = Math.floor(t * f), r = t * f - k; return (k * 0.5 + Math.min(r, 0.5)) / f; }; return t1 > t0 ? U.clamp((F(t1) - F(t0)) / (t1 - t0), 0, 1) : (t0 * f % 1 < 0.5 ? 1 : 0); },
    build(c, n, m) {
      const st = c.state; if (st.s === undefined) st.s = 0;
      c._q = m.addNL('ratio', [n[0], n[1], n[2]], { g: 1 / 50, sf: () => st.s }, st); m.addR(n[0], n[1], 1 / 500); c._p = null;
    },
    measure(c, m) { const n = c._nodes; c._m.Vcc = m.v(n[0]) - m.v(n[1]); c._m.Vo = m.v(n[2]) - m.v(n[1]); c._m.V = c._m.Vo; c._m.I = c._m.Vcc / 500; },
    post(c, dt, app) { const ok = (c._m.Vcc || 0) > 2.5; c.state.s = ok ? DEFS.xosc.frac(c.props.f, app.t, app.t + app.dt) : 0; c.state.ok = ok; },
    readings(c) {
      const f = c.props.f, ny = 0.5 / (window.app ? app.dt : 2e-4);
      return [['频率', U.fmt(f, 'Hz')], ['电源', U.fmt(c._m.Vcc || 0, 'V') + (c.state.ok ? '' : ' (未起振)')], ['输出', U.fmt(c._m.Vo || 0, 'V')],
        ['说明', f > ny ? '高于仿真带宽 (Δt=' + U.fmt(app.dt, 's') + ')：输出为每步平均电平 ≈ VCC/2' : '方波 50% 占空比']];
    },
    draw(ctx, c) {
      for (const [x] of DEFS.xosc.terms) D.lead(ctx, x, 30, x, 14);
      ctx.fillStyle = D.vgrad(ctx, -22, 14, [[0, '#f4f5f6'], [0.5, '#c5cad0'], [1, '#868d96']]); D.rrect(ctx, -28, -22, 56, 36, 4); ctx.fill();
      ctx.strokeStyle = '#7a8088'; ctx.lineWidth = 0.8; ctx.stroke(); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.moveTo(-28, 8); ctx.lineTo(-22, 14); ctx.lineTo(-28, 14); ctx.fill();
      const f = c.props.f, s = f >= 1e6 ? (f / 1e6).toFixed(3) + 'M' : f >= 1e3 ? (f / 1e3).toFixed(3) + 'K' : f + 'Hz';
      D.upright(ctx, c, 0, -4, (ctx) => { txt(ctx, s, 0, -3, 'bold 7px monospace', '#222'); txt(ctx, 'OSC', 0, 7, '6px sans-serif', '#555'); });
      if (c.state.ok) { ctx.fillStyle = (c.state.s || 0) > 0.5 ? '#39d353' : '#1f7a2e'; ctx.beginPath(); ctx.arc(20, -15, 2.2, 0, 7); ctx.fill(); }
    },
  },

  // ======================= buzzers =======================
  abuzzer: {
    name: '有源蜂鸣器', en: 'Active Buzzer (5 V)', cat: 'light', desig: 'BZ', terms: [[-20, 30], [20, 30]], termNames: ['+ (长脚)', '−'], box: [-24, -22, 24, 30],
    props: [{ k: 'Vr', label: '额定电压', unit: 'V', def: 5, min: 1 }, { k: 'Ir', label: '额定电流', unit: 'A', def: 0.03, min: 1e-4 }, { k: 'sound', label: '播放声音 (Web Audio)', kind: 'bool', def: false }],
    label: (c) => (c.state.on ? '♪ 2.3 kHz' : ''),
    build(c, n, m) { const x = m.newNode(); c._p = m.addD(n[0], x, 1e-12, 1.5 * VT, c.state); m.addR(x, n[1], c.props.Ir / Math.max(0.3, c.props.Vr - 0.7)); },
    post(c, dt, app) { const on = (c._m.V || 0) > 0.55 * c.props.Vr; c.state.on = on; const want = on && !!c.props.sound && app.running; if (want !== !!c._osc) toneSound(c, want, 2300); },
    readings(c) { return [['电压', U.fmt(c._m.V || 0, 'V')], ['电流', U.fmt(Math.abs(c._m.I || 0) < 1e-9 ? 0 : c._m.I, 'A')], ['状态', c.state.on ? '鸣响 ♪ (内置振荡 ≈2.3 kHz)' : (c._m.V || 0) < -0.5 ? '反接 — 不响' : '静音'], ['说明', '加直流即响；有极性']]; },
    draw(ctx, c) { drawBuzzerBody(ctx, c, true); },
  },
  pbuzzer: {
    name: '无源蜂鸣器', en: 'Passive Buzzer (16 Ω)', cat: 'light', desig: 'BZ', terms: [[-20, 30], [20, 30]], termNames: ['+', '−'], box: [-24, -22, 24, 30],
    props: [{ k: 'R', label: '线圈电阻', unit: 'Ω', def: 16, min: 0.1 }, { k: 'L', label: '线圈电感', unit: 'H', def: 2e-3, min: 1e-6 }, { k: 'sound', label: '播放声音 (Web Audio)', kind: 'bool', def: false }],
    label: (c) => (c.state.on ? '♪ ' + U.fmtShort(c.state.f, 'Hz') : ''),
    build(c, n, m) { c._p = m.addL(n[0], n[1], c.props.L, c.props.R, c.state); },
    post(c, dt, app) {   // drive frequency from sign changes of the coil current around its running mean
      const st = c.state, I = c._p.i; st.mi = (st.mi === undefined ? I : st.mi + (I - st.mi) * Math.min(1, dt / 0.02));
      const s = I - st.mi > 0 ? 1 : -1; st.win = (st.win || 0) + dt; st.amp = Math.max(st.amp || 0, Math.abs(I - st.mi));
      if (st.sg !== undefined && s !== st.sg) st.zc = (st.zc || 0) + 1; st.sg = s;
      if (st.win >= 0.05) { st.f = (st.zc || 0) / (2 * st.win); st.on = st.f >= 20 && st.amp > 0.005; st.A = st.amp; st.zc = 0; st.win = 0; st.amp = 0; }
      const want = !!st.on && !!c.props.sound && app.running; if (want !== !!c._osc || (want && c._osc && Math.abs(c._osc.frequency.value - st.f) > 5)) toneSound(c, want, st.f);
    },
    readings(c) { const st = c.state; return [['驱动频率', st.on ? U.fmt(st.f, 'Hz') : '—'], ['电流', U.fmt(Math.abs(c._m.I || 0) < 1e-9 ? 0 : c._m.I, 'A')], ['状态', st.on ? '鸣响 ♪ 音调 = 驱动频率' : '无声 (需方波/PWM 驱动；直流不响)'], ['说明', '电磁式，无内置振荡']]; },
    draw(ctx, c) { drawBuzzerBody(ctx, c, false); },
  },

  // ======================= sensors =======================
  hall: {
    name: '霍尔传感器', en: 'Hall Sensor', cat: 'sensor', desig: 'U', terms: [[-20, 20], [0, 20], [20, 20]], termNames: ['VCC', 'GND', 'OUT'], box: [-20, -34, 40, 20], wheel: true,
    props: [{ k: 'part', label: '型号', kind: 'select', opts: [['A3144', 'A3144 开关型 (集电极开路)'], ['49E', 'SS49E 线性型']], def: 'A3144' },
      { k: 'pos', label: '磁场 B (S 极为正)', kind: 'range', def: 0.5, fmt: (v) => Math.round(MT(v)) + ' mT' }],
    label: (c) => Math.round(MT(c.props.pos)) + ' mT',
    click(c, app) { c.props.pos = c.props.pos > 0.6 ? 0.5 : 0.85; app.dirty = true; app.changed(); app.refreshProps && app.sel && app.sel.comp === c && app.refreshProps(); },
    upd(c) { const B = MT(c.props.pos), st = c.state; if (B >= 25) st.on = true; else if (B <= 18) st.on = false; return st.on ? 1 : 0; },   // Bop 25 mT, Brp 18 mT
    build(c, n, m) {
      const st = c.state, lin = c.props.part === '49E';
      if (lin) { c._q = m.addNL('ratio', [n[0], n[1], n[2]], { g: 1 / 50, sf: () => (st.pw === false ? 0 : 0.507 + 0.335 * Math.tanh(0.0028 * MT(c.props.pos) / 0.335)) }, st); m.addR(n[0], n[1], 1 / 830); }
      else { DEFS.hall.upd(c); c._q = m.addNL('ocsink', [n[2], n[1]], { Imax: 0.025, Vs: 0.15, onf: () => (st.on && st.pw !== false ? 1 : 0) }, sub(st, 'o')); m.addR(n[0], n[1], 1 / 1100); }
      c._p = null;
    },
    measure(c, m) { const n = c._nodes; c._m.Vcc = m.v(n[0]) - m.v(n[1]); c._m.Vo = m.v(n[2]) - m.v(n[1]); c._m.V = c._m.Vo; c._m.I = c._m.Vcc / (c.props.part === '49E' ? 830 : 1100); },
    post(c) { DEFS.hall.upd(c); c.state.pw = (c._m.Vcc || 0) > (c.props.part === '49E' ? 2.7 : 3.5); },
    readings(c) {
      const B = MT(c.props.pos), M = c._m, lin = c.props.part === '49E';
      return [['磁场 B', B.toFixed(0) + ' mT'], ['VCC', U.fmt(M.Vcc || 0, 'V')], ['输出', U.fmt(M.Vo || 0, 'V')],
        ['状态', lin ? '线性输出 ≈ VCC/2 + 14 mV/mT' : c.state.on ? '检测到磁场 → OUT 拉低 (导通)' : '无磁场 → OUT 高阻 (需上拉)'], ['操作', '单击 = 磁铁靠近/移开；滚轮 = 调节磁场']];
    },
    draw(ctx, c) { drawTO92(ctx, c, [c.props.part === '49E' ? '49E' : '3144', 'V G O']); const B = MT(c.props.pos); drawMagnet(ctx, 26, -14, Math.abs(B) / 60); if (c.props.part !== '49E' && c.state.on) { ctx.fillStyle = '#39d353'; ctx.beginPath(); ctx.arc(10, 0, 2.2, 0, 7); ctx.fill(); } },
  },
  reed: {
    name: '干簧管', en: 'Reed Switch', cat: 'sensor', desig: 'S', terms: [[-40, 0], [40, 0]], termNames: ['1', '2'], box: [-40, -26, 40, 12], wheel: true, innerShort: true,
    props: [{ k: 'pos', label: '磁铁距离 (近 ← → 远)', kind: 'range', def: 0, fmt: (v) => (v > 0.6 ? '很近' : v > 0.4 ? '中等' : '远') }],
    label: (c) => (DEFS.reed.closed(c) ? '闭合' : '断开'),
    closed(c) { const st = c.state, p = c.props.pos; if (p >= 0.6) st.closed = true; else if (p < 0.4) st.closed = false; return !!st.closed; },   // pull-in / drop-out hysteresis
    click(c, app) { c.props.pos = c.props.pos > 0.5 ? 0 : 0.9; app.dirty = true; app.changed(); if (app.sel && app.sel.comp === c) app.refreshProps(); },
    shorted: (c) => (DEFS.reed.closed(c) ? [[0, 1]] : null),
    build(c, n, m) { if (!DEFS.reed.closed(c)) m.addR(n[0], n[1], G_OFF); c._p = null; },
    measure(c) { c._m.V = 0; c._m.P = 0; },
    readings(c) { return [['触点', DEFS.reed.closed(c) ? '闭合 (磁铁吸合)' : '断开'], ['磁铁', c.props.pos > 0.6 ? '靠近' : c.props.pos > 0.4 ? '中等距离 (保持)' : '远离'], ['电流', U.fmt(Math.abs(c._m.I || 0), 'A')], ['操作', '单击 = 磁铁靠近/移开']]; },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -26, 0); D.lead(ctx, 26, 0, 40, 0);
      ctx.fillStyle = 'rgba(200,230,255,0.45)'; D.rrect(ctx, -26, -6, 52, 12, 6); ctx.fill(); ctx.strokeStyle = 'rgba(120,150,180,0.8)'; ctx.lineWidth = 0.8; ctx.stroke();
      const cl = DEFS.reed.closed(c); ctx.strokeStyle = '#8a8f96'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(3, cl ? 0 : -2.5); ctx.moveTo(26, 0); ctx.lineTo(-3, cl ? 0 : 2.5); ctx.stroke();
      drawMagnet(ctx, 0, -18, U.clamp(c.props.pos * 1.4, 0, 1));
    },
  },
  phototr: {
    name: '光敏三极管', en: 'Phototransistor', cat: 'sensor', desig: 'Q', terms: [[-40, 0], [40, 0]], termNames: ['C 集电极 (短脚)', 'E 发射极'], box: [-40, -18, 40, 16], wheel: true,
    props: [{ k: 'pos', label: '光照 (0…1000 lx)', kind: 'range', def: 0.5, fmt: (v) => Math.round(1000 * v) + ' lx' }, { k: 'S', label: '光电流 @1000 lx', unit: 'A', def: 2e-3, min: 1e-6 }],
    label: (c) => Math.round(1000 * c.props.pos) + ' lx',
    build(c, n, m) { c._q = m.addNL('photoq', [n[0], n[1]], { Vs: 0.12, Idark: 1e-7, ILf: () => c.props.S * U.clamp(c.props.pos, 0, 1.5) }, c.state); c._p = null; },
    measure(c) { const IL = c.props.S * c.props.pos + 1e-7, s = optoSat(c._m.V || 0, 0.12)[0]; c._m.I = IL * s; c._m.P = Math.abs(c._m.V * c._m.I); },
    readings(c) { const M = c._m; return [['光照', Math.round(1000 * c.props.pos) + ' lx'], ['集电极电流', U.fmt(M.I || 0, 'A')], ['Vce', U.fmt(M.V || 0, 'V')], ['状态', c.props.pos < 0.01 ? '暗 (暗电流)' : (M.V || 0) < 0.3 ? '饱和导通' : '线性 (Ic ∝ 光照)']]; },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -12, 0); D.lead(ctx, 12, 0, 40, 0); glow(ctx, 0, 0, 22, '#ffe46a', c.props.pos * 0.45);
      ctx.fillStyle = 'rgba(30,30,40,0.9)'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(-3, -4, 4, 0, 7); ctx.fill();
      ctx.strokeStyle = '#e0a800'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-20, -18); ctx.lineTo(-12, -10); ctx.moveTo(-12, -20); ctx.lineTo(-5, -12); ctx.stroke();
      D.upright(ctx, c, 0, 0, (ctx) => txt(ctx, 'PT', 0, 0, 'bold 6px sans-serif', '#ccc'));
    },
  },
});

// ======================= modules =======================
function drawBuzzerBody(ctx, c, active) {
  for (const [x] of DEFS.abuzzer.terms) D.lead(ctx, x, 30, x, 12);
  ctx.fillStyle = D.vgrad(ctx, -20, 14, [[0, '#3a3a3a'], [1, '#050505']]); ctx.beginPath(); ctx.arc(0, -4, 19, 0, 7); ctx.fill();
  ctx.fillStyle = active ? '#111' : '#1c3a1c'; ctx.beginPath(); ctx.arc(0, -4, 3.5, 0, 7); ctx.fill();
  if (!active) { ctx.strokeStyle = '#2f8f3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -4, 12, 0, 7); ctx.stroke(); }   // passive: exposed green PCB under the body
  else { ctx.fillStyle = '#eee'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+', -10, -10); }
  if (c.state.on) {
    const k = (performance.now() / 120) % 1; ctx.strokeStyle = 'rgba(255,170,0,0.9)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const r = 21 + ((i + k) % 3) * 4; ctx.globalAlpha = 1 - ((i + k) % 3) / 3; ctx.beginPath(); ctx.arc(0, -4, r, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  D.upright(ctx, c, 0, 8, (ctx) => txt(ctx, active ? 'ACTIVE' : 'PASSIVE', 0, 0, '5px sans-serif', '#888'));
}
function toneSound(c, on, f) {
  try {
    if (on) {
      if (!AUDIO_CTX) AUDIO_CTX = new (window.AudioContext || window.webkitAudioContext)();
      if (c._osc) { c._osc.frequency.value = U.clamp(f, 20, 18000); return; }
      const o = AUDIO_CTX.createOscillator(), g = AUDIO_CTX.createGain();
      o.type = 'square'; o.frequency.value = U.clamp(f, 20, 18000); g.gain.value = 0.04; o.connect(g); g.connect(AUDIO_CTX.destination); o.start();
      c._osc = o; BUZZERS.add(c);
    } else if (c._osc) { c._osc.stop(); c._osc = null; BUZZERS.delete(c); }
  } catch (e) { /* audio unavailable */ }
}
function drawPCB(ctx, x, y, w, h, col) { ctx.fillStyle = col || '#1f5fbf'; D.rrect(ctx, x, y, w, h, 4); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (const [a, b] of [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + h - 5], [x + w - 5, y + h - 5]]) { ctx.beginPath(); ctx.arc(a, b, 2.2, 0, 7); ctx.fill(); } }
function drawScrew(ctx, x, y) { ctx.fillStyle = '#2f7fd6'; ctx.fillRect(x - 8, y - 8, 16, 16); ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill(); ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.stroke(); }
const KEYS = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'];
const L298_LOGIC = ['ENA', 'IN1', 'IN2', 'IN3', 'IN4', 'ENB'];

Object.assign(DEFS, {
  relaymod: {
    name: '继电器模块 (1 路)', en: 'Relay Module 1-ch', cat: 'drive', desig: 'K',
    terms: [[-80, -20], [-80, 0], [-80, 20], [80, -20], [80, 0], [80, 20]], termNames: ['VCC', 'GND', 'IN 信号', 'NO 常开', 'COM 公共端', 'NC 常闭'], box: [-80, -40, 80, 40], innerShort: true,
    props: [{ k: 'trig', label: '触发方式', kind: 'select', opts: [['low', '低电平触发'], ['high', '高电平触发']], def: 'high' }, { k: 'Vcoil', label: '线圈电压', kind: 'select', num: true, opts: [[5, '5 V'], [12, '12 V']], def: 5 }],
    label: (c) => (c.state.on ? '吸合' : '释放'),
    shorted: (c) => (c.state.on ? [[4, 3]] : [[4, 5]]),
    build(c, n, m) {
      const st = c.state, x = m.newNode(), Rc = c.props.Vcoil === 12 ? 400 : 70;
      if (c.props.trig === 'low') { m.addR(n[0], x, 1 / 1000); c._din = m.addD(x, n[2], ledIs(1.2), 1.8 * VT, sub(st, 'din')); }   // opto LED from VCC into IN
      else { m.addR(n[2], x, 1 / 1000); c._din = m.addD(x, n[1], ledIs(1.2), 1.8 * VT, sub(st, 'din')); }                       // IN → 1 k → LED → GND
      st.gc = st.drive ? 1 / Rc : 0; c._coil = m.addNL('gvar', [n[0], n[1]], { key: 'gc', g0: 1e-12 }, st);
      m.addR(n[0], n[1], 1 / 1500);   // power LED
      c._p = null;
    },
    measure(c, m) { const n = c._nodes; c._m.Vcc = m.v(n[0]) - m.v(n[1]); c._m.Iin = c._din.i; c._m.Ic = (c.state.gc || 0) * c._m.Vcc; c._m.V = c._m.Vcc; c._m.I = c._m.Ic + c._m.Vcc / 1500; },
    post(c, dt, app) {
      const st = c.state, M = c._m, Rc = c.props.Vcoil === 12 ? 400 : 70, act = (M.Iin || 0) > 3e-4, ok = (M.Vcc || 0) > 0.7 * c.props.Vcoil;
      st.drive = act && (M.Vcc || 0) > 0.3 * c.props.Vcoil; st.gc = st.drive ? 1 / Rc : 0;
      const want = st.on ? st.drive && (M.Vcc || 0) > 0.1 * c.props.Vcoil : st.drive && ok;   // pull-in needs ≥70 % rated voltage, drop-out < 10 %
      st.tmr = want !== !!st.on ? (st.tmr || 0) + dt : 0;
      if (st.tmr >= (want ? 0.008 : 0.004)) { st.on = want; st.tmr = 0; st.clicks = (st.clicks || 0) + 1; app.dirty = true; }
    },
    readings(c) {
      const M = c._m, st = c.state;
      return [['触点', st.on ? 'COM–NO 吸合' : 'COM–NC 释放'], ['VCC', U.fmt(M.Vcc || 0, 'V')], ['IN 电流', U.fmt(Math.abs(M.Iin || 0) < 1e-9 ? 0 : M.Iin, 'A')], ['线圈电流', U.fmt(M.Ic || 0, 'A')],
        ['触发', c.props.trig === 'low' ? '低电平触发 (IN 接 GND 吸合)' : '高电平触发 (IN 接 VCC 吸合)'], ['动作', '吸合 ~8 ms，释放 ~4 ms']];
    },
    draw(ctx, c) {
      for (const [x, y] of DEFS.relaymod.terms) D.lead(ctx, x, y, Math.sign(x) * 70, y);
      drawPCB(ctx, -72, -38, 144, 76, '#1f5fbf');
      ctx.fillStyle = D.vgrad(ctx, -30, 26, [[0, '#4a90e2'], [1, '#1f4f99']]); D.rrect(ctx, -30, -30, 62, 56, 3); ctx.fill();
      D.upright(ctx, c, 1, -2, (ctx) => { txt(ctx, 'SRD-' + String(c.props.Vcoil).padStart(2, '0') + 'VDC', 0, -8, 'bold 6px sans-serif', '#fff'); txt(ctx, '10A 250VAC', 0, 2, '5px sans-serif', '#dde'); txt(ctx, c.state.on ? '● ON' : '', 0, 12, 'bold 6px sans-serif', '#7CFC00'); });
      for (const y of [-20, 0, 20]) drawScrew(ctx, 58, y);
      for (const y of [-20, 0, 20]) { ctx.fillStyle = '#111'; ctx.fillRect(-70, y - 4, 10, 8); ctx.fillStyle = '#c9a53a'; ctx.fillRect(-68, y - 1.5, 6, 3); }
      ctx.fillStyle = (c._m.Vcc || 0) > 2 ? '#ff3b30' : '#5a1a1a'; ctx.beginPath(); ctx.arc(-46, -28, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = c.state.drive ? '#39d353' : '#1a4a20'; ctx.beginPath(); ctx.arc(-46, 28, 2.6, 0, 7); ctx.fill();
      D.upright(ctx, c, -50, 0, (ctx) => txt(ctx, 'VCC GND IN', 0, 0, '4.5px sans-serif', '#dde'));
    },
  },
  keypad: {
    name: '4×4 矩阵键盘', en: 'Membrane Keypad 4×4', cat: 'control', desig: 'SW', momentary: true, innerShort: true,
    terms: Array.from({ length: 8 }, (_, i) => [-70 + 20 * i, 100]), termNames: ['R1 行1', 'R2 行2', 'R3 行3', 'R4 行4', 'C1 列1', 'C2 列2', 'C3 列3', 'C4 列4'], box: [-80, -84, 80, 100],
    props: [], label: (c) => (c.state.pressed && c.state.key !== undefined ? '按下 ' + KEYS[c.state.key] : ''),
    keyAt(lx, ly) { const col = Math.floor((lx + 72) / 36), row = Math.floor((ly + 78) / 36); return col >= 0 && col < 4 && row >= 0 && row < 4 ? row * 4 + col : -1; },
    pressHit(c, lx, ly) { const k = DEFS.keypad.keyAt(lx, ly); if (k < 0) return false; c.state.key = k; return true; },
    shorted: (c) => (c.state.pressed && c.state.key >= 0 ? [[Math.floor(c.state.key / 4), 4 + (c.state.key % 4)]] : null),
    build(c) { c._p = null; },
    measure(c) { c._m.V = 0; c._m.I = 0; c._m.P = 0; },
    readings(c) { const st = c.state, k = st.pressed && st.key >= 0 ? st.key : -1; return [['按键', k >= 0 ? KEYS[k] : '无'], ['接通', k >= 0 ? 'R' + (Math.floor(k / 4) + 1) + ' – C' + (k % 4 + 1) : '—'], ['说明', '按住按键 = 对应行线与列线接通（矩阵扫描）']]; },
    draw(ctx, c) {
      for (const [x, y] of DEFS.keypad.terms) D.lead(ctx, x, y, x, 90);
      ctx.fillStyle = '#111'; ctx.fillRect(-76, 82, 152, 10); ctx.fillStyle = '#d9d9d9'; ctx.fillRect(-40, 60, 80, 24);
      ctx.fillStyle = D.vgrad(ctx, -84, 62, [[0, '#2b2b2b'], [1, '#141414']]); D.rrect(ctx, -78, -84, 156, 148, 5); ctx.fill();
      const st = c.state;
      for (let k = 0; k < 16; k++) {
        const x = -72 + 36 * (k % 4), y = -78 + 36 * Math.floor(k / 4), on = st.pressed && st.key === k, letter = k % 4 === 3;
        ctx.fillStyle = on ? '#7aa7ff' : letter ? '#d0473c' : k >= 12 ? '#3a78c9' : '#f2f2f2'; D.rrect(ctx, x + 2, y + 2, 32, 32, 4); ctx.fill();
        D.upright(ctx, c, x + 18, y + 18, (ctx) => txt(ctx, KEYS[k], 0, 0, 'bold 13px sans-serif', letter || k >= 12 || on ? '#fff' : '#222'));
      }
    },
  },
  lcd1602: {
    name: 'LCD1602 液晶屏', en: 'LCD1602 Character Display', cat: 'drive', desig: 'LCD',
    terms: Array.from({ length: 16 }, (_, i) => [-150 + 20 * i, -60]), termNames: ['1 VSS 地', '2 VDD +5V', '3 V0 对比度', '4 RS', '5 RW', '6 E', '7 D0', '8 D1', '9 D2', '10 D3', '11 D4', '12 D5', '13 D6', '14 D7', '15 A 背光+', '16 K 背光−'],
    box: [-180, -60, 180, 50],
    props: [{ k: 'line1', label: '第 1 行', kind: 'text', def: 'Hello, World!' }, { k: 'line2', label: '第 2 行 ({V}=VDD, {t}=时间)', kind: 'text', def: 'VDD={V}' },
      { k: 'color', label: '背光颜色', kind: 'select', opts: [['green', '黄绿'], ['blue', '蓝底白字']], def: 'blue' }],
    label: () => '',
    build(c, n, m) {
      if (c.state.burnt) { c._p = null; c._bl = null; return; }
      m.addR(n[1], n[0], 1 / 3300);                                 // logic ≈ 1.5 mA
      m.addR(n[2], n[0], 1 / 22e3);                                  // V0 bias network
      for (let i = 3; i < 14; i++) m.addR(n[i], n[0], 1e-6);         // control / data inputs (1 MΩ)
      const x = m.newNode(); m.addR(n[14], x, 1 / 100);              // on-board 100 Ω backlight resistor (R8)
      c._bl = m.addD(x, n[15], ledIs(3.0), 2 * VT, sub(c.state, 'bl')); c._p = null;
    },
    measure(c, m) { const n = c._nodes; c._m.Vdd = m.v(n[1]) - m.v(n[0]); c._m.Vlcd = m.v(n[1]) - m.v(n[2]); c._m.Ibl = c._bl ? c._bl.i : 0; c._m.V = c._m.Vdd; c._m.I = c._m.Vdd / 3300 + c._m.Ibl; },
    post(c, dt, app) {
      const st = c.state, M = c._m; if (st.burnt) return;
      st.blf = (st.blf || 0) + (Math.max(0, M.Ibl || 0) - (st.blf || 0)) * Math.min(1, dt / 0.02);
      if ((M.Vdd || 0) > 7) { st.burnt = true; app.dirty = true; app.toast('💥 LCD1602 电源电压过高 (>7 V) 已损坏'); }
      st.init = (M.Vdd || 0) >= 4.5 ? true : (M.Vdd || 0) < 2.7 ? false : !!st.init;
    },
    text(c, i) { const M = c._m; return String(c.props['line' + i] || '').replace('{V}', U.fmt(M.Vdd || 0, 'V', 3)).replace('{t}', (window.app ? app.t : 0).toFixed(2) + 's').slice(0, 16).padEnd(16, ' '); },
    contrast(c) { return U.clamp(((c._m.Vlcd || 0) - 3.0) / 1.2, 0, 1); },
    readings(c) {
      const M = c._m, st = c.state, ct = DEFS.lcd1602.contrast(c);
      return [['VDD', U.fmt(M.Vdd || 0, 'V') + (st.init ? '' : ' (未上电/欠压)')], ['对比度 VDD−V0', U.fmt(M.Vlcd || 0, 'V') + (ct <= 0 ? ' (太淡)' : (M.Vlcd || 0) > 4.7 ? ' (太深, 方块)' : ' (正常)')],
        ['背光电流', U.fmt(Math.max(0, M.Ibl || 0), 'A')], ['显示', st.init ? '"' + DEFS.lcd1602.text(c, 1).trim() + '" / "' + DEFS.lcd1602.text(c, 2).trim() + '"' : '—'], ['说明', '字符内容由属性设置 (模拟已由单片机初始化)；V0 接 10k 电位器或经电阻接地']];
    },
    draw(ctx, c) {
      for (const [x, y] of DEFS.lcd1602.terms) D.lead(ctx, x, y, x, -48);
      drawPCB(ctx, -178, -50, 356, 100, '#1d7a3a');
      for (let i = 0; i < 16; i++) { ctx.fillStyle = '#c9a53a'; ctx.beginPath(); ctx.arc(-150 + 20 * i, -42, 2.6, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#1a1a1a'; D.rrect(ctx, -160, -32, 320, 76, 3); ctx.fill();
      const st = c.state, blue = c.props.color === 'blue', bl = st.burnt ? 0 : U.clamp((st.blf || 0) / 0.015, 0, 1);
      const bg = blue ? [20 + 30 * bl, 60 + 90 * bl, 140 + 115 * bl] : [70 + 110 * bl, 90 + 130 * bl, 20 + 20 * bl];
      ctx.fillStyle = 'rgb(' + bg.map(Math.round).join(',') + ')'; ctx.fillRect(-150, -24, 300, 60);
      if (bl > 0.05) glow(ctx, 0, 6, 120, blue ? '#6fa8ff' : '#c8f060', 0.25 * bl);
      const ct = DEFS.lcd1602.contrast(c), on = !st.burnt && st.init, dark = on && (c._m.Vlcd || 0) > 4.7 ? U.clamp(((c._m.Vlcd || 0) - 4.7) / 0.3, 0, 1) : 0;
      D.upright(ctx, c, 0, 6, (ctx) => {
        for (let r = 0; r < 2; r++) {
          const s = on ? DEFS.lcd1602.text(c, r + 1) : '                ';
          for (let i = 0; i < 16; i++) {
            const x = -144 + 18 * i, y = -26 + 28 * r;
            ctx.fillStyle = blue ? 'rgba(0,0,40,' + (0.12 + 0.5 * dark) + ')' : 'rgba(20,40,0,' + (0.1 + 0.6 * dark) + ')'; ctx.fillRect(x, y, 16, 24);
            if (on && ct > 0 && s[i] !== ' ') { ctx.fillStyle = blue ? 'rgba(240,248,255,' + ct + ')' : 'rgba(10,25,0,' + ct + ')'; ctx.font = 'bold 19px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s[i], x + 8, y + 13); }
          }
        }
      });
    },
  },
  l298n: {
    name: 'L298N 电机驱动模块', en: 'L298N Dual H-Bridge', cat: 'drive', desig: 'U',
    terms: [[-120, -20], [-120, 20], [120, -20], [120, 20]].concat(Array.from({ length: 9 }, (_, i) => [-80 + 20 * i, 100])),
    termNames: ['OUT1 (电机A)', 'OUT2 (电机A)', 'OUT3 (电机B)', 'OUT4 (电机B)', '+12V 电源 VS', 'GND', '+5V', 'ENA', 'IN1', 'IN2', 'IN3', 'IN4', 'ENB'], box: [-120, -90, 120, 100],
    props: [{ k: 'ena', label: 'ENA 跳线帽 (常使能)', kind: 'bool', def: true }, { k: 'enb', label: 'ENB 跳线帽 (常使能)', kind: 'bool', def: true }, { k: 'reg', label: '板载 5V 稳压跳线 (VS ≤ 12 V)', kind: 'bool', def: true }],
    label: () => 'L298N',
    build(c, n, m) {
      const st = c.state, VS = n[4], G = n[5], V5 = n[6];
      c._sw = []; c._fd = [];
      for (let k = 0; k < 4; k++) {
        const o = n[k];
        c._sw.push([m.addNL('satsw', [VS, o], { key: 'h' + k, Vd: 0.9, Ron: 0.6, w: 0.05 }, st), m.addNL('satsw', [o, G], { key: 'l' + k, Vd: 0.7, Ron: 0.4, w: 0.05 }, st)]);
        c._fd = c._fd || []; c._fd[k] = [m.addD(o, VS, 7e-9, 1.8 * VT, sub(st, 'fh' + k)), m.addD(G, o, 7e-9, 1.8 * VT, sub(st, 'fl' + k))];   // module flyback diodes
      }
      for (let i = 7; i < 13; i++) m.addR(n[i], G, 1 / 100e3);   // logic inputs (pull-down)
      if (c.props.reg) c._reg = m.addNL('linreg', [VS, V5, G], { Vref: 5, Vdo: 2, Ro: 0.005, Ilim: 0.5, Iq: 0.005 }, sub(st, 'reg')); else c._reg = null;
      m.addR(V5, G, 1 / 200);   // L298 logic supply ≈ 25 mA
      c._p = null;
    },
    logic(c, v) {   // v(i) = pin voltage relative to GND
      const hi = (i) => v(i) > 2.3, P = c.props, ok = v(6) > 4.0, st = c.state, en = [P.ena || hi(7), P.enb || hi(12)], ins = [hi(8), hi(9), hi(10), hi(11)];
      for (let k = 0; k < 4; k++) { const e = ok && en[k >> 1]; st['h' + k] = e && ins[k] ? 1 : 0; st['l' + k] = e && !ins[k] ? 1 : 0; }
      st.en = en; st.ins = ins; st.ok = ok;
    },
    measure(c, m) {
      const n = c._nodes, M = c._m, g = m.v(n[5]);
      M.Vs = m.v(n[4]) - g; M.V5 = m.v(n[6]) - g; M.Va = m.v(n[0]) - m.v(n[1]); M.Vb = m.v(n[2]) - m.v(n[3]);
      const I = (k) => { const [h, l] = c._sw[k], [dh, dl] = c._fd[k]; return h.cur[0] - l.cur[0] - dh.i + dl.i; };   // current out of OUTk into the load
      M.Ia = I(0); M.Ib = I(2); M.V = M.Vs; M.I = 0;
      let P = 0; for (const [h, l] of c._sw) for (const s of [h, l]) P += Math.abs((m.v(s.n[0]) - m.v(s.n[1])) * (s.cur[0] || 0)); M.P = P;
      if (!c.state.en) DEFS.l298n.logic(c, (i) => m.v(n[i]) - g);
    },
    post(c) { const n = c._nodes, net = window.app && app.net; if (!net) return; const g = net.v(n[5]); DEFS.l298n.logic(c, (i) => net.v(n[i]) - g); },
    chan(c, k) {
      const st = c.state; if (!st.ok) return '未供电 (+5V 逻辑电源不足)';
      if (!(st.en || [])[k]) return '停止 (EN 低 → 滑行)';
      const a = st.ins[2 * k], b = st.ins[2 * k + 1];
      return a === b ? '制动 Brake (IN' + (2 * k + 1) + '=IN' + (2 * k + 2) + ')' : a ? '正转 Forward' : '反转 Reverse';
    },
    readings(c) {
      const M = c._m;
      return [['电源 VS / +5V', U.fmt(M.Vs || 0, 'V') + ' / ' + U.fmt(M.V5 || 0, 'V')], ['电机 A', DEFS.l298n.chan(c, 0)], ['A: OUT1−OUT2 / 电流', U.fmt(M.Va || 0, 'V') + ' / ' + U.fmt(M.Ia || 0, 'A')],
        ['电机 B', DEFS.l298n.chan(c, 1)], ['B: OUT3−OUT4 / 电流', U.fmt(M.Vb || 0, 'V') + ' / ' + U.fmt(M.Ib || 0, 'A')], ['芯片损耗', U.fmt(M.P || 0, 'W') + ' (饱和压降约 2 V @1 A)']];
    },
    draw(ctx, c) {
      for (const [x, y] of DEFS.l298n.terms) { if (y === 100) D.lead(ctx, x, y, x, 80); else D.lead(ctx, x, y, Math.sign(x) * 100, y); }
      drawPCB(ctx, -104, -88, 208, 170, '#b3261e');
      ctx.fillStyle = D.vgrad(ctx, -84, -20, [[0, '#2a2a2a'], [1, '#0a0a0a']]); ctx.fillRect(-46, -86, 92, 62);
      ctx.fillStyle = '#3a3a3a'; for (let i = 0; i < 9; i++) ctx.fillRect(-44 + i * 10, -86, 5, 62);
      ctx.fillStyle = '#111'; ctx.fillRect(-30, -24, 60, 22); D.upright(ctx, c, 0, -13, (ctx) => txt(ctx, 'L298N', 0, 0, 'bold 9px sans-serif', '#ddd'));
      for (const y of [-20, 20]) { drawScrew(ctx, -92, y); drawScrew(ctx, 92, y); }
      for (let i = 0; i < 3; i++) drawScrew(ctx, -80 + 20 * i, 70);
      for (let i = 0; i < 6; i++) { const x = -20 + 20 * i; ctx.fillStyle = '#111'; ctx.fillRect(x - 5, 64, 10, 12); ctx.fillStyle = '#c9a53a'; ctx.fillRect(x - 1.5, 66, 3, 8); }
      const P = c.props; ctx.fillStyle = '#111'; if (P.ena) ctx.fillRect(-26, 52, 12, 9); if (P.enb) ctx.fillRect(74, 52, 12, 9); if (P.reg) ctx.fillRect(-60, 30, 9, 12);
      ctx.fillStyle = D.vgrad(ctx, 0, 30, [[0, '#333'], [1, '#111']]); ctx.fillRect(-40, 10, 22, 26); D.upright(ctx, c, -29, 23, (ctx) => txt(ctx, '78M05', 0, 0, '5px sans-serif', '#bbb'));
      ctx.fillStyle = (c._m.V5 || 0) > 4 ? '#ff3b30' : '#4a1010'; ctx.beginPath(); ctx.arc(60, 20, 3, 0, 7); ctx.fill();
      D.upright(ctx, c, 30, 46, (ctx) => txt(ctx, 'ENA IN1 IN2 IN3 IN4 ENB', 0, 0, '5px sans-serif', '#fdd'));
      D.upright(ctx, c, -60, 52, (ctx) => txt(ctx, '12V GND 5V', 0, 0, '5px sans-serif', '#fdd'));
    },
  },
});

CATEGORIES.splice(CATEGORIES.findIndex(x => x[0] === 'basic') + 1, 0, ['sensor', '传感器 Sensors']);
CATEGORIES.splice(CATEGORIES.findIndex(x => x[0] === 'control') + 1, 0, ['protect', '电路保护 Protection']);
CATEGORIES.splice(CATEGORIES.findIndex(x => x[0] === 'light') + 1, 0, ['drive', '驱动与显示模块 Drivers & Displays']);
for (const t of ['ldr', 'ntc']) if (DEFS[t]) DEFS[t].cat = 'sensor';
if (DEFS.fuse) DEFS.fuse.cat = 'protect';
