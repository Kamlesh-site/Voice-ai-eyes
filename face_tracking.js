import * as faceapi from 'face-api.js';
export async function setupFaceTracking(videoElement, onFaceDetected, onBlink) {
    await faceapi.nets.tinyFaceDetector.loadFromUri('/lib/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/lib/models');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = stream;
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320 });
    let prevEyeOpen = true;
    setInterval(async () => {
        const detections = await faceapi.detectSingleFace(videoElement, options).withFaceLandmarks();
        if (detections) {
            const box = detections.detection.box;
            const x = (box.x + box.width/2) / videoElement.videoWidth * 2 - 1;
            const y = (box.y + box.height/2) / videoElement.videoHeight * 2 - 1;
            onFaceDetected(x, -y);
            const landmarks = detections.landmarks;
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();
            const eyeAspectRatio = (dist(leftEye[1], leftEye[5]) + dist(leftEye[2], leftEye[4])) / (2 * dist(leftEye[0], leftEye[3]));
            const eyeClosed = eyeAspectRatio < 0.2;
            if (prevEyeOpen && eyeClosed && onBlink) onBlink();
            prevEyeOpen = !eyeClosed;
        } else {
            onFaceDetected(0, 0);
        }
    }, 100);
}
function dist(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}
