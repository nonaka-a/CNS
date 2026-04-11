function update() {
    if (gameOver || isPaused) return;

    // --- タイマーのカウントダウン（最優先で確実に実行） ---
    if (sakuya.healFlashTimer > 0) {
        sakuya.healFlashTimer--;
        if (sakuya.healFlashTimer <= 0) sakuya.healFlashTimer = 0;
    }
    if (mitama.healFlashTimer > 0) {
        mitama.healFlashTimer--;
        if (mitama.healFlashTimer <= 0) mitama.healFlashTimer = 0;
    }

    if (isOpRunning) {
        if (opConfig) {
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
            updateEventAudio(opConfig, opTime, isOpRunning);
            const opComp = opConfig.assets.find(a => a.id === "comp_1");
            if (opComp && opTime >= opComp.duration) endOP();
        } else {
            endOP();
        }
        return;
    }

    if (isEndingRunning) {
        if (endConfig) {
            endTime += FRAME_INTERVAL / 1000;
            updateEventAudio(endConfig, endTime, isEndingRunning);
            const endComp = endConfig.assets.find(a => a.id === "comp_1");
            if (endComp && endTime >= endComp.duration) endEndEvent();
        } else {
            endEndEvent();
        }
        return;
    }

    if (isWhiteFading) {
        if (whiteFadeAlpha < 1.0) {
            whiteFadeAlpha += 0.012; // 約1.4秒で真っ白に
        } else {
            whiteFadeAlpha = 1.0;
            whiteHoldTimer += FRAME_INTERVAL;
            if (whiteHoldTimer >= 1000) { // 1秒間維持
                whiteFadeAlpha = 1.0;
                isWhiteFading = false;
                whiteHoldTimer = 0;
                startEndEvent();
            }
        }
    }

    updateWorld(); // world.js
    
    if (isIntro) {
        sakuya.vx = 18; sakuya.x += sakuya.vx;
        if (sakuya.x >= INTRO_TARGET_X) {
            sakuya.x = INTRO_TARGET_X; isIntro = false; sakuya.vx = 0;
        }
    } else {
        if (isHalfwayTransitioning) {
            // エリア移行アニメーション
            if (halfwayTransitionTimer < 60) {
                if (halfwayTransitionTimer === 1) {
                    sakuya.vy = -26;
                    sakuya.jumpOffset = -1;
                    playSE('jump1');
                }
                // エリア2→3ならより大胆に、エリア1→2もさらに速度アップ
                sakuya.vx = (goalThresholdReached && isSecondScene) ? 22 : 24;
            } else if (halfwayTransitionTimer >= 120) {
                // 暗転明けは目標地点(中央付近)に向けて一定速度で移動(放物線へ)
                if (halfwayTransitionTimer === 120) {
                    sakuya.vx = isThirdScene ? 18.2 : 15;
                }
            } else {
                sakuya.vx = 0;
            }
        } else {
            if (keys.ArrowLeft) sakuya.vx = -PLAYER_SPEED;
            else if (keys.ArrowRight) sakuya.vx = PLAYER_SPEED;
            else if (sakuya.jumpOffset === 0) sakuya.vx = 0;

            // 長押し射撃の対応
            if (keys.Shoot) shoot();
        }
        sakuya.x += sakuya.vx;

        // トランジション中、またはイントロ中はクランプを無効化
        if (!isHalfwayTransitioning && !isIntro) {
            // ズームアウト時の視界拡張に合わせて移動範囲を正しく広げる（元の正しい計算式）
            const zoomOffset = (CANVAS_WIDTH / currentZoom - CANVAS_WIDTH) / 2;
            const minX = -zoomOffset;
            const maxX = CANVAS_WIDTH + zoomOffset - sakuya.w;
            sakuya.x = Math.max(minX, Math.min(sakuya.x, maxX));
        }

        let vy_depth = 0;
        if (!isHalfwayTransitioning) {
            if (keys.ArrowUp) vy_depth = -PLAYER_SPEED * 0.7;
            else if (keys.ArrowDown) vy_depth = PLAYER_SPEED * 0.7;
        }
        sakuya.groundY += vy_depth;
    }
    sakuya.groundY = Math.max(280, Math.min(sakuya.groundY, 440));

    sakuya.isOnPlat = checkOnPlat(sakuya);
    if (sakuya.invincibleTimer > 0) sakuya.isOnPlat = true; 
    
    sakuya.vy += GRAVITY;
    sakuya.jumpOffset += sakuya.vy;
    if (sakuya.jumpOffset > 0 && sakuya.vy >= 0) {
        if (sakuya.isOnPlat) {
            sakuya.jumpOffset = 0; sakuya.vy = 0; sakuya.isJumping = false; sakuya.jumpCount = 0;
        } else {
            if (isSecondScene && !isHalfwayTransitioning && sakuya.jumpOffset > 500) {
                sakuya.hp -= 10;
                if (sakuya.hp <= 0) { sakuya.hp = 0; endGame("落下"); } 
                else {
                    sakuya.jumpOffset = 0; sakuya.vy = 0; sakuya.invincibleTimer = 120; 
                    sakuya.x = 400; sakuya.groundY = 360; 
                }
            }
        }
    }
    sakuya.y = sakuya.groundY - sakuya.h + sakuya.jumpOffset;

    let nextAnim = mitama.isHolding ? 'run_m' : 'idle';
    if (sakuya.vx > 0) nextAnim = mitama.isHolding ? 'run_m' : 'run';
    else if (sakuya.vx < 0) nextAnim = mitama.isHolding ? 'back_m_run' : 'back_run';
    if (sakuya.jumpOffset < 0) {
        if (sakuya.vy < 0) nextAnim = mitama.isHolding ? 'jump_m_up' : 'jump_up';
        else nextAnim = mitama.isHolding ? 'jump_m_Down' : 'jump_Down';
    }
    if (sakuya.attackTimer > 0) {
        sakuya.attackTimer--; nextAnim = 'throw_shuriken';
    }

    if (sakuya.currentAnim !== nextAnim) {
        sakuya.currentAnim = nextAnim; sakuya.currentFrame = 0; sakuya.frameTimer = 0;
    }
    if (sakuyaConfig) {
        const anim = sakuyaConfig.data[sakuya.currentAnim];
        sakuya.frameTimer += FRAME_INTERVAL;
        if (sakuya.frameTimer >= 1000 / anim.fps) {
            sakuya.frameTimer -= 1000 / anim.fps;
            sakuya.currentFrame = (sakuya.currentFrame + 1) % anim.frames.length;
        }
    }
    
    if (mitama.groundY !== undefined) mitama.isOnPlat = checkOnPlat(mitama);
    if (mitama.isHolding) {
        mitama.x = sakuya.x + 10; mitama.y = sakuya.y + 30; mitama.jumpOffset = 0; mitama.vy = 0;
        mitamaAlertTimer = 0; // 持っている間はリセット
    } else {
        mitama.x -= 0.4;
        if (mitama.jumpOffset !== 0 || mitama.vy !== 0) {
            mitama.vy += GRAVITY * 1.5; mitama.jumpOffset += mitama.vy;
            if (mitama.jumpOffset >= 0 && mitama.vy > 0) { mitama.jumpOffset = 0; mitama.vy = 0; }
        }
        const mScale = 1.0 + (mitama.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
        mitama.y = mitama.groundY - (mitama.h + 65 - Math.sin(Date.now() / 400) * 15) * mScale + mitama.jumpOffset;
        const lostThreshold = isSecondScene ? -200 : -mitama.w;
        const currentX = mitama.x + mitama.w;
        const alertRange = 200; 
        
        if (currentX < lostThreshold + alertRange) {
             mitamaAlertTimer++;
             // サイレン (約3秒 = 180フレームおきに再生)
             if (mitamaAlertTimer % 180 === 1) { 
                 playSE('siren', 1.0);
             }
        } else {
             mitamaAlertTimer = 0;
        }

        if (currentX < lostThreshold) endGame("脱落"); 
    }

    if (mitamaConfig) {
        const anim = mitamaConfig.data[mitama.currentAnim];
        mitama.frameTimer += FRAME_INTERVAL;
        if (mitama.frameTimer >= 1000 / anim.fps) {
            mitama.frameTimer -= 1000 / anim.fps;
            mitama.currentFrame = (mitama.currentFrame + 1) % anim.frames.length;
        }
    }

    if (sakuya.invincibleTimer > 0) sakuya.invincibleTimer--;
    if (mitama.invincibleTimer > 0) mitama.invincibleTimer--;

    if (sakuya.invincibleTimer === undefined) sakuya.invincibleTimer = 0;
    if (mitama.invincibleTimer === undefined) mitama.invincibleTimer = 0;

    if (sakuya.hp <= 0) { sakuya.hp = 0; endGame("GAME OVER"); }
    if (mitama.hp <= 0) { mitama.hp = 0; endGame("MITAMA DESTROYED"); }

    updateEntities(); // entities.js

    let displayDistance = distance;
    const bossBattleTriggerDistance = goalDistance * 0.95 + 1;
    
    if (!window.uiCache) window.uiCache = {};

    if (isEndlessMode) {
        if (typeof updateEndlessHUD === 'function') updateEndlessHUD();
        if (typeof checkEndlessLoop === 'function') checkEndlessLoop();
    } else {
        // エリア3かつボス未撃破の時のみ、UI上のプログレスを95%付近で停止させる
        if (isThirdScene && !bossDefeated && distance > bossBattleTriggerDistance) {
            displayDistance = bossBattleTriggerDistance;
        }

        const progress = Math.min((displayDistance / goalDistance) * 100, 100);
        
        if (window.uiCache.progress !== progress) {
            const progressBar = document.getElementById('progress-bar');
            if (progressBar) progressBar.style.width = progress + '%';
            window.uiCache.progress = progress;
        }
    }
    
    if (window.uiCache.mitamaHolding !== mitama.isHolding) {
        const shurikenBtn = document.getElementById('btn-jump');
        if (shurikenBtn) {
            if (mitama.isHolding) shurikenBtn.classList.add('disabled');
            else shurikenBtn.classList.remove('disabled');
        }
        window.uiCache.mitamaHolding = mitama.isHolding;
    }

    if (window.uiCache.ninjutsuGauge !== ninjutsuGauge) {
        const ninjutsuBar = document.getElementById('ninjutsu-bar');
        if (ninjutsuBar) {
            ninjutsuBar.style.width = (ninjutsuGauge / NINJUTSU_MAX) * 100 + '%';
            if (ninjutsuGauge >= NINJUTSU_MAX) ninjutsuBar.classList.add('full');
            else ninjutsuBar.classList.remove('full');
        }
        window.uiCache.ninjutsuGauge = ninjutsuGauge;
    }
    
    const isNinjutsuMax = (ninjutsuGauge >= NINJUTSU_MAX);
    const hasGiantShuriken = !!giantShuriken;
    if (window.uiCache.isNinjutsuMax !== isNinjutsuMax || window.uiCache.hasGiantShuriken !== hasGiantShuriken) {
        const ninBtn = document.getElementById('btn-sub');
        if (ninBtn) {
            if (isNinjutsuMax && !hasGiantShuriken) {
                if (!ninBtn.classList.contains('shinobi-ready')) {
                    ninBtn.classList.remove('disabled'); 
                    ninBtn.classList.add('shinobi-ready');
                }
                if (!ninjutsuFullTriggered) {
                    ninjutsuFullTriggered = true; 
                    ninBtn.classList.add('shinobi-flash'); 
                    playSE('flash');
                    setTimeout(() => { ninBtn.classList.remove('shinobi-flash'); }, 600);
                }
            } else {
                if (!ninBtn.classList.contains('disabled')) {
                    ninBtn.classList.add('disabled'); 
                    ninBtn.classList.remove('shinobi-ready'); 
                    ninBtn.classList.remove('shinobi-flash');
                }
                if (!isNinjutsuMax) ninjutsuFullTriggered = false;
            }
        }
        window.uiCache.isNinjutsuMax = isNinjutsuMax;
        window.uiCache.hasGiantShuriken = hasGiantShuriken;
    }

    // ボスHPゲージの更新
    const showBossHp = bossActive && boss.visible && bossSpawnTimer >= 10000;
    const hpPercent = showBossHp ? (boss.hp / boss.maxHp) * 100 : 0;
    
    if (window.uiCache.showBossHp !== showBossHp || (showBossHp && window.uiCache.bossHpPercent !== hpPercent)) {
        const bossHpContainer = document.getElementById('boss-hp-container');
        const bossHpBar = document.getElementById('boss-hp-bar');
        if (bossHpContainer && bossHpBar) {
            if (showBossHp) {
                if (window.uiCache.showBossHp !== showBossHp) bossHpContainer.style.display = 'flex';
                if (window.uiCache.bossHpPercent !== hpPercent) bossHpBar.style.width = hpPercent + '%';
            } else {
                if (window.uiCache.showBossHp !== showBossHp) bossHpContainer.style.display = 'none';
            }
        }
        window.uiCache.showBossHp = showBossHp;
        window.uiCache.bossHpPercent = hpPercent;
    }

    if (displayDistance >= goalDistance && !gameOver && !isEndlessMode) {
        if (!isWhiteFading && !isEndingRunning) {
            isWhiteFading = true;
            whiteFadeAlpha = 0;
        }
    }
}