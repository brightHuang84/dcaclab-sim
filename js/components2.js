'use strict';
// ===== Extra components: zener, BJT (NPN/PNP), N-MOSFET, 555 timer, oscilloscope, breadboard =====

function drawTO92(ctx, c, txt) {
  D.lead(ctx, -20, 20, -20, 4); D.lead(ctx, 0, 20, 0, 4); D.lead(ctx, 20, 20, 20, 4);
  ctx.fillStyle = D.vgrad(ctx, -24, 6, [[0, '#4a4a4a'], [0.5, '#1c1c1c'], [1, '#050505']]);
  ctx.beginPath(); ctx.moveTo(-17, 6); ctx.lineTo(-17, -10); ctx.arc(0, -10, 17, Math.PI, 0); ctx.lineTo(17, 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-13, -14, 4, 16);
  D.upright(ctx, c, 0, -8, (ctx) => {
    ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt[0], 0, -3); ctx.font = '6.5px sans-serif'; ctx.fillStyle = '#aaa'; ctx.fillText(txt[1], 0, 7);
  });
}

function scopeSamples(c) {
  const st = c.state; if (!st.b1 || !st.count) return null;
  const cap = st.b1.length, cnt = st.count, N = st.N;
  const idx = (i) => (st.head - cnt + i + cap) % cap; // i-th oldest
  let start = Math.max(0, cnt - N - 1);
  if (c.props.trig !== 'roll' && cnt > N + 2) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < cnt; i++) { const v = st.b1[idx(i)]; if (v < mn) mn = v; if (v > mx) mx = v; }
    if (mx - mn > 1e-3) {
      const lvl = c.props.trig === 'zero' ? 0 : (mn + mx) / 2, hy = (mx - mn) * 0.05;
      for (let i = cnt - N - 2; i > 0; i--) {
        if (st.b1[idx(i)] >= lvl && st.b1[idx(i - 1)] < lvl) {
          let ok = false; for (let k = i - 1; k >= Math.max(0, i - N); k--) if (st.b1[idx(k)] < lvl - hy) { ok = true; break; }
          if (ok) { start = i; break; }
        }
      }
    }
  }
  const n = Math.min(N + 1, cnt - start), v1 = new Float64Array(n), v2 = new Float64Array(n);
  for (let i = 0; i < n; i++) { v1[i] = st.b1[idx(start + i)]; v2[i] = st.b2[idx(start + i)]; }
  return { v1, v2, n, N };
}

function drawScopeScreen(ctx, c, x, y, w, h, big) {
  ctx.fillStyle = '#0c1a12'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(120,200,150,0.22)'; ctx.lineWidth = big ? 1 : 0.6;
  ctx.beginPath();
  for (let i = 1; i < 10; i++) { const xx = x + w * i / 10; ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); }
  for (let i = 1; i < 8; i++) { const yy = y + h * i / 8; ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(150,230,180,0.45)'; ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
  const P = c.props, fs = big ? 10 : 6.5;
  ctx.font = fs + 'px "Consolas", monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  if (P.mode === 'xy') return drawScopeXY(ctx, c, x, y, w, h, big, fs);
  if (P.mode === 'fft') return drawScopeFFT(ctx, c, x, y, w, h, big, fs);
  const S = scopeSamples(c);
  const info = [];
  if (S) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const tr = (arr, vdiv, pos, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = big ? 1.8 : 1.3; ctx.lineJoin = 'round'; ctx.beginPath();
      for (let i = 0; i < S.n; i++) {
        const xx = x + w * i / S.N, yy = y + h / 2 - (arr[i] / vdiv + pos) * h / 8;
        i ? ctx.lineTo(xx, U.clamp(yy, y - 5, y + h + 5)) : ctx.moveTo(xx, U.clamp(yy, y - 5, y + h + 5));
      }
      ctx.stroke();
    };
    if (P.ch2on) tr(S.v2, P.v2div, P.pos2, '#39d0ff');
    tr(S.v1, P.v1div, P.pos1, '#ffe14a');
    ctx.restore();
    const stat = (arr) => { let mn = Infinity, mx = -Infinity; for (let i = 0; i < S.n; i++) { mn = Math.min(mn, arr[i]); mx = Math.max(mx, arr[i]); } return [mn, mx]; };
    const [a1, b1] = stat(S.v1), [a2, b2] = stat(S.v2);
    info.push(['#ffe14a', (big ? 'CH1 Vpp ' : '①') + U.fmt(b1 - a1, 'V', 3)]);
    if (P.ch2on) info.push(['#39d0ff', (big ? 'CH2 Vpp ' : '②') + U.fmt(b2 - a2, 'V', 3)]);
    if (c.state.freq) info.push(['#9fe8b8', 'f ≈ ' + U.fmt(c.state.freq, 'Hz', 4)]);
  }
  ctx.fillStyle = '#ffe14a'; ctx.fillText('CH1 ' + U.fmtShort(P.v1div, 'V') + '/div', x + 3, y + 2);
  if (P.ch2on) { ctx.fillStyle = '#39d0ff'; ctx.fillText('CH2 ' + U.fmtShort(P.v2div, 'V') + '/div', x + w * 0.36, y + 2); }
  ctx.fillStyle = '#cfe'; ctx.textAlign = 'right'; ctx.fillText(U.fmtShort(P.tdiv, 's') + '/div', x + w - 3, y + 2); ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  let ix = x + 3;
  info.forEach(([col, t]) => { ctx.fillStyle = col; ctx.fillText(t, ix, y + h - 2); ix += ctx.measureText(t).width + fs * 1.2; });
  ctx.textBaseline = 'alphabetic';
}

