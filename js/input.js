function subAction() {
    if (isIntro || isHalfwayTransitioning || ninjutsuGauge < NINJUTSU_MAX || giantShuriken || cutInTimer > 0) return;

    cutInTimer = 42; // 0.2s暗転(12f) + 0.5sカットイン(30f)
    // ゲージのリセットは発射時に行うが、二重入力を防ぐためここではタイマーを優先チェック
}

function setupControls() {
    window.addEventListener('keydown', (e) => {
    if (isOpRunning) {
        skipOP();
        return;
    }
    // 矢印キーとWASDキーの連動
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.ArrowLeft = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.ArrowRight = true;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.ArrowUp = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.ArrowDown = true;
    
    // アクションキー
    if (e.code === 'Space') jump();
    if (e.code === 'KeyV') keys.Shoot = true;
    if (e.code === 'KeyB') toggleMode();
    if (e.code === 'KeyN') subAction();

    // 開発デバッグ用（削除済み）

});

    
    window.addEventListener('keyup', (e) => {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.ArrowLeft = false;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.ArrowRight = false;
        if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.ArrowUp = false;
        if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.ArrowDown = false;
        if (e.code === 'KeyV') keys.Shoot = false;
    });

    const btnMap = [
        { id: 'btn-left', key: 'ArrowLeft' },
        { id: 'btn-right', key: 'ArrowRight' },
        { id: 'btn-up', key: 'ArrowUp' },
        { id: 'btn-down', key: 'ArrowDown' },
        { id: 'btn-jump', key: 'Shoot' }, // shootアクションをキー管理に変更
        { id: 'btn-attack', action: toggleMode },
        { id: 'btn-mode', action: jump },
        { id: 'btn-settings', action: typeof toggleSettings !== 'undefined' ? toggleSettings : null },
        { id: 'btn-sub', action: subAction }
        // デバッグボタン処理は無効化

    ];

    // ボタンのレクト情報をキャッシュする（レイアウトスライッシング防止）
    window.updateBtnRects = function() {
        btnMap.forEach(b => {
            const el = document.getElementById(b.id);
            if (el) {
                const rect = el.getBoundingClientRect();
                // 画面外や非表示の場合はスキップ
                if (rect.width > 0 && rect.height > 0) {
                    b.rect = rect;
                    b.el = el;
                }
            }
        });
    }
    
    // 初期化時とリサイズ時にキャッシュを更新
    window.updateBtnRects();
    window.addEventListener('resize', () => {
        setTimeout(updateBtnRects, 100); // スケール反映待ち
    });

    const handleTouch = (e) => {
        // クレジット画面内などのスクロールが必要な要素ではデフォルト動作（スクロール）を許可
        if (e.target.closest('#credits-window')) return;
        
        if (e.cancelable) e.preventDefault();
        
        if (isOpRunning) {
            skipOP();
            return;
        }

        // デバッグボタンなどが後から表示された場合に備え、
        // タッチ開始時に座標情報がないボタンがあれば一度更新を試みる
        if (e.type === 'touchstart' && btnMap.some(b => !b.rect)) {
            updateBtnRects();
        }

        let currentKeys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false, Shoot: false };
        let activeIds = new Set();

        if (e.type !== 'touchend') {
            for (let i = 0; i < e.touches.length; i++) {
                const t = e.touches[i];
                btnMap.forEach(b => {
                    // 要素が非表示(display:none)の場合は判定をスキップ
                    if (!b.el || b.el.offsetParent === null) return;
                    const rect = b.rect;
                    if (!rect) return;
                    const margin = 20; // 判定に余裕を持たせる
                    if (t.clientX >= rect.left - margin && t.clientX <= rect.right + margin &&
                        t.clientY >= rect.top - margin && t.clientY <= rect.bottom + margin) {
                        
                        if (b.key) currentKeys[b.key] = true;
                        if (b.action && e.type === 'touchstart') b.action();
                        activeIds.add(b.id);
                    }
                });
            }
        }

        // 状態が実際に変わった時だけDOM（classList）を操作する
        btnMap.forEach(b => {
            if (b.el) {
                const isActive = activeIds.has(b.id);
                if (isActive) {
                    if (!b.el.classList.contains('active')) b.el.classList.add('active');
                } else {
                    if (b.el.classList.contains('active')) b.el.classList.remove('active');
                }
            }
        });
        
        Object.assign(keys, currentKeys);
    };

    window.addEventListener('touchstart', handleTouch, { passive: false });
    window.addEventListener('touchmove', handleTouch, { passive: false });
    window.addEventListener('touchend', handleTouch, { passive: false });
}

function jump() {
    if (isIntro || isHalfwayTransitioning || sakuya.jumpCount < 2) {
        if (isIntro || isHalfwayTransitioning) return; // イントロ・トランジション中はジャンプ不可
        if (sakuya.jumpCount === 0) playSE('jump1', 0.6);
        else playSE('jump2', 0.6);
        sakuya.vy = sakuya.jumpPower;
        sakuya.isJumping = true;
        sakuya.jumpCount++;
    }
}

function toggleMode() {
    if (isIntro || isHalfwayTransitioning) return;
    if (mitama.isHolding) {
        mitama.isHolding = false;
        mitama.groundY = sakuya.groundY;

        // リリース位置から地面（浮遊位置）まで落下させるための初期オフセット計算
        const mScale = 1.0 + (mitama.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
        const targetGroundY = mitama.groundY - (mitama.h + 65 - Math.sin(Date.now() / 400) * 15) * mScale;
        mitama.jumpOffset = (sakuya.y + 30) - targetGroundY;
        mitama.vy = 0;
        playSE('puni');
    } else {
        // Pickup condition: collision between sakuya and mitama
        const isOverlapping = sakuya.x < mitama.x + mitama.w &&
                               sakuya.x + sakuya.w > mitama.x &&
                               sakuya.y < mitama.y + mitama.h &&
                               sakuya.y + sakuya.h > mitama.y;
        if (isOverlapping) {
            mitama.isHolding = true;
            playSE('puni2');
        } else {
            return; // Not close enough, do nothing
        }
    }
}

function shoot() {
    if (isIntro || isHalfwayTransitioning || !canShoot || mitama.isHolding || gameOver) return;

    // Create a rotating shuriken
    bullets.push({ 
        x: sakuya.x + 20, 
        y: sakuya.y + 70, 
        vx: -18, 
        w: 50, 
        h: 50,
        angle: 0,
        groundY: sakuya.groundY,
        history: []
    });

    playSE('shuriken', 0.6);

    // Cooldown: 0.5 seconds
    sakuya.attackTimer = 16;
    canShoot = false;
    setTimeout(() => { canShoot = true; }, 500);
}