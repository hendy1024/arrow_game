'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { Session } = require('../src/domain/session');
const { fixtures, level, arrow } = require('../src/fixtures');
const { bodyAt, completionDistance, occupiedByBody } = require('../src/movement/path');
const { hitArrow, Pointer } = require('../src/input/pointer');
test('P2 长折线推进一格，尾部按旧路径收走而非整体平移', () => {
    const a = fixtures.bent.arrows[0];
    assert.deepEqual(bodyAt(a, 1), [[1, 3], [2, 3], [3, 3], [3, 2], [3, 1]]);
    assert.deepEqual(bodyAt(a, .5), [[1, 3.5], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1.5]]);
});
test('P2 尾部实际出界前不消除，出界后仅一次', () => {
    const s = new Session(fixtures.bent), end = completionDistance(s.level.arrows[0], s.level);
    s.click('bend');
    s.tick((end - .01) / s.moves.get('bend').speed * 1000);
    assert.equal(s.remaining, 1);
    s.tick(2);
    assert.equal(s.remaining, 0);
    s.tick(9999);
    assert.equal(s.drainEvents().filter(e => e.type === 'removed').length, 1);
});
test('P2 不同帧率相同时间产生相同位置', () => {
    const a = new Session(fixtures.bent), b = new Session(fixtures.bent);
    a.click('bend');
    b.click('bend');
    for (let i = 0; i < 30; i++)
        a.tick(5);
    for (let i = 0; i < 6; i++)
        b.tick(25);
    assert.ok(Math.abs(a.moves.get('bend').distance - b.moves.get('bend').distance) < 1e-10);
});
test('P2 当前尾部占用在离开前保留，离开后释放', () => {
    const a = fixtures.bent.arrows[0];
    assert.equal(occupiedByBody(a, .1, fixtures.bent).has('1,4'), true);
    assert.equal(occupiedByBody(a, .3, fixtures.bent).has('1,4'), false);
});
test('P2 互不影响的箭头允许同时移动', () => { const s = new Session(fixtures.tutorial); assert.equal(s.click('first').type, 'allowed'); assert.equal(s.click('third').type, 'allowed'); assert.equal(s.moves.size, 2); s.tick(1000); assert.equal(s.remaining, 1); });
test('P2 交叉出口预留阻止后续移动且不扣生命', () => {
    const s = new Session(level([arrow('a', [[0, 2], [1, 2]], 'right'), arrow('b', [[3, 5], [3, 4]], 'up')], { lifeLimit: 3 }));
    assert.equal(s.click('a').type, 'allowed');
    assert.equal(s.click('b').type, 'temporary');
    assert.equal(s.lives, 3);
    s.tick(1000);
    assert.equal(s.click('b').type, 'allowed');
});
test('P2 移动身体临时阻挡不扣生命，释放后可以移动', () => { const s = new Session({ ...fixtures.tutorial, lifeLimit: 3 }); s.click('first'); assert.equal(s.click('second').type, 'temporary'); s.tick(500); assert.equal(s.click('second').type, 'allowed'); assert.equal(s.lives, 3); });
test('P2 暂停期间移动冻结，恢复仅推进实际游戏时间', () => { const s = new Session(fixtures.bent); s.click('bend'); s.tick(50); s.pause(); s.tick(10000); assert.equal(s.moves.get('bend').distance, 1.4); s.resume(); s.tick(50); assert.equal(s.moves.get('bend').distance, 2.8); });
test('P2 头部、身体、扩展命中及最近目标', () => { const l = level([arrow('a', [[0, 1], [1, 1], [2, 1]], 'right'), arrow('b', [[0, 2], [1, 2]], 'right')]); assert.equal(hitArrow(l, [.5, 1.2]), 'a'); assert.equal(hitArrow(l, [2, 1]), 'a'); assert.equal(hitArrow(l, [.5, 1.8]), 'b'); assert.equal(hitArrow(l, [5, 5]), null); assert.equal(hitArrow(l, [.5, 1], new Set(['a'])), null); });
test('P2 手指滑动、离开再回来、触摸取消与多点不提交', () => {
    const p = new Pointer();
    p.start(1, 10, 10);
    assert.deepEqual(p.end(1, 12, 12), [12, 12]);
    assert.equal(p.end(1, 12, 12), null);
    p.start(1, 10, 10);
    p.move(1, 50, 10);
    assert.equal(p.end(1, 10, 10), null);
    p.start(1, 10, 10);
    p.start(2, 10, 10, 2);
    assert.equal(p.end(1, 10, 10), null);
    p.start(1, 10, 10);
    p.cancel();
    assert.equal(p.end(1, 10, 10), null);
});

test('P2 四方向距离出口越远越快，贴边24格/秒，远8格40格/秒', () => {
    const pairs = {
        right: [[[18,1],[19,1]], [[10,1],[11,1]]],
        left: [[[1,1],[0,1]], [[9,1],[8,1]]],
        up: [[[1,1],[1,0]], [[1,9],[1,8]]],
        down: [[[1,18],[1,19]], [[1,10],[1,11]]]
    };
    for (const [direction, paths] of Object.entries(pairs)) {
        const sessions = paths.map(path => new Session(level([arrow('a', path, direction)], { width: 20, height: 20 })));
        for (const s of sessions) { assert.equal(s.click('a').type, 'allowed'); s.tick(20); }
        assert.equal(sessions[0].moves.get('a').speed, 24);
        assert.equal(sessions[1].moves.get('a').speed, 40);
        assert.equal(sessions[0].moves.get('a').distance, .48);
        assert.equal(sessions[1].moves.get('a').distance, .8);
        const far = sessions[1]; far.tick(100); assert.equal(far.moves.get('a').speed, 40);
    }
});

test('P2 远箭头提速后按实际出界时刻赢过倒计时，不提前消除', () => {
    const s = new Session(level([arrow('a', [[10,1],[11,1]], 'right')], { width: 20, height: 20, timeLimitMs: 300 }));
    s.click('a'); s.tick(241); assert.equal(s.remaining, 1);
    s.tick(1000); assert.equal(s.state, 'won'); assert.equal(s.remaining, 0);
    assert.ok(Math.abs(s.remainingMs - 58.5) < 1e-8);
});

test('P2 扩大点击容错且选择最近箭头，边界外与已消除箭头不误触',()=>{
 const l=level([arrow('a',[[0,1],[2,1]],'right'),arrow('b',[[0,2],[2,2]],'right')]);
 assert.equal(hitArrow(l,[.5,1.45]),'a');assert.equal(hitArrow(l,[.5,1.55]),'b');
 assert.equal(hitArrow(l,[.5,.51]),null);assert.equal(hitArrow(l,[.5,1.45],new Set(['a'])),null);
});
