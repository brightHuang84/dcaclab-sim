// v12 screenshots (Chinese UI): MCU palette with the new boards, pinout panels (ESP32 / Pico / Mega), running board examples (ESP32 / Pico / Blue Pill / 8051)
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
  const shot = async (page, name, keepToast) => { if (!keepToast) await page.evaluate(() => hideToast()); await page.waitForTimeout(500); await page.screenshot({ path: OUT + name }); console.log('saved ' + name); await page.close(); };

  // 71: palette scrolled to the "单片机" category, the new boards placed on the canvas
  {
    const page = await open('zh-CN');
    await page.evaluate(() => {
      app.clearAll();
      // simple row packing using each board's own bounding box (no overlaps)
      const rows = [['nano', 'promini', 'pico', 'c51'], ['esp32', 'bluepill'], ['mega']];
      let y = 0;
      for (const row of rows) {
        let x = 0, hmax = 0;
        for (const t of row) {
          const c = app.addComp(t, 0, 0, 0, {}); const b = app.worldBox(c);
          c.x += x - b[0]; c.y += y - b[1]; x += (b[2] - b[0]) + 60; hmax = Math.max(hmax, b[3] - b[1]);
        }
        y += hmax + 60;
      }
      app.changed();
      const cat = document.querySelector('#palette-body .cat[data-cat="mcu"]'), body = document.getElementById('palette');
      if (cat) body.scrollTop += cat.getBoundingClientRect().top - body.getBoundingClientRect().top - 40;
      app.dirty = true; FITLEFT(1150);
    });
    await page.waitForTimeout(800);
    await shot(page, '71-mcu-category-boards.png');
  }
  // 72–74: pinout panels
  for (const [n, b, ex] of [[72, 'esp32', 'espdac'], [73, 'pico', 'picoadc'], [74, 'mega', 'megabar']]) {
    const page = await open('zh-CN');
    await page.evaluate(([b, ex]) => { app.loadExample(ex); FITLEFT(660); SEL(MC()); MCUHELP.open(b); PLACE('pin-win', 660, 62, 700, 770); }, [b, ex]);
    await page.waitForTimeout(600);
    await shot(page, n + '-pinout-' + b + '.png');
  }
  // 75–78: running examples with the code editor + serial monitor
  for (const [n, ex, sec] of [[75, 'espdac', 4000], [76, 'picoadc', 4000], [77, 'bpadc', 4000]]) {
    const page = await open('zh-CN');
    await page.evaluate((ex) => { app.loadExample(ex); FITLEFT(620); app.run(); const c = MC(); SEL(c); MCU.openEditor(c, true); PLACE('mcu-win', 610, 66, 580, 720); }, ex);
    await page.waitForTimeout(sec);
    await page.evaluate(() => { const s = document.querySelector('#mcu-win .mw-ser'); if (s) s.scrollTop = s.scrollHeight; });
    await shot(page, n + '-' + ex + '-running.png');
  }
  // 78: 8051 running light (no serial port used): circuit large, editor on the right with the C51 code
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('c51run'); FITLEFT(700); app.run(); const c = MC(); SEL(c); MCU.openEditor(c); PLACE('mcu-win', 700, 66, 500, 520); });
    await page.waitForTimeout(2600);
    await shot(page, '78-c51run-running.png');
  }
  await browser.close();
  console.log('errors ' + errors);
  if (errors) process.exit(1);
})();
