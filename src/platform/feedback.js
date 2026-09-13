'use strict';
function createFeedback(createAudio, vibrate) {
    const sounds = new Map();
    return { play(kind, settings) {
            if (settings.vibration)
                try {
                    vibrate(kind);
                }
                catch { }
            if (!settings.sound)
                return;
            try {
                let sound = sounds.get(kind);
                if (!sound) {
                    sound = createAudio(kind);
                    if (!sound)
                        return;
                    sounds.set(kind, sound);
                }
                else sound.stop?.();
                const result = sound.play();
                result?.catch?.(() => { });
            }
            catch { }
        }, stop() { for (const sound of sounds.values())
            try {
                sound.stop?.();
            }
            catch { } }, destroy() { for (const sound of sounds.values())
            try {
                sound.destroy?.();
            }
            catch { } sounds.clear(); } };
}
module.exports = { createFeedback };
