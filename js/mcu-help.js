'use strict';
// ===== v10.1: pinout / reference panel for the microcontroller parts =====
// Content: an SVG pin map, a table of every pin (functions, electrical limits, what the simulator models), common usage
// sections with wiring tips, and the example programs (load the circuit / insert the code into the chip's editor).
// The data below is language-neutral; every sentence is an i18n key (help.*) in js/help/<locale>.js.
// The data part also runs under Node (tools/gen-pinout-docs.js builds docs/pinout-*.md and the SVG files from it).
const MCU_HELP_DATA = (() => {
  // function tag → [category, simulated (1) or not (0), short label used in the pin map]
  const TAGS = {
    dio: ['dig', 1, ''], pwm490: ['pwm', 1, '~PWM'], pwm980: ['pwm', 1, '~PWM'], tpwm: ['pwm', 1, '~PWM'], adc: ['ana', 1, ''],
    rx: ['com', 0, 'RX'], tx: ['com', 0, 'TX'], int0: ['int', 0, 'INT0'], int1: ['int', 0, 'INT1'],
    ss: ['com', 0, 'SS'], mosi: ['com', 0, 'MOSI'], miso: ['com', 0, 'MISO'], sck: ['com', 0, 'SCK'], sda: ['com', 0, 'SDA'], scl: ['com', 0, 'SCL'],
    led: ['spc', 1, 'LED'], aref: ['spc', 0, 'AREF'], ioref: ['pwr', 0, 'IOREF'], reset: ['spc', 0, 'RESET'], treset: ['spc', 1, 'RESET'],
    v5: ['pwr', 1, '5V'], v33: ['pwr', 1, '3.3V'], vin: ['pwr', 1, 'VIN'], gnd: ['gnd', 1, 'GND'], vcc: ['pwr', 1, 'VCC'],
    usi_di: ['com', 0, 'DI/SDA'], usi_do: ['com', 0, 'DO'], usi_sck: ['com', 0, 'USCK/SCL'], xtal: ['spc', 0, ''], ain: ['ana', 0, ''],
    taref: ['spc', 0, 'AREF'], tled: ['spc', 1, 'LED'], icsp: ['com', 0, 'ICSP'],
  };
  // one row per pin: p = name on the board, port = chip port / datasheet names, tags, note = help.note.<key>, absent = no such pin on the simulated part
  const PINS = {
    arduino: [
      { p: 'D0', port: 'PD0 · RXD', tags: ['dio', 'rx'], note: 'd0d1' },
      { p: 'D1', port: 'PD1 · TXD', tags: ['dio', 'tx'], note: 'd0d1' },
      { p: 'D2', port: 'PD2 · INT0', tags: ['dio', 'int0'] },
      { p: 'D3 ~', port: 'PD3 · OC2B · INT1', tags: ['dio', 'pwm490', 'int1'], note: 'tone' },
      { p: 'D4', port: 'PD4', tags: ['dio'] },
      { p: 'D5 ~', port: 'PD5 · OC0B', tags: ['dio', 'pwm980'] },
      { p: 'D6 ~', port: 'PD6 · OC0A', tags: ['dio', 'pwm980'] },
      { p: 'D7', port: 'PD7', tags: ['dio'] },
      { p: 'D8', port: 'PB0', tags: ['dio'] },
      { p: 'D9 ~', port: 'PB1 · OC1A', tags: ['dio', 'pwm490'], note: 'servo' },
      { p: 'D10 ~', port: 'PB2 · OC1B · SS', tags: ['dio', 'pwm490', 'ss'], note: 'servo' },
      { p: 'D11 ~', port: 'PB3 · OC2A · MOSI', tags: ['dio', 'pwm490', 'mosi'], note: 'tone' },
      { p: 'D12', port: 'PB4 · MISO', tags: ['dio', 'miso'] },
      { p: 'D13', port: 'PB5 · SCK', tags: ['dio', 'sck', 'led'], note: 'd13' },
      { p: 'A0 (D14)', port: 'PC0 · ADC0', tags: ['adc', 'dio'] },
      { p: 'A1 (D15)', port: 'PC1 · ADC1', tags: ['adc', 'dio'] },
      { p: 'A2 (D16)', port: 'PC2 · ADC2', tags: ['adc', 'dio'] },
      { p: 'A3 (D17)', port: 'PC3 · ADC3', tags: ['adc', 'dio'] },
      { p: 'A4 (D18)', port: 'PC4 · ADC4 · SDA', tags: ['adc', 'dio', 'sda'], note: 'a4a5' },
      { p: 'A5 (D19)', port: 'PC5 · ADC5 · SCL', tags: ['adc', 'dio', 'scl'], note: 'a4a5' },
      { p: '5V', port: '', tags: ['v5'], note: 'v5' },
      { p: '3.3V', port: '', tags: ['v33'], note: 'v33' },
      { p: 'VIN', port: '', tags: ['vin'], note: 'vin' },
      { p: 'GND ×3', port: '', tags: ['gnd'], note: 'gnd' },
      { p: 'RESET', port: 'PC6', tags: ['reset'], note: 'reset', absent: 1 },
      { p: 'AREF', port: 'AREF', tags: ['aref'], note: 'aref', absent: 1 },
      { p: 'IOREF', port: '', tags: ['ioref'], note: 'ioref', absent: 1 },
      { p: 'SDA / SCL', port: '= A4 / A5', tags: ['sda', 'scl'], note: 'sdascl', absent: 1 },
      { p: 'ICSP', port: 'MISO · SCK · MOSI · RESET · 5V · GND', tags: ['icsp'], note: 'icsp', absent: 1 },
    ],
    attiny85: [
      { p: '1 · PB5', port: 'PCINT5 · RESET · ADC0 · dW', tags: ['treset', 'adc', 'dio'], note: 'pb5', a: 'A0' },
      { p: '2 · PB3', port: 'PCINT3 · XTAL1 · CLKI · OC1B̅ · ADC3', tags: ['dio', 'adc', 'xtal'], note: 'pb34', a: 'A3' },
      { p: '3 · PB4', port: 'PCINT4 · XTAL2 · CLKO · OC1B · ADC2', tags: ['dio', 'tpwm', 'adc', 'xtal'], note: 'pb34', a: 'A2' },
      { p: '4 · GND', port: '', tags: ['gnd'] },
      { p: '5 · PB0', port: 'MOSI · DI · SDA · AIN0 · OC0A · OC1A̅ · AREF · PCINT0', tags: ['dio', 'tpwm', 'usi_di', 'mosi', 'ain', 'taref'], note: 'pb0' },
      { p: '6 · PB1', port: 'MISO · DO · AIN1 · OC0B · OC1A · PCINT1', tags: ['dio', 'tpwm', 'usi_do', 'miso', 'ain', 'tled'], note: 'pb1' },
      { p: '7 · PB2', port: 'SCK · USCK · SCL · ADC1 · T0 · INT0 · PCINT2', tags: ['dio', 'adc', 'usi_sck', 'sck', 'int0'], note: 'pb2', a: 'A1' },
      { p: '8 · VCC', port: '', tags: ['vcc'], note: 'vcc' },
    ],
  };
  // pin map layout: [label, tags, short ADC name]
  const MAP = {
    arduino: {
      right: ['SCL', 'SDA', 'AREF', 'GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8', null, 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'],
      left: ['NC', 'IOREF', 'RESET', '3.3V', '5V', 'GND', 'GND', 'VIN', null, 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
    },
  };
  const LIMITS = { arduino: 8, attiny85: 6 };
  const SIM_NO = 8;
  // usage sections: id → number of paragraphs (help.u.<id>.1 …), code snippet, related examples
  const USAGE = [
    { id: 'power', n: 4, ex: ['tinyblink', 'ardmotor'] },
    { id: 'dout', n: 3, ex: ['ardblink', 'ardtraffic', 'tinyblink'], code: [
      'const int LED_PIN = 8;          // 8 -> 330 ohm -> LED (+), LED (-) -> GND',
      'void setup() {',
      '  pinMode(LED_PIN, OUTPUT);',
      '}',
      'void loop() {',
      '  digitalWrite(LED_PIN, HIGH);   // about 5 V',
      '  delay(500);',
      '  digitalWrite(LED_PIN, LOW);    // 0 V',
      '  delay(500);',
      '}'] },
    { id: 'din', n: 3, ex: ['ardbutton', 'arddebounce'], code: [
      'const int BUTTON_PIN = 2;       // button between pin 2 and GND',
      'void setup() {',
      '  pinMode(BUTTON_PIN, INPUT_PULLUP);',
      '  pinMode(LED_BUILTIN, OUTPUT);',
      '}',
      'void loop() {',
      '  bool pressed = digitalRead(BUTTON_PIN) == LOW;   // LOW = pressed',
      '  digitalWrite(LED_BUILTIN, pressed ? HIGH : LOW);',
      '}'] },
    { id: 'ain', n: 4, ex: ['ardpwm', 'ardnight'], code: [
      'void setup() {',
      '  Serial.begin(9600);',
      '}',
      'void loop() {',
      '  int raw = analogRead(A0);              // 0 ... 1023',
      '  float volts = raw * 5.0 / 1024.0;      // default reference = 5 V',
      '  Serial.println(volts);',
      '  delay(200);',
      '}'] },
    { id: 'pwm', n: 3, ex: ['ardpwm', 'tinyfade'], code: [
      'const int LED_PIN = 9;          // a PWM pin (~)',
      'void setup() {',
      '  pinMode(LED_PIN, OUTPUT);',
      '}',
      'void loop() {',
      '  for (int duty = 0; duty <= 255; duty += 5) {',
      '    analogWrite(LED_PIN, duty);   // 0 = off ... 255 = fully on',
      '    delay(20);',
      '  }',
      '}'] },
    { id: 'motor', n: 3, ex: ['ardmotor'] },
    { id: 'relay', n: 3, ex: ['ardrelay'] },
    { id: 'tone', n: 3, ex: ['ardtone'], code: [
      'const int BUZZER_PIN = 8;       // 8 -> 100 ohm -> passive buzzer -> GND',
      'void setup() {',
      '  tone(BUZZER_PIN, 440, 200);   // A4 for 200 ms',
      '  delay(300);',
      '  tone(BUZZER_PIN, 523, 200);   // C5',
      '}',
      'void loop() {',
      '}'] },
    { id: 'servo', n: 3, ex: ['ardservo'], code: [
      '#include <Servo.h>',
      'Servo myServo;',
      'void setup() {',
      '  myServo.attach(9);            // signal wire on pin 9',
      '}',
      'void loop() {',
      '  myServo.write(0);   delay(1000);',
      '  myServo.write(90);  delay(1000);',
      '  myServo.write(180); delay(1000);',
      '}'] },
    { id: 'lcd', n: 3, ex: ['ardlcd'], code: [
      '#include <LiquidCrystal.h>',
      'LiquidCrystal lcd(12, 11, 5, 4, 3, 2);   // RS, E, D4, D5, D6, D7',
      'void setup() {',
      '  lcd.begin(16, 2);',
      '  lcd.print("Hello!");',
      '}',
      'void loop() {',
      '  lcd.setCursor(0, 1);                   // column 0, row 1',
      '  lcd.print(millis() / 1000);',
      '  lcd.print(" s   ");',
      '  delay(200);',
      '}'] },
    { id: 'serial', n: 3, ex: ['ardpwm', 'arddebounce', 'ardtraffic'], code: [
      'void setup() {',
      '  Serial.begin(9600);',
      '  Serial.println("ready");',
      '}',
      'void loop() {',
      '  if (Serial.available() > 0) {',
      '    String line = Serial.readStringUntil(\'\\n\');',
      '    Serial.print("got: ");',
      '    Serial.println(line);',
      '  }',
      '}'] },
    { id: 'millis', n: 3, ex: ['ardmulti', 'arddebounce'], code: [
      'unsigned long last = 0;',
      'const unsigned long INTERVAL = 500;',
      'bool on = false;',
      'void setup() {',
      '  pinMode(LED_BUILTIN, OUTPUT);',
      '}',
      'void loop() {',
      '  if (millis() - last >= INTERVAL) {',
      '    last += INTERVAL;',
      '    on = !on;',
      '    digitalWrite(LED_BUILTIN, on ? HIGH : LOW);',
      '  }',
      '  // ...other work here keeps running',
      '}'] },
  ];
  const WIRE_TOKENS = ['anode', 'cathode', 'onboard_led', 'red_led', 'yellow_led', 'green_led', 'white_led', 'all_cathodes', 'internal_pullup', 'pot_ends', 'wiper',
    'gate', 'drain', 'source', 'flyback', 'common_gnd', 'servo_sig', 'servo_vcc', 'servo_gnd', 'backlight', 'contrast', 'pin_n4', 'pin_n5', 'pin_n6', 'pin_n8'];
  const CAT_COLORS = { dig: '#5b6b80', pwm: '#e8790c', ana: '#2f9e44', com: '#7b4bc4', int: '#d6336c', pwr: '#d62828', gnd: '#222222', spc: '#1971c2' };
  const CATS = ['dig', 'pwm', 'ana', 'com', 'int', 'pwr', 'gnd', 'spc'];
  const BOARDS = ['arduino', 'attiny85'];

  // ---- SVG pin maps (pure string builders; text is universal: pin names and acronyms) ----
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const chipW = (t) => Math.round(t.length * 6.6 + 12);
  function chip(x, y, text, cat, sim, anchorRight) {
    const w = chipW(text), x0 = anchorRight ? x - w : x, col = CAT_COLORS[cat] || '#555';
    return '<g class="pm-chip pm-' + cat + (sim ? '' : ' pm-nosim') + '"><rect x="' + x0 + '" y="' + (y - 8) + '" width="' + w + '" height="16" rx="4" fill="' + (sim ? col : '#fff') + '" stroke="' + col + '"' + (sim ? '' : ' stroke-dasharray="3 2"') + ' stroke-width="1.4"/>' +
      '<text x="' + (x0 + w / 2) + '" y="' + (y + 4) + '" text-anchor="middle" fill="' + (sim ? '#fff' : col) + '">' + esc(text) + '</text></g>';
  }
  // chips for one pin of the Uno pin map
  function unoChips(name) {
    const P = PINS.arduino, find = (n) => P.find((r) => r.p.split(' ')[0] === n);
    const out = [];
    if (name === 'NC') return [['NC', 'dig', 0]];
    if (name === 'SCL' || name === 'SDA') return [[name, 'com', 0], ['= ' + (name === 'SDA' ? 'A4' : 'A5'), 'ana', 0]];
    if (name === 'GND') return [['GND', 'gnd', 1]];
    if (name === '5V') return [['5V', 'pwr', 1]];
    if (name === '3.3V') return [['3.3V', 'pwr', 1]];
    if (name === 'VIN') return [['VIN', 'pwr', 1], ['7–12V', 'pwr', 1]];
    if (name === 'RESET') return [['RESET', 'spc', 0]];
    if (name === 'IOREF') return [['IOREF', 'pwr', 0]];
    if (name === 'AREF') return [['AREF', 'spc', 0]];
    const r = find(name); if (!r) return [[name, 'dig', 1]];
    if (name[0] === 'A') { out.push([name, 'ana', 1]); out.push(['D' + (14 + +name[1]), 'dig', 1]); }
    else out.push([name, 'dig', 1]);
    for (const t of r.tags) {
      if (t === 'dio' || t === 'adc') continue;
      const [cat, sim, short] = TAGS[t];
      let s = short; if (t === 'pwm490') s = '~490Hz'; if (t === 'pwm980') s = '~980Hz';
      out.push([s, cat, sim]);
    }
    return out;
  }
  function svgUno() {
    const W = 640, top = 54, pitch = 23, bx0 = 262, bx1 = 378;
    const rows = Math.max(MAP.arduino.right.length, MAP.arduino.left.length + 3);
    const H = top + rows * pitch + 40;
    let s = '<svg xmlns="http://www.w3.org/2000/svg" class="pm-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="10.5" font-weight="600">';
    s += '<rect width="' + W + '" height="' + H + '" fill="#fbfdff"/>';
    // board (rotated 90°: USB at the top right, power jack at the top left)
    const by0 = 20, by1 = H - 16;
    s += '<rect x="' + bx0 + '" y="' + by0 + '" width="' + (bx1 - bx0) + '" height="' + (by1 - by0) + '" rx="10" fill="#0f7c86" stroke="#0a5a61" stroke-width="2"/>';
    s += '<rect x="' + (bx1 - 46) + '" y="' + (by0 - 10) + '" width="38" height="44" rx="3" fill="#c9ced6" stroke="#8a929e"/><text x="' + (bx1 - 27) + '" y="' + (by0 + 16) + '" text-anchor="middle" fill="#333" font-size="9">USB</text>';
    s += '<rect x="' + (bx0 + 8) + '" y="' + (by0 - 10) + '" width="34" height="50" rx="3" fill="#2b2b2b"/><text x="' + (bx0 + 25) + '" y="' + (by0 + 20) + '" text-anchor="middle" fill="#ddd" font-size="8">DC</text>';
    s += '<text x="' + ((bx0 + bx1) / 2) + '" y="' + (by0 + 130) + '" text-anchor="middle" fill="#fff" font-size="20" font-weight="800" transform="rotate(90 ' + ((bx0 + bx1) / 2) + ' ' + (by0 + 130) + ')">UNO R3</text>';
    const cy = by0 + 215;
    s += '<rect x="' + ((bx0 + bx1) / 2 - 17) + '" y="' + cy + '" width="34" height="150" rx="3" fill="#1d1d1d"/>';
    s += '<text x="' + ((bx0 + bx1) / 2) + '" y="' + (cy + 75) + '" text-anchor="middle" fill="#bbb" font-size="9" transform="rotate(90 ' + ((bx0 + bx1) / 2) + ' ' + (cy + 75) + ')">ATmega328P</text>';
    s += '<circle cx="' + (bx0 + 24) + '" cy="' + (by1 - 30) + '" r="6" fill="#d0d0d0" stroke="#777"/>';
    s += '<rect x="' + (bx1 - 34) + '" y="' + (top + 4 * 23 - 3) + '" width="8" height="5" fill="#ffd43b"/>';
    const side = (list, right) => {
      list.forEach((name, i) => {
        if (!name) return;
        const y = top + (right ? i : i + 3) * pitch;
        const hx = right ? bx1 - 9 : bx0 + 9;
        s += '<rect x="' + (hx - 6) + '" y="' + (y - 6) + '" width="12" height="12" fill="#151515"/><rect x="' + (hx - 2.5) + '" y="' + (y - 2.5) + '" width="5" height="5" fill="#d4a017"/>';
        s += '<line x1="' + (right ? bx1 : bx0) + '" y1="' + y + '" x2="' + (right ? bx1 + 18 : bx0 - 18) + '" y2="' + y + '" stroke="#9aa5b1" stroke-width="1"/>';
        let x = right ? bx1 + 20 : bx0 - 20;
        for (const [t, cat, sim] of unoChips(name)) { s += chip(x, y, t, cat, sim, !right); x += (right ? 1 : -1) * (chipW(t) + 4); }
      });
    };
    side(MAP.arduino.right, true); side(MAP.arduino.left, false);
    s += '</svg>';
    return s;
  }
  function svgTiny() {
    const W = 700, H = 250, cx = 272, top = 60, pitch = 40;
    let s = '<svg xmlns="http://www.w3.org/2000/svg" class="pm-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="10.5" font-weight="600">';
    s += '<rect width="' + W + '" height="' + H + '" fill="#fbfdff"/>';
    s += '<rect x="' + (cx - 46) + '" y="' + (top - 30) + '" width="92" height="' + (3 * pitch + 60) + '" rx="6" fill="#262626"/>';
    s += '<path d="M' + (cx - 12) + ' ' + (top - 30) + ' a12 12 0 0 0 24 0" fill="#fbfdff"/>';
    s += '<circle cx="' + (cx - 30) + '" cy="' + (top - 12) + '" r="4" fill="#555"/>';
    s += '<text x="' + cx + '" y="' + (top + 1.5 * pitch + 4) + '" text-anchor="middle" fill="#ccc" font-size="11" transform="rotate(-90 ' + cx + ' ' + (top + 1.5 * pitch) + ')">ATtiny85</text>';
    const left = [['PB5', 1], ['PB3', 2], ['PB4', 3], ['GND', 4]], right = [['VCC', 8], ['PB2', 7], ['PB1', 6], ['PB0', 5]];
    const chipsOf = (name) => {
      const r = PINS.attiny85.find((x) => x.p.endsWith(name));
      const out = [[name, name === 'GND' ? 'gnd' : name === 'VCC' ? 'pwr' : 'dig', 1]];
      if (r.a) out.push([r.a, 'ana', 1]);
      for (const t of r.tags) {
        if (t === 'dio' || t === 'adc' || t === 'gnd' || t === 'vcc') continue;
        const [cat, sim, short] = TAGS[t];
        let txt = short;
        if (t === 'xtal') txt = name === 'PB3' ? 'XTAL1' : 'XTAL2';
        if (t === 'ain') txt = name === 'PB0' ? 'AIN0' : 'AIN1';
        if (t === 'tpwm') txt = '~PWM';
        if (!txt) continue;
        out.push([txt, cat, sim]);
      }
      return out;
    };
    const side = (list, isRight) => list.forEach(([name, num], i) => {
      const y = top + i * pitch, px = isRight ? cx + 46 : cx - 46;
      s += '<rect x="' + (isRight ? px : px - 14) + '" y="' + (y - 5) + '" width="14" height="10" fill="#c0c4ca" stroke="#888"/>';
      s += '<text x="' + (isRight ? px - 8 : px + 8) + '" y="' + (y + 4) + '" text-anchor="' + (isRight ? 'end' : 'start') + '" fill="#eee">' + num + '</text>';
      let x = isRight ? px + 22 : px - 22;
      for (const [t, cat, sim] of chipsOf(name)) { s += chip(x, y, t, cat, sim, !isRight); x += (isRight ? 1 : -1) * (chipW(t) + 4); }
    });
    side(left, false); side(right, true);
    s += '</svg>';
    return s;
  }
  return { TAGS, PINS, LIMITS, SIM_NO, USAGE, WIRE_TOKENS, CAT_COLORS, CATS, BOARDS, svg: { arduino: svgUno, attiny85: svgTiny } };
})();
if (typeof module !== 'undefined') module.exports = MCU_HELP_DATA;

// ---------------------------------------------------------------- panel UI (browser only) ---------------------------
const MCUHELP = (typeof document === 'undefined') ? null : (() => {
  const D = MCU_HELP_DATA;
  const S = { el: null, board: 'arduino' };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // `code` spans in help text → <code>
  const fmt = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
  const partName = (type) => { const k = 'c.' + type + '.name', v = _t(k); return v === k ? (DEFS[type] ? DEFS[type].name : type) : v; };
  const boardName = (b) => partName(b);
  const wiringText = (line) => line.replace(/\{c:(\w+)\}/g, (m, t) => partName(t)).replace(/\{w:(\w+)\}/g, (m, w) => _t('help.w.' + w));
  const simState = (row) => {
    if (row.absent) return ['absent', '—'];
    const s = row.tags.map((t) => D.TAGS[t][1]);
    return s.every(Boolean) ? ['yes', '✓'] : s.some(Boolean) ? ['part', '◐'] : ['no', '✗'];
  };
  const exName = (id) => { const e = EXAMPLES.find((x) => x.id === id); return e ? e.name : id; };

  function html() {
    const b = S.board, other = b === 'arduino' ? 'attiny85' : 'arduino';
    let h = '<div class="mw-h pw-h"><span class="mw-title">📌 ' + esc(_t('help.title')) + '</span>' +
      D.BOARDS.map((x) => '<button class="pw-board' + (x === b ? ' on' : '') + '" data-b="' + x + '">' + esc(boardName(x)) + '</button>').join('') +
      '<button class="mw-x pw-x" title="' + esc(_t('mcu.close')) + '">✕</button></div>';
    h += '<div class="pw-nav">' + ['pinout', 'table', 'limits', 'sim', 'usage', 'examples'].map((k) => '<a href="#" data-go="pw-' + k + '">' + esc(_t('help.nav.' + k)) + '</a>').join('') + '</div>';
    h += '<div class="pw-body">';
    h += '<p class="pw-intro">' + fmt(_t('help.intro.' + b)) + '</p>';
    // pin map
    h += '<h3 id="pw-pinout">' + esc(_t('help.nav.pinout')) + '</h3><div class="pw-svg">' + D.svg[b]() + '</div>';
    h += '<div class="pw-legend">' + D.CATS.map((c) => '<span><i style="background:' + D.CAT_COLORS[c] + '"></i>' + esc(_t('help.cat.' + c)) + '</span>').join('') +
      '<span><i class="ns"></i>' + esc(_t('help.leg.nosim')) + '</span></div>';
    // table
    h += '<h3 id="pw-table">' + esc(_t('help.nav.table')) + '</h3><table class="pw-tab"><thead><tr><th>' + esc(_t('help.th.pin')) + '</th><th>' + esc(_t('help.th.func')) + '</th><th>' + esc(_t('help.th.sim')) + '</th></tr></thead><tbody>';
    let prevNote = null;
    for (const r of D.PINS[b]) {
      const [st, sym] = simState(r);
      const showNote = r.note && r.note !== prevNote; prevNote = r.note || null;
      h += '<tr><td class="pw-pin"><b>' + esc(r.p) + '</b>' + (r.port ? '<small>' + esc(r.port) + '</small>' : '') + '</td><td>' +
        r.tags.map((t) => '<span class="pw-tag pw-' + D.TAGS[t][0] + (D.TAGS[t][1] && !r.absent ? '' : ' ns') + '">' + esc(_t('help.tag.' + t)) + '</span>').join(' ') +
        (showNote ? '<div class="pw-note">' + fmt(_t('help.note.' + r.note)) + '</div>' : '') + '</td><td class="pw-sim pw-s-' + st + '" title="' + esc(_t('help.sim.' + st)) + '">' + sym + ' <small>' + esc(_t('help.sim.' + st)) + '</small></td></tr>';
    }
    h += '</tbody></table>';
    // electrical limits
    h += '<h3 id="pw-limits">' + esc(_t('help.nav.limits')) + '</h3><ul class="pw-ul">';
    for (let i = 1; i <= D.LIMITS[b]; i++) h += '<li>' + fmt(_t('help.lim.' + b + '.' + i)) + '</li>';
    h += '</ul>';
    // simulator support
    h += '<h3 id="pw-sim">' + esc(_t('help.nav.sim')) + '</h3><p class="pw-ok">✓ ' + fmt(_t('help.sim.ok')) + '</p><ul class="pw-ul pw-no">';
    for (let i = 1; i <= D.SIM_NO; i++) h += '<li>✗ ' + fmt(_t('help.sim.no.' + i)) + '</li>';
    h += '</ul>';
    // usage
    h += '<h3 id="pw-usage">' + esc(_t('help.nav.usage')) + '</h3><p class="pw-intro">' + fmt(_t('help.usage.intro')) + '</p>';
    h += '<div class="pw-toc">' + D.USAGE.map((u) => '<a href="#" data-go="pw-u-' + u.id + '">' + esc(_t('help.u.' + u.id + '.t')) + '</a>').join('') + '</div>';
    for (const u of D.USAGE) {
      h += '<section class="pw-u" id="pw-u-' + u.id + '"><h4>' + esc(_t('help.u.' + u.id + '.t')) + '</h4>';
      for (let i = 1; i <= u.n; i++) h += '<p>' + fmt(_t('help.u.' + u.id + '.' + i)) + '</p>';
      if (u.code) h += '<pre class="pw-code">' + esc(u.code.join('\n')) + '</pre>';
      if (u.ex && u.ex.length) h += '<div class="pw-rel">' + esc(_t('help.ex.examples')) + ': ' + u.ex.map((id) => '<a href="#" data-ex="' + id + '">' + esc(exName(id)) + '</a>').join(' · ') + '</div>';
      h += '</section>';
    }
    // examples
    h += '<h3 id="pw-examples">' + esc(_t('help.nav.examples')) + '</h3><p class="pw-intro">' + fmt(_t('help.ex.intro')) + '</p>';
    const mine = Object.keys(MCU_EX).filter((id) => MCU_EX[id].board === b), others = Object.keys(MCU_EX).filter((id) => MCU_EX[id].board !== b);
    for (const id of mine) {
      const E = MCU_EX[id];
      h += '<section class="pw-ex" id="pw-ex-' + id + '" data-id="' + id + '"><h4>' + esc(exName(id)) + '</h4><p>' + fmt(_t('exd.' + id)) + '</p>';
      h += '<div class="pw-sub">' + esc(_t('help.ex.wiring')) + '</div><ul class="pw-wire">' + E.wiring.map((w) => '<li>' + esc(wiringText(w)) + '</li>').join('') + '</ul>';
      h += '<div class="pw-sub">' + esc(_t('help.ex.usage')) + ': ' + E.usage.map((u) => '<a href="#" data-go="pw-u-' + u + '">' + esc(_t('help.u.' + u + '.t')) + '</a>').join(' · ') + '</div>';
      h += '<div class="pw-sub">' + esc(_t('help.ex.code')) + '</div><pre class="pw-code">' + esc(E.code) + '</pre>';
      h += '<div class="pw-btns"><button class="primary pw-load" data-id="' + id + '">▶ ' + esc(_t('help.ex.load')) + '</button><button class="pw-insert" data-id="' + id + '">✎ ' + esc(_t('help.ex.insert')) + '</button><button class="pw-copy" data-id="' + id + '">📋 ' + esc(_t('help.ex.copy')) + '</button></div></section>';
    }
    if (others.length) h += '<p class="pw-other"><a href="#" data-b="' + other + '">' + esc(_t('help.ex.other', { board: boardName(other), n: others.length })) + '</a></p>';
    h += '</div><div class="mw-grip"></div>';
    return h;
  }
  function scrollTo(id) {
    const body = S.el.querySelector('.pw-body'), t = S.el.querySelector('#' + id); if (!body || !t) return;
    body.scrollTop += t.getBoundingClientRect().top - body.getBoundingClientRect().top - 6;
    if (t.classList.contains('pw-ex')) { t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); }
  }
  function bind() {
    const el = S.el;
    el.querySelector('.pw-x').onclick = close;
    el.querySelectorAll('[data-b]').forEach((x) => x.onclick = (e) => { e.preventDefault(); S.board = x.dataset.b; render(); });
    el.querySelectorAll('[data-go]').forEach((a) => a.onclick = (e) => { e.preventDefault(); scrollTo(a.dataset.go); });
    el.querySelectorAll('[data-ex]').forEach((a) => a.onclick = (e) => { e.preventDefault(); const id = a.dataset.ex; if (MCU_EX[id].board !== S.board) { S.board = MCU_EX[id].board; render(); } scrollTo('pw-ex-' + id); });
    el.querySelectorAll('.pw-load').forEach((x) => x.onclick = () => loadExample(x.dataset.id));
    el.querySelectorAll('.pw-insert').forEach((x) => x.onclick = () => insertExample(x.dataset.id));
    el.querySelectorAll('.pw-copy').forEach((x) => x.onclick = () => copyExample(x.dataset.id));
    // drag by the header, resize with the grip
    const hd = el.querySelector('.pw-h');
    hd.onpointerdown = (ev) => {
      if (ev.target.closest('button')) return;
      const r = el.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top;
      const mv = (e) => { el.style.left = U.clamp(e.clientX - dx, 0, innerWidth - 80) + 'px'; el.style.top = U.clamp(e.clientY - dy, 0, innerHeight - 40) + 'px'; };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    };
    const grip = el.querySelector('.mw-grip');
    grip.onpointerdown = (ev) => {
      ev.preventDefault(); const r = el.getBoundingClientRect(), x0 = ev.clientX, y0 = ev.clientY;
      const mv = (e) => { el.style.width = Math.max(420, r.width + e.clientX - x0) + 'px'; el.style.height = Math.max(320, r.height + e.clientY - y0) + 'px'; };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    };
  }
  function render(keepScroll) {
    if (!S.el) return;
    const body = S.el.querySelector('.pw-body'), top = keepScroll && body ? body.scrollTop : 0;
    S.el.innerHTML = html(); bind();
    const nb = S.el.querySelector('.pw-body'); if (nb) nb.scrollTop = top;
  }
  // put the panel beside the program editor when that is open (left of it if there is room, else right), else at the stage's left edge
  function place(el, force) {
    const ed = document.getElementById('mcu-win'), stage = document.getElementById('stage');
    const sr = stage ? stage.getBoundingClientRect() : { left: 8, top: 60, right: innerWidth };
    const edOpen = ed && ed.style.display !== 'none' && ed.offsetWidth > 0;
    const pr = el.getBoundingClientRect();
    if (!force) {
      if (!edOpen) return;
      const er = ed.getBoundingClientRect();
      if (Math.min(er.right, pr.right) - Math.max(er.left, pr.left) <= 0 || Math.min(er.bottom, pr.bottom) - Math.max(er.top, pr.top) <= 0) return;
    }
    let w = Math.min(640, innerWidth - 24), left = sr.left + 12;
    if (edOpen) {
      const er = ed.getBoundingClientRect();
      if (er.left - 18 >= 420) { w = Math.min(w, er.left - 18); left = er.left - w - 10; }
      else if (innerWidth - er.right - 18 >= 420) { w = Math.min(w, innerWidth - er.right - 18); left = er.right + 10; }
      else left = Math.max(8, er.left - w / 2);
    }
    el.style.left = Math.max(8, left) + 'px'; el.style.top = Math.max(8, sr.top + 12) + 'px';
    el.style.width = w + 'px'; el.style.height = Math.max(360, innerHeight - (sr.top + 12) - 40) + 'px';
  }
  function open(board, section) {
    if (board && MCU_HELP_DATA.PINS[board]) S.board = board;
    let el = S.el, fresh = false;
    if (!el) {
      el = document.createElement('div'); el.id = 'pin-win'; el.className = 'mcu-win pin-win';
      document.body.appendChild(el); S.el = el; fresh = true;
    }
    el.style.display = 'flex';
    place(el, fresh);
    render();
    if (section) scrollTo(section.startsWith('pw-') ? section : 'pw-' + section);
  }
  function close() { if (S.el) S.el.style.display = 'none'; }
  const isOpen = () => !!S.el && S.el.style.display !== 'none';
  function relang() { if (isOpen()) render(true); }
  function loadExample(id) {
    app.loadExample(id);
    if (app.run && !app.running) app.run();
    const c = app.comps.find((x) => DEFS[x.type].mcu);
    if (c) { app.sel = { comp: c }; app.refreshProps(); }
  }
  // the chip whose editor should receive the code: open editor → selected chip → first chip of the right type → any chip
  function targetChip(board) {
    const W = MCU.W;
    if (W && W.el && W.el.style.display !== 'none' && W.id !== null) { const c = app.comps.find((x) => x.id === W.id); if (c) return c; }
    const s = app.sel && app.sel.comp; if (s && DEFS[s.type].mcu) return s;
    return app.comps.find((x) => x.type === board) || app.comps.find((x) => DEFS[x.type].mcu) || null;
  }
  function insertExample(id) {
    const E = MCU_EX[id]; const c = targetChip(E.board);
    if (!c) { app.toast(_t('help.toast.no_chip')); return false; }
    MCU.openEditor(c);
    const W = MCU.W, ta = W.el.querySelector('.mw-code'), lang = W.el.querySelector('.mw-lang');
    ta.value = E.code; if (lang) lang.value = 'ino';
    ta.dispatchEvent(new Event('input')); ta.scrollTop = 0; ta.setSelectionRange(0, 0);
    app.toast(c.type !== E.board ? _t('help.toast.mismatch', { board: boardName(E.board) }) : _t('help.toast.inserted', { chip: DEFS[c.type].name }));
    return true;
  }
  function copyExample(id) {
    const text = MCU_EX[id].code;
    const done = () => app.toast(_t('help.toast.copied'));
    const fallback = () => {
      try {
        const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy'); ta.remove(); app.toast(ok ? _t('help.toast.copied') : _t('help.toast.copy_failed'));
      } catch (e) { app.toast(_t('help.toast.copy_failed')); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  return { open, close, relang, isOpen, loadExample, insertExample, copyExample, S, D, scrollTo };
})();
