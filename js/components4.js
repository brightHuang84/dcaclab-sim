'use strict';
// ===== v5: modules — DC-DC boost converter module (MT3608-style), behavioural averaged model =====
//
// Terminals: VIN+, VIN−, VOUT+, VOUT−.  VIN− and VOUT− are the same copper (common GND) as on the real board.
// The converter is one non-linear MNA device on [vin, vout, gnd] (Newton-Raphson with analytic Jacobian):
//   Vt   = smooth-max(Vset, Vin − Vd)                 regulation, or pass-through via the diode when Vin > Vout
//   en   = sigmoid((Vin − Vth)/w)                     under-voltage lock-out with hysteresis (Vth from state)
//   Iraw = en·(Vt − Vout)/Ro                          stiff Norton output (Ro = 20 mΩ)
//   Iout = IL · f(Iraw/IL),  f(x) = x/(1+|x|^8)^(1/8)   smooth current limit (IL folds back while overloaded)
//   Iin  = Iout · max(Vout/(η·Vin), 1)               power balance Pin = Pout/η (and Iin ≥ Iout, as in a boost)
const BOOST_MMAX = 10, BOOST_RO = 0.002, BOOST_VD = 0.4, BOOST_HYST = 0.15, BOOST_SINK = 0.02, BOOST_WV = 0.02, BOOST_WK = 0.01;
const _sig = (x) => (x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)));
const _softplus = (x) => (x > 0 ? x + Math.log1p(Math.exp(-x)) : Math.log1p(Math.exp(x)));

// Newton helper: a step that jumps across a narrow transition window lands in its centre instead
function crossClamp(vnew, vold, centre, halfw) {
  if ((vnew - centre) * (vold - centre) < 0 && Math.abs(vnew - vold) > 2 * halfw) return centre;
  return vnew;
}
// evaluate the averaged model at Vin = a, Vout = b (relative to GND); returns currents and partial derivatives
function boostEval(p, a, b, enUsed) {
  const st = p.st;
  // UVLO: enable is a discrete state per time step (updated in NLACCEPT.boost with hysteresis + restart delay)
  const en = enUsed !== undefined ? enUsed : (st.hot || st.on === false ? 0 : 1);
  const buck = p.kind === 'buck';
  let Vt, dVt;
  if (buck) {   // buck: Vt = smooth-min(Vset, Vin − Vdrop)  (100 % duty dropout)
    const u = (p.Vset - (a - p.Vdo)) / BOOST_WV;
    Vt = p.Vset - BOOST_WV * _softplus(u); dVt = _sig(u);
  } else {
    const u = (a - BOOST_VD - p.Vset) / BOOST_WV;
    Vt = p.Vset + BOOST_WV * _softplus(u); dVt = _sig(u);
    // max duty cycle (~90 %) limits the boost ratio: Vt ≤ Mmax·Vin  (smooth min)
    const vm = BOOST_MMAX * Math.max(a, 0), dvm = a > 0 ? BOOST_MMAX : 0, wm = 0.05 * p.Vset;
    const um = (Vt - vm) / wm, sm = _sig(um);
    Vt = Vt - wm * _softplus(um); dVt = dVt * (1 - sm) + dvm * sm;
  }
  // brown-out: below the UVLO threshold the controller runs out of drive — target ramps to 0 over 0.5 V
  const bo0 = p.Vmin - BOOST_HYST - 0.5, bz = (a - bo0) / 0.5;
  if (bz < 1) { const r = Math.max(0, bz), dr = bz > 0 ? 2 : 0; dVt = dVt * r + Vt * dr; Vt *= r; }
  // current limit, folded back towards 40 % while the output is overloaded (uses the last accepted Vout)
  const fold = st.ol ? 0.4 + 0.6 * U.clamp((st.vo || 0) / Math.max(p.Vset, 1e-3), 0, 1) : 1;
  const IL = p.Ilim * fold, g = 1 / BOOST_RO;
  const Iraw = en * g * (Vt - b);
  const dIraw_a = en * g * dVt, dIraw_b = -en * g;
  const ILs = Iraw >= 0 ? IL : IL * BOOST_SINK;           // the output diode blocks reverse current (tiny sink only)
  const x = Iraw / ILs, ax8 = Math.pow(Math.abs(x), 8), q = Math.pow(1 + ax8, -1 / 8);
  const Iout = ILs * x * q, fp = q / (1 + ax8);               // d f/dx = (1+|x|^8)^(-9/8)
  const dIo_a = fp * dIraw_a, dIo_b = fp * dIraw_b;
  const vs = Math.max(a, 0.3), dvs = a > 0.3 ? 1 : 0;
  const k = b / (p.eff * vs), dk_a = -b / (p.eff * vs * vs) * dvs, dk_b = 1 / (p.eff * vs);
  let keff, dkeff;
  if (buck) { const kk = (1 - k) / BOOST_WK; keff = 1 - BOOST_WK * _softplus(kk); dkeff = _sig(kk); }   // buck: Iin ≤ Iout
  else { const kk = (k - 1) / BOOST_WK; keff = 1 + BOOST_WK * _softplus(kk); dkeff = _sig(kk); }       // boost: Iin ≥ Iout
  const Iin = Iout * keff;
  const dIi_a = dIo_a * keff + Iout * dkeff * dk_a, dIi_b = dIo_b * keff + Iout * dkeff * dk_b;
  return { Iin, Iout, dIi_a, dIi_b, dIo_a, dIo_b, en, Vt, x, IL, pass: buck ? a - p.Vdo < p.Vset : a - BOOST_VD > p.Vset };
}

