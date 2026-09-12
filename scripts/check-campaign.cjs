'use strict';
const { solve } = require('../src/generation/validate');
function check(levels = require('../config/campaign-levels.json')) {
    if (!Array.isArray(levels) || !levels.length || levels.length > 1000 || levels.length % 20) throw Error('普通关卡需按20关一页配置，最多1000关');
    levels.forEach((row, index) => {
        if (row.id !== index + 1 || row.board?.number !== row.id || !solve(row.board).valid) throw Error('无效普通关卡 ' + (index + 1));
        if (!row.rewards || Object.entries(row.rewards).some(([k,v]) => !['time','life','shuffle'].includes(k) || !Number.isInteger(v) || v < 1 || v > 1000)) throw Error('无效奖励 ' + row.id);
    });
    return levels.length;
}
if (require.main === module) console.log('Verified fixed levels: ' + check());
module.exports = { check };
