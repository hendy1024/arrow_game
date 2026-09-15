'use strict';
// Normalized 32px paths keep every control crisp and consistent across devices.
function drawIcon(c, kind, x, y, size, color) {
    c.save(); c.translate(x, y); c.scale(size / 32, size / 32);
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 2.7; c.lineCap = 'round'; c.lineJoin = 'round';
    if (kind === 'settings') {
        c.beginPath();
        for (let i = 0; i < 48; i++) {
            const angle = i * Math.PI / 24, radius = [12, 15, 15, 15, 12, 12][i % 6];
            const px = 16 + Math.cos(angle) * radius, py = 16 + Math.sin(angle) * radius;
            if (!i) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.closePath(); c.moveTo(22, 16); c.arc(16, 16, 6, 0, Math.PI * 2, true); c.fill('evenodd');
    } else if (kind === 'reset') {
        c.beginPath(); c.arc(16, 17, 12, -Math.PI * .8, Math.PI * .8); c.stroke();
        c.beginPath(); c.moveTo(3, 2); c.lineTo(3, 13); c.lineTo(14, 13); c.closePath(); c.fill();
    } else if (kind === 'map') {
        c.beginPath(); c.moveTo(7, 6); c.lineTo(25, 6); c.lineTo(25, 16); c.lineTo(7, 16); c.lineTo(7, 26); c.lineTo(25, 26); c.stroke();
        for (const [px, py] of [[7,6],[25,6],[25,16],[7,16],[7,26],[25,26]]) { c.beginPath(); c.arc(px,py,3.7,0,Math.PI*2); c.fill(); }
    } else if (kind === 'gift') {
        c.strokeRect(3, 12, 26, 6); c.strokeRect(5, 18, 22, 12);
        c.beginPath(); c.moveTo(16, 12); c.lineTo(16, 30);
        c.moveTo(16, 12); c.bezierCurveTo(1, 12, 5, -1, 12, 5); c.lineTo(16, 12);
        c.bezierCurveTo(31, 12, 27, -1, 20, 5); c.lineTo(16, 12); c.stroke();
    } else if (kind === 'share') {
        c.beginPath(); c.moveTo(10, 14); c.lineTo(24, 6); c.moveTo(10, 18); c.lineTo(24, 26); c.stroke();
        for (const [px,py] of [[7,16],[25,5],[25,27]]) { c.beginPath(); c.arc(px,py,4,0,Math.PI*2); c.fill(); }
    }
    c.restore();
}
module.exports = { drawIcon };