// once per accepted step: under-voltage lock-out with hysteresis and a 20 ms restart (soft-start) delay
NLACCEPT.boost = function (p, V, dt, converged) {
  const st = p.st, a = V(p.n[0]) - V(p.n[2]);
  // the source cannot deliver the demanded power (no operating point): brown-out, redo the step switched off
  if (!converged && st.on !== false && !st.hot) return () => { st.on = false; st.offT = 0; st.brown = true; };
  if (st.on !== false) {
    if (a < p.Vmin - (st.on ? BOOST_HYST : 0)) { st.on = false; st.offT = 0; } else st.on = true;
  } else {
    st.offT = (st.offT || 0) + dt;
    if (a >= p.Vmin && st.offT >= 0.02) { st.on = true; st.brown = false; }
  }
};
// terminals [vin, vout, gnd]; row = current INTO the device terminal
NLMODELS.boost = function (p, V) {
  const st = p.st;
  const ra = V[0] - V[2], rb = V[1] - V[2];
  const a0 = st.a === undefined ? ra : st.a, b0 = st.b === undefined ? 0 : st.b;
  // constant-power input has a negative incremental resistance: damp downward Vin steps (weak sources)
  const a = ra > a0 ? Math.min(ra, a0 + 3) : Math.max(ra, a0 - Math.max(0.2, 0.25 * Math.abs(a0)));
  let b = clampStep(rb, b0, 3);
  { // output: current-limit knee ↔ regulation window (a few mV wide)
    const E0 = boostEval(p, a, b0), en = Math.max(E0.en, 1e-6), hw = E0.IL * BOOST_RO / en;
    b = crossClamp(b, b0, E0.Vt, hw);
  }
  st.a = a; st.b = b;
  const E = boostEval(p, a, b), G = p.G, J = p.J;
  p.en = E.en;                                             // enable used by this solve (for readings)
  const GO = 1e-9;                                         // output leakage keeps the node defined when off
  // I0 = Iin ; I1 = −Iout + GO·b ; I2 = −(I0 + I1)
  const r0 = [E.dIi_a, E.dIi_b], r1 = [-E.dIo_a, -E.dIo_b + GO];
  const I0 = E.Iin, I1 = -E.Iout + GO * b;
  G[0] = r0[0]; G[1] = r0[1]; G[2] = -(r0[0] + r0[1]);
  G[3] = r1[0]; G[4] = r1[1]; G[5] = -(r1[0] + r1[1]);
  G[6] = -(G[0] + G[3]); G[7] = -(G[1] + G[4]); G[8] = -(G[2] + G[5]);
  J[0] = I0 - (r0[0] * a + r0[1] * b); J[1] = I1 - (r1[0] * a + r1[1] * b); J[2] = -(J[0] + J[1]);
  return Math.abs(a - ra) > 1e-9 || Math.abs(b - rb) > 1e-9;
};

