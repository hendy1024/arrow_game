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
        this.inventory = { time: 10, life: 10, shuffle: 10 };
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
        this.mode = 'campaign';
        this.campaignSnapshot = null;
        this.challengeUnlockSeen = false;
        this.raceUnlockSeen = false;
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
            this.session = new Session(this.mode === 'challenge' ? { ...result.level, timeLimitMs: 90000, lifeLimit: 3 } : result.level);
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
        if (this.mode === 'challenge') { this.tutorialStep = 0; this.session.pause(); this.modal = 'rush-ready'; return; }
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
        if (!this.modal && [15, 20].includes(this.session.level.number)) {
            this.session.pause(); this.modal = 'challenge-intro';
        }
    }
    syncModal() {
        if (this.mode === 'race') { require('../race/controller').sync(this); return; }
        if (this.mode === 'campaign' && this.unlocked >= 20 && !this.challengeUnlockSeen) { this.session.pause(); this.modal = 'rush-unlocked'; return; }
        if (this.session.state === 'won')
            this.modal = 'won';
        else if (this.session.state === 'failed' && (!this.session.moves.size || this.session.failureReason === 'timeout'))
            this.modal = 'failed';
        else if (this.mode === 'campaign' && this.session.level.lifeLimit !== null && !this.lifeIntroDone) {
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
                if (this.mode === 'campaign') {
                    const previous = this.unlocked;
                    this.unlocked = Math.max(this.unlocked, this.session.level.number + 1);
                    if (previous < 6 && this.unlocked >= 6 && !this.raceUnlockSeen) this.modal = 'race-unlocked';
                }
                this.platform.feedback('won', this.settings);
            }
            if (event.type === 'removed' || event.type === 'won' || event.type === 'failed')
                this.changed();
        }
        if (!this.modal || this.modal === 'won' || this.modal === 'failed')
            this.syncModal();
    }
    tick(ms) {
        require('../race/controller').refreshFriends(this);
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
        if (name === 'dismiss-modal' && this.modal) return require('./dismiss').dismiss(this);
        const raceAction = require('../race/controller').action(this, name);
        if (raceAction.handled) return raceAction.result;
        if (name === 'rush-notice-close' && ['rush-locked', 'rush-unlocked'].includes(this.modal)) {
            if (this.modal === 'rush-unlocked') this.challengeUnlockSeen = true;
            this.modal = null; if (this.screen === 'game' && this.session) { this.session.resume(); this.syncModal(); } this.changed(); return;
        }
        if (name === 'challenge' && this.screen === 'home' && !this.modal && this.unlocked < 20) { this.modal = 'rush-locked'; this.changed(); return; }
        if (name === 'challenge' && this.screen === 'home' && !this.modal && !this.loading && !this.retryRead) {
            this.campaignSnapshot = require('../persistence/store').snapshot(this);
            this.mode = 'challenge'; this.session = null; this.currentLevel = 30;
            return this.start(30);
        }
        if (name === 'items' && !this.loading && this.session && (this.modal === 'pause' || !this.modal && this.screen === 'game' && this.session.state === 'playing')) {
            if (this.session.moves.size) { this.say('请等箭头移出后再使用道具'); return; }
            this.itemsReturn = this.modal; this.session.pause(); this.modal = 'items'; this.changed(); return;
        }
        if (name === 'items-done' && this.modal === 'items') { this.modal = this.itemsReturn || null; if (!this.modal) this.session.resume(); this.changed(); return; }
        if (name.startsWith('item-') && !this.loading && this.session && (this.modal === 'items' || !this.modal && this.screen === 'game' && this.session.state === 'playing')) {
            const kind = name.slice(5), s = this.session;
            if (!Object.hasOwn(this.inventory, kind)) return;
            if (s.moves.size) { this.say('请等箭头移出后再使用道具'); return; }
            if (!this.inventory[kind]) { this.emptyReturn = this.modal; s.pause(); this.modal = 'item-empty'; this.changed(); return; }
            if (kind === 'time' && s.remainingMs !== null) { s.remainingMs += 30000; this.consumeItem('time'); }
            else if (kind === 'life' && s.lives !== null) { s.lives++; this.consumeItem('life'); }
            else if (kind === 'shuffle') return this.shuffle();
            else this.say(kind === 'time' ? '本关不限时，无需加时' : '本关不限次数，无需补充');
            this.changed(); return;
        }
        if (name === 'item-empty-close' && this.modal === 'item-empty') { this.modal = this.emptyReturn || null; if (!this.modal) this.session.resume(); this.changed(); return; }
        if (name === 'rush-accept' && this.modal === 'rush-ready') {
            this.modal = null; this.session.resume(); this.changed(); return;
        }
        if (name === 'home' && this.mode === 'challenge' && (this.modal || this.loadError)) {
            const settings = { ...this.settings }, inventory = { ...this.inventory };
            require('../persistence/store').restore(this, this.campaignSnapshot);
            this.settings = settings; this.inventory = inventory; this.mode = 'campaign'; this.campaignSnapshot = null;
            this.loading = this.loadError = false; this.message = ''; this.changed(); return;
        }
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
        else if (name === 'reset-progress-ask' && this.mode === 'campaign' && this.screen === 'home' && !this.modal && !this.retryRead) {
            this.resetReturn = this.modal;
            this.modal = 'reset-progress';
        }
        else if (name === 'reset-progress-cancel' && this.modal === 'reset-progress')
            this.modal = this.resetReturn || null;
        else if (name === 'reset-progress-confirm' && this.modal === 'reset-progress') {
            this.token++;
            this.platform.stopFeedback?.();
            this.session = null;
            this.currentLevel = this.unlocked = 1;
            this.tutorialDone = this.lifeIntroDone = false;
            this.challengeUnlockSeen = false;
            this.raceUnlockSeen = false;
            this.tutorialStep = 0;
            this.loading = this.loadError = false;
            this.screen = 'home';
            this.modal = this.settingsReturn = null;
            this.say('关卡进度已重置，从第 1 关重新开始');
        }
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
        else if (name === 'challenge-accept' && this.modal === 'challenge-intro') {
            this.modal = null;
            this.session.resume();
        }
        else if (name === 'next' && this.modal === 'won') {
            const number = this.mode === 'challenge' ? 30 : this.session.level.number + 1;
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
    consumeItem(kind) { this.inventory[kind]--; this.session.items[kind] = 0; this.session.itemUses[kind]++; }
    async shuffle() {
        const old = this.session, token = ++this.token;
        const returnModal = this.modal; this.shuffleReturn = returnModal;
        old.pause(); this.modal = 'shuffling'; this.changed();
        try {
            const level = await require('../generation/reshuffle').reshuffle(old, this.generate, this.platform.seed());
            if (token !== this.token || this.session !== old) return;
            const next = new Session(level);
            next.restartLevel = old.restartLevel || old.level;
            next.lives = old.lives; next.remainingMs = old.remainingMs;
            next.items = { ...old.items }; next.itemUses = { ...old.itemUses };
            next.pause(); this.session = next; this.consumeItem('shuffle');
        } catch { this.say('重排未完成，道具已保留'); }
        if (token === this.token) { this.modal = returnModal; if (!this.modal) this.session.resume(); this.changed(); }
    }
}
module.exports = { Controller };

