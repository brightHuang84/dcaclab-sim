'use strict';
// ===== v15.2: high-voltage NPN example — MJE13003 switches a 300 V DC supply into a 3 kΩ load, driven from a 5 V base circuit =====
(() => {
  const RED = '#d62828', BLK = '#222222', ORG = '#f77f00';
  EXAMPLES.push({
    id: 'hvsw', name: '高压开关：13003 用 5 V 基极驱动开关 300 V', build() {
      const b = EXAMPLES.builder();
      const BH = b.add('battery', 120, 300, 3, { V: 300, r: 0 });
      const RL = b.add('resistor', 300, 160, 0, { R: 3000 });
      const Q = b.add('npn', 520, 340, 0, { part: 'MJE13003', BF: 20, Is: 2e-13, VAF: 200, Vceo: 400, Icmax: 1.5 });
      const RB = b.add('resistor', 660, 400, 0, { R: 470 });
      const S = b.add('switch', 780, 400, 0, { closed: true });
      const BL = b.add('battery', 880, 460, 3, { V: 5, r: 0 });
      b.path([[BH, 1], [120, 160], [RL, 0]], RED);
      b.path([[RL, 1], [540, 160], [Q, 2]], RED);
      b.path([[Q, 1], [520, 400], [RB, 0]], ORG);
      b.path([[RB, 1], [S, 0]], ORG);
      b.path([[S, 1], [BL, 1]], ORG);
      b.path([[BH, 0], [120, 520], [500, 520]], BLK);
      b.path([[Q, 0], [500, 520]], BLK);
      b.path([[500, 520], [880, 520], [BL, 0]], BLK);
      return b.done();
    },
  });
})();