Object.assign(DEFS, {
  boost: {
    name: 'DC-DC 升压模块', en: 'Boost Module', cat: 'module', desig: 'U',
    terms: [[-80, -20], [-80, 20], [80, -20], [80, 20]], termNames: ['VIN+', 'VIN− (GND)', 'VOUT+', 'VOUT− (GND)'],
    box: [-80, -46, 80, 46],
    props: [
      { k: 'Vout', label: '输出电压 (微调电位器)', unit: 'V', def: 12, min: 2, max: 28 },
      { k: 'eff', label: '效率 η', unit: '%', def: 90, min: 10, max: 100 },
      { k: 'Imax', label: '最大输出电流 (限流)', unit: 'A', def: 2, min: 0.01 },
      { k: 'Vmin', label: '最低输入电压 (欠压锁定)', unit: 'V', def: 2, min: 0.5 },
    ],
    label: (c) => 'Boost → ' + U.fmtShort(DEFS.boost.vset(c), 'V'),
    vset(c) { return U.clamp(+c.props.Vout || 0, 2, 28); },
    shorted: () => [[1, 3]], innerShort: true,                               // VIN− and VOUT− are one GND net on the board
    onWheel(c, dir) { c.props.Vout = U.clamp(Math.round((DEFS.boost.vset(c) + dir * 0.1) * 10) / 10, 2, 28); },
    build(c, n, m) {
      const P = c.props;
      c._q = m.addNL('boost', [n[0], n[2], n[1]], {
        Vset: DEFS.boost.vset(c), eff: U.clamp(P.eff, 10, 100) / 100, Ilim: Math.max(P.Imax, 0.01), Vmin: Math.max(P.Vmin, 0.5),
      }, c.state);
      c._p = null;
    },
    measure(c, m) {
      const n = c._nodes, M = c._m, a = m.v(n[0]) - m.v(n[1]), b = m.v(n[2]) - m.v(n[1]);
      const E = boostEval(c._q, a, b, c._q.en);
      M.Vin = a; M.Vout = b; M.Iin = E.Iin; M.Iout = E.Iout; M.en = E.en; M.x = E.x; M.pass = E.pass; M.IL = E.IL;
      M.Pin = a * E.Iin; M.Pout = b * E.Iout; M.V = b; M.I = E.Iout; M.P = Math.max(0, M.Pin - M.Pout);
    },
    post(c, dt, app) {
      const st = c.state, M = c._m;
      st.vo = M.Vout;
      if (st.ol) { if (M.x < 0.9) st.ol = false; } else if (M.x > 1.2 && M.en > 0.5) st.ol = true;
      // thermal model: ~3 s of sustained overload trips thermal shutdown; restarts when cooled
      st.heat = Math.max(0, (st.heat || 0) + dt * (st.ol ? 1 : -0.5));
      if (!st.hot && st.heat > 3) { st.hot = true; app.toast(_t('boost.boost_module_overheated_sustained_ov')); }
      else if (st.hot && st.heat < 1) st.hot = false;
    },
    status(c) {
      const M = c._m, st = c.state;
      if (st.hot) return _t('common.thermal_shutdown');
      if (!(M.en > 0.5)) return st.brown ? _t('boost.brown_out_supply_too_weak_hiccup_res') : _t('common.input_too_low_uvlo_vin') + U.fmtShort(c.props.Vmin, 'V') + ')';
      if (st.ol || M.x > 1.05) return _t('common.over_current_limit_foldback');
      if (M.pass) return _t('boost.pass_through_vin_vout');
      return _t('common.regulating');
    },
    readings(c) {
      const M = c._m, z = (v, e) => (Math.abs(v) < e ? 0 : v);
      const eta = M.Pin > 1e-6 ? (M.Pout / M.Pin * 100).toFixed(1) + ' %' : '—';
      return [[_t('common.input_voltage_vin'), U.fmt(z(M.Vin || 0, 1e-6), 'V')], [_t('common.input_current_iin'), U.fmt(z(M.Iin || 0, 1e-7), 'A')],
        [_t('common.output_voltage_vout'), U.fmt(z(M.Vout || 0, 1e-6), 'V')], [_t('common.output_current_iout'), U.fmt(z(M.Iout || 0, 1e-7), 'A')],
        [_t('boost.input_power_pin'), U.fmt(z(M.Pin || 0, 1e-7), 'W')], [_t('boost.output_power_pout'), U.fmt(z(M.Pout || 0, 1e-7), 'W')],
        [_t('boost.efficiency'), eta], [_t('common.setpoint_vset'), U.fmt(DEFS.boost.vset(c), 'V')], [_t('common.state'), DEFS.boost.status(c)]];
    },
    draw(ctx, c, env) {
      const st = c.state, M = c._m || {};
      // PCB
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; D.rrect(ctx, -76, -42, 156, 90, 5); ctx.fill();
      ctx.fillStyle = D.vgrad(ctx, -46, 46, [[0, '#2f6fd6'], [1, '#1a4aa3']]); D.rrect(ctx, -80, -46, 160, 92, 5); ctx.fill();
      ctx.strokeStyle = '#123577'; ctx.lineWidth = 1; ctx.stroke();
      // copper traces (silk-ish)
      ctx.strokeStyle = 'rgba(120,170,255,0.45)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-72, -20); ctx.lineTo(-40, -20); ctx.moveTo(-72, 20); ctx.lineTo(72, 20); ctx.moveTo(40, -20); ctx.lineTo(72, -20); ctx.stroke();
      // pads
      for (const [x, y] of DEFS.boost.terms) {
        ctx.fillStyle = '#d9b44a'; ctx.beginPath(); ctx.arc(x + Math.sign(-x) * 8, y, 6.5, 0, 7); ctx.fill();
        ctx.fillStyle = '#6b5a24'; ctx.beginPath(); ctx.arc(x + Math.sign(-x) * 8, y, 2.4, 0, 7); ctx.fill();
        D.lead(ctx, x, y, x + Math.sign(-x) * 8, y);
      }
      // inductor (shielded SMD, "220")
      ctx.fillStyle = '#1c1c1c'; D.rrect(ctx, -40, -34, 34, 34, 4); ctx.fill();
      ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(-23, -17, 12, 0, 7); ctx.fill();
      ctx.strokeStyle = '#b87333'; ctx.lineWidth = 1.2; for (let r = 4; r <= 10; r += 3) { ctx.beginPath(); ctx.arc(-23, -17, r, 0, 7); ctx.stroke(); }
      // IC (SOT-23-6)
      ctx.fillStyle = '#111'; ctx.fillRect(-2, -30, 16, 11);
      ctx.fillStyle = '#bbb'; for (let i = 0; i < 3; i++) { ctx.fillRect(0 + i * 5, -33, 2, 3); ctx.fillRect(0 + i * 5, -19, 2, 3); }
      // Schottky diode (SS34)
      ctx.fillStyle = '#222'; ctx.fillRect(20, -32, 20, 12); ctx.fillStyle = '#ccc'; ctx.fillRect(36, -32, 3, 12);
      // ceramic caps
      ctx.fillStyle = '#c9a26b'; ctx.fillRect(-60, -9, 9, 13); ctx.fillRect(48, -32, 9, 14); ctx.fillRect(48, -12, 9, 14);
      // trimmer potentiometer (blue 3296-style with brass screw); slot angle follows Vout
      ctx.fillStyle = '#2a58c8'; ctx.fillRect(-4, -8, 40, 22); ctx.strokeStyle = '#0f2e7a'; ctx.lineWidth = 1; ctx.strokeRect(-4, -8, 40, 22);
      ctx.fillStyle = '#e8c35a'; ctx.beginPath(); ctx.arc(26, 3, 6.5, 0, 7); ctx.fill();
      const ang = (DEFS.boost.vset(c) - 2) / 26 * Math.PI * 1.6;
      ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(26 - Math.cos(ang) * 5, 3 - Math.sin(ang) * 5); ctx.lineTo(26 + Math.cos(ang) * 5, 3 + Math.sin(ang) * 5); ctx.stroke();
      ctx.fillStyle = '#dfe9ff'; ctx.font = 'bold 5px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('103', 8, 8);
      // status LED
      const on = env.running || env.hasRun ? (M.en > 0.5 && !st.hot) : false;
      if (on) glow(ctx, -30, 9, 12, st.ol ? '#ff5a3a' : '#ff3030', 0.9);
      ctx.fillStyle = on ? '#ff4040' : '#6a2020'; ctx.fillRect(-34, 6, 7, 5);
      // silkscreen
      D.upright(ctx, c, 0, 0, (ctx) => {
        const vert = c.rot % 2 === 1;
        ctx.fillStyle = '#f2f6ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 7px sans-serif';
        if (!vert) {
          ctx.fillText('MT3608 DC-DC BOOST', 0, 36);
          ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'left';
          ctx.fillText('VIN+', -66, -30 + 2); ctx.fillText('VIN−', -66, 30);
          ctx.textAlign = 'right'; ctx.fillText('VOUT+', 66, -38); ctx.fillText('VOUT−', 66, 30);
          ctx.textAlign = 'center'; ctx.fillText('ADJ', 8, -12 + 1);
          if (st.hot) { ctx.fillStyle = '#ffdd33'; ctx.font = 'bold 8px sans-serif'; ctx.fillText(_t('common.hot'), -40, 16); }
        } else {
          ctx.fillText('BOOST', 0, 0);
          if (st.hot) { ctx.fillStyle = '#ffdd33'; ctx.fillText('🔥', 0, 12); }
        }
      });
    },
  },
});
CATEGORIES.splice(CATEGORIES.findIndex(x => x[0] === 'source') + 1, 0, ['module', '模块 Modules']);