// raw (untriggered) latest samples, oldest first
function scopeRaw(c, n) {
  const st = c.state; if (!st.b1 || !st.count) return null;
  const cap = st.b1.length, cnt = Math.min(st.count, n || st.count), v1 = new Float64Array(cnt), v2 = new Float64Array(cnt);
  for (let i = 0; i < cnt; i++) { const k = (st.head - cnt + i + cap) % cap; v1[i] = st.b1[k]; v2[i] = st.b2[k]; }
  return { v1, v2, n: cnt, sdt: st.sdt };
}
function drawScopeXY(ctx, c, x, y, w, h, big, fs) {
  const P = c.props, S = scopeRaw(c, 3 * (c.state.N || 300));
  const cx = x + w / 2, cy = y + h / 2, sx = w / 10, sy = h / 8;
  if (S && S.n > 2) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = big ? 1.6 : 1.1; ctx.lineJoin = 'round'; ctx.shadowColor = '#7dff9a'; ctx.shadowBlur = big ? 4 : 2;
    ctx.beginPath();
    for (let i = 0; i < S.n; i++) {
      const px = cx + (S.v1[i] / P.v1div + P.pos1) * sx, py = cy - (S.v2[i] / P.v2div + P.pos2) * sy;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke(); ctx.restore();
  }
  ctx.fillStyle = '#ffe14a'; ctx.fillText('X=CH1 ' + U.fmtShort(P.v1div, 'V') + '/div', x + 3, y + 2);
  ctx.fillStyle = '#39d0ff'; ctx.textAlign = 'right'; ctx.fillText('Y=CH2 ' + U.fmtShort(P.v2div, 'V') + '/div', x + w - 3, y + 2); ctx.textAlign = 'left';
  ctx.fillStyle = '#9fe8b8'; ctx.textBaseline = 'bottom'; ctx.fillText(_t('parts.x_y_mode'), x + 3, y + h - 2); ctx.textBaseline = 'alphabetic';
}
// magnitude spectrum (Hann window, zero-padded radix-2 FFT); amplitude scaled to the sinusoid peak value
function fftMag(sig, sdt) {
  let n = 1; while (n < sig.length) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n), L = sig.length;
  let mean = 0; for (let i = 0; i < L; i++) mean += sig[i]; mean /= L;
  let wsum = 0;
  for (let i = 0; i < L; i++) { const wv = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (L - 1)); wsum += wv; re[i] = (sig[i] - mean) * wv; }
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  const half = n / 2, mag = new Float64Array(half);
  for (let k = 0; k < half; k++) mag[k] = 2 * Math.hypot(re[k], im[k]) / wsum;
  return { mag, df: 1 / (n * sdt), n, L, dc: mean };
}
function scopeFFT(c) {
  const st = c.state; if (!st.count || st.count < 64) return null;
  if (st._fft && st._fftAt === st.head + ':' + st.count) return st._fft;
  const S = scopeRaw(c);
  const f1 = fftMag(S.v1, S.sdt), f2 = fftMag(S.v2, S.sdt);
  const peak = (F) => { let k = 1; for (let i = 2; i < F.mag.length; i++) if (F.mag[i] > F.mag[k]) k = i;
    // parabolic interpolation of the peak bin
    const a = F.mag[k - 1] || 0, b = F.mag[k], d = F.mag[k + 1] || 0, den = a - 2 * b + d, off = den ? 0.5 * (a - d) / den : 0;
    // amplitude from the main-lobe energy (Hann ENBW = 1.5 bins) → free of scalloping loss
    const r = F.n / F.L, W = Math.ceil(2 * r) + 1; let e = 0;
    for (let i = Math.max(1, k - W); i <= Math.min(F.mag.length - 1, k + W); i++) e += F.mag[i] * F.mag[i];
    return { f: (k + off) * F.df, a: Math.sqrt(e / (1.5 * r)), k }; };
  st._fft = { f1, f2, p1: peak(f1), p2: peak(f2), fs: 1 / S.sdt, n: S.n };
  st._fftAt = st.head + ':' + st.count;
  return st._fft;
}
function drawScopeFFT(ctx, c, x, y, w, h, big, fs) {
  const P = c.props, F = scopeFFT(c);
  const fmax = F ? F.fs / 2 / (P.fzoom || 1) : 0;
  const dbTop = 20, dbBot = -60; // dBV, 10 dB/div over 8 divisions
  if (F) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const tr = (FF, col) => {
      const kmax = Math.min(FF.mag.length - 1, Math.ceil(fmax / FF.df));
      ctx.strokeStyle = col; ctx.lineWidth = big ? 1.4 : 1; ctx.beginPath();
      for (let k = 0; k <= kmax; k++) {
        const db = 20 * Math.log10(FF.mag[k] + 1e-9), px = x + w * (k * FF.df) / fmax, py = y + h * (dbTop - db) / (dbTop - dbBot);
        k ? ctx.lineTo(px, U.clamp(py, y - 2, y + h + 2)) : ctx.moveTo(px, U.clamp(py, y - 2, y + h + 2));
      }
      ctx.stroke();
    };
    if (P.ch2on) tr(F.f2, 'rgba(57,208,255,0.85)');
    tr(F.f1, '#ffe14a');
    // peak marker
    const px = x + w * F.p1.f / fmax;
    if (px <= x + w) { ctx.fillStyle = '#ff6b5e'; ctx.beginPath(); ctx.moveTo(px, y + 12); ctx.lineTo(px - 3, y + 6); ctx.lineTo(px + 3, y + 6); ctx.fill(); }
    ctx.restore();
  }
  ctx.fillStyle = '#cfe'; ctx.fillText(big ? 'FFT 10dB/div top=+20dBV' : 'FFT 10dB/div', x + 3, y + 2);
  ctx.textAlign = 'right'; ctx.fillText(U.fmtShort(fmax / 10, 'Hz') + '/div', x + w - 3, y + 2); ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  if (F) { ctx.fillStyle = '#ffe14a'; ctx.fillText((big ? _t('parts.peak') : '') + U.fmt(F.p1.f, 'Hz', 3) + ' ' + U.fmt(F.p1.a, 'V', 3), x + 3, y + h - 2); }
  ctx.textBaseline = 'alphabetic';
}

