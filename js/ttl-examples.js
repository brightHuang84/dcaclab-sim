'use strict';
// ===== v13: example circuits for the 74-series / CD4000 logic ICs =====
// Wires only connect at their END points (a wire's first / last point) — the helpers below therefore always end every wire exactly on a
// terminal; power is distributed on a VCC rail and a GND rail that every tie wire reaches with its own wire.
const TTL_EX = (() => {
  const L = (a) => a.join('\n');
  return {
    ttl595: {
      board: 'arduino', pins: 'D8 → SER (14) · D9 → RCLK (12) · D10 → SRCLK (11) · /OE (13) → GND · /SRCLR (10) → 5 V',
      code: L([
        '// Arduino Uno + 74HC595: running light.  D8 -> SER (DS), D10 -> SRCLK (SH_CP), D9 -> RCLK (ST_CP).',
        '// shiftOut() puts the byte into the shift register; the rising edge of RCLK copies it to the outputs QA..QH.',
        'const int DATA = 8;',
        'const int LATCH = 9;',
        'const int CLOCK = 10;',
        'byte pattern = 1;',
        '',
        'void setup() {',
        '  pinMode(DATA, OUTPUT);',
        '  pinMode(LATCH, OUTPUT);',
        '  pinMode(CLOCK, OUTPUT);',
        '}',
        '',
        'void loop() {',
        '  digitalWrite(LATCH, LOW);',
        '  shiftOut(DATA, CLOCK, MSBFIRST, pattern);   // QH gets bit 7 ... QA gets bit 0',
        '  digitalWrite(LATCH, HIGH);',
        '  pattern = pattern << 1;                     // byte: 128 << 1 wraps to 0',
        '  if (pattern == 0) pattern = 1;',
        '  delay(150);',
        '}', '']),
    },
    ttl165: {
      board: 'arduino', pins: 'D8 ← QH (9) · D9 → /PL (1) · D10 → CLK (2) · CLK INH (15), SER (10) → GND',
      code: L([
        '// Arduino Uno + 74HC165: read 8 switches (A..H on the parallel inputs).',
        '// The 74HC165 shifts on the RISING edge of CLK, and Arduino\'s shiftIn() samples the data pin AFTER it raises the clock,',
        '// so after /PL went high QH (= switch H) is already gone when shiftIn() looks.  Idiom: read the first bit by hand,',
        '// then let shiftIn() read the other seven (SER is tied to GND, so shiftIn\'s last bit is 0).',
        'const int QH = 8;',
        'const int LOAD = 9;',
        'const int CLK = 10;',
        '',
        'void setup() {',
        '  Serial.begin(9600);',
        '  pinMode(QH, INPUT);',
        '  pinMode(LOAD, OUTPUT);',
        '  pinMode(CLK, OUTPUT);',
        '  digitalWrite(LOAD, HIGH);',
        '  digitalWrite(CLK, LOW);',
        '}',
        '',
        'void loop() {',
        '  digitalWrite(LOAD, LOW);              // parallel load (asynchronous, level sensitive)',
        '  delayMicroseconds(5);',
        '  digitalWrite(LOAD, HIGH);',
        '  int first = digitalRead(QH);          // switch H',
        '  int rest = shiftIn(QH, CLK, MSBFIRST);  // G F E D C B A 0',
        '  int value = (first << 7) | (rest >> 1);',
        '  Serial.print("switches = ");',
        '  Serial.println(value);',
        '  delay(200);',
        '}', '']),
    },
  };
})();
if (typeof module !== 'undefined') module.exports = TTL_EX;

