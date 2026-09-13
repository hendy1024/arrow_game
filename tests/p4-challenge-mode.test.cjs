'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { Controller } = require('../src/ui/controller');
const { Session } = require('../src/domain/session');
const { generate } = require('../src/generation/generator');
const { fakePlatform } = require('./helpers.cjs');
const { bindPersistence, snapshot, createStore } = require('../src/persistence/store');
function make() { const a = new Controller(fakePlatform(), { generate: async (n, s) => generate(n, s) }); a.unlocked = 20; a.challengeUnlockSeen = true; return a; }
test('P4 挑战90秒高难度，返回与重载均保留普通闯关存档', async () => {
    const values = new Map(), storage = { get: k => values.get(k), set: (k, v) => values.set(k, v) };
    const a = make(); bindPersistence(a, storage);
    await a.start(3); a.action('life-accept'); a.unlocked = 20;
    a.action('pause'); a.action('home'); const original = snapshot(a);
    const starting = a.action('challenge'); a.action('challenge'); await starting;
    assert.equal(a.mode, 'challenge'); assert.equal(a.modal, 'rush-ready');
    assert.equal(a.session.level.width, 20); assert.equal(a.session.level.obstacles.length, 4);
    a.tick(5000); assert.equal(a.session.remainingMs, 90000);
    a.action('rush-accept'); a.tick(90000); assert.equal(a.modal, 'time-rescue'); a.action('time-rescue-decline'); assert.equal(a.modal, 'failed');
    assert.equal(a.session.failureReason, 'timeout');
    assert.deepEqual(createStore(storage).load().data, original);
    const b = make(); bindPersistence(b, storage); assert.equal(b.mode, 'campaign'); assert.equal(b.currentLevel, 3);
    a.action('restart'); assert.equal(a.session.remainingMs, 90000); assert.equal(a.session.lives, 3);
    a.action('home'); assert.equal(a.mode, 'campaign'); assert.deepEqual(snapshot(a), original);
});
test('P4 首次进入挑战不跳普通教学，设置偏好保留，生成失败能返回', async () => {
    const a = make(); await a.action('challenge'); a.action('rush-accept'); a.action('pause'); a.action('settings'); a.action('sound');
    a.action('reset-progress-ask'); assert.equal(a.modal, 'settings');
    a.action('settings-done'); a.action('home');
    assert.equal(a.currentLevel, 1); assert.equal(a.session, null); assert.equal(a.settings.sound, false); assert.equal(a.tutorialDone, false);
    a.generate = async () => { throw Error('injected'); }; await a.action('challenge'); assert.equal(a.loadError, true);
    a.action('home'); assert.equal(a.mode, 'campaign'); assert.equal(a.currentLevel, 1);
});
test('P4 挑战随机棋盘可在90秒内清空，胜利不解锁普通关卡', async () => {
    for (const seed of [51, 671, 19300]) {
        const a = make(); a.platform.seed = () => seed; await a.action('challenge'); a.action('rush-accept');
        for (let frame = 0; frame < 900 && a.session.state === 'playing'; frame++) {
            for (const arrow of a.session.level.arrows) if (a.session.classify(arrow.id).type === 'allowed') a.clickArrow(arrow.id);
            a.tick(100);
        }
        assert.equal(a.session.state, 'won'); assert.equal(a.unlocked, 20); assert.ok(a.session.remainingMs > 0);
        await a.action('next'); assert.equal(a.modal, 'rush-ready'); assert.equal(a.session.remainingMs, 90000);
    }
});

