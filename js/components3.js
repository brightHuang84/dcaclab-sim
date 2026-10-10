'use strict';
// ===== v3 components: op-amp, logic family (gates, switch, clock, probe, D flip-flop, 7-segment),
// P-MOSFET, N-JFET, relay, buzzer, DC motor, photoresistor, thermistor, transformer =====

// ---------- op-amp model: add output current limiting to the generic device ----------
NLMODELS.opamp = function (p, V) {
  const st = p.st, A = p.A, mid = p.mid, h = p.h;
  const vd = V[0] - V[1];
  // step limiting only while inside the transition region; deep in saturation tanh is flat and needs none
  const lim = (u, prev, step) => {
    if (prev === undefined || (Math.abs(u) > 3 && Math.abs(prev) > 3 && u * prev > 0)) return u;
    if (Math.abs(u - prev) <= step) return u;
    let r = prev + Math.sign(u - prev) * step;
    if (Math.abs(r) > 3) r = Math.sign(r) * 3.5;
    return r;
  };
  let limited = false;
  const H = h * p.S; // internal gain-stage swing (≫ rails) → sets the slew rate; x is clamped to the rails below
  const zt = (A * vd - mid) / H, z = lim(zt, st.z, 1);
  if (z !== zt) limited = true;
  st.z = z;
  const th = Math.tanh(z), s0 = mid + H * th, ds = A * (1 - th * th);
  const vd0 = (z * H + mid) / A, g1 = 1 / p.R1, G = p.G, J = p.J;
  G.fill(0); J.fill(0);
  // node x (index 2): the gain stage injects sat(A·vd)/R1  (x has R1 ∥ C1 to ground → dominant pole)
  G[8] = -ds * g1; G[9] = ds * g1; J[2] = -(s0 - ds * vd0) * g1;
  // stiff clamp of x to the output rails (no wind-up, fast recovery from saturation)
  const vx0 = V[2];
  if (vx0 > p.hi) { G[10] += p.Gc; J[2] -= p.Gc * p.hi; } else if (vx0 < p.lo) { G[10] += p.Gc; J[2] -= p.Gc * p.lo; }
  // output (index 3): i_out = Imax·tanh(gout·(v_x − v_out)/Imax)  (Norton output with current limit)
  const vx = V[2], vo = V[3], Im = p.Imax;
  const wt = p.gout * (vx - vo) / Im, w = lim(wt, st.w, 1);
  if (w !== wt) limited = true;
  st.w = w;
  const tw = Math.tanh(w), i0 = Im * tw, gs = p.gout * (1 - tw * tw) + 1e-9;
  const dv0 = w * Im / p.gout; // (vx − vo) at the linearisation point
  // current INTO device at out = −i ≈ −i0 − gs·((vx − vo) − dv0)
  G[14] = -gs; G[15] = gs; J[3] = -i0 + gs * dv0;
  return limited;
};

// ---------- logic helpers ----------
const LOGIC_H = '#e8342a', LOGIC_L = '#2a6fe8', LOGIC_X = '#9aa3ad';
// logic input with hysteresis: 1 above 0.6·Vdd, 0 below 0.4·Vdd, otherwise keeps its previous value
function logicIn(c, i, m) {
  const st = c.state, n = c._nodes, v = m.v(n[i]), vdd = c.props.vdd || 5;
  if (!st.inb) st.inb = [];
  const prev = st.inb[i] || 0;
  st.inb[i] = v > 0.6 * vdd ? 1 : v < 0.4 * vdd ? 0 : prev;
  if (!st.inv) st.inv = [];
  st.inv[i] = v;
  return st.inb[i];
}
// push-pull logic output: Norton source (25 Ω) to ground driven by c.state.out[k]
function logicOut(c, m, node, k, fn) {
  const g = 1 / 25, P = c.props;
  m.addR(node, 0, g);
  return m.addI(0, node, fn || (() => g * ((c.state.out && c.state.out[k]) ? (P.vdd || 5) : 0)));
}
const logicInputR = (m, node) => m.addR(node, 0, 1e-6); // 1 MΩ input pull-down (floating input reads 0)
const VDD_PROP = { k: 'vdd', label: '逻辑电平 Vdd', unit: 'V', def: 5, min: 1 };
function lvlColor(b) { return b === 1 ? LOGIC_H : b === 0 ? LOGIC_L : LOGIC_X; }

