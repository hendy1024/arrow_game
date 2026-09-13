'use strict';
// One reusable loop; a failed autoplay can retry on the next user gesture.
function createMusic(createAudio) {
    let audio = null, playing = false, destroyed = false, attempt = 0;
    return {
        set(enabled) {
            if (destroyed) return;
            if (!enabled) {
                attempt++;
                if (playing) { try { audio.pause(); } catch { try { audio.stop?.(); } catch { } } }
                playing = false; return;
            }
            if (playing) return;
            const token = ++attempt;
            try {
                if (!audio) {
                    audio = createAudio();
                    if (!audio) return;
                    audio.loop = true; audio.volume = .36;
                    audio.onError?.(() => { playing = false; });
                }
                playing = true;
                const result = audio.play();
                result?.catch?.(() => { if (token === attempt) playing = false; });
            } catch { playing = false; }
        },
        destroy() {
            this.set(false); destroyed = true;
            try { audio?.destroy?.(); } catch { }
            audio = null;
        }
    };
}
module.exports = { createMusic };
