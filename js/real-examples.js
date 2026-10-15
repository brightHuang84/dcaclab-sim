'use strict';
// ===== v15: examples for the real-world simulation mode (turn 🎲 on to see ripple / bounce; with it off they are ideal circuits) =====
(() => {
  const RED = '#d62828', BLK = '#222222', BLU = '#1d5fd1', ORG = '#f77f00', GRN = '#2a9d3a';
  const L = (a) => a.join('\n');
  const BOUNCE_CODE = L([
    "// Counts button presses on D2 (INPUT_PULLUP) WITHOUT debouncing.",
    "// Ideal mode: one press = +1.  Turn on 🎲 real-world mode: contact bounce",
    "// makes one press count several times.",
    "const int BUTTON_PIN = 2;",
    "const int LED_PIN = 7;",
    "int lastState = HIGH;",
    "long count = 0;",
    "",
    "void setup() {",
    "  pinMode(BUTTON_PIN, INPUT_PULLUP);",
    "  pinMode(LED_PIN, OUTPUT);",
    "  Serial.begin(9600);",
    "  Serial.println(\"press the button\");",
    "}",
    "",
    "void loop() {",
    "  int s = digitalRead(BUTTON_PIN);",
    "  if (s == LOW && lastState == HIGH) {",
    "    count++;",
    "    Serial.print(\"count = \");",
    "    Serial.println(count);",
    "  }",
    "  if (s != lastState) digitalWrite(LED_PIN, s == LOW ? HIGH : LOW);",
    "  lastState = s;",
    "}",
  ]);
  EXAMPLES.push(
    {
      id: 'realrc', name: '现实模拟：电源纹波与 RC 滤波 (打开 🎲)', build() {
        const b = EXAMPLES.builder();
        const P = b.add('psu', 100, 300, 0, { V: 12, I: 1 });
        const R1 = b.add('resistor', 240, 250, 0, { R: 100 });
        const C1 = b.add('capacitor', 320, 400, 1, { C: 470e-6 });
        const RL = b.add('resistor', 400, 400, 1, { R: 1000 });
        const C2 = b.add('capacitor', 520, 180, 0, { C: 10e-6 });
        const C3 = b.add('capacitor', 500, 300, 0, { C: 10e-6 });
        const B1 = b.add('resistor', 600, 400, 1, { R: 10000 });
        const B2 = b.add('resistor', 700, 400, 1, { R: 10000 });
        const O = b.add('scope', 1100, 250, 0, { tdiv: 5e-3, v1div: 0.02, v2div: 0.02, pos1: 0, pos2: 0 });
        b.path([[P, 1], [120, 250], [R1, 0]], RED);
        b.path([[R1, 1], [320, 250], [C1, 0]], RED);
        b.path([[C1, 0], [RL, 0]], RED);
        b.path([[P, 0], [80, 520], [320, 520], [C1, 1]], BLK);
        b.path([[C1, 1], [RL, 1]], BLK);
        b.path([[RL, 1], [B1, 1]], BLK);
        b.path([[B1, 1], [B2, 1]], BLK);
        b.path([[B2, 1], [1140, 440], [O, 2]], BLK);
        b.path([[R1, 0], [200, 180], [C2, 0]], ORG);
        b.path([[C2, 1], [600, 180], [B1, 0]], ORG);
        b.path([[C2, 1], [560, 330], [O, 0]], ORG);
        b.path([[RL, 0], [400, 300], [C3, 0]], BLU);
        b.path([[C3, 1], [700, 300], [B2, 0]], BLU);
        b.path([[B2, 0], [760, 360], [760, 380], [1100, 380], [O, 1]], BLU);
        return b.done();
      },
    },
    {
      id: 'realbounce', name: '现实模拟：按钮抖动与单片机计数 (打开 🎲)', build() {
        const b = EXAMPLES.builder();
        const A = b.add('arduino', 400, 380, 0, { code: BOUNCE_CODE });
        const R = b.add('resistor', 460, 160, 0, { R: 220 }), Ld = b.add('led', 580, 160, 0, { color: 'green' });
        const S = b.add('button', 600, 220);
        b.path([[A, 7], [R, 0]], ORG); b.wire(R, 1, Ld, 0, 0, ORG);
        b.path([[A, 2], [520, 220], [S, 0]], BLU);
        b.path([[Ld, 1], [680, 160]], BLK); b.path([[S, 1], [680, 220]], BLK); b.path([[680, 220], [680, 160]], BLK);
        b.path([[680, 160], [680, 80], [260, 80], [A, 23]], BLK);
        return b.done();
      },
    },
  );
})();
