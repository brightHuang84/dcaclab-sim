'use strict';
// ===== v11: sensor modules =====
// Analog modules (LDR, MQ gas, flame, soil moisture, water level, sound envelope, rain, LM35, TMP36, thermistor,
// flex, FSR, joystick, ACS712, pressure), digital modules (PIR HC-SR501, IR obstacle, TCRT5000 line tracker, tilt
// switch, SW-420 vibration, TTP223 touch, KY-040 rotary encoder) and protocol sensors used by MCU programs
// (HC-SR04 ultrasonic, DHT11/DHT22, DS18B20). Every sensed quantity is a property (slider + number with units) and can
// be driven by an optional signal source (sine / triangle / square / ramp between min and max) over simulated time.

// ---------------- generic models ----------------
// Thevenin output referenced to the module's ground, nodes [vcc, gnd, out, (extra inputs…)]:
//   current into the device at OUT = g·(V(out) − V(gnd) − T); T = p.fv(vs)[0] (vs = V(vcc) − V(gnd)) or p.f(V, d)
//   (d receives ∂T/∂V(node k)). The sourced current returns through the module ground.
NLMODELS.sens = function (p, V) {
  const n = p.n.length, G = p.G, J = p.J; G.fill(0); J.fill(0);
  const g = p.gf ? p.gf() : p.g;
  const d = p._d || (p._d = new Float64Array(n)); d.fill(0);
  let T;
  if (p.fv) { const r = p.fv(V[0] - V[1]); T = r[0]; d[0] = r[1]; d[1] = -r[1]; } else T = p.f(V, d);
  const row = 2 * n, vo = V[2] - V[1], I = g * (vo - T);
  for (let k = 0; k < n; k++) G[row + k] = -g * d[k];
  G[row + 2] += g; G[row + 1] -= g;
  let s = 0; for (let k = 0; k < n; k++) s += G[row + k] * V[k];
  J[2] = I - s;
  for (let k = 0; k < n; k++) G[n + k] = -G[row + k];
  J[1] = -J[2];
  p.iout = -I;
  return false;
};
// two-terminal conductance given by a function of time / state (resistive sensors, contacts, open-collector sinks)
NLMODELS.gfun = function (p) { const g = p.gf(), G = p.G; G[0] = g; G[1] = -g; G[2] = -g; G[3] = g; p.J[0] = 0; p.J[1] = 0; return false; };

const SENS = (() => {
  const en = (vs, von) => { const w = 0.12, s = _sig((vs - von) / w); return [s, s * (1 - s) / w]; };
  const smin = (a, b, w) => { const u = (a - b) / w, s = _sig(u); return [a - w * _softplus(u), 1 - s, s]; };   // value, ∂/∂a, ∂/∂b
  const smax = (a, b, w) => { const u = (a - b) / w, s = _sig(u); return [b + w * _softplus(u), s, 1 - s]; };
  // value of a quantity at time t: the property, or the signal source when one is selected (drives the main quantity 'q')
  const val = (c, t, k) => {
    const P = c.props; k = k || 'q';
    if (k !== 'q' || !P.sig || P.sig === 'const') return +P[k];
    const T = Math.max(+P.sper || 1, 1e-3), ph = ((((t || 0) % T) + T) % T) / T;
    let u;
    switch (P.sig) {
      case 'sine': u = 0.5 - 0.5 * Math.cos(2 * Math.PI * ph); break;
      case 'tri': u = ph < 0.5 ? 2 * ph : 2 - 2 * ph; break;
      case 'square': u = ph < 0.5 ? 0 : 1; break;
      case 'ramp': u = ph; break;
      default: return +P[k];
    }
    return +P.smin + (+P.smax - +P.smin) * u;
  };
  const Q = (c, k) => val(c, SIMCLK.t, k);                                        // inside a solve
  const now = (c, k) => val(c, typeof app !== 'undefined' ? app.t : 0, k);       // for display / state machines
  const fmtq = (p, v) => { const dec = p.dec !== undefined ? p.dec : 0; return (Math.abs(v) < 1e-12 ? 0 : v).toFixed(dec) + (p.unit ? ' ' + p.unit : ''); };
  const qty = (o) => Object.assign({ k: 'q', kind: 'qty', step: 1 }, o, { fmt: (v) => fmtq(o, v) });
  const sig = (q, per) => {
    const nc = (c) => c.props.sig && c.props.sig !== 'const';
    const sp = Object.assign({}, q); delete sp.k; delete sp.lk; delete sp.fmt;
    return [
      { k: 'sig', kind: 'select', label: '信号源 (随仿真时间变化)', lk: 'sens.p.sig', ok: 'sens.o.sig', refresh: true, def: 'const',
        opts: [['const', '无 (恒定，用上面的值)'], ['sine', '正弦'], ['tri', '三角波'], ['square', '方波'], ['ramp', '斜坡 (锯齿)']] },
      qty(Object.assign({}, sp, { k: 'smin', label: '最小值', lk: 'sens.p.smin', def: q.smin !== undefined ? q.smin : q.min, show: nc })),
      qty(Object.assign({}, sp, { k: 'smax', label: '最大值', lk: 'sens.p.smax', def: q.smax !== undefined ? q.smax : q.max, show: nc })),
      qty({ k: 'sper', label: '周期', lk: 'sens.p.sper', unit: 's', min: 0.1, max: 600, step: 0.1, dec: 1, def: per || 10, show: nc }),
    ];
  };
  const thr = (def, label) => ({ k: 'thr', kind: 'range', label: label || 'DO 比较阈值 (电位器)', lk: label ? undefined : 'sens.p.thr', def: def === undefined ? 0.5 : def, fmt: (v) => Math.round(v * 100) + '% VCC' });
  const wheelQ = (c, dir) => { const p = DEFS[c.type].props.find((x) => x.k === 'q'); if (!p) return; const stp = p.wstep || (p.max - p.min) / 40; c.props.q = U.clamp(Math.round((+c.props.q + dir * stp) / p.step) * p.step, p.min, p.max); };
  const lvlTxt = (v) => (v ? 'HIGH' : 'LOW');
  // ---- timed digital edges (HC-SR04 ECHO, DHT DATA, encoder A/B): lists of [t, level], idle level before the first
  const edgeAt = (ed, t, idle) => { let v = idle; if (ed) for (const e of ed) { if (e[0] <= t + 1e-12) v = e[1]; else break; } return v; };
  const edgeNext = (ed, t) => { if (ed) for (const e of ed) if (e[0] > t) return e[0]; return Infinity; };
  const prune = (ed, t) => { while (ed && ed.length > 1 && ed[1][0] < t - 0.05) ed.shift(); };
  const isMcuPin = (app, node) => { if (!(node > 0)) return false; for (const c of app.mcuComps || []) if (c._nodes && c._nodes.includes(node)) return true; return false; };
  const vOf = (m, n) => m.v(n);
  return { en, smin, smax, val, Q, now, qty, sig, thr, fmtq, wheelQ, lvlTxt, edgeAt, edgeNext, prune, isMcuPin, vOf };
})();

// ---------------- drawing helpers ----------------
function sHeader(ctx, c, d, col) {
  const lab = d.pinLab || d.termNames;
  d.terms.forEach(([x, y], i) => {
    D.lead(ctx, x, y, x, y - 10);
    ctx.fillStyle = '#151515'; ctx.fillRect(x - 5, y - 17, 10, 8);
    D.upright(ctx, c, x, y - 22, (ctx) => txt(ctx, lab[i], 0, 0, 'bold 4.6px sans-serif', col || '#e8f0ff'));
  });
}
function sBoard(ctx, c, d, col, x0, y0, x1, y1) { drawPCB(ctx, x0, y0, x1 - x0, y1 - y0, col || '#1f5fbf'); sHeader(ctx, c, d); }
function sLed(ctx, x, y, on, col) { ctx.fillStyle = on ? col : '#3a2020'; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill(); if (on) glow(ctx, x, y, 8, col, 0.8); }
function sPot(ctx, x, y) { ctx.fillStyle = '#2f6fd8'; ctx.fillRect(x - 6, y - 6, 12, 12); ctx.fillStyle = '#e5c86a'; ctx.beginPath(); ctx.arc(x, y, 3.6, 0, 7); ctx.fill(); ctx.strokeStyle = '#7a5d12'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 2.5, y + 2.5); ctx.lineTo(x + 2.5, y - 2.5); ctx.stroke(); }
function sChip(ctx, c, x, y, w, h, label) { ctx.fillStyle = '#1b1b1b'; ctx.fillRect(x - w / 2, y - h / 2, w, h); ctx.fillStyle = '#bbb'; for (let i = 0; i < 4; i++) { ctx.fillRect(x - w / 2 + 2 + i * (w - 4) / 3.4, y - h / 2 - 2, 2, 2); ctx.fillRect(x - w / 2 + 2 + i * (w - 4) / 3.4, y + h / 2, 2, 2); } if (label) D.upright(ctx, c, x, y, (ctx) => txt(ctx, label, 0, 0, '4px sans-serif', '#aaa')); }
function sTitle(ctx, c, x, y, s, col) { D.upright(ctx, c, x, y, (ctx) => txt(ctx, s, 0, 0, 'bold 6px sans-serif', col || '#fff')); }

