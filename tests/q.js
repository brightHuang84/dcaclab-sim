const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  p.on('pageerror', e => console.log('PAGEERR ' + e.message));
  await p.goto(process.env.URL || 'http://127.0.0.1:8765/index.html');
  await p.waitForTimeout(500);
  const code = require('fs').readFileSync(process.argv[2], 'utf8');
  console.log(await p.evaluate(code));
  await b.close();
})();
