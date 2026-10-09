// v11 screenshots (Chinese UI): sensor palette, ultrasonic + LCD, DHT22 + serial monitor, signal source, multi-sensor, I2C LCD, help sensors section
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
  const shot = async (page, name, keepToast) => { if (!keepToast) await page.evaluate(() => hideToast()); await page.waitForTimeout(500); await page.screenshot({ path: OUT + name }); console.log('saved ' + name); await page.close(); };

  // 64: palette scrolled to the "传感器" category, with a few sensors on the canvas
  {
    const page = await open('zh-CN');
    await page.evaluate(() => {
      app.loadExample('snlm35');
      const cat = document.querySelector('#palette-body .cat[data-cat="sensor"]'), body = document.getElementById('palette');
      body.scrollTop += cat.getBoundingClientRect().top - body.getBoundingClientRect().top - 50;
      FITLEFT(1150); app.run();
    });
    await page.waitForTimeout(1200);
    await shot(page, '64-sensor-category.png');
  }
  // 65: HC-SR04 + LCD1602 running (distance on the LCD), sensor selected so its qty slider and readout show
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('snsultra'); FITLEFT(1150); SHRINK(0.9); app.run(); SEL(FIND('hcsr04')); });
    await page.waitForTimeout(3000);
    await shot(page, '65-ultrasonic-lcd-running.png');
  }
  // 66: DHT22 → serial monitor
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('sndht'); FITLEFT(620); app.run(); const c = MC(); SEL(c); MCU.openEditor(c, true); PLACE('mcu-win', 610, 66, 580, 720); });
    await page.waitForTimeout(6000);
    await page.evaluate(() => { const s = document.querySelector('#mcu-win .mw-ser'); if (s) s.scrollTop = s.scrollHeight; });
    await shot(page, '66-dht22-serial-monitor.png');
  }
  // 67: properties panel – LM35 temperature driven by a sine signal source (min/max/period fields), meter following it
  {
    const page = await open('zh-CN');
    await page.evaluate(() => {
      app.loadExample('snlm35'); FITLEFT(1150);
      const s = FIND('lm35'); Object.assign(s.props, { sig: 'sine', smin: 15, smax: 40, sper: 6 }); app.run(); SEL(s);
    });
    await page.waitForTimeout(2500);
    await page.evaluate(() => app.refreshProps());
    await shot(page, '67-signal-source-props.png');
  }
  // 68: multi-sensor circuit – PIR + photoresistor module night light
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('snpir'); FITLEFT(1150); SHRINK(0.9); app.run(); SEL(FIND('pir')); });
    await page.waitForTimeout(3500);
    await shot(page, '68-multi-sensor-pir-ldr.png');
  }
  // 69: I2C LCD (PCF8574 backpack, SDA A4 / SCL A5) running
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('snlcdi2c'); FITLEFT(1150); SHRINK(0.9); app.run(); SEL(FIND('lcdi2c')); });
    await page.waitForTimeout(3000);
    await shot(page, '69-i2c-lcd-running.png');
  }
  // 70: help panel – sensors section
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('snsultra'); FITLEFT(660); SEL(MC()); MCUHELP.open('arduino'); PLACE('pin-win', 660, 62, 700, 770); MCUHELP.scrollTo('pw-sensors'); });
    await shot(page, '70-help-sensors.png');
  }
  await browser.close();
  console.log('errors', errors);
  process.exit(errors ? 1 : 0);
})();
