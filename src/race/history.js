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
