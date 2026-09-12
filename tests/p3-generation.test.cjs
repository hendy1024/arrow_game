'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { generate, generateAsync, acceptable } = require('../src/generation/generator');
const { solve } = require('../src/generation/validate');
const { fixtures, level, arrow } = require('../src/fixtures');
const { CONFIG, profileIndex } = require('../src/config');
test('P3 独立验证器识别循环死锁并给出剩余集合', () => { const r = solve(fixtures.cycle); assert.equal(r.valid, false); assert.ok(r.errors.includes('unsolvable')); assert.equal(r.remaining.length, 4); });
test('P3 验证器拒绝自身堵塞和重叠', () => { assert.equal(solve(fixtures.selfBlocked).valid, false); assert.equal(solve(level([arrow('a', [[0, 0], [1, 0]], 'right'), arrow('b', [[1, 1], [1, 0]], 'up')])).valid, false); });
test('P3 相同种子与版本精确复现，不同种子产生不同布局', () => { assert.deepEqual(generate(9, 51), generate(9, 51)); assert.notDeepEqual(generate(9, 51).level.arrows, generate(9, 52).level.arrows); });
test('P3 预算耗尽使用同难度、已验证的保底布局', () => { for (const n of [1, 2, 3, 8, 13, 18, 21]) {
    const r = generate(n, 17, { maxAttempts: 0, forceRandom: true });
    assert.equal(r.fallback, true);
    assert.ok(r.validation.valid);
    assert.ok(acceptable(r.validation.metrics, CONFIG.profiles[profileIndex(n)]));
    assert.equal(r.level.lifeLimit, n >= 3 ? 3 : null);
    assert.equal(r.level.profileVersion, CONFIG.profileVersion);
} });
test('P3 异步生成让出主循环且结果与同步一致', async () => { let yields = 0; const a = await generateAsync(9, 671, { schedule: fn => { yields++; setImmediate(fn); } }); assert.ok(yields > 0); assert.deepEqual(a, generate(9, 671)); });
test('P3 教学目标存在且可移除', () => { const r = generate(1, 22); assert.equal(r.validation.sequence[0], 'first'); assert.equal(r.level.arrows.length, 3); });
test('P3 六个难度档各200种子，至少1200关经独立求解及实际会话清空', { timeout: 120000 }, () => { const report = require('../scripts/validate-levels.cjs').validateBatch(200); assert.deepEqual(report.failures, []); assert.equal(report.total, 1200); assert.equal(report.tiers.length, 6); });



