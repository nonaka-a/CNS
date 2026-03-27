function update() {
    if (gameOver || isPaused) return;

    if (isIntro) {
        // イントロ：画面外から中央（INTRO_TARGET_X）まで走ってくる
        sakuya.vx = 18;
        sakuya.x += sakuya.vx;
        if (sakuya.x >= INTRO_TARGET_X) {
            sakuya.x = INTRO_TARGET_X;
            isIntro = false;
            sakuya.vx = 0;
        }
    } else {
        // 通常の操作
        if (keys.ArrowLeft) sakuya.vx = -PLAYER_SPEED;
        else if (keys.ArrowRight) sakuya.vx = PLAYER_SPEED;
        else if (sakuya.jumpOffset === 0) sakuya.vx = 0; // 地上にいる時だけ、キーが押されていなければ停止
        
        sakuya.x += sakuya.vx;
        sakuya.x = Math.max(0, Math.min(sakuya.x, CANVAS_WIDTH - sakuya.w));

        // 奥行き移動
        let vy_depth = 0;
        if (keys.ArrowUp) vy_depth = -PLAYER_SPEED * 0.7;
        else if (keys.ArrowDown) vy_depth = PLAYER_SPEED * 0.7;
        sakuya.groundY += vy_depth;
    }
    sakuya.groundY = Math.max(300, Math.min(sakuya.groundY, 420));

    // ジャンプ（jumpOffsetにのみ影響）
    sakuya.vy += GRAVITY;
    sakuya.jumpOffset += sakuya.vy;
    if (sakuya.jumpOffset > 0) {
        sakuya.jumpOffset = 0;
        sakuya.vy = 0;
        sakuya.isJumping = false;
        sakuya.jumpCount = 0;
    }

    // 他の要素との互換性のために y を更新 (下位180pxがgroundYになる)
    sakuya.y = sakuya.groundY - sakuya.h + sakuya.jumpOffset;

    // Animation update
    let nextAnim = mitama.isHolding ? 'run_m' : 'idle';
    if (sakuya.vx > 0) {
        nextAnim = mitama.isHolding ? 'run_m' : 'run';
    } else if (sakuya.vx < 0) {
        nextAnim = mitama.isHolding ? 'back_m_run' : 'back_run';
    }

    if (sakuya.jumpOffset < 0) {
        if (sakuya.vy < 0) {
            nextAnim = mitama.isHolding ? 'jump_m_up' : 'junp_up';
        } else {
            nextAnim = mitama.isHolding ? 'jump_m_Down' : 'junp_Down';
        }
    }

    if (sakuya.attackTimer > 0) {
        sakuya.attackTimer--;
        nextAnim = 'throw_shuriken';
    }

    if (sakuya.currentAnim !== nextAnim) {
        sakuya.currentAnim = nextAnim;
        sakuya.currentFrame = 0;
        sakuya.frameTimer = 0;
    }

    if (sakuyaConfig) {
        const anim = sakuyaConfig.data[sakuya.currentAnim];
        sakuya.frameTimer += FRAME_INTERVAL;
        const frameDuration = 1000 / anim.fps;
        if (sakuya.frameTimer >= frameDuration) {
            sakuya.frameTimer -= frameDuration;
            sakuya.currentFrame = (sakuya.currentFrame + 1) % anim.frames.length;
        }
    }

    if (mitama.isHolding) {
        mitama.x = sakuya.x + 10;
        mitama.y = sakuya.y + 30;
        mitama.jumpOffset = 0; // ホールド中はオフセットなし
        mitama.vy = 0;
    } else {
        mitama.x -= 0.4;
        
        // リリース時の落下物理
        if (mitama.jumpOffset !== 0 || mitama.vy !== 0) {
            mitama.vy += GRAVITY * 1.5; // 少しゆっくり降りるように調整
            mitama.jumpOffset += mitama.vy;
            if (mitama.jumpOffset >= 0 && mitama.vy > 0) {
                mitama.jumpOffset = 0;
                mitama.vy = 0;
                // 着地の跳ね返りとかを加えても良いが、今回は指示通り早めに着地させる
            }
        }

        // 描画と判定を同期：groundY から浮遊高度(-65)とスケール、さらに自由落下のオフセットを考慮して計算
        const mScale = 1.0 + (mitama.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
        mitama.y = mitama.groundY - (mitama.h + 65 - Math.sin(Date.now() / 400) * 15) * mScale + mitama.jumpOffset;
        
        if (mitama.x + mitama.w < 0) endGame("MITAMA LOST...");
    }

    // Mitama animation update
    if (mitamaConfig) {
        const anim = mitamaConfig.data[mitama.currentAnim];
        mitama.frameTimer += FRAME_INTERVAL;
        const frameDuration = 1000 / anim.fps;
        if (mitama.frameTimer >= frameDuration) {
            mitama.frameTimer -= frameDuration;
            mitama.currentFrame = (mitama.currentFrame + 1) % anim.frames.length;
        }
    }

    // 弾の更新と衝突判定
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.angle -= 0.6;
        b.history.push({ x: b.x, y: b.y, angle: b.angle });
        if (b.history.length > 12) b.history.shift(); 
        if (b.x + b.w < 0 || b.x > CANVAS_WIDTH) {
            bullets.splice(i, 1);
            continue;
        }

        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            // 2Dでの重なりと奥行き(groundY)の差異をかなり甘めにチェック
            const isHit = b.x < e.x + e.w && b.x + b.w > e.x &&
                          b.y < e.y + e.h && b.y + b.h > e.y &&
                          Math.abs(b.groundY - e.groundY) < 80; 
            if (isHit) {
                // 爆発を生成
                explosions.push({
                    x: e.x + e.w / 2, y: e.y + e.h / 2, groundY: e.groundY,
                    frame: 0, timer: 0
                });
                
                // 爆発音
                playSE('explosion');

                // ドローンの予告レーザーをキャンセル
                for (let k = enemyLasers.length - 1; k >= 0; k--) {
                    if (enemyLasers[k].ownerId === e.id && enemyLasers[k].telegraphDuration > 0) {
                        enemyLasers.splice(k, 1);
                    }
                }

                enemies.splice(j, 1);
                ninjutsuGauge = Math.min(NINJUTSU_MAX, ninjutsuGauge + 1);
                hit = true;
                break;
            }
        }
        if (hit) {
            bullets.splice(i, 1);
        }
    }

    // 爆発の更新
    if (explosionConfig) {
        for (let i = explosions.length - 1; i >= 0; i--) {
            const ex = explosions[i];
            const anim = explosionConfig.data.idle;
            ex.timer += FRAME_INTERVAL;
            const duration = 1000 / anim.fps;
            if (ex.timer >= duration) {
                ex.timer -= duration;
                ex.frame++;
                if (ex.frame >= anim.frames.length) {
                    explosions.splice(i, 1);
                }
            }
        }
    }

    // 敵(ドローン)のスポーンと更新
    if (Math.random() < 0.005 && enemies.length < 5) {
        enemies.push({
            id: enemyIdCounter++, // 一意識別用ID
            x: -80, w: 80, h: 80,
            groundY: 300 + Math.random() * 120, // 奥行き範囲を中間位置(300-420)へ再調整
            jumpOffset: -80 - Math.random() * 80,
            targetX: 20 + Math.random() * 200, 
            vx: 0.8 + Math.random() * 0.7, 
            offsetSeed: Math.random() * 100,
            laserTimer: Math.random() * 100, // レーザー発射の周期タイマー
            currentAnim: 'idle',
            currentFrame: 0,
            frameTimer: 0
        });
    }
    enemies.forEach((e, i) => {
        if (e.x < e.targetX) e.x += e.vx;
        else e.x += Math.sin(Date.now() / 300 + e.offsetSeed) * 0.2;

        e.jumpOffset += Math.sin(Date.now() / 200 + e.offsetSeed) * 0.4;
        e.y = e.groundY - e.h + e.jumpOffset;

        // ドローンのアニメーション更新
        if (droneConfig) {
            const anim = droneConfig.data[e.currentAnim];
            e.frameTimer += FRAME_INTERVAL;
            const frameDuration = 1000 / anim.fps;
            if (e.frameTimer >= frameDuration) {
                e.frameTimer -= frameDuration;
                e.currentFrame = (e.currentFrame + 1) % anim.frames.length;
            }
        }

        // レーザー発射ロジック (頻度を約1/3に変更)
        e.laserTimer++;
        if (e.laserTimer > 450) { // 約7.5秒ごとに発射
            e.laserTimer = 0;
            // ミタマがリリースされている時は半々の確率で狙いを定る
            let target = (!mitama.isHolding && Math.random() > 0.5) ? mitama : sakuya;
            let sx = e.x + e.w / 2 + 10; // 右側に維持
            let sy = e.y + e.h / 2 + 2;  // 高さを少し下げ（中心付近）
            let tx = target.x + target.w / 2;
            let ty = target.y + target.h / 2; 
            let angle = Math.atan2(ty - sy, tx - sx);
            enemyLasers.push({
                ownerId: e.id, // 発射元ID
                startX: sx, startY: sy,
                angle: angle,
                groundY: e.groundY,
                duration: 25, // 画面に残る太いビームの持続時間
                telegraphDuration: 48 // 約0.8秒(48f)の予告線タイマー。点滅しながら追尾せず固定
            });
        }
    });

    // プレイヤーの無敵時間タイマー初期化・更新
    if (sakuya.invincibleTimer === undefined) sakuya.invincibleTimer = 0;
    if (mitama.invincibleTimer === undefined) mitama.invincibleTimer = 0;
    if (sakuya.invincibleTimer > 0) sakuya.invincibleTimer--;
    if (mitama.invincibleTimer > 0) mitama.invincibleTimer--;

    // レーザーの更新とプレイヤーへの当たり判定
    for (let i = enemyLasers.length - 1; i >= 0; i--) {
        const l = enemyLasers[i];
        if (l.telegraphDuration > 0) {
            l.telegraphDuration--;
            if (l.telegraphDuration === 0) playSE('laser');
            continue; // 予告線表示中は当たり判定なし
        }

        l.duration--;
        if (l.duration <= 0) {
            enemyLasers.splice(i, 1);
            continue;
        }

        // サクヤ当たり判定
        if (sakuya.invincibleTimer <= 0) {
            let px = sakuya.x + sakuya.w / 2;
            let py = sakuya.y + sakuya.h / 2;
            // 距離 = |(px-sx)*sinA - (py-sy)*cosA|
            let dist = Math.abs((px - l.startX) * Math.sin(l.angle) - (py - l.startY) * Math.cos(l.angle));
            // 内積 = 前方にいるか
            let dot = (px - l.startX) * Math.cos(l.angle) + (py - l.startY) * Math.sin(l.angle);
            
            if (dot > 0 && dist < 50 && Math.abs(l.groundY - sakuya.groundY) < 80) {
                sakuya.hp -= 10;
                sakuya.invincibleTimer = 40; // 無敵・点滅
                if (sakuya.hp <= 0) { sakuya.hp = 0; endGame("GAME OVER"); }
            }
        }

        // ミタマ当たり判定
        if (!mitama.isHolding && mitama.invincibleTimer <= 0) {
            let px = mitama.x + mitama.w / 2;
            let py = mitama.y + mitama.h / 2;
            let dist = Math.abs((px - l.startX) * Math.sin(l.angle) - (py - l.startY) * Math.cos(l.angle));
            let dot = (px - l.startX) * Math.cos(l.angle) + (py - l.startY) * Math.sin(l.angle);
            
            if (dot > 0 && dist < 40 && Math.abs(l.groundY - mitama.groundY) < 80) {
                mitama.hp -= 10;
                mitama.invincibleTimer = 40;
                if (mitama.hp <= 0) { mitama.hp = 0; endGame("MITAMA DESTROYED"); }
            }
        }
    }

    // 巨大手裏剣の更新
    if (giantShuriken) {
        giantShuriken.x += giantShuriken.vx;
        giantShuriken.angle += 0.5;
        
        // 画面内の敵をすべてなぎ倒す
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            // 巨大なので判定は甘め（x軸が重なっていればOKぐらいの勢い）
            if (giantShuriken.x + giantShuriken.w > e.x && giantShuriken.x < e.x + e.w) {
                explosions.push({
                    x: e.x + e.w / 2, y: e.y + e.h / 2, groundY: e.groundY,
                    frame: 0, timer: 0
                });
                playSE('explosion');
                enemies.splice(j, 1);
            }
        }
        if (giantShuriken.x + giantShuriken.w < 0) giantShuriken = null;
    }

    if (!isIntro) {
        distance += 5;
    }
    const progress = Math.min((distance / goalDistance) * 100, 100);
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.style.width = progress + '%';
    
    // UIの更新: ホールド中は手裏剣ボタンをグレーアウト
    const shurikenBtn = document.getElementById('btn-jump');
    if (shurikenBtn) {
        if (mitama.isHolding) {
            shurikenBtn.classList.add('disabled');
        } else {
            shurikenBtn.classList.remove('disabled');
        }
    }

    // 忍術ゲージUI更新
    const ninjutsuBar = document.getElementById('ninjutsu-bar');
    if (ninjutsuBar) {
        const percent = (ninjutsuGauge / NINJUTSU_MAX) * 100;
        ninjutsuBar.style.width = percent + '%';
        if (ninjutsuGauge >= NINJUTSU_MAX) ninjutsuBar.classList.add('full');
        else ninjutsuBar.classList.remove('full');
    }
    const ninBtn = document.getElementById('btn-sub');
    if (ninBtn) {
        if (ninjutsuGauge >= NINJUTSU_MAX && !giantShuriken) {
            ninBtn.classList.remove('disabled');
            ninBtn.classList.add('shinobi-ready');
            
            // 初めて満タンになった瞬間にピカーンと光らせる
            if (!ninjutsuFullTriggered) {
                ninjutsuFullTriggered = true;
                ninBtn.classList.add('shinobi-flash');
                playSE('flash'); // 満タンSE再生
                setTimeout(() => {
                    ninBtn.classList.remove('shinobi-flash');
                }, 600); // アニメーション時間分待って外す
            }
        } else {
            ninBtn.classList.add('disabled');
            ninBtn.classList.remove('shinobi-ready');
            ninBtn.classList.remove('shinobi-flash'); // 強制リセット
            if (ninjutsuGauge < NINJUTSU_MAX) {
                ninjutsuFullTriggered = false;
            }
        }
    }

    if (distance >= goalDistance) endGame("GOAL!");
}