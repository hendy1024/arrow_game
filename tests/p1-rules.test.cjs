'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { arrow, level, fixtures } = require('../src/fixtures');
const { validateLevel, occupancy, firstBlocker, clone } = require('../src/domain/board');
const { Session } = require('../src/domain/session');
for (const [direction, path] of Object.entries({ up: [[2, 1], [2, 0]], right: [[4, 2], [5, 2]], down: [[2, 4], [2, 5]], left: [[1, 2], [0, 2]] }))
    test('P1 四方向贴边出口 ' + direction, () => {
        const s = new Session(level([arrow('a', path, direction)]));
        assert.equal(s.click('a').type, 'allowed');
        assert.equal(s.remaining, 1);
        s.complete('a');
        assert.equal(s.state, 'won');
    });
test('P1 远处阻挡仍阻止移动并返回最近位置', () => { const l = fixtures.blocked; assert.deepEqual(firstBlocker(l.arrows[0], l, occupancy(l)), { id: 'b', cell: [4, 2] }); assert.equal(new Session(l).click('a').type, 'blocked'); });
test('P1 折线身体可以阻挡另一条箭头', () => { const s = new Session(fixtures.tutorial); assert.equal(s.click('second').blocker.id, 'first'); });
test('P1 自身挡路和非法路径被拒绝', () => {
    assert.ok(validateLevel(fixtures.selfBlocked).errors.includes('self-blocked'));
    for (const path of [[[1, 1], [2, 2]], [[1, 1], [3, 1]], [[1, 1], [2, 1], [1, 1]], [[5, 0], [6, 0]]])
        assert.equal(validateLevel(level([arrow('a', path, 'right')])).valid, false);
    assert.throws(() => new Session(fixtures.selfBlocked), /Invalid level/);
});
test('P1 交叉重叠、重复 ID 与错误头部方向被拒绝', () => {
    assert.equal(validateLevel(level([arrow('a', [[1, 1], [2, 1]], 'right'), arrow('b', [[2, 0], [2, 1]], 'down')])).valid, false);
    assert.equal(validateLevel(level([arrow('a', [[1, 1], [2, 1]], 'left')])).valid, false);
    const l = clone(fixtures.tutorial);
    l.arrows[1].id = 'first';
    assert.equal(validateLevel(l).valid, false);
});
test('P1 前期无限次错误不扣生命', () => { const s = new Session(fixtures.blocked); for (let i = 0; i < 100; i++) {
    assert.equal(s.click('a').type, 'blocked');
    s.tick(201);
} assert.equal(s.lives, null); assert.equal(s.state, 'playing'); });
test('P1 后期有效错误扣一次，反馈期间不重复扣，耗尽锁定', () => {
    const s = new Session({ ...fixtures.blocked, lifeLimit: 3 });
    for (let i = 0; i < 3; i++) {
        assert.equal(s.click('a').type, 'blocked');
        assert.equal(s.lives, 2 - i);
        for (let j = 0; j < 10; j++)
            s.click('a');
        assert.equal(s.lives, 2 - i);
        s.tick(201);
    }
    assert.equal(s.state, 'failed');
    assert.equal(s.click('b').type, 'locked');
    assert.equal(s.drainEvents().filter(e => e.type === 'failed').length, 1);
});
test('P1 空白、不存在与移动中目标不扣生命', () => { const s = new Session({ ...fixtures.blocked, lifeLimit: 3 }); assert.equal(s.click(null).type, 'empty'); assert.equal(s.click('missing').type, 'empty'); s.click('b'); assert.equal(s.click('b').type, 'moving'); assert.equal(s.lives, 3); });
test('P1 重复完成回调不会重复计数或重复通关', () => { const s = new Session(fixtures.boundary); assert.equal(s.complete('a'), false); s.click('a'); assert.equal(s.complete('a'), true); assert.equal(s.complete('a'), false); assert.equal(s.remaining, 0); assert.equal(s.drainEvents().filter(e => e.type === 'won').length, 1); });
test('P1 失败优先于进行中移动的完成事件', () => { const s = new Session({ ...fixtures.tutorial, lifeLimit: 1 }); s.click('third'); s.click('second'); assert.equal(s.state, 'failed'); s.complete('third'); assert.equal(s.state, 'failed'); assert.equal(s.drainEvents().filter(e => e.type === 'won').length, 0); });
test('P1 暂停阻止操作并冻结反馈时间', () => { const s = new Session(fixtures.blocked); s.click('a'); s.pause(); s.tick(9999); assert.equal(s.time, 0); assert.equal(s.click('b').type, 'locked'); s.resume(); assert.equal(s.click('a').type, 'feedback'); });
test('P1 重试恢复原布局生命且不修改传入数据', () => { const original = clone(fixtures.blocked); const s = new Session({ ...original, lifeLimit: 3 }); s.click('a'); s.click('b'); s.complete('b'); const r = s.restart(); assert.deepEqual(r.level, s.level); assert.equal(r.lives, 3); assert.equal(r.remaining, 2); assert.deepEqual(original, fixtures.blocked); });
test('P1 损坏的箭头对象和格点返回校验错误而非崩溃', () => { for (const arrows of [[null], [arrow('a', [null, [1, 1]], 'right')], [arrow('a', [[1, 1], null, [1, 2]], 'down')]])
    assert.equal(validateLevel(level(arrows)).valid, false); });
