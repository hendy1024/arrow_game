'use strict';
const catalog = require('./catalog');
function action(app, name) {
    if (app.mode !== 'campaign') return false;
    if (name === 'level-map' && !app.loading && !app.retryRead && (app.screen === 'home' || app.modal === 'won')) {
        app.session?.pause(); app.screen = 'map'; app.modal = null;
        app.mapPage = Math.floor((Math.min(app.unlocked, catalog.levels.length) - 1) / 20); app.changed(); return true;
    }
    if (app.screen !== 'map') return false;
    if (name === 'map-home' && !app.modal) { app.screen = 'home'; app.changed(); return true; }
    if (name === 'map-detail-close') { app.modal = null; app.changed(); return true; }
    if (app.modal === 'level-detail' && name === 'map-play') {
        if (app.mapSelected > app.unlocked || !catalog.entry(app.mapSelected)) return true;
        app.session = null; app.modal = null; app.rewardNotice = ''; app.start(app.mapSelected); return true;
    }
    if (app.modal) return false;
    if (name === 'map-prev' || name === 'map-next') {
        const max = Math.min(Math.floor((app.unlocked - 1) / 20), Math.ceil(catalog.levels.length / 20) - 1);
        app.mapPage = Math.max(0, Math.min(max, app.mapPage + (name === 'map-next' ? 1 : -1))); app.changed(); return true;
    }
    if (name.startsWith('map-level-')) {
        const number = Number(name.slice(10));
        if (catalog.entry(number)) { app.mapSelected = number; app.modal = 'level-detail'; app.changed(); }
        return true;
    }
    return false;
}
module.exports = { action };
