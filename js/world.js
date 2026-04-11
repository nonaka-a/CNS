function checkOnPlat(obj) {
    if (!isSecondScene) return true;
    
    // 足場より下にいる（落ちている最中）場合は乗れないようにする
    // jumpOffset が正の値（groundY より下）なら、足場には乗れない
    if (obj.jumpOffset > 10) return false; 

    return platforms.some(p => {
         const footX = obj.x + obj.w / 2;
         const footY = obj.groundY;
         if (footY < p.y_back || footY > p.y_front) return false;
         const ratio = (footY - p.y_back) / (p.y_front - p.y_back);
         const currentShift = (1 - ratio) * p.shift;
         return footX >= p.x + currentShift && footX <= p.x + p.w + currentShift;
    });
}
function updateWorld() {
    // 背景のスクロールはゲーム実行中なら常に回す（導入やトランジションも含む）
    if (!isPaused) {
        bgDistance += 5;
    }

    let targetZoom = (isSecondScene && !isHalfwayTransitioning) ? 0.75 : 1.0;
    currentZoom += (targetZoom - currentZoom) * 0.05;

    if (isSecondScene && !isHalfwayTransitioning) {
        if (platforms.length === 0 || (platforms[platforms.length - 1].x + platforms[platforms.length - 1].w < CANVAS_WIDTH + 400 - 580)) {
            platforms.push({
                x: CANVAS_WIDTH + 400, w: 2000, h: 400,
                y_back: 280, y_front: 440, shift: 80
            });
        }
    }

    for (let i = platforms.length - 1; i >= 0; i--) {
        const p = platforms[i];
        p.x -= isSecondScene ? 10 : 5;
        if (p.x + p.w + 80 < -400) platforms.splice(i, 1);
    }

    // トランジション（暗転）中やイントロ中でなければ進行させる
    if (!isIntro && !isHalfwayTransitioning) {
        let speed = 5;

        // エリア3かつボス撃破演出中の制御（進捗距離 distance のみ制限）
        if (isThirdScene) {
            if (bossDefeated) {
                bossDefeatTimer += FRAME_INTERVAL;
                if (bossDefeatTimer < 5000) {
                    speed = 0;
                } else {
                    speed = 5;
                }
            } else if (distance >= goalDistance * 0.95) {
                speed = 0;
            }
        }

        distance += speed;
        
        // 50%：エリア1 → エリア2への切り替えチェック
        // distance が丁度あるいは超過したタイミングで、かつまだ切り替わっていなければ実行
        if (distance >= goalDistance * 0.5 && !halfwayReached) {
            halfwayReached = true;
            isHalfwayTransitioning = true;
            halfwayTransitionTimer = 0;
            spawnWaveIndex = 0; // Waveインデックスをリセット
            sakuya.invincibleTimer = 240; // 移行開始から完了までをカバーする無敵時間を付与
            enemies = []; enemyLasers = []; bullets = []; explosions = []; onibis = [];
            const progressMarker = document.getElementById('progress-halfway-marker');
            if (progressMarker) progressMarker.classList.add('reached');
        }

        // 95%：エリア2 → エリア3への切り替えチェック
        if (distance >= goalDistance * 0.95 && !goalThresholdReached) {
            goalThresholdReached = true;
            isHalfwayTransitioning = true;
            halfwayTransitionTimer = 0;
            sakuya.invincibleTimer = 240; // 移行開始から完了までをカバー
            enemies = []; enemyLasers = []; bullets = []; explosions = []; onibis = [];
            const goalMarker = document.getElementById('progress-goal-marker');
            if (goalMarker) goalMarker.classList.add('reached');
        }
    }
    
    if (isHalfwayTransitioning) {
        halfwayTransitionTimer++;
        if (halfwayTransitionTimer === 120) {
            if (goalThresholdReached) {
                // エリア3からエリア1へのエンドレスループチェック
                if (isEndlessMode && isThirdScene) {
                    if (typeof loopToEndlessStart === 'function') loopToEndlessStart();
                    // loopToEndlessStart内部で isThirdScene = false になるため、エリア1の初期化が行われる
                    sakuya.x = -150; sakuya.groundY = GROUND_Y_POS;
                    sakuya.jumpOffset = 0; sakuya.vx = 0; sakuya.vy = 0;
                    isIntro = true; // エリア1開始時のイントロ演出（右へのスライド）を再利用
                } else {
                    isSecondScene = false; isThirdScene = true; platforms = [];
                    // エリア3開始：左上から大きく飛び込んでくる
                    sakuya.x = -400; sakuya.groundY = GROUND_Y_POS;
                    sakuya.jumpOffset = -1000; sakuya.vy = 4; sakuya.isOnPlat = false;
                    playSE('jump1');
                    // BGM切り替え (bgm -> bgm2)
                    if (bgmFadeInterval) {
                        clearInterval(bgmFadeInterval);
                        bgmFadeInterval = null;
                    }
                    bgm.pause();
                    bgm.currentTime = 0;
                    
                    if (isSoundOn) {
                        bgm2.volume = 0.4;
                        bgm2.currentTime = 0;
                        const playPromise = bgm2.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(e => {
                                console.error("BGM2 playback failed, retrying on user interaction:", e);
                                // 失敗した場合、次のユーザー操作（タップ等）で再試行する保険
                                const retryPlay = () => {
                                    if (isThirdScene && isSoundOn && bgm2.paused) {
                                        bgm2.play();
                                    }
                                    window.removeEventListener('touchstart', retryPlay);
                                    window.removeEventListener('mousedown', retryPlay);
                                };
                                window.addEventListener('touchstart', retryPlay);
                                window.addEventListener('mousedown', retryPlay);
                            });
                        }
                    }
                }
            } else if (halfwayReached) {
                isSecondScene = true;
                platforms = [{ x: -500, w: 2000, h: 400, y_back: 280, y_front: 440, shift: 80 }];
                // エリア2開始：さらに遠く（左下奥）から勢いよく飛び出す
                sakuya.x = -900; sakuya.groundY = 360;
                sakuya.jumpOffset = 300; sakuya.vy = -32; sakuya.isOnPlat = false;
                playSE('jump1');
            }
            if (mitama.isHolding) {
                mitama.x = sakuya.x + 10; mitama.y = sakuya.y + 30; mitama.groundY = sakuya.groundY;
            }
        }
        if (halfwayTransitionTimer > 180) isHalfwayTransitioning = false;
    }
}