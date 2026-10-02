// v5 screenshot: DC-DC boost module example running, with meters and the properties panel
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, locale: 'zh-CN', deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto('http://127.0.0.1:8765/index.html?fresh=1');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    app.loadExample('boost'); app.fitView(); app.run();
    const U1 = app.comps.find(c => c.type === 'boost'); app.sel = { comp: U1 }; app.refreshProps();
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { document.getElementById('toast').classList.remove('show'); app.updateReadings(true); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: '/workspace/dcaclab-sim/screenshots/29-boost-module.png' });
  console.log('saved 29-boost-module.png');
  await browser.close();
})();
