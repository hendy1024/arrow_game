'use strict';
const VERSION = 2;
const ROUNDS = 10;
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
function difficulty(round) {
    if (!Number.isInteger(round) || round < 1 || round > ROUNDS) throw Error('Invalid race round');
    const progress = (round - 1) / (ROUNDS - 1);
    const size = Math.round(10 * Math.pow(2, progress));
    return { round, size, factor: Math.pow(8, progress), minDepth: Math.round(2 * Math.pow(8, progress)), lifeLimit: null, timeLimitMs: null };
}
module.exports = { VERSION, ROUNDS, period, seedFor, difficulty };
