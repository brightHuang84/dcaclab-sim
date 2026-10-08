// v9 tests: box select / multi-selection, group move / nudge / rotate / copy-paste / delete (one undo step each),
// selection export + named export dialog (sanitising, .json), re-import as merge / replace, wire auto-merge, i18n keys
const { chromium } = require('playwright-core');
const fs = require('fs');
const results = {}; const fails = [];
const check = (name, cond, info) => { results[name] = { pass: !!cond, info }; if (!cond) fails.push(name); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + JSON.stringify(info))); };
const BASE = process.env.URL || 'http://127.0.0.1:8765/index.html';
const OUT = process.env.OUTDIR || '/tmp';
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt-BR'];
// helpers injected into the page
const HELPERS = () => {
  window.PART = () => {               // connectivity partition of all terminals (comp id : terminal) → canonical string
    const T = app._topology(app.comps), g = new Map();
    app.comps.forEach((c, k) => T.cpts[k].forEach((p, i) => { const n = T.pointNode[p]; const key = n === 0 ? 'gnd' : 'r' + T.find(p); if (!g.has(key)) g.set(key, []); g.get(key).push(c.id + ':' + i); }));
    return [...g.values()].map(l => l.sort().join(',')).sort().join(' | ');
  };
  window.READ = () => { app.resetSim(); app.advance(0.02); return app.comps.map(c => c.id + '=' + (c._m.V || 0).toFixed(5) + '/' + (c._m.I || 0).toFixed(6)).sort().join(' '); };
  window.SER = () => JSON.stringify(app.serialize());
  window.BUILD = () => {             // left cluster: battery B + R1 ; right cluster: R2 + bulb L; three wires between the clusters
    app.clearAll(); app.pause();
    const B = app.addComp('battery', 100, 220, 1), R1 = app.addComp('resistor', 260, 100), R2 = app.addComp('resistor', 600, 100), L = app.addComp('bulb', 600, 300, 1);
    const W = (a, b, bend) => app.addWire(a[0], a[1], b[0], b[1], bend || 0);
    const w1 = W(app.termPos(B, 1), app.termPos(R1, 0), 1);            // inside the left cluster
    const w2 = W(app.termPos(R1, 1), app.termPos(R2, 0));               // between clusters
    const w3 = W(app.termPos(R2, 1), app.termPos(L, 0), 0);             // inside the right cluster
    const w4 = W(app.termPos(L, 1), app.termPos(B, 0), 1);              // between clusters (long)
    app.changed(); app.fitView(); app.refreshProps();
    window.__ = { B, R1, R2, L, w1, w2, w3, w4 };
    return [B, R1, R2, L].map(c => c.id).join();
  };
  window.SCR = (wx, wy) => { const r = app.cv.getBoundingClientRect(); return [r.left + app.view.ox + wx * app.view.s, r.top + app.view.oy + wy * app.view.s]; };
  window.SELIDS = () => { const s = app.selItems(); return { c: s.comps.map(c => c.id).sort((a, b) => a - b), w: s.wires.map(w => w.id).sort((a, b) => a - b) }; };
  // independent box rule: window = fully inside; crossing = bounding box / segment touches (boards: only fully inside)
  window.EXPECT = (x0, y0, x1, y1, crossing) => {
    const L = Math.min(x0, x1), T = Math.min(y0, y1), R = Math.max(x0, x1), B = Math.max(y0, y1);
    const inside = (p) => p[0] >= L && p[0] <= R && p[1] >= T && p[1] <= B;
    const segTouch = (a, b) => { for (let k = 0; k <= 200; k++) { const t = k / 200; if (inside([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) return true; } return false; };
    const c = app.comps.filter(o => { const b = app.worldBox(o); const full = b[0] >= L && b[2] <= R && b[1] >= T && b[3] <= B; return crossing && !DEFS[o.type].board ? (b[0] <= R && b[2] >= L && b[1] <= B && b[3] >= T) : full; }).map(o => o.id).sort((a, b) => a - b);
    const w = app.wires.filter(o => crossing ? o.pts.some((p, i) => i < o.pts.length - 1 && segTouch(p, o.pts[i + 1])) : o.pts.every(inside)).map(o => o.id).sort((a, b) => a - b);
    return { c, w };
  };
};
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  const mk = async (locale, url) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, locale, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(locale + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(locale + ' console: ' + m.text()); });
    await page.goto(url || BASE + '?fresh=1'); await page.waitForTimeout(300);
    await page.evaluate(HELPERS);
    return { ctx, page };
  };
  const { ctx, page } = await mk('zh-CN');
  const drag = async (a, b, steps = 8) => { await page.mouse.move(a[0], a[1]); await page.mouse.down(); await page.mouse.move(b[0], b[1], { steps }); await page.mouse.up(); await page.waitForTimeout(80); };

  // ---------- 1. box select (window, left→right) in select mode ----------
  await page.evaluate(() => BUILD());
  await page.keyboard.press('v');
  const r1 = await page.evaluate(() => {
    const b = app.itemsBox([__.B, __.R1], [__.w1]); const rect = [b[0] - 30, b[1] - 30, b[2] + 30, b[3] + 30];
    const empty = !app.compAt(rect[0], rect[1]) && !app.wireHit(rect[0], rect[1]) && !app.pointAt(rect[0], rect[1]);
    return { rect, empty, mode: app.selectMode, a: SCR(rect[0], rect[1]), b: SCR(rect[2], rect[3]), exp: EXPECT(...rect, false) };
  });
  await drag(r1.a, r1.b);
  let got = await page.evaluate(() => SELIDS());
  const ids = await page.evaluate(() => ({ B: __.B.id, R1: __.R1.id, R2: __.R2.id, L: __.L.id, w1: __.w1.id, w2: __.w2.id, w3: __.w3.id, w4: __.w4.id }));
  check('select_mode_toggle_V', r1.mode && r1.empty, r1);
  check('box_window_picks_fully_inside_items', JSON.stringify(got) === JSON.stringify(r1.exp) && JSON.stringify(got.c) === JSON.stringify([ids.B, ids.R1].sort((a, b) => a - b)) && JSON.stringify(got.w) === JSON.stringify([ids.w1]), { got, exp: r1.exp });
  // crossing (right→left): touching wires w2/w4 are picked as well
  const r2 = await page.evaluate(() => { const b = app.itemsBox([__.B, __.R1], [__.w1]); const rect = [b[2] + 30, b[1] - 30, b[0] - 30, b[3] + 30]; return { a: SCR(rect[0], rect[1]), b: SCR(rect[2], rect[3]), exp: EXPECT(...rect, true) }; });
  await drag(r2.a, r2.b);
  got = await page.evaluate(() => SELIDS());
  check('box_crossing_picks_touched_items', JSON.stringify(got) === JSON.stringify(r2.exp) && got.w.includes(ids.w2) && got.w.includes(ids.w4) && !got.c.includes(ids.R2), { got, exp: r2.exp });
  const panelMulti = await page.evaluate(() => document.querySelector('#props-body').textContent);
  check('props_panel_shows_N_items_selected', panelMulti.includes(await page.evaluate(() => _t('sel.n_selected', { n: SELIDS().c.length + SELIDS().w.length }))) && !!(await page.$('#g-rot')) && !!(await page.$('#g-export')), panelMulti.slice(0, 120));
  // click on empty space in select mode clears; Esc clears; Ctrl+A selects all
  await page.keyboard.press('Escape'); check('esc_clears_selection', await page.evaluate(() => app.sel === null));
  await page.keyboard.press('Control+a'); got = await page.evaluate(() => SELIDS());
  check('ctrl_a_selects_all', got.c.length === 4 && got.w.length === 4, got);
  await page.keyboard.press('v');   // back to normal mode
  // normal mode: plain drag on empty space pans, Shift+drag box-selects, Ctrl+click toggles
  await page.keyboard.press('Escape');
  const pan = await page.evaluate(() => { const r = app.cv.getBoundingClientRect(); const a = [r.left + 40, r.bottom - 70], w = app.toWorld(40, r.height - 70); return { ox: app.view.ox, a, b: [a[0] + 120, a[1] - 50], mode: app.selectMode, empty: !app.compAt(w[0], w[1]) && !app.wireHit(w[0], w[1]) && !app.pointAt(w[0], w[1], true) }; });
  await drag(pan.a, pan.b);
  const pan2 = await page.evaluate(() => ({ ox: app.view.ox, sel: app.sel }));
  check('normal_mode_drag_empty_pans', !pan.mode && pan.empty && Math.abs(pan2.ox - pan.ox - (pan.b[0] - pan.a[0])) < 2 && pan2.sel === null, { pan, pan2 });
  const r3 = await page.evaluate(() => { const b = app.itemsBox([__.R2, __.L], [__.w3]); const rect = [b[0] - 30, b[1] - 30, b[2] + 30, b[3] + 30]; return { a: SCR(rect[0], rect[1]), b: SCR(rect[2], rect[3]), exp: EXPECT(...rect, false) }; });
  await page.keyboard.down('Shift'); await drag(r3.a, r3.b); await page.keyboard.up('Shift');
  got = await page.evaluate(() => SELIDS());
  check('shift_drag_box_select_in_normal_mode', JSON.stringify(got) === JSON.stringify(r3.exp) && got.c.length === 2, { got, exp: r3.exp });
  const pR1 = await page.evaluate(() => SCR(__.R1.x, __.R1.y));
  await page.keyboard.down('Control'); await page.mouse.click(pR1[0], pR1[1]); await page.keyboard.up('Control');
  got = await page.evaluate(() => SELIDS());
  const addOk = got.c.includes(ids.R1) && got.c.length === 3;
  await page.keyboard.down('Control'); await page.mouse.click(pR1[0], pR1[1]); await page.keyboard.up('Control');
  got = await page.evaluate(() => SELIDS());
  check('ctrl_click_adds_and_removes', addOk && !got.c.includes(ids.R1) && got.c.length === 2, got);
  const pW2 = await page.evaluate(() => { const P = __.w2.pts; return SCR((P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2); });
  await page.keyboard.down('Control'); await page.mouse.click(pW2[0], pW2[1]); await page.keyboard.up('Control');
  got = await page.evaluate(() => SELIDS());
  check('ctrl_click_toggles_wire', got.w.includes(ids.w2), got);

  // ---------- 2. group move by dragging a selected part: connectivity & readings unchanged, one undo step ----------
  await page.evaluate(() => { app.setSelection([__.B, __.R1], [__.w1]); });
  const before = await page.evaluate(() => ({ part: PART(), read: READ(), ser: SER(), h: app.hIdx, B: [__.B.x, __.B.y], R1: [__.R1.x, __.R1.y], R2: [__.R2.x, __.R2.y], s: app.view.s }));
  const a0 = await page.evaluate(() => SCR(__.R1.x, __.R1.y));
  await drag(a0, [a0[0] + 60 * before.s, a0[1] + 40 * before.s], 10);
  const after = await page.evaluate(() => ({ part: PART(), read: READ(), h: app.hIdx, B: [__.B.x, __.B.y], R1: [__.R1.x, __.R1.y], R2: [__.R2.x, __.R2.y], multi: !!(app.sel && app.sel.multi), w2end: JSON.stringify(app.wEnd(__.w2, 1)) === JSON.stringify(app.termPos(__.R1, 1)), w4end: JSON.stringify(app.wEnd(__.w4, 2)) === JSON.stringify(app.termPos(__.B, 0)) }));
  check('group_drag_moves_selected_parts', after.B[0] - before.B[0] === 60 && after.B[1] - before.B[1] === 40 && after.R1[0] - before.R1[0] === 60 && after.R2[0] === before.R2[0] && after.multi, { before, after });
  check('group_drag_keeps_connectivity', after.part === before.part && after.w2end && after.w4end, { b: before.part, a: after.part });
  check('group_drag_keeps_readings', after.read === before.read, { b: before.read, a: after.read });
  check('group_drag_is_one_undo_step', after.h === before.h + 1, { b: before.h, a: after.h });
  await page.keyboard.press('Control+z');
  const und = await page.evaluate(() => ({ ser: SER(), sel: SELIDS() }));
  check('undo_restores_exactly_and_keeps_selection', und.ser === before.ser && und.sel.c.length === 2, und.sel);
  await page.keyboard.press('Control+y');
  const red = await page.evaluate(() => { const B = app.comps.find(c => c.type === 'battery'); return [B.x, B.y, PART()]; });
  check('redo_reapplies_group_move', red[0] === after.B[0] && red[1] === after.B[1] && red[2] === before.part, red);

  // ---------- 3. arrow-key nudge, rotate group ----------
  await page.evaluate(() => { const B = app.comps.find(c => c.type === 'battery'), R1 = app.comps.find(c => c.type === 'resistor' && c.x < 500); app.setSelection([B, R1], []); window.__n = { B, R1 }; });
  const n0 = await page.evaluate(() => ({ x: __n.B.x, y: __n.B.y, h: app.hIdx, part: PART() }));
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowDown');
  const n1 = await page.evaluate(() => ({ x: __n.B.x, y: __n.B.y, h: app.hIdx, part: PART() }));
  check('arrow_keys_nudge_group', n1.x === n0.x + 20 && n1.y === n0.y + 100 && n1.h === n0.h + 2 && n1.part === n0.part, { n0, n1 });
  const ro0 = await page.evaluate(() => ({ part: PART(), read: READ(), rot: __n.B.rot, h: app.hIdx }));
  await page.keyboard.press('r');
  const ro1 = await page.evaluate(() => ({ part: PART(), read: READ(), rot: __n.B.rot, r1: __n.R1.rot, h: app.hIdx, onGrid: app.comps.every(c => c.x % 20 === 0 && c.y % 20 === 0) }));
  check('rotate_group_around_center', ro1.rot === (ro0.rot + 1) % 4 && ro1.r1 === 1 && ro1.onGrid && ro1.h === ro0.h + 1, { ro0, ro1 });
  check('rotate_group_keeps_connectivity_and_readings', ro1.part === ro0.part && ro1.read === ro0.read, { ro0, ro1 });

  // ---------- 4. copy / paste / duplicate / delete ----------
  await page.evaluate(() => BUILD());
  await page.evaluate(() => app.setSelection([__.B, __.R1], []));     // parts only: the internal wire w1 is copied too
  const cp0 = await page.evaluate(() => ({ nc: app.comps.length, nw: app.wires.length, h: app.hIdx, part: PART() }));
  await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v');
  const cp1 = await page.evaluate(() => {
    const s = app.selItems(), oldIds = new Set([__.B.id, __.R1.id, __.R2.id, __.L.id]);
    const occ = new Set(); for (const c of app.comps) if (oldIds.has(c.id)) DEFS[c.type].terms.forEach((_, i) => occ.add(app.termPos(c, i).join()));
    const newPins = s.comps.flatMap(c => DEFS[c.type].terms.map((_, i) => app.termPos(c, i).join()));
    const w = s.wires[0], ends = w ? [app.wEnd(w, 1).join(), app.wEnd(w, 2).join()] : [];
    return { nc: app.comps.length, nw: app.wires.length, h: app.hIdx, sc: s.comps.map(c => c.type).sort().join(), sw: s.wires.length, fresh: s.comps.every(c => !oldIds.has(c.id)), separate: newPins.every(p => !occ.has(p)), wireOnNewPins: ends.every(e => newPins.includes(e)) };
  });
  check('copy_paste_includes_internal_wires', cp1.nc === cp0.nc + 2 && cp1.nw === cp0.nw + 1 && cp1.sc === 'battery,resistor' && cp1.sw === 1 && cp1.wireOnNewPins, cp1);
  check('paste_selects_new_items_not_connected_to_original', cp1.fresh && cp1.separate && cp1.h === cp0.h + 1, cp1);
  await page.keyboard.press('Control+z');
  check('undo_paste_one_step', await page.evaluate((n) => app.comps.length === n.nc && app.wires.length === n.nw, cp0));
  await page.evaluate((ids) => { const byId = (id) => app.comps.find(c => c.id === id) || app.wires.find(w => w.id === id); app.setSelection([byId(ids.R2), byId(ids.L)], [byId(ids.w3)]); }, await page.evaluate(() => ({ R2: __.R2.id, L: __.L.id, w3: __.w3.id })));
  await page.keyboard.press('Control+d');
  const dup = await page.evaluate(() => ({ nc: app.comps.length, nw: app.wires.length, sel: app.selItems().comps.length }));
  check('ctrl_d_duplicates_group', dup.nc === cp0.nc + 2 && dup.nw === cp0.nw + 1 && dup.sel === 2, dup);
  await page.keyboard.press('Delete');
  const del = await page.evaluate(() => ({ nc: app.comps.length, nw: app.wires.length, sel: app.sel }));
  check('delete_group', del.nc === cp0.nc && del.nw === cp0.nw && del.sel === null, del);
  await page.keyboard.press('Control+z');
  check('undo_delete_group_one_step', await page.evaluate((n) => app.comps.length === n.nc + 2 && app.wires.length === n.nw + 1, cp0));

  // ---------- 5. breadboard: a selected board carries the parts plugged into it ----------
  const bb = await page.evaluate(() => {
    app.loadExample('breadboard'); app.pause();
    const board = app.comps.find(c => DEFS[c.type].board), plugged = app.carriedBy([board]);
    const other = app.comps.find(c => !DEFS[c.type].board && !plugged.includes(c));
    const p0 = PART(), xs = plugged.map(c => c.x);
    app.setSelection([board].concat(other ? [other] : []), []); app.moveSelection(40, 0);
    return { n: plugged.length, moved: plugged.every((c, i) => c.x === xs[i] + 40), same: PART() === p0 };
  });
  check('group_with_breadboard_carries_plugged_parts', bb.n > 0 && bb.moved && bb.same, bb);

  // ---------- 6. export dialog: selection only, file name sanitised + .json ----------
  await page.evaluate(() => BUILD());
  await page.evaluate(() => app.setSelection([__.B, __.R1], [__.w1]));
  await page.click('#btn-export'); await page.waitForSelector('#dlg-ok');
  const dlg0 = await page.evaluate(() => ({ scope: document.querySelector('input[name=exp-scope]:checked').value, name: document.querySelector('#exp-name').value }));
  check('export_dialog_defaults_to_selection_when_multi', dlg0.scope === 'sel' && /^circuit-\d{8}-\d{4}$/.test(dlg0.name), dlg0);
  await page.fill('#exp-name', 'My Amp: v1/test?*');
  const prev = await page.textContent('#exp-prev');
  await page.screenshot({ path: OUT + '/t10-export-dialog.png' });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dlg-ok')]);
  const selFile = OUT + '/t10-selection.json'; await dl.saveAs(selFile);
  const exp = JSON.parse(fs.readFileSync(selFile, 'utf8'));
  check('filename_sanitized_with_json', dl.suggestedFilename() === 'My Amp_ v1_test_.json' && prev === 'My Amp_ v1_test_.json', { f: dl.suggestedFilename(), prev });
  const expChk = await page.evaluate((exp) => {
    const minX = Math.min(...exp.comps.map(c => { const b = app.worldBox(Object.assign({ state: {}, _m: {} }, c)); return b[0]; }), ...exp.wires.flatMap(w => w.pts.map(p => p[0])));
    const minY = Math.min(...exp.comps.map(c => { const b = app.worldBox(Object.assign({ state: {}, _m: {} }, c)); return b[1]; }), ...exp.wires.flatMap(w => w.pts.map(p => p[1])));
    // expected wires: both ends on terminals of the selected parts
    const pins = new Set(); for (const c of [__.B, __.R1]) DEFS[c.type].terms.forEach((_, i) => pins.add(app.termPos(c, i).join()));
    const expW = app.wires.filter(w => pins.has(app.wEnd(w, 1).join()) && pins.has(app.wEnd(w, 2).join())).length;
    return { kind: exp.kind, title: exp.title, types: exp.comps.map(c => c.type).sort().join(), nw: exp.wires.length, expW, minX, minY, props: exp.comps.find(c => c.type === 'resistor').props.R === __.R1.props.R };
  }, exp);
  check('export_selection_json_content', expChk.kind === 'selection' && expChk.types === 'battery,resistor' && expChk.nw === expChk.expW && expChk.nw === 1 && expChk.props && expChk.title === 'My Amp_ v1_test_', expChk);
  check('export_selection_positions_normalized', expChk.minX >= 0 && expChk.minX < 20 && expChk.minY >= 0 && expChk.minY < 20, expChk);
  // whole-circuit export with a typed name: becomes the circuit title (kept in saves / autosave)
  await page.evaluate(() => app.clearSelection());
  await page.click('#btn-export'); await page.waitForSelector('#dlg-ok');
  const selDisabled = await page.evaluate(() => document.querySelector('input[name=exp-scope][value=sel]').disabled && document.querySelector('input[name=exp-scope]:checked').value === 'all');
  await page.fill('#exp-name', '  Lab 1.json  ');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  const allFile = OUT + '/t10-all.json'; await dl2.saveAs(allFile);
  const all = JSON.parse(fs.readFileSync(allFile, 'utf8'));
  const ttl = await page.evaluate(() => ({ title: app.title, auto: JSON.parse(localStorage.getItem('dcaclab-sim-autosave')).title }));
  check('export_all_named_sets_title', dl2.suggestedFilename() === 'Lab 1.json' && all.title === 'Lab 1' && all.comps.length === 4 && ttl.title === 'Lab 1' && ttl.auto === 'Lab 1' && selDisabled, { f: dl2.suggestedFilename(), ttl, selDisabled });
  const san = await page.evaluate(() => [app.sanitizeFileName('a<b>c'), app.sanitizeFileName('CON'), app.sanitizeFileName('...'), app.sanitizeFileName('x'.repeat(150)).length, app.sanitizeFileName('电路 草稿'), app.sanitizeFileName('dir\\file|name'), app.sanitizeFileName('test.JSON')]);
  check('sanitize_cases', san[0] === 'a_b_c.json' && san[1] === 'CON_.json' && /^circuit-\d{8}-\d{4}\.json$/.test(san[2]) && san[3] === 105 && san[4] === '电路 草稿.json' && san[5] === 'dir_file_name.json' && san[6] === 'test.json', san);
  // cancel / Esc closes without download
  await page.click('#btn-export'); await page.waitForSelector('#dlg-ok'); await page.keyboard.press('Escape');
  check('export_dialog_escape_cancels', await page.evaluate(() => !document.querySelector('#dlg .dlg')));

  // ---------- 7. re-import the selection: merge (inserted as a selected group) and replace ----------
  const m0 = await page.evaluate(() => ({ nc: app.comps.length, nw: app.wires.length, h: app.hIdx }));
  await page.setInputFiles('#file-in', selFile); await page.waitForSelector('#imp-merge');
  await page.click('#imp-merge'); await page.waitForTimeout(150);
  const m1 = await page.evaluate(() => {
    const s = app.selItems(); const T = app._topology(app.comps);
    const sub = new Set(s.comps); const nodesOf = (c) => T.cpts[app.comps.indexOf(c)].map(p => T.find(p));
    const ext = app.comps.filter(c => !sub.has(c)).flatMap(nodesOf);
    const isolated = s.comps.flatMap(nodesOf).every(n => !ext.includes(n));
    const R = s.comps.find(c => c.type === 'resistor'), B = s.comps.find(c => c.type === 'battery');
    const linked = R && B && T.find(T.cpts[app.comps.indexOf(R)][0]) === T.find(T.cpts[app.comps.indexOf(B)][1]);
    return { nc: app.comps.length, nw: app.wires.length, sel: s.comps.length + s.wires.length, isolated, linked, h: app.hIdx };
  });
  check('import_merge_inserts_selected_group', m1.nc === m0.nc + 2 && m1.nw === m0.nw + 1 && m1.sel === 3 && m1.isolated && m1.linked && m1.h === m0.h + 1, { m0, m1 });
  // the inserted group can be dragged into place as one
  const mv = await page.evaluate(() => { const s = app.selItems(); const R = s.comps.find(c => c.type === 'resistor'); return { a: SCR(R.x, R.y), x: R.x, s: app.view.s }; });
  await drag(mv.a, [mv.a[0] + 40 * mv.s, mv.a[1]]);
  check('inserted_group_draggable', await page.evaluate((x) => { const s = app.selItems(); return s.comps.length === 2 && s.comps.find(c => c.type === 'resistor').x === x + 40; }, mv.x));
  await page.setInputFiles('#file-in', selFile); await page.waitForSelector('#imp-replace');
  await page.click('#imp-replace'); await page.waitForTimeout(150);
  const rp = await page.evaluate(() => { app.run(); app.advance(0.02); app.pause(); return { nc: app.comps.length, nw: app.wires.length, title: app.title, warn: app.warn }; });
  check('import_replace_loads_selection_file', rp.nc === 2 && rp.nw === 1 && rp.title === 'My Amp_ v1_test_' && !rp.warn, rp);
  // importing into an empty canvas does not ask
  await page.evaluate(() => app.clearAll());
  await page.setInputFiles('#file-in', allFile); await page.waitForTimeout(300);
  check('import_into_empty_canvas_no_dialog', await page.evaluate(() => !document.querySelector('#dlg .dlg') && app.comps.length === 4 && app.title === 'Lab 1'));

  // ---------- 8. wire auto-merge ----------
  const am = await page.evaluate(() => {
    const o = {};
    app.clearAll(); app.pause();
    const B = app.addComp('battery', 0, 0), R = app.addComp('resistor', 400, 0), Am = app.addComp('ammeter', 200, 200);
    const a = app.termPos(B, 1), b = app.termPos(R, 0);
    app.addWire(a[0], a[1], a[0] + 60, a[1]); app.addWire(a[0] + 60, a[1], a[0] + 60, a[1] - 80); app.addWire(a[0] + 60, a[1] - 80, b[0], b[1]);
    const c = app.termPos(R, 1), d = app.termPos(Am, 1), e = app.termPos(Am, 0), f = app.termPos(B, 0);
    app.addWire(c[0], c[1], d[0], d[1]); app.addWire(e[0], e[1], f[0], f[1]);
    o.n0 = app.wires.length; app.resetSim(); app.advance(0.02); o.read0 = Am._m.reading;
    app.changed();                                       // any edit runs the merge (same undo step)
    o.n1 = app.wires.length; app.resetSim(); app.advance(0.02); o.read1 = Am._m.reading;
    const W = app.wires.find(w => JSON.stringify(app.wEnd(w, 1)) === JSON.stringify(a) || JSON.stringify(app.wEnd(w, 2)) === JSON.stringify(a));
    o.pts = W && W.pts.length; o.ends = W && [app.wEnd(W, 1).join(), app.wEnd(W, 2).join()].sort().join(' ') === [a.join(), b.join()].sort().join(' ');
    // collinear chain: the junction vertex disappears completely
    app.clearAll(); app.addWire(0, 400, 100, 400); app.addWire(100, 400, 200, 400); app.changed(); o.coll = app.wires.length === 1 && app.wires[0].pts.length === 2;
    return o;
  });
  check('wire_chain_of_3_merges_into_1', am.n0 === 5 && am.n1 === 3 && am.ends && am.pts >= 3 && am.coll, am);
  check('wire_merge_keeps_readings', Math.abs(am.read0 - am.read1) < 1e-9 && Math.abs(am.read0) > 1e-3, am);
  const tj = await page.evaluate(() => {
    app.clearAll(); app.pause();
    const B = app.addComp('battery', 0, 0), R1 = app.addComp('resistor', 300, -100), R2 = app.addComp('resistor', 300, 100);
    const p = app.termPos(B, 1), q1 = app.termPos(R1, 0), q2 = app.termPos(R2, 0), j = [p[0] + 80, p[1]];
    app.addWire(p[0], p[1], j[0], j[1]); app.addWire(j[0], j[1], q1[0], q1[1], 1); const br = app.addWire(j[0], j[1], q2[0], q2[1], 1);
    app.changed(); const n3 = app.wires.length;
    app.sel = { wire: br }; app.deleteSel(); const n1 = app.wires.length;
    const h = app.hIdx; app.undo(); const nu = app.wires.length; app.redo(); const nr = app.wires.length;
    // a junction on a terminal is never merged
    app.clearAll(); const R3 = app.addComp('resistor', 0, 300); const t = app.termPos(R3, 1);
    app.addWire(t[0], t[1], t[0] + 60, t[1]); app.addWire(t[0], t[1], t[0], t[1] + 60); app.changed(); const onTerm = app.wires.length;
    return { n3, n1, nu, nr, onTerm, h };
  });
  check('t_junction_stays_3_wires', tj.n3 === 3 && tj.nu === 3, tj);
  check('deleting_t_branch_remerges_into_1', tj.n1 === 1 && tj.nr === 1, tj);
  check('no_merge_at_terminal', tj.onTerm === 2, tj);
  // drawing with the mouse: drop a wire end on the middle of a wire (split → junction kept), then delete that branch
  const sp0 = await page.evaluate(() => {
    app.clearAll(); app.pause();
    const B = app.addComp('battery', 0, 0), R = app.addComp('resistor', 400, 0), R2 = app.addComp('resistor', 240, 200, 1);
    const a = app.termPos(B, 1), b = app.termPos(R, 0); app.addWire(a[0], a[1], b[0], b[1]); app.changed(); app.fitView();
    const t = app.termPos(R2, 0); window.__sp = { R2 };
    return { n: app.wires.length, from: SCR(t[0], t[1]), to: SCR(240, a[1]) };
  });
  await drag(sp0.from, sp0.to, 12);
  const sp1 = await page.evaluate(() => ({ n: app.wires.length, junction: app.wires.filter(w => [1, 2].some(e => app.wEnd(w, e).join() === '240,0')).length }));
  check('drop_on_wire_middle_splits_into_junction', sp0.n === 1 && sp1.n === 3 && sp1.junction === 3, { sp0, sp1 });
  await page.evaluate(() => { const br = app.wires.find(w => [1, 2].some(e => app.wEnd(w, e).join() === app.termPos(__sp.R2, 0).join())); app.sel = { wire: br }; app.deleteSel(); });
  check('delete_branch_after_split_remerges', await page.evaluate(() => app.wires.length === 1 && app.wires[0].pts.length === 2));
  // old saved file (v1 wires as x1/y1/x2/y2 and an unmerged chain) normalises on load
  const old = await page.evaluate(() => {
    const data = { app: 'dcaclab-sim', version: 1, comps: [{ id: 1, type: 'battery', x: 0, y: 0, rot: 0, props: {} }, { id: 2, type: 'resistor', x: 300, y: 0, rot: 0, props: {} }],
      wires: [{ id: 3, x1: 60, y1: 0, x2: 120, y2: -60 }, { id: 4, x1: 120, y1: -60, x2: 200, y2: -60 }, { id: 5, x1: 200, y1: -60, x2: 260, y2: 0 }, { id: 6, x1: 340, y1: 0, x2: 340, y2: 100 }, { id: 7, x1: 340, y1: 100, x2: -60, y2: 100 }, { id: 8, x1: -60, y1: 100, x2: -60, y2: 0 }] };
    app.load(data); app.resetSim(); app.advance(0.02);
    const B = app.comps.find(c => c.type === 'battery'), R = app.comps.find(c => c.type === 'resistor');
    return { n: app.wires.length, I: R._m.I, exp: B.props.V / (R.props.R + (B.props.r || 0)) };
  });
  check('old_saved_file_normalizes_on_load', old.n === 2 && Math.abs(Math.abs(old.I) - old.exp) < 1e-6 * old.exp, old);
  await page.evaluate(() => app.loadExample('reg7805'));
  check('examples_load_merged_without_warnings', await page.evaluate(() => { app.run(); app.advance(0.2); app.pause(); return !app.warn && app.comps.length > 0; }));

  // ---------- 9. space + drag pans, a space tap toggles run; touch long-press box select ----------
  await page.evaluate(() => { BUILD(); app.pause(); });
  const sp = await page.evaluate(() => ({ ox: app.view.ox, a: SCR(__.R1.x, __.R1.y), x: __.R1.x }));
  await page.keyboard.down(' '); await drag(sp.a, [sp.a[0] + 80, sp.a[1]]); await page.keyboard.up(' ');
  const spd = await page.evaluate(() => ({ ox: app.view.ox, x: __.R1.x, running: app.running }));
  check('space_drag_pans_without_toggling_run', Math.abs(spd.ox - sp.ox - 80) < 2 && spd.x === sp.x && !spd.running, { sp, spd });
  await page.keyboard.press(' '); const tap = await page.evaluate(() => app.running); await page.keyboard.press(' ');
  check('space_tap_still_toggles_run', tap && !(await page.evaluate(() => app.running)));
  await page.evaluate(() => app.setSelectMode(true));
  const lp = await page.evaluate(async () => {
    const b = app.itemsBox([__.R2, __.L], [__.w3]), r = app.cv.getBoundingClientRect();
    const A = SCR(b[0] - 30, b[1] - 30), Bp = SCR(b[2] + 30, b[3] + 30);
    const ev = (type, x, y) => app.cv.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, button: 0, buttons: 1 }));
    ev('pointerdown', A[0], A[1]); await new Promise(res => setTimeout(res, 600));
    const kind = app.drag && app.drag.kind;
    ev('pointermove', (A[0] + Bp[0]) / 2, (A[1] + Bp[1]) / 2); ev('pointermove', Bp[0], Bp[1]); ev('pointerup', Bp[0], Bp[1]);
    void r; return { kind, sel: SELIDS(), exp: EXPECT(b[0] - 30, b[1] - 30, b[2] + 30, b[3] + 30, false) };
  });
  check('touch_long_press_drag_box_selects', lp.kind === 'box' && JSON.stringify(lp.sel) === JSON.stringify(lp.exp) && lp.sel.c.length === 2, lp);
  await page.evaluate(() => app.setSelectMode(false));

  // ---------- 10. i18n: every new key in all 10 locales; non-Chinese UI shows no Chinese ----------
  const NEWK = ['h.select', 'h.select_title', 'sel.n_selected', 'sel.hint', 'sel.help1', 'sel.help2', 'sel.help3', 'sel.bulk', 'exp.title', 'exp.all', 'exp.sel', 'exp.name', 'exp.will_save', 'exp.ok', 'exp.cancel', 'exp.count', 'imp.title', 'imp.question', 'imp.replace', 'imp.merge', 'imp.merged', 'sel.copied', 'sel.pasted'];
  const keysOk = await page.evaluate(({ NEWK, LANGS }) => {
    const all = Object.keys(I18N.dicts['zh-CN']).filter(k => /^(sel|exp|imp)\./.test(k) || /^h\.select/.test(k));
    const miss = []; for (const L of LANGS) for (const k of all.concat(NEWK)) if (!I18N.dicts[L] || !I18N.dicts[L][k]) miss.push(L + ':' + k);
    return { n: all.length, miss };
  }, { NEWK, LANGS });
  check('i18n_new_keys_in_all_locales', keysOk.n >= NEWK.length && keysOk.miss.length === 0, keysOk);
  await ctx.close();
  const i18n = {};
  for (const L of ['en', 'ja', 'de', 'ru', 'pt-BR']) {
    const { ctx: c2, page: p2 } = await mk(L, BASE + '?fresh=1&lang=' + L);
    i18n[L] = await p2.evaluate(() => {
      BUILD(); app.setSelection([__.B, __.R1, __.R2], [__.w1]); app.refreshProps();
      const tb = document.querySelector('#toolbar').cloneNode(true); tb.querySelector('#sel-lang').remove();
      let txt = document.querySelector('#props').textContent + tb.textContent + document.querySelector('#btn-select').title;
      app.openExportDialog(); txt += document.querySelector('#dlg').textContent; app.closeDialog();
      app.importData(app.serializeSubset([__.B], []).data, 'x.json'); txt += document.querySelector('#dlg').textContent; app.closeDialog();
      app.sel = null; app.refreshProps(); txt += document.querySelector('#props').textContent;
      app.setSelectMode(true); app.updateHud(); txt += document.querySelector('#hud').textContent;
      const R = [__.R1, __.R2]; app.setSelection(R, []); txt += document.querySelector('#props').textContent;   // bulk edit (same type)
      return { han: (txt.match(/[\u4e00-\u9fff]/g) || []).join(''), rawKey: /\b(sel|exp|imp)\.[a-z_]+/.test(txt), bulk: !!document.querySelector('.bulk') };
    });
    await c2.close();
  }
  check('i18n_new_ui_no_chinese_or_raw_keys', Object.entries(i18n).every(([L, r]) => (L === 'ja' || !r.han) && !r.rawKey && r.bulk), i18n);

  check('no_page_errors', errors.length === 0, errors.slice(0, 5));
  const n = Object.keys(results).length;
  console.log(fails.length ? `${fails.length}/${n} FAILED: ${fails.join(', ')}` : `ALL ${n} PASSED`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
