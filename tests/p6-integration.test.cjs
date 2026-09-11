'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { createWechatPlatform } = require('../src/platform/wechat'), { fakeWx } = require('./helpers.cjs');
const { Session } = require('../src/domain/session'), { generate } = require('../src/generation/generator');
test('P6 微信平台绑定真实事件形状、DPR及胶囊安全区', () => { const { wx, canvas, handlers } = fakeWx(); const p = createWechatPlatform(wx, { requestAnimationFrame: () => 1, cancelAnimationFrame() { } }); assert.equal(canvas.width, 780); assert.equal(p.info().menuBottom, 48); let received; p.listen({ start(...args) { received = args; }, move() { }, end() { }, cancel() { }, hide() { }, show() { }, resize() { } }); handlers.TouchStart({ touches: [{ identifier: 8, clientX: 55, clientY: 66 }], changedTouches: [{ identifier: 8, clientX: 55, clientY: 66 }] }); assert.deepEqual(received, [8, 55, 66, 1]); p.storage.set('test', 'value'); assert.equal(p.storage.get('test'), 'value'); });
test('P6 微信旧窗口接口和缺失胶囊API可降级', () => { const { wx } = fakeWx(); wx.getSystemInfoSync = wx.getWindowInfo; delete wx.getWindowInfo; delete wx.getMenuButtonBoundingClientRect; const p = createWechatPlatform(wx, { requestAnimationFrame: () => 1, cancelAnimationFrame() { } }); assert.equal(p.info().width, 390); assert.equal(p.info().menuBottom, 0); });
test('P6 30关连续解完，没有死锁或错误扣生命', () => { let removed = 0; for (let n = 1; n <= 30; n++) {
    const r = generate(n, 71000 + n), s = new Session(r.level);
    for (const id of r.validation.sequence) {
        assert.equal(s.click(id).type, 'allowed');
        s.tick(10000);
        removed++;
    }
    assert.equal(s.state, 'won');
    assert.equal(s.remaining, 0);
    assert.equal(s.lives, r.level.lifeLimit);
} assert.ok(removed > 150); });
test('P6 随机并行操作不发生穿越或永久锁死', () => { const { occupiedByBody } = require('../src/movement/path'), { occupancy } = require('../src/domain/board'); for (let seed = 0; seed < 30; seed++) {
    const s = new Session(generate(21, 88000 + seed).level);
    let frames = 0;
    while (s.state !== 'won' && frames++ < 2000) {
        for (const a of s.level.arrows)
            if (s.classify(a.id).type === 'allowed')
                s.click(a.id);
        s.tick(25);
        const used = occupancy(s.level, new Set([...s.removed, ...s.moves.keys()]));
        for (const [id, m] of s.moves)
            for (const cell of occupiedByBody(s.level.arrows.find(a => a.id === id), m.distance, s.level)) {
                assert.ok(!used.has(cell), 'Collision ' + seed + ' ' + cell);
                used.set(cell, id);
            }
    }
    assert.equal(s.state, 'won', 'Seed ' + seed);
} });
test('P6 微信构建无浏览器入口、调试对象及外部依赖，资源齐全', () => { const { build } = require('../scripts/build.cjs'); build(); const source = fs.readFileSync('dist/wechat/game.js', 'utf8'); new vm.Script(source); assert.ok(!source.includes('__arrowDebug')); assert.ok(!source.includes('document.querySelector')); assert.ok(!source.includes('window.localStorage')); for (const kind of ['removed', 'blocked', 'won'])
    assert.ok(fs.statSync('dist/wechat/assets/' + kind + '.wav').size > 44); const cfg = JSON.parse(fs.readFileSync('project.config.json')); assert.equal(cfg.appid, 'wx47e5456f2f4f5ade'); assert.equal(cfg.compileType, 'game'); assert.ok(fs.statSync('dist/wechat/game.js').size < 1024 * 1024); });
