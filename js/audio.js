'use strict';
// ===== v14 audio engine =====
// * AUD.wave()      waveform generator shared by the signal generator, the 3.5 mm jack and the microphone's sound source
// * AUD.feed()      per-transducer analyser: collects the simulated voltage samples of one speaker / headphone / piezo and every
//                   128 samples runs a Hann-windowed 512-point FFT -> up to 6 spectral peaks (frequency, amplitude) + a noise level
// * AUD.apply()     turns that "tone spec" into a small bank of Web Audio oscillators (+ a noise source) -> pan -> master gain -> compressor
// * AUD.renderOffline()  renders the same tone spec with an OfflineAudioContext (used by the tests, and exact w.r.t. the live graph)
// The master output is MUTED until the user clicks the toolbar sound button (browser autoplay policy); the analysis itself always runs.
const AUD = (() => {
  const A = { muted: true, volume: 0.6, _ctx: null, _master: null, _comp: null, comps: new Set(), lastFeed: 0, N: 512, HOP: 128, MAXP: 6 };

  // ---------------- waveforms ----------------
  const hash = (k) => { const s = Math.sin(k * 12.9898 + 78.233) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  // kind: sine | triangle | square | sweep | noise | twotone | saw ; o = { f2, tsw, ph }  ->  value in -1..1
  A.wave = (kind, t, f, o) => {
    o = o || {};
    const ph = f * t + (o.ph || 0) / 360;
    const fr = ph - Math.floor(ph);
    switch (kind) {
      case 'square': return fr < 0.5 ? 1 : -1;
      case 'triangle': return fr < 0.25 ? 4 * fr : fr < 0.75 ? 2 - 4 * fr : 4 * fr - 4;
      case 'saw': return 2 * fr - 1;
      case 'noise': return hash(Math.floor(t * 2e4 + 0.5));
      case 'twotone': return 0.5 * (Math.sin(2 * Math.PI * ph) + Math.sin(2 * Math.PI * (o.f2 || 1.5 * f) * t));
      case 'sweep': {   // logarithmic sweep f -> f2 repeating every tsw seconds
        const f1 = Math.max(1, f), f2 = Math.max(f1 * 1.01, o.f2 || 2 * f1), T = Math.max(0.05, o.tsw || 2), tt = t - Math.floor(t / T) * T, k = Math.log(f2 / f1);
        return Math.sin(2 * Math.PI * f1 * T / k * (Math.exp(k * tt / T) - 1));
      }
      default: return Math.sin(2 * Math.PI * ph);
    }
  };
  A.WAVES = [['sine', '正弦波 Sine'], ['triangle', '三角波 Triangle'], ['square', '方波 Square'], ['saw', '锯齿波 Sawtooth'], ['sweep', '扫频 Sweep'], ['noise', '白噪声 White noise'], ['twotone', '双音 Two-tone']];

  // ---------------- FFT (radix-2, in place) ----------------
  const FFT = (re, im) => {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) {
      const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const u = i + k, v = i + k + len / 2, tr = re[v] * cr - im[v] * ci, ti = re[v] * ci + im[v] * cr;
          re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  };
  A.FFT = FFT;
  const HANN = (() => { const w = new Float64Array(A.N); for (let i = 0; i < A.N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / A.N); return w; })();

  // spectral peaks of one window of samples (length N): [{f, a}] sorted by amplitude (a = peak amplitude in volts), noise = rms of the rest
  A.analyse = (x, fs) => {
    const N = A.N, re = new Float64Array(N), im = new Float64Array(N);
    let mean = 0, pw = 0;
    for (let i = 0; i < N; i++) mean += x[i];
    mean /= N;
    for (let i = 0; i < N; i++) { const v = x[i] - mean; pw += v * v; re[i] = v * HANN[i]; }
    const rms = Math.sqrt(pw / N), mag = new Float64Array(N / 2);
    for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);   // placeholder (filled after the FFT)
    FFT(re, im);
    for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    const bw = fs / N, tones = [];
    let top = 0;
    for (let k = 2; k < N / 2 - 1; k++) top = Math.max(top, mag[k]);
    const thr = Math.max(top * 0.06, 1e-9 * N);
    for (let k = 2; k < N / 2 - 1; k++) {
      if (mag[k] >= thr && mag[k] > mag[k - 1] && mag[k] >= mag[k + 1]) {
        const a = Math.log(mag[k - 1] + 1e-30), b = Math.log(mag[k] + 1e-30), c = Math.log(mag[k + 1] + 1e-30), d = a - 2 * b + c;
        const del = d < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / d)) : 0, lp = b - 0.25 * (a - c) * del;
        tones.push({ f: (k + del) * bw, a: 4 * Math.exp(lp) / N });
      }
    }
    tones.sort((p, q) => q.a - p.a); tones.length = Math.min(tones.length, A.MAXP);
    let tp = 0; for (const t of tones) tp += t.a * t.a / 2;
    // noise: the energy not explained by the peaks (a noisy signal has many weak peaks -> keep it as band-limited noise instead)
    const nz = Math.sqrt(Math.max(0, rms * rms - tp));
    // de-aliasing: the simulation samples at fs (5 kHz) – a harmonic k·f0 above fs/2 shows up folded back into 0…fs/2.
    // Peaks that coincide with such a fold of a harmonic of the strongest peak are moved back to their true frequency.
    if (tones.length > 1 && tones[0].f > 40) {
      const f0 = tones[0].f;
      for (let i = 1; i < tones.length; i++) {
        for (let k = 2; k <= 40; k++) {
          const h = k * f0; if (h < 0.45 * fs) continue;
          const fold = Math.abs(((h + fs / 2) % fs + fs) % fs - fs / 2);
          if (Math.abs(fold - tones[i].f) < 1.6 * bw && h < 20000) { tones[i].f = h; tones[i].alias = true; break; }
        }
      }
    }
    return { tones: tones.filter((t) => t.f >= 20 && t.a > 1e-4), noise: nz > 0.05 * rms ? nz : 0, rms };
  };

  // ---------------- per-source analyser ----------------
  // key: sub-channel name ('' or 'L' / 'R'); c.state is not touched, everything lives on c._au[key]
  A.feed = (c, key, v, dt, ref) => {
    const au = (c._au = c._au || {}), s = (au[key] = au[key] || { buf: new Float32Array(A.N), n: 0, spec: { tones: [], noise: 0, rms: 0 }, ref: 1, lvl: 0 });
    // the analyser works at ≤ 6.25 kHz: with a small time step the samples are box-averaged (a crude low-pass + decimation)
    const D = Math.max(1, Math.floor(1 / dt / 6500));
    if (D > 1) { s.acc = (s.acc || 0) + v; s.k = (s.k || 0) + 1; if (s.k < D) return s.spec; v = s.acc / D; s.acc = 0; s.k = 0; }
    s.fs = 1 / (dt * D); s.ref = ref;
    s.buf[s.n % A.N] = v; s.n++;
    A.lastFeed = typeof performance !== 'undefined' ? performance.now() : Date.now();
    A.comps.add(c);
    if (s.n >= A.N && s.n % A.HOP === 0) {
      const w = new Float32Array(A.N), o = s.n % A.N;
      for (let i = 0; i < A.N; i++) w[i] = s.buf[(o + i) % A.N];
      s.spec = A.analyse(w, s.fs); s.lvl = s.spec.rms / ref;
      s.spec.fs = s.fs; s.spec.ref = ref;
      if (A._ctx && !A.muted) A.apply(c, key);
    }
    return s.spec;
  };
  A.spec = (c, key) => (c._au && c._au[key || ''] ? c._au[key || ''].spec : { tones: [], noise: 0, rms: 0 });
  A.reset = (c) => { if (c._au) for (const k in c._au) { c._au[k].n = 0; c._au[k].spec = { tones: [], noise: 0, rms: 0 }; } A.stop(c); };

  // loudness mapping of one partial (peak volts a, reference peak voltage ref) -> linear gain; compressive, documented as approximate
  A.gainOf = (a, ref) => Math.min(0.8, 0.5 * Math.pow(Math.max(0, a) / Math.max(1e-9, ref), 0.8));
  // optional per-frequency weighting (piezo disc resonance …): c.def.wf(f)
  // ---------------- Web Audio ----------------
  A.ctx = () => {
    if (!A._ctx) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      A._ctx = new AC();
      A._master = A._ctx.createGain(); A._master.gain.value = A.muted ? 0 : A.volume;
      A._comp = A._ctx.createDynamicsCompressor(); A._comp.threshold.value = -12; A._comp.ratio.value = 8;
      A._master.connect(A._comp); A._comp.connect(A._ctx.destination);
    }
    return A._ctx;
  };
  A.master = () => { A.ctx(); return A._master; };
  A.setMuted = (m) => {
    A.muted = !!m;
    if (!A.muted) { const x = A.ctx(); if (x && x.state === 'suspended') x.resume(); }
    if (A._master) A._master.gain.setTargetAtTime(A.muted ? 0 : A.volume, A._ctx.currentTime, 0.02);
    if (!A.muted) A.comps.forEach((c) => { if (c._au) for (const k in c._au) A.apply(c, k); });
    A.refreshBtn();
  };
  A.setVolume = (v) => { A.volume = Math.max(0, Math.min(1, v)); if (A._master && !A.muted) A._master.gain.setTargetAtTime(A.volume, A._ctx.currentTime, 0.02); A.refreshBtn(); };
  let noiseBuf = null;
  const noiseBuffer = (ac) => { if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; };
  // build / update the oscillator bank of one source
  A.apply = (c, key) => {
    const ac = A._ctx; if (!ac || !c._au || !c._au[key]) return;
    const s = c._au[key], sp = s.spec, now = ac.currentTime, def = (typeof DEFS !== 'undefined' && DEFS[c.type]) || {};
    if (!s.bank) {
      const bus = ac.createGain(); bus.gain.value = 1;
      let tail = bus;
      if (ac.createStereoPanner) { const p = ac.createStereoPanner(); bus.connect(p); tail = p; s.pan = p; }
      tail.connect(A._master);
      s.bank = { bus, osc: [], noise: null };
    }
    const bk = s.bank, pan = def.pan ? def.pan(c, key) : 0;
    if (s.pan) s.pan.pan.value = Math.max(-1, Math.min(1, pan));
    for (let i = 0; i < A.MAXP; i++) {
      const t = sp.tones[i];
      if (!bk.osc[i]) { if (!t) continue; const o = ac.createOscillator(), g = ac.createGain(); g.gain.value = 0; o.frequency.value = t.f; o.connect(g); g.connect(bk.bus); o.start(); bk.osc[i] = { o, g }; }
      const e = bk.osc[i];
      if (t) { const w = def.wf ? def.wf(t.f) : 1; e.o.frequency.setTargetAtTime(t.f, now, 0.02); e.g.gain.setTargetAtTime(A.gainOf(t.a * w, s.ref), now, 0.03); } else e.g.gain.setTargetAtTime(0, now, 0.03);
    }
    if (sp.noise > 0 || bk.noise) {
      if (!bk.noise) { const n = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter(); n.buffer = noiseBuffer(ac); n.loop = true; f.type = 'lowpass'; f.frequency.value = 2400; g.gain.value = 0; n.connect(f); f.connect(g); g.connect(bk.bus); n.start(); bk.noise = { n, g }; }
      bk.noise.g.gain.setTargetAtTime(A.gainOf(sp.noise * 1.4, s.ref), now, 0.05);
    }
  };
  A.stop = (c) => {
    const ac = A._ctx; if (!ac || !c._au) return;
    for (const k in c._au) { const bk = c._au[k].bank; if (!bk) continue; for (const e of bk.osc) if (e) e.g.gain.setTargetAtTime(0, ac.currentTime, 0.02); if (bk.noise) bk.noise.g.gain.setTargetAtTime(0, ac.currentTime, 0.02); }
  };
  A.silence = () => { A.comps.forEach((c) => A.stop(c)); if (typeof stopBuzzers === 'function') stopBuzzers(); };
  // reconstruct a tone spec offline (exactly the graph of A.apply: sum of sine oscillators with the same gains) -> Promise<Float32Array>
  A.renderOffline = (spec, secs, sr, ref, weight) => {
    sr = sr || 22050; secs = secs || 0.5;
    const OAC = typeof window !== 'undefined' && (window.OfflineAudioContext || window.webkitOfflineAudioContext);
    if (!OAC) return Promise.resolve(null);
    const oc = new OAC(1, Math.floor(sr * secs), sr), mg = oc.createGain();
    mg.gain.value = 1; mg.connect(oc.destination);
    spec.tones.forEach((t, i) => { if (i >= A.MAXP) return; const o = oc.createOscillator(), g = oc.createGain(); o.frequency.value = t.f; g.gain.value = A.gainOf(t.a * (weight ? weight(t.f) : 1), ref || spec.ref || 1); o.connect(g); g.connect(mg); o.start(); });
    if (spec.noise > 0) { const n = oc.createBufferSource(), g = oc.createGain(), b = oc.createBuffer(1, sr, sr), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; n.buffer = b; n.loop = true; g.gain.value = A.gainOf(spec.noise * 1.4, ref || spec.ref || 1); n.connect(g); g.connect(mg); n.start(); }
    return oc.startRendering().then((buf) => buf.getChannelData(0));
  };
  // dominant frequency of a rendered buffer (zero-padded FFT + parabolic peak) – used by the tests
  A.peakFreq = (buf, sr) => {
    const N = 16384, re = new Float64Array(N), im = new Float64Array(N), L = Math.min(buf.length, N);
    for (let i = 0; i < L; i++) re[i] = buf[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / L));
    FFT(re, im);
    let bk = 1, bm = 0; const mg = new Float64Array(N / 2);
    for (let k = 1; k < N / 2; k++) { mg[k] = Math.hypot(re[k], im[k]); if (mg[k] > bm) { bm = mg[k]; bk = k; } }
    const a = Math.log(mg[bk - 1] + 1e-30), b = Math.log(mg[bk]), c = Math.log(mg[bk + 1] + 1e-30), d = a - 2 * b + c, del = d < 0 ? 0.5 * (a - c) / d : 0;
    let pw = 0; for (let i = 0; i < buf.length; i++) pw += buf[i] * buf[i];
    return { f: (bk + del) * sr / N, rms: Math.sqrt(pw / buf.length) };
  };

  // ---------------- toolbar button ----------------
  A.refreshBtn = () => {
    if (typeof document === 'undefined') return;
    const b = document.getElementById('btn-sound'), r = document.getElementById('rng-vol');
    if (b) { b.textContent = A.muted ? '🔇' : (A.volume < 0.34 ? '🔈' : A.volume < 0.67 ? '🔉' : '🔊'); b.classList.toggle('on', !A.muted); b.setAttribute('aria-pressed', String(!A.muted)); }
    if (r) r.value = String(Math.round(A.volume * 100));
  };
  A.initUI = () => {
    if (typeof document === 'undefined') return;
    const b = document.getElementById('btn-sound'), r = document.getElementById('rng-vol');
    if (b) b.addEventListener('click', () => A.setMuted(!A.muted));
    if (r) r.addEventListener('input', () => { A.setVolume(+r.value / 100); });
    A.refreshBtn();
    setInterval(() => { const now = typeof performance !== 'undefined' ? performance.now() : Date.now(); if (A.comps.size && now - A.lastFeed > 350) A.silence(); }, 150);
  };
  return A;
})();
if (typeof module !== 'undefined') module.exports = { AUD };
