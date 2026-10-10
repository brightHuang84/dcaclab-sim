'use strict';
// ===== v14: speakers, microphones, signal sources and audio power amplifiers =====
// Models (all reuse the MNA primitives of solver.js):
//   speaker / headphone : voice coil = series R (DCR) + L  (addL),   power / SPL / burn-out bookkeeping in post()
//   piezo disc          : C (≈ 20 nF) + ESR
//   electret microphone : bias current source with a saturation knee + sound-pressure driven AC current
//   NLMODELS.pamp       : power-amp output stage = the op-amp model of v3, but with supply-dependent rails, a bias level
//                         (LM386: Vs/2), a current-dependent output drop and an output current limit; supply current is
//                         drawn through lagged current sources so that the supply really sags
const AUD_VIEW = { tone: (c) => (typeof AUD !== 'undefined' ? AUD.spec(c, '').tones : []) };

// ---------------- power-amplifier output stage (non-linear device) ----------------
// nodes: 0 in+, 1 in−, 2 x (internal), 3 out, 4 V+, 5 V−, 6 bias node (0 = ground).  p.bm: 'zero' | 'node' | 'mid'
NLMODELS.pamp = function (p, V) {
  const st = p.st, vs = V[4] - V[5];
  const off = vs < p.vmin || (p.off && p.off());
  const B = p.bm === 'node' ? V[6] : p.bm === 'mid' ? (V[4] + V[5]) / 2 : 0;
  const io = Math.abs(st.io || 0);
  const hi = V[4] - p.dh0 - p.rh * io, lo = V[5] + p.dl0 + p.rl * io;
  const xhi = Math.max(hi - B, 0.05), xlo = Math.min(lo - B, -0.05), mid = (xhi + xlo) / 2, h = Math.max((xhi - xlo) / 2, 0.05);
  const H = h * p.S, vd = V[0] - V[1];
  const lim = (u, prev, step) => {
    if (prev === undefined || (Math.abs(u) > 3 && Math.abs(prev) > 3 && u * prev > 0)) return u;
    if (Math.abs(u - prev) <= step) return u;
    let r = prev + Math.sign(u - prev) * step;
    if (Math.abs(r) > 3) r = Math.sign(r) * 3.5;
    return r;
  };
  let limited = false;
  const G = p.G, J = p.J, g1 = 1 / p.R1; G.fill(0); J.fill(0);
  const M = 7;
  if (off) {
    st.io = 0; st.z = 0; st.w = 0;
    G[3 * M + 3] = 1e-9;
    G[2 * M + 2] = 0;
    return false;
  }
  // gain stage: x = H·tanh(A·vd/H) (linear over the whole usable range), then the hard clamp to the rails
  const zt = p.A * vd / H, z = lim(zt, st.z, 1);
  if (z !== zt) limited = true;
  st.z = z;
  const th = Math.tanh(z), s0 = H * th, ds = p.A * (1 - th * th), vd0 = z * H / p.A;
  G[2 * M + 0] = -ds * g1; G[2 * M + 1] = ds * g1; J[2] = -(s0 - ds * vd0) * g1;
  const vx0 = V[2];
  if (vx0 > xhi) { G[2 * M + 2] += p.Gc; J[2] -= p.Gc * xhi; } else if (vx0 < xlo) { G[2 * M + 2] += p.Gc; J[2] -= p.Gc * xlo; }
  // output: i = Imax·tanh(gout·(x + B − vout)/Imax)
  const vx = V[2], vo = V[3], Im = p.Imax, wt = p.gout * (vx + B - vo) / Im, w = lim(wt, st.w, 1);
  if (w !== wt) limited = true;
  st.w = w;
  const tw = Math.tanh(w), i0 = Im * tw, gs = p.gout * (1 - tw * tw) + 1e-9, d0 = w * Im / p.gout;
  st.io = i0;
  G[3 * M + 2] = -gs; G[3 * M + 3] = gs; J[3] = -i0 + gs * (d0 - B);
  return limited;
};

