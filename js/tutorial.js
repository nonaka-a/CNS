let tutorialOverlay = null;
let tutorialPage = 1;
let tutorialAnimId = null;
let tutorialTextTimer = 0;
let tutorialTextIdx = 0;
let tutorialVisibleTextIdx = 0; // 実際に表示されているテキストのインデックス
let tutorialFrameIdx = 0;
let tutorialFrameTimer = 0;
let lastTutorialFrameTime = 0; // 追加: FPS固定用のタイマー変数

const TU_TEXTS_PAGE2 = [
    '咲耶は手裏剣を使用して敵を攻撃できます',
    'ミタマは一人で飛んでいると、だんだんと遅れていきます',
    'ミタマが左画面外に出てしまうとゲームオーバー',
    'ミタマの近くで「ミタマボタン」でミタマを抱えることができます',
    '敵の攻撃によるダメージは咲耶、ミタマ両方に入ります'
];

const TU_TEXTS_PAGE3 = [
    'ホールド時、咲耶は手裏剣を使用できません',
    '敵の攻撃によるダメージは咲耶のみに入ります',
    '「ミタマボタン」でミタマをリリースできます'
];

function startTutorial() {
    if (tutorialOverlay) return;
    tutorialPage = 1;
    tutorialTextIdx = 0;
    tutorialVisibleTextIdx = 0;
    tutorialTextTimer = 0;
    tutorialFrameIdx = 0;
    tutorialFrameTimer = 0;
    showTutorialPage();
    
    if (tutorialAnimId) cancelAnimationFrame(tutorialAnimId);
    lastTutorialFrameTime = 0; // タイマーリセット
    requestAnimationFrame(tutorialAnimLoop);
}

function tutorialAnimLoop(timestamp) {
    if (!tutorialOverlay) return;

    if (!lastTutorialFrameTime) lastTutorialFrameTime = timestamp;
    const elapsed = timestamp - lastTutorialFrameTime;

    if (elapsed >= FRAME_INTERVAL) {
        lastTutorialFrameTime = timestamp - (elapsed % FRAME_INTERVAL);

        tutorialFrameTimer++;
        if (tutorialFrameTimer > 6) {
            tutorialFrameIdx = (tutorialFrameIdx + 1) % 4;
            tutorialFrameTimer = 0;
        }
        // 毎フレーム更新して滑らかにする
        updateSprites();

        if (tutorialPage > 1) {
            tutorialTextTimer++;
            if (typeof playSE !== 'undefined') {
                if (tutorialPage === 2 && tutorialTextIdx === 0 && tutorialTextTimer % 120 === 1) {
                    playSE('shuriken', 0.4);
                }
                if (tutorialTextTimer === 150) {
                    playTransitionSE();
                }
            }

            if (tutorialTextTimer > 300) {
                const texts = tutorialPage === 2 ? TU_TEXTS_PAGE2 : TU_TEXTS_PAGE3;
                tutorialTextIdx = (tutorialTextIdx + 1) % texts.length;
                tutorialTextTimer = 0;
                updateTutorialText();
                updateSprites(); // テキスト切り替え直後にスプライト状態も即座に反映
            }
            updateProgressBar();
        }
    }

    tutorialAnimId = requestAnimationFrame(tutorialAnimLoop);
}

function playTransitionSE() {
    if (typeof playSE === 'undefined') return;
    if (tutorialPage === 2 && tutorialTextIdx === 3) {
        playSE('puni2', 0.5);
    } else if (tutorialPage === 3 && tutorialTextIdx === 2) {
        playSE('puni', 0.5);
    }
}

