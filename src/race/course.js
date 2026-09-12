'use strict';
const { difficulty, seedFor, VERSION } = require('./rules');
const { candidate, acceptable } = require('../generation/generator');
const { random } = require('../generation/random');
const { solve } = require('../generation/validate');
function profile(round) {
    const d = difficulty(round);
    return { ...d, minFill: round <= 3 ? .63 + (round - 1) * .06 : 1, maxFill: round <= 3 ? .75 + (round - 1) * .06 : 1, maxLength: round <= 3 ? 12 : 9, maxTurns: 7, maxOpenRatio: round <= 3 ? .65 : .05, maxInitialOpen: round <= 3 ? Infinity : 1, minArrows: round <= 3 ? 8 : Math.floor(d.size * d.size / 6), dense: round >= 4 };
}
function* courseRoundSteps(periodKey, round, options = {}) {
    const p = profile(round), seed = seedFor(periodKey, round), rng = random(seed);
    for (let attempt = 0; attempt < (options.maxAttempts ?? 64); attempt++) {
        const level = yield* candidate(3, seed, p, rng);
        level.number = round; level.lifeLimit = null; level.timeLimitMs = null; level.raceVersion = VERSION;
        const validation = solve(level);
        if (validation.valid && acceptable(validation.metrics, p)) return level;
    }
    const result = JSON.parse(JSON.stringify(require('./fallbacks')[round - 1]));
    result.lifeLimit = null; result.seed = seed; result.raceVersion = VERSION;
    if (!solve(result).valid) throw Error('Invalid race fallback');
    return result;
}
function generateRound(periodKey, round, options) { const task = courseRoundSteps(periodKey, round, options); let r; do { r = task.next(); } while (!r.done); return r.value; }
async function generateCourse(periodKey) {
    const levels = [];
    for (let n = 1; n <= 10; n++) {
        const task = courseRoundSteps(periodKey, n); let r, work = 0;
        do { r = task.next(); if (++work % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0)); } while (!r.done);
        levels.push(r.value);
    }
    return levels;
}
module.exports = { profile, generateRound, generateCourse };
