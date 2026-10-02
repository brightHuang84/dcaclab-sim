const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  p.on('pageerror', e => console.log('PAGEERR ' + e.message));
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForTimeout(500);
  const ids = process.argv[2] ? process.argv[2].split(',') : await p.evaluate(() => EXAMPLES.map(e => e.id));
  for (const id of ids) {
    const r = await p.evaluate((id) => {
      app.loadExample(id); app.advance(id === 'ne555' ? 3 : 1);
      return app.comps.map(c => {
        const m = c._m || {}; const o = [c.type];
        for (const k of ['reading', 'V', 'I', 'bright', 'freq', 'Ib', 'Vbe']) if (m[k] !== undefined) o.push(k + '=' + (+m[k]).toPrecision(4));
        if (c.state && c.state.freq) o.push('sf=' + c.state.freq.toPrecision(4));
        if (c.state && c.state.blown) o.push('BLOWN');
        return o.join(' ');
      }).join('\n   ');
    }, id);
    console.log('==', id, '\n   ' + r);
  }
  await b.close();
})();
