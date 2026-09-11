'use strict';
const { createBrowserPlatform } = require('./platform/browser');
const { mount } = require('./runtime');
const game = mount(createBrowserPlatform(document.querySelector('canvas'), window));
if (new URLSearchParams(location.search).has('debug')) {
    const { Session } = require('./domain/session'), { fixtures } = require('./fixtures'), { generate } = require('./generation/generator'), { solve } = require('./generation/validate');
    window.__arrowDebug = {
        ...game,
        solve,
        fixture(name) {
            game.app.session = new Session(fixtures[name]);
            game.app.currentLevel = game.app.session.level.number;
            game.app.screen = 'game';
            game.app.modal = null;
            game.app.message = '';
            game.app.tutorialStep = 0;
            game.render();
        },
        level(number, seed = 51) {
            game.app.session = new Session(generate(number, seed).level);
            game.app.currentLevel = number;
            game.app.screen = 'game';
            game.app.message = '';
            game.app.configureIntro();
            game.render();
        },
        grid() {
            game.app.debugGrid = !game.app.debugGrid;
            game.render();
        }
    };
}
