'use strict';
// v14: generates docs/audio-zh.md and docs/audio-en.md.
// The part data (pins, properties, notes) is read from the running app (headless Chrome via playwright-core), the amplifier gain / clip-onset
// table is MEASURED in the simulator (tools/audio-measure.js), names/descriptions come from js/i18n-v14/*.js.
// usage: node tools/gen-audio-docs.js      (env: CHROME=/path/to/chrome, NODE_PATH=dir containing playwright-core)
const fs = require('fs'), path = require('path'), http = require('http');
const root = path.join(__dirname, '..');
let chromium; try { chromium = require('playwright-core').chromium; } catch (e) { chromium = require('/node_modules/playwright-core').chromium; }
const loadDict = (lang) => { let d = {}; global.I18N = { add: (l, o) => { d = o; } }; new Function(fs.readFileSync(path.join(root, 'js/i18n-v14/' + lang + '.js'), 'utf8'))(); return d; };
const D = { zh: loadDict('zh-CN'), en: loadDict('en') };
const TYPES = ['speaker', 'headphone', 'piezo', 'emic', 'audiotx', 'audiogen', 'jack35', 'lm386', 'tda2030', 'lm3886', 'tda7297', 'pam8403', 'pam8610', 'tpa3116'];
const GROUP = { trans: ['speaker', 'headphone', 'piezo', 'emic', 'audiotx'], src: ['audiogen', 'jack35'], amp: ['lm386', 'tda2030', 'lm3886', 'tda7297', 'pam8403', 'pam8610', 'tpa3116'] };
const EX = {
  audlm386: { zh: '信号发生器 → 10 µF → LM386 (增益 20) → 250 µF → 8 Ω 喇叭；示波器同时看输入与输出，可见 20 倍放大。', en: 'Generator → 10 µF → LM386 (gain 20) → 250 µF → 8 Ω speaker; the scope shows the input and the 20× larger output.' },
  audlm386g: { zh: '1、8 脚间接 10 µF 电容切换到增益 200；输入只有 20 mVpp。', en: 'A 10 µF capacitor between pins 1 and 8 switches to gain 200; the input is only 20 mVpp.' },
  aud555: { zh: '555 无稳态方波经电容驱动喇叭，开关切换音高 (听得到 / 在属性面板看到主频)。', en: 'A 555 astable drives the speaker through a capacitor; the switch changes the pitch (audible, and shown as "main frequency" in the panel).' },
  audtone: { zh: 'Arduino tone() 演奏《小星星》，经 100 Ω、47 µF 隔直电容、A 型 (对数) 音量电位器到喇叭。', en: 'An Arduino plays a melody with tone(); 100 Ω → 47 µF coupling capacitor → audio-taper volume pot → speaker.' },
  audpam: { zh: '3.5 mm 插孔左 440 Hz / 右 660 Hz → PAM8403 模块 → 两个喇叭；开关拉低 MUTE 脚静音。', en: '3.5 mm jack with 440 Hz (left) / 660 Hz (right) → PAM8403 module → two speakers; a switch pulls MUTE low.' },
  audpiezo: { zh: '555 方波驱动压电陶瓷片，作为无源蜂鸣片发声 (压电片是电容性负载)。', en: 'A 555 square wave drives a piezo disc as a passive buzzer (a capacitive load).' },
  audmic: { zh: '驻极体话筒 (声源 74 dB SPL) → LM358 同相放大 → LM386 → 喇叭，完整的“话筒放大器”链。', en: 'Electret mic (74 dB SPL sound source) → LM358 amplifier → LM386 → speaker: a complete microphone amplifier chain.' },
  audclip: { zh: 'LM386 增益 200 被过驱：输出被电源轨削平，示波器 FFT 出现奇次谐波，功放状态显示“削波”。', en: 'LM386 at gain 200 is over-driven: the output is flattened by the rails, the scope FFT shows odd harmonics and the amplifier state reads "clipping".' },
  audxover: { zh: '一阶 LC 两分频：电感 + 低音喇叭，电容 + 高音喇叭；扫频信号下示波器 CH1 看低音支路 (低通)、CH2 看高音支路 (高通)。', en: 'First-order LC crossover: inductor + woofer, capacitor + tweeter; with a swept source scope CH1 shows the woofer branch (low-pass) and CH2 the tweeter branch (high-pass).' },
  audclassab: { zh: '互补推挽 (AB 类) 晶体管功放；开关把偏置二极管短路 → 看到交越失真和失真的谐波。', en: 'Complementary push-pull (class AB) transistor amplifier; a switch shorts the bias diodes → crossover distortion and its harmonics.' },
  audtda: { zh: 'LM358 前置放大 → TDA2030 单电源功放 (12 V)，驱动 4 Ω 喇叭。', en: 'LM358 preamp → TDA2030 single-supply power amplifier (12 V) driving a 4 Ω speaker.' },
};
const T = {
  zh: {
    title: '音频：喇叭与功放参考', intro: '本文件由零件数据与仿真测量自动生成 (`node tools/gen-audio-docs.js`)：零件表、引脚表、增益 / 功率表、示例列表与限制。',
    sound: '声音是怎么来的', soundText: [
      '- 工具栏的 🔇 / 🔊 按钮是全局静音开关，**默认静音**；点一次才开启 (浏览器要求用户操作后才能出声)，滑块是总音量。暂停或复位仿真会立即停声。',
      '- 喇叭 / 耳机 / 压电片 / 蜂鸣器**不是播放录音**：仿真每一步把它们两端的电压送进一个 FFT 分析器 (汉宁窗，抛物线插值，约 1.5 Hz 分辨率)，找出最强的几个频率分量 (最多 6 个) 和噪声，用 WebAudio 的振荡器组实时合成。所以你听到的频率、谐波成分与电路里的一致，音色是近似的。',
      '- **精确的部分**：主频 (在奈奎斯特限以内，误差 < 1%)、谐波 / 失真的存在与相对大小、电路里有没有信号、立体声左右声道。',
      '- **近似的部分**：响度 (电压幅度经压缩曲线映射，额定功率对应满刻度)、音色 (只重建最强的 6 个正弦分量)、没有扬声器频响 / 箱体 / 房间声学，也没有真实的相位。',
      '- 仿真时间步默认 0.2 ms，对应采样率 5 kHz，可准确表示 2 kHz 以内的音频 (更高的单音会折叠，分析器会按谐波关系尽量还原)。音频示例自带更细的时间步 (如 50 µs)，分析器内部先抽取到约 6 kHz，因此可靠上限约 3 kHz；要看更高频率请把“时间步”调小。',
      '- “无法实时”的情形 (例如时间步远大于声音周期) 会在读数里显示主频但不保证音色；`AUD.renderOffline` 可用离线 WebAudio 把任意频谱渲染成采样数据，测试套件就是用它验证“发声”。',
    ],
    parts: '零件', partsCols: ['零件', '类别', '说明'], pins: '引脚', pinCols: ['引脚', '名称'], props: '属性', propCols: ['属性', '默认值'],
    ampTitle: '功放增益与输出功率 (仿真实测)', ampIntro: '下表由 `tools/audio-measure.js` 在仿真器中实测：正弦 1 kHz，推荐电路 (LM386 带 250 µF 输出电容；TDA2030 / LM3886 为同相放大)。“削波起点功率”是刚开始出现削波状态时负载上的平均功率；“最大功率”是继续加大输入后的饱和功率。',
    ampCols: ['配置', '电压增益', '增益 dB', '电源', '负载', '削波起点功率', '最大 (饱和) 功率', '效率 (削波起点)'],
    ex: '示例', exCols: ['示例', '内容'], limits: '限制与说明', limitsText: [
      '- 功放是“平均 / 行为模型”：线性增益 + 电源轨削波 + 压降 + 输出限流 + 热模型；不含开关纹波 (D 类按平均模型，只给效率与电源电流)、不含交越失真 (晶体管示例除外)、不含噪声 / PSRR 细节。',
      '- 功率为 1 kHz 附近的电气功率 (V·I 的平均值)；SPL 读数是按灵敏度 (dB/W/m) 估算的 1 m 声压级，不是声学仿真。',
      '- 喇叭电气模型：直流电阻 + 音圈电感；没有机械谐振 (阻抗峰)。过载烧毁用热积累模型，过功率时间越长越容易烧。',
      '- 驻极体话筒的“声源”是内部信号：正弦 / 方波 / 扫频 / 噪声 / 双音，不接收电脑麦克风。3.5 mm 插孔和信号发生器同理 (没有 WAV 文件输入)。',
      '- 不能表示的现象：箱体 / 分频网络的声学相位、啸叫 (声反馈) 、真实乐音。',
    ],
    kinds: { trans: '换能器', src: '信号源', amp: '功放' }, gen: '(由零件数据自动生成，请勿手改)',
  },
  en: {
    title: 'Audio: speakers and power amplifiers — reference', intro: 'Generated from the part data and from simulator measurements (`node tools/gen-audio-docs.js`): part table, pin tables, gain / power table, example list and limits.',
    sound: 'How the sound is produced', soundText: [
      '- The 🔇 / 🔊 toolbar button is the global mute switch and is **muted by default**; click it once to enable sound (browsers need a user gesture), the slider is the master volume. Pausing or resetting the simulation silences everything at once.',
      '- Speakers / headphones / piezo discs / buzzers **do not play a recording**: on every simulation step the voltage across them is fed to an FFT analyser (Hann window, parabolic peak interpolation, ≈ 1.5 Hz resolution) which finds the strongest spectral components (up to 6) and the noise floor; a WebAudio oscillator bank synthesises them live. The pitch and the harmonic content you hear therefore follow the circuit; the timbre is an approximation.',
      '- **Exact**: the main frequency (below the Nyquist limit, error < 1 %), presence / relative size of harmonics and distortion, whether there is a signal at all, left / right channels.',
      '- **Approximate**: loudness (the voltage amplitude is mapped through a compressive curve, rated power = full scale), timbre (only the strongest 6 sine partials are rebuilt), no loudspeaker frequency response / cabinet / room acoustics, no real phase.',
      '- The default time step 0.2 ms means a 5 kHz sample rate, so tones up to about 2 kHz are exact (higher single tones fold back; the analyser un-folds them using the harmonic relation where it can). The audio examples set a finer step themselves (e.g. 50 µs); the analyser decimates internally to ≈ 6 kHz so the practical limit is about 3 kHz. Reduce the "time step" to see higher frequencies.',
      '- `AUD.renderOffline` renders any spectrum through an offline WebAudio context into samples; the test suite uses it to prove that "sound" is non-silent at the right frequency.',
    ],
    parts: 'Parts', partsCols: ['Part', 'Kind', 'Description'], pins: 'Pins', pinCols: ['Pin', 'Name'], props: 'Properties', propCols: ['Property', 'Default'],
    ampTitle: 'Amplifier gain and output power (measured in the simulator)', ampIntro: 'Measured by `tools/audio-measure.js` inside the simulator: 1 kHz sine, the recommended circuits (LM386 with a 250 µF output capacitor, TDA2030 / LM3886 as non-inverting amplifiers). "Clip-onset power" is the mean load power when the clipping state first appears; "maximum" is the saturated power when the input is increased further.',
    ampCols: ['Configuration', 'Voltage gain', 'Gain dB', 'Supply', 'Load', 'Clip-onset power', 'Max (saturated) power', 'Efficiency (clip-onset)'],
    ex: 'Examples', exCols: ['Example', 'What it shows'], limits: 'Limits and notes', limitsText: [
      '- The amplifiers are averaged / behavioural models: linear gain + rail clipping + drop-out + output current limit + thermal model; no switching ripple (class D uses an averaged model that gives efficiency and supply current), no crossover distortion (except in the transistor example), no detailed noise / PSRR.',
      '- Power is electrical power around 1 kHz (mean of V·I); the SPL readout is an estimate of the 1 m sound pressure from the sensitivity (dB/W/m), not an acoustic simulation.',
      '- Speaker electrical model: DC resistance + voice-coil inductance; there is no mechanical resonance (impedance peak). Burn-out uses a thermal integrator: the longer the overload, the sooner it fails.',
      '- The electret microphone "sound source" is an internal signal (sine / square / sweep / noise / two-tone); it does not capture the computer\'s microphone. The 3.5 mm jack and the generator are the same (no WAV-file input).',
      '- Not represented: acoustic phase of cabinets / crossovers, feedback howl, real music.',
    ],
    kinds: { trans: 'transducer', src: 'source', amp: 'amplifier' }, gen: '(generated from the part data — do not edit by hand)',
  },
};

