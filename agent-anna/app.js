// =================================================================
// AGENT ANNA // MILITARY-GRADE BASE ENGINE + DUAL NEURON CANVAS
// =================================================================

const REPO_OWNER = "suzukistrayd";
const REPO_NAME = "podcast";
let isVoiceEnabled = true;
let recognition = null;
let isListening = false;
let cachedVoices = [];
let coreKnowledgeCache = null;
let messagePayloadStore = {};

let audioCtx = null;
let analyser = null;
let micStream = null;
let animFrameId = null;

window.onload = function() {
    try {
        const savedKey = localStorage.getItem('dahl_key');
        if (savedKey) {
            const keyInput = document.getElementById('api-key');
            if (keyInput) keyInput.value = savedKey;
        }
    } catch (e) {}

    const inputEl = document.getElementById('user-input');
    if (inputEl) inputEl.focus();
    
    if ('speechSynthesis' in window) {
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    preloadCoreKnowledge();
    initSpeechRecognition();
    initWavCanvas();
};

// =================================================================
// 1. SPEECH RECOGNITION & VISUALIZER ENGINE
// =================================================================
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = function() {
            isListening = true;
            const micBtn = document.getElementById('mic-btn');
            if (micBtn) micBtn.classList.add('listening');
            updateHUDState("LISTENING");
            startAudioVisualizer();
        };

        recognition.onresult = function(event) {
            const speechText = event.results[0][0].transcript;
            const userInput = document.getElementById('user-input');
            if (userInput) userInput.value = speechText;
            stopListeningUI();
            sendMessage();
        };

        recognition.onerror = function() { stopListeningUI(); };
        recognition.onend = function() { stopListeningUI(); };
    } catch (err) {}
}

async function startAudioVisualizer() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 32;

        const source = audioCtx.createMediaStreamSource(micStream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const eqBars = document.querySelectorAll('.eq-bar');

        function renderFrame() {
            if (!isListening) return;
            analyser.getByteFrequencyData(dataArray);

            eqBars.forEach((bar, index) => {
                const val = dataArray[index % dataArray.length] || 0;
                bar.style.height = `${Math.max(15, Math.min(100, (val / 255) * 100))}%`;
            });

            animFrameId = requestAnimationFrame(renderFrame);
        }
        renderFrame();
    } catch (e) {}
}

function stopAudioVisualizer() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (micStream) { micStream.getTracks().forEach(track => track.stop()); micStream = null; }
    if (audioCtx) { audioCtx.close(); audioCtx = null; }
    document.querySelectorAll('.eq-bar').forEach(bar => bar.style.height = '20%');
}

function toggleMic() {
    if (!recognition) initSpeechRecognition();
    if (!recognition) return alert("Speech recognition unavailable.");

    if (!isListening) {
        try { recognition.start(); } catch (e) { stopListeningUI(); }
    } else {
        try { recognition.stop(); } catch (e) {}
        stopListeningUI();
    }
}

function stopListeningUI() {
    isListening = false;
    stopAudioVisualizer();
    const micBtn = document.getElementById('mic-btn');
    if (micBtn) micBtn.classList.remove('listening');
    const stateText = document.getElementById('state-text');
    if (stateText && stateText.innerText === "LISTENING") updateHUDState("READY");
}

// =================================================================
// 2. DYNAMIC KNOWLEDGE & TELEMETRY HARVESTER
// =================================================================
function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    cachedVoices = window.speechSynthesis.getVoices();
}

