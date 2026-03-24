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

        // SEの先行ロード
        await loadSE('shuriken', 'sound/Throw_a_shuriken_1.mp3');
        await loadSE('explosion', 'sound/explosion.mp3');
        await loadSE('laser', 'sound/Laser1.mp3');
        await loadSE('jump1', 'sound/jump1.mp3');
        await loadSE('jump2', 'sound/jump2.mp3');
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
    
    // iOS/iPadでの低遅延再生を有効にするためユーザー操作時に再開
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    document.getElementById('title-screen').style.display = 'none';
    isGameRunning = true;
    requestAnimationFrame(gameLoop);
}


function gameLoop() {
    update();
    draw();
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
    document.getElementById('modal-text').innerText = msg;
    document.getElementById('modal-overlay').style.display = 'flex';
}

init();