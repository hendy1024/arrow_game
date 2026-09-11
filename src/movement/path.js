'use strict';
const { DIRS, key } = require('../domain/board');
const CLEARANCE = .16;
function pointAt(arrow, distance) {
    const path = arrow.path, L = path.length - 1;
    if (distance >= L) {
        const h = path[L], d = DIRS[arrow.direction];
        return [h[0] + d[0] * (distance - L), h[1] + d[1] * (distance - L)];
    }
    const i = Math.max(0, Math.floor(distance)), f = distance - i, a = path[i], b = path[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
function bodyAt(arrow, distance) {
    const end = arrow.path.length - 1 + distance, result = [pointAt(arrow, distance)];
    for (let i = Math.floor(distance) + 1; i < Math.min(end, arrow.path.length - 1); i++)
        result.push(arrow.path[i]);
    if (distance < arrow.path.length - 1 && end > arrow.path.length - 1)
        result.push(arrow.path[arrow.path.length - 1]);
    result.push(pointAt(arrow, end));
    return result;
}
function completionDistance(arrow, level) { const h = arrow.path[arrow.path.length - 1]; return arrow.path.length - 1 + ({ up: h[1] + .5, down: level.height - .5 - h[1], left: h[0] + .5, right: level.width - .5 - h[0] }[arrow.direction]) + CLEARANCE; }
function segmentDistance(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], sq = dx * dx + dy * dy; const t = sq ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / sq)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
function occupiedByBody(arrow, distance, level) {
    const points = bodyAt(arrow, distance), cells = new Set();
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        for (let x = Math.max(0, Math.ceil(Math.min(a[0], b[0]) - CLEARANCE)); x <= Math.min(level.width - 1, Math.floor(Math.max(a[0], b[0]) + CLEARANCE)); x++)
            for (let y = Math.max(0, Math.ceil(Math.min(a[1], b[1]) - CLEARANCE)); y <= Math.min(level.height - 1, Math.floor(Math.max(a[1], b[1]) + CLEARANCE)); y++)
                if (segmentDistance([x, y], a, b) <= CLEARANCE)
                    cells.add(key([x, y]));
    }
    return cells;
}
module.exports = { pointAt, bodyAt, completionDistance, segmentDistance, occupiedByBody, CLEARANCE };
