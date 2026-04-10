function createModalBtn(text, id, callback, width = '150px') {
    const wrap = document.createElement('div');
    wrap.className = 'modal-btn-wrap';
    wrap.id = id + '-wrap';
    const btn = document.createElement('button');
    btn.id = id; btn.className = 'modal-btn';
    btn.style.width = width; btn.style.height = '50px'; btn.style.padding = '2px';
    addBtnListener(btn, callback);
    const inner = document.createElement('span');
    inner.id = id + '-inner'; inner.className = 'modal-btn-inner';
    inner.innerText = text; inner.style.fontSize = '20px'; inner.style.letterSpacing = '2px';
    btn.appendChild(inner); wrap.appendChild(btn);
    return wrap;
}

function createSlotDOM() {
    slotOverlay = document.createElement('div');
    slotOverlay.id = 'slot-overlay';
    slotOverlay.style.position = 'absolute';
    slotOverlay.style.top = '0';
    slotOverlay.style.left = '0';
    slotOverlay.style.width = '100%';
    slotOverlay.style.height = '100%';
    slotOverlay.style.background = '#111';
    slotOverlay.style.display = 'flex';
    slotOverlay.style.justifyContent = 'center';
    slotOverlay.style.alignItems = 'center';
    slotOverlay.style.zIndex = '10000'; // スロットのベース
    slotOverlay.style.pointerEvents = 'auto';

    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.width = SLOT_WIDTH + 'px';
    container.style.height = SLOT_HEIGHT + 'px';
    container.style.background = 'url("images/slot/BG_slot.jpg") center/cover no-repeat';
    container.style.overflow = 'hidden';
    container.style.pointerEvents = 'auto';
    container.style.zIndex = '1';

    slotCanvas = document.createElement('canvas');
    slotCanvas.width = SLOT_WIDTH;
    slotCanvas.height = SLOT_HEIGHT;
    slotCanvas.style.position = 'absolute';
    slotCanvas.style.top = '0';
    slotCanvas.style.left = '0';
    slotCanvas.style.zIndex = '5'; 
    slotCanvas.style.pointerEvents = 'none'; 
    sCtx = slotCanvas.getContext('2d');

    const applyZabutonStyle = (el) => {
        el.style.background = '#2a2a2a';
        el.style.border = '3px solid #8c6e5e';
        el.style.boxShadow = 'inset 0 0 0 2px #111, 0 4px 10px rgba(0,0,0,0.5)';
        el.style.padding = '5px 15px';
        el.style.zIndex = '20';
        ['m-tp-l', 'm-tp-r', 'm-bt-l', 'm-bt-r'].forEach(cls => {
            const c = document.createElement('div');
            c.className = `modal-corner ${cls}`;
            el.appendChild(c);
        });
    };

    const medalInfo = document.createElement('div');
    medalInfo.style.position = 'absolute';
    medalInfo.style.top = '20px';
    medalInfo.style.left = '30px';
    medalInfo.style.textAlign = 'left';
    medalInfo.style.fontFamily = "'Sawarabi Mincho', serif";
    medalInfo.style.textShadow = '2px 2px 4px #000';
    applyZabutonStyle(medalInfo);

    const medalText = document.createElement('div');
    medalText.id = 'slot-medal-text';
    medalText.style.color = '#fff';
    medalText.style.fontSize = '24px';
    medalText.style.fontWeight = 'bold';
    medalText.style.position = 'relative';
    medalText.style.zIndex = '25';
    medalInfo.appendChild(medalText);

    const maxWrap = document.createElement('div');
    maxWrap.style.position = 'absolute';
    maxWrap.style.top = '20px';
    maxWrap.style.right = '30px';
    maxWrap.style.fontFamily = "'Sawarabi Mincho', serif";
    maxWrap.style.textShadow = '2px 2px 4px #000';
    applyZabutonStyle(maxWrap);

    const maxText = document.createElement('div');
    maxText.id = 'slot-max-text';
    maxText.style.color = '#fff';
    maxText.style.fontSize = '24px';
    maxText.style.position = 'relative';
    maxText.style.zIndex = '25';
    maxWrap.appendChild(maxText);

    const betContainer = document.createElement('div');
    betContainer.id = 'slot-bet-container';
    betContainer.style.position = 'absolute';
    betContainer.style.right = '105px'; // 15px右に移動 (120 -> 105)
    betContainer.style.top = '50%';
    betContainer.style.transform = 'translateY(-50%)';
    betContainer.style.display = 'flex';
    betContainer.style.flexDirection = 'column';
    betContainer.style.alignItems = 'center';
    betContainer.style.gap = '15px';
    betContainer.style.zIndex = '20';

    const btnBetUp = document.createElement('div');
    btnBetUp.id = 'btn-bet-up';
    btnBetUp.className = 'v-btn';
    btnBetUp.innerText = '▲';
    btnBetUp.style.width = '55px';
    btnBetUp.style.height = '55px';
    btnBetUp.style.fontSize = '24px';
    addBtnListener(btnBetUp, () => changeBet(1));

    const betDisplay = document.createElement('div');
    betDisplay.id = 'slot-bet-display';
    betDisplay.style.color = '#fbc02d';
    betDisplay.style.fontSize = '32px';
    betDisplay.style.fontFamily = "'Sawarabi Mincho', serif";
    betDisplay.style.fontWeight = 'bold';
    betDisplay.style.textShadow = '2px 2px 4px #000';
    betDisplay.style.width = '80px';
    betDisplay.style.textAlign = 'center';

    const btnBetDown = document.createElement('div');
    btnBetDown.id = 'btn-bet-down';
    btnBetDown.className = 'v-btn';
    btnBetDown.innerText = '▼';
    btnBetDown.style.width = '55px';
    btnBetDown.style.height = '55px';
    btnBetDown.style.fontSize = '24px';
    addBtnListener(btnBetDown, () => changeBet(-1));

    betContainer.appendChild(btnBetUp);
    betContainer.appendChild(betDisplay);
    betContainer.appendChild(btnBetDown);

    const stopContainer = document.createElement('div');
    stopContainer.id = 'slot-stop-container';
    stopContainer.style.position = 'absolute';
    stopContainer.style.top = '480px'; 
    stopContainer.style.left = '50%';
    stopContainer.style.transform = 'translateX(-50%)';
    stopContainer.style.width = '420px'; 
    stopContainer.style.display = 'flex';
    stopContainer.style.justifyContent = 'space-between';
    stopContainer.style.pointerEvents = 'none';
    stopContainer.style.zIndex = '20';

    for (let i = 0; i < 3; i++) {
        const sBtn = document.createElement('div');
        sBtn.id = `btn-stop-${i}`;
        sBtn.className = 'v-btn';
        sBtn.innerText = '止';
        sBtn.style.width = '60px';
        sBtn.style.height = '60px';
        sBtn.style.fontSize = '24px';
        sBtn.style.pointerEvents = 'auto';
        addBtnListener(sBtn, () => stopReel(i));
        stopContainer.appendChild(sBtn);
    }

    const startContainer = document.createElement('div');
    startContainer.style.position = 'absolute';
    startContainer.style.bottom = '60px'; 
    startContainer.style.right = '30px'; 
    startContainer.style.zIndex = '20';
    const btnStart = createModalBtn('スタート', 'btn-slot-start', handleStartNext, '200px');
    startContainer.appendChild(btnStart);

    const btnSettings = document.createElement('div');
    btnSettings.className = 'v-btn settings-btn';
    btnSettings.innerText = '⚙️';
    btnSettings.style.position = 'absolute';
    btnSettings.style.bottom = '60px';
    btnSettings.style.left = '30px';
    btnSettings.style.margin = '0';
    btnSettings.style.zIndex = '20';
    btnSettings.style.pointerEvents = 'auto';
    addBtnListener(btnSettings, () => toggleSettings());

    const btnHelp = document.createElement('div');
    btnHelp.className = 'v-btn settings-btn';
    btnHelp.innerText = '？';
    btnHelp.style.position = 'absolute';
    btnHelp.style.bottom = '60px';
    btnHelp.style.left = '95px';
    btnHelp.style.margin = '0';
    btnHelp.style.fontSize = '20px';
    btnHelp.style.zIndex = '20';
    btnHelp.style.pointerEvents = 'auto';
    addBtnListener(btnHelp, () => showSlotHelp());

    const betMedalsContainer = document.createElement('div');
    betMedalsContainer.id = 'slot-bet-medals-container';
    betMedalsContainer.style.position = 'absolute';
    betMedalsContainer.style.bottom = '165px'; // さらに30pxアップ
    betMedalsContainer.style.left = '60px'; 
    betMedalsContainer.style.pointerEvents = 'none';
    betMedalsContainer.style.zIndex = '15';
    container.appendChild(betMedalsContainer);

    const originalBackToTitle = window.backToTitle;
    window.backToTitle = function() {
        closeSlot();
        if (originalBackToTitle) originalBackToTitle();
    };

    container.appendChild(slotCanvas);
    container.appendChild(medalInfo);
    container.appendChild(maxWrap);
    container.appendChild(betContainer);
    container.appendChild(stopContainer);
    container.appendChild(startContainer);
    container.appendChild(btnSettings);
    container.appendChild(btnHelp);
    slotOverlay.appendChild(container);

    const wrapper = document.getElementById('main-wrapper');
    if (wrapper) {
        // modal-overlay または settings-overlay がある場合、それらの前に挿入して背後に回す
        const ref = document.getElementById('modal-overlay') || document.getElementById('settings-overlay');
        if (ref) {
            wrapper.insertBefore(slotOverlay, ref);
        } else {
            wrapper.appendChild(slotOverlay);
        }
    } else {
        document.body.appendChild(slotOverlay);
    }
}

