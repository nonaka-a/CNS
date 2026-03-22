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
    ctx.beginPath();
    ctx.ellipse(sakuya.x + sakuya.w / 2, sakuya.groundY, sakuya.w * 0.35, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 敵影
    enemies.forEach(e => {
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.groundY, e.w * 0.35, 6, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    // ミタマ影 (リリース時のみ)
    if (!mitama.isHolding && mitama.groundY) {
        ctx.beginPath();
        ctx.ellipse(mitama.x + mitama.w / 2, mitama.groundY, mitama.w * 0.4, 6, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = '#00f2fe';
    bullets.forEach(b => {
        if (syurikenImg.complete) {
            ctx.save();
            ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
            ctx.rotate(b.angle);
            ctx.drawImage(syurikenImg, -b.w / 2, -b.h / 2, b.w, b.h);
            ctx.restore();
        } else {
            // Fallback to blue square if image not loaded
            ctx.fillRect(b.x, b.y, b.w, b.h);
        }
    });



    // 奥行き(groundY)による描画順のソート（Zソート）
    const renderQueue = [];
    enemies.forEach(e => renderQueue.push({ type: 'enemy', depth: e.groundY, obj: e }));
    // ミタマ（ホールド中は常にサクヤの後ろ）
    renderQueue.push({ type: 'mitama', depth: (!mitama.isHolding && mitama.groundY) ? mitama.groundY : sakuya.groundY - 1 });
    renderQueue.push({ type: 'sakuya', depth: sakuya.groundY });

    // 奥(画面上部)から手前へソート
    renderQueue.sort((a, b) => a.depth - b.depth);

    renderQueue.forEach(item => {
        if (item.type === 'enemy') {
            const e = item.obj;
            if (droneImg.complete) {
                ctx.drawImage(droneImg, e.x, e.y, e.w, e.h);
            } else {
                // 画像未ロード時のフォールバック
                ctx.fillStyle = '#ff4444';
                ctx.beginPath();
                ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w / 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (item.type === 'mitama') {
            if (mitama.img.complete) {
                if (!mitama.invincibleTimer || Math.floor(mitama.invincibleTimer / 4) % 2 === 0) {
                    ctx.drawImage(mitama.img, mitama.x, mitama.y, mitama.w, mitama.h);
                }
            }
        } else if (item.type === 'sakuya') {
            ctx.save();
            if (sakuya.img.complete) {
                if (!sakuya.invincibleTimer || Math.floor(sakuya.invincibleTimer / 4) % 2 === 0) {
                    if (sakuyaConfig) {
                        const anim = sakuyaConfig.data[sakuya.currentAnim];
                        const frame = anim.frames[sakuya.currentFrame];
                        ctx.drawImage(
                            sakuya.img,
                            frame.x, frame.y, frame.w, frame.h,
                            sakuya.x, sakuya.y, sakuya.w, sakuya.h
                        );
                    } else {
                        ctx.drawImage(sakuya.img, sakuya.x, sakuya.y, sakuya.w, sakuya.h);
                    }
                }
            }
            ctx.restore();
        }
    });

    // レーザーのビーム描画 (予告線と太いレーザーを最前面に描画)
    enemyLasers.forEach(l => {
        ctx.save();
        ctx.translate(l.startX, l.startY);
        ctx.rotate(l.angle);
        
        if (l.telegraphDuration > 0) {
            // 発射前の予告線 (点線、かつ点滅)
            if (Math.floor(l.telegraphDuration / 4) % 2 === 0) {
                ctx.lineCap = 'butt';
                ctx.strokeStyle = 'rgba(255, 20, 147, 0.8)';
                ctx.lineWidth = 2;
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
            
            ctx.strokeStyle = 'rgba(255, 20, 147, 0.8)'; // 鮮やかな赤ピンク
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(2000, 0); // 端まで繋がる
            ctx.stroke();
            
            // 芯の白を入れるとレーザー感が増す
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = w * 0.4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(2000, 0);
            ctx.stroke();
        }
        
        ctx.restore();
    });

    ctx.restore(); // カメラPANのtranslateをリセット

    // ビネット効果（再び視認できる強さに再調整）
    const vignette = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.15,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.6 // 画面端付近で最大になるように絞る
    );
    vignette.addColorStop(0, 'rgba(10, 15, 40, 0)');
    vignette.addColorStop(0.5, 'rgba(10, 15, 40, 0.35)'); 
    vignette.addColorStop(1, 'rgba(10, 15, 40, 0.8)'); 
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // HP オーブ表示の更新
    updateHPCircles('sakuya-circles', sakuya.hp, 10, 'sakuya');
    updateHPCircles('mitama-circles', mitama.hp, 5, 'mitama');
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