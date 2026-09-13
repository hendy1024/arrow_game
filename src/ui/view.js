'use strict';
const { drawBoard } = require('../rendering/board');
const { CONFIG, profileIndex } = require('../config');
const { fixtures } = require('../fixtures');
const { Viewport } = require('../input/viewport');
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
function layout(info) { const width = info.width, height = info.height; const top = Math.max(info.safeTop || 0, info.menuBottom || 0) + 12, bottom = height - (info.safeBottom || 0) - 16; const boardSize = Math.max(120, Math.min(width - 32, bottom - top - 290)); return { width, height, top, bottom, board: { x: (width - boardSize) / 2 + 10, y: top + 142, width: boardSize - 20, height: boardSize - 20 }, card: { x: (width - boardSize) / 2, y: top + 132, width: boardSize, height: boardSize } }; }
class View {
    constructor(ctx) { this.ctx = ctx; this.buttons = []; this.transform = null; this.lastLayout = null; this.camera = new Viewport(); this.cameraLevel = null; }
    button(id, label, x, y, w, h = 48, primary = false) { const c = this.ctx; rounded(c, x, y, w, h, 14, primary ? COLORS.ink : COLORS.paper, primary ? null : COLORS.line); text(c, label, x + w / 2, y + h / 2, 15, primary ? COLORS.paper : COLORS.ink, 'center', 500); this.buttons.push({ id, label, x, y, width: w, height: h }); }
    iconButton(id, label, icon, x, y) {
        rounded(this.ctx, x, y, 44, 44, 12, COLORS.paper, COLORS.line);
        require('../rendering/ui-icons').drawIcon(this.ctx, icon, x + 5, y + 5, 34, COLORS.ink);
        this.buttons.push({ id, label, x, y, width: 44, height: 44 });
    }
    render(app, info) {
        const c = this.ctx, l = layout(info);
        this.lastLayout = l;
        this.buttons = [];
        this.transform = null; this.dialogRect = null;
        c.fillStyle = COLORS.bg;
        c.fillRect(0, 0, l.width, l.height);
        if (app.screen === 'home')
            this.home(app, l);
        else if (app.screen === 'map') require('../campaign/view').draw(this, app, l, text, COLORS);
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
        this.button('rank', '排行榜', 16, l.top, 80, 44);
        if (!app.retryRead) {
            this.iconButton('share', '分享领道具', 'share', w - 60, l.top);
            text(c, '分享', w - 68, l.top + 22, 12, COLORS.muted, 'right');
        }
        const titleY = l.top + Math.max(80, usable * .12);
        text(c, CONFIG.title, w / 2, titleY, 52, COLORS.ink, 'center', 500);
        text(c, '让每条箭头，找到出口', w / 2, titleY + 43, 14, COLORS.muted, 'center');
        const y = titleY + 78, previewSize = Math.min(w * .60, usable * .26);
        const by = Math.min(l.bottom - 181, Math.max(y + previewSize + 36, l.top + usable * .73));
        const size = Math.min(previewSize, by - y - (app.platform.isTrial ? 144 : 120)), x = (w - size) / 2;
        if (size >= 64) {
            rounded(c, x - 14, y - 12, size + 28, size + 24, 28, '#e9eddf');
            drawBoard(c, fixtures.tutorial, { x, y, width: size, height: size });
        }
        this.itemBar(app, by - 104, w, true);
        if (app.platform.isTrial) text(c, '体验版 · 点击道具数量 +1', w / 2, by - 117, 11, COLORS.muted, 'center');
        text(c, '第 ' + String(app.currentLevel).padStart(2, '0') + ' 关 · ' + CONFIG.profiles[profileIndex(app.currentLevel)].name, w / 2, by - 24, 13, COLORS.muted, 'center');
        const startWidth = Math.min(180, w - 160), startX = (w - startWidth) / 2;
        this.button('start', app.session ? '继续闯关' : '开始闯关', startX, by, startWidth, 54, true);
        if (!app.retryRead) {
            const mapX = startX + startWidth + 8;
            this.iconButton('level-map', '关卡总览', 'map', mapX, by + 5);
            text(c, '关卡总览', mapX + 22, by + 63, 10, COLORS.muted, 'center');
        }
        this.iconButton('settings', '设置', 'settings', 16, l.bottom - 44);
        text(c, '设置', 68, l.bottom - 22, 12, COLORS.muted);
        if (!app.retryRead) {
            this.iconButton('reset-progress-ask', '重置进度', 'reset', w - 60, l.bottom - 44);
            text(c, '重置进度', w - 68, l.bottom - 22, 12, COLORS.muted, 'right');
        }
        if (!app.retryRead) this.button('race', app.unlocked >= 5 ? '竞速 · 每日 / 每周' : '竞速 · 通关4关解锁', 56, by + 82, w - 112, 44);
        if (app.recoveryNotice && !app.savedError)
            text(c, app.recoveryNotice, w / 2, l.bottom + 3, 11, COLORS.red, 'center');
    }
    game(app, l) {
        const c = this.ctx, w = l.width;
        this.button('pause', 'Ⅱ', 16, l.top, 44, 44);
        this.button('share','分享',68,l.top,44,44);
        text(c, app.mode === 'race' ? '竞速模式' : app.mode === 'challenge' ? '挑战模式' : '箭间', w / 2, l.top + 15, 17, COLORS.ink, 'center', 500);
        text(c, app.mode === 'race' ? '第 ' + app.currentLevel + ' / 3 关' : app.mode === 'challenge' ? '20×20 · 4块障碍' : '第 ' + String(app.currentLevel).padStart(2, '0') + ' 关', w / 2, l.top + 40, 12, COLORS.muted, 'center');
        const s = app.session;

        text(c, '剩余箭头', 26, l.top + 80, 12, COLORS.muted);
        text(c, s ? s.remaining : '—', 26, l.top + 108, 27, COLORS.ink, 'left', 500);
        if (app.mode === 'race' && app.race?.startedAt !== undefined) {
            text(c, '累计用时', w / 2, l.top + 80, 12, COLORS.muted, 'center');
            text(c, require('../race/history').format(require('../race/controller').elapsed(app)), w / 2, l.top + 108, 23, COLORS.ink, 'center');
        }
        if (s?.remainingMs != null) {
            const seconds = Math.ceil(s.remainingMs / 1000);
            text(c, '剩余时间', w / 2, l.top + 80, 12, COLORS.muted, 'center');
            text(c, Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'), w / 2, l.top + 108, 23, seconds <= 30 ? COLORS.red : COLORS.ink, 'center');
        }
        if (s?.lives !== null && s) {
            text(c, '剩余机会', w - 26, l.top + 80, 12, COLORS.muted, 'right');
            text(c, s.lives > 5 ? '♥ × ' + s.lives : '♥'.repeat(s.lives) + '♡'.repeat(Math.max(0, s.level.lifeLimit - s.lives)), w - 26, l.top + 108, 23, COLORS.green, 'right');
        }
        else if (app.mode !== 'race') {
            rounded(c, w - 108, l.top + 88, 82, 29, 14, COLORS.mint);
            text(c, '自由尝试', w - 67, l.top + 103, 12, COLORS.green, 'center');
        }
        rounded(c, l.card.x, l.card.y, l.card.width, l.card.height, 22, COLORS.paper, COLORS.line);
        if (s && !app.loading && !app.loadError) {
            const colors = new Map(), offsets = new Map();
            for (const id of s.moves.keys())
                colors.set(id, COLORS.green);
            for (const [id, f] of s.feedback) {
                colors.set(id, '#e23b36');
                colors.set(f.blocker.id, COLORS.red);
                offsets.set(id, Math.sin((f.until - s.time) / 24) * 3.5);
            }
            if (this.cameraLevel !== s.level) { this.camera.reset(); this.cameraLevel = s.level; }
            this.camera.update(l.board);
            c.save(); c.beginPath(); c.rect(l.board.x, l.board.y, l.board.width, l.board.height); c.clip();
            this.transform = drawBoard(c, s.level, this.camera.boardRect(), { removed: s.removed, paths: s.paths(), colors, offsets, blockers: [...s.feedback.values()].map(f=>f.blocker.cell), grid: !!app.debugGrid });
            c.restore();
            if (app.tutorialStep === 1) {
                const a = s.level.arrows.find(a => a.id === 'first'), p = this.transform.toScreen(a.path[a.path.length - 1]);
                c.strokeStyle = COLORS.green;
                c.lineWidth = 1.5;
                c.beginPath();
                c.arc(p[0], p[1], this.transform.cell * .5, 0, Math.PI * 2);
                c.stroke();
            }
            const total = s.level.initialArrowCount || s.level.arrows.length;
            const progress = (total - s.remaining) / total, py = l.card.y + l.card.height + 19;
            rounded(c, 32, py, w - 64, 3, 1.5, COLORS.line);
            if (progress > 0)
                rounded(c, 32, py, (w - 64) * progress, 3, 1.5, COLORS.green);
            const message = app.message || (app.tutorialStep === 1 ? '点击圈中的箭头，沿方向移出棋盘' : this.camera.zoom > 1 ? '拖动查看棋盘，轻点箭头消除' : '箭头太小？点击放大后操作');
            wrap(c, message, w - 42, 13).forEach((v, i) => text(c, v, w / 2, py + 30 + i * 20, 13, app.message ? COLORS.green : COLORS.muted, 'center'));
            if (app.mode !== 'race') this.itemBar(app, py + 64, w);
            if (s.level.width >= 14) {
                this.button(this.camera.zoom < 3 ? 'zoom-in' : 'zoom-reset', this.camera.zoom === 1 ? '放大' : this.camera.zoom === 2 ? '再放大' : '全图', w - 84, l.top, 68, 44);
            }
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
        if (app.modal === 'rank') { require('../race/rank-view').render(this, app, l); return; }
        let title = '', description = '', actions = [];
        switch (app.modal) {
            case 'rush-locked':
                title = '挑战模式尚未解锁'; description = '通关第19关、到达第20关后开启。';
                actions = [['rush-notice-close', '知道了', true]]; break;
            case 'rush-unlocked':
                title = '挑战模式已解锁'; description = '已到达第20关！主页可进入90秒高难度挑战，普通闯关进度独立保留。';
                actions = [['rush-notice-close', '知道了', true]]; break;
            case 'item-empty':
                title = '道具已用完'; description = '当前道具数量为0，暂时无法使用。'; actions = [['item-empty-close', '知道了', true]]; break;
            case 'items': {
                const s = app.session;
                title = '道具'; description = '道具数量跨关卡保存，查看时暂停计时。';
                actions = [['item-time', s.remainingMs === null ? '加时 · 本关不限时' : '恢复初始时间 · ' + app.inventory.time], ['item-life', s.lives === null ? '容错 · 本关不限次' : '恢复初始容错 · ' + app.inventory.life], ['item-shuffle', '重排剩余箭头 · ' + app.inventory.shuffle], ['items-done', '返回游戏', true]];
                break;
            }
            case 'shuffling':
                title = '正在重排'; description = '保留剩余箭头数量，验证通路中…'; break;
            case 'pause':
                title = '歇一会儿';
                description = '棋盘会在这里等你。';
                actions = [['resume', '继续游戏', true], ['restart-ask', '重新开始'], ['settings', '设置'], ['home', '返回首页']];
                break;
            case 'restart':
                title = '重新开始本关？';
                description = '当前消除进度将重置，棋盘布局保持不变。';
                actions = [['restart-cancel', '继续游戏', true], ['restart', '重新开始']];
                break;
            case 'won':
                title = '全部解开了';
                description = app.mode === 'challenge' ? '挑战成功！所有箭头已清空。' : '第 ' + app.currentLevel + ' 关完成，所有箭头已清空。';
                actions = [['next', app.mode === 'challenge' ? '再挑战一局' : '下一关', true], ['home', '返回首页']];
                break;
            case 'rush-ready':
                title = '90秒极限挑战';
                description = '20×20满棋盘、4块障碍、3次容错。开始后计时，可放大拖动。返回首页结束本轮，普通闯关进度保留。';
                actions = [['rush-accept', '开始挑战', true], ['home', '返回首页']];
                break;
            case 'life-rescue':
                title = '容错次数用完了';
                description = '恢复本关初始容错次数，继续当前棋盘。道具：' + app.inventory.life + '；今日分享续关剩余：' + (10-require('./sharing').quota(app).rescues);
                actions = [...(app.inventory.life > 0 ? [['life-rescue-use', '使用道具继续', true]] : []), ['share-life','分享恢复容错'], ['life-rescue-decline', '结束本局']];
                break;
            case 'time-rescue':
                title = '时间用完了';
                description = '恢复本关初始时间，继续当前棋盘。道具：' + app.inventory.time + '；今日分享续关剩余：' + (10-require('./sharing').quota(app).rescues);
                actions = [...(app.inventory.time > 0 ? [['time-rescue-use', '使用道具恢复时间', true]] : []), ['share-time','分享恢复时间'], ['time-rescue-decline', '结束本局']];
                break;
            case 'failed':
                title = '再试一次';
                description = app.session?.failureReason === 'timeout' ? '时间到了。重新挑战会恢复完整时间和 3 次机会。' : '本次机会已用完。先观察出口，再慢慢解开。';
                actions = [['restart', '重新挑战', true], ['home', '返回首页']];
                break;
            case 'share-reward':
                title='每日分享奖励'; description=require('./sharing').quota(app).rewardClaimed?'今日奖励已领取。可以继续分享，再次分享不会重复获得道具。':'分享返回可领取加时、容错、重排各5个。每日一次。';
                if(app.message) description+='\n'+app.message;
                actions=[['share-start',require('./sharing').quota(app).rewardClaimed?'继续分享':'分享领取',true],['share-close','返回']];break;
            case 'share-wait':
                title='分享中';description='从分享界面返回后领取奖励或恢复本局。';actions=[['share-cancel','取消']];break;
            case 'settings':
                title = '设置';
                description = '开启操作音效可试听。\n音量随手机媒体音量调整。';
                actions = [['music', '背景音乐'], ['sound', '操作音效'], ['vibration', '震动'], ['settings-done', '完成', true]];
                break;
            case 'reset-progress':
                title = '重置关卡进度？';
                description = '清除闯关进度，回到第 1 关。保留音效和震动设置。';
                actions = [['reset-progress-cancel', '取消', true], ['reset-progress-confirm', '确认重置']];
                break;
            case 'life-intro':
                title = '多一点挑战';
                description = '本关有 ' + app.session.level.lifeLimit + ' 次容错。点错扣1次，降到0时可选择使用容错道具继续；正确消除不扣次数。';
                actions = [['life-accept', '知道了，开始', true]];
                break;
            case 'challenge-intro':
                title = ([3, 15].includes(app.currentLevel) && (app.session.level.obstacles || []).length) ? '石块出现了' : '限时挑战';
                description = ([3,15].includes(app.currentLevel) && (app.session.level.obstacles || []).length) ? '灰色石块无法消除，会挡住路线。清空全部箭头即可通关。' + (app.session.level.timeLimitMs ? '本关限时' + Math.round(app.session.level.timeLimitMs/1000) + '秒。' : '') : '本关限时 ' + Math.round((app.session?.level.timeLimitMs || 0) / 1000) + ' 秒。时间归零或机会用完即失败；暂停和切后台时停止计时。';
                actions = [['challenge-accept', '开始挑战', true]];
                break;
        }
        if (app.modal === 'level-detail') ({ title, description, actions } = require('../campaign/view').detail(app));
        if (app.modal === 'won' && app.mode === 'campaign') { description += app.rewardNotice ? '\n' + app.rewardNotice : ''; actions = [['next', app.currentLevel >= require('../campaign/catalog').levels.length ? '查看总览' : '下一关', true], ['level-map', '关卡总览'], ['home', '返回首页']]; }
        const raceDialog = require('../race/view').dialog(app);
        if (raceDialog) ({ title, description, actions } = raceDialog);
        const boxWidth = Math.min(w - 40, 340), lines = wrap(c, description, boxWidth - 48), boxHeight = 106 + lines.length * 23 + actions.length * 58 + 12, x = (w - boxWidth) / 2, y = Math.max(l.top, (l.height - boxHeight) / 2);
        this.dialogRect = { x, y, width: boxWidth, height: boxHeight };
        rounded(c, x, y, boxWidth, boxHeight, 24, COLORS.paper);
        text(c, title, w / 2, y + 40, 24, COLORS.ink, 'center', 500);
        lines.forEach((line, i) => text(c, line, w / 2, y + 82 + i * 23, 14, COLORS.muted, 'center'));
        if (app.modal === 'race-friends' && app.platform.drawFriends) app.platform.drawFriends(c, { x: x + 24, y: y + 70, width: boxWidth - 48, height: 180 });
        actions.forEach(([id, label, primary], i) => {
            const bx = x + 20, by = y + 102 + lines.length * 23 + i * 58, bw = boxWidth - 40;
            if (app.modal === 'settings' && ['music', 'sound', 'vibration'].includes(id)) {
                const on = app.settings[id] !== false;
                rounded(c, bx, by, bw, 48, 14, COLORS.paper, COLORS.line);
                text(c, label, bx + 14, by + 24, 16, COLORS.ink);
                text(c, on ? '开' : '关', bx + bw - 76, by + 24, 13, COLORS.muted, 'center');
                rounded(c, bx + bw - 62, by + 10, 48, 28, 14, on ? COLORS.green : COLORS.line);
                c.beginPath(); c.arc(bx + bw - (on ? 28 : 48), by + 24, 10, 0, Math.PI * 2); c.fillStyle = COLORS.paper; c.fill();
                this.buttons.push({ id, label, x: bx, y: by, width: bw, height: 48 });
            } else this.button(id, label, bx, by, bw, 48, primary);
        });
    }
    itemBar(app, y, width, readOnly = false) {
        const c = this.ctx, size = (width - 80) / 3;
        for (const [i, kind, label] of [[0, 'time', '加时'], [1, 'life', '容错'], [2, 'shuffle', '重排']]) {
            const x = 28 + i * (size + 12), cx = x + size / 2, cy = y + 19;
            rounded(c, x, y, size, 60, 14, COLORS.paper, COLORS.line);
            c.strokeStyle = COLORS.green; c.lineWidth = 2.3; c.beginPath();
            if (kind === 'time') { c.arc(cx, cy, 10, 0, Math.PI * 2); c.moveTo(cx, cy - 6); c.lineTo(cx, cy); c.lineTo(cx + 5, cy + 2); }
            else if (kind === 'shuffle') { c.moveTo(cx - 11, cy - 5); c.lineTo(cx + 10, cy - 5); c.lineTo(cx + 5, cy - 10); c.moveTo(cx + 10, cy + 5); c.lineTo(cx - 11, cy + 5); c.lineTo(cx - 6, cy + 10); }
            c.stroke();
            if (kind === 'life') text(c, '♥', cx, cy, 26, COLORS.red, 'center');
            if (readOnly) {
                const caption = label + ' × ' + app.inventory[kind];
                c.font = '13px sans-serif';
                const fontSize = Math.min(13, 13 * (size - 10) / Math.max(1, c.measureText(caption).width));
                text(c, caption, cx, y + 45, fontSize, COLORS.ink, 'center');
                if (app.platform.isTrial && !app.retryRead && !app.savedError) this.buttons.push({ id: 'trial-item-' + kind, x, y, width: size, height: 60, label });
                continue;
            }
            text(c, label, cx - 5, y + 45, 13, COLORS.ink, 'center');
            rounded(c, x + size - 24, y + 39, 24, 21, 9, COLORS.ink);
            text(c, app.inventory[kind], x + size - 12, y + 49, 12, COLORS.paper, 'center');
            this.buttons.push({ id: 'item-' + kind, x, y, width: size, height: 60, label });
        }
    }
    hitButton(x, y) { return this.buttons.find(b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)?.id || null; }
}
module.exports = { View, layout, COLORS, rounded, text };

