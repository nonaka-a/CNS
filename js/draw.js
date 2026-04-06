const renderQueuePool = [];
let renderQueueCount = 0;
function addRenderItem(type, depth, obj) {
    if (renderQueueCount >= renderQueuePool.length) {
        renderQueuePool.push({ type: type, depth: depth, obj: obj });
    } else {
        const item = renderQueuePool[renderQueueCount];
        item.type = type;
        item.depth = depth;
        item.obj = obj;
    }
    renderQueueCount++;
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (isOpRunning) {
        drawEvent(opConfig, opTime);
        return;
    }

    if (isEndingRunning) {
        drawEvent(endConfig, endTime);
        return;
    }

    // カメラのPAN計算
    sakuya.cameraOffsetY = sakuya.cameraOffsetY || 0;
    let targetPanY = (360 - sakuya.groundY) * 0.4;
    sakuya.cameraOffsetY += (targetPanY - sakuya.cameraOffsetY) * 0.1;

    ctx.save();
    // 画面揺れの適用
    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        screenShake *= 0.95; // 徐々に減衰
        if (screenShake < 0.1) screenShake = 0;
    }
    ctx.translate(0, sakuya.cameraOffsetY);

    if (currentZoom !== 1.0) {
        ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.7);
        ctx.scale(currentZoom, currentZoom);
        ctx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT * 0.7);
    }

    let currentBG;
    if (isThirdScene) {
        currentBG = bgImg3;
    } else if ((halfwayReached && halfwayTransitionTimer >= 60) || isSecondScene) {
        currentBG = bgImg2;
    } else {
        currentBG = bgImg;
    }

    if (currentBG.complete) {
        let bgH = CANVAS_HEIGHT + 100;
        let bgW = (bgH / currentBG.height) * currentBG.width; 
        
        const needsBackgroundScale = isSecondScene && currentZoom !== 1.0;
        if (needsBackgroundScale) {
            const invZoom = (1 / currentZoom) * 1.05;
            bgH *= invZoom;
            bgW *= invZoom;
        }
        
        let bgScrollSpeed = isThirdScene ? 2.0 : (isSecondScene ? 0.05 : 2.0);
        
        let startX = -((bgDistance * bgScrollSpeed) % bgW);
        if (startX > 0) startX -= bgW; // 安全策：正の値になった場合は1枚分左にズラす
        let drawX = startX;
        
        while (drawX < CANVAS_WIDTH + 200) {
            const offsetY = needsBackgroundScale ? -120 - (bgH - (CANVAS_HEIGHT + 100)) / 2 : -50;
            ctx.drawImage(currentBG, drawX, offsetY, bgW, bgH);
            drawX += bgW;
        }

        if (!isSecondScene && !isThirdScene && lightImg.complete) {
            const lightSpacing = 1950;
            let lightLoopX = -((bgDistance * 2.0) % lightSpacing);
            if (lightLoopX > 0) lightLoopX -= lightSpacing;
            const lightH = 350;       
            let lx = lightLoopX;
            while (lx < CANVAS_WIDTH + 200) {
                const w = (lightH / lightImg.height) * lightImg.width;
                ctx.drawImage(lightImg, lx - 100, 550 - lightH, w, lightH);
                lx += lightSpacing;
            }
        }

        const currentVignette = (isSecondScene || isThirdScene) ? vignette2Img : vignetteImg;
        if (currentVignette.complete) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalCompositeOperation = 'multiply';
            ctx.drawImage(currentVignette, 0, -50, CANVAS_WIDTH, CANVAS_HEIGHT + 100);
            ctx.restore();
        }
    }

    // ここで行っていた bullets.forEach(b => { ... }) を削除し、下のレンダリングキューに追加します

    renderQueueCount = 0;
    // 手裏剣をレンダリングキューに追加
    bullets.forEach(b => addRenderItem('bullet', b.groundY, b));
    enemies.forEach(e => addRenderItem('enemy', e.groundY, e));
    onibis.forEach(o => addRenderItem('onibi', o.groundY, o)); 
    if (!mitama.isHolding && mitama.groundY) addRenderItem('mitama', mitama.groundY, null);
    addRenderItem('sakuya', sakuya.groundY, null);
    
    // 足場のソート基準を p.y_back（奥の端）に戻す。
    // これにより、足場の上にいる（y_back <= groundY）キャラが足場より後に描画される。
    if (!isThirdScene) platforms.forEach(p => addRenderItem('platform', p.y_back, p));
    
    if (isThirdScene) addRenderItem('boss', boss.groundY, boss);
    if (bossSumaho) addRenderItem('sumaho', bossSumaho.groundY, bossSumaho);
    items.forEach(it => addRenderItem('item', it.groundY, it));
    explosions.forEach(ex => addRenderItem('explosion', ex.groundY, ex)); // 最後に配置して手前に描画

    // インサーションソート
    for (let i = 1; i < renderQueueCount; i++) {
        let key = renderQueuePool[i];
        let j = i - 1;
        while (j >= 0 && renderQueuePool[j].depth > key.depth) {
            renderQueuePool[j + 1] = renderQueuePool[j];
            j--;
        }
        renderQueuePool[j + 1] = key;
    }

    for (let i = 0; i < renderQueueCount; i++) {
        const item = renderQueuePool[i];

        if (item.type === 'bullet') {
            const b = item.obj;
            const bScale = 1.0 + (b.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
            if (syurikenImg.complete) {
                b.history.forEach((h, idx) => {
                    if (idx % 2 === 0) return; 
                    const trailAlpha = (idx / b.history.length) * 0.6;
                    ctx.save();
                    ctx.globalAlpha = trailAlpha;
                    ctx.translate(h.x + b.w / 2, h.y + b.h / 2);
                    ctx.scale(bScale * (0.3 + (idx / b.history.length) * 0.7), bScale * (0.3 + (idx / b.history.length) * 0.7));
                    ctx.rotate(h.angle);
                    ctx.drawImage(syurikenImg, -b.w / 2, -b.h / 2, b.w, b.h);
                    ctx.restore();
                });
                ctx.save();
                ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
                ctx.scale(bScale, bScale);
                ctx.rotate(b.angle);
                ctx.drawImage(syurikenImg, -b.w / 2, -b.h / 2, b.w, b.h);
                ctx.restore();
            }
        } else if (item.type === 'enemy') {
            const e = item.obj;
            if (e.invincibleTimer > 0 && Math.floor(e.invincibleTimer / 4) % 2 === 0) continue;
            const eScale = 1.0 + (e.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
            if (e.isOnPlat) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.beginPath();
                ctx.ellipse(e.x + e.w / 2, e.groundY, e.w * 0.35 * eScale, 6 * eScale, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.save();
            ctx.translate(e.x + e.w / 2, e.groundY);
            ctx.scale(eScale, eScale);
            if (e.type === 'B' && (e.state === 'charge' || e.state === 'dash')) {
                ctx.save();
                const centerX = 0;
                const centerY = -e.h / 2 + e.jumpOffset;
                const pulse = e.state === 'dash' ? 1.2 : (0.5 + 0.7 * (e.stateTimer / 60));
                const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, e.w * pulse);
                gradient.addColorStop(0, 'rgba(255, 255, 150, 0.9)');
                gradient.addColorStop(0.4, 'rgba(255, 255, 0, 0.4)');
                gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, e.w * pulse, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                ctx.globalCompositeOperation = 'lighter';
            }
            if (droneImg.complete) {
                if (droneConfig) {
                    const anim = droneConfig.data[e.currentAnim];
                    const frame = anim.frames[e.currentFrame];
                    ctx.drawImage(droneImg, frame.x, frame.y, frame.w, frame.h, -e.w / 2, -e.h + e.jumpOffset, e.w, e.h);
                } else {
                    ctx.drawImage(droneImg, -e.w / 2, -e.h + e.jumpOffset, e.w, e.h);
                }
            }
            ctx.restore();
       } else if (item.type === 'onibi') {
            const o = item.obj;
            const oScale = 1.0 + (o.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
            if (checkOnPlat(o)) {
                ctx.save();
                const shadowAlpha = (o.timer > 420) ? (1.0 - ((o.timer - 420) / 60)) * 0.4 : 0.4;
                const shadowSize = o.w * 0.6 * oScale;
                const centerX = o.x + o.w / 2;
                const centerY = o.groundY;
                const shadowGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, shadowSize);
                shadowGrad.addColorStop(0, `rgba(180, 0, 255, ${shadowAlpha})`); 
                shadowGrad.addColorStop(1, 'rgba(180, 0, 255, 0)');              
                ctx.globalCompositeOperation = 'lighter'; 
                ctx.fillStyle = shadowGrad;
                ctx.beginPath();
                ctx.ellipse(centerX, centerY, shadowSize, shadowSize * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            ctx.save();
            ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
            ctx.scale(oScale, oScale);
            if (o.timer > 420) ctx.globalAlpha = 1.0 - ((o.timer - 420) / 60);
            if (onibiImg.complete && onibiConfig) {
                const anim = onibiConfig.data.idle;
                const frame = anim.frames[o.frame];
                ctx.drawImage(onibiImg, frame.x, frame.y, frame.w, frame.h, -o.w / 2, -o.h / 2, o.w, o.h);
            }
            ctx.restore();
        } else if (item.type === 'item') {
            const it = item.obj;
            if (sausageImg.complete) ctx.drawImage(sausageImg, it.x, it.y, it.w, it.h);
        } else if (item.type === 'mitama') {
            const mScale = 1.0 + (mitama.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
            if (mitama.isOnPlat) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.beginPath();
                ctx.ellipse(mitama.x + mitama.w / 2, mitama.groundY, mitama.w * 0.4 * mScale, 6 * mScale, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            if (mitama.img.complete && (!mitama.invincibleTimer || Math.floor(mitama.invincibleTimer / 4) % 2 === 0)) {
                ctx.save();
                ctx.translate(mitama.x + mitama.w / 2, (!mitama.isHolding ? mitama.groundY : sakuya.groundY));
                ctx.scale(mScale, mScale);
                if (mitamaConfig) {
                    const anim = mitamaConfig.data[mitama.currentAnim];
                    const frame = anim.frames[mitama.currentFrame];
                    let yOff = !mitama.isHolding ? -mitama.h - 65 + Math.sin(Date.now() / 400) * 15 + mitama.jumpOffset : -mitama.h - 100 + sakuya.jumpOffset;
                    ctx.drawImage(mitama.img, frame.x, frame.y, frame.w, frame.h, -mitama.w / 2, yOff, mitama.w, mitama.h);
                } else {
                    let yOff = !mitama.isHolding ? -mitama.h - 65 + Math.sin(Date.now() / 400) * 15 + mitama.jumpOffset : -mitama.h - 100 + sakuya.jumpOffset;
                    ctx.drawImage(mitama.img, -mitama.w / 2, yOff, mitama.w, mitama.h);
                }
                if (mitama.healFlashTimer > 0) {
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = mitama.healFlashTimer / 30;
                    let yOff = !mitama.isHolding ? -mitama.h - 65 + Math.sin(Date.now() / 400) * 15 + mitama.jumpOffset : -mitama.h - 100 + sakuya.jumpOffset;
                    if (mitamaConfig) {
                        const anim = mitamaConfig.data[mitama.currentAnim];
                        const frame = anim.frames[mitama.currentFrame];
                        for(let k=0; k<3; k++) ctx.drawImage(mitama.img, frame.x, frame.y, frame.w, frame.h, -mitama.w / 2, yOff, mitama.w, mitama.h);
                    } else {
                        for(let k=0; k<3; k++) ctx.drawImage(mitama.img, -mitama.w / 2, yOff, mitama.w, mitama.h);
                    }
                    ctx.restore();
                }
                ctx.restore();
            }
        } else if (item.type === 'explosion') {
            const ex = item.obj;
            const eScale = 1.0 + (ex.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
            const config = ex.type === 'B' ? explosionConfigB : explosionConfig;
            const img = ex.type === 'B' ? explosionImgB : explosionImg;
            
            if (config && img.complete) {
                const anim = config.data.idle;
                const frame = anim.frames[ex.frame];
                const size = config.tileSize;
                ctx.save();
                ctx.translate(ex.x, ex.y);
                ctx.scale(eScale, eScale);
                ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, -size / 2, -size / 2, size, size);
                ctx.restore();
            }
        } else if (item.type === 'sakuya') {
            const sScale = 1.0 + (sakuya.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
            const drawX = (sakuya.hissatsuSlideX !== undefined) ? sakuya.hissatsuSlideX : sakuya.x;
            if (sakuya.isOnPlat) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.beginPath();
                ctx.ellipse(drawX + sakuya.w / 2, sakuya.groundY, sakuya.w * 0.35 * sScale, 12 * sScale, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.save();
            ctx.translate(drawX + sakuya.w / 2, sakuya.groundY);
            ctx.scale(sScale, sScale);
            if (sakuya.img.complete && (!sakuya.invincibleTimer || Math.floor(sakuya.invincibleTimer / 4) % 2 === 0)) {
                if (typeof giantShuriken !== 'undefined' && giantShuriken && typeof sakuyaHissatsuImg !== 'undefined' && sakuyaHissatsuImg.complete) {
                    ctx.drawImage(sakuyaHissatsuImg, -sakuya.w / 2, -sakuya.h + sakuya.jumpOffset, sakuya.w, sakuya.h);
                } else if (sakuyaConfig) {
                    const anim = sakuyaConfig.data[sakuya.currentAnim];
                    const frame = anim.frames[sakuya.currentFrame];
                    ctx.drawImage(sakuya.img, frame.x, frame.y, frame.w, frame.h, -sakuya.w / 2, -sakuya.h + sakuya.jumpOffset, sakuya.w, sakuya.h);
                } else {
                    ctx.drawImage(sakuya.img, -sakuya.w / 2, -sakuya.h + sakuya.jumpOffset, sakuya.w, sakuya.h);
                }
                if (sakuya.healFlashTimer > 0) {
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = sakuya.healFlashTimer / 30;
                    if (typeof giantShuriken !== 'undefined' && giantShuriken && typeof sakuyaHissatsuImg !== 'undefined' && sakuyaHissatsuImg.complete) {
                        for(let k=0; k<3; k++) ctx.drawImage(sakuyaHissatsuImg, -sakuya.w / 2, -sakuya.h + sakuya.jumpOffset, sakuya.w, sakuya.h);
                    } else if (sakuyaConfig) {
                        const anim = sakuyaConfig.data[sakuya.currentAnim];
                        const frame = anim.frames[sakuya.currentFrame];
                        for(let k=0; k<3; k++) ctx.drawImage(sakuya.img, frame.x, frame.y, frame.w, frame.h, -sakuya.w / 2, -sakuya.h + sakuya.jumpOffset, sakuya.w, sakuya.h);
                    } else {
                        for(let k=0; k<3; k++) ctx.drawImage(sakuya.img, -sakuya.w / 2, -sakuya.h + sakuya.jumpOffset, sakuya.w, sakuya.h);
                    }
                    ctx.restore();
                }
            }
            ctx.restore();
        } else if (item.type === 'platform') {
            const p = item.obj;
            // 画像自体は y_back（一番奥）から手前に向かって描画される
            if (buildingWallImg.complete) ctx.drawImage(buildingWallImg, p.x - 10, p.y_back - 20);
            if (buildingTopImg.complete) ctx.drawImage(buildingTopImg, p.x - 10, p.y_back - 20);
        } else if (item.type === 'boss') {
            const bScale = (1.0 + (boss.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR) * 0.9;
            const shadowAlpha = 0.3 - (Math.abs(boss.jumpOffset) / 500);
            const shadowShrink = 1.0 - (Math.abs(boss.jumpOffset) / 300);
            if (shadowShrink > 0) {
                ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.1, shadowAlpha)})`;
                ctx.beginPath();
                ctx.ellipse(boss.x + boss.w / 2, boss.groundY, boss.w * 0.6 * bScale * shadowShrink, 12 * bScale * shadowShrink, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.save();
            if (boss.img.complete) {
                ctx.translate(boss.x + boss.w / 2, boss.groundY);
                ctx.scale(bScale, bScale);
                // ビームチャージ中の本体発光エフェクト
                if (boss.state === 'charge' && (boss.telegraphDuration > 0 || boss.telegraphDuration === -1)) {
                    // ゆっくり光らせる（-1の待機時は0、180からカウントダウンで1.0へ）
                    const chargeProgress = (boss.telegraphDuration > 0) ? Math.max(0, 1.0 - (boss.telegraphDuration / 180)) : 0;
                    const pulse = (0.6 + 0.4 * Math.sin(Date.now() / 100)) * chargeProgress;
                    
                    ctx.save();
                    const centerX = 0;
                    const centerY = -boss.h / 2 + boss.jumpOffset;
                    const glowRadius = boss.w * (1.2 + 0.5 * pulse);
                    
                    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
                    // 中心をより白く（芯を作る）、外側への色の変化を激しくして強烈な光を表現
                    gradient.addColorStop(0, `rgba(255, 255, 255, ${1.0 * pulse})`);
                    gradient.addColorStop(0.2, `rgba(255, 100, 100, ${0.9 * pulse})`);
                    gradient.addColorStop(0.5, `rgba(255, 0, 0, ${0.4 * pulse})`);
                    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
                    
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();

                }

                // 本体を通常描画
                if (bossConfig) {
                    const anim = bossConfig.data[boss.currentAnim];
                    if (anim) {
                        const frame = anim.frames[boss.currentFrame];
                        if (frame) ctx.drawImage(boss.img, frame.x, frame.y, frame.w, frame.h, -frame.w / 2, -frame.h + boss.jumpOffset, frame.w, frame.h);
                    }
                } else {
                    const nw = boss.img.naturalWidth * 1.1; 
                    const nh = boss.img.naturalHeight * 1.1;
                    ctx.drawImage(boss.img, -nw / 2, -nh + boss.jumpOffset, nw, nh);
                }

                // ビームチャージ中の画像加算発光（通常描画の上に重ねることで「半透明」に見えるのを防ぐ）
                if (boss.state === 'charge' && boss.telegraphDuration > 0) {
                    const chargeProgress = Math.max(0, 1.0 - (boss.telegraphDuration / 180));
                    if (chargeProgress > 0.1) {
                        ctx.save();
                        ctx.globalCompositeOperation = 'lighter';
                        // 発光強度を大幅に強化し、シャドウによる外光（グロー）を追加
                        const glowPulse = 0.7 + 0.3 * Math.sin(Date.now() / 80);
                        ctx.globalAlpha = Math.min(1.0, chargeProgress * 1.5) * glowPulse;
                        ctx.shadowBlur = 60 * chargeProgress * glowPulse;
                        ctx.shadowColor = "red";
                        
                        // 強度を増すために2回重ねて描画
                        for(let k = 0; k < 2; k++) {
                            if (bossConfig) {
                                const anim = bossConfig.data[boss.currentAnim];
                                if (anim) {
                                    const frame = anim.frames[boss.currentFrame];
                                    if (frame) ctx.drawImage(boss.img, frame.x, frame.y, frame.w, frame.h, -frame.w / 2, -frame.h + boss.jumpOffset, frame.w, frame.h);
                                }
                            } else {
                                const nw = boss.img.naturalWidth * 1.1; 
                                const nh = boss.img.naturalHeight * 1.1;
                                ctx.drawImage(boss.img, -nw / 2, -nh + boss.jumpOffset, nw, nh);
                            }
                        }
                        ctx.restore();
                    }
                }
            }
            ctx.restore();
            if (boss.state === 'barrier' || boss.state === 'dash' || boss.state === 'retreat') {
                let barrierAlpha = 0.6 + Math.sin(Date.now() / 150) * 0.2;
                if (boss.state === 'barrier') {
                    if (boss.stateTimer < 60) barrierAlpha *= (boss.stateTimer / 60);
                    else if (boss.stateTimer > 420) barrierAlpha *= ((480 - boss.stateTimer) / 60);
                }
                ctx.save();
                ctx.translate(boss.x + boss.w / 2, boss.groundY - boss.h / 2 + boss.jumpOffset);
                ctx.scale(bScale, bScale);
                ctx.globalCompositeOperation = 'lighter';
                let grad = ctx.createRadialGradient(0, 0, 80, 0, 0, 150);
                grad.addColorStop(0, `rgba(255, 100, 100, 0)`);
                grad.addColorStop(0.7, `rgba(255, 0, 30, ${barrierAlpha})`);
                grad.addColorStop(1, `rgba(255, 0, 0, 0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, 150, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            if (boss.state === 'charge' && (boss.telegraphDuration > 0 || boss.telegraphDuration === -1)) {
                let chargeProgress = 1.0 - (boss.telegraphDuration / 240);
                let pulse = Math.sin(Date.now() / (50 - 40 * chargeProgress)) * 0.5 + 0.5;
                ctx.save();
                ctx.translate(boss.x + boss.w / 2 + 60, boss.groundY - boss.h / 2 + boss.jumpOffset);
                ctx.scale(bScale, bScale);
                ctx.globalCompositeOperation = 'lighter';
                let ringRadius = 50 + 100 * (1 - chargeProgress);
                if (droneEnergyImg.complete) {
                    ctx.rotate(Date.now() / 200);
                    ctx.globalAlpha = pulse * chargeProgress;
                    ctx.drawImage(droneEnergyImg, -ringRadius, -ringRadius, ringRadius * 2, ringRadius * 2);
                }
                if (Math.floor(boss.telegraphDuration / 4) % 2 === 0) {
                    ctx.setTransform(1, 0, 0, 1, 0, sakuya.cameraOffsetY);
                    if (currentZoom !== 1.0) {
                        ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.7);
                        ctx.scale(currentZoom, currentZoom);
                        ctx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT * 0.7);
                    }
                    ctx.lineCap = 'butt';
                    ctx.strokeStyle = `rgba(255, 10, 50, ${chargeProgress})`;
                    ctx.lineWidth = 4 * bScale;
                    ctx.setLineDash([20, 20]);
                    ctx.beginPath(); 
                    ctx.moveTo(boss.x + boss.w / 2 + 60, boss.groundY - boss.h / 2 + boss.jumpOffset); 
                    ctx.lineTo(2000, boss.groundY - boss.h / 2 + boss.jumpOffset); 
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
                ctx.restore();
            }
            let waitTime = (boss.smashCount === 0) ? 120 : 60;
            if (boss.state === 'smash_wait' && boss.stateTimer >= waitTime - 60) {
                let progress = (boss.stateTimer - (waitTime - 60)) / 60; 
                let rPulse = 0.5 + Math.sin(Date.now() / 50) * 0.5 * progress;
                ctx.save();
                ctx.translate(boss.targetX, boss.groundY);
                ctx.scale(bScale, bScale);
                let shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 360); // 元のサイズ(180*2)に固定
                shadowGrad.addColorStop(0, `rgba(255, 0, 0, ${rPulse})`);
                shadowGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = shadowGrad;
                ctx.beginPath();
                ctx.ellipse(0, 0, 360, 90, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            if (boss.state === 'smash_shake') {
                let progress = boss.stateTimer / 60; 
                ctx.save();
                ctx.translate(boss.x + boss.w / 2, boss.groundY);
                ctx.scale(bScale, bScale);
                ctx.globalCompositeOperation = 'lighter';
                let waveScale = 1.0 + Math.sin(Date.now() / 50) * 0.1;
                let waveAlpha = 1.0 - progress; 
                let radW = 396 * waveScale; // 180 * 2.2 = 396 (元のスケールを維持)
                let radH = 85 * waveScale;
                let waveGrad = ctx.createRadialGradient(0, 0, radW * 0.2, 0, 0, radW);
                waveGrad.addColorStop(0, `rgba(255, 50, 0, ${waveAlpha * 0.8})`);
                waveGrad.addColorStop(0.5, `rgba(255, 100, 0, ${waveAlpha * 0.4})`);
                waveGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
                ctx.fillStyle = waveGrad;
                ctx.beginPath();
                ctx.ellipse(0, 0, radW, radH, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        } else if (item.type === 'sumaho') {
            const sm = item.obj;
            const smScale = 1.0 + (sm.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
            if (sumahoImg.complete) {
                ctx.save();
                ctx.translate(sm.x + sm.w / 2, sm.groundY + sm.jumpOffset);
                ctx.scale(smScale, smScale);
                ctx.rotate(sm.angle);
                ctx.drawImage(sumahoImg, -sm.w / 2, -sm.h / 2, sm.w, sm.h);
                ctx.restore();
            }
        }
    }

    if (!isSecondScene && !isThirdScene) {
        const lightSpacing = 1950; 
        let lightLoopX = -((bgDistance * 2.0) % lightSpacing); 
        if (streetlightImg.complete) {
            let lx = lightLoopX;
            while (lx > -800) lx -= lightSpacing;
            while (lx < CANVAS_WIDTH + 800) {
                const w = (480 / streetlightImg.height) * streetlightImg.width;
                ctx.drawImage(streetlightImg, lx + 150, 460 - 480, w, 480);
                lx += lightSpacing;
            }
        }
        if (guardrailImg.complete) {
            let gx = -((bgDistance * 2.0) % 650);
            while (gx > -800) gx -= 650;
            while (gx < CANVAS_WIDTH + 800) {
                ctx.drawImage(guardrailImg, gx, 380, 600, 110);
                gx += 650;
            }
        }
    }

    ctx.restore();

    ctx.save();
    ctx.translate(0, sakuya.cameraOffsetY);
    if (currentZoom !== 1.0) {
        ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.7);
        ctx.scale(currentZoom, currentZoom);
        ctx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT * 0.7);
    }

    enemyLasers.forEach(l => {
        const lScale = 1.0 + (l.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
        ctx.save();
        ctx.translate(l.startX, l.startY);
        ctx.rotate(l.angle);
        
        if (l.telegraphDuration > 0) {
            const chargeProgress = 1.0 - (l.telegraphDuration / (l.maxTelegraph || 48));
            const pulseFreq = 25 - 18 * chargeProgress; 
            const pulse = (Math.sin(Date.now() / pulseFreq) * 0.4 + 0.6);
            const easedProgress = 1 - Math.pow(1 - chargeProgress, 4); 

            if (droneEnergyImg.complete) {
                const ringRadius = (15 + 55 * easedProgress) * lScale;
                ctx.save();
                ctx.rotate(easedProgress * Math.PI * 4);
                ctx.globalAlpha = (0.5 + 0.5 * pulse);
                ctx.drawImage(droneEnergyImg, -ringRadius, -ringRadius, ringRadius * 2, ringRadius * 2);
                ctx.restore();
            }

            if (Math.floor(l.telegraphDuration / 4) % 2 === 0) {
                ctx.lineCap = 'butt';
                ctx.strokeStyle = 'rgba(255, 10, 50, 0.8)';
                ctx.lineWidth = 2 * lScale;
                ctx.setLineDash([15, 15]);
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2000, 0); ctx.stroke();
                ctx.setLineDash([]);
            }
        } else {
            let w = (l.duration > 15) ? 18 : l.duration;
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(255, 10, 50, 0.8)';
            ctx.lineWidth = w * lScale;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2000, 0); ctx.stroke();
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = w * 0.4 * lScale;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2000, 0); ctx.stroke();
        }
        ctx.restore();
    });

    if (bossActive && boss.laserDuration > 0) {
        const bScale = (1.0 + (boss.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR) * 0.9;
        ctx.save();
        ctx.translate(boss.x + boss.w / 2 + 60, boss.groundY - boss.h / 2 + boss.jumpOffset);
        
        let w = (boss.laserDuration > 15) ? 120 : boss.laserDuration * 8;
        let p = (boss.laserDuration > 15) ? (Math.sin(Date.now() / 30) * 0.2 + 0.8) : 1.0;
        
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(255, 30, 80, ${0.9 * p})`;
        ctx.lineWidth = w * bScale;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2000, 0); ctx.stroke();
        
        ctx.strokeStyle = `rgba(255, 200, 255, ${1.0 * p})`;
        ctx.lineWidth = w * 0.5 * bScale;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2000, 0); ctx.stroke();
        ctx.restore();
    }

    if (giantShuriken && typeof giantSyurikenImg !== 'undefined' && giantSyurikenImg.complete) {
        ctx.save();
        ctx.translate(giantShuriken.x + giantShuriken.w / 2, giantShuriken.y + giantShuriken.h / 2);
        ctx.rotate(giantShuriken.angle);
        ctx.shadowBlur = 40;
        ctx.shadowColor = "#ffeb3b";
        ctx.drawImage(giantSyurikenImg, -giantShuriken.w / 2, -giantShuriken.h / 2, giantShuriken.w, giantShuriken.h);
        ctx.restore();
    }

    if (isThirdScene && bgImg3_front.complete) {
        const fgScale = 0.7; 
        const fgH = (CANVAS_HEIGHT + 100) * fgScale;
        const fgW = (fgH / bgImg3_front.height) * bgImg3_front.width;
        const fgOffsetY = 320; 
        const fgScrollSpeed = 2.5; 

        let fgstartX = -((bgDistance * fgScrollSpeed) % fgW);
        let fgdrawX = fgstartX;
        
        while (fgdrawX > -800) fgdrawX -= fgW;
        while (fgdrawX < CANVAS_WIDTH + 800) {
            ctx.drawImage(bgImg3_front, fgdrawX, fgOffsetY, fgW, fgH);
            fgdrawX += fgW;
        }
    }

    if (!isSecondScene && !isThirdScene && typeof streetlightFrontImg !== 'undefined' && streetlightFrontImg.complete) {
        let fgx = -((bgDistance * 3.5) % 5000);
        while (fgx > -800) fgx -= 5000;
        while (fgx < CANVAS_WIDTH + 800) {
            const w = (800 / streetlightFrontImg.height) * streetlightFrontImg.width;
            ctx.drawImage(streetlightFrontImg, fgx - 100, CANVAS_HEIGHT + 140 - 800, w, 800);
            fgx += 5000;
        }
    }
    // パーティクルの描画
    if (particles.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
    ctx.restore();

    // ミタマ脱落アラート演出 (画面左隅を赤くハイライト)
    if (mitamaAlertTimer > 0) {
        ctx.save();
        let alpha = 0.4 * (0.5 + 0.5 * Math.sin(Date.now() / 150));
        let grad = ctx.createLinearGradient(0, 0, 180, 0);
        grad.addColorStop(0, `rgba(255, 0, 0, ${alpha})`);
        grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 180, CANVAS_HEIGHT); 
        ctx.restore();
    }

    if (isHalfwayTransitioning) {
        let alpha = halfwayTransitionTimer < 60 ? halfwayTransitionTimer / 60 : (halfwayTransitionTimer < 120 ? 1 : 1 - ((halfwayTransitionTimer - 120) / 60));
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.restore();
    }

    if (sakuya.lastHP !== sakuya.hp || sakuya.lastFlashTimer !== sakuya.healFlashTimer) { 
        updateHPCircles('sakuya-circles', sakuya.hp, 10, 'sakuya'); 
        sakuya.lastHP = sakuya.hp; 
        sakuya.lastFlashTimer = sakuya.healFlashTimer;
    }
    if (mitama.lastHP !== mitama.hp || mitama.lastFlashTimer !== mitama.healFlashTimer) { 
        updateHPCircles('mitama-circles', mitama.hp, 5, 'mitama'); 
        mitama.lastHP = mitama.hp; 
        mitama.lastFlashTimer = mitama.healFlashTimer;
    }

    // 必殺技カットインのDOM制御（全UIの上に表示するため）
    const cutInOverlay = document.getElementById('cutin-overlay');
    const cutInImgEl = document.getElementById('cutin-img');
    const activeTimer = cutInTimer > 0 ? cutInTimer : (bossCutInTimer > 0 ? bossCutInTimer : 0);
    const activeImgSrc = cutInTimer > 0 ? 'images/Sprite/cut_in.png' : 'images/Sprite/cut_in_iina.png';

    if (cutInOverlay && cutInImgEl) {
        if (activeTimer > 0) {
            cutInOverlay.style.display = 'block';
            
            // 画像の切り替え（一度だけ行う）
            if (cutInImgEl.src.indexOf(activeImgSrc) === -1) {
                cutInImgEl.src = activeImgSrc;
            }

            if (activeTimer > 30) {
                // フェーズ1：0.2秒(12f)で暗転 (42-31フレーム)
                let blackoutProgress = (42 - activeTimer) / 12; // 0.0 -> 1.0 (12f)
                cutInOverlay.style.opacity = blackoutProgress;
                cutInImgEl.style.display = 'none'; // 画像はまだ出さない
            } else {
                // フェーズ2：0.5秒(30f)カットイン (30-1フレーム)
                cutInOverlay.style.opacity = '1';
                cutInImgEl.style.display = 'block';
                
                // 最初の5フレームで白から本来の色味へ（閃光エフェクト）
                let flashDuration = 5;
                let progress = Math.min(1.0, (30 - activeTimer) / flashDuration);
                let brightness = 100 + (1000 * (1 - progress)); // 1100%から100%へ
                cutInImgEl.style.filter = `brightness(${brightness}%)`;

                // 一瞬だけ激しく震える（スクリーンシェイク）をDOMにも適用
                if (screenShake > 0) {
                    const sx = (Math.random() - 0.5) * screenShake * 1.5;
                    const sy = (Math.random() - 0.5) * screenShake * 1.5;
                    cutInImgEl.style.transform = `translate(${sx}px, ${sy}px) scale(1.05)`;
                } else {
                    cutInImgEl.style.transform = 'none';
                }
            }
        } else {
            cutInOverlay.style.opacity = '0';
            cutInImgEl.style.transform = 'none'; // リセット
            if (cutInOverlay.style.display !== 'none') {
                setTimeout(() => { if (cutInTimer === 0 && bossCutInTimer === 0) cutInOverlay.style.display = 'none'; }, 50);
            }
        }
    }

    // ホワイトアウト演出
    if (whiteFadeAlpha > 0) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(255, 255, 255, ${whiteFadeAlpha})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.restore();
    }
}

function updateHPCircles(containerId, hp, count, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const flashTimer = (type === 'mitama') ? mitama.healFlashTimer : sakuya.healFlashTimer;

    if (container.children.length === 0) {
        for (let i = 0; i < count; i++) {
            const div = document.createElement('div');
            div.className = 'circle';
            container.appendChild(div);
        }
    }
    const activeCount = Math.ceil(hp / 10);
    const children = container.children;
    for (let i = 0; i < children.length; i++) {
        const circle = children[i];
        
        // --- 状態の完全初期化（絶対に残さない） ---
        circle.classList.remove('flash');
        
        // --- active状態の設定 ---
        if (i < activeCount) {
            circle.classList.add('active');
            if (type === 'mitama') circle.classList.add('mitama');
            else circle.classList.remove('mitama');

            // --- 発光状態の設定（タイマーがあるときだけ再付与） ---
            if (flashTimer > 0) {
                circle.classList.add('flash');
            }
        } else {
            circle.classList.remove('active');
        }
    }
}

function drawEvent(config, time) {
    if (!config) return;
    const comp = config.assets.find(a => a.id === "comp_1");
    if (!comp) return;

    ctx.save();
    // コンポジションサイズとキャンバスサイズの比率に合わせてスケーリング
    const compScaleX = CANVAS_WIDTH / comp.width;
    const compScaleY = CANVAS_HEIGHT / comp.height;
    ctx.scale(compScaleX, compScaleY);

    if (bgImg.complete) {
        // 背景はコンポジションサイズ基準で描画
        const opBgH = comp.height + (100 / compScaleY);
        const opBgW = (opBgH / bgImg.height) * bgImg.width; 
        const loopX = -((time * 800) % opBgW);
        ctx.drawImage(bgImg, loopX, -50 / compScaleY, opBgW, opBgH);
        ctx.drawImage(bgImg, loopX + opBgW, -50 / compScaleY, opBgW, opBgH);
    } else {
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, comp.width, comp.height);
    }
    const layers = [...comp.layers].reverse();
    layers.forEach(layer => {
        if (layer.visible === false || time < layer.inPoint || time > layer.outPoint) return;
        ctx.save();
        applyHierarchyTransforms(layer, comp, time);
        const opacity = getOpTrackValue(layer.tracks.opacity, time, 100) / 100;
        ctx.globalAlpha *= opacity; 
        if (layer.blendMode && layer.blendMode !== 'source-over') ctx.globalCompositeOperation = layer.blendMode;
        if (layer.type === 'text') {
            const typewriter = getOpTrackValue(layer.tracks.typewriter, time, 100);
            const textToShow = layer.text.substring(0, Math.floor(layer.text.length * (typewriter / 100)));
            
            const isBold = (layer.fontWeight === 'bold' || layer.bold !== false);
            // 引用符の重複を防ぐために正規化
            const cleanFontFamily = (layer.fontFamily || 'Arial').replace(/"/g, '');
            ctx.font = `${isBold ? 'bold ' : ''}${layer.fontSize}px "${cleanFontFamily}", sans-serif`;
            ctx.fillStyle = layer.color; ctx.textAlign = "left"; ctx.textBaseline = "middle";
            
            const metrics = ctx.measureText(layer.text);
            const xOffset = -metrics.width / 2; 

            // ドロップシャドウの設定 (shadowOpacityプロパティを確認)
            if (layer.dropShadow || (layer.shadowOpacity !== undefined && layer.shadowOpacity > 0)) {
                const opacity = (layer.shadowOpacity !== undefined) ? layer.shadowOpacity / 100 : 0.7;
                ctx.shadowColor = layer.shadowColor || `rgba(0,0,0,${opacity})`;
                ctx.shadowBlur = (layer.shadowBlur !== undefined) ? layer.shadowBlur : 4;
                ctx.shadowOffsetX = (layer.shadowOffsetX !== undefined) ? layer.shadowOffsetX : 2;
                ctx.shadowOffsetY = (layer.shadowOffsetY !== undefined) ? layer.shadowOffsetY : 2;
            }

            if (layer.strokeWidth > 0) {
                ctx.strokeStyle = layer.strokeColor; ctx.lineWidth = layer.strokeWidth;
                ctx.strokeText(textToShow, xOffset, 0);
            }
            ctx.fillText(textToShow, xOffset, 0);

            // シャドウ設定をリセット
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        } else if (layer.type === 'animated_layer') {
            const animAsset = config.assets.find(a => a.id === layer.animAssetId);
            if (animAsset && (layer.imgObj && layer.imgObj.complete)) {
                const animData = animAsset.data[layer.animId];
                const frameIdx = Math.floor(Math.max(0, (time - layer.startTime) * animData.fps)) % animData.frames.length;
                const frame = animData.frames[frameIdx];
                ctx.drawImage(layer.imgObj, frame.x, frame.y, frame.w, frame.h, -frame.w/2, -frame.h/2, frame.w, frame.h);
            }
        } else if (layer.type === 'solid') {
            ctx.fillStyle = layer.color;
            const isSmallShape = layer.shape === 'circle' || layer.parent;
            const w = layer.width || (isSmallShape ? 100 : comp.width);
            const h = layer.height || (isSmallShape ? 100 : comp.height);
            if (layer.shape === 'circle') {
                ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.fillRect(-w / 2, -h / 2, w, h);
            }
        } else if (layer.imgObj && layer.imgObj.complete) {
            ctx.drawImage(layer.imgObj, -layer.imgObj.width/2, -layer.imgObj.height/2, layer.imgObj.width, layer.imgObj.height);
        }
        ctx.restore();
    });
    ctx.restore();
}
function applyHierarchyTransforms(layer, comp, time) {
    if (layer.parent) {
        const parentLayer = comp.layers.find(l => l.id === layer.parent);
        if (parentLayer) applyHierarchyTransforms(parentLayer, comp, time);
    }
    const pos = getOpTrackValue(layer.tracks.position, time, {x:500, y:300});
    const scale = getOpTrackValue(layer.tracks.scale, time, {x:100, y:100});
    const rotation = getOpTrackValue(layer.tracks.rotation, time, 0) * (Math.PI / 180);
    ctx.translate(pos.x, pos.y); ctx.rotate(rotation); ctx.scale(scale.x / 100, scale.y / 100);
}
function getOpTrackValue(track, time, def) {
    if (!track || !track.keys || track.keys.length === 0) return (track && track.initialValue !== undefined) ? track.initialValue : def;
    const keys = track.keys;
    let nextIdx = keys.findIndex(k => k.time > time);
    if (nextIdx === -1) return keys[keys.length - 1].value;
    if (nextIdx === 0) return keys[0].value;
    const prev = keys[nextIdx - 1]; const next = keys[nextIdx];
    if (prev.interpolation === "Hold") return prev.value;
    let ratio = (time - prev.time) / (next.time - prev.time);
    if (prev.easeOut && next.easeIn) ratio = ratio * ratio * (3 - 2 * ratio);
    else if (next.easeIn) ratio = 1 - (1 - ratio) * (1 - ratio);
    else if (prev.easeOut) ratio = ratio * ratio;
    if (typeof prev.value === 'number') return prev.value + (next.value - prev.value) * ratio;
    else if (prev.value && typeof prev.value.x === 'number') {
        return { x: prev.value.x + (next.value.x - prev.value.x) * ratio, y: prev.value.y + (next.value.y - prev.value.y) * ratio };
    }
    return prev.value;
}