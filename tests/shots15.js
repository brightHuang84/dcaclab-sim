// v14 screenshots (Chinese UI): audio category, speaker / amplifier examples running, property panels, toolbar sound button.  // (header of v13 kept:) v13 screenshots (Chinese UI): 74-series library category + search, running examples (SR latch, 7490->7447->7-seg, 74595 + Arduino, 74138 ...), property panel with live pin states and the function table
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


  const runEx = async (n, name, ex, fit, ms, sel, extra) => {
    const page = await open('zh-CN');
    await page.evaluate(([ex, fit, sel]) => { app.loadExample(ex); FITLEFT(fit); app.run(); if (sel) { const c = app.comps.find((q) => q.type === sel); SEL(c); } }, [ex, fit, sel || null]);
    await page.waitForTimeout(ms);
    if (extra) await page.evaluate(extra);
    await shot(page, n + '-' + name + '.png');
    return page;
  };
  // 94: palette scrolled to the audio category with a few parts on the board
  {
    const page = await open('zh-CN');
    await page.evaluate(() => {
      app.clearAll();
      for (const [i, t] of ['speaker', 'headphone', 'piezo', 'emic', 'audiogen', 'jack35', 'lm386', 'tda2030', 'pam8403'].entries()) { const c = app.addComp(t, 0, 0, 0, {}); const b = app.worldBox(c); c.x += (i % 3) * 260 - b[0]; c.y += Math.floor(i / 3) * 190 - b[1]; }
      app.changed();
      const cat = document.querySelector('#palette-body .cat[data-cat="audio"]'), body = document.getElementById('palette');
      if (cat) body.scrollTop += cat.getBoundingClientRect().top - body.getBoundingClientRect().top - 40;
      app.dirty = true; FITLEFT(1150);
    });
    await page.waitForTimeout(800);
    await shot(page, '94-audio-category.png', false, true);
    await page.fill('#pal-q', 'lm386'); await page.waitForTimeout(300);
    await shot(page, '95-audio-search-lm386.png', false, true);
    await page.fill('#pal-q', 'tda'); await page.waitForTimeout(300);
    await shot(page, '96-audio-search-tda.png');
  }
  await runEx(97, 'lm386-speaker-gain20-running', 'audlm386', 1000, 3500, 'speaker');
  await runEx(98, 'lm386-gain200', 'audlm386g', 1000, 3500, 'lm386');
  await runEx(99, 'tda2030-power-amp', 'audtda', 1000, 4000, 'tda2030');
  await runEx(100, 'two-way-crossover-scopes', 'audxover', 1100, 5200, null, `(() => { const L = app.comps.filter((c) => ['scope', 'speaker', 'lm386'].includes(c.type)); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const c of L) { const b = app.worldBox(c); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); } const r = app.cv.getBoundingClientRect(), Wd = 1100 - r.left - 30, Hd = r.height - 120; const sc = Math.min(Wd / (x1 - x0), Hd / (y1 - y0), 2.2); app.view.s = sc; app.view.ox = 30 - x0 * sc; app.view.oy = 70 - y0 * sc; app.dirty = true; })()`);
  await runEx(101, 'clipping-demo-fft-harmonics', 'audclip', 1100, 4500, null, `(() => { const L = app.comps.filter((c) => ['scope', 'speaker', 'lm386'].includes(c.type)); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const c of L) { const b = app.worldBox(c); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); } const r = app.cv.getBoundingClientRect(), Wd = 1100 - r.left - 30, Hd = r.height - 120; const sc = Math.min(Wd / (x1 - x0), Hd / (y1 - y0), 2.2); app.view.s = sc; app.view.ox = 30 - x0 * sc; app.view.oy = 70 - y0 * sc; app.dirty = true; })()`);
  await runEx(102, 'pam8403-stereo-two-speakers', 'audpam', 1000, 4000, 'pam8403');
  await runEx(103, 'electret-mic-lm358-lm386', 'audmic', 1100, 4500, 'emic');
  await runEx(104, 'arduino-tone-melody-volume-pot', 'audtone', 1000, 3500, 'speaker');
  await runEx(105, 'class-ab-push-pull', 'audclassab', 1000, 3500);
  await runEx(106, '555-siren-speaker', 'aud555', 1000, 3000, 'speaker');
  await runEx(107, '555-piezo-disc', 'audpiezo', 1000, 3000, 'piezo');
  // 108: signal generator property panel; 109: speaker burn-out message
  await runEx(108, 'signal-generator-panel', 'audlm386', 1000, 2500, 'audiogen');
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('audlm386'); FITLEFT(1000); const g = FIND('audiogen'); g.props.Vpp = 3; const s = FIND('speaker'); s.props.P = 0.25; app.dirty = true; app.run(); SEL(s); });
    await page.waitForTimeout(6000);
    await shot(page, '109-speaker-overpower-burnout.png', true);
  }
  // 110: the toolbar with the sound button switched on (clip of the top bar) while the LM386 example runs
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('audlm386'); FITLEFT(1000); app.run(); });
    await page.click('#btn-sound'); await page.waitForTimeout(3000);
    await page.evaluate(() => hideToast());
    await page.screenshot({ path: OUT + '110-toolbar-sound-button-on.png' });
    console.log('110', await page.evaluate(() => ({ muted: AUD.muted, ctx: AUD._ctx && AUD._ctx.state, comps: AUD.comps.size })));
    await page.close();
  }
  await browser.close();
  console.log('errors ' + errors);
  if (errors) process.exit(1);
})();
