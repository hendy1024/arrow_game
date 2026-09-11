'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
const { bundle, build } = require('../scripts/build.cjs');
test('P0 微信入口实际执行并绘制固定棋盘，不依赖 DOM', () => {
    const { wx, ctx, canvas } = require('./helpers.cjs').fakeWx();
    const calls = ctx.calls;
    vm.runInNewContext(bundle('src/main-wechat.js'), { wx, requestAnimationFrame: () => 1, cancelAnimationFrame: () => { } });
    assert.equal(canvas.width, 780);
    assert.ok(calls.filter(x => x[0] === 'stroke').length >= 3);
    assert.ok(calls.some(x => x[0] === 'clip'));
});
test('P0 坐标变换往返且棋盘不超出给定矩形', () => {
    const { boardTransform } = require('../src/rendering/board');
    const t = boardTransform({ width: 6, height: 8 }, { x: 10, y: 20, width: 300, height: 320 });
    assert.deepEqual(t.toBoard(t.toScreen([2, 4])), [2, 4]);
    assert.equal(t.width, 240);
    assert.equal(t.height, 320);
});
test('P0 构建产生正确的微信配置与可执行预览包', () => {
    build();
    assert.equal(JSON.parse(fs.readFileSync('dist/wechat/game.json')).deviceOrientation, 'portrait');
    new vm.Script(fs.readFileSync('dist/wechat/game.js', 'utf8'));
    new vm.Script(fs.readFileSync('dist/preview/game.js', 'utf8'));
    assert.equal(JSON.parse(fs.readFileSync('project.config.json')).compileType, 'game');
});
