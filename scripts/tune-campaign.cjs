'use strict';
const fs = require('node:fs'), path = require('node:path');
const { denseCandidate } = require('../src/generation/dense');
const { random } = require('../src/generation/random');
const { solve } = require('../src/generation/validate');
const root = path.resolve(__dirname, '..');
const levels = JSON.parse(fs.readFileSync(path.join(root, 'config/campaign-levels.json'))).slice(0, 20);
const tiers = require('../config/campaign-pacing.json');
const report = [];
for (const row of levels) {
    const p = tiers.find(t => row.id >= t.from && row.id <= t.to);
    if (!p) continue;
    const rng = random(910000 + row.id), size = p.size || row.board.width;
    let chosen;
    for (let attempt = 1; attempt <= 12000; attempt++) {
        const x = 2 + Math.floor(rng() * (size - 7)), y = 2 + Math.floor(rng() * (size - 7));
        const obstacles = Array.from({ length: p.obstacles }, (_,i) => [x + i % 3, y + Math.floor(i / 3)]);
        const level = { ...row.board, width: size, height: size, lifeLimit: 3, arrows: [], obstacles, timeLimitMs: p.timeSeconds === null ? null : p.timeSeconds * 1000 };
        const task = denseCandidate(level, { maxLength: p.maxLength }, rng); let r;
        do { r = task.next(); } while (!r.done);
        const v = solve(r.value);
        if (v.valid && v.metrics.fill === 1 && v.metrics.initialOpen === 1 && v.metrics.depth >= p.minDepth && v.metrics.depth <= p.minDepth + 3 && v.metrics.averageLength >= (p.minAverageLength || 0) && Math.max(...r.value.arrows.map(a => a.path.length)) >= p.maxLength * .65) {
            chosen = r.value; report.push({ number: row.id, attempts: attempt, ...v.metrics, obstacles: p.obstacles, seconds: p.timeSeconds }); break;
        }
    }
    if (!chosen) throw Error('无法满足第' + row.id + '关的目标，原配置未改动');
    row.board = chosen;
    if (true) console.log('已验证至第 ' + row.id + ' 关');
}
require('./check-campaign.cjs').check(levels);
fs.writeFileSync(path.join(root, 'config/campaign-levels.json'), '[\n' + levels.map(r => JSON.stringify(r)).join(',\n') + '\n]\n');
fs.writeFileSync(path.join(root, 'reports/campaign-pacing.json'), JSON.stringify(report, null, 2));
console.log('已保存全部固定关卡，奖励保持原配置');
