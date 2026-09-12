'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { generate } = require('../src/generation/generator');
const { obstacleCount, timeLimit, CONFIG } = require('../src/config');
const { Session } = require('../src/domain/session');
const { completionDistance } = require('../src/movement/path');
test('P3 障碍与限时边界各20种子及强制保底均铺满、可在限时内实际清空', () => {
    for (const n of [14, 15, 19, 20, 24, 25, 30, 50, 100]) for (let seed = 0; seed < 20; seed++) {
        const r = generate(n, seed + 18200, seed === 0 ? { maxAttempts: 0 } : {});
        assert.equal((r.level.obstacles || []).length, obstacleCount(n));
        assert.equal(r.level.timeLimitMs, timeLimit(n));
        assert.equal(r.validation.metrics.fill, 1);
        const s = new Session(r.level);
        for (const id of r.validation.sequence) {
            assert.equal(s.click(id).type, 'allowed');
            s.tick(completionDistance(r.level.arrows.find(a => a.id === id), r.level) * 1000 / CONFIG.speed + .001);
        }
        assert.equal(s.state, 'won', n + ':' + seed);
    }
});
