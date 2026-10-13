// v14.1 screenshots (Chinese UI): collapsible component library and side panels.  // (header of v13 kept:) v13 screenshots (Chinese UI): 74-series library category + search, running examples (SR latch, 7490->7447->7-seg, 74595 + Arduino, 74138 ...), property panel with live pin states and the function table
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



  // each screenshot uses a fresh browser page; localStorage is shared per browser context, so reset it first
  const fresh = async () => { const p = await open('zh-CN'); await p.evaluate(() => { localStorage.removeItem('dcl.palOpen'); localStorage.removeItem('dcl.palMin'); localStorage.removeItem('dcl.propsMin'); }); await p.reload(); await p.waitForTimeout(500); await p.evaluate(() => { window.hideToast = () => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); }; }); return p; };
  {
    const page = await fresh();
    await page.evaluate(() => { app.loadExample('audlm386'); app.fitView(); });
    await shot(page, '111-library-all-collapsed.png', false, true);
    await page.click('#palette-body .cat[data-cat="basic"] .cat-t'); await page.waitForTimeout(400);
    await shot(page, '112-library-one-category-expanded.png', false, true);
    await page.click('#palette-body .cat[data-cat="basic"] .cat-t');
    await page.click('#palette-body .cat[data-cat="ttl"] .cat-t'); await page.waitForTimeout(200);
    await page.click('#palette-body .sub-t[data-key="ttl/cnt"]'); await page.waitForTimeout(400);
    await shot(page, '113-library-74-series-sub-group-expanded.png', false, true);
    await page.fill('#pal-q', '555'); await page.waitForTimeout(400);
    await shot(page, '114-library-search-auto-expanded.png', false, true);
    await page.fill('#pal-q', ''); await page.waitForTimeout(300);
    await page.click('#pal-toggle'); await page.waitForTimeout(500); await page.evaluate(() => { app.fitView(); app.dirty = true; });
    await shot(page, '115-left-panel-collapsed.png', false, true);
    await page.click('#props-toggle'); await page.waitForTimeout(500); await page.evaluate(() => { app.fitView(); app.dirty = true; });
    await shot(page, '116-both-panels-collapsed.png');
  }
  await browser.close();
  console.log('errors ' + errors);
  if (errors) process.exit(1);
})();
