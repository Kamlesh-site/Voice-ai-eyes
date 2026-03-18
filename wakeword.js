import { Porcupine } from '@picovoice/porcupine-web';
let porcupine = null;
let wakeWordDetectedCallback = null;
export async function initWakeword(keywordPath, onWakeWord) {
    wakeWordDetectedCallback = onWakeWord;
    const accessKey = 'YOUR_ACCESS_KEY'; // Replace with your Picovoice access key
    porcupine = await Porcupine.create(
        accessKey,
        [{ publicPath: keywordPath, custom: true }],
        (index) => {
            if (wakeWordDetectedCallback) wakeWordDetectedCallback();
        }
    );
    await porcupine.start();
}
export function stopWakeword() {
    if (porcupine) porcupine.stop();
}
