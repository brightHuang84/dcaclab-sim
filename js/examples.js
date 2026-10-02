'use strict';
// ===== Built-in example circuits =====
const EXAMPLES = (() => {
  function builder() {
    const comps = [], wires = [];
    let id = 1;
    const add = (type, x, y, rot = 0, props = {}) => {
      const c = { id: id++, type, x, y, rot, props: Object.assign(defaultProps(type), props) };
      if (DEFS[type].board) comps.unshift(c); else comps.push(c);
      return c;
    };
    const tp = (c, i) => { const t = DEFS[c.type].terms[i]; const [rx, ry] = U.rot(t[0], t[1], c.rot); return [c.x + rx, c.y + ry]; };
    const lp = (a, b, bend) => (a[0] === b[0] || a[1] === b[1] ? [a, b] : [a, bend ? [a[0], b[1]] : [b[0], a[1]], b]);
    const wire = (c1, t1, c2, t2, bend = 0, color) => { wires.push({ id: id++, pts: lp(tp(c1, t1), tp(c2, t2), bend), color: color || '#d62828' }); };
    // explicit poly-line; entries may be [x,y] or [comp, termIndex]
    const path = (pts, color) => { wires.push({ id: id++, pts: pts.map(p => (Array.isArray(p) && typeof p[0] === 'object' ? tp(p[0], p[1]) : p)), color: color || '#d62828' }); };
    return { add, wire, path, tp, done: () => ({ comps, wires }) };
  }
  const RED = '#d62828', BLK = '#222222', BLU = '#1d5fd1', GRN = '#2a9d3a', YEL = '#f2b705', ORG = '#f77f00';
  const list = [
    {
      id: 'ohm', name: '欧姆定律 9V / 3Ω (Ohm\'s law)', build() {
        const b = builder();
        const B = b.add('battery', 300, 420, 0, { V: 9 });
        const S = b.add('switch', 500, 420, 0, { closed: true });
        const A = b.add('ammeter', 600, 200);
        const R = b.add('resistor', 400, 200, 0, { R: 3 });
        const V = b.add('voltmeter', 400, 100);
        b.wire(B, 1, S, 0, 0, RED); b.wire(S, 1, A, 1, 0, RED); b.wire(A, 0, R, 1, 0, BLU);
        b.wire(R, 0, B, 0, 0, BLK); b.wire(V, 1, R, 1, 0, RED); b.wire(V, 0, R, 0, 0, BLK);
        return b.done();
      },
    },
    {
      id: 'series', name: '串联灯泡 (Series bulbs)', build() {
        const b = builder();
        const B = b.add('battery', 300, 400, 0, { V: 9 });
        const S = b.add('switch', 500, 400, 0, { closed: true });
        const L1 = b.add('bulb', 240, 200), L2 = b.add('bulb', 440, 200);
        const V = b.add('voltmeter', 240, 60);
        b.wire(B, 1, S, 0, 0, RED); b.wire(S, 1, L2, 1, 1, RED); b.wire(L2, 0, L1, 1, 0, BLU);
        b.wire(L1, 0, B, 0, 1, BLK); b.wire(V, 1, L1, 1, 0, RED); b.wire(V, 0, L1, 0, 0, BLK);
        return b.done();
      },
    },
    {
      id: 'parallel', name: '并联灯泡 (Parallel bulbs)', build() {
        const b = builder();
        const B = b.add('battery', 300, 460, 0, { V: 9 });
        const S = b.add('switch', 500, 460, 0, { closed: true });
        const L1 = b.add('bulb', 400, 200, 0, { color: 'warm' }), L2 = b.add('bulb', 400, 320, 0, { color: 'blue' });
        const A = b.add('ammeter', 660, 360);
        b.wire(L1, 0, L2, 0, 0, BLK); b.wire(L1, 1, L2, 1, 0, RED); b.wire(B, 0, L2, 0, 1, BLK);
        b.wire(S, 1, A, 1, 0, RED); b.wire(A, 0, L2, 1, 0, RED); b.wire(B, 1, S, 0, 0, RED);
        return b.done();
      },
    },
    {
      id: 'rc', name: 'RC 充电 τ=1s (RC charging)', build() {
        const b = builder();
        const B = b.add('battery', 300, 420, 0, { V: 9 });
        const S = b.add('switch', 500, 420, 0, { closed: false });
        const R = b.add('resistor', 620, 300, 1, { R: 1000 });
        const C = b.add('capacitor', 400, 200, 0, { C: 1e-3 });
        const V = b.add('voltmeter', 400, 100);
        const A = b.add('ammeter', 760, 300);
        b.wire(B, 1, S, 0, 0, RED); b.wire(S, 1, A, 1, 0, RED); b.wire(A, 0, R, 1, 1, BLU);
        b.wire(R, 0, C, 1, 1, BLU); b.wire(C, 0, B, 0, 0, BLK); b.wire(V, 1, C, 1, 0, RED); b.wire(V, 0, C, 0, 0, BLK);
        return b.done();
      },
    },
    {
      id: 'led', name: 'LED 与限流电阻 (LED + resistor)', build() {
        const b = builder();
        const B = b.add('battery', 300, 420, 2, { V: 9 });
        const S = b.add('switch', 500, 420, 0, { closed: true });
        const R = b.add('resistor', 620, 300, 1, { R: 330 });
        const L = b.add('led', 400, 200, 0, { color: 'red' });
        const A = b.add('ammeter', 410, 500);
        b.wire(B, 1, L, 0, 1, RED); b.wire(L, 1, R, 0, 0, BLU); b.wire(R, 1, S, 1, 1, BLU);
        b.wire(S, 0, A, 1, 1, BLK); b.wire(A, 0, B, 0, 0, BLK);
        return b.done();
      },
    },
    {
      id: 'fuse', name: '保险丝与短路 (Fuse & short)', build() {
        const b = builder();
        const B = b.add('battery', 300, 420, 0, { V: 9 });
        const F = b.add('fuse', 500, 420, 0, { rating: 1 });
        const L = b.add('bulb', 400, 200);
        const P = b.add('button', 400, 300);
        b.wire(B, 1, F, 0, 0, RED); b.wire(F, 1, L, 1, 1, RED); b.wire(L, 0, B, 0, 0, BLK);
        b.wire(P, 0, L, 0, 0, BLU); b.wire(P, 1, L, 1, 0, BLU);
        return b.done();
      },
    },
    {
      id: 'dimmer', name: '可变电阻调光 (Dimmer)', build() {
        const b = builder();
        const B = b.add('battery', 300, 420, 0, { V: 9 });
        const Rh = b.add('rheostat', 500, 420, 0, { R: 50, pos: 0.3 });
        const L = b.add('bulb', 400, 200);
        const M = b.add('multimeter', 660, 180, 0, { mode: 'ADC' });
        b.wire(B, 1, Rh, 0, 0, RED); b.wire(Rh, 1, M, 2, 0, ORG); b.wire(M, 0, L, 1, 0, BLK); b.wire(L, 0, B, 0, 0, BLK);
        return b.done();
      },
    },
    {
      id: 'acdiode', name: '交流半波整流 (AC half-wave)', build() {
        const b = builder();
        const AC = b.add('ac', 300, 420, 0, { Vp: 12, f: 1 });
        const Dd = b.add('diode', 500, 420);
        const L = b.add('bulb', 400, 200, 0, { Vr: 12, Pr: 6 });
        const M = b.add('multimeter', 660, 200, 0, { mode: 'VDC' });
        const G = b.add('ground', 240, 500), G2 = b.add('ground', 620, 320);
        b.wire(AC, 1, Dd, 0, 0, RED); b.wire(Dd, 1, L, 1, 1, RED); b.wire(L, 0, AC, 0, 0, BLK);
        b.wire(M, 1, Dd, 1, 1, RED); b.wire(M, 0, G2, 0, 0, BLK); b.wire(G, 0, AC, 0, 0, BLK);
        return b.done();
      },
    },
    {
      id: 'rlc', name: 'RLC 交流电路 (AC RLC)', build() {
        const b = builder();
        const AC = b.add('ac', 300, 420, 0, { Vp: 10, f: 50 });
        const R = b.add('resistor', 520, 420, 0, { R: 10 });
        const L = b.add('inductor', 620, 300, 1, { L: 0.1 });
        const C = b.add('capacitor', 440, 200, 0, { C: 1e-4 });
        const A = b.add('ammeter', 420, 500, 2, { mode: 'AC' });
        const V = b.add('voltmeter', 440, 90, 0, { mode: 'AC' });
        b.wire(AC, 1, A, 1, 0, RED); b.wire(A, 0, R, 0, 0, RED); b.wire(R, 1, L, 1, 0, RED);
        b.wire(L, 0, C, 1, 1, BLU); b.wire(C, 0, AC, 0, 0, BLK); b.wire(V, 1, C, 1, 0, RED); b.wire(V, 0, C, 0, 0, BLK);
        return b.done();
      },
    },
    {
      id: 'scope', name: '示波器观察 RC 低通 (Scope: sine)', build() {
        const b = builder();
        const AC = b.add('ac', 200, 300, 3, { Vp: 5, f: 50 });
        const R = b.add('resistor', 360, 200, 0, { R: 1000 });
        const C = b.add('capacitor', 480, 280, 1, { C: 3.3e-6 });
        const G = b.add('ground', 340, 420), G2 = b.add('ground', 780, 380);
        const O = b.add('scope', 740, 260, 0, { tdiv: 5e-3, v1div: 2, v2div: 2 });
        // CH1 = source, CH2 = capacitor voltage (phase lag)
        b.path([[AC, 1], [200, 200], [280, 200]], RED); b.path([[280, 200], [R, 0]], RED);
        b.path([[R, 1], [480, 200], [C, 0]], BLU);
        b.path([[C, 1], [480, 400], [340, 400]], BLK); b.path([[340, 400], [200, 400], [AC, 0]], BLK);
        b.path([[O, 0], [700, 360], [620, 360], [620, 120], [280, 120], [280, 200]], YEL);
        b.path([[O, 1], [740, 380], [560, 380], [560, 240], [C, 0]], '#1d9bd1');
        b.path([[O, 2], [G2, 0]], BLK);
        void G;
        return b.done();
      },
    },
    {
      id: 'scopesq', name: '示波器：方波 RC 充放电 (Scope: square wave)', build() {
        const b = builder();
        const AC = b.add('ac', 200, 300, 3, { Vp: 4, f: 100, off: 4, wave: 'square' });
        const R = b.add('resistor', 360, 200, 0, { R: 1000 });
        const C = b.add('capacitor', 480, 280, 1, { C: 1e-6 });
        const G = b.add('ground', 340, 420), G2 = b.add('ground', 780, 380);
        const O = b.add('scope', 740, 260, 0, { tdiv: 2e-3, v1div: 2, v2div: 2, pos1: -2, pos2: -2 });
        b.path([[AC, 1], [200, 200], [280, 200]], RED); b.path([[280, 200], [R, 0]], RED);
        b.path([[R, 1], [480, 200], [C, 0]], BLU);
        b.path([[C, 1], [480, 400], [340, 400]], BLK); b.path([[340, 400], [200, 400], [AC, 0]], BLK);
        b.path([[O, 0], [700, 360], [620, 360], [620, 120], [280, 120], [280, 200]], YEL);
        b.path([[O, 1], [740, 380], [560, 380], [560, 240], [C, 0]], '#1d9bd1');
        b.path([[O, 2], [G2, 0]], BLK);
        void G;
        return b.done();
      },
    },
    {
      id: 'npn', name: '三极管开关 (NPN transistor switch)', build() {
        const b = builder();
        const B = b.add('battery', 140, 300, 3, { V: 9 });
        const Rc = b.add('resistor', 460, 80, 1, { R: 330 });
        const L = b.add('led', 460, 160, 1, { color: 'green' });
        const S = b.add('switch', 640, 120, 1, { closed: true });
        const Rb = b.add('resistor', 640, 240, 1, { R: 10000 });
        const Q = b.add('npn', 400, 300, 0, { BF: 100 });
        const A = b.add('ammeter', 260, 400, 0);
        b.path([[B, 1], [140, 40], [Rc, 0]], RED);
        b.path([[Rc, 0], [640, 40], [S, 0]], RED);
        b.path([[S, 1], [Rb, 0]], RED);
        b.path([[Rb, 1], [640, 380], [400, 380], [Q, 1]], BLU);
        b.path([[L, 1], [460, 340], [420, 340], [Q, 2]], GRN);
        b.path([[Q, 0], [380, 480], [280, 480], [A, 1]], BLK);
        b.path([[A, 0], [240, 480], [140, 480], [B, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'zener', name: '稳压管稳压电路 (Zener regulator)', build() {
        const b = builder();
        const B = b.add('battery', 140, 300, 3, { V: 12 });
        const Rs = b.add('resistor', 300, 120, 0, { R: 220 });
        const Z = b.add('zener', 420, 240, 3, { Vz: 5.1 });
        const RL = b.add('resistor', 560, 240, 3, { R: 1000 });
        const V = b.add('voltmeter', 700, 160);
        const A = b.add('ammeter', 200, 160, 2);
        b.path([[B, 1], [140, 120], [A, 1]], RED); b.path([[A, 0], [Rs, 0]], RED);
        b.path([[Rs, 1], [420, 120]], RED); b.path([[420, 120], [Z, 1]], RED);
        b.path([[420, 120], [560, 120]], RED); b.path([[560, 120], [RL, 1]], RED);
        b.path([[V, 1], [720, 120], [560, 120]], RED);
        b.path([[Z, 0], [420, 360]], BLK); b.path([[RL, 0], [560, 360]], BLK); b.path([[560, 360], [420, 360]], BLK);
        b.path([[V, 0], [680, 360], [560, 360]], BLK);
        b.path([[420, 360], [B, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'ne555', name: '555 多谐振荡 LED 闪烁 (555 astable blinker)', build() {
        const b = builder();
        const B = b.add('battery', 120, 340, 3, { V: 9 });
        const U1 = b.add('ic555', 400, 300, 1);
        const R1 = b.add('resistor', 600, 160, 1, { R: 1000 });
        const R2 = b.add('resistor', 600, 340, 1, { R: 10000 });
        const C1 = b.add('capacitor', 600, 440, 1, { C: 47e-6 });
        const Ro = b.add('resistor', 340, 440, 1, { R: 330 });
        const L = b.add('led', 340, 520, 1, { color: 'red' });
        const G = b.add('ground', 340, 620), G2 = b.add('ground', 900, 420);
        const O = b.add('scope', 860, 300, 0, { tdiv: 0.2, v1div: 2, v2div: 5, trig: 'auto' });
        // +9V rail
        b.path([[B, 1], [120, 80], [300, 80]], RED); b.path([[300, 80], [460, 80]], RED); b.path([[460, 80], [600, 80]], RED);
        b.path([[R1, 0], [600, 80]], RED);
        b.path([[U1, 7], [460, 260], [460, 80]], RED);                 // pin 8 VCC
        b.path([[U1, 3], [300, 320], [300, 80]], RED);                 // pin 4 RESET
        // timing network
        b.path([[U1, 6], [600, 280]], BLU);                            // pin 7 DIS
        b.path([[R1, 1], [600, 280]], BLU); b.path([[600, 280], [R2, 0]], BLU);
        b.path([[U1, 5], [520, 300], [520, 380]], GRN);                // pin 6 THR
        b.path([[520, 380], [R2, 1]], GRN); b.path([[C1, 0], [R2, 1]], GRN);
        b.path([[U1, 1], [360, 280], [360, 380], [520, 380]], GRN);    // pin 2 TRIG
        // output -> LED
        b.path([[U1, 2], [340, 300], [Ro, 0]], ORG);                   // pin 3 OUT
        b.path([[L, 1], [340, 600]], BLK);
        // ground rail
        b.path([[B, 0], [120, 600], [240, 600]], BLK); b.path([[240, 600], [340, 600]], BLK); b.path([[340, 600], [600, 600]], BLK);
        b.path([[U1, 0], [240, 260], [240, 600]], BLK);                // pin 1 GND
        b.path([[C1, 1], [600, 600]], BLK);
        // oscilloscope: CH1 = capacitor, CH2 = output
        b.path([[O, 0], [820, 400], [C1, 0]], YEL);
        b.path([[O, 1], [860, 660], [300, 660], [300, 400], [Ro, 0]], '#1d9bd1');
        b.path([[O, 2], [G2, 0]], BLK);
        void G; void L;
        return b.done();
      },
    },
    {
      id: 'breadboard', name: '面包板 LED 电路 (Breadboard LED)', build() {
        const b = builder();
        b.add('breadboard', 400, 300, 0, { cols: 30 });
        const B = b.add('battery', 220, 560, 0, { V: 9 });
        const R = b.add('resistor', 340, 400, 1, { R: 330 });
        const L = b.add('led', 380, 340, 0, { color: 'blue' });
        const S = b.add('switch', 420, 420, 1, { closed: true });
        const L2 = b.add('led', 540, 340, 0, { color: 'yellow' });
        const R2 = b.add('resistor', 500, 400, 1, { R: 470 });
        b.path([[B, 1], [280, 440]], RED);            // + rail (row 7)
        b.path([[B, 0], [160, 460]], BLK);            // - rail (row 8)
        b.path([[580, 380], [580, 460]], BLK);        // jumper: LED2 cathode strip -> - rail
        void R; void L; void S; void L2; void R2;
        return b.done();
      },
    },
    {
      id: 'opinv', name: '运放反相放大 ×(−10) (Op-amp inverting amp)', build() {
        const b = builder();
        const S = b.add('ac', 140, 320, 3, { Vp: 1, f: 100 });
        const G1 = b.add('ground', 140, 440), G2 = b.add('ground', 420, 320), G3 = b.add('ground', 860, 340);
        const Ri = b.add('resistor', 300, 200, 0, { R: 1000 });
        const Rf = b.add('resistor', 480, 120, 0, { R: 10000 });
        const U1 = b.add('opamp', 480, 220);
        const O = b.add('scope', 820, 200, 0, { tdiv: 0.002, v1div: 1, v2div: 5, trig: 'auto' });
        b.path([[S, 0], [G1, 0]], BLK);
        b.path([[S, 1], [140, 200], [200, 200]], RED); b.path([[200, 200], [Ri, 0]], RED);
        b.path([[Ri, 1], [400, 200]], BLU); b.path([[400, 200], [U1, 0]], BLU); b.path([[400, 200], [400, 120], [Rf, 0]], BLU);
        b.path([[U1, 1], [420, 240], [G2, 0]], BLK);
        b.path([[Rf, 1], [560, 120], [560, 220]], ORG); b.path([[U1, 2], [560, 220]], ORG);
        b.path([[560, 220], [640, 220], [640, 380], [820, 380], [O, 1]], '#1d9bd1');
        b.path([[200, 200], [200, 60], [700, 60], [700, 340], [780, 340], [O, 0]], YEL);
        b.path([[O, 2], [G3, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'opnoninv', name: '运放同相放大 ×10 (Op-amp non-inverting amp)', build() {
        const b = builder();
        const S = b.add('ac', 140, 320, 3, { Vp: 0.5, f: 100 });
        const G1 = b.add('ground', 140, 440), G2 = b.add('ground', 280, 160), G3 = b.add('ground', 860, 340);
        const Rg = b.add('resistor', 340, 160, 1, { R: 1000 });
        const Rf = b.add('resistor', 480, 120, 0, { R: 9000 });
        const U1 = b.add('opamp', 480, 220);
        const O = b.add('scope', 820, 200, 0, { tdiv: 0.002, v1div: 0.5, v2div: 2, trig: 'auto' });
        b.path([[S, 0], [G1, 0]], BLK);
        b.path([[S, 1], [140, 240], [200, 240]], RED); b.path([[200, 240], [U1, 1]], RED);
        b.path([[U1, 0], [400, 200]], BLU); b.path([[400, 200], [Rg, 1]], BLU); b.path([[400, 200], [400, 120], [Rf, 0]], BLU);
        b.path([[Rg, 0], [340, 80], [280, 80], [G2, 0]], BLK);
        b.path([[Rf, 1], [560, 120], [560, 220]], ORG); b.path([[U1, 2], [560, 220]], ORG);
        b.path([[560, 220], [640, 220], [640, 380], [820, 380], [O, 1]], '#1d9bd1');
        b.path([[200, 240], [200, 40], [700, 40], [700, 340], [780, 340], [O, 0]], YEL);
        b.path([[O, 2], [G3, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'comparator', name: '运放比较器 光控小夜灯 (Comparator night-light)', build() {
        const b = builder();
        const B = b.add('battery', 100, 320, 3, { V: 9 });
        const Gb = b.add('ground', 100, 420), Gp = b.add('ground', 180, 500), Gr = b.add('ground', 320, 360), Gl = b.add('ground', 660, 380);
        const LDR = b.add('ldr', 320, 140, 1, { pos: 0.4 });
        const R = b.add('resistor', 320, 280, 1, { R: 10000 });
        const P = b.add('pot', 180, 420, 1, { R: 10000, pos: 0.5 });
        const U1 = b.add('opamp', 480, 240, 0, { vpos: 9, vneg: 0 });
        const Ro = b.add('resistor', 580, 240, 0, { R: 470 });
        const L = b.add('led', 660, 300, 1, { color: 'yellow' });
        b.path([[B, 0], [Gb, 0]], BLK);
        b.path([[B, 1], [100, 80], [180, 80]], RED); b.path([[180, 80], [320, 80]], RED); b.path([[180, 80], [P, 0]], RED);
        b.path([[320, 80], [LDR, 0]], RED);
        b.path([[LDR, 1], [320, 220]], BLU); b.path([[320, 220], [R, 0]], BLU); b.path([[320, 220], [U1, 0]], BLU);
        b.path([[R, 1], [Gr, 0]], BLK);
        b.path([[P, 1], [Gp, 0]], BLK);
        b.path([[P, 2], [420, 420], [420, 260], [U1, 1]], GRN);
        b.path([[U1, 2], [Ro, 0]], ORG); b.path([[Ro, 1], [660, 240], [L, 0]], ORG);
        b.path([[L, 1], [Gl, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'halfadder', name: '半加器 XOR + AND (Logic half adder)', build() {
        const b = builder();
        const A = b.add('lswitch', 120, 160, 0, { on: true }), Bs = b.add('lswitch', 120, 360, 0, { on: false });
        const X = b.add('xor', 400, 160), N = b.add('and', 400, 340);
        const PS = b.add('lprobe', 520, 140), PC = b.add('lprobe', 520, 320);
        b.path([[A, 0], [240, 160]], RED); b.path([[240, 160], [240, 140], [X, 0]], RED); b.path([[240, 160], [240, 320], [N, 0]], RED);
        b.path([[Bs, 0], [300, 360]], BLU); b.path([[300, 360], [N, 1]], BLU); b.path([[300, 360], [300, 180], [X, 1]], BLU);
        b.path([[X, 2], [PS, 0]], GRN); b.path([[N, 2], [PC, 0]], ORG);
        return b.done();
      },
    },
    {
      id: 'clockblink', name: '时钟信号 LED 闪烁 + 非门 (Clock blinker)', build() {
        const b = builder();
        const K = b.add('clock', 120, 240, 0, { f: 2 });
        const N = b.add('not', 320, 160);
        const P = b.add('lprobe', 440, 140), P2 = b.add('lprobe', 200, 200);
        const R = b.add('resistor', 320, 240, 0, { R: 220 });
        const L = b.add('led', 440, 300, 1, { color: 'green' });
        const G = b.add('ground', 440, 380);
        b.path([[K, 0], [200, 240]], RED); b.path([[200, 240], [240, 240]], RED); b.path([[200, 240], [P2, 0]], RED);
        b.path([[240, 240], [240, 160], [N, 0]], RED); b.path([[240, 240], [R, 0]], RED);
        b.path([[N, 1], [P, 0]], BLU);
        b.path([[R, 1], [440, 240], [L, 0]], ORG); b.path([[L, 1], [G, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'counter', name: 'D 触发器 4 位计数器 + 七段数码管 (DFF counter)', build() {
        const b = builder();
        const K = b.add('clock', 60, 220, 0, { f: 2 });
        const F = [];
        const xs = [200, 340, 480, 620];
        for (let i = 0; i < 4; i++) F.push(b.add('dff', xs[i], 200));
        const S7 = b.add('seg7', 800, 80, 0, { color: 'red' });
        b.path([[K, 0], [F[0], 1]], RED);
        for (let i = 0; i < 4; i++) {
          const x = xs[i];
          b.path([[F[i], 3], [x + 60, 220]], BLU);
          b.path([[x + 60, 220], [x + 60, 280], [x - 60, 280], [x - 60, 180], [F[i], 0]], BLU);
          if (i < 3) b.path([[x + 60, 220], [F[i + 1], 1]], RED);
          b.path([[F[i], 2], [x + 40, 40 + 20 * i], [S7, i]], GRN);
        }
        return b.done();
      },
    },
    {
      id: 'lissajous', name: '示波器 X-Y 李萨如图形 1:2 (Lissajous XY)', build() {
        const b = builder();
        const S1 = b.add('ac', 160, 280, 3, { Vp: 5, f: 50 }), S2 = b.add('ac', 360, 280, 3, { Vp: 5, f: 100 });
        const G1 = b.add('ground', 160, 400), G2 = b.add('ground', 360, 400), G3 = b.add('ground', 700, 340);
        const O = b.add('scope', 660, 200, 0, { mode: 'xy', tdiv: 0.002, v1div: 2, v2div: 2 });
        b.path([[S1, 0], [G1, 0]], BLK); b.path([[S2, 0], [G2, 0]], BLK);
        b.path([[S1, 1], [160, 100], [520, 100], [520, 320], [620, 320], [O, 0]], YEL);
        b.path([[S2, 1], [360, 160], [480, 160], [480, 360], [660, 360], [O, 1]], '#1d9bd1');
        b.path([[O, 2], [G3, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'fft', name: '示波器 FFT 频谱：方波 / RC 滤波 (Scope FFT)', build() {
        const b = builder();
        const S = b.add('ac', 160, 280, 3, { Vp: 5, f: 100, wave: 'square' });
        const G1 = b.add('ground', 160, 400), G2 = b.add('ground', 480, 340), G3 = b.add('ground', 820, 360);
        const R = b.add('resistor', 380, 160, 0, { R: 1000 });
        const C = b.add('capacitor', 480, 240, 1, { C: 10e-6 });
        const O = b.add('scope', 780, 220, 0, { mode: 'fft', fzoom: 1, tdiv: 0.01, v1div: 5, v2div: 2 });
        b.path([[S, 0], [G1, 0]], BLK);
        b.path([[S, 1], [160, 160], [300, 160]], RED); b.path([[300, 160], [R, 0]], RED);
        b.path([[R, 1], [480, 160]], BLU); b.path([[480, 160], [C, 0]], BLU); b.path([[C, 1], [G2, 0]], BLK);
        b.path([[300, 160], [300, 80], [640, 80], [640, 340], [740, 340], [O, 0]], YEL);
        b.path([[480, 160], [600, 160], [600, 380], [780, 380], [O, 1]], '#1d9bd1');
        b.path([[O, 2], [G3, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'relay', name: '继电器控制两盏灯 (Relay NO / NC)', build() {
        const b = builder();
        const B = b.add('battery', 120, 300, 3, { V: 9 });
        const Gb = b.add('ground', 120, 420), Gc = b.add('ground', 360, 400), G1 = b.add('ground', 400, 200), G2 = b.add('ground', 460, 480);
        const S = b.add('switch', 240, 200, 1, { closed: false });
        const K = b.add('relay', 400, 300);
        const Dd = b.add('diode', 320, 300, 3);
        const L1 = b.add('bulb', 460, 200, 1, { color: 'warm' }), L2 = b.add('bulb', 460, 400, 1, { color: 'warm' });
        b.path([[B, 0], [Gb, 0]], BLK);
        b.path([[B, 1], [120, 120], [240, 120]], RED); b.path([[240, 120], [S, 0]], RED); b.path([[240, 120], [600, 120], [600, 300], [K, 2]], RED);
        b.path([[S, 1], [240, 280], [320, 280]], ORG); b.path([[320, 280], [K, 0]], ORG); b.path([[320, 280], [Dd, 1]], ORG);
        b.path([[K, 1], [360, 360]], BLK); b.path([[360, 360], [Gc, 0]], BLK); b.path([[Dd, 0], [320, 360], [360, 360]], BLK);
        b.path([[K, 3], [460, 280], [L1, 1]], GRN); b.path([[L1, 0], [400, 160], [G1, 0]], BLK);
        b.path([[K, 4], [460, 320], [L2, 0]], BLU); b.path([[L2, 1], [G2, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'motor', name: '直流电机调速 (DC motor + rheostat)', build() {
        const b = builder();
        const B = b.add('battery', 120, 300, 3, { V: 6 });
        const Rh = b.add('rheostat', 240, 160, 0, { R: 20, pos: 0.2 });
        const M = b.add('motor', 400, 160);
        const S = b.add('switch', 300, 440, 0, { closed: true });
        const A = b.add('ammeter', 560, 260);
        b.path([[B, 1], [120, 160], [Rh, 0]], RED); b.path([[Rh, 1], [M, 0]], RED);
        b.path([[M, 1], [640, 160], [640, 340], [580, 340], [A, 1]], ORG);
        b.path([[A, 0], [540, 440], [S, 1]], BLK); b.path([[S, 0], [120, 440], [B, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'xfmr', name: '变压器 2:1 + 桥式整流滤波 (Transformer + bridge)', build() {
        const b = builder();
        const S = b.add('ac', 140, 300, 3, { Vp: 17, f: 50 });
        const X = b.add('xfmr', 300, 300, 0, { n: 2 });
        const D1 = b.add('diode', 440, 200, 3), D3 = b.add('diode', 440, 380, 3), D2 = b.add('diode', 520, 200, 3), D4 = b.add('diode', 520, 380, 3);
        const C = b.add('capacitor', 620, 300, 1, { C: 470e-6 });
        const R = b.add('resistor', 720, 300, 1, { R: 1000 });
        const V = b.add('voltmeter', 840, 300);
        const G = b.add('ground', 720, 480);
        b.path([[S, 1], [140, 200], [220, 200], [220, 280], [X, 0]], RED);
        b.path([[S, 0], [140, 400], [220, 400], [220, 320], [X, 1]], BLK);
        b.path([[X, 2], [440, 280]], ORG); b.path([[440, 280], [D1, 0]], ORG); b.path([[D3, 1], [440, 280]], ORG);
        b.path([[X, 3], [520, 320]], GRN); b.path([[520, 320], [D2, 0]], GRN); b.path([[520, 320], [D4, 1]], GRN);
        b.path([[D1, 1], [520, 160]], RED); b.path([[D2, 1], [520, 160]], RED); b.path([[520, 160], [620, 160]], RED);
        b.path([[620, 160], [C, 0]], RED); b.path([[620, 160], [720, 160]], RED); b.path([[720, 160], [R, 0]], RED); b.path([[720, 160], [900, 160], [900, 380], [860, 380], [V, 1]], RED);
        b.path([[D3, 0], [440, 440]], BLK); b.path([[D4, 0], [520, 440]], BLK); b.path([[440, 440], [520, 440]], BLK); b.path([[520, 440], [620, 440]], BLK);
        b.path([[C, 1], [620, 440]], BLK); b.path([[620, 440], [720, 440]], BLK); b.path([[R, 1], [720, 440]], BLK); b.path([[720, 440], [G, 0]], BLK);
        b.path([[V, 0], [820, 440], [720, 440]], BLK);
        return b.done();
      },
    },
    {
      id: 'sensors', name: '热敏 / 光敏电阻分压 (NTC & LDR sensors)', build() {
        const b = builder();
        const B = b.add('battery', 100, 300, 3, { V: 5 });
        const Gb = b.add('ground', 100, 420);
        const cols = [[260, 'ntc', { pos: 0.375 }], [560, 'ldr', { pos: 0.5 }]];
        b.path([[B, 0], [Gb, 0]], BLK);
        b.path([[B, 1], [100, 120], [260, 120]], RED);
        cols.forEach(([x, type, pr], i) => {
          const R1 = b.add('resistor', x, 200, 1, { R: 10000 });
          const Sx = b.add(type, x, 320, 1, pr);
          const G = b.add('ground', x, 400), Gv = b.add('ground', x + 60, 320);
          const V = b.add('voltmeter', x + 120, 200);
          if (i === 0) { b.path([[260, 120], [560, 120]], RED); b.path([[260, 120], [R1, 0]], RED); } else b.path([[560, 120], [R1, 0]], RED);
          b.path([[R1, 1], [x, 260]], BLU); b.path([[x, 260], [Sx, 0]], BLU); b.path([[x, 260], [x + 140, 260], [V, 1]], BLU);
          b.path([[Sx, 1], [G, 0]], BLK);
          b.path([[V, 0], [x + 60, 240], [Gv, 0]], BLK);
        });
        return b.done();
      },
    },
    {
      id: 'boost', name: 'DC-DC 升压模块 3.7V→12V (Boost module MT3608)', build() {
        const b = builder();
        const B = b.add('battery', 140, 340, 0, { V: 3.7, r: 0.05 });
        const U1 = b.add('boost', 440, 240, 0, { Vout: 12 });
        const A1 = b.add('ammeter', 260, 460), V1 = b.add('voltmeter', 260, 100);
        const L = b.add('bulb', 760, 300, 1, { Vr: 12, Pr: 5 });
        const A2 = b.add('ammeter', 620, 460), V2 = b.add('voltmeter', 900, 420);
        const lt = b.tp(L, 0)[1] < b.tp(L, 1)[1] ? 0 : 1, lb = 1 - lt;
        // input: battery + → VIN+, VIN− → A1 → battery −, V1 across the battery
        b.path([[B, 1], [200, 220], [280, 220]], RED); b.path([[280, 220], [U1, 0]], RED);
        b.path([[U1, 1], [340, 260], [340, 500], [A1, 1]], BLK); b.path([[A1, 0], [80, 500], [B, 0]], BLK);
        b.path([[V1, 1], [280, 220]], RED); b.path([[V1, 0], [240, 170], [40, 170], [40, 340], [B, 0]], BLK);
        // output: VOUT+ → bulb → A2 → VOUT−, V2 across the bulb
        b.path([[U1, 2], [760, 220]], RED); b.path([[760, 220], [L, lt]], RED); b.path([[760, 220], [920, 220], [V2, 1]], RED);
        b.path([[L, lb], [760, 420]], BLK); b.path([[760, 420], [760, 500], [A2, 1]], BLK); b.path([[A2, 0], [540, 500], [540, 260], [U1, 3]], BLK);
        b.path([[V2, 0], [880, 480], [800, 480], [800, 420], [760, 420]], BLK);
        return b.done();
      },
    },
    {
      id: 'reg7805', name: '7805 稳压 9V→5V (Linear regulator)', build() {
        const b = builder();
        const B = b.add('battery', 160, 360, 3, { V: 9, r: 0.2 });
        const U1 = b.add('reg78xx', 400, 240, 0, { part: '7805' });
        const C1 = b.add('ccap', 280, 360, 1, { C: 330e-9 }), C2 = b.add('ecap', 520, 360, 1, { C: 100e-6, Vr: 16 });
        const R = b.add('resistor', 640, 360, 1, { R: 100 });
        const V1 = b.add('voltmeter', 260, 180), V2 = b.add('voltmeter', 720, 180);
        const G1 = b.add('ground', 240, 260), G2 = b.add('ground', 700, 260), G3 = b.add('ground', 400, 440);
        b.path([[B, 1], [160, 300], [280, 300]], RED); b.path([[280, 300], [380, 300], [U1, 0]], RED); b.path([[280, 300], [C1, 0]], RED); b.path([[V1, 1], [280, 300]], RED);
        b.path([[U1, 2], [420, 300], [520, 300]], ORG); b.path([[520, 300], [C2, 0]], ORG); b.path([[520, 300], [640, 300]], ORG); b.path([[640, 300], [R, 0]], ORG); b.path([[640, 300], [740, 300], [V2, 1]], ORG);
        b.path([[B, 0], [160, 420], [280, 420]], BLK); b.path([[C1, 1], [280, 420]], BLK); b.path([[280, 420], [400, 420]], BLK); b.path([[U1, 1], [400, 420]], BLK); b.path([[400, 420], [G3, 0]], BLK);
        b.path([[400, 420], [520, 420]], BLK); b.path([[C2, 1], [520, 420]], BLK); b.path([[520, 420], [640, 420], [R, 1]], BLK);
        b.path([[V1, 0], [G1, 0]], BLK); b.path([[V2, 0], [G2, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'lm317', name: 'LM317 可调稳压 Vout=1.25(1+R2/R1)', build() {
        const b = builder();
        const U1 = b.add('lm317', 400, 240, 0);
        const B = b.add('battery', 860, 380, 3, { V: 12, r: 0.1 });
        const R1 = b.add('resistor', 300, 300, 1, { R: 240 });
        const P = b.add('pot', 220, 360, 1, { R: 2000, pos: 0.36 });
        const C2 = b.add('ecap', 480, 400, 1, { C: 10e-6, Vr: 25 });
        const L = b.add('resistor', 600, 400, 1, { R: 330 });
        const V = b.add('voltmeter', 700, 400, 3);
        b.path([[U1, 2], [420, 280], [860, 280], [B, 1]], RED);
        b.path([[U1, 0], [R1, 0]], BLU); b.path([[300, 260], [220, 260], [P, 0]], BLU);
        b.path([[P, 2], [260, 400], [P, 1]], BLU);
        b.path([[U1, 1], [400, 340]], ORG); b.path([[R1, 1], [400, 340]], ORG); b.path([[400, 340], [480, 340]], ORG); b.path([[480, 340], [C2, 0]], ORG);
        b.path([[480, 340], [600, 340]], ORG); b.path([[600, 340], [L, 0]], ORG); b.path([[600, 340], [740, 340], [V, 1]], ORG);
        b.path([[P, 1], [220, 460], [480, 460]], BLK); b.path([[C2, 1], [480, 460]], BLK); b.path([[480, 460], [600, 460]], BLK); b.path([[L, 1], [600, 460]], BLK);
        b.path([[600, 460], [740, 460]], BLK); b.path([[V, 0], [740, 460]], BLK); b.path([[740, 460], [860, 460], [B, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'rgbmix', name: 'RGB LED 调色 (3 个电位器混色)', build() {
        const b = builder();
        const B = b.add('battery', 100, 300, 3, { V: 5 });
        const Gb = b.add('ground', 100, 380);
        const Q = b.add('rgbled', 600, 300, 0);
        const Gk = b.add('ground', 580, 440);
        const ch = [[260, 0, 150, 0.0], [820, 2, 100, 0.12], [700, 3, 100, 1.0]];
        const parts = ch.map(([x, pin, r, pos]) => ({ x, pin, P: b.add('pot', x, 200, 1, { R: 2000, pos }), R: b.add('resistor', x, 300, 1, { R: r }) }));
        b.path([[B, 0], [Gb, 0]], BLK);
        b.path([[B, 1], [100, 120], [260, 120]], RED); b.path([[260, 120], [700, 120]], RED); b.path([[700, 120], [820, 120]], RED);
        for (const { x, P, R } of parts) {
          b.path([[x, 120], [P, 0]], RED);
          b.path([[P, 2], [x + 40, 240], [P, 1]], GRN); b.path([[P, 1], [R, 0]], GRN);
        }
        const [pr, pg, pb] = parts;
        b.path([[pr.R, 1], [260, 360], [560, 360], [Q, 0]], RED);
        b.path([[pg.R, 1], [820, 400], [600, 400], [Q, 2]], GRN);
        b.path([[pb.R, 1], [700, 360], [620, 360], [Q, 3]], BLU);
        b.path([[Q, 1], [Gk, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'opto', name: '光耦隔离 PC817 (Optocoupler isolation)', build() {
        const b = builder();
        const O = b.add('opto', 500, 300, 0);
        const B1 = b.add('battery', 160, 300, 3, { V: 5 }), B2 = b.add('battery', 840, 300, 3, { V: 9 });
        const S = b.add('switch', 260, 200, 0, { closed: true });
        const R1 = b.add('resistor', 380, 200, 0, { R: 330 });
        const L = b.add('led', 720, 200, 2, { color: 'green' });
        const R2 = b.add('resistor', 620, 200, 0, { R: 680 });
        b.path([[B1, 1], [160, 200], [S, 0]], RED); b.path([[S, 1], [R1, 0]], RED); b.path([[R1, 1], [440, 200], [440, 280], [O, 0]], RED);
        b.path([[O, 1], [440, 320], [440, 400], [160, 400], [B1, 0]], BLK);
        b.path([[B2, 1], [840, 200], [L, 0]], ORG); b.path([[L, 1], [R2, 1]], ORG); b.path([[R2, 0], [560, 200], [560, 280], [O, 2]], ORG);
        b.path([[O, 3], [560, 320], [560, 400], [840, 400], [B2, 0]], BLU);
        return b.done();
      },
    },
    {
      id: 'scr', name: '可控硅自锁 SCR latch (触发 / 复位)', build() {
        const b = builder();
        const B = b.add('battery', 120, 260, 3, { V: 9 });
        const Rst = b.add('button', 260, 60, 0, { nc: true });
        const S1 = b.add('button', 400, 160, 1);
        const Rg = b.add('resistor', 400, 280, 1, { R: 1000 });
        const T = b.add('scr', 560, 340, 2);
        const RL = b.add('resistor', 560, 240, 1, { R: 470 });
        const L = b.add('led', 560, 120, 1, { color: 'red' });
        b.path([[B, 1], [120, 60], [Rst, 0]], RED); b.path([[Rst, 1], [400, 60]], RED); b.path([[400, 60], [560, 60], [L, 0]], RED); b.path([[400, 60], [S1, 0]], RED);
        b.path([[S1, 1], [Rg, 0]], ORG); b.path([[Rg, 1], [T, 2]], ORG);
        b.path([[L, 1], [RL, 0]], RED); b.path([[RL, 1], [T, 1]], RED);
        b.path([[T, 0], [620, 320], [620, 440], [120, 440], [B, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'buckaa', name: '4×AA 电池盒 + 降压模块 LM2596 → 3.3V', build() {
        const b = builder();
        const H = b.add('aaholder', 140, 340, 3, { n: 4, chem: 'alk' });
        const U1 = b.add('buck', 440, 240, 0, { Vout: 3.3 });
        const A1 = b.add('ammeter', 260, 460), V1 = b.add('voltmeter', 260, 100);
        const L = b.add('bulb', 760, 300, 1, { Vr: 3.3, Pr: 1 });
        const A2 = b.add('ammeter', 620, 460), V2 = b.add('voltmeter', 900, 420);
        const lt = b.tp(L, 0)[1] < b.tp(L, 1)[1] ? 0 : 1, lb = 1 - lt;
        b.path([[H, 1], [140, 220], [280, 220]], RED); b.path([[280, 220], [U1, 0]], RED); b.path([[V1, 1], [280, 220]], RED);
        b.path([[U1, 1], [340, 260], [340, 500], [A1, 1]], BLK); b.path([[A1, 0], [140, 500]], BLK); b.path([[140, 500], [H, 0]], BLK);
        b.path([[V1, 0], [240, 160], [60, 160], [60, 500], [140, 500]], BLK);
        b.path([[U1, 2], [760, 220]], RED); b.path([[760, 220], [L, lt]], RED); b.path([[760, 220], [920, 220], [V2, 1]], RED);
        b.path([[L, lb], [760, 420]], BLK); b.path([[760, 420], [760, 500], [A2, 1]], BLK); b.path([[A2, 0], [540, 500], [540, 260], [U1, 3]], BLK);
        b.path([[V2, 0], [880, 480], [800, 480], [800, 420], [760, 420]], BLK);
        return b.done();
      },
    },
    // ===== v7: protection / sensor / driver parts =====
    {
      id: 'movsurge', name: '压敏电阻浪涌保护 14D471K (MOV surge clamp)', build() {
        // 220 V mains → 100 mH line choke → MOV ∥ 40 W bulb.  Surge generator: 220 µF charged to 1 kV,
        // dumped through 10 Ω by the push-button (τ≈2 ms pulse).  Delete the MOV to see what the bulb would get.
        const b = builder();
        const S = b.add('ac', 100, 310, 1, { Vp: 311, f: 50 });
        const Rl = b.add('inductor', 240, 160, 0, { L: 0.1 });
        const M = b.add('mov', 380, 310, 1, { part: '14D471K' });
        const L = b.add('bulb', 500, 310, 1, { Vr: 220, Pr: 40 });
        const Rs = b.add('resistor', 640, 220, 1, { R: 10 });
        const K = b.add('tactile', 660, 300, 0);
        const C = b.add('capacitor', 640, 380, 1, { C: 220e-6 });
        const Rc = b.add('resistor', 720, 340, 0, { R: 1000 });
        const HV = b.add('battery', 800, 400, 3, { V: 1000 });
        const O = b.add('scope', 900, 200, 0, { tdiv: 0.005, v1div: 200, ch2on: false, trig: 'roll' });
        b.path([[S, 0], [100, 160], [Rl, 0]], RED); b.path([[Rl, 1], [380, 160]], RED);
        b.path([[380, 160], [M, 0]], RED); b.path([[380, 160], [500, 160]], RED); b.path([[500, 160], [L, 0]], RED); b.path([[500, 160], [640, 160]], RED);
        b.path([[640, 160], [Rs, 0]], ORG); b.path([[Rs, 1], [K, 0]], ORG); b.path([[K, 2], [C, 0]], ORG); b.path([[C, 0], [Rc, 0]], ORG); b.path([[Rc, 1], [HV, 1]], ORG);
        b.path([[O, 0], [860, 120], [640, 120], [640, 160]], YEL);
        b.path([[S, 1], [100, 460], [380, 460]], BLK); b.path([[M, 1], [380, 460]], BLK); b.path([[380, 460], [500, 460]], BLK); b.path([[L, 1], [500, 460]], BLK);
        b.path([[500, 460], [640, 460]], BLK); b.path([[C, 1], [640, 460]], BLK); b.path([[640, 460], [800, 460]], BLK); b.path([[HV, 0], [800, 460]], BLK);
        b.path([[O, 2], [940, 460], [800, 460]], BLK);
        return b.done();
      },
    },
    {
      id: 'tl431', name: 'TL431 可调基准 Vout=2.495×(1+R1/R2)', build() {
        const b = builder();
        const B = b.add('battery', 120, 320, 3, { V: 12 });
        const Rs = b.add('resistor', 200, 160, 0, { R: 1000 });
        const R1 = b.add('resistor', 300, 220, 1, { R: 10000 });
        const R2 = b.add('resistor', 300, 360, 1, { R: 10000 });
        const T = b.add('tl431', 400, 260, 0);
        const V = b.add('voltmeter', 640, 300, 0);
        b.path([[B, 1], [120, 160], [Rs, 0]], RED); b.path([[Rs, 1], [300, 160]], RED); b.path([[300, 160], [R1, 0]], RED);
        b.path([[300, 160], [440, 160]], RED); b.path([[T, 2], [420, 300], [440, 300], [440, 160]], RED); b.path([[440, 160], [660, 160], [V, 1]], RED);
        b.path([[R1, 1], [300, 280]], BLU); b.path([[300, 280], [R2, 0]], BLU); b.path([[T, 0], [300, 280]], BLU);
        b.path([[B, 0], [120, 460], [300, 460]], BLK); b.path([[R2, 1], [300, 460]], BLK); b.path([[300, 460], [400, 460]], BLK); b.path([[T, 1], [400, 460]], BLK);
        b.path([[400, 460], [620, 460], [V, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'nightlight', name: 'LM393 比较器 + 光敏电阻 小夜灯 (Night light)', build() {
        const b = builder();
        const B = b.add('battery', 100, 340, 3, { V: 5 });
        const Ld = b.add('ldr', 200, 200, 1, { pos: 0.15 });
        const Rd = b.add('resistor', 200, 440, 1, { R: 10000 });
        const Ra = b.add('resistor', 300, 200, 1, { R: 10000 });
        const Rb = b.add('resistor', 300, 440, 1, { R: 10000 });
        const U1 = b.add('lm393', 480, 300, 0);
        const Rl = b.add('resistor', 420, 170, 1, { R: 330 });
        const L = b.add('led', 420, 270, 1, { color: 'yellow' });
        b.path([[B, 1], [100, 120], [200, 120]], RED); b.path([[200, 120], [Ld, 0]], RED); b.path([[200, 120], [300, 120]], RED); b.path([[300, 120], [Ra, 0]], RED);
        b.path([[300, 120], [420, 120]], RED); b.path([[420, 120], [Rl, 0]], RED); b.path([[420, 120], [450, 120], [U1, 7]], RED);
        b.path([[Rl, 1], [L, 0]], RED); b.path([[L, 1], [420, 340], [450, 340], [U1, 0]], ORG);
        b.path([[Ld, 1], [200, 380]], GRN); b.path([[200, 380], [Rd, 0]], GRN); b.path([[U1, 2], [490, 380], [200, 380]], GRN);
        b.path([[Ra, 1], [300, 350]], BLU); b.path([[300, 350], [Rb, 0]], BLU); b.path([[U1, 1], [470, 350], [300, 350]], BLU);
        b.path([[B, 0], [100, 520], [200, 520]], BLK); b.path([[Rd, 1], [200, 520]], BLK); b.path([[200, 520], [300, 520]], BLK); b.path([[Rb, 1], [300, 520]], BLK);
        b.path([[300, 520], [510, 520], [U1, 3]], BLK);
        return b.done();
      },
    },
    {
      id: 'l298n', name: 'L298N 电机驱动 正转 / 反转 / 刹车', build() {
        const b = builder();
        const D = b.add('l298n', 500, 260, 0);
        const M = b.add('motor', 300, 260, 1);
        const B = b.add('battery', 300, 520, 0, { V: 12 });
        const S1 = b.add('switch', 500, 480, 1, { closed: true });
        const S2 = b.add('switch', 600, 480, 1, { closed: false });
        b.path([[D, 0], [340, 240], [340, 220], [M, 0]], RED); b.path([[D, 1], [340, 280], [340, 300], [M, 1]], BLU);
        b.path([[B, 1], [420, 520], [D, 4]], RED); b.path([[D, 5], [440, 640], [240, 640], [B, 0]], BLK);
        b.path([[D, 6], [460, 600], [500, 600]], ORG); b.path([[500, 600], [600, 600]], ORG); b.path([[S1, 1], [500, 600]], ORG); b.path([[S2, 1], [600, 600]], ORG);
        b.path([[D, 8], [S1, 0]], YEL); b.path([[D, 9], [520, 400], [600, 400], [S2, 0]], GRN);
        return b.done();
      },
    },
    {
      id: 'relaymod', name: '继电器模块 低电平触发 控制 12V 灯', build() {
        const b = builder();
        const B5 = b.add('battery', 100, 310, 3, { V: 5 });
        const R = b.add('relaymod', 500, 300, 0, { trig: 'low' });
        const S = b.add('switch', 400, 400, 1, { closed: true });
        const L = b.add('bulb', 680, 200, 0, { Vr: 12, Pr: 5 });
        const B12 = b.add('battery', 760, 300, 3, { V: 12 });
        b.path([[B5, 1], [100, 160], [380, 160], [380, 280], [R, 0]], RED);
        b.path([[R, 1], [340, 300], [340, 460]], BLK); b.path([[B5, 0], [100, 460], [340, 460]], BLK); b.path([[340, 460], [400, 460]], BLK); b.path([[S, 1], [400, 460]], BLK);
        b.path([[R, 2], [400, 320], [S, 0]], YEL);
        b.path([[R, 3], [620, 280], [620, 200], [L, 0]], ORG); b.path([[L, 1], [760, 200], [B12, 1]], RED);
        b.path([[R, 4], [600, 300], [600, 400], [760, 400], [B12, 0]], BLK);
        return b.done();
      },
    },
    {
      id: 'hallreed', name: '霍尔开关 A3144 / 干簧管 + LED (磁铁靠近点亮)', build() {
        const b = builder();
        const B = b.add('battery', 160, 280, 3, { V: 5 });
        const H = b.add('hall', 400, 200, 0, { part: 'A3144', pos: 0.85 });
        const R1 = b.add('resistor', 520, 130, 1, { R: 330 });
        const L1 = b.add('led', 520, 210, 1, { color: 'green' });
        const R2 = b.add('resistor', 660, 130, 1, { R: 330 });
        const L2 = b.add('led', 660, 210, 1, { color: 'red' });
        const K = b.add('reed', 660, 330, 1, { pos: 0 });
        b.path([[B, 1], [160, 80], [300, 80]], RED); b.path([[300, 80], [520, 80]], RED); b.path([[520, 80], [R1, 0]], RED); b.path([[520, 80], [660, 80], [R2, 0]], RED);
        b.path([[H, 0], [380, 240], [300, 240], [300, 80]], RED);
        b.path([[R1, 1], [L1, 0]], RED); b.path([[H, 2], [420, 280], [520, 280], [L1, 1]], ORG);
        b.path([[R2, 1], [L2, 0]], RED); b.path([[L2, 1], [K, 0]], ORG);
        b.path([[B, 0], [160, 460], [400, 460]], BLK); b.path([[H, 1], [400, 460]], BLK); b.path([[400, 460], [660, 460], [K, 1]], BLK);
        return b.done();
      },
    },
    {
      id: 'lcd1602', name: 'LCD1602 液晶屏 上电显示 + 背光', build() {
        const b = builder();
        const D = b.add('lcd1602', 520, 340, 0, { line1: 'Hello, DCACLab!', line2: 't={t} {V}' });
        const B = b.add('battery', 520, 130, 0, { V: 5 });
        const Rv = b.add('resistor', 410, 240, 1, { R: 100000 });
        b.path([[D, 0], [370, 60], [460, 60]], BLK); b.path([[460, 60], [B, 0]], BLK); b.path([[460, 60], [670, 60], [D, 15]], BLK);
        b.path([[D, 1], [390, 200], [410, 200]], RED); b.path([[410, 200], [Rv, 0]], RED); b.path([[410, 200], [580, 200]], RED); b.path([[B, 1], [580, 200]], RED);
        b.path([[580, 200], [650, 200], [D, 14]], RED);
        return b.done();
      },
    },
    {
      id: 'buzzers', name: '有源 / 无源蜂鸣器 + 1kHz 有源晶振 (Buzzers)', build() {
        const b = builder();
        const B = b.add('battery', 120, 270, 3, { V: 5 });
        const S = b.add('switch', 300, 150, 1, { closed: false });
        const AB = b.add('abuzzer', 280, 260, 2);
        const X = b.add('xosc', 500, 160, 0, { f: 1000 });
        const R = b.add('resistor', 600, 210, 0, { R: 100 });
        const PB = b.add('pbuzzer', 640, 380, 2);
        b.path([[B, 1], [120, 80], [300, 80]], RED); b.path([[300, 80], [S, 0]], RED); b.path([[300, 80], [420, 80]], RED); b.path([[X, 0], [480, 210], [420, 210], [420, 80]], RED);
        b.path([[S, 1], [AB, 0]], RED); b.path([[AB, 1], [240, 230], [240, 460]], BLK);
        b.path([[X, 2], [520, 210], [R, 0]], ORG); b.path([[R, 1], [660, 210], [PB, 0]], ORG); b.path([[PB, 1], [600, 350], [600, 460]], BLK);
        b.path([[B, 0], [120, 460], [240, 460]], BLK); b.path([[240, 460], [500, 460]], BLK); b.path([[X, 1], [500, 460]], BLK); b.path([[500, 460], [600, 460]], BLK);
        return b.done();
      },
    },
  ];
  return list;
})();
