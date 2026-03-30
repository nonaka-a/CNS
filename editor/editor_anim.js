/**
 * アニメーションエディタ用ロジック
 */

// --- 変数定義 ---
let anim_ctxSource, anim_canvasSource;
let anim_ctxPreview, anim_canvasPreview;
window.anim_img = new Image();
let anim_sourceCanvas = document.createElement('canvas');
window.anim_data = {};
let anim_currentKey = null;
let anim_isPlaying = true;
let anim_timer = 0;
let anim_frameIndex = 0;
let anim_lastTime = 0;

// ドラッグ&ドロップ用変数
let anim_dragSrcIndex = null;

let ANIM_TILE_SIZE = 64;

// --- 初期化 ---
window.initAnimEditor = function () {
    if (window.animInitialized) return;

    console.log("Animation Editor Initializing...");

    anim_canvasSource = document.getElementById('anim-source-canvas');
    anim_ctxSource = anim_canvasSource.getContext('2d');
    anim_canvasPreview = document.getElementById('anim-preview-canvas');
    anim_ctxPreview = anim_canvasPreview.getContext('2d');

    const img = new Image();
    img.src = '../image/tileset/forest_tileset.png';
    img.onload = () => {
        anim_sourceCanvas.width = img.width;
        anim_sourceCanvas.height = img.height;
        const ctx = anim_sourceCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        anim_img = anim_sourceCanvas;
        anim_updateSourceView();
    };

    anim_canvasSource.addEventListener('mousedown', anim_onSourceClick);

    // キーイベント (スペースキーで再生/停止)
    window.addEventListener('keydown', (e) => {
        // アニメーションエディタが表示されている時のみ
        if (document.getElementById('mode-anim').classList.contains('active')) {
            if (e.code === 'Space') {
                e.preventDefault(); // スクロール防止
                anim_togglePlay();
            }
        }
    });

    if (Object.keys(anim_data).length === 0) {
        anim_create("idle");
    }

    requestAnimationFrame(anim_loop);
    window.animInitialized = true;
};

// --- メインループ ---
function anim_loop(timestamp) {
    if (!anim_lastTime) anim_lastTime = timestamp;
    const deltaTime = timestamp - anim_lastTime;
    anim_lastTime = timestamp;

    if (anim_currentKey && anim_data[anim_currentKey]) {
        const anim = anim_data[anim_currentKey];

        if (anim.frames.length > 0 && anim_isPlaying) {
            anim_timer += deltaTime;
            const interval = 1000 / anim.fps;

            if (anim_timer >= interval) {
                anim_timer = 0;
                anim_frameIndex++;
                if (anim_frameIndex >= anim.frames.length) {
                    if (anim.loop) {
                        anim_frameIndex = 0;
                    } else {
                        anim_frameIndex = anim.frames.length - 1;
                    }
                }
                // 再生中はカードのアクティブ表示だけ更新したいが、
                // DOM再構築は重いので簡易的にクラス操作だけする手もあるが
                // ここではシンプルに全体更新を呼ぶ
                anim_updateTimelineUI();
            }
        }

        anim_ctxPreview.clearRect(0, 0, anim_canvasPreview.width, anim_canvasPreview.height);

        // 背景 (プレビューエリア全体)
        anim_ctxPreview.fillStyle = '#222';
        anim_ctxPreview.fillRect(0, 0, anim_canvasPreview.width, anim_canvasPreview.height);

        if (anim.frames.length > 0) {
            const frame = anim.frames[anim_frameIndex % anim.frames.length];
            if (frame) {
                // プレビューキャンバスの中央に描画し、キャンバスサイズに合わせて拡大・縮小
                const previewCanvasSize = 256; // Assuming preview canvas is 256x256
                const scale = Math.min(previewCanvasSize / frame.w, previewCanvasSize / frame.h);
                const drawW = frame.w * scale;
                const drawH = frame.h * scale;
                const dx = (anim_canvasPreview.width - drawW) / 2;
                const dy = (anim_canvasPreview.height - drawH) / 2;

                anim_ctxPreview.imageSmoothingEnabled = false;
                anim_ctxPreview.drawImage(
                    anim_img,
                    frame.x, frame.y, frame.w, frame.h,
                    dx, dy, frame.w * scale, frame.h * scale
                );
            }
        }
    }

    requestAnimationFrame(anim_loop);
}

