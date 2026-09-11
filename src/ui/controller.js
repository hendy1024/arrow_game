'use strict';
const { Session } = require('../domain/session');
const { generateAsync } = require('../generation/generator');
const { CONFIG, lifeLimit } = require('../config');
class Controller {
    constructor(platform, options = {}) {
        this.platform = platform;
        this.generate = options.generate || generateAsync;
        this.screen = 'home';
        this.modal = null;
        this.session = null;
        this.currentLevel = 1;
        this.unlocked = 1;
        this.settings = { sound: true, vibration: true };
        this.tutorialDone = false;
        this.lifeIntroDone = false;
        this.tutorialStep = 0;
        this.message = '';
        this.messageUntil = 0;
        this.clock = 0;
        this.loading = false;
        this.loadError = false;
        this.token = 0;
        this.onChange = () => { };
        this.dirty = true;
        this.savedError = false;
    }
    changed() { this.dirty = true; this.onChange(); }
    say(message, duration = CONFIG.messageMs) { this.message = message; this.messageUntil = this.clock + duration; this.dirty = true; }
    async start(number = this.currentLevel) {
        if (this.loading)
            return;
        if (this.session && this.session.level.number === number) {
            this.screen = 'game';
            this.session.resume();
            this.syncModal();
            this.changed();
            return;
        }
        const token = ++this.token;
        this.loading = true;
        this.loadError = false;
        this.screen = 'game';
        this.modal = null;
        this.message = '';
        this.changed();
        try {
            const result = await this.generate(number, this.platform.seed());
            if (token !== this.token)
                return;
            this.session = new Session(result.level);
            this.currentLevel = number;
            this.loading = false;
            this.configureIntro();
            this.changed();
        }
        catch (e) {
            if (token !== this.token)
                return;
            this.loading = false;
            this.loadError = true;
            this.say('棋盘准备失败，请重试', 60000);
            this.changed();
        }
    }
    configureIntro() {
        if (this.session.level.number === 1 && !this.tutorialDone)
            this.tutorialStep = 1;
        else
            this.tutorialStep = 0;
        if (lifeLimit(this.session.level.number) !== null && !this.lifeIntroDone) {
            this.session.pause();
            this.modal = 'life-intro';
        }
        else
            this.modal = null;
    }
    syncModal() {
        if (this.session.state === 'won')
            this.modal = 'won';
        else if (this.session.state === 'failed' && !this.session.moves.size)
            this.modal = 'failed';
        else if (this.session.level.lifeLimit !== null && !this.lifeIntroDone) {
            this.session.pause();
            this.modal = 'life-intro';
        }
        else
            this.modal = null;
    }
    clickArrow(id) {
        if (this.screen !== 'game' || this.modal || this.loading || !this.session)
            return { type: 'locked' };
        if (this.tutorialStep === 1 && id !== 'first') {
            this.say('先点击标记的箭头，试着移走它');
            return { type: 'tutorial' };
        }
        const result = this.session.click(id);
        if (result.type === 'temporary')
            this.say('通道正在腾空，请稍候');
        if (result.type === 'allowed' && this.tutorialStep === 1) {
            this.tutorialStep = 2;
            this.tutorialDone = true;
            this.say('先移走外面的箭头，给里面让路', 4500);
        }
        this.events();
        if (result.type === 'allowed' || result.type === 'blocked')
            this.changed();
        return result;
    }
    events() {
        if (!this.session)
            return;
        for (const event of this.session.drainEvents()) {
            if (event.type === 'blocked') {
                this.say(this.session.lives === null ? '前方有阻挡' : '前方有阻挡，机会 −1');
                this.platform.feedback('blocked', this.settings);
            }
            else if (event.type === 'removed')
                this.platform.feedback('removed', this.settings);
            else if (event.type === 'won') {
                this.unlocked = Math.max(this.unlocked, this.session.level.number + 1);
                this.platform.feedback('won', this.settings);
            }
            if (event.type === 'removed' || event.type === 'won' || event.type === 'failed')
                this.changed();
        }
        if (!this.modal || this.modal === 'won' || this.modal === 'failed')
            this.syncModal();
    }
    tick(ms) {
        if (this.screen === 'game' && this.session && !this.loading) {
            this.session.tick(ms);
            this.events();
        }
        this.clock += ms;
        if (this.message && this.clock >= this.messageUntil) {
            this.message = '';
            if (this.tutorialStep === 2)
                this.tutorialStep = 0;
            this.dirty = true;
        }
    }
    action(name) {
        if (name === 'retry-save') {
            if (this.retryRead)
                this.retryRead();
            else
                this.persist?.();
            return;
        }
        if (name === 'retry-load' && this.loadError) {
            this.session = null;
            return this.start();
        }
        if (name === 'start' && this.screen === 'home' && !this.modal)
            return this.start();
        if (name === 'pause' && this.screen === 'game' && !this.modal && !this.loading && this.session?.state === 'playing') {
            this.session.pause();
            this.modal = 'pause';
        }
        else if (name === 'resume' && this.modal === 'pause') {
            this.modal = null;
            this.session.resume();
        }
        else if (name === 'settings' && (this.screen === 'home' && !this.modal || this.modal === 'pause')) {
            this.settingsReturn = this.modal;
            this.modal = 'settings';
        }
        else if (name === 'settings-done' && this.modal === 'settings')
            this.modal = this.settingsReturn || null;
        else if (name === 'sound' && this.modal === 'settings') {
            this.settings.sound = !this.settings.sound;
            if (!this.settings.sound)
                this.platform.stopFeedback?.();
        }
        else if (name === 'vibration' && this.modal === 'settings')
            this.settings.vibration = !this.settings.vibration;
        else if (name === 'restart-ask' && this.modal === 'pause')
            this.modal = 'restart';
        else if (name === 'restart-cancel' && this.modal === 'restart') {
            this.modal = null;
            this.session.resume();
        }
        else if (name === 'restart' && (this.modal === 'restart' || this.modal === 'failed')) {
            this.session = this.session.restart();
            this.message = '';
            this.configureIntro();
        }
        else if (name === 'life-accept' && this.modal === 'life-intro') {
            this.lifeIntroDone = true;
            this.modal = null;
            this.session.resume();
        }
        else if (name === 'next' && this.modal === 'won') {
            const number = this.session.level.number + 1;
            this.session = null;
            this.currentLevel = number;
            return this.start(number);
        }
        else if (name === 'home' && (this.modal === 'pause' || this.modal === 'won' || this.modal === 'failed' || this.loadError)) {
            this.session?.pause();
            this.screen = 'home';
            this.modal = null;
            this.loading = false;
            this.loadError = false;
        }
        this.changed();
    }
}
module.exports = { Controller };
