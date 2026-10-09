'use strict';
// ===== i18n: t(key, params), locale registry, detection, static-string relocalisation =====
// Locale files (js/locales/<code>.js) call I18N.add(code, { key: text }). Loaded as plain <script>s so file:// works.
// Lookup order: current locale → en → zh-CN → key.
const I18N = (() => {
  const LANGS = [['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['en', 'English'], ['ja', '日本語'], ['ko', '한국어'],
    ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['ru', 'Русский'], ['pt-BR', 'Português (Brasil)']];
  const CODES = LANGS.map(l => l[0]), STORE = 'dcaclab-lang', dicts = {};
  const norm = (s) => {
    if (!s) return null; s = String(s).replace('_', '-'); const lo = s.toLowerCase();
    const exact = CODES.find(c => c.toLowerCase() === lo); if (exact) return exact;
    if (lo === 'zh' || lo.startsWith('zh-cn') || lo.startsWith('zh-sg') || lo.startsWith('zh-hans')) return 'zh-CN';
    if (lo.startsWith('zh-tw') || lo.startsWith('zh-hk') || lo.startsWith('zh-mo') || lo.startsWith('zh-hant')) return 'zh-TW';
    if (lo.startsWith('pt')) return 'pt-BR';
    const base = lo.split('-')[0]; return CODES.find(c => c === base) || null;
  };
  const detect = () => {
    let q = null; try { q = new URLSearchParams(location.search).get('lang'); } catch (e) { /* no location */ }
    const fromUrl = norm(q); if (fromUrl) return fromUrl;
    try { const s = norm(localStorage.getItem(STORE)); if (s) return s; } catch (e) { /* storage blocked */ }
    const navs = (typeof navigator !== 'undefined' && (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])) || [];
    for (const l of navs) { const c = norm(l); if (c) return c; }
    return 'en';
  };
  const I = {
    LANGS, CODES, dicts, lang: detect(), fallback: ['en', 'zh-CN'], norm,
    add(code, d) { dicts[code] = Object.assign(dicts[code] || {}, d); },
    has(key, code) { return !!dicts[code || I.lang] && Object.prototype.hasOwnProperty.call(dicts[code || I.lang], key); },
    t(key, params, dflt) {
      let s; const chain = [I.lang].concat(I.fallback);
      for (const c of chain) { const d = dicts[c]; if (d && Object.prototype.hasOwnProperty.call(d, key)) { s = d[key]; break; } }
      if (s === undefined) s = dflt !== undefined ? dflt : key;
      if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
      return s;
    },
    isZh() { return I.lang === 'zh-CN' || I.lang === 'zh-TW'; },
    // every static (load-time) user-facing string of the part library, categories and examples
    statics() {
      const out = [], put = (obj, f, key) => { if (obj && typeof obj[f] === 'string') out.push([obj, f, key]); };
      if (typeof DEFS !== 'undefined') for (const [type, d] of Object.entries(DEFS)) {
        put(d, 'name', 'c.' + type + '.name');
        (d.termNames || []).forEach((n, i) => put(d.termNames, i, 'c.' + type + '.t' + i));
        put(d, 'desc', 'c.' + type + '.desc');
        (d.acts || []).forEach((a) => put(a, 'label', 'c.' + type + '.a.' + a.k));
        for (const p of d.props || []) {
          put(p, 'label', p.lk || 'c.' + type + '.p.' + p.k);   // lk: a key shared by many parts (signal-source fields …)
          if (Array.isArray(p.opts)) p.opts.forEach((o) => { if (Array.isArray(o)) put(o, 1, (p.ok || 'c.' + type + '.o.' + p.k) + '.' + o[0]); });
          else if (p.opts && typeof p.opts === 'object') for (const [id, o] of Object.entries(p.opts)) put(o, 'name', 'c.' + type + '.o.' + p.k + '.' + id);
        }
      }
      if (typeof CATEGORIES !== 'undefined') CATEGORIES.forEach((c) => put(c, 1, 'cat.' + c[0]));
      if (typeof EXAMPLES !== 'undefined') EXAMPLES.forEach((e) => put(e, 'name', 'ex.' + e.id));
      return out;
    },
    relocalize() {
      if (!I._orig) { I._orig = new Map(); for (const [o, f, k] of I.statics()) I._orig.set(k, o[f]); }
      for (const [o, f, k] of I.statics()) o[f] = I.t(k, null, I._orig.get(k));
    },
    // <html lang>, title, meta description and [data-i18n] / [data-i18n-title] / [data-i18n-html] elements
    applyDom(root) {
      if (typeof document === 'undefined') return;
      document.documentElement.lang = I.lang; document.title = I.t('h.title');
      let m = document.querySelector('meta[name="description"]');
      if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
      m.content = I.t('h.description');
      (root || document).querySelectorAll('[data-i18n]').forEach(el => { el.textContent = I.t(el.dataset.i18n); });
      (root || document).querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = I.t(el.dataset.i18nHtml); });
      (root || document).querySelectorAll('[data-i18n-title]').forEach(el => { el.title = I.t(el.dataset.i18nTitle); });
    },
    set(code, persist = true) {
      const c = norm(code); if (!c) return false; I.lang = c;
      if (persist) try { localStorage.setItem(STORE, c); } catch (e) { /* ignore */ }
      I.relocalize(); I.applyDom();
      (I._listeners || []).forEach(f => f(c)); return true;
    },
    onChange(f) { (I._listeners = I._listeners || []).push(f); },
  };
  return I;
})();
// short alias used throughout the code (`t` itself is a common local name for time)
const _t = (key, params, dflt) => I18N.t(key, params, dflt);
