'use strict';
function eligible(app) {
    const s = app.session;
    return app.mode !== 'race' && s?.state === 'failed' && s.failureReason === 'lives' && s.lives === 0 && s.remainingMs !== 0 && !s.reviveDeclined;
}
function action(app, name) {
    if (app.modal !== 'life-rescue') return false;
    if (name === 'life-rescue-decline') {
        app.session.reviveDeclined = true; app.modal = 'failed'; app.changed(); return true;
    }
    if (name !== 'life-rescue-use') return false;
    if (!eligible(app) || app.inventory.life < 1) { app.say('容错道具已用完'); app.changed(); return true; }
    const s = app.session;
    app.consumeItem('life'); s.lives = 1; s.failureReason = null; s.state = s.remaining ? 'playing' : 'won';
    s.feedback.clear(); s.recordEligible = false; s.reviveDeclined = false;
    app.modal = null;
    if (s.state === 'won') s.emit('won');
    app.events(); app.changed(); return true;
}
module.exports = { eligible, action };