// ---------------- LM393 comparator modules (VCC, GND, DO, AO) ----------------
// AO from a divider (sensor element + 10 kΩ on the board); DO = LM393 open collector with a 10 kΩ pull-up and an LED.
// pol 'below': DO pulled LOW (LED on) when AO < threshold; 'above': when AO > threshold; hi: DO goes HIGH instead.
function lm393Mod(o) {
  const d = {
    name: o.name, en: o.en, cat: 'sensor', desig: 'U', wheel: true,
    terms: o.terms || [[-30, 40], [-10, 40], [10, 40], [30, 40]], termNames: o.termNames || ['VCC', 'GND', 'DO', 'AO'], box: o.box || [-44, -46, 44, 40],
    props: [o.q].concat(o.extra || [], [SENS.thr(o.thrDef)], SENS.sig(o.q, o.per)),
    frac: o.frac,
    onWheel: (c, dir) => SENS.wheelQ(c, dir),
    label: (c) => SENS.fmtq(o.q, SENS.now(c)),
    trig(c, t) { const r = o.frac(c, SENS.val(c, t))[0], th = c.props.thr; return o.pol === 'above' ? r > th : r < th; },
    doSink(c, t) { const tr = DEFS[c.type].trig(c, t); return o.hi ? !tr : tr; },
    build(c, n, m) {
      const dd = DEFS[c.type], st = c.state;
      c._ao = m.addNL('sens', [n[0], n[1], n[3]], { gf: () => 1 / Math.max(dd.frac(c, SENS.Q(c))[1], 1), fv: (vs) => { const r = dd.frac(c, SENS.Q(c))[0]; return [r * vs, r]; } }, st);
      m.addR(n[0], n[2], 1 / 10000);
      c._do = m.addNL('gfun', [n[2], n[1]], { gf: () => (dd.doSink(c, SIMCLK.t) ? 1 / 50 : 1e-9) }, st);
      m.addR(n[0], n[1], 1 / (o.rq || 1500));
      if (o.heater) m.addR(n[0], n[1], 1 / o.heater);
      c._p = null;
    },
    measure(c, m) { const n = c._nodes, g = m.v(n[1]); c._m.Vcc = m.v(n[0]) - g; c._m.Vao = m.v(n[3]) - g; c._m.Vdo = m.v(n[2]) - g; c._m.V = c._m.Vao; c._m.I = c._m.Vcc / (o.rq || 1500) + (o.heater ? c._m.Vcc / o.heater : 0); },
    readings(c) {
      const M = c._m, v = SENS.now(c), tr = DEFS[c.type].trig(c, app.t);
      const r = [[DEFS[c.type].props[0].label, SENS.fmtq(o.q, v)]];
      if (o.more) r.push(...o.more(c, v));
      r.push(['VCC', U.fmt(M.Vcc || 0, 'V')], ['AO', U.fmt(M.Vao || 0, 'V') + ((M.Vcc || 0) > 1 ? ' (≈' + Math.round(1023 * U.clamp((M.Vao || 0) / M.Vcc, 0, 1)) + '/1023)' : '')],
        ['DO', U.fmt(M.Vdo || 0, 'V') + ' · ' + SENS.lvlTxt((M.Vdo || 0) > 0.5 * (M.Vcc || 5)) + ((M.Vcc || 0) > 2 && tr ? ' · ' + _t('sens.r.triggered') : '')],
        [_t('common.note'), DEFS[c.type].desc]);
      return r;
    },
    draw(ctx, c) {
      const dd = DEFS[c.type], [x0, y0, x1] = dd.box, M = c._m, pw = (M.Vcc || 0) > 2;
      sBoard(ctx, c, dd, o.pcb, x0 + 2, (o.boardTop !== undefined ? o.boardTop : y0 + 2), x1 - 2, 22);
      sPot(ctx, x0 + 14, 8); sChip(ctx, c, 6, 8, 18, 9, 'LM393');
      sLed(ctx, x1 - 10, 2, pw, '#ff4040'); sLed(ctx, x1 - 10, 12, pw && dd.trig(c, typeof app !== 'undefined' ? app.t : 0), '#40ff70');
      o.drawEl(ctx, c, SENS.now(c));
    },
  };
  return d;
}