// --- ソース画像操作 ---
function anim_updateSourceView() {
    anim_canvasSource.width = anim_img.width;
    anim_canvasSource.height = anim_img.height;
    anim_drawSource();
}

function anim_drawSource() {
    anim_ctxSource.clearRect(0, 0, anim_canvasSource.width, anim_canvasSource.height);
    anim_ctxSource.drawImage(anim_img, 0, 0);

    anim_ctxSource.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    anim_ctxSource.lineWidth = 1;
    anim_ctxSource.beginPath();
    for (let x = 0; x <= anim_img.width; x += ANIM_TILE_SIZE) {
        anim_ctxSource.moveTo(x, 0);
        anim_ctxSource.lineTo(x, anim_img.height);
    }
    for (let y = 0; y <= anim_img.height; y += ANIM_TILE_SIZE) {
        anim_ctxSource.moveTo(0, y);
        anim_ctxSource.lineTo(anim_img.width, y);
    }
    anim_ctxSource.stroke();
}

function anim_onSourceClick(e) {
    if (!anim_currentKey) return;

    const rect = anim_canvasSource.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const tx = Math.floor(x / ANIM_TILE_SIZE) * ANIM_TILE_SIZE;
    const ty = Math.floor(y / ANIM_TILE_SIZE) * ANIM_TILE_SIZE;

    const newFrame = { x: tx, y: ty, w: ANIM_TILE_SIZE, h: ANIM_TILE_SIZE };
    anim_data[anim_currentKey].frames.push(newFrame);

    anim_updateTimelineUI();

    anim_drawSource();
    anim_ctxSource.strokeStyle = '#ffff00';
    anim_ctxSource.lineWidth = 3;
    anim_ctxSource.strokeRect(tx, ty, ANIM_TILE_SIZE, ANIM_TILE_SIZE);
}

