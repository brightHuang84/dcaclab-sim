'use strict';
// =====================================================================================================================
//  v12 · more microcontroller boards on the v10 runtime (js/mcu.js) and translator (js/mcu-lang.js):
//  Arduino Nano, Arduino Mega 2560, Arduino Pro Mini (5 V/16 MHz or 3.3 V/8 MHz), ESP32 DevKit V1 (30-pin),
//  Raspberry Pi Pico (RP2040), STM32 "Blue Pill" (STM32F103C8) and an 8051 (STC89C52RC / AT89C52, DIP-40).
//  Each board = runtime parameters (pins, ADC / PWM, logic levels, timing) + a part (terminals, supply, drawing).
//  Drawings are original, simplified top views; pin order follows the real boards.
// =====================================================================================================================
(() => {
  const { addBoard, mkConsts, buildPins, measurePins, postMcu, readingsMcu, labelMcu, statusOf } = MCU;
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const C51_BLINK = [
    '// 8051 Blink: an LED from VCC through 1 kOhm to P1.0 (the port can only pull LOW strongly) - on when P1.0 = 0.',
    '#include <reg52.h>',
    '',
    'sbit LED = P1^0;',
    '',
    '// software delay: at 11.0592 MHz one pass of the inner loop takes about 8.7 us, 114 passes = 1 ms',
    'void delay_ms(unsigned int ms) {',
    '  unsigned int i, j;',
    '  for (i = ms; i > 0; i--)',
    '    for (j = 114; j > 0; j--);',
    '}',
    '',
    'void main() {',
    '  while (1) {',
    '    LED = 0;          // on',
    '    delay_ms(500);',
    '    LED = 1;          // off',
    '    delay_ms(500);',
    '  }',
    '}', ''].join('\n');
  const STC = { run: '#2ecc71', off: '#7f8c8d', reset: '#f39c12' };
  const LANG_ARD = [['ino', 'Arduino C/C++'], ['js', 'JavaScript']];
  const pLang = (opts) => ({ k: 'lang', label: '编程语言', lk: 'mcu.p.lang', ok: 'mcu.o.lang', kind: 'select', opts: (opts || LANG_ARD).map((o) => o.slice()), def: 'ino' });
  const pCode = (def) => ({ k: 'code', label: '程序', lk: 'mcu.p.code', kind: 'code', def });
  const pPower = (opts, def) => ({ k: 'power', label: '供电方式', lk: 'mcu.p.power', kind: 'select', opts, def });
  const blink = (head, pinExpr, ms, extra) => [head, 'void setup() {', extra ? '  ' + extra : null, '  pinMode(' + pinExpr + ', OUTPUT);', '}', '', 'void loop() {',
    '  digitalWrite(' + pinExpr + ', HIGH);', '  delay(' + ms + ');', '  digitalWrite(' + pinExpr + ', LOW);', '  delay(' + ms + ');', '}', ''].filter((x) => x !== null).join('\n');

  // ---------------------------------------------------------------- generic board drawing --------------------------
  // spec.rows: [{ y, x0, pitch, pins: [[silk label, terminal index | null, hover name]] , up (labels above the pin) }]
  function layout(spec) {
    const terms = [], names = [];
    for (const r of spec.rows) r.pins.forEach(([lab, ti, nm], i) => {
      if (ti === null || ti === undefined) return;
      const x = r.x !== undefined ? r.x : r.x0 + i * r.pitch, y = r.x !== undefined ? r.y0 + i * r.pitch : r.y;
      terms[ti] = [x, y]; names[ti] = nm || lab;
    });
    return { terms, names };
  }
  function drawBoard(ctx, c, spec, info) {
    const st = c.state, M = c._m, s = statusOf(c), drv = st.drv || [];
    const [x0, y0, x1, y1] = spec.pcb;
    if (spec.dip) {
      ctx.fillStyle = D.vgrad(ctx, y0, y1, [[0, '#3a3a3a'], [0.5, '#1c1c1c'], [1, '#090909']]); D.rrect(ctx, x0, y0, x1 - x0, y1 - y0, 3); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x0, 0, 7, -Math.PI / 2, Math.PI / 2); ctx.fill();
      ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(x0 + 10, y1 - 9, 2.4, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = D.vgrad(ctx, y0, y1, spec.grad); D.rrect(ctx, x0, y0, x1 - x0, y1 - y0, spec.rad || 6); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
    }
    if (spec.under) spec.under(ctx, c);
    // header pins
    for (const r of spec.rows) r.pins.forEach(([lab, ti], i) => {
      const x = r.x !== undefined ? r.x : r.x0 + i * r.pitch, y = r.x !== undefined ? r.y0 + i * r.pitch : r.y;
      if (spec.dip) { D.lead(ctx, x, y, x, y + (y > 0 ? -12 : 12)); return; }
      ctx.fillStyle = ti === null ? '#2a2a2a' : '#111'; ctx.fillRect(x - 6, y - 6, 12, 12);
      ctx.fillStyle = ti === null ? '#6d6d6d' : '#d4af37'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
    });
    if (spec.over) spec.over(ctx, c, s);
    // pin activity dots next to the logical pins (red high, blue low, purple PWM)
    const B = MCU.BOARDS[c.type];
    for (let p = 0; p < B.n; p++) {
      const ti = B.term(p), d = drv[p]; if (ti >= DEFS[c.type].terms.length || d === undefined || d < 0) continue;
      const [x, y] = DEFS[c.type].terms[ti], col = d >= 0.999 ? '#ff4040' : d <= 0.001 ? '#3a7bff' : '#c060ff';
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 7, y + (y < 0 ? 9 : -9), 2.2, 0, 7); ctx.fill();
    }
    D.upright(ctx, c, 0, 0, (ctx) => {
      for (const r of spec.rows) r.pins.forEach(([lab], i) => {
        const x = r.x !== undefined ? r.x : r.x0 + i * r.pitch, y = r.x !== undefined ? r.y0 + i * r.pitch : r.y;
        if (r.x !== undefined) txt(ctx, lab, x + (r.lx || -14), y, 'bold 6px sans-serif', spec.dip ? '#bbb' : '#fff', r.lx > 0 ? 'left' : 'right');
        else txt(ctx, lab, x, y + (r.ly !== undefined ? r.ly : (y < 0 ? 12 : -12)), 'bold ' + (r.fs || 6) + 'px sans-serif', spec.dip ? '#bbb' : '#fff');
      });
      if (spec.text) spec.text(ctx, c, s);
      const col = STC[s] || '#e74c3c', rt = st.rt, lab = s === 'run' ? 'RUN' : s === 'off' ? 'OFF' : s === 'reset' ? 'RESET' : 'ERR L' + rt.err.line;
      const [bx, by] = spec.badge;
      ctx.fillStyle = col; D.rrect(ctx, bx - 26, by - 8, 52, 16, 4); ctx.fill();
      txt(ctx, lab, bx, by, 'bold 8px sans-serif', '#fff');
      if (c.props.lang === 'js') txt(ctx, 'JS', bx + 36, by, 'bold 8px sans-serif', '#ffe680');
    });
    for (const L of spec.leds || []) {
      const b = L.on(c, M, st); ctx.fillStyle = b > 0.05 ? L.col : U.rgba(L.col, 0.25); ctx.fillRect(L.x - 4, L.y - 3, 8, 6);
      if (b > 0.05) glow(ctx, L.x, L.y, 10 + 5 * b, L.col, Math.min(1, b));
    }
    D.upright(ctx, c, 0, 0, (ctx) => { for (const L of spec.leds || []) if (L.lab) txt(ctx, L.lab, L.x, L.y + (L.ly || 8), 'bold 5px sans-serif', '#eee'); });
  }
  const usbDraw = (ctx, x, y, w, h) => { ctx.fillStyle = D.vgrad(ctx, y, y + h, [[0, '#f0f2f4'], [0.5, '#b9bec4'], [1, '#80868d']]); ctx.fillRect(x, y, w, h); ctx.fillStyle = '#5b6066'; ctx.fillRect(x + w * 0.2, y + h * 0.3, w * 0.6, h * 0.4); };
  const chipDraw = (ctx, x, y, w, h, lab, sub2, qfp) => {
    if (qfp) { ctx.fillStyle = '#9aa0a6'; for (let k = 0; k < 8; k++) { ctx.fillRect(x + 4 + k * (w - 8) / 8, y - 3, 2, 3); ctx.fillRect(x + 4 + k * (w - 8) / 8, y + h, 2, 3); ctx.fillRect(x - 3, y + 4 + k * (h - 8) / 8, 3, 2); ctx.fillRect(x + w, y + 4 + k * (h - 8) / 8, 3, 2); } }
    ctx.fillStyle = D.vgrad(ctx, y, y + h, [[0, '#333'], [1, '#0d0d0d']]); D.rrect(ctx, x, y, w, h, 2); ctx.fill();
  };
  const ledL = (x, y, col, lab, f) => ({ x, y, col, lab, on: f });
  const onLed = (min) => (c, M) => ((M.Vcc || 0) > min ? 1 : 0);
  const ledCur = (key, iFull) => (c, M) => U.clamp(Math.max(0, M[key] || 0) / iFull, 0, 1.2);
  const txLed = (c, M, st) => (st.rt && st.rt.txT >= 0 && (st.rt.tp - st.rt.txT) < 0.06 ? 1 : 0);

  // standard measure: pin source currents + board load, supply current from the USB source if present
  function stdMeasure(c, m, load) {
    const n = c._nodes, M = c._m, src = measurePins(c, m);
    M.IL = c._ld ? c._ld.i : 0;
    M.I = c._usb ? -c._usb.i : (M.Vcc || 0) * load + src + Math.max(M.IL, 0);
    M.V = M.Vcc; M.P = Math.abs(M.V * M.I);
  }
  // held in reset while a reset-type pin is below 0.3·VCC (active-low) or above 0.6·VCC (active-high, 8051)
  const heldLow = (ti) => (c, app, vcc) => vcc > 1 && app.net.v(c._nodes[ti]) - app.net.v(c._nodes[MCU.BOARDS[c.type].gnd]) < 0.3 * vcc;

  // ================================================================ Arduino Nano ===================================
  // ATmega328P, 5 V / 16 MHz. Header (USB end first): 1 TX1 … 15 D12 on one side, 30 VIN … 16 D13 on the other.
  {
    const names = [...range(0, 13).map((i) => 'D' + i), ...range(0, 7).map((i) => 'A' + i)];
    addBoard('nano', {
      n: 22, names, term: (p) => p, pwm: { 3: 490, 5: 980, 6: 980, 9: 490, 10: 490, 11: 490 },
      adc: (p) => (p >= 14 && p <= 21 ? p : p >= 0 && p <= 7 ? p + 14 : -1),
      pinOf: (p) => (p >= 0 && p < 22 ? p : -1), anaOnly: { 20: 'A6', 21: 'A7' }, vcc: 22, gnd: 25,
      consts: mkConsts({ LED_BUILTIN: 13, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, A6: 20, A7: 21, SDA: 18, SCL: 19 }),
      jsConsts: { LED_BUILTIN: 13, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, A6: 20, A7: 21 },
    });
    const top = [['TX1', 1, 'D1 TX'], ['RX0', 0, 'D0 RX'], ['RST', null], ['GND', 25, 'GND'], ...range(2, 12).map((i) => [(([3, 5, 6, 9, 10, 11].includes(i)) ? '~' : '') + 'D' + i, i, 'D' + i + ([3, 5, 6, 9, 10, 11].includes(i) ? ' ~PWM' : '')])];
    const bot = [['VIN', 24, 'VIN'], ['GND', 26, 'GND'], ['RST', null], ['5V', 22, '5V'], ['A7', 21, 'A7 ADC'], ['A6', 20, 'A6 ADC'], ['A5', 19, 'A5 SCL'], ['A4', 18, 'A4 SDA'], ['A3', 17], ['A2', 16], ['A1', 15], ['A0', 14], ['REF', null], ['3V3', 23, '3V3'], ['D13', 13, 'D13 LED']];
    const spec = { pcb: [-160, -62, 170, 62], grad: [[0, '#1f5fa8'], [1, '#123d70']], badge: [-20, 0],
      rows: [{ y: -50, x0: -140, pitch: 20, pins: top }, { y: 50, x0: -140, pitch: 20, pins: bot }],
      under(ctx) { usbDraw(ctx, 156, -16, 30, 32); chipDraw(ctx, 30, -18, 36, 36, '', '', true); ctx.fillStyle = '#ddd'; ctx.fillRect(-140, -7, 14, 14); ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.arc(-133, 0, 4, 0, 7); ctx.fill(); },
      text(ctx) { txt(ctx, 'NANO', -86, 2, 'italic bold 16px sans-serif', '#fff'); txt(ctx, 'ATmega328P', 48, 0, 'bold 5px sans-serif', '#ccc'); },
      leds: [ledL(100, -14, '#4dff6a', 'ON', onLed(4)), ledL(100, 10, '#ffb020', 'L', ledCur('IL', 0.003)), ledL(124, -14, '#ffe14d', 'TX', txLed)] };
    const L = layout(spec);
    DEFS.nano = {
      name: 'Arduino Nano 开发板', en: 'Arduino Nano Board', cat: 'mcu', desig: 'U', mcu: true, innerShort: true,
      desc: 'Arduino Nano：ATmega328P，16 MHz，5 V 逻辑。D0–D13（~ 为 PWM），A0–A7 模拟输入（A6/A7 只能作模拟输入），D13 接板载 LED。USB 供电，或 VIN 接 7–12 V。',
      terms: L.terms, termNames: L.names, box: [-162, -64, 188, 64],
      props: [pPower([['usb', 'USB 供电 (5 V)'], ['ext', '外部供电 (VIN 或 5V 引脚)']], 'usb'), pLang(), pCode(MCU.BLINK_UNO)],
      shorted: () => [[25, 26]], label: (c) => labelMcu(c),
      build(c, n, m) {
        const st = c.state, V5 = n[22], V33 = n[23], VIN = n[24], G = n[25];
        if (c.props.power === 'usb') { c._usb = m.addV(V5, G, () => 5, 0.1); m.addR(VIN, G, 1e-7); }
        else { c._usb = null; m.addNL('linreg', [VIN, V5, G], { Vref: 5, Vdo: 1.1, Ro: 0.005, Ilim: 0.8, Iq: 0.005 }, sub(st, 'reg')); }
        m.addNL('linreg', [V5, V33, G], { Vref: 3.3, Vdo: 0.3, Ro: 0.005, Ilim: 0.05, Iq: 1e-4 }, sub(st, 'r33'));   // 3.3 V from the USB-serial chip, ≈ 50 mA
        m.addR(V5, G, 1 / 250);                                               // board ≈ 20 mA
        const x = m.newNode(); m.addR(n[13], x, 1 / 1000); c._ld = m.addD(x, G, ledIs(2.0), 2 * VT, sub(st, 'L'));
        buildPins(c, n, m, V5, G); c._p = null;
      },
      measure(c, m) { stdMeasure(c, m, 1 / 250); },
      post: postMcu, readings: readingsMcu,
      draw(ctx, c) { drawBoard(ctx, c, spec); },
    };
  }

  // ================================================================ Arduino Mega 2560 ==============================
  {
    const names = [...range(0, 53).map((i) => 'D' + i), ...range(0, 15).map((i) => 'A' + i)];
    const pwm = {}; for (const p of [...range(2, 13), 44, 45, 46]) pwm[p] = p === 4 || p === 13 ? 980 : 490;
    const aK = {}; for (let i = 0; i < 16; i++) aK['A' + i] = 54 + i;
    addBoard('mega', {
      n: 70, names, term: (p) => p, pwm,
      adc: (p) => (p >= 54 && p <= 69 ? p : p >= 0 && p <= 15 ? p + 54 : -1),
      pinOf: (p) => (p >= 0 && p < 70 ? p : -1), vcc: 70, gnd: 73, i2c: [20, 21],
      consts: mkConsts(Object.assign({ LED_BUILTIN: 13, SDA: 20, SCL: 21 }, aK)),
      jsConsts: Object.assign({ LED_BUILTIN: 13 }, aK),
    });
    const pw = (i) => (pwm[i] ? '~' : '');
    const nm = (i) => 'D' + i + (pwm[i] ? ' ~PWM' : '') + (i === 13 ? ' LED' : '') + ({ 0: ' RX0', 1: ' TX0', 14: ' TX3', 15: ' RX3', 16: ' TX2', 17: ' RX2', 18: ' TX1', 19: ' RX1', 20: ' SDA', 21: ' SCL', 50: ' MISO', 51: ' MOSI', 52: ' SCK', 53: ' SS' }[i] || '');
    const top = [['AREF', null], ['GND', 73, 'GND'], ...[13, 12, 11, 10, 9, 8].map((i) => [pw(i) + i, i, nm(i)]), ['', null], ...[7, 6, 5, 4, 3, 2, 1, 0].map((i) => [pw(i) + i + (i === 1 ? 'TX' : i === 0 ? 'RX' : ''), i, nm(i)]), ['', null],
      ...[14, 15, 16, 17, 18, 19, 20, 21].map((i) => [String(i), i, nm(i)])];
    const bot = [['IORF', null], ['RST', null], ['3V3', 71, '3.3V'], ['5V', 70, '5V'], ['GND', 74, 'GND'], ['GND', 75, 'GND'], ['VIN', 72, 'VIN'], ['', null], ...range(0, 7).map((i) => ['A' + i, 54 + i, 'A' + i]), ['', null], ...range(8, 15).map((i) => ['A' + i, 54 + i, 'A' + i])];
    const dl = [['5V', 78, '5V'], ...range(0, 15).map((k) => [String(22 + 2 * k), 22 + 2 * k, nm(22 + 2 * k)]), ['GND', 76, 'GND']];
    const dr = [['5V', null], ...range(0, 15).map((k) => [String(23 + 2 * k), 23 + 2 * k, nm(23 + 2 * k)]), ['GND', 77, 'GND']];
    const spec = { pcb: [-300, -200, 300, 200], grad: [[0, '#13808f'], [1, '#0a5a66']], rad: 10, badge: [-160, 20],
      rows: [{ y: -180, x0: -260, pitch: 20, pins: top }, { y: 180, x0: -240, pitch: 20, pins: bot }, { x: 260, y0: -150, pitch: 20, pins: dl, lx: -10 }, { x: 280, y0: -150, pitch: 20, pins: dr, lx: 10 }],
      under(ctx) { usbDraw(ctx, -316, -150, 58, 48); ctx.fillStyle = D.vgrad(ctx, 40, 100, [[0, '#3a3a3a'], [1, '#0a0a0a']]); D.rrect(ctx, -312, 40, 60, 60, 4); ctx.fill();
        chipDraw(ctx, -20, -40, 110, 110, '', '', true); ctx.fillStyle = '#ddd'; ctx.fillRect(-250, -150, 16, 16); ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.arc(-242, -142, 5, 0, 7); ctx.fill(); },
      text(ctx) { txt(ctx, 'MEGA 2560', -140, -40, 'italic bold 26px sans-serif', '#fff'); txt(ctx, 'ATmega2560', 35, 15, 'bold 9px sans-serif', '#cfcfcf');
        txt(ctx, 'PWM', -150, -156, 'bold 7px sans-serif', '#d8f0f2'); txt(ctx, 'COMMUNICATION', 150, -156, 'bold 7px sans-serif', '#d8f0f2'); txt(ctx, 'POWER', -180, 156, 'bold 7px sans-serif', '#d8f0f2'); txt(ctx, 'ANALOG IN', 70, 156, 'bold 7px sans-serif', '#d8f0f2'); txt(ctx, 'DIGITAL', 270, -170, 'bold 7px sans-serif', '#d8f0f2'); },
      leds: [ledL(-200, -110, '#4dff6a', 'ON', onLed(4)), ledL(-200, -90, '#ffb020', 'L', ledCur('IL', 0.003)), ledL(-200, -70, '#ffe14d', 'TX', txLed)] };
    const L = layout(spec);
    DEFS.mega = {
      name: 'Arduino Mega 2560 开发板', en: 'Arduino Mega 2560 Board', cat: 'mcu', desig: 'U', mcu: true, innerShort: true,
      desc: 'Arduino Mega 2560：ATmega2560，16 MHz，5 V 逻辑。D0–D53（PWM：D2–D13、D44–D46），A0–A15 共 16 路 10 位模拟输入，4 个硬件串口（Serial1–3 只在资料中说明，仿真只有 Serial），D13 接板载 LED。',
      terms: L.terms, termNames: L.names, box: [-318, -202, 302, 202],
      props: [pPower([['usb', 'USB 供电 (5 V)'], ['ext', '外部供电 (VIN 或 5V 引脚)']], 'usb'), pLang(), pCode(MCU.BLINK_UNO)],
      shorted: () => [[73, 74], [74, 75], [75, 76], [76, 77], [70, 78]], label: (c) => labelMcu(c),
      build(c, n, m) {
        const st = c.state, V5 = n[70], V33 = n[71], VIN = n[72], G = n[73];
        if (c.props.power === 'usb') { c._usb = m.addV(V5, G, () => 5, 0.1); m.addR(VIN, G, 1e-7); }
        else { c._usb = null; m.addNL('linreg', [VIN, V5, G], { Vref: 5, Vdo: 1.1, Ro: 0.005, Ilim: 0.8, Iq: 0.005 }, sub(st, 'reg')); }
        m.addNL('linreg', [V5, V33, G], { Vref: 3.3, Vdo: 0.3, Ro: 0.005, Ilim: 0.15, Iq: 1e-4 }, sub(st, 'r33'));
        m.addR(V5, G, 1 / 90);                                                // board + ATmega16U2 ≈ 55 mA
        const x = m.newNode(); m.addR(n[13], x, 1 / 1000); c._ld = m.addD(x, G, ledIs(2.0), 2 * VT, sub(st, 'L'));
        buildPins(c, n, m, V5, G); c._p = null;
      },
      measure(c, m) { stdMeasure(c, m, 1 / 90); },
      post: postMcu, readings: readingsMcu,
      draw(ctx, c) { drawBoard(ctx, c, spec); },
    };
  }

  // ================================================================ Arduino Pro Mini ===============================
  {
    const names = [...range(0, 13).map((i) => 'D' + i), ...range(0, 7).map((i) => 'A' + i)];
    const PWM16 = { 3: 490, 5: 980, 6: 980, 9: 490, 10: 490, 11: 490 }, PWM8 = { 3: 245, 5: 490, 6: 490, 9: 245, 10: 245, 11: 245 };
    const B = addBoard('promini', {
      n: 22, names, term: (p) => p, pwm: PWM16,
      adc: (p) => (p >= 14 && p <= 21 ? p : p >= 0 && p <= 7 ? p + 14 : -1),
      pinOf: (p) => (p >= 0 && p < 22 ? p : -1), anaOnly: { 20: 'A6', 21: 'A7' }, vcc: 22, gnd: 24,
      consts: mkConsts({ LED_BUILTIN: 13, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, A6: 20, A7: 21, SDA: 18, SCL: 19 }),
      jsConsts: { LED_BUILTIN: 13, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, A6: 20, A7: 21 },
    });
    // the 3.3 V / 8 MHz version: half the clock → instructions and PWM run at half speed (millis() stays exact)
    B.forProps = (p) => (p.variant === '3v8' ? Object.assign(Object.create(B), { tpBack: 2 * B.tpBack, tpIo: 2 * B.tpIo, pwm: PWM8 }) : B);
    const v = (c) => (c.props.variant === '3v8' ? 3.3 : 5);
    const top = [['TXO', 1, 'D1 TX'], ['RXI', 0, 'D0 RX'], ['RST', null], ['GND', 24, 'GND'], ...range(2, 9).map((i) => [String(i), i, 'D' + i + (PWM16[i] ? ' ~PWM' : '')])];
    const bot = [['RAW', 23, 'RAW'], ['GND', 25, 'GND'], ['RST', null], ['VCC', 22, 'VCC'], ['A3', 17], ['A2', 16], ['A1', 15], ['A0', 14], ['13', 13, 'D13 LED'], ['12', 12, 'D12'], ['11', 11, 'D11 ~PWM'], ['10', 10, 'D10 ~PWM']];
    const inner = [['A4', 18, 'A4 SDA'], ['A5', 19, 'A5 SCL'], ['A6', 20, 'A6 ADC'], ['A7', 21, 'A7 ADC']];
    const spec = { pcb: [-128, -62, 128, 62], grad: [[0, '#d0302b'], [1, '#8f1c18']], badge: [70, -8],
      rows: [{ y: -50, x0: -110, pitch: 20, pins: top }, { y: 50, x0: -110, pitch: 20, pins: bot }, { y: 10, x0: -90, pitch: 20, pins: inner, ly: -11, fs: 5 }],
      under(ctx) { chipDraw(ctx, 14, -26, 30, 30, '', '', true); ctx.fillStyle = '#ddd'; ctx.fillRect(-120, -12, 12, 12); ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.arc(-114, -6, 3.5, 0, 7); ctx.fill(); },
      text(ctx, c) { txt(ctx, 'Pro Mini', -40, -22, 'italic bold 11px sans-serif', '#fff'); txt(ctx, c.props.variant === '3v8' ? '3.3V 8MHz' : '5V 16MHz', 70, 10, 'bold 7px sans-serif', '#ffe'); },
      leds: [ledL(104, -24, '#4dff6a', 'PWR', onLed(2.7)), ledL(104, 24, '#ffb020', 'L', ledCur('IL', 0.002))] };
    const L = layout(spec);
    DEFS.promini = {
      name: 'Arduino Pro Mini 开发板', en: 'Arduino Pro Mini Board', cat: 'mcu', desig: 'U', mcu: true, innerShort: true,
      desc: 'Arduino Pro Mini：ATmega328P，5 V/16 MHz 或 3.3 V/8 MHz 两种版本。没有 USB 口，通过 USB 转串口模块供电下载，或从 RAW 接最高 12 V（板载稳压器），或 VCC 直接接稳压电源。A4/A5/A6/A7 在板子内侧焊盘，A6/A7 只能作模拟输入。',
      terms: L.terms, termNames: L.names, box: [-130, -64, 130, 64],
      props: [
        { k: 'variant', label: '版本', lk: 'mcu.p.variant', ok: 'mcu.o.variant', kind: 'select', opts: [['5v16', '5 V / 16 MHz'], ['3v8', '3.3 V / 8 MHz']], def: '5v16' },
        pPower([['ftdi', 'USB 转串口模块供电 (VCC)'], ['ext', '外部供电 (RAW 或 VCC 引脚)']], 'ftdi'), pLang(), pCode(MCU.BLINK_UNO)],
      shorted: () => [[24, 25]], label: (c) => labelMcu(c),
      build(c, n, m) {
        const st = c.state, VCC = n[22], RAW = n[23], G = n[24], V = v(c);
        if (c.props.power === 'ftdi') { c._usb = m.addV(VCC, G, () => V, 0.1); m.addR(RAW, G, 1e-7); }
        else { c._usb = null; m.addNL('linreg', [RAW, VCC, G], { Vref: V, Vdo: 0.17, Ro: 0.005, Ilim: 0.15, Iq: 1e-4 }, sub(st, 'reg')); }
        m.addR(VCC, G, V === 5 ? 1 / 1000 : 1 / 1100);                        // ≈ 5 mA / 3 mA (power LED + chip)
        const x = m.newNode(); m.addR(n[13], x, 1 / 330); c._ld = m.addD(x, G, ledIs(2.0), 2 * VT, sub(st, 'L'));
        buildPins(c, n, m, VCC, G); c._p = null;
      },
      measure(c, m) { stdMeasure(c, m, 1 / 1000); },
      post: postMcu, readings: readingsMcu,
      draw(ctx, c) { drawBoard(ctx, c, spec); },
    };
  }

  // ================================================================ ESP32 DevKit V1 (30-pin) ======================
  // ESP32-WROOM-32 module, 3.3 V logic.  Pin numbers are GPIO numbers.  GPIO6–11 drive the module's flash (not on
  // the header), GPIO34–39 are input-only (no pull resistors), DAC on GPIO25/26, 10 capacitive touch pins.
  {
    const G = [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39];
    const ix = (g) => G.indexOf(g);
    const ADC = [36, 39, 32, 33, 34, 35, 4, 0, 2, 15, 13, 12, 14, 27, 25, 26];
    const TOUCH = [4, 0, 2, 15, 13, 12, 14, 27, 33, 32];                    // T0 … T9
    const consts = { LED_BUILTIN: 2, INPUT_PULLDOWN: 3, SDA: 21, SCL: 22, DAC1: 25, DAC2: 26, TX: 1, RX: 3,
      A0: 36, A3: 39, A4: 32, A5: 33, A6: 34, A7: 35, A10: 4, A11: 0, A12: 2, A13: 15, A14: 13, A15: 12, A16: 14, A17: 27, A18: 25, A19: 26 };
    TOUCH.forEach((g, i) => { consts['T' + i] = g; });
    for (const g of G) consts['D' + g] = g;                                  // silkscreen names (D2, D4 …) of the DevKit
    const touchIx = {}; TOUCH.forEach((g, i) => { touchIx[ix(g)] = i; });
    addBoard('esp32', {
      n: G.length, names: G.map((g) => 'GPIO' + g), term: (p) => (p === 0 ? 30 : p - 1), pwm: {}, pwmAll: 1, pwmFreq: 1000,
      adc: (p) => (ADC.includes(p) ? ix(p) : -1), pinOf: (p) => ix(p), flash: [6, 7, 8, 9, 10, 11],
      vcc: 27, gnd: 28, i2c: [ix(21), ix(22)], label: (n) => 'GPIO ' + n,
      rOut: 40, rPu: 45e3, rPd: 45e3, vil: 0.25, vih: 0.75, vBoot: 2.6, vOff: 2.43, iMax: 0.04,
      tpBack: 2e-8, tpIo: 1e-6, tpAdc: 1e-5, adcBits: 12, adcRef: 3.3, res: true, intRange: 32,
      inOnly: [34, 35, 36, 39].map(ix), dac: [ix(25), ix(26)], touch: touchIx,
      consts: mkConsts(consts), jsConsts: Object.assign({}, consts),
    });
    // 32-bit int constants (GPIO numbers fit 16 bit anyway)
    const B = MCU.BOARDS.esp32;
    const lab = (g) => ({ 36: 'VP', 39: 'VN', 1: 'TX0', 3: 'RX0', 17: 'TX2', 16: 'RX2' }[g] || 'D' + g);
    const nm = (g) => 'GPIO' + g + (ADC.includes(g) ? ' ADC' + ([32, 33, 34, 35, 36, 39].includes(g) ? '1' : '2') : '') + ([34, 35, 36, 39].includes(g) ? ' IN' : '') +
      (g === 25 || g === 26 ? ' DAC' + (g - 24) : '') + (TOUCH.includes(g) ? ' T' + TOUCH.indexOf(g) : '') + (g === 2 ? ' LED' : '') + (g === 21 ? ' SDA' : g === 22 ? ' SCL' : '') + (g === 0 ? ' BOOT' : '');
    const T = (g) => B.term(ix(g));
    const top = [['EN', 25, 'EN / RST'], ...[36, 39, 34, 35, 32, 33, 25, 26, 27, 14, 12, 13].map((g) => [lab(g), T(g), nm(g)]), ['GND', 29, 'GND'], ['VIN', 26, 'VIN 5V']];
    const bot = [...[23, 22, 1, 3, 21, 19, 18, 5, 17, 16, 4, 2, 15].map((g) => [lab(g), T(g), nm(g)]), ['GND', 28, 'GND'], ['3V3', 27, '3V3']];
    const spec = { pcb: [-156, -66, 172, 66], grad: [[0, '#2b2b2b'], [1, '#111']], badge: [100, 0],
      rows: [{ y: -54, x0: -140, pitch: 20, pins: top }, { y: 54, x0: -140, pitch: 20, pins: bot }],
      under(ctx) {
        ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-172, -34, 24, 68);                        // PCB antenna end of the module
        ctx.fillStyle = D.vgrad(ctx, -36, 36, [[0, '#d9dde1'], [1, '#9aa1a8']]); D.rrect(ctx, -146, -34, 120, 68, 3); ctx.fill();   // metal shield
        ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-168, -28); for (let k = 0; k < 6; k++) { ctx.lineTo(-168 + (k % 2) * 14, -28 + 10 * k); } ctx.stroke();
        usbDraw(ctx, 156, -14, 26, 28);
        for (const x of [6, 134]) { ctx.fillStyle = '#ddd'; ctx.fillRect(x - 7, 8, 14, 12); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(x, 14, 3.5, 0, 7); ctx.fill(); }
      },
      text(ctx) { txt(ctx, 'ESP32-WROOM-32', -86, -6, 'bold 9px sans-serif', '#333'); txt(ctx, 'ESP32 DEVKIT V1', 50, -30, 'bold 8px sans-serif', '#eee'); txt(ctx, 'EN', 6, 26, 'bold 5px sans-serif', '#eee'); txt(ctx, 'BOOT', 134, 26, 'bold 5px sans-serif', '#eee'); },
      leds: [ledL(40, -10, '#ff3030', 'PWR', onLed(2.5)), ledL(40, 10, '#3d8bff', 'D2', ledCur('IL', 0.0008))] };
    const L = layout(spec);
    DEFS.esp32 = {
      name: 'ESP32 开发板 (DevKit V1 30 针)', en: 'ESP32 DevKit V1 (30-pin)', cat: 'mcu', desig: 'U', mcu: true, innerShort: true,
      desc: 'ESP32 DevKit V1：ESP32-WROOM-32 模组，3.3 V 逻辑（引脚不耐 5 V），引脚号即 GPIO 号。12 位 ADC（ADC1：GPIO32–39；ADC2 在 WiFi 开启时不能用），GPIO34–39 只能输入，DAC 在 GPIO25/26，任意输出脚可 PWM，GPIO2 接蓝色 LED。仿真不含 WiFi/蓝牙。',
      terms: L.terms, termNames: L.names, box: [-174, -68, 184, 68],
      props: [pPower([['usb', 'USB 供电 (5 V)'], ['ext', '外部供电 (VIN 或 3V3 引脚)']], 'usb'),
        { k: 'touch', label: '手指触摸的触摸引脚', lk: 'mcu.p.touch', ok: 'mcu.o.touch', kind: 'select', opts: [['none', '无'], ...TOUCH.map((g, i) => [String(ix(g)), 'T' + i + ' (GPIO' + g + ')'])], def: 'none' },
        pLang(), pCode(blink('// Blink: the blue LED on GPIO2 of the DevKit turns on and off every half second.', 'LED_BUILTIN', 500))],
      shorted: () => [[28, 29]], label: (c) => labelMcu(c),
      build(c, n, m) {
        const st = c.state, VIN = n[26], V33 = n[27], G0 = n[28];
        n[30] = m.newNode();                                                  // GPIO0: BOOT button only (not on the header)
        if (c.props.power === 'usb') { c._usb = m.addV(VIN, G0, () => 5, 0.3); } else c._usb = null;   // USB 5 V (through the board's diode)
        c._reg = m.addNL('linreg', [VIN, V33, G0], { Vref: 3.3, Vdo: 1.1, Ro: 0.005, Ilim: 0.8, Iq: 0.005 }, sub(st, 'reg'));   // AMS1117-3.3
        m.addR(V33, G0, 1 / 75);                                              // module idle with the radio off ≈ 45 mA
        m.addR(V33, n[25], 1 / 10e3); m.addR(V33, n[30], 1 / 10e3);       // EN and BOOT (GPIO0) pull-ups
        const x = m.newNode(); m.addR(n[T(2)], x, 1 / 1000); c._ld = m.addD(x, G0, ledIs(2.6), 2 * VT, sub(st, 'L'));
        buildPins(c, n, m, V33, G0); c._p = null;
      },
      measure(c, m) { const M = c._m; stdMeasure(c, m, 1 / 75); if (!c._usb) M.I = (M.Vcc || 0) / 75 + measurePins(c, m) + Math.max(M.IL || 0, 0); },
      post: postMcu, readings: readingsMcu,
      draw(ctx, c) { drawBoard(ctx, c, spec); },
    };
    B.held = heldLow(25);
  }

  // ================================================================ Raspberry Pi Pico ==============================
  // RP2040, 3.3 V logic, Arduino-Pico core numbering (pin n = GPn).  GP23/24/25/29 are used on the board:
  // GP24 senses VBUS, GP25 drives the LED, GP29 = ADC3 measures VSYS/3.  The RT6150 buck-boost makes 3V3 from VSYS.
  {
    const GP = [...range(0, 22), 24, 25, 26, 27, 28, 29];
    const ix = (g) => GP.indexOf(g);
    const consts = { LED_BUILTIN: 25, INPUT_PULLDOWN: 3, A0: 26, A1: 27, A2: 28, A3: 29, SDA: 4, SCL: 5, PIN_LED: 25 };
    for (const g of GP) consts['GP' + g] = g; for (const g of GP) consts['D' + g] = g;
    addBoard('pico', {
      n: GP.length, names: GP.map((g) => 'GP' + g), term: (p) => (p <= 22 ? p : p === 23 ? 38 : p === 24 ? 39 : p === 28 ? 40 : p - 2), pwm: {}, pwmAll: 1, pwmFreq: 1000,
      adc: (p) => (p >= 26 && p <= 29 ? ix(p) : -1), pinOf: (p) => ix(p), vcc: 28, gnd: 30, i2c: [ix(4), ix(5)], label: (n) => 'GP' + n,
      rOut: 70, rPu: 60e3, rPd: 60e3, vil: 0.25, vih: 0.6, vBoot: 2.0, vOff: 1.8, iMax: 0.012,
      tpBack: 3e-8, tpIo: 5e-7, tpAdc: 2e-6, res: true, intRange: 32,
      consts: mkConsts(consts), jsConsts: Object.assign({}, consts),
    });
    const B = MCU.BOARDS.pico;
    const nm = (g) => 'GP' + g + (g >= 26 ? ' ADC' + (g - 26) : '') + (g === 4 ? ' SDA' : g === 5 ? ' SCL' : '');
    const T = (g) => B.term(ix(g));
    const bot = [];   // physical pins 1 … 20
    for (const p of [0, 1, 'G', 2, 3, 4, 5, 'G', 6, 7, 8, 9, 'G', 10, 11, 12, 13, 'G', 14, 15]) bot.push(p === 'G' ? ['GND', null] : ['GP' + p, T(p), nm(p)]);
    let gi = 30; for (const q of bot) if (q[0] === 'GND') { q[1] = gi; q[2] = 'GND'; gi++; }
    const top = [['VBUS', 26, 'VBUS 5V'], ['VSYS', 27, 'VSYS 1.8–5.5V'], ['GND', gi++, 'GND'], ['3V3E', null], ['3V3', 28, '3V3 OUT'], ['VREF', null], ['GP28', T(28), nm(28)], ['AGND', 37, 'AGND'],
      ['GP27', T(27), nm(27)], ['GP26', T(26), nm(26)], ['RUN', 29, 'RUN / RST'], ['GP22', T(22), nm(22)], ['GND', gi++, 'GND'], ['GP21', T(21), nm(21)], ['GP20', T(20), nm(20)], ['GP19', T(19), nm(19)], ['GP18', T(18), nm(18)], ['GND', gi++, 'GND'], ['GP17', T(17), nm(17)], ['GP16', T(16), nm(16)]];
    const spec = { pcb: [-200, -64, 200, 64], grad: [[0, '#1c7a3c'], [1, '#0f5227']], badge: [110, 0],
      rows: [{ y: -54, x0: -190, pitch: 20, pins: top }, { y: 54, x0: -190, pitch: 20, pins: bot }],
      under(ctx) { usbDraw(ctx, -214, -14, 26, 28); chipDraw(ctx, -20, -22, 44, 44, '', '', true); ctx.fillStyle = '#222'; ctx.fillRect(40, -18, 34, 20);
        ctx.fillStyle = '#eee'; ctx.fillRect(-150, 6, 18, 16); ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.arc(-141, 14, 5, 0, 7); ctx.fill(); },
      text(ctx) { txt(ctx, 'RP2040', 2, 0, 'bold 7px sans-serif', '#ccc'); txt(ctx, 'Raspberry Pi Pico', 110, -26, 'bold 9px sans-serif', '#fff'); txt(ctx, 'BOOTSEL', -141, 30, 'bold 5px sans-serif', '#fff'); txt(ctx, 'W25Q16', 57, -8, 'bold 5px sans-serif', '#aaa'); },
      leds: [ledL(-150, -20, '#4dff6a', 'LED', ledCur('IL', 0.002))] };
    const L = layout(spec);
    DEFS.pico = {
      name: '树莓派 Pico 开发板', en: 'Raspberry Pi Pico', cat: 'mcu', desig: 'U', mcu: true, innerShort: true,
      desc: 'Raspberry Pi Pico：RP2040 双核 133 MHz，3.3 V 逻辑（引脚不耐 5 V），引脚号即 GP 号（Arduino-Pico 核心）。GP26–GP28 为 12 位 ADC（analogRead 默认 10 位，可用 analogReadResolution(12)），所有 GPIO 都可 PWM，GP25 接板载 LED。VBUS=USB 5 V，VSYS 输入 1.8–5.5 V，3V3 为板载 DC-DC 输出。',
      terms: L.terms, termNames: L.names, box: [-216, -66, 202, 66],
      props: [pPower([['usb', 'USB 供电 (5 V)'], ['ext', '外部供电 (VSYS 或 3V3 引脚)']], 'usb'), pLang(),
        pCode(blink('// Blink: the on-board LED (GP25) turns on and off every half second.', 'LED_BUILTIN', 500))],
      shorted: () => [[30, 31], [31, 32], [32, 33], [33, 34], [34, 35], [35, 36], [36, 37]], label: (c) => labelMcu(c),
      build(c, n, m) {
        const st = c.state, VBUS = n[26], VSYS = n[27], V33 = n[28], G0 = n[30];
        n[38] = m.newNode(); n[39] = m.newNode(); n[40] = m.newNode();     // GP24, GP25, GP29 (on-board only)
        if (c.props.power === 'usb') c._usb = m.addV(VBUS, G0, () => 5, 0.3); else { c._usb = null; m.addR(VBUS, G0, 1e-7); }
        m.addD(VBUS, VSYS, 1e-6, 1.05 * VT, sub(st, 'd1'));                // VBUS → VSYS Schottky
        m.addR(VSYS, G0, 1e-7);
        c._reg = m.addNL('boost', [VSYS, V33, G0], { kind: 'buck', Vset: 3.3, Vdo: -4, eff: 0.85, Ilim: 0.8, Vmin: 1.8 }, sub(st, 'smps'));   // RT6150 buck-boost
        m.addR(V33, G0, 1 / 160);                                             // RP2040 + flash ≈ 20 mA
        m.addR(VBUS, n[38], 1 / 5.6e3); m.addR(n[38], G0, 1 / 10e3);          // GP24: VBUS sense divider
        m.addR(VSYS, n[40], 1 / 200e3); m.addR(n[40], G0, 1 / 100e3);        // GP29: VSYS / 3
        m.addR(V33, n[29], 1 / 50e3);                                         // RUN pull-up
        const x = m.newNode(); m.addR(n[39], x, 1 / 470); c._ld = m.addD(x, G0, ledIs(2.0), 2 * VT, sub(st, 'L'));
        buildPins(c, n, m, V33, G0); c._p = null;
      },
      measure(c, m) {
        const M = c._m, n = c._nodes, src = measurePins(c, m);
        M.IL = c._ld ? c._ld.i : 0; M.Vsys = m.v(n[27]) - m.v(n[30]);
        M.I = c._usb ? -c._usb.i : ((M.Vcc || 0) / 160 + src + Math.max(M.IL, 0)) * (M.Vcc || 0) / 0.85 / Math.max(M.Vsys, 1.8);
        M.V = M.Vcc; M.P = Math.abs((c._usb ? 5 : M.Vsys) * M.I);
      },
      post: postMcu, readings: readingsMcu,
      draw(ctx, c) { drawBoard(ctx, c, spec); },
    };
    B.held = heldLow(29);
  }

  // ================================================================ STM32 Blue Pill ================================
  // STM32F103C8T6, 3.3 V, STM32duino-style pin names PA0 … PC15 (value = port·16 + bit).  PC13 LED is active-low.
  {
    const code = (s) => ({ A: 0, B: 16, C: 32 }[s[1]] + +s.slice(2));
    const PN = [...range(0, 12).map((b) => 'PA' + b), 'PA15', ...[0, 1, ...range(3, 15)].map((b) => 'PB' + b), 'PC13', 'PC14', 'PC15'];
    const CODES = PN.map(code), ix = (v) => CODES.indexOf(v);
    const ADCP = ['PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7', 'PB0', 'PB1'];
    const PWMP = ['PA0', 'PA1', 'PA2', 'PA3', 'PA6', 'PA7', 'PB0', 'PB1', 'PA8', 'PA9', 'PA10', 'PA11', 'PB6', 'PB7', 'PB8', 'PB9'];
    const consts = { LED_BUILTIN: code('PC13'), INPUT_PULLDOWN: 3, SDA: code('PB7'), SCL: code('PB6') };
    PN.forEach((s) => { consts[s] = code(s); });
    ADCP.forEach((s, i) => { consts['A' + i] = code(s); });
    const pwm = {}; for (const s of PWMP) pwm[PN.indexOf(s)] = 1000;
    addBoard('bluepill', {
      n: PN.length, names: PN, term: (p) => p, pwm,
      adc: (p) => (ADCP.map(code).includes(p) ? ix(p) : -1), pinOf: (p) => ix(p), vcc: 33, gnd: 35, i2c: [ix(code('PB7')), ix(code('PB6'))],
      label: (n) => (n >= 0 && n < 48 ? 'P' + 'ABC'[n >> 4] + (n & 15) : 'pin ' + n),
      rOut: 50, rPu: 40e3, rPd: 40e3, vil: 0.35, vih: 0.55, vBoot: 2.0, vOff: 1.9, iMax: 0.025,
      tpBack: 4e-8, tpIo: 1e-6, tpAdc: 1e-5, res: true, intRange: 32,
      consts: mkConsts(consts), jsConsts: Object.assign({}, consts),
    });
    const B = MCU.BOARDS.bluepill;
    const nm = (s) => s + (ADCP.includes(s) ? ' ADC' : '') + (PWMP.includes(s) ? ' ~PWM' : '') + (s === 'PC13' ? ' LED' : '') + (s === 'PB7' ? ' SDA' : s === 'PB6' ? ' SCL' : '');
    const P = (s) => [s.slice(1), PN.indexOf(s), nm(s)];
    // header rows, USB connector on the left (the B12 / GND end), SWD header at the other end
    const top = [...['PB12', 'PB13', 'PB14', 'PB15', 'PA8', 'PA9', 'PA10', 'PA11', 'PA12', 'PA15', 'PB3', 'PB4', 'PB5', 'PB6', 'PB7', 'PB8', 'PB9'].map(P), ['5V', 32, '5V'], ['G', 36, 'GND'], ['3.3', 34, '3.3V']];
    const bot = [['G', 35, 'GND'], ['G', 37, 'GND'], ['3.3', 33, '3.3V'], ['R', 38, 'NRST'], ...['PB11', 'PB10', 'PB1', 'PB0', 'PA7', 'PA6', 'PA5', 'PA4', 'PA3', 'PA2', 'PA1', 'PA0', 'PC15', 'PC14', 'PC13'].map(P), ['VB', null]];
    const spec = { pcb: [-204, -62, 204, 62], grad: [[0, '#1f4fb8'], [1, '#12307a']], badge: [100, -10],
      rows: [{ y: -50, x0: -190, pitch: 20, pins: top }, { y: 50, x0: -190, pitch: 20, pins: bot }],
      under(ctx) { usbDraw(ctx, -218, -13, 24, 26); chipDraw(ctx, -24, -24, 48, 48, '', '', true);
        ctx.fillStyle = '#eee'; ctx.fillRect(-150, -24, 14, 12); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(-143, -18, 3.5, 0, 7); ctx.fill();
        ctx.fillStyle = '#222'; ctx.fillRect(170, -26, 14, 52); for (let k = 0; k < 4; k++) { ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.arc(177, -18 + 12 * k, 2.4, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#e8e8e8'; for (const y of [-10, 10]) ctx.fillRect(-110, y - 4, 16, 8); },
      text(ctx) { txt(ctx, 'STM32', 0, -6, 'bold 8px sans-serif', '#ddd'); txt(ctx, 'F103C8T6', 0, 6, 'bold 6px sans-serif', '#bbb'); txt(ctx, 'RESET', -143, -32, 'bold 5px sans-serif', '#fff'); txt(ctx, 'BOOT0/1', -102, -20, 'bold 5px sans-serif', '#fff'); txt(ctx, 'SWD', 177, -34, 'bold 5px sans-serif', '#fff'); },
      leds: [ledL(-70, -20, '#ff3030', 'PWR', onLed(2.5)), ledL(-70, 18, '#4dff6a', 'PC13', (c, M) => U.clamp(Math.max(0, M.IL || 0) / 0.0015, 0, 1.2))] };
    const L = layout(spec);
    DEFS.bluepill = {
      name: 'STM32 蓝色小板 Blue Pill (F103C8)', en: 'STM32 Blue Pill (F103C8)', cat: 'mcu', desig: 'U', mcu: true, innerShort: true,
      desc: 'STM32F103C8T6 "Blue Pill"：72 MHz Cortex-M3，3.3 V 逻辑。引脚名 PA0–PA15、PB0–PB15、PC13–PC15（STM32duino 核心）。12 位 ADC 在 PA0–PA7、PB0、PB1；PC13 接板载 LED，低电平点亮。多数非模拟脚耐 5 V（FT）。5V 引脚经板载稳压器得到 3.3 V。',
      terms: L.terms, termNames: L.names, box: [-220, -64, 206, 64],
      props: [pPower([['usb', 'USB 供电 (5 V)'], ['ext', '外部供电 (5V 或 3.3 引脚)']], 'usb'), pLang(),
        pCode(blink('// Blink: the green LED on PC13 lights when PC13 is LOW (active-low), every half second.', 'PC13', 500))],
      shorted: () => [[35, 36], [36, 37], [33, 34]], label: (c) => labelMcu(c),
      build(c, n, m) {
        const st = c.state, V5 = n[32], V33 = n[33], G0 = n[35];
        if (c.props.power === 'usb') c._usb = m.addV(V5, G0, () => 5, 0.3); else c._usb = null;
        m.addR(V5, G0, 1e-7);
        c._reg = m.addNL('linreg', [V5, V33, G0], { Vref: 3.3, Vdo: 0.25, Ro: 0.005, Ilim: 0.3, Iq: 1e-4 }, sub(st, 'reg'));
        m.addR(V33, G0, 1 / 110);                                             // ≈ 30 mA at 72 MHz + power LED
        m.addR(V33, n[38], 1 / 10e3);                                         // NRST pull-up
        const x = m.newNode(); c._lr = m.addR(V33, x, 1 / 680); c._ld = m.addD(x, n[ix(code('PC13'))], ledIs(2.0), 2 * VT, sub(st, 'L'));   // LED: 3V3 → R → LED → PC13
        buildPins(c, n, m, V33, G0); c._p = null;
      },
      measure(c, m) { const M = c._m; stdMeasure(c, m, 1 / 110); if (!c._usb) M.I = (M.Vcc || 0) / 110 + measurePins(c, m) + Math.max(M.IL || 0, 0); },
      post: postMcu, readings: readingsMcu,
      draw(ctx, c) { drawBoard(ctx, c, spec); },
    };
    B.held = heldLow(38);
  }

  // ================================================================ 8051 (STC89C52RC / AT89C52) ===================
  // DIP-40.  Ports P0 … P3; logical pin k = port·8 + bit.  P1–P3: quasi-bidirectional (weak pull-up when the latch is
  // 1, strong low when 0); P0: open drain (needs external pull-ups).  RST is active-HIGH.  No ADC, no PWM hardware.
  {
    const XT = 11.0592e6;
    const term = (k) => { const p = k >> 3, b = k & 7; return p === 1 ? b : p === 3 ? 9 + b : p === 2 ? 20 + b : 38 - b; };
    const names = range(0, 31).map((k) => 'P' + (k >> 3) + '.' + (k & 7));
    const B = addBoard('c51', {
      n: 32, names, term, pwm: {}, adc: () => -1, pinOf: (p) => (p >= 0 && p < 32 ? p : -1), vcc: 39, gnd: 19, c51: true, i2c: null,
      label: (n) => (n >= 0 && n < 32 ? 'P' + (n >> 3) + '.' + (n & 7) : 'pin ' + n),
      rOut: 45, rPu: 40e3, vil: 0.18, vih: 0.38, vBoot: 3.8, vOff: 3.5, iMax: 0.02,
      tpBack: 96 / XT, tpIo: 12 / XT, tpAdc: 1e-4,
      consts: mkConsts({}), jsConsts: {},
    });
    // crystal → machine cycle = 12 clocks; an empty counting-loop iteration ≈ 8 machine cycles (DJNZ / CJNE style)
    B.forProps = (p) => { const f = (+p.xtal || 11.0592) * 1e6; return f === XT ? B : Object.assign(Object.create(B), { tpBack: 96 / f, tpIo: 12 / f }); };
    B.held = (c, app, vcc) => {
      if (vcc <= 1) return false;
      const n = c._nodes, g = app.net.v(n[19]);
      c.state.eaLow = app.net.v(n[30]) - g < 0.3 * vcc;
      return app.net.v(n[8]) - g > 0.6 * vcc || c.state.eaLow;
    };
    const physName = (i) => {
      for (let k = 0; k < 32; k++) if (term(k) === i) return names[k];
      return { 8: 'RST', 17: 'XTAL2', 18: 'XTAL1', 19: 'GND', 28: 'PSEN', 29: 'ALE', 30: 'EA', 39: 'VCC' }[i];
    };
    const p3alt = ['RXD', 'TXD', 'INT0', 'INT1', 'T0', 'T1', 'WR', 'RD'];
    const termNames = range(0, 39).map((i) => (i + 1) + ' ' + physName(i) + (i >= 9 && i <= 16 ? ' ' + p3alt[i - 9] : ''));
    const terms = range(0, 39).map((i) => (i < 20 ? [-190 + 20 * i, 40] : [190 - 20 * (i - 20), -40]));
    const bottom = range(0, 19).map((i) => [physName(i), i]), topr = range(20, 39).map((i) => [physName(i), i]);
    const spec = { dip: true, pcb: [-200, -26, 200, 26], badge: [120, 0],
      rows: [{ y: 40, x0: -190, pitch: 20, pins: bottom, ly: -18 }, { y: -40, x0: 190, pitch: -20, pins: topr, ly: 18 }],
      text(ctx, c) { txt(ctx, 'STC89C52RC', -30, -2, 'bold 11px sans-serif', '#ddd'); txt(ctx, (+c.props.xtal || 11.0592) + ' MHz', 40, 8, 'bold 6px sans-serif', '#999'); } };
    DEFS.c51 = {
      name: '8051 单片机 (STC89C52 / AT89C52, 40 脚)', en: '8051 MCU (STC89C52 / AT89C52, DIP-40)', cat: 'mcu', desig: 'U', mcu: true,
      desc: '经典 8051 单片机（STC89C52RC / AT89C52），DIP-40，5 V。P0–P3 四个 8 位口：P1–P3 为准双向口（写 1 为弱上拉，可作输入），P0 为开漏，作输出或输入都要外接上拉电阻。RST 高电平复位，EA 要接 VCC。用 C51 语法编程（sbit、P1 = 0xFE、main()）。',
      terms, termNames, box: [-202, -42, 202, 42],
      props: [
        { k: 'xtal', label: '晶振频率', lk: 'mcu.p.xtal', ok: 'mcu.o.xtal', kind: 'select', opts: [['6', '6 MHz'], ['11.0592', '11.0592 MHz'], ['12', '12 MHz'], ['22.1184', '22.1184 MHz'], ['24', '24 MHz']], def: '11.0592' },
        { k: 'lang', label: '编程语言', lk: 'mcu.p.lang', ok: 'mcu.o.lang51', kind: 'select', opts: [['ino', 'C51 (Keil C)']], def: 'ino' },
        pCode(C51_BLINK)],
      label: (c) => labelMcu(c),
      build(c, n, m) {
        const VCC = n[39], G0 = n[19];
        m.addR(VCC, G0, 1 / 500);                                             // ≈ 10 mA at 5 V
        m.addR(n[8], G0, 1 / 50e3);                                           // RST internal pull-down
        m.addR(VCC, n[30], 1 / 1e6);                                          // EA left open counts as high here
        for (const i of [17, 18, 28, 29]) m.addR(n[i], G0, 1e-7);
        buildPins(c, n, m, VCC, G0); c._p = null;
      },
      measure(c, m) { const M = c._m, src = measurePins(c, m); M.I = (M.Vcc || 0) / 500 + src; M.V = M.Vcc; M.P = Math.abs(M.V * M.I); },
      post: postMcu,
      readings(c) { const r = readingsMcu(c); if (c.state.held && c.state.eaLow) r.splice(1, 0, [_t('common.note'), _t('mcu.ea_low')]); return r; },
      draw(ctx, c) {
        drawBoard(ctx, c, spec);
      },
    };
  }
})();
