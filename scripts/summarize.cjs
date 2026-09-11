'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const text = fs.readFileSync(path.join(root, 'reports/all-tests.log'), 'utf8');
function number(name) {
    const values = [...text.matchAll(new RegExp('(?:^|\\n)[^\\n]*?\\b' + name + ' (\\d+)\\s*(?:\\n|$)', 'g'))];
    if (!values.length) throw new Error('Missing test count: ' + name);
    return Number(values[values.length - 1][1]);
}
const counts = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(k => [k, number(k)]));
if (counts.fail || counts.cancelled || counts.skipped || counts.todo || counts.tests !== counts.pass) {
    throw new Error('Full test suite is not entirely passing: ' + JSON.stringify(counts));
}
const summary = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    automated: { status: 'passed', ...counts },
    generation: JSON.parse(fs.readFileSync(path.join(root, 'reports/generation.json'), 'utf8')),
    browser: JSON.parse(fs.readFileSync(path.join(root, 'reports/browser.json'), 'utf8')),
    devices: JSON.parse(fs.readFileSync(path.join(root, 'reports/device-validation.json'), 'utf8')),
    overallPlan: 'Local implementation and automation complete; WeChat compilation, real-device verification and tuning remain pending.',
    requestedDestination: 'F:\\User\\wechat_game\\codex',
    destinationCopy: 'Not performed: write permission was not granted by the tool.'
};
fs.writeFileSync(path.join(root, 'reports/summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary.automated));
