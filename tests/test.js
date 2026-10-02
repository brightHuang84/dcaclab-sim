const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, locale: 'zh-CN' });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(BASE + '?fresh=1');
  await page.waitForTimeout(500);
  const results = {};
  // 1. each example loads and runs
  const exIds = await page.evaluate(() => EXAMPLES.map(e => e.id));
  for (const id of exIds) {
    results[id] = await page.evaluate((id) => {
      app.pause(); app.loadExample(id); app.advance(id === 'rc' ? 0.05 : 1.0);
      const out = {};
      for (const c of app.comps) {
        const m = c._m;
        if (['ammeter','voltmeter','multimeter'].includes(c.type)) out[c.type + '#' + c.id] = m.reading;
        if (c.type === 'bulb' || c.type === 'led') out[c.type + '#' + c.id + ' bright'] = +(m.bright||0).toFixed(3);
        if (c.type === 'fuse') out['fuse blown'] = !!c.state.blown;
      }
      out.warn = app.warn; out.t = +app.t.toFixed(4);
      return out;
    }, id);
  }
  // RC: close switch, charge for 1 tau
  results.rc_tau = await page.evaluate(() => {
    app.loadExample('rc'); const S = app.comps.find(c => c.type === 'switch'); S.props.closed = true; app.dirty = true;
    app.advance(1.0); const V = app.comps.find(c => c.type === 'voltmeter');
    const a = V._m.reading; app.advance(4.0); return { at1tau: a, expected: 9 * (1 - Math.exp(-1)), at5tau: V._m.reading };
  });
  // Fuse: press button -> short -> fuse blows
  results.fuse_short = await page.evaluate(() => {
    app.loadExample('fuse'); app.advance(0.2);
    const L = app.comps.find(c => c.type === 'bulb'); const before = L._m.bright;
    const P = app.comps.find(c => c.type === 'button'); P.state.pressed = true; app.dirty = true; app.advance(0.2);
    const F = app.comps.find(c => c.type === 'fuse'); P.state.pressed = false; app.dirty = true; app.advance(0.2);
    return { bulbBefore: before, blown: !!F.state.blown, bulbAfter: L._m.bright };
  });
  // Multimeter ohm mode on 470 ohm resistor
  results.ohmmeter470 = await page.evaluate(() => {
    app.clearAll(); const R = app.addComp('resistor', 200, 200, 0, { R: 470 });
    const M = app.addComp('multimeter', 200, 60, 0, { mode: 'OHM' });
    const t = (c, i) => app.termPos(c, i);
    let a = t(M, 0), b = t(R, 0); app.addWire(a[0], a[1], b[0], b[1], 0);
    a = t(M, 1); b = t(R, 1); app.addWire(a[0], a[1], b[0], b[1], 0);
    app.advance(0.01); return M._m.reading;
  });
  // 2. Build battery+switch+bulb circuit via real mouse interactions
  await page.evaluate(() => { app.pause(); app.clearAll(); app.view = { s: 1, ox: 0, oy: 0 }; });
  const box = await page.locator('#cv').boundingBox();
  const drop = async (type, x, y) => {
    const it = page.locator(`.item[data-type="${type}"]`); await it.scrollIntoViewIfNeeded(); const ib = await it.boundingBox();
    await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + x - 10, box.y + y - 10, { steps: 5 }); await page.mouse.move(box.x + x, box.y + y, { steps: 3 }); await page.mouse.up();
  };
  await drop('battery', 300, 400); await drop('switch', 500, 400); await drop('bulb', 400, 200); await drop('ammeter', 620, 260);
  const terms = await page.evaluate(() => app.comps.map(c => ({ type: c.type, t: DEFS[c.type].terms.map((_, i) => app.termPos(c, i)) })));
  console.log('terms', JSON.stringify(terms)); console.log(JSON.stringify(results));
  const T = (type, i) => terms.find(c => c.type === type).t[i];
  const drag = async (p, q) => { await page.mouse.move(box.x + p[0], box.y + p[1]); await page.mouse.down(); await page.mouse.move(box.x + (p[0] + q[0]) / 2, box.y + (p[1] + q[1]) / 2 + 3, { steps: 4 }); await page.mouse.move(box.x + q[0], box.y + q[1], { steps: 4 }); await page.mouse.up(); };
  await drag(T('battery', 1), T('switch', 0));
  await drag(T('switch', 1), T('ammeter', 1));
  await drag(T('ammeter', 0), T('bulb', 1));
  await drag(T('bulb', 0), T('battery', 0));
  results.built = await page.evaluate(() => ({ comps: app.comps.map(c => c.type), wires: app.wires.length }));
  await page.click('#btn-run');
  await page.waitForTimeout(800);
  results.switchOpen = await page.evaluate(() => ({ bright: app.comps.find(c => c.type === 'bulb')._m.bright, amp: app.comps.find(c => c.type === 'ammeter')._m.reading }));
  // click on switch body to close
  const sw = T('switch', 0); await page.mouse.click(box.x + sw[0] + 40, box.y + sw[1] - 5);
  await page.waitForTimeout(1200);
  results.switchClosed = await page.evaluate(() => ({ closed: app.comps.find(c => c.type === 'switch').props.closed, bright: app.comps.find(c => c.type === 'bulb')._m.bright, amp: app.comps.find(c => c.type === 'ammeter')._m.reading, expected: 9 / (81 / 5) }));
  await page.screenshot({ path: '/workspace/dcaclab-sim-test/built.png' });
  // save/load round trip
  results.saveload = await page.evaluate(() => { const s = JSON.stringify(app.serialize()); app.clearAll(); app.load(s); return { comps: app.comps.length, wires: app.wires.length }; });
  results.errors = errors;
  console.log(JSON.stringify(results, null, 1));
  await browser.close();
})();