// element drawings
function drawLdrEl(ctx, c, lux) {
  glow(ctx, 0, -28, 22, '#ffe46a', U.clamp(Math.log10(Math.max(lux, 1)) / 4, 0, 1) * 0.6);
  ctx.fillStyle = D.vgrad(ctx, -38, -18, [[0, '#f7e3b5'], [1, '#c79a4a']]); ctx.beginPath(); ctx.arc(0, -28, 10, 0, 7); ctx.fill();
  ctx.strokeStyle = '#b53a1a'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-6, -32); for (let i = 0; i < 3; i++) { ctx.lineTo(6, -32 + i * 3.5); ctx.lineTo(-6, -30 + i * 3.5); } ctx.stroke();
}
function drawGasEl(ctx, c) {
  ctx.fillStyle = D.vgrad(ctx, -44, -10, [[0, '#e8e8e8'], [1, '#9a9a9a']]); ctx.beginPath(); ctx.arc(0, -22, 19, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(80,80,80,0.6)'; ctx.lineWidth = 0.6; for (let i = -16; i <= 16; i += 4) { ctx.beginPath(); ctx.moveTo(i, -40); ctx.lineTo(i, -4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-18, -22 + i); ctx.lineTo(18, -22 + i); ctx.stroke(); }
  ctx.fillStyle = '#8b6b3a'; ctx.beginPath(); ctx.arc(0, -22, 7, 0, 7); ctx.fill();
  sTitle(ctx, c, 0, -22, c.props.model === 'MQ135' ? 'MQ-135' : 'MQ-2', '#fff');
}
function drawFlameEl(ctx, c, I) {
  if (I > 5) { ctx.save(); ctx.globalAlpha = U.clamp(I / 100, 0.2, 1); ctx.fillStyle = '#ff8a00'; ctx.beginPath(); ctx.moveTo(0, -58); ctx.quadraticCurveTo(12, -46, 6, -38); ctx.quadraticCurveTo(0, -34, -6, -38); ctx.quadraticCurveTo(-12, -46, 0, -58); ctx.fill(); ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.arc(0, -42, 3.5, 0, 7); ctx.fill(); ctx.restore(); }
  D.lead(ctx, -3, -14, -3, -24); D.lead(ctx, 3, -14, 3, -24);
  ctx.fillStyle = '#111'; D.rrect(ctx, -6, -34, 12, 12, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(-4, -32, 2, 7);
}
function drawProbe(ctx, c, wet, col) {
  ctx.fillStyle = col || '#c9a53a';
  for (const x of [-14, 6]) { ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x + 8, -10); ctx.lineTo(x + 8, -60); ctx.lineTo(x + 4, -66); ctx.lineTo(x, -60); ctx.closePath(); ctx.fill(); }
  if (wet > 0) { ctx.fillStyle = 'rgba(80,140,230,' + (0.15 + 0.4 * wet) + ')'; ctx.fillRect(-20, -66 + 56 * (1 - wet), 40, 56 * wet); }
}
function drawRainEl(ctx, c, wet) {
  ctx.fillStyle = '#20202a'; ctx.fillRect(-36, -64, 72, 46);
  ctx.strokeStyle = '#d0b060'; ctx.lineWidth = 1.6;
  for (let i = 0; i < 7; i++) { const y = -60 + i * 6; ctx.beginPath(); ctx.moveTo(i % 2 ? -32 : -28, y); ctx.lineTo(i % 2 ? 28 : 32, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(120,180,255,0.75)'; const n = Math.round(wet / 8); for (let i = 0; i < n; i++) { const x = -30 + ((i * 37) % 60), y = -58 + ((i * 23) % 36); ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); }
}
function drawMicEl(ctx, c, db) {
  ctx.fillStyle = '#c0c0c0'; ctx.beginPath(); ctx.arc(0, -26, 11, 0, 7); ctx.fill(); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, -26, 8, 0, 7); ctx.fill();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 0.6; for (let i = -6; i <= 6; i += 3) { ctx.beginPath(); ctx.moveTo(i, -33); ctx.lineTo(i, -19); ctx.stroke(); }
  const a = U.clamp((db - 40) / 60, 0, 1); if (a > 0.05) { ctx.strokeStyle = 'rgba(255,170,0,' + a + ')'; ctx.lineWidth = 1.5; for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(0, -26, 12 + 4 * i, -2.4, -0.7); ctx.stroke(); } }
}
function drawNtcEl(ctx, c, T) {
  D.lead(ctx, -3, -14, -3, -26); D.lead(ctx, 3, -14, 3, -26);
  const f = U.clamp((T + 20) / 120, 0, 1); ctx.fillStyle = `rgb(${Math.round(60 + 190 * f)},${Math.round(110 - 40 * f)},${Math.round(220 - 180 * f)})`;
  ctx.beginPath(); ctx.arc(0, -30, 6, 0, 7); ctx.fill();
}
function drawTcrtEl(ctx, c, refl) {
  ctx.fillStyle = '#1d4fa8'; ctx.fillRect(-15, -40, 14, 18); ctx.fillStyle = '#111'; ctx.fillRect(1, -40, 14, 18);
  ctx.fillStyle = '#9fc4ff'; ctx.beginPath(); ctx.arc(-8, -31, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(8, -31, 4, 0, 7); ctx.fill();
  const g = Math.round(20 + 220 * U.clamp(refl / 100, 0, 1)); ctx.fillStyle = `rgb(${g},${g},${g})`; ctx.fillRect(-20, -54, 40, 9); ctx.strokeStyle = '#888'; ctx.lineWidth = 0.6; ctx.strokeRect(-20, -54, 40, 9);
}

// ---------------- definitions ----------------
const LUX = SENS.qty({ label: '光照强度', unit: 'lx', min: 0, max: 10000, def: 300, log: true, lmin: 0.1, step: 0.1, dec: 0 });
const R_LDR = (lux) => { const r = 15000 * Math.pow(Math.max(lux, 0.01) / 10, -0.7); return 1 / (1 / r + 1e-6); };   // GL5528-like: ≈15 kΩ @10 lx, γ 0.7, 1 MΩ dark
const div10k = (R) => [R / (R + 10000), R * 10000 / (R + 10000)];
const logInterp = (a, b, f) => Math.exp(Math.log(a) * (1 - f) + Math.log(b) * f);
const MQ_RATIO = (model, ppm) => (model === 'MQ135' ? 1 / (1 / 3.6 + Math.pow(Math.max(ppm, 0) / 102.2, 0.404)) : 1 / (1 / 9.83 + Math.pow(Math.max(ppm, 0) / 574.25, 0.45)));

Object.assign(DEFS, {
  ldrmod: lm393Mod({
    name: '光敏电阻模块', en: 'Photoresistor Module', q: LUX, pol: 'below', drawEl: drawLdrEl,
    frac: (c, lux) => div10k(R_LDR(lux)),
    more: (c, v) => [[_t('sens.r.ldr_r'), U.fmt(R_LDR(v), 'Ω')]],
  }),
  mqgas: lm393Mod({
    name: 'MQ 气体传感器模块', en: 'MQ Gas Sensor Module', heater: 33, pol: 'above', drawEl: drawGasEl, box: [-44, -50, 44, 40], boardTop: -46,
    q: SENS.qty({ label: '气体浓度', unit: 'ppm', min: 0, max: 10000, def: 0, step: 10, log: true, lmin: 1 }),
    extra: [{ k: 'model', kind: 'select', label: '型号', def: 'MQ2', opts: [['MQ2', 'MQ-2 (可燃气体 / 烟雾，按液化气 LPG 曲线)'], ['MQ135', 'MQ-135 (空气质量，按氨气 NH₃ 曲线)']] },
      { k: 'R0', label: 'R0 (参考气体中的 Rs)', unit: 'Ω', def: 10000, min: 100, max: 1e7 }, { k: 'RL', label: '负载电阻 RL (板上)', unit: 'Ω', def: 10000, min: 100, max: 1e6 }],
    frac: (c, ppm) => { const Rs = c.props.R0 * MQ_RATIO(c.props.model, ppm), RL = c.props.RL; return [RL / (RL + Rs), RL * Rs / (RL + Rs)]; },
    more: (c, v) => [['Rs/R0', MQ_RATIO(c.props.model, v).toFixed(2)], [_t('sens.r.heater'), '33 Ω · ≈' + U.fmt((c._m.Vcc || 0) / 33, 'A')]],
  }),
  flame: lm393Mod({
    name: '火焰传感器模块', en: 'Flame Sensor Module', pol: 'below', drawEl: drawFlameEl,
    q: SENS.qty({ label: '火焰红外强度', unit: '%', min: 0, max: 100, def: 0 }),
    frac: (c, I) => div10k(1 / (1e-6 + U.clamp(I, 0, 100) / 100 * 1e-3)),
  }),
  soil: lm393Mod({
    name: '土壤湿度传感器', en: 'Soil Moisture Sensor', pol: 'below', drawEl: (ctx, c, v) => drawProbe(ctx, c, U.clamp(v / 100, 0, 1)), box: [-44, -70, 44, 40], boardTop: -6,
    q: SENS.qty({ label: '土壤湿度', unit: '%', min: 0, max: 100, def: 30 }),
    frac: (c, h) => div10k(logInterp(1e6, 4700, U.clamp(h / 100, 0, 1))),
  }),
  rainmod: lm393Mod({
    name: '雨滴传感器', en: 'Rain Sensor', pol: 'below', drawEl: (ctx, c, v) => drawRainEl(ctx, c, v), box: [-44, -68, 44, 40], boardTop: -14,
    q: SENS.qty({ label: '雨水覆盖面积', unit: '%', min: 0, max: 100, def: 0 }),
    frac: (c, w) => div10k(logInterp(2e6, 2000, U.clamp(w / 100, 0, 1))),
  }),
  ntcmod: lm393Mod({
    name: '热敏电阻模块', en: 'Thermistor Module', pol: 'below', drawEl: drawNtcEl,
    q: SENS.qty({ label: '温度', unit: '°C', min: -20, max: 100, def: 25, step: 0.5, dec: 1 }),
    frac: (c, T) => div10k(10000 * Math.exp(3950 * (1 / (T + 273.15) - 1 / 298.15))),
    more: (c, v) => [[_t('sens.r.ntc_r'), U.fmt(10000 * Math.exp(3950 * (1 / (v + 273.15) - 1 / 298.15)), 'Ω')]],
  }),
  tcrt5000: lm393Mod({
    name: 'TCRT5000 循迹模块', en: 'TCRT5000 Line Tracker', pol: 'below', drawEl: drawTcrtEl, box: [-44, -56, 44, 40],
    q: SENS.qty({ label: '表面反射率', unit: '%', min: 0, max: 100, def: 80 }),
    frac: (c, r) => div10k(logInterp(1e6, 1000, U.clamp(r / 100, 0, 1))),
  }),
  soundmod: lm393Mod({
    name: '声音传感器 (包络输出)', en: 'Sound Sensor (Envelope)', pol: 'above', hi: true, drawEl: drawMicEl,
    q: SENS.qty({ label: '声压级', unit: 'dB', min: 30, max: 110, def: 45, smin: 40, smax: 90 }), per: 2, thrDef: 0.4,
    frac: (c, db) => [0.9 * U.clamp((db - 40) / 60, 0, 1), 1000],
  }),
});

// ---------------- other analog parts ----------------
function to92Sens(o) {
  // TO-92 analog temperature sensor, pins [+Vs, Vout, GND]: Vout = target(T) referenced to GND (Rout 1 Ω), enabled above Von
  return {
    name: o.name, en: o.en, cat: 'sensor', desig: 'U', wheel: true, terms: [[-20, 20], [0, 20], [20, 20]], termNames: ['+Vs', 'Vout', 'GND'], box: [-20, -30, 20, 20],
    props: [o.q].concat(SENS.sig(o.q, 20)),
    onWheel: (c, dir) => SENS.wheelQ(c, dir),
    label: (c) => SENS.fmtq(o.q, SENS.now(c)),
    target: o.target,
    build(c, n, m) {
      c._q = m.addNL('sens', [n[0], n[2], n[1]], { g: 1, fv: (vs) => { const vt = o.target(SENS.Q(c)), [e, de] = SENS.en(vs, o.von), [mm, , db] = SENS.smin(vt, vs - o.hd, 0.05); return [e * mm, de * mm + e * db]; } }, c.state);
      m.addR(n[0], n[2], 1 / o.rq); c._p = null;
    },
    measure(c, m) { const n = c._nodes, g = m.v(n[2]); c._m.Vcc = m.v(n[0]) - g; c._m.Vo = m.v(n[1]) - g; c._m.V = c._m.Vo; c._m.I = c._m.Vcc / o.rq; },
    readings(c) { const M = c._m, T = SENS.now(c); return [[DEFS[c.type].props[0].label, SENS.fmtq(o.q, T)], ['+Vs', U.fmt(M.Vcc || 0, 'V')], ['Vout', U.fmt(M.Vo || 0, 'V')], [_t('sens.r.ideal'), U.fmt(o.target(T), 'V')], [_t('common.note'), DEFS[c.type].desc]]; },
    draw(ctx, c) { drawTO92(ctx, c, [o.mark, '+V O G']); },
  };
}
const TEMPQ = (min, max, def) => SENS.qty({ label: '温度', unit: '°C', min, max, def, step: 0.1, dec: 1 });
const ACS_S = { 5: 0.185, 20: 0.100, 30: 0.066 };
const PRESS_FRAC = (c, P) => {
  const m = c.props.model; let f;
  if (m === 'mpx5010') f = 0.04 + 0.09 * P; else if (m === 'mpx5700') f = 0.04 + 0.0012858 * P; else f = 0.1 + 0.8 * P / c.props.fs;
  return U.clamp(f, 0.02, 0.98);
};

Object.assign(DEFS, {
  waterlvl: {
    name: '水位传感器', en: 'Water Level Sensor', cat: 'sensor', desig: 'U', wheel: true, terms: [[-20, 40], [0, 40], [20, 40]], termNames: ['S', '+', '−'], box: [-24, -76, 24, 40],
    props: [SENS.qty({ label: '浸入深度', unit: 'mm', min: 0, max: 40, def: 0, step: 0.5, dec: 1 })].concat(SENS.sig({ unit: 'mm', min: 0, max: 40, step: 0.5, dec: 1 }, 10)),
    onWheel: (c, dir) => SENS.wheelQ(c, dir),
    label: (c) => SENS.now(c).toFixed(1) + ' mm',
    frac: (d) => 0.65 * Math.sqrt(U.clamp(d / 40, 0, 1)),
    build(c, n, m) { c._q = m.addNL('sens', [n[1], n[2], n[0]], { g: 1 / 1000, fv: (vs) => { const r = DEFS.waterlvl.frac(SENS.Q(c)); return [r * vs, r]; } }, c.state); m.addR(n[1], n[2], 1 / 2500); c._p = null; },
    measure(c, m) { const n = c._nodes, g = m.v(n[2]); c._m.Vcc = m.v(n[1]) - g; c._m.Vo = m.v(n[0]) - g; c._m.V = c._m.Vo; c._m.I = c._m.Vcc / 2500; },
    readings(c) { const M = c._m; return [[DEFS.waterlvl.props[0].label, SENS.now(c).toFixed(1) + ' mm'], ['+', U.fmt(M.Vcc || 0, 'V')], ['S', U.fmt(M.Vo || 0, 'V') + ((M.Vcc || 0) > 1 ? ' (≈' + Math.round(1023 * U.clamp(M.Vo / M.Vcc, 0, 1)) + '/1023)' : '')], [_t('common.note'), DEFS.waterlvl.desc]]; },
    draw(ctx, c) {
      sHeader(ctx, c, DEFS.waterlvl); drawPCB(ctx, -22, -74, 44, 96, '#c0302a');
      ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = 1.6; for (let i = 0; i < 9; i++) { const x = -16 + i * 4; ctx.beginPath(); ctx.moveTo(x, -70); ctx.lineTo(x, i % 2 ? -26 : -30); ctx.stroke(); }
      const f = U.clamp(SENS.now(c) / 40, 0, 1); if (f > 0) { ctx.fillStyle = 'rgba(70,140,230,0.45)'; ctx.fillRect(-24, -70 + 44 * (1 - f), 48, 44 * f); }
      sLed(ctx, 12, 2, (c._m.Vcc || 0) > 2, '#ff4040');
    },
  },
  lm35: to92Sens({ name: 'LM35 温度传感器', en: 'LM35 Temperature Sensor', mark: 'LM35', q: TEMPQ(-55, 150, 25), target: (T) => Math.max(0, 0.01 * T), von: 3.6, hd: 1.0, rq: 1 / 60e-6 * 5 }),
  tmp36: to92Sens({ name: 'TMP36 温度传感器', en: 'TMP36 Temperature Sensor', mark: 'TMP36', q: TEMPQ(-40, 125, 25), target: (T) => 0.5 + 0.01 * U.clamp(T, -40, 125), von: 2.5, hd: 0.6, rq: 1 / 50e-6 * 5 }),
  flex: {
    name: '弯曲传感器', en: 'Flex Sensor', cat: 'sensor', desig: 'R', wheel: true, terms: [[-80, 20], [-60, 20]], termNames: ['1', '2'], box: [-88, -14, 70, 20],
    props: [SENS.qty({ label: '弯曲角度', unit: '°', min: 0, max: 180, def: 0 })].concat(SENS.sig({ unit: '°', min: 0, max: 180 }, 4)),
    onWheel: (c, dir) => SENS.wheelQ(c, dir),
    R: (a) => 25000 + 100000 * U.clamp(a, 0, 180) / 180,
    label: (c) => Math.round(SENS.now(c)) + '° ' + U.fmtShort(DEFS.flex.R(SENS.now(c)), 'Ω'),
    build(c, n, m) { c._g = m.addNL('gfun', [n[0], n[1]], { gf: () => 1 / DEFS.flex.R(SENS.Q(c)) }, c.state); c._p = null; },
    measure(c, m) { const n = c._nodes; c._m.V = m.v(n[0]) - m.v(n[1]); c._m.I = c._m.V / DEFS.flex.R(SENS.now(c)); },
    readings(c) { const a = SENS.now(c); return [[DEFS.flex.props[0].label, Math.round(a) + '°'], [_t('common.resistor'), U.fmt(DEFS.flex.R(a), 'Ω')], [_t('common.voltage'), U.fmt(Math.abs(c._m.V || 0), 'V')], [_t('common.current'), U.fmt(Math.abs(c._m.I || 0), 'A')], [_t('common.note'), DEFS.flex.desc]]; },
    draw(ctx, c) {
      D.lead(ctx, -80, 20, -80, 4); D.lead(ctx, -60, 20, -60, 4);
      const a = U.clamp(SENS.now(c), 0, 180) / 180 * 0.9;
      ctx.save(); ctx.translate(-56, 0);
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(-30, -6, 22, 12);
      ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 9; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(-8, 0);
      const L = 118, N = 20; let x = -8, y = 0, ang = 0; for (let i = 0; i < N; i++) { ang -= a / N * 1.6; x += L / N * Math.cos(ang); y += L / N * Math.sin(ang); ctx.lineTo(x, y); } ctx.stroke();
      ctx.restore();
    },
  },
  fsr: {
    name: '薄膜压力传感器 (FSR)', en: 'Force Sensitive Resistor', cat: 'sensor', desig: 'R', wheel: true, terms: [[-10, 40], [10, 40]], termNames: ['1', '2'], box: [-26, -46, 26, 40],
    props: [SENS.qty({ label: '压力', unit: 'N', min: 0, max: 20, def: 0, step: 0.1, dec: 1 })].concat(SENS.sig({ unit: 'N', min: 0, max: 20, step: 0.1, dec: 1 }, 4)),
    onWheel: (c, dir) => SENS.wheelQ(c, dir),
    R: (F) => (F < 0.2 ? 1e7 : Math.max(250, 10000 / F)),
    label: (c) => SENS.now(c).toFixed(1) + ' N',
    build(c, n, m) { c._g = m.addNL('gfun', [n[0], n[1]], { gf: () => 1 / DEFS.fsr.R(SENS.Q(c)) }, c.state); c._p = null; },
    measure(c, m) { const n = c._nodes; c._m.V = m.v(n[0]) - m.v(n[1]); c._m.I = c._m.V / DEFS.fsr.R(SENS.now(c)); },
    readings(c) { const F = SENS.now(c); return [[DEFS.fsr.props[0].label, F.toFixed(1) + ' N (≈' + Math.round(F / 9.81 * 1000) + ' g)'], [_t('common.resistor'), F < 0.2 ? '> 10 MΩ' : U.fmt(DEFS.fsr.R(F), 'Ω')], [_t('common.voltage'), U.fmt(Math.abs(c._m.V || 0), 'V')], [_t('common.current'), U.fmt(Math.abs(c._m.I || 0), 'A')], [_t('common.note'), DEFS.fsr.desc]]; },
    draw(ctx, c) {
      D.lead(ctx, -10, 40, -10, 20); D.lead(ctx, 10, 40, 10, 20);
      ctx.fillStyle = '#c9a53a'; ctx.fillRect(-7, -6, 14, 28);
      const F = U.clamp(SENS.now(c) / 20, 0, 1);
      ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(0, -22, 22, 0, 7); ctx.fill();
      ctx.fillStyle = `rgb(${Math.round(80 + 150 * F)},${Math.round(80 + 40 * F)},60)`; ctx.beginPath(); ctx.arc(0, -22, 15, 0, 7); ctx.fill();
      ctx.strokeStyle = '#555'; ctx.lineWidth = 0.7; for (let r = 4; r < 15; r += 3.5) { ctx.beginPath(); ctx.arc(0, -22, r, 0, 7); ctx.stroke(); }
      if (F > 0.01) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(0, -36 + 6 * F); ctx.lineTo(-5, -46 + 6 * F); ctx.lineTo(5, -46 + 6 * F); ctx.fill(); }
    },
  },
  joystick: {
    name: '双轴摇杆模块', en: 'Joystick Module', cat: 'sensor', desig: 'U', momentary: true, wheel: true,
    terms: [[-40, 40], [-20, 40], [0, 40], [20, 40], [40, 40]], termNames: ['GND', '+5V', 'VRx', 'VRy', 'SW'], box: [-50, -60, 50, 40],
    props: [SENS.qty({ label: 'X 轴位置', unit: '%', min: -100, max: 100, def: 0 }), SENS.qty({ k: 'q2', label: 'Y 轴位置', unit: '%', min: -100, max: 100, def: 0 }), { k: 'btn', kind: 'bool', label: '按钮保持按下', def: false }]
      .concat(SENS.sig({ unit: '%', min: -100, max: 100 }, 4)),
    pressHit: (c, lx, ly) => Math.hypot(lx, ly + 18) < 22,
    onWheel: (c, dir) => SENS.wheelQ(c, dir),
    label: (c) => 'X ' + Math.round(SENS.now(c)) + '% Y ' + Math.round(c.props.q2) + '%',
    build(c, n, m) {
      const st = c.state, a = (k) => U.clamp(0.5 + SENS.Q(c, k) / 200, 0, 1);
      for (const [k, w] of [['q', 2], ['q2', 3]]) {
        m.addNL('gfun', [n[1], n[w]], { gf: () => 1 / (10000 * (1 - a(k)) + 30) }, st);
        m.addNL('gfun', [n[w], n[0]], { gf: () => 1 / (10000 * a(k) + 30) }, st);
      }
      m.addNL('gfun', [n[4], n[0]], { gf: () => (st.pressed || c.props.btn ? 1 : 1e-9) }, st);
      c._p = null;
    },
    measure(c, m) { const n = c._nodes, g = m.v(n[0]); c._m.Vcc = m.v(n[1]) - g; c._m.Vx = m.v(n[2]) - g; c._m.Vy = m.v(n[3]) - g; c._m.Vsw = m.v(n[4]) - g; c._m.V = c._m.Vx; c._m.I = 2 * c._m.Vcc / 10000; },
    readings(c) {
      const M = c._m, P = c.props, adc = (v) => ((M.Vcc || 0) > 1 ? ' (≈' + Math.round(1023 * U.clamp(v / M.Vcc, 0, 1)) + ')' : '');
      return [['X', Math.round(SENS.now(c)) + '%'], ['Y', Math.round(P.q2) + '%'], ['VRx', U.fmt(M.Vx || 0, 'V') + adc(M.Vx || 0)], ['VRy', U.fmt(M.Vy || 0, 'V') + adc(M.Vy || 0)],
        ['SW', c.state.pressed || P.btn ? _t('sens.r.pressed') : _t('sens.r.released')], [_t('common.note'), DEFS.joystick.desc]];
    },
    draw(ctx, c) {
      sBoard(ctx, c, DEFS.joystick, '#1a1a1a', -48, -58, 48, 22);
      const x = U.clamp(SENS.now(c), -100, 100) / 100 * 12, y = -U.clamp(c.props.q2, -100, 100) / 100 * 12, pr = c.state.pressed || c.props.btn;
      ctx.fillStyle = '#d0d0d0'; ctx.beginPath(); ctx.arc(0, -18, 26, 0, 7); ctx.fill();
      ctx.fillStyle = pr ? '#333' : '#111'; ctx.beginPath(); ctx.arc(x, -18 + y, pr ? 15 : 17, 0, 7); ctx.fill();
      ctx.strokeStyle = '#444'; ctx.lineWidth = 1; for (let r = 5; r < 16; r += 4) { ctx.beginPath(); ctx.arc(x, -18 + y, r, 0, 7); ctx.stroke(); }
    },
  },
  acs712: {
    name: 'ACS712 电流传感器', en: 'ACS712 Current Sensor', cat: 'sensor', desig: 'U', wheel: true,
    terms: [[-20, 40], [0, 40], [20, 40], [-20, -60], [20, -60]], termNames: ['VCC', 'OUT', 'GND', 'IP+', 'IP−'], box: [-40, -60, 40, 40],
    props: [{ k: 'range', kind: 'select', label: '量程', num: true, def: 5, opts: [[5, '±5 A (185 mV/A)'], [20, '±20 A (100 mV/A)'], [30, '±30 A (66 mV/A)']] },
      SENS.qty({ label: '附加模拟电流 (演示用，叠加在 IP 电流上)', unit: 'A', min: -30, max: 30, def: 0, step: 0.01, dec: 2 })].concat(SENS.sig({ unit: 'A', min: -30, max: 30, step: 0.01, dec: 2, smin: -2, smax: 2 }, 2)),
    onWheel(c, dir) { c.props.q = U.clamp(Math.round((+c.props.q + dir * 0.1) * 100) / 100, -30, 30); },
    label: (c) => U.fmt(DEFS.acs712.Itot(c), 'A'),
    Itot(c) { return (c._m.Iip || 0) + SENS.now(c); },
    build(c, n, m) {
      const Rp = 0.0012, S = ACS_S[c.props.range] || 0.185;
      c._rip = m.addR(n[3], n[4], 1 / Rp);
      c._q = m.addNL('sens', [n[0], n[2], n[1], n[3], n[4]], {
        g: 1 / 10, iso: [[0, 1, 2], [3, 4]],
        f: (V, d) => {
          const vs = V[0] - V[1], I = (V[3] - V[4]) / Rp + SENS.Q(c), [e, de] = SENS.en(vs, 4.0);
          const raw = vs * (0.5 + 0.2 * S * I), [m1, a1] = SENS.smax(raw, 0.05, 0.03), [m2, a2, b2] = SENS.smin(m1, vs - 0.05, 0.03);
          const dr = a2 * a1;
          d[0] = de * m2 + e * (dr * (0.5 + 0.2 * S * I) + b2); d[1] = -d[0];
          d[3] = e * dr * vs * 0.2 * S / Rp; d[4] = -d[3];
          return e * m2;
        },
      }, c.state);
      m.addR(n[0], n[2], 1 / 500); c._p = null;
    },
    measure(c, m) { const n = c._nodes, g = m.v(n[2]); c._m.Vcc = m.v(n[0]) - g; c._m.Vo = m.v(n[1]) - g; c._m.Iip = c._rip.i; c._m.V = c._m.Vo; c._m.I = c._m.Iip; },
    readings(c) {
      const M = c._m, S = ACS_S[c.props.range] || 0.185, I = DEFS.acs712.Itot(c);
      return [[_t('sens.r.ip_current'), U.fmt(M.Iip || 0, 'A')], [_t('sens.r.sensed_current'), U.fmt(I, 'A')], ['VCC', U.fmt(M.Vcc || 0, 'V')], ['OUT', U.fmt(M.Vo || 0, 'V')],
        [_t('sens.r.ideal'), U.fmt((M.Vcc || 5) * (0.5 + 0.2 * S * I), 'V')], [_t('sens.r.sensitivity'), Math.round(S * 1000) + ' mV/A @5 V'], [_t('common.note'), DEFS.acs712.desc]];
    },
    draw(ctx, c) {
      sBoard(ctx, c, { terms: DEFS.acs712.terms.slice(0, 3), termNames: ['VCC', 'OUT', 'GND'] }, '#b8262a', -38, -46, 38, 22);
      for (const x of [-20, 20]) { D.lead(ctx, x, -60, x, -50); drawScrew(ctx, x, -38); }
      ctx.fillStyle = '#1e5bb8'; ctx.fillRect(-32, -48, 64, 3);
      sChip(ctx, c, 0, -8, 18, 12, 'ACS712');
      D.upright(ctx, c, 0, -54, (ctx) => txt(ctx, 'IP+        IP−', 0, 0, 'bold 5px sans-serif', '#333'));
      sLed(ctx, 26, 10, (c._m.Vcc || 0) > 2, '#ff4040');
    },
  },
  pressure: {
    name: '压力传感器 (模拟输出)', en: 'Pressure Sensor (Analog)', cat: 'sensor', desig: 'U', wheel: true, terms: [[-20, 40], [0, 40], [20, 40]], termNames: ['+5V', 'GND', 'OUT'], box: [-28, -74, 28, 40],
    props: [{ k: 'model', kind: 'select', label: '型号', def: 'gen', opts: [['gen', '通用压力变送器 0.5–4.5 V (表压)'], ['mpx5010', 'MPX5010DP (0–10 kPa 压差)'], ['mpx5700', 'MPX5700AP (15–700 kPa 绝压)']] },
      { k: 'fs', kind: 'select', label: '满量程 (通用型)', num: true, def: 1200, opts: [[100, '100 kPa'], [500, '500 kPa'], [1200, '1.2 MPa'], [1600, '1.6 MPa']] },
      SENS.qty({ label: '压力', unit: 'kPa', min: 0, max: 1600, def: 300, step: 0.1, dec: 1 })].concat(SENS.sig({ unit: 'kPa', min: 0, max: 1600, step: 0.1, dec: 1, smin: 0, smax: 1000 }, 10)),
    onWheel: (c, dir) => SENS.wheelQ(c, dir),
    label: (c) => SENS.now(c).toFixed(1) + ' kPa',
    build(c, n, m) { c._q = m.addNL('sens', [n[0], n[1], n[2]], { g: 1 / 100, fv: (vs) => { const r = PRESS_FRAC(c, SENS.Q(c)), [e, de] = SENS.en(vs, 3.5); return [e * r * vs, de * r * vs + e * r]; } }, c.state); m.addR(n[0], n[1], 1 / 700); c._p = null; },
    measure(c, m) { const n = c._nodes, g = m.v(n[1]); c._m.Vcc = m.v(n[0]) - g; c._m.Vo = m.v(n[2]) - g; c._m.V = c._m.Vo; c._m.I = c._m.Vcc / 700; },
    readings(c) { const M = c._m, P = SENS.now(c); return [[DEFS.pressure.props[2].label, P.toFixed(1) + ' kPa'], ['+5V', U.fmt(M.Vcc || 0, 'V')], ['OUT', U.fmt(M.Vo || 0, 'V')], [_t('sens.r.ideal'), U.fmt((M.Vcc || 5) * PRESS_FRAC(c, P), 'V') + ' (' + Math.round(PRESS_FRAC(c, P) * 100) + '% VCC)'], [_t('common.note'), DEFS.pressure.desc]]; },
    draw(ctx, c) {
      sHeader(ctx, c, DEFS.pressure, '#333');
      ctx.fillStyle = D.vgrad(ctx, -70, 0, [[0, '#d9dde2'], [1, '#8a939c']]); ctx.fillRect(-16, -50, 32, 50);
      ctx.fillStyle = '#9aa2aa'; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(22 * Math.cos(a), -54 + 9 * Math.sin(a)); } ctx.fill();
      ctx.fillStyle = '#b8b8b8'; ctx.fillRect(-6, -74, 12, 14); ctx.strokeStyle = '#666'; for (let y = -72; y < -60; y += 3) { ctx.beginPath(); ctx.moveTo(-6, y); ctx.lineTo(6, y); ctx.stroke(); }
      ctx.fillStyle = '#222'; ctx.fillRect(-12, 0, 24, 14);
      sTitle(ctx, c, 0, -26, c.props.model === 'gen' ? '0.5-4.5V' : c.props.model.toUpperCase(), '#223');
    },
  },
});

