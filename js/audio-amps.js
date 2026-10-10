'use strict';
// ===== v14: audio power amplifier ICs and class-D modules =====
// LM386 (DIP-8), TDA2030 / TDA2030A (Pentawatt-5), LM3886 (TO-220-11), TDA7297 (Multiwatt-15, dual BTL),
// PAM8403 / PAM8610 / TPA3116 class-D modules (averaged model).  See docs/audio-*.md for pinouts, gains and limits.
(() => {
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v)), spos = (i) => 0.5 * (i + Math.sqrt(i * i + 1e-6));
  const T = (ctx, s, x, y, f, c) => { ctx.fillStyle = c || '#e8edf2'; ctx.font = f || '7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); };

  // ---------- one output stage = pamp device + internal gain-stage node + supply current sources ----------
  // o: { inp, inn, out, vp, vn, bias (node), bm, A, fp, gout, Imax, dh0, rh, dl0, rl, vmin, tag, sup }
  function stage(c, m, o) {
    const st = c.state, x = m.newNode(), key = o.tag || '0';
    m.addR(x, 0, 1);
    const cs = (st['cx' + key] = st['cx' + key] || {}), ns = (st['nl' + key] = st['nl' + key] || {});
    m.addC(x, 0, 1 / (2 * Math.PI * o.fp), cs, true);
    const q = m.addNL('pamp', [o.inp, o.inn, x, o.out, o.vp, o.vn, o.bias || 0],
      { A: o.A, S: 30, R1: 1, gout: o.gout, Imax: o.Imax, dh0: o.dh0, rh: o.rh, dl0: o.dl0, rl: o.rl, bm: o.bm || 'zero', vmin: o.vmin, off: () => !!(c.state.off), Gc: 1e3 }, ns);
    const S = { q, x, o };
    return S;
  }
  // class-AB supply currents: V+ pin gives Iq + positive output current; V− pin takes Iq + negative output current
  function supplyAB(c, m, S, iq, vp, vn) {
    const sg = (q) => { const i = -(q.cur[3] || 0); return [spos(i), spos(-i)]; };
    const off = () => !!c.state.off, eq = () => (off() ? iq * 1e-3 : iq);
    m.addI(0, vp, () => -(eq() + S.reduce((a, s) => a + sg(s.q)[0], 0)));
    if (vn) m.addI(0, vn, () => eq() + S.reduce((a, s) => a + sg(s.q)[1], 0));
  }
  // class-D: supply current = Iq + output power / efficiency / Vs
  function supplyD(c, m, S, iq, eff, vp, gnd, pairs) {
    const fn = () => {
      if (c.state.off) return iq * (c.state.sdn ? 1e-3 : 0.4);
      let p = 0; for (const [a, b] of pairs) { const i = -(a.q.cur[3] || 0), vd = m.v(a.o.out) - m.v(b.o.out); p += spos(vd * i); }
      return iq + p / eff / Math.max(1, m.v(vp) - m.v(gnd));
    };
    m.addI(0, vp, () => -fn());
    if (gnd) m.addI(0, gnd, () => fn());
  }

  // ---------- supervision (every simulation step): supply, protection, thermal, power, gain ----------
  function post(c, dt, app) {
    const A = c._amp, st = c.state; if (!A || !app.net) return;
    const net = app.net, v = (i) => net.v(c._nodes[i]), vv = (n) => net.v(n);
    const vs = v(A.vp) - v(A.vn); st.vs = vs;
    const a = Math.min(1, dt / 0.1);
    if (!st.burnt) {
      if (vs > A.vabs + 0.2) { st.ov = (st.ov || 0) + dt; if (st.ov > 0.02) { st.burnt = true; app.dirty = true; app.toast(_t('aud.chip_burnt', { part: DEFS[c.type].name })); } } else st.ov = 0;
    }
    let pd = vs * A.iq, pout = 0, clip = false, ilim = false, gain = 0;
    A.chs.forEach((ch, k) => {
      const s = (st['s' + k] = st['s' + k] || { dc: 0, ro: 0, ri: 0, pa: 0, init: false });
      const q = ch.stages[0].q, io = -(q.cur[3] || 0);
      const vo = ch.stages.length > 1 ? vv(ch.stages[0].o.out) - vv(ch.stages[1].o.out) : vv(ch.stages[0].o.out);
      const vi0 = ch.inN ? vv(ch.inN[0]) - vv(ch.inN[1]) : vv(ch.stages[0].o.inp) - vv(ch.stages[0].o.inn);
      if (!s.init) { s.dc = vo; s.dci = vi0; s.init = true; }
      s.dc += (vo - s.dc) * Math.min(1, dt / 0.5); s.dci += (vi0 - s.dci) * Math.min(1, dt / 0.5);
      const ac = vo - s.dc, vi = vi0 - s.dci;
      s.ro += (ac * ac - s.ro) * a; s.ri += (vi * vi - s.ri) * a; s.pa += (ac * io - s.pa) * a; s.i2 = (s.i2 || 0) + (io * io - (s.i2 || 0)) * a;
      s.vo = Math.sqrt(s.ro); s.gain = s.ri > 1e-14 ? Math.sqrt(s.ro / s.ri) : 0; s.P = Math.max(0, s.pa); s.io = io; s.vod = vo;
      pout += s.P; gain = Math.max(gain, s.gain);
      if (A.cls === 'ab') {
        const vp = v(A.vp), vn = v(A.vn);
        // every output stage separately (a bridge has two, each swinging between the rails)
        ch.stages.forEach((sg) => {
          const s0 = sg.o, vo1 = vv(s0.out), io1 = -(sg.q.cur[3] || 0);
          pd += (vp - vo1) * spos(io1) + (vo1 - vn) * spos(-io1);
          const dhx = s0.dh0 + s0.rh * Math.abs(io1), dlx = s0.dl0 + s0.rl * Math.abs(io1);
          if (vo1 > vp - dhx - 0.08 || vo1 < vn + dlx + 0.08) clip = true;
        });
      } else {
        const vp = v(A.vp), o0 = vv(ch.stages[0].o.out), o1 = vv(ch.stages[1].o.out), lo = v(A.vn);
        if (Math.max(o0, o1) > vp - 0.12 - 0.35 * Math.abs(io) || Math.min(o0, o1) < lo + 0.12 + 0.35 * Math.abs(io)) clip = true;
        pd += (1 / A.eff - 1) * spos(vo * io);
      }
      if (Math.abs(io) > 0.95 * ch.stages[0].o.Imax) ilim = true;
    });
    pd = Math.max(0, pd);
    st.pd = (st.pd === undefined ? pd : st.pd + (pd - st.pd) * Math.min(1, dt / 0.05));
    st.Tj = st.Tj === undefined ? 25 : st.Tj;
    st.Tj += (25 + c.props.rth * st.pd - st.Tj) * Math.min(1, dt / 1.5);
    if (st.Tj > A.tsd) st.tsd = true; else if (st.Tj < A.tsd - 20) st.tsd = false;
    st.pout = pout; st.gain = gain;
    st.clipT = clip && !st.off ? 0.4 : Math.max(0, (st.clipT || 0) - dt); st.ilimT = ilim && !st.off ? 0.4 : Math.max(0, (st.ilimT || 0) - dt);
    // enable pins (mute / standby / shutdown): per-part callback (reads pin voltages)
    st.mute = false; st.sdn = false; if (A.pins) A.pins(c, v, st);
    st.uv = vs < A.vmin;
    st.off = !!(st.burnt || st.uv || st.tsd || st.mute || st.sdn);
    // supply current (average): from the supply source branch  ->  estimated from the stage currents
    let is = A.iq; for (const ch of A.chs) is += spos(ch.stages[0].q.cur[3] ? -ch.stages[0].q.cur[3] : 0);
    st.is = (st.is === undefined ? is : st.is + (is - st.is) * a);
    c._m.P = st.pout;
    // sound: one analyser per channel on the output (differential for BTL)
    if (A.audio) A.chs.forEach((ch, k) => { const s = st['s' + k]; AUD.feed(c, 'c' + k, s.vod, dt, A.spkRef); });
  }
  function stateText(c) {
    const st = c.state; const P = (k) => _t('aud.st.' + k);
    return st.burnt ? P('chipburnt') : st.sdn ? P('standby') : st.uv ? P('undervolt') : st.mute ? P('muted') : st.tsd ? P('thermal') : st.ilimT > 0 ? P('ilim') : st.clipT > 0 ? P('clip') : (st.pout || 0) > 1e-5 ? P('amplifying') : P('idle');
  }
  const fmtP = (w) => (w >= 1 ? w.toFixed(2) + ' W' : w >= 1e-3 ? (w * 1e3).toFixed(1) + ' mW' : (w * 1e6).toFixed(0) + ' µW');
  function readings(c) {
    const st = c.state, A = c._amp || DEFS[c.type].amp; if (!st.vs && st.vs !== 0) return [[_t('common.state'), _t('aud.st.idle')]];
    const R = [[_t('aud.r.supply'), U.fmt(st.vs, 'V') + ' · ' + U.fmt(st.is || 0, 'A')]];
    const n = (c._amp ? c._amp.chs : []).length;
    for (let k = 0; k < n; k++) { const s = st['s' + k]; if (!s) continue; R.push([(n > 1 ? (k ? 'R ' : 'L ') : '') + _t('aud.r.vout_rms'), U.fmt(s.vo || 0, 'V') + ' · ' + fmtP(s.P || 0) + ' · ' + _t('aud.r.gain') + ' ' + (s.gain || 0).toFixed(1) + '× (' + (20 * Math.log10(Math.max(s.gain || 1e-6, 1e-6))).toFixed(1) + ' dB)']); }
    R.push([_t('aud.r.dissipation'), fmtP(st.pd || 0) + ' · Tj ' + (st.Tj || 25).toFixed(0) + ' °C']);
    R.push([_t('common.state'), stateText(c)]);
    return R;
  }
  const amplifyIcon = (ctx, w, h, txt) => { };

  // ---------- drawing ----------
  function drawDIP8(ctx, c, name) {
    const ys = [-40, -20, 0, 20];
    for (let i = 0; i < 4; i++) { D.lead(ctx, -60, ys[i], -40, ys[i]); D.lead(ctx, 60, ys[i], 40, ys[i]); }
    ctx.fillStyle = D.vgrad(ctx, -50, 30, [[0, '#3a414b'], [1, '#1e2329']]); D.rrect(ctx, -40, -50, 80, 80, 4); ctx.fill(); ctx.strokeStyle = '#0d1014'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#12161a'; ctx.beginPath(); ctx.arc(0, -50, 6, 0, Math.PI); ctx.fill(); ctx.fillStyle = '#9aa7b4'; ctx.beginPath(); ctx.arc(-31, -41, 1.8, 0, 7); ctx.fill();
    T(ctx, name, 0, -10, 'bold 14px sans-serif'); T(ctx, '♪ AMP', 0, 10, '9px sans-serif', '#9fd0ff');
  }
  function drawSIP(ctx, c, n, name, sub, tab) {
    const w = 10 * (n - 1);
    for (let i = 0; i < n; i++) D.lead(ctx, -w + 20 * i, 50, -w + 20 * i, 20);
    ctx.fillStyle = D.vgrad(ctx, -50, -20, [[0, '#d5dae0'], [1, '#8d959e']]); D.rrect(ctx, -w - 8, -50, 2 * w + 16, 26, 3); ctx.fill(); ctx.strokeStyle = '#4a525b'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#4a525b'; ctx.beginPath(); ctx.arc(0, -39, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = D.vgrad(ctx, -26, 22, [[0, '#2b3038'], [1, '#14171b']]); ctx.fillRect(-w - 8, -24, 2 * w + 16, 46); ctx.strokeStyle = '#0b0e12'; ctx.strokeRect(-w - 8, -24, 2 * w + 16, 46);
    T(ctx, name, 0, -9, 'bold 11px sans-serif'); T(ctx, sub, 0, 6, '8px sans-serif', '#9fd0ff');
    for (let i = 0; i < n; i++) T(ctx, String(i + 1), -w + 20 * i, 29, '6px sans-serif', '#aab4be');
  }
  function drawModule(ctx, c, title, chip, st) {
    const lbl = c.def_t || [];
    for (let i = 0; i < 6; i++) D.lead(ctx, -60, -40 + 20 * i, -40, -40 + 20 * i);
    for (let i = 0; i < 4; i++) D.lead(ctx, 60, -40 + 20 * i, 40, -40 + 20 * i);
    ctx.fillStyle = D.vgrad(ctx, -50, 70, [[0, '#1b6b3c'], [1, '#0d4a28']]); D.rrect(ctx, -40, -52, 80, 124, 5); ctx.fill(); ctx.strokeStyle = '#0a2e19'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#16191d'; D.rrect(ctx, -14, -42, 38, 28, 3); ctx.fill(); T(ctx, chip, 5, -28, 'bold 8px sans-serif');
    ctx.fillStyle = '#3b6bd1'; ctx.beginPath(); ctx.arc(10, 10, 12, 0, 7); ctx.fill(); ctx.strokeStyle = '#1a3a8a'; ctx.lineWidth = 1.5; ctx.stroke();
    const v = c.props.vol !== undefined ? c.props.vol : 1, a = -2.4 + v * 4.8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(10 + 9 * Math.sin(a), 10 - 9 * Math.cos(a)); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.fillRect(-34, 40, 22, 14); T(ctx, 'USB', -23, 47, '6px sans-serif', '#aaa');
    T(ctx, title, 6, 46, 'bold 6.5px sans-serif', '#d8f5e0'); T(ctx, '♪', 20, 60, '10px sans-serif', st && st.off ? '#777' : '#7dffa8');
    const L = DEFS[c.type].pinTxt;
    L.slice(0, 6).forEach((s, i) => T(ctx, s, -30 + 0, -40 + 20 * i, '6px sans-serif', '#d8f5e0')); L.slice(6).forEach((s, i) => T(ctx, s, 30, -40 + 20 * i, '6px sans-serif', '#d8f5e0'));
  }

  // ======================= LM386 =======================
  const LM386V = { 'N-1': { vmin: 4, vmax: 12, vabs: 15, note: '0.325 W @ 6 V / 8 Ω' }, 'N-3': { vmin: 4, vmax: 12, vabs: 15, note: '0.7 W @ 9 V / 8 Ω' }, 'N-4': { vmin: 5, vmax: 18, vabs: 22, note: '1 W @ 16 V / 32 Ω' } };
  const LM386_PINS = ['GAIN', '−IN', '+IN', 'GND', 'VOUT', 'VS', 'BYPASS', 'GAIN'];
  DEFS.lm386 = {
    name: 'LM386 音频功放', en: 'LM386 Audio Amplifier', desc: 'DIP-8 low-voltage power amp: gain 20 (200 with a capacitor between pins 1 and 8), 4–12 V (N-4: 5–18 V), ≈0.7 W', cat: 'audio', pgrp: 'amp', desig: 'U',
    kw: 'lm386 lm386n-1 lm386n-3 lm386n-4 audio amplifier power amp 功放 音频放大器 功率放大器 verstärker amplificador amplificatore усилитель アンプ 앰프',
    terms: [[-60, -40], [-60, -20], [-60, 0], [-60, 20], [60, 20], [60, 0], [60, -20], [60, -40]], termNames: LM386_PINS.map((p, i) => (i + 1) + ' ' + p), box: [-66, -54, 66, 34],
    props: [{ k: 'ver', label: '型号', kind: 'select', opts: [['N-1', 'LM386N-1 (4–12 V)'], ['N-3', 'LM386N-3 (4–12 V)'], ['N-4', 'LM386N-4 (5–18 V)']], def: 'N-3', lk: 'aud.p.ver', ok: 'aud.o.lm386ver' },
      { k: 'rth', label: '热阻 θJA', unit: '°C/W', def: 80, min: 1, lk: 'aud.p.rth' }],
    label: (c) => 'LM386' + c.props.ver.replace('N', 'N'),
    amp: { cls: 'ab' },
    build(c, n, m) {
      const V = LM386V[c.props.ver], st = c.state;
      m.addR(n[2], n[3], 1 / 50e3); m.addR(n[1], n[3], 1 / 50e3);                         // 50 kΩ input resistors to ground
      m.addR(n[5], n[6], 1 / 30e3); m.addR(n[6], n[3], 1 / 30e3);                         // bypass pin: Vs/2 through 15 kΩ
      m.addR(n[0], n[7], 1 / 1350); m.addR(n[7], n[1], 1 / 150);                          // gain network: 1.35 kΩ between pins 1 and 8, 150 Ω to the − input
      const S = stage(c, m, { inp: n[2], inn: n[0], out: n[4], vp: n[5], vn: n[3], bias: n[6], bm: 'node', A: 3e4, fp: 500, gout: 5, Imax: 0.8, dh0: 0.6, rh: 0.8, dl0: 0.6, rl: 0.8, vmin: 2.2, tag: '0' });
      m.addR(S.x, n[0], 1 / 29000);                                                    // internal feedback (15 kΩ × 2) from the output stage to pin 1
      supplyAB(c, m, [S], c.props.ver === 'N-4' ? 8e-3 : 4e-3, n[5], n[3] ? n[3] : 0);
      c._amp = { cls: 'ab', vp: 5, vn: 3, iq: 4e-3, vabs: V.vabs, vmin: V.vmin, tsd: 150, chs: [{ stages: [S], inN: [n[2], n[1]] }], audio: false };
      c._p = null;
    },
    measure(c, m) { c._m.V = m.v(c._nodes[5]) - m.v(c._nodes[3]); c._m.I = (c.state.is || 0); },
    post, readings,
    info(c) { return 'LM386 DIP-8 (top view)\n1 GAIN  8 GAIN\n2 −IN   7 BYPASS\n3 +IN   6 VS\n4 GND   5 VOUT\n\nGain 20 (26 dB); capacitor 1–8 → 200 (46 dB); R+C in series 1–8 → 20…200.\nSupply 4–12 V (N-4: 5–18 V). Output must be AC-coupled (≥ 220 µF) to the speaker.'; },
    draw(ctx, c) { drawDIP8(ctx, c, 'LM386'); },
  };
  // the LM386 output pin also feeds the speaker analyser through the speaker itself, so the amp has no own audio

  // ======================= TDA2030 / TDA2030A =======================
  const TDA = { TDA2030: { vabs: 36, name: 'TDA2030', Pn: '14 W / 4 Ω (±14.5 V)' }, TDA2030A: { vabs: 44, name: 'TDA2030A', Pn: '18 W / 4 Ω (±16 V)' } };
  DEFS.tda2030 = {
    name: 'TDA2030 / TDA2030A 功放', en: 'TDA2030 / TDA2030A Power Amplifier', desc: 'Pentawatt-5 class-AB power amp, 6–36 V (A: 44 V), 14 W (A: 18 W) into 4 Ω, 3.5 A current limit, thermal shutdown', cat: 'audio', pgrp: 'amp', desig: 'U',
    kw: 'tda2030 tda2030a pentawatt power amplifier 功放 功率放大器 14w 18w endstufe amplificador amplificateur усилитель アンプ 앰프',
    terms: [[-40, 50], [-20, 50], [0, 50], [20, 50], [40, 50]], termNames: ['1 +IN', '2 −IN', '3 −Vs', '4 OUT', '5 +Vs'], box: [-54, -52, 54, 52],
    props: [{ k: 'ver', label: '型号', kind: 'select', opts: [['TDA2030', 'TDA2030 (max 36 V)'], ['TDA2030A', 'TDA2030A (max 44 V)']], def: 'TDA2030', lk: 'aud.p.ver', ok: 'aud.o.tdaver' },
      { k: 'rth', label: '热阻 (芯片到环境, 含散热片)', unit: '°C/W', def: 4, min: 0.3, lk: 'aud.p.rth_sink' }],
    label: (c) => c.props.ver,
    build(c, n, m) {
      const V = TDA[c.props.ver];
      m.addR(n[0], n[1], 1 / 5e6);
      const S = stage(c, m, { inp: n[0], inn: n[1], out: n[3], vp: n[4], vn: n[2], bm: 'zero', A: 1e4, fp: 200, gout: 20, Imax: 3.5, dh0: 1.5, rh: 0.9, dl0: 1.5, rl: 0.9, vmin: 5.5, tag: '0' });
      supplyAB(c, m, [S], 0.05, n[4], n[2]);
      c._amp = { cls: 'ab', vp: 4, vn: 2, iq: 0.05, vabs: V.vabs, vmin: 6, tsd: 150, chs: [{ stages: [S], inN: [n[0], 0] }] };
      c._p = null;
    },
    measure(c, m) { c._m.V = m.v(c._nodes[4]) - m.v(c._nodes[2]); c._m.I = (c.state.is || 0); },
    post, readings,
    info() { return 'TDA2030(A) Pentawatt (front view)\n1 +IN  (non-inverting)\n2 −IN  (inverting)\n3 −Vs  (GND for single supply)\n4 OUT\n5 +Vs\n\nNon-inverting gain  G = 1 + R2/R1  (R1 from −IN to ground through a capacitor, R2 from OUT to −IN).\nSupply 6–36 V (A: up to 44 V). Peak current 3.5 A. Thermal shutdown ≈150 °C.'; },
    draw(ctx, c) { drawSIP(ctx, c, 5, c.props.ver, '♪ 14–18 W', true); },
  };
  // ======================= LM3886 =======================
  DEFS.lm3886 = {
    name: 'LM3886 功放 (68 W)', en: 'LM3886 Power Amplifier (68 W)', desc: 'TO-220-11 (TF) class-AB amp: ±10…±42 V, 68 W into 4 Ω at ±28 V, mute pin, 11.5 A peak', cat: 'audio', pgrp: 'amp', desig: 'U',
    kw: 'lm3886 lm3886tf 68w power amplifier gainclone 功放 功率放大器 endstufe amplificador amplificateur усилитель アンプ 앰프',
    terms: Array.from({ length: 11 }, (_, i) => [-100 + 20 * i, 50]), termNames: ['1 NC', '2 V+', '3 OUT', '4 V+', '5 NC', '6 V−', '7 GND', '8 MUTE', '9 −IN', '10 +IN', '11 NC'], box: [-114, -52, 114, 52],
    props: [{ k: 'rth', label: '热阻 (芯片到环境, 含散热片)', unit: '°C/W', def: 1.5, min: 0.2, lk: 'aud.p.rth_sink' }],
    label: () => 'LM3886',
    build(c, n, m) {
      m.addR(n[1], n[3], 1e3);   // pins 2 and 4 are both V+
      m.addR(n[9], n[8], 1 / 1e6); m.addR(n[9], n[6], 1 / 1e6); m.addR(n[8], n[6], 1 / 1e6);
      m.addV(n[7], n[5], () => 2.6, 100);   // MUTE pin: sits 2.6 V above V− behind 100 Ω; ≥ 0.5 mA flowing into the pin (R to GND) releases the mute
      const S = stage(c, m, { inp: n[9], inn: n[8], out: n[2], vp: n[1], vn: n[5], bm: 'zero', A: 1e5, fp: 80, gout: 40, Imax: 11.5, dh0: 2.0, rh: 0.45, dl0: 2.0, rl: 0.45, vmin: 12, tag: '0' });
      supplyAB(c, m, [S], 0.05, n[1], n[5]);
      c._amp = { cls: 'ab', vp: 1, vn: 5, iq: 0.05, vabs: 94, vmin: 12, tsd: 150, chs: [{ stages: [S], inN: [n[9], 0] }],
        pins: (c, v, st) => { const i8 = (v(7) - v(5) - 2.6) / 100; st.i8 = i8; st.mute = !(i8 >= 0.5e-3); } };
      c._p = null;
    },
    measure(c, m) { c._m.V = m.v(c._nodes[1]) - m.v(c._nodes[5]); c._m.I = (c.state.is || 0); },
    post, readings,
    info() { return 'LM3886TF (TO-220-11, front view)\n1 NC   2 V+   3 OUT   4 V+   5 NC   6 V−\n7 GND  8 MUTE  9 −IN  10 +IN  11 NC\n\nMUTE (pin 8): open = muted; to un-mute let ≥ 0.5 mA flow into the pin, i.e. a resistor R from MUTE to GND with R ≈ (|V−| − 2.6 V)/0.5 mA or less (22 kΩ at ±20 V).\nSupply |V+|+|V−| = 20…84 V (UVLO at 12 V). Non-inverting gain G = 1 + Rf/Ri (≥ 10 recommended).'; },
    draw(ctx, c) { drawSIP(ctx, c, 11, 'LM3886', '♪ 68 W', true); },
  };
  // ======================= TDA7297 =======================
  DEFS.tda7297 = {
    name: 'TDA7297 双声道 BTL 功放', en: 'TDA7297 Dual BTL Amplifier', desc: 'Multiwatt-15 dual bridge amp 2×15 W, 6.5–18 V single supply, fixed gain 32 dB, stand-by and mute pins', cat: 'audio', pgrp: 'amp', desig: 'U',
    kw: 'tda7297 15w dual btl bridge amplifier stereo 双声道 功放 功率放大器 endstufe amplificador amplificateur усилитель アンプ 앰프',
    terms: Array.from({ length: 15 }, (_, i) => [-140 + 20 * i, 50]), termNames: ['1 OUT1+', '2 OUT1−', '3 VCC', '4 IN1', '5 NC', '6 MUTE', '7 ST-BY', '8 PW-GND', '9 S-GND', '10 NC', '11 NC', '12 IN2', '13 VCC', '14 OUT2−', '15 OUT2+'], box: [-154, -52, 154, 52],
    props: [{ k: 'rth', label: '热阻 (芯片到环境, 含散热片)', unit: '°C/W', def: 3, min: 0.2, lk: 'aud.p.rth_sink' }],
    label: () => 'TDA7297',
    build(c, n, m) {
      m.addR(n[2], n[12], 1e3); m.addR(n[7], n[8], 1e3);
      const ref = m.newNode(); m.addR(n[2], ref, 1 / 10e3); m.addR(ref, n[8], 1 / 10e3);   // internal Vref = Vcc/2
      m.addR(n[3], ref, 1 / 30e3); m.addR(n[11], ref, 1 / 30e3);                                 // input impedance 30 kΩ
      m.addR(n[5], n[7], 1 / 100e3); m.addR(n[6], n[7], 1 / 100e3);                              // MUTE / ST-BY: internal pull-downs
      const mk = (inp, inn, out, tag) => stage(c, m, { inp, inn, out, vp: n[2], vn: n[7], bm: 'mid', A: 20, fp: 100e3, gout: 8, Imax: 3.2, dh0: 1.0, rh: 0.5, dl0: 1.0, rl: 0.5, vmin: 4.5, tag });
      const a1 = mk(n[3], ref, n[0], 'a'), a2 = mk(ref, n[3], n[1], 'b'), b1 = mk(n[11], ref, n[14], 'c'), b2 = mk(ref, n[11], n[13], 'd');
      supplyAB(c, m, [a1, a2, b1, b2], 0.05, n[2], 0);
      c._amp = { cls: 'ab', vp: 2, vn: 7, iq: 0.05, vabs: 20, vmin: 6, tsd: 150, chs: [{ stages: [a1, a2] }, { stages: [b1, b2] }],
        pins: (c, v, st) => { const g = v(7); st.sdn = !(v(6) - g > 3.3); st.mute = !st.sdn && !(v(5) - g > 3.3); } };
      c._p = null;
    },
    measure(c, m) { c._m.V = m.v(c._nodes[2]) - m.v(c._nodes[7]); c._m.I = (c.state.is || 0); },
    post, readings,
    info() { return 'TDA7297 Multiwatt-15 (front view)\n1 OUT1+  2 OUT1−  3 VCC  4 IN1  5 NC  6 MUTE  7 ST-BY  8 PW-GND\n9 S-GND  10 NC  11 NC  12 IN2  13 VCC  14 OUT2−  15 OUT2+\n\nFixed gain 32 dB (40×, bridge). ST-BY and MUTE need > 3.3 V (tie to VCC through a divider / delay RC) — both low or open = stand-by.\nUse input coupling capacitors (0.22 µF): IN is biased at Vref = Vcc/2.'; },
    draw(ctx, c) { drawSIP(ctx, c, 15, 'TDA7297', '♪ 2×15 W BTL', true); },
  };
  // ======================= class-D modules (averaged model) =======================
  // terminals: 0 IN-L, 1 IN-R, 2 GND, 3 VCC, 4 MUTE, 5 SD, 6 L+, 7 L−, 8 R+, 9 R−
  const MOD_T = [[-60, -40], [-60, -20], [-60, 0], [-60, 20], [-60, 40], [-60, 60], [60, -40], [60, -20], [60, 0], [60, 20]];
  function classD(type, o) {
    DEFS[type] = {
      name: o.name, en: o.en, desc: o.desc, cat: 'audio', pgrp: 'amp', desig: 'U', kw: o.kw + ' class d class-d module 数字功放 D类 模块 klasse-d módulo modulo модуль モジュール 모듈 amplifier 功放',
      terms: MOD_T, termNames: ['IN-L', 'IN-R', 'GND', 'VCC', 'MUTE', 'SD', 'L+', 'L−', 'R+', 'R−'], pinTxt: ['L-IN', 'R-IN', 'GND', 'VCC', 'MUTE', 'SD', 'L+', 'L−', 'R+', 'R−'], box: [-66, -56, 66, 74],
      props: o.props.concat([{ k: 'vol', label: '音量电位器 (对数)', kind: 'range', def: 1, lk: 'aud.p.vol', fmt: (v) => Math.round(100 * v * v) + '%' }, { k: 'rth', label: '热阻 (芯片到环境)', unit: '°C/W', def: o.rth, min: 1, lk: 'aud.p.rth' }]),
      label: (c) => o.chip,
      build(c, n, m) {
        const P = c.props, g = o.gain(c), vol = P.vol * P.vol;
        const mid = () => 0; const ch = [];
        for (let k = 0; k < 2; k++) {
          const nin = m.newNode(), cin = (c.state['ci' + k] = c.state['ci' + k] || {});
          m.addC(n[k], nin, 1e-6, cin); m.addR(nin, n[2], 1 / 20e3);   // module input coupling capacitor + 20 kΩ input resistance
          const gain = 0.5 * g * vol, outp = n[6 + 2 * k], outn = n[7 + 2 * k];
          const mk = (inp, inn, out, tag) => stage(c, m, { inp, inn, out, vp: n[3], vn: n[2], bm: 'mid', A: Math.max(1e-4, gain), fp: 200e3, gout: 30, Imax: o.Imax, dh0: 0.03, rh: o.rds, dl0: 0.03, rl: o.rds, vmin: o.vmin - 0.3, tag });
          const s1 = mk(nin, n[2], outp, 'p' + k), s2 = mk(n[2], nin, outn, 'n' + k);
          ch.push({ stages: [s1, s2], pair: [s1, s2] });
        }
        // MUTE / SD pull resistors (internal), see the datasheets
        if (o.muteHigh) m.addR(n[4], n[2], 1 / 100e3); else m.addR(n[4], n[3], 1 / 100e3);
        m.addR(n[5], n[3], 1 / 100e3);
        supplyD(c, m, ch.map((x) => x.stages[0]), o.iq, o.eff, n[3], n[2] || 0, ch.map((x) => x.pair));
        c._amp = { cls: 'd', vp: 3, vn: 2, iq: o.iq, eff: o.eff, vabs: o.vabs, vmin: o.vmin, tsd: 140, chs: ch.map((x) => ({ stages: x.pair })), audio: false,
          pins: (c, v, st) => { const g = v(2), vm = v(4) - g, vs = v(5) - g, th = 0.5 * (v(3) - g) * 0.4 + 0.3; st.sdn = !(vs > th); st.mute = o.muteHigh ? vm > Math.max(1.2, th * 2) : !(vm > th); } };
        c._p = null;
      },
      measure(c, m) { c._m.V = m.v(c._nodes[3]) - m.v(c._nodes[2]); c._m.I = c.state.is || 0; },
      post, readings, info: () => o.info,
      draw(ctx, c) { drawModule(ctx, c, o.title, o.chip, c.state); },
    };
  }
  classD('pam8403', {
    name: 'PAM8403 D 类功放模块 (2×3 W)', en: 'PAM8403 Class-D Module (2×3 W)', desc: 'Stereo filterless class-D, 2.5–5.5 V (USB 5 V), 3 W per channel into 4 Ω, 24 dB gain, volume pot, mute / shutdown pins',
    chip: 'PAM8403', title: '2×3W', kw: 'pam8403 3w usb 5v', props: [], gain: () => 15.85, rth: 60, iq: 0.016, eff: 0.87, rds: 0.18, Imax: 3, vmin: 2.5, vabs: 6.2, muteHigh: false,
    info: 'PAM8403 module (stereo class-D, averaged model)\nIN-L, IN-R, GND, VCC (2.5–5.5 V; USB 5 V), MUTE (low = mute, floats high), SD (low = shutdown, floats high), L+ L− R+ R− (BTL outputs, connect the speaker between + and −).\nDifferential gain 24 dB (15.8×) × volume pot. 3.2 W / 4 Ω and 1.8 W / 8 Ω (THD 10 %) at 5 V.',
  });
  classD('pam8610', {
    name: 'PAM8610 D 类功放模块 (2×10 W)', en: 'PAM8610 Class-D Module (2×10 W)', desc: 'Stereo class-D, 7–15 V supply, 10 W per channel into 8 Ω at 13 V, DC volume, mute (high) / shutdown (low)',
    chip: 'PAM8610', title: '2×10W', kw: 'pam8610 10w 12v', props: [], gain: () => 15.85, rth: 25, iq: 0.03, eff: 0.88, rds: 0.2, Imax: 4.5, vmin: 7, vabs: 16.5, muteHigh: true,
    info: 'PAM8610 module (stereo class-D, averaged model)\nIN-L, IN-R, GND, VCC (7–15 V, abs. max 16.5 V), MUTE (HIGH = mute), SD (LOW = shutdown), L+ L− R+ R−.\n10 W per channel into 8 Ω at 13 V (THD 10 %). Gain here: 24 dB × volume pot (module gain is DC-volume controlled; approximation).',
  });
  const TPA_G = [[20, '20 dB (10×)'], [26, '26 dB (20×)'], [32, '32 dB (40×)'], [36, '36 dB (63×)']];
  classD('tpa3116', {
    name: 'TPA3116 D 类功放模块 (2×50 W)', en: 'TPA3116D2 Class-D Module (2×50 W)', desc: 'Stereo class-D, 4.5–26 V supply, 50 W per channel into 4 Ω at 21 V, gain 20/26/32/36 dB, mute (high) / SDZ (low)',
    chip: 'TPA3116D2', title: '2×50W', kw: 'tpa3116 tpa3116d2 50w 24v', props: [{ k: 'gdb', label: '增益 (GAIN/SLV 引脚)', kind: 'select', num: true, opts: TPA_G, def: 26, lk: 'aud.p.gdb', ok: 'aud.o.gdb' }],
    gain: (c) => Math.pow(10, c.props.gdb / 20), rth: 8, iq: 0.03, eff: 0.9, rds: 0.12, Imax: 7, vmin: 4.5, vabs: 30, muteHigh: true,
    info: 'TPA3116D2 module (stereo class-D, averaged model)\nIN-L, IN-R, GND, VCC (4.5–26 V), MUTE (HIGH = mute), SD = SDZ (LOW = shutdown), L+ L− R+ R−.\n2×50 W into 4 Ω at 21 V (THD 10 %). Gain 20 / 26 / 32 / 36 dB selected by the GAIN/SLV resistor divider (latched at power-up on the real chip).',
  });
  // palette sub-sections
  window.CAT_SUBS = Object.assign(window.CAT_SUBS || {}, { audio: ['trans', 'src', 'amp'] });
  window.CAT_SUBKEY = Object.assign(window.CAT_SUBKEY || {}, { ttl: 'ttl.sub.', audio: 'aud.sub.' });
  CATEGORIES.splice(CATEGORIES.findIndex((x) => x[0] === 'ttl') + 1, 0, ['audio', '音频 / 喇叭与功放 Audio']);
  if (typeof document !== 'undefined') AUD.initUI();
})();