const TDIV_OPTS = [1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1].map(v => [v, U.fmtShort(v, 's') + '/div']);
const VDIV_OPTS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20].map(v => [v, U.fmtShort(v, 'V') + '/div']);

// ---- breadboard geometry ----
const BB_ROWS = [[-8, 'T1'], [-7, 'T2'], [-5, 'A'], [-4, 'A'], [-3, 'A'], [-2, 'A'], [-1, 'A'], [1, 'B'], [2, 'B'], [3, 'B'], [4, 'B'], [5, 'B'], [7, 'B1'], [8, 'B2']];
function bbHoles(c) {
  const cols = c.props.cols | 0, key = c.x + ',' + c.y + ',' + c.rot + ',' + cols;
  if (c._holesKey === key) return c._holes;
  const res = [], half = Math.floor(cols / 2);
  for (let j = 0; j < cols; j++) {
    for (const [r, grp] of BB_ROWS) {
      const lx = (j - half) * GRID, ly = r * GRID;
      const [rx, ry] = U.rot(lx, ly, c.rot);
      const strip = grp.length === 2 ? grp : grp + j; // rails span the whole row, terminal strips are per column
      res.push({ x: c.x + rx, y: c.y + ry, lx, ly, strip, col: j, row: r });
    }
  }
  c._holes = res; c._holesKey = key; return res;
}

