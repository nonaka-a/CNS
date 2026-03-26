function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // カメラのPAN計算（滑らかに追従）
    // 基準となるY座標(中央)を360とし、そこからの差分でカメラを上下に動かす
    sakuya.cameraOffsetY = sakuya.cameraOffsetY || 0;
    let targetPanY = (360 - sakuya.groundY) * 0.4; // 奥行きに合わせてPAN具合を調整
    sakuya.cameraOffsetY += (targetPanY - sakuya.cameraOffsetY) * 0.1;

    ctx.save();
    ctx.translate(0, sakuya.cameraOffsetY);

    // 一枚絵の背景をループ描画 (PANに合わせて少し高さを広げて描画、速度を2倍に)
    if (bgImg.complete) {
        let loopX = -((distance * 2.0) % CANVAS_WIDTH);
        ctx.drawImage(bgImg, loopX, -50, CANVAS_WIDTH, CANVAS_HEIGHT + 100);
        ctx.drawImage(bgImg, loopX + CANVAS_WIDTH, -50, CANVAS_WIDTH, CANVAS_HEIGHT + 100);
    }

    // キャラクターとミタマの落ち影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    
    // サクヤ影
    const sakuyaScale = 1.0 + (sakuya.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
    ctx.beginPath();
    ctx.ellipse(sakuya.x + sakuya.w / 2, sakuya.groundY, sakuya.w * 0.35 * sakuyaScale, 12 * sakuyaScale, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 敵影
    enemies.forEach(e => {
        const eScale = 1.0 + (e.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.groundY, e.w * 0.35 * eScale, 6 * eScale, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    // ミタマ影 (リリース時のみ)
    if (!mitama.isHolding && mitama.groundY) {
        const mitamaScale = 1.0 + (mitama.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
        ctx.beginPath();
        ctx.ellipse(mitama.x + mitama.w / 2, mitama.groundY, mitama.w * 0.4 * mitamaScale, 6 * mitamaScale, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = '#00f2fe';
    bullets.forEach(b => {
        const bScale = 1.0 + (b.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
        if (syurikenImg.complete) {
            // 残像（軌跡）の描画 - 過去の座標を白っぽく発光させて、より長く表示
            b.history.forEach((h, idx) => {
                const trailAlpha = (idx / b.history.length) * 0.6; // 少し濃くして白を強調
                const trailScaleRatio = 0.3 + (idx / b.history.length) * 0.7; // 以前より長く（小さく）尾を引くように
                ctx.save();
                // ctx.globalCompositeOperation = 'screen'; // 重いので無効化
                ctx.globalAlpha = trailAlpha;
                ctx.translate(h.x + b.w / 2, h.y + b.h / 2);
                ctx.scale(bScale * trailScaleRatio, bScale * trailScaleRatio);
                ctx.rotate(h.angle);
                ctx.drawImage(syurikenImg, -b.w / 2, -b.h / 2, b.w, b.h);
                ctx.restore();
            });

            // 本体
            ctx.save();
            ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
            ctx.scale(bScale, bScale);
            ctx.rotate(b.angle);
            ctx.drawImage(syurikenImg, -b.w / 2, -b.h / 2, b.w, b.h);
            ctx.restore();
        } else {
            // Fallback to blue square if image not loaded
            ctx.fillRect(b.x, b.y, b.w * bScale, b.h * bScale);
        }
    });



    // 奥行き(groundY)による描画順のソート（Zソート）
    const renderQueue = [];
    enemies.forEach(e => renderQueue.push({ type: 'enemy', depth: e.groundY, obj: e }));
    // ミタマ（ホールド中はサクヤのアニメーションに含まれるため、単体での描画はスキップ）
    if (!mitama.isHolding && mitama.groundY) {
        renderQueue.push({ type: 'mitama', depth: mitama.groundY });
    }
    renderQueue.push({ type: 'sakuya', depth: sakuya.groundY });

    // 爆発
    explosions.forEach(ex => renderQueue.push({ type: 'explosion', depth: ex.groundY, obj: ex }));

    // 奥(画面上部)から手前へソート
    renderQueue.sort((a, b) => a.depth - b.depth);

    renderQueue.forEach(item => {
        if (item.type === 'enemy') {
            const e = item.obj;
            const eScale = 1.0 + (e.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
            ctx.save();
            ctx.translate(e.x + e.w / 2, e.groundY); // ピボットを足元の中央に配置
            ctx.scale(eScale, eScale);
            if (droneImg.complete) {
                ctx.drawImage(droneImg, -e.w / 2, -e.h + e.jumpOffset, e.w, e.h);
            } else {
                ctx.fillStyle = '#ff4444';
                ctx.beginPath();
                ctx.arc(0, -e.h / 2 + e.jumpOffset, e.w / 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        } else if (item.type === 'mitama') {
            const mScale = 1.0 + (item.depth - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
            if (mitama.img.complete) {
                if (!mitama.invincibleTimer || Math.floor(mitama.invincibleTimer / 4) % 2 === 0) {
                    ctx.save();
                    ctx.translate(mitama.x + mitama.w / 2, (!mitama.isHolding ? mitama.groundY : sakuya.groundY));
                    ctx.scale(mScale, mScale);
                    // ホールド中か否かで表示位置を微調整
                    if (!mitama.isHolding) {
                        // 地面から65pxほど浮かせ、揺れを±15pxに強調
                        ctx.drawImage(mitama.img, -mitama.w / 2, -mitama.h - 65 + Math.sin(Date.now() / 400) * 15, mitama.w, mitama.h);
                    } else {
                        // ホールド位置（サクヤの肩付近）
                        ctx.drawImage(mitama.img, -mitama.w / 2, -mitama.h - 100, mitama.w, mitama.h);
                    }
                    ctx.restore();
                }
            }
        } else if (item.type === 'explosion') {
            const ex = item.obj;
            const eScale = 1.0 + (ex.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
            if (explosionConfig && explosionImg.complete) {
                const anim = explosionConfig.data.idle;
                const frame = anim.frames[ex.frame];
                const size = explosionConfig.tileSize;
                ctx.save();
                ctx.translate(ex.x, ex.y);
                ctx.scale(eScale, eScale);
                ctx.drawImage(
                    explosionImg,
                    frame.x, frame.y, frame.w, frame.h,
                    -size / 2, -size / 2, size, size
                );
                ctx.restore();
            }
        } else if (item.type === 'sakuya') {
            const sScale = 1.0 + (sakuya.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
            ctx.save();
            ctx.translate(sakuya.x + sakuya.w / 2, sakuya.groundY);
            ctx.scale(sScale, sScale);
            if (sakuya.img.complete) {
                if (!sakuya.invincibleTimer || Math.floor(sakuya.invincibleTimer / 4) % 2 === 0) {
                    if (sakuyaConfig) {
                        const anim = sakuyaConfig.data[sakuya.currentAnim];
                        const frame = anim.frames[sakuya.currentFrame];
                        ctx.drawImage(
                            sakuya.img,
                            frame.x, frame.y, frame.w, frame.h,
                            -sakuya.w / 2, -sakuya.h + sakuya.jumpOffset, sakuya.w, sakuya.h
                        );
                    } else {
                        ctx.drawImage(sakuya.img, -sakuya.w / 2, -sakuya.h + sakuya.jumpOffset, sakuya.w, sakuya.h);
                    }
                }
            }
            ctx.restore();
        }
    });

    // レーザーのビーム描画 (予告線と太いレーザーを最前面に描画)
    enemyLasers.forEach(l => {
        const lScale = 1.0 + (l.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
        ctx.save();
        ctx.translate(l.startX, l.startY);
        ctx.rotate(l.angle);
        
        if (l.telegraphDuration > 0) {
            // エネルギー充填エフェクト (微調整：少し小さくし、後半に点滅を激化)
            const chargeProgress = 1.0 - (l.telegraphDuration / 48); // 48フレームで溜まる
            
            // 後半に向けて点滅頻度を「分母を小さくする」ことで加速させる
            const pulseFreq = 25 - 18 * chargeProgress; 
            const pulse = (Math.sin(Date.now() / pulseFreq) * 0.4 + 0.6);
            
            const easedProgress = 1 - Math.pow(1 - chargeProgress, 4); 

            // 1. 中心コア相当
                const coreR = (8 + 17 * chargeProgress) * lScale;
                ctx.save();
                ctx.globalAlpha = (0.6 + 0.4 * pulse) * 0.8;
                ctx.drawImage(droneEnergyImg, -coreR, -coreR, coreR * 2, coreR * 2);
                ctx.restore();

                // 2. リング相当 (前回 80px -> 今回 70px へ微調整)
                const ringRadius = (15 + 55 * easedProgress) * lScale;
                ctx.save();
                ctx.rotate(easedProgress * Math.PI * 4);
                // 点滅感を後半ほど強く感じさせる
                ctx.globalAlpha = (0.5 + 0.5 * pulse);
                ctx.drawImage(droneEnergyImg, -ringRadius, -ringRadius, ringRadius * 2, ringRadius * 2);
                ctx.restore();

                // 発射前の予告線 (点線、かつ点滅)
                if (Math.floor(l.telegraphDuration / 4) % 2 === 0) {
                    ctx.lineCap = 'butt';
                    ctx.strokeStyle = 'rgba(255, 10, 50, 0.8)';
                    ctx.lineWidth = 2 * lScale;
                    ctx.setLineDash([15, 15]); // 点線パターン
                    
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(2000, 0);
                    ctx.stroke();
                    
                    ctx.setLineDash([]); // 他の描画に影響しないようリセット
                }
            } else {
                // 本物のレーザー
                let w = (l.duration > 15) ? 18 : l.duration;
                ctx.lineCap = 'round';
                
                ctx.strokeStyle = 'rgba(255, 10, 50, 0.8)'; // 以前より鮮やかな赤へ変更
                ctx.lineWidth = w * lScale;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(2000, 0); // 端まで繋がる
                ctx.stroke();
                
                // 芯の白を入れるとレーザー感が増す
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.lineWidth = w * 0.4 * lScale;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(2000, 0);
                ctx.stroke();
            }
            ctx.restore();
        });

        ctx.restore(); // カメラPANのtranslateをリセット

    // ビネット効果（グラデーションをキャッシュ化）
    if (!ctx.vignette) {
        ctx.vignette = ctx.createRadialGradient(
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.15,
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.6
        );
        ctx.vignette.addColorStop(0, 'rgba(10, 15, 40, 0)');
        ctx.vignette.addColorStop(0.5, 'rgba(10, 15, 40, 0.35)'); 
        ctx.vignette.addColorStop(1, 'rgba(10, 15, 40, 0.8)'); 
    }
    ctx.fillStyle = ctx.vignette;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // HP オーブ表示の更新（値が変わった時のみDOMを更新）
    if (sakuya.lastHP !== sakuya.hp) {
        updateHPCircles('sakuya-circles', sakuya.hp, 10, 'sakuya');
        sakuya.lastHP = sakuya.hp;
    }
    if (mitama.lastHP !== mitama.hp) {
        updateHPCircles('mitama-circles', mitama.hp, 5, 'mitama');
        mitama.lastHP = mitama.hp;
    }
}

function updateHPCircles(containerId, hp, count, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // 初回生成
    if (container.children.length === 0) {
        for (let i = 0; i < count; i++) {
            const div = document.createElement('div');
            div.className = 'circle';
            container.appendChild(div);
        }
    }
    
    // HP = 100 で 10オーブなら、1つ10HP
    // HP = 50 で 5オーブなら、1つ10HP
    const activeCount = Math.ceil(hp / 10);
    const children = container.children;
    for (let i = 0; i < children.length; i++) {
        if (i < activeCount) {
            children[i].classList.add('active');
            if (type === 'mitama') children[i].classList.add('mitama');
        } else {
            children[i].classList.remove('active');
        }
    }
}