function update() {
    if (gameOver || isPaused) return;

    // カメラズームの滑らかな更新 (エリア2の時だけ0.75倍)
    let targetZoom = (isSecondScene && !isHalfwayTransitioning) ? 0.75 : 1.0;
    currentZoom += (targetZoom - currentZoom) * 0.05;

    // オープニングイベントの更新
    if (isOpRunning) {
        if (opConfig) {
            // UIの非表示制御 (OP開始時のみ実行)
            if (opTime === 0) {
                document.getElementById('progress-container').style.display = 'none';
                document.getElementById('ninjutsu-container').style.display = 'none';
                document.getElementById('debug-skip-btn').style.display = 'none';
                document.getElementById('debug-skip-btn-3').style.display = 'none';
                document.querySelector('.hud').style.display = 'none';
                document.getElementById('control-panel').style.display = 'none';
                document.getElementById('skip-op-btn').style.display = 'block';
            }

            opTime += FRAME_INTERVAL / 1000;
            
            // オーディオの同期処理（早期リターンの前に実行）
            updateOPAudio();

            // OP終了判定
            const opComp = opConfig.assets.find(a => a.id === "comp_1");
            if (opComp && opTime >= opComp.duration) {
                endOP();
            }
        } else {
            endOP();
        }
        return;
    }

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
        if (isHalfwayTransitioning) {
            if (sakuya.jumpOffset === 0) sakuya.vx = 0;
        } else {
            if (keys.ArrowLeft) sakuya.vx = -PLAYER_SPEED;
            else if (keys.ArrowRight) sakuya.vx = PLAYER_SPEED;
            else if (sakuya.jumpOffset === 0) sakuya.vx = 0; // 地上にいる時だけ、キーが押されていなければ停止
        }
        
        sakuya.x += sakuya.vx;
        
        // エリア2のズームアウトに対応した移動制限の計算
        const zoomOffset = (CANVAS_WIDTH / currentZoom - CANVAS_WIDTH) / 2;
        const minX = -zoomOffset;
        const maxX = CANVAS_WIDTH + zoomOffset - sakuya.w;
        sakuya.x = Math.max(minX, Math.min(sakuya.x, maxX));

        // 奥行き移動
        let vy_depth = 0;
        if (!isHalfwayTransitioning) {
            if (keys.ArrowUp) vy_depth = -PLAYER_SPEED * 0.7;
            else if (keys.ArrowDown) vy_depth = PLAYER_SPEED * 0.7;
        }
        sakuya.groundY += vy_depth;
    }
    sakuya.groundY = Math.max(280, Math.min(sakuya.groundY, 440));

    // 足場判定 (Area 2専用)
    function checkOnPlat(obj) {
        if (!isSecondScene) return true;
        return platforms.some(p => {
             const footX = obj.x + obj.w / 2;
             const footY = obj.groundY;
             if (footY < p.y_back || footY > p.y_front) return false;
             const ratio = (footY - p.y_back) / (p.y_front - p.y_back);
             const currentShift = (1 - ratio) * p.shift;
             return footX >= p.x + currentShift && footX <= p.x + p.w + currentShift;
        });
    }
    
    sakuya.isOnPlat = checkOnPlat(sakuya);
    if (sakuya.invincibleTimer > 0) sakuya.isOnPlat = true; // 点滅中は落下しない
    
    // ジャンプ（jumpOffsetにのみ影響）
    sakuya.vy += GRAVITY;
    sakuya.jumpOffset += sakuya.vy;
    if (sakuya.jumpOffset > 0) {
        if (sakuya.isOnPlat) {
            sakuya.jumpOffset = 0;
            sakuya.vy = 0;
            sakuya.isJumping = false;
            sakuya.jumpCount = 0;
        } else {
            // 落下中：一定以上落ちたらペナルティを受けて復帰
            if (isSecondScene && sakuya.jumpOffset > 500) {
                sakuya.hp -= 10;
                if (sakuya.hp <= 0) {
                    sakuya.hp = 0;
                    endGame("落下...");
                } else {
                    // ワープ復帰
                    sakuya.jumpOffset = 0; // 画面内に即時出現（空中浮遊状態）
                    sakuya.vy = 0;
                    sakuya.invincibleTimer = 120; // 無敵・点滅時間（少し長めに設定）
                    
                    // 復帰ポイント：画面中央付近、奥から手前の中間位置
                    sakuya.x = 400;
                    sakuya.groundY = 360; // PERSPECTIVE_BASE_Y
                }
            }
        }
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
            nextAnim = mitama.isHolding ? 'jump_m_up' : 'jump_up';
        } else {
            nextAnim = mitama.isHolding ? 'jump_m_Down' : 'jump_Down';
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
    
    // ミタマの更新
    if (mitama.groundY !== undefined) {
        mitama.isOnPlat = checkOnPlat(mitama);
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
        
        // ミタマのロスト判定
        const lostThreshold = isSecondScene ? -200 : -mitama.w;
        if (mitama.x + mitama.w < lostThreshold) endGame("MITAMA LOST...");
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
        if (b.x + b.w < -400 || b.x > CANVAS_WIDTH + 400) { // 弾の消去判定も広げる
            bullets.splice(i, 1);
            continue;
        }

        let hit = false;

        // ボスとの当たり判定
        if (bossActive && b.x < boss.x + boss.w && b.x + b.w > boss.x &&
            b.y < boss.y + boss.h && b.y + b.h > boss.y &&
            Math.abs(b.groundY - boss.groundY) < 150) {
            
            boss.hp -= 10;
            explosions.push({
                x: b.x + b.w/2, y: b.y + b.h/2, groundY: boss.groundY,
                frame: 0, timer: 0
            });
            playSE('explosion');
            
            if (boss.hp <= 0) {
                boss.hp = 0;
                bossActive = false;
                bossDefeated = true;
                boss.visible = false;
                // 撃破時に派手な爆発をいくつか出す
                for(let k=0; k<5; k++) {
                    explosions.push({
                        x: boss.x + Math.random()*boss.w, 
                        y: boss.y + Math.random()*boss.h, 
                        groundY: boss.groundY,
                        frame: 0, timer: 0
                    });
                }
            }
            hit = true;
        }

        if (!hit) {
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                const isHit = b.x < e.x + e.w && b.x + b.w > e.x &&
                              b.y < e.y + e.h && b.y + b.h > e.y &&
                              Math.abs(b.groundY - e.groundY) < 80; 
                if (isHit) {
                    explosions.push({
                        x: e.x + e.w / 2, y: e.y + e.h / 2, groundY: e.groundY,
                        frame: 0, timer: 0
                    });
                    playSE('explosion');
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

    // 第二エリア：ビルの足場生成
    if (isSecondScene && !isHalfwayTransitioning) {
        if (platforms.length === 0 || (platforms[platforms.length - 1].x + platforms[platforms.length - 1].w < CANVAS_WIDTH + 400 - 580)) {
            platforms.push({
                x: CANVAS_WIDTH + 400,
                w: 2000, 
                h: 400,
                y_back: 280,
                y_front: 440,
                shift: 80
            });
        }
    }

    // 足場の更新（移動）
    for (let i = platforms.length - 1; i >= 0; i--) {
        const p = platforms[i];
        p.x -= isSecondScene ? 10 : 5; // エリア2は2倍速
        if (p.x + p.w + 80 < -400) {
            platforms.splice(i, 1);
        }
    }

    // 敵(ドローン)のスポーンと更新
    const spawnRate = isSecondScene ? 0.0025 : 0.005;
    const maxEnemies = isSecondScene ? 3 : 5;
    if (!isHalfwayTransitioning && Math.random() < spawnRate && enemies.length < maxEnemies) {
        enemies.push({
            id: enemyIdCounter++, 
            x: isSecondScene ? -400 : -80,
            w: 80, h: 80,
            groundY: 300 + Math.random() * 120, 
            jumpOffset: -80 - Math.random() * 80,
            targetX: 20 + Math.random() * 200, 
            vx: 0.8 + Math.random() * 0.7, 
            offsetSeed: Math.random() * 100,
            laserTimer: Math.random() * 100, 
            currentAnim: 'idle',
            currentFrame: 0,
            frameTimer: 0
        });
    }
    enemies.forEach((e, i) => {
        if (e.x < e.targetX) e.x += e.vx;
        else e.x += Math.sin(Date.now() / 300 + e.offsetSeed) * 0.2;

        e.isOnPlat = checkOnPlat(e);
        e.jumpOffset += Math.sin(Date.now() / 400 + e.offsetSeed) * 0.4;
        e.y = e.groundY - e.h + e.jumpOffset;

        if (droneConfig) {
            const anim = droneConfig.data[e.currentAnim];
            e.frameTimer += FRAME_INTERVAL;
            const frameDuration = 1000 / anim.fps;
            if (e.frameTimer >= frameDuration) {
                e.frameTimer -= frameDuration;
                e.currentFrame = (e.currentFrame + 1) % anim.frames.length;
            }
        }

        e.laserTimer++;
        if (e.laserTimer > 450) { 
            e.laserTimer = 0;
            let target = (!mitama.isHolding && Math.random() > 0.5) ? mitama : sakuya;
            let sx = e.x + e.w / 2 + 10;
            let sy = e.y + e.h / 2 + 2;
            let tx = target.x + target.w / 2;
            let ty = target.y + target.h / 2; 
            let angle = Math.atan2(ty - sy, tx - sx);
            enemyLasers.push({
                ownerId: e.id, 
                startX: sx, startY: sy,
                angle: angle,
                groundY: e.groundY,
                duration: 25,
                telegraphDuration: 48 
            });
        }
    });

    // ボス「イイナ」の更新
    if (isThirdScene && !bossDefeated && !isHalfwayTransitioning) {
        if (!bossActive) {
            bossSpawnTimer += FRAME_INTERVAL;
            if (bossSpawnTimer >= 10000) { // 10秒
                bossActive = true;
                boss.visible = true;
                boss.x = -boss.w - 100;
            }
        } else {
            // ボスの移動ロジック（左から登場して画面左側に留まる）
            if (boss.x < 50) boss.x += boss.vx;
            else {
                boss.x = 50 + Math.sin(Date.now() / 1000) * 20;
                boss.jumpOffset = Math.sin(Date.now() / 500) * 15;
            }
            boss.y = boss.groundY - boss.h + boss.jumpOffset;
        }
    }

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
            continue; 
        }

        l.duration--;
        if (l.duration <= 0) {
            enemyLasers.splice(i, 1);
            continue;
        }

        if (sakuya.invincibleTimer <= 0) {
            let px = sakuya.x + sakuya.w / 2;
            let py = sakuya.y + sakuya.h / 2;
            let dist = Math.abs((px - l.startX) * Math.sin(l.angle) - (py - l.startY) * Math.cos(l.angle));
            let dot = (px - l.startX) * Math.cos(l.angle) + (py - l.startY) * Math.sin(l.angle);
            
            if (dot > 0 && dist < 50 && Math.abs(l.groundY - sakuya.groundY) < 80) {
                sakuya.hp -= 10;
                sakuya.invincibleTimer = 40; 
                if (sakuya.hp <= 0) { sakuya.hp = 0; endGame("GAME OVER"); }
            }
        }

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
        
        // 敵となぎ倒す
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (giantShuriken.x + giantShuriken.w > e.x && giantShuriken.x < e.x + e.w) {
                explosions.push({
                    x: e.x + e.w / 2, y: e.y + e.h / 2, groundY: e.groundY,
                    frame: 0, timer: 0
                });
                playSE('explosion');
                enemies.splice(j, 1);
            }
        }
        // ボスへのダメージ判定 (1フレームごとに判定)
        if (bossActive && giantShuriken.x < boss.x + boss.w && giantShuriken.x + giantShuriken.w > boss.x) {
            boss.hp -= 2; // 巨大手裏剣は多段ヒット
            if (boss.hp <= 0) {
                 boss.hp = 0;
                 bossActive = false;
                 bossDefeated = true;
                 boss.visible = false;
            }
        }
        if (giantShuriken.x + giantShuriken.w < -400) giantShuriken = null; 
    }

    if (!isIntro && !isHalfwayTransitioning) {
        // 背景パンを維持するために、進捗が止まっている間も distance は増え続ける。
        // ただし、本来の進捗（ゲージ等）の判定には「ボス戦中か」を考慮する。
        distance += 5; 
        
        // 50%：エリア1 → エリア2
        if (distance >= goalDistance * 0.5 && !halfwayReached) {
            halfwayReached = true;
            isHalfwayTransitioning = true;
            halfwayTransitionTimer = 0;
            enemies = [];
            enemyLasers = [];
            bullets = [];
            explosions = [];
            const progressMarker = document.getElementById('progress-halfway-marker');
            if (progressMarker) progressMarker.classList.add('reached');
        }

        // 95%：エリア2 → エリア3
        if (distance >= goalDistance * 0.95 && !goalThresholdReached) {
            goalThresholdReached = true;
            isHalfwayTransitioning = true;
            halfwayTransitionTimer = 0;
            enemies = [];
            enemyLasers = [];
            bullets = [];
            explosions = [];
            const goalMarker = document.getElementById('progress-goal-marker');
            if (goalMarker) goalMarker.classList.add('reached');
        }
    }
    
    // トランジション進行
    if (isHalfwayTransitioning) {
        halfwayTransitionTimer++;
        if (halfwayTransitionTimer === 120) {
            if (goalThresholdReached) {
                isSecondScene = false;
                isThirdScene = true;
                platforms = [];
                sakuya.x = 400;
                sakuya.groundY = GROUND_Y_POS;
                sakuya.jumpOffset = 0;
                sakuya.vy = 0;
                sakuya.isOnPlat = true;
                if (typeof fadeOutBGM === 'function') {
                    fadeOutBGM(bgm, 1500);
                } else {
                    bgm.pause();
                }
                if (isSoundOn) {
                    bgm2.volume = 0.4;
                    bgm2.currentTime = 0;
                    bgm2.play().catch(e => console.error("BGM2 playback failed:", e));
                }
            } else if (halfwayReached) {
                isSecondScene = true;
                platforms = [{
                    x: -500, 
                    w: 2000,
                    h: 400,
                    y_back: 280,
                    y_front: 440,
                    shift: 80
                }];
                sakuya.x = 400;
                sakuya.groundY = 360;
                sakuya.jumpOffset = 0;
                sakuya.vy = 0;
                sakuya.isOnPlat = true;
            }
            if (mitama.isHolding) {
                mitama.x = sakuya.x + 10;
                mitama.y = sakuya.y + 30;
                mitama.groundY = sakuya.groundY;
            }
        }
        if (halfwayTransitionTimer > 180) { 
            isHalfwayTransitioning = false;
        }
    }

    // 進捗ゲージに表示する数値の計算
    // ボス戦中（登場待ち含む）は 95% 付近で値を固定する
    let displayDistance = distance;
    const bossBattleTriggerDistance = goalDistance * 0.95 + 1; // エリア3突入直後の距離
    if (isThirdScene && !bossDefeated && distance > bossBattleTriggerDistance) {
        displayDistance = bossBattleTriggerDistance;
    } else if (isThirdScene && bossDefeated) {
        // ボス撃破後は、撃破した瞬間の distance と displayDistance の差分を引いて 95% から再開させる必要があるが、
        // 簡易的に「distance が進んでいる分」をそのまま反映（ゲージが一気に進む形）になるのを防ぐ場合は補正が必要。
        // ここでは単純に撃破後は distance をそのまま表示。
        displayDistance = distance;
    }

    const progress = Math.min((displayDistance / goalDistance) * 100, 100);
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.style.width = progress + '%';
    
    const shurikenBtn = document.getElementById('btn-jump');
    if (shurikenBtn) {
        if (mitama.isHolding) shurikenBtn.classList.add('disabled');
        else shurikenBtn.classList.remove('disabled');
    }

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
            if (!ninjutsuFullTriggered) {
                ninjutsuFullTriggered = true;
                ninBtn.classList.add('shinobi-flash');
                playSE('flash');
                setTimeout(() => {
                    ninBtn.classList.remove('shinobi-flash');
                }, 600);
            }
        } else {
            ninBtn.classList.add('disabled');
            ninBtn.classList.remove('shinobi-ready');
            ninBtn.classList.remove('shinobi-flash');
            if (ninjutsuGauge < NINJUTSU_MAX) ninjutsuFullTriggered = false;
        }
    }

    if (displayDistance >= goalDistance) endGame("GOAL!");
}

