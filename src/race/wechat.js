'use strict';
const { period, VERSION } = require('./rules');
function createRaceWechat(wx) {
    require('../platform/privacy').installPrivacy(wx);
    let context, shownPeriod, generation = 0;
    const rankState = { authorization: 'unknown' };
    const get = () => context || (context = wx.getOpenDataContext());
    function localBest(periodKey) {
        try {
            const records = JSON.parse(wx.getStorageSync('arrow-garden.race-history.v1') || '[]');
            const cached = wx.getStorageSync('arrow-race-' + periodKey.split(':')[0] + '-v' + VERSION);
            const current = [...(Array.isArray(records) ? records : []), cached].filter(r => r?.period === periodKey && Number.isFinite(r.elapsed) && r.elapsed > 0);
            return { elapsed: current.filter(r => r.version === VERSION).sort((a,b) => a.elapsed-b.elapsed)[0]?.elapsed || null, oldVersion: current.some(r => r.version !== VERSION) };
        } catch { return { elapsed: null, oldVersion: false }; }
    }
    function post(periodKey, allowed, notice, readOwn = true) { const local = localBest(periodKey); get().postMessage({ type: 'show', period: periodKey, version: VERSION, friendsAllowed: allowed, notice, localElapsed: local.elapsed, oldVersion: local.oldVersion, readOwn }); }
    function showFriends(periodKey) {
        shownPeriod = periodKey; rankState.authorizing = false;
        const token = ++generation;
        post(periodKey, false, '正在检查好友授权…', false);
        const readSetting = () => {
            if (token !== generation) return;
            if (!wx.getSetting) { rankState.authorization = 'unknown'; post(periodKey, false, '授权后可查看同玩好友成绩'); return; }
            wx.getSetting({ success(res) {
                if (token !== generation) return;
                const allowed = res.authSetting?.['scope.WxFriendInteraction'];
                rankState.authorization = allowed === true ? 'granted' : allowed === false ? 'denied' : 'unknown';
                post(periodKey, allowed === true, allowed === true ? '' : '授权后可查看同玩好友成绩');
            }, fail() { if (token !== generation) return; rankState.authorization = 'unknown'; post(periodKey, false, '授权状态读取失败，请刷新重试'); } });
        };
        if (wx.getPrivacySetting) wx.getPrivacySetting({ success(res) {
            if (token !== generation) return;
            if (res.needAuthorization) { rankState.authorization = 'unknown'; post(periodKey, false, '请点击好友授权，同意隐私指引', false); }
            else readSetting();
        }, fail() { if (token !== generation) return; rankState.authorization = 'unknown'; post(periodKey, false, '隐私状态读取失败，请点击授权', false); } });
        else readSetting();
    }
    return {
        rankState,
        async publishRace(record) {
            if (record.version !== VERSION || period(record.kind).key !== record.period) return false;
            const key = 'arrow-race-' + record.kind + '-v' + VERSION;
            const previous = wx.getStorageSync(key);
            const best = previous?.period === record.period && previous.elapsed < record.elapsed ? previous : record;
            wx.setStorageSync(key, best);
            await new Promise((resolve, reject) => wx.setUserCloudStorage({ KVDataList: [{ key, value: JSON.stringify({ period: best.period, elapsed: best.elapsed, version: VERSION }) }], success: resolve, fail: reject }));
            return true;
        },
        showFriends,
        authorizeFriends() {
            if (rankState.authorizing) return;
            const token = ++generation;
            rankState.authorizing = true; rankState.lastError = null;
            const current = () => token === generation;
            const failed = (stage, error) => {
                if (!current()) return;
                rankState.authorizing = false; rankState.authorization = 'unknown';
                const detail = String(error?.errMsg || error?.message || '微信未返回具体原因').slice(0, 300);
                rankState.lastError = { stage, message: detail };
                post(shownPeriod, false, stage === 'privacy' ? '隐私授权未完成，请查看提示' : '好友授权未完成，请查看提示', stage !== 'privacy');
                const show = denied => {
                    if (!current()) return;
                    rankState.authorization = denied ? 'denied' : 'unknown';
                    const hint = /official popup|onNeedPrivacyAuthorization/.test(detail) ? '\n隐私告知弹窗尚未生效，请重新编译并扫码进入最新预览包。' : '\n若已同意仍失败，请检查后台隐私指引配置，并保留此错误信息。';
                    const content = (stage === 'privacy' ? '微信隐私授权未完成。' : '微信好友权限请求未完成。') + '\n' + detail + (denied ? '\n微信设置返回该权限未开启，可选择去设置检查。' : hint);
                    wx.showModal?.({ title: '授权未完成', content, showCancel: denied, confirmText: denied ? '去设置' : '知道了', cancelText: '取消', success(res) {
                        if (!current() || !denied || !res.confirm) return;
                        wx.openSetting?.({ success() { if (current()) showFriends(shownPeriod); }, fail(e) { if (!current()) return; rankState.lastError = { stage: 'settings', message: String(e?.errMsg || '设置打开失败') }; post(shownPeriod, false, '设置打开失败，请重试'); } });
                    } });
                };
                if (stage === 'friends' && wx.getSetting) wx.getSetting({ success(res) { show(res.authSetting?.['scope.WxFriendInteraction'] === false); }, fail() { show(false); } });
                else show(false);
            };
            const request = () => {
                if (!current()) return;
                if (!wx.authorize) { failed('friends', { errMsg: '当前微信环境不支持 wx.authorize' }); return; }
                try { wx.authorize({ scope: 'scope.WxFriendInteraction', success() {
                    if (!current()) return;
                    rankState.authorizing = false; rankState.authorization = 'granted'; rankState.lastError = null;
                    post(shownPeriod, true, '');
                }, fail(e) { failed('friends', e); } }); } catch(e) { failed('friends', e); }
            };
            if (wx.requirePrivacyAuthorize) {
                try { wx.requirePrivacyAuthorize({ success: request, fail(e) { failed('privacy', e); } }); } catch(e) { failed('privacy', e); }
            } else request();
        },
        nextFriends() { get().postMessage({ type: 'next' }); },
        closeFriends() { generation++; rankState.authorizing = false; get().postMessage({ type: 'close' }); },
        drawFriends(ctx, rect) {
            const canvas = get().canvas, width = Math.round(rect.width * 2), height = Math.round(rect.height * 2);
            if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; get().postMessage({ type: 'resize' }); }
            ctx.drawImage(canvas, rect.x, rect.y, rect.width, rect.height);
        }
    };
}
module.exports = { createRaceWechat };
