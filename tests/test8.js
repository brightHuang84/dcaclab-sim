// v7 tests: convergence robustness (user regression circuit, fuzz, recovery, warning UI, advanced settings)
//           + new parts: MOV, TVS, PPTC, TL431, LM393, crystal oscillator, buzzers, Hall, reed, phototransistor,
//             relay module, keypad, LCD1602, L298N
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const results = {}; const fails = []; const report = {};
const check = (name, cond, info) => { results[name] = { pass: !!cond, info }; if (!cond) fails.push(name); };
const near = (v, x, tol) => Math.abs(v - x) <= tol;
const USER = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'user-7805-supply.json'), 'utf8'));
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
    window.A = (t, x, y, r, p) => app.addComp(t, x, y, r || 0, p || {});
    window.NEW = () => { app.clearAll(); app.pause(); app.resetSim(); window.TOASTS = []; };
    const t0 = app.toast.bind(app); app.toast = (s) => { (window.TOASTS = window.TOASTS || []).push(s); t0(s); };
    window.RUN = (sec) => { app.run(); let bad = 0; const n = Math.round(sec / app.dt); for (let i = 0; i < n; i++) { app.simStep(); if (!app.net.converged) bad++; } app.pause(); return bad; };
    window.RD = (c) => Object.fromEntries((DEFS[c.type].readings ? DEFS[c.type].readings(c) : []).map(([k, v]) => [k, String(v)]));
    window.DEF = () => { Object.assign(SIMOPT, SIMOPT_DEFAULTS); };
    // net-style builder: hub points far away; every terminal is wired to its hub
    window.NET = () => {
      let k = 0; const hubs = [];
      const hub = (i) => { while (hubs.length <= i) { const j = hubs.length; hubs.push([3000 + j * 260 + 7 * (j % 3) * 20, -3000 - j * 180 - 40 * (j % 2)]); } return hubs[i]; };
      const add = (type, nodes, props) => { const i = k++; const c = A(type, (i % 6) * 420, Math.floor(i / 6) * 420, 0, props); nodes.forEach((nd, t) => { if (nd === null || nd === undefined) return; const p = T(c, t), h = hub(nd); W(p, h); }); return c; };
      const gnd = (nd) => { const h = hub(nd); const g = A('ground', h[0] + 100, h[1] + 200, 0); W(T(g, 0), h); };
      return { add, gnd };
    };
  });

  // ======================= convergence =======================
  const conv = await page.evaluate((U0) => {
    const o = {}; DEF();
    const load = () => { app.load(JSON.parse(JSON.stringify(U0))); app.pause(); app.resetSim(); };
    load(); o.bad = RUN(0.5); const st = app.net.stats;
    const U1 = app.comps.find(c => c.type === 'reg78xx'), L = app.comps.find(c => c.type === 'led'), F = app.comps.find(c => c.type === 'fuse'), C = app.comps.find(c => c.type === 'capacitor');
    o.reg = { Vin: U1._m.Vin, Vout: U1._m.Vout, Iout: U1._m.Iout, status: RD(U1)['状态'] }; o.led = L._m.I; o.blown = !!F.state.blown; o.cap = C._m.V; o.stats = Object.assign({}, st); o.conv = app.conv; o.warn = app.warn;
    o.kind = app.net.lin.kind;
    // ripple on the reservoir capacitor over the last 40 ms
    let mn = 1e9, mx = -1e9; app.run(); for (let i = 0; i < 200; i++) { app.simStep(); mn = Math.min(mn, C._m.V); mx = Math.max(mx, C._m.V); } app.pause(); o.ripple = mx - mn;
    // the same circuit with the old v6 tolerance (1e-6) still converges thanks to the KCL-residual test
    load(); SIMOPT.reltol = 1e-6; o.badStrict = RUN(0.2); DEF();
    // and with only the tolerance fix (no residual test, no automatic remedies)
    load(); SIMOPT.kclCheck = false; SIMOPT.autoStep = false; SIMOPT.homotopy = false; o.badTolOnly = RUN(0.2); DEF();
    // v6 settings (strict tolerance, no remedies) reproduce the failure
    load(); SIMOPT.reltol = 1e-6; SIMOPT.kclCheck = false; SIMOPT.autoStep = false; SIMOPT.homotopy = false; o.badV6 = RUN(0.2); DEF();
    // automatic recovery: starve Newton (6 iterations) – time-step cutting / gmin stepping must still give clean steps
    load(); SIMOPT.maxIter = 6; o.badStarved = RUN(0.1); o.starvedStats = Object.assign({}, app.net.stats); DEF();
    return o;
  }, USER);
  report.conv = conv;
  check('user_circuit_runs_clean_0_nonconverged', conv.bad === 0 && conv.stats.fail === 0 && !conv.conv && conv.warn === '', [conv.bad, conv.stats, conv.warn]);
  check('user_circuit_7805_regulates_5V', near(conv.reg.Vout, 5.0, 0.02) && conv.reg.Vin > 7.5 && conv.reg.Vin < 9 && /稳压/.test(conv.reg.status), conv.reg);
  check('user_circuit_led_20mA_fuse_ok', near(conv.led, 0.02, 0.0015) && !conv.blown, [conv.led, conv.blown]);
  check('user_circuit_bulk_cap_ripple_sane', conv.ripple > 0.05 && conv.ripple < 1.5 && conv.cap > 7.5, [conv.cap, conv.ripple]);
  check('user_circuit_v6_settings_reproduce_failure', conv.badV6 > (process.env.SPARSE ? 0 : 10), conv.badV6);
  check('user_circuit_fixed_by_kcl_residual_alone', conv.badStrict === 0, conv.badStrict);
  check('user_circuit_mostly_fixed_by_tolerance_alone', conv.badTolOnly <= 2, conv.badTolOnly);
  check('starved_newton_recovers_automatically', conv.badStarved === 0 && (conv.starvedStats.cut + conv.starvedStats.gmin + conv.starvedStats.src) > 0, [conv.badStarved, conv.starvedStats]);

  const ui = await page.evaluate(() => {
    const o = {}; DEF();
    NEW(); app.loadExample('npn'); app.pause(); app.resetSim(); window.TOASTS = [];
    SIMOPT.maxIter = 2; SIMOPT.autoStep = false; SIMOPT.homotopy = false; SIMOPT.kclCheck = false; app.dirty = true;
    o.bad = RUN(0.01); o.n = app.conv && app.conv.n; o.comps = app.conv ? app.conv.comps.map(c => c.type) : [];
    o.toast = (window.TOASTS || []).filter(s => /收敛困难/.test(s)); app.updateHud(); o.hud = document.getElementById('hud').textContent;
    app.render(); o.drawn = true; DEF(); app.dirty = true;
    o.badAfter = RUN(0.01);
    // advanced settings panel
    app.sel = null; app.refreshProps(); const adv = document.querySelector('details.adv'); o.hasAdv = !!adv;
    const inp = document.querySelector('input.simopt[data-k="maxIter"]'); inp.value = '250'; inp.onchange(); o.maxIter = SIMOPT.maxIter;
    o.saved = localStorage.getItem('dcaclab-simopt');
    const bad = document.querySelector('input.simopt[data-k="reltol"]'); bad.value = '5'; bad.onchange(); o.reltolKept = SIMOPT.reltol;
    const cb = document.querySelector('input.simopt[data-k="autoStep"]'); cb.checked = false; cb.onchange(); o.auto = SIMOPT.autoStep;
    document.getElementById('simopt-reset').onclick(); o.reset = JSON.stringify(SIMOPT) === JSON.stringify(SIMOPT_DEFAULTS); o.savedAfter = localStorage.getItem('dcaclab-simopt');
    o.fields = [...document.querySelectorAll('input.simopt')].map(i => i.dataset.k);
    return o;
  });
  report.ui = ui;
  check('nonconvergence_warning_friendly_toast_and_highlight', ui.bad > 0 && ui.n > 0 && ui.toast.length === 1 && ui.comps.length > 0 && ui.comps.every(t => t !== 'resistor') && /收敛困难/.test(ui.hud), ui);
  check('defaults_restore_clean_run', ui.badAfter === 0, ui.badAfter);
  check('advanced_settings_panel', ui.hasAdv && ui.maxIter === 250 && /250/.test(ui.saved || '') && ui.reltolKept === 1e-4 && ui.auto === false && ui.reset && !ui.savedAfter &&
    ['maxIter', 'reltol', 'vntol', 'abstol', 'gmin', 'autoStep', 'minStep', 'homotopy'].every(k => ui.fields.includes(k)), ui);

  // fuzz harness (separate process, fresh page): random rectifier supplies, random non-linear graphs, switching loads
  let fz = '';
  try { fz = execSync('node ' + path.join(__dirname, 'fuzz.js') + ' 150 11' + (process.env.SPARSE ? '' : ''), { env: Object.assign({}, process.env), encoding: 'utf8', timeout: 240000 }); } catch (e) { fz = String(e.stdout || e.message); }
  const m = /SUMMARY circuits=(\d+) steps=(\d+) nonconverged_steps=(\d+) circuits_with_failures=(\d+) nan=(\d+)/.exec(fz) || [];
  report.fuzz = m[0];
  check('fuzz_150_random_circuits_converge', +m[1] > 150 && +m[3] <= 2 && +m[5] === 0, m[0] || fz.slice(-400));

  // ======================= protection =======================
  const prot = await page.evaluate(() => {
    const o = {}; let b;
    const ser = (V, R, type, props) => { NEW(); b = NET(); b.gnd(0); b.add('battery', [0, 1], { V, r: 0 }); b.add('resistor', [1, 2], { R }); return b.add(type, [2, 0], props); };
    let M = ser(300, 1000, 'mov', { part: '14D471K' }); DEFS.mov.onProp(M, 'part'); app.dirty = true; RUN(0.02); o.movStandby = { V: M._m.V, I: M._m.I };
    M = ser(1000, 10, 'mov', { part: '14D471K' }); DEFS.mov.onProp(M, 'part'); app.dirty = true; RUN(0.0004); o.movClamp = { V: M._m.V, I: M._m.I, st: RD(M)['状态'] };
    o.movBadSurge = RUN(0.05); o.movBurnt = { burnt: !!M.state.burnt, V: M._m.V, toast: (TOASTS || []).some(s => /压敏/.test(s)) };
    M = ser(12, 100, 'mov', { part: '07D220K' }); DEFS.mov.onProp(M, 'part'); app.dirty = true; RUN(0.02); o.mov22 = { V: M._m.V, I: M._m.I };
    M = ser(60, 10, 'mov', { part: '07D220K' }); DEFS.mov.onProp(M, 'part'); app.dirty = true; RUN(0.0004); o.mov22c = { V: M._m.V, I: M._m.I };
    M = ser(-60, 10, 'mov', { part: '07D220K' }); DEFS.mov.onProp(M, 'part'); app.dirty = true; RUN(0.0004); o.mov22n = { V: M._m.V };
    // TVS: anode at ground, cathode at the + rail (reverse) → clamps; forward → ~0.8 V
    const tvs = (V, R, part) => { NEW(); b = NET(); b.gnd(0); b.add('battery', [0, 1], { V, r: 0 }); b.add('resistor', [1, 2], { R }); const D = b.add('tvs', [0, 2], { part }); DEFS.tvs.onProp(D, 'part'); app.dirty = true; return D; };
    let D = tvs(5, 100, 'SMBJ5.0A'); RUN(0.01); o.tvsStandby = { V: -D._m.V, I: D._m.I };
    D = tvs(30, 1, 'SMBJ5.0A'); RUN(0.0004); o.tvsClamp = { V: -D._m.V, I: -D._m.I, st: RD(D)['状态'] };
    D = tvs(-5, 100, 'SMBJ5.0A'); RUN(0.01); o.tvsFwd = { V: D._m.V };
    D = tvs(30, 1, 'SMBJ5.0CA'); RUN(0.0004); const p1 = -D._m.V; D = tvs(-30, 1, 'SMBJ5.0CA'); RUN(0.0004); o.tvsBi = [p1, D._m.V];
    // PPTC MF-R050 (0.5 A hold / 1 A trip)
    const pt = (R) => { NEW(); b = NET(); b.gnd(0); b.add('battery', [0, 1], { V: 5, r: 0 }); const F = b.add('pptc', [1, 2], { part: 'MF-R050' }); DEFS.pptc.onProp(F, 'part'); const L = b.add('resistor', [2, 0], { R }); app.dirty = true; return { F, L }; };
    const odt = app.dt; app.dt = 1e-3;
    let P = pt(12); RUN(5); o.pptcHold = { I: P.F._m.I, T: P.F.state.T, st: RD(P.F)['状态'] };
    P = pt(2.5); RUN(0.2); const I0 = P.F._m.I; RUN(4.8); o.pptcTrip = { I0, I: P.F._m.I, T: P.F.state.T, st: RD(P.F)['状态'], trips: P.F.state.trips };
    P.L.props.R = 1e7; app.dirty = true; RUN(60); P.L.props.R = 12; app.dirty = true; RUN(0.5); o.pptcReset = { I: P.F._m.I, T: P.F.state.T };
    app.dt = odt; app.dirty = true;
    return o;
  });
  report.prot = prot;
  check('mov_standby_high_impedance', near(prot.movStandby.V, 300, 1) && Math.abs(prot.movStandby.I) < 1e-3, prot.movStandby);
  check('mov_clamps_surge_14D471K', prot.movClamp.V > 600 && prot.movClamp.V < 800 && prot.movClamp.I > 20 && /钳位/.test(prot.movClamp.st), prot.movClamp);
  check('mov_overenergy_fails_short', prot.movBurnt.burnt && Math.abs(prot.movBurnt.V) < 60 && prot.movBurnt.toast && prot.movBadSurge === 0, [prot.movBurnt, prot.movBadSurge]);
  check('mov_07D220K_leak_and_clamp', Math.abs(prot.mov22.I) < 2e-4 && near(prot.mov22.V, 12, 0.05) && prot.mov22c.V > 30 && prot.mov22c.V < 48 && near(prot.mov22n.V, -prot.mov22c.V, 0.01), [prot.mov22, prot.mov22c, prot.mov22n]);
  check('tvs_standby_5V', near(prot.tvsStandby.V, 5, 0.1) && Math.abs(prot.tvsStandby.I) < 1e-3, prot.tvsStandby);
  check('tvs_clamps_between_Vbr_and_Vc', prot.tvsClamp.V > 6.4 && prot.tvsClamp.V < 9.3 && prot.tvsClamp.I > 15 && /钳位/.test(prot.tvsClamp.st), prot.tvsClamp);
  check('tvs_forward_diode', prot.tvsFwd.V > 0.6 && prot.tvsFwd.V < 1.1, prot.tvsFwd);
  check('tvs_bidirectional_symmetric', prot.tvsBi[0] > 6.4 && prot.tvsBi[0] < 9.3 && near(prot.tvsBi[0], prot.tvsBi[1], 0.01), prot.tvsBi);
  check('pptc_holds_below_Ihold', prot.pptcHold.I > 0.38 && /正常|发热/.test(prot.pptcHold.st), prot.pptcHold);
  check('pptc_trips_above_Itrip', prot.pptcTrip.I0 > 1.5 && prot.pptcTrip.I < 0.1 && /已动作/.test(prot.pptcTrip.st) && prot.pptcTrip.trips === 1, prot.pptcTrip);
  check('pptc_resets_after_cooling', prot.pptcReset.I > 0.38 && prot.pptcReset.T < 60, prot.pptcReset);

  // ======================= ICs =======================
  const ics = await page.evaluate(() => {
    const o = {}; let b;
    const tl = (Vin, R1, R2) => { NEW(); b = NET(); b.gnd(0); b.add('battery', [0, 1], { V: Vin, r: 0 }); b.add('resistor', [1, 2], { R: 1000 }); const U1 = b.add('tl431', [3, 0, 2]); if (R1) { b.add('resistor', [2, 3], { R: R1 }); b.add('resistor', [3, 0], { R: R2 }); } else b.add('resistor', [2, 3], { R: 1e-3 }); return U1; };
    let U1 = tl(12, 10e3, 10e3); o.tl5 = { bad: RUN(0.01), V: U1._m.Vka, I: U1._m.Ika, st: RD(U1)['状态'] };
    U1 = tl(9, 10e3, 10e3); RUN(0.01); o.tl5lo = U1._m.Vka; U1 = tl(15, 10e3, 10e3); RUN(0.01); o.tl5hi = U1._m.Vka;
    U1 = tl(12, 0, 0); RUN(0.01); o.tlRef = U1._m.Vka;
    U1 = tl(2, 10e3, 10e3); RUN(0.01); o.tlOff = { V: U1._m.Vka, st: RD(U1)['状态'] };
    // LM393: IN+ = 2.5 V reference, IN− from a battery; 10 k pull-up on both outputs
    const cmp = (vm, vmb) => { NEW(); b = NET(); b.gnd(0); b.add('battery', [0, 1], { V: 5, r: 0 }); b.add('resistor', [1, 2], { R: 10e3 }); b.add('resistor', [2, 0], { R: 10e3 });
      b.add('battery', [0, 3], { V: vm, r: 0 }); b.add('battery', [0, 6], { V: vmb, r: 0 }); const C = b.add('lm393', [4, 3, 2, 0, 2, 6, 5, 1]); b.add('resistor', [1, 4], { R: 10e3 }); b.add('resistor', [1, 5], { R: 10e3 }); return C; };
    let C = cmp(3, 2); o.cmpBad = RUN(0.01); o.cmp1 = [C._m.oa, C._m.ob];
    C = cmp(2, 3); RUN(0.01); o.cmp2 = [C._m.oa, C._m.ob];
    C = cmp(2.51, 2.49); RUN(0.01); o.cmp3 = [C._m.oa, C._m.ob];
    // crystal oscillator module
    const osc = (f) => { NEW(); b = NET(); b.gnd(0); b.add('battery', [0, 1], { V: 5, r: 0 }); const X = b.add('xosc', [1, 0, 2], { f }); b.add('resistor', [2, 0], { R: 10e3 }); return X; };
    let X = osc(100); app.run(); let edges = 0, prev = 0, hi = 0, n = 0; for (let i = 0; i < 1000; i++) { app.simStep(); const v = X._m.Vo; if (v > 2.5 && prev <= 2.5) edges++; prev = v; hi = Math.max(hi, v); n++; } app.pause(); o.osc100 = { edges, hi, f: edges / (1000 * app.dt) };
    X = osc(16e6); RUN(0.01); o.osc16M = { Vo: X._m.Vo, note: RD(X)['说明'] };
    X = osc(100); X.props.f = 100; app.dirty = true; const B = app.comps.find(c => c.type === 'battery'); B.props.V = 1.5; RUN(0.05); o.oscLowV = X._m.Vo;
    return o;
  });
  report.ics = ics;
  check('tl431_shunt_regulator_5V', ics.tl5.bad === 0 && near(ics.tl5.V, 4.99, 0.03) && ics.tl5.I > 0.005 && /稳压/.test(ics.tl5.st), ics.tl5);
  check('tl431_line_regulation', Math.abs(ics.tl5hi - ics.tl5lo) < 0.02, [ics.tl5lo, ics.tl5hi]);
  check('tl431_ref_tied_2V495', near(ics.tlRef, 2.495, 0.01), ics.tlRef);
  check('tl431_below_vref_off', ics.tlOff.V > 1.9 && /截止|过小/.test(ics.tlOff.st), ics.tlOff);
  check('lm393_open_collector_compare', ics.cmpBad === 0 && ics.cmp1[0] < 0.4 && ics.cmp1[1] > 4.9 && ics.cmp2[0] > 4.9 && ics.cmp2[1] < 0.4, [ics.cmp1, ics.cmp2]);
  check('lm393_resolves_20mV', ics.cmp3[0] < 0.4 && ics.cmp3[1] > 4.99, ics.cmp3);
  check('xosc_100Hz_square', near(ics.osc100.f, 100, 6) && ics.osc100.hi > 4.9, ics.osc100);
  check('xosc_16MHz_averages_with_note', near(ics.osc16M.Vo, 2.5, 0.1) && /带宽/.test(ics.osc16M.note), ics.osc16M);
  check('xosc_no_oscillation_undervoltage', Math.abs(ics.oscLowV) < 0.01, ics.oscLowV);

  // ======================= buzzers & sensors =======================
  const sens = await page.evaluate(() => {
    const o = {}; let b;
    const bz = (type, src, V, f) => { NEW(); b = NET(); b.gnd(0); if (src === 'dc') b.add('battery', [0, 1], { V, r: 0 }); else b.add('ac', [1, 0], { Vp: V, f, wave: 'square' }); return b.add(type, [1, 0]); };
    let Z = bz('abuzzer', 'dc', 5); RUN(0.05); o.ab5 = { on: Z.state.on, I: Z._m.I };
    Z = bz('abuzzer', 'dc', -5); RUN(0.05); o.abRev = Z.state.on; Z = bz('abuzzer', 'dc', 2); RUN(0.05); o.ab2 = Z.state.on;
    Z = bz('pbuzzer', 'dc', 5); RUN(0.2); o.pbDC = { on: !!Z.state.on, I: Z._m.I };
    Z = bz('pbuzzer', 'ac', 5, 500); RUN(0.2); o.pb500 = { on: !!Z.state.on, f: Z.state.f };
    Z = bz('pbuzzer', 'ac', 5, 1200); RUN(0.2); o.pb1200 = { on: !!Z.state.on, f: Z.state.f };
    // Hall A3144 with 10 k pull-up
    const hall = (part, pos) => { NEW(); b = NET(); b.gnd(0); b.add('battery', [0, 1], { V: 5, r: 0 }); const H = b.add('hall', [1, 0, 2], { part, pos }); b.add('resistor', [1, 2], { R: 10e3 }); return H; };
    let H = hall('A3144', 0.5); RUN(0.01); o.h0 = H._m.Vo;
    H.props.pos = 0.85; app.dirty = true; RUN(0.01); o.h70 = H._m.Vo;
    H.props.pos = 0.61; app.dirty = true; RUN(0.01); o.h22keep = H._m.Vo;
    H.props.pos = 0.55; app.dirty = true; RUN(0.01); o.h10 = H._m.Vo;
    H.props.pos = 0.61; app.dirty = true; RUN(0.01); o.h22off = H._m.Vo;
    H.props.pos = 0.5; app.dirty = true; RUN(0.005); app.sel = { comp: H }; DEFS.hall.click(H, app); RUN(0.01); o.hClick = H._m.Vo;
    H = hall('49E', 0.5); RUN(0.01); o.l0 = H._m.Vo; H.props.pos = 0.75; app.dirty = true; RUN(0.01); o.l50 = H._m.Vo; H.props.pos = 0.25; app.dirty = true; RUN(0.01); o.lm50 = H._m.Vo;
    // reed switch + LED
    NEW(); b = NET(); b.gnd(0); b.add('battery', [0, 1], { V: 5, r: 0 }); const Rd = b.add('reed', [1, 2], { pos: 0 }); b.add('resistor', [2, 3], { R: 220 }); const L = b.add('led', [3, 0], { color: 'red' });
    RUN(0.02); o.reedOff = L._m.I; DEFS.reed.click(Rd, app); RUN(0.02); o.reedOn = L._m.I; Rd.props.pos = 0.5; app.dirty = true; RUN(0.02); o.reedHold = L._m.I; Rd.props.pos = 0.2; app.dirty = true; RUN(0.02); o.reedRel = L._m.I;
    // phototransistor, 5 V / 1 k
    const ph = (pos, R) => { NEW(); b = NET(); b.gnd(0); b.add('battery', [0, 1], { V: 5, r: 0 }); b.add('resistor', [1, 2], { R }); return b.add('phototr', [2, 0], { pos }); };
    let Q = ph(0, 1000); RUN(0.01); o.ph0 = Q._m.V; Q = ph(0.5, 1000); RUN(0.01); o.ph500 = { V: Q._m.V, I: Q._m.I }; Q = ph(1, 1000); RUN(0.01); o.ph1000 = { V: Q._m.V, I: Q._m.I };
    Q = ph(1, 10e3); RUN(0.01); o.phSat = { V: Q._m.V, st: RD(Q)['状态'] };
    return o;
  });
  report.sens = sens;
  check('active_buzzer_dc_on_30mA', sens.ab5.on && near(sens.ab5.I, 0.03, 0.004), sens.ab5);
  check('active_buzzer_reverse_and_low_silent', !sens.abRev && !sens.ab2, [sens.abRev, sens.ab2]);
  check('passive_buzzer_dc_silent', !sens.pbDC.on && near(sens.pbDC.I, 5 / 16, 0.02), sens.pbDC);
  check('passive_buzzer_tone_follows_drive', sens.pb500.on && near(sens.pb500.f, 500, 25) && sens.pb1200.on && near(sens.pb1200.f, 1200, 60), [sens.pb500, sens.pb1200]);
  check('hall_a3144_switch_with_hysteresis', sens.h0 > 4.9 && sens.h70 < 0.3 && sens.h22keep < 0.3 && sens.h10 > 4.9 && sens.h22off > 4.9 && sens.hClick < 0.3, sens);
  check('hall_49e_linear_14mV_per_mT', near(sens.l0, 2.535, 0.05) && near(sens.l50 - sens.l0, 0.7, 0.06) && near(sens.l0 - sens.lm50, 0.7, 0.06), [sens.l0, sens.l50, sens.lm50]);
  check('reed_switch_magnet_hysteresis', sens.reedOff < 1e-6 && sens.reedOn > 0.01 && sens.reedHold > 0.01 && sens.reedRel < 1e-6, [sens.reedOff, sens.reedOn, sens.reedHold, sens.reedRel]);
  check('phototransistor_current_tracks_light', sens.ph0 > 4.99 && near(sens.ph500.I, 1e-3, 1e-4) && near(sens.ph1000.I, 2e-3, 2e-4) && sens.phSat.V < 0.3 && /饱和/.test(sens.phSat.st), sens);

  // ======================= modules =======================
  const mods = await page.evaluate(() => {
    const o = {}; let b;
    // relay module: 5 V logic side, separate 12 V lamp circuit through COM/NO
    const rm = (trig) => { NEW(); b = NET(); b.gnd(0); b.add('battery', [0, 1], { V: 5, r: 0 }); const S = b.add('spdt', [0, 2, 1], { right: false }); const K = b.add('relaymod', [1, 0, 2, 4, 3, null], { trig });
      b.add('battery', [0, 5], { V: 12, r: 0 }); b.add('resistor', [5, 3], { R: 1e-3 }); const L = b.add('bulb', [4, 0], { Vr: 12, Pr: 5 }); return { S, K, L }; };
    let P = rm('high'); RUN(0.03); o.hiOff = { on: !!P.K.state.on, lamp: P.L._m.I };
    DEFS.spdt.click(P.S, app); RUN(0.004); o.hiEarly = !!P.K.state.on; RUN(0.03); o.hiOn = { on: !!P.K.state.on, lamp: P.L._m.I, coil: P.K._m.Ic, Iin: P.K._m.Iin };
    DEFS.spdt.click(P.S, app); RUN(0.03); o.hiRel = !!P.K.state.on;
    P = rm('low'); RUN(0.03); o.loGnd = !!P.K.state.on; DEFS.spdt.click(P.S, app); RUN(0.03); o.loHigh = !!P.K.state.on;
    // keypad: 3.3 V → 330 Ω → R2 ; C3 → LED → GND
    NEW(); b = NET(); b.gnd(0); b.add('battery', [0, 1], { V: 3.3, r: 0 }); b.add('resistor', [1, 2], { R: 330 }); const KP = b.add('keypad', [null, 2, null, null, null, null, 3, null]); const L = b.add('led', [3, 0], { color: 'green' });
    RUN(0.01); o.kpNone = L._m.I; KP.state.pressed = true; KP.state.key = 6; app.dirty = true; RUN(0.01); o.kp6 = { I: L._m.I, rd: RD(KP)['按键'] };
    KP.state.key = 5; app.dirty = true; RUN(0.01); o.kp5 = L._m.I; KP.state.pressed = false; app.dirty = true; RUN(0.01); o.kpUp = L._m.I;
    o.kpHit = [DEFS.keypad.keyAt(-72 + 36 * 2 + 10, -78 + 36 + 10), DEFS.keypad.keyAt(200, 0)];
    // LCD1602
    const lcd = (V, pos) => { NEW(); b = NET(); b.gnd(0); b.add('battery', [0, 1], { V, r: 0 }); const D = b.add('lcd1602', [0, 1, 3, null, null, null, null, null, null, null, null, null, null, null, 1, 0]); b.add('pot', [1, 3, 0], { R: 10e3, pos: pos === undefined ? 0.15 : pos }); return D; };
    let D = lcd(5); RUN(0.05); o.lcd = { rd: RD(D), init: D.state.init, bl: D._m.Ibl, ct: DEFS.lcd1602.contrast(D), l2: DEFS.lcd1602.text(D, 2) };
    app.render();
    D = lcd(3.0); RUN(0.05); o.lcdLow = D.state.init;
    D = lcd(9); RUN(0.2); o.lcdHigh = !!D.state.burnt;
    // L298N: VS 12 V; IN1/IN2 from the on-board +5 V; DC motor on OUT1/OUT2, 30 Ω on OUT3/OUT4
    const l2 = (in1, in2, ena) => { NEW(); b = NET(); b.gnd(0); b.add('battery', [0, 1], { V: 12, r: 0.05 });
      const U1 = b.add('l298n', [2, 3, 4, 5, 1, 0, 6, 7, 8, 9, 10, 11, 12], { ena: ena !== false });
      b.add('resistor', [8, in1 ? 6 : 0], { R: 1 }); b.add('resistor', [9, in2 ? 6 : 0], { R: 1 }); b.add('resistor', [10, 6], { R: 1 }); b.add('resistor', [11, 0], { R: 1 }); b.add('resistor', [7, 0], { R: 1 });
      const M = b.add('motor', [2, 3]); b.add('resistor', [4, 5], { R: 30 }); return { U1, M }; };
    let Q = l2(1, 0); o.lFwdBad = RUN(0.3); o.lFwd = { Va: Q.U1._m.Va, Ia: Q.U1._m.Ia, Vb: Q.U1._m.Vb, V5: Q.U1._m.V5, w: Q.M.state.w, rd: RD(Q.U1)['电机 A'], rdB: RD(Q.U1)['电机 B'] };
    Q = l2(0, 1); RUN(0.3); o.lRev = { Va: Q.U1._m.Va, w: Q.M.state.w, rd: RD(Q.U1)['电机 A'] };
    Q = l2(1, 1); RUN(0.05); o.lBrake = { Va: Q.U1._m.Va, rd: RD(Q.U1)['电机 A'] };
    Q = l2(1, 0, false); RUN(0.05); o.lCoast = { Va: Q.U1._m.Va, rd: RD(Q.U1)['电机 A'] };
    return o;
  });
  report.mods = mods;
  check('relay_module_high_trigger_switches_lamp', !mods.hiOff.on && Math.abs(mods.hiOff.lamp) < 1e-6 && !mods.hiEarly && mods.hiOn.on && Math.abs(mods.hiOn.lamp) > 0.3 && near(mods.hiOn.coil, 5 / 70, 0.005) && mods.hiOn.Iin > 1e-3 && !mods.hiRel, mods);
  check('relay_module_low_trigger', mods.loGnd && !mods.loHigh, [mods.loGnd, mods.loHigh]);
  check('keypad_matrix_row_col', mods.kpNone < 1e-6 && mods.kp6.I > 1e-3 && mods.kp6.rd === '6' && mods.kp5 < 1e-6 && mods.kpUp < 1e-6 && mods.kpHit[0] === 6 && mods.kpHit[1] === -1, mods);
  check('lcd1602_powered_text_backlight_contrast', mods.lcd.init && mods.lcd.bl > 0.012 && mods.lcd.bl < 0.025 && mods.lcd.ct > 0.3 && /VDD=5\.00/.test(mods.lcd.l2) && /Hello/.test(mods.lcd.rd['显示']), mods.lcd);
  check('lcd1602_undervoltage_blank_overvoltage_burns', !mods.lcdLow && mods.lcdHigh, [mods.lcdLow, mods.lcdHigh]);
  check('l298n_forward_drives_motor', mods.lFwdBad === 0 && mods.lFwd.Va > 8.5 && mods.lFwd.Va < 11.5 && mods.lFwd.w > 10 && /正转/.test(mods.lFwd.rd) && near(mods.lFwd.V5, 5, 0.1) && /正转/.test(mods.lFwd.rdB), mods.lFwd);
  check('l298n_reverse', mods.lRev.Va < -8.5 && mods.lRev.w < -10 && /反转/.test(mods.lRev.rd), mods.lRev);
  check('l298n_brake_and_coast', Math.abs(mods.lBrake.Va) < 0.5 && /制动/.test(mods.lBrake.rd) && /停止/.test(mods.lCoast.rd), [mods.lBrake, mods.lCoast]);

  // ======================= integration =======================
  const misc = await page.evaluate(() => {
    const o = {};
    const NEWT = ['mov', 'tvs', 'pptc', 'tl431', 'lm393', 'xosc', 'abuzzer', 'pbuzzer', 'hall', 'reed', 'phototr', 'relaymod', 'keypad', 'lcd1602', 'l298n'];
    o.palette = NEWT.filter(t => !document.querySelector('[data-type="' + t + '"]'));
    o.cats = CATEGORIES.map(c => c[0]);
    NEW(); NEWT.forEach((t, i) => A(t, (i % 5) * 420, Math.floor(i / 5) * 360, 0)); const js = JSON.stringify(app.serialize());
    try { app.load(JSON.parse(js)); o.reloaded = app.comps.length; RUN(0.01); app.render(); o.drawOK = true; } catch (e) { o.drawOK = e.message; }
    try { NEW(); NEWT.forEach((t, i) => A(t, (i % 5) * 420, Math.floor(i / 5) * 360, i % 4)); RUN(0.01); app.render(); o.rotDraw = true; } catch (e) { o.rotDraw = e.message; }
    // properties panel renders for every new part (text props included)
    try { for (const c of app.comps) { app.sel = { comp: c }; app.refreshProps(); } o.panels = true; } catch (e) { o.panels = e.message; }
    const lc = app.comps.find(c => c.type === 'lcd1602'); app.sel = { comp: lc }; app.refreshProps(); const tp = document.querySelector('input.tprop'); o.tprop = !!tp;
    if (tp) { tp.value = 'Temp 25C'; tp.onchange(); o.tpropVal = lc.props[tp.dataset.k]; }
    app.sel = null; app.refreshProps();
    // examples
    o.ex = {};
    for (const e of EXAMPLES) { app.loadExample(e.id); app.pause(); const bad = RUN(0.05); o.ex[e.id] = bad === 0 ? 'ok' : 'bad ' + bad; }
    return o;
  });
  report.misc = misc;
  check('palette_has_all_new_parts', misc.palette.length === 0 && ['sensor', 'protect', 'drive'].every(k => misc.cats.includes(k)), [misc.palette, misc.cats]);
  check('save_reload_draw_rotate_new_parts', misc.drawOK === true && misc.rotDraw === true && misc.reloaded === 15 && misc.panels === true, [misc.drawOK, misc.rotDraw, misc.panels]);
  check('text_property_editing', misc.tprop && misc.tpropVal === 'Temp 25C', [misc.tprop, misc.tpropVal]);
  check('all_examples_run_clean', Object.values(misc.ex).every(v => v === 'ok'), misc.ex);
  // ---- v7 example circuits: key behaviour of each ----
  const exr = await page.evaluate(() => {
    const o = {}, F = (t) => app.comps.find(c => c.type === t), FA = (t) => app.comps.filter(c => c.type === t);
    const LOAD = (id) => { app.loadExample(id); app.pause(); window.TOASTS = []; };
    for (const withMov of [true, false]) {
      LOAD('movsurge'); const M = F('mov'), K = F('tactile'), L = F('bulb');
      if (!withMov) { app.comps.splice(app.comps.indexOf(M), 1); app.dirty = true; }
      let bad = RUN(0.6); K.state.pressed = true; app.dirty = true; let pk = 0;
      app.run(); for (let i = 0; i < 60; i++) { app.simStep(); if (!app.net.converged) bad++; pk = Math.max(pk, Math.abs(L._m.V)); } app.pause();
      K.state.pressed = false; app.dirty = true; bad += RUN(0.1);
      o[withMov ? 'mov' : 'nomov'] = { bad, pk, bulbBurnt: !!L.state.burnt, E: withMov ? M.state.Epk : null, movBurnt: withMov ? !!M.state.burnt : null };
    }
    LOAD('tl431'); o.tl431 = { bad: RUN(0.2), V: F('voltmeter')._m.V };
    LOAD('nightlight'); { const Ld = F('ldr'), L = F('led'); let bad = RUN(0.1); const dark = L._m.I; Ld.props.pos = 0.9; app.dirty = true; bad += RUN(0.1); o.night = { bad, dark, bright: L._m.I }; }
    LOAD('l298n'); { const D = F('l298n'), S = FA('switch'); let bad = RUN(0.5); const fwd = D._m.Va; S[0].props.closed = false; S[1].props.closed = true; app.dirty = true; bad += RUN(0.8); const rev = D._m.Va;
      S[0].props.closed = true; app.dirty = true; bad += RUN(0.05); o.l298n = { bad, fwd, rev, brake: D._m.Va, st: DEFS.l298n.chan(D, 0) }; }
    LOAD('relaymod'); { const R = F('relaymod'), L = F('bulb'), S = F('switch'); let bad = RUN(0.1); const on = Math.abs(L._m.I); S.props.closed = false; app.dirty = true; bad += RUN(0.1); o.relay = { bad, on, off: Math.abs(L._m.I), st: !!R.state.on }; }
    LOAD('hallreed'); { const H = F('hall'), K = F('reed'), Ls = FA('led'); let bad = RUN(0.05); const a = [Ls[0]._m.I, Ls[1]._m.I];
      H.props.pos = 0.2; K.props.pos = 1; app.dirty = true; bad += RUN(0.05); o.hall = { bad, a, b: [Ls[0]._m.I, Ls[1]._m.I] }; }
    LOAD('lcd1602'); { const D = F('lcd1602'); const bad = RUN(0.2); o.lcd = { bad, init: !!D.state.init, ct: DEFS.lcd1602.contrast(D), bl: D._m.Ibl, l1: DEFS.lcd1602.text(D, 1).trim() }; }
    LOAD('buzzers'); { const A = F('abuzzer'), P = F('pbuzzer'), S = F('switch'); let bad = RUN(0.1); const a0 = !!A.state.on; S.props.closed = true; app.dirty = true; bad += RUN(0.1);
      o.buzz = { bad, a0, a1: !!A.state.on, pf: P.state.f, pon: !!P.state.on }; }
    return o;
  });
  report.examples7 = exr;
  check('ex_mov_surge_clamped_bulb_survives', exr.mov.bad === 0 && exr.mov.pk < 800 && !exr.mov.bulbBurnt && exr.mov.E > 1 && exr.mov.E < 100 && !exr.mov.movBurnt, exr.mov);
  check('ex_mov_surge_without_mov_burns_bulb', exr.nomov.pk > 850 && exr.nomov.bulbBurnt, exr.nomov);
  check('ex_tl431_5V_reference', exr.tl431.bad === 0 && near(exr.tl431.V, 4.99, 0.03), exr.tl431);
  check('ex_nightlight_led_on_in_dark_only', exr.night.bad === 0 && exr.night.dark > 0.005 && exr.night.bright < 1e-5, exr.night);
  check('ex_l298n_forward_reverse_brake', exr.l298n.bad === 0 && exr.l298n.fwd > 8 && exr.l298n.rev < -8 && Math.abs(exr.l298n.brake) < 3 && /Brake|制动/.test(exr.l298n.st), exr.l298n);
  check('ex_relay_module_low_trigger_lamp', exr.relay.bad === 0 && exr.relay.on > 0.35 && exr.relay.off < 1e-3 && !exr.relay.st, exr.relay);
  check('ex_hall_and_reed_leds', exr.hall.bad === 0 && exr.hall.a[0] > 0.005 && exr.hall.a[1] < 1e-6 && exr.hall.b[0] < 1e-6 && exr.hall.b[1] > 0.005, exr.hall);
  check('ex_lcd1602_hello', exr.lcd.bad === 0 && exr.lcd.init && exr.lcd.ct > 0.5 && exr.lcd.ct < 1 && exr.lcd.bl > 0.01 && exr.lcd.l1 === 'Hello, DCACLab!', exr.lcd);
  check('ex_buzzers', exr.buzz.bad === 0 && !exr.buzz.a0 && exr.buzz.a1 && exr.buzz.pon && Math.abs(exr.buzz.pf - 1000) < 30, exr.buzz);
  check('no_page_errors', errors.length === 0, errors);
  console.log(JSON.stringify(report, null, 1));
  console.log('\n==== RESULTS ====');
  for (const [k, v] of Object.entries(results)) console.log((v.pass ? 'PASS ' : 'FAIL ') + k + (v.pass ? '' : '  ' + JSON.stringify(v.info)));
  console.log(fails.length ? 'FAILED: ' + fails.length : 'ALL ' + Object.keys(results).length + ' PASSED');
  await browser.close();
})();