// ---------------- digital modules ----------------
// open-collector style output with an on-board 10 kΩ pull-up: sink(c,t) true → LOW
function addOD(c, m, nv, no, ng, sink) {
  m.addR(nv, no, 1 / 10000);
  return m.addNL('gfun', [no, ng], { gf: () => (sink(c, SIMCLK.t) ? 1 / 50 : 1e-9) }, c.state);
}
// push-pull logic output: HIGH = min(vhi, VCC) when hi(c,t), referenced to the module ground; works above von
function addPP(c, m, nv, ng, no, hi, vhi, von, g) {
  return m.addNL('sens', [nv, ng, no], {
    g: g || 1 / 100,
    fv: (vs) => {
      if (!hi(c, SIMCLK.t)) return [0, 0];
      const [e, de] = SENS.en(vs, von);
      if (vhi === undefined) return [e * vs, de * vs + e];
      const [mm, , db] = SENS.smin(vhi, vs - 0.05, 0.05); return [e * mm, de * mm + e * db];
    },
  }, c.state);
}
const MOTION = SENS.qty({ label: '检测到人体移动 (0/1)', unit: '', min: 0, max: 1, def: 0, step: 1 });
const vccOf = (c) => c._m.Vcc || 0;
const ON = (b) => (b ? _t('sens.r.on') : _t('sens.r.off'));

