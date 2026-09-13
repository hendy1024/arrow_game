'use strict';
const { DIRS } = require('../domain/board');
const { shuffle } = require('./random');
const cache = new Map();
function geometry(width, height) {
    const cacheKey = width + ',' + height;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const cells = Array.from({ length: width * height }, (_, id) => {
        const x = id % width, y = Math.floor(id / width), neighbors = [], exits = [];
        for (const [direction, [dx, dy]] of Object.entries(DIRS)) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < width && ny < height) neighbors.push(ny * width + nx);
            const px = x - dx, py = y - dy;
            if (px < 0 || py < 0 || px >= width || py >= height) continue;
            const ray = [];
            for (let rx = nx, ry = ny; rx >= 0 && ry >= 0 && rx < width && ry < height; rx += dx, ry += dy) ray.push(ry * width + rx);
            exits.push({ direction, previous: py * width + px, ray });
        }
        return { point: [x, y], neighbors, exits };
    });
    cache.set(cacheKey, cells);
    return cells;
}
// Peel paths from a full board in removal order; each new path exits through earlier paths.
function* denseCandidate(level, profile, rng) {
    const cells = geometry(level.width, level.height);
    const stones = new Set((level.obstacles || []).map(p => p[1] * level.width + p[0]));
    const occupied = new Set(cells.map((_, i) => i).filter(i => !stones.has(i))), last = new Set();
    const depths = new Map();
    while (occupied.size) {
        yield null;
        const choices = [];
        for (const head of occupied) for (const exit of cells[head].exits) {
            if (!occupied.has(exit.previous) || exit.ray.some(p => occupied.has(p) || stones.has(p))) continue;
            if (level.arrows.length && !exit.ray.length) continue;
            const depth = profile.depthCeiling ? Math.max(0, ...exit.ray.map(p => depths.get(p) || 0)) + 1 : 0;
            if (profile.depthCeiling && depth > profile.depthCeiling) continue;
            choices.push({ head, ...exit, depth, score: profile.depthCeiling ? depth : exit.ray.some(p => last.has(p)) ? 1 : 0 });
        }
        const ordered = shuffle(choices, rng).sort((a, b) => b.score - a.score);
        let accepted = false;
        for (const choice of ordered) {
            const path = [choice.head, choice.previous], own = new Set(path);
            const minimum = profile.minTargetLength || 3;
            const target = minimum + Math.floor(rng() * (profile.maxLength - minimum + 1));
            while (path.length < target) {
                const next = shuffle(cells[path[path.length - 1]].neighbors, rng).find(p => occupied.has(p) && !own.has(p));
                if (next === undefined) break;
                path.push(next); own.add(next);
            }
            while (path.length >= 2) {
                let isolated = false;
                for (const value of occupied) {
                    if (!own.has(value) && !cells[value].neighbors.some(p => occupied.has(p) && !own.has(p))) { isolated = true; break; }
                }
                if (!isolated) break;
                own.delete(path.pop());
            }
            if (path.length < 2) continue;
            for (const value of own) occupied.delete(value);
            if (profile.depthCeiling) for (const value of own) depths.set(value, choice.depth);
            last.clear(); for (const value of own) last.add(value);
            level.arrows.push({ id: 'a' + level.arrows.length, path: path.reverse().map(p => cells[p].point.slice()), direction: choice.direction });
            accepted = true;
            break;
        }
        if (!accepted) break;
    }
    return level;
}
module.exports = { denseCandidate };
