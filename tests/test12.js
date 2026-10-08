// v10.1 tests: pinout / usage reference panel for the Arduino Uno and ATtiny85 parts (buttons in the properties panel and
// the program editor, content of both boards in all 10 languages, pin facts consistent with the simulated parts, usage
// snippets compile), every microcontroller example loaded from the panel runs cleanly, "insert into editor" / "copy code",
// the new examples in the examples menu, and wire colours (single / multi selection, custom colour, one undo step,
// remembered colour for new wires, save / load / old files, no auto-merge across colours, light wires stay visible).
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const results = {}; const fails = [];
const check = (name, cond, info) => { results[name] = { pass: !!cond, info }; if (!cond) fails.push(name); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + JSON.stringify(info))); };
const BASE = process.env.URL || 'http://127.0.0.1:8765/index.html';
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt-BR'];
const SIMP = fs.readFileSync(path.join(__dirname, 'test9.js'), 'utf8').match(/const SIMP = '([^']+)'/)[1];
const NEW_EX = ['arddebounce', 'ardnight', 'ardmulti', 'ardmotor', 'ardrelay', 'ardtone', 'tinyfade'];

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  const mk = async (url, opts) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 860 }, locale: 'en-US' }, opts || {}));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(url + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(url + ' console: ' + m.text()); });
    await page.goto(url); await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.MC = () => app.comps.find(c => DEFS[c.type].mcu);
      window.SEL = (c) => { app.sel = { comp: c }; app.refreshProps(); };
      window.RUN = (sec, press) => { let bad = 0; const n = Math.round(sec / app.dt); const S = app.comps.find(c => c.type === 'button');
        for (let i = 0; i < n; i++) { if (press && S) { if (i % 3000 === 1000) { S.state.pressed = true; app.dirty = true; } if (i % 3000 === 1600) { S.state.pressed = false; app.dirty = true; } } app.simStep(); if (!app.net.converged) bad++; } return bad; };
      window.TOAST = () => (document.getElementById('toast') || {}).textContent || '';
    });
    return { ctx, page };
  };

  // ---------- 1. dictionaries: every help / example / wire-colour key in all 10 locales ----------
  {
    const { ctx, page } = await mk(BASE + '?fresh=1');
    const d = await page.evaluate((LANGS) => {
      const pre = /^(help\.|wc\.)/; const ref = Object.keys(I18N.dicts['zh-CN']).filter(k => pre.test(k));
      const exKeys = ['arddebounce', 'ardnight', 'ardmulti', 'ardmotor', 'ardrelay', 'ardtone', 'tinyfade'].flatMap(id => ['ex.' + id, 'exd.' + id]);
      const out = { n: ref.length, langs: {} };
      for (const L of LANGS) { const D = I18N.dicts[L]; out.langs[L] = { missing: ref.concat(exKeys).filter(k => !(k in D) || !D[k]).length }; }
      // every key the panel code can ask for exists (usage paragraphs, limits, notes, tags, wiring tokens)
      const H = MCU_HELP_DATA, need = [];
      for (const u of H.USAGE) { need.push('help.u.' + u.id + '.t'); for (let i = 1; i <= u.n; i++) need.push('help.u.' + u.id + '.' + i); }
      for (const b of H.BOARDS) { need.push('help.intro.' + b); for (let i = 1; i <= H.LIMITS[b]; i++) need.push('help.lim.' + b + '.' + i); for (const r of H.PINS[b]) { if (r.note) need.push('help.note.' + r.note); r.tags.forEach(t => need.push('help.tag.' + t)); } }
      for (let i = 1; i <= H.SIM_NO; i++) need.push('help.sim.no.' + i);
      H.WIRE_TOKENS.forEach(w => need.push('help.w.' + w)); H.CATS.forEach(c => need.push('help.cat.' + c));
      for (const id of Object.keys(MCU_EX)) { need.push('exd.' + id, 'ex.' + id); for (const l of MCU_EX[id].wiring) (l.match(/\{w:(\w+)\}/g) || []).forEach(m => need.push('help.w.' + m.slice(3, -1))); }
      out.needMissing = [...new Set(need)].filter(k => LANGS.some(L => !(k in I18N.dicts[L])));
      out.unusedTokens = H.WIRE_TOKENS.filter(w => !Object.values(MCU_EX).some(e => e.wiring.join(' ').includes('{w:' + w + '}')));
      return out;
    }, LANGS);
    check('help_keys_present_in_all_10_locales', d.n >= 200 && LANGS.every(L => d.langs[L].missing === 0), d);
    check('help_every_requested_key_exists', d.needMissing.length === 0, d.needMissing.slice(0, 10));
    await ctx.close();
  }

  // ---------- 2. pin facts: consistent with the simulated parts and with the datasheets ----------
  {
    const { ctx, page } = await mk(BASE + '?fresh=1');
    const f = await page.evaluate(() => {
      const H = MCU_HELP_DATA, B = MCU.BOARDS;
      const row = (b, p) => H.PINS[b].find(r => r.p.split(' ')[0] === p || r.p.endsWith(p));
      const unoPwm = H.PINS.arduino.filter(r => r.tags.some(t => t.startsWith('pwm'))).map(r => +r.p.slice(1).split(' ')[0]);
      const f980 = H.PINS.arduino.filter(r => r.tags.includes('pwm980')).map(r => +r.p.slice(1).split(' ')[0]);
      const simPwm = Object.keys(B.arduino.pwm).map(Number), sim980 = simPwm.filter(p => B.arduino.pwm[p] > 900);
      const tinyPwm = H.PINS.attiny85.filter(r => r.tags.includes('tpwm')).map(r => r.p.split(' · ')[1]);
      const tinyAdc = Object.fromEntries(H.PINS.attiny85.filter(r => r.a).map(r => [r.p.split(' · ')[1], r.a]));
      return {
        unoPwm, f980, simPwm, sim980, tinyPwm, tinyAdc,
        int: [row('arduino', 'D2').tags.includes('int0'), row('arduino', 'D3').tags.includes('int1')],
        spi: ['D10', 'D11', 'D12', 'D13'].map(p => row('arduino', p).tags.filter(t => ['ss', 'mosi', 'miso', 'sck'].includes(t))[0]),
        i2c: [row('arduino', 'A4').tags.includes('sda'), row('arduino', 'A5').tags.includes('scl')],
        uart: [row('arduino', 'D0').tags.includes('rx'), row('arduino', 'D1').tags.includes('tx')],
        led: row('arduino', 'D13').tags.includes('led'),
        tinyOrder: H.PINS.attiny85.map(r => r.p),
        tinyNames: DEFS.attiny85.termNames,
        absent: H.PINS.arduino.filter(r => r.absent).map(r => r.p),
        limits: [I18N.dicts.en['help.lim.arduino.1'], I18N.dicts.en['help.lim.arduino.2'], I18N.dicts.en['help.lim.arduino.6'], I18N.dicts.en['help.lim.attiny85.1']].join(' | '),
      };
    });
    const same = (a, b) => JSON.stringify([...a].sort((x, y) => x - y)) === JSON.stringify([...b].sort((x, y) => x - y));
    check('facts_uno_pwm_pins_match_simulator', same(f.unoPwm, [3, 5, 6, 9, 10, 11]) && same(f.unoPwm, f.simPwm) && same(f.f980, [5, 6]) && same(f.f980, f.sim980), f);
    check('facts_uno_interrupts_spi_i2c_uart_led', f.int.every(Boolean) && f.spi.join() === 'ss,mosi,miso,sck' && f.i2c.every(Boolean) && f.uart.every(Boolean) && f.led, f);
    check('facts_attiny85_dip8_order_pwm_adc', f.tinyOrder.join() === '1 · PB5,2 · PB3,3 · PB4,4 · GND,5 · PB0,6 · PB1,7 · PB2,8 · VCC' && f.tinyPwm.join() === 'PB4,PB0,PB1' &&
      JSON.stringify(f.tinyAdc) === JSON.stringify({ PB5: 'A0', PB3: 'A3', PB4: 'A2', PB2: 'A1' }) && f.tinyNames.every((n, i) => n.startsWith(String(i + 1) + ' ')), f);
    check('facts_limits_text', /20 mA/.test(f.limits) && /40 mA/.test(f.limits) && /200 mA/.test(f.limits) && /7–12 V/.test(f.limits), f.limits);
    check('facts_absent_pins_marked', ['RESET', 'AREF', 'IOREF', 'SDA', 'ICSP'].every(p => f.absent.some(a => a.startsWith(p))), f.absent);
    await ctx.close();
  }

  // ---------- 3. panel in every language: both boards, buttons in the properties panel and the editor toolbar ----------
  const langReport = {};
  for (const L of LANGS) {
    const { ctx, page } = await mk(BASE + '?fresh=1&lang=' + L);
    const r = await page.evaluate(async ({ L, SIMP }) => {
      const out = {};
      app.loadExample('ardblink'); const A = MC(); SEL(A);
      const btn = document.querySelector('#props .mcu-pin'); out.propBtn = !!btn; out.propBtnText = btn ? btn.textContent : '';
      btn.click(); await new Promise(r => setTimeout(r, 50));
      const el = document.getElementById('pin-win');
      const scan = (b) => {
        const txt = el.innerText; const o = { board: MCUHELP.S.board };
        o.raw = (txt.match(/\b(help|wc|exd?|c)\.[a-z0-9_]+\.[a-z0-9_.]+/g) || []).slice(0, 5);
        o.rows = el.querySelectorAll('.pw-tab tbody tr').length; o.svg = !!el.querySelector('.pw-svg svg'); o.usage = el.querySelectorAll('.pw-u').length;
        o.ex = [...el.querySelectorAll('.pw-ex')].map(s => s.dataset.id); o.btns = el.querySelectorAll('.pw-ex .pw-load').length + el.querySelectorAll('.pw-ex .pw-insert').length + el.querySelectorAll('.pw-ex .pw-copy').length;
        o.code = el.querySelectorAll('.pw-ex pre.pw-code').length; o.wiring = el.querySelectorAll('.pw-wire li').length; o.tokens = /\{[cw]:/.test(txt);
        // text outside code blocks / pin names: no Chinese in non-Chinese locales; no Simplified-only characters in ja / zh-TW
        const clone = el.cloneNode(true); clone.querySelectorAll('pre, code, svg').forEach(n => n.remove()); const prose = clone.textContent;
        o.han = /[\u4e00-\u9fff]/.test(prose); o.simp = (prose.match(new RegExp('[' + SIMP + ']', 'g')) || []).slice(0, 5); o.len = prose.length;
        return o;
      };
      out.uno = scan();
      el.querySelector('.pw-board[data-b="attiny85"]').click(); await new Promise(r => setTimeout(r, 30));
      out.tiny = scan();
      // the editor toolbar button opens the panel for the chip being edited
      MCUHELP.close(); app.loadExample('tinyblink'); const T = MC(); MCU.openEditor(T);
      const eb = document.querySelector('#mcu-win .mw-pin'); out.edBtn = !!eb; out.edBtnText = eb ? eb.textContent : '';
      eb.click(); await new Promise(r => setTimeout(r, 30)); out.edBoard = MCUHELP.S.board; out.edOpen = MCUHELP.isOpen();
      // side by side: the panel does not cover the editor
      const er = document.getElementById('mcu-win').getBoundingClientRect(), pr = el.getBoundingClientRect(); out.overlap = Math.max(0, Math.min(er.right, pr.right) - Math.max(er.left, pr.left));
      out.scrollable = el.querySelector('.pw-body').scrollHeight > el.querySelector('.pw-body').clientHeight;
      return out;
    }, { L, SIMP });
    langReport[L] = { uno: r.uno, tiny: r.tiny };
    const nonZh = !['zh-CN', 'zh-TW', 'ja'].includes(L);
    const okBoard = (o, b, rows, ex) => o.board === b && o.raw.length === 0 && o.rows === rows && o.svg && o.usage === 12 && o.ex.length === ex && o.btns === 3 * ex && o.code === ex && o.wiring > 0 && !o.tokens && (!nonZh || !o.han) && o.simp.length === (L === 'zh-CN' ? o.simp.length : 0);
    check('panel_' + L + '_uno', r.propBtn && okBoard(r.uno, 'arduino', 29, 12), r.uno);
    check('panel_' + L + '_attiny85', okBoard(r.tiny, 'attiny85', 8, 2), r.tiny);
    check('panel_' + L + '_editor_button_side_by_side', r.edBtn && r.edOpen && r.edBoard === 'attiny85' && r.overlap === 0 && r.scrollable, { edBtn: r.edBtnText, prop: r.propBtnText, board: r.edBoard, overlap: r.overlap });
    await ctx.close();
  }

  // ---------- 4. language switch re-renders the open panel; navigation and example links ----------
  {
    const { ctx, page } = await mk(BASE + '?fresh=1&lang=zh-CN');
    const r = await page.evaluate(async () => {
      app.loadExample('ardpwm'); MCUHELP.open('arduino', 'usage');
      const el = document.getElementById('pin-win'), body = el.querySelector('.pw-body');
      const t0 = el.querySelector('.mw-title').textContent, top0 = body.scrollTop;
      app.setLang('en'); const t1 = el.querySelector('.mw-title').textContent;
      el.querySelector('[data-go="pw-examples"]').click(); const top1 = el.querySelector('.pw-body').scrollTop;
      el.querySelector('#pw-u-pwm [data-ex="tinyfade"]').click(); const b2 = MCUHELP.S.board;
      el.querySelector('.pw-other a').click(); const b3 = MCUHELP.S.board;
      app.setLang('zh-CN');
      return { t0, t1, top0, top1, b2, b3 };
    });
    check('panel_relang_and_navigation', r.t0.includes('引脚') && r.t1.includes('Pinout') && r.top0 > 0 && r.top1 > r.top0 && r.b2 === 'attiny85' && r.b3 === 'arduino', r);
    await ctx.close();
  }

  // ---------- 5. usage snippets compile (they are shown as copy-and-paste code) ----------
  {
    const { ctx, page } = await mk(BASE + '?fresh=1');
    const r = await page.evaluate(() => MCU_HELP_DATA.USAGE.filter(u => u.code).map(u => { const res = MCULANG.compile(u.code.join('\n'), 'ino', MCU.BOARDS.arduino.consts); return { id: u.id, ok: res.ok, err: res.ok ? null : res.error }; }));
    check('usage_snippets_compile', r.length >= 9 && r.every(x => x.ok), r.filter(x => !x.ok));
    await ctx.close();
  }

  // ---------- 6. every microcontroller example: in the examples menu, loaded from the panel, runs cleanly ----------
  {
    const { ctx, page } = await mk(BASE + '?fresh=1&lang=zh-CN');
    const menu = await page.evaluate(() => [...document.querySelectorAll('#sel-example option')].map(o => o.value));
    check('examples_menu_has_new_examples', NEW_EX.every(id => menu.includes(id)), NEW_EX.filter(id => !menu.includes(id)));
    const ids = await page.evaluate(() => Object.keys(MCU_EX));
    check('examples_mcu_count_14', ids.length === 14 && NEW_EX.every(id => ids.includes(id)), ids);
    const out = [];
    for (const id of ids) {
      const r = await page.evaluate(async (id) => {
        const board = MCU_EX[id].board; MCUHELP.open(board, 'pw-ex-' + id);
        const b = document.querySelector('#pin-win .pw-load[data-id="' + id + '"]'); if (!b) return { id, noButton: true };
        b.click(); app.pause(); app.resetSim();
        const mc = app.comps.filter(c => DEFS[c.type].mcu);
        const codeOk = mc.length > 0 && mc[0].props.code === MCU_EX[id].code && mc[0].type === board;
        const t0 = performance.now(); const bad = RUN(id === 'ardrelay' ? 4.5 : 3.2, true);
        const ser = mc.map(c => c.state.ser || '').join('');
        return { id, codeOk, bad, ms: Math.round(performance.now() - t0), st: mc.map(c => MCU.statusOf(c)), err: mc.map(c => c.state.rt && c.state.rt.err).filter(Boolean), conv: app.conv ? app.conv.n : 0, passOver: app.findPassOvers().length, warn: app.warn, ser: ser.slice(-120),
          led: app.comps.filter(c => c.type === 'led').map(c => +((c._m.I || 0) * 1000).toFixed(2)), motor: app.comps.filter(c => c.type === 'motor').map(c => DEFS.motor.readings(c).map(x => x.join('=')).join(',')) };
      }, id);
      out.push(r);
      check('example_from_panel_runs_' + id, !r.noButton && r.codeOk && r.bad === 0 && !r.conv && r.err.length === 0 && r.st.every(s => s === 'run') && r.passOver === 0 && !r.warn, r);
    }
    const by = Object.fromEntries(out.map(r => [r.id, r]));
    check('example_behaviour_new', /presses: [1-9]/.test(by.arddebounce.ser) && /LED PWM = \d+/.test(by.ardnight.ser) && /uptime: [23] s/.test(by.ardmulti.ser) && /speed = \d+ %/.test(by.ardmotor.ser) &&
      /relay ON[\s\S]*relay OFF/.test(by.ardrelay.ser) && /note \d+ Hz/.test(by.ardtone.ser) && by.tinyfade.led.length === 2, { deb: by.arddebounce.ser, night: by.ardnight.ser, multi: by.ardmulti.ser, motor: by.ardmotor.ser, relay: by.ardrelay.ser, tone: by.ardtone.ser, fade: by.tinyfade.led });
    await ctx.close();
  }

  // ---------- 7. insert into the editor / copy code ----------
  {
    const { ctx, page } = await mk(BASE + '?fresh=1&lang=zh-CN', { permissions: ['clipboard-read', 'clipboard-write'] });
    const r = await page.evaluate(async () => {
      const out = {};
      app.loadExample('ardblink'); const A = MC(); const before = A.props.code;
      MCUHELP.open('arduino', 'pw-ex-ardtraffic');
      document.querySelector('#pin-win .pw-insert[data-id="ardtraffic"]').click();
      const W = document.getElementById('mcu-win'), ta = W.querySelector('.mw-code');
      out.editorOpen = W.style.display !== 'none'; out.taIsCode = ta.value === MCU_EX.ardtraffic.code; out.lang = W.querySelector('.mw-lang').value;
      out.notUploadedYet = A.props.code === before; out.toast1 = TOAST();
      W.querySelector('.mw-upload').click(); out.uploaded = A.props.code === MCU_EX.ardtraffic.code;
      app.pause(); app.resetSim(); const bad = RUN(1.0); out.runOk = bad === 0 && MCU.statusOf(A) === 'run' && /RED|GREEN|YELLOW|red|green|yellow/i.test(A.state.ser || '');
      out.ser = (A.state.ser || '').slice(0, 80);
      // code written for the other board: inserted with a warning
      app.loadExample('tinyblink'); MCUHELP.open('arduino', 'pw-ex-ardbutton'); document.querySelector('#pin-win .pw-insert[data-id="ardbutton"]').click(); out.toast2 = TOAST();
      out.tinyTa = document.querySelector('#mcu-win .mw-code').value === MCU_EX.ardbutton.code;
      // nothing to insert into
      MCU.closeEditor(); app.clearAll(); out.noChip = MCUHELP.insertExample('ardblink'); out.toast3 = TOAST();
      // copy
      MCUHELP.open('attiny85', 'pw-ex-tinyfade'); document.querySelector('#pin-win .pw-copy[data-id="tinyfade"]').click();
      await new Promise(r => setTimeout(r, 200)); out.toast4 = TOAST();
      try { out.clip = (await navigator.clipboard.readText()) === MCU_EX.tinyfade.code; } catch (e) { out.clip = 'err ' + e.message; }
      return out;
    });
    check('insert_into_editor_without_upload', r.editorOpen && r.taIsCode && r.lang === 'ino' && r.notUploadedYet && r.toast1.includes('Arduino'), r);
    check('insert_then_upload_runs', r.uploaded && r.runOk, r);
    check('insert_mismatch_warns', r.tinyTa && r.toast2.includes('Arduino Uno'), r.toast2);
    check('insert_without_chip_toasts', r.noChip === false && r.toast3.length > 5, r.toast3);
    check('copy_code_to_clipboard', r.clip === true && r.toast4.length > 3, { clip: r.clip, toast: r.toast4 });
    await ctx.close();
  }

  // ---------- 8. wire colours ----------
  {
    const { ctx, page } = await mk(BASE + '?fresh=1&lang=zh-CN');
    const r = await page.evaluate(() => {
      const out = {};
      const PAL = WIRE_PALETTE.map(p => p[1]);
      // a small circuit: battery + resistor + LED + three wires
      app.clearAll();
      const B = app.addComp('battery', 200, 300, 0, {}), R = app.addComp('resistor', 400, 200, 0, {}), D = app.addComp('led', 600, 300, 1, {});
      const tp = (c, i) => app.termPos(c, i);
      const w1 = app.addWire(...tp(B, 1), ...tp(R, 0)), w2 = app.addWire(...tp(R, 1), ...tp(D, 0)), w3 = app.addWire(...tp(D, 1), ...tp(B, 0));
      app.changed(); const h0 = app.history.length;
      out.defaultColor = [w1, w2, w3].every(w => w.color === WIRE_DEFAULT);
      // single wire: 10 swatches + custom picker in the properties panel
      app.sel = { wire: w1 }; app.refreshProps();
      const props = document.getElementById('props');
      out.swatches = [...props.querySelectorAll('.wc-sw button[data-wc]')].map(b => b.dataset.wc); out.picker = !!props.querySelector('.wc-sw input.wc-pick[type=color]');
      out.titles = [...props.querySelectorAll('.wc-sw button[data-wc]')].map(b => b.title).join(',');
      props.querySelector('.wc-sw button[data-wc="#1d5fd1"]').click();
      out.single = w1.color === '#1d5fd1' && app.history.length === h0 + 1; out.selOn = !!document.querySelector('#props .wc-sw button.on[data-wc="#1d5fd1"]');
      app.undo(); out.singleUndo = app.wires.find(w => w.id === w1.id).color === WIRE_DEFAULT;
      // multi selection (box select / select all): one undo step for all wires
      app.setSelection([], app.wires.slice()); app.refreshProps();
      out.multiLabel = (document.querySelector('#props .wc .rv') || {}).textContent || '';
      const h1 = app.hIdx;
      document.querySelector('#props .wc-sw button[data-wc="#2a9d3a"]').click();
      out.multi = app.wires.every(w => w.color === '#2a9d3a') && app.hIdx === h1 + 1;
      app.undo(); out.multiUndo = app.wires.every(w => w.color === WIRE_DEFAULT);
      app.redo(); out.multiRedo = app.wires.every(w => w.color === '#2a9d3a');
      // custom colour
      app.setSelection([], app.wires.slice(0, 2)); app.refreshProps();
      const pick = document.querySelector('#props .wc-pick'); pick.value = '#123456'; pick.dispatchEvent(new Event('change'));
      out.custom = app.wires.filter(w => w.color === '#123456').length === 2 && document.querySelector('#props .sw-custom.on') !== null;
      // remembered for new wires
      out.remember = app.wireColor === '#123456' && localStorage.getItem('dcaclab-wirecolor') === '#123456';
      const nw = app.addWire(100, 100, 160, 100); out.newWire = nw.color === '#123456'; app.wires = app.wires.filter(w => w !== nw);
      app.startWire && (() => { app.startWire(100, 500); const w = app.wires[app.wires.length - 1]; out.uiWire = w.color === '#123456'; app.wires.pop(); app.drag = null; app.wireDraft = null; })();
      // save / load round trip
      const json = JSON.stringify(app.serialize()); const cols = app.wires.map(w => w.color).sort().join();
      out.saved = JSON.parse(json).wires.every(w => /^#[0-9a-f]{6}$/.test(w.color));
      app.clearAll(); app.load(json); out.loaded = app.wires.map(w => w.color).sort().join() === cols;
      // selection copy (export of a sub-circuit) keeps the colour
      out.subset = app.serializeSubset([], app.wires).data.wires.every(w => /^#/.test(w.color));
      // old file without colour fields
      const old = JSON.parse(json); old.wires.forEach(w => delete w.color); delete old.version;
      let oldOk = true; try { app.load(JSON.stringify(old)); } catch (e) { oldOk = e.message; }
      out.oldFile = oldOk === true && app.wires.length === 3 && app.wires.every(w => w.color === WIRE_DEFAULT);
      // merging: two wires meeting at a free point merge only when their colours match
      app.clearAll();
      const a = app.addWire(100, 100, 200, 100, 0, '#d62828'), b = app.addWire(200, 100, 300, 100, 0, '#222222'); app.changed();
      out.diffNotMerged = app.wires.length === 2;
      app.setSelection([], [app.wires[1]]); app.refreshProps(); document.querySelector('#props .wc-sw button[data-wc="#d62828"]').click();
      out.sameMerged = app.wires.length === 1 && app.wires[0].pts.length >= 2 && app.wires[0].color === '#d62828';
      // light colours get a dark outline: render a white wire and look across it
      app.clearAll(); app.view.s = 1; app.view.ox = 0; app.view.oy = 0;
      app.addWire(300, 400, 700, 400, 0, '#e8e8e8'); app.changed(); app.sel = null; app.draw && app.draw(); app.dirty = true; app.render && app.render();
      return out;
    });
    check('wirecolor_palette_10_plus_custom', r.swatches.length === 10 && r.picker && new Set(r.swatches).size === 10 && !/wc\./.test(r.titles), r);
    check('wirecolor_single_set_and_undo', r.defaultColor && r.single && r.selOn && r.singleUndo, r);
    check('wirecolor_multi_one_undo_step', r.multi && r.multiUndo && r.multiRedo && /3/.test(r.multiLabel), r);
    check('wirecolor_custom_picker', r.custom, r);
    check('wirecolor_remembered_for_new_wires', r.remember && r.newWire && r.uiWire !== false, r);
    check('wirecolor_save_load_and_old_files', r.saved && r.loaded && r.subset && r.oldFile, r);
    check('wirecolor_merge_only_same_colour', r.diffNotMerged && r.sameMerged, r);
    // pixels across the white wire: white core plus a dark outline
    await page.waitForTimeout(200);
    const px = await page.evaluate(() => {
      const cv = app.cv, ctx = cv.getContext('2d'), dpr = cv.width / cv.getBoundingClientRect().width;
      const [sx, sy] = [500 * app.view.s + app.view.ox, 400 * app.view.s + app.view.oy];
      const col = []; for (let dy = -8; dy <= 8; dy++) { const d = ctx.getImageData(Math.round(sx * dpr), Math.round((sy + dy) * dpr), 1, 1).data; col.push(Math.round((0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]))); }
      return col;
    });
    check('wirecolor_light_wire_has_dark_outline', Math.max(...px) > 200 && Math.min(...px) < 120, px);
    // the remembered colour survives a reload (without ?fresh=1)
    await page.evaluate(() => { app.sel = { wire: app.wires[0] }; app.refreshProps(); document.querySelector('#props .wc-sw button[data-wc="#8e44ad"]').click(); });
    await page.goto(BASE + '?lang=zh-CN'); await page.waitForTimeout(300);
    const rem = await page.evaluate(() => app.wireColor);
    check('wirecolor_remembered_after_reload', rem === '#8e44ad', rem);
    await page.evaluate(() => localStorage.removeItem('dcaclab-wirecolor'));
    await ctx.close();
  }

  // ---------- 9. wire colour UI strings in every language ----------
  {
    const { ctx, page } = await mk(BASE + '?fresh=1');
    const r = await page.evaluate((LANGS) => {
      const out = {};
      app.loadExample(EXAMPLES[0].id);
      for (const L of LANGS) {
        app.setLang(L); app.setSelection([], app.wires.slice(0, 2)); app.refreshProps();
        const t = document.querySelector('#props .wc').innerText + ' ' + [...document.querySelectorAll('#props .wc [title]')].map(e => e.title).join(' ');
        out[L] = { raw: /\bwc\./.test(t), han: !['zh-CN', 'zh-TW', 'ja'].includes(L) && /[\u4e00-\u9fff]/.test(t), len: t.length };
      }
      app.setLang('zh-CN');
      return out;
    }, LANGS);
    check('wirecolor_ui_translated_10_locales', LANGS.every(L => !r[L].raw && !r[L].han && r[L].len > 20), r);
    await ctx.close();
  }

  check('no_page_errors', errors.length === 0, errors.slice(0, 10));
  fs.writeFileSync(path.join(__dirname, 'test12-report.json'), JSON.stringify({ results, langReport }, null, 1));
  console.log('\n' + (Object.keys(results).length - fails.length) + '/' + Object.keys(results).length + ' passed' + (fails.length ? '; FAILED: ' + fails.join(', ') : ''));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
