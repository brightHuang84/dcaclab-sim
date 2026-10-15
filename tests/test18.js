// v15 tests: real-world simulation mode (🎲) — off = ideal v14.1 behaviour; tolerances (seeded, stable, re-roll), battery sag / discharge,
// PSU ripple, source noise, ADC jitter, self-heating drift, wire resistance, contact bounce (MCU counter), sensor noise, meter flicker,
// scope noise, properties panel nominal → actual, settings popover + localStorage, 10-locale keys, examples.
const { chromium } = require('playwright-core');
const fails = []; let npass = 0;
const check = (name, cond, info) => { if (cond) npass++; else fails.push(name); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(info).slice(0, 500))); };
const BASE = process.env.URL || 'http://127.0.0.1:8765/index.html';
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt-BR'];
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, locale: 'zh-CN' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '?lang=zh-CN'); await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.RUNT = (sec) => { const t1 = app.t + sec; let bad = 0, n = 0; while (app.t < t1 && n++ < 400000) { app.simStep(); if (!app.net.converged) bad++; } return bad; };
    window.W = (a, ia, b, ib) => { const p = app.termPos(a, ia), q = app.termPos(b, ib); return app.addWire(p[0], p[1], q[0], q[1], 1); };
    window.CLEAR = () => { app.clearAll(); app.pause(); app.running = false; return app.addComp('ground', 100, 700, 0, {}); };
    window.ONLY = (...k) => { const fx = {}; REAL.FX.forEach((f) => { fx[f] = k.includes(f); }); REAL.set({ on: true, level: 'med', fx, seed: 7, rippleMv: 50, rippleHz: 100 }); };
    window.ALL = () => { const fx = {}; REAL.FX.forEach((f) => { fx[f] = true; }); REAL.set({ on: true, level: 'med', fx, seed: 7 }); };
    window.OFF = () => REAL.set({ on: false });
    // battery + R (+ optional wires) loop
    window.LOOP = (R, src) => { const G = CLEAR(); const B = app.addComp(src || 'battery', 300, 400, 0, src === 'psu' ? { V: 12, I: 3 } : { V: 9 }); const r = app.addComp('resistor', 500, 300, 0, { R }); W(B, 1, r, 0); W(r, 1, G, 0); W(B, 0, G, 0); app.changed(); app.resetSim(); return { B, r }; };
    window.VS = () => app.comps.map((c) => (c._m ? [c._m.V, c._m.I] : null));
  });
  const E = (f, a) => page.evaluate(f, a);

  // ---------- 1. defaults & off = ideal ----------
  let r = await E(() => ({ on: REAL.S.on, btn: document.getElementById('btn-real').classList.contains('on'), set: !!document.getElementById('btn-real-set'), fx: REAL.FX.length }));
  check('default_off_and_toolbar_buttons', !r.on && !r.btn && r.set && r.fx === 11, r);
  r = await E(() => {
    OFF(); const a = LOOP(1000); RUNT(0.05); const v1 = JSON.stringify(VS()), i1 = a.r._m.I;
    ALL(); app.resetSim(); RUNT(0.05); const i2 = a.r._m.I;
    OFF(); app.resetSim(); RUNT(0.05); const v3 = JSON.stringify(VS());
    return { exact: Math.abs(Math.abs(i1) - 9e-3) < 1e-12, same: v1 === v3, changed: i1 !== i2, ser: !/"_r[a-zA-Z]/.test(JSON.stringify(app.serialize())), html: REAL.propsHtml(a.r) };
  });
  check('off_is_ideal_9V_over_1k_exact', r.exact, r);
  check('on_changes_values_then_off_restores_bit_identical', r.changed && r.same, r);
  check('no_real_state_in_saved_circuit_and_no_props_box_when_off', r.ser && r.html === '', r);

  // ---------- 2. tolerances ----------
  r = await E(() => {
    ONLY('tol'); const a = LOOP(1000); RUNT(0.02);
    const R1 = 9 / Math.abs(a.r._m.I), act = a.r._rt.R.act;
    app.resetSim(); RUNT(0.02); const R2 = 9 / Math.abs(a.r._m.I);
    REAL.set({ seed: 99 }); app.resetSim(); RUNT(0.02); const R3 = 9 / Math.abs(a.r._m.I);
    REAL.set({ seed: 7 }); app.resetSim(); RUNT(0.02); const R4 = 9 / Math.abs(a.r._m.I);
    const band = {}; for (const lv of ['low', 'med', 'high']) { REAL.set({ level: lv }); let mx = 0; for (let s = 1; s <= 40; s++) { REAL.set({ seed: s }); app.resetSim(); RUNT(0.001); mx = Math.max(mx, Math.abs(a.r._rt.R.f - 1)); } band[lv] = mx; }
    REAL.set({ level: 'med', seed: 7 }); const S0 = REAL.S.seed; REAL.reroll(); const S1 = REAL.S.seed; REAL.set({ seed: 7 });
    return { R1, act, R2, R3, R4, band, S0, S1, nominalKept: a.r.props.R };
  });
  check('tolerance_applied_and_matches_actual', Math.abs(r.R1 - r.act) / r.act < 1e-6 && Math.abs(r.R1 - 1000) > 0.01, r);
  check('tolerance_stable_across_reset', r.R1 === r.R2 && r.R1 === r.R4, r);
  check('reroll_seed_changes_value', r.R3 !== r.R1 && r.S0 !== r.S1, r);
  check('tolerance_within_bands_low1_med5_high10', r.band.low <= 0.01 + 1e-9 && r.band.med <= 0.05 + 1e-9 && r.band.high <= 0.1 + 1e-9 && r.band.med > 0.02 && r.band.high > r.band.med, r.band);
  check('nominal_property_unchanged', r.nominalKept === 1000, r);
  // properties panel
  r = await E(() => { const c = app.comps.find((x) => x.type === 'resistor'); app.sel = { comp: c }; app.refreshProps(); const box = document.querySelector('#props .real-box'); return box ? box.textContent : null; });
  check('properties_show_nominal_to_actual', !!r && /1(\.000)?\s*kΩ/.test(r) && /→/.test(r) && /%/.test(r), r);

  // ---------- 3. battery ----------
  r = await E(() => {
    ONLY('bat'); const a = LOOP(100); RUNT(0.05); const v0 = Math.abs(a.r._m.I) * 100;
    REAL.set({ level: 'high' }); app.resetSim(); RUNT(0.05); const vA = Math.abs(a.r._m.I) * 100; RUNT(3); const vB = Math.abs(a.r._m.I) * 100;
    const html = REAL.propsHtml(a.B); REAL.set({ level: 'med' });
    return { v0, vA, vB, html };
  });
  check('battery_internal_resistance_sags_under_load', r.v0 < 8.9 && r.v0 > 8.7, r);
  check('battery_slowly_discharges', r.vB < r.vA - 0.01, r);
  check('battery_props_show_rint_and_discharge', /Ω/.test(r.html) && /%/.test(r.html), r.html);

  // ---------- 4. PSU ripple + noise ----------
  r = await E(() => {
    ONLY('ripple'); const a = LOOP(1000, 'psu'); RUNT(0.05);
    let mn = 1e9, mx = -1e9, prev = null, cr = 0; const t1 = app.t + 0.1;
    while (app.t < t1) { app.simStep(); const v = Math.abs(a.r._m.I) * 1000 - 12; mn = Math.min(mn, v); mx = Math.max(mx, v); if (prev !== null && prev < 0 && v >= 0) cr++; prev = v; }
    const pp1 = mx - mn;
    REAL.set({ rippleMv: 200, rippleHz: 50 }); app.resetSim(); RUNT(0.02); mn = 1e9; mx = -1e9; prev = null; let cr2 = 0; const t2 = app.t + 0.1;
    while (app.t < t2) { app.simStep(); const v = Math.abs(a.r._m.I) * 1000 - 12; mn = Math.min(mn, v); mx = Math.max(mx, v); if (prev !== null && prev < 0 && v >= 0) cr2++; prev = v; }
    const pp2 = mx - mn;
    ONLY('noise'); app.resetSim(); RUNT(0.01); const s = new Set(); for (let i = 0; i < 50; i++) { app.simStep(); s.add(Math.round(Math.abs(a.r._m.I) * 1e9)); }
    OFF(); app.resetSim(); RUNT(0.01); const s0 = new Set(); for (let i = 0; i < 50; i++) { app.simStep(); s0.add(Math.abs(a.r._m.I)); }
    return { pp1, cr, pp2, cr2, noisy: s.size, ideal: s0.size };
  });
  check('psu_ripple_50mV_at_100Hz', Math.abs(r.pp1 - 0.1) < 0.01 && Math.abs(r.cr - 10) <= 1, r);
  check('psu_ripple_configurable_200mV_50Hz', Math.abs(r.pp2 - 0.4) < 0.03 && Math.abs(r.cr2 - 5) <= 1, r);
  check('source_noise_only_when_on', r.noisy > 20 && r.ideal === 1, r);

  // ---------- 5. ADC jitter ----------
  r = await E(() => {
    const go = () => { app.loadExample('ardpwm'); app.running = false; app.resetSim(); RUNT(0.1); const A = app.comps.find((c) => c.type === 'arduino'), rt = A.state.rt; const s = []; for (let i = 0; i < 200; i++) s.push(rt.ar(14)); return s; };
    OFF(); const s0 = go(); ONLY('adc'); const s1 = go(); OFF();
    const mean = (s) => s.reduce((a, b) => a + b, 0) / s.length;
    return { u0: new Set(s0).size, u1: new Set(s1).size, m0: mean(s0), m1: mean(s1), mx: Math.max(...s1.map((v) => Math.abs(v - s0[0]))) };
  });
  check('adc_jitter_few_lsb_around_true_value', r.u0 === 1 && r.u1 >= 3 && Math.abs(r.m1 - r.m0) < 0.5 && r.mx <= 5, r);

  // ---------- 6. drift ----------
  r = await E(() => {
    ONLY('drift'); const G = CLEAR(); const P = app.addComp('psu', 300, 400, 0, { V: 12, I: 3 }), R = app.addComp('resistor', 500, 300, 0, { R: 100 });
    W(P, 1, R, 0); W(R, 1, G, 0); W(P, 0, G, 0); app.changed(); app.resetSim(); RUNT(0.02); const i0 = Math.abs(R._m.I);
    RUNT(4); const i1 = Math.abs(R._m.I), T = R.state._rT;
    const html = REAL.propsHtml(R); return { i0, i1, T, html };
  });
  check('self_heating_raises_temperature_and_drifts_R', r.T > 100 && r.i1 < r.i0 * 0.99 && r.i1 > r.i0 * 0.9, r);
  check('props_show_temperature', /°C/.test(r.html), r.html);

  // ---------- 7. wire resistance ----------
  r = await E(() => {
    ONLY('wire'); const a = LOOP(1); RUNT(0.01); app.computeWireCurrents(); const i = Math.abs(a.r._m.I), wi = app.wires.map((w) => Math.abs(w._i || 0));
    OFF(); app.resetSim(); RUNT(0.01); const i0 = Math.abs(a.r._m.I), cleared = app.wires.every((w) => !w._rp);
    return { i, i0, wi, cleared };
  });
  check('wire_resistance_drops_current', Math.abs(r.i0 - 9) < 1e-6 && r.i < 8.9 && r.i > 7, r);
  check('wire_current_still_reported', r.wi.every((x) => Math.abs(x - r.i) < 1e-6), r);
  check('wire_resistors_removed_when_off', r.cleared, r);

  // ---------- 8. bounce ----------
  r = await E(() => {
    const go = () => {
      app.loadExample('realbounce'); app.running = false; app.resetSim(); RUNT(0.2);
      const S = app.comps.find((c) => c.type === 'button'), A = app.comps.find((c) => c.type === 'arduino');
      for (let k = 0; k < 3; k++) { S.state.pressed = true; app.dirty = true; RUNT(0.08); S.state.pressed = false; app.dirty = true; RUNT(0.08); }
      const m = A.state.ser.match(/count = (\d+)/g) || []; return m.length ? +m[m.length - 1].split('= ')[1] : 0;
    };
    OFF(); const n0 = go(); ONLY('bounce'); const n1 = go();
    // raw edges on the pin during one press
    app.resetSim(); RUNT(0.05); const S = app.comps.find((c) => c.type === 'button'); S.state.pressed = true; app.dirty = true;
    let edges = 0, prev = null; const t1 = app.t + 0.02; while (app.t < t1) { app.simStep(); const cur = !!(S.state._rb ? S.state._rb.cur : S.state.pressed); if (prev !== null && cur !== prev) edges++; prev = cur; }
    OFF(); return { n0, n1, edges };
  });
  check('ideal_button_counts_exactly_3', r.n0 === 3, r);
  check('bounce_counts_extra_presses', r.n1 > 3, r);
  check('bounce_makes_multiple_contact_edges', r.edges >= 3, r);

  // ---------- 9. sensor noise ----------
  r = await E(() => {
    const G = CLEAR(); const s = app.addComp('lm35', 400, 400, 0, {}); app.changed(); app.resetSim();
    const read = () => { const v = []; for (let i = 0; i < 30; i++) { app.t += 0.021; v.push(SENS.now(s, 'q')); } return v; };
    OFF(); const v0 = read(); ONLY('sensor'); const v1 = read(); REAL.set({ level: 'high' }); const v2 = read(); OFF();
    const sd = (v) => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); };
    return { u0: new Set(v0).size, sd1: sd(v1), sd2: sd(v2), q: s.props.q };
  });
  check('sensor_noise_only_when_on_and_scales', r.u0 === 1 && r.sd1 > 0.1 && r.sd2 > r.sd1 * 1.5 && r.sd1 < 3, r);

  // ---------- 10. meter flicker ----------
  r = await E(() => {
    const go = () => { const G = CLEAR(); const B = app.addComp('battery', 300, 400, 0, { V: 9 }), M = app.addComp('voltmeter', 600, 400, 0, {}); W(B, 1, M, 1); W(B, 0, M, 0); W(B, 0, G, 0); app.changed(); app.resetSim(); const s = new Set(); for (let i = 0; i < 15; i++) { RUNT(0.31); s.add(M._m.reading); } return [...s]; };
    OFF(); const a = go(); ONLY('meter'); const b = go(); OFF(); return { a, b };
  });
  check('meter_last_digit_flicker', r.a.length === 1 && r.b.length >= 2 && r.b.every((v) => Math.abs(v - 9) <= 0.0201), r);

  // ---------- 11. scope noise + realrc example ----------
  r = await E(() => {
    const go = () => { app.loadExample('realrc'); app.running = false; app.resetSim(); const bad = RUNT(0.8); const O = app.comps.find((c) => c.type === 'scope'), st = O.state; const v = []; for (let i = 0; i < Math.min(st.count, 200); i++) v.push(st.b2[(st.head - 1 - i + st.b2.length) % st.b2.length]); return { bad, pp: Math.max(...v) - Math.min(...v), po: app.findPassOvers().length, n: v.length }; };
    OFF(); const a = go(); ONLY('scope'); const b = go(); ONLY('ripple'); const c = go(); ALL(); const d = go(); OFF();
    return { a, b, c, d };
  });
  check('realrc_converges_no_passovers', r.a.bad === 0 && r.a.po === 0 && r.d.bad === 0 && r.a.n > 50, r);
  check('scope_trace_flat_when_off', r.a.pp < 0.005, r.a);
  check('scope_trace_noise_when_on', r.b.pp > 0.002 && r.b.pp > r.a.pp * 2, r.b);
  check('realrc_ripple_visible_and_filtered_on_ch2', r.c.pp > 0.002 && r.c.pp < 0.1, r.c);

  // ---------- 12. all examples converge with real mode on ----------
  r = await E(() => {
    ALL(); const bad = []; for (const ex of EXAMPLES.filter((e, i) => i % 6 === 0 || /^real/.test(e.id))) { app.loadExample(ex.id); app.running = false; app.resetSim(); const b = RUNT(0.05); if (b > 3) bad.push(ex.id + ':' + b); }
    OFF(); return bad;
  });
  check('examples_converge_with_real_mode_on', r.length === 0, r);

  // ---------- 13. UI: toggle, popover, persistence ----------
  await E(() => { OFF(); REAL.set({ level: 'med' }); });
  await page.click('#btn-real'); await page.waitForTimeout(150);
  r = await E(() => ({ on: REAL.S.on, cls: document.getElementById('btn-real').classList.contains('on'), ls: JSON.parse(localStorage.getItem('dcl.real') || '{}').on, toast: document.body.textContent.includes('现实模拟已开启') }));
  check('toolbar_toggle_turns_on_and_persists', r.on && r.cls && r.ls === true, r);
  await page.click('#btn-real-set'); await page.waitForTimeout(150);
  r = await E(() => { const p = document.getElementById('real-pop'); return p && { vis: !p.hidden && p.getBoundingClientRect().width > 200, fx: p.querySelectorAll('[data-fx]').length, lv: p.querySelector('#real-level').value, on: p.querySelector('#real-on').checked }; });
  check('settings_popover_lists_11_effects_and_level', r && r.vis && r.fx === 11 && r.lv === 'med' && r.on, r);
  await page.selectOption('#real-level', 'high'); await page.uncheck('#real-pop [data-fx="bounce"]'); await page.fill('#real-rmv', '120'); await page.dispatchEvent('#real-rmv', 'change'); await page.selectOption('#real-rhz', '120');
  r = await E(() => ({ S: JSON.parse(JSON.stringify(REAL.S)) }));
  check('popover_changes_settings', r.S.level === 'high' && !r.S.fx.bounce && r.S.rippleMv === 120 && r.S.rippleHz === 120, r);
  await page.mouse.click(700, 500); await page.waitForTimeout(100);
  check('popover_closes_on_outside_click', await E(() => document.getElementById('real-pop').hidden), null);
  await page.reload(); await page.waitForTimeout(400);
  r = await E(() => ({ on: REAL.S.on, lv: REAL.S.level, b: REAL.S.fx.bounce, mv: REAL.S.rippleMv, cls: document.getElementById('btn-real').classList.contains('on') }));
  check('settings_restored_from_localStorage', r.on && r.lv === 'high' && r.b === false && r.mv === 120 && r.cls, r);
  await E(() => { localStorage.removeItem('dcl.real'); });

  // ---------- 14. locales ----------
  const keys = await E((L) => {
    const K = ['real.btn', 'real.settings', 'real.level', 'real.lv.low', 'real.lv.med', 'real.lv.high', 'real.reroll', 'real.nominal', 'real.actual', 'real.temp', 'real.rint', 'real.discharge', 'real.ripple_mv', 'real.ripple_hz', 'real.on_toast', 'real.off_toast', 'real.title', 'ex.realrc', 'ex.realbounce'].concat(REAL.FX.map((f) => 'real.fx.' + f));
    const out = {}; for (const l of L) { I18N.set(l); out[l] = K.map((k) => I18N.t(k)); } I18N.set('zh-CN'); return out;
  }, LANGS);
  const bad = []; for (const l of LANGS) keys[l].forEach((v, i) => { if (!v || /^(real|ex)\./.test(v) || (l !== 'en' && !/^zh/.test(l) && v === keys.en[i])) bad.push(l + ':' + i + ':' + v); });
  check('locale_keys_present_in_10_languages', bad.length === 0 && new Set(LANGS.map((l) => keys[l][0])).size >= 9, bad);
  check('docs_file_exists', require('fs').existsSync(__dirname + '/../docs/realistic-mode.md'), null);

  check('no_page_errors', errors.length === 0, errors);
  await browser.close();
  console.log(fails.length ? 'FAILED ' + fails.length + ' of ' + (npass + fails.length) + ': ' + fails.join(', ') : 'ALL ' + npass + ' CHECKS PASSED');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
