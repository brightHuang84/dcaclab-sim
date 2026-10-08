// v10.1 screenshots: pinout / usage / examples help panel, a new example running, coloured wires
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
      window.SEL = (c) => { app.sel = { comp: c }; app.refreshProps(); };
      window.PLACE = (id, x, y, w, h) => { const el = document.getElementById(id); el.style.left = x + 'px'; el.style.top = y + 'px'; if (w) el.style.width = w + 'px'; if (h) el.style.height = h + 'px'; };
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
  const shot = async (page, name) => { await page.evaluate(() => hideToast()); await page.waitForTimeout(500); await page.screenshot({ path: OUT + name }); console.log('saved ' + name); await page.close(); };

  // 58: Uno pinout panel (opened from the properties-panel button) next to a running Blink circuit
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('ardblink'); FITLEFT(660); app.run(); SEL(MC()); document.querySelector('#props .mcu-pin').click(); PLACE('pin-win', 660, 62, 700, 770); });
    await page.waitForTimeout(900);
    await shot(page, '58-pinout-uno.png');
  }
  // 59: ATtiny85 pinout panel, scrolled so the pin map and the first table rows show
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('tinyfade'); FITLEFT(660); app.run(); SEL(MC()); MCUHELP.open('attiny85'); PLACE('pin-win', 660, 62, 700, 770); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { const b = document.querySelector('#pin-win .pw-body'), t = document.getElementById('pw-pinout'); b.scrollTop += t.getBoundingClientRect().top - b.getBoundingClientRect().top - 6; });
    await page.waitForTimeout(900);
    await shot(page, '59-pinout-attiny85.png');
  }
  // 60: usage section – motor via MOSFET + flyback diode (and PWM above it)
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('ardmotor'); FITLEFT(660); SEL(MC()); MCUHELP.open('arduino', 'u-motor'); PLACE('pin-win', 660, 62, 700, 770); MCUHELP.scrollTo('pw-u-motor'); });
    await shot(page, '60-pinout-usage-motor.png');
  }
  // 61: examples section (debounced button card with wiring, code and the three buttons)
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('arddebounce'); FITLEFT(660); SEL(MC()); MCUHELP.open('arduino'); PLACE('pin-win', 660, 62, 700, 770); MCUHELP.scrollTo('pw-examples'); });
    await shot(page, '61-pinout-examples.png');
  }
  // 62: new example running – PWM motor through a MOSFET, loaded from the panel's "载入到画布" button; board selected so the readings (D9 PWM duty, serial) show
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { MCUHELP.open('arduino'); MCUHELP.scrollTo('pw-ex-ardmotor'); document.querySelector('#pin-win .pw-load[data-id="ardmotor"]').click(); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { MCUHELP.close(); FITLEFT(1150); const v = app.view, k = 0.86; v.ox = 170 + (v.ox - 170) * k; v.oy = 70 + (v.oy - 70) * k; v.s *= k; if (!app.running) app.run(); SEL(MC()); });
    await page.waitForTimeout(2500);
    await shot(page, '62-example-mosfet-motor-running.png');
  }
  // 63: coloured wires – traffic light with red/black power wires and coloured signal wires; three wires selected, palette shown
  {
    const page = await open('zh-CN');
    const info = await page.evaluate(() => {
      app.loadExample('ardtraffic');
      const pal = ['#1d5fd1', '#2a9d3a', '#f2b705', '#f77f00', '#8e44ad', '#e8e8e8', '#8b5a2b', '#8a8f98'];
      const mc = MC(), gnd = [23, 24, 25], i5 = [20];
      const ends = (w) => [w.pts[0], w.pts[w.pts.length - 1]];
      const near = (w, idx) => idx.some(i => { const p = app.termPos(mc, i); return ends(w).some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1); });
      // every wire joined (end to end) to a GND pin goes black
      const black = new Set(app.wires.filter(w => near(w, gnd)));
      const touch = (a, b) => ends(a).some(([x, y]) => ends(b).some(([u, v]) => Math.hypot(x - u, y - v) < 1));
      for (let grow = true; grow;) { grow = false; for (const w of app.wires) if (!black.has(w) && [...black].some(b => touch(w, b))) { black.add(w); grow = true; } }
      let k = 0;
      app.wires.forEach(w => { w.color = black.has(w) ? '#222222' : near(w, i5) ? '#d62828' : pal[k++ % pal.length]; });
      app.changed(); FITLEFT(1000); app.run();
      const sel = app.wires.filter(w => !['#222222', '#d62828'].includes(w.color)).slice(0, 3);
      app.setSelection([], sel); app.refreshProps();
      return { wires: app.wires.length, colours: [...new Set(app.wires.map(w => w.color))] };
    });
    console.log('63 info', JSON.stringify(info));
    await page.waitForTimeout(1500);
    await shot(page, '63-wire-colours.png');
  }
  await browser.close();
  console.log('pageerrors', errors);
})();