function gatePath(ctx, kind) {
  ctx.beginPath();
  if (kind === 'and' || kind === 'nand') { ctx.moveTo(-24, -18); ctx.lineTo(0, -18); ctx.arc(0, 0, 18, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-24, 18); ctx.closePath(); }
  else if (kind === 'not') { ctx.moveTo(-20, -16); ctx.lineTo(14, 0); ctx.lineTo(-20, 16); ctx.closePath(); }
  else { ctx.moveTo(-26, -18); ctx.quadraticCurveTo(-14, 0, -26, 18); ctx.quadraticCurveTo(6, 18, 22, 0); ctx.quadraticCurveTo(6, -18, -26, -18); ctx.closePath(); }
}
const GATE_FN = {
  and: (a, b) => a & b, or: (a, b) => a | b, nand: (a, b) => 1 - (a & b), nor: (a, b) => 1 - (a | b), xor: (a, b) => a ^ b, not: (a) => 1 - a,
};
const GATE_NAMES = { and: ['与门', 'AND'], or: ['或门', 'OR'], not: ['非门', 'NOT'], nand: ['与非门', 'NAND'], nor: ['或非门', 'NOR'], xor: ['异或门', 'XOR'] };
function makeGate(kind) {
  const one = kind === 'not';
  const bubble = kind === 'not' || kind === 'nand' || kind === 'nor';
  return {
    name: GATE_NAMES[kind][0], en: GATE_NAMES[kind][1] + ' Gate', cat: 'logic', desig: 'U',
    terms: one ? [[-40, 0], [40, 0]] : [[-40, -20], [-40, 20], [40, 0]],
    termNames: one ? [_t('parts.input_a'), _t('parts.output_y')] : [_t('parts.input_a'), _t('parts.input_b'), _t('parts.output_y')],
    box: [-34, -24, 34, 24], props: [VDD_PROP], label: () => '',
    build(c, n, m) {
      const k = n.length - 1;
      for (let i = 0; i < k; i++) logicInputR(m, n[i]);
      c._p = logicOut(c, m, n[k], 0);
      if (!c.state.out) c.state.out = [GATE_FN[kind](0, 0)];
    },
    measure(c, m) { const n = c._nodes; c._m.V = m.v(n[n.length - 1]); c._m.I = 0; c._m.P = 0; },
    post(c, dt, app) {
      const k = c._nodes.length - 1, a = logicIn(c, 0, app.net), b = k > 1 ? logicIn(c, 1, app.net) : 0;
      c.state.out = [GATE_FN[kind](a, b)];
    },
    readings(c) { const s = c.state, ins = (s.inb || []).map(b => b ? '1' : '0').join(' '); return [[_t('parts.inputs'), ins || '—'], [_t('parts.output'), s.out ? String(s.out[0]) : '—'], [_t('common.output_voltage'), U.fmt(c._m.V || 0, 'V')]]; },
    draw(ctx, c) {
      const st = c.state;
      if (one) { D.lead(ctx, -40, 0, -20, 0); } else { D.lead(ctx, -40, -20, -22, -20); D.lead(ctx, -40, 20, -22, 20); if (kind === 'xor' || kind === 'or' || kind === 'nor') { D.lead(ctx, -26, -20, -20, -20); D.lead(ctx, -26, 20, -20, 20); } }
      D.lead(ctx, bubble ? (one ? 22 : 29) : 22, 0, 40, 0);
      if (kind === 'xor') { ctx.strokeStyle = '#2b3440'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-32, -18); ctx.quadraticCurveTo(-20, 0, -32, 18); ctx.stroke(); }
      ctx.fillStyle = D.vgrad(ctx, -18, 18, [[0, '#ffffff'], [1, '#dfe6ee']]);
      gatePath(ctx, kind); ctx.fill(); ctx.strokeStyle = '#2b3440'; ctx.lineWidth = 2; ctx.stroke();
      if (bubble) { const bx = one ? 18 : 22 + 3.5; ctx.beginPath(); ctx.arc(bx, 0, 3.8, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke(); }
      // state dots
      const dot = (x, y, b) => { ctx.fillStyle = lvlColor(b); ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); };
      if (st.inb) { if (one) dot(-30, -6, st.inb[0]); else { dot(-34, -26, st.inb[0]); dot(-34, 26, st.inb[1]); } }
      if (st.out) dot(34, -6, st.out[0]);
      D.upright(ctx, c, kind === 'not' ? -6 : -4, 0, (ctx) => { ctx.fillStyle = '#2b3440'; ctx.font = 'bold ' + (kind === 'not' ? 7 : 8) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(GATE_NAMES[kind][1], 0, 0); });
    },
  };
}

