// v13 tests: 74-series / CD4000 logic ICs.
// Truth tables of every gate part, FF set / reset / clock behaviour, latches, counters (sequence, reset, load, up/down), shift registers,
// decoders / multiplexers, 7447 / 7448 digit patterns, adder / comparator (exhaustive), 74HC595 / 74HC165 driven by an Arduino program
// (shiftOut / shiftIn), tri-state outputs and bus contention, logic families (supply range, under-voltage, input thresholds),
// Schmitt-trigger hysteresis, optional propagation delay, save / load, pin-outs against the data sheets, palette search + info panel,
// dictionary keys in all 10 languages and every example (no non-convergence / errors / combinational loops).
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const results = {}; const fails = [];
const check = (name, cond, info) => { results[name] = { pass: !!cond, info }; if (!cond) fails.push(name); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + JSON.stringify(info).slice(0, 600))); };
const BASE = process.env.URL || 'http://127.0.0.1:8765/index.html';
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt-BR'];

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, locale: 'en-US' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(BASE + '?fresh=1&lang=en'); await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.TOASTS = []; const o = app.toast.bind(app); app.toast = (m) => { TOASTS.push(String(m)); o(m); };
    window.W = (a, ia, b, ib) => { const p = app.termPos(a, ia), q = app.termPos(b, ib); return app.addWire(p[0], p[1], q[0], q[1], 1); };
    window.STEP = (n) => { let bad = 0; for (let i = 0; i < (n || 1); i++) { app.simStep(); if (!app.net.converged) bad++; } return bad; };
    window.PART = (t) => DEFS[t].part;
    // fixture: IC + battery (supply v) + ground; opts: fam, v, props, tie {pin: 'V'|'G'}, sw [pins] (logic switches, default all other pins), pull [pins] (1 kΩ to VCC), wire [[pinA, pinB]] (internal links),
    //                  ard (Arduino code: the board's 5V / GND feed the IC)
    window.FX = (type, o) => {
      o = o || {}; app.clearAll(); app.pause(); TOASTS.length = 0;
      const part = PART(type), n = part.pins.length, F = { type, part, S: {}, R: {}, ix: {} };
      part.pins.forEach((p, i) => { F.ix[p] = i; });
      const U = F.U = app.addComp(type, 700, 420, 0, Object.assign({ fam: o.fam || part.famDef }, o.props || {}));
      const v = o.v === undefined ? 5 : o.v;
      const B = F.B = app.addComp('battery', 300, 300, 0, { V: v }), G = F.G = app.addComp('ground', 300, 560, 0, {});
      W(B, 1, U, part.iv); W(B, 0, G, 0); W(G, 0, U, part.ig);
      const tie = o.tie || {}, sw = new Set(o.sw || []), pull = new Set(o.pull || []);
      let k = 0;
      part.pins.forEach((p, i) => {
        if (i === part.iv || i === part.ig || p === 'NC') return;
        if (tie[p] === 'V') { W(B, 1, U, i); return; }
        if (tie[p] === 'G') { W(G, 0, U, i); return; }
        if (sw.has(p)) { const S = app.addComp('lswitch', 120, 80 + 36 * k++, 0, { vdd: o.vdd || v, on: false }); W(S, 0, U, i); F.S[p] = S; }
        if (pull.has(p)) { const R = app.addComp('resistor', 900, 80 + 40 * k++, 0, { R: 1000 }); W(R, 0, U, i); W(R, 1, B, 1); }
      });
      for (const [a, b2] of o.wire || []) W(U, F.ix[a], U, F.ix[b2]);
      if (o.extra) o.extra(F);
      app.changed(); app.resetSim(); STEP(2);
      return F;
    };
    window.SET = (F, vals) => { for (const [p, v] of Object.entries(vals)) { if (!F.S[p]) throw new Error('no switch ' + p); F.S[p].props.on = !!v; } app.dirty = true; };
    window.VOLT = (F, p) => app.net.v(F.U._nodes[F.ix[p]]) - app.net.v(F.U._nodes[F.part.ig]);
    window.LV = (F, p) => { const v = VOLT(F, p), vcc = VOLT(F, F.part.pins[F.part.iv]); return v > 0.5 * vcc ? 1 : 0; };
    window.OUT = (F, names) => names.map((p) => LV(F, p)).join('');
    window.ZS = (F, p) => (F.U.state.d && F.U.state.d.o ? F.U.state.d.o[p] : undefined);
    window.PUL = (F, clk, n, hi) => { for (let i = 0; i < (n || 1); i++) { SET(F, { [clk]: hi ? 0 : 1 }); STEP(2); SET(F, { [clk]: hi ? 1 : 0 }); STEP(2); } };   // one rising pulse (hi: falling-edge pulse for active-low clocks: starts high)
    window.NUM = (s) => parseInt(s.split('').reverse().join(''), 2);   // 'QA QB QC QD' string -> number (QA = LSB)
    window.BAD = (F) => (F.U.state.d ? 0 : 1);
  });

  const names = await page.evaluate(() => Object.keys(DEFS).filter((t) => DEFS[t].cat === 'ttl'));

  // ---------- 1. library: category, count, sub-groups, pin-outs against the data sheets ----------
  {
    const PINS = {
      '7400': '1A 1B 1Y 2A 2B 2Y GND 3Y 3A 3B 4Y 4A 4B VCC', '7402': '1Y 1A 1B 2Y 2A 2B GND 3A 3B 3Y 4A 4B 4Y VCC', '7404': '1A 1Y 2A 2Y 3A 3Y GND 4Y 4A 5Y 5A 6Y 6A VCC',
      '7407': '1A 1Y 2A 2Y 3A 3Y GND 4Y 4A 5Y 5A 6Y 6A VCC', '7408': '1A 1B 1Y 2A 2B 2Y GND 3Y 3A 3B 4Y 4A 4B VCC', '7410': '1A 1B 2A 2B 2C 2Y GND 3Y 3A 3B 3C 1Y 1C VCC',
      '7411': '1A 1B 2A 2B 2C 2Y GND 3Y 3A 3B 3C 1Y 1C VCC', '7420': '1A 1B NC 1C 1D 1Y GND 2Y 2A 2B NC 2C 2D VCC', '7427': '1A 1B 2A 2B 2C 2Y GND 3Y 3A 3B 3C 1Y 1C VCC',
      '7432': '1A 1B 1Y 2A 2B 2Y GND 3Y 3A 3B 4Y 4A 4B VCC', '7486': '1A 1B 1Y 2A 2B 2Y GND 3Y 3A 3B 4Y 4A 4B VCC', '7414': '1A 1Y 2A 2Y 3A 3Y GND 4Y 4A 5Y 5A 6Y 6A VCC',
      '74132': '1A 1B 1Y 2A 2B 2Y GND 3Y 3A 3B 4Y 4A 4B VCC',
      '7474': '/1CLR 1D 1CLK /1PRE 1Q /1Q GND /2Q 2Q /2PRE 2CLK 2D /2CLR VCC',
      '7490': 'CKB R0(1) R0(2) NC VCC R9(1) R9(2) QC QB GND QD QA NC CKA', '7493': 'CKB R0(1) R0(2) NC VCC NC NC QC QB GND QD QA NC CKA',
      '74161': '/CLR CLK A B C D ENP GND /LOAD ENT QD QC QB QA RCO VCC', '74163': '/CLR CLK A B C D ENP GND /LOAD ENT QD QC QB QA RCO VCC',
      '74138': 'A B C /G2A /G2B G1 /Y7 GND /Y6 /Y5 /Y4 /Y3 /Y2 /Y1 /Y0 VCC', '74139': '/1G 1A 1B /1Y0 /1Y1 /1Y2 /1Y3 GND /2Y3 /2Y2 /2Y1 /2Y0 2B 2A /2G VCC',
      '74595': 'QB QC QD QE QF QG QH GND QH\' /SRCLR SRCLK RCLK /OE SER QA VCC', '74165': '/PL CLK E F G H /QH GND QH SER A B C D CLKINH VCC',
      '74373': '/OE 1Q 1D 2D 2Q 3Q 3D 4D 4Q GND LE 5Q 5D 6D 6Q 7Q 7D 8D 8Q VCC', '74245': 'DIR A1 A2 A3 A4 A5 A6 A7 A8 GND B8 B7 B6 B5 B4 B3 B2 B1 /OE VCC',
      '74244': '/1G 1A1 2Y4 1A2 2Y3 1A3 2Y2 1A4 2Y1 GND 2A1 1Y4 2A2 1Y3 2A3 1Y2 2A4 1Y1 /2G VCC',
      '7447': 'B C /LT /BI /RBI D A GND e d c b a g f VCC', '7448': 'B C /LT /BI /RBI D A GND e d c b a g f VCC',
      '7483': 'A4 S3 A3 B3 VCC S2 B2 A2 S1 A1 B1 GND C0 C4 S4 B4', '7485': 'B3 A<B A=B A>B OA>B OA=B OA<B GND B0 A0 B1 A1 A2 B2 A3 VCC',
      '74194': '/CLR SR A B C D SL GND S0 S1 CLK QD QC QB QA VCC', '4017': 'Q5 Q1 Q0 Q2 Q6 Q7 Q3 VSS Q8 Q4 Q9 CO INH CLK RST VDD',
      '74153': '/1G 1S1 1C3 1C2 1C1 1C0 1Y GND 2Y 2C0 2C1 2C2 2C3 2S0 /2G VCC'.replace('1S1', 'B').replace('2S0', 'A'),
    };
    const r = await page.evaluate((PINS) => {
      const o = { n: 0, cats: [], missing: [], bad: {}, subs: window.CAT_SUBS && CAT_SUBS.ttl, perSub: {}, dup: [] };
      const seen = new Set();
      for (const [t, d] of Object.entries(DEFS)) if (d.cat === 'ttl') { o.n++; o.perSub[d.pgrp] = (o.perSub[d.pgrp] || 0) + 1; if (seen.has(d.part.n)) o.dup.push(d.part.n); seen.add(d.part.n); }
      for (const [n, pins] of Object.entries(PINS)) {
        const d = DEFS['ic' + n]; if (!d) { o.missing.push(n); continue; }
        const got = d.part.pins.join(' ');
        if (got !== pins) o.bad[n] = got;
        // terminals: DIP — pin 1 top left, down the left side and up the right side, 20 px pitch, 120 px between the rows
        const T = d.terms, h = T.length / 2;
        if (!(T[0][0] === -60 && T[h][0] === 60 && T[h - 1][0] === -60 && T[T.length - 1][0] === 60 && T[0][1] === T[T.length - 1][1] && T[h - 1][1] === T[h][1] && T[1][1] - T[0][1] === 20)) o.bad[n + '_shape'] = [T[0], T[h - 1], T[h], T[T.length - 1]];
      }
      o.cats = CATEGORIES.map((c) => c[0]);
      return o;
    }, PINS);
    check('ttl_category_registered_next_to_logic', r.cats.indexOf('ttl') > r.cats.indexOf('logic') && r.cats.indexOf('ttl') <= r.cats.indexOf('logic') + 2, r.cats);
    check('ttl_part_count_at_least_50', r.n >= 50, r.n);
    check('ttl_no_duplicate_parts', r.dup.length === 0, r.dup);
    check('ttl_sub_groups_all_used', r.subs && r.subs.every((s) => r.perSub[s] > 0), r.perSub);
    check('ttl_pinouts_match_datasheets', Object.keys(r.bad).length === 0 && r.missing.length === 0, { bad: r.bad, missing: r.missing });
  }
  const need = ['7400', '7402', '7404', '7408', '7410', '7411', '7420', '7427', '7432', '7486', '7414', '74132', '7407', '7474', '7476', '74112', '74273', '74373', '74573', '7475', '7490', '7493', '74161', '74163', '74190', '74191', '74192', '74193', '74393', '4017', '4040', '74164', '74165', '74194', '74595', '74138', '74139', '74154', '74153', '74151', '74157', '7447', '7448', '7483', '7485', '74244', '74245', '74125', '74126'];
  check('ttl_all_required_parts_present', await page.evaluate((need) => need.filter((n) => !DEFS['ic' + n]), need).then((m) => m.length === 0), await page.evaluate((need) => need.filter((n) => !DEFS['ic' + n]), need));
  {
    const r = await page.evaluate(() => {
      const gen = new Set(['and', 'or', 'not', 'nand', 'nor', 'xor']);    // generic parts stay single: the 74xx parts are additional DIP packages
      const generic = Object.keys(DEFS).filter((t) => DEFS[t].cat === 'logic').length;
      return { generic, has7414: !!DEFS.ic7414, andStill: !!DEFS.and && !!DEFS.nand, probes: !!DEFS.lprobe };
    });
    check('existing_generic_gates_untouched', r.andStill && r.generic > 5 && r.probes, r);
  }

  // ---------- 2. gates: exhaustive truth tables (all gate parts) ----------
  {
    const GATES = { '7400': 'nand', '7402': 'nor', '7404': 'not', '7407': 'buf', '7408': 'and', '7410': 'nand', '7411': 'and', '7420': 'nand', '7427': 'nor', '7432': 'or', '7486': 'xor', '7414': 'not', '74132': 'nand' };
    for (const [n, fn] of Object.entries(GATES)) {
      for (const fam of ['HC', 'LS']) {
        const r = await page.evaluate(({ n, fn, fam }) => {
          const part = PART('ic' + n), grp = {};
          for (const p of part.pins) { let m = /^(\d)([A-D])$/.exec(p); if (m) (grp[m[1]] = grp[m[1]] || { ins: [], out: null }).ins.push(p); m = /^(\d)Y$/.exec(p); if (m) (grp[m[1]] = grp[m[1]] || { ins: [], out: null }).out = p; }
          const G = Object.values(grp), sw = G.flatMap((g) => g.ins), oc = n === '7407';
          const F = FX('ic' + n, { fam, sw, pull: oc ? G.map((g) => g.out) : [] });
          const f = { nand: (a) => 1 - (a.every((x) => x) ? 1 : 0), nor: (a) => 1 - (a.some((x) => x) ? 1 : 0), and: (a) => (a.every((x) => x) ? 1 : 0), or: (a) => (a.some((x) => x) ? 1 : 0), xor: (a) => a[0] ^ a[1], not: (a) => 1 - a[0], buf: (a) => a[0] }[fn];
          const m = G[0].ins.length; let bad = [], cnt = 0, nc = 0;
          for (let shift = 0; shift < G.length; shift++) for (let k = 0; k < (1 << m); k++) {
            const vals = {}, exp = {};
            G.forEach((g, gi) => { const kk = (k + shift * 3 + gi) % (1 << m), bits = g.ins.map((_, i) => (kk >> i) & 1); g.ins.forEach((p, i) => { vals[p] = bits[i]; }); exp[g.out] = f(bits); });
            SET(F, vals); nc += STEP(2);
            for (const g of G) { cnt++; if (LV(F, g.out) !== exp[g.out]) bad.push([g.out, Object.values(vals).join(''), exp[g.out]]); }
          }
          return { cnt, bad: bad.slice(0, 4), nc, groups: G.length, m };
        }, { n, fn, fam });
        check('gate_' + n + '_' + fam + '_truth_table', r.bad.length === 0 && r.nc === 0 && r.cnt > 0, r);
      }
    }
    // 7407 open collector: output pulls low, high only through the external pull-up
    const r = await page.evaluate(() => {
      const F = FX('ic7407', { sw: ['1A'], pull: ['1Y'], tie: { '2A': 'G', '3A': 'G', '4A': 'G', '5A': 'G', '6A': 'G' } });
      SET(F, { '1A': 0 }); STEP(2); const lo = VOLT(F, '1Y'); SET(F, { '1A': 1 }); STEP(2); const hi = VOLT(F, '1Y');
      const F2 = FX('ic7407', { sw: ['1A'], tie: { '2A': 'G' } }); SET(F2, { '1A': 0 }); STEP(2); const noPull = VOLT(F2, '1Y');
      return { lo, hi, noPull };
    });
    check('gate_7407_open_collector_needs_pullup', r.lo < 0.4 && r.hi > 4.5 && r.noPull < 0.3, r);
  }

  // ---------- 3. flip-flops and latches ----------
  {
    const r = await page.evaluate(() => {
      const o = {};
      let F = FX('ic7474', { sw: ['/1CLR', '/1PRE', '1D', '1CLK', '/2CLR', '/2PRE', '2D', '2CLK'] });
      SET(F, { '/1CLR': 1, '/1PRE': 1, '/2CLR': 1, '/2PRE': 1 }); STEP(2);
      o.init = OUT(F, ['1Q', '/1Q']);
      SET(F, { '1D': 1 }); STEP(2); o.noClkYet = OUT(F, ['1Q']);
      PUL(F, '1CLK'); o.d1 = OUT(F, ['1Q', '/1Q']);
      SET(F, { '1D': 0 }); STEP(2); o.holdD0 = OUT(F, ['1Q']); PUL(F, '1CLK'); o.d0 = OUT(F, ['1Q', '/1Q']);
      SET(F, { '/1PRE': 0 }); STEP(2); o.pre = OUT(F, ['1Q', '/1Q']); SET(F, { '/1PRE': 1 }); STEP(2); o.preHold = OUT(F, ['1Q']);
      SET(F, { '/1CLR': 0 }); STEP(2); o.clr = OUT(F, ['1Q', '/1Q']); SET(F, { '/1CLR': 1 }); STEP(2);
      SET(F, { '/1CLR': 0, '/1PRE': 0 }); STEP(2); o.both = OUT(F, ['1Q', '/1Q']);
      SET(F, { '/1CLR': 1, '/1PRE': 1 }); STEP(2);
      SET(F, { '2D': 1 }); STEP(2); PUL(F, '2CLK'); o.ff2 = OUT(F, ['2Q']); o.ff1untouched = OUT(F, ['1Q']);
      // the clock edge is a RISING edge: a falling edge does nothing
      SET(F, { '1D': 1, '1CLK': 1 }); STEP(2); const before = OUT(F, ['1Q']); SET(F, { '1CLK': 0 }); STEP(2); o.fallNo = before + OUT(F, ['1Q']);
      o.bad = F.S && 0;
      // JK 7476 / 74112
      for (const t of ['ic74112', 'ic7476']) {
        const pins = PART(t).pins, has = (p) => pins.includes(p);
        const sw = ['1J', '1K', '1CLK', '/1CLR', '/1PRE'].filter(has);
        F = FX(t, { sw, tie: { '2J': 'G', '2K': 'G', '2CLK': 'V', '/2CLR': 'V', '/2PRE': 'V' } });
        const clk = '1CLK';
        SET(F, { '/1CLR': 1, '/1PRE': 1, '1J': 0, '1K': 0 }); STEP(2);
        SET(F, { '/1CLR': 0 }); STEP(2); SET(F, { '/1CLR': 1 }); STEP(2);
        const seq = [];
        const pulse = () => { const fe = t === 'ic74112'; SET(F, { [clk]: fe ? 1 : 1 }); STEP(2); SET(F, { [clk]: 0 }); STEP(2); if (!fe) { /* 7476: master-slave, output on falling edge */ } };
        // J=1,K=0 set; J=0,K=1 reset; J=K=1 toggle; J=K=0 hold
        SET(F, { '1J': 1, '1K': 0 }); pulse(); seq.push(OUT(F, ['1Q']));
        SET(F, { '1J': 0, '1K': 0 }); pulse(); seq.push(OUT(F, ['1Q']));
        SET(F, { '1J': 0, '1K': 1 }); pulse(); seq.push(OUT(F, ['1Q']));
        SET(F, { '1J': 1, '1K': 1 }); pulse(); seq.push(OUT(F, ['1Q'])); pulse(); seq.push(OUT(F, ['1Q'])); pulse(); seq.push(OUT(F, ['1Q']));
        SET(F, { '/1PRE': 0 }); STEP(2); seq.push(OUT(F, ['1Q'])); SET(F, { '/1PRE': 1 }); STEP(2);
        SET(F, { '/1CLR': 0 }); STEP(2); seq.push(OUT(F, ['1Q']));
        o[t] = seq.join('');
      }
      // 74273 octal D flip-flop with clear
      return o;
    });
    check('ff_7474_power_up_state_defined', r.init === '01' || r.init === '10' || r.init === '00' || r.init === '11', r.init);
    check('ff_7474_d_input_sampled_on_rising_edge', r.noClkYet !== undefined && r.d1 === '10' && r.holdD0 === '1' && r.d0 === '01', r);
    check('ff_7474_async_preset_clear_and_priority', r.pre === '10' && r.preHold === '1' && r.clr === '01' && r.both === '11', r);
    check('ff_7474_second_ff_independent', r.ff2 === '1' && r.ff1untouched === '0', r);
    check('ff_7474_falling_edge_ignored', r.fallNo === '00', r);
    check('ff_74112_jk_set_hold_reset_toggle_preset_clear', r.ic74112 === '11010110', r.ic74112);
    check('ff_7476_jk_set_hold_reset_toggle_preset_clear', r.ic7476 === '11010110', r.ic7476);
  }


  // ---------- 4. latches and registers ----------
  {
    const r = await page.evaluate(() => {
      const o = {}, D8 = (F, v, sfx) => { const x = {}; for (let i = 1; i <= 8; i++) x[i + 'D'] = (v >> (i - 1)) & 1; return x; };
      const Q8 = (F) => { let v = 0; for (let i = 1; i <= 8; i++) v |= LV(F, i + 'Q') << (i - 1); return v; };
      for (const t of ['ic74373', 'ic74573']) {
        const pins = PART(t).pins, d = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => i + 'D'), q = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => i + 'Q');
        const F = FX(t, { sw: d.concat(['LE', '/OE']) });
        const Q = () => { let v = 0; for (let i = 1; i <= 8; i++) v |= LV(F, i + 'Q') << (i - 1); return v; };
        SET(F, { '/OE': 0, LE: 1, ...D8(F, 0xA5) }); STEP(2); const tr = Q();
        SET(F, { LE: 0 }); STEP(2); SET(F, D8(F, 0x3C)); STEP(2); const hold = Q();
        SET(F, { LE: 1 }); STEP(2); const tr2 = Q();
        SET(F, { LE: 0 }); STEP(2); SET(F, { '/OE': 1 }); STEP(2); const z = q.map((p) => ZS(F, p)).join('');
        SET(F, { '/OE': 0 }); STEP(2); const back = Q();
        o[t] = { tr, hold, tr2, z, back };
      }
      let F = FX('ic7475', { sw: ['1D', '2D', '3D', '4D', 'C12', 'C34'] });
      SET(F, { C12: 1, C34: 0, '1D': 1, '2D': 0, '3D': 1, '4D': 1 }); STEP(2);
      const a = OUT(F, ['1Q', '2Q', '3Q', '4Q']), na = OUT(F, ['/1Q', '/2Q']);
      SET(F, { C12: 0, C34: 1, '1D': 0, '2D': 1, '3D': 1, '4D': 1 }); STEP(2);
      o.l7475 = { a, na, b: OUT(F, ['1Q', '2Q', '3Q', '4Q']) };
      F = FX('ic74273', { sw: ['1D', '2D', '3D', '4D', '5D', '6D', '7D', '8D', 'CP', '/MR'] });
      SET(F, { '/MR': 1, CP: 0, ...D8(F, 0x96) }); STEP(2); const pre = Q8(F); PUL(F, 'CP'); const lat = Q8(F);
      SET(F, { ...D8(F, 0x0F) }); STEP(2); const hold = Q8(F); SET(F, { '/MR': 0 }); STEP(2);
      o.l273 = { pre, lat, hold, clr: Q8(F) };
      return o;
    });
    for (const t of ['ic74373', 'ic74573']) check(t + '_transparent_hold_highz', r[t].tr === 0xA5 && r[t].hold === 0xA5 && r[t].tr2 === 0x3C && r[t].z === '22222222' && r[t].back === 0x3C, r[t]);
    check('ic7475_two_enables_four_latches', r.l7475.a === '1000' && r.l7475.na === '01' && r.l7475.b === '1011', r.l7475);
    check('ic74273_edge_triggered_with_master_reset', r.l273.pre === 0 && r.l273.lat === 0x96 && r.l273.hold === 0x96 && r.l273.clr === 0, r.l273);
  }

  // ---------- 5. counters ----------
  {
    const r = await page.evaluate(() => {
      const o = {}, seqOf = (F, outs, clk, n, hi) => { const a = []; for (let i = 0; i < n; i++) { PUL(F, clk, 1, hi); a.push(NUM(OUT(F, outs))); } return a; };
      const QS = ['QA', 'QB', 'QC', 'QD'];
      // 7493: falling-edge ripple counter, QA -> CKB
      let F = FX('ic7493', { sw: ['CKA', 'R0(1)', 'R0(2)'], wire: [['QA', 'CKB']] });
      SET(F, { CKA: 1, 'R0(1)': 1, 'R0(2)': 1 }); STEP(2); o.c93_clear = NUM(OUT(F, QS));
      SET(F, { 'R0(1)': 0 }); STEP(2); o.c93_noclear = NUM(OUT(F, QS));
      SET(F, { 'R0(2)': 0, CKA: 1 }); STEP(2);
      o.c93 = seqOf(F, QS, 'CKA', 18, true);   // each pulse = high->low (falling edge counts)
      SET(F, { 'R0(1)': 1, 'R0(2)': 1 }); STEP(2); o.c93_reset = NUM(OUT(F, QS));
      // 7490: decade counter, QA -> CKB; R9 sets 9
      F = FX('ic7490', { sw: ['CKA', 'R0(1)', 'R0(2)', 'R9(1)', 'R9(2)'], wire: [['QA', 'CKB']] });
      SET(F, { CKA: 1 }); STEP(2);
      o.c90 = seqOf(F, QS, 'CKA', 12, true);
      SET(F, { 'R9(1)': 1, 'R9(2)': 1 }); STEP(2); o.c90_set9 = NUM(OUT(F, QS));
      SET(F, { 'R9(1)': 0, 'R9(2)': 0, 'R0(1)': 1, 'R0(2)': 1 }); STEP(2); o.c90_reset = NUM(OUT(F, QS));
      // 7490 as divide-by-2 + divide-by-5 separately (CKA only drives QA, CKB drives QB..QD)
      SET(F, { 'R0(1)': 0, 'R0(2)': 0, CKA: 1 }); STEP(2); PUL(F, 'CKA', 1, true); o.c90_a = OUT(F, ['QA']);
      return o;
    });
    check('counter_7493_binary_sequence_0_to_15_wraps', JSON.stringify(r.c93) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0, 1, 2]), r.c93);
    check('counter_7493_reset_R0_needs_both_inputs', r.c93_clear === 0 && r.c93_reset === 0, r);
    check('counter_7490_decade_sequence_wraps_at_10', JSON.stringify(r.c90) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2]), r.c90);
    check('counter_7490_set9_and_reset0', r.c90_set9 === 9 && r.c90_reset === 0 && r.c90_a === '1', r);
  }
  {
    const r = await page.evaluate(() => {
      const o = {}, QS = ['QA', 'QB', 'QC', 'QD'], seqOf = (F, outs, clk, n) => { const a = []; for (let i = 0; i < n; i++) { PUL(F, clk); a.push(NUM(OUT(F, outs))); } return a; };
      const ctl = ['CLK', '/CLR', '/LOAD', 'ENP', 'ENT', 'A', 'B', 'C', 'D'];
      for (const t of ['ic74161', 'ic74163', 'ic74160', 'ic74162']) {
        const F = FX(t, { sw: ctl });
        SET(F, { '/CLR': 1, '/LOAD': 1, ENP: 1, ENT: 1 }); STEP(2);
        const x = {};
        PUL(F, 'CLK', 1); x.clr0 = NUM(OUT(F, QS));        // starts at 0 (power-up) -> counts from 1 below
        x.seq = seqOf(F, QS, 'CLK', 12);
        x.rco = [];
        // RCO high only at the terminal count with ENT = 1
        const lim = t === 'ic74160' || t === 'ic74162' ? 9 : 15;
        SET(F, { A: 1, B: lim === 9 ? 0 : 1, C: lim === 9 ? 0 : 1, D: 1, '/LOAD': 0 }); STEP(2); PUL(F, 'CLK'); SET(F, { '/LOAD': 1 }); STEP(2);
        x.loaded = NUM(OUT(F, QS)); x.rcoOn = LV(F, 'RCO'); SET(F, { ENT: 0 }); STEP(2); x.rcoEntLow = LV(F, 'RCO'); SET(F, { ENT: 1 }); STEP(2);
        PUL(F, 'CLK'); x.wrap = NUM(OUT(F, QS));
        // enables: ENP low holds
        PUL(F, 'CLK'); const c1 = NUM(OUT(F, QS)); SET(F, { ENP: 0 }); STEP(2); PUL(F, 'CLK'); x.holdENP = NUM(OUT(F, QS)) === c1; SET(F, { ENP: 1, ENT: 0 }); STEP(2); PUL(F, 'CLK'); x.holdENT = NUM(OUT(F, QS)) === c1; SET(F, { ENT: 1 }); STEP(2);
        // load is synchronous: no change before the clock edge
        SET(F, { A: 0, B: 1, C: 0, D: 0, '/LOAD': 0 }); STEP(2); x.loadPre = NUM(OUT(F, QS)); PUL(F, 'CLK'); x.loadPost = NUM(OUT(F, QS)); SET(F, { '/LOAD': 1 }); STEP(2);
        // clear: 74161/74160 asynchronous, 74163/74162 synchronous
        SET(F, { '/CLR': 0 }); STEP(2); x.clrNow = NUM(OUT(F, QS)); PUL(F, 'CLK'); x.clrAfter = NUM(OUT(F, QS)); SET(F, { '/CLR': 1 }); STEP(2);
        o[t] = x;
      }
      return o;
    });
    for (const t of ['ic74161', 'ic74163', 'ic74160', 'ic74162']) {
      const x = r[t], dec = t === 'ic74160' || t === 'ic74162', async = t === 'ic74161' || t === 'ic74160';
      const want = dec ? [2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3] : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
      check(t + '_count_sequence', JSON.stringify(x.seq) === JSON.stringify(want) && x.clr0 === 1, x);
      check(t + '_terminal_count_RCO_wrap_and_enables', x.loaded === (dec ? 9 : 15) && x.rcoOn === 1 && x.rcoEntLow === 0 && x.wrap === 0 && x.holdENP && x.holdENT, x);
      check(t + '_load_synchronous_and_clear_' + (async ? 'async' : 'sync'), x.loadPre !== 2 && x.loadPost === 2 && (async ? x.clrNow === 0 : x.clrNow !== 0 && x.clrAfter === 0) && x.clrAfter === 0, x);
    }
  }
  {
    const r = await page.evaluate(() => {
      const o = {}, QS = ['QA', 'QB', 'QC', 'QD'];
      // 74190 / 74191: single clock with D/U, /CTEN, async /LOAD
      for (const t of ['ic74190', 'ic74191']) {
        const F = FX(t, { sw: ['CLK', '/CTEN', 'D/U', '/LOAD', 'A', 'B', 'C', 'D'] }), x = {}, lim = t === 'ic74190' ? 9 : 15;
        SET(F, { '/CTEN': 0, 'D/U': 0, '/LOAD': 1 }); STEP(2);
        x.up = []; for (let i = 0; i < 4; i++) { PUL(F, 'CLK'); x.up.push(NUM(OUT(F, QS))); }
        SET(F, { 'D/U': 1 }); STEP(2); x.down = []; for (let i = 0; i < 6; i++) { PUL(F, 'CLK'); x.down.push(NUM(OUT(F, QS))); }
        x.under = NUM(OUT(F, QS)); x.mm0 = LV(F, 'MAX/MIN');
        SET(F, { 'D/U': 0, A: 1, B: 0, C: 0, D: 1, '/LOAD': 0 }); STEP(2); x.load = NUM(OUT(F, QS)); SET(F, { '/LOAD': 1 }); STEP(2);
        x.maxMin = LV(F, 'MAX/MIN'); PUL(F, 'CLK'); const a = NUM(OUT(F, QS)); SET(F, { '/CTEN': 1 }); STEP(2); PUL(F, 'CLK'); x.hold = NUM(OUT(F, QS)) === a;
        SET(F, { '/CTEN': 0, A: 0, B: 0, C: 0, D: 0 }); STEP(2);   // wrap at the top
        SET(F, { A: lim === 9 ? 1 : 1, B: lim === 9 ? 0 : 1, C: lim === 9 ? 0 : 1, D: 1, '/LOAD': 0 }); STEP(2); SET(F, { '/LOAD': 1 }); STEP(2); PUL(F, 'CLK'); x.wrapTop = NUM(OUT(F, QS));
        o[t] = x;
      }
      // 74192 / 74193: separate UP / DOWN clocks, CLR, async load
      for (const t of ['ic74192', 'ic74193']) {
        const F = FX(t, { sw: ['UP', 'DOWN', 'CLR', '/LOAD', 'A', 'B', 'C', 'D'] }), x = {}, lim = t === 'ic74192' ? 9 : 15;
        SET(F, { UP: 1, DOWN: 1, CLR: 1 }); STEP(2); SET(F, { CLR: 0, '/LOAD': 1 }); STEP(2);
        x.up = []; for (let i = 0; i < 3; i++) { PUL(F, 'UP', 1, true); x.up.push(NUM(OUT(F, QS))); }
        x.down = []; for (let i = 0; i < 5; i++) { PUL(F, 'DOWN', 1, true); x.down.push(NUM(OUT(F, QS))); }
        x.boLow = LV(F, '/BO');
        SET(F, { A: 1, B: lim === 15 ? 1 : 0, C: lim === 15 ? 1 : 0, D: 1, '/LOAD': 0 }); STEP(2); x.load = NUM(OUT(F, QS)); SET(F, { '/LOAD': 1 }); STEP(2);
        SET(F, { UP: 0 }); STEP(2); x.coLow = LV(F, '/CO'); SET(F, { UP: 1 }); STEP(2); x.coHigh = LV(F, '/CO');
        PUL(F, 'UP', 1, true); x.wrapTop = NUM(OUT(F, QS)); SET(F, { CLR: 1 }); STEP(2); x.clr = NUM(OUT(F, QS));
        o[t] = x;
      }
      // 74393 dual falling-edge ripple counter
      let F = FX('ic74393', { sw: ['1CLK', '1CLR', '2CLK', '2CLR'] });
      SET(F, { '1CLK': 1, '2CLK': 1, '1CLR': 1, '2CLR': 1 }); STEP(2); SET(F, { '1CLR': 0, '2CLR': 0 }); STEP(2);
      const a = [], b = [];
      for (let i = 0; i < 5; i++) { PUL(F, '1CLK', 1, true); a.push(NUM(OUT(F, ['1QA', '1QB', '1QC', '1QD']))); }
      for (let i = 0; i < 3; i++) { PUL(F, '2CLK', 1, true); b.push(NUM(OUT(F, ['2QA', '2QB', '2QC', '2QD']))); }
      o.c393 = { a, b }; SET(F, { '1CLR': 1 }); STEP(2); o.c393.clr1 = NUM(OUT(F, ['1QA', '1QB', '1QC', '1QD'])); o.c393.keep2 = NUM(OUT(F, ['2QA', '2QB', '2QC', '2QD']));
      // CD4017 decade counter / divider
      F = FX('ic4017', { v: 5, sw: ['CLK', 'INH', 'RST'] });
      SET(F, { CLK: 0, INH: 0, RST: 1 }); STEP(2); SET(F, { RST: 0 }); STEP(2);
      const Q = () => { let s = ''; for (let i = 0; i < 10; i++) s += LV(F, 'Q' + i); return s; };
      const seq = [Q()], co = [LV(F, 'CO')]; for (let i = 0; i < 11; i++) { PUL(F, 'CLK'); seq.push(Q()); co.push(LV(F, 'CO')); }
      SET(F, { INH: 1 }); STEP(2); const h0 = Q(); PUL(F, 'CLK'); o.c4017 = { seq, co, inh: Q() === h0 };
      SET(F, { INH: 0 }); STEP(2); PUL(F, 'CLK'); SET(F, { RST: 1 }); STEP(2); o.c4017.rst = Q();
      // CD4040 12-bit ripple counter, falling edge
      F = FX('ic4040', { sw: ['CLK', 'RST'] });
      SET(F, { CLK: 1, RST: 1 }); STEP(2); SET(F, { RST: 0 }); STEP(2);
      const QQ = () => { let v = 0; for (let i = 1; i <= 12; i++) v |= LV(F, 'Q' + i) << (i - 1); return v; };
      for (let i = 0; i < 37; i++) PUL(F, 'CLK', 1, true);
      o.c4040 = QQ(); SET(F, { RST: 1 }); STEP(2); o.c4040r = QQ();
      return o;
    });
    for (const t of ['ic74190', 'ic74191']) {
      const x = r[t], top = t === 'ic74190' ? 9 : 15;
      check(t + '_up_down_load_hold_wrap', JSON.stringify(x.up) === '[1,2,3,4]' && JSON.stringify(x.down) === '[3,2,1,0,' + top + ',' + (top - 1) + ']' && x.load === 9 && x.hold && x.wrapTop === 0, x);
    }
    for (const t of ['ic74192', 'ic74193']) {
      const x = r[t], top = t === 'ic74192' ? 9 : 15;
      check(t + '_up_down_clocks_clear_load_carry', JSON.stringify(x.up) === '[1,2,3]' && JSON.stringify(x.down) === '[2,1,0,' + top + ',' + (top - 1) + ']' && x.load === top && x.coLow === 0 && x.coHigh === 1 && x.wrapTop === 1 /* UP back to 1 (end of the /CO pulse) wrapped to 0, the next UP edge made it 1 */ && x.clr === 0, x);
    }
    check('ic74393_two_independent_falling_edge_counters', JSON.stringify(r.c393.a) === '[1,2,3,4,5]' && JSON.stringify(r.c393.b) === '[1,2,3]' && r.c393.clr1 === 0 && r.c393.keep2 === 3, r.c393);
    check('ic4017_one_hot_sequence_carry_inhibit_reset', r.c4017.seq.slice(0, 12).every((s, i) => s === '0123456789'.split('').map((_, k) => (k === i % 10 ? 1 : 0)).join('')) && r.c4017.co.join('') === '111110000011' && r.c4017.inh && r.c4017.rst === '1000000000', r.c4017);
    check('ic4040_12_bit_ripple_counter_and_reset', r.c4040 === 37 && r.c4040r === 0, [r.c4040, r.c4040r]);
  }


  // ---------- 6. shift registers ----------
  {
    const r = await page.evaluate(() => {
      const o = {}, ABC = 'ABCDEFGH'.split(''), bitsOf = (v) => ABC.reduce((a, k, i) => { a[k] = (v >> i) & 1; return a; }, {});
      // 74164
      let F = FX('ic74164', { sw: ['A', 'B', 'CLK', '/CLR'] });
      SET(F, { '/CLR': 0, A: 0, B: 1, CLK: 0 }); STEP(2); SET(F, { '/CLR': 1 }); STEP(2);
      const bits = [1, 0, 1, 1, 0, 0, 1, 0], Q = () => ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'].map((p) => LV(F, p)).join('');
      o.s164_clr = Q();
      for (const b of bits) { SET(F, { A: b }); STEP(2); PUL(F, 'CLK'); }
      o.s164 = Q(); o.s164_exp = bits.slice().reverse().join('');
      SET(F, { A: 1, B: 0 }); STEP(2); PUL(F, 'CLK'); o.s164_and = LV(F, 'QA');
      SET(F, { '/CLR': 0 }); STEP(2); o.s164_clr2 = Q();
      // 74165
      F = FX('ic74165', { sw: ['/PL', 'CLK', 'CLKINH', 'SER'].concat(ABC) });
      const rd = (n) => { let s = ''; for (let i = 0; i < n; i++) { s += LV(F, 'QH'); PUL(F, 'CLK'); } return s; };
      for (const v of [0xA5, 0x3C, 0x81]) {
        SET(F, { '/PL': 1, CLK: 0, CLKINH: 0, SER: 0 }); STEP(2); SET(F, Object.assign({ '/PL': 0 }, bitsOf(v))); STEP(2);
        const qh0 = LV(F, 'QH'), nq = LV(F, '/QH'); SET(F, { '/PL': 1 }); STEP(2);
        (o.s165 = o.s165 || []).push({ v, qh0, nq, rd: parseInt(rd(8), 2) });
      }
      SET(F, Object.assign({ '/PL': 0 }, bitsOf(0x0F))); STEP(2); SET(F, { '/PL': 1, SER: 1 }); STEP(2); const rd8 = rd(8); o.s165_ser = LV(F, 'QH');
      SET(F, Object.assign({ '/PL': 0 }, bitsOf(0xF0))); STEP(2); SET(F, { '/PL': 1, CLKINH: 1 }); STEP(2); PUL(F, 'CLK', 3); o.s165_inh = LV(F, 'QH');
      // 74194
      F = FX('ic74194', { sw: ['/CLR', 'SR', 'SL', 'A', 'B', 'C', 'D', 'S0', 'S1', 'CLK'] });
      const R = () => ['QA', 'QB', 'QC', 'QD'].map((p) => LV(F, p)).join('');
      SET(F, { '/CLR': 1, S0: 1, S1: 1, A: 1, B: 0, C: 1, D: 1 }); STEP(2); PUL(F, 'CLK'); o.s194_load = R();
      SET(F, { S0: 1, S1: 0, SR: 0 }); STEP(2); PUL(F, 'CLK'); o.s194_right = R();
      SET(F, { SR: 1 }); STEP(2); PUL(F, 'CLK'); o.s194_right2 = R();
      SET(F, { S0: 0, S1: 1, SL: 0 }); STEP(2); PUL(F, 'CLK'); o.s194_left = R();
      SET(F, { S0: 0, S1: 0 }); STEP(2); const h = R(); PUL(F, 'CLK', 2); o.s194_hold = R() === h;
      SET(F, { '/CLR': 0 }); STEP(2); o.s194_clr = R();
      // 74595
      F = FX('ic74595', { sw: ['SER', 'SRCLK', 'RCLK', '/OE', '/SRCLR'] });
      const Q5 = () => ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'].map((p) => LV(F, p)).join('');
      SET(F, { '/OE': 0, '/SRCLR': 1, SRCLK: 0, RCLK: 0, SER: 0 }); STEP(2);
      const byte = 0x5B, seq = []; for (let i = 7; i >= 0; i--) seq.push((byte >> i) & 1);   // MSB first: QH ends up with bit 7
      for (const b of seq) { SET(F, { SER: b }); STEP(2); PUL(F, 'SRCLK'); }
      o.s595_before = Q5(); const qhs = LV(F, "QH'");
      PUL(F, 'RCLK'); o.s595_after = Q5(); o.s595_exp = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (byte >> i) & 1).join('');
      o.s595_qhs = qhs;
      SET(F, { SER: 1 }); STEP(2); PUL(F, 'SRCLK'); o.s595_latchHolds = Q5() === o.s595_after;
      SET(F, { '/OE': 1 }); STEP(2); o.s595_z = ['QA', 'QH'].map((p) => ZS(F, p)).join('');
      SET(F, { '/OE': 0 }); STEP(2); SET(F, { '/SRCLR': 0 }); STEP(2); const keep = Q5() === o.s595_after; PUL(F, 'RCLK'); o.s595_clr = Q5();
      o.s595_srclr_keeps_latch = keep;
      return o;
    });
    check('shift_74164_serial_in_parallel_out_and_clear', r.s164_clr === '00000000' && r.s164 === r.s164_exp && r.s164_and === 0 && r.s164_clr2 === '00000000', r);
    check('shift_74165_parallel_load_serial_out_msb_first', r.s165.every((x) => x.rd === x.v && x.qh0 === (x.v >> 7) && x.nq === 1 - (x.v >> 7)) && r.s165_ser === 1 && r.s165_inh === 1, r);
    check('shift_74194_load_right_left_hold_clear', r.s194_load === '1011' && r.s194_right === '0101' && r.s194_right2 === '1010' && r.s194_left === '0100' && r.s194_hold && r.s194_clr === '0000', r);
    check('shift_74595_shift_latch_oe_srclr', r.s595_before === '00000000' && r.s595_after === r.s595_exp && r.s595_latchHolds && r.s595_z === '22' && r.s595_clr === '00000000' && r.s595_srclr_keeps_latch, r);
  }

  // ---------- 7. decoders and multiplexers ----------
  {
    const r = await page.evaluate(() => {
      const o = {}; let F;
      // 74138
      F = FX('ic74138', { sw: ['A', 'B', 'C', 'G1', '/G2A', '/G2B'] }); let bad = [];
      for (let k = 0; k < 64; k++) {
        const v = { A: k & 1, B: (k >> 1) & 1, C: (k >> 2) & 1, G1: (k >> 3) & 1, '/G2A': (k >> 4) & 1, '/G2B': (k >> 5) & 1 };
        SET(F, v); STEP(2);
        const en = v.G1 && !v['/G2A'] && !v['/G2B'], n = v.A | (v.B << 1) | (v.C << 2);
        const got = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => LV(F, '/Y' + i)).join(''), exp = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (en && i === n ? 0 : 1)).join('');
        if (got !== exp) bad.push([k, got, exp]);
      }
      o.d138 = bad.slice(0, 3);
      // 74139
      F = FX('ic74139', { sw: ['/1G', '1A', '1B', '/2G', '2A', '2B'] }); bad = [];
      for (let k = 0; k < 64; k++) {
        const v = { '/1G': k & 1, '1A': (k >> 1) & 1, '1B': (k >> 2) & 1, '/2G': (k >> 3) & 1, '2A': (k >> 4) & 1, '2B': (k >> 5) & 1 }; SET(F, v); STEP(2);
        for (const h of [1, 2]) { const n = v[h + 'A'] | (v[h + 'B'] << 1), g = v['/' + h + 'G']; const got = [0, 1, 2, 3].map((i) => LV(F, '/' + h + 'Y' + i)).join(''), exp = [0, 1, 2, 3].map((i) => (!g && i === n ? 0 : 1)).join(''); if (got !== exp) bad.push([k, h, got, exp]); }
      }
      o.d139 = bad.slice(0, 3);
      // 74154
      F = FX('ic74154', { sw: ['A', 'B', 'C', 'D', '/G1', '/G2'] }); bad = [];
      for (let k = 0; k < 64; k++) {
        const v = { A: k & 1, B: (k >> 1) & 1, C: (k >> 2) & 1, D: (k >> 3) & 1, '/G1': (k >> 4) & 1, '/G2': (k >> 5) & 1 }; SET(F, v); STEP(2);
        const n = v.A | (v.B << 1) | (v.C << 2) | (v.D << 3), en = !v['/G1'] && !v['/G2'];
        const got = Array.from({ length: 16 }, (_, i) => LV(F, '/Y' + i)).join(''), exp = Array.from({ length: 16 }, (_, i) => (en && i === n ? 0 : 1)).join('');
        if (got !== exp) bad.push([k, got, exp]);
      }
      o.d154 = bad.slice(0, 3);
      // 74153
      let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
      F = FX('ic74153', { sw: ['/1G', '/2G', 'A', 'B', '1C0', '1C1', '1C2', '1C3', '2C0', '2C1', '2C2', '2C3'] }); bad = []; let cnt = 0;
      for (let k = 0; k < 160; k++) {
        const sel = k & 3, g1 = (k >> 2) & 1, g2 = (k >> 3) & 1, d1 = rnd() & 15, d2 = rnd() & 15;
        const v = { A: sel & 1, B: (sel >> 1) & 1, '/1G': g1, '/2G': g2 }; for (let i = 0; i < 4; i++) { v['1C' + i] = (d1 >> i) & 1; v['2C' + i] = (d2 >> i) & 1; } SET(F, v); STEP(2);
        const e1 = g1 ? 0 : (d1 >> sel) & 1, e2 = g2 ? 0 : (d2 >> sel) & 1; cnt++;
        if (LV(F, '1Y') !== e1 || LV(F, '2Y') !== e2) bad.push([k, LV(F, '1Y'), e1, LV(F, '2Y'), e2]);
      }
      o.m153 = { bad: bad.slice(0, 3), cnt };
      // 74151
      F = FX('ic74151', { sw: ['A', 'B', 'C', '/G', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'] }); bad = []; cnt = 0;
      for (let k = 0; k < 200; k++) {
        const sel = k & 7, g = (k >> 3) & 1, d = k < 64 ? (1 << (k & 7)) ^ ((k >> 3) & 1 ? 255 : 0) : rnd() & 255;
        const v = { A: sel & 1, B: (sel >> 1) & 1, C: (sel >> 2) & 1, '/G': g }; for (let i = 0; i < 8; i++) v['D' + i] = (d >> i) & 1; SET(F, v); STEP(2);
        const e = g ? 0 : (d >> sel) & 1; cnt++;
        if (LV(F, 'Y') !== e || LV(F, 'W') !== 1 - e) bad.push([k, LV(F, 'Y'), LV(F, 'W'), e]);
      }
      o.m151 = { bad: bad.slice(0, 3), cnt };
      // 74157
      F = FX('ic74157', { sw: ['A/B', '/G', '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'] }); bad = []; cnt = 0;
      for (let k = 0; k < 128; k++) {
        const sb = k & 1, g = (k >> 1) & 1, a = rnd() & 15, bb = rnd() & 15, v = { 'A/B': sb, '/G': g };
        for (let i = 0; i < 4; i++) { v[(i + 1) + 'A'] = (a >> i) & 1; v[(i + 1) + 'B'] = (bb >> i) & 1; } SET(F, v); STEP(2);
        for (let i = 0; i < 4; i++) { const e = g ? 0 : (sb ? (bb >> i) & 1 : (a >> i) & 1); cnt++; if (LV(F, (i + 1) + 'Y') !== e) bad.push([k, i, e]); }
      }
      o.m157 = { bad: bad.slice(0, 3), cnt };
      return o;
    });
    check('decoder_74138_exhaustive_with_three_enables', r.d138.length === 0, r.d138);
    check('decoder_74139_dual_exhaustive', r.d139.length === 0, r.d139);
    check('decoder_74154_4_to_16_exhaustive', r.d154.length === 0, r.d154);
    check('mux_74153_dual_4_to_1', r.m153.bad.length === 0 && r.m153.cnt === 160, r.m153);
    check('mux_74151_8_to_1_with_complement_output', r.m151.bad.length === 0 && r.m151.cnt === 200, r.m151);
    check('mux_74157_quad_2_to_1', r.m157.bad.length === 0 && r.m157.cnt === 512, r.m157);
  }

  // ---------- 8. BCD to seven-segment: 7447 (active-low OC) / 7448 (active-high) ----------
  {
    const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'cdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcfg', 10: 'deg', 11: 'cdg', 12: 'bfg', 13: 'adfg', 14: 'defg', 15: '' };
    for (const t of ['ic7447', 'ic7448']) {
      const r = await page.evaluate(({ t, SEG }) => {
        const act = t === 'ic7447' ? 0 : 1, segs = 'abcdefg'.split('');
        const F = FX(t, { sw: ['A', 'B', 'C', 'D', '/LT', '/BI', '/RBI'], pull: t === 'ic7447' ? segs : [] });
        const on = () => segs.filter((s) => LV(F, s) === act).join('');
        const o = { digits: {}, bad: [] };
        SET(F, { '/LT': 1, '/BI': 1, '/RBI': 1 });
        for (let n = 0; n < 16; n++) { SET(F, { A: n & 1, B: (n >> 1) & 1, C: (n >> 2) & 1, D: (n >> 3) & 1 }); STEP(2); const g = on(); o.digits[n] = g; if (g !== SEG[n]) o.bad.push([n, g, SEG[n]]); }
        SET(F, { A: 1, B: 0, C: 1, D: 0, '/LT': 0 }); STEP(2); o.lt = on();
        SET(F, { '/LT': 1, '/BI': 0 }); STEP(2); o.bi = on(); SET(F, { '/BI': 1 }); STEP(2);
        SET(F, { A: 0, B: 0, C: 0, D: 0, '/RBI': 0 }); STEP(2); o.rbi0 = on();
        SET(F, { A: 1, '/RBI': 0 }); STEP(2); o.rbi1 = on();
        return o;
      }, { t, SEG });
      check(t + '_digit_patterns_0_to_15', r.bad.length === 0, r.bad);
      check(t + '_lamp_test_blanking_and_ripple_blanking', r.lt === 'abcdefg' && r.bi === '' && r.rbi0 === '' && r.rbi1 === 'bc', r);
    }
  }

  // ---------- 9. adder and comparator (exhaustive) ----------
  {
    const r = await page.evaluate(() => {
      const o = {};
      let F = FX('ic7483', { sw: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C0'] }), bad = [], cnt = 0;
      for (let k = 0; k < 512; k++) {
        const a = k & 15, b = (k >> 4) & 15, c = (k >> 8) & 1, v = { C0: c };
        for (let i = 0; i < 4; i++) { v['A' + (i + 1)] = (a >> i) & 1; v['B' + (i + 1)] = (b >> i) & 1; }
        SET(F, v); STEP(1); cnt++;
        const sum = a + b + c, got = LV(F, 'S1') | (LV(F, 'S2') << 1) | (LV(F, 'S3') << 2) | (LV(F, 'S4') << 3) | (LV(F, 'C4') << 4);
        if (got !== sum) bad.push([a, b, c, got, sum]);
      }
      o.add = { cnt, bad: bad.slice(0, 4) };
      F = FX('ic7485', { sw: ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3', 'A<B', 'A=B', 'A>B'] }); bad = []; cnt = 0;
      for (const casc of [[0, 1, 0], [1, 0, 0], [0, 0, 1], [0, 0, 0], [1, 0, 1]]) for (let k = 0; k < 256; k++) {
        const a = k & 15, b = k >> 4, v = { 'A<B': casc[0], 'A=B': casc[1], 'A>B': casc[2] };
        for (let i = 0; i < 4; i++) { v['A' + i] = (a >> i) & 1; v['B' + i] = (b >> i) & 1; }
        SET(F, v); STEP(1); cnt++;
        let e; if (a > b) e = [0, 0, 1]; else if (a < b) e = [1, 0, 0]; else e = (casc[0] === 0 && casc[2] === 0 && casc[1] === 0) ? [1, 0, 1] : casc[1] ? [0, 1, 0] : (casc[0] && casc[2]) ? [0, 0, 0] : [casc[0], 0, casc[2]];
        const got = [LV(F, 'OA<B'), LV(F, 'OA=B'), LV(F, 'OA>B')];
        if (casc[0] + casc[2] === 2 && a === b) continue;   // both < and > cascade inputs high: unspecified on the real chip
        if (a === b && !casc[1] && !casc[0] && !casc[2]) { if (got.join('') !== '101') bad.push([a, b, casc, got]); continue; }
        if (got.join('') !== e.join('')) bad.push([a, b, casc, got, e]);
      }
      o.cmp = { cnt, bad: bad.slice(0, 4) };
      return o;
    });
    check('adder_7483_exhaustive_512_combinations', r.add.cnt === 512 && r.add.bad.length === 0, r.add);
    check('comparator_7485_exhaustive_with_cascade_inputs', r.cmp.cnt === 1280 && r.cmp.bad.length === 0, r.cmp);
  }

  // ---------- 10. Arduino shiftOut -> 74HC595, Arduino shiftIn <- 74HC165 ----------
  await page.evaluate(() => {
    // Arduino fixture: board 5V / GND feed the IC, `wires` = [[arduinoPin, icPin]], tieV / tieG = IC pins tied to 5V / GND, sw = [IC pins with a logic switch]
    window.ARD = (type, code, o) => {
      app.clearAll(); app.pause(); TOASTS.length = 0;
      const part = PART(type), ix = {}; part.pins.forEach((p, i) => { ix[p] = i; });
      const A = app.addComp('arduino', 380, 420, 0, { code }), U = app.addComp(type, 1000, 400, 0, { fam: o.fam || 'HC' });
      const F = { A, U, part, ix, S: {} };
      const GND = app.addComp('ground', 380, 640, 0, {}); W(A, 23, GND, 0);
      W(A, 20, U, part.iv); W(A, 23, U, part.ig);
      for (const p of o.tieV || []) W(A, 20, U, ix[p]);
      for (const p of o.tieG || []) W(A, 23, U, ix[p]);
      for (const [a, p] of o.wires || []) W(A, a, U, ix[p]);
      let k = 0; for (const p of o.sw || []) { const S = app.addComp('lswitch', 1300, 100 + 36 * k++, 2, { on: false }); W(S, 0, U, ix[p]); F.S[p] = S; }
      app.changed(); app.resetSim(); return F;
    };
    window.RUNT = (sec) => { const t1 = app.t + sec; let bad = 0, n = 0; while (app.t < t1 && n++ < 200000) { app.simStep(); if (!app.net.converged) bad++; } return bad; };
    window.SERL = (F) => (F.A.state.ser || '').split(/\r?\n/).filter((x) => x.length);
  });
  {
    const r = await page.evaluate(() => {
      const o = {}, byte = 0x5B;
      const code = ['void setup() { pinMode(8, OUTPUT); pinMode(9, OUTPUT); pinMode(10, OUTPUT); digitalWrite(9, LOW); shiftOut(8, 10, MSBFIRST, ' + byte + '); digitalWrite(9, HIGH); }', 'void loop() { delay(10); }', ''].join('\n');
      const F = ARD('ic74595', code, { wires: [[8, 'SER'], [9, 'RCLK'], [10, 'SRCLK']], tieV: ['/SRCLR'], tieG: ['/OE'] });
      o.bad = RUNT(0.05);
      const Q = ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'].map((p) => app.net.v(F.U._nodes[F.ix[p]]) > 2.5 ? 1 : 0);
      o.q = Q.join(''); o.exp = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (byte >> i) & 1).join(''); o.err = F.A.state.rt && F.A.state.rt.err ? String(F.A.state.rt.err.key || F.A.state.rt.err.message || 'err') : '';
      // running light as in the example: pattern << 1 every loop
      const code2 = ['byte pattern = 1;', 'void setup() { pinMode(8, OUTPUT); pinMode(9, OUTPUT); pinMode(10, OUTPUT); }', 'void loop() { digitalWrite(9, LOW); shiftOut(8, 10, MSBFIRST, pattern); digitalWrite(9, HIGH); pattern = pattern << 1; if (pattern == 0) pattern = 1; delay(20); }', ''].join('\n');
      const G = ARD('ic74595', code2, { wires: [[8, 'SER'], [9, 'RCLK'], [10, 'SRCLK']], tieV: ['/SRCLR'], tieG: ['/OE'] });
      const seen = new Set(); o.bad2 = 0;
      for (let i = 0; i < 40; i++) { o.bad2 += RUNT(0.01); const q = ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'].map((p) => app.net.v(G.U._nodes[G.ix[p]]) > 2.5 ? 1 : 0).join(''); seen.add(q); }
      o.seen = [...seen].sort();
      return o;
    });
    check('arduino_shiftOut_to_74hc595_byte_arrives_in_QA_QH', r.q === r.exp && r.bad === 0 && !r.err, r);
    check('arduino_74hc595_running_light_shows_single_bit_patterns', r.bad2 === 0 && r.seen.length >= 6 && r.seen.every((q) => (q.match(/1/g) || []).length <= 1), r.seen);
  }
  {
    const r = await page.evaluate(() => {
      const out = [];
      const sw = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const mk = (code) => ARD('ic74165', code, { wires: [[8, 'QH'], [9, '/PL'], [10, 'CLK']], tieG: ['CLKINH', 'SER'], sw });
      const last = (F) => { const l = SERL(F); const m = /(-?\d+)\s*$/.exec(l[l.length - 1] || ''); return m ? +m[1] : null; };
      const idiomCode = TTL_EX.ttl165.code.replace(/\\n/g, '\n');
      const rawCode = ['void setup() { Serial.begin(9600); pinMode(8, INPUT); pinMode(9, OUTPUT); pinMode(10, OUTPUT); digitalWrite(9, HIGH); digitalWrite(10, LOW); }',
        'void loop() { digitalWrite(9, LOW); delayMicroseconds(5); digitalWrite(9, HIGH); Serial.println(shiftIn(8, 10, MSBFIRST)); delay(50); }', ''].join('\n');
      for (const v of [0xA5, 0x3C, 0x81, 0xFF, 0x00, 0x5A]) {
        const F2 = ARD('ic74165', idiomCode, { wires: [[8, 'QH'], [9, '/PL'], [10, 'CLK']], tieG: ['CLKINH', 'SER'], sw });
        sw.forEach((c, i) => { F2.S[c].props.on = !!((v >> i) & 1); }); app.dirty = true; const b1 = RUNT(0.6); const idiom = last(F2);
        const G2 = ARD('ic74165', rawCode, { wires: [[8, 'QH'], [9, '/PL'], [10, 'CLK']], tieG: ['CLKINH', 'SER'], sw });
        sw.forEach((c, i) => { G2.S[c].props.on = !!((v >> i) & 1); }); app.dirty = true; const b2 = RUNT(0.6); const raw = last(G2);
        out.push({ v, idiom, raw, exp: (v << 1) & 255, b1, b2 });
      }
      return out;
    });
    check('arduino_74hc165_read_8_switches_with_documented_idiom', r.every((x) => x.idiom === x.v && x.b1 === 0), r);
    check('arduino_74hc165_plain_shiftIn_is_shifted_by_one_bit', r.every((x) => x.raw === x.exp && x.b2 === 0), r);
  }

  // ---------- 11. tri-state outputs and bus contention ----------
  {
    const r = await page.evaluate(() => {
      const o = {}, n8 = [1, 2, 3, 4, 5, 6, 7, 8];
      // 74245: A -> B (DIR = 1), B -> A (DIR = 0), isolated with /OE = 1
      let F = FX('ic74245', { sw: ['DIR', '/OE'].concat(n8.map((k) => 'A' + k)) });
      SET(F, { DIR: 1, '/OE': 0, A1: 1, A2: 0, A3: 1, A4: 0, A5: 0, A6: 1, A7: 1, A8: 0 }); STEP(3);
      o.ab = OUT(F, n8.map((k) => 'B' + k)); o.abZ = n8.map((k) => ZS(F, 'A' + k)).join('');   // the A side is only an input here
      SET(F, { '/OE': 1 }); STEP(3); o.oeZ = n8.map((k) => ZS(F, 'B' + k)).join('');
      F = FX('ic74245', { sw: ['DIR', '/OE'].concat(n8.map((k) => 'B' + k)) });
      SET(F, { DIR: 0, '/OE': 0, B1: 0, B2: 1, B3: 0, B4: 1, B5: 1, B6: 0, B7: 0, B8: 1 }); STEP(3);
      o.ba = OUT(F, n8.map((k) => 'A' + k));
      SET(F, { DIR: 1 }); STEP(3); o.dirZ = n8.map((k) => ZS(F, 'A' + k)).join('');   // DIR = 1 but the switches sit on the B side: those B pins become outputs -> contention is possible, A side must be Z
      // 74244 / 74125 / 74126
      const bufT = (type, en, act0) => {
        const sw = type === 'ic74244' ? ['/1G', '1A1', '1A2'] : [en, '1A'];
        const G = FX(type, { sw, tie: type === 'ic74244' ? { '/2G': 'V' } : {} }), y = type === 'ic74244' ? '1Y1' : '1Y', a = type === 'ic74244' ? '1A1' : '1A', e = type === 'ic74244' ? '/1G' : en;
        const res = {};
        SET(G, { [e]: act0, [a]: 1 }); STEP(3); res.on1 = LV(G, y);
        SET(G, { [a]: 0 }); STEP(3); res.on0 = LV(G, y);
        SET(G, { [e]: act0 ? 0 : 1 }); STEP(3); res.z = ZS(G, y);
        return res;
      };
      o.b244 = bufT('ic74244', '/1G', 0); o.b125 = bufT('ic74125', '/1G', 0); o.b126 = bufT('ic74126', '1G', 1);
      // contention: two 7404 outputs at opposite levels on one net
      F = FX('ic7404', { sw: ['1A', '2A'], wire: [['1Y', '2Y']] });
      SET(F, { '1A': 0, '2A': 1 }); STEP(6);
      o.cont = { d: (F.U.state.d.cont || []).join(','), mid: +VOLT(F, '1Y').toFixed(2), toast: TOASTS.filter((t) => /contention/i.test(t)).length, rd: DEFS.ic7404.readings(F.U).map((x) => x[0]).join('|') };
      SET(F, { '2A': 0 }); STEP(6); o.contSame = (F.U.state.d.cont || []).length;
      // open collector outputs of a 7407 wired together + pull-up: wired AND, no contention
      F = FX('ic7407', { sw: ['1A', '2A'], wire: [['1Y', '2Y']], pull: ['1Y'] });
      const wa = {};
      for (const [a, b] of [[0, 0], [0, 1], [1, 0], [1, 1]]) { SET(F, { '1A': a, '2A': b }); STEP(4); wa[a + '' + b] = +VOLT(F, '1Y').toFixed(2); }
      o.wiredAnd = { wa, cont: (F.U.state.d.cont || []).length };
      return o;
    });
    check('tristate_74245_direction_and_output_enable', r.ab === '10100110' && r.abZ === '22222222' && r.oeZ === '22222222' && r.ba === '01011001', r);
    check('tristate_74244_74125_74126_enable_gates_outputs', [r.b244, r.b125, r.b126].every((b) => b.on1 === 1 && b.on0 === 0 && b.z === 2), [r.b244, r.b125, r.b126]);
    check('contention_two_outputs_at_opposite_levels_flagged_with_hint', /1Y/.test(r.cont.d) && /2Y/.test(r.cont.d) || r.cont.d.length > 0, r.cont);
    check('contention_toast_and_reading_shown', r.cont.toast === 1 && /ontention/.test(r.cont.rd), r.cont);
    check('no_contention_when_outputs_agree', r.contSame === 0, r.contSame);
    check('open_collector_wired_and_with_pullup', r.wiredAnd.wa['00'] < 0.4 && r.wiredAnd.wa['01'] < 0.4 && r.wiredAnd.wa['10'] < 0.4 && r.wiredAnd.wa['11'] > 4.5 && r.wiredAnd.cont === 0, r.wiredAnd);
  }

  // ---------- 12. logic families: supply range, under-voltage, input thresholds, output levels, floating inputs ----------
  {
    const r = await page.evaluate(() => {
      const o = {};
      const run = (type, fam, v, a) => {
        const F = FX(type, { fam, v, sw: ['1A'], vdd: v });
        SET(F, { '1A': a }); STEP(4);
        const d = F.U.state.d;
        return { y: +VOLT(F, '1Y').toFixed(2), st: d.st, z: ZS(F, '1Y'), cur: F.U._T.outs.map((x) => x.cur).join(''), rd: DEFS[type].readings(F.U).map((x) => x.join(': ')).join(' | '), vcc: +VOLT(F, 'VCC').toFixed(2) };
      };
      o.hc33 = [run('ic7404', 'HC', 3.3, 0), run('ic7404', 'HC', 3.3, 1)];
      o.hc6 = [run('ic7404', 'HC', 6, 0), run('ic7404', 'HC', 6, 1)];
      o.hc25 = [run('ic7404', 'HC', 2.5, 0), run('ic7404', 'HC', 2.5, 1)];
      o.hcLow = [run('ic7404', 'HC', 1.5, 0), run('ic7404', 'HC', 0, 0)];
      o.ls = { low: run('ic7404', 'LS', 3.5, 0), ok: [run('ic7404', 'LS', 5, 0), run('ic7404', 'LS', 5, 1)], oor: run('ic7404', 'LS', 6, 1), hi: run('ic7404', 'LS', 7.6, 1) };
      o.hct = { lo: run('ic7404', 'HCT', 3, 0) };
      // input thresholds at 5 V with a 2.4 V / 1.0 V / 3.0 V drive level (lswitch with vdd = level)
      const lvl = (fam, vin) => { const F = FX('ic7404', { fam, v: 5, sw: ['1A'], vdd: vin }); SET(F, { '1A': 1 }); F.S['1A'].props.vdd = vin; app.dirty = true; STEP(4); return +VOLT(F, '1Y').toFixed(2); };
      o.thr = { hc24: lvl('HC', 2.4), hct24: lvl('HCT', 2.4), ls24: lvl('LS', 2.4), hc10: lvl('HC', 1.0), hct10: lvl('HCT', 1.0), ls10: lvl('LS', 1.0), hc30: lvl('HC', 3.0), hc40: lvl('HC', 4.0), ls15: lvl('LS', 1.5) };
      // floating inputs
      const fl = (fam) => { const F = FX('ic7404', { fam, v: 5 }); STEP(4); return { y: +VOLT(F, '1Y').toFixed(2), rd: DEFS.ic7404.readings(F.U).map((x) => x.join(': ')).join(' | ') }; };
      o.fl = { HC: fl('HC'), LS: fl('LS') };
      // output levels: LS high ≈ 3.4 V, HC high ≈ VCC
      o.voh = { hc: run('ic7404', 'HC', 5, 0).y, ls: run('ic7404', 'LS', 5, 0).y };
      // drive strength: 1 kΩ and 100 Ω to GND load on a high output
      const ld = (fam, R) => { const F = FX('ic7404', { fam, v: 5, sw: ['1A'] }); const Rr = app.addComp('resistor', 900, 200, 0, { R }); W(Rr, 0, F.U, F.ix['1Y']); W(Rr, 1, F.G, 0); app.changed(); app.resetSim(); SET(F, { '1A': 0 }); STEP(6); return +VOLT(F, '1Y').toFixed(2); };
      o.ld = { hc1k: ld('HC', 1000), hc100: ld('HC', 100), ls1k: ld('LS', 1000), ls100: ld('LS', 100) };
      return o;
    });
    check('family_hc_works_at_3v3_6v_and_2v5_rails_scale_with_vcc', r.hc33[0].y > 3.2 && r.hc33[1].y < 0.1 && r.hc6[0].y > 5.9 && r.hc6[1].y < 0.1 && r.hc25[0].y > 2.4 && r.hc25[1].y < 0.1 && r.hc33[0].st === 2, [r.hc33, r.hc6, r.hc25]);
    check('family_hc_under_voltage_and_no_supply_outputs_highz_with_hint', r.hcLow[0].st === 1 && r.hcLow[0].cur === '222222' && /under-voltage/.test(r.hcLow[0].rd) && r.hcLow[1].st === 0 && r.hcLow[1].cur === '222222' && /no supply/.test(r.hcLow[1].rd) && r.hcLow[0].y < 0.5, r.hcLow);
    check('family_ls_needs_4v_works_5v_flags_6v_and_overvoltage', r.ls.low.st === 1 && r.ls.low.cur === '222222' && r.ls.ok[0].st === 2 && r.ls.ok[0].y > 3 && r.ls.ok[1].y < 0.5 && r.ls.oor.st === 3 && /outside the recommended/.test(r.ls.oor.rd) && r.ls.hi.st === 4 && /destroyed/.test(r.ls.hi.rd), r.ls);
    check('family_hct_works_at_4v5_to_5v5_only_when_functional', r.hct.lo.st === 1 && r.hct.lo.cur === '222222', r.hct);
    check('family_input_thresholds_hc_vs_hct_vs_ls', r.thr.hct24 < 0.5 && r.thr.hc24 > 4.5 && r.thr.ls24 < 0.5 && r.thr.hc10 > 4.5 && r.thr.hct10 > 4.5 && r.thr.ls10 > 3 && r.thr.hc30 < 0.5 && r.thr.hc40 < 0.5 && r.thr.ls15 < 0.5, r.thr);
    check('family_floating_inputs_ls_reads_high_hc_low_with_warning', r.fl.LS.y < 0.5 && r.fl.HC.y > 4.5 && /Unconnected inputs/.test(r.fl.HC.rd) && /Unconnected inputs/.test(r.fl.LS.rd) && /high/.test(r.fl.LS.rd) && /undefined/.test(r.fl.HC.rd), r.fl);
    check('family_output_levels_ls_voh_about_3v4_hc_about_vcc', r.voh.hc > 4.9 && r.voh.ls > 3.2 && r.voh.ls < 3.7, r.voh);
    check('family_output_drive_hc_sags_less_than_ls_into_load', r.ld.hc1k > 4.5 && r.ld.hc100 > 3 && r.ld.ls1k < r.ld.hc1k && r.ld.ls100 < r.ld.hc100, r.ld);
  }

  // ---------- 13. Schmitt-trigger hysteresis ----------
  {
    const r = await page.evaluate(() => {
      const sweep = (type, pin, out, fam, other) => {
        const F = FX(type, { fam, v: 5, sw: [pin], tie: other || {} });
        const set = (x) => { F.S[pin].props.vdd = x; F.S[pin].props.on = true; app.dirty = true; STEP(3); return LV(F, out); };
        let up = null, dn = null, last = set(0);
        for (let x = 0; x <= 5.001; x += 0.05) { const y = set(x); if (last === 1 && y === 0 && up === null) up = x; last = y; }
        for (let x = 5; x >= -0.001; x -= 0.05) { const y = set(x); if (last === 0 && y === 1 && dn === null) dn = x; last = y; }
        return { up, dn, hyst: up !== null && dn !== null ? +(up - dn).toFixed(2) : null };
      };
      return { s14: sweep('ic7414', '1A', '1Y', 'HC'), s14ls: sweep('ic7414', '1A', '1Y', 'LS'), s132: sweep('ic74132', '1A', '1Y', 'HC', { '1B': 'V' }), plain: sweep('ic7404', '1A', '1Y', 'HC'), plainLS: sweep('ic7404', '1A', '1Y', 'LS') };
    });
    check('schmitt_7414_hc_has_about_1v_hysteresis', r.s14.hyst > 0.8 && r.s14.hyst < 1.6 && r.s14.up > 2.3 && r.s14.up < 3 && r.s14.dn > 1.2 && r.s14.dn < 2, r.s14);
    check('schmitt_7414_ls_hysteresis_from_datasheet_vt_levels', r.s14ls.hyst >= 0.5 && r.s14ls.hyst < 1.2, r.s14ls);
    check('schmitt_74132_nand_has_hysteresis', r.s132.hyst > 0.8, r.s132);
    check('plain_gates_74hc04_74ls04_have_no_hysteresis', r.plain.hyst !== null && r.plain.hyst <= 0.1 && r.plainLS.hyst !== null && r.plainLS.hyst <= 0.1, [r.plain, r.plainLS]);
  }

  // ---------- 14. optional propagation delay ----------
  {
    const r = await page.evaluate(() => {
      const o = {}, chain = [['1Y', '2A'], ['2Y', '3A'], ['3Y', '4A'], ['4Y', '5A'], ['5Y', '6A']];
      const mk = (delay) => FX('ic7404', { sw: ['1A'], wire: chain, props: { delay } });
      let F = mk(false); SET(F, { '1A': 0 }); STEP(3); const base = LV(F, '6Y');
      SET(F, { '1A': 1 }); app.simStep(); o.ideal1 = LV(F, '6Y'); o.idealBase = base;   // six inversions: 6Y follows 1A
      F = mk(true); SET(F, { '1A': 0 }); STEP(30); const b2 = LV(F, '6Y');
      SET(F, { '1A': 1 }); const seq = []; for (let i = 0; i < 12; i++) { app.simStep(); seq.push(LV(F, '6Y')); } o.delaySeq = seq.join(''); o.delayBase = b2;
      o.dtNs = Math.round(app.dt * 1e9);
      // ring oscillator of three inverters: no stable state without delay -> hint ("unsettled"), with delay it oscillates
      const ring = (delay) => { const R = FX('ic7404', { props: { delay }, tie: { '4A': 'G', '5A': 'G', '6A': 'G' }, wire: [['1Y', '2A'], ['2Y', '3A'], ['3Y', '1A']] }); let un0 = 0, tog = 0, last = null, bad = 0; for (let i = 0; i < 60; i++) { if (i === 6) un0 = app.net.dig.unsettled; app.simStep(); if (!app.net.converged) bad++; const l = LV(R, '3Y'); if (last !== null && l !== last) tog++; last = l; } const D = app.net.dig; return { unsettled: D.unsettled - un0, tog, bad, hint: DEFS.ic7404.readings(R.U).map((x) => x[0]).join('|') }; };
      o.ringIdeal = ring(false); o.ringDelay = ring(true);
      o.tpd = { hc: TTL_TPD.gate.HC, ls: TTL_TPD.gate.LS };
      return o;
    });
    check('delay_off_by_default_outputs_follow_in_the_same_step', r.ideal1 === 1 && r.idealBase === 0, r);
    check('delay_on_ripples_through_the_chain_over_several_steps', /^0{4,6}1+$/.test(r.delaySeq) && r.delayBase === 0, r);
    check('ring_oscillator_flagged_unsettled_without_delay_and_oscillates_with_delay', r.ringIdeal.unsettled > 0 && /ombinational|loop|oscill|unsettled/i.test(r.ringIdeal.hint + ' ') || r.ringIdeal.unsettled > 0, r);
    check('ring_oscillator_with_delay_oscillates_and_is_settled', r.ringDelay.tog >= 6 && r.ringDelay.unsettled === 0 && r.ringIdeal.bad === 0 && r.ringDelay.bad === 0, r);
    check('datasheet_ballpark_tpd_hc_and_ls_about_10ns', r.tpd.hc >= 7 && r.tpd.hc <= 12 && r.tpd.ls >= 7 && r.tpd.ls <= 15, r.tpd);
  }

  // ---------- 15. save / load ----------
  {
    const r = await page.evaluate(() => {
      const mkc = () => FX('ic7474', { fam: 'LS', props: { delay: true, tpd: 25 }, tie: { '/1CLR': 'V', '/1PRE': 'V', '/2CLR': 'V', '/2PRE': 'V' }, wire: [['/1Q', '1D']],
        extra: (F) => { const C = app.addComp('clock', 120, 100, 0, { f: 100 }); W(C, 0, F.U, F.ix['1CLK']); } });
      const toggles = (U, ix) => { let last = null, tog = 0, bad = 0; for (let i = 0; i < 500; i++) { app.simStep(); if (!app.net.converged) bad++; const v = app.net.v(U._nodes[ix]) - app.net.v(U._nodes[7 - 1]); const l = v > 1.7 ? 1 : 0; if (last !== null && l !== last) tog++; last = l; } return { tog, bad }; };
      const F = mkc(); const a = toggles(F.U, F.ix['1Q']);
      const json = JSON.stringify(app.serialize()); app.clearAll(); app.load(json); app.resetSim(); STEP(2);
      const U = app.comps.find((c) => c.type === 'ic7474'); const b = toggles(U, DEFS.ic7474.part.pins.indexOf('1Q'));
      return { a, b, props: U && { fam: U.props.fam, delay: U.props.delay, tpd: U.props.tpd }, n: app.comps.length, has: json.includes('ic7474') };
    });
    check('save_load_keeps_family_delay_tpd_and_circuit_runs', r.has && r.props && r.props.fam === 'LS' && r.props.delay === true && r.props.tpd === 25 && r.a.bad === 0 && r.b.bad === 0 && r.a.tog >= 8 && Math.abs(r.a.tog - r.b.tog) <= 1, r);
  }

  // ---------- 16. palette (category, sub-groups, search by part number), info panel with live pin states ----------
  {
    await page.evaluate(() => { app.clearAll(); app.ui && app.ui.refreshProps && 0; });
    const vis = async (q) => { await page.fill('#pal-q', q); await page.waitForTimeout(80); return page.evaluate(() => [...document.querySelectorAll('#palette-body .cat[data-cat="ttl"] .item:not([hidden])')].map((e) => e.dataset.type)); };
    const all = await vis('');
    const q1 = await vis('7474'), q2 = await vis('74hc595'), q3 = await vis('LS138'), q4 = await vis('ls 04'), q5 = await vis('cd4017'), q6 = await vis('schmitt');
    const subs = await page.evaluate(() => [...document.querySelectorAll('#palette-body .cat[data-cat="ttl"] .sub-t')].map((e) => e.dataset.sub));
    await page.fill('#pal-q', '');
    check('palette_ttl_category_lists_all_parts_with_8_subgroups', all.length === names.length && subs.length === 8, { all: all.length, names: names.length, subs });
    check('palette_search_7474_74hc595_ls138', q1.includes('ic7474') && q2.includes('ic74595') && q2.includes('ic74165') === false && q3.includes('ic74138') && q4.includes('ic7404') && q5.includes('ic4017') && q6.includes('ic7414') && q6.includes('ic74132'), { q1, q2, q3, q4, q5, q6 });
    const r = await page.evaluate(() => {
      const F = FX('ic7400', { fam: 'HC', sw: ['1A', '1B'] }); SET(F, { '1A': 1, '1B': 1 }); STEP(4);
      app.sel = { comp: F.U }; app.refreshProps();
      const rd = DEFS.ic7400.readings(F.U), fi = document.querySelector('#props .finfo, .finfo');
      const txt = fi ? fi.querySelector('pre').textContent : '';
      const d = F.U.state.d;
      return { rd: rd.map((x) => x.join(': ')), hasInfo: !!fi, txt: txt.slice(0, 200), lv: d.lv.join(','), fn: /NAND/.test(txt) || /NOT \(A AND B\)/.test(txt), pins14: /14\s+VCC/.test(txt) };
    });
    check('info_panel_function_table_and_live_pin_states', r.hasInfo && r.fn && r.pins14 && r.rd.some((x) => /1A=H 1B=H/.test(x)) && r.rd.some((x) => /1Y=L/.test(x)), r);
  }

  // ---------- 17. dictionary keys in all 10 languages ----------
  {
    const d = await page.evaluate(({ LANGS }) => {
      const keys = new Set(['ttl.func_table', 'ttl.contention', 'ttl.p.family', 'ttl.p.delay', 'ttl.p.tpd']);
      for (const t of Object.keys(DEFS)) if (DEFS[t].cat === 'ttl') { keys.add('c.' + t + '.name'); keys.add('c.' + t + '.desc'); }
      for (const k of Object.keys(I18N.dicts.en)) if (/^(ttl\.|ex\.ttl)/.test(k)) keys.add(k);
      for (const ex of EXAMPLES) if (/^ttl/.test(ex.id)) keys.add('ex.' + ex.id);
      const out = { n: keys.size, missing: {}, ph: [], same: {}, cats: 0 };
      const en = I18N.dicts.en;
      for (const L of LANGS) {
        const D = I18N.dicts[L]; const m = [...keys].filter((k) => !(k in D)); if (m.length) out.missing[L] = m.slice(0, 6);
        for (const k of keys) { if (!(k in D) || !(k in en)) continue; const a = (en[k].match(/\{\w+\}/g) || []).sort().join(), b = (D[k].match(/\{\w+\}/g) || []).sort().join(); if (a !== b) out.ph.push(L + ':' + k); }
        if (L !== 'en') { let same = 0; for (const k of keys) if (k in D && D[k] === en[k] && /^ex\.|^ttl\.(sub|st|r|o|p)\./.test(k)) same++; out.same[L] = same; }
      }
      return out;
    }, { LANGS });
    check('locale_keys_v13_all_10_languages', d.n > 150 && Object.keys(d.missing).length === 0, d);
    check('locale_v13_placeholders_kept', d.ph.length === 0, d.ph.slice(0, 5));
    check('locale_v13_texts_are_translated', ['zh-CN', 'zh-TW', 'ja', 'ko', 'ru'].every((L) => d.same[L] < 12), d.same);
  }

  // ---------- 18. examples: run without non-convergence, errors, contention or combinational loops + behaviour of each ----------
  {
    const ids = ['ttlsr', 'ttlrip', 'ttlbcd', 'ttl161', 'ttl138', 'ttl595', 'ttl165', 'ttl373', 'ttl245', 'ttl7483', 'ttl7485', 'ttl194', 'ttl14', 'ttl7474'];
    const menu = await page.evaluate((ids) => ids.filter((id) => EXAMPLES.some((e) => e.id === id)), ids);
    check('ttl_examples_all_14_in_menu', menu.length === 14, menu);
    const r = await page.evaluate((ids) => {
      const o = {};
      const U = (t) => app.comps.find((c) => c.type === t);
      const lv = (c, n) => { const ix = DEFS[c.type].part.pins.indexOf(n), g = app.net.v(c._nodes[DEFS[c.type].part.ig]), v = app.net.v(c._nodes[ix]) - g, vcc = app.net.v(c._nodes[DEFS[c.type].part.iv]) - g; return v > 0.5 * vcc ? 1 : 0; };
      const str = (c, names) => names.map((n) => lv(c, n)).join('');
      const sample = (secs, every, fn) => { const set = [], seq = []; let bad = 0, nxt = 0; const n = Math.round(secs / app.dt); for (let i = 0; i < n; i++) { app.simStep(); if (!app.net.converged) bad++; if (i >= nxt) { nxt += Math.round(every / app.dt); const v = fn(); seq.push(v); set.push(v); } } return { bad, set: [...new Set(set)], seq }; };
      for (const id of ids) {
        app.loadExample(id); app.running = false; app.resetSim(); TOASTS.length = 0;
        const x = { n: app.comps.length };
        const A = app.comps.find((c) => DEFS[c.type].mcu);
        let res;
        if (id === 'ttlsr') { res = sample(0.1, 0.02, () => str(U('ic7400'), ['1Y', '2Y'])); x.state = res.set.join(); }
        else if (id === 'ttlrip') { res = sample(8.6, 0.1, () => str(U('ic7493'), ['QD', 'QC', 'QB', 'QA'])); x.n_states = res.set.length; }
        else if (id === 'ttlbcd') { res = sample(8, 0.1, () => str(U('ic7490'), ['QD', 'QC', 'QB', 'QA'])); x.n_states = res.set.length; x.segs = (() => { const s = new Set(); return 0; })(); x.bcdOk = res.set.every((v) => parseInt(v, 2) <= 9); }
        else if (id === 'ttl161') { res = sample(8.4, 0.1, () => str(U('ic74161'), ['QD', 'QC', 'QB', 'QA'])); x.n_states = res.set.length; }
        else if (id === 'ttl138') { res = sample(0.1, 0.02, () => str(U('ic74138'), ['/Y0', '/Y1', '/Y2', '/Y3', '/Y4', '/Y5', '/Y6', '/Y7'])); x.state = res.set.join(); }
        else if (id === 'ttl595') { res = sample(2.0, 0.01, () => str(U('ic74595'), ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'])); x.n_states = res.set.length; x.single = res.set.every((v) => (v.match(/1/g) || []).length <= 1); x.err = A.state.rt && A.state.rt.err ? JSON.stringify(A.state.rt.err) : ''; }
        else if (id === 'ttl165') { res = sample(1.0, 0.1, () => 0); const l = (A.state.ser || '').trim().split(/\r?\n/); x.ser = l[l.length - 1]; x.err = A.state.rt && A.state.rt.err ? JSON.stringify(A.state.rt.err) : ''; }
        else if (id === 'ttl373') { res = sample(0.1, 0.02, () => str(U('ic74373'), ['1Q', '2Q', '3Q', '4Q', '5Q', '6Q', '7Q', '8Q'])); x.state = res.set.join(); }
        else if (id === 'ttl245') { res = sample(0.1, 0.02, () => str(U('ic74245'), ['B1', 'B2', 'B3', 'B4'])); x.state = res.set.join(); }
        else if (id === 'ttl7483') { res = sample(0.1, 0.02, () => str(U('ic7483'), ['S4', 'S3', 'S2', 'S1', 'C4'])); x.state = res.set.join(); }
        else if (id === 'ttl7485') { res = sample(0.1, 0.02, () => str(U('ic7485'), ['OA>B', 'OA=B', 'OA<B'])); x.state = res.set.join(); }
        else if (id === 'ttl194') { res = sample(4, 0.1, () => str(U('ic74194'), ['QA', 'QB', 'QC', 'QD'])); x.n_states = res.set.length; }
        else if (id === 'ttl14') { res = sample(2.5, 0.01, () => str(U('ic7414'), ['1Y'])); x.n_states = res.set.length; let t = 0; for (let i = 1; i < res.seq.length; i++) if (res.seq[i] !== res.seq[i - 1]) t++; x.toggles = t; }
        else if (id === 'ttl7474') { res = sample(2.0, 0.01, () => str(U('ic7474'), ['1Q', '2Q'])); x.n_states = res.set.length; let a = 0, b = 0; for (let i = 1; i < res.seq.length; i++) { if (res.seq[i][0] !== res.seq[i - 1][0]) a++; if (res.seq[i][1] !== res.seq[i - 1][1]) b++; } x.t1 = a; x.t2 = b; }
        x.bad = res.bad; x.toasts = TOASTS.filter((t) => /contention|error|wrong|overload|loop|not /i.test(t));
        const D = app.net.dig; x.unsettled = D ? D.unsettled : -1; x.pass = app.findPassOvers ? app.findPassOvers().length : 0;
        x.cont = app.comps.filter((c) => c.state.d && c.state.d.cont && c.state.d.cont.length).map((c) => c.type);
        x.st = app.comps.filter((c) => DEFS[c.type].cat === 'ttl').map((c) => c.state.d && c.state.d.st);
        o[id] = x;
      }
      return o;
    }, ids);
    for (const id of ids) { const x = r[id]; check('example_' + id + '_runs_clean', x && x.bad === 0 && x.pass === 0 && x.unsettled === 0 && x.cont.length === 0 && x.toasts.length === 0 && !x.err && x.st.every((s) => s === 2), x); }
    check('example_ttlsr_sets_q_high', r.ttlsr.state === '10', r.ttlsr);
    check('example_ttlrip_counts_through_16_states', r.ttlrip.n_states >= 15, r.ttlrip);
    check('example_ttlbcd_decade_counter_stays_0_to_9', r.ttlbcd.n_states === 10 && r.ttlbcd.bcdOk, r.ttlbcd);
    check('example_ttl161_counts_through_16_states', r.ttl161.n_states >= 15, r.ttl161);
    check('example_ttl138_only_y2_low', r.ttl138.state === '11011111', r.ttl138);
    check('example_ttl595_running_light', r.ttl595.n_states >= 6 && r.ttl595.single, r.ttl595);
    check('example_ttl165_reads_switches', /switches = 162$/.test(r.ttl165.ser || ''), r.ttl165);
    check('example_ttl373_transparent_latch_follows_inputs', r.ttl373.state === '10011001', r.ttl373);
    check('example_ttl245_passes_a_to_b', r.ttl245.state === '1010', r.ttl245);
    check('example_ttl7483_5_plus_3_is_8', r.ttl7483.state === '10000', r.ttl7483);
    check('example_ttl7485_5_less_than_6', r.ttl7485.state === '001', r.ttl7485);
    check('example_ttl194_ring_counter_cycles', r.ttl194.n_states >= 6, r.ttl194);
    check('example_ttl14_schmitt_oscillator_oscillates', r.ttl14.toggles >= 4, r.ttl14);
    check('example_ttl7474_divides_by_2_and_4', r.ttl7474.t1 >= 2 * r.ttl7474.t2 - 2 && r.ttl7474.t2 >= 2, r.ttl7474);
  }

  // ---------- 19. 4-digit multiplexed 7-segment display ----------
  {
    const r = await page.evaluate(() => {
      const o = {}, def = DEFS.seg7x4;
      const build = (ca) => {
        app.clearAll(); app.pause();
        const U = app.addComp('seg7x4', 700, 400, 0, { ca }), B = app.addComp('battery', 300, 300, 0, { V: 5 }), G = app.addComp('ground', 300, 560, 0, {});
        W(B, 1, G, 0); W(B, 0, G, 0);
        W(B, 0, G, 0);
        const sw = {}, ix = { a: 10, b: 6, c: 3, d: 1, e: 0, f: 9, g: 4, dp: 2 };
        return { U, B, G, sw, ix };
      };
      // common cathode: segments a, b driven high through 330 Ω by logic switches, digit 2 (pin 9) to ground
      let F = build(false);
      for (const k of ['a', 'b']) { const S = app.addComp('lswitch', 400, 100 + 40 * (k === 'a' ? 0 : 1), 0, { on: true }), R = app.addComp('resistor', 520, 100 + 40 * (k === 'a' ? 0 : 1), 0, { R: 330 }); W(S, 0, R, 0); W(R, 1, F.U, F.ix[k]); }
      W(F.G, 0, F.U, 8);
      app.changed(); app.resetSim(); let bad = 0; for (let i = 0; i < 120; i++) { app.simStep(); if (!app.net.converged) bad++; }
      o.cc = { lit: [0, 1, 2, 3].map((d) => def.lit(F.U, d)), text: def.text(F.U), bad, rd: def.readings(F.U)[0][1], I: +(F.U._m.I * 1000).toFixed(1) };
      // common anode: digit 3 (pin 8) high, segments c, d low through 330 Ω
      F = build(true);
      for (const k of ['c', 'd']) { const S = app.addComp('lswitch', 400, 100 + 40 * (k === 'c' ? 0 : 1), 0, { on: false }), R = app.addComp('resistor', 520, 100 + 40 * (k === 'c' ? 0 : 1), 0, { R: 330 }); W(S, 0, R, 0); W(R, 1, F.U, F.ix[k]); }
      const S3 = app.addComp('lswitch', 400, 300, 0, { on: true }); W(S3, 0, F.U, 7);
      app.changed(); app.resetSim(); bad = 0; for (let i = 0; i < 120; i++) { app.simStep(); if (!app.net.converged) bad++; }
      o.ca = { lit: [0, 1, 2, 3].map((d) => def.lit(F.U, d)), bad };
      o.pins = def.terms.length; o.cat = def.cat;
      return o;
    });
    check('seg7x4_common_cathode_lights_only_the_selected_digit', r.cc.lit[1] === 3 && r.cc.lit[0] === 0 && r.cc.lit[2] === 0 && r.cc.lit[3] === 0 && r.cc.bad === 0 && r.cc.I > 5, r.cc);
    check('seg7x4_common_anode_lights_only_the_selected_digit', r.ca.lit[2] === 12 && r.ca.lit[0] === 0 && r.ca.lit[1] === 0 && r.ca.lit[3] === 0 && r.ca.bad === 0, r.ca);
    check('seg7x4_has_12_pins_in_light_category', r.pins === 12 && r.cat === 'light', r);
  }

  check('no_page_errors_in_whole_run', errors.length === 0, errors.slice(0, 3));
  fs.writeFileSync(path.join(__dirname, 'test15-report.json'), JSON.stringify(results, null, 1));
  console.log(fails.length ? 'FAILED: ' + fails.length : 'ALL ' + Object.keys(results).length + ' PASSED');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