Object.assign(DEFS, {
  zener: {
    name: '稳压二极管', en: 'Zener Diode', cat: 'semi', terms: [[-40, 0], [40, 0]], termNames: ['阳极 A', '阴极 K'], box: [-40, -10, 40, 10],
    props: [{ k: 'Vz', label: '稳压值 Vz', unit: 'V', def: 5.1, min: 0.5 }],
    label: (c) => 'Vz=' + U.fmtShort(c.props.Vz, 'V'),
    build(c, n, m) { c._p = m.addD(n[0], n[1], 1e-14, VT, c.state, c.props.Vz, 1e-3, 1.5 * VT); },
    draw(ctx, c) {
      D.lead(ctx, -40, 0, -18, 0); D.lead(ctx, 18, 0, 40, 0);
      ctx.fillStyle = D.vgrad(ctx, -7, 7, [[0, '#ffb38a'], [0.45, '#e0602a'], [1, '#8a2a08']]);
      D.rrect(ctx, -18, -7, 36, 14, 4); ctx.fill();
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(9, -7, 5, 14);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(-9, -4); ctx.lineTo(-9, 4); ctx.lineTo(1, 0); ctx.closePath(); ctx.moveTo(-1, -5); ctx.lineTo(1, -4); ctx.lineTo(1, 4); ctx.lineTo(3, 5); ctx.stroke();
    },
  },
  npn: {
    name: 'NPN 三极管', en: 'NPN BJT', cat: 'semi', terms: [[-20, 20], [0, 20], [20, 20]], termNames: ['E 发射极', 'B 基极', 'C 集电极'], box: [-20, -28, 20, 20],
    props: [{ k: 'BF', label: '电流放大倍数 β', unit: '', def: 100, min: 1 }, { k: 'Is', label: '饱和电流 Is', unit: 'A', def: 1e-14, min: 1e-20 }],
    label: (c) => 'β=' + c.props.BF,
    build(c, n, m) { c._q = m.addQ(n[1], n[2], n[0], 1, { BF: c.props.BF, Is: c.props.Is, BR: 1 }, c.state); c._p = null; },
    measure(c, m) { const q = c._q, n = c._nodes; c._m.I = q.ic; c._m.Ib = q.ib; c._m.Ie = q.ie; c._m.V = m.v(n[2]) - m.v(n[0]); c._m.Vbe = m.v(n[1]) - m.v(n[0]); c._m.P = Math.abs(q.ic * (m.v(n[2]) - m.v(n[0])) + q.ib * (m.v(n[1]) - m.v(n[0]))); },
    draw(ctx, c) { drawTO92(ctx, c, ['NPN', 'E B C']); },
  },
  pnp: {
    name: 'PNP 三极管', en: 'PNP BJT', cat: 'semi', terms: [[-20, 20], [0, 20], [20, 20]], termNames: ['E 发射极', 'B 基极', 'C 集电极'], box: [-20, -28, 20, 20],
    props: [{ k: 'BF', label: '电流放大倍数 β', unit: '', def: 100, min: 1 }, { k: 'Is', label: '饱和电流 Is', unit: 'A', def: 1e-14, min: 1e-20 }],
    label: (c) => 'β=' + c.props.BF,
    build(c, n, m) { c._q = m.addQ(n[1], n[2], n[0], -1, { BF: c.props.BF, Is: c.props.Is, BR: 1 }, c.state); c._p = null; },
    measure(c, m) { DEFS.npn.measure(c, m); },
    draw(ctx, c) { drawTO92(ctx, c, ['PNP', 'E B C']); },
  },
  nmos: {
    name: 'N 沟道 MOS 管', en: 'N-MOSFET', cat: 'semi', terms: [[-20, 20], [0, 20], [20, 20]], termNames: ['G 栅极', 'D 漏极', 'S 源极'], box: [-20, -36, 20, 20],
    props: [{ k: 'Vth', label: '开启电压 Vth', unit: 'V', def: 2, min: 0.1 }, { k: 'K', label: '跨导系数 K', unit: 'A/V²', def: 0.5, min: 1e-6 }],
    label: (c) => 'Vth=' + U.fmtShort(c.props.Vth, 'V'),
    build(c, n, m) { c._q = m.addM(n[0], n[1], n[2], 1, { Vth: c.props.Vth, K: c.props.K, lam: 0.01 }, c.state); c._p = null; },
    measure(c, m) { const q = c._q, n = c._nodes; c._m.I = q.id; c._m.V = m.v(n[1]) - m.v(n[2]); c._m.Vgs = m.v(n[0]) - m.v(n[2]); c._m.P = Math.abs(q.id * c._m.V); },
    draw(ctx, c) {
      D.lead(ctx, -20, 20, -20, 6); D.lead(ctx, 0, 20, 0, 6); D.lead(ctx, 20, 20, 20, 6);
      ctx.fillStyle = D.vgrad(ctx, -36, -14, [[0, '#f2f2f2'], [0.5, '#b0b5bb'], [1, '#6a7078']]);
      D.rrect(ctx, -18, -36, 36, 24, 3); ctx.fill();
      ctx.fillStyle = '#556'; ctx.beginPath(); ctx.arc(0, -28, 4, 0, 7); ctx.fill();
      ctx.fillStyle = D.vgrad(ctx, -16, 8, [[0, '#444'], [1, '#0a0a0a']]);
      ctx.fillRect(-18, -16, 36, 24);
      D.upright(ctx, c, 0, -4, (ctx) => { ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 7.5px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N-MOS', 0, -3); ctx.fillStyle = '#aaa'; ctx.font = '6.5px sans-serif'; ctx.fillText('G D S', 0, 6); });
    },
  },
  ic555: {
    name: '555 定时器', en: '555 Timer', cat: 'semi',
    terms: [[-40, 20], [-20, 20], [0, 20], [20, 20], [20, -20], [0, -20], [-20, -20], [-40, -20]],
    termNames: ['1 GND', '2 TRIG', '3 OUT', '4 RESET', '5 CTRL', '6 THR', '7 DIS', '8 VCC'], box: [-54, -20, 34, 20],
    props: [],
    label: () => '',
    // behavioural model: 3×5k divider, two comparators, SR flip-flop, output stage (≈10 Ω) and discharge switch
    build(c, n, m) {
      const [GND, , OUT, RST, CTRL, , DIS, VCC] = n, q = !!c.state.q;
      const mid = m.newNode();
      m.addR(VCC, CTRL, 1 / 5000); m.addR(CTRL, mid, 1 / 5000); m.addR(mid, GND, 1 / 5000);
      m.addR(RST, VCC, 1e-5);
      c._oh = m.addR(OUT, VCC, q ? 0.1 : G_OFF); c._ol = m.addR(OUT, GND, q ? G_OFF : 0.1); c._dis = m.addR(DIS, GND, q ? G_OFF : 0.1);
      c._p = null;
    },
    measure(c, m) { const n = c._nodes; c._m.V = m.v(n[2]) - m.v(n[0]); c._m.I = c._oh.i - c._ol.i; c._m.P = 0; },
    // pin voltages relative to GND
    pins(c, m) { const n = c._nodes, g = m.v(n[0]); return { vcc: m.v(n[7]) - g, vc: m.v(n[4]) - g, vth: m.v(n[5]) - g, vtr: m.v(n[1]) - g, vr: m.v(n[3]) - g }; },
    logic(q, P) { if (P.vcc < 2 || P.vr < 0.7) return false; if (P.vtr < P.vc / 2) return true; if (P.vth > P.vc) return false; return q; },
    setQ(c, q, t, app) {
      const st = c.state; st.q = q;
      c._oh.g = q ? 0.1 : G_OFF; c._ol.g = q ? G_OFF : 0.1; c._dis.g = q ? G_OFF : 0.1;
      app.net.needStamp = true;
      if (q) { if (st.lastRise !== undefined) { const T = t - st.lastRise; st.period = T; st.freq = 1 / T; } st.lastRise = t; st.rises = (st.rises || 0) + 1; }
      else st.lastFall = t;
    },
    // sub-step event localisation: linear interpolation of the comparator inputs inside the step
    event(c, m, app) {
      const st = c.state, D5 = DEFS.ic555, P1 = D5.pins(c, m), P0 = st.prev;
      const q0 = !!st.q, q1 = D5.logic(q0, P1);
      if (q1 === q0) return null;
      let theta = 1;
      if (P0) {
        const f0 = q1 ? P0.vtr - P0.vc / 2 : P0.vth - P0.vc, f1 = q1 ? P1.vtr - P1.vc / 2 : P1.vth - P1.vc;
        if (q1 && f0 >= 0 && f1 < 0) theta = f0 / (f0 - f1);
        else if (!q1 && f0 <= 0 && f1 > 0) theta = -f0 / (f1 - f0);
      }
      return { theta, fire: (t) => D5.setQ(c, q1, t, app) };
    },
    post(c, dt, app) {
      const m = app.net, st = c.state, D5 = DEFS.ic555, P = D5.pins(c, m);
      const q = D5.logic(!!st.q, P);
      if (q !== !!st.q) D5.setQ(c, q, app.t, app); // (event localisation disabled / missed)
      st.prev = P;
      c._m.freq = st.freq;
    },
    draw(ctx, c) {
      for (const [x, y] of DEFS.ic555.terms) D.lead(ctx, x, y, x, y > 0 ? 10 : -10);
      ctx.fillStyle = D.vgrad(ctx, -13, 13, [[0, '#3a3a3a'], [0.5, '#1a1a1a'], [1, '#080808']]);
      D.rrect(ctx, -52, -13, 84, 26, 3); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-52, 0, 5, -Math.PI / 2, Math.PI / 2); ctx.fill();
      ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(-45, 7, 1.8, 0, 7); ctx.fill();
      D.upright(ctx, c, -10, 0, (ctx) => {
        ctx.fillStyle = '#eee'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NE555', 0, -1);
        ctx.fillStyle = c.state.q ? '#3f3' : '#555'; ctx.beginPath(); ctx.arc(30, 0, 2.5, 0, 7); ctx.fill();
      });
      ctx.fillStyle = '#bbb'; ctx.font = '6px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      DEFS.ic555.terms.forEach(([x, y], i) => ctx.fillText(String(i + 1), x, y > 0 ? 8 : -8));
    },
  },
  scope: {
    name: '示波器', en: 'Oscilloscope', cat: 'meter', terms: [[-40, 80], [0, 80], [40, 80]], termNames: ['CH1', 'CH2', 'GND ⏚'], box: [-100, -84, 100, 80],
    props: [
      { k: 'tdiv', label: '时基 Time/div', kind: 'select', num: true, opts: TDIV_OPTS, def: 5e-3 },
      { k: 'v1div', label: 'CH1 Volts/div', kind: 'select', num: true, opts: VDIV_OPTS, def: 5 },
      { k: 'v2div', label: 'CH2 Volts/div', kind: 'select', num: true, opts: VDIV_OPTS, def: 5 },
      { k: 'pos1', label: 'CH1 垂直位移 (div)', unit: '', def: 0 },
      { k: 'pos2', label: 'CH2 垂直位移 (div)', unit: '', def: 0 },
      { k: 'ch2on', label: '显示 CH2', kind: 'bool', def: true },
      { k: 'mode', label: '显示模式 Mode', kind: 'select', opts: [['yt', 'Y-T 时域波形'], ['xy', 'X-Y 李萨如 (CH1=X, CH2=Y)'], ['fft', 'FFT 频谱 (CH1, CH2)']], def: 'yt' },
      { k: 'fzoom', label: 'FFT 频率范围', kind: 'select', num: true, opts: [[1, '0 – fs/2'], [2, '0 – fs/4'], [5, '0 – fs/10'], [10, '0 – fs/20'], [20, '0 – fs/40']], def: 1 },
      { k: 'trig', label: '触发 Trigger', kind: 'select', opts: [['auto', 'CH1 上升沿 (自动电平)'], ['zero', 'CH1 上升沿 0V'], ['roll', '滚动 Roll (无触发)']], def: 'auto' },
    ],
    label: () => '',
    build(c, n, m) { m.addR(n[0], n[2], 1e-8); m.addR(n[1], n[2], 1e-8); c._p = null; },
    measure(c, m) { const n = c._nodes; c._m.V = m.v(n[0]) - m.v(n[2]); c._m.V2 = m.v(n[1]) - m.v(n[2]); c._m.I = 0; },
    post(c, dt, app) {
      const st = c.state, P = c.props, N = 300, W = 10 * P.tdiv, t = app.t;
      if (st.W !== W || !st.b1) { st.W = W; st.N = N; st.sdt = W / N; st.b1 = new Float64Array(4096); st.b2 = new Float64Array(4096); st.head = 0; st.count = 0; st.nextT = t; st.pt = undefined; }
      const v1 = c._m.V, v2 = c._m.V2;
      if (st.pt === undefined) { st.pt = t - dt; st.p1 = v1; st.p2 = v2; }
      const cap = st.b1.length;
      while (st.nextT <= t + 1e-15) {
        const f = U.clamp((st.nextT - st.pt) / (t - st.pt || 1), 0, 1);
        st.b1[st.head] = st.p1 + (v1 - st.p1) * f; st.b2[st.head] = st.p2 + (v2 - st.p2) * f;
        st.head = (st.head + 1) % cap; st.count = Math.min(cap, st.count + 1); st.nextT += st.sdt;
      }
      // frequency counter on CH1 (hysteresis around running mid level)
      st.mn = Math.min(st.mn === undefined ? v1 : st.mn + (v1 - st.mn) * 1e-4, v1); st.mx = Math.max(st.mx === undefined ? v1 : st.mx + (v1 - st.mx) * 1e-4, v1);
      const lvl = (st.mn + st.mx) / 2, hy = (st.mx - st.mn) * 0.1;
      if (st.mx - st.mn > 1e-3) {
        if (v1 < lvl - hy) st.armed = true;
        if (st.armed && v1 >= lvl + hy) { st.armed = false; if (st.lastX !== undefined) { const T = t - st.lastX; st.freq = st.freq ? st.freq + (1 / T - st.freq) * 0.5 : 1 / T; } st.lastX = t; }
      }
      if (st.lastX !== undefined && t - st.lastX > 5) st.freq = 0;
      st.pt = t; st.p1 = v1; st.p2 = v2;
    },
    draw(ctx, c) {
      D.lead(ctx, -40, 64, -40, 80); D.lead(ctx, 0, 64, 0, 80); D.lead(ctx, 40, 64, 40, 80);
      ctx.fillStyle = D.vgrad(ctx, -84, 64, [[0, '#dfe5ec'], [1, '#9aa7b6']]);
      D.rrect(ctx, -100, -84, 200, 148, 10); ctx.fill();
      ctx.strokeStyle = '#6b7888'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#1b222b'; D.rrect(ctx, -94, -78, 148, 114, 5); ctx.fill();
      // screen content stays upright whatever the component rotation
      ctx.save(); ctx.translate(-20, -21); ctx.rotate(-c.rot * Math.PI / 2);
      if (c.rot % 2) { // portrait slot: keep the 10×8 landscape graticule, scaled to fit, on a dark bezel
        ctx.fillStyle = '#0a1410'; ctx.fillRect(-53, -70, 106, 140);
        const k = 106 / 140; ctx.scale(k, k); drawScopeScreen(ctx, c, -70, -53, 140, 106, false);
      } else drawScopeScreen(ctx, c, -70, -53, 140, 106, false);
      ctx.restore();
      // knobs
      const knob = (x, y, col, lab) => {
        const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 10); g.addColorStop(0, '#777'); g.addColorStop(1, '#222');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 8); ctx.stroke();
        ctx.fillStyle = '#233'; ctx.font = 'bold 6.5px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lab, x, y + 17);
      };
      knob(78, -60, '#ffe14a', 'CH1 V/div'); knob(78, -22, '#39d0ff', 'CH2 V/div'); knob(78, 16, '#fff', 'TIME/div');
      const lbl = (ctx) => { ctx.fillStyle = '#233'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(_t('scope.oscilloscope_dual_channel'), 0, 0); };
      if (c.rot % 2) { ctx.save(); ctx.translate(-20, 47); if (c.rot === 3) ctx.rotate(Math.PI); lbl(ctx); ctx.restore(); } // runs along the narrow strip
      else D.upright(ctx, c, -20, 47, lbl);
      D.jack(ctx, -40, 60, '#ffd400'); D.jack(ctx, 0, 60, '#1fb8ff'); D.jack(ctx, 40, 60, '#222');
      ctx.fillStyle = '#233'; ctx.font = 'bold 6.5px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('CH1', -58, 62); ctx.fillText('CH2', -18, 62); ctx.fillText('GND', 22, 62);
    },
  },
  breadboard: {
    name: '面包板', en: 'Breadboard', cat: 'other', terms: [], board: true,
    box: [-320, -180, 300, 180],
    props: [{ k: 'cols', label: '列数', kind: 'select', num: true, opts: [[20, '20 列'], [30, '30 列'], [40, '40 列']], def: 30 }],
    label: () => '',
    boxOf(c) { const cols = c.props.cols | 0, half = Math.floor(cols / 2); return [(-half - 1) * GRID, -9 * GRID - 4, (cols - half) * GRID, 9 * GRID + 4]; },
    build() {},
    draw(ctx, c, env) {
      const [x0, y0, x1, y1] = DEFS.breadboard.boxOf(c), cols = c.props.cols | 0, half = Math.floor(cols / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; D.rrect(ctx, x0 + 3, y0 + 4, x1 - x0, y1 - y0, 8); ctx.fill();
      ctx.fillStyle = D.vgrad(ctx, y0, y1, [[0, '#fbfaf6'], [1, '#e9e5da']]);
      D.rrect(ctx, x0, y0, x1 - x0, y1 - y0, 8); ctx.fill();
      ctx.strokeStyle = '#cfc8b8'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#dcd6c8'; ctx.fillRect(x0 + 6, -8, x1 - x0 - 12, 16); // centre channel
      ctx.fillStyle = '#ece8de'; ctx.fillRect(x0 + 6, -6.3 * GRID, x1 - x0 - 12, 1); ctx.fillRect(x0 + 6, 6.3 * GRID, x1 - x0 - 12, 1);
      // rail lines
      const rail = (y, col) => { ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x0 + 16, y); ctx.lineTo(x1 - 16, y); ctx.stroke(); };
      rail(-8.6 * GRID, '#d62828'); rail(-6.4 * GRID, '#1d5fd1'); rail(6.4 * GRID, '#d62828'); rail(8.6 * GRID, '#1d5fd1');
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#d62828'; ctx.fillText('+', x0 + 9, -8 * GRID); ctx.fillText('+', x0 + 9, 7 * GRID);
      ctx.fillStyle = '#1d5fd1'; ctx.fillText('−', x0 + 9, -7 * GRID); ctx.fillText('−', x0 + 9, 8 * GRID);
      ctx.fillStyle = '#9a927f'; ctx.font = '7px sans-serif';
      const letters = 'abcde fghij';
      [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].forEach((r, i) => { if (r) ctx.fillText(letters[i], x0 + 9, r * GRID); });
      for (let j = 0; j < cols; j += 5) ctx.fillText(String(j + 1), (j - half) * GRID, -5.8 * GRID);
      // holes (highlight hovered strip)
      const hv = env.hoverStrip && env.hoverStrip.c === c ? env.hoverStrip.strip : null;
      for (const h of bbHoles(c)) {
        const on = hv === h.strip;
        ctx.fillStyle = on ? '#2fbf5a' : '#3b3a36';
        ctx.fillRect(h.lx - 2.8, h.ly - 2.8, 5.6, 5.6);
        if (on) { ctx.strokeStyle = 'rgba(47,191,90,0.5)'; ctx.lineWidth = 3; ctx.strokeRect(h.lx - 4.5, h.ly - 4.5, 9, 9); }
      }
    },
  },
});
CATEGORIES.splice(3, 0, ['semi', '半导体 Semiconductors']);
DEFS.diode.cat = 'semi';
