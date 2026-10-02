'use strict';
// ===== UI: palette, toolbar, properties panel, analysis table, pointer/touch & keyboard =====
Object.assign(app, {
  // ---------- properties panel ----------
  refreshProps() {
    const el = $('#props-body'); if (!el) return;
    const s = this.sel;
    if (!s) { el.innerHTML = this.helpHtml(); this.bindSettings(); return; }
    if (s.wire) {
      const w = s.wire;
      el.innerHTML = '<div class="ph"><div class="pt">导线 <small>Wire</small><div class="pid">' + w.pts.length + ' 个顶点 vertices</div></div></div>' +
        '<div class="field"><label>颜色</label><div class="swatches">' + WIRE_COLORS.map(c => '<button class="sw' + (c === w.color ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '"></button>').join('') + '</div></div>' +
        '<div class="btns"><button id="p-bend">↱ 重置为直角</button><button id="p-del" class="danger">🗑 删除</button></div>' +
        '<div class="hint">拖动线段可平移；拖动方形顶点可改变折线；双击导线添加顶点，双击顶点删除。</div>' +
        '<div id="readings" class="readings"></div>';
      el.querySelectorAll('.sw').forEach(b => b.onclick = () => { w.color = b.dataset.c; this.wireColor = w.color; this.changed(); this.refreshProps(); });
      $('#p-bend').onclick = () => { this.rotateSel(); this.refreshProps(); };
      $('#p-del').onclick = () => this.deleteSel();
      this.updateReadings(true); return;
    }
    const c = s.comp, d = DEFS[c.type];
    let h = '<div class="ph"><canvas class="picon" width="56" height="40"></canvas><div class="pt">' + d.name + ' <small>' + d.en + '</small><div class="pid">' + (this.designators().get(c) || '') + ' · #' + c.id + '</div></div></div>';
    if (c.type === 'scope') h += '<canvas id="scope-big" width="226" height="170"></canvas>';
    for (const p of d.props) {
      const v = c.props[p.k];
      if (p.kind === 'range') h += '<div class="field"><label>' + p.label + ' <span class="rv">' + (p.fmt ? p.fmt(v) : Math.round(v * 100) + '%') + '</span></label><input type="range" min="0" max="1" step="0.01" data-k="' + p.k + '" value="' + v + '"></div>';
      else if (p.kind === 'select') h += '<div class="field"><label>' + p.label + '</label><select data-k="' + p.k + '">' + p.opts.map(([val, lab]) => '<option value="' + val + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + lab + '</option>').join('') + '</select></div>';
      else if (p.kind === 'bool') h += '<div class="field"><label class="chk"><input type="checkbox" data-k="' + p.k + '"' + (v ? ' checked' : '') + '> ' + p.label + '</label></div>';
      else if (p.kind === 'color') h += '<div class="field"><label>' + p.label + '</label><div class="swatches">' + Object.entries(p.opts).map(([k, o]) => '<button class="sw' + (k === v ? ' on' : '') + '" title="' + o.name + '" data-k="' + p.k + '" data-v="' + k + '" style="background:' + o.hex + '"></button>').join('') + '</div></div>';
      else if (p.kind === 'text') h += '<div class="field"><label>' + p.label + '</label><input type="text" class="tprop" maxlength="40" data-k="' + p.k + '" value="' + String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '"></div>';
      else h += '<div class="field"><label>' + p.label + '</label><div class="numrow"><input type="text" data-k="' + p.k + '" value="' + (v && Math.abs(v) < 1e-9 ? String(v) : U.fmtShort(v, '').replace(/\s/g, '')) + '"><span class="unit">' + (p.unit || '') + '</span></div></div>';
    }
    const extra = [];
    if (c.type === 'switch') extra.push('<button id="p-toggle" class="primary">' + (c.props.closed ? '断开开关' : '闭合开关') + '</button>');
    if (c.type === 'fuse' && c.state.blown) extra.push('<button id="p-fix" class="primary">🔧 更换保险丝</button>');
    if (c.type === 'multimeter' && c.state.fuseBlown) extra.push('<button id="p-fix" class="primary">🔧 更换表内保险丝</button>');
    if (c.state.burnt) extra.push('<button id="p-fix" class="primary">🔧 更换新的</button>');
    if (c.type === 'capacitor') extra.push('<button id="p-discharge">⚡ 放电</button>');
    h += '<div class="btns">' + extra.join('') + '<button id="p-rot">⟳ 旋转 (R)</button><button id="p-dup">⧉ 复制</button><button id="p-del" class="danger">🗑 删除</button></div>';
    h += '<div id="readings" class="readings"></div>';
    if (d.termNames) h += '<div class="hint">端子: ' + d.termNames.join(' / ') + '</div>';
    if (d.board) h += '<div class="hint">每列 a–e、f–j 五孔相通；上下两侧电源轨整行相通；中间凹槽两侧不相通。拖动面包板会带着插在上面的元件一起移动。悬停孔位可高亮其连通组。</div>';
    el.innerHTML = h;
    this.drawThumb(el.querySelector('.picon'), c.type, c);
    el.querySelectorAll('input.tprop').forEach(inp => { inp.onchange = () => { c.props[inp.dataset.k] = inp.value.slice(0, 40); this.dirty = true; this.changed(); }; inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); }; });
    el.querySelectorAll('input[type=text]:not(.tprop)').forEach(inp => {
      const pd = d.props.find(p => p.k === inp.dataset.k);
      inp.onchange = () => {
        const v = U.parseSI(inp.value);
        if (!isFinite(v) || (pd.min !== undefined && v < pd.min) || (pd.max !== undefined && v > pd.max)) { inp.classList.add('bad'); this.toast('无效数值：' + inp.value + (pd.max !== undefined ? ' (范围 ' + pd.min + '…' + pd.max + ')' : '')); return; }
        inp.classList.remove('bad'); c.props[pd.k] = v; this.dirty = true; this.changed();
        inp.value = v && Math.abs(v) < 1e-9 ? String(v) : U.fmtShort(v, '').replace(/\s/g, '');
      };
      inp.onkeydown = (e) => { if (e.key === 'Enter') inp.blur(); };
    });
    el.querySelectorAll('input[type=range]').forEach(inp => {
      inp.oninput = () => { c.props[inp.dataset.k] = parseFloat(inp.value); const pd = d.props.find(p => p.k === inp.dataset.k); inp.parentElement.querySelector('.rv').textContent = pd && pd.fmt ? pd.fmt(+inp.value) : Math.round(inp.value * 100) + '%'; this.dirty = true; };
      inp.onchange = () => this.changed();
    });
    el.querySelectorAll('select').forEach(sel => sel.onchange = () => {
      const pd = d.props.find(p => p.k === sel.dataset.k);
      c.props[sel.dataset.k] = pd.num ? parseFloat(sel.value) : sel.value;
      if (c.type !== 'scope') { const keep = { fuseBlown: c.state.fuseBlown }; c.state = keep; c._m = {}; }
      if (d.onProp) { d.onProp(c, sel.dataset.k); this.dirty = true; this.changed(); this.refreshProps(); return; }   // e.g. part-number presets
      this.dirty = true; this.changed();
    });
    el.querySelectorAll('input[type=checkbox]').forEach(cb => cb.onchange = () => { c.props[cb.dataset.k] = cb.checked; this.dirty = true; this.changed(); this.refreshProps(); });
    el.querySelectorAll('.sw').forEach(b => b.onclick = () => { c.props[b.dataset.k] = b.dataset.v; this.dirty = true; this.changed(); this.refreshProps(); });
    const on = (id, f) => { const b = el.querySelector('#' + id); if (b) b.onclick = f; };
    on('p-toggle', () => { DEFS.switch.click(c, this); this.refreshProps(); });
    on('p-fix', () => { c.state = {}; this.dirty = true; this.refreshProps(); this.toast('已更换'); });
    on('p-discharge', () => { c.state.v = 0; c.state.i = 0; this.dirty = true; this.toast('电容已放电'); });
    on('p-rot', () => this.rotateSel());
    on('p-dup', () => this.duplicateSel());
    on('p-del', () => this.deleteSel());
    this.updateReadings(true);
  },
  updateReadings(force) {
    const r = document.getElementById('readings'); if (!r || !this.sel) return;
    if (!force && !this.running) return;
    const z = (v, e) => (Math.abs(v) < e ? 0 : v);
    if (this.sel.wire) { r.innerHTML = '<div class="rt">实时读数</div><div>电流 I<b>' + U.fmt(z(this.sel.wire._i, 1e-8), 'A') + '</b></div>'; return; }
    const c = this.sel.comp, m = c._m || {};
    const big = document.getElementById('scope-big');
    if (big) {
      const dpr = window.devicePixelRatio || 1;
      if (!big._init) { big._init = true; big.width = 226 * dpr; big.height = 170 * dpr; big.style.width = '226px'; big.style.height = '170px'; }
      const ctx = big.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawScopeScreen(ctx, c, 0, 0, 226, 170, true);
    }
    if (DEFS[c.type].board) { r.innerHTML = ''; return; }
    let h = '<div class="rt">实时读数 Live</div>';
    if (typeof METER_TYPES !== 'undefined' && METER_TYPES.has(c.type)) {   // meters read even when stopped (static solve)
      const T = meterText(c);
      h += '<div class="big">' + T.txt + ' ' + T.unit + (c._s && c._s.warn && MM_OHMISH[c.props.mode] ? ' <span class="warn">⚠</span>' : '') + '</div>';
      for (const [k, v] of meterReadings(c)) if (k !== '读数') h += '<div>' + k + '<b>' + v + '</b></div>';
      if (c.state.fuseBlown) h += '<div class="warn">表内保险丝已熔断 (A 档不可用)</div>';
      r.innerHTML = h; return;
    }
    if (!this.hasRun) h += '<div class="muted">运行仿真后显示读数</div>';
    else {
      if (m.reading !== undefined) {
        const md = c.props.mode || 'DC';
        const unit = c.type === 'ammeter' ? 'A' : c.type === 'voltmeter' ? 'V' : (md === 'OHM' ? 'Ω' : md[0]);
        const txt = unit === 'Ω' && !(m.reading < 2e7) ? 'OL (开路)' : U.fmt(m.reading, unit);
        h += '<div class="big">' + txt + '</div>';
      }
      if (c.type === 'npn' || c.type === 'pnp') {
        h += '<div>集电极电流 Ic<b>' + U.fmt(z(m.I, 1e-9), 'A') + '</b></div><div>基极电流 Ib<b>' + U.fmt(z(m.Ib, 1e-10), 'A') + '</b></div>' +
          '<div>Vce<b>' + U.fmt(z(m.V, 1e-6), 'V') + '</b></div><div>Vbe<b>' + U.fmt(z(m.Vbe, 1e-6), 'V') + '</b></div>' +
          '<div>Ic/Ib<b>' + (Math.abs(m.Ib) > 1e-10 ? (m.I / m.Ib).toFixed(1) : '—') + '</b></div><div>状态<b>' + this.bjtRegion(c) + '</b></div>';
      } else if (c.type === 'nmos') {
        h += '<div>漏极电流 Id<b>' + U.fmt(z(m.I, 1e-9), 'A') + '</b></div><div>Vgs<b>' + U.fmt(z(m.Vgs, 1e-6), 'V') + '</b></div><div>Vds<b>' + U.fmt(z(m.V, 1e-6), 'V') + '</b></div>';
      } else if (c.type === 'ic555') {
        h += '<div>输出 OUT<b>' + (c.state.q ? '高 HIGH' : '低 LOW') + '</b></div><div>输出电压<b>' + U.fmt(m.V, 'V') + '</b></div><div>测得频率<b>' + (c.state.freq ? U.fmt(c.state.freq, 'Hz') : '—') + '</b></div>';
      } else if (DEFS[c.type].readings) {
        for (const [k, v] of DEFS[c.type].readings(c)) h += '<div>' + k + '<b>' + v + '</b></div>';
      } else if (c.type === 'scope') {
        h += '<div>CH1<b>' + U.fmt(z(m.V, 1e-6), 'V') + '</b></div><div>CH2<b>' + U.fmt(z(m.V2, 1e-6), 'V') + '</b></div><div>频率 (CH1)<b>' + (c.state.freq ? U.fmt(c.state.freq, 'Hz') : '—') + '</b></div>';
        if (c.props.mode === 'fft') { const F = scopeFFT(c); if (F) h += '<div>FFT 峰值 CH1<b>' + U.fmt(F.p1.f, 'Hz', 4) + ' / ' + U.fmt(F.p1.a, 'V', 3) + '</b></div><div>FFT 分辨率<b>' + U.fmt(F.f1.df, 'Hz', 3) + '</b></div>'; }
      } else {
        const signed = ['ammeter', 'voltmeter', 'multimeter', 'battery', 'ac'].includes(c.type);
        const absI = signed ? m.I : Math.abs(m.I), absV = signed ? m.V : Math.abs(m.V);
        h += '<div>电压 U<b>' + U.fmt(z(absV, 1e-6), 'V') + '</b></div><div>电流 I<b>' + U.fmt(z(absI, 1e-8), 'A') + '</b></div><div>功率 P<b>' + U.fmt(z(m.P, 1e-9), 'W') + '</b></div>';
      }
      if (m.bright !== undefined) h += '<div>亮度<b>' + Math.round(U.clamp(m.bright, 0, 9.99) * 100) + '%</b></div>';
      if (c.type === 'capacitor') h += '<div>电容电压<b>' + U.fmt(z(c.state.v || 0, 1e-6), 'V') + '</b></div>';
      if (c.state.blown) h += '<div class="warn">保险丝已熔断</div>';
      if (c.state.fuseBlown) h += '<div class="warn">表内保险丝已熔断 (A 档不可用)</div>';
      if (c.state.burnt) h += '<div class="warn">已烧毁</div>';
    }
    r.innerHTML = h;
  },
  bjtRegion(c) {
    const vbe = (c._m.Vbe || 0) * (c.type === 'pnp' ? -1 : 1), vce = (c._m.V || 0) * (c.type === 'pnp' ? -1 : 1);
    if (vbe < 0.5) return '截止 cut-off';
    if (vce < 0.3) return '饱和 saturation';
    return '放大 active';
  },
  helpHtml() {
    return '<div class="ph"><div class="pt">属性 <small>Properties</small></div></div>' +
      '<div class="muted">选中一个元件或导线即可编辑参数。</div>' +
      '<div class="help"><div class="rt">操作说明</div><ul>' +
      '<li>从左侧拖动元件到工作台（或单击添加）</li>' +
      '<li>从端子（金色圆点）拖出即可<b>连线</b>；把导线端点放到另一根导线中间会自动<b>分叉连接</b></li>' +
      '<li>拖动导线线段可平移；选中后拖动方形顶点；<b>双击</b>导线加顶点，双击顶点删除</li>' +
      '<li><kbd>Shift</kbd>+拖动导线中部（或导线模式下）可从导线中间引出分支</li>' +
      '<li>单击开关切换；按住按钮接通；单击万用表旋钮换档</li>' +
      '<li>在电位器/可变电阻上滚动滚轮调节</li>' +
      '<li>拖动空白处平移，滚轮缩放；触屏支持双指缩放/平移</li>' +
      '<li><kbd>R</kbd> 旋转 · <kbd>Del</kbd> 删除 · <kbd>空格</kbd> 运行/暂停</li>' +
      '<li><kbd>Ctrl+Z</kbd> 撤销 · <kbd>Ctrl+D</kbd> 复制 · <kbd>W</kbd> 导线模式</li>' +
      '<li>导线恰好经过端子时<b>自动接通</b>；<span style="color:#ff7a00">橙色虚线圈</span> = 经过但未连接，按 <kbd>J</kbd> 连接</li>' +
      '</ul></div>' +
      '<div class="help"><div class="rt">仿真设置</div>' +
      '<div class="field"><label>时间步长 Δt</label><div class="numrow"><input type="text" id="set-dt" value="' + U.fmtShort(this.dt, '').replace(/\s/g, '') + '"><span class="unit">s</span></div></div>' +
      '<div class="field"><label class="chk"><input type="checkbox" id="set-electron"' + (this.electron ? ' checked' : '') + '> 显示电子流方向（默认为常规电流方向）</label></div></div>' +
      this.advSettingsHtml();
  },
  // advanced solver options: defaults work for every circuit; shown collapsed
  advSettingsHtml() {
    const o = SIMOPT, num = (k, label, unit, hint) => '<div class="field"><label>' + label + (hint ? ' <small class="muted">' + hint + '</small>' : '') + '</label><div class="numrow"><input type="text" class="simopt" data-k="' + k + '" value="' + (k === 'maxIter' ? o[k] : U.fmtShort(o[k], '').replace(/\s/g, '')) + '"><span class="unit">' + unit + '</span></div></div>';
    const chk = (k, label) => '<div class="field"><label class="chk"><input type="checkbox" class="simopt" data-k="' + k + '"' + (o[k] ? ' checked' : '') + '> ' + label + '</label></div>';
    const st = this.net && this.net.stats, cv = this.conv;
    const stats = st ? '<div class="muted adv-stats">本次运行：自动恢复 ' + (st.hard - st.fail) + ' 步（缩小步长 ' + st.cut + '，gmin 步进 ' + st.gmin + '，电源步进 ' + st.src + '）· 未收敛 ' + st.fail + ' 步' + (cv && cv.n ? '（最近 t = ' + cv.t.toFixed(4) + ' s）' : '') + '</div>' : '';
    const changed = Object.keys(SIMOPT_DEFAULTS).some(k => SIMOPT[k] !== SIMOPT_DEFAULTS[k]);
    return '<details class="help adv"' + (this._advOpen ? ' open' : '') + '><summary class="rt">高级仿真设置 <small>Advanced' + (changed ? ' · 已修改' : '') + '</small></summary>' +
      '<div class="muted">默认值适用于所有电路，一般无需修改。求解困难时会自动缩小步长并使用 gmin / 电源步进。</div>' +
      num('maxIter', '最大迭代次数', '次', '每个时间步') + num('reltol', '相对容差 RELTOL', '') + num('vntol', '电压容差 VNTOL', 'V') + num('abstol', '电流容差 ABSTOL', 'A') +
      num('gmin', '最小电导 GMIN', 'S', '节点对地') + chk('autoStep', '自动步长（不收敛时自动缩小时间步重试）') + num('minStep', '最小步长', 's') +
      chk('homotopy', 'gmin 步进 / 电源步进（收敛辅助）') + chk('kclCheck', 'KCL 残差收敛判据（浮空节点抗舍入抖动）') +
      '<div class="field"><button id="simopt-reset" class="btn">恢复默认</button></div>' + stats + '</details>';
  },
  bindSettings() {
    const dt = $('#set-dt');
    if (dt) dt.onchange = () => { const v = U.parseSI(dt.value); if (v > 1e-7 && v < 0.1) { this.dt = v; this.dirty = true; this.toast('步长 = ' + U.fmt(v, 's')); } else this.toast('步长需在 0.1µs ~ 100ms 之间'); };
    const el = $('#set-electron'); if (el) el.onchange = () => { this.electron = el.checked; };
    const adv = document.querySelector('details.adv'); if (adv) adv.ontoggle = () => { this._advOpen = adv.open; };
    const LIM = { maxIter: [5, 2000], reltol: [1e-9, 0.1], vntol: [1e-12, 1e-2], abstol: [1e-15, 1e-2], gmin: [1e-18, 1e-6], minStep: [1e-15, 1e-3] };
    document.querySelectorAll('input.simopt').forEach((inp) => {
      const k = inp.dataset.k;
      inp.onchange = () => {
        if (inp.type === 'checkbox') SIMOPT[k] = inp.checked;
        else {
          let v = U.parseSI(inp.value); const [lo, hi] = LIM[k];
          if (!(v >= lo && v <= hi)) { this.toast('取值范围 ' + U.fmtShort(lo, '') + ' ~ ' + U.fmtShort(hi, '')); inp.value = k === 'maxIter' ? SIMOPT[k] : U.fmtShort(SIMOPT[k], '').replace(/\s/g, ''); return; }
          SIMOPT[k] = k === 'maxIter' ? Math.round(v) : v;
        }
        saveSimOpt(); this.dirty = true; this.toast('已更新仿真设置：' + k + ' = ' + SIMOPT[k]);
      };
    });
    const rb = $('#simopt-reset'); if (rb) rb.onclick = () => { Object.assign(SIMOPT, SIMOPT_DEFAULTS); saveSimOpt(); this.dirty = true; this.toast('已恢复默认仿真设置'); if (!this.sel) this.refreshProps(); };
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
    let h = '<div class="an-h"><b>∑ 电路分析 Circuit Analysis</b><button id="an-close">✕</button></div>';
    h += '<div class="an-note">基尔霍夫电流定律 (KCL)：流入每个节点的电流代数和应为 0。元件表中无源元件的 U、I 以实际电流方向为正。' + (this.hasRun ? '' : ' <b>请先运行仿真</b>') + '</div>';
    h += '<table><tr><th>节点</th><th>电压</th><th>KCL Σi</th><th>连接的端子</th></tr>';
    for (const n of A.nodes) {
      const ok = Math.abs(n.kcl) < 1e-6 || n.n === 0;
      h += '<tr><td>' + (n.n === 0 ? 'GND (0)' : 'N' + n.n) + '</td><td>' + U.fmt(z(n.V, 1e-9), 'V') + '</td><td class="' + (ok ? 'ok' : 'bad') + '">' + (n.n === 0 ? '参考点' : (ok ? '✓ ' : '') + U.fmt(z(n.kcl, 1e-9), 'A', 2)) + '</td><td class="mem">' + n.members.join(', ') + '</td></tr>';
    }
    h += '</table><table><tr><th>元件</th><th>类型</th><th>电压 U</th><th>电流 I</th><th>功率 P</th></tr>';
    for (const r of A.comps) { const sg = ['ammeter', 'voltmeter', 'multimeter', 'battery', 'ac'].includes(r.c.type) ? 1 : Math.sign(r.I) || 1; h += '<tr><td>' + r.name + '</td><td>' + r.def.name + '</td><td>' + U.fmt(z(r.V * sg, 1e-6), 'V') + '</td><td>' + U.fmt(z(r.I * sg, 1e-10), 'A') + '</td><td>' + U.fmt(z(r.P, 1e-8), 'W') + '</td></tr>'; }
    h += '</table>';
    el.innerHTML = h;
    $('#an-close').onclick = () => this.toggleAnalysis();
  },

  // ---------- palette ----------
  buildPalette() {
    const pal = $('#palette-body');
    let h = '';
    for (const [cat, title] of CATEGORIES) {
      h += '<div class="cat"><div class="cat-t">' + title + '</div><div class="items">';
      for (const [type, d] of Object.entries(DEFS)) if (d.cat === cat) h += '<div class="item" data-type="' + type + '" title="' + d.name + ' ' + d.en + '"><canvas width="64" height="44"></canvas><span>' + d.name + '</span><small>' + d.en + '</small></div>';
      if (cat === 'other') h += '<div class="item" data-type="__wire" title="导线 Wire (W)"><canvas width="64" height="44" id="wire-thumb"></canvas><span>导线</span><small>Wire</small></div>';
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
  },
  setWireMode(on) {
    this.wireMode = on;
    const it = document.querySelector('.item[data-type="__wire"]'); if (it) it.classList.toggle('active', on);
    $('#btn-wire').classList.toggle('active', on);
    this.cv.style.cursor = on ? 'crosshair' : 'default';
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
      if (e.button === 1 || e.button === 2) { this.drag = { kind: 'pan', sx, sy, ox: this.view.ox, oy: this.view.oy }; return; }
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
      if (pt) { this.startWire(pt.x, pt.y, pt); return; }
      const hit = this.compAt(wx, wy, false);
      if (hit) { this.startMove(hit, wx, wy); return; }
      const wh = this.wireHit(wx, wy);
      if (wh) {
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
      if (bh && !this.wireMode) { this.startMove(bh, wx, wy); return; }
      if (this.wireMode) { this.startWire(snap(wx), snap(wy), null); return; }
      if (this.sel) { this.sel = null; this.refreshProps(); }
      this.drag = { kind: 'pan', sx, sy, ox: this.view.ox, oy: this.view.oy };
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
        cv.style.cursor = pt ? 'crosshair' : hit ? (DEFS[hit.c.type].click || hit.c.type === 'button' ? 'pointer' : 'move') : wh ? 'grab' : (this.wireMode ? 'crosshair' : 'default');
        return;
      }
      this.hover = null;
      if (d.kind === 'pan') { this.view.ox = d.ox + sx - d.sx; this.view.oy = d.oy + sy - d.sy; cv.style.cursor = 'grabbing'; }
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
      if (this.compAt(wx, wy, false)) return;
      const tol = Math.max(8, 10 / this.view.s);
      for (const w of this.wires) for (let i = 1; i < w.pts.length - 1; i++) {
        if (Math.hypot(w.pts[i][0] - wx, w.pts[i][1] - wy) < tol) { w.pts.splice(i, 1); this.sel = { wire: w }; this.changed(); this.refreshProps(); this.toast('已删除顶点'); return; }
      }
      const wh = this.wireHit(wx, wy);
      if (wh) { const q = this.snapOnWire(wh); wh.w.pts.splice(wh.seg + 1, 0, q); this.sel = { wire: wh.w }; this.changed(); this.refreshProps(); this.toast('已添加顶点，可拖动方形顶点调整折线'); }
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
  cancelDrag() {
    const d = this.drag; if (!d) return;
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
  saveLocal() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())); this.toast('💾 已保存到浏览器本地存储'); } catch (e) { this.toast('保存失败：' + e.message); } },
  loadLocal() { const s = localStorage.getItem(SAVE_KEY); if (!s) { this.toast('没有找到已保存的电路'); return; } this.load(s); this.fitView(); this.toast('📂 已载入保存的电路'); },
  download() {
    const blob = new Blob([JSON.stringify(this.serialize(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    const d = new Date(), pad = (n) => String(n).padStart(2, '0');
    a.download = 'circuit-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this.toast('⬇ 已导出 JSON 文件');
  },
  upload(file) {
    const r = new FileReader();
    r.onload = () => { try { this.load(r.result); this.fitView(); this.toast('已导入：' + file.name); } catch (e) { this.toast('导入失败：' + e.message); } };
    r.readAsText(file);
  },

  // ---------- toolbar & keys ----------
  bindToolbar() {
    const on = (id, f) => { $(id).onclick = f; };
    on('#btn-run', () => this.toggleRun());
    on('#btn-reset', () => { this.resetSim(); this.toast('仿真已重置'); this.refreshProps(); });
    on('#btn-undo', () => this.undo());
    on('#btn-redo', () => this.redo());
    on('#btn-rot', () => this.rotateSel());
    on('#btn-del', () => this.deleteSel());
    on('#btn-clear', () => { if (confirm('确定清空整个电路吗？')) this.clearAll(); });
    on('#btn-wire', () => this.setWireMode(!this.wireMode));
    on('#btn-analysis', () => this.toggleAnalysis());
    on('#btn-save', () => this.saveLocal());
    on('#btn-load', () => this.loadLocal());
    on('#btn-export', () => this.download());
    on('#btn-import', () => $('#file-in').click());
    on('#btn-fit', () => this.fitView());
    on('#btn-zin', () => this.zoomAt(this.W / 2, this.H / 2, 1.2));
    on('#btn-zout', () => this.zoomAt(this.W / 2, this.H / 2, 1 / 1.2));
    $('#file-in').onchange = (e) => { if (e.target.files[0]) this.upload(e.target.files[0]); e.target.value = ''; };
    const exSel = $('#sel-example');
    exSel.innerHTML = '<option value="">📘 示例电路…</option>' + EXAMPLES.map(e => '<option value="' + e.id + '">' + e.name + '</option>').join('');
    exSel.onchange = () => { if (exSel.value) { this.loadExample(exSel.value); this.run(); } exSel.value = ''; };
    $('#sel-speed').onchange = (e) => { this.speed = parseFloat(e.target.value); };
    $('#chk-current').onchange = (e) => { this.showCurrent = e.target.checked; };
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, select, textarea')) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); this.redo(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); this.duplicateSel(); }
      else if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); this.saveLocal(); }
      else if (k === 'r' && !e.ctrlKey) this.rotateSel();
      else if (k === 'j' && !e.ctrlKey) this.joinPassOvers();
      else if (k === 'delete' || k === 'backspace') { e.preventDefault(); this.deleteSel(); }
      else if (k === ' ') { e.preventDefault(); this.toggleRun(); }
      else if (k === 'w') this.setWireMode(!this.wireMode);
      else if (k === 'escape') { this.sel = null; this.setWireMode(false); this.refreshProps(); }
    });
  },

  init() {
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