// --- 連番画像読み込み ---
window.anim_loadImages = function (input) {
    const files = Array.from(input.files).sort((a, b) => a.name.localeCompare(b.name));
    if (files.length === 0) return;

    const loadedImages = [];
    let loadedCount = 0;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                loadedImages.push({ name: file.name, img: img });
                loadedCount++;
                if (loadedCount === files.length) {
                    anim_combineImages(loadedImages);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    input.value = '';
};

function anim_combineImages(images) {
    images.sort((a, b) => a.name.localeCompare(b.name));

    const MAX_WIDTH = 1024;
    const cols = Math.max(1, Math.floor(MAX_WIDTH / ANIM_TILE_SIZE));
    const rows = Math.ceil(images.length / cols);

    const canvasWidth = Math.min(images.length, cols) * ANIM_TILE_SIZE;
    const canvasHeight = rows * ANIM_TILE_SIZE;

    anim_sourceCanvas.width = canvasWidth;
    anim_sourceCanvas.height = canvasHeight;
    const ctx = anim_sourceCanvas.getContext('2d');

    images.forEach((item, index) => {
        const img = item.img;
        let drawW = img.width;
        let drawH = img.height;

        const col = index % cols;
        const row = Math.floor(index / cols);
        const currentX = col * ANIM_TILE_SIZE;
        const currentY = row * ANIM_TILE_SIZE;

        if (drawW > ANIM_TILE_SIZE || drawH > ANIM_TILE_SIZE) {
            const ratio = Math.min(ANIM_TILE_SIZE / drawW, ANIM_TILE_SIZE / drawH);
            drawW *= ratio;
            drawH *= ratio;
        }

        const offsetX = (ANIM_TILE_SIZE - drawW) / 2;
        const offsetY = (ANIM_TILE_SIZE - drawH) / 2;

        ctx.drawImage(img, currentX + offsetX, currentY + offsetY, drawW, drawH);

        if (anim_currentKey) {
            anim_data[anim_currentKey].frames.push({
                x: currentX,
                y: currentY,
                w: ANIM_TILE_SIZE,
                h: ANIM_TILE_SIZE
            });
        }
    });

    anim_img = anim_sourceCanvas;
    anim_updateSourceView();
    anim_updateTimelineUI();
    alert(`${images.length}枚の画像を読み込み、フレームに追加しました。`);
}

// --- 再生制御 ---
window.anim_togglePlay = function () {
    anim_isPlaying = !anim_isPlaying;
    const btn = document.getElementById('btn-anim-play');
    if (btn) btn.textContent = anim_isPlaying ? '⏸' : '▶';
};

// --- データ操作 ---
window.anim_create = function (name) {
    if (name) {
        if (anim_data[name]) { alert("その名前は既に使用されています"); return; }
        anim_data[name] = { frames: [], fps: 10, loop: true };
        anim_select(name);
        anim_updateListUI();
        return;
    }

    // インライン入力で名前を入力させる
    const list = document.getElementById('anim-list');
    const div = document.createElement('div');
    div.className = 'anim-item';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '例: run, jump';
    input.style.cssText = 'width:100%;box-sizing:border-box;background:#444;color:#fff;border:1px solid #8f8;padding:4px 6px;font-size:inherit;outline:none;';

    let done = false;
    const commit = () => {
        if (done) return;
        done = true;
        const newName = input.value.trim();
        if (!newName) { div.remove(); return; }
        if (anim_data[newName]) {
            done = false;
            alert("その名前は既に使用されています");
            input.focus();
            return;
        }
        anim_data[newName] = { frames: [], fps: 10, loop: true };
        anim_select(newName);
        anim_updateListUI();
    };

    input.onkeydown = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
        else if (ev.key === 'Escape') { done = true; div.remove(); }
    };
    input.onblur = () => setTimeout(commit, 50);

    div.appendChild(input);
    list.appendChild(div);
    input.focus();
};

window.anim_select = function (key) {
    anim_currentKey = key;
    anim_frameIndex = 0;
    anim_timer = 0;

    const anim = anim_data[key];
    document.getElementById('inp-anim-name').value = key;
    document.getElementById('inp-anim-fps').value = anim.fps;
    document.getElementById('inp-anim-loop').checked = anim.loop;

    anim_updateListUI();
    anim_updateTimelineUI();
};

window.anim_updateProp = function () {
    if (!anim_currentKey) return;

    const newName = document.getElementById('inp-anim-name').value;
    const newFps = parseInt(document.getElementById('inp-anim-fps').value);
    const newLoop = document.getElementById('inp-anim-loop').checked;

    const anim = anim_data[anim_currentKey];
    anim.fps = newFps;
    anim.loop = newLoop;

    if (newName !== anim_currentKey) {
        if (anim_data[newName]) {
            alert("その名前は既に使用されています");
            document.getElementById('inp-anim-name').value = anim_currentKey;
            return;
        }
        anim_data[newName] = anim;
        delete anim_data[anim_currentKey];
        anim_currentKey = newName;
        anim_updateListUI();
    }
};

window.anim_removeFrame = function (index) {
    if (!anim_currentKey) return;
    anim_data[anim_currentKey].frames.splice(index, 1);
    // フレーム削除時にインデックス調整
    if (anim_frameIndex >= anim_data[anim_currentKey].frames.length) {
        anim_frameIndex = Math.max(0, anim_data[anim_currentKey].frames.length - 1);
    }
    anim_updateTimelineUI();
};

