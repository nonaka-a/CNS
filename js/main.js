let initDone = false;
let loadingFrame = 0;
let loadingTimer = 0;
let loadingLoopId = null;

async function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // --- ロード画面のアニメーションループ開始 ---
    const lCanvas = document.getElementById('loading-canvas');
    const lCtx = lCanvas.getContext('2d');
    const loadingImg = new Image();
    loadingImg.src = 'images/Sprite/sakuya.png';

    function loadingLoop(timestamp) {
        lCtx.clearRect(0, 0, 256, 256);
        if (loadingImg.complete) {
            // sakuya.png の run_m (ミタマ抱え走り) は y=256 の段にあると想定
            // 256x256ピクセルのフレームを4枚ループ
            const frameIdx = Math.floor(timestamp / 100) % 4;
            lCtx.drawImage(loadingImg, frameIdx * 256, 256, 256, 256, 0, 0, 256, 256);
        }
        loadingLoopId = requestAnimationFrame(loadingLoop);
    }
    requestAnimationFrame(loadingLoop);

    try {
        const response = await fetch('json/sakuya.json');
        sakuyaConfig = await response.json();
        
        const resExp = await fetch('json/Explosion_A.json');
        explosionConfig = await resExp.json();
        const resExpB = await fetch('json/Explosion_B.json');
        explosionConfigB = await resExpB.json();

        const resMitama = await fetch('json/mitama.json');
        mitamaConfig = await resMitama.json();

        const resDrone = await fetch('json/droneA.json');
        droneConfig = await resDrone.json();

        const resOnibi = await fetch('json/onibi.json'); 
        onibiConfig = await resOnibi.json();

        const resOP = await fetch('json/OP.json');
        opConfig = await resOP.json();

        const resBoss = await fetch('json/iina.json');
        bossConfig = await resBoss.json();

        const resEND = await fetch('json/END.json');
        if (resEND.ok) endConfig = await resEND.json();

        const fixAssetPath = (p, type) => {
            if (!p) return p;
            if (p.startsWith('data:')) return p;
            let normalized = p.replace(/\\/g, '/');
            if (type === 'audio') {
                let subPath = normalized.includes('sound/') ? normalized.split('sound/')[1] : 
                              normalized.includes('sounds/') ? normalized.split('sounds/')[1] : 
                              normalized.split('/').pop();
                subPath = subPath.replace('.mp3.png', '.mp3').replace('.wav.png', '.wav').replace('.ogg.png', '.ogg');
                return `sound/${subPath}`;
            } else {
                let subPath = normalized.includes('images/') ? normalized.split('images/')[1] : 
                              normalized.includes('image/') ? normalized.split('image/')[1] : 
                              normalized.split('/').pop();
                if (subPath.includes('/')) return `images/${subPath}`;
                const bgPatterns = ['BG', 'Building', 'Gradation', 'Guardrail', 'Streetlight', 'vignette'];
                const isBG = bgPatterns.some(pattern => subPath.startsWith(pattern));
                if (isBG) return `images/BG/${subPath}`;
                else return `images/Sprite/${subPath}`;
            }
        };

        const loadEventAssets = async (config) => {
            if (!config || !config.assets) return;
            const loadAsset = async (asset) => {
                if (!asset) return;
                if (asset.type === 'audio') {
                    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    try {
                        const url = fixAssetPath(asset.src, 'audio');
                        const response = await fetch(url);
                        const buffer = await response.arrayBuffer();
                        asset.audioBuffer = await audioCtx.decodeAudioData(buffer);
                    } catch (err) { console.error("Event Audio Load Error:", asset.name, err); }
                } else if (asset.type === 'animation' || asset.type === 'image') {
                    asset.imgObj = new Image();
                    asset.imgObj.src = fixAssetPath(asset.type === 'animation' ? asset.source : asset.src, 'image');
                    await new Promise(resolve => { asset.imgObj.onload = resolve; asset.imgObj.onerror = resolve; });
                } else if (asset.type === 'folder' && asset.children) {
                    await Promise.all(asset.children.map(child => loadAsset(child)));
                } else if (asset.type === 'comp' && asset.layers) {
                    await Promise.all(asset.layers.map(async layer => {
                        if (layer.source && (!layer.imgObj || !layer.imgObj.src)) {
                            layer.imgObj = new Image();
                            layer.imgObj.src = fixAssetPath(layer.source, 'image');
                            await new Promise(resolve => { layer.imgObj.onload = resolve; layer.imgObj.onerror = resolve; });
                        }
                    }));
                }
            };
            await Promise.all(config.assets.map(asset => loadAsset(asset)));
            const comp = config.assets.find(a => a.id === "comp_1");
            if (comp) {
                comp.layers.forEach(layer => {
                    const refId = layer.assetId || layer.animAssetId;
                    const asset = (function findAsset(id, list) {
                        for (let a of list) {
                            if (a.id === id) return a;
                            if (a.type === 'folder' && a.children) {
                                let found = findAsset(id, a.children);
                                if (found) return found;
                            }
                        }
                        return null;
                    })(refId, config.assets);
                    if (asset && asset.imgObj) layer.imgObj = asset.imgObj;
                });
            }
        };

        if (opConfig) await loadEventAssets(opConfig);
        if (endConfig) await loadEventAssets(endConfig);

        await loadSE('shuriken', 'sound/Throw_a_shuriken_1.mp3');
        await loadSE('explosion', 'sound/explosion.mp3');
        await loadSE('laser', 'sound/Laser1.mp3');
        await loadSE('jump1', 'sound/jump1.mp3');
        await loadSE('jump2', 'sound/jump2.mp3');
        await loadSE('puni', 'sound/puni.mp3');
        await loadSE('puni2', 'sound/puni2.mp3');
        await loadSE('flash', 'sound/flash.mp3');
        await loadSE('gather_energy', 'sound/B_Gather_energy.mp3');
        await loadSE('charge_dash', 'sound/B_Charge.mp3');
        await loadSE('soft_flame', 'sound/C_Soft_flame.mp3');
        await loadSE('damage', 'sound/damage.mp3');
        await loadSE('sausage_get', 'sound/Sausage.mp3');
        await loadSE('barrier', 'sound/Barrier.mp3');
        await loadSE('roar', 'sound/roar.mp3');
        await loadSE('impact', 'sound/impact.mp3');
        await loadSE('siren', 'sound/Siren.mp3');
        await loadSE('slot_start', 'sound/slot_start.mp3');
        await loadSE('slot_stop', 'sound/slot_stop.mp3');

    } catch (e) {
        console.error("Failed to load configs:", e);
    }

    fitWindow();
    window.addEventListener('resize', fitWindow);
    setupControls();
    
    sakuya.groundY = GROUND_Y_POS;
    initDone = true;

    // エンドレスモードデータの読み込みとUI反映
    if (typeof loadEndlessData === 'function') {
        loadEndlessData();
        if (endlessUnlocked) {
            const eb = document.getElementById('endless-btn-wrap');
            if (eb) eb.style.display = 'block';
            // ボタンが4つから5つになるためグリッドとウィンドウ幅を調整
            const grid = document.getElementById('title-btn-grid');
            if (grid) grid.style.gridTemplateColumns = 'repeat(5, 1fr)';
            const win = document.getElementById('title-window');
            if (win) win.style.width = '750px'; // 5ボタン分の横幅に拡張
        } else {
            const win = document.getElementById('title-window');
            if (win) win.style.width = '610px'; // 4ボタン分に縮小
        }
    }

    if (typeof initEndlessHUD === 'function') initEndlessHUD();

    // --- ロード完了時の処理：ロード画面を隠してループ停止 ---
    if (loadingLoopId) cancelAnimationFrame(loadingLoopId);
    const ls = document.getElementById('loading-screen');
    if (ls) {
        ls.style.opacity = '0';
        setTimeout(() => { ls.style.display = 'none'; }, 500);
    }

    const startBtn = document.getElementById('start-btn');
    const tutorialBtn = document.getElementById('tutorial-btn');
    if (startBtn) startBtn.style.opacity = '1';
    if (tutorialBtn) tutorialBtn.style.opacity = '1';

    requestAnimationFrame(gameLoop);
}

