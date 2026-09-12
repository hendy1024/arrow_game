'use strict';
const { read, format } = require('./history');
function render(view, app, l) {
    const { text, rounded, COLORS } = require('../ui/view');
    const c = view.ctx, width = l.width - 24, height = l.bottom - l.top - 12;
    const x = 12, y = l.top + 6, half = (width - 52) / 2;
    view.dialogRect = { x, y, width, height };
    rounded(c, x, y, width, height, 24, COLORS.paper);
    text(c, '排行榜', l.width / 2, y + 30, 24, COLORS.ink, 'center', 500);
    view.button('rank-close', '×', x + width - 52, y + 8, 44, 44);
    view.button('rank-friends', '好友榜', x + 20, y + 56, half, 44, app.rankTab === 'friends');
    view.button('rank-personal', '个人榜', x + 32 + half, y + 56, half, 44, app.rankTab === 'personal');
    for (const [i, kind, label] of [[0, 'daily', '每日'], [1, 'weekly', '每周']]) {
        const px = l.width / 2 - 68 + i * 72, py = y + 106, active = (app.raceKind || 'daily') === kind;
        rounded(c, px, py + 6, 64, 30, 15, active ? COLORS.mint : COLORS.paper, COLORS.line);
        text(c, label, px + 32, py + 21, 13, active ? COLORS.green : COLORS.muted, 'center');
        view.buttons.push({ id: 'rank-' + kind, label, x: px, y: py, width: 64, height: 44 });
    }
    const footer = y + height - 60;
    if (app.rankTab === 'friends') {
        if (app.platform.drawFriends) app.platform.drawFriends(c, { x: x + 22, y: y + 156, width: width - 44, height: height - 226 });
        else {
            text(c, '请在微信中查看好友榜', l.width / 2, y + 215, 14, COLORS.muted, 'center');
            text(c, '完成本期5关后记录我的成绩', l.width / 2, footer - 35, 13, COLORS.muted, 'center');
        }
        const third = (width - 56) / 3;
        view.button('rank-authorize', app.platform.rankState?.authorizing ? '请求中' : app.platform.rankState?.authorization === 'granted' ? '已授权' : '好友授权', x + 20, footer, third, 44);
        view.button('rank-refresh', '刷新', x + 28 + third, footer, third, 44);
        view.button('race-friend-page', '下一页', x + 36 + third * 2, footer, third, 44);
    } else {
        try {
            const records = read(app.platform.storage).filter(r => r.kind === (app.raceKind || 'daily')).sort((a,b) => b.period.localeCompare(a.period) || (b.version || 1)-(a.version || 1) || a.elapsed-b.elapsed);
            const count = Math.max(1, Math.floor((height - 260) / 42)), pages = Math.max(1, Math.ceil(records.length / count)), page = (app.historyPage || 0) % pages;
            if (!records.length) text(c, '暂无完成5关的成绩', l.width / 2, y + 215, 14, COLORS.muted, 'center');
            records.slice(page * count, (page + 1) * count).forEach((r,i) => text(c, r.period.slice(-10) + ' v' + (r.version || 1) + '  ' + format(r.elapsed), l.width / 2, y + 180 + i * 42, 14, COLORS.ink, 'center'));
            text(c, '第' + (page + 1) + '/' + pages + '页 · 同期同版本按用时排名', l.width / 2, footer - 47, 11, COLORS.muted, 'center');
        } catch { text(c, '读取失败，原成绩已保留', l.width / 2, y + 215, 14, COLORS.red, 'center'); }
        if (app.historyNotice) text(c, app.historyNotice, l.width / 2, footer - 22, 12, COLORS.muted, 'center');
        view.button('race-page', '下一页', x + 20, footer, half, 44);
        view.button('race-sync', '同步本期最佳', x + 32 + half, footer, half, 44);
    }
}
module.exports = { render };
