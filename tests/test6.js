// v5 tests: DC-DC boost converter module (behavioural averaged model)
const { chromium } = require('playwright-core');
const results = {}; const fails = []; const report = {};
const check = (name, cond, info) => { results[name] = { pass: !!cond, info }; if (!cond) fails.push(name); };
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, locale: 'zh-CN' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8765/index.html?fresh=1');
  await page.waitForTimeout(500);
  if (process.env.SPARSE) await page.evaluate(() => { MNA.forceSparse = true; });
  await page.evaluate(() => {
    window.T = (c, i) => app.termPos(c, i);
    window.W = (a, b) => app.addWire(a[0], a[1], b[0], b[1], 0);
    // battery (V, r) → boost (props) → load resistor RL ; returns parts
    window.mk = (V, r, RL, props) => {
      app.clearAll(); app.pause(); app.resetSim();
      const B = app.addComp('battery', -300, 0, 3, { V, r: r || 0 });
      const U1 = app.addComp('boost', 0, 0, 0, props || {});
      W(T(B, 1), T(U1, 0)); W(T(B, 0), T(U1, 1));
      let R = null; if (RL) { R = app.addComp('resistor', 300, 0, 1, { R: RL }); W(T(U1, 2), T(R, 0)); W(T(U1, 3), T(R, 1)); }
      return { B, U1, R };
    };
    window.runRead = (U1, sec) => {
      app.run(); let bad = 0; const n = Math.round((sec || 0.05) / app.dt);
      for (let i = 0; i < n; i++) { app.simStep(); if (!app.net.converged) bad++; }
      app.pause(); const m = U1._m;
      return { Vin: m.Vin, Iin: m.Iin, Vout: m.Vout, Iout: m.Iout, Pin: m.Pin, Pout: m.Pout, status: DEFS.boost.status(U1), bad, warn: app.warn, hot: !!U1.state.hot };
    };
  });
  const near = (v, x, tol) => Math.abs(v - x) <= tol;
  const r = await page.evaluate(() => {
    const o = {};
    let P = mk(3.7, 0, 1000); o.light = runRead(P.U1);
    P = mk(3.7, 0, 24); o.half = runRead(P.U1);
    P = mk(3.7, 0, 24, { eff: 80 }); o.eff80 = runRead(P.U1);
    P = mk(5, 0, 50, { Vout: 5.5 }); o.v55 = runRead(P.U1);
    P = mk(3.7, 0, 3); o.oc = runRead(P.U1, 0.2);
    o.ocHot = runRead(P.U1, 3.5);
    P = mk(3.7, 0, 3, { Imax: 1 }); o.oc1 = runRead(P.U1, 0.1);
    P = mk(1.5, 0, 100); o.low = runRead(P.U1);
    P = mk(15, 0, 100); o.pass = runRead(P.U1);
    P = mk(3.7, 0.3, 24); o.sag = runRead(P.U1);
    P = mk(3.7, 1.0, 24); o.weak = runRead(P.U1, 0.2);
    P = mk(3.7, 0, null); o.noload = runRead(P.U1);
    // UVLO hysteresis: running at 1.9 V (above Vmin − 0.15) stays on after dropping below 2 V
    P = mk(2.5, 0, 1000); runRead(P.U1); P.B.props.V = 1.9; app.dirty = true; o.hyst = runRead(P.U1);
    P.B.props.V = 1.7; app.dirty = true; o.hystOff = runRead(P.U1);
    return o;
  });
  report.model = r;
  check('vout_setpoint_light_load_0.1%', near(r.light.Vout, 12, 0.012) && r.light.status.startsWith('正常'), r.light);
  check('vout_setpoint_5.5V', near(r.v55.Vout, 5.5, 0.0055), r.v55);
  check('input_current_3.7V_12V_0.5A_eff90_~1.80A', near(r.half.Iin, 12 * 0.5 / 0.9 / 3.7, 0.01) && near(r.half.Iout, 0.5, 0.002), r.half);
  check('pin_equals_pout_over_eff', near(r.half.Pin, r.half.Pout / 0.9, 0.005 * r.half.Pin) && near(r.eff80.Pin, r.eff80.Pout / 0.8, 0.005 * r.eff80.Pin), [r.half, r.eff80]);
  check('overcurrent_limits_and_folds_back', r.oc.Iout <= 2.0 && r.oc.Iout > 0.5 && r.oc.Vout < 6 && /过流/.test(r.oc.status) && r.oc.bad === 0, r.oc);
  check('overcurrent_Imax_1A', r.oc1.Iout <= 1.0 && /过流/.test(r.oc1.status), r.oc1);
  check('overcurrent_thermal_shutdown', r.ocHot.hot && /过热/.test(r.ocHot.status), r.ocHot);
  check('vin_below_min_off', Math.abs(r.low.Vout) < 1e-3 && Math.abs(r.low.Iin) < 1e-6 && /输入过低/.test(r.low.status), r.low);
  check('vin_above_vout_pass_through', near(r.pass.Vout, 15 - 0.4, 0.05) && /直通/.test(r.pass.status) && r.pass.Iin >= r.pass.Iout, r.pass);
  check('weak_battery_sags_still_regulates', near(r.sag.Vin, 3.04, 0.03) && near(r.sag.Vout, 12, 0.012) && near(r.sag.Iin * r.sag.Vin, r.sag.Pout / 0.9, 0.05), r.sag);
  check('too_weak_battery_brownout_converges', /Brown-out|输入过低|输入功率不足/.test(r.weak.status) && r.weak.bad === 0 && r.weak.warn === '', r.weak);
  check('no_load_regulates', near(r.noload.Vout, 12, 0.012) && Math.abs(r.noload.Iin) < 1e-4, r.noload);
  check('uvlo_hysteresis', /正常/.test(r.hyst.status) && /输入过低/.test(r.hystOff.status), [r.hyst, r.hystOff]);

  // multimeter / meters with the simulation stopped (static solve) and paused
  const s = await page.evaluate(() => {
    const o = {};
    const P = mk(3.7, 0, 24);
    const M = app.addComp('multimeter', 0, -300, 0, { mode: 'VDC' }); W(T(M, 1), T(P.U1, 2)); W(T(M, 0), T(P.U1, 3));
    app.staticUpdate(true); o.stopped = [meterText(M).txt, meterText(M).unit, app.hasRun, app.running];
    P.U1.props.Vout = 9; app.dirty = true; app.changed(); app.staticUpdate(true); o.stopped9 = meterText(M).txt;
    P.U1.props.Vout = 12; app.dirty = true; app.run(); app.advance(0.05); app.pause(); app.staticUpdate(true); o.paused = meterText(M).txt;
    P.U1.props.Vout = 5; app.dirty = true; app.changed(); app.staticUpdate(true); o.paused5 = meterText(M).txt;
    // input current with a stopped ammeter
    const Q = mk(3.7, 0, 24); app.wires = app.wires.filter(w => !(w.pts[0][0] === T(Q.B, 1)[0] && w.pts[0][1] === T(Q.B, 1)[1]));
    const A = app.addComp('ammeter', -150, -200); W(T(Q.B, 1), T(A, 1)); W(T(A, 0), T(Q.U1, 0)); app.dirty = true; app.staticUpdate(true); o.ammStopped = [meterText(A).txt, meterText(A).unit];
    // dense vs sparse
    const cmp = {};
    for (const f of [false, true]) { MNA.forceSparse = f; const Z = mk(3.7, 0.2, 30); cmp[f ? 'sparse' : 'dense'] = runRead(Z.U1); }
    MNA.forceSparse = !!window.__sp; o.cmp = cmp;
    return o;
  });
  report.meters = s;
  check('multimeter_reads_vout_stopped', s.stopped[0] === '12.00' && s.stopped[1] === 'V' && !s.stopped[2] && !s.stopped[3], s.stopped);
  check('multimeter_follows_setpoint_stopped', Math.abs(parseFloat(s.stopped9) - 9) <= 0.009, s.stopped9);
  check('multimeter_paused_and_edit', s.paused === '12.00' && Math.abs(parseFloat(s.paused5) - 5) <= 0.005, [s.paused, s.paused5]);
  check('ammeter_input_current_stopped', s.ammStopped[1] === 'A' && Math.abs(parseFloat(s.ammStopped[0]) - 1.80) < 0.01, s.ammStopped);
  check('dense_sparse_agree', Math.abs(s.cmp.dense.Vout - s.cmp.sparse.Vout) < 1e-9 && Math.abs(s.cmp.dense.Iin - s.cmp.sparse.Iin) < 1e-9, s.cmp);

  // UI: properties panel, range check, mouse wheel on the trimmer, example
  await page.evaluate(() => { const P = mk(3.7, 0, 24); app.fitView(); app.sel = { comp: P.U1 }; app.refreshProps(); });
  const inp = page.locator('#props input[data-k="Vout"], input[data-k="Vout"]').first();
  await inp.fill('5'); await inp.press('Enter'); await inp.dispatchEvent('change');
  let ui = await page.evaluate(() => app.comps.find(c => c.type === 'boost').props.Vout);
  await inp.fill('30'); await inp.dispatchEvent('change');
  const ui30 = await page.evaluate(() => app.comps.find(c => c.type === 'boost').props.Vout);
  const pt = await page.evaluate(() => { const U1 = app.comps.find(c => c.type === 'boost'); const r = document.getElementById('cv').getBoundingClientRect(); const v = app.view; return [r.x + (U1.x + 26) * v.s + v.ox, r.y + (U1.y + 3) * v.s + v.oy]; });
  await page.mouse.move(pt[0], pt[1]);
  for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(30); }
  const wheel = await page.evaluate(() => app.comps.find(c => c.type === 'boost').props.Vout);
  check('props_panel_sets_vout', ui === 5, ui);
  check('props_rejects_out_of_range_vout', ui30 === 5, ui30);
  check('mouse_wheel_trimmer_adjusts_vout', Math.abs(wheel - 5.3) < 1e-9, wheel);
  const ex = await page.evaluate(() => {
    app.loadExample('boost'); app.pause(); let bad = 0; app.run(); for (let i = 0; i < 1000; i++) { app.simStep(); if (!app.net.converged) bad++; } app.pause();
    const U1 = app.comps.find(c => c.type === 'boost');
    return { r: DEFS.boost.readings(U1), meters: app.meterComps().map(c => meterText(c).txt + ' ' + meterText(c).unit), bad, warn: app.warn, inPalette: !!document.querySelector('[data-type="boost"]') || document.body.innerHTML.includes('升压模块'), cat: CATEGORIES.map(c => c[0]) };
  });
  report.example = ex;
  check('example_boost_runs_12V', ex.bad === 0 && ex.warn === '' && ex.meters.includes('12.00 V') && ex.r.find(x => x[0] === '状态')[1].startsWith('正常'), ex);
  check('palette_modules_category', ex.inPalette && ex.cat.includes('module'), ex.cat);
  check('no_page_errors', errors.length === 0, errors);
  console.log(JSON.stringify(report, null, 1));
  console.log('\n==== RESULTS ====');
  for (const [k, v] of Object.entries(results)) console.log((v.pass ? 'PASS ' : 'FAIL ') + k + (v.pass ? '' : '  ' + JSON.stringify(v.info)));
  console.log(fails.length ? 'FAILED: ' + fails.length : 'ALL ' + Object.keys(results).length + ' PASSED');
  await browser.close();
})();
