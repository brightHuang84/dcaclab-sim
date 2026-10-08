// v9 screenshots: box select, group move, export dialog, wire auto-merge
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const OUT = process.env.OUT || '/workspace/dcaclab-sim/screenshots/';
const BASE = process.env.URL || 'http://127.0.0.1:8765/index.html';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const open = async (lang) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => console.log('pageerror', e.message));
    await page.goto(BASE + '?fresh=1&lang=' + lang); await page.waitForTimeout(400);
    await page.evaluate(() => {
      window.SCR = (wx, wy) => { const r = app.cv.getBoundingClientRect(); return [r.left + app.view.ox + wx * app.view.s, r.top + app.view.oy + wy * app.view.s]; };
      window.hideToast = () => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); };
    });
    return page;
  };
  // left part of a circuit (window rect in world coords)
  const leftRect = () => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const c of app.comps) { const b = app.worldBox(c); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
    return [x0 - 30, y0 - 40, x0 + (x1 - x0) * 0.55, y1 + 30];
  };
  // 48: rubber band in progress (select mode, left→right window)
  {
    const page = await open('zh-CN');
    const r = await page.evaluate((lr) => { app.loadExample('reg7805'); app.run(); app.advance(0.3); app.setSelectMode(true); app.sel = null; app.refreshProps(); const R = eval('(' + lr + ')')(); return { a: SCR(R[0], R[1]), b: SCR(R[2], R[3]) }; }, leftRect.toString());
    await page.waitForTimeout(600); await page.evaluate(() => hideToast()); await page.waitForTimeout(400);
    await page.mouse.move(r.a[0], r.a[1]); await page.mouse.down(); await page.mouse.move(r.b[0], r.b[1], { steps: 12 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: OUT + '48-box-select.png' }); console.log('saved 48');
    await page.mouse.up(); await page.close();
  }
  // 49: group move in progress (wires to unselected parts stretch), English UI
  {
    const page = await open('en');
    const r = await page.evaluate((lr) => {
      app.loadExample('reg7805'); app.run(); app.advance(0.3);
      const R = eval('(' + lr + ')')(); const p = app.boxPick(R[0], R[1], R[2], R[3], false); app.setSelection(p.comps, p.wires);
      const c = p.comps.find(o => !DEFS[o.type].board && o.type !== 'ground' && o.type !== 'voltmeter') || p.comps[0];
      return { a: SCR(c.x, c.y), s: app.view.s };
    }, leftRect.toString());
    await page.waitForTimeout(400);
    await page.waitForTimeout(1500); await page.evaluate(() => hideToast()); await page.waitForTimeout(400);
    await page.mouse.move(r.a[0], r.a[1]); await page.mouse.down(); await page.mouse.move(r.a[0] + 60 * r.s, r.a[1] + 60 * r.s, { steps: 12 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: OUT + '49-group-move.png' }); console.log('saved 49');
    await page.mouse.up(); await page.close();
  }
  // 50: export dialog (selection only, typed name with illegal characters → sanitised preview)
  {
    const page = await open('zh-CN');
    await page.evaluate((lr) => {
      app.loadExample('nightlight'); app.run(); app.advance(0.3);
      const R = eval('(' + lr + ')')(); const p = app.boxPick(R[0], R[1], R[2], R[3], true); app.setSelection(p.comps, p.wires);
    }, leftRect.toString());
    await page.click('#btn-export'); await page.waitForSelector('#exp-name');
    await page.fill('#exp-name', '光控小夜灯: 传感器部分/v2?');
    await page.evaluate(() => hideToast()); await page.waitForTimeout(500);
    await page.screenshot({ path: OUT + '50-export-dialog.png' }); console.log('saved 50');
    await page.close();
  }
  // 51: wire auto-merge — before (3 separate wires through free junctions) / after (one polyline wire)
  {
    const page = await open('zh-CN');
    const build = async (merge) => page.evaluate((merge) => {
      app.clearAll(); app.pause();
      const B = app.addComp('battery', 0, 200), R = app.addComp('resistor', 300, 0, 0, { R: 470 }), L = app.addComp('led', 440, 200);
      const W = (pts, col) => { let w = null; for (let i = 0; i < pts.length - 1; i++) { const x = app.addWire(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0, col); if (!w) w = x; } return w; };
      W([[60, 200], [120, 200]], '#d62828'); W([[120, 200], [120, 0]], '#f08c00'); W([[120, 0], [260, 0]], '#1971c2');
      W([[340, 0], [360, 0], [360, 200], [400, 200]], '#2f9e44');
      W([[480, 200], [560, 200], [560, 320], [-60, 320], [-60, 200]], '#343a40');
      const a = app.termPos(B, 1);
      if (merge) app.changed();
      app.fitView(); app.view.s *= 0.9; app.run(); app.advance(0.2);
      if (merge) { const w = app.wires.find(x => app.wEnd(x, 1).join() === a.join() || app.wEnd(x, 2).join() === a.join()); app.sel = { wire: w }; }
      else app.sel = null;
      app.refreshProps(); app.updateHud();
      const cap = document.createElement('div'); cap.id = 'cap';
      cap.style.cssText = 'position:absolute;left:50%;top:44px;transform:translateX(-50%);background:' + (merge ? '#2f9e44' : '#e8590c') + ';color:#fff;font:600 17px var(--ui-font);padding:7px 16px;border-radius:18px;z-index:9;box-shadow:0 2px 8px rgba(0,0,0,.25);white-space:nowrap';
      cap.textContent = merge ? '合并后：' + app.wires.length + ' 根导线（选中的是合并后的一根折线导线）' : '合并前：' + app.wires.length + ' 根导线（红/橙/蓝等线段仅在空白点首尾相连）';
      document.getElementById('stage').appendChild(cap);
    }, merge);
    const stage = await page.$('#stage');
    await build(false); await page.evaluate(() => hideToast()); await page.waitForTimeout(500);
    await stage.screenshot({ path: '/tmp/51a.png' });
    await page.evaluate(() => document.getElementById('cap').remove());
    await build(true); await page.evaluate(() => hideToast()); await page.waitForTimeout(500);
    await stage.screenshot({ path: '/tmp/51b.png' });
    await page.close();
    execFileSync('python3', ['-c', `
from PIL import Image
a=Image.open('/tmp/51a.png'); b=Image.open('/tmp/51b.png')
W=a.width+b.width+12; H=max(a.height,b.height)
im=Image.new('RGB',(W,H),(207,216,227)); im.paste(a,(0,0)); im.paste(b,(a.width+12,0)); im.save('${OUT}51-wire-auto-merge.png')
`]);
    console.log('saved 51');
  }
  await browser.close();
})();
