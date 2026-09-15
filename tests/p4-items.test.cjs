'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { Controller } = require('../src/ui/controller');
const { Session } = require('../src/domain/session');
const { fixtures } = require('../src/fixtures');
const { generate } = require('../src/generation/generator');
const { solve } = require('../src/generation/validate');
const { snapshot, restore, createStore } = require('../src/persistence/store');
const { fakePlatform } = require('./helpers.cjs');
function make() { return new Controller(fakePlatform(), { challengeVisible:true, generate: async (n, s) => generate(n, s) }); }
test('P4 挑战20关解锁，19关通关提示且确认后不重复', () => {
    const a = make(); a.action('challenge'); assert.equal(a.modal, 'rush-locked'); assert.equal(a.session, null); a.action('rush-notice-close');
    a.session = new Session({ ...fixtures.boundary, number: 19 }); a.screen = 'game'; a.currentLevel = 19; a.unlocked = 19;
    a.clickArrow('a'); a.tick(1000); assert.equal(a.unlocked, 20); assert.equal(a.modal, 'reward-items');assert.deepEqual(a.rewardPopup.items,{time:1,life:2,shuffle:1});a.action('reward-close'); assert.equal(a.modal, 'rush-unlocked');
    a.action('rush-notice-close'); assert.equal(a.modal, 'won'); assert.equal(a.challengeUnlockSeen, true);
    const b = make(); restore(b, snapshot(a)); assert.equal(b.modal, null); assert.equal(b.challengeUnlockSeen, true);
});
test('P4 道具共用10个库存，连续加时加命持久化、重载不补库存', async () => {
    const a = make(); await a.start(25); a.action('life-accept'); a.session.tick(1000);
    a.action('items'); const before = a.session.remainingMs; a.tick(5000); assert.equal(a.session.remainingMs, before);
    a.action('item-time'); a.action('item-time'); assert.equal(a.session.remainingMs, a.session.level.timeLimitMs);
    a.action('item-life'); a.action('item-life'); assert.equal(a.session.lives, 3);
    assert.deepEqual(a.inventory, { time: 8, life: 8, shuffle: 10 });
    const values = new Map(), store = createStore({ get: k => values.get(k), set: (k, v) => values.set(k, v) }); store.save(snapshot(a));
    const b = make(); restore(b, store.load().data); assert.equal(b.session.items.time, 0); assert.equal(b.session.items.life, 0); assert.equal(b.session.lives, 3); assert.deepEqual(b.inventory, a.inventory);
});
test('P4 旧版重排兼容保留剩余数量和资源且可解，重复请求不多扣，重试恢复原关', async () => {
    const a = make(); await a.start(25); a.action('life-accept');
    const original = JSON.stringify(a.session.level), sequence = solve(a.session.level).sequence;
    for (const id of sequence.slice(0, 5)) { a.clickArrow(id); a.tick(3000); }
    const remaining = a.session.remaining, time = a.session.remainingMs, lives = a.session.lives;
    a.action('items'); const task = a.shuffle(); a.action('item-shuffle'); await task;
    assert.equal(a.session.remaining, remaining); assert.equal(a.session.remainingMs, time); assert.equal(a.session.lives, lives);
    assert.equal(a.session.items.shuffle, 0); assert.equal(a.inventory.shuffle, 9); assert.ok(solve(a.session.level).valid); assert.notEqual(JSON.stringify(a.session.level), original);
    const b = make(); restore(b, snapshot(a)); assert.equal(b.session.remaining, remaining); assert.equal(b.session.items.shuffle, 0);
    assert.equal(JSON.stringify(b.session.restart().level), original);
    assert.equal(b.session.restart().items.shuffle, 1); assert.equal(b.inventory.shuffle, 9);
});
test('P4 重排生成失败仍有同数量可解保底，移动和终态禁止道具', async () => {
    const a = make(); await a.start(3); a.action('life-accept'); const id = solve(a.session.level).sequence[0];
    a.clickArrow(id); a.action('items'); assert.equal(a.modal, null);
    a.tick(3000); const remaining = a.session.remaining;
    a.generate = async () => { throw Error('injected'); };
    a.action('items'); await a.shuffle();
    assert.equal(a.session.remaining, remaining); assert.ok(solve(a.session.level).valid);
    a.action('item-time'); assert.equal(a.session.items.time, 1);
    a.action('items-done'); a.session.state = 'failed'; a.modal = 'failed'; a.action('items'); assert.equal(a.modal, 'failed');
});
