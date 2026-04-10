async function openSlot() {
    if (slotActive) return;

    // --- 簡易的なロード中表示の作成 ---
    const loadOverlay = document.createElement('div');
    loadOverlay.id = 'slot-loading-overlay';
    loadOverlay.style.position = 'absolute'; loadOverlay.style.top = '0'; loadOverlay.style.left = '0';
    loadOverlay.style.width = '100%'; loadOverlay.style.height = '100%';
    loadOverlay.style.background = '#000'; loadOverlay.style.display = 'flex';
    loadOverlay.style.justifyContent = 'center'; loadOverlay.style.alignItems = 'center';
    loadOverlay.style.zIndex = '30000'; loadOverlay.style.color = '#fff';
    loadOverlay.style.fontFamily = "'Sawarabi Mincho', serif"; loadOverlay.style.fontSize = '24px';
    loadOverlay.innerText = 'Now Loading...';
    const wrapper = document.getElementById('main-wrapper');
    if (wrapper) wrapper.appendChild(loadOverlay);

    // --- アセットの読み込み待ち ---
    try {
        const loadAssets = [];
        // JSON
        if (!omenConfig) {
            loadAssets.push(fetch('json/omen.json').then(r => r.json()).then(json => { omenConfig = json; }));
        }
        // Images (omenImg, ninjaImgs は slot_data.js で定義済み)
        const checkImg = (img) => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
        };
        loadAssets.push(checkImg(omenImg));
        ninjaImgs.forEach(img => loadAssets.push(checkImg(img)));
        
        // 背景画像
        const bgImg = new Image();
        bgImg.src = 'images/slot/BG_slot.jpg';
        loadAssets.push(checkImg(bgImg));
        
        // メダル画像 (slot_data.js で定義済み)
        loadAssets.push(checkImg(slotMedalImg));

        await Promise.all(loadAssets);
    } catch (e) {
        console.error("Slot assets load error:", e);
    }

    // ロード画面を消す
    if (loadOverlay.parentNode) loadOverlay.parentNode.removeChild(loadOverlay);

    slotActive = true;
    slotParticles = []; 
    winTextAnim.active = false;
    lastSlotFrameTime = 0; 

    loadMedalData();
    
    createSlotDOM();

    if (typeof isSoundOn !== 'undefined' && isSoundOn && typeof bgmSlot !== 'undefined') {
        bgmSlot.currentTime = 0;
        bgmSlot.play().catch(e => console.error("Slot BGM playback failed:", e));
    }
    
    const reelY = SLOT_HEIGHT * 0.39; 
    reels = [
        new Reel(SLOT_WIDTH * 0.32, reelY),
        new Reel(SLOT_WIDTH * 0.50, reelY),
        new Reel(SLOT_WIDTH * 0.68, reelY)
    ];

    slotState = STATE.IDLE;
    isReach = false;

    updateSlotUI();
    requestAnimationFrame(slotLoop);
}

function closeSlot() {
    slotActive = false;
    if (slotReqId) cancelAnimationFrame(slotReqId);
    if (slotOverlay && slotOverlay.parentNode) {
        slotOverlay.parentNode.removeChild(slotOverlay);
    }
    slotOverlay = null;
    if (typeof bgmSlot !== 'undefined') bgmSlot.pause();
    if(typeof window.updateBtnRects === 'function') window.updateBtnRects();
}

function handleStartNext() {
    if (slotState === STATE.IDLE) startSlot();
    else if (slotState === STATE.PAYOUT) nextGame();
}

function startSlot() {
    if (slotState !== STATE.IDLE || targetMedals < currentBet) return;
    targetMedals -= currentBet;
    medals -= currentBet;
    saveMedalData();
    playSE('slot_start');
    slotState = STATE.SPINNING;
    isReach = false;
    reels.forEach((r, i) => {
        setTimeout(() => {
            if (slotState === STATE.SPINNING) {
                r.startSpin();
                updateSlotUI(); 
            }
        }, i * 150); 
    });
    playSE('shuriken', 0.8);
    updateSlotUI();
}

function nextGame() {
    if (slotState !== STATE.PAYOUT) return;
    if (winTextAnim.active || medals < targetMedals) {
        winTextAnim.active = false;
        medals = targetMedals;
        saveMedalData();
        updateSlotUI();
        playSE('sausage_get', 0.5);
    } else {
        if (currentBet > targetMedals) currentBet = Math.max(1, targetMedals);
        slotState = STATE.IDLE;
        updateSlotUI();
    }
}

function stopReel(index) {
    if (slotState !== STATE.SPINNING || !reels[index].isSpinning || reels[index].isStopping) return;
    reels[index].stopSpin();
    playSE('slot_stop', 1.3); // 音量をアップ
    updateSlotUI();
}

