/**
 * クリップトニンジャ「心変わりの術スロット」
 */

const SLOT_WIDTH = 1000;
const SLOT_HEIGHT = 600;

// お面の配列インデックス定義
const OMEN_TYPE = {
    ONI: 0, KITUNE: 1, DAN: 2, TENGU: 3, JEI: 4, SENTAI: 5, OKAME: 6, HYO: 7, KAMEN: 8
};

// 役の倍率
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

// 全リール共通の配列（全9種類を各1回ずつ配置した9個サイクル）
const REEL_STRIP = [
    OMEN_TYPE.ONI,
    OMEN_TYPE.KITUNE,
    OMEN_TYPE.DAN,
    OMEN_TYPE.TENGU,
    OMEN_TYPE.JEI,
    OMEN_TYPE.SENTAI,
    OMEN_TYPE.OKAME,
    OMEN_TYPE.HYO,
    OMEN_TYPE.KAMEN
];

let slotActive = false;
let slotCanvas, sCtx;
let slotOverlay;
let slotReqId;

// アセット
const omenImg = new Image();
omenImg.src = 'images/Sprite/omen.png';
let omenConfig = null;
const ninjaImgs = [new Image(), new Image(), new Image()];
ninjaImgs[0].src = 'images/slot/ninja1.png';
ninjaImgs[1].src = 'images/slot/ninja2.png';
ninjaImgs[2].src = 'images/slot/ninja3.png';

// メダルデータ
let medals = 50;
let maxMedals = 50;
let currentBet = 1;

// スロット状態
const STATE = { IDLE: 0, SPINNING: 1, STOPPING: 2, PAYOUT: 3 };
let slotState = STATE.IDLE;
let isReach = false;

// タッチ/クリック兼用イベントハンドラ
function addBtnListener(el, callback) {
    const handler = (e) => {
        if (e.cancelable) e.preventDefault();
        callback(e);
    };
    el.addEventListener('touchstart', handler, { passive: false });
    el.addEventListener('mousedown', handler);
}

