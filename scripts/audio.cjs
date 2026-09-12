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
// Original 16-second Cmaj7 / Am7 / Fmaj7 / Gsus loop. Wrapped note tails
// keep the seam continuous; no downloaded recording or network dependency.
function musicWav() {
    const rate = 22050, seconds = 16, length = rate * seconds;
    const samples = new Float64Array(length), out = wav([0], seconds);
    const hz = midi => 440 * 2 ** ((midi - 69) / 12);
    function note(start, duration, midi, gain, bell) {
        for (let i = 0; i < duration * rate; i++) {
            const t = i / rate, u = t / duration, phase = 2 * Math.PI * hz(midi) * t;
            const envelope = bell ? Math.min(1, t / .018) * Math.exp(-3 * t) * Math.min(1, (duration - t) / .2) : Math.sin(Math.PI * u) ** 2;
            const tone = Math.sin(phase) + (bell ? .25 * Math.sin(2 * phase) * Math.exp(-4 * t) : .12 * Math.sin(2 * phase));
            samples[(Math.round(start * rate) + i) % length] += gain * envelope * tone;
        }
    }
    const chords = [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 60]];
    const melody = [[72, 76, 79, 74], [72, 76, 79, 76], [69, 72, 76, 72], [67, 74, 79, 74]];
    for (let bar = 0; bar < 4; bar++) {
        for (const pitch of chords[bar]) note(bar * 4, 5, pitch, .07, false);
        for (let beat = 0; beat < 4; beat++) note(bar * 4 + beat, 2, melody[bar][beat], .23, true);
    }
    for (let i = 0; i < length; i++) out.writeInt16LE(Math.round(Math.max(-.9, Math.min(.9, samples[i])) * 32767), 44 + i * 2);
    return out;
}
function buildAudio() { const music = musicWav(); for (const target of ['wechat', 'preview']) {
    const dir = path.join(__dirname, '../dist', target, 'assets');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'music.wav'), music);
    for (const [name, freq, seconds] of [['removed', [740], .14], ['blocked', [220], .10], ['won', [523, 659, 784], .42]])
        fs.writeFileSync(path.join(dir, name + '.wav'), wav(freq, seconds));
} }
module.exports = { wav, musicWav, buildAudio };
