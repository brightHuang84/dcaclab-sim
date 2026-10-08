'use strict';
// ===== v9: multi-selection (box select, Ctrl/Shift+click, Ctrl+A), group move / nudge / rotate / copy / paste / delete,
// selection-only export with a file-name dialog, import as replace or merge, and automatic merging of wire chains =====
Object.assign(app, {
  selectMode: false, title: '', clip: null,

  // ---------- selection model ----------
  // this.sel is null, { comp }, { wire } or { multi: true, comps: [...], wires: [...] } (two or more items)
  selItems() {
    const s = this.sel; if (!s) return { comps: [], wires: [] };
    if (s.multi) return { comps: s.comps.filter(c => this.comps.includes(c)), wires: s.wires.filter(w => this.wires.includes(w)) };
    return { comps: s.comp ? [s.comp] : [], wires: s.wire ? [s.wire] : [] };
  },
  setSelection(comps, wires, quiet) {
    comps = [...new Set(comps)].filter(c => this.comps.includes(c));
    wires = [...new Set(wires)].filter(w => this.wires.includes(w));
    const n = comps.length + wires.length;
    this.sel = n === 0 ? null : n === 1 ? (comps.length ? { comp: comps[0] } : { wire: wires[0] }) : { multi: true, comps, wires };
    if (!quiet) this.refreshProps();
  },
  isSelected(o) {
    const s = this.sel; if (!s || !o) return false;
    if (s.multi) return s.comps.includes(o) || s.wires.includes(o);
    return s.comp === o || s.wire === o;
  },
  toggleSelect(o) {
    const { comps, wires } = this.selItems(), L = o.pts ? wires : comps, i = L.indexOf(o);
    if (i >= 0) L.splice(i, 1); else L.push(o);
    this.setSelection(comps, wires);
  },
  selectAll() { this.setSelection(this.comps.slice(), this.wires.slice()); this.toast(_t('sel.all', { n: this.comps.length + this.wires.length })); },
  clearSelection() { if (this.sel) { this.sel = null; this.refreshProps(); } },
  setSelectMode(on) {
    this.selectMode = !!on;
    if (on && this.wireMode) this.setWireMode(false);
    const b = $('#btn-select'); if (b) b.classList.toggle('active', this.selectMode);
    if (this.cv) this.cv.style.cursor = this.selectMode ? 'crosshair' : 'default';
  },

  // ---------- geometry of a group ----------
  // parts whose every terminal sits in a hole of one of the given breadboards (they travel with the board)
  carriedBy(boards) {
    const out = [];
    for (const b of boards) {
      const keys = new Set(bbHoles(b).map(h => pkey(h.x, h.y)));
      for (const o of this.comps) if (!DEFS[o.type].board && DEFS[o.type].terms.length && DEFS[o.type].terms.every((_, i) => keys.has(pkey(...this.termPos(o, i))))) out.push(o);
    }
    return out;
  },
  _wEnds(w) { return [pkey(...w.pts[0]), pkey(...w.pts[w.pts.length - 1])]; },
  // movement plan: which parts move, which wires move rigidly, which wires only have one end dragged along (stretch)
  groupPlan(comps, wires) {
    const G = new Set(comps);
    for (const o of this.carriedBy(comps.filter(c => DEFS[c.type].board))) G.add(o);
    const P = new Set(), anchor = new Set();
    for (const c of this.comps) DEFS[c.type].terms.forEach((_, i) => { (G.has(c) ? P : anchor).add(pkey(...this.termPos(c, i))); });
    for (const b of G) if (DEFS[b.type].board) for (const h of bbHoles(b)) P.add(pkey(h.x, h.y));
    const isAnchor = (k) => anchor.has(k) && !P.has(k);
    const R = new Set(wires.filter(w => this.wires.includes(w)));
    for (let grow = true; grow;) {
      grow = false;
      for (const w of R) for (const k of this._wEnds(w)) if (!isAnchor(k) && !P.has(k)) { P.add(k); grow = true; }
      for (const w of this.wires) if (!R.has(w)) { const [a, b] = this._wEnds(w); if (P.has(a) && P.has(b)) { R.add(w); grow = true; } }
    }
    const anch = new Map(), stretch = [];
    for (const w of R) { const [a, b] = this._wEnds(w), e = []; if (isAnchor(a)) e.push(1); if (isAnchor(b)) e.push(2); if (e.length) anch.set(w, e); }
    for (const w of this.wires) if (!R.has(w)) { const [a, b] = this._wEnds(w), e = []; if (P.has(a)) e.push(1); if (P.has(b)) e.push(2); if (e.length) stretch.push({ w, ends: e }); }
    const plan = { comps: [...G], rigid: [...R], anch, stretch };
    plan.cO = plan.comps.map(c => [c.x, c.y, c.rot]);
    plan.wO = new Map(plan.rigid.concat(stretch.map(s => s.w)).map(w => [w, w.pts.map(p => p.slice())]));
    return plan;
  },
  // re-apply the plan from the original snapshot with a point mapping f and `rot` extra quarter turns
  applyPlan(plan, f, rot = 0) {
    plan.comps.forEach((c, i) => { const o = plan.cO[i], q = f([o[0], o[1]]); c.x = q[0]; c.y = q[1]; if (rot) c.rot = (o[2] + rot) % 4; });
    for (const w of plan.rigid) {
      const O = plan.wO.get(w); w.pts = O.map(f);
      for (const e of plan.anch.get(w) || []) { const p = e === 1 ? O[0] : O[O.length - 1]; this.setEnd(w, e, p[0], p[1]); }
    }
    for (const s of plan.stretch) {
      const O = plan.wO.get(s.w); s.w.pts = O.map(p => p.slice());
      for (const e of s.ends) { const q = f(e === 1 ? O[0] : O[O.length - 1]); this.setEnd(s.w, e, q[0], q[1]); }
    }
    this.dirty = true;
  },
  finishPlan(plan) {
    const ws = plan.rigid.concat(plan.stretch.map(s => s.w));
    ws.forEach(w => this.normalizeWire(w));
    this.autoJoin(ws, plan.comps.filter(c => !DEFS[c.type].board));
    this.dirty = true; this.changed(); this.refreshProps();
  },
  moveSelection(dx, dy) {
    const { comps, wires } = this.selItems(); if (!comps.length && !wires.length) return false;
    const plan = this.groupPlan(comps, wires);
    this.applyPlan(plan, p => [p[0] + dx, p[1] + dy]); this.finishPlan(plan); return true;
  },
  itemsBox(comps, wires) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of comps) { const b = this.worldBox(c); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
    for (const w of wires) for (const p of w.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    return isFinite(x0) ? [x0, y0, x1, y1] : null;
  },
  rotateGroup() {
    const { comps, wires } = this.selItems(); if (!comps.length && !wires.length) return;
    const plan = this.groupPlan(comps, wires), b = this.itemsBox(plan.comps, plan.rigid); if (!b) return;
    const cx = snap((b[0] + b[2]) / 2), cy = snap((b[1] + b[3]) / 2);
    this.applyPlan(plan, p => { const [x, y] = U.rot(p[0] - cx, p[1] - cy, 1); return [cx + x, cy + y]; }, 1);
    this.finishPlan(plan);
  },
  deleteGroup() {
    const { comps, wires } = this.selItems();
    const G = new Set(comps); for (const o of this.carriedBy(comps.filter(c => DEFS[c.type].board))) G.add(o);
    const pins = new Set(); for (const c of G) DEFS[c.type].terms.forEach((_, i) => pins.add(pkey(...this.termPos(c, i))));
    const W = new Set(wires); for (const w of this.wires) { const [a, b] = this._wEnds(w); if (pins.has(a) && pins.has(b)) W.add(w); }   // wires left dangling at both ends
    const n = G.size + W.size;
    this.comps = this.comps.filter(c => !G.has(c)); this.wires = this.wires.filter(w => !W.has(w));
    this.sel = null; this.dirty = true; this.changed(); this.refreshProps();
    this.toast(_t('sel.deleted', { n }));
  },

  // ---------- box select ----------
  // left→right drag = window (items fully inside), right→left = crossing (anything touched). Breadboards only when fully inside.
  boxPick(x0, y0, x1, y1, crossing) {
    const L = Math.min(x0, x1), T = Math.min(y0, y1), Rr = Math.max(x0, x1), B = Math.max(y0, y1);
    const inPt = (x, y) => x >= L && x <= Rr && y >= T && y <= B;
    const segHit = (ax, ay, bx, by) => {      // Liang–Barsky clip of segment against the rectangle
      let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
      for (const [p, q] of [[-dx, ax - L], [dx, Rr - ax], [-dy, ay - T], [dy, B - ay]]) {
        if (p === 0) { if (q < 0) return false; continue; }
        const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
      }
      return true;
    };
    const comps = this.comps.filter(c => {
      const b = this.worldBox(c), full = b[0] >= L && b[2] <= Rr && b[1] >= T && b[3] <= B;
      if (DEFS[c.type].board || !crossing) return full;
      return b[0] <= Rr && b[2] >= L && b[1] <= B && b[3] >= T;
    });
    const wires = this.wires.filter(w => crossing ? w.pts.some((p, i) => i < w.pts.length - 1 && segHit(p[0], p[1], w.pts[i + 1][0], w.pts[i + 1][1])) : w.pts.every(p => inPt(p[0], p[1])));
    return { comps, wires };
  },
  boxRectWorld(d) { const [ax, ay] = this.toWorld(d.sx, d.sy), [bx, by] = this.toWorld(d.cx, d.cy); return [ax, ay, bx, by, d.cx < d.sx]; },
  updateBox(d, sx, sy) { d.cx = sx; d.cy = sy; const r = this.boxRectWorld(d); d.pick = this.boxPick(r[0], r[1], r[2], r[3], r[4]); },
  endBox(d) {
    const tiny = Math.hypot(d.cx - d.sx, d.cy - d.sy) < 4;
    if (tiny) { if (!d.add) this.clearSelection(); return; }
    const p = d.pick || { comps: [], wires: [] };
    if (d.add) { const cur = this.selItems(); this.setSelection(cur.comps.concat(p.comps), cur.wires.concat(p.wires)); }
    else this.setSelection(p.comps, p.wires);
  },
  drawBox(ctx, d) {
    const x = Math.min(d.sx, d.cx), y = Math.min(d.sy, d.cy), w = Math.abs(d.cx - d.sx), h = Math.abs(d.cy - d.sy), cross = d.cx < d.sx;
    ctx.save(); ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = cross ? 'rgba(46,160,67,0.10)' : 'rgba(30,136,229,0.10)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = cross ? '#2ea043' : '#1e88e5'; ctx.lineWidth = 1.2; ctx.setLineDash(cross ? [6, 4] : []); ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    ctx.restore();
  },
  // highlight of a multi-selection (or of the live box-select preview)
  drawMultiSel(ctx, comps, wires, preview) {
    const v = this.view;
    ctx.save();
    for (const w of wires) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); this.wirePts(w).forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.strokeStyle = preview ? 'rgba(30,136,229,0.30)' : 'rgba(30,136,229,0.5)'; ctx.lineWidth = 11; ctx.stroke(); }
    ctx.strokeStyle = '#1e88e5'; ctx.lineWidth = 1.5 / v.s; ctx.setLineDash([5 / v.s, 4 / v.s]);
    if (preview) ctx.globalAlpha = 0.6;
    for (const c of comps) { const b = this.worldBox(c); D.rrect(ctx, b[0] - 6, b[1] - 6, b[2] - b[0] + 12, b[3] - b[1] + 12, 6); ctx.stroke(); }
    if (!preview && comps.length + wires.length > 1) {
      const b = this.itemsBox(comps, wires);
      if (b) { ctx.strokeStyle = 'rgba(30,136,229,0.55)'; ctx.setLineDash([2 / v.s, 4 / v.s]); ctx.strokeRect(b[0] - 14, b[1] - 14, b[2] - b[0] + 28, b[3] - b[1] + 28); }
    }
    ctx.restore();
  },

  // ---------- clipboard / sub-circuits ----------
  // the parts of a selection (+ parts carried by selected breadboards) and every wire whose both ends are on them
  // (also through free junctions of selected / internal wires); wires ending on an outside part are left out
  subset(comps, wires) {
    const G = new Set(comps); for (const o of this.carriedBy(comps.filter(c => DEFS[c.type].board))) G.add(o);
    const P = new Set(), outside = new Set();
    for (const c of this.comps) DEFS[c.type].terms.forEach((_, i) => { (G.has(c) ? P : outside).add(pkey(...this.termPos(c, i))); });
    for (const b of G) if (DEFS[b.type].board) for (const h of bbHoles(b)) P.add(pkey(h.x, h.y));
    const W = new Set(wires.filter(w => this.wires.includes(w))), pts = new Set(P);
    for (let grow = true; grow;) {
      grow = false;
      for (const w of W) for (const k of this._wEnds(w)) if (!pts.has(k)) { pts.add(k); grow = true; }
      for (const w of this.wires) if (!W.has(w)) { const [a, b] = this._wEnds(w); if (pts.has(a) && pts.has(b)) { W.add(w); grow = true; } }
    }
    for (const w of [...W]) if (this._wEnds(w).some(k => outside.has(k) && !P.has(k))) W.delete(w);
    const order = this.comps.filter(c => G.has(c));
    return { comps: order, wires: this.wires.filter(w => W.has(w)) };
  },
  // language-neutral JSON of a sub-circuit, positions shifted so the top-left corner is at the origin (grid-aligned)
  serializeSubset(comps, wires) {
    const b = this.itemsBox(comps, wires) || [0, 0, 0, 0];
    const sx = Math.floor(b[0] / GRID) * GRID, sy = Math.floor(b[1] / GRID) * GRID;
    const ids = new Map(); let n = 1;
    const out = {
      app: 'dcaclab-sim', version: 2, kind: 'selection',
      comps: comps.map(c => { ids.set(c, n); return { id: n++, type: c.type, x: c.x - sx, y: c.y - sy, rot: c.rot, props: JSON.parse(JSON.stringify(c.props)) }; }),
      wires: wires.map(w => ({ id: n++, pts: w.pts.map(p => [p[0] - sx, p[1] - sy]), color: w.color })),
    };
    return { data: out, sx, sy };
  },
  copySelection(quiet) {
    const { comps, wires } = this.selItems();
    if (!comps.length && !wires.length) { if (!quiet) this.toast(_t('sel.nothing')); return false; }
    const s = this.subset(comps, wires), r = this.serializeSubset(s.comps, s.wires);
    this.clip = { data: r.data, sx: r.sx, sy: r.sy, n: 0 };
    try { localStorage.setItem('dcaclab-sim-clip', JSON.stringify(this.clip)); } catch (e) { /* ignore */ }
    if (!quiet) this.toast(_t('sel.copied', { n: s.comps.length + s.wires.length }));
    return true;
  },
  cutSelection() { if (this.copySelection(true)) { const n = this.selItems(); this.deleteGroup(); void n; } },
  paste() {
    if (!this.clip) { try { this.clip = JSON.parse(localStorage.getItem('dcaclab-sim-clip')); } catch (e) { this.clip = null; } }
    if (!this.clip || !this.clip.data) { this.toast(_t('sel.clip_empty')); return null; }
    const k = ++this.clip.n;
    const r = this.insertData(this.clip.data, this.clip.sx + 2 * GRID * k, this.clip.sy + 2 * GRID * k);
    if (r) this.toast(_t('sel.pasted', { n: r.comps.length + r.wires.length }));
    return r;
  },
  duplicateGroup() { if (this.copySelection(true)) return this.paste(); return null; },
  // add a sub-circuit (selection export / clipboard) shifted by (dx,dy), nudged right until no pin lands on an existing
  // connection point; the new items become the selection. One undo step.
  insertData(data, dx, dy, avoid = true) {
    if (typeof data === 'string') data = JSON.parse(data);
    if (!data || !Array.isArray(data.comps)) throw new Error(_t('app.invalid_circuit_file'));
    const srcC = data.comps.filter(c => DEFS[c.type]), srcW = (data.wires || []).filter(w => Array.isArray(w.pts) && w.pts.length >= 2 || w.x1 !== undefined);
    dx = snap(dx); dy = snap(dy);
    const occ = new Set();
    for (const c of this.comps) DEFS[c.type].terms.forEach((_, i) => occ.add(pkey(...this.termPos(c, i))));
    for (const w of this.wires) this._wEnds(w).forEach(k => occ.add(k));
    const wPts = (w) => (Array.isArray(w.pts) && w.pts.length >= 2 ? w.pts.map(p => [p[0], p[1]]) : this.lPath(w.x1, w.y1, w.x2, w.y2, w.bend || 0));
    const pinsAt = (ox, oy) => {
      const keys = [];
      for (const c of srcC) { const t = { type: c.type, x: c.x + ox, y: c.y + oy, rot: c.rot || 0, props: Object.assign(defaultProps(c.type), c.props || {}) }; DEFS[c.type].terms.forEach((_, i) => keys.push(pkey(...this.termPos(t, i)))); }
      for (const w of srcW) { const P = wPts(w); keys.push(pkey(P[0][0] + ox, P[0][1] + oy), pkey(P[P.length - 1][0] + ox, P[P.length - 1][1] + oy)); }
      return keys;
    };
    if (avoid && (this.comps.length || this.wires.length)) for (let k = 0; k < 60 && pinsAt(dx, dy).some(q => occ.has(q)); k++) dx += 2 * GRID;
    const comps = srcC.map(c => {
      const n = { id: this.nextId++, type: c.type, x: c.x + dx, y: c.y + dy, rot: c.rot || 0, props: Object.assign(defaultProps(c.type), JSON.parse(JSON.stringify(c.props || {}))), state: {}, _m: {} };
      if (DEFS[c.type].board) this.comps.unshift(n); else this.comps.push(n);
      return n;
    });
    const wires = srcW.map(w => { const n = { id: this.nextId++, pts: wPts(w).map(p => [p[0] + dx, p[1] + dy]), color: w.color || '#d62828', _i: 0, _phase: 0 }; this.normalizeWire(n); this.wires.push(n); return n; });
    this.dirty = true;
    this.setSelection(comps, wires, true);
    this.changed();                          // (merges wire chains; selection is remapped by mergeWires)
    this.refreshProps();
    const s = this.selItems();
    return { comps: s.comps, wires: s.wires, dx, dy };
  },

  // ---------- wire auto-merge ----------
  // a point joining exactly two wire ends and nothing else (no terminal, no breadboard hole, no third wire) is not a real
  // junction: the two wires become one polyline (the point turns into a bend; collinear vertices are dropped).
  // Topology is unchanged, so the simulation result is identical. Returns the number of merges.
  mergeWires() {
    let total = 0;
    for (let pass = 0; pass < 64; pass++) {
      const ends = new Map(), blocked = new Set();
      for (const c of this.comps) {
        DEFS[c.type].terms.forEach((_, i) => blocked.add(pkey(...this.termPos(c, i))));
        if (DEFS[c.type].board) for (const h of bbHoles(c)) blocked.add(pkey(h.x, h.y));
      }
      for (const w of this.wires) [1, 2].forEach(e => { const k = pkey(...this.wEnd(w, e)); let l = ends.get(k); if (!l) ends.set(k, l = []); l.push({ w, e }); });
      const used = new Set(); let n = 0;
      for (const [k, l] of ends) {
        if (l.length !== 2 || blocked.has(k) || l[0].w === l[1].w || used.has(l[0].w) || used.has(l[1].w)) continue;
        const [a, b] = l;
        const len = (w) => w.pts.reduce((s, p, i) => (i ? s + Math.abs(p[0] - w.pts[i - 1][0]) + Math.abs(p[1] - w.pts[i - 1][1]) : 0), 0);
        const A = a.e === 2 ? a.w.pts : a.w.pts.slice().reverse();          // ...→ junction
        const B = b.e === 1 ? b.w.pts : b.w.pts.slice().reverse();          // junction → ...
        const keep = a.w, gone = b.w;
        keep.color = len(b.w) > len(a.w) ? b.w.color : a.w.color;
        keep.pts = A.map(p => p.slice()).concat(B.slice(1).map(p => p.slice())); delete keep.bend;
        this.normalizeWire(keep);
        this.wires = this.wires.filter(w => w !== gone);
        this._remapSel(gone, keep);
        used.add(keep); used.add(gone); n++;
      }
      total += n; if (!n) break;
    }
    if (total) this.dirty = true;
    return total;
  },
  _remapSel(gone, keep) {
    const s = this.sel; if (!s) return;
    if (s.wire === gone) s.wire = keep;
    if (s.multi) { const i = s.wires.indexOf(gone); if (i >= 0) { s.wires.splice(i, 1); if (!s.wires.includes(keep)) s.wires.push(keep); } if (s.comps.length + s.wires.length === 1) this.sel = s.comps.length ? { comp: s.comps[0] } : { wire: s.wires[0] }; }
    if (this.hover && this.hover.wire === gone) this.hover = null;
  },

  // ---------- file name / export dialog ----------
  stampName() { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return 'circuit-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); },
  // strip characters that are illegal in file names on Windows/macOS/Linux, trim dots/spaces, avoid reserved names, add .json
  sanitizeFileName(s, fallback) {
    s = String(s == null ? '' : s).replace(/\.json\s*$/i, '');
    s = s.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, '_').replace(/\s+/g, ' ').replace(/_+/g, '_').trim().replace(/^[.\s_]+|[.\s]+$/g, '');
    if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(s)) s += '_';
    if (s.length > 100) s = s.slice(0, 100).trim();
    if (!s) s = fallback || this.stampName();
    return s + '.json';
  },
  downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
  showDialog(html, mount) {
    let el = $('#dlg'); if (!el) { el = document.createElement('div'); el.id = 'dlg'; document.body.appendChild(el); }
    el.innerHTML = '<div class="dlg-back"><div class="dlg" role="dialog" aria-modal="true">' + html + '</div></div>';
    el.style.display = 'block';
    const box = el.querySelector('.dlg');
    box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') this.closeDialog(); });
    el.querySelector('.dlg-back').addEventListener('pointerdown', (e) => { if (e.target === e.currentTarget) this.closeDialog(); });
    mount(box);
  },
  closeDialog() { const el = $('#dlg'); if (el) { el.innerHTML = ''; el.style.display = 'none'; } this._dlg = null; },
  openExportDialog(scope) {
    const S = this.selItems(), sub = (S.comps.length || S.wires.length) ? this.subset(S.comps, S.wires) : null;
    if (!scope) scope = this.sel && this.sel.multi && sub ? 'sel' : 'all';
    if (scope === 'sel' && !sub) scope = 'all';
    const cnt = (c, w) => '<span class="muted">' + _t('exp.count', { c, w }) + '</span>';
    const def = this.title || this.stampName();
    this._dlg = 'export';
    this.showDialog(
      '<div class="dlg-h">⬇ ' + _t('exp.title') + '</div>' +
      '<div class="dlg-l">' + _t('exp.scope') + '</div>' +
      '<label class="dlg-r"><input type="radio" name="exp-scope" value="all"' + (scope === 'all' ? ' checked' : '') + '> ' + _t('exp.all') + ' ' + cnt(this.comps.length, this.wires.length) + '</label>' +
      '<label class="dlg-r' + (sub ? '' : ' off') + '"><input type="radio" name="exp-scope" value="sel"' + (scope === 'sel' ? ' checked' : '') + (sub ? '' : ' disabled') + '> ' + _t('exp.sel') + ' ' + (sub ? cnt(sub.comps.length, sub.wires.length) : '<span class="muted">' + _t('exp.no_sel') + '</span>') + '</label>' +
      '<div class="dlg-l">' + _t('exp.name') + '</div>' +
      '<div class="dlg-name"><input type="text" id="exp-name" maxlength="120" spellcheck="false" value="' + this.esc(def) + '"><span>.json</span></div>' +
      '<div class="dlg-prev">' + _t('exp.will_save') + ' <b id="exp-prev"></b></div>' +
      '<div class="dlg-b"><button id="dlg-cancel">' + _t('exp.cancel') + '</button><button id="dlg-ok" class="primary">' + _t('exp.ok') + '</button></div>',
      (box) => {
        const inp = box.querySelector('#exp-name'), prev = box.querySelector('#exp-prev');
        const upd = () => { prev.textContent = this.sanitizeFileName(inp.value, def); };
        inp.oninput = upd; upd();
        inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); box.querySelector('#dlg-ok').click(); } };
        box.querySelector('#dlg-cancel').onclick = () => this.closeDialog();
        box.querySelector('#dlg-ok').onclick = () => {
          const sc = (box.querySelector('input[name=exp-scope]:checked') || {}).value || 'all';
          const name = this.sanitizeFileName(inp.value, def);
          this.closeDialog(); this.exportAs(name, sc);
        };
        inp.focus(); inp.select();
      });
  },
  // export the whole circuit or only the selection under the given (already sanitised) file name
  exportAs(filename, scope) {
    filename = /\.json$/i.test(filename) ? filename : this.sanitizeFileName(filename);
    const title = filename.replace(/\.json$/i, '');
    let data;
    if (scope === 'sel') {
      const S = this.selItems(), sub = this.subset(S.comps, S.wires);
      data = this.serializeSubset(sub.comps, sub.wires).data; data.title = title;
    } else {
      if (this.title !== title) { this.title = title; this.changed(); }
      data = this.serialize();
    }
    this.downloadJSON(data, filename);
    this.lastExport = { filename, data };
    this.toast(_t('exp.done', { name: filename }));
    return data;
  },
  // import: an empty canvas is simply replaced; otherwise ask whether to replace the circuit or merge (insert) the file
  importData(data, name) {
    if (typeof data === 'string') data = JSON.parse(data);
    if (!data || !Array.isArray(data.comps)) throw new Error(_t('app.invalid_circuit_file'));
    if (!this.comps.length && !this.wires.length) { this.importReplace(data, name); return 'replace'; }
    const isSel = data.kind === 'selection', nw = (data.wires || []).length;
    this._dlg = 'import';
    this.showDialog(
      '<div class="dlg-h">⬆ ' + _t('imp.title') + '</div>' +
      '<p>' + _t('imp.question', { name: '<b>' + this.esc(name || '') + '</b>' }) + '</p>' +
      (isSel ? '<p class="muted">' + _t('imp.sel_note', { c: data.comps.length, w: nw }) + '</p>' : '') +
      '<div class="dlg-b"><button id="dlg-cancel">' + _t('exp.cancel') + '</button><button id="imp-replace"' + (isSel ? '' : ' class="primary"') + '>' + _t('imp.replace') + '</button><button id="imp-merge"' + (isSel ? ' class="primary"' : '') + '>' + _t('imp.merge') + '</button></div>',
      (box) => {
        box.querySelector('#dlg-cancel').onclick = () => this.closeDialog();
        box.querySelector('#imp-replace').onclick = () => { this.closeDialog(); this.importReplace(data, name); };
        box.querySelector('#imp-merge').onclick = () => { this.closeDialog(); this.importMerge(data); };
        setTimeout(() => box.querySelector(isSel ? '#imp-merge' : '#imp-replace').focus(), 0);
      });
    return 'ask';
  },
  importReplace(data, name) { this.load(data); this.fitView(); this.toast(_t('ui.imported') + (name || '')); },
  importMerge(data) {
    const srcC = data.comps.filter(c => DEFS[c.type]);
    const pseudo = srcC.map(c => ({ type: c.type, x: c.x, y: c.y, rot: c.rot || 0, props: Object.assign(defaultProps(c.type), c.props || {}) }));
    const b = this.itemsBox(pseudo, (data.wires || []).filter(w => Array.isArray(w.pts))) || [0, 0, 0, 0];
    const [cx, cy] = this.toWorld(this.W / 2, this.H / 2);
    const r = this.insertData(data, cx - (b[0] + b[2]) / 2, cy - (b[1] + b[3]) / 2);
    this.toast(_t('imp.merged', { n: r.comps.length + r.wires.length }));
    return r;
  },

  // ---------- properties panel for a multi-selection ----------
  groupPropsHtml() {
    const { comps, wires } = this.selItems();
    const types = new Map(); for (const c of comps) types.set(c.type, (types.get(c.type) || 0) + 1);
    let h = '<div class="ph"><div class="pt"><span class="ic-sel"></span> ' + _t('sel.n_selected', { n: comps.length + wires.length }) + '<div class="pid">' + _t('exp.count', { c: comps.length, w: wires.length }) + '</div></div></div>';
    h += '<div class="btns"><button id="g-rot">⟳ ' + _t('sel.rotate') + '</button><button id="g-dup">❐ ' + _t('sel.duplicate') + '</button><button id="g-copy">📋 ' + _t('sel.copy') + '</button>' +
      '<button id="g-export">⬇ ' + _t('sel.export') + '</button><button id="g-clear">✕ ' + _t('sel.clear') + '</button><button id="g-del" class="danger">🗑 ' + _t('sel.delete') + '</button></div>';
    if (types.size) h += '<div class="readings"><div class="rt">' + _t('sel.types') + '</div>' + [...types].map(([t, n]) => '<div>' + DEFS[t].name + '<b>× ' + n + '</b></div>').join('') + (wires.length ? '<div>' + _t('h.wire_item') + '<b>× ' + wires.length + '</b></div>' : '') + '</div>';
    // bulk edit when every selected part has the same type
    if (types.size === 1 && comps.length > 1) {
      const d = DEFS[comps[0].type], c = comps[0];
      const fields = d.props.filter(p => p.kind !== 'text').map(p => this.propFieldHtml(p, c.props[p.k])).join('');
      if (fields) h += '<div class="help bulk"><div class="rt">' + _t('sel.bulk', { n: comps.length, name: d.name }) + '</div>' + fields + '</div>';
    }
    h += '<div class="hint">' + _t('sel.hint') + '</div>';
    return h;
  },
  bindGroupProps(el) {
    const { comps } = this.selItems();
    const on = (id, f) => { const b = el.querySelector('#' + id); if (b) b.onclick = f; };
    on('g-rot', () => this.rotateGroup());
    on('g-dup', () => this.duplicateGroup());
    on('g-copy', () => this.copySelection());
    on('g-export', () => this.openExportDialog('sel'));
    on('g-clear', () => this.clearSelection());
    on('g-del', () => this.deleteGroup());
    const bulk = el.querySelector('.bulk'); if (!bulk || !comps.length) return;
    const d = DEFS[comps[0].type], pd = (k) => d.props.find(p => p.k === k);
    const setAll = (k, v) => { for (const c of comps) { c.props[k] = v; if (c.type !== 'scope') { c.state = { fuseBlown: c.state.fuseBlown }; c._m = {}; } if (d.onProp) d.onProp(c, k); } this.dirty = true; this.changed(); };
    bulk.querySelectorAll('input[type=text]').forEach(inp => {
      const p = pd(inp.dataset.k);
      inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); };
      inp.onchange = () => {
        const v = U.parseSI(inp.value);
        if (!isFinite(v) || (p.min !== undefined && v < p.min) || (p.max !== undefined && v > p.max)) { inp.classList.add('bad'); this.toast(_t('ui.invalid_value') + inp.value); return; }
        inp.classList.remove('bad'); setAll(p.k, v);
      };
    });
    bulk.querySelectorAll('input[type=range]').forEach(inp => { inp.oninput = () => { for (const c of comps) c.props[inp.dataset.k] = parseFloat(inp.value); this.dirty = true; }; inp.onchange = () => this.changed(); });
    bulk.querySelectorAll('select').forEach(sel => { sel.onchange = () => { const p = pd(sel.dataset.k); setAll(p.k, p.num ? parseFloat(sel.value) : sel.value); this.refreshProps(); }; });
    bulk.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.onchange = () => setAll(cb.dataset.k, cb.checked); });
    bulk.querySelectorAll('.sw').forEach(b => { b.onclick = () => { setAll(b.dataset.k, b.dataset.v); this.refreshProps(); }; });
  },
});
