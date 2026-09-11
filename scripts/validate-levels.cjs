'use strict';
const fs = require('node:fs'), path = require('node:path');
const { performance } = require('node:perf_hooks');
const { generate } = require('../src/generation/generator');
const { Session } = require('../src/domain/session');
const { CONFIG, profileIndex } = require('../src/config');
function validateBatch(count = 200) {
    const report = { countPerTier: count, total: 0, failures: [], tiers: [] };
    for (const n of [2, 4, 9, 16, 21]) {
        const rows = [];
        for (let i = 0; i < count; i++) {
            const seed = 110000 + n * 1000 + i, t = performance.now();
            try {
                const r = generate(n, seed);
                const elapsed = performance.now() - t;
                if (!r.validation.valid)
                    throw new Error('Invalid layout');
                // Execute the independently computed solution through the real session rules.
                const s = new Session(r.level);
                for (const id of r.validation.sequence) {
                    if (s.click(id).type !== 'allowed')
                        throw new Error('Solution disagrees with session');
                    s.tick(10000);
                }
                if (s.state !== 'won' || s.remaining !== 0)
                    throw new Error('Not cleared');
                rows.push({ ms: elapsed, attempts: r.attempts, fallback: r.fallback, ...r.validation.metrics });
                report.total++;
            }
            catch (e) {
                report.failures.push({ number: n, seed, error: e.message });
            }
        }
        const mean = k => rows.reduce((sum, r) => sum + r[k], 0) / rows.length, sorted = rows.map(r => r.ms).sort((a, b) => a - b);
        report.tiers.push({ name: CONFIG.profiles[profileIndex(n)].name, number: n, samples: rows.length, fallbacks: rows.filter(r => r.fallback).length, meanAttempts: mean('attempts'), meanMs: mean('ms'), p95Ms: sorted[Math.floor(sorted.length * .95)], maxMs: sorted.at(-1), minFill: Math.min(...rows.map(r => r.fill)), maxFill: Math.max(...rows.map(r => r.fill)), meanDepth: mean('depth'), meanOpenRatio: mean('openRatio') });
    }
    fs.mkdirSync(path.join(__dirname, '../reports'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../reports/generation.json'), JSON.stringify(report, null, 2));
    return report;
}
if (require.main === module) {
    const r = validateBatch();
    console.log(JSON.stringify(r, null, 2));
    if (r.failures.length)
        process.exitCode = 1;
}
module.exports = { validateBatch };
