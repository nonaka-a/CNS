async function loadSE(name, url) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        seBuffers[name] = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.error(`Failed to load SE: ${name}`, e);
    }
}

function playSE(name, volume = 1.0) {
    if (!isSoundOn) return;
    if (!audioCtx || !seBuffers[name]) return;
    const source = audioCtx.createBufferSource();
    source.buffer = seBuffers[name];
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = volume;
    
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    source.start(0);
}

function fadeOutBGM(targetBgm, duration = 1000) {
    if (bgmFadeInterval) clearInterval(bgmFadeInterval);
    const startVolume = targetBgm.volume;
    const step = startVolume / (duration / 50);
    
    bgmFadeInterval = setInterval(() => {
        if (targetBgm.volume > step) {
            targetBgm.volume -= step;
        } else {
            targetBgm.volume = 0;
            targetBgm.pause();
            targetBgm.volume = startVolume; // 次回再生用にリセット
            clearInterval(bgmFadeInterval);
            bgmFadeInterval = null;
        }
    }, 50);
}

function updateEventAudio(config, time, isRunning) {
    if (!config || !isRunning) {
        stopAllEventAudio();
        return;
    }
    const comp = config.assets.find(a => a.id === "comp_1");
    if (!comp) return;

    comp.layers.forEach(layer => {
        if (layer.type !== 'audio') return;
        const asset = (function findAsset(id, list) {
             for (let a of list) {
                 if (a.id === id) return a;
                 if (a.type === 'folder' && a.children) {
                     let found = findAsset(id, a.children);
                     if (found) return found;
                 }
             }
             return null;
        })(layer.assetId, config.assets);
        if (!asset || !asset.audioBuffer) return;
        const offset = time - layer.startTime;
        const isWithinRange = (time >= layer.inPoint && time < layer.outPoint);
        const isWithinBuffer = (offset >= 0 && offset < asset.audioBuffer.duration);
        if (isWithinRange && isWithinBuffer && isSoundOn) {
            if (!opAudioSources[layer.id]) {
                const source = audioCtx.createBufferSource();
                source.buffer = asset.audioBuffer;
                const gainNode = audioCtx.createGain();
                source.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                const volDb = (layer.tracks && layer.tracks.volume) ? getOpTrackValue(layer.tracks.volume, time, 0) : 0;
                gainNode.gain.value = Math.pow(10, volDb / 20);
                source.start(0, Math.max(0, offset));
                opAudioSources[layer.id] = { source, gain: gainNode };
                source.onended = () => {
                    if (opAudioSources[layer.id] && opAudioSources[layer.id].source === source) delete opAudioSources[layer.id];
                };
            } else {
                const volDb = (layer.tracks && layer.tracks.volume) ? getOpTrackValue(layer.tracks.volume, time, 0) : 0;
                opAudioSources[layer.id].gain.gain.setTargetAtTime(Math.pow(10, volDb / 20), audioCtx.currentTime, 0.05);
            }
        } else {
            if (opAudioSources[layer.id]) {
                try { opAudioSources[layer.id].source.stop(); } catch(e){}
                delete opAudioSources[layer.id];
            }
        }
    });
}

function stopAllEventAudio() {
    Object.keys(opAudioSources).forEach(id => {
        try { opAudioSources[id].source.stop(); } catch(e){}
        delete opAudioSources[id];
    });
}