function updateSprites() {
    const sakuyaEl = document.getElementById('tu-sakuya-sprite');
    const mitamaEl = document.getElementById('tu-mitama-sprite');
    const bulletEl = document.getElementById('tu-bullet-sprite');
    const xMark = document.getElementById('tu-x-mark');
    const hudEl = document.getElementById('tu-hud-mock');
    const ctxBtn = document.getElementById('tu-context-btn');

    const SW = 192; const MW = 96;
    const S_Y = -384; const B_Y = -192;

    if (tutorialPage === 1) {
        if (sakuyaEl) sakuyaEl.style.backgroundPosition = `-${tutorialFrameIdx * 155}px 0px`;
    } else {
        if (ctxBtn) {
            let showBtn = false;
            let nextHtml = '';
            let nextColor = '';
            // 実際に表示されているテキスト(tutorialVisibleTextIdx)に合わせる
            if (tutorialPage === 2) {
                if (tutorialVisibleTextIdx === 0) { showBtn = true; nextHtml = '<img src="images/Sprite/syuriken_2.png" style="width: 45px; opacity: 0.8;">'; nextColor = '#383'; }
                else if (tutorialVisibleTextIdx === 3) { showBtn = true; nextHtml = '<img src="images/Sprite/mitama_face.png" style="width: 55px; opacity: 0.9;">'; nextColor = '#338'; }
            } else if (tutorialPage === 3) {
                if (tutorialVisibleTextIdx === 2) { showBtn = true; nextHtml = '<img src="images/Sprite/mitama_face.png" style="width: 55px; opacity: 0.9;">'; nextColor = '#338'; }
            }
            if (ctxBtn.dataset.htmlContent !== nextHtml) {
                ctxBtn.innerHTML = nextHtml;
                ctxBtn.style.borderColor = nextColor;
                ctxBtn.dataset.htmlContent = nextHtml;
            }
            // テキストがフェードアウト中(tutorialTextTimerがリセット直後)はボタンも隠す
            const isTransitioning = tutorialTextTimer < 20; 
            ctxBtn.style.display = (showBtn && !isTransitioning) ? 'flex' : 'none';
            if (showBtn) ctxBtn.style.transform = (tutorialTextTimer >= 150 && tutorialTextTimer < 180) ? 'scale(0.8)' : 'scale(1)';
        }

        if (hudEl) {
            const isDmgPage = (tutorialPage === 2 && tutorialVisibleTextIdx === 4) || (tutorialPage === 3 && tutorialVisibleTextIdx === 1);
            hudEl.style.display = isDmgPage ? 'block' : 'none';
            if (isDmgPage) {
                const hp = Math.max(0, 5 - Math.floor(tutorialTextTimer / 60));
                // 毎フレームのDOM再構築を防ぐ（iPadのフリーズ原因）
                if (hudEl.dataset.lastHp !== String(hp)) {
                    updateHudMock(hp, true, tutorialPage === 3);
                    hudEl.dataset.lastHp = String(hp);
                }
            } else {
                hudEl.dataset.lastHp = "-1";
            }
        }

        if (tutorialPage === 2) {
            let isHoldingAnim = (tutorialVisibleTextIdx === 3 && tutorialTextTimer >= 150);
            if (sakuyaEl) {
                if (tutorialVisibleTextIdx === 0) {
                    sakuyaEl.style.backgroundPosition = `-${tutorialFrameIdx * SW}px ${S_Y}px`;
                    if (bulletEl) {
                        bulletEl.style.display = 'block';
                        bulletEl.style.left = (380 - (tutorialTextTimer % 60) * 15) + 'px';
                    }
                } else if (isHoldingAnim) { sakuyaEl.style.backgroundPosition = `-${tutorialFrameIdx * SW}px ${B_Y}px`; }
                else { sakuyaEl.style.backgroundPosition = `-${tutorialFrameIdx * SW}px 0px`; if (bulletEl) bulletEl.style.display = 'none'; }
                sakuyaEl.style.opacity = (tutorialVisibleTextIdx === 4 && tutorialFrameIdx % 2 === 0) ? '0.3' : '1';
                sakuyaEl.style.left = (tutorialVisibleTextIdx === 3) ? (380 + Math.min(60, (tutorialTextTimer / 150) * 60)) + 'px' : '380px';
            }
            if (mitamaEl) {
                mitamaEl.style.backgroundPositionX = `-${tutorialFrameIdx * MW}px`;
                mitamaEl.style.display = (isHoldingAnim) ? 'none' : 'block';
                let mx = 540;
                if (tutorialVisibleTextIdx === 1) mx = 540 - (tutorialTextTimer % 300) / 2;
                else if (tutorialVisibleTextIdx === 2) { mx = 200 - (tutorialTextTimer % 300) * 2; if (mx < -100) mitamaEl.style.display = 'none'; }
                mitamaEl.style.left = mx + 'px';
                mitamaEl.style.opacity = (tutorialVisibleTextIdx === 4 && tutorialFrameIdx % 2 === 0) ? '0.3' : '1';
            }
        } else if (tutorialPage === 3) {
            let isReleasedAnim = (tutorialVisibleTextIdx === 2 && tutorialTextTimer >= 150);
            if (sakuyaEl) {
                sakuyaEl.style.backgroundPosition = `-${tutorialFrameIdx * SW}px ${isReleasedAnim ? '0px' : B_Y + 'px'}`;
                if (xMark) xMark.style.display = (tutorialVisibleTextIdx === 0) ? 'block' : 'none';
                sakuyaEl.style.opacity = (tutorialVisibleTextIdx === 1 && tutorialFrameIdx % 2 === 0) ? '0.3' : '1';
            }
            if (mitamaEl) { mitamaEl.style.display = isReleasedAnim ? 'block' : 'none'; mitamaEl.style.left = '520px'; }
        }
    }
}

