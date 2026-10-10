'use strict';
// ===== v13: 74-series logic ICs — digital engine (family models, delta-cycle settling), DEFS registration, drawing =====
// Reuses the behavioural-digital idea of the v3 gates (logic levels decided by comparing node voltages with thresholds,
// outputs are real resistive drivers) but with a datasheet package: VCC / GND pins are required, thresholds and drive come
// from the logic family, and chains of parts settle inside one solver step (zero propagation delay, see MNA._stepOnce).
// part data (pin-outs, behaviour, function tables): js/ttl-parts.js
const TTL_FAMS = {
  // rec: recommended supply range, func: below this the part does not work (outputs high-Z), abs: absolute maximum
  // thr(v, schmitt) → [VIL, VIH] (input is 0 at or below VIL, 1 at or above VIH, in between it keeps its previous value)
  HC: { id: 'HC', rec: [2, 6], func: 2.0, abs: 7, thr: (v, s) => (s ? [0.31 * v, 0.53 * v] : [0.3 * v, 0.7 * v]), rIn: 5e6, inVcc: false, rH: 50, rL: 50, sH: 25, sL: 25, voh: 0, iccK: 0.003 },
  HCT: { id: 'HCT', rec: [4.5, 5.5], func: 4.0, abs: 7, thr: (v, s) => (s ? [0.9, 1.6] : [0.8, 2.0]), rIn: 5e6, inVcc: false, rH: 50, rL: 50, sH: 25, sL: 25, voh: 0, iccK: 0.003 },
  LS: { id: 'LS', rec: [4.75, 5.25], func: 4.0, abs: 7, thr: (v, s) => (s ? [0.8, 1.6] : [0.8, 2.0]), rIn: 20e3, inVcc: true, rH: 250, rL: 40, sH: 100, sL: 20, voh: 1.5, iccK: 1 },
  TTL: { id: 'TTL', rec: [4.75, 5.25], func: 4.0, abs: 7, thr: (v, s) => (s ? [0.9, 1.7] : [0.8, 2.0]), rIn: 3.3e3, inVcc: true, rH: 130, rL: 25, sH: 80, sL: 15, voh: 1.5, iccK: 1.9 },
  CD: { id: 'CD', rec: [3, 15], func: 3.0, abs: 18, thr: (v) => [0.3 * v, 0.7 * v], rIn: 5e6, inVcc: false, rH: 400, rL: 400, sH: 400, sL: 400, voh: 0, iccK: 1 },
};
// ballpark typical propagation delays in ns (data-book typical values at 5 V, 25 °C; clock-to-output for sequential parts)
const TTL_TPD = {
  gate: { HC: 9, HCT: 12, LS: 10, TTL: 11, CD: 80 }, ff: { HC: 17, HCT: 20, LS: 20, TTL: 25, CD: 150 }, latch: { HC: 15, HCT: 18, LS: 16, TTL: 20, CD: 100 },
  cnt: { HC: 25, HCT: 28, LS: 30, TTL: 40, CD: 150 }, sr: { HC: 20, HCT: 22, LS: 22, TTL: 26, CD: 150 }, dec: { HC: 14, HCT: 16, LS: 15, TTL: 20, CD: 150 },
  mux: { HC: 15, HCT: 18, LS: 17, TTL: 20, CD: 150 }, arith: { HC: 25, HCT: 28, LS: 30, TTL: 40, CD: 200 }, bus: { HC: 7, HCT: 10, LS: 9, TTL: 12, CD: 80 },
  seg: { HC: 100, HCT: 100, LS: 100, TTL: 100, CD: 150 },
};
const TTL_LS_DEFAULT = new Set(['7490', '7493', '7476', '74112', '7475', '7483', '7485']);
const TTL_SUBS = ['gate', 'ff', 'cnt', 'sr', 'dec', 'mux', 'arith', 'bus'];
const ttlTitle = (n, fam) => (fam === 'CD' ? 'CD' + n : fam === 'TTL' ? n : n.replace(/^74/, '74' + fam));

