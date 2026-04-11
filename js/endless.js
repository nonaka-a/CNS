/**
 * js/endless.js
 * Endless Mode Logic & UI
 */

let endlessLoopCount = 0;

function initEndlessHUD() {
    let hud = document.getElementById('endless-hud');
    if (hud) return;

    hud = document.createElement('div');
    hud.id = 'endless-hud';
    hud.style.position = 'absolute';
    hud.style.top = '15px'; // 進捗ゲージの高さに合わせて少し上に引き上げ
    hud.style.left = '50%';
    hud.style.transform = 'translateX(-50%)';
    hud.style.display = 'none';
    hud.style.zIndex = '500';
    hud.style.background = '#2a2a2a';
    hud.style.border = '3px solid #8c6e5e';
    hud.style.boxShadow = 'inset 0 0 0 2px #111, 0 4px 10px rgba(0,0,0,0.5)';
    hud.style.padding = '8px 40px';
    hud.style.fontFamily = "'Sawarabi Mincho', serif";
    hud.style.color = '#fff';
    hud.style.minWidth = '300px'; 
    hud.style.textAlign = 'center';
    hud.style.pointerEvents = 'none';

    // 角のデザイン（他のウィンドウと統一）
    ['m-tp-l', 'm-tp-r', 'm-bt-l', 'm-bt-r'].forEach(cls => {
        const c = document.createElement('div');
        c.className = `modal-corner ${cls}`;
        hud.appendChild(c);
    });

    hud.innerHTML += `
        <div style="display: flex; gap: 40px; justify-content: center; align-items: flex-end; line-height: 1;">
            <div style="text-align: center;">
                <div style="font-size: 14px; color: #fbc02d; margin-bottom: 6px; letter-spacing: 1px;">現在距離</div>
                <div id="endless-current-dist" style="font-size: 22px; font-weight: bold; text-shadow: 1px 1px 3px #000; color: #fff;">0<span style="font-size: 14px; margin-left: 3px;">m</span></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 14px; color: #fbc02d; margin-bottom: 6px; letter-spacing: 1px;">BEST</div>
                <div id="endless-best-dist" style="font-size: 22px; font-weight: bold; color: #aaa; text-shadow: 1px 1px 3px #000;">0<span style="font-size: 14px; margin-left: 3px;">m</span></div>
            </div>
        </div>
    `;

    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.appendChild(hud);
}

function updateEndlessHUD() {
    if (!isEndlessMode) return;
    
    const curEl = document.getElementById('endless-current-dist');
    const bestEl = document.getElementById('endless-best-dist');
    
    if (curEl) {
        // 表示距離は周回分を合算してから計算
        const totalDist = distance + (endlessLoopCount * goalDistance);
        const displayDist = Math.floor(totalDist / 20);
        curEl.innerHTML = `${displayDist.toLocaleString()}<span style="font-size: 14px; margin-left: 3px;">m</span>`;
        
        // ベスト更新チェック
        if (displayDist > bestEndlessDistance) {
            bestEndlessDistance = displayDist;
            saveEndlessData();
        }
    }
    
    if (bestEl) {
        bestEl.innerHTML = `${bestEndlessDistance.toLocaleString()}<span style="font-size: 14px; margin-left: 3px;">m</span>`;
    }
}

function checkEndlessLoop() {
    if (!isEndlessMode) return;

    // ゴール地点（エリア3ボス撃破後など）に達したらループ
    // 距離が goalDistance を超えたらエリア1(0)に戻すが、累積距離は保持したい場合は別の工夫が必要
    // 今回はエリア遷移をループさせるため、フラグ類をリセットしてエリア1の開始状態へ
    if (distance >= goalDistance) {
        // エリア3の終了(95%以降)かつボス撃破済みなら周回移行を開始
        if (isThirdScene && bossDefeated && bossDefeatTimer >= 6000 && !isHalfwayTransitioning) {
            startEndlessLoopTransition();
        }
    }
}

function startEndlessLoopTransition() {
    isHalfwayTransitioning = true;
    halfwayTransitionTimer = 0;
    // 移行の間、無敵を付与
    sakuya.invincibleTimer = 240;
    playSE('jump1');
}

function loopToEndlessStart() {
    console.log("Endless Loop: Completing transition to Area 1");
    
    // 状態のリセット（背景以外のリセットをここで行う）
    distance = 0;
    bgDistance = 0;
    spawnWaveIndex = 0;
    halfwayReached = false;
    goalThresholdReached = false;
    isSecondScene = false;
    isThirdScene = false;
    bossActive = false;
    bossDefeated = false;
    bossSpawnTimer = 0;
    bossDefeatTimer = 0;
    
    // ボスのステータスリセット（体力など）
    boss.hp = boss.maxHp;
    boss.state = 'intro';
    boss.stateTimer = 0;
    boss.patternIndex = 1;
    boss.isArrived = false;
    boss.x = -500;
    boss.visible = false;
    endlessLoopCount++; // ここで周回カウントを増やす
    
    // 敵や弾のクリア
    enemies = [];
    enemyLasers = [];
    bullets = [];
    explosions = [];
    onibis = [];
    items = [];
    
    // BGMを戻す
    if (typeof bgm !== 'undefined' && isSoundOn) {
        bgm2.pause();
        bgm.currentTime = 0;
        bgm.play();
    }
}

function saveEndlessData() {
    localStorage.setItem('bestEndlessDistance', bestEndlessDistance);
}

function loadEndlessData() {
    const savedBest = localStorage.getItem('bestEndlessDistance');
    if (savedBest) bestEndlessDistance = parseInt(savedBest);
    
    const unlocked = localStorage.getItem('endlessUnlocked');
    if (unlocked === 'true') endlessUnlocked = true;
}

function unlockEndlessMode() {
    if (!endlessUnlocked) {
        endlessUnlocked = true;
        localStorage.setItem('endlessUnlocked', 'true');
        console.log("Endless Mode Unlocked!");
    }
}

// 敵のステータス補正（HP+1, 攻撃待ち/予兆を半分）
function applyEndlessDifficulty(enemy) {
    if (!isEndlessMode) return;
    
    // HP +1
    if (enemy.hp !== undefined) enemy.hp += 1;
    
    // 攻撃間隔・予兆時間を半分にする
    // Aタイプ（雑兵）
    if (enemy.type === 'A') {
        if (enemy.attackInterval) enemy.attackInterval = Math.floor(enemy.attackInterval / 2);
        if (enemy.telegraphMax) enemy.telegraphMax = Math.floor(enemy.telegraphMax / 2);
    }
    // Bタイプ（ドローン）
    if (enemy.type === 'B') {
        if (enemy.waitTimer !== undefined) {
             // 待機時間を短縮（思考停止時間を減らす）
        }
    }
    // Cタイプ（鬼火）
    if (enemy.type === 'C') {
        // 突進までの貯めなどを短縮
    }
}
