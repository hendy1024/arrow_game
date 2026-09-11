'use strict';
const { drawBoard } = require('../rendering/board');
const { CONFIG, profileIndex } = require('../config');
const { fixtures } = require('../fixtures');
const COLORS = { bg: '#f5f3eb', paper: '#fffef9', ink: '#263f36', muted: '#7b8579', line: '#dfe4d8', green: '#397356', mint: '#e5eddf', red: '#ae5949' };
function rounded(ctx, x, y, w, h, r, fill, stroke) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
} if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
} }
function text(ctx, value, x, y, size = 16, color = COLORS.ink, align = 'left', weight = 400) { ctx.fillStyle = color; ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, 'Microsoft YaHei', sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(String(value), x, y); }
function wrap(ctx, value, maxWidth, size = 15) { ctx.font = `${size}px sans-serif`; const lines = []; let line = ''; for (const ch of value) {
    if (ch === '\n' || ctx.measureText(line + ch).width > maxWidth) {
        lines.push(line);
        line = ch === '\n' ? '' : ch;
    }
    else
        line += ch;
} if (line)
    lines.push(line); return lines; }
function layout(info) { const width = info.width, height = info.height; const top = Math.max(info.safeTop || 0, info.menuBottom || 0) + 12, bottom = height - (info.safeBottom || 0) - 16; const boardSize = Math.max(120, Math.min(width - 32, bottom - top - 220)); return { width, height, top, bottom, board: { x: (width - boardSize) / 2 + 10, y: top + 142, width: boardSize - 20, height: boardSize - 20 }, card: { x: (width - boardSize) / 2, y: top + 132, width: boardSize, height: boardSize } }; }
class View {
    constructor(ctx) { this.ctx = ctx; this.buttons = []; this.transform = null; this.lastLayout = null; }
    button(id, label, x, y, w, h = 48, primary = false) { const c = this.ctx; rounded(c, x, y, w, h, 14, primary ? COLORS.ink : COLORS.paper, primary ? null : COLORS.line); text(c, label, x + w / 2, y + h / 2, 15, primary ? COLORS.paper : COLORS.ink, 'center', 500); this.buttons.push({ id, label, x, y, width: w, height: h }); }
    render(app, info) {
        const c = this.ctx, l = layout(info);
        this.lastLayout = l;
        this.buttons = [];
        this.transform = null;
        c.fillStyle = COLORS.bg;
        c.fillRect(0, 0, l.width, l.height);
        if (app.screen === 'home')
            this.home(app, l);
        else
            this.game(app, l);
        if (app.modal)
            this.dialog(app, l);
        if (app.savedError) {
            rounded(c, 16, l.bottom - 48, l.width - 32, 44, 10, '#f7e7df');
            text(c, app.retryRead ? '进度读取失败 · 点击重试' : '保存失败 · 点击重试', l.width / 2, l.bottom - 26, 13, COLORS.red, 'center');
            this.buttons.push({ id: 'retry-save', label: '重试保存', x: 16, y: l.bottom - 48, width: l.width - 32, height: 44 });
        }
        app.dirty = false;
    }
    home(app, l) {
        const c = this.ctx, w = l.width, usable = l.bottom - l.top;
        text(c, 'ARROW GARDEN', w / 2, l.top + 22, 11, COLORS.muted, 'center', 500);
        const titleY = l.top + usable * .16;
        text(c, CONFIG.title, w / 2, titleY, 52, COLORS.ink, 'center', 500);
        text(c, '让每条箭头，找到出口', w / 2, titleY + 43, 14, COLORS.muted, 'center');
        const size = Math.min(w * .60, usable * .35), x = (w - size) / 2, y = titleY + 78;
        rounded(c, x - 14, y - 12, size + 28, size + 24, 28, '#e9eddf');
        drawBoard(c, fixtures.tutorial, { x, y, width: size, height: size });
        const by = Math.min(l.bottom - 123, Math.max(y + size + 36, l.top + usable * .73));
        text(c, '第 ' + String(app.currentLevel).padStart(2, '0') + ' 关 · ' + CONFIG.profiles[profileIndex(app.currentLevel)].name, w / 2, by - 24, 13, COLORS.muted, 'center');
        this.button('start', app.session ? '继续游戏' : '开始游戏', 32, by, w - 64, 54, true);
        this.button('settings', '声音与震动', w / 2 - 72, by + 68, 144, 44);
        if (app.recoveryNotice && !app.savedError)
            text(c, app.recoveryNotice, w / 2, l.bottom + 3, 11, COLORS.red, 'center');
    }
    game(app, l) {
        const c = this.ctx, w = l.width;
        this.button('pause', 'Ⅱ', 16, l.top, 44, 44);
        text(c, '箭间', w / 2, l.top + 15, 17, COLORS.ink, 'center', 500);
        text(c, '第 ' + String(app.currentLevel).padStart(2, '0') + ' 关', w / 2, l.top + 40, 12, COLORS.muted, 'center');
        const s = app.session;
        text(c, '剩余箭头', 26, l.top + 80, 12, COLORS.muted);
        text(c, s ? s.remaining : '—', 26, l.top + 108, 27, COLORS.ink, 'left', 500);
        if (s?.lives !== null && s) {
            text(c, '剩余机会', w - 26, l.top + 80, 12, COLORS.muted, 'right');
            text(c, '♥'.repeat(s.lives) + '♡'.repeat(s.level.lifeLimit - s.lives), w - 26, l.top + 108, 23, COLORS.green, 'right');
        }
        else {
            rounded(c, w - 108, l.top + 88, 82, 29, 14, COLORS.mint);
            text(c, '自由尝试', w - 67, l.top + 103, 12, COLORS.green, 'center');
        }
        rounded(c, l.card.x, l.card.y, l.card.width, l.card.height, 22, COLORS.paper, COLORS.line);
        if (s && !app.loading && !app.loadError) {
            const colors = new Map(), offsets = new Map();
            for (const id of s.moves.keys())
                colors.set(id, COLORS.green);
            for (const [id, f] of s.feedback) {
                colors.set(id, COLORS.red);
                colors.set(f.blocker.id, COLORS.red);
                offsets.set(id, Math.sin((f.until - s.time) / 16) * 2.5);
            }
            this.transform = drawBoard(c, s.level, l.board, { removed: s.removed, paths: s.paths(), colors, offsets, grid: !!app.debugGrid });
            if (app.tutorialStep === 1) {
                const a = s.level.arrows.find(a => a.id === 'first'), p = this.transform.toScreen(a.path[a.path.length - 1]);
                c.strokeStyle = COLORS.green;
                c.lineWidth = 1.5;
                c.beginPath();
                c.arc(p[0], p[1], this.transform.cell * .5, 0, Math.PI * 2);
                c.stroke();
            }
            const progress = s.removed.size / s.level.arrows.length, py = l.card.y + l.card.height + 19;
            rounded(c, 32, py, w - 64, 3, 1.5, COLORS.line);
            if (progress > 0)
                rounded(c, 32, py, (w - 64) * progress, 3, 1.5, COLORS.green);
            const message = app.message || (app.tutorialStep === 1 ? '点击圈中的箭头，沿方向移出棋盘' : '点击箭头，沿方向移出棋盘');
            wrap(c, message, w - 42, 13).forEach((v, i) => text(c, v, w / 2, py + 30 + i * 20, 13, app.message ? COLORS.green : COLORS.muted, 'center'));
        }
        else {
            text(c, app.loadError ? '暂时没有准备好' : '正在铺好棋盘…', w / 2, l.card.y + l.card.height / 2 - 16, 16, COLORS.muted, 'center');
            if (app.loadError) {
                this.button('retry-load', '重试', w / 2 - 70, l.card.y + l.card.height / 2 + 18, 140, 48, true);
                this.button('home', '返回首页', w / 2 - 70, l.card.y + l.card.height / 2 + 80, 140, 44);
            }
        }
    }
    dialog(app, l) {
        const c = this.ctx, w = l.width;
        this.buttons = [];
        c.fillStyle = 'rgba(30,48,40,.32)';
        c.fillRect(0, 0, w, l.height);
        let title = '', description = '', actions = [];
        switch (app.modal) {
            case 'pause':
                title = '歇一会儿';
                description = '棋盘会在这里等你。';
                actions = [['resume', '继续游戏', true], ['restart-ask', '重新开始'], ['settings', '声音与震动'], ['home', '返回首页']];
                break;
            case 'restart':
                title = '重新开始本关？';
                description = '当前消除进度将重置，棋盘布局保持不变。';
                actions = [['restart-cancel', '继续游戏', true], ['restart', '重新开始']];
                break;
            case 'won':
                title = '全部解开了';
                description = '第 ' + app.currentLevel + ' 关完成，所有箭头已清空。';
                actions = [['next', '下一关', true], ['home', '返回首页']];
                break;
            case 'failed':
                title = '再试一次';
                description = '本次机会已用完。先观察出口，再慢慢解开。';
                actions = [['restart', '重新挑战', true], ['home', '返回首页']];
                break;
            case 'settings':
                title = '声音与震动';
                description = '按你喜欢的方式，安静地解谜。';
                actions = [['sound', '音效  ' + (app.settings.sound ? '开启' : '关闭')], ['vibration', '震动  ' + (app.settings.vibration ? '开启' : '关闭')], ['settings-done', '完成', true]];
                break;
            case 'life-intro':
                title = '多一点挑战';
                description = '从本关开始，点击被挡住的箭头会消耗一次机会。机会用完后，可以重新挑战。';
                actions = [['life-accept', '知道了，开始', true]];
                break;
        }
        const boxWidth = Math.min(w - 40, 340), lines = wrap(c, description, boxWidth - 48), boxHeight = 106 + lines.length * 23 + actions.length * 58 + 12, x = (w - boxWidth) / 2, y = Math.max(l.top, (l.height - boxHeight) / 2);
        rounded(c, x, y, boxWidth, boxHeight, 24, COLORS.paper);
        text(c, title, w / 2, y + 40, 24, COLORS.ink, 'center', 500);
        lines.forEach((line, i) => text(c, line, w / 2, y + 82 + i * 23, 14, COLORS.muted, 'center'));
        actions.forEach(([id, label, primary], i) => this.button(id, label, x + 20, y + 102 + lines.length * 23 + i * 58, boxWidth - 40, 48, primary));
    }
    hitButton(x, y) { return this.buttons.find(b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)?.id || null; }
}
module.exports = { View, layout, COLORS, rounded, text };
