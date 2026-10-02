// v6 screenshots: regulators, RGB LED, optocoupler + SCR, expanded palette / parts gallery, buck + AA holder
const { chromium } = require('playwright-core');
const OUT = process.env.OUT || '/workspace/dcaclab-sim/screenshots/';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto('http://127.0.0.1:8765/index.html?fresh=1');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    // merge several examples into one canvas (second one shifted by dx, dy)
    window.MERGE = (parts) => {
      const comps = [], wires = []; let id = 1;
      for (const [exId, dx, dy] of parts) {
        const d = EXAMPLES.find(e => e.id === exId).build(), map = new Map();
        for (const c of d.comps) { const n = Object.assign({}, c, { id: id++, x: c.x + dx, y: c.y + dy }); map.set(c.id, n.id); comps.push(n); }
        for (const w of d.wires) wires.push(Object.assign({}, w, { id: id++, pts: w.pts.map(([x, y]) => [x + dx, y + dy]) }));
      }
      app.load({ comps, wires }); app.pause(); app.resetSim(); app.fitView();
    };
    window.HIDE = () => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); };
  });
  const shot = async (name, setup, wait) => {
    await page.evaluate(setup);
    await page.waitForTimeout(wait || 1500);
    await page.evaluate(() => { HIDE(); app.updateReadings(true); });
    await page.waitForTimeout(200);
    await page.screenshot({ path: OUT + name });
    console.log('saved ' + name);
  };
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const want = (n) => !only || only.some(o => n.startsWith(o));
  if (want('30')) await shot('30-regulators.png', () => {
    MERGE([['reg7805', 0, 0], ['lm317', -40, 340]]); app.run();
    const U = app.comps.find(c => c.type === 'lm317'); app.sel = { comp: U }; app.refreshProps();
  });
  if (want('31')) await shot('31-rgb-led.png', () => {
    app.loadExample('rgbmix'); app.fitView(); app.run();
    const pots = app.comps.filter(c => c.type === 'pot'); pots[0].props.pos = 0.02; pots[1].props.pos = 1; pots[2].props.pos = 0.05; app.dirty = true;
    const L = app.comps.find(c => c.type === 'rgbled'); app.sel = { comp: L }; app.refreshProps();
  });
  if (want('32')) await shot('32-optocoupler-scr.png', () => {
    MERGE([['opto', 0, 0], ['scr', 140, 440]]); app.run();
    // fire the SCR once with the trigger button (then release — it stays latched)
    const b = app.comps.find(c => c.type === 'button' && !c.props.nc); b.state.pressed = true; app.dirty = true; app.advance(0.02); b.state.pressed = false; app.dirty = true;
    const O = app.comps.find(c => c.type === 'opto'); app.sel = { comp: O }; app.refreshProps();
  });
  if (want('33')) {
    await page.setViewportSize({ width: 1440, height: 1500 });
    await page.waitForTimeout(400);
    await shot('33-new-palette.png', () => {
      app.clearAll(); app.pause(); app.resetSim();
      const L = [['reg78xx', { part: '7805' }], ['lm317'], ['buck'], ['psu'], ['aaholder', { n: 4 }], ['coincell'], ['li18650'], ['solar'],
        ['ecap'], ['ccap'], ['sigdiode'], ['rectifier'], ['schottky'], ['bridge'], ['rgbled'], ['bicolor'],
        ['tip120'], ['opto'], ['scr'], ['triac'], ['tactile'], ['spdt'], ['dpdt'], ['rotary'],
        ['dip4', { s2: true, s3: true }], ['seg7cc'], ['ledbar'], ['servo'], ['fan'], ['vibmotor']];
      const W = { buck: 2, psu: 1.5, aaholder: 1.9, ledbar: 2.4, servo: 1.7, solar: 1.4, rotary: 1.4 };
      let x = 0, y = 0;
      for (const [t, p] of L) { const w = (W[t] || 1) * 170; if (x + w > 1000) { x = 0; y += 190; } app.addComp(t, x + w / 2, y, 0, p || {}); x += w + 10; }
      app.fitView();
      const tip = document.querySelector('.toast, #toast'); if (tip) tip.classList.remove('show');
    }, 600);
    if (want('35')) {
      await page.evaluate(() => { const pal = document.getElementById('palette'); const t = [...document.querySelectorAll('.cat-t')].find(e => /半导体/.test(e.textContent)); if (pal && t) pal.scrollTop += t.getBoundingClientRect().top - pal.getBoundingClientRect().top - 8; });
      await page.waitForTimeout(200); await page.screenshot({ path: OUT + '35-palette-semis-switches.png' }); console.log('saved 35-palette-semis-switches.png');
    }
    await page.setViewportSize({ width: 1440, height: 860 });
  }
  if (want('34')) await shot('34-buck-aa-holder.png', () => {
    app.loadExample('buckaa'); app.fitView(); app.run();
    const U = app.comps.find(c => c.type === 'buck'); app.sel = { comp: U }; app.refreshProps();
  });
  await browser.close();
})();
