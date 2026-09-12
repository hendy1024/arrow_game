'use strict';
function trimShaft(points, distance) {
    const result = points.map(p => p.slice());
    while (result.length > 1) {
        const end = result[result.length - 1], previous = result[result.length - 2];
        const length = Math.hypot(end[0] - previous[0], end[1] - previous[1]);
        if (length <= distance) {
            distance -= length;
            result.pop();
        } else {
            result[result.length - 1] = [end[0] + (previous[0] - end[0]) * distance / length, end[1] + (previous[1] - end[1]) * distance / length];
            break;
        }
    }
    return result;
}
function drawArrow(ctx, points, direction, color = '#283b37', width = 3.2, unit = 24) {
    if (points.length < 2)
        return;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const length = Math.min(unit * .30, 10), half = length * .58;
    // Keep the rounded shaft cap inside the filled arrowhead, including at small cell sizes.
    const shaft = trimShaft(points, length * .7 + width / 2);
    if (shaft.length > 1) {
        ctx.beginPath();
        ctx.moveTo(shaft[0][0], shaft[0][1]);
        for (const p of shaft.slice(1))
            ctx.lineTo(p[0], p[1]);
        ctx.stroke();
    }
    const h = points[points.length - 1];
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
    ctx.beginPath();
    ctx.moveTo(h[0] + d[0] * length * .25, h[1] + d[1] * length * .25);
    ctx.lineTo(h[0] - d[0] * length - d[1] * half, h[1] - d[1] * length + d[0] * half);
    ctx.lineTo(h[0] - d[0] * length + d[1] * half, h[1] - d[1] * length - d[0] * half);
    ctx.closePath();
    ctx.fill();
}
function boardTransform(level, rect) {
    const cell = Math.min(rect.width / level.width, rect.height / level.height);
    return { cell, x: rect.x + (rect.width - cell * level.width) / 2, y: rect.y + (rect.height - cell * level.height) / 2,
        width: cell * level.width, height: cell * level.height,
        toScreen(p) { return [this.x + (p[0] + .5) * cell, this.y + (p[1] + .5) * cell]; },
        toBoard(p) { return [(p[0] - this.x) / cell - .5, (p[1] - this.y) / cell - .5]; } };
}
function drawBoard(ctx, level, rect, options = {}) {
    const t = boardTransform(level, rect);
    ctx.save();
    ctx.beginPath();
    ctx.rect(t.x, t.y, t.width, t.height);
    ctx.clip();
    if (options.grid) {
        ctx.fillStyle = '#c7d0c9';
        for (let x = 0; x < level.width; x++)
            for (let y = 0; y < level.height; y++) {
                const p = t.toScreen([x, y]);
                ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2);
            }
    }
    for (const p of level.obstacles || []) {
        const s = t.toScreen(p), size = t.cell * .7;
        ctx.fillStyle = '#88918b'; ctx.fillRect(s[0] - size / 2, s[1] - size / 2, size, size);
        ctx.strokeStyle = '#fffef9'; ctx.lineWidth = Math.max(1, t.cell * .06);
        ctx.beginPath(); ctx.moveTo(s[0] - size * .2, s[1] - size * .2); ctx.lineTo(s[0] + size * .2, s[1] + size * .2); ctx.moveTo(s[0] + size * .2, s[1] - size * .2); ctx.lineTo(s[0] - size * .2, s[1] + size * .2); ctx.stroke();
    }
    for (const a of level.arrows) {
        if (options.removed?.has(a.id))
            continue;
        const path = options.paths?.get(a.id) || a.path;
        const offset = options.offsets?.get(a.id) || 0;
        drawArrow(ctx, path.map(p => { const s = t.toScreen(p); return [s[0] + offset, s[1]]; }), a.direction, options.colors?.get(a.id), Math.max(2.4, t.cell * .11), t.cell);
    }
    ctx.restore();
    return t;
}
module.exports = { drawArrow, boardTransform, drawBoard };
