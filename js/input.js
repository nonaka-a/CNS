function subAction() {
    // 現在のDボタンの処理（空ですが、将来の拡張やNキーとの対応のため定義）
}

function setupControls() {
    window.addEventListener('keydown', (e) => {
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
        { id: 'btn-sub', action: subAction }
    ];

    const handleTouch = (e) => {
        if (e.cancelable) e.preventDefault();
        
        btnMap.forEach(b => {
            const el = document.getElementById(b.id);
            if (el) el.classList.remove('active');
        });
        
        let currentKeys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };

        for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i];
            btnMap.forEach(b => {
                const el = document.getElementById(b.id);
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const margin = 15;
                if (t.clientX >= rect.left - margin && t.clientX <= rect.right + margin &&
                    t.clientY >= rect.top - margin && t.clientY <= rect.bottom + margin) {
                    
                    if (b.key) currentKeys[b.key] = true;
                    if (b.action && e.type === 'touchstart') b.action();
                    el.classList.add('active');
                }
            });
        }
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