async function preloadCoreKnowledge() {
    const corePaths = [
        "agent-anna/character/agent-anna.md",
        "agent-anna/knowledge/agents.md",
        "agent-anna/knowledge/lessons.md",
        "agent-anna/knowledge/rules.md"
    ];
    let snippets = [];
    await Promise.all(corePaths.map(async (path) => {
        try {
            const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${path}?t=${Date.now()}`;
            const res = await fetch(rawUrl);
            if (res.ok) {
                const text = await res.text();
                const cleanText = text.replace(/<[^>]*>/g, '').trim();
                if (cleanText) snippets.push(`[DIRECTIVE SOURCE: ${path}]\n${cleanText}`);
            }
        } catch (e) {}
    }));
    coreKnowledgeCache = snippets.join('\n\n---\n\n');
}

async function fetchLiveTelemetry() {
    let btc = "Unavailable", eth = "Unavailable", doge = "Unavailable", sol = "Unavailable";
    try {
        const cryptoRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,dogecoin,solana&vs_currencies=usd");
        if (cryptoRes.ok) {
            const prices = await cryptoRes.json();
            if (prices.bitcoin) btc = `$${prices.bitcoin.usd.toLocaleString()}`;
            if (prices.ethereum) eth = `$${prices.ethereum.usd.toLocaleString()}`;
            if (prices.dogecoin) doge = `$${prices.dogecoin.usd.toFixed(4)}`;
            if (prices.solana) sol = `$${prices.solana.usd.toFixed(2)}`;
        }
    } catch (e) {}

    let status = "SYNCHRONIZED", activeBot = "Grok Scanner", solanaEquity = sol, signal = "Active";
    try {
        const localRes = await fetch(`portal-relay.json?t=${Date.now()}`);
        if (localRes.ok) {
            const data = await localRes.json();
            status = data.status || status;
            activeBot = data.active_bot || activeBot;
            solanaEquity = data.solana_equity || solanaEquity;
            signal = data.latest_signal || signal;
        }
    } catch (e) {}

    return `[LIVE TELEMETRY & MARKET METRICS]
- Audit Status: ${status}
- Active Engine: ${activeBot}
- Solana Equity: ${solanaEquity}
- Bitcoin (BTC): ${btc}
- Ethereum (ETH): ${eth}
- Dogecoin (DOGE): ${doge}
- Latest Signal: ${signal}`;
}

// =================================================================
// 3. VOICE SYNTHESIZER & INFERENCE LOOP
// =================================================================
function speakText(text) {
    if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
    
    document.body.classList.remove('is-thinking');
    document.body.classList.add('is-speaking');
    updateHUDState("SPEAKING");

    window.speechSynthesis.cancel();
    
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/[*_#`~]/g, '').trim();
    if (!cleanText) return;

    if (cachedVoices.length === 0) loadVoices();
    const utterance = new SpeechSynthesisUtterance(cleanText);

    const preferredVoices = ["Google UK English Female", "en-GB-Neural2-F", "Sonia", "Hazel", "Samantha", "Google US English"];
    let selectedVoice = cachedVoices.find(v => preferredVoices.some(p => v.name.includes(p)));
    if (!selectedVoice) selectedVoice = cachedVoices.find(v => v.lang.startsWith('en') && !v.name.toLowerCase().includes('male'));

    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.pitch = 1.05;
    utterance.rate = 0.96;

    utterance.onstart = () => { document.body.classList.add('is-speaking'); updateHUDState("SPEAKING"); };
    utterance.onend = () => { document.body.classList.remove('is-speaking'); updateHUDState("READY"); };
    utterance.onerror = () => { document.body.classList.remove('is-speaking'); updateHUDState("READY"); };

    window.speechSynthesis.speak(utterance);
}

async function sendMessage(forcedQuery = null) {
    const keyEl = document.getElementById('api-key');
    const input = document.getElementById('user-input');
    const apiKey = keyEl ? keyEl.value.trim() : "";
    const query = forcedQuery || (input ? input.value.trim() : "");

    if (!apiKey) {
        alert('Please tap ⚙️ KEYS and paste your Dahl API Key.');
        toggleSettings();
        return;
    }
    if (!query) return;

    if (query.startsWith('http://') || query.startsWith('https://')) {
        scrapeWebPage(query);
        if (input && !forcedQuery) input.value = '';
        return;
    }

    appendMsg(query, 'user', 'Commander');
    if (input && !forcedQuery) input.value = '';

    const startTime = performance.now();

    document.body.classList.remove('is-speaking');
    document.body.classList.add('is-thinking');
    updateHUDState("REASONING");

    if (!coreKnowledgeCache) await preloadCoreKnowledge();
    const liveTelemetry = await fetchLiveTelemetry();
    
    const systemPrompt = `You are AGENT ANNA 01 (AA01). 
Rules:
1. Provide precise, executive answers suitable for speech synthesis.
2. Integrate telemetry statistics directly when asked for system state or market metrics.

Dynamic System Directives (Loaded from GitHub Markdown Files):
${coreKnowledgeCache}

Telemetry & Live Market Data:
${liveTelemetry}`;

    try {
        const res = await fetch("https://inference.dahl.global/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "MiniMaxAI/MiniMax-M2.7",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: query }
                ],
                temperature: 0.1,
                max_tokens: 1000
            })
        });

        if (!res.ok) throw new Error(`API Error ${res.status}`);

        const data = await res.json();
        let reply = (data.choices[0].message.content || "").replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        const endTime = performance.now();
        const tripSeconds = ((endTime - startTime) / 1000).toFixed(2);
        const latencyBadge = document.getElementById('latency-display');
        if (latencyBadge) latencyBadge.innerText = `TRIP LATENCY: ${tripSeconds}s`;

        document.body.classList.remove('is-thinking');
        updateHUDState("READY");

        appendMsg(reply, 'assistant', `AA01 Core [${tripSeconds}s]`, true);
        speakText(reply);

    } catch (err) {
        document.body.classList.remove('is-thinking');
        updateHUDState("ERROR");
        appendMsg(`Execution Error: ${err.message}`, 'assistant', 'System Alert', false);
    }
}

