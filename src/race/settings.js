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
const settings = validate(require('../../config/race-difficulty.json'));
module.exports = { settings, validate, version };