async function collect() {
  const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f.endsWith('/') ? f + 'index.html' : f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': /\.js$/.test(f) ? 'text/javascript' : /\.css$/.test(f) ? 'text/css' : 'text/html' }); r.end(b); } }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
  await page.goto('http://127.0.0.1:' + port + '/index.html?fresh=1&lang=en'); await page.waitForTimeout(500);
  const meta = await page.evaluate((types) => types.map((t) => {
    const d = DEFS[t], c = app.addComp(t, 300, 300, 0, {}); let info = ''; try { info = typeof d.info === 'function' ? d.info(c) : (d.info || ''); } catch (e) { }
    return { t, termNames: d.termNames || [], pinTxt: d.pinTxt || null, props: (d.props || []).map((p) => ({ k: p.k, label: p.label, lk: p.lk, unit: p.unit || '', def: p.def, kind: p.kind || '', opts: (p.opts || []).map((o) => o[1]) })), info, cat: d.cat, pgrp: d.pgrp };
  }), TYPES);
  const meas = await page.evaluate(fs.readFileSync(path.join(__dirname, 'audio-measure.js'), 'utf8'));
  const exs = await page.evaluate(() => (typeof EXAMPLES !== 'undefined' ? EXAMPLES : []).filter((e) => /^aud/.test(e.id)).map((e) => e.id));
  await browser.close(); srv.close();
  return { meta, meas, exs };
}

