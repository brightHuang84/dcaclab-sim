'use strict';
// ===== v12: example programs + circuits for the additional boards (Nano, Mega 2560, Pro Mini, ESP32, Pico, Blue Pill, 8051) =====
// Same structure as MCU_EX (board, usage sections, language-neutral wiring lines, ASCII program); kept separate so the
// Uno / ATtiny85 example lists stay unchanged.  The circuits are appended to EXAMPLES (examples menu) and listed per board in
// the pinout panel.
const BOARD_EX = (() => {
  const L = (a) => a.join('\n');
  const blinkOf = (t) => DEFS[t].props.find((p) => p.k === 'code').def;
  const C51_DELAY = ['void delay_ms(unsigned int ms) {      // about 1 ms per outer pass at 11.0592 MHz', '  unsigned int i, j;', '  for (i = ms; i > 0; i--)', '    for (j = 114; j > 0; j--);', '}'];
  return {
    nanoblink: { board: 'nano', usage: ['dout'], wiring: ['D13 (LED_BUILTIN) → {w:onboard_led}'], get code() { return blinkOf('nano'); } },
    nanoana: {
      board: 'nano', usage: ['ain', 'pwm', 'serial'],
      wiring: ['{c:pot}: {w:pot_ends} → 5V / GND, {w:wiper} → A7', 'D9 → 220 Ω {c:resistor} → {c:led} → GND'],
      code: L([
        '// Arduino Nano: a potentiometer on A7 (an analog-only pin) sets the brightness of an LED on D9 (PWM).',
        'const int LED_PIN = 9;',
        '',
        'void setup() {',
        '  Serial.begin(9600);',
        '  pinMode(LED_PIN, OUTPUT);',
        '}',
        '',
        'void loop() {',
        '  int raw = analogRead(A7);          // 0 ... 1023 (A6 / A7 cannot be digital pins)',
        '  analogWrite(LED_PIN, raw / 4);     // 0 ... 255',
        '  Serial.print("A7 = ");',
        '  Serial.println(raw);',
        '  delay(100);',
        '}', '']),
    },
    megablink: { board: 'mega', usage: ['dout'], wiring: ['D13 (LED_BUILTIN) → {w:onboard_led}'], get code() { return blinkOf('mega'); } },
    megabar: {
      board: 'mega', usage: ['ain', 'dout', 'serial'],
      wiring: ['{c:pot}: {w:pot_ends} → 5V / GND, {w:wiper} → A15', 'D23, D25, D27 … D37 → 220 Ω {c:resistor} → {c:ledbar} {w:anode}', '{c:ledbar} {w:all_cathodes} → GND'],
      code: L([
        '// Arduino Mega 2560: a potentiometer on A15 drives an 8-segment LED bar graph',
        '// on D37, D35 ... D23 (odd pins of the double header, each through 220 ohm): the bar grows from the green end.',
        'const int LEDS[8] = {37, 35, 33, 31, 29, 27, 25, 23};',
        '',
        'void setup() {',
        '  Serial.begin(9600);',
        '  for (int i = 0; i < 8; i++) pinMode(LEDS[i], OUTPUT);',
        '}',
        '',
        'void loop() {',
        '  int raw = analogRead(A15);                 // 16 analog inputs A0 ... A15',
        '  int n = map(raw, 0, 1023, 0, 8);           // number of lit segments',
        '  for (int i = 0; i < 8; i++) digitalWrite(LEDS[i], i < n ? HIGH : LOW);',
        '  Serial.print("A15 = ");',
        '  Serial.print(raw);',
        '  Serial.print("  segments = ");',
        '  Serial.println(n);',
        '  delay(100);',
        '}', '']),
    },
    pmblink: { board: 'promini', usage: ['dout'], wiring: ['{c:battery} 9 V: + → RAW, − → GND', 'D13 (LED_BUILTIN) → {w:onboard_led}'], get code() { return blinkOf('promini'); } },
    pmbatt: {
      board: 'promini', usage: ['ain', 'power', 'serial'],
      wiring: ['{c:li18650} 3.7 V: + → RAW, − → GND', 'RAW → 100 kΩ {c:resistor} → A0 → 100 kΩ {c:resistor} → GND', 'D13 (LED_BUILTIN) → {w:onboard_led}'],
      code: L([
        '// Pro Mini 3.3 V / 8 MHz on a 3.7 V Li-ion cell (RAW -> on-board 3.3 V regulator).',
        '// A0 measures the cell through a 100k / 100k divider; the LED on D13 blinks fast when the cell is low.',
        'void setup() {',
        '  Serial.begin(9600);',
        '  pinMode(LED_BUILTIN, OUTPUT);',
        '}',
        '',
        'void loop() {',
        '  float vbat = analogRead(A0) * 3.3 / 1023.0 * 2;   // reference = VCC = 3.3 V, divider halves the cell voltage',
        '  Serial.print("battery: ");',
        '  Serial.print(vbat, 2);',
        '  Serial.println(" V");',
        '  int ms = vbat < 3.5 ? 200 : 1000;',
        '  digitalWrite(LED_BUILTIN, HIGH);',
        '  delay(ms / 2);',
        '  digitalWrite(LED_BUILTIN, LOW);',
        '  delay(ms / 2);',
        '}', '']),
    },
    espblink: { board: 'esp32', usage: ['dout'], wiring: ['GPIO2 (LED_BUILTIN) → {w:onboard_led}'], get code() { return blinkOf('esp32'); } },
    espdac: {
      board: 'esp32', usage: ['ain', 'pwm', 'serial'],
      wiring: ['GPIO25 (DAC1) → GPIO34 (ADC1)', 'GPIO18 → 220 Ω {c:resistor} → {c:led} → GND', 'T0 = GPIO4', 'GPIO2 (LED_BUILTIN) → {w:onboard_led}'],
      code: L([
        '// ESP32: the DAC on GPIO25 makes a slow triangle wave, GPIO34 (ADC1, 12 bit) reads it back,',
        '// GPIO18 fades an LED with PWM, and touch pad T0 (GPIO4) switches the blue LED on GPIO2.',
        '// To "touch" T0: select the board and choose T0 as the touched pin in its properties.',
        'const int DAC_PIN = 25;',
        'const int ADC_PIN = 34;',
        'const int LED_PIN = 18;',
        'int level = 0;',
        'int step = 5;',
        '',
        'void setup() {',
        '  Serial.begin(115200);',
        '  pinMode(LED_BUILTIN, OUTPUT);',
        '  analogReadResolution(12);',
        '}',
        '',
        'void loop() {',
        '  dacWrite(DAC_PIN, level);              // 0 ... 255 -> 0 ... 3.3 V',
        '  analogWrite(LED_PIN, level);           // same value as PWM duty',
        '  delay(1);                              // let the DAC output settle before sampling it',
        '  int raw = analogRead(ADC_PIN);         // 0 ... 4095',
        '  int mv = analogReadMilliVolts(ADC_PIN);',
        '  bool touched = touchRead(T0) < 40;     // the value drops when a finger is on the pad',
        '  digitalWrite(LED_BUILTIN, touched ? HIGH : LOW);',
        '  Serial.print("DAC=");',
        '  Serial.print(level);',
        '  Serial.print(" ADC=");',
        '  Serial.print(raw);',
        '  Serial.print(" mV=");',
        '  Serial.print(mv);',
        '  Serial.print(" touch=");',
        '  Serial.println(touched ? "yes" : "no");',
        '  level += step;',
        '  if (level >= 255 || level <= 0) step = -step;',
        '  delay(50);',
        '}', '']),
    },
    picoblink: { board: 'pico', usage: ['dout'], wiring: ['GP25 (LED_BUILTIN) → {w:onboard_led}'], get code() { return blinkOf('pico'); } },
    picoadc: {
      board: 'pico', usage: ['ain', 'pwm', 'serial'],
      wiring: ['{c:pot}: {w:pot_ends} → 3V3 / AGND, {w:wiper} → GP26 (ADC0)', 'GP15 → 220 Ω {c:resistor} → {c:led} → GND'],
      code: L([
        '// Raspberry Pi Pico: a potentiometer on GP26 (ADC0) sets the brightness of an LED on GP15 (PWM).',
        '// The ADC is read with 12 bits; A3 (GP29) measures VSYS / 3 on the board.',
        'const int POT_PIN = A0;      // GP26',
        'const int LED_PIN = 15;      // GP15',
        '',
        'void setup() {',
        '  Serial.begin(115200);',
        '  analogReadResolution(12);  // 0 ... 4095',
        '  analogWriteRange(4095);    // PWM duty 0 ... 4095 as well',
        '  pinMode(LED_BUILTIN, OUTPUT);',
        '}',
        '',
        'void loop() {',
        '  int raw = analogRead(POT_PIN);',
        '  analogWrite(LED_PIN, raw);',
        '  float vsys = analogRead(A3) * 3.3 * 3 / 4095.0;',
        '  digitalWrite(LED_BUILTIN, raw > 2048 ? HIGH : LOW);',
        '  Serial.print("ADC0=");',
        '  Serial.print(raw);',
        '  Serial.print("  VSYS=");',
        '  Serial.print(vsys, 2);',
        '  Serial.println(" V");',
        '  delay(100);',
        '}', '']),
    },
    bpblink: { board: 'bluepill', usage: ['dout'], wiring: ['PC13 (LED_BUILTIN) → {w:onboard_led}'], get code() { return blinkOf('bluepill'); } },
    bpadc: {
      board: 'bluepill', usage: ['ain', 'pwm', 'serial'],
      wiring: ['{c:pot}: {w:pot_ends} → 3.3 / G, {w:wiper} → PA0', 'PA8 → 220 Ω {c:resistor} → {c:led} → G', 'PC13 → {w:onboard_led}'],
      code: L([
        '// STM32 Blue Pill: potentiometer on PA0 read with the 12-bit ADC, LED on PA8 dimmed by PWM,',
        '// on-board LED on PC13 (active LOW) lights above half scale.',
        'void setup() {',
        '  Serial.begin(115200);',
        '  analogReadResolution(12);',
        '  pinMode(PC13, OUTPUT);',
        '  pinMode(PA8, OUTPUT);',
        '}',
        '',
        'void loop() {',
        '  int raw = analogRead(PA0);             // 0 ... 4095',
        '  analogWrite(PA8, raw / 16);            // 0 ... 255',
        '  digitalWrite(PC13, raw > 2048 ? LOW : HIGH);',
        '  Serial.print("PA0=");',
        '  Serial.print(raw);',
        '  Serial.print("  ");',
        '  Serial.print(raw * 3.3 / 4095.0, 3);',
        '  Serial.println(" V");',
        '  delay(100);',
        '}', '']),
    },
    c51blink: {
      board: 'c51', usage: ['dout', 'power'],
      wiring: ['{c:battery} 5 V: + → VCC (40), − → GND (20)', 'EA (31) → VCC', 'VCC → 1 kΩ {c:resistor} → {c:led} {w:anode}, {w:cathode} → P1.0 (1)'],
      get code() { return blinkOf('c51'); },
    },
    c51run: {
      board: 'c51', usage: ['dout', 'din'],
      wiring: ['{c:battery} 5 V: + → VCC (40), − → GND (20)', 'EA (31) → VCC', 'VCC → 1 kΩ {c:resistor} ×8 → {c:ledbar} {w:anode}', '{c:ledbar} {w:cathode} → P1.7 … P1.0 (8 … 1)', '{c:button}: P3.2 (12) → GND'],
      code: L([
        '// 8051 running light: 8 LEDs on P1, active LOW (VCC -> 1 kOhm -> LED -> P1.x).',
        '// The button on P3.2 (to GND) reverses the direction. Crystal 11.0592 MHz.',
        '#include <reg52.h>',
        '#include <intrins.h>',
        '',
        'sbit KEY = P3^2;',
        '',
        ...C51_DELAY,
        '',
        'void main() {',
        '  unsigned char pattern = 0xFE;     // one bit LOW = one LED on',
        '  bit left = 1;',
        '  while (1) {',
        '    P1 = pattern;',
        '    delay_ms(150);',
        '    if (KEY == 0) {                 // pressed: reverse the direction',
        '      left = !left;',
        '      while (KEY == 0);             // wait until released',
        '    }',
        '    if (left) pattern = _crol_(pattern, 1);',
        '    else pattern = _cror_(pattern, 1);',
        '  }',
        '}', '']),
    },
  };
})();
if (typeof module !== 'undefined') module.exports = BOARD_EX;

