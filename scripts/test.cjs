'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path');
const stage = process.argv[2];
const files = fs.readdirSync(path.join(__dirname, '../tests')).filter(x => x.endsWith('.test.cjs') && (!stage || x.startsWith(stage + '-'))).sort();
if (!files.length)
    throw new Error('No tests matched ' + stage);
const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files.map(x => 'tests/' + x)], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
fs.mkdirSync(path.join(__dirname, '../reports'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../reports', stage ? stage + '-tests.log' : 'all-tests.log'), (r.stdout || '') + (r.stderr || ''));
process.exit(r.status === null ? 1 : r.status);