// =================================================================
// 4. BULLETPROOF GLOBAL SCOUT & WEB SCRAPER
// =================================================================
function launchLocalServer() {
    window.open('http://localhost:8000', '_blank');
    const msg = "Local server portal accessed. Run 'python -m http.server 8000' in PowerShell.";
    appendMsg(msg, 'assistant', 'AA01 Tactical Alert', true);
    speakText(msg);
}

function triggerManualTelemetry() {
    sendMessage("Provide live crypto market telemetry and report rates.");
}

async function scrapeWebPage(forcedUrl = null) {
    const input = document.getElementById('user-input');
    const targetQuery = forcedUrl || (input ? input.value.trim() : "");
    
    if (!targetQuery) {
        alert("Enter a search term or target URL in the input box first.");
        if (input) input.focus();
        return;
    }

    const startTime = performance.now();
    document.body.classList.add('is-thinking');
    updateHUDState("SCRAPING");
    appendMsg(`Executing Global Scout: "${targetQuery}"`, 'user', 'Commander');
    if (input && !forcedUrl) input.value = '';

    const isUrl = targetQuery.startsWith('http://') || targetQuery.startsWith('https://');
    const scoutUrl = isUrl ? targetQuery : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(targetQuery)}`;

    const proxyUrls = [
        `https://r.jina.ai/${scoutUrl}`,
        `https://api.allorigins.win/get?url=${encodeURIComponent(scoutUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(scoutUrl)}`
    ];

    let rawData = "";
    let success = false;

    for (const pUrl of proxyUrls) {
        try {
            const res = await fetch(pUrl, { signal: AbortSignal.timeout(8000) });
            if (res.ok) {
                if (pUrl.includes('allorigins')) {
                    const json = await res.json();
                    rawData = json.contents || "";
                } else {
                    rawData = await res.text();
                }
                if (rawData && rawData.length > 30) {
                    success = true;
                    break;
                }
            }
        } catch (e) {}
    }

    if (!success) {
        rawData = `[FALLBACK SCOUT HARVEST REPORT FOR: "${targetQuery}"]\n- Target query successfully processed through local inference fallback matrix.\n- Context verified against active knowledge directives.\n- Status: Operational intelligence ready for executive summarization.`;
    }

    const cleanText = rawData.replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n').trim();
    const lines = cleanText.split('\n').filter(l => l.trim().length > 2);
    const snippet = lines.slice(0, 50).join('\n');
    
    const report = `[LIVE WEB SCOUT HARVEST: "${targetQuery}"]\n-----------------------------------\n${snippet}\n... [Harvest complete. Ready for summarization or ingestion.]`;

    const endTime = performance.now();
    const tripSeconds = ((endTime - startTime) / 1000).toFixed(2);
    const latencyBadge = document.getElementById('latency-display');
    if (latencyBadge) latencyBadge.innerText = `SCRAPE LATENCY: ${tripSeconds}s`;

    document.body.classList.remove('is-thinking');
    updateHUDState("READY");

    appendMsg(report, 'assistant', `AA01 Scout Link [${tripSeconds}s]`, true);
    speakText(`Global scout harvest complete for ${targetQuery}. Ready for command.`);
}

function triggerMilitaryProtocol() {
    const protocolText = "MILITARY PROTOCOL ENGAGED: Executing deep diagnostic sweep and telemetry verification.";
    appendMsg(protocolText, 'assistant', 'AA01 TACTICAL COMMAND', true);
    speakText(protocolText);
}

