function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (isOpRunning) {
        drawOP();
        return;
    }

    // カメラのPAN計算
    sakuya.cameraOffsetY = sakuya.cameraOffsetY || 0;
    let targetPanY = (360 - sakuya.groundY) * 0.4;
    sakuya.cameraOffsetY += (targetPanY - sakuya.cameraOffsetY) * 0.1;

    ctx.save();
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
        let drawX = startX;
        
        while (drawX > -800) drawX -= bgW;
        while (drawX < CANVAS_WIDTH + 800) {
            const offsetY = needsBackgroundScale ? -120 - (bgH - (CANVAS_HEIGHT + 100)) / 2 : -50;
            ctx.drawImage(currentBG, drawX, offsetY, bgW, bgH);
            drawX += bgW;
        }

        if (!isSecondScene && !isThirdScene && lightImg.complete) {
            const lightSpacing = 1950;
            let lightLoopX = -((bgDistance * 2.0) % lightSpacing);
            const lightH = 350;       
            let lx = lightLoopX;
            while (lx > -800) lx -= lightSpacing;
            while (lx < CANVAS_WIDTH + 800) {
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

    bullets.forEach(b => {
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
    });

    const renderQueue = [];
    enemies.forEach(e => renderQueue.push({ type: 'enemy', depth: e.groundY, obj: e }));
    onibis.forEach(o => renderQueue.push({ type: 'onibi', depth: o.groundY, obj: o })); // 追加
    if (!mitama.isHolding && mitama.groundY) renderQueue.push({ type: 'mitama', depth: mitama.groundY });
    renderQueue.push({ type: 'sakuya', depth: sakuya.groundY });
    explosions.forEach(ex => renderQueue.push({ type: 'explosion', depth: ex.groundY, obj: ex }));
    if (!isThirdScene) platforms.forEach(p => renderQueue.push({ type: 'platform', depth: p.y_back - 1, obj: p }));
    if (boss.visible) renderQueue.push({ type: 'boss', depth: boss.groundY });

    renderQueue.sort((a, b) => a.depth - b.depth);

    renderQueue.forEach(item => {
        if (item.type === 'enemy') {
            const e = item.obj;
            // ダメージ時の点滅
            if (e.invincibleTimer > 0 && Math.floor(e.invincibleTimer / 4) % 2 === 0) return;

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

           // ドローンBのチャージおよび体当たり中の発光表現（画像の外まで光らせる）
            if (e.type === 'B' && (e.state === 'charge' || e.state === 'dash')) {
                ctx.save();
                // 本体の描画中心（画像の中央付近）に合わせて光の座標を調整
                const centerX = 0;
                const centerY = -e.h / 2 + e.jumpOffset;
                const pulse = e.state === 'dash' ? 1.2 : (0.5 + 0.7 * (e.stateTimer / 60));
                
                const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, e.w * pulse);
                gradient.addColorStop(0, 'rgba(255, 255, 150, 0.9)'); // 中心は明るく
                gradient.addColorStop(0.4, 'rgba(255, 255, 0, 0.4)'); // 外側へ向かって黄色く
                gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');    // 縁は透明に
                
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, e.w * pulse, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // 本体自体も加算合成で少し明るくする
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
            
            // 足場がある場合のみ、地面への紫色の照り返し（影）を描画
            if (checkOnPlat(o)) {
                ctx.save();
                const shadowAlpha = (o.timer > 420) ? (1.0 - ((o.timer - 420) / 60)) * 0.4 : 0.4;
                const shadowSize = o.w * 0.6 * oScale;
                
                // 地面の中心座標を計算
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

            // 鬼火本体の描画（本体は足場に関係なく空中に表示される）

            // 鬼火本体の描画
            ctx.save();
            ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
            ctx.scale(oScale, oScale);
            
            if (o.timer > 420) {
                ctx.globalAlpha = 1.0 - ((o.timer - 420) / 60);
            }

            if (onibiImg.complete && onibiConfig) {
                const anim = onibiConfig.data.idle;
                const frame = anim.frames[o.frame];
                ctx.drawImage(onibiImg, frame.x, frame.y, frame.w, frame.h, -o.w / 2, -o.h / 2, o.w, o.h);
            }
            ctx.restore();
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
                ctx.restore();
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
                ctx.drawImage(explosionImg, frame.x, frame.y, frame.w, frame.h, -size / 2, -size / 2, size, size);
                ctx.restore();
            }
        } else if (item.type === 'sakuya') {
            const sScale = 1.0 + (sakuya.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
            if (sakuya.isOnPlat) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.beginPath();
                ctx.ellipse(sakuya.x + sakuya.w / 2, sakuya.groundY, sakuya.w * 0.35 * sScale, 12 * sScale, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.save();
            ctx.translate(sakuya.x + sakuya.w / 2, sakuya.groundY);
            ctx.scale(sScale, sScale);
            if (sakuya.img.complete && (!sakuya.invincibleTimer || Math.floor(sakuya.invincibleTimer / 4) % 2 === 0)) {
                if (sakuyaConfig) {
                    const anim = sakuyaConfig.data[sakuya.currentAnim];
                    const frame = anim.frames[sakuya.currentFrame];
                    ctx.drawImage(sakuya.img, frame.x, frame.y, frame.w, frame.h, -sakuya.w / 2, -sakuya.h + sakuya.jumpOffset, sakuya.w, sakuya.h);
                } else {
                    ctx.drawImage(sakuya.img, -sakuya.w / 2, -sakuya.h + sakuya.jumpOffset, sakuya.w, sakuya.h);
                }
            }
            ctx.restore();
        } else if (item.type === 'platform') {
            const p = item.obj;
            if (buildingWallImg.complete) ctx.drawImage(buildingWallImg, p.x - 10, p.y_back - 20);
            if (buildingTopImg.complete) ctx.drawImage(buildingTopImg, p.x - 10, p.y_back - 20);
        } else if (item.type === 'boss') {
            const bScale = (1.0 + (boss.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR) * 0.9;
            
            const shadowAlpha = 0.3 - (Math.abs(boss.jumpOffset) / 500);
            ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.1, shadowAlpha)})`;
            ctx.beginPath();
            const shadowShrink = 1.0 - (Math.abs(boss.jumpOffset) / 300);
            ctx.ellipse(boss.x + boss.w / 2, boss.groundY, boss.w * 0.6 * bScale * shadowShrink, 12 * bScale * shadowShrink, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.save();
            if (bossImg.complete) {
                const nw = bossImg.naturalWidth * 1.1; 
                const nh = bossImg.naturalHeight * 1.1;

                ctx.translate(boss.x + boss.w / 2, boss.groundY);
                ctx.scale(bScale, bScale);
                ctx.drawImage(bossImg, -nw / 2, -nh + boss.jumpOffset, nw, nh);
            }
            ctx.restore();
        }
    });

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
            const chargeProgress = 1.0 - (l.telegraphDuration / 48);
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

    if (giantShuriken && syurikenImg.complete) {
        ctx.save();
        ctx.translate(giantShuriken.x + giantShuriken.w / 2, giantShuriken.y + giantShuriken.h / 2);
        ctx.rotate(giantShuriken.angle);
        ctx.shadowBlur = 40;
        ctx.shadowColor = "#ffeb3b";
        ctx.drawImage(syurikenImg, -giantShuriken.w / 2, -giantShuriken.h / 2, giantShuriken.w, giantShuriken.h);
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
    ctx.restore();

    if (isHalfwayTransitioning) {
        let alpha = halfwayTransitionTimer < 60 ? halfwayTransitionTimer / 60 : (halfwayTransitionTimer < 120 ? 1 : 1 - ((halfwayTransitionTimer - 120) / 60));
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.restore();
    }

    if (sakuya.lastHP !== sakuya.hp) { updateHPCircles('sakuya-circles', sakuya.hp, 10, 'sakuya'); sakuya.lastHP = sakuya.hp; }
    if (mitama.lastHP !== mitama.hp) { updateHPCircles('mitama-circles', mitama.hp, 5, 'mitama'); mitama.lastHP = mitama.hp; }
}

function updateHPCircles(containerId, hp, count, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
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
        if (i < activeCount) {
            children[i].classList.add('active');
            if (type === 'mitama') children[i].classList.add('mitama');
        } else {
            children[i].classList.remove('active');
        }
    }
}

function drawOP() {
    if (!opConfig) return;
    const comp = opConfig.assets.find(a => a.id === "comp_1");
    if (!comp) return;
    if (bgImg.complete) {
        const opBgH = CANVAS_HEIGHT + 100;
        const opBgW = (opBgH / bgImg.height) * bgImg.width; 
        const loopX = -((opTime * 800) % opBgW);
        ctx.drawImage(bgImg, loopX, -50, opBgW, opBgH);
        ctx.drawImage(bgImg, loopX + opBgW, -50, opBgW, opBgH);
    } else {
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    const layers = [...comp.layers].reverse();
    layers.forEach(layer => {
        if (layer.visible === false || opTime < layer.inPoint || opTime > layer.outPoint) return;
        ctx.save();
        applyHierarchyTransforms(layer, comp, opTime);
        const opacity = getOpTrackValue(layer.tracks.opacity, opTime, 100) / 100;
        ctx.globalAlpha *= opacity; 
        if (layer.blendMode && layer.blendMode !== 'source-over') ctx.globalCompositeOperation = layer.blendMode;
        if (layer.type === 'text') {
            const typewriter = getOpTrackValue(layer.tracks.typewriter, opTime, 100);
            const textToShow = layer.text.substring(0, Math.floor(layer.text.length * (typewriter / 100)));
            ctx.font = `bold ${layer.fontSize}px ${layer.fontFamily}`;
            ctx.fillStyle = layer.color; ctx.textAlign = "left"; ctx.textBaseline = "middle";
            const metrics = ctx.measureText(layer.text);
            const xOffset = -metrics.width / 2; 
            if (layer.strokeWidth > 0) {
                ctx.strokeStyle = layer.strokeColor; ctx.lineWidth = layer.strokeWidth;
                ctx.strokeText(textToShow, xOffset, 0);
            }
            ctx.fillText(textToShow, xOffset, 0);
        } else if (layer.type === 'animated_layer') {
            const animAsset = opConfig.assets.find(a => a.id === layer.animAssetId);
            if (animAsset && (layer.imgObj && layer.imgObj.complete)) {
                const animData = animAsset.data[layer.animId];
                const frameIdx = Math.floor(Math.max(0, (opTime - layer.startTime) * animData.fps)) % animData.frames.length;
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