const fmtW = (p) => (p >= 10 ? p.toFixed(1) : p >= 1 ? p.toFixed(2) : p.toFixed(3)) + ' W';
function gen(lang, data) {
  const t = T[lang], d = D[lang], o = [];
  const nm = (x) => d['c.' + x + '.name'] || x, ds = (x) => d['c.' + x + '.desc'] || '';
  o.push('# ' + t.title, '', t.intro, '', '## ' + t.sound, '', ...t.soundText, '');
  o.push('## ' + t.parts, '', '| ' + t.partsCols.join(' | ') + ' |', '|---|---|---|');
  for (const g of ['trans', 'src', 'amp']) for (const x of GROUP[g]) o.push('| ' + nm(x) + ' (`' + x + '`) | ' + t.kinds[g] + ' | ' + ds(x) + ' |');
  o.push('', '(`pot`: ' + (lang === 'zh' ? '电位器新增“A 型对数 (音频) 曲线”选项，用作音量电位器。' : 'the potentiometer has a new "A (audio / log)" taper option for volume controls.') + ')', '');
  o.push('## ' + t.ampTitle, '', t.ampIntro, '', '| ' + t.ampCols.join(' | ') + ' |', '|' + t.ampCols.map(() => '---').join('|') + '|');
  for (const a of data.meas.amps) if (!a.err) o.push('| ' + a.label + ' | ' + a.gain.toFixed(1) + '× | ' + a.gainDb.toFixed(1) + ' | ' + a.vs + ' V | ' + a.Z + ' Ω | ' + fmtW(a.Pclip) + ' | ' + fmtW(a.Pmax) + ' | ' + (a.eff ? Math.round(a.eff * 100) + ' %' : '—') + ' |');
  o.push('');
  for (const g of ['trans', 'src', 'amp']) for (const x of GROUP[g]) {
    const m = data.meta.find((q) => q.t === x); o.push('## ' + nm(x), '', ds(x), '');
    o.push('**' + t.pins + '**', '', '| ' + t.pinCols.join(' | ') + ' |', '|---|---|');
    m.termNames.forEach((n, i) => o.push('| ' + (i + 1) + ' | ' + n.replace(/^\d+\s/, '') + ' |'));
    o.push('', '**' + t.props + '**', '', '| ' + t.propCols.join(' | ') + ' |', '|---|---|');
    for (const p of m.props) { const lab = (p.lk && d[p.lk]) || (lang === 'en' ? (p.label.replace(/^[^A-Za-z]*/, '') || p.k) : p.label); o.push('| ' + lab + (p.unit ? ' (' + p.unit + ')' : '') + ' | ' + (typeof p.def === 'number' ? +p.def.toPrecision(4) : p.def === undefined ? '' : p.def) + ' |'); }
    if (m.info) o.push('', '```', m.info.trim(), '```');
    o.push('');
  }
  o.push('## ' + t.ex, '', '| ' + t.exCols.join(' | ') + ' |', '|---|---|');
  for (const id of data.exs) o.push('| ' + (d['ex.' + id] || id) + ' | ' + ((EX[id] || {})[lang] || '') + ' |');
  o.push('', '## ' + t.limits, '', ...t.limitsText, '', '_' + t.gen + '_', '');
  return o.join('\n');
}
(async () => {
  const data = await collect();
  fs.writeFileSync(path.join(root, 'docs/audio-zh.md'), gen('zh', data)); fs.writeFileSync(path.join(root, 'docs/audio-en.md'), gen('en', data));
  console.log('docs/audio-zh.md, docs/audio-en.md written; amps measured:', data.meas.amps.length, 'examples:', data.exs.length);
})();