window.anim_moveFrame = function (fromIndex, toIndex) {
    if (!anim_currentKey) return;
    const frames = anim_data[anim_currentKey].frames;

    if (toIndex < 0 || toIndex >= frames.length) return;

    const item = frames.splice(fromIndex, 1)[0];
    frames.splice(toIndex, 0, item);

    // 再生位置の調整（簡易的にリセット）
    // anim_frameIndex = toIndex; 
    anim_updateTimelineUI();
};

// --- UI更新 ---
let anim_clickTimer = null;
function anim_updateListUI() {
    const list = document.getElementById('anim-list');
    list.innerHTML = '';

    Object.keys(anim_data).forEach(key => {
        const div = document.createElement('div');
        div.className = 'anim-item' + (key === anim_currentKey ? ' selected' : '');
        div.textContent = key;

        // シングルクリック（遅延実行、ダブルクリック時キャンセル）
        div.onclick = () => {
            clearTimeout(anim_clickTimer);
            anim_clickTimer = setTimeout(() => {
                anim_select(key);
            }, 250);
        };

        // ダブルクリックでリネーム
        div.ondblclick = (e) => {
            clearTimeout(anim_clickTimer);
            e.stopPropagation();
            const input = document.createElement('input');
            input.type = 'text';
            input.value = key;
            input.style.cssText = 'width:100%;box-sizing:border-box;background:#444;color:#fff;border:1px solid #8f8;padding:4px 6px;font-size:inherit;outline:none;';

            let committed = false;
            const commitRename = () => {
                if (committed) return;
                // inputがDOMから外れていたら何もしない（prompt等による誤発火防止）
                if (!document.contains(input)) return;
                committed = true;
                const newName = input.value.trim();
                if (!newName || newName === key) {
                    anim_updateListUI();
                    return;
                }
                if (anim_data[newName]) {
                    committed = false;
                    alert('その名前は既に使用されています');
                    input.focus();
                    return;
                }
                // リネーム実行
                anim_data[newName] = anim_data[key];
                delete anim_data[key];
                if (anim_currentKey === key) {
                    anim_currentKey = newName;
                    document.getElementById('inp-anim-name').value = newName;
                }
                anim_updateListUI();
            };

            input.onkeydown = (ev) => {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    commitRename();
                } else if (ev.key === 'Escape') {
                    committed = true;
                    anim_updateListUI();
                }
            };
            input.onblur = () => {
                setTimeout(() => commitRename(), 50);
            };

            div.textContent = '';
            div.appendChild(input);
            input.focus();
            input.select();
        };

        list.appendChild(div);
    });
}

function anim_updateTimelineUI() {
    const container = document.getElementById('timeline-frames');
    // ドラッグ中などでDOMを再生成したくない場合のガードが必要だが、
    // ここではシンプルに毎回再生成する（ただしドラッグ中は更新しない制御を入れるのが理想）
    // とりあえずドラッグ開始前は再生成OK

    // 既存の中身をクリア（ドラッグ中の要素がある場合は注意が必要だが今回は単純化）
    container.innerHTML = '';

    if (!anim_currentKey) return;
    const frames = anim_data[anim_currentKey].frames;

    frames.forEach((frame, idx) => {
        const div = document.createElement('div');
        div.className = 'frame-card' + (idx === anim_frameIndex ? ' active' : '');
        div.draggable = true; // ドラッグ可能にする

        // ドラッグイベント
        div.ondragstart = (e) => {
            anim_dragSrcIndex = idx;
            e.dataTransfer.effectAllowed = 'move';
            div.style.opacity = '0.4';
        };
        div.ondragend = (e) => {
            div.style.opacity = '1';
            anim_dragSrcIndex = null;
        };
        div.ondragover = (e) => {
            e.preventDefault(); // ドロップ許可
            e.dataTransfer.dropEffect = 'move';
            div.style.borderLeft = '3px solid #ffff00'; // 挿入位置ガイド
        };
        div.ondragleave = (e) => {
            div.style.borderLeft = '';
        };
        div.ondrop = (e) => {
            e.preventDefault();
            div.style.borderLeft = '';
            if (anim_dragSrcIndex !== null && anim_dragSrcIndex !== idx) {
                anim_moveFrame(anim_dragSrcIndex, idx);
            }
        };

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = frame.w;
        thumbCanvas.height = frame.h;
        const tCtx = thumbCanvas.getContext('2d');
        tCtx.drawImage(anim_img, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);

        const thumb = document.createElement('div');
        thumb.className = 'frame-thumb';
        thumb.style.backgroundImage = `url(${thumbCanvas.toDataURL()})`;
        thumb.style.backgroundSize = 'contain';
        thumb.style.backgroundPosition = 'center';
        thumb.style.backgroundRepeat = 'no-repeat';

        const num = document.createElement('div');
        num.className = 'frame-num';
        num.textContent = `${idx + 1}`;

        const del = document.createElement('div');
        del.className = 'frame-del';
        del.textContent = '×';
        del.onclick = (e) => {
            e.stopPropagation();
            anim_removeFrame(idx);
        };

        div.appendChild(thumb);
        div.appendChild(num);
        div.appendChild(del);
        div.onclick = () => {
            anim_frameIndex = idx;
            anim_updateTimelineUI();
        };

        container.appendChild(div);
    });
}

