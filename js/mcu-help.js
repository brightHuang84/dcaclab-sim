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
    { id: 'lcd', n: 4, ex: ['ardlcd', 'snlcdi2c'], code: [
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
  // sensors section: part type → how a program reads it (help.s.how.<kind>)
  const SENSORS = [
    ['ldrmod', 'ana_do'], ['mqgas', 'ana_do'], ['flame', 'ana_do'], ['soil', 'ana_do'], ['rainmod', 'ana_do'], ['ntcmod', 'ana_do'], ['soundmod', 'ana_do'], ['tcrt5000', 'ana_do'],
    ['waterlvl', 'ana'], ['lm35', 'ana'], ['tmp36', 'ana'], ['flex', 'ana'], ['fsr', 'ana'], ['joystick', 'ana'], ['acs712', 'ana'], ['pressure', 'ana'],
    ['pir', 'dig'], ['irobst', 'dig'], ['tilt', 'dig'], ['sw420', 'dig'], ['ttp223', 'dig'], ['encoder', 'enc'],
    ['hcsr04', 'pulse'], ['dht', 'dht'], ['ds18b20', 'ow'], ['lcdi2c', 'i2c']];
  const SENS_HOW = ['ana_do', 'ana', 'dig', 'enc', 'pulse', 'dht', 'ow', 'i2c'];
  const SENS_TIPS = 4;
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
  // ---------------------------------------------------------------- v12: more boards ----------------------------------------
  Object.assign(TAGS, {
    adc12: ['ana', 1, ''], adc2: ['ana', 1, 'ADC2'], dac: ['ana', 1, 'DAC'], touch: ['spc', 1, 'TOUCH'], inonly: ['dig', 1, 'IN'],
    strap: ['spc', 0, 'BOOT'], bled: ['spc', 1, 'LED'], ledlow: ['spc', 1, 'LED'], vbus: ['pwr', 1, 'VBUS'], vsys: ['pwr', 1, 'VSYS'],
    raw: ['pwr', 1, 'RAW'], ft: ['spc', 0, 'FT'], vbat: ['pwr', 0, 'VBAT'], swd: ['com', 0, 'SWD'], en33: ['pwr', 0, '3V3_EN'],
    p0: ['dig', 1, ''], quasi: ['dig', 1, ''], rsth: ['spc', 1, 'RST'], ea: ['spc', 1, 'EA'], xmem: ['spc', 0, ''], t01: ['int', 0, 'T0/T1'],
  });
  Object.assign(PINS, {
    nano: [
      { p: 'D0 / D1', port: 'PD0 · RXD / PD1 · TXD', tags: ['dio', 'rx', 'tx'], note: 'd0d1' },
      { p: 'D2, D4, D7, D8, D12', port: 'PD2 · PD4 · PD7 · PB0 · PB4', tags: ['dio'] },
      { p: 'D3, D9, D10, D11 ~', port: 'OC2B · OC1A · OC1B · OC2A', tags: ['dio', 'pwm490'], note: 'tone' },
      { p: 'D5, D6 ~', port: 'OC0B · OC0A', tags: ['dio', 'pwm980'] },
      { p: 'D13', port: 'PB5 · SCK', tags: ['dio', 'sck', 'led'], note: 'nano_d13' },
      { p: 'A0–A5 (D14–D19)', port: 'PC0–PC5 · ADC0–ADC5', tags: ['adc', 'dio'], note: 'a4a5n' },
      { p: 'A6, A7', port: 'ADC6 · ADC7', tags: ['adc'], note: 'a6a7' },
      { p: '5V', port: '', tags: ['v5'], note: 'nano_5v' },
      { p: '3V3', port: '', tags: ['v33'], note: 'nano_3v3' },
      { p: 'VIN', port: '', tags: ['vin'], note: 'vin' },
      { p: 'GND ×2', port: '', tags: ['gnd'], note: 'gnd2' },
      { p: 'RST ×2 · AREF', port: 'PC6 · AREF', tags: ['reset', 'aref'], note: 'rstref', absent: 1 },
    ],
    mega: [
      { p: 'D0 / D1', port: 'PE0 · RXD0 / PE1 · TXD0', tags: ['dio', 'rx', 'tx'], note: 'd0d1' },
      { p: 'D2–D13 ~', port: 'OC3B · OC3C · OC0B · OC3A · OC4A–C · OC2B · OC2A · OC1A · OC1B · OC0A', tags: ['dio', 'pwm490'], note: 'mega_pwm' },
      { p: 'D13', port: 'PB7', tags: ['dio', 'led'] },
      { p: 'D14–D19', port: 'TX3 · RX3 · TX2 · RX2 · TX1 · RX1', tags: ['dio', 'tx', 'rx'], note: 'mega_serial' },
      { p: 'D20 / D21', port: 'SDA / SCL', tags: ['dio', 'sda', 'scl'] },
      { p: 'D22–D43, D47–D49', port: 'PA · PC · PL · PG · PD7', tags: ['dio'] },
      { p: 'D44–D46 ~', port: 'OC5C · OC5B · OC5A', tags: ['dio', 'pwm490'] },
      { p: 'D50–D53', port: 'MISO · MOSI · SCK · SS', tags: ['dio', 'miso', 'mosi', 'sck', 'ss'] },
      { p: 'A0–A15 (D54–D69)', port: 'PF0–PF7 · PK0–PK7 · ADC0–ADC15', tags: ['adc', 'dio'] },
      { p: '5V', port: '', tags: ['v5'], note: 'v5' },
      { p: '3.3V', port: '', tags: ['v33'], note: 'v33' },
      { p: 'VIN', port: '', tags: ['vin'], note: 'vin' },
      { p: 'GND ×5', port: '', tags: ['gnd'], note: 'gnd2' },
      { p: 'RESET · AREF · IOREF', port: '', tags: ['reset', 'aref', 'ioref'], note: 'rstref', absent: 1 },
    ],
    promini: [
      { p: 'D0 (RXI) / D1 (TXO)', port: 'PD0 · RXD / PD1 · TXD', tags: ['dio', 'rx', 'tx'], note: 'pm_serial' },
      { p: 'D2, D4, D7, D8, D12', port: 'PD2 · PD4 · PD7 · PB0 · PB4', tags: ['dio'] },
      { p: 'D3, D5, D6, D9, D10, D11 ~', port: 'OC2B · OC0B · OC0A · OC1A · OC1B · OC2A', tags: ['dio', 'pwm490', 'pwm980'] },
      { p: 'D13', port: 'PB5 · SCK', tags: ['dio', 'sck', 'led'], note: 'nano_d13' },
      { p: 'A0–A3', port: 'PC0–PC3 · ADC0–ADC3', tags: ['adc', 'dio'] },
      { p: 'A4 / A5', port: 'PC4 · SDA / PC5 · SCL', tags: ['adc', 'dio', 'sda', 'scl'], note: 'pm_inner' },
      { p: 'A6, A7', port: 'ADC6 · ADC7', tags: ['adc'], note: 'a6a7' },
      { p: 'VCC', port: '', tags: ['vcc'], note: 'pm_vcc' },
      { p: 'RAW', port: '', tags: ['raw'], note: 'pm_raw' },
      { p: 'GND ×2', port: '', tags: ['gnd'], note: 'gnd2' },
      { p: 'RST ×2 · FTDI header', port: 'DTR · TXO · RXI · VCC · GND', tags: ['reset'], note: 'pm_ftdi', absent: 1 },
    ],
    esp32: [
      { p: 'GPIO36 (VP), GPIO39 (VN), GPIO34, GPIO35', port: 'ADC1_CH0 · CH3 · CH6 · CH7', tags: ['inonly', 'adc12'], note: 'esp_inonly' },
      { p: 'GPIO32, GPIO33', port: 'ADC1_CH4 / CH5 · T9 / T8', tags: ['dio', 'tpwm', 'adc12', 'touch'] },
      { p: 'GPIO25, GPIO26', port: 'DAC1 / DAC2 · ADC2_CH8 / CH9', tags: ['dio', 'tpwm', 'dac', 'adc2'], note: 'esp_dac' },
      { p: 'GPIO4, 12, 13, 14, 15, 27', port: 'ADC2 · T0 · T5 · T4 · T6 · T3 · T7', tags: ['dio', 'tpwm', 'adc2', 'touch'], note: 'esp_adc2' },
      { p: 'GPIO2', port: 'ADC2_CH2 · T2', tags: ['dio', 'tpwm', 'adc2', 'touch', 'bled', 'strap'] },
      { p: 'GPIO0 (BOOT)', port: 'ADC2_CH1 · T1', tags: ['dio', 'strap'], note: 'esp_gpio0' },
      { p: 'GPIO5, 12, 15', port: 'GPIO5 · MTDI · MTDO', tags: ['strap'], note: 'esp_strap' },
      { p: 'GPIO1 (TX0) / GPIO3 (RX0)', port: 'UART0', tags: ['dio', 'tx', 'rx'], note: 'esp_uart0' },
      { p: 'GPIO16 (RX2) / GPIO17 (TX2), GPIO5, 18, 19, 23', port: 'UART2 · VSPI SS / SCK / MISO / MOSI', tags: ['dio', 'tpwm'] },
      { p: 'GPIO21 / GPIO22', port: 'SDA / SCL', tags: ['dio', 'tpwm', 'sda', 'scl'] },
      { p: 'EN', port: 'CHIP_PU', tags: ['treset'], note: 'esp_en' },
      { p: 'VIN', port: '', tags: ['vin'], note: 'esp_vin' },
      { p: '3V3', port: '', tags: ['v33'] },
      { p: 'GND ×2', port: '', tags: ['gnd'], note: 'gnd2' },
      { p: 'GPIO6–GPIO11', port: 'SPI FLASH', tags: ['dio'], note: 'esp_flash', absent: 1 },
    ],
    pico: [
      { p: 'GP0–GP22', port: 'GPIO0–GPIO22', tags: ['dio', 'tpwm'], note: 'pico_gpio' },
      { p: 'GP0 / GP1', port: 'UART0 TX / RX', tags: ['tx', 'rx'] },
      { p: 'GP4 / GP5', port: 'I2C0 SDA / SCL', tags: ['sda', 'scl'] },
      { p: 'GP26–GP28 (A0–A2)', port: 'ADC0–ADC2', tags: ['dio', 'tpwm', 'adc12'], note: 'pico_adc' },
      { p: 'GP25', port: 'LED', tags: ['bled'] },
      { p: 'GP29 (A3)', port: 'ADC3 · VSYS ÷ 3', tags: ['adc12'], note: 'pico_gp29' },
      { p: 'GP24', port: 'VBUS SENSE', tags: ['dio'], note: 'pico_onboard' },
      { p: 'VBUS', port: '', tags: ['vbus'], note: 'pico_vbus' },
      { p: 'VSYS', port: '', tags: ['vsys'], note: 'pico_vsys' },
      { p: '3V3 (OUT)', port: '', tags: ['v33'], note: 'pico_3v3' },
      { p: 'RUN', port: '', tags: ['treset'], note: 'pico_run' },
      { p: 'GND ×7 · AGND', port: '', tags: ['gnd'], note: 'gnd2' },
      { p: '3V3_EN · ADC_VREF', port: '', tags: ['en33', 'aref'], note: 'pico_en', absent: 1 },
      { p: 'GP23', port: 'SMPS PS', tags: ['dio'], note: 'pico_onboard', absent: 1 },
    ],
    bluepill: [
      { p: 'PA0–PA3, PA6, PA7', port: 'ADC12_IN0–IN3 · IN6 · IN7 · TIM2 / TIM3', tags: ['dio', 'adc12', 'tpwm'], note: 'bp_adc' },
      { p: 'PA4, PA5', port: 'ADC12_IN4 · IN5', tags: ['dio', 'adc12'] },
      { p: 'PB0, PB1', port: 'ADC12_IN8 · IN9 · TIM3_CH3 / CH4', tags: ['dio', 'adc12', 'tpwm'] },
      { p: 'PA8–PA11', port: 'TIM1_CH1–CH4', tags: ['dio', 'tpwm', 'ft'] },
      { p: 'PA9 / PA10', port: 'USART1 TX / RX', tags: ['tx', 'rx'] },
      { p: 'PA11 / PA12', port: 'USB D− / D+', tags: ['dio', 'ft'], note: 'bp_usb' },
      { p: 'PA15, PB3, PB4, PB5', port: 'JTDI · JTDO · NJTRST', tags: ['dio', 'ft'] },
      { p: 'PB6 / PB7', port: 'I2C1 SCL / SDA · TIM4_CH1 / CH2', tags: ['dio', 'tpwm', 'scl', 'sda', 'ft'] },
      { p: 'PB8, PB9', port: 'TIM4_CH3 / CH4', tags: ['dio', 'tpwm', 'ft'] },
      { p: 'PB10–PB15', port: 'I2C2 · USART3 · SPI2', tags: ['dio', 'ft'] },
      { p: 'PC13', port: '', tags: ['dio', 'ledlow'], note: 'bp_pc13' },
      { p: 'PC14, PC15', port: 'OSC32_IN / OUT', tags: ['dio', 'xtal'], note: 'bp_pc13' },
      { p: '5V', port: '', tags: ['v5'], note: 'bp_5v' },
      { p: '3.3 ×2', port: '', tags: ['v33'] },
      { p: 'G ×3', port: '', tags: ['gnd'], note: 'gnd2' },
      { p: 'R', port: 'NRST', tags: ['treset'] },
      { p: 'VB', port: 'VBAT', tags: ['vbat'], note: 'bp_vb', absent: 1 },
      { p: 'PA13 / PA14', port: 'SWDIO / SWCLK', tags: ['swd'], note: 'bp_swd', absent: 1 },
    ],
    c51: [
      { p: 'P0.0–P0.7 (39–32)', port: 'AD0–AD7', tags: ['p0'], note: 'c51_p0' },
      { p: 'P1.0–P1.7 (1–8)', port: 'T2 · T2EX (P1.0 / P1.1)', tags: ['quasi'], note: 'c51_quasi' },
      { p: 'P2.0–P2.7 (21–28)', port: 'A8–A15', tags: ['quasi'] },
      { p: 'P3.0 / P3.1 (10, 11)', port: 'RXD / TXD', tags: ['quasi', 'rx', 'tx'] },
      { p: 'P3.2 / P3.3 (12, 13)', port: 'INT0 / INT1', tags: ['quasi', 'int0', 'int1'] },
      { p: 'P3.4 / P3.5 (14, 15)', port: 'T0 / T1', tags: ['quasi', 't01'] },
      { p: 'P3.6 / P3.7 (16, 17)', port: 'WR / RD', tags: ['quasi', 'xmem'] },
      { p: 'RST (9)', port: '', tags: ['rsth'], note: 'c51_rst' },
      { p: 'XTAL1 / XTAL2 (19, 18)', port: '', tags: ['xtal'], note: 'c51_xtal' },
      { p: 'EA (31)', port: 'EA / VPP', tags: ['ea'], note: 'c51_ea' },
      { p: 'PSEN / ALE (29, 30)', port: '', tags: ['xmem'] },
      { p: 'VCC (40)', port: '', tags: ['vcc'], note: 'c51_vcc' },
      { p: 'GND (20)', port: '', tags: ['gnd'], note: 'gnd2' },
    ],
  });
  Object.assign(LIMITS, { nano: 4, mega: 4, promini: 4, esp32: 6, pico: 5, bluepill: 5, c51: 5 });
  // per board: lines of the "what the simulator does not do" list (generic help.sim.no.<i> + board-specific help.simb.<board>.<i>)
  const SIM_GENERIC = [1, 6, 7, 8];
  // the 8051 has no attachInterrupt / EEPROM-AVR registers and its timing is estimated (help.simb.c51.2): only the generic over-current line
  const SIMG = { c51: [6] };
  const SIMB = { nano: 1, mega: 1, promini: 1, esp32: 3, pico: 2, bluepill: 1, c51: 3 };
  BOARDS.push('nano', 'mega', 'promini', 'esp32', 'pico', 'bluepill', 'c51');
  // pin map for the boards above: header columns top → bottom with the USB end (or pin 1 of the DIP) at the top.
  // Every pin: 'cat:Label|cat:chip|…' (a trailing ! = not simulated); null = gap.
  const BMAP = {
    nano: { col: '#1f5fa8', title: 'NANO', usb: 1,
      left: ['dig:D13|spc:LED|com:SCK!', 'pwr:3V3', 'spc:AREF!', 'ana:A0|dig:D14', 'ana:A1|dig:D15', 'ana:A2|dig:D16', 'ana:A3|dig:D17', 'ana:A4|dig:D18|com:SDA!', 'ana:A5|dig:D19|com:SCL!', 'ana:A6|ana:ADC', 'ana:A7|ana:ADC', 'pwr:5V', 'spc:RST!', 'gnd:GND', 'pwr:VIN|pwr:7–12V'],
      right: ['dig:D12|com:MISO!', 'dig:D11|pwm:~490Hz|com:MOSI!', 'dig:D10|pwm:~490Hz|com:SS!', 'dig:D9|pwm:~490Hz', 'dig:D8', 'dig:D7', 'dig:D6|pwm:~980Hz', 'dig:D5|pwm:~980Hz', 'dig:D4', 'dig:D3|pwm:~490Hz|int:INT1!', 'dig:D2|int:INT0!', 'gnd:GND', 'spc:RST!', 'dig:D0|com:RX!', 'dig:D1|com:TX!'] },
    promini: { col: '#c62828', title: 'Pro Mini',
      left: ['dig:D1|com:TXO!', 'dig:D0|com:RXI!', 'spc:RST!', 'gnd:GND', 'dig:D2|int:INT0!', 'dig:D3|pwm:~PWM', 'dig:D4', 'dig:D5|pwm:~PWM', 'dig:D6|pwm:~PWM', 'dig:D7', 'dig:D8', 'dig:D9|pwm:~PWM'],
      right: ['pwr:RAW|pwr:≤12V', 'gnd:GND', 'spc:RST!', 'pwr:VCC', 'ana:A3', 'ana:A2', 'ana:A1', 'ana:A0', 'dig:D13|spc:LED', 'dig:D12', 'dig:D11|pwm:~PWM', 'dig:D10|pwm:~PWM'],
      inner: ['ana:A4|com:SDA!', 'ana:A5|com:SCL!', 'ana:A6|ana:ADC', 'ana:A7|ana:ADC'] },
    esp32: { col: '#222', title: 'ESP32', usb: 0,
      left: ['spc:EN|spc:RESET', 'dig:VP|ana:GPIO36|dig:IN', 'dig:VN|ana:GPIO39|dig:IN', 'dig:D34|ana:ADC1|dig:IN', 'dig:D35|ana:ADC1|dig:IN', 'dig:D32|ana:ADC1|spc:T9', 'dig:D33|ana:ADC1|spc:T8', 'dig:D25|ana:DAC1|ana:ADC2', 'dig:D26|ana:DAC2|ana:ADC2', 'dig:D27|ana:ADC2|spc:T7', 'dig:D14|ana:ADC2|spc:T6', 'dig:D12|ana:ADC2|spc:T5|spc:BOOT!', 'dig:D13|ana:ADC2|spc:T4', 'gnd:GND', 'pwr:VIN|pwr:5V'],
      right: ['dig:D23|com:MOSI!', 'dig:D22|com:SCL', 'dig:TX0|dig:GPIO1|com:TX!', 'dig:RX0|dig:GPIO3|com:RX!', 'dig:D21|com:SDA', 'dig:D19|com:MISO!', 'dig:D18|com:SCK!', 'dig:D5|com:SS!|spc:BOOT!', 'dig:TX2|dig:GPIO17', 'dig:RX2|dig:GPIO16', 'dig:D4|ana:ADC2|spc:T0', 'dig:D2|spc:LED|ana:ADC2|spc:T2', 'dig:D15|ana:ADC2|spc:T3|spc:BOOT!', 'gnd:GND', 'pwr:3V3'] },
    pico: { col: '#1c7a3c', title: 'Pico', usb: 1,
      left: ['dig:GP0|com:TX!', 'dig:GP1|com:RX!', 'gnd:GND', 'dig:GP2', 'dig:GP3', 'dig:GP4|com:SDA', 'dig:GP5|com:SCL', 'gnd:GND', 'dig:GP6', 'dig:GP7', 'dig:GP8', 'dig:GP9', 'gnd:GND', 'dig:GP10', 'dig:GP11', 'dig:GP12', 'dig:GP13', 'gnd:GND', 'dig:GP14', 'dig:GP15'],
      right: ['pwr:VBUS|pwr:5V', 'pwr:VSYS|pwr:1.8–5.5V', 'gnd:GND', 'pwr:3V3_EN!', 'pwr:3V3|pwr:OUT', 'spc:ADC_VREF!', 'dig:GP28|ana:A2', 'gnd:AGND', 'dig:GP27|ana:A1', 'dig:GP26|ana:A0', 'spc:RUN|spc:RESET', 'dig:GP22', 'gnd:GND', 'dig:GP21', 'dig:GP20', 'dig:GP19', 'dig:GP18', 'gnd:GND', 'dig:GP17', 'dig:GP16'] },
    bluepill: { col: '#1f4fb8', title: 'Blue Pill', usb: 1,
      left: ['dig:B12|spc:FT!', 'dig:B13|spc:FT!', 'dig:B14|spc:FT!', 'dig:B15|spc:FT!', 'dig:A8|pwm:~PWM', 'dig:A9|pwm:~PWM|com:TX!', 'dig:A10|pwm:~PWM|com:RX!', 'dig:A11|pwm:~PWM|com:USB D−!', 'dig:A12|com:USB D+!', 'dig:A15', 'dig:B3', 'dig:B4', 'dig:B5', 'dig:B6|pwm:~PWM|com:SCL', 'dig:B7|pwm:~PWM|com:SDA', 'dig:B8|pwm:~PWM', 'dig:B9|pwm:~PWM', 'pwr:5V', 'gnd:G', 'pwr:3.3'],
      right: ['gnd:G', 'gnd:G', 'pwr:3.3', 'spc:R|spc:RESET', 'dig:B11', 'dig:B10', 'dig:B1|ana:ADC|pwm:~PWM', 'dig:B0|ana:ADC|pwm:~PWM', 'dig:A7|ana:ADC|pwm:~PWM', 'dig:A6|ana:ADC|pwm:~PWM', 'dig:A5|ana:ADC', 'dig:A4|ana:ADC', 'dig:A3|ana:ADC|pwm:~PWM', 'dig:A2|ana:ADC|pwm:~PWM', 'dig:A1|ana:ADC|pwm:~PWM', 'dig:A0|ana:ADC|pwm:~PWM', 'dig:C15', 'dig:C14', 'dig:C13|spc:LED ↓', 'pwr:VB!'] },
    mega: { col: '#0f7c86', title: 'MEGA 2560', usb: 1,
      left: ['pwr:IOREF!', 'spc:RESET!', 'pwr:3.3V', 'pwr:5V', 'gnd:GND', 'gnd:GND', 'pwr:VIN|pwr:7–12V', null, ...Array.from({ length: 16 }, (_, i) => 'ana:A' + i + '|dig:D' + (54 + i))],
      right: ['com:SCL!|dig:= D21', 'com:SDA!|dig:= D20', 'spc:AREF!', 'gnd:GND', ...[13, 12, 11, 10, 9, 8].map((i) => 'dig:D' + i + '|pwm:~' + (i === 13 ? '980' : '490') + 'Hz' + (i === 13 ? '|spc:LED' : '')), null,
        ...[7, 6, 5, 4, 3, 2].map((i) => 'dig:D' + i + '|pwm:~' + (i === 4 ? '980' : '490') + 'Hz'), 'dig:D1|com:TX0!', 'dig:D0|com:RX0!', null,
        'dig:D14|com:TX3!', 'dig:D15|com:RX3!', 'dig:D16|com:TX2!', 'dig:D17|com:RX2!', 'dig:D18|com:TX1!', 'dig:D19|com:RX1!', 'dig:D20|com:SDA', 'dig:D21|com:SCL', null,
        'pwr:5V', ...Array.from({ length: 16 }, (_, k) => 'dig:D' + (22 + 2 * k) + ' / D' + (23 + 2 * k) + ([44, 46].includes(22 + 2 * k) ? '|pwm:~PWM' : 22 + 2 * k === 50 ? '|com:MISO / MOSI!' : 22 + 2 * k === 52 ? '|com:SCK / SS!' : '')), 'gnd:GND'] },
    c51: { dip: 1, title: 'STC89C52RC',
      left: ['quasi:P1.0', 'quasi:P1.1', 'quasi:P1.2', 'quasi:P1.3', 'quasi:P1.4', 'quasi:P1.5', 'quasi:P1.6', 'quasi:P1.7', 'spc:RST|spc:RESET ↑', 'quasi:P3.0|com:RXD!', 'quasi:P3.1|com:TXD!', 'quasi:P3.2|int:INT0!', 'quasi:P3.3|int:INT1!', 'quasi:P3.4|int:T0!', 'quasi:P3.5|int:T1!', 'quasi:P3.6|spc:WR!', 'quasi:P3.7|spc:RD!', 'spc:XTAL2!', 'spc:XTAL1!', 'gnd:GND'],
      right: ['pwr:VCC|pwr:5V', 'od:P0.0|dig:OD', 'od:P0.1', 'od:P0.2', 'od:P0.3', 'od:P0.4', 'od:P0.5', 'od:P0.6', 'od:P0.7', 'spc:EA|pwr:→ VCC', 'spc:ALE!', 'spc:PSEN!', 'quasi:P2.7', 'quasi:P2.6', 'quasi:P2.5', 'quasi:P2.4', 'quasi:P2.3', 'quasi:P2.2', 'quasi:P2.1', 'quasi:P2.0'] },
  };
  const parseChips = (s) => s.split('|').map((t) => { const i = t.indexOf(':'), cat0 = t.slice(0, i); let txt = t.slice(i + 1), sim = 1; if (txt.endsWith('!')) { sim = 0; txt = txt.slice(0, -1); } return [txt, cat0 === 'quasi' || cat0 === 'od' ? 'dig' : cat0, sim]; });
  function svgBoard(b) {
    const M = BMAP[b], pitch = 23, top = 54, rows = Math.max(M.left.length, M.right.length) + (M.inner ? 2 : 0);
    const W = 760, bx0 = 300, bx1 = 460, H = top + rows * pitch + 46;
    let s = '<svg xmlns="http://www.w3.org/2000/svg" class="pm-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="10.5" font-weight="600">';
    s += '<rect width="' + W + '" height="' + H + '" fill="#fbfdff"/>';
    const by0 = 24, by1 = top + (Math.max(M.left.length, M.right.length) - 1) * pitch + 22, cx = (bx0 + bx1) / 2;
    if (M.dip) {
      s += '<rect x="' + bx0 + '" y="' + by0 + '" width="' + (bx1 - bx0) + '" height="' + (by1 - by0) + '" rx="6" fill="#262626"/><path d="M' + (cx - 14) + ' ' + by0 + ' a14 14 0 0 0 28 0" fill="#fbfdff"/>';
    } else {
      s += '<rect x="' + bx0 + '" y="' + by0 + '" width="' + (bx1 - bx0) + '" height="' + (by1 - by0) + '" rx="10" fill="' + M.col + '" stroke="#333" stroke-width="1.5"/>';
      if (M.usb !== undefined) s += '<rect x="' + (cx - 20) + '" y="' + (M.usb ? by0 - 12 : by1 - 18) + '" width="40" height="30" rx="3" fill="#c9ced6" stroke="#8a929e"/><text x="' + cx + '" y="' + (M.usb ? by0 + 7 : by1 + 2) + '" text-anchor="middle" fill="#333" font-size="9">USB</text>';
    }
    s += '<text x="' + cx + '" y="' + ((by0 + by1) / 2) + '" text-anchor="middle" fill="#fff" font-size="18" font-weight="800" transform="rotate(90 ' + cx + ' ' + ((by0 + by1) / 2) + ')">' + esc(M.title) + '</text>';
    const side = (list, right) => list.forEach((spec, i) => {
      if (!spec) return;
      const y = top + i * pitch, hx = right ? bx1 - 10 : bx0 + 10, ch = parseChips(spec);
      if (M.dip) s += '<rect x="' + (right ? bx1 : bx0 - 12) + '" y="' + (y - 4) + '" width="12" height="8" fill="#c0c4ca"/>';
      else s += '<rect x="' + (hx - 6) + '" y="' + (y - 6) + '" width="12" height="12" fill="#151515"/><rect x="' + (hx - 2.5) + '" y="' + (y - 2.5) + '" width="5" height="5" fill="#d4a017"/>';
      if (M.dip) s += '<text x="' + (right ? bx1 - 6 : bx0 + 6) + '" y="' + (y + 4) + '" text-anchor="' + (right ? 'end' : 'start') + '" fill="#ddd" font-size="9">' + (right ? 40 - i : i + 1) + '</text>';
      s += '<line x1="' + (right ? bx1 : bx0) + '" y1="' + y + '" x2="' + (right ? bx1 + 18 : bx0 - 18) + '" y2="' + y + '" stroke="#9aa5b1" stroke-width="1"/>';
      let x = right ? bx1 + 20 : bx0 - 20;
      for (const [t, cat, sim] of ch) { s += chip(x, y, t, cat, sim, !right); x += (right ? 1 : -1) * (chipW(t) + 4); }
    });
    side(M.left, false); side(M.right, true);
    if (M.inner) { const y = by1 + 34; let x = bx0 - 40; for (const sp of M.inner) for (const [t, cat, sim] of parseChips(sp)) { s += chip(x, y, t, cat, sim, false); x += chipW(t) + 4; } }
    s += '</svg>';
    return s;
  }
  const SVG_EXTRA = {}; for (const b of Object.keys(BMAP)) SVG_EXTRA[b] = () => svgBoard(b);
  return { TAGS, PINS, LIMITS, SIM_NO, SIM_GENERIC, SIMG, SIMB, BMAP, USAGE, WIRE_TOKENS, CAT_COLORS, CATS, BOARDS, SENSORS, SENS_HOW, SENS_TIPS, svg: Object.assign({ arduino: svgUno, attiny85: svgTiny }, SVG_EXTRA) };
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
  const SHORT = { arduino: 'Uno', attiny85: 'ATtiny85', nano: 'Nano', mega: 'Mega 2560', promini: 'Pro Mini', esp32: 'ESP32', pico: 'Pico', bluepill: 'Blue Pill', c51: '8051' };   // board switch buttons (full name in the tooltip)
  const wiringText = (line) => line.replace(/\{c:(\w+)\}/g, (m, t) => partName(t)).replace(/\{w:(\w+)\}/g, (m, w) => _t('help.w.' + w));
  const simState = (row) => {
    if (row.absent) return ['absent', '—'];
    const s = row.tags.map((t) => D.TAGS[t][1]);
    return s.every(Boolean) ? ['yes', '✓'] : s.some(Boolean) ? ['part', '◐'] : ['no', '✗'];
  };
  const EXS = (id) => (typeof MCU_EX !== 'undefined' && MCU_EX[id]) || (typeof SENSOR_EX !== 'undefined' && SENSOR_EX[id]) || (typeof BOARD_EX !== 'undefined' && BOARD_EX[id]) || null;
  const exName = (id) => { const e = EXAMPLES.find((x) => x.id === id); return e ? e.name : id; };

  function html() {
    const b = S.board, other = b === 'arduino' ? 'attiny85' : 'arduino';
    const BEX = typeof BOARD_EX !== 'undefined' ? BOARD_EX : {};
    let h = '<div class="mw-h pw-h"><span class="mw-title">📌 ' + esc(_t('help.title')) + '</span>' +
      '<span class="pw-boards">' + D.BOARDS.map((x) => '<button class="pw-board' + (x === b ? ' on' : '') + '" data-b="' + x + '" title="' + esc(boardName(x)) + '">' + esc(SHORT[x] || boardName(x)) + '</button>').join('') + '</span>' +
      '<button class="mw-x pw-x" title="' + esc(_t('mcu.close')) + '">✕</button></div>';
    h += '<div class="pw-nav">' + ['pinout', 'table', 'limits', 'sim', 'usage', 'sensors', 'examples'].map((k) => '<a href="#" data-go="pw-' + k + '">' + esc(_t('help.nav.' + k)) + '</a>').join('') + '</div>';
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
    if (D.SIMB[b]) { for (const i of (D.SIMG[b] || D.SIM_GENERIC)) h += '<li>✗ ' + fmt(_t('help.sim.no.' + i)) + '</li>'; for (let i = 1; i <= D.SIMB[b]; i++) h += '<li>✗ ' + fmt(_t('help.simb.' + b + '.' + i)) + '</li>'; }
    else for (let i = 1; i <= D.SIM_NO; i++) h += '<li>✗ ' + fmt(_t('help.sim.no.' + i)) + '</li>';
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
    // sensors: how to read each sensor part, tips, and the sensor example programs (all for the Arduino Uno)
    h += '<h3 id="pw-sensors">' + esc(_t('help.nav.sensors')) + '</h3><p class="pw-intro">' + fmt(_t('help.s.intro')) + '</p>';
    h += '<table class="pw-stab"><thead><tr><th>' + esc(_t('help.s.th.part')) + '</th><th>' + esc(_t('help.s.th.pins')) + '</th><th>' + esc(_t('help.s.th.read')) + '</th></tr></thead><tbody>';
    for (const [t, how] of D.SENSORS) {
      if (!DEFS[t]) continue;
      h += '<tr><td><b>' + esc(partName(t)) + '</b></td><td class="pw-spins">' + esc((DEFS[t].termNames || []).join(' · ')) + '</td><td>' + fmt(_t('help.s.how.' + how)) + '</td></tr>';
    }
    h += '</tbody></table><ul class="pw-ul">';
    for (let i = 1; i <= D.SENS_TIPS; i++) h += '<li>' + fmt(_t('help.s.tip.' + i)) + '</li>';
    h += '</ul>';
    if (typeof SENSOR_EX !== 'undefined') {
      h += '<div class="pw-toc">' + Object.keys(SENSOR_EX).map((id) => '<a href="#" data-go="pw-s-' + id + '">' + esc(exName(id)) + '</a>').join('') + '</div>';
      for (const id of Object.keys(SENSOR_EX)) {
        const E = SENSOR_EX[id];
        h += '<section class="pw-sx" id="pw-s-' + id + '" data-id="' + id + '"><h4>' + esc(exName(id)) + '</h4><p>' + fmt(_t('exd.' + id)) + '</p>';
        h += '<div class="pw-sub">' + esc(_t('help.ex.wiring')) + '</div><ul class="pw-swire">' + E.wiring.map((w) => '<li>' + esc(wiringText(w)) + '</li>').join('') + '</ul>';
        h += '<div class="pw-sub">' + esc(_t('help.ex.code')) + '</div><pre class="pw-code pw-scode">' + esc(E.code) + '</pre>';
        h += '<div class="pw-btns"><button class="primary pw-sload" data-id="' + id + '">▶ ' + esc(_t('help.ex.load')) + '</button><button class="pw-sinsert" data-id="' + id + '">✎ ' + esc(_t('help.ex.insert')) + '</button><button class="pw-scopy" data-id="' + id + '">📋 ' + esc(_t('help.ex.copy')) + '</button></div></section>';
      }
    }
    // examples
    h += '<h3 id="pw-examples">' + esc(_t('help.nav.examples')) + '</h3><p class="pw-intro">' + fmt(_t('help.ex.intro')) + '</p>';
    const mine = Object.keys(MCU_EX).filter((id) => MCU_EX[id].board === b).concat(Object.keys(BEX).filter((id) => BEX[id].board === b)), others = Object.keys(MCU_EX).filter((id) => MCU_EX[id].board === other);
    for (const id of mine) {
      const E = MCU_EX[id] || BEX[id];
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
    if (t.classList.contains('pw-ex') || t.classList.contains('pw-sx')) { t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); }
  }
  function bind() {
    const el = S.el;
    el.querySelector('.pw-x').onclick = close;
    el.querySelectorAll('[data-b]').forEach((x) => x.onclick = (e) => { e.preventDefault(); S.board = x.dataset.b; render(); });
    el.querySelectorAll('[data-go]').forEach((a) => a.onclick = (e) => { e.preventDefault(); scrollTo(a.dataset.go); });
    el.querySelectorAll('[data-ex]').forEach((a) => a.onclick = (e) => {
      e.preventDefault(); const id = a.dataset.ex;
      const E = MCU_EX[id] || (typeof BOARD_EX !== 'undefined' && BOARD_EX[id]);
      if (!E) { scrollTo('pw-s-' + id); return; }
      if (E.board !== S.board) { S.board = E.board; render(); } scrollTo('pw-ex-' + id);
    });
    el.querySelectorAll('.pw-sload').forEach((x) => x.onclick = () => loadExample(x.dataset.id));
    el.querySelectorAll('.pw-sinsert').forEach((x) => x.onclick = () => insertExample(x.dataset.id));
    el.querySelectorAll('.pw-scopy').forEach((x) => x.onclick = () => copyExample(x.dataset.id));
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
    const E = EXS(id), board = E.board || 'arduino'; const c = targetChip(board);
    if (!c) { app.toast(_t('help.toast.no_chip')); return false; }
    MCU.openEditor(c);
    const W = MCU.W, ta = W.el.querySelector('.mw-code'), lang = W.el.querySelector('.mw-lang');
    ta.value = E.code; if (lang) lang.value = 'ino';
    ta.dispatchEvent(new Event('input')); ta.scrollTop = 0; ta.setSelectionRange(0, 0);
    app.toast(c.type !== board ? _t('help.toast.mismatch', { board: boardName(board) }) : _t('help.toast.inserted', { chip: DEFS[c.type].name }));
    return true;
  }
  function copyExample(id) {
    const text = EXS(id).code;
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
