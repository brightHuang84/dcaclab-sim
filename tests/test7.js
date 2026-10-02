// v6 tests: common everyday parts (regulators, batteries, PSU, passives, semis, switches, outputs, presets)
const { chromium } = require('playwright-core');
const results = {}; const fails = []; const report = {};
const check = (name, cond, info) => { results[name] = { pass: !!cond, info }; if (!cond) fails.push(name); };
const near = (v, x, tol) => Math.abs(v - x) <= tol;
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, locale: 'zh-CN' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8765/index.html?fresh=1');
  await page.waitForTimeout(500);
  if (process.env.SPARSE) await page.evaluate(() => { MNA.forceSparse = true; window.__sp = true; });
  await page.evaluate(() => {
    window.T = (c, i) => app.termPos(c, i);
    window.W = (a, b) => app.addWire(a[0], a[1], b[0], b[1], 0);
    window.A = (t, x, y, r, p) => app.addComp(t, x, y, r || 0, p || {});
    window.NEW = () => { app.clearAll(); app.pause(); app.resetSim(); window.TOASTS = []; };
    const t0 = app.toast.bind(app); app.toast = (s) => { (window.TOASTS = window.TOASTS || []).push(s); t0(s); };
    window.RUN = (sec) => { app.run(); let bad = 0; const n = Math.round(sec / app.dt); for (let i = 0; i < n; i++) { app.simStep(); if (!app.net.converged) bad++; } app.pause(); return bad; };
    window.RD = (c) => Object.fromEntries((DEFS[c.type].readings ? DEFS[c.type].readings(c) : []).map(([k, v]) => [k, String(v)]));
    // battery (V, r) -> series R -> 2-terminal device (term a -> term b) -> battery -
    window.SER = (V, R, type, props, rot) => {
      NEW(); const B = A('battery', -400, 0, 3, { V }); const Rs = A('resistor', -200, -200, 0, { R }); const D = A(type, 100, -200, rot || 0, props);
      W(T(B, 1), T(Rs, 0)); W(T(Rs, 1), T(D, 0)); W(T(D, 1), T(B, 0)); return { B, Rs, D };
    };
    // 78xx: Vin battery -> IN, GND, OUT -> RL
    window.REG = (part, Vin, RL, props) => {
      NEW(); const B = A('battery', -400, 0, 3, { V: Vin }); const U = A('reg78xx', 0, 0, 0, Object.assign({ part }, props || {})); const R = A('resistor', 300, 200, 1, { R: RL });
      W(T(B, 1), T(U, 0)); W(T(B, 0), T(U, 1)); W(T(U, 2), T(R, 0)); W(T(R, 1), T(U, 1)); return { B, U, R };
    };
  });

  // ---------------- regulators ----------------
  const reg = await page.evaluate(() => {
    const o = {}; let P;
    P = REG('7805', 9, 100); o.bad = RUN(0.05); o.r9 = { Vout: P.U._m.Vout, Iout: P.U._m.Iout, Iin: P.U._m.Iin, st: RD(P.U)['状态'] };
    P = REG('7805', 6, 100); RUN(0.05); o.r6 = { Vout: P.U._m.Vout, st: RD(P.U)['状态'] };
    P = REG('7805', 7.2, 100); RUN(0.05); o.r72 = { Vout: P.U._m.Vout };
    P = REG('7812', 15, 120); RUN(0.05); o.r12 = P.U._m.Vout;
    P = REG('7833', 9, 33); RUN(0.05); o.r33 = P.U._m.Vout;
    P = REG('AMS1117-3.3', 4.5, 33); RUN(0.05); o.ams = P.U._m.Vout;
    P = REG('7805', 9, 1); RUN(0.05); o.ilim = { Iout: P.U._m.Iout, st: RD(P.U)['状态'] };
    P = REG('7805', 20, 10); { app.run(); let mn = 99, hot = false, cyc = 0, was = false; for (let i = 0; i < 4 / app.dt; i++) { app.simStep(); mn = Math.min(mn, P.U._m.Vout); if (P.U.state.hot && !was) cyc++; was = !!P.U.state.hot; hot = hot || was; } app.pause(); o.hot = { hot, minVout: mn, cycles: cyc, tj: P.U.state.tj, toast: TOASTS.join('|') }; }
    P = REG('7805', 20, 10, { heatsink: true }); RUN(3); o.sink = { hot: !!P.U.state.hot, Vout: P.U._m.Vout, tj: P.U.state.tj };
    // LM317: R1 = 240 Ω (OUT–ADJ), R2 (ADJ–GND)
    const L = (Vin, R2, RL) => {
      NEW(); const B = A('battery', -400, 0, 3, { V: Vin }); const U = A('lm317', 0, 0, 0); const R1 = A('resistor', -200, 200, 1, { R: 240 }), Rb = A('resistor', -300, 400, 1, { R: R2 }), Ld = A('resistor', 300, 200, 1, { R: RL });
      const W1 = (a, b) => app.addWire(a[0], a[1], b[0], b[1], 1);
      W(T(B, 1), T(U, 2)); W1(T(U, 1), T(R1, 0)); W(T(R1, 1), T(U, 0)); W(T(U, 0), T(Rb, 0)); W(T(Rb, 1), T(B, 0)); W1(T(U, 1), T(Ld, 0)); W1(T(Ld, 1), T(B, 0));
      RUN(0.05); return { Vout: U._m.Vout, adj: U._m.V, st: RD(U)['状态'] };
    };
    o.l720 = L(12, 720, 330); o.l1680 = L(15, 1680, 1000); o.l0 = L(12, 1e-3, 1000); o.ldrop = L(7, 1680, 1000);
    return o;
  });
  report.reg = reg;
  check('7805_9V_in_5.00V_out', near(reg.r9.Vout, 5, 0.01) && reg.bad === 0 && /稳压/.test(reg.r9.st), reg.r9);
  check('7805_quiescent_current', near(reg.r9.Iin - reg.r9.Iout, 0.005, 0.0005), reg.r9);
  check('7805_dropout_6V_in_~4V', near(reg.r6.Vout, 4.0, 0.1) && /压差/.test(reg.r6.st), reg.r6);
  check('7805_edge_7.2V_still_regulates', near(reg.r72.Vout, 5, 0.05), reg.r72);
  check('7812_15V_in_12V', near(reg.r12, 12, 0.02), reg.r12);
  check('7833_part_3.3V', near(reg.r33, 3.3, 0.01), reg.r33);
  check('ams1117_low_dropout', near(reg.ams, 3.3, 0.01), reg.ams);
  check('7805_current_limit', reg.ilim.Iout < 1.6 && reg.ilim.Iout > 1.3 && /限流/.test(reg.ilim.st), reg.ilim);
  check('7805_thermal_shutdown_no_heatsink_cycles', reg.hot.hot && Math.abs(reg.hot.minVout) < 0.5 && reg.hot.cycles >= 2 && /过热/.test(reg.hot.toast), reg.hot);
  check('7805_heatsink_keeps_running', !reg.sink.hot && near(reg.sink.Vout, 5, 0.02), reg.sink);
  check('lm317_formula_R1_240_R2_720_5.036V', near(reg.l720.Vout, 1.25 * 4 + 50e-6 * 720, 0.01) && near(reg.l720.adj, 1.25, 0.005), reg.l720);
  check('lm317_formula_R2_1680_10.08V', near(reg.l1680.Vout, 1.25 * 8 + 50e-6 * 1680, 0.02), reg.l1680);
  check('lm317_min_1.25V', near(reg.l0.Vout, 1.25, 0.01), reg.l0);
  check('lm317_dropout', near(reg.ldrop.Vout, 7 - 1.7, 0.15) && /压差/.test(reg.ldrop.st), reg.ldrop);

  // ---------------- batteries, solar, PSU, buck ----------------
  const pw = await page.evaluate(() => {
    const o = {}; let P;
    const LOAD = (type, props, R, rotB) => { NEW(); const B = A(type, -300, 0, rotB || 0, props); const Rl = A('resistor', 200, 300, 0, { R }); W(T(B, 1), T(Rl, 0)); W(T(Rl, 1), T(B, 0)); RUN(0.02); return { V: B._m.V, I: B._m.I, rd: RD(B), B }; };
    o.aa2 = LOAD('aaholder', { n: 2 }, 1e9); o.aa4 = LOAD('aaholder', { n: 4 }, 5.4); o.nimh = LOAD('aaholder', { n: 4, chem: 'nimh' }, 1e9);
    o.cr = LOAD('coincell', {}, 100); o.cr0 = LOAD('coincell', {}, 1e9); o.lr44 = LOAD('coincell', { type: 'LR44' }, 1e9);
    o.li = LOAD('li18650', { pos: 0.8 }, 1e9); const li = LOAD('li18650', { pos: 0.5, cap: 100 }, 3.7); RUN(10); o.lidrain = { soc: DEFS.li18650.soc(li.B), q: li.B.state.q };
    delete o.aa2.B; delete o.aa4.B; delete o.nimh.B; delete o.cr.B; delete o.cr0.B; delete o.lr44.B; delete o.li.B;
    // solar
    const SOL = (pos, R) => { NEW(); const S = A('solar', 0, 0, 0, { pos }); const Rl = A('resistor', 0, 200, 0, { R }); W(T(S, 1), T(Rl, 1)); W(T(S, 0), T(Rl, 0)); RUN(0.02); return { V: S._m.V, I: S._m.I }; };
    o.sVoc = SOL(1, 1e9); o.sIsc = SOL(1, 1e-3); o.sHalf = SOL(0.5, 1e-3); o.sDark = SOL(0, 1e9); o.sMpp = SOL(1, 25);
    // PSU CV / CC
    const PSU = (V, I, R, on) => { NEW(); const S = A('psu', 0, 0, 0, { V, I, on: on !== false }); const Rl = A('resistor', 0, 300, 0, { R }); W(T(S, 1), T(Rl, 1)); W(T(S, 0), T(Rl, 0)); const bad = RUN(0.02); return { V: S._m.V, I: S._m.I, mode: RD(S)['模式'], bad }; };
    o.cv = PSU(12, 1, 100); o.cc = PSU(12, 1, 5); o.ccS = PSU(12, 0.5, 1e-3); o.off = PSU(12, 1, 100, false);
    // buck from 4×AA
    const BK = (n, Vout, R, eff) => {
      NEW(); const H = A('aaholder', -300, 0, 3, { n }); const U = A('buck', 0, 0, 0, Object.assign({ Vout }, eff ? { eff } : {})); const Rl = A('resistor', 300, 0, 1, { R });
      W(T(H, 1), T(U, 0)); W(T(H, 0), T(U, 1)); W(T(U, 2), T(Rl, 0)); W(T(U, 3), T(Rl, 1)); const bad = RUN(0.05); const m = U._m;
      return { Vin: m.Vin, Iin: m.Iin, Vout: m.Vout, Iout: m.Iout, Pin: m.Pin, Pout: m.Pout, st: DEFS.buck.status(U), bad };
    };
    o.b33 = BK(4, 3.3, 11); o.b5 = BK(4, 5, 50); o.b80 = BK(4, 3.3, 11, 80); o.bnl = BK(4, 3.3, 1e9); o.b1 = BK(1, 3.3, 11);
    return o;
  });
  report.power = pw;
  check('aa_holder_2x_3.0V_4x_6V_sag', near(pw.aa2.V, 3.0, 1e-3) && near(pw.aa4.V, 6 * 5.4 / 6, 0.01), [pw.aa2.V, pw.aa4.V]);
  check('aa_holder_nimh_4.8V', near(pw.nimh.V, 4.8, 1e-3), pw.nimh.V);
  check('cr2032_internal_resistance', near(pw.cr0.V, 3, 1e-3) && near(pw.cr.V, 3 * 100 / 115, 0.005) && near(pw.lr44.V, 1.5, 1e-3), [pw.cr0.V, pw.cr.V, pw.lr44.V]);
  check('18650_ocv_and_drain', near(pw.li.V, 3.97, 0.005) && pw.lidrain.soc < 0.5 && pw.lidrain.q > 9, [pw.li.V, pw.lidrain]);
  check('solar_voc_isc_light', near(pw.sVoc.V, 6, 0.15) && near(pw.sIsc.I, 0.2, 0.005) && near(pw.sHalf.I, 0.1, 0.003) && Math.abs(pw.sDark.V) < 0.01 && pw.sMpp.V * pw.sMpp.I > 0.6, pw);
  check('psu_cv_mode', near(pw.cv.V, 12, 0.01) && near(pw.cv.I, 0.12, 0.001) && /CV/.test(pw.cv.mode), pw.cv);
  check('psu_cc_mode', near(pw.cc.I, 1, 0.02) && near(pw.cc.V, 5, 0.1) && /CC/.test(pw.cc.mode) && near(pw.ccS.I, 0.5, 0.01) && pw.cc.bad === 0, [pw.cc, pw.ccS]);
  check('psu_output_off', Math.abs(pw.off.V) < 1e-3 && /OFF|关闭/.test(pw.off.mode), pw.off);
  check('buck_4AA_to_3.3V', near(pw.b33.Vout, 3.3, 0.01) && pw.b33.bad === 0 && /正常/.test(pw.b33.st), pw.b33);
  check('buck_efficiency_Pin_eq_Pout_over_eta', near(pw.b33.Pin, pw.b33.Pout / 0.88, 0.01 * pw.b33.Pin) && near(pw.b80.Pin, pw.b80.Pout / 0.8, 0.01 * pw.b80.Pin), [pw.b33, pw.b80]);
  check('buck_input_current_below_output', pw.b33.Iin < pw.b33.Iout && pw.b33.Iin > 0, pw.b33);
  check('buck_dropout_when_vin_low', pw.b5.Vout < 5 && pw.b5.Vout > 3.5 && /压差/.test(pw.b5.st), pw.b5);
  check('buck_no_load_and_uvlo', near(pw.bnl.Vout, 3.3, 0.01) && Math.abs(pw.b1.Vout) < 0.01 && /输入过低/.test(pw.b1.st), [pw.bnl, pw.b1]);

  // ---------------- capacitors ----------------
  const cap = await page.evaluate(() => {
    const o = {}; let P;
    P = SER(12, 10, 'ecap', { C: 100e-6, Vr: 25 }); RUN(0.2); o.ok = { v: P.D._m.V, burnt: !!P.D.state.burnt, st: RD(P.D)['状态'], toasts: TOASTS.slice() };
    P = SER(-9, 10, 'ecap', { C: 100e-6, Vr: 25 }); RUN(0.1); o.revEarly = { v: P.D._m.V, burnt: !!P.D.state.burnt, st: RD(P.D)['状态'], toasts: TOASTS.slice() };
    RUN(1); o.rev = { burnt: !!P.D.state.burnt, pop: P.D.state.pop, i: P.D._m.I, st: RD(P.D)['状态'], toasts: TOASTS.slice() };
    P = SER(35, 10, 'ecap', { C: 100e-6, Vr: 25 }); RUN(1); o.ov = { burnt: !!P.D.state.burnt, pop: P.D.state.pop, toasts: TOASTS.slice() };
    P = SER(9, 1000, 'ccap', { C: 100e-6 }); RUN(0.1); o.rc = P.D._m.V; o.code = [capCode(100e-9), capCode(10e-9), capCode(1e-6), capCode(22e-12), capCode(4.7e-9)];
    return o;
  });
  report.cap = cap;
  check('ecap_normal_charges_no_warning', near(cap.ok.v, 12, 0.01) && !cap.ok.burnt && cap.ok.toasts.length === 0 && cap.ok.st === '正常', cap.ok);
  check('ecap_reversed_warns', cap.revEarly.toasts.some(s => /极性接反/.test(s)) && /极性接反|爆裂/.test(cap.revEarly.st), cap.revEarly);
  check('ecap_reversed_pops_open', cap.rev.burnt && cap.rev.pop === 'rev' && Math.abs(cap.rev.i) < 1e-6 && cap.rev.toasts.some(s => /爆浆/.test(s)), cap.rev);
  check('ecap_overvoltage_pops', cap.ov.burnt && cap.ov.pop === 'ov' && cap.ov.toasts.some(s => /过压/.test(s)), cap.ov);
  check('ceramic_rc_charging_and_code', near(cap.rc, 9 * (1 - Math.exp(-1)), 0.05) && cap.code.join() === '104,103,105,220,472', cap);

  // ---------------- diodes, presets, bridge ----------------
  const di = await page.evaluate(() => {
    const o = {};
    const VF = (type, props, I) => { NEW(); const S = A('psu', -300, 0, 0, { V: 5, I }); const D = A(type, 100, -200, 0, props); W(T(S, 1), T(D, 0)); W(T(D, 1), T(S, 0)); RUN(0.01); return { vf: D._m.V, i: D._m.I }; };
    o.d4148 = VF('sigdiode', {}, 0.01); o.d4007 = VF('rectifier', {}, 1); o.d5819 = VF('schottky', {}, 1);
    o.gen4007 = VF('diode', Object.assign({ part: '1N4007' }, PRESETS.diode['1N4007']), 1);
    o.defs = { sch: DEFS.schottky.props.find(p => p.k === 'part').def, rec: DEFS.rectifier.props.find(p => p.k === 'part').def };
    // bridge: DC either polarity -> positive output
    const BR = (V) => { NEW(); const B = A('battery', -400, 0, 3, { V }); const Q = A('bridge', 0, 0, 0); const R = A('resistor', 0, 300, 0, { R: 100 }); W(T(B, 1), T(Q, 1)); W(T(B, 0), T(Q, 2)); W(T(Q, 0), T(R, 1)); W(T(Q, 3), T(R, 0)); RUN(0.01); return { out: Q._m.V, i: R._m.I }; };
    o.brP = BR(12); o.brN = BR(-12);
    // AC → bridge → C → R
    NEW(); const S = A('ac', -400, 0, 3, { Vp: 12, f: 50 }); const Q = A('bridge', 0, 0, 0); const C = A('capacitor', 300, 0, 1, { C: 470e-6 }); const R = A('resistor', 500, 0, 1, { R: 1000 });
    W(T(S, 1), T(Q, 1)); W(T(S, 0), T(Q, 2)); W(T(Q, 0), T(C, 0)); W(T(Q, 3), T(C, 1)); W(T(C, 0), T(R, 0)); W(T(C, 1), T(R, 1));
    o.acBad = RUN(0.5); let mn = 1e9, mx = -1e9; app.run(); for (let i = 0; i < 200; i++) { app.simStep(); mn = Math.min(mn, Q._m.V); mx = Math.max(mx, Q._m.V); } app.pause(); o.ac = { mn, mx };
    return o;
  });
  report.diodes = di;
  check('preset_1N4148_0.69V_at_10mA', near(di.d4148.vf, 0.69, 0.03) && near(di.d4148.i, 0.01, 2e-4), di.d4148);
  check('preset_1N4007_0.91V_at_1A', near(di.d4007.vf, 0.91, 0.04) && near(di.d4007.i, 1, 0.02), di.d4007);
  check('preset_1N5819_schottky_0.42V_at_1A', near(di.d5819.vf, 0.42, 0.04), di.d5819);
  check('generic_diode_with_1N4007_preset_matches', near(di.gen4007.vf, di.d4007.vf, 1e-6), [di.gen4007, di.d4007]);
  check('bridge_dc_either_polarity', near(di.brP.out, di.brN.out, 1e-6) && di.brP.out > 10 && di.brP.out < 11, [di.brP, di.brN]);
  check('bridge_ac_full_wave_filtered', di.acBad <= 1 && di.ac.mx > 10 && di.ac.mx < 11.2 && di.ac.mx - di.ac.mn < 0.5, [di.ac, di.acBad]);

  // preset select through the properties panel
  await page.evaluate(() => { NEW(); const D = A('diode', 0, 0, 0); const Q = A('npn', 200, 0, 0); app.fitView(); app.sel = { comp: D }; app.refreshProps(); window.__D = D; window.__Q = Q; });
  await page.locator('select[data-k="part"]').first().selectOption('1N5819');
  const selD = await page.evaluate(() => ({ part: __D.props.part, Is: __D.props.Is, nf: __D.props.nf, Rs: __D.props.Rs, label: DEFS.diode.label(__D) }));
  await page.evaluate(() => { app.sel = { comp: __Q }; app.refreshProps(); });
  await page.locator('select[data-k="part"]').first().selectOption('2N2222');
  const selQ = await page.evaluate(() => ({ part: __Q.props.part, BF: __Q.props.BF, Is: __Q.props.Is, VAF: __Q.props.VAF, mosOpts: DEFS.nmos.props.find(p => p.k === 'part').opts.map(o => o[0]), opOpts: DEFS.opamp.props.find(p => p.k === 'part').opts.map(o => o[0]) }));
  report.presetUI = [selD, selQ];
  check('ui_preset_select_diode_1N5819', selD.part === '1N5819' && selD.Is === 3.17e-5 && selD.nf === 1.373 && selD.label === '1N5819', selD);
  check('ui_preset_select_npn_2N2222', selQ.part === '2N2222' && selQ.BF === 200, selQ);
  check('mosfet_opamp_part_lists', ['IRF540', '2N7000'].every(k => selQ.mosOpts.includes(k)) && selQ.opOpts.includes('LM358'), selQ);

  // ---------------- LEDs, Darlington, opto, thyristors ----------------
  const se = await page.evaluate(() => {
    const o = {};
    // RGB: battery 5V -> resistor per channel -> pin; common cathode -> battery -
    const RGB = (rs, ca) => {
      NEW(); const B = A('battery', -500, 0, 3, { V: 5 }); const L = A('rgbled', 0, 0, 0, { ca: !!ca });
      const pins = [0, 2, 3], Rs = [];
      rs.forEach((r, k) => { if (!r) return; const R = A('resistor', -300 + 150 * k, 300 + 100 * k, 0, { R: r }); Rs.push(R); if (!ca) { W(T(B, 1), T(R, 0)); W(T(R, 1), T(L, pins[k])); } else { W(T(B, 0), T(R, 0)); W(T(R, 1), T(L, pins[k])); } });
      W(T(L, 1), ca ? T(B, 1) : T(B, 0)); RUN(0.1); const x = DEFS.rgbled.mix(L); return { hex: x.hex, Ir: L._m.Ir, Ig: L._m.Ig, Ib: L._m.Ib };
    };
    o.red = RGB([150, 0, 0]); o.yellow = RGB([155, 100, 0]); o.white = RGB([155, 100, 95]); o.blue = RGB([0, 0, 95]); o.caMag = RGB([155, 0, 95], true);
    // bi-colour: forward -> red, reverse -> green
    let P = SER(5, 150, 'bicolor', {}); RUN(0.1); o.biF = RD(P.D)['颜色']; P = SER(-5, 150, 'bicolor', {}); RUN(0.1); o.biR = RD(P.D)['颜色'];
    // TIP120: 5 V -> 100 k -> B ; 12 V -> 100 Ω -> C ; E -> 0
    NEW(); { const B5 = A('battery', -500, 0, 3, { V: 5 }), B12 = A('battery', -500, 400, 3, { V: 12 }), Q = A('tip120', 0, 0, 0), Rb = A('resistor', -250, -200, 0, { R: 22e3 }), Rc = A('resistor', 250, -200, 0, { R: 20 });
      W(T(B5, 1), T(Rb, 0)); W(T(Rb, 1), T(Q, 0)); W(T(B12, 1), T(Rc, 1)); W(T(Rc, 0), T(Q, 1)); W(T(Q, 2), T(B5, 0)); W(T(B5, 0), T(B12, 0)); RUN(0.02); o.tip = { ic: Q._m.I, ib: Q._m.Ib, vbe: Q._m.Vbe, vce: Q._m.V }; }
    // optocoupler: input 5 V -> Rin -> A, K -> 0 ; isolated output: 12 V -> RL -> C, E -> 12V−
    const OPT = (Rin, RL, ctr) => {
      NEW(); const B1 = A('battery', -500, 0, 3, { V: 5 }), B2 = A('battery', 500, 0, 3, { V: 12 }), O = A('opto', 0, 0, 0, { ctr: ctr || 100 }), R1 = A('resistor', -250, -200, 0, { R: Rin }), R2 = A('resistor', 250, -200, 0, { R: RL });
      W(T(B1, 1), T(R1, 0)); W(T(R1, 1), T(O, 0)); W(T(O, 1), T(B1, 0)); W(T(B2, 1), T(R2, 1)); W(T(R2, 0), T(O, 2)); W(T(O, 3), T(B2, 0));
      const bad = RUN(0.02); return { If: O._m.If, Ic: O._m.Ic, vce: O._m.Vce, vf: O._m.Vf, bad, warn: app.warn, st: RD(O)['状态'], outV: B2._nodes.map(n => app.net.v(n)) };
    };
    o.o100 = OPT(390, 100); o.o200 = OPT(390, 100, 200); o.oSat = OPT(390, 10000); o.oOff = OPT(1e9, 100);
    // SCR: 9 V -> anode switch -> RL -> A ; K -> 0 ; gate: 9 V -> gate switch -> Rg -> G
    const mkSCR = (type, RL, V) => {
      NEW(); const B = A('battery', -500, 0, 3, { V: V || 9 }), Sa = A('switch', -250, -300, 0, { closed: true }), RLr = A('resistor', 0, -300, 0, { R: RL }), Q = A(type, 300, 0, 0), Sg = A('switch', -250, 300, 0, { closed: false }), Rg = A('resistor', 0, 300, 0, { R: 1000 });
      W(T(B, 1), T(Sa, 0)); W(T(Sa, 1), T(RLr, 0)); W(T(RLr, 1), T(Q, 1)); W(T(Q, 0), T(B, 0)); W(T(B, 1), T(Sg, 0)); W(T(Sg, 1), T(Rg, 0)); W(T(Rg, 1), T(Q, 2));
      return { B, Sa, Sg, Q };
    };
    const set = (sw, v) => { sw.props.closed = v; app.dirty = true; };
    const S = (P) => ({ on: !!P.Q.state.on, ia: P.Q._m.I, v: P.Q._m.V, ig: P.Q._m.Ig });
    P = mkSCR('scr', 470); const seq = []; RUN(0.02); seq.push(S(P)); set(P.Sg, true); RUN(0.02); seq.push(S(P)); set(P.Sg, false); RUN(0.05); seq.push(S(P));
    set(P.Sa, false); RUN(0.02); seq.push(S(P)); set(P.Sa, true); RUN(0.05); seq.push(S(P)); o.scr = seq;
    P = mkSCR('scr', 10000); set(P.Sg, true); RUN(0.02); const h1 = S(P); set(P.Sg, false); RUN(0.02); o.scrIh = [h1, S(P)];
    P = mkSCR('scr', 470, -9); set(P.Sg, true); RUN(0.02); o.scrRev = S(P);
    P = mkSCR('triac', 470, -9); set(P.Sg, true); RUN(0.02); const t1 = S(P); set(P.Sg, false); RUN(0.02); o.triacNeg = [t1, S(P)];
    return o;
  });
  report.semis = se;
  check('rgb_red_only', se.red.hex === '#ff0000' && se.red.Ir > 0.019, se.red);
  check('rgb_red_green_mix_yellow', /^#ff[e-f][0-9a-f]00$/.test(se.yellow.hex) || /^#[e-f][0-9a-f]ff00$/.test(se.yellow.hex), se.yellow);
  check('rgb_all_three_white', parseInt(se.white.hex.slice(1, 3), 16) > 230 && parseInt(se.white.hex.slice(3, 5), 16) > 230 && parseInt(se.white.hex.slice(5, 7), 16) > 230, se.white);
  check('rgb_vf_per_channel', se.red.Ir > 0.019 && near(se.white.Ig, 0.02, 0.002) && near(se.blue.Ib, (5 - 3.1) / 95, 0.002), se);
  check('rgb_common_anode_magenta', /^#ff00[e-f][0-9a-f]$|^#[e-f][0-9a-f]00ff$/.test(se.caMag.hex), se.caMag);
  check('bicolor_led_polarity', se.biF === '红' && se.biR === '绿', [se.biF, se.biR]);
  check('tip120_darlington_beta_gt_1000', se.tip.ic / se.tip.ib > 1000 && se.tip.vbe > 1.1 && se.tip.vbe < 1.6, se.tip);
  check('opto_ctr_100pct', near(se.o100.Ic / se.o100.If, 1.0, 0.03) && se.o100.bad === 0 && se.o100.warn === '', se.o100);
  check('opto_ctr_200pct_prop', near(se.o200.Ic / se.o200.If, 2.0, 0.06), se.o200);
  check('opto_saturates_with_big_RL', se.oSat.vce < 0.3 && se.oSat.vce > 0 && /饱和/.test(se.oSat.st), se.oSat);
  check('opto_led_vf_~1.2V_off_state', se.o100.vf > 1.1 && se.o100.vf < 1.3 && Math.abs(se.oOff.Ic) < 1e-6 && /截止/.test(se.oOff.st), [se.o100.vf, se.oOff]);
  check('scr_off_until_gate', !se.scr[0].on && Math.abs(se.scr[0].ia) < 1e-6, se.scr[0]);
  check('scr_triggers_on_gate', se.scr[1].on && se.scr[1].ia > 0.015, se.scr[1]);
  check('scr_latches_after_gate_removed', se.scr[2].on && se.scr[2].ia > 0.015 && Math.abs(se.scr[2].ig) < 1e-6, se.scr[2]);
  check('scr_unlatches_when_anode_current_removed', !se.scr[3].on && !se.scr[4].on && Math.abs(se.scr[4].ia) < 1e-6, se.scr.slice(3));
  check('scr_below_holding_current_does_not_latch', se.scrIh[0].on && !se.scrIh[1].on, se.scrIh);
  check('scr_reverse_blocks', !se.scrRev.on && Math.abs(se.scrRev.ia) < 1e-6, se.scrRev);
  check('triac_conducts_negative_and_latches', se.triacNeg[0].on && se.triacNeg[1].on && se.triacNeg[1].ia < -0.015, se.triacNeg);

  // ---------------- switches ----------------
  const sw = await page.evaluate(() => {
    const o = {};
    // two LEDs from COM via A / B
    const TWO = (type, props, rot) => {
      NEW(); const B = A('battery', -500, 0, 3, { V: 5 }), S = A(type, 0, 0, rot || 0, props), La = A('led', -200, 400, 0), Lb = A('led', 200, 400, 0), Ra = A('resistor', -200, 250, 0, { R: 220 }), Rb = A('resistor', 200, 250, 0, { R: 220 });
      return { B, S, La, Lb, Ra, Rb };
    };
    let P = TWO('spdt', {}); W(T(P.B, 1), T(P.S, 1)); W(T(P.S, 0), T(P.Ra, 0)); W(T(P.S, 2), T(P.Rb, 0)); W(T(P.Ra, 1), T(P.La, 0)); W(T(P.Rb, 1), T(P.Lb, 0)); W(T(P.La, 1), T(P.B, 0)); W(T(P.Lb, 1), T(P.B, 0));
    RUN(0.02); o.spdtA = [P.La._m.I, P.Lb._m.I]; DEFS.spdt.click(P.S, app); RUN(0.02); o.spdtB = [P.La._m.I, P.Lb._m.I];
    // tactile: 1 -> +, 4 -> R -> LED (diagonal through the press)
    P = TWO('tactile', {}); W(T(P.B, 1), T(P.S, 0)); W(T(P.S, 3), T(P.Ra, 0)); W(T(P.Ra, 1), T(P.La, 0)); W(T(P.La, 1), T(P.B, 0));
    RUN(0.02); o.tacUp = P.La._m.I; P.S.state.pressed = true; app.dirty = true; RUN(0.02); o.tacDown = P.La._m.I; P.S.state.pressed = false; app.dirty = true; RUN(0.02); o.tacUp2 = P.La._m.I;
    // DPDT: pole 1 drives LED a from A, pole 2 LED b from B
    P = TWO('dpdt', {}); W(T(P.B, 1), T(P.S, 1)); W(T(P.B, 1), T(P.S, 4)); W(T(P.S, 0), T(P.Ra, 0)); W(T(P.S, 5), T(P.Rb, 0)); W(T(P.Ra, 1), T(P.La, 0)); W(T(P.Rb, 1), T(P.Lb, 0)); W(T(P.La, 1), T(P.B, 0)); W(T(P.Lb, 1), T(P.B, 0));
    RUN(0.02); o.dpA = [P.La._m.I, P.Lb._m.I]; DEFS.dpdt.click(P.S, app); RUN(0.02); o.dpB = [P.La._m.I, P.Lb._m.I];
    // rotary: COM -> +, position k -> resistor k·100 Ω -> 0
    NEW(); { const B = A('battery', -500, 0, 3, { V: 10 }), S = A('rotary', 0, 0, 0), Rs = [1, 2, 3, 4].map(k => A('resistor', 300, -300 + 150 * k, 0, { R: 100 * k }));
      W(T(B, 1), T(S, 0)); Rs.forEach((R, k) => { W(T(S, k + 1), T(R, 0)); W(T(R, 1), T(B, 0)); }); o.rot = [];
      for (let k = 0; k < 4; k++) { RUN(0.01); o.rot.push(-B._m.I || Rs.reduce((s, R) => s + R._m.I, 0)); DEFS.rotary.click(S, app); } o.rotWrap = S.props.sel; }
    // DIP: switch 2 on only
    NEW(); { const B = A('battery', -500, 0, 3, { V: 5 }), S = A('dip4', 0, 0, 0), Ls = [0, 1, 2, 3].map(k => A('resistor', -40 + 20 * k, 300 + 100 * k, 1, { R: 1000 }));
      for (let k = 0; k < 4; k++) { W(T(B, 1), T(S, k + 4)); W(T(S, k), T(Ls[k], 0)); W(T(Ls[k], 1), T(B, 0)); }
      DEFS.dip4.click(S, app, -20, 0); RUN(0.01); o.dip = Ls.map(R => +R._m.I.toFixed(6)); o.dipLabel = DEFS.dip4.label(S); }
    return o;
  });
  report.switches = sw;
  check('spdt_slide_switch_selects', sw.spdtA[0] > 0.005 && sw.spdtA[1] < 1e-6 && sw.spdtB[0] < 1e-6 && sw.spdtB[1] > 0.005, sw);
  check('tactile_button_4pin_press', sw.tacUp < 1e-6 && sw.tacDown > 0.005 && sw.tacUp2 < 1e-6, sw);
  check('dpdt_toggle_two_poles', sw.dpA[0] > 0.005 && sw.dpA[1] < 1e-6 && sw.dpB[0] < 1e-6 && sw.dpB[1] > 0.005, sw);
  check('rotary_switch_4_positions', sw.rot.every((v, k) => near(Math.abs(v), 10 / (100 * (k + 1)), 1e-3)) && sw.rotWrap === 1, sw.rot);
  check('dip_switch_individual', sw.dip[1] > 0.004 && sw.dip[0] < 1e-8 && sw.dip[2] < 1e-8 && sw.dip[3] < 1e-8 && sw.dipLabel === '0100', sw);

  // ---------------- outputs ----------------
  const out = await page.evaluate(() => {
    const o = {};
    // 7-seg CC: segments a,b,c via 330 Ω from 5 V -> "7"
    const SEG = (segs, ca) => {
      NEW(); const B = A('battery', -500, 0, 3, { V: 5 }), S = A('seg7cc', 0, 0, 0, { ca: !!ca }); const SP = DEFS.seg7cc.SEGPIN;
      segs.forEach((k, i) => { const R = A('resistor', -300 + 60 * i, 300 + 60 * i, 0, { R: 330 }); if (!ca) { W(T(B, 1), T(R, 0)); W(T(R, 1), T(S, SP[k])); } else { W(T(B, 0), T(R, 0)); W(T(R, 1), T(S, SP[k])); } });
      W(T(S, ca ? 2 : 7), ca ? T(B, 1) : T(B, 0)); RUN(0.05); return { d: DEFS.seg7cc.digit(S), lit: RD(S)['亮段'], I: S._m.I };
    };
    o.s7 = SEG(['a', 'b', 'c']); o.s2 = SEG(['a', 'b', 'g', 'e', 'd']); o.s8ca = SEG(['a', 'b', 'c', 'd', 'e', 'f', 'g'], true);
    // bar graph: 3 segments lit
    NEW(); { const B = A('battery', -500, 0, 3, { V: 5 }), L = A('ledbar', 0, 0, 0); for (let i = 0; i < 3; i++) { const R = A('resistor', -300 + 100 * i, -300 - 60 * i, 0, { R: 330 }); W(T(B, 1), T(R, 0)); W(T(R, 1), T(L, i)); }
      for (let i = 0; i < 10; i++) { W(T(L, 10 + i), [T(L, 10 + i)[0], 200]); if (i) W([T(L, 9 + i)[0], 200], [T(L, 10 + i)[0], 200]); } W([T(L, 10)[0], 200], T(B, 0)); RUN(0.05); o.bar = DEFS.ledbar.count(L); }
    // servo: 5 V supply, clock 50 Hz with duty d
    const SV = (duty, sec) => {
      NEW(); const B = A('battery', -500, 0, 3, { V: 5 }), Sv = A('servo', 200, 0, 0), K = A('clock', -300, 300, 0, { f: 50, duty, vdd: 5 }), G = A('ground', -500, 200, 0);
      W(T(B, 1), T(Sv, 1)); W(T(B, 0), T(Sv, 0)); W(T(B, 0), T(G, 0)); W(T(K, 0), T(Sv, 2)); const bad = RUN(sec || 0.6);
      return { ang: Sv.state.ang, pw: Sv.state.pw, T: Sv.state.T, I: Sv._m.I, bad };
    };
    o.sv0 = SV(0.05); o.sv180 = SV(0.1); o.sv90 = SV(0.075); o.svMove = SV(0.1, 0.1);
    // fan / vibration motor
    const FAN = (V, sec) => { const P = SER(V, 1e-3, 'fan', {}); RUN(sec || 5); return { rpm: P.D.state.rpm, I: P.D._m.I }; };
    o.f12 = FAN(12); o.f6 = FAN(6); o.f2 = FAN(2); o.fRev = FAN(-12);
    let P = SER(3, 1e-3, 'vibmotor', {}); RUN(0.5); o.vib = [P.D.state.vib, P.D._m.I]; P = SER(0.5, 1e-3, 'vibmotor', {}); RUN(0.5); o.vib0 = P.D.state.vib;
    return o;
  });
  report.outputs = out;
  check('seg7_cc_shows_7', out.s7.d === '7' && out.s7.lit === 'a b c', out.s7);
  check('seg7_cc_shows_2', out.s2.d === '2', out.s2);
  check('seg7_common_anode_8', out.s8ca.d === '8', out.s8ca);
  check('led_bar_graph_3_of_10', out.bar === 3, out.bar);
  check('servo_1ms_0deg', out.sv0.ang < 2 && near(out.sv0.pw, 1e-3, 2.1e-4) && near(out.sv0.T, 0.02, 3e-4) && out.sv0.bad === 0, out.sv0);
  check('servo_2ms_180deg', out.sv180.ang > 178, out.sv180);
  check('servo_mid_pulse_mid_angle', out.sv90.ang > 60 && out.sv90.ang < 120, out.sv90);
  check('servo_slew_limited_and_draws_current_while_moving', out.svMove.ang < 180 && out.svMove.ang > 90 && out.svMove.I > 0.05, out.svMove);
  check('fan_speed_follows_voltage', near(out.f12.rpm, 3000, 150) && out.f6.rpm > 800 && out.f6.rpm < 2000 && out.f2.rpm < 1 && near(out.f12.I, 0.15, 0.02), out);
  check('fan_reverse_protected', out.fRev.rpm < 1 && Math.abs(out.fRev.I) < 1e-6, out.fRev);
  check('vibration_motor', out.vib[0] > 0.9 && near(out.vib[1], 0.08, 0.005) && out.vib0 < 0.01, out.vib);

  // ---------------- static multimeter, dense vs sparse, examples, palette ----------------
  const misc = await page.evaluate(() => {
    const o = {};
    let P = REG('7805', 9, 100); const M = A('multimeter', 0, -400, 0, { mode: 'VDC' }); W(T(M, 1), T(P.U, 2)); W(T(M, 0), T(P.U, 1));
    app.staticUpdate(true); o.stopped = [meterText(M).txt, meterText(M).unit, app.hasRun, app.running];
    P.B.props.V = 6; app.dirty = true; app.changed(); app.staticUpdate(true); o.stopped6 = meterText(M).txt;
    // LM317 example & opto example with the simulation stopped
    app.loadExample('lm317'); app.pause(); app.resetSim(); app.staticUpdate(true); o.lmStatic = app.meterComps().map(c => meterText(c).txt);
    app.loadExample('opto'); app.pause(); app.resetSim(); const OM = A('multimeter', 1100, 300, 0, { mode: 'VDC' }); const O = app.comps.find(c => c.type === 'opto');
    W(T(OM, 1), T(O, 2)); W(T(OM, 0), T(O, 3)); app.staticUpdate(true); o.optoStatic = meterText(OM).txt; o.optoUnit = meterText(OM).unit;
    // dense vs sparse
    const cmp = {};
    for (const f of [false, true]) {
      MNA.forceSparse = f; const r = {};
      app.loadExample('opto'); app.pause(); RUN(0.05); r.opto = app.comps.find(c => c.type === 'opto')._m.Ic;
      app.loadExample('reg7805'); app.pause(); RUN(0.05); r.reg = app.comps.find(c => c.type === 'reg78xx')._m.Vout;
      app.loadExample('lm317'); app.pause(); RUN(0.05); r.lm = app.comps.find(c => c.type === 'lm317')._m.Vout;
      app.loadExample('buckaa'); app.pause(); RUN(0.05); r.buck = app.comps.find(c => c.type === 'buck')._m.Iin;
      app.loadExample('rgbmix'); app.pause(); RUN(0.05); r.rgb = app.comps.find(c => c.type === 'rgbled')._m.Ig;
      r.kind = app.net.lu ? app.net.lu.kind : (app.net.solver && app.net.solver.kind); cmp[f ? 'sparse' : 'dense'] = r;
    }
    MNA.forceSparse = !!window.__sp; o.cmp = cmp;
    // SCR example: press trigger button → latches; press reset (NC) → off
    app.loadExample('scr'); app.pause(); RUN(0.02); const Tq = app.comps.find(c => c.type === 'scr'), btn = app.comps.filter(c => c.type === 'button'), trig = btn.find(c => !c.props.nc), rst = btn.find(c => c.props.nc), led = app.comps.find(c => c.type === 'led');
    const seq = [[Tq.state.on, led._m.I]]; trig.state.pressed = true; app.dirty = true; RUN(0.02); seq.push([Tq.state.on, led._m.I]); trig.state.pressed = false; app.dirty = true; RUN(0.05); seq.push([Tq.state.on, led._m.I]);
    rst.state.pressed = true; app.dirty = true; RUN(0.02); rst.state.pressed = false; app.dirty = true; RUN(0.05); seq.push([Tq.state.on, led._m.I]); o.scrEx = seq;
    // every example runs clean
    const NEWEX = ['reg7805', 'lm317', 'rgbmix', 'opto', 'scr', 'buckaa'];
    o.ex = {}; for (const e of EXAMPLES) { app.loadExample(e.id); app.pause(); app.warn = ''; const bad = RUN(0.1); o.ex[e.id] = !app.warn && (bad <= 1 || !NEWEX.includes(e.id)) ? 'ok' : 'bad=' + bad + ' ' + app.warn; }
    o.rgbEx = (() => { app.loadExample('rgbmix'); app.pause(); RUN(0.1); const L = app.comps.find(c => c.type === 'rgbled'); return DEFS.rgbled.mix(L).hex; })();
    o.buckEx = (() => { app.loadExample('buckaa'); app.pause(); RUN(0.1); return app.meterComps().map(c => meterText(c).txt + ' ' + meterText(c).unit); })();
    const NEWT = ['reg78xx', 'lm317', 'buck', 'aaholder', 'coincell', 'li18650', 'solar', 'psu', 'ecap', 'ccap', 'schottky', 'rectifier', 'sigdiode', 'bridge', 'rgbled', 'bicolor', 'tip120', 'opto', 'scr', 'triac', 'tactile', 'spdt', 'dpdt', 'rotary', 'dip4', 'seg7cc', 'ledbar', 'servo', 'fan', 'vibmotor'];
    o.palette = NEWT.filter(t => !document.querySelector('[data-type="' + t + '"]'));
    // save / load round trip of all new parts
    NEW(); NEWT.forEach((t, i) => A(t, (i % 6) * 300, Math.floor(i / 6) * 300, 0)); const js = JSON.stringify(app.serialize ? app.serialize() : { comps: app.comps.map(c => ({ type: c.type, x: c.x, y: c.y, rot: c.rot, props: c.props })) });
    o.nNew = NEWT.length; o.saveLen = js.length;
    try { if (app.load) { app.load(JSON.parse(js)); } o.reloaded = app.comps.length; RUN(0.01); o.drawOK = true; app.draw && app.draw(); } catch (e) { o.drawOK = e.message; }
    // rotations draw without throwing
    try { NEW(); NEWT.forEach((t, i) => A(t, (i % 6) * 300, Math.floor(i / 6) * 300, i % 4)); RUN(0.01); app.draw && app.draw(); o.rotDraw = true; } catch (e) { o.rotDraw = e.message; }
    return o;
  });
  report.misc = misc;
  check('multimeter_reads_7805_stopped', misc.stopped[0] === '5.000' && misc.stopped[1] === 'V' && !misc.stopped[2] && !misc.stopped[3], misc.stopped);
  check('multimeter_7805_dropout_stopped', Math.abs(parseFloat(misc.stopped6) - 4.0) < 0.1, misc.stopped6);
  check('lm317_example_static_meter', misc.lmStatic.some(t => Math.abs(parseFloat(t) - 5.036) < 0.01), misc.lmStatic);
  check('opto_example_static_meter_isolated', /mV/.test(misc.optoUnit) && parseFloat(misc.optoStatic) < 300 && parseFloat(misc.optoStatic) > 0, [misc.optoStatic, misc.optoUnit]);
  check('dense_sparse_agree', ['opto', 'reg', 'lm', 'buck', 'rgb'].every(k => Math.abs(misc.cmp.dense[k] - misc.cmp.sparse[k]) < 1e-7 * Math.max(1, Math.abs(misc.cmp.dense[k]))), misc.cmp);
  check('scr_example_trigger_latch_reset', !misc.scrEx[0][0] && misc.scrEx[1][0] && misc.scrEx[2][0] && misc.scrEx[2][1] > 0.01 && !misc.scrEx[3][0] && misc.scrEx[3][1] < 1e-6, misc.scrEx);
  check('all_examples_run_clean', Object.values(misc.ex).every(v => v === 'ok') && ['reg7805', 'lm317', 'rgbmix', 'opto', 'scr', 'buckaa'].every(k => misc.ex[k] === 'ok'), misc.ex);
  check('buck_example_meters', misc.buckEx.includes('3.300 V') || misc.buckEx.includes('3.299 V'), misc.buckEx);
  check('palette_has_all_new_parts', misc.palette.length === 0, misc.palette);
  check('save_reload_and_draw_all_new_parts', misc.drawOK === true && misc.rotDraw === true, [misc.drawOK, misc.rotDraw, misc.reloaded]);
  check('no_page_errors', errors.length === 0, errors);
  console.log(JSON.stringify(report, null, 1));
  console.log('\n==== RESULTS ====');
  for (const [k, v] of Object.entries(results)) console.log((v.pass ? 'PASS ' : 'FAIL ') + k + (v.pass ? '' : '  ' + JSON.stringify(v.info)));
  console.log(fails.length ? 'FAILED: ' + fails.length : 'ALL ' + Object.keys(results).length + ' PASSED');
  await browser.close();
})();
