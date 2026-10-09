'use strict';
// =====================================================================================================================
//  v10 · programmable microcontrollers: an Arduino-Uno-style board and an ATtiny85-style 8-pin chip.
//  Programs (Arduino C/C++ subset or JavaScript, see mcu-lang.js) run as generators on SIMULATED time: every API call
//  advances the program clock, delay() suspends the program until the circuit simulation has caught up, and pin
//  changes are applied at their exact time stamps (the simulator splits its time step there, like the 555 events).
//  Output pins are 25 Ω switches to the chip's own VCC / GND, inputs are high-impedance (optional 35 kΩ pull-up).
// =====================================================================================================================
const MCU = (() => {
  const R_OUT = 25, R_PU = 35e3, V_BOOT = 2.7, V_OFF = 2.4;
  const TP_BACK = 2.5e-7, TP_IO = 3.5e-6, TP_ADC = 1.12e-4, TP_LOOP = 1e-6;
  const BUDGET = 400000;           // non-yielding JavaScript loop iterations allowed per simulation step
  const SER_MAX = 20000;
  class RtErr extends Error { constructor(key, params) { super(key); this.key = key; this.params = params || {}; } }

  // ---------------------------------------------------------------- boards --------------------------------------
  const C16 = (v) => ({ v, ty: MCULANG.T.i16 });
  const COMMON_CONSTS = { HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, DEC: 10, HEX: 16, OCT: 8, BIN: 2, MSBFIRST: 1, LSBFIRST: 0,
    CHANGE: 1, FALLING: 2, RISING: 3, DEFAULT: 1, INTERNAL: 3, EXTERNAL: 0, true: 1, false: 0, NULL: 0, SERIAL_8N1: 6, INT_MAX: 32767, INT_MIN: -32768,
    DHT11: 11, DHT22: 22, DHT21: 21, AM2301: 21, DEVICE_DISCONNECTED_C: -127 };
  const FLOAT_CONSTS = { PI: Math.PI, HALF_PI: Math.PI / 2, TWO_PI: Math.PI * 2, DEG_TO_RAD: Math.PI / 180, RAD_TO_DEG: 180 / Math.PI, EULER: Math.E, DEVICE_DISCONNECTED_F: -196.6 };
  function mkConsts(extra) {
    const o = {};
    for (const [k, v] of Object.entries(COMMON_CONSTS)) o[k] = C16(v);
    o.true = { v: 1, ty: MCULANG.T.bool }; o.false = { v: 0, ty: MCULANG.T.bool };
    for (const [k, v] of Object.entries(FLOAT_CONSTS)) o[k] = { v, ty: MCULANG.T.f };
    for (const [k, v] of Object.entries(extra)) o[k] = C16(v);
    return o;
  }
  const BOARDS = {
    arduino: {
      n: 20, names: [...Array.from({ length: 14 }, (_, i) => 'D' + i), 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
      term: (p) => p, pwm: { 3: 490, 5: 980, 6: 980, 9: 490, 10: 490, 11: 490 },
      adc: (p) => (p >= 14 && p <= 19 ? p : p >= 0 && p <= 5 ? p + 14 : -1),
      pinOf: (p) => (p >= 0 && p < 20 ? p : -1), vcc: 20, gnd: 23,
      consts: mkConsts({ LED_BUILTIN: 13, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, SDA: 18, SCL: 19 }),
      jsConsts: { LED_BUILTIN: 13, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19 },
    },
    attiny85: {
      n: 6, names: ['PB0', 'PB1', 'PB2', 'PB3', 'PB4', 'PB5'],
      term: (p) => [4, 5, 6, 1, 2, 0][p], pwm: { 0: 490, 1: 490, 4: 490 },
      adc: (p) => { const ch = p >= 128 ? p - 128 : p; return ch === 0 ? 5 : ch === 1 ? 2 : ch === 2 ? 4 : ch === 3 ? 3 : -1; },
      pinOf: (p) => (p >= 0 && p < 6 ? p : p >= 128 && p < 132 ? [5, 2, 4, 3][p - 128] : -1), vcc: 7, gnd: 3,
      consts: mkConsts({ LED_BUILTIN: 1, A0: 128, A1: 129, A2: 130, A3: 131, PB0: 0, PB1: 1, PB2: 2, PB3: 3, PB4: 4, PB5: 5 }),
      jsConsts: { LED_BUILTIN: 1, A0: 128, A1: 129, A2: 130, A3: 131, PB0: 0, PB1: 1, PB2: 2, PB3: 3, PB4: 4, PB5: 5 },
    },
  };

  // ---------------------------------------------------------------- runtime --------------------------------------
  class McuRT {
    constructor(c, app, t) {
      const B = BOARDS[c.type];
      this.c = c; this.app = app; this.B = B; this.n = B.n;
      this.tp = t; this.tBoot = t; this.tnow = t; this.lim = t; this.minsp = 2e-6;
      this.ln = 0; this.ops = 0; this.pend = []; this.pn = 0; this.hw = [];
      this.modeP = new Uint8Array(B.n); this.outP = new Uint8Array(B.n);     // program view (DDR / PORT latches)
      this.hMode = new Uint8Array(B.n); this.hOut = new Uint8Array(B.n);     // electrical view, updated at event times
      this.hDuty = new Float64Array(B.n).fill(-1);
      this.inLvl = new Uint8Array(B.n);
      this.arefMode = 0; this.seedv = 12345; this.err = null; this.done = false; this.txT = -1;
      this.src = c.props.code; this.lang = c.props.lang;
      c.state.ser = c.state.ser || ''; c.state.sin = [];
      this.sin = c.state.sin;
      this.servos = []; this.toneCh = null;
      this.compiled = MCULANG.compile(this.src || '', this.lang === 'js' ? 'js' : 'ino', B.consts);
      if (!this.compiled.ok) { this.err = Object.assign({ compile: true }, this.compiled.error); return; }
      try { this.P = this.lang === 'js' ? this.compiled.factory(this, ...this.jsApi()) : this.compiled.factory(this); }
      catch (e) { this.fault(e); return; }
      this.gen = this.main();
    }
    // ---- scheduling
    *main() {
      const P = this.P;
      if (P.init) yield* P.init();
      if (!P.setup || !P.loop) throw new RtErr('no_setup_loop');
      const call = function* (f) { const r = f(); if (r && typeof r.next === 'function') yield* r; };
      yield* call(P.setup);
      for (;;) {
        this.tp += TP_LOOP;
        yield* call(P.loop);
        if (this.tp >= this.lim || this.pn) yield 0;
      }
    }
    // run the program from electrical time tc up to t1 (or until it produced a timed pin change); fire due events;
    // return the time of the next pending pin event (> tc + minsp) or Infinity
    advance(tc, t1, solved) {
      this.tnow = tc;
      this.fireAt(tc);
      if (this.gen && !this.err && solved && !this.pn && this.tp < t1) {
        if (this.tp < tc - 0.05) this.tp = tc;
        // v11: stop at the next timed sensor edge (e.g. HC-SR04 ECHO) so inputs are read at the exact simulated time
        this.lim = this.app.nextDEdge ? Math.min(t1, this.app.nextDEdge(tc)) : t1; this.ops = 0;
        try { this.gen.next(); } catch (e) { this.fault(e); }
        this.fireAt(tc);
      }
      return this.nextT();
    }
    nextT() {
      let te = this.pend.length ? this.pend[0].t : Infinity;
      for (const ch of this.hw) if (ch.tNext < te) te = ch.tNext;
      return te;
    }
    // schedule an electrical change at the current program time
    at(fn) {
      const t = this.tp;
      if (t <= this.tnow + this.minsp && !this.pend.length) fn(this.tnow);
      else { this.pend.push({ t, fn }); this.pn = this.pend.length; }
    }
    fireAt(t) {
      const lim = t + this.minsp;
      let k = 0;
      while (k < this.pend.length && this.pend[k].t <= lim) { this.pend[k].fn(this.pend[k].t); k++; }
      if (k) { this.pend.splice(0, k); this.pn = this.pend.length; }
      for (const ch of this.hw) {
        if (ch.tNext <= lim && t - ch.tNext > 4 * (ch.T || 0.02)) ch.resync(t);
        let guard = 0;
        while (ch.tNext <= lim && guard++ < 64) ch.step(ch.tNext);
      }
      this.sync(t);
    }
    // ---- electrical side
    driveOf(p) {
      for (const s of this.servos) if (s.ch && s.ch.pin === p) return s.ch.level;
      if (this.toneCh && this.toneCh.pin === p) return this.toneCh.avg ? 0.5 : this.toneCh.level;
      if (this.hMode[p] === 1) {
        const ch = this.pwmCh(p);
        if (ch) return ch.avg ? ch.duty : ch.level;
        return this.hOut[p] ? 1 : 0;
      }
      return this.hOut[p] ? -2 : -1;
    }
    sync(t) { for (let p = 0; p < this.n; p++) setDrive(this.c, p, this.driveOf(p), t, this.app); }
    pwmCh(p) { for (const ch of this.hw) if (ch.kind === 'pwm' && ch.pin === p) return ch; return null; }
    dropCh(ch) { const i = this.hw.indexOf(ch); if (i >= 0) this.hw.splice(i, 1); }
    hwSet(p, mode, out, duty, t) {
      this.hMode[p] = mode; this.hOut[p] = out;
      const f = this.B.pwm[p];
      let ch = this.pwmCh(p);
      if (mode === 1 && duty >= 0 && f) {
        const T = 1 / f;
        if (!ch) {
          ch = { kind: 'pwm', pin: p, T, duty, level: 0, fall: false, t0: 0, tNext: Infinity, avg: T < 4 * this.app.dt };
          const tb = this.tBoot;
          ch.cyc = (tt) => tb + Math.floor((tt - tb) / T + 1e-9) * T;
          ch.step = function (tt) {
            if (this.avg) { this.tNext = Infinity; return; }
            if (this.level === 1 && this.fall) { this.level = 0; this.fall = false; this.tNext = this.t0 + T; return; }
            this.t0 = tt;
            if (this.duty >= 1) { this.level = 1; this.fall = false; this.tNext = tt + T; }
            else if (this.duty <= 0) { this.level = 0; this.fall = false; this.tNext = tt + T; }
            else { this.level = 1; this.fall = true; this.tNext = tt + this.duty * T; }
          };
          ch.resync = function (tt) { this.t0 = this.cyc(tt); this.level = 0; this.fall = false; this.tNext = this.t0 + T; };
          this.hw.push(ch);
          if (!ch.avg) {
            ch.t0 = ch.cyc(t);
            if (t - ch.t0 < duty * T) { ch.level = 1; ch.fall = true; ch.tNext = ch.t0 + duty * T; }
            else ch.tNext = ch.t0 + T;
          }
        } else {
          ch.duty = duty;
          if (!ch.avg && ch.level === 1 && ch.fall) {
            const tf = ch.t0 + duty * T;
            if (tf <= t) { ch.level = 0; ch.fall = false; ch.tNext = ch.t0 + T; } else ch.tNext = tf;
          }
        }
      } else if (ch) this.dropCh(ch);
    }
    // ---- helpers used by the generated code
    pin(p) { return this.B.pinOf(Math.trunc(+p)); }
    bk() { this.tp += TP_BACK; return this.tp >= this.lim || this.pn > 0; }
    g() { if (++this.ops > BUDGET) throw new RtErr('runaway'); this.tp += TP_BACK; }
    run(it) { if (it && typeof it.next === 'function') { let r; while (!(r = it.next()).done) { this.g(); } return r.value; } return it; }
    *yld() { if (this.tp >= this.lim || this.pn) yield 0; }
    *pm(p, m) {
      this.tp += TP_IO; const k = this.pin(p);
      if (k >= 0) {
        m = Math.trunc(+m);
        if (m === 1) this.modeP[k] = 1; else { this.modeP[k] = 0; this.outP[k] = m === 2 ? 1 : 0; }
        this.pwmOff(k); this.apply(k);
      }
      if (this.tp >= this.lim || this.pn) yield 0;
    }
    *dw(p, v) {
      this.tp += TP_IO; const k = this.pin(p);
      if (k >= 0) { this.outP[k] = v ? 1 : 0; this.pwmOff(k); this.apply(k); }
      if (this.tp >= this.lim || this.pn) yield 0;
    }
    *aw(p, v) {
      this.tp += TP_IO; const k = this.pin(p);
      if (k >= 0) {
        v = Math.trunc(+v) || 0; this.modeP[k] = 1;
        if (v <= 0) { this.outP[k] = 0; this.pwmOff(k); }
        else if (v >= 255) { this.outP[k] = 1; this.pwmOff(k); }
        else if (this.B.pwm[k]) { this.outP[k] = 0; this.duty = this.duty || {}; this.duty[k] = v / 255; }
        else { this.outP[k] = v < 128 ? 0 : 1; this.pwmOff(k); }
        this.apply(k);
      }
      if (this.tp >= this.lim || this.pn) yield 0;
    }
    pwmOff(k) { if (this.duty) delete this.duty[k]; }
    apply(k) {
      const mode = this.modeP[k], out = this.outP[k], duty = this.duty && this.duty[k] !== undefined ? this.duty[k] : -1;
      this.at((t) => this.hwSet(k, mode, out, duty, t));
    }
    level(k) {   // logic level seen by the input buffer (Schmitt-like thresholds 0.3 / 0.6 VCC)
      const c = this.c, m = this.app.net; if (!m || !c._nodes) return 0;
      const n = c._nodes, g = m.v(n[this.B.gnd]), vcc = Math.max(m.v(n[this.B.vcc]) - g, 0.1), v = m.v(n[this.B.term(k)]) - g;
      if (v > 0.6 * vcc) this.inLvl[k] = 1; else if (v < 0.3 * vcc) this.inLvl[k] = 0;
      return this.inLvl[k];
    }
    dr(p) {
      this.tp += TP_IO; const k = this.pin(p); if (k < 0) return 0;
      if (this.modeP[k] === 1) return this.outP[k];
      return this.level(k);
    }
    ar(p) {
      this.tp += TP_ADC; const k = this.B.adc(Math.trunc(+p)); if (k < 0) return 0;
      const c = this.c, m = this.app.net; if (!m || !c._nodes) return 0;
      const n = c._nodes, g = m.v(n[this.B.gnd]), vcc = m.v(n[this.B.vcc]) - g, ref = this.arefMode === 3 ? 1.1 : Math.max(vcc, 0.5);
      const v = m.v(n[this.B.term(k)]) - g;
      return U.clamp(Math.floor(v / ref * 1024), 0, 1023);
    }
    aref(x) { this.arefMode = Math.trunc(+x); }
    *dly(ms) { ms = +ms; if (ms > 0) this.tp += ms * 1e-3; if (this.tp >= this.lim || this.pn) yield 0; }
    *dlyu(us) { us = +us; if (us > 0) this.tp += us * 1e-6; if (this.tp >= this.lim || this.pn) yield 0; }
    ms() { return Math.floor((this.tp - this.tBoot) * 1000 + 1e-6) >>> 0; }
    upMs(t) { return Math.max(0, Math.floor((t - this.tBoot) * 1000 + 1e-6)); }   // wall-clock (simulated) uptime for display
    us() { return (Math.floor((this.tp - this.tBoot) * 1e6 / 4 + 1e-6) * 4) >>> 0; }
    *tone(p, f, d) {
      this.tp += TP_IO; const k = this.pin(p);
      if (k >= 0 && f > 0) {
        this.modeP[k] = 1; const tEnd = d > 0 ? this.tp + d * 1e-3 : Infinity;
        this.at((t) => {
          if (this.toneCh) this.dropCh(this.toneCh);
          const T = 1 / Math.max(31, f), ch = { kind: 'tone', pin: k, T, level: 1, t0: t, tEnd, avg: T < 4 * this.app.dt, tNext: 0 };
          ch.step = function (tt) {
            if (tt >= this.tEnd - 1e-12) { this.rt.toneEnd(this); return; }
            if (this.avg) { this.tNext = this.tEnd; return; }
            this.level = 1 - this.level; this.tNext = Math.min(tt + T / 2, this.tEnd);
          };
          ch.resync = function (tt) { this.level = 0; this.tNext = Math.min(tt + T / 2, this.tEnd); };
          ch.rt = this; ch.tNext = ch.avg ? tEnd : Math.min(t + T / 2, tEnd);
          this.toneCh = ch; this.hw.push(ch);
        });
      }
      if (this.tp >= this.lim || this.pn) yield 0;
    }
    toneEnd(ch) { this.dropCh(ch); if (this.toneCh === ch) this.toneCh = null; this.hOut[ch.pin] = 0; this.hMode[ch.pin] = 1; }
    *notone(p) {
      this.tp += TP_IO; const k = this.pin(p);
      this.at(() => { if (this.toneCh && (k < 0 || this.toneCh.pin === k)) this.toneEnd(this.toneCh); });
      if (k >= 0) this.outP[k] = 0;
      if (this.tp >= this.lim || this.pn) yield 0;
    }
    *pulseIn(p, state, timeout) {
      const k = this.pin(p); if (k < 0) return 0;
      const to = (timeout === undefined ? 1e6 : +timeout) * 1e-6, t0 = this.tp, want = state ? 1 : 0, dt = 4e-6;
      const self = this;
      function* waitFor(lv) { while (self.level(k) !== lv) { self.tp += dt; if (self.tp - t0 > to) return false; if (self.tp >= self.lim || self.pn) yield 0; } return true; }
      if (!(yield* waitFor(1 - want))) return 0;
      if (!(yield* waitFor(want))) return 0;
      const ts = this.tp;
      if (!(yield* waitFor(1 - want))) return 0;
      return Math.round((this.tp - ts) * 1e6) >>> 0;
    }
    *shiftOut(d, c, order, val) {
      for (let i = 0; i < 8; i++) {
        const b = order === 0 ? (val >> i) & 1 : (val >> (7 - i)) & 1;
        yield* this.dw(d, b); yield* this.dw(c, 1); yield* this.dw(c, 0);
      }
    }
    *shiftIn(d, c, order) {
      let v = 0;
      for (let i = 0; i < 8; i++) {
        yield* this.dw(c, 1);
        const b = this.dr(d);
        if (order === 0) v |= b << i; else v |= b << (7 - i);
        yield* this.dw(c, 0);
      }
      return v;
    }
    map(x, a, b, c, d) { x = Math.trunc(x); a = Math.trunc(a); b = Math.trunc(b); c = Math.trunc(c); d = Math.trunc(d); if (b === a) throw new RtErr('div0'); return Math.trunc((x - a) * (d - c) / (b - a)) + c | 0; }
    cons(x, a, b) { return x < a ? a : x > b ? b : x; }
    sq(x) { return x * x; }
    round(x) { return (x >= 0 ? Math.floor(x + 0.5) : -Math.floor(-x + 0.5)) | 0; }
    isinf(x) { return x === Infinity || x === -Infinity; }
    rnd(a, b) {
      if (b === undefined) { b = a; a = 0; }
      a = Math.trunc(a); b = Math.trunc(b); if (b <= a) return a;
      this.seedv = (Math.imul(this.seedv, 1103515245) + 12345) >>> 0;
      return a + Math.floor(((this.seedv >>> 1) / 2147483648) * (b - a));
    }
    seed(s) { if (s) this.seedv = (Math.trunc(s) >>> 0) || 1; }
    ctype(k, ch) {
      const c = String.fromCharCode(ch & 255);
      switch (k) {
        case 'd': return /[0-9]/.test(c); case 'a': return /[A-Za-z]/.test(c); case 'n': return /[A-Za-z0-9]/.test(c);
        case 's': return /[ \t\n\r\f\v]/.test(c); case 'w': return c === ' ' || c === '\t'; case 'U': return /[A-Z]/.test(c);
        case 'L': return /[a-z]/.test(c); case 'p': return /[!-\/:-@\[-`{-~]/.test(c); case 'x': return /[0-9A-Fa-f]/.test(c);
        case 'P': return ch >= 32 && ch < 127; case 'C': return ch < 32 || ch === 127; case 'A': return ch >= 0 && ch < 128; case 'G': return ch > 32 && ch < 127;
      }
      return false;
    }
    strcmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
    sprintf(buf, n, fmt, args) {
      let k = 0;
      const s = fmt.replace(/%([-+ 0#]*)(\d*)(?:\.(\d+))?(l{0,2}|h{0,2})([diuxXcsof%])/g, (m, fl, w, pr, len, cv) => {
        if (cv === '%') return '%';
        let a = args[k++]; let r;
        switch (cv) {
          case 'd': case 'i': r = String(Math.trunc(a)); break;
          case 'u': r = String(len ? Math.trunc(a) >>> 0 : Math.trunc(a) & 65535); break;
          case 'x': r = (len ? Math.trunc(a) >>> 0 : Math.trunc(a) & 65535).toString(16); break;
          case 'X': r = (len ? Math.trunc(a) >>> 0 : Math.trunc(a) & 65535).toString(16).toUpperCase(); break;
          case 'o': r = (Math.trunc(a) >>> 0).toString(8); break;
          case 'c': r = typeof a === 'string' ? a : String.fromCharCode(a & 255); break;
          case 's': r = typeof a === 'string' ? a : this.cs(a); if (pr) r = r.slice(0, +pr); break;
          case 'f': r = '?'; break;   // like avr-libc's default printf: no float support
        }
        if (w && r.length < +w) r = fl.includes('-') ? r.padEnd(+w) : r.padStart(+w, fl.includes('0') && cv !== 's' ? '0' : ' ');
        return r;
      });
      const cap = Math.min(buf.length - 1, n >= 0 ? n - 1 : 1e9);
      if (n < 0 && s.length > buf.length - 1) throw new RtErr('index', { i: s.length, n: buf.length });
      const L = Math.min(s.length, cap);
      for (let i = 0; i < L; i++) buf[i] = s.charCodeAt(i) & 255;
      buf[L] = 0;
      return s.length;
    }
    div(a, b) { if (b == 0) throw new RtErr('div0'); return Math.trunc(a / b); }
    mod(a, b) { if (b == 0) throw new RtErr('div0'); return Math.trunc(a) % Math.trunc(b); }
    ix(a, i) { i = Math.trunc(i); if (i >= 0 && i < a.length) return i; throw new RtErr('index', { i, n: a.length }); }
    sz(a, el) { let n = 1, x = a; while (x && x.length !== undefined && typeof x !== 'string') { n *= x.length; x = x[0]; } return n * el; }
    mk(kind, dims, init) {
      const R = this;
      const make = (d, ini) => {
        const n = dims[d];
        if (d === dims.length - 1) {
          let a;
          switch (kind) {
            case 'i8': case 'c': a = new Int8Array(n); break; case 'u8': a = new Uint8Array(n); break;
            case 'i16': a = new Int16Array(n); break; case 'u16': a = new Uint16Array(n); break;
            case 'i32': a = new Int32Array(n); break; case 'u32': a = new Uint32Array(n); break;
            case 'f': a = new Float64Array(n); break; case 's': a = new Array(n).fill(''); break;
            case 'servo': a = Array.from({ length: n }, () => R.servo()); return a;
            default: a = new Array(n).fill(0);
          }
          if (typeof ini === 'string') { for (let i = 0; i < Math.min(ini.length, n); i++) a[i] = ini.charCodeAt(i); }
          else if (ini) for (let i = 0; i < Math.min(n, ini.length); i++) a[i] = ini[i];
          return a;
        }
        const out = new Array(n); for (let i = 0; i < n; i++) out[i] = make(d + 1, ini && ini[i]); return out;
      };
      return make(0, init);
    }
    cs(a) { if (typeof a === 'string') return a; let s = ''; for (let i = 0; i < a.length && a[i] !== 0; i++) s += String.fromCharCode(a[i] & 255); return s; }
    ff(v, d) {
      v = +v; d = Math.max(0, Math.min(Math.trunc(d), 20));
      if (Number.isNaN(v)) return 'nan'; if (!Number.isFinite(v)) return v > 0 ? 'inf' : '-inf';
      if (Math.abs(v) > 4294967040) return 'ovf';
      return v.toFixed(d);
    }
    fi(v, base) {
      base = Math.trunc(base);
      if (typeof v === 'boolean') v = +v;
      if (base === 10 || !(base >= 2 && base <= 36)) return String(Math.trunc(v));
      return (Math.trunc(v) >>> 0).toString(base).toUpperCase();
    }
    chat(s, i) { i = Math.trunc(i); return i >= 0 && i < s.length ? s.charCodeAt(i) & 255 : 0; }
    substr(s, a, b) { a = Math.max(0, Math.trunc(a)); b = b === undefined ? s.length : Math.max(0, Math.trunc(b)); if (b < a) [a, b] = [b, a]; return s.substring(a, b); }
    toInt(s) { const m = /^\s*([+-]?\d+)/.exec(s); return m ? (parseInt(m[1], 10) | 0) : 0; }
    toFloat(s) { const m = /^\s*([+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)/.exec(s); return m ? parseFloat(m[1]) : 0; }
    sremove(s, i, n) { i = Math.trunc(i); return n === undefined ? s.slice(0, i) : s.slice(0, i) + s.slice(i + Math.trunc(n)); }
    setch(s, i, ch) { i = Math.trunc(i); if (i < 0 || i >= s.length) return s; return s.slice(0, i) + String.fromCharCode(ch & 255) + s.slice(i + 1); }
    // ---- Serial
    sb() { this.serOn = true; }
    sp(s) {
      s = String(s); const st = this.c.state;
      st.ser = (st.ser + s); if (st.ser.length > SER_MAX) st.ser = st.ser.slice(-SER_MAX * 0.75);
      this.txT = this.tp; st.serN = (st.serN || 0) + 1;
      return s.length;
    }
    srd() { return this.sin.length ? this.sin.shift() : -1; }
    spk() { return this.sin.length ? this.sin[0] : -1; }
    sparse(fl) {
      while (this.sin.length && !/[-0-9.]/.test(String.fromCharCode(this.sin[0]))) this.sin.shift();
      let s = ''; while (this.sin.length && /[-0-9.]/.test(String.fromCharCode(this.sin[0])) && (fl || this.sin[0] !== 46)) s += String.fromCharCode(this.sin.shift());
      return fl ? (parseFloat(s) || 0) : (parseInt(s, 10) || 0) | 0;
    }
    sreads(term) {
      let s = '';
      while (this.sin.length) { const ch = this.sin.shift(); if (ch === term) break; s += String.fromCharCode(ch); }
      return s;
    }
    // ---- Servo library (pulses: 20 ms frames, default 544–2400 µs like the common library)
    servo() {
      const R = this;
      const o = {
        pin: -1, min: 544, max: 2400, us: 1500, ch: null,
        attach(p, mn, mx) {
          const k = R.pin(p); if (k < 0) return 0;
          if (mn !== undefined) o.min = Math.trunc(mn); if (mx !== undefined) o.max = Math.trunc(mx);
          o.pin = k; R.modeP[k] = 1; const us = o.us;
          R.at((t) => {
            if (o.ch) R.dropCh(o.ch);
            const ch = { kind: 'servo', pin: k, us, level: 1, t0: t, tNext: t + us * 1e-6, T: 0.02 };
            ch.step = function (tt) { if (this.level) { this.level = 0; this.tNext = this.t0 + 0.02; } else { this.level = 1; this.t0 = tt; this.tNext = tt + this.us * 1e-6; } };
            ch.resync = function (tt) { this.level = 0; this.t0 = tt; this.tNext = tt + 0.02; };
            o.ch = ch; R.hw.push(ch); if (!R.servos.includes(o)) R.servos.push(o);
          });
          return 1;
        },
        detach() { o.pin = -1; R.at(() => { if (o.ch) { R.dropCh(o.ch); o.ch = null; } }); },
        write(v) { v = +v; if (v < 544) { v = U.clamp(v, 0, 180); o.writeUs(o.min + (o.max - o.min) * v / 180); } else o.writeUs(v); },
        writeUs(v) { o.us = Math.round(U.clamp(+v, o.min, o.max)); const us = o.us; R.at(() => { if (o.ch) o.ch.us = us; }); },
        read() { return Math.round((o.us - o.min) * 180 / (o.max - o.min)); },
        readUs() { return o.us; },
        attached() { return o.pin >= 0 ? 1 : 0; },
      };
      return o;
    }
    // ---- LiquidCrystal (4-/8-bit wiring to an LCD1602 part: text goes straight into the module's display RAM)
    lcd(args) {
      const R = this;
      const pins = args.map((p) => R.pin(p));
      const rs = pins[0], en = args.length === 6 || args.length === 10 ? pins[1] : pins[2];
      const data = pins.slice(-4), rw = args.length === 7 || args.length === 11 ? pins[1] : -1;
      const o = {
        x: 0, y: 0, find() {
          const c = R.c, n = c._nodes; if (!n) return null;
          const node = (k) => (k >= 0 ? n[R.B.term(k)] : -1);
          for (const L of R.app.comps) {
            if (L.type !== 'lcd1602' || !L._nodes) continue;
            const ln = L._nodes;
            if (ln[3] === node(rs) && ln[5] === node(en) && data.every((k, i) => ln[10 + i] === node(k))) return L;
          }
          return null;
        },
        begun: false, warned: '',
        // v11: no matching LCD → say which signal is wired where (toast once + board readings)
        diag() {
          const n = R.c._nodes, node = (k) => (k >= 0 ? n[R.B.term(k)] : -1);
          const Ls = R.app.comps.filter((L) => L.type === 'lcd1602' && L._nodes);
          if (!Ls.length) return _t(R.app.comps.some((L) => L.type === 'lcdi2c') ? 'mcu.lib.lcd_is_i2c' : 'mcu.lib.lcd_none');
          const sig = [['RS', 3, rs], ['E', 5, en], ['D4', 10, data[0]], ['D5', 11, data[1]], ['D6', 12, data[2]], ['D7', 13, data[3]]];
          let best = null, bs = -1;
          for (const L of Ls) { const k = sig.filter(([, li, p]) => L._nodes[li] === node(p)).length; if (k > bs) { bs = k; best = L; } }
          const bad = sig.filter(([, li, p]) => best._nodes[li] !== node(p)).map(([nm, li, p]) => _t('mcu.lib.lcd_pin', { sig: nm, want: p >= 0 ? R.B.names[p] : '?', got: R.netName(best._nodes[li]) }));
          let msg = _t('mcu.lib.lcd_mismatch', { list: bad.join('; ') });
          // where each signal really goes (a board pin index or -1), to recognise swapped / reversed data lines and suggest a fix
          const at = sig.map(([, li]) => R.netPin(best._nodes[li]));
          const want = data.map((p) => (p >= 0 ? R.B.names[p] : '?')).join(', '), got = at.slice(2).map((p) => (p >= 0 ? R.B.names[p] : '?')).join(', ');
          const dw = data.join(','), dg = at.slice(2);
          if (dg.every((p) => p >= 0) && dg.join(',') !== dw && [...dg].sort((x, y) => x - y).join(',') === [...data].sort((x, y) => x - y).join(',')) {
            msg += ' ' + _t(dg.join(',') === [...data].reverse().join(',') ? 'mcu.lib.lcd_rev' : 'mcu.lib.lcd_perm', { want, got });
          }
          if (at.every((p) => p >= 0)) {
            const num = (p) => { for (let k = 0; k < 40; k++) if (R.pin(k) === p) return k; return -1; };
            const na = args.map((x) => x), ie = args.length === 6 || args.length === 10 ? 1 : 2;
            na[0] = num(at[0]); na[ie] = num(at[1]); for (let i = 0; i < 4; i++) na[na.length - 4 + i] = num(at[2 + i]);
            if (na.every((x) => x >= 0)) msg += ' ' + _t('mcu.lib.lcd_fix', { code: 'LiquidCrystal lcd(' + na.join(', ') + ');' });
          }
          return msg;
        },
        mem() {
          const L = o.find();
          if (!L) { R.lcdMiss = true; R.libWarnT(o, o.diag()); return null; }
          R.lcdMiss = false;
          const st = L.state;
          if (!o.begun) { R.libWarn(o, 'mcu.lib.lcd_nobegin', {}); return null; }   // like the real controller: nothing shown before lcd.begin()
          if (!st.dd) { st.dd = [new Array(40).fill(' '), new Array(40).fill(' ')]; st.ddOff = 0; st.ddOn = 1; }
          if (st.init && DEFS.lcd1602.contrast(L) <= 0) R.libWarn(o, 'mcu.lib.lcd_contrast', {}); else if (o.warned) { o.warned = ''; R.libDiag = ''; }
          return st;
        },
        begin() { R.tp += 0.05; o.begun = true; for (const k of [rs, en, rw, ...data]) if (k >= 0) { R.modeP[k] = 1; R.outP[k] = 0; R.apply(k); } const st = o.mem(); if (st) { o.clr(st); st.ddOn = 1; } return 0; },
        clr(st) { st.dd[0].fill(' '); st.dd[1].fill(' '); st.ddOff = 0; o.x = 0; o.y = 0; },
        print(s) {
          s = String(s); const st = o.mem(); R.tp += s.length * 4e-5;
          if (!st) return s.length;
          for (const ch of s) {
            const code = ch.charCodeAt(0);
            st.dd[o.y][o.x] = code === 223 ? '°' : code < 8 ? '\u2588' : code < 32 || code > 255 ? ' ' : ch;
            o.x++; if (o.x >= 40) { o.x = 0; o.y = 1 - o.y; }
          }
          st.ddT = R.tp;
          return s.length;
        },
        setCursor(cx, cy) { R.tp += 4e-5; o.x = U.clamp(Math.trunc(cx), 0, 39); o.y = Math.trunc(cy) >= 1 ? 1 : 0; },
        cmd(name) {
          R.tp += name === 'clear' || name === 'home' ? 2e-3 : 4e-5;
          const st = o.mem(); if (!st) return;
          switch (name) {
            case 'clear': o.clr(st); break;
            case 'home': o.x = 0; o.y = 0; st.ddOff = 0; break;
            case 'display': st.ddOn = 1; break; case 'noDisplay': st.ddOn = 0; break;
            case 'scrollDisplayLeft': st.ddOff = (st.ddOff + 1) % 40; break;
            case 'scrollDisplayRight': st.ddOff = (st.ddOff + 39) % 40; break;
          }
        },
      };
      return o;
    }
    // ---- v11 sensor libraries (library level: values come from the wired sensor part; the DATA line shows the
    // protocol waveform for DHT; DS18B20 bus traffic is not drawn). Wiring / power problems give NaN / −127 + a toast.
    libWarn(o, key, params) { this.libWarnT(o, _t(key, params)); }
    libWarnT(o, txt) { this.libDiag = txt; if (o.warned === txt) return; o.warned = txt; if (this.app.toast) this.app.toast(txt); }
    libOk(o) { if (o.warned && this.libDiag === o.warned) this.libDiag = ''; o.warned = ''; }
    // what a node of the circuit is connected to, seen from this board: a pin name, GND / 5V, or "not connected"
    netPin(nd) { const n = this.c._nodes, B = this.B; for (let p = 0; p < B.n; p++) if (n[B.term(p)] === nd) return p; return -1; }
    netName(nd) {
      const n = this.c._nodes, B = this.B;
      for (let p = 0; p < B.n; p++) if (n[B.term(p)] === nd) return B.names[p];
      if (nd === n[B.gnd]) return 'GND';
      if (nd === n[B.vcc]) return 'VCC/5V';
      const used = this.app.comps.reduce((a, c) => a + (c._nodes ? c._nodes.filter((x) => x === nd).length : 0), 0);
      return used <= 1 ? _t('mcu.lib.unconnected') : _t('mcu.lib.other_net');
    }
    // ---- I2C (Wire, library level): devices answer when their SDA / SCL are on the board's I2C pins and powered
    i2cPins() { return this.c.type === 'attiny85' ? [0, 2] : [18, 19]; }
    i2cDevs() {
      const n = this.c._nodes; if (!n) return [];
      const [a, b] = this.i2cPins(), sda = n[this.B.term(a)], scl = n[this.B.term(b)], m = this.app.net;
      return this.app.comps.filter((d) => d.type === 'lcdi2c' && d._nodes && d._nodes[2] === sda && d._nodes[3] === scl && d.state.init && m && m.v(d._nodes[1]) - m.v(d._nodes[0]) > 4.0);
    }
    wireI() { return this._w || (this._w = this.wire()); }
    wire() {
      const R = this; let addr = -1, nb = 0;
      return {
        begin() { R.tp += 1e-4; }, end() {}, setClock() {}, setWireTimeout() {},
        beginTransmission(a) { addr = Math.trunc(+a) & 127; nb = 0; },
        write(v) { nb++; return 1; },
        endTransmission() { R.tp += (2 + nb) * 9e-5; const ok = R.i2cDevs().some((d) => +d.props.addr === addr); addr = -1; return ok ? 0 : 2; },
      };
    }
    // ---- LiquidCrystal_I2C (PCF8574 backpack, 16×2)
    lcdi2c(addr, cols, rows) {
      const R = this; addr = Math.trunc(+addr) & 127;
      const o = {
        x: 0, y: 0, begun: false, warned: '', blOn: true,
        diag() {
          const all = R.app.comps.filter((d) => d.type === 'lcdi2c' && d._nodes);
          const hex = (v) => '0x' + (+v).toString(16).toUpperCase();
          if (!all.length) return _t(R.app.comps.some((d) => d.type === 'lcd1602') ? 'mcu.lib.i2c_is_parallel' : 'mcu.lib.i2c_none');
          const n = R.c._nodes, [a, b] = R.i2cPins(), sda = n[R.B.term(a)], scl = n[R.B.term(b)], m = R.app.net;
          const D = all[0];
          if (D._nodes[2] === scl && D._nodes[3] === sda) return _t('mcu.lib.i2c_swapped', { sda: R.B.names[a], scl: R.B.names[b] });
          const wired = all.filter((d) => d._nodes[2] === sda && d._nodes[3] === scl);
          if (!wired.length) return _t('mcu.lib.i2c_pins', { sda: R.B.names[a], scl: R.B.names[b], gsda: R.netName(D._nodes[2]), gscl: R.netName(D._nodes[3]) });
          const pw = wired.filter((d) => d.state.init && m.v(d._nodes[1]) - m.v(d._nodes[0]) > 4.0);
          if (!pw.length) return _t('mcu.lib.i2c_power', { v: U.fmt(m.v(wired[0]._nodes[1]) - m.v(wired[0]._nodes[0]), 'V') });
          if (Math.abs(m.v(wired[0]._nodes[0]) - m.v(n[R.B.gnd])) > 0.5) return _t('mcu.lib.i2c_gnd');
          return _t('mcu.lib.i2c_addr', { want: hex(addr), got: pw.map((d) => hex(d.props.addr)).join(', ') });
        },
        find() { return R.i2cDevs().find((d) => +d.props.addr === addr) || null; },
        mem() {
          const L = o.find();
          if (!L) { R.libWarnT(o, o.diag()); return null; }
          const st = L.state;
          if (!o.begun) { R.libWarn(o, 'mcu.lib.lcd_nobegin_i2c', {}); return null; }
          if (!st.dd) { st.dd = [new Array(40).fill(' '), new Array(40).fill(' ')]; st.ddOff = 0; st.ddOn = 1; }
          if (DEFS.lcdi2c.contrast(L) <= 0) R.libWarn(o, 'mcu.lib.lcdi2c_contrast', {}); else R.libOk(o);
          return st;
        },
        init() { o.begin(); },
        begin() { R.tp += 0.05; o.begun = true; o.x = 0; o.y = 0; const st = o.mem(); if (st) { o.clr(st); st.ddOn = 1; st.bl = o.blOn; } },
        clr(st) { st.dd[0].fill(' '); st.dd[1].fill(' '); st.ddOff = 0; o.x = 0; o.y = 0; },
        setBl(on) { o.blOn = on; R.tp += 2e-4; const L = o.find(); if (L) { if (L.state.bl !== on) R.app.net.needStamp = true; L.state.bl = on; } else o.mem(); },
        print(s) {
          s = String(s); R.tp += s.length * 5e-4;
          const st = o.mem(); if (!st) return s.length;
          for (const ch of s) {
            const code = ch.charCodeAt(0);
            st.dd[o.y][o.x] = code === 223 ? '°' : code < 8 ? '\u2588' : code < 32 || code > 255 ? ' ' : ch;
            o.x++; if (o.x >= 40) { o.x = 0; o.y = 1 - o.y; }
          }
          return s.length;
        },
        setCursor(cx, cy) { R.tp += 5e-4; o.x = U.clamp(Math.trunc(cx), 0, 39); o.y = Math.trunc(cy) >= 1 ? 1 : 0; },
        cmd(name) {
          R.tp += name === 'clear' || name === 'home' ? 2.5e-3 : 5e-4;
          if (name === 'backlight') return o.setBl(true);
          if (name === 'noBacklight') return o.setBl(false);
          const st = o.mem(); if (!st) return;
          switch (name) {
            case 'clear': o.clr(st); break;
            case 'home': o.x = 0; o.y = 0; st.ddOff = 0; break;
            case 'display': st.ddOn = 1; break; case 'noDisplay': st.ddOn = 0; break;
            case 'scrollDisplayLeft': st.ddOff = (st.ddOff + 1) % 40; break;
            case 'scrollDisplayRight': st.ddOff = (st.ddOff + 39) % 40; break;
          }
        },
      };
      return o;
    }
    sensOn(type, k, ti) {   // sensor parts of a type whose terminal ti shares the node of pin k
      const n = this.c._nodes; if (!n || k < 0) return [];
      const nd = n[this.B.term(k)];
      return this.app.comps.filter((s) => s.type === type && s._nodes && s._nodes[ti] === nd).sort((a, b) => (a.id || 0) - (b.id || 0));
    }
    sensPow(s, iv, ig, vmin) {   // [ok, problem key]
      const m = this.app.net, n = s._nodes, gm = m.v(this.c._nodes[this.B.gnd]);
      if (Math.abs(m.v(n[ig]) - gm) > 0.5) return [false, 'nognd'];
      if (m.v(n[iv]) - m.v(n[ig]) < vmin) return [false, 'nopower'];
      return [true, ''];
    }
    dht(pin, type) {
      const R = this, k = R.pin(pin), ty = Math.trunc(+type) || 11;
      const o = {
        last: -1e9, ok: false, T: NaN, H: NaN, warned: '',
        begin() { if (k >= 0) { R.modeP[k] = 0; R.outP[k] = 1; R.apply(k); } o.last = -1e9; },
        read(force) {
          if (!force && R.tp - o.last < 2) return o.ok;   // the sensor may be read at most every 2 s; the last result is kept
          o.last = R.tp;
          const s = R.sensOn('dht', k, 1)[0];
          if (!s) { R.libWarn(o, 'mcu.lib.dht_nowire', { pin: R.B.names[k] || pin }); o.ok = false; R.tp += 0.02; return false; }
          const [pw, why] = R.sensPow(s, 0, 2, 3.0);
          if (!pw) { R.libWarn(o, 'mcu.lib.dht_' + why, {}); o.ok = false; R.tp += 0.02; return false; }
          o.warned = '';
          // host start signal: LOW ≥ 18 ms (DHT11) / ≈1.1 ms (DHT22), then release (pull-up) and let the sensor answer
          R.modeP[k] = 1; R.outP[k] = 0; R.pwmOff(k); R.apply(k);
          R.tp += ty === 11 ? 0.018 : 0.0011;
          R.modeP[k] = 0; R.outP[k] = 1; R.apply(k);
          const e = DEFS.dht.encode(s, R.tp), b = e.b;
          R.tp = DEFS.dht.respond(s, R.tp, b) + 1e-5;
          if (((b[0] + b[1] + b[2] + b[3]) & 255) !== b[4]) { o.ok = false; return false; }
          // decode as the requested type (a DHT11 read as DHT22 or vice versa gives wrong numbers, like the real library)
          if (ty === 11) { o.H = b[0] + b[1] * 0.1; o.T = (b[2] + (b[3] & 15) * 0.1) * (b[3] & 128 ? -1 : 1); }
          else { o.H = ((b[0] << 8) | b[1]) * 0.1; o.T = (((b[2] & 127) << 8) | b[3]) * 0.1 * (b[2] & 128 ? -1 : 1); }
          o.ok = true; return true;
        },
        readTemperature(f, force) { if (!o.read(force)) return NaN; return f ? o.T * 1.8 + 32 : o.T; },
        readHumidity(force) { if (!o.read(force)) return NaN; return o.H; },
        convertCtoF: (c) => c * 1.8 + 32, convertFtoC: (f) => (f - 32) / 1.8,
        // NWS heat index (Rothfusz regression with its published adjustments; simple formula below 80 °F)
        computeHeatIndex(t, h, isF) {
          if (isF === undefined) isF = 1;
          const F = isF ? t : t * 1.8 + 32;
          let hi = 0.5 * (F + 61 + (F - 68) * 1.2 + h * 0.094);
          if ((hi + F) / 2 >= 80) {
            hi = -42.379 + 2.04901523 * F + 10.14333127 * h - 0.22475541 * F * h - 0.00683783 * F * F - 0.05481717 * h * h + 0.00122874 * F * F * h + 0.00085282 * F * h * h - 0.00000199 * F * F * h * h;
            if (h < 13 && F >= 80 && F <= 112) hi -= ((13 - h) / 4) * Math.sqrt((17 - Math.abs(F - 95)) / 17);
            else if (h > 85 && F >= 80 && F <= 87) hi += ((h - 85) / 10) * ((87 - F) / 5);
          }
          return isF ? hi : (hi - 32) / 1.8;
        },
      };
      return o;
    }
    ow(pin) { return { k: this.pin(pin), pin }; }
    dallas(bus) {
      const R = this, k = bus ? bus.k : -1;
      const o = {
        wait: true, warned: '', bits: 0,
        devs() { return R.sensOn('ds18b20', k, 1); },
        okDev(s) {
          const [pw, why] = R.sensPow(s, 2, 0, 3.0);
          if (!pw) { R.libWarn(o, 'mcu.lib.ds_' + why, {}); return false; }
          const m = R.app.net, n = s._nodes, vd = m.v(n[2]) - m.v(n[0]), dq = m.v(n[1]) - m.v(n[0]);
          if (R.modeP[k] !== 1 && dq < 0.7 * vd) { R.libWarn(o, 'mcu.lib.ds_nopullup', {}); return false; }
          return true;
        },
        res(s) { return s.state.res || +s.props.res || 12; },
        begin() { R.tp += 0.003; if (!o.devs().length) R.libWarn(o, 'mcu.lib.ds_nowire', { pin: R.B.names[k] || (bus && bus.pin) }); },
        getDeviceCount() { R.tp += 0.003; return o.devs().filter((s) => o.okDev(s)).length; },
        setResolution(b) { b = U.clamp(Math.trunc(+b) || 12, 9, 12); for (const s of o.devs()) s.state.res = b; R.tp += 0.003; },
        getResolution() { const d = o.devs()[0]; return d ? o.res(d) : 0; },
        setWaitForConversion(f) { o.wait = !!(+f); }, getWaitForConversion() { return o.wait; },
        millisToWait(b) { return Math.round(DEFS.ds18b20.tconv(U.clamp(Math.trunc(+b) || 12, 9, 12)) * 1000); },
        requestTemperatures(i) {
          R.tp += 0.0015; let tw = 0;
          const L = o.devs(), sel = i === undefined ? L : L.slice(Math.trunc(+i), Math.trunc(+i) + 1);
          for (const s of sel) {
            if (!o.okDev(s)) continue;
            const b = o.res(s), tc = DEFS.ds18b20.tconv(b);
            s.state.pend = { t: R.tp + tc, v: DEFS.ds18b20.quant(SENS.val(s, R.tp), b) }; tw = Math.max(tw, tc);
          }
          if (o.wait) R.tp += tw;
          return i === undefined ? undefined : sel.length > 0;
        },
        upd(s) { const p = s.state.pend; if (p && R.tp >= p.t - 1e-9) { s.state.conv = p.v; s.state.pend = null; } },
        isConversionComplete() { return o.devs().every((s) => !s.state.pend || R.tp >= s.state.pend.t - 1e-9); },
        getTempCByIndex(i) {
          R.tp += 0.005;
          const s = o.devs()[Math.trunc(+i)];
          if (!s) { if (!o.devs().length) R.libWarn(o, 'mcu.lib.ds_nowire', { pin: R.B.names[k] || (bus && bus.pin) }); return -127; }
          if (!o.okDev(s)) return -127;
          o.upd(s); return s.state.conv !== undefined ? s.state.conv : 85;   // 85 °C = power-on value of the scratchpad
        },
        getTempFByIndex(i) { const c = o.getTempCByIndex(i); return c === -127 ? -196.6 : c * 1.8 + 32; },
      };
      return o;
    }
    // ---- JavaScript-mode API objects
    jsApi() {
      const R = this, B = this.B;
      const fmtJ = (v, f) => (typeof v === 'number' ? (f !== undefined ? (Number.isInteger(v) ? R.fi(v, f) : R.ff(v, f)) : (Number.isInteger(v) ? String(v) : R.ff(v, 2))) : typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
      const Serial = {
        begin() { R.sb(); }, end() {}, flush() {},
        print(v, f) { return R.sp(v === undefined ? '' : fmtJ(v, f)); },
        println(v, f) { return R.sp((v === undefined ? '' : fmtJ(v, f)) + '\r\n'); },
        write(v) { return R.sp(typeof v === 'number' ? String.fromCharCode(v & 255) : String(v)); },
        available() { return R.sin.length; }, read() { return R.srd(); }, peek() { return R.spk(); },
        parseInt() { return R.sparse(0); }, parseFloat() { return R.sparse(1); }, readString() { return R.sreads(-1); },
        readStringUntil(c) { return R.sreads(typeof c === 'string' ? c.charCodeAt(0) : c); },
      };
      function Servo() { const s = R.servo(); s.writeMicroseconds = s.writeUs; s.readMicroseconds = s.readUs; return s; }
      function LiquidCrystal(...a) { const l = R.lcd(a); const o = { begin: (c, r) => l.begin(c, r), print: (v, f) => l.print(fmtJ(v, f)), write: (v) => l.print(typeof v === 'number' ? String.fromCharCode(v) : String(v)), setCursor: (x, y) => l.setCursor(x, y) }; for (const k of ['clear', 'home', 'display', 'noDisplay', 'cursor', 'noCursor', 'blink', 'noBlink', 'scrollDisplayLeft', 'scrollDisplayRight', 'autoscroll', 'noAutoscroll', 'leftToRight', 'rightToLeft']) o[k] = () => l.cmd(k); o.createChar = () => {}; return o; }
      function DHT(p, t) { return R.dht(p, t); }
      function LiquidCrystal_I2C(a, cc, rr) { const l = R.lcdi2c(a, cc, rr); const o = { init: () => l.init(), begin: () => l.begin(), print: (v, f) => l.print(fmtJ(v, f)), write: (v) => l.print(typeof v === 'number' ? String.fromCharCode(v) : String(v)), setCursor: (x, y) => l.setCursor(x, y), setBacklight: (v) => l.setBl(!!v) }; for (const k of ['clear', 'home', 'display', 'noDisplay', 'cursor', 'noCursor', 'blink', 'noBlink', 'scrollDisplayLeft', 'scrollDisplayRight', 'autoscroll', 'noAutoscroll', 'leftToRight', 'rightToLeft', 'backlight', 'noBacklight']) o[k] = () => l.cmd(k); o.createChar = () => {}; return o; }
      const Wire = R.wireI();
      function OneWire(p) { return R.ow(p); }
      function DallasTemperature(b) { const d = R.dallas(b); d.requestTemperaturesByIndex = (i) => d.requestTemperatures(i); d.millisToWaitForConversion = d.millisToWait; return d; }
      const K = B.jsConsts;
      const api = {
        pinMode: (p, m) => R.pm(p, m), digitalWrite: (p, v) => R.dw(p, v), digitalRead: (p) => R.dr(p), analogRead: (p) => R.ar(p),
        analogWrite: (p, v) => R.aw(p, v), analogReference: (x) => R.aref(x), delay: (ms) => R.dly(ms), delayMicroseconds: (us) => R.dlyu(us),
        millis: () => R.ms(), micros: () => R.us(), tone: (p, f, d) => R.tone(p, f, d), noTone: (p) => R.notone(p), pulseIn: (p, s, t) => R.pulseIn(p, s, t),
        shiftOut: (a, b, c, d) => R.shiftOut(a, b, c, d), shiftIn: (a, b, c) => R.shiftIn(a, b, c),
        map: (x, a, b, c, d) => R.map(x, a, b, c, d), constrain: (x, a, b) => R.cons(x, a, b), min: Math.min, max: Math.max, abs: Math.abs, sq: (x) => x * x,
        random: (a, b) => R.rnd(a, b), randomSeed: (s) => R.seed(s), Serial, Servo, LiquidCrystal, LiquidCrystal_I2C, Wire, DHT, OneWire, DallasTemperature, DHT11: 11, DHT22: 22, DHT21: 21, AM2301: 21, DEVICE_DISCONNECTED_C: -127, DEVICE_DISCONNECTED_F: -196.6,
        HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, LED_BUILTIN: K.LED_BUILTIN, DEC: 10, HEX: 16, OCT: 8, BIN: 2, PI: Math.PI, MSBFIRST: 1, LSBFIRST: 0,
        DEFAULT: 1, INTERNAL: 3, A0: K.A0, A1: K.A1, A2: K.A2, A3: K.A3, A4: K.A4, A5: K.A5, PB0: K.PB0, PB1: K.PB1, PB2: K.PB2, PB3: K.PB3, PB4: K.PB4, PB5: K.PB5,
        bitRead: (x, n) => (x >>> n) & 1, bit: (n) => (1 << n) >>> 0, lowByte: (x) => x & 255, highByte: (x) => (x >> 8) & 255,
      };
      return MCULANG.JS_API.map((k) => api[k]);
    }
    // ---- errors
    fault(e) {
      let line = this.ln, key = 'generic', params = {};
      if (e instanceof RtErr) { key = e.key; params = e.params; }
      else if (e instanceof RangeError && /call stack/i.test(e.message)) key = 'stack';
      else params = { msg: String(e && e.message || e) };
      if (this.lang === 'js' && e && e.stack) {
        const m = /<anonymous>:(\d+):(\d+)/.exec(e.stack) || /eval at [^\n]*:(\d+):(\d+)\)/.exec(e.stack);
        if (m) line = Math.max(1, +m[1] - MCULANG.JS_HEADER_LINES);
      }
      this.err = { line: line || 1, key, params, runtime: true };
      this.gen = null;
      if (this.app.toast) this.app.toast(_t('mcu.toast_runtime_error', { line: this.err.line, msg: errText(this.err) }));
    }
  }
  const errText = (e) => (e.runtime ? _t('mcu.r.' + e.key, e.params) : MCULANG.errorText(e));

  // electrical drive of one pin: -1 high-Z, -2 pull-up, 0…1 = duty (0 low, 1 high, fraction = averaged PWM)
  function setDrive(c, p, d, t, app) {
    const drv = c.state.drv || (c.state.drv = new Array(BOARDS[c.type].n).fill(-1));
    if (drv[p] === d) return;
    drv[p] = d;
    const pr = c._pin && c._pin[p];
    if (pr) {
      const [gh, gl] = pinG(d); pr[0].g = gh; pr[1].g = gl;
      app.net.needStamp = true;
      if (!app._edgeAt) app._edgeAt = new Map();
      const nd = c._nodes[BOARDS[c.type].term(p)];
      app._edgeAt.set(nd, t);
      // v11: sensor inputs wired straight to this pin (HC-SR04 TRIG …) see the change at its exact time
      const L = app._dlink && app._dlink.get(nd);
      if (L) {
        for (const [s, i] of L) DEFS[s.type].onDrive(s, i, d, t, app);
        // an edge created inside the running program (e.g. ECHO after TRIG falls) must stop it in time
        const te = app.nextDEdge(t);
        for (const mc of app.mcuComps || []) { const rt = mc.state.rt; if (rt && te < rt.lim) rt.lim = te; }
      }
    }
  }
  function pinG(d) {
    if (d === -1 || d === undefined) return [G_OFF, G_OFF];
    if (d === -2) return [1 / R_PU, G_OFF];
    return [Math.max(d / R_OUT, G_OFF), Math.max((1 - d) / R_OUT, G_OFF)];
  }

  // ---------------------------------------------------------------- part definitions -----------------------------
  const BLINK_UNO = [
    '// Blink: the on-board LED "L" (pin 13) turns on and off every half second.',
    'void setup() {',
    '  pinMode(LED_BUILTIN, OUTPUT);',
    '}',
    '',
    'void loop() {',
    '  digitalWrite(LED_BUILTIN, HIGH);',
    '  delay(500);',
    '  digitalWrite(LED_BUILTIN, LOW);',
    '  delay(500);',
    '}', ''].join('\n');
  const BLINK_TINY = [
    '// Blink an LED on PB0 (pin 5) every half second.',
    'void setup() {',
    '  pinMode(PB0, OUTPUT);',
    '}',
    '',
    'void loop() {',
    '  digitalWrite(PB0, HIGH);',
    '  delay(500);',
    '  digitalWrite(PB0, LOW);',
    '  delay(500);',
    '}', ''].join('\n');

  // pin electrical model: per pin a high-side and a low-side conductance to the chip's own rails, plus 10 MΩ leakage
  function buildPins(c, n, m, VCC, G) {
    const B = BOARDS[c.type], drv = c.state.drv || [];
    c._pin = [];
    for (let p = 0; p < B.n; p++) {
      const t = n[B.term(p)], [gh, gl] = pinG(drv[p]);
      c._pin.push([m.addR(VCC, t, gh), m.addR(t, G, gl)]);
      m.addR(t, G, 1e-7);
    }
  }
  function measurePins(c, m) {
    const B = BOARDS[c.type], n = c._nodes, M = c._m, g = m.v(n[B.gnd]), vc = m.v(n[B.vcc]);
    M.Vcc = vc - g; let src = 0, worst = 0, wp = -1;
    if (!c._pin) return 0;
    for (let p = 0; p < B.n; p++) {
      const v = m.v(n[B.term(p)]), pr = c._pin[p];
      const ih = (vc - v) * pr[0].g, il = (v - g) * pr[1].g;
      src += Math.max(ih, 0);
      const io = ih - il;
      if (Math.abs(io) > Math.abs(worst)) { worst = io; wp = p; }
    }
    M.Ipin = worst; M.Ipinp = wp;
    return src;
  }
  function statusOf(c) {
    const st = c.state, rt = st.rt;
    if (st.held) return 'reset';
    if (!rt) return 'off';
    if (rt.err) return rt.err.compile ? 'cerr' : 'rerr';
    return 'run';
  }
  function labelMcu(c) { const s = statusOf(c), rt = c.state.rt; return _t('mcu.st.' + s) + (rt && rt.err ? ' (' + _t('mcu.line_n', { line: rt.err.line }) + ')' : ''); }
  function pinSummary(c) {
    const rt = c.state.rt, B = BOARDS[c.type]; if (!rt) return '—';
    const out = [];
    for (let p = 0; p < B.n; p++) {
      if (rt.modeP[p] === 1 || (rt.servos.some((s) => s.pin === p))) {
        const d = rt.duty && rt.duty[p] !== undefined ? '~' + Math.round(rt.duty[p] * 100) + '%' : rt.servos.some((s) => s.pin === p) ? 'servo' : rt.toneCh && rt.toneCh.pin === p ? 'tone' : rt.outP[p] ? 'H' : 'L';
        out.push(B.names[p] + '=' + d);
      } else if (rt.outP[p]) out.push(B.names[p] + '=IN\u2191');
    }
    return out.length ? out.join(' ') : '—';
  }
  function lastLine(s) { const L = String(s || '').replace(/\r/g, '').split('\n').filter((x) => x.length); return L.length ? L[L.length - 1].slice(0, 40) : '—'; }
  function readingsMcu(c) {
    const st = c.state, M = c._m, rt = st.rt, s = statusOf(c);
    const r = [[_t('mcu.status'), _t('mcu.st.' + s)], ['VCC', U.fmt(M.Vcc || 0, 'V')], [_t('mcu.supply_current'), U.fmt(Math.abs(M.I || 0), 'A')]];
    if (rt && !rt.err) r.push([_t('mcu.uptime'), rt.upMs(app.t) + ' ms']);
    if (rt && rt.err) r.push([_t('mcu.error'), _t('mcu.line_n', { line: rt.err.line }) + ' ' + errText(rt.err)]);
    if (rt && rt.libDiag) r.push([_t('mcu.lib.problem'), rt.libDiag]);
    r.push([_t('mcu.pins'), pinSummary(c)]);
    r.push([_t('mcu.serial_last'), lastLine(st.ser)]);
    if (Math.abs(M.Ipin || 0) > 0.04) r.push([_t('common.note'), _t('mcu.pin_overcurrent', { pin: BOARDS[c.type].names[M.Ipinp], i: U.fmt(Math.abs(M.Ipin), 'A') })]);
    r.push([_t('common.note'), _t('mcu.note_edit')]);
    return r;
  }
  // power / reset supervision, (re)boot and program upload, run after each accepted time step
  function postMcu(c, dt, app) {
    const st = c.state, M = c._m, B = BOARDS[c.type], vcc = M.Vcc || 0;
    let rt = st.rt;
    if (rt && (rt.src !== c.props.code || rt.lang !== c.props.lang)) { rt = st.rt = null; st.ser = ''; }
    let held = false;
    if (c.type === 'attiny85' && !c.props.rstio && c._nodes && app.net) { const n = c._nodes; held = vcc >= V_BOOT && app.net.v(n[0]) - app.net.v(n[B.gnd]) < 0.3 * vcc; }
    if (st.held !== held) { st.held = held; if (held) { rt = st.rt = null; } }
    if (!rt) {
      if (vcc >= V_BOOT && !held) {
        rt = st.rt = new McuRT(c, app, app.t);
        if (rt.err && rt.err.compile) app.toast(_t('mcu.toast_compile_error', { line: rt.err.line, msg: errText(rt.err) }));
      } else for (let p = 0; p < B.n; p++) setDrive(c, p, -1, app.t, app);
    } else if (vcc < V_OFF) {
      st.rt = null;
      for (let p = 0; p < B.n; p++) setDrive(c, p, -1, app.t, app);
    }
    if (Math.abs(M.Ipin || 0) > 0.04) { if (!st.ocWarn) { st.ocWarn = true; app.toast(_t('mcu.pin_overcurrent', { pin: B.names[M.Ipinp], i: U.fmt(Math.abs(M.Ipin), 'A') })); } }
    else if (Math.abs(M.Ipin || 0) < 0.03) st.ocWarn = false;
  }
  const LANG_OPTS = [['ino', 'Arduino C/C++'], ['js', 'JavaScript']];
  const UNO_TOP = [['GND', -140, 23], ['13', -120, 13], ['12', -100, 12], ['~11', -80, 11], ['~10', -60, 10], ['~9', -40, 9], ['8', -20, 8],
    ['7', 20, 7], ['~6', 40, 6], ['~5', 60, 5], ['4', 80, 4], ['~3', 100, 3], ['2', 120, 2], ['TX\u21921', 140, 1], ['RX\u21900', 160, 0]];
  const UNO_BOT = [['3.3V', -100, 21], ['5V', -80, 20], ['GND', -60, 24], ['GND', -40, 25], ['VIN', -20, 22],
    ['A0', 20, 14], ['A1', 40, 15], ['A2', 60, 16], ['A3', 80, 17], ['A4', 100, 18], ['A5', 120, 19]];
  const unoTerms = (() => {
    const t = new Array(26);
    for (const [, x, i] of UNO_TOP) t[i] = [x, -120];
    for (const [, x, i] of UNO_BOT) t[i] = [x, 120];
    return t;
  })();

  DEFS.arduino = {
    name: 'Arduino Uno 开发板', en: 'Arduino Uno Board', cat: 'mcu', desig: 'U', mcu: true, innerShort: true,
    terms: unoTerms,
    termNames: [...Array.from({ length: 14 }, (_, i) => 'D' + i + (i === 0 ? ' RX' : i === 1 ? ' TX' : [3, 5, 6, 9, 10, 11].includes(i) ? ' ~PWM' : i === 13 ? ' LED' : '')),
      'A0', 'A1', 'A2', 'A3', 'A4 SDA', 'A5 SCL', '5V', '3.3V', 'VIN', 'GND', 'GND', 'GND'],
    box: [-212, -130, 200, 130],
    props: [
      { k: 'power', label: '供电方式', kind: 'select', opts: [['usb', 'USB 供电 (5 V)'], ['ext', '外部供电 (VIN 或 5V 引脚)']], def: 'usb' },
      { k: 'lang', label: '编程语言', kind: 'select', opts: LANG_OPTS.map((o) => o.slice()), def: 'ino' },
      { k: 'code', label: '程序', kind: 'code', def: BLINK_UNO },
    ],
    shorted: () => [[23, 24], [24, 25]],
    label: (c) => labelMcu(c),
    build(c, n, m) {
      const st = c.state, V5 = n[20], V33 = n[21], VIN = n[22], G = n[23];
      if (c.props.power === 'usb') { c._usb = m.addV(V5, G, () => 5, 0.1); m.addR(VIN, G, 1e-7); c._reg = null; }
      else { c._usb = null; c._reg = m.addNL('linreg', [VIN, V5, G], { Vref: 5, Vdo: 1.1, Ro: 0.005, Ilim: 0.8, Iq: 0.005 }, sub(st, 'reg')); }
      m.addNL('linreg', [V5, V33, G], { Vref: 3.3, Vdo: 0.3, Ro: 0.005, Ilim: 0.15, Iq: 1e-4 }, sub(st, 'r33'));
      m.addR(V5, G, 1 / 110);                                              // board + ATmega16U2 + regulator ≈ 45 mA
      const x = m.newNode(); c._lr = m.addR(n[13], x, 1 / 1000);           // on-board "L" LED: 1 kΩ + LED to GND
      c._ld = m.addD(x, G, ledIs(2.0), 2 * VT, sub(st, 'L'));
      buildPins(c, n, m, V5, G);
      c._p = null;
    },
    measure(c, m) {
      const n = c._nodes, M = c._m, src = measurePins(c, m);
      M.IL = c._ld ? c._ld.i : 0;
      M.I = c._usb ? -c._usb.i : (M.Vcc || 0) / 110 + src + Math.max(M.IL, 0) + 0.005;
      M.V = M.Vcc; M.P = Math.abs(M.V * M.I);
      M.Vin = m.v(n[22]) - m.v(n[23]);
    },
    post: postMcu,
    readings: readingsMcu,
    draw(ctx, c) {
      const st = c.state, M = c._m, rt = st.rt, s = statusOf(c), on = (M.Vcc || 0) > 4;
      // board
      ctx.fillStyle = D.vgrad(ctx, -110, 110, [[0, '#13808f'], [1, '#0a5a66']]); D.rrect(ctx, -196, -128, 392, 256, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (const [a, b] of [[-180, -112], [180, -100], [-150, 112], [176, 112]]) { ctx.beginPath(); ctx.arc(a, b, 4, 0, 7); ctx.fill(); }
      ctx.strokeStyle = 'rgba(180,230,235,0.25)'; ctx.lineWidth = 1.2;   // a few decorative traces
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-60 + 12 * k, -100); ctx.lineTo(-60 + 12 * k, -70); ctx.lineTo(10 + 12 * k, -20); ctx.lineTo(10 + 12 * k, 20); ctx.stroke(); }
      // USB-B socket and DC jack
      ctx.fillStyle = D.vgrad(ctx, -100, -50, [[0, '#f0f2f4'], [0.5, '#b9bec4'], [1, '#80868d']]); ctx.fillRect(-212, -100, 58, 48);
      ctx.fillStyle = '#5b6066'; ctx.fillRect(-206, -88, 30, 24);
      ctx.fillStyle = D.vgrad(ctx, 30, 92, [[0, '#3a3a3a'], [1, '#0a0a0a']]); D.rrect(ctx, -208, 30, 60, 62, 4); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-186, 61, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(-186, 61, 3, 0, 7); ctx.fill();
      // reset button
      ctx.fillStyle = '#ddd'; ctx.fillRect(-150, -104, 18, 18); ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.arc(-141, -95, 6, 0, 7); ctx.fill();
      // regulator, crystal, capacitors
      ctx.fillStyle = '#222'; ctx.fillRect(-140, 60, 26, 20); ctx.fillStyle = '#9aa'; ctx.fillRect(-140, 54, 26, 6);
      ctx.fillStyle = D.vgrad(ctx, 0, 16, [[0, '#eee'], [1, '#999']]); D.rrect(ctx, -60, 2, 30, 14, 7); ctx.fill();
      for (const [x, y] of [[-110, 40], [-100, 40]]) { ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#777'; ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); }
      // main microcontroller (DIP-28)
      for (let k = 0; k < 14; k++) { ctx.fillStyle = '#c9ccd0'; ctx.fillRect(-6 + 12 * k, 28, 5, 8); ctx.fillRect(-6 + 12 * k, 76, 5, 8); }
      ctx.fillStyle = D.vgrad(ctx, 34, 78, [[0, '#333'], [1, '#0c0c0c']]); D.rrect(ctx, -14, 34, 180, 44, 3); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-14, 56, 6, -Math.PI / 2, Math.PI / 2); ctx.fill();
      // headers
      ctx.fillStyle = '#111'; ctx.fillRect(-150, -128, 140, 16); ctx.fillRect(10, -128, 160, 16); ctx.fillRect(-110, 112, 100, 16); ctx.fillRect(10, 112, 120, 16);
      for (const [x, y] of unoTerms) { ctx.fillStyle = '#3b3b3b'; ctx.fillRect(x - 4, y - 4 + (y < 0 ? 4 : -4), 8, 8); ctx.fillStyle = '#d4af37'; ctx.fillRect(x - 2, y - 2 + (y < 0 ? 4 : -4), 4, 4); }
      // pin activity dots (outputs: red = high, blue = low, purple = PWM)
      const drv = st.drv || [];
      for (const [, x, i] of UNO_TOP.concat(UNO_BOT)) {
        if (i > 19) continue; const d = drv[i]; if (d === undefined || d < 0) continue;
        const y = i < 14 ? -104 : 104, col = d >= 0.999 ? '#ff4040' : d <= 0.001 ? '#3a7bff' : '#c060ff';
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill();
      }
      // LEDs: ON, L, TX
      const IL = Math.max(0, M.IL || 0), bl = U.clamp(IL / 0.003, 0, 1.2), tx = rt && rt.txT >= 0 && (rt.tp - rt.txT) < 0.06;
      const leds = [['ON', 150, -70, '#4dff6a', on ? 1 : 0], ['L', 116, -70, '#ffb020', bl], ['TX', 116, -52, '#ffe14d', tx ? 1 : 0], ['RX', 116, -34, '#ffe14d', 0]];
      for (const [, x, y, col, b] of leds) {
        ctx.fillStyle = b > 0.05 ? col : U.rgba(col, 0.25); ctx.fillRect(x - 5, y - 3, 10, 6);
        if (b > 0.05) glow(ctx, x, y, 12 + 6 * b, col, Math.min(1, b));
      }
      D.upright(ctx, c, 0, 0, (ctx) => {
        for (const [lab, x, y] of leds) txt(ctx, lab, x - 16, y, 'bold 7px sans-serif', '#e8f4f6', 'center');
        for (const [lab, x] of UNO_TOP) txt(ctx, lab, x, -100, 'bold 6px sans-serif', '#ffffff');
        for (const [lab, x] of UNO_BOT) txt(ctx, lab, x, 101, 'bold 6px sans-serif', '#ffffff');
        txt(ctx, 'DIGITAL (PWM ~)', 60, -88, 'bold 7px sans-serif', '#d8f0f2');
        txt(ctx, 'POWER', -60, 88, 'bold 7px sans-serif', '#d8f0f2'); txt(ctx, 'ANALOG IN', 70, 88, 'bold 7px sans-serif', '#d8f0f2');
        txt(ctx, 'UNO', -60, -40, 'italic bold 34px sans-serif', '#ffffff');
        txt(ctx, 'ATmega328P', 76, 56, 'bold 9px sans-serif', '#cfcfcf');
        txt(ctx, '16.000', -45, 9, 'bold 6px sans-serif', '#444');
        const col = s === 'run' ? '#2ecc71' : s === 'off' ? '#7f8c8d' : s === 'reset' ? '#f39c12' : '#e74c3c';
        const lab = s === 'run' ? 'RUN' : s === 'off' ? 'OFF' : s === 'reset' ? 'RESET' : 'ERR L' + rt.err.line;
        ctx.fillStyle = col; D.rrect(ctx, -120, -2, 62, 18, 4); ctx.fill();
        txt(ctx, lab, -89, 7, 'bold 9px sans-serif', '#fff');
        if (c.props.lang === 'js') txt(ctx, 'JS', -89, 26, 'bold 8px sans-serif', '#ffe680');
      });
    },
  };

  // ATtiny85-style 8-pin chip: pins 1..8 = PB5/RESET, PB3, PB4, GND, PB0, PB1, PB2, VCC (needs a real supply)
  DEFS.attiny85 = {
    name: 'ATtiny85 单片机 (8 脚)', en: 'ATtiny85 Microcontroller', cat: 'mcu', desig: 'U', mcu: true,
    terms: [[-40, 20], [-20, 20], [0, 20], [20, 20], [20, -20], [0, -20], [-20, -20], [-40, -20]],
    termNames: ['1 PB5 / RESET', '2 PB3 / A3', '3 PB4 / A2 ~', '4 GND', '5 PB0 ~', '6 PB1 ~', '7 PB2 / A1', '8 VCC'],
    box: [-54, -20, 34, 20],
    props: [
      { k: 'rstio', label: 'PB5 作普通 IO (禁用复位)', kind: 'bool', def: false },
      { k: 'lang', label: '编程语言', kind: 'select', opts: LANG_OPTS.map((o) => o.slice()), def: 'ino' },
      { k: 'code', label: '程序', kind: 'code', def: BLINK_TINY },
    ],
    label: (c) => labelMcu(c),
    build(c, n, m) {
      const VCC = n[7], G = n[3];
      m.addR(VCC, G, 1 / 2500);                                            // ≈ 2 mA at 5 V (8 MHz)
      if (!c.props.rstio) m.addR(VCC, n[0], 1 / 35e3);                       // RESET pull-up
      buildPins(c, n, m, VCC, G);
      c._p = null;
    },
    measure(c, m) { const M = c._m, src = measurePins(c, m); M.I = (M.Vcc || 0) / 2500 + src + (c.props.rstio ? 0 : 0); M.V = M.Vcc; M.P = Math.abs(M.V * M.I); },
    post: postMcu,
    readings: readingsMcu,
    draw(ctx, c) {
      for (const [x, y] of DEFS.attiny85.terms) D.lead(ctx, x, y, x, y > 0 ? 10 : -10);
      ctx.fillStyle = D.vgrad(ctx, -13, 13, [[0, '#3a3a3a'], [0.5, '#1a1a1a'], [1, '#080808']]);
      D.rrect(ctx, -52, -13, 84, 26, 3); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-52, 0, 5, -Math.PI / 2, Math.PI / 2); ctx.fill();
      ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(-45, 7, 1.8, 0, 7); ctx.fill();
      const s = statusOf(c), drv = c.state.drv || [];
      D.upright(ctx, c, -10, 0, (ctx) => {
        txt(ctx, 'ATtiny85', -4, 0, 'bold 8px sans-serif', '#eee');
        const col = s === 'run' ? '#2ecc71' : s === 'off' ? '#666' : s === 'reset' ? '#f39c12' : '#e74c3c';
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(28, 0, 3, 0, 7); ctx.fill();
        if (col !== '#666') glow(ctx, 28, 0, 7, col, 0.6);
      });
      const names = ['PB5', 'PB3', 'PB4', 'GND', 'PB0', 'PB1', 'PB2', 'VCC'], pinOfTerm = [5, 3, 4, -1, 0, 1, 2, -1];
      ctx.font = '5px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      DEFS.attiny85.terms.forEach(([x, y], i) => {
        const p = pinOfTerm[i], d = p >= 0 ? drv[p] : undefined;
        ctx.fillStyle = d === undefined || d < 0 ? '#bbb' : d >= 0.999 ? '#ff6060' : d <= 0.001 ? '#7aa7ff' : '#d080ff';
        ctx.fillText(names[i], x, y > 0 ? 9 : -9);
      });
    },
  };
  CATEGORIES.splice(CATEGORIES.findIndex((x) => x[0] === 'logic') + 1, 0, ['mcu', '单片机 Microcontrollers']);

  // ---------------------------------------------------------------- program editor + serial monitor ---------------
  //  A floating (non-modal) window: the circuit keeps running while the program is edited.  The text being edited is
  //  a draft until "Upload": only then it is compiled, stored in the part's properties (saved with the circuit) and the
  //  chip restarts with it.
  const drafts = new Map();    // comp id → {code, lang}
  const W = { el: null, id: null, err: null, serN: -1, serLen: -1 };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const compById = (id) => (typeof app !== 'undefined' ? app.comps.find((c) => c.id === id) : null);
  function winHtml(c) {
    const d = DEFS[c.type];
    return '<div class="mw-h"><span class="mw-title">✎ ' + esc(_t('mcu.editor_title')) + ' — ' + esc(d.name) + ' <small>#' + c.id + '</small></span>' +
      '<span class="mw-st"></span><button class="mw-x" title="' + esc(_t('mcu.close')) + '">✕</button></div>' +
      '<div class="mw-tb"><label>' + esc(_t('mcu.lang')) + ' <select class="mw-lang">' + LANG_OPTS.map(([v, l]) => '<option value="' + v + '">' + l + '</option>').join('') + '</select></label>' +
      '<button class="mw-check">✓ ' + esc(_t('mcu.check')) + '</button>' +
      '<button class="mw-upload primary" title="Ctrl+S / Ctrl+Enter">⬆ ' + esc(_t('mcu.upload')) + '</button>' +
      '<button class="mw-reset">⟲ ' + esc(_t('mcu.reset_chip')) + '</button>' +
      '<button class="mw-revert" title="' + esc(_t('mcu.revert_title')) + '">↺ ' + esc(_t('mcu.revert')) + '</button>' +
      '<button class="mw-pin" title="' + esc(_t('help.title')) + '">📌 ' + esc(_t('help.btn')) + '</button></div>' +
      '<div class="mw-ed"><div class="mw-gut"></div><textarea class="mw-code" spellcheck="false" autocomplete="off" autocapitalize="off" wrap="off"></textarea></div>' +
      '<div class="mw-msg"></div>' +
      '<div class="mw-sh"><b>⌨ ' + esc(_t('mcu.serial_monitor')) + '</b><span class="mw-baud">9600 baud</span><span class="mw-sp"></span>' +
      '<label><input type="checkbox" class="mw-auto" checked> ' + esc(_t('mcu.autoscroll')) + '</label><button class="mw-clr">' + esc(_t('mcu.clear')) + '</button></div>' +
      '<pre class="mw-ser"></pre>' +
      '<div class="mw-in"><input type="text" class="mw-send-in" placeholder="' + esc(_t('mcu.send_ph')) + '"><button class="mw-send">' + esc(_t('mcu.send')) + '</button></div>' +
      '<div class="mw-grip"></div>';
  }
  function openEditor(c, focusSerial) {
    if (!c || !DEFS[c.type] || !DEFS[c.type].mcu) return;
    if (W.el && W.id !== c.id) saveDraft();
    let el = W.el;
    if (!el) {
      el = document.createElement('div'); el.id = 'mcu-win'; el.className = 'mcu-win';
      document.body.appendChild(el); W.el = el;
      const r = document.getElementById('stage') ? document.getElementById('stage').getBoundingClientRect() : { right: innerWidth, top: 60 };
      el.style.left = Math.max(8, r.right - 600) + 'px'; el.style.top = Math.max(8, r.top + 12) + 'px';
    }
    W.id = c.id; W.err = null; W.serN = -1; W.serLen = -1;
    el.innerHTML = winHtml(c);
    el.style.display = 'flex';
    bindWin(el);
    const dr = drafts.get(c.id);
    el.querySelector('.mw-code').value = dr ? dr.code : c.props.code || '';
    el.querySelector('.mw-lang').value = dr ? dr.lang : c.props.lang || 'ino';
    gutter(); showMsg(); tick(true);
    const ta = el.querySelector('.mw-code'); ta.setSelectionRange(0, 0); ta.scrollTop = 0;
    if (focusSerial) el.querySelector('.mw-send-in').focus(); else { ta.focus({ preventScroll: true }); ta.scrollTop = 0; }
    gutter();
  }
  function closeEditor() { if (!W.el) return; saveDraft(); W.el.style.display = 'none'; W.id = null; }
  function saveDraft() {
    if (!W.el || W.id === null) return;
    const c = compById(W.id); if (!c) return;
    const code = W.el.querySelector('.mw-code').value, lang = W.el.querySelector('.mw-lang').value;
    if (code !== c.props.code || lang !== c.props.lang) drafts.set(c.id, { code, lang }); else drafts.delete(c.id);
  }
  function gutter() {
    const el = W.el; if (!el) return;
    const ta = el.querySelector('.mw-code'), g = el.querySelector('.mw-gut');
    const n = ta.value.split('\n').length, errL = W.err ? W.err.line : -1;
    let h = ''; for (let i = 1; i <= n; i++) h += '<div' + (i === errL ? ' class="err"' : '') + '>' + i + '</div>';
    g.innerHTML = h + '<div>&nbsp;</div>'; g.scrollTop = ta.scrollTop;
  }
  function showMsg(kind, text) {
    const m = W.el && W.el.querySelector('.mw-msg'); if (!m) return;
    m.className = 'mw-msg' + (kind ? ' ' + kind : ''); m.innerHTML = text || esc(_t('mcu.hint'));
    if (kind === 'err' && W.err) { const a = m.querySelector('a'); if (a) a.onclick = (e) => { e.preventDefault(); gotoLine(W.err.line); }; }
  }
  function gotoLine(line) {
    const ta = W.el.querySelector('.mw-code'), L = ta.value.split('\n');
    let pos = 0; for (let i = 0; i < Math.min(line - 1, L.length); i++) pos += L[i].length + 1;
    ta.focus(); ta.setSelectionRange(pos, pos + (L[line - 1] || '').length);
    ta.scrollTop = Math.max(0, (line - 4) * 18); gutter();
  }
  // scroll the editor (without moving the caret) so that `line` is visible
  function revealLine(line) {
    const ta = W.el.querySelector('.mw-code'), top = (line - 1) * 18;
    if (top < ta.scrollTop || top > ta.scrollTop + ta.clientHeight - 36) ta.scrollTop = Math.max(0, top - ta.clientHeight / 2);
  }
  function errHtml(e, rt) {
    return '<a href="#">' + esc(_t('mcu.line_n', { line: e.line })) + '</a> ' + esc(rt ? _t('mcu.r.' + e.key, e.params) : MCULANG.errorText(e));
  }
  function doCompile(upload) {
    const c = compById(W.id); if (!c) return null;
    const code = W.el.querySelector('.mw-code').value, lang = W.el.querySelector('.mw-lang').value;
    const r = MCULANG.compile(code, lang === 'js' ? 'js' : 'ino', BOARDS[c.type].consts);
    if (!r.ok) { W.err = r.error; revealLine(r.error.line); gutter(); showMsg('err', '✗ ' + esc(_t('mcu.compile_failed')) + ' — ' + errHtml(r.error)); return r; }
    W.err = null; gutter();
    const warn = (r.warnings || []).map((w) => esc(_t('mcu.w.' + w.key, w.params))).join(' · ');
    if (upload) {
      uploadTo(c, code, lang);
      drafts.delete(c.id);
      showMsg('ok', '✓ ' + esc(_t('mcu.uploaded', { n: code.length })) + (warn ? ' · ' + warn : ''));
    } else showMsg('ok', '✓ ' + esc(_t('mcu.compile_ok')) + (warn ? ' · ' + warn : ''));
    return r;
  }
  // store a program in the part (undoable, saved with the circuit) and restart the chip with it
  function uploadTo(c, code, lang) {
    c.props.code = code; c.props.lang = lang;
    c.state.rt = null; c.state.ser = '';
    app.dirty = true; app.changed(); if (app.refreshProps) app.refreshProps();
    if (!app.running) app.run();
    app.toast(_t('mcu.toast_uploaded'));
  }
  function bindWin(el) {
    const $q = (s) => el.querySelector(s);
    const ta = $q('.mw-code');
    $q('.mw-x').onclick = closeEditor;
    $q('.mw-pin').onclick = () => { const c = compById(W.id); if (typeof MCUHELP !== 'undefined' && MCUHELP) MCUHELP.open(c ? c.type : null); };
    $q('.mw-check').onclick = () => doCompile(false);
    $q('.mw-upload').onclick = () => doCompile(true);
    $q('.mw-reset').onclick = () => { const c = compById(W.id); if (c) { c.state.rt = null; c.state.ser = ''; W.serLen = -1; app.toast(_t('mcu.toast_reset')); } };
    $q('.mw-revert').onclick = () => { const c = compById(W.id); if (!c) return; drafts.delete(c.id); ta.value = c.props.code || ''; $q('.mw-lang').value = c.props.lang || 'ino'; W.err = null; gutter(); showMsg(); };
    $q('.mw-clr').onclick = () => { const c = compById(W.id); if (c) c.state.ser = ''; W.serLen = -1; tick(true); };
    const send = () => {
      const c = compById(W.id), inp = $q('.mw-send-in'); if (!c) return;
      const s = inp.value + '\n'; c.state.sin = c.state.sin || []; const rt = c.state.rt;
      const q = rt ? rt.sin : c.state.sin; for (const ch of s) q.push(ch.charCodeAt(0) & 255);
      inp.value = '';
    };
    $q('.mw-send').onclick = send;
    $q('.mw-send-in').onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); send(); } };
    $q('.mw-lang').onchange = () => { W.err = null; gutter(); showMsg(); };
    ta.addEventListener('scroll', () => { $q('.mw-gut').scrollTop = ta.scrollTop; });
    ta.addEventListener('input', () => { if (W.err) W.err = null; gutter(); });
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 's' || e.key === 'S' || e.key === 'Enter')) { e.preventDefault(); doCompile(true); return; }
      if (e.key === 'Escape') { ta.blur(); return; }
      const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
      const ins = (txt, sa, sb) => { ta.setRangeText(txt, sa, sb, 'end'); ta.dispatchEvent(new Event('input')); };
      if (e.key === 'Tab') {
        e.preventDefault();
        const ls = v.lastIndexOf('\n', a - 1) + 1;
        if (a === b && !e.shiftKey) { ins('  ', a, b); return; }
        const le = v.indexOf('\n', b - (b > a && v[b - 1] === '\n' ? 1 : 0)); const end = le < 0 ? v.length : le;
        const block = v.slice(ls, end);
        const out = e.shiftKey ? block.replace(/^ {1,2}/gm, '') : block.replace(/^/gm, '  ');
        ta.setRangeText(out, ls, end, 'select'); ta.dispatchEvent(new Event('input'));
        return;
      }
      if (e.key === 'Enter' && !mod) {
        e.preventDefault();
        const ls = v.lastIndexOf('\n', a - 1) + 1, line = v.slice(ls, a), ind = /^\s*/.exec(line)[0];
        const extra = /[{(\[]\s*$/.test(line) ? '  ' : '';
        if (extra && v[b] === '}') { ins('\n' + ind + extra + '\n' + ind, a, b); ta.setSelectionRange(a + 1 + ind.length + 2, a + 1 + ind.length + 2); return; }
        ins('\n' + ind + extra, a, b); return;
      }
      if (e.key === '}' && a === b) {
        const ls = v.lastIndexOf('\n', a - 1) + 1, line = v.slice(ls, a);
        if (/^\s+$/.test(line) && line.length >= 2) { e.preventDefault(); ins(line.slice(2) + '}', ls, a); }
      }
    });
    // drag by the header, resize by the grip
    const h = $q('.mw-h');
    h.onpointerdown = (e) => {
      if (e.target.closest('button')) return;
      const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      const mv = (ev) => { el.style.left = U.clamp(ev.clientX - dx, 0, innerWidth - 80) + 'px'; el.style.top = U.clamp(ev.clientY - dy, 0, innerHeight - 40) + 'px'; };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    };
    $q('.mw-grip').onpointerdown = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
      const mv = (ev) => { el.style.width = Math.max(380, r.width + ev.clientX - x0) + 'px'; el.style.height = Math.max(360, r.height + ev.clientY - y0) + 'px'; };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    };
  }
  // refreshed by the app's UI tick (≈ 8 Hz) and after language changes
  function tick(force) {
    if (!W.el || W.id === null || W.el.style.display === 'none') return;
    const c = compById(W.id);
    if (!c) { closeEditor(); return; }
    const st = c.state, rt = st.rt, s = statusOf(c);
    const stEl = W.el.querySelector('.mw-st');
    const txtS = _t('mcu.st.' + s) + (rt && !rt.err ? ' · ' + (rt.upMs(app.t) / 1000).toFixed(2) + ' s' : '');
    if (stEl.textContent !== txtS || force) { stEl.textContent = txtS; stEl.className = 'mw-st ' + s; }
    if (rt && rt.err && rt.err.runtime && W.err !== rt.err && !W.el.querySelector('.mw-msg.err')) {
      W.err = rt.err; gutter(); showMsg('err', '✗ ' + esc(_t('mcu.runtime_error')) + ' — ' + errHtml(rt.err, true));
    }
    const ser = st.ser || '';
    if (force || ser.length !== W.serLen || (st.serN || 0) !== W.serN) {
      W.serLen = ser.length; W.serN = st.serN || 0;
      const pre = W.el.querySelector('.mw-ser');
      pre.textContent = ser.replace(/\r\n?/g, '\n').slice(-12000);
      if (W.el.querySelector('.mw-auto').checked) pre.scrollTop = pre.scrollHeight;
    }
  }
  function relang() { if (W.el && W.id !== null && W.el.style.display !== 'none') { const c = compById(W.id); if (!c) return; saveDraft(); const ta = W.el.querySelector('.mw-code'), top = ta.scrollTop; openEditor(c); W.el.querySelector('.mw-code').scrollTop = top; gutter(); } }

  return { BOARDS, McuRT, RtErr, errText, statusOf, BLINK_UNO, BLINK_TINY, setDrive, openEditor, closeEditor, tick, relang, uploadTo, drafts, W };
})();
