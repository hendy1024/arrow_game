'use strict';
const { segmentDistance } = require('../movement/path');
const { DIRS } = require('../domain/board');
function hitArrow(level, point, removed = new Set(), paths = new Map(), tolerance = .48) {
    if ((level.obstacles || []).some(p => Math.abs(point[0] - p[0]) <= .35 && Math.abs(point[1] - p[1]) <= .35)) return null;
    let best = null, distance = Infinity;
    for (const a of level.arrows) {
        if (removed.has(a.id))
            continue;
        const path = paths.get(a.id) || a.path;
        let d = Infinity;
        for (let i = 1; i < path.length; i++)
            d = Math.min(d, segmentDistance(point, path[i - 1], path[i]));
        const h = path[path.length - 1], v = DIRS[a.direction];
        for (const sign of [-1, 1])
            d = Math.min(d, segmentDistance(point, h, [h[0] - v[0] * .3 - v[1] * .17 * sign, h[1] - v[1] * .3 + v[0] * .17 * sign]));
        if (d <= tolerance && (d < distance - 1e-9 || (Math.abs(d - distance) < 1e-9 && a.id < (best || '~')))) {
            distance = d;
            best = a.id;
        }
    }
    return best;
}
class Pointer {
    constructor(tolerance = 10) { this.tolerance = tolerance; this.active = null; this.invalid = false; }
    start(id, x, y, count = 1) { if (this.active || count !== 1) {
        this.invalid = true;
        return;
    } this.active = { id, x, y }; this.invalid = false; }
    move(id, x, y, count = 1) { if (count !== 1)
        this.invalid = true; if (this.active && id === this.active.id && Math.hypot(x - this.active.x, y - this.active.y) > this.tolerance)
        this.invalid = true; }
    end(id, x, y) { if (!this.active || id !== this.active.id)
        return null; this.move(id, x, y); const result = this.invalid ? null : [x, y]; this.cancel(); return result; }
    cancel() { this.active = null; this.invalid = false; }
}
module.exports = { hitArrow, Pointer };
