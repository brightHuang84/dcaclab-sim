'use strict';
// ===== Component definitions: geometry, properties, drawing, simulation behaviour =====
const LED_COLORS = {
  red: { name: '红', hex: '#ff2a2a', vf: 1.8 }, orange: { name: '橙', hex: '#ff8a1a', vf: 2.0 },
  yellow: { name: '黄', hex: '#ffe01a', vf: 2.1 }, green: { name: '绿', hex: '#2bff4a', vf: 2.2 },
  blue: { name: '蓝', hex: '#2a7bff', vf: 3.0 }, white: { name: '白', hex: '#ffffff', vf: 3.1 },
  purple: { name: '紫', hex: '#c04aff', vf: 3.2 },
};
const BULB_COLORS = {
  warm: { name: '暖黄', hex: '#ffd76a' }, white: { name: '白', hex: '#fff7e0' }, red: { name: '红', hex: '#ff5a4a' },
  green: { name: '绿', hex: '#6aff7a' }, blue: { name: '蓝', hex: '#6aa8ff' }, purple: { name: '紫', hex: '#d27aff' },
};
const WIRE_COLORS = ['#d62828', '#222222', '#1d5fd1', '#2a9d3a', '#f2b705', '#f77f00', '#8e44ad', '#e8e8e8'];
const RES_BAND = ['#111', '#7b3f00', '#e02020', '#ff8c00', '#ffd700', '#1fa330', '#1f5fd1', '#8a2be2', '#888', '#f5f5f5'];

// ---------- drawing helpers ----------
const D = {
  lead(ctx, x1, y1, x2, y2) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#6b6f76'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = '#d7dbe0'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  },
  poly(ctx, pts) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, c] of [[3.4, '#6b6f76'], [1.2, '#d7dbe0']]) {
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
    }
  },
  rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  },
  vgrad(ctx, y0, y1, stops) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c)); return g;
  },
  // draw text that stays upright regardless of the component rotation
  upright(ctx, c, x, y, fn) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-c.rot * Math.PI / 2); fn(ctx); ctx.restore();
  },
  lcd(ctx, c, x, y, w, h, text, unit, sub) {
    ctx.fillStyle = '#2b2f33'; D.rrect(ctx, x - 2, y - 2, w + 4, h + 4, 4); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#cfe2bb'); g.addColorStop(1, '#a9c294');
    ctx.fillStyle = g; D.rrect(ctx, x, y, w, h, 3); ctx.fill();
    D.upright(ctx, c, x + w / 2, y + h / 2, (ctx) => {
      const vert = c.rot % 2 === 1, ww = vert ? h : w, hh = vert ? w : h;
      const uw = 19, dy = sub ? -3 : 0;
      ctx.fillStyle = '#1b2414'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(unit, ww / 2 - uw, dy);
      let fs = Math.min(hh * 0.66, 17);
      const setF = () => { ctx.font = 'bold ' + fs.toFixed(1) + 'px "Consolas", "DejaVu Sans Mono", "Courier New", monospace'; };
      setF();
      while (ctx.measureText(text).width > ww - uw - 6 && fs > 6) { fs -= 0.5; setF(); }
      ctx.textAlign = 'right'; ctx.fillText(text, ww / 2 - uw - 2, dy);
      if (sub) { ctx.textAlign = 'left'; ctx.font = 'bold 7px sans-serif'; ctx.fillText(sub, -ww / 2 + 3, hh / 2 - 5); }
    });
  },
  jack(ctx, x, y, color, label) {
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill();
  },
};

function resistorBands(R) {
  if (!(R > 0)) return [0, 0, 0];
  let e = Math.floor(Math.log10(R)) - 1;
  let dd = Math.round(R / Math.pow(10, e));
  if (dd >= 100) { dd = Math.round(dd / 10); e += 1; }
  const d1 = Math.floor(dd / 10) % 10, d2 = dd % 10;
  let mul;
  if (e === -1) mul = '#d4af37'; else if (e === -2) mul = '#c0c0c0';
  else mul = RES_BAND[U.clamp(e, 0, 9)];
  return [RES_BAND[d1], RES_BAND[d2], mul];
}

