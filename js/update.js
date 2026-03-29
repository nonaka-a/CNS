function update() {
    if (gameOver || isPaused) return;

    // オープニングイベントの更新
    if (isOpRunning) {
        if (opConfig) {
            // UIの非表示制御 (OP開始時のみ実行)
            if (opTime === 0) {
                document.getElementById('progress-container').style.display = 'none';
                document.getElementById('ninjutsu-container').style.display = 'none';
                document.getElementById('debug-skip-btn').style.display = 'none';
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
        sakuya.x = Math.max(0, Math.min(sakuya.x, CANVAS_WIDTH - sakuya.w));

        // 奥行き移動
        let vy_depth = 0;
        if (!isHalfwayTransitioning) {
            if (keys.ArrowUp) vy_depth = -PLAYER_SPEED * 0.7;
            else if (keys.ArrowDown) vy_depth = PLAYER_SPEED * 0.7;
        }
        sakuya.groundY += vy_depth;
    }
    sakuya.groundY = Math.max(280, Math.min(sakuya.groundY, 440));

    // 足場判定 (Area 2)
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
            // 落下中：特に何もしない（offsetが正の値で増え続ける）
            if (isSecondScene && sakuya.jumpOffset > 500) {
                endGame("落下...");
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

    // 第二エリア：ビルの足場生成
    if (isSecondScene && !isHalfwayTransitioning) {
        // 一定距離（隙間）を空けて足場を生成
        if (platforms.length === 0 || (platforms[platforms.length - 1].x + platforms[platforms.length - 1].w < CANVAS_WIDTH - 600)) {
            platforms.push({
                x: CANVAS_WIDTH,
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
        if (p.x + p.w + 80 < -100) {
            platforms.splice(i, 1);
        }
    }

    // 敵(ドローン)のスポーンと更新
    const spawnRate = isSecondScene ? 0.0025 : 0.005;
    const maxEnemies = isSecondScene ? 3 : 5;
    if (!isHalfwayTransitioning && Math.random() < spawnRate && enemies.length < maxEnemies) {
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

        e.isOnPlat = checkOnPlat(e);
        
        // 移動：少し上下に揺れる
        e.jumpOffset += Math.sin(Date.now() / 400 + e.offsetSeed) * 0.4;
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

    if (!isIntro && !isHalfwayTransitioning) {
        distance += 5; // 進捗速度は一定（エリア2でも長く遊べるように）
        
        // 中間地点チェック
        if (distance >= goalDistance / 2 && !halfwayReached) {
            halfwayReached = true;
            isHalfwayTransitioning = true;
            halfwayTransitionTimer = 0;
            
            // 敵や弾を消去して仕切り直す
            enemies = [];
            enemyLasers = [];
            bullets = [];
            explosions = [];
            
            const progressMarker = document.getElementById('progress-halfway-marker');
            if (progressMarker) progressMarker.classList.add('reached');
        }
    }
    
    // トランジション進行
    if (isHalfwayTransitioning) {
        halfwayTransitionTimer++;
        if (halfwayTransitionTimer > 180) { // 3秒間 (60fps * 3s = 180)
            isHalfwayTransitioning = false;
            isSecondScene = true;
            // エリア2開始時の最初の足場（プレイヤーの足元に配置）
            platforms = [{
                x: 0,
                w: 2500, // 最初は長めにしておく
                h: 400,
                y_back: 250,
                y_front: 450,
                shift: 0
            }];
        }
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
                
                // ボリューム設定 (dB -> Gain)
                const volDb = (layer.tracks && layer.tracks.volume) ? getOpTrackValue(layer.tracks.volume, opTime, 0) : 0;
                gainNode.gain.value = Math.pow(10, volDb / 20);

                source.start(0, Math.max(0, offset));
                opAudioSources[layer.id] = { source, gain: gainNode };
                source.onended = () => {
                    if (opAudioSources[layer.id] && opAudioSources[layer.id].source === source) delete opAudioSources[layer.id];
                };
            } else {
                // 再生中のボリューム更新
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