if (typeof EXAMPLES !== 'undefined' && typeof DEFS !== 'undefined' && DEFS.ic7400) (() => {
  const RED = '#d62828', BLK = '#222222', BLU = '#1d5fd1', GRN = '#2a9d3a', YEL = '#f2b705', ORG = '#f77f00';
  const PRE = '74 系列：';
  const colOf = (c) => (c === 'red' ? RED : c === 'green' ? GRN : c === 'yellow' ? YEL : ORG);
  // ---- layout kit: every wire ends exactly on terminals (wires only connect at their end points) ----
  const kit = (b) => {
    const X = { pw: null };
    const pi = (U, name) => (typeof name === 'number' ? name : DEFS[U.type].part.pins.indexOf(name));
    const xy = (U, name) => b.tp(U, pi(U, name));
    const sideOf = (U, name) => (xy(U, name)[0] < U.x ? -1 : 1);
    X.pi = pi; X.xy = xy;
    X.ic = (type, x, y, props) => { const U = b.add(type, x, y, 0, props || {}); U._k = { '-1': 0, '1': 0 }; U._last = { '-1': -1e9, '1': -1e9 }; return U; };
    X.pt = (U, name) => [U, pi(U, name)];
    X.p = (pts, col) => b.path(pts, col || BLU);
    const lane = (U, dir) => U.x + dir * (92 + 8 * U._k[dir]++);
    X.lane = (U, dir) => lane(U, dir);
    const slot = (U, dir, y) => { const yy = Math.max(y, U._last[dir] + 40); U._last[dir] = yy; return yy; };
    X.src = (U, name, kind, props, col) => {   // input element (logic switch / clock) on the side of the pin
      const dir = sideOf(U, name), py = xy(U, name)[1], y = slot(U, dir, py), lx = lane(U, dir);
      const S = b.add(kind || 'lswitch', U.x + dir * 230, y, dir < 0 ? 0 : 2, props || {});
      X.p([[S, 0], [lx, y], [lx, py], X.pt(U, name)], col || BLU); return S;
    };
    X.probe = (U, name, col) => {   // logic probe (H / L lamp)
      const dir = sideOf(U, name), py = xy(U, name)[1], y = slot(U, dir, py), lx = lane(U, dir);
      let rot = 0; for (let r = 0; r < 4; r++) { const [rx, ry] = U_rot(0, 20, r); if (Math.abs(ry) < 1e-6 && Math.sign(rx) === -dir) rot = r; }
      const P = b.add('lprobe', U.x + dir * 215, y, rot, {});
      X.p([[P, 0], [lx, y], [lx, py], X.pt(U, name)], col || GRN); return P;
    };
    X.led = (U, name, color, active) => {   // LED + 330 Ω.  'high': pin -> R -> LED -> GND;  'low': VCC -> R -> LED -> pin (pin sinks)
      const dir = sideOf(U, name), py = xy(U, name)[1], y = slot(U, dir, py), lx = lane(U, dir), c = color || 'red', cl = colOf(c);
      if (active === 'low') {
        const Ld = b.add('led', U.x + dir * 200, y, dir > 0 ? 2 : 0, { color: c }), R = b.add('resistor', U.x + dir * 320, y, 0, { R: 330 });
        X.p([[Ld, 1], [lx, y], [lx, py], X.pt(U, name)], cl);
        X.p([[Ld, 0], [R, dir > 0 ? 0 : 1]], cl);
        X.tieVpt([R, dir > 0 ? 1 : 0], U.x + dir * 384);
        return Ld;
      }
      const R = b.add('resistor', U.x + dir * 200, y, 0, { R: 330 }), Ld = b.add('led', U.x + dir * 320, y, dir > 0 ? 0 : 2, { color: c });
      X.p([[R, dir > 0 ? 0 : 1], [lx, y], [lx, py], X.pt(U, name)], cl);
      X.p([[R, dir > 0 ? 1 : 0], [Ld, 0]], cl);
      X.tieGpt([Ld, 1], U.x + dir * 384);
      return Ld;
    };
    X.res = (U, name, ohm) => {   // series resistor on the side of the pin; returns [R, outerTerminalIndex]
      const dir = sideOf(U, name), py = xy(U, name)[1], y = slot(U, dir, py), lx = lane(U, dir);
      const R = b.add('resistor', U.x + dir * 230, y, 0, { R: ohm || 330 });
      X.p([[R, dir > 0 ? 0 : 1], [lx, y], [lx, py], X.pt(U, name)], ORG); return [R, dir > 0 ? 1 : 0];
    };
    // wrap-around link between pins (route above the IC at height topY)
    X.wrap = (U1, n1, U2, n2, topY, col) => {
      const d1 = sideOf(U1, n1), d2 = sideOf(U2, n2), l1 = lane(U1, d1), l2 = lane(U2, d2), a = xy(U1, n1), c = xy(U2, n2);
      X.p([X.pt(U1, n1), [l1, a[1]], [l1, topY], [l2, topY], [l2, c[1]], X.pt(U2, n2)], col || YEL);
    };
    X.link = (U1, n1, U2, n2, mx, col) => {   // pin to pin via a vertical lane at x = mx
      const a = xy(U1, n1), c = xy(U2, n2), m = mx === undefined ? (a[0] + c[0]) / 2 : mx;
      X.p([X.pt(U1, n1), [m, a[1]], [m, c[1]], X.pt(U2, n2)], col || YEL);
    };
    X.power = (spec) => { X.pw = spec; };
    X.vccPath = (from, lx) => { const P = X.pw, a = b.tp(P.v[0], P.v[1]); return [from, [lx, b.tp(from[0], from[1])[1]], [lx, P.ty], [a[0], P.ty], P.v]; };
    X.gndPath = (from, lx) => { const P = X.pw, a = b.tp(P.g[0], P.g[1]); return [from, [lx, b.tp(from[0], from[1])[1]], [lx, P.by], [a[0], P.by], P.g]; };
    X.gnd = (b2, A) => {   // ground symbol for a board whose GND pin (23) is the circuit reference: drop straight away from the board edge, then sideways
      const q = b2.tp(A, 23), dy = q[1] > A.y ? 1 : -1, ty = q[1] + dy * 46, gx = q[0] - 70, G = b2.add('ground', gx, ty + 14, 0, {});
      X.p([[A, 23], [q[0], ty], [gx, ty], [G, 0]], BLK);
    };
    X.tieV = (U, name, off) => X.p(X.vccPath(X.pt(U, name), U.x + sideOf(U, name) * (72 + (off || 0))), RED);
    X.tieG = (U, name, off) => X.p(X.gndPath(X.pt(U, name), U.x + sideOf(U, name) * (78 + (off || 0))), BLK);
    X.tieVpt = (pt, lx) => X.p(X.vccPath(pt, lx), RED);
    X.tieGpt = (pt, lx) => X.p(X.gndPath(pt, lx), BLK);
    X.supply = (U) => { const n = DEFS[U.type].part; X.tieV(U, n.pins[n.iv]); X.tieG(U, n.pins[n.ig]); };
    X.tieVs = (U, names) => names.forEach((n) => X.tieV(U, n));
    X.tieGs = (U, names) => names.forEach((n) => X.tieG(U, n));
    return X;
  };
  const U_rot = (x, y, r) => U.rot(x, y, r);
  const battery = (b, X, bx, by, ty, boty) => {   // 5 V battery at (bx, by); VCC rail at y = ty (above), GND rail at y = boty (below), ground symbol below the battery
    const B = b.add('battery', bx, by, 0, { V: 5 }), G = b.add('ground', bx - 60, boty + 20, 0, {});
    X.power({ ty, by: boty, v: [B, 1], g: [G, 0] });
    X.p([[B, 0], [G, 0]], BLK); return B;
  };
  const mk = (id, name, fn) => ({ id, name: PRE + name, build() { const b = EXAMPLES.builder(); const X = kit(b); fn(b, X); return b.done(); } });
  const list = [];

  // 1 — SR latch from two NAND gates of a 7400
  list.push(mk('ttlsr', '7400 与非门构成 SR 锁存器', (b, X) => {
    const U1 = X.ic('ic7400', 700, 340, { fam: 'HC' });
    battery(b, X, 140, 160, 70, 600); X.supply(U1);
    const l1 = U1.x - 84, l2 = U1.x - 92; U1._k['-1'] = 2;
    X.p([X.pt(U1, '1Y'), [l1, X.xy(U1, '1Y')[1]], [l1, X.xy(U1, '2B')[1]], X.pt(U1, '2B')], YEL);       // Q -> 2B
    X.p([X.pt(U1, '2Y'), [l2, X.xy(U1, '2Y')[1]], [l2, X.xy(U1, '1B')[1]], X.pt(U1, '1B')], ORG);       // /Q -> 1B
    X.src(U1, '1A', 'lswitch', { on: false });   // /S  (0 = set)
    X.src(U1, '2A', 'lswitch', { on: true });    // /R
    X.probe(U1, '1Y'); X.probe(U1, '2Y');
  }));

  // 2 — 4-bit ripple counter 7493 + probes
  list.push(mk('ttlrip', '7493 四位二进制计数器 + 逻辑探头', (b, X) => {
    const U1 = X.ic('ic7493', 700, 360, { fam: 'LS' });
    battery(b, X, 140, 160, 70, 640); X.supply(U1);
    X.tieGs(U1, ['R0(1)', 'R0(2)']);
    X.wrap(U1, 'QA', U1, 'CKB', 200, ORG);
    X.src(U1, 'CKA', 'clock', { f: 2 }, BLU);
    for (const n of ['QD', 'QC', 'QB', 'QA']) X.probe(U1, n);
  }));

  // 3 — 555 -> 7490 -> 7447 -> 7-segment display
  list.push(mk('ttlbcd', '555 → 7490 → 7447 → 七段数码管 (十进制计数)', (b, X) => {
    battery(b, X, 140, 160, 40, 700);
    const T = b.add('ic555', 300, 240, 0, {}), R1 = b.add('resistor', 200, 110, 0, { R: 10000 }), R2 = b.add('resistor', 360, 110, 0, { R: 100000 }), C = b.add('capacitor', 460, 170, 0, { C: 4.7e-6 });
    X.tieVpt([R1, 0], 140); X.tieVpt([T, 7], 220); X.tieVpt([T, 3], 340);
    X.p([[R1, 1], [R2, 0]], BLU); X.p([[T, 6], [T.x - 20, 150], [R1, 1]], BLU);
    X.p([[R2, 1], [420, 110], [C, 0]], BLU); X.p([[T, 5], [T.x, 170], [C, 0]], BLU); X.p([[T, 1], [T.x - 20, 290], [380, 290], [380, 170], [C, 0]], BLU);
    X.tieGpt([C, 1], 520); X.tieGpt([T, 0], T.x - 40 - 16);
    const U1 = X.ic('ic7490', 820, 420, { fam: 'LS' }), U2 = X.ic('ic7447', 1170, 420, { fam: 'LS' });
    X.supply(U1); X.supply(U2);
    X.tieGs(U1, ['R0(1)', 'R0(2)', 'R9(1)', 'R9(2)']);
    X.wrap(U1, 'QA', U1, 'CKB', 250, ORG);
    X.p([[T, 2], [T.x, 330], [940, 330], [940, X.xy(U1, 'CKA')[1]], X.pt(U1, 'CKA')], YEL);
    X.link(U1, 'QA', U2, 'A', 980, GRN); X.link(U1, 'QB', U2, 'B', 988, GRN); X.link(U1, 'QC', U2, 'C', 996, GRN); X.link(U1, 'QD', U2, 'D', 1004, GRN);
    X.tieVs(U2, ['/LT', '/BI', '/RBI']);
    const D = b.add('seg7cc', 1560, 430, 0, { ca: true });
    const segs = [['a', 3, 'top'], ['b', 4, 'top'], ['c', 8, 'bot'], ['d', 6, 'bot'], ['e', 5, 'bot'], ['f', 1, 'top'], ['g', 0, 'top']];
    let kt = 0, kb = 0;
    ['e', 'd', 'c', 'b', 'a', 'g', 'f'].forEach((n) => {
      const [R, outer] = X.res(U2, n, 330), s = segs.find((q) => q[0] === n), q = b.tp(R, outer), ex = b.tp(D, s[1]);
      const lx = q[0] + 16 + 8 * (kt + kb), vy = s[2] === 'top' ? D.y - 100 - 8 * kt++ : D.y + 100 + 8 * kb++;
      X.p([[R, outer], [lx, q[1]], [lx, vy], [ex[0], vy], [D, s[1]]], YEL);
    });
    X.tieVpt([D, 2], b.tp(D, 2)[0] + 0);
  }));

  // 4 — 74161 synchronous counter
  list.push(mk('ttl161', '74161 同步计数器 + 逻辑探头', (b, X) => {
    const U1 = X.ic('ic74161', 700, 380, { fam: 'HC' });
    battery(b, X, 140, 160, 70, 640); X.supply(U1);
    X.tieVs(U1, ['/CLR', '/LOAD', 'ENP', 'ENT']); X.tieGs(U1, ['A', 'B', 'C', 'D']);
    X.src(U1, 'CLK', 'clock', { f: 2 });
    for (const n of ['RCO', 'QA', 'QB', 'QC', 'QD'].reverse()) X.probe(U1, n);
  }));

  // 5 — 74138 decoder + LEDs
  list.push(mk('ttl138', '74138 译码器驱动 LED', (b, X) => {
    const U1 = X.ic('ic74138', 700, 400, { fam: 'HC' });
    battery(b, X, 140, 160, 70, 760); X.supply(U1);
    X.tieGs(U1, ['/G2A', '/G2B']); X.tieV(U1, 'G1');
    for (const n of ['A', 'B', 'C']) X.src(U1, n, 'lswitch', { on: n === 'B' });
    X.led(U1, '/Y7', 'red', 'low');
    for (const n of ['/Y6', '/Y5', '/Y4', '/Y3', '/Y2', '/Y1', '/Y0'].reverse().reverse()) X.led(U1, n, 'green', 'low');
  }));

  // helper: Arduino pin -> IC pin over the top of the board (k = lane number)
  const ard = (b, X, A, U1, pin, name, k, col) => {
    const q = b.tp(A, pin), p = X.xy(U1, name), dir = p[0] < U1.x ? -1 : 1, lx = X.lane(U1, dir), vy = Math.min(q[1] - 30 - 12 * k, U1.y + DEFS[U1.type].box[1] - 40 - 12 * k);
    X.p([[A, pin], [q[0], vy], [lx, vy], [lx, p[1]], X.pt(U1, name)], col || BLU);
  };
  // 6 — Arduino + 74HC595
  list.push({ id: 'ttl595', name: PRE + 'Arduino shiftOut → 74HC595 流水灯', build() {
    const b = EXAMPLES.builder(), X = kit(b);
    const A = b.add('arduino', 380, 420, 0, { code: TTL_EX.ttl595.code });
    const U1 = X.ic('ic74595', 1000, 330, { fam: 'HC' });
    const tp = (i) => b.tp(A, i);
    X.power({ ty: 860, by: 100, v: [A, 20], g: [A, 23] });
    X.gnd(b, A);
    X.tieV(U1, 'VCC'); X.tieG(U1, 'GND'); X.tieV(U1, '/SRCLR'); X.tieG(U1, '/OE');
    ard(b, X, A, U1, 8, 'SER', 0); ard(b, X, A, U1, 9, 'RCLK', 1); ard(b, X, A, U1, 10, 'SRCLK', 2);
    // LED row below the IC: LED i (QA..QH) with a common 330 Ω to GND
    const names = ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'], ly = 640, Rc = b.add('resistor', 1000, 760, 0, { R: 330 });
    let lk = 0; names.forEach((n, i) => {
      const Ld = b.add('led', 780 + 60 * i, ly, 1, { color: 'red' });
      const a = b.tp(Ld, 0), k = b.tp(Ld, 1), up = a[1] < k[1] ? 0 : 1, dn = 1 - up, p = X.xy(U1, n), dir = sideOf2(U1, n), lx = X.lane(U1, dir);
      X.p([X.pt(U1, n), [lx, p[1]], [lx, 540 - 8 * i], [b.tp(Ld, up)[0], 540 - 8 * i], [Ld, up]], YEL);
      X.p([[Ld, dn], [b.tp(Ld, dn)[0], 700], [b.tp(Rc, 0)[0], 700], [Rc, 0]], BLK);
    });
    X.tieGpt([Rc, 1], 1220);
    return b.done();
  } });
  const sideOf2 = (U1, n) => (DEFS[U1.type].part.pins.indexOf(n) < DEFS[U1.type].part.pins.length / 2 ? -1 : 1);

  // 7 — Arduino + 74HC165
  list.push({ id: 'ttl165', name: PRE + 'Arduino shiftIn ← 74HC165 读取 8 个开关', build() {
    const b = EXAMPLES.builder(), X = kit(b);
    const A = b.add('arduino', 380, 420, 0, { code: TTL_EX.ttl165.code });
    const U1 = X.ic('ic74165', 1000, 400, { fam: 'HC' });
    X.power({ ty: 860, by: 100, v: [A, 20], g: [A, 23] });
    X.gnd(b, A);
    X.tieV(U1, 'VCC'); X.tieG(U1, 'GND'); X.tieG(U1, 'CLKINH'); X.tieG(U1, 'SER');
    ard(b, X, A, U1, 8, 'QH', 0); ard(b, X, A, U1, 9, '/PL', 1); ard(b, X, A, U1, 10, 'CLK', 2);
    for (const n of ['E', 'F', 'G', 'H']) X.src(U1, n, 'lswitch', { on: n === 'F' || n === 'H' });
    for (const n of ['D', 'C', 'B', 'A']) X.src(U1, n, 'lswitch', { on: n === 'B' });
    return b.done();
  } });

  // 8 — 74373 latch on a bus
  list.push(mk('ttl373', '74373 锁存器总线演示', (b, X) => {
    const U1 = X.ic('ic74373', 700, 420, { fam: 'HC' });
    battery(b, X, 140, 160, 70, 800); X.supply(U1);
    X.tieG(U1, '/OE');
    const left = ['1Q', '1D', '2D', '2Q', '3Q', '3D', '4D', '4Q'], right = ['5Q', '5D', '6D', '6Q', '7Q', '7D', '8D', '8Q'];
    X.src(U1, 'LE', 'lswitch', { on: true });
    for (const n of left) { if (n.endsWith('D')) X.src(U1, n, 'lswitch', { on: n === '1D' || n === '4D' }); else X.probe(U1, n); }
    for (const n of right.slice().reverse()) { if (n.endsWith('D')) X.src(U1, n, 'lswitch', { on: n === '5D' || n === '8D' }); else X.probe(U1, n); }
  }));

  // 9 — 74245 bus transceiver
  list.push(mk('ttl245', '74245 总线收发器 (开关与探头)', (b, X) => {
    const U1 = X.ic('ic74245', 760, 460, { fam: 'HC' });
    battery(b, X, 140, 160, 70, 860); X.supply(U1);
    X.src(U1, 'DIR', 'lswitch', { on: true }); X.tieG(U1, '/OE', 8);
    for (const k of [1, 2, 3, 4]) { const n = 'A' + k, S = X.src(U1, n, 'lswitch', { on: k % 2 === 1 }); }
    for (const k of [5, 6, 7, 8]) X.tieG(U1, 'A' + k, 14 + 4 * k);
    for (const k of [8, 7, 6, 5]) X.tieG(U1, 'B' + k, 14 + 4 * k);
    for (const k of [4, 3, 2, 1]) X.probe(U1, 'B' + k);
  }));

  // 10 — 7483 4-bit adder
  list.push(mk('ttl7483', '7483 四位加法器 (开关与探头)', (b, X) => {
    const U1 = X.ic('ic7483', 700, 440, { fam: 'LS' });
    battery(b, X, 140, 160, 70, 860); X.supply(U1);
    const pins = DEFS.ic7483.part.pins, order = [];
    for (let side = 0; side < 2; side++) { const idx = pins.map((n, i) => i).filter((i) => (i < 8) === (side === 0) && i !== DEFS.ic7483.part.iv && i !== DEFS.ic7483.part.ig); if (side === 1) idx.sort((a, c) => X.xy(U1, a)[1] - X.xy(U1, c)[1]); order.push(...idx); }
    const on = { A1: 1, A2: 0, A3: 1, A4: 0, B1: 1, B2: 1, B3: 0, B4: 0, C0: 0 };
    for (const i of order) { const n = pins[i]; if (/^[AB]\d$/.test(n) || n === 'C0') X.src(U1, n, 'lswitch', { on: !!on[n] }); else X.probe(U1, n); }
  }));

  // 11 — 7485 4-bit comparator
  list.push(mk('ttl7485', '7485 四位比较器', (b, X) => {
    const U1 = X.ic('ic7485', 700, 440, { fam: 'LS' });
    battery(b, X, 140, 160, 70, 860); X.supply(U1);
    X.tieV(U1, 'A=B'); X.tieGs(U1, ['A<B', 'A>B']);
    const on = { A0: 1, A1: 0, A2: 1, A3: 0, B0: 0, B1: 1, B2: 1, B3: 0 };
    const pins = DEFS.ic7485.part.pins, left = [0, 8, 9, 10, 11, 12, 13].map(() => 0);
    for (const n of ['B3', 'B0', 'A0', 'B1', 'A1', 'A2', 'B2']) X.src(U1, n, 'lswitch', { on: !!on[n] });
    for (const n of ['A3', 'OA>B', 'OA=B', 'OA<B']) { if (n === 'A3') X.src(U1, n, 'lswitch', { on: false }); else X.probe(U1, n); }
  }));

  // 12 — 74194 shift register as twisted-ring (Johnson) counter
  list.push(mk('ttl194', '74194 移位寄存器环形计数器', (b, X) => {
    const U1 = X.ic('ic74194', 760, 500, { fam: 'HC' }), U2 = X.ic('ic7404', 760, 150, { fam: 'HC' });
    battery(b, X, 140, 160, 40, 860); X.supply(U1); X.supply(U2);
    X.tieVs(U1, ['/CLR', 'S0']); X.tieGs(U1, ['S1', 'SL', 'A', 'B', 'C', 'D']);
    X.tieGs(U2, ['1A', '2A', '3A', '4A', '5A']);
    const a = X.xy(U1, 'QD'), c = X.xy(U2, '6A'), d = X.xy(U2, '6Y'), e = X.xy(U1, 'SR');
    X.p([X.pt(U1, 'QD'), [a[0] + 36, a[1]], [a[0] + 36, c[1]], X.pt(U2, '6A')], GRN);
    X.p([X.pt(U2, '6Y'), [d[0] + 44, d[1]], [d[0] + 44, 360], [e[0] - 60, 360], [e[0] - 60, e[1]], X.pt(U1, 'SR')], ORG);
    X.src(U1, 'CLK', 'clock', { f: 3 });
    for (const n of ['QA', 'QB', 'QC', 'QD']) X.probe(U1, n);
  }));

  // 13 — 7414 Schmitt-trigger RC oscillator
  list.push(mk('ttl14', '7414 施密特触发器 RC 振荡器', (b, X) => {
    const U1 = X.ic('ic7414', 760, 420, { fam: 'HC' });
    battery(b, X, 140, 160, 70, 760); X.supply(U1);
    X.tieGs(U1, ['2A', '3A']); X.tieGs(U1, ['4A', '5A', '6A']);
    const R = b.add('resistor', U1.x - 300, 300, 0, { R: 470000 }), C = b.add('capacitor', U1.x - 340, 380, 1, { C: 1e-6 });
    const top = b.tp(C, 0)[1] < b.tp(C, 1)[1] ? 0 : 1, y1 = X.xy(U1, '1A'), y2 = X.xy(U1, '1Y');
    X.p([X.pt(U1, '1Y'), [y2[0] - 36, y2[1]], [y2[0] - 36, 300], [R, 1]], YEL);
    X.p([[R, 0], [C, top]], BLU);
    X.p([[R, 0], [R.x - 40, 240], [y1[0] - 44, 240], [y1[0] - 44, y1[1]], X.pt(U1, '1A')], BLU);
    X.tieGpt([C, 1 - top], b.tp(C, 0)[0] - 30);
    U1._k['-1'] = 3;
    X.led(U1, '1Y', 'red', 'high'); X.probe(U1, '1Y');
  }));

  // 14 — 7474 clock divider
  list.push(mk('ttl7474', '7474 分频器 (÷2 与 ÷4)', (b, X) => {
    const U1 = X.ic('ic7474', 700, 380, { fam: 'HC' });
    battery(b, X, 140, 160, 70, 700); X.supply(U1);
    X.tieVs(U1, ['/1CLR', '/1PRE']); X.tieVs(U1, ['/2CLR', '/2PRE']);
    const l1 = X.lane(U1, -1), l2 = X.lane(U1, -1), l3 = X.lane(U1, 1);
    X.p([X.pt(U1, '/1Q'), [U1.x - 74, X.xy(U1, '/1Q')[1]], [U1.x - 74, X.xy(U1, '1D')[1]], X.pt(U1, '1D')], ORG);
    X.p([X.pt(U1, '/2Q'), [U1.x + 74, X.xy(U1, '/2Q')[1]], [U1.x + 74, X.xy(U1, '2D')[1]], X.pt(U1, '2D')], ORG);
    X.wrap(U1, '1Q', U1, '2CLK', 240, YEL);
    X.src(U1, '1CLK', 'clock', { f: 8 });
    X.probe(U1, '1Q'); X.probe(U1, '2Q');
  }));

  EXAMPLES.push(...list);
})();
