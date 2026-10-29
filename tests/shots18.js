// v15.2 screenshots (Chinese UI): high-voltage NPN presets 13001/13003/13005 in the part selector, hvsw example running, overload warning.
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
  {
    const page = await open('zh-CN');
    await page.fill('#pal-q', '13003');
    await page.evaluate(() => { app.loadExample('hvsw'); app.pause && app.pause(); FITLEFT(1150); const q = FIND('npn'); SEL(q);
      const sel = document.querySelector('#props select[data-k="part"]') || [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'MJE13003'));
      if (sel) { sel.size = sel.options.length; sel.style.height = 'auto'; } });
    await shot(page, '124-hv-npn-part-selector-13001-13003-13005.png'); await page.close();
  }
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('hvsw'); FITLEFT(1150); app.run(); SEL(FIND('npn')); });
    await page.waitForTimeout(1500); await page.evaluate(() => SEL(FIND('npn')));
    await shot(page, '125-hvsw-13003-switching-300V-running.png'); await page.close();
  }
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('hvsw'); FITLEFT(1150); const R = app.comps.filter((c) => c.type === 'resistor'); R.find((x) => x.props.R === 3000).props.R = 100; R.find((x) => x.props.R === 470).props.R = 10; app.changed(); app.run(); });
    await page.waitForTimeout(1500); await page.evaluate(() => SEL(FIND('npn')));
    await shot(page, '126-hvsw-13003-overload-warning.png', true); await page.close();
  }
  await browser.close();
  console.log('errors ' + errors);
})();