function checkReels() {
    const spinningReels = reels.filter(r => r.isSpinning || r.isStopping);
    if (spinningReels.length === 1) {
        const stoppedReels = reels.filter(r => !r.isSpinning);
        if (stoppedReels.length === 2 && stoppedReels[0].resultSymbol === stoppedReels[1].resultSymbol) {
            if (!isReach) {
                isReach = true;
                const symbolType = stoppedReels[0].resultSymbol;
                const rate = PAYOUT_RATES[symbolType] || 2;
                let slowSpeed = 0.03; 
                if (rate === 5) slowSpeed = 0.045;
                else if (rate === 10) slowSpeed = 0.06;
                spinningReels[0].speed = slowSpeed; 
                playSE('gather_energy', 0.5);
            }
        }
    }
    if (spinningReels.length === 0) {
        slotState = STATE.PAYOUT;
        payoutTime = Date.now();
        isReach = false;
        const s1 = reels[0].resultSymbol;
        const s2 = reels[1].resultSymbol;
        const s3 = reels[2].resultSymbol;
        if (s1 === s2 && s2 === s3) {
            const rate = PAYOUT_RATES[s1] || 0;
            const winAmount = currentBet * rate;
            targetMedals = medals + winAmount;

            let fSize = 72;
            if (rate === 5) fSize = 92;
            else if (rate === 10) fSize = 120;

            winTextAnim = {
                active: true,
                x: SLOT_WIDTH / 2,
                y: reels[0].y + 20,
                targetX: 130, 
                targetY: 45,  
                timer: 0,
                text: `${winAmount}枚GET!!`,
                amount: winAmount,
                baseSize: fSize
            };

                // 従来のパーティクル演出のみに戻す
                if (rate === 10) {
                    if (typeof screenShake !== 'undefined') screenShake = 50;
                    spawnWinParticles(100);
                } else if (rate === 5) {
                    if (typeof screenShake !== 'undefined') screenShake = 20;
                    spawnWinParticles(50);
                } else if (rate > 0) {
                    spawnWinParticles(30);
                }

                if (s1 === OMEN_TYPE.ONI) playSE('roar', 1.0); 
                else playSE('sausage_get', 1.0); 
            } else {
                // ハズレ時の音を削除
            }
            updateSlotUI();
        }
    }

function spawnWinParticles(count) {
    if (typeof slotParticles === 'undefined') slotParticles = [];
    for (let i = 0; i < count; i++) {
        const originX = SLOT_WIDTH / 2;
        const originY = SLOT_HEIGHT / 2;
        const angle = Math.random() * Math.PI * 2;
        const speed = 5 + Math.random() * 15;
        slotParticles.push({
            x: originX, y: originY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            size: 5 + Math.random() * 10,
            color: `hsl(${Math.random() * 40 + 40}, 100%, 60%)`,
            friction: 0.96
        });
    }
}

