'use strict';
const fs = require('node:fs'), path = require('node:path');
const { generate } = require('../src/generation/generator');
const levels = [2, 4, 9, 16, 21].map((n, i) => generate(n, 92000 + i, { noFallback: true, maxAttempts: 500 }).level);
fs.writeFileSync(path.join(__dirname, '../src/generation/fallbacks.js'), "'use strict';\n// Verified fallback layouts; do not regenerate on restart.\nmodule.exports=" + JSON.stringify(levels, null, 2) + ';\n');
console.log(levels.map(l => ({ number: l.number, arrows: l.arrows.length })));
