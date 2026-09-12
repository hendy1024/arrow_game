'use strict';
const { period, VERSION } = require('./rules');
function createRaceWechat(wx) {
    let context, shownPeriod, denied = false, generation = 0;
    const get = () => context || (context = wx.getOpenDataContext());
    function showFriends(periodKey) {
        shownPeriod = periodKey;
        const token = ++generation;
        const show = () => { if (token !== generation) return; denied = false; get().postMessage({ type: 'show', period: periodKey, version: VERSION }); };
        if (!wx.authorize) { show(); return; }
        wx.authorize({ scope: 'scope.WxFriendInteraction', success: show, fail() { if (token !== generation) return; denied = true; get().postMessage({ type: 'error', message: '需要好友授权，点击下方重试' }); } });
    }
    return {
        async publishRace(record) {
            if (period(record.kind).key !== record.period) return false;
            const key = 'arrow-race-' + record.kind + '-v' + VERSION;
            const previous = wx.getStorageSync(key);
            const best = previous?.period === record.period && previous.elapsed < record.elapsed ? previous : record;
            wx.setStorageSync(key, best);
            await new Promise((resolve, reject) => wx.setUserCloudStorage({ KVDataList: [{ key, value: JSON.stringify({ period: best.period, elapsed: best.elapsed, version: VERSION }) }], success: resolve, fail: reject }));
            return true;
        },
        showFriends,
        nextFriends() { if (denied && wx.openSetting) wx.openSetting({ success() { showFriends(shownPeriod); } }); else get().postMessage({ type: 'next' }); },
        closeFriends() { generation++; get().postMessage({ type: 'close' }); },
        drawFriends(ctx, rect) {
            const canvas = get().canvas;
            if (canvas.width !== 560 || canvas.height !== 360) { canvas.width = 560; canvas.height = 360; get().postMessage({ type: 'resize' }); }
            ctx.drawImage(canvas, rect.x, rect.y, rect.width, rect.height);
        }
    };
}
module.exports = { createRaceWechat };
