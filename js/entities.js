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
        // ボスとの当たり判定
        if (bossActive && b.x < boss.x + boss.w && b.x + b.w > boss.x &&
            b.y < boss.y + boss.h && b.y + b.h > boss.y &&
            Math.abs(b.groundY - boss.groundY) < 100) {
            
            boss.hp -= 10;
            explosions.push({ x: b.x + b.w/2, y: b.y + b.h/2, groundY: boss.groundY, frame: 0, timer: 0 });
            playSE('explosion');
            
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

        if (!hit) {
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                // ドローンBの体当たり中のみ無敵
                if (e.type === 'B' && e.state === 'dash') continue;
                // 被弾後の無敵時間中はスルー
                if (e.invincibleTimer > 0) continue;

                const isHit = b.x < e.x + e.w && b.x + b.w > e.x &&
                              b.y < e.y + e.h && b.y + b.h > e.y &&
                              Math.abs(b.groundY - e.groundY) < 80; 
                if (isHit) {
                    e.hp--;
                    hit = true;
                    if (e.hp <= 0) {
                        // 撃破時
                        explosions.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, groundY: e.groundY, frame: 0, timer: 0 });
                        playSE('explosion');
                        for (let k = enemyLasers.length - 1; k >= 0; k--) {
                            if (enemyLasers[k].ownerId === e.id && enemyLasers[k].telegraphDuration > 0) enemyLasers.splice(k, 1);
                        }
                        enemies.splice(j, 1);
                        ninjutsuGauge = Math.min(NINJUTSU_MAX, ninjutsuGauge + 1);
                    } else {
                        // ダメージ生存時（点滅無敵）
                        playSE('damage', 1.0); // ダメージSE
                        e.invincibleTimer = 15;
                    }
                    break;
                }
            }
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
            const spawnRate = isSecondScene ? 0.0025 : 0.005;
            if (Math.random() < spawnRate && enemies.length < (isSecondScene ? 3 : 5)) {
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
            if (e.x < e.targetX) e.x += e.vx;
            else e.x += Math.sin(Date.now() / 300 + e.offsetSeed) * 0.2;

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
                    ownerId: e.id, startX: sx, startY: sy, angle: angle,
                    groundY: e.groundY, duration: 25, telegraphDuration: 48 
                });
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
        if (e.type === 'B' && e.state !== 'dash') return;

        if (sakuya.invincibleTimer <= 0) {
            if (e.x < sakuya.x + sakuya.w && e.x + e.w > sakuya.x &&
                e.y < sakuya.y + sakuya.h && e.y + e.h > sakuya.y &&
                Math.abs(e.groundY - sakuya.groundY) < 80) {
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
            if (Math.abs((o.x + o.w/2) - (sakuya.x + sakuya.w/2)) < 40 && Math.abs((o.y + o.h/2) - (sakuya.y + sakuya.h/2)) < 40 && Math.abs(o.groundY - sakuya.groundY) < 80) {
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

        if (hit || o.timer > 600) {
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
                if (boss.x >= 50) {
                    boss.isArrived = true;
                }
            } else {
                boss.x = 50 + Math.sin(boss.animCounter * 0.03) * 20; 
                boss.jumpOffset = -40 + Math.sin(boss.animCounter * 0.05) * 25;
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
            if (dot > 0 && dist < 50 && Math.abs(l.groundY - sakuya.groundY) < 80) {
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
            boss.hp -= 2;
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
        laserTimer: Math.random() * 100, 
        currentAnim: anim,
        currentFrame: 0,
        frameTimer: 0,
        state: 'approach',
        stateTimer: 0,
        invincibleTimer: 0
    });
}