function updateHudMock(sakuyaHp, showMitamaRow, isHolding) {
    const sakuyaCircles = document.getElementById('tu-sakuya-hp');
    const mitamaCircles = document.getElementById('tu-mitama-hp');
    const mitamaRow = document.getElementById('tu-mitama-row');
    
    // ホールド時はミタマのライフは減らない（常に5）
    const mitamaHp = isHolding ? 5 : sakuyaHp;

    if (sakuyaCircles) { sakuyaCircles.innerHTML = ''; for (let i = 0; i < 5; i++) { const c = document.createElement('div'); c.className = 'circle' + (i < sakuyaHp ? ' active' : ''); sakuyaCircles.appendChild(c); } }
    if (mitamaCircles) { mitamaCircles.innerHTML = ''; for (let i = 0; i < 5; i++) { const c = document.createElement('div'); c.className = 'circle mitama' + (i < mitamaHp ? ' active' : ''); mitamaCircles.appendChild(c); } }
    if (mitamaRow) mitamaRow.style.display = showMitamaRow ? 'flex' : 'none';
}

function updateTutorialText() {
    const el = document.getElementById('tu-auto-text');
    if (!el) return;
    const texts = tutorialPage === 2 ? TU_TEXTS_PAGE2 : TU_TEXTS_PAGE3;
    el.style.opacity = '0';
    // 既存のタイマーがあればクリア（念のため）
    if (window.tuTextTimeout) clearTimeout(window.tuTextTimeout);
    
    window.tuTextTimeout = setTimeout(() => {
        tutorialVisibleTextIdx = tutorialTextIdx; // 実際に表示されるタイミングでインデックスを同期
        el.innerText = texts[tutorialVisibleTextIdx];
        el.style.opacity = '1';
        updateSprites(); // 文字が出た瞬間にスプライトも再計算
    }, 350); // フェードアウトが完全に終わってから書き換えるよう少しだけ猶予を持たせる
}

function updateProgressBar() {
    const bar = document.getElementById('tu-text-progress');
    if (!bar) return;
    bar.style.width = `${(tutorialTextTimer / 300) * 100}%`;
}

