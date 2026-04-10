const SLOT_WIDTH = 1000;
const SLOT_HEIGHT = 600;

const OMEN_TYPE = {
    ONI: 0, KITUNE: 1, DAN: 2, TENGU: 3, JEI: 4, SENTAI: 5, OKAME: 6, HYO: 7, KAMEN: 8
};

const PAYOUT_RATES = {
    [OMEN_TYPE.ONI]: 10,
    [OMEN_TYPE.KITUNE]: 5,
    [OMEN_TYPE.DAN]: 5,
    [OMEN_TYPE.TENGU]: 3,
    [OMEN_TYPE.JEI]: 3,
    [OMEN_TYPE.SENTAI]: 3,
    [OMEN_TYPE.OKAME]: 2,
    [OMEN_TYPE.HYO]: 2,
    [OMEN_TYPE.KAMEN]: 2
};

const REEL_STRIP = [
    OMEN_TYPE.ONI, OMEN_TYPE.KITUNE, OMEN_TYPE.DAN, OMEN_TYPE.TENGU, 
    OMEN_TYPE.JEI, OMEN_TYPE.SENTAI, OMEN_TYPE.OKAME, OMEN_TYPE.HYO, OMEN_TYPE.KAMEN
];

let slotActive = false;
let slotCanvas, sCtx;
let slotOverlay;
let slotReqId;
let slotParticles = []; 
let lastSlotFrameTime = 0; 

const omenImg = new Image();
omenImg.src = 'images/Sprite/omen.png';
let omenConfig = null;

const ninjaImgs = [new Image(), new Image(), new Image()];
ninjaImgs[0].src = 'images/slot/ninja1.png';
ninjaImgs[1].src = 'images/slot/ninja2.png';
ninjaImgs[2].src = 'images/slot/ninja3.png';

const slotMedalImg = new Image();
slotMedalImg.src = 'images/slot/medal.png';

let medals = 50;
let targetMedals = 50; 
let maxMedals = 50;
let currentBet = 1;

const STATE = { IDLE: 0, SPINNING: 1, STOPPING: 2, PAYOUT: 3 };
let slotState = STATE.IDLE;
let isReach = false;
let payoutTime = 0;

let winTextAnim = { active: false, x: 0, y: 0, targetX: 100, targetY: 50, timer: 0, text: "", amount: 0, baseSize: 72 };
let reels = [];

function addBtnListener(el, callback) {
    const handler = (e) => {
        if (e.cancelable) e.preventDefault();
        callback(e);
    };
    el.addEventListener('touchstart', handler, { passive: false });
    el.addEventListener('mousedown', handler);
}

class Reel {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.pos = Math.random() * REEL_STRIP.length;
        this.speed = 0;
        this.baseSpeed = 0.1; 
        this.isSpinning = false;
        this.isStopping = false;
        this.stopTarget = -1;
        this.resultSymbol = -1;
    }

    update() {
        if (!this.isSpinning) return;
        const prevPos = this.pos;
        this.pos -= this.speed; 
        if (this.pos < 0) this.pos += REEL_STRIP.length;

        if (this.isStopping) {
            let crossed = false;
            if (prevPos >= this.stopTarget && this.pos <= this.stopTarget) crossed = true;
            if (prevPos < 1 && this.pos > REEL_STRIP.length - 1 && this.stopTarget === 0) crossed = true;

            if (crossed || Math.abs(this.pos - this.stopTarget) < this.speed) {
                this.pos = this.stopTarget;
                this.isSpinning = false;
                this.isStopping = false;
                this.resultSymbol = REEL_STRIP[this.stopTarget];
                checkReels();
            }
        }
    }

    draw(ctx) {
        const symbolHeight = 128; 
        const visibleRange = (slotState === STATE.PAYOUT) ? 0 : 1;
        for (let i = -visibleRange; i <= visibleRange; i++) {
            let idx = Math.floor(this.pos) + i;
            while (idx < 0) idx += REEL_STRIP.length;
            while (idx >= REEL_STRIP.length) idx -= REEL_STRIP.length;
            const symbolType = REEL_STRIP[idx];
            const offset = (this.pos - Math.floor(this.pos));
            const drawY = this.y + (i - offset) * symbolHeight;
            drawOmen(ctx, symbolType, this.x, drawY);
        }
    }

    startSpin() {
        this.isSpinning = true;
        this.isStopping = false;
        this.speed = this.baseSpeed;
    }

    stopSpin() {
        if (!this.isSpinning || this.isStopping) return;
        this.isStopping = true;
        this.stopTarget = Math.floor(this.pos);
        if (this.stopTarget < 0) this.stopTarget = REEL_STRIP.length - 1;
    }
}

function drawOmen(ctx, type, x, y) {
    if (!omenImg.complete || !omenConfig) return;
    const keys = ["oni", "kitune", "dan", "tengu", "jei", "sentai", "okame", "hyo", "kamen"];
    const key = keys[type];
    if (key && omenConfig.data[key]) {
        const frame = omenConfig.data[key].frames[0];
        ctx.drawImage(omenImg, frame.x, frame.y, frame.w, frame.h, x - frame.w / 2, y - frame.h / 2, frame.w, frame.h);
    }
}

function loadMedalData() {
    let savedMedals = localStorage.getItem('ninjaSlot_medals');
    let savedMax = localStorage.getItem('ninjaSlot_maxMedals');
    let lastDate = localStorage.getItem('ninjaSlot_lastDate');
    
    if (savedMedals !== null) medals = parseInt(savedMedals);
    if (savedMax !== null) maxMedals = parseInt(savedMax);

    let todayStr = new Date().toLocaleDateString('ja-JP');
    if (lastDate !== todayStr) {
        if (medals < 50) medals = 50;
        localStorage.setItem('ninjaSlot_lastDate', todayStr);
        saveMedalData();
    }
    targetMedals = medals; 
}

function saveMedalData() {
    if (medals > maxMedals) maxMedals = medals;
    localStorage.setItem('ninjaSlot_medals', medals);
    localStorage.setItem('ninjaSlot_maxMedals', maxMedals);
}