function showSlotHelp() {
    if (document.getElementById('slot-help-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'slot-help-overlay';
    overlay.style.position = 'absolute'; overlay.style.top = '0'; overlay.style.left = '0';
    overlay.style.width = '100%'; overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.85)'; overlay.style.display = 'flex'; 
    overlay.style.justifyContent = 'center'; overlay.style.alignItems = 'center';
    overlay.style.zIndex = '6000'; overlay.style.pointerEvents = 'auto';

    const windowEl = document.createElement('div');
    windowEl.style.position = 'relative'; windowEl.style.width = '920px'; 
    windowEl.style.background = 'radial-gradient(circle, #4a4a4a 0%, #222 100%)';
    windowEl.style.border = '4px solid #8c6e5e'; windowEl.style.boxShadow = 'inset 0 0 0 3px #111, 0 20px 60px rgba(0,0,0,0.9)';
    windowEl.style.padding = '20px 15px'; windowEl.style.textAlign = 'center';
    windowEl.style.fontFamily = "'Sawarabi Mincho', serif"; windowEl.style.color = '#fff'; windowEl.style.overflow = 'hidden';

    ['m-tp-l', 'm-tp-r', 'm-bt-l', 'm-bt-r'].forEach(cls => {
        const c = document.createElement('div'); c.className = `modal-corner ${cls}`; windowEl.appendChild(c);
    });

    // --- 追加: 遊び方の基本説明文 ---
    const topMsg = document.createElement('div');
    topMsg.style.fontSize = '20px';
    topMsg.style.marginBottom = '20px';
    topMsg.style.color = '#ffebad';
    topMsg.style.textShadow = '2px 2px 4px #000';
    topMsg.innerText = '使うメダルの枚数を決めてスロットをスタート。同じお面が3つ揃ったらメダルがもらえるぞ。';
    windowEl.appendChild(topMsg);

    const groups = [
        { rate: 10, indices: [OMEN_TYPE.ONI], cols: 1 },
        { rate: 5, indices: [OMEN_TYPE.KITUNE, OMEN_TYPE.DAN], cols: 2 },
        { rate: 3, indices: [OMEN_TYPE.TENGU, OMEN_TYPE.JEI, OMEN_TYPE.SENTAI], cols: 3 },
        { rate: 2, indices: [OMEN_TYPE.OKAME, OMEN_TYPE.HYO, OMEN_TYPE.KAMEN], cols: 3 }
    ];

    const keys = ["oni", "kitune", "dan", "tengu", "jei", "sentai", "okame", "hyo", "kamen"];

    groups.forEach(group => {
        const groupContainer = document.createElement('div');
        groupContainer.style.display = 'grid'; groupContainer.style.gridTemplateColumns = `repeat(${group.cols}, 1fr)`;
        groupContainer.style.gap = '8px'; groupContainer.style.marginBottom = '12px'; groupContainer.style.width = '100%';

        group.indices.forEach(index => {
            const key = keys[index];
            const row = document.createElement('div');
            row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.justifyContent = 'center';
            row.style.background = 'rgba(255,255,255,0.05)'; row.style.padding = '6px'; row.style.borderRadius = '4px';

            const iconsWrapper = document.createElement('div');
            iconsWrapper.style.display = 'flex'; iconsWrapper.style.gap = '3px';

            for (let i = 0; i < 3; i++) {
                const icon = document.createElement('div');
                icon.style.width = '50px'; icon.style.height = '50px';
                if (omenConfig && omenConfig.data[key]) {
                    const frame = omenConfig.data[key].frames[0];
                    icon.style.backgroundImage = 'url("images/Sprite/omen.png")';
                    const scale = 50 / frame.w;
                    icon.style.backgroundSize = `${omenImg.naturalWidth * scale}px ${omenImg.naturalHeight * scale}px`;
                    icon.style.backgroundPosition = `-${frame.x * scale}px -${frame.y * scale}px`;
                }
                iconsWrapper.appendChild(icon);
            }
            row.appendChild(iconsWrapper);

            const payoutText = document.createElement('div');
            payoutText.innerText = ` × ${group.rate}`; payoutText.style.fontSize = '24px';
            payoutText.style.marginLeft = '15px'; payoutText.style.color = '#fbc02d';
            payoutText.style.fontWeight = 'bold'; payoutText.style.width = '60px'; payoutText.style.textAlign = 'left';
            row.appendChild(payoutText);

            groupContainer.appendChild(row);
        });
        windowEl.appendChild(groupContainer);
    });

    const info = document.createElement('div');
    info.style.fontSize = '17px'; info.style.lineHeight = '1.3'; info.style.background = 'rgba(0,0,0,0.3)';
    info.style.padding = '10px'; info.style.borderRadius = '5px'; info.style.marginTop = '0px'; info.style.marginBottom = '15px';
    info.innerText = '【メダル補充】毎日0時にメダルが50枚まで自動補充されます。';
    windowEl.appendChild(info);

    const closeBtnWrap = createModalBtn('閉じる', 'btn-help-close', () => { overlay.remove(); }, '180px');
    windowEl.appendChild(closeBtnWrap);

    overlay.appendChild(windowEl); slotOverlay.appendChild(overlay);
}

function updateSlotUI() {
    if (!slotActive) return;
    
    const elMedal = document.getElementById('slot-medal-text');
    if (elMedal) elMedal.innerText = `メダル: ${medals}`;
    const elMax = document.getElementById('slot-max-text');
    if (elMax) elMax.innerText = `ベスト: ${maxMedals}`;
    const elBet = document.getElementById('slot-bet-display');
    if (elBet) elBet.innerText = currentBet + '枚';

    const medalCont = document.getElementById('slot-bet-medals-container');
    if (medalCont) {
        if (slotState === STATE.PAYOUT) {
            if (medalCont.style.display !== 'none') medalCont.style.display = 'none';
        } else {
            if (medalCont.style.display !== 'block') medalCont.style.display = 'block';
            // 枚数が変わった時だけ中身を再構築する（点滅防止）
            if (medalCont.childElementCount !== currentBet) {
                medalCont.innerHTML = '';
                const stackLimit = currentBet;
                for (let i = 0; i < stackLimit; i++) {
                    const img = document.createElement('img');
                    img.src = 'images/slot/medal.png';
                    img.style.position = 'absolute';
                    img.style.bottom = (i * 15) + 'px';
                    img.style.left = '0';
                    img.style.width = '120px';
                    medalCont.appendChild(img);
                }
            }
        }
    }

    const btnDown = document.getElementById('btn-bet-down');
    const btnUp = document.getElementById('btn-bet-up');
    const wrapStart = document.getElementById('btn-slot-start-wrap');
    const innerStart = document.getElementById('btn-slot-start-inner');
    const betCont = document.getElementById('slot-bet-container');
    const stopCont = document.getElementById('slot-stop-container');

    // 演出（カウントアップ等）が完全に終了しているかどうかのフラグ
    const isAnimationFinished = (medals >= targetMedals && !winTextAnim.active);

    if (slotState === STATE.IDLE) {
        if (innerStart) {
            innerStart.innerText = 'スタート';
            innerStart.style.background = 'linear-gradient(to bottom, #ffebad, #f7d478)';
        }
        if (btnDown) btnDown.style.opacity = currentBet > 1 ? '1' : '0.5';
        if (btnUp) btnUp.style.opacity = currentBet < 10 && currentBet < targetMedals ? '1' : '0.5';
        if (wrapStart) wrapStart.style.opacity = targetMedals >= currentBet ? '1' : '0.5';
        
        // IDLE時は確実にBET UIとSTOP UIを表示（STOP UIのボタン自体の活性化は後述のループで管理）
        if (betCont) betCont.style.display = 'flex';
        if (stopCont) stopCont.style.display = 'flex';

    } else if (slotState === STATE.PAYOUT) {
        if (innerStart) {
            innerStart.innerText = '次へ';
            innerStart.style.background = 'linear-gradient(to bottom, #9fe65e, #cff466)';
        }
        if (btnDown) btnDown.style.opacity = '0.5';
        if (btnUp) btnUp.style.opacity = '0.5';
        
        // アニメーションが完全に終わっていれば100%の不透明度、そうでなければ少し半透明など（任意）
        if (wrapStart) wrapStart.style.opacity = isAnimationFinished ? '1' : '0.8';
        
        // PAYOUT結果表示中はBET操作もSTOP操作もさせないため非表示
        if (betCont) betCont.style.display = 'none';
        if (stopCont) stopCont.style.display = 'none';

    } else {
        // SPINNING(回転中) または STOPPING(停止処理中)
        if (btnDown) btnDown.style.opacity = '0.5';
        if (btnUp) btnUp.style.opacity = '0.5';
        if (wrapStart) wrapStart.style.opacity = '0.5';
        
        // 回転中はBET操作は非表示（または薄く表示）にし、STOP UIは確実に表示する
        if (betCont) betCont.style.display = 'none'; 
        if (stopCont) stopCont.style.display = 'flex';
    }

    // 止めるボタン（3つ）の活性・非活性管理
    for (let i = 0; i < 3; i++) {
        const sBtn = document.getElementById(`btn-stop-${i}`);
        if (sBtn) {
            // 現在が回転中であり、かつ対象のリールがまだ回っていて止まろうとしていない場合のみ活性化
            if (slotState === STATE.SPINNING && reels[i].isSpinning && !reels[i].isStopping) {
                sBtn.classList.remove('disabled');
                sBtn.style.opacity = '1';
                sBtn.style.color = '#fff';
            } else {
                sBtn.classList.add('disabled');
                sBtn.style.opacity = '0.5';
                sBtn.style.color = '#888';
            }
        }
    }
}

function changeBet(amount) {
    if (slotState !== STATE.IDLE) return;
    currentBet += amount;
    if (currentBet < 1) currentBet = 1;
    if (currentBet > 10) currentBet = 10;
    if (currentBet > medals) currentBet = Math.max(1, medals);
    playSE('puni', 0.5);
    updateSlotUI();
}