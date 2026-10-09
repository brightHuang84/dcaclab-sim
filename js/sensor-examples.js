'use strict';
// ===== v11: sensor example circuits (programs, wiring notes, circuit builders) =====
// Programs are plain ASCII; wiring lines are language-neutral ({c:<type>} = localised part name).
// The circuits are appended to EXAMPLES (examples menu) and listed in the "Sensors" section of the pinout panel.
const SENSOR_EX = (() => {
  const L = (a) => a.join('\n');
  return {
    snsultra: {
      parts: ['hcsr04', 'lcd1602'],
      wiring: ['{c:hcsr04}: VCC → 5V, GND → GND, Trig → D7, Echo → D6', '{c:lcd1602}: RS → D3, RW → D4, E → D5, D4…D7 → D9…D12, A → D13, K / VSS → GND, VDD → 5V, V0 → 100 kΩ → VDD'],
      code: L([
        '// Ultrasonic distance meter: HC-SR04 (Trig = D7, Echo = D6) shown on an LCD1602.',
        '// Echo pulse width in microseconds / 58 = distance in cm (sound: about 0.0343 cm/us, there and back).',
        '#include <LiquidCrystal.h>',
        '',
        'LiquidCrystal lcd(3, 4, 5, 9, 10, 11, 12);   // RS, RW, E, D4..D7',
        'const int TRIG = 7;',
        'const int ECHO = 6;',
        '',
        'void setup() {',
        '  pinMode(13, OUTPUT);',
        '  digitalWrite(13, HIGH);        // backlight',
        '  pinMode(TRIG, OUTPUT);',
        '  pinMode(ECHO, INPUT);',
        '  lcd.begin(16, 2);',
        '  lcd.print("HC-SR04 distance");',
        '  Serial.begin(9600);',
        '}',
        '',
        'void loop() {',
        '  digitalWrite(TRIG, LOW);',
        '  delayMicroseconds(2);',
        '  digitalWrite(TRIG, HIGH);      // trigger pulse of 10 us',
        '  delayMicroseconds(10);',
        '  digitalWrite(TRIG, LOW);',
        '  unsigned long us = pulseIn(ECHO, HIGH, 30000);   // 0 = no echo within 30 ms',
        '  lcd.setCursor(0, 1);',
        '  if (us == 0) {',
        '    lcd.print("out of range    ");',
        '  } else {',
        '    float cm = us / 58.0;',
        '    lcd.print(cm, 1);',
        '    lcd.print(" cm          ");',
        '  }',
        '  Serial.println(us);',
        '  delay(100);',
        '}',
        '',
      ]),
    },
    sndht: {
      parts: ['dht'],
      wiring: ['{c:dht}: VCC → 5V, DATA → D2, GND → GND'],
      code: L([
        '// DHT22 temperature and humidity -> serial monitor every 2 s (DHT library).',
        '#include <DHT.h>',
        '',
        'DHT dht(2, DHT22);            // DATA on pin 2',
        '',
        'void setup() {',
        '  Serial.begin(9600);',
        '  dht.begin();',
        '}',
        '',
        'void loop() {',
        '  delay(2000);                // the sensor needs 2 s between readings',
        '  float h = dht.readHumidity();',
        '  float t = dht.readTemperature();',
        '  if (isnan(h) || isnan(t)) {',
        '    Serial.println("DHT read failed - check the wiring");',
        '    return;',
        '  }',
        '  Serial.print("T = ");',
        '  Serial.print(t, 1);',
        '  Serial.print(" C   RH = ");',
        '  Serial.print(h, 1);',
        '  Serial.print(" %   heat index = ");',
        '  Serial.print(dht.computeHeatIndex(t, h, false), 1);',
        '  Serial.println(" C");',
        '}',
        '',
      ]),
    },
    snpir: {
      parts: ['pir', 'ldrmod'],
      wiring: ['{c:pir}: VCC → 5V, OUT → D2, GND → GND', '{c:ldrmod}: AO → A0, VCC → 5V, GND → GND', 'D9 → 220 Ω → LED → GND'],
      code: L([
        '// PIR night light: the LED on pin 9 stays on for 10 s after motion, but only when it is dark.',
        'const int PIR = 2;',
        'const int LED = 9;',
        'const int DARK = 600;          // AO of the light-sensor module rises in the dark',
        'unsigned long onUntil = 0;',
        '',
        'void setup() {',
        '  pinMode(PIR, INPUT);',
        '  pinMode(LED, OUTPUT);',
        '  Serial.begin(9600);',
        '}',
        '',
        'void loop() {',
        '  int light = analogRead(A0);',
        '  if (digitalRead(PIR) == HIGH && light > DARK) {',
        '    if (millis() >= onUntil) Serial.println("motion in the dark: light on");',
        '    onUntil = millis() + 10000;',
        '  }',
        '  digitalWrite(LED, millis() < onUntil ? HIGH : LOW);',
        '  delay(20);',
        '}',
        '',
      ]),
    },
    snsoil: {
      parts: ['soil', 'abuzzer'],
      wiring: ['{c:soil}: AO → A0, VCC → 5V, GND → GND', '{c:abuzzer}: + → D8, − → GND'],
      code: L([
        '// Soil moisture alarm: beeps while the soil is too dry (AO is high when the soil is dry).',
        'const int BUZZER = 8;',
        'const int DRY = 700;',
        '',
        'void setup() {',
        '  pinMode(BUZZER, OUTPUT);',
        '  Serial.begin(9600);',
        '}',
        '',
        'void loop() {',
        '  int v = analogRead(A0);',
        '  Serial.print("soil AO = ");',
        '  Serial.println(v);',
        '  if (v > DRY) {',
        '    digitalWrite(BUZZER, HIGH);',
        '    delay(200);',
        '    digitalWrite(BUZZER, LOW);',
        '    delay(300);',
        '  } else {',
        '    digitalWrite(BUZZER, LOW);',
        '    delay(500);',
        '  }',
        '}',
        '',
      ]),
    },
    sngas: {
      parts: ['mqgas', 'relaymod'],
      wiring: ['{c:mqgas}: AO → A0, DO → D7, VCC → 5V, GND → GND', '{c:relaymod}: IN → D8, VCC → 5V, GND → GND', 'D9 → 220 Ω → LED → GND'],
      code: L([
        '// Gas alarm with an MQ-2 module: AO -> A0 (rises with gas), DO -> 7 (LOW above the module threshold).',
        '// Above the limit the relay on pin 8 (e.g. a fan) and the red LED on pin 9 switch on.',
        'const int RELAY = 8;',
        'const int LED = 9;',
        'const int DO_PIN = 7;',
        'const int LIMIT = 400;',
        '',
        'void setup() {',
        '  pinMode(RELAY, OUTPUT);',
        '  pinMode(LED, OUTPUT);',
        '  pinMode(DO_PIN, INPUT);',
        '  Serial.begin(9600);',
        '}',
        '',
        'void loop() {',
        '  int gas = analogRead(A0);',
        '  bool alarm = gas > LIMIT || digitalRead(DO_PIN) == LOW;',
        '  digitalWrite(RELAY, alarm ? HIGH : LOW);',
        '  digitalWrite(LED, alarm ? HIGH : LOW);',
        '  Serial.print("gas AO = ");',
        '  Serial.print(gas);',
        '  Serial.println(alarm ? "  ALARM" : "");',
        '  delay(250);',
        '}',
        '',
      ]),
    },
    snlm35: {
      parts: ['lm35'],
      wiring: ['{c:lm35}: +Vs → 5V, Vout → A0, GND → GND'],
      code: L([
        '// LM35 thermometer: 10 mV per degree C on A0, read with the 1.1 V internal reference',
        '// (about 0.1 C per step, up to 110 C).',
        'void setup() {',
        '  analogReference(INTERNAL);',
        '  Serial.begin(9600);',
        '}',
        '',
        'void loop() {',
        '  int raw = analogRead(A0);',
        '  float c = raw * 110.0 / 1024.0;',
        '  Serial.print("LM35: ");',
        '  Serial.print(c, 1);',
        '  Serial.println(" C");',
        '  delay(500);',
        '}',
        '',
      ]),
    },
    snline: {
      parts: ['tcrt5000'],
      wiring: ['{c:tcrt5000} (L): DO → D2, VCC → 5V, GND → GND', '{c:tcrt5000} (R): DO → D3, VCC → 5V, GND → GND', 'D9 / D11 → 220 Ω → LED → GND'],
      code: L([
        '// Line follower logic with two TCRT5000 modules: DO is HIGH over the black line.',
        '// The LEDs on 9 (left motor) and 11 (right motor) show what a robot would do.',
        'const int L_SENS = 2;',
        'const int R_SENS = 3;',
        'const int L_MOTOR = 9;',
        'const int R_MOTOR = 11;',
        '',
        'void setup() {',
        '  pinMode(L_SENS, INPUT);',
        '  pinMode(R_SENS, INPUT);',
        '  pinMode(L_MOTOR, OUTPUT);',
        '  pinMode(R_MOTOR, OUTPUT);',
        '  Serial.begin(9600);',
        '}',
        '',
        'void loop() {',
        '  bool l = digitalRead(L_SENS) == HIGH;   // true = this sensor sees the line',
        '  bool r = digitalRead(R_SENS) == HIGH;',
        '  if (l && !r) {            // line on the left: slow the left wheel',
        '    digitalWrite(L_MOTOR, LOW);',
        '    digitalWrite(R_MOTOR, HIGH);',
        '    Serial.println("turn left");',
        '  } else if (r && !l) {',
        '    digitalWrite(L_MOTOR, HIGH);',
        '    digitalWrite(R_MOTOR, LOW);',
        '    Serial.println("turn right");',
        '  } else if (l && r) {      // both on the line: crossing / end mark',
        '    digitalWrite(L_MOTOR, LOW);',
        '    digitalWrite(R_MOTOR, LOW);',
        '    Serial.println("stop");',
        '  } else {',
        '    digitalWrite(L_MOTOR, HIGH);',
        '    digitalWrite(R_MOTOR, HIGH);',
        '    Serial.println("straight");',
        '  }',
        '  delay(200);',
        '}',
        '',
      ]),
    },
    snenc: {
      parts: ['encoder'],
      wiring: ['{c:encoder}: CLK → D2, DT → D3, SW → D4, + → 5V, GND → GND'],
      code: L([
        '// KY-040 rotary encoder: count the detents (CLK = 2, DT = 3); the push button on 4 resets the count.',
        'const int CLK = 2;',
        'const int DT = 3;',
        'const int SW = 4;',
        'int count = 0;',
        'int lastClk;',
        '',
        'void setup() {',
        '  pinMode(CLK, INPUT);',
        '  pinMode(DT, INPUT);',
        '  pinMode(SW, INPUT_PULLUP);     // the module has no pull-up on SW',
        '  Serial.begin(9600);',
        '  lastClk = digitalRead(CLK);',
        '}',
        '',
        'void loop() {',
        '  int clk = digitalRead(CLK);',
        '  if (clk != lastClk && clk == LOW) {   // one detent = one falling edge on CLK',
        '    if (digitalRead(DT) != clk) count++;  // DT still HIGH: clockwise',
        '    else count--;',
        '    Serial.print("count = ");',
        '    Serial.println(count);',
        '  }',
        '  lastClk = clk;',
        '  if (digitalRead(SW) == LOW) {',
        '    count = 0;',
        '    Serial.println("reset");',
        '    delay(300);',
        '  }',
        '  delay(1);',
        '}',
        '',
      ]),
    },
    snacs: {
      parts: ['acs712'],
      wiring: ['{c:acs712}: VCC → 5V, OUT → A0, GND → GND', '{c:battery} 12 V + → IP+, IP− → {c:bulb} → {c:battery} −'],
      code: L([
        '// ACS712-5A current monitor: OUT = 2.5 V + 0.185 V/A x I (5 V supply). Averages 50 readings.',
        'const float SENSITIVITY = 0.185;   // V per A (5 A version)',
        'const float ZERO = 2.5;            // output at 0 A',
        '',
        'void setup() {',
        '  Serial.begin(9600);',
        '}',
        '',
        'void loop() {',
        '  long sum = 0;',
        '  for (int i = 0; i < 50; i++) sum += analogRead(A0);',
        '  float v = sum / 50.0 * 5.0 / 1024.0;',
        '  float amps = (v - ZERO) / SENSITIVITY;',
        '  Serial.print("I = ");',
        '  Serial.print(amps, 2);',
        '  Serial.println(" A");',
        '  delay(500);',
        '}',
        '',
      ]),
    },
    snds18: {
      parts: ['ds18b20'],
      wiring: ['{c:ds18b20}: GND → GND, DQ → D4, VDD → 5V', '4.7 kΩ {c:resistor}: DQ → VDD'],
      code: L([
        '// DS18B20 on pin 4 (4.7 kOhm pull-up to 5 V) with the OneWire + DallasTemperature libraries.',
        '#include <OneWire.h>',
        '#include <DallasTemperature.h>',
        '',
        'OneWire oneWire(4);',
        'DallasTemperature sensors(&oneWire);',
        '',
        'void setup() {',
        '  Serial.begin(9600);',
        '  sensors.begin();',
        '  Serial.print("devices: ");',
        '  Serial.println(sensors.getDeviceCount());',
        '}',
        '',
        'void loop() {',
        '  sensors.requestTemperatures();          // 12 bit: waits 750 ms for the conversion',
        '  float c = sensors.getTempCByIndex(0);',
        '  if (c == DEVICE_DISCONNECTED_C) {',
        '    Serial.println("sensor not found");',
        '  } else {',
        '    Serial.print("T = ");',
        '    Serial.print(c, 2);',
        '    Serial.println(" C");',
        '  }',
        '  delay(250);',
        '}',
        '',
      ]),
    },
    snlcdi2c: {
      parts: ['lcdi2c', 'tmp36'],
      wiring: ['{c:lcdi2c}: GND → GND, VCC → 5V, SDA → A4, SCL → A5', '{c:tmp36}: +Vs → 5V, Vout → A0, GND → GND'],
      code: L([
        '// LCD1602 with an I2C backpack (PCF8574, address 0x27): only 4 wires - GND, VCC, SDA = A4, SCL = A5.',
        '// Shows the TMP36 temperature (A0) and the uptime.',
        '#include <Wire.h>',
        '#include <LiquidCrystal_I2C.h>',
        '',
        'LiquidCrystal_I2C lcd(0x27, 16, 2);',
        '',
        'void setup() {',
        '  Serial.begin(9600);',
        '  Wire.begin();',
        '  Wire.beginTransmission(0x27);           // is anything answering at 0x27?',
        '  if (Wire.endTransmission() != 0) Serial.println("no I2C device at 0x27");',
        '  lcd.init();',
        '  lcd.backlight();',
        '  lcd.print("TMP36 + I2C LCD");',
        '}',
        '',
        'void loop() {',
        '  float v = analogRead(A0) * 5.0 / 1024.0;',
        '  float c = (v - 0.5) * 100.0;           // TMP36: 0.5 V at 0 C, 10 mV per C',
        '  lcd.setCursor(0, 1);',
        '  lcd.print(c, 1);',
        '  lcd.print((char)223);                  // degree sign',
        '  lcd.print("C  ");',
        '  lcd.print(millis() / 1000);',
        '  lcd.print(" s    ");',
        '  delay(500);',
        '}',
        '',
      ]),
    },
  };
})();
if (typeof module !== 'undefined') module.exports = SENSOR_EX;

