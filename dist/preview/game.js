(function(){'use strict';const modules={"src/main-browser.js":function(module,exports,require){
'use strict';
const { createBrowserPlatform } = require("src/platform/browser.js");
const { mount } = require("src/runtime.js");
const game = mount(createBrowserPlatform(document.querySelector('canvas'), window));
if (new URLSearchParams(location.search).has('debug')) {
    const { Session } = require("src/domain/session.js"), { fixtures } = require("src/fixtures.js"), { generate } = require("src/generation/generator.js"), { solve } = require("src/generation/validate.js");
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

},
"src/platform/browser.js":function(module,exports,require){
'use strict';
function createBrowserPlatform(canvas, win) {
    const music = require("src/platform/music.js").createMusic(() => {
        const a = new win.Audio('assets/music.wav');
        a.onError = fn => a.addEventListener('error', fn);
        a.destroy = () => { a.pause(); a.removeAttribute('src'); a.load(); };
        return a;
    });
    const { createFeedback } = require("src/platform/feedback.js");
    const feedback = createFeedback(kind => { const a = new win.Audio('assets/' + kind + '.wav'); a.volume = .25; return { play: () => a.play(), stop() { a.pause(); a.currentTime = 0; }, destroy() { a.pause(); a.src = ''; } }; }, () => win.navigator.vibrate?.(10));
    const doc = win.document;
    let ctx = canvas.getContext('2d');
    function info() { const r = canvas.getBoundingClientRect(); return { width: r.width, height: r.height, ratio: win.devicePixelRatio || 1, safeTop: 12, safeBottom: 12, menuBottom: 0 }; }
    function resize() { const i = info(); canvas.width = Math.round(i.width * i.ratio); canvas.height = Math.round(i.height * i.ratio); ctx = canvas.getContext('2d'); ctx.setTransform(i.ratio, 0, 0, i.ratio, 0, 0); return i; }
    resize();
    return { canvas, get ctx() { return ctx; }, info, resize, seed: () => Date.now() >>> 0, feedback: (kind, settings) => feedback.play(kind, settings), setMusic: enabled => music.set(enabled), stopFeedback: () => feedback.stop(), destroy: () => { feedback.destroy(); music.destroy(); }, storage: { get: key => win.localStorage.getItem(key), set: (key, value) => win.localStorage.setItem(key, value) }, requestFrame: fn => win.requestAnimationFrame(fn), cancelFrame: id => win.cancelAnimationFrame(id),
        listen(h) { const active = new Set(); const p = e => { const r = canvas.getBoundingClientRect(); return [e.pointerId, e.clientX - r.left, e.clientY - r.top]; }; canvas.addEventListener('pointerdown', e => { active.add(e.pointerId); canvas.setPointerCapture(e.pointerId); h.start(...p(e), active.size); }); canvas.addEventListener('pointermove', e => h.move(...p(e), active.size || 1)); canvas.addEventListener('pointerup', e => { h.end(...p(e)); active.delete(e.pointerId); }); canvas.addEventListener('pointercancel', () => { active.clear(); h.cancel(); }); doc.addEventListener('visibilitychange', () => doc.hidden ? h.hide() : h.show()); win.addEventListener('pagehide', () => h.hide()); win.addEventListener('resize', () => { resize(); h.resize(); }); }
    };
}
module.exports = { createBrowserPlatform };

},
"src/platform/music.js":function(module,exports,require){
'use strict';
// One reusable loop; a failed autoplay can retry on the next user gesture.
function createMusic(createAudio) {
    let audio = null, playing = false, destroyed = false, attempt = 0;
    return {
        set(enabled) {
            if (destroyed) return;
            if (!enabled) {
                attempt++;
                if (playing) { try { audio.pause(); } catch { try { audio.stop?.(); } catch { } } }
                playing = false; return;
            }
            if (playing) return;
            const token = ++attempt;
            try {
                if (!audio) {
                    audio = createAudio();
                    if (!audio) return;
                    audio.loop = true; audio.volume = .36;
                    audio.onError?.(() => { playing = false; });
                }
                playing = true;
                const result = audio.play();
                result?.catch?.(() => { if (token === attempt) playing = false; });
            } catch { playing = false; }
        },
        destroy() {
            this.set(false); destroyed = true;
            try { audio?.destroy?.(); } catch { }
            audio = null;
        }
    };
}
module.exports = { createMusic };

},
"src/platform/feedback.js":function(module,exports,require){
'use strict';
function createFeedback(createAudio, vibrate) {
    const sounds = new Map();
    return { play(kind, settings) {
            if (settings.vibration)
                try {
                    vibrate();
                }
                catch { }
            if (!settings.sound)
                return;
            try {
                let sound = sounds.get(kind);
                if (!sound) {
                    sound = createAudio(kind);
                    if (!sound)
                        return;
                    sounds.set(kind, sound);
                }
                else sound.stop?.();
                const result = sound.play();
                result?.catch?.(() => { });
            }
            catch { }
        }, stop() { for (const sound of sounds.values())
            try {
                sound.stop?.();
            }
            catch { } }, destroy() { for (const sound of sounds.values())
            try {
                sound.destroy?.();
            }
            catch { } sounds.clear(); } };
}
module.exports = { createFeedback };

},
"src/runtime.js":function(module,exports,require){
'use strict';
const { Controller } = require("src/ui/controller.js");
const { View } = require("src/ui/view.js");
const { Pointer, hitArrow } = require("src/input/pointer.js");
const { bindPersistence } = require("src/persistence/store.js");
function mount(platform, options = {}) {
    const app = new Controller(platform, options), view = new View(platform.ctx), pointer = new Pointer();
    let frameId = null, last = null, hidden = false, drag = null;
    if (platform.storage)
        bindPersistence(app, platform.storage);
    function render() { view.ctx = platform.ctx; view.render(app, platform.info()); }
    function frame(now) { if (hidden)
        return; const delta = last === null ? 0 : Math.max(0, now - last); last = now; app.tick(delta); render(); frameId = platform.requestFrame(frame); }
    platform.listen({ start: (id, x, y, count) => { platform.setMusic?.(!hidden && app.settings.music !== false); pointer.start(id, x, y, count); if (count !== 1) { drag = null; return; } if (!app.modal && view.transform && view.camera.zoom > 1 && view.camera.contains(x, y)) drag = { id, x, y }; }, move: (id, x, y, count) => { pointer.move(id, x, y, count); if (count !== 1) { drag = null; return; } if (drag && drag.id === id && !app.modal && pointer.invalid) { view.camera.pan(x - drag.x, y - drag.y); drag.x = x; drag.y = y; render(); } }, end: (...args) => { const p = pointer.end(...args); drag = null; if (!p)
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
            app.clickArrow(hitArrow(app.session.level, t.toBoard(p), app.session.removed, app.session.paths(), Math.max(.48, Math.min(.8, 8 / t.cell))));
            render();
        } }, cancel: () => { pointer.cancel(); drag = null; }, hide: () => { if (app.mode === 'campaign' && app.session?.moves.size) app.session.recordEligible = false; hidden = true; app.audioHidden = true; platform.setMusic?.(false); pointer.cancel(); drag = null; platform.cancelFrame(frameId); last = null; if (app.session && app.mode !== 'race')
            for (const id of [...app.session.moves.keys()])
                app.session.complete(id); app.events(); app.session?.pause(); app.persist?.(); platform.stopFeedback?.(); }, show: () => { if (!hidden)
            return; hidden = false; app.audioHidden = false; platform.setMusic?.(app.settings.music !== false); last = null; if (app.session?.state === 'paused' && !app.modal)
            app.session.resume(); frameId = platform.requestFrame(frame); }, resize: () => { pointer.cancel(); render(); } });
    platform.setMusic?.(app.settings.music !== false);
    render();
    frameId = platform.requestFrame(frame);
    return { app, view, render, stop() { hidden = true; platform.cancelFrame(frameId); platform.destroy?.(); } };
}
module.exports = { mount };

},
"src/ui/controller.js":function(module,exports,require){
'use strict';
const { Session } = require("src/domain/session.js");
const { generateAsync } = require("src/generation/generator.js");
const { CONFIG, lifeLimit } = require("src/config.js");
class Controller {
    constructor(platform, options = {}) {
        this.platform = platform;
        this.generate = options.generate || generateAsync;
        this.fixedCampaign = !options.generate;
        this.screen = 'home';
        this.modal = null;
        this.session = null;
        this.currentLevel = 1;
        this.unlocked = 1;
        this.settings = { music: true, sound: true, vibration: true };
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
        this.rewardClaims = []; this.levelBests = {}; this.rewardNotice = "";
    }
    changed() { this.dirty = true; this.platform.setMusic?.(!this.audioHidden && this.settings.music !== false); this.onChange(); }
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
            const result = await (this.mode === 'campaign' && this.fixedCampaign ? require("src/campaign/catalog.js").load(number) : this.generate(number, this.platform.seed()));
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
        if (this.session.level.lifeLimit !== null && !this.lifeIntroDone) {
            this.session.pause();
            this.modal = 'life-intro';
        }
        else
            this.modal = null;
        if (!this.modal && (this.session.level.campaignConfigured ? ((this.session.level.timeLimitMs != null && this.session.level.number === 2) || ((this.session.level.obstacles || []).length && this.session.level.number === 4)) : [15, 20].includes(this.session.level.number))) {
            this.session.pause(); this.modal = 'challenge-intro';
        }
    }
    syncModal() {
        if (this.mode === 'race') { require("src/race/controller.js").sync(this); return; }
        if (this.mode === 'campaign' && this.unlocked >= 20 && !this.challengeUnlockSeen) { this.session.pause(); this.modal = 'rush-unlocked'; return; }
        if (require("src/ui/life-rescue.js").eligible(this)) { this.modal = 'life-rescue'; return; }
        if (require("src/ui/time-rescue.js").eligible(this)) { this.modal = 'time-rescue'; return; }
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
        if (this.mode === 'campaign' && this.session.state === 'won') require("src/campaign/catalog.js").completed(this);
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
        require("src/race/controller.js").refreshFriends(this);
        if (this.screen === 'game' && this.session && !this.loading && !['life-rescue', 'time-rescue'].includes(this.modal)) {
            if (this.mode === 'campaign' && this.session.state === 'playing') this.session.recordMs += require("src/campaign/catalog.js").activeMs(this.session, ms);
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
        if (name === 'dismiss-modal' && this.modal) return require("src/ui/dismiss.js").dismiss(this);
        if (require("src/campaign/controller.js").action(this, name)) return;
        if (require("src/ui/life-rescue.js").action(this, name)) return;
        if (require("src/ui/time-rescue.js").action(this, name)) return;
        const raceAction = require("src/race/controller.js").action(this, name);
        if (raceAction.handled) return raceAction.result;
        if (name === 'rush-notice-close' && ['rush-locked', 'rush-unlocked'].includes(this.modal)) {
            if (this.modal === 'rush-unlocked') this.challengeUnlockSeen = true;
            this.modal = null; if (this.screen === 'game' && this.session) { this.session.resume(); this.syncModal(); } this.changed(); return;
        }
        if (name === 'challenge' && this.screen === 'home' && !this.modal && this.unlocked < 20) { this.modal = 'rush-locked'; this.changed(); return; }
        if (name === 'challenge' && this.screen === 'home' && !this.modal && !this.loading && !this.retryRead) {
            this.campaignSnapshot = require("src/persistence/store.js").snapshot(this);
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
            require("src/persistence/store.js").restore(this, this.campaignSnapshot);
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
        else if (name === 'music' && this.modal === 'settings')
            this.settings.music = !this.settings.music;
        else if (name === 'sound' && this.modal === 'settings') {
            this.settings.sound = !this.settings.sound;
            if (!this.settings.sound)
                this.platform.stopFeedback?.();
            else this.platform.feedback('won', { sound: true, vibration: false });
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
            if (this.mode === 'campaign' && this.session.level.number >= require("src/campaign/catalog.js").levels.length) return this.action('level-map');
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
            const level = await require("src/generation/reshuffle.js").reshuffle(old, this.generate, this.platform.seed());
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


},
"src/domain/session.js":function(module,exports,require){
'use strict';
const { validateLevel, clone, occupancy, firstBlocker, exitCells, key } = require("src/domain/board.js");
const { bodyAt, completionDistance, occupiedByBody } = require("src/movement/path.js");
const { CONFIG } = require("src/config.js");
class Session {
    constructor(level) {
        const result = validateLevel(level);
        if (!result.valid)
            throw new Error('Invalid level: ' + result.errors.join(','));
        this.level = clone(level);
        this.restartLevel = null;
        this.items = { time: 1, life: 1, shuffle: 1 };
        this.itemUses = { time: 0, life: 0, shuffle: 0 };
        this.removed = new Set();
        this.moves = new Map();
        this.feedback = new Map();
        this.lives = level.lifeLimit;
        this.state = 'playing';
        this.time = 0;
        this.recordMs = 0; this.recordEligible = true;
        this.events = [];
        this.remainingMs = level.timeLimitMs ?? null;
        this.failureReason = null;
    }
    get remaining() { return this.level.arrows.length - this.removed.size; }
    emit(type, data = {}) { this.events.push({ type, ...data }); }
    drainEvents() { const events = this.events; this.events = []; return events; }
    classify(id) {
        if (this.state !== 'playing')
            return { type: 'locked' };
        if (!id || this.removed.has(id))
            return { type: 'empty' };
        const arrow = this.level.arrows.find(a => a.id === id);
        if (!arrow)
            return { type: 'empty' };
        if (this.moves.has(id))
            return { type: 'moving' };
        if ((this.feedback.get(id)?.until || 0) > this.time)
            return { type: 'feedback' };
        const excluded = new Set([...this.removed, ...this.moves.keys()]);
        const occupied = occupancy(this.level, excluded);
        for (const [movingId, move] of this.moves) {
            const movingArrow = this.level.arrows.find(a => a.id === movingId);
            for (const cell of occupiedByBody(movingArrow, move.distance, this.level))
                occupied.set(cell, movingId);
        }
        const blocker = firstBlocker(arrow, this.level, occupied);
        if (blocker)
            return { type: this.moves.has(blocker.id) ? 'temporary' : 'blocked', blocker, arrow };
        const ray = new Set(exitCells(arrow, this.level).map(key));
        for (const movingId of this.moves.keys()) {
            const other = this.level.arrows.find(a => a.id === movingId);
            if (exitCells(other, this.level).some(p => ray.has(key(p))))
                return { type: 'temporary', arrow };
        }
        return { type: 'allowed', arrow };
    }
    click(id) {
        const result = this.classify(id);
        if (result.type === 'blocked') {
            if (this.lives !== null)
                this.lives--;
            this.feedback.set(id, { until: this.time + CONFIG.feedbackMs, blocker: result.blocker });
            this.emit('blocked', { id, blocker: result.blocker, lives: this.lives });
            if (this.lives === 0) {
                this.state = 'failed';
                this.failureReason = 'lives';
                this.emit('failed');
            }
        }
        else if (result.type === 'allowed') {
            const speed = CONFIG.speed + exitCells(result.arrow, this.level).length * CONFIG.distanceSpeed + Math.max(0, result.arrow.path.length - 6) * CONFIG.lengthSpeed;
            this.moves.set(id, { id, distance: 0, elapsedMs: 0, speed });
            this.emit('move-start', { id });
        }
        return result;
    }
    complete(id) {
        if (!this.moves.has(id) || this.removed.has(id))
            return false;
        this.moves.delete(id);
        this.removed.add(id);
        this.emit('removed', { id, remaining: this.remaining });
        if (this.remaining === 0 && this.state !== 'failed' && this.state !== 'won') {
            this.state = 'won';
            this.emit('won');
        }
        return true;
    }
    tick(ms) {
        if (this.state === 'paused')
            return;
        if (!Number.isFinite(ms) || ms < 0)
            throw new Error('Invalid elapsed time');
        if (this.state === 'playing' && this.remainingMs !== null) {
            if (this.moves.size === this.remaining && this.remaining > 0) {
                const finish = Math.max(...[...this.moves].map(([id, move]) => Math.max(0, completionDistance(this.level.arrows.find(a => a.id === id), this.level) * 1000 / move.speed - move.elapsedMs)));
                if (finish < this.remainingMs && finish <= ms) ms = finish;
            }
            const elapsed = Math.min(ms, this.remainingMs);
            this.remainingMs -= elapsed;
            ms = elapsed;
            if (this.remainingMs === 0) { this.state = 'failed'; this.failureReason = 'timeout'; this.emit('failed', { reason: 'timeout' }); }
        }
        this.time += ms;
        for (const [id, f] of this.feedback)
            if (f.until <= this.time)
                this.feedback.delete(id);
        for (const [id, move] of this.moves) {
            const arrow = this.level.arrows.find(a => a.id === id);
            move.elapsedMs += ms;
            move.distance = move.elapsedMs * move.speed / 1000;
            if (move.distance + 1e-9 >= completionDistance(arrow, this.level))
                this.complete(id);
        }
    }
    paths() { const result = new Map(); for (const [id, m] of this.moves)
        result.set(id, bodyAt(this.level.arrows.find(a => a.id === id), m.distance)); return result; }
    pause() { if (this.state === 'playing') {
        this.state = 'paused';
        return true;
    } return false; }
    resume() { if (this.state === 'paused')
        this.state = 'playing'; }
    restart() { return new Session(this.restartLevel || this.level); }
}
module.exports = { Session };

},
"src/domain/board.js":function(module,exports,require){
'use strict';
const DIRS = Object.freeze({ up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] });
const key = p => p[0] + ',' + p[1];
const inside = (p, level) => p[0] >= 0 && p[1] >= 0 && p[0] < level.width && p[1] < level.height;
const clone = value => JSON.parse(JSON.stringify(value));
function exitCells(a, level) {
    const d = DIRS[a.direction], h = a.path[a.path.length - 1], cells = [];
    for (let p = [h[0] + d[0], h[1] + d[1]]; inside(p, level); p = [p[0] + d[0], p[1] + d[1]])
        cells.push(p);
    return cells;
}
function validateLevel(level) {
    const errors = [];
    if (!level || !Number.isInteger(level.width) || !Number.isInteger(level.height) || level.width < 2 || level.height < 2 || level.width > 32 || level.height > 32 || !Array.isArray(level.arrows) || !level.arrows.length)
        return { valid: false, errors: ['invalid-board'] };
    if (level.lifeLimit !== null && (!Number.isInteger(level.lifeLimit) || level.lifeLimit < 1))
        errors.push('invalid-life-limit');
    const ids = new Set(), occupied = new Map();
    if (level.timeLimitMs != null && (!Number.isInteger(level.timeLimitMs) || level.timeLimitMs <= 0)) errors.push('invalid-time-limit');
    if (level.obstacles !== undefined && !Array.isArray(level.obstacles)) return { valid: false, errors: ['invalid-obstacles'] };
    for (const p of level.obstacles || []) {
        if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isInteger) || !inside(p, level)) { errors.push('invalid-obstacle'); continue; }
        if (occupied.has(key(p))) errors.push('overlap');
        occupied.set(key(p), '@stone:' + key(p));
    }
    for (const a of level.arrows) {
        if (!a || typeof a !== 'object') {
            errors.push('invalid-arrow');
            continue;
        }
        if (typeof a.id !== 'string' || !a.id || ids.has(a.id))
            errors.push('duplicate-or-invalid-id');
        ids.add(a.id);
        if (!DIRS[a.direction] || !Array.isArray(a.path) || a.path.length < 2) {
            errors.push('invalid-arrow');
            continue;
        }
        let valid = true;
        const own = new Set();
        for (let i = 0; i < a.path.length; i++) {
            const p = a.path[i];
            if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isInteger) || !inside(p, level)) {
                errors.push('out-of-bounds');
                valid = false;
                continue;
            }
            const k = key(p);
            if (own.has(k)) {
                errors.push('self-intersection');
                valid = false;
            }
            own.add(k);
            if (occupied.has(k) && occupied.get(k) !== a.id)
                errors.push('overlap');
            occupied.set(k, a.id);
            if (i && (!Array.isArray(a.path[i - 1]) || Math.abs(p[0] - a.path[i - 1][0]) + Math.abs(p[1] - a.path[i - 1][1]) !== 1)) {
                errors.push('disconnected-path');
                valid = false;
            }
        }
        if (!valid)
            continue;
        const h = a.path[a.path.length - 1], p = a.path[a.path.length - 2], d = DIRS[a.direction];
        if (h[0] - p[0] !== d[0] || h[1] - p[1] !== d[1])
            errors.push('head-direction-mismatch');
        if (exitCells(a, level).some(p => own.has(key(p))))
            errors.push('self-blocked');
    }
    return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
function occupancy(level, excluded = new Set()) {
    const map = new Map();
    for (const p of level.obstacles || []) map.set(key(p), '@stone:' + key(p));
    for (const a of level.arrows)
        if (!excluded.has(a.id))
            for (const p of a.path)
                map.set(key(p), a.id);
    return map;
}
function firstBlocker(a, level, occupied) {
    for (const p of exitCells(a, level))
        if (occupied.has(key(p)))
            return { id: occupied.get(key(p)), cell: p };
    return null;
}
module.exports = { DIRS, key, inside, clone, exitCells, validateLevel, occupancy, firstBlocker };

},
"src/movement/path.js":function(module,exports,require){
'use strict';
const { DIRS, key } = require("src/domain/board.js");
const CLEARANCE = .16;
function pointAt(arrow, distance) {
    const path = arrow.path, L = path.length - 1;
    if (distance >= L) {
        const h = path[L], d = DIRS[arrow.direction];
        return [h[0] + d[0] * (distance - L), h[1] + d[1] * (distance - L)];
    }
    const i = Math.max(0, Math.floor(distance)), f = distance - i, a = path[i], b = path[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
function bodyAt(arrow, distance) {
    const end = arrow.path.length - 1 + distance, result = [pointAt(arrow, distance)];
    for (let i = Math.floor(distance) + 1; i < Math.min(end, arrow.path.length - 1); i++)
        result.push(arrow.path[i]);
    if (distance < arrow.path.length - 1 && end > arrow.path.length - 1)
        result.push(arrow.path[arrow.path.length - 1]);
    result.push(pointAt(arrow, end));
    return result;
}
function completionDistance(arrow, level) { const h = arrow.path[arrow.path.length - 1]; return arrow.path.length - 1 + ({ up: h[1] + .5, down: level.height - .5 - h[1], left: h[0] + .5, right: level.width - .5 - h[0] }[arrow.direction]) + CLEARANCE; }
function segmentDistance(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], sq = dx * dx + dy * dy; const t = sq ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / sq)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
function occupiedByBody(arrow, distance, level) {
    const points = bodyAt(arrow, distance), cells = new Set();
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        for (let x = Math.max(0, Math.ceil(Math.min(a[0], b[0]) - CLEARANCE)); x <= Math.min(level.width - 1, Math.floor(Math.max(a[0], b[0]) + CLEARANCE)); x++)
            for (let y = Math.max(0, Math.ceil(Math.min(a[1], b[1]) - CLEARANCE)); y <= Math.min(level.height - 1, Math.floor(Math.max(a[1], b[1]) + CLEARANCE)); y++)
                if (segmentDistance([x, y], a, b) <= CLEARANCE)
                    cells.add(key([x, y]));
    }
    return cells;
}
module.exports = { pointAt, bodyAt, completionDistance, segmentDistance, occupiedByBody, CLEARANCE };

},
"src/config.js":function(module,exports,require){
'use strict';
const CONFIG = Object.freeze({
    title: '箭间', version: 1, generatorVersion: 4, profileVersion: 8,
    speed: 24, distanceSpeed: 2, lengthSpeed: 4, feedbackMs: 200, messageMs: 1200, dragTolerance: 10,
    lifeStart: 3, lives: 3, campaignLength: 20,
    profiles: [
        { name: '初见', size: 6, minFill: .35, maxFill: .50, maxLength: 6, maxTurns: 2, minDepth: 1, maxOpenRatio: 1 },
        { name: '寻路', size: 8, minFill: .50, maxFill: .63, maxLength: 9, maxTurns: 3, minDepth: 2, maxOpenRatio: .8 },
        { name: '交错', size: 10, minFill: .63, maxFill: .73, maxLength: 12, maxTurns: 4, minDepth: 3, maxOpenRatio: .7 },
        { name: '解围', size: 12, minFill: .70, maxFill: .82, maxLength: 16, maxTurns: 5, minDepth: 4, maxOpenRatio: .6 },
        { name: '深锁', size: 14, minFill: 1, maxFill: 1, maxLength: 9, maxTurns: 7, minDepth: 10, maxOpenRatio: .05, minArrows: 36, maxInitialOpen: 1, dense: true },
        ...[16, 18, 20].map((size, i) => ({ name: ['迷阵', '重围', '极境'][i], size, minFill: 1, maxFill: 1, maxLength: 9, maxTurns: 7, minDepth: 12 + i * 2, maxOpenRatio: .05, minArrows: Math.floor(size * size / 5), maxInitialOpen: 1, dense: true }))
    ]
});
function profileIndex(number) { return number <= 1 ? 0 : number <= 2 ? 1 : 4 + Math.min(3, Math.floor((number - 3) / 5)); }
function lifeLimit(number) { return number >= CONFIG.lifeStart ? CONFIG.lives : null; }
function obstacleCount(number) { return number < 15 ? 0 : Math.min(4, 1 + Math.floor((number - 15) / 5)); }
function timeLimit(number) { return number < 20 ? null : Math.max(120, 180 - Math.floor((number - 20) / 5) * 10) * 1000; }
module.exports = { CONFIG, profileIndex, lifeLimit, obstacleCount, timeLimit };






},
"src/generation/generator.js":function(module,exports,require){
'use strict';
const { CONFIG, profileIndex, lifeLimit, obstacleCount, timeLimit } = require("src/config.js");
const { DIRS, key, inside, exitCells, clone } = require("src/domain/board.js");
const { random, shuffle } = require("src/generation/random.js");
const { solve } = require("src/generation/validate.js");
const { fixtures } = require("src/fixtures.js");
function acceptable(metrics, profile) { return metrics.fill >= profile.minFill && metrics.fill <= profile.maxFill && metrics.depth >= profile.minDepth && metrics.openRatio <= profile.maxOpenRatio && metrics.arrowCount >= (profile.minArrows || 0) && metrics.initialOpen <= (profile.maxInitialOpen ?? Infinity); }
function* candidate(number, seed, profile, rng) {
    const level = { number, width: profile.size, height: profile.size, seed: seed >>> 0, generatorVersion: CONFIG.generatorVersion, profileVersion: CONFIG.profileVersion, lifeLimit: lifeLimit(number), arrows: [] };
    level.timeLimitMs = timeLimit(number);
    level.obstacles = [];
    while (level.obstacles.length < obstacleCount(number)) {
        const p = [1 + Math.floor(rng() * (profile.size - 2)), 1 + Math.floor(rng() * (profile.size - 2))];
        if (!level.obstacles.some(q => key(q) === key(p))) level.obstacles.push(p);
    }
    if (profile.dense) return yield* require("src/generation/dense.js").denseCandidate(level, profile, rng);
    const occupied = new Set(), target = Math.ceil(profile.minFill * profile.size ** 2 + rng() * (profile.maxFill - profile.minFill) * profile.size ** 2);
    const maxCells = Math.floor(profile.maxFill * profile.size ** 2);
    for (let attempt = 0; attempt < 1500 && occupied.size < target; attempt++) {
        if (attempt % 40 === 0)
            yield null;
        const h = [Math.floor(rng() * profile.size), Math.floor(rng() * profile.size)];
        if (occupied.has(key(h)))
            continue;
        const direction = Object.keys(DIRS)[Math.floor(rng() * 4)], d = DIRS[direction];
        const exit = exitCells({ path: [h], direction }, level);
        if (exit.some(p => occupied.has(key(p))))
            continue;
        const forbidden = new Set(exit.map(key)), prev = [h[0] - d[0], h[1] - d[1]];
        if (!inside(prev, level) || occupied.has(key(prev)) || occupied.size + 2 > maxCells)
            continue;
        const reverse = [h, prev], own = new Set([key(h), key(prev)]);
        const length = Math.min(2 + Math.floor(rng() * (profile.maxLength - 1)), maxCells - occupied.size);
        let turns = 0, last = [-d[0], -d[1]];
        while (reverse.length < length) {
            const tail = reverse[reverse.length - 1];
            let found = false;
            for (const v of shuffle(Object.values(DIRS), rng)) {
                const p = [tail[0] + v[0], tail[1] + v[1]], k = key(p), turn = v[0] !== last[0] || v[1] !== last[1];
                if (!inside(p, level) || occupied.has(k) || own.has(k) || forbidden.has(k) || turn && turns >= profile.maxTurns)
                    continue;
                reverse.push(p);
                own.add(k);
                if (turn)
                    turns++;
                last = v;
                found = true;
                break;
            }
            if (!found)
                break;
        }
        const arrow = { id: 'a' + level.arrows.length, path: reverse.reverse(), direction };
        level.arrows.push(arrow);
        for (const p of arrow.path)
            occupied.add(key(p));
    }
    return level;
}
function* generateSteps(number, seed, options = {}) {
    if (!Number.isInteger(number) || number < 1 || !Number.isInteger(seed))
        throw new Error('Invalid generation input');
    if (number === 1 && !options.forceRandom) {
        const l = clone(fixtures.tutorial);
        l.seed = seed >>> 0;
        l.profileVersion = CONFIG.profileVersion;
        return { level: l, validation: solve(l), attempts: 0, fallback: false };
    }
    const profile = CONFIG.profiles[profileIndex(number)], rng = random(seed), maxAttempts = options.maxAttempts ?? 48;
    for (let i = 0; i < maxAttempts; i++) {
        const level = yield* candidate(number, seed, profile, rng), validation = solve(level);
        if (validation.valid && acceptable(validation.metrics, profile))
            return { level, validation, attempts: i + 1, fallback: false };
        yield null;
    }
    if (options.noFallback)
        throw new Error('Generation budget exhausted for ' + number + '/' + seed);
    const fallbacks = require("src/generation/fallbacks.js");
    const level = clone(obstacleCount(number) ? require("src/generation/obstacle-fallbacks.js")[profile.size + ':' + obstacleCount(number)] : fallbacks[profileIndex(number)]);
    if (!level)
        throw new Error('Missing verified fallback');
    level.number = number;
    level.seed = seed >>> 0;
    level.lifeLimit = lifeLimit(number);
    level.timeLimitMs = timeLimit(number);
    level.profileVersion = CONFIG.profileVersion;
    level.generatorVersion = CONFIG.generatorVersion;
    const validation = solve(level);
    if (!validation.valid || !acceptable(validation.metrics, profile))
        throw new Error('Invalid fallback');
    return { level, validation, attempts: maxAttempts, fallback: true };
}
function generate(number, seed, options) { const task = generateSteps(number, seed, options); let step; do {
    step = task.next();
} while (!step.done); return step.value; }
function generateAsync(number, seed, { schedule = fn => setTimeout(fn, 0), ...options } = {}) {
    const task = generateSteps(number, seed, options);
    return new Promise((resolve, reject) => { function step() { try {
        const started = Date.now();
        for (let work = 0; work < 12; work++) {
            const result = task.next();
            if (result.done) { resolve(result.value); return; }
            if (Date.now() - started >= 8) break;
        }
        schedule(step);
    }
    catch (e) {
        reject(e);
    } } step(); });
}
module.exports = { generate, generateSteps, generateAsync, acceptable, candidate };

},
"src/generation/random.js":function(module,exports,require){
'use strict';
function random(seed) { let state = seed >>> 0; return () => { state = (state + 0x6D2B79F5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(items, rng) { const a = items.slice(); for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
} return a; }
module.exports = { random, shuffle };

},
"src/generation/validate.js":function(module,exports,require){
'use strict';
const { validateLevel, DIRS, key } = require("src/domain/board.js");
function solve(level) {
    const check = validateLevel(level);
    if (!check.valid)
        return { ...check, sequence: [], layers: [], metrics: null };
    const pending = new Map(level.arrows.map(a => [a.id, a])), sequence = [], layers = [];
    while (pending.size) {
        const used = new Map();
        for (const p of level.obstacles || []) used.set(key(p), '@stone');
        for (const a of pending.values())
            for (const p of a.path)
                used.set(key(p), a.id);
        const ready = [];
        for (const a of pending.values()) {
            const h = a.path[a.path.length - 1], d = DIRS[a.direction];
            let blocked = false;
            for (let x = h[0] + d[0], y = h[1] + d[1]; x >= 0 && y >= 0 && x < level.width && y < level.height; x += d[0], y += d[1])
                if (used.has(x + ',' + y)) {
                    blocked = true;
                    break;
                }
            if (!blocked)
                ready.push(a.id);
        }
        if (!ready.length)
            return { valid: false, errors: ['unsolvable'], sequence, layers, remaining: [...pending.keys()], metrics: null };
        layers.push(ready);
        for (const id of ready) {
            sequence.push(id);
            pending.delete(id);
        }
    }
    let cells = (level.obstacles || []).length, turns = 0;
    for (const a of level.arrows) {
        cells += a.path.length;
        for (let i = 2; i < a.path.length; i++)
            if (a.path[i][0] - a.path[i - 1][0] !== a.path[i - 1][0] - a.path[i - 2][0] || a.path[i][1] - a.path[i - 1][1] !== a.path[i - 1][1] - a.path[i - 2][1])
                turns++;
    }
    return { valid: true, errors: [], sequence, layers, metrics: { fill: cells / (level.width * level.height), arrowCount: level.arrows.length, averageLength: (cells - (level.obstacles || []).length) / level.arrows.length, turns, depth: layers.length, initialOpen: layers[0].length, openRatio: layers[0].length / level.arrows.length } };
}
module.exports = { solve };


},
"src/fixtures.js":function(module,exports,require){
'use strict';
const arrow = (id, path, direction) => ({ id, path, direction });
const level = (arrows, extra = {}) => ({ number: 1, width: 6, height: 6, seed: 1, generatorVersion: 1, profileVersion: 1, lifeLimit: null, arrows, ...extra });
const fixtures = {
    tutorial: level([
        arrow('first', [[1, 1], [2, 1], [3, 1]], 'right'),
        arrow('second', [[1, 4], [2, 4], [2, 3], [2, 2]], 'up'),
        arrow('third', [[4, 3], [4, 4], [4, 5]], 'down')
    ]),
    bent: level([arrow('bend', [[1, 4], [1, 3], [2, 3], [3, 3], [3, 2]], 'up')]),
    blocked: level([arrow('a', [[0, 2], [1, 2]], 'right'), arrow('b', [[4, 3], [4, 2], [4, 1]], 'up')]),
    cycle: level([arrow('a', [[1, 1], [2, 1]], 'right'), arrow('b', [[4, 1], [4, 2]], 'down'), arrow('c', [[4, 4], [3, 4]], 'left'), arrow('d', [[1, 4], [1, 3]], 'up')]),
    selfBlocked: level([arrow('a', [[2, 0], [3, 0], [3, 1], [3, 2], [2, 2], [2, 1]], 'up')]),
    boundary: level([arrow('a', [[4, 0], [5, 0]], 'right')])
};
module.exports = { arrow, level, fixtures };

},
"src/generation/dense.js":function(module,exports,require){
'use strict';
const { DIRS } = require("src/domain/board.js");
const { shuffle } = require("src/generation/random.js");
const cache = new Map();
function geometry(width, height) {
    const cacheKey = width + ',' + height;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const cells = Array.from({ length: width * height }, (_, id) => {
        const x = id % width, y = Math.floor(id / width), neighbors = [], exits = [];
        for (const [direction, [dx, dy]] of Object.entries(DIRS)) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < width && ny < height) neighbors.push(ny * width + nx);
            const px = x - dx, py = y - dy;
            if (px < 0 || py < 0 || px >= width || py >= height) continue;
            const ray = [];
            for (let rx = nx, ry = ny; rx >= 0 && ry >= 0 && rx < width && ry < height; rx += dx, ry += dy) ray.push(ry * width + rx);
            exits.push({ direction, previous: py * width + px, ray });
        }
        return { point: [x, y], neighbors, exits };
    });
    cache.set(cacheKey, cells);
    return cells;
}
// Peel paths from a full board in removal order; each new path exits through earlier paths.
function* denseCandidate(level, profile, rng) {
    const cells = geometry(level.width, level.height);
    const stones = new Set((level.obstacles || []).map(p => p[1] * level.width + p[0]));
    const occupied = new Set(cells.map((_, i) => i).filter(i => !stones.has(i))), last = new Set();
    const depths = new Map();
    while (occupied.size) {
        yield null;
        const choices = [];
        for (const head of occupied) for (const exit of cells[head].exits) {
            if (!occupied.has(exit.previous) || exit.ray.some(p => occupied.has(p) || stones.has(p))) continue;
            if (level.arrows.length && !exit.ray.length) continue;
            const depth = profile.depthCeiling ? Math.max(0, ...exit.ray.map(p => depths.get(p) || 0)) + 1 : 0;
            if (profile.depthCeiling && depth > profile.depthCeiling) continue;
            choices.push({ head, ...exit, depth, score: profile.depthCeiling ? depth : exit.ray.some(p => last.has(p)) ? 1 : 0 });
        }
        const ordered = shuffle(choices, rng).sort((a, b) => b.score - a.score);
        let accepted = false;
        for (const choice of ordered) {
            const path = [choice.head, choice.previous], own = new Set(path);
            const minimum = profile.minTargetLength || 3;
            const target = minimum + Math.floor(rng() * (profile.maxLength - minimum + 1));
            while (path.length < target) {
                const next = shuffle(cells[path[path.length - 1]].neighbors, rng).find(p => occupied.has(p) && !own.has(p));
                if (next === undefined) break;
                path.push(next); own.add(next);
            }
            while (path.length >= 2) {
                let isolated = false;
                for (const value of occupied) {
                    if (!own.has(value) && !cells[value].neighbors.some(p => occupied.has(p) && !own.has(p))) { isolated = true; break; }
                }
                if (!isolated) break;
                own.delete(path.pop());
            }
            if (path.length < 2) continue;
            for (const value of own) occupied.delete(value);
            if (profile.depthCeiling) for (const value of own) depths.set(value, choice.depth);
            last.clear(); for (const value of own) last.add(value);
            level.arrows.push({ id: 'a' + level.arrows.length, path: path.reverse().map(p => cells[p].point.slice()), direction: choice.direction });
            accepted = true;
            break;
        }
        if (!accepted) break;
    }
    return level;
}
module.exports = { denseCandidate };

},
"src/generation/fallbacks.js":function(module,exports,require){
'use strict';
// Verified fallback layouts; do not regenerate on restart.
module.exports=[
  {
    "number": 1,
    "width": 6,
    "height": 6,
    "seed": 92001,
    "generatorVersion": 4,
    "profileVersion": 8,
    "lifeLimit": null,
    "arrows": [
      {
        "id": "a0",
        "path": [
          [
            5,
            2
          ],
          [
            4,
            2
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a1",
        "path": [
          [
            2,
            2
          ],
          [
            1,
            2
          ],
          [
            0,
            2
          ],
          [
            0,
            1
          ],
          [
            0,
            0
          ],
          [
            1,
            0
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a2",
        "path": [
          [
            1,
            3
          ],
          [
            2,
            3
          ],
          [
            2,
            4
          ],
          [
            2,
            5
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a3",
        "path": [
          [
            5,
            5
          ],
          [
            5,
            4
          ],
          [
            4,
            4
          ],
          [
            3,
            4
          ],
          [
            3,
            3
          ]
        ],
        "direction": "up"
      }
    ],
    "timeLimitMs": null,
    "obstacles": []
  },
  {
    "number": 2,
    "width": 8,
    "height": 8,
    "seed": 92002,
    "generatorVersion": 4,
    "profileVersion": 8,
    "lifeLimit": null,
    "arrows": [
      {
        "id": "a0",
        "path": [
          [
            4,
            1
          ],
          [
            4,
            0
          ],
          [
            3,
            0
          ],
          [
            3,
            1
          ],
          [
            2,
            1
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a1",
        "path": [
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            0,
            2
          ],
          [
            0,
            3
          ],
          [
            1,
            3
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a2",
        "path": [
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ],
          [
            7,
            4
          ],
          [
            7,
            5
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a3",
        "path": [
          [
            7,
            0
          ],
          [
            6,
            0
          ],
          [
            6,
            1
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a4",
        "path": [
          [
            1,
            4
          ],
          [
            2,
            4
          ],
          [
            3,
            4
          ],
          [
            3,
            5
          ],
          [
            2,
            5
          ],
          [
            1,
            5
          ],
          [
            0,
            5
          ],
          [
            0,
            6
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a5",
        "path": [
          [
            1,
            7
          ],
          [
            1,
            6
          ],
          [
            2,
            6
          ],
          [
            2,
            7
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a6",
        "path": [
          [
            4,
            4
          ],
          [
            5,
            4
          ],
          [
            5,
            3
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a7",
        "path": [
          [
            5,
            2
          ],
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            6,
            4
          ],
          [
            6,
            5
          ]
        ],
        "direction": "down"
      }
    ],
    "timeLimitMs": null,
    "obstacles": []
  },
  {
    "number": 9,
    "width": 10,
    "height": 10,
    "seed": 92002,
    "generatorVersion": 1,
    "profileVersion": 1,
    "lifeLimit": null,
    "arrows": [
      {
        "id": "a0",
        "path": [
          [
            6,
            2
          ],
          [
            5,
            2
          ],
          [
            5,
            1
          ],
          [
            5,
            0
          ],
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            3,
            1
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a1",
        "path": [
          [
            1,
            1
          ],
          [
            1,
            2
          ],
          [
            0,
            2
          ],
          [
            0,
            3
          ],
          [
            0,
            4
          ],
          [
            0,
            5
          ],
          [
            0,
            6
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a2",
        "path": [
          [
            6,
            8
          ],
          [
            6,
            7
          ],
          [
            6,
            6
          ],
          [
            6,
            5
          ],
          [
            6,
            4
          ],
          [
            5,
            4
          ],
          [
            4,
            4
          ],
          [
            4,
            3
          ],
          [
            4,
            2
          ],
          [
            3,
            2
          ],
          [
            3,
            3
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a3",
        "path": [
          [
            0,
            7
          ],
          [
            0,
            8
          ],
          [
            0,
            9
          ],
          [
            1,
            9
          ],
          [
            1,
            8
          ],
          [
            1,
            7
          ],
          [
            1,
            6
          ],
          [
            1,
            5
          ],
          [
            1,
            4
          ],
          [
            1,
            3
          ],
          [
            2,
            3
          ],
          [
            2,
            2
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a4",
        "path": [
          [
            3,
            8
          ],
          [
            3,
            7
          ],
          [
            3,
            6
          ],
          [
            4,
            6
          ],
          [
            4,
            5
          ],
          [
            5,
            5
          ],
          [
            5,
            6
          ],
          [
            5,
            7
          ],
          [
            5,
            8
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a5",
        "path": [
          [
            7,
            0
          ],
          [
            8,
            0
          ],
          [
            9,
            0
          ],
          [
            9,
            1
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a6",
        "path": [
          [
            2,
            4
          ],
          [
            2,
            5
          ],
          [
            2,
            6
          ],
          [
            2,
            7
          ],
          [
            2,
            8
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a7",
        "path": [
          [
            2,
            9
          ],
          [
            3,
            9
          ],
          [
            4,
            9
          ],
          [
            5,
            9
          ],
          [
            6,
            9
          ],
          [
            7,
            9
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a8",
        "path": [
          [
            3,
            0
          ],
          [
            2,
            0
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a9",
        "path": [
          [
            5,
            3
          ],
          [
            6,
            3
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a10",
        "path": [
          [
            7,
            8
          ],
          [
            8,
            8
          ]
        ],
        "direction": "right"
      }
    ]
  },
  {
    "number": 16,
    "width": 12,
    "height": 12,
    "seed": 92003,
    "generatorVersion": 1,
    "profileVersion": 1,
    "lifeLimit": null,
    "arrows": [
      {
        "id": "a0",
        "path": [
          [
            9,
            1
          ],
          [
            9,
            2
          ],
          [
            9,
            3
          ],
          [
            9,
            4
          ],
          [
            9,
            5
          ],
          [
            9,
            6
          ],
          [
            9,
            7
          ],
          [
            9,
            8
          ],
          [
            9,
            9
          ],
          [
            10,
            9
          ],
          [
            11,
            9
          ],
          [
            11,
            10
          ],
          [
            11,
            11
          ],
          [
            10,
            11
          ],
          [
            10,
            10
          ],
          [
            9,
            10
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a1",
        "path": [
          [
            11,
            1
          ],
          [
            11,
            0
          ],
          [
            10,
            0
          ],
          [
            9,
            0
          ],
          [
            8,
            0
          ],
          [
            8,
            1
          ],
          [
            8,
            2
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ],
          [
            7,
            4
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a2",
        "path": [
          [
            2,
            2
          ],
          [
            2,
            3
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a3",
        "path": [
          [
            4,
            9
          ],
          [
            3,
            9
          ],
          [
            2,
            9
          ],
          [
            1,
            9
          ],
          [
            1,
            8
          ],
          [
            2,
            8
          ],
          [
            3,
            8
          ],
          [
            3,
            7
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a4",
        "path": [
          [
            8,
            3
          ],
          [
            8,
            4
          ],
          [
            8,
            5
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a5",
        "path": [
          [
            0,
            5
          ],
          [
            0,
            6
          ],
          [
            0,
            7
          ],
          [
            0,
            8
          ],
          [
            0,
            9
          ],
          [
            0,
            10
          ],
          [
            1,
            10
          ],
          [
            2,
            10
          ],
          [
            2,
            11
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a6",
        "path": [
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            3,
            2
          ],
          [
            3,
            3
          ],
          [
            4,
            3
          ],
          [
            5,
            3
          ],
          [
            5,
            4
          ],
          [
            4,
            4
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a7",
        "path": [
          [
            8,
            6
          ],
          [
            7,
            6
          ],
          [
            6,
            6
          ],
          [
            6,
            7
          ],
          [
            5,
            7
          ],
          [
            5,
            6
          ],
          [
            5,
            5
          ],
          [
            6,
            5
          ],
          [
            6,
            4
          ],
          [
            6,
            3
          ],
          [
            6,
            2
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a8",
        "path": [
          [
            5,
            9
          ],
          [
            6,
            9
          ],
          [
            6,
            10
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a9",
        "path": [
          [
            10,
            8
          ],
          [
            10,
            7
          ],
          [
            10,
            6
          ],
          [
            11,
            6
          ],
          [
            11,
            5
          ],
          [
            10,
            5
          ],
          [
            10,
            4
          ],
          [
            11,
            4
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a10",
        "path": [
          [
            5,
            2
          ],
          [
            5,
            1
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a11",
        "path": [
          [
            1,
            5
          ],
          [
            1,
            6
          ],
          [
            2,
            6
          ],
          [
            3,
            6
          ],
          [
            4,
            6
          ],
          [
            4,
            7
          ],
          [
            4,
            8
          ],
          [
            5,
            8
          ],
          [
            6,
            8
          ],
          [
            7,
            8
          ],
          [
            7,
            9
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a12",
        "path": [
          [
            2,
            1
          ],
          [
            3,
            1
          ],
          [
            3,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ],
          [
            0,
            0
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a13",
        "path": [
          [
            5,
            0
          ],
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            7,
            1
          ],
          [
            7,
            0
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a14",
        "path": [
          [
            3,
            10
          ],
          [
            4,
            10
          ],
          [
            5,
            10
          ],
          [
            5,
            11
          ],
          [
            6,
            11
          ],
          [
            7,
            11
          ],
          [
            7,
            10
          ],
          [
            8,
            10
          ],
          [
            8,
            11
          ]
        ],
        "direction": "down"
      }
    ]
  },
  {
    "number": 3,
    "width": 14,
    "height": 14,
    "seed": 92003,
    "generatorVersion": 4,
    "profileVersion": 8,
    "lifeLimit": 3,
    "arrows": [
      {
        "id": "a0",
        "path": [
          [
            10,
            12
          ],
          [
            11,
            12
          ],
          [
            11,
            11
          ],
          [
            12,
            11
          ],
          [
            13,
            11
          ],
          [
            13,
            10
          ],
          [
            12,
            10
          ],
          [
            12,
            9
          ],
          [
            13,
            9
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a1",
        "path": [
          [
            7,
            11
          ],
          [
            7,
            12
          ],
          [
            7,
            13
          ],
          [
            8,
            13
          ],
          [
            8,
            12
          ],
          [
            8,
            11
          ],
          [
            9,
            11
          ],
          [
            10,
            11
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a2",
        "path": [
          [
            10,
            8
          ],
          [
            9,
            8
          ],
          [
            9,
            9
          ],
          [
            8,
            9
          ],
          [
            7,
            9
          ],
          [
            7,
            10
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a3",
        "path": [
          [
            11,
            5
          ],
          [
            11,
            6
          ],
          [
            10,
            6
          ],
          [
            9,
            6
          ],
          [
            8,
            6
          ],
          [
            7,
            6
          ],
          [
            7,
            7
          ],
          [
            7,
            8
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a4",
        "path": [
          [
            10,
            5
          ],
          [
            10,
            4
          ],
          [
            9,
            4
          ],
          [
            9,
            5
          ],
          [
            8,
            5
          ],
          [
            8,
            4
          ],
          [
            7,
            4
          ],
          [
            7,
            5
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a5",
        "path": [
          [
            3,
            1
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            5,
            2
          ],
          [
            6,
            2
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a6",
        "path": [
          [
            6,
            0
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a7",
        "path": [
          [
            10,
            10
          ],
          [
            11,
            10
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a8",
        "path": [
          [
            8,
            10
          ],
          [
            9,
            10
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a9",
        "path": [
          [
            4,
            13
          ],
          [
            4,
            12
          ],
          [
            4,
            11
          ],
          [
            5,
            11
          ],
          [
            5,
            10
          ],
          [
            6,
            10
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a10",
        "path": [
          [
            4,
            9
          ],
          [
            3,
            9
          ],
          [
            2,
            9
          ],
          [
            2,
            10
          ],
          [
            3,
            10
          ],
          [
            4,
            10
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a11",
        "path": [
          [
            2,
            8
          ],
          [
            2,
            7
          ],
          [
            2,
            6
          ],
          [
            3,
            6
          ],
          [
            4,
            6
          ],
          [
            4,
            7
          ],
          [
            4,
            8
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a12",
        "path": [
          [
            5,
            4
          ],
          [
            4,
            4
          ],
          [
            4,
            5
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a13",
        "path": [
          [
            0,
            8
          ],
          [
            1,
            8
          ],
          [
            1,
            9
          ],
          [
            0,
            9
          ],
          [
            0,
            10
          ],
          [
            1,
            10
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a14",
        "path": [
          [
            6,
            8
          ],
          [
            6,
            9
          ],
          [
            5,
            9
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a15",
        "path": [
          [
            12,
            7
          ],
          [
            12,
            8
          ],
          [
            11,
            8
          ],
          [
            11,
            9
          ],
          [
            10,
            9
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a16",
        "path": [
          [
            9,
            7
          ],
          [
            8,
            7
          ],
          [
            8,
            8
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a17",
        "path": [
          [
            11,
            0
          ],
          [
            10,
            0
          ],
          [
            9,
            0
          ],
          [
            8,
            0
          ],
          [
            8,
            1
          ],
          [
            8,
            2
          ],
          [
            8,
            3
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a18",
        "path": [
          [
            10,
            2
          ],
          [
            10,
            3
          ],
          [
            9,
            3
          ],
          [
            9,
            2
          ],
          [
            9,
            1
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a19",
        "path": [
          [
            13,
            13
          ],
          [
            13,
            12
          ],
          [
            12,
            12
          ],
          [
            12,
            13
          ],
          [
            11,
            13
          ],
          [
            10,
            13
          ],
          [
            9,
            13
          ],
          [
            9,
            12
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a20",
        "path": [
          [
            6,
            11
          ],
          [
            6,
            12
          ],
          [
            5,
            12
          ],
          [
            5,
            13
          ],
          [
            6,
            13
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a21",
        "path": [
          [
            5,
            6
          ],
          [
            5,
            5
          ],
          [
            6,
            5
          ],
          [
            6,
            6
          ],
          [
            6,
            7
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a22",
        "path": [
          [
            2,
            3
          ],
          [
            3,
            3
          ],
          [
            4,
            3
          ],
          [
            5,
            3
          ],
          [
            6,
            3
          ],
          [
            6,
            4
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a23",
        "path": [
          [
            13,
            4
          ],
          [
            13,
            5
          ],
          [
            13,
            6
          ],
          [
            13,
            7
          ],
          [
            13,
            8
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a24",
        "path": [
          [
            11,
            4
          ],
          [
            12,
            4
          ],
          [
            12,
            3
          ],
          [
            12,
            2
          ],
          [
            13,
            2
          ],
          [
            13,
            3
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a25",
        "path": [
          [
            10,
            1
          ],
          [
            11,
            1
          ],
          [
            12,
            1
          ],
          [
            12,
            0
          ],
          [
            13,
            0
          ],
          [
            13,
            1
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a26",
        "path": [
          [
            11,
            3
          ],
          [
            11,
            2
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a27",
        "path": [
          [
            2,
            5
          ],
          [
            2,
            4
          ],
          [
            1,
            4
          ],
          [
            0,
            4
          ],
          [
            0,
            3
          ],
          [
            1,
            3
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a28",
        "path": [
          [
            0,
            2
          ],
          [
            1,
            2
          ],
          [
            1,
            1
          ],
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            3,
            0
          ],
          [
            4,
            0
          ],
          [
            5,
            0
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a29",
        "path": [
          [
            3,
            2
          ],
          [
            2,
            2
          ],
          [
            2,
            1
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a30",
        "path": [
          [
            2,
            13
          ],
          [
            2,
            12
          ],
          [
            2,
            11
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a31",
        "path": [
          [
            12,
            6
          ],
          [
            12,
            5
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a32",
        "path": [
          [
            1,
            5
          ],
          [
            0,
            5
          ],
          [
            0,
            6
          ],
          [
            1,
            6
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a33",
        "path": [
          [
            5,
            7
          ],
          [
            5,
            8
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a34",
        "path": [
          [
            10,
            7
          ],
          [
            11,
            7
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a35",
        "path": [
          [
            3,
            5
          ],
          [
            3,
            4
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a36",
        "path": [
          [
            3,
            8
          ],
          [
            3,
            7
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a37",
        "path": [
          [
            3,
            13
          ],
          [
            3,
            12
          ],
          [
            3,
            11
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a38",
        "path": [
          [
            0,
            13
          ],
          [
            0,
            12
          ],
          [
            0,
            11
          ],
          [
            1,
            11
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a39",
        "path": [
          [
            5,
            1
          ],
          [
            6,
            1
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a40",
        "path": [
          [
            0,
            7
          ],
          [
            1,
            7
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a41",
        "path": [
          [
            0,
            0
          ],
          [
            0,
            1
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a42",
        "path": [
          [
            1,
            13
          ],
          [
            1,
            12
          ]
        ],
        "direction": "up"
      }
    ],
    "timeLimitMs": null,
    "obstacles": []
  },
  {
    "number": 8,
    "width": 16,
    "height": 16,
    "seed": 92008,
    "generatorVersion": 4,
    "profileVersion": 8,
    "lifeLimit": 3,
    "arrows": [
      {
        "id": "a0",
        "path": [
          [
            15,
            15
          ],
          [
            15,
            14
          ],
          [
            15,
            13
          ],
          [
            14,
            13
          ],
          [
            14,
            12
          ],
          [
            15,
            12
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a1",
        "path": [
          [
            10,
            13
          ],
          [
            10,
            14
          ],
          [
            10,
            15
          ],
          [
            11,
            15
          ],
          [
            11,
            14
          ],
          [
            12,
            14
          ],
          [
            12,
            15
          ],
          [
            13,
            15
          ],
          [
            14,
            15
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a2",
        "path": [
          [
            12,
            12
          ],
          [
            12,
            13
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a3",
        "path": [
          [
            11,
            10
          ],
          [
            11,
            9
          ],
          [
            12,
            9
          ],
          [
            12,
            10
          ],
          [
            12,
            11
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a4",
        "path": [
          [
            14,
            6
          ],
          [
            13,
            6
          ],
          [
            12,
            6
          ],
          [
            12,
            7
          ],
          [
            12,
            8
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a5",
        "path": [
          [
            15,
            1
          ],
          [
            15,
            2
          ],
          [
            15,
            3
          ],
          [
            15,
            4
          ],
          [
            14,
            4
          ],
          [
            13,
            4
          ],
          [
            12,
            4
          ],
          [
            12,
            5
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a6",
        "path": [
          [
            14,
            1
          ],
          [
            14,
            2
          ],
          [
            13,
            2
          ],
          [
            13,
            3
          ],
          [
            14,
            3
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a7",
        "path": [
          [
            9,
            3
          ],
          [
            10,
            3
          ],
          [
            11,
            3
          ],
          [
            12,
            3
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a8",
        "path": [
          [
            7,
            0
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ],
          [
            8,
            3
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a9",
        "path": [
          [
            8,
            6
          ],
          [
            7,
            6
          ],
          [
            7,
            5
          ],
          [
            7,
            4
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a10",
        "path": [
          [
            9,
            8
          ],
          [
            8,
            8
          ],
          [
            7,
            8
          ],
          [
            7,
            7
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a11",
        "path": [
          [
            6,
            10
          ],
          [
            7,
            10
          ],
          [
            7,
            9
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a12",
        "path": [
          [
            9,
            10
          ],
          [
            9,
            11
          ],
          [
            8,
            11
          ],
          [
            8,
            12
          ],
          [
            7,
            12
          ],
          [
            7,
            11
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a13",
        "path": [
          [
            9,
            14
          ],
          [
            8,
            14
          ],
          [
            7,
            14
          ],
          [
            7,
            13
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a14",
        "path": [
          [
            6,
            13
          ],
          [
            6,
            14
          ],
          [
            6,
            15
          ],
          [
            7,
            15
          ],
          [
            8,
            15
          ],
          [
            9,
            15
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a15",
        "path": [
          [
            4,
            14
          ],
          [
            4,
            15
          ],
          [
            5,
            15
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a16",
        "path": [
          [
            4,
            9
          ],
          [
            5,
            9
          ],
          [
            5,
            10
          ],
          [
            5,
            11
          ],
          [
            4,
            11
          ],
          [
            4,
            12
          ],
          [
            4,
            13
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a17",
        "path": [
          [
            9,
            0
          ],
          [
            10,
            0
          ],
          [
            10,
            1
          ],
          [
            11,
            1
          ],
          [
            11,
            0
          ],
          [
            12,
            0
          ],
          [
            12,
            1
          ],
          [
            13,
            1
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a18",
        "path": [
          [
            10,
            2
          ],
          [
            9,
            2
          ],
          [
            9,
            1
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a19",
        "path": [
          [
            9,
            4
          ],
          [
            8,
            4
          ],
          [
            8,
            5
          ],
          [
            9,
            5
          ],
          [
            10,
            5
          ],
          [
            10,
            4
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a20",
        "path": [
          [
            10,
            7
          ],
          [
            10,
            6
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a21",
        "path": [
          [
            11,
            11
          ],
          [
            10,
            11
          ],
          [
            10,
            10
          ],
          [
            10,
            9
          ],
          [
            10,
            8
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a22",
        "path": [
          [
            8,
            7
          ],
          [
            9,
            7
          ],
          [
            9,
            6
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a23",
        "path": [
          [
            6,
            11
          ],
          [
            6,
            12
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a24",
        "path": [
          [
            5,
            7
          ],
          [
            6,
            7
          ],
          [
            6,
            8
          ],
          [
            6,
            9
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a25",
        "path": [
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            6,
            4
          ],
          [
            6,
            5
          ],
          [
            6,
            6
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a26",
        "path": [
          [
            2,
            1
          ],
          [
            2,
            2
          ],
          [
            2,
            3
          ],
          [
            3,
            3
          ],
          [
            4,
            3
          ],
          [
            5,
            3
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a27",
        "path": [
          [
            1,
            2
          ],
          [
            0,
            2
          ],
          [
            0,
            3
          ],
          [
            1,
            3
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a28",
        "path": [
          [
            3,
            1
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            3,
            2
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a29",
        "path": [
          [
            13,
            9
          ],
          [
            13,
            10
          ],
          [
            13,
            11
          ],
          [
            13,
            12
          ],
          [
            13,
            13
          ],
          [
            13,
            14
          ],
          [
            14,
            14
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a30",
        "path": [
          [
            13,
            7
          ],
          [
            13,
            8
          ],
          [
            14,
            8
          ],
          [
            14,
            9
          ],
          [
            14,
            10
          ],
          [
            14,
            11
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a31",
        "path": [
          [
            15,
            8
          ],
          [
            15,
            9
          ],
          [
            15,
            10
          ],
          [
            15,
            11
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a32",
        "path": [
          [
            1,
            13
          ],
          [
            0,
            13
          ],
          [
            0,
            12
          ],
          [
            1,
            12
          ],
          [
            1,
            11
          ],
          [
            2,
            11
          ],
          [
            3,
            11
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a33",
        "path": [
          [
            1,
            15
          ],
          [
            2,
            15
          ],
          [
            3,
            15
          ],
          [
            3,
            14
          ],
          [
            3,
            13
          ],
          [
            3,
            12
          ],
          [
            2,
            12
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a34",
        "path": [
          [
            2,
            13
          ],
          [
            2,
            14
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a35",
        "path": [
          [
            2,
            4
          ],
          [
            3,
            4
          ],
          [
            3,
            5
          ],
          [
            3,
            6
          ],
          [
            3,
            7
          ],
          [
            3,
            8
          ],
          [
            3,
            9
          ],
          [
            2,
            9
          ],
          [
            2,
            10
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a36",
        "path": [
          [
            0,
            8
          ],
          [
            1,
            8
          ],
          [
            1,
            7
          ],
          [
            2,
            7
          ],
          [
            2,
            8
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a37",
        "path": [
          [
            5,
            8
          ],
          [
            4,
            8
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a38",
        "path": [
          [
            11,
            2
          ],
          [
            12,
            2
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a39",
        "path": [
          [
            11,
            6
          ],
          [
            11,
            5
          ],
          [
            11,
            4
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a40",
        "path": [
          [
            11,
            8
          ],
          [
            11,
            7
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a41",
        "path": [
          [
            11,
            13
          ],
          [
            11,
            12
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a42",
        "path": [
          [
            8,
            13
          ],
          [
            9,
            13
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a43",
        "path": [
          [
            9,
            9
          ],
          [
            8,
            9
          ],
          [
            8,
            10
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a44",
        "path": [
          [
            0,
            9
          ],
          [
            1,
            9
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a45",
        "path": [
          [
            1,
            5
          ],
          [
            2,
            5
          ],
          [
            2,
            6
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a46",
        "path": [
          [
            8,
            0
          ],
          [
            8,
            1
          ],
          [
            8,
            2
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a47",
        "path": [
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            1,
            1
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a48",
        "path": [
          [
            5,
            0
          ],
          [
            4,
            0
          ],
          [
            3,
            0
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a49",
        "path": [
          [
            4,
            4
          ],
          [
            4,
            5
          ],
          [
            5,
            5
          ],
          [
            5,
            4
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a50",
        "path": [
          [
            0,
            5
          ],
          [
            0,
            4
          ],
          [
            1,
            4
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a51",
        "path": [
          [
            14,
            7
          ],
          [
            15,
            7
          ],
          [
            15,
            6
          ],
          [
            15,
            5
          ],
          [
            14,
            5
          ],
          [
            13,
            5
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a52",
        "path": [
          [
            4,
            7
          ],
          [
            4,
            6
          ],
          [
            5,
            6
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a53",
        "path": [
          [
            0,
            7
          ],
          [
            0,
            6
          ],
          [
            1,
            6
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a54",
        "path": [
          [
            5,
            14
          ],
          [
            5,
            13
          ],
          [
            5,
            12
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a55",
        "path": [
          [
            0,
            15
          ],
          [
            0,
            14
          ],
          [
            1,
            14
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a56",
        "path": [
          [
            1,
            10
          ],
          [
            0,
            10
          ],
          [
            0,
            11
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a57",
        "path": [
          [
            4,
            10
          ],
          [
            3,
            10
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a58",
        "path": [
          [
            10,
            12
          ],
          [
            9,
            12
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a59",
        "path": [
          [
            15,
            0
          ],
          [
            14,
            0
          ],
          [
            13,
            0
          ]
        ],
        "direction": "left"
      }
    ],
    "timeLimitMs": null,
    "obstacles": []
  },
  {
    "number": 13,
    "width": 18,
    "height": 18,
    "seed": 92013,
    "generatorVersion": 4,
    "profileVersion": 8,
    "lifeLimit": 3,
    "arrows": [
      {
        "id": "a0",
        "path": [
          [
            15,
            2
          ],
          [
            16,
            2
          ],
          [
            17,
            2
          ],
          [
            17,
            1
          ],
          [
            16,
            1
          ],
          [
            16,
            0
          ],
          [
            17,
            0
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a1",
        "path": [
          [
            16,
            5
          ],
          [
            16,
            4
          ],
          [
            16,
            3
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a2",
        "path": [
          [
            15,
            9
          ],
          [
            15,
            8
          ],
          [
            14,
            8
          ],
          [
            14,
            7
          ],
          [
            14,
            6
          ],
          [
            15,
            6
          ],
          [
            15,
            7
          ],
          [
            16,
            7
          ],
          [
            16,
            6
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a3",
        "path": [
          [
            16,
            10
          ],
          [
            16,
            9
          ],
          [
            16,
            8
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a4",
        "path": [
          [
            15,
            14
          ],
          [
            16,
            14
          ],
          [
            16,
            13
          ],
          [
            16,
            12
          ],
          [
            16,
            11
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a5",
        "path": [
          [
            16,
            17
          ],
          [
            17,
            17
          ],
          [
            17,
            16
          ],
          [
            16,
            16
          ],
          [
            16,
            15
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a6",
        "path": [
          [
            13,
            15
          ],
          [
            13,
            16
          ],
          [
            14,
            16
          ],
          [
            15,
            16
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a7",
        "path": [
          [
            15,
            17
          ],
          [
            14,
            17
          ],
          [
            13,
            17
          ],
          [
            12,
            17
          ],
          [
            11,
            17
          ],
          [
            11,
            16
          ],
          [
            12,
            16
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a8",
        "path": [
          [
            8,
            17
          ],
          [
            7,
            17
          ],
          [
            7,
            16
          ],
          [
            8,
            16
          ],
          [
            9,
            16
          ],
          [
            9,
            17
          ],
          [
            10,
            17
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a9",
        "path": [
          [
            9,
            13
          ],
          [
            9,
            14
          ],
          [
            9,
            15
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a10",
        "path": [
          [
            12,
            10
          ],
          [
            12,
            11
          ],
          [
            12,
            12
          ],
          [
            11,
            12
          ],
          [
            11,
            11
          ],
          [
            10,
            11
          ],
          [
            9,
            11
          ],
          [
            9,
            12
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a11",
        "path": [
          [
            11,
            9
          ],
          [
            10,
            9
          ],
          [
            9,
            9
          ],
          [
            9,
            10
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a12",
        "path": [
          [
            10,
            7
          ],
          [
            9,
            7
          ],
          [
            9,
            8
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a13",
        "path": [
          [
            8,
            6
          ],
          [
            8,
            5
          ],
          [
            9,
            5
          ],
          [
            9,
            6
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a14",
        "path": [
          [
            8,
            0
          ],
          [
            9,
            0
          ],
          [
            10,
            0
          ],
          [
            10,
            1
          ],
          [
            9,
            1
          ],
          [
            9,
            2
          ],
          [
            9,
            3
          ],
          [
            9,
            4
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a15",
        "path": [
          [
            8,
            4
          ],
          [
            8,
            3
          ],
          [
            8,
            2
          ],
          [
            8,
            1
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a16",
        "path": [
          [
            7,
            11
          ],
          [
            7,
            10
          ],
          [
            8,
            10
          ],
          [
            8,
            9
          ],
          [
            8,
            8
          ],
          [
            8,
            7
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a17",
        "path": [
          [
            8,
            15
          ],
          [
            8,
            14
          ],
          [
            8,
            13
          ],
          [
            7,
            13
          ],
          [
            7,
            12
          ],
          [
            8,
            12
          ],
          [
            8,
            11
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a18",
        "path": [
          [
            4,
            16
          ],
          [
            4,
            17
          ],
          [
            5,
            17
          ],
          [
            6,
            17
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a19",
        "path": [
          [
            2,
            15
          ],
          [
            2,
            14
          ],
          [
            3,
            14
          ],
          [
            4,
            14
          ],
          [
            4,
            15
          ],
          [
            5,
            15
          ],
          [
            5,
            16
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a20",
        "path": [
          [
            4,
            11
          ],
          [
            4,
            10
          ],
          [
            5,
            10
          ],
          [
            6,
            10
          ],
          [
            6,
            11
          ],
          [
            5,
            11
          ],
          [
            5,
            12
          ],
          [
            5,
            13
          ],
          [
            5,
            14
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a21",
        "path": [
          [
            7,
            7
          ],
          [
            7,
            8
          ],
          [
            7,
            9
          ],
          [
            6,
            9
          ],
          [
            6,
            8
          ],
          [
            5,
            8
          ],
          [
            5,
            9
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a22",
        "path": [
          [
            6,
            7
          ],
          [
            6,
            6
          ],
          [
            5,
            6
          ],
          [
            5,
            7
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a23",
        "path": [
          [
            6,
            3
          ],
          [
            7,
            3
          ],
          [
            7,
            4
          ],
          [
            6,
            4
          ],
          [
            5,
            4
          ],
          [
            5,
            5
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a24",
        "path": [
          [
            6,
            1
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            5,
            3
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a25",
        "path": [
          [
            14,
            1
          ],
          [
            15,
            1
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a26",
        "path": [
          [
            13,
            4
          ],
          [
            13,
            3
          ],
          [
            14,
            3
          ],
          [
            14,
            2
          ],
          [
            13,
            2
          ],
          [
            12,
            2
          ],
          [
            12,
            1
          ],
          [
            13,
            1
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a27",
        "path": [
          [
            11,
            3
          ],
          [
            10,
            3
          ],
          [
            10,
            2
          ],
          [
            11,
            2
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a28",
        "path": [
          [
            6,
            2
          ],
          [
            7,
            2
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a29",
        "path": [
          [
            3,
            1
          ],
          [
            3,
            2
          ],
          [
            4,
            2
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a30",
        "path": [
          [
            1,
            1
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            0,
            2
          ],
          [
            1,
            2
          ],
          [
            2,
            2
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a31",
        "path": [
          [
            2,
            5
          ],
          [
            3,
            5
          ],
          [
            3,
            4
          ],
          [
            2,
            4
          ],
          [
            1,
            4
          ],
          [
            1,
            5
          ],
          [
            0,
            5
          ],
          [
            0,
            4
          ],
          [
            0,
            3
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a32",
        "path": [
          [
            4,
            6
          ],
          [
            4,
            5
          ],
          [
            4,
            4
          ],
          [
            4,
            3
          ],
          [
            3,
            3
          ],
          [
            2,
            3
          ],
          [
            1,
            3
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a33",
        "path": [
          [
            7,
            6
          ],
          [
            7,
            5
          ],
          [
            6,
            5
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a34",
        "path": [
          [
            10,
            4
          ],
          [
            11,
            4
          ],
          [
            11,
            5
          ],
          [
            10,
            5
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a35",
        "path": [
          [
            11,
            7
          ],
          [
            12,
            7
          ],
          [
            13,
            7
          ],
          [
            13,
            6
          ],
          [
            13,
            5
          ],
          [
            12,
            5
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a36",
        "path": [
          [
            15,
            5
          ],
          [
            14,
            5
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a37",
        "path": [
          [
            17,
            8
          ],
          [
            17,
            9
          ],
          [
            17,
            10
          ],
          [
            17,
            11
          ],
          [
            17,
            12
          ],
          [
            17,
            13
          ],
          [
            17,
            14
          ],
          [
            17,
            15
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a38",
        "path": [
          [
            15,
            12
          ],
          [
            14,
            12
          ],
          [
            13,
            12
          ],
          [
            13,
            11
          ],
          [
            14,
            11
          ],
          [
            15,
            11
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a39",
        "path": [
          [
            1,
            13
          ],
          [
            2,
            13
          ],
          [
            3,
            13
          ],
          [
            3,
            12
          ],
          [
            2,
            12
          ],
          [
            2,
            11
          ],
          [
            3,
            11
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a40",
        "path": [
          [
            0,
            11
          ],
          [
            1,
            11
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a41",
        "path": [
          [
            14,
            14
          ],
          [
            14,
            15
          ],
          [
            15,
            15
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a42",
        "path": [
          [
            10,
            12
          ],
          [
            10,
            13
          ],
          [
            11,
            13
          ],
          [
            11,
            14
          ],
          [
            11,
            15
          ],
          [
            12,
            15
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a43",
        "path": [
          [
            12,
            13
          ],
          [
            12,
            14
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a44",
        "path": [
          [
            10,
            8
          ],
          [
            11,
            8
          ],
          [
            12,
            8
          ],
          [
            12,
            9
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a45",
        "path": [
          [
            4,
            12
          ],
          [
            4,
            13
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a46",
        "path": [
          [
            3,
            8
          ],
          [
            4,
            8
          ],
          [
            4,
            9
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a47",
        "path": [
          [
            13,
            10
          ],
          [
            14,
            10
          ],
          [
            15,
            10
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a48",
        "path": [
          [
            10,
            10
          ],
          [
            11,
            10
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a49",
        "path": [
          [
            1,
            9
          ],
          [
            0,
            9
          ],
          [
            0,
            10
          ],
          [
            1,
            10
          ],
          [
            2,
            10
          ],
          [
            3,
            10
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a50",
        "path": [
          [
            3,
            9
          ],
          [
            2,
            9
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a51",
        "path": [
          [
            6,
            14
          ],
          [
            6,
            15
          ],
          [
            6,
            16
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a52",
        "path": [
          [
            6,
            12
          ],
          [
            6,
            13
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a53",
        "path": [
          [
            1,
            16
          ],
          [
            0,
            16
          ],
          [
            0,
            15
          ],
          [
            0,
            14
          ],
          [
            0,
            13
          ],
          [
            0,
            12
          ],
          [
            1,
            12
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a54",
        "path": [
          [
            3,
            15
          ],
          [
            3,
            16
          ],
          [
            2,
            16
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a55",
        "path": [
          [
            17,
            7
          ],
          [
            17,
            6
          ],
          [
            17,
            5
          ],
          [
            17,
            4
          ],
          [
            17,
            3
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a56",
        "path": [
          [
            10,
            6
          ],
          [
            11,
            6
          ],
          [
            12,
            6
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a57",
        "path": [
          [
            12,
            3
          ],
          [
            12,
            4
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a58",
        "path": [
          [
            15,
            3
          ],
          [
            15,
            4
          ],
          [
            14,
            4
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a59",
        "path": [
          [
            1,
            6
          ],
          [
            2,
            6
          ],
          [
            3,
            6
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a60",
        "path": [
          [
            0,
            6
          ],
          [
            0,
            7
          ],
          [
            0,
            8
          ],
          [
            1,
            8
          ],
          [
            1,
            7
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a61",
        "path": [
          [
            1,
            15
          ],
          [
            1,
            14
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a62",
        "path": [
          [
            15,
            0
          ],
          [
            14,
            0
          ],
          [
            13,
            0
          ],
          [
            12,
            0
          ],
          [
            11,
            0
          ],
          [
            11,
            1
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a63",
        "path": [
          [
            14,
            9
          ],
          [
            13,
            9
          ],
          [
            13,
            8
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a64",
        "path": [
          [
            13,
            14
          ],
          [
            13,
            13
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a65",
        "path": [
          [
            15,
            13
          ],
          [
            14,
            13
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a66",
        "path": [
          [
            7,
            14
          ],
          [
            7,
            15
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a67",
        "path": [
          [
            4,
            1
          ],
          [
            4,
            0
          ],
          [
            5,
            0
          ],
          [
            6,
            0
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a68",
        "path": [
          [
            2,
            1
          ],
          [
            2,
            0
          ],
          [
            3,
            0
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a69",
        "path": [
          [
            2,
            8
          ],
          [
            2,
            7
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a70",
        "path": [
          [
            4,
            7
          ],
          [
            3,
            7
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a71",
        "path": [
          [
            10,
            14
          ],
          [
            10,
            15
          ],
          [
            10,
            16
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a72",
        "path": [
          [
            0,
            17
          ],
          [
            1,
            17
          ],
          [
            2,
            17
          ],
          [
            3,
            17
          ]
        ],
        "direction": "right"
      }
    ],
    "timeLimitMs": null,
    "obstacles": []
  },
  {
    "number": 18,
    "width": 20,
    "height": 20,
    "seed": 92018,
    "generatorVersion": 4,
    "profileVersion": 8,
    "lifeLimit": 3,
    "arrows": [
      {
        "id": "a0",
        "path": [
          [
            3,
            17
          ],
          [
            2,
            17
          ],
          [
            1,
            17
          ],
          [
            0,
            17
          ],
          [
            0,
            18
          ],
          [
            0,
            19
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a1",
        "path": [
          [
            1,
            18
          ],
          [
            2,
            18
          ],
          [
            2,
            19
          ],
          [
            1,
            19
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a2",
        "path": [
          [
            2,
            16
          ],
          [
            3,
            16
          ],
          [
            4,
            16
          ],
          [
            4,
            17
          ],
          [
            4,
            18
          ],
          [
            3,
            18
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a3",
        "path": [
          [
            7,
            15
          ],
          [
            7,
            16
          ],
          [
            6,
            16
          ],
          [
            6,
            17
          ],
          [
            5,
            17
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a4",
        "path": [
          [
            13,
            15
          ],
          [
            12,
            15
          ],
          [
            12,
            16
          ],
          [
            11,
            16
          ],
          [
            10,
            16
          ],
          [
            10,
            17
          ],
          [
            9,
            17
          ],
          [
            8,
            17
          ],
          [
            7,
            17
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a5",
        "path": [
          [
            15,
            17
          ],
          [
            14,
            17
          ],
          [
            13,
            17
          ],
          [
            12,
            17
          ],
          [
            11,
            17
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a6",
        "path": [
          [
            17,
            19
          ],
          [
            16,
            19
          ],
          [
            16,
            18
          ],
          [
            17,
            18
          ],
          [
            17,
            17
          ],
          [
            16,
            17
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a7",
        "path": [
          [
            16,
            16
          ],
          [
            17,
            16
          ],
          [
            17,
            15
          ],
          [
            18,
            15
          ],
          [
            18,
            16
          ],
          [
            19,
            16
          ],
          [
            19,
            17
          ],
          [
            18,
            17
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a8",
        "path": [
          [
            14,
            15
          ],
          [
            15,
            15
          ],
          [
            15,
            14
          ],
          [
            16,
            14
          ],
          [
            16,
            15
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a9",
        "path": [
          [
            18,
            11
          ],
          [
            17,
            11
          ],
          [
            17,
            10
          ],
          [
            16,
            10
          ],
          [
            16,
            11
          ],
          [
            16,
            12
          ],
          [
            16,
            13
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a10",
        "path": [
          [
            13,
            9
          ],
          [
            14,
            9
          ],
          [
            15,
            9
          ],
          [
            15,
            8
          ],
          [
            16,
            8
          ],
          [
            16,
            9
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a11",
        "path": [
          [
            18,
            6
          ],
          [
            17,
            6
          ],
          [
            16,
            6
          ],
          [
            16,
            7
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a12",
        "path": [
          [
            16,
            3
          ],
          [
            16,
            4
          ],
          [
            16,
            5
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a13",
        "path": [
          [
            16,
            0
          ],
          [
            16,
            1
          ],
          [
            16,
            2
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a14",
        "path": [
          [
            13,
            16
          ],
          [
            14,
            16
          ],
          [
            15,
            16
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a15",
        "path": [
          [
            9,
            14
          ],
          [
            8,
            14
          ],
          [
            8,
            15
          ],
          [
            8,
            16
          ],
          [
            9,
            16
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a16",
        "path": [
          [
            5,
            19
          ],
          [
            4,
            19
          ],
          [
            3,
            19
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a17",
        "path": [
          [
            11,
            18
          ],
          [
            10,
            18
          ],
          [
            9,
            18
          ],
          [
            8,
            18
          ],
          [
            7,
            18
          ],
          [
            7,
            19
          ],
          [
            6,
            19
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a18",
        "path": [
          [
            6,
            13
          ],
          [
            7,
            13
          ],
          [
            7,
            14
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a19",
        "path": [
          [
            10,
            12
          ],
          [
            9,
            12
          ],
          [
            8,
            12
          ],
          [
            8,
            11
          ],
          [
            7,
            11
          ],
          [
            7,
            12
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a20",
        "path": [
          [
            7,
            4
          ],
          [
            6,
            4
          ],
          [
            6,
            5
          ],
          [
            6,
            6
          ],
          [
            6,
            7
          ],
          [
            6,
            8
          ],
          [
            6,
            9
          ],
          [
            7,
            9
          ],
          [
            7,
            10
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a21",
        "path": [
          [
            9,
            8
          ],
          [
            9,
            7
          ],
          [
            9,
            6
          ],
          [
            8,
            6
          ],
          [
            7,
            6
          ],
          [
            7,
            7
          ],
          [
            7,
            8
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a22",
        "path": [
          [
            1,
            16
          ],
          [
            1,
            15
          ],
          [
            2,
            15
          ],
          [
            3,
            15
          ],
          [
            3,
            14
          ],
          [
            4,
            14
          ],
          [
            4,
            15
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a23",
        "path": [
          [
            6,
            14
          ],
          [
            5,
            14
          ],
          [
            5,
            13
          ],
          [
            5,
            12
          ],
          [
            4,
            12
          ],
          [
            4,
            13
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a24",
        "path": [
          [
            3,
            7
          ],
          [
            3,
            8
          ],
          [
            4,
            8
          ],
          [
            4,
            9
          ],
          [
            4,
            10
          ],
          [
            4,
            11
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a25",
        "path": [
          [
            2,
            6
          ],
          [
            3,
            6
          ],
          [
            4,
            6
          ],
          [
            4,
            7
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a26",
        "path": [
          [
            1,
            3
          ],
          [
            1,
            2
          ],
          [
            2,
            2
          ],
          [
            3,
            2
          ],
          [
            3,
            3
          ],
          [
            3,
            4
          ],
          [
            4,
            4
          ],
          [
            4,
            5
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a27",
        "path": [
          [
            4,
            0
          ],
          [
            5,
            0
          ],
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            5,
            1
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            4,
            3
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a28",
        "path": [
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            5,
            3
          ],
          [
            5,
            2
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a29",
        "path": [
          [
            5,
            7
          ],
          [
            5,
            6
          ],
          [
            5,
            5
          ],
          [
            5,
            4
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a30",
        "path": [
          [
            6,
            10
          ],
          [
            5,
            10
          ],
          [
            5,
            9
          ],
          [
            5,
            8
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a31",
        "path": [
          [
            18,
            14
          ],
          [
            18,
            13
          ],
          [
            17,
            13
          ],
          [
            17,
            14
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a32",
        "path": [
          [
            14,
            19
          ],
          [
            13,
            19
          ],
          [
            12,
            19
          ],
          [
            11,
            19
          ],
          [
            10,
            19
          ],
          [
            9,
            19
          ],
          [
            8,
            19
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a33",
        "path": [
          [
            9,
            15
          ],
          [
            10,
            15
          ],
          [
            10,
            14
          ],
          [
            11,
            14
          ],
          [
            11,
            15
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a34",
        "path": [
          [
            9,
            10
          ],
          [
            10,
            10
          ],
          [
            11,
            10
          ],
          [
            12,
            10
          ],
          [
            12,
            11
          ],
          [
            11,
            11
          ],
          [
            11,
            12
          ],
          [
            11,
            13
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a35",
        "path": [
          [
            9,
            5
          ],
          [
            10,
            5
          ],
          [
            10,
            6
          ],
          [
            11,
            6
          ],
          [
            11,
            7
          ],
          [
            11,
            8
          ],
          [
            11,
            9
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a36",
        "path": [
          [
            14,
            3
          ],
          [
            14,
            4
          ],
          [
            13,
            4
          ],
          [
            12,
            4
          ],
          [
            11,
            4
          ],
          [
            11,
            5
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a37",
        "path": [
          [
            13,
            1
          ],
          [
            13,
            2
          ],
          [
            13,
            3
          ],
          [
            12,
            3
          ],
          [
            12,
            2
          ],
          [
            11,
            2
          ],
          [
            11,
            3
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a38",
        "path": [
          [
            11,
            0
          ],
          [
            11,
            1
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a39",
        "path": [
          [
            3,
            12
          ],
          [
            3,
            13
          ],
          [
            2,
            13
          ],
          [
            2,
            14
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a40",
        "path": [
          [
            0,
            14
          ],
          [
            1,
            14
          ],
          [
            1,
            13
          ],
          [
            1,
            12
          ],
          [
            1,
            11
          ],
          [
            2,
            11
          ],
          [
            2,
            12
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a41",
        "path": [
          [
            1,
            7
          ],
          [
            2,
            7
          ],
          [
            2,
            8
          ],
          [
            2,
            9
          ],
          [
            2,
            10
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a42",
        "path": [
          [
            6,
            18
          ],
          [
            5,
            18
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a43",
        "path": [
          [
            6,
            15
          ],
          [
            5,
            15
          ],
          [
            5,
            16
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a44",
        "path": [
          [
            5,
            11
          ],
          [
            6,
            11
          ],
          [
            6,
            12
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a45",
        "path": [
          [
            0,
            15
          ],
          [
            0,
            16
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a46",
        "path": [
          [
            0,
            9
          ],
          [
            0,
            10
          ],
          [
            0,
            11
          ],
          [
            0,
            12
          ],
          [
            0,
            13
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a47",
        "path": [
          [
            0,
            5
          ],
          [
            0,
            6
          ],
          [
            0,
            7
          ],
          [
            0,
            8
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a48",
        "path": [
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            0,
            2
          ],
          [
            0,
            3
          ],
          [
            0,
            4
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a49",
        "path": [
          [
            10,
            0
          ],
          [
            9,
            0
          ],
          [
            9,
            1
          ],
          [
            10,
            1
          ],
          [
            10,
            2
          ],
          [
            9,
            2
          ],
          [
            8,
            2
          ],
          [
            7,
            2
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a50",
        "path": [
          [
            9,
            3
          ],
          [
            9,
            4
          ],
          [
            10,
            4
          ],
          [
            10,
            3
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a51",
        "path": [
          [
            8,
            10
          ],
          [
            8,
            9
          ],
          [
            9,
            9
          ],
          [
            10,
            9
          ],
          [
            10,
            8
          ],
          [
            10,
            7
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a52",
        "path": [
          [
            14,
            18
          ],
          [
            13,
            18
          ],
          [
            12,
            18
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a53",
        "path": [
          [
            14,
            10
          ],
          [
            13,
            10
          ],
          [
            13,
            11
          ],
          [
            13,
            12
          ],
          [
            12,
            12
          ],
          [
            12,
            13
          ],
          [
            12,
            14
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a54",
        "path": [
          [
            13,
            5
          ],
          [
            12,
            5
          ],
          [
            12,
            6
          ],
          [
            12,
            7
          ],
          [
            12,
            8
          ],
          [
            12,
            9
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a55",
        "path": [
          [
            14,
            2
          ],
          [
            14,
            1
          ],
          [
            15,
            1
          ],
          [
            15,
            0
          ],
          [
            14,
            0
          ],
          [
            13,
            0
          ],
          [
            12,
            0
          ],
          [
            12,
            1
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a56",
        "path": [
          [
            15,
            4
          ],
          [
            15,
            5
          ],
          [
            15,
            6
          ],
          [
            14,
            6
          ],
          [
            14,
            5
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a57",
        "path": [
          [
            3,
            9
          ],
          [
            3,
            10
          ],
          [
            3,
            11
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a58",
        "path": [
          [
            10,
            11
          ],
          [
            9,
            11
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a59",
        "path": [
          [
            14,
            13
          ],
          [
            14,
            14
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a60",
        "path": [
          [
            15,
            10
          ],
          [
            15,
            11
          ],
          [
            14,
            11
          ],
          [
            14,
            12
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a61",
        "path": [
          [
            13,
            13
          ],
          [
            13,
            14
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a62",
        "path": [
          [
            10,
            13
          ],
          [
            9,
            13
          ],
          [
            8,
            13
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a63",
        "path": [
          [
            8,
            7
          ],
          [
            8,
            8
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a64",
        "path": [
          [
            3,
            0
          ],
          [
            3,
            1
          ],
          [
            2,
            1
          ],
          [
            1,
            1
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a65",
        "path": [
          [
            1,
            4
          ],
          [
            2,
            4
          ],
          [
            2,
            3
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a66",
        "path": [
          [
            7,
            5
          ],
          [
            8,
            5
          ],
          [
            8,
            4
          ],
          [
            8,
            3
          ],
          [
            7,
            3
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a67",
        "path": [
          [
            8,
            1
          ],
          [
            8,
            0
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a68",
        "path": [
          [
            18,
            1
          ],
          [
            18,
            0
          ],
          [
            17,
            0
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a69",
        "path": [
          [
            19,
            6
          ],
          [
            19,
            5
          ],
          [
            19,
            4
          ],
          [
            18,
            4
          ],
          [
            17,
            4
          ],
          [
            17,
            3
          ],
          [
            18,
            3
          ],
          [
            18,
            2
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a70",
        "path": [
          [
            17,
            5
          ],
          [
            18,
            5
          ]
        ],
        "direction": "right"
      },
      {
        "id": "a71",
        "path": [
          [
            17,
            7
          ],
          [
            17,
            8
          ],
          [
            18,
            8
          ],
          [
            18,
            7
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a72",
        "path": [
          [
            17,
            2
          ],
          [
            17,
            1
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a73",
        "path": [
          [
            1,
            6
          ],
          [
            1,
            5
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a74",
        "path": [
          [
            3,
            5
          ],
          [
            2,
            5
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a75",
        "path": [
          [
            1,
            10
          ],
          [
            1,
            9
          ],
          [
            1,
            8
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a76",
        "path": [
          [
            19,
            11
          ],
          [
            19,
            10
          ],
          [
            18,
            10
          ],
          [
            18,
            9
          ],
          [
            17,
            9
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a77",
        "path": [
          [
            13,
            8
          ],
          [
            13,
            7
          ],
          [
            13,
            6
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a78",
        "path": [
          [
            15,
            7
          ],
          [
            14,
            7
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a79",
        "path": [
          [
            15,
            3
          ],
          [
            15,
            2
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a80",
        "path": [
          [
            15,
            13
          ],
          [
            15,
            12
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a81",
        "path": [
          [
            19,
            15
          ],
          [
            19,
            14
          ],
          [
            19,
            13
          ],
          [
            19,
            12
          ],
          [
            18,
            12
          ],
          [
            17,
            12
          ]
        ],
        "direction": "left"
      },
      {
        "id": "a82",
        "path": [
          [
            19,
            18
          ],
          [
            19,
            19
          ],
          [
            18,
            19
          ],
          [
            18,
            18
          ]
        ],
        "direction": "up"
      },
      {
        "id": "a83",
        "path": [
          [
            19,
            7
          ],
          [
            19,
            8
          ],
          [
            19,
            9
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a84",
        "path": [
          [
            19,
            0
          ],
          [
            19,
            1
          ],
          [
            19,
            2
          ],
          [
            19,
            3
          ]
        ],
        "direction": "down"
      },
      {
        "id": "a85",
        "path": [
          [
            15,
            19
          ],
          [
            15,
            18
          ]
        ],
        "direction": "up"
      }
    ],
    "timeLimitMs": null,
    "obstacles": [
      [
        14,
        8
      ]
    ]
  }
];

},
"src/generation/obstacle-fallbacks.js":function(module,exports,require){
'use strict';
module.exports={"18:1":{"number":15,"width":18,"height":18,"seed":92015,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[16,14],[17,14],[17,15],[17,16],[17,17]],"direction":"down"},{"id":"a1","path":[[15,9],[15,8],[16,8],[16,9],[17,9],[17,10],[17,11],[17,12],[17,13]],"direction":"down"},{"id":"a2","path":[[14,15],[14,14],[13,14],[13,13],[14,13],[15,13],[16,13]],"direction":"right"},{"id":"a3","path":[[7,14],[7,15],[8,15],[8,14],[9,14],[9,13],[10,13],[11,13],[12,13]],"direction":"right"},{"id":"a4","path":[[4,16],[5,16],[5,15],[5,14],[6,14],[6,13],[7,13],[8,13]],"direction":"right"},{"id":"a5","path":[[1,15],[1,16],[2,16],[2,15],[2,14],[3,14],[4,14],[4,13],[5,13]],"direction":"right"},{"id":"a6","path":[[0,13],[1,13],[2,13],[3,13]],"direction":"right"},{"id":"a7","path":[[13,11],[14,11],[15,11],[16,11]],"direction":"right"},{"id":"a8","path":[[9,12],[10,12],[10,11],[10,10],[11,10],[11,11],[12,11]],"direction":"right"},{"id":"a9","path":[[3,11],[3,12],[4,12],[5,12],[6,12],[7,12],[8,12],[8,11],[9,11]],"direction":"right"},{"id":"a10","path":[[2,10],[3,10],[4,10],[4,11],[5,11],[6,11],[7,11]],"direction":"right"},{"id":"a11","path":[[1,9],[1,10],[1,11],[2,11]],"direction":"right"},{"id":"a12","path":[[11,8],[11,9],[12,9],[12,10],[13,10],[14,10],[15,10],[16,10]],"direction":"right"},{"id":"a13","path":[[7,10],[8,10],[9,10]],"direction":"right"},{"id":"a14","path":[[6,9],[5,9],[5,10],[6,10]],"direction":"right"},{"id":"a15","path":[[12,17],[13,17],[14,17],[15,17],[16,17]],"direction":"right"},{"id":"a16","path":[[11,14],[12,14],[12,15],[12,16]],"direction":"down"},{"id":"a17","path":[[15,6],[15,7],[16,7],[17,7],[17,8]],"direction":"down"},{"id":"a18","path":[[13,8],[14,8]],"direction":"right"},{"id":"a19","path":[[11,15],[11,16],[10,16],[10,17],[11,17]],"direction":"right"},{"id":"a20","path":[[9,15],[9,16],[8,16],[8,17],[9,17]],"direction":"right"},{"id":"a21","path":[[9,8],[9,9]],"direction":"down"},{"id":"a22","path":[[10,3],[10,4],[10,5],[9,5],[9,6],[9,7]],"direction":"down"},{"id":"a23","path":[[7,1],[8,1],[8,2],[9,2],[9,3],[9,4]],"direction":"down"},{"id":"a24","path":[[6,1],[6,0],[7,0],[8,0],[9,0],[9,1]],"direction":"down"},{"id":"a25","path":[[8,3],[8,4],[7,4],[7,3],[7,2]],"direction":"up"},{"id":"a26","path":[[7,7],[7,6],[8,6],[8,5]],"direction":"up"},{"id":"a27","path":[[8,9],[7,9],[7,8],[8,8],[8,7]],"direction":"up"},{"id":"a28","path":[[15,14],[15,15],[16,15],[16,16]],"direction":"down"},{"id":"a29","path":[[13,15],[13,16],[14,16],[15,16]],"direction":"right"},{"id":"a30","path":[[6,15],[6,16],[7,16]],"direction":"right"},{"id":"a31","path":[[3,16],[3,17],[4,17],[5,17],[6,17],[7,17]],"direction":"right"},{"id":"a32","path":[[5,7],[6,7],[6,8]],"direction":"down"},{"id":"a33","path":[[10,14],[10,15]],"direction":"down"},{"id":"a34","path":[[0,15],[0,14],[1,14]],"direction":"right"},{"id":"a35","path":[[4,15],[3,15]],"direction":"left"},{"id":"a36","path":[[4,7],[4,6],[3,6],[3,7],[3,8],[3,9]],"direction":"down"},{"id":"a37","path":[[1,7],[1,6],[2,6],[2,5],[2,4],[3,4],[3,5]],"direction":"down"},{"id":"a38","path":[[1,1],[2,1],[3,1],[3,2],[3,3]],"direction":"down"},{"id":"a39","path":[[5,8],[4,8],[4,9]],"direction":"down"},{"id":"a40","path":[[4,1],[4,0],[5,0],[5,1],[5,2],[5,3],[5,4],[5,5],[5,6]],"direction":"down"},{"id":"a41","path":[[4,5],[4,4],[4,3],[4,2]],"direction":"up"},{"id":"a42","path":[[11,7],[10,7],[10,8],[10,9]],"direction":"down"},{"id":"a43","path":[[0,16],[0,17],[1,17],[2,17]],"direction":"right"},{"id":"a44","path":[[1,8],[0,8],[0,9],[0,10],[0,11],[0,12]],"direction":"down"},{"id":"a45","path":[[2,12],[1,12]],"direction":"left"},{"id":"a46","path":[[13,12],[12,12],[11,12]],"direction":"left"},{"id":"a47","path":[[16,12],[15,12],[14,12]],"direction":"left"},{"id":"a48","path":[[16,5],[16,6]],"direction":"down"},{"id":"a49","path":[[16,2],[16,1],[16,0],[17,0],[17,1],[17,2],[17,3],[16,3],[16,4]],"direction":"down"},{"id":"a50","path":[[17,6],[17,5],[17,4]],"direction":"up"},{"id":"a51","path":[[13,6],[13,5],[14,5],[15,5]],"direction":"right"},{"id":"a52","path":[[14,0],[14,1],[14,2],[15,2],[15,3],[15,4]],"direction":"down"},{"id":"a53","path":[[12,3],[11,3],[11,2],[12,2],[13,2]],"direction":"right"},{"id":"a54","path":[[15,0],[15,1]],"direction":"down"},{"id":"a55","path":[[13,1],[12,1],[12,0],[13,0]],"direction":"right"},{"id":"a56","path":[[14,3],[14,4],[13,4],[13,3]],"direction":"up"},{"id":"a57","path":[[13,7],[14,7],[14,6]],"direction":"up"},{"id":"a58","path":[[2,7],[2,8],[2,9]],"direction":"down"},{"id":"a59","path":[[0,3],[0,2],[1,2],[2,2],[2,3]],"direction":"down"},{"id":"a60","path":[[10,6],[11,6],[12,6]],"direction":"right"},{"id":"a61","path":[[12,5],[12,4],[11,4],[11,5]],"direction":"down"},{"id":"a62","path":[[12,8],[12,7]],"direction":"up"},{"id":"a63","path":[[1,3],[1,4],[1,5]],"direction":"down"},{"id":"a64","path":[[10,0],[11,0],[11,1],[10,1],[10,2]],"direction":"down"},{"id":"a65","path":[[0,1],[0,0],[1,0],[2,0],[3,0]],"direction":"right"},{"id":"a66","path":[[0,7],[0,6],[0,5],[0,4]],"direction":"up"},{"id":"a67","path":[[7,5],[6,5],[6,6]],"direction":"down"},{"id":"a68","path":[[6,3],[6,4]],"direction":"down"},{"id":"a69","path":[[14,9],[13,9]],"direction":"left"}],"timeLimitMs":null,"obstacles":[[6,2]]},"20:1":{"number":18,"width":20,"height":20,"seed":92018,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[3,17],[2,17],[1,17],[0,17],[0,18],[0,19]],"direction":"down"},{"id":"a1","path":[[1,18],[2,18],[2,19],[1,19]],"direction":"left"},{"id":"a2","path":[[2,16],[3,16],[4,16],[4,17],[4,18],[3,18]],"direction":"left"},{"id":"a3","path":[[7,15],[7,16],[6,16],[6,17],[5,17]],"direction":"left"},{"id":"a4","path":[[13,15],[12,15],[12,16],[11,16],[10,16],[10,17],[9,17],[8,17],[7,17]],"direction":"left"},{"id":"a5","path":[[15,17],[14,17],[13,17],[12,17],[11,17]],"direction":"left"},{"id":"a6","path":[[17,19],[16,19],[16,18],[17,18],[17,17],[16,17]],"direction":"left"},{"id":"a7","path":[[16,16],[17,16],[17,15],[18,15],[18,16],[19,16],[19,17],[18,17]],"direction":"left"},{"id":"a8","path":[[14,15],[15,15],[15,14],[16,14],[16,15]],"direction":"down"},{"id":"a9","path":[[18,11],[17,11],[17,10],[16,10],[16,11],[16,12],[16,13]],"direction":"down"},{"id":"a10","path":[[13,9],[14,9],[15,9],[15,8],[16,8],[16,9]],"direction":"down"},{"id":"a11","path":[[18,6],[17,6],[16,6],[16,7]],"direction":"down"},{"id":"a12","path":[[16,3],[16,4],[16,5]],"direction":"down"},{"id":"a13","path":[[16,0],[16,1],[16,2]],"direction":"down"},{"id":"a14","path":[[13,16],[14,16],[15,16]],"direction":"right"},{"id":"a15","path":[[9,14],[8,14],[8,15],[8,16],[9,16]],"direction":"right"},{"id":"a16","path":[[5,19],[4,19],[3,19]],"direction":"left"},{"id":"a17","path":[[11,18],[10,18],[9,18],[8,18],[7,18],[7,19],[6,19]],"direction":"left"},{"id":"a18","path":[[6,13],[7,13],[7,14]],"direction":"down"},{"id":"a19","path":[[10,12],[9,12],[8,12],[8,11],[7,11],[7,12]],"direction":"down"},{"id":"a20","path":[[7,4],[6,4],[6,5],[6,6],[6,7],[6,8],[6,9],[7,9],[7,10]],"direction":"down"},{"id":"a21","path":[[9,8],[9,7],[9,6],[8,6],[7,6],[7,7],[7,8]],"direction":"down"},{"id":"a22","path":[[1,16],[1,15],[2,15],[3,15],[3,14],[4,14],[4,15]],"direction":"down"},{"id":"a23","path":[[6,14],[5,14],[5,13],[5,12],[4,12],[4,13]],"direction":"down"},{"id":"a24","path":[[3,7],[3,8],[4,8],[4,9],[4,10],[4,11]],"direction":"down"},{"id":"a25","path":[[2,6],[3,6],[4,6],[4,7]],"direction":"down"},{"id":"a26","path":[[1,3],[1,2],[2,2],[3,2],[3,3],[3,4],[4,4],[4,5]],"direction":"down"},{"id":"a27","path":[[4,0],[5,0],[6,0],[6,1],[5,1],[4,1],[4,2],[4,3]],"direction":"down"},{"id":"a28","path":[[6,2],[6,3],[5,3],[5,2]],"direction":"up"},{"id":"a29","path":[[5,7],[5,6],[5,5],[5,4]],"direction":"up"},{"id":"a30","path":[[6,10],[5,10],[5,9],[5,8]],"direction":"up"},{"id":"a31","path":[[18,14],[18,13],[17,13],[17,14]],"direction":"down"},{"id":"a32","path":[[14,19],[13,19],[12,19],[11,19],[10,19],[9,19],[8,19]],"direction":"left"},{"id":"a33","path":[[9,15],[10,15],[10,14],[11,14],[11,15]],"direction":"down"},{"id":"a34","path":[[9,10],[10,10],[11,10],[12,10],[12,11],[11,11],[11,12],[11,13]],"direction":"down"},{"id":"a35","path":[[9,5],[10,5],[10,6],[11,6],[11,7],[11,8],[11,9]],"direction":"down"},{"id":"a36","path":[[14,3],[14,4],[13,4],[12,4],[11,4],[11,5]],"direction":"down"},{"id":"a37","path":[[13,1],[13,2],[13,3],[12,3],[12,2],[11,2],[11,3]],"direction":"down"},{"id":"a38","path":[[11,0],[11,1]],"direction":"down"},{"id":"a39","path":[[3,12],[3,13],[2,13],[2,14]],"direction":"down"},{"id":"a40","path":[[0,14],[1,14],[1,13],[1,12],[1,11],[2,11],[2,12]],"direction":"down"},{"id":"a41","path":[[1,7],[2,7],[2,8],[2,9],[2,10]],"direction":"down"},{"id":"a42","path":[[6,18],[5,18]],"direction":"left"},{"id":"a43","path":[[6,15],[5,15],[5,16]],"direction":"down"},{"id":"a44","path":[[5,11],[6,11],[6,12]],"direction":"down"},{"id":"a45","path":[[0,15],[0,16]],"direction":"down"},{"id":"a46","path":[[0,9],[0,10],[0,11],[0,12],[0,13]],"direction":"down"},{"id":"a47","path":[[0,5],[0,6],[0,7],[0,8]],"direction":"down"},{"id":"a48","path":[[2,0],[1,0],[0,0],[0,1],[0,2],[0,3],[0,4]],"direction":"down"},{"id":"a49","path":[[10,0],[9,0],[9,1],[10,1],[10,2],[9,2],[8,2],[7,2]],"direction":"left"},{"id":"a50","path":[[9,3],[9,4],[10,4],[10,3]],"direction":"up"},{"id":"a51","path":[[8,10],[8,9],[9,9],[10,9],[10,8],[10,7]],"direction":"up"},{"id":"a52","path":[[14,18],[13,18],[12,18]],"direction":"left"},{"id":"a53","path":[[14,10],[13,10],[13,11],[13,12],[12,12],[12,13],[12,14]],"direction":"down"},{"id":"a54","path":[[13,5],[12,5],[12,6],[12,7],[12,8],[12,9]],"direction":"down"},{"id":"a55","path":[[14,2],[14,1],[15,1],[15,0],[14,0],[13,0],[12,0],[12,1]],"direction":"down"},{"id":"a56","path":[[15,4],[15,5],[15,6],[14,6],[14,5]],"direction":"up"},{"id":"a57","path":[[3,9],[3,10],[3,11]],"direction":"down"},{"id":"a58","path":[[10,11],[9,11]],"direction":"left"},{"id":"a59","path":[[14,13],[14,14]],"direction":"down"},{"id":"a60","path":[[15,10],[15,11],[14,11],[14,12]],"direction":"down"},{"id":"a61","path":[[13,13],[13,14]],"direction":"down"},{"id":"a62","path":[[10,13],[9,13],[8,13]],"direction":"left"},{"id":"a63","path":[[8,7],[8,8]],"direction":"down"},{"id":"a64","path":[[3,0],[3,1],[2,1],[1,1]],"direction":"left"},{"id":"a65","path":[[1,4],[2,4],[2,3]],"direction":"up"},{"id":"a66","path":[[7,5],[8,5],[8,4],[8,3],[7,3]],"direction":"left"},{"id":"a67","path":[[8,1],[8,0],[7,0],[7,1]],"direction":"down"},{"id":"a68","path":[[18,1],[18,0],[17,0]],"direction":"left"},{"id":"a69","path":[[19,6],[19,5],[19,4],[18,4],[17,4],[17,3],[18,3],[18,2]],"direction":"up"},{"id":"a70","path":[[17,5],[18,5]],"direction":"right"},{"id":"a71","path":[[17,7],[17,8],[18,8],[18,7]],"direction":"up"},{"id":"a72","path":[[17,2],[17,1]],"direction":"up"},{"id":"a73","path":[[1,6],[1,5]],"direction":"up"},{"id":"a74","path":[[3,5],[2,5]],"direction":"left"},{"id":"a75","path":[[1,10],[1,9],[1,8]],"direction":"up"},{"id":"a76","path":[[19,11],[19,10],[18,10],[18,9],[17,9]],"direction":"left"},{"id":"a77","path":[[13,8],[13,7],[13,6]],"direction":"up"},{"id":"a78","path":[[15,7],[14,7]],"direction":"left"},{"id":"a79","path":[[15,3],[15,2]],"direction":"up"},{"id":"a80","path":[[15,13],[15,12]],"direction":"up"},{"id":"a81","path":[[19,15],[19,14],[19,13],[19,12],[18,12],[17,12]],"direction":"left"},{"id":"a82","path":[[19,18],[19,19],[18,19],[18,18]],"direction":"up"},{"id":"a83","path":[[19,7],[19,8],[19,9]],"direction":"down"},{"id":"a84","path":[[19,0],[19,1],[19,2],[19,3]],"direction":"down"},{"id":"a85","path":[[15,19],[15,18]],"direction":"up"}],"timeLimitMs":null,"obstacles":[[14,8]]},"20:2":{"number":20,"width":20,"height":20,"seed":92020,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[2,17],[2,18],[2,19]],"direction":"down"},{"id":"a1","path":[[1,14],[2,14],[2,15],[2,16]],"direction":"down"},{"id":"a2","path":[[1,8],[1,9],[2,9],[2,10],[2,11],[1,11],[1,12],[2,12],[2,13]],"direction":"down"},{"id":"a3","path":[[3,7],[2,7],[2,8]],"direction":"down"},{"id":"a4","path":[[5,5],[4,5],[3,5],[2,5],[2,6]],"direction":"down"},{"id":"a5","path":[[2,2],[2,3],[2,4]],"direction":"down"},{"id":"a6","path":[[0,0],[1,0],[2,0],[2,1]],"direction":"down"},{"id":"a7","path":[[1,5],[1,4],[1,3],[1,2],[0,2],[0,1]],"direction":"up"},{"id":"a8","path":[[3,3],[3,4],[4,4],[4,3],[4,2],[3,2]],"direction":"left"},{"id":"a9","path":[[7,2],[6,2],[5,2]],"direction":"left"},{"id":"a10","path":[[12,2],[12,3],[11,3],[11,2],[10,2],[9,2],[8,2]],"direction":"left"},{"id":"a11","path":[[14,5],[14,4],[13,4],[13,3],[14,3],[14,2],[13,2]],"direction":"left"},{"id":"a12","path":[[18,1],[18,2],[17,2],[16,2],[15,2]],"direction":"left"},{"id":"a13","path":[[0,5],[0,4],[0,3]],"direction":"up"},{"id":"a14","path":[[6,6],[6,5],[6,4],[5,4]],"direction":"left"},{"id":"a15","path":[[8,3],[8,4],[8,5],[7,5]],"direction":"left"},{"id":"a16","path":[[12,4],[12,5],[11,5],[10,5],[9,5]],"direction":"left"},{"id":"a17","path":[[7,4],[7,3],[6,3],[5,3]],"direction":"left"},{"id":"a18","path":[[11,4],[10,4],[9,4]],"direction":"left"},{"id":"a19","path":[[15,5],[16,5],[16,4],[15,4]],"direction":"left"},{"id":"a20","path":[[18,6],[18,5],[18,4],[17,4]],"direction":"left"},{"id":"a21","path":[[10,3],[9,3]],"direction":"left"},{"id":"a22","path":[[19,0],[19,1],[19,2],[19,3],[18,3],[17,3],[16,3],[15,3]],"direction":"left"},{"id":"a23","path":[[14,0],[15,0],[16,0],[16,1],[17,1]],"direction":"right"},{"id":"a24","path":[[16,12],[16,11],[16,10],[16,9],[16,8],[16,7],[16,6]],"direction":"up"},{"id":"a25","path":[[14,13],[14,14],[14,15],[15,15],[16,15],[16,14],[16,13]],"direction":"up"},{"id":"a26","path":[[17,19],[16,19],[15,19],[15,18],[16,18],[16,17],[16,16]],"direction":"up"},{"id":"a27","path":[[13,14],[13,15],[13,16],[14,16],[15,16],[15,17]],"direction":"down"},{"id":"a28","path":[[14,11],[14,12],[15,12],[15,13],[15,14]],"direction":"down"},{"id":"a29","path":[[14,10],[15,10],[15,11]],"direction":"down"},{"id":"a30","path":[[18,11],[18,10],[18,9],[19,9],[19,8],[19,7],[19,6],[19,5],[19,4]],"direction":"up"},{"id":"a31","path":[[18,8],[17,8],[17,7],[18,7]],"direction":"right"},{"id":"a32","path":[[14,7],[15,7]],"direction":"right"},{"id":"a33","path":[[10,8],[11,8],[11,7],[11,6],[12,6],[12,7],[13,7]],"direction":"right"},{"id":"a34","path":[[10,6],[9,6],[9,7],[10,7]],"direction":"right"},{"id":"a35","path":[[5,6],[5,7],[6,7],[7,7],[8,7]],"direction":"right"},{"id":"a36","path":[[17,13],[17,14],[18,14],[19,14],[19,13],[19,12],[19,11],[19,10]],"direction":"up"},{"id":"a37","path":[[11,16],[10,16],[9,16],[9,15],[10,15],[11,15],[11,14],[12,14]],"direction":"right"},{"id":"a38","path":[[9,11],[9,12],[9,13],[9,14],[10,14]],"direction":"right"},{"id":"a39","path":[[6,16],[7,16],[7,15],[7,14],[8,14]],"direction":"right"},{"id":"a40","path":[[3,14],[3,13],[4,13],[5,13],[5,14],[6,14]],"direction":"right"},{"id":"a41","path":[[19,17],[18,17],[18,16],[17,16],[17,17],[17,18]],"direction":"down"},{"id":"a42","path":[[12,15],[12,16],[12,17],[13,17],[14,17]],"direction":"right"},{"id":"a43","path":[[10,19],[11,19],[12,19],[12,18],[11,18],[10,18],[10,17],[11,17]],"direction":"right"},{"id":"a44","path":[[13,10],[13,11],[12,11],[11,11],[11,12],[10,12],[10,13]],"direction":"down"},{"id":"a45","path":[[11,10],[12,10],[12,9],[11,9],[10,9],[10,10],[10,11]],"direction":"down"},{"id":"a46","path":[[13,1],[12,1],[11,1],[11,0],[10,0],[10,1]],"direction":"down"},{"id":"a47","path":[[14,8],[15,8]],"direction":"right"},{"id":"a48","path":[[12,8],[13,8]],"direction":"right"},{"id":"a49","path":[[8,10],[9,10],[9,9],[8,9],[8,8],[9,8]],"direction":"right"},{"id":"a50","path":[[5,10],[6,10],[6,9],[6,8],[7,8]],"direction":"right"},{"id":"a51","path":[[6,11],[5,11],[4,11],[3,11],[3,10],[3,9],[3,8],[4,8],[5,8]],"direction":"right"},{"id":"a52","path":[[17,0],[18,0]],"direction":"right"},{"id":"a53","path":[[12,0],[13,0]],"direction":"right"},{"id":"a54","path":[[15,6],[14,6],[13,6],[13,5]],"direction":"up"},{"id":"a55","path":[[19,16],[19,15]],"direction":"up"},{"id":"a56","path":[[17,15],[18,15]],"direction":"right"},{"id":"a57","path":[[17,9],[17,10],[17,11],[17,12]],"direction":"down"},{"id":"a58","path":[[17,5],[17,6]],"direction":"down"},{"id":"a59","path":[[7,6],[8,6]],"direction":"right"},{"id":"a60","path":[[9,1],[8,1],[8,0],[9,0]],"direction":"right"},{"id":"a61","path":[[7,1],[6,1],[6,0],[7,0]],"direction":"right"},{"id":"a62","path":[[4,0],[5,0]],"direction":"right"},{"id":"a63","path":[[18,13],[18,12]],"direction":"up"},{"id":"a64","path":[[12,12],[13,12]],"direction":"right"},{"id":"a65","path":[[7,12],[8,12]],"direction":"right"},{"id":"a66","path":[[3,12],[4,12],[5,12],[6,12]],"direction":"right"},{"id":"a67","path":[[18,18],[18,19],[19,19],[19,18]],"direction":"up"},{"id":"a68","path":[[14,19],[13,19],[13,18],[14,18]],"direction":"right"},{"id":"a69","path":[[6,18],[7,18],[8,18],[8,19],[9,19]],"direction":"right"},{"id":"a70","path":[[8,15],[8,16],[8,17]],"direction":"down"},{"id":"a71","path":[[5,19],[4,19],[3,19],[3,18],[3,17],[3,16],[4,16],[5,16]],"direction":"right"},{"id":"a72","path":[[5,17],[5,18]],"direction":"down"},{"id":"a73","path":[[6,19],[7,19]],"direction":"right"},{"id":"a74","path":[[1,15],[1,16],[0,16],[0,17],[1,17],[1,18],[0,18],[0,19],[1,19]],"direction":"right"},{"id":"a75","path":[[0,14],[0,15]],"direction":"down"},{"id":"a76","path":[[4,14],[4,15],[3,15]],"direction":"left"},{"id":"a77","path":[[6,15],[5,15]],"direction":"left"},{"id":"a78","path":[[4,17],[4,18]],"direction":"down"},{"id":"a79","path":[[5,9],[4,9],[4,10]],"direction":"down"},{"id":"a80","path":[[3,6],[4,6],[4,7]],"direction":"down"},{"id":"a81","path":[[0,6],[1,6]],"direction":"right"},{"id":"a82","path":[[14,1],[15,1]],"direction":"right"},{"id":"a83","path":[[3,0],[3,1],[4,1],[5,1]],"direction":"right"},{"id":"a84","path":[[0,9],[0,8],[0,7],[1,7]],"direction":"right"},{"id":"a85","path":[[8,11],[7,11],[7,10],[7,9]],"direction":"up"},{"id":"a86","path":[[1,13],[0,13],[0,12],[0,11],[0,10],[1,10]],"direction":"right"},{"id":"a87","path":[[8,13],[7,13],[6,13]],"direction":"left"},{"id":"a88","path":[[13,13],[12,13],[11,13]],"direction":"left"},{"id":"a89","path":[[9,18],[9,17]],"direction":"up"},{"id":"a90","path":[[6,17],[7,17]],"direction":"right"},{"id":"a91","path":[[14,9],[13,9]],"direction":"left"}],"timeLimitMs":180000,"obstacles":[[1,1],[15,9]]},"20:3":{"number":25,"width":20,"height":20,"seed":92025,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[19,5],[19,4],[19,3],[19,2],[19,1],[18,1],[18,0],[19,0]],"direction":"right"},{"id":"a1","path":[[16,1],[16,2],[16,3],[17,3],[18,3]],"direction":"right"},{"id":"a2","path":[[14,7],[14,6],[14,5],[14,4],[14,3],[15,3]],"direction":"right"},{"id":"a3","path":[[10,0],[11,0],[11,1],[11,2],[11,3],[12,3],[13,3]],"direction":"right"},{"id":"a4","path":[[12,5],[11,5],[11,4],[10,4],[10,3],[10,2],[10,1]],"direction":"up"},{"id":"a5","path":[[9,8],[9,7],[10,7],[11,7],[11,6]],"direction":"up"},{"id":"a6","path":[[11,9],[11,8]],"direction":"up"},{"id":"a7","path":[[14,11],[13,11],[13,10],[12,10],[12,11],[11,11],[11,10]],"direction":"up"},{"id":"a8","path":[[9,12],[10,12],[10,13],[11,13],[11,12]],"direction":"up"},{"id":"a9","path":[[8,18],[9,18],[9,17],[10,17],[11,17],[11,16],[11,15],[11,14]],"direction":"up"},{"id":"a10","path":[[14,1],[15,1],[15,0],[16,0],[17,0],[17,1],[17,2],[18,2]],"direction":"right"},{"id":"a11","path":[[17,4],[17,5],[17,6],[16,6],[16,5],[16,4]],"direction":"up"},{"id":"a12","path":[[15,9],[14,9],[14,8],[15,8],[16,8],[16,7]],"direction":"up"},{"id":"a13","path":[[19,12],[19,11],[19,10],[18,10],[18,11],[17,11],[17,10],[16,10],[16,9]],"direction":"up"},{"id":"a14","path":[[14,10],[15,10]],"direction":"right"},{"id":"a15","path":[[6,6],[7,6],[7,7],[8,7],[8,8],[8,9],[8,10],[9,10],[10,10]],"direction":"right"},{"id":"a16","path":[[6,12],[6,11],[6,10],[7,10]],"direction":"right"},{"id":"a17","path":[[5,11],[5,12],[5,13],[4,13],[4,12],[4,11],[4,10],[5,10]],"direction":"right"},{"id":"a18","path":[[0,8],[0,9],[0,10],[0,11],[1,11],[1,10],[2,10],[3,10]],"direction":"right"},{"id":"a19","path":[[2,8],[1,8]],"direction":"left"},{"id":"a20","path":[[5,8],[4,8],[3,8]],"direction":"left"},{"id":"a21","path":[[1,9],[2,9],[3,9],[4,9],[5,9],[6,9],[7,9],[7,8],[6,8]],"direction":"left"},{"id":"a22","path":[[10,8],[10,9],[9,9]],"direction":"left"},{"id":"a23","path":[[13,5],[13,6],[13,7],[13,8],[13,9],[12,9]],"direction":"left"},{"id":"a24","path":[[18,7],[17,7],[17,8],[18,8],[19,8],[19,9],[18,9],[17,9]],"direction":"left"},{"id":"a25","path":[[17,13],[17,12]],"direction":"up"},{"id":"a26","path":[[15,13],[15,14],[16,14],[16,15],[16,16],[17,16],[17,15],[17,14]],"direction":"up"},{"id":"a27","path":[[19,16],[18,16],[18,17],[18,18],[17,18],[17,17]],"direction":"up"},{"id":"a28","path":[[14,14],[13,14],[13,15],[13,16],[14,16],[15,16]],"direction":"right"},{"id":"a29","path":[[8,5],[8,4],[8,3],[9,3]],"direction":"right"},{"id":"a30","path":[[4,3],[5,3],[6,3],[7,3]],"direction":"right"},{"id":"a31","path":[[2,1],[2,2],[2,3],[3,3]],"direction":"right"},{"id":"a32","path":[[0,1],[0,0],[1,0],[1,1],[1,2],[0,2],[0,3],[1,3]],"direction":"right"},{"id":"a33","path":[[4,1],[3,1]],"direction":"left"},{"id":"a34","path":[[7,0],[8,0],[8,1],[7,1],[6,1],[5,1]],"direction":"left"},{"id":"a35","path":[[14,0],[13,0],[13,1],[13,2],[14,2],[15,2]],"direction":"right"},{"id":"a36","path":[[15,7],[15,6],[15,5],[15,4]],"direction":"up"},{"id":"a37","path":[[15,12],[15,11]],"direction":"up"},{"id":"a38","path":[[13,12],[13,13],[14,13],[14,12]],"direction":"up"},{"id":"a39","path":[[16,13],[16,12],[16,11]],"direction":"up"},{"id":"a40","path":[[19,19],[18,19],[17,19],[16,19],[16,18],[16,17]],"direction":"up"},{"id":"a41","path":[[18,14],[18,15]],"direction":"down"},{"id":"a42","path":[[18,12],[18,13]],"direction":"down"},{"id":"a43","path":[[18,4],[18,5],[18,6]],"direction":"down"},{"id":"a44","path":[[12,4],[13,4]],"direction":"right"},{"id":"a45","path":[[14,18],[13,18],[13,17]],"direction":"up"},{"id":"a46","path":[[19,7],[19,6]],"direction":"up"},{"id":"a47","path":[[19,15],[19,14],[19,13]],"direction":"up"},{"id":"a48","path":[[14,15],[15,15]],"direction":"right"},{"id":"a49","path":[[9,13],[8,13],[8,12],[8,11],[9,11],[10,11]],"direction":"right"},{"id":"a50","path":[[3,12],[3,11],[2,11]],"direction":"left"},{"id":"a51","path":[[0,4],[0,5],[0,6],[1,6],[1,5],[1,4]],"direction":"up"},{"id":"a52","path":[[3,5],[3,6],[2,6]],"direction":"left"},{"id":"a53","path":[[5,6],[4,6]],"direction":"left"},{"id":"a54","path":[[9,4],[9,5],[9,6],[8,6]],"direction":"left"},{"id":"a55","path":[[5,5],[4,5],[4,4],[5,4],[6,4],[7,4]],"direction":"right"},{"id":"a56","path":[[2,4],[3,4]],"direction":"right"},{"id":"a57","path":[[6,0],[5,0],[4,0],[3,0],[2,0]],"direction":"left"},{"id":"a58","path":[[19,18],[19,17]],"direction":"up"},{"id":"a59","path":[[14,17],[15,17]],"direction":"right"},{"id":"a60","path":[[13,19],[14,19],[15,19],[15,18]],"direction":"up"},{"id":"a61","path":[[11,19],[12,19]],"direction":"right"},{"id":"a62","path":[[12,16],[12,17],[12,18]],"direction":"down"},{"id":"a63","path":[[7,15],[8,15],[8,16],[9,16],[10,16]],"direction":"right"},{"id":"a64","path":[[6,14],[5,14],[4,14],[4,15],[5,15],[6,15],[6,16],[7,16]],"direction":"right"},{"id":"a65","path":[[3,17],[3,16],[4,16],[5,16]],"direction":"right"},{"id":"a66","path":[[2,18],[2,17],[1,17],[1,16],[2,16]],"direction":"right"},{"id":"a67","path":[[10,6],[10,5]],"direction":"up"},{"id":"a68","path":[[9,14],[9,15],[10,15],[10,14]],"direction":"up"},{"id":"a69","path":[[6,18],[6,19],[7,19],[8,19],[9,19],[10,19],[10,18]],"direction":"up"},{"id":"a70","path":[[8,17],[7,17],[7,18]],"direction":"down"},{"id":"a71","path":[[5,19],[5,18],[4,18],[4,17],[5,17],[6,17]],"direction":"right"},{"id":"a72","path":[[0,19],[1,19],[2,19],[3,19],[4,19]],"direction":"right"},{"id":"a73","path":[[3,15],[3,14],[2,14],[2,15]],"direction":"down"},{"id":"a74","path":[[6,5],[7,5]],"direction":"right"},{"id":"a75","path":[[9,0],[9,1],[9,2]],"direction":"down"},{"id":"a76","path":[[12,12],[12,13],[12,14],[12,15]],"direction":"down"},{"id":"a77","path":[[6,13],[7,13],[7,14],[8,14]],"direction":"right"},{"id":"a78","path":[[0,14],[1,14],[1,13],[1,12],[2,12],[2,13],[3,13]],"direction":"right"},{"id":"a79","path":[[12,6],[12,7],[12,8]],"direction":"down"},{"id":"a80","path":[[12,0],[12,1],[12,2]],"direction":"down"},{"id":"a81","path":[[5,2],[6,2],[7,2],[8,2]],"direction":"right"},{"id":"a82","path":[[3,2],[4,2]],"direction":"right"},{"id":"a83","path":[[0,7],[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],"direction":"right"},{"id":"a84","path":[[0,13],[0,12]],"direction":"up"},{"id":"a85","path":[[7,12],[7,11]],"direction":"up"},{"id":"a86","path":[[1,18],[0,18],[0,17],[0,16],[0,15],[1,15]],"direction":"right"}],"timeLimitMs":170000,"obstacles":[[2,5],[11,18],[3,18]]},"20:4":{"number":30,"width":20,"height":20,"seed":92030,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[3,18],[2,18],[2,19],[1,19],[0,19]],"direction":"left"},{"id":"a1","path":[[4,15],[3,15],[2,15],[2,16],[2,17]],"direction":"down"},{"id":"a2","path":[[3,14],[3,13],[2,13],[2,14]],"direction":"down"},{"id":"a3","path":[[5,9],[4,9],[4,10],[4,11],[3,11],[2,11],[2,12]],"direction":"down"},{"id":"a4","path":[[1,11],[1,10],[1,9],[2,9],[2,10]],"direction":"down"},{"id":"a5","path":[[2,5],[1,5],[0,5],[0,6],[0,7],[1,7],[2,7],[2,8]],"direction":"down"},{"id":"a6","path":[[6,8],[5,8],[4,8],[4,7],[3,7]],"direction":"left"},{"id":"a7","path":[[6,6],[6,7],[5,7]],"direction":"left"},{"id":"a8","path":[[8,5],[7,5],[7,6],[8,6],[8,7],[7,7]],"direction":"left"},{"id":"a9","path":[[13,10],[12,10],[11,10],[10,10],[10,9],[10,8],[10,7],[9,7]],"direction":"left"},{"id":"a10","path":[[13,8],[13,9],[12,9],[11,9],[11,8],[12,8],[12,7],[11,7]],"direction":"left"},{"id":"a11","path":[[16,8],[17,8],[17,7],[16,7],[15,7],[14,7],[13,7]],"direction":"left"},{"id":"a12","path":[[19,3],[19,4],[19,5],[19,6],[19,7],[18,7]],"direction":"left"},{"id":"a13","path":[[15,5],[16,5],[17,5],[18,5]],"direction":"right"},{"id":"a14","path":[[12,6],[13,6],[13,5],[14,5]],"direction":"right"},{"id":"a15","path":[[10,5],[10,6],[11,6],[11,5],[12,5]],"direction":"right"},{"id":"a16","path":[[17,2],[17,3],[17,4],[18,4]],"direction":"right"},{"id":"a17","path":[[15,3],[15,4],[16,4]],"direction":"right"},{"id":"a18","path":[[4,5],[4,6],[3,6],[2,6],[1,6]],"direction":"left"},{"id":"a19","path":[[1,4],[0,4],[0,3],[1,3],[2,3],[2,4]],"direction":"down"},{"id":"a20","path":[[0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[4,2],[4,3],[3,3]],"direction":"left"},{"id":"a21","path":[[1,2],[2,2],[3,2],[3,1]],"direction":"up"},{"id":"a22","path":[[3,5],[3,4]],"direction":"up"},{"id":"a23","path":[[3,10],[3,9],[3,8]],"direction":"up"},{"id":"a24","path":[[0,2],[0,1]],"direction":"up"},{"id":"a25","path":[[2,1],[1,1]],"direction":"left"},{"id":"a26","path":[[9,2],[8,2],[7,2],[7,1],[6,1],[5,1]],"direction":"left"},{"id":"a27","path":[[11,2],[10,2],[10,1],[10,0],[9,0],[9,1],[8,1]],"direction":"left"},{"id":"a28","path":[[10,3],[11,3],[12,3],[13,3],[13,2],[13,1],[12,1],[11,1]],"direction":"left"},{"id":"a29","path":[[16,1],[15,1],[14,1]],"direction":"left"},{"id":"a30","path":[[18,3],[18,2],[18,1],[17,1]],"direction":"left"},{"id":"a31","path":[[6,4],[6,3],[5,3]],"direction":"left"},{"id":"a32","path":[[7,4],[8,4],[9,4],[9,3],[8,3],[7,3]],"direction":"left"},{"id":"a33","path":[[9,6],[9,5]],"direction":"up"},{"id":"a34","path":[[8,11],[8,10],[8,9],[9,9],[9,8]],"direction":"up"},{"id":"a35","path":[[10,11],[9,11],[9,10]],"direction":"up"},{"id":"a36","path":[[10,14],[10,13],[9,13],[9,12]],"direction":"up"},{"id":"a37","path":[[11,17],[10,17],[9,17],[9,16],[9,15],[9,14]],"direction":"up"},{"id":"a38","path":[[13,18],[13,19],[12,19],[11,19],[10,19],[9,19],[9,18]],"direction":"up"},{"id":"a39","path":[[12,15],[13,15],[13,16],[13,17]],"direction":"down"},{"id":"a40","path":[[12,12],[13,12],[13,13],[13,14]],"direction":"down"},{"id":"a41","path":[[1,17],[1,18]],"direction":"down"},{"id":"a42","path":[[0,15],[0,14],[1,14],[1,15],[1,16]],"direction":"down"},{"id":"a43","path":[[7,13],[7,14],[8,14],[8,15],[8,16],[7,16],[7,15],[6,15],[5,15]],"direction":"left"},{"id":"a44","path":[[11,15],[10,15]],"direction":"left"},{"id":"a45","path":[[14,17],[14,16],[15,16],[15,15],[14,15]],"direction":"left"},{"id":"a46","path":[[18,17],[17,17],[17,16],[17,15],[16,15]],"direction":"left"},{"id":"a47","path":[[17,12],[17,13],[18,13],[19,13],[19,14],[19,15],[18,15]],"direction":"left"},{"id":"a48","path":[[16,9],[16,10],[16,11],[16,12],[15,12],[15,13],[16,13]],"direction":"right"},{"id":"a49","path":[[5,4],[4,4]],"direction":"left"},{"id":"a50","path":[[12,4],[11,4],[10,4]],"direction":"left"},{"id":"a51","path":[[6,2],[5,2]],"direction":"left"},{"id":"a52","path":[[14,11],[14,12],[14,13],[14,14],[15,14],[16,14],[17,14],[18,14]],"direction":"right"},{"id":"a53","path":[[10,12],[11,12],[11,13],[12,13]],"direction":"right"},{"id":"a54","path":[[11,14],[12,14]],"direction":"right"},{"id":"a55","path":[[3,12],[4,12],[4,13],[4,14],[5,14],[6,14]],"direction":"right"},{"id":"a56","path":[[3,16],[3,17],[4,17],[4,16]],"direction":"up"},{"id":"a57","path":[[0,13],[0,12],[1,12],[1,13]],"direction":"down"},{"id":"a58","path":[[5,10],[5,11],[5,12],[6,12],[6,13],[5,13]],"direction":"left"},{"id":"a59","path":[[8,13],[8,12],[7,12]],"direction":"left"},{"id":"a60","path":[[18,10],[18,11],[19,11],[19,12],[18,12]],"direction":"left"},{"id":"a61","path":[[0,16],[0,17],[0,18]],"direction":"down"},{"id":"a62","path":[[1,8],[0,8],[0,9],[0,10],[0,11]],"direction":"down"},{"id":"a63","path":[[6,11],[7,11],[7,10],[7,9],[6,9]],"direction":"left"},{"id":"a64","path":[[13,11],[12,11],[11,11]],"direction":"left"},{"id":"a65","path":[[4,18],[4,19],[3,19]],"direction":"left"},{"id":"a66","path":[[5,17],[6,17],[7,17],[7,18],[7,19],[6,19],[5,19]],"direction":"left"},{"id":"a67","path":[[8,8],[7,8]],"direction":"left"},{"id":"a68","path":[[14,10],[14,9],[15,9],[15,8],[14,8]],"direction":"left"},{"id":"a69","path":[[19,10],[19,9],[19,8],[18,8],[18,9],[17,9]],"direction":"left"},{"id":"a70","path":[[8,0],[7,0],[6,0],[5,0]],"direction":"left"},{"id":"a71","path":[[17,0],[16,0],[15,0],[14,0],[13,0],[12,0],[11,0]],"direction":"left"},{"id":"a72","path":[[19,2],[19,1],[19,0],[18,0]],"direction":"left"},{"id":"a73","path":[[6,18],[5,18]],"direction":"left"},{"id":"a74","path":[[8,19],[8,18],[8,17]],"direction":"up"},{"id":"a75","path":[[11,18],[10,18]],"direction":"left"},{"id":"a76","path":[[16,19],[15,19],[14,19]],"direction":"left"},{"id":"a77","path":[[18,18],[18,19],[17,19]],"direction":"left"},{"id":"a78","path":[[5,6],[5,5],[6,5]],"direction":"right"},{"id":"a79","path":[[18,6],[17,6],[16,6],[15,6],[14,6]],"direction":"left"},{"id":"a80","path":[[17,11],[17,10]],"direction":"up"},{"id":"a81","path":[[14,4],[14,3],[14,2]],"direction":"up"},{"id":"a82","path":[[6,16],[5,16]],"direction":"left"},{"id":"a83","path":[[12,17],[12,16],[11,16],[10,16]],"direction":"left"},{"id":"a84","path":[[16,16],[16,17],[15,17]],"direction":"left"},{"id":"a85","path":[[19,19],[19,18],[19,17],[19,16],[18,16]],"direction":"left"},{"id":"a86","path":[[14,18],[15,18],[16,18],[17,18]],"direction":"right"},{"id":"a87","path":[[15,10],[15,11]],"direction":"down"},{"id":"a88","path":[[15,2],[16,2],[16,3]],"direction":"down"}],"timeLimitMs":160000,"obstacles":[[13,4],[12,2],[6,10],[12,18]]}};

},
"src/campaign/catalog.js":function(module,exports,require){
'use strict';
const levels = require("config/campaign-levels.json");
const names = { time: '加时', life: '容错', shuffle: '重排' };
function entry(number) { return levels[number - 1]; }
function key(board) {
    let n = 2166136261;
    const value = JSON.stringify([board.number, board.width, board.height, board.arrows, board.obstacles || [], board.lifeLimit, board.timeLimitMs ?? null]);
    for (const c of value) { n ^= c.charCodeAt(0); n = Math.imul(n, 16777619); }
    return board.number + ':' + (n >>> 0);
}
function load(number) {
    const row = entry(number);
    if (!row) throw Error('关卡尚未配置');
    return Promise.resolve({ level: { ...JSON.parse(JSON.stringify(row.board)), campaignConfigured: true } });
}
function rewardText(number) {
    return Object.entries(entry(number)?.rewards || {}).map(([k, v]) => names[k] + '道具 ×' + v).join('、') || '本关无道具奖励';
}
function completed(app) {
    const s = app.session, row = entry(s.level.number);
    if (!row) return;
    if (!app.rewardClaims.includes(row.id)) {
        for (const [kind, count] of Object.entries(row.rewards)) app.inventory[kind] += count;
        app.rewardClaims.push(row.id);
        app.rewardNotice = Object.keys(row.rewards).length ? '首次通关奖励：' + rewardText(row.id) : '';
    }
    if (s.recordEligible && s.recordMs > 0 && Object.values(s.itemUses).every(n => n === 0) && key(s.level) === key(row.board)) {
        const id = key(row.board);
        app.levelBests[id] = Math.min(app.levelBests[id] || Infinity, s.recordMs);
    }
}
function activeMs(s, ms) {
    if (s.moves.size === s.remaining && s.remaining > 0) {
        const { completionDistance } = require("src/movement/path.js");
        const finish = Math.max(...[...s.moves].map(([id, m]) => Math.max(0, completionDistance(s.level.arrows.find(a => a.id === id), s.level) * 1000 / m.speed - m.elapsedMs)));
        return Math.min(ms, finish);
    }
    return ms;
}
module.exports = { levels, entry, key, load, rewardText, completed, activeMs };

},
"config/campaign-levels.json":function(module,exports,require){
module.exports=[{"id":1,"rewards":{},"board":{"number":1,"width":6,"height":6,"seed":710001,"generatorVersion":1,"profileVersion":8,"lifeLimit":null,"arrows":[{"id":"first","path":[[1,1],[2,1],[3,1]],"direction":"right"},{"id":"second","path":[[1,4],[2,4],[2,3],[2,2]],"direction":"up"},{"id":"third","path":[[4,3],[4,4],[4,5]],"direction":"down"}]}},{"id":2,"rewards":{},"board":{"number":2,"width":25,"height":25,"seed":710002,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[7,23],[6,23],[6,24],[5,24],[4,24],[3,24],[2,24],[2,23],[2,22],[1,22],[1,23],[0,23]],"direction":"left"},{"id":"a1","path":[[2,18],[2,19],[3,19],[3,18],[4,18],[4,19],[4,20],[3,20],[2,20],[2,21]],"direction":"down"},{"id":"a2","path":[[0,14],[0,15],[0,16],[0,17],[0,18],[1,18],[1,17],[1,16],[2,16],[2,17]],"direction":"down"},{"id":"a3","path":[[6,11],[5,11],[5,12],[4,12],[4,13],[4,14],[3,14],[3,15],[4,15],[4,16],[3,16]],"direction":"left"},{"id":"a4","path":[[5,17],[6,17],[7,17],[8,17],[8,16],[8,15],[7,15],[7,16],[6,16],[5,16]],"direction":"left"},{"id":"a5","path":[[7,9],[7,10],[7,11],[8,11],[8,12],[7,12],[6,12],[6,13],[7,13],[8,13],[9,13],[9,14],[9,15],[10,15],[10,16],[9,16]],"direction":"left"},{"id":"a6","path":[[9,12],[10,12],[10,13],[10,14],[11,14],[11,15],[12,15],[12,14],[13,14],[14,14],[14,15],[13,15],[13,16],[12,16],[11,16]],"direction":"left"},{"id":"a7","path":[[12,13],[13,13],[14,13],[15,13],[16,13],[17,13],[17,14],[17,15],[17,16],[16,16],[16,17],[15,17],[15,16],[14,16]],"direction":"left"},{"id":"a8","path":[[21,21],[21,22],[22,22],[22,21],[23,21],[23,20],[23,19],[23,18],[23,17],[22,17],[21,17],[21,16],[20,16],[19,16],[18,16]],"direction":"left"},{"id":"a9","path":[[18,14],[18,15],[19,15],[20,15],[21,15],[22,15],[23,15],[24,15],[24,16],[23,16],[22,16]],"direction":"left"},{"id":"a10","path":[[16,14],[15,14],[15,15],[16,15]],"direction":"right"},{"id":"a11","path":[[5,15],[6,15]],"direction":"right"},{"id":"a12","path":[[4,9],[4,10],[3,10],[2,10],[2,11],[2,12],[1,12],[0,12],[0,13],[1,13],[2,13],[2,14],[1,14],[1,15],[2,15]],"direction":"right"},{"id":"a13","path":[[2,4],[1,4],[0,4],[0,5],[0,6],[0,7],[1,7],[1,8],[2,8],[2,9]],"direction":"down"},{"id":"a14","path":[[1,5],[2,5],[2,6],[1,6]],"direction":"left"},{"id":"a15","path":[[7,4],[7,5],[6,5],[6,4],[6,3],[5,3],[4,3],[4,4],[4,5],[4,6],[3,6]],"direction":"left"},{"id":"a16","path":[[11,10],[11,9],[10,9],[9,9],[8,9],[8,8],[8,7],[7,7],[7,6],[6,6],[5,6]],"direction":"left"},{"id":"a17","path":[[8,5],[8,4],[8,3],[9,3],[10,3],[10,4],[10,5],[10,6],[10,7],[10,8],[9,8],[9,7],[9,6],[8,6]],"direction":"left"},{"id":"a18","path":[[18,5],[18,6],[17,6],[17,7],[17,8],[16,8],[16,7],[16,6],[15,6],[15,7],[14,7],[14,6],[13,6],[12,6],[11,6]],"direction":"left"},{"id":"a19","path":[[23,9],[24,9],[24,10],[23,10],[22,10],[21,10],[21,9],[21,8],[21,7],[21,6],[21,5],[21,4],[20,4],[20,5],[20,6],[19,6]],"direction":"left"},{"id":"a20","path":[[23,8],[24,8],[24,7],[23,7],[23,6],[22,6]],"direction":"left"},{"id":"a21","path":[[19,11],[19,12],[19,13],[18,13],[18,12],[17,12],[17,11],[18,11],[18,10],[18,9],[19,9],[19,10],[20,10]],"direction":"right"},{"id":"a22","path":[[11,13],[11,12],[12,12],[13,12],[13,11],[14,11],[15,11],[16,11],[16,10],[17,10]],"direction":"right"},{"id":"a23","path":[[12,8],[13,8],[13,9],[13,10],[14,10],[15,10]],"direction":"right"},{"id":"a24","path":[[3,9],[3,8],[3,7],[2,7]],"direction":"left"},{"id":"a25","path":[[6,7],[5,7],[4,7]],"direction":"left"},{"id":"a26","path":[[3,5],[3,4],[3,3],[3,2],[3,1],[3,0],[2,0],[2,1],[2,2],[2,3]],"direction":"down"},{"id":"a27","path":[[5,19],[5,20],[6,20],[6,19],[6,18],[5,18]],"direction":"left"},{"id":"a28","path":[[10,18],[9,18],[8,18],[7,18]],"direction":"left"},{"id":"a29","path":[[13,22],[14,22],[14,21],[14,20],[15,20],[15,19],[14,19],[13,19],[12,19],[12,18],[11,18]],"direction":"left"},{"id":"a30","path":[[17,17],[18,17],[18,18],[18,19],[17,19],[17,18],[16,18],[15,18],[14,18],[13,18]],"direction":"left"},{"id":"a31","path":[[19,22],[19,21],[20,21],[20,20],[20,19],[21,19],[22,19],[22,18],[21,18],[20,18],[19,18]],"direction":"left"},{"id":"a32","path":[[4,17],[3,17]],"direction":"left"},{"id":"a33","path":[[14,17],[13,17],[12,17],[11,17],[10,17],[9,17]],"direction":"left"},{"id":"a34","path":[[20,17],[19,17]],"direction":"left"},{"id":"a35","path":[[8,21],[7,21],[6,21],[6,22],[5,22],[5,23],[4,23],[3,23]],"direction":"left"},{"id":"a36","path":[[3,21],[3,22]],"direction":"down"},{"id":"a37","path":[[4,11],[3,11],[3,12],[3,13]],"direction":"down"},{"id":"a38","path":[[16,12],[15,12],[14,12]],"direction":"left"},{"id":"a39","path":[[23,12],[23,11],[22,11],[22,12],[22,13],[21,13],[21,12],[20,12]],"direction":"left"},{"id":"a40","path":[[5,21],[4,21],[4,22]],"direction":"down"},{"id":"a41","path":[[5,13],[5,14]],"direction":"down"},{"id":"a42","path":[[6,10],[6,9],[5,9],[5,10]],"direction":"down"},{"id":"a43","path":[[8,14],[7,14],[6,14]],"direction":"left"},{"id":"a44","path":[[20,13],[20,14],[19,14]],"direction":"left"},{"id":"a45","path":[[24,11],[24,12],[24,13],[23,13]],"direction":"left"},{"id":"a46","path":[[20,11],[21,11]],"direction":"right"},{"id":"a47","path":[[10,10],[10,11],[11,11],[12,11]],"direction":"right"},{"id":"a48","path":[[24,14],[23,14],[22,14],[21,14]],"direction":"left"},{"id":"a49","path":[[7,22],[8,22],[9,22],[9,23],[8,23]],"direction":"left"},{"id":"a50","path":[[9,19],[10,19],[11,19],[11,20],[12,20],[12,21],[12,22],[12,23],[12,24],[11,24],[11,23],[10,23]],"direction":"left"},{"id":"a51","path":[[12,9],[12,10]],"direction":"down"},{"id":"a52","path":[[13,24],[14,24],[14,23],[13,23]],"direction":"left"},{"id":"a53","path":[[17,9],[16,9],[15,9],[15,8],[14,8],[14,9]],"direction":"down"},{"id":"a54","path":[[13,3],[14,3],[14,2],[13,2],[13,1],[14,1],[15,1],[15,2],[15,3],[16,3],[16,4],[15,4],[14,4],[14,5]],"direction":"down"},{"id":"a55","path":[[13,20],[13,21]],"direction":"down"},{"id":"a56","path":[[15,24],[16,24],[16,23],[15,23]],"direction":"left"},{"id":"a57","path":[[19,19],[19,20],[18,20],[18,21],[17,21],[16,21],[16,22]],"direction":"down"},{"id":"a58","path":[[18,23],[17,23]],"direction":"left"},{"id":"a59","path":[[15,21],[15,22]],"direction":"down"},{"id":"a60","path":[[20,22],[20,23],[19,23]],"direction":"left"},{"id":"a61","path":[[17,24],[18,24],[19,24],[20,24],[21,24],[22,24],[22,23],[21,23]],"direction":"left"},{"id":"a62","path":[[20,7],[19,7],[19,8],[20,8],[20,9]],"direction":"down"},{"id":"a63","path":[[24,2],[23,2],[23,1],[22,1],[22,0],[21,0],[20,0],[19,0],[19,1],[20,1],[21,1],[21,2],[20,2],[20,3]],"direction":"down"},{"id":"a64","path":[[19,3],[19,2]],"direction":"up"},{"id":"a65","path":[[19,5],[19,4]],"direction":"up"},{"id":"a66","path":[[23,24],[24,24],[24,23],[23,23]],"direction":"left"},{"id":"a67","path":[[21,3],[22,3],[22,2]],"direction":"up"},{"id":"a68","path":[[24,6],[24,5],[23,5],[22,5],[22,4]],"direction":"up"},{"id":"a69","path":[[15,5],[16,5],[17,5]],"direction":"right"},{"id":"a70","path":[[13,4],[12,4],[12,3],[11,3],[11,4],[11,5],[12,5],[13,5]],"direction":"right"},{"id":"a71","path":[[22,9],[22,8],[22,7]],"direction":"up"},{"id":"a72","path":[[0,8],[0,9],[1,9]],"direction":"right"},{"id":"a73","path":[[7,8],[6,8],[5,8],[4,8]],"direction":"left"},{"id":"a74","path":[[7,1],[8,1],[8,0],[7,0],[6,0],[5,0],[4,0],[4,1],[4,2],[5,2],[5,1],[6,1],[6,2]],"direction":"down"},{"id":"a75","path":[[7,3],[7,2]],"direction":"up"},{"id":"a76","path":[[8,19],[8,20],[7,20],[7,19]],"direction":"up"},{"id":"a77","path":[[5,5],[5,4]],"direction":"up"},{"id":"a78","path":[[18,3],[18,4],[17,4],[17,3],[17,2],[18,2]],"direction":"right"},{"id":"a79","path":[[7,24],[8,24],[9,24],[10,24]],"direction":"right"},{"id":"a80","path":[[9,21],[9,20],[10,20],[10,21],[10,22]],"direction":"down"},{"id":"a81","path":[[8,2],[9,2],[9,1],[10,1],[10,2]],"direction":"down"},{"id":"a82","path":[[8,10],[9,10],[9,11]],"direction":"down"},{"id":"a83","path":[[1,11],[0,11],[0,10],[1,10]],"direction":"right"},{"id":"a84","path":[[9,4],[9,5]],"direction":"down"},{"id":"a85","path":[[23,3],[24,3],[24,4],[23,4]],"direction":"left"},{"id":"a86","path":[[1,2],[1,1],[1,0],[0,0],[0,1],[0,2],[0,3],[1,3]],"direction":"right"},{"id":"a87","path":[[16,0],[15,0],[14,0],[13,0],[12,0],[12,1],[12,2],[11,2],[11,1],[11,0],[10,0],[9,0]],"direction":"left"},{"id":"a88","path":[[16,2],[16,1],[17,1],[18,1],[18,0],[17,0]],"direction":"left"},{"id":"a89","path":[[17,20],[16,20],[16,19]],"direction":"up"},{"id":"a90","path":[[24,1],[24,0],[23,0]],"direction":"left"},{"id":"a91","path":[[23,22],[24,22],[24,21],[24,20],[24,19],[24,18],[24,17]],"direction":"up"},{"id":"a92","path":[[21,20],[22,20]],"direction":"right"},{"id":"a93","path":[[0,20],[1,20]],"direction":"right"},{"id":"a94","path":[[17,22],[18,22]],"direction":"right"},{"id":"a95","path":[[18,7],[18,8]],"direction":"down"},{"id":"a96","path":[[0,19],[1,19]],"direction":"right"},{"id":"a97","path":[[11,8],[11,7]],"direction":"up"},{"id":"a98","path":[[11,22],[11,21]],"direction":"up"},{"id":"a99","path":[[0,22],[0,21],[1,21]],"direction":"right"},{"id":"a100","path":[[13,7],[12,7]],"direction":"left"},{"id":"a101","path":[[0,24],[1,24]],"direction":"right"}],"timeLimitMs":120000,"obstacles":[]}},{"id":3,"rewards":{},"board":{"number":3,"width":25,"height":25,"seed":710003,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[0,22],[1,22],[1,23],[1,24],[2,24],[2,23],[3,23],[4,23],[4,22],[5,22],[6,22],[6,23],[6,24]],"direction":"down"},{"id":"a1","path":[[5,18],[5,19],[4,19],[3,19],[3,20],[4,20],[4,21],[3,21],[2,21],[2,20],[2,19],[1,19],[1,20],[1,21]],"direction":"down"},{"id":"a2","path":[[4,13],[4,14],[3,14],[3,15],[3,16],[3,17],[3,18],[2,18],[2,17],[1,17],[1,18]],"direction":"down"},{"id":"a3","path":[[1,15],[1,16]],"direction":"down"},{"id":"a4","path":[[0,21],[0,20],[0,19],[0,18],[0,17],[0,16],[0,15],[0,14],[0,13],[1,13],[1,14]],"direction":"down"},{"id":"a5","path":[[12,19],[11,19],[11,20],[10,20],[10,19],[9,19],[9,20],[8,20],[8,19],[7,19],[6,19]],"direction":"left"},{"id":"a6","path":[[14,15],[14,16],[13,16],[13,17],[13,18],[14,18],[14,17],[15,17],[15,18],[15,19],[14,19],[13,19]],"direction":"left"},{"id":"a7","path":[[18,24],[19,24],[20,24],[21,24],[22,24],[22,23],[21,23],[20,23],[19,23],[19,22],[19,21],[19,20],[18,20],[18,19],[17,19],[16,19]],"direction":"left"},{"id":"a8","path":[[22,21],[21,21],[20,21],[20,22]],"direction":"down"},{"id":"a9","path":[[21,17],[21,16],[22,16],[22,15],[21,15],[20,15],[19,15],[19,16],[19,17],[19,18],[19,19],[20,19],[20,20]],"direction":"down"},{"id":"a10","path":[[20,16],[20,17],[20,18]],"direction":"down"},{"id":"a11","path":[[24,12],[23,12],[22,12],[22,13],[22,14],[21,14],[21,13],[21,12],[20,12],[20,13],[20,14]],"direction":"down"},{"id":"a12","path":[[18,6],[18,7],[19,7],[19,8],[18,8],[18,9],[19,9],[20,9],[20,10],[20,11]],"direction":"down"},{"id":"a13","path":[[22,9],[22,10],[23,10],[23,11],[22,11],[21,11],[21,10],[21,9],[21,8],[22,8],[22,7],[21,7],[20,7],[20,8]],"direction":"down"},{"id":"a14","path":[[19,6],[19,5],[19,4],[20,4],[20,5],[20,6]],"direction":"down"},{"id":"a15","path":[[14,4],[15,4],[16,4],[16,3],[17,3],[18,3],[19,3],[19,2],[20,2],[20,3]],"direction":"down"},{"id":"a16","path":[[22,1],[23,1],[24,1],[24,2],[23,2],[22,2],[22,3],[21,3],[21,2],[21,1],[21,0],[20,0],[20,1]],"direction":"down"},{"id":"a17","path":[[14,1],[14,2],[14,3],[15,3],[15,2],[16,2],[16,1],[17,1],[17,2],[18,2],[18,1],[19,1]],"direction":"right"},{"id":"a18","path":[[6,4],[7,4],[8,4],[8,3],[8,2],[9,2],[9,1],[8,1],[8,0],[9,0],[10,0],[10,1],[11,1],[12,1],[12,2],[13,2]],"direction":"right"},{"id":"a19","path":[[16,8],[15,8],[14,8],[13,8],[12,8],[12,7],[11,7],[11,6],[10,6],[10,5],[10,4],[9,4],[9,3],[10,3],[10,2]],"direction":"up"},{"id":"a20","path":[[9,7],[8,7],[7,7],[6,7],[6,6],[7,6],[7,5],[8,5],[8,6],[9,6],[9,5]],"direction":"up"},{"id":"a21","path":[[0,9],[0,8],[0,7],[1,7],[2,7],[2,8],[3,8],[4,8],[4,9],[5,9],[6,9],[6,10],[7,10],[8,10],[8,9],[8,8]],"direction":"up"},{"id":"a22","path":[[7,9],[7,8],[6,8],[5,8],[5,7],[4,7],[3,7]],"direction":"left"},{"id":"a23","path":[[7,13],[7,14],[6,14],[6,15],[7,15],[8,15],[9,15],[9,14],[9,13],[9,12],[8,12],[8,11]],"direction":"up"},{"id":"a24","path":[[8,14],[8,13]],"direction":"up"},{"id":"a25","path":[[9,16],[10,16],[10,17],[10,18],[9,18],[9,17],[8,17],[8,16]],"direction":"up"},{"id":"a26","path":[[10,9],[9,9],[9,8]],"direction":"up"},{"id":"a27","path":[[15,13],[15,12],[16,12],[16,11],[15,11],[14,11],[13,11],[13,12],[12,12],[12,11],[11,11],[10,11],[9,11],[9,10]],"direction":"up"},{"id":"a28","path":[[7,20],[6,20],[6,21],[7,21],[8,21],[8,22],[9,22],[9,21]],"direction":"up"},{"id":"a29","path":[[8,23],[8,24],[9,24],[9,23]],"direction":"up"},{"id":"a30","path":[[3,11],[4,11],[4,12],[5,12],[5,13],[5,14],[5,15],[4,15],[4,16],[5,16],[6,16],[6,17],[6,18]],"direction":"down"},{"id":"a31","path":[[7,12],[7,11],[6,11],[6,12],[6,13]],"direction":"down"},{"id":"a32","path":[[15,9],[16,9],[16,10],[15,10],[14,10],[14,9],[13,9],[12,9],[11,9],[11,8],[10,8],[10,7]],"direction":"up"},{"id":"a33","path":[[17,4],[17,5],[16,5],[16,6],[15,6],[15,5],[14,5],[14,6],[14,7],[13,7]],"direction":"left"},{"id":"a34","path":[[17,6],[17,7],[16,7],[15,7]],"direction":"left"},{"id":"a35","path":[[23,8],[23,9],[24,9],[24,8],[24,7],[23,7]],"direction":"left"},{"id":"a36","path":[[24,6],[23,6],[23,5],[24,5],[24,4],[23,4],[22,4],[22,5],[21,5],[21,4]],"direction":"up"},{"id":"a37","path":[[21,6],[22,6]],"direction":"right"},{"id":"a38","path":[[11,5],[11,4],[12,4],[12,3],[13,3],[13,4],[13,5],[12,5],[12,6],[13,6]],"direction":"right"},{"id":"a39","path":[[4,5],[3,5],[3,6],[4,6],[5,6]],"direction":"right"},{"id":"a40","path":[[1,4],[1,5],[1,6],[2,6]],"direction":"right"},{"id":"a41","path":[[21,20],[22,20],[23,20],[23,19],[22,19],[21,19],[21,18]],"direction":"up"},{"id":"a42","path":[[14,14],[15,14],[15,15],[16,15],[17,15],[17,14],[17,13],[17,12],[18,12],[19,12]],"direction":"right"},{"id":"a43","path":[[18,17],[18,18],[17,18],[17,17],[17,16],[18,16],[18,15],[18,14],[18,13],[19,13],[19,14]],"direction":"down"},{"id":"a44","path":[[17,8],[17,9],[17,10],[18,10],[19,10],[19,11]],"direction":"down"},{"id":"a45","path":[[5,11],[5,10],[4,10],[3,10],[2,10],[2,9],[3,9]],"direction":"right"},{"id":"a46","path":[[17,20],[16,20],[16,21],[15,21],[14,21],[14,22],[15,22],[16,22],[17,22],[17,21],[18,21],[18,22],[18,23]],"direction":"down"},{"id":"a47","path":[[0,12],[0,11],[1,11],[1,12]],"direction":"down"},{"id":"a48","path":[[2,11],[2,12],[3,12],[3,13],[2,13]],"direction":"left"},{"id":"a49","path":[[11,17],[11,18],[12,18],[12,17],[12,16],[11,16],[11,15],[10,15],[10,14],[10,13],[11,13],[11,12],[10,12]],"direction":"left"},{"id":"a50","path":[[14,12],[14,13],[13,13],[12,13]],"direction":"left"},{"id":"a51","path":[[18,11],[17,11]],"direction":"left"},{"id":"a52","path":[[18,4],[18,5]],"direction":"down"},{"id":"a53","path":[[2,1],[2,2],[3,2],[3,3],[3,4],[4,4],[4,3],[5,3],[5,4],[5,5],[6,5]],"direction":"right"},{"id":"a54","path":[[7,3],[7,2],[7,1],[6,1],[6,2],[6,3]],"direction":"down"},{"id":"a55","path":[[3,22],[2,22]],"direction":"left"},{"id":"a56","path":[[2,14],[2,15],[2,16]],"direction":"down"},{"id":"a57","path":[[12,15],[13,15],[13,14],[12,14],[11,14]],"direction":"left"},{"id":"a58","path":[[24,13],[23,13],[23,14],[24,14],[24,15],[23,15]],"direction":"left"},{"id":"a59","path":[[0,4],[0,3],[0,2],[0,1],[1,1],[1,2],[1,3],[2,3],[2,4],[2,5]],"direction":"down"},{"id":"a60","path":[[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[5,1],[4,1],[3,1]],"direction":"left"},{"id":"a61","path":[[0,6],[0,5]],"direction":"up"},{"id":"a62","path":[[7,0],[6,0]],"direction":"left"},{"id":"a63","path":[[8,18],[7,18],[7,17],[7,16]],"direction":"up"},{"id":"a64","path":[[7,24],[7,23],[7,22]],"direction":"up"},{"id":"a65","path":[[10,21],[11,21],[11,22],[10,22]],"direction":"left"},{"id":"a66","path":[[10,23],[10,24],[11,24],[11,23],[12,23],[12,24],[13,24],[14,24],[14,23],[13,23],[13,22],[12,22]],"direction":"left"},{"id":"a67","path":[[12,21],[12,20],[13,20],[13,21]],"direction":"down"},{"id":"a68","path":[[23,16],[24,16],[24,17],[24,18],[24,19],[24,20],[24,21],[23,21],[23,22],[22,22],[21,22]],"direction":"left"},{"id":"a69","path":[[15,16],[16,16]],"direction":"right"},{"id":"a70","path":[[23,17],[22,17],[22,18],[23,18]],"direction":"right"},{"id":"a71","path":[[14,20],[15,20]],"direction":"right"},{"id":"a72","path":[[12,0],[11,0]],"direction":"left"},{"id":"a73","path":[[11,3],[11,2]],"direction":"up"},{"id":"a74","path":[[24,3],[23,3]],"direction":"left"},{"id":"a75","path":[[4,2],[5,2]],"direction":"right"},{"id":"a76","path":[[0,10],[1,10],[1,9],[1,8]],"direction":"up"},{"id":"a77","path":[[13,10],[12,10],[11,10],[10,10]],"direction":"left"},{"id":"a78","path":[[14,0],[13,0],[13,1]],"direction":"down"},{"id":"a79","path":[[0,24],[0,23]],"direction":"up"},{"id":"a80","path":[[5,23],[5,24],[4,24],[3,24]],"direction":"left"},{"id":"a81","path":[[15,24],[16,24],[17,24],[17,23],[16,23],[15,23]],"direction":"left"},{"id":"a82","path":[[19,0],[18,0],[17,0],[16,0],[15,0],[15,1]],"direction":"down"},{"id":"a83","path":[[24,0],[23,0],[22,0]],"direction":"left"},{"id":"a84","path":[[24,22],[24,23],[24,24],[23,24],[23,23]],"direction":"up"},{"id":"a85","path":[[24,10],[24,11]],"direction":"down"},{"id":"a86","path":[[16,14],[16,13]],"direction":"up"},{"id":"a87","path":[[16,18],[16,17]],"direction":"up"},{"id":"a88","path":[[4,18],[4,17],[5,17]],"direction":"right"},{"id":"a89","path":[[5,21],[5,20]],"direction":"up"}],"timeLimitMs":117000,"obstacles":[]}},{"id":4,"rewards":{},"board":{"number":4,"width":26,"height":26,"seed":710004,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[20,3],[20,2],[20,1],[20,0],[21,0],[22,0],[22,1],[23,1],[23,0],[24,0],[25,0]],"direction":"right"},{"id":"a1","path":[[25,5],[24,5],[23,5],[22,5],[21,5],[20,5],[20,4],[21,4],[21,3],[22,3],[22,2],[21,2],[21,1]],"direction":"up"},{"id":"a2","path":[[19,12],[19,13],[18,13],[18,14],[19,14],[20,14],[20,13],[20,12],[21,12],[21,11],[21,10],[21,9],[21,8],[20,8],[20,7],[20,6]],"direction":"up"},{"id":"a3","path":[[20,11],[20,10],[20,9]],"direction":"up"},{"id":"a4","path":[[17,15],[17,16],[17,17],[17,18],[18,18],[18,17],[19,17],[19,16],[20,16],[20,15]],"direction":"up"},{"id":"a5","path":[[19,18],[19,19],[20,19],[21,19],[21,18],[20,18],[20,17]],"direction":"up"},{"id":"a6","path":[[22,22],[23,22],[24,22],[24,21],[25,21],[25,22],[25,23],[24,23],[23,23],[23,24],[22,24],[22,23],[21,23],[20,23],[20,22],[20,21],[20,20]],"direction":"up"},{"id":"a7","path":[[19,24],[20,24],[20,25],[19,25],[18,25],[18,24],[18,23],[19,23]],"direction":"right"},{"id":"a8","path":[[17,21],[17,20],[17,19],[16,19],[16,20],[15,20],[15,21],[16,21],[16,22],[16,23],[17,23]],"direction":"right"},{"id":"a9","path":[[15,22],[14,22],[14,23],[15,23]],"direction":"right"},{"id":"a10","path":[[14,21],[14,20],[13,20],[13,21],[13,22],[12,22],[12,23],[13,23]],"direction":"right"},{"id":"a11","path":[[7,25],[8,25],[8,24],[7,24],[7,23],[6,23],[6,22],[7,22],[7,21],[8,21],[9,21],[10,21],[10,22],[10,23],[11,23]],"direction":"right"},{"id":"a12","path":[[12,14],[12,15],[12,16],[12,17],[11,17],[11,16],[10,16],[10,17],[9,17],[9,18],[8,18],[7,18],[6,18],[6,19],[7,19],[7,20]],"direction":"down"},{"id":"a13","path":[[8,17],[8,16],[7,16],[7,17]],"direction":"down"},{"id":"a14","path":[[8,15],[8,14],[7,14],[7,15]],"direction":"down"},{"id":"a15","path":[[1,5],[2,5],[2,6],[2,7],[2,8],[3,8],[4,8],[4,9],[4,10],[5,10],[6,10],[6,11],[6,12],[7,12],[7,13]],"direction":"down"},{"id":"a16","path":[[4,5],[5,5],[5,6],[5,7],[5,8],[5,9],[6,9],[6,8],[7,8],[7,9],[7,10],[7,11]],"direction":"down"},{"id":"a17","path":[[14,8],[13,8],[12,8],[12,7],[11,7],[11,8],[10,8],[10,7],[10,6],[10,5],[9,5],[8,5],[7,5],[7,6],[7,7]],"direction":"down"},{"id":"a18","path":[[4,1],[4,2],[4,3],[3,3],[3,4],[4,4],[5,4],[5,3],[5,2],[6,2],[6,3],[7,3],[7,4]],"direction":"down"},{"id":"a19","path":[[9,1],[10,1],[11,1],[11,0],[10,0],[9,0],[8,0],[7,0],[6,0],[6,1],[7,1],[7,2]],"direction":"down"},{"id":"a20","path":[[10,2],[11,2],[11,3],[10,3],[10,4],[9,4],[8,4],[8,3],[9,3],[9,2],[8,2],[8,1]],"direction":"up"},{"id":"a21","path":[[18,8],[17,8],[17,7],[17,6],[16,6],[15,6],[14,6],[13,6],[12,6],[11,6],[11,5],[11,4]],"direction":"up"},{"id":"a22","path":[[13,10],[13,11],[12,11],[12,10],[11,10],[11,9]],"direction":"up"},{"id":"a23","path":[[9,14],[9,13],[8,13],[8,12],[9,12],[10,12],[11,12],[11,11]],"direction":"up"},{"id":"a24","path":[[10,13],[10,14],[10,15],[11,15],[11,14],[11,13]],"direction":"up"},{"id":"a25","path":[[14,16],[15,16],[16,16],[16,17],[16,18],[15,18],[15,19],[14,19],[13,19],[12,19],[12,20],[11,20],[11,19],[11,18]],"direction":"up"},{"id":"a26","path":[[10,9],[9,9],[9,10],[10,10],[10,11],[9,11],[8,11],[8,10],[8,9],[8,8],[8,7],[8,6]],"direction":"up"},{"id":"a27","path":[[8,20],[8,19],[9,19],[9,20],[10,20],[10,19],[10,18]],"direction":"up"},{"id":"a28","path":[[8,23],[8,22]],"direction":"up"},{"id":"a29","path":[[11,24],[12,24],[13,24],[14,24],[14,25],[13,25],[12,25],[11,25],[10,25],[10,24]],"direction":"up"},{"id":"a30","path":[[12,21],[11,21],[11,22]],"direction":"down"},{"id":"a31","path":[[15,17],[14,17],[14,18]],"direction":"down"},{"id":"a32","path":[[15,12],[15,11],[14,11],[14,12],[13,12],[12,12],[12,13],[13,13],[14,13],[14,14],[14,15]],"direction":"down"},{"id":"a33","path":[[17,14],[16,14],[16,13],[17,13],[17,12],[16,12],[16,11],[16,10],[15,10],[15,9],[14,9],[14,10]],"direction":"down"},{"id":"a34","path":[[9,8],[9,7],[9,6]],"direction":"up"},{"id":"a35","path":[[9,16],[9,15]],"direction":"up"},{"id":"a36","path":[[9,25],[9,24],[9,23],[9,22]],"direction":"up"},{"id":"a37","path":[[2,16],[3,16],[4,16],[4,17],[4,18],[5,18],[5,19],[5,20],[5,21],[5,22],[4,22],[3,22],[3,23],[4,23],[5,23]],"direction":"right"},{"id":"a38","path":[[0,25],[1,25],[2,25],[2,24],[1,24],[0,24],[0,23],[1,23],[2,23]],"direction":"right"},{"id":"a39","path":[[1,19],[2,19],[3,19],[4,19],[4,20],[4,21],[3,21],[3,20],[2,20],[2,21],[2,22],[1,22],[1,21],[0,21],[0,22]],"direction":"down"},{"id":"a40","path":[[3,18],[3,17],[2,17],[2,18]],"direction":"down"},{"id":"a41","path":[[1,10],[2,10],[3,10],[3,11],[3,12],[3,13],[4,13],[4,14],[3,14],[2,14],[2,15]],"direction":"down"},{"id":"a42","path":[[1,20],[0,20],[0,19],[0,18],[0,17],[0,16],[0,15],[1,15],[1,14],[1,13],[1,12],[2,12],[2,13]],"direction":"down"},{"id":"a43","path":[[1,16],[1,17],[1,18]],"direction":"down"},{"id":"a44","path":[[5,14],[6,14],[6,15],[6,16],[6,17],[5,17]],"direction":"left"},{"id":"a45","path":[[13,14],[13,15],[13,16],[13,17],[13,18],[12,18]],"direction":"left"},{"id":"a46","path":[[24,14],[24,15],[24,16],[25,16],[25,17],[25,18],[25,19],[25,20],[24,20],[24,19],[24,18],[23,18],[22,18]],"direction":"left"},{"id":"a47","path":[[21,20],[22,20],[22,19],[23,19]],"direction":"right"},{"id":"a48","path":[[24,17],[23,17],[22,17],[21,17],[21,16],[22,16],[23,16]],"direction":"right"},{"id":"a49","path":[[5,16],[5,15],[4,15],[3,15]],"direction":"left"},{"id":"a50","path":[[16,15],[15,15]],"direction":"left"},{"id":"a51","path":[[2,11],[1,11],[0,11],[0,12],[0,13],[0,14]],"direction":"down"},{"id":"a52","path":[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[1,6],[1,7],[1,8],[1,9]],"direction":"down"},{"id":"a53","path":[[2,2],[2,3],[1,3]],"direction":"left"},{"id":"a54","path":[[19,6],[18,6],[18,5],[17,5],[16,5],[15,5],[15,4],[14,4],[14,5],[13,5],[12,5],[12,4],[13,4],[13,3],[12,3]],"direction":"left"},{"id":"a55","path":[[17,3],[16,3],[16,2],[15,2],[15,3],[14,3]],"direction":"left"},{"id":"a56","path":[[19,3],[18,3]],"direction":"left"},{"id":"a57","path":[[22,4],[23,4],[24,4],[25,4],[25,3],[24,3],[23,3]],"direction":"left"},{"id":"a58","path":[[23,10],[23,9],[24,9],[24,10],[25,10],[25,9],[25,8],[24,8],[24,7],[23,7],[22,7],[22,6]],"direction":"up"},{"id":"a59","path":[[22,14],[22,15],[21,15],[21,14],[21,13],[22,13],[22,12],[22,11],[22,10],[22,9],[22,8],[23,8]],"direction":"right"},{"id":"a60","path":[[17,11],[17,10],[17,9],[18,9],[19,9]],"direction":"right"},{"id":"a61","path":[[18,12],[18,11],[18,10],[19,10]],"direction":"right"},{"id":"a62","path":[[2,4],[1,4]],"direction":"left"},{"id":"a63","path":[[3,2],[3,1],[3,0],[2,0],[1,0],[1,1],[1,2]],"direction":"down"},{"id":"a64","path":[[5,1],[5,0],[4,0]],"direction":"left"},{"id":"a65","path":[[4,11],[4,12],[5,12],[5,11]],"direction":"up"},{"id":"a66","path":[[23,11],[24,11],[24,12],[23,12]],"direction":"left"},{"id":"a67","path":[[17,2],[18,2],[19,2],[19,1],[19,0],[18,0],[18,1],[17,1],[16,1],[15,1],[15,0],[14,0],[13,0],[12,0]],"direction":"left"},{"id":"a68","path":[[12,1],[12,2],[13,2],[13,1]],"direction":"up"},{"id":"a69","path":[[15,8],[15,7]],"direction":"up"},{"id":"a70","path":[[15,14],[15,13]],"direction":"up"},{"id":"a71","path":[[17,24],[16,24],[16,25],[15,25],[15,24]],"direction":"up"},{"id":"a72","path":[[16,7],[16,8],[16,9]],"direction":"down"},{"id":"a73","path":[[12,9],[13,9]],"direction":"right"},{"id":"a74","path":[[2,9],[3,9]],"direction":"right"},{"id":"a75","path":[[19,5],[19,4]],"direction":"up"},{"id":"a76","path":[[16,4],[17,4],[18,4]],"direction":"right"},{"id":"a77","path":[[16,0],[17,0]],"direction":"right"},{"id":"a78","path":[[14,2],[14,1]],"direction":"up"},{"id":"a79","path":[[25,2],[25,1],[24,1],[24,2],[23,2]],"direction":"left"},{"id":"a80","path":[[25,7],[25,6]],"direction":"up"},{"id":"a81","path":[[23,15],[23,14],[23,13],[24,13],[25,13],[25,12],[25,11]],"direction":"up"},{"id":"a82","path":[[25,15],[25,14]],"direction":"up"},{"id":"a83","path":[[25,25],[25,24]],"direction":"up"},{"id":"a84","path":[[18,16],[18,15],[19,15]],"direction":"right"},{"id":"a85","path":[[5,13],[6,13]],"direction":"right"},{"id":"a86","path":[[6,24],[6,25],[5,25],[5,24]],"direction":"up"},{"id":"a87","path":[[23,6],[24,6]],"direction":"right"},{"id":"a88","path":[[21,24],[21,25],[22,25],[23,25],[24,25],[24,24]],"direction":"up"},{"id":"a89","path":[[21,22],[21,21],[22,21],[23,21],[23,20]],"direction":"up"},{"id":"a90","path":[[3,5],[3,6],[3,7],[4,7],[4,6]],"direction":"up"},{"id":"a91","path":[[3,25],[4,25],[4,24]],"direction":"up"},{"id":"a92","path":[[0,10],[0,9],[0,8],[0,7]],"direction":"up"},{"id":"a93","path":[[18,21],[18,22],[17,22]],"direction":"left"},{"id":"a94","path":[[18,19],[18,20]],"direction":"down"},{"id":"a95","path":[[6,7],[6,6],[6,5],[6,4]],"direction":"up"},{"id":"a96","path":[[6,21],[6,20]],"direction":"up"},{"id":"a97","path":[[14,7],[13,7]],"direction":"left"},{"id":"a98","path":[[19,8],[19,7],[18,7]],"direction":"left"},{"id":"a99","path":[[19,20],[19,21],[19,22]],"direction":"down"},{"id":"a100","path":[[21,7],[21,6]],"direction":"up"}],"timeLimitMs":114000,"obstacles":[[19,11],[3,24],[2,1],[17,25]]}},{"id":5,"rewards":{"life":2},"board":{"number":5,"width":26,"height":26,"seed":710005,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[23,4],[23,5],[24,5],[25,5],[25,4],[24,4],[24,3],[24,2],[24,1],[24,0],[25,0]],"direction":"right"},{"id":"a1","path":[[16,3],[17,3],[17,2],[17,1],[18,1],[18,2],[18,3],[18,4],[19,4],[19,3],[20,3],[21,3],[21,2],[22,2],[22,1],[22,0],[23,0]],"direction":"right"},{"id":"a2","path":[[23,10],[22,10],[22,9],[22,8],[23,8],[23,7],[22,7],[22,6],[22,5],[22,4],[22,3],[23,3],[23,2],[23,1]],"direction":"up"},{"id":"a3","path":[[20,6],[20,5],[20,4],[21,4]],"direction":"right"},{"id":"a4","path":[[11,0],[12,0],[13,0],[13,1],[14,1],[14,0],[15,0],[15,1],[15,2],[15,3],[15,4],[16,4],[17,4]],"direction":"right"},{"id":"a5","path":[[17,10],[18,10],[19,10],[20,10],[20,9],[20,8],[19,8],[19,9],[18,9],[17,9],[17,8],[17,7],[16,7],[16,6],[15,6],[15,5]],"direction":"up"},{"id":"a6","path":[[13,11],[13,12],[12,12],[11,12],[11,11],[11,10],[11,9],[11,8],[12,8],[13,8],[13,9],[14,9],[15,9],[15,8],[15,7]],"direction":"up"},{"id":"a7","path":[[19,11],[18,11],[18,12],[19,12],[19,13],[18,13],[17,13],[16,13],[16,12],[17,12],[17,11],[16,11],[15,11],[15,10]],"direction":"up"},{"id":"a8","path":[[15,16],[15,17],[16,17],[16,16],[16,15],[15,15],[15,14],[14,14],[14,15],[13,15],[13,14],[13,13],[14,13],[15,13],[15,12]],"direction":"up"},{"id":"a9","path":[[16,18],[17,18],[18,18],[18,19],[17,19],[17,20],[18,20],[18,21],[17,21],[16,21],[16,20],[16,19],[15,19],[15,18]],"direction":"up"},{"id":"a10","path":[[14,20],[14,19],[13,19],[13,20],[13,21],[14,21],[15,21],[15,20]],"direction":"up"},{"id":"a11","path":[[20,21],[19,21],[19,22],[18,22],[18,23],[17,23],[17,22],[16,22],[16,23],[15,23],[15,22]],"direction":"up"},{"id":"a12","path":[[19,25],[20,25],[20,24],[19,24],[18,24],[18,25],[17,25],[16,25],[15,25],[15,24]],"direction":"up"},{"id":"a13","path":[[23,13],[23,14],[23,15],[22,15],[22,14],[21,14],[21,15],[21,16],[20,16],[20,17],[19,17],[19,16],[18,16],[18,17]],"direction":"down"},{"id":"a14","path":[[20,12],[20,11],[21,11],[21,12],[21,13],[20,13],[20,14],[20,15],[19,15],[19,14],[18,14],[18,15]],"direction":"down"},{"id":"a15","path":[[21,10],[21,9],[21,8],[21,7],[20,7],[19,7],[18,7],[18,8]],"direction":"down"},{"id":"a16","path":[[18,5],[18,6]],"direction":"down"},{"id":"a17","path":[[13,2],[14,2],[14,3],[14,4],[13,4],[13,3],[12,3],[12,2],[12,1]],"direction":"up"},{"id":"a18","path":[[7,5],[7,4],[8,4],[9,4],[10,4],[10,5],[10,6],[11,6],[11,5],[11,4],[12,4],[12,5],[12,6],[13,6],[13,5]],"direction":"up"},{"id":"a19","path":[[8,9],[8,8],[7,8],[7,7],[8,7],[9,7],[9,6],[9,5],[8,5],[8,6],[7,6],[6,6],[6,5],[5,5],[5,4],[6,4]],"direction":"right"},{"id":"a20","path":[[1,1],[0,1],[0,2],[1,2],[2,2],[2,1],[3,1],[3,0],[4,0],[4,1],[4,2],[3,2],[3,3],[3,4],[4,4]],"direction":"right"},{"id":"a21","path":[[3,13],[3,12],[3,11],[2,11],[2,10],[2,9],[3,9],[3,8],[3,7],[3,6],[3,5]],"direction":"up"},{"id":"a22","path":[[6,3],[7,3],[8,3],[8,2],[7,2],[7,1],[6,1],[5,1]],"direction":"left"},{"id":"a23","path":[[5,0],[6,0],[7,0],[8,0],[9,0],[9,1],[8,1]],"direction":"left"},{"id":"a24","path":[[11,15],[10,15],[10,14],[9,14],[8,14],[8,13],[9,13],[9,12],[8,12],[8,11],[8,10]],"direction":"up"},{"id":"a25","path":[[0,21],[0,20],[1,20],[1,19],[1,18],[2,18],[3,18],[3,17],[4,17],[4,16],[5,16],[6,16],[7,16],[7,17],[8,17],[8,16],[8,15]],"direction":"up"},{"id":"a26","path":[[4,22],[4,21],[4,20],[3,20],[3,19],[2,19],[2,20],[2,21],[1,21]],"direction":"left"},{"id":"a27","path":[[3,23],[2,23],[2,24],[3,24],[4,24],[4,23],[5,23],[6,23],[6,22],[5,22],[5,21],[6,21],[6,20],[5,20]],"direction":"left"},{"id":"a28","path":[[13,25],[13,24],[13,23],[12,23],[12,24],[11,24],[11,23],[10,23],[10,22],[11,22],[11,21],[10,21],[9,21],[9,20],[8,20],[7,20]],"direction":"left"},{"id":"a29","path":[[10,18],[11,18],[11,17],[12,17],[13,17],[14,17],[14,18],[13,18],[12,18],[12,19],[11,19],[11,20],[10,20]],"direction":"left"},{"id":"a30","path":[[8,19],[8,18]],"direction":"up"},{"id":"a31","path":[[10,24],[10,25],[9,25],[9,24],[9,23],[9,22],[8,22],[8,21]],"direction":"up"},{"id":"a32","path":[[6,25],[5,25],[5,24],[6,24],[7,24],[7,25],[8,25],[8,24],[8,23]],"direction":"up"},{"id":"a33","path":[[7,21],[7,22],[7,23]],"direction":"down"},{"id":"a34","path":[[6,17],[5,17],[5,18],[6,18],[7,18],[7,19]],"direction":"down"},{"id":"a35","path":[[1,17],[0,17],[0,16],[0,15],[1,15],[1,14],[2,14],[3,14],[4,14],[5,14],[5,13],[5,12],[6,12],[6,13],[6,14],[7,14],[7,15]],"direction":"down"},{"id":"a36","path":[[3,16],[3,15],[2,15]],"direction":"left"},{"id":"a37","path":[[6,15],[5,15],[4,15]],"direction":"left"},{"id":"a38","path":[[2,17],[2,16],[1,16]],"direction":"left"},{"id":"a39","path":[[14,16],[13,16],[12,16],[11,16],[10,16],[10,17],[9,17]],"direction":"left"},{"id":"a40","path":[[7,9],[6,9],[5,9],[5,10],[5,11],[6,11],[6,10],[7,10],[7,11],[7,12],[7,13]],"direction":"down"},{"id":"a41","path":[[10,0],[10,1],[10,2],[10,3],[9,3],[9,2]],"direction":"up"},{"id":"a42","path":[[9,10],[9,11],[10,11],[10,10],[10,9],[9,9],[9,8]],"direction":"up"},{"id":"a43","path":[[9,16],[9,15]],"direction":"up"},{"id":"a44","path":[[10,19],[9,19],[9,18]],"direction":"up"},{"id":"a45","path":[[10,12],[10,13]],"direction":"down"},{"id":"a46","path":[[13,7],[12,7],[11,7],[10,7],[10,8]],"direction":"down"},{"id":"a47","path":[[1,4],[2,4]],"direction":"right"},{"id":"a48","path":[[12,11],[12,10],[12,9]],"direction":"up"},{"id":"a49","path":[[12,15],[12,14],[12,13]],"direction":"up"},{"id":"a50","path":[[14,25],[14,24],[14,23],[14,22],[13,22],[12,22],[12,21],[12,20]],"direction":"up"},{"id":"a51","path":[[13,10],[14,10],[14,11],[14,12]],"direction":"down"},{"id":"a52","path":[[14,5],[14,6],[14,7],[14,8]],"direction":"down"},{"id":"a53","path":[[22,18],[23,18],[23,17],[22,17],[21,17],[21,18],[20,18],[19,18],[19,19],[20,19],[20,20],[19,20]],"direction":"left"},{"id":"a54","path":[[21,19],[22,19],[23,19],[23,20],[22,20],[21,20]],"direction":"left"},{"id":"a55","path":[[24,19],[24,18],[25,18],[25,19],[25,20],[24,20]],"direction":"left"},{"id":"a56","path":[[4,18],[4,19],[5,19],[6,19]],"direction":"right"},{"id":"a57","path":[[4,5],[4,6],[5,6],[5,7],[5,8]],"direction":"down"},{"id":"a58","path":[[6,7],[6,8]],"direction":"down"},{"id":"a59","path":[[6,2],[5,2]],"direction":"left"},{"id":"a60","path":[[11,3],[11,2],[11,1]],"direction":"up"},{"id":"a61","path":[[11,14],[11,13]],"direction":"up"},{"id":"a62","path":[[22,13],[22,12],[22,11]],"direction":"up"},{"id":"a63","path":[[21,1],[20,1],[20,0],[21,0]],"direction":"right"},{"id":"a64","path":[[21,6],[21,5]],"direction":"up"},{"id":"a65","path":[[21,23],[21,22],[21,21]],"direction":"up"},{"id":"a66","path":[[23,21],[22,21],[22,22],[22,23],[22,24],[23,24],[24,24],[24,25],[23,25],[22,25],[21,25],[21,24]],"direction":"up"},{"id":"a67","path":[[23,22],[24,22],[24,23]],"direction":"down"},{"id":"a68","path":[[16,2],[16,1],[16,0],[17,0],[18,0],[19,0]],"direction":"right"},{"id":"a69","path":[[0,0],[1,0],[2,0]],"direction":"right"},{"id":"a70","path":[[1,5],[0,5],[0,4],[0,3]],"direction":"up"},{"id":"a71","path":[[2,8],[1,8],[0,8],[0,7],[0,6]],"direction":"up"},{"id":"a72","path":[[2,5],[2,6],[2,7],[1,7]],"direction":"left"},{"id":"a73","path":[[17,6],[17,5],[16,5]],"direction":"left"},{"id":"a74","path":[[16,10],[16,9],[16,8]],"direction":"up"},{"id":"a75","path":[[1,9],[1,10],[0,10],[0,9]],"direction":"up"},{"id":"a76","path":[[4,7],[4,8],[4,9],[4,10],[3,10]],"direction":"left"},{"id":"a77","path":[[24,9],[24,10],[25,10],[25,9],[25,8],[24,8]],"direction":"left"},{"id":"a78","path":[[23,6],[24,6],[25,6],[25,7],[24,7]],"direction":"left"},{"id":"a79","path":[[23,11],[23,12],[24,12],[24,11]],"direction":"up"},{"id":"a80","path":[[25,11],[25,12],[25,13],[25,14],[24,14],[24,13]],"direction":"up"},{"id":"a81","path":[[16,14],[17,14]],"direction":"right"},{"id":"a82","path":[[17,17],[17,16],[17,15]],"direction":"up"},{"id":"a83","path":[[24,17],[25,17],[25,16],[24,16],[23,16],[22,16]],"direction":"left"},{"id":"a84","path":[[25,15],[24,15]],"direction":"left"},{"id":"a85","path":[[0,24],[0,25],[1,25],[1,24],[1,23],[0,23],[0,22],[1,22],[2,22],[3,22],[3,21]],"direction":"up"},{"id":"a86","path":[[25,25],[25,24],[25,23],[25,22],[25,21],[24,21]],"direction":"left"},{"id":"a87","path":[[25,1],[25,2],[25,3]],"direction":"down"},{"id":"a88","path":[[4,3],[5,3]],"direction":"right"},{"id":"a89","path":[[4,13],[4,12],[4,11]],"direction":"up"},{"id":"a90","path":[[0,14],[0,13],[1,13],[2,13]],"direction":"right"},{"id":"a91","path":[[0,12],[0,11],[1,11],[1,12],[2,12]],"direction":"right"},{"id":"a92","path":[[1,3],[2,3]],"direction":"right"},{"id":"a93","path":[[19,1],[19,2],[20,2]],"direction":"right"},{"id":"a94","path":[[19,23],[20,23],[20,22]],"direction":"up"},{"id":"a95","path":[[19,5],[19,6]],"direction":"down"},{"id":"a96","path":[[16,24],[17,24]],"direction":"right"},{"id":"a97","path":[[11,25],[12,25]],"direction":"right"},{"id":"a98","path":[[3,25],[4,25]],"direction":"right"},{"id":"a99","path":[[0,18],[0,19]],"direction":"down"}],"timeLimitMs":111000,"obstacles":[[23,9],[2,25],[1,6],[23,23]]}},{"id":6,"rewards":{},"board":{"number":6,"width":26,"height":26,"seed":710006,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[16,23],[17,23],[17,22],[18,22],[18,23],[19,23],[19,24],[20,24],[21,24],[21,23],[21,22],[21,21],[22,21],[22,22],[22,23],[22,24],[22,25]],"direction":"down"},{"id":"a1","path":[[22,16],[23,16],[23,15],[24,15],[24,16],[24,17],[24,18],[24,19],[24,20],[25,20],[25,21],[24,21],[23,21],[23,20],[23,19],[22,19],[22,20]],"direction":"down"},{"id":"a2","path":[[12,14],[13,14],[13,15],[13,16],[13,17],[14,17],[15,17],[15,18],[16,18],[17,18],[18,18],[18,19],[18,20],[19,20],[19,21],[20,21]],"direction":"right"},{"id":"a3","path":[[17,19],[16,19],[16,20],[17,20],[17,21],[18,21]],"direction":"right"},{"id":"a4","path":[[9,19],[9,20],[10,20],[10,19],[11,19],[12,19],[13,19],[14,19],[14,20],[13,20],[13,21],[14,21],[15,21],[16,21]],"direction":"right"},{"id":"a5","path":[[14,24],[13,24],[13,25],[12,25],[11,25],[10,25],[10,24],[11,24],[11,23],[11,22],[11,21],[12,21]],"direction":"right"},{"id":"a6","path":[[14,22],[14,23],[13,23],[13,22],[12,22],[12,23],[12,24]],"direction":"down"},{"id":"a7","path":[[6,23],[7,23],[7,24],[7,25],[8,25],[8,24],[8,23],[9,23],[9,22],[9,21],[10,21]],"direction":"right"},{"id":"a8","path":[[3,16],[4,16],[4,17],[5,17],[6,17],[6,18],[6,19],[5,19],[4,19],[4,20],[4,21],[4,22],[5,22],[6,22],[6,21],[7,21],[8,21]],"direction":"right"},{"id":"a9","path":[[10,22],[10,23]],"direction":"down"},{"id":"a10","path":[[12,11],[13,11],[13,12],[13,13],[12,13],[11,13],[11,14],[10,14],[10,15],[11,15],[12,15],[12,16],[11,16],[10,16],[10,17],[10,18]],"direction":"down"},{"id":"a11","path":[[12,12],[11,12],[11,11],[11,10],[10,10],[10,11],[10,12],[10,13]],"direction":"down"},{"id":"a12","path":[[13,2],[13,3],[13,4],[12,4],[11,4],[11,5],[11,6],[10,6],[10,7],[10,8],[10,9]],"direction":"down"},{"id":"a13","path":[[6,4],[7,4],[8,4],[9,4],[9,3],[9,2],[9,1],[10,1],[10,2],[11,2],[12,2],[12,3],[11,3],[10,3],[10,4],[10,5]],"direction":"down"},{"id":"a14","path":[[23,18],[23,17],[22,17],[22,18]],"direction":"down"},{"id":"a15","path":[[23,10],[23,11],[22,11],[22,10],[21,10],[21,11],[20,11],[20,12],[21,12],[21,13],[20,13],[20,14],[20,15],[21,15],[21,14],[22,14],[22,15]],"direction":"down"},{"id":"a16","path":[[24,10],[24,9],[25,9],[25,10],[25,11],[25,12],[24,12],[23,12],[22,12],[22,13]],"direction":"down"},{"id":"a17","path":[[22,7],[22,6],[23,6],[24,6],[24,5],[25,5],[25,6],[25,7],[25,8],[24,8],[24,7],[23,7],[23,8],[22,8],[22,9],[23,9]],"direction":"right"},{"id":"a18","path":[[22,4],[22,5]],"direction":"down"},{"id":"a19","path":[[12,1],[13,1],[14,1],[15,1],[16,1],[17,1],[18,1],[19,1],[19,2],[20,2],[20,3],[21,3],[21,2],[22,2],[22,3]],"direction":"down"},{"id":"a20","path":[[23,5],[23,4],[23,3],[24,3],[24,4],[25,4],[25,3],[25,2],[24,2],[23,2],[23,1],[23,0],[22,0],[22,1]],"direction":"down"},{"id":"a21","path":[[15,7],[15,6],[15,5],[16,5],[17,5],[17,6],[18,6],[19,6],[19,5],[20,5],[21,5]],"direction":"right"},{"id":"a22","path":[[25,19],[25,18],[25,17],[25,16],[25,15],[25,14],[25,13],[24,13],[24,14],[23,14],[23,13]],"direction":"up"},{"id":"a23","path":[[21,17],[21,18],[21,19],[21,20],[20,20],[20,19],[20,18],[20,17],[19,17],[19,16],[20,16],[21,16]],"direction":"right"},{"id":"a24","path":[[17,16],[18,16]],"direction":"right"},{"id":"a25","path":[[15,15],[15,16],[16,16]],"direction":"right"},{"id":"a26","path":[[16,17],[17,17],[18,17]],"direction":"right"},{"id":"a27","path":[[14,18],[13,18],[12,18],[11,18],[11,17],[12,17]],"direction":"right"},{"id":"a28","path":[[9,18],[8,18],[8,17],[9,17]],"direction":"right"},{"id":"a29","path":[[12,8],[13,8],[13,9],[13,10]],"direction":"down"},{"id":"a30","path":[[16,12],[15,12],[15,11],[15,10],[15,9],[15,8],[14,8],[14,7],[14,6],[13,6],[13,7]],"direction":"down"},{"id":"a31","path":[[19,15],[18,15],[17,15],[16,15],[16,14],[17,14],[18,14],[19,14]],"direction":"right"},{"id":"a32","path":[[14,16],[14,15],[14,14],[15,14]],"direction":"right"},{"id":"a33","path":[[8,9],[8,10],[9,10],[9,11],[9,12],[9,13],[9,14],[8,14],[7,14],[6,14],[6,15],[7,15],[8,15],[9,15]],"direction":"right"},{"id":"a34","path":[[0,15],[0,14],[0,13],[1,13],[2,13],[2,12],[3,12],[3,13],[4,13],[4,14],[5,14]],"direction":"right"},{"id":"a35","path":[[1,14],[2,14],[3,14],[3,15],[2,15],[1,15]],"direction":"left"},{"id":"a36","path":[[8,20],[7,20],[7,19],[7,18],[7,17],[7,16],[6,16],[5,16],[5,15],[4,15]],"direction":"left"},{"id":"a37","path":[[3,25],[2,25],[2,24],[2,23],[2,22],[3,22],[3,21],[2,21],[2,20],[2,19],[2,18],[1,18],[1,17],[1,16],[2,16],[2,17],[3,17]],"direction":"right"},{"id":"a38","path":[[6,24],[6,25],[5,25],[5,24],[5,23],[4,23],[3,23],[3,24]],"direction":"down"},{"id":"a39","path":[[6,20],[5,20],[5,21]],"direction":"down"},{"id":"a40","path":[[1,11],[1,10],[1,9],[2,9],[2,8],[3,8],[4,8],[4,9],[3,9],[3,10],[4,10],[5,10],[6,10],[6,11],[6,12],[6,13]],"direction":"down"},{"id":"a41","path":[[6,6],[7,6],[8,6],[8,5],[9,5],[9,6],[9,7],[8,7],[8,8],[7,8],[6,8],[6,9]],"direction":"down"},{"id":"a42","path":[[1,22],[1,23],[0,23],[0,22],[0,21],[1,21]],"direction":"right"},{"id":"a43","path":[[8,22],[7,22]],"direction":"left"},{"id":"a44","path":[[16,22],[15,22]],"direction":"left"},{"id":"a45","path":[[20,23],[20,22],[19,22]],"direction":"left"},{"id":"a46","path":[[23,25],[23,24],[23,23],[24,23],[24,24],[25,24],[25,23],[25,22],[24,22],[23,22]],"direction":"left"},{"id":"a47","path":[[21,25],[20,25],[19,25],[18,25],[17,25],[17,24],[18,24]],"direction":"right"},{"id":"a48","path":[[17,10],[17,11],[17,12],[17,13]],"direction":"down"},{"id":"a49","path":[[18,9],[18,10],[18,11],[18,12],[19,12],[19,11],[19,10],[19,9],[19,8],[18,8],[17,8],[17,9]],"direction":"down"},{"id":"a50","path":[[20,6],[21,6],[21,7],[20,7],[20,8],[21,8],[21,9],[20,9],[20,10]],"direction":"down"},{"id":"a51","path":[[17,7],[18,7],[19,7]],"direction":"right"},{"id":"a52","path":[[18,3],[18,2],[17,2],[16,2],[15,2],[14,2],[14,3],[15,3],[16,3],[17,3],[17,4]],"direction":"down"},{"id":"a53","path":[[7,2],[8,2]],"direction":"right"},{"id":"a54","path":[[6,5],[5,5],[5,4],[5,3],[5,2],[6,2]],"direction":"right"},{"id":"a55","path":[[2,3],[2,2],[2,1],[1,1],[1,2],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],[3,1],[3,2],[4,2]],"direction":"right"},{"id":"a56","path":[[1,8],[1,7],[1,6],[2,6],[2,7],[3,7],[3,6],[3,5],[3,4],[2,4],[2,5],[1,5],[1,4],[1,3]],"direction":"up"},{"id":"a57","path":[[5,11],[4,11],[3,11],[2,11],[2,10]],"direction":"up"},{"id":"a58","path":[[11,1],[11,0],[10,0],[9,0],[8,0],[8,1],[7,1],[6,1],[5,1],[4,1]],"direction":"left"},{"id":"a59","path":[[9,9],[9,8]],"direction":"up"},{"id":"a60","path":[[12,10],[12,9],[11,9],[11,8],[11,7]],"direction":"up"},{"id":"a61","path":[[12,0],[13,0],[14,0],[15,0],[16,0],[17,0],[18,0],[19,0],[20,0],[21,0],[21,1],[20,1]],"direction":"left"},{"id":"a62","path":[[12,7],[12,6],[12,5]],"direction":"up"},{"id":"a63","path":[[18,5],[18,4],[19,4],[19,3]],"direction":"up"},{"id":"a64","path":[[13,5],[14,5]],"direction":"right"},{"id":"a65","path":[[6,3],[7,3],[8,3]],"direction":"right"},{"id":"a66","path":[[3,3],[4,3]],"direction":"right"},{"id":"a67","path":[[3,20],[3,19],[3,18]],"direction":"up"},{"id":"a68","path":[[7,9],[7,10],[7,11],[7,12],[7,13],[8,13],[8,12],[8,11]],"direction":"up"},{"id":"a69","path":[[24,0],[25,0],[25,1],[24,1]],"direction":"left"},{"id":"a70","path":[[4,0],[5,0],[6,0],[7,0]],"direction":"right"},{"id":"a71","path":[[5,6],[5,7],[4,7],[4,6],[4,5],[4,4]],"direction":"up"},{"id":"a72","path":[[5,9],[5,8]],"direction":"up"},{"id":"a73","path":[[0,12],[0,11],[0,10],[0,9],[0,8],[0,7],[0,6],[0,5],[0,4],[0,3]],"direction":"up"},{"id":"a74","path":[[7,7],[6,7]],"direction":"left"},{"id":"a75","path":[[16,4],[15,4],[14,4]],"direction":"left"},{"id":"a76","path":[[21,4],[20,4]],"direction":"left"},{"id":"a77","path":[[16,11],[16,10],[16,9],[16,8],[16,7],[16,6]],"direction":"up"},{"id":"a78","path":[[16,13],[15,13],[14,13],[14,12],[14,11],[14,10],[14,9]],"direction":"up"},{"id":"a79","path":[[14,25],[15,25],[16,25],[16,24]],"direction":"up"},{"id":"a80","path":[[15,23],[15,24]],"direction":"down"},{"id":"a81","path":[[15,19],[15,20]],"direction":"down"},{"id":"a82","path":[[11,20],[12,20]],"direction":"right"},{"id":"a83","path":[[0,20],[1,20]],"direction":"right"},{"id":"a84","path":[[1,19],[0,19],[0,18],[0,17],[0,16]],"direction":"up"},{"id":"a85","path":[[1,25],[0,25],[0,24]],"direction":"up"},{"id":"a86","path":[[5,18],[4,18]],"direction":"left"},{"id":"a87","path":[[4,12],[5,12],[5,13]],"direction":"down"},{"id":"a88","path":[[19,13],[18,13]],"direction":"left"},{"id":"a89","path":[[19,19],[19,18]],"direction":"up"},{"id":"a90","path":[[4,25],[4,24]],"direction":"up"},{"id":"a91","path":[[9,16],[8,16]],"direction":"left"},{"id":"a92","path":[[9,25],[9,24]],"direction":"up"},{"id":"a93","path":[[25,25],[24,25]],"direction":"left"}],"timeLimitMs":108000,"obstacles":[[8,19],[24,11],[7,5],[1,12],[1,24]]}},{"id":7,"rewards":{},"board":{"number":7,"width":27,"height":27,"seed":710007,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[20,5],[20,4],[21,4],[22,4],[22,3],[22,2],[22,1],[21,1],[21,0],[20,0],[19,0],[19,1],[18,1],[18,0]],"direction":"up"},{"id":"a1","path":[[21,2],[21,3],[20,3],[20,2],[20,1]],"direction":"up"},{"id":"a2","path":[[21,8],[20,8],[19,8],[18,8],[18,9],[17,9],[17,8],[17,7],[18,7],[19,7],[20,7],[20,6],[21,6],[21,5]],"direction":"up"},{"id":"a3","path":[[20,10],[20,9]],"direction":"up"},{"id":"a4","path":[[13,9],[14,9],[14,8],[15,8],[15,9],[15,10],[15,11],[16,11],[17,11],[18,11],[19,11],[19,12],[20,12],[20,11]],"direction":"up"},{"id":"a5","path":[[15,16],[16,16],[16,17],[17,17],[17,16],[18,16],[18,15],[18,14],[19,14],[20,14],[20,13]],"direction":"up"},{"id":"a6","path":[[24,18],[23,18],[22,18],[22,17],[21,17],[21,18],[20,18],[20,17],[20,16],[20,15]],"direction":"up"},{"id":"a7","path":[[19,23],[20,23],[21,23],[21,24],[22,24],[22,23],[22,22],[22,21],[21,21],[21,20],[20,20],[20,19]],"direction":"up"},{"id":"a8","path":[[11,2],[11,3],[11,4],[12,4],[13,4],[13,3],[14,3],[14,4],[15,4],[16,4],[16,3],[17,3],[18,3],[18,2]],"direction":"up"},{"id":"a9","path":[[21,22],[20,22],[20,21]],"direction":"up"},{"id":"a10","path":[[18,26],[19,26],[20,26],[21,26],[22,26],[23,26],[23,25],[22,25],[21,25],[20,25],[20,24]],"direction":"up"},{"id":"a11","path":[[17,15],[16,15],[15,15],[14,15],[14,16],[14,17],[15,17],[15,18],[16,18],[16,19],[16,20],[16,21],[16,22],[16,23],[16,24],[17,24],[18,24],[18,25]],"direction":"down"},{"id":"a12","path":[[17,23],[17,22],[17,21],[18,21],[19,21],[19,22],[18,22],[18,23]],"direction":"down"},{"id":"a13","path":[[17,20],[17,19],[17,18],[18,18],[18,19],[18,20]],"direction":"down"},{"id":"a14","path":[[19,24],[19,25]],"direction":"down"},{"id":"a15","path":[[19,18],[19,19],[19,20]],"direction":"down"},{"id":"a16","path":[[24,21],[25,21],[26,21],[26,22],[26,23],[26,24],[26,25],[26,26],[25,26],[24,26],[24,25],[25,25],[25,24],[24,24],[24,23],[23,23],[23,24]],"direction":"down"},{"id":"a17","path":[[17,26],[16,26],[15,26],[14,26],[13,26],[13,25],[14,25],[14,24],[15,24],[15,25],[16,25],[17,25]],"direction":"right"},{"id":"a18","path":[[14,13],[15,13],[15,14],[16,14],[16,13],[16,12],[17,12],[17,13],[17,14]],"direction":"down"},{"id":"a19","path":[[14,5],[13,5],[13,6],[14,6],[15,6],[15,5],[16,5],[17,5],[17,6],[16,6],[16,7],[16,8],[16,9],[16,10]],"direction":"down"},{"id":"a20","path":[[15,1],[16,1],[16,2]],"direction":"down"},{"id":"a21","path":[[9,25],[10,25],[11,25],[11,26],[12,26]],"direction":"right"},{"id":"a22","path":[[0,22],[1,22],[1,23],[2,23],[2,24],[2,25],[3,25],[4,25],[5,25],[5,26],[6,26],[7,26],[8,26],[9,26],[10,26]],"direction":"right"},{"id":"a23","path":[[10,15],[10,16],[10,17],[9,17],[9,18],[9,19],[8,19],[8,20],[9,20],[9,21],[9,22],[9,23],[10,23],[10,24]],"direction":"down"},{"id":"a24","path":[[12,23],[12,22],[12,21],[11,21],[10,21],[10,22]],"direction":"down"},{"id":"a25","path":[[14,14],[13,14],[12,14],[11,14],[11,15],[12,15],[12,16],[12,17],[12,18],[11,18],[10,18],[10,19],[10,20]],"direction":"down"},{"id":"a26","path":[[9,14],[8,14],[8,15],[8,16],[7,16],[7,15],[7,14],[7,13],[8,13],[9,13],[10,13],[10,14]],"direction":"down"},{"id":"a27","path":[[6,9],[6,10],[6,11],[7,11],[8,11],[8,10],[7,10],[7,9],[8,9],[8,8],[9,8],[9,9],[10,9],[10,10],[10,11],[10,12]],"direction":"down"},{"id":"a28","path":[[6,1],[6,2],[6,3],[7,3],[7,4],[7,5],[8,5],[8,4],[8,3],[8,2],[9,2],[9,3],[10,3],[10,4],[10,5],[10,6],[10,7],[10,8]],"direction":"down"},{"id":"a29","path":[[12,0],[11,0],[10,0],[10,1],[10,2]],"direction":"down"},{"id":"a30","path":[[7,24],[7,23],[7,22],[7,21],[7,20],[7,19],[6,19],[6,20],[6,21],[6,22],[6,23],[5,23],[5,24]],"direction":"down"},{"id":"a31","path":[[1,18],[1,17],[0,17],[0,18],[0,19],[0,20],[0,21],[1,21],[1,20],[2,20],[3,20],[4,20],[4,19],[5,19],[5,20],[5,21],[5,22]],"direction":"down"},{"id":"a32","path":[[12,20],[11,20]],"direction":"left"},{"id":"a33","path":[[11,19],[12,19],[13,19],[13,18],[14,18],[14,19],[15,19],[15,20],[14,20],[13,20]],"direction":"left"},{"id":"a34","path":[[25,20],[26,20],[26,19],[25,19],[24,19],[24,20],[23,20],[22,20]],"direction":"left"},{"id":"a35","path":[[25,18],[25,17],[26,17],[26,18]],"direction":"down"},{"id":"a36","path":[[24,16],[25,16],[25,15],[26,15],[26,16]],"direction":"down"},{"id":"a37","path":[[24,7],[25,7],[25,8],[25,9],[26,9],[26,10],[25,10],[25,11],[26,11],[26,12],[25,12],[25,13],[26,13],[26,14]],"direction":"down"},{"id":"a38","path":[[22,11],[22,10],[23,10],[23,9],[22,9],[21,9],[21,10],[21,11],[21,12],[22,12],[23,12],[24,12]],"direction":"right"},{"id":"a39","path":[[23,11],[24,11],[24,10],[24,9],[24,8],[23,8],[23,7],[23,6],[24,6],[24,5],[25,5],[25,6],[26,6],[26,7],[26,8]],"direction":"down"},{"id":"a40","path":[[26,0],[25,0],[24,0],[24,1],[25,1],[25,2],[26,2],[26,3],[25,3],[25,4],[26,4],[26,5]],"direction":"down"},{"id":"a41","path":[[22,6],[22,5],[23,5]],"direction":"right"},{"id":"a42","path":[[19,2],[19,3],[19,4],[19,5],[18,5],[18,6],[19,6]],"direction":"right"},{"id":"a43","path":[[15,7],[14,7],[13,7],[12,7],[12,6],[11,6],[11,5],[12,5]],"direction":"right"},{"id":"a44","path":[[9,7],[8,7],[8,6],[9,6]],"direction":"right"},{"id":"a45","path":[[3,1],[3,2],[4,2],[4,3],[5,3],[5,4],[6,4],[6,5],[6,6],[7,6]],"direction":"right"},{"id":"a46","path":[[4,6],[5,6]],"direction":"right"},{"id":"a47","path":[[5,5],[4,5],[4,4],[3,4],[3,5],[2,5],[2,6],[3,6]],"direction":"right"},{"id":"a48","path":[[1,5],[1,4],[1,3],[0,3],[0,4],[0,5],[0,6],[1,6]],"direction":"right"},{"id":"a49","path":[[17,10],[18,10],[19,10],[19,9]],"direction":"up"},{"id":"a50","path":[[14,10],[13,10],[13,11],[12,11],[12,10],[11,10],[11,9],[12,9]],"direction":"right"},{"id":"a51","path":[[2,9],[2,8],[1,8],[1,9],[0,9],[0,10],[0,11],[1,11],[1,10],[2,10],[3,10],[4,10],[4,9],[5,9]],"direction":"right"},{"id":"a52","path":[[5,10],[5,11],[4,11],[3,11],[2,11]],"direction":"left"},{"id":"a53","path":[[23,4],[24,4],[24,3],[23,3],[23,2],[24,2]],"direction":"right"},{"id":"a54","path":[[17,4],[18,4]],"direction":"right"},{"id":"a55","path":[[13,2],[13,1],[13,0],[14,0],[15,0],[16,0],[17,0],[17,1],[17,2]],"direction":"down"},{"id":"a56","path":[[15,3],[15,2],[14,2],[14,1]],"direction":"up"},{"id":"a57","path":[[19,13],[18,13],[18,12]],"direction":"up"},{"id":"a58","path":[[12,12],[13,12],[14,12],[15,12]],"direction":"right"},{"id":"a59","path":[[15,23],[14,23],[14,22],[15,22],[15,21]],"direction":"up"},{"id":"a60","path":[[18,17],[19,17],[19,16],[19,15]],"direction":"up"},{"id":"a61","path":[[25,14],[24,14],[24,13]],"direction":"up"},{"id":"a62","path":[[21,13],[21,14],[21,15],[22,15],[22,14],[22,13],[23,13]],"direction":"right"},{"id":"a63","path":[[11,11],[11,12],[11,13],[12,13],[13,13]],"direction":"right"},{"id":"a64","path":[[9,10],[9,11],[9,12],[8,12],[7,12],[6,12],[5,12],[5,13],[6,13]],"direction":"right"},{"id":"a65","path":[[1,13],[1,14],[1,15],[1,16],[0,16],[0,15],[0,14],[0,13],[0,12],[1,12],[2,12],[3,12],[4,12]],"direction":"right"},{"id":"a66","path":[[3,14],[3,13],[4,13],[4,14],[5,14],[6,14],[6,15],[5,15],[5,16],[6,16],[6,17],[5,17],[4,17],[4,16],[3,16],[2,16]],"direction":"left"},{"id":"a67","path":[[4,15],[3,15],[2,15]],"direction":"left"},{"id":"a68","path":[[25,23],[25,22]],"direction":"up"},{"id":"a69","path":[[23,21],[23,22],[24,22]],"direction":"right"},{"id":"a70","path":[[12,25],[12,24],[13,24],[13,23],[13,22],[13,21],[14,21]],"direction":"right"},{"id":"a71","path":[[6,24],[6,25],[7,25],[8,25]],"direction":"right"},{"id":"a72","path":[[3,26],[2,26],[1,26],[0,26],[0,25],[1,25]],"direction":"right"},{"id":"a73","path":[[3,22],[3,23],[3,24],[4,24],[4,23],[4,22],[4,21],[3,21],[2,21],[2,22]],"direction":"down"},{"id":"a74","path":[[1,19],[2,19],[2,18],[2,17],[3,17],[3,18],[3,19]],"direction":"down"},{"id":"a75","path":[[0,8],[0,7],[1,7],[2,7],[3,7],[4,7],[5,7],[5,8],[4,8],[3,8],[3,9]],"direction":"down"},{"id":"a76","path":[[6,8],[7,8],[7,7],[6,7]],"direction":"left"},{"id":"a77","path":[[23,19],[22,19],[21,19]],"direction":"left"},{"id":"a78","path":[[23,16],[23,17]],"direction":"down"},{"id":"a79","path":[[21,16],[22,16]],"direction":"right"},{"id":"a80","path":[[21,7],[22,7],[22,8]],"direction":"down"},{"id":"a81","path":[[11,7],[11,8],[12,8],[13,8]],"direction":"right"},{"id":"a82","path":[[11,1],[12,1],[12,2],[12,3]],"direction":"down"},{"id":"a83","path":[[2,4],[2,3],[3,3]],"direction":"right"},{"id":"a84","path":[[11,17],[11,16]],"direction":"up"},{"id":"a85","path":[[11,24],[11,23],[11,22]],"direction":"up"},{"id":"a86","path":[[8,21],[8,22],[8,23],[8,24],[9,24]],"direction":"right"},{"id":"a87","path":[[9,15],[9,16]],"direction":"down"},{"id":"a88","path":[[9,4],[9,5]],"direction":"down"},{"id":"a89","path":[[8,1],[8,0],[9,0],[9,1]],"direction":"down"},{"id":"a90","path":[[7,17],[7,18],[8,18],[8,17]],"direction":"up"},{"id":"a91","path":[[0,23],[0,24],[1,24]],"direction":"right"},{"id":"a92","path":[[7,2],[7,1],[7,0],[6,0],[5,0],[4,0],[3,0],[2,0],[1,0],[1,1],[1,2]],"direction":"down"},{"id":"a93","path":[[5,2],[5,1]],"direction":"up"},{"id":"a94","path":[[2,2],[2,1]],"direction":"up"},{"id":"a95","path":[[2,14],[2,13]],"direction":"up"},{"id":"a96","path":[[0,0],[0,1],[0,2]],"direction":"down"},{"id":"a97","path":[[23,1],[23,0],[22,0]],"direction":"left"},{"id":"a98","path":[[13,17],[13,16],[13,15]],"direction":"up"},{"id":"a99","path":[[6,18],[5,18],[4,18]],"direction":"left"},{"id":"a100","path":[[23,14],[23,15],[24,15]],"direction":"right"}],"timeLimitMs":105000,"obstacles":[[24,17],[4,1],[4,26],[26,1],[14,11]]}},{"id":8,"rewards":{},"board":{"number":8,"width":27,"height":27,"seed":710008,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[4,22],[4,23],[5,23],[5,24],[6,24],[7,24],[7,25],[6,25],[5,25],[5,26],[4,26],[4,25],[4,24],[3,24],[3,25],[3,26]],"direction":"down"},{"id":"a1","path":[[3,19],[4,19],[5,19],[5,20],[6,20],[6,21],[6,22],[5,22],[5,21],[4,21],[4,20],[3,20],[3,21],[3,22],[3,23]],"direction":"down"},{"id":"a2","path":[[4,18],[4,17],[4,16],[5,16],[5,17],[5,18]],"direction":"down"},{"id":"a3","path":[[5,13],[5,12],[5,11],[4,11],[3,11],[3,12],[4,12],[4,13],[3,13],[3,14],[4,14],[4,15]],"direction":"down"},{"id":"a4","path":[[5,10],[6,10],[6,9],[5,9],[4,9],[4,10]],"direction":"down"},{"id":"a5","path":[[7,11],[7,10],[7,9],[8,9],[8,10],[9,10],[9,9],[9,8],[10,8],[10,7],[9,7],[8,7],[8,8],[7,8],[7,7],[6,7],[5,7],[4,7],[4,8]],"direction":"down"},{"id":"a6","path":[[6,4],[6,5],[7,5],[8,5],[8,6],[7,6],[6,6],[5,6],[5,5],[5,4],[4,4],[4,5],[4,6]],"direction":"down"},{"id":"a7","path":[[0,12],[1,12],[1,11],[1,10],[2,10],[3,10],[3,9],[3,8],[3,7],[3,6],[3,5],[3,4],[3,3],[3,2],[4,2],[4,3]],"direction":"down"},{"id":"a8","path":[[1,5],[0,5],[0,4],[0,3],[0,2],[0,1],[0,0],[1,0],[2,0],[2,1],[3,1],[3,0],[4,0],[4,1]],"direction":"down"},{"id":"a9","path":[[1,6],[0,6],[0,7],[1,7],[1,8],[0,8],[0,9],[1,9],[2,9],[2,8],[2,7],[2,6],[2,5],[2,4],[2,3],[2,2],[1,2],[1,1]],"direction":"up"},{"id":"a10","path":[[6,8],[5,8]],"direction":"left"},{"id":"a11","path":[[12,11],[11,11],[10,11],[10,10],[10,9],[11,9],[12,9],[12,8],[11,8]],"direction":"left"},{"id":"a12","path":[[18,7],[18,6],[18,5],[17,5],[16,5],[16,4],[15,4],[15,5],[15,6],[14,6],[14,7],[14,8],[13,8]],"direction":"left"},{"id":"a13","path":[[17,15],[17,14],[16,14],[16,13],[15,13],[15,12],[15,11],[14,11],[14,10],[13,10],[13,9],[14,9],[15,9],[16,9],[16,8],[15,8]],"direction":"left"},{"id":"a14","path":[[22,9],[22,8],[21,8],[20,8],[20,9],[21,9],[21,10],[20,10],[19,10],[19,9],[19,8],[18,8],[17,8]],"direction":"left"},{"id":"a15","path":[[26,5],[26,4],[26,3],[25,3],[25,4],[25,5],[25,6],[26,6],[26,7],[26,8],[26,9],[25,9],[25,8],[24,8],[23,8]],"direction":"left"},{"id":"a16","path":[[18,12],[18,13],[19,13],[20,13],[21,13],[21,12],[22,12],[23,12],[24,12],[24,11],[24,10],[23,10],[23,9],[24,9]],"direction":"right"},{"id":"a17","path":[[15,10],[16,10],[16,11],[17,11],[18,11],[18,10],[17,10],[17,9],[18,9]],"direction":"right"},{"id":"a18","path":[[24,4],[24,3],[24,2],[24,1],[25,1],[25,0],[24,0],[23,0],[23,1],[23,2],[23,3],[23,4],[23,5],[24,5]],"direction":"right"},{"id":"a19","path":[[23,7],[23,6]],"direction":"up"},{"id":"a20","path":[[19,3],[20,3],[20,2],[20,1],[21,1],[21,2],[21,3],[22,3],[22,4],[21,4],[21,5],[22,5]],"direction":"right"},{"id":"a21","path":[[20,5],[20,6],[19,6],[19,5],[19,4],[20,4]],"direction":"right"},{"id":"a22","path":[[14,4],[14,5],[13,5],[13,4],[13,3],[13,2],[14,2],[14,3],[15,3],[16,3],[17,3],[17,4],[18,4]],"direction":"right"},{"id":"a23","path":[[11,7],[12,7],[13,7],[13,6],[12,6],[11,6],[11,5],[12,5]],"direction":"right"},{"id":"a24","path":[[10,0],[11,0],[12,0],[12,1],[12,2],[11,2],[10,2],[9,2],[8,2],[8,3],[9,3],[9,4],[9,5],[10,5]],"direction":"right"},{"id":"a25","path":[[10,4],[10,3],[11,3],[11,4],[12,4],[12,3]],"direction":"up"},{"id":"a26","path":[[6,3],[5,3],[5,2],[6,2],[7,2],[7,3],[7,4],[8,4]],"direction":"right"},{"id":"a27","path":[[15,1],[14,1],[14,0],[15,0],[16,0],[16,1],[16,2],[15,2]],"direction":"left"},{"id":"a28","path":[[15,7],[16,7],[16,6]],"direction":"up"},{"id":"a29","path":[[14,12],[14,13],[14,14],[14,15],[15,15],[15,14]],"direction":"up"},{"id":"a30","path":[[21,16],[22,16],[22,15],[21,15],[20,15],[19,15],[18,15],[18,16],[17,16],[17,17],[16,17],[15,17],[15,16]],"direction":"up"},{"id":"a31","path":[[23,17],[22,17],[21,17],[20,17],[20,18],[21,18],[21,19],[20,19],[19,19],[18,19],[17,19],[17,20],[17,21],[16,21],[15,21],[15,20],[15,19],[15,18]],"direction":"up"},{"id":"a32","path":[[17,25],[17,24],[17,23],[17,22],[16,22],[16,23],[16,24],[16,25],[15,25],[15,24],[15,23],[15,22]],"direction":"up"},{"id":"a33","path":[[7,12],[8,12],[9,12],[9,13],[10,13],[10,14],[10,15],[11,15],[11,16],[11,17],[12,17],[12,16],[13,16],[13,17],[14,17],[14,16]],"direction":"up"},{"id":"a34","path":[[8,18],[8,19],[7,19],[7,20],[8,20],[9,20],[10,20],[10,19],[11,19],[11,20],[12,20],[12,19],[13,19],[14,19],[14,18]],"direction":"up"},{"id":"a35","path":[[13,20],[13,21],[13,22],[14,22],[14,21],[14,20]],"direction":"up"},{"id":"a36","path":[[11,22],[12,22],[12,21],[11,21],[10,21],[9,21],[9,22],[10,22],[10,23],[11,23],[11,24],[12,24],[13,24],[14,24],[14,23]],"direction":"up"},{"id":"a37","path":[[10,25],[11,25],[11,26],[12,26],[12,25],[13,25],[13,26],[14,26],[14,25]],"direction":"up"},{"id":"a38","path":[[25,7],[24,7],[24,6]],"direction":"up"},{"id":"a39","path":[[18,3],[18,2],[17,2]],"direction":"left"},{"id":"a40","path":[[19,7],[20,7],[21,7],[22,7]],"direction":"right"},{"id":"a41","path":[[21,6],[22,6]],"direction":"right"},{"id":"a42","path":[[18,14],[19,14],[20,14],[21,14],[22,14],[22,13],[23,13],[23,14],[24,14],[24,13]],"direction":"up"},{"id":"a43","path":[[19,23],[19,22],[19,21],[19,20],[20,20],[21,20],[22,20],[23,20],[23,19],[22,19],[22,18],[23,18],[24,18],[24,17],[24,16],[24,15]],"direction":"up"},{"id":"a44","path":[[22,25],[23,25],[23,26],[24,26],[24,25],[25,25],[25,24],[25,23],[24,23],[24,24],[23,24],[23,23],[23,22],[24,22],[24,21],[24,20],[24,19]],"direction":"up"},{"id":"a45","path":[[0,11],[0,10]],"direction":"up"},{"id":"a46","path":[[12,10],[11,10]],"direction":"left"},{"id":"a47","path":[[13,11],[13,12],[13,13],[13,14],[13,15],[12,15],[12,14],[12,13],[12,12]],"direction":"up"},{"id":"a48","path":[[0,15],[0,16],[0,17],[1,17],[2,17],[2,16],[1,16],[1,15],[1,14],[0,14],[0,13]],"direction":"up"},{"id":"a49","path":[[2,24],[2,23],[2,22],[2,21],[2,20],[2,19],[2,18],[1,18],[1,19],[1,20],[0,20],[0,19],[0,18]],"direction":"up"},{"id":"a50","path":[[1,21],[1,22],[1,23],[1,24],[1,25],[2,25],[2,26],[1,26],[0,26],[0,25],[0,24],[0,23],[0,22],[0,21]],"direction":"up"},{"id":"a51","path":[[1,13],[2,13],[2,14],[2,15]],"direction":"down"},{"id":"a52","path":[[6,14],[5,14]],"direction":"left"},{"id":"a53","path":[[9,14],[9,15],[8,15],[8,14],[7,14]],"direction":"left"},{"id":"a54","path":[[2,11],[2,12]],"direction":"down"},{"id":"a55","path":[[8,13],[7,13],[6,13]],"direction":"left"},{"id":"a56","path":[[1,3],[1,4]],"direction":"down"},{"id":"a57","path":[[7,22],[8,22],[8,21],[7,21]],"direction":"left"},{"id":"a58","path":[[10,24],[9,24],[8,24]],"direction":"left"},{"id":"a59","path":[[23,21],[22,21],[22,22],[22,23],[22,24],[21,24],[21,23],[21,22],[21,21],[20,21],[20,22],[20,23],[20,24],[19,24],[18,24]],"direction":"left"},{"id":"a60","path":[[23,15],[23,16]],"direction":"down"},{"id":"a61","path":[[9,23],[8,23],[7,23],[6,23]],"direction":"left"},{"id":"a62","path":[[13,23],[12,23]],"direction":"left"},{"id":"a63","path":[[7,26],[6,26]],"direction":"left"},{"id":"a64","path":[[5,15],[6,15],[7,15],[7,16],[6,16],[6,17],[7,17],[7,18]],"direction":"down"},{"id":"a65","path":[[8,0],[9,0],[9,1],[8,1],[7,1],[6,1],[6,0],[5,0],[5,1]],"direction":"down"},{"id":"a66","path":[[11,1],[10,1]],"direction":"left"},{"id":"a67","path":[[6,12],[6,11]],"direction":"up"},{"id":"a68","path":[[6,19],[6,18]],"direction":"up"},{"id":"a69","path":[[11,14],[11,13],[11,12],[10,12]],"direction":"left"},{"id":"a70","path":[[26,16],[26,15],[26,14],[25,14]],"direction":"left"},{"id":"a71","path":[[17,13],[17,12],[16,12]],"direction":"left"},{"id":"a72","path":[[16,16],[16,15]],"direction":"up"},{"id":"a73","path":[[16,20],[16,19],[16,18]],"direction":"up"},{"id":"a74","path":[[20,12],[19,12]],"direction":"left"},{"id":"a75","path":[[25,11],[25,10],[26,10],[26,11],[26,12],[25,12]],"direction":"left"},{"id":"a76","path":[[26,13],[25,13]],"direction":"left"},{"id":"a77","path":[[22,11],[23,11]],"direction":"right"},{"id":"a78","path":[[19,11],[20,11],[21,11]],"direction":"right"},{"id":"a79","path":[[8,11],[9,11]],"direction":"right"},{"id":"a80","path":[[9,16],[10,16],[10,17],[9,17],[8,17],[8,16]],"direction":"up"},{"id":"a81","path":[[10,26],[9,26],[8,26],[8,25]],"direction":"up"},{"id":"a82","path":[[20,25],[20,26],[19,26],[19,25],[18,25],[18,26],[17,26],[16,26],[15,26]],"direction":"left"},{"id":"a83","path":[[22,26],[21,26]],"direction":"left"},{"id":"a84","path":[[25,18],[25,19],[25,20],[26,20],[26,21],[25,21],[25,22],[26,22],[26,23],[26,24],[26,25],[26,26],[25,26]],"direction":"left"},{"id":"a85","path":[[25,15],[25,16],[25,17],[26,17],[26,18],[26,19]],"direction":"down"},{"id":"a86","path":[[19,18],[19,17],[19,16],[20,16]],"direction":"right"},{"id":"a87","path":[[22,2],[22,1],[22,0],[21,0],[20,0],[19,0],[18,0],[18,1],[19,1],[19,2]],"direction":"down"},{"id":"a88","path":[[17,18],[18,18],[18,17]],"direction":"up"},{"id":"a89","path":[[9,19],[9,18],[10,18],[11,18],[12,18],[13,18]],"direction":"right"},{"id":"a90","path":[[13,0],[13,1]],"direction":"down"},{"id":"a91","path":[[17,6],[17,7]],"direction":"down"},{"id":"a92","path":[[9,6],[10,6]],"direction":"right"},{"id":"a93","path":[[17,0],[17,1]],"direction":"down"},{"id":"a94","path":[[18,23],[18,22],[18,21],[18,20]],"direction":"up"},{"id":"a95","path":[[26,1],[26,2],[25,2]],"direction":"left"},{"id":"a96","path":[[3,17],[3,16],[3,15]],"direction":"up"}],"timeLimitMs":103000,"obstacles":[[3,18],[26,0],[21,25],[7,0],[22,10],[9,25]]}},{"id":9,"rewards":{},"board":{"number":9,"width":28,"height":28,"seed":710009,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[1,20],[2,20],[3,20],[4,20],[4,21],[3,21],[2,21],[2,22],[3,22],[3,23],[2,23],[1,23],[0,23]],"direction":"left"},{"id":"a1","path":[[3,27],[2,27],[2,26],[3,26],[4,26],[5,26],[5,25],[4,25],[4,24],[5,24],[5,23],[4,23]],"direction":"left"},{"id":"a2","path":[[3,25],[3,24],[2,24],[2,25]],"direction":"down"},{"id":"a3","path":[[1,21],[1,22],[0,22],[0,21],[0,20],[0,19],[1,19],[1,18],[2,18],[2,19]],"direction":"down"},{"id":"a4","path":[[11,24],[11,23],[11,22],[10,22],[10,23],[10,24],[9,24],[9,23],[8,23],[8,24],[7,24],[6,24],[6,23],[6,22],[5,22],[4,22]],"direction":"left"},{"id":"a5","path":[[3,14],[2,14],[1,14],[1,15],[0,15],[0,16],[1,16],[2,16],[2,17]],"direction":"down"},{"id":"a6","path":[[2,15],[3,15],[4,15],[4,16],[3,16]],"direction":"left"},{"id":"a7","path":[[13,19],[13,20],[14,20],[14,19],[14,18],[13,18],[12,18],[12,17],[11,17],[10,17],[9,17],[8,17],[7,17],[7,16],[7,15],[6,15],[6,16],[5,16]],"direction":"left"},{"id":"a8","path":[[12,11],[11,11],[11,12],[11,13],[12,13],[13,13],[14,13],[14,14],[13,14],[13,15],[12,15],[11,15],[10,15],[10,14],[9,14],[9,15],[9,16],[8,16]],"direction":"left"},{"id":"a9","path":[[14,16],[14,15],[15,15],[15,16],[16,16],[16,17],[15,17],[14,17],[13,17],[13,16],[12,16],[11,16],[10,16]],"direction":"left"},{"id":"a10","path":[[20,14],[19,14],[19,13],[19,12],[18,12],[18,13],[18,14],[18,15],[19,15],[19,16],[18,16],[17,16]],"direction":"left"},{"id":"a11","path":[[16,19],[16,20],[17,20],[17,19],[17,18],[17,17],[18,17],[18,18],[19,18],[19,17],[20,17],[20,18],[21,18],[21,17],[21,16],[20,16]],"direction":"left"},{"id":"a12","path":[[27,22],[27,21],[27,20],[27,19],[27,18],[27,17],[27,16],[26,16],[25,16],[25,17],[24,17],[23,17],[23,16],[22,16]],"direction":"left"},{"id":"a13","path":[[25,18],[24,18],[23,18],[23,19],[23,20],[24,20],[24,19],[25,19],[25,20],[26,20]],"direction":"right"},{"id":"a14","path":[[25,24],[26,24],[27,24],[27,23],[26,23],[26,22],[26,21],[25,21],[24,21],[23,21],[22,21],[21,21],[21,20],[22,20]],"direction":"right"},{"id":"a15","path":[[21,25],[20,25],[20,26],[20,27],[19,27],[18,27],[18,26],[19,26],[19,25],[19,24],[20,24],[20,23],[21,23],[21,24],[22,24],[23,24],[24,24]],"direction":"right"},{"id":"a16","path":[[14,24],[13,24],[12,24],[12,25],[12,26],[13,26],[14,26],[14,27],[15,27],[15,26],[16,26],[16,27],[17,27],[17,26],[17,25],[17,24],[18,24],[18,25]],"direction":"down"},{"id":"a17","path":[[22,17],[22,18],[22,19],[21,19],[20,19],[20,20],[19,20],[19,19],[18,19],[18,20],[18,21],[17,21],[16,21],[16,22],[17,22],[17,23]],"direction":"down"},{"id":"a18","path":[[17,14],[17,15]],"direction":"down"},{"id":"a19","path":[[11,10],[12,10],[13,10],[13,11],[14,11],[14,12],[15,12],[15,11],[15,10],[16,10],[16,11],[16,12],[17,12],[17,13]],"direction":"down"},{"id":"a20","path":[[22,3],[21,3],[20,3],[20,4],[20,5],[21,5],[21,6],[21,7],[20,7],[20,8],[19,8],[18,8],[18,9],[17,9],[17,10],[17,11]],"direction":"down"},{"id":"a21","path":[[12,0],[12,1],[11,1],[11,2],[12,2],[13,2],[14,2],[14,3],[14,4],[15,4],[16,4],[16,5],[16,6],[17,6],[17,7],[17,8]],"direction":"down"},{"id":"a22","path":[[15,1],[15,0],[16,0],[16,1],[16,2],[15,2],[15,3],[16,3],[17,3],[17,4],[17,5]],"direction":"down"},{"id":"a23","path":[[13,9],[12,9],[11,9],[10,9],[10,8],[11,8],[12,8],[12,7],[12,6],[11,6],[11,5],[12,5],[13,5],[14,5],[14,6],[15,6],[15,5]],"direction":"up"},{"id":"a24","path":[[13,8],[14,8],[15,8],[15,7]],"direction":"up"},{"id":"a25","path":[[14,10],[14,9],[15,9],[16,9],[16,8],[16,7]],"direction":"up"},{"id":"a26","path":[[15,14],[15,13]],"direction":"up"},{"id":"a27","path":[[16,15],[16,14],[16,13]],"direction":"up"},{"id":"a28","path":[[18,6],[18,5],[19,5],[19,4],[19,3],[19,2],[19,1],[18,1],[17,1],[17,2]],"direction":"down"},{"id":"a29","path":[[9,12],[8,12],[8,11],[9,11],[10,11],[10,10],[9,10],[9,9],[9,8],[9,7],[9,6],[9,5],[9,4],[10,4],[11,4],[12,4],[12,3]],"direction":"up"},{"id":"a30","path":[[18,22],[18,23]],"direction":"down"},{"id":"a31","path":[[20,15],[21,15],[21,14],[22,14],[22,13],[22,12],[21,12],[20,12],[20,11],[19,11],[19,10],[18,10],[18,11]],"direction":"down"},{"id":"a32","path":[[15,24],[16,24],[16,25]],"direction":"down"},{"id":"a33","path":[[1,25],[1,26],[1,27],[0,27],[0,26],[0,25],[0,24],[1,24]],"direction":"right"},{"id":"a34","path":[[11,26],[10,26],[9,26],[9,27],[8,27],[8,26],[7,26],[7,25],[6,25]],"direction":"left"},{"id":"a35","path":[[11,25],[10,25],[9,25],[8,25]],"direction":"left"},{"id":"a36","path":[[15,25],[14,25],[13,25]],"direction":"left"},{"id":"a37","path":[[27,27],[27,26],[26,26],[26,27],[25,27],[25,26],[24,26],[24,27],[23,27],[23,26],[23,25],[22,25]],"direction":"left"},{"id":"a38","path":[[22,26],[21,26],[21,27],[22,27]],"direction":"right"},{"id":"a39","path":[[19,23],[19,22],[20,22],[21,22],[22,22],[22,23]],"direction":"down"},{"id":"a40","path":[[10,27],[11,27],[12,27],[13,27]],"direction":"right"},{"id":"a41","path":[[16,18],[15,18],[15,19],[15,20],[15,21],[14,21],[14,22],[13,22],[13,23]],"direction":"down"},{"id":"a42","path":[[16,23],[15,23],[15,22]],"direction":"up"},{"id":"a43","path":[[11,21],[11,20],[12,20]],"direction":"right"},{"id":"a44","path":[[10,19],[10,18],[9,18],[9,19],[9,20],[10,20]],"direction":"right"},{"id":"a45","path":[[7,21],[7,20],[8,20]],"direction":"right"},{"id":"a46","path":[[3,19],[3,18],[3,17],[4,17],[4,18],[4,19],[5,19],[5,20],[6,20]],"direction":"right"},{"id":"a47","path":[[8,19],[8,18],[7,18],[7,19],[6,19]],"direction":"left"},{"id":"a48","path":[[2,13],[1,13],[1,12],[2,12],[3,12],[3,13]],"direction":"down"},{"id":"a49","path":[[0,14],[0,13],[0,12],[0,11],[1,11],[1,10],[2,10],[2,11]],"direction":"down"},{"id":"a50","path":[[5,7],[5,8],[5,9],[5,10],[6,10],[6,11],[5,11],[4,11],[4,10],[4,9],[3,9],[3,8],[2,8],[2,9]],"direction":"down"},{"id":"a51","path":[[0,8],[1,8],[1,7],[0,7],[0,6],[1,6],[2,6],[2,7]],"direction":"down"},{"id":"a52","path":[[2,2],[3,2],[3,3],[3,4],[2,4],[2,5]],"direction":"down"},{"id":"a53","path":[[4,6],[3,6]],"direction":"left"},{"id":"a54","path":[[5,12],[6,12],[7,12],[7,11],[7,10],[8,10],[8,9],[8,8],[8,7],[8,6],[7,6],[7,5],[7,4],[6,4],[6,5],[6,6],[5,6]],"direction":"left"},{"id":"a55","path":[[4,8],[4,7],[3,7]],"direction":"left"},{"id":"a56","path":[[6,9],[6,8],[7,8],[7,7],[6,7]],"direction":"left"},{"id":"a57","path":[[11,7],[10,7]],"direction":"left"},{"id":"a58","path":[[23,10],[24,10],[25,10],[25,9],[25,8],[24,8],[23,8],[22,8],[21,8]],"direction":"left"},{"id":"a59","path":[[25,3],[25,4],[25,5],[24,5],[24,6],[25,6],[25,7],[26,7],[27,7],[27,8],[26,8]],"direction":"left"},{"id":"a60","path":[[24,4],[23,4],[23,5],[23,6],[23,7],[24,7]],"direction":"right"},{"id":"a61","path":[[5,15],[5,14],[4,14]],"direction":"left"},{"id":"a62","path":[[10,12],[10,13],[9,13],[8,13],[7,13],[7,14],[6,14]],"direction":"left"},{"id":"a63","path":[[3,10],[3,11]],"direction":"down"},{"id":"a64","path":[[20,10],[21,10],[22,10],[22,11],[21,11]],"direction":"left"},{"id":"a65","path":[[24,14],[24,13],[24,12],[24,11],[23,11]],"direction":"left"},{"id":"a66","path":[[26,12],[26,11],[25,11]],"direction":"left"},{"id":"a67","path":[[13,21],[12,21],[12,22],[12,23]],"direction":"down"},{"id":"a68","path":[[27,25],[26,25],[25,25],[24,25]],"direction":"left"},{"id":"a69","path":[[23,22],[24,22],[24,23]],"direction":"down"},{"id":"a70","path":[[24,15],[24,16]],"direction":"down"},{"id":"a71","path":[[25,22],[25,23]],"direction":"down"},{"id":"a72","path":[[7,23],[7,22],[8,22],[9,22]],"direction":"right"},{"id":"a73","path":[[25,12],[25,13],[25,14],[25,15]],"direction":"down"},{"id":"a74","path":[[27,5],[26,5],[26,4],[26,3],[26,2],[26,1],[27,1],[27,0],[26,0],[25,0],[24,0],[24,1],[25,1],[25,2]],"direction":"down"},{"id":"a75","path":[[27,4],[27,3],[27,2]],"direction":"up"},{"id":"a76","path":[[21,4],[22,4]],"direction":"right"},{"id":"a77","path":[[23,3],[23,2],[24,2]],"direction":"right"},{"id":"a78","path":[[22,0],[23,0],[23,1],[22,1],[21,1],[21,0],[20,0],[20,1],[20,2],[21,2],[22,2]],"direction":"right"},{"id":"a79","path":[[17,0],[18,0],[19,0]],"direction":"right"},{"id":"a80","path":[[18,4],[18,3],[18,2]],"direction":"up"},{"id":"a81","path":[[11,3],[10,3],[9,3],[8,3],[8,2],[9,2],[10,2]],"direction":"right"},{"id":"a82","path":[[4,4],[5,4],[5,3],[4,3],[4,2],[4,1],[4,0],[5,0],[6,0],[7,0],[7,1],[6,1],[5,1],[5,2],[6,2],[7,2]],"direction":"right"},{"id":"a83","path":[[22,7],[22,6],[22,5]],"direction":"up"},{"id":"a84","path":[[18,7],[19,7]],"direction":"right"},{"id":"a85","path":[[13,6],[13,7],[14,7]],"direction":"right"},{"id":"a86","path":[[26,17],[26,18],[26,19]],"direction":"down"},{"id":"a87","path":[[11,18],[11,19],[12,19]],"direction":"right"},{"id":"a88","path":[[6,17],[5,17],[5,18],[6,18]],"direction":"right"},{"id":"a89","path":[[0,18],[0,17],[1,17]],"direction":"right"},{"id":"a90","path":[[1,9],[0,9],[0,10]],"direction":"down"},{"id":"a91","path":[[26,9],[27,9],[27,10],[26,10]],"direction":"left"},{"id":"a92","path":[[19,9],[20,9],[21,9],[22,9],[23,9],[24,9]],"direction":"right"},{"id":"a93","path":[[22,15],[23,15],[23,14],[23,13],[23,12]],"direction":"up"},{"id":"a94","path":[[2,3],[1,3],[1,4],[1,5]],"direction":"down"},{"id":"a95","path":[[1,1],[1,0],[2,0],[2,1]],"direction":"down"},{"id":"a96","path":[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5]],"direction":"down"},{"id":"a97","path":[[7,3],[6,3]],"direction":"left"},{"id":"a98","path":[[5,5],[4,5],[3,5]],"direction":"left"},{"id":"a99","path":[[6,13],[5,13],[4,13],[4,12]],"direction":"up"},{"id":"a100","path":[[13,12],[12,12]],"direction":"left"},{"id":"a101","path":[[13,3],[13,4]],"direction":"down"},{"id":"a102","path":[[21,13],[20,13]],"direction":"left"},{"id":"a103","path":[[3,0],[3,1]],"direction":"down"},{"id":"a104","path":[[11,0],[10,0],[9,0],[8,0]],"direction":"left"},{"id":"a105","path":[[10,1],[9,1],[8,1]],"direction":"left"},{"id":"a106","path":[[8,5],[8,4]],"direction":"up"},{"id":"a107","path":[[8,15],[8,14]],"direction":"up"},{"id":"a108","path":[[26,14],[27,14],[27,15],[26,15]],"direction":"left"},{"id":"a109","path":[[11,14],[12,14]],"direction":"right"},{"id":"a110","path":[[27,11],[27,12],[27,13]],"direction":"down"},{"id":"a111","path":[[14,0],[14,1],[13,1]],"direction":"left"},{"id":"a112","path":[[10,6],[10,5]],"direction":"up"},{"id":"a113","path":[[20,6],[19,6]],"direction":"left"},{"id":"a114","path":[[27,6],[26,6]],"direction":"left"},{"id":"a115","path":[[6,26],[6,27],[7,27]],"direction":"right"},{"id":"a116","path":[[4,27],[5,27]],"direction":"right"},{"id":"a117","path":[[19,21],[20,21]],"direction":"right"},{"id":"a118","path":[[8,21],[9,21],[10,21]],"direction":"right"},{"id":"a119","path":[[5,21],[6,21]],"direction":"right"}],"timeLimitMs":100000,"obstacles":[[14,23],[1,2],[24,3],[13,0],[26,13],[7,9],[23,23]]}},{"id":10,"rewards":{"shuffle":2},"board":{"number":10,"width":28,"height":28,"seed":710010,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[0,0],[1,0],[1,1],[0,1]],"direction":"left"},{"id":"a1","path":[[9,0],[8,0],[8,1],[8,2],[7,2],[7,1],[7,0],[6,0],[6,1],[5,1],[5,0],[4,0],[4,1],[3,1],[3,0],[2,0]],"direction":"left"},{"id":"a2","path":[[6,2],[5,2],[5,3],[6,3],[6,4],[7,4],[7,3]],"direction":"up"},{"id":"a3","path":[[10,5],[10,4],[10,3],[9,3],[8,3],[8,4],[8,5],[7,5],[6,5],[5,5],[5,4]],"direction":"up"},{"id":"a4","path":[[13,10],[12,10],[12,11],[11,11],[11,10],[11,9],[10,9],[9,9],[9,8],[9,7],[8,7],[8,8],[7,8],[7,7],[7,6]],"direction":"up"},{"id":"a5","path":[[7,10],[7,9]],"direction":"up"},{"id":"a6","path":[[5,10],[5,11],[4,11],[3,11],[3,12],[3,13],[4,13],[4,12],[5,12],[6,12],[7,12],[7,11]],"direction":"up"},{"id":"a7","path":[[9,18],[8,18],[8,17],[7,17],[6,17],[5,17],[5,16],[6,16],[6,15],[7,15],[8,15],[9,15],[9,14],[8,14],[7,14],[7,13]],"direction":"up"},{"id":"a8","path":[[1,13],[1,12],[1,11],[0,11],[0,10],[1,10],[1,9],[2,9],[3,9],[3,8],[2,8],[2,7],[3,7],[4,7],[4,8],[5,8],[5,7],[5,6]],"direction":"up"},{"id":"a9","path":[[6,6],[6,7],[6,8],[6,9],[5,9],[4,9],[4,10],[3,10],[2,10]],"direction":"left"},{"id":"a10","path":[[6,13],[6,14],[5,14],[5,13]],"direction":"up"},{"id":"a11","path":[[6,11],[6,10]],"direction":"up"},{"id":"a12","path":[[0,20],[0,21],[1,21],[2,21],[2,20],[3,20],[4,20],[4,19],[5,19],[5,20],[6,20],[6,19],[6,18]],"direction":"up"},{"id":"a13","path":[[7,18],[7,19],[7,20],[7,21],[7,22],[6,22],[6,21]],"direction":"up"},{"id":"a14","path":[[7,26],[6,26],[5,26],[5,25],[6,25],[7,25],[8,25],[8,24],[8,23],[7,23],[7,24],[6,24],[6,23]],"direction":"up"},{"id":"a15","path":[[0,23],[1,23],[1,24],[2,24],[3,24],[4,24],[5,24],[5,23],[4,23],[3,23],[3,22],[4,22],[5,22],[5,21],[4,21],[3,21]],"direction":"left"},{"id":"a16","path":[[8,22],[9,22],[9,21],[8,21]],"direction":"left"},{"id":"a17","path":[[10,23],[10,22],[11,22],[11,23],[12,23],[13,23],[14,23],[14,24],[15,24],[15,23],[15,22],[14,22],[14,21],[13,21],[13,22],[12,22],[12,21],[11,21],[10,21]],"direction":"left"},{"id":"a18","path":[[18,24],[18,25],[18,26],[18,27],[17,27],[16,27],[16,26],[16,25],[16,24],[17,24],[17,23],[16,23],[16,22],[17,22],[17,21],[16,21],[15,21]],"direction":"left"},{"id":"a19","path":[[19,20],[18,20],[18,19],[19,19],[20,19],[20,20],[20,21],[19,21],[18,21]],"direction":"left"},{"id":"a20","path":[[22,13],[23,13],[23,14],[23,15],[23,16],[23,17],[23,18],[23,19],[23,20],[23,21],[24,21],[24,22],[24,23],[23,23],[23,22],[22,22],[22,21],[21,21]],"direction":"left"},{"id":"a21","path":[[26,22],[25,22],[25,23],[26,23],[27,23],[27,22],[27,21],[27,20],[26,20],[26,21],[25,21]],"direction":"left"},{"id":"a22","path":[[27,17],[27,16],[26,16],[26,17],[26,18],[27,18],[27,19],[26,19],[25,19],[24,19],[24,20],[25,20]],"direction":"right"},{"id":"a23","path":[[26,14],[26,15],[25,15],[24,15],[24,16],[25,16]],"direction":"right"},{"id":"a24","path":[[22,17],[22,18],[22,19],[21,19],[21,18],[20,18],[20,17],[21,17],[21,16],[22,16]],"direction":"right"},{"id":"a25","path":[[22,14],[22,15],[21,15],[21,14],[21,13],[20,13],[20,14],[20,15],[19,15],[19,16],[20,16]],"direction":"right"},{"id":"a26","path":[[20,12],[20,11],[20,10],[19,10],[19,11],[18,11],[17,11],[16,11],[16,12],[17,12],[17,13],[18,13],[19,13],[19,14],[18,14],[18,15],[17,15],[17,16],[18,16]],"direction":"right"},{"id":"a27","path":[[16,15],[15,15],[14,15],[14,16],[15,16],[16,16]],"direction":"right"},{"id":"a28","path":[[12,14],[12,15],[12,16],[13,16]],"direction":"right"},{"id":"a29","path":[[16,10],[15,10],[15,11],[15,12],[14,12],[14,11],[13,11],[13,12],[12,12],[11,12],[11,13],[10,13],[10,14],[11,14],[11,15],[10,15],[10,16],[11,16]],"direction":"right"},{"id":"a30","path":[[7,16],[8,16],[9,16]],"direction":"right"},{"id":"a31","path":[[5,15],[4,15],[3,15],[2,15],[2,16],[3,16],[4,16]],"direction":"right"},{"id":"a32","path":[[1,20],[1,19],[0,19],[0,18],[0,17],[0,16],[1,16]],"direction":"right"},{"id":"a33","path":[[2,17],[1,17]],"direction":"left"},{"id":"a34","path":[[5,18],[4,18],[4,17],[3,17]],"direction":"left"},{"id":"a35","path":[[14,17],[13,17],[13,18],[13,19],[12,19],[11,19],[11,20],[10,20],[10,19],[10,18],[11,18],[12,18],[12,17],[11,17],[10,17],[9,17]],"direction":"left"},{"id":"a36","path":[[18,18],[17,18],[17,19],[16,19],[16,18],[16,17],[15,17]],"direction":"left"},{"id":"a37","path":[[19,18],[19,17],[18,17],[17,17]],"direction":"left"},{"id":"a38","path":[[24,18],[25,18],[25,17],[24,17]],"direction":"left"},{"id":"a39","path":[[14,20],[14,19],[14,18],[15,18]],"direction":"right"},{"id":"a40","path":[[1,18],[2,18],[3,18]],"direction":"right"},{"id":"a41","path":[[8,19],[9,19],[9,20],[8,20]],"direction":"left"},{"id":"a42","path":[[13,20],[12,20]],"direction":"left"},{"id":"a43","path":[[3,19],[2,19]],"direction":"left"},{"id":"a44","path":[[21,20],[22,20]],"direction":"right"},{"id":"a45","path":[[15,19],[15,20],[16,20],[17,20]],"direction":"right"},{"id":"a46","path":[[24,25],[24,24],[23,24],[22,24],[22,25],[23,25],[23,26],[22,26],[21,26],[21,25],[21,24],[21,23],[22,23]],"direction":"right"},{"id":"a47","path":[[18,22],[19,22],[19,23],[20,23]],"direction":"right"},{"id":"a48","path":[[20,22],[21,22]],"direction":"right"},{"id":"a49","path":[[17,25],[17,26]],"direction":"down"},{"id":"a50","path":[[14,1],[13,1],[13,0],[12,0],[11,0],[10,0],[10,1],[11,1],[11,2],[10,2],[9,2],[9,1]],"direction":"up"},{"id":"a51","path":[[8,6],[9,6],[9,5],[9,4]],"direction":"up"},{"id":"a52","path":[[8,9],[8,10],[8,11],[8,12],[9,12],[9,11],[9,10]],"direction":"up"},{"id":"a53","path":[[11,7],[10,7],[10,6]],"direction":"up"},{"id":"a54","path":[[12,5],[11,5],[11,4],[11,3],[12,3],[13,3],[13,2]],"direction":"up"},{"id":"a55","path":[[12,2],[12,1]],"direction":"up"},{"id":"a56","path":[[20,3],[20,2],[19,2],[19,1],[19,0],[18,0],[17,0],[16,0],[16,1],[15,1],[15,0],[14,0]],"direction":"left"},{"id":"a57","path":[[15,2],[14,2],[14,3],[14,4],[15,4],[15,3],[16,3],[17,3],[17,4],[18,4],[19,4],[19,3],[18,3],[18,2],[18,1]],"direction":"up"},{"id":"a58","path":[[16,4],[16,5],[16,6],[17,6],[18,6],[18,7],[17,7],[16,7],[15,7],[15,8],[14,8],[14,7],[14,6],[15,6],[15,5]],"direction":"up"},{"id":"a59","path":[[21,5],[20,5],[20,6],[19,6],[19,5]],"direction":"up"},{"id":"a60","path":[[21,8],[20,8],[19,8],[19,7]],"direction":"up"},{"id":"a61","path":[[16,2],[17,2],[17,1]],"direction":"up"},{"id":"a62","path":[[13,8],[13,9],[14,9],[15,9],[16,9],[16,8]],"direction":"up"},{"id":"a63","path":[[14,14],[15,14],[15,13]],"direction":"up"},{"id":"a64","path":[[12,25],[13,25],[14,25],[14,26],[15,26],[15,25]],"direction":"up"},{"id":"a65","path":[[17,14],[16,14],[16,13]],"direction":"up"},{"id":"a66","path":[[18,10],[18,9],[18,8],[17,8],[17,9],[17,10]],"direction":"down"},{"id":"a67","path":[[21,0],[20,0]],"direction":"left"},{"id":"a68","path":[[20,4],[21,4],[22,4],[22,3],[22,2],[22,1],[23,1],[23,0],[22,0]],"direction":"left"},{"id":"a69","path":[[24,2],[24,1],[25,1],[25,2],[25,3],[24,3],[24,4],[25,4],[26,4],[26,3],[27,3],[27,2],[26,2],[26,1],[27,1],[27,0],[26,0],[25,0],[24,0]],"direction":"left"},{"id":"a70","path":[[23,6],[24,6],[25,6],[25,5],[24,5],[23,5],[22,5],[22,6],[22,7],[23,7],[24,7],[25,7],[26,7],[27,7],[27,6],[27,5],[27,4]],"direction":"up"},{"id":"a71","path":[[19,9],[20,9],[21,9],[21,10],[22,10],[23,10],[23,9],[22,9],[22,8]],"direction":"up"},{"id":"a72","path":[[21,11],[21,12],[22,12],[22,11]],"direction":"up"},{"id":"a73","path":[[23,8],[24,8],[24,9],[24,10],[25,10],[26,10],[26,9],[25,9],[25,8]],"direction":"up"},{"id":"a74","path":[[26,8],[27,8],[27,9],[27,10],[27,11],[27,12],[27,13],[26,13],[25,13],[25,12],[24,12],[24,11]],"direction":"up"},{"id":"a75","path":[[24,14],[24,13]],"direction":"up"},{"id":"a76","path":[[19,25],[19,24],[20,24],[20,25],[20,26],[19,26],[19,27],[20,27],[21,27],[22,27],[23,27],[24,27],[24,26]],"direction":"up"},{"id":"a77","path":[[23,11],[23,12]],"direction":"down"},{"id":"a78","path":[[23,3],[23,4]],"direction":"down"},{"id":"a79","path":[[12,4],[13,4]],"direction":"right"},{"id":"a80","path":[[0,9],[0,8],[0,7],[0,6],[0,5],[0,4],[1,4],[1,3],[2,3],[2,4],[3,4],[4,4]],"direction":"right"},{"id":"a81","path":[[4,5],[4,6],[3,6],[3,5],[2,5],[1,5]],"direction":"left"},{"id":"a82","path":[[14,5],[13,5]],"direction":"left"},{"id":"a83","path":[[11,6],[12,6],[12,7],[13,7],[13,6]],"direction":"up"},{"id":"a84","path":[[12,9],[12,8]],"direction":"up"},{"id":"a85","path":[[10,8],[11,8]],"direction":"right"},{"id":"a86","path":[[12,26],[13,26],[13,27],[12,27],[11,27],[11,26],[10,26],[10,27],[9,27],[8,27],[8,26],[9,26],[9,25],[10,25],[11,25],[11,24]],"direction":"up"},{"id":"a87","path":[[10,12],[10,11],[10,10]],"direction":"up"},{"id":"a88","path":[[18,5],[17,5]],"direction":"left"},{"id":"a89","path":[[2,6],[1,6]],"direction":"left"},{"id":"a90","path":[[12,13],[13,13],[14,13]],"direction":"right"},{"id":"a91","path":[[13,15],[13,14]],"direction":"up"},{"id":"a92","path":[[8,13],[9,13]],"direction":"right"},{"id":"a93","path":[[27,15],[27,14]],"direction":"up"},{"id":"a94","path":[[0,12],[0,13],[0,14],[0,15],[1,15]],"direction":"right"},{"id":"a95","path":[[4,14],[3,14],[2,14],[1,14]],"direction":"left"},{"id":"a96","path":[[27,26],[27,27],[26,27],[25,27],[25,26],[26,26],[26,25],[27,25],[27,24]],"direction":"up"},{"id":"a97","path":[[3,26],[4,26]],"direction":"right"},{"id":"a98","path":[[7,27],[6,27],[5,27],[4,27],[3,27],[2,27],[1,27],[0,27],[0,26],[1,26],[2,26]],"direction":"right"},{"id":"a99","path":[[0,24],[0,25]],"direction":"down"},{"id":"a100","path":[[4,25],[3,25],[2,25],[1,25]],"direction":"left"},{"id":"a101","path":[[3,2],[3,3]],"direction":"down"},{"id":"a102","path":[[0,22],[1,22],[2,22],[2,23]],"direction":"down"},{"id":"a103","path":[[2,11],[2,12],[2,13]],"direction":"down"},{"id":"a104","path":[[2,1],[2,2]],"direction":"down"},{"id":"a105","path":[[21,3],[21,2],[21,1],[20,1]],"direction":"left"},{"id":"a106","path":[[19,12],[18,12]],"direction":"left"},{"id":"a107","path":[[26,12],[26,11],[25,11]],"direction":"left"},{"id":"a108","path":[[1,7],[1,8]],"direction":"down"},{"id":"a109","path":[[21,6],[21,7],[20,7]],"direction":"left"},{"id":"a110","path":[[0,2],[0,3]],"direction":"down"},{"id":"a111","path":[[4,2],[4,3]],"direction":"down"},{"id":"a112","path":[[10,24],[9,24]],"direction":"left"},{"id":"a113","path":[[13,24],[12,24]],"direction":"left"},{"id":"a114","path":[[15,27],[14,27]],"direction":"left"},{"id":"a115","path":[[25,24],[26,24]],"direction":"right"},{"id":"a116","path":[[26,5],[26,6]],"direction":"down"}],"timeLimitMs":97000,"obstacles":[[14,10],[25,25],[1,2],[9,23],[23,2],[25,14],[18,23]]}},{"id":11,"rewards":{},"board":{"number":11,"width":28,"height":28,"seed":710011,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[1,25],[1,26],[2,26],[3,26],[3,27],[2,27],[1,27],[0,27]],"direction":"left"},{"id":"a1","path":[[2,25],[2,24],[2,23],[2,22],[3,22],[3,21],[2,21],[1,21],[0,21],[0,22],[1,22],[1,23],[1,24]],"direction":"down"},{"id":"a2","path":[[2,15],[2,16],[2,17],[1,17],[1,18],[0,18],[0,19],[0,20],[1,20],[1,19],[2,19],[2,20]],"direction":"down"},{"id":"a3","path":[[4,27],[5,27],[6,27],[7,27],[7,26],[6,26],[5,26],[4,26],[4,25],[3,25],[3,24],[3,23],[4,23],[4,22],[4,21],[4,20],[3,20]],"direction":"left"},{"id":"a4","path":[[2,18],[3,18],[3,19]],"direction":"down"},{"id":"a5","path":[[0,15],[0,14],[0,13],[0,12],[0,11],[0,10],[1,10],[1,9],[2,9],[2,10],[3,10],[3,11],[2,11],[1,11],[1,12],[1,13],[2,13],[2,14]],"direction":"down"},{"id":"a6","path":[[7,15],[7,16],[6,16],[6,17],[5,17],[5,16],[5,15],[4,15],[4,16],[4,17],[3,17],[3,16],[3,15],[3,14],[4,14],[4,13],[3,13],[3,12],[2,12]],"direction":"left"},{"id":"a7","path":[[6,5],[7,5],[7,4],[6,4],[5,4],[4,4],[3,4],[2,4],[2,5],[1,5],[0,5],[0,6],[0,7],[1,7],[1,6],[2,6],[2,7],[2,8],[3,8],[3,9]],"direction":"down"},{"id":"a8","path":[[3,5],[4,5],[4,6],[3,6]],"direction":"left"},{"id":"a9","path":[[6,12],[6,11],[5,11],[4,11],[4,10],[5,10],[5,9],[4,9],[4,8],[4,7],[3,7]],"direction":"left"},{"id":"a10","path":[[13,14],[12,14],[12,15],[11,15],[11,16],[10,16],[10,17],[9,17],[9,16],[9,15],[10,15],[10,14],[9,14],[9,13],[9,12],[8,12],[8,11],[7,11]],"direction":"left"},{"id":"a11","path":[[10,13],[10,12],[10,11],[9,11]],"direction":"left"},{"id":"a12","path":[[19,4],[18,4],[17,4],[16,4],[16,5],[15,5],[14,5],[14,6],[14,7],[14,8],[13,8],[12,8],[12,9],[12,10],[12,11],[11,11]],"direction":"left"},{"id":"a13","path":[[16,10],[16,11],[17,11],[17,10],[17,9],[16,9],[15,9],[14,9],[13,9],[13,10],[14,10],[15,10],[15,11],[14,11],[13,11]],"direction":"left"},{"id":"a14","path":[[19,15],[19,14],[18,14],[18,13],[19,13],[20,13],[21,13],[21,12],[20,12],[19,12],[19,11],[18,11]],"direction":"left"},{"id":"a15","path":[[23,13],[23,12],[23,11],[22,11],[21,11],[20,11]],"direction":"left"},{"id":"a16","path":[[27,10],[27,9],[27,8],[26,8],[25,8],[24,8],[23,8],[23,9],[24,9],[25,9],[25,10],[25,11],[24,11]],"direction":"left"},{"id":"a17","path":[[25,18],[25,17],[24,17],[24,16],[24,15],[24,14],[25,14],[25,13],[26,13],[27,13],[27,12],[27,11],[26,11]],"direction":"left"},{"id":"a18","path":[[24,13],[24,12],[25,12],[26,12]],"direction":"right"},{"id":"a19","path":[[26,0],[25,0],[24,0],[24,1],[23,1],[22,1],[22,2],[22,3],[22,4],[22,5],[21,5],[21,6],[22,6],[23,6],[23,7],[22,7],[21,7],[21,8],[22,8]],"direction":"right"},{"id":"a20","path":[[25,1],[25,2],[24,2],[24,3],[24,4],[25,4],[25,3],[26,3],[26,2],[26,1]],"direction":"up"},{"id":"a21","path":[[27,0],[27,1],[27,2],[27,3],[27,4],[27,5],[26,5],[26,4]],"direction":"up"},{"id":"a22","path":[[24,6],[24,7],[25,7],[25,6],[26,6],[26,7],[27,7],[27,6]],"direction":"up"},{"id":"a23","path":[[21,23],[22,23],[23,23],[24,23],[25,23],[26,23],[26,22],[27,22],[27,21],[27,20],[26,20],[26,19],[27,19],[27,18],[27,17],[27,16],[27,15],[27,14]],"direction":"up"},{"id":"a24","path":[[23,20],[24,20],[24,21],[23,21],[23,22],[22,22],[21,22],[21,21],[22,21],[22,20],[22,19],[23,19],[24,19],[25,19],[25,20],[25,21],[26,21]],"direction":"right"},{"id":"a25","path":[[20,19],[21,19]],"direction":"right"},{"id":"a26","path":[[13,22],[13,21],[14,21],[15,21],[15,22],[16,22],[16,23],[17,23],[17,22],[17,21],[18,21],[18,20],[18,19],[19,19]],"direction":"right"},{"id":"a27","path":[[15,20],[15,19],[16,19],[17,19]],"direction":"right"},{"id":"a28","path":[[17,18],[17,17],[16,17],[15,17],[14,17],[14,18],[13,18],[12,18],[12,19],[13,19],[14,19]],"direction":"right"},{"id":"a29","path":[[13,17],[12,17],[11,17],[11,18],[10,18],[10,19],[11,19]],"direction":"right"},{"id":"a30","path":[[9,18],[8,18],[8,19],[9,19]],"direction":"right"},{"id":"a31","path":[[4,18],[4,19],[5,19],[5,18],[6,18],[6,19],[7,19]],"direction":"right"},{"id":"a32","path":[[19,27],[19,26],[18,26],[17,26],[17,25],[18,25],[18,24],[18,23],[18,22],[19,22],[19,21],[19,20],[20,20],[21,20]],"direction":"right"},{"id":"a33","path":[[16,21],[16,20],[17,20]],"direction":"right"},{"id":"a34","path":[[7,21],[8,21],[8,22],[9,22],[9,21],[9,20],[10,20],[11,20],[11,21],[12,21],[12,20],[13,20],[14,20]],"direction":"right"},{"id":"a35","path":[[5,22],[5,21],[5,20],[6,20],[7,20],[8,20]],"direction":"right"},{"id":"a36","path":[[25,25],[25,24],[24,24],[23,24],[23,25],[22,25],[21,25],[21,26],[20,26],[20,25],[20,24],[19,24],[19,25]],"direction":"down"},{"id":"a37","path":[[24,22],[25,22]],"direction":"right"},{"id":"a38","path":[[27,25],[27,26],[26,26],[26,25],[26,24],[27,24],[27,23]],"direction":"up"},{"id":"a39","path":[[21,24],[22,24]],"direction":"right"},{"id":"a40","path":[[18,27],[17,27],[16,27],[15,27],[15,26],[15,25],[15,24],[16,24],[17,24]],"direction":"right"},{"id":"a41","path":[[16,25],[16,26]],"direction":"down"},{"id":"a42","path":[[19,16],[20,16],[20,17],[19,17],[18,17],[18,16],[18,15],[17,15],[17,16]],"direction":"down"},{"id":"a43","path":[[18,12],[17,12],[16,12],[16,13],[17,13],[17,14]],"direction":"down"},{"id":"a44","path":[[15,8],[16,8],[16,7],[15,7],[15,6],[16,6],[17,6],[17,7],[17,8]],"direction":"down"},{"id":"a45","path":[[13,26],[13,25],[14,25],[14,26],[14,27],[13,27],[12,27],[12,26],[12,25],[12,24],[11,24],[11,23],[12,23],[13,23],[13,24],[14,24]],"direction":"right"},{"id":"a46","path":[[10,27],[10,26],[9,26],[8,26],[8,25],[7,25],[7,24],[8,24],[8,23],[9,23],[9,24],[10,24]],"direction":"right"},{"id":"a47","path":[[6,21],[6,22],[7,22],[7,23]],"direction":"down"},{"id":"a48","path":[[8,16],[8,17],[7,17],[7,18]],"direction":"down"},{"id":"a49","path":[[16,18],[15,18]],"direction":"left"},{"id":"a50","path":[[12,16],[13,16],[13,15],[14,15],[14,14],[15,14],[16,14],[16,15],[16,16]],"direction":"down"},{"id":"a51","path":[[20,0],[20,1],[21,1],[21,2],[20,2],[20,3],[19,3],[18,3],[17,3],[17,2],[17,1],[17,0],[16,0],[16,1],[16,2],[16,3]],"direction":"down"},{"id":"a52","path":[[19,2],[18,2],[18,1],[19,1]],"direction":"right"},{"id":"a53","path":[[13,3],[14,3],[14,4],[13,4],[13,5],[12,5],[12,4],[12,3],[12,2],[13,2],[13,1],[14,1],[15,1]],"direction":"right"},{"id":"a54","path":[[6,0],[7,0],[8,0],[9,0],[10,0],[10,1],[9,1],[8,1],[8,2],[9,2],[10,2],[11,2],[11,1],[12,1]],"direction":"right"},{"id":"a55","path":[[11,3],[11,4],[10,4],[10,3]],"direction":"up"},{"id":"a56","path":[[10,6],[10,5]],"direction":"up"},{"id":"a57","path":[[6,7],[6,8],[7,8],[7,9],[7,10],[8,10],[8,9],[9,9],[10,9],[10,8],[10,7]],"direction":"up"},{"id":"a58","path":[[9,4],[8,4],[8,3]],"direction":"up"},{"id":"a59","path":[[9,5],[9,6],[8,6],[8,5]],"direction":"up"},{"id":"a60","path":[[9,7],[9,8],[8,8],[8,7]],"direction":"up"},{"id":"a61","path":[[7,14],[8,14],[8,13]],"direction":"up"},{"id":"a62","path":[[7,12],[7,13]],"direction":"down"},{"id":"a63","path":[[6,6],[7,6],[7,7]],"direction":"down"},{"id":"a64","path":[[5,0],[4,0],[4,1],[4,2],[5,2],[5,1],[6,1],[7,1],[7,2],[7,3]],"direction":"down"},{"id":"a65","path":[[3,2],[3,1],[3,0],[2,0],[2,1],[2,2],[2,3],[3,3],[4,3],[5,3],[6,3],[6,2]],"direction":"up"},{"id":"a66","path":[[6,10],[6,9]],"direction":"up"},{"id":"a67","path":[[11,5],[11,6],[12,6],[12,7],[11,7],[11,8],[11,9],[11,10],[10,10],[9,10]],"direction":"left"},{"id":"a68","path":[[19,5],[19,6],[19,7],[18,7],[18,8],[18,9],[19,9],[19,10],[18,10]],"direction":"left"},{"id":"a69","path":[[23,10],[22,10],[21,10],[20,10]],"direction":"left"},{"id":"a70","path":[[10,23],[10,22],[10,21]],"direction":"up"},{"id":"a71","path":[[12,22],[11,22]],"direction":"left"},{"id":"a72","path":[[11,14],[11,13],[11,12],[12,12],[12,13]],"direction":"down"},{"id":"a73","path":[[6,15],[6,14],[6,13]],"direction":"up"},{"id":"a74","path":[[5,25],[6,25],[6,24],[6,23]],"direction":"up"},{"id":"a75","path":[[1,4],[0,4],[0,3],[1,3],[1,2],[0,2],[0,1],[1,1]],"direction":"right"},{"id":"a76","path":[[15,4],[15,3],[15,2],[14,2]],"direction":"left"},{"id":"a77","path":[[21,3],[21,4],[20,4]],"direction":"left"},{"id":"a78","path":[[19,8],[20,8],[20,7],[20,6],[20,5]],"direction":"up"},{"id":"a79","path":[[5,8],[5,7],[5,6],[5,5]],"direction":"up"},{"id":"a80","path":[[0,9],[0,8],[1,8]],"direction":"right"},{"id":"a81","path":[[22,9],[21,9],[20,9]],"direction":"left"},{"id":"a82","path":[[21,14],[22,14],[23,14],[23,15],[22,15],[21,15],[20,15],[20,14]],"direction":"up"},{"id":"a83","path":[[18,5],[17,5]],"direction":"left"},{"id":"a84","path":[[25,5],[24,5],[23,5]],"direction":"left"},{"id":"a85","path":[[26,14],[26,15],[26,16],[25,16],[25,15]],"direction":"up"},{"id":"a86","path":[[23,17],[22,17],[21,17],[21,16],[22,16],[23,16]],"direction":"right"},{"id":"a87","path":[[24,25],[24,26],[23,26],[23,27],[24,27],[25,27],[25,26]],"direction":"up"},{"id":"a88","path":[[9,25],[10,25],[11,25]],"direction":"right"},{"id":"a89","path":[[14,13],[15,13],[15,12],[14,12],[13,12],[13,13]],"direction":"down"},{"id":"a90","path":[[13,6],[13,7]],"direction":"down"},{"id":"a91","path":[[23,18],[22,18],[21,18],[20,18],[19,18],[18,18]],"direction":"left"},{"id":"a92","path":[[19,23],[20,23],[20,22],[20,21]],"direction":"up"},{"id":"a93","path":[[14,23],[15,23]],"direction":"right"},{"id":"a94","path":[[23,3],[23,4]],"direction":"down"},{"id":"a95","path":[[26,10],[26,9]],"direction":"up"},{"id":"a96","path":[[26,18],[26,17]],"direction":"up"},{"id":"a97","path":[[21,0],[22,0],[23,0]],"direction":"right"},{"id":"a98","path":[[22,13],[22,12]],"direction":"up"},{"id":"a99","path":[[20,27],[21,27],[22,27],[22,26]],"direction":"up"},{"id":"a100","path":[[4,12],[5,12]],"direction":"right"},{"id":"a101","path":[[5,14],[5,13]],"direction":"up"},{"id":"a102","path":[[4,24],[5,24],[5,23]],"direction":"up"},{"id":"a103","path":[[18,0],[19,0]],"direction":"right"},{"id":"a104","path":[[11,0],[12,0],[13,0],[14,0],[15,0]],"direction":"right"},{"id":"a105","path":[[11,27],[11,26]],"direction":"up"},{"id":"a106","path":[[14,16],[15,16],[15,15]],"direction":"up"},{"id":"a107","path":[[0,17],[0,16],[1,16]],"direction":"right"},{"id":"a108","path":[[1,14],[1,15]],"direction":"down"},{"id":"a109","path":[[0,0],[1,0]],"direction":"right"},{"id":"a110","path":[[0,25],[0,24],[0,23]],"direction":"up"},{"id":"a111","path":[[9,27],[8,27]],"direction":"left"},{"id":"a112","path":[[27,27],[26,27]],"direction":"left"}],"timeLimitMs":95000,"obstacles":[[8,15],[23,2],[24,18],[0,26],[9,3],[14,22],[24,10],[18,6]]}},{"id":12,"rewards":{},"board":{"number":12,"width":29,"height":29,"seed":710012,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[27,3],[26,3],[25,3],[25,4],[26,4],[27,4],[28,4],[28,3],[28,2],[27,2],[26,2],[25,2],[25,1],[25,0]],"direction":"up"},{"id":"a1","path":[[20,2],[20,3],[21,3],[21,2],[22,2],[23,2],[23,1],[23,0],[24,0],[24,1],[24,2],[24,3],[24,4],[24,5],[24,6],[24,7],[25,7],[25,6],[25,5]],"direction":"up"},{"id":"a2","path":[[23,3],[22,3],[22,4],[21,4],[20,4],[20,5],[19,5],[18,5],[18,4],[19,4],[19,3],[18,3],[18,2],[19,2]],"direction":"right"},{"id":"a3","path":[[10,9],[10,8],[11,8],[11,7],[12,7],[13,7],[13,6],[13,5],[12,5],[12,4],[11,4],[11,3],[12,3],[13,3],[13,2],[14,2],[15,2],[15,3],[16,3],[17,3]],"direction":"right"},{"id":"a4","path":[[15,13],[16,13],[16,14],[17,14],[17,13],[17,12],[18,12],[18,11],[18,10],[19,10],[19,9],[19,8],[19,7],[20,7],[20,6],[21,6],[21,5],[22,5],[23,5],[23,4]],"direction":"up"},{"id":"a5","path":[[15,4],[16,4],[17,4]],"direction":"right"},{"id":"a6","path":[[27,6],[26,6],[26,5],[27,5],[28,5],[28,6],[28,7],[28,8],[27,8],[27,7],[26,7],[26,8],[25,8],[25,9],[24,9],[24,8],[23,8],[23,7],[23,6]],"direction":"up"},{"id":"a7","path":[[18,15],[18,14],[18,13],[19,13],[19,12],[19,11],[20,11],[20,12],[20,13],[21,13],[21,12],[22,12],[23,12],[23,11],[24,11],[24,10]],"direction":"up"},{"id":"a8","path":[[18,18],[18,17],[19,17],[19,16],[20,16],[20,17],[21,17],[21,16],[22,16],[22,15],[21,15],[21,14],[22,14],[22,13],[23,13],[24,13],[24,12]],"direction":"up"},{"id":"a9","path":[[23,14],[23,15],[23,16],[24,16],[24,15],[24,14]],"direction":"up"},{"id":"a10","path":[[23,17],[22,17],[22,18],[23,18],[24,18],[24,17]],"direction":"up"},{"id":"a11","path":[[28,28],[28,27],[28,26],[28,25],[28,24],[28,23],[28,22],[28,21],[27,21],[27,22],[26,22],[26,21],[26,20],[25,20],[24,20],[24,19]],"direction":"up"},{"id":"a12","path":[[23,23],[23,24],[23,25],[23,26],[22,26],[22,27],[23,27],[24,27],[24,26],[24,25],[25,25],[25,26],[26,26],[27,26]],"direction":"right"},{"id":"a13","path":[[15,22],[15,23],[16,23],[17,23],[17,24],[16,24],[16,25],[16,26],[16,27],[15,27],[15,28],[16,28],[17,28],[18,28],[18,27],[18,26],[19,26],[20,26],[21,26]],"direction":"right"},{"id":"a14","path":[[19,23],[19,24],[20,24],[20,25],[19,25],[18,25],[17,25],[17,26],[17,27]],"direction":"down"},{"id":"a15","path":[[11,20],[12,20],[12,21],[12,22],[13,22],[14,22],[14,23],[13,23],[13,24],[14,24],[15,24],[15,25],[14,25],[14,26],[15,26]],"direction":"right"},{"id":"a16","path":[[12,19],[11,19],[10,19],[10,18],[11,18],[12,18],[13,18],[13,19],[14,19],[15,19],[15,20],[15,21]],"direction":"down"},{"id":"a17","path":[[18,16],[17,16],[17,17],[16,17],[15,17],[15,18]],"direction":"down"},{"id":"a18","path":[[17,11],[17,10],[16,10],[16,11],[16,12],[15,12],[14,12],[14,13],[13,13],[13,14],[14,14],[15,14],[15,15],[15,16]],"direction":"down"},{"id":"a19","path":[[14,5],[14,6],[14,7],[14,8],[15,8],[15,9],[15,10],[15,11]],"direction":"down"},{"id":"a20","path":[[17,8],[16,8],[16,7],[16,6],[15,6],[15,7]],"direction":"down"},{"id":"a21","path":[[13,25],[12,25],[11,25],[11,26],[11,27],[11,28],[12,28],[12,27],[12,26],[13,26]],"direction":"right"},{"id":"a22","path":[[12,24],[12,23],[11,23],[11,24]],"direction":"down"},{"id":"a23","path":[[14,16],[14,15],[13,15],[12,15],[11,15],[11,16],[12,16],[12,17]],"direction":"down"},{"id":"a24","path":[[11,13],[11,14],[10,14],[10,13],[10,12],[11,12],[11,11],[12,11],[12,12],[12,13],[12,14]],"direction":"down"},{"id":"a25","path":[[12,8],[13,8],[13,9],[12,9],[12,10]],"direction":"down"},{"id":"a26","path":[[4,23],[4,24],[4,25],[5,25],[5,24],[5,23],[6,23],[7,23],[8,23],[8,22],[9,22],[9,23],[10,23],[10,22],[10,21],[11,21],[11,22]],"direction":"down"},{"id":"a27","path":[[9,27],[8,27],[7,27],[7,26],[8,26],[8,25],[8,24],[9,24],[10,24],[10,25],[9,25],[9,26],[10,26]],"direction":"right"},{"id":"a28","path":[[1,28],[2,28],[2,27],[1,27],[0,27],[0,26],[1,26],[2,26],[3,26],[4,26],[4,27],[5,27],[5,26],[6,26]],"direction":"right"},{"id":"a29","path":[[1,24],[1,25]],"direction":"down"},{"id":"a30","path":[[7,22],[6,22],[6,21],[5,21],[5,22],[4,22],[4,21],[3,21],[3,22],[3,23],[3,24],[3,25],[2,25],[2,24],[2,23],[2,22],[1,22],[1,23]],"direction":"down"},{"id":"a31","path":[[2,16],[1,16],[0,16],[0,17],[1,17],[1,18],[0,18],[0,19],[0,20],[0,21],[1,21],[1,20],[2,20],[2,21]],"direction":"down"},{"id":"a32","path":[[1,19],[2,19],[3,19],[3,18],[2,18]],"direction":"left"},{"id":"a33","path":[[1,14],[1,15]],"direction":"down"},{"id":"a34","path":[[4,15],[4,14],[4,13],[4,12],[4,11],[3,11],[3,10],[2,10],[1,10],[1,11],[0,11],[0,12],[1,12],[1,13]],"direction":"down"},{"id":"a35","path":[[5,5],[4,5],[3,5],[3,4],[4,4],[5,4],[6,4],[6,3],[5,3],[4,3],[4,2],[3,2],[3,3],[2,3],[2,4],[2,5],[2,6],[2,7],[2,8],[1,8],[1,9]],"direction":"down"},{"id":"a36","path":[[2,1],[2,0],[1,0],[0,0],[0,1],[0,2],[0,3],[1,3],[1,4],[0,4],[0,5],[1,5],[1,6],[1,7]],"direction":"down"},{"id":"a37","path":[[14,1],[13,1],[12,1],[12,2],[11,2],[10,2],[9,2],[8,2],[8,3],[7,3],[7,4],[8,4],[8,5],[7,5],[6,5]],"direction":"left"},{"id":"a38","path":[[10,6],[10,5],[10,4],[9,4]],"direction":"left"},{"id":"a39","path":[[14,3],[14,4],[13,4]],"direction":"left"},{"id":"a40","path":[[9,3],[10,3]],"direction":"right"},{"id":"a41","path":[[2,2],[1,2],[1,1]],"direction":"up"},{"id":"a42","path":[[4,1],[3,1],[3,0],[4,0],[5,0],[5,1],[6,1],[6,2],[5,2]],"direction":"left"},{"id":"a43","path":[[4,7],[4,6]],"direction":"up"},{"id":"a44","path":[[4,9],[4,8]],"direction":"up"},{"id":"a45","path":[[10,0],[10,1],[9,1],[9,0],[8,0],[7,0],[6,0]],"direction":"left"},{"id":"a46","path":[[10,7],[9,7],[9,6],[9,5]],"direction":"up"},{"id":"a47","path":[[8,8],[9,8],[9,9],[9,10],[8,10],[8,9],[7,9],[7,10],[7,11],[8,11],[8,12],[9,12],[9,11],[10,11],[10,10]],"direction":"up"},{"id":"a48","path":[[6,13],[6,14],[7,14],[7,13],[8,13],[8,14],[8,15],[9,15],[9,14],[9,13]],"direction":"up"},{"id":"a49","path":[[5,18],[6,18],[6,19],[7,19],[7,20],[8,20],[8,19],[9,19],[9,18],[8,18],[8,17],[9,17],[9,16]],"direction":"up"},{"id":"a50","path":[[11,17],[10,17],[10,16],[10,15]],"direction":"up"},{"id":"a51","path":[[11,9],[11,10]],"direction":"down"},{"id":"a52","path":[[7,6],[8,6],[8,7],[7,7],[6,7],[6,6]],"direction":"up"},{"id":"a53","path":[[2,9],[3,9],[3,8],[3,7],[3,6]],"direction":"up"},{"id":"a54","path":[[3,12],[3,13],[2,13],[2,12],[2,11]],"direction":"up"},{"id":"a55","path":[[3,14],[3,15],[2,15],[2,14]],"direction":"up"},{"id":"a56","path":[[7,12],[6,12],[5,12]],"direction":"left"},{"id":"a57","path":[[2,17],[3,17],[3,16]],"direction":"up"},{"id":"a58","path":[[4,16],[5,16],[5,17],[4,17]],"direction":"left"},{"id":"a59","path":[[6,9],[6,10],[6,11],[5,11]],"direction":"left"},{"id":"a60","path":[[7,16],[6,16]],"direction":"left"},{"id":"a61","path":[[7,18],[7,17],[6,17]],"direction":"left"},{"id":"a62","path":[[4,10],[5,10],[5,9],[5,8],[5,7],[5,6]],"direction":"up"},{"id":"a63","path":[[3,20],[4,20],[4,19],[4,18]],"direction":"up"},{"id":"a64","path":[[5,28],[4,28],[3,28],[3,27]],"direction":"up"},{"id":"a65","path":[[7,15],[6,15],[5,15],[5,14],[5,13]],"direction":"up"},{"id":"a66","path":[[6,20],[5,20],[5,19]],"direction":"up"},{"id":"a67","path":[[16,20],[16,21],[16,22],[17,22],[17,21],[17,20],[18,20],[18,19],[17,19],[16,19]],"direction":"left"},{"id":"a68","path":[[23,19],[22,19],[21,19],[21,20],[22,20],[23,20],[23,21],[22,21],[21,21],[20,21],[20,22],[19,22],[18,22],[18,21],[19,21],[19,20],[20,20],[20,19],[19,19]],"direction":"left"},{"id":"a69","path":[[26,17],[26,16],[27,16],[28,16],[28,17],[27,17],[27,18],[26,18],[26,19],[25,19]],"direction":"left"},{"id":"a70","path":[[28,18],[28,19],[27,19]],"direction":"left"},{"id":"a71","path":[[10,20],[9,20]],"direction":"left"},{"id":"a72","path":[[13,21],[14,21],[14,20],[13,20]],"direction":"left"},{"id":"a73","path":[[28,20],[27,20]],"direction":"left"},{"id":"a74","path":[[25,12],[26,12],[26,11],[27,11],[27,10],[28,10],[28,11],[28,12],[27,12],[27,13],[28,13],[28,14],[28,15]],"direction":"down"},{"id":"a75","path":[[26,14],[26,13],[25,13],[25,14],[25,15],[26,15],[27,15]],"direction":"right"},{"id":"a76","path":[[20,14],[19,14],[19,15],[20,15]],"direction":"right"},{"id":"a77","path":[[16,16],[16,15],[17,15]],"direction":"right"},{"id":"a78","path":[[25,11],[25,10],[26,10]],"direction":"right"},{"id":"a79","path":[[25,18],[25,17],[25,16]],"direction":"up"},{"id":"a80","path":[[19,18],[20,18],[21,18]],"direction":"right"},{"id":"a81","path":[[16,18],[17,18]],"direction":"right"},{"id":"a82","path":[[24,24],[25,24],[25,23],[25,22],[25,21]],"direction":"up"},{"id":"a83","path":[[26,27],[27,27],[27,28],[26,28],[25,28],[25,27]],"direction":"up"},{"id":"a84","path":[[21,27],[20,27],[20,28],[21,28],[22,28],[23,28],[24,28]],"direction":"right"},{"id":"a85","path":[[21,25],[21,24],[22,24],[22,25]],"direction":"down"},{"id":"a86","path":[[24,21],[24,22],[23,22],[22,22],[22,23]],"direction":"down"},{"id":"a87","path":[[20,9],[21,9],[21,10],[22,10],[22,9],[23,9],[23,10]],"direction":"down"},{"id":"a88","path":[[7,21],[8,21],[9,21]],"direction":"right"},{"id":"a89","path":[[27,24],[27,25]],"direction":"down"},{"id":"a90","path":[[27,23],[26,23],[26,24],[26,25]],"direction":"down"},{"id":"a91","path":[[7,24],[6,24],[6,25],[7,25]],"direction":"right"},{"id":"a92","path":[[21,11],[22,11]],"direction":"right"},{"id":"a93","path":[[22,6],[22,7],[22,8]],"direction":"down"},{"id":"a94","path":[[16,9],[17,9],[18,9],[18,8],[18,7],[18,6],[19,6]],"direction":"right"},{"id":"a95","path":[[15,5],[16,5],[17,5],[17,6],[17,7]],"direction":"down"},{"id":"a96","path":[[17,1],[16,1],[16,2]],"direction":"down"},{"id":"a97","path":[[11,5],[11,6],[12,6]],"direction":"right"},{"id":"a98","path":[[14,0],[13,0],[12,0],[11,0],[11,1]],"direction":"down"},{"id":"a99","path":[[13,10],[14,10],[14,9]],"direction":"up"},{"id":"a100","path":[[20,1],[21,1],[21,0],[20,0],[19,0],[19,1],[18,1],[18,0],[17,0],[16,0],[15,0],[15,1]],"direction":"down"},{"id":"a101","path":[[19,28],[19,27]],"direction":"up"},{"id":"a102","path":[[14,28],[13,28],[13,27],[14,27]],"direction":"right"},{"id":"a103","path":[[13,16],[13,17]],"direction":"down"},{"id":"a104","path":[[14,11],[13,11],[13,12]],"direction":"down"},{"id":"a105","path":[[14,17],[14,18]],"direction":"down"},{"id":"a106","path":[[6,27],[6,28],[7,28],[8,28],[9,28],[10,28]],"direction":"right"},{"id":"a107","path":[[18,24],[18,23]],"direction":"up"},{"id":"a108","path":[[20,8],[21,8],[21,7]],"direction":"up"},{"id":"a109","path":[[6,8],[7,8]],"direction":"right"},{"id":"a110","path":[[7,1],[7,2]],"direction":"down"},{"id":"a111","path":[[20,23],[21,23],[21,22]],"direction":"up"},{"id":"a112","path":[[22,0],[22,1]],"direction":"down"},{"id":"a113","path":[[27,1],[28,1],[28,0],[27,0],[26,0]],"direction":"left"},{"id":"a114","path":[[0,10],[0,9],[0,8],[0,7],[0,6]],"direction":"up"},{"id":"a115","path":[[28,9],[27,9],[26,9]],"direction":"left"},{"id":"a116","path":[[0,15],[0,14],[0,13]],"direction":"up"},{"id":"a117","path":[[0,25],[0,24],[0,23],[0,22]],"direction":"up"}],"timeLimitMs":92000,"obstacles":[[24,23],[8,1],[0,28],[26,1],[8,16],[20,10],[10,27],[17,2],[27,14]]}},{"id":13,"rewards":{},"board":{"number":13,"width":29,"height":29,"seed":710013,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[6,23],[5,23],[5,24],[4,24],[4,25],[3,25],[2,25],[1,25],[1,24],[2,24],[3,24],[3,23],[3,22],[3,21],[2,21],[2,22],[2,23],[1,23],[1,22],[1,21],[0,21]],"direction":"left"},{"id":"a1","path":[[7,24],[8,24],[8,23],[9,23],[9,22],[8,22],[7,22],[6,22],[5,22],[5,21],[4,21]],"direction":"left"},{"id":"a2","path":[[10,25],[10,24],[10,23],[10,22],[11,22],[11,23],[12,23],[13,23],[13,22],[12,22],[12,21],[11,21],[10,21],[9,21],[8,21],[7,21],[6,21]],"direction":"left"},{"id":"a3","path":[[16,18],[17,18],[18,18],[18,19],[19,19],[19,20],[18,20],[17,20],[17,21],[16,21],[16,22],[16,23],[15,23],[14,23],[14,22],[15,22],[15,21],[14,21],[13,21]],"direction":"left"},{"id":"a4","path":[[16,25],[17,25],[17,26],[16,26],[15,26],[15,25],[15,24],[16,24],[17,24],[17,23],[17,22],[18,22],[18,23],[19,23],[19,22],[19,21],[18,21]],"direction":"left"},{"id":"a5","path":[[19,14],[18,14],[18,15],[18,16],[18,17],[19,17],[19,18],[20,18],[21,18],[22,18],[23,18],[24,18],[24,19],[23,19],[23,20],[24,20],[24,21],[23,21],[22,21],[21,21],[20,21]],"direction":"left"},{"id":"a6","path":[[19,28],[20,28],[21,28],[22,28],[23,28],[24,28],[24,27],[24,26],[24,25],[24,24],[24,23],[25,23],[25,24],[25,25],[26,25],[27,25],[27,24],[27,23],[27,22],[26,22],[26,21],[25,21]],"direction":"left"},{"id":"a7","path":[[21,27],[20,27],[19,27],[18,27],[18,26],[19,26],[19,25],[20,25],[20,26],[21,26],[21,25],[22,25],[22,26],[22,27]],"direction":"down"},{"id":"a8","path":[[21,23],[21,24],[22,24],[22,23],[22,22],[21,22],[20,22],[20,23],[20,24]],"direction":"down"},{"id":"a9","path":[[22,20],[22,19],[21,19],[21,20]],"direction":"down"},{"id":"a10","path":[[20,17],[20,16],[21,16],[21,17]],"direction":"down"},{"id":"a11","path":[[19,8],[19,9],[19,10],[19,11],[19,12],[18,12],[17,12],[17,13],[18,13],[19,13],[20,13],[21,13],[22,13],[23,13],[23,14],[23,15],[22,15],[22,14],[21,14],[21,15]],"direction":"down"},{"id":"a12","path":[[19,6],[18,6],[18,7],[19,7],[20,7],[21,7],[21,8],[22,8],[22,9],[23,9],[23,10],[22,10],[22,11],[21,11],[21,12]],"direction":"down"},{"id":"a13","path":[[21,9],[21,10]],"direction":"down"},{"id":"a14","path":[[21,5],[21,6]],"direction":"down"},{"id":"a15","path":[[24,8],[23,8],[23,7],[23,6],[23,5],[24,5],[24,4],[23,4],[23,3],[24,3],[25,3],[26,3],[26,2],[25,2],[24,2],[23,2],[22,2],[22,3],[21,3],[21,4]],"direction":"down"},{"id":"a16","path":[[15,0],[14,0],[13,0],[12,0],[12,1],[13,1],[13,2],[13,3],[14,3],[15,3],[15,2],[15,1],[16,1],[16,0],[17,0],[18,0],[19,0],[20,0],[21,0],[21,1],[21,2]],"direction":"down"},{"id":"a17","path":[[17,3],[17,4],[18,4],[18,3],[19,3],[19,2],[20,2],[20,3],[20,4],[19,4],[19,5],[18,5],[17,5],[16,5],[15,5],[15,4],[16,4],[16,3],[16,2]],"direction":"up"},{"id":"a18","path":[[16,7],[16,6]],"direction":"up"},{"id":"a19","path":[[12,11],[12,10],[12,9],[13,9],[13,8],[14,8],[14,9],[14,10],[14,11],[15,11],[16,11],[16,10],[15,10],[15,9],[16,9],[16,8]],"direction":"up"},{"id":"a20","path":[[15,12],[14,12],[14,13],[15,13],[16,13],[16,12]],"direction":"up"},{"id":"a21","path":[[16,15],[16,14]],"direction":"up"},{"id":"a22","path":[[17,15],[17,16],[17,17],[16,17],[16,16]],"direction":"up"},{"id":"a23","path":[[15,8],[15,7],[15,6]],"direction":"up"},{"id":"a24","path":[[15,19],[14,19],[14,20],[13,20],[12,20],[12,19],[11,19],[11,18],[12,18],[12,17],[13,17],[14,17],[15,17],[15,16],[15,15],[15,14]],"direction":"up"},{"id":"a25","path":[[13,5],[13,4]],"direction":"up"},{"id":"a26","path":[[14,4],[14,5],[14,6],[14,7],[13,7],[13,6]],"direction":"up"},{"id":"a27","path":[[8,14],[9,14],[9,15],[8,15],[8,16],[9,16],[10,16],[10,15],[10,14],[11,14],[11,13],[10,13],[10,12],[11,12],[12,12],[13,12],[13,11],[13,10]],"direction":"up"},{"id":"a28","path":[[12,13],[12,14],[13,14],[13,13]],"direction":"up"},{"id":"a29","path":[[14,14],[14,15],[14,16],[13,16],[13,15]],"direction":"up"},{"id":"a30","path":[[13,19],[13,18]],"direction":"up"},{"id":"a31","path":[[13,25],[13,24]],"direction":"up"},{"id":"a32","path":[[11,27],[12,27],[12,26],[11,26],[10,26],[10,27],[9,27],[9,28],[10,28],[11,28],[12,28],[13,28],[13,27],[13,26]],"direction":"up"},{"id":"a33","path":[[12,25],[12,24],[11,24],[11,25]],"direction":"down"},{"id":"a34","path":[[8,20],[8,19],[9,19],[9,18],[8,18],[7,18],[7,17],[8,17],[9,17],[10,17],[11,17],[11,16],[11,15],[12,15],[12,16]],"direction":"down"},{"id":"a35","path":[[8,0],[9,0],[9,1],[9,2],[9,3],[9,4],[10,4],[10,3],[10,2],[11,2],[12,2],[12,3],[12,4],[12,5],[12,6],[12,7],[12,8]],"direction":"down"},{"id":"a36","path":[[7,1],[7,0],[6,0],[6,1],[6,2],[7,2],[8,2],[8,1]],"direction":"up"},{"id":"a37","path":[[8,11],[8,10],[7,10],[7,9],[8,9],[8,8],[9,8],[9,7],[9,6],[8,6],[8,5],[7,5],[7,4],[8,4],[8,3]],"direction":"up"},{"id":"a38","path":[[17,1],[17,2],[18,2],[18,1]],"direction":"up"},{"id":"a39","path":[[9,24],[9,25],[9,26]],"direction":"down"},{"id":"a40","path":[[17,11],[18,11],[18,10],[17,10],[17,9],[18,9],[18,8]],"direction":"up"},{"id":"a41","path":[[17,7],[17,6]],"direction":"up"},{"id":"a42","path":[[14,2],[14,1]],"direction":"up"},{"id":"a43","path":[[23,17],[24,17],[25,17],[25,16],[26,16],[26,15],[27,15],[27,14],[26,14],[25,14],[25,15],[24,15],[24,16],[23,16],[22,16],[22,17]],"direction":"down"},{"id":"a44","path":[[20,19],[20,20]],"direction":"down"},{"id":"a45","path":[[20,14],[20,15]],"direction":"down"},{"id":"a46","path":[[20,8],[20,9],[20,10],[20,11],[20,12]],"direction":"down"},{"id":"a47","path":[[20,5],[20,6]],"direction":"down"},{"id":"a48","path":[[25,22],[24,22],[23,22],[23,23],[23,24],[23,25],[23,26],[23,27]],"direction":"down"},{"id":"a49","path":[[28,7],[28,8],[28,9],[28,10],[27,10],[27,11],[28,11],[28,12],[28,13],[27,13],[26,13],[25,13],[24,13],[24,14]],"direction":"down"},{"id":"a50","path":[[5,9],[5,10],[5,11],[6,11],[6,12],[5,12],[5,13],[6,13],[6,14],[5,14],[5,15],[6,15],[7,15],[7,14],[7,13],[8,13],[9,13]],"direction":"right"},{"id":"a51","path":[[0,17],[0,16],[1,16],[1,15],[1,14],[1,13],[2,13],[2,14],[2,15],[3,15],[3,16],[3,17],[4,17],[4,16],[4,15],[4,14],[3,14],[3,13],[4,13]],"direction":"right"},{"id":"a52","path":[[2,16],[2,17],[1,17]],"direction":"left"},{"id":"a53","path":[[6,16],[5,16]],"direction":"left"},{"id":"a54","path":[[7,19],[7,20],[6,20],[5,20],[5,19],[6,19],[6,18],[6,17],[5,17]],"direction":"left"},{"id":"a55","path":[[28,17],[28,18],[27,18],[27,17],[26,17]],"direction":"left"},{"id":"a56","path":[[25,20],[26,20],[26,19],[25,19],[25,18],[26,18]],"direction":"right"},{"id":"a57","path":[[14,18],[15,18]],"direction":"right"},{"id":"a58","path":[[15,27],[16,27],[16,28],[15,28],[14,28],[14,27],[14,26],[14,25],[14,24]],"direction":"up"},{"id":"a59","path":[[27,8],[27,7],[26,7],[26,8],[26,9],[27,9]],"direction":"right"},{"id":"a60","path":[[25,4],[26,4],[27,4],[27,5],[26,5],[26,6],[25,6],[24,6],[24,7],[25,7]],"direction":"right"},{"id":"a61","path":[[23,11],[24,11],[25,11],[26,11],[26,12],[27,12]],"direction":"right"},{"id":"a62","path":[[7,11],[7,12],[8,12],[9,12],[9,11],[10,11],[11,11]],"direction":"right"},{"id":"a63","path":[[4,12],[3,12],[2,12],[2,11],[1,11],[1,10],[1,9],[2,9],[2,10],[3,10],[3,11],[4,11]],"direction":"right"},{"id":"a64","path":[[22,12],[23,12],[24,12],[25,12]],"direction":"right"},{"id":"a65","path":[[6,6],[5,6],[4,6],[4,7],[4,8],[3,8],[3,7],[2,7],[2,8],[1,8],[1,7],[0,7],[0,8],[0,9],[0,10],[0,11],[0,12],[1,12]],"direction":"right"},{"id":"a66","path":[[4,10],[4,9],[3,9]],"direction":"left"},{"id":"a67","path":[[7,8],[6,8],[5,8]],"direction":"left"},{"id":"a68","path":[[11,3],[11,4],[11,5],[11,6],[11,7],[11,8],[10,8]],"direction":"left"},{"id":"a69","path":[[6,7],[5,7]],"direction":"left"},{"id":"a70","path":[[22,1],[22,0],[23,0],[23,1]],"direction":"down"},{"id":"a71","path":[[22,7],[22,6],[22,5],[22,4]],"direction":"up"},{"id":"a72","path":[[24,9],[24,10]],"direction":"down"},{"id":"a73","path":[[28,0],[28,1],[27,1],[27,0],[26,0],[26,1],[25,1],[25,0],[24,0],[24,1]],"direction":"down"},{"id":"a74","path":[[11,1],[10,1],[10,0],[11,0]],"direction":"right"},{"id":"a75","path":[[9,10],[9,9],[10,9],[10,10],[11,10],[11,9]],"direction":"up"},{"id":"a76","path":[[1,2],[2,2],[2,3],[3,3],[3,2],[4,2],[4,1],[3,1],[2,1],[2,0],[3,0],[4,0],[5,0]],"direction":"right"},{"id":"a77","path":[[6,5],[6,4],[5,4],[4,4],[3,4],[3,5],[3,6],[2,6],[1,6],[0,6],[0,5],[1,5],[2,5],[2,4]],"direction":"up"},{"id":"a78","path":[[2,19],[2,18],[1,18],[1,19],[1,20],[2,20],[3,20],[4,20],[4,19],[3,19],[3,18]],"direction":"up"},{"id":"a79","path":[[6,26],[5,26],[5,27],[5,28],[4,28],[3,28],[3,27],[2,27],[2,26]],"direction":"up"},{"id":"a80","path":[[3,26],[4,26],[4,27]],"direction":"down"},{"id":"a81","path":[[4,22],[4,23]],"direction":"down"},{"id":"a82","path":[[5,5],[4,5]],"direction":"left"},{"id":"a83","path":[[10,7],[10,6],[10,5],[9,5]],"direction":"left"},{"id":"a84","path":[[10,19],[10,18]],"direction":"up"},{"id":"a85","path":[[4,18],[5,18]],"direction":"right"},{"id":"a86","path":[[7,6],[7,7],[8,7]],"direction":"right"},{"id":"a87","path":[[28,2],[27,2],[27,3],[28,3],[28,4],[28,5],[28,6],[27,6]],"direction":"left"},{"id":"a88","path":[[27,16],[28,16],[28,15],[28,14]],"direction":"up"},{"id":"a89","path":[[27,20],[27,19]],"direction":"up"},{"id":"a90","path":[[28,21],[28,20],[28,19]],"direction":"up"},{"id":"a91","path":[[15,20],[16,20]],"direction":"right"},{"id":"a92","path":[[9,20],[10,20],[11,20]],"direction":"right"},{"id":"a93","path":[[26,28],[25,28],[25,27],[25,26],[26,26],[27,26],[27,27],[27,28],[28,28],[28,27],[28,26],[28,25],[28,24],[28,23],[28,22]],"direction":"up"},{"id":"a94","path":[[7,26],[8,26]],"direction":"right"},{"id":"a95","path":[[1,27],[0,27],[0,26],[1,26]],"direction":"right"},{"id":"a96","path":[[6,28],[7,28],[7,27],[6,27]],"direction":"left"},{"id":"a97","path":[[17,28],[18,28]],"direction":"right"},{"id":"a98","path":[[19,24],[18,24],[18,25]],"direction":"down"},{"id":"a99","path":[[7,25],[8,25]],"direction":"right"},{"id":"a100","path":[[8,28],[8,27]],"direction":"up"},{"id":"a101","path":[[0,28],[1,28],[2,28]],"direction":"right"},{"id":"a102","path":[[0,22],[0,23],[0,24],[0,25]],"direction":"down"},{"id":"a103","path":[[6,24],[6,25],[5,25]],"direction":"left"},{"id":"a104","path":[[6,9],[6,10]],"direction":"down"},{"id":"a105","path":[[26,10],[25,10]],"direction":"left"},{"id":"a106","path":[[25,8],[25,9]],"direction":"down"},{"id":"a107","path":[[26,24],[26,23]],"direction":"up"},{"id":"a108","path":[[0,18],[0,19],[0,20]],"direction":"down"},{"id":"a109","path":[[0,13],[0,14],[0,15]],"direction":"down"},{"id":"a110","path":[[1,4],[1,3],[0,3],[0,4]],"direction":"down"},{"id":"a111","path":[[6,3],[5,3],[4,3]],"direction":"left"},{"id":"a112","path":[[5,1],[5,2]],"direction":"down"},{"id":"a113","path":[[0,1],[0,0],[1,0],[1,1]],"direction":"down"},{"id":"a114","path":[[20,1],[19,1]],"direction":"left"},{"id":"a115","path":[[19,16],[19,15]],"direction":"up"},{"id":"a116","path":[[17,19],[16,19]],"direction":"left"}],"timeLimitMs":90000,"obstacles":[[7,23],[25,5],[0,2],[26,27],[17,14],[17,27],[7,3],[7,16],[27,21],[17,8]]}},{"id":14,"rewards":{},"board":{"number":14,"width":29,"height":29,"seed":710014,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[2,2],[2,1],[1,1],[1,2],[0,2],[0,3],[1,3],[2,3],[3,3],[3,2],[3,1],[3,0]],"direction":"up"},{"id":"a1","path":[[12,4],[11,4],[10,4],[9,4],[9,3],[8,3],[8,2],[7,2],[7,3],[7,4],[6,4],[6,3],[6,2],[5,2],[4,2]],"direction":"left"},{"id":"a2","path":[[5,0],[4,0],[4,1],[5,1],[6,1],[6,0],[7,0],[8,0],[9,0],[10,0],[10,1],[10,2],[9,2]],"direction":"left"},{"id":"a3","path":[[0,6],[0,7],[0,8],[1,8],[1,7],[1,6],[2,6],[2,5],[3,5],[3,6],[4,6],[5,6],[6,6],[6,5]],"direction":"up"},{"id":"a4","path":[[5,14],[5,13],[5,12],[5,11],[4,11],[4,12],[3,12],[3,11],[3,10],[2,10],[1,10],[1,9],[2,9],[3,9],[4,9],[5,9],[5,8],[5,7],[4,7],[3,7],[2,7]],"direction":"left"},{"id":"a5","path":[[9,6],[9,7],[9,8],[8,8],[8,7],[7,7],[6,7]],"direction":"left"},{"id":"a6","path":[[6,9],[6,8]],"direction":"up"},{"id":"a7","path":[[7,10],[8,10],[8,11],[8,12],[8,13],[7,13],[6,13],[6,12],[6,11],[6,10]],"direction":"up"},{"id":"a8","path":[[0,11],[0,12],[1,12],[2,12],[2,13],[3,13],[4,13],[4,14],[4,15],[5,15],[5,16],[6,16],[6,15],[6,14]],"direction":"up"},{"id":"a9","path":[[0,22],[0,21],[1,21],[2,21],[3,21],[4,21],[4,20],[5,20],[6,20],[7,20],[7,19],[7,18],[6,18],[6,17]],"direction":"up"},{"id":"a10","path":[[13,25],[12,25],[11,25],[11,24],[10,24],[10,23],[11,23],[11,22],[10,22],[9,22],[8,22],[8,23],[7,23],[7,24],[6,24],[6,23],[6,22],[6,21],[5,21]],"direction":"left"},{"id":"a11","path":[[7,28],[7,27],[7,26],[6,26],[6,27],[6,28],[5,28],[5,27],[5,26],[5,25],[5,24],[5,23],[5,22],[4,22],[4,23],[4,24],[3,24],[3,23],[3,22],[2,22],[1,22]],"direction":"left"},{"id":"a12","path":[[2,11],[1,11]],"direction":"left"},{"id":"a13","path":[[11,9],[12,9],[12,8],[11,8],[11,7],[10,7]],"direction":"left"},{"id":"a14","path":[[19,3],[19,4],[18,4],[17,4],[17,3],[16,3],[16,4],[15,4],[14,4],[13,4],[13,5],[13,6],[14,6],[14,7],[13,7],[12,7]],"direction":"left"},{"id":"a15","path":[[14,5],[15,5],[15,6],[16,6],[16,7],[15,7]],"direction":"left"},{"id":"a16","path":[[18,5],[18,6],[18,7],[17,7]],"direction":"left"},{"id":"a17","path":[[27,5],[27,6],[28,6],[28,7],[28,8],[27,8],[26,8],[25,8],[25,7],[24,7],[24,8],[23,8],[22,8],[22,7],[22,6],[21,6],[20,6],[20,7],[19,7]],"direction":"left"},{"id":"a18","path":[[23,7],[23,6],[24,6],[24,5],[24,4],[25,4],[25,5],[25,6],[26,6],[26,7],[27,7]],"direction":"right"},{"id":"a19","path":[[4,8],[3,8],[2,8]],"direction":"left"},{"id":"a20","path":[[4,3],[4,4],[4,5],[5,5],[5,4],[5,3]],"direction":"up"},{"id":"a21","path":[[11,0],[12,0],[13,0],[14,0],[14,1],[14,2],[15,2],[15,3],[14,3],[13,3],[12,3],[12,2],[13,2],[13,1],[12,1],[11,1],[11,2],[11,3],[10,3]],"direction":"left"},{"id":"a22","path":[[13,9],[13,10],[14,10],[14,9],[14,8]],"direction":"up"},{"id":"a23","path":[[24,10],[24,11],[24,12],[23,12],[23,11],[22,11],[22,10],[21,10],[20,10],[20,11],[19,11],[19,10],[18,10],[18,11],[17,11],[17,12],[17,13],[16,13],[15,13],[14,13],[14,12],[14,11]],"direction":"up"},{"id":"a24","path":[[19,13],[19,12],[18,12],[18,13],[18,14],[17,14],[16,14],[15,14],[15,15],[15,16],[15,17],[14,17],[14,16],[13,16],[13,15],[14,15],[14,14]],"direction":"up"},{"id":"a25","path":[[16,19],[16,20],[16,21],[17,21],[17,22],[16,22],[15,22],[15,21],[15,20],[15,19],[14,19],[14,18]],"direction":"up"},{"id":"a26","path":[[9,20],[8,20],[8,19],[9,19],[9,18],[10,18],[11,18],[11,19],[12,19],[13,19],[13,20],[12,20],[12,21],[13,21],[14,21],[14,20]],"direction":"up"},{"id":"a27","path":[[21,24],[20,24],[20,25],[20,26],[20,27],[21,27],[21,28],[20,28],[19,28],[19,27],[19,26],[18,26],[18,25],[19,25],[19,24],[18,24],[17,24],[16,24],[15,24],[15,23],[14,23],[14,22]],"direction":"up"},{"id":"a28","path":[[16,23],[17,23],[18,23],[18,22],[18,21],[18,20],[18,19],[19,19],[19,20],[19,21],[19,22],[19,23]],"direction":"down"},{"id":"a29","path":[[22,20],[22,19],[21,19],[20,19],[20,18],[21,18],[21,17],[22,17],[22,16],[21,16],[20,16],[20,17],[19,17],[19,18]],"direction":"down"},{"id":"a30","path":[[20,12],[20,13],[20,14],[19,14],[19,15],[19,16]],"direction":"down"},{"id":"a31","path":[[22,9],[21,9],[20,9],[20,8],[19,8],[19,9]],"direction":"down"},{"id":"a32","path":[[21,3],[21,4],[22,4],[23,4],[23,5],[22,5],[21,5],[20,5],[19,5],[19,6]],"direction":"down"},{"id":"a33","path":[[16,2],[17,2],[17,1],[16,1],[16,0],[17,0],[18,0],[19,0],[19,1],[19,2]],"direction":"down"},{"id":"a34","path":[[18,3],[18,2],[18,1]],"direction":"up"},{"id":"a35","path":[[16,9],[16,10],[17,10],[17,9],[18,9],[18,8]],"direction":"up"},{"id":"a36","path":[[15,18],[16,18],[17,18],[18,18],[18,17],[17,17],[16,17],[16,16],[16,15],[17,15],[17,16],[18,16],[18,15]],"direction":"up"},{"id":"a37","path":[[17,25],[16,25],[15,25],[15,26],[16,26],[17,26],[17,27],[17,28],[18,28],[18,27]],"direction":"up"},{"id":"a38","path":[[17,19],[17,20]],"direction":"down"},{"id":"a39","path":[[22,2],[22,3],[23,3],[23,2],[23,1],[23,0],[22,0],[21,0],[21,1],[21,2],[20,2]],"direction":"left"},{"id":"a40","path":[[28,3],[28,2],[28,1],[28,0],[27,0],[27,1],[26,1],[26,2],[25,2],[24,2]],"direction":"left"},{"id":"a41","path":[[24,0],[24,1],[25,1],[25,0],[26,0]],"direction":"right"},{"id":"a42","path":[[28,5],[28,4],[27,4],[26,4],[26,3]],"direction":"up"},{"id":"a43","path":[[27,9],[26,9],[25,9],[25,10],[25,11],[26,11],[26,10],[27,10],[28,10],[28,9]],"direction":"up"},{"id":"a44","path":[[27,13],[27,14],[28,14],[28,13],[28,12],[28,11]],"direction":"up"},{"id":"a45","path":[[21,13],[21,14],[22,14],[22,15],[23,15],[24,15],[24,14],[24,13],[25,13],[25,14],[25,15],[26,15],[27,15],[27,16],[27,17],[27,18],[28,18],[28,17],[28,16],[28,15]],"direction":"up"},{"id":"a46","path":[[21,20],[21,21],[22,21],[23,21],[23,22],[23,23],[24,23],[24,22],[25,22],[26,22],[26,21],[26,20],[25,20],[25,19],[25,18],[25,17],[26,17]],"direction":"right"},{"id":"a47","path":[[26,16],[25,16],[24,16],[23,16],[23,17],[24,17]],"direction":"right"},{"id":"a48","path":[[9,15],[9,14],[8,14],[8,15],[8,16],[9,16],[10,16],[10,15],[11,15],[11,16],[12,16]],"direction":"right"},{"id":"a49","path":[[8,17],[9,17],[10,17],[11,17],[12,17],[13,17]],"direction":"right"},{"id":"a50","path":[[20,15],[21,15]],"direction":"right"},{"id":"a51","path":[[27,24],[27,23],[27,22],[28,22],[28,21],[27,21],[27,20],[28,20],[28,19]],"direction":"up"},{"id":"a52","path":[[20,20],[20,21],[20,22],[20,23],[21,23],[21,22],[22,22]],"direction":"right"},{"id":"a53","path":[[13,24],[12,24],[12,23],[12,22],[13,22]],"direction":"right"},{"id":"a54","path":[[20,3],[20,4]],"direction":"down"},{"id":"a55","path":[[20,0],[20,1]],"direction":"down"},{"id":"a56","path":[[25,3],[24,3]],"direction":"left"},{"id":"a57","path":[[26,18],[26,19],[27,19]],"direction":"right"},{"id":"a58","path":[[25,21],[24,21],[24,20],[23,20],[23,19],[24,19]],"direction":"right"},{"id":"a59","path":[[10,21],[11,21]],"direction":"right"},{"id":"a60","path":[[7,22],[7,21],[8,21],[9,21]],"direction":"right"},{"id":"a61","path":[[10,19],[10,20],[11,20]],"direction":"right"},{"id":"a62","path":[[5,17],[4,17],[4,18],[5,18],[5,19],[6,19]],"direction":"right"},{"id":"a63","path":[[2,17],[2,18],[2,19],[3,19],[4,19]],"direction":"right"},{"id":"a64","path":[[2,20],[1,20],[0,20],[0,19],[1,19]],"direction":"right"},{"id":"a65","path":[[22,18],[23,18],[24,18]],"direction":"right"},{"id":"a66","path":[[12,18],[13,18]],"direction":"right"},{"id":"a67","path":[[25,23],[26,23],[26,24],[26,25],[27,25],[27,26],[27,27],[27,28],[28,28],[28,27],[28,26],[28,25],[28,24],[28,23]],"direction":"up"},{"id":"a68","path":[[23,25],[24,25],[25,25]],"direction":"right"},{"id":"a69","path":[[24,26],[24,27],[25,27],[26,27],[26,28],[25,28],[24,28],[23,28],[22,28],[22,27],[23,27],[23,26],[22,26],[21,26],[21,25],[22,25]],"direction":"right"},{"id":"a70","path":[[21,11],[21,12]],"direction":"down"},{"id":"a71","path":[[21,7],[21,8]],"direction":"down"},{"id":"a72","path":[[16,11],[16,12],[15,12],[15,11],[15,10],[15,9],[15,8],[16,8],[17,8]],"direction":"right"},{"id":"a73","path":[[16,5],[17,5],[17,6]],"direction":"down"},{"id":"a74","path":[[8,25],[8,26],[8,27],[8,28],[9,28],[9,27],[9,26],[10,26],[10,27],[10,28],[11,28],[12,28],[12,27],[13,27],[14,27],[15,27],[15,28],[16,28],[16,27]],"direction":"up"},{"id":"a75","path":[[13,28],[14,28]],"direction":"right"},{"id":"a76","path":[[14,24],[14,25],[14,26]],"direction":"down"},{"id":"a77","path":[[9,25],[10,25]],"direction":"right"},{"id":"a78","path":[[11,11],[10,11],[9,11],[9,12],[9,13],[10,13],[10,14]],"direction":"down"},{"id":"a79","path":[[6,25],[7,25]],"direction":"right"},{"id":"a80","path":[[4,26],[4,27],[3,27],[3,26],[3,25],[4,25]],"direction":"right"},{"id":"a81","path":[[2,24],[2,23],[1,23],[1,24],[1,25],[2,25]],"direction":"right"},{"id":"a82","path":[[7,14],[7,15],[7,16],[7,17]],"direction":"down"},{"id":"a83","path":[[3,15],[3,14],[2,14],[1,14],[1,13],[0,13],[0,14],[0,15],[0,16],[1,16],[1,15],[2,15],[2,16],[3,16],[4,16]],"direction":"right"},{"id":"a84","path":[[12,13],[11,13]],"direction":"left"},{"id":"a85","path":[[12,15],[12,14],[11,14]],"direction":"left"},{"id":"a86","path":[[7,11],[7,12]],"direction":"down"},{"id":"a87","path":[[13,13],[13,12],[13,11],[12,11]],"direction":"left"},{"id":"a88","path":[[12,12],[11,12],[10,12]],"direction":"left"},{"id":"a89","path":[[7,8],[7,9]],"direction":"down"},{"id":"a90","path":[[8,4],[8,5],[7,5],[7,6]],"direction":"down"},{"id":"a91","path":[[1,5],[0,5],[0,4],[1,4],[2,4],[3,4]],"direction":"right"},{"id":"a92","path":[[3,18],[3,17]],"direction":"up"},{"id":"a93","path":[[1,18],[0,18],[0,17],[1,17]],"direction":"right"},{"id":"a94","path":[[12,6],[12,5],[11,5],[11,6],[10,6],[10,5],[9,5]],"direction":"left"},{"id":"a95","path":[[10,9],[10,8]],"direction":"up"},{"id":"a96","path":[[0,23],[0,24],[0,25],[0,26],[0,27],[1,27],[2,27],[2,28],[3,28],[4,28]],"direction":"right"},{"id":"a97","path":[[9,23],[9,24],[8,24]],"direction":"left"},{"id":"a98","path":[[8,9],[9,9],[9,10]],"direction":"down"},{"id":"a99","path":[[2,26],[1,26]],"direction":"left"},{"id":"a100","path":[[0,28],[1,28]],"direction":"right"},{"id":"a101","path":[[0,9],[0,10]],"direction":"down"},{"id":"a102","path":[[5,10],[4,10]],"direction":"left"},{"id":"a103","path":[[12,10],[11,10],[10,10]],"direction":"left"},{"id":"a104","path":[[11,27],[11,26]],"direction":"up"},{"id":"a105","path":[[13,26],[12,26]],"direction":"left"},{"id":"a106","path":[[26,26],[25,26]],"direction":"left"},{"id":"a107","path":[[25,12],[26,12],[26,13],[26,14]],"direction":"down"},{"id":"a108","path":[[1,0],[0,0],[0,1]],"direction":"down"},{"id":"a109","path":[[9,1],[8,1],[7,1]],"direction":"left"},{"id":"a110","path":[[15,0],[15,1]],"direction":"down"},{"id":"a111","path":[[22,23],[22,24]],"direction":"down"},{"id":"a112","path":[[24,24],[23,24]],"direction":"left"},{"id":"a113","path":[[22,13],[23,13],[23,14]],"direction":"down"},{"id":"a114","path":[[24,9],[23,9],[23,10]],"direction":"down"},{"id":"a115","path":[[27,11],[27,12]],"direction":"down"},{"id":"a116","path":[[27,2],[27,3]],"direction":"down"}],"timeLimitMs":88000,"obstacles":[[8,6],[25,24],[26,5],[3,20],[13,23],[13,14],[2,0],[22,12],[22,1],[13,8],[8,18]]}},{"id":15,"rewards":{"time":3},"board":{"number":15,"width":30,"height":30,"seed":710015,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[7,22],[8,22],[8,23],[9,23],[9,22],[10,22],[10,23],[10,24],[9,24],[9,25],[9,26],[8,26],[7,26],[6,26],[5,26],[5,27],[6,27],[7,27],[7,28],[6,28],[5,28],[5,29]],"direction":"down"},{"id":"a1","path":[[1,28],[0,28],[0,27],[0,26],[0,25],[1,25],[2,25],[3,25],[3,26],[3,27],[4,27],[4,26],[4,25],[4,24],[4,23],[5,23],[5,24],[5,25]],"direction":"down"},{"id":"a2","path":[[4,28],[4,29],[3,29],[3,28],[2,28]],"direction":"left"},{"id":"a3","path":[[9,27],[9,28],[8,28]],"direction":"left"},{"id":"a4","path":[[6,29],[7,29],[8,29],[9,29],[10,29],[11,29],[11,28],[10,28]],"direction":"left"},{"id":"a5","path":[[7,19],[6,19],[5,19],[5,20],[5,21],[6,21],[6,22],[6,23],[7,23],[7,24],[7,25]],"direction":"down"},{"id":"a6","path":[[7,20],[7,21]],"direction":"down"},{"id":"a7","path":[[6,14],[7,14],[7,13],[6,13],[6,12],[5,12],[5,13],[5,14],[5,15],[5,16],[4,16],[4,17],[5,17],[5,18],[6,18],[6,17],[7,17],[7,18]],"direction":"down"},{"id":"a8","path":[[6,16],[6,15],[7,15],[7,16]],"direction":"down"},{"id":"a9","path":[[4,9],[5,9],[6,9],[7,9],[7,8],[6,8],[5,8],[5,7],[6,7],[7,7],[8,7],[8,8],[8,9],[8,10],[7,10],[6,10],[6,11],[7,11],[7,12]],"direction":"down"},{"id":"a10","path":[[6,3],[6,4],[7,4],[8,4],[8,3],[7,3],[7,2],[6,2],[5,2],[5,3],[5,4],[5,5],[6,5],[7,5],[7,6]],"direction":"down"},{"id":"a11","path":[[15,0],[14,0],[14,1],[13,1],[13,0],[12,0],[12,1],[12,2],[11,2],[11,1],[10,1],[9,1],[8,1],[8,0],[7,0],[7,1]],"direction":"down"},{"id":"a12","path":[[15,8],[16,8],[16,7],[17,7],[18,7],[18,6],[17,6],[17,5],[16,5],[15,5],[14,5],[14,4],[15,4],[15,3],[15,2],[14,2],[14,3],[13,3],[13,2]],"direction":"up"},{"id":"a13","path":[[12,6],[12,5],[12,4],[12,3],[11,3],[10,3],[10,4],[11,4],[11,5],[10,5],[10,6],[11,6],[11,7],[12,7],[13,7],[13,8],[14,8],[14,7],[14,6]],"direction":"up"},{"id":"a14","path":[[12,10],[13,10],[14,10],[14,9]],"direction":"up"},{"id":"a15","path":[[14,16],[14,15],[14,14],[15,14],[16,14],[16,13],[16,12],[16,11],[16,10],[15,10],[15,11],[15,12],[14,12],[14,11]],"direction":"up"},{"id":"a16","path":[[13,6],[13,5],[13,4]],"direction":"up"},{"id":"a17","path":[[13,9],[12,9],[12,8]],"direction":"up"},{"id":"a18","path":[[13,11],[13,12],[12,12],[12,11]],"direction":"up"},{"id":"a19","path":[[11,22],[11,21],[12,21],[12,20],[11,20],[11,19],[12,19],[12,18],[11,18],[10,18],[10,17],[11,17],[11,16],[10,16],[10,15],[10,14],[11,14],[11,15],[12,15],[12,14],[12,13]],"direction":"up"},{"id":"a20","path":[[15,15],[16,15],[16,16],[17,16],[17,17],[16,17],[16,18],[16,19],[16,20],[15,20],[15,21],[14,21],[14,20],[13,20],[13,19],[13,18],[14,18],[14,17],[13,17],[12,17],[12,16]],"direction":"up"},{"id":"a21","path":[[13,21],[13,22],[13,23],[12,23],[12,22]],"direction":"up"},{"id":"a22","path":[[13,26],[13,25],[14,25],[14,26],[14,27],[13,27],[12,27],[12,26],[12,25],[12,24]],"direction":"up"},{"id":"a23","path":[[20,25],[21,25],[21,26],[20,26],[19,26],[19,25],[18,25],[18,26],[17,26],[17,25],[16,25],[15,25],[15,26],[15,27],[15,28],[15,29],[14,29],[13,29],[12,29],[12,28]],"direction":"up"},{"id":"a24","path":[[13,24],[14,24],[14,23],[15,23],[15,24]],"direction":"down"},{"id":"a25","path":[[14,28],[13,28]],"direction":"left"},{"id":"a26","path":[[26,26],[25,26],[25,27],[25,28],[24,28],[23,28],[22,28],[22,27],[21,27],[21,28],[20,28],[20,27],[19,27],[18,27],[17,27],[17,28],[16,28]],"direction":"left"},{"id":"a27","path":[[27,29],[28,29],[29,29],[29,28],[29,27],[28,27],[28,28],[27,28],[27,27],[26,27],[26,28],[26,29],[25,29],[24,29],[23,29],[22,29],[21,29],[20,29],[19,29],[19,28],[18,28]],"direction":"left"},{"id":"a28","path":[[28,25],[28,26]],"direction":"down"},{"id":"a29","path":[[27,25],[26,25],[26,24],[27,24],[27,23],[28,23],[28,24]],"direction":"down"},{"id":"a30","path":[[24,20],[23,20],[23,19],[23,18],[24,18],[24,19],[25,19],[25,20],[25,21],[26,21],[26,20],[27,20],[28,20],[28,21],[28,22]],"direction":"down"},{"id":"a31","path":[[24,17],[23,17],[22,17],[21,17],[21,16],[22,16],[23,16],[23,15],[23,14],[24,14],[24,15],[25,15],[25,16],[26,16],[26,17],[25,17],[25,18],[26,18],[27,18],[28,18],[28,19]],"direction":"down"},{"id":"a32","path":[[28,16],[28,17]],"direction":"down"},{"id":"a33","path":[[27,17],[27,16],[27,15],[27,14],[28,14],[28,15]],"direction":"down"},{"id":"a34","path":[[29,26],[29,25],[29,24],[29,23],[29,22],[29,21],[29,20],[29,19],[29,18],[29,17],[29,16],[29,15],[29,14],[29,13],[29,12],[28,12],[28,13]],"direction":"down"},{"id":"a35","path":[[22,9],[22,10],[23,10],[23,11],[22,11],[21,11],[21,12],[22,12],[23,12],[24,12],[24,11],[24,10],[25,10],[25,11],[25,12],[26,12],[26,13],[27,13]],"direction":"right"},{"id":"a36","path":[[20,12],[20,13],[19,13],[19,14],[20,14],[20,15],[21,15],[22,15],[22,14],[21,14],[21,13],[22,13],[23,13],[24,13],[25,13]],"direction":"right"},{"id":"a37","path":[[18,14],[18,15],[17,15],[17,14],[17,13],[18,13]],"direction":"right"},{"id":"a38","path":[[13,16],[13,15],[13,14],[13,13],[14,13],[15,13]],"direction":"right"},{"id":"a39","path":[[10,7],[9,7],[9,8],[9,9],[10,9],[10,8],[11,8],[11,9],[11,10],[11,11],[11,12],[10,12],[10,13],[11,13]],"direction":"right"},{"id":"a40","path":[[8,11],[9,11],[9,12],[8,12],[8,13],[9,13]],"direction":"right"},{"id":"a41","path":[[3,16],[3,17],[2,17],[2,16],[2,15],[3,15],[4,15],[4,14],[3,14],[2,14],[2,13],[3,13],[4,13]],"direction":"right"},{"id":"a42","path":[[1,11],[1,12],[2,12],[3,12],[3,11],[2,11],[2,10],[1,10],[0,10],[0,11],[0,12],[0,13],[1,13]],"direction":"right"},{"id":"a43","path":[[4,10],[3,10]],"direction":"left"},{"id":"a44","path":[[20,16],[20,17],[19,17],[19,18],[20,18],[21,18],[22,18]],"direction":"right"},{"id":"a45","path":[[16,23],[17,23],[18,23],[18,22],[18,21],[19,21],[19,22],[20,22],[21,22],[21,21],[20,21],[20,20],[20,19],[19,19],[18,19],[17,19],[17,18],[18,18]],"direction":"right"},{"id":"a46","path":[[22,26],[22,25],[22,24],[23,24],[23,23],[22,23],[22,22],[23,22],[24,22],[24,23],[24,24],[24,25],[25,25]],"direction":"right"},{"id":"a47","path":[[25,22],[25,23],[25,24]],"direction":"down"},{"id":"a48","path":[[21,23],[20,23],[20,24],[21,24]],"direction":"right"},{"id":"a49","path":[[24,21],[23,21],[22,21],[22,20],[22,19],[21,19],[21,20]],"direction":"down"},{"id":"a50","path":[[17,22],[17,21],[17,20],[18,20],[19,20]],"direction":"right"},{"id":"a51","path":[[10,21],[9,21],[9,20],[10,20]],"direction":"right"},{"id":"a52","path":[[23,9],[24,9],[24,8],[23,8],[23,7],[22,7],[22,8]],"direction":"down"},{"id":"a53","path":[[19,6],[19,7],[19,8],[19,9],[19,10],[20,10],[21,10],[21,9],[20,9],[20,8],[21,8],[21,7],[21,6],[21,5],[22,5],[22,6]],"direction":"down"},{"id":"a54","path":[[20,7],[20,6],[20,5],[20,4],[21,4],[21,3],[20,3],[20,2],[21,2],[22,2],[22,3],[22,4]],"direction":"down"},{"id":"a55","path":[[27,3],[27,2],[28,2],[28,1],[27,1],[26,1],[25,1],[24,1],[24,2],[23,2],[23,1],[23,0],[22,0],[22,1]],"direction":"down"},{"id":"a56","path":[[25,7],[25,6],[24,6],[24,5],[25,5],[25,4],[24,4],[23,4],[23,3]],"direction":"up"},{"id":"a57","path":[[23,6],[23,5]],"direction":"up"},{"id":"a58","path":[[24,26],[24,27],[23,27],[23,26],[23,25]],"direction":"up"},{"id":"a59","path":[[11,26],[11,27],[10,27],[10,26],[10,25],[11,25]],"direction":"right"},{"id":"a60","path":[[11,23],[11,24]],"direction":"down"},{"id":"a61","path":[[17,1],[17,0],[18,0],[19,0],[20,0],[21,0],[21,1]],"direction":"down"},{"id":"a62","path":[[16,0],[16,1],[16,2],[17,2],[18,2],[18,1]],"direction":"up"},{"id":"a63","path":[[17,3],[18,3],[19,3],[19,4],[19,5],[18,5],[18,4],[17,4],[16,4],[16,3]],"direction":"up"},{"id":"a64","path":[[18,8],[18,9],[18,10],[18,11],[18,12],[17,12],[17,11],[17,10],[17,9],[17,8]],"direction":"up"},{"id":"a65","path":[[18,17],[18,16]],"direction":"up"},{"id":"a66","path":[[26,19],[27,19]],"direction":"right"},{"id":"a67","path":[[14,19],[15,19]],"direction":"right"},{"id":"a68","path":[[8,21],[8,20],[8,19],[8,18],[9,18],[9,19],[10,19]],"direction":"right"},{"id":"a69","path":[[10,10],[10,11]],"direction":"down"},{"id":"a70","path":[[4,18],[3,18],[3,19],[4,19]],"direction":"right"},{"id":"a71","path":[[3,20],[4,20],[4,21],[3,21],[3,22],[3,23],[3,24],[2,24],[2,23],[2,22],[2,21],[2,20],[1,20],[1,21],[0,21],[0,20],[0,19],[1,19],[2,19]],"direction":"right"},{"id":"a72","path":[[1,8],[0,8],[0,7],[1,7],[2,7],[2,8],[3,8],[3,9]],"direction":"down"},{"id":"a73","path":[[4,8],[4,7],[4,6],[3,6],[3,7]],"direction":"down"},{"id":"a74","path":[[28,11],[29,11],[29,10],[29,9],[28,9],[28,8],[29,8],[29,7],[28,7],[27,7],[26,7],[26,8],[25,8]],"direction":"left"},{"id":"a75","path":[[27,10],[28,10]],"direction":"right"},{"id":"a76","path":[[24,3],[25,3],[26,3],[26,4],[26,5],[27,5],[28,5],[28,6]],"direction":"down"},{"id":"a77","path":[[27,4],[28,4],[28,3],[29,3],[29,4],[29,5],[29,6]],"direction":"down"},{"id":"a78","path":[[26,6],[27,6]],"direction":"right"},{"id":"a79","path":[[15,7],[15,6],[16,6]],"direction":"right"},{"id":"a80","path":[[9,3],[9,4],[9,5],[8,5],[8,6],[9,6]],"direction":"right"},{"id":"a81","path":[[0,4],[0,5],[0,6],[1,6],[2,6],[2,5],[2,4],[3,4],[4,4]],"direction":"right"},{"id":"a82","path":[[6,6],[5,6]],"direction":"left"},{"id":"a83","path":[[4,0],[4,1],[4,2],[3,2],[3,1],[3,0],[2,0],[2,1],[2,2],[1,2],[0,2],[0,3],[1,3],[2,3],[3,3],[4,3]],"direction":"right"},{"id":"a84","path":[[10,2],[9,2],[8,2]],"direction":"left"},{"id":"a85","path":[[9,14],[9,15],[8,15],[8,14]],"direction":"up"},{"id":"a86","path":[[9,16],[9,17],[8,17],[8,16]],"direction":"up"},{"id":"a87","path":[[8,25],[8,24]],"direction":"up"},{"id":"a88","path":[[3,5],[4,5]],"direction":"right"},{"id":"a89","path":[[4,12],[4,11]],"direction":"up"},{"id":"a90","path":[[24,0],[25,0],[26,0],[27,0],[28,0],[29,0],[29,1],[29,2]],"direction":"down"},{"id":"a91","path":[[27,9],[27,8]],"direction":"up"},{"id":"a92","path":[[27,12],[27,11]],"direction":"up"},{"id":"a93","path":[[26,23],[26,22],[27,22],[27,21]],"direction":"up"},{"id":"a94","path":[[25,14],[26,14],[26,15]],"direction":"down"},{"id":"a95","path":[[1,17],[1,16],[1,15],[0,15],[0,14],[1,14]],"direction":"right"},{"id":"a96","path":[[25,9],[26,9],[26,10],[26,11]],"direction":"down"},{"id":"a97","path":[[19,12],[19,11],[20,11]],"direction":"right"},{"id":"a98","path":[[15,9],[16,9]],"direction":"right"},{"id":"a99","path":[[1,9],[2,9]],"direction":"right"},{"id":"a100","path":[[14,22],[15,22],[16,22],[16,21]],"direction":"up"},{"id":"a101","path":[[15,17],[15,18]],"direction":"down"},{"id":"a102","path":[[0,17],[0,18],[1,18],[2,18]],"direction":"right"},{"id":"a103","path":[[1,26],[1,27],[2,27],[2,26]],"direction":"up"},{"id":"a104","path":[[4,22],[5,22]],"direction":"right"},{"id":"a105","path":[[1,23],[1,24],[0,24],[0,23],[0,22],[1,22]],"direction":"right"},{"id":"a106","path":[[5,10],[5,11]],"direction":"down"},{"id":"a107","path":[[9,0],[10,0],[11,0]],"direction":"right"},{"id":"a108","path":[[19,2],[19,1],[20,1]],"direction":"right"},{"id":"a109","path":[[19,16],[19,15]],"direction":"up"},{"id":"a110","path":[[16,24],[17,24],[18,24],[19,24],[19,23]],"direction":"up"},{"id":"a111","path":[[16,27],[16,26]],"direction":"up"},{"id":"a112","path":[[26,2],[25,2]],"direction":"left"},{"id":"a113","path":[[16,29],[17,29],[18,29]],"direction":"right"},{"id":"a114","path":[[1,29],[2,29]],"direction":"right"},{"id":"a115","path":[[1,4],[1,5]],"direction":"down"},{"id":"a116","path":[[0,1],[0,0],[1,0],[1,1]],"direction":"down"},{"id":"a117","path":[[6,0],[6,1],[5,1]],"direction":"left"},{"id":"a118","path":[[6,24],[6,25]],"direction":"down"}],"timeLimitMs":85000,"obstacles":[[8,27],[5,0],[24,7],[27,26],[0,16],[15,16],[15,1],[24,16],[9,10],[0,29],[6,20],[0,9]]}},{"id":16,"rewards":{},"board":{"number":16,"width":30,"height":30,"seed":710016,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[4,4],[4,5],[4,6],[3,6],[2,6],[2,5],[2,4],[2,3],[1,3],[1,4],[0,4],[0,3],[0,2],[0,1],[0,0]],"direction":"up"},{"id":"a1","path":[[1,2],[1,1],[2,1],[2,2],[3,2],[4,2],[5,2],[5,3],[4,3],[3,3]],"direction":"left"},{"id":"a2","path":[[12,6],[11,6],[11,5],[11,4],[11,3],[11,2],[10,2],[10,1],[10,0],[9,0],[8,0],[8,1],[8,2],[7,2],[6,2]],"direction":"left"},{"id":"a3","path":[[9,1],[9,2],[9,3],[9,4],[8,4],[8,5],[9,5],[10,5],[10,4],[10,3]],"direction":"up"},{"id":"a4","path":[[17,1],[17,0],[16,0],[16,1],[15,1],[14,1],[14,2],[14,3],[14,4],[14,5],[14,6],[13,6],[13,5],[13,4],[12,4],[12,3],[13,3],[13,2],[12,2]],"direction":"left"},{"id":"a5","path":[[23,2],[22,2],[22,3],[21,3],[20,3],[20,2],[21,2],[21,1],[21,0],[20,0],[20,1],[19,1],[19,0],[18,0],[18,1],[18,2],[17,2],[16,2],[15,2]],"direction":"left"},{"id":"a6","path":[[23,4],[23,5],[22,5],[22,4],[21,4],[20,4],[20,5],[20,6],[20,7],[19,7],[18,7],[17,7],[17,6],[16,6],[16,5],[16,4],[16,3]],"direction":"up"},{"id":"a7","path":[[27,9],[27,8],[27,7],[26,7],[26,6],[27,6],[27,5],[26,5],[26,4],[25,4],[24,4],[24,5],[25,5],[25,6],[24,6],[23,6],[22,6],[21,6],[21,5]],"direction":"up"},{"id":"a8","path":[[21,9],[22,9],[22,10],[21,10],[20,10],[20,9],[20,8],[21,8],[21,7]],"direction":"up"},{"id":"a9","path":[[12,18],[13,18],[14,18],[15,18],[16,18],[16,17],[16,16],[17,16],[17,17],[18,17],[18,16],[18,15],[19,15],[20,15],[20,14],[20,13],[20,12],[20,11]],"direction":"up"},{"id":"a10","path":[[21,20],[21,21],[22,21],[23,21],[24,21],[24,20],[24,19],[23,19],[23,18],[23,17],[23,16],[23,15],[23,14],[22,14],[21,14],[21,15],[22,15],[22,16],[21,16],[21,17],[20,17],[20,16]],"direction":"up"},{"id":"a11","path":[[15,21],[16,21],[17,21],[17,20],[17,19],[17,18],[18,18],[19,18],[19,19],[18,19],[18,20],[19,20],[20,20],[20,19],[20,18]],"direction":"up"},{"id":"a12","path":[[22,25],[21,25],[20,25],[19,25],[18,25],[17,25],[17,24],[18,24],[18,23],[19,23],[20,23],[21,23],[21,22],[20,22],[20,21]],"direction":"up"},{"id":"a13","path":[[27,13],[28,13],[28,12],[27,12],[26,12],[26,11],[25,11],[25,12],[24,12],[24,13],[23,13],[23,12],[22,12],[22,13],[21,13],[21,12],[21,11]],"direction":"up"},{"id":"a14","path":[[23,20],[22,20],[22,19],[21,19],[21,18]],"direction":"up"},{"id":"a15","path":[[13,11],[14,11],[14,10],[15,10],[15,11],[16,11],[16,10],[17,10],[18,10],[18,11],[18,12],[19,12],[19,11],[19,10],[19,9],[18,9],[17,9],[17,8],[16,8],[16,7]],"direction":"up"},{"id":"a16","path":[[19,2],[19,3],[18,3],[18,4],[19,4],[19,5],[19,6],[18,6],[18,5],[17,5],[17,4],[17,3]],"direction":"up"},{"id":"a17","path":[[19,13],[19,14],[18,14],[17,14],[17,13],[17,12],[17,11]],"direction":"up"},{"id":"a18","path":[[26,2],[27,2],[27,1],[28,1],[28,0],[27,0],[26,0],[25,0],[25,1],[25,2],[24,2]],"direction":"left"},{"id":"a19","path":[[23,3],[24,3],[25,3],[26,3],[27,3],[27,4],[28,4],[28,3],[28,2]],"direction":"up"},{"id":"a20","path":[[29,0],[29,1],[29,2],[29,3],[29,4],[29,5],[29,6],[29,7],[29,8],[28,8],[28,7],[28,6],[28,5]],"direction":"up"},{"id":"a21","path":[[29,10],[29,9]],"direction":"up"},{"id":"a22","path":[[26,20],[26,19],[26,18],[26,17],[26,16],[26,15],[26,14],[27,14],[27,15],[28,15],[28,14],[29,14],[29,13],[29,12],[29,11]],"direction":"up"},{"id":"a23","path":[[28,9],[28,10],[27,10],[27,11],[28,11]],"direction":"right"},{"id":"a24","path":[[29,15],[29,16],[29,17],[28,17],[28,16]],"direction":"up"},{"id":"a25","path":[[28,22],[27,22],[27,23],[28,23],[29,23],[29,22],[29,21],[29,20],[28,20],[27,20],[27,19],[28,19],[29,19],[29,18]],"direction":"up"},{"id":"a26","path":[[27,24],[27,25],[28,25],[29,25],[29,26],[29,27],[28,27],[28,26],[27,26],[26,26],[25,26],[25,25],[25,24],[25,23],[25,22],[26,22]],"direction":"right"},{"id":"a27","path":[[22,22],[22,23],[23,23],[23,22],[24,22],[24,23],[24,24],[24,25],[23,25],[23,26],[24,26]],"direction":"right"},{"id":"a28","path":[[14,26],[14,27],[15,27],[16,27],[16,26],[17,26],[17,27],[18,27],[18,26],[19,26],[20,26],[20,27],[21,27],[21,26],[22,26]],"direction":"right"},{"id":"a29","path":[[12,20],[11,20],[11,21],[12,21],[13,21],[13,20],[13,19],[14,19],[14,20],[14,21],[14,22],[15,22],[16,22],[16,23],[17,23],[17,22],[18,22],[19,22]],"direction":"right"},{"id":"a30","path":[[4,21],[4,22],[4,23],[4,24],[5,24],[5,23],[5,22],[6,22],[6,21],[6,20],[7,20],[8,20],[9,20],[9,21],[10,21],[10,22],[11,22],[12,22],[13,22]],"direction":"right"},{"id":"a31","path":[[8,21],[7,21],[7,22],[8,22],[9,22]],"direction":"right"},{"id":"a32","path":[[2,27],[1,27],[1,26],[0,26],[0,25],[0,24],[1,24],[1,23],[0,23],[0,22],[1,22],[2,22],[3,22]],"direction":"right"},{"id":"a33","path":[[2,29],[3,29],[4,29],[5,29],[5,28],[5,27],[6,27],[7,27],[7,26],[7,25],[6,25],[6,26],[5,26],[5,25],[4,25],[3,25],[2,25],[1,25]],"direction":"left"},{"id":"a34","path":[[16,25],[16,24],[15,24],[14,24],[14,25],[13,25],[13,24],[12,24],[11,24],[10,24],[10,25],[9,25],[8,25]],"direction":"left"},{"id":"a35","path":[[12,29],[11,29],[10,29],[10,28],[10,27],[9,27],[8,27],[8,26],[9,26],[10,26],[11,26],[11,27],[12,27],[13,27],[13,26],[12,26],[12,25],[11,25]],"direction":"left"},{"id":"a36","path":[[3,27],[3,28]],"direction":"down"},{"id":"a37","path":[[3,26],[4,26],[4,27],[4,28]],"direction":"down"},{"id":"a38","path":[[2,24],[2,23],[3,23],[3,24]],"direction":"down"},{"id":"a39","path":[[6,24],[7,24],[7,23],[6,23]],"direction":"left"},{"id":"a40","path":[[8,24],[9,24],[9,23],[8,23]],"direction":"left"},{"id":"a41","path":[[15,23],[14,23],[13,23],[12,23],[11,23],[10,23]],"direction":"left"},{"id":"a42","path":[[14,16],[13,16],[12,16],[12,17],[11,17],[11,18],[11,19],[10,19],[10,20]],"direction":"down"},{"id":"a43","path":[[10,16],[11,16],[11,15],[10,15],[9,15],[9,16],[9,17],[10,17],[10,18]],"direction":"down"},{"id":"a44","path":[[11,14],[12,14],[12,13],[11,13],[10,13],[10,14]],"direction":"down"},{"id":"a45","path":[[7,11],[7,10],[6,10],[6,9],[7,9],[7,8],[6,8],[5,8],[5,7],[6,7],[7,7],[8,7],[8,8],[8,9],[8,10],[8,11],[9,11],[10,11],[10,12]],"direction":"down"},{"id":"a46","path":[[13,10],[12,10],[12,11],[11,11],[11,10],[11,9],[12,9],[13,9],[13,8],[12,8],[11,8],[11,7],[10,7],[10,8],[10,9],[10,10]],"direction":"down"},{"id":"a47","path":[[23,24],[22,24],[21,24],[20,24],[19,24]],"direction":"left"},{"id":"a48","path":[[19,27],[19,28],[19,29],[20,29],[20,28]],"direction":"up"},{"id":"a49","path":[[25,28],[26,28],[26,29],[25,29],[24,29],[23,29],[23,28],[24,28],[24,27],[23,27],[22,27],[22,28],[22,29],[21,29],[21,28]],"direction":"up"},{"id":"a50","path":[[25,15],[24,15],[24,16],[25,16],[25,17],[24,17],[24,18]],"direction":"down"},{"id":"a51","path":[[13,14],[13,13],[14,13],[14,12],[15,12],[15,13],[15,14],[16,14],[16,15],[17,15]],"direction":"right"},{"id":"a52","path":[[14,14],[14,15],[15,15]],"direction":"right"},{"id":"a53","path":[[12,15],[13,15]],"direction":"right"},{"id":"a54","path":[[9,18],[9,19],[8,19],[7,19],[7,18],[8,18],[8,17],[7,17],[6,17],[5,17],[5,16],[5,15],[6,15],[7,15],[8,15]],"direction":"right"},{"id":"a55","path":[[0,16],[0,15],[0,14],[0,13],[1,13],[1,14],[2,14],[2,15],[3,15],[4,15]],"direction":"right"},{"id":"a56","path":[[4,11],[4,12],[4,13],[5,13],[5,12],[6,12],[6,13],[6,14],[5,14],[4,14],[3,14],[3,13],[2,13]],"direction":"left"},{"id":"a57","path":[[9,13],[9,14],[8,14],[7,14]],"direction":"left"},{"id":"a58","path":[[25,13],[25,14],[24,14]],"direction":"left"},{"id":"a59","path":[[22,8],[22,7],[23,7],[23,8],[24,8],[25,8],[26,8],[26,9],[25,9],[24,9],[24,10],[24,11]],"direction":"down"},{"id":"a60","path":[[22,11],[23,11]],"direction":"right"},{"id":"a61","path":[[23,9],[23,10]],"direction":"down"},{"id":"a62","path":[[14,7],[14,8],[14,9],[15,9],[16,9]],"direction":"right"},{"id":"a63","path":[[16,13],[16,12]],"direction":"up"},{"id":"a64","path":[[11,12],[12,12],[13,12]],"direction":"right"},{"id":"a65","path":[[7,13],[7,12],[8,12],[9,12]],"direction":"right"},{"id":"a66","path":[[0,5],[1,5],[1,6],[0,6],[0,7],[0,8],[0,9],[1,9],[1,8],[2,8],[3,8],[3,9],[2,9],[2,10],[3,10],[3,11],[2,11],[2,12],[3,12]],"direction":"right"},{"id":"a67","path":[[4,10],[5,10],[5,9],[4,9]],"direction":"left"},{"id":"a68","path":[[4,8],[4,7],[3,7],[2,7],[1,7]],"direction":"left"},{"id":"a69","path":[[6,3],[6,4],[5,4],[5,5],[6,5],[7,5],[7,6],[6,6],[5,6]],"direction":"left"},{"id":"a70","path":[[1,10],[1,11],[1,12],[0,12],[0,11],[0,10]],"direction":"up"},{"id":"a71","path":[[1,16],[1,17],[2,17],[2,18],[1,18],[0,18],[0,17]],"direction":"up"},{"id":"a72","path":[[3,17],[4,17],[4,18],[3,18]],"direction":"left"},{"id":"a73","path":[[5,21],[5,20],[4,20],[3,20],[3,19],[4,19],[5,19],[6,19],[6,18],[5,18]],"direction":"left"},{"id":"a74","path":[[15,16],[15,17],[14,17],[13,17]],"direction":"left"},{"id":"a75","path":[[4,16],[3,16],[2,16]],"direction":"left"},{"id":"a76","path":[[4,0],[4,1]],"direction":"down"},{"id":"a77","path":[[8,16],[7,16],[6,16]],"direction":"left"},{"id":"a78","path":[[1,20],[0,20],[0,19]],"direction":"up"},{"id":"a79","path":[[3,21],[2,21],[2,20],[2,19],[1,19]],"direction":"left"},{"id":"a80","path":[[3,4],[3,5]],"direction":"down"},{"id":"a81","path":[[2,0],[3,0],[3,1]],"direction":"down"},{"id":"a82","path":[[5,0],[6,0],[7,0],[7,1],[6,1],[5,1]],"direction":"left"},{"id":"a83","path":[[15,0],[14,0],[13,0],[13,1],[12,1],[11,1]],"direction":"left"},{"id":"a84","path":[[15,8],[15,7],[15,6],[15,5],[15,4],[15,3]],"direction":"up"},{"id":"a85","path":[[16,19],[16,20],[15,20],[15,19]],"direction":"up"},{"id":"a86","path":[[12,28],[13,28],[13,29],[14,29],[14,28],[15,28],[15,29],[16,29],[16,28]],"direction":"up"},{"id":"a87","path":[[15,25],[15,26]],"direction":"down"},{"id":"a88","path":[[7,4],[7,3],[8,3]],"direction":"right"},{"id":"a89","path":[[8,28],[9,28],[9,29],[8,29],[7,29],[7,28]],"direction":"up"},{"id":"a90","path":[[9,7],[9,8],[9,9],[9,10]],"direction":"down"},{"id":"a91","path":[[13,7],[12,7]],"direction":"left"},{"id":"a92","path":[[25,7],[24,7]],"direction":"left"},{"id":"a93","path":[[22,0],[22,1],[23,1],[23,0],[24,0],[24,1]],"direction":"down"},{"id":"a94","path":[[11,0],[12,0]],"direction":"right"},{"id":"a95","path":[[22,18],[22,17]],"direction":"up"},{"id":"a96","path":[[26,10],[25,10]],"direction":"left"},{"id":"a97","path":[[25,19],[25,18]],"direction":"up"},{"id":"a98","path":[[19,8],[18,8]],"direction":"left"},{"id":"a99","path":[[19,17],[19,16]],"direction":"up"},{"id":"a100","path":[[8,6],[9,6],[10,6]],"direction":"right"},{"id":"a101","path":[[6,11],[5,11]],"direction":"left"},{"id":"a102","path":[[6,29],[6,28]],"direction":"up"},{"id":"a103","path":[[18,29],[17,29],[17,28]],"direction":"up"},{"id":"a104","path":[[26,27],[27,27]],"direction":"right"},{"id":"a105","path":[[26,23],[26,24],[26,25]],"direction":"down"},{"id":"a106","path":[[29,24],[28,24]],"direction":"left"},{"id":"a107","path":[[27,29],[27,28],[28,28],[28,29],[29,29],[29,28]],"direction":"up"},{"id":"a108","path":[[0,29],[1,29]],"direction":"right"},{"id":"a109","path":[[0,27],[0,28]],"direction":"down"},{"id":"a110","path":[[2,28],[1,28]],"direction":"left"},{"id":"a111","path":[[27,16],[27,17],[27,18],[28,18]],"direction":"right"},{"id":"a112","path":[[25,21],[26,21],[27,21],[28,21]],"direction":"right"},{"id":"a113","path":[[18,21],[19,21]],"direction":"right"},{"id":"a114","path":[[0,21],[1,21]],"direction":"right"}],"timeLimitMs":83000,"obstacles":[[12,5],[25,27],[2,26],[26,1],[12,19],[1,0],[26,13],[1,15],[11,28],[18,13],[8,13],[25,20],[18,28]]}},{"id":17,"rewards":{},"board":{"number":17,"width":31,"height":31,"seed":710017,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[29,8],[29,7],[30,7],[30,6],[30,5],[30,4],[30,3],[30,2],[29,2],[29,1],[30,1],[30,0],[29,0],[28,0],[28,1],[27,1],[27,0]],"direction":"up"},{"id":"a1","path":[[23,10],[24,10],[24,9],[25,9],[25,8],[24,8],[23,8],[23,7],[24,7],[25,7],[25,6],[25,5],[24,5],[23,5],[22,5],[22,4],[22,3],[23,3],[24,3],[25,3],[25,2],[25,1],[26,1]],"direction":"right"},{"id":"a2","path":[[26,0],[25,0],[24,0],[23,0],[22,0],[21,0],[21,1],[22,1],[23,1],[24,1]],"direction":"right"},{"id":"a3","path":[[26,8],[26,7],[27,7],[27,6],[28,6],[29,6],[29,5],[29,4],[28,4],[28,5],[27,5],[27,4],[27,3],[26,3],[26,2]],"direction":"up"},{"id":"a4","path":[[23,4],[24,4],[25,4],[26,4]],"direction":"right"},{"id":"a5","path":[[14,3],[15,3],[16,3],[17,3],[17,2],[16,2],[15,2],[15,1],[15,0],[16,0],[17,0],[18,0],[19,0],[20,0],[20,1],[20,2],[21,2],[21,3],[20,3],[20,4],[21,4]],"direction":"right"},{"id":"a6","path":[[19,1],[19,2],[19,3],[18,3],[18,2],[18,1]],"direction":"up"},{"id":"a7","path":[[22,9],[22,8],[22,7],[22,6],[21,6],[21,5],[20,5],[19,5],[19,4]],"direction":"up"},{"id":"a8","path":[[21,7],[21,8],[20,8],[20,7],[20,6],[19,6],[19,7],[18,7],[18,6],[18,5],[17,5],[16,5],[15,5],[15,4],[16,4],[17,4],[18,4]],"direction":"right"},{"id":"a9","path":[[26,11],[25,11],[25,12],[24,12],[23,12],[22,12],[21,12],[20,12],[20,11],[20,10],[20,9]],"direction":"up"},{"id":"a10","path":[[19,16],[19,17],[19,18],[20,18],[21,18],[21,17],[21,16],[22,16],[22,15],[21,15],[21,14],[20,14],[20,13]],"direction":"up"},{"id":"a11","path":[[20,17],[20,16],[20,15]],"direction":"up"},{"id":"a12","path":[[13,27],[14,27],[14,28],[15,28],[16,28],[16,27],[17,27],[18,27],[18,26],[19,26],[19,25],[19,24],[20,24],[20,23],[20,22],[19,22],[18,22],[17,22],[17,21],[18,21],[19,21],[20,21],[20,20],[20,19]],"direction":"up"},{"id":"a13","path":[[25,30],[26,30],[27,30],[27,29],[26,29],[25,29],[25,28],[24,28],[23,28],[23,27],[22,27],[22,26],[21,26],[20,26],[20,25]],"direction":"up"},{"id":"a14","path":[[24,22],[24,21],[25,21],[26,21],[27,21],[28,21],[28,22],[28,23],[29,23],[29,24],[28,24],[27,24],[27,25],[27,26],[27,27],[26,27],[26,28]],"direction":"down"},{"id":"a15","path":[[21,19],[22,19],[22,20],[21,20],[21,21],[21,22],[21,23],[21,24],[22,24],[22,23],[22,22],[22,21],[23,21],[23,22],[23,23],[23,24],[24,24],[24,25],[25,25],[26,25],[26,26]],"direction":"down"},{"id":"a16","path":[[25,24],[25,23],[25,22],[26,22],[26,23],[26,24]],"direction":"down"},{"id":"a17","path":[[30,17],[30,18],[30,19],[29,19],[29,20],[28,20],[27,20],[27,19],[28,19],[28,18],[27,18],[26,18],[25,18],[25,19],[26,19],[26,20]],"direction":"down"},{"id":"a18","path":[[25,20],[24,20],[23,20],[23,19],[24,19]],"direction":"right"},{"id":"a19","path":[[19,20],[18,20],[17,20],[17,19],[17,18],[18,18],[18,19],[19,19]],"direction":"right"},{"id":"a20","path":[[18,16],[18,15],[18,14],[17,14],[17,15],[17,16],[16,16],[16,17],[15,17],[15,16],[15,15],[14,15],[14,16],[14,17],[14,18],[14,19],[15,19],[16,19]],"direction":"right"},{"id":"a21","path":[[13,15],[12,15],[12,14],[11,14],[10,14],[10,15],[11,15],[11,16],[11,17],[12,17],[12,16],[13,16],[13,17],[13,18],[12,18],[12,19],[13,19]],"direction":"right"},{"id":"a22","path":[[10,19],[11,19]],"direction":"right"},{"id":"a23","path":[[13,22],[13,23],[13,24],[12,24],[12,23],[11,23],[11,22],[11,21],[11,20],[10,20],[9,20],[9,21],[8,21],[8,22],[7,22],[7,21],[6,21],[6,20],[7,20],[8,20],[8,19],[9,19]],"direction":"right"},{"id":"a24","path":[[5,16],[6,16],[6,15],[5,15],[4,15],[4,16],[4,17],[5,17],[5,18],[4,18],[4,19],[5,19],[6,19],[7,19]],"direction":"right"},{"id":"a25","path":[[0,19],[0,20],[0,21],[0,22],[0,23],[0,24],[1,24],[2,24],[2,23],[1,23],[1,22],[1,21],[2,21],[3,21],[3,20],[2,20],[2,19],[3,19]],"direction":"right"},{"id":"a26","path":[[0,27],[0,28],[1,28],[2,28],[2,27],[2,26],[2,25],[3,25],[3,24],[3,23],[4,23],[5,23],[5,24],[4,24],[4,25],[5,25],[6,25],[6,24],[6,23],[6,22],[5,22],[4,22],[3,22],[2,22]],"direction":"left"},{"id":"a27","path":[[0,30],[0,29],[1,29],[1,30],[2,30],[3,30],[4,30],[4,29],[4,28],[3,28]],"direction":"left"},{"id":"a28","path":[[9,29],[8,29],[7,29],[7,30],[6,30],[5,30],[5,29],[6,29],[6,28],[5,28]],"direction":"left"},{"id":"a29","path":[[16,29],[16,30],[15,30],[14,30],[13,30],[12,30],[12,29],[12,28],[12,27],[11,27],[10,27],[10,28],[9,28],[9,27],[8,27],[8,28],[7,28]],"direction":"left"},{"id":"a30","path":[[15,27],[15,26],[14,26],[13,26],[13,25],[12,25],[12,26]],"direction":"down"},{"id":"a31","path":[[13,21],[12,21],[12,22]],"direction":"down"},{"id":"a32","path":[[16,24],[16,25],[16,26]],"direction":"down"},{"id":"a33","path":[[16,20],[15,20],[14,20],[14,21],[14,22],[14,23],[14,24],[14,25],[15,25],[15,24],[15,23],[15,22],[15,21],[16,21],[16,22],[16,23]],"direction":"down"},{"id":"a34","path":[[13,28],[13,29]],"direction":"down"},{"id":"a35","path":[[10,23],[9,23],[8,23],[7,23],[7,24],[7,25],[7,26],[7,27]],"direction":"down"},{"id":"a36","path":[[19,23],[18,23],[17,23]],"direction":"left"},{"id":"a37","path":[[8,25],[8,26],[9,26],[10,26],[11,26],[11,25],[11,24],[10,24],[10,25],[9,25],[9,24],[8,24]],"direction":"left"},{"id":"a38","path":[[14,8],[14,9],[14,10],[14,11],[13,11],[12,11],[12,10],[11,10],[10,10],[10,11],[10,12],[9,12],[8,12],[8,13],[8,14],[8,15],[8,16],[8,17],[7,17],[7,18]],"direction":"down"},{"id":"a39","path":[[5,10],[4,10],[4,11],[3,11],[3,10],[2,10],[2,11],[2,12],[3,12],[4,12],[4,13],[5,13],[5,12],[5,11],[6,11],[6,12],[6,13],[7,13],[7,14],[7,15],[7,16]],"direction":"down"},{"id":"a40","path":[[8,7],[7,7],[7,8],[8,8],[9,8],[9,9],[9,10],[9,11],[8,11],[8,10],[8,9],[7,9],[7,10],[7,11],[7,12]],"direction":"down"},{"id":"a41","path":[[1,2],[0,2],[0,3],[0,4],[1,4],[1,5],[1,6],[2,6],[2,7],[2,8],[3,8],[3,9],[4,9],[4,8],[4,7],[4,6],[5,6],[6,6],[6,5],[7,5],[7,6]],"direction":"down"},{"id":"a42","path":[[6,4],[5,4],[5,3],[6,3],[6,2],[6,1],[5,1],[5,0],[6,0],[7,0],[7,1],[7,2],[8,2],[8,3],[7,3],[7,4]],"direction":"down"},{"id":"a43","path":[[6,8],[6,7]],"direction":"up"},{"id":"a44","path":[[6,10],[6,9]],"direction":"up"},{"id":"a45","path":[[5,2],[4,2],[4,1],[4,0],[3,0],[3,1],[2,1],[2,2],[3,2],[3,3],[3,4],[2,4],[2,3],[1,3]],"direction":"left"},{"id":"a46","path":[[4,4],[4,3]],"direction":"up"},{"id":"a47","path":[[13,8],[12,8],[12,7],[12,6],[12,5],[11,5],[10,5],[9,5],[9,4],[8,4]],"direction":"left"},{"id":"a48","path":[[19,11],[19,10],[19,9],[19,8],[18,8],[17,8],[17,7],[17,6],[16,6],[16,7],[15,7],[15,6],[14,6],[14,5],[14,4],[13,4],[12,4],[11,4],[10,4]],"direction":"left"},{"id":"a49","path":[[19,15],[19,14],[19,13],[19,12],[18,12],[17,12],[17,11],[18,11],[18,10],[18,9]],"direction":"up"},{"id":"a50","path":[[19,30],[18,30],[17,30],[17,29],[17,28],[18,28],[19,28],[19,27]],"direction":"up"},{"id":"a51","path":[[18,24],[18,25],[17,25],[17,26]],"direction":"down"},{"id":"a52","path":[[15,9],[15,8]],"direction":"up"},{"id":"a53","path":[[18,13],[17,13],[16,13],[16,12],[15,12],[15,11],[15,10]],"direction":"up"},{"id":"a54","path":[[14,13],[14,12],[13,12],[13,13],[13,14],[14,14],[15,14],[15,13]],"direction":"up"},{"id":"a55","path":[[12,3],[13,3],[13,2],[12,2],[11,2],[11,3],[10,3],[9,3]],"direction":"left"},{"id":"a56","path":[[29,3],[28,3]],"direction":"left"},{"id":"a57","path":[[28,9],[27,9],[27,10],[27,11],[28,11],[28,10],[29,10],[29,9]],"direction":"up"},{"id":"a58","path":[[27,13],[26,13],[26,14],[26,15],[27,15],[28,15],[29,15],[29,14],[29,13],[30,13],[30,12],[29,12],[29,11]],"direction":"up"},{"id":"a59","path":[[26,12],[27,12],[28,12]],"direction":"right"},{"id":"a60","path":[[11,11],[11,12],[12,12]],"direction":"right"},{"id":"a61","path":[[1,10],[1,11],[0,11],[0,12],[1,12]],"direction":"right"},{"id":"a62","path":[[13,1],[12,1],[11,1],[11,0],[10,0],[9,0],[8,0],[8,1],[9,1],[10,1],[10,2],[9,2]],"direction":"left"},{"id":"a63","path":[[9,7],[10,7],[10,8],[10,9],[11,9],[11,8],[11,7],[11,6]],"direction":"up"},{"id":"a64","path":[[10,6],[9,6],[8,6],[8,5]],"direction":"up"},{"id":"a65","path":[[8,18],[9,18],[9,17],[10,17],[10,16],[9,16],[9,15],[9,14],[9,13]],"direction":"up"},{"id":"a66","path":[[4,26],[5,26],[6,26],[6,27]],"direction":"down"},{"id":"a67","path":[[6,17],[6,18]],"direction":"down"},{"id":"a68","path":[[29,18],[29,17],[29,16]],"direction":"up"},{"id":"a69","path":[[22,18],[22,17],[23,17],[23,18],[24,18]],"direction":"right"},{"id":"a70","path":[[15,18],[16,18]],"direction":"right"},{"id":"a71","path":[[16,14],[16,15]],"direction":"down"},{"id":"a72","path":[[16,9],[17,9],[17,10],[16,10],[16,11]],"direction":"down"},{"id":"a73","path":[[21,9],[21,10],[22,10],[22,11],[21,11]],"direction":"left"},{"id":"a74","path":[[24,11],[23,11]],"direction":"left"},{"id":"a75","path":[[10,18],[11,18]],"direction":"right"},{"id":"a76","path":[[0,14],[0,13],[1,13],[2,13],[2,14],[1,14],[1,15],[0,15],[0,16],[1,16],[1,17],[1,18],[2,18],[3,18]],"direction":"right"},{"id":"a77","path":[[2,17],[2,16],[3,16],[3,15],[2,15]],"direction":"left"},{"id":"a78","path":[[24,14],[25,14],[25,15],[24,15],[23,15]],"direction":"left"},{"id":"a79","path":[[24,17],[25,17],[26,17],[27,17],[28,17],[28,16],[27,16],[26,16],[25,16],[24,16],[23,16]],"direction":"left"},{"id":"a80","path":[[17,17],[18,17]],"direction":"right"},{"id":"a81","path":[[27,28],[28,28],[28,29],[29,29],[29,28],[29,27],[29,26],[29,25],[30,25],[30,24],[30,23],[30,22],[29,22],[29,21]],"direction":"up"},{"id":"a82","path":[[27,22],[27,23]],"direction":"down"},{"id":"a83","path":[[11,30],[10,30],[9,30],[8,30]],"direction":"left"},{"id":"a84","path":[[18,29],[19,29],[20,29],[21,29],[21,28],[22,28],[22,29],[23,29],[24,29],[24,30],[23,30],[22,30],[21,30],[20,30]],"direction":"left"},{"id":"a85","path":[[30,26],[30,27],[30,28],[30,29],[30,30],[29,30],[28,30]],"direction":"left"},{"id":"a86","path":[[14,29],[15,29]],"direction":"right"},{"id":"a87","path":[[28,25],[28,26],[28,27]],"direction":"down"},{"id":"a88","path":[[25,26],[24,26],[24,27],[25,27]],"direction":"right"},{"id":"a89","path":[[20,27],[21,27]],"direction":"right"},{"id":"a90","path":[[3,26],[3,27],[4,27],[5,27]],"direction":"right"},{"id":"a91","path":[[4,20],[5,20],[5,21]],"direction":"down"},{"id":"a92","path":[[30,20],[30,21]],"direction":"down"},{"id":"a93","path":[[12,20],[13,20]],"direction":"right"},{"id":"a94","path":[[13,9],[13,10]],"direction":"down"},{"id":"a95","path":[[30,14],[30,15],[30,16]],"direction":"down"},{"id":"a96","path":[[30,9],[30,10],[30,11]],"direction":"down"},{"id":"a97","path":[[21,25],[22,25],[23,25],[23,26]],"direction":"down"},{"id":"a98","path":[[23,13],[23,14]],"direction":"down"},{"id":"a99","path":[[1,26],[0,26],[0,25],[1,25]],"direction":"right"},{"id":"a100","path":[[0,17],[0,18]],"direction":"down"},{"id":"a101","path":[[1,9],[0,9],[0,10]],"direction":"down"},{"id":"a102","path":[[1,8],[1,7],[0,7],[0,8]],"direction":"down"},{"id":"a103","path":[[0,5],[0,6]],"direction":"down"},{"id":"a104","path":[[0,0],[0,1]],"direction":"down"},{"id":"a105","path":[[3,7],[3,6],[3,5],[2,5]],"direction":"left"},{"id":"a106","path":[[5,14],[4,14],[3,14],[3,13]],"direction":"up"},{"id":"a107","path":[[5,7],[5,8],[5,9]],"direction":"down"},{"id":"a108","path":[[14,7],[13,7]],"direction":"left"},{"id":"a109","path":[[13,5],[13,6]],"direction":"down"},{"id":"a110","path":[[24,6],[23,6]],"direction":"left"},{"id":"a111","path":[[12,0],[13,0],[14,0],[14,1],[14,2]],"direction":"down"},{"id":"a112","path":[[1,1],[1,0],[2,0]],"direction":"right"},{"id":"a113","path":[[17,1],[16,1]],"direction":"left"},{"id":"a114","path":[[1,20],[1,19]],"direction":"up"},{"id":"a115","path":[[24,2],[23,2],[22,2]],"direction":"left"},{"id":"a116","path":[[28,2],[27,2]],"direction":"left"},{"id":"a117","path":[[27,8],[28,8],[28,7]],"direction":"up"},{"id":"a118","path":[[28,14],[28,13]],"direction":"up"},{"id":"a119","path":[[24,13],[25,13]],"direction":"right"},{"id":"a120","path":[[12,13],[11,13],[10,13]],"direction":"left"},{"id":"a121","path":[[10,29],[11,29],[11,28]],"direction":"up"},{"id":"a122","path":[[2,29],[3,29]],"direction":"right"},{"id":"a123","path":[[22,13],[21,13]],"direction":"left"},{"id":"a124","path":[[10,22],[10,21]],"direction":"up"},{"id":"a125","path":[[5,5],[4,5]],"direction":"left"},{"id":"a126","path":[[26,9],[26,10],[25,10]],"direction":"left"},{"id":"a127","path":[[26,5],[26,6]],"direction":"down"}],"timeLimitMs":81000,"obstacles":[[23,9],[1,27],[20,28],[2,9],[12,9],[9,22],[3,17],[30,8],[24,23],[27,14],[17,24],[22,14],[6,14],[16,8],[4,21]]}},{"id":18,"rewards":{},"board":{"number":18,"width":31,"height":31,"seed":710018,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[27,7],[26,7],[26,6],[25,6],[25,5],[25,4],[25,3],[26,3],[26,2],[27,2],[27,3],[28,3],[29,3],[30,3],[30,2],[29,2],[28,2],[28,1],[27,1],[27,0],[26,0],[26,1],[25,1],[25,0]],"direction":"up"},{"id":"a1","path":[[27,4],[28,4],[28,5],[27,5],[26,5],[26,4]],"direction":"up"},{"id":"a2","path":[[29,15],[29,14],[28,14],[28,13],[27,13],[27,14],[27,15],[26,15],[26,14],[26,13],[25,13],[24,13],[24,12],[25,12],[26,12],[27,12],[28,12],[28,11],[27,11],[26,11],[26,10],[25,10],[25,9],[26,9],[26,8]],"direction":"up"},{"id":"a3","path":[[27,23],[27,24],[27,25],[28,25],[29,25],[30,25],[30,24],[29,24],[29,23],[30,23],[30,22],[30,21],[29,21],[29,20],[28,20],[28,19],[27,19],[27,20],[26,20],[26,19],[26,18],[26,17],[26,16]],"direction":"up"},{"id":"a4","path":[[29,28],[30,28],[30,27],[30,26],[29,26],[28,26],[27,26],[26,26],[26,27],[25,27],[25,26],[24,26],[24,25],[24,24],[25,24],[25,25],[26,25]],"direction":"right"},{"id":"a5","path":[[20,19],[21,19],[21,20],[20,20],[20,21],[20,22],[19,22],[18,22],[18,23],[18,24],[18,25],[18,26],[19,26],[19,27],[20,27],[21,27],[22,27],[22,26],[23,26]],"direction":"right"},{"id":"a6","path":[[23,16],[23,17],[23,18],[22,18],[22,19],[22,20],[22,21],[21,21],[21,22],[22,22],[22,23],[22,24],[23,24],[23,25],[22,25],[21,25],[21,24],[20,24],[20,25],[20,26],[21,26]],"direction":"right"},{"id":"a7","path":[[10,30],[11,30],[11,29],[12,29],[13,29],[13,28],[14,28],[15,28],[15,29],[14,29],[14,30],[15,30],[16,30],[16,29],[16,28],[17,28],[17,27],[16,27],[16,26],[17,26]],"direction":"right"},{"id":"a8","path":[[15,23],[15,22],[16,22],[17,22],[17,23],[17,24],[17,25],[16,25],[16,24],[15,24],[15,25],[14,25],[13,25],[13,24],[12,24],[12,25],[12,26],[13,26],[14,26],[15,26],[15,27]],"direction":"down"},{"id":"a9","path":[[20,17],[20,16],[19,16],[19,17],[19,18],[18,18],[17,18],[17,17],[16,17],[15,17],[15,18],[15,19],[14,19],[13,19],[13,20],[14,20],[15,20],[15,21]],"direction":"down"},{"id":"a10","path":[[9,20],[9,19],[10,19],[10,20],[11,20],[12,20],[12,19],[11,19],[11,18],[10,18],[9,18],[9,17],[9,16],[10,16],[10,15],[11,15],[12,15],[13,15],[14,15],[15,15],[15,16]],"direction":"down"},{"id":"a11","path":[[16,8],[17,8],[17,9],[18,9],[18,10],[18,11],[18,12],[18,13],[19,13],[20,13],[20,14],[19,14],[19,15],[18,15],[18,14],[17,14],[17,13],[16,13],[16,12],[15,12],[15,13],[15,14]],"direction":"down"},{"id":"a12","path":[[12,11],[11,11],[10,11],[9,11],[9,10],[9,9],[8,9],[8,8],[9,8],[10,8],[11,8],[11,9],[12,9],[12,10],[13,10],[14,10],[15,10],[15,11]],"direction":"down"},{"id":"a13","path":[[12,4],[11,4],[11,5],[12,5],[12,6],[13,6],[13,5],[14,5],[15,5],[15,6],[16,6],[17,6],[17,7],[16,7],[15,7],[15,8],[15,9]],"direction":"down"},{"id":"a14","path":[[18,0],[19,0],[20,0],[21,0],[21,1],[20,1],[19,1],[18,1],[17,1],[17,2],[16,2],[15,2],[14,2],[13,2],[13,3],[13,4],[14,4],[14,3],[15,3],[15,4]],"direction":"down"},{"id":"a15","path":[[21,4],[21,5],[21,6],[22,6],[22,7],[21,7],[20,7],[20,6],[19,6],[19,5],[18,5],[17,5],[16,5],[16,4],[16,3],[17,3],[17,4],[18,4],[19,4],[19,3],[19,2]],"direction":"up"},{"id":"a16","path":[[18,6],[18,7],[18,8],[19,8],[19,7]],"direction":"up"},{"id":"a17","path":[[25,11],[24,11],[23,11],[23,12],[22,12],[22,11],[21,11],[21,10],[20,10],[19,10],[19,9]],"direction":"up"},{"id":"a18","path":[[20,12],[19,12],[19,11]],"direction":"up"},{"id":"a19","path":[[16,18],[16,19],[16,20],[16,21],[17,21],[17,20],[18,20],[18,21],[19,21],[19,20],[19,19]],"direction":"up"},{"id":"a20","path":[[19,25],[19,24],[19,23]],"direction":"up"},{"id":"a21","path":[[17,29],[17,30],[18,30],[18,29],[19,29],[19,28]],"direction":"up"},{"id":"a22","path":[[18,27],[18,28]],"direction":"down"},{"id":"a23","path":[[6,29],[7,29],[7,30],[8,30],[9,30],[9,29],[9,28],[9,27],[10,27],[10,26],[9,26],[8,26],[8,27],[7,27],[7,26],[7,25],[8,25],[9,25],[10,25],[11,25]],"direction":"right"},{"id":"a24","path":[[5,27],[5,26],[5,25],[6,25]],"direction":"right"},{"id":"a25","path":[[3,16],[3,17],[3,18],[3,19],[3,20],[2,20],[2,19],[2,18],[1,18],[1,19],[0,19],[0,20],[0,21],[0,22],[0,23],[0,24],[1,24],[1,25],[2,25],[3,25],[4,25]],"direction":"right"},{"id":"a26","path":[[8,12],[8,11],[8,10],[7,10],[7,9],[6,9],[6,10],[6,11],[5,11],[5,12],[4,12],[4,13],[5,13],[5,14],[4,14],[4,15],[4,16],[4,17],[4,18],[5,18],[6,18],[6,19],[5,19],[4,19]],"direction":"left"},{"id":"a27","path":[[13,13],[13,14],[12,14],[12,13],[11,13],[10,13],[10,12],[9,12],[9,13],[8,13],[8,14],[8,15],[8,16],[8,17],[7,17],[7,18],[8,18],[8,19],[7,19]],"direction":"left"},{"id":"a28","path":[[18,19],[17,19]],"direction":"left"},{"id":"a29","path":[[23,13],[22,13],[22,14],[23,14],[24,14],[25,14],[25,15],[24,15],[24,16],[25,16],[25,17],[24,17],[24,18],[25,18],[25,19],[24,19],[23,19]],"direction":"left"},{"id":"a30","path":[[16,16],[17,16],[18,16],[18,17]],"direction":"down"},{"id":"a31","path":[[18,2],[18,3]],"direction":"down"},{"id":"a32","path":[[30,20],[30,19],[29,19]],"direction":"left"},{"id":"a33","path":[[26,24],[26,23],[25,23],[25,22],[25,21],[24,21],[23,21],[23,20],[24,20],[25,20]],"direction":"right"},{"id":"a34","path":[[9,22],[9,21],[10,21],[11,21],[11,22],[11,23],[11,24],[10,24],[9,24],[9,23],[8,23],[7,23],[7,22],[8,22],[8,21],[7,21],[7,20],[8,20]],"direction":"right"},{"id":"a35","path":[[11,14],[10,14],[9,14],[9,15]],"direction":"down"},{"id":"a36","path":[[10,7],[10,6],[9,6],[9,7]],"direction":"down"},{"id":"a37","path":[[6,0],[7,0],[8,0],[8,1],[9,1],[9,2],[8,2],[7,2],[7,3],[8,3],[9,3],[9,4],[9,5]],"direction":"down"},{"id":"a38","path":[[6,5],[7,5],[7,6],[8,6],[8,5],[8,4]],"direction":"up"},{"id":"a39","path":[[2,22],[1,22],[1,23],[2,23],[2,24],[3,24],[4,24],[4,23],[3,23],[3,22],[3,21],[4,21],[4,20],[5,20],[6,20]],"direction":"right"},{"id":"a40","path":[[7,24],[6,24],[5,24]],"direction":"left"},{"id":"a41","path":[[4,22],[5,22],[5,21],[6,21],[6,22],[6,23],[5,23]],"direction":"left"},{"id":"a42","path":[[0,29],[1,29],[1,30],[2,30],[2,29],[3,29],[3,28],[2,28],[2,27],[3,27],[3,26],[4,26],[4,27],[4,28],[5,28],[6,28],[7,28],[8,28],[8,29]],"direction":"down"},{"id":"a43","path":[[6,17],[6,16],[5,16],[5,15],[6,15],[7,15],[7,16]],"direction":"down"},{"id":"a44","path":[[7,11],[7,12],[7,13],[7,14]],"direction":"down"},{"id":"a45","path":[[2,26],[1,26],[1,27],[1,28]],"direction":"down"},{"id":"a46","path":[[1,20],[1,21]],"direction":"down"},{"id":"a47","path":[[2,5],[2,6],[1,6],[1,7],[0,7],[0,8],[0,9],[1,9],[1,10],[1,11],[1,12],[1,13],[1,14],[1,15],[1,16],[1,17]],"direction":"down"},{"id":"a48","path":[[2,7],[3,7],[3,8],[4,8],[4,9],[3,9],[2,9],[2,8],[1,8]],"direction":"left"},{"id":"a49","path":[[3,13],[2,13],[2,12],[2,11],[2,10],[3,10],[3,11],[4,11],[4,10],[5,10],[5,9],[5,8],[5,7],[4,7]],"direction":"left"},{"id":"a50","path":[[8,7],[7,7],[7,8],[6,8]],"direction":"left"},{"id":"a51","path":[[14,8],[13,8],[12,8]],"direction":"left"},{"id":"a52","path":[[21,8],[20,8]],"direction":"left"},{"id":"a53","path":[[22,10],[23,10],[24,10],[24,9],[24,8],[23,8],[22,8]],"direction":"left"},{"id":"a54","path":[[0,6],[0,5],[0,4],[0,3],[0,2],[1,2],[2,2],[3,2],[4,2],[4,3],[3,3],[2,3],[1,3],[1,4],[1,5]],"direction":"down"},{"id":"a55","path":[[0,1],[0,0],[1,0],[1,1]],"direction":"down"},{"id":"a56","path":[[2,1],[3,1],[3,0],[2,0]],"direction":"left"},{"id":"a57","path":[[4,0],[5,0],[5,1],[4,1]],"direction":"left"},{"id":"a58","path":[[7,1],[6,1]],"direction":"left"},{"id":"a59","path":[[9,0],[10,0],[11,0],[11,1],[10,1]],"direction":"left"},{"id":"a60","path":[[13,1],[12,1]],"direction":"left"},{"id":"a61","path":[[17,0],[16,0],[16,1],[15,1],[14,1]],"direction":"left"},{"id":"a62","path":[[22,0],[23,0],[24,0],[24,1],[23,1],[22,1]],"direction":"left"},{"id":"a63","path":[[25,2],[24,2],[24,3],[24,4],[24,5],[23,5],[23,4],[23,3],[23,2]],"direction":"up"},{"id":"a64","path":[[24,6],[24,7],[23,7],[23,6]],"direction":"up"},{"id":"a65","path":[[23,23],[24,23],[24,22]],"direction":"up"},{"id":"a66","path":[[24,28],[24,27]],"direction":"up"},{"id":"a67","path":[[23,29],[23,30],[24,30],[24,29]],"direction":"up"},{"id":"a68","path":[[23,27],[23,28]],"direction":"down"},{"id":"a69","path":[[22,5],[22,4],[22,3],[21,3],[20,3],[20,2],[21,2],[22,2]],"direction":"right"},{"id":"a70","path":[[11,3],[12,3]],"direction":"right"},{"id":"a71","path":[[20,5],[20,4]],"direction":"up"},{"id":"a72","path":[[10,5],[10,4],[10,3],[10,2],[11,2],[12,2]],"direction":"right"},{"id":"a73","path":[[10,10],[10,9]],"direction":"up"},{"id":"a74","path":[[14,9],[13,9]],"direction":"left"},{"id":"a75","path":[[6,3],[5,3],[5,2],[6,2]],"direction":"right"},{"id":"a76","path":[[3,5],[4,5],[5,5],[5,4]],"direction":"up"},{"id":"a77","path":[[29,4],[30,4],[30,5],[29,5]],"direction":"left"},{"id":"a78","path":[[6,4],[7,4]],"direction":"right"},{"id":"a79","path":[[2,4],[3,4],[4,4]],"direction":"right"},{"id":"a80","path":[[3,14],[3,15],[2,15],[2,14]],"direction":"up"},{"id":"a81","path":[[2,17],[2,16]],"direction":"up"},{"id":"a82","path":[[6,7],[6,6]],"direction":"up"},{"id":"a83","path":[[6,14],[6,13],[6,12]],"direction":"up"},{"id":"a84","path":[[6,27],[6,26]],"direction":"up"},{"id":"a85","path":[[14,6],[14,7],[13,7],[12,7],[11,7],[11,6]],"direction":"up"},{"id":"a86","path":[[25,8],[25,7]],"direction":"up"},{"id":"a87","path":[[27,6],[28,6],[29,6],[29,7],[28,7]],"direction":"left"},{"id":"a88","path":[[30,13],[30,12],[29,12],[29,11],[30,11],[30,10],[29,10],[29,9],[28,9],[28,10],[27,10],[27,9],[27,8]],"direction":"up"},{"id":"a89","path":[[16,9],[16,10],[17,10]],"direction":"right"},{"id":"a90","path":[[23,9],[22,9],[21,9],[20,9]],"direction":"left"},{"id":"a91","path":[[21,14],[21,13],[21,12]],"direction":"up"},{"id":"a92","path":[[28,17],[29,17],[30,17],[30,18],[29,18],[28,18],[27,18],[27,17],[27,16]],"direction":"up"},{"id":"a93","path":[[27,22],[27,21]],"direction":"up"},{"id":"a94","path":[[30,29],[30,30],[29,30],[29,29],[28,29],[27,29],[27,28],[27,27]],"direction":"up"},{"id":"a95","path":[[28,30],[27,30],[26,30],[25,30],[25,29],[26,29]],"direction":"right"},{"id":"a96","path":[[22,28],[21,28],[20,28],[20,29],[21,29],[22,29]],"direction":"right"},{"id":"a97","path":[[29,27],[28,27],[28,28]],"direction":"down"},{"id":"a98","path":[[12,27],[13,27],[14,27]],"direction":"right"},{"id":"a99","path":[[12,21],[12,22],[13,22],[13,21],[14,21],[14,22],[14,23],[14,24]],"direction":"down"},{"id":"a100","path":[[10,17],[11,17],[12,17],[12,18],[13,18],[13,17],[14,17],[14,18]],"direction":"down"},{"id":"a101","path":[[10,23],[10,22]],"direction":"up"},{"id":"a102","path":[[10,29],[10,28]],"direction":"up"},{"id":"a103","path":[[13,23],[12,23]],"direction":"left"},{"id":"a104","path":[[25,28],[26,28]],"direction":"right"},{"id":"a105","path":[[11,26],[11,27],[11,28],[12,28]],"direction":"right"},{"id":"a106","path":[[26,21],[26,22]],"direction":"down"},{"id":"a107","path":[[28,23],[28,24]],"direction":"down"},{"id":"a108","path":[[20,23],[21,23]],"direction":"right"},{"id":"a109","path":[[19,30],[20,30],[21,30],[22,30]],"direction":"right"},{"id":"a110","path":[[12,30],[13,30]],"direction":"right"},{"id":"a111","path":[[5,30],[6,30]],"direction":"right"},{"id":"a112","path":[[21,16],[22,16],[22,17]],"direction":"down"},{"id":"a113","path":[[30,14],[30,15],[30,16]],"direction":"down"},{"id":"a114","path":[[30,6],[30,7],[30,8],[30,9]],"direction":"down"},{"id":"a115","path":[[30,0],[30,1]],"direction":"down"},{"id":"a116","path":[[28,8],[29,8]],"direction":"right"},{"id":"a117","path":[[4,6],[5,6]],"direction":"right"},{"id":"a118","path":[[3,30],[4,30],[4,29]],"direction":"up"},{"id":"a119","path":[[28,15],[28,16],[29,16]],"direction":"right"},{"id":"a120","path":[[12,16],[13,16],[14,16]],"direction":"right"},{"id":"a121","path":[[14,11],[13,11],[13,12],[14,12],[14,13],[14,14]],"direction":"down"},{"id":"a122","path":[[20,15],[21,15],[22,15],[23,15]],"direction":"right"},{"id":"a123","path":[[21,18],[21,17]],"direction":"up"},{"id":"a124","path":[[16,14],[16,15],[17,15]],"direction":"right"},{"id":"a125","path":[[16,11],[17,11],[17,12]],"direction":"down"},{"id":"a126","path":[[11,12],[12,12]],"direction":"right"},{"id":"a127","path":[[15,0],[14,0],[13,0],[12,0]],"direction":"left"},{"id":"a128","path":[[29,0],[28,0]],"direction":"left"},{"id":"a129","path":[[28,22],[28,21]],"direction":"up"},{"id":"a130","path":[[0,18],[0,17],[0,16],[0,15],[0,14],[0,13],[0,12],[0,11],[0,10]],"direction":"up"},{"id":"a131","path":[[0,28],[0,27],[0,26],[0,25]],"direction":"up"}],"timeLimitMs":79000,"obstacles":[[16,23],[29,1],[3,6],[0,30],[29,22],[20,11],[5,17],[29,13],[11,10],[8,24],[20,18],[11,16],[3,12],[5,29],[2,21],[23,22]]}},{"id":19,"rewards":{},"board":{"number":19,"width":32,"height":32,"seed":710019,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[23,31],[22,31],[21,31],[21,30],[22,30],[22,29],[23,29],[23,30],[24,30],[24,31],[25,31],[26,31],[27,31],[28,31],[28,30],[27,30],[27,29],[27,28],[28,28],[29,28],[30,28],[30,29],[31,29]],"direction":"right"},{"id":"a1","path":[[26,29],[26,30]],"direction":"down"},{"id":"a2","path":[[25,30],[25,29],[25,28],[25,27],[26,27],[26,28]],"direction":"down"},{"id":"a3","path":[[27,13],[26,13],[25,13],[25,14],[26,14],[26,15],[26,16],[26,17],[27,17],[28,17],[28,18],[28,19],[28,20],[28,21],[28,22],[27,22],[27,23],[26,23],[26,24],[25,24],[25,25],[25,26]],"direction":"down"},{"id":"a4","path":[[24,23],[23,23],[23,22],[23,21],[24,21],[25,21],[25,22],[25,23]],"direction":"down"},{"id":"a5","path":[[27,21],[27,20],[27,19],[27,18],[26,18],[26,19],[25,19],[25,20]],"direction":"down"},{"id":"a6","path":[[22,23],[22,22],[22,21],[22,20],[21,20],[21,19],[20,19],[19,19],[19,18],[20,18],[20,17],[20,16],[21,16],[21,17],[21,18],[22,18],[22,17],[23,17],[23,18],[24,18],[24,17],[25,17],[25,18]],"direction":"down"},{"id":"a7","path":[[24,15],[25,15],[25,16]],"direction":"down"},{"id":"a8","path":[[30,14],[30,13],[29,13],[28,13],[28,12],[29,12],[30,12],[30,11],[29,11],[28,11],[27,11],[27,12],[26,12],[26,11],[26,10],[25,10],[25,11],[25,12]],"direction":"down"},{"id":"a9","path":[[30,4],[31,4],[31,5],[31,6],[31,7],[31,8],[31,9],[31,10],[30,10],[29,10],[28,10],[27,10],[27,9],[26,9],[26,8],[27,8],[27,7],[26,7],[26,6],[25,6],[25,7],[25,8],[25,9]],"direction":"down"},{"id":"a10","path":[[30,6],[30,7],[29,7],[29,6],[29,5],[30,5]],"direction":"right"},{"id":"a11","path":[[16,6],[16,5],[17,5],[18,5],[19,5],[20,5],[20,6],[21,6],[21,5],[22,5],[22,4],[23,4],[23,5],[24,5],[24,4],[25,4],[25,5],[26,5],[26,4],[27,4],[27,5],[28,5]],"direction":"right"},{"id":"a12","path":[[16,11],[16,10],[15,10],[15,11],[15,12],[14,12],[14,11],[13,11],[13,10],[13,9],[13,8],[13,7],[12,7],[11,7],[11,6],[12,6],[13,6],[13,5],[13,4],[13,3],[14,3],[14,4],[14,5],[15,5]],"direction":"right"},{"id":"a13","path":[[11,8],[10,8],[10,7],[9,7],[9,6],[10,6],[10,5],[11,5],[12,5]],"direction":"right"},{"id":"a14","path":[[11,11],[11,12],[11,13],[10,13],[10,12],[10,11],[9,11],[9,10],[8,10],[8,9],[8,8],[7,8],[7,7],[8,7],[8,6],[8,5],[9,5]],"direction":"right"},{"id":"a15","path":[[4,12],[4,11],[4,10],[4,9],[4,8],[3,8],[3,9],[2,9],[2,8],[2,7],[2,6],[3,6],[4,6],[4,5],[5,5],[6,5],[7,5]],"direction":"right"},{"id":"a16","path":[[3,0],[2,0],[1,0],[1,1],[1,2],[2,2],[2,3],[2,4],[2,5],[3,5]],"direction":"right"},{"id":"a17","path":[[1,13],[0,13],[0,12],[0,11],[1,11],[1,10],[1,9],[1,8],[0,8],[0,7],[1,7],[1,6],[0,6],[0,5],[1,5]],"direction":"right"},{"id":"a18","path":[[7,9],[7,10],[7,11],[6,11],[6,10],[6,9],[6,8],[5,8]],"direction":"left"},{"id":"a19","path":[[7,6],[6,6],[5,6]],"direction":"left"},{"id":"a20","path":[[17,8],[16,8],[15,8],[14,8],[14,7],[15,7],[15,6],[14,6]],"direction":"left"},{"id":"a21","path":[[22,11],[23,11],[23,10],[24,10],[24,9],[24,8],[23,8],[23,9],[22,9],[22,8],[21,8],[20,8],[19,8],[19,7],[19,6],[18,6],[17,6]],"direction":"left"},{"id":"a22","path":[[14,10],[14,9],[15,9],[16,9],[17,9],[17,10],[18,10],[18,9],[19,9],[19,10],[20,10],[20,9],[21,9],[21,10],[22,10]],"direction":"right"},{"id":"a23","path":[[9,8],[9,9],[10,9],[10,10],[11,10],[12,10]],"direction":"right"},{"id":"a24","path":[[21,7],[22,7],[23,7],[24,7],[24,6],[23,6],[22,6]],"direction":"left"},{"id":"a25","path":[[30,9],[30,8],[29,8],[29,9],[28,9],[28,8],[28,7],[28,6],[27,6]],"direction":"left"},{"id":"a26","path":[[6,7],[5,7],[4,7],[3,7]],"direction":"left"},{"id":"a27","path":[[18,8],[18,7],[17,7],[16,7]],"direction":"left"},{"id":"a28","path":[[3,21],[4,21],[5,21],[5,20],[5,19],[4,19],[3,19],[3,18],[3,17],[3,16],[3,15],[3,14],[3,13],[2,13]],"direction":"left"},{"id":"a29","path":[[12,14],[13,14],[14,14],[14,15],[13,15],[12,15],[11,15],[11,14],[10,14],[10,15],[10,16],[9,16],[9,17],[8,17],[7,17],[7,16],[7,15],[7,14],[6,14],[6,15],[5,15],[5,14],[5,13],[4,13]],"direction":"left"},{"id":"a30","path":[[9,15],[9,14],[9,13],[8,13],[7,13],[6,13]],"direction":"left"},{"id":"a31","path":[[24,11],[24,12],[23,12],[23,13],[22,13],[22,14],[21,14],[20,14],[19,14],[18,14],[18,15],[17,15],[16,15],[15,15],[15,14],[15,13],[14,13],[13,13],[12,13]],"direction":"left"},{"id":"a32","path":[[17,13],[16,13]],"direction":"left"},{"id":"a33","path":[[22,12],[21,12],[21,13],[20,13],[20,12],[20,11],[19,11],[19,12],[19,13],[18,13]],"direction":"left"},{"id":"a34","path":[[2,10],[3,10],[3,11],[2,11]],"direction":"left"},{"id":"a35","path":[[3,12],[2,12],[1,12]],"direction":"left"},{"id":"a36","path":[[6,12],[5,12]],"direction":"left"},{"id":"a37","path":[[0,1],[0,2],[0,3],[0,4],[1,4],[1,3]],"direction":"up"},{"id":"a38","path":[[2,14],[2,15],[1,15],[1,14]],"direction":"up"},{"id":"a39","path":[[1,17],[1,16]],"direction":"up"},{"id":"a40","path":[[3,26],[4,26],[4,25],[3,25],[2,25],[1,25],[1,26],[1,27],[0,27],[0,26],[0,25],[0,24],[0,23],[0,22],[0,21],[1,21],[1,20],[1,19],[1,18]],"direction":"up"},{"id":"a41","path":[[2,16],[2,17],[2,18],[2,19],[2,20],[2,21],[2,22],[3,22],[4,22],[5,22],[5,23],[4,23],[3,23],[2,23],[2,24],[1,24]],"direction":"left"},{"id":"a42","path":[[4,29],[5,29],[6,29],[6,28],[7,28],[7,27],[6,27],[5,27],[5,26],[5,25],[6,25],[6,24],[5,24],[4,24],[3,24]],"direction":"left"},{"id":"a43","path":[[14,31],[15,31],[15,30],[14,30],[14,29],[15,29],[15,28],[14,28],[13,28],[12,28],[11,28],[11,29],[10,29],[10,28],[10,27],[9,27],[9,26],[9,25],[9,24],[9,23],[8,23],[8,24],[7,24]],"direction":"left"},{"id":"a44","path":[[11,27],[12,27],[12,26],[11,26],[10,26],[10,25],[11,25],[11,24],[10,24]],"direction":"left"},{"id":"a45","path":[[14,26],[13,26],[13,27],[14,27],[15,27],[15,26],[16,26],[16,25],[15,25],[14,25],[14,24],[13,24],[12,24]],"direction":"left"},{"id":"a46","path":[[13,20],[14,20],[15,20],[15,21],[15,22],[14,22],[14,23]],"direction":"down"},{"id":"a47","path":[[14,16],[15,16],[16,16],[17,16],[18,16],[18,17],[17,17],[16,17],[16,18],[15,18],[15,19],[16,19],[16,20],[16,21],[16,22],[16,23],[15,23],[15,24]],"direction":"down"},{"id":"a48","path":[[18,19],[18,18],[17,18],[17,19],[17,20],[18,20],[18,21],[17,21],[17,22],[17,23],[17,24],[16,24]],"direction":"left"},{"id":"a49","path":[[17,28],[17,27],[18,27],[18,26],[18,25],[19,25],[19,24],[18,24]],"direction":"left"},{"id":"a50","path":[[24,29],[24,28],[23,28],[22,28],[21,28],[21,27],[21,26],[22,26],[22,25],[21,25],[21,24],[20,24]],"direction":"left"},{"id":"a51","path":[[24,24],[24,25],[23,25],[23,24],[22,24]],"direction":"left"},{"id":"a52","path":[[27,27],[28,27],[28,26],[27,26],[26,26],[26,25],[27,25],[28,25],[28,24],[27,24]],"direction":"left"},{"id":"a53","path":[[28,14],[27,14],[27,15],[27,16]],"direction":"down"},{"id":"a54","path":[[26,1],[27,1],[28,1],[28,0],[29,0],[30,0],[31,0],[31,1],[31,2],[31,3],[30,3],[30,2],[29,2],[29,3],[29,4],[28,4],[28,3],[28,2],[27,2],[27,3]],"direction":"down"},{"id":"a55","path":[[29,1],[30,1]],"direction":"right"},{"id":"a56","path":[[28,16],[29,16],[30,16],[30,15]],"direction":"up"},{"id":"a57","path":[[31,11],[31,12],[31,13],[31,14],[31,15],[31,16],[31,17],[31,18],[30,18],[30,17]],"direction":"up"},{"id":"a58","path":[[19,16],[19,15],[20,15],[21,15],[22,15],[22,16],[23,16],[24,16]],"direction":"right"},{"id":"a59","path":[[12,17],[12,16],[13,16]],"direction":"right"},{"id":"a60","path":[[30,19],[29,19],[29,20],[29,21],[29,22],[30,22],[30,21],[30,20],[31,20],[31,19]],"direction":"up"},{"id":"a61","path":[[31,21],[31,22],[31,23],[31,24],[30,24],[30,23]],"direction":"up"},{"id":"a62","path":[[31,28],[31,27],[30,27],[29,27],[29,26],[30,26],[31,26],[31,25]],"direction":"up"},{"id":"a63","path":[[22,27],[23,27],[24,27]],"direction":"right"},{"id":"a64","path":[[20,25],[20,26],[19,26],[19,27],[20,27]],"direction":"right"},{"id":"a65","path":[[28,23],[29,23],[29,24],[29,25],[30,25]],"direction":"right"},{"id":"a66","path":[[31,31],[30,31],[30,30]],"direction":"up"},{"id":"a67","path":[[21,22],[21,21],[20,21],[19,21],[19,22],[18,22],[18,23],[19,23],[20,23],[21,23]],"direction":"right"},{"id":"a68","path":[[11,18],[12,18],[12,19],[12,20],[11,20],[11,21],[12,21],[12,22],[12,23],[13,23]],"direction":"right"},{"id":"a69","path":[[10,23],[11,23]],"direction":"right"},{"id":"a70","path":[[11,22],[10,22],[9,22],[8,22],[7,22],[7,21],[6,21],[6,22],[6,23],[7,23]],"direction":"right"},{"id":"a71","path":[[11,19],[10,19],[9,19],[9,20],[10,20],[10,21],[9,21],[8,21]],"direction":"left"},{"id":"a72","path":[[23,26],[24,26]],"direction":"right"},{"id":"a73","path":[[22,19],[23,19],[23,20]],"direction":"down"},{"id":"a74","path":[[24,2],[24,1],[23,1],[23,2],[22,2],[22,3]],"direction":"down"},{"id":"a75","path":[[27,0],[26,0],[25,0],[24,0],[23,0],[22,0],[22,1]],"direction":"down"},{"id":"a76","path":[[23,3],[24,3],[25,3],[26,3],[26,2]],"direction":"up"},{"id":"a77","path":[[25,1],[25,2]],"direction":"down"},{"id":"a78","path":[[20,1],[21,1]],"direction":"right"},{"id":"a79","path":[[11,3],[12,3],[12,2],[11,2],[10,2],[10,1],[11,1],[12,1],[12,0],[13,0],[14,0],[14,1],[15,1],[15,2],[15,3],[15,4],[16,4],[16,3],[16,2],[16,1],[17,1],[17,0],[18,0],[18,1],[19,1]],"direction":"right"},{"id":"a80","path":[[20,2],[19,2],[19,3],[19,4],[18,4],[18,3],[18,2]],"direction":"up"},{"id":"a81","path":[[16,12],[17,12],[18,12],[18,11]],"direction":"up"},{"id":"a82","path":[[12,11],[12,12],[13,12]],"direction":"right"},{"id":"a83","path":[[8,11],[8,12],[9,12]],"direction":"right"},{"id":"a84","path":[[17,30],[17,29],[16,29],[16,30],[16,31],[17,31],[18,31],[18,30],[19,30],[19,29],[18,29],[18,28]],"direction":"up"},{"id":"a85","path":[[16,27],[16,28]],"direction":"down"},{"id":"a86","path":[[17,25],[17,26]],"direction":"down"},{"id":"a87","path":[[6,26],[7,26],[8,26]],"direction":"right"},{"id":"a88","path":[[12,25],[13,25]],"direction":"right"},{"id":"a89","path":[[7,25],[8,25]],"direction":"right"},{"id":"a90","path":[[13,2],[13,1]],"direction":"up"},{"id":"a91","path":[[15,17],[14,17],[14,18],[14,19],[13,19],[13,18],[13,17]],"direction":"up"},{"id":"a92","path":[[12,4],[11,4],[10,4],[10,3],[9,3],[9,4],[8,4],[8,3],[7,3],[6,3],[6,2],[6,1],[7,1],[8,1],[9,1]],"direction":"right"},{"id":"a93","path":[[2,1],[3,1],[4,1],[5,1]],"direction":"right"},{"id":"a94","path":[[2,30],[3,30],[3,31],[2,31],[1,31],[1,30],[1,29],[2,29],[2,28],[2,27],[2,26]],"direction":"up"},{"id":"a95","path":[[3,28],[3,29]],"direction":"down"},{"id":"a96","path":[[4,2],[5,2],[5,3],[4,3],[3,3],[3,2]],"direction":"up"},{"id":"a97","path":[[8,2],[7,2]],"direction":"left"},{"id":"a98","path":[[12,9],[12,8]],"direction":"up"},{"id":"a99","path":[[13,29],[13,30],[13,31],[12,31],[11,31],[11,30],[12,30],[12,29]],"direction":"up"},{"id":"a100","path":[[11,16],[11,17]],"direction":"down"},{"id":"a101","path":[[13,21],[13,22]],"direction":"down"},{"id":"a102","path":[[17,4],[17,3],[17,2]],"direction":"up"},{"id":"a103","path":[[23,14],[24,14],[24,13]],"direction":"up"},{"id":"a104","path":[[24,20],[24,19]],"direction":"up"},{"id":"a105","path":[[8,20],[7,20],[6,20],[6,19],[7,19],[8,19]],"direction":"right"},{"id":"a106","path":[[26,22],[26,21],[26,20]],"direction":"up"},{"id":"a107","path":[[19,20],[20,20]],"direction":"right"},{"id":"a108","path":[[3,20],[4,20]],"direction":"right"},{"id":"a109","path":[[19,0],[20,0],[21,0]],"direction":"right"},{"id":"a110","path":[[15,0],[16,0]],"direction":"right"},{"id":"a111","path":[[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],[10,0],[11,0]],"direction":"right"},{"id":"a112","path":[[8,16],[8,15],[8,14]],"direction":"up"},{"id":"a113","path":[[4,14],[4,15],[4,16],[4,17],[5,17],[5,16],[6,16]],"direction":"right"},{"id":"a114","path":[[6,17],[6,18],[7,18],[8,18],[9,18],[10,18],[10,17]],"direction":"up"},{"id":"a115","path":[[8,29],[8,28],[8,27]],"direction":"up"},{"id":"a116","path":[[9,28],[9,29],[9,30],[10,30],[10,31],[9,31],[8,31],[8,30]],"direction":"up"},{"id":"a117","path":[[20,4],[21,4],[21,3],[21,2]],"direction":"up"},{"id":"a118","path":[[4,4],[5,4],[6,4],[7,4]],"direction":"right"},{"id":"a119","path":[[7,29],[7,30],[7,31],[6,31],[6,30]],"direction":"up"},{"id":"a120","path":[[5,11],[5,10],[5,9]],"direction":"up"},{"id":"a121","path":[[19,28],[20,28]],"direction":"right"},{"id":"a122","path":[[4,27],[4,28],[5,28]],"direction":"right"},{"id":"a123","path":[[0,31],[0,30],[0,29],[0,28],[1,28]],"direction":"right"},{"id":"a124","path":[[4,31],[5,31],[5,30],[4,30]],"direction":"left"},{"id":"a125","path":[[21,29],[20,29],[20,30],[20,31],[19,31]],"direction":"left"},{"id":"a126","path":[[29,31],[29,30],[29,29],[28,29]],"direction":"left"},{"id":"a127","path":[[29,17],[29,18]],"direction":"down"},{"id":"a128","path":[[29,14],[29,15]],"direction":"down"},{"id":"a129","path":[[16,14],[17,14]],"direction":"right"},{"id":"a130","path":[[4,18],[5,18]],"direction":"right"},{"id":"a131","path":[[1,22],[1,23]],"direction":"down"},{"id":"a132","path":[[0,14],[0,15],[0,16],[0,17],[0,18],[0,19],[0,20]],"direction":"down"},{"id":"a133","path":[[0,9],[0,10]],"direction":"down"}],"timeLimitMs":77000,"obstacles":[[24,22],[0,0],[3,27],[20,3],[7,12],[31,30],[14,21],[9,2],[17,11],[28,15],[19,17],[11,9],[14,2],[3,4],[23,15],[21,11],[20,7],[20,22]]}},{"id":20,"rewards":{"time":3,"life":3,"shuffle":3},"board":{"number":20,"width":32,"height":32,"seed":710020,"generatorVersion":4,"profileVersion":8,"lifeLimit":3,"arrows":[{"id":"a0","path":[[27,22],[27,23],[27,24],[28,24],[28,25],[27,25],[27,26],[27,27],[27,28],[28,28],[29,28],[29,29],[30,29],[30,30],[30,31],[29,31],[29,30],[28,30],[28,29],[27,29],[26,29],[25,29],[24,29],[23,29],[23,30],[23,31]],"direction":"down"},{"id":"a1","path":[[24,27],[24,28],[25,28],[26,28],[26,27],[25,27],[25,26],[24,26],[23,26],[23,27],[23,28]],"direction":"down"},{"id":"a2","path":[[21,30],[20,30],[20,31],[19,31],[19,30],[19,29],[19,28],[20,28],[20,27],[21,27],[21,26],[21,25],[21,24],[22,24],[23,24],[23,25]],"direction":"down"},{"id":"a3","path":[[16,31],[16,30],[16,29],[17,29],[17,30],[18,30],[18,29],[18,28],[17,28],[17,27],[17,26],[16,26],[15,26],[15,25],[16,25],[17,25],[18,25],[18,24],[19,24],[19,25],[19,26],[19,27]],"direction":"down"},{"id":"a4","path":[[10,25],[11,25],[12,25],[13,25],[14,25],[14,26],[13,26],[12,26],[12,27],[13,27],[14,27],[14,28],[15,28],[15,27],[16,27],[16,28]],"direction":"down"},{"id":"a5","path":[[16,23],[16,24]],"direction":"down"},{"id":"a6","path":[[9,15],[10,15],[11,15],[12,15],[13,15],[14,15],[14,16],[13,16],[12,16],[11,16],[11,17],[11,18],[12,18],[12,19],[11,19],[11,20],[11,21],[12,21],[13,21],[14,21],[15,21],[16,21],[16,22]],"direction":"down"},{"id":"a7","path":[[12,17],[13,17],[13,18],[14,18],[14,19],[15,19],[16,19],[16,20]],"direction":"down"},{"id":"a8","path":[[15,16],[15,15],[15,14],[16,14],[16,15],[16,16],[16,17],[16,18]],"direction":"down"},{"id":"a9","path":[[10,13],[10,12],[11,12],[11,13],[11,14],[12,14],[13,14],[14,14],[14,13],[15,13],[15,12],[15,11],[15,10],[16,10],[16,11],[16,12],[16,13]],"direction":"down"},{"id":"a10","path":[[14,8],[15,8],[16,8],[16,9]],"direction":"down"},{"id":"a11","path":[[22,0],[21,0],[20,0],[20,1],[19,1],[18,1],[17,1],[16,1],[16,2],[15,2],[15,3],[14,3],[14,4],[15,4],[15,5],[15,6],[16,6],[16,7]],"direction":"down"},{"id":"a12","path":[[18,2],[19,2],[19,3],[20,3],[20,2]],"direction":"up"},{"id":"a13","path":[[21,2],[21,1],[22,1],[23,1],[23,0],[24,0],[24,1],[25,1],[25,2],[25,3],[25,4],[24,4],[24,3],[23,3],[23,4],[22,4],[22,5],[21,5],[20,5],[20,4]],"direction":"up"},{"id":"a14","path":[[21,4],[21,3]],"direction":"up"},{"id":"a15","path":[[18,7],[18,8],[18,9],[19,9],[20,9],[20,8],[21,8],[21,7],[21,6]],"direction":"up"},{"id":"a16","path":[[25,6],[25,7],[25,8],[24,8],[24,7],[24,6],[24,5],[23,5],[23,6],[23,7],[23,8],[23,9],[22,9],[22,10],[23,10],[24,10],[24,11],[23,11],[22,11],[21,11],[21,10],[21,9]],"direction":"up"},{"id":"a17","path":[[22,13],[21,13],[21,12]],"direction":"up"},{"id":"a18","path":[[17,12],[17,13],[17,14],[17,15],[18,15],[18,16],[17,16],[17,17],[18,17],[18,18],[19,18],[19,17],[20,17],[20,16],[20,15],[21,15],[21,14]],"direction":"up"},{"id":"a19","path":[[21,19],[21,18],[21,17],[21,16]],"direction":"up"},{"id":"a20","path":[[25,18],[24,18],[24,17],[24,16],[24,15],[25,15],[26,15],[26,14],[25,14],[24,14],[23,14],[23,15],[23,16],[22,16],[22,17],[23,17],[23,18],[23,19],[24,19],[24,20],[23,20],[23,21],[22,21],[21,21],[21,20]],"direction":"up"},{"id":"a21","path":[[19,23],[20,23],[21,23],[21,22]],"direction":"up"},{"id":"a22","path":[[20,22],[20,21],[19,21],[19,22]],"direction":"down"},{"id":"a23","path":[[19,19],[19,20]],"direction":"down"},{"id":"a24","path":[[18,11],[18,12],[19,12],[19,13],[18,13],[18,14],[19,14],[19,15],[19,16]],"direction":"down"},{"id":"a25","path":[[20,14],[20,13],[20,12],[20,11],[20,10],[19,10],[19,11]],"direction":"down"},{"id":"a26","path":[[17,2],[17,3],[16,3],[16,4],[16,5],[17,5],[17,4],[18,4],[19,4],[19,5],[18,5],[18,6],[19,6],[20,6],[20,7],[19,7],[19,8]],"direction":"down"},{"id":"a27","path":[[20,20],[20,19],[20,18]],"direction":"up"},{"id":"a28","path":[[20,26],[20,25],[20,24]],"direction":"up"},{"id":"a29","path":[[20,29],[21,29],[21,28]],"direction":"up"},{"id":"a30","path":[[22,3],[22,2]],"direction":"up"},{"id":"a31","path":[[22,8],[22,7],[22,6]],"direction":"up"},{"id":"a32","path":[[22,23],[22,22],[23,22],[23,23]],"direction":"down"},{"id":"a33","path":[[31,31],[31,30],[31,29],[31,28],[31,27],[31,26],[30,26],[30,27],[30,28]],"direction":"down"},{"id":"a34","path":[[29,27],[28,27],[28,26],[29,26],[29,25],[30,25],[30,24],[31,24],[31,25]],"direction":"down"},{"id":"a35","path":[[29,22],[30,22],[30,23]],"direction":"down"},{"id":"a36","path":[[31,23],[31,22],[31,21],[31,20],[30,20],[30,21]],"direction":"down"},{"id":"a37","path":[[25,19],[25,20],[26,20],[26,19],[27,19],[28,19],[28,20],[28,21],[29,21]],"direction":"right"},{"id":"a38","path":[[29,20],[29,19],[30,19],[30,18],[31,18],[31,19]],"direction":"down"},{"id":"a39","path":[[31,17],[31,16],[31,15],[30,15],[30,16],[30,17]],"direction":"down"},{"id":"a40","path":[[26,17],[27,17],[28,17],[28,16],[28,15],[29,15]],"direction":"right"},{"id":"a41","path":[[22,12],[23,12],[24,12],[24,13],[25,13],[26,13],[27,13],[27,14],[28,14],[29,14],[29,13],[30,13],[30,14]],"direction":"down"},{"id":"a42","path":[[22,15],[22,14]],"direction":"up"},{"id":"a43","path":[[22,20],[22,19],[22,18]],"direction":"up"},{"id":"a44","path":[[22,31],[22,30],[22,29],[22,28],[22,27],[22,26],[22,25]],"direction":"up"},{"id":"a45","path":[[17,18],[17,19],[18,19]],"direction":"right"},{"id":"a46","path":[[15,30],[15,31],[14,31],[14,30],[14,29],[15,29]],"direction":"right"},{"id":"a47","path":[[1,22],[2,22],[3,22],[3,21],[4,21],[4,22],[5,22],[5,23],[6,23],[6,24],[7,24],[8,24],[8,23],[9,23],[10,23],[11,23],[12,23],[13,23],[13,22],[14,22],[14,23],[14,24]],"direction":"down"},{"id":"a48","path":[[12,29],[13,29]],"direction":"right"},{"id":"a49","path":[[13,28],[12,28],[11,28],[10,28],[10,29],[11,29]],"direction":"right"},{"id":"a50","path":[[10,30],[11,30],[12,30],[13,30],[13,31],[12,31],[11,31],[10,31],[9,31],[8,31],[8,30],[9,30],[9,29],[8,29],[8,28],[9,28]],"direction":"right"},{"id":"a51","path":[[7,30],[7,31],[6,31],[6,30],[6,29],[7,29]],"direction":"right"},{"id":"a52","path":[[4,23],[3,23],[2,23],[1,23],[1,24],[2,24],[3,24],[4,24],[4,25],[4,26],[5,26],[5,27],[6,27],[6,28]],"direction":"down"},{"id":"a53","path":[[5,24],[5,25],[6,25],[6,26]],"direction":"down"},{"id":"a54","path":[[5,21],[5,20],[6,20],[6,21],[6,22]],"direction":"down"},{"id":"a55","path":[[5,19],[4,19],[4,18],[5,18],[6,18],[6,19]],"direction":"down"},{"id":"a56","path":[[1,15],[1,16],[2,16],[3,16],[3,15],[4,15],[4,14],[5,14],[5,15],[6,15],[7,15],[7,16],[6,16],[6,17]],"direction":"down"},{"id":"a57","path":[[0,16],[0,15],[0,14],[0,13],[0,12],[0,11],[1,11],[1,10],[2,10],[2,11],[3,11],[3,12],[4,12],[4,13],[5,13],[6,13],[6,14]],"direction":"down"},{"id":"a58","path":[[10,14],[9,14],[9,13],[8,13],[7,13],[7,12],[8,12],[9,12],[9,11],[8,11],[7,11],[6,11],[6,12],[5,12],[5,11],[4,11]],"direction":"left"},{"id":"a59","path":[[0,10],[0,9],[1,9],[1,8],[2,8],[2,7],[3,7],[4,7],[5,7],[5,6],[6,6],[6,7],[6,8],[6,9],[6,10]],"direction":"down"},{"id":"a60","path":[[4,9],[4,8],[3,8],[3,9],[2,9]],"direction":"left"},{"id":"a61","path":[[4,0],[5,0],[5,1],[6,1],[6,0],[7,0],[8,0],[9,0],[9,1],[9,2],[9,3],[8,3],[8,2],[7,2],[7,3],[7,4],[6,4],[6,5]],"direction":"down"},{"id":"a62","path":[[4,1],[3,1],[3,2],[2,2],[2,1],[1,1],[1,2],[0,2],[0,3],[1,3],[2,3],[3,3],[3,4],[4,4],[4,3],[4,2],[5,2],[6,2],[6,3]],"direction":"down"},{"id":"a63","path":[[10,6],[10,7],[11,7],[11,8],[11,9],[11,10],[12,10],[12,9],[12,8],[12,7],[12,6],[12,5],[13,5],[13,4],[13,3],[13,2],[14,2],[14,1],[13,1],[13,0],[12,0],[12,1],[12,2],[11,2],[10,2]],"direction":"left"},{"id":"a64","path":[[24,2],[23,2]],"direction":"left"},{"id":"a65","path":[[27,0],[27,1],[27,2],[26,2]],"direction":"left"},{"id":"a66","path":[[26,5],[27,5],[28,5],[28,4],[28,3],[29,3],[29,2],[28,2]],"direction":"left"},{"id":"a67","path":[[31,4],[31,3],[31,2],[30,2]],"direction":"left"},{"id":"a68","path":[[26,3],[26,4],[27,4],[27,3]],"direction":"up"},{"id":"a69","path":[[26,6],[26,7],[27,7],[27,6]],"direction":"up"},{"id":"a70","path":[[29,12],[29,11],[30,11],[30,10],[29,10],[28,10],[28,9],[27,9],[27,8]],"direction":"up"},{"id":"a71","path":[[27,12],[26,12],[25,12],[25,11],[26,11],[27,11],[27,10]],"direction":"up"},{"id":"a72","path":[[25,16],[26,16],[27,16],[27,15]],"direction":"up"},{"id":"a73","path":[[14,12],[13,12],[13,11],[12,11],[11,11],[10,11],[10,10],[9,10],[9,9],[10,9],[10,8],[9,8],[9,7],[8,7],[8,6],[8,5],[9,5],[10,5],[10,4],[11,4],[12,4],[12,3]],"direction":"up"},{"id":"a74","path":[[13,13],[12,13],[12,12]],"direction":"up"},{"id":"a75","path":[[13,9],[13,8],[13,7],[13,6]],"direction":"up"},{"id":"a76","path":[[1,6],[1,5],[1,4],[2,4],[2,5],[3,5],[3,6],[4,6],[4,5],[5,5],[5,4],[5,3]],"direction":"up"},{"id":"a77","path":[[3,10],[4,10],[5,10],[5,9],[5,8]],"direction":"up"},{"id":"a78","path":[[7,9],[8,9],[8,10],[7,10]],"direction":"left"},{"id":"a79","path":[[14,10],[13,10]],"direction":"left"},{"id":"a80","path":[[15,9],[14,9]],"direction":"left"},{"id":"a81","path":[[12,20],[13,20],[13,19]],"direction":"up"},{"id":"a82","path":[[7,21],[7,20],[7,19],[7,18],[7,17],[8,17],[9,17],[9,18],[9,19],[10,19]],"direction":"right"},{"id":"a83","path":[[5,16],[5,17],[4,17],[4,16]],"direction":"up"},{"id":"a84","path":[[3,28],[4,28],[4,29],[5,29],[5,28]],"direction":"up"},{"id":"a85","path":[[1,19],[0,19],[0,20],[0,21],[0,22],[0,23],[0,24],[0,25],[1,25],[2,25],[3,25],[3,26],[2,26],[2,27],[2,28],[1,28],[0,28],[0,29],[1,29],[2,29],[3,29]],"direction":"right"},{"id":"a86","path":[[2,18],[1,18],[0,18],[0,17],[1,17],[2,17],[3,17],[3,18],[3,19],[2,19]],"direction":"left"},{"id":"a87","path":[[12,24],[11,24],[10,24],[9,24],[9,25],[8,25],[7,25]],"direction":"left"},{"id":"a88","path":[[27,20],[27,21],[26,21],[25,21],[24,21],[24,22],[24,23],[24,24],[25,24],[25,25],[24,25]],"direction":"left"},{"id":"a89","path":[[18,21],[18,22],[17,22],[17,21],[17,20],[18,20]],"direction":"right"},{"id":"a90","path":[[7,22],[8,22],[9,22],[9,21],[10,21]],"direction":"right"},{"id":"a91","path":[[12,22],[11,22],[10,22]],"direction":"left"},{"id":"a92","path":[[14,20],[15,20]],"direction":"right"},{"id":"a93","path":[[9,20],[10,20]],"direction":"right"},{"id":"a94","path":[[2,21],[2,20],[1,20]],"direction":"left"},{"id":"a95","path":[[4,20],[3,20]],"direction":"left"},{"id":"a96","path":[[3,31],[2,31],[2,30],[3,30],[4,30],[4,31],[5,31],[5,30]],"direction":"up"},{"id":"a97","path":[[2,12],[1,12],[1,13],[2,13],[2,14],[2,15]],"direction":"down"},{"id":"a98","path":[[11,3],[10,3]],"direction":"left"},{"id":"a99","path":[[10,27],[11,27],[11,26],[10,26],[9,26],[9,27],[8,27],[7,27],[7,28]],"direction":"down"},{"id":"a100","path":[[10,16],[10,17],[10,18]],"direction":"down"},{"id":"a101","path":[[15,17],[14,17]],"direction":"left"},{"id":"a102","path":[[11,1],[11,0],[10,0],[10,1]],"direction":"down"},{"id":"a103","path":[[11,6],[11,5]],"direction":"up"},{"id":"a104","path":[[15,22],[15,23],[15,24]],"direction":"down"},{"id":"a105","path":[[25,23],[26,23],[26,22],[25,22]],"direction":"left"},{"id":"a106","path":[[30,12],[31,12],[31,13],[31,14]],"direction":"down"},{"id":"a107","path":[[31,11],[31,10],[31,9],[31,8],[31,7],[31,6],[30,6],[30,7],[30,8],[30,9]],"direction":"down"},{"id":"a108","path":[[31,5],[30,5],[29,5],[29,6],[28,6],[28,7],[29,7]],"direction":"right"},{"id":"a109","path":[[30,1],[29,1],[28,1],[28,0],[29,0],[30,0],[31,0],[31,1]],"direction":"down"},{"id":"a110","path":[[29,4],[30,4],[30,3]],"direction":"up"},{"id":"a111","path":[[8,4],[9,4]],"direction":"right"},{"id":"a112","path":[[25,10],[26,10]],"direction":"right"},{"id":"a113","path":[[7,14],[8,14]],"direction":"right"},{"id":"a114","path":[[26,18],[27,18],[28,18],[29,18]],"direction":"right"},{"id":"a115","path":[[28,23],[29,23],[29,24]],"direction":"down"},{"id":"a116","path":[[29,16],[29,17]],"direction":"down"},{"id":"a117","path":[[27,31],[27,30]],"direction":"up"},{"id":"a118","path":[[26,31],[25,31],[24,31],[24,30],[25,30],[26,30]],"direction":"right"},{"id":"a119","path":[[1,31],[0,31],[0,30],[1,30]],"direction":"right"},{"id":"a120","path":[[18,31],[17,31]],"direction":"left"},{"id":"a121","path":[[18,26],[18,27]],"direction":"down"},{"id":"a122","path":[[3,27],[4,27]],"direction":"right"},{"id":"a123","path":[[3,13],[3,14]],"direction":"down"},{"id":"a124","path":[[0,26],[0,27],[1,27]],"direction":"right"},{"id":"a125","path":[[1,7],[0,7],[0,8]],"direction":"down"},{"id":"a126","path":[[0,4],[0,5],[0,6]],"direction":"down"},{"id":"a127","path":[[3,0],[2,0],[1,0],[0,0],[0,1]],"direction":"down"},{"id":"a128","path":[[15,1],[15,0],[14,0]],"direction":"left"},{"id":"a129","path":[[15,7],[14,7],[14,6],[14,5]],"direction":"up"},{"id":"a130","path":[[19,0],[18,0],[17,0],[16,0]],"direction":"left"},{"id":"a131","path":[[26,1],[26,0],[25,0]],"direction":"left"},{"id":"a132","path":[[24,9],[25,9],[26,9],[26,8]],"direction":"up"},{"id":"a133","path":[[26,26],[26,25],[26,24]],"direction":"up"},{"id":"a134","path":[[7,26],[8,26]],"direction":"right"},{"id":"a135","path":[[8,18],[8,19],[8,20],[8,21]],"direction":"down"},{"id":"a136","path":[[8,15],[8,16]],"direction":"down"},{"id":"a137","path":[[7,1],[8,1]],"direction":"right"},{"id":"a138","path":[[8,8],[7,8],[7,7],[7,6],[7,5]],"direction":"up"},{"id":"a139","path":[[17,11],[17,10],[17,9],[17,8],[17,7],[17,6]],"direction":"up"},{"id":"a140","path":[[29,8],[28,8]],"direction":"left"},{"id":"a141","path":[[28,13],[28,12],[28,11]],"direction":"up"},{"id":"a142","path":[[17,24],[17,23]],"direction":"up"}],"timeLimitMs":75000,"obstacles":[[9,16],[28,31],[29,9],[1,26],[18,3],[2,6],[18,23],[28,22],[1,14],[23,13],[14,11],[21,31],[9,6],[7,23],[15,18],[25,5],[13,24],[1,21],[25,17],[18,10]]}}];
},
"src/race/controller.js":function(module,exports,require){
'use strict';
const { period, VERSION, ROUNDS } = require("src/race/rules.js");
const { Session } = require("src/domain/session.js");
const history = require("src/race/history.js");
const now = app => app.platform.now ? app.platform.now() : Date.now();
function elapsed(app) { return app.race?.finishedElapsed ?? Math.max(0, (app.race?.transitionAt ?? now(app)) - (app.race?.startedAt ?? now(app)) - (app.race?.transitionMs || 0)); }
async function prepare(app) {
    const token = ++app.token;
    app.loading = true; app.modal = 'race-loading'; app.changed();
    try {
        const event = period(app.raceKind || 'daily', now(app));
        const course = await (app.raceGenerate || require("src/race/course.js").generateCourse)(event.key);
        if (token !== app.token) return;
        app.race = { event, course, index: 0 }; app.loading = false; app.modal = 'race-ready'; app.changed();
    } catch { if (token === app.token) { app.loading = false; app.modal = 'race-error'; app.changed(); } }
}
function startRound(app) {
    app.session = new Session({ ...app.race.course[app.race.index], lifeLimit: null }); app.currentLevel = app.race.index + 1;
    if (app.race.transitionAt !== undefined) { app.race.transitionMs = (app.race.transitionMs || 0) + now(app) - app.race.transitionAt; delete app.race.transitionAt; }
    app.tutorialStep = 0; app.screen = 'game'; app.modal = null; app.changed();
}
function sync(app) {
    if (app.session.state === 'failed' && !app.session.moves.size) app.modal = 'failed';
    if (app.session.state !== 'won') return;
    if (app.race.index < ROUNDS - 1) { app.race.transitionAt ??= now(app); app.modal = 'won'; return; }
    if (app.race.finishedElapsed === undefined) {
        app.race.finishedElapsed = Math.max(1, elapsed(app));
        app.race.record = { id: app.race.event.key + ':' + app.race.startedAt, kind: app.race.event.kind, period: app.race.event.key, version: VERSION, elapsed: app.race.finishedElapsed, finishedAt: now(app) };
        persistResult(app);
    }
    app.modal = 'race-finished';
}
function persistResult(app) {
    const race = app.race;
    try { history.save(app.platform.storage, app.race.record); app.race.saveError = false; }
    catch { app.race.saveError = true; }
    if (app.platform.publishRace && !app.race.saveError) {
        race.publishStatus = '好友成绩同步中';
        Promise.resolve().then(() => app.platform.publishRace(race.record, history.read(app.platform.storage))).then(sent => { race.publishStatus = sent === false ? '已跨期，仅保存本机成绩' : '好友成绩已同步'; app.dirty = true; }, () => { race.publishStatus = '好友成绩同步失败，可重试'; app.dirty = true; });
    }
}
function refreshFriends(app) {
    if (!(app.modal === 'race-friends' || app.modal === 'rank' && app.rankTab === 'friends') || !app.platform.showFriends) return;
    const key = period(app.raceKind || 'daily', now(app)).key;
    if (app.friendPeriod !== key) { app.friendPeriod = key; app.platform.showFriends(key); }
}
function action(app, name) {
    const handled = result => ({ handled: true, result });
    if (name === 'rank' && app.screen === 'home' && !app.modal) { app.rankTab = 'friends'; app.modal = 'rank'; app.raceKind = app.raceKind || 'daily'; app.friendPeriod = null; refreshFriends(app); app.changed(); return handled(); }
    if (name === 'rank-authorize' && app.modal === 'rank' && app.rankTab === 'friends') { app.platform.authorizeFriends?.(); return handled(); }
    if (name === 'rank-refresh' && app.modal === 'rank' && app.rankTab === 'friends') { app.friendPeriod = null; refreshFriends(app); app.changed(); return handled(); }
    if (name === 'rank-close' && app.modal === 'rank') { app.platform.closeFriends?.(); app.modal = null; app.changed(); return handled(); }
    if (app.modal === 'rank' && ['rank-friends', 'rank-personal', 'rank-daily', 'rank-weekly'].includes(name)) {
        if (name === 'rank-friends' || name === 'rank-personal') { app.rankTab = name.slice(5); app.platform.closeFriends?.(); app.friendPeriod = null; }
        else app.raceKind = name.slice(5);
        app.historyPage = 0; app.historyNotice = ''; refreshFriends(app); app.changed(); return handled();
    }
    if (name === 'race-sync' && (app.modal === 'race-history' || app.modal === 'rank' && app.rankTab === 'personal')) {
        const run = async () => {
            try {
                const records = history.read(app.platform.storage).filter(r => r.version === VERSION && r.period === period(app.raceKind || 'daily', now(app)).key).sort((a, b) => a.elapsed - b.elapsed);
                if (!records.length) { app.historyNotice = '本期暂无成绩'; return; }
                if (!app.platform.publishRace) { app.historyNotice = '请在微信中同步'; return; }
                await app.platform.publishRace(records[0]); app.historyNotice = '本期最佳已同步';
            } catch { app.historyNotice = '同步失败，请重试'; }
            finally { app.changed(); }
        };
        return handled(run());
    }
    if (name === 'race-notice-close' && app.modal === 'race-unlocked') { app.raceUnlockSeen = true; app.modal = null; if (app.screen === 'game') { app.session.resume(); app.syncModal(); } app.changed(); return handled(); }
    if (name === 'race' && app.screen === 'home' && !app.modal && !app.retryRead) {
        app.modal = app.unlocked >= 6 ? 'race-menu' : 'race-locked'; app.raceKind = app.raceKind || 'daily'; app.changed(); return handled();
    }
    if (name === 'race-close' && app.modal?.startsWith('race-') && app.mode !== 'race') { app.platform.closeFriends?.(); app.modal = null; app.changed(); return handled(); }
    if (name === 'race-period' && ['race-menu', 'race-history', 'race-friends'].includes(app.modal)) { app.raceKind = app.raceKind === 'daily' ? 'weekly' : 'daily'; app.historyPage = 0; if (app.modal === 'race-friends') refreshFriends(app); app.changed(); return handled(); }
    if (name === 'race-back' && ['race-history', 'race-friends'].includes(app.modal)) { app.platform.closeFriends?.(); app.modal = 'race-menu'; app.changed(); return handled(); }
    if (name === 'race-history' && app.modal === 'race-menu') { app.historyPage = 0; app.historyNotice = ''; app.modal = 'race-history'; app.changed(); return handled(); }
    if (name === 'race-page' && (app.modal === 'race-history' || app.modal === 'rank')) { app.historyPage = (app.historyPage || 0) + 1; app.changed(); return handled(); }
    if (name === 'race-friend-page' && (app.modal === 'race-friends' || app.modal === 'rank')) { app.platform.nextFriends?.(); return handled(); }
    if (name === 'race-friends' && app.modal === 'race-menu') { app.modal = 'race-friends'; app.friendPeriod = null; refreshFriends(app); app.changed(); return handled(); }
    if (['race-start', 'race-daily', 'race-weekly'].includes(name) && app.modal === 'race-menu' && app.unlocked >= 6) {
        if (name !== 'race-start') app.raceKind = name.slice(5);
        app.campaignSnapshot = require("src/persistence/store.js").snapshot(app); app.mode = 'race'; app.session = null; return handled(prepare(app));
    }
    if (app.mode !== 'race') return { handled: false };
    if (name === 'items' || name.startsWith('item-') || name.startsWith('reset-progress')) return handled();
    if (name === 'race-accept' && app.modal === 'race-ready') {
        if (period(app.raceKind, now(app)).key !== app.race.event.key) return handled(prepare(app));
        app.race.startedAt = now(app); startRound(app); return handled();
    }
    if (name === 'next' && app.modal === 'won' && app.race.index < ROUNDS - 1) { app.race.index++; startRound(app); return handled(); }
    if (name === 'race-retry-save' && app.modal === 'race-finished') { persistResult(app); app.changed(); return handled(); }
    if ((name === 'restart' && ['restart', 'failed'].includes(app.modal)) || name === 'race-retry' && ['race-error', 'race-finished'].includes(app.modal)) return handled(prepare(app));
    if (name === 'home' && app.modal) {
        app.token++; const settings = app.settings, inventory = app.inventory; require("src/persistence/store.js").restore(app, app.campaignSnapshot);
        app.settings = settings; app.inventory = inventory; app.mode = 'campaign'; app.campaignSnapshot = null; app.loading = app.loadError = false; app.message = ''; app.changed(); return handled();
    }
    return { handled: false };
}
module.exports = { action, sync, elapsed, refreshFriends };

},
"src/race/rules.js":function(module,exports,require){
'use strict';
const { settings, version } = require("src/race/settings.js");
const VERSION = version(settings);
const ROUNDS = 5;
const OFFSET = 8 * 60 * 60 * 1000;
function period(kind, now = Date.now()) {
    if (!['daily', 'weekly'].includes(kind) || !Number.isFinite(now)) throw Error('Invalid race period');
    const local = new Date(now + OFFSET);
    let start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    if (kind === 'weekly') start -= ((local.getUTCDay() + 6) % 7) * 86400000;
    const date = new Date(start).toISOString().slice(0, 10);
    return { kind, key: kind + ':' + date, startsAt: start - OFFSET, endsAt: start - OFFSET + (kind === 'daily' ? 1 : 7) * 86400000 };
}
function seedFor(periodKey, round) {
    if (!Number.isInteger(round) || round < 1 || round > ROUNDS) throw Error('Invalid race round');
    let hash = 2166136261;
    for (const c of 'race:' + VERSION + ':' + periodKey + ':' + round) { hash ^= c.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
}
function difficulty(round, kind = 'weekly') {
    if (!['daily', 'weekly'].includes(kind)) throw Error('Invalid race kind');
    if (!Number.isInteger(round) || round < 1 || round > ROUNDS) throw Error('Invalid race round');
    const row = settings[kind][round - 1];
    return { ...row, round, factor: row.minDepth / settings[kind][0].minDepth, lifeLimit: null, timeLimitMs: null };
}
module.exports = { VERSION, ROUNDS, period, seedFor, difficulty };

},
"src/race/settings.js":function(module,exports,require){
'use strict';
function validate(config) {
    const result = {};
    for (const kind of ['daily', 'weekly']) {
        if (!Array.isArray(config?.[kind]) || config[kind].length !== 5) throw Error(kind + ' 必须配置5关');
        result[kind] = config[kind].map((row, i) => {
            const bounds = { size: [8, 20], minDepth: [1, 30], maxInitialOpen: [1, 20], maxLength: [3, 16], minArrows: [1, 200] };
            const clean = {};
            for (const [key, [min, max]] of Object.entries(bounds)) {
                const value = row?.[key];
                if (!Number.isInteger(value) || value < min || value > max) throw Error(kind + ' 第' + (i + 1) + '关 ' + key + ' 必须是 ' + min + '—' + max + ' 的整数');
                clean[key] = value;
            }
            if (clean.minArrows > Math.floor(clean.size ** 2 / 2)) throw Error(kind + ' 箭头数量超过棋盘容量');
            return clean;
        });
    }
    return result;
}
function version(config) {
    let hash = 2166136261;
    for (const c of 'race-rules-4:' + JSON.stringify(validate(config))) { hash ^= c.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
}
const settings = validate(require("config/race-difficulty.json"));
module.exports = { settings, validate, version };

},
"config/race-difficulty.json":function(module,exports,require){
module.exports={"daily":[{"size":12,"minDepth":4,"maxInitialOpen":1,"maxLength":9,"minArrows":24},{"size":13,"minDepth":5,"maxInitialOpen":1,"maxLength":9,"minArrows":28},{"size":14,"minDepth":6,"maxInitialOpen":1,"maxLength":9,"minArrows":32},{"size":15,"minDepth":8,"maxInitialOpen":1,"maxLength":9,"minArrows":37},{"size":16,"minDepth":10,"maxInitialOpen":1,"maxLength":9,"minArrows":42}],"weekly":[{"size":14,"minDepth":6,"maxInitialOpen":1,"maxLength":9,"minArrows":32},{"size":15,"minDepth":8,"maxInitialOpen":1,"maxLength":9,"minArrows":37},{"size":17,"minDepth":10,"maxInitialOpen":1,"maxLength":9,"minArrows":48},{"size":18,"minDepth":13,"maxInitialOpen":1,"maxLength":9,"minArrows":54},{"size":20,"minDepth":16,"maxInitialOpen":1,"maxLength":9,"minArrows":66}]};
},
"src/race/history.js":function(module,exports,require){
'use strict';
const KEY = 'arrow-garden.race-history.v1';
function read(storage) {
    const raw = storage?.get(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.some(r => !['daily', 'weekly'].includes(r.kind) || !Number.isFinite(r.elapsed) || r.elapsed <= 0 || typeof r.period !== 'string')) throw Error('Invalid history');
    return list;
}
function save(storage, record) {
    if (!storage) throw Error('Storage unavailable');
    const list = read(storage).filter(r => r.id !== record.id);
    list.push(record); list.sort((a, b) => b.finishedAt - a.finishedAt);
    storage.set(KEY, JSON.stringify(list.slice(0, 200)));
    return list;
}
function format(ms) { const sec = Math.floor(ms / 1000); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') + '.' + Math.floor(ms % 1000 / 100); }
module.exports = { read, save, format };

},
"src/race/course.js":function(module,exports,require){
'use strict';
const { difficulty, seedFor, VERSION, ROUNDS } = require("src/race/rules.js");
const { candidate, acceptable } = require("src/generation/generator.js");
const { random } = require("src/generation/random.js");
const { solve } = require("src/generation/validate.js");
function profile(round, kind = 'weekly') {
    const d = difficulty(round, kind);
    return { ...d, minFill: 1, maxFill: 1, maxLength: d.maxLength, maxTurns: 7, maxOpenRatio: 1, maxInitialOpen: d.maxInitialOpen, minArrows: d.minArrows, dense: true };
}
function* courseRoundSteps(periodKey, round, options = {}) {
    const kind = periodKey.split(':')[0];
    const p = profile(round, kind), seed = seedFor(periodKey, round), rng = random(seed);
    for (let attempt = 0; attempt < (options.maxAttempts ?? 64); attempt++) {
        const level = yield* candidate(3, seed, p, rng);
        level.number = round; level.lifeLimit = null; level.timeLimitMs = null; level.raceVersion = VERSION;
        const validation = solve(level);
        if (validation.valid && acceptable(validation.metrics, p)) return level;
    }
    const result = JSON.parse(JSON.stringify((kind === 'daily' ? require("src/race/daily-fallbacks.js") : require("src/race/fallbacks.js"))[round - 1]));
    result.lifeLimit = null; result.seed = seed; result.raceVersion = VERSION;
    if (!solve(result).valid || !acceptable(solve(result).metrics, p) || result.width !== p.size) throw Error('Invalid race fallback');
    return result;
}
function generateRound(periodKey, round, options) { const task = courseRoundSteps(periodKey, round, options); let r; do { r = task.next(); } while (!r.done); return r.value; }
async function generateCourse(periodKey) {
    const levels = [];
    for (let n = 1; n <= ROUNDS; n++) {
        const task = courseRoundSteps(periodKey, n); let r, work = 0;
        do { r = task.next(); if (++work % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0)); } while (!r.done);
        levels.push(r.value);
    }
    return levels;
}
module.exports = { profile, generateRound, generateCourse };

},
"src/race/daily-fallbacks.js":function(module,exports,require){
'use strict';
module.exports=[{"number":1,"width":12,"height":12,"seed":106001,"generatorVersion":4,"profileVersion":8,"lifeLimit":null,"arrows":[{"id":"a0","path":[[1,1],[2,1],[2,0]],"direction":"up"},{"id":"a1","path":[[5,6],[4,6],[4,5],[3,5],[3,4],[3,3],[2,3],[2,2]],"direction":"up"},{"id":"a2","path":[[0,5],[1,5],[2,5],[2,4]],"direction":"up"},{"id":"a3","path":[[6,2],[7,2],[7,3],[6,3],[6,4],[6,5],[5,5]],"direction":"left"},{"id":"a4","path":[[4,7],[5,7],[6,7],[6,6],[7,6],[8,6],[8,5],[7,5]],"direction":"left"},{"id":"a5","path":[[10,7],[10,6],[10,5],[9,5]],"direction":"left"},{"id":"a6","path":[[2,9],[2,8],[2,7],[2,6]],"direction":"up"},{"id":"a7","path":[[0,11],[0,10],[1,10],[1,11],[2,11],[2,10]],"direction":"up"},{"id":"a8","path":[[1,7],[1,6],[0,6],[0,7],[0,8],[0,9]],"direction":"down"},{"id":"a9","path":[[1,4],[1,3],[0,3],[0,4]],"direction":"down"},{"id":"a10","path":[[5,3],[5,4],[4,4]],"direction":"left"},{"id":"a11","path":[[9,3],[8,3],[8,4],[7,4]],"direction":"left"},{"id":"a12","path":[[11,1],[11,2],[11,3],[11,4],[10,4],[9,4]],"direction":"left"},{"id":"a13","path":[[9,2],[9,1],[10,1]],"direction":"right"},{"id":"a14","path":[[4,9],[5,9],[5,10],[4,10],[3,10]],"direction":"left"},{"id":"a15","path":[[5,11],[6,11],[7,11],[8,11],[8,10],[7,10],[6,10]],"direction":"left"},{"id":"a16","path":[[7,8],[7,9]],"direction":"down"},{"id":"a17","path":[[1,8],[1,9]],"direction":"down"},{"id":"a18","path":[[5,8],[6,8],[6,9]],"direction":"down"},{"id":"a19","path":[[7,0],[6,0],[5,0],[5,1],[5,2]],"direction":"down"},{"id":"a20","path":[[8,8],[9,8],[10,8],[10,9],[10,10],[9,10]],"direction":"left"},{"id":"a21","path":[[4,11],[3,11]],"direction":"left"},{"id":"a22","path":[[11,7],[11,8],[11,9],[11,10],[11,11],[10,11],[9,11]],"direction":"left"},{"id":"a23","path":[[8,9],[9,9]],"direction":"right"},{"id":"a24","path":[[9,6],[9,7]],"direction":"down"},{"id":"a25","path":[[7,7],[8,7]],"direction":"right"},{"id":"a26","path":[[11,0],[10,0],[9,0],[8,0],[8,1],[8,2]],"direction":"down"},{"id":"a27","path":[[4,1],[3,1],[3,0],[4,0]],"direction":"right"},{"id":"a28","path":[[1,2],[0,2],[0,1],[0,0],[1,0]],"direction":"right"},{"id":"a29","path":[[7,1],[6,1]],"direction":"left"},{"id":"a30","path":[[11,6],[11,5]],"direction":"up"},{"id":"a31","path":[[3,9],[3,8],[4,8]],"direction":"right"},{"id":"a32","path":[[3,2],[4,2],[4,3]],"direction":"down"},{"id":"a33","path":[[3,7],[3,6]],"direction":"up"},{"id":"a34","path":[[10,3],[10,2]],"direction":"up"}],"timeLimitMs":null,"obstacles":[],"raceVersion":1670901867},{"number":2,"width":13,"height":13,"seed":108000,"generatorVersion":4,"profileVersion":8,"lifeLimit":null,"arrows":[{"id":"a0","path":[[1,1],[0,1],[0,2],[0,3],[1,3],[1,4],[0,4]],"direction":"left"},{"id":"a1","path":[[5,0],[5,1],[5,2],[5,3],[4,3],[4,4],[3,4],[3,3],[2,3]],"direction":"left"},{"id":"a2","path":[[7,2],[7,3],[6,3]],"direction":"left"},{"id":"a3","path":[[10,3],[9,3],[8,3]],"direction":"left"},{"id":"a4","path":[[12,4],[12,3],[11,3]],"direction":"left"},{"id":"a5","path":[[12,6],[12,5],[11,5],[10,5],[10,4],[11,4]],"direction":"right"},{"id":"a6","path":[[7,6],[8,6],[9,6],[10,6],[11,6]],"direction":"right"},{"id":"a7","path":[[6,9],[5,9],[5,8],[5,7],[4,7],[4,6],[5,6],[6,6]],"direction":"right"},{"id":"a8","path":[[0,5],[0,6],[1,6],[2,6],[3,6]],"direction":"right"},{"id":"a9","path":[[6,4],[6,5],[7,5],[7,4],[8,4],[9,4]],"direction":"right"},{"id":"a10","path":[[3,0],[3,1],[2,1]],"direction":"left"},{"id":"a11","path":[[4,0],[4,1],[4,2],[3,2],[2,2],[1,2]],"direction":"left"},{"id":"a12","path":[[3,5],[4,5],[5,5],[5,4]],"direction":"up"},{"id":"a13","path":[[6,10],[5,10],[4,10],[4,9],[4,8]],"direction":"up"},{"id":"a14","path":[[3,11],[3,12],[4,12],[4,11]],"direction":"up"},{"id":"a15","path":[[2,8],[3,8],[3,9],[3,10]],"direction":"down"},{"id":"a16","path":[[2,4],[2,5],[1,5]],"direction":"left"},{"id":"a17","path":[[9,5],[8,5]],"direction":"left"},{"id":"a18","path":[[6,11],[6,12],[5,12],[5,11]],"direction":"up"},{"id":"a19","path":[[7,7],[6,7],[6,8]],"direction":"down"},{"id":"a20","path":[[7,1],[6,1],[6,2]],"direction":"down"},{"id":"a21","path":[[9,0],[9,1],[9,2],[8,2]],"direction":"left"},{"id":"a22","path":[[11,0],[11,1],[11,2],[10,2]],"direction":"left"},{"id":"a23","path":[[12,12],[12,11],[11,11],[11,10],[11,9],[10,9],[10,8],[11,8],[11,7]],"direction":"up"},{"id":"a24","path":[[12,7],[12,8],[12,9],[12,10]],"direction":"down"},{"id":"a25","path":[[8,9],[9,9],[9,8],[9,7],[10,7]],"direction":"right"},{"id":"a26","path":[[8,12],[7,12],[7,11],[7,10],[8,10],[8,11],[9,11],[9,10]],"direction":"up"},{"id":"a27","path":[[8,7],[8,8],[7,8],[7,9]],"direction":"down"},{"id":"a28","path":[[0,9],[0,10],[1,10],[1,9],[2,9]],"direction":"right"},{"id":"a29","path":[[9,12],[10,12],[11,12]],"direction":"right"},{"id":"a30","path":[[10,10],[10,11]],"direction":"down"},{"id":"a31","path":[[10,0],[10,1]],"direction":"down"},{"id":"a32","path":[[1,7],[0,7],[0,8],[1,8]],"direction":"right"},{"id":"a33","path":[[3,7],[2,7]],"direction":"left"},{"id":"a34","path":[[12,0],[12,1],[12,2]],"direction":"down"},{"id":"a35","path":[[0,12],[1,12],[2,12]],"direction":"right"},{"id":"a36","path":[[2,10],[2,11]],"direction":"down"},{"id":"a37","path":[[0,11],[1,11]],"direction":"right"},{"id":"a38","path":[[6,0],[7,0],[8,0],[8,1]],"direction":"down"},{"id":"a39","path":[[0,0],[1,0],[2,0]],"direction":"right"}],"timeLimitMs":null,"obstacles":[],"raceVersion":1670901867},{"number":3,"width":14,"height":14,"seed":110002,"generatorVersion":4,"profileVersion":8,"lifeLimit":null,"arrows":[{"id":"a0","path":[[2,0],[1,0],[1,1],[0,1],[0,0]],"direction":"up"},{"id":"a1","path":[[2,3],[2,2],[2,1]],"direction":"up"},{"id":"a2","path":[[5,5],[4,5],[4,6],[3,6],[3,5],[2,5],[2,4]],"direction":"up"},{"id":"a3","path":[[1,11],[1,10],[0,10],[0,9],[1,9],[1,8],[2,8],[2,7],[2,6]],"direction":"up"},{"id":"a4","path":[[5,8],[6,8],[6,9],[5,9],[4,9],[4,10],[3,10],[3,9],[2,9]],"direction":"left"},{"id":"a5","path":[[1,12],[2,12],[2,11],[2,10]],"direction":"up"},{"id":"a6","path":[[7,10],[6,10],[5,10]],"direction":"left"},{"id":"a7","path":[[8,9],[9,9],[9,10],[8,10]],"direction":"left"},{"id":"a8","path":[[11,9],[11,10],[10,10]],"direction":"left"},{"id":"a9","path":[[13,6],[13,7],[13,8],[12,8],[12,9],[13,9],[13,10],[12,10]],"direction":"left"},{"id":"a10","path":[[10,9],[10,8],[11,8]],"direction":"right"},{"id":"a11","path":[[7,9],[7,8],[8,8],[9,8]],"direction":"right"},{"id":"a12","path":[[5,6],[5,7],[4,7],[3,7],[3,8],[4,8]],"direction":"right"},{"id":"a13","path":[[0,2],[0,3],[1,3],[1,2]],"direction":"up"},{"id":"a14","path":[[0,8],[0,7],[0,6],[0,5],[0,4]],"direction":"up"},{"id":"a15","path":[[1,13],[0,13],[0,12],[0,11]],"direction":"up"},{"id":"a16","path":[[4,12],[3,12]],"direction":"left"},{"id":"a17","path":[[3,11],[4,11],[5,11],[6,11],[6,12],[5,12]],"direction":"left"},{"id":"a18","path":[[8,12],[8,11],[7,11]],"direction":"left"},{"id":"a19","path":[[12,11],[12,12],[11,12],[11,11],[10,11],[9,11]],"direction":"left"},{"id":"a20","path":[[4,1],[4,0],[3,0]],"direction":"left"},{"id":"a21","path":[[3,1],[3,2],[3,3],[4,3],[4,2]],"direction":"up"},{"id":"a22","path":[[5,0],[6,0],[6,1],[5,1]],"direction":"left"},{"id":"a23","path":[[9,0],[8,0],[7,0]],"direction":"left"},{"id":"a24","path":[[9,5],[9,4],[9,3],[10,3],[10,2],[9,2],[8,2],[8,1]],"direction":"up"},{"id":"a25","path":[[7,6],[8,6],[8,5],[7,5],[7,4],[8,4],[8,3]],"direction":"up"},{"id":"a26","path":[[1,4],[1,5],[1,6],[1,7]],"direction":"down"},{"id":"a27","path":[[6,2],[6,3],[6,4],[5,4],[4,4],[3,4]],"direction":"left"},{"id":"a28","path":[[9,7],[8,7],[7,7],[6,7],[6,6],[6,5]],"direction":"up"},{"id":"a29","path":[[11,6],[11,7],[10,7]],"direction":"left"},{"id":"a30","path":[[5,3],[5,2]],"direction":"up"},{"id":"a31","path":[[7,3],[7,2],[7,1]],"direction":"up"},{"id":"a32","path":[[11,1],[11,0],[12,0],[13,0],[13,1],[12,1],[12,2],[11,2]],"direction":"left"},{"id":"a33","path":[[12,5],[12,4],[12,3]],"direction":"up"},{"id":"a34","path":[[12,7],[12,6]],"direction":"up"},{"id":"a35","path":[[9,6],[10,6]],"direction":"right"},{"id":"a36","path":[[10,4],[10,5],[11,5],[11,4],[11,3]],"direction":"up"},{"id":"a37","path":[[4,13],[3,13],[2,13]],"direction":"left"},{"id":"a38","path":[[6,13],[5,13]],"direction":"left"},{"id":"a39","path":[[10,0],[10,1],[9,1]],"direction":"left"},{"id":"a40","path":[[10,13],[10,12]],"direction":"up"},{"id":"a41","path":[[7,12],[7,13],[8,13],[9,13],[9,12]],"direction":"up"},{"id":"a42","path":[[13,13],[12,13],[11,13]],"direction":"left"},{"id":"a43","path":[[13,11],[13,12]],"direction":"down"},{"id":"a44","path":[[13,2],[13,3],[13,4],[13,5]],"direction":"down"}],"timeLimitMs":null,"obstacles":[],"raceVersion":1670901867},{"number":4,"width":15,"height":15,"seed":112001,"generatorVersion":4,"profileVersion":8,"lifeLimit":null,"arrows":[{"id":"a0","path":[[12,3],[12,2],[13,2],[14,2]],"direction":"right"},{"id":"a1","path":[[10,3],[10,2],[11,2]],"direction":"right"},{"id":"a2","path":[[10,4],[9,4],[9,3],[8,3],[8,2],[9,2]],"direction":"right"},{"id":"a3","path":[[5,0],[5,1],[5,2],[6,2],[7,2]],"direction":"right"},{"id":"a4","path":[[3,4],[4,4],[5,4],[5,3]],"direction":"up"},{"id":"a5","path":[[5,7],[6,7],[6,8],[5,8],[4,8],[4,7],[4,6],[5,6],[5,5]],"direction":"up"},{"id":"a6","path":[[5,11],[5,10],[5,9]],"direction":"up"},{"id":"a7","path":[[6,12],[6,13],[5,13],[5,12]],"direction":"up"},{"id":"a8","path":[[3,2],[4,2]],"direction":"right"},{"id":"a9","path":[[0,0],[0,1],[0,2],[1,2],[2,2]],"direction":"right"},{"id":"a10","path":[[0,5],[0,4],[0,3]],"direction":"up"},{"id":"a11","path":[[1,3],[2,3],[2,4],[1,4]],"direction":"left"},{"id":"a12","path":[[8,7],[9,7],[9,6],[9,5],[8,5],[8,4],[7,4],[6,4]],"direction":"left"},{"id":"a13","path":[[1,0],[2,0],[2,1],[1,1]],"direction":"left"},{"id":"a14","path":[[4,5],[3,5],[3,6],[2,6],[2,5]],"direction":"up"},{"id":"a15","path":[[3,11],[3,10],[4,10],[4,9],[3,9],[2,9],[2,8],[2,7]],"direction":"up"},{"id":"a16","path":[[0,6],[0,7],[0,8],[0,9],[0,10],[1,10],[1,11],[2,11],[2,10]],"direction":"up"},{"id":"a17","path":[[7,10],[6,10]],"direction":"left"},{"id":"a18","path":[[12,11],[11,11],[10,11],[10,10],[9,10],[8,10]],"direction":"left"},{"id":"a19","path":[[13,7],[12,7],[12,8],[12,9],[12,10],[11,10]],"direction":"left"},{"id":"a20","path":[[14,6],[14,7],[14,8],[13,8],[13,9],[14,9],[14,10],[13,10]],"direction":"left"},{"id":"a21","path":[[13,4],[13,5],[13,6],[12,6],[11,6],[10,6],[10,7],[11,7]],"direction":"right"},{"id":"a22","path":[[7,5],[6,5],[6,6],[7,6],[8,6]],"direction":"right"},{"id":"a23","path":[[3,0],[4,0],[4,1],[3,1]],"direction":"left"},{"id":"a24","path":[[7,0],[6,0]],"direction":"left"},{"id":"a25","path":[[8,1],[9,1],[10,1],[10,0],[9,0],[8,0]],"direction":"left"},{"id":"a26","path":[[6,9],[7,9],[8,9],[8,8]],"direction":"up"},{"id":"a27","path":[[9,13],[8,13],[7,13],[7,12],[8,12],[8,11]],"direction":"up"},{"id":"a28","path":[[1,13],[2,13],[2,12]],"direction":"up"},{"id":"a29","path":[[1,9],[1,8],[1,7],[1,6],[1,5]],"direction":"up"},{"id":"a30","path":[[11,3],[11,4],[12,4],[12,5],[11,5],[10,5]],"direction":"left"},{"id":"a31","path":[[9,8],[9,9],[10,9],[10,8]],"direction":"up"},{"id":"a32","path":[[12,12],[11,12],[11,13],[10,13],[10,12],[9,12],[9,11]],"direction":"up"},{"id":"a33","path":[[7,1],[6,1]],"direction":"left"},{"id":"a34","path":[[12,1],[11,1]],"direction":"left"},{"id":"a35","path":[[13,0],[14,0],[14,1],[13,1]],"direction":"left"},{"id":"a36","path":[[11,0],[12,0]],"direction":"right"},{"id":"a37","path":[[11,9],[11,8]],"direction":"up"},{"id":"a38","path":[[4,3],[3,3]],"direction":"left"},{"id":"a39","path":[[3,8],[3,7]],"direction":"up"},{"id":"a40","path":[[4,11],[4,12],[4,13],[3,13],[3,12]],"direction":"up"},{"id":"a41","path":[[13,11],[14,11],[14,12],[14,13],[14,14],[13,14],[12,14],[12,13]],"direction":"up"},{"id":"a42","path":[[13,3],[14,3],[14,4],[14,5]],"direction":"down"},{"id":"a43","path":[[13,13],[13,12]],"direction":"up"},{"id":"a44","path":[[0,11],[0,12],[1,12]],"direction":"right"},{"id":"a45","path":[[2,14],[1,14],[0,14],[0,13]],"direction":"up"},{"id":"a46","path":[[11,14],[10,14],[9,14],[8,14],[7,14],[6,14],[5,14],[4,14],[3,14]],"direction":"left"},{"id":"a47","path":[[7,3],[6,3]],"direction":"left"},{"id":"a48","path":[[7,8],[7,7]],"direction":"up"},{"id":"a49","path":[[6,11],[7,11]],"direction":"right"}],"timeLimitMs":null,"obstacles":[],"raceVersion":1670901867},{"number":5,"width":16,"height":16,"seed":114002,"generatorVersion":4,"profileVersion":8,"lifeLimit":null,"arrows":[{"id":"a0","path":[[0,0],[0,1],[1,1],[1,0]],"direction":"up"},{"id":"a1","path":[[3,2],[3,1],[3,0],[2,0]],"direction":"left"},{"id":"a2","path":[[4,4],[3,4],[3,3],[4,3],[4,2],[4,1],[5,1],[5,0],[4,0]],"direction":"left"},{"id":"a3","path":[[10,4],[9,4],[9,3],[8,3],[7,3],[7,2],[7,1],[7,0],[6,0]],"direction":"left"},{"id":"a4","path":[[6,3],[5,3],[5,2],[6,2],[6,1]],"direction":"up"},{"id":"a5","path":[[6,4],[7,4],[7,5],[6,5],[5,5],[5,4]],"direction":"up"},{"id":"a6","path":[[7,8],[7,7],[8,7],[8,6],[7,6],[6,6],[6,7],[5,7],[5,6]],"direction":"up"},{"id":"a7","path":[[6,10],[6,11],[5,11],[5,10],[5,9],[5,8]],"direction":"up"},{"id":"a8","path":[[4,13],[5,13],[5,12]],"direction":"up"},{"id":"a9","path":[[0,15],[1,15],[2,15],[3,15],[4,15],[5,15],[5,14]],"direction":"up"},{"id":"a10","path":[[0,13],[1,13],[2,13],[2,14]],"direction":"down"},{"id":"a11","path":[[1,12],[1,11],[2,11],[2,12]],"direction":"down"},{"id":"a12","path":[[1,7],[2,7],[2,8],[1,8],[1,9],[2,9],[2,10]],"direction":"down"},{"id":"a13","path":[[2,3],[2,4],[2,5],[2,6]],"direction":"down"},{"id":"a14","path":[[2,1],[2,2]],"direction":"down"},{"id":"a15","path":[[8,2],[9,2],[9,1],[8,1]],"direction":"left"},{"id":"a16","path":[[11,3],[10,3],[10,2],[11,2],[11,1],[10,1]],"direction":"left"},{"id":"a17","path":[[15,2],[14,2],[13,2],[13,1],[12,1]],"direction":"left"},{"id":"a18","path":[[12,0],[13,0],[14,0],[15,0],[15,1],[14,1]],"direction":"left"},{"id":"a19","path":[[13,3],[13,4],[13,5],[12,5],[12,4],[12,3],[12,2]],"direction":"up"},{"id":"a20","path":[[11,7],[11,8],[12,8],[12,7],[12,6]],"direction":"up"},{"id":"a21","path":[[10,11],[11,11],[12,11],[12,10],[12,9]],"direction":"up"},{"id":"a22","path":[[11,12],[11,13],[12,13],[12,12]],"direction":"up"},{"id":"a23","path":[[11,14],[11,15],[12,15],[12,14]],"direction":"up"},{"id":"a24","path":[[10,10],[10,9],[11,9],[11,10]],"direction":"down"},{"id":"a25","path":[[14,3],[14,4],[15,4],[15,3]],"direction":"up"},{"id":"a26","path":[[15,11],[15,10],[15,9],[15,8],[15,7],[15,6],[15,5]],"direction":"up"},{"id":"a27","path":[[14,9],[14,10],[14,11],[13,11],[13,10],[13,9],[13,8],[14,8]],"direction":"right"},{"id":"a28","path":[[8,12],[9,12],[9,11],[9,10],[9,9],[9,8],[10,8]],"direction":"right"},{"id":"a29","path":[[7,10],[8,10]],"direction":"right"},{"id":"a30","path":[[3,8],[4,8],[4,9],[3,9],[3,10],[4,10]],"direction":"right"},{"id":"a31","path":[[0,12],[0,11],[0,10],[1,10]],"direction":"right"},{"id":"a32","path":[[4,14],[3,14],[3,13],[3,12],[4,12],[4,11],[3,11]],"direction":"left"},{"id":"a33","path":[[3,7],[3,6],[3,5],[4,5],[4,6],[4,7]],"direction":"down"},{"id":"a34","path":[[0,3],[0,2],[1,2]],"direction":"right"},{"id":"a35","path":[[0,5],[0,4],[1,4],[1,3]],"direction":"up"},{"id":"a36","path":[[0,7],[0,6],[1,6],[1,5]],"direction":"up"},{"id":"a37","path":[[11,6],[10,6],[9,6]],"direction":"left"},{"id":"a38","path":[[11,4],[11,5]],"direction":"down"},{"id":"a39","path":[[11,0],[10,0],[9,0],[8,0]],"direction":"left"},{"id":"a40","path":[[8,5],[8,4]],"direction":"up"},{"id":"a41","path":[[6,8],[6,9],[7,9],[8,9],[8,8]],"direction":"up"},{"id":"a42","path":[[8,13],[7,13],[6,13],[6,12]],"direction":"up"},{"id":"a43","path":[[8,15],[7,15],[6,15],[6,14]],"direction":"up"},{"id":"a44","path":[[10,12],[10,13],[9,13],[9,14],[10,14],[10,15],[9,15]],"direction":"left"},{"id":"a45","path":[[14,14],[14,15],[13,15]],"direction":"left"},{"id":"a46","path":[[15,12],[14,12],[13,12],[13,13],[13,14]],"direction":"down"},{"id":"a47","path":[[13,6],[13,7]],"direction":"down"},{"id":"a48","path":[[15,15],[15,14],[15,13],[14,13]],"direction":"left"},{"id":"a49","path":[[7,14],[8,14]],"direction":"right"},{"id":"a50","path":[[8,11],[7,11],[7,12]],"direction":"down"},{"id":"a51","path":[[10,5],[9,5]],"direction":"left"},{"id":"a52","path":[[10,7],[9,7]],"direction":"left"},{"id":"a53","path":[[14,5],[14,6],[14,7]],"direction":"down"},{"id":"a54","path":[[0,9],[0,8]],"direction":"up"},{"id":"a55","path":[[0,14],[1,14]],"direction":"right"}],"timeLimitMs":null,"obstacles":[],"raceVersion":1670901867}];

},
"src/race/fallbacks.js":function(module,exports,require){
'use strict';
module.exports=[{"number":1,"width":14,"height":14,"seed":85000,"generatorVersion":4,"profileVersion":8,"lifeLimit":null,"arrows":[{"id":"a0","path":[[6,12],[7,12],[7,11],[8,11],[8,12],[8,13]],"direction":"down"},{"id":"a1","path":[[7,8],[8,8],[8,9],[8,10]],"direction":"down"},{"id":"a2","path":[[5,5],[6,5],[6,6],[7,6],[8,6],[8,7]],"direction":"down"},{"id":"a3","path":[[7,5],[7,4],[8,4],[8,5]],"direction":"down"},{"id":"a4","path":[[7,0],[7,1],[7,2],[8,2],[8,3]],"direction":"down"},{"id":"a5","path":[[12,1],[13,1],[13,0],[12,0],[11,0],[10,0],[9,0],[8,0],[8,1]],"direction":"down"},{"id":"a6","path":[[11,5],[11,4],[11,3],[12,3],[12,2]],"direction":"up"},{"id":"a7","path":[[11,6],[12,6],[13,6],[13,5],[12,5],[12,4]],"direction":"up"},{"id":"a8","path":[[10,3],[10,4],[10,5],[9,5],[9,6],[10,6]],"direction":"right"},{"id":"a9","path":[[3,4],[3,5],[2,5],[2,6],[3,6],[4,6],[5,6]],"direction":"right"},{"id":"a10","path":[[1,7],[0,7],[0,6],[1,6]],"direction":"right"},{"id":"a11","path":[[3,8],[4,8],[4,7],[3,7],[2,7]],"direction":"left"},{"id":"a12","path":[[9,1],[9,2],[10,2],[10,1]],"direction":"up"},{"id":"a13","path":[[10,8],[10,7]],"direction":"up"},{"id":"a14","path":[[9,10],[10,10],[10,9]],"direction":"up"},{"id":"a15","path":[[11,13],[10,13],[10,12],[10,11]],"direction":"up"},{"id":"a16","path":[[11,9],[11,10],[11,11],[11,12]],"direction":"down"},{"id":"a17","path":[[13,9],[12,9],[12,8],[12,7],[11,7],[11,8]],"direction":"down"},{"id":"a18","path":[[11,1],[11,2]],"direction":"down"},{"id":"a19","path":[[5,3],[5,2],[5,1],[6,1]],"direction":"right"},{"id":"a20","path":[[3,0],[2,0],[2,1],[3,1],[4,1]],"direction":"right"},{"id":"a21","path":[[1,0],[0,0],[0,1],[1,1]],"direction":"right"},{"id":"a22","path":[[1,4],[0,4],[0,3],[0,2]],"direction":"up"},{"id":"a23","path":[[4,2],[4,3],[3,3],[3,2],[2,2],[1,2]],"direction":"left"},{"id":"a24","path":[[3,13],[3,12],[4,12],[5,12],[5,11],[5,10],[4,10],[3,10],[3,9]],"direction":"up"},{"id":"a25","path":[[2,4],[2,3],[1,3]],"direction":"left"},{"id":"a26","path":[[0,12],[0,11],[1,11],[2,11],[2,10],[2,9],[2,8]],"direction":"up"},{"id":"a27","path":[[2,13],[2,12]],"direction":"up"},{"id":"a28","path":[[13,10],[13,11],[13,12],[13,13],[12,13],[12,12],[12,11],[12,10]],"direction":"up"},{"id":"a29","path":[[6,11],[6,10],[7,10]],"direction":"right"},{"id":"a30","path":[[1,9],[0,9],[0,10],[1,10]],"direction":"right"},{"id":"a31","path":[[5,7],[5,8],[5,9],[4,9]],"direction":"left"},{"id":"a32","path":[[7,9],[6,9]],"direction":"left"},{"id":"a33","path":[[13,7],[13,8]],"direction":"down"},{"id":"a34","path":[[13,2],[13,3],[13,4]],"direction":"down"},{"id":"a35","path":[[4,0],[5,0],[6,0]],"direction":"right"},{"id":"a36","path":[[4,5],[4,4]],"direction":"up"},{"id":"a37","path":[[0,5],[1,5]],"direction":"right"},{"id":"a38","path":[[7,3],[6,3],[6,2]],"direction":"up"},{"id":"a39","path":[[6,4],[5,4]],"direction":"left"},{"id":"a40","path":[[9,4],[9,3]],"direction":"up"},{"id":"a41","path":[[9,9],[9,8],[9,7]],"direction":"up"},{"id":"a42","path":[[9,13],[9,12],[9,11]],"direction":"up"},{"id":"a43","path":[[4,13],[5,13],[6,13],[7,13]],"direction":"right"},{"id":"a44","path":[[7,7],[6,7],[6,8]],"direction":"down"},{"id":"a45","path":[[0,8],[1,8]],"direction":"right"},{"id":"a46","path":[[0,13],[1,13],[1,12]],"direction":"up"},{"id":"a47","path":[[3,11],[4,11]],"direction":"right"}],"timeLimitMs":null,"obstacles":[],"raceVersion":1670901867},{"number":2,"width":15,"height":15,"seed":87000,"generatorVersion":4,"profileVersion":8,"lifeLimit":null,"arrows":[{"id":"a0","path":[[13,2],[13,1],[13,0],[14,0]],"direction":"right"},{"id":"a1","path":[[13,4],[14,4],[14,3],[14,2],[14,1]],"direction":"up"},{"id":"a2","path":[[14,7],[14,6],[14,5]],"direction":"up"},{"id":"a3","path":[[12,8],[12,9],[13,9],[13,10],[14,10],[14,9],[14,8]],"direction":"up"},{"id":"a4","path":[[11,12],[10,12],[10,11],[10,10],[10,9],[11,9]],"direction":"right"},{"id":"a5","path":[[8,7],[9,7],[9,8],[8,8],[8,9],[9,9]],"direction":"right"},{"id":"a6","path":[[7,10],[6,10],[6,9],[7,9]],"direction":"right"},{"id":"a7","path":[[2,5],[2,6],[3,6],[3,7],[3,8],[3,9],[4,9],[5,9]],"direction":"right"},{"id":"a8","path":[[1,11],[1,10],[1,9],[2,9]],"direction":"right"},{"id":"a9","path":[[14,14],[14,13],[14,12],[14,11]],"direction":"up"},{"id":"a10","path":[[10,14],[11,14],[11,13],[12,13],[12,14],[13,14]],"direction":"right"},{"id":"a11","path":[[8,13],[8,14],[9,14]],"direction":"right"},{"id":"a12","path":[[7,13],[7,12],[7,11],[8,11],[8,12]],"direction":"down"},{"id":"a13","path":[[4,13],[5,13],[6,13],[6,14],[7,14]],"direction":"right"},{"id":"a14","path":[[7,5],[7,4],[8,4],[8,5],[8,6],[7,6],[7,7],[7,8]],"direction":"down"},{"id":"a15","path":[[8,2],[7,2],[7,3]],"direction":"down"},{"id":"a16","path":[[9,1],[8,1],[8,0],[7,0],[7,1]],"direction":"down"},{"id":"a17","path":[[12,12],[12,11],[11,11],[11,10],[12,10]],"direction":"right"},{"id":"a18","path":[[12,7],[11,7],[11,8]],"direction":"down"},{"id":"a19","path":[[11,4],[12,4],[12,5],[12,6]],"direction":"down"},{"id":"a20","path":[[10,5],[10,6],[9,6],[9,5],[9,4],[10,4]],"direction":"right"},{"id":"a21","path":[[6,2],[6,3],[5,3],[4,3],[4,4],[5,4],[6,4]],"direction":"right"},{"id":"a22","path":[[2,1],[2,2],[2,3],[2,4],[3,4]],"direction":"right"},{"id":"a23","path":[[1,0],[0,0],[0,1],[0,2],[0,3],[0,4],[1,4]],"direction":"right"},{"id":"a24","path":[[2,7],[1,7],[0,7],[0,6],[0,5]],"direction":"up"},{"id":"a25","path":[[4,8],[5,8],[5,7],[4,7]],"direction":"left"},{"id":"a26","path":[[11,0],[12,0]],"direction":"right"},{"id":"a27","path":[[9,0],[10,0],[10,1],[10,2],[11,2],[11,1]],"direction":"up"},{"id":"a28","path":[[5,0],[6,0]],"direction":"right"},{"id":"a29","path":[[3,1],[3,0],[2,0]],"direction":"left"},{"id":"a30","path":[[3,3],[3,2]],"direction":"up"},{"id":"a31","path":[[1,13],[1,12],[0,12],[0,11],[0,10],[0,9],[0,8]],"direction":"up"},{"id":"a32","path":[[2,8],[1,8]],"direction":"left"},{"id":"a33","path":[[3,11],[3,10],[4,10],[4,11],[4,12],[3,12],[2,12],[2,11],[2,10]],"direction":"up"},{"id":"a34","path":[[5,10],[5,11],[6,11],[6,12],[5,12]],"direction":"left"},{"id":"a35","path":[[10,13],[9,13],[9,12],[9,11],[9,10],[8,10]],"direction":"left"},{"id":"a36","path":[[10,7],[10,8]],"direction":"down"},{"id":"a37","path":[[13,11],[13,12],[13,13]],"direction":"down"},{"id":"a38","path":[[3,14],[2,14],[2,13],[3,13]],"direction":"right"},{"id":"a39","path":[[4,14],[5,14]],"direction":"right"},{"id":"a40","path":[[0,13],[0,14],[1,14]],"direction":"right"},{"id":"a41","path":[[1,5],[1,6]],"direction":"down"},{"id":"a42","path":[[6,5],[5,5],[5,6],[4,6],[4,5],[3,5]],"direction":"left"},{"id":"a43","path":[[12,1],[12,2],[12,3],[13,3]],"direction":"right"},{"id":"a44","path":[[10,3],[11,3]],"direction":"right"},{"id":"a45","path":[[11,6],[11,5]],"direction":"up"},{"id":"a46","path":[[8,3],[9,3],[9,2]],"direction":"up"},{"id":"a47","path":[[4,2],[5,2]],"direction":"right"},{"id":"a48","path":[[4,0],[4,1]],"direction":"down"},{"id":"a49","path":[[6,6],[6,7],[6,8]],"direction":"down"},{"id":"a50","path":[[1,3],[1,2],[1,1]],"direction":"up"},{"id":"a51","path":[[6,1],[5,1]],"direction":"left"},{"id":"a52","path":[[13,5],[13,6],[13,7],[13,8]],"direction":"down"}],"timeLimitMs":null,"obstacles":[],"raceVersion":1670901867},{"number":3,"width":17,"height":17,"seed":89002,"generatorVersion":4,"profileVersion":8,"lifeLimit":null,"arrows":[{"id":"a0","path":[[16,5],[15,5],[15,4],[16,4]],"direction":"right"},{"id":"a1","path":[[11,5],[12,5],[13,5],[14,5]],"direction":"right"},{"id":"a2","path":[[9,8],[10,8],[10,7],[9,7],[9,6],[9,5],[10,5]],"direction":"right"},{"id":"a3","path":[[9,3],[8,3],[7,3],[7,4],[7,5],[8,5]],"direction":"right"},{"id":"a4","path":[[5,6],[5,5],[6,5]],"direction":"right"},{"id":"a5","path":[[1,8],[2,8],[3,8],[3,7],[3,6],[3,5],[4,5]],"direction":"right"},{"id":"a6","path":[[0,7],[0,6],[0,5],[1,5],[2,5]],"direction":"right"},{"id":"a7","path":[[1,7],[2,7],[2,6],[1,6]],"direction":"left"},{"id":"a8","path":[[13,2],[13,3],[13,4],[14,4]],"direction":"right"},{"id":"a9","path":[[8,4],[9,4],[10,4],[11,4],[12,4]],"direction":"right"},{"id":"a10","path":[[5,2],[5,3],[4,3],[4,4],[5,4],[6,4]],"direction":"right"},{"id":"a11","path":[[0,0],[0,1],[0,2],[0,3],[0,4],[1,4],[2,4],[3,4]],"direction":"right"},{"id":"a12","path":[[6,0],[5,0],[5,1],[4,1],[4,0],[3,0],[2,0],[1,0]],"direction":"left"},{"id":"a13","path":[[2,2],[2,1]],"direction":"up"},{"id":"a14","path":[[9,0],[9,1],[8,1],[8,0],[7,0]],"direction":"left"},{"id":"a15","path":[[9,2],[8,2],[7,2],[7,1]],"direction":"up"},{"id":"a16","path":[[7,7],[7,6]],"direction":"up"},{"id":"a17","path":[[9,10],[8,10],[7,10],[7,9],[7,8]],"direction":"up"},{"id":"a18","path":[[10,9],[10,10],[10,11],[10,12],[9,12],[8,12],[7,12],[7,11]],"direction":"up"},{"id":"a19","path":[[9,13],[8,13],[8,14],[7,14],[7,13]],"direction":"up"},{"id":"a20","path":[[8,16],[7,16],[7,15]],"direction":"up"},{"id":"a21","path":[[8,8],[8,7],[8,6]],"direction":"up"},{"id":"a22","path":[[11,1],[11,0],[10,0]],"direction":"left"},{"id":"a23","path":[[11,2],[12,2],[12,3],[11,3],[10,3],[10,2],[10,1]],"direction":"up"},{"id":"a24","path":[[4,2],[3,2],[3,1]],"direction":"up"},{"id":"a25","path":[[6,6],[6,7],[5,7],[4,7],[4,6]],"direction":"up"},{"id":"a26","path":[[4,12],[5,12],[5,11],[5,10],[5,9],[5,8]],"direction":"up"},{"id":"a27","path":[[6,16],[5,16],[5,15],[4,15],[3,15],[3,14],[4,14],[5,14],[5,13]],"direction":"up"},{"id":"a28","path":[[6,10],[6,11],[6,12],[6,13],[6,14],[6,15]],"direction":"down"},{"id":"a29","path":[[6,8],[6,9]],"direction":"down"},{"id":"a30","path":[[6,1],[6,2],[6,3]],"direction":"down"},{"id":"a31","path":[[1,3],[1,2],[1,1]],"direction":"up"},{"id":"a32","path":[[16,2],[15,2],[14,2]],"direction":"left"},{"id":"a33","path":[[2,9],[3,9],[3,10],[4,10],[4,9],[4,8]],"direction":"up"},{"id":"a34","path":[[14,0],[15,0],[16,0],[16,1],[15,1],[14,1],[13,1],[12,1]],"direction":"left"},{"id":"a35","path":[[12,0],[13,0]],"direction":"right"},{"id":"a36","path":[[11,9],[12,9],[13,9],[13,8],[14,8],[14,7],[13,7],[13,6]],"direction":"up"},{"id":"a37","path":[[13,15],[12,15],[12,14],[12,13],[12,12],[13,12],[13,11],[13,10]],"direction":"up"},{"id":"a38","path":[[14,15],[14,14],[13,14],[13,13]],"direction":"up"},{"id":"a39","path":[[0,8],[0,9],[0,10],[0,11],[1,11],[1,10],[1,9]],"direction":"up"},{"id":"a40","path":[[1,15],[1,14],[1,13],[0,13],[0,12]],"direction":"up"},{"id":"a41","path":[[4,16],[3,16],[2,16],[1,16],[0,16],[0,15],[0,14]],"direction":"up"},{"id":"a42","path":[[9,14],[10,14],[10,15],[11,15],[11,16],[10,16],[9,16]],"direction":"left"},{"id":"a43","path":[[10,13],[11,13],[11,14]],"direction":"down"},{"id":"a44","path":[[12,11],[12,10],[11,10],[11,11],[11,12]],"direction":"down"},{"id":"a45","path":[[11,7],[11,8]],"direction":"down"},{"id":"a46","path":[[12,6],[11,6],[10,6]],"direction":"left"},{"id":"a47","path":[[15,9],[16,9],[16,8],[15,8],[15,7],[16,7],[16,6],[15,6],[14,6]],"direction":"left"},{"id":"a48","path":[[3,3],[2,3]],"direction":"left"},{"id":"a49","path":[[16,3],[15,3],[14,3]],"direction":"left"},{"id":"a50","path":[[14,11],[14,10],[14,9]],"direction":"up"},{"id":"a51","path":[[8,9],[9,9]],"direction":"right"},{"id":"a52","path":[[15,15],[15,14],[16,14],[16,13],[16,12],[15,12],[15,11],[15,10]],"direction":"up"},{"id":"a53","path":[[14,12],[14,13],[15,13]],"direction":"right"},{"id":"a54","path":[[2,15],[2,14],[2,13],[3,13],[4,13]],"direction":"right"},{"id":"a55","path":[[9,15],[8,15]],"direction":"left"},{"id":"a56","path":[[3,12],[2,12],[1,12]],"direction":"left"},{"id":"a57","path":[[2,10],[2,11]],"direction":"down"},{"id":"a58","path":[[4,11],[3,11]],"direction":"left"},{"id":"a59","path":[[9,11],[8,11]],"direction":"left"},{"id":"a60","path":[[16,15],[16,16],[15,16],[14,16],[13,16],[12,16]],"direction":"left"},{"id":"a61","path":[[12,7],[12,8]],"direction":"down"},{"id":"a62","path":[[16,11],[16,10]],"direction":"up"}],"timeLimitMs":null,"obstacles":[],"raceVersion":1670901867},{"number":4,"width":18,"height":18,"seed":91001,"generatorVersion":4,"profileVersion":8,"lifeLimit":null,"arrows":[{"id":"a0","path":[[17,15],[17,16],[17,17]],"direction":"down"},{"id":"a1","path":[[17,13],[17,14],[16,14],[16,15],[16,16],[15,16],[15,17],[16,17]],"direction":"right"},{"id":"a2","path":[[12,16],[12,15],[13,15],[14,15],[14,14],[15,14],[15,15]],"direction":"down"},{"id":"a3","path":[[12,11],[12,10],[13,10],[14,10],[14,11],[15,11],[15,12],[15,13]],"direction":"down"},{"id":"a4","path":[[16,11],[16,10],[16,9],[15,9],[15,10]],"direction":"down"},{"id":"a5","path":[[16,6],[15,6],[15,7],[15,8]],"direction":"down"},{"id":"a6","path":[[17,4],[16,4],[15,4],[15,5]],"direction":"down"},{"id":"a7","path":[[10,8],[10,7],[10,6],[10,5],[11,5],[11,4],[12,4],[13,4],[14,4]],"direction":"right"},{"id":"a8","path":[[7,5],[7,4],[8,4],[9,4],[10,4]],"direction":"right"},{"id":"a9","path":[[4,4],[5,4],[6,4]],"direction":"right"},{"id":"a10","path":[[2,3],[2,4],[3,4]],"direction":"right"},{"id":"a11","path":[[0,5],[0,4],[1,4]],"direction":"right"},{"id":"a12","path":[[0,8],[0,7],[0,6],[1,6],[1,7],[2,7],[2,6],[2,5],[1,5]],"direction":"left"},{"id":"a13","path":[[4,7],[4,6],[5,6],[5,5],[4,5],[3,5]],"direction":"left"},{"id":"a14","path":[[3,12],[3,11],[3,10],[2,10],[1,10],[1,9],[2,9],[2,8],[1,8]],"direction":"left"},{"id":"a15","path":[[5,7],[5,8],[4,8],[3,8]],"direction":"left"},{"id":"a16","path":[[9,9],[8,9],[8,8],[8,7],[7,7],[7,8],[6,8]],"direction":"left"},{"id":"a17","path":[[13,13],[12,13],[12,14],[13,14]],"direction":"right"},{"id":"a18","path":[[10,11],[9,11],[9,12],[8,12],[8,13],[8,14],[9,14],[10,14],[11,14]],"direction":"right"},{"id":"a19","path":[[5,14],[5,13],[6,13],[6,14],[7,14]],"direction":"right"},{"id":"a20","path":[[3,13],[2,13],[2,14],[3,14],[4,14]],"direction":"right"},{"id":"a21","path":[[1,16],[0,16],[0,15],[0,14],[1,14]],"direction":"right"},{"id":"a22","path":[[4,16],[3,16],[2,16]],"direction":"left"},{"id":"a23","path":[[6,17],[6,16],[5,16]],"direction":"left"},{"id":"a24","path":[[9,17],[9,16],[8,16],[7,16]],"direction":"left"},{"id":"a25","path":[[11,16],[10,16]],"direction":"left"},{"id":"a26","path":[[13,17],[14,17],[14,16],[13,16]],"direction":"left"},{"id":"a27","path":[[13,11],[13,12]],"direction":"down"},{"id":"a28","path":[[14,9],[14,8],[13,8],[13,9]],"direction":"down"},{"id":"a29","path":[[13,6],[13,7]],"direction":"down"},{"id":"a30","path":[[14,0],[15,0],[15,1],[15,2],[15,3]],"direction":"down"},{"id":"a31","path":[[13,3],[14,3],[14,2],[14,1]],"direction":"up"},{"id":"a32","path":[[14,7],[14,6],[14,5]],"direction":"up"},{"id":"a33","path":[[14,13],[14,12]],"direction":"up"},{"id":"a34","path":[[4,15],[3,15],[2,15],[1,15]],"direction":"left"},{"id":"a35","path":[[7,15],[6,15],[5,15]],"direction":"left"},{"id":"a36","path":[[4,10],[5,10],[6,10],[6,11],[6,12]],"direction":"down"},{"id":"a37","path":[[16,7],[16,8],[17,8],[17,9],[17,10],[17,11],[17,12],[16,12],[16,13]],"direction":"down"},{"id":"a38","path":[[7,10],[8,10],[9,10],[10,10],[10,9],[11,9],[12,9]],"direction":"right"},{"id":"a39","path":[[3,9],[4,9],[5,9],[6,9],[7,9]],"direction":"right"},{"id":"a40","path":[[6,5],[6,6],[6,7]],"direction":"down"},{"id":"a41","path":[[9,8],[9,7],[9,6],[9,5],[8,5]],"direction":"left"},{"id":"a42","path":[[13,5],[12,5]],"direction":"left"},{"id":"a43","path":[[11,2],[10,2],[10,1],[10,0],[11,0],[12,0],[13,0],[13,1],[13,2]],"direction":"down"},{"id":"a44","path":[[16,5],[17,5],[17,6],[17,7]],"direction":"down"},{"id":"a45","path":[[12,6],[11,6],[11,7],[12,7]],"direction":"right"},{"id":"a46","path":[[7,6],[8,6]],"direction":"right"},{"id":"a47","path":[[9,13],[10,13],[11,13]],"direction":"right"},{"id":"a48","path":[[7,3],[8,3],[9,3],[9,2],[8,2],[7,2],[6,2],[6,3]],"direction":"down"},{"id":"a49","path":[[9,1],[8,1],[7,1],[7,0],[6,0],[6,1]],"direction":"down"},{"id":"a50","path":[[12,8],[11,8]],"direction":"left"},{"id":"a51","path":[[8,15],[9,15],[10,15],[11,15]],"direction":"right"},{"id":"a52","path":[[17,2],[17,3]],"direction":"down"},{"id":"a53","path":[[16,1],[16,0],[17,0],[17,1]],"direction":"down"},{"id":"a54","path":[[11,1],[12,1]],"direction":"right"},{"id":"a55","path":[[10,3],[11,3],[12,3],[12,2]],"direction":"up"},{"id":"a56","path":[[11,11],[11,10]],"direction":"up"},{"id":"a57","path":[[7,13],[7,12],[7,11],[8,11]],"direction":"right"},{"id":"a58","path":[[4,11],[5,11]],"direction":"right"},{"id":"a59","path":[[0,11],[1,11],[2,11]],"direction":"right"},{"id":"a60","path":[[10,17],[11,17],[12,17]],"direction":"right"},{"id":"a61","path":[[7,17],[8,17]],"direction":"right"},{"id":"a62","path":[[3,17],[4,17],[5,17]],"direction":"right"},{"id":"a63","path":[[0,17],[1,17],[2,17]],"direction":"right"},{"id":"a64","path":[[2,12],[1,12],[1,13]],"direction":"down"},{"id":"a65","path":[[2,2],[2,1],[1,1],[1,2],[1,3]],"direction":"down"},{"id":"a66","path":[[5,0],[4,0],[4,1],[5,1]],"direction":"right"},{"id":"a67","path":[[3,1],[3,2],[3,3],[4,3],[4,2]],"direction":"up"},{"id":"a68","path":[[3,6],[3,7]],"direction":"down"},{"id":"a69","path":[[5,3],[5,2]],"direction":"up"},{"id":"a70","path":[[0,12],[0,13]],"direction":"down"},{"id":"a71","path":[[0,9],[0,10]],"direction":"down"},{"id":"a72","path":[[1,0],[0,0],[0,1],[0,2],[0,3]],"direction":"down"},{"id":"a73","path":[[3,0],[2,0]],"direction":"left"},{"id":"a74","path":[[9,0],[8,0]],"direction":"left"},{"id":"a75","path":[[16,3],[16,2]],"direction":"up"},{"id":"a76","path":[[10,12],[11,12],[12,12]],"direction":"right"},{"id":"a77","path":[[4,13],[4,12],[5,12]],"direction":"right"}],"timeLimitMs":null,"obstacles":[],"raceVersion":1670901867},{"number":5,"width":20,"height":20,"seed":93005,"generatorVersion":4,"profileVersion":8,"lifeLimit":null,"arrows":[{"id":"a0","path":[[19,1],[19,0],[18,0],[17,0],[17,1],[16,1],[16,0]],"direction":"up"},{"id":"a1","path":[[18,5],[18,6],[19,6],[19,5],[19,4],[19,3],[19,2]],"direction":"up"},{"id":"a2","path":[[18,4],[17,4],[17,3],[18,3]],"direction":"right"},{"id":"a3","path":[[14,2],[14,3],[15,3],[16,3]],"direction":"right"},{"id":"a4","path":[[11,5],[11,6],[12,6],[13,6],[13,5],[12,5],[12,4],[12,3],[13,3]],"direction":"right"},{"id":"a5","path":[[10,3],[11,3]],"direction":"right"},{"id":"a6","path":[[8,5],[7,5],[7,4],[7,3],[8,3],[9,3]],"direction":"right"},{"id":"a7","path":[[6,1],[7,1],[7,2],[6,2],[5,2],[5,3],[6,3]],"direction":"right"},{"id":"a8","path":[[1,1],[1,2],[1,3],[2,3],[3,3],[4,3]],"direction":"right"},{"id":"a9","path":[[13,7],[14,7],[14,6],[15,6],[16,6],[17,6]],"direction":"right"},{"id":"a10","path":[[9,9],[8,9],[8,8],[9,8],[9,7],[8,7],[8,6],[9,6],[10,6]],"direction":"right"},{"id":"a11","path":[[5,12],[5,11],[5,10],[5,9],[6,9],[6,8],[6,7],[6,6],[7,6]],"direction":"right"},{"id":"a12","path":[[4,7],[4,6],[5,6]],"direction":"right"},{"id":"a13","path":[[1,8],[0,8],[0,7],[0,6],[1,6],[1,5],[2,5],[2,6],[3,6]],"direction":"right"},{"id":"a14","path":[[3,7],[2,7],[1,7]],"direction":"left"},{"id":"a15","path":[[15,2],[16,2],[17,2],[18,2],[18,1]],"direction":"up"},{"id":"a16","path":[[15,0],[14,0],[13,0],[13,1],[14,1],[15,1]],"direction":"right"},{"id":"a17","path":[[10,0],[10,1],[11,1],[11,0],[12,0]],"direction":"right"},{"id":"a18","path":[[13,2],[12,2],[12,1]],"direction":"up"},{"id":"a19","path":[[11,2],[10,2],[9,2],[8,2],[8,1],[9,1]],"direction":"right"},{"id":"a20","path":[[7,0],[6,0],[5,0],[5,1],[4,1],[3,1],[3,2],[4,2]],"direction":"right"},{"id":"a21","path":[[4,4],[4,5],[5,5],[5,4]],"direction":"up"},{"id":"a22","path":[[4,8],[5,8],[5,7]],"direction":"up"},{"id":"a23","path":[[7,16],[7,17],[6,17],[6,16],[6,15],[5,15],[5,14],[5,13]],"direction":"up"},{"id":"a24","path":[[3,17],[3,18],[4,18],[4,17],[5,17],[5,16]],"direction":"up"},{"id":"a25","path":[[3,19],[4,19],[5,19],[5,18]],"direction":"up"},{"id":"a26","path":[[2,14],[2,15],[3,15],[4,15],[4,16]],"direction":"down"},{"id":"a27","path":[[4,13],[4,14]],"direction":"down"},{"id":"a28","path":[[2,11],[2,12],[3,12],[3,11],[4,11],[4,12]],"direction":"down"},{"id":"a29","path":[[0,10],[0,9],[1,9],[2,9],[2,8],[3,8],[3,9],[4,9],[4,10]],"direction":"down"},{"id":"a30","path":[[3,10],[2,10],[1,10]],"direction":"left"},{"id":"a31","path":[[7,12],[7,11],[8,11],[8,10],[7,10],[6,10]],"direction":"left"},{"id":"a32","path":[[10,9],[10,10],[9,10]],"direction":"left"},{"id":"a33","path":[[13,11],[13,12],[12,12],[12,11],[12,10],[11,10]],"direction":"left"},{"id":"a34","path":[[14,11],[14,10],[13,10]],"direction":"left"},{"id":"a35","path":[[18,9],[19,9],[19,10],[18,10],[17,10],[16,10],[15,10]],"direction":"left"},{"id":"a36","path":[[13,9],[13,8],[14,8],[14,9],[15,9],[16,9],[17,9]],"direction":"right"},{"id":"a37","path":[[11,8],[11,9],[12,9]],"direction":"right"},{"id":"a38","path":[[19,7],[19,8],[18,8],[18,7]],"direction":"up"},{"id":"a39","path":[[15,7],[15,8],[16,8],[17,8]],"direction":"right"},{"id":"a40","path":[[8,0],[9,0]],"direction":"right"},{"id":"a41","path":[[2,2],[2,1],[2,0],[3,0],[4,0]],"direction":"right"},{"id":"a42","path":[[3,5],[3,4]],"direction":"up"},{"id":"a43","path":[[3,14],[3,13]],"direction":"up"},{"id":"a44","path":[[6,5],[6,4]],"direction":"up"},{"id":"a45","path":[[7,13],[6,13],[6,12],[6,11]],"direction":"up"},{"id":"a46","path":[[15,5],[15,4],[16,4]],"direction":"right"},{"id":"a47","path":[[15,13],[14,13],[14,12],[15,12],[15,11]],"direction":"up"},{"id":"a48","path":[[13,14],[14,14],[14,15],[15,15],[15,14]],"direction":"up"},{"id":"a49","path":[[13,18],[14,18],[15,18],[15,17],[15,16]],"direction":"up"},{"id":"a50","path":[[7,9],[7,8],[7,7]],"direction":"up"},{"id":"a51","path":[[12,8],[12,7]],"direction":"up"},{"id":"a52","path":[[0,3],[0,2],[0,1],[0,0],[1,0]],"direction":"right"},{"id":"a53","path":[[0,5],[0,4]],"direction":"up"},{"id":"a54","path":[[0,13],[0,12],[0,11]],"direction":"up"},{"id":"a55","path":[[1,14],[1,15],[0,15],[0,14]],"direction":"up"},{"id":"a56","path":[[10,12],[9,12],[9,13],[9,14],[8,14],[7,14],[6,14]],"direction":"left"},{"id":"a57","path":[[12,15],[11,15],[11,14],[10,14]],"direction":"left"},{"id":"a58","path":[[3,16],[2,16],[1,16],[1,17],[0,17],[0,16]],"direction":"up"},{"id":"a59","path":[[2,19],[1,19],[0,19],[0,18]],"direction":"up"},{"id":"a60","path":[[7,19],[6,19]],"direction":"left"},{"id":"a61","path":[[12,16],[11,16],[11,17],[10,17],[9,17],[9,18],[9,19],[8,19]],"direction":"left"},{"id":"a62","path":[[9,15],[9,16]],"direction":"down"},{"id":"a63","path":[[2,17],[2,18],[1,18]],"direction":"left"},{"id":"a64","path":[[7,15],[8,15],[8,16],[8,17],[8,18],[7,18],[6,18]],"direction":"left"},{"id":"a65","path":[[10,19],[11,19],[11,18],[10,18]],"direction":"left"},{"id":"a66","path":[[10,15],[10,16]],"direction":"down"},{"id":"a67","path":[[16,12],[16,13],[17,13],[17,12],[18,12],[19,12],[19,11]],"direction":"up"},{"id":"a68","path":[[19,14],[19,13]],"direction":"up"},{"id":"a69","path":[[17,17],[18,17],[18,18],[19,18],[19,17],[19,16],[19,15]],"direction":"up"},{"id":"a70","path":[[14,19],[15,19],[16,19],[16,18],[16,17],[16,16],[17,16],[18,16]],"direction":"right"},{"id":"a71","path":[[18,13],[18,14],[18,15],[17,15],[17,14],[16,14],[16,15]],"direction":"down"},{"id":"a72","path":[[12,14],[12,13],[13,13]],"direction":"right"},{"id":"a73","path":[[10,13],[11,13]],"direction":"right"},{"id":"a74","path":[[9,11],[10,11],[11,11],[11,12]],"direction":"down"},{"id":"a75","path":[[11,7],[10,7],[10,8]],"direction":"down"},{"id":"a76","path":[[17,7],[16,7]],"direction":"left"},{"id":"a77","path":[[13,15],[13,16],[14,16],[14,17],[13,17],[12,17]],"direction":"left"},{"id":"a78","path":[[13,4],[14,4],[14,5]],"direction":"down"},{"id":"a79","path":[[10,4],[11,4]],"direction":"right"},{"id":"a80","path":[[8,4],[9,4]],"direction":"right"},{"id":"a81","path":[[8,13],[8,12]],"direction":"up"},{"id":"a82","path":[[1,11],[1,12],[1,13],[2,13]],"direction":"right"},{"id":"a83","path":[[18,11],[17,11],[16,11]],"direction":"left"},{"id":"a84","path":[[2,4],[1,4]],"direction":"left"},{"id":"a85","path":[[16,5],[17,5]],"direction":"right"},{"id":"a86","path":[[19,19],[18,19],[17,19],[17,18]],"direction":"up"},{"id":"a87","path":[[12,18],[12,19],[13,19]],"direction":"right"},{"id":"a88","path":[[9,5],[10,5]],"direction":"right"}],"timeLimitMs":null,"obstacles":[],"raceVersion":1670901867}];

},
"src/persistence/store.js":function(module,exports,require){
'use strict';
const { clone, validateLevel } = require("src/domain/board.js");
const { Session } = require("src/domain/session.js");
const { lifeLimit } = require("src/config.js");
const { solve } = require("src/generation/validate.js");
const KEY = 'arrow-garden.save.v1', BACKUP = KEY + '.backup';
function checksum(value) { let n = 2166136261; for (let i = 0; i < value.length; i++) {
    n ^= value.charCodeAt(i);
    n = Math.imul(n, 16777619);
} return (n >>> 0).toString(16); }
function snapshot(app) {
    if (app.mode !== 'campaign' && app.campaignSnapshot) return { ...clone(app.campaignSnapshot), settings: { ...app.settings }, inventory: { ...app.inventory } };
    let session = null;
    if (app.session) {
        const s = app.session, removed = [...new Set([...s.removed, ...s.moves.keys()])];
        session = { level: clone(s.level), removed, lives: s.lives, state: s.state === 'failed' ? 'failed' : removed.length === s.level.arrows.length ? 'won' : 'playing' };
        session.reviveDeclined = !!s.reviveDeclined;
        session.timeReviveDeclined = !!s.timeReviveDeclined;
        session.recordMs = s.recordMs; session.recordEligible = s.recordEligible && s.moves.size === 0;
        session.remainingMs = s.remainingMs;
        session.failureReason = s.failureReason;
        session.items = { ...s.items }; session.itemUses = { ...s.itemUses };
        session.restartLevel = clone(s.restartLevel);
    }
    return { campaignRevision: 3, rewardClaims: [...app.rewardClaims], levelBests: { ...app.levelBests }, version: 1, currentLevel: app.currentLevel, unlocked: Math.max(app.unlocked, session?.state === 'won' ? session.level.number + 1 : 1), settings: { ...app.settings }, inventory: { ...app.inventory }, tutorialDone: app.tutorialDone, lifeIntroDone: app.lifeIntroDone, challengeUnlockSeen: !!app.challengeUnlockSeen, raceUnlockSeen: !!app.raceUnlockSeen, session };
}
function validProgress(p) { return Number.isInteger(p) && p >= 1 && p < 1000000; }
function validate(data) {
    if (!data || data.version !== 1 || !validProgress(data.currentLevel) || !validProgress(data.unlocked) || typeof data.tutorialDone !== 'boolean' || typeof data.lifeIntroDone !== 'boolean' || typeof data.settings?.sound !== 'boolean' || typeof data.settings?.vibration !== 'boolean')
        return false;
    if (data.inventory && !['time', 'life', 'shuffle'].every(k => Number.isInteger(data.inventory[k]) && data.inventory[k] >= 0 && data.inventory[k] <= 10000000)) return false;
    if (data.rewardClaims !== undefined && (!Array.isArray(data.rewardClaims) || new Set(data.rewardClaims).size !== data.rewardClaims.length || !data.rewardClaims.every(validProgress))) return false;
    if (data.levelBests !== undefined && (!data.levelBests || typeof data.levelBests !== 'object' || Array.isArray(data.levelBests) || !Object.entries(data.levelBests).every(([k,v]) => /^\d+:\d+$/.test(k) && Number.isFinite(v) && v > 0))) return false;
    if (data.session === null)
        return true;
    const s = data.session;
    if (s?.recordMs !== undefined && (!Number.isFinite(s.recordMs) || s.recordMs < 0)) return false;
    if (s?.recordEligible !== undefined && typeof s.recordEligible !== 'boolean') return false;
    const items = s?.items || { time: 1, life: 1, shuffle: 1 };
    if (!['time', 'life', 'shuffle'].every(k => items[k] === 0 || items[k] === 1)) return false;
    const uses = s?.itemUses || Object.fromEntries(Object.entries(items).map(([k,v]) => [k, 1-v]));
    if (!['time', 'life', 'shuffle'].every(k => Number.isInteger(uses[k]) && uses[k] >= 0 && uses[k] <= 10000000)) return false;
    if (s?.restartLevel && (!validateLevel(s.restartLevel).valid || !solve(s.restartLevel).valid || s.restartLevel.number !== data.currentLevel)) return false;
    if (!s || !validateLevel(s.level).valid || !solve(s.level).valid || !validProgress(s.level.number) || s.level.number !== data.currentLevel || !Array.isArray(s.removed) || new Set(s.removed).size !== s.removed.length)
        return false;
    const ids = new Set(s.level.arrows.map(a => a.id));
    if (s.removed.some(id => !ids.has(id)))
        return false;
    if (s.level.lifeLimit === null ? s.lives !== null : !Number.isInteger(s.lives) || s.lives < 0 || s.lives > s.level.lifeLimit + uses.life)
        return false;
    if (!['playing', 'won', 'failed'].includes(s.state))
        return false;
    if (s.level.timeLimitMs != null && (!Number.isFinite(s.remainingMs) || s.remainingMs < 0 || s.remainingMs > s.level.timeLimitMs + uses.time * 30000)) return false;
    if (s.state === 'failed')
        return s.lives === 0 || s.failureReason === 'timeout' && s.level.timeLimitMs != null && s.remainingMs === 0;
    if (s.level.timeLimitMs != null && s.remainingMs === 0) return false;
    if (s.lives === 0)
        return false;
    return (s.state === 'won') === (s.removed.length === ids.size);
}
function encode(data) { const payload = JSON.stringify(data); return JSON.stringify({ payload, checksum: checksum(payload) }); }
function decode(raw) { try {
    const envelope = JSON.parse(raw);
    if (typeof envelope.payload !== 'string' || checksum(envelope.payload) !== envelope.checksum)
        return null;
    const data = JSON.parse(envelope.payload);
    return validate(data) ? data : null;
}
catch {
    return null;
} }
function recoverOriginal(raw) {
    try {
        const envelope = JSON.parse(raw), data = JSON.parse(envelope.payload), level = data.session?.level;
        if (!validateLevel(level).valid || !solve(level).valid || !validProgress(level.number))
            return null;
        return { campaignRevision: data.campaignRevision, version: 1, currentLevel: level.number, unlocked: level.number, settings: { sound: true, vibration: true }, tutorialDone: level.number > 1, lifeIntroDone: false, session: { level, removed: [], lives: level.lifeLimit, remainingMs: level.timeLimitMs ?? null, state: 'playing' } };
    }
    catch {
        return null;
    }
}
function createStore(storage) {
    return { load() {
            const raw = storage.get(KEY), backup = storage.get(BACKUP);
            if (!raw && !backup)
                return { data: null, recovered: false };
            const current = decode(raw);
            if (current)
                return { data: current, recovered: false };
            const previous = decode(backup);
            if (previous)
                return { data: previous, recovered: true };
            return { data: recoverOriginal(raw) || recoverOriginal(backup), recovered: true };
        }, save(data) { if (!validate(data))
            throw new Error('Refusing invalid snapshot'); const value = encode(data); storage.set(KEY, value); storage.set(BACKUP, value); return true; } };
}
function restore(app, data) {
    if (!validate(data))
        throw new Error('Invalid saved game');
    for (const key of ['currentLevel', 'unlocked', 'tutorialDone', 'lifeIntroDone'])
        app[key] = data[key];
    if (data.campaignRevision !== 3) {
        data = { ...data, campaignRevision: 3, currentLevel: 1, unlocked: 1, session: null, tutorialDone: false, lifeIntroDone: false, challengeUnlockSeen: false, raceUnlockSeen: false, rewardClaims: [], levelBests: {} };
        app.currentLevel = app.unlocked = 1; app.tutorialDone = app.lifeIntroDone = false;
    }
    app.settings = { ...data.settings, music: typeof data.settings.music === 'boolean' ? data.settings.music : true };
    app.inventory = { ...(data.inventory || { time: 10, life: 10, shuffle: 10 }) };
    app.challengeUnlockSeen = !!data.challengeUnlockSeen;
    app.raceUnlockSeen = !!data.raceUnlockSeen;
    app.rewardClaims = data.rewardClaims ? [...data.rewardClaims] : Array.from({ length: Math.min(data.unlocked - 1, require("src/campaign/catalog.js").levels.length) }, (_,i) => i + 1);
    app.levelBests = { ...(data.levelBests || {}) }; app.rewardNotice = '';
    app.session = null;
    if (data.session) {
        const state = data.session;
        app.session = new Session(state.level);
        app.session.removed = new Set(state.removed);
        app.session.lives = state.lives;
        app.session.reviveDeclined = !!state.reviveDeclined;
        app.session.timeReviveDeclined = !!state.timeReviveDeclined;
        app.session.recordMs = state.recordMs || 0; app.session.recordEligible = state.recordEligible === true;
        if (!state.level.campaignConfigured && state.level.lifeLimit === null && lifeLimit(state.level.number) !== null) {
            app.session.level.lifeLimit = lifeLimit(state.level.number);
            app.session.lives = app.session.level.lifeLimit;
        }
        app.session.state = state.state;
        app.session.remainingMs = state.remainingMs ?? state.level.timeLimitMs ?? null;
        app.session.failureReason = state.failureReason || (state.state === 'failed' ? 'lives' : null);
        app.session.items = { ...(state.items || { time: 1, life: 1, shuffle: 1 }) };
        app.session.itemUses = { ...(state.itemUses || Object.fromEntries(Object.entries(app.session.items).map(([k,v]) => [k, 1-v]))) };
        app.session.restartLevel = state.restartLevel ? clone(state.restartLevel) : null;
        app.tutorialStep = state.level.number === 1 && !app.tutorialDone ? 1 : 0;
    }
    app.screen = 'home';
    app.modal = app.unlocked >= 20 && !app.challengeUnlockSeen ? 'rush-unlocked' : null;
}
function bindPersistence(app, storage) {
    const store = createStore(storage);
    let readBlocked = false;
    app.persist = () => { if (readBlocked) {
        app.savedError = true;
        return;
    } try {
        store.save(snapshot(app));
        app.savedError = false;
    }
    catch {
        app.savedError = true;
    } app.dirty = true; };
    function read() { try {
        const loaded = store.load();
        if (loaded.data)
            restore(app, loaded.data);
        if (loaded.data && loaded.data.campaignRevision !== 3) app.persist();
        readBlocked = false;
        app.retryRead = null;
        app.savedError = false;
        if (loaded.recovered) {
            app.recoveryNotice = '存档异常，已恢复可用进度';
            app.say(app.recoveryNotice, 5000);
        }
    }
    catch {
        readBlocked = true;
        app.savedError = true;
        app.recoveryNotice = '暂时无法读取进度，请重试';
        app.retryRead = read;
    } app.dirty = true; }
    read();
    app.onChange = app.persist;
    return store;
}
module.exports = { KEY, BACKUP, checksum, encode, decode, validate, snapshot, restore, createStore, bindPersistence };

},
"src/ui/life-rescue.js":function(module,exports,require){
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

},
"src/ui/time-rescue.js":function(module,exports,require){
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

},
"src/ui/dismiss.js":function(module,exports,require){
'use strict';
function dismiss(app) {
    const targets = {
        'time-rescue': 'time-rescue-decline',
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

},
"src/campaign/controller.js":function(module,exports,require){
'use strict';
const catalog = require("src/campaign/catalog.js");
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

},
"src/generation/reshuffle.js":function(module,exports,require){
'use strict';
const { clone } = require("src/domain/board.js");
const { solve } = require("src/generation/validate.js");
async function reshuffle(session, generate, seed) {
    const count = session.remaining, original = session.level;
    for (let i = 0; i < 8; i++) {
        try {
            const result = await generate(original.number, (seed + i) >>> 0);
            if (result.level.width !== original.width || result.level.height !== original.height || (result.level.obstacles || []).length !== (original.obstacles || []).length || result.level.arrows.length < count) continue;
            const solved = solve(result.level);
            if (!solved.valid) continue;
            const keep = new Set(solved.sequence.slice(-count));
            const level = { ...clone(result.level), lifeLimit: original.lifeLimit, timeLimitMs: original.timeLimitMs, initialArrowCount: original.initialArrowCount || original.arrows.length };
            level.arrows = level.arrows.filter(a => keep.has(a.id));
            if (level.arrows.length === count && solve(level).valid) return level;
        } catch { }
    }
    // Rotation is an exact solvability-preserving fallback, including for old saved layouts.
    const level = clone(original), rotate = p => [original.width - 1 - p[0], original.height - 1 - p[1]];
    const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
    level.arrows = original.arrows.filter(a => !session.removed.has(a.id)).map(a => ({ ...clone(a), direction: opposite[a.direction], path: a.path.map(rotate) }));
    level.obstacles = (original.obstacles || []).map(rotate);
    level.initialArrowCount = original.initialArrowCount || original.arrows.length;
    if (!solve(level).valid || level.arrows.length !== count) throw Error('Cannot reshuffle safely');
    return level;
}
module.exports = { reshuffle };

},
"src/ui/view.js":function(module,exports,require){
'use strict';
const { drawBoard } = require("src/rendering/board.js");
const { CONFIG, profileIndex } = require("src/config.js");
const { fixtures } = require("src/fixtures.js");
const { Viewport } = require("src/input/viewport.js");
const COLORS = { bg: '#f5f3eb', paper: '#fffef9', ink: '#263f36', muted: '#7b8579', line: '#dfe4d8', green: '#397356', mint: '#e5eddf', red: '#ae5949' };
function rounded(ctx, x, y, w, h, r, fill, stroke) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
} if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
} }
function text(ctx, value, x, y, size = 16, color = COLORS.ink, align = 'left', weight = 400) { ctx.fillStyle = color; ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, 'Microsoft YaHei', sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(String(value), x, y); }
function wrap(ctx, value, maxWidth, size = 15) { ctx.font = `${size}px sans-serif`; const lines = []; let line = ''; for (const ch of value) {
    if (ch === '\n' || ctx.measureText(line + ch).width > maxWidth) {
        lines.push(line);
        line = ch === '\n' ? '' : ch;
    }
    else
        line += ch;
} if (line)
    lines.push(line); return lines; }
function layout(info) { const width = info.width, height = info.height; const top = Math.max(info.safeTop || 0, info.menuBottom || 0) + 12, bottom = height - (info.safeBottom || 0) - 16; const boardSize = Math.max(120, Math.min(width - 32, bottom - top - 290)); return { width, height, top, bottom, board: { x: (width - boardSize) / 2 + 10, y: top + 142, width: boardSize - 20, height: boardSize - 20 }, card: { x: (width - boardSize) / 2, y: top + 132, width: boardSize, height: boardSize } }; }
class View {
    constructor(ctx) { this.ctx = ctx; this.buttons = []; this.transform = null; this.lastLayout = null; this.camera = new Viewport(); this.cameraLevel = null; }
    button(id, label, x, y, w, h = 48, primary = false) { const c = this.ctx; rounded(c, x, y, w, h, 14, primary ? COLORS.ink : COLORS.paper, primary ? null : COLORS.line); text(c, label, x + w / 2, y + h / 2, 15, primary ? COLORS.paper : COLORS.ink, 'center', 500); this.buttons.push({ id, label, x, y, width: w, height: h }); }
    render(app, info) {
        const c = this.ctx, l = layout(info);
        this.lastLayout = l;
        this.buttons = [];
        this.transform = null; this.dialogRect = null;
        c.fillStyle = COLORS.bg;
        c.fillRect(0, 0, l.width, l.height);
        if (app.screen === 'home')
            this.home(app, l);
        else if (app.screen === 'map') require("src/campaign/view.js").draw(this, app, l, text, COLORS);
        else
            this.game(app, l);
        if (app.modal)
            this.dialog(app, l);
        if (app.savedError) {
            rounded(c, 16, l.bottom - 48, l.width - 32, 44, 10, '#f7e7df');
            text(c, app.retryRead ? '进度读取失败 · 点击重试' : '保存失败 · 点击重试', l.width / 2, l.bottom - 26, 13, COLORS.red, 'center');
            this.buttons.push({ id: 'retry-save', label: '重试保存', x: 16, y: l.bottom - 48, width: l.width - 32, height: 44 });
        }
        app.dirty = false;
    }
    home(app, l) {
        const c = this.ctx, w = l.width, usable = l.bottom - l.top;
        this.button('rank', '排行榜', w - 96, l.top, 80, 44);
        if (!app.retryRead) this.button('level-map', '关卡总览', 16, l.top, 96, 44);
        const titleY = l.top + usable * .12;
        text(c, CONFIG.title, w / 2, titleY, 52, COLORS.ink, 'center', 500);
        text(c, '让每条箭头，找到出口', w / 2, titleY + 43, 14, COLORS.muted, 'center');
        const size = Math.min(w * .60, usable * .26), x = (w - size) / 2, y = titleY + 78;
        rounded(c, x - 14, y - 12, size + 28, size + 24, 28, '#e9eddf');
        drawBoard(c, fixtures.tutorial, { x, y, width: size, height: size });
        const by = Math.min(l.bottom - 181, Math.max(y + size + 36, l.top + usable * .73));
        text(c, '第 ' + String(app.currentLevel).padStart(2, '0') + ' 关 · ' + CONFIG.profiles[profileIndex(app.currentLevel)].name, w / 2, by - 24, 13, COLORS.muted, 'center');
        const secondaryWidth = (w - 76) / 2;
        this.button('start', app.session ? '继续闯关' : '开始闯关', 32, by, secondaryWidth, 54, true);
        if (!app.retryRead) this.button('challenge', app.unlocked >= 20 ? '挑战模式' : '挑战 · 20关解锁', 44 + secondaryWidth, by, secondaryWidth, 54);
        this.button('settings', '设置', 32, by + 126, secondaryWidth, 44);
        if (!app.retryRead)
            this.button('reset-progress-ask', '重置关卡进度', 44 + secondaryWidth, by + 126, secondaryWidth, 44);
        if (!app.retryRead) this.button('race', app.unlocked >= 6 ? '竞速 · 每日 / 每周' : '竞速 · 通关5关解锁', 32, by + 66, w - 64, 48);
        if (app.recoveryNotice && !app.savedError)
            text(c, app.recoveryNotice, w / 2, l.bottom + 3, 11, COLORS.red, 'center');
    }
    game(app, l) {
        const c = this.ctx, w = l.width;
        this.button('pause', 'Ⅱ', 16, l.top, 44, 44);
        text(c, app.mode === 'race' ? '竞速模式' : app.mode === 'challenge' ? '挑战模式' : '箭间', w / 2, l.top + 15, 17, COLORS.ink, 'center', 500);
        text(c, app.mode === 'race' ? '第 ' + app.currentLevel + ' / 5 关' : app.mode === 'challenge' ? '20×20 · 4块障碍' : '第 ' + String(app.currentLevel).padStart(2, '0') + ' 关', w / 2, l.top + 40, 12, COLORS.muted, 'center');
        const s = app.session;

        text(c, '剩余箭头', 26, l.top + 80, 12, COLORS.muted);
        text(c, s ? s.remaining : '—', 26, l.top + 108, 27, COLORS.ink, 'left', 500);
        if (app.mode === 'race' && app.race?.startedAt !== undefined) {
            text(c, '累计用时', w / 2, l.top + 80, 12, COLORS.muted, 'center');
            text(c, require("src/race/history.js").format(require("src/race/controller.js").elapsed(app)), w / 2, l.top + 108, 23, COLORS.ink, 'center');
        }
        if (s?.remainingMs != null) {
            const seconds = Math.ceil(s.remainingMs / 1000);
            text(c, '剩余时间', w / 2, l.top + 80, 12, COLORS.muted, 'center');
            text(c, Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'), w / 2, l.top + 108, 23, seconds <= 30 ? COLORS.red : COLORS.ink, 'center');
        }
        if (s?.lives !== null && s) {
            text(c, '剩余机会', w - 26, l.top + 80, 12, COLORS.muted, 'right');
            text(c, s.lives > 5 ? '♥ × ' + s.lives : '♥'.repeat(s.lives) + '♡'.repeat(Math.max(0, s.level.lifeLimit - s.lives)), w - 26, l.top + 108, 23, COLORS.green, 'right');
        }
        else if (app.mode !== 'race') {
            rounded(c, w - 108, l.top + 88, 82, 29, 14, COLORS.mint);
            text(c, '自由尝试', w - 67, l.top + 103, 12, COLORS.green, 'center');
        }
        rounded(c, l.card.x, l.card.y, l.card.width, l.card.height, 22, COLORS.paper, COLORS.line);
        if (s && !app.loading && !app.loadError) {
            const colors = new Map(), offsets = new Map();
            for (const id of s.moves.keys())
                colors.set(id, COLORS.green);
            for (const [id, f] of s.feedback) {
                colors.set(id, COLORS.red);
                colors.set(f.blocker.id, COLORS.red);
                offsets.set(id, Math.sin((f.until - s.time) / 16) * 2.5);
            }
            if (this.cameraLevel !== s.level) { this.camera.reset(); this.cameraLevel = s.level; }
            this.camera.update(l.board);
            c.save(); c.beginPath(); c.rect(l.board.x, l.board.y, l.board.width, l.board.height); c.clip();
            this.transform = drawBoard(c, s.level, this.camera.boardRect(), { removed: s.removed, paths: s.paths(), colors, offsets, grid: !!app.debugGrid });
            c.restore();
            if (app.tutorialStep === 1) {
                const a = s.level.arrows.find(a => a.id === 'first'), p = this.transform.toScreen(a.path[a.path.length - 1]);
                c.strokeStyle = COLORS.green;
                c.lineWidth = 1.5;
                c.beginPath();
                c.arc(p[0], p[1], this.transform.cell * .5, 0, Math.PI * 2);
                c.stroke();
            }
            const total = s.level.initialArrowCount || s.level.arrows.length;
            const progress = (total - s.remaining) / total, py = l.card.y + l.card.height + 19;
            rounded(c, 32, py, w - 64, 3, 1.5, COLORS.line);
            if (progress > 0)
                rounded(c, 32, py, (w - 64) * progress, 3, 1.5, COLORS.green);
            const message = app.message || (app.tutorialStep === 1 ? '点击圈中的箭头，沿方向移出棋盘' : this.camera.zoom > 1 ? '拖动查看棋盘，轻点箭头消除' : '箭头太小？点击放大后操作');
            wrap(c, message, w - 42, 13).forEach((v, i) => text(c, v, w / 2, py + 30 + i * 20, 13, app.message ? COLORS.green : COLORS.muted, 'center'));
            if (app.mode !== 'race') this.itemBar(app, py + 64, w);
            if (s.level.number >= 3) {
                this.button(this.camera.zoom < 3 ? 'zoom-in' : 'zoom-reset', this.camera.zoom === 1 ? '放大' : this.camera.zoom === 2 ? '再放大' : '全图', w - 84, l.top, 68, 44);
            }
        }
        else {
            text(c, app.loadError ? '暂时没有准备好' : '正在铺好棋盘…', w / 2, l.card.y + l.card.height / 2 - 16, 16, COLORS.muted, 'center');
            if (app.loadError) {
                this.button('retry-load', '重试', w / 2 - 70, l.card.y + l.card.height / 2 + 18, 140, 48, true);
                this.button('home', '返回首页', w / 2 - 70, l.card.y + l.card.height / 2 + 80, 140, 44);
            }
        }
    }
    dialog(app, l) {
        const c = this.ctx, w = l.width;
        this.buttons = [];
        c.fillStyle = 'rgba(30,48,40,.32)';
        c.fillRect(0, 0, w, l.height);
        if (app.modal === 'rank') { require("src/race/rank-view.js").render(this, app, l); return; }
        let title = '', description = '', actions = [];
        switch (app.modal) {
            case 'rush-locked':
                title = '挑战模式尚未解锁'; description = '通关第19关、到达第20关后开启。';
                actions = [['rush-notice-close', '知道了', true]]; break;
            case 'rush-unlocked':
                title = '挑战模式已解锁'; description = '已到达第20关！主页可进入90秒高难度挑战，普通闯关进度独立保留。';
                actions = [['rush-notice-close', '知道了', true]]; break;
            case 'item-empty':
                title = '道具已用完'; description = '当前道具数量为0，暂时无法使用。'; actions = [['item-empty-close', '知道了', true]]; break;
            case 'items': {
                const s = app.session;
                title = '道具'; description = '道具数量跨关卡保存，查看时暂停计时。';
                actions = [['item-time', s.remainingMs === null ? '加时 · 本关不限时' : '加时30秒 · ' + app.inventory.time], ['item-life', s.lives === null ? '容错 · 本关不限次' : '容错+1 · ' + app.inventory.life], ['item-shuffle', '重排剩余箭头 · ' + app.inventory.shuffle], ['items-done', '返回游戏', true]];
                break;
            }
            case 'shuffling':
                title = '正在重排'; description = '保留剩余箭头数量，验证通路中…'; break;
            case 'pause':
                title = '歇一会儿';
                description = '棋盘会在这里等你。';
                actions = [['resume', '继续游戏', true], ['restart-ask', '重新开始'], ['settings', '设置'], ['home', '返回首页']];
                break;
            case 'restart':
                title = '重新开始本关？';
                description = '当前消除进度将重置，棋盘布局保持不变。';
                actions = [['restart-cancel', '继续游戏', true], ['restart', '重新开始']];
                break;
            case 'won':
                title = '全部解开了';
                description = app.mode === 'challenge' ? '挑战成功！所有箭头已清空。' : '第 ' + app.currentLevel + ' 关完成，所有箭头已清空。';
                actions = [['next', app.mode === 'challenge' ? '再挑战一局' : '下一关', true], ['home', '返回首页']];
                break;
            case 'rush-ready':
                title = '90秒极限挑战';
                description = '20×20满棋盘、4块障碍、3次容错。开始后计时，可放大拖动。返回首页结束本轮，普通闯关进度保留。';
                actions = [['rush-accept', '开始挑战', true], ['home', '返回首页']];
                break;
            case 'life-rescue':
                title = '容错次数用完了';
                description = app.inventory.life > 0 ? '使用1个容错道具，增加1次机会，继续当前棋盘。剩余道具：' + app.inventory.life : '容错道具库存为0，本局无法续关。';
                actions = [...(app.inventory.life > 0 ? [['life-rescue-use', '使用道具继续', true]] : []), ['life-rescue-decline', '结束本局']];
                break;
            case 'time-rescue':
                title = '时间用完了';
                description = app.inventory.time > 0 ? '使用1个加时道具，增加30秒，继续当前棋盘。剩余道具：' + app.inventory.time : '加时道具库存为0，本局无法续关。';
                actions = [...(app.inventory.time > 0 ? [['time-rescue-use', '加时30秒继续', true]] : []), ['time-rescue-decline', '结束本局']];
                break;
            case 'failed':
                title = '再试一次';
                description = app.session?.failureReason === 'timeout' ? '时间到了。重新挑战会恢复完整时间和 3 次机会。' : '本次机会已用完。先观察出口，再慢慢解开。';
                actions = [['restart', '重新挑战', true], ['home', '返回首页']];
                break;
            case 'settings':
                title = '设置';
                description = '开启操作音效可试听。\n音量随手机媒体音量调整。';
                actions = [['music', '背景音乐'], ['sound', '操作音效'], ['vibration', '震动'], ['settings-done', '完成', true]];
                break;
            case 'reset-progress':
                title = '重置关卡进度？';
                description = '清除闯关进度，回到第 1 关。保留音效和震动设置。';
                actions = [['reset-progress-cancel', '取消', true], ['reset-progress-confirm', '确认重置']];
                break;
            case 'life-intro':
                title = '多一点挑战';
                description = '本关有 ' + app.session.level.lifeLimit + ' 次容错。点错扣1次，降到0时可选择使用容错道具继续；正确消除不扣次数。';
                actions = [['life-accept', '知道了，开始', true]];
                break;
            case 'challenge-intro':
                title = ([4, 15].includes(app.currentLevel) && (app.session.level.obstacles || []).length) ? '石块出现了' : '限时挑战';
                description = app.currentLevel === 15 ? '灰色石块无法消除，会挡住路线。清空全部箭头即可通关。' : '本关限时 ' + Math.round((app.session?.level.timeLimitMs || 0) / 1000) + ' 秒。时间归零或机会用完即失败；暂停和切后台时停止计时。';
                actions = [['challenge-accept', '开始挑战', true]];
                break;
        }
        if (app.modal === 'level-detail') ({ title, description, actions } = require("src/campaign/view.js").detail(app));
        if (app.modal === 'won' && app.mode === 'campaign') { description += app.rewardNotice ? '\n' + app.rewardNotice : ''; actions = [['next', app.currentLevel >= require("src/campaign/catalog.js").levels.length ? '查看总览' : '下一关', true], ['level-map', '关卡总览'], ['home', '返回首页']]; }
        const raceDialog = require("src/race/view.js").dialog(app);
        if (raceDialog) ({ title, description, actions } = raceDialog);
        const boxWidth = Math.min(w - 40, 340), lines = wrap(c, description, boxWidth - 48), boxHeight = 106 + lines.length * 23 + actions.length * 58 + 12, x = (w - boxWidth) / 2, y = Math.max(l.top, (l.height - boxHeight) / 2);
        this.dialogRect = { x, y, width: boxWidth, height: boxHeight };
        rounded(c, x, y, boxWidth, boxHeight, 24, COLORS.paper);
        text(c, title, w / 2, y + 40, 24, COLORS.ink, 'center', 500);
        lines.forEach((line, i) => text(c, line, w / 2, y + 82 + i * 23, 14, COLORS.muted, 'center'));
        if (app.modal === 'race-friends' && app.platform.drawFriends) app.platform.drawFriends(c, { x: x + 24, y: y + 70, width: boxWidth - 48, height: 180 });
        actions.forEach(([id, label, primary], i) => {
            const bx = x + 20, by = y + 102 + lines.length * 23 + i * 58, bw = boxWidth - 40;
            if (app.modal === 'settings' && ['music', 'sound', 'vibration'].includes(id)) {
                const on = app.settings[id] !== false;
                rounded(c, bx, by, bw, 48, 14, COLORS.paper, COLORS.line);
                text(c, label, bx + 14, by + 24, 16, COLORS.ink);
                text(c, on ? '开' : '关', bx + bw - 76, by + 24, 13, COLORS.muted, 'center');
                rounded(c, bx + bw - 62, by + 10, 48, 28, 14, on ? COLORS.green : COLORS.line);
                c.beginPath(); c.arc(bx + bw - (on ? 28 : 48), by + 24, 10, 0, Math.PI * 2); c.fillStyle = COLORS.paper; c.fill();
                this.buttons.push({ id, label, x: bx, y: by, width: bw, height: 48 });
            } else this.button(id, label, bx, by, bw, 48, primary);
        });
    }
    itemBar(app, y, width) {
        const c = this.ctx, size = (width - 80) / 3;
        for (const [i, kind, label] of [[0, 'time', '加时'], [1, 'life', '容错'], [2, 'shuffle', '重排']]) {
            const x = 28 + i * (size + 12), cx = x + size / 2, cy = y + 19;
            rounded(c, x, y, size, 60, 14, COLORS.paper, COLORS.line);
            c.strokeStyle = COLORS.green; c.lineWidth = 2.3; c.beginPath();
            if (kind === 'time') { c.arc(cx, cy, 10, 0, Math.PI * 2); c.moveTo(cx, cy - 6); c.lineTo(cx, cy); c.lineTo(cx + 5, cy + 2); }
            else if (kind === 'shuffle') { c.moveTo(cx - 11, cy - 5); c.lineTo(cx + 10, cy - 5); c.lineTo(cx + 5, cy - 10); c.moveTo(cx + 10, cy + 5); c.lineTo(cx - 11, cy + 5); c.lineTo(cx - 6, cy + 10); }
            c.stroke();
            if (kind === 'life') text(c, '♥', cx, cy, 26, COLORS.red, 'center');
            text(c, label, cx - 5, y + 45, 13, COLORS.ink, 'center');
            rounded(c, x + size - 24, y + 39, 24, 21, 9, COLORS.ink);
            text(c, app.inventory[kind], x + size - 12, y + 49, 12, COLORS.paper, 'center');
            this.buttons.push({ id: 'item-' + kind, x, y, width: size, height: 60, label });
        }
    }
    hitButton(x, y) { return this.buttons.find(b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)?.id || null; }
}
module.exports = { View, layout, COLORS, rounded, text };


},
"src/rendering/board.js":function(module,exports,require){
'use strict';
function trimShaft(points, distance) {
    const result = points.map(p => p.slice());
    while (result.length > 1) {
        const end = result[result.length - 1], previous = result[result.length - 2];
        const length = Math.hypot(end[0] - previous[0], end[1] - previous[1]);
        if (length <= distance) {
            distance -= length;
            result.pop();
        } else {
            result[result.length - 1] = [end[0] + (previous[0] - end[0]) * distance / length, end[1] + (previous[1] - end[1]) * distance / length];
            break;
        }
    }
    return result;
}
function drawArrow(ctx, points, direction, color = '#283b37', width = 3.2, unit = 24) {
    if (points.length < 2)
        return;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const length = Math.min(unit * .30, 10), half = length * .58;
    // Keep the rounded shaft cap inside the filled arrowhead, including at small cell sizes.
    const shaft = trimShaft(points, length * .7 + width / 2);
    if (shaft.length > 1) {
        ctx.beginPath();
        ctx.moveTo(shaft[0][0], shaft[0][1]);
        for (const p of shaft.slice(1))
            ctx.lineTo(p[0], p[1]);
        ctx.stroke();
    }
    const h = points[points.length - 1];
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
    ctx.beginPath();
    ctx.moveTo(h[0] + d[0] * length * .25, h[1] + d[1] * length * .25);
    ctx.lineTo(h[0] - d[0] * length - d[1] * half, h[1] - d[1] * length + d[0] * half);
    ctx.lineTo(h[0] - d[0] * length + d[1] * half, h[1] - d[1] * length - d[0] * half);
    ctx.closePath();
    ctx.fill();
}
function boardTransform(level, rect) {
    const cell = Math.min(rect.width / level.width, rect.height / level.height);
    return { cell, x: rect.x + (rect.width - cell * level.width) / 2, y: rect.y + (rect.height - cell * level.height) / 2,
        width: cell * level.width, height: cell * level.height,
        toScreen(p) { return [this.x + (p[0] + .5) * cell, this.y + (p[1] + .5) * cell]; },
        toBoard(p) { return [(p[0] - this.x) / cell - .5, (p[1] - this.y) / cell - .5]; } };
}
function drawBoard(ctx, level, rect, options = {}) {
    const t = boardTransform(level, rect);
    ctx.save();
    ctx.beginPath();
    ctx.rect(t.x, t.y, t.width, t.height);
    ctx.clip();
    if (options.grid) {
        ctx.fillStyle = '#c7d0c9';
        for (let x = 0; x < level.width; x++)
            for (let y = 0; y < level.height; y++) {
                const p = t.toScreen([x, y]);
                ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2);
            }
    }
    for (const p of level.obstacles || []) {
        const s = t.toScreen(p), size = t.cell * .7;
        ctx.fillStyle = '#88918b'; ctx.fillRect(s[0] - size / 2, s[1] - size / 2, size, size);
        ctx.strokeStyle = '#fffef9'; ctx.lineWidth = Math.max(1, t.cell * .06);
        ctx.beginPath(); ctx.moveTo(s[0] - size * .2, s[1] - size * .2); ctx.lineTo(s[0] + size * .2, s[1] + size * .2); ctx.moveTo(s[0] + size * .2, s[1] - size * .2); ctx.lineTo(s[0] - size * .2, s[1] + size * .2); ctx.stroke();
    }
    for (const a of level.arrows) {
        if (options.removed?.has(a.id))
            continue;
        const path = options.paths?.get(a.id) || a.path;
        const offset = options.offsets?.get(a.id) || 0;
        drawArrow(ctx, path.map(p => { const s = t.toScreen(p); return [s[0] + offset, s[1]]; }), a.direction, options.colors?.get(a.id), Math.max(t.cell < 13 ? 1.8 : 2.4, t.cell * .11), t.cell);
    }
    ctx.restore();
    return t;
}
module.exports = { drawArrow, boardTransform, drawBoard };

},
"src/input/viewport.js":function(module,exports,require){
'use strict';
class Viewport {
    constructor() { this.zoom = 1; this.x = this.y = 0; this.rect = null; }
    update(rect) { this.rect = rect; this.clamp(); }
    clamp() { if (!this.rect) return; const maxX = this.rect.width * (this.zoom - 1) / 2, maxY = this.rect.height * (this.zoom - 1) / 2; this.x = Math.max(-maxX, Math.min(maxX, this.x)); this.y = Math.max(-maxY, Math.min(maxY, this.y)); }
    change(delta) { const before = this.zoom; this.zoom = Math.max(1, Math.min(3, this.zoom + delta)); this.x *= this.zoom / before; this.y *= this.zoom / before; this.clamp(); }
    reset() { this.zoom = 1; this.x = this.y = 0; }
    pan(dx, dy) { this.x += dx; this.y += dy; this.clamp(); }
    contains(x, y) { const r = this.rect; return !!r && x >= r.x && y >= r.y && x <= r.x + r.width && y <= r.y + r.height; }
    boardRect() { const r = this.rect; return { x: r.x - r.width * (this.zoom - 1) / 2 + this.x, y: r.y - r.height * (this.zoom - 1) / 2 + this.y, width: r.width * this.zoom, height: r.height * this.zoom }; }
}
module.exports = { Viewport };

},
"src/campaign/view.js":function(module,exports,require){
'use strict';
const { levels, entry, key, rewardText } = require("src/campaign/catalog.js");
function draw(view, app, l, text, colors) {
    const c = view.ctx, page = app.mapPage || 0;
    view.button('map-home', '‹ 首页', 16, l.top, 80, 44);
    text(c, '关卡旅程', l.width / 2, l.top + 22, 22, colors.ink, 'center', 600);
    text(c, '第 ' + (page * 20 + 1) + '—' + Math.min((page + 1) * 20, levels.length) + ' 关 · 点击查看奖励', l.width / 2, l.top + 66, 12, colors.muted, 'center');
    const points = [], rowGap = (l.bottom - l.top - 190) / 4;
    const lanes = [[0,.30,.65,1],[.03,.34,.62,.95],[0,.26,.60,.99],[.05,.37,.68,1],[.01,.29,.63,.96]];
    const bends = [[0,-1,.7,-.3],[.2,.9,-.5,.4],[-.6,.3,-.9,.1],[.8,-.4,.4,-.8],[.1,-.9,.6,0]];
    const bend = Math.max(0, Math.min(18, (rowGap - 46) / 2));
    for (let i = 0; i < 20; i++) {
        const row = Math.floor(i / 4), col = row % 2 ? 3 - i % 4 : i % 4;
        points.push([38 + lanes[row][col] * (l.width - 76), l.top + 114 + row * rowGap + bends[row][col] * bend]);
    }
    c.beginPath(); c.moveTo(...points[0]);
    for (let i = 1; i < points.length - 1; i++) c.quadraticCurveTo(...points[i], (points[i][0] + points[i+1][0]) / 2, (points[i][1] + points[i+1][1]) / 2);
    c.lineTo(...points.at(-1)); c.strokeStyle = '#c5d1ba'; c.lineWidth = 4; c.stroke();
    points.forEach(([x,y],i) => {
        const n = page * 20 + i + 1, data = entry(n); if (!data) return;
        const current = n === app.unlocked, done = n < app.unlocked;
        view.button('map-level-' + n, String(n), x - 22, y - 22, 44, 44, done || current);
        if (n > app.unlocked) text(c, '未解锁', x, y + 31, 9, colors.muted, 'center');
        if (Object.keys(data.rewards).length) text(c, app.rewardClaims.includes(n) ? '✓' : '奖', x + 18, y - 20, 12, '#b57c24', 'center', 600);
        if (current) {
            c.fillStyle = '#d39439'; c.beginPath(); c.arc(x, y - 34, 5, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#d39439'; c.lineWidth = 3; c.beginPath(); c.moveTo(x,y-29); c.lineTo(x,y-18); c.moveTo(x-6,y-25); c.lineTo(x+6,y-25); c.moveTo(x,y-18); c.lineTo(x-5,y-12); c.moveTo(x,y-18); c.lineTo(x+5,y-12); c.stroke();
        }
    });
    const max = Math.min(Math.floor((app.unlocked - 1) / 20), Math.ceil(levels.length / 20) - 1);
    if (page > 0) view.button('map-prev', '上一页', 16, l.bottom - 44, 88, 44);
    text(c, (page + 1) + ' / ' + Math.ceil(levels.length / 20), l.width / 2, l.bottom - 22, 13, colors.muted, 'center');
    if (page < max) view.button('map-next', '下一页', l.width - 104, l.bottom - 44, 88, 44);
}
function detail(app) {
    const n = app.mapSelected, row = entry(n), best = app.levelBests[key(row.board)];
    const reward = rewardText(n) + (Object.keys(row.rewards).length ? (app.rewardClaims.includes(n) ? '（已领取）' : '（首次通关领取）') : '');
    return { title: '第 ' + n + ' 关', description: row.board.width + '×' + row.board.height + ' · ' + row.board.arrows.length + '条箭头\n' + (row.board.obstacles || []).length + '个障碍 · ' + (row.board.timeLimitMs == null ? '不限时' : Math.round(row.board.timeLimitMs / 1000) + '秒') + '\n' + reward + '\n个人最快：' + (best ? require("src/race/history.js").format(best) : '暂无纪录') + '\n' + (n > app.unlocked ? '通关前面的关卡后解锁' : '使用道具不计最快纪录。开始挑战将替换当前未完成棋盘。'), actions: [...(n <= app.unlocked ? [['map-play', n < app.unlocked ? '再次挑战' : '开始挑战', true]] : []), ['map-detail-close', '返回总览']] };
}
module.exports = { draw, detail };

},
"src/race/rank-view.js":function(module,exports,require){
'use strict';
const { read, format } = require("src/race/history.js");
function render(view, app, l) {
    const { text, rounded, COLORS } = require("src/ui/view.js");
    const c = view.ctx, width = l.width - 24, height = l.bottom - l.top - 12;
    const x = 12, y = l.top + 6, half = (width - 52) / 2;
    view.dialogRect = { x, y, width, height };
    rounded(c, x, y, width, height, 24, COLORS.paper);
    text(c, '排行榜', l.width / 2, y + 30, 24, COLORS.ink, 'center', 500);
    view.button('rank-close', '×', x + width - 52, y + 8, 44, 44);
    view.button('rank-friends', '好友榜', x + 20, y + 56, half, 44, app.rankTab === 'friends');
    view.button('rank-personal', '个人榜', x + 32 + half, y + 56, half, 44, app.rankTab === 'personal');
    for (const [i, kind, label] of [[0, 'daily', '每日'], [1, 'weekly', '每周']]) {
        const px = l.width / 2 - 68 + i * 72, py = y + 106, active = (app.raceKind || 'daily') === kind;
        rounded(c, px, py + 6, 64, 30, 15, active ? COLORS.mint : COLORS.paper, COLORS.line);
        text(c, label, px + 32, py + 21, 13, active ? COLORS.green : COLORS.muted, 'center');
        view.buttons.push({ id: 'rank-' + kind, label, x: px, y: py, width: 64, height: 44 });
    }
    const footer = y + height - 60;
    if (app.rankTab === 'friends') {
        if (app.platform.drawFriends) app.platform.drawFriends(c, { x: x + 22, y: y + 156, width: width - 44, height: height - 226 });
        else {
            text(c, '请在微信中查看好友榜', l.width / 2, y + 215, 14, COLORS.muted, 'center');
            text(c, '完成本期5关后记录我的成绩', l.width / 2, footer - 35, 13, COLORS.muted, 'center');
        }
        const third = (width - 56) / 3;
        view.button('rank-authorize', app.platform.rankState?.authorizing ? '请求中' : app.platform.rankState?.authorization === 'granted' ? '已授权' : '好友授权', x + 20, footer, third, 44);
        view.button('rank-refresh', '刷新', x + 28 + third, footer, third, 44);
        view.button('race-friend-page', '下一页', x + 36 + third * 2, footer, third, 44);
    } else {
        try {
            const records = read(app.platform.storage).filter(r => r.kind === (app.raceKind || 'daily')).sort((a,b) => b.period.localeCompare(a.period) || (b.version || 1)-(a.version || 1) || a.elapsed-b.elapsed);
            const count = Math.max(1, Math.floor((height - 260) / 42)), pages = Math.max(1, Math.ceil(records.length / count)), page = (app.historyPage || 0) % pages;
            if (!records.length) text(c, '暂无完成5关的成绩', l.width / 2, y + 215, 14, COLORS.muted, 'center');
            records.slice(page * count, (page + 1) * count).forEach((r,i) => text(c, r.period.slice(-10) + ' v' + (r.version || 1) + '  ' + format(r.elapsed), l.width / 2, y + 180 + i * 42, 14, COLORS.ink, 'center'));
            text(c, '第' + (page + 1) + '/' + pages + '页 · 同期同版本按用时排名', l.width / 2, footer - 47, 11, COLORS.muted, 'center');
        } catch { text(c, '读取失败，原成绩已保留', l.width / 2, y + 215, 14, COLORS.red, 'center'); }
        if (app.historyNotice) text(c, app.historyNotice, l.width / 2, footer - 22, 12, COLORS.muted, 'center');
        view.button('race-page', '下一页', x + 20, footer, half, 44);
        view.button('race-sync', '同步本期最佳', x + 32 + half, footer, half, 44);
    }
}
module.exports = { render };

},
"src/race/view.js":function(module,exports,require){
'use strict';
const { read, format } = require("src/race/history.js");
function dialog(app) {
    const kind = app.raceKind === 'weekly' ? '每周' : '每日';
    const sizes = require("src/race/settings.js").settings[app.raceKind === 'weekly' ? 'weekly' : 'daily'].map(r => r.size);
    const back = ['race-back', '返回'], close = ['race-close', '返回首页'];
    const toggle = ['race-period', '切换为' + (kind === '每日' ? '每周' : '每日')];
    let title, description, actions;
    switch (app.modal) {
        case 'race-locked': title = '竞速尚未解锁'; description = '通关第5关后开启。'; actions = [close]; break;
        case 'race-unlocked': title = '竞速模式已解锁'; description = '主页可进入每日、每周5关竞速，与好友比较总用时。'; actions = [['race-notice-close', '知道了', true]]; break;
        case 'race-menu': title = '竞速模式'; description = ''; actions = [['race-daily', '每日竞速', true], ['race-weekly', '每周竞速', true]]; break;
        case 'race-loading': title = '准备赛道'; description = '正在检查5关的通路…'; actions = [['home', '取消']]; break;
        case 'race-ready': title = '5关竞速'; description = (kind + '竞速：' + sizes[0] + '×' + sizes[0] + '起，共5关。') + '不限时、不限点错次数、无道具。关间等待不计时；关内暂停和切后台仍计时。'; actions = [['race-accept', '开始计时', true], ['home', '返回首页']]; break;
        case 'race-error': title = '赛道准备失败'; description = '请重试。'; actions = [['race-retry', '重试', true], ['home', '返回首页']]; break;
        case 'race-finished': title = '5关全部完成'; description = '总用时 ' + format(app.race.finishedElapsed) + '\n' + (app.race.saveError ? '本机保存失败，请重试' : '个人成绩已保存') + '\n' + (app.race.publishStatus || '微信中可同步好友成绩'); actions = [['race-retry-save', '重试保存 / 同步'], ['race-retry', '再跑一轮', true], ['home', '返回首页']]; break;
        case 'race-history': {
            title = kind + '个人历史';
            try {
                const records = read(app.platform.storage).filter(r => r.kind === (app.raceKind || 'daily')).sort((a, b) => b.period.localeCompare(a.period) || (b.version || 1) - (a.version || 1) || a.elapsed - b.elapsed);
                const pages = Math.max(1, Math.ceil(records.length / 3)), page = (app.historyPage || 0) % pages;
                description = records.length ? records.slice(page * 3, page * 3 + 3).map(r => r.period.slice(-10) + ' v' + (r.version || 1) + ' ' + format(r.elapsed)).join('\n') + '\n第' + (page + 1) + '/' + pages + '页 · 同期用时升序' : '暂无完成5关的成绩';
                if (app.historyNotice) description += '\n' + app.historyNotice;
            } catch { description = '历史成绩读取失败，原记录已保留'; }
            actions = [['race-page', '下一页'], ['race-sync', '同步本期最佳到好友榜'], toggle, back]; break;
        }
        case 'race-friends': title = kind + '好友榜'; description = app.platform.showFriends ? '\n\n\n\n\n\n\n\n' : '请在微信中查看好友榜'; actions = [['race-friend-page', '下一页 / 授权重试'], toggle, back]; break;
        default:
            if (app.mode !== 'race') return null;
            if (app.modal === 'pause') { title = '竞速暂歇'; description = '总用时仍在累计。返回首页将结束本轮。'; actions = [['resume', '继续', true], ['restart-ask', '重跑5关'], ['home', '结束本轮']]; }
            else if (app.modal === 'restart') { title = '重跑全部5关？'; description = '当前竞速成绩作废，从第1关重新计时。'; actions = [['restart-cancel', '继续', true], ['restart', '重新开始']]; }
            else if (app.modal === 'failed') { title = '本轮竞速结束'; description = '点错已达3次。完成全部5关才会记录成绩。'; actions = [['restart', '重跑5关', true], ['home', '返回首页']]; }
            else if (app.modal === 'won') { title = '第' + app.currentLevel + '关完成'; description = '计时已暂停，进入下一关后继续。'; actions = [['next', '下一关', true], ['home', '结束本轮']]; }
            else return null;
    }
    return { title, description, actions };
}
module.exports = { dialog };

},
"src/input/pointer.js":function(module,exports,require){
'use strict';
const { segmentDistance } = require("src/movement/path.js");
const { DIRS } = require("src/domain/board.js");
function hitArrow(level, point, removed = new Set(), paths = new Map(), tolerance = .48) {
    if ((level.obstacles || []).some(p => Math.abs(point[0] - p[0]) <= .35 && Math.abs(point[1] - p[1]) <= .35)) return null;
    let best = null, distance = Infinity;
    for (const a of level.arrows) {
        if (removed.has(a.id))
            continue;
        const path = paths.get(a.id) || a.path;
        let d = Infinity;
        for (let i = 1; i < path.length; i++)
            d = Math.min(d, segmentDistance(point, path[i - 1], path[i]));
        const h = path[path.length - 1], v = DIRS[a.direction];
        for (const sign of [-1, 1])
            d = Math.min(d, segmentDistance(point, h, [h[0] - v[0] * .3 - v[1] * .17 * sign, h[1] - v[1] * .3 + v[0] * .17 * sign]));
        if (d <= tolerance && (d < distance - 1e-9 || (Math.abs(d - distance) < 1e-9 && a.id < (best || '~')))) {
            distance = d;
            best = a.id;
        }
    }
    return best;
}
class Pointer {
    constructor(tolerance = 10) { this.tolerance = tolerance; this.active = null; this.invalid = false; }
    start(id, x, y, count = 1) { if (this.active || count !== 1) {
        this.invalid = true;
        return;
    } this.active = { id, x, y }; this.invalid = false; }
    move(id, x, y, count = 1) { if (count !== 1)
        this.invalid = true; if (this.active && id === this.active.id && Math.hypot(x - this.active.x, y - this.active.y) > this.tolerance)
        this.invalid = true; }
    end(id, x, y) { if (!this.active || id !== this.active.id)
        return null; this.move(id, x, y); const result = this.invalid ? null : [x, y]; this.cancel(); return result; }
    cancel() { this.active = null; this.invalid = false; }
}
module.exports = { hitArrow, Pointer };

}};const cache={};function require(id){if(cache[id])return cache[id].exports;const module={exports:{}};cache[id]=module;if(!modules[id])throw new Error('Missing module '+id);modules[id](module,module.exports,require);return module.exports;}require("src/main-browser.js");})();
