// v12 tests: the additional microcontroller boards (Arduino Nano, Mega 2560, Pro Mini, ESP32 DevKit, Raspberry Pi Pico,
// STM32 Blue Pill, 8051 / STC89C52).  Per board: placement + default Blink timing (±1 %), power from USB / supply pins,
// brownout, analogRead scaling (resolution, reference), digitalRead with INPUT_PULLUP, PWM average, wrong-pin / API errors
// with line numbers, the libraries (Servo, LiquidCrystal, LiquidCrystal_I2C, DHT, DallasTemperature) on every
// Arduino-API board, the board examples (no convergence failures / errors / pass-overs), save / load, dictionary keys in
// all 10 languages and the pinout panel for every board.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const results = {}; const fails = [];
const check = (name, cond, info) => { results[name] = { pass: !!cond, info }; if (!cond) fails.push(name); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + JSON.stringify(info))); };
const BASE = process.env.URL || 'http://127.0.0.1:8765/index.html';
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt-BR'];
const NEW = ['nano', 'mega', 'promini', 'esp32', 'pico', 'bluepill', 'c51'];
const ARD = NEW.filter((b) => b !== 'c51');
const near = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, locale: 'en-US' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(BASE + '?fresh=1&lang=en'); await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.TOASTS = []; const o = app.toast.bind(app); app.toast = (m) => { TOASTS.push(String(m)); o(m); };
    window.W = (a, ia, b, ib) => { const p = app.termPos(a, ia), q = app.termPos(b, ib); return app.addWire(p[0], p[1], q[0], q[1], 1); };
    window.RUN = (sec) => { let bad = 0; const n = Math.round(sec / app.dt); for (let i = 0; i < n; i++) { app.simStep(); if (!app.net.converged) bad++; } return bad; };
    // terminal index by (the first word of) its name: 'D13', 'GPIO34', 'GP26', 'PA0', 'P1.0', '5V' …
    window.TN = (A, name) => DEFS[A.type].termNames.findIndex((n) => n === name || n.split(' ').includes(name) || n.startsWith(name + ' '));
    window.V = (A, ti) => app.net.v(A._nodes[ti]) - app.net.v(A._nodes[MCU.BOARDS[A.type].gnd]);
    window.ERR = (A) => { const rt = A.state.rt; return rt && rt.err ? { line: rt.err.line, text: MCU.errText(rt.err), compile: !!rt.err.compile } : null; };
    window.SER = (A) => (A.state.ser || '').trim().split(/\r?\n/);
    window.ST = (A) => MCU.statusOf(A);
    window.BAT = (A, plus, minus, v) => { const B = app.addComp('battery', 260, 160, 0, { V: v }); W(B, 1, A, plus); W(B, 0, A, minus); return B; };
    // place one board (+ optional extra parts), start from reset
    window.BRD = (t, code, props, extra) => {
      app.clearAll(); app.pause(); TOASTS.length = 0;
      const A = app.addComp(t, 600, 420, 0, Object.assign(code ? { code } : {}, props || {}));
      if (t === 'c51') { BAT(A, 39, 19, 5); }
      if (extra) extra(A);
      app.changed(); app.resetSim(); return A;
    };
    // per-board pins used by the tests: names on the part, numbers / constants in the program
    window.CFG = {
      nano: { vcc: '5V', v: 5, led: 13, adc: ['A0', 'A0', 10], din: ['D2', 2], pwm: ['D9', 9], sda: 'A4', scl: 'A5', lcd: [['D12', 12], ['D11', 11], ['D5', 5], ['D4', 4], ['D3', 3], ['D2', 2]], one: ['D7', 7], srv: ['D10', 10], v5: '5V' },
      mega: { vcc: '5V', v: 5, led: 13, adc: ['A15', 'A15', 10], din: ['D22', 22], pwm: ['D45', 45], sda: 'D20', scl: 'D21', lcd: [['D30', 30], ['D31', 31], ['D32', 32], ['D33', 33], ['D34', 34], ['D35', 35]], one: ['D40', 40], srv: ['D44', 44], v5: '5V' },
      promini: { vcc: 'VCC', v: 5, led: 13, adc: ['A0', 'A0', 10], din: ['D2', 2], pwm: ['D9', 9], sda: 'A4', scl: 'A5', lcd: [['D12', 12], ['D11', 11], ['D5', 5], ['D4', 4], ['D3', 3], ['D2', 2]], one: ['D7', 7], srv: ['D10', 10], v5: 'VCC' },
      esp32: { vcc: '3V3', v: 3.3, led: 2, adc: ['GPIO34', '34', 12], din: ['GPIO27', 27], pwm: ['GPIO18', 18], sda: 'GPIO21', scl: 'GPIO22', lcd: [['GPIO13', 13], ['GPIO12', 12], ['GPIO14', 14], ['GPIO27', 27], ['GPIO26', 26], ['GPIO25', 25]], one: ['GPIO4', 4], srv: ['GPIO19', 19], v5: 'VIN' },
      pico: { vcc: '3V3', v: 3.3, led: 25, adc: ['GP26', 'A0', 10], din: ['GP2', 2], pwm: ['GP15', 15], sda: 'GP4', scl: 'GP5', lcd: [['GP10', 10], ['GP11', 11], ['GP12', 12], ['GP13', 13], ['GP14', 14], ['GP16', 16]], one: ['GP7', 7], srv: ['GP8', 8], v5: 'VBUS' },
      bluepill: { vcc: '3.3V', v: 3.3, led: 'PC13', adc: ['PA0', 'PA0', 10], din: ['PB12', 'PB12'], pwm: ['PA8', 'PA8'], sda: 'PB7', scl: 'PB6', lcd: [['PB12', 'PB12'], ['PB13', 'PB13'], ['PB14', 'PB14'], ['PB15', 'PB15'], ['PA9', 'PA9'], ['PA10', 'PA10']], one: ['PB5', 'PB5'], srv: ['PB9', 'PB9'], v5: '5V' },
    };
    // logical pin index of the on-board LED (rt.outP is indexed by logical pin)
    // RC low-pass (10 kΩ · 10 µF, τ = 100 ms) on a pin: the average of a PWM signal, independent of the 0.2 ms sample grid
    window.RCF = (A, name) => { const R = app.addComp('resistor', 300, 640, 0, { R: 10000 }), C = app.addComp('capacitor', 420, 700, 0, { C: 10e-6 }); W(R, 0, A, TN(A, name)); W(R, 1, C, 0); W(C, 1, A, TN(A, 'GND')); window.__C = C; return C; };
    window.RCV = (sec) => { RUN(sec || 0.8); let s = 0; for (let i = 0; i < 500; i++) { app.simStep(); s += Math.abs(__C._m.V); } return +(s / 500).toFixed(3); };
    window.LEDK = (t) => { const B = MCU.BOARDS[t]; if (t === 'c51') return 8; if (t === 'bluepill') return B.pinOf(2 * 16 + 13); return B.pinOf(CFG[t].led); };
  });

  // ---------- 1. palette, placement, default Blink timing (±1 %) ----------
  {
    const r = await page.evaluate((NEW) => {
      const out = { pal: NEW.filter((t) => DEFS[t] && DEFS[t].cat === 'mcu').length, blink: {} };
      for (const t of NEW) {
        const A = BRD(t, null); const k = LEDK(t); const edges = []; let prev = null, bad = 0;
        const n = Math.round(2.3 / app.dt);
        for (let i = 0; i < n; i++) { app.simStep(); if (!app.net.converged) bad++; const rt = A.state.rt; const s = rt ? (rt.outP[k] ? 1 : 0) : null; if (prev !== null && s !== prev) edges.push(app.t); prev = s; }
        const iv = edges.slice(1).map((x, i) => x - edges[i]);
        out.blink[t] = { bad, st: ST(A), err: ERR(A), edges: edges.length, iv: iv.map((x) => +x.toFixed(4)), worst: iv.length ? Math.max(...iv.map((x) => Math.abs(x - 0.5) / 0.5)) : 1 };
      }
      return out;
    }, NEW);
    check('palette_mcu_category_has_7_new_boards', r.pal === 7, r.pal);
    for (const t of NEW) {
      const b = r.blink[t];
      check('blink_' + t + '_runs_converges', b.bad === 0 && b.st === 'run' && !b.err, b);
      check('blink_' + t + '_period_within_1pct', b.edges >= 4 && b.worst < 0.01, b);
    }
  }

  // ---------- 2. power: USB / supply pins, regulators, brownout ----------
  {
    const r = await page.evaluate(() => {
      const o = {};
      const run = (A, s) => { RUN(s || 0.1); return { st: ST(A), vcc: +(A._m.Vcc || 0).toFixed(3) }; };
      const pin = (A, n) => +V(A, TN(A, n)).toFixed(3);
      for (const t of ['nano', 'mega']) {
        let A = BRD(t, null); o[t + '_usb'] = Object.assign(run(A), { v5: pin(A, '5V'), v33: pin(A, t === 'mega' ? '3.3V' : '3V3') });
        A = BRD(t, null, { power: 'ext' }, (A) => BAT(A, TN(A, 'VIN'), TN(A, 'GND'), 9)); o[t + '_vin9'] = Object.assign(run(A), { v5: pin(A, '5V') });
        A = BRD(t, null, { power: 'ext' }, (A) => BAT(A, TN(A, 'VIN'), TN(A, 'GND'), 5.5)); o[t + '_vin55'] = Object.assign(run(A), { v5: pin(A, '5V') });
        A = BRD(t, null, { power: 'ext' }, (A) => BAT(A, TN(A, 'VIN'), TN(A, 'GND'), 2.5)); o[t + '_vin25'] = run(A);
        A = BRD(t, null, { power: 'ext' }); o[t + '_nopower'] = run(A);
      }
      let A = BRD('promini', null); o.pm_ftdi = run(A);
      A = BRD('promini', null, { variant: '3v8' }); o.pm_ftdi33 = run(A);
      A = BRD('promini', null, { power: 'ext' }, (A) => BAT(A, TN(A, 'RAW'), TN(A, 'GND'), 9)); o.pm_raw9 = run(A);
      A = BRD('promini', null, { power: 'ext', variant: '3v8' }, (A) => BAT(A, TN(A, 'RAW'), TN(A, 'GND'), 3.7)); o.pm_raw37 = run(A);
      A = BRD('promini', null, { power: 'ext' }, (A) => BAT(A, TN(A, 'RAW'), TN(A, 'GND'), 2.0)); o.pm_raw2 = run(A);
      A = BRD('esp32', null); o.esp_usb = Object.assign(run(A), { vin: pin(A, 'VIN') });
      A = BRD('esp32', null, { power: 'ext' }, (A) => BAT(A, TN(A, 'VIN'), TN(A, 'GND'), 5)); o.esp_vin5 = run(A);
      A = BRD('esp32', null, { power: 'ext' }, (A) => BAT(A, TN(A, '3V3'), TN(A, 'GND'), 3.0)); o.esp_33_30 = run(A);
      A = BRD('esp32', null, { power: 'ext' }, (A) => BAT(A, TN(A, '3V3'), TN(A, 'GND'), 2.3)); o.esp_33_23 = run(A);
      A = BRD('esp32', null, {}, (A) => W(A, TN(A, 'EN'), A, TN(A, 'GND'))); o.esp_en = run(A);
      A = BRD('pico', null); o.pico_usb = Object.assign(run(A), { vsys: pin(A, 'VSYS'), vbus: pin(A, 'VBUS') });
      A = BRD('pico', null, { power: 'ext' }, (A) => BAT(A, TN(A, 'VSYS'), TN(A, 'GND'), 3.0)); o.pico_vsys3 = run(A);
      A = BRD('pico', null, { power: 'ext' }, (A) => BAT(A, TN(A, 'VSYS'), TN(A, 'GND'), 1.5)); o.pico_vsys15 = run(A);
      A = BRD('pico', null, {}, (A) => W(A, TN(A, 'RUN'), A, TN(A, 'GND'))); o.pico_run = run(A);
      A = BRD('bluepill', null); o.bp_usb = Object.assign(run(A), { v5: pin(A, '5V') });
      A = BRD('bluepill', null, { power: 'ext' }, (A) => BAT(A, TN(A, '5V'), TN(A, 'GND'), 5)); o.bp_5v = run(A);
      A = BRD('bluepill', null, { power: 'ext' }, (A) => BAT(A, TN(A, '5V'), TN(A, 'GND'), 1.8)); o.bp_low = run(A);
      A = BRD('bluepill', null, {}, (A) => W(A, TN(A, 'NRST'), A, TN(A, 'GND'))); o.bp_nrst = run(A);
      A = BRD('c51', null); o.c51_5v = run(A);
      app.clearAll(); A = app.addComp('c51', 600, 420, 0, {}); BAT(A, 39, 19, 3.0); app.changed(); app.resetSim(); o.c51_3v = run(A);
      A = BRD('c51', null, {}, (A) => W(A, TN(A, 'RST'), A, TN(A, 'VCC'))); o.c51_rst = run(A);
      A = BRD('c51', null, {}, (A) => W(A, TN(A, 'EA'), A, TN(A, 'GND'))); o.c51_ea = Object.assign(run(A), { rd: DEFS.c51.readings(A).map((x) => x.join(': ')).join(' | ') });
      return o;
    });
    for (const t of ['nano', 'mega']) {
      check(t + '_usb_5v_and_3v3', r[t + '_usb'].st === 'run' && near(r[t + '_usb'].v5, 5, 0.05) && near(r[t + '_usb'].v33, 3.3, 0.1), r[t + '_usb']);
      check(t + '_vin_9v_regulated_5v', r[t + '_vin9'].st === 'run' && near(r[t + '_vin9'].v5, 5, 0.1), r[t + '_vin9']);
      check(t + '_vin_5v5_regulator_dropout', r[t + '_vin55'].st === 'run' && r[t + '_vin55'].v5 < 4.8 && r[t + '_vin55'].v5 > 3.8, r[t + '_vin55']);
      check(t + '_vin_2v5_brownout_off', r[t + '_vin25'].st !== 'run', r[t + '_vin25']);
      check(t + '_ext_without_supply_off', r[t + '_nopower'].st === 'off' && r[t + '_nopower'].vcc < 0.5, r[t + '_nopower']);
    }
    check('promini_ftdi_5v_and_3v3_variant', r.pm_ftdi.st === 'run' && near(r.pm_ftdi.vcc, 5, 0.05) && r.pm_ftdi33.st === 'run' && near(r.pm_ftdi33.vcc, 3.3, 0.05), [r.pm_ftdi, r.pm_ftdi33]);
    check('promini_raw_regulator_5v_and_3v3_liion', r.pm_raw9.st === 'run' && near(r.pm_raw9.vcc, 5, 0.1) && r.pm_raw37.st === 'run' && near(r.pm_raw37.vcc, 3.3, 0.1), [r.pm_raw9, r.pm_raw37]);
    check('promini_raw_2v_brownout', r.pm_raw2.st !== 'run', r.pm_raw2);
    check('esp32_usb_3v3_and_vin', r.esp_usb.st === 'run' && near(r.esp_usb.vcc, 3.3, 0.05) && r.esp_usb.vin > 4.5, r.esp_usb);
    check('esp32_vin_5v_ams1117', r.esp_vin5.st === 'run' && near(r.esp_vin5.vcc, 3.3, 0.05), r.esp_vin5);
    check('esp32_3v3_pin_brownout_2v43', r.esp_33_30.st === 'run' && r.esp_33_23.st !== 'run', [r.esp_33_30, r.esp_33_23]);
    check('esp32_en_low_holds_reset', r.esp_en.st === 'reset', r.esp_en);
    check('pico_usb_vbus_vsys_3v3', r.pico_usb.st === 'run' && near(r.pico_usb.vcc, 3.3, 0.05) && near(r.pico_usb.vbus, 5, 0.05) && r.pico_usb.vsys > 4.4 && r.pico_usb.vsys < 4.9, r.pico_usb);
    check('pico_vsys_3v_buck_boost_3v3', r.pico_vsys3.st === 'run' && near(r.pico_vsys3.vcc, 3.3, 0.05), r.pico_vsys3);
    check('pico_vsys_1v5_off', r.pico_vsys15.st !== 'run', r.pico_vsys15);
    check('pico_run_low_holds_reset', r.pico_run.st === 'reset', r.pico_run);
    check('bluepill_usb_and_5v_pin_3v3', r.bp_usb.st === 'run' && near(r.bp_usb.vcc, 3.3, 0.05) && near(r.bp_usb.v5, 5, 0.05) && r.bp_5v.st === 'run' && near(r.bp_5v.vcc, 3.3, 0.05), [r.bp_usb, r.bp_5v]);
    check('bluepill_low_supply_off', r.bp_low.st !== 'run', r.bp_low);
    check('bluepill_nrst_low_holds_reset', r.bp_nrst.st === 'reset', r.bp_nrst);
    check('c51_5v_runs_3v_brownout', r.c51_5v.st === 'run' && near(r.c51_5v.vcc, 5, 0.1) && r.c51_3v.st !== 'run', [r.c51_5v, r.c51_3v]);
    check('c51_rst_high_holds_reset', r.c51_rst.st === 'reset', r.c51_rst);
    check('c51_ea_low_held_with_note', r.c51_ea.st === 'reset' && /EA \(pin 31\) is LOW/.test(r.c51_ea.rd), r.c51_ea);
  }

  // ---------- 3. analogRead scaling, digitalRead + INPUT_PULLUP, PWM average ----------
  {
    const r = await page.evaluate((ARD) => {
      const o = {};
      const loop = (setup, body) => 'void setup() {\n  Serial.begin(9600);\n  ' + setup + '\n}\nvoid loop() {\n  ' + body + '\n  delay(20);\n}\n';
      const pot = (A, pos, ref) => { const P = app.addComp('pot', 600, 100, 0, { R: 10000, pos }); W(P, 0, A, TN(A, 'GND')); W(P, 1, A, TN(A, ref)); W(P, 2, A, TN(A, CFG[A.type].adc[0])); return P; };
      for (const t of ARD) {
        const C = CFG[t], max = (1 << C.adc[2]) - 1;
        const rd = (pos, res) => { const A = BRD(t, loop(res || '', 'Serial.println(analogRead(' + C.adc[1] + '));'), {}, (A) => pot(A, pos, C.vcc)); const bad = RUN(0.15); return { bad, v: +SER(A).slice(-1)[0], err: ERR(A) }; };
        o[t] = { max, mid: rd(0.5), q: rd(0.2) };
        if (t === 'pico' || t === 'bluepill') o[t].mid12 = rd(0.5, 'analogReadResolution(12);');
        // digitalRead with INPUT_PULLUP and a switch to GND
        const A = BRD(t, loop('pinMode(' + C.din[1] + ', INPUT_PULLUP);', 'Serial.println(digitalRead(' + C.din[1] + '));'), {}, (A) => { const S = app.addComp('switch', 800, 300, 0, {}); W(S, 0, A, TN(A, C.din[0])); W(S, 1, A, TN(A, 'GND')); window.__S = S; });
        RUN(0.1); const open = SER(A).slice(-1)[0]; __S.props.closed = true; app.dirty = true; RUN(0.1); o[t].din = [open, SER(A).slice(-1)[0], ERR(A)];
        // PWM: analogWrite(pin, 64) → time-averaged pin voltage = VCC · 64 / 255
        const P = BRD(t, 'void setup() {\n  pinMode(' + C.pwm[1] + ', OUTPUT);\n  analogWrite(' + C.pwm[1] + ', 64);\n}\nvoid loop() {}\n');
        RUN(0.05); let n = 0, hi = 0; const k = TN(P, C.pwm[0]);
        for (let i = 0; i < 1000; i++) { app.simStep(); const v = V(P, k); n++; if (v > C.v * 0.8) hi++; }
        const P2 = BRD(t, 'void setup() {\n  pinMode(' + C.pwm[1] + ', OUTPUT);\n  analogWrite(' + C.pwm[1] + ', 64);\n}\nvoid loop() {}\n', {}, (A) => RCF(A, C.pwm[0]));
        o[t].pwm = { avg: RCV(), want: +(C.v * 64 / 255).toFixed(3), hiFrac: hi / n, err: ERR(P) || ERR(P2) };
      }
      return o;
    }, ARD);
    for (const t of ARD) {
      const x = r[t];
      check('adc_' + t + '_half_scale_' + Math.log2(x.max + 1) + 'bit', x.mid.bad === 0 && !x.mid.err && Math.abs(x.mid.v - x.max / 2) <= x.max * 0.015, x.mid);
      const q = Math.min(Math.abs(x.q.v - 0.2 * x.max), Math.abs(x.q.v - 0.8 * x.max));
      check('adc_' + t + '_linear_20pct', q <= x.max * 0.015, { q: x.q, max: x.max });
      if (x.mid12) check('adc_' + t + '_analogReadResolution_12', Math.abs(x.mid12.v - 2047.5) <= 4095 * 0.015, x.mid12);
      check('digitalRead_' + t + '_input_pullup_and_switch', x.din[0] === '1' && x.din[1] === '0' && !x.din[2], x.din);
      check('pwm_' + t + '_average_25pct', !x.pwm.err && Math.abs(x.pwm.avg - x.pwm.want) <= x.pwm.want * 0.08 && x.pwm.hiFrac > 0.1 && x.pwm.hiFrac < 0.45, x.pwm);
    }
  }

  // ---------- 4. board-specific features (ESP32 DAC / touch / ledc / pulldown, Pico VSYS, Blue Pill LED, 8051 ports) ----------
  {
    const r = await page.evaluate(() => {
      const o = {};
      const ser = (t, code, props, extra, sec) => { const A = BRD(t, code, props, extra); const bad = RUN(sec || 0.15); return { bad, ser: SER(A).slice(-1)[0], err: ERR(A), A }; };
      const loop = (setup, body) => 'void setup() {\n  Serial.begin(9600);\n  ' + setup + '\n}\nvoid loop() {\n  ' + body + '\n  delay(20);\n}\n';
      { const x = ser('esp32', 'void setup() { dacWrite(25, 128); }\nvoid loop() {}\n'); o.dac = +V(x.A, TN(x.A, 'GPIO25')).toFixed(3); }
      { const x = ser('esp32', 'void setup() { dacWrite(25, 200); }\nvoid loop() {}\n', {}, (A) => W(A, TN(A, 'GPIO25'), A, TN(A, 'GPIO34'))); o.dacAdc = +V(x.A, TN(x.A, 'GPIO34')).toFixed(3); }
      o.touchOn = ser('esp32', loop('', 'Serial.println(touchRead(T0));'), { touch: String(MCU.BOARDS.esp32.pinOf(4)) }).ser;
      o.touchOff = ser('esp32', loop('', 'Serial.println(touchRead(T0));')).ser;
      { const x = ser('esp32', 'void setup() { ledcAttach(19, 5000, 10); ledcWrite(19, 256); }\nvoid loop() {}\n', {}, (A) => RCF(A, 'GPIO19')); o.ledc = [RCV(), x.err]; }
      o.pulldown = ser('esp32', loop('pinMode(18, INPUT_PULLDOWN); pinMode(19, INPUT_PULLUP);', 'Serial.print(digitalRead(18)); Serial.println(digitalRead(19));')).ser;
      o.int32 = ser('esp32', loop('long a = 100000; int b = 100000; Serial.println(a * 3 + b * 3);', '')).ser;
      o.mv = ser('esp32', loop('', 'Serial.println(analogReadMilliVolts(34));'), {}, (A) => { const B = app.addComp('battery', 300, 100, 0, { V: 1.5 }); W(B, 1, A, TN(A, 'GPIO34')); W(B, 0, A, TN(A, 'GND')); }).ser;
      o.pico_vsys = ser('pico', loop('analogReadResolution(12);', 'Serial.println(analogRead(A3));')).ser;
      o.pico_vbus = ser('pico', loop('', 'Serial.println(digitalRead(24));')).ser;
      { const x = ser('pico', 'void setup() { analogWriteRange(1000); analogWrite(15, 250); }\nvoid loop() {}\n', {}, (A) => RCF(A, 'GP15')); o.pico_range = [RCV(), x.err]; }
      { const A = BRD('bluepill', null); RUN(0.25); const a = A._m.IL; RUN(0.5); o.bp_led = [a, A._m.IL, V(A, TN(A, 'PC13'))]; }
      { const x = ser('c51', '#include <reg52.h>\nvoid main() {\n  P1 = 0xFE;\n  P2 = 0x0F;\n  while (1);\n}\n', {}, null, 0.02); const A = x.A; o.c51_ports = [V(A, TN(A, 'P1.0')), V(A, TN(A, 'P1.1')), V(A, TN(A, 'P2.0')), V(A, TN(A, 'P2.7')), x.err]; }
      { const x = ser('c51', '#include <reg52.h>\nvoid main() {\n  P0 = 0xFF;\n  while (1);\n}\n', {}, null, 0.02); const A = x.A; o.c51_p0_float = V(A, TN(A, 'P0.0')); }
      { const x = ser('c51', '#include <reg52.h>\nvoid main() {\n  P0 = 0xFF;\n  while (1);\n}\n', {}, (A) => { const R = app.addComp('resistor', 700, 200, 0, { R: 10000 }); W(R, 0, A, TN(A, 'P0.0')); W(R, 1, A, TN(A, 'VCC')); }, 0.02); o.c51_p0_pull = V(x.A, TN(x.A, 'P0.0')); }
      { const A = BRD('c51', '#include <reg52.h>\nsbit K = P3^2;\nsbit L = P1^0;\nvoid main() {\n  while (1) { L = K; }\n}\n', {}, (A) => { const S = app.addComp('switch', 700, 560, 0, {}); W(A, TN(A, 'P3.2'), S, 0); W(A, TN(A, 'GND'), S, 1); window.__S = S; }); RUN(0.02); const a = V(A, TN(A, 'P1.0')); __S.props.closed = true; app.dirty = true; RUN(0.02); o.c51_in = [a, V(A, TN(A, 'P1.0')), ERR(A)]; }
      { // crystal 12 MHz: the 11.0592 MHz delay loop runs 11.0592 / 12 as long
        const A = BRD('c51', null, { xtal: '12' }); const k = 8, e = []; let p = null; for (let i = 0; i < Math.round(1.6 / app.dt); i++) { app.simStep(); const s = A.state.rt ? A.state.rt.outP[k] : null; if (p !== null && s !== p) e.push(app.t); p = s; }
        o.c51_12 = e.slice(1).map((x, i) => +(x - e[i]).toFixed(4)); }
      return o;
    });
    check('esp32_dac_gpio25_half_scale', near(r.dac, 3.3 * 128 / 255, 0.06), r.dac);
    check('esp32_dac_to_adc_loopback', near(r.dacAdc, 3.3 * 200 / 255, 0.06), r.dacAdc);
    check('esp32_touchRead_touched_vs_untouched', +r.touchOn < 40 && +r.touchOff > 40, [r.touchOn, r.touchOff]);
    check('esp32_ledc_10bit_25pct', !r.ledc[1] && near(r.ledc[0], 0.825, 0.07), r.ledc);
    check('esp32_input_pulldown_and_pullup', r.pulldown === '01', r.pulldown);
    check('esp32_int_is_32_bit', r.int32 === '600000', r.int32);
    check('esp32_analogReadMilliVolts', Math.abs(+r.mv - 1500) <= 30, r.mv);
    check('pico_a3_reads_vsys_div3', Math.abs(+r.pico_vsys * 3 * 3.3 / 4095 - 4.7) < 0.25, r.pico_vsys);
    check('pico_gp24_vbus_sense_high_on_usb', r.pico_vbus === '1', r.pico_vbus);
    check('pico_analogWriteRange_1000', !r.pico_range[1] && near(r.pico_range[0], 0.825, 0.07), r.pico_range);
    check('bluepill_pc13_led_active_low', r.bp_led[0] > 1e-3 !== r.bp_led[1] > 1e-3, r.bp_led);
    check('c51_port_writes', r.c51_ports[0] < 0.5 && r.c51_ports[1] > 4.5 && r.c51_ports[2] > 4.5 && r.c51_ports[3] < 0.5 && !r.c51_ports[4], r.c51_ports);
    check('c51_p0_open_drain_needs_pullup', r.c51_p0_float < 1 && r.c51_p0_pull > 4.5, [r.c51_p0_float, r.c51_p0_pull]);
    check('c51_quasi_bidirectional_input', r.c51_in[0] > 4.5 && r.c51_in[1] < 0.5 && !r.c51_in[2], r.c51_in);
    check('c51_crystal_12mhz_timing', r.c51_12.length >= 2 && r.c51_12.every((x) => Math.abs(x - 0.499 * 11.0592 / 12) < 0.01), r.c51_12);
  }

  // ---------- 5. wrong pins / unsupported API: clear messages with line numbers ----------
  {
    const r = await page.evaluate(() => {
      const e = (t, code) => { const A = BRD(t, code); RUN(0.05); return ERR(A); };
      const S = (body) => 'void setup() {\n  ' + body + '\n}\nvoid loop() {}\n';
      return {
        nano_a6: e('nano', S('digitalRead(A6);')), nano_22: e('nano', S('digitalWrite(22, HIGH);')),
        mega_70: e('mega', S('pinMode(70, OUTPUT);')), mega_s1: e('mega', S('Serial1.begin(9600);')),
        pm_a7: e('promini', S('pinMode(A7, INPUT);')),
        esp_40: e('esp32', S('digitalWrite(40, HIGH);')), esp_6: e('esp32', S('pinMode(6, OUTPUT);')), esp_34: e('esp32', S('pinMode(34, OUTPUT);')),
        esp_34pu: e('esp32', S('pinMode(35, INPUT_PULLUP);')), esp_wifi: e('esp32', '// WiFi demo\n#include <WiFi.h>\nvoid setup() {}\nvoid loop() {}\n'),
        esp_bt: e('esp32', 'void setup() {\n  Serial.begin(9600);\n  WiFi.begin("x", "y");\n}\nvoid loop() {}\n'),
        esp_nodac: e('esp32', S('dacWrite(4, 10);')), esp_notouch: e('esp32', S('touchRead(5);')),
        pico_23: e('pico', S('pinMode(23, OUTPUT);')), pico_adc2: e('pico', S('analogRead(2);')), pico_dac: e('pico', S('dacWrite(25, 1);')),
        bp_noadc: e('bluepill', S('analogRead(PA8);')), bp_pd: e('nano', S('pinMode(2, INPUT_PULLDOWN);')),
        c51_api: e('c51', '#include <reg52.h>\nvoid main() {\n  pinMode(1, OUTPUT);\n}\n'), c51_sfr: e('c51', '#include <reg52.h>\nvoid main() {\n  TMOD = 0x01;\n  while (1);\n}\n'),
        c51_nomain: e('c51', '#include <reg52.h>\nvoid setup() {}\nvoid loop() {}\n'),
      };
    });
    const m = (x, re, line) => !!x && re.test(x.text) && (line === undefined || x.line === line);
    check('err_nano_a6_analog_only', m(r.nano_a6, /A6 is an analog-only input/, 2), r.nano_a6);
    check('err_nano_pin22_does_not_exist', m(r.nano_22, /does not exist on this board/, 2), r.nano_22);
    check('err_mega_pin70_does_not_exist', m(r.mega_70, /does not exist on this board/, 2), r.mega_70);
    check('err_mega_serial1_not_simulated', m(r.mega_s1, /Serial1.*only .Serial/, 2) && r.mega_s1.compile, r.mega_s1);
    check('err_promini_a7_analog_only', m(r.pm_a7, /A7 is an analog-only input/, 2), r.pm_a7);
    check('err_esp32_gpio40_does_not_exist', m(r.esp_40, /GPIO ?40 does not exist on this board/, 2), r.esp_40);
    check('err_esp32_gpio6_flash', m(r.esp_6, /GPIO ?6 is connected to the module.s SPI flash/, 2), r.esp_6);
    check('err_esp32_gpio34_input_only', m(r.esp_34, /GPIO ?34 is input-only/, 2) && m(r.esp_34pu, /GPIO ?35 is input-only/, 2), [r.esp_34, r.esp_34pu]);
    check('err_esp32_wifi_h_line_number', m(r.esp_wifi, /WiFi\.h.*not simulated/, 2) && r.esp_wifi.compile, r.esp_wifi);
    check('err_esp32_wifi_object_line_number', m(r.esp_bt, /WiFi.*not simulated/, 3), r.esp_bt);
    check('err_esp32_dac_touch_wrong_pin', m(r.esp_nodac, /has no DAC/, 2) && m(r.esp_notouch, /not a touch pin/, 2), [r.esp_nodac, r.esp_notouch]);
    check('err_pico_gp23_and_adc_pin', m(r.pico_23, /GP ?23 does not exist/, 2) && m(r.pico_adc2, /has no analog input/, 2), [r.pico_23, r.pico_adc2]);
    check('err_pico_dacwrite_board_api', m(r.pico_dac, /dacWrite\(\)\W* is not available on this board/, 2), r.pico_dac);
    check('err_bluepill_pa8_no_adc', m(r.bp_noadc, /PA8 has no analog input/, 2), r.bp_noadc);
    check('err_avr_input_pulldown', m(r.bp_pd, /INPUT_PULLDOWN/, 2) && r.bp_pd.compile, r.bp_pd);
    check('err_c51_arduino_api', m(r.c51_api, /pinMode\(\).*Arduino function/, 3), r.c51_api);
    check('err_c51_timer_sfr', m(r.c51_sfr, /TMOD.*only the port registers/, 3), r.c51_sfr);
    check('err_c51_no_main', m(r.c51_nomain, /void main\(\)/), r.c51_nomain);
  }

  // ---------- 6. libraries on every Arduino-API board ----------
  {
    const r = await page.evaluate((ARD) => {
      const o = {};
      for (const t of ARD) {
        const C = CFG[t]; const x = {};
        const N = (v) => (typeof v === 'string' ? v : String(v));
        // Servo
        { const A = BRD(t, '#include <Servo.h>\nServo s;\nvoid setup() {\n  s.attach(' + N(C.srv[1]) + ');\n  s.write(90);\n}\nvoid loop() {}\n', {}, (A) => { const M = app.addComp('servo', 900, 300, 0, {}); W(M, 0, A, TN(A, 'GND')); W(M, 1, A, TN(A, C.v5)); W(M, 2, A, TN(A, C.srv[0])); window.__M = M; });
          const bad = RUN(1.0); x.servo = { bad, ang: __M.state.ang, pw: __M.state.pw, err: ERR(A) }; }
        // DHT22
        { const A = BRD(t, '#include <DHT.h>\nDHT dht(' + N(C.one[1]) + ', DHT22);\nvoid setup() { Serial.begin(9600); dht.begin(); }\nvoid loop() { delay(2000); Serial.print(dht.readTemperature()); Serial.print(" "); Serial.println(dht.readHumidity()); }\n', {}, (A) => { const S = app.addComp('dht', 900, 300, 0, { model: 'DHT22', q: 23.4, q2: 61.2 }); W(S, 0, A, TN(A, C.vcc)); W(S, 1, A, TN(A, C.one[0])); W(S, 2, A, TN(A, 'GND')); });
          const bad = RUN(2.3); x.dht = { bad, ser: SER(A).slice(-1)[0], err: ERR(A) }; }
        // DS18B20 + 4.7 kΩ
        { const A = BRD(t, '#include <OneWire.h>\n#include <DallasTemperature.h>\nOneWire ow(' + N(C.one[1]) + ');\nDallasTemperature ds(&ow);\nvoid setup() { Serial.begin(9600); ds.begin(); }\nvoid loop() { ds.requestTemperatures(); Serial.println(ds.getTempCByIndex(0), 4); delay(200); }\n', {}, (A) => { const S = app.addComp('ds18b20', 900, 300, 0, { q: -10.3 }); W(S, 0, A, TN(A, 'GND')); W(S, 1, A, TN(A, C.one[0])); W(S, 2, A, TN(A, C.vcc)); const R = app.addComp('resistor', 900, 450, 0, { R: 4700 }); W(R, 0, S, 1); W(R, 1, S, 2); });
          const bad = RUN(1.5); x.ds = { bad, ser: SER(A).slice(-1)[0], err: ERR(A) }; }
        // LCD1602 I2C on the board's hardware SDA / SCL
        { const A = BRD(t, '#include <Wire.h>\n#include <LiquidCrystal_I2C.h>\nLiquidCrystal_I2C lcd(0x27, 16, 2);\nvoid setup() { lcd.init(); lcd.backlight(); lcd.print("hi ' + t + '"); }\nvoid loop() {}\n', {}, (A) => { const L = app.addComp('lcdi2c', 900, 200, 0, {}); W(L, 0, A, TN(A, 'GND')); W(L, 1, A, TN(A, C.v5)); W(L, 2, A, TN(A, C.sda)); W(L, 3, A, TN(A, C.scl)); window.__L = L; });
          const bad = RUN(0.8); x.i2c = { bad, text: DEFS.lcdi2c.text(__L, 1), diag: (A.state.rt && A.state.rt.libDiag) || '', err: ERR(A) }; }
        // parallel LCD1602 (LiquidCrystal), RW to GND, contrast pot near GND
        { const pins = C.lcd.map((p) => N(p[1])).join(', ');
          const A = BRD(t, '#include <LiquidCrystal.h>\nLiquidCrystal lcd(' + pins + ');\nvoid setup() { lcd.begin(16, 2); lcd.print("hello"); }\nvoid loop() {}\n', {}, (A) => {
            const L = app.addComp('lcd1602', 900, 150, 0, {}); window.__P = L; const G = TN(A, 'GND'), P5 = TN(A, C.v5);
            [[3, 0], [5, 1], [10, 2], [11, 3], [12, 4], [13, 5]].forEach(([li, k]) => W(L, li, A, TN(A, C.lcd[k][0])));
            W(L, 0, A, G); W(L, 4, A, G); W(L, 1, A, P5); W(L, 14, A, P5); W(L, 15, A, G);
            const P = app.addComp('pot', 1100, 400, 0, { R: 10000, pos: 0.1 }); W(P, 0, A, G); W(P, 1, A, P5); W(L, 2, P, 2); });
          const bad = RUN(0.8); x.lcd = { bad, text: DEFS.lcd1602.text(__P, 1), diag: (A.state.rt && A.state.rt.libDiag) || '', err: ERR(A) }; }
        o[t] = x;
      }
      return o;
    }, ARD);
    for (const t of ARD) {
      const x = r[t];
      check('lib_servo_' + t, x.servo.bad === 0 && !x.servo.err && near(x.servo.ang, 85, 3) && near(x.servo.pw, 1.472e-3, 3e-5), x.servo);
      check('lib_dht22_' + t, x.dht.bad === 0 && !x.dht.err && /^23\.40 61\.20$/.test(x.dht.ser), x.dht);
      check('lib_ds18b20_' + t, x.ds.bad === 0 && !x.ds.err && Number(x.ds.ser) === -10.3125, x.ds);
      check('lib_lcd_i2c_' + t, x.i2c.bad === 0 && !x.i2c.err && x.i2c.text.startsWith('hi ' + t) && !x.i2c.diag, x.i2c);
      check('lib_liquidcrystal_' + t, x.lcd.bad === 0 && !x.lcd.err && /hello/.test(x.lcd.text), x.lcd);
    }
  }

  // ---------- 7. board examples ----------
  {
    const r = await page.evaluate(() => {
      const o = {};
      for (const id of Object.keys(BOARD_EX)) {
        app.loadExample(id); app.running = false; app.resetSim(); TOASTS.length = 0;
        const A = app.comps.find((c) => DEFS[c.type].mcu); const P1 = [];
        let bad = 0; const n = Math.round(1.6 / app.dt);
        for (let i = 0; i < n; i++) { app.simStep(); if (!app.net.converged) bad++; if (id === 'c51run' && i % 250 === 0 && A.state.rt) P1.push(A.state.rt.latch ? A.state.rt.latch[1] : null); }
        o[id] = { board: A.type, want: BOARD_EX[id].board, bad, st: ST(A), err: ERR(A), pass: app.findPassOvers().length, ser: SER(A).slice(-1)[0] || '', n: app.comps.length, p1: [...new Set(P1)].length, toasts: TOASTS.filter((x) => /error|wrong|not /i.test(x)) };
      }
      o.menu = Object.keys(BOARD_EX).filter((id) => EXAMPLES.some((e) => e.id === id)).length;
      return o;
    });
    check('board_examples_in_menu_14', r.menu === 14, r.menu);
    for (const [id, x] of Object.entries(r)) {
      if (id === 'menu') continue;
      check('example_' + id + '_runs', x.board === x.want && x.bad === 0 && x.st === 'run' && !x.err && x.pass === 0 && x.toasts.length === 0, x);
    }
    check('example_nanoana_serial', /^A7 = \d+$/.test(r.nanoana.ser), r.nanoana.ser);
    check('example_megabar_serial', /^A15 = \d+  segments = \d$/.test(r.megabar.ser), r.megabar.ser);
    check('example_pmbatt_reads_cell', (() => { const m = /battery: (\d\.\d\d) V/.exec(r.pmbatt.ser); return m && +m[1] > 3.0 && +m[1] < 4.3; })(), r.pmbatt.ser);
    check('example_espdac_dac_adc_touch', (() => { const m = /DAC=(\d+) ADC=(\d+) mV=(\d+) touch=yes/.exec(r.espdac.ser); return m && Math.abs(+m[2] - (+m[1]) * 4095 / 255) < 60; })(), r.espdac.ser);
    check('example_picoadc_vsys', /ADC0=\d+  VSYS=4\.\d\d V/.test(r.picoadc.ser), r.picoadc.ser);
    check('example_bpadc_serial', /^PA0=\d+  \d\.\d{3} V$/.test(r.bpadc.ser), r.bpadc.ser);
    check('example_c51run_pattern_moves', r.c51run.p1 >= 4, r.c51run);
  }

  // ---------- 8. save / load ----------
  {
    const r = await page.evaluate((NEW) => {
      const PROPS = { nano: { power: 'ext' }, mega: { power: 'usb' }, promini: { variant: '3v8' }, esp32: { touch: String(MCU.BOARDS.esp32.pinOf(4)) }, pico: { power: 'usb' }, bluepill: { power: 'usb' }, c51: { xtal: '12' } };
      const o = {};
      for (const t of NEW) {
        const A = BRD(t, null, PROPS[t], t === 'nano' ? (A) => BAT(A, TN(A, 'VIN'), TN(A, 'GND'), 9) : null); RUN(0.1);
        const before = JSON.stringify(A.props); const json = JSON.stringify(app.serialize());
        app.clearAll(); app.load(json); app.resetSim(); const bad = RUN(0.6);
        const B = app.comps.find((c) => c.type === t);
        o[t] = { same: !!B && JSON.stringify(B.props) === before, bad, st: B && ST(B) };
      }
      return o;
    }, NEW);
    for (const t of NEW) check('save_load_' + t, r[t].same && r[t].bad === 0 && r[t].st === 'run', r[t]);
  }

  // ---------- 9. dictionaries: v12 keys in all 10 languages ----------
  {
    const d = await page.evaluate(({ LANGS, NEW }) => {
      const keys = new Set();
      for (const [, , k] of I18N.statics()) { const t = k.split('.')[1]; if (k.startsWith('c.') && NEW.includes(t)) { const v = I18N._orig.get(k); if (typeof v === 'string' && /[\u4e00-\u9fff]/.test(v)) keys.add(k); } }
      for (const id of Object.keys(BOARD_EX)) { keys.add('ex.' + id); keys.add('exd.' + id); }
      ['mcu.p.power', 'mcu.p.lang', 'mcu.p.code', 'mcu.p.touch', 'mcu.p.variant', 'mcu.p.xtal', 'mcu.o.touch.none', 'mcu.ea_low'].forEach((k) => keys.add(k));
      ['nowifi', 'c51_api', 'c51_sfr', 'board_api', 'no_main', 'noserialn'].forEach((k) => keys.add('mcu.e.' + k));
      ['nopin', 'nopin_flash', 'inonly', 'nopulldown', 'noadc', 'nodac', 'notouch', 'noi2c', 'anaonly'].forEach((k) => keys.add('mcu.r.' + k));
      const H = MCU_HELP_DATA;
      for (const b of NEW) {
        keys.add('help.intro.' + b);
        for (let i = 1; i <= H.LIMITS[b]; i++) keys.add('help.lim.' + b + '.' + i);
        for (let i = 1; i <= H.SIMB[b]; i++) keys.add('help.simb.' + b + '.' + i);
        for (const row of H.PINS[b]) { row.tags.forEach((x) => keys.add('help.tag.' + x)); if (row.note) keys.add('help.note.' + row.note); }
      }
      const out = { n: keys.size, missing: {}, ph: [], same: {} };
      const en = I18N.dicts.en;
      for (const L of LANGS) {
        const D = I18N.dicts[L]; const m = [...keys].filter((k) => !(k in D)); if (m.length) out.missing[L] = m.slice(0, 6);
        for (const k of keys) { if (!(k in D) || !(k in en)) continue; const a = (en[k].match(/\{\w+\}/g) || []).sort().join(), b = (D[k].match(/\{\w+\}/g) || []).sort().join(); if (a !== b) out.ph.push(L + ':' + k); }
      }
      return out;
    }, { LANGS, NEW });
    check('locale_keys_v12_all_10_languages', d.n > 180 && Object.keys(d.missing).length === 0, d);
    check('locale_v12_placeholders_kept', d.ph.length === 0, d.ph.slice(0, 5));
  }

  // ---------- 10. pinout panel for every board (en + zh-CN), board switch lists all 9 boards ----------
  for (const L of ['en', 'zh-CN']) {
    const p2 = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    p2.on('pageerror', (e) => errors.push(L + ': ' + e.message));
    await p2.goto(BASE + '?fresh=1&lang=' + L); await p2.waitForTimeout(300);
    const r = {};
    for (const b of NEW) {
      await p2.evaluate(() => MCUHELP.open('arduino'));
      await p2.click('.pw-board[data-b="' + b + '"]'); await p2.waitForTimeout(80);
      r[b] = await p2.evaluate((b) => {
        const w = document.querySelector('#pin-win'); const t = w.innerText;
        const nEx = Object.keys(BOARD_EX).filter((id) => BOARD_EX[id].board === b).length;
        return { boards: w.querySelectorAll('.pw-board').length, on: (w.querySelector('.pw-board.on') || {}).dataset.b, svg: !!w.querySelector('svg.pm-svg'), rows: w.querySelectorAll('tbody tr').length, want: MCU_HELP_DATA.PINS[b].length,
          ex: w.querySelectorAll('.pw-ex').length, nEx, raw: (t.match(/\b(help|mcu|ex|exd)\.[a-z0-9_]+\.[a-z0-9_.]+/g) || []).slice(0, 3), han: /[\u4e00-\u9fff]/.test(t), lims: w.querySelectorAll('#pw-limits + ul li, .pw-lim li').length };
      }, b);
    }
    for (const b of NEW) {
      const x = r[b];
      check('help_panel_' + L + '_' + b, x.boards === 9 && x.on === b && x.svg && x.rows >= x.want && x.ex === x.nEx && x.raw.length === 0 && (L === 'en' ? !x.han : x.han), x);
    }
    // load an example from the panel
    if (L === 'en') {
      const ok = await p2.evaluate(() => { MCUHELP.open('esp32'); const b = document.querySelector('.pw-load[data-id="espdac"]'); if (b) b.click(); return !!b && app.comps.some((c) => c.type === 'esp32') && app.comps.some((c) => c.type === 'led'); });
      check('help_panel_loads_board_example', ok, ok);
    }
    await p2.close();
  }

  check('no_page_errors', errors.length === 0, errors.slice(0, 5));
  fs.writeFileSync(path.join(__dirname, 'test14-report.json'), JSON.stringify(results, null, 1));
  console.log(fails.length ? 'FAILED: ' + fails.length : 'ALL ' + Object.keys(results).length + ' PASSED');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
