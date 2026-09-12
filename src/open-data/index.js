'use strict';
const canvas = wx.getSharedCanvas(), ctx = canvas.getContext('2d');
let request = 0, active = false, page = 0, rows = [], message = '', event;
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!active) return;
    ctx.fillStyle = '#7b8579'; ctx.font = '24px sans-serif'; ctx.textAlign = 'left';
    if (message) { ctx.fillText(message, 8, 45); return; }
    rows.slice(page * 5, page * 5 + 5).forEach((r, i) => {
        ctx.fillStyle = '#263f36'; ctx.fillText(String(page * 5 + i + 1) + '. ' + String(r.nickname || '微信好友').slice(0, 10), 8, 38 + i * 55);
        const sec = Math.floor(r.elapsed / 1000); ctx.textAlign = 'right'; ctx.fillText(Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') + '.' + Math.floor(r.elapsed % 1000 / 100), canvas.width - 8, 38 + i * 55); ctx.textAlign = 'left';
    });
    ctx.fillStyle = '#7b8579'; ctx.fillText('第' + (page + 1) + '/' + Math.max(1, Math.ceil(rows.length / 5)) + '页 · 本期最佳用时', 8, 330);
}
wx.onMessage(data => {
    if (data.type === 'error') { active = true; request++; message = data.message; draw(); return; }
    if (data.type === 'close') { active = false; request++; draw(); return; }
    if (data.type === 'resize') { draw(); return; }
    if (data.type === 'next') { page = (page + 1) % Math.max(1, Math.ceil(rows.length / 5)); draw(); return; }
    if (data.type !== 'show') return;
    event = data; active = true; page = 0; rows = []; message = '正在读取好友成绩…'; draw();
    const token = ++request, key = 'arrow-race-' + event.period.split(':')[0] + '-v' + event.version, expected = event.period;
    wx.getFriendCloudStorage({ keyList: [key], success(result) {
        if (token !== request) return;
        rows = (result.data || []).flatMap(user => {
            try { const score = JSON.parse(user.KVDataList.find(k => k.key === key)?.value || 'null'); return score?.period === expected && score.version === data.version && Number.isFinite(score.elapsed) && score.elapsed > 0 ? [{ nickname: user.nickname, elapsed: score.elapsed }] : []; } catch { return []; }
        }).sort((a, b) => a.elapsed - b.elapsed || String(a.nickname).localeCompare(String(b.nickname)));
        message = rows.length ? '' : '暂无好友完成本期10关'; draw();
    }, fail() { if (token !== request) return; message = '好友榜暂不可用，请返回重试'; draw(); } });
});
