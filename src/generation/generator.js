'use strict';
const { CONFIG, profileIndex, lifeLimit, obstacleCount, timeLimit } = require('../config');
const { DIRS, key, inside, exitCells, clone } = require('../domain/board');
const { random, shuffle } = require('./random');
const { solve } = require('./validate');
const { fixtures } = require('../fixtures');
function acceptable(metrics, profile) { return metrics.fill >= profile.minFill && metrics.fill <= profile.maxFill && metrics.depth >= profile.minDepth && metrics.openRatio <= profile.maxOpenRatio && metrics.arrowCount >= (profile.minArrows || 0) && metrics.initialOpen <= (profile.maxInitialOpen ?? Infinity); }
function* candidate(number, seed, profile, rng) {
    const level = { number, width: profile.size, height: profile.size, seed: seed >>> 0, generatorVersion: CONFIG.generatorVersion, profileVersion: CONFIG.profileVersion, lifeLimit: lifeLimit(number), arrows: [] };
    level.timeLimitMs = timeLimit(number);
    level.obstacles = [];
    while (level.obstacles.length < obstacleCount(number)) {
        const p = [1 + Math.floor(rng() * (profile.size - 2)), 1 + Math.floor(rng() * (profile.size - 2))];
        if (!level.obstacles.some(q => key(q) === key(p))) level.obstacles.push(p);
    }
    if (profile.dense) return yield* require('./dense').denseCandidate(level, profile, rng);
    const occupied = new Set(), target = Math.ceil(profile.minFill * profile.size ** 2 + rng() * (profile.maxFill - profile.minFill) * profile.size ** 2);
    const maxCells = Math.floor(profile.maxFill * profile.size ** 2);
    for (let attempt = 0; attempt < 1500 && occupied.size < target; attempt++) {
        if (attempt % 40 === 0)
            yield null;
        const h = [Math.floor(rng() * profile.size), Math.floor(rng() * profile.size)];
        if (occupied.has(key(h)))
            continue;
        const direction = Object.keys(DIRS)[Math.floor(rng() * 4)], d = DIRS[direction];
        const exit = exitCells({ path: [h], direction }, level);
        if (exit.some(p => occupied.has(key(p))))
            continue;
        const forbidden = new Set(exit.map(key)), prev = [h[0] - d[0], h[1] - d[1]];
        if (!inside(prev, level) || occupied.has(key(prev)) || occupied.size + 2 > maxCells)
            continue;
        const reverse = [h, prev], own = new Set([key(h), key(prev)]);
        const length = Math.min(2 + Math.floor(rng() * (profile.maxLength - 1)), maxCells - occupied.size);
        let turns = 0, last = [-d[0], -d[1]];
        while (reverse.length < length) {
            const tail = reverse[reverse.length - 1];
            let found = false;
            for (const v of shuffle(Object.values(DIRS), rng)) {
                const p = [tail[0] + v[0], tail[1] + v[1]], k = key(p), turn = v[0] !== last[0] || v[1] !== last[1];
                if (!inside(p, level) || occupied.has(k) || own.has(k) || forbidden.has(k) || turn && turns >= profile.maxTurns)
                    continue;
                reverse.push(p);
                own.add(k);
                if (turn)
                    turns++;
                last = v;
                found = true;
                break;
            }
            if (!found)
                break;
        }
        const arrow = { id: 'a' + level.arrows.length, path: reverse.reverse(), direction };
        level.arrows.push(arrow);
        for (const p of arrow.path)
            occupied.add(key(p));
    }
    return level;
}
function* generateSteps(number, seed, options = {}) {
    if (!Number.isInteger(number) || number < 1 || !Number.isInteger(seed))
        throw new Error('Invalid generation input');
    if (number === 1 && !options.forceRandom) {
        const l = clone(fixtures.tutorial);
        l.seed = seed >>> 0;
        l.profileVersion = CONFIG.profileVersion;
        return { level: l, validation: solve(l), attempts: 0, fallback: false };
    }
    const profile = CONFIG.profiles[profileIndex(number)], rng = random(seed), maxAttempts = options.maxAttempts ?? 48;
    for (let i = 0; i < maxAttempts; i++) {
        const level = yield* candidate(number, seed, profile, rng), validation = solve(level);
        if (validation.valid && acceptable(validation.metrics, profile))
            return { level, validation, attempts: i + 1, fallback: false };
        yield null;
    }
    if (options.noFallback)
        throw new Error('Generation budget exhausted for ' + number + '/' + seed);
    const fallbacks = require('./fallbacks');
    const level = clone(obstacleCount(number) ? require('./obstacle-fallbacks')[profile.size + ':' + obstacleCount(number)] : fallbacks[profileIndex(number)]);
    if (!level)
        throw new Error('Missing verified fallback');
    level.number = number;
    level.seed = seed >>> 0;
    level.lifeLimit = lifeLimit(number);
    level.timeLimitMs = timeLimit(number);
    level.profileVersion = CONFIG.profileVersion;
    level.generatorVersion = CONFIG.generatorVersion;
    const validation = solve(level);
    if (!validation.valid || !acceptable(validation.metrics, profile))
        throw new Error('Invalid fallback');
    return { level, validation, attempts: maxAttempts, fallback: true };
}
function generate(number, seed, options) { const task = generateSteps(number, seed, options); let step; do {
    step = task.next();
} while (!step.done); return step.value; }
function generateAsync(number, seed, { schedule = fn => setTimeout(fn, 0), ...options } = {}) {
    const task = generateSteps(number, seed, options);
    return new Promise((resolve, reject) => { function step() { try {
        const started = Date.now();
        for (let work = 0; work < 12; work++) {
            const result = task.next();
            if (result.done) { resolve(result.value); return; }
            if (Date.now() - started >= 8) break;
        }
        schedule(step);
    }
    catch (e) {
        reject(e);
    } } step(); });
}
module.exports = { generate, generateSteps, generateAsync, acceptable, candidate };
