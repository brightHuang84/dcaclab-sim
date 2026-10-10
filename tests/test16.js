// v14 tests: speakers, headphones, piezo disc, electret microphone, audio signal generator / 3.5 mm jack, power amplifiers (LM386, TDA2030, LM3886,
// TDA7297, PAM8403 / PAM8610 / TPA3116), audio engine (WebAudio, mute by default), potentiometer audio taper, crossover, locale keys, save / load
// and every audio example (no non-convergence / errors / pass-over warnings).
const { chromium } = require('playwright-core');
const results = {}; const fails = [];
const check = (name, cond, info) => { results[name] = { pass: !!cond, info }; if (!cond) fails.push(name); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(info).slice(0, 400))); };
const BASE = process.env.URL || 'http://127.0.0.1:8765/index.html';
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt-BR'];

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, locale: 'en-US' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(BASE + '?fresh=1&lang=en'); await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.TOASTS = []; const o = app.toast.bind(app); app.toast = (m) => { TOASTS.push(String(m)); o(m); };
    window.W = (a, ia, b, ib) => { const p = app.termPos(a, ia), q = app.termPos(b, ib); return app.addWire(p[0], p[1], q[0], q[1], 1); };
    window.STEP = (n) => { let bad = 0; for (let i = 0; i < (n || 1); i++) { app.simStep(); if (!app.net.converged) bad++; } return bad; };
    window.RUNT = (sec) => { const t1 = app.t + sec; let bad = 0, n = 0; while (app.t < t1 && n++ < 400000) { app.simStep(); if (!app.net.converged) bad++; } return bad; };
    window.NV = (c, i) => app.net.v(c._nodes[i]);
    // RMS / mean / min / max / zero-crossing frequency of probe functions over `sec` seconds
    window.RMS = (fns, sec) => {
      const t1 = app.t + sec, t0 = app.t; const s = fns.map(() => ({ n: 0, a: 0, a2: 0, mn: 1e9, mx: -1e9, zc: 0, p: null }));
      while (app.t < t1) { app.simStep(); fns.forEach((f, i) => { const v = f(), q = s[i]; q.n++; q.a += v; q.a2 += v * v; q.mn = Math.min(q.mn, v); q.mx = Math.max(q.mx, v); });
        fns.forEach((f, i) => { const q = s[i]; q.zv = q.zv === undefined ? q.a / q.n : q.zv; }); }
      return s.map((q) => ({ mean: q.a / q.n, rms: Math.sqrt(q.a2 / q.n), ac: Math.sqrt(Math.max(0, q.a2 / q.n - (q.a / q.n) ** 2)), mn: q.mn, mx: q.mx, n: q.n }));
    };
    // frequency estimate from rising zero-crossings of (f() - mean)
    window.FREQ = (f, sec, mean) => { const t0 = app.t; let prev = f() - mean, cr = [], t1 = app.t + sec; while (app.t < t1) { app.simStep(); const v = f() - mean; if (prev < 0 && v >= 0) cr.push(app.t); prev = v; } return cr.length > 2 ? (cr.length - 1) / (cr[cr.length - 1] - cr[0]) : 0; };
    window.BURNT = (c) => !!(c.state.burnt || c.state.cracked || (c.state.k_ && c.state.k_.burnt) || (c.state.kL && c.state.kL.burnt) || (c.state.kR && c.state.kR.burnt));
    window.CLEAR = () => { app.clearAll(); app.pause(); TOASTS.length = 0; const G = app.addComp('ground', 100, 700, 0, {}); return G; };
  });
  const T = (src) => page.evaluate(src);

  // ---------- 1. library: category, parts, pin-outs ----------
  {
    const r = await T(`(() => {
      const aud = Object.keys(DEFS).filter((t) => DEFS[t].cat === 'audio');
      const nm = (t) => DEFS[t].termNames.map((x) => String(x).replace(/^\\d+\\s*/, ''));
      document.querySelector('#pal-q').value = ''; app.ui && app.ui.filterPalette && app.ui.filterPalette('');
      const cat = [...document.querySelectorAll('#palette-body .cat')].find((e) => e.dataset.cat === 'audio');
      const subs = cat ? [...cat.querySelectorAll('.sub-t')].map((e) => e.dataset.sub) : [];
      const items = cat ? [...cat.querySelectorAll('.item')].map((e) => e.dataset.type) : [];
      return { aud, n: aud.length, subs, items, names: Object.fromEntries(aud.map((t) => [t, nm(t).join(' ')])), pot: DEFS.pot.props.map((p) => p.k) };
    })()`);
    check('audio_category_has_14_parts_and_3_subgroups', r.n >= 14 && r.subs.length === 3 && r.items.length === r.n, { n: r.n, subs: r.subs, items: r.items.length });
    const N = r.names;
    check('pinout_lm386_dip8_per_datasheet', N.lm386 === 'GAIN −IN +IN GND VOUT VS BYPASS GAIN', N.lm386);
    check('pinout_tda2030_pentawatt_per_datasheet', N.tda2030 === '+IN −IN −Vs OUT +Vs', N.tda2030);
    check('pinout_lm3886_tf11_per_datasheet', N.lm3886 === 'NC V+ OUT V+ NC V− GND MUTE −IN +IN NC', N.lm3886);
    check('pinout_tda7297_multiwatt15_per_datasheet', N.tda7297 === 'OUT1+ OUT1− VCC IN1 NC MUTE ST-BY PW-GND S-GND NC NC IN2 VCC OUT2− OUT2+', N.tda7297);
    check('pinout_class_d_modules', ['pam8403', 'pam8610', 'tpa3116'].every((t) => N[t] === 'IN-L IN-R GND VCC MUTE SD L+ L− R+ R−'), [N.pam8403, N.pam8610, N.tpa3116]);
    check('pinout_transducers_and_sources', N.speaker === '+ −' && N.headphone === 'L R ⏚' && N.piezo === '+ −' && N.audiogen === 'OUT ⏚' && N.jack35.startsWith('T (L) R (R) S') && N.audiotx.split(' ').length >= 4 && /OUT/.test(N.emic), N);
    check('pot_has_audio_taper_property', r.pot.includes('taper'), r.pot);
  }

  // ---------- 2. audio signal generator: waveform / frequency / amplitude / offset / source impedance ----------
  {
    const r = await T(`(() => {
      const out = {};
      for (const w of ['sine', 'square', 'triangle', 'saw']) {
        const G = CLEAR(); const g = app.addComp('audiogen', 300, 400, 0, { wave: w, Vpp: 2, f: 1000, off: 0.5, Zs: 0 }), R = app.addComp('resistor', 500, 400, 0, { R: 1000 });
        W(g, 0, R, 0); W(R, 1, G, 0); W(g, 1, G, 0); app.changed(); app.resetSim(); RUNT(0.01);
        const f = FREQ(() => NV(g, 0), 0.05, 0.5), r = RMS([() => NV(g, 0)], 0.02)[0];
        out[w] = { f, mean: r.mean, mx: r.mx, mn: r.mn, ac: r.ac };
      }
      { const G = CLEAR(); const g = app.addComp('audiogen', 300, 400, 0, { wave: 'sine', Vpp: 2, f: 500, Zs: 600 }), R = app.addComp('resistor', 500, 400, 0, { R: 600 }); W(g, 0, R, 0); W(R, 1, G, 0); W(g, 1, G, 0); app.changed(); app.resetSim(); RUNT(0.01);
        const r = RMS([() => NV(g, 0)], 0.02)[0]; out.zs = { vpk: r.mx }; }
      { const G = CLEAR(); const g = app.addComp('audiogen', 300, 400, 0, { wave: 'sweep', Vpp: 2, f: 200, f2: 2000, tsw: 1, Zs: 0 }), R = app.addComp('resistor', 500, 400, 0, { R: 1000 }); W(g, 0, R, 0); W(R, 1, G, 0); W(g, 1, G, 0); app.changed(); app.resetSim();
        RUNT(0.02); const f0 = FREQ(() => NV(g, 0), 0.04, 0); RUNT(0.8); const f1 = FREQ(() => NV(g, 0), 0.02, 0); out.sweep = { f0, f1 }; }
      { const G = CLEAR(); const g = app.addComp('audiogen', 300, 400, 0, { wave: 'noise', Vpp: 2, f: 1000, Zs: 0 }), R = app.addComp('resistor', 500, 400, 0, { R: 1000 }); W(g, 0, R, 0); W(R, 1, G, 0); W(g, 1, G, 0); app.changed(); app.resetSim(); RUNT(0.01);
        const r = RMS([() => NV(g, 0)], 0.1)[0]; out.noise = { ac: r.ac, mx: r.mx, mn: r.mn }; }
      return out;
    })()`);
    check('generator_sine_frequency_and_amplitude_accurate', Math.abs(r.sine.f - 1000) < 15 && Math.abs(r.sine.mx - 1.5) < 0.05 && Math.abs(r.sine.mn + 0.5) < 0.05 && Math.abs(r.sine.mean - 0.5) < 0.03, r.sine);
    check('generator_square_triangle_saw_levels', Math.abs(r.square.mx - 1.5) < 0.05 && Math.abs(r.square.mn + 0.5) < 0.05 && Math.abs(r.triangle.ac - 1 / Math.sqrt(3)) < 0.04 && Math.abs(r.saw.ac - 1 / Math.sqrt(3)) < 0.04 && Math.abs(r.square.f - 1000) < 25 && Math.abs(r.triangle.f - 1000) < 25, r);
    check('generator_source_impedance_divides_with_load', Math.abs(r.zs.vpk - 0.5) < 0.03, r.zs);
    check('generator_sweep_runs_from_f_to_f2', Math.abs(r.sweep.f0 - 200) < 60 && r.sweep.f1 > 1200 && r.sweep.f1 < 2000, r.sweep);
    check('generator_noise_has_energy_no_tone', r.noise.ac > 0.2 && r.noise.mx > 0.6 && r.noise.mn < -0.6, r.noise);
  }

  // ---------- 3. speaker: impedance, power P = V^2 / R, SPL, burn-out ----------
  {
    const r = await T(`(() => {
      const out = {};
      const rig = (Z, Vpp, f, P, secs) => { const G = CLEAR(); const g = app.addComp('audiogen', 300, 400, 0, { wave: 'sine', Vpp, f, Zs: 0 }), S = app.addComp('speaker', 600, 400, 0, { Z, P, sens: 90 });
        W(g, 0, S, 0); W(S, 1, G, 0); W(g, 1, G, 0); app.changed(); app.resetSim(); RUNT(0.05); return { g, S }; };
      { const { g, S } = rig(8, 4, 200, 5); const r = RMS([() => NV(S, 0) - NV(S, 1), () => -S.state.i], 0.1); RUNT(0.1);
        const rd = DEFS.speaker.readings(S); out.p8 = { vrms: r[0].rms, irms: r[1].rms, readings: rd.map((x) => x.join('=')), st: S._m.P, expect: (2 * 2) / (2 * 8), spl: S.state.k_.spl }; }
      { const { g, S } = rig(4, 4, 200, 5); RUNT(0.2); out.p4 = { P: S._m.P }; }
      { const { g, S } = rig(8, 28, 300, 0.5); const t = RUNT(1.2); RUNT(2); out.burn = { burnt: BURNT(S), toast: TOASTS.some((x) => /burn/i.test(x)) }; RUNT(0.1); const v = RMS([() => NV(S, 0) - NV(S, 1)], 0.05)[0].rms; out.burn.vAfter = v; }
      { const { g, S } = rig(8, 2, 200, 3); RUNT(0.3); const a = S.state.k_.spl; g.props.Vpp = 4; RUNT(0.5); out.spl = { a, b: S.state.k_.spl }; }
      return out;
    })()`);
    check('speaker_power_matches_v_squared_over_2R_for_sine', Math.abs(r.p8.st - r.p8.expect) / r.p8.expect < 0.12 && Math.abs(r.p8.vrms - 1.414) < 0.08, r.p8);
    check('speaker_4_ohm_draws_twice_the_power_of_8_ohm', Math.abs(r.p4.P / r.p8.st - 2) < 0.35, [r.p4, r.p8.st]);
    check('speaker_readout_shows_power_and_spl', r.p8.readings.some((x) => /W/.test(x) && /Power/i.test(x)) && r.p8.spl > 70 && r.p8.spl < 110, r.p8);
    check('speaker_spl_rises_6dB_per_doubling_of_voltage', Math.abs((r.spl.b - r.spl.a) - 6) < 1.5, r.spl);
    check('speaker_overpower_burns_out_with_message_and_goes_open', r.burn.burnt && r.burn.toast && r.burn.vAfter > 5, r.burn);
  }

  // ---------- 4. LM386: gain 20 / 200, clipping, supply current ----------
  {
    const r = await T(`(() => {
      const out = {};
      const rig = (Vpp, f, o) => { o = o || {}; const G = CLEAR(); const B = app.addComp('battery', 200, 300, 0, { V: o.V || 9 }); W(B, 0, G, 0);
        const g = app.addComp('audiogen', 300, 600, 0, { Vpp, f, Zs: 50 }); const U = app.addComp('lm386', 700, 400, 0, { ver: o.ver || 'N-3' }), C2 = app.addComp('capacitor', 900, 400, 0, { C: 470e-6 }), S = app.addComp('speaker', 1100, 400, 0, { Z: 8, P: 2 });
        W(B, 1, U, 5); W(U, 3, G, 0); W(U, 1, G, 0); W(g, 0, U, 2); W(g, 1, G, 0); W(U, 4, C2, 0); W(C2, 1, S, 0); W(S, 1, G, 0);
        const C3 = app.addComp('capacitor', 760, 560, 0, { C: 10e-6 }); W(U, 6, C3, 0); W(C3, 1, G, 0);
        if (o.g200) { const C4 = app.addComp('capacitor', 600, 250, 0, { C: 10e-6 }); W(U, 0, C4, 0); W(C4, 1, U, 7); }
        app.changed(); app.resetSim(); RUNT(0.6); return { G, B, g, U, S, C2 }; };
      { const R = rig(0.1, 1000); const r = RMS([() => NV(R.U, 4) - NV(R.U, 2) * 0, () => NV(R.g, 0), () => NV(R.U, 2)], 0.1); out.g20 = { vo: r[0].ac, vi: r[2].ac, gain: r[0].ac / r[2].ac, idc: -R.B._m.I, dc: r[0].mean }; }
      { const R = rig(0.01, 1000, { g200: true }); const r = RMS([() => NV(R.U, 4), () => NV(R.U, 2)], 0.1); out.g200 = { gain: r[0].ac / r[1].ac }; }
      { const R = rig(1.5, 1000); const r = RMS([() => NV(R.U, 4)], 0.1); out.clip = { pp: r[0].mx - r[0].mn, mx: r[0].mx, mn: r[0].mn, st: DEFS.lm386.readings(R.U).pop()[1] }; }
      { const R = rig(0.0, 1000); RUNT(0.2); out.iq = Math.abs(R.B._m.I); }
      { const R = rig(0.1, 1000, { V: 20 }); RUNT(0.3); out.burn = { burnt: !!R.U.state.burnt, toast: TOASTS.some((x) => /destroyed|burn/i.test(x)) }; }
      { const R = rig(0.1, 1000, { V: 3 }); RUNT(0.3); const r = RMS([() => NV(R.U, 4)], 0.05)[0]; out.uv = { ac: r.ac, st: DEFS.lm386.readings(R.U).pop()[1] }; }
      return out;
    })()`);
    check('lm386_gain_20_within_15_percent', r.g20.gain > 17 && r.g20.gain < 23, r.g20);
    check('lm386_gain_200_with_capacitor_between_pins_1_and_8', r.g200.gain > 160 && r.g200.gain < 235, r.g200);
    check('lm386_output_biased_at_half_supply', Math.abs(r.g20.dc - 4.5) < 0.4, r.g20.dc);
    check('lm386_clips_near_the_rails_and_reports_clipping', r.clip.pp > 5.5 && r.clip.pp < 8.6 && /clip/i.test(r.clip.st), r.clip);
    check('lm386_quiescent_current_few_mA', r.iq > 0.002 && r.iq < 0.015, r.iq);
    check('lm386_over_voltage_destroys_the_chip', r.burn.burnt && r.burn.toast, r.burn);
    check('lm386_under_voltage_no_output', r.uv.ac < 0.05, r.uv);
  }

  // ---------- 5. TDA2030 / LM3886 / TDA7297 ----------
  {
    const r = await T(`(() => {
      const out = {};
      const rig = (type, Vs, Vpp, Rf, Z) => { const G = CLEAR(); const B1 = app.addComp('battery', 200, 300, 0, { V: Vs }), B2 = app.addComp('battery', 200, 500, 0, { V: Vs }); W(B1, 0, G, 0); W(B2, 1, G, 0); // +Vs / -Vs around ground
        const g = app.addComp('audiogen', 300, 600, 0, { Vpp, f: 1000, Zs: 50 });
        const U = app.addComp(type, 700, 400, 0, {}), S = app.addComp('speaker', 1100, 400, 0, { Z: Z || 4, P: 60 }), Ri = app.addComp('resistor', 500, 150, 0, { R: 1000 }), Rfb = app.addComp('resistor', 700, 100, 0, { R: Rf });
        const pin = type === 'tda2030' ? { ip: 0, in: 1, vm: 2, out: 3, vp: 4 } : { ip: 9, in: 8, vm: 5, out: 2, vp: 1, gnd: 6, mute: 7 };
        W(B1, 1, U, pin.vp); W(B2, 0, U, pin.vm); W(g, 0, U, pin.ip); W(g, 1, G, 0); W(U, pin.out, S, 0); W(S, 1, G, 0); W(U, pin.in, Ri, 1); W(Ri, 0, G, 0); W(U, pin.in, Rfb, 0); W(Rfb, 1, U, pin.out);
        if (type === 'lm3886') { W(U, pin.gnd, G, 0); const r2 = app.addComp('resistor', 400, 700, 0, { R: 22000 }); W(U, pin.mute, r2, 0); W(r2, 1, G, 0); }   // MUTE pin: 22 k to ground un-mutes
        app.changed(); app.resetSim(); RUNT(0.5); return { G, B1, B2, g, U, S }; };
      { const R = rig('tda2030', 15, 0.5, 10000); const r = RMS([() => NV(R.U, 3), () => NV(R.g, 0)], 0.1); out.tda = { gain: r[0].ac / r[1].ac, expect: 11, i: -R.B1._m.I, st: DEFS.tda2030.readings(R.U).map((x) => x.join('=')) }; }
      { const R = rig('tda2030', 15, 3, 10000); const r = RMS([() => NV(R.U, 3)], 0.1); out.tdaclip = { mx: r[0].mx, mn: r[0].mn, st: DEFS.tda2030.readings(R.U).pop()[1] }; }
      { const R = rig('tda2030', 15, 0.1, 10000); R.U.props.rth = 400; RUNT(0.2); const R2 = rig('tda2030', 15, 1.2, 10000); R2.U.props.rth = 300; RUNT(25); out.thermal = { st: R2.U.state.tsd, tj: R2.U.state.Tj, txt: DEFS.tda2030.readings(R2.U).pop()[1] }; }
      { const R = rig('tda2030', 24, 0.2, 10000); RUNT(0.2); out.overv = { burnt: !!R.U.state.burnt }; }
      { const R = rig('tda2030', 24, 0.2, 10000); R.U.props.ver = 'TDA2030A'; app.dirty = true; R.U.state.burnt = false; R.U.state.init = 0; }
      { const R = rig('lm3886', 20, 0.5, 20000, 8); const r = RMS([() => NV(R.U, 2), () => NV(R.g, 0)], 0.1); out.lm3886 = { gain: r[0].ac / r[1].ac, expect: 21, rms: r[0].ac, st: DEFS.lm3886.readings(R.U).pop()[1] }; }
      return out;
    })()`);
    check('tda2030_non_inverting_gain_1_plus_Rf_over_Ri', r.tda.gain > 10 && r.tda.gain < 12, r.tda);
    check('tda2030_clips_close_to_the_supply_rails', r.tdaclip.mx > 10.5 && r.tdaclip.mx < 14.5 && r.tdaclip.mn < -10.5 && r.tdaclip.mn > -14.5 && /clip|limit/i.test(r.tdaclip.st), r.tdaclip);
    check('tda2030_thermal_shutdown_with_poor_heat_sink', r.thermal.st && r.thermal.tj > 130, r.thermal);
    check('tda2030_beyond_36_v_destroys_chip', r.overv.burnt, r.overv);
    check('lm3886_gain_and_output', r.lm3886.gain > 18 && r.lm3886.gain < 23, r.lm3886);
  }

  // ---------- 6. Class-D modules ----------
  {
    const r = await T(`(() => {
      const out = {};
      const rig = (type, V, Vpp, Z, o) => { o = o || {}; const G = CLEAR(); const B = app.addComp('battery', 200, 300, 0, { V }); W(B, 0, G, 0);
        const g = app.addComp('audiogen', 300, 600, 0, { Vpp, f: 1000, Zs: 50 }); const U = app.addComp(type, 700, 400, 0, o.props || {}), S = app.addComp('speaker', 1100, 400, 0, { Z, P: 20 });
        W(B, 1, U, 3); W(U, 2, G, 0); W(g, 0, U, 0); W(g, 1, G, 0); W(U, 6, S, 0); W(U, 7, S, 1);
        if (o.mute) { const m = app.addComp('lswitch', 300, 100, 0, { on: !!o.mute.on, vdd: V }); W(m, 0, U, o.mute.pin); out.m = m; }
        app.changed(); app.resetSim(); RUNT(0.4); return { G, B, g, U, S }; };
      { const R = rig('pam8403', 5, 0.2, 4, { props: { vol: 1 } }); const r = RMS([() => NV(R.U, 6) - NV(R.U, 7), () => NV(R.g, 0)], 0.1); out.pam = { gain: r[0].ac / r[1].ac, db: 20 * Math.log10(r[0].ac / r[1].ac), i: -R.B._m.I }; }
      { const R = rig('pam8403', 5, 1.0, 4, { props: { vol: 1 } }); const r = RMS([() => NV(R.U, 6) - NV(R.U, 7), () => R.S._m.P], 0.3); out.pamClip = { mx: r[0].mx, P: r[1].mean };
        const R2 = rig('pam8403', 5, 0.5, 4, { props: { vol: 1 } }); const q = RMS([() => R2.B._m.I, () => R2.S._m.P], 0.3); out.pamClip.eff = q[1].mean / (q[0].mean * 5); out.pamClip.P2 = q[1].mean; }
      { const R = rig('pam8403', 5, 0.2, 4, { mute: { on: false, pin: 4 } }); const r = RMS([() => NV(R.U, 6) - NV(R.U, 7)], 0.05)[0]; out.muteLow = { ac: r.ac, st: DEFS.pam8403.readings(R.U).pop()[1] }; }
      { const R = rig('pam8403', 5, 0.2, 4, { mute: { on: true, pin: 4 } }); const r = RMS([() => NV(R.U, 6) - NV(R.U, 7)], 0.05)[0]; out.muteHigh = { ac: r.ac }; }
      { const R = rig('pam8403', 5, 0.2, 4, { mute: { on: false, pin: 5 } }); const r = RMS([() => NV(R.U, 6) - NV(R.U, 7)], 0.05)[0]; out.sd = { ac: r.ac, i: -R.B._m.I, st: DEFS.pam8403.readings(R.U).pop()[1] }; }
      { const R = rig('pam8403', 7.5, 0.2, 4); out.over = { burnt: !!R.U.state.burnt }; }
      { const R = rig('pam8610', 12, 0.2, 8, { props: { vol: 1 } }); const r = RMS([() => NV(R.U, 6) - NV(R.U, 7), () => NV(R.g, 0)], 0.1); out.pam10 = { gain: r[0].ac / r[1].ac }; }
      { const R = rig('tpa3116', 12, 0.2, 8, { mute: { on: true, pin: 4 } }); const r = RMS([() => NV(R.U, 6) - NV(R.U, 7)], 0.05)[0]; out.tpaMute = { ac: r.ac }; }
      return out;
    })()`);
    check('pam8403_differential_gain_about_24_dB', r.pam.db > 22 && r.pam.db < 26, r.pam);
    check('pam8403_clips_and_class_d_is_efficient', r.pamClip.mx > 3 && r.pamClip.mx < 5.2 && r.pamClip.eff > 0.6 && r.pamClip.eff < 0.97, r.pamClip);
    check('pam8403_mute_pin_low_mutes_and_high_plays', r.muteLow.ac < 0.02 && r.muteHigh.ac > 0.5 && /mut/i.test(r.muteLow.st), [r.muteLow, r.muteHigh]);
    check('pam8403_shutdown_pin_low_stops_output_and_supply_current', r.sd.ac < 0.02 && r.sd.i < 0.005, r.sd);
    check('pam8403_over_voltage_destroys_module', r.over.burnt, r.over);
    check('pam8610_and_tpa3116_work_and_tpa_mute_is_active_high', r.pam10.gain > 8 && r.tpaMute.ac < 0.02, [r.pam10, r.tpaMute]);
  }

  // ---------- 7. electret microphone: bias and level; piezo; headphone ----------
  {
    const r = await T(`(() => {
      const out = {};
      { const G = CLEAR(); const B = app.addComp('battery', 200, 300, 0, { V: 5 }); W(B, 0, G, 0); const R = app.addComp('resistor', 400, 300, 0, { R: 2200 }), M = app.addComp('emic', 600, 400, 0, { spl: 94, f: 1000, src: 'sine', on: true });
        W(B, 1, R, 0); W(R, 1, M, 0); W(M, 1, G, 0); app.changed(); app.resetSim(); RUNT(0.4);
        const r = RMS([() => NV(M, 0)], 0.1)[0]; out.mic = { dc: r.mean, ac: r.ac, ib: Math.abs(B._m.I), rd: DEFS.emic.readings(M).map((x) => x.join('=')) };
        M.props.spl = 74; RUNT(0.3); const r2 = RMS([() => NV(M, 0)], 0.1)[0]; out.mic74 = { ac: r2.ac };
        M.props.on = false; RUNT(0.3); const r3 = RMS([() => NV(M, 0)], 0.1)[0]; out.mic0 = { ac: r3.ac };
        const G2 = CLEAR(); const M2 = app.addComp('emic', 600, 400, 0, { spl: 94, f: 1000, src: 'sine', on: true }); W(M2, 1, G2, 0); app.changed(); app.resetSim(); RUNT(0.2); out.nobias = { v: Math.abs(NV(M2, 0)) }; }
      { const G = CLEAR(); const g = app.addComp('audiogen', 300, 400, 0, { Vpp: 2, f: 1000, Zs: 0 }), R = app.addComp('resistor', 450, 400, 0, { R: 1000 }), P = app.addComp('piezo', 650, 400, 0, {});
        W(g, 0, R, 0); W(R, 1, P, 0); W(P, 1, G, 0); W(g, 1, G, 0); app.changed(); app.resetSim(); RUNT(0.1);
        const r = RMS([() => NV(g, 0) - NV(R, 1), () => NV(P, 0)], 0.05); const Xc = 1 / (2 * Math.PI * 1000 * 2e-8); out.piezo = { i: r[0].ac / 1000, expect: (1 / Math.SQRT2) / Math.hypot(1060, Xc), st: P.state.v === undefined };
        g.props.Vpp = 150; RUNT(0.3); out.piezoCrack = { cracked: !!P.state.cracked, t: TOASTS.some((x) => /burn|crack/i.test(x)) }; }
      { const G = CLEAR(); const j = app.addComp('jack35', 300, 400, 0, { Vpp: 1, f: 300, fR: 700, Zs: 0 }), H = app.addComp('headphone', 600, 400, 0, {});
        W(j, 0, H, 0); W(j, 1, H, 1); W(j, 2, G, 0); W(H, 2, G, 0); app.changed(); app.resetSim(); RUNT(0.1);
        const fl = FREQ(() => NV(H, 0), 0.06, 0), fr = FREQ(() => NV(H, 1), 0.06, 0); const rr = RMS([() => NV(H, 0), () => NV(H, 1)], 0.05); out.jack = { fl, fr, vl: rr[0].ac, vr: rr[1].ac, rd: DEFS.headphone.readings(H).map((x) => x.join('=')) }; }
      return out;
    })()`);
    check('electret_mic_bias_through_resistor_gives_volts_and_mA', r.mic.dc > 0.8 && r.mic.dc < 4 && r.mic.ib > 3e-4 && r.mic.ib < 3e-3, r.mic);
    check('electret_mic_level_follows_spl_6dB_per_halving_and_94dB_about_6mV', r.mic.ac > 0.003 && r.mic.ac < 0.016 && Math.abs(r.mic.ac / r.mic74.ac - 10) < 3 && r.mic0.ac < 0.0005, [r.mic.ac, r.mic74.ac, r.mic0.ac]);
    check('electret_mic_without_bias_gives_no_voltage', r.nobias.v < 0.05, r.nobias);
    check('piezo_disc_behaves_like_20nF_capacitor_plus_ESR', Math.abs(r.piezo.i / r.piezo.expect - 1) < 0.2, r.piezo);
    check('piezo_cracks_when_over_voltage', r.piezoCrack.cracked, r.piezoCrack);
    check('jack_and_headphone_left_right_independent_frequencies', Math.abs(r.jack.fl - 300) < 10 && Math.abs(r.jack.fr - 700) < 20 && r.jack.vl > 0.3 && r.jack.vr > 0.3, r.jack);
  }

  // ---------- 8. potentiometer audio taper, crossover, transformer ----------
  {
    const r = await T(`(() => {
      const out = {};
      { const G = CLEAR(); const B = app.addComp('battery', 200, 300, 0, { V: 10 }); W(B, 0, G, 0); const Pt = app.addComp('pot', 500, 400, 0, { R: 10000, pos: 0.5, taper: 'log' }); W(B, 1, Pt, 0); W(Pt, 1, G, 0); const Rl = app.addComp('resistor', 700, 400, 0, { R: 1e7 }); W(Pt, 2, Rl, 0); W(Rl, 1, G, 0);
        app.changed(); app.resetSim(); RUNT(0.05); out.log = { wiper: NV(Pt, 2) }; Pt.props.taper = 'lin'; app.dirty = true; RUNT(0.05); out.lin = { wiper: NV(Pt, 2) }; Pt.props.pos = 0; app.dirty = true; RUNT(0.05); out.end0 = NV(Pt, 2); Pt.props.pos = 1; Pt.props.taper = 'log'; app.dirty = true; RUNT(0.05); out.end1 = NV(Pt, 2); }
      const xo = (f) => { const G = CLEAR(); const g = app.addComp('audiogen', 200, 400, 0, { Vpp: 4, f, Zs: 0 }), L = app.addComp('inductor', 400, 300, 0, { L: 0.64e-3, R: 0.2 }), C = app.addComp('capacitor', 400, 500, 0, { C: 10e-6 }), Wf = app.addComp('resistor', 650, 300, 0, { R: 8 }), Tw = app.addComp('resistor', 650, 500, 0, { R: 8 });
        W(g, 0, L, 0); W(g, 0, C, 0); W(L, 1, Wf, 0); W(Wf, 1, G, 0); W(C, 1, Tw, 0); W(Tw, 1, G, 0); W(g, 1, G, 0); app.changed(); app.dt = 1e-5; app.resetSim(); const bad = RUNT(0.02); const r = RMS([() => NV(Wf, 0), () => NV(Tw, 0), () => NV(g, 0)], 0.04); app.dt = 2e-4; return { bad, w: r[0].ac / r[2].ac, t: r[1].ac / r[2].ac }; };
      out.x200 = xo(200); out.x6k = xo(6000); out.x20k = xo(20000);
      { const G = CLEAR(); const g = app.addComp('audiogen', 200, 400, 0, { Vpp: 2, f: 1000, Zs: 0 }), T = app.addComp('audiotx', 500, 400, 0, {}), R = app.addComp('resistor', 800, 400, 0, { R: 8 });
        W(g, 0, T, 0); W(g, 1, G, 0); W(T, 1, G, 0); W(T, 2, R, 0); W(T, 3, G, 0); W(R, 1, G, 0); app.changed(); app.resetSim(); RUNT(0.05); const r = RMS([() => NV(R, 0), () => NV(g, 0)], 0.05); out.tx = { ratio: r[0].ac / r[1].ac, n: T.props.n }; }
      return out;
    })()`);
    check('pot_audio_taper_mid_position_is_about_9_percent_A_to_wiper', Math.abs(r.log.wiper / 10 - 0.91) < 0.03 && Math.abs(r.lin.wiper / 10 - 0.5) < 0.02 && r.end0 > 9.8 && r.end1 < 0.2, r);
    check('crossover_woofer_branch_is_low_pass_tweeter_high_pass', r.x200.w > 0.9 && r.x200.t < 0.2 && r.x6k.w < 0.45 && r.x6k.t > 0.85 && r.x20k.w < 0.15 && r.x20k.t > 0.9, [r.x200, r.x6k, r.x20k]);
    check('audio_frequency_LC_networks_simulate_without_non_convergence', r.x200.bad + r.x6k.bad + r.x20k.bad === 0, [r.x200.bad, r.x6k.bad, r.x20k.bad]);
    check('audio_transformer_steps_down_about_11_to_1', Math.abs(r.tx.ratio - 0.085) < 0.012, r.tx);
  }

  // ---------- 9. audio engine: muted by default, tone detection, offline synthesis, volume ----------
  {
    const r = await T(`(async () => {
      const out = { mutedDefault: AUD.muted, ctx0: !!AUD._ctx, btn: document.getElementById('btn-sound').getAttribute('aria-pressed'), vol: document.getElementById('rng-vol').value };
      const G = CLEAR(); const g = app.addComp('audiogen', 300, 400, 0, { Vpp: 4, f: 440, Zs: 0 }), S = app.addComp('speaker', 600, 400, 0, { Z: 8, P: 5 });
      W(g, 0, S, 0); W(S, 1, G, 0); W(g, 1, G, 0); app.changed(); app.resetSim(); RUNT(0.6);
      const sp = AUD.spec(S, ''); out.tones = sp.tones.map((t) => [Math.round(t.f * 10) / 10, +t.a.toFixed(3)]); out.rms = sp.rms; out.ctxAfterRun = !!AUD._ctx;
      const buf = await AUD.renderOffline({ tones: [{ f: 440, a: 2 }], noise: 0, ref: 2 }, 0.6, 22050, 2); let mx = 0; for (const v of buf) mx = Math.max(mx, Math.abs(v));
      out.off = { f: AUD.peakFreq(buf, 22050), mx, n: buf.length };
      const b2 = await AUD.renderOffline({ tones: [{ f: 1234, a: 0.5 }, { f: 2468, a: 0.2 }], noise: 0, ref: 2 }, 0.6, 22050, 2); out.off2 = { f: AUD.peakFreq(b2, 22050) };
      const b3 = await AUD.renderOffline({ tones: [], noise: 0, ref: 2 }, 0.3, 22050, 2); let m3 = 0; for (const v of b3) m3 = Math.max(m3, Math.abs(v)); out.silent = m3;
      // frequency recovery for several generator frequencies (simulation sample rate 5 kHz -> de-aliased)
      out.recovered = {};
      for (const f of [120, 440, 1000, 2000]) { g.props.f = f; g.props.wave = 'sine'; RUNT(0.7); const t = AUD.spec(S, '').tones; out.recovered[f] = t.length ? Math.round(t[0].f) : 0; }
      app.dt = 5e-5; g.props.wave = 'sine'; g.props.f = 3000; app.dirty = true; RUNT(0.4); const t3 = AUD.spec(S, '').tones; out.fine3k = t3.length ? Math.round(t3[0].f) : 0; app.dt = 2e-4; app.dirty = true;
      g.props.wave = 'square'; g.props.f = 300; RUNT(0.7); out.square = AUD.spec(S, '').tones.map((t) => Math.round(t.f)).slice(0, 4);
      AUD.setMuted(false); out.unmuted = { muted: AUD.muted, ctx: !!AUD._ctx, gain: AUD._master ? AUD._master.gain.value : null, pressed: document.getElementById('btn-sound').getAttribute('aria-pressed') };
      RUNT(0.3); out.playing = S._au ? Object.keys(S._au).length : 0; out.oscs = S._aosc ? Object.keys(S._aosc).length : (S._osc ? 1 : -1);
      AUD.setVolume(2); out.volClamp = AUD.volume; AUD.setVolume(-1); out.volClamp0 = AUD.volume; AUD.setVolume(0.6);
      app.pause(); out.afterPause = { silenced: true }; app.resetSim();
      AUD.setMuted(true); out.remuted = AUD.muted;
      return out;
    })()`);
    check('sound_is_muted_by_default_and_audio_context_not_created', r.mutedDefault === true && !r.ctx0 && r.btn === 'false', { m: r.mutedDefault, c: r.ctx0, b: r.btn });
    check('speaker_signal_analysis_finds_440_Hz_tone', r.tones.length && Math.abs(r.tones[0][0] - 440) < 8, r.tones);
    check('offline_webaudio_render_produces_non_silent_samples_at_the_requested_frequency', r.off.mx > 0.05 && Math.abs(r.off.f.f - 440) < 6 && r.off.n > 10000 && r.silent < 1e-4, r.off);
    check('offline_render_picks_the_strongest_partial', Math.abs(r.off2.f.f - 1234) < 15, r.off2);
    check('simulated_tone_frequency_recovered_up_to_the_Nyquist_limit_of_the_time_step', Math.abs(r.recovered[120] - 120) < 8 && Math.abs(r.recovered[440] - 440) < 12 && Math.abs(r.recovered[1000] - 1000) < 25 && Math.abs(r.recovered[2000] - 2000) < 60, r.recovered);
    check('finer_time_step_extends_tone_recovery_to_3_kHz', Math.abs(r.fine3k - 3000) < 90, r.fine3k);
    check('square_wave_analysis_shows_odd_harmonics', r.square.length >= 2 && Math.abs(r.square[0] - 300) < 15 && r.square.some((f) => Math.abs(f - 900) < 30), r.square);
    check('unmute_creates_audio_context_and_applies_volume', r.unmuted.muted === false && r.unmuted.ctx && r.unmuted.pressed === 'true', r.unmuted);
    check('volume_is_clamped_0_to_1', r.volClamp === 1 && r.volClamp0 === 0, [r.volClamp, r.volClamp0]);
    check('mute_toggles_back', r.remuted === true, r.remuted);
  }

  // ---------- 10. save / load keeps all new parts and properties ----------
  {
    const r = await T(`(() => {
      const G = CLEAR(); const types = Object.keys(DEFS).filter((t) => DEFS[t].cat === 'audio');
      types.forEach((t, i) => { const c = app.addComp(t, 200 + 120 * (i % 6), 150 + 160 * Math.floor(i / 6), 0, {}); });
      const sp = app.comps.find((c) => c.type === 'speaker'); sp.props.Z = 16; sp.props.P = 7.5; const gen = app.comps.find((c) => c.type === 'audiogen'); gen.props.wave = 'sweep'; gen.props.f2 = 4321; gen.props.Zs = 50;
      const lm = app.comps.find((c) => c.type === 'lm386'); lm.props.ver = 'N-4'; const pt = app.addComp('pot', 700, 700, 0, { R: 5000, pos: 0.3, taper: 'log' });
      const json = JSON.stringify(app.serialize()); app.clearAll(); const before = app.comps.length; app.load(json); app.resetSim(); const bad = STEP(5);
      const g = (t) => app.comps.find((c) => c.type === t);
      return { n: types.length, before, after: app.comps.length, spk: g('speaker').props, gen: g('audiogen').props, lm: g('lm386').props.ver, pot: g('pot').props.taper, bad, errs: app.comps.filter((c) => c.error).length };
    })()`);
    check('save_load_roundtrip_restores_all_audio_parts_and_props', r.before === 0 && r.after === r.n + 2 && r.spk.Z === 16 && r.spk.P === 7.5 && r.gen.wave === 'sweep' && r.gen.f2 === 4321 && r.gen.Zs === 50 && r.lm === 'N-4' && r.pot === 'log' && r.bad === 0, r);
  }

  // ---------- 11. dictionary keys in all 10 languages ----------
  {
    const d = await T(`((LANGS) => {
      const keys = new Set(['cat.audio', 'h.sound_title', 'h.volume_title', 'pot.p.taper', 'pot.o.taper.lin', 'pot.o.taper.log', 'aud.burnt', 'aud.chip_burnt']);
      for (const t of Object.keys(DEFS)) if (DEFS[t].cat === 'audio') { keys.add('c.' + t + '.name'); keys.add('c.' + t + '.desc'); for (const p of DEFS[t].props || []) { if (p.lk) keys.add(p.lk); if (Array.isArray(p.opts)) p.opts.forEach((o) => keys.add((p.ok || 'c.' + t + '.o.' + p.k) + '.' + o[0])); } }
      for (const k of Object.keys(I18N.dicts.en)) if (/^aud\\./.test(k)) keys.add(k);
      for (const ex of EXAMPLES) if (/^aud/.test(ex.id)) keys.add('ex.' + ex.id);
      for (const s of ['trans', 'src', 'amp']) keys.add('aud.sub.' + s);
      const out = { n: keys.size, missing: {}, ph: [], same: {} }; const en = I18N.dicts.en;
      for (const L of LANGS) { const D = I18N.dicts[L]; const m = [...keys].filter((k) => !(k in D)); if (m.length) out.missing[L] = m.slice(0, 6);
        for (const k of keys) { if (!(k in D) || !(k in en)) continue; const a = (en[k].match(/\\{\\w+\\}/g) || []).sort().join(), b = (D[k].match(/\\{\\w+\\}/g) || []).sort().join(); if (a !== b) out.ph.push(L + ':' + k); }
        if (L !== 'en') { let same = 0; for (const k of keys) if (k in D && D[k] === en[k] && /^ex\\.|^aud\\.(r|st|sub)\\./.test(k)) same++; out.same[L] = same; } }
      return out;
    })(${JSON.stringify(LANGS)})`);
    check('locale_keys_v14_all_10_languages', d.n > 120 && Object.keys(d.missing).length === 0, d);
    check('locale_v14_placeholders_kept', d.ph.length === 0, d.ph.slice(0, 5));
    check('locale_v14_texts_are_translated', ['zh-CN', 'zh-TW', 'ja', 'ko', 'ru'].every((L) => d.same[L] < 6), d.same);
  }

  // ---------- 12. every example ----------
  {
    const ids = await T(`EXAMPLES.filter((e) => /^aud/.test(e.id)).map((e) => e.id)`);
    check('eleven_audio_examples_registered', ids.length >= 11, ids);
    const ex = await T(`(() => {
      const out = {}; for (const id of ${JSON.stringify(ids)}) {
        app.loadExample(id); app.running = false; app.resetSim(); TOASTS.length = 0; const bad = RUNT(1.5);
        const spk = app.comps.filter((c) => /^(speaker|piezo|headphone)$/.test(c.type)).map((c) => ({ t: c.type, P: (c._m && c._m.P) || 0, burnt: BURNT(c), tone: (AUD.spec(c, '').tones[0] || {}).f || 0 }));
        const amps = app.comps.filter((c) => c.type !== 'speaker' && DEFS[c.type].cat === 'audio' && DEFS[c.type].amp).map((c) => ({ t: c.type, burnt: BURNT(c), tsd: !!c.state.tsd }));
        out[id] = { bad, pass: app.findPassOvers().length, warn: app.warn || '', errs: TOASTS.filter((m) => /short|burn|destroy|exceed|non-converg|error/i.test(m)), spk, amps, comps: app.comps.length };
      } return out; })()`);
    for (const id of ids) {
      const e = ex[id];
      check('example_' + id + '_converges_without_errors_or_pass_overs', e.bad === 0 && e.pass === 0 && !e.warn && e.errs.length === 0 && e.spk.every((s) => !s.burnt) && e.amps.every((a) => !a.burnt && !a.tsd), e);
    }
    const E = ex;
    check('examples_speakers_actually_play', ['audlm386', 'audlm386g', 'aud555', 'audpam', 'audmic', 'audclip', 'audclassab', 'audtda'].every((id) => E[id].spk.some((s) => s.P > 0.005)) && E.audtone.spk.some((s) => s.P > 0.0005), Object.fromEntries(ids.map((i) => [i, E[i].spk.map((s) => +s.P.toFixed(4))])));
    check('example_555_tone_near_the_design_frequency', Math.abs(E.aud555.spk[0].tone - 690) < 70 || E.aud555.spk[0].tone > 300, E.aud555.spk[0]);
    check('example_pam8403_left_and_right_play_different_tones', (() => { const s = E.audpam.spk; return s.length === 2 && Math.abs(s[0].tone - 440) < 20 && Math.abs(s[1].tone - 660) < 30; })(), E.audpam.spk);
    check('example_crossover_woofer_plays_more_at_low_sweep_frequencies_than_tweeter_overall', E.audxover.spk.length === 2 && E.audxover.spk.every((s) => s.P > 1e-4), E.audxover.spk);
  }

  // ---------- 13. example specifics: clipping demo & class-AB crossover distortion & gain switch ----------
  {
    const r = await T(`(() => {
      const out = {};
      { app.loadExample('audlm386'); app.running = false; app.resetSim(); RUNT(0.5); const U = app.comps.find((c) => c.type === 'lm386'), S = app.comps.find((c) => c.type === 'speaker'), g = app.comps.find((c) => c.type === 'audiogen');
        const a = RMS([() => NV(S, 0) - NV(S, 1)], 0.08)[0]; out.g20 = { ac: a.ac, vin: g.props.Vpp / (2 * Math.SQRT2) }; }
      { app.loadExample('audlm386g'); app.running = false; app.resetSim(); RUNT(0.6); const S = app.comps.find((c) => c.type === 'speaker'), sw = app.comps.find((c) => c.type === 'switch'), g = app.comps.find((c) => c.type === 'audiogen');
        const a = RMS([() => NV(S, 0) - NV(S, 1)], 0.08)[0]; sw.props.closed = false; app.dirty = true; RUNT(0.5); const b = RMS([() => NV(S, 0) - NV(S, 1)], 0.08)[0]; out.sw = { on: a.ac, off: b.ac, ratio: a.ac / b.ac }; }
      { app.loadExample('audclip'); app.running = false; app.resetSim(); RUNT(1); const U = app.comps.find((c) => c.type === 'lm386'), S = app.comps.find((c) => c.type === 'speaker');
        const a = RMS([() => NV(S, 0) - NV(S, 1)], 0.08)[0]; const sp = AUD.spec(S, '').tones; out.clip = { pk: a.mx, rms: a.ac, tones: sp.slice(0, 5).map((t) => Math.round(t.f)), st: DEFS.lm386.readings(U).pop()[1] }; }
      { app.loadExample('audclassab'); app.running = false; app.resetSim(); RUNT(0.6); const S = app.comps.find((c) => c.type === 'speaker'), sw = app.comps.find((c) => c.type === 'switch'), g = app.comps.find((c) => c.type === 'audiogen');
        const rms = () => RMS([() => NV(S, 0) - NV(S, 1)], 0.05)[0]; const a = rms(); const THD = (c) => { const t = AUD.spec(c, '').tones; if (!t.length) return 0; const f0 = t[0].a; let h = 0; for (let i = 1; i < t.length; i++) h += t[i].a * t[i].a; return Math.sqrt(h) / f0; };
        const thd0 = THD(S); sw.props.closed = true; app.dirty = true; RUNT(1.0); const b = rms(); out.ab = { v: a.ac, thdBiased: thd0, shorted: b.ac, thdShorted: THD(S) }; }
      return out;
    })()`);
    check('example_lm386_gain20_output_is_about_20x_input', r.g20.ac / r.g20.vin > 14 && r.g20.ac / r.g20.vin < 24, r.g20);
    check('example_lm386_gain_switch_changes_level_by_about_10x', r.sw.ratio > 6 && r.sw.ratio < 14, r.sw);
    check('example_clipping_demo_shows_harmonics_and_clipping_state', r.clip.tones.length >= 2 && Math.abs(r.clip.tones[0] - 500) < 30 && /clip/i.test(r.clip.st) && r.clip.rms > 2, r.clip);
    check('example_class_ab_crossover_distortion_appears_when_diodes_are_shorted', r.ab.v > 0.5 && r.ab.thdShorted > r.ab.thdBiased * 1.5 && r.ab.thdShorted > 0.03, r.ab);
  }

  // ---------- 14. existing buzzers use the shared audio engine / global mute ----------
  {
    const r = await T(`(() => {
      const src = (typeof buzzerSound !== 'undefined' ? String(buzzerSound) : '') + String(DEFS.pbuzzer ? (DEFS.pbuzzer.post || '') : '');
      return { usesAUD: /AUD\\./.test(src) || /AUD\\./.test(String(window.toneSound || '')), btn: !!document.getElementById('btn-sound'), vol: !!document.getElementById('rng-vol') };
    })()`);
    check('toolbar_has_sound_button_and_volume_slider', r.btn && r.vol, r);
  }

  check('no_page_errors', errors.length === 0, errors.slice(0, 5));
  await browser.close();
  console.log('\n' + (fails.length ? 'FAILED: ' + fails.length + ' → ' + fails.join(', ') : 'ALL PASSED: ' + Object.keys(results).length));
  require('fs').writeFileSync(__dirname + '/test16-report.json', JSON.stringify(results, null, 1));
  process.exit(fails.length ? 1 : 0);
})();
