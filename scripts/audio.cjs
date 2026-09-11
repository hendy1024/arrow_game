'use strict';
const fs = require('node:fs'), path = require('node:path');
function wav(frequencies, seconds) {
    const rate = 22050, length = Math.round(rate * seconds), buffer = Buffer.alloc(44 + length * 2);
    buffer.write('RIFF');
    buffer.writeUInt32LE(buffer.length - 8, 4);
    buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(rate, 24);
    buffer.writeUInt32LE(rate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(length * 2, 40);
    for (let i = 0; i < length; i++) {
        const t = i / rate, f = frequencies[Math.min(frequencies.length - 1, Math.floor(i / length * frequencies.length))], envelope = Math.min(1, t / .012) * Math.max(0, 1 - t / seconds) ** 2;
        buffer.writeInt16LE(Math.round(Math.sin(2 * Math.PI * f * t) * envelope * 6500), 44 + i * 2);
    }
    return buffer;
}
function buildAudio() { for (const target of ['wechat', 'preview']) {
    const dir = path.join(__dirname, '../dist', target, 'assets');
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, freq, seconds] of [['removed', [740], .14], ['blocked', [220], .10], ['won', [523, 659, 784], .42]])
        fs.writeFileSync(path.join(dir, name + '.wav'), wav(freq, seconds));
} }
module.exports = { wav, buildAudio };
