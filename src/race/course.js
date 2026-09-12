'use strict';
const { difficulty, seedFor, VERSION, ROUNDS } = require('./rules');
const { candidate, acceptable } = require('../generation/generator');
const { random } = require('../generation/random');
const { solve } = require('../generation/validate');
function profile(round, kind = 'weekly') {
    const d = difficulty(round, kind);
    return { ...d, minFill: 1, maxFill: 1, maxLength: d.maxLength, maxTurns: 7, maxOpenRatio: 1, maxInitialOpen: d.maxInitialOpen, minArrows: d.minArrows, dense: true };
}
function* courseRoundSteps(periodKey, round, options = {}) {
    const kind = periodKey.split(':')[0];
    const p = profile(round, kind), seed = seedFor(periodKey, round), rng = random(seed);
    for (let attempt = 0; attempt < (options.maxAttempts ?? 64); attempt++) {
        const level = yield* candidate(3, seed, p, rng);
        level.number = round; level.lifeLimit = null; level.timeLimitMs = null; level.raceVersion = VERSION;
        const validation = solve(level);
        if (validation.valid && acceptable(validation.metrics, p)) return level;
    }
    const result = JSON.parse(JSON.stringify((kind === 'daily' ? require('./daily-fallbacks') : require('./fallbacks'))[round - 1]));
    result.lifeLimit = null; result.seed = seed; result.raceVersion = VERSION;
    if (!solve(result).valid || !acceptable(solve(result).metrics, p) || result.width !== p.size) throw Error('Invalid race fallback');
    return result;
}
function generateRound(periodKey, round, options) { const task = courseRoundSteps(periodKey, round, options); let r; do { r = task.next(); } while (!r.done); return r.value; }
async function generateCourse(periodKey) {
    const levels = [];
    for (let n = 1; n <= ROUNDS; n++) {
        const task = courseRoundSteps(periodKey, n); let r, work = 0;
        do { r = task.next(); if (++work % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0)); } while (!r.done);
        levels.push(r.value);
    }
    return levels;
}
module.exports = { profile, generateRound, generateCourse };
