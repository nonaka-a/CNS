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
let slotParticles = []; 

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
let targetMedals = 50; // カウントアップ演出用
let maxMedals = 50;
let currentBet = 1;

// スロット状態
const STATE = { IDLE: 0, SPINNING: 1, STOPPING: 2, PAYOUT: 3 };
let slotState = STATE.IDLE;
let isReach = false;
let payoutTime = 0;

// 演出管理用の変数
let winTextAnim = { active: false, x: 0, y: 0, targetX: 100, targetY: 50, timer: 0, text: "", amount: 0 };

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
        // 全てが止まって結果表示中(PAYOUT)の時は真ん中(0)だけ表示、それ以外は上下(1)も表示
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

    // ここに追加：スロットを開くたびに演出をリセット
    slotParticles = []; 
    winTextAnim.active = false;

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

    const applyZabutonStyle = (el) => {
        el.style.background = '#2a2a2a';
        el.style.border = '3px solid #8c6e5e';
        el.style.boxShadow = 'inset 0 0 0 2px #111, 0 4px 10px rgba(0,0,0,0.5)';
        el.style.padding = '5px 15px';
        ['m-tp-l', 'm-tp-r', 'm-bt-l', 'm-bt-r'].forEach(cls => {
            const c = document.createElement('div');
            c.className = `modal-corner ${cls}`;
            el.appendChild(c);
        });
    };

    // メダル情報
    const medalInfo = document.createElement('div');
    medalInfo.style.position = 'absolute';
    medalInfo.style.top = '20px';
    medalInfo.style.left = '30px';
    medalInfo.style.textAlign = 'left';
    medalInfo.style.fontFamily = "'Sawarabi Mincho', serif";
    medalInfo.style.textShadow = '2px 2px 4px #000';
    applyZabutonStyle(medalInfo);

    const medalText = document.createElement('div');
    medalText.id = 'slot-medal-text';
    medalText.style.color = '#fff';
    medalText.style.fontSize = '24px';
    medalText.style.fontWeight = 'bold';
    medalText.style.position = 'relative';
    medalText.style.zIndex = '5';
    medalInfo.appendChild(medalText);

    // デバッグ用（座布団の外に配置）
    const btnDebug = document.createElement('div');
    btnDebug.innerText = '+50';
    btnDebug.style.position = 'absolute';
    btnDebug.style.top = '75px';
    btnDebug.style.left = '30px';
    btnDebug.style.color = '#fff';
    btnDebug.style.background = 'rgba(255,255,255,0.2)';
    btnDebug.style.border = '1px solid #fff';
    btnDebug.style.padding = '2px 8px';
    btnDebug.style.fontSize = '12px';
    btnDebug.style.cursor = 'pointer';
    btnDebug.style.textAlign = 'center';
    addBtnListener(btnDebug, () => { medals += 50; playSE('sausage_get'); updateSlotUI(); });

    // MAX
    const maxWrap = document.createElement('div');
    maxWrap.style.position = 'absolute';
    maxWrap.style.top = '20px';
    maxWrap.style.right = '30px';
    maxWrap.style.fontFamily = "'Sawarabi Mincho', serif";
    maxWrap.style.textShadow = '2px 2px 4px #000';
    applyZabutonStyle(maxWrap);

    const maxText = document.createElement('div');
    maxText.id = 'slot-max-text';
    maxText.style.color = '#fff';
    maxText.style.fontSize = '24px';
    maxText.style.position = 'relative';
    maxText.style.zIndex = '5';
    maxWrap.appendChild(maxText);

    // BET変更UI
    const betContainer = document.createElement('div');
    betContainer.id = 'slot-bet-container';
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
    betDisplay.style.width = '80px';
    betDisplay.style.textAlign = 'center';

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
    stopContainer.id = 'slot-stop-container';
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

    // STARTボタン (右側に移動)
    const startContainer = document.createElement('div');
    startContainer.style.position = 'absolute';
    startContainer.style.bottom = '60px'; 
    startContainer.style.right = '30px'; 
    const btnStart = createModalBtn('START', 'btn-slot-start', handleStartNext, '200px');
    startContainer.appendChild(btnStart);

    // 設定ボタン (左側に移動)
    const btnSettings = document.createElement('div');
    btnSettings.className = 'v-btn settings-btn';
    btnSettings.innerText = '⚙️';
    btnSettings.style.position = 'absolute';
    btnSettings.style.bottom = '60px';
    btnSettings.style.left = '30px';
    btnSettings.style.margin = '0';
    addBtnListener(btnSettings, () => toggleSettings());

    // ヘルプボタン
    const btnHelp = document.createElement('div');
    btnHelp.className = 'v-btn settings-btn';
    btnHelp.innerText = '？';
    btnHelp.style.position = 'absolute';
    btnHelp.style.bottom = '60px';
    btnHelp.style.left = '85px';
    btnHelp.style.margin = '0';
    btnHelp.style.fontSize = '20px';
    addBtnListener(btnHelp, () => showSlotHelp());

    const originalBackToTitle = window.backToTitle;
    window.backToTitle = function() {
        closeSlot();
        if (originalBackToTitle) originalBackToTitle();
    };

    container.appendChild(slotCanvas);
    container.appendChild(medalInfo);
    container.appendChild(btnDebug);
    container.appendChild(maxWrap);
    container.appendChild(betContainer);
    container.appendChild(stopContainer);
    container.appendChild(startContainer);
    container.appendChild(btnSettings);
    container.appendChild(btnHelp);
    slotOverlay.appendChild(container);

    const wrapper = document.getElementById('main-wrapper');
    if(wrapper) wrapper.appendChild(slotOverlay);
    else document.body.appendChild(slotOverlay);
}