function showTutorialPage() {
    if (tutorialOverlay) {
        const container = document.getElementById('tu-window-el');
        if (container) container.remove();
    } else {
        tutorialOverlay = document.createElement('div');
        tutorialOverlay.id = 'tutorial-overlay';
        tutorialOverlay.style.position = 'absolute'; tutorialOverlay.style.top = '0'; tutorialOverlay.style.left = '0';
        tutorialOverlay.style.width = '1000px'; tutorialOverlay.style.height = '600px';
        tutorialOverlay.style.background = 'rgba(0,0,0,0.85)'; tutorialOverlay.style.display = 'flex';
        tutorialOverlay.style.justifyContent = 'center'; tutorialOverlay.style.alignItems = 'center';
        tutorialOverlay.style.zIndex = '30000'; tutorialOverlay.style.pointerEvents = 'auto';
        const wrapper = document.getElementById('main-wrapper');
        if (wrapper) wrapper.appendChild(tutorialOverlay); else document.body.appendChild(tutorialOverlay);
    }

    const windowEl = document.createElement('div');
    windowEl.id = 'tu-window-el';
    windowEl.style.position = 'relative'; windowEl.style.width = '940px'; windowEl.style.height = '520px';
    windowEl.style.background = 'radial-gradient(circle, #4a4a4a 0%, #222 100%)';
    windowEl.style.border = '4px solid #8c6e5e'; windowEl.style.boxShadow = 'inset 0 0 0 3px #111, 0 20px 60px rgba(0,0,0,0.9)';
    windowEl.style.padding = '20px'; windowEl.style.textAlign = 'center'; windowEl.style.fontFamily = "'Sawarabi Mincho', serif";
    windowEl.style.color = '#fff'; windowEl.style.display = 'flex'; windowEl.style.flexDirection = 'column'; windowEl.style.alignItems = 'center';

    ['m-tp-l', 'm-tp-r', 'm-bt-l', 'm-bt-r'].forEach(cls => {
        const c = document.createElement('div'); c.className = `modal-corner ${cls}`; windowEl.appendChild(c);
    });

    const titleTexts = ['1　操作方法','2　ミタマをリリース中','3　ミタマをホールド中'];
    const title = document.createElement('div');
    title.style.fontSize = '28px'; title.style.marginBottom = '10px'; title.style.color = '#ffebad';
    title.style.textShadow = '2px 2px 4px #000'; title.innerText = titleTexts[tutorialPage - 1];
    windowEl.appendChild(title);

    const content = document.createElement('div');
    content.style.flex = '1'; content.style.width = '100%'; content.style.display = 'flex';
    content.style.flexDirection = 'column'; content.style.alignItems = 'center'; content.style.justifyContent = 'center';
    windowEl.appendChild(content);

    if (tutorialPage === 1) renderPage1(content);
    else if (tutorialPage === 2) renderPage2(content);
    else if (tutorialPage === 3) renderPage3(content);

    const navArea = document.createElement('div');
    navArea.style.marginTop = '10px'; navArea.style.width = '100%'; navArea.style.display = 'flex';
    navArea.style.justifyContent = 'space-between'; navArea.style.alignItems = 'center';
    navArea.style.padding = '0 30px'; navArea.style.boxSizing = 'border-box';

    const leftBtnWrap = document.createElement('div'); leftBtnWrap.style.width = '170px';
    if (tutorialPage > 1) leftBtnWrap.appendChild(createTutorialBtn('戻る', () => { 
        tutorialPage--; 
        tutorialTextIdx = 0; tutorialVisibleTextIdx = 0; tutorialTextTimer = 0;
        showTutorialPage(); 
    }, '160px'));
    navArea.appendChild(leftBtnWrap);

    const centerBtnWrap = document.createElement('div'); centerBtnWrap.style.width = '170px';
    centerBtnWrap.appendChild(createTutorialBtn('タイトルへ', () => { tutorialOverlay.remove(); tutorialOverlay = null; if (tutorialAnimId) cancelAnimationFrame(tutorialAnimId); }, '160px'));
    navArea.appendChild(centerBtnWrap);

    const rightBtnWrap = document.createElement('div'); rightBtnWrap.style.width = '170px';
    if (tutorialPage < 3) rightBtnWrap.appendChild(createTutorialBtn('次へ', () => { 
        tutorialPage++; 
        tutorialTextIdx = 0; tutorialVisibleTextIdx = 0; tutorialTextTimer = 0;
        showTutorialPage(); 
    }, '160px'));
    navArea.appendChild(rightBtnWrap);

    windowEl.appendChild(navArea);
    tutorialOverlay.appendChild(windowEl);
}

