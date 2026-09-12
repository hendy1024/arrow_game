'use strict';
function dismiss(app) {
    const targets = {
        'life-rescue': 'life-rescue-decline', 'level-detail': 'map-detail-close', pause: 'resume', settings: 'settings-done', restart: 'restart-cancel', 'reset-progress': 'reset-progress-cancel',
        'life-intro': 'life-accept', 'challenge-intro': 'challenge-accept', 'rush-ready': 'home',
        'rush-locked': 'rush-notice-close', 'rush-unlocked': 'rush-notice-close', 'race-unlocked': 'race-notice-close',
        'race-locked': 'race-close', 'race-menu': 'race-close', 'race-history': 'race-close', 'race-friends': 'race-close',
        'race-ready': 'home', 'race-loading': 'home', 'race-error': 'home', 'race-finished': 'home',
        won: 'home', failed: 'home', items: 'items-done', 'item-empty': 'item-empty-close', rank: 'rank-close'
    };
    if (app.modal === 'shuffling') {
        app.token++; app.modal = app.shuffleReturn || null; if (!app.modal) app.session.resume(); app.changed(); return;
    }
    if (targets[app.modal]) return app.action(targets[app.modal]);
}
module.exports = { dismiss };