function startEndlessMode() {
    closeEndlessIntro();
    startGame();
    isEndlessMode = true;
    if (typeof endlessLoopCount !== 'undefined') endlessLoopCount = 0;
    
    // エンドレス用HUDを表示
    const ehud = document.getElementById('endless-hud');
    if (ehud) ehud.style.display = 'block';
    // 通常のプログレスバーを隠す
    const prog = document.getElementById('progress-container');
    if (prog) prog.style.display = 'none';
}

function showEndlessIntro() {
    const overlay = document.getElementById('endless-intro-overlay');
    if (overlay) {
        // ベスト記録を反映
        const bestEl = document.getElementById('endless-intro-best-dist');
        if (bestEl) {
            const formattedDist = (typeof bestEndlessDistance !== 'undefined') ? bestEndlessDistance.toLocaleString() : "0";
            bestEl.innerText = `最高到達点：${formattedDist}m`;
        }
        overlay.style.display = 'flex';
    }
}

function closeEndlessIntro() {
    const overlay = document.getElementById('endless-intro-overlay');
    if (overlay) overlay.style.display = 'none';
}

function startGame() {
    if (!initDone || isGameRunning) return; 
    isEndlessMode = false; // 通常開始時はエンドレスをOFFにする
    resetGameState();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    bgm.currentTime = 0;
    bgm2.currentTime = 0;
    bgm.volume = 0.4;
    bgm2.volume = 0.4;
    if (isSoundOn) bgm.play().catch(e => console.error("BGM playback failed:", e));
    
    // タイトル画面を完全に非表示にする
    const titleScreen = document.getElementById('title-screen');
    if (titleScreen) titleScreen.style.display = 'none';
    
    if (opConfig) {
        isOpRunning = true;
        opTime = 0;
    } else {
        // UIの表示を強制
        document.getElementById('progress-container').style.display = 'block';
        document.getElementById('ninjutsu-container').style.display = 'block';
        document.getElementById('debug-skip-btn').style.display = 'flex';
        document.getElementById('debug-skip-btn-3').style.display = 'flex';
        const hud = document.querySelector('.hud');
        if (hud) hud.style.display = 'block';
        document.getElementById('control-panel').style.display = 'flex';
        isIntro = true;
        if (window.updateBtnRects) window.updateBtnRects();
    }
    
    isGameRunning = true;
    lastFrameTime = 0;
    requestAnimationFrame(gameLoop);
}

