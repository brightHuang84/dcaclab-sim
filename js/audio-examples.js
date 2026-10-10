'use strict';
// ===== v14: audio examples (speakers, LM386, TDA2030, PAM8403, crossover, class-AB, clipping …) =====
// Wires only connect at their end points: every wire below ends exactly on a terminal or on a junction point that is the end point of the
// wires that meet there.  Power: a VCC rail (y = vy) and a GND rail (y = gy); K.V / K.G drop a wire from a pin onto them.
const AUDX = (() => {
  const RED = '#d62828', BLK = '#222222', BLU = '#1d5fd1', GRN = '#2a9d3a', YEL = '#f2b705', ORG = '#f77f00', CYA = '#1d9bd1';
  const PRE = '音频：';
  const pxy = (b, p) => (Array.isArray(p) && typeof p[0] === 'object' ? b.tp(p[0], p[1]) : p);
  function kit(b, vy, gy) {
    const K = { vy, gy, gx: [], vx: [] };
    K.P = (pts, col) => b.path(pts, col);
    K.pt = (c, i) => b.tp(c, i);
    // vertical battery (plus up): returns the component
    K.bat = (x, y, V) => { const c = b.add('battery', x, y, 1, { V }); if (!(b.tp(c, 1)[1] < b.tp(c, 0)[1])) c.rot = 3; return c; };
    K.G = (p, x) => { const q = pxy(b, p); x = x === undefined ? q[0] : x; const pts = [q]; if (x !== q[0]) pts.push([x, q[1]]); pts.push([x, gy]); b.path(pts, BLK); K.gx.push(x); };
    K.V = (p, x) => { const q = pxy(b, p); x = x === undefined ? q[0] : x; const pts = [q]; if (x !== q[0]) pts.push([x, q[1]]); pts.push([x, vy]); b.path(pts, RED); K.vx.push(x); };
    K.finish = () => {
      for (const [xs, y, col] of [[K.gx, gy, BLK], [K.vx, vy, RED]]) {
        const u = [...new Set(xs)].sort((p, q) => p - q);
        for (let i = 0; i + 1 < u.length; i++) b.path([[u[i], y], [u[i + 1], y]], col);
        if (y === gy && u.length) b.add('ground', u[0], gy + 20);
      }
    };
    return K;
  }
  const mk = (id, name, fn, vy, gy, dt) => ({ id, name: PRE + name, dt: dt || 0, build() { const b = EXAMPLES.builder(), K = kit(b, vy || 100, gy || 700); fn(b, K); K.finish(); return b.done(); } });
  const list = [];
  const TONE_CODE = [
    '// Melody to a speaker: D8 -> 47 uF coupling capacitor -> volume pot (A taper) -> 8 ohm speaker.',
    '// tone() makes a 5 V square wave; the capacitor removes the DC part, the pot sets the level.',
    'const int SPK_PIN = 8;',
    'const int NOTES = 16;',
    'const int melody[NOTES] = {262, 262, 392, 392, 440, 440, 392, 0,',
    '                           349, 349, 330, 330, 294, 294, 262, 0};',
    'int noteIndex = 0;',
    '',
    'void setup() {',
    '  Serial.begin(9600);',
    '}',
    '',
    'void loop() {',
    '  int f = melody[noteIndex];',
    '  if (f > 0) {',
    '    tone(SPK_PIN, f, 250);',
    '  }',
    '  delay(300);',
    '  noteIndex = (noteIndex + 1) % NOTES;',
    '}',
    '',
  ].join('\n');

  // ---------- shared sub-circuits ----------
  // LM386 amplifier stage; returns { U, J (input junction), SP }
  function lm386(b, K, o) {
    const GEN = b.add('audiogen', 240, 520, 2, Object.assign({ Vpp: 0.1, f: 1000, Zs: 600 }, o.gen || {}));
    const C1 = b.add('capacitor', 380, 520, 0, { C: 10e-6 });
    const U = b.add('lm386', 660, 520, 0, { ver: 'N-3' });
    const C3 = b.add('capacitor', 760, 640, 1, { C: 10e-6 });
    const C2 = b.add('capacitor', 860, 540, 0, { C: 220e-6 });
    const SP = o.load ? null : b.add('speaker', 1000, 500, 0, { Z: 8, P: 1 });
    const B = K.bat(100, 340, 9);
    K.V([B, 1]); K.G([B, 0]); K.G([GEN, 1]);
    b.path([[GEN, 0], [C1, 0]], BLU); b.path([[C1, 1], [500, 520]], BLU); b.path([[500, 520], [U, 2]], BLU);
    K.G([U, 1], 560); K.G([U, 3], 580);
    K.V([U, 5], 740);
    b.path([[U, 6], [760, 500], [C3, 0]], GRN); K.G([C3, 1]);
    b.path([[U, 4], [C2, 0]], ORG); b.path([[C2, 1], [940, 540]], ORG);
    if (SP) { b.path([[940, 540], [SP, 0]], ORG); K.G([SP, 1]); }
    if (o.gain200) {
      const C4 = b.add('capacitor', 540, 420, 1, { C: 10e-6 }), SW = b.add('switch', 640, 380, 0, { closed: true });
      b.path([[U, 0], [540, 480], [C4, 1]], GRN);
      b.path([[C4, 0], [SW, 0]], GRN); b.path([[SW, 1], [720, 380], [720, 480]], GRN); b.path([[720, 480], [U, 7]], GRN);
    }
    let O = null;
    if (!o.noScope) {
      O = b.add('scope', 1100, 250, 0, Object.assign({ tdiv: 2e-3, v1div: o.gain200 ? 0.05 : 0.1, v2div: 2, trig: 'auto' }, o.scope || {}));
      b.path([[500, 520], [500, 330], [O, 0]], YEL);
      b.path([[940, 540], [940, 380]], CYA); b.path([[940, 380], [940, 360], [1100, 360], [O, 1]], CYA);
      K.G([O, 2]);
      if (o.scope2) { const O2 = b.add('scope', 1350, 250, 0, o.scope2); b.path([[940, 380], [1350, 380], [O2, 1]], CYA); K.G([O2, 2]); }
    }
    if (o.load) o.load(b, K);
    return { U, SP, GEN, O };
  }
  list.push(mk('audlm386', 'LM386 功放驱动 8Ω 喇叭 (增益 20)', (b, K) => { lm386(b, K, { gen: { Vpp: 0.2 } }); }));
  list.push(mk('audlm386g', 'LM386 增益 200 (1-8 脚电容开关)', (b, K) => { lm386(b, K, { gain200: true, gen: { Vpp: 0.02 } }); }));
  // 555 astable (layout identical to the 'ne555' example); returns handles.  out = pin-3 point
  function astable(b, K, X, Y, v) {
    const U = b.add('ic555', X, Y, 1), R1 = b.add('resistor', X + 200, Y - 140, 1, { R: v.R1 }), R2 = b.add('resistor', X + 200, Y + 40, 1, { R: v.R2 }), C = b.add('capacitor', X + 200, Y + 140, 1, { C: v.C });
    K.V([R1, 0]); K.V([U, 7], X + 60); K.V([U, 3], X - 100); K.G([U, 0], X - 140); K.G([C, 1]);
    b.path([[U, 6], [X + 200, Y - 20]], BLU); b.path([[R1, 1], [X + 200, Y - 20]], BLU); b.path([[X + 200, Y - 20], [R2, 0]], BLU);
    b.path([[U, 5], [X + 120, Y], [X + 120, Y + 80]], GRN); b.path([[X + 120, Y + 80], [R2, 1]], GRN); b.path([[C, 0], [R2, 1]], GRN);
    b.path([[U, 1], [X - 60, Y - 20], [X - 60, Y + 80], [X + 120, Y + 80]], GRN);
    return { U, R1, R2, C, out: [X - 20, Y], ctrl: [X + 20, Y + 20] };
  }
  // output of a 555: Cc -> Rs -> load placed at the top-left
  function drive555(b, K, X, Y, o, load) {
    b.path([[X - 20, Y], [X - 80, Y], [X - 80, Y - 160], [X - 120, Y - 160]], ORG);
    const Cc = b.add('capacitor', X - 160, Y - 160, 0, { C: 100e-6 }), Rs = b.add('resistor', X - 260, Y - 160, 0, { R: o.Rs || 22 });
    b.path([[Cc, 0], [Rs, 1]], ORG);
    return { Cc, Rs, a: b.tp(Rs, 0) };
  }
  list.push(mk('aud555', '555 方波 + 喇叭 (点开关换音高)', (b, K) => {
    const X = 720, Y = 400, A = astable(b, K, X, Y, { R1: 1000, R2: 10000, C: 100e-9 });
    const D = drive555(b, K, X, Y, { Rs: 22 });
    const SP = b.add('speaker', X - 420, Y - 120, 2, { Z: 8, P: 0.5 });
    b.path([[D.Rs, 0], [SP, 0]], ORG); K.G([SP, 1]);
    const SW = b.add('switch', X + 280, Y + 80, 0, { closed: false }), C2 = b.add('capacitor', X + 320, Y + 160, 1, { C: 100e-9 });
    b.path([[SW, 0], [A.R2, 1]], GRN); b.path([[SW, 1], [C2, 0]], GRN); K.G([C2, 1]);
    const B = K.bat(160, 340, 9); K.V([B, 1]); K.G([B, 0]);
  }, 100, 700));

  list.push(mk('audtone', 'Arduino tone() 旋律 → 隔直电容 + 音量电位器 → 喇叭', (b, K) => {
    const A = b.add('arduino', 400, 380, 0, { code: TONE_CODE });
    const d = b.tp(A, 8), x = d[0];
    const Rs = b.add('resistor', x, 220, 1, { R: 100 }), C = b.add('capacitor', x + 100, 180, 0, { C: 47e-6 }), P = b.add('pot', x + 240, 180, 0, { R: 100, pos: 0.7, taper: 'log' });
    const SP = b.add('speaker', x + 400, 120, 0, { Z: 8, P: 0.25 });
    b.path([[Rs, 0], [x, 180], [C, 0]], ORG); b.path([[C, 1], [P, 0]], ORG);     // D8 → 100 Ω → 47 µF → pot A
    b.path([[P, 2], [x + 240, 100], [x + 360, 100], [x + 360, 160], [SP, 0]], ORG);
    K.G([P, 1]); K.G([SP, 1], x + 460); K.G([A, 24]);
  }, 100, 700));

  list.push(mk('audpam', 'PAM8403 立体声 D 类功放 (jack 3.5 mm → 双喇叭, 开关静音)', (b, K) => {
    const J = b.add('jack35', 300, 300, 2, { Vpp: 0.4, f: 440, fR: 660 });
    const CL = b.add('capacitor', 440, 380, 0, { C: 1e-6 }), CR = b.add('capacitor', 460, 300, 0, { C: 1e-6 });
    const U = b.add('pam8403', 700, 420, 0, { vol: 0.8 });
    const S1 = b.add('speaker', 900, 350, 1, { Z: 4, P: 3 }), S2 = b.add('speaker', 900, 470, 1, { Z: 4, P: 3 });
    const SW = b.add('switch', 560, 500, 1, { closed: false });
    const Bt = K.bat(160, 340, 5); K.V([Bt, 1]); K.G([Bt, 0]);
    b.path([[J, 0], [370, 320], [370, 380], [CL, 0]], GRN);   // T → C_L
    b.path([[J, 1], [380, 300], [CR, 0]], BLU);               // R → C_R
    K.G([J, 2], 350);                                          // S → GND
    b.path([[CL, 1], [U, 0]], GRN);
    b.path([[CR, 1], [540, 300], [540, 400], [U, 1]], BLU);
    K.G([U, 2], 620); K.V([U, 3], 600);
    b.path([[U, 4], [560, 460], [SW, 0]], ORG); K.G([SW, 1]);
    b.path([[U, 6], [800, 380], [800, 330], [S1, 0]], ORG); b.path([[U, 7], [820, 400], [820, 370], [S1, 1]], ORG);
    b.path([[U, 8], [800, 420], [800, 450], [S2, 0]], CYA); b.path([[U, 9], [780, 440], [780, 490], [S2, 1]], CYA);
  }, 100, 700));

  list.push(mk('audpiezo', '555 驱动压电陶瓷片 (无源蜂鸣片)', (b, K) => {
    const X = 720, Y = 400, A = astable(b, K, X, Y, { R1: 1000, R2: 15000, C: 10e-9 });
    const PZ = b.add('piezo', X - 140, Y - 130, 2, {});
    b.path([[X - 20, Y], [X - 80, Y], [X - 80, Y - 160], [PZ, 0]], ORG); K.G([PZ, 1]);
    const B = K.bat(160, 340, 9); K.V([B, 1]); K.G([B, 0]);
  }, 100, 700));

  list.push(mk('audmic', '驻极体话筒 → LM358 前置 → LM386 → 喇叭', (b, K) => {
    const M = b.add('emic', 200, 380, 2, { spl: 74, f: 440, src: 'sine' });
    const Rmb = b.add('resistor', 220, 270, 1, { R: 4700 }), C1 = b.add('capacitor', 300, 370, 0, { C: 1e-6 });
    const Ra = b.add('resistor', 420, 300, 1, { R: 100000 }), Rb = b.add('resistor', 420, 440, 1, { R: 100000 });
    const OA = b.add('opamp', 520, 350, 0, { part: 'LM358' });
    const Rf = b.add('resistor', 520, 250, 0, { R: 47000 }), Rg = b.add('resistor', 460, 430, 1, { R: 1000 }), Cg = b.add('capacitor', 460, 550, 1, { C: 10e-6 });
    const C2 = b.add('capacitor', 680, 350, 0, { C: 4.7e-6 }), P = b.add('pot', 800, 350, 0, { R: 10000, pos: 0.6, taper: 'log' });
    const U = b.add('lm386', 1000, 420, 0, { ver: 'N-3' }), C3 = b.add('capacitor', 1080, 540, 1, { C: 10e-6 });
    const Cc = b.add('capacitor', 1180, 440, 0, { C: 220e-6 }), SP = b.add('speaker', 1300, 400, 0, { Z: 8, P: 1 });
    const O = b.add('scope', 1300, 220, 0, { tdiv: 5e-3, v1div: 0.5, v2div: 1, trig: 'auto' });
    const B = K.bat(100, 340, 12); K.V([B, 1]); K.G([B, 0]);
    K.G([M, 1]); K.V([Rmb, 0]); b.path([[Rmb, 1], [M, 0]], RED);
    b.path([[M, 0], [240, 350], [240, 370], [C1, 0]], BLU);
    b.path([[C1, 1], [OA, 1]], BLU); b.path([[Ra, 1], [420, 370]], BLU); b.path([[Rb, 0], [420, 370]], BLU); K.V([Ra, 0]); K.G([Rb, 1]);
    b.path([[Rf, 0], [460, 250], [460, 330]], GRN); b.path([[460, 330], [OA, 0]], GRN); b.path([[460, 330], [Rg, 0]], GRN); b.path([[Rg, 1], [Cg, 0]], GRN); K.G([Cg, 1]);
    b.path([[OA, 2], [580, 350]], GRN); b.path([[580, 350], [580, 250], [Rf, 1]], GRN); b.path([[580, 350], [C2, 0]], GRN);
    b.path([[C2, 1], [P, 0]], BLU); K.G([P, 1]);
    b.path([[P, 2], [880, 310]], BLU); b.path([[880, 310], [880, 420], [U, 2]], BLU);
    K.G([U, 1], 910); K.G([U, 3], 925); K.V([U, 5], 1100);
    b.path([[U, 6], [1080, 400], [C3, 0]], GRN); K.G([C3, 1]);
    b.path([[U, 4], [Cc, 0]], ORG); b.path([[Cc, 1], [1220, 440]], ORG); b.path([[1220, 440], [SP, 0]], ORG); K.G([SP, 1]);
    b.path([[880, 310], [1260, 310], [O, 0]], YEL); b.path([[1220, 440], [1220, 350], [1300, 350], [O, 1]], CYA); K.G([O, 2]);
  }, 100, 700));

  list.push(mk('audclip', '削波演示：LM386 增益 200 过驱 (示波器 + FFT 谐波)', (b, K) => {
    lm386(b, K, { gain200: true, gen: { Vpp: 0.2, f: 500 }, scope: { v1div: 0.1, v2div: 2, tdiv: 2e-3 }, scope2: { mode: 'fft', fzoom: 1 }, });
    // speaker is part of the helper
  }));

  list.push(mk('audxover', '两分频分频器：LC 一阶 + 低音 / 高音喇叭 (示波器看各路)', (b, K) => {
    lm386(b, K, {
      gen: { wave: 'sweep', f: 100, f2: 4000, tsw: 4, Vpp: 0.2 }, noScope: true,
      load(b, K) {
        const Ct = b.add('capacitor', 1020, 540, 0, { C: 10e-6 }), Lw = b.add('inductor', 1020, 640, 0, { L: 0.64e-3, R: 0.2 });
        const Tw = b.add('speaker', 1160, 500, 0, { Z: 8, P: 0.5 }), Wf = b.add('speaker', 1360, 600, 0, { Z: 8, P: 3 });
        const O = b.add('scope', 1300, 250, 0, { tdiv: 2e-3, v1div: 1, v2div: 1, trig: 'auto' });
        b.path([[940, 540], [Ct, 0]], BLU); b.path([[940, 540], [940, 640], [Lw, 0]], ORG);
        b.path([[Ct, 1], [1100, 540]], BLU); b.path([[1100, 540], [Tw, 0]], BLU); K.G([Tw, 1]);
        b.path([[Lw, 1], [1260, 640]], ORG); b.path([[1260, 640], [Wf, 0]], ORG); K.G([Wf, 1]);
        b.path([[1260, 640], [1260, 330], [O, 0]], ORG); b.path([[1100, 540], [1100, 400], [1300, 400], [O, 1]], BLU);
        b.path([[O, 2], [1440, 330], [1440, 700]], BLK); K.gx.push(1440);
      },
    });
  }));

  list.push(mk('audclassab', '推挽 (AB 类) 晶体管音频放大器 (开关短路二极管 → 交越失真)', (b, K) => {
    const GEN = b.add('audiogen', 200, 480, 2, { Vpp: 3, f: 1000, Zs: 50 });
    const C1 = b.add('capacitor', 310, 480, 0, { C: 10e-6 });
    const Rt = b.add('resistor', 480, 200, 1, { R: 1000 }), D1 = b.add('diode', 480, 320, 1, {}), D2 = b.add('diode', 480, 400, 1, {}), Rb = b.add('resistor', 480, 520, 1, { R: 1000 });
    const SW = b.add('switch', 420, 360, 1, { closed: false });
    const Q1 = b.add('npn', 640, 300, 0, { part: 'S8050' }), Q2 = b.add('pnp', 640, 580, 0, { part: 'S8550' });
    const Cc = b.add('capacitor', 680, 450, 0, { C: 470e-6 }), SP = b.add('speaker', 840, 410, 0, { Z: 16, P: 1 });
    const O = b.add('scope', 1100, 560, 0, { tdiv: 5e-4, v1div: 1, v2div: 1, trig: 'auto' });
    const Bt = K.bat(60, 340, 12); K.V([Bt, 1]); K.G([Bt, 0]); K.G([GEN, 1]);
    b.path([[GEN, 0], [C1, 0]], BLU); b.path([[C1, 1], [440, 480]], BLU); b.path([[440, 480], [440, 360], [480, 360]], BLU);
    // make sure the diode string is oriented anode-up
    const up = (c) => b.tp(c, 0)[1] < b.tp(c, 1)[1]; if (!up(D1)) D1.rot = 3; if (!up(D2)) D2.rot = 3;
    K.V([Rt, 0]); b.path([[Rt, 1], [480, 280]], RED); b.path([[480, 440], [Rb, 0]], BLK); K.G([Rb, 1]);
    b.path([[480, 280], [420, 280], [420, 320]], GRN); b.path([[480, 440], [420, 440], [420, 400]], GRN);   // SW across the two diodes
    b.path([[Q1, 1], [640, 340], [520, 340], [520, 280]], YEL); b.path([[520, 280], [480, 280]], YEL);
    b.path([[Q2, 1], [640, 540], [520, 540], [520, 440]], YEL); b.path([[520, 440], [480, 440]], YEL);
    b.path([[Q1, 0], [580, 320]], ORG); b.path([[Q2, 0], [580, 600]], ORG); b.path([[580, 320], [580, 450]], ORG); b.path([[580, 450], [580, 600]], ORG);
    b.path([[580, 450], [Cc, 0]], ORG);
    K.V([Q1, 2], 700); K.G([Q2, 2], 700);
    b.path([[Cc, 1], [SP, 0]], ORG); K.G([SP, 1]);
    b.path([[440, 480], [440, 660], [1060, 660], [O, 0]], YEL); b.path([[820, 450], [820, 680], [1100, 680], [O, 1]], CYA);
    K.G([O, 2], 1140);
  }, 100, 700));

  list.push(mk('audtda', 'LM358 前置放大 → TDA2030 功放 (单电源 12 V)', (b, K) => {
    const GEN = b.add('audiogen', 200, 400, 2, { Vpp: 0.05, f: 1000, Zs: 600 }), C1 = b.add('capacitor', 320, 400, 0, { C: 1e-6 });
    const Ra = b.add('resistor', 400, 300, 1, { R: 47000 }), Rb = b.add('resistor', 400, 500, 1, { R: 47000 });
    const OA = b.add('opamp', 480, 380, 0, { part: 'LM358' }), Rf = b.add('resistor', 480, 280, 0, { R: 10000 });
    const Rg = b.add('resistor', 430, 480, 1, { R: 1000 }), Cg = b.add('capacitor', 430, 600, 1, { C: 10e-6 });
    const C2 = b.add('capacitor', 640, 380, 0, { C: 4.7e-6 }), Rc = b.add('resistor', 720, 300, 1, { R: 22000 }), Rd = b.add('resistor', 720, 460, 1, { R: 22000 });
    const U = b.add('tda2030', 1000, 500, 0, {}), R1 = b.add('resistor', 900, 600, 0, { R: 1000 }), Cg2 = b.add('capacitor', 800, 600, 0, { C: 47e-6 });
    const R2 = b.add('resistor', 1060, 660, 0, { R: 10000 }), Cc = b.add('capacitor', 1260, 575, 0, { C: 1000e-6 }), SP = b.add('speaker', 1400, 535, 0, { Z: 8, P: 15 });
    const O = b.add('scope', 1250, 250, 0, { tdiv: 1e-3, v1div: 0.2, v2div: 2, trig: 'auto' });
    const Bt = K.bat(100, 340, 12); K.V([Bt, 1]); K.G([Bt, 0]); K.G([GEN, 1]);
    b.path([[GEN, 0], [C1, 0]], BLU); b.path([[C1, 1], [400, 400]], BLU); b.path([[400, 400], [OA, 1]], BLU);
    b.path([[Ra, 1], [400, 400]], BLU); b.path([[Rb, 0], [400, 400]], BLU); K.V([Ra, 0]); K.G([Rb, 1]);
    b.path([[Rf, 0], [430, 280], [430, 360]], GRN); b.path([[430, 360], [OA, 0]], GRN); b.path([[430, 360], [Rg, 0]], GRN); b.path([[Rg, 1], [Cg, 0]], GRN); K.G([Cg, 1]);
    b.path([[OA, 2], [560, 380]], GRN); b.path([[560, 380], [560, 280], [Rf, 1]], GRN); b.path([[560, 380], [C2, 0]], GRN);
    b.path([[C2, 1], [720, 380]], BLU); b.path([[Rc, 1], [720, 380]], BLU); b.path([[Rd, 0], [720, 380]], BLU); K.V([Rc, 0]); K.G([Rd, 1]);
    b.path([[720, 380], [920, 380]], BLU); b.path([[920, 380], [920, 550], [U, 0]], BLU);
    b.path([[U, 1], [980, 600]], GRN); b.path([[R1, 1], [980, 600]], GRN); b.path([[R1, 0], [Cg2, 1]], GRN); K.G([Cg2, 0]);
    b.path([[980, 600], [980, 660], [R2, 0]], GRN); b.path([[R2, 1], [1140, 660], [1140, 575]], ORG);
    K.G([U, 2]); K.V([U, 4], 1100);
    b.path([[U, 3], [1020, 575], [1140, 575]], ORG); b.path([[1140, 575], [Cc, 0]], ORG); b.path([[Cc, 1], [SP, 0]], ORG); K.G([SP, 1]);
    b.path([[920, 380], [920, 330], [O, 0]], YEL); b.path([[1300, 575], [1300, 480], [1250, 480], [O, 1]], CYA);
    b.path([[O, 2], [1330, 330], [1330, 700]], BLK); K.gx.push(1330);
  }, 100, 700));
  // finer time steps (s) for the examples with audio above ~700 Hz (default step 0.2 ms: 5 samples per 1 kHz period)
  const DT = { audlm386: 5e-5, audlm386g: 5e-5, aud555: 1e-4, audpam: 1e-4, audpiezo: 2e-5, audmic: 1e-4, audclip: 5e-5, audxover: 5e-5, audclassab: 5e-5, audtda: 5e-5 };
  list.forEach((e) => { e.dt = DT[e.id] || 0; });
  EXAMPLES.push(...list);
  return { RED, BLK, BLU, GRN, YEL, ORG, CYA, kit, mk, list };
})();
