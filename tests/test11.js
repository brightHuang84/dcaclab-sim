// v10 tests: programmable microcontrollers (Arduino-Uno-style board, ATtiny85-style chip): Arduino-C translator
// (subset, semantics, error messages with line numbers), JavaScript mode, simulated-time execution (delay accuracy),
// digitalRead / INPUT_PULLUP, analogRead, PWM, Servo, LiquidCrystal, Serial, runaway guard, save / load,
// program editor UI + serial monitor, every MCU example, i18n of the new UI, regression fixture.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const results = {}; const fails = [];
const check = (name, cond, info) => { results[name] = { pass: !!cond, info }; if (!cond) fails.push(name); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + JSON.stringify(info))); };
const BASE = process.env.URL || 'http://127.0.0.1:8765/index.html';
const USER = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'user-7805-supply.json'), 'utf8'));
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt-BR'];
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const SEMANTICS = `#define SQUARE(x) ((x) * (x))
#define N 5
enum Color { RED, GREEN = 5, BLUE };
const int TABLE[N] = {3, 1, 4, 1, 5};
int counter() { static int n = 0; n++; return n; }
long fact(int n) { if (n <= 1) return 1; return n * fact(n - 1); }
void setup() {
  Serial.begin(9600);
  int a = 32767; a++; Serial.println(a);
  byte b = 255; b++; Serial.println(b);
  unsigned int u = 0; u--; Serial.println(u);
  long big = 100000L * 3; Serial.println(big);
  int q = -7 / 2; Serial.println(q);
  Serial.println(-7 % 3);
  float f = 10 / 4; Serial.println(f);
  float g = 10 / 4.0; Serial.println(g, 3);
  Serial.println(255, HEX);
  Serial.println(5, BIN);
  char c = 'A' + 2; Serial.println(c);
  Serial.println(SQUARE(3 + 1));
  Serial.println(BLUE);
  int s = 0; for (int i = 0; i < N; i++) s += TABLE[i]; Serial.println(s);
  Serial.println(sizeof(TABLE));
  counter(); counter(); Serial.println(counter());
  Serial.println(fact(10));
  String str = "Hi"; str += ' '; str += 42; str.toUpperCase(); Serial.println(str);
  Serial.println(str.length());
  Serial.println(str.indexOf("42"));
  Serial.println(map(512, 0, 1023, 0, 255));
  Serial.println(constrain(300, 0, 255));
  int x = 0;
  switch (3) { case 1: x = 1; break; case 3: x = 3; case 4: x += 10; break; default: x = -1; }
  Serial.println(x);
  unsigned long ul = 4294967295UL; ul++; Serial.println(ul);
  int k = 0; while (true) { k++; if (k >= 7) break; } Serial.println(k);
  int d = 0; do { d += 2; } while (d < 9); Serial.println(d);
  bool flag = 5 > 3 && !(2 > 3); Serial.println(flag);
  int bits = 0; bitSet(bits, 3); Serial.println(bits);
  Serial.println(bitRead(10, 1));
  char buf[20]; sprintf(buf, "T=%d,%s", 25, "ok"); Serial.println(buf);
  Serial.println((int)3.99);
  Serial.println(1.0 / 3, 4);
  int arr2[2][3] = {{1, 2, 3}, {4, 5, 6}}; Serial.println(arr2[1][2]);
  Serial.println(String(3.14159, 2));
  Serial.println(abs(-5) + min(2, 9) + max(2, 9));
  int t = 10; t <<= 2; t |= 1; Serial.println(t);
  Serial.println(x > 5 ? "big" : "small");
  char nm[16]; strcpy(nm, "ab"); strcat(nm, "cd"); Serial.println(nm); Serial.println(strlen(nm));
  Serial.println("END");
}
void loop() {}
`;
const SEM_EXPECT = ['-32768', '0', '65535', '300000', '-3', '-1', '2.00', '2.500', 'FF', '101', 'C', '16', '6', '14', '10', '3', '3628800', 'HI 42', '5', '3', '127', '255', '13', '0', '7', '10', '1', '8', '1', 'T=25,ok', '3', '0.3333', '6', '3.14', '16', '41', 'big', 'abcd', '4', 'END'];

