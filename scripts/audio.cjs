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
// Original 120 BPM, eight-bar C-major loop: bright mallet melody and light bass.
// Wrapped note tails
// keep the seam continuous; no downloaded recording or network dependency.
function musicWav() {
    const rate = 22050, seconds = 16, length = rate * seconds;
    const samples = new Float64Array(length), out = wav([0], seconds);
    const hz = midi => 440 * 2 ** ((midi - 69) / 12);
    function note(start, duration, midi, gain, bell) {
        for (let i = 0; i < duration * rate; i++) {
            const t = i / rate, u = t / duration, phase = 2 * Math.PI * hz(midi) * t;
            const envelope = bell ? Math.min(1, t / .008) * Math.exp(-7 * t) * Math.min(1, (duration - t) / .08) : Math.sin(Math.PI * u) ** 2;
            const tone = Math.sin(phase) + (bell ? .25 * Math.sin(2 * phase) * Math.exp(-4 * t) : .12 * Math.sin(2 * phase));
            samples[(Math.round(start * rate) + i) % length] += gain * envelope * tone;
        }
    }
    const chords = [[48,55,64],[53,60,69],[55,62,71],[48,55,64],[45,52,60],[53,60,69],[55,62,71],[48,55,64]];
    const melody = [[72,76,79,76,81,79,76,74],[77,81,84,81,79,77,76,72],[74,79,83,79,81,79,77,74],[76,79,84,79,76,74,72,76],[76,81,84,81,79,76,74,72],[77,81,84,81,86,84,81,77],[79,83,86,83,81,79,77,74],[76,79,84,79,76,74,72,79]];
    for (let bar = 0; bar < 8; bar++) {
        for (let beat = 0; beat < 4; beat++) {
            note(bar*2+beat*.5,.35,chords[bar][beat%2?1:0]-12,.19,true);
            for(const pitch of chords[bar].slice(1))note(bar*2+beat*.5+.25,.22,pitch,.08,true);
        }
        for (let step = 0; step < 8; step++) note(bar * 2 + step*.25, .48, melody[bar][step], step%2?.22:.28, true);
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