(() => {
  const TWO_PI = Math.PI * 2, pos = (i) => 0.5 * (i + Math.sqrt(i * i + 1e-6)), clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  const col = { cone: '#2b2f36', ring: '#9aa3ad' };
  const T = (ctx, s, x, y, f, c) => { ctx.fillStyle = c || '#cfd6de'; ctx.font = f || '7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); };
  const burnMark = (ctx) => { ctx.strokeStyle = '#ff5a2a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(14, 14); ctx.moveTo(14, -14); ctx.lineTo(-14, 14); ctx.stroke(); };
  const fmtP = (w) => (w >= 1 ? w.toFixed(2) + ' W' : w >= 1e-3 ? (w * 1e3).toFixed(1) + ' mW' : (w * 1e6).toFixed(0) + ' µW');
  const ac = (c) => (typeof window !== 'undefined' && window.app && window.app.running);

  // ---------------- generic voice-coil bookkeeping (speaker, headphone channels) ----------------
  // st: per-channel state object.  Returns nothing; updates st.P (W), st.Vr, st.Ir, st.th, st.burnt, st.spl
  function coil(c, k, V, I, dt, app, o) {
    const st = (c.state['k' + k] = c.state['k' + k] || { P: 0, v2: 0, i2: 0, th: 0 });
    if (st.burnt) return st;
    const a = Math.min(1, dt / 0.1), p = Math.max(V * I, 0);   // real power (V·I averages to I²·Re Z = V²/Z for a resistive load)
    st.P += (p - st.P) * a; st.v2 += (V * V - st.v2) * a; st.i2 += (I * I - st.i2) * a;
    st.th += (p / o.Prated - st.th) * Math.min(1, dt / o.tau);
    st.spl = o.sens + 10 * Math.log10(Math.max(st.P / (o.Pref || 1), 1e-9));
    st.lvl = clampN(Math.sqrt(st.P / o.Prated), 0, 1.5);
    if (st.th > o.burn || (st.th > 4 * o.burn)) { st.burnt = true; app.dirty = true; app.toast(_t('aud.burnt', { part: c.name || DEFS[c.type].name })); }
    return st;
  }
  // 3-D-ish round speaker symbol drawn from the back (magnet) with the cone moving
  function drawSpk(ctx, c, st, small) {
    const lvl = st && !st.burnt ? Math.min(1, st.lvl || 0) : 0;
    const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
    const off = lvl * 4 * Math.sin(t * 2 * Math.PI * 9), burnt = st && st.burnt;
    ctx.fillStyle = '#20242a'; ctx.beginPath(); ctx.moveTo(-10, 6); ctx.lineTo(-10, -2); ctx.lineTo(-4, -2); ctx.lineTo(-4, 6); ctx.fill();   // magnet
    ctx.fillStyle = D.vgrad(ctx, -24, 12, [[0, '#6b727b'], [1, '#2c3036']]);
    ctx.beginPath(); ctx.moveTo(-26, -22); ctx.lineTo(-26, 22 - 22); ctx.fill();
    // frame (basket) + cone
    ctx.fillStyle = '#3a3f47'; ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, -8); ctx.lineTo(28, -30); ctx.lineTo(-28, -30); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#0d1014'; ctx.lineWidth = 1.2; ctx.stroke();
    const cx = off;
    ctx.fillStyle = burnt ? '#5a3a2a' : D.vgrad(ctx, -34, -4, [[0, '#d8dde3'], [1, '#8a929c']]);
    ctx.beginPath(); ctx.moveTo(-6 + cx, -9); ctx.lineTo(6 + cx, -9); ctx.lineTo(24 + cx * 0.4, -29); ctx.lineTo(-24 + cx * 0.4, -29); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = burnt ? '#2a1a12' : '#1a1d22'; ctx.beginPath(); ctx.ellipse(cx * 0.8, -9.5, 6.5, 2.2, 0, 0, 7); ctx.fill();
    if (!small && lvl > 0.05) { ctx.strokeStyle = 'rgba(120,200,255,' + (0.25 + 0.6 * lvl) + ')'; ctx.lineWidth = 1.4; for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(0, -30, 6 + i * 6 + ((t * 20) % 6), -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke(); } }
  }

  // ======================= speaker =======================
  const SPK_P = [
    { k: 'Z', label: '额定阻抗', kind: 'select', num: true, opts: [[4, '4 Ω'], [8, '8 Ω'], [16, '16 Ω'], [32, '32 Ω']], def: 8, lk: 'aud.p.Z', ok: 'aud.o.Z' },
    { k: 'P', label: '额定功率', unit: 'W', def: 3, min: 0.01, lk: 'aud.p.Prated' },
    { k: 'L', label: '音圈电感', unit: 'H', def: 5e-4, min: 1e-6, lk: 'aud.p.Lvc' },
    { k: 'sens', label: '灵敏度 (1 W / 1 m)', unit: 'dB', def: 88, min: 60, lk: 'aud.p.sens' },
    { k: 'pan', label: '声像位置 (-1 左 … +1 右)', unit: '', def: 0, lk: 'aud.p.pan' },
  ];
  DEFS.speaker = {
    name: '扬声器 (喇叭)', en: 'Speaker', desc: '4/8/16 Ω voice coil with DCR, inductance, power rating, SPL readout and burn-out', cat: 'audio', pgrp: 'trans', desig: 'LS',
    kw: 'speaker loudspeaker 喇叭 扬声器 揚聲器 喊叭 喚叭 音响 音箱 lautsprecher haut-parleur altavoz altoparlante динамик alto-falante スピーカー 스피커',
    terms: [[-20, 40], [20, 40]], termNames: ['+', '−'], box: [-34, -34, 34, 40], props: SPK_P,
    Re: (c) => 0.85 * c.props.Z,
    label: (c) => c.props.Z + 'Ω ' + c.props.P + 'W',
    build(c, n, m) {
      const P = c.props, k = c.state.k_ || {};
      if (k.burnt) { m.addR(n[0], n[1], 1e-9); c._p = null; return; }
      c._p = m.addL(n[0], n[1], P.L, DEFS.speaker.Re(c), c.state);
    },
    measure(c, m) { c._m.I = c._p ? c._p.i : 0; },
    post(c, dt, app) {
      const P = c.props, V = c._m.V, I = c._m.I;
      const st = coil(c, '_', V, I, dt, app, { Z: P.Z, Prated: P.P, tau: 0.8, burn: 1.5, sens: P.sens });
      AUD.feed(c, '', V, dt, Math.sqrt(2 * P.P * P.Z));
      c._m.P = st.P;
    },
    pan: (c) => c.props.pan,
    readings(c) {
      const st = c.state.k_ || { P: 0, v2: 0, i2: 0, th: 0 }, sp = AUD.spec(c, ''), P = c.props;
      const tone = sp.tones[0];
      return [[_t('aud.r.vrms'), U.fmt(Math.sqrt(st.v2), 'V')], [_t('aud.r.irms'), U.fmt(Math.sqrt(st.i2), 'A')],
        [_t('aud.r.power'), fmtP(st.P) + ' / ' + fmtP(P.P) + ' (' + Math.round(100 * st.P / P.P) + '%)'], [_t('aud.r.spl'), st.P > 1e-7 ? st.spl.toFixed(1) + ' dB' : '—'],
        [_t('aud.r.freq'), tone ? U.fmt(tone.f, 'Hz') : '—'],
        [_t('common.state'), st.burnt ? _t('aud.st.burnt') : st.th > 1 ? _t('aud.st.overload') : st.P > 1e-6 ? _t('aud.st.playing') : _t('aud.st.silent')]];
    },
    draw(ctx, c) {
      D.lead(ctx, -20, 40, -20, 12); D.lead(ctx, 20, 40, 20, 12);
      const st = c.state && c.state.k_;
      ctx.save(); ctx.translate(0, 12); drawSpk(ctx, c, st); ctx.restore();
      ctx.fillStyle = '#c8741e'; ctx.fillRect(-23, 8, 6, 3); ctx.fillRect(17, 8, 6, 3);
      if (st && st.burnt) burnMark(ctx);
    },
  };
  // ======================= headphones / earbud pair (stereo, L R common) =======================
  DEFS.headphone = {
    name: '耳机 (32 Ω 立体声)', en: 'Headphones (32 Ω stereo)', desc: 'Stereo headphones / earbuds: two 32 Ω coils with a common return', cat: 'audio', pgrp: 'trans', desig: 'HP',
    kw: 'headphone earphone earbud 耳机 耳機 耳塞 kopfhörer écouteurs auriculares cuffie наушники fones ヘッドホン 헤드폰',
    terms: [[-30, 40], [0, 40], [30, 40]], termNames: ['L', 'R', '⏚'], box: [-44, -40, 44, 40],
    props: [{ k: 'Z', label: '额定阻抗', kind: 'select', num: true, opts: [[16, '16 Ω'], [32, '32 Ω'], [64, '64 Ω'], [150, '150 Ω']], def: 32, lk: 'aud.p.Z', ok: 'aud.o.Z' },
      { k: 'P', label: '额定功率 (每声道)', unit: 'W', def: 0.05, min: 1e-3, lk: 'aud.p.PratedCh' }, { k: 'L', label: '音圈电感', unit: 'H', def: 1e-4, min: 1e-6, lk: 'aud.p.Lvc' },
      { k: 'sens', label: '灵敏度 (1 mW)', unit: 'dB', def: 100, min: 60, lk: 'aud.p.sens_mw' }],
    label: (c) => c.props.Z + 'Ω',
    build(c, n, m) {
      const P = c.props, Re = 0.9 * P.Z; c._ps = [];
      ['L', 'R'].forEach((k, i) => { const b = c.state['k' + k]; if (b && b.burnt) { m.addR(n[i], n[2], 1e-9); c._ps[i] = null; } else { const s = (c.state['l' + k] = c.state['l' + k] || {}); c._ps[i] = m.addL(n[i], n[2], P.L, Re, s); } });
      c._p = null;
    },
    measure(c, m) { const n = c._nodes; c._m.V = m.v(n[0]) - m.v(n[2]); c._m.V2 = m.v(n[1]) - m.v(n[2]); c._m.I = c._ps[0] ? c._ps[0].i : 0; c._m.I2 = c._ps[1] ? c._ps[1].i : 0; },
    post(c, dt, app) {
      const P = c.props, o = { Z: P.Z, Prated: P.P, tau: 0.8, burn: 1.5, sens: P.sens, Pref: 1e-3 };
      const a = coil(c, 'L', c._m.V, c._m.I, dt, app, o), b = coil(c, 'R', c._m.V2, c._m.I2, dt, app, o), ref = Math.sqrt(2 * P.P * P.Z);
      AUD.feed(c, 'L', c._m.V, dt, ref); AUD.feed(c, 'R', c._m.V2, dt, ref); c._m.P = a.P + b.P;
    },
    pan: (c, k) => (k === 'L' ? -1 : 1),
    readings(c) {
      const a = c.state.kL || { P: 0, v2: 0 }, b = c.state.kR || { P: 0, v2: 0 }, P = c.props;
      const f = (k) => { const t = AUD.spec(c, k).tones[0]; return t ? U.fmt(t.f, 'Hz') : '—'; };
      return [[_t('aud.r.left'), U.fmt(Math.sqrt(a.v2), 'V') + ' · ' + fmtP(a.P) + ' · ' + f('L')], [_t('aud.r.right'), U.fmt(Math.sqrt(b.v2), 'V') + ' · ' + fmtP(b.P) + ' · ' + f('R')],
        [_t('aud.r.spl'), (Math.max(a.spl || 0, b.spl || 0) > 0 && Math.max(a.P, b.P) > 1e-9 ? Math.max(a.spl, b.spl).toFixed(1) + ' dB' : '—')],
        [_t('common.state'), a.burnt || b.burnt ? _t('aud.st.burnt') : Math.max(a.th || 0, b.th || 0) > 1 ? _t('aud.st.overload') : Math.max(a.P, b.P) > 1e-7 ? _t('aud.st.playing') : _t('aud.st.silent')]];
    },
    draw(ctx, c) {
      D.lead(ctx, -30, 40, -30, 22); D.lead(ctx, 0, 40, 0, 22); D.lead(ctx, 30, 40, 30, 22);
      ctx.strokeStyle = '#30343b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 4, 32, Math.PI, 0); ctx.stroke();
      const sl = c.state && c.state.kL, sr = c.state && c.state.kR;
      for (const [x, st] of [[-32, sl], [32, sr]]) {
        const l = st && !st.burnt ? Math.min(1, st.lvl || 0) : 0;
        ctx.fillStyle = D.vgrad(ctx, -8, 24, [[0, '#4a4f58'], [1, '#1d2025']]); D.rrect(ctx, x - 9, 2, 18, 20, 5); ctx.fill();
        ctx.fillStyle = st && st.burnt ? '#5a3a2a' : 'rgba(90,160,255,' + (0.35 + 0.65 * l) + ')'; ctx.beginPath(); ctx.arc(x, 12, 4 + 2 * l, 0, 7); ctx.fill();
      }
      T(ctx, 'L', -30, 30, 'bold 7px sans-serif'); T(ctx, 'R', 0, 30, 'bold 7px sans-serif');
      if ((sl && sl.burnt) || (sr && sr.burnt)) burnMark(ctx);
    },
  };
  // ======================= piezo disc =======================
  DEFS.piezo = {
    name: '压电陶瓷片 (蜂鸣片)', en: 'Piezo Disc', desc: 'Capacitive piezo element (≈20 nF + ESR); sounds with the applied AC voltage', cat: 'audio', pgrp: 'trans', desig: 'BZ',
    kw: 'piezo disc sounder buzzer 压电 蜂鸣片 陶瓷片 piezoelement zumbador cicalino пьезо ピエゾ 압전',
    terms: [[-20, 30], [20, 30]], termNames: ['+', '−'], box: [-30, -30, 30, 30],
    props: [{ k: 'C', label: '电容', unit: 'F', def: 2e-8, min: 1e-10, lk: 'aud.p.Cp' }, { k: 'Rs', label: '串联电阻 ESR', unit: 'Ω', def: 60, min: 0.1, lk: 'aud.p.esr' },
      { k: 'fr', label: '谐振频率', unit: 'Hz', def: 4000, min: 200, lk: 'aud.p.fr' }, { k: 'Vmax', label: '最大电压', unit: 'V', def: 30, min: 1, lk: 'aud.p.Vmax' }],
    label: (c) => U.fmtShort(c.props.C, 'F'),
    build(c, n, m) {
      const P = c.props, x = m.newNode(), st = c.state;
      if (st.cracked) { m.addR(n[0], n[1], 1e-9); c._p = null; return; }
      c._p = m.addR(n[0], x, 1 / P.Rs); m.addC(x, n[1], P.C, st); m.addR(n[0], n[1], 1e-8);
    },
    post(c, dt, app) {
      const st = c.state, V = c._m.V; st.v2 = (st.v2 || 0) + (V * V - (st.v2 || 0)) * Math.min(1, dt / 0.1);
      if (Math.abs(V) > c.props.Vmax * 1.2) { st.ov = (st.ov || 0) + dt; if (st.ov > 0.05) { st.cracked = true; app.dirty = true; app.toast(_t('aud.burnt', { part: DEFS.piezo.name })); } } else st.ov = Math.max(0, (st.ov || 0) - 0.5 * dt);
      AUD.feed(c, '', V, dt, 5);
      st.lvl = Math.min(1, Math.sqrt(st.v2) / 3);
    },
    wf: (f) => { const fr = 4000; return 0.3 + 0.7 / (1 + Math.pow((f - fr) / 1800, 2)); },
    readings(c) {
      const st = c.state, t = AUD.spec(c, '').tones[0];
      return [[_t('aud.r.vrms'), U.fmt(Math.sqrt(st.v2 || 0), 'V')], [_t('aud.r.freq'), t ? U.fmt(t.f, 'Hz') : '—'], [_t('common.state'), st.cracked ? _t('aud.st.burnt') : Math.sqrt(st.v2 || 0) > 0.05 ? _t('aud.st.playing') : _t('aud.st.silent')]];
    },
    draw(ctx, c) {
      D.lead(ctx, -20, 30, -20, 10); D.lead(ctx, 20, 30, 20, 10);
      const l = c.state && !c.state.cracked ? (c.state.lvl || 0) : 0;
      ctx.fillStyle = D.vgrad(ctx, -26, 10, [[0, '#d9a441'], [1, '#8d6a1f']]); ctx.beginPath(); ctx.arc(0, -8, 22, 0, 7); ctx.fill();
      ctx.strokeStyle = '#5b4210'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#e8e2d0'; ctx.beginPath(); ctx.arc(0, -8, 13 + 1.2 * l * Math.sin((typeof performance !== 'undefined' ? performance.now() : 0) / 30), 0, 7); ctx.fill();
      ctx.strokeStyle = '#7a6d4d'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#c8741e'; ctx.fillRect(-23, 8, 6, 3); ctx.fillRect(17, 8, 6, 3);
      if (c.state && c.state.cracked) burnMark(ctx);
    },
  };
  // ======================= electret microphone =======================
  const micPa = (P, t) => Math.SQRT2 * 20e-6 * Math.pow(10, P.spl / 20) * AUD.wave(P.src, t, P.f, { f2: P.f * 1.5, tsw: 3 });
  DEFS.emic = {
    name: '驻极体话筒', en: 'Electret Microphone', desc: 'Two-terminal capsule with internal JFET: bias through a resistor, built-in sound source', cat: 'audio', pgrp: 'trans', desig: 'MK',
    kw: 'microphone electret mic 话筒 麦克风 咪头 駐極體 mikrofon micrófono microphone микрофон マイク 마이크',
    terms: [[-20, 30], [20, 30]], termNames: ['+ (OUT)', '− (GND)'], box: [-26, -34, 26, 30],
    props: [{ k: 'Ib', label: '偏置电流 (2.2 kΩ 时)', unit: 'A', def: 5e-4, min: 1e-5, lk: 'aud.p.Ib' }, { k: 'sens', label: '灵敏度 (dBV/Pa, 2.2 kΩ)', unit: 'dB', def: -44, lk: 'aud.p.msens' },
      { k: 'on', label: '声音输入 开', kind: 'bool', def: true, lk: 'aud.p.sound_on' },
      { k: 'src', label: '声源波形', kind: 'select', opts: [['sine', '正弦 Sine'], ['square', '方波 Square'], ['sweep', '扫频 Sweep'], ['noise', '白噪声 Noise'], ['twotone', '双音 Two-tone']], def: 'sine', lk: 'aud.p.src', ok: 'aud.o.src' },
      { k: 'spl', label: '声压级 SPL (94 dB = 1 Pa)', unit: 'dB', def: 74, lk: 'aud.p.spl' }, { k: 'f', label: '声源频率', unit: 'Hz', def: 1000, min: 20, lk: 'aud.p.srcf' }],
    label: (c) => (c.props.on ? c.props.spl + 'dB ' + U.fmtShort(c.props.f, 'Hz') : '—'),
    build(c, n, m) {
      const P = c.props, st = c.state, kI = Math.pow(10, P.sens / 20) / 2200;
      c._p = m.addI(n[0], n[1], (t) => {
        const v = m.v(n[0]) - m.v(n[1]), sat = v > 0 ? 1 - Math.exp(-v / 0.25) : 0, pa = c.props.on ? micPa(c.props, t) : 0;
        st.pa = pa; st.iN = sat * Math.max(0, c.props.Ib + kI * pa);
        return st.iN;
      });
    },
    measure(c, m) { c._m.I = c.state.iN || 0; },
    post(c, dt, app) { const st = c.state, a = Math.min(1, dt / 0.1); st.p2 = (st.p2 || 0) + ((st.pa || 0) ** 2 - (st.p2 || 0)) * a; st.vac = (st.vac || 0) + ((c._m.V - (st.vdc === undefined ? c._m.V : st.vdc)) ** 2 - (st.vac || 0)) * a; st.vdc = st.vdc === undefined ? c._m.V : st.vdc + (c._m.V - st.vdc) * Math.min(1, dt / 0.05); },
    readings(c) {
      const st = c.state, prms = Math.sqrt(st.p2 || 0), spl = prms > 1e-9 ? 20 * Math.log10(prms / 20e-6) : 0;
      return [[_t('aud.r.bias'), U.fmt(c._m.V, 'V') + ' · ' + U.fmt(c._m.I, 'A')], [_t('aud.r.sound'), c.props.on ? prms.toFixed(3) + ' Pa (' + spl.toFixed(0) + ' dB)' : '—'], [_t('aud.r.acout'), U.fmt(Math.sqrt(st.vac || 0), 'V')], [_t('common.state'), c._m.V < 0.3 ? _t('aud.st.nobias') : _t('aud.st.biased')]];
    },
    draw(ctx, c) {
      D.lead(ctx, -20, 30, -20, 12); D.lead(ctx, 20, 30, 20, 12);
      ctx.fillStyle = D.vgrad(ctx, -34, 12, [[0, '#c9ced4'], [1, '#7c848d']]); D.rrect(ctx, -22, -30, 44, 42, 6); ctx.fill(); ctx.strokeStyle = '#4a525b'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#23272d'; ctx.beginPath(); ctx.arc(0, -12, 12, 0, 7); ctx.fill();
      ctx.fillStyle = '#4b525b'; for (let i = 0; i < 7; i++) { const a = i * 0.9; ctx.beginPath(); ctx.arc(Math.cos(a) * 6 * (i ? 1 : 0), -12 + Math.sin(a) * 6 * (i ? 1 : 0), 1.3, 0, 7); ctx.fill(); }
      if (c.props.on) { ctx.strokeStyle = 'rgba(120,200,255,0.8)'; ctx.lineWidth = 1.2; for (let i = 1; i <= 2; i++) { ctx.beginPath(); ctx.arc(-22, -12, 6 * i, -1, 1); ctx.stroke(); } }
      T(ctx, '+', -20, 21, 'bold 8px sans-serif', '#ff8a8a'); T(ctx, '−', 20, 21, 'bold 8px sans-serif', '#9fc3ff');
    },
  };
  // ======================= audio transformer (reuses the transformer model) =======================
  DEFS.audiotx = Object.assign({}, DEFS.xfmr, {
    name: '音频变压器 1k:8Ω', en: 'Audio Transformer (1 kΩ : 8 Ω)', desc: 'Output / interstage audio transformer, ratio 11:1, Lp 5 H, built on the transformer model', cat: 'audio', pgrp: 'trans', desig: 'T',
    termNames: ['P1 ●', 'P2', 'S1 ●', 'S2'], acts: (DEFS.xfmr.acts || []).map((a) => Object.assign({}, a)),
    kw: 'audio transformer 音频变压器 输出变压器 übertrager transformateur trasformatore трансформатор トランス 변압기',
    props: [{ k: 'n', label: '匝数比 Np:Ns', unit: ':1', def: 11, min: 0.01, lk: 'c.xfmr.p.n' }, { k: 'Lp', label: '初级电感', unit: 'H', def: 5, min: 1e-6, lk: 'c.xfmr.p.Lp' },
      { k: 'k', label: '耦合系数 k', unit: '', def: 0.995, min: 0.1, lk: 'c.xfmr.p.k' }, { k: 'Rw', label: '绕组电阻', unit: 'Ω', def: 0.5, min: 1e-4, lk: 'c.xfmr.p.Rw' }],
  });
  // ======================= audio signal generator =======================
  const ZS = [[0, '0 Ω (ideal)'], [50, '50 Ω'], [600, '600 Ω'], [10000, '10 kΩ']];
  const GEN_P = [
    { k: 'wave', label: '波形', kind: 'select', opts: AUD.WAVES.map((w) => w.slice()), def: 'sine', lk: 'aud.p.wave', ok: 'aud.o.wave' },
    { k: 'Vpp', label: '幅度 (峰峰值)', unit: 'V', def: 1, min: 0, lk: 'aud.p.Vpp' },
    { k: 'f', label: '频率 (扫频起点)', unit: 'Hz', def: 1000, min: 1, lk: 'aud.p.freq' },
    { k: 'f2', label: '第二频率 / 扫频终点', unit: 'Hz', def: 1500, min: 1, lk: 'aud.p.freq2', show: (c) => c.props.wave === 'sweep' || c.props.wave === 'twotone' },
    { k: 'tsw', label: '扫频周期', unit: 's', def: 2, min: 0.05, lk: 'aud.p.tsw', show: (c) => c.props.wave === 'sweep' },
    { k: 'off', label: '直流偏置', unit: 'V', def: 0, lk: 'aud.p.dc' },
    { k: 'Zs', label: '源阻抗', kind: 'select', num: true, opts: ZS, def: 600, lk: 'aud.p.zs', ok: 'aud.o.zs' },
  ];
  const genV = (P, t) => P.off + P.Vpp / 2 * AUD.wave(P.wave, t, P.f, { f2: P.f2, tsw: P.tsw });
  DEFS.audiogen = {
    name: '音频信号发生器', en: 'Audio Signal Generator', desc: 'Sine / triangle / square / saw / sweep / noise / two-tone source with DC offset and 50 Ω / 600 Ω / 10 kΩ output impedance', cat: 'audio', pgrp: 'src', desig: 'G',
    kw: 'audio signal generator function generator source 信号发生器 信号源 音频 signalgenerator generador generatore генератор 信号 ジェネレータ 발생기',
    terms: [[-40, 0], [40, 0]], termNames: ['OUT', '⏚'], box: [-40, -30, 40, 30], props: GEN_P,
    label: (c) => U.fmtShort(c.props.Vpp, 'Vpp') + ' ' + U.fmtShort(c.props.f, 'Hz'),
    build(c, n, m) { c._p = m.addV(n[0], n[1], (t) => genV(c.props, t), c.props.Zs); },
    measure(c, m) { c._m.I = -c._p.i; },
    readings(c) { const P = c.props; return [[_t('aud.r.wave'), P.wave + ' · ' + U.fmt(P.f, 'Hz')], [_t('aud.r.vout'), U.fmt(c._m.V, 'V')], [_t('aud.r.zout'), P.Zs ? U.fmt(P.Zs, 'Ω') : '0 Ω']]; },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -28, 0); D.lead(ctx, 28, 0, 40, 0);
      ctx.fillStyle = D.vgrad(ctx, -30, 30, [[0, '#3a4a5c'], [1, '#18222e']]); D.rrect(ctx, -28, -24, 56, 48, 5); ctx.fill(); ctx.strokeStyle = '#0b0e12'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#0c2a1e'; ctx.fillRect(-23, -19, 46, 26);
      const w = c.props.wave; ctx.strokeStyle = '#4cff9a'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const x = -21 + i * 42 / 40, ph = i / 40 * 2, u = w === 'noise' ? Math.sin(i * 37.7) * Math.cos(i * 12.3) : AUD.wave(w === 'sweep' ? 'sine' : w, ph, 1, { f2: 1.5 }); i ? ctx.lineTo(x, -6 - 8 * u) : ctx.moveTo(x, -6 - 8 * u); }
      ctx.stroke(); T(ctx, 'AUDIO GEN', 0, 16, 'bold 6px sans-serif');
    },
  };
  // ======================= 3.5 mm audio jack with signal source =======================
  DEFS.jack35 = {
    name: '3.5 mm 音频插孔 (信号源)', en: '3.5 mm Audio Jack (signal source)', desc: 'TRS jack acting like a phone / line output: Tip = left, Ring = right, Sleeve = ground, with a built-in signal source', cat: 'audio', pgrp: 'src', desig: 'J',
    kw: 'audio jack 3.5mm phone line out aux trs 音频插孔 耳机插孔 手机 klinke jack conector presa джек ジャック 잭',
    terms: [[-40, -20], [-40, 0], [-40, 20]], termNames: ['T (L)', 'R (R)', 'S (⏚)'], box: [-40, -30, 44, 30],
    props: [{ k: 'on', label: '输出信号', kind: 'bool', def: true, lk: 'aud.p.playing' },
      { k: 'wave', label: '波形', kind: 'select', opts: AUD.WAVES.map((w) => w.slice()), def: 'sine', lk: 'aud.p.wave', ok: 'aud.o.wave' },
      { k: 'Vpp', label: '幅度 (峰峰值)', unit: 'V', def: 1, min: 0, lk: 'aud.p.Vpp' }, { k: 'f', label: '左声道频率', unit: 'Hz', def: 440, min: 1, lk: 'aud.p.freqL' },
      { k: 'fR', label: '右声道频率 (0 = 同左)', unit: 'Hz', def: 0, min: 0, lk: 'aud.p.freqR' },
      { k: 'f2', label: '第二频率 / 扫频终点', unit: 'Hz', def: 660, min: 1, lk: 'aud.p.freq2', show: (c) => c.props.wave === 'sweep' || c.props.wave === 'twotone' },
      { k: 'Zs', label: '源阻抗', kind: 'select', num: true, opts: [[32, '32 Ω'], [100, '100 Ω'], [600, '600 Ω'], [10000, '10 kΩ']], def: 100, lk: 'aud.p.zs', ok: 'aud.o.zsj' }],
    label: (c) => (c.props.on ? U.fmtShort(c.props.f, 'Hz') + (c.props.fR ? '/' + U.fmtShort(c.props.fR, 'Hz') : '') : 'off'),
    build(c, n, m) {
      const P = () => c.props, fv = (R) => (t) => { const p = P(); return p.on ? p.Vpp / 2 * AUD.wave(p.wave, t, R && p.fR > 0 ? p.fR : p.f, { f2: p.f2, tsw: 3 }) : 0; };
      c._p = m.addV(n[0], n[2], fv(false), c.props.Zs); c._q = m.addV(n[1], n[2], fv(true), c.props.Zs);
    },
    measure(c, m) { const n = c._nodes; c._m.V = m.v(n[0]) - m.v(n[2]); c._m.V2 = m.v(n[1]) - m.v(n[2]); c._m.I = -c._p.i; c._m.I2 = -c._q.i; },
    readings(c) { const P = c.props; return [[_t('aud.r.left'), U.fmt(c._m.V, 'V') + ' · ' + U.fmt(P.f, 'Hz')], [_t('aud.r.right'), U.fmt(c._m.V2, 'V') + ' · ' + U.fmt(P.fR > 0 ? P.fR : P.f, 'Hz')], [_t('aud.r.zout'), U.fmt(P.Zs, 'Ω')]]; },
    draw(ctx, c) {
      for (const y of [-20, 0, 20]) D.lead(ctx, -40, y, -18, y);
      ctx.fillStyle = D.vgrad(ctx, -28, 28, [[0, '#2a2f36'], [1, '#14171b']]); D.rrect(ctx, -18, -28, 36, 56, 4); ctx.fill(); ctx.strokeStyle = '#0b0e12'; ctx.stroke();
      ctx.fillStyle = '#b9c0c8'; ctx.fillRect(18, -5, 12, 10); ctx.fillStyle = '#d7dce1'; ctx.fillRect(30, -4, 4, 8); ctx.fillStyle = '#555'; ctx.fillRect(21, -5, 1.5, 10); ctx.fillRect(26, -5, 1.5, 10);
      T(ctx, 'T', -10, -20, 'bold 7px sans-serif'); T(ctx, 'R', -10, 0, 'bold 7px sans-serif'); T(ctx, 'S', -10, 20, 'bold 7px sans-serif');
      T(ctx, '♪', 6, 14, '13px sans-serif', c.props.on ? '#4cff9a' : '#666');
    },
  };
})();
