// v15 screenshots (Chinese UI): real-world simulation mode (🎲) — meter / scope with the toggle off vs on, settings popover, properties nominal → actual, bounce counter.
const { chromium } = require('playwright-core');
const OUT = process.env.OUT || '/workspace/dcaclab-sim/screenshots/';
const BASE = process.env.URL || 'http://127.0.0.1:8765/index.html';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  let errors = 0;
  const open = async (lang) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => { errors++; console.log('pageerror', e.message); });
    await page.goto(BASE + '?fresh=1&lang=' + lang); await page.waitForTimeout(400);
    await page.evaluate(() => {
      window.hideToast = () => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); };
      window.MC = () => app.comps.find(c => DEFS[c.type].mcu);
      window.FIND = (t) => app.comps.find(c => c.type === t);
      window.SEL = (c) => { app.sel = { comp: c }; app.refreshProps(); };
      window.PLACE = (id, x, y, w, h) => { const el = document.getElementById(id); el.style.left = x + 'px'; el.style.top = y + 'px'; if (w) el.style.width = w + 'px'; if (h) el.style.height = h + 'px'; };
      window.SHRINK = (k) => { const v = app.view; v.ox = 170 + (v.ox - 170) * k; v.oy = 70 + (v.oy - 70) * k; v.s *= k; app.dirty = true; };
      window.FITLEFT = (xr) => {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const c of app.comps) { const b = app.worldBox(c); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
        const r = app.cv.getBoundingClientRect(), L = 30, T = 70, Wd = xr - r.left - L, Hd = r.height - T - 50;
        const s = Math.min(Wd / (x1 - x0), Hd / (y1 - y0), 1.4);
        app.view.s = s; app.view.ox = L - x0 * s + (Wd - (x1 - x0) * s) / 2; app.view.oy = T - y0 * s + (Hd - (y1 - y0) * s) / 2; app.dirty = true;
      };
    });
    return page;
  };
  const shot = async (page, name, keepToast, keep) => { if (!keepToast) await page.evaluate(() => hideToast()); await page.waitForTimeout(500); await page.screenshot({ path: OUT + name }); console.log('saved ' + name); if (!keep) await page.close(); };
  const meter = async (n, name, on) => {
    const page = await open('zh-CN');
    await page.evaluate((on) => {
      REAL.set({ on, level: 'med', seed: 7 });
      app.clearAll(); const G = app.addComp('ground', 300, 560, 0, {});
      const B = app.addComp('battery', 300, 400, 3, { V: 9 }), R = app.addComp('resistor', 520, 300, 0, { R: 100 }), M = app.addComp('voltmeter', 700, 420, 0, {});
      const W = (a, ia, b, ib, bend) => { const p = app.termPos(a, ia), q = app.termPos(b, ib); return app.addWire(p[0], p[1], q[0], q[1], bend || 0); };
      W(B, 1, R, 0, 1); W(R, 1, G, 0, 1); W(B, 0, G, 0, 0); W(B, 1, M, 1, 0); W(M, 0, B, 0, 1); app.changed(); FITLEFT(1150); app.run(); SEL(R);
    }, on);
    await page.waitForTimeout(1500); await page.evaluate(() => { SEL(FIND('battery')); console.log(app.findPassOvers().length); });
    await page.waitForTimeout(300);
    await shot(page, n + '-' + name + '.png');
  };
  await meter(117, 'real-off-meter-ideal-9V', false);
  await meter(118, 'real-on-meter-sag-flicker', true);
  const rc = async (n, name, on) => {
    const page = await open('zh-CN');
    await page.evaluate((on) => { REAL.set({ on, level: 'med', seed: 7 }); app.loadExample('realrc'); FITLEFT(1150); app.run(); SEL(app.comps.find((c) => c.type === 'scope')); }, on);
    await page.waitForTimeout(2500);
    await shot(page, n + '-' + name + '.png');
  };
  await rc(119, 'real-off-scope-flat', false);
  await rc(120, 'real-on-scope-ripple-noise', true);
  // 121: settings popover
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { REAL.set({ on: true, level: 'med', seed: 7 }); app.loadExample('realrc'); FITLEFT(1150); app.run(); });
    await page.waitForTimeout(800); await page.click('#btn-real-set'); await page.waitForTimeout(300);
    await shot(page, '121-real-settings-popover.png');
  }
  // 122: properties: nominal -> actual (1 kΩ resistor) + temperature
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { REAL.set({ on: true, level: 'med', seed: 7 }); app.loadExample('realrc'); FITLEFT(1150); app.run(); SEL(app.comps.filter((c) => c.type === 'resistor')[1]); });
    await page.waitForTimeout(1500); await page.evaluate(() => app.refreshProps());
    await shot(page, '122-real-props-nominal-actual.png');
  }
  // 123: bounce: Arduino counter over-counts (serial monitor)
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { REAL.set({ on: true, level: 'med', seed: 7 }); app.loadExample('realbounce'); FITLEFT(1000); app.run(); SEL(MC()); });
    await page.waitForTimeout(600);
    for (let k = 0; k < 3; k++) { await page.evaluate(() => { const S = FIND('button'); S.state.pressed = true; app.dirty = true; }); await page.waitForTimeout(300); await page.evaluate(() => { const S = FIND('button'); S.state.pressed = false; app.dirty = true; }); await page.waitForTimeout(300); }
    await page.evaluate(() => { const b = document.querySelector('.mcu-open, [data-act="mcu-open"], #btn-mcu-open'); if (b) b.click(); });
    await page.waitForTimeout(600);
    await shot(page, '123-real-bounce-counter.png');
  }
  console.log('errors', errors);
  await browser.close();
})();
