'use strict';
// ===== v13: 74-series / CD4000 logic ICs — part data (pin-outs, behaviour, function tables) =====
// Language-neutral and free of DOM / solver code so that tools/gen-74-docs.js and the tests can load it in Node.
// Pin-outs are the standard DIP connections of the TI SN74xx / SN74LSxx / SN74HCxx / CD4000B data sheets (top view,
// pin 1 at the top left, numbers run down the left side and up the right side).
// ev(S, I, P) is a pure function of the committed state S, the present input levels I and the input levels P at the previous
// committed solver step; it returns { o: {outputPin: 0|1|2(high-Z)}, s: newState (omit when unchanged) }.
// Synchronous inputs (data, enables, J/K …) are taken from P (the value just before the clock edge), asynchronous ones
// (clear, preset, load, latch enable, output enable) from I.
const TTL_PARTS = (() => {
  const Z = 2;
  const P = [];          // all parts, in palette order
  const bits = (n, v) => { const a = []; for (let i = 0; i < n; i++) a.push((v >> i) & 1); return a; };
  const num = (a) => a.reduce((s, b, i) => s + (b ? 1 << i : 0), 0);
  const rise = (I, Pv, n) => !!I[n] && !Pv[n];
  const fall = (I, Pv, n) => !I[n] && !!Pv[n];
  const add = (o) => { o.pins = o.pins.slice(); P.push(o); return o; };
  // ---------- gates ----------
  const gateEv = (list, f) => (S, I) => { const o = {}; for (const [ins, out] of list) o[out] = f(ins.map((n) => I[n])); return { o }; };
  const AND = (a) => (a.every((x) => x) ? 1 : 0), OR = (a) => (a.some((x) => x) ? 1 : 0);
  const FN = { nand: (a) => 1 - AND(a), nor: (a) => 1 - OR(a), and: AND, or: OR, xor: (a) => a[0] ^ a[1], not: (a) => 1 - a[0], buf: (a) => a[0] };
  const Q2 = ['1A', '1B', '1Y', '2A', '2B', '2Y', 'GND', '3Y', '3A', '3B', '4Y', '4A', '4B', 'VCC'];
  const Q2G = [[['1A', '1B'], '1Y'], [['2A', '2B'], '2Y'], [['3A', '3B'], '3Y'], [['4A', '4B'], '4Y']];
  const NOR2 = ['1Y', '1A', '1B', '2Y', '2A', '2B', 'GND', '3A', '3B', '3Y', '4A', '4B', '4Y', 'VCC'];
  const HEX = ['1A', '1Y', '2A', '2Y', '3A', '3Y', 'GND', '4Y', '4A', '5Y', '5A', '6Y', '6A', 'VCC'];
  const HEXG = [1, 2, 3, 4, 5, 6].map((k) => [[k + 'A'], k + 'Y']);
  const T3 = ['1A', '1B', '2A', '2B', '2C', '2Y', 'GND', '3Y', '3A', '3B', '3C', '1Y', '1C', 'VCC'];
  const T3G = [[['1A', '1B', '1C'], '1Y'], [['2A', '2B', '2C'], '2Y'], [['3A', '3B', '3C'], '3Y']];
  const D4 = ['1A', '1B', 'NC', '1C', '1D', '1Y', 'GND', '2Y', '2A', '2B', 'NC', '2C', '2D', 'VCC'];
  const D4G = [[['1A', '1B', '1C', '1D'], '1Y'], [['2A', '2B', '2C', '2D'], '2Y']];
  const gate = (n, grp, en, pins, list, fn, o) => add(Object.assign({ n, grp, en, pins, ev: gateEv(list, FN[fn]), cls: 'gate', icc: 2.4,
    outs: Object.fromEntries(list.map(([, y]) => [y, 'o'])), fnt: null }, o || {}));
  const tt2 = (sym) => ['A B | Y', '0 0 | ' + sym[0], '0 1 | ' + sym[1], '1 0 | ' + sym[2], '1 1 | ' + sym[3]];
  gate('7400', 'gate', 'Quad 2-input NAND', Q2, Q2G, 'nand').fn = ['Y = NOT (A AND B)'].concat(tt2('1110'));
  gate('7402', 'gate', 'Quad 2-input NOR', NOR2, [[['1A', '1B'], '1Y'], [['2A', '2B'], '2Y'], [['3A', '3B'], '3Y'], [['4A', '4B'], '4Y']], 'nor').fn = ['Y = NOT (A OR B)'].concat(tt2('1000'));
  gate('7404', 'gate', 'Hex inverter', HEX, HEXG, 'not', { icc: 6 }).fn = ['Y = NOT A', 'A | Y', '0 | 1', '1 | 0'];
  gate('7407', 'gate', 'Hex buffer, open-collector outputs', HEX, HEXG, 'buf', { icc: 14 }).outs = Object.fromEntries(HEXG.map(([, y]) => [y, 'oc']));
  P[P.length - 1].fn = ['Y = A (open collector: A = 0 pulls Y low, A = 1 leaves Y floating — needs a pull-up resistor)', 'A | Y', '0 | L', '1 | Z (off)'];
  gate('7408', 'gate', 'Quad 2-input AND', Q2, Q2G, 'and', { icc: 4.5 }).fn = ['Y = A AND B'].concat(tt2('0001'));
  gate('7410', 'gate', 'Triple 3-input NAND', T3, T3G, 'nand', { icc: 1.8 }).fn = ['Y = NOT (A AND B AND C)', 'Y = 0 only when A = B = C = 1, otherwise Y = 1'];
  gate('7411', 'gate', 'Triple 3-input AND', T3, T3G, 'and', { icc: 6 }).fn = ['Y = A AND B AND C', 'Y = 1 only when A = B = C = 1'];
  gate('7420', 'gate', 'Dual 4-input NAND', D4, D4G, 'nand', { icc: 1.2 }).fn = ['Y = NOT (A AND B AND C AND D)', 'Y = 0 only when A = B = C = D = 1'];
  gate('7427', 'gate', 'Triple 3-input NOR', T3, T3G, 'nor', { icc: 3 }).fn = ['Y = NOT (A OR B OR C)', 'Y = 1 only when A = B = C = 0'];
  gate('7432', 'gate', 'Quad 2-input OR', Q2, Q2G, 'or', { icc: 5 }).fn = ['Y = A OR B'].concat(tt2('0111'));
  gate('7486', 'gate', 'Quad 2-input exclusive-OR', Q2, Q2G, 'xor', { icc: 6 }).fn = ['Y = A XOR B'].concat(tt2('0110'));
  gate('7414', 'gate', 'Hex Schmitt-trigger inverter', HEX, HEXG, 'not', { icc: 8, schmitt: true }).fn = ['Y = NOT A with hysteresis: Y goes low when A rises above VT+, high when A falls below VT−', 'A | Y', '0 | 1', '1 | 0'];
  gate('74132', 'gate', 'Quad 2-input Schmitt-trigger NAND', Q2, Q2G, 'nand', { icc: 6, schmitt: true }).fn = ['Y = NOT (A AND B) with hysteresis on both inputs'].concat(tt2('1110'));

  // ---------- flip-flops and latches ----------
  const outsOf = (arr, k) => Object.fromEntries(arr.map((n) => [n, k || 'o']));
  // 7474: dual D flip-flop, positive edge, active-low preset / clear
  add({ n: '7474', grp: 'ff', en: 'Dual D flip-flop with preset and clear', cls: 'ff', icc: 4,
    pins: ['/1CLR', '1D', '1CLK', '/1PRE', '1Q', '/1Q', 'GND', '/2Q', '2Q', '/2PRE', '2CLK', '2D', '/2CLR', 'VCC'],
    outs: outsOf(['1Q', '/1Q', '2Q', '/2Q']), init: () => ({ q: [0, 0] }),
    ev(S, I, Pv) {
      const q = S.q.slice(), o = {};
      for (let k = 0; k < 2; k++) {
        const n = k + 1, clr = !I['/' + n + 'CLR'], pre = !I['/' + n + 'PRE'];
        if (clr && pre) { o[n + 'Q'] = 1; o['/' + n + 'Q'] = 1; continue; }   // both active: both outputs high (not stable)
        if (clr) q[k] = 0; else if (pre) q[k] = 1; else if (rise(I, Pv, n + 'CLK')) q[k] = Pv[n + 'D'];
        o[n + 'Q'] = q[k]; o['/' + n + 'Q'] = 1 - q[k];
      }
      return { o, s: { q } };
    },
    fn: ['Q ← D on the rising edge of CLK', '/PRE = 0: Q = 1 · /CLR = 0: Q = 0 (asynchronous) · both low: Q = /Q = 1', '/PRE /CLR CLK D | Q /Q', '0 1 x x | 1 0', '1 0 x x | 0 1', '0 0 x x | 1 1 (not stable)', '1 1 ↑ 0 | 0 1', '1 1 ↑ 1 | 1 0', '1 1 0/1/↓ x | Q0 /Q0'] });
  // 7476: dual JK flip-flop, preset and clear, 16 pin; 74112: dual JK negative-edge, 16 pin (different pin-out)
  const jkEv = (ck) => (S, I, Pv) => {
    const q = S.q.slice(), o = {};
    for (let k = 0; k < 2; k++) {
      const n = k + 1, clr = !I['/' + n + 'CLR'], pre = !I['/' + n + 'PRE'];
      if (clr && pre) { o[n + 'Q'] = 1; o['/' + n + 'Q'] = 1; continue; }
      if (clr) q[k] = 0; else if (pre) q[k] = 1;
      else if (fall(I, Pv, n + 'CLK')) { const j = Pv[n + 'J'], kk = Pv[n + 'K']; if (j && kk) q[k] = 1 - q[k]; else if (j) q[k] = 1; else if (kk) q[k] = 0; }
      o[n + 'Q'] = q[k]; o['/' + n + 'Q'] = 1 - q[k];
    }
    return { o, s: { q } };
  };
  const jkFn = ['J K on the falling edge of CLK: 00 hold · 01 reset (Q = 0) · 10 set (Q = 1) · 11 toggle', '/PRE = 0: Q = 1 · /CLR = 0: Q = 0 (asynchronous, override the clock) · both low: Q = /Q = 1',
    '/PRE /CLR CLK J K | Q /Q', '0 1 x x x | 1 0', '1 0 x x x | 0 1', '1 1 ↓ 0 0 | Q0 /Q0', '1 1 ↓ 0 1 | 0 1', '1 1 ↓ 1 0 | 1 0', '1 1 ↓ 1 1 | toggle'];
  add({ n: '7476', grp: 'ff', en: 'Dual JK flip-flop with preset and clear', cls: 'ff', icc: 6,
    pins: ['1CLK', '/1PRE', '/1CLR', '1J', 'VCC', '2CLK', '/2PRE', '/2CLR', '2J', '/2Q', '2Q', '2K', 'GND', '/1Q', '1Q', '1K'],
    outs: outsOf(['1Q', '/1Q', '2Q', '/2Q']), init: () => ({ q: [0, 0] }), ev: jkEv(), fn: jkFn });
  add({ n: '74112', grp: 'ff', en: 'Dual JK negative-edge-triggered flip-flop with preset and clear', cls: 'ff', icc: 6,
    pins: ['1CLK', '1K', '1J', '/1PRE', '1Q', '/1Q', '/2Q', 'GND', '2Q', '/2PRE', '2J', '2K', '2CLK', '/2CLR', '/1CLR', 'VCC'],
    outs: outsOf(['1Q', '/1Q', '2Q', '/2Q']), init: () => ({ q: [0, 0] }), ev: jkEv(), fn: jkFn });
  const O8 = (k) => [1, 2, 3, 4, 5, 6, 7, 8].map((i) => i + k);
  // 74273 octal D flip-flop with clear
  add({ n: '74273', grp: 'ff', en: 'Octal D flip-flop with clear', cls: 'ff', icc: 17,
    pins: ['/MR', '1Q', '1D', '2D', '2Q', '3Q', '3D', '4D', '4Q', 'GND', 'CP', '5Q', '5D', '6D', '6Q', '7Q', '7D', '8D', '8Q', 'VCC'],
    outs: outsOf(O8('').map((i) => i + 'Q')), init: () => ({ q: new Array(8).fill(0) }),
    ev(S, I, Pv) {
      let q = S.q;
      if (!I['/MR']) q = new Array(8).fill(0); else if (rise(I, Pv, 'CP')) q = O8('').map((i) => Pv[i + 'D']);
      const o = {}; q.forEach((v, i) => { o[(i + 1) + 'Q'] = v; }); return { o, s: { q } };
    },
    fn: ['nQ ← nD on the rising edge of CP; /MR = 0 clears all outputs asynchronously'] });
  // 74373 / 74573: octal transparent latch, 3-state outputs; 74574: octal D flip-flop, 3-state outputs
  const latchEv = (edge) => (S, I, Pv) => {
    let q = S.q; const d = O8('').map((i) => (edge ? Pv[i + 'D'] : I[i + 'D']));
    if (edge ? rise(I, Pv, 'CLK') : I['LE']) q = d;
    const o = {}; q.forEach((v, i) => { o[(i + 1) + 'Q'] = I['/OE'] ? Z : v; }); return { o, s: { q } };
  };
  const Qs = outsOf(O8('').map((i) => i + 'Q'), 'z');
  add({ n: '74373', grp: 'ff', en: 'Octal transparent latch with 3-state outputs', cls: 'latch', icc: 24,
    pins: ['/OE', '1Q', '1D', '2D', '2Q', '3Q', '3D', '4D', '4Q', 'GND', 'LE', '5Q', '5D', '6D', '6Q', '7Q', '7D', '8D', '8Q', 'VCC'],
    outs: Qs, init: () => ({ q: new Array(8).fill(0) }), ev: latchEv(false),
    fn: ['LE = 1: nQ follows nD (transparent) · LE = 0: nQ holds the value that nD had when LE fell', '/OE = 1: all outputs high-impedance (the latch contents are kept)', '/OE LE D | Q', '1 x x | Z', '0 1 0 | 0', '0 1 1 | 1', '0 0 x | Q0'] });
  add({ n: '74573', grp: 'ff', en: 'Octal transparent latch with 3-state outputs (flow-through pin-out)', cls: 'latch', icc: 24,
    pins: ['/OE', '1D', '2D', '3D', '4D', '5D', '6D', '7D', '8D', 'GND', 'LE', '8Q', '7Q', '6Q', '5Q', '4Q', '3Q', '2Q', '1Q', 'VCC'],
    outs: Qs, init: () => ({ q: new Array(8).fill(0) }), ev: latchEv(false),
    fn: ['Same function as the 74373 (LE = 1 transparent, LE = 0 hold, /OE = 1 high-Z) with inputs on one side and outputs on the other'] });
  add({ n: '74574', grp: 'ff', en: 'Octal D flip-flop with 3-state outputs (flow-through pin-out)', cls: 'ff', icc: 24,
    pins: ['/OE', '1D', '2D', '3D', '4D', '5D', '6D', '7D', '8D', 'GND', 'CLK', '8Q', '7Q', '6Q', '5Q', '4Q', '3Q', '2Q', '1Q', 'VCC'],
    outs: Qs, init: () => ({ q: new Array(8).fill(0) }), ev: latchEv(true),
    fn: ['nQ ← nD on the rising edge of CLK; /OE = 1: outputs high-impedance (contents kept)'] });
  // 7475: 4-bit bistable latch (two enables), complementary outputs
  add({ n: '7475', grp: 'ff', en: '4-bit bistable latch', cls: 'latch', icc: 6,
    pins: ['/1Q', '1D', '2D', 'C34', 'VCC', '3D', '4D', '/4Q', '4Q', '3Q', '/3Q', 'GND', 'C12', '/2Q', '2Q', '1Q'],
    outs: outsOf(['1Q', '/1Q', '2Q', '/2Q', '3Q', '/3Q', '4Q', '/4Q']), init: () => ({ q: [0, 0, 0, 0] }),
    ev(S, I) {
      const q = S.q.slice(); for (let k = 0; k < 4; k++) if (I[k < 2 ? 'C12' : 'C34']) q[k] = I[(k + 1) + 'D'];
      const o = {}; q.forEach((v, k) => { o[(k + 1) + 'Q'] = v; o['/' + (k + 1) + 'Q'] = 1 - v; }); return { o, s: { q } };
    },
    fn: ['C12 enables latches 1–2, C34 enables latches 3–4: C = 1: Q follows D · C = 0: Q holds', 'D C | Q /Q', '0 1 | 0 1', '1 1 | 1 0', 'x 0 | Q0 /Q0'] });

  // ---------- counters ----------
  const nib = (q) => ({ QA: q & 1, QB: (q >> 1) & 1, QC: (q >> 2) & 1, QD: (q >> 3) & 1 });
  // 7490 decade counter (÷2 and ÷5), 7493 4-bit binary counter (÷2 and ÷8): negative-edge clocks, gated asynchronous reset
  add({ n: '7490', grp: 'cnt', en: 'Decade counter (divide-by-2 and divide-by-5)', cls: 'cnt', icc: 9,
    pins: ['CKB', 'R0(1)', 'R0(2)', 'NC', 'VCC', 'R9(1)', 'R9(2)', 'QC', 'QB', 'GND', 'QD', 'QA', 'NC', 'CKA'],
    outs: outsOf(['QA', 'QB', 'QC', 'QD']), init: () => ({ a: 0, b: 0 }),
    ev(S, I, Pv) {
      let a = S.a, b = S.b;
      if (I['R9(1)'] && I['R9(2)']) { a = 1; b = 4; } else if (I['R0(1)'] && I['R0(2)']) { a = 0; b = 0; }
      else { if (fall(I, Pv, 'CKA')) a ^= 1; if (fall(I, Pv, 'CKB')) b = (b + 1) % 5; }
      return { o: { QA: a, QB: b & 1, QC: (b >> 1) & 1, QD: (b >> 2) & 1 }, s: { a, b } };
    },
    fn: ['CKA ↓ toggles QA (÷2); CKB ↓ counts QB–QD through 0…4 (÷5). Connect QA to CKB for BCD 0…9 (QD QC QB QA).', 'R0(1) = R0(2) = 1: outputs 0000 · R9(1) = R9(2) = 1: outputs 1001 (R9 has priority)', 'BCD count: 0000 0001 0010 0011 0100 0101 0110 0111 1000 1001 → 0000'] });
  add({ n: '7493', grp: 'cnt', en: '4-bit binary counter (divide-by-2 and divide-by-8)', cls: 'cnt', icc: 9,
    pins: ['CKB', 'R0(1)', 'R0(2)', 'NC', 'VCC', 'NC', 'NC', 'QC', 'QB', 'GND', 'QD', 'QA', 'NC', 'CKA'],
    outs: outsOf(['QA', 'QB', 'QC', 'QD']), init: () => ({ a: 0, b: 0 }),
    ev(S, I, Pv) {
      let a = S.a, b = S.b;
      if (I['R0(1)'] && I['R0(2)']) { a = 0; b = 0; } else { if (fall(I, Pv, 'CKA')) a ^= 1; if (fall(I, Pv, 'CKB')) b = (b + 1) & 7; }
      return { o: { QA: a, QB: b & 1, QC: (b >> 1) & 1, QD: (b >> 2) & 1 }, s: { a, b } };
    },
    fn: ['CKA ↓ toggles QA (÷2); CKB ↓ counts QB–QD through 0…7 (÷8). Connect QA to CKB for a 4-bit binary counter (QD QC QB QA = 0000 … 1111).', 'R0(1) = R0(2) = 1: outputs 0000'] });
  // 74160…74163 synchronous 4-bit counters (160/162 decade, 161/163 binary; 160/161 asynchronous clear, 162/163 synchronous clear)
  const syncCnt = (nn, dec, syncClr, en) => add({ n: nn, grp: 'cnt', en, cls: 'cnt', icc: 19,
    pins: ['/CLR', 'CLK', 'A', 'B', 'C', 'D', 'ENP', 'GND', '/LOAD', 'ENT', 'QD', 'QC', 'QB', 'QA', 'RCO', 'VCC'],
    outs: outsOf(['QA', 'QB', 'QC', 'QD', 'RCO']), init: () => ({ q: 0 }),
    ev(S, I, Pv) {
      let q = S.q; const top = dec ? 9 : 15;
      if (!syncClr && !I['/CLR']) q = 0;
      else if (rise(I, Pv, 'CLK')) {
        if (syncClr && !Pv['/CLR']) q = 0;
        else if (!Pv['/LOAD']) q = Pv.A | (Pv.B << 1) | (Pv.C << 2) | (Pv.D << 3);
        else if (Pv.ENP && Pv.ENT) q = q >= top ? 0 : q + 1;
      }
      const o = nib(q); o.RCO = I.ENT && q === top ? 1 : 0; return { o, s: { q } };
    },
    fn: ['On the rising edge of CLK: /LOAD = 0 loads A–D; else if ENP = ENT = 1 the counter increments' + (dec ? ' (0…9, then 0)' : ' (0…15, then 0)'),
      syncClr ? '/CLR = 0 clears on the next rising clock edge (synchronous)' : '/CLR = 0 clears immediately (asynchronous)',
      'RCO = ENT AND (count = ' + (dec ? '9' : '15') + ') — connect RCO to ENT of the next stage to cascade'] });
  syncCnt('74160', true, false, 'Synchronous decade counter, asynchronous clear');
  syncCnt('74161', false, false, 'Synchronous 4-bit binary counter, asynchronous clear');
  syncCnt('74162', true, true, 'Synchronous decade counter, synchronous clear');
  syncCnt('74163', false, true, 'Synchronous 4-bit binary counter, synchronous clear');
  // 74190 / 74191: synchronous up/down counters with asynchronous load, single clock + D/U
  const udSingle = (nn, dec, en) => add({ n: nn, grp: 'cnt', en, cls: 'cnt', icc: 20,
    pins: ['B', 'QB', 'QA', '/CTEN', 'D/U', 'QC', 'QD', 'GND', 'D', 'C', '/LOAD', 'MAX/MIN', '/RCO', 'CLK', 'A', 'VCC'],
    outs: outsOf(['QA', 'QB', 'QC', 'QD', 'MAX/MIN', '/RCO']), init: () => ({ q: 0 }),
    ev(S, I, Pv) {
      let q = S.q; const top = dec ? 9 : 15;
      if (!I['/LOAD']) q = I.A | (I.B << 1) | (I.C << 2) | (I.D << 3);
      else if (rise(I, Pv, 'CLK') && !Pv['/CTEN']) { if (Pv['D/U']) q = q === 0 ? top : q - 1; else q = q >= top ? 0 : q + 1; }
      const mm = I['D/U'] ? (q === 0 ? 1 : 0) : (q === top ? 1 : 0);
      const o = nib(q); o['MAX/MIN'] = mm; o['/RCO'] = mm && !I['/CTEN'] && !I.CLK ? 0 : 1; return { o, s: { q } };
    },
    fn: ['/LOAD = 0 loads A–D asynchronously. Otherwise on the rising edge of CLK, when /CTEN = 0: D/U = 0 counts up, D/U = 1 counts down (' + (dec ? '0…9' : '0…15') + ', wrapping).',
      'MAX/MIN = 1 at ' + (dec ? '9' : '15') + ' counting up / at 0 counting down · /RCO = 0 while MAX/MIN = 1, /CTEN = 0 and CLK = 0 (ripple clock for the next stage)'] });
  udSingle('74190', true, 'Synchronous up/down decade counter (single clock, D/U)');
  udSingle('74191', false, 'Synchronous up/down 4-bit binary counter (single clock, D/U)');
  // 74192 / 74193: synchronous up/down counters with separate up / down clocks, asynchronous clear and load
  const udDual = (nn, dec, en) => add({ n: nn, grp: 'cnt', en, cls: 'cnt', icc: 19,
    pins: ['B', 'QB', 'QA', 'DOWN', 'UP', 'QC', 'QD', 'GND', 'D', 'C', '/LOAD', '/CO', '/BO', 'CLR', 'A', 'VCC'],
    outs: outsOf(['QA', 'QB', 'QC', 'QD', '/CO', '/BO']), init: () => ({ q: 0 }),
    ev(S, I, Pv) {
      let q = S.q; const top = dec ? 9 : 15;
      if (I.CLR) q = 0;
      else if (!I['/LOAD']) q = I.A | (I.B << 1) | (I.C << 2) | (I.D << 3);
      else if (rise(I, Pv, 'UP') && Pv.DOWN) q = q >= top ? 0 : q + 1;
      else if (rise(I, Pv, 'DOWN') && Pv.UP) q = q === 0 ? top : q - 1;
      const o = nib(q); o['/CO'] = q === top && !I.UP ? 0 : 1; o['/BO'] = q === 0 && !I.DOWN ? 0 : 1; return { o, s: { q } };
    },
    fn: ['CLR = 1 clears asynchronously, /LOAD = 0 loads A–D asynchronously (CLR has priority).', 'Rising edge of UP (with DOWN = 1) counts up, rising edge of DOWN (with UP = 1) counts down (' + (dec ? '0…9' : '0…15') + ', wrapping).',
      '/CO = 0 at the maximum count while UP = 0 · /BO = 0 at count 0 while DOWN = 0 (connect /CO → UP and /BO → DOWN of the next stage)'] });
  udDual('74192', true, 'Synchronous up/down decade counter (dual clock)');
  udDual('74193', false, 'Synchronous up/down 4-bit binary counter (dual clock)');
  // 74393 dual 4-bit binary ripple counter (falling-edge clock, active-high clear)
  add({ n: '74393', grp: 'cnt', en: 'Dual 4-bit binary ripple counter', cls: 'cnt', icc: 8,
    pins: ['1CLK', '1CLR', '1QA', '1QB', '1QC', '1QD', 'GND', '2QD', '2QC', '2QB', '2QA', '2CLR', '2CLK', 'VCC'],
    outs: outsOf(['1QA', '1QB', '1QC', '1QD', '2QA', '2QB', '2QC', '2QD']), init: () => ({ q: [0, 0] }),
    ev(S, I, Pv) {
      const q = S.q.slice(), o = {};
      for (let k = 0; k < 2; k++) { const n = k + 1; if (I[n + 'CLR']) q[k] = 0; else if (fall(I, Pv, n + 'CLK')) q[k] = (q[k] + 1) & 15; ['QA', 'QB', 'QC', 'QD'].forEach((p, i) => { o[n + p] = (q[k] >> i) & 1; }); }
      return { o, s: { q } };
    },
    fn: ['Each counter increments on the falling edge of its CLK (ripple counter, QA = ÷2 … QD = ÷16); CLR = 1 clears it asynchronously'] });
  // CD4017 decade counter / divider with 10 decoded outputs, CD4040 12-stage binary ripple counter
  add({ n: '4017', grp: 'cnt', fam: 'CD', en: 'Decade counter with 10 decoded outputs (CMOS 4000)', cls: 'cnt', icc: 0.5, name: 'CD4017',
    pins: ['Q5', 'Q1', 'Q0', 'Q2', 'Q6', 'Q7', 'Q3', 'VSS', 'Q8', 'Q4', 'Q9', 'CO', 'INH', 'CLK', 'RST', 'VDD'],
    outs: outsOf(['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'CO']), init: () => ({ n: 0 }),
    ev(S, I, Pv) {
      let n = S.n;
      if (I.RST) n = 0; else if (rise(I, Pv, 'CLK') && !Pv.INH) n = (n + 1) % 10;
      const o = { CO: n < 5 ? 1 : 0 }; for (let i = 0; i < 10; i++) o['Q' + i] = n === i ? 1 : 0; return { o, s: { n } };
    },
    fn: ['Rising edge of CLK (INH = 0) advances the counter; exactly one of Q0…Q9 is high · RST = 1 returns to Q0', 'CO is high for counts 0–4 and low for counts 5–9 (÷10 carry output)'] });
  add({ n: '4040', grp: 'cnt', fam: 'CD', en: '12-stage binary ripple counter (CMOS 4000)', cls: 'cnt', icc: 0.5, name: 'CD4040',
    pins: ['Q12', 'Q6', 'Q5', 'Q7', 'Q4', 'Q3', 'Q2', 'VSS', 'Q1', 'CLK', 'RST', 'Q9', 'Q8', 'Q10', 'Q11', 'VDD'],
    outs: outsOf(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11', 'Q12']), init: () => ({ n: 0 }),
    ev(S, I, Pv) {
      let n = S.n; if (I.RST) n = 0; else if (fall(I, Pv, 'CLK')) n = (n + 1) & 4095;
      const o = {}; for (let i = 0; i < 12; i++) o['Q' + (i + 1)] = (n >> i) & 1; return { o, s: { n } };
    },
    fn: ['Falling edge of CLK increments the 12-bit counter (Q1 = ÷2 … Q12 = ÷4096) · RST = 1 clears all outputs'] });

  // ---------- shift registers ----------
  add({ n: '74164', grp: 'sr', en: '8-bit serial-in, parallel-out shift register', cls: 'sr', icc: 16,
    pins: ['A', 'B', 'QA', 'QB', 'QC', 'QD', 'GND', 'CLK', '/CLR', 'QE', 'QF', 'QG', 'QH', 'VCC'],
    outs: outsOf(['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH']), init: () => ({ r: new Array(8).fill(0) }),
    ev(S, I, Pv) {
      let r = S.r; if (!I['/CLR']) r = new Array(8).fill(0); else if (rise(I, Pv, 'CLK')) r = [Pv.A & Pv.B].concat(r.slice(0, 7));
      const o = {}; 'ABCDEFGH'.split('').forEach((l, i) => { o['Q' + l] = r[i]; }); return { o, s: { r } };
    },
    fn: ['Rising edge of CLK: QA ← A AND B, QB ← old QA … QH ← old QG · /CLR = 0 clears all outputs asynchronously'] });
  add({ n: '74165', grp: 'sr', en: '8-bit parallel-load, serial-out shift register', cls: 'sr', icc: 16,
    pins: ['/PL', 'CLK', 'E', 'F', 'G', 'H', '/QH', 'GND', 'QH', 'SER', 'A', 'B', 'C', 'D', 'CLKINH', 'VCC'],
    outs: outsOf(['QH', '/QH']), init: () => ({ r: new Array(8).fill(0) }),
    ev(S, I, Pv) {
      let r = S.r; const L = 'ABCDEFGH'.split('');
      if (!I['/PL']) r = L.map((l) => I[l]); else if (rise(I, Pv, 'CLK') && !Pv.CLKINH) r = [Pv.SER].concat(r.slice(0, 7));
      return { o: { QH: r[7], '/QH': 1 - r[7] }, s: { r } };
    },
    fn: ['/PL = 0 loads A…H asynchronously; /PL = 1: rising edge of CLK (CLKINH = 0) shifts: QH ← old G … B ← A, A ← SER', 'QH = H right after the load, so the first bit shifted out is H (the MSB for shiftIn(…, MSBFIRST)); read QH, then pulse CLK.'] });
  add({ n: '74194', grp: 'sr', en: '4-bit bidirectional universal shift register', cls: 'sr', icc: 15,
    pins: ['/CLR', 'SR', 'A', 'B', 'C', 'D', 'SL', 'GND', 'S0', 'S1', 'CLK', 'QD', 'QC', 'QB', 'QA', 'VCC'],
    outs: outsOf(['QA', 'QB', 'QC', 'QD']), init: () => ({ r: [0, 0, 0, 0] }),
    ev(S, I, Pv) {
      let r = S.r;
      if (!I['/CLR']) r = [0, 0, 0, 0];
      else if (rise(I, Pv, 'CLK')) {
        const m = Pv.S0 | (Pv.S1 << 1);
        if (m === 3) r = [Pv.A, Pv.B, Pv.C, Pv.D]; else if (m === 1) r = [Pv.SR, r[0], r[1], r[2]]; else if (m === 2) r = [r[1], r[2], r[3], Pv.SL];
      }
      return { o: { QA: r[0], QB: r[1], QC: r[2], QD: r[3] }, s: { r } };
    },
    fn: ['Rising edge of CLK, mode S1 S0: 00 hold · 01 shift right (QA → QB → QC → QD, SR enters QA) · 10 shift left (QD → QC → QB → QA, SL enters QD) · 11 parallel load A–D', '/CLR = 0 clears asynchronously'] });
  add({ n: '74595', grp: 'sr', en: '8-bit serial-in shift register with 3-state output latch', cls: 'sr', icc: 16,
    pins: ['QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH', 'GND', "QH'", '/SRCLR', 'SRCLK', 'RCLK', '/OE', 'SER', 'QA', 'VCC'],
    outs: Object.assign(outsOf(['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'], 'z'), { "QH'": 'o' }), init: () => ({ sr: new Array(8).fill(0), st: new Array(8).fill(0) }),
    ev(S, I, Pv) {
      let sr = S.sr, st = S.st;
      if (rise(I, Pv, 'RCLK')) st = S.sr;
      if (!I['/SRCLR']) sr = new Array(8).fill(0); else if (rise(I, Pv, 'SRCLK')) sr = [Pv.SER].concat(S.sr.slice(0, 7));
      const o = { "QH'": sr[7] }; 'ABCDEFGH'.split('').forEach((l, i) => { o['Q' + l] = I['/OE'] ? Z : st[i]; });
      return { o, s: { sr, st } };
    },
    fn: ['Rising edge of SRCLK: shift register QA ← SER, QB ← old QA … · rising edge of RCLK: output register ← shift register', '/OE = 1: QA…QH high-impedance · /SRCLR = 0 clears the shift register (not the output register) · QH′ = last stage of the shift register',
      'Arduino: shiftOut(SER, SRCLK, MSBFIRST, value) then pulse RCLK — bit 7 ends up on QH'] });

  // ---------- decoders, multiplexers ----------
  add({ n: '74138', grp: 'dec', en: '3-to-8 line decoder / demultiplexer', cls: 'dec', icc: 6.3,
    pins: ['A', 'B', 'C', '/G2A', '/G2B', 'G1', '/Y7', 'GND', '/Y6', '/Y5', '/Y4', '/Y3', '/Y2', '/Y1', '/Y0', 'VCC'],
    outs: outsOf(['/Y0', '/Y1', '/Y2', '/Y3', '/Y4', '/Y5', '/Y6', '/Y7']),
    ev(S, I) { const en = I.G1 && !I['/G2A'] && !I['/G2B'], k = I.A | (I.B << 1) | (I.C << 2), o = {}; for (let i = 0; i < 8; i++) o['/Y' + i] = en && k === i ? 0 : 1; return { o }; },
    fn: ['Enabled when G1 = 1 and /G2A = /G2B = 0; the output /Y(CBA) is low, all others high', 'C B A | /Y0 … /Y7: 000 → /Y0 low, 001 → /Y1 low, … 111 → /Y7 low · not enabled: all outputs high'] });
  add({ n: '74139', grp: 'dec', en: 'Dual 2-to-4 line decoder / demultiplexer', cls: 'dec', icc: 6.8,
    pins: ['/1G', '1A', '1B', '/1Y0', '/1Y1', '/1Y2', '/1Y3', 'GND', '/2Y3', '/2Y2', '/2Y1', '/2Y0', '2B', '2A', '/2G', 'VCC'],
    outs: outsOf(['/1Y0', '/1Y1', '/1Y2', '/1Y3', '/2Y0', '/2Y1', '/2Y2', '/2Y3']),
    ev(S, I) { const o = {}; for (const n of [1, 2]) { const en = !I['/' + n + 'G'], k = I[n + 'A'] | (I[n + 'B'] << 1); for (let i = 0; i < 4; i++) o['/' + n + 'Y' + i] = en && k === i ? 0 : 1; } return { o }; },
    fn: ['/G = 0 enables: output /Y(BA) low, the others high · /G = 1: all four outputs high'] });
  add({ n: '74154', grp: 'dec', en: '4-to-16 line decoder / demultiplexer', cls: 'dec', icc: 20,
    pins: ['/Y0', '/Y1', '/Y2', '/Y3', '/Y4', '/Y5', '/Y6', '/Y7', '/Y8', '/Y9', '/Y10', 'GND', '/Y11', '/Y12', '/Y13', '/Y14', '/Y15', '/G1', '/G2', 'D', 'C', 'B', 'A', 'VCC'],
    outs: outsOf(Array.from({ length: 16 }, (_, i) => '/Y' + i)),
    ev(S, I) { const en = !I['/G1'] && !I['/G2'], k = I.A | (I.B << 1) | (I.C << 2) | (I.D << 3), o = {}; for (let i = 0; i < 16; i++) o['/Y' + i] = en && k === i ? 0 : 1; return { o }; },
    fn: ['Enabled when /G1 = /G2 = 0; the output /Y(DCBA) is low, all others high; not enabled: all high'] });
  add({ n: '74153', grp: 'mux', en: 'Dual 4-to-1 data selector / multiplexer', cls: 'mux', icc: 9,
    pins: ['/1G', 'B', '1C3', '1C2', '1C1', '1C0', '1Y', 'GND', '2Y', '2C0', '2C1', '2C2', '2C3', 'A', '/2G', 'VCC'],
    outs: outsOf(['1Y', '2Y']),
    ev(S, I) { const k = I.A | (I.B << 1), o = {}; for (const n of [1, 2]) o[n + 'Y'] = I['/' + n + 'G'] ? 0 : I[n + 'C' + k]; return { o }; },
    fn: ['Select inputs B A (common to both halves) choose C0…C3: Y = C(BA) when /G = 0, Y = 0 when /G = 1'] });
  add({ n: '74151', grp: 'mux', en: '8-to-1 data selector / multiplexer', cls: 'mux', icc: 6,
    pins: ['D3', 'D2', 'D1', 'D0', 'Y', 'W', '/G', 'GND', 'C', 'B', 'A', 'D7', 'D6', 'D5', 'D4', 'VCC'],
    outs: outsOf(['Y', 'W']),
    ev(S, I) { const k = I.A | (I.B << 1) | (I.C << 2), y = I['/G'] ? 0 : I['D' + k]; return { o: { Y: y, W: 1 - y } }; },
    fn: ['Y = D(CBA) when /G = 0 (W = NOT Y) · /G = 1: Y = 0, W = 1'] });
  add({ n: '74157', grp: 'mux', en: 'Quad 2-to-1 data selector / multiplexer', cls: 'mux', icc: 10,
    pins: ['A/B', '1A', '1B', '1Y', '2A', '2B', '2Y', 'GND', '3Y', '3B', '3A', '4Y', '4B', '4A', '/G', 'VCC'],
    outs: outsOf(['1Y', '2Y', '3Y', '4Y']),
    ev(S, I) { const o = {}; for (let k = 1; k <= 4; k++) o[k + 'Y'] = I['/G'] ? 0 : I['A/B'] ? I[k + 'B'] : I[k + 'A']; return { o }; },
    fn: ['A/B = 0 selects the A inputs, A/B = 1 the B inputs; /G = 1 forces all Y low'] });
  // 7447 / 7448: BCD to seven-segment decoder; segments a…g (7447: active low open collector, 7448: active high with 2 kΩ pull-up)
  const SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7c, 0x07, 0x7f, 0x67, 0x58, 0x4c, 0x62, 0x69, 0x78, 0x00];   // a = bit0 … g = bit6
  const segEv = (active) => (S, I) => {
    const d = I.A | (I.B << 1) | (I.C << 2) | (I.D << 3);
    const rbo = !!I['/LT'] && !I['/RBI'] && d === 0;                          // ripple-blanking condition (LT high, RBI low, input 0)
    const bi = !I['/BI'];                                                     // BI/RBO node pulled low from outside (or by itself)
    let m = SEG[d];
    if (bi || rbo) m = 0; else if (!I['/LT']) m = 0x7f;
    const o = {}; 'abcdefg'.split('').forEach((s, i) => { const on = (m >> i) & 1; o[s] = active ? (on ? 1 : 0) : (on ? 0 : 1); });
    o['/BI'] = rbo ? 0 : 1; return { o };
  };
  const segFn = ['Inputs D C B A (BCD 0–9, 10–15 = special symbols) select the segments a…g; /LT = 0 (with /BI high) lights all segments; /BI = 0 blanks all segments; /RBI = 0 blanks a zero and pulls /BI//RBO low (ripple blanking)',
    'Segments on, a…g: 0 abcdef · 1 bc · 2 abdeg · 3 abcdg · 4 bcfg · 5 acdfg · 6 cdefg · 7 abc · 8 abcdefg · 9 abcfg · 10 deg · 11 cdg · 12 bfg · 13 adfg · 14 defg · 15 blank'];
  add({ n: '7447', grp: 'dec', en: 'BCD to seven-segment decoder / driver, active-low open-collector outputs', cls: 'seg', icc: 64, fams: ['TTL', 'LS'], famDef: 'TTL',
    pins: ['B', 'C', '/LT', '/BI', '/RBI', 'D', 'A', 'GND', 'e', 'd', 'c', 'b', 'a', 'g', 'f', 'VCC'],
    outs: Object.assign(outsOf('abcdefg'.split(''), 'oc'), { '/BI': 'oc' }), io: ['/BI'], ev: segEv(false), fn: segFn.concat(['Outputs are open collectors: a segment is ON when its output is LOW (common-anode display, series resistors needed). Sink: 40 mA (7447A) / 24 mA (74LS47).']) });
  add({ n: '7448', grp: 'dec', en: 'BCD to seven-segment decoder / driver, active-high outputs with 2 kΩ pull-ups', cls: 'seg', icc: 53, fams: ['TTL', 'LS'], famDef: 'TTL',
    pins: ['B', 'C', '/LT', '/BI', '/RBI', 'D', 'A', 'GND', 'e', 'd', 'c', 'b', 'a', 'g', 'f', 'VCC'],
    outs: Object.assign(outsOf('abcdefg'.split(''), 'ocp'), { '/BI': 'oc' }), io: ['/BI'], ev: segEv(true), fn: segFn.concat(['Outputs have internal 2 kΩ pull-ups: a segment is ON when its output is HIGH (common-cathode display, ≈ 2 mA through the pull-up). Sink 6.4 mA (7448) / 6 mA (74LS48).']) });

  // ---------- arithmetic ----------
  add({ n: '7483', grp: 'arith', en: '4-bit binary full adder with fast carry', cls: 'arith', icc: 34,
    pins: ['A4', 'S3', 'A3', 'B3', 'VCC', 'S2', 'B2', 'A2', 'S1', 'A1', 'B1', 'GND', 'C0', 'C4', 'S4', 'B4'],
    outs: outsOf(['S1', 'S2', 'S3', 'S4', 'C4']),
    ev(S, I) { const a = I.A1 | (I.A2 << 1) | (I.A3 << 2) | (I.A4 << 3), b = I.B1 | (I.B2 << 1) | (I.B3 << 2) | (I.B4 << 3), s = a + b + I.C0; return { o: { S1: s & 1, S2: (s >> 1) & 1, S3: (s >> 2) & 1, S4: (s >> 3) & 1, C4: (s >> 4) & 1 } }; },
    fn: ['C4 S4 S3 S2 S1 = A4…A1 + B4…B1 + C0 (A1, B1, S1 are the least significant bits)'] });
  add({ n: '7485', grp: 'arith', en: '4-bit magnitude comparator', cls: 'arith', icc: 20,
    pins: ['B3', 'A<B', 'A=B', 'A>B', 'OA>B', 'OA=B', 'OA<B', 'GND', 'B0', 'A0', 'B1', 'A1', 'A2', 'B2', 'A3', 'VCC'],
    outs: outsOf(['OA>B', 'OA=B', 'OA<B']),
    ev(S, I) {
      const a = I.A0 | (I.A1 << 1) | (I.A2 << 2) | (I.A3 << 3), b = I.B0 | (I.B1 << 1) | (I.B2 << 2) | (I.B3 << 3);
      let g = 0, e = 0, l = 0;
      if (a > b) g = 1; else if (a < b) l = 1;
      else if (I['A=B']) e = 1;
      else if (I['A>B'] && I['A<B']) { /* both cascade inputs high, A=B low: all outputs low */ }
      else if (!I['A>B'] && !I['A<B']) { g = 1; l = 1; } else if (I['A>B']) g = 1; else l = 1;
      return { o: { 'OA>B': g, 'OA=B': e, 'OA<B': l } };
    },
    fn: ['A > B: OA>B = 1 · A < B: OA<B = 1 · A = B: the cascade inputs decide (A=B high → OA=B = 1; A>B high → OA>B = 1; A<B high → OA<B = 1)', 'For a single stage tie A=B to VCC and A>B, A<B to GND'] });

  // ---------- bus drivers ----------
  add({ n: '74244', grp: 'bus', en: 'Octal buffer / line driver with 3-state outputs', cls: 'bus', icc: 27, strong: true,
    pins: ['/1G', '1A1', '2Y4', '1A2', '2Y3', '1A3', '2Y2', '1A4', '2Y1', 'GND', '2A1', '1Y4', '2A2', '1Y3', '2A3', '1Y2', '2A4', '1Y1', '/2G', 'VCC'],
    outs: outsOf(['1Y1', '1Y2', '1Y3', '1Y4', '2Y1', '2Y2', '2Y3', '2Y4'], 'z'),
    ev(S, I) { const o = {}; for (const g of [1, 2]) for (let k = 1; k <= 4; k++) o[g + 'Y' + k] = I['/' + g + 'G'] ? Z : I[g + 'A' + k]; return { o }; },
    fn: ['Two groups of four non-inverting buffers: nY = nA when /nG = 0, high-impedance when /nG = 1'] });
  add({ n: '74245', grp: 'bus', en: 'Octal bus transceiver with 3-state outputs', cls: 'bus', icc: 70, strong: true,
    pins: ['DIR', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'GND', 'B8', 'B7', 'B6', 'B5', 'B4', 'B3', 'B2', 'B1', '/OE', 'VCC'],
    outs: Object.assign(outsOf(O8('').map((i) => 'A' + i), 'z'), outsOf(O8('').map((i) => 'B' + i), 'z')), io: O8('').map((i) => 'A' + i).concat(O8('').map((i) => 'B' + i)),
    ev(S, I) { const o = {}; if (!I['/OE']) for (let k = 1; k <= 8; k++) { if (I.DIR) o['B' + k] = I['A' + k]; else o['A' + k] = I['B' + k]; } return { o }; },
    fn: ['/OE = 1: both sides high-impedance (isolated) · /OE = 0 and DIR = 1: A → B · /OE = 0 and DIR = 0: B → A'] });
  const buf = (nn, act, en) => add({ n: nn, grp: 'bus', en, cls: 'bus', icc: 16,
    pins: [act + '1G', '1A', '1Y', act + '2G', '2A', '2Y', 'GND', '3Y', '3A', act + '3G', '4Y', '4A', act + '4G', 'VCC'],
    outs: outsOf(['1Y', '2Y', '3Y', '4Y'], 'z'),
    ev(S, I) { const o = {}; for (let k = 1; k <= 4; k++) { const e = act === '/' ? !I['/' + k + 'G'] : I[k + 'G']; o[k + 'Y'] = e ? I[k + 'A'] : Z; } return { o }; },
    fn: ['Four independent 3-state buffers: Y = A when ' + (act === '/' ? '/G = 0' : 'G = 1') + ', high-impedance otherwise'] });
  buf('74125', '/', 'Quad bus buffer with 3-state outputs (active-low enables)');
  buf('74126', '', 'Quad bus buffer with 3-state outputs (active-high enables)');
  return P;
})();
if (typeof module !== 'undefined') module.exports = TTL_PARTS;
