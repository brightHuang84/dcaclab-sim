'use strict';
// ===== Instant (static) meter solve =====
// Meters show correct readings even when the simulation is stopped / paused or the circuit has no
// powered source.  On every edit a separate netlist is built from *shadow* copies of the parts (so the
// running / paused simulation state is never touched) and solved once:
//   • stopped (never run): DC operating point — capacitors open, inductors = winding resistance,
//     transformers = winding resistance (DC does not couple);
//   • paused after running: "hold" solve — capacitors keep their voltage, inductors their current;
//   • Ω / continuity / diode: always DC.  The meter's own 1 mA test current is switched on and off and
//     R = ΔV / I (like a real meter).  A voltage already present with the test current off means the
//     network is powered → warning "测量电阻时请断开电源".
const METER_TYPES = new Set(['multimeter', 'ammeter', 'voltmeter']);
const TIME_SOURCES = new Set(['ac', 'clock', 'ic555']);   // parts whose output varies with time (AC readings need a run)

function cloneState(st) {
  const o = {};
  if (!st || typeof st !== 'object') return o;
  for (const k in st) {
    const v = st[k];
    if (v && typeof v === 'object' && !ArrayBuffer.isView(v)) o[k] = Array.isArray(v) ? (v.length <= 64 ? v.slice() : v) : Object.assign({}, v);
    else o[k] = v;
  }
  return o;
}

(function () {
  // edits mark `dirty` (or call changed()) — count them so meters can be re-solved on every edit
  let d = app.dirty;
  Object.defineProperty(app, 'dirty', { get() { return d; }, set(v) { d = v; if (v) app._ver = (app._ver || 0) + 1; }, configurable: true, enumerable: true });
  const oc = app.changed;
  app.changed = function (...a) { this._ver = (this._ver || 0) + 1; return oc.apply(this, a); };
  const of = app.frame;
  app.frame = function (ts) {
    try { if (this.staticUpdate()) { if (this.sel && this.sel.comp && METER_TYPES.has(this.sel.comp.type)) this.updateReadings(true); } } catch (e) { console.error('static meter solve', e); }
    try { this.meterSounds(); } catch (e) { /* audio unavailable */ }
    return of.call(this, ts);
  };
})();

Object.assign(app, {
  _ver: 1, _sKey: null, _sT: 0,
  meterComps() { return this.comps.filter(c => METER_TYPES.has(c.type)); },
  // re-solve when anything changed (or run state changed); while running only Ω-type meters need it
  staticUpdate(force) {
    const key = this._ver + ':' + this.running + ':' + this.hasRun + ':' + this.comps.length + ':' + this.wires.length;
    const now = performance.now();
    const ohmRun = this.running && this.comps.some(c => c.type === 'multimeter' && MM_OHMISH[c.props.mode]);
    if (!force && key === this._sKey && !(ohmRun && now - this._sT > 300)) return false;
    this._sKey = key; this._sT = now;
    this.staticSolve();
    return true;
  },
  _toDC(m) {
    const extra = [];
    for (const p of m.prims) {
      if (p.t === 'C') { p.t = 'R'; p.g = 1e-12; }
      else if (p.t === 'L') { p.t = 'R'; p.g = 1 / Math.max(p.R || 0, 1e-4); }
      else if (p.t === 'K') {   // DC: windings are just their (tiny) resistance, no coupling
        p.t = 'R'; p.a = p.n[0]; p.b = p.n[1]; p.g = 1e4; p.cur = p.cur || [0, 0, 0, 0];
        extra.push({ t: 'R', a: p.n[2], b: p.n[3], g: 1e4 });
      }
    }
    m.prims.push(...extra);
  },
  staticSolve() {
    const meters = this.meterComps();
    if (!meters.length) return;
    const isOhm = (c) => c.type === 'multimeter' && MM_OHMISH[c.props.mode];
    const ohm = meters.filter(isOhm);
    const va = this.running ? [] : meters.filter(c => !isOhm(c));
    if (!ohm.length && !va.length) return;
    const noAC = !this.comps.some(c => TIME_SOURCES.has(c.type));
    const sh = this.comps.map(c => { const s = Object.create(c); s.state = cloneState(c.state); s._m = {}; s._orig = c; return s; });
    const smap = new Map(sh.map(s => [s._orig, s]));
    const T = this._topology(sh);
    const t = this.t || 0;
    const net = (hold) => {
      const m = this._buildMNA(sh, T);
      if (hold) m.finalize(1e-9, 'be'); else { this._toDC(m); m.finalize(1, 'be'); }
      m.noCut = true;   // operating-point solve: no time-step cutting, gmin / source stepping only
      m.beSteps = 1e9;
      return m;
    };
    const solve = (m, minSteps) => { let ok = false; for (let k = 0; k < 40; k++) { ok = m.step(t); if (ok && k + 1 >= minSteps) break; } return ok; };
    const dv = (s, m) => m.v(s._nodes[1]) - m.v(s._nodes[0]);
    // --- voltage / current readings (only while not running; running meters show the live value)
    if (va.length) {
      const m = net(this.hasRun);
      const ok = solve(m, this.hasRun ? 1 : 3);
      for (const c of va) {
        const s = smap.get(c), md = c.props.mode;
        DEFS[c.type].measure(s, m);
        const ac = md === 'AC' || md.endsWith('AC');
        const isA = c.type === 'ammeter' || (c.type === 'multimeter' && md[0] === 'A');
        let r = isA ? s._m.I : s._m.V;
        if (!Number.isFinite(r)) r = undefined;
        else if (Math.abs(r) < (isA ? 1e-7 : 1e-6)) r = 0;
        c._s = { reading: ac ? undefined : r, noAC, converged: ok, hold: this.hasRun };
      }
    }
    // --- Ω / continuity / diode: meter's own test current on / off
    if (ohm.length) {
      const m = net(false);
      const S = ohm.map(c => smap.get(c));
      for (const s of S) s._itest = 0;
      solve(m, 3);
      const V0 = S.map(s => dv(s, m));
      S.forEach((s, k) => {
        s._itest = MM_ITEST; m.x.fill(0);
        solve(m, 3);
        const V1 = dv(s, m), d = V1 - V0[k];
        s._itest = 0;
        const c = ohm[k], md = c.props.mode, warn = Math.abs(V0[k]) > 1e-3;
        let reading;
        if (md === 'DIODE') reading = Number.isFinite(V1) ? V1 : Infinity;
        else { const den = MM_ITEST - d * MM_GSH; reading = den > 1e-9 && Number.isFinite(d) ? d / den : Infinity; }
        c._s = { reading, warn, v0: V0[k], noAC };
      });
    }
  },
  // optional continuity beeper sound (prop "sound", off by default)
  meterSounds() {
    for (const c of this.comps) {
      if (c.type !== 'multimeter') continue;
      const want = !!c.props.sound && c.props.mode === 'CONT' && meterBeep(c);
      if (want !== !!c._osc && typeof buzzerSound === 'function') buzzerSound(c, want);
    }
    if (typeof BUZZERS !== 'undefined') for (const c of [...BUZZERS]) if (c.type === 'multimeter' && !this.comps.includes(c)) buzzerSound(c, false);
  },
});