// リール状態管理
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
            if (prevPos >= this.stopTarget && this.pos <= this.stopTarget) {
                crossed = true;
            }
            if (prevPos < 1 && this.pos > REEL_STRIP.length - 1 && this.stopTarget === 0) {
                crossed = true;
            }

            if (crossed || Math.abs(this.pos - this.stopTarget) < this.speed) {
                this.pos = this.stopTarget;
                this.isSpinning = false;
                this.isStopping = false;
                this.resultSymbol = REEL_STRIP[this.stopTarget];
                playSE('impact', 0.8);
                checkReels();
            }
        }
    }

    draw(ctx) {
        const symbolHeight = 128; 
        const visibleRange = 1;

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

let reels = [];

function drawOmen(ctx, type, x, y) {
    if (!omenImg.complete || !omenConfig) return;
    const keys = ["oni", "kitune", "dan", "tengu", "jei", "sentai", "okame", "hyo", "kamen"];
    const key = keys[type];
    if (key && omenConfig.data[key]) {
        const frame = omenConfig.data[key].frames[0];
        ctx.drawImage(omenImg, frame.x, frame.y, frame.w, frame.h, x - frame.w / 2, y - frame.h / 2, frame.w, frame.h);
    }
}

function openSlot() {
    if (slotActive) return;
    slotActive = true;

    loadMedalData();
    
    if (!omenConfig) {
        fetch('json/omen.json')
            .then(r => r.json())
            .then(json => { omenConfig = json; })
            .catch(e => console.error(e));
    }

    createSlotDOM();

    if (typeof isSoundOn !== 'undefined' && isSoundOn && typeof bgmSlot !== 'undefined') {
        bgmSlot.currentTime = 0;
        bgmSlot.play().catch(e => console.error("Slot BGM playback failed:", e));
    }
    
    const reelY = SLOT_HEIGHT * 0.39; 
    reels = [
        new Reel(SLOT_WIDTH * 0.32, reelY),
        new Reel(SLOT_WIDTH * 0.50, reelY),
        new Reel(SLOT_WIDTH * 0.68, reelY)
    ];

    slotState = STATE.IDLE;
    isReach = false;

    updateSlotUI();
    slotLoop();
}

function createModalBtn(text, id, callback, width = '150px') {
    const wrap = document.createElement('div');
    wrap.className = 'modal-btn-wrap';
    wrap.id = id + '-wrap';
    
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'modal-btn';
    btn.style.width = width;
    btn.style.height = '50px';
    btn.style.padding = '2px';
    
    addBtnListener(btn, callback);
    
    const inner = document.createElement('span');
    inner.id = id + '-inner';
    inner.className = 'modal-btn-inner';
    inner.innerText = text;
    inner.style.fontSize = '20px';
    inner.style.letterSpacing = '2px';
    
    btn.appendChild(inner);
    wrap.appendChild(btn);
    return wrap;
}

function createSlotDOM() {
    slotOverlay = document.createElement('div');
    slotOverlay.style.position = 'absolute';
    slotOverlay.style.top = '0';
    slotOverlay.style.left = '0';
    slotOverlay.style.width = '100%';
    slotOverlay.style.height = '100%';
    slotOverlay.style.background = '#111';
    slotOverlay.style.display = 'flex';
    slotOverlay.style.justifyContent = 'center';
    slotOverlay.style.alignItems = 'center';
    slotOverlay.style.zIndex = '3000';

    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.width = SLOT_WIDTH + 'px';
    container.style.height = SLOT_HEIGHT + 'px';
    container.style.background = 'url("images/slot/BG_slot.jpg") center/cover no-repeat';
    container.style.overflow = 'hidden';

    slotCanvas = document.createElement('canvas');
    slotCanvas.width = SLOT_WIDTH;
    slotCanvas.height = SLOT_HEIGHT;
    slotCanvas.style.position = 'absolute';
    slotCanvas.style.top = '0';
    slotCanvas.style.left = '0';
    sCtx = slotCanvas.getContext('2d');

    // メダル情報
    const medalInfo = document.createElement('div');
    medalInfo.style.position = 'absolute';
    medalInfo.style.top = '20px';
    medalInfo.style.left = '30px';
    medalInfo.style.textAlign = 'left';
    medalInfo.style.fontFamily = "'Sawarabi Mincho', serif";
    medalInfo.style.textShadow = '2px 2px 4px #000';
    const medalText = document.createElement('div');
    medalText.id = 'slot-medal-text';
    medalText.style.color = '#fff';
    medalText.style.fontSize = '24px';
    medalText.style.fontWeight = 'bold';
    medalInfo.appendChild(medalText);

    // デバッグ用
    const btnDebug = document.createElement('div');
    btnDebug.innerText = '+50';
    btnDebug.style.marginTop = '5px';
    btnDebug.style.color = '#fff';
    btnDebug.style.background = 'rgba(255,255,255,0.2)';
    btnDebug.style.border = '1px solid #fff';
    btnDebug.style.padding = '2px 8px';
    btnDebug.style.fontSize = '12px';
    btnDebug.style.cursor = 'pointer';
    btnDebug.style.textAlign = 'center';
    addBtnListener(btnDebug, () => { medals += 50; playSE('sausage_get'); updateSlotUI(); });
    medalInfo.appendChild(btnDebug);

    // MAX
    const maxText = document.createElement('div');
    maxText.id = 'slot-max-text';
    maxText.style.position = 'absolute';
    maxText.style.top = '20px';
    maxText.style.right = '30px';
    maxText.style.color = '#ccc';
    maxText.style.fontSize = '18px';
    maxText.style.fontFamily = "'Sawarabi Mincho', serif";
    maxText.style.textShadow = '2px 2px 4px #000';

    // BET変更UI
    const betContainer = document.createElement('div');
    betContainer.style.position = 'absolute';
    betContainer.style.right = '120px';
    betContainer.style.top = '50%';
    betContainer.style.transform = 'translateY(-50%)';
    betContainer.style.display = 'flex';
    betContainer.style.flexDirection = 'column';
    betContainer.style.alignItems = 'center';
    betContainer.style.gap = '15px';

    const btnBetUp = document.createElement('div');
    btnBetUp.id = 'btn-bet-up';
    btnBetUp.className = 'v-btn';
    btnBetUp.innerText = '▲';
    btnBetUp.style.width = '55px';
    btnBetUp.style.height = '55px';
    btnBetUp.style.fontSize = '24px';
    addBtnListener(btnBetUp, () => changeBet(1));

    const betDisplay = document.createElement('div');
    betDisplay.id = 'slot-bet-display';
    betDisplay.style.color = '#fbc02d';
    betDisplay.style.fontSize = '32px';
    betDisplay.style.fontFamily = "'Sawarabi Mincho', serif";
    betDisplay.style.fontWeight = 'bold';
    betDisplay.style.textShadow = '2px 2px 4px #000';

    const btnBetDown = document.createElement('div');
    btnBetDown.id = 'btn-bet-down';
    btnBetDown.className = 'v-btn';
    btnBetDown.innerText = '▼';
    btnBetDown.style.width = '55px';
    btnBetDown.style.height = '55px';
    btnBetDown.style.fontSize = '24px';
    addBtnListener(btnBetDown, () => changeBet(-1));

    betContainer.appendChild(btnBetUp);
    betContainer.appendChild(betDisplay);
    betContainer.appendChild(btnBetDown);

    // 止めるボタン
    const stopContainer = document.createElement('div');
    stopContainer.style.position = 'absolute';
    stopContainer.style.top = '480px'; 
    stopContainer.style.left = '50%';
    stopContainer.style.transform = 'translateX(-50%)';
    stopContainer.style.width = '420px'; 
    stopContainer.style.display = 'flex';
    stopContainer.style.justifyContent = 'space-between';
    stopContainer.style.pointerEvents = 'none';

    for (let i = 0; i < 3; i++) {
        const sBtn = document.createElement('div');
        sBtn.id = `btn-stop-${i}`;
        sBtn.className = 'v-btn';
        sBtn.innerText = '止';
        sBtn.style.width = '60px';
        sBtn.style.height = '60px';
        sBtn.style.fontSize = '24px';
        sBtn.style.pointerEvents = 'auto';
        addBtnListener(sBtn, () => stopReel(i));
        stopContainer.appendChild(sBtn);
    }

    // STARTボタン
    const startContainer = document.createElement('div');
    startContainer.style.position = 'absolute';
    startContainer.style.bottom = '60px'; 
    startContainer.style.left = '30px'; 
    const btnStart = createModalBtn('START', 'btn-slot-start', handleStartNext, '200px');
    startContainer.appendChild(btnStart);

    // 設定ボタン
    const btnSettings = document.createElement('div');
    btnSettings.className = 'v-btn settings-btn';
    btnSettings.innerText = '⚙️';
    btnSettings.style.position = 'absolute';
    btnSettings.style.bottom = '20px';
    btnSettings.style.right = '30px';
    btnSettings.style.margin = '0';
    addBtnListener(btnSettings, () => toggleSettings());

    const originalBackToTitle = window.backToTitle;
    window.backToTitle = function() {
        closeSlot();
        if (originalBackToTitle) originalBackToTitle();
    };

    container.appendChild(slotCanvas);
    container.appendChild(medalInfo);
    container.appendChild(maxText);
    container.appendChild(betContainer);
    container.appendChild(stopContainer);
    container.appendChild(startContainer);
    container.appendChild(btnSettings);
    slotOverlay.appendChild(container);

    const wrapper = document.getElementById('main-wrapper');
    if(wrapper) wrapper.appendChild(slotOverlay);
    else document.body.appendChild(slotOverlay);
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
}

function saveMedalData() {
    if (medals > maxMedals) maxMedals = medals;
    localStorage.setItem('ninjaSlot_medals', medals);
    localStorage.setItem('ninjaSlot_maxMedals', maxMedals);
}

function updateSlotUI() {
    if (!slotActive) return;
    
    const elMedal = document.getElementById('slot-medal-text');
    if (elMedal) elMedal.innerText = `MEDAL: ${medals}`;
    const elMax = document.getElementById('slot-max-text');
    if (elMax) elMax.innerText = `MAX: ${maxMedals}`;
    const elBet = document.getElementById('slot-bet-display');
    if (elBet) elBet.innerText = currentBet + '枚';

    const btnDown = document.getElementById('btn-bet-down');
    const btnUp = document.getElementById('btn-bet-up');
    const wrapStart = document.getElementById('btn-slot-start-wrap');
    const innerStart = document.getElementById('btn-slot-start-inner');

    if (slotState === STATE.IDLE) {
        if (innerStart) {
            innerStart.innerText = 'START';
            innerStart.style.background = 'linear-gradient(to bottom, #ffebad, #f7d478)';
        }
        if (btnDown) btnDown.style.opacity = currentBet > 1 ? '1' : '0.5';
        if (btnUp) btnUp.style.opacity = currentBet < 5 && currentBet < medals ? '1' : '0.5';
        if (wrapStart) wrapStart.style.opacity = medals >= currentBet ? '1' : '0.5';
    } else if (slotState === STATE.PAYOUT) {
        if (innerStart) {
            innerStart.innerText = '次へ';
            innerStart.style.background = 'linear-gradient(to bottom, #9fe65e, #cff466)';
        }
        if (btnDown) btnDown.style.opacity = '0.5';
        if (btnUp) btnUp.style.opacity = '0.5';
        if (wrapStart) wrapStart.style.opacity = '1';
    } else {
        if (btnDown) btnDown.style.opacity = '0.5';
        if (btnUp) btnUp.style.opacity = '0.5';
        if (wrapStart) wrapStart.style.opacity = '0.5';
    }

    for (let i = 0; i < 3; i++) {
        const sBtn = document.getElementById(`btn-stop-${i}`);
        if (sBtn) {
            if (slotState === STATE.SPINNING && reels[i].isSpinning && !reels[i].isStopping) {
                sBtn.classList.remove('disabled');
                sBtn.style.opacity = '1';
                sBtn.style.color = '#fff';
            } else {
                sBtn.classList.add('disabled');
                sBtn.style.opacity = '0.5';
                sBtn.style.color = '#888';
            }
        }
    }
}

function changeBet(amount) {
    if (slotState !== STATE.IDLE) return;
    currentBet += amount;
    if (currentBet < 1) currentBet = 1;
    if (currentBet > 5) currentBet = 5;
    if (currentBet > medals) currentBet = Math.max(1, medals);
    playSE('jump1', 0.5);
    updateSlotUI();
}

function handleStartNext() {
    if (slotState === STATE.IDLE) {
        startSlot();
    } else if (slotState === STATE.PAYOUT) {
        nextGame();
    }
}

function startSlot() {
    if (slotState !== STATE.IDLE || medals < currentBet) return;
    medals -= currentBet;
    saveMedalData();
    slotState = STATE.SPINNING;
    isReach = false;
    reels.forEach(r => r.startSpin());
    playSE('shuriken', 0.8);
    updateSlotUI();
}

function nextGame() {
    if (slotState !== STATE.PAYOUT) return;
    if (currentBet > medals) currentBet = Math.max(1, medals);
    slotState = STATE.IDLE;
    updateSlotUI();
}

function stopReel(index) {
    if (slotState !== STATE.SPINNING || !reels[index].isSpinning || reels[index].isStopping) return;
    reels[index].stopSpin();
    updateSlotUI();
}

function checkReels() {
    const spinningReels = reels.filter(r => r.isSpinning || r.isStopping);
    if (spinningReels.length === 1) {
        const stoppedReels = reels.filter(r => !r.isSpinning);
        if (stoppedReels.length === 2 && stoppedReels[0].resultSymbol === stoppedReels[1].resultSymbol) {
            if (!isReach) {
                isReach = true;
                spinningReels[0].speed = 0.03; 
                playSE('gather_energy', 0.5);
            }
        }
    }
    if (spinningReels.length === 0) {
        slotState = STATE.PAYOUT;
        isReach = false; // 停止時にリセット
        const s1 = reels[0].resultSymbol;
        const s2 = reels[1].resultSymbol;
        const s3 = reels[2].resultSymbol;
        if (s1 === s2 && s2 === s3) {
            const rate = PAYOUT_RATES[s1] || 0;
            const winAmount = currentBet * rate;
            medals += winAmount;
            saveMedalData();
            if (s1 === OMEN_TYPE.ONI) playSE('roar', 1.0); 
            else playSE('sausage_get', 1.0); 
        } else {
            playSE('damage', 0.5);
        }
        updateSlotUI();
    }
}

function closeSlot() {
    slotActive = false;
    if (slotReqId) cancelAnimationFrame(slotReqId);
    if (slotOverlay && slotOverlay.parentNode) {
        slotOverlay.parentNode.removeChild(slotOverlay);
    }
    slotOverlay = null;
    if (typeof bgmSlot !== 'undefined') {
        bgmSlot.pause();
    }
    if(typeof window.updateBtnRects === 'function') window.updateBtnRects();
}

function slotLoop() {
    if (!slotActive) return;
    sCtx.clearRect(0, 0, SLOT_WIDTH, SLOT_HEIGHT);
    for (let i = 0; i < 3; i++) {
        const img = ninjaImgs[i];
        if (img.complete && img.naturalWidth > 0) {
            const nw = img.naturalWidth;
            const nh = img.naturalHeight;
            sCtx.drawImage(img, reels[i].x - nw / 2, reels[i].y - nh / 5.0 - 15, nw, nh);
        }
    }
    sCtx.save();
    sCtx.beginPath();
    sCtx.rect(50, reels[0].y - 130, SLOT_WIDTH - 100, 280);
    sCtx.clip();
    reels.forEach(r => {
        r.update();
        r.draw(sCtx);
    });
    sCtx.restore();
    if (slotState === STATE.PAYOUT) {
        if (reels[0].resultSymbol === reels[1].resultSymbol && reels[1].resultSymbol === reels[2].resultSymbol) {
            const winAmount = currentBet * PAYOUT_RATES[reels[0].resultSymbol];
            sCtx.save();
            sCtx.globalCompositeOperation = 'lighter';
            sCtx.fillStyle = `rgba(255, 255, 0, ${0.5 + Math.sin(Date.now()/50)*0.5})`;
            sCtx.fillRect(100, reels[0].y - 70, SLOT_WIDTH - 200, 140);
            sCtx.restore();
            sCtx.fillStyle = '#ff1493';
            sCtx.strokeStyle = '#fff';
            sCtx.lineWidth = 4;
            sCtx.font = "bold 48px 'Sawarabi Mincho', serif";
            sCtx.textAlign = "center";
            const text = `${winAmount} WIN!!`;
            sCtx.strokeText(text, SLOT_WIDTH / 2, reels[0].y + 20);
            sCtx.fillText(text, SLOT_WIDTH / 2, reels[0].y + 20);
        }
    } else if (isReach) {
        sCtx.fillStyle = '#ff0';
        sCtx.font = "bold 36px 'Sawarabi Mincho', serif";
        sCtx.textAlign = "center";
        if (Math.floor(Date.now() / 100) % 2 === 0) {
            sCtx.fillText("REACH!!", SLOT_WIDTH / 2, reels[0].y - 90);
        }
    }
    slotReqId = requestAnimationFrame(slotLoop);
}