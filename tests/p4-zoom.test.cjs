'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { mount } = require('../src/runtime');
const { generate } = require('../src/generation/generator');
const { fakePlatform } = require('./helpers.cjs');
const { hitArrow } = require('../src/input/pointer');

test('P4 最大棋盘放大拖动不消除不扣次数，区域外不命中，点击映射正确', async () => {
    const platform = fakePlatform();
    platform.info = () => ({ width: 320, height: 568, safeTop: 24, safeBottom: 24, menuBottom: 54 });
    const game = mount(platform, { generate: async (n, s) => generate(n, s) });
    await game.app.start(18); game.app.action('life-accept'); game.render();
    const h = platform.callbacks, click = (x, y) => { h.start(1, x, y, 1); h.end(1, x, y); };
    const zoom = () => { const b = game.view.buttons.find(b => b.id === 'zoom-in'); click(b.x + b.width / 2, b.y + b.height / 2); };
    zoom(); zoom(); assert.equal(game.view.camera.zoom, 3);
    const r = game.view.camera.rect, cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    h.start(2, cx, cy, 1); h.move(2, cx + 40, cy + 50, 1); h.end(2, cx + 40, cy + 50);
    assert.equal(game.app.session.lives, 3); assert.equal(game.app.session.moves.size, 0);
    assert.notEqual(game.view.camera.x, 0);
    click(1, cy); assert.equal(game.app.session.lives, 3);
    for (const a of game.app.session.level.arrows) {
        const t = game.view.transform, p = t.toScreen(a.path.at(-1));
        game.view.camera.pan(cx - p[0], cy - p[1]); game.render();
        const point = game.view.transform.toScreen(a.path.at(-1));
        assert.ok(game.view.camera.contains(...point));
        for (const [dx, dy] of [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]])
            assert.equal(hitArrow(game.app.session.level, game.view.transform.toBoard([point[0] + dx, point[1] + dy])), a.id);
    }
    const id = game.app.session.level.arrows.find(a => game.app.session.classify(a.id).type === 'allowed').id;
    const a = game.app.session.level.arrows.find(a => a.id === id), p = game.view.transform.toScreen(a.path.at(-1));
    game.view.camera.pan(cx - p[0], cy - p[1]); game.render();
    click(...game.view.transform.toScreen(a.path.at(-1)));
    assert.ok(game.app.session.moves.has(id)); assert.equal(game.app.session.lives, 3);
    const b = game.view.buttons.find(b => b.id === 'zoom-reset'); click(b.x + b.width / 2, b.y + b.height / 2);
    assert.equal(game.view.camera.zoom, 1); assert.equal(game.view.camera.x, 0);
    game.stop();
});
