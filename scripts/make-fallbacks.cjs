'use strict';
const fs = require('node:fs'), path = require('node:path');
const { generate } = require('../src/generation/generator');
const levels = require('../src/generation/fallbacks');
const { CONFIG, profileIndex } = require('../src/config');
const { solve } = require('../src/generation/validate');
const { acceptable } = require('../src/generation/generator');
for (const n of [1, 2, 3, 8, 13, 18]) levels[profileIndex(n)] = generate(n, 92000 + n, { forceRandom: true, noFallback: true, maxAttempts: 500 }).level;
for (let i = 0; i < levels.length; i++) {
    const validation = solve(levels[i]);
    if (!validation.valid || !acceptable(validation.metrics, CONFIG.profiles[i])) throw Error('Invalid fallback ' + i);
}
fs.writeFileSync(path.join(__dirname, '../src/generation/fallbacks.js'), "'use strict';\n// Verified fallback layouts; do not regenerate on restart.\nmodule.exports=" + JSON.stringify(levels, null, 2) + ';\n');
console.log(levels.map(l => ({ number: l.number, arrows: l.arrows.length })));


const obstacleLevels = {};
for (const n of [15, 18, 20, 25, 30]) {
    const l = generate(n, 92000 + n, { noFallback: true, maxAttempts: 500 }).level;
    obstacleLevels[l.width + ':' + require('../src/config').obstacleCount(n)] = l;
}
fs.writeFileSync(path.join(__dirname, '../src/generation/obstacle-fallbacks.js'), "'use strict';\nmodule.exports=" + JSON.stringify(obstacleLevels) + ';\n');
