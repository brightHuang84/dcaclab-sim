const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, locale: 'zh-CN', deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto('http://127.0.0.1:8765/index.html?fresh=1');
  await page.waitForTimeout(400);
  const D = '/workspace/dcaclab-sim/screenshots/';
  const shot = async (id, selType, name, opts = {}) => {
    await page.evaluate(([id, selType, pre]) => {
      app.loadExample(id); app.pause(); if (pre) app.advance(pre); app.run();
      const c = selType && app.comps.find(c => c.type === selType); if (c) { app.sel = { comp: c }; app.refreshProps(); }
    }, [id, selType, opts.pre || 0]);
    await page.waitForTimeout(opts.wait || 1500);
    if (opts.before) await opts.before();
    await page.evaluate(() => { document.getElementById('toast').classList.remove('show'); app.updateReadings(true); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: D + name });
    if (opts.after) await opts.after();
  };
  await shot('ohm', 'ammeter', '01-ohms-law-9V-3ohm-3A.png');
  await shot('parallel', 'bulb', '02-parallel-bulbs-lit.png');
  await shot('led', 'led', '03-led-with-resistor.png');
  await shot('scope', 'scope', '04-oscilloscope-sine-rc-lowpass.png');
  await shot('scopesq', 'scope', '05-oscilloscope-square-wave-rc.png');
  await shot('ne555', 'scope', '06-555-astable-led-blinker.png', { pre: 4.3, wait: 1500, before: async () => {
    await page.waitForFunction(() => { const L = app.comps.find(c => c.type === 'led'); return L._m.bright > 0.8; }, null, { timeout: 5000 });
    await page.waitForTimeout(120); await page.evaluate(() => app.pause());
  } });
  const box = await page.locator('#cv').boundingBox();
  await shot('breadboard', 'led', '07-breadboard-circuit.png', { before: async () => {
    // hover a hole so the connected strip is highlighted
    const p = await page.evaluate(() => { const v = app.view; return [420 * v.s + v.ox, 360 * v.s + v.oy]; });
    await page.mouse.move(box.x + p[0], box.y + p[1]); await page.waitForTimeout(300);
  } });
  await shot('npn', 'npn', '08-npn-transistor-switch.png');
  await shot('zener', 'zener', '09-zener-regulator.png');
  await shot('dimmer', 'multimeter', '10-multimeter-jacks-COM-VΩ-A.png'.replace('Ω', 'Ohm'));
  await shot('parallel', null, '11-kirchhoff-analysis-table.png', { before: async () => { await page.click('#btn-analysis'); await page.waitForTimeout(600); }, after: async () => { await page.click('#btn-analysis'); } });
  // ---- v3 ----
  await shot('opinv', 'scope', '12-opamp-inverting-amp-gain-10.png', { wait: 1200 });
  await shot('comparator', 'opamp', '13-opamp-comparator-night-light.png', { wait: 1000 });
  await shot('halfadder', 'xor', '14-logic-half-adder.png', { wait: 800 });
  await shot('counter', 'seg7', '15-dff-counter-7segment.png', { pre: 5.2, wait: 600, before: async () => { await page.evaluate(() => app.pause()); } });
  await shot('lissajous', 'scope', '16-scope-xy-lissajous.png', { wait: 1200 });
  await shot('fft', 'scope', '17-scope-fft-square-wave.png', { pre: 1.5, wait: 800 });
  await shot('relay', 'relay', '18-relay-no-nc.png', { wait: 600, before: async () => {
    await page.evaluate(() => { const S = app.comps.find(c => c.type === 'switch'); S.props.closed = true; app.dirty = true; app.sel = { comp: app.comps.find(c => c.type === 'relay') }; app.refreshProps(); });
    await page.waitForTimeout(1200);
  } });
  await shot('xfmr', 'xfmr', '19-transformer-bridge-rectifier.png', { pre: 0.5, wait: 1200 });
  await shot('motor', 'motor', '20-dc-motor.png', { pre: 4, wait: 1000 });
  await shot('sensors', 'ntc', '21-ntc-ldr-sensors.png', { wait: 800 });
  // wire over pins: auto-joined vs. marked
  await page.evaluate(() => {
    app.clearAll(); app.pause();
    const B = app.addComp('battery', 200, 260, 0, { V: 10 });
    const R1 = app.addComp('resistor', 500, 300, 1, { R: 100 }), R2 = app.addComp('resistor', 700, 300, 1, { R: 100 });
    const R3 = app.addComp('resistor', 460, 120, 0, { R: 220 });
    const P = (pts) => app.wires.push({ id: app.nextId++, pts, color: '#d62828', _i: 0, _phase: 0 });
    P([[140, 260], [140, 480], [500, 480]]); P([[500, 480], [500, 340]]); P([[500, 480], [700, 480], [700, 340]]);
    P([[340, 120], [620, 120]]);   // lies across both pins of R3 -> marked, not joined
    app.fitView(); app.dirty = true; app.changed();
  });
  {
    const pt = await page.evaluate(() => { const v = app.view; return [[260 * v.s + v.ox, 260 * v.s + v.oy], [700 * v.s + v.ox, 260 * v.s + v.oy]]; });
    await page.mouse.move(box.x + pt[0][0], box.y + pt[0][1]); await page.mouse.down();
    await page.mouse.move(box.x + (pt[0][0] + pt[1][0]) / 2, box.y + pt[0][1] + 1, { steps: 6 });
    await page.mouse.move(box.x + pt[1][0] + 1, box.y + pt[1][1] + 1, { steps: 6 }); await page.mouse.up();
    await page.evaluate(() => app.run()); await page.waitForTimeout(900);
    await page.evaluate(() => { app.sel = { comp: app.comps[1] }; app.refreshProps(); app.updateReadings(true); });
    await page.waitForTimeout(200);
    await page.screenshot({ path: D + '22-wire-over-pin-autojoin-and-marker.png' });
  }
  await page.evaluate(() => { app.loadExample('scope'); app.pause(); const O = app.comps.find(c => c.type === 'scope'); app.sel = { comp: O }; app.rotateSel(); app.run(); app.refreshProps(); });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { document.getElementById('toast').classList.remove('show'); });
  await page.screenshot({ path: D + '23-scope-rotated-screen-upright.png' });
  await browser.close();
})();