Object.assign(DEFS, {
  pir: {
    name: 'HC-SR501 人体红外传感器', en: 'HC-SR501 PIR Motion Sensor', cat: 'sensor', desig: 'U', wheel: true,
    terms: [[-20, 40], [0, 40], [20, 40]], termNames: ['VCC', 'OUT', 'GND'], box: [-36, -50, 36, 40],
    props: [MOTION, SENS.qty({ k: 'tx', label: '延时 Tx (电位器)', unit: 's', min: 3, max: 300, def: 5, step: 0.5, dec: 1 }),
      { k: 'mode', kind: 'select', label: '触发方式 (跳线)', def: 'H', opts: [['H', 'H：可重复触发 (有人移动就延长)'], ['L', 'L：不可重复触发']] }]
      .concat(SENS.sig(MOTION, 20)),
    acts: [{ k: 'walk', label: '模拟有人走过 (1 秒)' }],
    act(c, k, app) { if (k === 'walk') { c.state.walk = (app ? app.t : 0) + 1; } },
    click(c, app) { DEFS.pir.act(c, 'walk', app); },
    onWheel(c, dir) { c.props.q = dir > 0 ? 1 : 0; },
    label: (c) => (c.state.on ? 'OUT=H' : 'OUT=L'),
    motion: (c, t) => SENS.val(c, t) >= 0.5 || t < (c.state.walk || -1),
    build(c, n, m) { c._o = addPP(c, m, n[0], n[2], n[1], (c) => !!c.state.on, 3.3, 4.2, 1 / 200); m.addR(n[0], n[2], 1 / 100000); c._p = null; },
    measure(c, m) { const n = c._nodes, g = m.v(n[2]); c._m.Vcc = m.v(n[0]) - g; c._m.Vo = m.v(n[1]) - g; c._m.V = c._m.Vo; c._m.I = c._m.Vcc / 100000; },
    post(c, dt, app) {
      const st = c.state, t = app.t, P = c.props, mo = DEFS.pir.motion(c, t);
      if (vccOf(c) < 4.5) { if (st.on) { st.on = false; app.net.needStamp = true; } st.blk = 0; return; }
      const was = !!st.on;
      if (st.on) { if (P.mode === 'H' && mo) st.off = t + +P.tx; if (t >= st.off) { st.on = false; st.blk = t + 2.5; } }
      else if (mo && t >= (st.blk || 0)) { st.on = true; st.off = t + +P.tx; }
      if (was !== !!st.on) app.net.needStamp = true;
    },
    readings(c) {
      const st = c.state, M = c._m, t = typeof app !== 'undefined' ? app.t : 0;
      return [[_t('sens.r.motion'), DEFS.pir.motion(c, t) ? _t('sens.r.yes') : _t('sens.r.no')], ['OUT', U.fmt(M.Vo || 0, 'V') + ' · ' + SENS.lvlTxt(!!st.on)],
        [_t('sens.r.remaining'), st.on ? Math.max(0, st.off - t).toFixed(1) + ' s' : t < (st.blk || 0) ? _t('sens.r.blocked') + ' ' + (st.blk - t).toFixed(1) + ' s' : '—'],
        ['VCC', U.fmt(M.Vcc || 0, 'V') + (vccOf(c) < 4.5 ? ' (< 4.5 V)' : '')], [_t('common.note'), DEFS.pir.desc]];
    },
    draw(ctx, c) {
      sBoard(ctx, c, DEFS.pir, '#1c7a3a', -34, -10, 34, 22);
      ctx.fillStyle = '#f2f2ee'; ctx.beginPath(); ctx.arc(0, -16, 30, Math.PI, 0); ctx.lineTo(30, -6); ctx.lineTo(-30, -6); ctx.fill();
      ctx.strokeStyle = '#d0d0c8'; ctx.lineWidth = 1; for (let a = -2; a <= 2; a++) { ctx.beginPath(); ctx.moveTo(a * 11, -6); ctx.lineTo(a * 6, -44); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, -16, 18, Math.PI, 0); ctx.stroke();
      sPot(ctx, -20, 10); sPot(ctx, 20, 10);
      if (c.state.on) glow(ctx, 0, -20, 26, '#ff6040', 0.35);
    },
  },
  irobst: {
    name: '红外避障模块', en: 'IR Obstacle Sensor', cat: 'sensor', desig: 'U', wheel: true,
    terms: [[-20, 40], [0, 40], [20, 40]], termNames: ['OUT', 'GND', 'VCC'], box: [-30, -60, 30, 40],
    props: [SENS.qty({ label: '障碍物距离', unit: 'cm', min: 0, max: 100, def: 50, step: 0.5, dec: 1 }), SENS.qty({ k: 'dthr', label: '检测距离 (电位器)', unit: 'cm', min: 2, max: 30, def: 10, step: 0.5, dec: 1 })]
      .concat(SENS.sig({ unit: 'cm', min: 0, max: 100, step: 0.5, dec: 1, smin: 3, smax: 30 }, 4)),
    onWheel: (c, dir) => SENS.wheelQ(c, dir),
    label: (c) => SENS.now(c).toFixed(1) + ' cm',
    det: (c, t) => SENS.val(c, t) <= +c.props.dthr,
    build(c, n, m) { c._o = addOD(c, m, n[2], n[0], n[1], (c, t) => DEFS.irobst.det(c, t)); m.addR(n[2], n[1], 1 / 250); c._p = null; },
    measure(c, m) { const n = c._nodes, g = m.v(n[1]); c._m.Vcc = m.v(n[2]) - g; c._m.Vo = m.v(n[0]) - g; c._m.V = c._m.Vo; c._m.I = c._m.Vcc / 250; },
    readings(c) { const M = c._m, t = app.t, dt = DEFS.irobst.det(c, t); return [[DEFS.irobst.props[0].label, SENS.now(c).toFixed(1) + ' cm'], ['OUT', U.fmt(M.Vo || 0, 'V') + ' · ' + SENS.lvlTxt((M.Vo || 0) > 0.5 * (M.Vcc || 5)) + (dt && vccOf(c) > 2 ? ' · ' + _t('sens.r.obstacle') : '')], ['VCC', U.fmt(M.Vcc || 0, 'V')], [_t('common.note'), DEFS.irobst.desc]]; },
    draw(ctx, c) {
      const pw = vccOf(c) > 2;
      sBoard(ctx, c, DEFS.irobst, '#1f5fbf', -28, -30, 28, 22);
      for (const [x, col] of [[-12, '#e8f4ff'], [12, '#1a1a1a']]) { D.lead(ctx, x, -30, x, -40); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, -48, 6, Math.PI, 0); ctx.lineTo(x + 6, -40); ctx.lineTo(x - 6, -40); ctx.fill(); ctx.strokeStyle = '#888'; ctx.lineWidth = 0.6; ctx.stroke(); }
      sPot(ctx, 0, -14); sChip(ctx, c, 0, 6, 16, 8, 'LM393');
      sLed(ctx, -20, -2, pw, '#ff4040'); sLed(ctx, 20, -2, pw && DEFS.irobst.det(c, app.t), '#40ff70');
      const d = U.clamp(SENS.now(c), 0, 100); if (d < 60) { ctx.fillStyle = '#8a6a4a'; ctx.fillRect(-26, -58 - d * 0.3 + 0, 52, 4); }
    },
  },
  tilt: {
    name: '倾斜开关 (SW-520D)', en: 'Tilt Switch (SW-520D)', cat: 'sensor', desig: 'S', wheel: true, terms: [[-10, 30], [10, 30]], termNames: ['1', '2'], box: [-16, -34, 16, 30],
    props: [SENS.qty({ label: '倾斜角度', unit: '°', min: 0, max: 180, def: 0 })].concat(SENS.sig({ unit: '°', min: 0, max: 180, smin: 0, smax: 90 }, 4)),
    onWheel: (c, dir) => SENS.wheelQ(c, dir),
    click(c) { c.props.q = +c.props.q < 45 ? 90 : 0; },
    label: (c) => Math.round(SENS.now(c)) + '°',
    closedAt(c, a) { const st = c.state; if (st.cl === undefined) st.cl = a < 45; if (a < 30) st.cl = true; else if (a > 60) st.cl = false; return st.cl; },
    build(c, n, m) { c._g = m.addNL('gfun', [n[0], n[1]], { gf: () => (DEFS.tilt.closedAt(c, SENS.Q(c)) ? 1 / 5 : 1e-9) }, c.state); c._p = null; },
    measure(c, m) { const n = c._nodes; c._m.V = m.v(n[0]) - m.v(n[1]); c._m.I = c._m.V * (c.state.cl ? 0.2 : 1e-9); },
    readings(c) { return [[DEFS.tilt.props[0].label, Math.round(SENS.now(c)) + '°'], [_t('common.contacts'), c.state.cl ? _t('sens.r.closed') : _t('sens.r.open')], [_t('common.current'), U.fmt(Math.abs(c._m.I || 0), 'A')], [_t('common.note'), DEFS.tilt.desc]]; },
    draw(ctx, c) {
      D.lead(ctx, -10, 30, -6, 8); D.lead(ctx, 10, 30, 6, 8);
      const a = U.clamp(SENS.now(c), 0, 180) * Math.PI / 180;
      ctx.save(); ctx.translate(0, -8); ctx.rotate(a);
      ctx.fillStyle = D.vgrad(ctx, -24, 16, [[0, '#e0e0e0'], [0.5, '#9aa'], [1, '#556']]); D.rrect(ctx, -9, -24, 18, 40, 5); ctx.fill();
      ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(0, c.state.cl ? 9 : -16, 5, 0, 7); ctx.fill(); ctx.restore();
    },
  },
  sw420: {
    name: 'SW-420 振动传感器模块', en: 'SW-420 Vibration Sensor', cat: 'sensor', desig: 'U', wheel: true,
    terms: [[-20, 40], [0, 40], [20, 40]], termNames: ['VCC', 'GND', 'DO'], box: [-36, -40, 36, 40],
    props: [SENS.qty({ label: '振动强度', unit: '%', min: 0, max: 100, def: 0 }), SENS.thr(0.3, '灵敏度阈值 (电位器)')].concat(SENS.sig({ unit: '%', min: 0, max: 100 }, 3)),
    acts: [{ k: 'knock', label: '敲一下 (0.3 秒)' }],
    act(c, k, app) { if (k === 'knock') c.state.knock = (app ? app.t : 0) + 0.3; },
    click(c, app) { DEFS.sw420.act(c, 'knock', app); },
    onWheel: (c, dir) => SENS.wheelQ(c, dir),
    label: (c) => Math.round(SENS.now(c)) + '%',
    vib: (c, t) => SENS.val(c, t) / 100 > +c.props.thr || t < (c.state.knock || -1),
    build(c, n, m) { c._o = addOD(c, m, n[0], n[2], n[1], (c, t) => !DEFS.sw420.vib(c, t)); m.addR(n[0], n[1], 1 / 1500); c._p = null; },
    measure(c, m) { const n = c._nodes, g = m.v(n[1]); c._m.Vcc = m.v(n[0]) - g; c._m.Vo = m.v(n[2]) - g; c._m.V = c._m.Vo; c._m.I = c._m.Vcc / 1500; },
    readings(c) { const M = c._m; return [[DEFS.sw420.props[0].label, Math.round(SENS.now(c)) + '%'], ['DO', U.fmt(M.Vo || 0, 'V') + ' · ' + SENS.lvlTxt((M.Vo || 0) > 0.5 * (M.Vcc || 5))], ['VCC', U.fmt(M.Vcc || 0, 'V')], [_t('common.note'), DEFS.sw420.desc]]; },
    draw(ctx, c) {
      const pw = vccOf(c) > 2, v = DEFS.sw420.vib(c, app.t);
      sBoard(ctx, c, DEFS.sw420, '#1f5fbf', -34, -38, 34, 22);
      ctx.save(); if (v) ctx.translate(Math.sin(app.t * 300) * 1.5, 0);
      ctx.fillStyle = D.vgrad(ctx, -34, -18, [[0, '#f4f4f4'], [1, '#9a9a9a']]); D.rrect(ctx, -22, -32, 26, 12, 5); ctx.fill(); ctx.restore();
      sPot(ctx, 20, -24); sChip(ctx, c, -8, 4, 18, 9, 'LM393');
      sLed(ctx, 16, -4, pw, '#ff4040'); sLed(ctx, 16, 8, pw && v, '#40ff70');
    },
  },
  ttp223: {
    name: 'TTP223 触摸模块', en: 'TTP223 Touch Module', cat: 'sensor', desig: 'U', momentary: true,
    terms: [[-20, 40], [0, 40], [20, 40]], termNames: ['VCC', 'I/O', 'GND'], box: [-28, -40, 28, 40], pinLab: ['VCC', 'I/O', 'GND'],
    props: [SENS.qty({ label: '手指触摸 (0/1)', unit: '', min: 0, max: 1, def: 0, step: 1 }),
      { k: 'mode', kind: 'select', label: '工作模式 (焊盘 A/B)', def: 'mom', opts: [['mom', '点动，高电平有效 (默认)'], ['tog', '自锁 (每摸一下翻转)'], ['low', '点动，低电平有效']] }]
      .concat(SENS.sig(SENS.qty({ unit: '', min: 0, max: 1, step: 1 }), 4)),
    onWheel(c, dir) { c.props.q = dir > 0 ? 1 : 0; },
    label: (c) => (c.state.out ? 'I/O=H' : 'I/O=L'),
    touched: (c, t) => !!c.state.pressed || SENS.val(c, t) >= 0.5,
    build(c, n, m) { const st = c.state; if (st.out === undefined) st.out = c.props.mode === 'low'; c._o = addPP(c, m, n[0], n[2], n[1], (c) => !!c.state.out, undefined, 2.0); m.addR(n[0], n[2], 1 / 2e6); c._p = null; },
    measure(c, m) { const n = c._nodes, g = m.v(n[2]); c._m.Vcc = m.v(n[0]) - g; c._m.Vo = m.v(n[1]) - g; c._m.V = c._m.Vo; c._m.I = 0; },
    post(c, dt, app) {
      const st = c.state, T = DEFS.ttp223.touched(c, app.t), md = c.props.mode, was = st.out;
      if (md === 'tog') { if (T && !st.lastT) st.out = !st.out; } else st.out = md === 'low' ? !T : T;
      st.lastT = T; if (was !== st.out) app.net.needStamp = true;
    },
    readings(c) { const M = c._m, T = DEFS.ttp223.touched(c, app.t); return [[_t('sens.r.touch'), T ? _t('sens.r.yes') : _t('sens.r.no')], ['I/O', U.fmt(M.Vo || 0, 'V') + ' · ' + SENS.lvlTxt(!!c.state.out)], ['VCC', U.fmt(M.Vcc || 0, 'V') + (vccOf(c) < 2.0 ? ' (< 2.0 V)' : '')], [_t('common.note'), DEFS.ttp223.desc]]; },
    draw(ctx, c) {
      sBoard(ctx, c, DEFS.ttp223, '#c0302a', -26, -38, 26, 22);
      const T = !!c.state.pressed || +c.props.q >= 0.5;
      ctx.fillStyle = T ? '#f0d070' : '#d8b04a'; ctx.beginPath(); ctx.arc(0, -12, 18, 0, 7); ctx.fill();
      ctx.strokeStyle = '#7a5a12'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -12, 13, 0, 7); ctx.stroke();
      sLed(ctx, 18, 12, c.state.out !== (c.props.mode === 'low') && vccOf(c) > 2, '#ff4040');
      if (T) { ctx.fillStyle = 'rgba(255,220,190,0.75)'; ctx.beginPath(); ctx.ellipse(4, -8, 8, 11, 0.4, 0, 7); ctx.fill(); }
    },
  },
  encoder: {
    name: 'KY-040 旋转编码器', en: 'KY-040 Rotary Encoder', cat: 'sensor', desig: 'U', momentary: true, wheel: true,
    terms: [[-40, 40], [-20, 40], [0, 40], [20, 40], [40, 40]], termNames: ['GND', '+', 'SW', 'DT', 'CLK'], box: [-48, -50, 48, 40],
    props: [SENS.qty({ k: 'spin', label: '自动旋转速度 (格/秒，+顺时针 / −逆时针)', unit: '/s', min: -20, max: 20, def: 0, step: 0.5, dec: 1 })],
    acts: [{ k: 'ccw', label: '⟲ 逆时针一格' }, { k: 'cw', label: '⟳ 顺时针一格' }],
    pressHit: (c, lx, ly) => Math.abs(lx) < 9 && Math.abs(ly + 14) < 22,
    onWheel(c, dir) { DEFS.encoder.rot(c, dir > 0 ? 1 : -1, typeof app !== 'undefined' ? app.t : 0); },
    click(c, app, lx, ly) { if (Math.abs(lx) >= 9) DEFS.encoder.rot(c, lx > 0 ? 1 : -1, app.t); },
    act(c, k, app) { DEFS.encoder.rot(c, k === 'cw' ? 1 : -1, app ? app.t : 0); },
    label: (c) => 'pos ' + (c.state.pos || 0),
    // one detent = a full quadrature cycle on CLK (A) and DT (B), 2 ms per phase; clockwise: CLK leads DT
    rot(c, dir, t) {
      const st = c.state, P = 0.002; st.edA = st.edA || []; st.edB = st.edB || [];
      SENS.prune(st.edA, t); SENS.prune(st.edB, t);
      const s = Math.max(t + 0.0005, st.busy || 0), [first, second] = dir > 0 ? [st.edA, st.edB] : [st.edB, st.edA];
      first.push([s, 0]); second.push([s + P, 0]); first.push([s + 2 * P, 1]); second.push([s + 3 * P, 1]);
      st.edA.sort((a, b) => a[0] - b[0]); st.edB.sort((a, b) => a[0] - b[0]);
      st.busy = s + 4 * P + 0.0005; st.pos = (st.pos || 0) + dir;
      if (typeof app !== 'undefined' && app.net) app.net.needStamp = true;
    },
    nextEdge(c, t) { const st = c.state; return Math.min(SENS.edgeNext(st.edA, t), SENS.edgeNext(st.edB, t)); },
    build(c, n, m) {
      const st = c.state;
      m.addR(n[1], n[4], 1 / 10000); m.addR(n[1], n[3], 1 / 10000);
      m.addNL('gfun', [n[4], n[0]], { gf: () => (SENS.edgeAt(st.edA, SIMCLK.t, 1) ? 1e-9 : 1 / 2) }, st);
      m.addNL('gfun', [n[3], n[0]], { gf: () => (SENS.edgeAt(st.edB, SIMCLK.t, 1) ? 1e-9 : 1 / 2) }, st);
      m.addNL('gfun', [n[2], n[0]], { gf: () => (st.pressed ? 1 / 2 : 1e-9) }, st);
      c._p = null;
    },
    measure(c, m) { const n = c._nodes, g = m.v(n[0]); c._m.Vcc = m.v(n[1]) - g; c._m.Va = m.v(n[4]) - g; c._m.Vb = m.v(n[3]) - g; c._m.Vsw = m.v(n[2]) - g; c._m.V = c._m.Va; c._m.I = 0; },
    post(c, dt, app) {
      const st = c.state, sp = +c.props.spin;
      if (sp) { st.acc = (st.acc || 0) + sp * dt; while (Math.abs(st.acc) >= 1 && (st.busy || 0) < app.t + 0.05) { const d = Math.sign(st.acc); st.acc -= d; DEFS.encoder.rot(c, d, app.t); } }
      if (st.edA) SENS.prune(st.edA, app.t); if (st.edB) SENS.prune(st.edB, app.t);
    },
    readings(c) {
      const M = c._m, st = c.state;
      return [[_t('sens.r.position'), String(st.pos || 0)], ['CLK / DT', SENS.lvlTxt((M.Va || 0) > 0.5 * (M.Vcc || 5)) + ' / ' + SENS.lvlTxt((M.Vb || 0) > 0.5 * (M.Vcc || 5))],
        ['SW', st.pressed ? _t('sens.r.pressed') : _t('sens.r.released')], ['+', U.fmt(M.Vcc || 0, 'V')], [_t('common.note'), DEFS.encoder.desc]];
    },
    draw(ctx, c) {
      sBoard(ctx, c, DEFS.encoder, '#1f5fbf', -46, -48, 46, 22);
      ctx.fillStyle = '#9aa0a8'; ctx.fillRect(-16, -30, 32, 32);
      const a = (c.state.pos || 0) * Math.PI / 10;
      ctx.fillStyle = c.state.pressed ? '#555' : '#333'; ctx.beginPath(); ctx.arc(0, -14, c.state.pressed ? 12 : 13, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10 * Math.sin(a), -14 - 10 * Math.cos(a)); ctx.stroke();
      D.upright(ctx, c, -32, -14, (ctx) => txt(ctx, '⟲', 0, 0, 'bold 12px sans-serif', '#cfe0ff'));
      D.upright(ctx, c, 32, -14, (ctx) => txt(ctx, '⟳', 0, 0, 'bold 12px sans-serif', '#cfe0ff'));
    },
  },
});