function skipOP() {
    if (opTime < 0.5) return;
    endOP();
}

function endOP() {
    if (!isOpRunning) return;
    isOpRunning = false;
    opTime = 0;
    if (typeof stopAllOPAudio === 'function') stopAllOPAudio();
    document.getElementById('progress-container').style.display = 'block';
    document.getElementById('ninjutsu-container').style.display = 'block';
    document.getElementById('debug-skip-btn').style.display = 'flex';
    document.getElementById('debug-skip-btn-3').style.display = 'flex';
    document.querySelector('.hud').style.display = 'block';
    document.getElementById('control-panel').style.display = 'flex';
    document.getElementById('skip-op-btn').style.display = 'none';
    requestAnimationFrame(() => {
        if (window.updateBtnRects) window.updateBtnRects();
    });
    sakuya.x = -100;
    isIntro = true;
}

function startEndEvent() {
    if (!endConfig) {
        showClearScreen();
        return;
    }
    isEndingRunning = true;
    endTime = 0;
    document.getElementById('progress-container').style.display = 'none';
    document.getElementById('ninjutsu-container').style.display = 'none';
    document.getElementById('debug-skip-btn').style.display = 'none';
    document.getElementById('debug-skip-btn-3').style.display = 'none';
    document.querySelector('.hud').style.display = 'none';
    document.getElementById('control-panel').style.display = 'none';
}

function endEndEvent() {
    if (!isEndingRunning) return;
    isEndingRunning = false;
    endTime = 0;
    if (typeof stopAllOPAudio === 'function') stopAllOPAudio();
    showClearScreen();
}

