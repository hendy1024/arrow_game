'use strict';
class Viewport {
    constructor() { this.zoom = 1; this.x = this.y = 0; this.rect = null; }
    update(rect) { this.rect = rect; this.clamp(); }
    clamp() { if (!this.rect) return; const maxX = this.rect.width * (this.zoom - 1) / 2, maxY = this.rect.height * (this.zoom - 1) / 2; this.x = Math.max(-maxX, Math.min(maxX, this.x)); this.y = Math.max(-maxY, Math.min(maxY, this.y)); }
    change(delta) { const before = this.zoom; this.zoom = Math.max(1, Math.min(3, this.zoom + delta)); this.x *= this.zoom / before; this.y *= this.zoom / before; this.clamp(); }
    reset() { this.zoom = 1; this.x = this.y = 0; }
    pan(dx, dy) { this.x += dx; this.y += dy; this.clamp(); }
    contains(x, y) { const r = this.rect; return !!r && x >= r.x && y >= r.y && x <= r.x + r.width && y <= r.y + r.height; }
    boardRect() { const r = this.rect; return { x: r.x - r.width * (this.zoom - 1) / 2 + this.x, y: r.y - r.height * (this.zoom - 1) / 2 + this.y, width: r.width * this.zoom, height: r.height * this.zoom }; }
}
module.exports = { Viewport };
