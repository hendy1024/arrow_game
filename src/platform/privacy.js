'use strict';
// Register before any private API call; consent is decided only by a user tap.
function installPrivacy(wx) {
    if (!wx.onNeedPrivacyAuthorization) return;
    let pending = [], active = false, returning = false;
    const finish = event => {
        const callbacks = pending; pending = []; active = false; returning = false;
        for (const resolve of callbacks) resolve({ event });
    };
    function choose() {
        if (!active) return;
        try {
            wx.showActionSheet({ itemList: ['查看《用户隐私保护指引》', '同意并继续', '暂不同意'],
                success(res) {
                    if (!active) return;
                    if (res.tapIndex === 1) { finish('agree'); return; }
                    if (res.tapIndex !== 0) { finish('disagree'); return; }
                    returning = true;
                    try { wx.openPrivacyContract({ success() {
                        if (!wx.onShow && returning) { returning = false; choose(); }
                    }, fail() {
                        returning = false;
                        wx.showModal({ title: '指引打开失败', content: '暂时无法打开用户隐私保护指引，请稍后重试。', showCancel: false, complete() { finish('disagree'); } });
                    } }); } catch { finish('disagree'); }
                }, fail() { finish('disagree'); }
            });
        } catch { finish('disagree'); }
    }
    wx.onShow?.(() => { if (returning && active) { returning = false; choose(); } });
    wx.onNeedPrivacyAuthorization(resolve => {
        pending.push(resolve);
        if (active) return;
        active = true;
        try {
            wx.showModal({ title: '用户隐私保护指引',
                content: '为提供好友排行榜，我们将按《用户隐私保护指引》使用微信朋友关系，读取并展示你和同玩好友的竞速成绩。你可以查看完整指引，并选择是否同意；拒绝不影响普通游戏和本机个人榜。',
                confirmText: '查看选项', cancelText: '暂不同意',
                success(res) { if (res.confirm) choose(); else finish('disagree'); },
                fail() { finish('disagree'); }
            });
            if (active) resolve({ event: 'exposureAuthorization' });
        } catch { finish('disagree'); }
    });
}
module.exports = { installPrivacy };
