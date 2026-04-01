function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (isOpRunning) {
        drawOP();
        return;
    }

    // カメラのPAN計算（滑らかに追従）
    sakuya.cameraOffsetY = sakuya.cameraOffsetY || 0;
    let targetPanY = (360 - sakuya.groundY) * 0.4;
    sakuya.cameraOffsetY += (targetPanY - sakuya.cameraOffsetY) * 0.1;

    ctx.save();
    ctx.translate(0, sakuya.cameraOffsetY);

    // 一枚絵の背景 (暗転が開始されたらBG2に切り替え予約、暗転中か明けるところで反映)
    const currentBG = (halfwayReached && halfwayTransitionTimer >= 60) || isSecondScene ? bgImg2 : bgImg;
    if (currentBG.complete) {
        const bgH = CANVAS_HEIGHT + 100;
        const bgW = (bgH / currentBG.height) * currentBG.width; // 縦横比を維持した幅を計算
        
        // エリア2(BG2)は遠景のためスクロール速度を大幅に下げる (例: 0.3)
        const bgScrollSpeed = isSecondScene ? 0.05 : 2.0;
        let loopX = -((distance * bgScrollSpeed) % bgW);
        ctx.drawImage(currentBG, loopX, -50, bgW, bgH);
        ctx.drawImage(currentBG, loopX + bgW, -50, bgW, bgH);

        // light.png (一番奥、エリア1のみ、暗転中も維持)
        if (!isSecondScene && lightImg.complete) {
            const lightSpacing = 1950;
            let lightLoopX = -((distance * 2.0) % lightSpacing);
            
            // --- ここで light.png のサイズと位置を調整します ---
            const lightH = 350;       // 街灯の高さ
            const lightOffsetX = -100; // X座標のズレ（ガードレールとの位置関係）
            const lightOffsetY = 550; // Y座標の基準位置（地面の高さなど）
            // ----------------------------------------------------
            
            for (let x = lightLoopX; x < CANVAS_WIDTH + lightSpacing; x += lightSpacing) {
                const w = (lightH / lightImg.height) * lightImg.width;
                ctx.drawImage(lightImg, x + lightOffsetX, lightOffsetY - lightH, w, lightH);
            }
        }

        // ビネット効果 (背景とlightのみに適用、エリアごとに画像を切り替え)
        const currentVignette = isSecondScene ? vignette2Img : vignetteImg;
        if (currentVignette.complete) {
            ctx.save();
            ctx.globalCompositeOperation = 'multiply';
            // カメラ追従のオフセット(-50)分も考慮して、背景と同じ領域に描画
            ctx.drawImage(currentVignette, 0, -50, CANVAS_WIDTH, CANVAS_HEIGHT + 100);
            ctx.restore();
        }

    }

    // 手裏剣
    bullets.forEach(b => {
        const bScale = 1.0 + (b.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
        if (syurikenImg.complete) {
            b.history.forEach((h, idx) => {
                if (idx % 2 === 0) return; // 1つおきに描画をスキップして間引く
                const trailAlpha = (idx / b.history.length) * 0.6;
                const trailScaleRatio = 0.3 + (idx / b.history.length) * 0.7;
                ctx.save();
                ctx.globalAlpha = trailAlpha;
                ctx.translate(h.x + b.w / 2, h.y + b.h / 2);
                ctx.scale(bScale * trailScaleRatio, bScale * trailScaleRatio);
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

    // Zソート
    const renderQueue = [];
    enemies.forEach(e => renderQueue.push({ type: 'enemy', depth: e.groundY, obj: e }));
    if (!mitama.isHolding && mitama.groundY) {
        renderQueue.push({ type: 'mitama', depth: mitama.groundY });
    }
    renderQueue.push({ type: 'sakuya', depth: sakuya.groundY });
    explosions.forEach(ex => renderQueue.push({ type: 'explosion', depth: ex.groundY, obj: ex }));
    platforms.forEach(p => renderQueue.push({ type: 'platform', depth: p.y_back - 1, obj: p }));
    renderQueue.sort((a, b) => a.depth - b.depth);

    renderQueue.forEach(item => {
        if (item.type === 'enemy') {
            const e = item.obj;
            const eScale = 1.0 + (e.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
            
            // 落ち影
            if (e.isOnPlat) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.beginPath();
                ctx.ellipse(e.x + e.w / 2, e.groundY, e.w * 0.35 * eScale, 6 * eScale, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.save();
            ctx.translate(e.x + e.w / 2, e.groundY);
            ctx.scale(eScale, eScale);
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
        } else if (item.type === 'mitama') {
            const mScale = 1.0 + (mitama.groundY - PERSPECTIVE_BASE_Y) * PERSPECTIVE_SCALE_FACTOR;
            
            // 落ち影
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
                    if (!mitama.isHolding) {
                        // リリース中：groundYを軸に、通常の浮遊高さ + jumpOffset分を加算して描画
                        ctx.drawImage(mitama.img, frame.x, frame.y, frame.w, frame.h, -mitama.w / 2, -mitama.h - 65 + Math.sin(Date.now() / 400) * 15 + mitama.jumpOffset, mitama.w, mitama.h);
                    } else {
                        // ホールド中：sakuya.y（ジャンプオフセット込み）+ 30pxの相対位置に描画
                        // 既に translate(sakuya.groundY) されている想定なので、sakuya.h と jumpOffset を相殺して調整
                        // drawImage 自体は -h-100 に描かれている想定
                        ctx.drawImage(mitama.img, frame.x, frame.y, frame.w, frame.h, -mitama.w / 2, -mitama.h - 100 + sakuya.jumpOffset, mitama.w, mitama.h);
                    }
                } else {
                    if (!mitama.isHolding) {
                        ctx.drawImage(mitama.img, -mitama.w / 2, -mitama.h - 65 + Math.sin(Date.now() / 400) * 15 + mitama.jumpOffset, mitama.w, mitama.h);
                    } else {
                        ctx.drawImage(mitama.img, -mitama.w / 2, -mitama.h - 100 + sakuya.jumpOffset, mitama.w, mitama.h);
                    }
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
            
            // 落ち影
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
            
            // 共通のオフセット値を定義（屋上の調整に基づいた位置情報）
            const roofOffsetX = -10; // 屋上および壁面のX軸微調整値
            const roofOffsetY = -20; // 屋上および壁面のY軸微調整値

            // ビルの側面（壁面）を描画（topと同じ座標に描画）
            if (buildingWallImg.complete) {
                ctx.drawImage(buildingWallImg, p.x + roofOffsetX, p.y_back + roofOffsetY);
            }

            // ビルの屋上（Building_top.png）を描画（Wallと同じ座標に描画）
            if (buildingTopImg.complete) {
                ctx.drawImage(buildingTopImg, p.x + roofOffsetX, p.y_back + roofOffsetY);
            }
        }
    });

    // Streetlightとガードレールを描画 (エリア1のみ、暗転中も維持)
    if (!isSecondScene) {
        const lightSpacing = 1950; 
        let lightLoopX = -((distance * 2.0) % lightSpacing); 
        
        // Streetlight.png (キャラより手前、ガードレールより奥)
        if (streetlightImg.complete) {
            // --- ここで Streetlight.png のサイズと位置を調整します ---
            const streetH = 480;        // 奥側街灯の高さ
            const streetOffsetX = 150;  // X座標のズレ
            const streetOffsetY = 460;  // Y座標の基準位置
            // ----------------------------------------------------------
            
            for (let x = lightLoopX; x < CANVAS_WIDTH + lightSpacing; x += lightSpacing) {
                const w = (streetH / streetlightImg.height) * streetlightImg.width;
                ctx.drawImage(streetlightImg, x + streetOffsetX, streetOffsetY - streetH, w, streetH);
            }
        }

        // ガードレール (キャラの手前)
        if (guardrailImg.complete) {
            const spacing = 650;
            let loopX = -((distance * 2.0) % spacing);
            for (let x = loopX; x < CANVAS_WIDTH + spacing; x += spacing) {
                // y=380付近に配置
                ctx.drawImage(guardrailImg, x, 380, 600, 110);
            }
        }
    }

    ctx.restore(); // カメラPANのtranslateをリセット (ここで一旦リセット)

    // ビネットの上にレーザーを描画
    ctx.save();
    ctx.translate(0, sakuya.cameraOffsetY);
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
    ctx.restore();

    // 巨大手裏剣の描画（ビネットの上、HUDの下）
    if (giantShuriken && syurikenImg.complete) {
        ctx.save();
        ctx.translate(giantShuriken.x + giantShuriken.w / 2, giantShuriken.y + giantShuriken.h / 2);
        ctx.rotate(giantShuriken.angle);
        // 発光感
        ctx.shadowBlur = 40;
        ctx.shadowColor = "#ffeb3b";
        ctx.drawImage(syurikenImg, -giantShuriken.w / 2, -giantShuriken.h / 2, giantShuriken.w, giantShuriken.h);
        ctx.restore();
    }

    // トランジション（中間切り替え）の描画
    if (isHalfwayTransitioning) {
        let alpha = 0;
        if (halfwayTransitionTimer < 60) {
            alpha = halfwayTransitionTimer / 60; // フェードアウト（暗転）
        } else if (halfwayTransitionTimer < 120) {
            alpha = 1; // 暗転保持
        } else {
            alpha = 1 - ((halfwayTransitionTimer - 120) / 60); // フェードイン（明ける）
        }
        
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.restore();
    }

    // Streetlight_front.png (一番手前、レーザー・手裏剣・トランジションよりも手前)
    // エリア1のみ、暗転中も維持
    // ただしカメラ追従(sakuya.cameraOffsetY)は適用して揺れを同期させる
    if (!isSecondScene && typeof streetlightFrontImg !== 'undefined' && streetlightFrontImg.complete) {
        ctx.save();
        ctx.translate(0, sakuya.cameraOffsetY);
        
        // --- ここで一番手前の Streetlight_front.png のサイズと位置を調整します ---
        const fgStreetH = 800;             // 一番手前の街灯の高さ
        const fgStreetOffsetX = -100;      // X座標のズレ
        const fgStreetOffsetY = CANVAS_HEIGHT + 140; // 画面下端を突き抜けるように配置
        const fgScrollSpeed = 3.5;         // スクロール速度（奥は 2.0）
        // ------------------------------------------------------------------
        
        const fgLightSpacing = 5000; // 手前は間隔も広めに設定
        let fgLightLoopX = -((distance * fgScrollSpeed) % fgLightSpacing);
        
        for (let x = fgLightLoopX; x < CANVAS_WIDTH + fgLightSpacing; x += fgLightSpacing) {
            const w = (fgStreetH / streetlightFrontImg.height) * streetlightFrontImg.width;
            ctx.drawImage(streetlightFrontImg, x + fgStreetOffsetX, fgStreetOffsetY - fgStreetH, w, fgStreetH);
        }
        ctx.restore();
    }

    // HP オーブ更新
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

/**
 * --- OP (Opening Event) Player ---
 */
function drawOP() {
    if (!opConfig) return;
    const comp = opConfig.assets.find(a => a.id === "comp_1");
    if (!comp) return;

    // 背景画像 (縦横比を維持してスクロール)
    if (bgImg.complete) {
        const opBgH = CANVAS_HEIGHT + 100;
        const opBgW = (opBgH / bgImg.height) * bgImg.width; // 縦横比を維持した幅
        const scrollSpeed = 800; // スクロール速度
        const loopX = -((opTime * scrollSpeed) % opBgW);
        const offsetY = -50; // プレイ時と同じオフセット

        ctx.drawImage(bgImg, loopX, offsetY, opBgW, opBgH);
        ctx.drawImage(bgImg, loopX + opBgW, offsetY, opBgW, opBgH);
    } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // レイヤーの重なり順を考慮して、配列を逆順（背面から）に描画
    const layers = [...comp.layers].reverse();

    layers.forEach(layer => {
        if (layer.visible === false) return;
        if (opTime < layer.inPoint || opTime > layer.outPoint) return;

        ctx.save();
        
        // 階層構造（親子関係）の座標変換を適用
        applyHierarchyTransforms(layer, comp, opTime);

        const opacity = getOpTrackValue(layer.tracks.opacity, opTime, 100) / 100;
        ctx.globalAlpha *= opacity; // 親のアルファがあれば継承（簡易）

        if (layer.blendMode && layer.blendMode !== 'source-over') {
            ctx.globalCompositeOperation = layer.blendMode;
        }

        if (layer.type === 'text') {
            const typewriter = getOpTrackValue(layer.tracks.typewriter, opTime, 100);
            const textToShow = layer.text.substring(0, Math.floor(layer.text.length * (typewriter / 100)));
            ctx.font = `bold ${layer.fontSize}px ${layer.fontFamily}`;
            ctx.fillStyle = layer.color;
            ctx.textAlign = "left"; // 左揃えに変更
            ctx.textBaseline = "middle";
            
            // 左揃えの場合、中央配置(500)ならテキスト幅の半分程度左から開始させる調整が必要な場合があるが、
            // ユーザー指定の「左位置固定」を優先し、アンカーポイントを左端にする。
            // もし中央寄せに見せたい場合は、ここで measureText を使ってオフセットする。
            // ここでは一旦シンプルに left 描画にする。
            const metrics = ctx.measureText(layer.text);
            const xOffset = -metrics.width / 2; 

            if (layer.strokeWidth > 0) {
                ctx.strokeStyle = layer.strokeColor;
                ctx.lineWidth = layer.strokeWidth;
                ctx.strokeText(textToShow, xOffset, 0);
            }
            ctx.fillText(textToShow, xOffset, 0);
        } else if (layer.type === 'animated_layer') {
            const animAsset = opConfig.assets.find(a => a.id === layer.animAssetId);
            if (animAsset && (layer.imgObj && layer.imgObj.complete)) {
                const animData = animAsset.data[layer.animId];
                const elapsedSinceStart = opTime - layer.startTime;
                const frameIdx = Math.floor(Math.max(0, elapsedSinceStart * animData.fps)) % animData.frames.length;
                const frame = animData.frames[frameIdx];
                ctx.drawImage(layer.imgObj, frame.x, frame.y, frame.w, frame.h, -frame.w/2, -frame.h/2, frame.w, frame.h);
            }
        } else if (layer.type === 'solid') {
            ctx.fillStyle = layer.color;
            // 円形や親子関係がある場合は 100x100 を基準サイズとする（エディタの仕様に合わせる）
            // 親がなく矩形の場合はコンポジションサイズ（暗転用）とする
            const isSmallShape = layer.shape === 'circle' || layer.parent;
            const w = layer.width || (isSmallShape ? 100 : comp.width);
            const h = layer.height || (isSmallShape ? 100 : comp.height);

            if (layer.shape === 'circle') {
                ctx.beginPath();
                ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
                ctx.fill();
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
    // 親があれば先に適用（再帰）
    if (layer.parent) {
        const parentLayer = comp.layers.find(l => l.id === layer.parent);
        if (parentLayer) {
            applyHierarchyTransforms(parentLayer, comp, time);
        }
    }

    const pos = getOpTrackValue(layer.tracks.position, time, {x:500, y:300});
    const scale = getOpTrackValue(layer.tracks.scale, time, {x:100, y:100});
    const rotation = getOpTrackValue(layer.tracks.rotation, time, 0) * (Math.PI / 180);

    ctx.translate(pos.x, pos.y);
    ctx.rotate(rotation);
    ctx.scale(scale.x / 100, scale.y / 100);
}

function getOpTrackValue(track, time, def) {
    if (!track || !track.keys || track.keys.length === 0) {
        return (track && track.initialValue !== undefined) ? track.initialValue : def;
    }
    const keys = track.keys;
    let nextIdx = keys.findIndex(k => k.time > time);
    if (nextIdx === -1) return keys[keys.length - 1].value;
    if (nextIdx === 0) return keys[0].value;

    const prev = keys[nextIdx - 1];
    const next = keys[nextIdx];

    // 停止（Hold）キーフレームの処理
    if (prev.interpolation === "Hold") {
        return prev.value;
    }

    let ratio = (time - prev.time) / (next.time - prev.time);

    // イージングの処理
    if (prev.easeOut && next.easeIn) {
        // Ease In Out (Smoothstep)
        ratio = ratio * ratio * (3 - 2 * ratio);
    } else if (next.easeIn) {
        // 到着時に減速 (Ease In)
        ratio = 1 - (1 - ratio) * (1 - ratio);
    } else if (prev.easeOut) {
        // 出発時に加速 (Ease Out)
        ratio = ratio * ratio;
    }

    if (typeof prev.value === 'number') {
        return prev.value + (next.value - prev.value) * ratio;
    } else if (prev.value && typeof prev.value.x === 'number') {
        return {
            x: prev.value.x + (next.value.x - prev.value.x) * ratio,
            y: prev.value.y + (next.value.y - prev.value.y) * ratio
        };
    }
    return prev.value;
}