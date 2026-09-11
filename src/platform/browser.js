'use strict';
function createBrowserPlatform(canvas, win) {
    const { createFeedback } = require('./feedback');
    const feedback = createFeedback(kind => { const a = new win.Audio('assets/' + kind + '.wav'); a.volume = .25; return { play: () => a.play(), stop() { a.pause(); a.currentTime = 0; }, destroy() { a.pause(); a.src = ''; } }; }, () => win.navigator.vibrate?.(10));
    const doc = win.document;
    let ctx = canvas.getContext('2d');
    function info() { const r = canvas.getBoundingClientRect(); return { width: r.width, height: r.height, ratio: win.devicePixelRatio || 1, safeTop: 12, safeBottom: 12, menuBottom: 0 }; }
    function resize() { const i = info(); canvas.width = Math.round(i.width * i.ratio); canvas.height = Math.round(i.height * i.ratio); ctx = canvas.getContext('2d'); ctx.setTransform(i.ratio, 0, 0, i.ratio, 0, 0); return i; }
    resize();
    return { canvas, get ctx() { return ctx; }, info, resize, seed: () => Date.now() >>> 0, feedback: (kind, settings) => feedback.play(kind, settings), stopFeedback: () => feedback.stop(), destroy: () => feedback.destroy(), storage: { get: key => win.localStorage.getItem(key), set: (key, value) => win.localStorage.setItem(key, value) }, requestFrame: fn => win.requestAnimationFrame(fn), cancelFrame: id => win.cancelAnimationFrame(id),
        listen(h) { const active = new Set(); const p = e => { const r = canvas.getBoundingClientRect(); return [e.pointerId, e.clientX - r.left, e.clientY - r.top]; }; canvas.addEventListener('pointerdown', e => { active.add(e.pointerId); canvas.setPointerCapture(e.pointerId); h.start(...p(e), active.size); }); canvas.addEventListener('pointermove', e => h.move(...p(e), active.size || 1)); canvas.addEventListener('pointerup', e => { h.end(...p(e)); active.delete(e.pointerId); }); canvas.addEventListener('pointercancel', () => { active.clear(); h.cancel(); }); doc.addEventListener('visibilitychange', () => doc.hidden ? h.hide() : h.show()); win.addEventListener('pagehide', () => h.hide()); win.addEventListener('resize', () => { resize(); h.resize(); }); }
    };
}
module.exports = { createBrowserPlatform };
