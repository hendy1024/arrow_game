'use strict';
const canvas = wx.getSharedCanvas(), ctx = canvas.getContext('2d');
let request = 0, active = false, page = 0, rows = [], message = '', mine = null, mineStatus = '', event;
let friendError = '';
function errorDetail(api, error) {
    const detail = [error?.errCode ?? error?.errno, error?.errMsg || error?.message || '微信未返回具体原因'].filter(v=>v!==undefined).join(' · ');
    console.warn(api + ' failed', detail);
    return detail;
}
function time(ms) { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '.' + Math.floor(ms % 1000 / 100); }
function pageSize() { return Math.max(1, Math.floor((canvas.height - 150) / 64)); }
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!active) return;
    ctx.fillStyle = '#7b8579'; ctx.font = '28px sans-serif'; ctx.textAlign = 'left';
    if (message) ctx.fillText(message, 8, 42);
    else rows.slice(page * pageSize(), (page + 1) * pageSize()).forEach((r, i) => {
        ctx.fillStyle = '#263f36'; ctx.fillText(String(page * pageSize() + i + 1) + '. ' + String(r.nickname || '微信好友').slice(0, 8), 8, 40 + i * 64);
        ctx.textAlign = 'right'; ctx.fillText(time(r.elapsed), canvas.width - 8, 40 + i * 64); ctx.textAlign = 'left';
    });
    if (friendError) {
        ctx.fillStyle = '#ae5949'; ctx.font = '22px sans-serif';
        const count = Math.max(8, Math.floor((canvas.width - 16) / 22)), limit = Math.max(0, Math.floor((canvas.height - 210) / 28));
        for(let i=0;i<limit&&i*count<friendError.length;i++)ctx.fillText(friendError.slice(i*count,(i+1)*count),8,82+i*28);
    }
    ctx.fillStyle = '#7b8579'; ctx.font = '24px sans-serif';
    ctx.fillText('第' + (page + 1) + '/' + Math.max(1, Math.ceil(rows.length / pageSize())) + '页 · 本期最佳用时', 8, canvas.height - 108);
    ctx.fillStyle = '#397356'; ctx.font = 'bold 30px sans-serif'; ctx.fillText('我', 8, canvas.height - 66);
    if (mine !== null) { ctx.textAlign = 'right'; ctx.fillText(time(mine), canvas.width - 8, canvas.height - 66); ctx.textAlign = 'left'; }
    ctx.font = '24px sans-serif'; ctx.fillText(mineStatus, 8, canvas.height - 24);
}
function score(list, key, expected, version) {
    try { const s = JSON.parse((list || []).find(k => k.key === key)?.value || 'null'); return s?.period === expected && s.version === version && Number.isFinite(s.elapsed) && s.elapsed > 0 ? s.elapsed : null; } catch { return null; }
}
wx.onMessage(data => {
    if (data.type === 'close') { active = false; request++; draw(); return; }
    if (data.type === 'resize') { page = 0; draw(); return; }
    if (data.type === 'next') { page = (page + 1) % Math.max(1, Math.ceil(rows.length / pageSize())); draw(); return; }
    if (data.type !== 'show') return;
    event = data; active = true; page = 0; rows = []; friendError = ''; message = data.friendsAllowed === false ? data.notice || '授权后可查看好友成绩' : '正在读取好友成绩…';
    mine = Number.isFinite(data.localElapsed) && data.localElapsed > 0 ? data.localElapsed : null; mineStatus = '正在核对我的成绩…'; draw();
    const token = ++request, key = 'arrow-race-' + event.period.split(':')[0] + '-v' + event.version, expected = event.period;
    if (data.readOwn === false) { mineStatus = mine === null ? '同意隐私后核对本人云端成绩' : '本机成绩 · 同意隐私后核对同步'; draw(); }
    else if (wx.getUserCloudStorage) wx.getUserCloudStorage({ keyList: [key], success(result) {
        if (token !== request) return;
        const cloud = score(result.KVDataList, key, expected, data.version);
        if (cloud !== null && (mine === null || cloud <= mine)) { mine = cloud; mineStatus = '本期成绩已同步'; }
        else if (mine !== null) mineStatus = '本机成绩待同步，请到个人榜同步';
        else mineStatus = data.oldVersion ? '本期旧版成绩在个人榜，新版需重跑' : '完成本期3关后即可记录成绩';
        draw();
    }, fail(error) { if (token !== request) return; errorDetail('getUserCloudStorage',error); mineStatus = mine === null ? '我的成绩读取失败，请刷新' : '本机成绩 · 同步状态未确认'; draw(); } });
    else { mineStatus = '请在微信中读取本人托管成绩'; draw(); }
    if (data.friendsAllowed === false) return;
    wx.getFriendCloudStorage({ keyList: [key], success(result) {
        if (token !== request) return;
        rows = (result.data || []).flatMap(user => { const elapsed = score(user.KVDataList, key, expected, data.version); return elapsed === null ? [] : [{ nickname: user.nickname, elapsed }]; }).sort((a,b) => a.elapsed-b.elapsed || String(a.nickname).localeCompare(String(b.nickname)));
        message = rows.length ? '' : '暂无好友完成本期3关'; draw();
    }, fail(error) { if (token !== request) return; friendError = errorDetail('getFriendCloudStorage',error); message = '好友成绩读取失败，请点击刷新'; draw(); } });
});
