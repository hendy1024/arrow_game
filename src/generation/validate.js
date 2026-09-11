'use strict';
const { validateLevel, DIRS, key } = require('../domain/board');
function solve(level) {
    const check = validateLevel(level);
    if (!check.valid)
        return { ...check, sequence: [], layers: [], metrics: null };
    const pending = new Map(level.arrows.map(a => [a.id, a])), sequence = [], layers = [];
    while (pending.size) {
        const used = new Map();
        for (const a of pending.values())
            for (const p of a.path)
                used.set(key(p), a.id);
        const ready = [];
        for (const a of pending.values()) {
            const h = a.path[a.path.length - 1], d = DIRS[a.direction];
            let blocked = false;
            for (let x = h[0] + d[0], y = h[1] + d[1]; x >= 0 && y >= 0 && x < level.width && y < level.height; x += d[0], y += d[1])
                if (used.has(x + ',' + y)) {
                    blocked = true;
                    break;
                }
            if (!blocked)
                ready.push(a.id);
        }
        if (!ready.length)
            return { valid: false, errors: ['unsolvable'], sequence, layers, remaining: [...pending.keys()], metrics: null };
        layers.push(ready);
        for (const id of ready) {
            sequence.push(id);
            pending.delete(id);
        }
    }
    let cells = 0, turns = 0;
    for (const a of level.arrows) {
        cells += a.path.length;
        for (let i = 2; i < a.path.length; i++)
            if (a.path[i][0] - a.path[i - 1][0] !== a.path[i - 1][0] - a.path[i - 2][0] || a.path[i][1] - a.path[i - 1][1] !== a.path[i - 1][1] - a.path[i - 2][1])
                turns++;
    }
    return { valid: true, errors: [], sequence, layers, metrics: { fill: cells / (level.width * level.height), arrowCount: level.arrows.length, averageLength: cells / level.arrows.length, turns, depth: layers.length, initialOpen: layers[0].length, openRatio: layers[0].length / level.arrows.length } };
}
module.exports = { solve };
