'use strict';
const { clone, validateLevel } = require('../domain/board');
const { Session } = require('../domain/session');
const { lifeLimit } = require('../config');
const { solve } = require('../generation/validate');
const KEY = 'arrow-garden.save.v1', BACKUP = KEY + '.backup';
function checksum(value) { let n = 2166136261; for (let i = 0; i < value.length; i++) {
    n ^= value.charCodeAt(i);
    n = Math.imul(n, 16777619);
} return (n >>> 0).toString(16); }
function snapshot(app) {
    if (app.mode !== 'campaign' && app.campaignSnapshot) return { ...clone(app.campaignSnapshot), settings: { ...app.settings } };
    let session = null;
    if (app.session) {
        const s = app.session, removed = [...new Set([...s.removed, ...s.moves.keys()])];
        session = { level: clone(s.level), removed, lives: s.lives, state: s.state === 'failed' ? 'failed' : removed.length === s.level.arrows.length ? 'won' : 'playing' };
        session.remainingMs = s.remainingMs;
        session.failureReason = s.failureReason;
        session.items = { ...s.items };
        session.restartLevel = clone(s.restartLevel);
    }
    return { version: 1, currentLevel: app.currentLevel, unlocked: Math.max(app.unlocked, session?.state === 'won' ? session.level.number + 1 : 1), settings: { ...app.settings }, tutorialDone: app.tutorialDone, lifeIntroDone: app.lifeIntroDone, challengeUnlockSeen: !!app.challengeUnlockSeen, raceUnlockSeen: !!app.raceUnlockSeen, session };
}
function validProgress(p) { return Number.isInteger(p) && p >= 1 && p < 1000000; }
function validate(data) {
    if (!data || data.version !== 1 || !validProgress(data.currentLevel) || !validProgress(data.unlocked) || typeof data.tutorialDone !== 'boolean' || typeof data.lifeIntroDone !== 'boolean' || typeof data.settings?.sound !== 'boolean' || typeof data.settings?.vibration !== 'boolean')
        return false;
    if (data.session === null)
        return true;
    const s = data.session;
    const items = s?.items || { time: 1, life: 1, shuffle: 1 };
    if (!['time', 'life', 'shuffle'].every(k => items[k] === 0 || items[k] === 1)) return false;
    if (s?.restartLevel && (!validateLevel(s.restartLevel).valid || !solve(s.restartLevel).valid || s.restartLevel.number !== data.currentLevel)) return false;
    if (!s || !validateLevel(s.level).valid || !solve(s.level).valid || !validProgress(s.level.number) || s.level.number !== data.currentLevel || !Array.isArray(s.removed) || new Set(s.removed).size !== s.removed.length)
        return false;
    const ids = new Set(s.level.arrows.map(a => a.id));
    if (s.removed.some(id => !ids.has(id)))
        return false;
    if (s.level.lifeLimit === null ? s.lives !== null : !Number.isInteger(s.lives) || s.lives < 0 || s.lives > s.level.lifeLimit + 1 - items.life)
        return false;
    if (!['playing', 'won', 'failed'].includes(s.state))
        return false;
    if (s.level.timeLimitMs != null && (!Number.isFinite(s.remainingMs) || s.remainingMs < 0 || s.remainingMs > s.level.timeLimitMs + (1 - items.time) * 30000)) return false;
    if (s.state === 'failed')
        return s.lives === 0 || s.failureReason === 'timeout' && s.level.timeLimitMs != null && s.remainingMs === 0;
    if (s.level.timeLimitMs != null && s.remainingMs === 0) return false;
    if (s.lives === 0)
        return false;
    return (s.state === 'won') === (s.removed.length === ids.size);
}
function encode(data) { const payload = JSON.stringify(data); return JSON.stringify({ payload, checksum: checksum(payload) }); }
function decode(raw) { try {
    const envelope = JSON.parse(raw);
    if (typeof envelope.payload !== 'string' || checksum(envelope.payload) !== envelope.checksum)
        return null;
    const data = JSON.parse(envelope.payload);
    return validate(data) ? data : null;
}
catch {
    return null;
} }
function recoverOriginal(raw) {
    try {
        const envelope = JSON.parse(raw), data = JSON.parse(envelope.payload), level = data.session?.level;
        if (!validateLevel(level).valid || !solve(level).valid || !validProgress(level.number))
            return null;
        return { version: 1, currentLevel: level.number, unlocked: level.number, settings: { sound: true, vibration: true }, tutorialDone: level.number > 1, lifeIntroDone: false, session: { level, removed: [], lives: level.lifeLimit, remainingMs: level.timeLimitMs ?? null, state: 'playing' } };
    }
    catch {
        return null;
    }
}
function createStore(storage) {
    return { load() {
            const raw = storage.get(KEY), backup = storage.get(BACKUP);
            if (!raw && !backup)
                return { data: null, recovered: false };
            const current = decode(raw);
            if (current)
                return { data: current, recovered: false };
            const previous = decode(backup);
            if (previous)
                return { data: previous, recovered: true };
            return { data: recoverOriginal(raw) || recoverOriginal(backup), recovered: true };
        }, save(data) { if (!validate(data))
            throw new Error('Refusing invalid snapshot'); const value = encode(data); storage.set(KEY, value); storage.set(BACKUP, value); return true; } };
}
function restore(app, data) {
    if (!validate(data))
        throw new Error('Invalid saved game');
    for (const key of ['currentLevel', 'unlocked', 'tutorialDone', 'lifeIntroDone'])
        app[key] = data[key];
    app.settings = { ...data.settings };
    app.challengeUnlockSeen = !!data.challengeUnlockSeen;
    app.raceUnlockSeen = !!data.raceUnlockSeen;
    app.session = null;
    if (data.session) {
        const state = data.session;
        app.session = new Session(state.level);
        app.session.removed = new Set(state.removed);
        app.session.lives = state.lives;
        if (state.level.lifeLimit === null && lifeLimit(state.level.number) !== null) {
            app.session.level.lifeLimit = lifeLimit(state.level.number);
            app.session.lives = app.session.level.lifeLimit;
        }
        app.session.state = state.state;
        app.session.remainingMs = state.remainingMs ?? state.level.timeLimitMs ?? null;
        app.session.failureReason = state.failureReason || (state.state === 'failed' ? 'lives' : null);
        app.session.items = { ...(state.items || { time: 1, life: 1, shuffle: 1 }) };
        app.session.restartLevel = state.restartLevel ? clone(state.restartLevel) : null;
        app.tutorialStep = state.level.number === 1 && !app.tutorialDone ? 1 : 0;
    }
    app.screen = 'home';
    app.modal = app.unlocked >= 20 && !app.challengeUnlockSeen ? 'rush-unlocked' : null;
}
function bindPersistence(app, storage) {
    const store = createStore(storage);
    let readBlocked = false;
    app.persist = () => { if (readBlocked) {
        app.savedError = true;
        return;
    } try {
        store.save(snapshot(app));
        app.savedError = false;
    }
    catch {
        app.savedError = true;
    } app.dirty = true; };
    function read() { try {
        const loaded = store.load();
        if (loaded.data)
            restore(app, loaded.data);
        readBlocked = false;
        app.retryRead = null;
        app.savedError = false;
        if (loaded.recovered) {
            app.recoveryNotice = '存档异常，已恢复可用进度';
            app.say(app.recoveryNotice, 5000);
        }
    }
    catch {
        readBlocked = true;
        app.savedError = true;
        app.recoveryNotice = '暂时无法读取进度，请重试';
        app.retryRead = read;
    } app.dirty = true; }
    read();
    app.onChange = app.persist;
    return store;
}
module.exports = { KEY, BACKUP, checksum, encode, decode, validate, snapshot, restore, createStore, bindPersistence };
