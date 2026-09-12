'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { generate } = require('../src/generation/generator');
const { CONFIG, profileIndex, lifeLimit } = require('../src/config');

test('P3 20×20密集棋盘在小屏和手机尺寸下每条箭头均可准确选中', () => {
    const { layout } = require('../src/ui/view');
    const { boardTransform } = require('../src/rendering/board');
    const { hitArrow } = require('../src/input/pointer');
    const level = generate(18, 51).level;
    for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
        const t = boardTransform(level, layout({ width, height, safeTop: 24, menuBottom: 54, safeBottom: 24 }).board);
        for (const a of level.arrows) {
            const p = t.toScreen(a.path.at(-1));
            for (const [dx, dy] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]])
                assert.equal(hitArrow(level, t.toBoard([p[0] + dx, p[1] + dy])), a.id);
        }
    }
});

test('P3 教学之后立即提速，各难度边界与生命引入独立', () => {
    for (const [number, size, depth] of [[2, 8, 2], [3, 14, 10], [5, 14, 10], [6, 14, 10], [7, 14, 10], [8, 16, 12], [12, 16, 12], [13, 18, 14], [17, 18, 14], [18, 20, 16], [21, 20, 16], [100, 20, 16]]) {
        for (const seed of [1, 51, 671]) {
            const result = generate(number, seed);
            assert.ok(result.validation.valid);
            assert.equal(result.level.width, size);
            assert.ok(result.validation.metrics.depth >= depth);
            if (number >= 3) {
                assert.equal(result.validation.metrics.fill, 1, '必须铺满棋盘');
                assert.equal(result.validation.metrics.initialOpen, 1, '开局只能有一个出口');
                assert.ok(result.level.arrows.length >= 36);
                const cells = [...result.level.arrows.flatMap(a => a.path.map(p => p.join(','))), ...(result.level.obstacles || []).map(p => p.join(','))];
                assert.equal(new Set(cells).size, size * size);
                assert.equal(cells.length, size * size);
                assert.ok(result.level.arrows.every(a => a.path.length >= 2 && a.path.length <= 9));
            }
            assert.ok(result.validation.metrics.openRatio <= CONFIG.profiles[profileIndex(number)].maxOpenRatio);
            assert.equal(result.level.profileVersion, 8);
            assert.equal(result.level.lifeLimit, number < 3 ? null : 3);
        }
    }
    for (let n = 1; n < 3; n++) assert.equal(lifeLimit(n), null);
    assert.equal(generate(1, 51).level.arrows.length, 3);
});






