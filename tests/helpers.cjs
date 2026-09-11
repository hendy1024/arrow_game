'use strict';
function recordingContext() { const calls = []; const state = { measureText: text => ({ width: String(text).length * 8 }), calls }; return new Proxy(state, { get(o, k) { if (k in o)
        return o[k]; return (...args) => calls.push([k, ...args]); }, set(o, k, v) { o[k] = v; return true; } }); }
function fakePlatform() { const ctx = recordingContext(), callbacks = {}; return { ctx, callbacks, seed: () => 51, feedback() { }, info: () => ({ width: 390, height: 844, ratio: 2, safeTop: 24, safeBottom: 20, menuBottom: 48 }), listen(h) { Object.assign(callbacks, h); }, requestFrame() { return 1; }, cancelFrame() { } }; }
function fakeWx() { const ctx = recordingContext(), handlers = {}, canvas = { getContext: () => ctx }, storage = new Map(); const wx = { createCanvas: () => canvas, getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 2, safeArea: { top: 24, bottom: 824 } }), getMenuButtonBoundingClientRect: () => ({ bottom: 48 }), getStorageSync: k => storage.get(k), setStorageSync: (k, v) => storage.set(k, v) }; for (const e of ['TouchStart', 'TouchMove', 'TouchEnd', 'TouchCancel', 'Hide', 'Show', 'WindowResize'])
    wx['on' + e] = h => handlers[e] = h; return { wx, ctx, canvas, handlers, storage }; }
module.exports = { recordingContext, fakePlatform, fakeWx };
