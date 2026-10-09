// v11 tests: the sensor parts (placement, convergence, datasheet values, readings, translated in all 10 languages),
// optional signal sources, save / load, the MCU sensor libraries (pulseIn with the HC-SR04, DHT, OneWire +
// DallasTemperature), the LCD diagnostics (contrast, wrong pins, missing begin(), I2C wiring / address / power) and the
// new LCD1602 I2C part with LiquidCrystal_I2C / Wire, palette search, the sensors section of the pinout panel and the
// sensor examples (all run without convergence failures, library problems or runtime errors).
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const results = {}; const fails = [];
const check = (name, cond, info) => { results[name] = { pass: !!cond, info }; if (!cond) fails.push(name); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + JSON.stringify(info))); };
const BASE = process.env.URL || 'http://127.0.0.1:8765/index.html';
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt-BR'];
const SIMP = fs.readFileSync(path.join(__dirname, 'test9.js'), 'utf8').match(/const SIMP = '([^']+)'/)[1];
const near = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  const mk = async (url, opts) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 860 }, locale: 'en-US' }, opts || {}));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(url + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(url + ' console: ' + m.text()); });
    await page.goto(url); await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.TOASTS = []; const o = app.toast.bind(app); app.toast = (m) => { TOASTS.push(String(m)); o(m); };
      window.TP = (c, i) => app.termPos(c, i);
      window.W = (a, i, b, j) => app.addWire(...TP(a, i), ...TP(b, j));
      window.RUN = (sec) => { let bad = 0; const n = Math.round(sec / app.dt); for (let i = 0; i < n; i++) { app.simStep(); if (!app.net.converged) bad++; } return bad; };
      window.RT = (A) => A.state.rt || {};
      // an Arduino with a program and one sensor wired pin-to-pin: wires = [[sensor terminal, arduino terminal], ...]
      window.SETUP = (type, code, wires, props, extra) => {
        app.clearAll(); TOASTS.length = 0;
        const A = app.addComp('arduino', 400, 380, 0, { code }), S = app.addComp(type, 400, 750, 0, props || {});
        for (const [si, ai] of wires) W(S, si, A, ai);
        if (extra) extra(A, S);
        app.changed(); return [A, S];
      };
    });
    return { ctx, page };
  };

  // ---------- 1. dictionaries: every v11 key in all 10 locales, placeholders kept ----------
  {
    const { ctx, page } = await mk(BASE + '?fresh=1');
    const d = await page.evaluate((LANGS) => {
      const zh = I18N.dicts['zh-CN'];
      const sensorTypes = Object.keys(DEFS).filter(t => DEFS[t].cat === 'sensor').concat(['lcdi2c']);
      const keys = new Set();
      for (const [, , k] of I18N.statics()) { const t = k.split('.')[1]; if ((k.startsWith('c.') && sensorTypes.includes(t)) || k.startsWith('sens.') || /^exd?\.(sn)/.test(k)) { const v = I18N._orig.get(k); if (typeof v === 'string' && /[\u4e00-\u9fff]/.test(v)) keys.add(k); } }
      Object.keys(zh).filter(k => /^(sens\.|lcdi2c\.|mcu\.lib\.|help\.s\.|lcd1602\.(dark_readable|contrast_wrong|contrast_hint|mcu_not_init)|h\.search_)/.test(k)).forEach(k => keys.add(k));
      ['help.nav.sensors', 'help.u.lcd.4'].concat(Object.keys(SENSOR_EX).flatMap(id => ['ex.' + id, 'exd.' + id])).forEach(k => keys.add(k));
      const out = { n: keys.size, missing: {}, ph: [] };
      for (const L of LANGS) { const D = I18N.dicts[L]; const m = [...keys].filter(k => !(k in D)); if (m.length) out.missing[L] = m.slice(0, 5); for (const k of keys) { if (!(k in D) || !(k in zh)) continue; const a = (zh[k].match(/\{\w+\}/g) || []).sort().join(), b = (D[k].match(/\{\w+\}/g) || []).sort().join(); if (a !== b) out.ph.push(L + ':' + k); } }
      out.sensorCount = MCU_HELP_DATA.SENSORS.filter(x => DEFS[x[0]] && DEFS[x[0]].cat === 'sensor').length;
      return out;
    }, LANGS);
    check('locale_keys_v11_all_10_languages', d.n > 200 && Object.keys(d.missing).length === 0, d);
    check('locale_placeholders_kept', d.ph.length === 0, d.ph.slice(0, 5));
    check('sensor_category_has_25_parts', d.sensorCount >= 25, d.sensorCount);
    await ctx.close();
  }

  // ---------- 2. every sensor part: places, converges with a 5 V supply, readings are finite and translated ----------
  for (const L of ['en', 'zh-CN', 'ru']) {
    const { ctx, page } = await mk(BASE + '?fresh=1&lang=' + L, { locale: L });
    const r = await page.evaluate(() => {
      const out = {}; const VN = ['VCC', '+5V', '+Vs', '+', 'VDD'], GN = ['GND', '−'];
      for (const t of MCU_HELP_DATA.SENSORS.map(x => x[0])) {
        try {
          app.clearAll(); const d = DEFS[t];
          const S = app.addComp(t, 400, 300, 0, {}), B = app.addComp('battery', 400, 700, 0, { V: 5 });
          const vi = d.termNames.findIndex(n => VN.includes(n)), gi = d.termNames.findIndex(n => GN.includes(n));
          if (vi < 0) { const R = app.addComp('resistor', 700, 300, 0, { R: 10000 }); W(B, 1, R, 0); W(R, 1, S, 0); W(S, 1, B, 0); }
          else { W(B, 1, S, vi); if (gi >= 0) W(S, gi, B, 0); }
          app.changed(); const bad = RUN(0.05);
          app.sel = { comp: S }; app.refreshProps();
          const rd = (d.readings ? d.readings(S) : []).map(x => x.join(': ')).join(' | ');
          const props = document.querySelectorAll('#props .field').length, qty = document.querySelectorAll('#props .field.qty').length;
          out[t] = { bad, nan: /NaN|undefined/.test(rd), han: /[\u4e00-\u9fff]/.test(rd), raw: /\b(sens|lcdi2c|mcu)\.[a-z_.]+/.test(rd), props, qty, icon: typeof d.draw === 'function', name: d.name };
        } catch (e) { out[t] = { err: e.message }; }
      }
      return out;
    });
    const bad = Object.entries(r).filter(([t, v]) => v.err || v.bad || v.nan || v.raw || (L !== 'zh-CN' && v.han) || !v.icon || !v.props);
    check('sensors_place_converge_readings_' + L, bad.length === 0, bad.slice(0, 4));
    if (L === 'en') check('sensors_have_quantity_slider', Object.entries(r).filter(([t, v]) => !['lcdi2c'].includes(t) && !v.qty).length === 0, Object.entries(r).filter(([t, v]) => !v.qty).map(x => x[0]));
    await ctx.close();
  }

  const { ctx, page } = await mk(BASE + '?fresh=1');

  // ---------- 3. datasheet values ----------
  {
    const r = await page.evaluate(() => {
      const out = {};
      const supply = (t, props, vi, gi, oi) => { app.clearAll(); const S = app.addComp(t, 400, 300, 0, props), B = app.addComp('battery', 400, 700, 0, { V: 5 }); W(B, 1, S, vi); W(S, gi, B, 0); app.changed(); RUN(0.02); return [S, app.net]; };
      let [S] = supply('lm35', { q: 25 }, 0, 2); out.lm35 = S._m.Vo;
      [S] = supply('tmp36', { q: 25 }, 0, 2); out.tmp36 = S._m.Vo;
      [S] = supply('acs712', { range: 5, q: 5 }, 0, 2); out.acs5 = S._m.Vo;
      [S] = supply('acs712', { range: 20, q: -10 }, 0, 2); out.acs20 = S._m.Vo;
      [S] = supply('pressure', { model: 'mpx5010', q: 5 }, 0, 1); out.mpx = S._m.Vo !== undefined ? S._m.Vo : S._m.V;
      // ACS712 measuring a real current: 12 V battery → IP+ → IP− → 6 Ω resistor
      app.clearAll(); const A = app.addComp('acs712', 400, 300, 0, { range: 5, q: 0 }), B5 = app.addComp('battery', 200, 600, 0, { V: 5 }), B12 = app.addComp('battery', 700, 600, 0, { V: 12 }), R = app.addComp('resistor', 700, 400, 1, { R: 6 });
      W(B5, 1, A, 0); W(A, 2, B5, 0); W(B12, 1, A, 3); W(A, 4, R, 0); W(R, 1, B12, 0); app.changed(); out.acsBad = RUN(0.02); out.acsReal = A._m.Vo; out.acsI = A._m.Iip;
      return out;
    });
    check('lm35_25C_250mV', near(r.lm35, 0.250, 0.001), r.lm35);
    check('tmp36_25C_750mV', near(r.tmp36, 0.750, 0.002), r.tmp36);
    check('acs712_5A_at_5A_2.5_plus_0.185x5', near(r.acs5, 2.5 + 0.185 * 5, 0.01), r.acs5);
    check('acs712_20A_at_minus10A', near(r.acs20, 2.5 - 0.1 * 10, 0.01), r.acs20);
    check('mpx5010_formula', near(r.mpx, 5 * (0.09 * 5 + 0.04), 0.02), r.mpx);
    check('acs712_senses_real_ip_current_isolated', r.acsBad === 0 && near(r.acsI, 2.0, 0.02) && near(r.acsReal, 2.5 + 0.185 * r.acsI, 0.01), r);
  }

  // ---------- 4. MCU libraries: HC-SR04 / pulseIn, DHT, DS18B20, encoder, PIR ----------
  {
    const r = await page.evaluate(() => {
      const out = {};
      let [A, S] = SETUP('hcsr04', `const int T = 9, E = 10;
void setup() { Serial.begin(9600); pinMode(T, OUTPUT); pinMode(E, INPUT); }
void loop() { digitalWrite(T, LOW); delayMicroseconds(2); digitalWrite(T, HIGH); delayMicroseconds(10); digitalWrite(T, LOW);
  unsigned long d = pulseIn(E, HIGH, 30000); Serial.println(d); delay(60); }`, [[0, 20], [1, 9], [2, 10], [3, 23]], { q: 100 });
      out.srBad = RUN(0.5); out.srErr = RT(A).err || null; out.sr = (A.state.ser || '').trim().split(/\s+/).map(Number).slice(-3);
      S.props.q = 30; RUN(0.3); out.sr30 = (A.state.ser || '').trim().split(/\s+/).map(Number).slice(-1)[0];
      S.props.q = 600; RUN(0.3); out.srFar = (A.state.ser || '').trim().split(/\s+/).map(Number).slice(-1)[0];
      // DHT22 / DHT11 via the DHT library
      const dhtCode = (t) => `#include <DHT.h>
DHT dht(2, ${t});
void setup() { Serial.begin(9600); dht.begin(); }
void loop() { delay(2000); float h = dht.readHumidity(); float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) { Serial.println("fail"); return; } Serial.print(t); Serial.print(" "); Serial.println(h); }`;
      [A, S] = SETUP('dht', dhtCode('DHT22'), [[0, 20], [1, 2], [2, 23]], { model: 'DHT22', q: 23.4, q2: 61.2 });
      out.dhtBad = RUN(4.3); out.dht22 = (A.state.ser || '').trim(); out.dhtErr = RT(A).err || null;
      [A, S] = SETUP('dht', dhtCode('DHT11'), [[0, 20], [1, 2], [2, 23]], { model: 'DHT11', q: 23.4, q2: 61.2 });
      RUN(2.2); out.dht11 = (A.state.ser || '').trim();
      [A, S] = SETUP('dht', dhtCode('DHT22'), [[0, 20], [2, 23]], { model: 'DHT22' });
      RUN(2.2); out.dhtNoWire = (A.state.ser || '').trim(); out.dhtNoWireToast = TOASTS.join(' | '); out.dhtNoWireDiag = RT(A).libDiag;
      // DS18B20 with and without the 4.7 kΩ pull-up
      const dsCode = `#include <OneWire.h>
#include <DallasTemperature.h>
OneWire oneWire(4);
DallasTemperature sensors(&oneWire);
void setup() { Serial.begin(9600); sensors.begin(); Serial.println(sensors.getDeviceCount()); }
void loop() { sensors.requestTemperatures(); Serial.println(sensors.getTempCByIndex(0), 4); delay(200); }`;
      const pull = (A, S) => { const R = app.addComp('resistor', 700, 600, 1, { R: 4700 }); W(R, 0, S, 1); W(R, 1, S, 2); };
      [A, S] = SETUP('ds18b20', dsCode, [[0, 23], [1, 4], [2, 20]], { q: -10.3 }, pull);
      out.dsBad = RUN(2.0); out.ds = (A.state.ser || '').trim().split(/\s+/); out.dsErr = RT(A).err || null;
      [A, S] = SETUP('ds18b20', dsCode, [[0, 23], [1, 4], [2, 20]], { q: 21 });
      RUN(1.5); out.dsNoPull = (A.state.ser || '').trim().split(/\s+/).slice(-1)[0]; out.dsNoPullToast = TOASTS.join(' | ');
      // rotary encoder: three clockwise detents, then one counter-clockwise
      app.loadExample('snenc'); app.running = false; const E = app.comps.find(c => c.type === 'encoder'); E.props.spin = 0; app.resetSim(); TOASTS.length = 0;
      RUN(0.3); for (const k of ['cw', 'cw', 'cw', 'ccw']) { DEFS.encoder.act(E, k, app); RUN(0.15); }
      const AE = app.comps.find(c => DEFS[c.type].mcu); out.enc = (AE.state.ser || '').trim().split(/\r?\n/).slice(-1)[0];
      // PIR: click "walk" → OUT 3.3 V for Tx, then low
      app.clearAll(); const P = app.addComp('pir', 400, 300, 0, { tx: 1, mode: 'L' }), B = app.addComp('battery', 400, 700, 0, { V: 5 });
      W(B, 1, P, 0); W(P, 2, B, 0); app.changed(); RUN(0.1); const v0 = P._m.Vo; DEFS.pir.act(P, 'walk', app); RUN(0.3); const v1 = P._m.Vo; RUN(2.5); out.pir = [v0, v1, P._m.Vo];
      return out;
    });
    const ideal = 2 * 1.0 / 343 * 1e6;
    check('hcsr04_100cm_pulseIn_5.83ms_within_2pct', r.srBad === 0 && !r.srErr && r.sr.length === 3 && r.sr.every(x => Math.abs(x - ideal) / ideal < 0.02), { sr: r.sr, ideal, err: r.srErr });
    check('hcsr04_30cm_and_out_of_range', Math.abs(r.sr30 - ideal * 0.3) / (ideal * 0.3) < 0.03 && (r.srFar === 0 || r.srFar > 30000 || near(r.srFar, 38000, 2000)), { sr30: r.sr30, far: r.srFar });
    check('dht22_library_reads_values', r.dhtBad === 0 && !r.dhtErr && /23\.40 61\.20/.test(r.dht22), r.dht22);
    check('dht11_integer_resolution', /^23\.00 61\.00$/m.test(r.dht11), r.dht11);
    check('dht_not_wired_nan_and_toast', /fail/.test(r.dhtNoWire) && /D2|pin 2/.test(r.dhtNoWireToast) && /DHT/.test(r.dhtNoWireToast) && !!r.dhtNoWireDiag, r);
    check('ds18b20_onewire_dallas', r.dsBad === 0 && !r.dsErr && r.ds[0] === '1' && Number(r.ds[r.ds.length - 1]) === -10.3125, r.ds.slice(0, 4).concat(r.ds.slice(-1)));
    check('ds18b20_without_pullup_minus127_and_toast', r.dsNoPull === '-127.0000' && /4\.7 kΩ/.test(r.dsNoPullToast), r);
    check('encoder_counts_detents', r.enc === 'count = 2', r.enc);
    check('pir_walk_output_3v3_then_low', r.pir[0] < 0.3 && near(r.pir[1], 3.3, 0.2) && r.pir[2] < 0.3, r.pir);
  }

  // ---------- 5. signal sources and the property panel ----------
  {
    const r = await page.evaluate(() => {
      app.clearAll(); const S = app.addComp('lm35', 400, 300, 0, { q: 25, sig: 'sine', smin: 10, smax: 50, sper: 4 }), B = app.addComp('battery', 400, 700, 0, { V: 5 });
      W(B, 1, S, 0); W(S, 2, B, 0); app.changed();
      const at = (t) => { while (app.t < t - 1e-9) app.simStep(); return S._m.Vo; };
      const v = [at(0.0002), at(1), at(2), at(3)];
      app.sel = { comp: S }; app.refreshProps(); const f1 = [...document.querySelectorAll('#props [data-k]')].map(e => e.dataset.k);
      S.props.sig = 'const'; app.refreshProps(); const f2 = [...document.querySelectorAll('#props [data-k]')].map(e => e.dataset.k);
      // tri / square / ramp shapes
      const val = (sig, t) => { S.props.sig = sig; return SENS.Q ? null : null; };
      return { v, f1: [...new Set(f1)], f2: [...new Set(f2)] };
    });
    check('signal_source_sine_animates_lm35', near(r.v[0], 0.10, 0.003) && near(r.v[1], 0.30, 0.004) && near(r.v[2], 0.50, 0.004) && near(r.v[3], 0.30, 0.004), r.v);
    check('signal_source_fields_shown_only_when_active', ['smin', 'smax', 'sper', 'sig'].every(k => r.f1.includes(k)) && r.f2.includes('sig') && !r.f2.includes('smin'), r);
  }

  // ---------- 6. save / load round trip ----------
  {
    const r = await page.evaluate(() => {
      app.loadExample('snsultra'); app.running = false; RUN(0.5);
      const S = app.comps.find(c => c.type === 'hcsr04'); S.props.tair = 30;
      const json = JSON.stringify(app.serialize());
      app.clearAll(); app.load(json); app.resetSim(); const bad = RUN(1.0);
      const S2 = app.comps.find(c => c.type === 'hcsr04'), A = app.comps.find(c => DEFS[c.type].mcu), L = app.comps.find(c => c.type === 'lcd1602');
      return { bad, props: JSON.stringify(S2.props), sameProps: JSON.stringify(S2.props) === JSON.stringify(S.props), lcd: DEFS.lcd1602.text(L, 2), ser: (A.state.ser || '').length, n: app.comps.length };
    });
    check('save_load_sensor_circuit', r.bad === 0 && r.sameProps && /cm/.test(r.lcd) && r.ser > 0, r);
  }

  // ---------- 7. LCD diagnostics (parallel LCD1602) ----------
  {
    const r = await page.evaluate(() => {
      const out = {};
      const code6 = `#include <LiquidCrystal.h>
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
void setup() { lcd.begin(16, 2); lcd.print("hello, world!"); }
void loop() { lcd.setCursor(0, 1); lcd.print(millis() / 1000); delay(100); }`;
      const tut = (code, opts = {}) => {
        app.clearAll(); TOASTS.length = 0;
        const A = app.addComp('arduino', 400, 500, 0, { code }), Lc = app.addComp('lcd1602', 400, 120, 0, {});
        for (const [li, p] of (opts.map || [[3, 12], [5, 11], [10, 5], [11, 4], [12, 3], [13, 2]])) W(Lc, li, A, p);
        W(Lc, 0, A, 23); W(Lc, 4, A, 23); W(Lc, 15, A, 23);
        const P = app.addComp('pot', 800, 300, 0, { R: 10000, pos: opts.pos !== undefined ? opts.pos : 0.5 }), R = app.addComp('resistor', 800, 400, 0, { R: 220 });
        W(Lc, 1, A, 20); W(P, 0, A, 20); W(P, 1, A, 24); W(Lc, 2, P, 2); W(Lc, 14, R, 0); W(R, 1, A, 20);
        app.changed(); const bad = RUN(1.0);
        return { bad, text: DEFS.lcd1602.text(Lc, 1) + '|' + DEFS.lcd1602.text(Lc, 2), ct: DEFS.lcd1602.contrast(Lc), diag: RT(A).libDiag || '', toasts: TOASTS.join(' | '), rd: DEFS.lcd1602.readings(Lc).map(x => x.join(': ')).join(' / '), init: !!Lc.state.init, err: RT(A).err || null };
      };
      out.ex = (() => { app.loadExample('ardlcd'); app.running = false; RUN(1.2); const L = app.comps.find(c => c.type === 'lcd1602'); return { text: DEFS.lcd1602.text(L, 1), ct: DEFS.lcd1602.contrast(L), diag: RT(app.comps.find(c => DEFS[c.type].mcu)).libDiag || '' }; })();
      out.potMid = tut(code6);
      out.potLow = tut(code6, { pos: 0.1 });
      out.potHigh = tut(code6, { pos: 0.9 });
      out.wrong = tut(code6, { map: [[3, 12], [5, 11], [10, 5], [11, 4], [12, 3], [13, 6]] });
      // real user case: D4..D7 wired to D2..D5 in that order while the code says lcd(12, 11, 5, 4, 3, 2)
      const userMap = [[3, 12], [5, 11], [10, 2], [11, 3], [12, 4], [13, 5]];
      out.user = tut(code6, { map: userMap, pos: 0.9 });
      out.userFixed = tut(code6.replace('lcd(12, 11, 5, 4, 3, 2)', 'lcd(12, 11, 2, 3, 4, 5)'), { map: userMap, pos: 0.9 });
      out.perm = tut(code6, { map: [[3, 12], [5, 11], [10, 4], [11, 5], [12, 3], [13, 2]], pos: 0.1 });
      out.nobegin = tut(code6.replace('lcd.begin(16, 2); ', ''));
      out.rw7 = tut(code6.replace('lcd(12, 11, 5, 4, 3, 2)', 'lcd(12, 10, 11, 5, 4, 3, 2)'), { pos: 0.1 });
      out.i2cCodeParallel = tut(`#include <Wire.h>
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);
void setup() { lcd.init(); lcd.backlight(); lcd.print("hi"); }
void loop() {}`, { pos: 0.1 });
      return out;
    });
    const low = [r.potLow, r.potHigh].find(x => x.ct > 0.5) || r.potLow, high = [r.potLow, r.potHigh].find(x => x.ct <= 0);
    check('lcd_example_ardlcd_works', r.ex.text.trim().length > 0 && r.ex.ct > 0.5 && !r.ex.diag, r.ex);
    check('lcd_tutorial_6arg_rw_gnd_contrast_ok', low.bad === 0 && /hello, world!/.test(low.text) && !low.diag && low.init, low);
    check('lcd_pot_middle_contrast_warning', r.potMid.ct <= 0 && /contrast/i.test(r.potMid.diag) && /contrast/i.test(r.potMid.toasts) && /Contrast is set wrong/.test(r.potMid.rd), r.potMid);
    check('lcd_pot_wrong_end_also_warns', !!high && /contrast/i.test(high.diag), high || r.potHigh);
    check('lcd_wrong_pin_named_in_toast', /D7 should go to D2 but is on D6/.test(r.wrong.toasts) && !r.wrong.text.includes('hello') && /D7 should go to D2/.test(r.wrong.diag), { t: r.wrong.toasts, text: r.wrong.text });
    check('lcd_user_case_d4_d7_reversed_message', /D4–D7 are reversed/.test(r.user.toasts) && /D4 should go to D5 but is on D2/.test(r.user.diag) && /D7 should go to D2 but is on D5/.test(r.user.diag) && /on D5, D4, D3, D2, but they are wired to D2, D3, D4, D5/.test(r.user.diag) && /LiquidCrystal lcd\(12, 11, 2, 3, 4, 5\);/.test(r.user.diag) && !r.user.text.includes('hello'), { t: r.user.toasts, d: r.user.diag });
    check('lcd_user_case_suggested_fix_works', /hello, world!/.test(r.userFixed.text) && !r.userFixed.diag && r.userFixed.bad === 0, r.userFixed);
    check('lcd_d4_d7_swapped_order_message', /different order/.test(r.perm.diag) && !/reversed/.test(r.perm.diag), r.perm.diag);
    check('lcd_no_begin_shows_nothing_and_says_why', !r.nobegin.text.includes('hello') && /lcd\.begin\(16, 2\) has not been called/.test(r.nobegin.toasts), r.nobegin);
    check('lcd_rw_on_pin_7arg_ctor_wrong_wiring_reported', /RW|E should go/.test(r.rw7.diag) || /hello/.test(r.rw7.text), r.rw7);
    check('lcd_i2c_code_with_parallel_lcd_reported', /parallel LCD1602/.test(r.i2cCodeParallel.diag) && !r.i2cCodeParallel.err, r.i2cCodeParallel);
  }

  // ---------- 8. LCD1602 I2C part + LiquidCrystal_I2C / Wire ----------
  {
    const r = await page.evaluate(() => {
      const out = {};
      const ic = `#include <Wire.h>
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);
void setup() { Wire.begin(); Wire.beginTransmission(0x27); byte e = Wire.endTransmission(); lcd.init(); lcd.backlight(); lcd.print("hi I2C e="); lcd.print(e); }
void loop() { lcd.setCursor(0, 1); lcd.print(millis() / 1000); delay(200); }`;
      const i2c = (code, wires, props) => {
        app.clearAll(); TOASTS.length = 0;
        const A = app.addComp('arduino', 400, 500, 0, { code }), Lc = app.addComp('lcdi2c', 500, 120, 0, props || {});
        for (const [li, ai] of (wires || [[0, 24], [1, 20], [2, 18], [3, 19]])) W(Lc, li, A, ai);
        app.changed(); const bad = RUN(1.0);
        return { bad, text: DEFS.lcdi2c.text(Lc, 1) + '|' + DEFS.lcdi2c.text(Lc, 2), diag: RT(A).libDiag || '', toasts: TOASTS.join(' | '), rd: DEFS.lcdi2c.readings(Lc).map(x => x.join(': ')).join(' / '), err: RT(A).err ? JSON.stringify(RT(A).err) : null };
      };
      out.ok = i2c(ic);
      out.addr = i2c(ic.replace(/0x27/g, '0x3F'));
      out.addr3F = i2c(ic.replace(/0x27/g, '0x3F'), null, { addr: 0x3F });
      out.swap = i2c(ic, [[0, 24], [1, 20], [2, 19], [3, 18]]);
      out.pins = i2c(ic, [[0, 24], [1, 20], [2, 14], [3, 15]]);
      out.nopower = i2c(ic, [[0, 24], [2, 18], [3, 19]]);
      out.nobl = i2c(ic.replace('lcd.backlight();', 'lcd.noBacklight();'));
      out.contrast = i2c(ic, null, { ct: 0.1 });
      out.nobegin = i2c(ic.replace('lcd.init(); ', ''));
      const c1 = MCULANG.compile(`#include <Wire.h>
void setup() {
  Wire.begin();
  Wire.requestFrom(0x27, 1);
}
void loop() {}`, 'ino', MCU.BOARDS.arduino.consts);
      out.unsup = { ok: c1.ok, err: c1.error };
      // ATtiny85: SDA = PB0, SCL = PB2
      app.clearAll(); TOASTS.length = 0;
      const T = app.addComp('attiny85', 400, 400, 0, { code: ic }), Lc = app.addComp('lcdi2c', 600, 120, 0, {}), B = app.addComp('battery', 200, 700, 0, { V: 5 });
      // terminals: 4 = pin 4 GND, 8 = pin 8 VCC, 5 = PB0 (SDA), 7 = PB2 (SCL) → indices 3, 7, 4, 6
      W(Lc, 0, B, 0); W(Lc, 1, B, 1); W(T, 3, B, 0); W(T, 7, B, 1); W(Lc, 2, T, 4); W(Lc, 3, T, 6);
      app.changed(); RUN(1.0); out.tiny = { text: DEFS.lcdi2c.text(Lc, 1), diag: RT(T).libDiag || '' };
      return out;
    });
    check('lcdi2c_liquidcrystal_i2c_works_on_A4_A5', r.ok.bad === 0 && /hi I2C e=0/.test(r.ok.text) && !r.ok.diag && !r.ok.err, r.ok);
    check('lcdi2c_address_mismatch_clear_message', /I2C address mismatch: the program uses 0x3F/.test(r.addr.diag) && /0x27/.test(r.addr.diag) && !/hi I2C/.test(r.addr.text), r.addr);
    check('lcdi2c_address_0x3F_property_works', /hi I2C e=0/.test(r.addr3F.text), r.addr3F);
    check('lcdi2c_sda_scl_swapped_reported', /SDA and SCL are swapped/.test(r.swap.diag), r.swap);
    check('lcdi2c_wrong_pins_reported', /not on the hardware I2C pins/.test(r.pins.diag) && /A4/.test(r.pins.diag), r.pins);
    check('lcdi2c_unpowered_reported', /not powered properly/.test(r.nopower.diag) && !/hi I2C/.test(r.nopower.text), r.nopower);
    check('lcdi2c_nobacklight_reading', /noBacklight/.test(r.nobl.rd), r.nobl.rd);
    check('lcdi2c_contrast_wrong_reported', /contrast/i.test(r.contrast.diag) && /Contrast is set wrong/.test(r.contrast.rd), r.contrast);
    check('lcdi2c_no_init_reported', !/hi I2C/.test(r.nobegin.text) && /lcd\.init\(\) or lcd\.begin\(\)/.test(r.nobegin.toasts), r.nobegin);
    check('wire_unsupported_call_has_line_number', !r.unsup.ok && r.unsup.err && r.unsup.err.line === 4, r.unsup);
    check('lcdi2c_attiny85_pb0_pb2', /hi I2C e=0/.test(r.tiny.text) && !r.tiny.diag, r.tiny);
  }

  // ---------- 9. sensor examples: run 3 s each without problems ----------
  {
    const r = await page.evaluate(() => Object.keys(SENSOR_EX).map(id => {
      app.loadExample(id); app.running = false; TOASTS.length = 0;
      const t0 = performance.now(); let bad = 0, warn = 0; const n = Math.round(3 / app.dt);
      for (let i = 0; i < n; i++) { app.simStep(); if (!app.net.converged) bad++; if (app.warn) warn++; }
      const A = app.comps.find(c => DEFS[c.type].mcu);
      return { id, bad, warn, ms: Math.round(performance.now() - t0), err: RT(A).err ? JSON.stringify(RT(A).err) : null, diag: RT(A).libDiag || '', ser: (A.state.ser || '').length, lcd: (app.comps.find(c => c.type === 'lcd1602' || c.type === 'lcdi2c') || {}).state, inMenu: !!EXAMPLES.find(e => e.id === id) };
    }));
    const bad = r.filter(x => x.bad || x.warn || x.err || x.diag || !x.inMenu);
    check('sensor_examples_11_run_clean_3s', r.length === 11 && bad.length === 0, bad.length ? bad : r.map(x => x.id + ':' + x.ms + 'ms'));
    check('sensor_examples_produce_output', r.filter(x => !['snpir', 'snlcdi2c', 'snsultra'].includes(x.id)).every(x => x.ser > 0) && r.filter(x => x.lcd).every(x => x.lcd.dd || x.lcd.init), r.map(x => [x.id, x.ser]));
    check('sensor_examples_wall_time', r.every(x => x.ms < 6000), r.map(x => x.id + ':' + x.ms));
  }

  // ---------- 10. palette search ----------
  {
    const r = await page.evaluate(async () => {
      const vis = () => [...document.querySelectorAll('#palette-body .item')].filter(e => e.offsetParent !== null).map(e => e.dataset.type);
      const q = document.getElementById('pal-q'); const set = (v) => { q.value = v; q.dispatchEvent(new Event('input')); };
      set('ultrasonic'); const a = vis(); set('i2c'); const b = vis(); set('zzzqqq'); const c = vis(), none = !document.getElementById('pal-none').hidden; set(''); const d = vis();
      return { a, b, c, none, d: d.length, ph: q.placeholder };
    });
    check('palette_search_filters', r.a.includes('hcsr04') && r.a.length < 5 && r.b.includes('lcdi2c') && r.c.length === 0 && r.none && r.d > 60 && r.ph === 'Search parts…', r);
  }
  await ctx.close();

  // ---------- 11. pinout panel: sensors section in 10 languages; LCD section mentions I2C ----------
  for (const L of LANGS) {
    const { ctx, page } = await mk(BASE + '?fresh=1&lang=' + L, { locale: L });
    const r = await page.evaluate(async (SIMP) => {
      MCUHELP.open('arduino', 'pw-sensors'); const el = document.getElementById('pin-win');
      const clone = el.cloneNode(true); clone.querySelectorAll('pre, code, svg').forEach(n => n.remove()); const prose = clone.textContent;
      const o = { sx: el.querySelectorAll('.pw-sx').length, rows: el.querySelectorAll('.pw-stab tbody tr').length, nav: !!el.querySelector('[data-go="pw-sensors"]'),
        raw: (el.innerText.match(/\b(help|sens|mcu|exd?|c|lcdi2c)\.[a-z0-9_]+\.[a-z0-9_.]+/g) || []).slice(0, 5), han: /[\u4e00-\u9fff]/.test(prose), simp: (prose.match(new RegExp('[' + SIMP + ']', 'g')) || []).slice(0, 5),
        lcd: el.querySelector('#pw-u-lcd').textContent, lcdRel: !!el.querySelector('#pw-u-lcd [data-ex="snlcdi2c"]'), usage: el.querySelectorAll('.pw-u').length, ex: el.querySelectorAll('.pw-ex').length };
      el.querySelector('#pw-u-lcd [data-ex="snlcdi2c"]').click(); await new Promise(r => setTimeout(r, 30));
      el.querySelector('.pw-sload[data-id="snds18"]').click(); await new Promise(r => setTimeout(r, 50)); app.pause && app.pause();
      o.loaded = app.comps.some(c => c.type === 'ds18b20');
      return o;
    }, SIMP);
    const nonZh = !['zh-CN', 'zh-TW', 'ja'].includes(L);
    check('pinout_sensors_section_' + L, r.sx === 11 && r.rows === 26 && r.nav && r.raw.length === 0 && (!nonZh || !r.han) && (L === 'zh-CN' || r.simp.length === 0) && /A4/.test(r.lcd) && /0x27/.test(r.lcd) && r.lcdRel && r.usage === 12 && r.ex === 12 && r.loaded, r);
    await ctx.close();
  }

  check('no_page_errors', errors.length === 0, errors.slice(0, 5));
  fs.writeFileSync(path.join(__dirname, 'test13-report.json'), JSON.stringify(results, null, 1));
  console.log(fails.length ? 'FAILED: ' + fails.length : 'ALL ' + Object.keys(results).length + ' PASSED');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
