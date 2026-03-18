import { EyeRenderer } from './eye_engine.js';
import { setupFaceTracking } from './face_tracking.js';
import { initWakeword } from './wakeword.js';
import { initSpeech, startListening, speak } from './speech.js';

let eyeRenderer;
let jwtToken = '';
let userEmail = '';

async function login() {
    const email = prompt('Enter email');
    const password = prompt('Enter password');
    const response = await fetch('http://127.0.0.1:5000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password })
    });
    if (response.ok) {
        const data = await response.json();
        jwtToken = data.access_token;
        userEmail = data.email;
        console.log('Logged in as', data.ai_name);
        initAssistant();
    } else {
        alert('Login failed');
    }
}

async function initAssistant() {
    eyeRenderer = new EyeRenderer('eye-canvas');
    const video = document.getElementById('video');
    setupFaceTracking(video, (x, y) => {
        eyeRenderer.updateLookDirection(x, y);
    }, () => {}); // blink callback optional

    try {
        await initWakeword('/lib/models/heynova.ppn', () => {
            console.log('Wake word detected');
            eyeRenderer.setState('listening');
            startListening();
        });
    } catch (e) {
        console.error('Wake word init failed', e);
    }

    initSpeech(async (command) => {
        eyeRenderer.setState('thinking');
        const response = await fetch('http://127.0.0.1:5000/commands/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: command, token: jwtToken })
        });
        const data = await response.json();
        eyeRenderer.setState('speaking');
        speak(data.response);
        setTimeout(() => eyeRenderer.setState('idle'), 1000);
    }, () => {
        eyeRenderer.setState('idle');
    });

    eyeRenderer.setState('idle');
}

login();
