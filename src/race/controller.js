'use strict';
const { period, VERSION, ROUNDS } = require('./rules');
const { Session } = require('../domain/session');
const history = require('./history');
const now = app => app.platform.now ? app.platform.now() : Date.now();
function elapsed(app) { return app.race?.finishedElapsed ?? Math.max(0, (app.race?.transitionAt ?? now(app)) - (app.race?.startedAt ?? now(app)) - (app.race?.transitionMs || 0)); }
async function prepare(app) {
    const token = ++app.token;
    app.loading = true; app.modal = 'race-loading'; app.changed();
    try {
        const event = period(app.raceKind || 'daily', now(app));
        const course = await (app.raceGenerate || require('./course').generateCourse)(event.key);
        if (token !== app.token) return;
        app.race = { event, course, index: 0 }; app.loading = false; app.modal = 'race-ready'; app.changed();
    } catch { if (token === app.token) { app.loading = false; app.modal = 'race-error'; app.changed(); } }
}
function startRound(app) {
    app.session = new Session({ ...app.race.course[app.race.index], lifeLimit: null }); app.currentLevel = app.race.index + 1;
    if (app.race.transitionAt !== undefined) { app.race.transitionMs = (app.race.transitionMs || 0) + now(app) - app.race.transitionAt; delete app.race.transitionAt; }
    app.tutorialStep = 0; app.screen = 'game'; app.modal = null; app.changed();
}
function sync(app) {
    if (app.session.state === 'failed' && !app.session.moves.size) app.modal = 'failed';
    if (app.session.state !== 'won') return;
    if (app.race.index < ROUNDS - 1) { app.race.transitionAt ??= now(app); app.modal = 'won'; return; }
    if (app.race.finishedElapsed === undefined) {
        app.race.finishedElapsed = Math.max(1, elapsed(app));
        app.race.record = { id: app.race.event.key + ':' + app.race.startedAt, kind: app.race.event.kind, period: app.race.event.key, version: VERSION, elapsed: app.race.finishedElapsed, finishedAt: now(app) };
        persistResult(app);
    }
    app.modal = 'race-finished';
}
function persistResult(app) {
    const race = app.race;
    try { history.save(app.platform.storage, app.race.record); app.race.saveError = false; }
    catch { app.race.saveError = true; }
    if (app.platform.publishRace && !app.race.saveError) {
        race.publishStatus = '好友成绩同步中';
        require('./upload').upload(app,race.record).then(sent => { race.publishStatus = sent === false ? '已跨期，仅保存本机成绩' : '好友成绩已同步'; app.dirty = true; }, e => { race.publishStatus = '本机已保存，回到游戏或打开榜单时自动重试'; console.warn('竞速成绩同步失败',String(e?.errMsg||e?.message||e)); app.dirty = true; });
    }
}
function refreshFriends(app) {
    if (!(app.modal === 'race-friends' || app.modal === 'rank' && app.rankTab === 'friends') || !app.platform.showFriends) return;
    const key = period(app.raceKind || 'daily', now(app)).key;
    if (app.friendPeriod !== key) { app.friendPeriod = key; app.platform.showFriends(key); }
}
function action(app, name) {
    if ((name === 'rank' && app.screen === 'home' && !app.modal) || (['rank-refresh','rank-personal','rank-friends','rank-daily','rank-weekly'].includes(name) && app.modal === 'rank')) require('./upload').retry(app);
    const handled = result => ({ handled: true, result });
    if (name === 'rank' && app.screen === 'home' && !app.modal) { app.rankTab = 'friends'; app.modal = 'rank'; app.raceKind = app.raceKind || 'daily'; app.friendPeriod = null; refreshFriends(app); app.changed(); return handled(); }
    if (name === 'rank-authorize' && app.modal === 'rank' && app.rankTab === 'friends') { app.platform.authorizeFriends?.(); return handled(); }
    if (name === 'rank-refresh' && app.modal === 'rank' && app.rankTab === 'friends') { app.friendPeriod = null; refreshFriends(app); app.changed(); return handled(); }
    if (name === 'rank-close' && app.modal === 'rank') { app.platform.closeFriends?.(); app.modal = null; app.changed(); return handled(); }
    if (app.modal === 'rank' && ['rank-friends', 'rank-personal', 'rank-daily', 'rank-weekly'].includes(name)) {
        if (name === 'rank-friends' || name === 'rank-personal') { app.rankTab = name.slice(5); app.platform.closeFriends?.(); app.friendPeriod = null; }
        else app.raceKind = name.slice(5);
        app.historyPage = 0; app.historyNotice = ''; refreshFriends(app); app.changed(); return handled();
    }
    if (name === 'race-sync' && (app.modal === 'race-history' || app.modal === 'rank' && app.rankTab === 'personal')) {
        const run = async () => {
            try {
                const records = history.read(app.platform.storage).filter(r => r.version === VERSION && r.period === period(app.raceKind || 'daily', now(app)).key).sort((a, b) => a.elapsed - b.elapsed);
                if (!records.length) { app.historyNotice = '本期暂无成绩'; return; }
                if (!app.platform.publishRace) { app.historyNotice = '请在微信中同步'; return; }
                const sent=await require('./upload').upload(app,records[0]); app.historyNotice = sent===false?'已跨期，仅保存本机成绩':'本期最佳已同步';
            } catch { app.historyNotice = '同步失败，请重试'; }
            finally { app.changed(); }
        };
        return handled(run());
    }
    if (name === 'race-notice-close' && app.modal === 'race-unlocked') { app.raceUnlockSeen = true; app.modal = null; if (app.screen === 'game') { app.session.resume(); app.syncModal(); } app.changed(); return handled(); }
    if (name === 'race' && app.screen === 'home' && !app.modal && !app.retryRead) {
        app.modal = app.unlocked >= 5 ? 'race-menu' : 'race-locked'; app.raceKind = app.raceKind || 'daily'; app.changed(); return handled();
    }
    if (name === 'race-close' && app.modal?.startsWith('race-') && app.mode !== 'race') { app.platform.closeFriends?.(); app.modal = null; app.changed(); return handled(); }
    if (name === 'race-period' && ['race-menu', 'race-history', 'race-friends'].includes(app.modal)) { app.raceKind = app.raceKind === 'daily' ? 'weekly' : 'daily'; app.historyPage = 0; if (app.modal === 'race-friends') refreshFriends(app); app.changed(); return handled(); }
    if (name === 'race-back' && ['race-history', 'race-friends'].includes(app.modal)) { app.platform.closeFriends?.(); app.modal = 'race-menu'; app.changed(); return handled(); }
    if (name === 'race-history' && app.modal === 'race-menu') { app.historyPage = 0; app.historyNotice = ''; app.modal = 'race-history'; app.changed(); return handled(); }
    if (name === 'race-page' && (app.modal === 'race-history' || app.modal === 'rank')) { app.historyPage = (app.historyPage || 0) + 1; app.changed(); return handled(); }
    if (name === 'race-friend-page' && (app.modal === 'race-friends' || app.modal === 'rank')) { app.platform.nextFriends?.(); return handled(); }
    if (name === 'race-friends' && app.modal === 'race-menu') { app.modal = 'race-friends'; app.friendPeriod = null; refreshFriends(app); app.changed(); return handled(); }
    if (['race-start', 'race-daily', 'race-weekly'].includes(name) && app.modal === 'race-menu' && app.unlocked >= 5) {
        if (name !== 'race-start') app.raceKind = name.slice(5);
        app.campaignSnapshot = require('../persistence/store').snapshot(app); app.mode = 'race'; app.session = null; return handled(prepare(app));
    }
    if (app.mode !== 'race') return { handled: false };
    if (name === 'items' || (name.startsWith('item-') && !['item-shuffle','item-empty-close'].includes(name)) || name.startsWith('reset-progress')) return handled();
    if (name === 'race-accept' && app.modal === 'race-ready') {
        if (period(app.raceKind, now(app)).key !== app.race.event.key) return handled(prepare(app));
        app.race.startedAt = now(app); startRound(app); return handled();
    }
    if (name === 'next' && app.modal === 'won' && app.race.index < ROUNDS - 1) { app.race.index++; startRound(app); return handled(); }
    if (name === 'race-retry-save' && app.modal === 'race-finished') { persistResult(app); app.changed(); return handled(); }
    if ((name === 'restart' && ['restart', 'failed'].includes(app.modal)) || name === 'race-retry' && ['race-error', 'race-finished'].includes(app.modal)) return handled(prepare(app));
    if (name === 'home' && app.modal) {
        app.token++; const settings = app.settings, inventory = app.inventory, share = app.share; require('../persistence/store').restore(app, app.campaignSnapshot);
        app.settings = settings; app.inventory = inventory; app.share = share; app.mode = 'campaign'; app.campaignSnapshot = null; app.loading = app.loadError = false; app.message = ''; app.changed(); return handled();
    }
    return { handled: false };
}
module.exports = { action, sync, elapsed, refreshFriends };