Object.assign(DEFS, {
  // ---------------- op-amp ----------------
  opamp: {
    name: '运算放大器', en: 'Op-Amp', cat: 'semi', desig: 'U',
    terms: [[-40, -20], [-40, 20], [40, 0]], termNames: ['反相输入 −', '同相输入 +', '输出 OUT'], box: [-34, -32, 34, 32],
    props: [
      { k: 'vpos', label: '正饱和电压 V+sat', unit: 'V', def: 12 },
      { k: 'vneg', label: '负饱和电压 V−sat', unit: 'V', def: -12 },
      { k: 'A', label: '开环增益 A', unit: '', def: 1e5, min: 10 },
      { k: 'gbw', label: '增益带宽积 GBW (0=理想)', unit: 'Hz', def: 1e6, min: 0 },
      { k: 'imax', label: '输出电流限制', unit: 'A', def: 0.025, min: 1e-4 },
      { k: 'slew', label: '压摆率 Slew rate', unit: 'V/µs', def: 0.5, min: 1e-4 },
    ],
    label: (c) => (c.props.vneg === 0 ? '0…' : '±') + U.fmtShort(c.props.vpos, 'V'),
    build(c, n, m) {
      const P = c.props, x = m.newNode(), R1 = 1, hi = Math.max(P.vpos, P.vneg + 0.1), lo = P.vneg, h = (hi - lo) / 2;
      const C1 = P.gbw > 0 ? P.A / (2 * Math.PI * P.gbw) / R1 : 0;
      // slew rate = max gain-stage current / C1 = S·h/(R1·C1)
      const S = C1 > 0 ? Math.max(1, (P.slew || 0.5) * 1e6 * R1 * C1 / h) : 1e3;
      m.addR(x, 0, 1 / R1);
      if (C1 > 0) m.addC(x, 0, C1, c.state, true);
      c._q = m.addNL('opamp', [n[1], n[0], x, n[2]], { A: P.A, mid: (hi + lo) / 2, h, S, hi, lo, Gc: Math.max(1e3, S * h / 0.01), R1, gout: 1, Imax: P.imax }, c.state);
      c._p = null;
    },
    measure(c, m) { const n = c._nodes; c._m.V = m.v(n[2]); c._m.I = -(c._q.cur[3] || 0); c._m.Vd = m.v(n[1]) - m.v(n[0]); c._m.P = Math.abs(c._m.V * c._m.I); },
    readings(c) {
      const m = c._m, P = c.props, sat = m.V > P.vpos - 0.3 ? _t('opamp.positive_saturation_sat') : m.V < P.vneg + 0.3 ? _t('opamp.negative_saturation_sat') : Math.abs(m.I) > 0.95 * P.imax ? _t('opamp.current_limit') : _t('opamp.linear');
      return [[_t('common.output_voltage_vout'), U.fmt(m.V, 'V')], [_t('common.output_current_iout'), U.fmt(Math.abs(m.I) < 1e-9 ? 0 : m.I, 'A')], [_t('opamp.differential_input_v_v'), U.fmt(Math.abs(m.Vd) < 1e-9 ? 0 : m.Vd, 'V')], [_t('common.state'), sat]];
    },
    draw(ctx, c) {
      D.lead(ctx, -40, -20, -26, -20); D.lead(ctx, -40, 20, -26, 20); D.lead(ctx, 26, 0, 40, 0);
      ctx.fillStyle = D.vgrad(ctx, -30, 30, [[0, '#3c4552'], [1, '#161b22']]);
      ctx.beginPath(); ctx.moveTo(-28, -32); ctx.lineTo(28, 0); ctx.lineTo(-28, 32); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#0b0e12'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath();
      ctx.moveTo(-23, -20); ctx.lineTo(-15, -20); ctx.moveTo(-23, 20); ctx.lineTo(-15, 20); ctx.moveTo(-19, 16); ctx.lineTo(-19, 24); ctx.stroke();
      D.upright(ctx, c, -4, 0, (ctx) => { ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('OP', 0, 0); });
      const v = c._m.V || 0, P = c.props, f = U.clamp((v - P.vneg) / ((P.vpos - P.vneg) || 1), 0, 1);
      ctx.fillStyle = `rgb(${Math.round(40 + 215 * f)},${Math.round(90 + 60 * (1 - Math.abs(f - 0.5) * 2))},${Math.round(255 - 215 * f)})`;
      ctx.beginPath(); ctx.arc(14, 0, 2.6, 0, 7); ctx.fill();
    },
  },

  // ---------------- logic ----------------
  and: makeGate('and'), or: makeGate('or'), not: makeGate('not'), nand: makeGate('nand'), nor: makeGate('nor'), xor: makeGate('xor'),
  lswitch: {
    name: '逻辑开关', en: 'Logic Switch', cat: 'logic', desig: 'SW', terms: [[40, 0]], termNames: ['输出'], box: [-30, -18, 34, 18],
    props: [VDD_PROP, { k: 'on', label: '输出高电平 (1)', kind: 'bool', def: false }],
    label: (c) => (c.props.on ? '1' : '0'),
    build(c, n, m) { c._p = logicOut(c, m, n[0], 0, () => (c.props.on ? (c.props.vdd || 5) / 25 : 0)); },
    measure(c, m) { c._m.V = m.v(c._nodes[0]); c._m.I = 0; c._m.P = 0; },
    click(c, app) { c.props.on = !c.props.on; app.changed(); app.refreshProps(); },
    readings(c) { return [[_t('common.output'), c.props.on ? _t('common.1_high_h') : _t('common.0_low_l')], [_t('common.output_voltage'), U.fmt(c._m.V || 0, 'V')]]; },
    draw(ctx, c) {
      D.lead(ctx, 26, 0, 40, 0);
      ctx.fillStyle = D.vgrad(ctx, -16, 16, [[0, '#f4f6f8'], [1, '#c9d1da']]); D.rrect(ctx, -28, -16, 54, 32, 5); ctx.fill();
      ctx.strokeStyle = '#6b7888'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#2b3440'; D.rrect(ctx, -22, -9, 30, 18, 9); ctx.fill();
      ctx.fillStyle = c.props.on ? LOGIC_H : '#8b95a1'; ctx.beginPath(); ctx.arc(c.props.on ? 1 : -13, 0, 7, 0, 7); ctx.fill();
      D.upright(ctx, c, 17, 0, (ctx) => { ctx.fillStyle = c.props.on ? LOGIC_H : LOGIC_L; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.props.on ? '1' : '0', 0, 0); });
    },
  },
  clock: {
    name: '时钟信号', en: 'Clock', cat: 'logic', desig: 'CLK', terms: [[40, 0]], termNames: ['输出'], box: [-30, -18, 34, 18],
    props: [VDD_PROP, { k: 'f', label: '频率', unit: 'Hz', def: 1, min: 1e-3 }, { k: 'duty', label: '占空比 (0–1)', unit: '', def: 0.5, min: 0.01 }],
    label: (c) => U.fmtShort(c.props.f, 'Hz'),
    level(c, t) { const P = c.props, ph = t * P.f; return ph - Math.floor(ph) < Math.min(P.duty, 0.99) ? 1 : 0; },
    build(c, n, m) { c._p = logicOut(c, m, n[0], 0, (t) => DEFS.clock.level(c, t) * (c.props.vdd || 5) / 25); },
    measure(c, m, app) { c._m.V = m.v(c._nodes[0]); c._m.I = 0; c._m.P = 0; },
    readings(c) { return [[_t('common.output_voltage'), U.fmt(c._m.V || 0, 'V')], [_t('common.frequency'), U.fmt(c.props.f, 'Hz')]]; },
    draw(ctx, c) {
      D.lead(ctx, 26, 0, 40, 0);
      ctx.fillStyle = D.vgrad(ctx, -16, 16, [[0, '#2f3a48'], [1, '#131a22']]); D.rrect(ctx, -28, -16, 54, 32, 5); ctx.fill();
      const hi = (c._m.V || 0) > 2.5;
      ctx.strokeStyle = hi ? '#ff6b5e' : '#6fd3ff'; ctx.lineWidth = 1.8; ctx.beginPath();
      ctx.moveTo(-22, 6); ctx.lineTo(-16, 6); ctx.lineTo(-16, -6); ctx.lineTo(-8, -6); ctx.lineTo(-8, 6); ctx.lineTo(0, 6); ctx.lineTo(0, -6); ctx.lineTo(8, -6); ctx.lineTo(8, 6); ctx.lineTo(14, 6); ctx.stroke();
      ctx.fillStyle = hi ? LOGIC_H : '#334'; ctx.beginPath(); ctx.arc(20, -8, 3, 0, 7); ctx.fill();
    },
  },
  lprobe: {
    name: '逻辑探头', en: 'Logic Probe', cat: 'logic', desig: 'LP', terms: [[0, 20]], termNames: ['输入'], box: [-14, -34, 14, 20],
    props: [VDD_PROP],
    label: () => '',
    build(c, n, m) { logicInputR(m, n[0]); c._p = null; },
    measure(c, m) { c._m.V = m.v(c._nodes[0]); c._m.I = 0; c._m.P = 0; },
    post(c, dt, app) { const v = app.net.v(c._nodes[0]), vdd = c.props.vdd || 5; c.state.lv = v > 0.6 * vdd ? 1 : v < 0.4 * vdd ? 0 : -1; },
    readings(c) { const l = c.state.lv; return [[_t('lprobe.level'), l === 1 ? _t('common.1_high_h') : l === 0 ? _t('common.0_low_l') : _t('lprobe.unknown_x')], [_t('common.voltage'), U.fmt(c._m.V || 0, 'V')]]; },
    draw(ctx, c) {
      D.lead(ctx, 0, 4, 0, 20);
      const l = c.state.lv;
      const col = l === 1 ? '#ff3b30' : l === 0 ? '#34c759' : '#8e98a3';
      glow(ctx, 0, -18, 26, col, l === 1 ? 0.9 : l === 0 ? 0.35 : 0);
      ctx.fillStyle = D.vgrad(ctx, -34, 4, [[0, '#f0f2f5'], [1, '#aeb8c4']]); D.rrect(ctx, -12, -32, 24, 38, 6); ctx.fill();
      ctx.strokeStyle = '#6b7888'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, -18, 8, 0, 7); ctx.fill();
      D.upright(ctx, c, 0, -18, (ctx) => { ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l === 1 ? 'H' : l === 0 ? 'L' : '?', 0, 0.5); });
    },
  },
  dff: {
    name: 'D 触发器', en: 'D Flip-Flop', cat: 'logic', desig: 'U',
    terms: [[-40, -20], [-40, 20], [40, -20], [40, 20]], termNames: ['D', 'CLK ↑', 'Q', 'Q̄'], box: [-30, -36, 30, 36],
    props: [VDD_PROP], label: () => '',
    build(c, n, m) {
      logicInputR(m, n[0]); logicInputR(m, n[1]);
      if (!c.state.out) c.state.out = [0, 1];
      c._p = logicOut(c, m, n[2], 0); logicOut(c, m, n[3], 1);
    },
    measure(c, m) { c._m.V = m.v(c._nodes[2]); c._m.I = 0; c._m.P = 0; },
    post(c, dt, app) {
      const st = c.state, d0 = st.inb ? st.inb[0] || 0 : 0, clk0 = st.inb ? st.inb[1] || 0 : 0;
      logicIn(c, 0, app.net); const clk = logicIn(c, 1, app.net);
      if (clk === 1 && clk0 === 0) st.out = [d0, 1 - d0]; // rising edge: sample D (value just before the edge)
    },
    readings(c) { const s = c.state; return [['D', s.inb ? String(s.inb[0]) : '—'], ['CLK', s.inb ? String(s.inb[1]) : '—'], ['Q', String(s.out ? s.out[0] : 0)]]; },
    draw(ctx, c) {
      D.lead(ctx, -40, -20, -28, -20); D.lead(ctx, -40, 20, -28, 20); D.lead(ctx, 28, -20, 40, -20); D.lead(ctx, 28, 20, 40, 20);
      ctx.fillStyle = D.vgrad(ctx, -34, 34, [[0, '#ffffff'], [1, '#dde4ec']]); D.rrect(ctx, -28, -34, 56, 68, 4); ctx.fill();
      ctx.strokeStyle = '#2b3440'; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-28, 13); ctx.lineTo(-20, 20); ctx.lineTo(-28, 27); ctx.stroke();
      const st = c.state, q = st.out ? st.out[0] : 0;
      ctx.fillStyle = lvlColor(q); ctx.beginPath(); ctx.arc(34, -27, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = lvlColor(1 - q); ctx.beginPath(); ctx.arc(34, 27, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#2b3440'; ctx.font = 'bold 8px sans-serif'; ctx.textBaseline = 'middle';
      ctx.textAlign = 'left'; ctx.fillText('D', -24, -20); ctx.fillText('C', -18, 20);
      ctx.textAlign = 'right'; ctx.fillText('Q', 24, -20); ctx.fillText('Q̄', 24, 20);
      D.upright(ctx, c, 0, 0, (ctx) => { ctx.fillStyle = '#5a6776'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('DFF', 0, 0); });
    },
  },
  seg7: {
    name: '七段数码管', en: '7-Segment (hex)', cat: 'logic', desig: 'DS',
    terms: [[-40, -40], [-40, -20], [-40, 0], [-40, 20]], termNames: ['1 (bit0)', '2 (bit1)', '4 (bit2)', '8 (bit3)'], box: [-32, -58, 36, 38],
    props: [VDD_PROP, { k: 'color', label: '颜色', kind: 'select', opts: [['red', '红 Red'], ['green', '绿 Green'], ['blue', '蓝 Blue']], def: 'red' }],
    label: () => '',
    build(c, n, m) { for (let i = 0; i < 4; i++) logicInputR(m, n[i]); c._p = null; },
    measure(c) { c._m.V = 0; c._m.I = 0; c._m.P = 0; },
    post(c, dt, app) { let v = 0; for (let i = 0; i < 4; i++) v |= logicIn(c, i, app.net) << i; c.state.val = v; },
    readings(c) { const v = c.state.val; return [[_t('common.display'), v === undefined ? '—' : v.toString(16).toUpperCase() + '  (' + v + ')']]; },
    draw(ctx, c) {
      for (const [x, y] of DEFS.seg7.terms) D.lead(ctx, x, y, -30, y);
      ctx.fillStyle = '#15181c'; D.rrect(ctx, -30, -56, 64, 92, 5); ctx.fill();
      const col = { red: '#ff2a1f', green: '#2bff4a', blue: '#3b8bff' }[c.props.color] || '#ff2a1f';
      const v = c.state.val, SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71];
      const on = v === undefined || !c._nodes ? 0 : SEG[v & 15];
      D.upright(ctx, c, 2, -10, (ctx) => {
        const W = 22, H = 28, t = 5;
        const seg = [[-W / 2, -H, W, 0], [W / 2, -H, 0, H], [W / 2, 0, 0, H], [-W / 2, H, W, 0], [-W / 2, 0, 0, H], [-W / 2, -H, 0, H], [-W / 2, 0, W, 0]];
        seg.forEach(([x, y, dx, dy], i) => {
          const lit = (on >> i) & 1;
          ctx.strokeStyle = lit ? col : 'rgba(255,255,255,0.07)'; ctx.lineWidth = t; ctx.lineCap = 'round';
          if (lit) { ctx.shadowColor = col; ctx.shadowBlur = 8; }
          ctx.beginPath(); ctx.moveTo(x + (dx ? 3 : 0), y + (dy ? 3 : 0)); ctx.lineTo(x + dx - (dx ? 3 : 0), y + dy - (dy ? 3 : 0)); ctx.stroke();
          ctx.shadowBlur = 0;
        });
      });
      ctx.fillStyle = '#9aa3ad'; ctx.font = '6px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ['1', '2', '4', '8'].forEach((s, i) => ctx.fillText(s, -35, -46 + i * 20));
    },
  },

  // ---------------- more semiconductors ----------------
  pmos: {
    name: 'P 沟道 MOS 管', en: 'P-MOSFET', cat: 'semi', desig: 'M', terms: [[-20, 20], [0, 20], [20, 20]], termNames: ['G 栅极', 'D 漏极', 'S 源极'], box: [-20, -36, 20, 20],
    props: [{ k: 'Vth', label: '开启电压 |Vth|', unit: 'V', def: 2, min: 0.1 }, { k: 'K', label: '跨导系数 K', unit: 'A/V²', def: 0.5, min: 1e-6 }],
    label: (c) => 'Vth=−' + U.fmtShort(c.props.Vth, 'V'),
    build(c, n, m) { c._q = m.addM(n[0], n[1], n[2], -1, { Vth: Math.abs(c.props.Vth), K: c.props.K, lam: 0.01 }, c.state); c._p = null; },
    measure(c, m) { DEFS.nmos.measure(c, m); },
    draw(ctx, c) { drawTO220(ctx, c, 'P-MOS', 'G D S', '#8a5a2a'); },
  },
  njfet: {
    name: 'N 沟道结型场效应管', en: 'N-JFET', cat: 'semi', desig: 'J', terms: [[-20, 20], [0, 20], [20, 20]], termNames: ['G 栅极', 'D 漏极', 'S 源极'], box: [-20, -28, 20, 20],
    props: [{ k: 'Idss', label: '饱和漏电流 Idss', unit: 'A', def: 0.01, min: 1e-6 }, { k: 'Vp', label: '夹断电压 Vp', unit: 'V', def: -2, min: -50 }],
    label: (c) => 'Idss=' + U.fmtShort(c.props.Idss, 'A'),
    build(c, n, m) {
      const Vp = Math.min(c.props.Vp, -0.05);
      c._q = m.addM(n[0], n[1], n[2], 1, { Vth: Vp, K: c.props.Idss / (Vp * Vp), lam: 0.01 }, c.state);
      if (!c.state.gs) { c.state.gs = {}; c.state.gd = {}; }
      m.addD(n[0], n[2], 1e-14, VT, c.state.gs); m.addD(n[0], n[1], 1e-14, VT, c.state.gd); // gate-channel junctions
      c._p = null;
    },
    measure(c, m) { DEFS.nmos.measure(c, m); },
    draw(ctx, c) { drawTO92(ctx, c, ['JFET', 'G D S']); },
  },

  // ---------------- electromechanical / sensors ----------------
  relay: {
    name: '继电器', en: 'Relay (SPDT)', cat: 'control', desig: 'K',
    terms: [[-40, -20], [-40, 20], [40, 0], [40, -20], [40, 20]], termNames: ['线圈 1', '线圈 2', 'COM 公共端', 'NO 常开', 'NC 常闭'], box: [-32, -32, 32, 32],
    props: [{ k: 'Rc', label: '线圈电阻', unit: 'Ω', def: 100, min: 1 }, { k: 'Lc', label: '线圈电感', unit: 'H', def: 0.05, min: 1e-6 },
      { k: 'Ion', label: '吸合电流', unit: 'A', def: 0.03, min: 1e-6 }, { k: 'Ioff', label: '释放电流', unit: 'A', def: 0.015, min: 1e-7 }],
    label: (c) => U.fmtShort(c.props.Rc, 'Ω'),
    shorted(c) { return c.state.on ? [[2, 3]] : [[2, 4]]; },
    build(c, n, m) { c._p = m.addL(n[0], n[1], c.props.Lc, c.props.Rc, c.state); },
    post(c, dt, app) {
      const st = c.state, I = Math.abs(c._p ? c._p.i : 0);
      if (!st.on && I > c.props.Ion) { st.on = true; app.dirty = true; st.clicks = (st.clicks || 0) + 1; }
      else if (st.on && I < c.props.Ioff) { st.on = false; app.dirty = true; st.clicks = (st.clicks || 0) + 1; }
    },
    readings(c) { const Ic = Math.abs(c._p ? c._p.i : 0); return [[_t('common.coil_current'), U.fmt(Ic < 1e-9 ? 0 : Ic, 'A')], [_t('relay.contact_current'), U.fmt(Math.abs(c._m.I || 0) < 1e-9 ? 0 : Math.abs(c._m.I), 'A')], [_t('common.contacts'), c.state.on ? _t('relay.com_no_energized') : _t('relay.com_nc_released')]]; },
    draw(ctx, c) {
      D.lead(ctx, -40, -20, -28, -20); D.lead(ctx, -40, 20, -28, 20); D.lead(ctx, 28, 0, 40, 0); D.lead(ctx, 28, -20, 40, -20); D.lead(ctx, 28, 20, 40, 20);
      ctx.fillStyle = D.vgrad(ctx, -30, 30, [[0, '#4f8fe0'], [1, '#1f4f99']]); D.rrect(ctx, -30, -30, 60, 60, 5); ctx.fill();
      ctx.strokeStyle = '#173a70'; ctx.lineWidth = 1; ctx.stroke();
      // coil
      ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i < 5; i++) { ctx.moveTo(-22, -16 + i * 8); ctx.arc(-18, -12 + i * 8, 4, -Math.PI / 2, Math.PI / 2); }
      ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-28, -20); ctx.lineTo(-22, -16); ctx.moveTo(-28, 20); ctx.lineTo(-22, 24); ctx.stroke();
      // contacts
      ctx.strokeStyle = '#eee'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(28, 0); ctx.lineTo(12, 0); ctx.lineTo(24, c.state.on ? -18 : 18); ctx.stroke();
      ctx.fillStyle = '#eee'; ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText('NO', 27, -25); ctx.fillText('NC', 27, 25);
      if (c.state.on) { ctx.fillStyle = '#7CFC00'; ctx.beginPath(); ctx.arc(-2, -24, 2.5, 0, 7); ctx.fill(); }
    },
  },
  buzzer: {
    name: '蜂鸣器', en: 'Buzzer', cat: 'light', desig: 'BZ', terms: [[-40, 0], [40, 0]], termNames: ['+', '−'], box: [-40, -26, 40, 16],
    props: [{ k: 'R', label: '等效电阻', unit: 'Ω', def: 200, min: 1 }, { k: 'Von', label: '发声电压', unit: 'V', def: 2, min: 0.1 },
      { k: 'sound', label: '播放声音 (Web Audio)', kind: 'bool', def: false }],
    label: (c) => U.fmtShort(c.props.R, 'Ω'),
    build(c, n, m) { c._p = m.addR(n[0], n[1], 1 / c.props.R); },
    post(c, dt, app) { const on = (c._m.V || 0) > c.props.Von; c.state.on = on; const want = on && !!c.props.sound && app.running; if (want !== !!c._osc) buzzerSound(c, want); c.state.ph = (c.state.ph || 0) + dt; },
    readings(c) { return [[_t('common.voltage'), U.fmt(c._m.V || 0, 'V')], [_t('common.current'), U.fmt(Math.abs(c._m.I || 0), 'A')], [_t('common.state'), c.state.on ? _t('buzzer.sounding_on') : _t('buzzer.silent_off')]]; },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -16, 0); D.lead(ctx, 16, 0, 40, 0);
      ctx.fillStyle = D.vgrad(ctx, -16, 16, [[0, '#3a3a3a'], [1, '#0a0a0a']]); ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill();
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.stroke();
      if (c.state.on) {
        const k = (performance.now() / 120) % 1;
        ctx.strokeStyle = 'rgba(255,170,0,0.9)'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { const r = 18 + ((i + k) % 3) * 5; ctx.globalAlpha = 1 - ((i + k) % 3) / 3; ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#d62828'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+', -22, -5);
    },
  },
  motor: {
    name: '直流电机', en: 'DC Motor', cat: 'light', desig: 'M', terms: [[-40, 0], [40, 0]], termNames: ['+', '−'], box: [-40, -24, 40, 24],
    props: [{ k: 'R', label: '电枢电阻', unit: 'Ω', def: 4, min: 0.01 }, { k: 'k', label: '反电动势常数 k', unit: 'V·s/rad', def: 0.01, min: 1e-5 },
      { k: 'J', label: '转动惯量 J', unit: 'kg·m²', def: 1e-5, min: 1e-9 }, { k: 'b', label: '粘滞摩擦 b', unit: 'N·m·s', def: 1e-5, min: 0 }],
    label: (c) => Math.round((c.state.w || 0) * 60 / (2 * Math.PI)) + ' rpm',
    build(c, n, m) {
      const k = m.newNode(); if (c.state.w === undefined) c.state.w = 0;
      m.addR(n[0], k, 1 / c.props.R);
      c._p = m.addV(k, n[1], () => c.props.k * c.state.w, 0);
    },
    post(c, dt) { const P = c.props, st = c.state, I = c._p.i; st.w += dt * (P.k * I - P.b * st.w) / P.J; st.ang = ((st.ang || 0) + st.w * dt) % (2 * Math.PI); },
    readings(c) { const w = c.state.w || 0; return [[_t('common.speed'), Math.round(w * 60 / (2 * Math.PI)) + ' rpm'], [_t('common.current'), U.fmt(c._m.I || 0, 'A')], [_t('common.voltage'), U.fmt(c._m.V || 0, 'V')], [_t('motor.back_emf'), U.fmt(c.props.k * w, 'V')], [_t('motor.torque'), U.fmt(c.props.k * (c._m.I || 0), 'N·m')]]; },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -26, 0); D.lead(ctx, 26, 0, 40, 0);
      ctx.fillStyle = D.vgrad(ctx, -22, 22, [[0, '#d9dee4'], [0.5, '#a3adb8'], [1, '#6c7784']]); D.rrect(ctx, -26, -20, 52, 40, 8); ctx.fill();
      ctx.strokeStyle = '#59636f'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#2b3440'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill();
      const a = (c.state.ang || 0) * 0.05 + (performance.now() / 1000) * Math.min(Math.abs(c.state.w || 0) * 0.02, 12) * Math.sign(c.state.w || 0);
      ctx.strokeStyle = '#f2b705'; ctx.lineWidth = 2.4;
      for (let i = 0; i < 3; i++) { const q = a + i * 2 * Math.PI / 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(11 * Math.cos(q), 11 * Math.sin(q)); ctx.stroke(); }
      ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, 7); ctx.fill();
      D.upright(ctx, c, 0, -14, (ctx) => { ctx.fillStyle = '#222'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('M', 20, 0); });
    },
  },
  ldr: {
    name: '光敏电阻', en: 'Photoresistor', cat: 'basic', desig: 'RL', wheel: true, terms: [[-40, 0], [40, 0]], box: [-40, -16, 40, 16],
    props: [{ k: 'pos', label: '光照强度 Light', kind: 'range', def: 0.5 }, { k: 'Rdark', label: '暗电阻', unit: 'Ω', def: 1e6, min: 1 }, { k: 'Rlight', label: '亮电阻', unit: 'Ω', def: 500, min: 1 }],
    label: (c) => U.fmtShort(DEFS.ldr.R(c), 'Ω'),
    R(c) { const P = c.props, L = U.clamp(P.pos, 0, 1); return Math.exp(Math.log(P.Rdark) * (1 - L) + Math.log(P.Rlight) * L); },
    build(c, n, m) { c._p = m.addR(n[0], n[1], 1 / DEFS.ldr.R(c)); },
    readings(c) { return [[_t('common.light'), Math.round(c.props.pos * 100) + '%'], [_t('common.resistor'), U.fmt(DEFS.ldr.R(c), 'Ω')], [_t('common.voltage'), U.fmt(Math.abs(c._m.V || 0), 'V')], [_t('common.current'), U.fmt(Math.abs(c._m.I || 0), 'A')]]; },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -14, 0); D.lead(ctx, 14, 0, 40, 0);
      const L = c.props.pos;
      glow(ctx, 0, 0, 22, '#ffe46a', L * 0.5);
      ctx.fillStyle = D.vgrad(ctx, -13, 13, [[0, '#f7e3b5'], [1, '#c79a4a']]); ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill();
      ctx.strokeStyle = '#b53a1a'; ctx.lineWidth = 1.6; ctx.beginPath();
      ctx.moveTo(-8, -6); for (let i = 0; i < 4; i++) { ctx.lineTo(8, -6 + i * 4); ctx.lineTo(-8, -4 + i * 4); } ctx.stroke();
      ctx.strokeStyle = '#e0a800'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-18, -22); ctx.lineTo(-11, -14); ctx.moveTo(-10, -24); ctx.lineTo(-4, -16); ctx.stroke();
    },
  },
  ntc: {
    name: '热敏电阻 (NTC)', en: 'Thermistor', cat: 'basic', desig: 'RT', wheel: true, terms: [[-40, 0], [40, 0]], box: [-40, -14, 40, 14],
    props: [{ k: 'pos', label: '温度 (−20…100 °C)', kind: 'range', def: 0.375, fmt: (v) => Math.round(-20 + 120 * v) + ' °C' }, { k: 'R25', label: '25 °C 电阻', unit: 'Ω', def: 10000, min: 1 }, { k: 'B', label: 'B 值', unit: 'K', def: 3950, min: 100 }],
    label: (c) => Math.round(DEFS.ntc.T(c)) + '°C',
    T(c) { return -20 + 120 * U.clamp(c.props.pos, 0, 1); },
    R(c) { const T = DEFS.ntc.T(c) + 273.15; return c.props.R25 * Math.exp(c.props.B * (1 / T - 1 / 298.15)); },
    build(c, n, m) { c._p = m.addR(n[0], n[1], 1 / DEFS.ntc.R(c)); },
    readings(c) { return [[_t('common.temperature'), DEFS.ntc.T(c).toFixed(1) + ' °C'], [_t('common.resistor'), U.fmt(DEFS.ntc.R(c), 'Ω')], [_t('common.voltage'), U.fmt(Math.abs(c._m.V || 0), 'V')], [_t('common.current'), U.fmt(Math.abs(c._m.I || 0), 'A')]]; },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -12, 0); D.lead(ctx, 12, 0, 40, 0);
      const f = c.props.pos;
      ctx.fillStyle = `rgb(${Math.round(60 + 190 * f)},${Math.round(110 - 40 * f)},${Math.round(220 - 180 * f)})`;
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 10, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-14, 10); ctx.lineTo(-6, 10); ctx.lineTo(10, -10); ctx.stroke();
      D.upright(ctx, c, 0, 0, (ctx) => { ctx.fillStyle = '#fff'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('t°', 0, 0); });
    },
  },
  xfmr: {
    name: '变压器', en: 'Transformer', cat: 'basic', desig: 'T',
    terms: [[-40, -20], [-40, 20], [40, -20], [40, 20]], termNames: ['初级 P1 ●', '初级 P2', '次级 S1 ●', '次级 S2'], box: [-34, -30, 34, 30],
    props: [{ k: 'n', label: '匝数比 Np:Ns', unit: ':1', def: 2, min: 0.01 }, { k: 'Lp', label: '初级电感', unit: 'H', def: 2, min: 1e-6 },
      { k: 'k', label: '耦合系数 k', unit: '', def: 0.999, min: 0.1 }, { k: 'Rw', label: '绕组电阻', unit: 'Ω', def: 0.2, min: 1e-4 }],
    label: (c) => U.fmtShort(c.props.n, '') + ':1',
    build(c, n, m) {
      const P = c.props, p1 = m.newNode(), s1 = m.newNode(), k = Math.min(P.k, 0.9999);
      m.addR(n[0], p1, 1 / P.Rw); m.addR(n[2], s1, 1 / P.Rw);
      if (!c.state.k) c.state.k = {};
      c._q = m.addK(p1, n[1], s1, n[3], P.Lp, P.Lp / (P.n * P.n), k, c.state.k);
      c._p = null;
    },
    measure(c, m) { const n = c._nodes; c._m.V = m.v(n[0]) - m.v(n[1]); c._m.V2 = m.v(n[2]) - m.v(n[3]); c._m.I = c._q.i1; c._m.I2 = -c._q.i2; c._m.P = Math.abs(c._m.V * c._m.I); },
    post(c, dt, app) { // RMS of both windings (for the readings panel)
      const st = c.state; st.a = (st.a || 0) + dt; st.s1 = (st.s1 || 0) + c._m.V * c._m.V * dt; st.s2 = (st.s2 || 0) + c._m.V2 * c._m.V2 * dt;
      if (st.a >= (app.acWin || 0.2)) { st.r1 = Math.sqrt(st.s1 / st.a); st.r2 = Math.sqrt(st.s2 / st.a); st.a = st.s1 = st.s2 = 0; }
    },
    readings(c) { const m = c._m, st = c.state; return [[_t('xfmr.primary_voltage_instant_rms'), U.fmt(m.V, 'V') + ' / ' + U.fmt(st.r1 || 0, 'V')], [_t('xfmr.secondary_voltage_instant_rms'), U.fmt(m.V2, 'V') + ' / ' + U.fmt(st.r2 || 0, 'V')], [_t('xfmr.primary_current'), U.fmt(m.I, 'A')], [_t('xfmr.secondary_current'), U.fmt(m.I2, 'A')]]; },
    draw(ctx, c) {
      D.lead(ctx, -40, -20, -24, -20); D.lead(ctx, -40, 20, -24, 20); D.lead(ctx, 24, -20, 40, -20); D.lead(ctx, 24, 20, 40, 20);
      ctx.fillStyle = D.vgrad(ctx, -30, 30, [[0, '#8a939e'], [1, '#4c555f']]); ctx.fillRect(-5, -28, 10, 56);
      ctx.fillStyle = '#6b7480'; ctx.fillRect(-30, -28, 60, 6); ctx.fillRect(-30, 22, 60, 6);
      const coil = (x, dir) => { ctx.strokeStyle = '#c8741e'; ctx.lineWidth = 2.2; ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(x, -16 + i * 8); ctx.arc(x, -12 + i * 8, 4, -Math.PI / 2, Math.PI / 2, dir < 0); } ctx.stroke(); };
      coil(-18, -1); coil(18, 1);
      ctx.strokeStyle = '#c8741e'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-24, -20); ctx.lineTo(-18, -16); ctx.moveTo(-24, 20); ctx.lineTo(-18, 24); ctx.moveTo(24, -20); ctx.lineTo(18, -16); ctx.moveTo(24, 20); ctx.lineTo(18, 24); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-27, -12, 2, 0, 7); ctx.arc(27, -12, 2, 0, 7); ctx.fill();
    },
  },
});

