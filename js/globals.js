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
const goalDistance = 40000;
let distance = 0;
let gameOver = false;

const sakuya = {
    x: 150, y: 0, w: 180, h: 180, vx: 0, vy: 0,
    groundY: 0, jumpOffset: 0,
    jumpPower: -18, isJumping: false, hp: 100,
    img: new Image(),
    currentAnim: 'idle', currentFrame: 0, frameTimer: 0, jumpCount: 0
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