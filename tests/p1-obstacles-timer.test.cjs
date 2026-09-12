'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { Session } = require('../src/domain/session');
const { fixtures } = require('../src/fixtures');
const { validateLevel } = require('../src/domain/board');
const { solve } = require('../src/generation/validate');
const { obstacleCount, timeLimit } = require('../src/config');
const { snapshot, restore, createStore } = require('../src/persistence/store');
const { Controller } = require('../src/ui/controller');
const { fakePlatform } = require('./helpers.cjs');
test('P1 障碍从15关、计时从20关引入并逐档收紧有下限', () => {
    assert.equal(obstacleCount(14), 0); assert.equal(obstacleCount(15), 1); assert.equal(obstacleCount(20), 2); assert.equal(obstacleCount(100), 4);
    assert.equal(timeLimit(19), null); assert.equal(timeLimit(20), 180000); assert.equal(timeLimit(24), 180000); assert.equal(timeLimit(25), 170000); assert.equal(timeLimit(100), 120000);
});
test('P1 永久石块阻挡扣次数且求解器拒绝死局，非法石块拒绝', () => {
    const level = { ...fixtures.tutorial, lifeLimit: 3, obstacles: [[5, 0]] };
    const a = level.arrows[0], head = a.path.at(-1);
    const d = require('../src/domain/board').DIRS[a.direction];
    level.obstacles = [[head[0] + d[0], head[1] + d[1]]];
    assert.ok(validateLevel(level).valid);
    const s = new Session(level); assert.equal(s.click(a.id).type, 'blocked'); assert.equal(s.lives, 2);
    assert.equal(solve(level).valid, false);
    assert.equal(validateLevel({ ...level, obstacles: [a.path[0]] }).valid, false);
    assert.equal(validateLevel({ ...level, obstacles: [[99, 99]] }).valid, false);
});
test('P1 暂停冻结倒计时，超时后无法胜利，重试恢复时间与次数', () => {
    const s = new Session({ ...fixtures.tutorial, timeLimitMs: 1000, lifeLimit: 3 });
    s.tick(250); s.pause(); s.tick(5000); assert.equal(s.remainingMs, 750); s.resume();
    s.click('first'); s.tick(750); assert.equal(s.state, 'failed'); assert.equal(s.failureReason, 'timeout');
    s.tick(10000); assert.equal(s.state, 'failed'); assert.equal(s.click('second').type, 'locked');
    const r = s.restart(); assert.equal(r.remainingMs, 1000); assert.equal(r.lives, 3);
});
test('P1 大帧间隔内先清空即胜利，不被帧末超时覆盖', () => {
    const s = new Session({ ...fixtures.boundary, timeLimitMs: 5000 });
    s.click('a'); s.tick(10000); assert.equal(s.state, 'won'); assert.ok(s.remainingMs > 0);
});
test('P1 倒计时与超时失败存档往返，不恢复时间或丢失失败原因', () => {
    const a = new Controller(fakePlatform()); a.session = new Session({ ...fixtures.tutorial, timeLimitMs: 1000, lifeLimit: 3 });
    a.session.tick(400); const b = new Controller(fakePlatform()); restore(b, snapshot(a)); assert.equal(b.session.remainingMs, 600);
    a.session.tick(600); const saved = snapshot(a), values = new Map();
    const store = createStore({ get: k => values.get(k), set: (k, v) => values.set(k, v) });
    store.save(saved); restore(b, store.load().data); assert.equal(b.session.state, 'failed'); assert.equal(b.session.failureReason, 'timeout');
});
