'use strict';
const fs = require('node:fs'), path = require('node:path');
const { profile } = require('../src/race/course');
const { VERSION } = require('../src/race/rules');
const { candidate, acceptable } = require('../src/generation/generator');
const { random } = require('../src/generation/random');
const { solve } = require('../src/generation/validate');
function matches(level, p) {
    if (!level || level.width !== p.size || level.height !== p.size || level.arrows.some(a => a.path.length > p.maxLength)) return false;
    const v = solve(level);
    return v.valid && acceptable(v.metrics, p);
}
function prepare() {
    const outputs = [];
    for (const kind of ['daily', 'weekly']) {
        const file = path.resolve(__dirname, '../src/race/' + (kind === 'daily' ? 'daily-fallbacks' : 'fallbacks') + '.js');
        const old = require(file), levels = [];
        for (let n = 1; n <= 5; n++) {
            const p = profile(n, kind);
            let level = matches(old[n - 1], p) ? old[n - 1] : null;
            for (let attempt = 0; !level && attempt < 2000; attempt++) {
                const seed = (VERSION + n * 2000 + attempt) >>> 0;
                const task = candidate(3, seed, p, random(seed)); let r;
                do { r = task.next(); } while (!r.done);
                if (matches(r.value, p)) level = r.value;
            }
            if (!level) throw Error(kind + ' 第' + n + '关配置过于苛刻，无法生成符合条件的可解棋盘，请降低 minDepth/minArrows 或增大 maxLength/maxInitialOpen');
            levels.push({ ...level, number: n, lifeLimit: null, timeLimitMs: null, raceVersion: VERSION });
        }
        outputs.push([file, "'use strict';\nmodule.exports=" + JSON.stringify(levels) + ';\n']);
    }
    for (const [file, source] of outputs) if (fs.readFileSync(file, 'utf8') !== source) fs.writeFileSync(file, source);
}
module.exports = { prepare, matches };
