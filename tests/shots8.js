// v8 screenshots: i18n — English, Japanese, Spanish UI and the language menu
const { chromium } = require('playwright-core');
const OUT = process.env.OUT || '/workspace/dcaclab-sim/screenshots/';
const BASE = process.env.URL || 'http://127.0.0.1:8765/index.html';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const shot = async (lang, name, setup, wait) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => console.log('pageerror', e.message));
    await page.goto(BASE + '?fresh=1&lang=' + lang); await page.waitForTimeout(400);
    await page.evaluate(setup);
    await page.waitForTimeout(wait || 1500);
    await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); app.updateReadings(true); app.updateHud(); });
    await page.waitForTimeout(200);
    await page.screenshot({ path: OUT + name }); console.log('saved ' + name);
    await page.close();
  };
  const pick = (type) => { const c = app.comps.find(x => x.type === type); app.sel = { kind: 'comp', comp: c }; app.refreshProps(); };
  await shot('en', '44-i18n-en.png', () => { app.loadExample('reg7805'); app.run(); app.advance && app.advance(0.5); const c = app.comps.find(x => x.type === 'reg78xx'); app.sel = { kind: 'comp', comp: c }; app.refreshProps(); });
  await shot('ja', '45-i18n-ja.png', () => { app.loadExample('scope'); app.run(); app.advance && app.advance(0.3); const c = app.comps.find(x => x.type === 'scope'); app.sel = { kind: 'comp', comp: c }; app.refreshProps(); }, 2000);
  await shot('es', '46-i18n-es.png', () => { app.loadExample('ne555'); app.run(); app.advance && app.advance(0.5); const c = app.comps.find(x => x.type === 'ne555') || app.comps[1]; app.sel = { kind: 'comp', comp: c }; app.refreshProps(); app.toggleAnalysis(); }, 2000);
  // native <select> popups are not captured by headless screenshots, so the menu is shown expanded as a list box
  await shot('fr', '47-i18n-language-menu.png', () => {
    app.loadExample('lm317'); app.run(); app.advance && app.advance(0.3);
    const s = document.getElementById('sel-lang'); const r = s.getBoundingClientRect();
    s.size = s.options.length; Object.assign(s.style, { position: 'fixed', top: r.top + 'px', left: (r.right - 170) + 'px', width: '170px', maxWidth: '170px', zIndex: 50, height: 'auto', boxShadow: '0 6px 18px rgba(0,0,0,.35)' });
  }, 1500);
  await browser.close();
})();