// --- 保存・読込 ---
window.anim_save = function () {
    const packName = document.getElementById('anim-pack-name').value || 'animations';
    const output = {
        tileSize: ANIM_TILE_SIZE,
        data: window.anim_data
    };
    const json = JSON.stringify(output, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = packName + '.json';
    a.click();
};

// 画像保存機能の追加
window.anim_saveImage = function () {
    // 現在のソース画像を取得
    let canvasToSave;

    // anim_img が Canvas要素ならそのまま使う
    if (anim_img instanceof HTMLCanvasElement) {
        canvasToSave = anim_img;
    } else {
        // Image要素ならCanvasに描画して変換
        canvasToSave = document.createElement('canvas');
        canvasToSave.width = anim_img.width;
        canvasToSave.height = anim_img.height;
        const ctx = canvasToSave.getContext('2d');
        ctx.drawImage(anim_img, 0, 0);
    }

    // ダウンロード処理
    const packName = document.getElementById('anim-pack-name').value || 'char';
    const url = canvasToSave.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = packName + '.png';
    a.click();
};

window.anim_load = function (input) {
    const file = input.files[0];
    if (!file) return;

    // ファイル名をパック名に反映
    const packName = file.name.replace(/\.[^/.]+$/, "");
    document.getElementById('anim-pack-name').value = packName;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const obj = JSON.parse(e.target.result);
            if (obj.tileSize) {
                ANIM_TILE_SIZE = obj.tileSize;
                document.getElementById('anim-tile-size').value = ANIM_TILE_SIZE;
            }
            window.anim_data = obj.data || obj; // 互換性維持

            const firstKey = Object.keys(window.anim_data)[0];
            if (firstKey) anim_select(firstKey);
            anim_updateListUI();
            anim_updateSourceView();
        } catch (err) {
            console.error(err);
            alert("読み込みエラー");
        }
    };
    reader.readAsText(file);
    input.value = '';
};

window.anim_onTileSizeChange = function () {
    const newVal = parseInt(document.getElementById('anim-tile-size').value);

    // 既存のフレームがある場合、サイズを更新するか聞く
    let frameCount = 0;
    Object.keys(window.anim_data).forEach(k => {
        frameCount += window.anim_data[k].frames.length;
    });

    if (frameCount > 0) {
        if (confirm(`既存の全フレーム (${frameCount}個) のサイズを ${newVal}x${newVal} に更新しますか？\n(注意: 切り抜き位置は左上のまま維持されます)`)) {
            Object.keys(window.anim_data).forEach(k => {
                window.anim_data[k].frames.forEach(f => {
                    f.w = newVal;
                    f.h = newVal;
                });
            });
        }
    }

    ANIM_TILE_SIZE = newVal;
    anim_drawSource();
    anim_updateTimelineUI();
};