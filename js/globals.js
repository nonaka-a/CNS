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
    KeyA: false, KeyB: false, KeyC: false, KeyD: false, Shoot: false
};

let sakuyaConfig = null;
let mitamaConfig = null;
let droneConfig = null;
let onibiConfig = null; // 追加：鬼火の設定

/**
 * --- GAME LOGIC ---
 */
const GRAVITY = 0.8;
const PLAYER_SPEED = 6;
const GROUND_Y_POS = 420;
const PERSPECTIVE_BASE_Y = 360;
const PERSPECTIVE_SCALE_FACTOR = 0.002;
const goalDistance = 40000;
let distance = 0;
let bgDistance = 0;
let spawnWaveIndex = 0; // 追加：出現パターンの進行管理
let halfwayReached = false;
let goalThresholdReached = false;
let isHalfwayTransitioning = false;
let halfwayTransitionTimer = 0;
let isSecondScene = false;
let isThirdScene = false;
let currentZoom = 1.0; 
let bossActive = false;
let bossDefeated = false;
let bossSpawnTimer = 0;
let bossDefeatTimer = 0; 
let ninjutsuGauge = 0;
const NINJUTSU_MAX = 10;
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
    attackTimer: 0, invincibleTimer: 0, cameraOffsetY: 0,
    healFlashTimer: 0 // 追加：回復時の発光
};
sakuya.img.src = 'images/sakuya.png';

const mitama = {
    x: 0, y: 0, w: 72, h: 72, hp: 50,
    isHolding: true,
    img: new Image(),
    currentAnim: 'idle', currentFrame: 0, frameTimer: 0,
    jumpOffset: 0, vy: 0, invincibleTimer: 0,
    healFlashTimer: 0 // 追加：回復時の発光
};
mitama.img.src = 'images/mitama.png';

let bullets = [];
let enemies = [];
let enemyLasers = [];
let onibis = []; // 追加：鬼火の配列
let items = []; // 追加：アイテムの配列
let itemSpawnTimer = 0; // 追加：アイテム出現タイマー
let platforms = [];
const syurikenImg = new Image();
syurikenImg.src = 'images/syuriken_2.png';
const bgImg = new Image();
bgImg.src = 'images/BG1.jpg';
const bgImg2 = new Image();
bgImg2.src = 'images/BG2.jpg';
const bgImg3 = new Image();
bgImg3.src = 'images/BG3.jpg';
const bgImg3_front = new Image(); 
bgImg3_front.src = 'images/BG3_front.png'; 
const droneImg = new Image();
droneImg.src = 'images/droneA.png';
const onibiImg = new Image(); // 追加：鬼火の画像
onibiImg.src = 'images/onibi.png';
const guardrailImg = new Image();
guardrailImg.src = 'images/Guardrail.png';
const vignetteImg = new Image();
vignetteImg.src = 'images/vignette.png';
const vignette2Img = new Image();
vignette2Img.src = 'images/vignette2.png';
const lightImg = new Image();
lightImg.src = 'images/light.png';
const streetlightImg = new Image();
streetlightImg.src = 'images/Streetlight.png';
const streetlightFrontImg = new Image();
streetlightFrontImg.src = 'images/Streetlight_front.png';
const buildingTopImg = new Image();
buildingTopImg.src = 'images/Building_top.png';
const buildingWallImg = new Image();
buildingWallImg.src = 'images/Building_Wall.png';

const bossImg = new Image();
bossImg.src = 'images/iina.png';

const boss = {
    x: -500, y: 0, w: 180, h: 220, hp: 450, maxHp: 450, 
    groundY: 400, jumpOffset: 0, vx: 2, visible: false,
    animCounter: 0,
    isArrived: false,
    state: 'intro', stateTimer: 0, patternIndex: 1, originalX: 50, laserDuration: 0, telegraphDuration: 0
};

let bgX = 0;
let isSoundOn = true;
let canShoot = true;
let isPaused = false;
let enemyIdCounter = 0;
let giantShuriken = null;
let explosions = [];
let explosionConfig = null;
const explosionImg = new Image();
explosionImg.src = 'images/Explosion_A.png';
const droneEnergyImg = new Image();
droneEnergyImg.src = 'images/drone_Energy.png';
const sausageImg = new Image(); // 追加：ソーセージ画像
sausageImg.src = 'images/Sausage.png';

let audioCtx = null;
const seBuffers = {};
let opAudioSources = {};
let bgmFadeInterval = null;
const bgm = new Audio('sound/BGM1.mp3');
bgm.loop = true;
bgm.volume = 0.4;
bgm.muted = !isSoundOn;
const bgm2 = new Audio('sound/BGM2.mp3');
bgm2.loop = true;
bgm2.volume = 0.4;
bgm2.muted = !isSoundOn;