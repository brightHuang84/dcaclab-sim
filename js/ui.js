'use strict';
// ===== UI: palette, toolbar, properties panel, analysis table, pointer/touch & keyboard =====
Object.assign(app, {
  // ---------- properties panel ----------
  refreshProps() {
    const el = $('#props-body'); if (!el) return;
    const s = this.sel;
    if (!s) { el.innerHTML = this.helpHtml(); this.bindSettings(); return; }
    if (s.multi) { el.innerHTML = this.groupPropsHtml(); this.bindGroupProps(el); return; }
    if (s.wire) {
      const w = s.wire;
      el.innerHTML = _t('ui.wire') + w.pts.length + _t('ui.vertices') +
        this.wireColorHtml([w]) +
        _t('ui.reset_to_right_angle_delete') +
        _t('ui.drag_a_segment_to_move_it_drag_the_s') +
        '<div id="readings" class="readings"></div>';
      this.bindWireColor(el, [w]);
      $('#p-bend').onclick = () => { this.rotateSel(); this.refreshProps(); };
      $('#p-del').onclick = () => this.deleteSel();
      this.updateReadings(true); return;
    }
    const c = s.comp, d = DEFS[c.type];
    let h = '<div class="ph"><canvas class="picon" width="56" height="40"></canvas><div class="pt">' + d.name + (I18N.isZh() ? ' <small>' + d.en + '</small>' : '') + '<div class="pid">' + (this.designators().get(c) || '') + ' · #' + c.id + '</div></div></div>';
    if (d.desc) h += '<div class="pdesc">' + d.desc + '</div>';
    if (c.type === 'scope') h += '<canvas id="scope-big" width="226" height="170"></canvas>';
    for (const p of d.props) if (!p.show || p.show(c)) h += this.propFieldHtml(p, c.props[p.k]);
    const extra = [];
    if (c.type === 'switch') extra.push('<button id="p-toggle" class="primary">' + (c.props.closed ? _t('ui.open_switch') : _t('ui.close_switch')) + '</button>');
    if (c.type === 'fuse' && c.state.blown) extra.push(_t('ui.replace_fuse'));
    if (c.type === 'multimeter' && c.state.fuseBlown) extra.push(_t('ui.replace_meter_fuse'));
    if (c.state.burnt) extra.push(_t('ui.replace_with_new'));
    if (c.type === 'capacitor') extra.push(_t('ui.discharge'));
    for (const a of d.acts || []) extra.push('<button class="p-act primary" data-a="' + a.k + '">' + a.label + '</button>');
    h += '<div class="btns">' + extra.join('') + _t('ui.rotate_r_duplicate_delete');
    h += '<div id="readings" class="readings"></div>';
    if (d.info) h += '<details class="finfo"' + (this._finfoOpen ? ' open' : '') + '><summary>' + _t('ttl.func_table') + '</summary><pre>' + String(d.info(c)).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre></details>';
    if (d.termNames) h += _t('ui.terminals') + d.termNames.join(' / ') + '</div>';
    if (d.board) h += _t('ui.each_column_a_e_and_f_j_has_five_con');
    el.innerHTML = h;
    this.drawThumb(el.querySelector('.picon'), c.type, c);
    const fi = el.querySelector('.finfo'); if (fi) fi.ontoggle = () => { this._finfoOpen = fi.open; };
    el.querySelectorAll('input.tprop').forEach(inp => { inp.onchange = () => { c.props[inp.dataset.k] = inp.value.slice(0, 40); this.dirty = true; this.changed(); }; inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); }; });
    this.bindQty(el, d, [c]);
    el.querySelectorAll('.p-act').forEach(b => b.onclick = () => { d.act(c, b.dataset.a, this); this.dirty = true; this.updateReadings(true); });
    el.querySelectorAll('input[type=text]:not(.tprop):not(.qn)').forEach(inp => {
      const pd = d.props.find(p => p.k === inp.dataset.k);
      inp.onchange = () => {
        const v = U.parseSI(inp.value);
        if (!isFinite(v) || (pd.min !== undefined && v < pd.min) || (pd.max !== undefined && v > pd.max)) { inp.classList.add('bad'); this.toast(_t('ui.invalid_value') + inp.value + (pd.max !== undefined ? _t('ui.range') + pd.min + '…' + pd.max + ')' : '')); return; }
        inp.classList.remove('bad'); c.props[pd.k] = v; this.dirty = true; this.changed();
        inp.value = v && Math.abs(v) < 1e-9 ? String(v) : U.fmtShort(v, '').replace(/\s/g, '');
      };
      inp.onkeydown = (e) => { if (e.key === 'Enter') inp.blur(); };
    });
    el.querySelectorAll('input[type=range]:not(.qr)').forEach(inp => {
      inp.oninput = () => { c.props[inp.dataset.k] = parseFloat(inp.value); const pd = d.props.find(p => p.k === inp.dataset.k); inp.parentElement.querySelector('.rv').textContent = pd && pd.fmt ? pd.fmt(+inp.value) : Math.round(inp.value * 100) + '%'; this.dirty = true; };
      inp.onchange = () => this.changed();
    });
    el.querySelectorAll('select').forEach(sel => sel.onchange = () => {
      const pd = d.props.find(p => p.k === sel.dataset.k);
      c.props[sel.dataset.k] = pd.num ? parseFloat(sel.value) : sel.value;
      if (c.type !== 'scope') { const keep = { fuseBlown: c.state.fuseBlown }; for (const k of d.keepState || []) keep[k] = c.state[k]; c.state = keep; c._m = {}; }
      if (d.onProp) { d.onProp(c, sel.dataset.k); this.dirty = true; this.changed(); this.refreshProps(); return; }   // e.g. part-number presets
      this.dirty = true; this.changed();
      if (pd.refresh) this.refreshProps();
    });
    el.querySelectorAll('input[type=checkbox]').forEach(cb => cb.onchange = () => { c.props[cb.dataset.k] = cb.checked; this.dirty = true; this.changed(); this.refreshProps(); });
    el.querySelectorAll('.sw').forEach(b => b.onclick = () => { c.props[b.dataset.k] = b.dataset.v; this.dirty = true; this.changed(); this.refreshProps(); });
    const on = (id, f) => { const b = el.querySelector('#' + id); if (b) b.onclick = f; };
    on('p-toggle', () => { DEFS.switch.click(c, this); this.refreshProps(); });
    el.querySelectorAll('.mcu-edit').forEach(b => b.onclick = () => MCU.openEditor(c));
    el.querySelectorAll('.mcu-ser').forEach(b => b.onclick = () => MCU.openEditor(c, true));
    el.querySelectorAll('.mcu-pin').forEach(b => b.onclick = () => { if (typeof MCUHELP !== 'undefined' && MCUHELP) MCUHELP.open(c.type); });
    on('p-fix', () => { c.state = {}; this.dirty = true; this.refreshProps(); this.toast(_t('ui.replaced')); });
    on('p-discharge', () => { c.state.v = 0; c.state.i = 0; this.dirty = true; this.toast(_t('ui.capacitor_discharged')); });
    on('p-rot', () => this.rotateSel());
    on('p-dup', () => this.duplicateSel());
    on('p-del', () => this.deleteSel());
    this.updateReadings(true);
  },
  // one properties-panel field (also used by the bulk editor of a multi-selection)
  // v11 quantity fields: slider (linear or logarithmic) + number box with units
  qtyPos(p, v) {
    v = +v;
    if (p.log) { const lm = p.lmin || 1; if (v <= Math.max(p.min, 0) + 1e-12) return 0; return U.clamp(Math.round(1000 * Math.log(Math.max(v, lm) / lm) / Math.log(p.max / lm)), 1, 1000); }
    return U.clamp(Math.round(1000 * (v - p.min) / (p.max - p.min)), 0, 1000);
  },
  qtyVal(p, pos) {
    let v = p.log ? (pos <= 0 ? p.min : (p.lmin || 1) * Math.pow(p.max / (p.lmin || 1), pos / 1000)) : p.min + (p.max - p.min) * pos / 1000;
    const st = p.step || 1; v = Math.round(v / st) * st;
    return +U.clamp(v, p.min, p.max).toFixed(6);
  },
  qtyTxt(v) { return String(+(+v).toFixed(6)); },
  bindQty(el, d, comps) {
    const pd = (k) => d.props.find(p => p.k === k);
    const set = (k, v) => { for (const c of comps) c.props[k] = v; this.dirty = true; };
    el.querySelectorAll('.qty').forEach(f => {
      const p = pd(f.dataset.k), r = f.querySelector('.qr'), n = f.querySelector('.qn'), lab = f.querySelector('.rv');
      if (!p || !r || !n) return;
      r.oninput = () => { const v = this.qtyVal(p, +r.value); set(p.k, v); n.value = this.qtyTxt(v); n.classList.remove('bad'); if (lab) lab.textContent = p.fmt(v); };
      r.onchange = () => this.changed();
      n.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') n.blur(); };
      n.onchange = () => {
        const v = U.parseSI(n.value.replace(',', '.'));
        if (!isFinite(v) || v < p.min || v > p.max) { n.classList.add('bad'); this.toast(_t('ui.invalid_value') + n.value + _t('ui.range') + p.min + '…' + p.max + ')'); return; }
        n.classList.remove('bad'); set(p.k, v); r.value = this.qtyPos(p, v); if (lab) lab.textContent = p.fmt(v); this.changed();
      };
    });
  },
  propFieldHtml(p, v) {
    if (p.kind === 'qty') return '<div class="field qty" data-k="' + p.k + '"><label>' + p.label + ' <span class="rv">' + p.fmt(+v) + '</span></label><div class="qrow"><input type="range" class="qr" min="0" max="1000" step="1" data-k="' + p.k + '" value="' + this.qtyPos(p, v) + '"><input type="text" class="qn" data-k="' + p.k + '" value="' + this.qtyTxt(v) + '"><span class="unit">' + (p.unit || '') + '</span></div></div>';
    if (p.kind === 'range') return '<div class="field"><label>' + p.label + ' <span class="rv">' + (p.fmt ? p.fmt(v) : Math.round(v * 100) + '%') + '</span></label><input type="range" min="0" max="1" step="0.01" data-k="' + p.k + '" value="' + v + '"></div>';
    else if (p.kind === 'select') return '<div class="field"><label>' + p.label + '</label><select data-k="' + p.k + '">' + p.opts.map(([val, lab]) => '<option value="' + val + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + lab + '</option>').join('') + '</select></div>';
    else if (p.kind === 'bool') return '<div class="field"><label class="chk"><input type="checkbox" data-k="' + p.k + '"' + (v ? ' checked' : '') + '> ' + p.label + '</label></div>';
    else if (p.kind === 'color') return '<div class="field"><label>' + p.label + '</label><div class="swatches">' + Object.entries(p.opts).map(([k, o]) => '<button class="sw' + (k === v ? ' on' : '') + '" title="' + o.name + '" data-k="' + p.k + '" data-v="' + k + '" style="background:' + o.hex + '"></button>').join('') + '</div></div>';
    else if (p.kind === 'code') return '<div class="field"><label>' + p.label + ' <span class="rv">' + _t('mcu.lines_n', { n: String(v || '').split('\n').length }) + '</span></label><div class="mcu-btns"><button class="mcu-edit primary">✎ ' + _t('mcu.edit_program') + '</button><button class="mcu-ser">⌨ ' + _t('mcu.serial_monitor') + '</button><button class="mcu-pin" title="' + _t('help.title') + '">📌 ' + _t('help.btn') + '</button></div></div>';
    else if (p.kind === 'text') return '<div class="field"><label>' + p.label + '</label><input type="text" class="tprop" maxlength="40" data-k="' + p.k + '" value="' + String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '"></div>';
    else return '<div class="field"><label>' + p.label + '</label><div class="numrow"><input type="text" data-k="' + p.k + '" value="' + (v && Math.abs(v) < 1e-9 ? String(v) : U.fmtShort(v, '').replace(/\s/g, '')) + '"><span class="unit">' + (p.unit || '') + '</span></div></div>';
  },
  updateReadings(force) {
    const r = document.getElementById('readings'); if (!r || !this.sel || this.sel.multi) return;
    if (!force && !this.running) return;
    const z = (v, e) => (Math.abs(v) < e ? 0 : v);
    if (this.sel.wire) { r.innerHTML = _t('ui.live_readings_current_i') + U.fmt(z(this.sel.wire._i, 1e-8), 'A') + '</b></div>'; return; }
    const c = this.sel.comp, m = c._m || {};
    const big = document.getElementById('scope-big');
    if (big) {
      const dpr = window.devicePixelRatio || 1;
      if (!big._init) { big._init = true; big.width = 226 * dpr; big.height = 170 * dpr; big.style.width = '226px'; big.style.height = '170px'; }
      const ctx = big.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawScopeScreen(ctx, c, 0, 0, 226, 170, true);
    }
    if (DEFS[c.type].board) { r.innerHTML = ''; return; }
    let h = _t('ui.live_readings');
    if (typeof METER_TYPES !== 'undefined' && METER_TYPES.has(c.type)) {   // meters read even when stopped (static solve)
      const T = meterText(c);
      h += '<div class="big">' + T.txt + ' ' + T.unit + (c._s && c._s.warn && MM_OHMISH[c.props.mode] ? ' <span class="warn">⚠</span>' : '') + '</div>';
      for (const [k, v] of meterReadings(c)) if (k !== _t('common.reading')) h += '<div>' + k + '<b>' + v + '</b></div>';
      if (c.state.fuseBlown) h += _t('ui.meter_fuse_blown_a_range_unavailable');
      r.innerHTML = h; return;
    }
    if (!this.hasRun) h += _t('ui.run_the_simulation_to_see_readings');
    else {
      if (m.reading !== undefined) {
        const md = c.props.mode || 'DC';
        const unit = c.type === 'ammeter' ? 'A' : c.type === 'voltmeter' ? 'V' : (md === 'OHM' ? 'Ω' : md[0]);
        const txt = unit === 'Ω' && !(m.reading < 2e7) ? _t('ui.ol_open') : U.fmt(m.reading, unit);
        h += '<div class="big">' + txt + '</div>';
      }
      if (c.type === 'npn' || c.type === 'pnp') {
        h += _t('ui.collector_current_ic') + U.fmt(z(m.I, 1e-9), 'A') + _t('ui.base_current_ib') + U.fmt(z(m.Ib, 1e-10), 'A') + '</b></div>' +
          '<div>Vce<b>' + U.fmt(z(m.V, 1e-6), 'V') + '</b></div><div>Vbe<b>' + U.fmt(z(m.Vbe, 1e-6), 'V') + '</b></div>' +
          '<div>Ic/Ib<b>' + (Math.abs(m.Ib) > 1e-10 ? (m.I / m.Ib).toFixed(1) : '—') + _t('ui.state') + this.bjtRegion(c) + '</b></div>';
      } else if (c.type === 'nmos') {
        h += _t('ui.drain_current_id') + U.fmt(z(m.I, 1e-9), 'A') + '</b></div><div>Vgs<b>' + U.fmt(z(m.Vgs, 1e-6), 'V') + '</b></div><div>Vds<b>' + U.fmt(z(m.V, 1e-6), 'V') + '</b></div>';
      } else if (c.type === 'ic555') {
        h += _t('ui.output_out') + (c.state.q ? _t('ui.high') : _t('ui.low')) + _t('ui.output_voltage') + U.fmt(m.V, 'V') + _t('ui.measured_frequency') + (c.state.freq ? U.fmt(c.state.freq, 'Hz') : '—') + '</b></div>';
      } else if (DEFS[c.type].readings) {
        for (const [k, v] of DEFS[c.type].readings(c)) h += '<div><span class="rk">' + k + '</span><b>' + v + '</b></div>';
      } else if (c.type === 'scope') {
        h += '<div>CH1<b>' + U.fmt(z(m.V, 1e-6), 'V') + '</b></div><div>CH2<b>' + U.fmt(z(m.V2, 1e-6), 'V') + _t('ui.frequency_ch1') + (c.state.freq ? U.fmt(c.state.freq, 'Hz') : '—') + '</b></div>';
        if (c.props.mode === 'fft') { const F = scopeFFT(c); if (F) h += _t('ui.fft_peak_ch1') + U.fmt(F.p1.f, 'Hz', 4) + ' / ' + U.fmt(F.p1.a, 'V', 3) + _t('ui.fft_resolution') + U.fmt(F.f1.df, 'Hz', 3) + '</b></div>'; }
      } else {
        const signed = ['ammeter', 'voltmeter', 'multimeter', 'battery', 'ac'].includes(c.type);
        const absI = signed ? m.I : Math.abs(m.I), absV = signed ? m.V : Math.abs(m.V);
        h += _t('ui.voltage_u') + U.fmt(z(absV, 1e-6), 'V') + _t('ui.current_i') + U.fmt(z(absI, 1e-8), 'A') + _t('ui.power_p') + U.fmt(z(m.P, 1e-9), 'W') + '</b></div>';
      }
      if (m.bright !== undefined) h += _t('ui.brightness') + Math.round(U.clamp(m.bright, 0, 9.99) * 100) + '%</b></div>';
      if (c.type === 'capacitor') h += _t('ui.capacitor_voltage') + U.fmt(z(c.state.v || 0, 1e-6), 'V') + '</b></div>';
      if (c.state.blown) h += _t('ui.fuse_blown');
      if (c.state.fuseBlown) h += _t('ui.meter_fuse_blown_a_range_unavailable');
      if (c.state.burnt) h += _t('ui.burnt_out');
    }
    r.innerHTML = h;
  },
  bjtRegion(c) {
    const vbe = (c._m.Vbe || 0) * (c.type === 'pnp' ? -1 : 1), vce = (c._m.V || 0) * (c.type === 'pnp' ? -1 : 1);
    if (vbe < 0.5) return _t('ui.cut_off');
    if (vce < 0.3) return _t('ui.saturation');
    return _t('ui.active');
  },
  helpHtml() {
    return _t('ui.properties') +
      _t('ui.select_a_part_or_wire_to_edit_its_pa') +
      _t('ui.how_to_use') +
      _t('ui.drag_parts_from_the_left_onto_the_wo') +
      _t('ui.drag_from_a_terminal_gold_dot_to_dra') +
      _t('ui.drag_a_wire_segment_to_move_it_selec') +
      _t('ui.shift_drag_the_middle_of_a_wire_or_u') +
      _t('ui.click_a_switch_to_toggle_it_hold_a_p') +
      _t('ui.scroll_the_mouse_wheel_over_a_potent') +
      _t('ui.drag_empty_space_to_pan_scroll_to_zo') +
      _t('ui.r_rotate_del_delete_space_run_pause') +
      _t('ui.ctrl_z_undo_ctrl_d_duplicate_w_wire') +
      _t('ui.a_wire_passing_exactly_over_a_termin') +
      '<li>' + _t('sel.help1') + '</li><li>' + _t('sel.help2') + '</li><li>' + _t('sel.help3') + '</li>' +
      '</ul></div>' +
      _t('ui.simulation_settings') +
      _t('ui.time_step_t_input_type_text_id_set_d') + U.fmtShort(this.dt, '').replace(/\s/g, '') + '"><span class="unit">s</span></div></div>' +
      '<div class="field"><label class="chk"><input type="checkbox" id="set-electron"' + (this.electron ? ' checked' : '') + _t('ui.show_electron_flow_default_conventio') +
      this.advSettingsHtml();
  },
  // advanced solver options: defaults work for every circuit; shown collapsed
  advSettingsHtml() {
    const o = SIMOPT, num = (k, label, unit, hint) => '<div class="field"><label>' + label + (hint ? ' <small class="muted">' + hint + '</small>' : '') + '</label><div class="numrow"><input type="text" class="simopt" data-k="' + k + '" value="' + (k === 'maxIter' ? o[k] : U.fmtShort(o[k], '').replace(/\s/g, '')) + '"><span class="unit">' + unit + '</span></div></div>';
    const chk = (k, label) => '<div class="field"><label class="chk"><input type="checkbox" class="simopt" data-k="' + k + '"' + (o[k] ? ' checked' : '') + '> ' + label + '</label></div>';
    const st = this.net && this.net.stats, cv = this.conv;
    const stats = st ? _t('ui.this_run_recovered_automatically') + (st.hard - st.fail) + _t('ui.steps_time_step_cuts') + st.cut + _t('ui.gmin_stepping') + st.gmin + _t('ui.source_stepping') + st.src + _t('ui.not_converged') + st.fail + _t('ui.steps') + (cv && cv.n ? _t('ui.latest_t') + cv.t.toFixed(4) + _t('ui.s') : '') + '</div>' : '';
    const changed = Object.keys(SIMOPT_DEFAULTS).some(k => SIMOPT[k] !== SIMOPT_DEFAULTS[k]);
    return '<details class="help adv"' + (this._advOpen ? ' open' : '') + _t('ui.advanced_simulation_settings') + (changed ? _t('ui.modified') : '') + '</small></summary>' +
      _t('ui.the_defaults_work_for_every_circuit') +
      num('maxIter', _t('ui.max_iterations'), _t('ui.x829'), _t('ui.per_time_step')) + num('reltol', _t('ui.relative_tolerance_reltol'), '') + num('vntol', _t('ui.voltage_tolerance_vntol'), 'V') + num('abstol', _t('ui.current_tolerance_abstol'), 'A') +
      num('gmin', _t('ui.minimum_conductance_gmin'), 'S', _t('ui.node_to_ground')) + chk('autoStep', _t('ui.automatic_time_step_retry_with_small')) + num('minStep', _t('ui.minimum_time_step'), 's') +
      chk('homotopy', _t('ui.gmin_stepping_source_stepping_conver')) + chk('kclCheck', _t('ui.kcl_residual_convergence_check_robus')) +
      _t('ui.restore_defaults') + stats + '</details>';
  },
  bindSettings() {
    const dt = $('#set-dt');
    if (dt) dt.onchange = () => { const v = U.parseSI(dt.value); if (v > 1e-7 && v < 0.1) { this.dt = v; this.dirty = true; this.toast(_t('ui.time_step') + U.fmt(v, 's')); } else this.toast(_t('ui.the_time_step_must_be_between_0_1_s')); };
    const el = $('#set-electron'); if (el) el.onchange = () => { this.electron = el.checked; };
    const adv = document.querySelector('details.adv'); if (adv) adv.ontoggle = () => { this._advOpen = adv.open; };
    const LIM = { maxIter: [5, 2000], reltol: [1e-9, 0.1], vntol: [1e-12, 1e-2], abstol: [1e-15, 1e-2], gmin: [1e-18, 1e-6], minStep: [1e-15, 1e-3] };
    document.querySelectorAll('input.simopt').forEach((inp) => {
      const k = inp.dataset.k;
      inp.onchange = () => {
        if (inp.type === 'checkbox') SIMOPT[k] = inp.checked;
        else {
          let v = U.parseSI(inp.value); const [lo, hi] = LIM[k];
          if (!(v >= lo && v <= hi)) { this.toast(_t('ui.allowed_range') + U.fmtShort(lo, '') + ' ~ ' + U.fmtShort(hi, '')); inp.value = k === 'maxIter' ? SIMOPT[k] : U.fmtShort(SIMOPT[k], '').replace(/\s/g, ''); return; }
          SIMOPT[k] = k === 'maxIter' ? Math.round(v) : v;
        }
        saveSimOpt(); this.dirty = true; this.toast(_t('ui.simulation_setting_updated') + k + ' = ' + SIMOPT[k]);
      };
    });
    const rb = $('#simopt-reset'); if (rb) rb.onclick = () => { Object.assign(SIMOPT, SIMOPT_DEFAULTS); saveSimOpt(); this.dirty = true; this.toast(_t('ui.simulation_settings_restored_to_defa')); if (!this.sel) this.refreshProps(); };
  },
  drawThumb(cv, type, comp) {
    const ctx = cv.getContext('2d'), d = DEFS[type], dpr = window.devicePixelRatio || 1;
    const W = cv.width, H = cv.height;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const c = comp ? Object.assign({}, comp, { rot: 0 }) : { type, x: 0, y: 0, rot: 0, props: defaultProps(type), state: {}, _m: {} };
    if (d.board) { c.props = Object.assign({}, c.props, { cols: 10 }); c.x = 0; c.y = 0; c._holesKey = null; }
    const b = d.boxOf ? d.boxOf(c) : d.box, s = Math.min((W - 6) / (b[2] - b[0]), (H - 6) / (b[3] - b[1]), 0.9);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - s * (b[0] + b[2]) / 2), dpr * (H / 2 - s * (b[1] + b[3]) / 2));
    d.draw(ctx, c, { running: false });
  },

  // ---------- analysis window ----------
  toggleAnalysis() {
    const el = $('#analysis'); const show = el.style.display !== 'block';
    el.style.display = show ? 'block' : 'none'; this.showNodes = show;
    $('#btn-analysis').classList.toggle('active', show);
    if (show) { if (!this.net || this.dirty) this.rebuild(); this.updateAnalysis(true); }
  },
  updateAnalysis(force) {
    const el = $('#analysis'); if (!el || el.style.display !== 'block') return;
    if (!force && !this.running) return;
    if (!this.net || this.dirty) this.rebuild();
    const A = this.analysis(); if (!A) return;
    const z = (v, e) => (Math.abs(v) < e ? 0 : v);
    let h = _t('ui.circuit_analysis');
    h += _t('ui.kirchhoff_s_current_law_kcl_the_alge') + (this.hasRun ? '' : _t('ui.run_the_simulation_first')) + '</div>';
    h += _t('ui.node_voltage_kcl_i_connected_termina');
    for (const n of A.nodes) {
      const ok = Math.abs(n.kcl) < 1e-6 || n.n === 0;
      h += '<tr><td>' + (n.n === 0 ? 'GND (0)' : 'N' + n.n) + '</td><td>' + U.fmt(z(n.V, 1e-9), 'V') + '</td><td class="' + (ok ? 'ok' : 'bad') + '">' + (n.n === 0 ? _t('ui.reference') : (ok ? '✓ ' : '') + U.fmt(z(n.kcl, 1e-9), 'A', 2)) + '</td><td class="mem">' + n.members.join(', ') + '</td></tr>';
    }
    h += _t('ui.part_type_voltage_u_current_i_power');
    for (const r of A.comps) { const sg = ['ammeter', 'voltmeter', 'multimeter', 'battery', 'ac'].includes(r.c.type) ? 1 : Math.sign(r.I) || 1; h += '<tr><td>' + r.name + '</td><td>' + r.def.name + '</td><td>' + U.fmt(z(r.V * sg, 1e-6), 'V') + '</td><td>' + U.fmt(z(r.I * sg, 1e-10), 'A') + '</td><td>' + U.fmt(z(r.P, 1e-8), 'W') + '</td></tr>'; }
    h += '</table>';
    el.innerHTML = h;
    $('#an-close').onclick = () => this.toggleAnalysis();
  },

  // ---------- palette ----------
  buildPalette() {
    const pal = $('#palette-body');
    const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    let h = '<div class="pal-search"><input type="search" id="pal-q" autocomplete="off" placeholder="' + esc(_t('h.search_parts')) + '" value="' + esc(this.palQ || '') + '"></div><div id="pal-none" class="hint" hidden>' + _t('h.search_none') + '</div>';
    for (const [cat, title] of CATEGORIES) {
      h += '<div class="cat" data-cat="' + cat + '"><div class="cat-t">' + title + '</div><div class="items">';
      const subs = window.CAT_SUBS && window.CAT_SUBS[cat];   // v13: sub-sections inside a category (74-series: gates / flip-flops / counters …)
      const item = ([type, d]) => '<div class="item" data-type="' + type + '" data-s="' + esc((d.name + ' ' + d.en + ' ' + type + ' ' + (d.kw || '') + ' ' + (d.desc || '') + ' ' + title).toLowerCase()) + '" title="' + esc(d.name + (I18N.isZh() ? ' ' + d.en : '') + (d.desc ? '\n' + d.desc : '')) + '"><canvas width="64" height="44"></canvas><span>' + d.name + '</span>' + (I18N.isZh() ? '<small>' + d.en + '</small>' : '') + '</div>';
      if (subs) for (const sub of subs) { h += '<div class="sub-t" data-sub="' + sub + '">' + _t(((window.CAT_SUBKEY && window.CAT_SUBKEY[cat]) || 'ttl.sub.') + sub) + '</div>'; for (const e of Object.entries(DEFS)) if (e[1].cat === cat && e[1].pgrp === sub) h += item(e); }
      else for (const e of Object.entries(DEFS)) if (e[1].cat === cat) h += item(e);
      if (cat === 'other') h += '<div class="item" data-type="__wire" title="' + _t('h.wire_item') + ' (W)"><canvas width="64" height="44" id="wire-thumb"></canvas><span>' + _t('h.wire_item') + '</span>' + (I18N.isZh() ? '<small>Wire</small>' : '') + '</div>';
      h += '</div></div>';
    }
    pal.innerHTML = h;
    pal.querySelectorAll('.item').forEach(it => {
      const type = it.dataset.type, cv = it.querySelector('canvas');
      if (type === '__wire') {
        const ctx = cv.getContext('2d');
        this.drawWire(ctx, { pts: [[8, 34], [30, 34], [30, 12], [56, 12]], color: '#d62828' }, false);
        it.onclick = () => this.setWireMode(!this.wireMode);
        return;
      }
      this.drawThumb(cv, type);
      it.addEventListener('pointerdown', (e) => this.startPaletteDrag(e, type, cv));
    });
    const q = $('#pal-q');
    if (q) { q.oninput = () => this.filterPalette(q.value); q.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Escape') { q.value = ''; this.filterPalette(''); } }; this.filterPalette(q.value); }
  },
  // v11: palette search (name in the UI language, English name, type id, description, category)
  filterPalette(q) {
    this.palQ = q; const words = String(q || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    let any = false;
    document.querySelectorAll('#palette-body .cat').forEach(cat => {
      let n = 0;
      cat.querySelectorAll('.item').forEach(it => { const s = it.dataset.s || (it.dataset.type === '__wire' ? 'wire ' + _t('h.wire_item').toLowerCase() : ''); const ok = words.every(w => s.includes(w)); it.hidden = !ok; if (ok) n++; });
      cat.querySelectorAll('.sub-t').forEach(st => { let e = st.nextElementSibling, any2 = false; while (e && e.classList.contains('item')) { if (!e.hidden) any2 = true; e = e.nextElementSibling; } st.hidden = !any2; });
      cat.hidden = !n; if (n) any = true;
    });
    const none = $('#pal-none'); if (none) none.hidden = any;
  },
  setWireMode(on) {
    this.wireMode = on;
    if (on && this.selectMode) this.setSelectMode(false);
    const it = document.querySelector('.item[data-type="__wire"]'); if (it) it.classList.toggle('active', on);
    $('#btn-wire').classList.toggle('active', on);
    this.cv.style.cursor = on || this.selectMode ? 'crosshair' : 'default';
  },
  startPaletteDrag(e, type, cv) {
    e.preventDefault();
    const ghost = document.createElement('div'); ghost.className = 'ghost';
    const img = document.createElement('img'); img.src = cv.toDataURL(); ghost.appendChild(img);
    document.body.appendChild(ghost);
    const sx = e.clientX, sy = e.clientY;
    this.ghost = { type, over: false };
    const move = (ev) => {
      ghost.style.left = ev.clientX - 32 + 'px'; ghost.style.top = ev.clientY - 22 + 'px';
      const r = this.cv.getBoundingClientRect();
      const over = ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
      ghost.style.display = over ? 'none' : 'block';
      const [wx, wy] = this.toWorld(ev.clientX - r.left, ev.clientY - r.top);
      Object.assign(this.ghost, { over, x: wx, y: wy });
    };
    const up = (ev) => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
      ghost.remove();
      let c = null;
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) {
        const [wx, wy] = this.toWorld(this.W / 2 + (Math.random() - 0.5) * 80, this.H / 2 + (Math.random() - 0.5) * 80);
        c = this.addComp(type, wx, wy);
      } else if (this.ghost.over) c = this.addComp(type, this.ghost.x, this.ghost.y);
      this.ghost = null;
      if (c) { if (!DEFS[c.type].board) this.autoJoin([], [c]); this.sel = { comp: c }; this.changed(); this.refreshProps(); }
    };
    move(e);
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  },

  // ---------- canvas interaction ----------
  bindCanvas() {
    const cv = this.cv;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const touches = new Map();
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const [sx, sy] = pos(e), [wx, wy] = this.toWorld(sx, sy);
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, [sx, sy]);
        if (touches.size === 2) { this.cancelDrag(); this.startPinch(touches); return; }
        if (touches.size > 2) return;
      }
      if (e.button === 1 || e.button === 2 || this._space) { if (this._space) this._space.used = true; this.drag = { kind: 'pan', sx, sy, ox: this.view.ox, oy: this.view.oy }; return; }
      const mod = e.ctrlKey || e.metaKey, add = mod || e.shiftKey, multi = this.sel && this.sel.multi;
      const tol = Math.max(8, 10 / this.view.s);
      const selW = this.sel && this.sel.wire;
      if (selW) {
        for (let i = 0; i < selW.pts.length; i++) {
          const p = selW.pts[i];
          if (Math.hypot(p[0] - wx, p[1] - wy) < tol) {
            if (i === 0 || i === selW.pts.length - 1) this.drag = { kind: 'wireEnd', wire: selW, end: i === 0 ? 1 : 2, moved: false, orig: selW.pts.map(q => q.slice()) };
            else this.drag = { kind: 'vertex', wire: selW, i, moved: false };
            return;
          }
        }
      }
      const pt = this.pointAt(wx, wy, this.wireMode);
      const hit = this.compAt(wx, wy, false);
      if (add && hit && !this.wireMode) { this.toggleSelect(hit.c); return; }          // Ctrl/Shift+click: add / remove
      if (pt) { this.startWire(pt.x, pt.y, pt); return; }
      if (hit) { if (multi && this.isSelected(hit.c)) this.startGroupDrag(wx, wy, hit.c); else this.startMove(hit, wx, wy); return; }
      const wh = this.wireHit(wx, wy);
      if (wh) {
        if (!this.wireMode && (mod || (e.shiftKey && this.selectMode))) { this.toggleSelect(wh.w); return; }
        if (multi && this.isSelected(wh.w) && !this.wireMode && !e.shiftKey) { this.startGroupDrag(wx, wy, wh.w); return; }
        if (this.wireMode || e.shiftKey) {
          const q = this.snapOnWire(wh);
          this.splitWire(wh, q);
          this.startWire(q[0], q[1], { wire: wh.w });
          return;
        }
        this.sel = { wire: wh.w }; this.refreshProps();
        this.drag = { kind: 'seg', wire: wh.w, seg: wh.seg, start: [wx, wy], moved: false };
        return;
      }
      const bh = this.compAt(wx, wy, true);
      if (bh && !this.wireMode) {
        if (mod) { this.toggleSelect(bh.c); return; }
        if (multi && this.isSelected(bh.c)) { this.startGroupDrag(wx, wy, bh.c); return; }
        if (!this.selectMode && !e.shiftKey) { this.startMove(bh, wx, wy); return; }
      }
      if (this.wireMode) { this.startWire(snap(wx), snap(wy), null); return; }
      // empty canvas: rubber-band selection in select mode / with Shift or Ctrl; otherwise pan (touch: long-press → box)
      if ((this.selectMode || add) && e.pointerType !== 'touch') { this.drag = { kind: 'box', sx, sy, cx: sx, cy: sy, add, pick: null }; return; }
      if (this.sel && !this.selectMode) { this.sel = null; this.refreshProps(); }
      const d = this.drag = { kind: 'pan', sx, sy, ox: this.view.ox, oy: this.view.oy };
      if (e.pointerType === 'touch') d.lpT = setTimeout(() => {
        if (this.drag !== d || d.far) return;
        this.view.ox = d.ox; this.view.oy = d.oy;
        this.drag = { kind: 'box', sx, sy, cx: sx, cy: sy, add: false, pick: null, touch: true };
        if (navigator.vibrate) try { navigator.vibrate(15); } catch (err) { /* ignore */ }
      }, 450);
    });
    cv.addEventListener('pointermove', (e) => {
      const [sx, sy] = pos(e), [wx, wy] = this.toWorld(sx, sy);
      this.mouse = [sx, sy];
      if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
        touches.set(e.pointerId, [sx, sy]);
        if (this.pinch) { this.updatePinch(touches); return; }
      }
      const d = this.drag;
      if (!d) {
        const pt = this.pointAt(wx, wy, this.wireMode);
        this.hoverPt = pt;
        const hit = this.compAt(wx, wy, false);
        const wh = !hit && this.wireHit(wx, wy);
        this.hover = hit ? { comp: hit.c } : (wh ? { wire: wh.w } : null);
        this.hoverStrip = !hit && !wh ? this.holeAt(wx, wy) : (pt ? this.holeAt(pt.x, pt.y) : null);
        const inSel = this.sel && this.sel.multi && ((hit && this.isSelected(hit.c)) || (wh && this.isSelected(wh.w)));
        cv.style.cursor = pt ? 'crosshair' : inSel ? 'move' : hit ? (DEFS[hit.c.type].click || hit.c.type === 'button' ? 'pointer' : 'move') : wh ? 'grab' : (this.wireMode || this.selectMode ? 'crosshair' : 'default');
        return;
      }
      this.hover = null;
      if (d.kind === 'pan') { if (Math.hypot(sx - d.sx, sy - d.sy) > 8) { d.far = true; clearTimeout(d.lpT); } this.view.ox = d.ox + sx - d.sx; this.view.oy = d.oy + sy - d.sy; cv.style.cursor = 'grabbing'; }
      else if (d.kind === 'box') this.updateBox(d, sx, sy);
      else if (d.kind === 'group') {
        const dx = snap(wx - d.start[0]), dy = snap(wy - d.start[1]);
        if (dx !== d.dx || dy !== d.dy) { d.dx = dx; d.dy = dy; d.moved = d.moved || !!(dx || dy); this.applyPlan(d.plan, p => [p[0] + dx, p[1] + dy]); }
        cv.style.cursor = 'move';
      }
      else if (d.kind === 'move') this.dragMove(d, wx, wy);
      else if (d.kind === 'wire') {
        const [tx, ty] = this.dropTarget(wx, wy, d.wire);
        if (!d.bendSet && Math.hypot(wx - d.x0, wy - d.y0) > 12) { d.bend = Math.abs(wx - d.x0) >= Math.abs(wy - d.y0) ? 0 : 1; d.bendSet = true; }
        d.wire.pts = this.lPath(d.x0, d.y0, tx, ty, d.bend || 0);
      } else if (d.kind === 'wireEnd') {
        const [tx, ty] = this.dropTarget(wx, wy, d.wire);
        d.wire.pts = d.orig.map(q => q.slice()); // recompute from the original shape each move (no cumulative drift)
        this.setEnd(d.wire, d.end, tx, ty); d.moved = true; this.dirty = true;
      } else if (d.kind === 'vertex') {
        d.wire.pts[d.i] = [snap(wx), snap(wy)]; d.moved = true;
      } else if (d.kind === 'seg') this.dragSeg(d, wx, wy);
    });
    const end = (e) => {
      if (e && e.pointerType === 'touch') { touches.delete(e.pointerId); if (this.pinch) { if (touches.size < 2) this.pinch = null; return; } }
      const d = this.drag; this.drag = null; this.hoverPt = null;
      if (!d) return;
      if (d.lpT) clearTimeout(d.lpT);
      if (d.kind === 'box') { this.endBox(d); this.dirty = true; return; }
      if (d.kind === 'group') {
        if (d.moved) this.finishPlan(d.plan);
        else this.setSelection(d.item.pts ? [] : [d.item], d.item.pts ? [d.item] : []);   // plain click on a member: select just it
        this.dirty = true; return;
      }
      if (d.kind === 'move') {
        const c = d.comp;
        if (DEFS[c.type].momentary) { c.state.pressed = false; this.dirty = true; }
        if (d.moved) { d.att.forEach(a => this.normalizeWire(a.w)); if (!DEFS[c.type].board) this.autoJoin([], [c]); this.changed(); }
        else if (DEFS[c.type].click) DEFS[c.type].click(c, this, d.lx, d.ly);
        if (!d.moved && DEFS[c.type].click) this.refreshProps();
      } else if (d.kind === 'wire') {
        const w = d.wire, a = w.pts[0], b = w.pts[w.pts.length - 1];
        const same = (o) => JSON.stringify(o.pts) === JSON.stringify(w.pts) || JSON.stringify(o.pts.slice().reverse()) === JSON.stringify(w.pts);
        const dup = this.wires.some(o => o !== w && same(o));
        if ((a[0] === b[0] && a[1] === b[1]) || dup) {
          this.wires = this.wires.filter(o => o !== w);
          if (!dup && d.from && d.from.comp) { this.sel = { comp: d.from.comp }; this.refreshProps(); }
          if (!dup && d.from && d.from.wire && this.wires.includes(d.from.wire)) { this.sel = { wire: d.from.wire }; this.refreshProps(); }
        } else { this.normalizeWire(w); this.autoJoin([w]); this.dirty = true; this.changed(); }
      } else if (d.kind === 'wireEnd') { this.normalizeWire(d.wire); if (d.moved) { this.autoJoin([d.wire]); this.changed(); } }
      else if (d.kind === 'vertex' || d.kind === 'seg') { this.normalizeWire(d.wire); if (d.moved) { this.autoJoin([d.wire]); this.changed(); } }
      this.dirty = true;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { this.hover = null; if (!this.drag) { this.hoverPt = null; this.hoverStrip = null; } });
    cv.addEventListener('dblclick', (e) => {
      const [sx, sy] = pos(e), [wx, wy] = this.toWorld(sx, sy);
      const hitC = this.compAt(wx, wy, false);
      if (hitC) { if (DEFS[hitC.c.type].mcu) MCU.openEditor(hitC.c); return; }
      const tol = Math.max(8, 10 / this.view.s);
      for (const w of this.wires) for (let i = 1; i < w.pts.length - 1; i++) {
        if (Math.hypot(w.pts[i][0] - wx, w.pts[i][1] - wy) < tol) { w.pts.splice(i, 1); this.sel = { wire: w }; this.changed(); this.refreshProps(); this.toast(_t('ui.vertex_removed')); return; }
      }
      const wh = this.wireHit(wx, wy);
      if (wh) { const q = this.snapOnWire(wh); wh.w.pts.splice(wh.seg + 1, 0, q); this.sel = { wire: wh.w }; this.changed(); this.refreshProps(); this.toast(_t('ui.vertex_added_drag_the_square_handle')); }
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [sx, sy] = pos(e), [wx, wy] = this.toWorld(sx, sy);
      const hit = this.compAt(wx, wy, false);
      if (hit && (DEFS[hit.c.type].wheel || DEFS[hit.c.type].onWheel)) {
        const c = hit.c;
        if (DEFS[c.type].onWheel) DEFS[c.type].onWheel(c, e.deltaY < 0 ? 1 : -1, hit.lx, hit.ly);   // e.g. boost-module trimmer
        else c.props.pos = U.clamp(Math.round((c.props.pos + (e.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100, 0, 1);
        this.dirty = true; clearTimeout(this._wheelT); this._wheelT = setTimeout(() => this.changed(), 400);
        if (this.sel && this.sel.comp === c) this.refreshProps();
        return;
      }
      this.zoomAt(sx, sy, Math.pow(1.0015, -e.deltaY));
    }, { passive: false });
  },
  snapOnWire(wh) {
    const [ax, ay] = wh.w.pts[wh.seg], [bx, by] = wh.w.pts[wh.seg + 1];
    let [qx, qy] = wh.q;
    if (ay === by) { qx = U.clamp(snap(qx), Math.min(ax, bx), Math.max(ax, bx)); qy = ay; }
    else if (ax === bx) { qy = U.clamp(snap(qy), Math.min(ay, by), Math.max(ay, by)); qx = ax; }
    return [qx, qy];
  },
  // snapping target while dragging a wire end: terminal / wire end / hole / point on another wire / grid
  dropTarget(wx, wy, self) {
    const pt = this.pointAt(wx, wy, true, self);
    if (pt) { this.hoverPt = pt; this.hoverStrip = pt.hole ? { c: pt.board, strip: pt.hole.strip } : this.holeAt(pt.x, pt.y); return [pt.x, pt.y]; }
    const wh = this.wireHit(wx, wy, self);
    if (wh) { const q = this.snapOnWire(wh); this.hoverPt = { x: q[0], y: q[1] }; this.hoverStrip = null; return q; }
    this.hoverPt = null; const x = snap(wx), y = snap(wy); this.hoverStrip = this.holeAt(x, y); return [x, y];
  },
  startWire(x, y, from) {
    const w = { id: this.nextId++, pts: [[x, y], [x, y]], color: this.wireColor, _i: 0, _phase: 0 };
    this.wires.push(w); this.dirty = true;
    this.drag = { kind: 'wire', wire: w, from, x0: x, y0: y };
  },
  startMove(hit, wx, wy) {
    const c = hit.c, d = DEFS[c.type];
    this.sel = { comp: c }; this.refreshProps();
    if (!d.board) this.bringToFront(c);
    if (d.momentary && (!d.pressHit || d.pressHit(c, hit.lx, hit.ly))) { c.state.pressed = true; this.dirty = true; }
    const drag = { kind: 'move', comp: c, start: [wx, wy], orig: [c.x, c.y], att: this.attachedEnds(c), moved: false, lx: hit.lx, ly: hit.ly };
    drag.wOrig = new Map(drag.att.map(a => [a.w, a.w.pts.map(q => q.slice())]));
    if (d.board) { // carry plugged-in parts and wire ends
      const keys = new Set(bbHoles(c).map(h => pkey(h.x, h.y)));
      drag.carry = this.comps.filter(o => o !== c && !DEFS[o.type].board && DEFS[o.type].terms.length && DEFS[o.type].terms.every((_, i) => keys.has(pkey(...this.termPos(o, i))))).map(o => ({ o, x: o.x, y: o.y }));
      const carried = new Set(drag.carry.map(k => k.o));
      drag.full = []; drag.ends = [];
      for (const w of this.wires) {
        const e1 = keys.has(pkey(...w.pts[0])), e2 = keys.has(pkey(...w.pts[w.pts.length - 1]));
        if (e1 && e2) drag.full.push({ w, pts: w.pts.map(p => p.slice()) });
        else if (e1 || e2) { const e = e1 ? 1 : 2, p = this.wEnd(w, e); drag.ends.push({ w, end: e, x: p[0], y: p[1] }); }
      }
      drag.att = []; drag.wOrig = new Map(drag.ends.map(e => [e.w, e.w.pts.map(q => q.slice())]));
      void carried;
    }
    this.drag = drag;
  },
  dragMove(d, wx, wy) {
    const nx = snap(d.orig[0] + wx - d.start[0]), ny = snap(d.orig[1] + wy - d.start[1]);
    if (nx === d.comp.x && ny === d.comp.y) return;
    d.comp.x = nx; d.comp.y = ny; d.moved = true; this.dirty = true;
    for (const [w, pts] of d.wOrig) w.pts = pts.map(q => q.slice()); // re-route from the original wire shapes
    this.followTerms(d.comp, d.att);
    if (d.carry) {
      const dx = nx - d.orig[0], dy = ny - d.orig[1];
      for (const k of d.carry) { k.o.x = k.x + dx; k.o.y = k.y + dy; }
      for (const f of d.full) f.w.pts = f.pts.map(p => [p[0] + dx, p[1] + dy]);
      for (const e of d.ends) this.setEnd(e.w, e.end, e.x + dx, e.y + dy);
    }
  },
  dragSeg(d, wx, wy) {
    const w = d.wire, P = w.pts;
    const dx = snap(wx - d.start[0]), dy = snap(wy - d.start[1]);
    if (!d.moved) {
      if (!dx && !dy) return;
      // detach the segment from fixed wire ends by inserting duplicate vertices
      if (d.seg === 0) { P.unshift(P[0].slice()); d.seg = 1; }
      if (d.seg === P.length - 2) P.push(P[P.length - 1].slice());
      d.a = P[d.seg].slice(); d.b = P[d.seg + 1].slice();
      d.horiz = d.a[1] === d.b[1]; d.vert = d.a[0] === d.b[0];
      d.moved = true;
    }
    const mx = d.horiz ? 0 : dx, my = d.vert ? 0 : dy;
    P[d.seg] = [d.a[0] + mx, d.a[1] + my]; P[d.seg + 1] = [d.b[0] + mx, d.b[1] + my];
  },
  startGroupDrag(wx, wy, item) {
    const { comps, wires } = this.selItems();
    this.drag = { kind: 'group', plan: this.groupPlan(comps, wires), start: [wx, wy], dx: 0, dy: 0, moved: false, item };
  },
  cancelDrag() {
    const d = this.drag; if (!d) return;
    if (d.lpT) clearTimeout(d.lpT);
    if (d.kind === 'group' && d.moved) { this.applyPlan(d.plan, p => p); }
    if (d.kind === 'wire') this.wires = this.wires.filter(w => w !== d.wire);
    if (d.kind === 'move' && DEFS[d.comp.type].momentary) d.comp.state.pressed = false;
    this.drag = null;
  },
  startPinch(touches) {
    const [a, b] = [...touches.values()];
    this.pinch = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, c0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], v0: Object.assign({}, this.view) };
  },
  updatePinch(touches) {
    const [a, b] = [...touches.values()], p = this.pinch;
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const s = U.clamp(p.v0.s * d / p.d0, 0.2, 4);
    const wx = (p.c0[0] - p.v0.ox) / p.v0.s, wy = (p.c0[1] - p.v0.oy) / p.v0.s;
    this.view = { s, ox: c[0] - wx * s, oy: c[1] - wy * s };
  },
  bringToFront(c) { const i = this.comps.indexOf(c); if (i >= 0 && i < this.comps.length - 1) { this.comps.splice(i, 1); this.comps.push(c); } },

  // ---------- file ops ----------
  saveLocal() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())); this.toast(_t('ui.saved_to_browser_storage')); } catch (e) { this.toast(_t('ui.save_failed') + e.message); } },
  loadLocal() { const s = localStorage.getItem(SAVE_KEY); if (!s) { this.toast(_t('ui.no_saved_circuit_found')); return; } this.load(s); this.fitView(); this.toast(_t('ui.saved_circuit_loaded')); },
  download() { this.openExportDialog(); },
  downloadAllNow() {
    const blob = new Blob([JSON.stringify(this.serialize(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    const d = new Date(), pad = (n) => String(n).padStart(2, '0');
    a.download = 'circuit-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this.toast(_t('ui.json_file_exported'));
  },
  upload(file) {
    const r = new FileReader();
    r.onload = () => { try { this.importData(r.result, file.name); } catch (e) { this.toast(_t('ui.import_failed') + e.message); } };
    r.readAsText(file);
  },

  // ---------- toolbar & keys ----------
  bindToolbar() {
    const on = (id, f) => { $(id).onclick = f; };
    on('#btn-run', () => this.toggleRun());
    on('#btn-reset', () => { this.resetSim(); this.toast(_t('ui.simulation_reset')); this.refreshProps(); });
    on('#btn-undo', () => this.undo());
    on('#btn-redo', () => this.redo());
    on('#btn-rot', () => this.rotateSel());
    on('#btn-del', () => this.deleteSel());
    on('#btn-clear', () => { if (confirm(_t('ui.clear_the_whole_circuit'))) this.clearAll(); });
    on('#btn-wire', () => this.setWireMode(!this.wireMode));
    on('#btn-select', () => this.toggleSelectMode());
    on('#btn-analysis', () => this.toggleAnalysis());
    on('#btn-save', () => this.saveLocal());
    on('#btn-load', () => this.loadLocal());
    on('#btn-export', () => this.download());
    on('#btn-import', () => $('#file-in').click());
    on('#btn-fit', () => this.fitView());
    on('#btn-zin', () => this.zoomAt(this.W / 2, this.H / 2, 1.2));
    on('#btn-zout', () => this.zoomAt(this.W / 2, this.H / 2, 1 / 1.2));
    $('#file-in').onchange = (e) => { if (e.target.files[0]) this.upload(e.target.files[0]); e.target.value = ''; };
    this.buildExamples(); const exSel = $('#sel-example');
    exSel.onchange = () => { if (exSel.value) { this.loadExample(exSel.value); this.run(); } exSel.value = ''; };
    $('#sel-speed').onchange = (e) => { this.speed = parseFloat(e.target.value); };
    $('#chk-current').onchange = (e) => { this.showCurrent = e.target.checked; };
    document.addEventListener('keydown', (e) => {
      if (this._dlg) { if (e.key === 'Escape') this.closeDialog(); return; }
      if (e.target.matches('input, select, textarea')) return;
      const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      const arrows = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
      if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
      else if (mod && k === 'y') { e.preventDefault(); this.redo(); }
      else if (mod && k === 'd') { e.preventDefault(); this.duplicateSel(); }
      else if (mod && k === 's') { e.preventDefault(); this.saveLocal(); }
      else if (mod && k === 'a') { e.preventDefault(); this.selectAll(); }
      else if (mod && k === 'c') { e.preventDefault(); this.copySelection(); }
      else if (mod && k === 'x') { e.preventDefault(); this.cutSelection(); }
      else if (mod && k === 'v') { e.preventDefault(); this.paste(); }
      else if (arrows[k] && this.sel) { e.preventDefault(); const st = e.shiftKey ? 5 * GRID : GRID; this.moveSelection(arrows[k][0] * st, arrows[k][1] * st); }
      else if (k === 'r' && !mod) this.rotateSel();
      else if (k === 'j' && !mod) this.joinPassOvers();
      else if (k === 'delete' || k === 'backspace') { e.preventDefault(); this.deleteSel(); }
      else if (k === ' ') { e.preventDefault(); if (!e.repeat) this._space = { used: false }; }   // tap = run/pause, hold + drag = pan
      else if (k === 'w' && !mod) this.setWireMode(!this.wireMode);
      else if (k === 'v' && !mod) this.toggleSelectMode();
      else if (k === 'escape') { if (this.drag && this.drag.kind === 'box') this.drag = null; this.sel = null; this.setWireMode(false); this.refreshProps(); }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key !== ' ') return;
      const sp = this._space; this._space = null;
      if (sp && !sp.used && !e.target.matches('input, select, textarea') && !this._dlg) { e.preventDefault(); this.toggleRun(); }
    });
    window.addEventListener('blur', () => { this._space = null; });
  },
  toggleSelectMode() { this.setSelectMode(!this.selectMode); this.toast(this.selectMode ? _t('sel.mode_on') : _t('sel.mode_off')); },

  buildExamples() {
    const exSel = $('#sel-example'); if (!exSel) return;
    const tip = (e) => { const d = I18N.t('exd.' + e.id, null, ''); return d && d !== 'exd.' + e.id ? ' title="' + d.replace(/"/g, '&quot;') + '"' : ''; };
    exSel.innerHTML = _t('ui.example_circuits') + EXAMPLES.map(e => '<option value="' + e.id + '"' + tip(e) + '>' + e.name + '</option>').join('');
  },
  // language menu in the toolbar (native names); switching re-renders everything in place, the circuit is untouched
  buildLangMenu() {
    const sel = $('#sel-lang'); if (!sel) return;
    sel.innerHTML = I18N.LANGS.map(([c, n]) => '<option value="' + c + '"' + (c === I18N.lang ? ' selected' : '') + '>' + n + '</option>').join('');
    sel.onchange = () => this.setLang(sel.value);
  },
  setLang(code) {
    I18N.set(code);
    const sel = $('#sel-lang'); if (sel) sel.value = I18N.lang;
    this.buildPalette(); if (this.wireMode) this.setWireMode(true);
    this.buildExamples(); this.updateRunBtn(); this.refreshProps(); this.updateAnalysis(true);
    if (this.updateHud) this.updateHud();
    if (this._dlg === 'export') this.openExportDialog(); else if (this._dlg) this.closeDialog();
    if (typeof MCU !== 'undefined') MCU.relang();
    if (typeof MCUHELP !== 'undefined' && MCUHELP) MCUHELP.relang();
    this.dirty = true;
  },
  init() {
    I18N.relocalize(); I18N.applyDom(); this.buildLangMenu();
    this.cv = $('#cv'); this.ctx = this.cv.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.buildPalette(); this.bindToolbar(); this.bindCanvas();
    const q = new URLSearchParams(location.search);
    let loaded = false;
    if (q.get('example')) { this.loadExample(q.get('example')); loaded = true; }
    else if (!q.has('fresh')) {
      try { const s = localStorage.getItem(STORE_KEY); if (s && JSON.parse(s).comps.length) { this.load(s); this.fitView(); loaded = true; } } catch (e) { /* ignore */ }
    }
    if (!loaded) this.loadExample('series');
    if (q.get('run') === '1') this.run();
    this.updateRunBtn(); this.refreshProps();
    requestAnimationFrame((t) => this.frame(t));
  },
});
window.addEventListener('DOMContentLoaded', () => app.init());
