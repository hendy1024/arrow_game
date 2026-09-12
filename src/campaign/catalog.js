'use strict';
const levels = require('../../config/campaign-levels.json');
const names = { time: '加时', life: '容错', shuffle: '重排' };
function entry(number) { return levels[number - 1]; }
function key(board) {
    let n = 2166136261;
    const value = JSON.stringify([board.number, board.width, board.height, board.arrows, board.obstacles || [], board.lifeLimit, board.timeLimitMs ?? null]);
    for (const c of value) { n ^= c.charCodeAt(0); n = Math.imul(n, 16777619); }
    return board.number + ':' + (n >>> 0);
}
function load(number) {
    const row = entry(number);
    if (!row) throw Error('关卡尚未配置');
    return Promise.resolve({ level: { ...JSON.parse(JSON.stringify(row.board)), campaignConfigured: true } });
}
function rewardText(number) {
    return Object.entries(entry(number)?.rewards || {}).map(([k, v]) => names[k] + '道具 ×' + v).join('、') || '本关无道具奖励';
}
function completed(app) {
    const s = app.session, row = entry(s.level.number);
    if (!row) return;
    if (!app.rewardClaims.includes(row.id)) {
        for (const [kind, count] of Object.entries(row.rewards)) app.inventory[kind] += count;
        app.rewardClaims.push(row.id);
        app.rewardNotice = Object.keys(row.rewards).length ? '首次通关奖励：' + rewardText(row.id) : '';
    }
    if (s.recordEligible && s.recordMs > 0 && Object.values(s.itemUses).every(n => n === 0) && key(s.level) === key(row.board)) {
        const id = key(row.board);
        app.levelBests[id] = Math.min(app.levelBests[id] || Infinity, s.recordMs);
    }
}
function activeMs(s, ms) {
    if (s.moves.size === s.remaining && s.remaining > 0) {
        const { completionDistance } = require('../movement/path');
        const finish = Math.max(...[...s.moves].map(([id, m]) => Math.max(0, completionDistance(s.level.arrows.find(a => a.id === id), s.level) * 1000 / m.speed - m.elapsedMs)));
        return Math.min(ms, finish);
    }
    return ms;
}
module.exports = { levels, entry, key, load, rewardText, completed, activeMs };
