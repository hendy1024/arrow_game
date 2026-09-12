'use strict';
const { period, VERSION } = require('./rules');
const { Session } = require('../domain/session');
const history = require('./history');
const now = app => app.platform.now ? app.platform.now() : Date.now();
function elapsed(app) { return app.race?.finishedElapsed ?? Math.max(0, now(app) - (app.race?.startedAt ?? now(app))); }
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
    app.session = new Session(app.race.course[app.race.index]); app.currentLevel = app.race.index + 1;
    app.tutorialStep = 0; app.screen = 'game'; app.modal = null; app.changed();
}
function sync(app) {
    if (app.session.state === 'failed' && !app.session.moves.size) app.modal = 'failed';
    if (app.session.state !== 'won') return;
    if (app.race.index < 9) { app.modal = 'won'; return; }
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
        Promise.resolve().then(() => app.platform.publishRace(race.record, history.read(app.platform.storage))).then(sent => { race.publishStatus = sent === false ? '已跨期，仅保存本机成绩' : '好友成绩已同步'; app.dirty = true; }, () => { race.publishStatus = '好友成绩同步失败，可重试'; app.dirty = true; });
    }
}
function refreshFriends(app) {
    if (app.modal !== 'race-friends' || !app.platform.showFriends) return;
    const key = period(app.raceKind || 'daily', now(app)).key;
    if (app.friendPeriod !== key) { app.friendPeriod = key; app.platform.showFriends(key); }
}
function action(app, name) {
    const handled = result => ({ handled: true, result });
    if (name === 'race-sync' && app.modal === 'race-history') {
        const run = async () => {
            try {
                const records = history.read(app.platform.storage).filter(r => r.period === period(app.raceKind || 'daily', now(app)).key).sort((a, b) => a.elapsed - b.elapsed);
                if (!records.length) { app.historyNotice = '本期暂无成绩'; return; }
                if (!app.platform.publishRace) { app.historyNotice = '请在微信中同步'; return; }
                await app.platform.publishRace(records[0]); app.historyNotice = '本期最佳已同步';
            } catch { app.historyNotice = '同步失败，请重试'; }
            finally { app.changed(); }
        };
        return handled(run());
    }
    if (name === 'race-notice-close' && app.modal === 'race-unlocked') { app.raceUnlockSeen = true; app.modal = null; if (app.screen === 'game') { app.session.resume(); app.syncModal(); } app.changed(); return handled(); }
    if (name === 'race' && app.screen === 'home' && !app.modal && !app.retryRead) {
        app.modal = app.unlocked >= 15 ? 'race-menu' : 'race-locked'; app.raceKind = app.raceKind || 'daily'; app.changed(); return handled();
    }
    if (name === 'race-close' && app.modal?.startsWith('race-') && app.mode !== 'race') { app.platform.closeFriends?.(); app.modal = null; app.changed(); return handled(); }
    if (name === 'race-period' && ['race-menu', 'race-history', 'race-friends'].includes(app.modal)) { app.raceKind = app.raceKind === 'daily' ? 'weekly' : 'daily'; app.historyPage = 0; if (app.modal === 'race-friends') refreshFriends(app); app.changed(); return handled(); }
    if (name === 'race-back' && ['race-history', 'race-friends'].includes(app.modal)) { app.platform.closeFriends?.(); app.modal = 'race-menu'; app.changed(); return handled(); }
    if (name === 'race-history' && app.modal === 'race-menu') { app.historyPage = 0; app.historyNotice = ''; app.modal = 'race-history'; app.changed(); return handled(); }
    if (name === 'race-page' && app.modal === 'race-history') { app.historyPage = (app.historyPage || 0) + 1; app.changed(); return handled(); }
    if (name === 'race-friend-page' && app.modal === 'race-friends') { app.platform.nextFriends?.(); return handled(); }
    if (name === 'race-friends' && app.modal === 'race-menu') { app.modal = 'race-friends'; app.friendPeriod = null; refreshFriends(app); app.changed(); return handled(); }
    if (name === 'race-start' && app.modal === 'race-menu' && app.unlocked >= 15) {
        app.campaignSnapshot = require('../persistence/store').snapshot(app); app.mode = 'race'; app.session = null; return handled(prepare(app));
    }
    if (app.mode !== 'race') return { handled: false };
    if (name === 'items' || name.startsWith('item-') || name.startsWith('reset-progress')) return handled();
    if (name === 'race-accept' && app.modal === 'race-ready') {
        if (period(app.raceKind, now(app)).key !== app.race.event.key) return handled(prepare(app));
        app.race.startedAt = now(app); startRound(app); return handled();
    }
    if (name === 'next' && app.modal === 'won' && app.race.index < 9) { app.race.index++; startRound(app); return handled(); }
    if (name === 'race-retry-save' && app.modal === 'race-finished') { persistResult(app); app.changed(); return handled(); }
    if ((name === 'restart' && ['restart', 'failed'].includes(app.modal)) || name === 'race-retry' && ['race-error', 'race-finished'].includes(app.modal)) return handled(prepare(app));
    if (name === 'home' && app.modal) {
        app.token++; const settings = app.settings; require('../persistence/store').restore(app, app.campaignSnapshot);
        app.settings = settings; app.mode = 'campaign'; app.campaignSnapshot = null; app.loading = app.loadError = false; app.message = ''; app.changed(); return handled();
    }
    return { handled: false };
}
module.exports = { action, sync, elapsed, refreshFriends };