function renderPage1(container) {
    const layout = document.createElement('div'); layout.style.display = 'flex'; layout.style.flexDirection = 'column'; layout.style.alignItems = 'center'; layout.style.width = '100%';
    
    // 咲耶とテキストを横に並べるボックス
    const sakuyaBox = document.createElement('div');
    sakuyaBox.style.display = 'flex'; sakuyaBox.style.alignItems = 'center'; sakuyaBox.style.gap = '30px'; sakuyaBox.style.marginBottom = '15px';

    const sakuyaFrame = document.createElement('div');
    sakuyaFrame.style.width = '300px'; sakuyaFrame.style.height = '170px';
    sakuyaFrame.style.background = 'rgba(0,0,0,0.2)'; sakuyaFrame.style.borderRadius = '15px';
    sakuyaFrame.style.display = 'flex'; sakuyaFrame.style.justifyContent = 'center'; sakuyaFrame.style.alignItems = 'center';
    sakuyaFrame.style.position = 'relative';

    const sakuyaVisual = document.createElement('div'); sakuyaVisual.id = 'tu-sakuya-sprite';
    sakuyaVisual.style.width = '155px'; sakuyaVisual.style.height = '155px'; sakuyaVisual.style.backgroundImage = 'url("images/Sprite/sakuya.png")'; sakuyaVisual.style.backgroundSize = '620px 620px';
    
    sakuyaFrame.appendChild(sakuyaVisual);
    sakuyaBox.appendChild(sakuyaFrame);
    
    const opOnlyText = document.createElement('div'); opOnlyText.innerText = '咲耶を操作できます'; opOnlyText.style.fontSize = '24px'; opOnlyText.style.color = '#fff'; opOnlyText.style.textShadow = '2px 2px 4px #000';
    sakuyaBox.appendChild(opOnlyText);
    
    layout.appendChild(sakuyaBox);
    const ctrlLayout = document.createElement('div'); ctrlLayout.style.display = 'flex'; ctrlLayout.style.justifyContent = 'space-around'; ctrlLayout.style.width = '100%'; ctrlLayout.style.alignItems = 'center';
    const dirPad = document.createElement('div'); dirPad.className = 'dir-pad'; dirPad.style.position = 'relative'; dirPad.style.margin = '0'; dirPad.style.left = '-50px'; dirPad.style.transform = 'scale(0.95)';
    const dirConfig = [{ text: '◀', top: '60px', left: '0', key: '←A' },{ text: '▶', top: '60px', left: '190px', key: '→D' },{ text: '▼', top: '120px', left: '95px', key: '↓S' },{ text: '▲', top: '0px', left: '95px', key: '↑W' }];
    dirConfig.forEach(c => { const btn = document.createElement('div'); btn.className = 'v-btn dir-btn'; btn.innerText = c.text; btn.style.position = 'absolute'; btn.style.top = c.top; btn.style.left = c.left; addLargeLabel(btn, c.key); dirPad.appendChild(btn); });
    const actionPad = document.createElement('div'); actionPad.className = 'action-pad'; actionPad.style.position = 'relative'; actionPad.style.margin = '0'; actionPad.style.transform = 'scale(0.95)';
    const actionConfig = [{ key: 'V', bottom: '60px', left: '0', borderColor: '#383', color: '#5a5', desc: '手裏剣を投げる' },{ key: 'B', bottom: '120px', left: '95px', borderColor: '#338', color: '#55a', desc: 'ミタマのホールド＆リリース' },{ text: '跳', key: 'Space', bottom: '0px', left: '95px', borderColor: '#833', color: '#a55', desc: 'ジャンプ（2段ジャンプ可）' },{ text: '忍', key: 'N', bottom: '60px', left: '190px', borderColor: '#883', color: '#ff0', desc: '必殺技' }];
    actionConfig.forEach(c => {
        const btn = document.createElement('div'); btn.className = 'v-btn action-btn'; btn.style.position = 'absolute'; btn.style.bottom = c.bottom; btn.style.left = c.left; btn.style.borderColor = c.borderColor; btn.style.color = c.color;
        if (c.key === 'V' || c.key === 'B') { const img = document.createElement('img'); img.src = (c.key === 'V' ? 'images/Sprite/syuriken_2.png' : 'images/Sprite/mitama_face.png'); img.style.width = (c.key === 'V' ? '45px' : '55px'); img.style.opacity = '0.8'; btn.appendChild(img); }
        else { btn.innerText = c.text; btn.style.fontSize = '36px'; btn.style.fontFamily = "'Sawarabi Mincho', serif"; }
        addLargeLabel(btn, c.key); actionPad.appendChild(btn);
        const desc = document.createElement('div'); desc.style.position = 'absolute'; desc.style.color = '#fff'; desc.style.fontSize = '22px'; desc.style.fontWeight = 'bold'; desc.innerText = c.desc; desc.style.whiteSpace = 'nowrap'; desc.style.textShadow = '2px 2px 4px #000';
        if (c.key === 'B') { desc.style.bottom = '190px'; desc.style.left = '-140px'; desc.style.textAlign = 'right'; }
        else if (c.key === 'N') { desc.style.bottom = '90px'; desc.style.left = '290px'; }
        else if (c.key === 'Space') { desc.style.bottom = '2px'; desc.style.left = '-170px'; desc.style.textAlign = 'right'; }
        else if (c.key === 'V') { desc.style.bottom = '90px'; desc.style.left = '-160px'; desc.style.textAlign = 'right'; }
        actionPad.appendChild(desc);
    });
    ctrlLayout.appendChild(dirPad); ctrlLayout.appendChild(actionPad); layout.appendChild(ctrlLayout); container.appendChild(layout);
}

