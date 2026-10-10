// runs in the page (via Playwright): measures gain and clip-onset power of every power amplifier -> JSON  (used by tools/gen-audio-docs.js)
(() => {
  const out = { amps: [] };
  const STEP = (n) => { for (let i = 0; i < n; i++) app.simStep(); };
  const RUNT = (sec) => { const t1 = app.t + sec; while (app.t < t1) app.simStep(); };
  const W = (a, ia, b, ib) => { const p = app.termPos(a, ia), q = app.termPos(b, ib); return app.addWire(p[0], p[1], q[0], q[1], 1); };
  const NV = (c, i) => app.net.v(c._nodes[i]);
  const RMS = (fns, sec) => { const t1 = app.t + sec; const s = fns.map(() => ({ n: 0, a: 0, a2: 0 })); while (app.t < t1) { app.simStep(); fns.forEach((f, i) => { const v = f(); s[i].n++; s[i].a += v; s[i].a2 += v * v; }); } return s.map((q) => ({ mean: q.a / q.n, ac: Math.sqrt(Math.max(0, q.a2 / q.n - (q.a / q.n) ** 2)) })); };
  // generic rig: returns { U, S, g, ... }; cfg = { type, V (single) | Vp / Vn (dual), Z, props, wire(U, g, G, B, S) }
  function rig(cfg, vpp) {
    app.clearAll(); app.pause(); app.dt = 1e-4;
    const G = app.addComp('ground', 100, 700, 0, {});
    const B = app.addComp('battery', 200, 300, 0, { V: cfg.V || cfg.Vp }); W(B, 0, G, 0); let B2 = null;
    if (cfg.Vn) { B2 = app.addComp('battery', 200, 500, 0, { V: cfg.Vn }); W(B2, 1, G, 0); }
    const g = app.addComp('audiogen', 300, 600, 0, { Vpp: vpp, f: 1000, Zs: 50 }), U = app.addComp(cfg.type, 700, 400, 0, cfg.props || {}), S = app.addComp('speaker', 1100, 400, 0, { Z: cfg.Z, P: 200 });
    cfg.wire({ U, g, G, B, B2, S });
    app.changed(); app.resetSim(); RUNT(cfg.warm || 0.25);
    return { U, g, S, G, B, B2 };
  }
  const CFG = [
    { id: 'lm386_20', warm: 0.9, vlo: 0.1, type: 'lm386', label: 'LM386N-3, gain 20', V: 9, Z: 8, props: { ver: 'N-3' }, wire: ({ U, g, G, B, S }) => { const C = app.addComp('capacitor', 900, 400, 0, { C: 470e-6 }), C3 = app.addComp('capacitor', 760, 560, 0, { C: 10e-6 }); W(B, 1, U, 5); W(U, 3, G, 0); W(U, 1, G, 0); W(g, 0, U, 2); W(g, 1, G, 0); W(U, 4, C, 0); W(C, 1, S, 0); W(S, 1, G, 0); W(U, 6, C3, 0); W(C3, 1, G, 0); }, vin: (U) => NV(U, 2), vo: (U) => NV(U, 4) },
    { id: 'lm386_200', warm: 0.9, vlo: 0.01, type: 'lm386', label: 'LM386N-3, gain 200 (10 µF 1–8)', V: 9, Z: 8, props: { ver: 'N-3' }, wire: ({ U, g, G, B, S }) => { const C = app.addComp('capacitor', 900, 400, 0, { C: 470e-6 }), C3 = app.addComp('capacitor', 760, 560, 0, { C: 10e-6 }), C4 = app.addComp('capacitor', 600, 250, 0, { C: 10e-6 }); W(B, 1, U, 5); W(U, 3, G, 0); W(U, 1, G, 0); W(g, 0, U, 2); W(g, 1, G, 0); W(U, 4, C, 0); W(C, 1, S, 0); W(S, 1, G, 0); W(U, 6, C3, 0); W(C3, 1, G, 0); W(U, 0, C4, 0); W(C4, 1, U, 7); }, vin: (U) => NV(U, 2), vo: (U) => NV(U, 4), scale: 0.1 },
    { id: 'tda2030_8', type: 'tda2030', label: 'TDA2030, ±15 V, gain 11', Vp: 15, Vn: 15, Z: 8, wire: ({ U, g, G, B, B2, S }) => { const Ri = app.addComp('resistor', 500, 150, 0, { R: 1000 }), Rf = app.addComp('resistor', 700, 100, 0, { R: 10000 }); W(B, 1, U, 4); W(B2, 0, U, 2); W(g, 0, U, 0); W(g, 1, G, 0); W(U, 3, S, 0); W(S, 1, G, 0); W(U, 1, Ri, 1); W(Ri, 0, G, 0); W(U, 1, Rf, 0); W(Rf, 1, U, 3); }, vin: (U) => NV(U, 0), vo: (U) => NV(U, 3) },
    { id: 'tda2030_4', type: 'tda2030', label: 'TDA2030, ±14 V, 4 Ω, gain 11', Vp: 14, Vn: 14, Z: 4, wire: ({ U, g, G, B, B2, S }) => { const Ri = app.addComp('resistor', 500, 150, 0, { R: 1000 }), Rf = app.addComp('resistor', 700, 100, 0, { R: 10000 }); W(B, 1, U, 4); W(B2, 0, U, 2); W(g, 0, U, 0); W(g, 1, G, 0); W(U, 3, S, 0); W(S, 1, G, 0); W(U, 1, Ri, 1); W(Ri, 0, G, 0); W(U, 1, Rf, 0); W(Rf, 1, U, 3); }, vin: (U) => NV(U, 0), vo: (U) => NV(U, 3) },
    { id: 'lm3886_4', type: 'lm3886', label: 'LM3886, ±28 V, 4 Ω, gain 21', Vp: 28, Vn: 28, Z: 4, wire: ({ U, g, G, B, B2, S }) => { const Ri = app.addComp('resistor', 500, 150, 0, { R: 1000 }), Rf = app.addComp('resistor', 700, 100, 0, { R: 20000 }), Rm = app.addComp('resistor', 400, 700, 0, { R: 22000 }); W(B, 1, U, 1); W(B2, 0, U, 5); W(U, 6, G, 0); W(U, 7, Rm, 0); W(Rm, 1, G, 0); W(g, 0, U, 9); W(g, 1, G, 0); W(U, 2, S, 0); W(S, 1, G, 0); W(U, 8, Ri, 1); W(Ri, 0, G, 0); W(U, 8, Rf, 0); W(Rf, 1, U, 2); }, vin: (U) => NV(U, 9), vo: (U) => NV(U, 2) },
    { id: 'pam8403_4', type: 'pam8403', label: 'PAM8403, 5 V, 4 Ω', V: 5, Z: 4, props: { vol: 1 }, wire: ({ U, g, G, B, S }) => { W(B, 1, U, 3); W(U, 2, G, 0); W(g, 0, U, 0); W(g, 1, G, 0); W(U, 6, S, 0); W(U, 7, S, 1); }, vin: () => NV(app.comps.find((c) => c.type === 'audiogen'), 0), vo: (U) => NV(U, 6) - NV(U, 7), diff: true },
    { id: 'pam8403_8', type: 'pam8403', label: 'PAM8403, 5 V, 8 Ω', V: 5, Z: 8, props: { vol: 1 }, wire: ({ U, g, G, B, S }) => { W(B, 1, U, 3); W(U, 2, G, 0); W(g, 0, U, 0); W(g, 1, G, 0); W(U, 6, S, 0); W(U, 7, S, 1); }, vin: () => NV(app.comps.find((c) => c.type === 'audiogen'), 0), vo: (U) => NV(U, 6) - NV(U, 7), diff: true },
    { id: 'pam8610_8', type: 'pam8610', label: 'PAM8610, 12 V, 8 Ω', V: 12, Z: 8, props: { vol: 1 }, wire: ({ U, g, G, B, S }) => { W(B, 1, U, 3); W(U, 2, G, 0); W(g, 0, U, 0); W(g, 1, G, 0); W(U, 6, S, 0); W(U, 7, S, 1); }, vin: () => NV(app.comps.find((c) => c.type === 'audiogen'), 0), vo: (U) => NV(U, 6) - NV(U, 7), diff: true },
    { id: 'tpa3116_4', type: 'tpa3116', label: 'TPA3116, 21 V, 4 Ω, gain 26 dB', V: 21, Z: 4, props: { vol: 1, gdb: 26 }, wire: ({ U, g, G, B, S }) => { W(B, 1, U, 3); W(U, 2, G, 0); W(g, 0, U, 0); W(g, 1, G, 0); W(U, 6, S, 0); W(U, 7, S, 1); }, vin: () => NV(app.comps.find((c) => c.type === 'audiogen'), 0), vo: (U) => NV(U, 6) - NV(U, 7), diff: true },
    { id: 'tda7297_8', warm: 0.8, type: 'tda7297', label: 'TDA7297, 12 V, 8 Ω (BTL)', V: 12, Z: 8, wire: ({ U, g, G, B, S }) => { const Ci = app.addComp('capacitor', 400, 600, 0, { C: 1e-6 }); W(B, 1, U, 2); W(B, 1, U, 12); W(B, 1, U, 5); W(B, 1, U, 6); W(U, 7, G, 0); W(U, 8, G, 0); W(g, 0, Ci, 0); W(Ci, 1, U, 3); W(g, 1, G, 0); W(U, 0, S, 0); W(U, 1, S, 1); }, vin: (U) => NV(U, 3), vo: (U) => NV(U, 0) - NV(U, 1), diff: true },
  ];
  for (const cfg of CFG) {
    const res = { id: cfg.id, label: cfg.label, type: cfg.type };
    try {
      const probe = (vpp) => { const R = rig(cfg, vpp); const r = RMS([() => cfg.vo(R.U), () => cfg.vin(R.U), () => R.S._m.P || 0], 0.1); const rd = DEFS[cfg.type].readings(R.U); const stt = rd[rd.length - 1][1]; const ib = RMS([() => R.B._m.I], 0.1)[0].mean; return { vo: r[0].ac, vi: r[1].ac, P: r[2].mean, clip: /clip|Clip|限|削/.test(stt), st: stt, ib: Math.abs(ib), R }; };
      const lo = probe(cfg.vlo || 0.02); res.gain = lo.vo / lo.vi; res.gainDb = 20 * Math.log10(res.gain);
      // find the highest input amplitude without clipping: bisection on Vpp
      let a = cfg.vlo || 0.02, b = 20; for (let i = 0; i < 12; i++) { const m = Math.sqrt(a * b); const p = probe(m); if (p.clip) b = m; else a = m; }
      const p = probe(a); res.Pclip = p.P; res.voClip = p.vo * Math.SQRT2; res.vs = (cfg.V || (cfg.Vp + cfg.Vn)); res.Z = cfg.Z;
      const pe = probe(b * 1.5); res.Pmax = pe.P; res.eff = p.P / (p.ib * res.vs); res.ibClip = p.ib;
    } catch (e) { res.err = String(e && e.message || e); }
    out.amps.push(res);
  }
  app.dt = 2e-4;
  return out;
})()
