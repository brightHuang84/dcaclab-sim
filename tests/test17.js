// v14.1 tests: collapsible component library (categories / sub-groups, expand / collapse all, search auto-expand, localStorage persistence),
// collapsible side panels (canvas resize), drag from an expanded category, no auto-expand on example / circuit load, 10-locale keys.
const { chromium } = require('playwright-core');
const fails = []; let npass = 0;
const check = (name, cond, info) => { if (cond) npass++; else fails.push(name); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(info).slice(0, 400))); };
const BASE = process.env.URL || 'http://127.0.0.1:8765/index.html';
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt-BR'];
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, locale: 'zh-CN' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '?lang=zh-CN'); await page.waitForTimeout(400);
  const S = () => page.evaluate(() => {
    const cats = [...document.querySelectorAll('#palette-body .cat')];
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.height > 4 && getComputedStyle(el).visibility !== 'hidden' && el.offsetParent !== null; };
    return {
      cats: cats.map((c) => c.dataset.cat),
      open: cats.filter((c) => c.classList.contains('open')).map((c) => c.dataset.cat),
      hidden: cats.filter((c) => c.hidden).map((c) => c.dataset.cat),
      aria: cats.map((c) => c.querySelector('.cat-t').getAttribute('aria-expanded')),
      role: cats.every((c) => c.querySelector('.cat-t').getAttribute('role') === 'button' && c.querySelector('.cat-t').tabIndex === 0 && !!c.querySelector('.cat-t .chev')),
      visItems: [...document.querySelectorAll('#palette-body .item')].filter(vis).map((e) => e.dataset.type),
      subs: [...document.querySelectorAll('#palette-body .sub-t')].map((s) => s.dataset.key + ':' + s.getAttribute('aria-expanded')),
      ls: localStorage.getItem('dcl.palOpen'),
    };
  });
  const wait = (ms) => page.waitForTimeout(ms || 260);
  let s = await S();
  check('default_all_categories_collapsed', s.cats.length >= 10 && s.open.length === 0 && s.aria.every((a) => a === 'false') && s.visItems.length === 0, s);
  check('headers_are_buttons_with_chevron_and_tab_stop', s.role, s.role);
  check('sub_groups_collapsible_and_collapsed_by_default', s.subs.length >= 8 && s.subs.every((x) => /:false$/.test(x)), s.subs);
  // click toggles
  await page.click('#palette-body .cat[data-cat="basic"] .cat-t'); await wait();
  s = await S();
  check('click_expands_one_category', s.open.join() === 'basic' && s.visItems.includes('resistor') && !s.visItems.includes('battery'), s.open);
  check('aria_expanded_true_after_click', s.aria[s.cats.indexOf('basic')] === 'true', s.aria);
  await page.click('#palette-body .cat[data-cat="basic"] .cat-t'); await wait();
  s = await S(); check('click_again_collapses', s.open.length === 0 && s.visItems.length === 0, s.open);
  // keyboard: Enter and Space
  await page.focus('#palette-body .cat[data-cat="source"] .cat-t'); await page.keyboard.press('Enter'); await wait();
  s = await S(); const kEnter = s.open.includes('source');
  await page.focus('#palette-body .cat[data-cat="meter"] .cat-t'); await page.keyboard.press(' '); await wait();
  s = await S(); check('keyboard_enter_and_space_toggle', kEnter && s.open.includes('meter') && s.visItems.includes('battery'), s.open);
  // sub-group toggle (74-series)
  await page.click('#palette-body .cat[data-cat="ttl"] .cat-t'); await wait();
  let s2 = await S(); const noneShown = !s2.visItems.some((t) => /^ic/.test(t));
  await page.click('#palette-body .sub-t[data-key="ttl/gate"]'); await wait();
  s2 = await S();
  check('sub_group_expands_only_its_parts', noneShown && s2.visItems.includes('ic7400') && !s2.visItems.includes('ic74161'), s2.visItems.filter((t) => /^ic/.test(t)).slice(0, 6));
  // persistence across reload
  const before = await S();
  await page.reload(); await page.waitForTimeout(500);
  s = await S();
  check('state_persists_across_reload', s.open.sort().join() === before.open.sort().join() && s.visItems.includes('ic7400') && !s.visItems.includes('ic74161'), { before: before.open, after: s.open, ls: s.ls });
  // expand all / collapse all
  await page.click('#pal-exp-all'); await wait();
  s = await S(); check('expand_all_opens_every_category_and_sub_group', s.open.length === s.cats.length && s.subs.every((x) => /:true$/.test(x)) && s.visItems.includes('ic74161'), s.open.length);
  await page.click('#pal-col-all'); await wait();
  s = await S(); check('collapse_all_closes_everything_and_is_saved', s.open.length === 0 && s.visItems.length === 0 && s.ls === '{}', s.ls);
  // search auto-expands matching categories temporarily, clearing restores
  await page.click('#palette-body .cat[data-cat="basic"] .cat-t'); await wait();
  await page.fill('#pal-q', 'lm386'); await wait();
  s = await S();
  check('search_auto_expands_matches_and_hides_others', s.visItems.join() === 'lm386' && s.hidden.length === s.cats.length - 1 && !s.hidden.includes('audio'), { v: s.visItems, h: s.hidden.length });
  check('search_does_not_change_saved_state', s.open.join() === 'basic' && JSON.parse(s.ls).basic === true && !JSON.parse(s.ls).audio, s.ls);
  await page.fill('#pal-q', '74hc595'); await wait();
  s = await S(); check('search_reveals_parts_inside_collapsed_sub_groups', s.visItems.includes('ic74595'), s.visItems);
  await page.fill('#pal-q', ''); await wait();
  s = await S(); check('clearing_search_restores_saved_state', s.open.join() === 'basic' && s.hidden.length === 0 && s.visItems.includes('resistor') && !s.visItems.includes('lm386') && !s.visItems.includes('ic74595'), s.open);
  // loading an example / a circuit must not expand anything
  await page.evaluate(() => { app.loadExample('audlm386'); const j = app.serialize(); app.clearAll(); app.load(j); }); await wait();
  s = await S(); check('loading_example_or_circuit_does_not_auto_expand', s.open.join() === 'basic' && s.visItems.length > 0 && (await page.evaluate((v) => v.every((t) => DEFS[t] && DEFS[t].cat === 'basic'), s.visItems)), s.open);
  // drag a part from an expanded category onto the canvas
  const n0 = await page.evaluate(() => app.comps.length);
  const it = await page.$('#palette-body .item[data-type="resistor"]'); const bb = await it.boundingBox(); const cv = await (await page.$('#cv')).boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down();
  await page.mouse.move(cv.x + 300, cv.y + 250, { steps: 8 }); await page.mouse.up(); await wait();
  const dr = await page.evaluate(() => ({ n: app.comps.length, last: app.comps[app.comps.length - 1].type }));
  check('drag_part_from_expanded_category_still_works', dr.n === n0 + 1 && dr.last === 'resistor', dr);
  // left panel collapse to a strip, canvas grows; remembered; restore
  const W0 = await page.evaluate(() => ({ w: app.W, pal: document.getElementById('palette').getBoundingClientRect().width }));
  await page.click('#pal-toggle'); await page.waitForTimeout(450);
  const W1 = await page.evaluate(() => ({ w: app.W, pal: document.getElementById('palette').getBoundingClientRect().width, cvw: parseFloat(app.cv.style.width), min: document.getElementById('app').classList.contains('pal-min'), lbl: document.getElementById('pal-toggle').textContent, aria: document.getElementById('pal-toggle').getAttribute('aria-expanded') }));
  check('left_panel_collapses_to_thin_strip_and_canvas_resizes', W1.min && W1.pal < 40 && W1.w > W0.w + 140 && Math.abs(W1.cvw - W1.w) < 1 && W1.lbl === '»' && W1.aria === 'false', { W0, W1 });
  await page.reload(); await page.waitForTimeout(600);
  const W2 = await page.evaluate(() => ({ min: document.getElementById('app').classList.contains('pal-min'), pal: document.getElementById('palette').getBoundingClientRect().width }));
  check('left_panel_state_remembered', W2.min && W2.pal < 40, W2);
  await page.click('#pal-toggle'); await page.waitForTimeout(450);
  const W3 = await page.evaluate(() => ({ w: app.W, pal: document.getElementById('palette').getBoundingClientRect().width, lbl: document.getElementById('pal-toggle').textContent }));
  check('left_panel_expands_again', W3.pal > 150 && Math.abs(W3.w - W0.w) < 2 && W3.lbl === '«', W3);
  // right properties panel (optional feature)
  await page.click('#props-toggle'); await page.waitForTimeout(450);
  const P1 = await page.evaluate(() => ({ w: app.W, props: document.getElementById('props').getBoundingClientRect().width }));
  await page.click('#props-toggle'); await page.waitForTimeout(450);
  const P2 = await page.evaluate(() => ({ w: app.W, props: document.getElementById('props').getBoundingClientRect().width }));
  check('right_panel_collapses_and_expands_with_canvas_resize', P1.props < 40 && P1.w > W0.w + 190 && P2.props > 200 && Math.abs(P2.w - W0.w) < 2, { P1, P2 });
  // locale keys
  const keys = await page.evaluate((L) => { const K = ['h.pal_expand_all', 'h.pal_collapse_all', 'h.pal_hide', 'h.pal_show', 'h.props_hide', 'h.props_show']; const out = {}; for (const l of L) { I18N.set(l); out[l] = K.map((k) => I18N.t(k)); } I18N.set('zh-CN'); return out; }, LANGS);
  const bad = []; for (const l of LANGS) keys[l].forEach((v, i) => { if (!v || /^h\./.test(v) || (l !== 'en' && !/^zh/.test(l) && v === keys.en[i])) bad.push(l + ':' + i); });
  check('locale_keys_present_in_10_languages', bad.length === 0 && new Set(LANGS.map((l) => keys[l][0])).size >= 9, bad);
  await page.evaluate(() => app.setLang && app.setLang('en')); 
  const enBtn = await page.evaluate(() => { I18N.set('en'); app.buildPalette(); return document.getElementById('pal-exp-all').textContent; });
  check('buttons_relabel_after_language_change', enBtn === 'Expand all', enBtn);
  check('no_page_errors', errors.length === 0, errors);
  await browser.close();
  console.log(fails.length ? 'FAILED: ' + fails.length + ' → ' + fails.join(', ') : 'ALL PASSED: ' + npass);
  process.exit(fails.length ? 1 : 0);
})();
