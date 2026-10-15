// v15: "现实模拟 / real-world simulation" mode.
// OFF by default; when off every hook below calls straight through to the original code, so the simulator behaves exactly as v14.1.
// When on: component tolerances (seeded per component id, stable across runs, re-rollable), battery internal resistance + sag + slow
// discharge, supply ripple (bench PSU), noise on sources, Johnson-like resistor noise, ADC noise on analogRead, self-heating drift of
// resistors / LEDs / transistors, small wire + contact resistance, switch / button bounce, sensor noise, meter last-digit flicker and
// oscilloscope trace noise. Every random number is a hash of (seed, component id, what, time bucket): deterministic and reproducible.
const REAL = (() => {
  const KEY = 'dcl.real';
  const FX = ['tol', 'bat', 'ripple', 'noise', 'adc', 'drift', 'wire', 'bounce', 'sensor', 'meter', 'scope'];
  const S = { on: false, level: 'med', fx: {}, rippleMv: 50, rippleHz: 100, seed: 1 };
  FX.forEach((k) => { S.fx[k] = true; });
  try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o) { Object.assign(S, o, { fx: Object.assign({}, S.fx, o.fx || {}) }); } } catch (e) { /* ignore */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };
  const LV = { low: 0.4, med: 1, high: 2.5 };
  const lv = () => LV[S.level] || 1;
  const fx = (k) => S.on && !!S.fx[k];
  // ---- deterministic hash noise ----
  const hs = (...a) => {
    let h = (2166136261 ^ (S.seed * 2654435761)) >>> 0;
    for (const x of a) { const s = String(x); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= 0x9e37; h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296;
  };
  const gs = (...a) => { const u1 = Math.max(hs(...a, 'a'), 1e-12), u2 = hs(...a, 'b'); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
  const bucket = (t, w) => Math.round((t || 0) / (w || (typeof app !== 'undefined' && app.dt) || 2e-4));
  // ---- tables ----
  const TOL = { resistor: { R: 'r' }, rheostat: { R: 'r' }, pot: { R: 'r' }, capacitor: { C: 'c' }, ecap: { C: 'c' }, ccap: { C: 'c' }, inductor: { L: 'l' } };
  const TOLPCT = { low: { r: 0.01, c: 0.1, l: 0.1 }, med: { r: 0.05, c: 0.2, l: 0.2 }, high: { r: 0.1, c: 0.2, l: 0.2 } };
  const UNIT = { R: 'Ω', C: 'F', L: 'H' };
  const SRC = { battery: { q: 1800, rint: true }, aaholder: { q: 7200 }, coincell: { q: 792 }, li18650: {}, solar: {}, ac: {} };
  const DRIFT = { resistor: { rth: 120 }, rheostat: { rth: 40 }, pot: { rth: 60 }, led: { rth: 350 }, npn: { rth: 200 }, pnp: { rth: 200 } };
  const BOUNCE = {
    switch: { act: (c) => !!c.props.closed, on: [[0, 1]], off: null, gap: [[0, 1]] },
    button: { act: (c) => !!c.state.pressed !== !!c.props.nc, on: [[0, 1]], off: null, gap: [[0, 1]] },
    tactile: { act: (c) => !!c.state.pressed, on: [[0, 1], [2, 3], [0, 2]], off: [[0, 1], [2, 3]], gap: [[0, 2]] },
  };
  const tolFactor = (c, k) => { const cls = TOL[c.type][k], p = TOLPCT[S.level][cls]; return 1 + p * U.clamp(gs('tol', c.id, k) * 0.45, -1, 1); };
  const srcSigma = () => 1e-3 * lv();
  const disch = (c) => { const o = SRC[c.type]; if (!fx('bat') || !o || !o.q) return 1; const acc = { low: 10, med: 60, high: 600 }[S.level] || 60; return 1 - 0.15 * Math.min(1, (c.state._rq || 0) * acc / o.q); };
  const rint = (c) => (fx('bat') && SRC[c.type] && SRC[c.type].rint ? Math.abs(+c.props.V || 0) / 6 : 0);   // 9 V block ≈ 1.5 Ω

  // ---------------- component hooks ----------------
  function hook(type) {
    const d = DEFS[type]; if (!d || d._real) return; d._real = true;
    const ob = d.build, op = d.post, osh = d.shorted;
    d.build = function (c, n, m) {
      if (!S.on) return ob.call(this, c, n, m);
      const k0 = m.prims.length, P = c.props, saved = {};
      c._rt = null;
      if (fx('tol') && TOL[type]) { c._rt = {}; for (const k in TOL[type]) { saved[k] = P[k]; const f = tolFactor(c, k); c._rt[k] = { nom: +P[k], act: +P[k] * f, f }; P[k] = +P[k] * f; } }
      const oAdd = m.addV;
      if (SRC[type] && (fx('bat') || fx('noise'))) {
        m.addV = function (a, b, fn, r) {
          const f2 = (t) => fn(t) * disch(c) + (fx('noise') ? srcSigma() * gs('src', c.id, bucket(t)) : 0);
          return oAdd.call(this, a, b, f2, (r || 0) + rint(c));
        };
      }
      const BB = BOUNCE[type], st = c.state;
      let res;
      try { res = ob.call(this, c, n, m); } finally { for (const k in saved) P[k] = saved[k]; m.addV = oAdd; }
      // bounce: the contact is momentarily open although the actuator says closed -> keep the nodes apart with the open-switch leakage
      if (BB && st._rb && !st._rb.cur && BB.act(c)) for (const [a, b] of BB.gap) m.addR(n[a], n[b], G_OFF);
      c._rprims = m.prims.slice(k0);
      for (const p of c._rprims) { if (p.t === 'R') p._g0 = p.g; if (p.t === 'N' && p.Is !== undefined) { p._Is0 = p.Is; if (p.BF !== undefined) p._BF0 = p.BF; } }
      // Johnson-like resistor noise (strongly exaggerated so it is visible on the scope): parallel noise current v_n / R
      if (fx('noise') && TOL[type] && TOL[type].R && type === 'resistor') {
        const R = c._rt ? c._rt.R.act : +P.R, vn = 30e-6 * lv() * Math.sqrt(Math.max(R, 1) / 1000);
        m.addI(n[0], n[1], (t) => vn / Math.max(R, 1e-3) * gs('jn', c.id, bucket(t)));
      }
      if (c._q && c._q.Vset !== undefined) c._q._V0 = c._q.Vset;
      return res;
    };
    if (BOUNCE[type]) {
      const BB = BOUNCE[type];
      d.shorted = function (c) {
        const r = osh ? osh.call(this, c) : null;
        if (!S.on || !c.state._rb) return r;
        return c.state._rb.cur ? BB.on : BB.off;
      };
    }
    d.post = function (c, dt, app) {
      if (!S.on) return op ? op.call(this, c, dt, app) : undefined;
      const st = c.state, L = lv();
      if (SRC[type] && fx('bat')) st._rq = (st._rq || 0) + Math.abs(c._m.I || 0) * dt;
      if (DRIFT[type] && fx('drift') && c._rprims) {
        const Pw = Math.abs(c._m.P || 0), Tt = 25 + Pw * DRIFT[type].rth;
        st._rT = st._rT === undefined ? 25 : st._rT + (Tt - st._rT) * Math.min(1, dt / 1.5);
        const dT = st._rT - 25; let restamp = false;
        for (const p of c._rprims) {
          if (p.t === 'R' && p._g0 !== undefined) { const g = p._g0 / (1 + 3e-4 * L * dT); if (Math.abs(g - (p._gs || p.g)) > 2e-4 * p.g) { p.g = g; p._gs = g; restamp = true; } }
          else if (p.t === 'N' && p._Is0 !== undefined) {
            const nVt = p.nVt || 0.02585;
            p.Is = p._Is0 * Math.exp(0.002 * L * dT / nVt);
            if (p._BF0 !== undefined) p.BF = p._BF0 * (1 + 0.004 * L * dT);
          }
        }
        if (restamp && app.net) app.net.needStamp = true;
      }
      if (type === 'psu' && c._q && c._q._V0 !== undefined) {
        const tn = app.t + dt;
        c._q.Vset = c._q._V0 + (fx('ripple') ? S.rippleMv / 1000 * Math.sin(2 * Math.PI * S.rippleHz * tn) : 0) + (fx('noise') ? srcSigma() * gs('psu', c.id, bucket(tn)) : 0);
      }
      if (BOUNCE[type] && fx('bounce')) {
        const BB = BOUNCE[type], a = BB.act(c);
        if (st._ra === undefined) st._ra = a;
        if (a !== st._ra) {
          st._ra = a; st._rn = (st._rn || 0) + 1;
          const dur = 1e-3 * { low: 0.6, med: 2, high: 5 }[S.level] * (0.7 + 0.6 * hs('bd', c.id, st._rn));
          st._rb = { end: app.t + dur, next: app.t + 1e-4, cur: !a, k: 0 };
          app.dirty = true;
        }
        const b = st._rb;
        if (b) {
          if (app.t >= b.end) { st._rb = null; app.dirty = true; }
          else while (app.t >= b.next) { b.cur = !b.cur; b.k++; b.next += 1e-4 + 5e-4 * hs('bi', c.id, st._rn, b.k); app.dirty = true; }
        }
      } else if (st._rb) { st._rb = null; app.dirty = true; }
      // scope: noisy traces (the sample is taken inside the original post)
      let sv;
      if (type === 'scope' && fx('scope')) {
        sv = [c._m.V, c._m.V2]; const P = c.props, k = bucket(app.t);
        c._m.V += L * (1e-3 + 0.012 * (+P.v1div || 1)) * gs('sc1', c.id, k);
        c._m.V2 += L * (1e-3 + 0.012 * (+P.v2div || 1)) * gs('sc2', c.id, k);
      }
      const res = op ? op.call(this, c, dt, app) : undefined;
      if (sv) { c._m.V = sv[0]; c._m.V2 = sv[1]; }
      if ((type === 'multimeter' || type === 'ammeter' || type === 'voltmeter') && fx('meter')) {
        const r = c._m.reading;
        if (Number.isFinite(r) && r !== 0) {
          const dig = Math.pow(10, Math.floor(Math.log10(Math.abs(r))) - 3), q = Math.round(U.clamp(gs('mt', c.id, bucket(app.t, 0.3)) * 0.55 * Math.sqrt(L), -2, 2));
          c._m.reading = r + q * dig; c._m.flick = q;
        }
      }
      return res;
    };
  }
  const TYPES = new Set([...Object.keys(TOL), ...Object.keys(SRC), ...Object.keys(DRIFT), ...Object.keys(BOUNCE), 'psu', 'scope', 'multimeter', 'ammeter', 'voltmeter']);
  for (const t of TYPES) hook(t);

  // ---- MCU analogRead noise (±LSB jitter, deterministic per call) ----
  if (typeof MCU !== 'undefined' && MCU.McuRT) {
    const P = MCU.McuRT.prototype, oar = P.ar;
    P.ar = function (p) {
      const raw = oar.call(this, p);
      if (!fx('adc')) return raw;
      this._rn = (this._rn || 0) + 1;
      const full = 1 << this.adcRes;
      return U.clamp(Math.round(raw + 0.7 * lv() * gs('adc', this.c && this.c.id, p, this._rn)), 0, full - 1);
    };
  }
  // ---- sensor noise on every sensed quantity (slow: 20 ms buckets) ----
  if (typeof SENS !== 'undefined') {
    const span = (c, k) => { const d = DEFS[c.type], p = d && d.props && d.props.find((x) => x.k === (k || 'q')); return p && Number.isFinite(p.max) && Number.isFinite(p.min) ? [p.min, p.max] : null; };
    const addN = (c, k, t, v) => {
      if (!fx('sensor') || typeof v !== 'number' || !Number.isFinite(v)) return v;
      const sp = span(c, k); if (!sp) return v;
      return U.clamp(v + 0.004 * lv() * (sp[1] - sp[0]) * gs('sn', c.id, k || 'q', bucket(t, 0.02)), sp[0], sp[1]);
    };
    const ov = SENS.val, oq = SENS.Q, on = SENS.now;
    SENS.val = (c, t, k) => addN(c, k, t, ov(c, t, k));
    SENS.Q = (c, k) => addN(c, k, typeof SIMCLK !== 'undefined' ? SIMCLK.t : 0, oq(c, k));
    if (on) SENS.now = (c, k) => addN(c, k, typeof app !== 'undefined' ? app.t : 0, on(c, k));
  }
  // ---- wire / contact resistance (used by app._topology / _buildMNA) ----
  const wireR = (w) => ({ low: 0.01, med: 0.03, high: 0.1 }[S.level] || 0.03) * (0.6 + 0.8 * hs('w', w.id));

  // ---------------- UI ----------------
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function propsHtml(c) {
    if (!S.on || !c) return '';
    const rows = [];
    if (c._rt) for (const k in c._rt) { const r = c._rt[k], u = UNIT[k] || ''; rows.push([_t('real.nominal') + ' / ' + _t('real.actual'), U.fmt(r.nom, u) + ' → <b>' + U.fmt(r.act, u, 4) + '</b> (' + (r.f >= 1 ? '+' : '') + ((r.f - 1) * 100).toFixed(1) + '%)']); }
    if (c.state && c.state._rT !== undefined && fx('drift')) rows.push([_t('real.temp'), c.state._rT.toFixed(1) + ' °C']);
    if (SRC[c.type] && fx('bat')) { const ri = rint(c); if (ri) rows.push([_t('real.rint'), U.fmt(ri + (+c.props.r || 0), 'Ω')]); if (SRC[c.type].q) rows.push([_t('real.discharge'), ((1 - disch(c)) * 100).toFixed(2) + '%']); }
    if (c.type === 'psu' && fx('ripple')) rows.push([_t('real.fx.ripple'), S.rippleMv + ' mV @ ' + S.rippleHz + ' Hz']);
    if (BOUNCE[c.type] && fx('bounce')) rows.push([_t('real.fx.bounce'), { low: '≈0.6', med: '≈2', high: '≈5' }[S.level] + ' ms']);
    if (!rows.length) return '';
    return '<div class="real-box"><div class="real-t">🎲 ' + esc(_t('real.btn')) + '</div>' + rows.map(([k, v]) => '<div><span class="rk">' + esc(k) + '</span><span>' + v + '</span></div>').join('') + '</div>';
  }
  function refreshBtn() {
    const b = document.getElementById('btn-real'); if (!b) return;
    b.classList.toggle('on', S.on); b.setAttribute('aria-pressed', String(S.on));
  }
  function changed() { save(); if (typeof app !== 'undefined') { app.dirty = true; if (app.refreshProps) app.refreshProps(); } refreshBtn(); }
  function setOn(on) { S.on = !!on; changed(); if (typeof app !== 'undefined' && app.toast) app.toast(_t(S.on ? 'real.on_toast' : 'real.off_toast')); }
  function set(o) { if (o.fx) Object.assign(S.fx, o.fx); for (const k of ['on', 'level', 'rippleMv', 'rippleHz', 'seed']) if (o[k] !== undefined) S[k] = o[k]; changed(); }
  function reroll() { S.seed = 1 + Math.floor(Math.random() * 1e9); changed(); }
  function popHtml() {
    let h = '<div class="real-pt">' + esc(_t('real.settings')) + '</div>';
    h += '<label class="real-row"><input type="checkbox" id="real-on"' + (S.on ? ' checked' : '') + '> <b>' + esc(_t('real.btn')) + '</b></label>';
    h += '<label class="real-row">' + esc(_t('real.level')) + ' <select id="real-level">' + ['low', 'med', 'high'].map((l) => '<option value="' + l + '"' + (S.level === l ? ' selected' : '') + '>' + esc(_t('real.lv.' + l)) + '</option>').join('') + '</select></label>';
    h += '<div class="real-fx">' + FX.map((k) => '<label><input type="checkbox" data-fx="' + k + '"' + (S.fx[k] ? ' checked' : '') + '> ' + esc(_t('real.fx.' + k)) + '</label>').join('') + '</div>';
    h += '<label class="real-row">' + esc(_t('real.ripple_mv')) + ' <input type="number" id="real-rmv" min="0" max="5000" step="1" value="' + S.rippleMv + '"></label>';
    h += '<label class="real-row">' + esc(_t('real.ripple_hz')) + ' <select id="real-rhz">' + [50, 60, 100, 120].map((f) => '<option' + (S.rippleHz === f ? ' selected' : '') + '>' + f + '</option>').join('') + '</select></label>';
    h += '<button type="button" id="real-reroll">🎲 ' + esc(_t('real.reroll')) + '</button>';
    return h;
  }
  function openPop(show) {
    let p = document.getElementById('real-pop');
    if (show === false || (show === undefined && p && !p.hidden)) { if (p) p.hidden = true; return; }
    if (!p) { p = document.createElement('div'); p.id = 'real-pop'; p.setAttribute('role', 'dialog'); document.body.appendChild(p); }
    p.innerHTML = popHtml(); p.hidden = false;
    const b = document.getElementById('btn-real-set'), r = b ? b.getBoundingClientRect() : { left: 400, bottom: 50 };
    p.style.left = Math.max(4, Math.min(window.innerWidth - 270, r.left - 120)) + 'px'; p.style.top = (r.bottom + 6) + 'px';
    p.querySelector('#real-on').onchange = (e) => setOn(e.target.checked);
    p.querySelector('#real-level').onchange = (e) => set({ level: e.target.value });
    p.querySelectorAll('[data-fx]').forEach((x) => { x.onchange = () => set({ fx: { [x.dataset.fx]: x.checked } }); });
    p.querySelector('#real-rmv').onchange = (e) => set({ rippleMv: Math.max(0, +e.target.value || 0) });
    p.querySelector('#real-rhz').onchange = (e) => set({ rippleHz: +e.target.value });
    p.querySelector('#real-reroll').onclick = () => reroll();
    p.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Escape') openPop(false); };
  }
  function initUI() {
    const b = document.getElementById('btn-real'), g = document.getElementById('btn-real-set');
    if (b) b.onclick = () => { setOn(!S.on); const p = document.getElementById('real-pop'); if (p && !p.hidden) openPop(true); };
    if (g) g.onclick = (e) => { e.stopPropagation(); openPop(); };
    document.addEventListener('pointerdown', (e) => { const p = document.getElementById('real-pop'); if (p && !p.hidden && !p.contains(e.target) && e.target !== g) p.hidden = true; });
    refreshBtn();
  }
  if (typeof window !== 'undefined') window.addEventListener('DOMContentLoaded', initUI);
  return { S, FX, fx, set, setOn, reroll, propsHtml, openPop, wireR, hs, gs, lv, TOL, BOUNCE, refreshBtn };
})();
