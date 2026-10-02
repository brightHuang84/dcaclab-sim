// Convergence fuzz / stress harness.
//   node fuzz.js [count=300] [seed=1]        (URL env = page to test, default http://127.0.0.1:8765/index.html)
// Builds deterministic pseudo-random circuits from several families (rectifier power supplies with
// transformers / regulators, random non-linear graphs with BJTs / MOSFETs / op-amps / SCRs / regulators,
// switching circuits with inductive loads) plus every built-in example and the user regression circuits,
// runs each in the transient simulator and counts time steps whose Newton solve did not converge.
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const COUNT = +(process.argv[2] || 300), SEED = +(process.argv[3] || 1);
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 860 }, locale: 'zh-CN' });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto((process.env.URL || 'http://127.0.0.1:8765/index.html') + '?fresh=1');
  await page.waitForTimeout(400);
  if (process.env.SPARSE) await page.evaluate(() => { MNA.forceSparse = true; });
  if (process.env.DENSE) await page.evaluate(() => { MNA.forceDense = true; });
  const fixtures = fs.readdirSync(path.join(__dirname, 'fixtures')).filter(f => f.endsWith('.json')).map(f => [f, JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8'))]);
  const ONE = process.env.ONE || '';
  if (process.env.DBG) await page.evaluate(() => { window.FUZZ_KEEP = true; });
  const res = await page.evaluate(([COUNT, SEED, fixtures, ONE]) => {
    let s = SEED >>> 0 || 1;
    const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const logu = (lo, hi) => lo * Math.pow(hi / lo, rnd());
    const A = (t, x, y, r, p) => app.addComp(t, x, y, r || 0, p || {});
    const T = (c, i) => app.termPos(c, i);
    const NEW = () => { app.clearAll(); app.pause(); app.resetSim(); };
    const toast0 = app.toast; app.toast = () => {};
    // net-based builder: every circuit node is a far-away hub point; terminals are wired to hubs
    const mk = () => {
      let k = 0; const hubs = [];
      const hub = (i) => { while (hubs.length <= i) { const j = hubs.length; hubs.push([4000 + j * 260 + 7 * (j % 3) * 20, -4000 - j * 180 - 40 * (j % 2)]); } return hubs[i]; };
      const place = () => { const i = k++; return [(i % 8) * 340, Math.floor(i / 8) * 340]; };
      const add = (type, nodes, props) => { const [x, y] = place(); const c = A(type, x, y, 0, props); nodes.forEach((n, i) => { if (n === null || n === undefined) return; const p = T(c, i), h = hub(n); app.addWire(p[0], p[1], h[0], h[1], 0); }); return c; };
      const gnd = (n) => { const h = hub(n); const g = A('ground', h[0] + 100, h[1] + 200, 0); const p = T(g, 0); app.addWire(p[0], p[1], h[0], h[1], 0); };
      return { add, gnd };
    };
    const fam = {
      psu() { // mains / low-voltage AC -> (fuse) -> (transformer) -> rectifier -> reservoir C -> (regulator) -> loads
        const b = mk(); let n = 2; const nn = () => n++;
        const Vp = pick([5, 9, 12, 24, 120, 170, 311, 325]), f = pick([50, 60, 400, 1000]);
        b.add('ac', [0, 1], { Vp, f }); let a1 = 0, a2 = 1;
        if (rnd() < 0.4) { const x = nn(); b.add('fuse', [a1, x], { rating: pick([0.5, 1, 2]) }); a1 = x; }
        if (Vp > 20 || rnd() < 0.5) { const s1 = nn(), s2 = nn(); b.add('xfmr', [a1, a2, s1, s2], { n: Math.max(1, Vp / logu(6, 30)), Lp: logu(0.2, 5), k: pick([0.95, 0.99, 0.999]) }); a1 = s1; a2 = s2; }
        if (rnd() < 0.5) { const x = nn(), y = nn(); b.add('resistor', [a1, x], { R: logu(0.05, 2) }); b.add('resistor', [a2, y], { R: logu(0.05, 2) }); a1 = x; a2 = y; }
        const P = nn(), G = nn(), kind = pick(['bridge', 'four', 'half', 'four']);
        const D = pick(['diode', 'rectifier', 'schottky']);
        if (kind === 'bridge') b.add('bridge', [a1, a2, P, G], {});
        else if (kind === 'four') { b.add(D, [a1, P]); b.add(D, [a2, P]); b.add(D, [G, a1]); b.add(D, [G, a2]); }
        else { b.add(D, [a1, P]); b.add('resistor', [a2, G], { R: 1e-3 }); }
        b.gnd(rnd() < 0.8 ? G : a2);
        b.add(rnd() < 0.5 ? 'capacitor' : 'ecap', [P, G], { C: logu(1e-6, 4.7e-3), Vr: 400 });
        if (rnd() < 0.5) b.add('ccap', [P, G], { C: 1e-7, Vr: 400 });
        if (rnd() < 0.5) b.add('resistor', [P, G], { R: logu(1e3, 1e5) });
        let O = P; const reg = pick(['none', '7805', '7812', 'lm317', '7805']);
        if (reg === 'lm317') { O = nn(); const adj = nn(); b.add('lm317', [P, adj, O]); b.add('resistor', [O, adj], { R: 240 }); b.add('resistor', [adj, G], { R: logu(100, 3000) }); }
        else if (reg !== 'none') { O = nn(); b.add('reg78xx', [P, G, O], { part: reg, heatsink: rnd() < 0.5 }); if (rnd() < 0.5) b.add('diode', [O, P]); }
        if (O !== P && rnd() < 0.6) b.add('ccap', [O, G], { C: 1e-7, Vr: 50 });
        if (O !== P && rnd() < 0.5) b.add('capacitor', [O, G], { C: logu(1e-6, 1e-3) });
        const L = nn(); b.add('resistor', [O, L], { R: logu(20, 3000) });
        if (rnd() < 0.7) b.add('led', [L, G], { color: pick(['red', 'green', 'blue', 'white']) }); else b.add('resistor', [L, G], { R: logu(10, 1000) });
        if (rnd() < 0.3) b.add('zener', [G, O], { Vz: pick([3.3, 4.7, 5.1, 9.1, 15]) });
        return 0.06;
      },
      graph() { // random graph of linear + non-linear parts
        const b = mk(); const N = 3 + Math.floor(rnd() * 6), node = () => Math.floor(rnd() * (N + 1));
        const pair = () => { const a = node(); let c = node(); if (c === a) c = (a + 1) % (N + 1); return [a, c]; };
        b.gnd(0);
        // spanning chain so every node has a DC path
        for (let i = 1; i <= N; i++) b.add('resistor', [i, Math.floor(rnd() * i)], { R: logu(10, 1e5) });
        const src = pick(['battery', 'battery', 'ac', 'psu']);
        if (src === 'battery') b.add('battery', [1, 0], { V: pick([1.5, 3, 5, 9, 12, 24, -9]) });
        else if (src === 'ac') b.add('ac', [1, 0], { Vp: logu(1, 50), f: logu(10, 5000), wave: pick(['sine', 'square', 'triangle']) });
        else b.add('psu', [1, 0], { V: logu(1, 30), I: logu(0.01, 2) });
        const two = ['resistor', 'capacitor', 'inductor', 'diode', 'led', 'zener', 'schottky', 'bulb', 'ecap', 'fuse', 'rectifier', 'sigdiode', 'bicolor'];
        const m2 = 2 + Math.floor(rnd() * 8);
        for (let i = 0; i < m2; i++) {
          const t = pick(two), pr = { resistor: { R: logu(1, 1e6) }, capacitor: { C: logu(1e-9, 1e-3) }, ecap: { C: logu(1e-6, 1e-3), Vr: 50 }, inductor: { L: logu(1e-5, 1), R: logu(0.01, 10) }, zener: { Vz: logu(2.7, 20) }, fuse: { rating: logu(0.05, 3) } }[t] || {};
          b.add(t, pair(), pr);
        }
        const three = ['npn', 'pnp', 'nmos', 'pmos', 'tip120', 'reg78xx', 'lm317', 'scr', 'triac', 'njfet', 'opamp'];
        const m3 = Math.floor(rnd() * 4);
        for (let i = 0; i < m3; i++) b.add(pick(three), [node(), node(), node()], {});
        if (rnd() < 0.2) b.add('opto', [node(), node(), node(), node()], {});
        return 0.03;
      },
      switching() { // clocked transistor driving an inductive / motor / relay load (with or without flyback diode)
        const b = mk(); b.gnd(0);
        const V = pick([5, 9, 12, 24]); b.add('battery', [1, 0], { V });
        b.add('ac', [2, 0], { Vp: 5, off: 0, f: logu(5, 5000), wave: 'square' });
        const sw = pick(['npn', 'nmos', 'tip120']);
        b.add('resistor', [2, 3], { R: logu(100, 1e4) }); b.add('resistor', [3, 0], { R: 1e5 });
        const load = pick(['inductor', 'motor', 'relay', 'buzzer', 'bulb', 'fan']);
        if (load === 'relay') b.add('relay', [1, 4, null, null, null], {});
        else b.add(load, [1, 4], load === 'inductor' ? { L: logu(1e-3, 1), R: logu(1, 100) } : {});
        if (sw === 'nmos') b.add('nmos', [3, 4, 0]); else b.add(sw, [3, 4, 0]);
        if (rnd() < 0.6) b.add(pick(['diode', 'schottky', 'rectifier']), [4, 1]);
        if (rnd() < 0.4) b.add('capacitor', [4, 0], { C: logu(1e-9, 1e-5) });
        return 0.03;
      },
    };
    const out = { circuits: 0, steps: 0, bad: 0, badCircuits: 0, nan: 0, fam: {}, worst: [], ms: 0 };
    const run = (name, sec) => {
      app.run(); const n = Math.round(sec / app.dt); let bad = 0, nan = false; const t0 = performance.now();
      for (let i = 0; i < n; i++) { app.simStep(); if (!app.net.converged) bad++; if (app.net.x && !app.net.x.every(Number.isFinite)) { nan = true; break; } }
      app.pause(); const ms = performance.now() - t0;
      out.circuits++; out.steps += n; out.bad += bad; out.ms += ms; if (bad) out.badCircuits++; if (nan) out.nan++;
      const f = name.split('#')[0]; const F = out.fam[f] = out.fam[f] || { n: 0, bad: 0, badC: 0, steps: 0 }; F.n++; F.bad += bad; F.steps += n; if (bad) F.badC++;
      if (bad || nan) out.worst.push([name, bad, n, nan]);
    };
    const names = Object.keys(fam);
    if (ONE) { // reproduce one case:  ONE=family:seed  (leaves the circuit loaded; window.FUZZ_SEC = run time)
      const [f, sd] = ONE.split(':'); s = +sd; NEW(); const sec = fam[f](); window.FUZZ_SEC = sec; app.toast = toast0;
      if (window.FUZZ_KEEP) return 'built';
      run(ONE, sec); const st = app.net.stats; out.stats = st; return out;
    }
    for (let i = 0; i < COUNT; i++) {
      const f = names[i % names.length]; const seedHere = s;
      NEW(); let sec; try { sec = fam[f](); } catch (e) { out.buildErr = (out.buildErr || 0) + 1; continue; }
      try { run(f + '#' + i + '(s' + seedHere + ')', sec); } catch (e) { out.err = (out.err || []).concat(f + '#' + i + ': ' + e.message); }
    }
    for (const ex of EXAMPLES) { try { app.loadExample(ex.id); app.pause(); run('example#' + ex.id, 0.05); } catch (e) { out.err = (out.err || []).concat('ex ' + ex.id + ': ' + e.message); } }
    for (const [f, d] of fixtures) { try { app.load(d); app.pause(); app.resetSim(); run('fixture#' + f, 0.5); } catch (e) { out.err = (out.err || []).concat('fx ' + f + ': ' + e.message); } }
    app.toast = toast0;
    out.worst.sort((a, b) => b[1] - a[1]); out.worst = out.worst.slice(0, 25); out.ms = Math.round(out.ms);
    return out;
  }, [COUNT, SEED, fixtures, ONE]);
  if (process.env.DBG) { console.log(await page.evaluate(fs.readFileSync(process.env.DBG, 'utf8'))); await browser.close(); return; }
  res.pageErrors = errors.slice(0, 5);
  console.log(JSON.stringify(res, null, 1));
  console.log(`SUMMARY circuits=${res.circuits} steps=${res.steps} nonconverged_steps=${res.bad} circuits_with_failures=${res.badCircuits} nan=${res.nan} time=${res.ms}ms`);
  await browser.close();
})();