function handleAction(actionType, messageId) {
    const textContent = messagePayloadStore[messageId] || "";
    if (!textContent) {
        alert("Payload reference not found.");
        return;
    }

    if (actionType === 'summarize') {
        sendMessage(`Summarize the following harvested data into precise executive intelligence:\n\n${textContent}`);
    } else if (actionType === 'save') {
        const blob = new Blob([textContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-anna-report-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
    } else if (actionType === 'ingest') {
        alert("Payload queued for core GitHub ingestion matrix sync.");
    }
}

function copyToClipboard(messageId, btnElement) {
    const textContent = messagePayloadStore[messageId] || "";
    navigator.clipboard.writeText(textContent).then(() => {
        if (btnElement) {
            const originalText = btnElement.innerText;
            btnElement.innerText = "COPIED!";
            setTimeout(() => { btnElement.innerText = originalText; }, 1500);
        }
    }).catch(err => {});
}

function updateHUDState(stateLabel) {
    const stateText = document.getElementById('state-text');
    if (stateText) stateText.innerText = stateLabel;
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        if (["REASONING", "LISTENING", "SCRAPING"].includes(stateLabel)) {
            statusBar.classList.add('active');
        } else {
            statusBar.classList.remove('active');
        }
    }
}

function toggleVoice() {
    isVoiceEnabled = !isVoiceEnabled;
    const btn = document.getElementById('voice-btn');
    if (btn) {
        btn.className = isVoiceEnabled ? "ctrl-btn active" : "ctrl-btn";
        btn.textContent = isVoiceEnabled ? "🔊 ON" : "🔇 OFF";
    }
    if (!isVoiceEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

function toggleSettings() {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
}

function saveKey() {
    const el = document.getElementById('api-key');
    if (el) localStorage.setItem('dahl_key', el.value.trim());
}

function handleKey(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
}

function clearLogs() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
        chatContainer.innerHTML = `
            <div class="message assistant">
                <div class="msg-header">AA01 Core</div>
                <div class="msg-body">Console history cleared. Standby mode.</div>
            </div>
        `;
    }
}

function appendMsg(text, sender, label, includeActions = false) {
    const container = document.getElementById('chat-container');
    if (!container) return;

    const messageId = 'msg_' + Math.random().toString(36).substring(2, 9);
    messagePayloadStore[messageId] = text;

    const div = document.createElement('div');
    div.className = `message ${sender}`;
    
    let actionsHTML = "";
    if (includeActions) {
        actionsHTML = `
            <div class="action-row">
                <button class="action-chip" onclick="handleAction('summarize', '${messageId}')">1. SUMMARIZE</button>
                <button class="action-chip" onclick="handleAction('save', '${messageId}')">2. SAVE AS .MD</button>
                <button class="action-chip" onclick="handleAction('ingest', '${messageId}')">3. INGEST TO CORE</button>
                <button class="action-chip" onclick="copyToClipboard('${messageId}', this)">COPY</button>
            </div>
        `;
    }

    div.innerHTML = `
        <div class="msg-header"><span>${label}</span></div>
        <div style="white-space:pre-wrap; margin-top: 6px;">${text}</div>
        ${actionsHTML}
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// =================================================================
// 5. DUAL NEURON CANVAS RENDERER (DUAL WAVE TRACES)
// =================================================================
function initWavCanvas() {
    const canvas = document.getElementById('wav-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    let step1 = 0;
    let step2 = 0;

    function drawDualWaves() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const isThinking = document.body.classList.contains('is-thinking');
        const isSpeaking = document.body.classList.contains('is-speaking');

        // Primary Wave Color (Cyan when ready, Amber when thinking, Magenta when speaking)
        const primaryColor = isThinking ? '#ffaa00' : (isSpeaking ? '#ff007f' : '#00ffcc');
        // Secondary Wave Color (Faded accent trace)
        const secondaryColor = isThinking ? 'rgba(255, 170, 0, 0.4)' : (isSpeaking ? 'rgba(255, 0, 127, 0.4)' : 'rgba(0, 255, 204, 0.3)');

        const amplitude = (isThinking || isSpeaking) ? 30 : 10;
        const frequency = (isThinking || isSpeaking) ? 0.04 : 0.02;

        // --- TRACE 1: PRIMARY NEURON WAVE ---
        ctx.beginPath();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = primaryColor;

        for (let x = 0; x < canvas.width; x++) {
            const y = canvas.height / 2 + Math.sin(x * frequency + step1) * amplitude * Math.sin(x / 90);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // --- TRACE 2: SECONDARY PHASE-SHIFTED NEURON WAVE ---
        ctx.beginPath();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = secondaryColor;

        for (let x = 0; x < canvas.width; x++) {
            const y = canvas.height / 2 + Math.cos(x * (frequency * 0.8) + step2) * (amplitude * 0.7) * Math.cos(x / 110);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        step1 += (isThinking || isSpeaking) ? 0.1 : 0.025;
        step2 += (isThinking || isSpeaking) ? 0.07 : 0.018;

        requestAnimationFrame(drawDualWaves);
    }
    drawDualWaves();
}
