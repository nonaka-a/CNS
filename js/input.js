function subAction() {
    if (isIntro || ninjutsuGauge < NINJUTSU_MAX || giantShuriken) return;

    // 巨大手裏剣の発射 (右から左へ)
    giantShuriken = {
        x: CANVAS_WIDTH, // 画面右から出現
        y: -100,
        w: 650, h: 650, // 画面いっぱい
        vx: -20, // 左方向へ
        angle: 0
    };

    sakuya.attackTimer = 30; // 投擲アニメーションを長めに再生
    ninjutsuGauge = 0;
    playSE('shuriken', 1.0);
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
        if (e.code === 'KeyV') shoot();
        if (e.code === 'KeyB') toggleMode();
        if (e.code === 'KeyN') subAction();
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.ArrowLeft = false;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.ArrowRight = false;
        if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.ArrowUp = false;
        if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.ArrowDown = false;
    });

    const btnMap = [
        { id: 'btn-left', key: 'ArrowLeft' },
        { id: 'btn-right', key: 'ArrowRight' },
        { id: 'btn-up', key: 'ArrowUp' },
        { id: 'btn-down', key: 'ArrowDown' },
        { id: 'btn-jump', action: shoot },
        { id: 'btn-attack', action: toggleMode },
        { id: 'btn-mode', action: jump },
        { id: 'btn-settings', action: typeof toggleSettings !== 'undefined' ? toggleSettings : null },
        { id: 'btn-sub', action: subAction }
    ];

    // ボタンのレクト情報をキャッシュする（レイアウトスライッシング防止）
    function updateBtnRects() {
        btnMap.forEach(b => {
            const el = document.getElementById(b.id);
            if (el) {
                b.rect = el.getBoundingClientRect();
                b.el = el;
            }
        });
    }
    
    // 初期化時とリサイズ時にキャッシュを更新
    updateBtnRects();
    window.addEventListener('resize', () => {
        setTimeout(updateBtnRects, 100); // スケール反映待ち
    });

    const handleTouch = (e) => {
        if (e.cancelable) e.preventDefault();
        
        if (isOpRunning) {
            skipOP();
            return;
        }

        let currentKeys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };
        let activeIds = new Set();

        if (e.type !== 'touchend') {
            for (let i = 0; i < e.touches.length; i++) {
                const t = e.touches[i];
                btnMap.forEach(b => {
                    if (!b.rect) return;
                    const margin = 15;
                    if (t.clientX >= b.rect.left - margin && t.clientX <= b.rect.right + margin &&
                        t.clientY >= b.rect.top - margin && t.clientY <= b.rect.bottom + margin) {
                        
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
    if (isIntro || sakuya.jumpCount < 2) {
        if (isIntro) return; // イントロ中はジャンプ不可
        if (sakuya.jumpCount === 0) playSE('jump1', 0.6);
        else playSE('jump2', 0.6);
        sakuya.vy = sakuya.jumpPower;
        sakuya.isJumping = true;
        sakuya.jumpCount++;
    }
}

function toggleMode() {
    if (isIntro) return;
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
    if (isIntro || !canShoot || mitama.isHolding || gameOver) return;

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