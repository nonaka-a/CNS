/**
 * --- ENGINE SETTINGS ---
 */
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 600;
let canvas, ctx;
let isGameRunning = false;

const keys = {
    ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false,
    KeyA: false, KeyB: false, KeyC: false, KeyD: false
};

let sakuyaConfig = null;

/**
 * --- GAME LOGIC ---
 */
const GRAVITY = 0.8;
const PLAYER_SPEED = 6;
const GROUND_Y_POS = 420;
const PERSPECTIVE_BASE_Y = 360;  // スケールが1.0倍になる基準のY座標
const PERSPECTIVE_SCALE_FACTOR = 0.002; // 奥と手前でのサイズ変化率
const goalDistance = 40000;
let distance = 0;
let gameOver = false;

const sakuya = {
    x: 150, y: 0, w: 180, h: 180, vx: 0, vy: 0,
    groundY: 0, jumpOffset: 0,
    jumpPower: -18, isJumping: false, hp: 100,
    img: new Image(),
    currentAnim: 'idle', currentFrame: 0, frameTimer: 0, jumpCount: 0,
    attackTimer: 0
};
sakuya.img.src = 'images/sakuya.png';

const mitama = {
    x: 0, y: 0, w: 72, h: 72, hp: 50,
    isHolding: true,
    img: new Image()
};
mitama.img.src = 'images/mitama.png';

let bullets = [];
let enemies = [];
let enemyLasers = [];
const syurikenImg = new Image();
syurikenImg.src = 'images/syuriken_2.png';
const bgImg = new Image();
bgImg.src = 'images/BG1.jpg';
const droneImg = new Image();
droneImg.src = 'images/droneA.png';
let bgX = 0;
let canShoot = true;
let explosions = [];
const explosionImg = new Image();
explosionImg.src = 'images/Explosion_A.png';
let audioCtx = null;
const seBuffers = {};

async function loadSE(name, url) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        seBuffers[name] = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.error(`Failed to load SE: ${name}`, e);
    }
}

function playSE(name) {
    if (!audioCtx || !seBuffers[name]) return;
    const source = audioCtx.createBufferSource();
    source.buffer = seBuffers[name];
    source.connect(audioCtx.destination);
    source.start(0);
}