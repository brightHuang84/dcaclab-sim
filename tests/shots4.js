// v4 screenshots: multimeter measuring with the simulation stopped / paused / unpowered
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto('http://127.0.0.1:8765/index.html?fresh=1');
  await page.waitForTimeout(400);
  const D = '/workspace/dcaclab-sim/screenshots/';
  await page.evaluate(() => {
    window.W = (a, b, bend) => app.addWire(a[0], a[1], b[0], b[1], bend || 0);
    window.T = (c, i) => app.termPos(c, i);
    window.fresh = () => { app.clearAll(); app.pause(); app.resetSim(); };
    window.fin = (sel) => { app.fitView(); app.sel = { comp: sel }; app.refreshProps(); app.staticUpdate(true); app.updateReadings(true); document.getElementById('toast').classList.remove('show'); };
  });
  const snap = async (name) => { await page.waitForTimeout(500); await page.evaluate(() => { app.updateReadings(true); document.getElementById('toast').classList.remove('show'); }); await page.screenshot({ path: D + name }); console.log('saved', name); };

  // 24: unpowered network (1k ‖ 1k) + 470 Ω, sim never run → 970.0 Ω ; second meter on an open resistor → OL
  await page.evaluate(() => {
    fresh();
    const R1 = app.addComp('resistor', 200, -80, 0, { R: 1000 }), R2 = app.addComp('resistor', 200, 40, 0, { R: 1000 }), R3 = app.addComp('resistor', 400, -20, 0, { R: 470 });
    W(T(R1, 0), T(R2, 0), 1); W(T(R1, 1), T(R2, 1), 1); W(T(R1, 1), T(R3, 0), 1);
    const M = app.addComp('multimeter', 0, -80, 0, { mode: 'OHM' });
    W(T(M, 1), [0, 20]); W([0, 20], [120, 20]); W([120, 20], [120, -80]); W([120, -80], T(R1, 0)); W(T(M, 0), [T(M, 0)[0], 160], 0); W([T(M, 0)[0], 160], [T(R3, 1)[0], 160], 0); W([T(R3, 1)[0], 160], T(R3, 1), 0);
    const C = app.addComp('capacitor', 700, -20, 0, { C: 100e-6 }), M2 = app.addComp('multimeter', 700, -260, 0, { mode: 'OHM' });
    W(T(M2, 0), T(C, 0), 0); W(T(M2, 1), [700, -160]); W([700, -160], [780, -160]); W([780, -160], [780, -20]); W([780, -20], T(C, 1));
    fin(M);
  });
  await snap('24-meter-ohms-unpowered.png');

  // 25: diode test — Si diode forward 0.655 V, red LED forward, diode reverse OL
  await page.evaluate(() => {
    fresh();
    const mk = (x, type, props, rev) => {
      const M = app.addComp('multimeter', x, -100, 0, { mode: 'DIODE' }), Dd = app.addComp(type, x, 80, 0, props);
      W(T(M, 1), T(Dd, rev ? 1 : 0), 0); W(T(M, 0), T(Dd, rev ? 0 : 1), 0); return M;
    };
    const M1 = mk(0, 'diode', {}); mk(240, 'led', { color: 'red' }); mk(480, 'led', { color: 'blue' }); mk(720, 'diode', {}, true);
    fin(M1);
  });
  await snap('25-meter-diode-test.png');

  // 26: continuity — closed switch beeps (0 Ω), 10 Ω beeps, 100 Ω no beep, open switch OL
  await page.evaluate(() => {
    fresh();
    const mk = (x, type, props) => {
      const M = app.addComp('multimeter', x, -100, 0, { mode: 'CONT' }), X = app.addComp(type, x, 80, 0, props);
      W(T(M, 1), T(X, 0), 0); W(T(M, 0), T(X, 1), 0); return M;
    };
    const M1 = mk(0, 'switch', { closed: true }); mk(240, 'resistor', { R: 10 }); mk(480, 'resistor', { R: 100 }); mk(720, 'switch', { closed: false });
    fin(M1);
  });
  await snap('26-meter-continuity.png');

  // 27: paused after running: 9 V battery reads 9.000 V; open switch: 8.999 V across the switch (10 MΩ meter + bulb)
  await page.evaluate(() => {
    fresh();
    const S = app.addComp('switch', 0, 0, 0, { closed: false }), L = app.addComp('bulb', 240, 0, 0), B = app.addComp('battery', 120, 400, 0, { V: 9 });
    W([40, 0], [200, 0]); W([280, 0], [280, 400]); W([280, 400], [180, 400]); W([60, 400], [-80, 400]); W([-80, 400], [-80, 0]); W([-80, 0], [-40, 0]);
    const M1 = app.addComp('multimeter', 120, 230, 0, { mode: 'VDC' });
    W(T(M1, 0), [80, 320]); W([80, 320], [60, 320]); W([60, 320], [60, 400]); W(T(M1, 1), [120, 340]); W([120, 340], [180, 340]); W([180, 340], [180, 400]);
    const M2 = app.addComp('multimeter', 0, -200, 0, { mode: 'VDC' });
    W(T(M2, 0), [-40, 0]); W(T(M2, 1), [0, -100]); W([0, -100], [40, -100]); W([40, -100], [40, 0]);
    app.run(); app.advance(0.05); app.pause();
    fin(M1);
  });
  await snap('27-meter-voltage-paused.png');

  // 28: Ω mode on a powered circuit → 测量电阻时请断开电源 warning
  await page.evaluate(() => {
    fresh();
    const L = app.addComp('bulb', 120, 0, 0), B = app.addComp('battery', 120, 160, 0, { V: 9 });
    W([80, 0], [60, 0]); W([60, 0], [60, 160]); W([160, 0], [180, 0]); W([180, 0], [180, 160]);
    const M = app.addComp('multimeter', 120, -200, 0, { mode: 'OHM' });
    W(T(M, 0), [80, 0]); W(T(M, 1), [120, -100]); W([120, -100], [160, -100]); W([160, -100], [160, 0]);
    app.run(); app.advance(0.1); app.pause();
    fin(M);
  });
  await snap('28-meter-ohms-powered-warning.png');
  await browser.close();
})();
