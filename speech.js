const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
export function initSpeech(onResult, onEnd) {
    if (!SpeechRecognition) {
        alert('Speech recognition not supported');
        return;
    }
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
    };
    recognition.onend = onEnd;
    recognition.onerror = (e) => console.error('Speech error', e);
}
export function startListening() {
    if (recognition) recognition.start();
}
export function speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
}