function addLargeLabel(parent, text) {
    const l = document.createElement('div'); l.innerText = text; l.style.position = 'absolute'; l.style.top = '-18px'; l.style.right = '-18px';
    l.style.background = '#000'; l.style.border = '2px solid #fff'; l.style.color = '#fff'; l.style.fontSize = '20px'; l.style.padding = '4px 10px';
    l.style.borderRadius = '5px'; l.style.zIndex = '100'; l.style.fontFamily = 'monospace'; l.style.fontWeight = 'bold'; parent.appendChild(l);
}

function renderPage2(container) { renderIllustration(container, false); renderAutoText(container); }
function renderPage3(container) { renderIllustration(container, true); renderAutoText(container); }

function renderIllustration(container, isHolding) {
    const visual = document.createElement('div'); visual.style.width = '100%'; visual.style.height = '240px'; 
    visual.style.display = 'flex'; visual.style.justifyContent = 'center'; visual.style.alignItems = 'center';
    visual.style.background = 'rgba(0,0,0,0.2)'; visual.style.borderRadius = '15px';
    visual.style.marginBottom = '10px'; visual.style.position = 'relative'; visual.style.overflow = 'hidden';
    const hud = document.createElement('div'); hud.id = 'tu-hud-mock'; hud.style.position = 'absolute'; hud.style.top = '15px'; hud.style.left = '20px'; hud.style.display = 'none'; hud.className = 'hud';
    hud.innerHTML = '<div class="hp-row"><span class="hp-label">咲耶</span><div id="tu-sakuya-hp" class="circles"></div></div><div id="tu-mitama-row" class="hp-row"><span class="hp-label">ミタマ</span><div id="tu-mitama-hp" class="circles"></div></div>';
    visual.appendChild(hud);
    const ctxBtn = document.createElement('div'); ctxBtn.id = 'tu-context-btn'; ctxBtn.className = 'v-btn'; ctxBtn.style.position = 'absolute'; ctxBtn.style.right = '40px'; ctxBtn.style.bottom = '40px'; ctxBtn.style.display = 'none';
    visual.appendChild(ctxBtn);
    const bullet = document.createElement('div'); bullet.id = 'tu-bullet-sprite'; bullet.style.width = '40px'; bullet.style.height = '40px'; bullet.style.backgroundImage = 'url("images/Sprite/syuriken_2.png")'; bullet.style.backgroundSize = 'contain';
    bullet.style.position = 'absolute'; bullet.style.display = 'none'; visual.appendChild(bullet);
    const sakuya = document.createElement('div'); sakuya.id = 'tu-sakuya-sprite'; sakuya.style.width = '192px'; sakuya.style.height = '192px'; sakuya.style.backgroundImage = 'url("images/Sprite/sakuya.png")'; sakuya.style.backgroundSize = '768px 768px';
    sakuya.style.position = 'absolute'; sakuya.style.left = '380px'; visual.appendChild(sakuya);
    const mitama = document.createElement('div'); mitama.id = 'tu-mitama-sprite'; mitama.style.width = '96px'; mitama.style.height = '96px'; mitama.style.backgroundImage = 'url("images/Sprite/mitama.png")'; mitama.style.backgroundSize = '384px 96px';
    mitama.style.position = 'absolute'; mitama.style.left = '540px'; visual.appendChild(mitama);
    const xMark = document.createElement('div'); xMark.id = 'tu-x-mark'; xMark.style.position = 'absolute'; xMark.style.left = '280px'; xMark.style.top = '60px'; xMark.style.display = 'none';
    xMark.innerHTML = '<img src="images/Sprite/syuriken_2.png" style="width: 60px; opacity:0.6;"><div style="position:absolute; left:5px; top:-15px; color:#f33; font-size:80px; font-weight:bold; text-shadow:0 0 10px #000;">×</div>';
    visual.appendChild(xMark);
    container.appendChild(visual);
}

