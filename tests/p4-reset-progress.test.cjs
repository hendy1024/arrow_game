'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { Controller } = require('../src/ui/controller');
const { fakePlatform } = require('./helpers.cjs');
const { bindPersistence, KEY, BACKUP, decode } = require('../src/persistence/store');
const { generate } = require('../src/generation/generator');
const make = () => new Controller(Object.assign(fakePlatform(),{isTrial:true}), { generate: async (n, s) => generate(n, s) });

test('P4 首页直接重置：取消回首页且各尺寸按钮可点、不重叠', () => {
    const { View } = require('../src/ui/view');
    const a = make(), view = new View(a.platform.ctx);
    a.currentLevel = 9;
    for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
        view.render(a, { width, height, safeTop: 24, menuBottom: 54, safeBottom: 24 });
        const reset = view.buttons.find(b => b.id === 'reset-progress-ask');
        assert.ok(reset && reset.height >= 44);
        assert.equal(view.hitButton(reset.x + reset.width / 2, reset.y + reset.height / 2), reset.id);
        for (const b of view.buttons) {
            assert.ok(b.x >= 0 && b.x + b.width <= width && b.y + b.height <= height - 24);
            if (b !== reset) assert.ok(b.x + b.width <= reset.x || b.x >= reset.x + reset.width || b.y + b.height <= reset.y || b.y >= reset.y + reset.height);
        }
    }
    a.action('reset-progress-ask'); assert.equal(a.modal, 'reset-progress');
    a.action('reset-progress-cancel'); assert.equal(a.modal, null); assert.equal(a.currentLevel, 9);
    a.action('reset-progress-ask'); a.action('reset-progress-confirm');
    assert.equal(a.currentLevel, 1); assert.equal(a.screen, 'home');
});

test('P4 取消重置保留棋盘和关卡，确认重置清除主备进度并保留偏好', async () => {
    const data = new Map(), storage = { get: k => data.get(k), set: (k, v) => data.set(k, v) };
    const a = make(); bindPersistence(a, storage);
    await a.start(9); a.action('life-accept'); a.unlocked = 10; a.settings.sound = false; a.tutorialDone = true;
    a.action('pause'); a.action('settings');
    const view = new (require('../src/ui/view').View)(a.platform.ctx);
    view.render(a, a.platform.info());
    assert.deepEqual(view.buttons.map(b => b.id), ['music', 'sound', 'vibration', 'settings-done']);
    a.action('reset-progress-ask'); assert.equal(a.modal, 'settings');
    a.action('settings-done'); a.action('home');
    const previous = JSON.stringify(a.session.level);
    a.action('reset-progress-ask');
    assert.equal(a.clickArrow('a0').type, 'locked');
    a.action('reset-progress-cancel');
    assert.equal(a.modal, null); assert.equal(a.currentLevel, 9);
    assert.equal(JSON.stringify(a.session.level), previous);
    a.action('reset-progress-ask'); a.action('reset-progress-confirm');
    for (const key of [KEY, BACKUP]) {
        const saved = decode(data.get(key));
        assert.equal(saved.currentLevel, 1); assert.equal(saved.unlocked, 1);
        assert.equal(saved.session, null); assert.equal(saved.settings.sound, false);
        assert.equal(saved.tutorialDone, false); assert.equal(saved.lifeIntroDone, false);
    }
    const restored = make(); bindPersistence(restored, storage);
    assert.equal(restored.currentLevel, 1); assert.equal(restored.session, null);
    await restored.action('start'); assert.equal(restored.tutorialStep, 1);
    assert.equal(restored.session.level.arrows.length, 3);
});

test('P4 首页可重置，未经确认的重置动作无效，保存失败可重试', () => {
    const data = new Map(); let fail = false;
    const a = make(); bindPersistence(a, { get: k => data.get(k), set: (k, v) => { if (fail) throw Error('storage full'); data.set(k, v); } });
    a.currentLevel = a.unlocked = 8;
    a.action('reset-progress-confirm'); assert.equal(a.currentLevel, 8);
    a.action('settings'); a.action('reset-progress-ask');
    assert.equal(a.modal, 'settings');
    a.action('settings-done'); a.action('reset-progress-ask');
    fail = true; a.action('reset-progress-confirm'); assert.equal(a.savedError, true);
    fail = false; a.action('retry-save'); assert.equal(a.savedError, false);
    assert.equal(decode(data.get(KEY)).currentLevel, 1);
});

