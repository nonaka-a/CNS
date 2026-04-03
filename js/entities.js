function updateEntities() {
    // 弾の更新と衝突判定
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.angle -= 0.6;
        b.history.push({ x: b.x, y: b.y, angle: b.angle });
        if (b.history.length > 12) b.history.shift(); 
        if (b.x + b.w < -400 || b.x > CANVAS_WIDTH + 400) {
            bullets.splice(i, 1);
            continue;
        }

        let hit = false;
        
        // 先に敵（盾になるドローン等）との当たり判定
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (e.type === 'B' && e.state === 'dash') continue;
            if (e.invincibleTimer > 0) continue;

            const isHit = b.x < e.x + e.w && b.x + b.w > e.x &&
                          b.y < e.y + e.h && b.y + b.h > e.y &&
                          Math.abs(b.groundY - e.groundY) < 80; 
            if (isHit) {
                e.hp--;
                hit = true;
                if (e.hp <= 0) {
                    explosions.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, groundY: e.groundY, frame: 0, timer: 0 });
                    playSE('explosion');
                    for (let k = enemyLasers.length - 1; k >= 0; k--) {
                        if (enemyLasers[k].ownerId === e.id && enemyLasers[k].telegraphDuration > 0) enemyLasers.splice(k, 1);
                    }
                    enemies.splice(j, 1);
                    ninjutsuGauge = Math.min(NINJUTSU_MAX, ninjutsuGauge + 1);
                } else {
                    playSE('damage', 1.0); 
                    e.invincibleTimer = 15;
                }
                break;
            }
        }

                if (!hit && bossActive && boss.visible && b.x < boss.x + boss.w && b.x + b.w > boss.x &&
            b.y < boss.y + boss.h && b.y + b.h > boss.y &&
            Math.abs(b.groundY - boss.groundY) < 80) {
            
            if (boss.state === 'barrier' || boss.state === 'dash' || boss.state === 'retreat') {
                explosions.push({ x: b.x, y: b.y + b.h/2, groundY: boss.groundY, frame: 0, timer: 0 });
                playSE('explosion');
            } else {
                boss.hp -= 10;
                explosions.push({ x: b.x + b.w/2, y: b.y + b.h/2, groundY: boss.groundY, frame: 0, timer: 0 });
                playSE('explosion');
                
                if (boss.state === 'charge' && boss.telegraphDuration > 0) {
                    boss.state = 'intro';
                    boss.stateTimer = 0;
                    boss.patternIndex = 1;
                    boss.telegraphDuration = 0;
                    playSE('damage', 1.2);
                    // 陣形ドローンの退避指示
                    enemies.forEach(e => {
                        if (e.isBossShield) {
                            e.retreating = true;
                            e.vx = -12;
                        }
                    });
                } else {
                    playSE('damage', 0.8);
                }
            }
            
            if (boss.hp <= 0) {
                boss.hp = 0;
                bossActive = false;
                bossDefeated = true;
                boss.visible = false;
                bossDefeatTimer = 0; 
                for(let k=0; k<5; k++) {
                    explosions.push({ x: boss.x + Math.random()*boss.w, y: boss.y + Math.random()*boss.h, groundY: boss.groundY, frame: 0, timer: 0 });
                }
                playSE('explosion');
            }
            hit = true;
        }

        if (hit) bullets.splice(i, 1);
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
                if (ex.frame >= anim.frames.length) explosions.splice(i, 1);
            }
        }
    }

    // --- アイテムの更新 ---
    // 出現管理 (15秒に1回)
    if (!isHalfwayTransitioning && !isIntro) {
        itemSpawnTimer += FRAME_INTERVAL;
        if (itemSpawnTimer >= 15000) {
            itemSpawnTimer = 0;
            items.push({
                x: CANVAS_WIDTH + 100,
                y: 180 + Math.random() * 150, // より上（奥）に出現
                w: 60, h: 60,
                vx: -4,
                groundY: 300, // 奥行き基準を奥側へ
                offsetSeed: Math.random() * 100
            });
        }
    }

    // アイテムの移動と衝突判定
    for (let i = items.length - 1; i >= 0; i--) {
        let it = items[i];
        it.x += it.vx;
        // ふわふわ浮かせる
        it.y += Math.sin(Date.now() / 400 + it.offsetSeed) * 0.5;

        let hitItem = false;
        // 咲耶との判定
        if (sakuya.x < it.x + it.w && sakuya.x + sakuya.w > it.x &&
            sakuya.y < it.y + it.h && sakuya.y + sakuya.h > it.y) {
            hitItem = true;
        }
        // ミタマ単体との判定（持っていない場合）
        if (!hitItem && !mitama.isHolding) {
            if (mitama.x < it.x + it.w && mitama.x + mitama.w > it.x &&
                mitama.y < it.y + it.h && mitama.y + mitama.h > it.y) {
                hitItem = true;
            }
        }

        if (hitItem) {
            sakuya.hp = Math.min(100, sakuya.hp + 10); // 1から10（1マス分）に変更
            mitama.hp = Math.min(50, mitama.hp + 10);
            sakuya.healFlashTimer = 30; // 0.5秒間発光
            mitama.healFlashTimer = 30;
            playSE('sausage_get'); // 専用SEに変更
            items.splice(i, 1);
            continue;
        }

        if (it.x + it.w < -100) items.splice(i, 1);
    }

    // --- エリア1 出現テーブル定義 (エリア1終了は dist: 20000) ---
    const area1Waves = [
        // --- 前半 (0 〜 8000) ---
        { dist: 50,     types: ['A', 'A'] },             
        { dist: 1000,  types: ['A', 'A', 'A'] },        
        { dist: 3000,  types: ['A', 'A'] },             
        { dist: 3500,  types: ['A', 'A'] },             
        { dist: 5000,  types: ['A', 'A', 'A', 'A'] },   
        { dist: 6500,  types: ['A', 'A', 'A', 'A', 'A'] },
        // --- 後半 (8000 〜 18000) Bの登場 ---
        { dist: 9000,  types: ['B'] },                  
        { dist: 11000, types: ['B', 'B'] },             
        { dist: 13000, types: ['A', 'A', 'B'] },        
        { dist: 15000, types: ['A', 'A', 'B'] },
        { dist: 17000, types: ['A', 'A', 'B', 'B'] }
    ];

    // スポーン処理
    let canSpawnMob = true;
    if (isThirdScene && (!bossActive || bossSpawnTimer < (5500 + 10000))) canSpawnMob = false;
    if (isHalfwayTransitioning) canSpawnMob = false;

    if (canSpawnMob) {
        const maxEnemies = 6; // 最大6体

        if (!isSecondScene && !isThirdScene) {
            // --- エリア1: 固定ウェーブ管理 ---
            if (spawnWaveIndex < area1Waves.length) {
                const currentWave = area1Waves[spawnWaveIndex];
                if (distance >= currentWave.dist) {
                    currentWave.types.forEach(type => {
                        if (enemies.length < maxEnemies) {
                            spawnEnemy(type);
                        }
                    });
                    spawnWaveIndex++;
                }
            }
        } else {
            // --- エリア2・3: 従来の確率ベース ---
            const spawnRate = isThirdScene ? 0.002 : (isSecondScene ? 0.0025 : 0.005);
            const maxRandomEnemies = isThirdScene ? 3 : (isSecondScene ? 3 : 5);
            if (Math.random() < spawnRate && enemies.filter(e => !e.isBossShield).length < maxRandomEnemies) {
                let availableTypes = isSecondScene ? ['A', 'A', 'C'] : ['A', 'A', 'B', 'C'];
                let type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
                spawnEnemy(type);
            }
        }
    }

    // 敵の更新
    enemies.forEach((e, i) => {
        if (e.invincibleTimer > 0) e.invincibleTimer--;

        // 共通：地形やアニメーションの更新
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

        // タイプ別の行動ロジック
        if (e.type === 'A') {
            if (e.retreating) {
                e.x += e.vx; // 退避時は指定された速度で移動
                if (e.x + e.w < -200) {
                    enemies.splice(i, 1);
                    return;
                }
            } else {
                if (e.x < e.targetX) e.x += e.vx;
                else e.x += Math.sin(Date.now() / 300 + e.offsetSeed) * 0.2;

                if (!e.isBossShield) { // 盾ドローンは射撃しない
                    e.laserTimer++;
                    if (e.laserTimer > e.laserThreshold) { 
                        e.laserTimer = 0;
                        e.laserThreshold = 300 + Math.random() * 150; 
                        let target = (!mitama.isHolding && Math.random() > 0.5) ? mitama : sakuya;
                        let sx = e.x + e.w / 2 + 10;
                        let sy = e.y + e.h / 2 + 2;
                        let tx = target.x + target.w / 2;
                        let ty = target.y + target.h / 2; 
                        let angle = Math.atan2(ty - sy, tx - sx);
                        enemyLasers.push({
                            ownerId: e.id, startX: sx, startY: sy, angle: angle,
                            groundY: e.groundY, duration: 25, telegraphDuration: 66, maxTelegraph: 66
                        });
                    }
                }
            }
        } 
        else if (e.type === 'B') {
            e.stateTimer++;
            if (e.state === 'approach') {
                if (e.x < e.targetX) e.x += e.vx;
                else {
                    e.x += Math.sin(Date.now() / 300 + e.offsetSeed) * 0.2;
                    if (e.stateTimer % 60 === 0 && Math.random() > 0.5) {
                        e.targetGroundY = 280 + Math.random() * 160;
                    }
                    if (e.stateTimer > 180) { // 約3秒でチャージへ
                        e.state = 'charge';
                        e.stateTimer = 0;
                        playSE('gather_energy', 0.8); // チャージSE
                    }
                }
                if (e.targetGroundY && Math.abs(e.groundY - e.targetGroundY) > 2) {
                    e.groundY += (e.targetGroundY - e.groundY) * 0.05; 
                }
            } else if (e.state === 'charge') {
                e.x += Math.sin(Date.now() / 50 + e.offsetSeed) * 2; 
                if (e.stateTimer > 60) { // 1秒(60F)チャージ
                    e.state = 'dash';
                    e.stateTimer = 0;
                    playSE('charge_dash', 0.9); // 突進SE
                }
            } else if (e.state === 'dash') {
                e.x += 15; 
                e.groundY += 1.5; 
                if (e.x > CANVAS_WIDTH + 100) {
                    e.state = 'retreat';
                    e.stateTimer = 0;
                }
            } else if (e.state === 'retreat') {
                e.x -= 8; 
                if (e.targetGroundY && Math.abs(e.groundY - e.targetGroundY) > 1) {
                    e.groundY += (e.targetGroundY - e.groundY) * 0.1;
                }

                if (e.x <= e.targetX) {
                    e.x = e.targetX;
                    if (e.targetGroundY) e.groundY = e.targetGroundY;
                    e.state = 'approach';
                    e.stateTimer = 0;
                }
            }
        } 
        else if (e.type === 'C') {
            if (e.x < e.targetX) e.x += e.vx;
            else e.x += Math.sin(Date.now() / 300 + e.offsetSeed) * 0.2;

            e.stateTimer++;
            const myOnibiExists = onibis.some(o => o.ownerId === e.id);

            if (e.stateTimer > 200 && !myOnibiExists) { 
                e.stateTimer = 0;
                playSE('soft_flame', 0.7); // 鬼火SE
                let target = (!mitama.isHolding && Math.random() > 0.5) ? mitama : sakuya;
                let sx = e.x + e.w / 2;
                let sy = e.y + e.h / 2;
                let tx = target.x + target.w / 2;
                let ty = target.y + target.h / 2; 
                let angle = Math.atan2(ty - sy, tx - sx);
                onibis.push({
                    ownerId: e.id, 
                    x: sx - 32, y: sy - 32,
                    w: 64, h: 64, 
                    groundY: e.groundY,
                    angle: angle,
                    speed: 2,
                    timer: 0,
                    frame: 0,
                    frameTimer: 0
                });
            }
        }
    });

    // ドローン本体との接触ダメージ（咲耶・ミタマ）
    enemies.forEach(e => {
        // 突進攻撃中(Bのdash)以外は接触ダメージを発生させない
        if (!(e.type === 'B' && e.state === 'dash')) return;

        if (sakuya.invincibleTimer <= 0) {
            if (e.x < sakuya.x + sakuya.w && e.x + e.w > sakuya.x &&
                e.y < sakuya.y + sakuya.h && e.y + e.h > sakuya.y &&
                Math.abs(e.groundY - sakuya.groundY) < 50) {
                sakuya.hp -= 10;
                sakuya.invincibleTimer = 40;
                if (sakuya.hp <= 0) { sakuya.hp = 0; endGame("GAME OVER"); }
            }
        }
        if (!mitama.isHolding && mitama.invincibleTimer <= 0) {
            if (e.x < mitama.x + mitama.w && e.x + e.w > mitama.x &&
                e.y < mitama.y + mitama.h && e.y + e.h > mitama.y &&
                Math.abs(e.groundY - mitama.groundY) < 80) {
                mitama.hp -= 10;
                mitama.invincibleTimer = 40;
                if (mitama.hp <= 0) { mitama.hp = 0; endGame("MITAMA DESTROYED"); }
            }
        }
    });

    // 鬼火（ドローンCの弾）の更新
    for (let i = onibis.length - 1; i >= 0; i--) {
        const o = onibis[i];
        o.timer++;
        
        let target = sakuya; 
        let tx = target.x + target.w / 2;
        let ty = target.y + target.h / 2; 
        let targetAngle = Math.atan2(ty - (o.y + o.h/2), tx - (o.x + o.w/2));
        
        let diff = targetAngle - o.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        o.angle += diff * 0.02; 
        
        o.x += Math.cos(o.angle) * o.speed;
        o.y += Math.sin(o.angle) * o.speed;
        
        if (onibiConfig) {
            o.frameTimer += FRAME_INTERVAL;
            const anim = onibiConfig.data.idle;
            if (o.frameTimer >= 1000 / anim.fps) {
                o.frameTimer = 0;
                o.frame = (o.frame + 1) % anim.frames.length;
            }
        }

        let hit = false;
        if (sakuya.invincibleTimer <= 0) {
            if (Math.abs((o.x + o.w/2) - (sakuya.x + sakuya.w/2)) < 40 && Math.abs((o.y + o.h/2) - (sakuya.y + sakuya.h/2)) < 40 && Math.abs(o.groundY - sakuya.groundY) < 50) {
                sakuya.hp -= 10;
                sakuya.invincibleTimer = 40; 
                if (sakuya.hp <= 0) { sakuya.hp = 0; endGame("GAME OVER"); }
                hit = true;
            }
        }
        if (!hit && !mitama.isHolding && mitama.invincibleTimer <= 0) {
            if (Math.abs((o.x + o.w/2) - (mitama.x + mitama.w/2)) < 30 && Math.abs((o.y + o.h/2) - (mitama.y + mitama.h/2)) < 30 && Math.abs(o.groundY - mitama.groundY) < 80) {
                mitama.hp -= 10;
                mitama.invincibleTimer = 40;
                if (mitama.hp <= 0) { mitama.hp = 0; endGame("MITAMA DESTROYED"); }
                hit = true;
            }
        }

        // 8秒(480F)経過、またはヒットで消滅
        if (hit || o.timer > 480) {
            onibis.splice(i, 1);
        }
    }

    // ボス「イイナ」の更新
    if (isThirdScene && !bossDefeated && !isHalfwayTransitioning) {
        bossSpawnTimer += FRAME_INTERVAL;
        if (!bossActive) {
            if (bossSpawnTimer >= 5500) { 
                bossActive = true;
                boss.visible = true;
                boss.x = -500;
                boss.isArrived = false;
            }
        } else {
            boss.animCounter++;
            
            if (!boss.isArrived) {
                boss.x += boss.vx;
                if (boss.x >= boss.originalX) {
                    boss.isArrived = true;
                    boss.state = 'intro';
                    boss.stateTimer = 0;
                }
            } else {
                boss.stateTimer++;
                let hoverY = -40 + Math.sin(boss.animCounter * 0.05) * 25;
                let hoverX = boss.originalX + Math.sin(boss.animCounter * 0.03) * 20;

                if (boss.state === 'intro') {
                    if (boss.stateTimer > 120) {
                        boss.stateTimer = 0;
                        if (boss.patternIndex === 1) boss.state = 'barrier';
                        else boss.state = 'charge';
                    }
                    boss.x = hoverX;
                    boss.jumpOffset = hoverY;
                }
                else if (boss.state === 'barrier') {
                    if (boss.stateTimer === 180) {
                        boss.state = 'dash';
                        boss.dashTargetX = sakuya.x + 50; 
                        playSE('charge_dash', 1.0); 
                    }
                    if (boss.state === 'barrier') {
                        boss.x = hoverX;
                        boss.jumpOffset = hoverY;
                    }
                    if (boss.stateTimer >= 480) {
                        boss.state = 'intro';
                        boss.stateTimer = 0;
                        boss.patternIndex = 2; // 次はビーム
                    }
                }
                else if (boss.state === 'dash') {
                    boss.x += 18; 
                    boss.jumpOffset = hoverY; 
                    if (boss.x > boss.dashTargetX + 100 || boss.x > CANVAS_WIDTH) {
                        boss.state = 'retreat';
                    }
                }
                else if (boss.state === 'retreat') {
                    boss.x -= 12;
                    boss.jumpOffset = hoverY;
                    if (boss.x <= boss.originalX) {
                        boss.x = boss.originalX;
                        boss.state = 'barrier'; 
                    }
                }
                else if (boss.state === 'charge') {
                    if (boss.stateTimer === 1) {
                        spawnBossDrones();
                        boss.laserDuration = 0;
                        boss.telegraphDuration = -1; // 陣形到着まで待機
                    }
                    boss.x = hoverX;
                    boss.jumpOffset = hoverY;

                    // 盾ドローンがすべて配置についたかチェック
                    if (boss.telegraphDuration === -1) {
                        const shieldDrones = enemies.filter(e => e.isBossShield);
                        // ドローンがいないか、全てのドローンが概ね配置についたら、または一定時間経過で開始
                        const allArrived = shieldDrones.every(e => Math.abs(e.x - e.targetX) < 10);
                        if (allArrived || boss.stateTimer > 300) { 
                            boss.telegraphDuration = 240; // 4秒チャージ開始（短縮してテンポ向上）
                            playSE('gather_energy', 1.0);
                        }
                    }

                    if (boss.telegraphDuration > 0) {
                        boss.telegraphDuration--;
                    } else if (boss.telegraphDuration === 0 && boss.laserDuration === 0) {
                        boss.laserDuration = 60; 
                        playSE('laser', 1.0); 
                    }

                    if (boss.laserDuration > 0) {
                        boss.laserDuration--;
                        if (boss.laserDuration === 0) {
                            // 陣形ドローンの退避指示
                            enemies.forEach(e => {
                                if (e.isBossShield) {
                                    e.retreating = true;
                                    e.vx = -12; // 左へ素早く
                                }
                            });
                            boss.state = 'intro';
                            boss.stateTimer = 0;
                            boss.patternIndex = 1; // 次はバリア
                        }
                    }
                }
                
                // ボス本体およびバリアとの接触判定（咲耶）
                if (sakuya.invincibleTimer <= 0) {
                    // 突進攻撃(dash)中以外は接触ダメージを発生させない
                    if (boss.state === 'dash') {
                        let bx = boss.x + boss.w / 2;
                        let by = boss.y + boss.h / 2;
                        let sx = sakuya.x + sakuya.w / 2;
                        let sy = sakuya.y + sakuya.h / 2;
                        let dist = Math.hypot(bx - sx, by - sy);
                        
                        let hitRadius = (boss.state === 'barrier') ? 140 : 80;
                        if (dist < hitRadius && Math.abs(boss.groundY - sakuya.groundY) < 100) {
                            sakuya.hp -= 10; // ライフ1個分
                            sakuya.invincibleTimer = 40; 
                            if (sakuya.hp <= 0) { sakuya.hp = 0; endGame("GAME OVER"); }
                        }
                    }
                }

                // 巨大レーザーの当たり判定（咲耶）
                if (boss.laserDuration > 0) {
                    if (sakuya.invincibleTimer <= 0 && sakuya.jumpOffset > -120) { 
                        sakuya.hp -= 20; // ライフ2個分
                        sakuya.invincibleTimer = 40;
                        if (sakuya.hp <= 0) { sakuya.hp = 0; endGame("GAME OVER"); }
                    }
                }
            }
            boss.y = boss.groundY - boss.h + boss.jumpOffset;
        }
    }

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
            let px = sakuya.x + sakuya.w / 2; let py = sakuya.y + sakuya.h / 2;
            let dist = Math.abs((px - l.startX) * Math.sin(l.angle) - (py - l.startY) * Math.cos(l.angle));
            let dot = (px - l.startX) * Math.cos(l.angle) + (py - l.startY) * Math.sin(l.angle);
            if (dot > 0 && dist < 50 && Math.abs(l.groundY - sakuya.groundY) < 50) {
                sakuya.hp -= 10;
                sakuya.invincibleTimer = 40; 
                if (sakuya.hp <= 0) { sakuya.hp = 0; endGame("GAME OVER"); }
            }
        }

        if (!mitama.isHolding && mitama.invincibleTimer <= 0) {
            let px = mitama.x + mitama.w / 2; let py = mitama.y + mitama.h / 2;
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
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (giantShuriken.x + giantShuriken.w > e.x && giantShuriken.x < e.x + e.w) {
                explosions.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, groundY: e.groundY, frame: 0, timer: 0 });
                playSE('explosion');
                enemies.splice(j, 1);
            }
        }
        if (bossActive && giantShuriken.x < boss.x + boss.w && giantShuriken.x + giantShuriken.w > boss.x) {
            if (boss.state === 'barrier' || boss.state === 'dash' || boss.state === 'retreat') {
                // Giant shuriken deals no damage during barrier, but passes through
            } else {
                boss.hp -= 2;
                if (boss.state === 'charge' && boss.telegraphDuration > 0) {
                    boss.state = 'intro';
                    boss.stateTimer = 0;
                    boss.patternIndex = 1;
                    boss.telegraphDuration = 0;
                    playSE('damage', 1.2);
                    // 陣形ドローンの退避指示
                    enemies.forEach(e => {
                        if (e.isBossShield) {
                            e.retreating = true;
                            e.vx = -12;
                        }
                    });
                } else {
                    playSE('damage', 0.8);
                }
            }
            if (boss.hp <= 0) {
                 boss.hp = 0; bossActive = false; bossDefeated = true; boss.visible = false;
                 bossDefeatTimer = 0;
            }
        }
        if (giantShuriken.x + giantShuriken.w < -400) giantShuriken = null; 
    }
}

