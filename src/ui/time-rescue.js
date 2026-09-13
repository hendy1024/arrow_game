'use strict';
function eligible(app) {
    const s = app.session;
    return app.mode !== 'race' && s?.state === 'failed' && s.failureReason === 'timeout' && s.remainingMs === 0 && s.lives !== 0 && !s.timeReviveDeclined;
}
function action(app, name) {
    if (app.modal !== 'time-rescue') return false;
    if (name === 'time-rescue-decline') {
        app.session.timeReviveDeclined = true; app.modal = 'failed'; app.changed(); return true;
    }
    if (name !== 'time-rescue-use') return false;
    if (!eligible(app) || app.inventory.time < 1) { app.say('加时道具已用完'); app.changed(); return true; }
    const s = app.session;
    app.consumeItem('time'); s.remainingMs = 30000; s.failureReason = null; s.state = s.remaining ? 'playing' : 'won';
    s.recordEligible = false; s.timeReviveDeclined = false; app.modal = null;
    if (s.state === 'won') s.emit('won');
    app.events(); app.changed(); return true;
}
module.exports = { eligible, action };