// ---------- digital engine (one per MNA, created by the first digital part that is built) ----------
class DigEngine {
  constructor() { this.parts = []; this.maxIter = 16; this.unsettled = 0; this.passes = 0; this.lastUnsettled = -1; }
  add(c) { this.parts.push(c); }
  // after a solve: recompute every part from the node voltages; true when some output drive changed (→ solve again)
  eval(m, t) { let ch = false; for (const c of this.parts) if (TTLX.evalPart(c, m, t)) ch = true; if (ch) m.needStamp = true; return ch; }
  commit(m, t) { for (const c of this.parts) { const T = c._tent; c._hold = null; if (T) { c.state.d = T; c._tent = null; } } }
  snap() { return this.parts.map((c) => c.state.d); }
  restore(s) { this.parts.forEach((c, i) => { c.state.d = s[i]; if (c._tent) c._hold = c._tent.pl; c._tent = null; }); }
}
const TTLX = (() => {
  const Z = 2, OFF = 1e-10, OFFL = 2e-7;   // OFFL: a released output keeps a 5 MΩ leak to GND (a node must not look like an isolated island to the network builder)
  const famOf = (c, part) => part.fam || (part.fams ? (part.fams.includes(c.props.fam) ? c.props.fam : part.famDef || part.fams[0]) : (c.props.fam || 'HC'));
  const status = (F, vv) => (vv < 0.5 ? 0 : vv < F.func ? 1 : vv > F.abs ? 4 : (vv < F.rec[0] || vv > F.rec[1]) ? 3 : 2);
  const setOut = (o, lvl) => {
    if (o.kind === 'oc' || o.kind === 'ocp') o.l.g = lvl === 0 ? 1 / o.rL : OFFL;
    else { o.h.g = lvl === 1 ? 1 / o.rH : OFF; o.l.g = lvl === 0 ? 1 / o.rL : OFFL; }
    o.cur = lvl;
  };
  function tpdOf(c, part, fam) { return (c.props.tpd > 0 ? c.props.tpd : (TTL_TPD[part.cls] || TTL_TPD.gate)[fam] || 10); }
  function evalPart(c, m, t) {
    const T = c._T, part = T.part, F = T.F, d = c.state.d || (c.state.d = { pw: 0, s: null, pl: {}, o: {}, tg: {}, since: 0, lv: [], st: 0 });
    const gv = m.v(T.gnd), vv = m.v(T.vcc) - gv, st = status(F, vv);
    let tent;
    if (st < 2) tent = { pw: 0, st, s: null, pl: {}, o: {}, tg: {}, since: t, lv: new Array(part.pins.length).fill(-1), cont: [] };
    else {
      const [lo, hi] = F.thr(vv, !!part.schmitt), I = {}, Pv = {}, was = !!d.pw;
      for (const p of T.ins) {
        const v = m.v(p.node) - gv, prev = was ? d.pl[p.name] : undefined, hold = c._hold && c._hold[p.name] !== undefined ? c._hold[p.name] : prev;   // hold: level seen in the previous settling pass of this step (keeps the hysteresis band effective while the step is re-solved)
        const lv = v <= lo ? 0 : v >= hi ? 1 : (part.schmitt && hold !== undefined) ? hold : (v > (lo + hi) / 2 ? 1 : 0);   // only Schmitt-trigger inputs have a hysteresis band; plain inputs switch at the middle of the VIL..VIH band
        I[p.name] = lv; Pv[p.name] = prev !== undefined ? prev : lv;
      }
      const S = was ? d.s : (part.init ? part.init() : null);
      const r = part.ev(S, I, Pv), tg = {};
      for (const o of T.outs) tg[o.name] = r.o[o.name] === undefined ? Z : r.o[o.name];
      let ap = tg, since = t;
      if (c.props.delay && was) {
        let same = true; for (const k in tg) if (tg[k] !== d.tg[k]) { same = false; break; }
        since = same ? d.since : t;
        // the applied outputs depend on the committed state only (never on this step's inputs): every part updates synchronously, one solve step per stage, so a delayed ring settles
        ap = t - d.since >= tpdOf(c, part, T.fam) * 1e-9 - 1e-15 ? d.tg : d.o;
      }
      tent = { pw: 1, st, s: r.s || S, pl: I, o: ap, tg, since, lv: [], cont: [] };
      T.ins.forEach((p) => { tent.lv[p.idx] = I[p.name]; });
    }
    // apply the output drive to the stamped conductances
    let changed = false;
    const was2 = !!(d.pw && d.st >= 2);   // contention is only judged one step after power-up (the VOH drop source of LS/TTL parts follows the supply with one step of lag)
    for (const o of T.outs) {
      const want = st < 2 ? Z : (tent.o[o.name] === undefined ? Z : tent.o[o.name]);
      if (want !== o.cur) { setOut(o, want); changed = true; }
      if (tent.lv) tent.lv[o.idx] = want;
    }
    if (!changed && st >= 2 && was2) {      // the solution belongs to this drive: look for contention / overload (an output forced to the other level)
      for (const o of T.outs) {
        const lvl = o.cur; if (lvl !== 0 && lvl !== 1) continue;
        const v = m.v(o.node) - gv, oc = o.kind === 'oc' || o.kind === 'ocp';
        if ((lvl === 1 && !oc && v < 0.6 * (vv - T.F.voh)) || (lvl === 0 && v > 0.4 * vv)) tent.cont.push(o.name);   // the net sits clearly on the wrong side of the level the output drives
      }
    }
    c._tent = tent;
    return changed;
  }
  function build(c, n, m) {
    const part = DEFS[c.type].part, fam = famOf(c, part), F = TTL_FAMS[fam], T = c._T = { part, F, fam, outs: [], ins: [] };
    T.vcc = n[part.iv]; T.gnd = n[part.ig];
    let Y = T.vcc;
    if (F.voh > 0) {   // TTL totem-pole high level ≈ VCC − 1.5 V (typ. 3.4 V at 5 V): a supply-derived source feeds the high-side switches
      Y = m.newNode();
      m.addV(Y, T.vcc, () => -F.voh, 1);   // constant VOH drop below VCC (no lag: ideal source between the two nodes)
    }
    const icc = (part.icc || 1) * F.iccK;   // mA at 5 V
    m.addR(T.vcc, T.gnd, Math.max(icc * 1e-3, 1e-7) / 5);
    const d = c.state.d;
    part.pins.forEach((name, i) => {
      if (i === part.iv || i === part.ig || name === 'NC') return;
      const kind = part.outs[name], isIo = part.io && part.io.includes(name);
      if (!kind || isIo) { T.ins.push({ name, idx: i, node: n[i] }); m.addR(n[i], F.inVcc ? T.vcc : T.gnd, 1 / F.rIn); }
      if (kind) {
        const strong = part.strong, rH = strong ? F.sH : F.rH;
        let rL = strong ? F.sL : F.rL; if (part.rl) rL = part.rl[fam] || part.rl.any || rL;
        const o = { name, idx: i, node: n[i], kind, rH, rL, cur: Z };
        o.l = m.addR(n[i], T.gnd, OFFL);
        if (kind === 'o' || kind === 'z') o.h = m.addR(n[i], Y, OFF);
        if (kind === 'ocp') m.addR(n[i], T.vcc, 1 / 2000);
        const lvl = d && d.pw && d.o[name] !== undefined ? d.o[name] : Z;
        if (lvl !== Z) setOut(o, lvl);
        T.outs.push(o);
      }
    });
    c._p = null;
    (m.dig || (m.dig = new DigEngine())).add(c);
  }
  return { evalPart, build, famOf, status, Z };
})();

