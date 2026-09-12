'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { Controller } = require('../src/ui/controller');
const { View, layout } = require('../src/ui/view');
const { generate } = require('../src/generation/generator'), { Session } = require('../src/domain/session');
const { fixtures } = require('../src/fixtures');
const { fakePlatform } = require('./helpers.cjs');
function make() { return new Controller(fakePlatform(), { generate: (n, s) => Promise.resolve(generate(n, s)) }); }
test('P4 首次首页→教学→消除→通关→下一关流程', async () => { const a = make(); assert.equal(a.screen, 'home'); await a.action('start'); assert.equal(a.tutorialStep, 1); assert.equal(a.clickArrow('second').type, 'tutorial'); a.clickArrow('first'); assert.equal(a.tutorialDone, true); a.tick(1000); a.clickArrow('second'); a.tick(1000); a.clickArrow('third'); a.tick(1000); assert.equal(a.modal, 'won'); assert.equal(a.unlocked, 2); await a.action('next'); assert.equal(a.currentLevel, 2); assert.equal(a.modal, null); });
test('P4 暂停与设置层级正确，弹窗期间棋盘不可操作', async () => { const a = make(); await a.start(); a.action('pause'); assert.equal(a.modal, 'pause'); assert.equal(a.clickArrow('first').type, 'locked'); a.action('settings'); a.action('sound'); assert.equal(a.settings.sound, false); a.action('settings-done'); assert.equal(a.modal, 'pause'); assert.equal(a.session.state, 'paused'); a.action('resume'); assert.equal(a.session.state, 'playing'); });
test('P4 重开有确认，取消继续；确认同布局重置', async () => { const a = make(); await a.start(); a.clickArrow('first'); a.tick(1000); const before = JSON.stringify(a.session.level); a.action('pause'); a.action('restart-ask'); a.action('restart-cancel'); assert.equal(a.session.remaining, 2); assert.equal(a.session.state, 'playing'); a.action('pause'); a.action('restart-ask'); a.action('restart'); assert.equal(a.session.remaining, 3); assert.equal(JSON.stringify(a.session.level), before); });
test('P4 生命关先说明，确认后失败并同布局重试', async () => { const a = make(); await a.start(3); assert.equal(a.modal, 'life-intro'); assert.equal(a.clickArrow('a0').type, 'locked'); a.action('life-accept'); assert.equal(a.lifeIntroDone, true); const id = a.session.level.arrows.find(x => a.session.classify(x.id).type === 'blocked').id; const before = JSON.stringify(a.session.level); for (let i = 0; i < 3; i++) {
    a.clickArrow(id);
    a.tick(201);
} assert.equal(a.modal, 'failed'); a.action('restart'); assert.equal(a.session.lives, 3); assert.equal(JSON.stringify(a.session.level), before); assert.equal(a.modal, null); });
test('P4 点击下一关重复请求不会跳两关', async () => { const a = make(); a.session = new Session(fixtures.boundary); a.screen = 'game'; a.currentLevel = 1; a.clickArrow('a'); a.tick(1000); const p = a.action('next'); a.action('next'); await p; assert.equal(a.currentLevel, 2); });
test('P4 异步生成失败展示重试且能恢复', async () => { const a = make(); a.generate = () => Promise.reject(new Error('Injected')); await a.start(); assert.equal(a.loadError, true); a.generate = (n, s) => Promise.resolve(generate(n, s)); await a.action('retry-load'); assert.equal(a.loadError, false); assert.ok(a.session); });
test('P4 各手机尺寸棋盘、安全区和所有弹窗按钮不溢出', async () => { const a = make(); await a.start(3); const p = fakePlatform(), v = new View(p.ctx); for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
    const info = { width, height, safeTop: 24, menuBottom: 54, safeBottom: 24 };
    const l = layout(info);
    assert.ok(l.card.y + l.card.height <= l.bottom);
    for (const modal of [null, 'pause', 'restart', 'won', 'failed', 'settings', 'reset-progress', 'life-intro']) {
        a.modal = modal;
        v.render(a, info);
        for (const b of v.buttons) {
            assert.ok(b.x >= 0 && b.y >= l.top, JSON.stringify(b));
            assert.ok(b.x + b.width <= width && b.y + b.height <= height - 24, JSON.stringify({ modal, b, width, height }));
            assert.ok(b.height >= 44);
        }
    }
} });
test('P4 设置关闭返回首页，常态按钮不含提示或撤销', () => { const a = make(), v = new View(a.platform.ctx); a.action('settings'); a.action('settings-done'); assert.equal(a.screen, 'home'); assert.equal(a.modal, null); v.render(a, a.platform.info()); assert.deepEqual(v.buttons.map(x => x.id), ['start', 'settings', 'reset-progress-ask']); });



