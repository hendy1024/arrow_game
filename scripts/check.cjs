'use strict';
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let count = 0;
function scan(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory())
        scan(p);
    else if (/\.(js|cjs)$/.test(p)) {
        const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
        if (r.status !== 0)
            throw new Error(r.stderr);
        count++;
    }
} }
for (const dir of ['src', 'scripts', 'tests'])
    scan(path.join(root, dir));
console.log(`Syntax checked ${count} files.`);
