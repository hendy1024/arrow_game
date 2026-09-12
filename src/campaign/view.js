'use strict';
const { levels, entry, key, rewardText } = require('./catalog');
function draw(view, app, l, text, colors) {
    const c = view.ctx, page = app.mapPage || 0;
    view.button('map-home', '‹ 首页', 16, l.top, 80, 44);
    text(c, '关卡旅程', l.width / 2, l.top + 22, 22, colors.ink, 'center', 600);
    text(c, '第 ' + (page * 20 + 1) + '—' + Math.min((page + 1) * 20, levels.length) + ' 关 · 点击查看奖励', l.width / 2, l.top + 66, 12, colors.muted, 'center');
    const points = [], rowGap = (l.bottom - l.top - 190) / 4;
    const lanes = [[0,.30,.65,1],[.03,.34,.62,.95],[0,.26,.60,.99],[.05,.37,.68,1],[.01,.29,.63,.96]];
    const bends = [[0,-1,.7,-.3],[.2,.9,-.5,.4],[-.6,.3,-.9,.1],[.8,-.4,.4,-.8],[.1,-.9,.6,0]];
    const bend = Math.max(0, Math.min(18, (rowGap - 46) / 2));
    for (let i = 0; i < 20; i++) {
        const row = Math.floor(i / 4), col = row % 2 ? 3 - i % 4 : i % 4;
        points.push([38 + lanes[row][col] * (l.width - 76), l.top + 114 + row * rowGap + bends[row][col] * bend]);
    }
    c.beginPath(); c.moveTo(...points[0]);
    for (let i = 1; i < points.length - 1; i++) c.quadraticCurveTo(...points[i], (points[i][0] + points[i+1][0]) / 2, (points[i][1] + points[i+1][1]) / 2);
    c.lineTo(...points.at(-1)); c.strokeStyle = '#c5d1ba'; c.lineWidth = 4; c.stroke();
    points.forEach(([x,y],i) => {
        const n = page * 20 + i + 1, data = entry(n); if (!data) return;
        const current = n === app.unlocked, done = n < app.unlocked;
        view.button('map-level-' + n, String(n), x - 22, y - 22, 44, 44, done || current);
        if (n > app.unlocked) text(c, '未解锁', x, y + 31, 9, colors.muted, 'center');
        if (Object.keys(data.rewards).length) text(c, app.rewardClaims.includes(n) ? '✓' : '奖', x + 18, y - 20, 12, '#b57c24', 'center', 600);
        if (current) {
            c.fillStyle = '#d39439'; c.beginPath(); c.arc(x, y - 34, 5, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#d39439'; c.lineWidth = 3; c.beginPath(); c.moveTo(x,y-29); c.lineTo(x,y-18); c.moveTo(x-6,y-25); c.lineTo(x+6,y-25); c.moveTo(x,y-18); c.lineTo(x-5,y-12); c.moveTo(x,y-18); c.lineTo(x+5,y-12); c.stroke();
        }
    });
    const max = Math.min(Math.floor((app.unlocked - 1) / 20), Math.ceil(levels.length / 20) - 1);
    if (page > 0) view.button('map-prev', '上一页', 16, l.bottom - 44, 88, 44);
    text(c, (page + 1) + ' / ' + Math.ceil(levels.length / 20), l.width / 2, l.bottom - 22, 13, colors.muted, 'center');
    if (page < max) view.button('map-next', '下一页', l.width - 104, l.bottom - 44, 88, 44);
}
function detail(app) {
    const n = app.mapSelected, row = entry(n), best = app.levelBests[key(row.board)];
    const reward = rewardText(n) + (Object.keys(row.rewards).length ? (app.rewardClaims.includes(n) ? '（已领取）' : '（首次通关领取）') : '');
    return { title: '第 ' + n + ' 关', description: row.board.width + '×' + row.board.height + ' · ' + row.board.arrows.length + '条箭头\n' + (row.board.obstacles || []).length + '个障碍 · ' + (row.board.timeLimitMs == null ? '不限时' : Math.round(row.board.timeLimitMs / 1000) + '秒') + '\n' + reward + '\n个人最快：' + (best ? require('../race/history').format(best) : '暂无纪录') + '\n' + (n > app.unlocked ? '通关前面的关卡后解锁' : '使用道具不计最快纪录。开始挑战将替换当前未完成棋盘。'), actions: [...(n <= app.unlocked ? [['map-play', n < app.unlocked ? '再次挑战' : '开始挑战', true]] : []), ['map-detail-close', '返回总览']] };
}
module.exports = { draw, detail };