// ---------------- protocol sensors ----------------
const C_AIR = (T) => 331.3 + 0.606 * T;   // speed of sound in dry air, m/s
Object.assign(DEFS, {
  hcsr04: {
    name: 'HC-SR04 超声波测距', en: 'HC-SR04 Ultrasonic Sensor', cat: 'sensor', desig: 'U', wheel: true,
    terms: [[-30, 40], [-10, 40], [10, 40], [30, 40]], termNames: ['VCC', 'Trig', 'Echo', 'GND'], box: [-56, -50, 56, 40],
    props: [SENS.qty({ label: '目标距离', unit: 'cm', min: 2, max: 450, def: 100, step: 0.1, dec: 1, wstep: 5 }),
      SENS.qty({ k: 'tair', label: '空气温度 (影响声速)', unit: '°C', min: -20, max: 50, def: 20, step: 0.5, dec: 1 })]
      .concat(SENS.sig({ unit: 'cm', min: 2, max: 450, step: 0.1, dec: 1, smin: 10, smax: 200 }, 10)),
    dins: [1],
    onWheel: (c, dir) => SENS.wheelQ(c, dir),
    label: (c) => SENS.now(c).toFixed(1) + ' cm',
    echoW(c, t) { const d = SENS.val(c, t); return d > 400 ? 0.038 : 2 * Math.max(d, 2) / 100 / C_AIR(+c.props.tair); },
    trigLevel(c, lvl, t) {
      const st = c.state;
      if (lvl && !st.trg) { st.trg = 1; st.tr = t; }
      else if (!lvl && st.trg) { st.trg = 0; if (t - st.tr >= 9.5e-6) DEFS.hcsr04.fire(c, t); else st.short = (st.short || 0) + 1; }
    },
    fire(c, tf) {
      const st = c.state;
      if (vccOf(c) < 4.0 || tf < (st.busy || 0)) return;
      const w = DEFS.hcsr04.echoW(c, tf), r = tf + 2e-4;
      st.ed = st.ed || []; SENS.prune(st.ed, tf); st.ed.push([r, 1], [r + w, 0]);
      st.busy = r + w + 1e-4; st.n = (st.n || 0) + 1; st.lastW = w;
      if (typeof app !== 'undefined' && app.net) app.net.needStamp = true;
    },
    onDrive(c, i, d, t) { DEFS.hcsr04.trigLevel(c, d === -2 || d >= 0.5 ? 1 : 0, t); },
    // fallback for a TRIG not driven straight by an MCU pin (pulse generator, switch …): sampled after each sub-step
    sub(c, m, ta, tb, app) {
      const n = c._nodes; if (SENS.isMcuPin(app, n[1])) return;
      const vs = m.v(n[0]) - m.v(n[3]), v = m.v(n[1]) - m.v(n[3]);
      DEFS.hcsr04.trigLevel(c, v > Math.max(0.5 * vs, 2.0) ? 1 : 0, ta);
    },
    nextEdge(c, t) { return SENS.edgeNext(c.state.ed, t); },
    build(c, n, m) {
      const st = c.state;
      c._o = addPP(c, m, n[0], n[3], n[2], () => SENS.edgeAt(st.ed, SIMCLK.t, 0) === 1, undefined, 3.5, 1 / 50);
      m.addR(n[0], n[3], 1 / 2500); m.addR(n[1], n[3], 1 / 1e6); c._p = null;
    },
    measure(c, m) { const n = c._nodes, g = m.v(n[3]); c._m.Vcc = m.v(n[0]) - g; c._m.Vt = m.v(n[1]) - g; c._m.Ve = m.v(n[2]) - g; c._m.V = c._m.Ve; c._m.I = c._m.Vcc / 2500; },
    post(c, dt, app) { if (c.state.ed) SENS.prune(c.state.ed, app.t); },
    readings(c) {
      const M = c._m, st = c.state, d = SENS.now(c);
      return [[DEFS.hcsr04.props[0].label, d.toFixed(1) + ' cm' + (d > 400 ? ' (' + _t('sens.r.out_of_range') + ')' : '')], [_t('sens.r.sound_speed'), C_AIR(+c.props.tair).toFixed(1) + ' m/s'],
        [_t('sens.r.echo_width'), U.fmt(DEFS.hcsr04.echoW(c, app.t), 's')], [_t('sens.r.last_echo'), st.lastW ? U.fmt(st.lastW, 's') : '—'], [_t('sens.r.triggers'), String(st.n || 0)],
        ['VCC', U.fmt(M.Vcc || 0, 'V') + (vccOf(c) < 4.0 ? ' (< 4 V)' : '')], ['Echo', SENS.lvlTxt((M.Ve || 0) > 2.5)], [_t('common.note'), DEFS.hcsr04.desc]];
    },
    draw(ctx, c) {
      sBoard(ctx, c, DEFS.hcsr04, '#1f5fbf', -54, -48, 54, 22);
      for (const x of [-28, 28]) {
        ctx.fillStyle = D.vgrad(ctx, -40, 0, [[0, '#e8e8e8'], [1, '#8a8a8a']]); ctx.beginPath(); ctx.arc(x, -18, 21, 0, 7); ctx.fill();
        ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(x, -18, 16, 0, 7); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 0.7; for (let i = -14; i <= 14; i += 3.5) { ctx.beginPath(); ctx.moveTo(x + i, -32); ctx.lineTo(x + i, -4); ctx.stroke(); }
      }
      sTitle(ctx, c, 0, -40, 'HC-SR04'); sTitle(ctx, c, -28, 10, 'T'); sTitle(ctx, c, 28, 10, 'R');
      if ((c._m.Ve || 0) > 2.5) glow(ctx, 0, -18, 22, '#80c0ff', 0.5);
    },
  },
  dht: {
    name: 'DHT11 / DHT22 温湿度传感器', en: 'DHT11 / DHT22 Temp & Humidity', cat: 'sensor', desig: 'U', wheel: true,
    terms: [[-20, 40], [0, 40], [20, 40]], termNames: ['VCC', 'DATA', 'GND'], box: [-28, -56, 28, 40],
    props: [TEMPQ(-40, 80, 25), { k: 'model', kind: 'select', label: '型号', def: 'DHT22', opts: [['DHT11', 'DHT11 (0–50 °C ±2 °C, 20–90 %RH ±5 %, 1 °C / 1 %)'], ['DHT22', 'DHT22 / AM2302 (−40–80 °C ±0.5 °C, 0–100 %RH ±2 %, 0.1)']] },
      SENS.qty({ k: 'q2', label: '相对湿度', unit: '%RH', min: 0, max: 100, def: 50, step: 0.1, dec: 1 })].concat(SENS.sig(TEMPQ(-40, 80, 25), 30)),
    onWheel: (c, dir) => SENS.wheelQ(c, dir),
    label: (c) => SENS.now(c).toFixed(1) + '°C ' + Math.round(c.props.q2) + '%',
    // values as the sensor encodes them: DHT11 integer within 0–50 °C / 20–90 %RH; DHT22 0.1 steps, sign bit
    encode(c, t) {
      const T = SENS.val(c, t), H = +c.props.q2;
      if (c.props.model === 'DHT11') {
        const ti = Math.round(U.clamp(T, 0, 50)), hi = Math.round(U.clamp(H, 20, 90)), b = [hi, 0, ti, 0];
        b.push((b[0] + b[1] + b[2] + b[3]) & 255); return { b, T: ti, H: hi };
      }
      const tt = Math.round(U.clamp(T, -40, 80) * 10), hh = Math.round(U.clamp(H, 0, 100) * 10), ta = Math.abs(tt) | (tt < 0 ? 0x8000 : 0);
      const b = [hh >> 8, hh & 255, ta >> 8, ta & 255]; b.push((b[0] + b[1] + b[2] + b[3]) & 255);
      return { b, T: tt / 10, H: hh / 10 };
    },
    // the sensor's reply on DATA (open drain, 0 = pulling low) after the host released the line at t0
    respond(c, t0, bytes) {
      const st = c.state, u = 1e-6; let t = t0 + 30 * u;
      st.ed = st.ed || []; SENS.prune(st.ed, t0);
      st.ed.push([t, 0]); t += 80 * u; st.ed.push([t, 1]); t += 80 * u; st.ed.push([t, 0]);
      for (const by of bytes) for (let k = 7; k >= 0; k--) { t += 50 * u; st.ed.push([t, 1]); t += (by >> k) & 1 ? 70 * u : 27 * u; st.ed.push([t, 0]); }
      t += 50 * u; st.ed.push([t, 1]);
      st.n = (st.n || 0) + 1;
      if (typeof app !== 'undefined' && app.net) app.net.needStamp = true;
      return t;
    },
    nextEdge(c, t) { return SENS.edgeNext(c.state.ed, t); },
    build(c, n, m) { const st = c.state; m.addR(n[0], n[1], 1 / 10000); c._o = m.addNL('gfun', [n[1], n[2]], { gf: () => (SENS.edgeAt(st.ed, SIMCLK.t, 1) ? 1e-9 : 1 / 30) }, st); m.addR(n[0], n[2], 1 / 50000); c._p = null; },
    measure(c, m) { const n = c._nodes, g = m.v(n[2]); c._m.Vcc = m.v(n[0]) - g; c._m.Vd = m.v(n[1]) - g; c._m.V = c._m.Vd; c._m.I = c._m.Vcc / 50000; },
    post(c, dt, app) { if (c.state.ed) SENS.prune(c.state.ed, app.t); },
    readings(c) {
      const M = c._m, st = c.state, e = DEFS.dht.encode(c, app.t);
      return [[DEFS.dht.props[0].label, SENS.now(c).toFixed(1) + ' °C'], [DEFS.dht.props[2].label, (+c.props.q2).toFixed(1) + ' %RH'], [_t('sens.r.reported'), e.T.toFixed(1) + ' °C, ' + e.H.toFixed(1) + ' %RH'],
        [_t('sens.r.reads'), String(st.n || 0)], ['VCC', U.fmt(M.Vcc || 0, 'V') + (vccOf(c) < 3.0 ? ' (< 3 V)' : '')], ['DATA', U.fmt(M.Vd || 0, 'V')], [_t('common.note'), DEFS.dht.desc]];
    },
    draw(ctx, c) {
      const d22 = c.props.model !== 'DHT11';
      sHeader(ctx, c, DEFS.dht, '#333');
      ctx.fillStyle = d22 ? '#f4f4f4' : '#3a8ad8'; D.rrect(ctx, -22, -54, 44, 72, 3); ctx.fill();
      ctx.fillStyle = d22 ? '#d8d8d8' : '#2a6ab0';
      for (let y = -48; y < 6; y += 7) for (let x = -16; x < 16; x += 7) ctx.fillRect(x, y, 4.5, 4.5);
      sTitle(ctx, c, 0, 12, d22 ? 'DHT22' : 'DHT11', d22 ? '#333' : '#fff');
    },
  },
  ds18b20: {
    name: 'DS18B20 数字温度传感器', en: 'DS18B20 Digital Thermometer', cat: 'sensor', desig: 'U', wheel: true,
    terms: [[-20, 20], [0, 20], [20, 20]], termNames: ['GND', 'DQ', 'VDD'], box: [-20, -30, 20, 20],
    props: [TEMPQ(-55, 125, 25), { k: 'res', kind: 'select', label: '分辨率 (上电默认 12 位)', num: true, def: 12, opts: [[9, '9 bit (0.5 °C, 93.75 ms)'], [10, '10 bit (0.25 °C, 187.5 ms)'], [11, '11 bit (0.125 °C, 375 ms)'], [12, '12 bit (0.0625 °C, 750 ms)']] }]
      .concat(SENS.sig(TEMPQ(-55, 125, 25), 30)),
    onWheel: (c, dir) => SENS.wheelQ(c, dir),
    label: (c) => SENS.now(c).toFixed(2) + ' °C',
    tconv: (bits) => 0.09375 * Math.pow(2, bits - 9),
    // the conversion result: 12-bit two's complement in 1/16 °C, lower resolutions leave the low bits cleared
    quant(T, bits) { const raw = Math.round(U.clamp(T, -55, 125) * 16), sh = 12 - bits; return (Math.floor(raw / (1 << sh)) * (1 << sh)) / 16; },
    build(c, n, m) { m.addR(n[2], n[0], 1 / 5e6); m.addR(n[1], n[0], 1 / 5e6); c._p = null; },
    measure(c, m) { const n = c._nodes, g = m.v(n[0]); c._m.Vcc = m.v(n[2]) - g; c._m.Vd = m.v(n[1]) - g; c._m.V = c._m.Vd; c._m.I = c._m.Vcc / 5e6; },
    readings(c) {
      const M = c._m, st = c.state, bits = st.res || +c.props.res;
      return [[DEFS.ds18b20.props[0].label, SENS.now(c).toFixed(2) + ' °C'], [_t('sens.r.resolution'), bits + ' bit · ' + (1 / Math.pow(2, bits - 8)) + ' °C · ' + DEFS.ds18b20.tconv(bits) * 1000 + ' ms'],
        [_t('sens.r.last_conv'), st.conv !== undefined ? st.conv.toFixed(4) + ' °C' : '— (85 °C ' + _t('sens.r.power_on_value') + ')'],
        ['VDD', U.fmt(M.Vcc || 0, 'V')], ['DQ', U.fmt(M.Vd || 0, 'V') + ((M.Vd || 0) < 0.7 * (M.Vcc || 0) ? ' · ' + _t('sens.r.no_pullup') : '')], [_t('common.note'), DEFS.ds18b20.desc]];
    },
    draw(ctx, c) { drawTO92(ctx, c, ['18B20', 'G DQ V']); },
  },
});

