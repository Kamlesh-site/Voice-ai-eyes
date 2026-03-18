export class EyeRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 10;
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.eyes = [];
        this.state = 'idle';
        this.targetLook = new THREE.Vector2(0, 0);
        this.createEyes();
        this.setupLights();
        this.clock = new THREE.Clock();
        this.animate();
    }
    createEyes() {
        const geometry = new THREE.SphereGeometry(1, 64, 64);
        const textureLoader = new THREE.TextureLoader();
        const irisMap = textureLoader.load('assets/iris.jpg');
        const corneaMap = textureLoader.load('assets/cornea.jpg');
        const material = new THREE.MeshPhongMaterial({ map: irisMap, shininess: 30, emissive: 0x222222 });
        const eyeLeft = new THREE.Mesh(geometry, material);
        eyeLeft.position.set(-2, 0, 0);
        this.scene.add(eyeLeft);
        const eyeRight = new THREE.Mesh(geometry, material);
        eyeRight.position.set(2, 0, 0);
        this.scene.add(eyeRight);
        const corneaMat = new THREE.MeshPhongMaterial({ map: corneaMap, transparent: true, opacity: 0.3, emissive: 0x000000 });
        const corneaLeft = new THREE.Mesh(geometry, corneaMat);
        corneaLeft.position.copy(eyeLeft.position);
        this.scene.add(corneaLeft);
        const corneaRight = new THREE.Mesh(geometry, corneaMat);
        corneaRight.position.copy(eyeRight.position);
        this.scene.add(corneaRight);
        this.eyes = [eyeLeft, eyeRight, corneaLeft, corneaRight];
    }
    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404060);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(5, 5, 5);
        this.scene.add(dirLight);
        const pointLight = new THREE.PointLight(0x88aaff, 0.5);
        pointLight.position.set(0, 3, 5);
        this.scene.add(pointLight);
    }
    setState(newState) {
        this.state = newState;
        this.eyes.slice(0,2).forEach(eye => {
            switch(newState) {
                case 'listening': eye.scale.set(1.1, 1, 1); break;
                case 'thinking': eye.scale.set(1, 1.2, 1); break;
                case 'speaking': eye.scale.set(1.05, 0.95, 1); break;
                case 'sleep': eye.scale.set(0.9, 0.9, 0.9); break;
                default: eye.scale.set(1,1,1);
            }
        });
    }
    updateLookDirection(x, y) {
        this.targetLook.set(x, y);
    }
    animate() {
        requestAnimationFrame(() => this.animate());
        const time = performance.now() / 1000;
        this.eyes.forEach(eye => {
            eye.rotation.y = this.targetLook.x * 0.5;
            eye.rotation.x = -this.targetLook.y * 0.3;
        });
        if (Math.sin(time * 5) > 0.9 && this.state !== 'sleep') {
            this.eyes.slice(0,2).forEach(eye => eye.scale.y = 0.1);
        } else {
            this.eyes.slice(0,2).forEach(eye => eye.scale.y = 1);
        }
        if (this.state === 'idle') {
            this.eyes[0].rotation.y += (Math.random() - 0.5) * 0.02;
            this.eyes[1].rotation.y += (Math.random() - 0.5) * 0.02;
        }
        this.renderer.render(this.scene, this.camera);
    }
}
