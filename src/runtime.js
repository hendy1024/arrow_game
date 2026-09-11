'use strict';
const { Controller } = require('./ui/controller');
const { View } = require('./ui/view');
const { Pointer, hitArrow } = require('./input/pointer');
const { bindPersistence } = require('./persistence/store');
function mount(platform, options = {}) {
    const app = new Controller(platform, options), view = new View(platform.ctx), pointer = new Pointer();
    let frameId = null, last = null, hidden = false;
    if (platform.storage)
        bindPersistence(app, platform.storage);
    function render() { view.ctx = platform.ctx; view.render(app, platform.info()); }
    function frame(now) { if (hidden)
        return; const delta = last === null ? 0 : Math.max(0, now - last); last = now; app.tick(delta); render(); frameId = platform.requestFrame(frame); }
    platform.listen({ start: (...args) => pointer.start(...args), move: (...args) => pointer.move(...args), end: (...args) => { const p = pointer.end(...args); if (!p)
            return; const button = view.hitButton(...p); if (button) {
            app.action(button);
            render();
            return;
        } if (view.transform && !app.modal) {
            const t = view.transform;
            if (p[0] < t.x || p[1] < t.y || p[0] > t.x + t.width || p[1] > t.y + t.height)
                return;
            app.clickArrow(hitArrow(app.session.level, t.toBoard(p), app.session.removed, app.session.paths()));
            render();
        } }, cancel: () => pointer.cancel(), hide: () => { hidden = true; pointer.cancel(); platform.cancelFrame(frameId); last = null; if (app.session)
            for (const id of [...app.session.moves.keys()])
                app.session.complete(id); app.events(); app.session?.pause(); app.persist?.(); platform.stopFeedback?.(); }, show: () => { if (!hidden)
            return; hidden = false; last = null; if (app.session?.state === 'paused' && !app.modal)
            app.session.resume(); frameId = platform.requestFrame(frame); }, resize: () => { pointer.cancel(); render(); } });
    render();
    frameId = platform.requestFrame(frame);
    return { app, view, render, stop() { hidden = true; platform.cancelFrame(frameId); platform.destroy?.(); } };
}
module.exports = { mount };
