'use strict';
// ===== v11: LCD1602 with an I2C backpack (PCF8574 / PCF8574A port expander) =====
// Library level: a program using LiquidCrystal_I2C writes text straight into the display RAM of the part whose SDA / SCL
// are on the board's I2C pins (Uno A4 / A5, ATtiny85 PB0 / PB2) and whose address matches. The bytes on the bus are
// not simulated (no waveform on SDA / SCL); the backpack's 4.7 kΩ pull-ups and supply current are.
DEFS.lcdi2c = {
  name: 'LCD1602 液晶屏 (I2C 背板)', en: 'LCD1602 I2C (PCF8574 backpack)',
  desc: 'LCD1602 + PCF8574 I2C 转接板：只需 GND、VCC、SDA、SCL 四根线 (Uno：SDA = A4，SCL = A5)。用 LiquidCrystal_I2C 库驱动；地址由 A0–A2 跳线决定 (PCF8574T 为 0x20–0x27，PCF8574AT 为 0x38–0x3F)。背板上的电位器调节对比度。',
  cat: 'drive', desig: 'LCD', keepState: ['dd', 'ddOff', 'ddOn', 'bl'],
  terms: [[-220, -30], [-220, -10], [-220, 10], [-220, 30]], termNames: ['GND', 'VCC', 'SDA', 'SCL'],
  box: [-220, -60, 180, 50],
  props: [
    { k: 'addr', label: 'I2C 地址 (A0–A2 跳线)', kind: 'select', num: true, def: 0x27, opts: [[0x27, '0x27 (PCF8574T)'], [0x3F, '0x3F (PCF8574AT)'], [0x20, '0x20 (PCF8574, A0–A2 = 0)'], [0x38, '0x38 (PCF8574A, A0–A2 = 0)']] },
    { k: 'ct', label: '对比度电位器 (背板上的蓝色电位器)', kind: 'range', def: 0.65, fmt: (v) => Math.round(v * 100) + '%' },
    { k: 'jbl', label: '背光跳线帽 (LED 跳线)', kind: 'bool', def: true },
    { k: 'color', label: '背光颜色', kind: 'select', opts: [['green', '黄绿'], ['blue', '蓝底白字']], def: 'blue' },
  ],
  label: (c) => '0x' + (+c.props.addr).toString(16).toUpperCase(),
  contrast: (c) => U.clamp((+c.props.ct - 0.25) / 0.3, 0, 1),
  build(c, n, m) {
    const st = c.state;
    m.addR(n[1], n[0], 1 / 3300);                       // LCD logic + PCF8574 ≈ 1.5 mA
    m.addR(n[1], n[2], 1 / 4700); m.addR(n[1], n[3], 1 / 4700);   // SDA / SCL pull-ups on the backpack
    // backlight through the jumper and the transistor driven by P3 of the expander (on after power-up until noBacklight())
    m.addNL('gfun', [n[1], n[0]], { gf: () => (c.props.jbl && st.init && st.bl !== false ? 1 / 230 : 1e-9) }, st);
    c._p = null;
  },
  measure(c, m) { const n = c._nodes; c._m.Vdd = m.v(n[1]) - m.v(n[0]); c._m.Vsda = m.v(n[2]) - m.v(n[0]); c._m.Vscl = m.v(n[3]) - m.v(n[0]); c._m.V = c._m.Vdd; c._m.I = c._m.Vdd / 3300 + (c.props.jbl && c.state.init && c.state.bl !== false ? c._m.Vdd / 230 : 0); },
  post(c, dt, app) {
    const st = c.state, M = c._m;
    if ((M.Vdd || 0) > 7 && !st.burnt) { st.burnt = true; app.dirty = true; app.toast(_t('lcd1602.lcd1602_damaged_by_excessive_supply')); }
    const was = st.init; st.init = (M.Vdd || 0) >= 4.5 ? true : (M.Vdd || 0) < 2.7 ? false : !!st.init;
    if (!st.init && st.dd) st.dd = null;
    if (was !== st.init) app.net.needStamp = true;
    const n = c._nodes; st.mcuLinked = !!(n && (app.mcuComps || []).some((mc) => mc._nodes && (mc._nodes.includes(n[2]) || mc._nodes.includes(n[3]))));
  },
  text(c, i) {
    const st = c.state;
    if (!st.dd) return i === 1 && st.mcuLinked ? '\u2588'.repeat(16) : ' '.repeat(16);
    if (!st.ddOn) return ' '.repeat(16);
    const row = st.dd[i - 1]; let s = ''; for (let k = 0; k < 16; k++) s += row[(st.ddOff + k) % 40]; return s;
  },
  readings(c) {
    const M = c._m, st = c.state, ct = DEFS.lcdi2c.contrast(c);
    const r = [['VCC', U.fmt(M.Vdd || 0, 'V') + (st.init ? '' : _t('lcd1602.unpowered_undervoltage'))], [_t('lcdi2c.addr'), '0x' + (+c.props.addr).toString(16).toUpperCase()],
      ['SDA / SCL', U.fmt(M.Vsda || 0, 'V') + ' / ' + U.fmt(M.Vscl || 0, 'V')], [_t('lcdi2c.backlight'), c.props.jbl ? (st.bl === false ? _t('lcdi2c.bl_off_prog') : _t('lcdi2c.bl_on')) : _t('lcdi2c.bl_jumper_off')],
      [_t('common.display'), st.init ? '"' + DEFS.lcdi2c.text(c, 1).trim() + '" / "' + DEFS.lcdi2c.text(c, 2).trim() + '"' : '—']];
    if (st.init && ct <= 0) r.push([_t('common.note'), _t('lcdi2c.contrast_wrong')]);
    r.push([_t('common.note'), st.dd ? _t('lcdi2c.driven') : st.mcuLinked ? _t('lcdi2c.not_init') : _t('lcdi2c.idle')]);
    return r;
  },
  draw(ctx, c) {
    const st = c.state, blue = c.props.color === 'blue', bl = !st.burnt && st.init && c.props.jbl && st.bl !== false ? 1 : 0;
    // backpack on the left edge with its 4-pin header
    for (const [x, y] of DEFS.lcdi2c.terms) D.lead(ctx, x, y, x + 14, y);
    drawPCB(ctx, -206, -44, 34, 88, '#1b1b1b');
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(-200, -16, 22, 30);
    sChip(ctx, c, -189, -26, 16, 10, '8574');
    ctx.fillStyle = '#2f6fd8'; ctx.fillRect(-196, 18, 14, 14); ctx.fillStyle = '#e5c86a'; ctx.beginPath(); ctx.arc(-189, 25, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(-206, -54, 12, 8);
    D.upright(ctx, c, -192, 0, (ctx) => { txt(ctx, 'GND VCC SDA SCL', 0, 0, 'bold 4px sans-serif', '#ddd'); });
    drawPCB(ctx, -170, -50, 348, 100, '#1d7a3a');
    ctx.fillStyle = '#1a1a1a'; D.rrect(ctx, -160, -32, 320, 76, 3); ctx.fill();
    const bg = blue ? [20 + 30 * bl, 60 + 90 * bl, 140 + 115 * bl] : [70 + 110 * bl, 90 + 130 * bl, 20 + 20 * bl];
    ctx.fillStyle = 'rgb(' + bg.map(Math.round).join(',') + ')'; ctx.fillRect(-150, -24, 300, 60);
    if (bl > 0.05) glow(ctx, 0, 6, 120, blue ? '#6fa8ff' : '#c8f060', 0.25 * bl);
    lcdGlass(ctx, c, !st.burnt && st.init, DEFS.lcdi2c.contrast(c), 0, blue, (r) => DEFS.lcdi2c.text(c, r));
  },
};
