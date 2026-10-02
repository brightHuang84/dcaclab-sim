// v4 tests: multimeter / meters measure with the simulation stopped, paused or unpowered (static solve)
const { chromium } = require('playwright-core');
const results = {}; const fails = []; const report = {};
const check = (name, cond, info) => { results[name] = { pass: !!cond, info }; if (!cond) fails.push(name); };
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, locale: 'zh-CN' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8765/index.html');
  await page.waitForTimeout(500);
  if (process.env.SPARSE) await page.evaluate(() => { MNA.forceSparse = true; });
  await page.evaluate(() => {
    window.W = (a, b) => app.addWire(a[0], a[1], b[0], b[1], 0);
    window.T = (c, i) => app.termPos(c, i);
    window.fresh = () => { app.clearAll(); app.pause(); app.resetSim(); };
    // meter at (0,0); COM -> a, VΩ -> b
    window.MM = (mode, a, b) => { const M = app.addComp('multimeter', -300, -200, 0, { mode }); if (a) W(T(M, 0), a); if (b) W(T(M, 1), b); return M; };
    window.RD = (M) => { app.staticUpdate(true); const t = meterText(M); return { txt: t.txt, unit: t.unit, val: M._s && M._s.reading, warn: !!(M._s && M._s.warn), beep: meterBeep(M), running: app.running, hasRun: app.hasRun }; };
  });

  let r = await page.evaluate(() => {
    const o = {};
    // loose 470 Ω resistor, sim never started
    fresh(); let R = app.addComp('resistor', 0, 0, 0, { R: 470 }); let M = MM('OHM', T(R, 0), T(R, 1));
    o.r470 = RD(M);
    // two 1 kΩ in parallel
    fresh(); const R1 = app.addComp('resistor', 0, 0, 0, { R: 1000 }), R2 = app.addComp('resistor', 0, 80, 0, { R: 1000 });
    W(T(R1, 0), T(R2, 0)); W(T(R1, 1), T(R2, 1)); M = MM('OHM', T(R1, 0), T(R1, 1)); o.par = RD(M);
    // series 1k + 2.2k
    fresh(); const S1 = app.addComp('resistor', 0, 0, 0, { R: 1000 }), S2 = app.addComp('resistor', 200, 0, 0, { R: 2200 });
    W(T(S1, 1), T(S2, 0)); M = MM('OHM', T(S1, 0), T(S2, 1)); o.ser = RD(M);
    // open: probes not connected / connected to one end only
    fresh(); M = MM('OHM'); o.openNone = RD(M);
    fresh(); R = app.addComp('resistor', 0, 0, 0, { R: 470 }); M = MM('OHM', T(R, 0), null); o.openOne = RD(M);
    // short: a wire
    fresh(); M = MM('OHM'); W(T(M, 0), T(M, 1)); o.short = RD(M);
    // capacitor, inductor, bulb, open switch
    fresh(); let X = app.addComp('capacitor', 0, 0, 0, { C: 100e-6 }); M = MM('OHM', T(X, 0), T(X, 1)); o.cap = RD(M);
    fresh(); X = app.addComp('inductor', 0, 0, 0); M = MM('OHM', T(X, 0), T(X, 1)); o.ind = RD(M); o.indR = X.props.R;
    fresh(); X = app.addComp('bulb', 0, 0, 0); M = MM('OHM', T(X, 0), T(X, 1)); o.bulb = RD(M);
    fresh(); X = app.addComp('switch', 0, 0, 0, { closed: false }); M = MM('OHM', T(X, 0), T(X, 1)); o.swOpen = RD(M);
    X.props.closed = true; app.dirty = true; app.changed(); o.swClosed = RD(M);
    // continuity
    fresh(); M = MM('CONT'); W(T(M, 0), T(M, 1)); o.contWire = RD(M);
    fresh(); R = app.addComp('resistor', 0, 0, 0, { R: 10 }); M = MM('CONT', T(R, 0), T(R, 1)); o.cont10 = RD(M);
    R.props.R = 100; app.dirty = true; app.changed(); o.cont100 = RD(M);
    R.props.R = 10e3; app.dirty = true; app.changed(); o.cont10k = RD(M);
    fresh(); M = MM('CONT'); o.contOpen = RD(M);
    // diode test: forward (VΩ on anode = term 0) and reverse
    fresh(); let Dd = app.addComp('diode', 0, 0, 0); M = MM('DIODE', T(Dd, 1), T(Dd, 0)); o.dFwd = RD(M);
    fresh(); Dd = app.addComp('diode', 0, 0, 0); M = MM('DIODE', T(Dd, 0), T(Dd, 1)); o.dRev = RD(M);
    o.led = {};
    for (const col of ['red', 'green', 'blue', 'white']) { fresh(); const L = app.addComp('led', 0, 0, 0, { color: col }); M = MM('DIODE', T(L, 1), T(L, 0)); o.led[col] = RD(M).txt; }
    return o;
  });
  report.ohm = r;
  const near = (v, x, tol) => Math.abs(v - x) <= tol;
  check('stopped_sim_state', !r.r470.running && !r.r470.hasRun, r.r470);
  check('ohm_loose_470_reads_470.0', r.r470.txt === '470.0' && r.r470.unit === 'Ω' && !r.r470.warn, r.r470);
  check('ohm_parallel_1k_1k_500', near(r.par.val, 500, 0.01) && r.par.txt === '500.0', r.par);
  check('ohm_series_3.2k', near(r.ser.val, 3200, 0.1) && r.ser.txt === '3.200' && r.ser.unit === 'kΩ', r.ser);
  check('ohm_open_OL', r.openNone.txt === 'OL' && r.openOne.txt === 'OL', [r.openNone, r.openOne]);
  check('ohm_short_0', r.short.txt === '0.000' && r.short.val < 1e-3, r.short);
  check('ohm_capacitor_OL_at_DC', r.cap.txt === 'OL', r.cap);
  check('ohm_inductor_DCR', near(r.ind.val, Math.max(r.indR, 0), 1e-3), [r.ind, r.indR]);
  check('ohm_bulb_cold_resistance', r.bulb.val > 1 && r.bulb.val < 1e4 && r.bulb.txt !== 'OL', r.bulb);
  check('ohm_switch_open_OL_closed_0', r.swOpen.txt === 'OL' && r.swClosed.txt === '0.000', [r.swOpen, r.swClosed]);
  check('continuity_beep_on_wire', r.contWire.beep && r.contWire.txt === '0.000', r.contWire);
  check('continuity_10ohm_beeps_100_not', r.cont10.beep && !r.cont100.beep && r.cont100.txt === '100.0', [r.cont10, r.cont100]);
  check('continuity_open_OL_no_beep', !r.contOpen.beep && r.contOpen.txt === 'OL' && r.cont10k.txt === 'OL', [r.contOpen, r.cont10k]);
  check('diode_forward_~0.65V', r.dFwd.val > 0.6 && r.dFwd.val < 0.7 && r.dFwd.unit === 'V', r.dFwd);
  check('diode_reverse_OL', r.dRev.txt === 'OL', r.dRev);
  check('diode_led_vf_by_color', +r.led.red > 1.4 && +r.led.red < +r.led.green && +r.led.green < +r.led.blue && r.led.white !== 'OL', r.led);

  // voltage / current while paused / stopped
  r = await page.evaluate(() => {
    const o = {};
    fresh(); const B = app.addComp('battery', 0, 0, 0, { V: 9 }); let M = MM('VDC', T(B, 0), T(B, 1));
    o.vStopped = RD(M);
    app.run(); app.advance(0.05); app.pause(); o.vPaused = RD(M); app.resetSim();
    // battery + open switch + 1k: meter across resistor reads 0, across switch reads 9 V
    fresh(); const B2 = app.addComp('battery', 0, 0, 0, { V: 9 }), SW = app.addComp('switch', 200, -100, 0, { closed: false }), R = app.addComp('resistor', 200, 100, 0, { R: 1000 });
    W(T(B2, 1), T(SW, 0)); W(T(SW, 1), T(R, 1)); W(T(R, 0), T(B2, 0));
    M = MM('VDC', T(SW, 1), T(SW, 0)); o.vSwitchOpen = RD(M);
    SW.props.closed = true; app.dirty = true; app.changed(); o.vSwitchClosed = RD(M);
    // current mode (series in the loop via COM & 10A jacks): 9 V / 1 kΩ
    fresh(); const B3 = app.addComp('battery', 0, 0, 0, { V: 9 }), R3 = app.addComp('resistor', 200, 100, 0, { R: 1000 });
    const A = app.addComp('multimeter', -300, -200, 0, { mode: 'ADC' });
    W(T(B3, 1), T(A, 2)); W(T(A, 0), T(R3, 1)); W(T(R3, 0), T(B3, 0)); o.aStopped = RD(A);
    // standalone voltmeter & ammeter
    const VM = app.addComp('voltmeter', 300, -200, 0); W(T(VM, 1), T(R3, 1)); W(T(VM, 0), T(R3, 0));
    app.staticUpdate(true); o.vm = meterText(VM);
    fresh(); const B4 = app.addComp('battery', 0, 0, 0, { V: 6 }), R4 = app.addComp('resistor', 200, 100, 0, { R: 100 }), AM = app.addComp('ammeter', 300, -200, 0);
    W(T(B4, 1), T(AM, 1)); W(T(AM, 0), T(R4, 1)); W(T(R4, 0), T(B4, 0)); app.staticUpdate(true); o.am = meterText(AM);
    // RC: capacitor open at DC op → voltage across C = full battery (stopped)
    fresh(); const B5 = app.addComp('battery', 0, 0, 0, { V: 5 }), R5 = app.addComp('resistor', 200, 100, 0, { R: 1000 }), C5 = app.addComp('capacitor', 200, -100, 0, { C: 1e-3 });
    W(T(B5, 1), T(R5, 1)); W(T(R5, 0), T(C5, 1)); W(T(C5, 0), T(B5, 0)); M = MM('VDC', T(C5, 0), T(C5, 1)); o.rcStopped = RD(M);
    // paused mid-charge → hold value (not DC op)
    app.run(); app.advance(0.2); app.pause(); o.rcPaused = RD(M); o.rcExpect = 5 * (1 - Math.exp(-0.2 / 1)); app.resetSim();
    // ohms on a powered circuit → warning
    fresh(); const B6 = app.addComp('battery', 0, 0, 0, { V: 9 }), R6 = app.addComp('resistor', 200, 100, 0, { R: 1000 });
    W(T(B6, 1), T(R6, 1)); W(T(R6, 0), T(B6, 0)); M = MM('OHM', T(R6, 0), T(R6, 1)); o.ohmPowered = RD(M);
    app.sel = { comp: M }; app.refreshProps(); app.updateReadings(true); o.panel = (document.getElementById('readings') || {}).textContent || '';
    // AC-mode with no AC source reads 0 while stopped
    fresh(); const B7 = app.addComp('battery', 0, 0, 0, { V: 9 }); M = MM('VAC', T(B7, 0), T(B7, 1)); o.vacDC = RD(M);
    return o;
  });
  report.volt = r;
  check('voltage_battery_stopped_9.000', r.vStopped.txt === '9.000' && r.vStopped.unit === 'V' && !r.vStopped.hasRun, r.vStopped);
  check('voltage_battery_paused_9.000', r.vPaused.txt === '9.000' && !r.vPaused.running && r.vPaused.hasRun, r.vPaused);
  check('voltage_across_open_switch', r.vSwitchOpen.txt === '8.999' /* 10 MΩ meter in series with 1 kΩ */ && r.vSwitchClosed.txt === '0.000', [r.vSwitchOpen, r.vSwitchClosed]);
  check('current_mode_stopped_9mA', near(r.aStopped.val, 9e-3, 1e-6), r.aStopped);
  check('voltmeter_standalone_stopped', r.vm.txt === '9.000', r.vm);
  check('ammeter_standalone_stopped_60mA', r.am.txt === '60.00' && r.am.unit === 'mA', r.am);
  check('rc_dc_op_and_paused_hold', near(r.rcStopped.val, 5, 1e-3) && near(r.rcPaused.val, r.rcExpect, 0.03), [r.rcStopped, r.rcPaused, r.rcExpect]);
  check('ohm_powered_circuit_warns', r.ohmPowered.warn && /测量电阻时请断开电源/.test(r.panel), [r.ohmPowered, r.panel]);
  check('vac_without_ac_source_0', r.vacDC.txt === '0.000', r.vacDC);

  // knob cycling, properties-panel select, UI flow via real mouse clicks with the sim stopped
  r = await page.evaluate(() => {
    fresh(); const R = app.addComp('resistor', 0, 0, 0, { R: 470 }); const M = MM('VDC', T(R, 0), T(R, 1));
    const seq = [];
    for (let i = 0; i < 7; i++) { DEFS.multimeter.click(M, app, 0, -2); seq.push(M.props.mode); }
    app.sel = { comp: M }; app.refreshProps();
    const sel = document.querySelector('#props select[data-k="mode"]') || document.querySelector('select[data-k="mode"]');
    const opts = sel ? [...sel.options].map(o => o.value) : [];
    if (sel) { sel.value = 'OHM'; sel.dispatchEvent(new Event('change', { bubbles: true })); sel.dispatchEvent(new Event('input', { bubbles: true })); }
    return { seq, opts, mode: M.props.mode, id: M.id };
  });
  report.knob = r;
  check('knob_cycles_all_7_modes', JSON.stringify(r.seq) === JSON.stringify(['VAC', 'ADC', 'AAC', 'OHM', 'CONT', 'DIODE', 'VDC']), r.seq);
  check('props_select_has_modes', ['OHM', 'CONT', 'DIODE'].every(k => r.opts.includes(k)) && r.mode === 'OHM', r);
  // frame loop recomputes automatically (no explicit staticUpdate): change the resistor value
  await page.waitForTimeout(300);
  const auto1 = await page.evaluate(() => { const M = app.comps.find(c => c.type === 'multimeter'); return meterText(M).txt; });
  await page.evaluate(() => { const R = app.comps.find(c => c.type === 'resistor'); R.props.R = 1000; app.dirty = true; app.changed(); });
  await page.waitForTimeout(300);
  const auto2 = await page.evaluate(() => { const M = app.comps.find(c => c.type === 'multimeter'); return [meterText(M).txt, meterText(M).unit, (document.getElementById('readings') || {}).textContent]; });
  check('auto_recompute_on_edit_in_frame_loop', auto1 === '470.0' && auto2[0] === '1.000' && auto2[1] === 'kΩ', [auto1, auto2]);

  // running: Ω meter on capacitor charges up (live), V meter live; existing example still OK
  r = await page.evaluate(() => {
    fresh(); const C = app.addComp('capacitor', 0, 0, 0, { C: 1e-6 }); const M = MM('OHM', T(C, 0), T(C, 1));
    app.run(); app.advance(0.001); const a = meterShown(M); app.advance(0.01); const b = meterShown(M); app.pause();
    const t = meterText(M).txt; app.resetSim();
    // old save with 'OHM' multimeter still loads
    return { a, b, t };
  });
  report.capCharge = r;
  check('ohm_capacitor_charges_up_while_running', r.a > 100 && r.b > r.a * 5, r);
  check('no_page_errors', errors.length === 0, errors);
  console.log(JSON.stringify(report, null, 1));
  console.log('\n==== RESULTS ====');
  for (const [k, v] of Object.entries(results)) console.log((v.pass ? 'PASS ' : 'FAIL ') + k + (v.pass ? '' : '  ' + JSON.stringify(v.info)));
  console.log(fails.length ? 'FAILED: ' + fails.length : 'ALL ' + Object.keys(results).length + ' PASSED');
  await browser.close();
})();