// ---------- DEFS registration ----------
if (typeof DEFS !== 'undefined' && typeof TTL_PARTS !== 'undefined') (() => {
  const ZH = (k, d) => (typeof I18N !== 'undefined' && I18N.dicts && I18N.dicts['zh-CN'] && I18N.dicts['zh-CN'][k]) || d;
  const HL = (lv) => (lv === 1 ? 'H' : lv === 0 ? 'L' : lv === 2 ? 'Z' : '·');
  const shape = (part) => {
    const n = part.pins.length, half = n / 2, y0 = -20 * Math.ceil((half - 1) / 2);
    const terms = part.pins.map((_, i) => (i < half ? [-60, y0 + 20 * i] : [60, y0 + 20 * (n - 1 - i)]));
    return { n, half, y0, terms, box: [-66, y0 - 14, 66, y0 + 20 * (half - 1) + 14] };
  };
  const useCount = (app) => {   // terminals per node (cached per built network): a node with only one terminal is a floating pin
    if (app._ttlUse && app._ttlUse.net === app.net) return app._ttlUse.map;
    const map = new Map(); for (const c of app.comps) for (const nd of (c._nodes || [])) map.set(nd, (map.get(nd) || 0) + 1);
    app._ttlUse = { net: app.net, map }; return map;
  };
  const FAM_OPTS = { HC: ['HC', '74HC (CMOS, 2–6 V)'], HCT: ['HCT', '74HCT (CMOS, TTL 输入电平, 5 V)'], LS: ['LS', '74LS (低功耗肖特基 TTL, 5 V)'], TTL: ['TTL', '74 (标准 TTL, 5 V)'] };
  const SUBTXT = { gate: '逻辑门', ff: '触发器与锁存器', cnt: '计数器', sr: '移位寄存器', dec: '译码器', mux: '数据选择器', arith: '运算 / 比较', bus: '总线驱动' };
  CATEGORIES.splice(CATEGORIES.findIndex((x) => x[0] === 'logic') + 1, 0, ['ttl', '74 系列逻辑 74-series']);
  window.CAT_SUBS = Object.assign(window.CAT_SUBS || {}, { ttl: TTL_SUBS });
  for (const part of TTL_PARTS) {
    const type = 'ic' + part.n, sh = shape(part);
    part.type = type; part.iv = part.pins.length - 1; part.ig = part.pins.length / 2 - 1;
    if (!/^(VCC|VDD)$/.test(part.pins[part.iv]) || !/^(GND|VSS)$/.test(part.pins[part.ig])) { part.iv = part.pins.findIndex((p) => /^(VCC|VDD)$/.test(p)); part.ig = part.pins.findIndex((p) => /^(GND|VSS)$/.test(p)); }
    const fams = part.fam ? null : (part.fams || ['HC', 'HCT', 'LS', 'TTL']);
    part.famDef = part.famDef || (TTL_LS_DEFAULT.has(part.n) ? 'LS' : 'HC');
    if (fams) part.fams = fams;
    const base = part.fam ? ttlTitle(part.n, part.fam) : '74xx' + part.n.replace(/^74/, '');
    const titleNow = (c) => ttlTitle(part.n, TTLX.famOf(c, part));
    const props = [];
    if (fams) props.push({ k: 'fam', label: '逻辑系列 Family', kind: 'select', opts: fams.map((f) => FAM_OPTS[f].slice()), def: part.famDef, lk: 'ttl.p.family', ok: 'ttl.o.fam' });
    props.push({ k: 'delay', label: '模拟传播延迟 (取整到求解步)', kind: 'bool', def: false, lk: 'ttl.p.delay' });
    props.push({ k: 'tpd', label: '传播延迟 tpd (0 = 数据手册典型值)', unit: 'ns', def: 0, min: 0, lk: 'ttl.p.tpd', show: (c) => !!c.props.delay });
    const lower = part.n.toLowerCase(), s2 = part.n.replace(/^74/, '');
    const kw = part.fam ? ['cd' + part.n, part.n, 'mc140' + part.n.slice(0, 2) + part.n.slice(2), part.n + 'b'].join(' ')
      : [part.n, '74hc' + s2, '74ls' + s2, '74hct' + s2, 'hc' + s2, 'ls' + s2, 'hct' + s2, '74xx' + s2, 'sn74ls' + s2].join(' ');
    DEFS[type] = {
      name: ZH('c.' + type + '.name', ttlTitle(part.n, part.famDef) + ' ' + part.en), en: part.en + ' (' + (part.fam ? ttlTitle(part.n, part.fam) : '74xx' + s2) + ')',
      desc: ZH('c.' + type + '.desc', part.en), cat: 'ttl', pgrp: part.grp, kw, desig: 'U', part,
      terms: sh.terms, termNames: part.pins.map((p, i) => (i + 1) + ' ' + p), box: sh.box, props, label: () => '',
      build: TTLX.build,
      measure(c, m) { const T = c._T; if (!T) return; c._m.V = m.v(T.vcc) - m.v(T.gnd); c._m.I = 0; c._m.P = 0; },
      post(c, dt, app) {
        const d = c.state.d; if (!d) return;
        if (d.cont && d.cont.length) { if (!c.state.warned) { c.state.warned = true; app.toast(_t('ttl.contention', { part: titleNow(c), pins: d.cont.join(', ') })); } } else c.state.warned = false;
      },
      info(c) {
        const lines = [titleNow(c) + ' — ' + part.en, '', 'DIP-' + part.pins.length + ' (top view, pin 1 top left)'];
        part.pins.forEach((p, i) => lines.push(String(i + 1).padStart(2) + '  ' + p + '  ' + (i === part.iv ? 'power' : i === part.ig ? 'ground' : p === 'NC' ? 'not connected' : part.outs[p] ? (part.io && part.io.includes(p) ? 'in/out' : ({ o: 'out', z: 'out (3-state)', oc: 'out (open collector)', ocp: 'out (open collector + 2 kΩ pull-up)' })[part.outs[p]]) : 'in')));
        lines.push('', 'Function:'); for (const l of part.fn || []) lines.push(l); return lines.join('\n');
      },
      readings(c) {
        const T = c._T, d = c.state.d, F = T ? T.F : TTL_FAMS.HC, R = [];
        if (!T) return R;
        const vv = c._m.V || 0, st = d ? d.st : TTLX.status(F, vv);
        R.push([_t('ttl.r.part'), titleNow(c) + ' · DIP-' + part.pins.length]);
        R.push([_t('ttl.r.supply'), U.fmt(vv, 'V') + ' · ' + _t('ttl.st.' + st, { lo: F.rec[0], hi: F.rec[1], fn: F.func, ab: F.abs })]);
        if (d && d.pw) {
          const ins = T.ins.filter((p) => !(part.io && part.io.includes(p.name))), outs = T.outs;
          R.push([_t('ttl.r.inputs'), ins.map((p) => p.name + '=' + HL(d.lv[p.idx])).join(' ')]);
          R.push([_t('ttl.r.outputs'), outs.map((o) => o.name + '=' + HL(d.lv[o.idx])).join(' ')]);
        }
        if (c.props.delay) R.push([_t('ttl.r.tpd'), (c.props.tpd > 0 ? c.props.tpd : (TTL_TPD[part.cls] || TTL_TPD.gate)[T.fam]) + ' ns → ' + _t('ttl.r.tpd_note')]);
        const app = window.app, fl = [];
        if (app && app.net) { const use = useCount(app); for (const p of T.ins) if (p.node > 0 && use.get(p.node) === 1 && !(part.outs[p.name] && !(part.io && part.io.includes(p.name)))) fl.push(p.name); else if (p.node === 0) { /* tied to the reference node */ } }
        if (fl.length) R.push([_t('ttl.r.floating'), fl.join(' ') + ' — ' + _t(T.F.inVcc ? 'ttl.r.floating_ttl' : 'ttl.r.floating_cmos')]);
        if (d && d.cont && d.cont.length) R.push([_t('ttl.r.contention'), d.cont.join(' ')]);
        const D = app && app.net && app.net.dig; if (D && D.lastUnsettled >= 0 && app.t - D.lastUnsettled < 0.05) R.push([_t('ttl.r.loop'), _t('ttl.r.loop_note')]);
        return R;
      },
      draw(ctx, c) {
        const [x0, y0, x1, y1] = sh.box, half = sh.half, d = c.state && c.state.d, thumb = !c.id;
        const fam = TTLX.famOf(c, part), title = ttlTitle(part.n, fam);
        const by0 = sh.y0 - 10, by1 = sh.y0 + 20 * (half - 1) + 10;
        for (let i = 0; i < sh.n; i++) { const [x, y] = sh.terms[i]; D.lead(ctx, x, y, x < 0 ? -40 : 40, y); }
        ctx.fillStyle = D.vgrad(ctx, by0, by1, [[0, '#3a414b'], [1, '#1e2329']]); D.rrect(ctx, -40, by0, 80, by1 - by0, 4); ctx.fill();
        ctx.strokeStyle = '#0d1014'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#12161a'; ctx.beginPath(); ctx.arc(0, by0, 6, 0, Math.PI); ctx.fill();   // pin-1 notch
        ctx.fillStyle = '#9aa7b4'; ctx.beginPath(); ctx.arc(-32, by0 + 7, 1.8, 0, 7); ctx.fill();
        if (thumb) { ctx.fillStyle = '#e8edf2'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(part.fam === 'CD' ? part.n : part.n.replace(/^74/, ''), 0, (by0 + by1) / 2 + 4); return; }
        const dot = (x, y, lv) => { if (lv === undefined || lv < 0) return; ctx.fillStyle = lv === 1 ? '#ff4b3e' : lv === 0 ? '#3b82f6' : '#8b95a1'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); };
        for (let i = 0; i < sh.n; i++) {
          const [x, y] = sh.terms[i], name = part.pins[i], left = x < 0, bar = name[0] === '/';
          const lab = bar ? name.slice(1) : name;
          ctx.fillStyle = name === 'NC' ? '#6b7683' : (i === part.iv ? '#ff9e80' : i === part.ig ? '#8fd0ff' : '#e8edf2');
          ctx.font = '7px sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = left ? 'left' : 'right';
          const tx = left ? -37 : 37; ctx.fillText(lab, tx, y);
          if (bar) { const w = ctx.measureText(lab).width; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(left ? tx : tx - w, y - 4.6); ctx.lineTo(left ? tx + w : tx, y - 4.6); ctx.stroke(); }
          ctx.fillStyle = '#6b7888'; ctx.font = '5.5px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), left ? -50 : 50, y - 4.5);
          if (d && d.lv) dot(left ? -46 : 46, y, d.lv[i]);
        }
        ctx.save(); ctx.translate(0, (by0 + by1) / 2); ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#e8edf2'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(title, 0, 0); ctx.restore();
        const st = d ? d.st : 0; ctx.fillStyle = !d ? '#6b7683' : st === 2 ? '#34c759' : st >= 3 ? '#ffb020' : '#ff453a'; ctx.beginPath(); ctx.arc(30, by0 + 7, 2.8, 0, 7); ctx.fill();
      },
    };
  }
})();
if (typeof module !== 'undefined') module.exports = { TTL_FAMS, TTL_TPD, ttlTitle, TTL_SUBS, TTL_LS_DEFAULT };