const C_ERRORS = [
  ['missing_semicolon', 'void setup() {\n  int a = 3\n}\nvoid loop() {}', 2, 'expected'],
  ['undeclared', 'void setup() {\n  foo = 1;\n}\nvoid loop() {}', 2, 'undeclared'],
  ['arg_count', 'void setup() {\n  pinMode(13);\n}\nvoid loop() {}', 2, 'args'],
  ['pointer_unsupported', 'void setup() {\n  int *p;\n}\nvoid loop() {}', 2, 'unsupported'],
  ['no_loop', 'void setup() {}\n', 1, 'no_setup_loop'],
  ['unterminated_string', 'void setup() {\n  Serial.println("abc);\n}\nvoid loop() {}', 2, 'unterminated_str'],
  ['type_mismatch', 'void setup() {\n  int x = "hi";\n}\nvoid loop() {}', 2, 'type_mismatch'],
  ['break_outside', 'void setup() {\n  break;\n}\nvoid loop() {}', 2, 'break_outside'],
  ['bad_array_size', 'void setup() {\n}\n\nvoid loop() {\n  int a[0];\n}', 5, 'array_size'],
  ['unknown_method', 'void setup() {\n  Serial.prnt(1);\n}\nvoid loop() {}', 2, 'unknown_member'],
  ['unclosed_block', 'void setup() {\n  int a = 1;\n\nvoid loop() {}', 4, 'unsupported'],
  ['unexpected_eof', 'void setup() {\n  int a = 1;\n', 3, 'eof'],
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  const mk = async (locale, url) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, locale });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(locale + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(locale + ' console: ' + m.text()); });
    await page.goto(url || BASE + '?fresh=1'); await page.waitForTimeout(300);
    await page.evaluate(() => {
      // a bare Uno (USB powered) running `code`; returns the board
      window.UNO = (code, lang, extra) => {
        app.clearAll(); app.pause();
        const A = app.addComp('arduino', 400, 380, 0, { code, lang: lang || 'ino' });
        if (extra) extra(A);
        app.changed(); app.resetSim(); return A;
      };
      window.RUN = (sec) => { let bad = 0; const n = Math.round(sec / app.dt); for (let i = 0; i < n; i++) { app.simStep(); if (!app.net.converged) bad++; } return bad; };
      window.W = (a, ia, b, ib) => { const p = app.termPos(a, ia), q = app.termPos(b, ib); return app.addWire(p[0], p[1], q[0], q[1], 1); };
    });
    return { ctx, page };
  };
  const { ctx, page } = await mk('zh-CN');

  // ---------- 1. translator: language subset + C semantics (output compared line by line) ----------
  const sem = await page.evaluate((code) => {
    const A = UNO(code); const bad = RUN(0.1);
    const rt = A.state.rt;
    return { lines: (A.state.ser || '').split('\r\n').filter(x => x.length), err: rt && rt.err, bad, comp: MCULANG.compile(code, 'ino', MCU.BOARDS.arduino.consts).ok };
  }, SEMANTICS);
  check('translator_subset_compiles', sem.comp && !sem.err, sem.err);
  const diff = SEM_EXPECT.map((e, i) => (sem.lines[i] === e ? null : [i, e, sem.lines[i]])).filter(Boolean);
  check('translator_c_semantics_output', diff.length === 0 && sem.lines.length === SEM_EXPECT.length, { diff, got: sem.lines });

  // ---------- 2. compile errors carry a line number and a localised message ----------
  const cerr = await page.evaluate((cases) => cases.map(([name, src, line, key]) => {
    const r = MCULANG.compile(src, 'ino', MCU.BOARDS.arduino.consts);
    return { name, ok: r.ok, line: r.error && r.error.line, key: r.error && r.error.key, want: [line, key], msg: r.error ? MCULANG.errorText(r.error) : '' };
  }), C_ERRORS);
  for (const e of cerr) check('compile_error_' + e.name, !e.ok && e.line === e.want[0] && e.key === e.want[1] && /[\u4e00-\u9fff]/.test(e.msg) && !/mcu\.e\./.test(e.msg), e);
  const jsErr = await page.evaluate(() => { const r = MCULANG.compile('function setup() {\n  pinMode(13, OUTPUT);\n}\nfunction loop() {\n  let x = ;\n}', 'js', {}); return r.error; });
  check('compile_error_js_syntax_line', jsErr && jsErr.key === 'syntax' && jsErr.line === 5, jsErr);
  // a board with a broken program shows the error on the chip and in its readings
  const onChip = await page.evaluate(() => { const A = UNO('void setup() {\n  int a = 3\n}\nvoid loop() {}'); RUN(0.01); return { st: MCU.statusOf(A), label: DEFS.arduino.label(A), rd: DEFS.arduino.readings(A).map(r => r.join(': ')).join(' | ') }; });
  check('compile_error_shown_on_chip', onChip.st === 'cerr' && /2/.test(onChip.label) && /第 2 行/.test(onChip.rd), onChip);

  // ---------- 3. delay() runs on simulated time: Blink 500 ms within 1 % ----------
  const blink = await page.evaluate(() => {
    const A = UNO(MCU.BLINK_UNO); const edges = []; let prev; let bad = 0;
    for (let i = 0; i < Math.round(3.2 / app.dt); i++) { app.simStep(); if (!app.net.converged) bad++; const d = (A.state.drv || [])[13]; if (d !== prev) { if (prev !== undefined) edges.push(app.t); prev = d; } }
    const iv = []; for (let i = 1; i < edges.length; i++) iv.push(edges[i] - edges[i - 1]);
    return { iv, bad, IL: A._m.IL, ms: A.state.rt.upMs(app.t), t: app.t };
  });
  check('blink_500ms_within_1pct', blink.iv.length >= 5 && blink.iv.every(x => Math.abs(x - 0.5) < 0.005), blink.iv);
  check('blink_uptime_tracks_sim_time', near(blink.ms / 1000, blink.t, 0.002) && blink.bad === 0, [blink.ms, blink.t, blink.bad]);
  const mil = await page.evaluate(() => { const A = UNO('void setup() { Serial.begin(9600); }\nvoid loop() {\n  delay(1000);\n  Serial.println(millis());\n  Serial.println(micros());\n}'); RUN(3.05); return A.state.ser.split('\r\n').filter(Boolean).map(Number); });
  check('millis_micros_follow_delay', mil.length === 6 && [0, 2, 4].every((i, j) => near(mil[i], 1000 * (j + 1), 1)) && [1, 3, 5].every((i, j) => near(mil[i], 1e6 * (j + 1), 1000)), mil);
  const blinkJs = await page.evaluate(() => {
    const code = 'function setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\nfunction loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(250);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(250);\n}\n';
    const A = UNO(code, 'js'); const edges = []; let prev;
    for (let i = 0; i < Math.round(1.6 / app.dt); i++) { app.simStep(); const d = (A.state.drv || [])[13]; if (d !== prev) { if (prev !== undefined) edges.push(app.t); prev = d; } }
    const iv = []; for (let i = 1; i < edges.length; i++) iv.push(edges[i] - edges[i - 1]);
    return { iv, err: A.state.rt.err };
  });
  check('js_mode_blink_250ms', !blinkJs.err && blinkJs.iv.length >= 4 && blinkJs.iv.every(x => Math.abs(x - 0.25) < 0.0025), blinkJs);
  const onboard = await page.evaluate(() => { const A = UNO(MCU.BLINK_UNO); RUN(0.3); const on = A._m.IL; RUN(0.5); return [on, A._m.IL]; });
  check('onboard_led_D13_lights', onboard[0] > 0.002 && onboard[1] < 1e-5, onboard);

  // ---------- 4. digitalRead with INPUT_PULLUP (button example) ----------
  const btn = await page.evaluate(() => {
    app.loadExample('ardbutton'); app.pause(); app.resetSim(); RUN(0.2);
    const A = app.comps.find(c => c.type === 'arduino'), S = app.comps.find(c => c.type === 'button'), L = app.comps.find(c => c.type === 'led');
    const v2 = app.net.v(A._nodes[2]) - app.net.v(A._nodes[23]);
    const off = L._m.I;
    S.state.pressed = true; app.dirty = true; RUN(0.1);
    const on = L._m.I, v2p = app.net.v(A._nodes[2]) - app.net.v(A._nodes[23]);
    S.state.pressed = false; app.dirty = true; RUN(0.1);
    return { v2, off, on, v2p, after: L._m.I, ser: A.state.ser };
  });
  check('pullup_reads_high_when_open', btn.v2 > 4.5 && btn.off < 1e-5, btn);
  check('button_press_lights_led', btn.on > 0.005 && btn.v2p < 0.1 && btn.after < 1e-5, btn);
  check('button_serial_events', /pressed\r\nreleased/.test(btn.ser), btn.ser);
  const thr = await page.evaluate(() => {
    // digitalRead thresholds 0.3 / 0.6 VCC with hysteresis: a divider on D4 swept by a pot
    const code = 'void setup() { Serial.begin(9600); pinMode(4, INPUT); }\nvoid loop() { Serial.print(digitalRead(4)); delay(50); }';
    const A = UNO(code, 'ino', (A) => { const P = app.addComp('pot', 400, 140, 0, { R: 10000, pos: 0.5 }); W(P, 2, A, 4); W(P, 0, A, 23); W(P, 1, A, 20); window.__P = P; });
    const seq = [0.5, 0.65, 0.5, 0.25, 0.5, 0.2, 0.5]; const out = [];
    for (const p of seq) { __P.props.pos = p; app.dirty = true; A.state.ser = ''; RUN(0.12); out.push(A.state.ser.slice(-1)); }
    return out.join('');
  });
  check('digitalread_thresholds_hysteresis', thr === '0110000', thr);

  // ---------- 5. analogRead: divider, 3.3 V rail, potentiometer ----------
  const adc = await page.evaluate(() => {
    const code = 'void setup() { Serial.begin(9600); }\nvoid loop() { Serial.print(analogRead(A0)); Serial.print(" "); Serial.print(analogRead(A1)); Serial.print(" "); Serial.println(analogRead(A2)); delay(100); }';
    const A = UNO(code, 'ino', (A) => {
      const R1 = app.addComp('resistor', 300, 640, 1, { R: 10000 }), R2 = app.addComp('resistor', 500, 640, 1, { R: 10000 });
      W(A, 20, R1, 0); W(R1, 1, R2, 0); W(R2, 1, A, 24); W(R1, 1, A, 14); W(A, 21, A, 15);
      const P = app.addComp('pot', 700, 640, 0, { R: 10000, pos: 0.25 }); W(P, 0, A, 25); W(P, 1, A, 20); W(P, 2, A, 16);
    });
    RUN(0.25);
    const L = A.state.ser.split('\r\n').filter(Boolean); return L[L.length - 1];
  });
  const [a0, a1, a2] = adc.split(' ').map(Number);
  check('analogread_divider_half', near(a0, 511, 2), adc);
  check('analogread_3v3_rail', near(a1, 1024 * 3.3 / 5, 4), adc);
  check('analogread_pot_quarter', near(a2, 256, 3), adc);

  // ---------- 6. PWM: duty / average, real switching, frequency, oscilloscope ----------
  const pwm = await page.evaluate(() => {
    app.loadExample('ardpwm'); app.pause(); app.resetSim(); RUN(0.3);
    const A = app.comps.find(c => c.type === 'arduino'), O = app.comps.find(c => c.type === 'scope'), P = app.comps.find(c => c.type === 'pot');
    const meas = (sec) => { let sum = 0, mx = 0, n = 0, rises = 0, prev = 0; const N = Math.round(sec / app.dt); for (let i = 0; i < N; i++) { app.simStep(); const v = app.net.v(A._nodes[9]) - app.net.v(A._nodes[23]); sum += v; mx = Math.max(mx, v); n++; const hi = v > 2.5 ? 1 : 0; if (hi && !prev) rises++; prev = hi; } return { avg: sum / n, mx, rises }; };
    const m1 = meas(1.0);
    P.props.pos = 0.8; app.dirty = true; RUN(0.2);
    const m2 = meas(1.0);
    const b = O.state.b1, cnt = O.state.count; let lo = 9, hi = -9; for (let i = 0; i < Math.min(cnt, 300); i++) { const v = b[(O.state.head - 1 - i + b.length) % b.length]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    return { m1, m2, freq: O.state.freq, lo, hi, ser: A.state.ser.slice(-200), splits: app.mcuSplits };
  });
  check('pwm_average_matches_duty_50pct', near(pwm.m1.avg / pwm.m1.mx, 127 / 255, 0.03), pwm.m1);
  check('pwm_average_matches_duty_80pct', near(pwm.m2.avg / pwm.m2.mx, 204 / 255, 0.03), pwm.m2);
  check('pwm_490Hz_edges', near(pwm.m1.rises, 490, 6), pwm.m1.rises);
  check('pwm_scope_square_wave', pwm.lo < 0.2 && pwm.hi > 4.3 && near(pwm.freq, 490, 25), [pwm.lo, pwm.hi, pwm.freq]);
  check('pwm_serial_values', /A0 = 819\s+\(4\.00 V\)\s+PWM = 204/.test(pwm.ser), pwm.ser);
  const pwm5 = await page.evaluate(() => {
    const A = UNO('void setup() { analogWrite(5, 64); analogWrite(6, 191); }\nvoid loop() {}', 'ino', (A) => { const R = app.addComp('resistor', 460, 160, 0, { R: 1000 }); W(A, 5, R, 0); W(R, 1, A, 23); });
    RUN(0.1); let r5 = 0, p5 = 0, s6 = 0, n = 0; const N = Math.round(0.5 / app.dt);
    for (let i = 0; i < N; i++) { app.simStep(); const v5 = app.net.v(A._nodes[5]), v6 = app.net.v(A._nodes[6]); const h = v5 > 2.5 ? 1 : 0; if (h && !p5) r5++; p5 = h; s6 += v6; n++; }
    return { r5, avg6: s6 / n };
  });
  check('pwm_980Hz_on_pins_5_6', near(pwm5.r5, 490, 6) && near(pwm5.avg6, 5 * 191 / 255, 0.1), pwm5);

  // ---------- 7. Serial: formatting covered above; input + echo, TX LED ----------
  const serIn = await page.evaluate(() => {
    const A = UNO('void setup() { Serial.begin(9600); }\nvoid loop() {\n  if (Serial.available() > 0) {\n    String s = Serial.readStringUntil(\'\\n\');\n    Serial.print("echo:");\n    Serial.println(s);\n  }\n  delay(10);\n}');
    RUN(0.05); for (const ch of 'abc 12\n') A.state.rt.sin.push(ch.charCodeAt(0)); RUN(0.05);
    return { ser: A.state.ser, err: A.state.rt.err };
  });
  check('serial_input_echo', serIn.ser === 'echo:abc 12\r\n' && !serIn.err, serIn);

  // ---------- 8. runtime errors + runaway guard ----------
  const rterr = await page.evaluate(() => {
    const o = {};
    let A = UNO('int z = 0;\nvoid setup() { Serial.begin(9600); }\nvoid loop() {\n  int y = 10 / z;\n}'); RUN(0.02); o.div0 = A.state.rt.err;
    A = UNO('int a[3];\nvoid setup() {}\nvoid loop() {\n  for (int i = 0; i <= 3; i++) a[i] = i;\n}'); RUN(0.02); o.index = A.state.rt.err;
    A = UNO('function spin() {\n  const f = () => { while (true) {} };\n  f();\n}\nfunction setup() {}\nfunction loop() { spin(); }', 'js');
    const t0 = performance.now(); RUN(0.02); o.runaway = A.state.rt.err; o.runawayMs = performance.now() - t0; o.label = DEFS.arduino.label(A);
    A = UNO('void setup() { pinMode(13, OUTPUT); digitalWrite(13, HIGH); }\nvoid loop() {\n  while (1) { }\n}');
    const t1 = performance.now(); RUN(1.0); o.hangMs = performance.now() - t1; o.hangSt = MCU.statusOf(A); o.hangT = app.t; o.hangPin = (A.state.drv || [])[13];
    A = UNO('int f(int n) { return f(n + 1) + 1; }\nvoid setup() { f(0); }\nvoid loop() {}'); RUN(0.02); o.stack = A.state.rt.err;
    return o;
  });
  check('runtime_error_div0_line', rterr.div0 && rterr.div0.key === 'div0' && rterr.div0.line === 4, rterr.div0);
  check('runtime_error_index_line', rterr.index && rterr.index.key === 'index' && rterr.index.line === 4, rterr.index);
  check('runaway_guard_stops_program', rterr.runaway && rterr.runaway.key === 'runaway' && rterr.runaway.line === 2 && rterr.runawayMs < 3000 && /运行错误/.test(rterr.label), [rterr.runaway, rterr.runawayMs, rterr.label]);
  check('busy_loop_does_not_freeze', rterr.hangSt === 'run' && rterr.hangMs < 4000 && near(rterr.hangT, 1.0, 0.01) && rterr.hangPin === 1, rterr);
  check('runtime_error_stack_overflow', rterr.stack && rterr.stack.key === 'stack', rterr.stack);

  // ---------- 9. power: brown-out, external supply, ATtiny needs VCC, reset pin ----------
  const pwr = await page.evaluate(() => {
    const o = {};
    let A = UNO(MCU.BLINK_UNO, 'ino', (A) => { A.props.power = 'ext'; const B = app.addComp('battery', 300, 640, 0, { V: 9 }); W(B, 1, A, 22); W(B, 0, A, 25); window.__B = B; });
    RUN(0.3); o.ext9 = [MCU.statusOf(A), A._m.Vcc];
    __B.props.V = 3; app.dirty = true; RUN(0.1); o.ext3 = [MCU.statusOf(A), A._m.Vcc];
    __B.props.V = 7; app.dirty = true; RUN(0.1); o.ext7 = [MCU.statusOf(A), A._m.Vcc, A.state.rt && A.state.rt.upMs(app.t)];
    app.clearAll(); app.pause();
    const T = app.addComp('attiny85', 400, 300); app.changed(); app.resetSim(); RUN(0.05); o.tinyNoPower = MCU.statusOf(T);
    const B = app.addComp('battery', 400, 480, 0, { V: 5 }); W(B, 1, T, 7); W(B, 0, T, 3);
    const R = app.addComp('resistor', 520, 200, 0, { R: 330 }); W(T, 4, R, 0); W(R, 1, T, 3);
    app.changed(); app.resetSim(); const edges = []; let prev;
    for (let i = 0; i < Math.round(2.2 / app.dt); i++) { app.simStep(); const d = T.state.drv && T.state.drv[0]; if (d !== prev) { if (prev !== undefined) edges.push(app.t); prev = d; } }
    o.tiny = { st: MCU.statusOf(T), iv: edges.slice(1).map((e, i) => e - edges[i]), vpin: app.net.v(T._nodes[4]) };
    const S = app.addComp('switch', 200, 300, 0, { closed: true }); W(S, 0, T, 0); W(S, 1, T, 3); app.changed(); RUN(0.05); o.tinyReset = MCU.statusOf(T);
    S.props.closed = false; app.dirty = true; RUN(0.05); o.tinyAfter = MCU.statusOf(T);
    return o;
  });
  check('uno_external_9V_runs', pwr.ext9[0] === 'run' && near(pwr.ext9[1], 5, 0.05), pwr.ext9);
  check('uno_brownout_off_at_3V', pwr.ext3[0] === 'off', pwr.ext3);
  check('uno_reboots_after_brownout', pwr.ext7[0] === 'run' && pwr.ext7[2] < 150, pwr.ext7);
  check('attiny_needs_vcc', pwr.tinyNoPower === 'off', pwr.tinyNoPower);
  check('attiny_blinks_PB0', pwr.tiny.st === 'run' && pwr.tiny.iv.length >= 3 && pwr.tiny.iv.every(x => near(x, 0.5, 0.005)), pwr.tiny);
  check('attiny_reset_pin_holds_reset', pwr.tinyReset === 'reset' && pwr.tinyAfter === 'run', [pwr.tinyReset, pwr.tinyAfter]);

  // ---------- 10. Servo and LiquidCrystal libraries ----------
  const lib = await page.evaluate(() => {
    const o = {};
    app.loadExample('ardservo'); app.pause(); app.resetSim();
    const M = app.comps.find(c => c.type === 'servo'); const pws = [], angs = [];
    for (let i = 0; i < Math.round(2.0 / app.dt); i++) { app.simStep(); if (i % 250 === 0) { pws.push(M.state.pw); angs.push(M.state.ang); } }
    o.servo = { pwMin: Math.min(...pws.filter(Boolean)), pwMax: Math.max(...pws.filter(Boolean)), T: M.state.T, angMax: Math.max(...angs), angMin: Math.min(...angs) };
    app.loadExample('ardlcd'); app.pause(); app.resetSim(); RUN(1.3);
    const L = app.comps.find(c => c.type === 'lcd1602');
    o.lcd = [DEFS.lcd1602.text(L, 1), DEFS.lcd1602.text(L, 2), DEFS.lcd1602.readings(L).map(r => r.join(':')).join('|')];
    return o;
  });
  check('servo_pulses_1_to_2ms_50Hz', lib.servo.pwMin > 0.98e-3 && lib.servo.pwMin < 1.1e-3 && lib.servo.pwMax > 1.8e-3 && lib.servo.pwMax < 2.02e-3 && near(lib.servo.T, 0.02, 3e-4), lib.servo);
  check('servo_sweeps', lib.servo.angMax > 150 && lib.servo.angMin < 30, lib.servo);
  check('liquidcrystal_writes_lcd', lib.lcd[0] === 'Hello, Arduino! ' && /^count: 2\s*$/.test(lib.lcd[1]) && /单片机/.test(lib.lcd[2]), lib.lcd);

  // ---------- 11. save / load keeps the program (circuit JSON + exported file), undo of an upload ----------
  const json = await page.evaluate(() => { const A = UNO('// saved program\nint n = 0;\nvoid setup() { Serial.begin(9600); }\nvoid loop() { Serial.println(n++); delay(100); }'); RUN(0.35); window.__ser = A.state.ser; return JSON.stringify(app.serialize()); });
  const p2 = await mk('en');
  const reloaded = await p2.page.evaluate((j) => { app.load(j); app.pause(); app.resetSim(); RUN(0.35); const A = app.comps.find(c => c.type === 'arduino'); return { code: A.props.code, ser: A.state.ser, lang: A.props.lang }; }, json);
  const ser0 = await page.evaluate(() => window.__ser);
  check('save_load_keeps_program', /saved program/.test(reloaded.code) && JSON.parse(json).comps[0].props.code === reloaded.code && reloaded.ser === ser0 && reloaded.ser.startsWith('0\r\n1\r\n2\r\n'), [reloaded, ser0]);
  check('saved_circuit_language_independent', !/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0400-\u04ff]/.test(json), json.slice(0, 200));
  const undo = await page.evaluate(() => {
    const A = UNO(MCU.BLINK_UNO); RUN(0.1);
    MCU.uploadTo(A, 'void setup() { Serial.begin(9600); Serial.print("NEW"); }\nvoid loop() {}', 'ino'); app.pause(); RUN(0.05);
    const after = app.comps[0].state.ser;
    app.undo(); RUN(0.05); const A2 = app.comps.find(c => c.type === 'arduino');
    return { after, code: A2.props.code, st: MCU.statusOf(A2) };
  });
  check('upload_then_undo_restores_program', undo.after === 'NEW' && undo.code === (await page.evaluate(() => MCU.BLINK_UNO)) && undo.st === 'run', undo);
  await p2.ctx.close();

  // ---------- 12. every MCU example runs without errors or convergence failures ----------
  const exs = await page.evaluate(() => {
    const out = [];
    for (const ex of EXAMPLES) {
      app.loadExample(ex.id); app.pause();
      const mc = app.comps.filter(c => DEFS[c.type].mcu); if (!mc.length) continue;
      app.resetSim(); const t0 = performance.now(); const bad = RUN(3.0);
      out.push({ id: ex.id, bad, ms: Math.round(performance.now() - t0), st: mc.map(c => MCU.statusOf(c)), err: mc.map(c => c.state.rt && c.state.rt.err).filter(Boolean), conv: app.conv ? app.conv.n : 0, passOver: app.findPassOvers().length, warn: app.warn });
    }
    return out;
  });
  check('mcu_examples_present', exs.length >= 7 && ['ardblink', 'ardtraffic', 'ardbutton', 'ardpwm', 'ardservo', 'ardlcd', 'tinyblink'].every(id => exs.some(e => e.id === id)), exs.map(e => e.id));
  for (const e of exs) check('example_runs_' + e.id, e.bad === 0 && !e.conv && e.err.length === 0 && e.st.every(s => s === 'run') && e.passOver === 0 && !e.warn, e);
  check('examples_fast_enough', exs.every(e => e.ms < 2500), exs.map(e => [e.id, e.ms]));

  // ---------- 13. editor UI: double-click opens it, errors point at the line, upload, serial monitor, Tab ----------
  await page.evaluate(() => { app.loadExample('ardblink'); app.pause(); app.fitView(); });
  await page.waitForTimeout(200);
  const pos = await page.evaluate(() => { const A = app.comps.find(c => c.type === 'arduino'); const r = app.cv.getBoundingClientRect(); return [r.left + app.view.ox + (A.x - 60) * app.view.s, r.top + app.view.oy + (A.y - 40) * app.view.s]; });
  await page.mouse.dblclick(pos[0], pos[1]); await page.waitForTimeout(250);
  const ed1 = await page.evaluate(() => { const w = document.getElementById('mcu-win'); return { vis: !!w && getComputedStyle(w).display !== 'none', code: w && w.querySelector('.mw-code').value, gut: w && w.querySelectorAll('.mw-gut div').length, title: w && w.querySelector('.mw-title').textContent }; });
  check('dblclick_opens_editor_with_program', ed1.vis && /LED_EXT/.test(ed1.code) && ed1.gut >= 18 && /程序编辑器/.test(ed1.title), ed1);
  await page.evaluate(() => { const ta = document.querySelector('#mcu-win .mw-code'); ta.value = ta.value.replace('delay(500);', 'delay(500)'); ta.dispatchEvent(new Event('input')); });
  await page.click('#mcu-win .mw-upload'); await page.waitForTimeout(150);
  const ed2 = await page.evaluate(() => { const w = document.getElementById('mcu-win'); return { msg: w.querySelector('.mw-msg').textContent, cls: w.querySelector('.mw-msg').className, errLine: [...w.querySelectorAll('.mw-gut div')].findIndex(d => d.classList.contains('err')) + 1, code: app.comps.find(c => c.type === 'arduino').props.code }; });
  check('editor_compile_error_line_marked', /mw-msg err/.test(ed2.cls) && /第 14 行/.test(ed2.msg) && ed2.errLine === 14 && /delay\(500\);/.test(ed2.code.split('\n')[13]), ed2);
  await page.evaluate(() => { const ta = document.querySelector('#mcu-win .mw-code'); ta.value = ta.value.replace('delay(500)\n', 'delay(500);\n').replace('Blink started', 'Hello from the editor'); ta.dispatchEvent(new Event('input')); ta.focus(); });
  await page.keyboard.press('Control+s'); await page.waitForTimeout(150);
  await page.evaluate(() => { app.pause(); RUN(0.2); MCU.tick(true); });
  const ed3 = await page.evaluate(() => { const w = document.getElementById('mcu-win'), A = app.comps.find(c => c.type === 'arduino'); return { msg: w.querySelector('.mw-msg').textContent, code: A.props.code, ser: w.querySelector('.mw-ser').textContent, st: w.querySelector('.mw-st').textContent, hist: app.history.length }; });
  check('editor_upload_ctrl_s', /Hello from the editor/.test(ed3.code) && /已上传/.test(ed3.msg) && /运行中/.test(ed3.st), ed3);
  check('serial_monitor_shows_output', /Hello from the editor/.test(ed3.ser), ed3.ser);
  await page.evaluate(() => { const ta = document.querySelector('#mcu-win .mw-code'); ta.focus(); ta.setSelectionRange(0, 0); });
  await page.keyboard.press('Tab');
  const tab = await page.evaluate(() => document.querySelector('#mcu-win .mw-code').value.slice(0, 4));
  check('editor_tab_inserts_spaces', tab === '  //', tab);
  await page.evaluate(() => { const ta = document.querySelector('#mcu-win .mw-code'); const i = ta.value.indexOf('void setup() {') + 'void setup() {'.length; ta.focus(); ta.setSelectionRange(i, i); });
  await page.keyboard.press('Enter');
  const ind = await page.evaluate(() => { const v = document.querySelector('#mcu-win .mw-code').value; const i = v.indexOf('void setup() {'); return v.slice(i, i + 20); });
  check('editor_enter_auto_indents', ind.startsWith('void setup() {\n  '), ind);
  // send text from the serial monitor input
  await page.evaluate(() => { const A = app.comps.find(c => c.type === 'arduino'); MCU.uploadTo(A, 'void setup() { Serial.begin(9600); }\nvoid loop() { while (Serial.available()) Serial.write(Serial.read() + 1); delay(5); }', 'ino'); app.pause(); RUN(0.05); MCU.openEditor(A, true); });
  await page.fill('#mcu-win .mw-send-in', 'HAL'); await page.press('#mcu-win .mw-send-in', 'Enter');
  await page.evaluate(() => { RUN(0.05); MCU.tick(true); });
  const echo = await page.evaluate(() => document.querySelector('#mcu-win .mw-ser').textContent);
  check('serial_monitor_send_input', echo.startsWith('IBM'), echo);
  // property panel buttons
  const pp = await page.evaluate(() => { const A = app.comps.find(c => c.type === 'arduino'); MCU.closeEditor(); app.sel = { comp: A }; app.refreshProps(); const b = document.querySelector('#props .mcu-edit'); const s = document.querySelector('#props .mcu-ser'); b.click(); const vis = getComputedStyle(document.getElementById('mcu-win')).display; return { b: b && b.textContent, s: s && s.textContent, vis }; });
  check('props_panel_edit_program_button', /编辑程序/.test(pp.b) && /串口监视器/.test(pp.s) && pp.vis === 'flex', pp);
  // language switch re-labels the open editor
  await page.evaluate(() => app.setLang('en')); await page.waitForTimeout(100);
  const enEd = await page.evaluate(() => document.getElementById('mcu-win').innerText);
  check('editor_relabels_on_language_switch', /Program editor/.test(enEd) && /Compile & upload/.test(enEd) && /Serial monitor/.test(enEd) && !/[\u4e00-\u9fff]/.test(enEd), enEd.slice(0, 200));
  await page.evaluate(() => { app.setLang('zh-CN'); MCU.closeEditor(); });

  // ---------- 14. i18n: new keys in all 10 locales, MCU UI free of Chinese in other languages ----------
  const loc = await page.evaluate((LANGS) => {
    const keys = Object.keys(I18N.dicts['zh-CN']).filter(k => /^(mcu\.|c\.arduino|c\.attiny85|cat\.mcu|ex\.(ard|tiny)|exd\.)/.test(k));
    return { n: keys.length, missing: LANGS.map(L => [L, keys.filter(k => !I18N.dicts[L] || !I18N.dicts[L][k]).length]) };
  }, LANGS);
  check('i18n_new_keys_all_locales', loc.n >= 90 && loc.missing.every(([, n]) => n === 0), loc);
  const other = [];
  for (const L of ['en', 'ja', 'ru']) {
    const p = await mk(L);
    const r = await p.page.evaluate(() => {
      app.loadExample('ardpwm'); app.pause(); app.resetSim(); RUN(0.3);
      const A = app.comps.find(c => c.type === 'arduino'); app.sel = { comp: A }; app.refreshProps(); app.updateReadings(true);
      MCU.openEditor(A); MCU.tick(true);
      const bad = MCULANG.compile('void setup() {\n  foo();\n}\nvoid loop() {}', 'ino', MCU.BOARDS.arduino.consts);
      return { props: document.getElementById('props').innerText, ed: document.getElementById('mcu-win').innerText.replace(document.querySelector('#mcu-win .mw-code').value, ''), label: DEFS.arduino.label(A), err: MCULANG.errorText(bad.error), ex: [...document.querySelectorAll('#sel-example option')].map(o => o.textContent + ' ' + (o.title || '')).filter(t => /MCU|マイコン|МК/.test(t)).join('\n') };
    });
    other.push([L, r]);
    await p.ctx.close();
  }
  const cjk = /[\u4e00-\u9fff]/;
  check('mcu_ui_localized_en_ja_ru', other.every(([L, r]) => (L === 'ja' ? !/[\u4e00-\u9fff]{2,}[^\u3040-\u30ff]*単片機/.test(r.props) && !/单片机|编程|串口/.test(r.props + r.ed) : !cjk.test(r.props + r.ed + r.label + r.err)) && r.ex.split('\n').length >= 7), other.map(([L, r]) => [L, r.label, r.err, r.ex.split('\n').length, cjk.test(r.props + r.ed)]));

  // ---------- 15. regression: the user 7805 fixture still converges; non-MCU circuits unchanged ----------
  const fx = await page.evaluate((U0) => { app.load(U0); app.pause(); app.resetSim(); const bad = RUN(2.0); return { bad, conv: app.conv ? app.conv.n : 0, warn: app.warn, mcu: app.mcuComps.length }; }, USER);
  check('fixture_user_7805_still_converges', fx.bad === 0 && !fx.conv && fx.warn === '' && fx.mcu === 0, fx);

  check('no_page_errors', errors.length === 0, errors.slice(0, 5));
  fs.writeFileSync('/tmp/test11_results.json', JSON.stringify(results, null, 1));
  console.log(fails.length ? 'FAILED: ' + fails.join(', ') : 'ALL ' + Object.keys(results).length + ' CHECKS PASSED');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
