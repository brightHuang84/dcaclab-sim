// v13 screenshots (Chinese UI): 74-series library category + search, running examples (SR latch, 7490->7447->7-seg, 74595 + Arduino, 74138 ...), property panel with live pin states and the function table
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

  // 79: palette scrolled to the "74 系列逻辑" category
  {
    const page = await open('zh-CN');
    await page.evaluate(() => {
      app.clearAll();
      for (const [i, t] of ['ic7400', 'ic7474', 'ic74161', 'ic74138', 'ic74595', 'ic7447'].entries()) { const c = app.addComp(t, 0, 0, 0, {}); const b = app.worldBox(c); c.x += (i % 3) * 230 - b[0]; c.y += Math.floor(i / 3) * 330 - b[1]; }
      app.changed();
      const cat = document.querySelector('#palette-body .cat[data-cat="ttl"]'), body = document.getElementById('palette');
      if (cat) body.scrollTop += cat.getBoundingClientRect().top - body.getBoundingClientRect().top - 40;
      app.dirty = true; FITLEFT(1150);
    });
    await page.waitForTimeout(800);
    await shot(page, '79-74-series-category.png', false, true);
    // 80: palette search for a part number
    await page.fill('#pal-q', '74hc595'); await page.waitForTimeout(300);
    await shot(page, '80-74-series-search-74hc595.png', false, true);
    await page.fill('#pal-q', 'ls138'); await page.waitForTimeout(300);
    await shot(page, '81-74-series-search-ls138.png');
  }
  const runEx = async (n, name, ex, fit, ms, sel) => {
    const page = await open('zh-CN');
    await page.evaluate(([ex, fit, sel]) => { app.loadExample(ex); FITLEFT(fit); app.run(); if (sel) { const c = app.comps.find((q) => q.type === sel); SEL(c); } }, [ex, fit, sel || null]);
    await page.waitForTimeout(ms);
    await shot(page, n + '-' + name + '.png');
    return page;
  };
  await runEx(82, 'sr-latch-7400-running', 'ttlsr', 1000, 2500);
  await runEx(83, 'decade-counter-7490-7447-7seg-running', 'ttlbcd', 1180, 5200);
  await runEx(84, 'arduino-74hc595-running-light', 'ttl595', 1000, 3800, 'ic74595');
  await runEx(85, 'decoder-74138-leds', 'ttl138', 1000, 2200);
  await runEx(86, 'sync-counter-74161', 'ttl161', 1000, 3500);
  await runEx(87, 'arduino-74hc165-shiftin', 'ttl165', 1000, 2500);
  await runEx(88, 'adder-7483', 'ttl7483', 1000, 2000);
  await runEx(89, 'schmitt-oscillator-7414', 'ttl14', 1000, 2500);
  await runEx(90, 'clock-divider-7474', 'ttl7474', 1000, 2500);
  await runEx(91, 'bus-transceiver-74245', 'ttl245', 1000, 2000);
  // 92: property panel of a running 74161 with live pin states and the expanded function table
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app._finfoOpen = true; app.loadExample('ttl161'); FITLEFT(800); app.run(); SEL(FIND('ic74161')); });
    await page.waitForTimeout(2200);
    await page.evaluate(() => { const f = document.querySelector('.finfo'); if (f) { f.open = true; f.scrollIntoView({ block: 'end' }); } });
    await page.waitForTimeout(400);
    await shot(page, '92-property-panel-live-pins-and-function-table.png');
  }
  // 93: warnings: HC 74xx without supply / under-voltage and contention (two outputs wired together)
  {
    const page = await open('zh-CN');
    await page.evaluate(() => {
      app.clearAll();
      const B = app.addComp('battery', 0, 0, 0, { V: 1.5 }), G = app.addComp('ground', 0, 200, 0, {}), U = app.addComp('ic7404', 240, 100, 0, { fam: 'HC' });
      const W = (a, ia, b, ib) => { const p = app.termPos(a, ia), q = app.termPos(b, ib); return app.addWire(p[0], p[1], q[0], q[1], 1); };
      W(B, 1, U, 13); W(B, 0, G, 0); W(G, 0, U, 6); app.changed(); FITLEFT(700); SEL(U); app.run();
    });
    await page.waitForTimeout(1500);
    await shot(page, '93-undervoltage-hint.png');
  }
  await browser.close();
  console.log('errors ' + errors);
  if (errors) process.exit(1);
})();
