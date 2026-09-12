'use strict';
const { settings, version } = require('./settings');
const VERSION = version(settings);
const ROUNDS = 5;
const OFFSET = 8 * 60 * 60 * 1000;
function period(kind, now = Date.now()) {
    if (!['daily', 'weekly'].includes(kind) || !Number.isFinite(now)) throw Error('Invalid race period');
    const local = new Date(now + OFFSET);
    let start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    if (kind === 'weekly') start -= ((local.getUTCDay() + 6) % 7) * 86400000;
    const date = new Date(start).toISOString().slice(0, 10);
    return { kind, key: kind + ':' + date, startsAt: start - OFFSET, endsAt: start - OFFSET + (kind === 'daily' ? 1 : 7) * 86400000 };
}
function seedFor(periodKey, round) {
    if (!Number.isInteger(round) || round < 1 || round > ROUNDS) throw Error('Invalid race round');
    let hash = 2166136261;
    for (const c of 'race:' + VERSION + ':' + periodKey + ':' + round) { hash ^= c.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
}
function difficulty(round, kind = 'weekly') {
    if (!['daily', 'weekly'].includes(kind)) throw Error('Invalid race kind');
    if (!Number.isInteger(round) || round < 1 || round > ROUNDS) throw Error('Invalid race round');
    const row = settings[kind][round - 1];
    return { ...row, round, factor: row.minDepth / settings[kind][0].minDepth, lifeLimit: null, timeLimitMs: null };
}
module.exports = { VERSION, ROUNDS, period, seedFor, difficulty };
