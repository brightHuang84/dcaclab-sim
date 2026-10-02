// v7 screenshots: user regression circuit (before/after), convergence warning + advanced settings, new parts
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || '/workspace/dcaclab-sim/screenshots/';
const USER = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'user-7805-supply.json'), 'utf8'));
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const want = (n) => !only || only.some(o => n.startsWith(o));
  const open = async (url) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, locale: 'zh-CN', deviceScaleFactor: 1 });
    page.on('pageerror', e => console.log('pageerror', e.message));
    await page.goto(url + '?fresh=1'); await page.waitForTimeout(400);
    await page.evaluate(() => { window.HIDE = () => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); }; });
    return page;
  };
  const page = await open('http://127.0.0.1:8765/index.html');
  const shot = async (p, name, setup, arg, wait, keepToast) => {
    await p.evaluate(setup, arg);
    await p.waitForTimeout(wait || 1500);
    await p.evaluate((k) => { if (!k) HIDE(); app.updateReadings(true); app.updateHud(); }, !!keepToast);
    await p.waitForTimeout(200);
    await p.screenshot({ path: OUT + name });
    console.log('saved ' + name);
  };
  const userSetup = (d) => {
    app.load(d); app.pause(); app.resetSim(); app.fitView(); app.view.s *= 0.97;
    app.run(); app.advance(0.3);
    const U = app.comps.find(c => c.type === 'reg78xx'); app.sel = { comp: U }; app.refreshProps();
  };
  if (want('36b') && process.env.BASE) { // the same circuit on the v6 build, for comparison
    const pb = await open(process.env.BASE);
    await shot(pb, '36b-user-circuit-before-v6.png', (d) => {
      app.load(d); app.pause(); app.resetSim(); app.fitView(); app.view.s *= 0.97; app.advance(0.3);
      for (let i = 0; i < 3000 && !app.warn; i++) app.simStep();   // stop on a non-converged step (v6 failed ~8 % of steps)
      app.pause(); const U = app.comps.find(c => c.type === 'reg78xx'); app.sel = { comp: U }; app.refreshProps();
    }, USER, 800);
  }
  if (want('36-')) await shot(page, '36-user-circuit-fixed.png', userSetup, USER, 2500);
  if (want('37')) await shot(page, '37-convergence-warning-advanced.png', () => {
    // deliberately starve the solver (2 Newton iterations, no automatic remedies) to show the warning UI
    app.loadExample('npn'); app.fitView(); app.view.s *= 0.85; app.sel = null; app.refreshProps();
    SIMOPT.maxIter = 2; SIMOPT.autoStep = false; SIMOPT.homotopy = false; SIMOPT.kclCheck = false; app.dirty = true;
    app.resetSim(); app.run(); app._advOpen = true; app.refreshProps();
    HIDE(); setTimeout(() => { app.refreshProps(); const d = document.querySelector('details.adv'); if (d) d.scrollIntoView(); }, 900);
  }, null, 1500, true);
  if (want('38')) await shot(page, '38-varistor-surge.png', () => {
    // MOV surge example: charge the 1 kV / 220 µF surge generator, press the button, freeze ~5 ms into the pulse
    app.loadExample('movsurge'); app.fitView(); app.view.s *= 0.95; app.resetSim(); app.run(); app.advance(0.6);
    const K = app.comps.find(c => c.type === 'tactile'); K.state.pressed = true; app.dirty = true; app.advance(0.012);
    K.state.pressed = false; app.dirty = true; app.pause();
    const M = app.comps.find(c => c.type === 'mov'); app.sel = { comp: M }; app.refreshProps();
  }, null, 600);
  if (want('39')) {
    await page.setViewportSize({ width: 1440, height: 1100 }); await page.waitForTimeout(300);
    await shot(page, '39-new-parts-palette.png', () => {
      app.clearAll(); app.pause(); app.resetSim(); app.sel = null; app.refreshProps();
      const L = [['mov'], ['tvs', { bidir: true }], ['pptc'], ['tl431'], ['lm393'], ['xosc'], ['abuzzer'], ['pbuzzer'], ['hall'], ['reed'], ['phototr'],
        ['relaymod'], ['keypad'], ['l298n'], ['lcd1602']];
      const W = { relaymod: 1.4, keypad: 1.3, l298n: 1.7, lcd1602: 2.4 }, H = { keypad: 1.5, l298n: 1.3 };
      let x = 0, y = 0, rowH = 0;
      for (const [t, p] of L) { const w = (W[t] || 0.9) * 170; if (x + w > 1000) { x = 0; y += rowH + 30; rowH = 0; } app.addComp(t, x + w / 2, y + 90 * ((H[t] || 1) - 1), 0, p || {}); rowH = Math.max(rowH, 160 * (H[t] || 1)); x += w + 20; }
      app.run(); app.advance(0.05); app.pause(); app.fitView();
      const pal = document.getElementById('palette'); const t = [...document.querySelectorAll('.cat-t')].find(e => /保护|Protect/.test(e.textContent));
      if (pal && t) pal.scrollTop += t.getBoundingClientRect().top - pal.getBoundingClientRect().top - 8;
    }, null, 600);
    await page.setViewportSize({ width: 1440, height: 860 }); await page.waitForTimeout(300);
  }
  if (want('40')) await shot(page, '40-tl431-reference.png', () => {
    app.loadExample('tl431'); app.fitView(); app.view.s *= 0.9; app.resetSim(); app.run(); app.advance(0.2);
    const T = app.comps.find(c => c.type === 'tl431'); app.sel = { comp: T }; app.refreshProps();
  }, null, 800);
  if (want('41')) await shot(page, '41-l298n-motor.png', () => {
    app.loadExample('l298n'); app.fitView(); app.view.s *= 0.9; app.resetSim(); app.run(); app.advance(0.5);
    const D = app.comps.find(c => c.type === 'l298n'); app.sel = { comp: D }; app.refreshProps();
  }, null, 1200);
  if (want('42')) await shot(page, '42-lcd1602.png', () => {
    app.loadExample('lcd1602'); app.fitView(); app.view.s *= 0.85; app.resetSim(); app.run(); app.advance(0.3);
    const D = app.comps.find(c => c.type === 'lcd1602'); app.sel = { comp: D }; app.refreshProps();
  }, null, 1200);
  if (want('43')) await shot(page, '43-nightlight-lm393.png', () => {
    app.loadExample('nightlight'); app.fitView(); app.view.s *= 0.9; app.resetSim(); app.run(); app.advance(0.2);
    const D = app.comps.find(c => c.type === 'lm393'); app.sel = { comp: D }; app.refreshProps();
  }, null, 1000);
  await browser.close();
})();
