let initDone = false;

async function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

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

        const resOnibi = await fetch('json/onibi.json'); // 追加：鬼火の設定ロード
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
                } else if (asset.type === 'animation') {
                    asset.imgObj = new Image();
                    asset.imgObj.src = fixAssetPath(asset.source, 'image');
                } else if (asset.type === 'image') {
                    asset.imgObj = new Image();
                    asset.imgObj.src = fixAssetPath(asset.src, 'image');
                } else if (asset.type === 'folder' && asset.children) {
                    await Promise.all(asset.children.map(child => loadAsset(child)));
                } else if (asset.type === 'comp' && asset.layers) {
                    asset.layers.forEach(layer => {
                        if (layer.source && (!layer.imgObj || !layer.imgObj.src)) {
                            layer.imgObj = new Image();
                            layer.imgObj.src = fixAssetPath(layer.source, 'image');
                        }
                    });
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

        // OPとEDのアセットをプリロード
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
        await loadSE('gather_energy', 'sound/B_Gather_energy.mp3'); // ドローンB：チャージ
        await loadSE('charge_dash', 'sound/B_Charge.mp3');         // ドローンB：突進
        await loadSE('soft_flame', 'sound/C_Soft_flame.mp3');
        await loadSE('damage', 'sound/damage.mp3'); // ダメージSE
        await loadSE('sausage_get', 'sound/Sausage.mp3'); // ソーセージ取得SE
        await loadSE('barrier', 'sound/Barrier.mp3'); // ボスバリアSE
        await loadSE('roar', 'sound/roar.mp3'); // 巨大手裏剣SE
        await loadSE('impact', 'sound/impact.mp3'); // ボス衝撃波SE
        await loadSE('siren', 'sound/Siren.mp3'); // ミタマアラートSE
    } catch (e) {
        console.error("Failed to load configs:", e);
    }

    fitWindow();
    window.addEventListener('resize', fitWindow);
    setupControls();
    
    sakuya.groundY = GROUND_Y_POS;
    initDone = true;

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.style.opacity = '1';
        const inner = startBtn.querySelector('.modal-btn-inner');
        if (inner) inner.innerText = '開始';
    }

    requestAnimationFrame(gameLoop);
}

function startGame() {
    if (!initDone || isGameRunning) return; 
    resetGameState();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    bgm.currentTime = 0;
    bgm2.currentTime = 0;
    bgm.volume = 0.4;
    bgm2.volume = 0.4;
    if (isSoundOn) bgm.play().catch(e => console.error("BGM playback failed:", e));
    document.getElementById('title-screen').style.display = 'none';
    
    if (opConfig) {
        isOpRunning = true;
        opTime = 0;
    } else {
        document.getElementById('progress-container').style.display = 'block';
        document.getElementById('ninjutsu-container').style.display = 'block';
        document.getElementById('debug-skip-btn').style.display = 'flex';
        document.getElementById('debug-skip-btn-3').style.display = 'flex';
        document.querySelector('.hud').style.display = 'block';
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
    
    // UIを隠す
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
    
    // クリア用のモーダル表示（既存のモーダルを流用、または新規作成も可能）
    const modalText = document.getElementById('modal-text');
    if (modalText) modalText.innerText = "GAME CLEAR!";
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'flex';
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

function endGame(msg) {
    gameOver = true;
    isGameRunning = false;
    if (bgmFadeInterval) clearInterval(bgmFadeInterval);
    bgm.pause();
    bgm2.pause();
    document.getElementById('modal-text').innerText = msg;
    document.getElementById('modal-overlay').style.display = 'flex';
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
        if (isSoundOn && isGameRunning) {
            if (isThirdScene) bgm2.play().catch(() => {});
            else bgm.play().catch(() => {});
        }
    } else {
        overlay.style.display = 'flex';
        isPaused = true;
        if (bgmFadeInterval) clearInterval(bgmFadeInterval);
        bgm.pause();
        bgm2.pause();
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
    document.getElementById('title-screen').style.display = 'flex';
}

function toggleSound() {
    isSoundOn = !isSoundOn;
    bgm.muted = !isSoundOn;
    bgm2.muted = !isSoundOn;
    const btnText = document.getElementById('sound-btn-text');
    if (btnText) btnText.innerText = `音: ${isSoundOn ? 'ON' : 'OFF'}`;
    if (isSoundOn) {
        if (isGameRunning && !isPaused) {
            if (isThirdScene) bgm2.play().catch(() => {});
            else bgm.play().catch(() => {});
        }
    } else {
        if (bgmFadeInterval) clearInterval(bgmFadeInterval);
        bgm.pause();
        bgm2.pause();
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
    spawnWaveIndex = 0; // 追加
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
    
    bullets = [];
    enemies = [];
    onibis = [];
    items = [];
    itemSpawnTimer = 0;
    sakuya.healFlashTimer = 0;
    mitama.healFlashTimer = 0;
    enemyLasers = [];
    onibis = []; // 追加：鬼火の初期化
    explosions = [];
    platforms = [];
    bgX = 0;

    if (bgmFadeInterval) {
        clearInterval(bgmFadeInterval);
        bgmFadeInterval = null;
    }
    bgm.pause();
    bgm2.pause();
    bgm.volume = 0.4;
    bgm2.volume = 0.4;
    bgm.currentTime = 0;
    bgm2.currentTime = 0;
    
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.style.width = '0%';
    const progressMarker = document.getElementById('progress-halfway-marker');
    if (progressMarker) progressMarker.classList.remove('reached');
    const goalMarker = document.getElementById('progress-goal-marker');
    if (goalMarker) goalMarker.classList.remove('reached');
}

init();