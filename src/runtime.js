'use strict';
const { Controller } = require('./ui/controller');
const { View } = require('./ui/view');
const { Pointer, hitArrow } = require('./input/pointer');
const { bindPersistence } = require('./persistence/store');
function mount(platform, options = {}) {
    const app = new Controller(platform, options), view = new View(platform.ctx), pointer = new Pointer();
    let frameId = null, last = null, hidden = false, drag = null;
    if (platform.storage)
        bindPersistence(app, platform.storage);
    function render() { view.ctx = platform.ctx; view.render(app, platform.info()); }
    function frame(now) { if (hidden)
        return; const delta = last === null ? 0 : Math.max(0, now - last); last = now; app.tick(delta); render(); frameId = platform.requestFrame(frame); }
    platform.listen({ start: (id, x, y, count) => { pointer.start(id, x, y, count); if (count !== 1) { drag = null; return; } if (!app.modal && view.transform && view.camera.zoom > 1 && view.camera.contains(x, y)) drag = { id, x, y }; }, move: (id, x, y, count) => { pointer.move(id, x, y, count); if (count !== 1) { drag = null; return; } if (drag && drag.id === id && !app.modal && pointer.invalid) { view.camera.pan(x - drag.x, y - drag.y); drag.x = x; drag.y = y; render(); } }, end: (...args) => { const p = pointer.end(...args); drag = null; if (!p)
            return; const button = view.hitButton(...p); if (button) {
            if (button === 'zoom-in') view.camera.change(1);
            else if (button === 'zoom-out') view.camera.change(-1);
            else if (button === 'zoom-reset') view.camera.reset();
            else app.action(button);
            render();
            return;
        } if (app.modal && view.dialogRect) {
            const r = view.dialogRect;
            if (p[0] < r.x || p[0] > r.x + r.width || p[1] < r.y || p[1] > r.y + r.height) { app.action('dismiss-modal'); render(); }
            return;
        } if (view.transform && !app.modal) {
            const t = view.transform;
            if (!view.camera.contains(...p))
                return;
            app.clickArrow(hitArrow(app.session.level, t.toBoard(p), app.session.removed, app.session.paths()));
            render();
        } }, cancel: () => { pointer.cancel(); drag = null; }, hide: () => { if (app.mode === 'campaign' && app.session?.moves.size) app.session.recordEligible = false; hidden = true; pointer.cancel(); drag = null; platform.cancelFrame(frameId); last = null; if (app.session && app.mode !== 'race')
            for (const id of [...app.session.moves.keys()])
                app.session.complete(id); app.events(); app.session?.pause(); app.persist?.(); platform.stopFeedback?.(); }, show: () => { if (!hidden)
            return; hidden = false; last = null; if (app.session?.state === 'paused' && !app.modal)
            app.session.resume(); frameId = platform.requestFrame(frame); }, resize: () => { pointer.cancel(); render(); } });
    render();
    frameId = platform.requestFrame(frame);
    return { app, view, render, stop() { hidden = true; platform.cancelFrame(frameId); platform.destroy?.(); } };
}
module.exports = { mount };
