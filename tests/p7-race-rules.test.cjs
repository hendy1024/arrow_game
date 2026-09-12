'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { period, seedFor, difficulty, ROUNDS } = require('../src/race/rules');
test('P7 日榜按北京时间午夜切换，周榜按周一午夜切换', () => {
    const before = Date.parse('2026-09-13T15:59:59Z'), after = Date.parse('2026-09-13T16:00:00Z');
    assert.equal(period('daily', before).key, 'daily:2026-09-13');
    assert.equal(period('daily', after).key, 'daily:2026-09-14');
    assert.equal(period('weekly', before).key, 'weekly:2026-09-07');
    assert.equal(period('weekly', after).key, 'weekly:2026-09-14');
    assert.equal(period('weekly', before).endsAt, after);
});
test('P7 同周期同一关种子一致，日周分别固定，十关指数难度增长', () => {
    const day = period('daily', Date.parse('2026-09-12T01:00:00Z')).key;
    const seeds = new Set(); let previous = 0;
    for (let n = 1; n <= ROUNDS; n++) {
        assert.equal(seedFor(day, n), seedFor(day, n)); seeds.add(seedFor(day, n));
        assert.notEqual(seedFor(day, n), seedFor('weekly:2026-09-07', n));
        const p = difficulty(n); assert.ok(p.factor > previous); previous = p.factor;
        assert.equal(p.timeLimitMs, null); assert.ok(p.size <= 20);
        if (n > 1) assert.ok(Math.abs(p.factor / difficulty(n - 1).factor - Math.pow(8, 1 / 9)) < 1e-10);
    }
    assert.equal(seeds.size, 10); assert.equal(difficulty(1).size, 10); assert.equal(difficulty(10).size, 20);
});