function drawTO220(ctx, c, t1, t2, col) {
  D.lead(ctx, -20, 20, -20, 6); D.lead(ctx, 0, 20, 0, 6); D.lead(ctx, 20, 20, 20, 6);
  ctx.fillStyle = D.vgrad(ctx, -36, -14, [[0, '#f2f2f2'], [0.5, '#b0b5bb'], [1, '#6a7078']]);
  D.rrect(ctx, -18, -36, 36, 24, 3); ctx.fill();
  ctx.fillStyle = '#556'; ctx.beginPath(); ctx.arc(0, -28, 4, 0, 7); ctx.fill();
  ctx.fillStyle = D.vgrad(ctx, -16, 8, [[0, U.shade(col, 0.1)], [1, U.shade(col, -0.6)]]);
  ctx.fillRect(-18, -16, 36, 24);
  D.upright(ctx, c, 0, -4, (ctx) => { ctx.fillStyle = '#f2f2f2'; ctx.font = 'bold 7.5px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t1, 0, -3); ctx.fillStyle = '#ddd'; ctx.font = '6.5px sans-serif'; ctx.fillText(t2, 0, 6); });
}

// optional buzzer tone (offline Web Audio oscillator)
let AUDIO_CTX = null;
function buzzerSound(c, on) {
  try {
    if (on) {
      if (!AUDIO_CTX) AUDIO_CTX = AUD.ctx();
      if (c._osc) return;
      const o = AUDIO_CTX.createOscillator(), g = AUDIO_CTX.createGain();
      o.type = 'square'; o.frequency.value = 2300; g.gain.value = 0.04; o.connect(g); g.connect(AUD.master()); o.start();
      c._osc = o; BUZZERS.add(c);
    } else if (c._osc) { c._osc.stop(); c._osc = null; BUZZERS.delete(c); }
  } catch (e) { /* audio unavailable */ }
}
const BUZZERS = new Set();
function stopBuzzers() { for (const c of [...BUZZERS]) buzzerSound(c, false); }

// BJT: Early voltage parameter
for (const t of ['npn', 'pnp']) {
  const d = DEFS[t];
  d.props.push({ k: 'VAF', label: '厄利电压 VA (0=忽略)', unit: 'V', def: 100, min: 0 });
  d.build = function (c, n, m) { c._q = m.addQ(n[1], n[2], n[0], t === 'npn' ? 1 : -1, { BF: c.props.BF, Is: c.props.Is, BR: 1, VAF: c.props.VAF }, c.state); c._p = null; };
}
CATEGORIES.splice(CATEGORIES.findIndex(x => x[0] === 'semi') + 1, 0, ['logic', '数字逻辑 Logic']);
