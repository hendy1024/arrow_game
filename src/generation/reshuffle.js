'use strict';
const { clone } = require('../domain/board');
const { solve } = require('./validate');
async function reshuffle(session, generate, seed) {
    const count = session.remaining, original = session.level;
    for (let i = 0; i < 8; i++) {
        try {
            const result = await generate(original.number, (seed + i) >>> 0);
            if (result.level.width !== original.width || result.level.height !== original.height || (result.level.obstacles || []).length !== (original.obstacles || []).length || result.level.arrows.length < count) continue;
            const solved = solve(result.level);
            if (!solved.valid) continue;
            const keep = new Set(solved.sequence.slice(-count));
            const level = { ...clone(result.level), lifeLimit: original.lifeLimit, timeLimitMs: original.timeLimitMs, initialArrowCount: original.initialArrowCount || original.arrows.length };
            level.arrows = level.arrows.filter(a => keep.has(a.id));
            if (level.arrows.length === count && solve(level).valid) return level;
        } catch { }
    }
    // Rotation is an exact solvability-preserving fallback, including for old saved layouts.
    const level = clone(original), rotate = p => [original.width - 1 - p[0], original.height - 1 - p[1]];
    const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
    level.arrows = original.arrows.filter(a => !session.removed.has(a.id)).map(a => ({ ...clone(a), direction: opposite[a.direction], path: a.path.map(rotate) }));
    level.obstacles = (original.obstacles || []).map(rotate);
    level.initialArrowCount = original.initialArrowCount || original.arrows.length;
    if (!solve(level).valid || level.arrows.length !== count) throw Error('Cannot reshuffle safely');
    return level;
}
module.exports = { reshuffle };
