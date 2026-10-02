// v2 feature tests: semiconductors, 555, scope, breadboard, junction wiring, multi-bend, jacks, RMS, touch, analysis
const { chromium } = require('playwright-core');
const results = {}; const fails = [];
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
  if (process.env.NOEVENT) await page.evaluate(() => { app.eventLoc = false; });
  await page.evaluate(() => {
    app.pause();
    window.W = (a, b) => app.addWire(a[0], a[1], b[0], b[1], 0);
    window.T = (c, i) => app.termPos(c, i);
  });

  // ---- 1. NPN switch example ----
  let r = await page.evaluate(() => {
    app.loadExample('npn'); app.pause(); app.advance(0.3);
    const L = app.comps.find(c => c.type === 'led'), S = app.comps.find(c => c.type === 'switch'), Q = app.comps.find(c => c.type === 'npn');
    const on = { bright: L._m.bright, Ic: Q._m.I, Ib: Q._m.Ib, Vce: Q._m.V, Vbe: Q._m.Vbe };
    S.props.closed = false; app.dirty = true; app.advance(0.3);
    const off = { bright: L._m.bright, Ic: Q._m.I };
    return { on, off };
  });
  check('npn_switch_on_led_lit', r.on.bright > 0.5 && r.on.Ic > 0.015 && r.on.Vce < 0.3, r.on);
  check('npn_switch_off_led_dark', r.off.bright < 0.01 && Math.abs(r.off.Ic) < 1e-5, r.off);

  // ---- 2. PNP high-side switch ----
  r = await page.evaluate(() => {
    app.clearAll();
    const B = app.addComp('battery', 100, 300, 3, { V: 9 });       // + at top (100,240), - (100,360)
    const Q = app.addComp('pnp', 300, 200, 0);                      // E(280,220) B(300,220) C(320,220)
    const Rc = app.addComp('resistor', 400, 300, 1, { R: 330 });    // (400,260)-(400,340)
    const L = app.addComp('led', 400, 420, 1, { color: 'red' });    // (400,380)-(400,460)
    const Rb = app.addComp('resistor', 300, 320, 1, { R: 10000 });  // (300,280)-(300,360)
    W(T(B, 1), T(Q, 0)); W(T(Q, 2), T(Rc, 0)); W(T(Rc, 1), T(L, 0)); W(T(L, 1), [400, 500]); W([400, 500], T(B, 0));
    W(T(Q, 1), T(Rb, 0));
    const wb = W(T(Rb, 1), [100, 360]); // base to ground -> ON
    app.advance(0.2); const on = { bright: L._m.bright, Ic: Q._m.I, Vbe: Q._m.Vbe };
    // move base resistor return to +9V -> OFF
    wb.pts[wb.pts.length - 1] = [100, 240]; app.normalizeWire(wb); app.dirty = true; app.advance(0.2);
    return { on, off: { bright: L._m.bright, Ic: Q._m.I } };
  });
  check('pnp_high_side_on', r.on.bright > 0.5, r.on);
  check('pnp_high_side_off', r.off.bright < 0.01, r.off);

  // ---- 3. N-MOSFET low-side switch ----
  r = await page.evaluate(() => {
    app.clearAll();
    const B = app.addComp('battery', 100, 300, 3, { V: 9 });
    const M = app.addComp('nmos', 300, 400, 0);                     // G(280,420) D(300,420) S(320,420)
    const Rd = app.addComp('resistor', 300, 200, 1, { R: 330 });    // (300,160)-(300,240)
    const L = app.addComp('led', 360, 300, 1, { color: 'blue' });   // (360,260)-(360,340)
    W(T(B, 1), [100, 160]); W([100, 160], T(Rd, 0)); W(T(Rd, 1), [360, 240]); W([360, 240], T(L, 0));
    W(T(L, 1), [300, 380]); W([300, 380], T(M, 1)); W(T(M, 2), [320, 480]); W([320, 480], [100, 480]); W([100, 480], T(B, 0));
    const wg = W(T(M, 0), [200, 420]); W([200, 420], [100, 160]); // gate to +9
    app.advance(0.1); const on = { bright: L._m.bright, Id: M._m.I, Vgs: M._m.Vgs };
    wg.pts[wg.pts.length - 1] = [200, 480]; app.wires[app.wires.length - 1].pts[0] = [200, 480]; app.wires[app.wires.length - 1].pts = [[200, 480], [100, 480]];
    app.dirty = true; app.advance(0.1);
    return { on, off: { bright: L._m.bright, Id: M._m.I, Vgs: M._m.Vgs } };
  });
  check('nmos_on', r.on.bright > 0.5 && r.on.Vgs > 8, r.on);
  check('nmos_off', r.off.bright < 0.01, r.off);

  // ---- 4. Zener regulator ----
  r = await page.evaluate(() => { app.loadExample('zener'); app.pause(); app.advance(0.3); const V = app.comps.find(c => c.type === 'voltmeter'); return V._m.reading; });
  check('zener_regulates_5V1', r > 5.0 && r < 5.35, r);
  r = await page.evaluate(() => { const B = app.comps.find(c => c.type === 'battery'); B.props.V = 15; app.dirty = true; app.advance(0.2); return app.comps.find(c => c.type === 'voltmeter')._m.reading; });
  check('zener_line_regulation_15V', r > 5.0 && r < 5.45, r);

  // ---- 5. 555 astable blinker ----
  r = await page.evaluate(() => {
    app.loadExample('ne555'); app.pause();
    const R = app.comps.filter(c => c.type === 'resistor'), C = app.comps.find(c => c.type === 'capacitor');
    const U1 = app.comps.find(c => c.type === 'ic555'), L = app.comps.find(c => c.type === 'led');
    const R1 = R[0].props.R, R2 = R[1].props.R, Cv = C.props.C;
    app.advance(2); // warm-up (first cycle is longer: C charges from 0)
    const t0 = app.t, edges = [], highT = []; let prev = L._m.bright > 0.3, onT = 0, total = 0;
    const n = Math.round(6 / app.dt);
    for (let i = 0; i < n; i++) { app.simStep(); const on = L._m.bright > 0.3; if (on && !prev) edges.push(app.t); prev = on; total += app.dt; if (on) onT += app.dt; }
    const periods = edges.slice(1).map((t, i) => t - edges[i]);
    const T = periods.reduce((a, b) => a + b, 0) / periods.length;
    return { R1, R2, C: Cv, expected: 1.44 / ((R1 + 2 * R2) * Cv), measured: 1 / T, counter: U1.state.freq, duty: onT / total, expDuty: (R1 + R2) / (R1 + 2 * R2), edges: edges.length, t0 };
  });
  check('ne555_blink_frequency', Math.abs(r.measured / r.expected - 1) < 0.05, r);
  check('ne555_duty_cycle', Math.abs(r.duty - r.expDuty) < 0.05, { duty: r.duty, exp: r.expDuty });

  // ---- 6. Oscilloscope ----
  r = await page.evaluate(() => {
    app.loadExample('scope'); app.pause(); app.advance(0.4);
    const O = app.comps.find(c => c.type === 'scope'); const S = scopeSamples(O);
    const pp = (a) => Math.max(...a) - Math.min(...a);
    const w = 2 * Math.PI * 50 * 1000 * 3.3e-6;
    // trace spans 10 div * tdiv = 50 ms = 2.5 periods; count rising zero crossings of CH1
    let zc = 0; for (let i = 1; i < S.n; i++) if (S.v1[i - 1] < 0 && S.v1[i] >= 0) zc++;
    return { n: S.n, N: S.N, vpp1: pp(S.v1), vpp2: pp(S.v2), expVpp2: 10 / Math.sqrt(1 + w * w), freq: O.state.freq, zc, startsNearZero: Math.abs(S.v1[0]) < 1 };
  });
  check('scope_sine_ch1_vpp', Math.abs(r.vpp1 - 10) < 0.2, r);
  check('scope_sine_ch2_rc_vpp', Math.abs(r.vpp2 - r.expVpp2) < 0.2, { vpp2: r.vpp2, exp: r.expVpp2 });
  check('scope_frequency_counter', Math.abs(r.freq - 50) < 0.5, r.freq);
  check('scope_triggered_trace', r.n > 250 && r.zc >= 2 && r.startsNearZero, { n: r.n, zc: r.zc });
  r = await page.evaluate(() => {
    app.loadExample('scopesq'); app.pause(); app.advance(0.3);
    const O = app.comps.find(c => c.type === 'scope'); const S = scopeSamples(O);
    const v1 = Array.from(S.v1), v2 = Array.from(S.v2);
    const mid = v1.filter(v => v > 0.05 && v < 7.95).length / v1.length; // square: (almost) only 0 and 8 V samples
    return { min1: Math.min(...v1), max1: Math.max(...v1), mid, min2: Math.min(...v2), max2: Math.max(...v2), freq: O.state.freq };
  });
  check('scope_square_wave', Math.abs(r.max1 - 8) < 0.05 && Math.abs(r.min1) < 0.05 && r.mid < 0.03 && Math.abs(r.freq - 100) < 1, r);
  check('scope_square_rc_charging', r.max2 > 7.5 && r.max2 < 8.01 && r.min2 < 0.5, r);

  // ---- 7. Breadboard connectivity ----
  r = await page.evaluate(() => {
    app.clearAll();
    const BB = app.addComp('breadboard', 400, 300, 0, { cols: 30 }); // x = 100..680; rows: +140 -160 | A 200..280 | B 320..400 | +440 -460
    const B = app.addComp('battery', 400, 620, 0, { V: 9 });        // - (340,620)  + (460,620)
    const R1 = app.addComp('resistor', 300, 180, 1, { R: 1000 });   // (300,140) + rail -> (300,220) strip A col10
    const R2 = app.addComp('resistor', 340, 260, 0, { R: 1000 });   // (300,260) A col10 -> (380,260) A col14
    const R3 = app.addComp('resistor', 300, 320, 1, { R: 1000 });   // (300,280) A col10 -> (300,360) B col10 (across the gap)
    const R4 = app.addComp('resistor', 520, 180, 1, { R: 1000 });   // (520,140) + rail -> (520,220) A col21 (unused column)
    W(T(B, 1), [460, 700]); W([460, 700], [700, 700]);
    app.addWire(700, 700, 100, 140, 1);                              // + to top '+' rail col0 (far left)
    W(T(B, 0), [340, 680]); W([340, 680], [680, 680]); app.addWire(680, 680, 680, 160, 1); // - to top '-' rail col29 (far right)
    W([380, 200], [380, 160]);                                       // jumper A col14 -> '-' rail
    app.advance(0.05);
    const pn = (x, y) => app.pointNode[app.P.findIndex(p => p[0] === x && p[1] === y)];
    return {
      railSame: pn(100, 140) === pn(300, 140) && pn(300, 140) === pn(520, 140),
      railsDistinct: pn(100, 140) !== pn(680, 160),
      stripSame: pn(300, 220) === pn(300, 260) && pn(300, 260) === pn(300, 280),
      gapIsolates: pn(300, 280) !== pn(300, 360),
      colsIsolated: pn(300, 220) !== pn(380, 260) && pn(520, 220) !== pn(300, 220),
      I1: R1._m.I, I2: R2._m.I, I3: R3._m.I, I4: R4._m.I, V1: R1._m.V, V2: R2._m.V, nodes: app.nodeCount,
    };
  });
  check('breadboard_rail_row_connected', r.railSame && r.railsDistinct, r);
  check('breadboard_terminal_strip_connected', r.stripSame, r);
  check('breadboard_center_gap_isolates', r.gapIsolates && Math.abs(r.I3) < 1e-9, r);
  check('breadboard_columns_isolated', r.colsIsolated && Math.abs(r.I4) < 1e-9, r);
  check('breadboard_series_current', Math.abs(Math.abs(r.I1) - 4.5e-3) < 1e-6 && Math.abs(Math.abs(r.V2) - 4.5) < 1e-3, { I1: r.I1, V2: r.V2 });
  r = await page.evaluate(() => { app.loadExample('breadboard'); app.pause(); app.advance(0.2); const L = app.comps.filter(c => c.type === 'led'); const S = app.comps.find(c => c.type === 'switch');
    const on = L.map(l => l._m.bright); S.props.closed = false; app.dirty = true; app.advance(0.1); const off = L.map(l => l._m.bright); return { on, off }; });
  check('breadboard_example_leds', r.on[0] > 0.5 && r.on[1] > 0.5 && r.off[0] < 0.01 && r.off[1] > 0.5, r);

  r = await page.evaluate(() => { app.loadExample('breadboard'); app.pause(); app.advance(0.1); const L = app.comps.filter(c => c.type === 'led');
    const B = app.comps.find(c => c.type === 'breadboard'); app.sel = { comp: B }; app.rotateSel(); app.advance(0.1); return { rot: B.rot, bright: L.map(l => l._m.bright) }; });
  check('breadboard_rotate_carries_parts', r.rot === 1 && r.bright[0] > 0.5 && r.bright[1] > 0.5, r);

  // ---- 8. Junction wiring & multi-bend via real mouse ----
  await page.evaluate(() => {
    app.clearAll(); app.view = { s: 1, ox: 0, oy: 0 };
    const B = app.addComp('battery', 200, 400, 0, { V: 10 });        // - (140,400) + (260,400)
    const R1 = app.addComp('resistor', 500, 300, 1, { R: 100 });     // (500,260)-(500,340)
    app.addComp('resistor', 700, 300, 1, { R: 100 });                // R2 (700,260)-(700,340)
    app.addComp('resistor', 860, 300, 1, { R: 100 });                // R3 (860,260)-(860,340)
    app.wires.push({ id: app.nextId++, pts: [[260, 400], [260, 200], [500, 200], [500, 260]], color: '#d62828', _i: 0, _phase: 0 });
    app.wires.push({ id: app.nextId++, pts: [[500, 340], [500, 480], [140, 480], [140, 400]], color: '#222', _i: 0, _phase: 0 });
    app.dirty = true; app.changed(); app.run();
  });
  const box = await page.locator('#cv').boundingBox();
  const drag = async (p, q, opts = {}) => {
    if (opts.shift) await page.keyboard.down('Shift');
    await page.mouse.move(box.x + p[0], box.y + p[1]); await page.mouse.down();
    await page.mouse.move(box.x + (p[0] + q[0]) / 2, box.y + (p[1] + q[1]) / 2 + 2, { steps: 5 });
    await page.mouse.move(box.x + q[0] + 3, box.y + q[1] + 2, { steps: 5 }); // slightly off: must snap
    await page.mouse.up();
    if (opts.shift) await page.keyboard.up('Shift');
  };
  await drag([700, 260], [400, 200]);   // new wire from R2 top dropped on middle of the red wire -> junction
  await drag([700, 340], [300, 480]);   // R2 bottom onto middle of black wire
  await page.waitForTimeout(400);
  r = await page.evaluate(() => { const R = app.comps.filter(c => c.type === 'resistor'); return { wires: app.wires.length, I1: R[0]._m.I, I2: R[1]._m.I, bat: app.comps[0]._m.I }; });
  check('junction_drop_on_wire_splits', r.wires === 8, r); // 6 before v3; the L-shaped wire also runs exactly over R1's top pin, which v3 auto-joins (+2 pieces, same net)
  check('junction_circuit_conducts', Math.abs(Math.abs(r.I2) - 0.1) < 1e-4 && Math.abs(Math.abs(r.bat) - 0.2) < 1e-4, r);
  // shift+drag from the middle of a wire starts a branch to R3
  await drag([450, 200], [860, 260], { shift: true });
  await page.mouse.click(box.x + 900, box.y + 650); // deselect
  // dragging an existing wire END onto a wire body also makes a junction
  await page.evaluate(() => { const R3 = app.comps[3]; app.wires.push({ id: app.nextId++, pts: [[860, 340], [860, 420], [940, 420]], color: '#1d9bd1', _i: 0, _phase: 0 }); app.dirty = true; app.changed(); });
  if (process.env.DBG) console.log('before end drop', await page.evaluate(() => JSON.stringify(app.wires.map(w => w.pts))));
  await page.mouse.click(box.x + 910, box.y + 420); // select that wire
  if (process.env.DBG) console.log('sel', await page.evaluate(() => JSON.stringify(app.sel && app.sel.wire && app.sel.wire.pts)));
  await drag([940, 420], [220, 480]);             // drag its free end onto the black wire
  await page.waitForTimeout(400);
  if (process.env.DBG) console.log('after end drop', await page.evaluate(() => JSON.stringify(app.wires.map(w => w.pts))));
  r = await page.evaluate(() => { const R = app.comps.filter(c => c.type === 'resistor'); return { wires: app.wires.length, I3: R[2]._m.I, bat: app.comps[0]._m.I }; });
  check('junction_shift_branch_and_end_drop', Math.abs(Math.abs(r.I3) - 0.1) < 1e-4 && Math.abs(Math.abs(r.bat) - 0.3) < 1e-4, r);
  // undo restores previous topology
  r = await page.evaluate(() => { app.undo(); app.advance(0.02); const b1 = app.comps[0]._m.I; app.redo(); app.advance(0.02); return { afterUndo: b1, afterRedo: app.comps[0]._m.I }; });
  check('junction_undo_redo', Math.abs(Math.abs(r.afterUndo) - 0.2) < 1e-4 && Math.abs(Math.abs(r.afterRedo) - 0.3) < 1e-4, r);
  // multi-bend: double-click adds a vertex, drag it, double-click removes it
  const redWireInfo = async () => page.evaluate(() => { const w = app.wires.find(w => w.pts.some(p => p[0] === 260 && p[1] === 400)); return { n: w.pts.length, pts: JSON.stringify(w.pts) }; });
  const before = await redWireInfo();
  await page.mouse.dblclick(box.x + 260, box.y + 300);
  await page.waitForTimeout(100);
  const afterDbl = await redWireInfo();
  await drag([260, 300], [220, 300]); // drag the new vertex (wire is selected)
  const afterDrag = await redWireInfo();
  r = await page.evaluate(() => ({ bat: app.comps[0]._m.I }));
  await page.mouse.dblclick(box.x + 220, box.y + 300);
  const afterDel = await redWireInfo();
  check('multibend_dblclick_adds_vertex', afterDbl.n === before.n + 1, { before, afterDbl });
  check('multibend_vertex_drag', afterDrag.pts.includes('[220,300]') && Math.abs(Math.abs(r.bat) - 0.3) < 1e-4, { afterDrag, bat: r.bat });
  check('multibend_dblclick_removes_vertex', afterDel.n === afterDrag.n - 1, afterDel);
  // segment drag moves a middle segment
  await page.mouse.click(box.x + 900, box.y + 650);
  const segBefore = await page.evaluate(() => JSON.stringify(app.wires.find(w => w.pts.some(p => p[0] === 140 && p[1] === 400)).pts));
  await page.mouse.click(box.x + 200, box.y + 480);
  await drag([200, 480], [200, 540]);
  const segAfter = await page.evaluate(() => JSON.stringify(app.wires.find(w => w.pts.some(p => p[0] === 140 && p[1] === 400)).pts));
  check('multibend_segment_drag', segAfter !== segBefore && segAfter.includes('540'), { segBefore, segAfter });
  await page.screenshot({ path: '/workspace/dcaclab-sim-test/junction.png' });
  r = await page.evaluate(() => { const s = JSON.stringify(app.serialize()); const n = app.wires.length; app.clearAll(); app.load(s); app.advance(0.02); return { n, m: app.wires.length, bat: app.comps[0]._m.I }; });
  check('multibend_save_load', r.n === r.m && Math.abs(Math.abs(r.bat) - 0.3) < 1e-4, r);
  // legacy v1 wire format
  r = await page.evaluate(() => {
    app.load(JSON.stringify({ comps: [{ id: 1, type: 'battery', x: 200, y: 200, rot: 0, props: { V: 9 } }, { id: 2, type: 'resistor', x: 200, y: 360, rot: 0, props: { R: 3 } }],
      wires: [{ id: 3, x1: 140, y1: 200, x2: 160, y2: 360, bend: 1 }, { id: 4, x1: 260, y1: 200, x2: 240, y2: 360, bend: 1 }] }));
    app.advance(0.02); return { I: app.comps.find(c => c.type === 'resistor')._m.I, pts: app.wires[0].pts };
  });
  check('legacy_v1_file_loads', Math.abs(Math.abs(r.I) - 3) < 1e-6, r);

  // ---- 9. Multimeter jacks ----
  r = await page.evaluate(() => {
    const out = {};
    app.clearAll(); app.pause();
    const B = app.addComp('battery', 200, 400, 0, { V: 9 }), R = app.addComp('resistor', 200, 250, 0, { R: 3 });
    W(T(B, 0), T(R, 0)); W(T(B, 1), T(R, 1));
    const M = app.addComp('multimeter', 500, 200, 0, { mode: 'VDC' }); // COM(460,260) VΩ(500,260) A(540,260)
    const wc = W(T(M, 0), T(B, 0)), wv = W(T(M, 1), T(B, 1));
    app.advance(0.05); out.V_on_VOhm = M._m.reading; out.batI_V = B._m.I;
    M.props.mode = 'ADC'; app.dirty = true; app.advance(0.05); out.A_mode_probe_in_VOhm = M._m.reading; out.batI_Aopen = B._m.I;
    // probe moved into A jack while measuring voltage -> dead short -> internal fuse blows
    wv.pts[0] = T(M, 2).slice(); app.normalizeWire(wv); app.dirty = true; app.advance(0.1);
    out.fuseBlown = !!M.state.fuseBlown; out.afterBlowReading = M._m.reading; out.batI_after = B._m.I;
    M.state.fuseBlown = false; app.dirty = true;
    // proper ammeter use: series via COM + A
    app.clearAll();
    const B2 = app.addComp('battery', 200, 400, 0, { V: 9 }), R2 = app.addComp('resistor', 200, 250, 0, { R: 3 });
    const M2 = app.addComp('multimeter', 500, 200, 0, { mode: 'ADC' });
    W(T(B2, 0), T(R2, 0)); W(T(B2, 1), T(M2, 2)); W(T(M2, 0), T(R2, 1));
    app.advance(0.05); out.A_series = M2._m.reading;
    // ohms on VΩ
    app.clearAll();
    const R3 = app.addComp('resistor', 200, 250, 0, { R: 470 }), M3 = app.addComp('multimeter', 500, 200, 0, { mode: 'OHM' });
    W(T(M3, 0), T(R3, 0)); W(T(M3, 1), T(R3, 1)); app.advance(0.02); out.ohm = M3._m.reading;
    M3.props.mode = 'OHM'; app.wires.pop(); app.dirty = true; app.advance(0.02); out.ohmOpen = M3._m.reading;
    return out;
  });
  check('mm_voltage_on_VOhm_jack', Math.abs(r.V_on_VOhm - 9) < 1e-6 && Math.abs(r.batI_V - 3) < 1e-5, r);
  check('mm_A_mode_VOhm_jack_open', r.A_mode_probe_in_VOhm === 0 && Math.abs(r.batI_Aopen - 3) < 1e-5, r);
  check('mm_A_jack_across_source_blows_fuse', r.fuseBlown && r.afterBlowReading === 0, r);
  check('mm_A_jack_series_current_exact', Math.abs(r.A_series - 3) < 1e-6, r.A_series);
  check('mm_ohms_exact', Math.abs(r.ohm - 470) < 1e-5 && !(r.ohmOpen < 2e7), { ohm: r.ohm, open: r.ohmOpen });

  // ---- 10. RMS accuracy at low and normal frequency, exact DC ----
  r = await page.evaluate(() => {
    const out = {};
    for (const f of [0.5, 1, 3, 50, 1000]) {
      app.clearAll(); app.pause();
      const S = app.addComp('ac', 200, 300, 0, { Vp: 10, f }), R = app.addComp('resistor', 200, 150, 0, { R: 100 });
      const V = app.addComp('voltmeter', 500, 300, 0, { mode: 'AC' }), A = app.addComp('ammeter', 500, 150, 0, { mode: 'AC' });
      W(T(S, 0), T(R, 0)); W(T(R, 1), T(A, 1)); W(T(A, 0), T(S, 1)); W(T(V, 0), T(S, 0)); W(T(V, 1), T(S, 1));
      app.advance(Math.max(3 / f, 0.6) + 0.01);
      out['f' + f] = { V: V._m.reading, A: A._m.reading, win: app.acWin };
    }
    app.loadExample('ohm'); app.pause(); app.advance(0.2);
    out.ohmA = app.comps.find(c => c.type === 'ammeter')._m.reading; out.ohmV = app.comps.find(c => c.type === 'voltmeter')._m.reading;
    return out;
  });
  const rmsOk = ['f0.5', 'f1', 'f3', 'f50', 'f1000'].every(k => Math.abs(r[k].V / 7.0710678 - 1) < 0.003 && Math.abs(r[k].A / 0.070710678 - 1) < 0.003);
  check('ac_rms_low_and_high_freq', rmsOk, r);
  check('dc_readings_exact', Math.abs(r.ohmA - 3) < 1e-8 * 1e3 && Math.abs(r.ohmV - 9) < 1e-8, { A: r.ohmA, V: r.ohmV });

  // ---- 11. Touch: pinch zoom, one-finger pan and one-finger component drag ----
  r = await page.evaluate(() => {
    app.loadExample('ohm'); app.pause(); app.view = { s: 1, ox: 0, oy: 0 };
    const cv = document.getElementById('cv'), rc = cv.getBoundingClientRect();
    const ev = (type, id, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: rc.left + x, clientY: rc.top + y, bubbles: true, isPrimary: id === 1, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
    const out = {};
    ev('pointerdown', 1, 900, 600); ev('pointerdown', 2, 1000, 600);
    for (let k = 1; k <= 10; k++) ev('pointermove', 2, 1000 + k * 10, 600);
    ev('pointerup', 2, 1100, 600); ev('pointerup', 1, 900, 600);
    out.pinchScale = app.view.s;
    app.view = { s: 1, ox: 0, oy: 0 };
    ev('pointerdown', 5, 1000, 650); for (let k = 1; k <= 5; k++) ev('pointermove', 5, 1000 + k * 10, 650 + k * 8); ev('pointerup', 5, 1050, 690);
    out.pan = [app.view.ox, app.view.oy];
    app.view = { s: 1, ox: 0, oy: 0 };
    const R = app.comps.find(c => c.type === 'resistor'), x0 = R.x;
    ev('pointerdown', 7, R.x, R.y); for (let k = 1; k <= 6; k++) ev('pointermove', 7, x0 + k * 10, R.y); ev('pointerup', 7, x0 + 60, R.y);
    out.compMoved = R.x - x0;
    return out;
  });
  check('touch_pinch_zoom', Math.abs(r.pinchScale - 2) < 0.05, r);
  check('touch_one_finger_pan', r.pan[0] === 50 && r.pan[1] === 40, r);
  check('touch_drag_component', r.compMoved === 60, r);

  // ---- 12. Kirchhoff analysis panel ----
  await page.evaluate(() => { app.loadExample('parallel'); app.run(); });
  await page.waitForTimeout(300);
  await page.click('#btn-analysis');
  await page.waitForTimeout(600);
  r = await page.evaluate(() => {
    const el = document.getElementById('analysis'); const a = app.analysis();
    return { visible: el && getComputedStyle(el).display !== 'none', rows: el ? el.querySelectorAll('tr').length : 0, maxKcl: Math.max(...a.nodes.map(n => Math.abs(n.kcl))), nodes: a.nodes.length, text: el ? el.innerText.slice(0, 200) : '' };
  });
  check('analysis_panel', r.visible && r.rows > 5 && r.maxKcl < 1e-6, r);
  await page.screenshot({ path: '/workspace/dcaclab-sim-test/analysis.png' });
  await page.click('#btn-analysis');

  // ---- 13. performance of the heaviest examples ----
  r = await page.evaluate(() => {
    const out = {};
    for (const id of ['ne555', 'breadboard', 'npn', 'scope']) { app.loadExample(id); app.pause(); app.advance(0.05); const t0 = performance.now(); app.advance(1); out[id] = +(performance.now() - t0).toFixed(1) + ' ms/sim-s'; }
    return out;
  });
  check('perf_realtime', Object.values(r).every(s => parseFloat(s) < 500), r);

  // ---- 14. file:// protocol ----
  const p2 = await browser.newPage();
  const err2 = []; p2.on('pageerror', e => err2.push(e.message));
  await p2.goto('file:///workspace/dcaclab-sim/index.html'); await p2.waitForTimeout(500);
  r = await p2.evaluate(() => { app.loadExample('ne555'); app.pause(); app.advance(3); return app.comps.find(c => c.type === 'ic555').state.freq; });
  check('file_protocol_555', r > 1.3 && r < 1.6 && err2.length === 0, { freq: r, err2 });

  results.errors = errors;
  check('no_page_errors', errors.length === 0, errors);
  for (const [k, v] of Object.entries(results)) if (k !== 'errors') console.log((v.pass ? 'PASS ' : 'FAIL ') + k + (v.pass && !process.env.V ? '' : '  ' + JSON.stringify(v.info)));
  console.log(fails.length ? 'FAILED: ' + fails.join(', ') : 'ALL ' + Object.keys(results).length + ' CHECKS PASSED');
  await browser.close();
})();
