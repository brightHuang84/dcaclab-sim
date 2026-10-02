// v8 tests: internationalisation (10 locales) — key sets, rendered DOM has no raw keys / leftover Chinese,
// ?lang, auto-detect, persistence, live switching keeps the circuit, language-independent saves, one example per locale
const { chromium } = require('playwright-core');
const results = {}; const fails = []; const report = {};
const check = (name, cond, info) => { results[name] = { pass: !!cond, info }; if (!cond) fails.push(name); };
const BASE = process.env.URL || 'http://127.0.0.1:8765/index.html';
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt-BR'];
const ZH = new Set(['zh-CN', 'zh-TW']);
// Simplified-only characters: every char of zh-CN.js whose OpenCC s2t form differs, minus forms that are also valid
// Japanese shinjitai / Traditional variants (体 号 点 灯 来 条 会 区 参 …). Used for the ja and zh-TW scans.
const SIMP = '丝两个临为义从仪传侧储关减击删动势单压发变叠吗启响围图圆场坏块处复头夹实宽对导尔尝带库应开异强态总悬惯扫护拟拨损换掷摆敛无时显暂极栅标档桥检毁氢沟浆测浏滚满滤灭烁烧热环电盏盘码确碱离积稳类红约级纽线组经结绕继续维绿编缩联脉脚节范荡萨蓝虚观规视览触计认记设试语说请读调谐谱负败费车轨转轮轻载较辅辑输达过运进远连适选逻释钟钮钳铁销锁锂键镍长门闪闭间阳阴阵际险难顶顿频颜额风饱马驱验鸣';
const SIMPRE = new RegExp('[' + SIMP + ']');
const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const KANA_HANGUL = /[\u3040-\u30ff\uac00-\ud7af]/;
// rendered text of everything the parent asked for: toolbar, palette, examples menu, properties panel (several parts + wire +
// nothing selected / help / advanced settings), HUD, status bar, analysis panel; plus all title attributes
const COLLECT = async (page) => page.evaluate(() => {
  const parts = {}; const T = (el) => (el ? el.textContent + ' ' + [...el.querySelectorAll('[title]')].map(e => e.title).join(' ') : '');
  const tb = document.querySelector('#toolbar').cloneNode(true); tb.querySelectorAll('#sel-lang').forEach(e => e.remove()); parts.toolbar = T(tb);
  parts.examples = [...document.querySelectorAll('#sel-example option')].map(o => o.textContent).join('\n');
  parts.palette = T(document.querySelector('#palette'));
  parts.status = T(document.querySelector('#status')) + ' ' + T(document.querySelector('#zoombox')) + ' ' + document.title + ' ' + (document.querySelector('meta[name=description]') || {}).content;
  app.sel = null; app.refreshProps(); const adv = document.querySelector('#props details'); if (adv) adv.open = true; parts.props_none = T(document.querySelector('#props'));
  const per = {};
  for (const type of Object.keys(DEFS)) {      // every part type, not only a few
    const c = app.addComp(type, -4000, -4000, 0, {}); app.sel = { kind: 'comp', comp: c }; app.refreshProps(); app.updateReadings && app.updateReadings(true);
    per[type] = T(document.querySelector('#props'));
    let lab = ''; try { lab = DEFS[type].label ? String(DEFS[type].label(c) || '') : ''; } catch (e) { lab = ''; }
    per[type] += ' ' + lab;
    app.comps.splice(app.comps.indexOf(c), 1);
  }
  if (app.wires[0]) { app.sel = { kind: 'wire', wire: app.wires[0] }; app.refreshProps(); parts.props_wire = T(document.querySelector('#props')); }
  app.sel = null; app.refreshProps(); app.dirty = true;
  parts.hud = T(document.querySelector('#hud'));
  return { parts, per };
});
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  const mk = async (locale, url) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, locale });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(locale + ' ' + url + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(locale + ' ' + url + ' console: ' + m.text()); });
    await page.goto(url); await page.waitForTimeout(300);
    return { ctx, page };
  };
  // ---------- 1. dictionaries: identical key sets, no empty values, placeholders kept ----------
  {
    const { ctx, page } = await mk('en-US', BASE + '?fresh=1');
    const d = await page.evaluate((LANGS) => {
      const ref = Object.keys(I18N.dicts['zh-CN']).sort(); const out = { nkeys: ref.length, langs: {} };
      const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
      for (const L of LANGS) {
        const D = I18N.dicts[L] || {}; const ks = Object.keys(D);
        const missing = ref.filter(k => !(k in D)), extra = ks.filter(k => !(k in I18N.dicts['zh-CN']));
        const empty = ks.filter(k => D[k] === '' && !/^h\.(logo_sub|palette_sub)$/.test(k) && I18N.dicts['zh-CN'][k] !== '');
        const badPh = ks.filter(k => ph(D[k]) !== ph(I18N.dicts['zh-CN'][k]));
        const sameAsEn = L === 'en' ? 0 : ks.filter(k => D[k] === I18N.dicts.en[k] && /[A-Za-z]{3,}/.test(D[k])).length;
        out.langs[L] = { keys: ks.length, missing, extra, empty, badPh, sameAsEn };
      }
      // fallback chain: lang -> en -> zh-CN -> key
      const save = I18N.dicts.ja['ui.properties']; delete I18N.dicts.ja['ui.properties']; I18N.lang = 'ja';
      out.fb1 = I18N.t('ui.properties') === I18N.dicts.en['ui.properties'];
      I18N.dicts.ja['ui.properties'] = save;
      const e2 = I18N.dicts.en['ui.saved_to_browser_storage']; delete I18N.dicts.en['ui.saved_to_browser_storage']; I18N.lang = 'en';
      out.fb2 = I18N.t('ui.saved_to_browser_storage') === I18N.dicts['zh-CN']['ui.saved_to_browser_storage'];
      I18N.dicts.en['ui.saved_to_browser_storage'] = e2;
      out.fb3 = I18N.t('no.such.key') === 'no.such.key' && I18N.t('no.such.key', null, 'dflt') === 'dflt';
      out.params = I18N.t('c.lcd1602.p.line2').includes('{V}') && I18N.t('x', { a: 1 }, 'v={a}') === 'v=1';
      return out;
    }, LANGS);
    report.dict = Object.fromEntries(Object.entries(d.langs).map(([k, v]) => [k, { keys: v.keys, missing: v.missing.length, extra: v.extra.length, empty: v.empty.length, badPh: v.badPh.length, sameAsEn: v.sameAsEn }]));
    report.nkeys = d.nkeys;
    check('dict_all_10_locales_loaded', LANGS.every(L => d.langs[L].keys > 0), report.dict);
    for (const L of LANGS) check('dict_keys_match_zhCN_' + L, d.langs[L].missing.length === 0 && d.langs[L].extra.length === 0, { missing: d.langs[L].missing.slice(0, 10), extra: d.langs[L].extra.slice(0, 10) });
    check('dict_no_empty_values', LANGS.every(L => d.langs[L].empty.length === 0), Object.fromEntries(LANGS.map(L => [L, d.langs[L].empty.slice(0, 5)])));
    check('dict_placeholders_kept', LANGS.every(L => d.langs[L].badPh.length === 0), Object.fromEntries(LANGS.map(L => [L, d.langs[L].badPh.slice(0, 5)])));
    check('dict_actually_translated', LANGS.filter(L => L !== 'en').every(L => d.langs[L].sameAsEn < d.nkeys * 0.1), report.dict);
    check('t_fallback_lang_en_zh_key', d.fb1 && d.fb2 && d.fb3 && d.params, d);
    await ctx.close();
  }
  // ---------- 2. every locale via ?lang: html lang/title/meta, DOM scan, one example runs ----------
  const exIds = await (async () => { const { ctx, page } = await mk('en-US', BASE + '?fresh=1'); const r = await page.evaluate(() => EXAMPLES.map(e => e.id)); await ctx.close(); return r; })();
  report.locales = {};
  for (let li = 0; li < LANGS.length; li++) {
    const L = LANGS[li];
    const { ctx, page } = await mk('en-US', BASE + '?fresh=1&lang=' + L);
    const head = await page.evaluate(() => ({ lang: I18N.lang, html: document.documentElement.lang, title: document.title, desc: (document.querySelector('meta[name=description]') || {}).content, tTitle: I18N.t('h.title'), tDesc: I18N.t('h.description'), sel: document.querySelector('#sel-lang').value, nOpt: document.querySelectorAll('#sel-lang option').length, keys: Object.keys(I18N.dicts['zh-CN']) }));
    check('lang_param_' + L, head.lang === L && head.html === L && head.title === head.tTitle && head.desc === head.tDesc && head.sel === L && head.nOpt === 10, { lang: head.lang, html: head.html, title: head.title, sel: head.sel });
    // run one (different) example per locale, with the analysis panel open
    const exId = exIds[(li * 3 + 1) % exIds.length];
    const run = await page.evaluate(async (exId) => {
      window.TOASTS = []; const t0 = app.toast.bind(app); app.toast = (s) => { window.TOASTS.push(s); t0(s); };
      app.loadExample(exId); app.run(); app.toggleAnalysis();
      await new Promise(r => setTimeout(r, 1200));
      const nan = app.net && app.net.V ? [...app.net.V].some(v => !isFinite(v)) : false;
      return { t: app.t, running: app.running, nan, toasts: window.TOASTS.slice(), analysis: document.querySelector('#analysis').textContent, hud: document.querySelector('#hud').textContent, readings: app.comps.map(c => { try { return (DEFS[c.type].readings ? DEFS[c.type].readings(c) : []).flat().join(' '); } catch (e) { return 'ERR ' + e.message; } }).join(' | ') };
    }, exId);
    await page.evaluate(() => { app.pause(); app.toggleAnalysis(); });
    const col = await COLLECT(page);
    const texts = Object.assign({}, col.parts, { run_toasts: run.toasts.join('\n'), run_analysis: run.analysis, run_hud: run.hud, run_readings: run.readings });
    for (const [k, v] of Object.entries(col.per)) texts['part_' + k] = v;
    const keySet = new Set(head.keys);
    const rawKeys = []; const leftovers = [];
    // zh-CN strings that must not show up verbatim (ignoring ones that are legitimately identical in the current locale)
    const zhVals = await page.evaluate(() => { const cur = Object.values(I18N.dicts[I18N.lang]).join('\n'); return Object.values(I18N.dicts['zh-CN']).filter(v => /[\u4e00-\u9fff]/.test(v) && v.length >= 3 && !cur.includes(v)); });
    for (const [where, s] of Object.entries(texts)) {
      for (const tok of String(s).split(/[\s<>"'(),:;]+/)) if (keySet.has(tok)) rawKeys.push(where + ': ' + tok);
      if (L === 'ja') { const m = SIMPRE.exec(s); if (m) leftovers.push(where + ': …' + s.slice(Math.max(0, m.index - 15), m.index + 15) + '…'); }
      else if (L === 'zh-TW') { const m = SIMPRE.exec(s); if (m) leftovers.push(where + ': …' + s.slice(Math.max(0, m.index - 15), m.index + 15) + '…'); }
      else if (!ZH.has(L)) { const m = HAN.exec(s); if (m) leftovers.push(where + ': …' + s.slice(Math.max(0, m.index - 15), m.index + 15) + '…'); }
      if (!ZH.has(L) && L !== 'ja' && L !== 'ko' && KANA_HANGUL.test(s.replace(/日本語|한국어/g, ''))) leftovers.push(where + ': kana/hangul');
    }
    if (L === 'ja') for (const v of zhVals) for (const [where, s] of Object.entries(texts)) if (v.length >= 3 && s.includes(v)) leftovers.push(where + ': zh-CN text ' + v);
    const nParts = Object.keys(col.per).length;
    report.locales[L] = { example: exId, t: +run.t.toFixed(3), parts_scanned: nParts, rawKeys: rawKeys.length, leftovers: leftovers.length };
    check('no_raw_keys_visible_' + L, rawKeys.length === 0, rawKeys.slice(0, 10));
    check('no_leftover_chinese_' + L, leftovers.length === 0, leftovers.slice(0, 12));
    check('example_runs_' + L + '_' + exId, run.t > 0.2 && !run.nan && !/ERR /.test(run.readings) && run.analysis.length > 50, { t: run.t, nan: run.nan, err: (run.readings.match(/ERR [^|]*/) || [])[0] });
    if (L === 'en') check('en_palette_single_language', !/[\u4e00-\u9fff]/.test(col.parts.palette) && /Battery/.test(col.parts.palette) && /Components/.test(col.parts.palette), col.parts.palette.slice(0, 200));
    if (L === 'zh-CN') check('zhCN_palette_has_en_subtitle_only_in_zh', /电池/.test(col.parts.palette) && /Battery/.test(col.parts.palette), col.parts.palette.slice(0, 120));
    await ctx.close();
  }
  // ---------- 3. auto-detect from navigator.languages ----------
  const det = {};
  for (const [loc, want] of [['ja-JP', 'ja'], ['ko-KR', 'ko'], ['pt-BR', 'pt-BR'], ['pt-PT', 'pt-BR'], ['zh-HK', 'zh-TW'], ['zh-TW', 'zh-TW'], ['zh-CN', 'zh-CN'], ['de-AT', 'de'], ['fr-CA', 'fr'], ['es-MX', 'es'], ['ru-RU', 'ru'], ['en-GB', 'en'], ['it-IT', 'en']]) {
    const { ctx, page } = await mk(loc, BASE + '?fresh=1');
    det[loc] = await page.evaluate(() => I18N.lang);
    check('autodetect_' + loc + '_to_' + want, det[loc] === want, det[loc]);
    await ctx.close();
  }
  report.autodetect = det;
  // ---------- 4. persistence: dropdown choice is stored; ?lang overrides without overwriting it ----------
  {
    const { ctx, page } = await mk('en-US', BASE + '?fresh=1');
    await page.selectOption('#sel-lang', 'fr'); await page.waitForTimeout(100);
    const a = await page.evaluate(() => ({ lang: I18N.lang, html: document.documentElement.lang, ls: localStorage.getItem('dcaclab-lang'), run: document.querySelector('#btn-run').textContent, title: document.title }));
    await page.goto(BASE + '?fresh=1'); await page.waitForTimeout(200);
    const b = await page.evaluate(() => ({ lang: I18N.lang, sel: document.querySelector('#sel-lang').value }));
    await page.goto(BASE + '?fresh=1&lang=de'); await page.waitForTimeout(200);
    const c = await page.evaluate(() => ({ lang: I18N.lang, ls: localStorage.getItem('dcaclab-lang') }));
    await page.goto(BASE + '?fresh=1'); await page.waitForTimeout(200);
    const d = await page.evaluate(() => I18N.lang);
    await page.goto(BASE + '?fresh=1&lang=xx'); await page.waitForTimeout(200);
    const e = await page.evaluate(() => I18N.lang);
    check('persist_dropdown_choice', a.lang === 'fr' && a.html === 'fr' && a.ls === 'fr' && /Démarrer/.test(a.run) && /Simulateur/.test(a.title) && b.lang === 'fr' && b.sel === 'fr', { a, b });
    check('lang_param_overrides_without_overwriting', c.lang === 'de' && c.ls === 'fr' && d === 'fr', { c, d });
    check('invalid_lang_param_ignored', e === 'fr', e);
    await ctx.close();
  }
  // ---------- 5. live switching keeps circuit + sim state; saved circuits do not depend on language ----------
  {
    const { ctx, page } = await mk('en-US', BASE + '?fresh=1&example=l298n');
    const s0 = await page.evaluate(async () => { app.run(); await new Promise(r => setTimeout(r, 500)); app.sel = { kind: 'comp', comp: app.comps[app.comps.length - 1] }; app.refreshProps(); app.toggleAnalysis(); return { ser: JSON.stringify(app.serialize()), n: app.comps.length, w: app.wires.length, t: app.t }; });
    const seen = {};
    for (const L of LANGS) {
      await page.selectOption('#sel-lang', L); await page.waitForTimeout(60);
      seen[L] = await page.evaluate(() => ({ lang: I18N.lang, ser: JSON.stringify(app.serialize()), running: app.running, n: app.comps.length, an: document.querySelector('#analysis').style.display === 'block', props: document.querySelector('#props .pt') ? document.querySelector('#props .pt').textContent : '', pal: document.querySelector('#palette .item span').textContent }));
    }
    const s1 = await page.evaluate(() => ({ t: app.t }));
    check('switch_keeps_circuit_and_sim', LANGS.every(L => seen[L].lang === L && seen[L].ser === s0.ser && seen[L].running && seen[L].n === s0.n && seen[L].an) && s1.t > s0.t, Object.fromEntries(LANGS.map(L => [L, { lang: seen[L].lang, same: seen[L].ser === s0.ser, running: seen[L].running, an: seen[L].an, props: seen[L].props, pal: seen[L].pal }])));
    check('switch_rerenders_props_and_palette', new Set(LANGS.map(L => seen[L].pal)).size >= 8 && new Set(LANGS.map(L => seen[L].props)).size >= 8, Object.fromEntries(LANGS.map(L => [L, seen[L].pal + ' / ' + seen[L].props])));
    // save under ja, load under de; export JSON has no localized text
    await page.selectOption('#sel-lang', 'ja');
    const sv = await page.evaluate(() => { app.saveLocal(); return localStorage.getItem('dcaclab-sim-saved'); });
    await page.selectOption('#sel-lang', 'de');
    const ld = await page.evaluate(() => { app.clearAll && app.clearAll(); app.loadLocal(); return { n: app.comps.length, ser: JSON.stringify(app.serialize()) }; });
    const defs = await page.evaluate(() => JSON.stringify(Object.keys(DEFS).map(t => defaultProps(t))));
    check('saved_circuit_language_independent', !/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(sv) && ld.n === s0.n && JSON.parse(ld.ser).comps.length === JSON.parse(s0.ser).comps.length, { n: ld.n });
    check('default_props_language_independent', !/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0400-\u04ff]/.test(defs), defs.slice(0, 200));
    await ctx.close();
  }
  // ---------- 6. file:// still works with locale scripts ----------
  {
    const { ctx, page } = await mk('ko-KR', 'file:///workspace/dcaclab-sim/index.html?fresh=1&lang=ja');
    const f = await page.evaluate(() => ({ lang: I18N.lang, n: Object.keys(I18N.dicts).length, run: document.querySelector('#btn-run').textContent }));
    check('file_protocol_works', f.lang === 'ja' && f.n === 10 && /実行/.test(f.run), f);
    await ctx.close();
  }
  // ---------- 7. all examples simulated in every non-Chinese locale: readings, canvas labels, props, HUD, toasts ----------
  {
    const { ctx, page } = await mk('en-US', BASE + '?fresh=1');
    const allEx = {};
    for (const L of LANGS.filter(l => !ZH.has(l))) {
      allEx[L] = await page.evaluate(({ L, simp }) => {
        app.setLang(L); const RE = L === 'ja' ? new RegExp('[' + simp + ']') : /[\u3400-\u9fff]/; const out = []; const toasts = [];
        const t0 = app.toast; app.toast = function (s) { toasts.push(s); return t0.call(app, s); };
        for (const e of EXAMPLES) {
          app.loadExample(e.id); app.run(); const n = Math.min(Math.round(0.4 / app.dt), 4000); for (let i = 0; i < n; i++) app.simStep(); app.pause();
          for (const c of app.comps) {
            let s = ''; try { s += (DEFS[c.type].readings ? DEFS[c.type].readings(c).flat().join(' ') : '') + ' ' + (DEFS[c.type].label ? DEFS[c.type].label(c) : ''); } catch (er) { s += ' ERR ' + er.message; }
            app.sel = { kind: 'comp', comp: c }; app.refreshProps(); app.updateReadings(true); s += document.querySelector('#props').textContent;
            if (RE.test(s) || / ERR /.test(s)) out.push(e.id + '/' + c.type + ': ' + s.slice(0, 120));
          }
          app.updateHud(); if (RE.test(document.querySelector('#hud').textContent)) out.push(e.id + ' hud');
        }
        app.toast = t0; for (const s of toasts) if (RE.test(s)) out.push('toast ' + s);
        app.sel = null; app.refreshProps(); return { n: EXAMPLES.length, out };
      }, { L, simp: SIMP });
      check('all_examples_no_chinese_' + L, allEx[L].out.length === 0, allEx[L].out.slice(0, 8));
    }
    report.all_examples = Object.fromEntries(Object.entries(allEx).map(([k, v]) => [k, v.n + ' examples, ' + v.out.length + ' issues']));
    await ctx.close();
  }
  check('no_page_errors', errors.length === 0, errors.slice(0, 10));
  console.log(JSON.stringify(report, null, 1));
  console.log('\n==== RESULTS ====');
  for (const [k, v] of Object.entries(results)) console.log((v.pass ? 'PASS ' : 'FAIL ') + k + (v.pass ? '' : '  ' + JSON.stringify(v.info)));
  console.log(fails.length ? 'FAILED: ' + fails.length : 'ALL ' + Object.keys(results).length + ' PASSED');
  await browser.close();
  process.exitCode = fails.length ? 1 : 0;
})();
