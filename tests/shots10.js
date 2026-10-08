// v10 screenshots: microcontrollers (program editor, serial monitor, PWM + scope, ATtiny, LCD, compile error)
const { chromium } = require('playwright-core');
const OUT = process.env.OUT || '/workspace/dcaclab-sim/screenshots/';
const BASE = process.env.URL || 'http://127.0.0.1:8765/index.html';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const open = async (lang) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => console.log('pageerror', e.message));
    await page.goto(BASE + '?fresh=1&lang=' + lang); await page.waitForTimeout(400);
    await page.evaluate(() => {
      window.hideToast = () => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); };
      window.MC = () => app.comps.find(c => DEFS[c.type].mcu);
      window.SEL = (c) => { app.sel = { comp: c }; app.refreshProps(); };
      window.PLACE = (x, y, w, h) => { const el = document.getElementById('mcu-win'); el.style.left = x + 'px'; el.style.top = y + 'px'; if (w) el.style.width = w + 'px'; if (h) el.style.height = h + 'px'; };
      // shift the view so the circuit sits in the left part of the stage (room for the editor on the right)
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

  // 52: program editor showing Blink (on-board LED + external LED), circuit running
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('ardblink'); FITLEFT(600); app.run(); });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { const c = MC(); SEL(c); MCU.openEditor(c); PLACE(610, 66, 580, 720); });
    await shot(page, '52-mcu-editor-blink.png');
  }
  // 53: running Arduino (button + INPUT_PULLUP) with the serial monitor full of events, LED lit
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('ardbutton'); FITLEFT(600); app.run(); });
    await page.waitForTimeout(600);
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => { const S = app.comps.find(c => c.type === 'button'); S.state.pressed = true; app.dirty = true; }); await page.waitForTimeout(450);
      await page.evaluate(() => { const S = app.comps.find(c => c.type === 'button'); S.state.pressed = false; app.dirty = true; }); await page.waitForTimeout(450);
    }
    await page.evaluate(() => { const S = app.comps.find(c => c.type === 'button'); S.state.pressed = true; app.dirty = true; const c = MC(); SEL(c); MCU.openEditor(c, true); PLACE(610, 66, 580, 720); });
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = document.querySelector('#mcu-win .mw-ser'); if (s) s.scrollTop = s.scrollHeight; });
    await shot(page, '53-mcu-serial-monitor.png');
  }
  // 54: potentiometer → analogRead → PWM on D9, oscilloscope shows the 490 Hz square wave
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('ardpwm'); app.run(); const P = app.comps.find(c => c.type === 'pot'); P.props.pos = 0.3; app.dirty = true; });
    await page.waitForTimeout(2000);
    await page.evaluate(() => SEL(MC()));
    await shot(page, '54-mcu-pwm-scope.png');
  }
  // 55: ATtiny85 chip on a 5 V supply blinking an LED on PB0
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('tinyblink'); app.run(); });
    await page.waitForTimeout(1800);
    await page.evaluate(() => SEL(MC()));
    // capture while the LED is on
    await page.waitForFunction(() => { const L = app.comps.find(c => c.type === 'led'); return L && L._m.I > 0.005; }, null, { timeout: 3000, polling: 20 }).catch(() => {});
    await page.evaluate(() => { app.pause(); app.refreshProps(); app.updateReadings && app.updateReadings(true); });
    await shot(page, '55-mcu-attiny85.png');
  }
  // 56: LiquidCrystal on a 1602 LCD
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('ardlcd'); app.run(); });
    await page.waitForTimeout(3500);
    await page.evaluate(() => SEL(MC()));
    await shot(page, '56-mcu-lcd1602.png');
  }
  // 57: compile error → message with line number, error line highlighted, ERR badge on the board
  {
    const page = await open('zh-CN');
    await page.evaluate(() => { app.loadExample('ardtraffic'); FITLEFT(600); app.run(); });
    await page.waitForTimeout(800);
    await page.evaluate(() => { const c = MC(); SEL(c); MCU.openEditor(c); PLACE(610, 66, 580, 720);
      const ta = document.querySelector('#mcu-win .mw-code'); ta.value = ta.value.replace(/digitalWrite\(RED, HIGH\);/, 'digitalWrite(RED, HIGH)').replace('delay(', 'dealy('); ta.dispatchEvent(new Event('input')); });
    await page.click('#mcu-win .mw-upload'); await page.waitForTimeout(600);
    await shot(page, '57-mcu-compile-error.png');
  }
  await browser.close();
})();
