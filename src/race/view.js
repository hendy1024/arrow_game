'use strict';
const { read, format } = require('./history');
function dialog(app) {
    const kind = app.raceKind === 'weekly' ? '每周' : '每日';
    const sizes = require('./settings').settings[app.raceKind === 'weekly' ? 'weekly' : 'daily'].map(r => r.size);
    const back = ['race-back', '返回'], close = ['race-close', '返回首页'];
    const toggle = ['race-period', '切换为' + (kind === '每日' ? '每周' : '每日')];
    let title, description, actions;
    switch (app.modal) {
        case 'race-locked': title = '竞速尚未解锁'; description = '通关第5关后开启。'; actions = [close]; break;
        case 'race-unlocked': title = '竞速模式已解锁'; description = '主页可进入每日、每周5关竞速，与好友比较总用时。'; actions = [['race-notice-close', '知道了', true]]; break;
        case 'race-menu': title = '竞速模式'; description = ''; actions = [['race-daily', '每日竞速', true], ['race-weekly', '每周竞速', true]]; break;
        case 'race-loading': title = '准备赛道'; description = '正在检查5关的通路…'; actions = [['home', '取消']]; break;
        case 'race-ready': title = '5关竞速'; description = (kind + '竞速：' + sizes[0] + '×' + sizes[0] + '起，共5关。') + '不限时、不限点错次数、无道具。关间等待不计时；关内暂停和切后台仍计时。'; actions = [['race-accept', '开始计时', true], ['home', '返回首页']]; break;
        case 'race-error': title = '赛道准备失败'; description = '请重试。'; actions = [['race-retry', '重试', true], ['home', '返回首页']]; break;
        case 'race-finished': title = '5关全部完成'; description = '总用时 ' + format(app.race.finishedElapsed) + '\n' + (app.race.saveError ? '本机保存失败，请重试' : '个人成绩已保存') + '\n' + (app.race.publishStatus || '微信中可同步好友成绩'); actions = [['race-retry-save', '重试保存 / 同步'], ['race-retry', '再跑一轮', true], ['home', '返回首页']]; break;
        case 'race-history': {
            title = kind + '个人历史';
            try {
                const records = read(app.platform.storage).filter(r => r.kind === (app.raceKind || 'daily')).sort((a, b) => b.period.localeCompare(a.period) || (b.version || 1) - (a.version || 1) || a.elapsed - b.elapsed);
                const pages = Math.max(1, Math.ceil(records.length / 3)), page = (app.historyPage || 0) % pages;
                description = records.length ? records.slice(page * 3, page * 3 + 3).map(r => r.period.slice(-10) + ' v' + (r.version || 1) + ' ' + format(r.elapsed)).join('\n') + '\n第' + (page + 1) + '/' + pages + '页 · 同期用时升序' : '暂无完成5关的成绩';
                if (app.historyNotice) description += '\n' + app.historyNotice;
            } catch { description = '历史成绩读取失败，原记录已保留'; }
            actions = [['race-page', '下一页'], ['race-sync', '同步本期最佳到好友榜'], toggle, back]; break;
        }
        case 'race-friends': title = kind + '好友榜'; description = app.platform.showFriends ? '\n\n\n\n\n\n\n\n' : '请在微信中查看好友榜'; actions = [['race-friend-page', '下一页 / 授权重试'], toggle, back]; break;
        default:
            if (app.mode !== 'race') return null;
            if (app.modal === 'pause') { title = '竞速暂歇'; description = '总用时仍在累计。返回首页将结束本轮。'; actions = [['resume', '继续', true], ['restart-ask', '重跑5关'], ['home', '结束本轮']]; }
            else if (app.modal === 'restart') { title = '重跑全部5关？'; description = '当前竞速成绩作废，从第1关重新计时。'; actions = [['restart-cancel', '继续', true], ['restart', '重新开始']]; }
            else if (app.modal === 'failed') { title = '本轮竞速结束'; description = '点错已达3次。完成全部5关才会记录成绩。'; actions = [['restart', '重跑5关', true], ['home', '返回首页']]; }
            else if (app.modal === 'won') { title = '第' + app.currentLevel + '关完成'; description = '计时已暂停，进入下一关后继续。'; actions = [['next', '下一关', true], ['home', '结束本轮']]; }
            else return null;
    }
    return { title, description, actions };
}
module.exports = { dialog };
