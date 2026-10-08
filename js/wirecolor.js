'use strict';
// ===== v10.1: wire colours =====
// Swatches (10 named colours + a custom colour picker) in the properties panel for one selected wire or for every
// wire of a multi-selection (one undo step). New wires use the last colour chosen (kept in localStorage, default red).
// Wires of different colours are never auto-merged (see mergeWires in select.js), so a colour change is never lost.
const WIRE_PALETTE = [
  ['red', '#d62828'], ['black', '#222222'], ['blue', '#1d5fd1'], ['green', '#2a9d3a'], ['yellow', '#f2b705'],
  ['orange', '#f77f00'], ['white', '#e8e8e8'], ['purple', '#8e44ad'], ['gray', '#8a8f98'], ['brown', '#8b5a2b'],
];
const WIRE_DEFAULT = '#d62828';
const WC_KEY = 'dcaclab-wirecolor';
const normHex = (c) => {
  let s = String(c || '').trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(s)) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return /^#[0-9a-f]{6}$/.test(s) ? s : null;
};
// relative luminance 0 (black) … 1 (white)
const hexLum = (c) => { const h = normHex(c) || WIRE_DEFAULT; const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const sameWireColor = (a, b) => (normHex(a) || WIRE_DEFAULT) === (normHex(b) || WIRE_DEFAULT);

Object.assign(app, {
  wireColorHtml(wires) {
    const cols = [...new Set(wires.map(w => normHex(w.color) || WIRE_DEFAULT))];
    const cur = cols.length === 1 ? cols[0] : null;
    const named = cur && WIRE_PALETTE.some(([, h]) => h === cur);
    let h = '<div class="field wc"><label>' + _t('wc.title') + (wires.length > 1 ? ' <span class="rv">' + _t('wc.n_wires', { n: wires.length }) + '</span>' : '') + '</label><div class="swatches wc-sw">';
    for (const [id, hex] of WIRE_PALETTE) h += '<button class="sw' + (cur === hex ? ' on' : '') + '" data-wc="' + hex + '" title="' + _t('wc.' + id) + '" style="background:' + hex + '"></button>';
    h += '<label class="sw sw-custom' + (cur && !named ? ' on' : '') + '" title="' + _t('wc.custom') + '"' + (cur && !named ? ' style="background:' + cur + '"' : '') + '><input type="color" class="wc-pick" value="' + (cur || this.wireColor || WIRE_DEFAULT) + '"></label>';
    h += '</div><div class="hint wc-hint">' + _t('wc.hint') + '</div></div>';
    return h;
  },
  bindWireColor(el, wires) {
    el.querySelectorAll('.wc-sw button[data-wc]').forEach(b => b.onclick = () => this.setWireColors(wires, b.dataset.wc));
    const pick = el.querySelector('.wc-pick');
    if (pick) pick.onchange = () => this.setWireColors(wires, pick.value);
  },
  // colour every wire in `wires` (one undo step) and remember the colour for new wires
  setWireColors(wires, color) {
    const hex = normHex(color); if (!hex) return false;
    const live = wires.filter(w => this.wires.includes(w));
    this.rememberWireColor(hex);
    if (live.some(w => !sameWireColor(w.color, hex) || w.color !== hex)) { for (const w of live) w.color = hex; this.changed(); }
    this.refreshProps();
    return true;
  },
  rememberWireColor(hex) {
    this.wireColor = hex;
    try { localStorage.setItem(WC_KEY, hex); } catch (e) { /* storage unavailable (file:// in some browsers) */ }
  },
});
// restore the last colour (not with ?fresh=1, which starts from defaults)
try {
  if (!/[?&]fresh=1/.test(location.search)) { const v = normHex(localStorage.getItem(WC_KEY)); if (v) app.wireColor = v; }
} catch (e) { /* ignore */ }