function renderAutoText(container) {
    const textWrap = document.createElement('div'); textWrap.style.width = '85%'; textWrap.style.height = '80px';
    textWrap.style.display = 'flex'; textWrap.style.flexDirection = 'column'; textWrap.style.justifyContent = 'center'; textWrap.style.alignItems = 'center';
    textWrap.style.background = 'rgba(255,255,255,0.05)'; textWrap.style.borderRadius = '10px'; textWrap.style.padding = '10px'; textWrap.style.position = 'relative';
    const text = document.createElement('div'); text.id = 'tu-auto-text'; text.style.fontSize = '22px'; text.style.lineHeight = '1.4'; text.style.transition = 'opacity 0.3s';
    const texts = tutorialPage === 2 ? TU_TEXTS_PAGE2 : TU_TEXTS_PAGE3; text.innerText = texts[0]; textWrap.appendChild(text);
    const bt = document.createElement('div'); bt.style.position = 'absolute'; bt.style.bottom = '0'; bt.style.left = '0'; bt.style.width = '100%'; bt.style.height = '4px'; bt.style.background = 'rgba(255,255,255,0.1)';
    const bp = document.createElement('div'); bp.id = 'tu-text-progress'; bp.style.width = '0%'; bp.style.height = '100%'; bp.style.background = '#ffebad';
    bt.appendChild(bp); textWrap.appendChild(bt); container.appendChild(textWrap);
}

function createTutorialBtn(text, callback, width = '150px') {
    const wrap = document.createElement('div'); wrap.className = 'modal-btn-wrap';
    const btn = document.createElement('button'); btn.className = 'modal-btn'; btn.style.width = width; btn.style.height = '45px'; 
    
    const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        callback();
    };
    btn.addEventListener('click', handler);
    btn.addEventListener('touchend', handler, { passive: false });
    // 全体タッチ制御システム(input.js)に吸い込まれないようにする
    btn.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: false });
    
    const inner = document.createElement('span'); inner.className = 'modal-btn-inner'; inner.innerText = text; inner.style.fontSize = '18px'; inner.style.letterSpacing = '1px'; inner.style.textIndent = '1px';
    btn.appendChild(inner); wrap.appendChild(btn); return wrap;
}