function showClearScreen() {
    gameOver = true;
    isGameRunning = false;
    if (bgmFadeInterval) clearInterval(bgmFadeInterval);
    bgm.pause();
    bgm2.pause();

    // エンドレスモードのアンロック
    if (typeof unlockEndlessMode === 'function') {
        unlockEndlessMode();
    }

    const modalText = document.getElementById('modal-text');
    if (modalText) modalText.innerText = "GAME CLEAR!";
    const subText = document.getElementById('modal-subtext');
    if (subText) subText.innerText = "";
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'flex';
}

function endGame(msg) {
    gameOver = true;
    isGameRunning = false;
    if (bgmFadeInterval) clearInterval(bgmFadeInterval);
    bgm.pause();
    bgm2.pause();
    document.getElementById('modal-text').innerText = "GAME OVER";
    let subMsg = "";
    if (msg.includes("落下")) subMsg = "落下してしまった...";
    else if (msg.includes("脱落")) subMsg = "残念、ミタマ脱落...";
    else if (msg.includes("GAME OVER")) subMsg = "咲耶のライフが0になってしまった..";
    else if (msg.includes("MITAMA DESTROYED")) subMsg = "ミタマのライフが0になってしまった..";
    else subMsg = msg;
    const subTextElement = document.getElementById('modal-subtext');
    if (subTextElement) subTextElement.innerText = subMsg;
    document.getElementById('modal-overlay').style.display = 'flex';
}

function gameLoop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const elapsed = timestamp - lastFrameTime;
    if (elapsed >= FRAME_INTERVAL) {
        lastFrameTime = timestamp - (elapsed % FRAME_INTERVAL);
        update();
        draw();
    }
    if (isGameRunning) requestAnimationFrame(gameLoop);
}

function fitWindow() {
    const wrapper = document.getElementById('main-wrapper');
    const scale = Math.min(window.innerWidth / CANVAS_WIDTH, window.innerHeight / CANVAS_HEIGHT);
    wrapper.style.transform = `scale(${scale})`;
}

let settingsTimer = 0;
function toggleSettings() {
    const now = Date.now();
    if (now - settingsTimer < 300) return;
    settingsTimer = now;
    const overlay = document.getElementById('settings-overlay');
    if (!overlay) return;
    if (overlay.style.display === 'flex') {
        overlay.style.display = 'none';
        isPaused = false;
        if (isSoundOn) {
            if (isGameRunning) {
                if (isThirdScene) bgm2.play().catch(() => {});
                else bgm.play().catch(() => {});
            }
            if (typeof slotActive !== 'undefined' && slotActive) {
                bgmSlot.play().catch(() => {});
            }
        }
    } else {
        overlay.style.display = 'flex';
        isPaused = true;
        if (bgmFadeInterval) clearInterval(bgmFadeInterval);
        bgm2.pause();
        bgmSlot.pause();
    }
}

function toggleCredits() {
    const overlay = document.getElementById('credits-overlay');
    if (!overlay) return;
    if (overlay.style.display === 'flex') {
        overlay.style.display = 'none';
        isPaused = false;
    } else {
        overlay.style.display = 'flex';
        isPaused = true;
    }
}

function backToTitle() {
    isGameRunning = false;
    isPaused = false;
    if (bgmFadeInterval) clearInterval(bgmFadeInterval);
    bgm.pause();
    bgm2.pause();
    document.getElementById('settings-overlay').style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('credits-overlay').style.display = 'none';
    
    // 追加：メインゲームのUI要素を確実に非表示にする
    document.getElementById('progress-container').style.display = 'none';
    document.getElementById('ninjutsu-container').style.display = 'none';
    document.getElementById('boss-hp-container').style.display = 'none';
    const hud = document.querySelector('.hud');
    if (hud) hud.style.display = 'none';
    document.getElementById('control-panel').style.display = 'none';
    
    // エンドレス用HUDも隠す
    const ehud = document.getElementById('endless-hud');
    if (ehud) ehud.style.display = 'none';

    // タイトル画面のボタン更新（アンロック対応）
    if (endlessUnlocked) {
        const eb = document.getElementById('endless-btn-wrap');
        if (eb) eb.style.display = 'block';
        const grid = document.getElementById('title-btn-grid');
        if (grid) grid.style.gridTemplateColumns = 'repeat(5, 1fr)';
        const win = document.getElementById('title-window');
        if (win) win.style.width = '750px'; // 5ボタン分の横幅に拡張
    } else {
        const win = document.getElementById('title-window');
        if (win) win.style.width = '610px'; // 4ボタン分に縮小
    }

    document.getElementById('title-screen').style.display = 'flex';
    if (window.updateBtnRects) window.updateBtnRects();
}

