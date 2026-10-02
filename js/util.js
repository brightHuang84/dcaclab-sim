'use strict';
// ===== Utility helpers: SI units, geometry =====
const U = (() => {
  const PREFIX = { f: -15, p: -12, n: -9, u: -6, 'µ': -6, m: -3, k: 3, K: 3, M: 6, G: 9 };
  const PNAMES = { '-15': 'f', '-12': 'p', '-9': 'n', '-6': 'µ', '-3': 'm', '0': '', '3': 'k', '6': 'M', '9': 'G' };
  function parseSI(str) {
    if (typeof str === 'number') return str;
    str = String(str).trim().replace(/,/g, '');
    const m = str.match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*(meg|[fpnuµmkKMG])?/);
    if (!m) return NaN;
    let v = parseFloat(m[1]);
    if (m[2]) v *= Math.pow(10, m[2] === 'meg' ? 6 : PREFIX[m[2]]);
    return v;
  }
  function fmt(v, unit = '', prec = 4) {
    if (v === undefined || v === null || !isFinite(v)) return '— ' + unit;
    const a = Math.abs(v);
    if (a < 1e-15) return '0 ' + unit;
    let e = Math.floor(Math.log10(a) / 3) * 3;
    e = Math.max(-15, Math.min(9, e));
    let s = (v / Math.pow(10, e)).toPrecision(prec);
    if (Math.abs(parseFloat(s)) >= 1000 && e < 9) { e += 3; s = (v / Math.pow(10, e)).toPrecision(prec); }
    if (s.indexOf('e') >= 0) s = String(parseFloat(s));
    return s + ' ' + PNAMES[String(e)] + unit;
  }
  // compact form for labels, e.g. "4.7 kΩ"
  function fmtShort(v, unit = '') {
    const s = fmt(v, unit, 4);
    return s.replace(/(\.\d*?)0+(\s)/, '$1$2').replace(/\.(\s)/, '$1');
  }
  function rot(x, y, r) {
    switch (((r % 4) + 4) % 4) {
      case 0: return [x, y];
      case 1: return [-y, x];
      case 2: return [-x, -y];
      default: return [y, -x];
    }
  }
  function distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * dx - px, qy = ay + t * dy - py;
    return Math.sqrt(qx * qx + qy * qy);
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function shade(hex, amt) { // amt -1..1
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  function rgba(hex, a) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  return { parseSI, fmt, fmtShort, rot, distSeg, clamp, shade, rgba };
})();
