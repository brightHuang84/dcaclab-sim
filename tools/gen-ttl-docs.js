'use strict';
// v13: generates docs/74-series-zh.md and docs/74-series-en.md from the part data (js/ttl-parts.js, js/ttl.js, js/i18n-v13/*.js).
// usage: node tools/gen-ttl-docs.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const PARTS = require(path.join(root, 'js/ttl-parts.js'));
const { TTL_FAMS, TTL_TPD, ttlTitle, TTL_SUBS, TTL_LS_DEFAULT } = require(path.join(root, 'js/ttl.js'));
const loadDict = (lang) => { let d = {}; global.I18N = { add: (l, o) => { d = o; } }; new Function(fs.readFileSync(path.join(root, 'js/i18n-v13/' + lang + '.js'), 'utf8'))(); return d; };
const DICT = { zh: loadDict('zh-CN'), en: loadDict('en') };
const EXAMPLES = [
  ['ttlsr', ['7400']], ['ttlrip', ['7493']], ['ttlbcd', ['7490', '7447']], ['ttl161', ['74161']], ['ttl138', ['74138']], ['ttl595', ['74595']], ['ttl165', ['74165']],
  ['ttl373', ['74373']], ['ttl245', ['74245']], ['ttl7483', ['7483']], ['ttl7485', ['7485']], ['ttl194', ['74194', '7404']], ['ttl14', ['7414']], ['ttl7474', ['7474']],
];
const T = {
  zh: {
    title: '74 系列 / CD4000 逻辑 IC 参考', intro: '本文件由零件数据自动生成 (`node tools/gen-ttl-docs.js`)：引脚表、功能表、使用提示和示例。所有 DIP 封装的引脚号取自厂商数据手册 (TI SN74xx / Nexperia 74HC / onsemi / Philips)，从顶视图看 1 脚在左上角，沿左侧向下、再沿右侧向上。引脚名前的 `/` 表示低电平有效。',
    fam: '逻辑系列模型', famIntro: '每个 74 系列零件有“逻辑系列”属性。系列决定供电范围、输入阈值、输出电平和驱动能力以及典型传播延迟。下表数值为数据手册典型值的取整近似。',
    famCols: ['系列', '推荐供电', '最低可工作', '绝对最大', '输入低 / 高阈值 (5 V)', '输出高电平', '输出电阻 高 / 低', '输入'],
    famNote: ['- 供电低于“最低可工作”电压时，输出为高阻、零件不工作，属性面板给出“欠压”提示；没有供电时提示“无供电”。', '- 供电超出推荐范围但仍能工作时提示“超出推荐范围”；超过绝对最大值时提示“零件将被损坏”。', '- 74HC 输入悬空：未定义，仿真中按低电平处理并给出警告；74LS / 74 (TTL) 悬空输入按高电平读取 (内部上拉)，同样给出提示——请始终把不用的输入接到 VCC 或 GND。', '- 施密特触发输入 (7414、74132) 有回差：HC 约 0.31·VCC / 0.53·VCC，LS 约 0.8 V / 1.6 V；普通门没有回差，在 VIL 与 VIH 的中点翻转。', '- 两个输出互相对抗 (总线冲突) 时，节点电压落在中间电平，零件会提示“输出冲突”。'],
    delay: '传播延迟', delayText: '默认理想零延迟：门链在同一仿真步内稳定 (在求解步内迭代，类似 Verilog 的 delta 周期)。勾选“模拟传播延迟”后每一级输出延后一个求解步 (步长 0.2 ms，远大于 ns 级延迟，因此取整到求解步)；可以设置 tpd，0 表示取数据手册典型值。零延迟下无稳定状态的组合环 (例如三反相器环) 会提示“组合环”，开启延迟后可作为环形振荡器运行 (频率受求解步限制，不代表真实 ns 级频率)。', delayTab: ['类型', 'HC', 'HCT', 'LS', '74', 'CD4000B'],
    parts: '零件', pinCols: ['引脚', '名称', '方向 / 说明'], fnTitle: '功能', tips: '使用提示', ex: '相关示例', exAll: '示例列表',
    dir: { power: '电源', ground: '地', nc: '空脚 (NC)', in: '输入', out: '输出', z: '输出 (三态)', oc: '输出 (集电极开路，需上拉)', ocp: '输出 (集电极开路，内含 2 kΩ 上拉)', io: '双向 (三态)', ioOc: '双向 (集电极开路)' },
    sub: { gate: '逻辑门', ff: '触发器与锁存器', cnt: '计数器', sr: '移位寄存器', dec: '译码器 / 显示驱动', mux: '数据选择器', arith: '运算 / 比较', bus: '总线驱动' },
    famLine: '可选系列', famFixed: '固定系列', def: '默认', pkg: '封装', tipsGen: ['未使用的输入接 VCC 或 GND；未使用的门输出可以悬空。', '每个 IC 都必须接 VCC 和 GND；电源脚在示例里通过 5 V 电池 / Arduino 5V 引脚供电。', '74HC 的输出可以直接驱动 LED + 330 Ω 电阻；74LS 的高电平只有约 3.4 V，吸电流 (LED 接 VCC) 更合适。', '总线上同一时刻只能有一个三态输出处于使能状态。'],
    tipOc: '集电极开路 / 开漏输出：只能拉低，必须外接上拉电阻 (或接 LED 到 VCC)，多个输出可并联成线与。', tipOcp: '输出级为集电极开路，内部串接 2 kΩ 上拉：可直接接 LED 阴极到输出再串电阻到 VCC，也可驱动逻辑输入。', tipZ: '三态输出：禁用时为高阻；同一总线上不要同时使能两个输出。', tipSch: '施密特触发输入：适合整形缓慢或带噪声的信号，可配 RC 做振荡器 (见示例)。', tipCD: 'CD4000B 系列：供电 3–15 V，输出电阻较大 (约 400 Ω)，传播延迟较长。', tipNC: '标记为 NC 的引脚内部不连接。', tipClk: '时钟沿触发：在时钟上升沿 (或数据手册指定的边沿) 采样输入；异步清零/置位优先于时钟。', tipCnt: '计数器输出变化顺序与数据手册一致；级联时注意 RCO / CO 与使能端。',
    verif: '数据手册核对说明', verifText: ['- 引脚排列取自厂商数据手册 (TI SN7400/SN74LS/SN74HC 系列、Nexperia/Philips、onsemi CD4017B/CD4040B)。', '- 7447 的数字 6 与 9 采用原版 7447A 的无顶横 / 无底横字形 (a 段不亮的 6、d 段不亮的 9)，所以与某些现代 7447 兼容芯片的字形不同。', '- 74LS48 与 7448 使用同一个零件 (搜索 “LS48” 可找到)。7448 的 /RBI、/BI、/LT 逻辑按数据手册功能表实现，但未模拟内部上拉的细节。', '- 传播延迟、输出电阻、输入电阻都是由数据手册典型值取整得到的近似，仅用于演示。', '- 没有加入：74266 / 7403 (OC 与非 / 异或非)、74147 / 74148 (优先编码器)、74181 (ALU)。四位动态扫描数码管 (12 脚，如 5641AS / 3641AS 引脚) 已作为“发光器件”分类下的新元件加入。'],
  },
  en: {
    title: '74-series / CD4000 logic ICs — reference', intro: 'Generated from the part data (`node tools/gen-ttl-docs.js`): pin tables, function tables, usage tips and examples. DIP pin numbers come from the manufacturers\' data sheets (TI SN74xx, Nexperia / Philips 74HC, onsemi CD4000B); seen from the top, pin 1 is at the top left and the numbering runs down the left side and up the right side. A leading `/` in a pin name means active low.',
    fam: 'Logic-family model', famIntro: 'Every 74-series part has a "family" property. The family sets the supply range, the input thresholds, the output levels and drive, and the typical propagation delay. The values are rounded data-sheet typicals.',
    famCols: ['Family', 'Recommended supply', 'Works from', 'Absolute max', 'Input low / high threshold (5 V)', 'Output high', 'Output resistance high / low', 'Inputs'],
    famNote: ['- Below the "works from" voltage the outputs are high-Z and the part does nothing; the properties panel shows "under-voltage". With no supply it says "no supply".', '- Outside the recommended range (but still functional) the panel says "outside the recommended range"; above the absolute maximum it says the part would be destroyed.', '- Floating 74HC inputs are undefined: the simulator reads them as low and shows a warning. Floating 74LS / 74 (TTL) inputs read as high (internal pull-up), also with a warning — always tie unused inputs to VCC or GND.', '- Schmitt-trigger inputs (7414, 74132) have hysteresis: about 0.31·VCC / 0.53·VCC for HC and 0.8 V / 1.6 V for LS. Plain gates have none and switch in the middle of the VIL..VIH band.', '- When two outputs fight on one net (bus contention) the node sits at a mid level and the part reports "output contention".'],
    delay: 'Propagation delay', delayText: 'By default the model is ideal, zero delay: gate chains settle inside one simulation step (iterated within the solve step, like delta cycles in Verilog). With "model propagation delay" every stage delays its output by one solve step (0.2 ms, far longer than nanosecond delays, so the delay is rounded to the step); tpd can be set, 0 means the data-sheet typical. A combinational loop without a stable state (e.g. a ring of three inverters) is flagged as a "combinational loop" in zero-delay mode; with delay enabled it runs as a ring oscillator (the frequency is set by the solve step, not by real ns delays).', delayTab: ['Type', 'HC', 'HCT', 'LS', '74', 'CD4000B'],
    parts: 'Parts', pinCols: ['Pin', 'Name', 'Direction / note'], fnTitle: 'Function', tips: 'Usage tips', ex: 'Related examples', exAll: 'Examples',
    dir: { power: 'power', ground: 'ground', nc: 'not connected (NC)', in: 'input', out: 'output', z: 'output (3-state)', oc: 'output (open collector, needs a pull-up)', ocp: 'output (open collector with internal 2 kΩ pull-up)', io: 'bidirectional (3-state)', ioOc: 'bidirectional (open collector)' },
    sub: { gate: 'Logic gates', ff: 'Flip-flops and latches', cnt: 'Counters', sr: 'Shift registers', dec: 'Decoders / display drivers', mux: 'Multiplexers', arith: 'Arithmetic / comparison', bus: 'Bus drivers' },
    famLine: 'Selectable families', famFixed: 'Fixed family', def: 'default', pkg: 'Package', tipsGen: ['Tie unused inputs to VCC or GND; unused gate outputs may float.', 'Every IC needs VCC and GND; the examples feed them from a 5 V battery / the Arduino 5V pin.', 'A 74HC output can drive an LED + 330 Ω directly; a 74LS high level is only about 3.4 V, so sinking current (LED to VCC) suits it better.', 'Only one 3-state output may be enabled on a bus at a time.'],
    tipOc: 'Open-collector / open-drain output: it only pulls low, so it needs an external pull-up (or an LED to VCC); several outputs can be wired together (wired AND).', tipOcp: 'The output stage is open collector with a 2 kΩ pull-up in series inside: connect an LED cathode to the output with a resistor to VCC, or drive a logic input.', tipZ: '3-state outputs: high-Z when disabled; never enable two outputs on one bus at the same time.', tipSch: 'Schmitt-trigger inputs clean up slow or noisy signals; with an RC network they make an oscillator (see the example).', tipCD: 'CD4000B series: supply 3–15 V, high output resistance (about 400 Ω), long propagation delay.', tipNC: 'Pins marked NC are not connected internally.', tipClk: 'Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.', tipCnt: 'Outputs change in the data-sheet order; when cascading mind RCO / CO and the enable inputs.',
    verif: 'Data-sheet verification notes', verifText: ['- Pin-outs come from the manufacturers\' data sheets (TI SN7400 / SN74LS / SN74HC series, Nexperia / Philips, onsemi CD4017B / CD4040B).', '- The 7447 draws digits 6 and 9 as in the original 7447A (6 without the top bar, 9 without the bottom bar), which differs from some modern 7447-compatible chips.', '- 74LS48 and 7448 are one part (search "LS48"). The /RBI, /BI and /LT logic follows the data-sheet function table; the internal pull-up details are not modelled.', '- Propagation delays, output resistances and input resistances are rounded from data-sheet typicals and are for demonstration only.', '- Not included: 74266 / 7403 (OC NAND / XNOR), 74147 / 74148 (priority encoders), 74181 (ALU). A 4-digit multiplexed 7-segment display (12-pin, 5641AS / 3641AS pin-out) was added to the lighting category.'],
  },
};
const dirOf = (part, i) => {
  const t = T.cur, name = part.pins[i];
  if (i === part.iv) return t.dir.power; if (i === part.ig) return t.dir.ground; if (name === 'NC') return t.dir.nc;
  const k = part.outs[name], io = part.io && part.io.includes(name);
  if (io) return k === 'z' ? t.dir.io : t.dir.ioOc; if (k) return t.dir[k] || t.dir.out; return t.dir.in;
};
const famName = (f) => (f === 'TTL' ? '74' : f === 'CD' ? 'CD4000B' : '74' + f);
function gen(lang) {
  const t = T[lang]; T.cur = t; const D = DICT[lang === 'zh' ? 'zh' : 'en'];
  const o = [];
  o.push('# ' + t.title, '', t.intro, '');
  o.push('## ' + t.fam, '', t.famIntro, '');
  o.push('| ' + t.famCols.join(' | ') + ' |', '|' + t.famCols.map(() => '---').join('|') + '|');
  for (const f of ['HC', 'HCT', 'LS', 'TTL', 'CD']) {
    const F = TTL_FAMS[f], [lo, hi] = F.thr(5, false), v = (x) => (+x.toFixed(2)) + ' V';
    o.push('| ' + famName(f) + ' | ' + F.rec[0] + '–' + F.rec[1] + ' V | ' + F.func + ' V | ' + F.abs + ' V | ' + v(lo) + ' / ' + v(hi) + ' | ' + (F.voh ? 'VCC − ' + F.voh + ' V' : 'VCC') + ' | ' + F.rH + ' Ω / ' + F.rL + ' Ω | ' + (F.inVcc ? (lang === 'zh' ? '上拉 (悬空=高)' : 'pull-up (floating = high)') : (lang === 'zh' ? 'CMOS (悬空=未定义)' : 'CMOS (floating = undefined)')) + ' |');
  }
  o.push('', ...t.famNote, '');
  o.push('### ' + t.delay, '', t.delayText, '');
  o.push('| ' + t.delayTab.join(' | ') + ' |', '|' + t.delayTab.map(() => '---').join('|') + '|');
  const clsName = { gate: lang === 'zh' ? '门' : 'gate', ff: lang === 'zh' ? '触发器' : 'flip-flop', latch: lang === 'zh' ? '锁存器' : 'latch', cnt: lang === 'zh' ? '计数器' : 'counter', sr: lang === 'zh' ? '移位寄存器' : 'shift register', dec: lang === 'zh' ? '译码器' : 'decoder', mux: lang === 'zh' ? '选择器' : 'multiplexer', arith: lang === 'zh' ? '运算' : 'arithmetic', bus: lang === 'zh' ? '总线驱动' : 'bus driver', seg: lang === 'zh' ? '显示驱动' : 'display driver' };
  for (const [c, row] of Object.entries(TTL_TPD)) o.push('| ' + clsName[c] + ' | ' + ['HC', 'HCT', 'LS', 'TTL', 'CD'].map((f) => row[f] + ' ns').join(' | ') + ' |');
  o.push('', '## ' + t.tips, '', ...t.tipsGen.map((x) => '- ' + x), '');
  // index
  o.push('## ' + t.parts, '');
  for (const g of TTL_SUBS) {
    const list = PARTS.filter((p) => p.grp === g);
    o.push('- **' + t.sub[g] + '**: ' + list.map((p) => '[' + (p.fam === 'CD' ? 'CD' + p.n : p.n) + '](#' + anchor(p) + ')').join(' · '));
  }
  o.push('');
  for (const g of TTL_SUBS) {
    o.push('## ' + t.sub[g], '');
    for (const p of PARTS.filter((q) => q.grp === g)) {
      const type = 'ic' + p.n, iv = p.pins.length - 1, ig = p.pins.length / 2 - 1;
      const part = Object.assign({}, p, { iv, ig });
      if (!/^(VCC|VDD)$/.test(p.pins[iv]) || !/^(GND|VSS)$/.test(p.pins[ig])) { part.iv = p.pins.findIndex((x) => /^(VCC|VDD)$/.test(x)); part.ig = p.pins.findIndex((x) => /^(GND|VSS)$/.test(x)); }
      const label = p.fam === 'CD' ? 'CD' + p.n : p.n;
      o.push('### ' + label + ' — ' + (D['c.' + type + '.name'] || p.en).replace(/^74xx\d+\s*/, ''), '');
      o.push(D['c.' + type + '.desc'] || p.en, '');
      const fams = p.fam ? t.famFixed + ': ' + famName(p.fam) : t.famLine + ': ' + (p.fams || ['HC', 'HCT', 'LS', 'TTL']).map((f) => famName(f)).join(', ') + ' (' + t.def + ': ' + famName(p.famDef || (TTL_LS_DEFAULT.has(p.n) ? 'LS' : 'HC')) + ')';
      o.push('- ' + t.pkg + ': DIP-' + p.pins.length + ' · ' + fams, '');
      o.push('| ' + t.pinCols.join(' | ') + ' |', '|---|---|---|');
      p.pins.forEach((n, i) => o.push('| ' + (i + 1) + ' | `' + n + '` | ' + dirOf(part, i) + ' |'));
      o.push('', '**' + t.fnTitle + '**', '', '```');
      for (const l of p.fn || []) o.push(l);
      o.push('```', '');
      const tips = [];
      const kinds = new Set(Object.values(p.outs || {}));
      if (kinds.has('oc')) tips.push(t.tipOc); if (kinds.has('ocp')) tips.push(t.tipOcp);
      if (kinds.has('z')) tips.push(t.tipZ); if (p.schmitt) tips.push(t.tipSch); if (p.fam === 'CD') tips.push(t.tipCD);
      if (p.pins.includes('NC')) tips.push(t.tipNC);
      if (['ff', 'sr'].includes(p.grp) || /CLK|CKA|CK/.test(p.pins.join(' '))) if (p.grp !== 'gate' && p.grp !== 'bus' && p.cls !== 'latch') tips.push(t.tipClk);
      if (p.grp === 'cnt') tips.push(t.tipCnt);
      if (tips.length) { o.push('**' + t.tips + '**', '', ...tips.map((x) => '- ' + x), ''); }
      const exs = EXAMPLES.filter(([, ps]) => ps.includes(p.n)).map(([id]) => D['ex.' + id]);
      if (exs.length) o.push('**' + t.ex + '**: ' + exs.join(' · '), '');
    }
  }
  o.push('## ' + t.exAll, '');
  for (const [id, ps] of EXAMPLES) o.push('- ' + D['ex.' + id] + ' (' + ps.join(', ') + ')');
  o.push('', '## ' + t.verif, '', ...t.verifText, '');
  return o.join('\n');
}
function anchor(p) { const label = (p.fam === 'CD' ? 'CD' + p.n : p.n); const D = DICT.en; const nm = (D['c.ic' + p.n + '.name'] || p.en).replace(/^74xx\d+\s*/, ''); return (label + ' — ' + nm).toLowerCase().replace(/[^a-z0-9 \-]/g, '').replace(/ /g, '-'); }
fs.writeFileSync(path.join(root, 'docs/74-series-zh.md'), gen('zh'));
fs.writeFileSync(path.join(root, 'docs/74-series-en.md'), gen('en'));
console.log('written docs/74-series-zh.md and docs/74-series-en.md');