// one-line descriptions (properties panel, palette tooltip / search)
Object.entries({
  ldrmod: '光敏电阻 (GL5528 类，10 lx 时约 15 kΩ) 与板上 10 kΩ 电阻分压：光越强 AO 越低；AO 低于阈值时 DO 输出低电平，绿灯亮。',
  mqgas: '气敏电阻 Rs 与负载电阻 RL 分压，气体浓度越高 AO 越高；超过阈值 DO 输出低电平。加热丝约 33 Ω (5 V 时约 150 mA)。真实器件需要预热，这里忽略。',
  flame: '红外接收管检测火焰发出的红外光 (约 760–1100 nm)：红外越强 AO 越低；低于阈值时 DO 输出低电平。',
  soil: '两根探针之间的土壤电阻与 10 kΩ 分压：越湿电阻越小、AO 越低；低于阈值时 DO 输出低电平。',
  rainmod: '雨滴感应板：板上水越多电阻越小、AO 越低；低于阈值时 DO 输出低电平。',
  ntcmod: '10 kΩ NTC 热敏电阻 (B = 3950) 与 10 kΩ 分压：温度越高 AO 越低；低于阈值时 DO 输出低电平。',
  tcrt5000: 'TCRT5000 反射式红外传感器：白色 (反射强) 表面 AO 低、DO 低电平；黑线 (反射弱) 上 DO 为高电平。',
  soundmod: '驻极体话筒 + 放大 + 包络检波 (简化：AO 在 40–100 dB 之间随声压级线性变化)。声音超过阈值时 DO 输出高电平。',
  waterlvl: '平行导线浸入水中越深，S 端电压越高 (简化的非线性曲线，0–40 mm)。',
  lm35: 'LM35：Vout = 10 mV/°C × T，供电 4–30 V。单电源基本接法测量 2–150 °C；负温度需要负电源，这里输出最低为 0 V。',
  tmp36: 'TMP36：Vout = 0.5 V + 10 mV/°C × T (25 °C 时 750 mV)，−40…125 °C，供电 2.7–5.5 V。',
  flex: '弯曲传感器：平直时约 25 kΩ，弯曲越大电阻越大 (简化为线性，180° 时约 125 kΩ)。与固定电阻组成分压器使用。',
  fsr: 'FSR 薄膜压力电阻：不受力时 > 10 MΩ，受力后电阻大致与力成反比 (简化：R ≈ 10 kΩ / F[N]，最小 250 Ω)。与固定电阻组成分压器使用。',
  joystick: '两个 10 kΩ 电位器 (X / Y) 输出 0…VCC，居中约 VCC/2；按下摇杆时 SW 接地 (需要上拉，如 INPUT_PULLUP)。按住旋钮 = 按下 SW。',
  acs712: 'ACS712 霍尔电流传感器：OUT = VCC/2 + 灵敏度 × I (5 V 供电时 5 A 版 185 mV/A、20 A 版 100 mV/A、30 A 版 66 mV/A)。IP+ → IP− 是与信号侧隔离的 1.2 mΩ 电流通路。',
  pressure: '比例输出压力传感器：通用型 0.5–4.5 V 对应 0–满量程；MPX5010DP：Vout = Vs × (0.09·P + 0.04)；MPX5700AP：Vout = Vs × (0.0012858·P + 0.04)，P 单位 kPa。',
  pir: 'HC-SR501：检测到人体移动后 OUT 输出 3.3 V 高电平并保持延时 Tx；H 模式下持续移动会延长，L 模式不延长；输出变低后约 2.5 s 内不再触发。供电 4.5–20 V。单击元件 = 有人走过。',
  irobst: '红外避障模块 (FC-51 类)：障碍物进入检测距离 (电位器调节，约 2–30 cm) 时 OUT 输出低电平，绿灯亮。',
  tilt: 'SW-520D 滚珠倾斜开关：竖直时导通，倾斜后断开 (简化：小于 30° 闭合、大于 60° 断开，中间保持原状态)。单击 = 竖直 / 倾倒。',
  sw420: 'SW-420 常闭振动开关 + LM393 比较器：静止时 DO 为低电平，振动超过阈值时 DO 输出高电平。单击元件 = 敲一下。',
  ttp223: 'TTP223 电容式触摸芯片 (2.0–5.5 V)：默认点动、高电平有效；A / B 焊盘可设置为自锁或低电平有效。按住元件 = 手指触摸。',
  encoder: 'KY-040 增量式旋转编码器：每转一格 CLK 和 DT 各出现一个脉冲，顺时针时 CLK 先变化。CLK / DT 板上有 10 kΩ 上拉，SW 按下接地 (无上拉)。单击左 / 右半边 = 转一格，按住中间 = 按下，滚轮 = 旋转。',
  hcsr04: 'HC-SR04 超声波测距 (2–400 cm，5 V)：Trig 输入 ≥ 10 µs 高电平后，Echo 输出高电平脉冲，宽度 = 2 × 距离 / 声速 (约 58 µs/cm)；超出量程时约 38 ms。',
  dht: 'DHT11 / DHT22 单总线温湿度传感器 (模块含 10 kΩ 上拉)：用 DHT 库 readTemperature() / readHumidity() 读取，两次读取至少间隔 2 s。',
  ds18b20: 'DS18B20 单总线数字温度传感器 (−55…125 °C，3.0–5.5 V)：DQ 需要 4.7 kΩ 上拉到 VDD，用 OneWire + DallasTemperature 库读取；上电后尚未转换时读数为 85 °C。',
}).forEach(([k, v]) => { DEFS[k].desc = v; });