function drawResistorBody(ctx, R, bodyColor) {
  const g = D.vgrad(ctx, -8, 8, [[0, U.shade(bodyColor, 0.35)], [0.45, bodyColor], [1, U.shade(bodyColor, -0.35)]]);
  ctx.fillStyle = g;
  D.rrect(ctx, -24, -8, 48, 16, 7); ctx.fill();
  ctx.strokeStyle = U.shade(bodyColor, -0.45); ctx.lineWidth = 0.8; ctx.stroke();
  const bands = resistorBands(R);
  [[-14, bands[0]], [-7, bands[1]], [0, bands[2]], [13, '#d4af37']].forEach(([x, col]) => {
    ctx.fillStyle = col; ctx.fillRect(x - 2.2, -7.6, 4.4, 15.2);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-20, -6, 40, 2.5);
}

function glow(ctx, x, y, r, hex, a) {
  if (a <= 0.01) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, U.rgba(hex, 0.85 * a)); g.addColorStop(0.35, U.rgba(hex, 0.45 * a)); g.addColorStop(1, U.rgba(hex, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}

// meter reading helper (DC instantaneous or AC RMS)
// meter reading helper: DC = instantaneous, AC = true RMS (AC-coupled) over a window that
// spans an integer number of periods of the slowest AC source in the circuit.
function meterUpdate(c, raw, dt, ac, app) {
  const st = c.state;
  let r = raw;
  if (ac) {
    const win = (app && app.acWin) || 0.2;
    st.s1 = (st.s1 || 0) + raw * dt; st.s2 = (st.s2 || 0) + raw * raw * dt; st.tw = (st.tw || 0) + dt;
    const rmsOf = (s1, s2, tw) => { const m = s1 / tw; return Math.sqrt(Math.max(0, s2 / tw - m * m)); };
    if (st.tw >= win - dt * 0.5) { st.rms = rmsOf(st.s1, st.s2, st.tw); st.s1 = st.s2 = st.tw = 0; }
    r = st.rms !== undefined ? st.rms : (st.tw > 0 ? rmsOf(st.s1, st.s2, st.tw) : 0);
  }
  if (Math.abs(r) < (c._res || 1e-7)) r = 0; // meter resolution: hide leakage noise
  c._m.reading = r;
}

// ===== multimeter modes & the value a meter shows =====
const MM_MODES = [['VDC', 'V=', 'V= 直流电压'], ['VAC', 'V~', 'V~ 交流电压'], ['ADC', 'A=', 'A= 直流电流'], ['AAC', 'A~', 'A~ 交流电流'],
  ['OHM', 'Ω', 'Ω 电阻'], ['CONT', '•))', '•)) 通断 / 蜂鸣'], ['DIODE', '→|', '→| 二极管测试']];
const MM_OHMISH = { OHM: 1, CONT: 1, DIODE: 1 };
const MM_ITEST = 1e-3, MM_GSH = 1e-9;          // 1 mA test current, 1 GΩ internal shunt (compensated)
const MM_OL = { OHM: 2e7, CONT: 600, DIODE: 3.2 }; // over-range limits (Ω, Ω, V)
const MM_BEEP = 30;                             // continuity beeper threshold (Ω)
// Value to display: live simulation value while running; otherwise the static operating-point solve
// (app.staticSolve).  Ω / continuity / diode always come from the static test-current solve.
function meterShown(c) {
  const s = c._s || {}, md = c.props.mode, A = typeof app !== 'undefined' ? app : null;
  if (MM_OHMISH[md]) return A && A.running && c._m.reading !== undefined ? c._m.reading : s.reading; // live while running (a capacitor visibly charges up)
  const ac = md === 'AC' || md === 'VAC' || md === 'AAC';
  if (A && A.running) return c._m.reading;
  if (ac) return s.noAC ? 0 : (A && A.hasRun ? c._m.reading : undefined);
  return s.reading !== undefined ? s.reading : (A && A.hasRun ? c._m.reading : undefined);
}
function meterText(c) {
  const md = c.props.mode, r = meterShown(c);
  const base = c.type === 'ammeter' ? 'A' : c.type === 'voltmeter' ? 'V' : { VDC: 'V', VAC: 'V', ADC: 'A', AAC: 'A', OHM: 'Ω', CONT: 'Ω', DIODE: 'V' }[md];
  const live = MM_OHMISH[md] && c._s && c._s.warn ? _t('parts.live') : '';
  const sub = live ? md + live : md === 'OHM' ? 'OHM' : md === 'CONT' ? 'CONT •))' : md === 'DIODE' ? 'DIODE →|' : (md === 'AC' || md.endsWith('AC')) ? 'AC RMS' : 'DC';
  if (c.state.fuseBlown && md[0] === 'A' && c.type === 'multimeter') return { txt: 'FUSE', unit: base, sub, val: null };
  if (r === undefined || r === null || Number.isNaN(r)) return { txt: '----', unit: base, sub, val: null };
  if (MM_OHMISH[md]) {
    if (!(r < MM_OL[md]) || (md !== 'DIODE' && r < -1)) return { txt: 'OL', unit: base, sub, val: Infinity };
    if (md === 'DIODE') return { txt: Math.max(r, 0).toFixed(3), unit: 'V', sub, val: r };
    if (r < 1e-3) return { txt: '0.000', unit: 'Ω', sub, val: r };
    const p = U.fmt(r, 'Ω', 4).split(' '); return { txt: p[0], unit: p[1] || 'Ω', sub, val: r };
  }
  if (r === 0) return { txt: '0.000', unit: base, sub, val: 0 };
  const p = U.fmt(r, '', 4).split(' '); return { txt: p[0], unit: (p[1] || '') + base, sub, val: r };
}
function meterBeep(c) { const r = c.props.mode === 'CONT' ? meterShown(c) : undefined; return r !== undefined && r !== null && r < MM_BEEP; }
function meterReadings(c) {
  const T = meterText(c), s = c._s || {}, md = c.props.mode, A = typeof app !== 'undefined' ? app : null;
  const out = [];
  if (c.type === 'multimeter') out.push([_t('common.range'), _t('c.multimeter.o.mode.' + md, null, md)]);
  out.push([_t('common.reading'), '<span class="big-inline">' + T.txt + ' ' + T.unit + '</span>']);
  if (MM_OHMISH[md]) {
    if (s.warn) out.push([_t('parts.warning'), _t('parts.disconnect_power_before_measuring_re') + U.fmt(s.v0, 'V', 3) + _t('parts.the_reading_is_unreliable')]);
    if (md === 'CONT') out.push([_t('parts.beep'), meterBeep(c) ? _t('parts.continuity') + MM_BEEP + ' Ω)' : _t('parts.open')]);
    if (md === 'DIODE') out.push([_t('common.note'), _t('parts.shows_the_forward_voltage_at_a_1_ma')]);
    out.push([_t('parts.test_current'), _t('parts.1_ma_from_the_meter')]);
  } else if (A && !A.running) out.push([_t('parts.source'), s.noAC === false && (md === 'AC' || md.endsWith('AC')) ? (A.hasRun ? _t('parts.reading_held_at_pause') : _t('parts.ac_values_need_a_running_simulation')) : _t('parts.dc_operating_point_works_without_run')]);
  return out;
}

const DEFS = {
  battery: {
    name: '电池', en: 'Battery', cat: 'source', terms: [[-60, 0], [60, 0]], termNames: ['−', '+'],
    box: [-60, -20, 60, 20],
    props: [{ k: 'V', label: '电压', unit: 'V', def: 9 }, { k: 'r', label: '内阻', unit: 'Ω', def: 0, min: 0 }],
    label: (c) => U.fmtShort(c.props.V, 'V'),
    build(c, n, m) { c._p = m.addV(n[1], n[0], () => c.props.V, c.props.r); },
    measure(c, m) { c._m.I = -c._p.i; c._m.V = m.v(c._nodes[1]) - m.v(c._nodes[0]); },
    draw(ctx, c) {
      D.lead(ctx, -60, 0, -40, 0); D.lead(ctx, 46, 0, 60, 0);
      ctx.fillStyle = D.vgrad(ctx, -17, 17, [[0, '#5a5a5a'], [0.35, '#222'], [1, '#050505']]);
      D.rrect(ctx, -42, -17, 60, 34, 4); ctx.fill();
      ctx.fillStyle = D.vgrad(ctx, -17, 17, [[0, '#ffcf7a'], [0.35, '#d98a1c'], [1, '#7a4506']]);
      D.rrect(ctx, 12, -17, 30, 34, 4); ctx.fill();
      ctx.fillStyle = D.vgrad(ctx, -7, 7, [[0, '#eee'], [0.5, '#aaa'], [1, '#666']]);
      ctx.fillRect(42, -7, 5, 14);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      D.upright(ctx, c, -14, 0, (ctx) => { ctx.fillStyle = '#ffd24a'; ctx.fillText(U.fmtShort(c.props.V, 'V').replace(' ', ''), 0, 0); });
      ctx.fillStyle = '#222'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('+', 28, 1);
      ctx.fillStyle = '#ddd'; ctx.fillText('−', -34, 0);
    },
  },
  ac: {
    name: '交流电源', en: 'AC Source', cat: 'source', terms: [[-60, 0], [60, 0]], termNames: ['a', 'b'],
    box: [-60, -30, 60, 30],
    props: [{ k: 'Vp', label: '峰值电压', unit: 'V', def: 12 }, { k: 'f', label: '频率', unit: 'Hz', def: 50, min: 0 },
      { k: 'ph', label: '相位', unit: '°', def: 0 }, { k: 'off', label: '直流偏置', unit: 'V', def: 0 },
      { k: 'wave', label: '波形 Wave', kind: 'select', opts: [['sine', '正弦波 Sine'], ['square', '方波 Square'], ['triangle', '三角波 Triangle']], def: 'sine' }],
    label: (c) => U.fmtShort(c.props.Vp, 'V') + ' ' + U.fmtShort(c.props.f, 'Hz') + (c.props.wave === 'square' ? _t('ac.square') : c.props.wave === 'triangle' ? _t('ac.triangle') : ''),
    build(c, n, m) {
      c._p = m.addV(n[1], n[0], (t) => {
        const P = c.props, ph = P.f * t + P.ph / 360, fr = ph - Math.floor(ph);
        let u;
        if (P.wave === 'square') u = fr < 0.5 ? 1 : -1;
        else if (P.wave === 'triangle') u = fr < 0.25 ? 4 * fr : fr < 0.75 ? 2 - 4 * fr : 4 * fr - 4;
        else u = Math.sin(2 * Math.PI * ph);
        return P.off + P.Vp * u;
      }, 0);
    },
    measure(c, m) { c._m.I = -c._p.i; c._m.V = m.v(c._nodes[1]) - m.v(c._nodes[0]); },
    draw(ctx, c) {
      D.lead(ctx, -60, 0, -28, 0); D.lead(ctx, 28, 0, 60, 0);
      const g = ctx.createRadialGradient(-8, -10, 4, 0, 0, 30);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#cfd6de'); g.addColorStop(1, '#8a96a3');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 28, 0, 7); ctx.fill();
      ctx.strokeStyle = '#4a5663'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#d62828'; ctx.lineWidth = 2.5; ctx.beginPath();
      const wv = c.props.wave;
      for (let i = 0; i <= 30; i++) {
        const x = -16 + i * 32 / 30, fr = i / 30;
        const u = wv === 'square' ? (fr < 0.5 ? 1 : -1) : wv === 'triangle' ? (fr < 0.25 ? 4 * fr : fr < 0.75 ? 2 - 4 * fr : 4 * fr - 4) : Math.sin(fr * 2 * Math.PI);
        if (wv === 'square' && (i === 15)) ctx.lineTo(x, -8 - 2);
        i ? ctx.lineTo(x, -8 * u - 2) : ctx.moveTo(x, -8 * u - 2);
      }
      ctx.stroke();
      D.upright(ctx, c, 0, 15, (ctx) => { ctx.fillStyle = '#334'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('AC', 0, 0); });
    },
  },
  resistor: {
    name: '电阻', en: 'Resistor', cat: 'basic', terms: [[-40, 0], [40, 0]], box: [-40, -12, 40, 12],
    props: [{ k: 'R', label: '电阻', unit: 'Ω', def: 100, min: 1e-6 }],
    label: (c) => U.fmtShort(c.props.R, 'Ω'),
    build(c, n, m) { c._p = m.addR(n[0], n[1], 1 / Math.max(c.props.R, 1e-6)); },
    draw(ctx, c) { D.lead(ctx, -40, 0, -24, 0); D.lead(ctx, 24, 0, 40, 0); drawResistorBody(ctx, c.props.R, '#e6c48a'); },
  },
  rheostat: {
    name: '可变电阻', en: 'Variable Resistor', cat: 'basic', terms: [[-40, 0], [40, 0]], box: [-40, -20, 40, 20],
    props: [{ k: 'R', label: '最大阻值', unit: 'Ω', def: 100, min: 1e-3 }, { k: 'pos', label: '调节', kind: 'range', def: 0.5 }],
    label: (c) => U.fmtShort(Math.max(c.props.R * c.props.pos, 1e-3), 'Ω'),
    wheel: true,
    build(c, n, m) { c._p = m.addR(n[0], n[1], 1 / Math.max(c.props.R * c.props.pos, 1e-3)); },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -24, 0); D.lead(ctx, 24, 0, 40, 0);
      drawResistorBody(ctx, Math.max(c.props.R * c.props.pos, 1e-3), '#8fb8d8');
      ctx.strokeStyle = '#1b3a5c'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-20, 15); ctx.lineTo(20, -15); ctx.stroke();
      ctx.fillStyle = '#1b3a5c'; ctx.beginPath(); ctx.moveTo(24, -18); ctx.lineTo(13, -15); ctx.lineTo(19, -8); ctx.closePath(); ctx.fill();
    },
  },
  pot: {
    name: '电位器', en: 'Potentiometer', cat: 'basic', terms: [[-40, 0], [40, 0], [0, -40]], termNames: ['A', 'B', 'W'],
    box: [-40, -40, 40, 14],
    props: [{ k: 'R', label: '总阻值', unit: 'Ω', def: 1000, min: 1e-3 }, { k: 'pos', label: '滑片位置', kind: 'range', def: 0.5 },
      { k: 'taper', label: '阻值曲线 Taper', kind: 'select', opts: [['lin', 'B 型 线性 Linear'], ['log', 'A 型 对数 (音频) Audio']], def: 'lin', lk: 'pot.p.taper', ok: 'pot.o.taper' }],
    label: (c) => U.fmtShort(c.props.R, 'Ω') + ' ' + Math.round(c.props.pos * 100) + '%' + (c.props.taper === 'log' ? ' A' : ''),
    wheel: true,
    build(c, n, m) {
      // v14: audio (A) taper — the resistance A–W follows an exponential law (≈ 9 % of R at mid travel, like a log volume pot)
      const R = c.props.R, p = c.props.taper === 'log' ? (Math.exp(4.6 * c.props.pos) - 1) / (Math.exp(4.6) - 1) : c.props.pos;
      c._p = m.addR(n[0], n[2], 1 / Math.max(R * p, 1e-3));
      c._p2 = m.addR(n[2], n[1], 1 / Math.max(R * (1 - p), 1e-3));
    },
    measure(c, m) { c._m.V = m.v(c._nodes[1]) - m.v(c._nodes[0]); c._m.I = c._p.i; c._m.P = Math.abs(c._p.i * (m.v(c._nodes[0]) - m.v(c._nodes[2]))) + Math.abs(c._p2.i * (m.v(c._nodes[2]) - m.v(c._nodes[1]))); },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -28, 0); D.lead(ctx, 28, 0, 40, 0);
      ctx.fillStyle = D.vgrad(ctx, -10, 10, [[0, '#4a4f57'], [0.5, '#2a2e33'], [1, '#15171a']]);
      D.rrect(ctx, -28, -10, 56, 20, 3); ctx.fill();
      ctx.fillStyle = '#0b0c0d'; ctx.fillRect(-22, -2, 44, 4);
      const xw = -20 + 40 * c.props.pos;
      D.poly(ctx, [[xw, -12], [xw, -24], [0, -24], [0, -40]]);
      ctx.fillStyle = D.vgrad(ctx, -14, 4, [[0, '#ffe08a'], [1, '#c98a10']]);
      ctx.fillRect(xw - 5, -14, 10, 16);
      ctx.strokeStyle = '#7a5200'; ctx.lineWidth = 1; ctx.strokeRect(xw - 5, -14, 10, 16);
      ctx.fillStyle = '#9aa'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('A', -34, 12); ctx.fillText('B', 34, 12);
    },
  },
  capacitor: {
    name: '电容', en: 'Capacitor', cat: 'basic', terms: [[-40, 0], [40, 0]], box: [-40, -14, 40, 14],
    props: [{ k: 'C', label: '电容', unit: 'F', def: 1e-4, min: 1e-15 }],
    label: (c) => U.fmtShort(c.props.C, 'F'),
    build(c, n, m) { c._p = m.addC(n[0], n[1], c.props.C, c.state); },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -24, 0); D.lead(ctx, 24, 0, 40, 0);
      ctx.fillStyle = D.vgrad(ctx, -13, 13, [[0, '#7fb2ff'], [0.4, '#1f5fd1'], [1, '#0a2a66']]);
      D.rrect(ctx, -24, -13, 48, 26, 6); ctx.fill();
      ctx.fillStyle = D.vgrad(ctx, -13, 13, [[0, '#e8eef8'], [0.5, '#a9b6c9'], [1, '#6c7a90']]);
      ctx.fillRect(10, -13, 9, 26);
      ctx.fillStyle = '#1f3a6b'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('−', 14.5, -5); ctx.fillText('−', 14.5, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-20, -10, 28, 3);
      // charge indicator
      const v = c.state.v || 0;
      if (Math.abs(v) > 0.01) {
        ctx.fillStyle = v > 0 ? 'rgba(255,80,80,0.85)' : 'rgba(80,160,255,0.9)';
        const w = U.clamp(Math.abs(v) / 12, 0.05, 1) * 26;
        ctx.fillRect(-19, 5, w, 4);
      }
    },
  },
  inductor: {
    name: '电感', en: 'Inductor', cat: 'basic', terms: [[-40, 0], [40, 0]], box: [-40, -14, 40, 14],
    props: [{ k: 'L', label: '电感', unit: 'H', def: 0.1, min: 1e-9 }, { k: 'R', label: '线圈电阻', unit: 'Ω', def: 0, min: 0 }],
    label: (c) => U.fmtShort(c.props.L, 'H'),
    build(c, n, m) { c._p = m.addL(n[0], n[1], c.props.L, c.props.R, c.state); },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -26, 0); D.lead(ctx, 26, 0, 40, 0);
      ctx.fillStyle = D.vgrad(ctx, -6, 6, [[0, '#777'], [0.5, '#333'], [1, '#111']]);
      D.rrect(ctx, -28, -6, 56, 12, 3); ctx.fill();
      for (let i = 0; i < 9; i++) {
        const x = -22 + i * 5.5;
        ctx.fillStyle = D.vgrad(ctx, -12, 12, [[0, '#ffc58a'], [0.5, '#c46a1c'], [1, '#6a3408']]);
        D.rrect(ctx, x - 2.4, -12, 4.8, 24, 2.4); ctx.fill();
      }
    },
  },
  diode: {
    name: '二极管', en: 'Diode', cat: 'basic', terms: [[-40, 0], [40, 0]], termNames: ['阳极 A', '阴极 K'], box: [-40, -10, 40, 10],
    props: [{ k: 'Is', label: '饱和电流', unit: 'A', def: 1e-14, min: 1e-30 }, { k: 'nf', label: '理想因子', unit: '', def: 1, min: 0.5 }],
    label: () => '',
    build(c, n, m) { c._p = m.addD(n[0], n[1], c.props.Is, c.props.nf * VT, c.state); },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -18, 0); D.lead(ctx, 18, 0, 40, 0);
      ctx.fillStyle = D.vgrad(ctx, -7, 7, [[0, '#555'], [0.4, '#1a1a1a'], [1, '#000']]);
      D.rrect(ctx, -18, -7, 36, 14, 4); ctx.fill();
      ctx.fillStyle = D.vgrad(ctx, -7, 7, [[0, '#f2f2f2'], [1, '#999']]);
      ctx.fillRect(9, -7, 5, 14);
      ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1.3; ctx.beginPath();
      ctx.moveTo(-9, -4); ctx.lineTo(-9, 4); ctx.lineTo(1, 0); ctx.closePath(); ctx.moveTo(1, -4); ctx.lineTo(1, 4); ctx.stroke();
    },
  },
  bulb: {
    name: '灯泡', en: 'Light Bulb', cat: 'light', terms: [[-40, 0], [40, 0]], box: [-40, -56, 40, 6],
    props: [{ k: 'Vr', label: '额定电压', unit: 'V', def: 9, min: 1e-3 }, { k: 'Pr', label: '额定功率', unit: 'W', def: 5, min: 1e-6 },
      { k: 'color', label: '颜色', kind: 'color', opts: BULB_COLORS, def: 'warm' }],
    label: (c) => U.fmtShort(c.props.Vr, 'V') + ' ' + U.fmtShort(c.props.Pr, 'W'),
    build(c, n, m) { c._p = m.addR(n[0], n[1], c.state.burnt ? G_OFF : c.props.Pr / (c.props.Vr * c.props.Vr)); },
    post(c, dt, app) {
      const P = Math.abs(c._m.V * c._m.I);
      const st = c.state; st.pAvg = (st.pAvg || 0) + (P - (st.pAvg || 0)) * Math.min(1, dt / 0.04);
      c._m.bright = st.pAvg / c.props.Pr;
      if (!st.burnt && st.pAvg > 3 * c.props.Pr) { st.burnt = true; app.dirty = true; app.toast(_t('bulb.bulb_overloaded_and_burnt_out_replac')); }
    },
    draw(ctx, c) {
      const col = BULB_COLORS[c.props.color] || BULB_COLORS.warm;
      const b = c.state.burnt ? 0 : Math.pow(U.clamp(c._m.bright || 0, 0, 1.3), 0.6);
      D.poly(ctx, [[-40, 0], [-7, 0], [-7, -4]]); D.poly(ctx, [[40, 0], [7, 0], [7, -4]]);
      // socket
      ctx.fillStyle = D.vgrad(ctx, -22, -2, [[0, '#f3d98a'], [0.5, '#b8912e'], [1, '#6e5212']]);
      ctx.fillRect(-10, -22, 20, 18);
      ctx.strokeStyle = 'rgba(80,60,10,0.7)'; ctx.lineWidth = 1;
      for (let y = -19; y < -5; y += 3.5) { ctx.beginPath(); ctx.moveTo(-10, y); ctx.lineTo(10, y + 1.5); ctx.stroke(); }
      ctx.fillStyle = '#222'; ctx.fillRect(-6, -5, 12, 3);
      // glass
      const cx = 0, cy = -38;
      if (b > 0) glow(ctx, cx, cy, 22 + 48 * b, col.hex, Math.min(1, b));
      const g = ctx.createRadialGradient(cx - 6, cy - 7, 2, cx, cy, 20);
      if (c.state.burnt) { g.addColorStop(0, 'rgba(200,200,200,0.7)'); g.addColorStop(1, 'rgba(90,90,90,0.75)'); }
      else {
        g.addColorStop(0, b > 0.05 ? '#ffffff' : 'rgba(255,255,255,0.95)');
        g.addColorStop(0.5, b > 0.05 ? U.rgba(col.hex, 0.55 + 0.45 * Math.min(1, b)) : U.rgba(col.hex, 0.25));
        g.addColorStop(1, b > 0.05 ? U.rgba(col.hex, 0.4 + 0.5 * Math.min(1, b)) : 'rgba(200,210,220,0.55)');
      }
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, 18, Math.PI * 0.72, Math.PI * 2.28); ctx.lineTo(8, -22); ctx.lineTo(-8, -22); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(90,100,110,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
      // filament
      ctx.strokeStyle = '#777'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(-4, -22); ctx.lineTo(-6, -38); ctx.moveTo(4, -22); ctx.lineTo(6, -38); ctx.stroke();
      ctx.strokeStyle = c.state.burnt ? '#333' : (b > 0.05 ? '#fff6c0' : '#8a5a2a'); ctx.lineWidth = b > 0.05 ? 2 : 1.2;
      ctx.beginPath(); ctx.moveTo(-6, -38);
      for (let i = 1; i <= 12; i++) { if (c.state.burnt && i === 6) { ctx.moveTo(-6 + i, -41); continue; } ctx.lineTo(-6 + i, -38 + (i % 2 ? -3 : 0)); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-8, -45, 3, 6, -0.5, 0, 7); ctx.fill();
    },
  },
  led: {
    name: 'LED', en: 'LED', cat: 'light', terms: [[-40, 0], [40, 0]], termNames: ['阳极 +', '阴极 −'], box: [-40, -36, 40, 6],
    props: [{ k: 'color', label: '颜色', kind: 'color', opts: LED_COLORS, def: 'red' },
      { k: 'Imax', label: '最大电流', unit: 'A', def: 0.05, min: 1e-4 }],
    label: (c) => (LED_COLORS[c.props.color] || LED_COLORS.red).name + ' LED',
    build(c, n, m) {
      if (c.state.burnt) { c._p = m.addR(n[0], n[1], G_OFF); return; }
      const col = LED_COLORS[c.props.color] || LED_COLORS.red, nVt = 2 * VT;
      c._p = m.addD(n[0], n[1], 0.02 / Math.exp(col.vf / nVt), nVt, c.state);
    },
    post(c, dt, app) {
      const st = c.state, I = Math.max(0, c._m.I);
      st.iAvg = (st.iAvg || 0) + (I - (st.iAvg || 0)) * Math.min(1, dt / 0.01);
      c._m.bright = st.iAvg / 0.02;
      if (!st.burnt && st.iAvg > c.props.Imax) { st.over = (st.over || 0) + dt; if (st.over > 0.05) { st.burnt = true; app.dirty = true; app.toast(_t('led.led_burnt_out_by_excessive_current_a')); } }
      else st.over = 0;
    },
    draw(ctx, c) {
      const col = LED_COLORS[c.props.color] || LED_COLORS.red;
      const b = c.state.burnt ? 0 : U.clamp(c._m.bright || 0, 0, 1.5);
      D.poly(ctx, [[-40, 0], [-4, 0], [-4, -6]]); D.poly(ctx, [[40, 0], [4, 0], [4, -6]]);
      if (b > 0.02) glow(ctx, 0, -20, 16 + 34 * Math.min(1, b), col.hex, Math.min(1, 0.3 + b));
      const base = c.state.burnt ? '#3a3a3a' : col.hex;
      const g = ctx.createLinearGradient(-9, 0, 9, 0);
      g.addColorStop(0, U.rgba(base === '#ffffff' ? '#dddddd' : base, 0.75)); g.addColorStop(0.35, b > 0.05 ? '#ffffff' : U.shade(base, 0.5)); g.addColorStop(1, U.rgba(base, 0.85));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(-9, -24); ctx.arc(0, -24, 9, Math.PI, 0); ctx.lineTo(9, -9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = U.shade(base === '#ffffff' ? '#bbbbbb' : base, -0.4); ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = U.shade(base === '#ffffff' ? '#cccccc' : base, -0.2); ctx.fillRect(-11, -9, 22, 3.5);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-6, -28, 2.5, 14);
      if (c.state.burnt) { ctx.fillStyle = 'rgba(60,60,60,0.5)'; ctx.beginPath(); ctx.arc(4, -38, 6, 0, 7); ctx.arc(-3, -44, 5, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#c33'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+', -22, -5);
    },
  },
  switch: {
    name: '开关', en: 'Switch', cat: 'control', terms: [[-40, 0], [40, 0]], box: [-40, -34, 40, 10],
    props: [{ k: 'closed', label: '闭合', kind: 'bool', def: false }],
    label: (c) => (c.props.closed ? _t('switch.closed_on') : _t('switch.open_off')),
    click(c, app) { c.props.closed = !c.props.closed; app.dirty = true; app.changed(); },
    shorted: (c) => (c.props.closed ? [[0, 1]] : null),
    build(c, n, m) { if (!c.props.closed) c._p = m.addR(n[0], n[1], G_OFF); },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -22, 0); D.lead(ctx, 22, 0, 40, 0);
      // base board
      ctx.fillStyle = D.vgrad(ctx, -1, 11, [[0, '#4a5d73'], [1, '#26323f']]);
      D.rrect(ctx, -32, -1, 64, 12, 3); ctx.fill();
      // contacts
      ctx.fillStyle = D.vgrad(ctx, -9, 1, [[0, '#ffe08a'], [1, '#a8781a']]);
      ctx.fillRect(17, -9, 3, 10); ctx.fillRect(25, -9, 3, 10);
      ctx.fillStyle = '#b8912e'; ctx.fillRect(-26, -6, 8, 7);
      const ang = c.props.closed ? 0 : -0.62;
      ctx.save(); ctx.translate(-22, -3); ctx.rotate(ang);
      ctx.fillStyle = D.vgrad(ctx, -2.5, 2.5, [[0, '#ffd9a0'], [0.5, '#d08a2c'], [1, '#7a4a0a']]);
      ctx.fillRect(0, -2.5, 46, 5);
      ctx.fillStyle = D.vgrad(ctx, -6, 6, [[0, '#555'], [1, '#111']]);
      D.rrect(ctx, 42, -5, 14, 10, 4); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(-22, -3, 2.4, 0, 7); ctx.fill();
      // status LED
      ctx.fillStyle = c.props.closed ? '#34d058' : '#e03131';
      ctx.beginPath(); ctx.arc(0, 5, 2.6, 0, 7); ctx.fill();
    },
  },
  button: {
    name: '按钮', en: 'Push Button', cat: 'control', momentary: true, terms: [[-40, 0], [40, 0]], box: [-40, -26, 40, 10],
    props: [{ k: 'nc', label: '常闭型', kind: 'bool', def: false }],
    label: (c) => (c.props.nc ? _t('button.nc') : _t('button.push_to_make')),
    shorted: (c) => (!!c.state.pressed !== !!c.props.nc ? [[0, 1]] : null),
    build(c, n, m) { if (!(!!c.state.pressed !== !!c.props.nc)) c._p = m.addR(n[0], n[1], G_OFF); },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -22, 0); D.lead(ctx, 22, 0, 40, 0);
      ctx.fillStyle = D.vgrad(ctx, -8, 8, [[0, '#555'], [1, '#1a1a1a']]);
      D.rrect(ctx, -24, -8, 48, 16, 3); ctx.fill();
      const pr = !!c.state.pressed, h = pr ? 5 : 13;
      ctx.fillStyle = '#444'; ctx.fillRect(-10, -8 - h + 2, 20, h);
      ctx.fillStyle = D.vgrad(ctx, -8 - h - 5, -8 - h + 3, [[0, '#ff7a7a'], [1, '#b01010']]);
      D.rrect(ctx, -13, -8 - h - 5, 26, 8, 3); ctx.fill();
      ctx.fillStyle = '#b8912e'; ctx.fillRect(-20, -2, 40, 3);
    },
  },
  fuse: {
    name: '保险丝', en: 'Fuse', cat: 'control', terms: [[-40, 0], [40, 0]], box: [-40, -10, 40, 10],
    props: [{ k: 'rating', label: '额定电流', unit: 'A', def: 1, min: 1e-4 }],
    label: (c) => (c.state.blown ? _t('fuse.blown') : U.fmtShort(c.props.rating, 'A')),
    build(c, n, m) { c._p = c.state.blown ? m.addR(n[0], n[1], G_OFF) : m.addV(n[0], n[1], () => 0, 0); },
    post(c, dt, app) {
      const st = c.state; if (st.blown) return;
      const r = Math.abs(c._m.I) / c.props.rating;
      st.heat = Math.max(0, (st.heat || 0) + (r * r - 1) * dt);
      if (st.heat > 0.02) { st.blown = true; app.dirty = true; app.toast(_t('fuse.fuse_blown_current_exceeded_the_rati') + U.fmtShort(c.props.rating, 'A')); }
    },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -28, 0); D.lead(ctx, 28, 0, 40, 0);
      ctx.fillStyle = c.state.blown ? 'rgba(120,110,100,0.55)' : 'rgba(215,235,250,0.65)';
      ctx.fillRect(-21, -7, 42, 14);
      ctx.strokeStyle = 'rgba(120,140,160,0.9)'; ctx.lineWidth = 1; ctx.strokeRect(-21, -7, 42, 14);
      ctx.strokeStyle = '#8a8f96'; ctx.lineWidth = 1.3; ctx.beginPath();
      if (c.state.blown) { ctx.moveTo(-21, 0); ctx.lineTo(-6, 2); ctx.moveTo(5, -2); ctx.lineTo(21, 0); ctx.stroke(); ctx.fillStyle = 'rgba(30,30,30,0.6)'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill(); }
      else { ctx.moveTo(-21, 0); ctx.bezierCurveTo(-7, -5, 7, 5, 21, 0); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-19, -5, 38, 2);
      for (const x of [-28, 21]) { ctx.fillStyle = D.vgrad(ctx, -9, 9, [[0, '#f5f5f5'], [0.5, '#b0b5bb'], [1, '#6a7078']]); D.rrect(ctx, x, -9, 7, 18, 1.5); ctx.fill(); }
    },
  },
  ammeter: {
    name: '电流表', en: 'Ammeter', cat: 'meter', terms: [[-20, 40], [20, 40]], termNames: ['COM −', '+'], box: [-40, -44, 40, 40],
    props: [{ k: 'mode', label: '测量', kind: 'select', opts: [['DC', '直流 DC'], ['AC', '交流 AC (有效值)']], def: 'DC' }],
    label: () => '',
    build(c, n, m) { c._p = m.addV(n[1], n[0], () => 0, 0); },
    measure(c, m) { c._m.V = m.v(c._nodes[1]) - m.v(c._nodes[0]); c._m.I = c._p.i; },
    post(c, dt, app) { meterUpdate(c, c._m.I, dt, c.props.mode === 'AC', app); },
    readings(c) { return meterReadings(c); },
    draw(ctx, c, env) { drawPanelMeter(ctx, c, env, '#c0392b', 'A', 'A', c.props.mode === 'AC' ? 'AC' : 'DC'); },
  },
  voltmeter: {
    name: '电压表', en: 'Voltmeter', cat: 'meter', terms: [[-20, 40], [20, 40]], termNames: ['COM −', '+'], box: [-40, -44, 40, 40],
    props: [{ k: 'mode', label: '测量', kind: 'select', opts: [['DC', '直流 DC'], ['AC', '交流 AC (有效值)']], def: 'DC' }],
    label: () => '',
    build(c, n, m) { c._p = m.addR(n[1], n[0], 1e-11); },
    measure(c, m) { c._m.V = m.v(c._nodes[1]) - m.v(c._nodes[0]); c._m.I = c._p.i; },
    post(c, dt, app) { c._res = 1e-6; meterUpdate(c, c._m.V, dt, c.props.mode === 'AC', app); },
    readings(c) { return meterReadings(c); },
    draw(ctx, c, env) { drawPanelMeter(ctx, c, env, '#1f5fd1', 'V', 'V', c.props.mode === 'AC' ? 'AC' : 'DC'); },
  },
  multimeter: {
    name: '万用表', en: 'Multimeter', cat: 'meter', terms: [[-40, 60], [0, 60], [40, 60]], termNames: ['COM', 'VΩ', 'A (10A)'], box: [-52, -70, 52, 60],
    props: [{ k: 'mode', label: '档位', kind: 'select', opts: MM_MODES.map(m => [m[0], m[2]]), def: 'VDC' },
      { k: 'rin', label: '电压档输入阻抗', unit: 'Ω', def: 10e6, min: 1e3 },
      { k: 'sound', label: '通断档蜂鸣声', kind: 'bool', def: false }],
    label: () => '',
    // COM–VΩ: 10 MΩ voltmeter input (V modes) or the meter's own 1 mA test current (Ω / continuity / diode);
    // open in A modes.  COM–A: always an ideal shunt with an internal 10 A fuse (like a real meter).
    // Ω-type readings are produced by app.staticSolve() (DC solve with the test current on and off).
    build(c, n, m) {
      const md = c.props.mode;
      c._pa = c.state.fuseBlown ? null : m.addV(n[2], n[0], () => 0, 0);
      if (c.state.fuseBlown) m.addR(n[2], n[0], G_OFF);
      c._pv = c._pi = null;
      if (MM_OHMISH[md]) { c._pv = m.addR(n[1], n[0], MM_GSH); c._pi = m.addI(n[0], n[1], () => (c._itest !== undefined ? c._itest : MM_ITEST)); }
      else if (md[0] === 'V') c._pv = m.addR(n[1], n[0], 1 / c.props.rin);
      c._p = c._pa || c._pv;
    },
    measure(c, m) { const n = c._nodes; c._m.V = c.props.mode[0] === 'A' ? 0 : m.v(n[1]) - m.v(n[0]); c._m.I = c._pa ? c._pa.i : 0; c._m.P = 0; },
    post(c, dt, app) {
      const md = c.props.mode, st = c.state;
      if (!st.fuseBlown && Math.abs(c._m.I) > 10) { st.over = (st.over || 0) + dt; if (st.over > 0.01) { st.fuseBlown = true; app.dirty = true; app.toast(_t('multimeter.multimeter_s_internal_10_a_fuse_blow')); } } else st.over = 0;
      if (md === 'DIODE') c._m.reading = c._m.V;
      else if (MM_OHMISH[md]) { const den = MM_ITEST - c._m.V * MM_GSH; c._m.reading = den > 1e-9 ? c._m.V / den : Infinity; /* compensate the 1 GΩ internal shunt */ }
      else { c._res = md[0] === 'A' ? 1e-7 : 1e-6; meterUpdate(c, md[0] === 'A' ? c._m.I : c._m.V, dt, md.endsWith('AC'), app); }
    },
    click(c, app, lx, ly) {
      if (Math.hypot(lx, ly + 2) < 26) {
        const order = MM_MODES.map(m => m[0]);
        c.props.mode = order[(order.indexOf(c.props.mode) + 1) % order.length];
        const fb = c.state.fuseBlown; c.state = { fuseBlown: fb }; c._m = {}; c._s = null; app.dirty = true; app.changed(); app.refreshProps();
      }
    },
    readings(c) { return meterReadings(c); },
    draw(ctx, c, env) {
      const beep = meterBeep(c);
      if (beep) glow(ctx, 38, -58, 22, '#ffd84a', 1);
      ctx.fillStyle = D.vgrad(ctx, -70, 48, [[0, '#ffd84a'], [1, '#e0a800']]);
      D.rrect(ctx, -52, -70, 104, 118, 10); ctx.fill();
      ctx.fillStyle = '#2b2b2b'; D.rrect(ctx, -47, -64, 94, 106, 7); ctx.fill();
      const md = c.props.mode, T = meterText(c);
      D.lcd(ctx, c, -34, -58, 68, 26, T.txt, T.unit, T.sub);
      if (c._s && c._s.warn && MM_OHMISH[md]) {   // live-circuit warning, like a real meter's "LIVE" flag
        ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2; D.rrect(ctx, -36, -60, 72, 30, 4); ctx.stroke();
        D.upright(ctx, c, 41, -45, (ctx) => { ctx.fillStyle = '#ff3b30'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚠', 0, 0); });
      }
      if (md === 'CONT') {   // buzzer indicator
        D.upright(ctx, c, 40, -58, (ctx) => {
          ctx.fillStyle = beep ? '#ffe14d' : '#555'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
          if (beep) { ctx.fillStyle = '#ff9f0a'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♪', 0, -9); }
        });
      }
      ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let knobAng = 0;
      MM_MODES.forEach(([k, l], i) => {
        const ang = -2.4 + i * 0.6 - Math.PI / 2 + 0.8;
        ctx.fillStyle = k === md ? '#ffd84a' : '#ddd';
        ctx.fillText(l, Math.cos(ang) * 31, -4 + Math.sin(ang) * 25);
        if (k === md) knobAng = ang;
      });
      const g = ctx.createRadialGradient(-5, -9, 2, 0, -4, 17);
      g.addColorStop(0, '#666'); g.addColorStop(1, '#111');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -4, 16, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(Math.cos(knobAng) * 14, -4 + Math.sin(knobAng) * 14); ctx.stroke();
      D.lead(ctx, -40, 40, -40, 60); D.lead(ctx, 0, 40, 0, 60); D.lead(ctx, 40, 40, 40, 60);
      D.jack(ctx, -40, 32, '#222'); D.jack(ctx, 0, 32, '#d62828'); D.jack(ctx, 40, 32, c.state.fuseBlown ? '#666' : '#ff8c00');
      D.upright(ctx, c, 0, 21, (ctx) => { ctx.fillStyle = '#ccc'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('COM', -40, 0); ctx.fillText('VΩ→|', 0, 0); ctx.fillText('10A', 40, 0); });
    },
  },

  ground: {
    name: '接地', en: 'Ground', cat: 'other', terms: [[0, -20]], box: [-14, -20, 14, 14],
    props: [], label: () => '',
    build() {},
    measure(c) { c._m.V = 0; c._m.I = 0; },
    draw(ctx) {
      D.lead(ctx, 0, -20, 0, 0);
      ctx.strokeStyle = '#3a4048'; ctx.lineCap = 'round';
      [[12, 0], [8, 5], [4, 10]].forEach(([w, y]) => { ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.stroke(); });
    },
  },
};

function drawPanelMeter(ctx, c, env, color, sym, unitBase, sub) {
  ctx.fillStyle = D.vgrad(ctx, -44, 28, [[0, U.shade(color, 0.25)], [1, U.shade(color, -0.35)]]);
  D.rrect(ctx, -40, -44, 80, 72, 9); ctx.fill();
  ctx.fillStyle = '#f5f6f7'; D.rrect(ctx, -35, -39, 70, 62, 6); ctx.fill();
  let txt = '----', unit = unitBase;
  const r = meterShown(c);
  if (r === 0) txt = '0.000';
  else if (r !== undefined && r !== null && !Number.isNaN(r)) { const s = U.fmt(r, unitBase, 4).split(' '); txt = s[0]; unit = s[1] || unitBase; }
  D.lcd(ctx, c, -30, -34, 60, 26, txt, unit, sub === 'AC' ? 'AC RMS' : 'DC');
  D.upright(ctx, c, 0, 8, (ctx) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sym, 0, 1);
  });
  D.lead(ctx, -20, 26, -20, 40); D.lead(ctx, 20, 26, 20, 40);
  D.jack(ctx, -20, 26, '#222'); D.jack(ctx, 20, 26, '#d62828');
}

const CATEGORIES = [
  ['source', '电源 Sources'], ['basic', '基本元件 Passive'], ['light', '灯与指示 Lights'],
  ['control', '开关与保护 Switches'], ['meter', '测量仪表 Meters'], ['other', '其他 Other'],
];