// ---- circuits (Arduino Uno at 400,380: top pins y = 260, bottom pins y = 500) ----
if (typeof EXAMPLES !== 'undefined') (() => {
  const RED = '#d62828', BLK = '#222222', BLU = '#1d5fd1', GRN = '#2a9d3a', YEL = '#f2b705', ORG = '#f77f00', PUR = '#7b2cbf';
  // 5V / GND "trunks" below the board: chains of short wires so every vertex is a junction other wires can end on
  const trunk = (b, A, pin, x, ys, col) => { let y0 = 500; for (const y of ys) { b.path(y0 === 500 ? [[A, pin], [x, y]] : [[x, y0], [x, y]], col); y0 = y; } };
  const P = (b, pts, col) => b.path(pts, col);
  const mk = (id, name, fn) => ({ id, name, build() { const b = EXAMPLES.builder(); const A = b.add('arduino', 400, 380, 0, { code: SENSOR_EX[id].code }); fn(b, A); return b.done(); } });
  const sig = (o) => Object.assign({ sig: 'const' }, o);
  const ledChain = (b, A, pin, x, col, ry) => {   // pin → 220 Ω (vertical) → LED (vertical) ; returns the LED cathode point
    const R = b.add('resistor', x, ry || 200, 1, { R: 220 }), Ld = b.add('led', x, 100, 3, { color: col });
    P(b, [[R, 1], [A, pin]], ORG); P(b, [[R, 0], [Ld, 0]], ORG);
    return b.tp(Ld, 1);
  };
  const list = [
    mk('snsultra', '传感器：超声波测距 → LCD1602', (b, A) => {
      const Lc = b.add('lcd1602', 410, 100, 2, { line1: '', line2: '' });
      const Rv = b.add('resistor', 620, 240, 0, { R: 100000 });
      for (const [li, pin] of [[3, 3], [4, 4], [5, 5], [10, 9], [11, 10], [12, 11], [13, 12], [14, 13], [15, 23]]) P(b, [[Lc, li], [A, pin]], li === 15 ? BLK : li === 14 ? RED : BLU);
      P(b, [[Lc, 2], [520, 240], [Rv, 0]], ORG);
      P(b, [[Lc, 1], [540, 210], [680, 210]], RED); P(b, [[680, 210], [680, 240]], RED); P(b, [[Rv, 1], [680, 240]], RED);
      trunk(b, A, 20, 320, [540, 580], RED); trunk(b, A, 25, 360, [560, 600], BLK);
      P(b, [[680, 240], [680, 580], [320, 580]], RED);
      P(b, [[Lc, 0], [560, 180], [700, 180], [700, 600], [360, 600]], BLK);
      const S = b.add('hcsr04', 60, 100, 0, sig({ q: 100, sig: 'sine', smin: 15, smax: 250, sper: 12 }));
      P(b, [[S, 1], [50, 230], [420, 230], [A, 7]], GRN); P(b, [[S, 2], [70, 240], [440, 240], [A, 6]], YEL);
      P(b, [[S, 0], [30, 540], [320, 540]], RED); P(b, [[S, 3], [90, 560], [360, 560]], BLK);
    }),
    mk('sndht', '传感器：DHT22 温湿度 → 串口监视器', (b, A) => {
      const S = b.add('dht', 120, 120, 0, { model: 'DHT22', q: 24, q2: 55, sig: 'sine', smin: 18, smax: 32, sper: 20 });
      trunk(b, A, 20, 320, [540], RED); trunk(b, A, 25, 360, [560], BLK);
      P(b, [[S, 1], [120, 220], [520, 220], [A, 2]], YEL);
      P(b, [[S, 0], [100, 540], [320, 540]], RED); P(b, [[S, 2], [140, 560], [360, 560]], BLK);
    }),
    mk('snpir', '传感器：人体感应小夜灯 (PIR + 光敏)', (b, A) => {
      const S = b.add('pir', 120, 120, 0, { q: 0, tx: 5, mode: 'H', sig: 'square', smin: 0, smax: 1, sper: 4 });
      const Ld = b.add('ldrmod', 430, 660, 2, { q: 5, thr: 0.5 });
      trunk(b, A, 20, 320, [540, 580], RED); trunk(b, A, 25, 360, [560, 600], BLK);
      P(b, [[S, 1], [120, 250], [520, 250], [A, 2]], YEL);
      P(b, [[S, 0], [100, 540], [320, 540]], RED); P(b, [[S, 2], [140, 560], [360, 560]], BLK);
      P(b, [[Ld, 3], [400, 540], [420, 540], [A, 14]], BLU);
      P(b, [[Ld, 0], [460, 580], [320, 580]], RED); P(b, [[Ld, 1], [440, 600], [360, 600]], BLK);
      const k = ledChain(b, A, 9, 360, 'white');
      P(b, [k, [260, 60], [A, 23]], BLK);
    }),
    mk('snsoil', '传感器：土壤湿度报警 (蜂鸣器)', (b, A) => {
      const S = b.add('soil', 430, 660, 2, { q: 50, sig: 'tri', smin: 10, smax: 90, sper: 20 });
      trunk(b, A, 20, 320, [580], RED); trunk(b, A, 25, 360, [600], BLK);
      P(b, [[S, 3], [400, 540], [420, 540], [A, 14]], BLU);
      P(b, [[S, 0], [460, 580], [320, 580]], RED); P(b, [[S, 1], [440, 600], [360, 600]], BLK);
      const Bz = b.add('abuzzer', 400, 190, 0, {});
      P(b, [[Bz, 0], [A, 8]], ORG); P(b, [[Bz, 1], [450, 220], [450, 140], [260, 140], [A, 23]], BLK);
    }),
    mk('sngas', '传感器：气体浓度报警 (MQ-2 + 继电器)', (b, A) => {
      const S = b.add('mqgas', 430, 660, 2, { model: 'MQ2', q: 100, sig: 'sine', smin: 0, smax: 3000, sper: 16 });
      trunk(b, A, 20, 320, [540, 580], RED); trunk(b, A, 25, 360, [560, 600], BLK);
      P(b, [[S, 3], [400, 530], [420, 530], [A, 14]], BLU);
      P(b, [[S, 2], [420, 570], [640, 570], [640, 240], [420, 240], [A, 7]], PUR);
      P(b, [[S, 0], [460, 580], [320, 580]], RED); P(b, [[S, 1], [440, 600], [360, 600]], BLK);
      const Ry = b.add('relaymod', 740, 100, 3, {});
      P(b, [[Ry, 2], [760, 250], [380, 250], [A, 8]], ORG);
      P(b, [[Ry, 0], [720, 540], [320, 540]], RED); P(b, [[Ry, 1], [740, 560], [360, 560]], BLK);
      const k = ledChain(b, A, 9, 360, 'red');
      P(b, [k, [260, 60], [A, 23]], BLK);
    }),
    mk('snlm35', '传感器：LM35 温度计', (b, A) => {
      const S = b.add('lm35', 420, 660, 2, { q: 25, sig: 'tri', smin: 15, smax: 45, sper: 30 });
      trunk(b, A, 20, 320, [580], RED); trunk(b, A, 25, 360, [600], BLK);
      P(b, [[S, 1], [A, 14]], BLU); P(b, [[S, 0], [440, 580], [320, 580]], RED); P(b, [[S, 2], [400, 600], [360, 600]], BLK);
    }),
    mk('snline', '传感器：双路循迹 (TCRT5000)', (b, A) => {
      const S1 = b.add('tcrt5000', 80, 120, 0, { q: 80, sig: 'square', smin: 90, smax: 10, sper: 2 });
      const S2 = b.add('tcrt5000', 180, 120, 0, { q: 80, sig: 'square', smin: 90, smax: 10, sper: 3 });
      trunk(b, A, 20, 320, [540, 580], RED); trunk(b, A, 25, 360, [560, 600], BLK);
      P(b, [[S1, 2], [90, 250], [520, 250], [A, 2]], YEL); P(b, [[S2, 2], [190, 240], [500, 240], [A, 3]], GRN);
      P(b, [[S1, 0], [50, 540], [320, 540]], RED); P(b, [[S2, 0], [150, 580], [320, 580]], RED);
      P(b, [[S1, 1], [70, 560], [360, 560]], BLK); P(b, [[S2, 1], [170, 600], [360, 600]], BLK);
      const k1 = ledChain(b, A, 9, 360, 'green', 180), k2 = ledChain(b, A, 11, 320, 'green', 180);
      P(b, [k1, [360, 40], [320, 40]], BLK); P(b, [k2, [320, 40]], BLK); P(b, [[320, 40], [260, 40], [A, 23]], BLK);
    }),
    mk('snenc', '传感器：旋转编码器计数', (b, A) => {
      const S = b.add('encoder', 100, 120, 0, { spin: 3 });
      trunk(b, A, 20, 320, [540], RED); trunk(b, A, 25, 360, [560], BLK);
      P(b, [[S, 4], [140, 250], [520, 250], [A, 2]], YEL); P(b, [[S, 3], [120, 240], [500, 240], [A, 3]], GRN); P(b, [[S, 2], [100, 230], [480, 230], [A, 4]], BLU);
      P(b, [[S, 1], [80, 540], [320, 540]], RED); P(b, [[S, 0], [60, 560], [360, 560]], BLK);
    }),
    mk('snacs', '传感器：ACS712 电流监测', (b, A) => {
      const S = b.add('acs712', 420, 660, 2, { range: 5, q: 0 });
      trunk(b, A, 20, 320, [580], RED); trunk(b, A, 25, 360, [600], BLK);
      P(b, [[S, 1], [A, 14]], BLU); P(b, [[S, 0], [440, 580], [320, 580]], RED); P(b, [[S, 2], [400, 600], [360, 600]], BLK);
      const B = b.add('battery', 420, 860, 0, { V: 12 }), Lp = b.add('bulb', 300, 780, 0, { Vr: 12, Pr: 24 });
      P(b, [[B, 1], [480, 760], [440, 760], [S, 3]], RED); P(b, [[S, 4], [400, 780], [Lp, 1]], ORG); P(b, [[Lp, 0], [260, 860], [B, 0]], BLK);
    }),
    mk('snds18', '传感器：DS18B20 数字温度计', (b, A) => {
      const S = b.add('ds18b20', 480, 160, 0, { q: 22.5, sig: 'sine', smin: 18, smax: 30, sper: 30 });
      const R = b.add('resistor', 540, 200, 1, { R: 4700 });
      trunk(b, A, 20, 320, [540], RED);
      P(b, [[S, 1], [480, 240]], YEL); P(b, [[480, 240], [A, 4]], YEL); P(b, [[R, 1], [480, 240]], YEL);
      P(b, [[S, 2], [500, 160], [R, 0]], RED); P(b, [[R, 0], [540, 140], [640, 140], [640, 540], [320, 540]], RED);
      P(b, [[S, 0], [460, 200], [260, 200], [A, 23]], BLK);
    }),
    mk('snlcdi2c', '单片机：I2C 液晶屏 (LCD1602 + PCF8574)', (b, A) => {
      const Lc = b.add('lcdi2c', 500, 100, 0, {}), S = b.add('tmp36', 420, 660, 2, { q: 23 });
      trunk(b, A, 20, 320, [540, 580], RED); trunk(b, A, 25, 360, [560, 600], BLK);
      P(b, [[Lc, 0], [100, 70], [100, 560], [360, 560]], BLK); P(b, [[Lc, 1], [120, 90], [120, 540], [320, 540]], RED);
      P(b, [[Lc, 2], [140, 110], [140, 630], [500, 630], [A, 18]], BLU); P(b, [[Lc, 3], [160, 130], [160, 610], [520, 610], [A, 19]], YEL);
      P(b, [[S, 1], [A, 14]], GRN); P(b, [[S, 0], [440, 580], [320, 580]], RED); P(b, [[S, 2], [400, 600], [360, 600]], BLK);
    }),
  ];
  EXAMPLES.push(...list);
})();