// ヘルプウィンドウを表示する関数
function showSlotHelp() {
    if (document.getElementById('slot-help-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'slot-help-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '6000';
    overlay.style.pointerEvents = 'auto';

    const windowEl = document.createElement('div');
    windowEl.style.position = 'relative';
    windowEl.style.width = '920px'; 
    windowEl.style.background = 'radial-gradient(circle, #4a4a4a 0%, #222 100%)';
    windowEl.style.border = '4px solid #8c6e5e';
    windowEl.style.boxShadow = 'inset 0 0 0 3px #111, 0 20px 60px rgba(0,0,0,0.9)';
    windowEl.style.padding = '20px 15px';
    windowEl.style.textAlign = 'center';
    windowEl.style.fontFamily = "'Sawarabi Mincho', serif";
    windowEl.style.color = '#fff';
    windowEl.style.overflow = 'hidden';

    ['m-tp-l', 'm-tp-r', 'm-bt-l', 'm-bt-r'].forEach(cls => {
        const c = document.createElement('div');
        c.className = `modal-corner ${cls}`;
        windowEl.appendChild(c);
    });

    const groups = [
        { rate: 10, indices: [OMEN_TYPE.ONI], cols: 1 },
        { rate: 5, indices: [OMEN_TYPE.KITUNE, OMEN_TYPE.DAN], cols: 2 },
        { rate: 3, indices: [OMEN_TYPE.TENGU, OMEN_TYPE.JEI, OMEN_TYPE.SENTAI], cols: 3 },
        { rate: 2, indices: [OMEN_TYPE.OKAME, OMEN_TYPE.HYO, OMEN_TYPE.KAMEN], cols: 3 }
    ];

    const keys = ["oni", "kitune", "dan", "tengu", "jei", "sentai", "okame", "hyo", "kamen"];

    groups.forEach(group => {
        const groupContainer = document.createElement('div');
        groupContainer.style.display = 'grid';
        groupContainer.style.gridTemplateColumns = `repeat(${group.cols}, 1fr)`;
        groupContainer.style.gap = '8px';
        groupContainer.style.marginBottom = '12px';
        groupContainer.style.width = '100%';

        group.indices.forEach(index => {
            const key = keys[index];
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'center';
            row.style.background = 'rgba(255,255,255,0.05)';
            row.style.padding = '6px';
            row.style.borderRadius = '4px';

            const iconsWrapper = document.createElement('div');
            iconsWrapper.style.display = 'flex';
            iconsWrapper.style.gap = '3px';

            for (let i = 0; i < 3; i++) {
                const icon = document.createElement('div');
                icon.style.width = '50px';
                icon.style.height = '50px';
                if (omenConfig && omenConfig.data[key]) {
                    const frame = omenConfig.data[key].frames[0];
                    icon.style.backgroundImage = 'url("images/Sprite/omen.png")';
                    const scale = 50 / frame.w;
                    icon.style.backgroundSize = `${omenImg.naturalWidth * scale}px ${omenImg.naturalHeight * scale}px`;
                    icon.style.backgroundPosition = `-${frame.x * scale}px -${frame.y * scale}px`;
                }
                iconsWrapper.appendChild(icon);
            }
            row.appendChild(iconsWrapper);

            const payoutText = document.createElement('div');
            payoutText.innerText = ` × ${group.rate}`;
            payoutText.style.fontSize = '24px';
            payoutText.style.marginLeft = '15px';
            payoutText.style.color = '#fbc02d';
            payoutText.style.fontWeight = 'bold';
            payoutText.style.width = '60px';
            payoutText.style.textAlign = 'left';
            row.appendChild(payoutText);

            groupContainer.appendChild(row);
        });
        windowEl.appendChild(groupContainer);
    });

    const info = document.createElement('div');
    info.style.fontSize = '17px';
    info.style.lineHeight = '1.3';
    info.style.background = 'rgba(0,0,0,0.3)';
    info.style.padding = '10px';
    info.style.borderRadius = '5px';
    info.style.marginTop = '0px';
    info.style.marginBottom = '15px';
    info.innerText = '【メダル補充】毎日0時にメダルが50枚まで自動補充されます。';
    windowEl.appendChild(info);

    const closeBtnWrap = createModalBtn('閉じる', 'btn-help-close', () => {
        overlay.remove();
    }, '180px');
    windowEl.appendChild(closeBtnWrap);

    overlay.appendChild(windowEl);
    slotOverlay.appendChild(overlay);
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
    targetMedals = medals; // 目標メダル数も同期
}

function saveMedalData() {
    if (medals > maxMedals) maxMedals = medals;
    localStorage.setItem('ninjaSlot_medals', medals);
    localStorage.setItem('ninjaSlot_maxMedals', maxMedals);
}

function updateSlotUI() {
    if (!slotActive) return;
    
    const elMedal = document.getElementById('slot-medal-text');
    if (elMedal) elMedal.innerText = `メダル: ${medals}`;
    const elMax = document.getElementById('slot-max-text');
    if (elMax) elMax.innerText = `ベスト: ${maxMedals}`;
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
        if (btnUp) btnUp.style.opacity = currentBet < 10 && currentBet < medals ? '1' : '0.5';
        if (wrapStart) wrapStart.style.opacity = medals >= currentBet ? '1' : '0.5';
    } else if (slotState === STATE.PAYOUT) {
        if (innerStart) {
            innerStart.innerText = '次へ';
            innerStart.style.background = 'linear-gradient(to bottom, #9fe65e, #cff466)';
        }
        if (btnDown) btnDown.style.opacity = '0.5';
        if (btnUp) btnUp.style.opacity = '0.5';
        if (wrapStart) wrapStart.style.opacity = '1';
        
        const betCont = document.getElementById('slot-bet-container');
        if (betCont) betCont.style.display = 'none';
        const stopCont = document.getElementById('slot-stop-container');
        if (stopCont) stopCont.style.display = 'none';
    } else {
        if (btnDown) btnDown.style.opacity = '0.5';
        if (btnUp) btnUp.style.opacity = '0.5';
        if (wrapStart) wrapStart.style.opacity = '0.5';
        
        const betCont = document.getElementById('slot-bet-container');
        if (betCont) betCont.style.display = 'flex';
        const stopCont = document.getElementById('slot-stop-container');
        if (stopCont) stopCont.style.display = 'flex';
    }

    if (slotState === STATE.IDLE) {
        const betCont = document.getElementById('slot-bet-container');
        if (betCont) betCont.style.display = 'flex';
        const stopCont = document.getElementById('slot-stop-container');
        if (stopCont) stopCont.style.display = 'flex';
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
    if (currentBet > 10) currentBet = 10;
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
    if (slotState !== STATE.IDLE || targetMedals < currentBet) return;
    targetMedals -= currentBet;
    medals -= currentBet;
    saveMedalData();
    slotState = STATE.SPINNING;
    isReach = false;
    reels.forEach((r, i) => {
        setTimeout(() => {
            if (slotState === STATE.SPINNING) {
                r.startSpin();
                updateSlotUI(); 
            }
        }, i * 150); 
    });
    playSE('shuriken', 0.8);
    updateSlotUI();
}

function nextGame() {
    if (slotState !== STATE.PAYOUT) return;

    // 演出中（テキスト移動中やカウントアップ中）に押されたら演出を即座に終了
    if (winTextAnim.active || medals < targetMedals) {
        winTextAnim.active = false;
        medals = targetMedals; // メダルを目標値まで一気に加算
        saveMedalData();
        // ここでリターンせずにそのまま下の IDLE 移行処理へ進ませることで、1回で完了させる
    }

    // 次のゲームの準備
    if (currentBet > targetMedals) currentBet = Math.max(1, targetMedals);
    
    // 状態をアイドルに戻し、UIを更新して「START」ボタンを表示させる
    slotState = STATE.IDLE;
    updateSlotUI();
    
    // 演出スキップ時の完了SE
    playSE('sausage_get', 0.5);
}


function stopReel(index) {
    if (slotState !== STATE.SPINNING || !reels[index].isSpinning || reels[index].isStopping) return;
    reels[index].stopSpin();
    updateSlotUI();
}

// --- js/slot.js ---

// --- js/slot.js (後半部分の修正済み全コード) ---

// --- js/slot.js (checkReelsから末尾までの一括置換用コード) ---

function checkReels() {
    const spinningReels = reels.filter(r => r.isSpinning || r.isStopping);
    if (spinningReels.length === 1) {
        const stoppedReels = reels.filter(r => !r.isSpinning);
        if (stoppedReels.length === 2 && stoppedReels[0].resultSymbol === stoppedReels[1].resultSymbol) {
            if (!isReach) {
                isReach = true;
                const symbolType = stoppedReels[0].resultSymbol;
                const rate = PAYOUT_RATES[symbolType] || 2;
                let slowSpeed = 0.03; 
                if (rate === 5) slowSpeed = 0.045;
                else if (rate === 10) slowSpeed = 0.06;
                spinningReels[0].speed = slowSpeed; 
                playSE('gather_energy', 0.5);
            }
        }
    }
    if (spinningReels.length === 0) {
        slotState = STATE.PAYOUT;
        payoutTime = Date.now();
        isReach = false;
        const s1 = reels[0].resultSymbol;
        const s2 = reels[1].resultSymbol;
        const s3 = reels[2].resultSymbol;
        if (s1 === s2 && s2 === s3) {
            const rate = PAYOUT_RATES[s1] || 0;
            const winAmount = currentBet * rate;
            
            // 目標メダル数を設定
            targetMedals = medals + winAmount;

            // 倍率によってベースサイズを変更
            let fSize = 72;
            if (rate === 5) fSize = 92;
            else if (rate === 10) fSize = 120;

            winTextAnim = {
                active: true,
                x: SLOT_WIDTH / 2,
                y: reels[0].y + 20,
                targetX: 130, // メダルUIのX座標
                targetY: 45,  // メダルUIのY座標
                timer: 0,
                text: `${winAmount}枚GET!!`,
                amount: winAmount,
                baseSize: fSize
            };

            // 倍率に応じたエフェクト
            if (rate === 5) {
                if (typeof screenShake !== 'undefined') screenShake = 20;
                spawnWinParticles(50);
            }
            if (rate === 10) {
                if (typeof screenShake !== 'undefined') screenShake = 50;
                spawnWinParticles(100);
            }

            if (s1 === OMEN_TYPE.ONI) playSE('roar', 1.0); 
            else playSE('sausage_get', 1.0); 
        } else {
            playSE('damage', 0.5);
        }
        updateSlotUI();
    }
}

function spawnWinParticles(count) {
    if (typeof slotParticles === 'undefined') slotParticles = [];
    for (let i = 0; i < count; i++) {
        const originX = SLOT_WIDTH / 2;
        const originY = SLOT_HEIGHT / 2;
        const angle = Math.random() * Math.PI * 2;
        const speed = 5 + Math.random() * 15;
        slotParticles.push({
            x: originX, y: originY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            size: 5 + Math.random() * 10,
            color: `hsl(${Math.random() * 40 + 40}, 100%, 60%)`,
            friction: 0.96
        });
    }
}

function closeSlot() {
    slotActive = false;
    if (slotReqId) cancelAnimationFrame(slotReqId);
    if (slotOverlay && slotOverlay.parentNode) {
        slotOverlay.parentNode.removeChild(slotOverlay);
    }
    slotOverlay = null;
    if (typeof bgmSlot !== 'undefined') bgmSlot.pause();
    if(typeof window.updateBtnRects === 'function') window.updateBtnRects();
}

function slotLoop() {
    if (!slotActive) return;
    sCtx.clearRect(0, 0, SLOT_WIDTH, SLOT_HEIGHT);

    const isWin = (slotState === STATE.PAYOUT && reels[0].resultSymbol === reels[1].resultSymbol && reels[1].resultSymbol === reels[2].resultSymbol);
    const isGlowing = isWin && winTextAnim.active && winTextAnim.timer < 2.0;

    if (isGlowing) {
        const glowAlpha = 0.2 + Math.sin(Date.now() / 100) * 0.15;
        sCtx.save();
        sCtx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
            const grad = sCtx.createRadialGradient(reels[i].x, reels[i].y, 0, reels[i].x, reels[i].y, 120);
            grad.addColorStop(0, `rgba(255, 255, 200, ${glowAlpha * 2})`);
            grad.addColorStop(1, `rgba(255, 200, 0, 0)`);
            sCtx.fillStyle = grad;
            sCtx.beginPath();
            sCtx.arc(reels[i].x, reels[i].y, 120, 0, Math.PI * 2);
            sCtx.fill();
        }
        sCtx.restore();
    }

    for (let i = 0; i < 3; i++) {
        const img = ninjaImgs[i];
        if (img.complete && img.naturalWidth > 0) {
            const nw = img.naturalWidth;
            const nh = img.naturalHeight;
            sCtx.save();
            if (isGlowing) {
                sCtx.shadowBlur = 30; sCtx.shadowColor = "#fff";
            }
            sCtx.drawImage(img, reels[i].x - nw / 2, reels[i].y - nh / 4.8 - 15, nw, nh);
            sCtx.restore();
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

    if (slotParticles.length > 0) {
        sCtx.save();
        sCtx.globalCompositeOperation = 'lighter';
        for (let i = slotParticles.length - 1; i >= 0; i--) {
            const p = slotParticles[i];
            p.vx *= p.friction; p.vy *= p.friction;
            p.x += p.vx; p.y += p.vy;
            p.life -= 0.015;
            if (p.life <= 0) { slotParticles.splice(i, 1); continue; }
            sCtx.globalAlpha = p.life;
            sCtx.fillStyle = p.color;
            sCtx.beginPath(); sCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2); sCtx.fill();
            sCtx.shadowBlur = 15; sCtx.shadowColor = p.color;
        }
        sCtx.restore();
    }

    if (winTextAnim.active) {
        winTextAnim.timer += 0.016; 
        let currentX = winTextAnim.x;
        let currentY = winTextAnim.y;
        let scale = 1.0;
        let fontSize = winTextAnim.baseSize || 72;

        if (winTextAnim.timer < 2.0) {
            // バウンス演出 (0% -> 110% -> 100%)
            const bounceDuration = 0.4;
            const t = winTextAnim.timer / bounceDuration;
            if (t < 1.0) {
                if (t < 0.7) scale = (t / 0.7) * 1.1;
                else scale = 1.1 - ((t - 0.7) / 0.3) * 0.1;
            } else scale = 1.0;
        } else {
            // 移動演出
            const moveT = (winTextAnim.timer - 2.0) / 0.4; 
            if (moveT >= 1.0) {
                winTextAnim.active = false;
            } else {
                const easedT = moveT * moveT; 
                currentX = winTextAnim.x + (winTextAnim.targetX - winTextAnim.x) * easedT;
                currentY = winTextAnim.y + (winTextAnim.targetY - winTextAnim.y) * easedT;
                scale = 1.0 - easedT * 0.5; 
            }
        }
        
        if (winTextAnim.active) {
            sCtx.save();
            sCtx.translate(currentX, currentY);
            sCtx.scale(scale, scale);
            sCtx.font = `900 ${fontSize}px 'Sawarabi Mincho', serif`;
            sCtx.textAlign = "center";
            sCtx.textBaseline = "middle";
            sCtx.shadowColor = "rgba(0,0,0,0.8)";
            sCtx.shadowBlur = 12; sCtx.shadowOffsetX = 5; sCtx.shadowOffsetY = 5;
            const grad = sCtx.createLinearGradient(0, -fontSize/2, 0, fontSize/2);
            grad.addColorStop(0, "#fff"); grad.addColorStop(0.5, "#ffeb3b"); grad.addColorStop(1, "#fbc02d");
            sCtx.lineWidth = 10; sCtx.strokeStyle = "#4a2a1a";
            sCtx.strokeText(winTextAnim.text, 0, 0);
            sCtx.fillStyle = grad; sCtx.fillText(winTextAnim.text, 0, 0);
            sCtx.restore();
        }
    }

    // カウントアップ処理（勝利演出中以外、かつ目標に届いていない場合）
    if (slotState === STATE.PAYOUT && !winTextAnim.active && medals < targetMedals) {
        const addAmount = Math.max(1, Math.ceil((targetMedals - medals) / 10));
        medals += addAmount;
        if (medals >= targetMedals) {
            medals = targetMedals;
            playSE('sausage_get', 0.8);
        } else if (medals % 2 === 0) {
            playSE('jump1', 0.1); 
        }
        saveMedalData();
        updateSlotUI();
    }

    if (isReach && slotState === STATE.SPINNING) {
        const reachScale = 1.0 + Math.sin(Date.now() / 200) * 0.05;
        sCtx.save();
        sCtx.translate(SLOT_WIDTH / 2, 450); // 止めるボタンの上あたり
        sCtx.scale(reachScale, reachScale);
        sCtx.font = "900 52px 'Sawarabi Mincho', serif";
        sCtx.textAlign = "center"; sCtx.textBaseline = "middle";
        sCtx.shadowColor = "rgba(0,0,0,0.8)"; sCtx.shadowBlur = 8; sCtx.shadowOffsetX = 3; sCtx.shadowOffsetY = 3;
        const reachGrad = sCtx.createLinearGradient(0, -25, 0, 25);
        reachGrad.addColorStop(0, "#fff"); reachGrad.addColorStop(0.5, "#ff5e5e"); reachGrad.addColorStop(1, "#d32f2f");
        sCtx.lineWidth = 8; sCtx.strokeStyle = "#2e1a1a";
        sCtx.strokeText("REACH!!", 0, 0);
        sCtx.fillStyle = reachGrad; sCtx.fillText("REACH!!", 0, 0);
        sCtx.restore();
    }
    slotReqId = requestAnimationFrame(slotLoop);
}

function debugForceWin(symbolType) {
    if (slotState !== STATE.SPINNING) return;
    reels.forEach(reel => {
        reel.isSpinning = true;
        reel.isStopping = true;
        const targetIdx = REEL_STRIP.indexOf(symbolType);
        if (targetIdx !== -1) reel.stopTarget = targetIdx;
    });
    updateSlotUI();
}

// nextGame関数もこちらで確実に上書きしてください
function nextGame() {
    if (slotState !== STATE.PAYOUT) return;
    if (winTextAnim.active || medals < targetMedals) {
        winTextAnim.active = false;
        medals = targetMedals;
        saveMedalData();
        updateSlotUI();
        playSE('sausage_get', 0.5);
    } else {
        if (currentBet > targetMedals) currentBet = Math.max(1, targetMedals);
        slotState = STATE.IDLE;
        updateSlotUI();
    }
}