function slotLoop(timestamp) {
    if (!slotActive) return;
    if (!lastSlotFrameTime) lastSlotFrameTime = timestamp;
    const elapsed = timestamp - lastSlotFrameTime;

    if (elapsed >= 16.67) {
        lastSlotFrameTime = timestamp - (elapsed % 16.67);

        sCtx.clearRect(0, 0, SLOT_WIDTH, SLOT_HEIGHT);

        const isWin = (slotState === STATE.PAYOUT && reels[0].resultSymbol === reels[1].resultSymbol && reels[1].resultSymbol === reels[2].resultSymbol);
        const isGlowing = isWin && winTextAnim.active && winTextAnim.timer < 2.0;

        if (isGlowing) {
            const glowAlpha = 0.2 + Math.sin(Date.now() / 100) * 0.15;
            sCtx.save();
            sCtx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 3; i++) {
                const grad = sCtx.createRadialGradient(reels[i].x, reels[i].y, 0, reels[i].x, reels[i].y, 120);
                grad.addColorStop(0, `rgba(255, 255, 200, ${glowAlpha * 2})`);
                grad.addColorStop(1, `rgba(255, 200, 0, 0)`);
                sCtx.fillStyle = grad;
                sCtx.beginPath();
                sCtx.arc(reels[i].x, reels[i].y, 120, 0, Math.PI * 2);
                sCtx.fill();
            }
            sCtx.restore();
        }

        for (let i = 0; i < 3; i++) {
            const img = ninjaImgs[i];
            if (img.complete && img.naturalWidth > 0) {
                const nw = img.naturalWidth;
                const nh = img.naturalHeight;
                sCtx.save();
                if (isGlowing) {
                    sCtx.shadowBlur = 30; sCtx.shadowColor = "#fff";
                }
                sCtx.drawImage(img, reels[i].x - nw / 2, reels[i].y - nh / 4.8 - 15, nw, nh);
                sCtx.restore();
            }
        }

        sCtx.save();
        sCtx.beginPath();
        sCtx.rect(50, reels[0].y - 130, SLOT_WIDTH - 100, 280);
        sCtx.clip();
        reels.forEach(r => {
            r.update();
            r.draw(sCtx);
        });
        sCtx.restore();

        if (slotParticles.length > 0) {
            sCtx.save();
            sCtx.globalCompositeOperation = 'lighter';
            for (let i = slotParticles.length - 1; i >= 0; i--) {
                const p = slotParticles[i];
                p.vx *= p.friction; p.vy *= p.friction;
                p.x += p.vx; p.y += p.vy;
                p.life -= 0.015;
                if (p.life <= 0) { slotParticles.splice(i, 1); continue; }
                sCtx.globalAlpha = p.life;
                sCtx.fillStyle = p.color;
                sCtx.beginPath(); sCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2); sCtx.fill();
                sCtx.shadowBlur = 15; sCtx.shadowColor = p.color;
            }
            sCtx.restore();
        }

        if (winTextAnim.active) {
            winTextAnim.timer += 0.016; 
            let currentX = winTextAnim.x;
            let currentY = winTextAnim.y;
            let scale = 1.0;
            let fontSize = winTextAnim.baseSize || 72;

            if (winTextAnim.timer < 2.0) {
                const bounceDuration = 0.4;
                const t = winTextAnim.timer / bounceDuration;
                if (t < 1.0) {
                    if (t < 0.7) scale = (t / 0.7) * 1.1;
                    else scale = 1.1 - ((t - 0.7) / 0.3) * 0.1;
                } else scale = 1.0;
            } else {
                const moveT = (winTextAnim.timer - 2.0) / 0.4; 
                if (moveT >= 1.0) {
                    winTextAnim.active = false;
                } else {
                    const easedT = moveT * moveT; 
                    currentX = winTextAnim.x + (winTextAnim.targetX - winTextAnim.x) * easedT;
                    currentY = winTextAnim.y + (winTextAnim.targetY - winTextAnim.y) * easedT;
                    scale = 1.0 - easedT * 0.5; 
                }
            }
            
            if (winTextAnim.active) {
                sCtx.save();
                sCtx.translate(currentX, currentY);
                sCtx.scale(scale, scale);
                sCtx.font = `900 ${fontSize}px 'Sawarabi Mincho', serif`;
                sCtx.textAlign = "center";
                sCtx.textBaseline = "middle";
                const shadowX = 4; const shadowY = 4;
                sCtx.lineWidth = 10; sCtx.strokeStyle = "rgba(0,0,0,0.5)"; 
                sCtx.strokeText(winTextAnim.text, shadowX, shadowY);
                const grad = sCtx.createLinearGradient(0, -fontSize/2, 0, fontSize/2);
                grad.addColorStop(0, "#fff"); grad.addColorStop(0.5, "#ffeb3b"); grad.addColorStop(1, "#fbc02d");
                sCtx.lineWidth = 10; sCtx.strokeStyle = "#4a2a1a"; sCtx.strokeText(winTextAnim.text, 0, 0);
                sCtx.fillStyle = grad; sCtx.fillText(winTextAnim.text, 0, 0);
                sCtx.restore();
            }
        }

        if (slotState === STATE.PAYOUT && !winTextAnim.active && medals < targetMedals) {
            const addAmount = Math.max(1, Math.ceil((targetMedals - medals) / 10));
            medals += addAmount;
            if (medals >= targetMedals) {
                medals = targetMedals;
                playSE('sausage_get', 0.8);
            } else if (medals % 2 === 0) {
                playSE('jump1', 0.1); 
            }
            saveMedalData();
            updateSlotUI();
        }

        if (isReach && slotState === STATE.SPINNING) {
            const reachScale = 1.0 + Math.sin(Date.now() / 200) * 0.05;
            sCtx.save();
            sCtx.translate(SLOT_WIDTH / 2, 450); 
            sCtx.scale(reachScale, reachScale);
            sCtx.font = "900 52px 'Sawarabi Mincho', serif";
            sCtx.textAlign = "center"; sCtx.textBaseline = "middle";
            const sX = 3; const sY = 3;
            sCtx.lineWidth = 8; sCtx.strokeStyle = "rgba(0,0,0,0.4)";
            sCtx.strokeText("REACH!!", sX, sY);
            const reachGrad = sCtx.createLinearGradient(0, -25, 0, 25);
            reachGrad.addColorStop(0, "#fff"); reachGrad.addColorStop(0.5, "#ff5e5e"); reachGrad.addColorStop(1, "#d32f2f");
            sCtx.lineWidth = 8; sCtx.strokeStyle = "#2e1a1a";
            sCtx.strokeText("REACH!!", 0, 0);
            sCtx.fillStyle = reachGrad; sCtx.fillText("REACH!!", 0, 0);
            sCtx.restore();
        }
    }
    slotReqId = requestAnimationFrame(slotLoop);
}