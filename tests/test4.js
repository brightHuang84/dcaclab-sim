// v3 feature tests: op-amp, logic, PMOS/JFET/Early, scope XY/FFT/upright, auto-join, sparse solver + stress, 555 events, relay/motor/xfmr/sensors
const { chromium } = require('playwright-core');
const results = {}; const fails = []; const report = {};
const check = (name, cond, info) => { results[name] = { pass: !!cond, info }; if (!cond) fails.push(name); };
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8765/index.html');
  await page.waitForTimeout(500);
  if (process.env.SPARSE) await page.evaluate(() => { MNA.forceSparse = true; });
  await page.evaluate(() => {
    app.pause();
    window.W = (a, b) => app.addWire(a[0], a[1], b[0], b[1], 0);
    window.PW = (pts) => { const w = { id: app.nextId++, pts: pts.map(p => p.slice()), color: '#d62828', _i: 0, _phase: 0 }; app.wires.push(w); app.dirty = true; return w; };
    window.T = (c, i) => app.termPos(c, i);
    // sample two node voltages over a time window
    window.sample = (dur, fa, fb) => { const a = [], b = []; const n = Math.round(dur / app.dt); for (let i = 0; i < n; i++) { app.simStep(); a.push(fa()); b.push(fb()); } return { a, b }; };
    window.pk = (arr) => Math.max(...arr.map(Math.abs));
  });

  // ---------- 1. op-amp ----------
  let r = await page.evaluate(() => {
    const out = {};
    for (const id of ['opinv', 'opnoninv']) {
      app.loadExample(id); app.pause(); app.advance(0.1);
      const U1 = app.comps.find(c => c.type === 'opamp'), S = app.comps.find(c => c.type === 'ac'), m = app.net;
      const s = sample(0.02, () => m.v(S._nodes[1]) - m.v(S._nodes[0]), () => m.v(U1._nodes[2]));
      // least-squares gain  Vout = g · Vin
      let num = 0, den = 0, res = 0; for (let i = 0; i < s.a.length; i++) { num += s.a[i] * s.b[i]; den += s.a[i] * s.a[i]; }
      const g = num / den; for (let i = 0; i < s.a.length; i++) res = Math.max(res, Math.abs(s.b[i] - g * s.a[i]));
      out[id] = { gain: +g.toFixed(4), maxResidual: +res.toFixed(4), vinPk: +pk(s.a).toFixed(3), voutPk: +pk(s.b).toFixed(3) };
    }
    return out;
  });
  check('opamp_inverting_gain_-10', Math.abs(r.opinv.gain + 10) < 0.02 && r.opinv.maxResidual < 0.05, r.opinv);
  check('opamp_noninverting_gain_10', Math.abs(r.opnoninv.gain - 10) < 0.02 && r.opnoninv.maxResidual < 0.05, r.opnoninv);
  report.opamp = r;
  r = await page.evaluate(() => {
    app.loadExample('opinv'); app.pause();
    const S = app.comps.find(c => c.type === 'ac'); S.props.Vp = 3; app.dirty = true; app.advance(0.1);
    const U1 = app.comps.find(c => c.type === 'opamp'), m = app.net;
    const s = sample(0.02, () => 0, () => m.v(U1._nodes[2]));
    return { max: Math.max(...s.b), min: Math.min(...s.b), warn: app.warn };
  });
  check('opamp_rail_saturation_clips_at_±12V', r.max > 11.8 && r.max <= 12.05 && r.min < -11.8 && r.min >= -12.05 && !r.warn, r);
  r = await page.evaluate(() => {
    app.loadExample('comparator'); app.pause(); app.advance(0.2);
    const U1 = app.comps.find(c => c.type === 'opamp'), L = app.comps.find(c => c.type === 'led'), LDR = app.comps.find(c => c.type === 'ldr');
    const dark = { vout: U1._m.V, bright: L._m.bright, state: DEFS.opamp.readings(U1)[3][1] };
    LDR.props.pos = 0.9; app.dirty = true; app.advance(0.2);
    const light = { vout: U1._m.V, bright: L._m.bright, state: DEFS.opamp.readings(U1)[3][1] };
    return { dark, light };
  });
  check('comparator_dark_led_on', r.dark.vout > 8.5 && r.dark.bright > 0.3, r.dark);
  check('comparator_light_led_off', r.light.vout < 0.3 && r.light.bright < 0.01, r.light);

  // ---------- 2. logic ----------
  r = await page.evaluate(() => {
    const tt = (type) => {
      app.clearAll(); app.pause();
      const one = type === 'not';
      const A = app.addComp('lswitch', 200, 180, 0), B = one ? null : app.addComp('lswitch', 200, 260, 0);
      const G = app.addComp(type, 400, 200, 0), P = app.addComp('lprobe', 520, 180, 0);
      W(T(A, 0), T(G, 0)); if (B) W(T(B, 0), T(G, 1)); W(T(G, one ? 1 : 2), T(P, 0));
      let s = '';
      for (const a of [0, 1]) for (const b of (one ? [0] : [0, 1])) { A.props.on = !!a; if (B) B.props.on = !!b; app.dirty = true; app.advance(0.01); s += P.state.lv; }
      return s;
    };
    const o = {}; for (const g of ['and', 'or', 'not', 'nand', 'nor', 'xor']) o[g] = tt(g); return o;
  });
  check('logic_truth_tables', r.and === '0001' && r.or === '0111' && r.not === '10' && r.nand === '1110' && r.nor === '1000' && r.xor === '0110', r);
  r = await page.evaluate(() => {
    app.loadExample('halfadder'); app.pause();
    const [A, B] = app.comps.filter(c => c.type === 'lswitch'), [PS, PC] = app.comps.filter(c => c.type === 'lprobe');
    const o = [];
    for (const a of [0, 1]) for (const b of [0, 1]) { A.props.on = !!a; B.props.on = !!b; app.dirty = true; app.advance(0.01); o.push(a + '+' + b + '=C' + PC.state.lv + 'S' + PS.state.lv); }
    return o.join(' ');
  });
  check('half_adder_all_inputs', r === '0+0=C0S0 0+1=C0S1 1+0=C0S1 1+1=C1S0', r);
  r = await page.evaluate(() => {
    app.loadExample('counter'); app.pause(); const s = app.comps.find(c => c.type === 'seg7'); const o = [];
    for (let i = 0; i < 18; i++) { app.advance(0.5); o.push(s.state.val); } return o;
  });
  check('dff_ripple_counter_counts_0_to_15_and_wraps', r.join(',') === '0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,0,1', r.join(','));
  r = await page.evaluate(() => {
    app.clearAll(); app.pause();
    const S7 = app.addComp('seg7', 400, 200, 0), sw = [];
    for (let i = 0; i < 4; i++) { const s = app.addComp('lswitch', 200, 160 + 20 * i, 0, { on: [0, 1, 0, 1][i] === 1 }); sw.push(s); W(T(s, 0), T(S7, i)); }
    app.advance(0.01); const v1 = S7.state.val;
    sw[0].props.on = true; sw[2].props.on = true; app.dirty = true; app.advance(0.01);
    return { v1, v2: S7.state.val, txt: DEFS.seg7.readings(S7)[0][1] };
  });
  check('seg7_decodes_hex', r.v1 === 10 && r.v2 === 15 && /F/.test(r.txt), r);
  r = await page.evaluate(() => {
    app.loadExample('clockblink'); app.pause(); const N = app.comps.find(c => c.type === 'not'), L = app.comps.find(c => c.type === 'led');
    let rises = 0, prev = N.state.out ? N.state.out[0] : 0, litMax = 0, litMin = 1;
    for (let i = 0; i < 200; i++) { app.advance(0.01); const o = N.state.out[0]; if (o && !prev) rises++; prev = o; litMax = Math.max(litMax, L._m.bright); litMin = Math.min(litMin, L._m.bright); }
    return { rises, litMax, litMin };
  });
  check('clock_2Hz_blinks_led_and_not_gate', r.rises === 4 && r.litMax > 0.5 && r.litMin < 0.01, r);

  // ---------- 3. PMOS / JFET / Early effect ----------
  r = await page.evaluate(() => {
    app.clearAll(); app.pause();
    const B = app.addComp('battery', 100, 300, 3, { V: 9 });           // + (100,240) - (100,360)
    const M = app.addComp('pmos', 300, 200, 0);                        // G(280,220) D(300,220) S(320,220)
    const R = app.addComp('resistor', 300, 320, 1, { R: 330 });        // (300,280)-(300,360)
    const L = app.addComp('led', 300, 440, 1, { color: 'red' });       // (300,400)-(300,480)
    PW([[100, 240], [100, 120], [200, 120]]); PW([[200, 120], [340, 120], [340, 220], [320, 220]]);
    PW([[300, 220], [300, 280]]); PW([[300, 360], [300, 400]]);
    PW([[300, 480], [200, 480]]); PW([[200, 480], [100, 480], [100, 360]]);
    const g = PW([[280, 220], [280, 300], [200, 300], [200, 480]]);   // gate -> 0 V : ON
    app.advance(0.05); const on = { bright: L._m.bright, Id: Math.abs(M._m.I) };
    g.pts = [[280, 220], [280, 160], [200, 160], [200, 120]]; app.dirty = true; app.advance(0.05); // gate -> +9 V : OFF
    return { on, off: { bright: L._m.bright, Id: Math.abs(M._m.I) } };
  });
  check('pmos_high_side_switch', r.on.bright > 0.5 && r.off.bright < 0.01 && r.off.Id < 1e-6, r);
  r = await page.evaluate(() => {
    app.clearAll(); app.pause();
    const B = app.addComp('battery', 100, 300, 3, { V: 9 });
    const J = app.addComp('njfet', 300, 200, 0, { Idss: 0.01, Vp: -2 }); // G(280,220) D(300,220) S(320,220)
    const Rd = app.addComp('resistor', 300, 120, 1, { R: 100 });       // (300,80)-(300,160)
    PW([[100, 240], [100, 60], [300, 60], [300, 80]]); PW([[300, 160], [300, 220]]);
    PW([[320, 220], [320, 320]]); PW([[320, 320], [320, 400], [100, 400], [100, 360]]);
    const g = PW([[280, 220], [280, 320], [320, 320]]);               // Vgs = 0
    app.advance(0.02); const on = Math.abs(Rd._m.I);
    // Vgs = -3 V via a 3 V cell between gate and source
    g.pts = [[280, 220], [280, 260], [140, 260], [140, 320]];
    const Bg = app.addComp('battery', 200, 320, 0, { V: 3 });         // - (140,320) + (260,320)
    PW([[260, 320], [320, 320]]); app.dirty = true; app.advance(0.02);
    return { IdVgs0: on, IdVgsM3: Math.abs(Rd._m.I) };
  });
  check('njfet_idss_and_pinch_off', r.IdVgs0 > 0.0095 && r.IdVgs0 < 0.0115 && r.IdVgsM3 < 1e-6, r);
  r = await page.evaluate(() => {
    const run = (VAF) => {
      app.clearAll(); app.pause();
      const Bb = app.addComp('battery', 100, 300, 3, { V: 5 });        // + (100,240) - (100,360)
      const Q = app.addComp('npn', 300, 200, 0, { VAF });              // E(280,220) B(300,220) C(320,220)
      const Rb = app.addComp('resistor', 200, 160, 0, { R: 430000 });  // (160,160)-(240,160)
      const Bc = app.addComp('battery', 500, 300, 3, { V: 2 });        // + (500,240) - (500,360)
      PW([[100, 240], [100, 160], [160, 160]]); PW([[240, 160], [300, 160], [300, 220]]);
      PW([[320, 220], [320, 140], [500, 140], [500, 240]]);
      PW([[280, 220], [280, 400]]); PW([[280, 400], [500, 400], [500, 360]]); PW([[100, 360], [100, 400], [280, 400]]);
      app.advance(0.01); const i1 = Q._m.I;
      Bc.props.V = 8; app.dirty = true; app.advance(0.01); const i2 = Q._m.I;
      return { Ic2V: i1, Ic8V: i2, ratio: i2 / i1 };
    };
    return { early: run(100), none: run(0) };
  });
  check('bjt_early_effect_ic_rises_with_vce', r.early.ratio > 1.04 && r.early.ratio < 1.08 && Math.abs(r.none.ratio - 1) < 0.005 && r.early.Ic2V > 5e-4, r);

  // ---------- 4. oscilloscope XY / FFT / upright ----------
  r = await page.evaluate(() => {
    app.loadExample('lissajous'); app.pause(); app.advance(0.3);
    const O = app.comps.find(c => c.type === 'scope'), S = scopeRaw(O, 900), F = scopeFFT(O);
    let x0 = 0; for (let i = 0; i < S.n; i++) if (Math.abs(S.v1[i]) < 0.05) x0++;
    app.render();
    return { mode: O.props.mode, xmax: Math.max(...S.v1), xmin: Math.min(...S.v1), ymax: Math.max(...S.v2), ymin: Math.min(...S.v2), f1: F.p1.f, f2: F.p2.f, a1: F.p1.a, a2: F.p2.a };
  });
  check('scope_xy_lissajous_ranges', r.mode === 'xy' && Math.abs(r.xmax - 5) < 0.1 && Math.abs(r.xmin + 5) < 0.1 && Math.abs(r.ymax - 5) < 0.1 && Math.abs(r.ymin + 5) < 0.1, r);
  check('scope_fft_peaks_50_and_100Hz', Math.abs(r.f1 - 50) < 1 && Math.abs(r.f2 - 100) < 1 && Math.abs(r.a1 - 5) < 0.1 && Math.abs(r.a2 - 5) < 0.1, r);
  r = await page.evaluate(() => {
    app.loadExample('fft'); app.pause(); app.advance(1.5);
    const O = app.comps.find(c => c.type === 'scope'), F = scopeFFT(O);
    const amp = (FF, f) => { const k0 = Math.round(f / FF.df); let k = k0; for (let i = k0 - 3; i <= k0 + 3; i++) if (FF.mag[i] > FF.mag[k]) k = i; const r = FF.n / FF.L, Wd = Math.ceil(2 * r) + 1; let e = 0; for (let i = k - Wd; i <= k + Wd; i++) e += FF.mag[i] ** 2; return Math.sqrt(e / (1.5 * r)); };
    app.render();
    return { n: F.n, fs: F.fs, df: F.f1.df, fund: F.p1.f, a1: amp(F.f1, 100), a2: amp(F.f1, 200), a3: amp(F.f1, 300), a5: amp(F.f1, 500), rc1: amp(F.f2, 100), rc3: amp(F.f2, 300) };
  });
  const sq = 4 / Math.PI * 5;
  check('scope_fft_square_wave_odd_harmonics', Math.abs(r.fund - 100) < 1 && Math.abs(r.a1 / sq - 1) < 0.02 && Math.abs(r.a3 / (sq / 3) - 1) < 0.05 && Math.abs(r.a5 / (sq / 5) - 1) < 0.08 && r.a2 < 0.05 * r.a1, Object.assign({ theory: [sq, sq / 3, sq / 5] }, r));
  check('scope_fft_rc_filter_attenuates', r.rc1 < r.a1 && r.rc3 / r.rc1 < r.a3 / r.a1 / 2, r);
  r = await page.evaluate(() => {
    app.loadExample('scope'); app.pause(); app.advance(0.1);
    const O = app.comps.find(c => c.type === 'scope'); const o = [];
    for (const mode of ['yt', 'xy', 'fft']) for (let k = 0; k < 4; k++) { O.props.mode = mode; O.rot = k; app.dirty = true; app.render(); o.push(mode + k); }
    O.rot = 1; O.props.mode = 'yt'; app.dirty = true; app.fitView(); app.render();
    return o.length;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: '/workspace/dcaclab-sim-test/scope-rot1.png' });
  check('scope_all_modes_all_rotations_render', r === 12 && errors.length === 0, { r, errors });

  // ---------- 5. wire over terminal: auto-join (real mouse) ----------
  await page.evaluate(() => {
    app.clearAll(); app.view = { s: 1, ox: 0, oy: 0 };
    app.addComp('battery', 200, 260, 0, { V: 10 });                   // - (140,260) + (260,260)
    app.addComp('resistor', 500, 300, 1, { R: 100 });                 // R1 (500,260)-(500,340)
    app.addComp('resistor', 700, 300, 1, { R: 100 });                 // R2 (700,260)-(700,340)
    PW([[140, 260], [140, 480], [500, 480]]); PW([[500, 480], [500, 340]]); PW([[500, 480], [700, 480], [700, 340]]);
    app.changed(); app.run();
  });
  const box = await page.locator('#cv').boundingBox();
  const drag = async (p, q) => {
    await page.mouse.move(box.x + p[0], box.y + p[1]); await page.mouse.down();
    await page.mouse.move(box.x + (p[0] + q[0]) / 2, box.y + p[1] + 1, { steps: 6 });
    await page.mouse.move(box.x + q[0] + 2, box.y + q[1] + 2, { steps: 6 });
    await page.mouse.up();
  };
  await drag([260, 260], [700, 260]);  // straight wire from battery + to R2 top, passing exactly over R1's top terminal
  await page.waitForTimeout(500);
  r = await page.evaluate(() => { const R = app.comps.filter(c => c.type === 'resistor'); app.rebuild(); return { wires: app.wires.length, I1: Math.abs(R[0]._m.I), I2: Math.abs(R[1]._m.I), pass: app.passOvers.length, toast: document.getElementById('toast').textContent }; });
  check('autojoin_wire_drawn_through_terminal', r.wires === 5 && Math.abs(r.I1 - 0.1) < 1e-4 && Math.abs(r.I2 - 0.1) < 1e-4 && r.pass === 0 && /自动连接/.test(r.toast), r);
  // component moved so that its terminal lands on a wire body
  r = await page.evaluate(() => {
    app.pause(); app.clearAll();
    const B = app.addComp('battery', 200, 260, 0, { V: 10 });
    const R2 = app.addComp('resistor', 700, 300, 1, { R: 100 });
    PW([[260, 260], [700, 260]]); PW([[140, 260], [140, 480], [700, 480], [700, 340]]);
    const R1 = app.addComp('resistor', 500, 300, 1, { R: 100 });      // top (500,260) lies on the red wire, bottom (500,340) free
    app.rebuild(); const before = app.passOvers.length;
    const n = app.autoJoin([], [R1]);                                  // what the UI calls at the end of a move / drop / rotate
    app.rebuild(); const after = app.passOvers.length;
    // a wire lying across BOTH terminals of one part is not auto-joined (would short it) but stays marked
    app.clearAll(); const R3 = app.addComp('resistor', 400, 200, 0, { R: 100 }); const w = PW([[300, 200], [500, 200]]);
    const n2 = app.autoJoin([w]); app.rebuild(); const marked = app.passOvers.length;
    const n3 = app.joinPassOvers(); app.rebuild();
    return { before, n, after, n2, marked, n3, after2: app.passOvers.length };
  });
  check('autojoin_moved_part_and_marker', r.before === 1 && r.n === 1 && r.after === 0 && r.n2 === 0 && r.marked === 2 && r.n3 === 2 && r.after2 === 0, r);

  // ---------- 6. sparse solver: agreement + stress ----------
  r = await page.evaluate(() => {
    const ladder = (N) => {
      app.clearAll(); app.pause();
      app.addComp('battery', 0, 200, 3, { V: 10 }); app.addComp('ground', 0, 300); app.addWire(0, 260, 0, 280, 0);
      let x = 0, prev = [0, 140]; const sh = [];
      for (let i = 0; i < N; i++) {
        const Rs = app.addComp('resistor', x + 40, 140, 0, { R: 100 }); W(prev, T(Rs, 0));
        const Rp = app.addComp('resistor', x + 80, 200, 1, { R: 1000 }); W(T(Rs, 1), T(Rp, 0));
        W(T(Rp, 1), [x + 80, 260]); W([x + 80, 260], [x, 260]); sh.push(Rp); prev = T(Rs, 1); x += 80;
      }
      return sh;
    };
    const leds = (N) => {
      app.clearAll(); app.pause();
      app.addComp('battery', 0, 200, 3, { V: 5 }); app.addComp('ground', 0, 300); app.addWire(0, 260, 0, 280, 0);
      const L = []; let prevTop = [0, 140], prevBot = [0, 260];
      for (let i = 0; i < N; i++) {
        const x = 60 + i * 60;
        const R = app.addComp('resistor', x, 180, 1, { R: 150 + i });   // (x,140)-(x,220)
        const D = app.addComp('led', x, 260, 1, { color: ['red', 'green', 'blue', 'yellow'][i % 4] }); // (x,220)-(x,300)
        W(prevTop, T(R, 0)); W(T(D, 1), [x, 320]); W([x, 320], [prevBot[0], 320]); if (i === 0) W([0, 320], [0, 260]);
        prevTop = T(R, 0); prevBot = [x, 320]; L.push(D);
      }
      return L;
    };
    const time = (sec) => { app.advance(0.002); const t0 = performance.now(); app.advance(sec); return (performance.now() - t0) / sec; };
    const out = {};
    // agreement dense vs sparse
    MNA.forceDense = true; MNA.forceSparse = false; let sh = ladder(60); app.advance(0.002); const vd = sh.map(c => c._m.V);
    MNA.forceDense = false; MNA.forceSparse = true; sh = ladder(60); app.advance(0.002); const vs = sh.map(c => c._m.V);
    out.ladderMaxDiff = Math.max(...vd.map((v, i) => Math.abs(v - vs[i])));
    MNA.forceDense = true; MNA.forceSparse = false; let L = leds(40); app.advance(0.01); const id = L.map(c => c._m.I);
    MNA.forceDense = false; MNA.forceSparse = true; L = leds(40); app.advance(0.01); const is = L.map(c => c._m.I);
    out.ledMaxDiff = Math.max(...id.map((v, i) => Math.abs(v - is[i]))); out.ledI0 = is[0];
    MNA.forceSparse = false;
    // stress
    sh = ladder(200); let tm = time(0.2); out.ladder200 = { unknowns: app.net.n, solver: app.net.lin.kind, msPerSimSec: +tm.toFixed(1) };
    const tr = performance.now(); app.dirty = true; app.rebuild(); out.ladder200.rebuildMs = +(performance.now() - tr).toFixed(1);
    const td = performance.now(); app.render(); out.ladder200.renderMs = +(performance.now() - td).toFixed(1);
    MNA.forceDense = true; sh = ladder(200); tm = time(0.1); out.ladder200dense = { solver: app.net.lin.kind, msPerSimSec: +tm.toFixed(1) }; MNA.forceDense = false;
    sh = ladder(500); tm = time(0.1); out.ladder500 = { unknowns: app.net.n, solver: app.net.lin.kind, msPerSimSec: +tm.toFixed(1) };
    L = leds(100); tm = time(0.1); out.led100 = { unknowns: app.net.n, solver: app.net.lin.kind, msPerSimSec: +tm.toFixed(1), iters: app.net.iters };
    MNA.forceDense = true; L = leds(100); tm = time(0.05); out.led100dense = { solver: app.net.lin.kind, msPerSimSec: +tm.toFixed(1) }; MNA.forceDense = false;
    for (const k of ['ladder200', 'ladder500', 'led100']) out[k].realtimeFactor = +(1000 / out[k].msPerSimSec).toFixed(2);
    return out;
  });
  report.stress = r;
  check('sparse_matches_dense_linear', r.ladderMaxDiff < 1e-9, r.ladderMaxDiff);
  check('sparse_matches_dense_nonlinear', r.ledMaxDiff < 1e-7 && r.ledI0 > 0.005, { d: r.ledMaxDiff, i0: r.ledI0 });
  check('stress_200_node_ladder_realtime', r.ladder200.unknowns > 200 && r.ladder200.solver === 'sparse' && r.ladder200.msPerSimSec < 1000, r.ladder200);
  check('stress_500_node_ladder_realtime', r.ladder500.msPerSimSec < 1000, r.ladder500);
  check('stress_100_led_branches_realtime', r.led100.msPerSimSec < 1000, r.led100);

  // ---------- 7. 555 event-localised switching ----------
  r = await page.evaluate(() => {
    const TH = Math.LN2 * 11000 * 47e-6, TL = 0.333257;
    const meas = (ev, dt) => {
      app.loadExample('ne555'); app.pause(); app.eventLoc = ev; app.dt = dt; app.dirty = true;
      const U1 = app.comps.find(c => c.type === 'ic555'), st = U1.state;
      app.advance(1.5);
      const hi = [], lo = []; let lr = st.lastRise, lf = st.lastFall;
      for (let i = 0; i < Math.round(3 / dt); i++) {
        app.simStep();
        if (st.lastFall !== lf) { lf = st.lastFall; if (lr !== undefined) hi.push(lf - lr); }
        if (st.lastRise !== lr) { lr = st.lastRise; if (lf !== undefined) lo.push(lr - lf); }
      }
      const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
      const H = avg(hi), L = avg(lo);
      return { dt, high: +H.toFixed(6), low: +L.toFixed(6), errHighPct: +(100 * (H - TH) / TH).toFixed(3), errLowPct: +(100 * (L - TL) / TL).toFixed(3), jitterHigh: +(Math.max(...hi) - Math.min(...hi)).toExponential(2), events: app.events || 0 };
    };
    const o = { theory: { high: TH, low: TL }, on200u: meas(true, 2e-4), off200u: meas(false, 2e-4), on1m: meas(true, 1e-3), off1m: meas(false, 1e-3) };
    app.eventLoc = true; app.dt = 2e-4;
    return o;
  });
  report.ne555 = r;
  check('ne555_event_localised_accurate', Math.abs(r.on200u.errHighPct) < 0.1 && Math.abs(r.on200u.errLowPct) < 0.1 && Math.abs(r.on1m.errHighPct) < 0.3 && Math.abs(r.on1m.errLowPct) < 0.3, r);
  check('ne555_events_beat_step_quantisation', Math.abs(r.on1m.errHighPct) + Math.abs(r.on1m.errLowPct) < Math.abs(r.off1m.errHighPct) + Math.abs(r.off1m.errLowPct), { on: r.on1m, off: r.off1m });

  // ---------- 8. relay / motor / transformer / sensors / buzzer ----------
  r = await page.evaluate(() => {
    app.loadExample('relay'); app.pause(); app.advance(0.2);
    const K = app.comps.find(c => c.type === 'relay'), S = app.comps.find(c => c.type === 'switch'), [L1, L2] = app.comps.filter(c => c.type === 'bulb');
    const off = { on: !!K.state.on, no: L1._m.bright, nc: L2._m.bright };
    S.props.closed = true; app.dirty = true; app.advance(0.3);
    const on = { on: !!K.state.on, no: L1._m.bright, nc: L2._m.bright, coil: Math.abs(K._p.i) };
    S.props.closed = false; app.dirty = true; let vmax = 0;
    for (let i = 0; i < 500; i++) { app.simStep(); vmax = Math.max(vmax, Math.abs(app.net.v(K._nodes[0]) - app.net.v(K._nodes[1]))); }
    return { off, on, back: { on: !!K.state.on, no: L1._m.bright, nc: L2._m.bright }, coilVmaxAfterOpen: vmax, warn: app.warn };
  });
  check('relay_pull_in_and_release', !r.off.on && r.off.nc > 0.9 && r.off.no < 0.01 && r.on.on && r.on.no > 0.9 && r.on.nc < 0.01 && Math.abs(r.on.coil - 0.09) < 0.002 && !r.back.on && r.back.nc > 0.5 && r.coilVmaxAfterOpen < 10 && !r.warn, r);
  r = await page.evaluate(() => {
    app.loadExample('motor'); app.pause(); app.advance(8);
    const M = app.comps.find(c => c.type === 'motor'), P = M.props, w = M.state.w, I = M._m.I;
    return { rpm: w * 60 / (2 * Math.PI), I, torqueBalance: P.k * I / (P.b * w), emf: P.k * w, V: M._m.V, vCheck: (M._m.V - P.k * w) / (I * P.R) };
  });
  check('motor_spins_up_with_torque_balance', r.rpm > 1000 && Math.abs(r.torqueBalance - 1) < 0.02 && Math.abs(r.vCheck - 1) < 0.01, r);
  r = await page.evaluate(() => {
    app.clearAll(); app.pause();
    const S = app.addComp('ac', 140, 300, 3, { Vp: 10, f: 50 });      // + (140,240) - (140,360)
    const X = app.addComp('xfmr', 300, 300, 0, { n: 2 });             // P1(260,280) P2(260,320) S1(340,280) S2(340,320)
    const R = app.addComp('resistor', 420, 300, 1, { R: 1000 });      // (420,260)-(420,340)
    PW([[140, 240], [140, 200], [220, 200], [220, 280], [260, 280]]); PW([[140, 360], [140, 400], [220, 400], [220, 320], [260, 320]]);
    PW([[340, 280], [380, 280], [380, 260], [420, 260]]); PW([[340, 320], [380, 320], [380, 340], [420, 340]]);
    app.advance(0.2);
    const s = sample(0.02, () => app.net.v(X._nodes[0]) - app.net.v(X._nodes[1]), () => app.net.v(X._nodes[2]) - app.net.v(X._nodes[3]));
    let num = 0, den = 0; for (let i = 0; i < s.a.length; i++) { num += s.a[i] * s.b[i]; den += s.a[i] * s.a[i]; }
    return { v1pk: pk(s.a), v2pk: pk(s.b), ratio: num / den };
  });
  check('transformer_secondary_is_vp_over_n', Math.abs(r.ratio - 0.5) < 0.01 && r.v2pk > 4.9 && r.v2pk < 5.05, r);
  r = await page.evaluate(() => {
    app.loadExample('xfmr'); app.pause(); app.advance(1);
    const V = app.comps.find(c => c.type === 'voltmeter'), X = app.comps.find(c => c.type === 'xfmr');
    return { vdc: V._m.reading !== undefined ? V._m.reading : V._m.V, rd: DEFS.xfmr.readings(X).map(x => x.join('=')).join(' | ') };
  });
  check('bridge_rectifier_dc_output', r.vdc > 6.5 && r.vdc < 7.4, r);
  r = await page.evaluate(() => {
    const Rof = (type, props) => { app.clearAll(); app.pause(); const B = app.addComp('battery', 200, 300, 0, { V: 1 }); const X = app.addComp(type, 400, 300, 0, props);
      PW([[260, 300], [360, 300]]); PW([[440, 300], [440, 380], [140, 380], [140, 300]]); app.advance(0.002); return X._m.V / X._m.I; };
    const ntc = (T) => Rof('ntc', { pos: (T + 20) / 120 });
    return { ldr0: Rof('ldr', { pos: 0 }), ldr1: Rof('ldr', { pos: 1 }), ldr05: Rof('ldr', { pos: 0.5 }), ntc25: ntc(25), ntc50: ntc(50), ntc0: ntc(0),
      ntc50th: 10000 * Math.exp(3950 * (1 / 323.15 - 1 / 298.15)), ntc0th: 10000 * Math.exp(3950 * (1 / 273.15 - 1 / 298.15)) };
  });
  check('ldr_resistance_follows_light', Math.abs(r.ldr0 / 1e6 - 1) < 0.01 && Math.abs(r.ldr1 / 500 - 1) < 0.01 && Math.abs(r.ldr05 / Math.sqrt(1e6 * 500) - 1) < 0.02, r);
  check('ntc_beta_model', Math.abs(r.ntc25 / 10000 - 1) < 0.01 && Math.abs(r.ntc50 / r.ntc50th - 1) < 0.01 && Math.abs(r.ntc0 / r.ntc0th - 1) < 0.01, r);
  r = await page.evaluate(() => {
    const run = (V) => { app.clearAll(); app.pause(); app.addComp('battery', 200, 300, 0, { V }); const Z = app.addComp('buzzer', 400, 300, 0);
      PW([[260, 300], [360, 300]]); PW([[440, 300], [440, 380], [140, 380], [140, 300]]); app.advance(0.01); return !!Z.state.on; };
    return { at5: run(5), at1: run(1) };
  });
  check('buzzer_threshold', r.at5 && !r.at1, r);

  // ---------- 9. UI: readings panel, palette thumbnails, all examples run ----------
  r = await page.evaluate(() => {
    app.loadExample('opinv'); app.pause(); app.advance(0.05);
    app.sel = { comp: app.comps.find(c => c.type === 'opamp') }; app.refreshProps(); app.updateReadings(true);
    const txt = document.getElementById('readings').innerText;
    const types = ['opamp', 'and', 'or', 'not', 'nand', 'nor', 'xor', 'lswitch', 'clock', 'lprobe', 'dff', 'seg7', 'pmos', 'njfet', 'relay', 'buzzer', 'motor', 'ldr', 'ntc', 'xfmr'];
    const missing = [], blank = [];
    for (const t of types) { const el = document.querySelector('#palette .item[data-type="' + t + '"] canvas'); if (!el) { missing.push(t); continue; }
      const d = el.getContext('2d').getImageData(0, 0, el.width, el.height).data; let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i]; if (a < 1000) blank.push(t); }
    const bad = [];
    for (const e of EXAMPLES) { app.loadExample(e.id); app.pause(); app.advance(0.3); app.render(); if (app.warn && e.id !== 'fuse') bad.push(e.id + ':' + app.warn); for (const c of app.comps) for (const k of ['V', 'I']) if (c._m[k] !== undefined && !isFinite(c._m[k])) bad.push(e.id + ':' + c.type + '.' + k); }
    return { txt: txt.slice(0, 120), missing, blank, bad, examples: EXAMPLES.length };
  });
  check('readings_panel_uses_part_readings', /输出电压/.test(r.txt) && /线性区/.test(r.txt), r.txt);
  check('palette_has_new_parts_with_thumbnails', r.missing.length === 0 && r.blank.length === 0, r);
  check('all_examples_run_clean', r.bad.length === 0 && r.examples >= 27, r);

  // ---------- 9b. real UI: click a logic switch, drag the LDR light slider ----------
  const scr = (id, type, k) => page.evaluate(([id, type, k]) => { if (id) { app.loadExample(id); app.fitView(); }
    const c = app.comps.filter(c => c.type === type)[k || 0], v = app.view; return [c.x * v.s + v.ox, c.y * v.s + v.oy]; }, [id, type, k]);
  let pA = await scr('halfadder', 'lswitch', 1);
  await page.evaluate(() => app.run());
  await page.mouse.click(box.x + pA[0] - 5, box.y + pA[1]); await page.waitForTimeout(400);
  r = await page.evaluate(() => { const [PS, PC] = app.comps.filter(c => c.type === 'lprobe'); return { B: app.comps.filter(c => c.type === 'lswitch')[1].props.on, S: PS.state.lv, C: PC.state.lv }; });
  check('ui_click_logic_switch_updates_half_adder', r.B === true && r.S === 0 && r.C === 1, r);
  pA = await scr('comparator', 'ldr');
  await page.evaluate(() => app.run());
  await page.mouse.click(box.x + pA[0], box.y + pA[1]); await page.waitForTimeout(300);
  r = await page.evaluate(async () => {
    const inp = document.querySelector('#props-body input[type=range][data-k="pos"]'); if (!inp) return { noSlider: true };
    const L = app.comps.find(c => c.type === 'led'); await new Promise(r => setTimeout(r, 300)); const before = L._m.bright;
    inp.value = '0.95'; inp.dispatchEvent(new Event('input')); inp.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 600));
    return { before, after: L._m.bright, pos: app.comps.find(c => c.type === 'ldr').props.pos, label: inp.parentElement.querySelector('.rv').textContent };
  });
  check('ui_ldr_slider_switches_comparator', r.before > 0.3 && r.after < 0.01 && r.pos === 0.95 && r.label === '95%', r);
  pA = await scr('sensors', 'ntc');
  await page.mouse.click(box.x + pA[0], box.y + pA[1]); await page.waitForTimeout(300);
  r = await page.evaluate(() => { const l = document.querySelector('#props-body input[type=range][data-k="pos"]'); return l ? l.parentElement.querySelector('.rv').textContent : null; });
  check('ui_ntc_slider_shows_celsius', r === '25 °C', r);
  await page.evaluate(() => app.pause());

  // ---------- 10. old saves (v1 wire format) still load ----------
  r = await page.evaluate(() => {
    const v1 = { comps: [{ id: 1, type: 'battery', x: 200, y: 300, rot: 0, props: { V: 9 } }, { id: 2, type: 'resistor', x: 400, y: 200, rot: 0, props: { R: 90 } },
      { id: 3, type: 'scope', x: 700, y: 300, rot: 0, props: { tdiv: 0.005 } }, { id: 4, type: 'npn', x: 600, y: 500, rot: 0, props: { BF: 50 } }],
      wires: [{ id: 5, x1: 260, y1: 300, x2: 440, y2: 200, bend: 0 }, { id: 6, x1: 360, y1: 200, x2: 140, y2: 300, bend: 1 }] };
    app.load(JSON.stringify(v1)); app.pause(); app.advance(0.05);
    const R = app.comps.find(c => c.type === 'resistor'), O = app.comps.find(c => c.type === 'scope'), Q = app.comps.find(c => c.type === 'npn');
    return { I: R._m.I, mode: O.props.mode, fzoom: O.props.fzoom, vaf: Q.props.VAF, bf: Q.props.BF };
  });
  check('old_v1_save_loads_with_new_defaults', Math.abs(Math.abs(r.I) - 0.1) < 1e-6 && r.mode === 'yt' && r.fzoom === 1 && r.vaf === 100 && r.bf === 50, r);

  // ---------- 11. file:// (double-click) ----------
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const err2 = []; p2.on('pageerror', e => err2.push(e.message));
  await p2.goto('file:///workspace/dcaclab-sim/index.html'); await p2.waitForTimeout(600);
  r = await p2.evaluate(() => { app.loadExample('halfadder'); app.pause(); app.advance(0.02); return { n: EXAMPLES.length, s: app.comps.filter(c => c.type === 'lprobe').map(p => p.state.lv).join('') }; });
  check('file_url_works', err2.length === 0 && r.s === '10', { r, err2 });
  await p2.close();

  check('no_page_errors', errors.length === 0, errors);
  await browser.close();
  const n = Object.keys(results).length;
  console.log(JSON.stringify(results, null, 1));
  console.log('REPORT ' + JSON.stringify(report, null, 1));
  console.log(`\n${n - fails.length}/${n} passed` + (fails.length ? '  FAILED: ' + fails.join(', ') : ''));
  process.exit(fails.length ? 1 : 0);
})();
