'use strict';
const DIRS = Object.freeze({ up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] });
const key = p => p[0] + ',' + p[1];
const inside = (p, level) => p[0] >= 0 && p[1] >= 0 && p[0] < level.width && p[1] < level.height;
const clone = value => JSON.parse(JSON.stringify(value));
function exitCells(a, level) {
    const d = DIRS[a.direction], h = a.path[a.path.length - 1], cells = [];
    for (let p = [h[0] + d[0], h[1] + d[1]]; inside(p, level); p = [p[0] + d[0], p[1] + d[1]])
        cells.push(p);
    return cells;
}
function validateLevel(level) {
    const errors = [];
    if (!level || !Number.isInteger(level.width) || !Number.isInteger(level.height) || level.width < 2 || level.height < 2 || level.width > 32 || level.height > 32 || !Array.isArray(level.arrows) || !level.arrows.length)
        return { valid: false, errors: ['invalid-board'] };
    if (level.lifeLimit !== null && (!Number.isInteger(level.lifeLimit) || level.lifeLimit < 1))
        errors.push('invalid-life-limit');
    const ids = new Set(), occupied = new Map();
    for (const a of level.arrows) {
        if (!a || typeof a !== 'object') {
            errors.push('invalid-arrow');
            continue;
        }
        if (typeof a.id !== 'string' || !a.id || ids.has(a.id))
            errors.push('duplicate-or-invalid-id');
        ids.add(a.id);
        if (!DIRS[a.direction] || !Array.isArray(a.path) || a.path.length < 2) {
            errors.push('invalid-arrow');
            continue;
        }
        let valid = true;
        const own = new Set();
        for (let i = 0; i < a.path.length; i++) {
            const p = a.path[i];
            if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isInteger) || !inside(p, level)) {
                errors.push('out-of-bounds');
                valid = false;
                continue;
            }
            const k = key(p);
            if (own.has(k)) {
                errors.push('self-intersection');
                valid = false;
            }
            own.add(k);
            if (occupied.has(k) && occupied.get(k) !== a.id)
                errors.push('overlap');
            occupied.set(k, a.id);
            if (i && (!Array.isArray(a.path[i - 1]) || Math.abs(p[0] - a.path[i - 1][0]) + Math.abs(p[1] - a.path[i - 1][1]) !== 1)) {
                errors.push('disconnected-path');
                valid = false;
            }
        }
        if (!valid)
            continue;
        const h = a.path[a.path.length - 1], p = a.path[a.path.length - 2], d = DIRS[a.direction];
        if (h[0] - p[0] !== d[0] || h[1] - p[1] !== d[1])
            errors.push('head-direction-mismatch');
        if (exitCells(a, level).some(p => own.has(key(p))))
            errors.push('self-blocked');
    }
    return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
function occupancy(level, excluded = new Set()) {
    const map = new Map();
    for (const a of level.arrows)
        if (!excluded.has(a.id))
            for (const p of a.path)
                map.set(key(p), a.id);
    return map;
}
function firstBlocker(a, level, occupied) {
    for (const p of exitCells(a, level))
        if (occupied.has(key(p)))
            return { id: occupied.get(key(p)), cell: p };
    return null;
}
module.exports = { DIRS, key, inside, clone, exitCells, validateLevel, occupancy, firstBlocker };
