const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, locale: 'zh-CN', acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html?example=ohm&run=1');
  await page.waitForTimeout(800);
  const R = {};
  const box = await page.locator('#cv').boundingBox();
  const scr = async (wx, wy) => page.evaluate(([wx, wy]) => [wx * app.view.s + app.view.ox, wy * app.view.s + app.view.oy], [wx, wy]).then(([x, y]) => [box.x + x, box.y + y]);
  const reading = (type) => page.evaluate((t) => app.comps.find(c => c.type === t)._m.reading, type);
  R.initialAmp = await reading('ammeter');
  // click resistor body
  const res = await page.evaluate(() => { const c = app.comps.find(c => c.type === 'resistor'); return [c.x, c.y]; });
  let [x, y] = await scr(res[0], res[1]); await page.mouse.click(x, y);
  R.panelTitle = await page.locator('#props-body .pt').innerText();
  await page.fill('#props-body input[data-k="R"]', '6'); await page.press('#props-body input[data-k="R"]', 'Enter');
  await page.waitForTimeout(500);
  R.ampAt6ohm = await reading('ammeter');
  await page.keyboard.press('r'); await page.waitForTimeout(500);
  R.afterRotate = { rot: await page.evaluate(() => app.comps.find(c => c.type === 'resistor').rot), amp: await reading('ammeter') };
  await page.keyboard.press('Control+z'); await page.waitForTimeout(200);
  R.afterUndoRot = await page.evaluate(() => app.comps.find(c => c.type === 'resistor').rot);
  [x, y] = await scr(res[0], res[1]); await page.mouse.click(x, y);
  await page.keyboard.press('Delete'); await page.waitForTimeout(400);
  R.afterDelete = { n: await page.evaluate(() => app.comps.length), amp: await reading('ammeter') };
  await page.keyboard.press('Control+z'); await page.waitForTimeout(500);
  R.afterUndoDel = { n: await page.evaluate(() => app.comps.length), amp: await reading('ammeter') };
  // toggle switch by click -> open
  const sw = await page.evaluate(() => { const c = app.comps.find(c => c.type === 'switch'); return [c.x, c.y]; });
  [x, y] = await scr(sw[0] + 10, sw[1] - 4); await page.mouse.click(x, y); await page.waitForTimeout(400);
  R.switchOpened = { closed: await page.evaluate(() => app.comps.find(c => c.type === 'switch').props.closed), amp: await reading('ammeter') };
  // new wire from voltmeter terminal to empty grid point (dangling) then undo
  const nW = await page.evaluate(() => app.wires.length);
  const vt = await page.evaluate(() => app.termPos(app.comps.find(c => c.type === 'voltmeter'), 1));
  [x, y] = await scr(vt[0], vt[1]); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 60, y - 5, { steps: 5 }); await page.mouse.move(x + 80, y - 40, { steps: 5 }); await page.mouse.up();
  R.wireAdded = (await page.evaluate(() => app.wires.length)) - nW;
  await page.keyboard.press('Control+z');
  R.wireUndone = (await page.evaluate(() => app.wires.length)) - nW;
  // multimeter knob & pot wheel & push button on a fresh circuit
  await page.evaluate(() => { app.loadExample('dimmer'); app.run(); });
  await page.waitForTimeout(500);
  const mm = await page.evaluate(() => { const c = app.comps.find(c => c.type === 'multimeter'); return [c.x, c.y, c.props.mode]; });
  [x, y] = await scr(mm[0], mm[1] - 2); await page.mouse.click(x, y); await page.waitForTimeout(300);
  R.knob = [mm[2], await page.evaluate(() => app.comps.find(c => c.type === 'multimeter').props.mode)];
  await page.mouse.click(x, y); await page.mouse.click(x, y); await page.mouse.click(x, y); await page.mouse.click(x, y); // back to ADC
  const rh = await page.evaluate(() => { const c = app.comps.find(c => c.type === 'rheostat'); return [c.x, c.y, c.props.pos]; });
  const ampBefore = await reading('multimeter');
  [x, y] = await scr(rh[0], rh[1]); await page.mouse.move(x, y);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(50); }
  await page.waitForTimeout(500);
  R.wheel = { posBefore: rh[2], posAfter: await page.evaluate(() => app.comps.find(c => c.type === 'rheostat').props.pos), ampBefore, ampAfter: await reading('multimeter'), mode: await page.evaluate(() => app.comps.find(c => c.type === 'multimeter').props.mode) };
  // push button in fuse example: hold -> bulb dims & fuse blows
  await page.evaluate(() => { app.loadExample('fuse'); app.run(); });
  await page.waitForTimeout(600);
  const pb = await page.evaluate(() => { const c = app.comps.find(c => c.type === 'button'); return [c.x, c.y]; });
  [x, y] = await scr(pb[0], pb[1] - 12); await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(400);
  R.buttonHeld = { pressed: await page.evaluate(() => app.comps.find(c => c.type === 'button').state.pressed), fuse: await page.evaluate(() => !!app.comps.find(c => c.type === 'fuse').state.blown) };
  await page.screenshot({ path: '/workspace/dcaclab-sim-test/fuse-blown.png' });
  await page.mouse.up(); await page.waitForTimeout(200);
  R.buttonReleased = await page.evaluate(() => app.comps.find(c => c.type === 'button').state.pressed);
  // save to localStorage, export download, import
  await page.click('#btn-save');
  R.localSaved = await page.evaluate(() => !!localStorage.getItem('dcaclab-sim-saved'));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export')]);
  const p = '/workspace/dcaclab-sim-test/export.json'; await dl.saveAs(p);
  R.exportFile = dl.suggestedFilename();
  await page.evaluate(() => app.clearAll());
  await page.setInputFiles('#file-in', p); await page.waitForTimeout(400);
  R.imported = await page.evaluate(() => app.comps.map(c => c.type).join(','));
  await page.evaluate(() => app.clearAll()); await page.click('#btn-load'); await page.waitForTimeout(200);
  R.loadedLocal = await page.evaluate(() => app.comps.length);
  // file:// check
  const p2 = await ctx.newPage(); p2.on('pageerror', e => errors.push('file: ' + e.message));
  await p2.goto('file:///workspace/dcaclab-sim/index.html?example=ohm&run=1'); await p2.waitForTimeout(1200);
  R.fileProtocolAmp = await p2.evaluate(() => app.comps.find(c => c.type === 'ammeter')._m.reading);
  // perf: frame time for rlc (linear) and acdiode (nonlinear)
  for (const id of ['rlc', 'acdiode', 'led']) {
    R['perf_' + id] = await page.evaluate((id) => { app.pause(); app.loadExample(id); const t0 = performance.now(); app.advance(1); return +(performance.now() - t0).toFixed(1) + ' ms per sim-second (5000 steps)'; }, id);
  }
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
})();