function spawnEnemy(type) {
    let hp = type === 'B' ? 3 : (type === 'C' ? 2 : 1);
    let anim = type === 'B' ? 'idleB' : (type === 'C' ? 'idleC' : 'idle');
    
    enemies.push({
        id: enemyIdCounter++, 
        type: type,
        hp: hp,
        maxHp: hp,
        x: isSecondScene ? -400 : -80,
        w: 80, h: 80,
        groundY: 300 + Math.random() * 120, 
        targetGroundY: null,
        jumpOffset: -80 - Math.random() * 80,
        targetX: 20 + Math.random() * 200, 
        vx: 0.8 + Math.random() * 0.7, 
        offsetSeed: Math.random() * 100,
        laserTimer: Math.random() * 200, 
        laserThreshold: 280 + Math.random() * 180, 
        currentAnim: anim,
        currentFrame: 0,
        frameTimer: 0,
        state: 'approach',
        stateTimer: 0,
        invincibleTimer: 0,
        targetX: isThirdScene ? (300 + Math.random() * 200) : (20 + Math.random() * 200) 
    });
}

function spawnBossDrones() {
    // 2列（奥3体、手前3体）の均等配置 - もっと右（咲耶側）へ
    let xs = [400, 400, 400, 300, 300, 300];
    let ys = [260, 340, 420, 260, 340, 420];
    for(let i=0; i<6; i++) {
        enemies.push({
            id: enemyIdCounter++, 
            type: 'A',
            hp: 1,
            maxHp: 1,
            x: -200, 
            w: 80, h: 80,
            groundY: ys[i], 
            targetGroundY: null,
            jumpOffset: -80,
            targetX: xs[i], 
            vx: 12,  
            offsetSeed: i * 30,
            laserTimer: -9999, 
            laserThreshold: 99999, 
            currentAnim: 'idle',
            currentFrame: 0,
            frameTimer: 0,
            state: 'approach',
            stateTimer: 0,
            invincibleTimer: 0,
            isBossShield: true,
            retreating: false
        });
    }
}