function updateOPAudio() {
    if (!opConfig || !isOpRunning) {
        stopAllOPAudio();
        return;
    }
    const comp = opConfig.assets.find(a => a.id === "comp_1");
    if (!comp) return;

    comp.layers.forEach(layer => {
        if (layer.type !== 'audio') return;
        const asset = (function findAsset(id, list) {
             for (let a of list) {
                 if (a.id === id) return a;
                 if (a.type === 'folder' && a.children) {
                     let found = findAsset(id, a.children);
                     if (found) return found;
                 }
             }
             return null;
        })(layer.assetId, opConfig.assets);
        if (!asset || !asset.audioBuffer) return;
        const offset = opTime - layer.startTime;
        const isWithinRange = (opTime >= layer.inPoint && opTime < layer.outPoint);
        const isWithinBuffer = (offset >= 0 && offset < asset.audioBuffer.duration);
        if (isWithinRange && isWithinBuffer && isSoundOn) {
            if (!opAudioSources[layer.id]) {
                const source = audioCtx.createBufferSource();
                source.buffer = asset.audioBuffer;
                const gainNode = audioCtx.createGain();
                source.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                const volDb = (layer.tracks && layer.tracks.volume) ? getOpTrackValue(layer.tracks.volume, opTime, 0) : 0;
                gainNode.gain.value = Math.pow(10, volDb / 20);
                source.start(0, Math.max(0, offset));
                opAudioSources[layer.id] = { source, gain: gainNode };
                source.onended = () => {
                    if (opAudioSources[layer.id] && opAudioSources[layer.id].source === source) delete opAudioSources[layer.id];
                };
            } else {
                const volDb = (layer.tracks && layer.tracks.volume) ? getOpTrackValue(layer.tracks.volume, opTime, 0) : 0;
                opAudioSources[layer.id].gain.gain.setTargetAtTime(Math.pow(10, volDb / 20), audioCtx.currentTime, 0.05);
            }
        } else {
            if (opAudioSources[layer.id]) {
                try { opAudioSources[layer.id].source.stop(); } catch(e){}
                delete opAudioSources[layer.id];
            }
        }
    });
}

function stopAllOPAudio() {
    Object.keys(opAudioSources).forEach(id => {
        try { opAudioSources[id].source.stop(); } catch(e){}
        delete opAudioSources[id];
    });
}