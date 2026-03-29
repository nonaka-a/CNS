/**
 * --- ENGINE SETTINGS ---
 */
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 600;
let canvas, ctx;
let isGameRunning = false;
let lastFrameTime = 0;
const TARGET_FPS = 60;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

const keys = {
    ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false,
    KeyA: false, KeyB: false, KeyC: false, KeyD: false
};

let sakuyaConfig = null;
let mitamaConfig = null;
let droneConfig = null;

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
let halfwayReached = false;
let isHalfwayTransitioning = false;
let halfwayTransitionTimer = 0;
let isSecondScene = false;
let ninjutsuGauge = 0;
const NINJUTSU_MAX = 10; // 10体倒すと満タン
let ninjutsuFullTriggered = false;
let gameOver = false;
let isOpRunning = false;
let opTime = 0; 
let opConfig = null;
let isIntro = true;
const INTRO_TARGET_X = 410;

const sakuya = {
    x: -150, y: 0, w: 180, h: 180, vx: 0, vy: 0,
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
    img: new Image(),
    currentAnim: 'idle', currentFrame: 0, frameTimer: 0,
    jumpOffset: 0, vy: 0
};
mitama.img.src = 'images/mitama.png';

let bullets = [];
let enemies = [];
let enemyLasers = [];
let platforms = [];
const syurikenImg = new Image();
syurikenImg.src = 'images/syuriken_2.png';
const bgImg = new Image();
bgImg.src = 'images/BG1.jpg';
const bgImg2 = new Image();
bgImg2.src = 'images/BG2.jpg';
const droneImg = new Image();
droneImg.src = 'images/droneA.png';
const guardrailImg = new Image();
guardrailImg.src = 'images/Guardrail.png';
const vignetteImg = new Image();
vignetteImg.src = 'images/vignette.png';
let bgX = 0;
let isSoundOn = true;
let canShoot = true;
let isPaused = false;
let enemyIdCounter = 0;
let giantShuriken = null;
let explosions = [];
const explosionImg = new Image();
explosionImg.src = 'images/Explosion_A.png';
const droneEnergyImg = new Image();
droneEnergyImg.src = 'images/drone_Energy.png';
let audioCtx = null;
const seBuffers = {};
let opAudioSources = {}; // layerId -> sourceNode
const bgm = new Audio('sound/BGM1.mp3');
bgm.loop = true;
bgm.volume = 0.4; // プレイの邪魔にならない程度の音量に設定
bgm.muted = !isSoundOn;

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

function playSE(name, volume = 1.0) {
    if (!isSoundOn) return;
    if (!audioCtx || !seBuffers[name]) return;
    const source = audioCtx.createBufferSource();
    source.buffer = seBuffers[name];
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = volume;
    
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    source.start(0);
}