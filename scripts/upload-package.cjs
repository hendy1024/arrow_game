'use strict';
const fs = require('node:fs'), path = require('node:path');
const runtimeFiles = ['game.js', 'game.json', 'open-data/index.js', 'assets/music.wav', 'assets/blocked.wav', 'assets/removed.wav', 'assets/won.wav'];
function prepare(root) {
    const dir = path.join(root, 'dist/wechat');
    const source = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
    const config = {
        description: '箭间 · 仅运行文件上传工程', projectname: 'arrow-garden-upload', appid: source.appid,
        compileType: 'game', miniprogramRoot: './',
        setting: { es6: true, minified: true, enhance: false, uploadWithSourceMap: false, urlCheck: true },
        packOptions: { ignore: [], include: [] }
    };
    fs.writeFileSync(path.join(dir, 'project.config.json'), JSON.stringify(config, null, 2) + '\n');
    let bytes = 0;
    function scan(folder) {
        for (const file of fs.readdirSync(folder, { withFileTypes: true })) {
            const full = path.join(folder, file.name), relative = path.relative(dir, full).replaceAll('\\', '/');
            if (file.isDirectory()) scan(full);
            else if (!['project.config.json', 'project.private.config.json'].includes(relative)) {
                if (!runtimeFiles.includes(relative)) throw Error('上传目录含非运行文件，请移出后重试：' + relative);
                bytes += fs.statSync(full).size;
            }
        }
    }
    scan(dir);
    for (const file of runtimeFiles) if (!fs.existsSync(path.join(dir, file))) throw Error('缺少上传文件：' + file);
    if (bytes >= 4 * 1024 * 1024) throw Error('运行文件超过4MB，请先缩减资源');
    const report = { runtimeBytes: bytes, limitBytes: 4 * 1024 * 1024, files: runtimeFiles, note: '本地原始运行文件统计；微信编译后的最终大小以开发者工具为准。' };
    fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
    fs.writeFileSync(path.join(root, 'reports/upload-package.json'), JSON.stringify(report, null, 2));
    return report;
}
module.exports = { prepare };
