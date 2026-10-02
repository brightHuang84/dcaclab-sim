const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 860 }, locale: 'zh-CN' });
  p.on('pageerror', e => console.log('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE ' + m.text()); });
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForTimeout(500);
  const ids = process.argv[2].split(',');
  const T = +(process.argv[3] || 1);
  for (const id of ids) {
    const r = await p.evaluate(([id, T]) => {
      app.loadExample(id); const t0 = performance.now(); app.advance(T); const ms = performance.now() - t0;
      return 'sim ' + T + 's in ' + ms.toFixed(0) + 'ms\n   ' + app.comps.map(c => {
        const m = c._m || {}; const o = [c.type + '#' + c.id];
        const d = DEFS[c.type];
        if (d.readings) { try { o.push(d.readings(c).map(x => x.join('=')).join(' | ')); } catch (e) { o.push('ERR ' + e.message); } }
        else for (const k of ['reading', 'V', 'I', 'bright', 'freq']) if (m[k] !== undefined) o.push(k + '=' + (+m[k]).toPrecision(4));
        if (c.type === 'scope' && typeof scopeFFT === 'function') { const F = scopeFFT(c); if (F) o.push('fft p1=' + F.p1.f.toFixed(2) + 'Hz ' + F.p1.a.toFixed(3) + 'V p2=' + F.p2.f.toFixed(2) + ' ' + F.p2.a.toFixed(3)); }
        return o.join(' ');
      }).join('\n   ');
    }, [id, T]);
    console.log('==', id, r);
  }
  await b.close();
})();
