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
            Math.abs(b.groundY - boss.groundY) < 150) {
            
            boss.hp -= 10;
            explosions.push({ x: b.x + b.w/2, y: b.y + b.h/2, groundY: boss.groundY, frame: 0, timer: 0 });
            playSE('explosion');
            
            if (boss.hp <= 0) {
                boss.hp = 0;
                bossActive = false;
                bossDefeated = true;
                boss.visible = false;
                bossDefeatTimer = 0; // タイマー開始
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
                const isHit = b.x < e.x + e.w && b.x + b.w > e.x &&
                              b.y < e.y + e.h && b.y + b.h > e.y &&
                              Math.abs(b.groundY - e.groundY) < 80; 
                if (isHit) {
                    explosions.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, groundY: e.groundY, frame: 0, timer: 0 });
                    playSE('explosion');
                    for (let k = enemyLasers.length - 1; k >= 0; k--) {
                        if (enemyLasers[k].ownerId === e.id && enemyLasers[k].telegraphDuration > 0) enemyLasers.splice(k, 1);
                    }
                    enemies.splice(j, 1);
                    ninjutsuGauge = Math.min(NINJUTSU_MAX, ninjutsuGauge + 1);
                    hit = true;
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

   // 敵(ドローン)のスポーンと更新
    const spawnRate = isSecondScene ? 0.0025 : 0.005;
    const maxEnemies = isSecondScene ? 3 : 5;
    
    // エリア3でのモブ出現制限：ボス登場から10秒（600フレーム）経過後のみ許可
    let canSpawnMob = true;
    if (isThirdScene) {
        // ボスがまだ出ていない、または登場してから10秒経っていない場合はスポーンさせない
        if (!bossActive || bossSpawnTimer < (7000 + 10000)) { 
            canSpawnMob = false;
        }
    }

    if (!isHalfwayTransitioning && canSpawnMob && Math.random() < spawnRate && enemies.length < maxEnemies) {
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
                ownerId: e.id, startX: sx, startY: sy, angle: angle,
                groundY: e.groundY, duration: 25, telegraphDuration: 48 
            });
        }
    });

    // ボス「イイナ」の更新
    if (isThirdScene && !bossDefeated && !isHalfwayTransitioning) {
        bossSpawnTimer += FRAME_INTERVAL;
        if (!bossActive) {
            if (bossSpawnTimer >= 7000) {
                bossActive = true;
                boss.visible = true;
                boss.x = -500;
                boss.isArrived = false; // 出現時にリセット
            }
        } else {
            boss.animCounter++;
            
            // 到着判定：一度 50 を超えたら浮遊モードに固定
            if (!boss.isArrived) {
                boss.x += boss.vx;
                if (boss.x >= 50) {
                    boss.isArrived = true;
                }
            } else {
                // 浮遊モード：x座標の基本値を固定し、そこからのオフセットとしてサイン波を足す
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
            }
        }
        if (giantShuriken.x + giantShuriken.w < -400) giantShuriken = null; 
    }
}