function resetDebugData() {
    if (confirm("【デバッグ】セーブデータをすべて削除して初期化しますか？\n(アンロック状況やメダル、ベスト記録がすべて消えます)")) {
        localStorage.clear();
        location.reload();
    }
}

function toggleSound() {
    isSoundOn = !isSoundOn;
    bgm.muted = !isSoundOn;
    bgm2.muted = !isSoundOn;
    bgmSlot.muted = !isSoundOn;
    const btnText = document.getElementById('sound-btn-text');
    if (btnText) btnText.innerText = `音: ${isSoundOn ? 'ON' : 'OFF'}`;
    if (isSoundOn) {
        if (!isPaused) {
            if (isGameRunning) {
                if (isThirdScene) bgm2.play().catch(() => {});
                else bgm.play().catch(() => {});
            }
            if (typeof slotActive !== 'undefined' && slotActive) {
                bgmSlot.play().catch(() => {});
            }
        }
    } else {
        if (bgmFadeInterval) clearInterval(bgmFadeInterval);
        bgm.pause();
        bgm2.pause();
        bgmSlot.pause();
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}

function resetGameState() {
    distance = 0;
    bgDistance = 0;
    spawnWaveIndex = 0;
    halfwayReached = false;
    goalThresholdReached = false;
    isHalfwayTransitioning = false;
    halfwayTransitionTimer = 0;
    isSecondScene = false;
    isThirdScene = false;
    currentZoom = 1.0;
    bossActive = false;
    bossDefeated = false;
    bossSpawnTimer = 0;
    bossDefeatTimer = 0;
    ninjutsuGauge = 0;
    ninjutsuFullTriggered = false;
    gameOver = false;
    isIntro = true;
    isPaused = false;
    isEndingRunning = false;
    endTime = 0;
    isWhiteFading = false;
    whiteFadeAlpha = 0;
    isBgmFading = false;
    sakuya.x = -150;
    sakuya.y = 0;
    sakuya.vx = 0;
    sakuya.vy = 0;
    sakuya.groundY = GROUND_Y_POS;
    sakuya.jumpOffset = 0;
    sakuya.hp = 100;
    sakuya.isJumping = false;
    sakuya.jumpCount = 0;
    sakuya.attackTimer = 0;
    sakuya.currentAnim = 'idle';
    sakuya.currentFrame = 0;
    sakuya.invincibleTimer = 0;
    mitama.hp = 50;
    mitama.isHolding = true;
    mitama.currentAnim = 'idle';
    mitama.currentFrame = 0;
    mitama.frameTimer = 0;
    mitama.jumpOffset = 0;
    mitama.vy = 0;
    mitama.invincibleTimer = 0;
    boss.hp = boss.maxHp;
    boss.visible = false;
    boss.x = -500;
    boss.isArrived = false;
    boss.state = 'idle'; // 追加: 状態を初期化
    boss.currentAnim = 'idle'; // 追加: アニメーションを初期化
    boss.currentFrame = 0;
    boss.frameTimer = 0;
    bullets = [];
    enemies = [];
    onibis = [];
    items = [];
    itemSpawnTimer = 0;
    sakuya.healFlashTimer = 0;
    mitama.healFlashTimer = 0;
    enemyLasers = [];
    explosions = [];
    platforms = [];
    bgX = 0;
    if (bgmFadeInterval) { clearInterval(bgmFadeInterval); bgmFadeInterval = null; }
    bgm.pause(); bgm2.pause();
    bgm.volume = 0.4; bgm2.volume = 0.4;
    bgm.currentTime = 0; bgm2.currentTime = 0;
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.style.width = '0%';
    const progressMarker = document.getElementById('progress-halfway-marker');
    if (progressMarker) progressMarker.classList.remove('reached');
    const goalMarker = document.getElementById('progress-goal-marker');
    if (goalMarker) goalMarker.classList.remove('reached');
}

init();