// ---- circuits ----
if (typeof EXAMPLES !== 'undefined') (() => {
  const RED = '#d62828', BLK = '#222222', BLU = '#1d5fd1', GRN = '#2a9d3a', YEL = '#f2b705', ORG = '#f77f00';
  const mk = (id, name, type, props, fn) => ({ id, name, build() {
    const b = EXAMPLES.builder(); const A = b.add(type, 600, 420, 0, Object.assign({ code: BOARD_EX[id].code }, props || {})); if (fn) fn(b, A); return b.done();
  } });
  const T = (type, name) => DEFS[type].termNames.indexOf(name);
  const P = (b, pts, col) => b.path(pts, col);
  // pin (on the top row) → resistor (vertical, above) → LED (vertical) → cathode back to `gnd` (x, y of a GND pin on the top row)
  const ledUp = (b, A, pin, x, gx, col) => {
    const R = b.add('resistor', x, 300, 1, { R: 220 }), Ld = b.add('led', x, 200, 3, { color: col || 'red' });
    P(b, [[A, pin], [R, 1]], ORG); P(b, [[R, 0], [Ld, 0]], ORG); P(b, [[Ld, 1], [x, 140], [gx, 140], [A, T(A.type, 'GND')]], BLK);
  };
  // pin (on the bottom row) → resistor (vertical, below) → LED (vertical) → GND pin (bottom row, at x = gx)
  const ledDown = (b, A, pin, x, gx, gpin, col) => {
    const R = b.add('resistor', x, 540, 1, { R: 220 }), Ld = b.add('led', x, 640, 1, { color: col || 'red' });
    P(b, [[A, pin], [R, 0]], ORG); P(b, [[R, 1], [Ld, 0]], ORG); P(b, [[Ld, 1], [x, 700], [gx, 700], [A, gpin]], BLK);
  };
  const c51supply = (b, A) => {   // 5 V battery: + → VCC (and EA), − → GND
    const B = b.add('battery', 260, 220, 0, { V: 5 });
    P(b, [[B, 1], [340, 220]], RED); P(b, [[340, 220], [410, 220], [410, 340]], RED); P(b, [[410, 340], [A, 39]], RED);
    P(b, [[A, 30], [590, 340], [410, 340]], RED);
    P(b, [[B, 0], [200, 180], [840, 180], [840, 500], [790, 500]], BLK); P(b, [[790, 500], [A, 19]], BLK);
  };
  const list = [
    mk('nanoblink', '单片机：Arduino Nano 闪烁 LED (Blink)', 'nano'),
    mk('nanoana', '单片机：Nano 电位器调 LED 亮度 (A7 → D9)', 'nano', {}, (b, A) => {
      const Pt = b.add('pot', 400, 560, 1, { R: 10000, pos: 0.6 });
      P(b, [[Pt, 2], [540, 560], [A, T('nano', 'A7 ADC')]], BLU);
      P(b, [[Pt, 0], [400, 500], [480, 500], [A, 26]], BLK);
      P(b, [[Pt, 1], [400, 620], [520, 620], [A, 22]], RED);
      ledUp(b, A, 9, 680, 520, 'green');
    }),
    mk('megablink', '单片机：Arduino Mega 2560 闪烁 LED (Blink)', 'mega'),
    mk('megabar', '单片机：Mega 2560 电位器 → 8 段 LED 光柱', 'mega', {}, (b, A) => {
      const Pt = b.add('pot', 840, 700, 0, { R: 10000, pos: 0.55 });
      P(b, [[Pt, 2], [A, T('mega', 'A15')]], BLU);
      P(b, [[Pt, 0], [800, 740], [440, 740], [A, 74]], BLK);
      P(b, [[Pt, 1], [880, 760], [420, 760], [A, 70]], RED);
      const Bar = b.add('ledbar', 1150, 370, 3, { color: 'mixed' });   // rot 3: anodes on the left (x = 1110), cathodes right (x = 1190)
      for (let i = 0; i < 8; i++) {
        const p = 23 + 2 * i, y = 290 + 20 * i, seg = 9 - i;           // D23 … D37: right column of the double header, pitch 20
        if (i % 2 === 0) { const R = b.add('resistor', 940, y, 0, { R: 220 }); P(b, [[A, p], [R, 0]], ORG); P(b, [[R, 1], [Bar, seg]], ORG); }
        else { const R = b.add('resistor', 1020, y, 0, { R: 220 }); P(b, [[A, p], [R, 0]], ORG); P(b, [[R, 1], [Bar, seg]], ORG); }
        P(b, [[Bar, 10 + seg], [1210, y]], BLK);
        if (i) P(b, [[1210, y - 20], [1210, y]], BLK);
      }
      P(b, [[1210, 430], [1210, 650], [880, 650], [A, 77]], BLK);
    }),
    mk('pmblink', '单片机：Arduino Pro Mini 闪烁 LED (Blink)', 'promini', { power: 'ext' }, (b, A) => {
      const B = b.add('battery', 420, 560, 0, { V: 9 });
      P(b, [[B, 1], [490, 560], [A, 23]], RED); P(b, [[B, 0], [360, 600], [510, 600], [A, 25]], BLK);
    }),
    mk('pmbatt', '单片机：Pro Mini 3.3V 锂电池电压监测', 'promini', { variant: '3v8', power: 'ext' }, (b, A) => {
      const B = b.add('li18650', 420, 560, 0, {});
      P(b, [[B, 1], [490, 560]], RED); P(b, [[490, 560], [A, 23]], RED); P(b, [[B, 0], [360, 600], [510, 600]], BLK); P(b, [[510, 600], [A, 25]], BLK);
      const Ra = b.add('resistor', 630, 540, 1, { R: 100000 }), Rb = b.add('resistor', 700, 500, 0, { R: 100000 });
      P(b, [[A, T('promini', 'A0')], [Ra, 0]], BLU); P(b, [[Rb, 0], [Ra, 0]], BLU);
      P(b, [[Ra, 1], [630, 600], [510, 600]], BLK);
      P(b, [[Rb, 1], [740, 660], [490, 660], [490, 560]], RED);
    }),
    mk('espblink', '单片机：ESP32 闪烁 LED (Blink)', 'esp32'),
    mk('espdac', '单片机：ESP32 DAC 三角波 + ADC 回读 + 触摸', 'esp32', { touch: String(MCU.BOARDS.esp32.pinOf(4)) }, (b, A) => {
      const t = (n) => T('esp32', n);
      P(b, [[A, t('GPIO25 ADC2 DAC1')], [600, 330], [520, 330], [A, t('GPIO34 ADC1 IN')]], YEL);
      ledDown(b, A, t('GPIO18'), 580, 720, 28, 'red');
    }),
    mk('picoblink', '单片机：树莓派 Pico 闪烁 LED (Blink)', 'pico'),
    mk('picoadc', '单片机：Pico 电位器 (12 位 ADC) → PWM 调光', 'pico', {}, (b, A) => {
      const t = (n) => T('pico', n);
      const Pt = b.add('pot', 590, 300, 2, { R: 10000, pos: 0.7 });
      P(b, [[Pt, 2], [A, t('GP26 ADC0')]], BLU);
      P(b, [[Pt, 0], [630, 280], [490, 280], [A, t('3V3 OUT')]], RED);
      P(b, [[Pt, 1], [A, t('AGND')]], BLK);
      ledDown(b, A, t('GP15'), 790, 750, t('GND') + 3, 'green');
    }),
    mk('bpblink', '单片机：STM32 Blue Pill 闪烁 LED (PC13)', 'bluepill'),
    mk('bpadc', '单片机：Blue Pill 12 位 ADC + PWM 调光', 'bluepill', {}, (b, A) => {
      const t = (n) => T('bluepill', n);
      const Pt = b.add('pot', 710, 560, 0, { R: 10000, pos: 0.35 });
      P(b, [[Pt, 2], [A, t('PA0 ADC ~PWM')]], BLU);
      P(b, [[Pt, 0], [670, 600], [450, 600], [A, 33]], RED);
      P(b, [[Pt, 1], [750, 640], [430, 640], [A, 37]], BLK);
      const R = b.add('resistor', 490, 300, 1, { R: 220 }), Ld = b.add('led', 490, 200, 3, { color: 'yellow' });
      P(b, [[A, t('PA8 ~PWM')], [R, 1]], ORG); P(b, [[R, 0], [Ld, 0]], ORG); P(b, [[Ld, 1], [490, 140], [770, 140], [A, 36]], BLK);
    }),
    mk('c51blink', '单片机：8051 闪烁 LED (P1.0)', 'c51', {}, (b, A) => {
      c51supply(b, A);
      const Ld = b.add('led', 410, 520, 3, { color: 'red' }), R = b.add('resistor', 410, 620, 1, { R: 1000 });
      P(b, [[Ld, 1], [A, 0]], ORG); P(b, [[Ld, 0], [R, 0]], ORG); P(b, [[R, 1], [410, 680], [340, 680], [340, 220]], RED);
    }),
    mk('c51run', '单片机：8051 流水灯 (P1 口 + 按键换向)', 'c51', {}, (b, A) => {
      c51supply(b, A);
      const Bar = b.add('ledbar', 450, 560, 2, { color: 'red' });   // rot 2: cathodes on top (y = 520), anodes below (y = 600)
      for (let i = 0; i < 8; i++) {
        const x = 550 - 20 * i, k = 7 - i;           // segment i ↔ P1.(7-i)
        P(b, [[Bar, 10 + i], [A, k]], ORG);
        const y = i % 2 ? 760 : 660, R = b.add('resistor', x, y, 1, { R: 1000 });
        P(b, [[Bar, i], [R, 0]], ORG); P(b, [[R, 1], [x, 840]], RED);
      }
      for (let i = 0; i < 7; i++) P(b, [[550 - 20 * i, 840], [530 - 20 * i, 840]], RED);
      P(b, [[410, 840], [340, 840], [340, 220]], RED);
      const K = b.add('button', 690, 560, 0, {});
      P(b, [[A, 11], [630, 560], [K, 0]], GRN); P(b, [[K, 1], [790, 560], [790, 500]], BLK);
    }),
  ];
  EXAMPLES.push(...list);
})();
