// v15.2 tests: high-voltage NPN presets MJE13001 / MJE13003 / MJE13005 (BF / Is / VAF + Vceo / Ic max ratings),
// palette search "13003", breakdown / overload warnings, hvsw example (300 V switched by a 5 V base drive), 10-locale strings.
const { chromium } = require('playwright-core');
const fails = []; let npass = 0;
const check = (name, cond, info) => { if (cond) npass++; else fails.push(name); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(info).slice(0, 500))); };
const BASE = process.env.URL || 'http://127.0.0.1:8765/index.html';
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt-BR'];
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 860 }, locale: 'zh-CN' })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '?lang=zh-CN'); await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.RUNT = (sec) => { const t1 = app.t + sec; let bad = 0, n = 0; while (app.t < t1 && n++ < 400000) { app.simStep(); if (!app.net.converged) bad++; } return bad; };
    window.HV = () => { app.loadExample('hvsw'); app.running = false; app.resetSim(); const g = (t) => app.comps.filter((c) => c.type === t); return { Q: g('npn')[0], R: g('resistor'), S: g('switch')[0], B: g('battery') }; };
  });
  const E = (f, a) => page.evaluate(f, a);
  let r = await E(() => ({ p: PRESETS.npn, opts: DEFS.npn.props.find((p) => p.k === 'part').opts.map((o) => o[0]), keys: DEFS.npn.props.map((p) => p.k) }));
  check('three_presets_with_low_beta_and_ratings', r.p.MJE13001.BF === 25 && r.p.MJE13003.BF === 20 && r.p.MJE13005.BF === 15 &&
    ['MJE13001', 'MJE13003', 'MJE13005'].every((k) => r.p[k].Vceo === 400) && r.p.MJE13001.Icmax === 0.2 && r.p.MJE13003.Icmax === 1.5 && r.p.MJE13005.Icmax === 4, r.p);
  check('part_selector_lists_3_types_and_old_ones', ['MJE13001', 'MJE13003', 'MJE13005', '2N2222', 'S8050'].every((k) => r.opts.includes(k)), r.opts);
  check('rating_props_present', r.keys.includes('Vceo') && r.keys.includes('Icmax') && r.keys.includes('VAF'), r.keys);
  r = await E(() => { app.clearAll(); const q = app.addComp('npn', 400, 300, 0, {}); const d0 = { V: q.props.Vceo, I: q.props.Icmax }; q.props.part = 'MJE13005'; DEFS.npn.onProp(q, 'part'); return { d0, p: { ...q.props }, lab: DEFS.npn.label(q), terms: DEFS.npn.termNames }; });
  check('selecting_preset_applies_BF_Is_VAF_ratings', r.p.BF === 15 && r.p.Is === 5e-13 && r.p.VAF === 200 && r.p.Vceo === 400 && r.p.Icmax === 4 && r.lab === 'MJE13005', r);
  check('default_npn_unrated_and_pins_EBC', r.d0.V === 0 && r.d0.I === 0 && /^E/.test(r.terms[0]) && /^B/.test(r.terms[1]) && /^C/.test(r.terms[2]), r);
  for (const q of ['13001', '13003', '13005', 'MJE13003']) {
    await page.fill('#pal-q', q); await page.waitForTimeout(150);
    const v = await E(() => [...document.querySelectorAll('#palette-body .item')].filter((i) => !i.hidden).map((i) => i.dataset.type));
    check('palette_search_' + q + '_finds_npn', v.includes('npn'), v);
  }
  await page.fill('#pal-q', '');
  r = await E(() => { const h = HV(); const bad = RUNT(0.02); return { bad, po: app.findPassOvers().length, ic: h.Q._m.I, vce: h.Q._m.V, ov: !!(h.Q.state.ovV || h.Q.state.ovI), part: h.Q.props.part }; });
  check('hvsw_converges_no_passovers', r.bad === 0 && r.po === 0 && r.part === 'MJE13003', r);
  check('hvsw_on_saturated_100mA_into_3k', r.ic > 0.095 && r.ic < 0.101 && r.vce < 1.5 && !r.ov, r);
  r = await E(() => { const h = HV(); h.S.props.closed = false; app.dirty = true; RUNT(0.02); return { ic: h.Q._m.I, vce: h.Q._m.V, ov: h.Q.state.ovV }; });
  check('hvsw_off_blocks_300V', Math.abs(r.ic) < 1e-4 && r.vce > 299 && !r.ov, r);
  r = await E(() => { const h = HV(); h.S.props.closed = false; h.B.find((b) => b.props.V === 300).props.V = 450; app.dirty = true; RUNT(0.02); return { vce: h.Q._m.V, ov: h.Q.state.ovV, txt: document.body.textContent.includes('击穿') }; });
  check('over_vceo_breakdown_warning', r.ov && r.vce > 400 && r.txt, r);
  r = await E(() => { const h = HV(); h.R.find((x) => x.props.R === 3000).props.R = 100; h.R.find((x) => x.props.R === 470).props.R = 10; app.dirty = true; RUNT(0.02); return { ic: h.Q._m.I, ov: h.Q.state.ovI, txt: document.body.textContent.includes('过载') }; });
  check('over_icmax_overload_warning', r.ov && r.ic > 1.5 && r.txt, r);
  const keys = await E((L) => {
    const K = ['c.npn.p.Vceo', 'c.npn.p.Icmax', 'c.npn.o.part.MJE13001', 'c.npn.o.part.MJE13003', 'c.npn.o.part.MJE13005', 'bjt.breakdown', 'bjt.overload', 'bjt.warn_v', 'bjt.warn_i', 'ex.hvsw'];
    const out = {}; for (const l of L) { I18N.set(l); out[l] = K.map((k) => I18N.t(k)); } I18N.set('zh-CN'); return out;
  }, LANGS);
  const bad = []; for (const l of LANGS) keys[l].forEach((v, i) => { if (!v || /^(c|bjt|ex)\./.test(v) || (l !== 'en' && !/^zh/.test(l) && i !== 2 && i !== 3 && i !== 4 && v === keys.en[i])) bad.push(l + ':' + i + ':' + v); });
  check('locale_keys_present_in_10_languages', bad.length === 0, bad);
  check('option_text_mentions_13003', LANGS.every((l) => keys[l][3].includes('13003')), keys.en[3]);
  check('no_page_errors', errors.length === 0, errors);
  await browser.close();
  console.log(fails.length ? 'FAILED ' + fails.length + ' of ' + (npass + fails.length) + ': ' + fails.join(', ') : 'ALL ' + npass + ' CHECKS PASSED');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
