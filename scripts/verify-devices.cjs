'use strict';
const fs = require('node:fs'), path = require('node:path');
const report = JSON.parse(fs.readFileSync(path.join(__dirname, '../reports/device-validation.json'), 'utf8'));
const missing = [];
if (report.devtools.status !== 'passed' || !report.devtools.baseLibrary || !report.devtools.compiledAt || !report.devtools.evidence)
    missing.push('微信开发者工具实际编译及证据');
for (const key of ['ios', 'android']) {
    const r = report[key];
    if (r.status !== 'passed' || !r.model || !r.os || !r.wechatVersion || !r.evidence || !Number.isFinite(r.minimumSustainedFps) || r.minimumSustainedFps < 30 || !Number.isFinite(r.clickFeedbackMs) || r.clickFeedbackMs > 100)
        missing.push(key + ' 真机功能、性能与证据');
}
if (!report.lowerPerformanceDeviceCovered)
    missing.push('较低性能设备覆盖');
if (!report.tuningConfirmed)
    missing.push('手机试玩后的参数确认');
if (missing.length) {
    console.error('真实设备验收尚未完成：\n' + missing.map(x => ' - ' + x).join('\n'));
    process.exitCode = 1;
}
else
    console.log('Recorded device acceptance complete.');
