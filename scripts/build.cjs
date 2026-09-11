'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
function bundle(entry) {
    const modules = new Map();
    function visit(file) {
        file = path.resolve(file);
        const id = path.relative(root, file).replaceAll('\\', '/');
        if (modules.has(id))
            return id;
        modules.set(id, '');
        const source = fs.readFileSync(file, 'utf8').replace(/require\(['"](\.[^'"]+)['"]\)/g, (_, ref) => {
            const target = path.resolve(path.dirname(file), ref + (path.extname(ref) ? '' : '.js'));
            return `require(${JSON.stringify(visit(target))})`;
        });
        modules.set(id, source);
        return id;
    }
    const id = visit(path.join(root, entry));
    return `(function(){'use strict';const modules={${[...modules].map(([key, source]) => `${JSON.stringify(key)}:function(module,exports,require){\n${source}\n}`).join(',\n')}};const cache={};function require(id){if(cache[id])return cache[id].exports;const module={exports:{}};cache[id]=module;if(!modules[id])throw new Error('Missing module '+id);modules[id](module,module.exports,require);return module.exports;}require(${JSON.stringify(id)});})();\n`;
}
function build() {
    require('./audio.cjs').buildAudio();
    for (const target of ['wechat', 'preview'])
        fs.mkdirSync(path.join(root, 'dist', target), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist/wechat/game.js'), bundle('src/main-wechat.js'));
    fs.copyFileSync(path.join(root, 'game.json'), path.join(root, 'dist/wechat/game.json'));
    fs.writeFileSync(path.join(root, 'dist/preview/game.js'), bundle('src/main-browser.js'));
    fs.writeFileSync(path.join(root, 'dist/preview/index.html'), '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>箭间 · 本地试玩</title><style>html,body{margin:0;background:#e7e9e1;height:100%;font-family:system-ui}body{display:grid;place-items:center}canvas{width:min(100vw,430px);height:100dvh;max-height:920px;touch-action:none;display:block;background:#f5f3eb}</style><canvas aria-label="箭间游戏棋盘"></canvas><script src="game.js"></script></html>');
    console.log('Built WeChat game and local canvas test harness.');
}
if (require.main === module)
    build();
module.exports = { build, bundle };
