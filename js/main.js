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

        const resMitama = await fetch('json/mitama.json');
        mitamaConfig = await resMitama.json();

        const resDrone = await fetch('json/droneA.json');
        droneConfig = await resDrone.json();

        const resOP = await fetch('json/OP.json');
        opConfig = await resOP.json();

        // OP画像のプリロード
        if (opConfig && opConfig.assets) {
            const comp = opConfig.assets.find(a => a.type === 'comp');
            if (comp) {
                comp.layers.forEach(layer => {
                    if (layer.source) {
                        layer.imgObj = new Image();
                        if (layer.source.startsWith('data:image')) {
                            layer.imgObj.src = layer.source;
                        } else {
                            // 絶対パスが含まれる場合は相対パス(images/...)に変換を試みる
                            const parts = layer.source.split('/');
                            const fileName = parts[parts.length - 1];
                            layer.imgObj.src = `images/${fileName}`;
                        }
                    }
                });
            }
        }

        // SEの先行ロード
        await loadSE('shuriken', 'sound/Throw_a_shuriken_1.mp3');
        await loadSE('explosion', 'sound/explosion.mp3');
        await loadSE('laser', 'sound/Laser1.mp3');
        await loadSE('jump1', 'sound/jump1.mp3');
        await loadSE('jump2', 'sound/jump2.mp3');
        await loadSE('puni', 'sound/puni.mp3');
        await loadSE('puni2', 'sound/puni2.mp3');
        await loadSE('flash', 'sound/flash.mp3');
    } catch (e) {
        console.error("Failed to load configs:", e);
    }

    fitWindow();
    window.addEventListener('resize', fitWindow);
    setupControls();
    
    sakuya.groundY = GROUND_Y_POS;
    requestAnimationFrame(gameLoop);
}

function startGame() {
    if (isGameRunning) return; // 二重起動防止
    
    resetGameState();
    
    // iOS/iPadでの低遅延再生を有効にするためユーザー操作時に再開
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // BGMの再生開始
    bgm.currentTime = 0;
    if (isSoundOn) {
        bgm.play().catch(e => console.error("BGM playback failed:", e));
    }

    document.getElementById('title-screen').style.display = 'none';
    
    if (opConfig) {
        isOpRunning = true;
        opTime = 0;
    }
    
    isGameRunning = true;
    lastFrameTime = 0;
    requestAnimationFrame(gameLoop);
}

function skipOP() {
    endOP();
}

function endOP() {
    if (!isOpRunning) return;
    isOpRunning = false;
    opTime = 0;

    // UIの表示復帰
    document.getElementById('progress-container').style.display = 'block';
    document.getElementById('ninjutsu-container').style.display = 'block';
    document.querySelector('.hud').style.display = 'block';
    document.getElementById('control-panel').style.display = 'flex';
    document.getElementById('skip-op-btn').style.display = 'none';

    // ゲーム本編の開始準備
    sakuya.x = -100;
    isIntro = true;
}


function gameLoop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const elapsed = timestamp - lastFrameTime;

    // TARGET_FPS (60fps) 以上時間が経過したときのみ更新・描画
    if (elapsed >= FRAME_INTERVAL) {
        // 次のフレームまでの余剰時間を考慮して更新
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
    
    // BGMの停止
    bgm.pause();

    document.getElementById('modal-text').innerText = msg;
    document.getElementById('modal-overlay').style.display = 'flex';
}

/**
 * --- SETTINGS & CONTROL ---
 */
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
            bgm.play().catch(() => {});
        }
    } else {
        overlay.style.display = 'flex';
        isPaused = true;
        bgm.pause();
    }
}

function backToTitle() {
    isGameRunning = false;
    isPaused = false;
    bgm.pause();
    document.getElementById('settings-overlay').style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('title-screen').style.display = 'flex';
}

function toggleSound() {
    isSoundOn = !isSoundOn;
    bgm.muted = !isSoundOn;
    
    const btnText = document.getElementById('sound-btn-text');
    if (btnText) {
        btnText.innerText = `音: ${isSoundOn ? 'ON' : 'OFF'}`;
    }
    
    if (isSoundOn) {
        if (isGameRunning && !isPaused) {
            bgm.play().catch(() => {});
        }
    } else {
        bgm.pause();
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

function resetGameState() {
    distance = 0;
    gameOver = false;
    isIntro = true;
    isPaused = false;
    
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
    if (sakuya.invincibleTimer !== undefined) sakuya.invincibleTimer = 0;
    
    mitama.hp = 50;
    mitama.isHolding = true;
    mitama.currentAnim = 'idle';
    mitama.currentFrame = 0;
    mitama.frameTimer = 0;
    mitama.jumpOffset = 0;
    mitama.vy = 0;
    if (mitama.invincibleTimer !== undefined) mitama.invincibleTimer = 0;
    
    bullets = [];
    enemies = [];
    enemyLasers = [];
    explosions = [];
    bgX = 0;
    
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.style.width = '0%';
}

init();