const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, locale: 'zh-CN' });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto('http://127.0.0.1:8765/index.html?fresh=1');
  await page.waitForTimeout(400);
  for (const id of (process.argv[2] || 'ohm,series,parallel,rc,led,fuse,dimmer,acdiode,rlc').split(',')) {
    await page.evaluate((id) => { app.loadExample(id); app.run(); if (id === 'rc') { const S = app.comps.find(c => c.type === 'switch'); S.props.closed = true; app.dirty = true; } }, id);
    await page.waitForTimeout(id === "rc" ? 1500 : +(process.env.WAIT || 900));
    await page.screenshot({ path: `/workspace/dcaclab-sim-test/ex-${id}.png` });
  }
  await browser.close();
})();
