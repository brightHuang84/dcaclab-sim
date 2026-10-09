'use strict';
// =====================================================================================================================
//  v10 · microcontroller program support
//  Translates the Arduino C/C++ subset used by typical sketches into JavaScript *generator* functions, so that delay()
//  and friends can suspend the program until the circuit simulation has caught up (scheduler: McuRT in mcu.js).
//  Also instruments plain JavaScript programs the same way.  Everything here is original code.
// =====================================================================================================================
const MCULANG = (() => {
  class CErr extends Error {
    constructor(line, key, params) { super(key); this.line = line || 1; this.key = key; this.params = params || {}; }
  }
  const fail = (line, key, params) => { throw new CErr(line, key, params); };

  // ------------------------------------------------------------------ lexer (C) -----------------------------------
  const PUNCT = ['<<=', '>>=', '...', '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=',
    '%=', '&=', '|=', '^=', '::', '##', '+', '-', '*', '/', '%', '<', '>', '=', '!', '~', '&', '|', '^', '?', ':', ';', ',',
    '.', '(', ')', '[', ']', '{', '}', '#'];
  function unescape(s, i, line) {   // s[i] === '\\' → [charCode, nextIndex]
    const c = s[i + 1];
    const simple = { n: 10, t: 9, r: 13, '0': 0, '\\': 92, "'": 39, '"': 34, a: 7, b: 8, f: 12, v: 11, '?': 63 };
    if (c === 'x') { const m = /^[0-9a-fA-F]{1,2}/.exec(s.slice(i + 2)); if (!m) fail(line, 'char_lit'); return [parseInt(m[0], 16), i + 2 + m[0].length]; }
    if (/[0-7]/.test(c)) { const m = /^[0-7]{1,3}/.exec(s.slice(i + 1)); return [parseInt(m[0], 8) & 255, i + 1 + m[0].length]; }
    if (c in simple) return [simple[c], i + 2];
    if (c === undefined) fail(line, 'char_lit');
    return [c.charCodeAt(0), i + 2];
  }
  // tokens: {t:'id'|'num'|'str'|'chr'|'op'|'pp'|'eof', v, line, bol (first on its line)}
  function lex(src) {
    const out = []; let i = 0, line = 1, bol = true; const n = src.length;
    while (i < n) {
      const ch = src[i];
      if (ch === '\n') { line++; i++; bol = true; continue; }
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\f' || ch === '\v') { i++; continue; }
      if (ch === '\\' && (src[i + 1] === '\n' || (src[i + 1] === '\r' && src[i + 2] === '\n'))) { i += src[i + 1] === '\n' ? 2 : 3; line++; continue; }
      if (ch === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (ch === '/' && src[i + 1] === '*') {
        const l0 = line; i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
        if (i >= n) fail(l0, 'unterminated_comment');
        i += 2; continue;
      }
      if (ch === '#' && bol) {   // preprocessor directive: collect the whole logical line
        const l0 = line; let j = i + 1, txt = '';
        while (j < n && src[j] !== '\n') {
          if (src[j] === '\\' && src[j + 1] === '\n') { j += 2; line++; txt += ' '; continue; }
          if (src[j] === '/' && src[j + 1] === '/') { while (j < n && src[j] !== '\n') j++; break; }
          if (src[j] === '/' && src[j + 1] === '*') {
            j += 2; while (j < n && !(src[j] === '*' && src[j + 1] === '/')) { if (src[j] === '\n') line++; j++; }
            j += 2; txt += ' '; continue;
          }
          txt += src[j]; j++;
        }
        out.push({ t: 'pp', v: txt.trim(), line: l0, bol: true }); i = j; continue;
      }
      const tok = { line, bol }; bol = false;
      if (/[A-Za-z_]/.test(ch)) {
        let j = i + 1; while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
        tok.t = 'id'; tok.v = src.slice(i, j); i = j; out.push(tok); continue;
      }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        const m = /^(0[xX][0-9a-fA-F']+|0[bB][01']+|(?:[0-9][0-9']*\.?[0-9']*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)([uUlLfF]*)/.exec(src.slice(i));
        let body = m[1].replace(/'/g, ''); const suf = m[2].toLowerCase(); i += m[0].length;
        if (/[A-Za-z0-9_.]/.test(src[i] || '')) fail(line, 'bad_number', { text: m[0] + src[i] });
        let v, isF = false;
        if (/^0[xX]/.test(body)) v = parseInt(body.slice(2), 16);
        else if (/^0[bB]/.test(body)) v = parseInt(body.slice(2), 2);
        else if (/[.eE]/.test(body) || suf.includes('f')) { v = parseFloat(body); isF = true; }
        else if (/^0[0-7]+$/.test(body)) v = parseInt(body, 8);
        else if (/^0[0-9]+$/.test(body)) fail(line, 'bad_number', { text: body });
        else v = parseInt(body, 10);
        if (!isF && suf.includes('f')) fail(line, 'bad_number', { text: m[0] });
        tok.t = 'num'; tok.v = v; tok.f = isF; tok.u = suf.includes('u'); tok.l = (suf.match(/l/g) || []).length; out.push(tok); continue;
      }
      if (ch === '"') {
        let j = i + 1, s = '';
        while (true) {
          if (j >= n || src[j] === '\n') fail(line, 'unterminated_str');
          if (src[j] === '"') break;
          if (src[j] === '\\') { const [c, k] = unescape(src, j, line); s += String.fromCharCode(c); j = k; continue; }
          s += src[j]; j++;
        }
        tok.t = 'str'; tok.v = s; i = j + 1; out.push(tok); continue;
      }
      if (ch === "'") {
        let j = i + 1, c;
        if (src[j] === '\\') { [c, j] = unescape(src, j, line); } else { if (src[j] === "'" || src[j] === '\n' || j >= n) fail(line, 'char_lit'); c = src.charCodeAt(j); j++; }
        if (src[j] !== "'") fail(line, 'char_lit');
        tok.t = 'chr'; tok.v = c > 255 ? 63 : c; i = j + 1; out.push(tok); continue;
      }
      let p = null; for (const q of PUNCT) if (src.startsWith(q, i)) { p = q; break; }
      if (!p) fail(line, 'unexpected', { tok: ch });
      tok.t = 'op'; tok.v = p; i += p.length; out.push(tok);
    }
    out.push({ t: 'eof', v: '', line, bol: true });
    return out;
  }

  // ------------------------------------------------------------------ preprocessor --------------------------------
  //  #define (object- and function-like), #undef, #include (recorded only), #if/#ifdef/#ifndef/#elif/#else/#endif,
  //  #pragma / #error / #warning (ignored / error)
  function preprocess(toks, predefined) {
    const macros = new Map(Object.entries(predefined || {}).map(([k, v]) => [k, { body: [{ t: 'num', v, line: 0 }] }]));
    const includes = [];
    const out = [], cond = [];   // cond stack entries: {on, done, else}
    const active = () => cond.every((c) => c.on);
    const subLex = (txt, line) => lex(txt).slice(0, -1).map((t) => Object.assign(t, { line }));
    const evalIf = (txt, line) => {
      let ts = subLex(txt.replace(/\bdefined\s*\(\s*([A-Za-z_]\w*)\s*\)|\bdefined\s+([A-Za-z_]\w*)/g, (m, a, b) => (macros.has(a || b) ? ' 1 ' : ' 0 ')), line);
      ts = expand(ts, new Set());
      const P = new Parser(ts.concat([{ t: 'eof', v: '', line }]), new Set());
      const e = P.parseExpr();
      const v = constFold(e, (name) => 0);
      if (v === null) fail(line, 'pp', { dir: '#if' });
      return !!v;
    };
    function expand(list, hide) {
      const res = [];
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (t.t !== 'id' || hide.has(t.v) || !macros.has(t.v)) { res.push(t); continue; }
        const m = macros.get(t.v);
        if (m.params) {
          if (!(list[i + 1] && list[i + 1].v === '(' && list[i + 1].t === 'op')) { res.push(t); continue; }
          let depth = 0, j = i + 1; const args = [[]];
          for (; j < list.length; j++) {
            const u = list[j];
            if (u.t === 'op' && u.v === '(') { if (depth++ === 0) continue; }
            else if (u.t === 'op' && u.v === ')') { if (--depth === 0) break; }
            else if (u.t === 'op' && u.v === ',' && depth === 1) { args.push([]); continue; }
            args[args.length - 1].push(u);
          }
          if (j >= list.length) fail(t.line, 'pp', { dir: t.v + '(' });
          if (m.params.length === 0 && args.length === 1 && args[0].length === 0) args.length = 0;
          if (args.length !== m.params.length) fail(t.line, 'args', { name: t.v, n: m.params.length });
          const body = [];
          for (let k = 0; k < m.body.length; k++) {
            const b = m.body[k];
            if (b.t === 'op' && b.v === '#' && m.body[k + 1] && m.params.includes(m.body[k + 1].v)) {
              const a = args[m.params.indexOf(m.body[k + 1].v)];
              body.push({ t: 'str', v: a.map((x) => (x.t === 'str' ? JSON.stringify(x.v) : String(x.v))).join(' '), line: t.line }); k++; continue;
            }
            const pi = b.t === 'id' ? m.params.indexOf(b.v) : -1;
            if (pi >= 0) body.push(...expand(args[pi], hide).map((x) => Object.assign({}, x, { line: t.line })));
            else body.push(Object.assign({}, b, { line: t.line }));
          }
          const h2 = new Set(hide); h2.add(t.v);
          res.push(...expand(body, h2));
          i = j;
        } else {
          const h2 = new Set(hide); h2.add(t.v);
          res.push(...expand(m.body.map((x) => Object.assign({}, x, { line: t.line })), h2));
        }
      }
      return res;
    }
    let pending = [];
    const flush = () => { if (pending.length) { out.push(...expand(pending, new Set())); pending = []; } };
    for (const t of toks) {
      if (t.t !== 'pp') { if (t.t === 'eof') { flush(); out.push(t); } else if (active()) pending.push(t); continue; }
      const m = /^(\w*)\s*([\s\S]*)$/.exec(t.v), dir = m[1], rest = m[2];
      if (dir === 'ifdef' || dir === 'ifndef') {
        const name = rest.trim().split(/\s+/)[0]; const on = macros.has(name) === (dir === 'ifdef');
        cond.push({ on, done: on }); continue;
      }
      if (dir === 'if') { const on = active() ? evalIf(rest, t.line) : false; cond.push({ on, done: on }); continue; }
      if (dir === 'elif') { const c = cond[cond.length - 1]; if (!c) fail(t.line, 'pp', { dir: '#elif' }); if (c.done) c.on = false; else { cond.pop(); const on = active() ? evalIf(rest, t.line) : false; cond.push(c); c.on = on; c.done = on; } continue; }
      if (dir === 'else') { const c = cond[cond.length - 1]; if (!c) fail(t.line, 'pp', { dir: '#else' }); c.on = !c.done; c.done = true; continue; }
      if (dir === 'endif') { if (!cond.pop()) fail(t.line, 'pp', { dir: '#endif' }); continue; }
      if (!active()) continue;
      flush();
      if (dir === 'define') {
        const mm = /^([A-Za-z_]\w*)(\(([^)]*)\))?\s*([\s\S]*)$/.exec(rest);
        if (!mm) fail(t.line, 'pp', { dir: '#define' });
        const params = mm[2] !== undefined ? mm[3].split(',').map((s) => s.trim()).filter((s) => s) : null;
        macros.set(mm[1], { params, body: subLex(mm[4], t.line) });
      } else if (dir === 'undef') macros.delete(rest.trim());
      else if (dir === 'include') includes.push(rest.replace(/[<>"]/g, '').trim());
      else if (dir === 'pragma' || dir === 'warning' || dir === 'line' || dir === '') { /* ignored */ }
      else if (dir === 'error') fail(t.line, 'pp', { dir: '#error ' + rest });
      else fail(t.line, 'pp', { dir: '#' + dir });
    }
    if (cond.length) fail(toks[toks.length - 1].line, 'pp', { dir: '#endif' });
    return { toks: out, includes };
  }

  // ------------------------------------------------------------------ types ---------------------------------------
  const T = {
    void: { k: 'void' }, bool: { k: 'bool' }, char: { k: 'char' },
    i8: { k: 'int', b: 8, u: false }, u8: { k: 'int', b: 8, u: true }, i16: { k: 'int', b: 16, u: false }, u16: { k: 'int', b: 16, u: true },
    i32: { k: 'int', b: 32, u: false }, u32: { k: 'int', b: 32, u: true }, i64: { k: 'int', b: 64, u: false }, f: { k: 'float' },
    str: { k: 'str' }, servo: { k: 'obj', cls: 'Servo' }, lcd: { k: 'obj', cls: 'LiquidCrystal' },
    dht: { k: 'obj', cls: 'DHT' }, ow: { k: 'obj', cls: 'OneWire' }, dallas: { k: 'obj', cls: 'DallasTemperature' }, lcdi2c: { k: 'obj', cls: 'LiquidCrystal_I2C' }, owp: { k: 'owp' },
  };
  const tyName = (t) => {
    if (!t) return '?';
    switch (t.k) {
      case 'int': return t.b === 64 ? 'long long' : (t.u ? 'unsigned ' : '') + (t.b === 8 ? 'char' : t.b === 16 ? 'int' : 'long');
      case 'float': return 'float'; case 'str': return 'String'; case 'obj': return t.cls; case 'owp': return 'OneWire*';
      case 'arr': return tyName(t.of) + '[]'.repeat(t.n);
      default: return t.k;
    }
  };
  const isNum = (t) => t.k === 'int' || t.k === 'float' || t.k === 'bool' || t.k === 'char';
  const isInt = (t) => t.k === 'int' || t.k === 'bool' || t.k === 'char';
  const isCharArr = (t) => t.k === 'arr' && t.n === 1 && (t.of.k === 'char' || (t.of.k === 'int' && t.of.b === 8));
  const asInt = (t) => (t.k === 'int' ? t : T.i16);   // bool/char promote to int
  const promote = (a, b) => {
    a = asInt(a); b = asInt(b || a);
    const bits = Math.max(16, a.b, b.b);
    const u = (a.u && a.b >= bits) || (b.u && b.b >= bits);
    return bits === 64 ? T.i64 : bits === 32 ? (u ? T.u32 : T.i32) : (u ? T.u16 : T.i16);
  };
  const sizeOf = (t) => {
    switch (t.k) { case 'bool': case 'char': return 1; case 'int': return t.b / 8; case 'float': return 4; case 'str': return 6; case 'obj': return 4; default: return 2; }
  };
  const BASEW = new Set(['void', 'bool', 'boolean', 'char', 'short', 'int', 'long', 'float', 'double', 'signed', 'unsigned', 'byte', 'word',
    'String', 'size_t', 'uint8_t', 'int8_t', 'uint16_t', 'int16_t', 'uint32_t', 'int32_t', 'uint64_t', 'int64_t', 'Servo', 'LiquidCrystal', 'DHT', 'OneWire', 'DallasTemperature', 'LiquidCrystal_I2C']);
  const OBJW = new Set(['Servo', 'LiquidCrystal', 'DHT', 'OneWire', 'DallasTemperature', 'LiquidCrystal_I2C']);   // library classes (no functional cast)
  const QUALW = new Set(['const', 'static', 'volatile', 'constexpr', 'inline', 'extern', 'register', 'unsigned', 'signed']);
  const UNSUP_KW = new Set(['struct', 'class', 'union', 'typedef', 'template', 'goto', 'namespace', 'using', 'new', 'delete', 'auto', 'operator', 'virtual', 'asm', 'try', 'throw']);

  // ------------------------------------------------------------------ parser --------------------------------------
  const PREC = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10 };
  const ASSIGN = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);
  class Parser {
    constructor(toks, typeNames) { this.t = toks; this.i = 0; this.types = typeNames || new Set(); }
    get p() { return this.t[this.i]; }
    peek(k) { return this.t[Math.min(this.i + (k || 0), this.t.length - 1)]; }
    next() { const t = this.t[this.i]; if (this.i < this.t.length - 1) this.i++; return t; }
    is(v, k) { const t = this.peek(k); return (t.t === 'op' || t.t === 'id') && t.v === v; }
    isOp(v, k) { const t = this.peek(k); return t.t === 'op' && t.v === v; }
    accept(v) { if (this.isOp(v)) { this.next(); return true; } return false; }
    tokText(t) { return t.t === 'eof' ? 'EOF' : t.t === 'str' ? '"' + t.v + '"' : t.t === 'chr' ? "'" + String.fromCharCode(t.v) + "'" : String(t.v); }
    expect(v) {
      const t = this.p;
      if (t.t === 'op' && t.v === v) return this.next();
      if (t.t === 'eof') fail(t.line, 'eof', { want: v });
      // a missing ';' is usually noticed on the next line → report the line of the previous token
      const line = v === ';' && this.i > 0 && this.t[this.i - 1].line < t.line ? this.t[this.i - 1].line : t.line;
      fail(line, 'expected', { want: v, got: this.tokText(t) });
    }
    ident() { const t = this.p; if (t.t !== 'id') fail(t.line, t.t === 'eof' ? 'eof' : 'expected', { want: 'identifier', got: this.tokText(t) }); return this.next().v; }
    isTypeStart(k) {
      const t = this.peek(k || 0);
      return t.t === 'id' && (BASEW.has(t.v) || QUALW.has(t.v) || this.types.has(t.v));
    }
    // type specifier → {ty, konst, stat} or null
    typeSpec() {
      const line = this.p.line;
      let konst = false, stat = false, uns = null, longs = 0, short = false, base = null, any = false;
      while (this.p.t === 'id') {
        const v = this.p.v;
        if (v === 'const' || v === 'constexpr') konst = true;
        else if (v === 'static') stat = true;
        else if (v === 'volatile' || v === 'inline' || v === 'extern' || v === 'register') { /* ignored */ }
        else if (v === 'unsigned') uns = true;
        else if (v === 'signed') uns = false;
        else if (v === 'long') longs++;
        else if (v === 'short') short = true;
        else if (BASEW.has(v) || this.types.has(v)) { if (base) break; base = this.types.has(v) ? 'enum' : v; }
        else break;
        any = true; this.next();
      }
      if (!any) return null;
      let ty;
      switch (base) {
        case 'char': ty = uns === true ? T.u8 : uns === false ? T.i8 : T.char; break;
        case 'float': case 'double': ty = T.f; break;
        case 'bool': case 'boolean': ty = T.bool; break;
        case 'void': ty = T.void; break;
        case 'byte': case 'uint8_t': ty = T.u8; break;
        case 'int8_t': ty = T.i8; break;
        case 'word': case 'uint16_t': case 'size_t': ty = T.u16; break;
        case 'int16_t': ty = T.i16; break;
        case 'uint32_t': ty = T.u32; break;
        case 'int32_t': ty = T.i32; break;
        case 'uint64_t': case 'int64_t': ty = T.i64; break;
        case 'String': ty = T.str; break;
        case 'Servo': ty = T.servo; break;
        case 'LiquidCrystal': ty = T.lcd; break;
        case 'DHT': ty = T.dht; break;
        case 'OneWire': ty = T.ow; break;
        case 'DallasTemperature': ty = T.dallas; break;
        case 'LiquidCrystal_I2C': ty = T.lcdi2c; break;
        case 'enum': ty = T.i16; break;
        default:
          if (base === null && !(uns !== null || longs || short)) return null;
          ty = longs >= 2 ? T.i64 : longs === 1 ? (uns ? T.u32 : T.i32) : (uns ? T.u16 : T.i16);
      }
      return { ty, konst, stat, line };
    }
    // ---- expressions
    parseExpr() {
      const first = this.parseAssign();
      if (!this.isOp(',')) return first;
      const list = [first]; while (this.accept(',')) list.push(this.parseAssign());
      return { k: 'comma', list, line: first.line };
    }
    parseAssign() {
      const lhs = this.parseCond();
      if (this.p.t === 'op' && ASSIGN.has(this.p.v)) { const op = this.next().v; const rhs = this.parseAssign(); return { k: 'asg', op, a: lhs, b: rhs, line: lhs.line }; }
      return lhs;
    }
    parseCond() {
      const c = this.parseBin(1);
      if (!this.isOp('?')) return c;
      this.next(); const a = this.parseExpr(); this.expect(':'); const b = this.parseAssign();
      return { k: 'cond', c, a, b, line: c.line };
    }
    parseBin(min) {
      let a = this.parseUnary();
      for (;;) {
        const t = this.p; const pr = t.t === 'op' ? PREC[t.v] : undefined;
        if (pr === undefined || pr < min) return a;
        this.next(); const b = this.parseBin(pr + 1);
        a = { k: 'bin', op: t.v, a, b, line: t.line };
      }
    }
    parseUnary() {
      const t = this.p;
      if (t.t === 'op') {
        if (t.v === '++' || t.v === '--') { this.next(); return { k: 'pre', op: t.v, a: this.parseUnary(), line: t.line }; }
        if (t.v === '!' || t.v === '~' || t.v === '-' || t.v === '+') { this.next(); return { k: 'un', op: t.v, a: this.parseUnary(), line: t.line }; }
        if (t.v === '&' && this.peek(1).t === 'id' && !this.isOp('(', 2) && !this.isOp('[', 2) && !this.isOp('.', 2)) { this.next(); const id = this.next(); return { k: 'addr', name: id.v, line: t.line }; }   // only &oneWire (checked by the emitter)
        if (t.v === '&' || t.v === '*') fail(t.line, 'unsupported', { what: t.v === '&' ? '&(address-of)' : '*(pointer)' });
        if (t.v === '(' && this.isTypeStart(1)) {
          this.next(); const s = this.typeSpec(); let ty = s.ty;
          while (this.accept('*')) { if (ty === T.char || ty === T.u8 || ty === T.i8) ty = T.str; else fail(t.line, 'unsupported', { what: 'pointer' }); }
          this.expect(')');
          return { k: 'cast', ty, e: this.parseUnary(), line: t.line };
        }
      }
      if (t.t === 'id' && t.v === 'sizeof') {
        this.next();
        if (this.isOp('(') && this.isTypeStart(1)) { this.next(); const s = this.typeSpec(); this.expect(')'); return { k: 'sizeof', ty: s.ty, line: t.line }; }
        return { k: 'sizeof', e: this.parseUnary(), line: t.line };
      }
      return this.parsePostfix();
    }
    parsePostfix() {
      let e = this.parsePrimary();
      for (;;) {
        const t = this.p;
        if (t.t !== 'op') return e;
        if (t.v === '[') { this.next(); const i = this.parseExpr(); this.expect(']'); e = { k: 'idx', a: e, i, line: t.line }; }
        else if (t.v === '(') { this.next(); const args = this.args(); e = { k: 'call', f: e, args, line: t.line }; }
        else if (t.v === '.') { this.next(); const name = this.ident(); e = { k: 'mem', o: e, name, line: t.line }; }
        else if (t.v === '->') fail(t.line, 'unsupported', { what: '->' });
        else if (t.v === '::') fail(t.line, 'unsupported', { what: '::' });
        else if (t.v === '++' || t.v === '--') { this.next(); e = { k: 'post', op: t.v, a: e, line: t.line }; }
        else return e;
      }
    }
    args() {   // after '(' → list, consumes ')'
      const a = [];
      if (this.accept(')')) return a;
      do a.push(this.parseAssign()); while (this.accept(','));
      this.expect(')');
      return a;
    }
    parsePrimary() {
      const t = this.p;
      if (t.t === 'num') {
        this.next(); let ty;
        if (t.f) ty = T.f;
        else if (t.l >= 2 || t.v > 0xffffffff) ty = T.i64;
        else if (t.u) ty = (t.l || t.v > 0xffff) ? T.u32 : T.u16;
        else if (t.l) ty = t.v > 0x7fffffff ? T.u32 : T.i32;
        else ty = t.v <= 0x7fff ? T.i16 : t.v <= 0x7fffffff ? T.i32 : T.u32;
        return { k: 'num', v: t.v, ty, line: t.line };
      }
      if (t.t === 'str') { this.next(); let s = t.v; while (this.p.t === 'str') s += this.next().v; return { k: 'str', v: s, line: t.line }; }
      if (t.t === 'chr') { this.next(); return { k: 'chr', v: t.v, line: t.line }; }
      if (t.t === 'id') {
        if (UNSUP_KW.has(t.v)) fail(t.line, 'unsupported', { what: t.v });
        if ((BASEW.has(t.v) || t.v === 'unsigned') && !OBJW.has(t.v)) {
          // functional cast: int(x), float(x), String(x [, HEX])
          const s = this.typeSpec();
          if (!s || !this.isOp('(')) fail(t.line, 'unexpected', { tok: t.v });
          this.next(); const args = this.args();
          if (!args.length) fail(t.line, 'args', { name: t.v, n: 1 });
          return { k: 'cast', ty: s.ty, e: args[0], args, fn: true, line: t.line };
        }
        this.next();
        if (/^B[01]{1,8}$/.test(t.v)) return { k: 'num', v: parseInt(t.v.slice(1), 2), ty: T.i16, line: t.line };
        return { k: 'id', name: t.v, line: t.line };
      }
      if (t.t === 'op' && t.v === '(') { this.next(); const e = this.parseExpr(); this.expect(')'); return e; }
      if (t.t === 'op' && t.v === '{') fail(t.line, 'unexpected', { tok: '{' });
      if (t.t === 'eof') fail(t.line, 'eof', { want: 'expression' });
      fail(t.line, 'unexpected', { tok: this.tokText(t) });
    }
    // ---- declarations
    initializer() {
      if (this.isOp('{')) {
        const line = this.next().line, list = [];
        if (!this.isOp('}')) {
          do { if (this.isOp('}')) break; list.push(this.initializer()); } while (this.accept(','));
        }
        this.expect('}');
        return { k: 'list', list, line };
      }
      return this.parseAssign();
    }
    declarators(spec, isGlobal) {
      const vars = [];
      do {
        const line = this.p.line; let ty = spec.ty;
        while (this.isOp('*')) { this.next(); if (ty === T.char || ty === T.u8 || ty === T.i8) ty = T.str; else fail(line, 'unsupported', { what: 'pointer' }); }
        if (this.isOp('&')) fail(line, 'unsupported', { what: '&(reference)' });
        while (this.is('const')) this.next();
        const name = this.ident();
        const dims = [];
        while (this.accept('[')) { if (this.accept(']')) dims.push(null); else { dims.push(this.parseExpr()); this.expect(']'); } }
        while (this.is('PROGMEM')) this.next();
        let init = null, ctor = null;
        if (this.accept('=')) init = this.initializer();
        else if (this.isOp('(')) { this.next(); ctor = this.args(); }
        else if (this.isOp('{') && spec.ty.k === 'obj') { this.next(); ctor = []; this.expect('}'); }
        vars.push({ name, ty, dims, init, ctor, line, konst: spec.konst, stat: spec.stat });
      } while (this.accept(','));
      this.expect(';');
      return { k: 'decl', vars, line: spec.line, global: isGlobal };
    }
    params() {   // after '('
      const ps = [];
      if (this.accept(')')) return ps;
      if (this.is('void') && this.isOp(')', 1)) { this.next(); this.next(); return ps; }
      do {
        const line = this.p.line, s = this.typeSpec();
        if (!s) fail(line, 'expected', { want: 'type', got: this.tokText(this.p) });
        let ty = s.ty, arr = 0;
        while (this.isOp('*')) { this.next(); if (ty === T.char || ty === T.u8 || ty === T.i8) ty = T.str; else arr++; }
        if (this.isOp('&')) fail(line, 'unsupported', { what: '&(reference)' });
        const name = this.p.t === 'id' ? this.next().v : '__unnamed' + ps.length;
        while (this.accept('[')) { if (!this.isOp(']')) this.parseExpr(); this.expect(']'); arr++; }
        if (this.accept('=')) fail(line, 'unsupported', { what: 'default argument' });
        ps.push({ name, ty: arr ? { k: 'arr', of: ty, n: arr } : ty, line });
      } while (this.accept(','));
      this.expect(')');
      return ps;
    }
    enumDecl() {
      const line = this.next().line;   // 'enum'
      if (this.is('class')) this.next();
      let name = null; if (this.p.t === 'id') name = this.next().v;
      if (name) this.types.add(name);
      if (this.accept(':')) this.typeSpec();
      const items = [];
      if (this.accept('{')) {
        while (!this.isOp('}')) {
          const l = this.p.line, id = this.ident(); let val = null;
          if (this.accept('=')) val = this.parseCond();
          items.push({ name: id, val, line: l });
          if (!this.accept(',')) break;
        }
        this.expect('}');
      }
      let vars = null;
      if (!this.isOp(';')) vars = this.declarators({ ty: T.i16, konst: false, stat: false, line }, true);
      else this.expect(';');
      return { k: 'enum', items, line, vars };
    }
    program() {
      const items = [];
      while (this.p.t !== 'eof') {
        const t = this.p;
        if (t.t === 'op' && t.v === ';') { this.next(); continue; }
        if (t.t === 'id' && t.v === 'enum') { items.push(this.enumDecl()); continue; }
        if (t.t === 'id' && UNSUP_KW.has(t.v)) fail(t.line, 'unsupported', { what: t.v });
        const spec = this.typeSpec();
        if (!spec) fail(t.line, t.t === 'id' ? 'unknown_type' : 'unexpected', { tok: this.tokText(t), name: t.v });
        // function?
        if (spec.ty.k !== 'obj' && this.p.t === 'id' && this.isOp('(', 1)) {
          const line = this.p.line, name = this.next().v; this.next();
          const ps = this.params();
          if (this.accept(';')) { items.push({ k: 'proto', name, ret: spec.ty, params: ps, line }); continue; }
          if (!this.isOp('{')) fail(this.p.line, 'expected', { want: '{', got: this.tokText(this.p) });
          const body = this.block();
          items.push({ k: 'func', name, ret: spec.ty, params: ps, body, line, endLine: this.t[this.i - 1].line });
          continue;
        }
        items.push(this.declarators(spec, true));
      }
      return items;
    }
    // ---- statements
    block() {
      const line = this.expect('{').line, body = [];
      while (!this.isOp('}')) { if (this.p.t === 'eof') fail(this.p.line, 'eof', { want: '}' }); body.push(this.stmt()); }
      this.next();
      return { k: 'block', body, line };
    }
    stmt() {
      const t = this.p;
      if (t.t === 'op' && t.v === '{') return this.block();
      if (t.t === 'op' && t.v === ';') { this.next(); return { k: 'empty', line: t.line }; }
      if (t.t === 'id') {
        switch (t.v) {
          case 'if': {
            this.next(); this.expect('('); const c = this.parseExpr(); this.expect(')');
            const a = this.stmt(); let b = null;
            if (this.is('else')) { this.next(); b = this.stmt(); }
            return { k: 'if', c, a, b, line: t.line };
          }
          case 'while': { this.next(); this.expect('('); const c = this.parseExpr(); this.expect(')'); return { k: 'while', c, body: this.stmt(), line: t.line }; }
          case 'do': {
            this.next(); const body = this.stmt();
            if (!this.is('while')) fail(this.p.line, 'expected', { want: 'while', got: this.tokText(this.p) });
            this.next(); this.expect('('); const c = this.parseExpr(); this.expect(')'); this.expect(';');
            return { k: 'do', c, body, line: t.line };
          }
          case 'for': {
            this.next(); this.expect('(');
            let init = null;
            if (this.isTypeStart()) { const s = this.typeSpec(); init = this.declarators(s, false); }
            else if (!this.accept(';')) { init = { k: 'expr', e: this.parseExpr(), line: t.line }; this.expect(';'); }
            const c = this.isOp(';') ? null : this.parseExpr(); this.expect(';');
            const u = this.isOp(')') ? null : this.parseExpr(); this.expect(')');
            return { k: 'for', init, c, u, body: this.stmt(), line: t.line };
          }
          case 'switch': {
            this.next(); this.expect('('); const e = this.parseExpr(); this.expect(')');
            this.expect('{'); const items = [];
            while (!this.isOp('}')) {
              const u = this.p;
              if (u.t === 'eof') fail(u.line, 'eof', { want: '}' });
              if (u.t === 'id' && u.v === 'case') { this.next(); const v = this.parseCond(); this.expect(':'); items.push({ k: 'case', v, line: u.line }); continue; }
              if (u.t === 'id' && u.v === 'default') { this.next(); this.expect(':'); items.push({ k: 'default', line: u.line }); continue; }
              items.push(this.stmt());
            }
            this.next();
            return { k: 'switch', e, items, line: t.line };
          }
          case 'break': this.next(); this.expect(';'); return { k: 'break', line: t.line };
          case 'continue': this.next(); this.expect(';'); return { k: 'continue', line: t.line };
          case 'return': { this.next(); const e = this.isOp(';') ? null : this.parseExpr(); this.expect(';'); return { k: 'return', e, line: t.line }; }
          case 'case': case 'default': fail(t.line, 'unexpected', { tok: t.v });
          case 'else': fail(t.line, 'unexpected', { tok: 'else' });
          case 'enum': fail(t.line, 'unsupported', { what: 'local enum' });
        }
        if (UNSUP_KW.has(t.v)) fail(t.line, 'unsupported', { what: t.v });
        if (this.isTypeStart() && !(this.p.t === 'id' && (this.peek(1).v === '(' && BASEW.has(t.v) && !OBJW.has(t.v)))) {
          const s = this.typeSpec();
          if (s.ty.k !== 'obj' && this.p.t === 'id' && this.isOp('(', 1)) fail(t.line, 'unsupported', { what: 'local function' });
          return this.declarators(s, false);
        }
      }
      const e = this.parseExpr(); this.expect(';');
      return { k: 'expr', e, line: t.line };
    }
  }

  // ------------------------------------------------------------------ constant folding ----------------------------
  function constFold(e, lookup) {
    const f = (x) => constFold(x, lookup);
    switch (e.k) {
      case 'num': return e.v;
      case 'chr': return e.v;
      case 'id': { const v = lookup(e.name); return v === undefined ? null : v; }
      case 'un': { const a = f(e.a); if (a === null) return null; return e.op === '-' ? -a : e.op === '+' ? a : e.op === '!' ? (a ? 0 : 1) : ~a; }
      case 'cast': { const a = f(e.e); if (a === null) return null; return e.ty.k === 'float' ? a : e.ty.k === 'int' || e.ty.k === 'char' ? Math.trunc(a) : e.ty.k === 'bool' ? (a ? 1 : 0) : null; }
      case 'cond': { const c = f(e.c); if (c === null) return null; return c ? f(e.a) : f(e.b); }
      case 'sizeof': return e.ty ? sizeOf(e.ty) : null;
      case 'bin': {
        const a = f(e.a), b = f(e.b); if (a === null || b === null) return null;
        const intDiv = Number.isInteger(a) && Number.isInteger(b);
        switch (e.op) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b;
          case '/': return b === 0 ? null : intDiv ? Math.trunc(a / b) : a / b;
          case '%': return b === 0 ? null : a % b;
          case '<<': return a << b; case '>>': return a >> b; case '&': return a & b; case '|': return a | b; case '^': return a ^ b;
          case '<': return +(a < b); case '>': return +(a > b); case '<=': return +(a <= b); case '>=': return +(a >= b);
          case '==': return +(a === b); case '!=': return +(a !== b); case '&&': return +(!!a && !!b); case '||': return +(!!a || !!b);
        }
        return null;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ code generator (C → JS generators) ---------
  const MATH1 = { sqrt: 'Math.sqrt', sin: 'Math.sin', cos: 'Math.cos', tan: 'Math.tan', asin: 'Math.asin', acos: 'Math.acos', atan: 'Math.atan',
    exp: 'Math.exp', log: 'Math.log', log10: 'Math.log10', floor: 'Math.floor', ceil: 'Math.ceil', fabs: 'Math.abs', trunc: 'Math.trunc',
    sinh: 'Math.sinh', cosh: 'Math.cosh', tanh: 'Math.tanh', cbrt: 'Math.cbrt' };
  const CTYPE = { isDigit: 'd', isAlpha: 'a', isAlphaNumeric: 'n', isSpace: 's', isWhitespace: 'w', isUpperCase: 'U', isLowerCase: 'L', isPunct: 'p', isHexadecimalDigit: 'x', isPrintable: 'P', isControl: 'C', isAscii: 'A', isGraph: 'G' };
  const YIELDS = new Set(['pinMode', 'digitalWrite', 'analogWrite', 'delay', 'delayMicroseconds', 'tone', 'noTone', 'pulseIn', 'shiftOut', 'shiftIn', 'yield']);
  const API_NAMES = new Set(['pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite', 'analogReference', 'delay', 'delayMicroseconds', 'millis', 'micros',
    'tone', 'noTone', 'pulseIn', 'map', 'constrain', 'min', 'max', 'abs', 'sq', 'pow', 'atan2', 'fmod', 'round', 'random', 'randomSeed', 'bit', 'bitRead', 'bitSet',
    'bitClear', 'bitWrite', 'lowByte', 'highByte', 'F', 'strlen', 'strcmp', 'strcpy', 'strcat', 'sprintf', 'snprintf', 'yield', 'interrupts', 'noInterrupts', 'shiftOut', 'shiftIn',
    'attachInterrupt', 'detachInterrupt', 'digitalPinToInterrupt', 'isnan', 'isinf', 'radians', 'degrees', ...Object.keys(MATH1), ...Object.keys(CTYPE)]);
  const numLit = (v) => { if (Object.is(v, -0)) return '0'; const s = String(v); return s === 'Infinity' ? 'Infinity' : s; };

  class Emitter {
    constructor(consts) {
      this.consts = consts;       // name → {v, ty}
      this.funcs = new Map();     // name → {ret, params, js, defined}
      this.scopes = [new Map()];  // global scope first
      this.globals = []; this.ginit = []; this.out = [];
      this.loop = 0; this.sw = 0; this.ntmp = 0; this.fn = null; this.nstatic = 0;
    }
    // ---- scopes
    look(name) {
      for (let i = this.scopes.length - 1; i >= 0; i--) { const s = this.scopes[i].get(name); if (s) return s; }
      return null;
    }
    declare(v, sym) {
      const sc = this.scopes[this.scopes.length - 1];
      if (sc.has(v.name) || (this.scopes.length === 1 && this.funcs.has(v.name))) fail(v.line, 'redeclared', { name: v.name });
      if (this.consts[v.name] && this.scopes.length === 1) fail(v.line, 'redeclared', { name: v.name });
      sc.set(v.name, sym); return sym;
    }
    tmp() { const n = '__t' + (++this.ntmp); this.fn.tmps.push(n); return n; }
    cval(name) {   // compile-time integer value of an identifier (consts, enum values, const variables)
      const s = this.look(name); if (s) return s.cv === undefined ? undefined : s.cv;
      const c = this.consts[name]; return c ? c.v : undefined;
    }
    fold(e) { return constFold(e, (n) => this.cval(n)); }
    // ---- conversions
    conv(v, dst, line) {
      const s = v.ty;
      if (dst.k === 'str') return this.toStr(v, line);
      if (dst.k === 'arr') {
        if (s.k !== 'arr' || s.n !== dst.n) fail(line, 'type_mismatch', { from: tyName(s), to: tyName(dst) });
        return v.c;
      }
      if (dst.k === 'obj') { if (s.k !== 'obj' || s.cls !== dst.cls) fail(line, 'type_mismatch', { from: tyName(s), to: tyName(dst) }); return v.c; }
      if (dst.k === 'void') return v.c;
      if (!isNum(s)) fail(line, 'type_mismatch', { from: tyName(s), to: tyName(dst) });
      if (dst.k === 'float') return s.k === 'bool' ? `(+${v.c})` : v.c;
      if (dst.k === 'bool') return s.k === 'bool' ? v.c : `(${v.c} ? 1 : 0)`;
      const lit = v.lit;
      if (dst.k === 'char' || (dst.b === 8 && !dst.u)) {
        if (lit !== undefined && Number.isInteger(lit) && lit >= -128 && lit <= 127) return v.c;
        if (v.simple && (s.k === 'char' || (s.k === 'int' && s.b === 8 && !s.u))) return v.c;
        return `(${v.c} << 24 >> 24)`;
      }
      const inRange = (lo, hi) => lit !== undefined && Number.isInteger(lit) && lit >= lo && lit <= hi;
      const same = v.simple && s.k === 'int' && s.b === dst.b && s.u === dst.u;
      switch (dst.b) {
        case 8: return inRange(0, 255) || same ? v.c : `(${v.c} & 255)`;
        case 16: if (inRange(dst.u ? 0 : -32768, dst.u ? 65535 : 32767) || same) return v.c; return dst.u ? `(${v.c} & 65535)` : `(${v.c} << 16 >> 16)`;
        case 32: if (inRange(dst.u ? 0 : -2147483648, dst.u ? 4294967295 : 2147483647) || same) return v.c; return dst.u ? `(${v.c} >>> 0)` : `(${v.c} | 0)`;
        default: return s.k === 'float' ? `Math.trunc(${v.c})` : s.k === 'bool' ? `(+${v.c})` : v.c;
      }
    }
    toStr(v, line) {
      const s = v.ty;
      switch (s.k) {
        case 'str': return v.c;
        case 'char': return `String.fromCharCode(${v.c} & 255)`;
        case 'float': return `__R.ff(${v.c}, 2)`;
        case 'bool': return `(${v.c} ? '1' : '0')`;
        case 'int': return `String(${v.c})`;
        case 'arr': if (isCharArr(s)) return `__R.cs(${v.c})`;
      }
      fail(line, 'type_mismatch', { from: tyName(s), to: 'String' });
    }
    // printable text of v (Serial.print / lcd.print) with optional base / digits argument
    fmt(v, f, line) {
      const s = v.ty;
      if (s.k === 'float') return `__R.ff(${v.c}, ${f ? f.c : 2})`;
      if (f) { if (!isInt(s)) fail(line, 'type_mismatch', { from: tyName(s), to: 'int' }); return `__R.fi(${v.c}, ${f.c})`; }
      return this.toStr(v, line);
    }
    // ---- expressions
    ex(e) {
      switch (e.k) {
        case 'num': return { c: numLit(e.v), ty: e.ty, lit: e.v };
        case 'chr': return { c: String(e.v), ty: T.char, lit: e.v };
        case 'str': return { c: JSON.stringify(e.v), ty: T.str };
        case 'id': return this.exId(e);
        case 'addr': { const v = this.exId({ k: 'id', name: e.name, line: e.line }); if (!(v.ty.k === 'obj' && v.ty.cls === 'OneWire')) fail(e.line, 'unsupported', { what: '&(address-of)' }); return { c: v.c, ty: T.owp }; }
        case 'comma': { const ps = e.list.map((x) => this.ex(x)); return { c: '(' + ps.map((p) => p.c).join(', ') + ')', ty: ps[ps.length - 1].ty }; }
        case 'cond': {
          const c = this.ex(e.c), a = this.ex(e.a), b = this.ex(e.b);
          let ty;
          if (a.ty.k === 'str' || b.ty.k === 'str') ty = T.str;
          else if (!isNum(a.ty) || !isNum(b.ty)) { if (tyName(a.ty) !== tyName(b.ty)) fail(e.line, 'type_mismatch', { from: tyName(b.ty), to: tyName(a.ty) }); ty = a.ty; }
          else if (a.ty.k === 'float' || b.ty.k === 'float') ty = T.f;
          else if (a.ty.k === 'bool' && b.ty.k === 'bool') ty = T.bool;
          else if (a.ty.k === 'char' && b.ty.k === 'char') ty = T.char;
          else ty = promote(a.ty, b.ty);
          return { c: `(${this.cond(c)} ? ${this.conv(a, ty, e.line)} : ${this.conv(b, ty, e.line)})`, ty };
        }
        case 'un': return this.exUn(e);
        case 'bin': return this.exBin(e.op, this.ex(e.a), this.ex(e.b), e.line);
        case 'asg': return this.exAsg(e);
        case 'pre': case 'post': return this.exInc(e);
        case 'idx': return this.exIdx(e);
        case 'call': return this.exCall(e);
        case 'mem': {
          if (e.o.k === 'id' && e.o.name === 'Serial') fail(e.line, 'unknown_member', { name: e.name, obj: 'Serial' });
          fail(e.line, 'unknown_member', { name: e.name, obj: tyName(this.ex(e.o).ty) });
        }
        case 'cast': return this.exCast(e);
        case 'sizeof': {
          if (e.ty) return { c: String(sizeOf(e.ty)), ty: T.u16, lit: sizeOf(e.ty) };
          if (e.e.k === 'str') return { c: String(e.e.v.length + 1), ty: T.u16, lit: e.e.v.length + 1 };
          const v = this.ex(e.e);
          if (v.ty.k === 'arr') return { c: `__R.sz(${v.c}, ${sizeOf(v.ty.of)})`, ty: T.u16 };
          return { c: String(sizeOf(v.ty)), ty: T.u16, lit: sizeOf(v.ty) };
        }
        case 'list': fail(e.line, 'unexpected', { tok: '{' });
      }
      fail(e.line, 'unexpected', { tok: e.k });
    }
    cond(v) { return v.c; }
    exId(e) {
      const s = this.look(e.name);
      if (s) {
        if (s.kind === 'var') return { c: s.js, ty: s.ty, simple: true, lit: s.cv };
      }
      if (this.funcs.has(e.name) || API_NAMES.has(e.name)) fail(e.line, 'unsupported', { what: 'function pointer' });
      const c = this.consts[e.name];
      if (c) return { c: numLit(c.v), ty: c.ty, lit: c.v };
      if (e.name === 'Serial') return { c: '1', ty: T.bool };
      fail(e.line, 'undeclared', { name: e.name });
    }
    exUn(e) {
      const a = this.ex(e.a);
      if (e.op === '!') { if (a.ty.k === 'str' || a.ty.k === 'obj') fail(e.line, 'type_mismatch', { from: tyName(a.ty), to: 'bool' }); return { c: `(!${a.c})`, ty: T.bool }; }
      if (!isNum(a.ty)) fail(e.line, 'type_mismatch', { from: tyName(a.ty), to: 'number' });
      if (a.ty.k === 'float') { if (e.op === '~') fail(e.line, 'type_mismatch', { from: 'float', to: 'int' }); return { c: `(${e.op}${a.c})`, ty: T.f, lit: a.lit !== undefined ? (e.op === '-' ? -a.lit : a.lit) : undefined }; }
      const ty = promote(a.ty);
      if (e.op === '+') return { c: a.c, ty, lit: a.lit };
      if (e.op === '-') {
        if (a.lit !== undefined) { const v = -a.lit; return { c: `(${numLit(v)})`, ty: v < -2147483648 ? T.i64 : v < -32768 && ty.b === 16 ? T.i32 : ty, lit: v }; }
        return { c: ty.u && ty.b === 32 ? `(-${a.c} >>> 0)` : ty.u && ty.b === 16 ? `(-${a.c} & 65535)` : `(- ${a.c})`, ty };
      }
      return { c: ty.u && ty.b === 32 ? `(~${a.c} >>> 0)` : ty.u && ty.b === 16 ? `(~${a.c} & 65535)` : `(~${a.c})`, ty };   // '~'
    }
    exBin(op, a, b, line) {
      const strLike = (t) => t.k === 'str' || isCharArr(t);
      if (op === '&&' || op === '||') return { c: `(!!${a.c} ${op} !!${b.c})`, ty: T.bool };
      if (op === '+' && (a.ty.k === 'str' || b.ty.k === 'str')) return { c: `(${this.toStr(a, line)} + ${this.toStr(b, line)})`, ty: T.str };
      const cmp = op === '==' || op === '!=' || op === '<' || op === '>' || op === '<=' || op === '>=';
      if (cmp && (a.ty.k === 'str' || b.ty.k === 'str') && strLike(a.ty) && strLike(b.ty)) {
        const o = op === '==' ? '===' : op === '!=' ? '!==' : op;
        return { c: `(${this.toStr(a, line)} ${o} ${this.toStr(b, line)})`, ty: T.bool };
      }
      if (!isNum(a.ty) || !isNum(b.ty)) fail(line, 'type_mismatch', { from: tyName(isNum(a.ty) ? b.ty : a.ty), to: 'number' });
      const fl = a.ty.k === 'float' || b.ty.k === 'float';
      let ty = fl ? T.f : promote(a.ty, b.ty);
      if (op === '<<' || op === '>>') ty = promote(a.ty);
      const L = a.lit !== undefined && b.lit !== undefined ? constFold({ k: 'bin', op, a: { k: 'num', v: fl ? a.lit : a.lit }, b: { k: 'num', v: b.lit } }, () => null) : undefined;
      const u32 = !fl && ty.b === 32 && ty.u;
      let c;
      switch (op) {
        case '+': case '-': c = `(${a.c} ${op} ${b.c})`; if (u32) c = `(${c} >>> 0)`; break;
        case '*':
          if (!fl && ty.b === 32) c = u32 ? `(Math.imul(${a.c}, ${b.c}) >>> 0)` : `Math.imul(${a.c}, ${b.c})`;
          else c = `(${a.c} * ${b.c})`;
          break;
        case '/': c = fl ? `(${a.c} / ${b.c})` : `__R.div(${a.c}, ${b.c})`; break;
        case '%': c = fl ? `(${a.c} % ${b.c})` : `__R.mod(${a.c}, ${b.c})`; break;
        case '<<': case '>>': case '&': case '|': case '^':
          if (fl) fail(line, 'type_mismatch', { from: 'float', to: 'int' });
          if (ty.b === 64) { c = op === '<<' ? `(${a.c} * Math.pow(2, ${b.c}))` : op === '>>' ? `Math.floor(${a.c} / Math.pow(2, ${b.c}))` : `(${a.c} ${op} ${b.c})`; break; }
          c = op === '>>' && u32 ? `(${a.c} >>> ${b.c})` : `(${a.c} ${op} ${b.c})`;
          if (u32 && op !== '>>') c = `(${c} >>> 0)`;
          break;
        default:
          if (!cmp) fail(line, 'unexpected', { tok: op });
          return { c: `(${a.c} ${op} ${b.c})`, ty: T.bool, lit: L === null ? undefined : L };
      }
      return { c, ty, lit: L === null ? undefined : L };
    }
    // lvalue helper → {get, set(code), ty, pre (setup code with temps)}
    lval(e) {
      if (e.k === 'id') {
        const s = this.look(e.name);
        if (!s || s.kind !== 'var') { if (this.consts[e.name] || !s) { if (!this.consts[e.name] && !this.funcs.has(e.name)) fail(e.line, 'undeclared', { name: e.name }); } fail(e.line, 'not_lvalue'); }
        if (s.konst) fail(e.line, 'const_assign', { name: e.name });
        if (s.ty.k === 'arr' || s.ty.k === 'obj') fail(e.line, 'not_lvalue');
        return { pre: '', get: s.js, set: (c) => `${s.js} = ${c}`, ty: s.ty };
      }
      if (e.k === 'idx') {
        const b = this.ex(e.a), i = this.ex(e.i);
        if (b.ty.k !== 'arr') fail(e.line, b.ty.k === 'str' ? 'unsupported' : 'not_array', { what: 'String[index] =' });
        if (b.ty.konst) fail(e.line, 'const_assign', { name: '[]' });
        if (b.ty.n > 1) fail(e.line, 'not_lvalue');
        const t1 = this.tmp(), t2 = this.tmp();
        return { pre: `${t1} = ${b.c}, ${t2} = __R.ix(${t1}, ${i.c}), `, get: `${t1}[${t2}]`, set: (c) => `${t1}[${t2}] = ${c}`, ty: b.ty.of };
      }
      fail(e.line, 'not_lvalue');
    }
    exAsg(e) {
      const L = this.lval(e.a);
      let r = this.ex(e.b);
      if (e.op !== '=') r = this.exBin(e.op.slice(0, -1), { c: L.get, ty: L.ty, simple: true }, r, e.line);
      return { c: `(${L.pre}${L.set(this.conv(r, L.ty, e.line))})`, ty: L.ty };
    }
    exInc(e) {
      const L = this.lval(e.a), d = e.op === '++' ? '+' : '-';
      if (!isNum(L.ty)) fail(e.line, 'type_mismatch', { from: tyName(L.ty), to: 'number' });
      const nv = this.conv({ c: `${L.get} ${d} 1`, ty: L.ty.k === 'float' ? T.f : promote(L.ty) }, L.ty, e.line);
      if (e.k === 'pre') return { c: `(${L.pre}${L.set(nv)})`, ty: L.ty };
      const t = this.tmp();
      return { c: `(${L.pre}${t} = ${L.get}, ${L.set(nv)}, ${t})`, ty: L.ty };
    }
    exIdx(e) {
      const b = this.ex(e.a), i = this.ex(e.i);
      if (!isNum(i.ty)) fail(e.line, 'type_mismatch', { from: tyName(i.ty), to: 'int' });
      if (b.ty.k === 'str') return { c: `__R.chat(${b.c}, ${i.c})`, ty: T.char };
      if (b.ty.k !== 'arr') fail(e.line, 'not_array', { name: e.a.name || '' });
      const ty = b.ty.n > 1 ? { k: 'arr', of: b.ty.of, n: b.ty.n - 1, konst: b.ty.konst } : b.ty.of;
      if (/^\$\w+$/.test(b.c)) return { c: `${b.c}[__R.ix(${b.c}, ${i.c})]`, ty };
      const t = this.tmp();
      return { c: `(${t} = ${b.c}, ${t}[__R.ix(${t}, ${i.c})])`, ty };
    }
    exCast(e) {
      if (e.fn && e.ty.k === 'str' && e.args.length === 2) return { c: this.fmt(this.ex(e.args[0]), this.ex(e.args[1]), e.line), ty: T.str };
      if (e.args && e.args.length > (e.ty.k === 'str' ? 2 : 1)) fail(e.line, 'args', { name: tyName(e.ty), n: 1 });
      const v = this.ex(e.e);
      if (e.ty.k === 'str') return { c: this.toStr(v, e.line), ty: T.str };
      if (e.ty.k === 'float') { if (!isNum(v.ty)) fail(e.line, 'type_mismatch', { from: tyName(v.ty), to: 'float' }); return { c: v.ty.k === 'bool' ? `(+${v.c})` : v.c, ty: T.f, lit: v.lit }; }
      if (e.ty.k === 'void') return { c: v.c, ty: T.void };
      if (isNum(e.ty) && v.ty.k === 'float') return { c: this.conv({ c: `Math.trunc(${v.c})`, ty: T.i64 }, e.ty, e.line), ty: e.ty, lit: v.lit !== undefined ? Math.trunc(v.lit) : undefined };
      return { c: this.conv(v, e.ty, e.line), ty: e.ty, lit: v.lit };
    }
    args(e, lo, hi) {
      const n = e.args.length;
      if (n < lo || n > hi) fail(e.line, 'args', { name: e.fname, n: lo === hi ? lo : lo + '-' + hi });
      return e.args.map((a) => this.ex(a));
    }
    numArgs(e, vs) { for (const v of vs) if (!isNum(v.ty)) fail(e.line, 'type_mismatch', { from: tyName(v.ty), to: 'number' }); return vs.map((v) => v.c); }
    exCall(e) {
      if (e.f.k === 'mem') return this.exMethod(e);
      if (e.f.k !== 'id') fail(e.line, 'not_func', { name: '?' });
      const name = e.f.name; e.fname = name;
      const s = this.look(name);
      if (s && s.kind === 'var') fail(e.line, 'not_func', { name });
      const uf = this.funcs.get(name);
      if (uf) {
        if (e.args.length !== uf.params.length) fail(e.line, 'args', { name, n: uf.params.length });
        const as = e.args.map((a, i) => this.conv(this.ex(a), uf.params[i].ty, a.line || e.line));
        return { c: `(yield* ${uf.js}(${as.join(', ')}))`, ty: uf.ret };
      }
      return this.exBuiltin(e, name);
    }
    exBuiltin(e, name) {
      const A = (lo, hi) => this.args(e, lo, hi === undefined ? lo : hi);
      const N = (lo, hi) => this.numArgs(e, A(lo, hi));
      const Y = (c, ty) => ({ c: `(yield* ${c})`, ty: ty || T.void });
      const mty = (vs) => (vs.some((v) => v.ty.k === 'float') ? T.f : promote(...vs.map((v) => v.ty).slice(0, 2)));
      switch (name) {
        case 'pinMode': return Y(`__R.pm(${N(2).join(', ')})`);
        case 'digitalWrite': return Y(`__R.dw(${N(2).join(', ')})`);
        case 'digitalRead': return { c: `__R.dr(${N(1)})`, ty: T.i16 };
        case 'analogRead': return { c: `__R.ar(${N(1)})`, ty: T.i16 };
        case 'analogWrite': return Y(`__R.aw(${N(2).join(', ')})`);
        case 'analogReference': return { c: `__R.aref(${N(1)})`, ty: T.void };
        case 'delay': return Y(`__R.dly(${N(1)})`);
        case 'delayMicroseconds': return Y(`__R.dlyu(${N(1)})`);
        case 'yield': A(0); return Y('__R.yld()');
        case 'millis': A(0); return { c: '__R.ms()', ty: T.u32 };
        case 'micros': A(0); return { c: '__R.us()', ty: T.u32 };
        case 'tone': return Y(`__R.tone(${N(2, 3).join(', ')})`);
        case 'noTone': return Y(`__R.notone(${N(1)})`);
        case 'pulseIn': return Y(`__R.pulseIn(${N(2, 3).join(', ')})`, T.u32);
        case 'shiftOut': return Y(`__R.shiftOut(${N(4).join(', ')})`);
        case 'shiftIn': return Y(`__R.shiftIn(${N(3).join(', ')})`, T.u8);
        case 'map': return { c: `__R.map(${N(5).join(', ')})`, ty: T.i32 };
        case 'constrain': { const vs = A(3); this.numArgs(e, vs); return { c: `__R.cons(${vs.map((v) => v.c).join(', ')})`, ty: mty(vs) }; }
        case 'min': case 'max': { const vs = A(2); this.numArgs(e, vs); return { c: `Math.${name}(${vs[0].c}, ${vs[1].c})`, ty: mty(vs) }; }
        case 'abs': { const vs = A(1); this.numArgs(e, vs); return { c: `Math.abs(${vs[0].c})`, ty: vs[0].ty.k === 'float' ? T.f : promote(vs[0].ty) }; }
        case 'sq': { const vs = A(1); this.numArgs(e, vs); return { c: `__R.sq(${vs[0].c})`, ty: vs[0].ty.k === 'float' ? T.f : promote(vs[0].ty, T.i32) }; }
        case 'pow': return { c: `Math.pow(${N(2).join(', ')})`, ty: T.f };
        case 'atan2': return { c: `Math.atan2(${N(2).join(', ')})`, ty: T.f };
        case 'fmod': { const a = N(2); return { c: `(${a[0]} % ${a[1]})`, ty: T.f }; }
        case 'round': return { c: `__R.round(${N(1)})`, ty: T.i32 };
        case 'radians': return { c: `(${N(1)} * 0.017453292519943295)`, ty: T.f };
        case 'degrees': return { c: `(${N(1)} * 57.29577951308232)`, ty: T.f };
        case 'isnan': return { c: `Number.isNaN(${N(1)})`, ty: T.bool };
        case 'isinf': return { c: `__R.isinf(${N(1)})`, ty: T.bool };
        case 'random': return { c: `__R.rnd(${N(1, 2).join(', ')})`, ty: T.i32 };
        case 'randomSeed': return { c: `__R.seed(${N(1)})`, ty: T.void };
        case 'bit': return { c: `((1 << ${N(1)}) >>> 0)`, ty: T.u32 };
        case 'bitRead': { const a = N(2); return { c: `((${a[0]} >>> ${a[1]}) & 1)`, ty: T.i16 }; }
        case 'bitSet': case 'bitClear': case 'bitWrite': {
          const n = name === 'bitWrite' ? 3 : 2; if (e.args.length !== n) fail(e.line, 'args', { name, n });
          const one = { k: 'bin', op: '<<', a: { k: 'num', v: 1, ty: T.u32 }, b: e.args[1], line: e.line };
          const set = { k: 'asg', op: '|=', a: e.args[0], b: one, line: e.line };
          const clr = { k: 'asg', op: '&=', a: e.args[0], b: { k: 'un', op: '~', a: one, line: e.line }, line: e.line };
          return this.ex(name === 'bitSet' ? set : name === 'bitClear' ? clr : { k: 'cond', c: e.args[2], a: set, b: clr, line: e.line });
        }
        case 'lowByte': return { c: `(${N(1)} & 255)`, ty: T.u8 };
        case 'highByte': return { c: `((${N(1)} >> 8) & 255)`, ty: T.u8 };
        case 'F': { const v = A(1)[0]; return { c: this.toStr(v, e.line), ty: T.str }; }
        case 'strlen': { const v = A(1)[0]; return { c: `${this.toStr(v, e.line)}.length`, ty: T.u16 }; }
        case 'strcmp': { const vs = A(2); return { c: `__R.strcmp(${this.toStr(vs[0], e.line)}, ${this.toStr(vs[1], e.line)})`, ty: T.i16 }; }
        case 'strcpy': case 'strcat': {
          const vs = A(2);
          if (!isCharArr(vs[0].ty)) fail(e.line, 'type_mismatch', { from: tyName(vs[0].ty), to: 'char[]' });
          const src = this.toStr(vs[1], e.line);
          return { c: name === 'strcpy' ? `__R.sprintf(${vs[0].c}, -1, '%s', [${src}])` : `__R.sprintf(${vs[0].c}, -1, '%s%s', [__R.cs(${vs[0].c}), ${src}])`, ty: T.void };
        }
        case 'sprintf': case 'snprintf': {
          const vs = A(name === 'sprintf' ? 2 : 3, 20);
          if (!isCharArr(vs[0].ty)) fail(e.line, 'type_mismatch', { from: tyName(vs[0].ty), to: 'char[]' });
          const fi = name === 'sprintf' ? 1 : 2;
          const rest = vs.slice(fi + 1).map((v) => (v.ty.k === 'str' || isCharArr(v.ty) ? this.toStr(v, e.line) : v.ty.k === 'char' ? `String.fromCharCode(${v.c} & 255)` : v.c));
          return { c: `__R.sprintf(${vs[0].c}, ${name === 'snprintf' ? vs[1].c : -1}, ${this.toStr(vs[fi], e.line)}, [${rest.join(', ')}])`, ty: T.i16 };
        }
        case 'interrupts': case 'noInterrupts': A(0); return { c: '0', ty: T.void };
        case 'attachInterrupt': case 'detachInterrupt': case 'digitalPinToInterrupt': fail(e.line, 'unsupported', { what: name + '()' });
      }
      if (MATH1[name]) return { c: `${MATH1[name]}(${N(1)})`, ty: T.f };
      if (CTYPE[name]) return { c: `__R.ctype('${CTYPE[name]}', ${N(1)})`, ty: T.bool };
      if (this.consts[name]) fail(e.line, 'not_func', { name });
      fail(e.line, 'undeclared', { name });
    }
    exMethod(e) {
      const o = e.f.o, m = e.f.name; e.fname = m;
      const A = (lo, hi) => this.args(e, lo, hi === undefined ? lo : hi);
      if (o.k === 'id' && o.name === 'Wire' && !this.look('Wire')) {
        const N = (lo, hi) => this.numArgs(e, A(lo, hi));
        switch (m) {
          case 'begin': N(0, 1); return { c: '__R.wireI().begin()', ty: T.void };
          case 'end': A(0); return { c: '0', ty: T.void };
          case 'setClock': N(1); return { c: '0', ty: T.void };
          case 'beginTransmission': return { c: `__R.wireI().beginTransmission(${N(1)})`, ty: T.void };
          case 'write': { const vs = A(1, 2); return { c: `__R.wireI().write(${vs[0].c})`, ty: T.u8 }; }
          case 'endTransmission': N(0, 1); return { c: '__R.wireI().endTransmission()', ty: T.u8 };
          case 'requestFrom': case 'read': case 'available': case 'peek': case 'onReceive': case 'onRequest':
            fail(e.line, 'unsupported', { what: 'Wire.' + m + '()' });
        }
        fail(e.line, 'unknown_member', { name: m, obj: 'Wire' });
      }
      if (o.k === 'id' && o.name === 'Serial' && !this.look('Serial')) {
        switch (m) {
          case 'begin': A(1, 2); return { c: '__R.sb()', ty: T.void };
          case 'end': case 'flush': A(0); return { c: '0', ty: T.void };
          case 'print': case 'println': {
            const vs = A(m === 'println' ? 0 : 1, 2);
            const txt = vs.length ? this.fmt(vs[0], vs[1], e.line) : "''";
            return { c: `__R.sp(${txt}${m === 'println' ? " + '\\r\\n'" : ''})`, ty: T.u16 };
          }
          case 'write': {
            const vs = A(1, 2);
            if (vs.length === 2) return { c: `__R.sp(${this.toStr(vs[0], e.line)}.slice(0, ${vs[1].c}))`, ty: T.u16 };
            const v = vs[0];
            return { c: `__R.sp(${v.ty.k === 'str' || isCharArr(v.ty) ? this.toStr(v, e.line) : `String.fromCharCode(${v.c} & 255)`})`, ty: T.u16 };
          }
          case 'available': A(0); return { c: '__R.sin.length', ty: T.i16 };
          case 'availableForWrite': A(0); return { c: '63', ty: T.i16 };
          case 'read': A(0); return { c: '__R.srd()', ty: T.i16 };
          case 'peek': A(0); return { c: '__R.spk()', ty: T.i16 };
          case 'parseInt': A(0); return { c: '__R.sparse(0)', ty: T.i32 };
          case 'parseFloat': A(0); return { c: '__R.sparse(1)', ty: T.f };
          case 'readString': A(0); return { c: '__R.sreads(-1)', ty: T.str };
          case 'readStringUntil': { const v = A(1)[0]; return { c: `__R.sreads(${v.c})`, ty: T.str }; }
          case 'setTimeout': A(1); return { c: '0', ty: T.void };
        }
        fail(e.line, 'unknown_member', { name: m, obj: 'Serial' });
      }
      const ov = this.ex(o);
      if (ov.ty.k === 'str' || isCharArr(ov.ty)) return this.exStrMethod(e, o, ov, m, A);
      if (ov.ty.k === 'obj' && ov.ty.cls === 'Servo') {
        switch (m) {
          case 'attach': return { c: `${ov.c}.attach(${this.numArgs(e, A(1, 3)).join(', ')})`, ty: T.u8 };
          case 'detach': A(0); return { c: `${ov.c}.detach()`, ty: T.void };
          case 'write': return { c: `${ov.c}.write(${this.numArgs(e, A(1))})`, ty: T.void };
          case 'writeMicroseconds': return { c: `${ov.c}.writeUs(${this.numArgs(e, A(1))})`, ty: T.void };
          case 'read': A(0); return { c: `${ov.c}.read()`, ty: T.i16 };
          case 'readMicroseconds': A(0); return { c: `${ov.c}.readUs()`, ty: T.i16 };
          case 'attached': A(0); return { c: `${ov.c}.attached()`, ty: T.bool };
        }
        fail(e.line, 'unknown_member', { name: m, obj: 'Servo' });
      }
      if (ov.ty.k === 'obj' && ov.ty.cls === 'LiquidCrystal') {
        switch (m) {
          case 'print': { const vs = A(1, 2); return { c: `${ov.c}.print(${this.fmt(vs[0], vs[1], e.line)})`, ty: T.u16 }; }
          case 'write': { const v = A(1)[0]; return { c: `${ov.c}.print(${v.ty.k === 'str' || isCharArr(v.ty) ? this.toStr(v, e.line) : `String.fromCharCode(${v.c} & 255)`})`, ty: T.u16 }; }
          case 'begin': return { c: `${ov.c}.begin(${this.numArgs(e, A(2, 3)).join(', ')})`, ty: T.void };
          case 'setCursor': return { c: `${ov.c}.setCursor(${this.numArgs(e, A(2)).join(', ')})`, ty: T.void };
          case 'createChar': A(2); return { c: '0', ty: T.void };
          case 'clear': case 'home': case 'display': case 'noDisplay': case 'cursor': case 'noCursor': case 'blink': case 'noBlink':
          case 'scrollDisplayLeft': case 'scrollDisplayRight': case 'autoscroll': case 'noAutoscroll': case 'leftToRight': case 'rightToLeft':
            A(0); return { c: `${ov.c}.cmd('${m}')`, ty: T.void };
        }
        fail(e.line, 'unknown_member', { name: m, obj: 'LiquidCrystal' });
      }
      if (ov.ty.k === 'obj' && ov.ty.cls === 'LiquidCrystal_I2C') {
        switch (m) {
          case 'init': A(0); return { c: `${ov.c}.init()`, ty: T.void };
          case 'begin': this.numArgs(e, A(0, 3)); return { c: `${ov.c}.begin()`, ty: T.void };
          case 'print': { const vs = A(1, 2); return { c: `${ov.c}.print(${this.fmt(vs[0], vs[1], e.line)})`, ty: T.u16 }; }
          case 'write': { const v = A(1)[0]; return { c: `${ov.c}.print(${v.ty.k === 'str' || isCharArr(v.ty) ? this.toStr(v, e.line) : `String.fromCharCode(${v.c} & 255)`})`, ty: T.u16 }; }
          case 'setCursor': return { c: `${ov.c}.setCursor(${this.numArgs(e, A(2)).join(', ')})`, ty: T.void };
          case 'setBacklight': return { c: `${ov.c}.setBl(!!(${this.numArgs(e, A(1))}))`, ty: T.void };
          case 'createChar': A(2); return { c: '0', ty: T.void };
          case 'clear': case 'home': case 'display': case 'noDisplay': case 'cursor': case 'noCursor': case 'blink': case 'noBlink': case 'backlight': case 'noBacklight':
          case 'scrollDisplayLeft': case 'scrollDisplayRight': case 'autoscroll': case 'noAutoscroll': case 'leftToRight': case 'rightToLeft':
            A(0); return { c: `${ov.c}.cmd('${m}')`, ty: T.void };
        }
        fail(e.line, 'unknown_member', { name: m, obj: 'LiquidCrystal_I2C' });
      }
      if (ov.ty.k === 'obj' && ov.ty.cls === 'DHT') {
        const N = (lo, hi) => this.numArgs(e, A(lo, hi));
        switch (m) {
          case 'begin': N(0, 1); return { c: `${ov.c}.begin()`, ty: T.void };
          case 'read': return { c: `${ov.c}.read(${N(0, 1).join(', ')})`, ty: T.bool };
          case 'readTemperature': return { c: `${ov.c}.readTemperature(${N(0, 2).join(', ')})`, ty: T.f };
          case 'readHumidity': return { c: `${ov.c}.readHumidity(${N(0, 1).join(', ')})`, ty: T.f };
          case 'computeHeatIndex': return { c: `${ov.c}.computeHeatIndex(${N(2, 3).join(', ')})`, ty: T.f };
          case 'convertCtoF': return { c: `${ov.c}.convertCtoF(${N(1)})`, ty: T.f };
          case 'convertFtoC': return { c: `${ov.c}.convertFtoC(${N(1)})`, ty: T.f };
        }
        fail(e.line, 'unknown_member', { name: m, obj: 'DHT' });
      }
      if (ov.ty.k === 'obj' && ov.ty.cls === 'DallasTemperature') {
        const N = (lo, hi) => this.numArgs(e, A(lo, hi));
        switch (m) {
          case 'begin': A(0); return { c: `${ov.c}.begin()`, ty: T.void };
          case 'getDeviceCount': A(0); return { c: `${ov.c}.getDeviceCount()`, ty: T.u8 };
          case 'setResolution': return { c: `${ov.c}.setResolution(${N(1)})`, ty: T.void };
          case 'getResolution': A(0); return { c: `${ov.c}.getResolution()`, ty: T.u8 };
          case 'setWaitForConversion': return { c: `${ov.c}.setWaitForConversion(${N(1)})`, ty: T.void };
          case 'getWaitForConversion': A(0); return { c: `${ov.c}.getWaitForConversion()`, ty: T.bool };
          case 'requestTemperatures': A(0); return { c: `${ov.c}.requestTemperatures()`, ty: T.void };
          case 'requestTemperaturesByIndex': return { c: `${ov.c}.requestTemperatures(${N(1)})`, ty: T.bool };
          case 'isConversionComplete': A(0); return { c: `${ov.c}.isConversionComplete()`, ty: T.bool };
          case 'millisToWaitForConversion': return { c: `${ov.c}.millisToWait(${N(1)})`, ty: T.i16 };
          case 'getTempCByIndex': return { c: `${ov.c}.getTempCByIndex(${N(1)})`, ty: T.f };
          case 'getTempFByIndex': return { c: `${ov.c}.getTempFByIndex(${N(1)})`, ty: T.f };
        }
        fail(e.line, 'unknown_member', { name: m, obj: 'DallasTemperature' });
      }
      fail(e.line, 'unknown_member', { name: m, obj: tyName(ov.ty) });
    }
    exStrMethod(e, o, ov, m, A) {
      const s = this.toStr(ov, e.line);
      const S = (v) => this.toStr(v, e.line);
      const mut = (fn) => {   // String methods that modify the object in place
        if (ov.ty.k !== 'str') fail(e.line, 'unsupported', { what: 'char[].' + m + '()' });
        const L = this.lval(o);
        return { c: `(${L.pre}${L.set(fn(L.get))}, 0)`, ty: T.void };
      };
      switch (m) {
        case 'length': A(0); return { c: `${s}.length`, ty: T.u16 };
        case 'charAt': return { c: `__R.chat(${s}, ${this.numArgs(e, A(1))})`, ty: T.char };
        case 'substring': { const a = this.numArgs(e, A(1, 2)); return { c: `__R.substr(${s}, ${a.join(', ')})`, ty: T.str }; }
        case 'indexOf': case 'lastIndexOf': {
          const vs = A(1, 2); const x = vs[0].ty.k === 'char' ? `String.fromCharCode(${vs[0].c})` : S(vs[0]);
          return { c: `${s}.${m}(${x}${vs[1] ? ', ' + vs[1].c : ''})`, ty: T.i16 };
        }
        case 'toInt': A(0); return { c: `__R.toInt(${s})`, ty: T.i32 };
        case 'toFloat': case 'toDouble': A(0); return { c: `__R.toFloat(${s})`, ty: T.f };
        case 'equals': return { c: `(${s} === ${S(A(1)[0])})`, ty: T.bool };
        case 'equalsIgnoreCase': return { c: `(${s}.toLowerCase() === ${S(A(1)[0])}.toLowerCase())`, ty: T.bool };
        case 'startsWith': return { c: `${s}.startsWith(${S(A(1)[0])})`, ty: T.bool };
        case 'endsWith': return { c: `${s}.endsWith(${S(A(1)[0])})`, ty: T.bool };
        case 'compareTo': return { c: `__R.strcmp(${s}, ${S(A(1)[0])})`, ty: T.i16 };
        case 'isEmpty': A(0); return { c: `(${s}.length === 0)`, ty: T.bool };
        case 'c_str': A(0); return { c: s, ty: T.str };
        case 'reserve': A(1); return { c: '1', ty: T.bool };
        case 'concat': { const v = A(1)[0]; const r = mut((g) => `${g} + ${S(v)}`); r.ty = T.bool; r.c = r.c.replace(/, 0\)$/, ', 1)'); return r; }
        case 'toUpperCase': A(0); return mut((g) => `${g}.toUpperCase()`);
        case 'toLowerCase': A(0); return mut((g) => `${g}.toLowerCase()`);
        case 'trim': A(0); return mut((g) => `${g}.trim()`);
        case 'replace': { const vs = A(2); const f = (v) => (v.ty.k === 'char' ? `String.fromCharCode(${v.c})` : S(v)); return mut((g) => `${g}.split(${f(vs[0])}).join(${f(vs[1])})`); }
        case 'remove': { const a = this.numArgs(e, A(1, 2)); return mut((g) => `__R.sremove(${g}, ${a.join(', ')})`); }
        case 'setCharAt': { const a = this.numArgs(e, A(2)); return mut((g) => `__R.setch(${g}, ${a[0]}, ${a[1]})`); }
      }
      fail(e.line, 'unknown_member', { name: m, obj: 'String' });
    }
    // ---- statements
    ln(l) { return `__R.ln = ${l}; `; }
    stmts(list) { return list.map((s) => this.st(s)).join('\n'); }
    body(s) {   // statement used as a loop / if body → block code (own scope)
      if (s.k === 'block') { this.scopes.push(new Map()); const c = this.stmts(s.body); this.scopes.pop(); return c; }
      this.scopes.push(new Map()); const c = this.st(s); this.scopes.pop(); return c;
    }
    st(s) {
      switch (s.k) {
        case 'block': return '{\n' + this.body(s) + '\n}';
        case 'empty': return ';';
        case 'expr': return this.ln(s.line) + this.ex(s.e).c + ';';
        case 'decl': return this.decl(s, false);
        case 'if': {
          let c = `${this.ln(s.line)}if (${this.ex(s.c).c}) {\n${this.body(s.a)}\n}`;
          if (s.b) c += ` else {\n${this.body(s.b)}\n}`;
          return c;
        }
        case 'while': { this.loop++; const c = `${this.ln(s.line)}while (${this.ex(s.c).c}) {\nif (__R.bk()) yield 0;\n${this.body(s.body)}\n}`; this.loop--; return c; }
        case 'do': { this.loop++; const b = this.body(s.body); this.loop--; return `do {\nif (__R.bk()) yield 0;\n${b}\n${this.ln(s.line)}} while (${this.ex(s.c).c});`; }
        case 'for': {
          this.scopes.push(new Map());
          let init = '';
          if (s.init) init = s.init.k === 'decl' ? this.decl(s.init, false) : this.ln(s.line) + this.ex(s.init.e).c + ';';
          const c = s.c ? this.ex(s.c).c : '';
          const u = s.u ? this.ex(s.u).c : '';
          this.loop++; const b = this.body(s.body); this.loop--;
          this.scopes.pop();
          return `{\n${init}\nfor (; ${c}; ${u}) {\nif (__R.bk()) yield 0;\n${b}\n}\n}`;
        }
        case 'switch': {
          const v = this.ex(s.e);
          if (!isInt(v.ty)) fail(s.line, 'type_mismatch', { from: tyName(v.ty), to: 'int' });
          this.sw++; this.scopes.push(new Map());
          const parts = s.items.map((it) => {
            if (it.k === 'case') { const cv = this.fold(it.v); if (cv === null) fail(it.line, 'not_const'); return `case ${numLit(cv)}:`; }
            if (it.k === 'default') return 'default:';
            return this.st(it);
          });
          this.scopes.pop(); this.sw--;
          return `${this.ln(s.line)}switch (${v.c}) {\n${parts.join('\n')}\n}`;
        }
        case 'break': if (!this.loop && !this.sw) fail(s.line, 'break_outside', { kw: 'break' }); return 'break;';
        case 'continue': if (!this.loop) fail(s.line, 'break_outside', { kw: 'continue' }); return 'continue;';
        case 'return': {
          const r = this.fn.ret;
          if (!s.e) return this.ln(s.line) + (r.k === 'void' ? 'return;' : `return ${r.k === 'str' ? "''" : '0'};`);
          const v = this.ex(s.e);
          if (r.k === 'void') return `${this.ln(s.line)}${v.c}; return;`;
          return `${this.ln(s.line)}return ${this.conv(v, r, s.line)};`;
        }
      }
      fail(s.line, 'unexpected', { tok: s.k });
    }
    arrKind(t) {
      switch (t.k) {
        case 'bool': return 'u8'; case 'char': return 'c'; case 'float': return 'f'; case 'str': return 's';
        case 'int': return t.b === 64 ? 'f' : (t.u ? 'u' : 'i') + t.b;
        case 'obj': return t.cls === 'Servo' ? 'servo' : 'x';
      }
      return 'x';
    }
    initList(init, ty, dims, d, line) {   // nested initializer → JS literal
      if (d === dims.length) {
        if (init.k === 'list') { if (init.list.length !== 1) fail(init.line, 'unexpected', { tok: '{' }); init = init.list[0]; }
        return this.conv(this.ex(init), ty, init.line || line);
      }
      if (init.k === 'str' && d === dims.length - 1 && (ty.k === 'char' || (ty.k === 'int' && ty.b === 8))) return JSON.stringify(init.v);
      if (init.k !== 'list') fail(init.line || line, 'expected', { want: '{', got: '...' });
      return '[' + init.list.map((x) => this.initList(x, ty, dims, d + 1, line)).join(', ') + ']';
    }
    decl(s, isGlobal) {
      const out = [];
      for (const v of s.vars) {
        let ty = v.ty, code, cv;
        const js = (v.stat && !isGlobal) ? `$__s${++this.nstatic}_${v.name}` : '$' + v.name;
        if (v.dims.length) {
          if (ty.k === 'obj' && ty.cls !== 'Servo') fail(v.line, 'unsupported', { what: tyName(ty) + '[]' });
          const dims = v.dims.map((d, i) => {
            if (d === null) {
              if (i > 0 || !v.init) fail(v.line, 'array_size', { name: v.name });
              if (v.init.k === 'str') return v.init.v.length + 1;
              if (v.init.k !== 'list') fail(v.line, 'array_size', { name: v.name });
              return Math.max(1, v.init.list.length);
            }
            const n = this.fold(d);
            if (n === null || !(n >= 1) || n > 100000) fail(v.line, 'array_size', { name: v.name });
            return Math.floor(n);
          });
          const kind = this.arrKind(ty);
          const ini = v.init ? this.initList(v.init, ty, dims, 0, v.line) : 'null';
          code = `__R.mk('${kind}', [${dims.join(', ')}], ${ini})`;
          ty = { k: 'arr', of: ty, n: dims.length, konst: v.konst };
        } else if (ty.k === 'obj') {
          const as = (v.ctor || []).map((a) => this.ex(a).c);
          if (v.init) fail(v.line, 'unsupported', { what: tyName(ty) + ' =' });
          if (ty.cls === 'LiquidCrystal' && as.length !== 6 && as.length !== 7 && as.length !== 10 && as.length !== 11) fail(v.line, 'args', { name: 'LiquidCrystal', n: '6/7/10/11' });
          const cv = (v.ctor || []).map((a) => this.ex(a));
          if (ty.cls === 'LiquidCrystal_I2C' && as.length !== 3 && as.length !== 4) fail(v.line, 'args', { name: 'LiquidCrystal_I2C', n: '3' });
          if (ty.cls === 'DHT' && as.length !== 2 && as.length !== 3) fail(v.line, 'args', { name: 'DHT', n: '2' });
          if (ty.cls === 'OneWire' && as.length !== 1) fail(v.line, 'args', { name: 'OneWire', n: 1 });
          if (ty.cls === 'DallasTemperature' && (as.length !== 1 || cv[0].ty.k !== 'owp')) fail(v.line, 'args', { name: 'DallasTemperature', n: '&OneWire' });
          if ((ty.cls === 'DHT' || ty.cls === 'OneWire') && cv.some((x) => !isNum(x.ty))) fail(v.line, 'type_mismatch', { from: tyName(cv.find((x) => !isNum(x.ty)).ty), to: 'number' });
          code = ty.cls === 'Servo' ? '__R.servo()' : ty.cls === 'DHT' ? `__R.dht(${as[0]}, ${as[1]})` : ty.cls === 'OneWire' ? `__R.ow(${as[0]})` : ty.cls === 'DallasTemperature' ? `__R.dallas(${as[0]})` : ty.cls === 'LiquidCrystal_I2C' ? `__R.lcdi2c(${as[0]}, ${as[1]}, ${as[2]})` : `__R.lcd([${as.join(', ')}])`;
        } else {
          if (ty.k === 'void') fail(v.line, 'type_mismatch', { from: 'void', to: v.name });
          if (v.ctor) { if (v.ctor.length !== 1) fail(v.line, 'args', { name: v.name, n: 1 }); v.init = v.ctor[0]; }
          if (v.init && v.init.k === 'list') { if (v.init.list.length > 1) fail(v.line, 'unexpected', { tok: '{' }); v.init = v.init.list[0] || { k: 'num', v: 0, ty: T.i16, line: v.line }; }
          if (v.init) {
            const iv = this.ex(v.init);
            code = this.conv(iv, ty, v.line);
            if (v.konst && isNum(ty)) { const f = this.fold(v.init); if (f !== null) cv = ty.k === 'float' ? f : Math.trunc(f); }
          } else code = ty.k === 'str' ? "''" : '0';
        }
        // declare after evaluating the initializer (C scoping: name visible in its own initializer, but harmless)
        this.declare(v, { kind: 'var', ty, js, konst: v.konst, cv });
        if (isGlobal || v.stat) { this.globals.push(js); this.ginit.push(`${this.ln(v.line)}${js} = ${code};`); }
        else out.push(`${this.ln(v.line)}let ${js} = ${code};`);
      }
      return out.join('\n');
    }
    program(items) {
      // pass 1: collect function signatures (prototypes are optional, like the Arduino IDE)
      for (const it of items) {
        if (it.k !== 'func' && it.k !== 'proto') continue;
        if (this.consts[it.name] || API_NAMES.has(it.name)) { if (it.name !== 'setup' && it.name !== 'loop') fail(it.line, 'redeclared', { name: it.name }); }
        const prev = this.funcs.get(it.name);
        if (prev) {
          if (prev.params.length !== it.params.length) fail(it.line, 'unsupported', { what: 'overloading' });
          if (it.k === 'func') { if (prev.defined) fail(it.line, 'redeclared', { name: it.name }); prev.defined = true; }
          continue;
        }
        this.funcs.set(it.name, { ret: it.ret, params: it.params, js: '$' + it.name, defined: it.k === 'func' });
      }
      // pass 2: globals and enums in order; functions bodies afterwards so every global is visible (globals declared
      // after a function are still found because bodies are compiled last)
      this.fn = { ret: T.void, tmps: [] };
      for (const it of items) {
        if (it.k === 'decl') this.decl(it, true);
        else if (it.k === 'enum') {
          let next = 0;
          for (const m of it.items) {
            if (m.val) { const v = this.fold(m.val); if (v === null) fail(m.line, 'not_const'); next = v; }
            this.declare({ name: m.name, line: m.line }, { kind: 'var', ty: T.i16, js: numLit(next), konst: true, cv: next });
            next++;
          }
          if (it.vars) this.decl(it.vars, true);
        }
      }
      const initTmps = this.fn.tmps;
      const fcode = [];
      for (const it of items) {
        if (it.k !== 'func') continue;
        this.fn = { ret: it.ret, tmps: [] }; this.ntmp = 0;
        this.scopes.push(new Map());
        for (const p of it.params) this.declare(p, { kind: 'var', ty: p.ty, js: '$' + p.name });
        const b = this.stmts(it.body.body);
        this.scopes.pop();
        const tmps = this.fn.tmps.length ? `let ${this.fn.tmps.join(', ')};\n` : '';
        fcode.push(`function* $${it.name}(${it.params.map((p) => '$' + p.name).join(', ')}) {\n${tmps}__R.tp += 5e-7;\n${b}\n${it.ret.k === 'void' ? '' : it.ret.k === 'str' ? "return '';" : 'return 0;'}\n}`);
      }
      for (const [name, f] of this.funcs) if (!f.defined) fail(items.find((x) => x.name === name).line, 'undefined_func', { name });
      const st = this.funcs.get('setup'), lp = this.funcs.get('loop');
      if (!st || !lp) fail(1, 'no_setup_loop');
      if (st.params.length || lp.params.length) fail(1, 'no_setup_loop');
      return "'use strict';\n" + (this.globals.length ? `let ${this.globals.join(', ')};\n` : '') +
        `function* __init() {\n${initTmps.length ? `let ${initTmps.join(', ')};\n` : ''}${this.ginit.join('\n')}\n}\n` + fcode.join('\n') +
        '\nreturn { init: __init, setup: $setup, loop: $loop };';
    }
  }

  // ------------------------------------------------------------------ JavaScript mode -----------------------------
  //  Token-level instrumentation: user function declarations become generators, calls to them and to the timed API
  //  functions become `(yield* f(...))`, and every loop condition gets a guard that yields to the simulator (or, in
  //  non-generator code, throws once the per-step instruction budget is exhausted).
  const JS_KW_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'instanceof']);
  const JS_PUNCT = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--',
    '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>', '{', '}', '(', ')', '[', ']', ';', ',', '<', '>', '+', '-', '*', '/', '%', '&', '|', '^',
    '!', '~', '?', ':', '=', '.', '@', '#'];
  function jsLex(src) {
    const toks = []; let i = 0, line = 1, ws = '';
    const n = src.length;
    const prevSig = () => toks[toks.length - 1];
    const regexOK = () => {
      const p = prevSig(); if (!p) return true;
      if (p.t === 'num' || p.t === 'str' || p.t === 'tpl' || p.t === 're') return false;
      if (p.t === 'id') return JS_KW_BEFORE_REGEX.has(p.v);
      return !(p.v === ')' || p.v === ']' || p.v === '}');
    };
    while (i < n) {
      const ch = src[i];
      if (ch === '\n') { ws += ch; line++; i++; continue; }
      if (/\s/.test(ch)) { ws += ch; i++; continue; }
      if (ch === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') ws += src[i++]; continue; }
      if (ch === '/' && src[i + 1] === '*') {
        const l0 = line; const j = src.indexOf('*/', i + 2); if (j < 0) fail(l0, 'unterminated_comment');
        const c = src.slice(i, j + 2); line += (c.match(/\n/g) || []).length; ws += c; i = j + 2; continue;
      }
      const tok = { ws, line }; ws = '';
      if (/[A-Za-z_$\u00a0-\uffff]/.test(ch)) {
        let j = i + 1; while (j < n && /[A-Za-z0-9_$\u00a0-\uffff]/.test(src[j])) j++;
        tok.t = 'id'; tok.v = src.slice(i, j); i = j;
      } else if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        const m = /^(0[xXbBoO][0-9a-fA-F_]+n?|[0-9][0-9_]*\.?[0-9_]*(?:[eE][+-]?[0-9]+)?n?|\.[0-9]+(?:[eE][+-]?[0-9]+)?)/.exec(src.slice(i));
        tok.t = 'num'; tok.v = m[0]; i += m[0].length;
      } else if (ch === '"' || ch === "'") {
        let j = i + 1; while (j < n && src[j] !== ch) { if (src[j] === '\\') j++; if (src[j] === '\n') fail(line, 'unterminated_str'); j++; }
        if (j >= n) fail(line, 'unterminated_str');
        tok.t = 'str'; tok.v = src.slice(i, j + 1); i = j + 1;
      } else if (ch === '`') {
        let j = i + 1, depth = 0;
        while (j < n) {
          const c = src[j];
          if (c === '\\') { j += 2; continue; }
          if (c === '\n') line++;
          if (depth === 0 && c === '`') break;
          if (c === '$' && src[j + 1] === '{') { depth++; j += 2; continue; }
          if (depth > 0 && c === '}') depth--;
          j++;
        }
        if (j >= n) fail(tok.line, 'unterminated_str');
        tok.t = 'tpl'; tok.v = src.slice(i, j + 1); i = j + 1;
      } else if (ch === '/' && regexOK()) {
        let j = i + 1, cls = false;
        while (j < n) { const c = src[j]; if (c === '\\') { j += 2; continue; } if (c === '\n') fail(line, 'unterminated_str'); if (c === '[') cls = true; else if (c === ']') cls = false; else if (c === '/' && !cls) break; j++; }
        j++; while (j < n && /[a-z]/.test(src[j])) j++;
        tok.t = 're'; tok.v = src.slice(i, j); i = j;
      } else {
        let p = null; for (const q of JS_PUNCT) if (src.startsWith(q, i)) { p = q; break; }
        if (!p) fail(line, 'unexpected', { tok: ch });
        tok.t = 'op'; tok.v = p; i += p.length;
      }
      toks.push(tok);
    }
    return { toks, tail: ws };
  }
  const JS_YIELD_API = new Set(['pinMode', 'digitalWrite', 'analogWrite', 'delay', 'delayMicroseconds', 'tone', 'noTone', 'pulseIn', 'shiftOut', 'shiftIn']);
  const JS_CTRL = new Set(['if', 'for', 'while', 'switch', 'catch', 'with', 'function']);
  function instrumentJS(src) {
    const { toks, tail } = jsLex(src);
    const N = toks.length;
    const isOp = (k, v) => toks[k] && toks[k].t === 'op' && toks[k].v === v;
    const isId = (k, v) => toks[k] && toks[k].t === 'id' && (v === undefined || toks[k].v === v);
    const match = new Array(N).fill(-1);   // bracket matching
    { const st = []; for (let k = 0; k < N; k++) { const t = toks[k]; if (t.t !== 'op') continue; if (t.v === '(' || t.v === '[' || t.v === '{') st.push(k); else if (t.v === ')' || t.v === ']' || t.v === '}') { const o = st.pop(); if (o === undefined) fail(t.line, 'unexpected', { tok: t.v }); match[o] = k; match[k] = o; } } if (st.length) fail(toks[st[st.length - 1]].line, 'eof', { want: toks[st[st.length - 1]].v === '(' ? ')' : toks[st[st.length - 1]].v === '[' ? ']' : '}' }); }
    for (const t of toks) { t.pre = ''; t.post = ''; }
    // 1. user function declarations → generators
    const gens = new Set(), genKw = new Set();
    for (let k = 0; k < N; k++) {
      if (!isId(k, 'function')) continue;
      const p = toks[k - 1];
      const stmtPos = !p || (p.t === 'op' && (p.v === ';' || p.v === '}' || p.v === '{' || p.v === ')')) || (p.t === 'id' && (p.v === 'else' || p.v === 'export'));
      const star = isOp(k + 1, '*');
      const nameK = star ? k + 2 : k + 1;
      if (isId(nameK) && isOp(nameK + 1, '(')) {
        if (star) { gens.add(toks[nameK].v); genKw.add(k); }
        else if (stmtPos) { toks[k].post = '*'; gens.add(toks[nameK].v); genKw.add(k); }
      } else if (star) genKw.add(k);
    }
    // 2. classify every '{' (function body: gen/plain, or plain block) to know whether `yield` is allowed
    const ctxAt = new Array(N).fill('top');
    { const st = []; let cur = 'top';
      for (let k = 0; k < N; k++) {
        ctxAt[k] = cur;
        if (isOp(k, '{')) {
          let kind = 'block';
          const p = toks[k - 1];
          if (p && p.t === 'op' && p.v === '=>') kind = 'plain';
          else if (p && p.t === 'op' && p.v === ')') {
            const o = match[k - 1]; const q = toks[o - 1], q2 = toks[o - 2], q3 = toks[o - 3];
            if (q && q.t === 'id' && q.v === 'function') kind = genKw.has(o - 1) ? 'gen' : 'plain';
            else if (q && q.t === 'op' && q.v === '*' && q2 && q2.v === 'function') kind = 'gen';
            else if (q && q.t === 'id' && !JS_CTRL.has(q.v)) {
              if (q2 && q2.t === 'id' && q2.v === 'function') kind = genKw.has(o - 2) ? 'gen' : 'plain';
              else if (q2 && q2.t === 'op' && q2.v === '*' && q3 && q3.v === 'function') kind = 'gen';
              else if (q2 && q2.t === 'op' && q2.v === '*') kind = 'gen';   // generator method
              else kind = 'plain';                                       // method / call-like → plain function
            }
          }
          st.push(cur); if (kind !== 'block') cur = kind;
        } else if (isOp(k, '}')) { cur = st.pop() || 'top'; }
        ctxAt[k] = ctxAt[k];
      }
    }
    const guard = (k) => (ctxAt[k] === 'gen' ? ['((__R.bk() && (yield 0)), (', '))'] : ['(__R.g(), (', '))']);
    // 3. calls → yield*, loops → guards
    for (let k = 0; k < N; k++) {
      const t = toks[k];
      if (t.t !== 'id') continue;
      const p = toks[k - 1];
      if ((gens.has(t.v) || JS_YIELD_API.has(t.v)) && isOp(k + 1, '(') && !(p && p.t === 'op' && (p.v === '.' || p.v === '?.' || p.v === '*')) && !(p && p.t === 'id' && (p.v === 'function' || p.v === 'new'))) {
        if (ctxAt[k] === 'gen') { t.pre += '(yield* '; toks[match[k + 1]].post += ')'; }
        else if (JS_YIELD_API.has(t.v) || gens.has(t.v)) { t.pre += '__R.run('; toks[match[k + 1]].post += ')'; }
        continue;
      }
      if ((t.v === 'while' || t.v === 'for') && isOp(k + 1, '(') && !(p && p.t === 'op' && p.v === '.')) {
        const o = k + 1, c = match[o];
        if (t.v === 'while') { const [a, b] = guard(k); toks[o].post += a; toks[c].pre = b + toks[c].pre; continue; }
        const semis = []; let depth = 0;
        for (let j = o + 1; j < c; j++) { const u = toks[j]; if (u.t === 'op') { if (u.v === '(' || u.v === '[' || u.v === '{') depth++; else if (u.v === ')' || u.v === ']' || u.v === '}') depth--; else if (u.v === ';' && depth === 0) semis.push(j); } }
        if (semis.length === 2) {
          const [s1, s2] = semis;
          if (s2 === s1 + 1) toks[s1].post += ctxAt[k] === 'gen' ? ' ((__R.bk() && (yield 0)), true)' : ' (__R.g(), true)';
          else { const [a, b] = guard(k); toks[s1].post += ' ' + a; toks[s2].pre = b + toks[s2].pre; }
        } else if (isOp(c + 1, '{')) toks[c + 1].post += ctxAt[k] === 'gen' ? ' if (__R.bk()) yield 0;' : ' __R.g();';
      }
    }
    return toks.map((t) => t.ws + t.pre + t.v + t.post).join('') + tail;
  }
  const JS_SHADOW = ['window', 'self', 'globalThis', 'document', 'location', 'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker', 'localStorage', 'sessionStorage',
    'indexedDB', 'navigator', 'Function', 'importScripts', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'alert', 'confirm', 'prompt',
    'open', 'close', 'parent', 'top', 'frames', 'opener', 'history', 'app', 'DEFS', 'I18N', 'MCULANG', 'MCU', 'EXAMPLES', 'UI', 'U', 'D'];
  const JS_API = ['pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite', 'analogReference', 'delay', 'delayMicroseconds', 'millis', 'micros',
    'tone', 'noTone', 'pulseIn', 'shiftOut', 'shiftIn', 'map', 'constrain', 'min', 'max', 'abs', 'sq', 'random', 'randomSeed', 'Serial', 'Servo', 'LiquidCrystal', 'LiquidCrystal_I2C', 'Wire', 'DHT', 'OneWire', 'DallasTemperature', 'DHT11', 'DHT22', 'DHT21', 'AM2301', 'DEVICE_DISCONNECTED_C', 'DEVICE_DISCONNECTED_F',
    'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'LED_BUILTIN', 'DEC', 'HEX', 'OCT', 'BIN', 'PI', 'MSBFIRST', 'LSBFIRST', 'DEFAULT', 'INTERNAL',
    'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'PB0', 'PB1', 'PB2', 'PB3', 'PB4', 'PB5', 'bitRead', 'bit', 'lowByte', 'highByte'];
  const JS_HEADER_LINES = 3;   // `function anonymous(...\n) {\n"use strict";\n` precede user line 1

  // ------------------------------------------------------------------ public entry --------------------------------
  const KNOWN_INC = new Set(['arduino.h', 'servo.h', 'liquidcrystal.h', 'avr/io.h', 'dht.h', 'onewire.h', 'dallastemperature.h', 'wire.h', 'liquidcrystal_i2c.h', 'avr/pgmspace.h', 'math.h', 'stdlib.h', 'string.h', 'stdint.h', 'stdio.h', 'util/delay.h']);
  const cache = new Map();
  function compile(src, lang, consts) {
    const key = lang + '\u0000' + JSON.stringify(Object.keys(consts || {}).length) + '\u0000' + src;
    if (cache.has(key)) return cache.get(key);
    let res;
    try {
      if (lang === 'js') {
        const code = instrumentJS(src);
        let factory;
        try {
          factory = new Function('__R', ...JS_API, ...JS_SHADOW, '"use strict";\n' + code +
            '\n;return { setup: typeof setup === "function" ? setup : null, loop: typeof loop === "function" ? loop : null };');
        } catch (err) {
          res = { ok: false, error: { line: jsSyntaxLine(code, err), key: 'syntax', params: { msg: String(err.message) } } };
        }
        if (!res) res = { ok: true, lang, factory, warnings: [] };
      } else {
        const pp = preprocess(lex(src), {});
        const items = new Parser(pp.toks).program();
        const code = new Emitter(consts || {}).program(items);
        let factory;
        try { factory = new Function('__R', code); }
        catch (err) { res = { ok: false, error: { line: 1, key: 'internal', params: { msg: String(err.message) } } }; }
        if (!res) {
          const warnings = pp.includes.filter((h) => !KNOWN_INC.has(h.toLowerCase())).map((h) => ({ line: 1, key: 'include', params: { name: h } }));
          res = { ok: true, lang, factory, code, warnings };
        }
      }
    } catch (err) {
      if (!(err instanceof CErr)) throw err;
      res = { ok: false, error: { line: err.line, key: err.key, params: err.params } };
    }
    if (cache.size > 40) cache.clear();
    cache.set(key, res);
    return res;
  }
  // syntax error position inside instrumented JS: re-parse with a <script> element would be async → bisect lines
  function jsSyntaxLine(code, err) {
    const lines = code.split('\n');
    // closers for the brackets still open at the end of a prefix (strings / comments skipped)
    const closers = (txt) => {
      const st = []; let q = null;
      for (let i = 0; i < txt.length; i++) {
        const ch = txt[i];
        if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
        if (ch === '"' || ch === "'" || ch === '`') q = ch;
        else if (ch === '/' && txt[i + 1] === '/') { while (i < txt.length && txt[i] !== '\n') i++; }
        else if (ch === '/' && txt[i + 1] === '*') { const j = txt.indexOf('*/', i + 2); i = j < 0 ? txt.length : j + 1; }
        else if (ch === '(' || ch === '[' || ch === '{') st.push(ch);
        else if ((ch === ')' || ch === ']' || ch === '}') && st.length) st.pop();
      }
      return st.reverse().map((c) => ({ '(': ')', '[': ']', '{': '}' })[c]).join('\n');
    };
    const tryK = (k) => { const pre = lines.slice(0, k).join('\n'); try { new Function('__R', 'async function* __g(){\n' + pre + '\n' + closers(pre) + '\n}'); return null; } catch (e) { return e.message; } };
    const lenient = /Unexpected end of input|Unexpected token '?[)}\]]'?|missing \) after|Unterminated/i;
    for (let k = 1; k <= lines.length; k++) { const m = tryK(k); if (m && !lenient.test(m)) return k; }
    for (let k = 1; k <= lines.length; k++) { const m = tryK(k); if (m && m === err.message) return k; }
    return lines.length;
  }
  const errorText = (e) => (typeof _t === 'function' ? _t('mcu.e.' + e.key, e.params) : e.key + ' ' + JSON.stringify(e.params));
  return { compile, errorText, lex, preprocess, Parser, Emitter, instrumentJS, JS_API, JS_SHADOW, JS_HEADER_LINES, T, CErr };
})();
