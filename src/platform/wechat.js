'use strict';
function createWechatPlatform(wx, globals) {
    // Configure the native audio route before creating either music or effects.
    try { wx.setInnerAudioOption?.({ obeyMuteSwitch: false, speakerOn: true, fail: e => console.warn('音频设置失败', e) }); } catch (e) { console.warn('音频设置失败', e); }
    function audio(kind) {
        if (!wx.createInnerAudioContext) return null;
        const a = wx.createInnerAudioContext();
        a.obeyMuteSwitch = false; a.volume = .6;
        a.onError?.(e => console.warn('音频播放失败', kind, e));
        a.src = 'assets/' + kind + '.wav'; return a;
    }
    const music = require('./music').createMusic(() => {
        return audio('music');
    });
    const { createFeedback } = require('./feedback');
    const feedback = createFeedback(audio, () => wx.vibrateShort?.({ type: 'light', fail: () => { } }));
    const canvas = wx.createCanvas();
    let ctx = canvas.getContext('2d');
    function info() { const data = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); let menu = { bottom: 0 }; try {
        menu = wx.getMenuButtonBoundingClientRect?.() || menu;
    }
    catch { } return { width: data.windowWidth, height: data.windowHeight, ratio: data.pixelRatio || 1, safeTop: data.safeArea?.top || 0, safeBottom: Math.max(0, data.windowHeight - (data.safeArea?.bottom || data.windowHeight)), menuBottom: menu.bottom || 0 }; }
    function resize() { const i = info(); canvas.width = Math.round(i.width * i.ratio); canvas.height = Math.round(i.height * i.ratio); ctx = canvas.getContext('2d'); ctx.setTransform(i.ratio, 0, 0, i.ratio, 0, 0); return i; }
    resize();
    return { ...require('../race/wechat').createRaceWechat(wx), canvas, get ctx() { return ctx; }, info, resize, seed: () => Date.now() >>> 0, feedback: (kind, settings) => feedback.play(kind, settings), setMusic: enabled => music.set(enabled), stopFeedback: () => feedback.stop(), destroy: () => { feedback.destroy(); music.destroy(); }, storage: { get: key => wx.getStorageSync(key) || null, set: (key, value) => wx.setStorageSync(key, value) }, requestFrame: fn => globals.requestAnimationFrame(fn), cancelFrame: id => globals.cancelAnimationFrame(id),
        listen(h) { const p = t => [t.identifier ?? 0, t.clientX ?? t.x, t.clientY ?? t.y]; wx.onTouchStart(e => { for (const t of e.changedTouches || e.touches)
            h.start(...p(t), e.touches.length); }); wx.onTouchMove(e => { for (const t of e.changedTouches || e.touches)
            h.move(...p(t), e.touches.length); }); wx.onTouchEnd(e => { for (const t of e.changedTouches)
            h.end(...p(t)); }); wx.onTouchCancel(() => h.cancel()); wx.onHide(() => h.hide()); wx.onShow(() => h.show()); wx.onWindowResize?.(() => { resize(); h.resize(); }); }
    };
}
module.exports = { createWechatPlatform };
