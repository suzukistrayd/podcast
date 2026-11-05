// =================================================================
// AGENT ANNA // MILITARY-GRADE BASE ENGINE + WORKFLOW CLIPBOARD SYNC
// =================================================================

const REPO_OWNER = "suzukistrayd";
const REPO_NAME = "podcast";
let isVoiceEnabled = true;
let recognition = null;
let isListening = false;
let cachedVoices = [];
let coreKnowledgeCache = null;

// Audio Visualizer Context
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
                const heightPercent = Math.max(15, Math.min(100, (val / 255) * 100));
                bar.style.height = `${heightPercent}%`;
            });

            animFrameId = requestAnimationFrame(renderFrame);
        }

        renderFrame();
    } catch (e) {}
}

function stopAudioVisualizer() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
    }
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }
    const eqBars = document.querySelectorAll('.eq-bar');
    eqBars.forEach(bar => bar.style.height = '20%');
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
    if (stateText && stateText.innerText === "LISTENING") {
        updateHUDState("READY");
    }
}

// =================================================================
// 2. CORE KNOWLEDGE & TELEMETRY HARVESTER
// =================================================================
function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    cachedVoices = window.speechSynthesis.getVoices();
}

async function preloadCoreKnowledge() {
    const corePaths = [
        "agent-anna/character/agent-anna.md",
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
                if (cleanText) snippets.push(`[CORE DIRECTIVE: ${path}]\n${cleanText}`);
            }
        } catch (e) {}
    }));
    coreKnowledgeCache = snippets.join('\n\n---\n\n');
}

async function fetchLiveTelemetry() {
    let btc = "Unavailable", eth = "Unavailable", doge = "Unavailable";
    
    try {
        const cryptoRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,dogecoin&vs_currencies=usd");
        if (cryptoRes.ok) {
            const prices = await cryptoRes.json();
            if (prices.bitcoin) btc = `$${prices.bitcoin.usd.toLocaleString()}`;
            if (prices.ethereum) eth = `$${prices.ethereum.usd.toLocaleString()}`;
            if (prices.dogecoin) doge = `$${prices.dogecoin.usd.toFixed(4)}`;
        }
    } catch (e) {}

    let status = "ONLINE", activeBot = "Grok Scanner", solanaEquity = "$142.85", signal = "Active";
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
- BTC Price: ${btc}
- ETH Price: ${eth}
- DOGE Price: ${doge}
- Signal Metric: ${signal}`;
}

// =================================================================
// 3. VOICE SYNTHESIZER & INFERENCE LOOP
// =================================================================
function speakText(text) {
    if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
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
    utterance.rate = 0.94;
    window.speechSynthesis.speak(utterance);
}

async function sendMessage() {
    const keyEl = document.getElementById('api-key');
    const input = document.getElementById('user-input');
    const apiKey = keyEl ? keyEl.value.trim() : "";
    const query = input ? input.value.trim() : "";

    if (!apiKey) {
        alert('Please tap ⚙️ KEYS and paste your Dahl API Key.');
        toggleSettings();
        return;
    }
    if (!query) return;

    appendMsg(query, 'user', 'Commander');
    if (input) input.value = '';

    document.body.classList.add('is-thinking');
    updateHUDState("REASONING");

    if (!coreKnowledgeCache) await preloadCoreKnowledge();
    const liveTelemetry = await fetchLiveTelemetry();
    
    const systemPrompt = `You are AGENT ANNA, a military-grade execution engine operating under character/agent-anna.md.
Rules:
1. Provide precise, executive answers suitable for speech synthesis.
2. Integrate telemetry statistics directly when asked for system state or market metrics.

System Context:
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

        document.body.classList.remove('is-thinking');
        updateHUDState("READY");

        appendMsg(reply, 'assistant', 'Agent Anna Core', true);
        speakText(reply);

    } catch (err) {
        document.body.classList.remove('is-thinking');
        updateHUDState("ERROR");
        appendMsg(`Execution Error: ${err.message}`, 'assistant', 'System Alert', false);
    }
}

// =================================================================
// 4. WORKFLOW CLIPBOARD AUTOMATION & UTILITIES
// =================================================================
function copyToClipboard(text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
        if (btnElement) {
            const originalText = btnElement.innerText;
            btnElement.innerText = "COPIED!";
            btnElement.style.color = "#00ffcc";
            setTimeout(() => {
                btnElement.innerText = originalText;
                btnElement.style.color = "";
            }, 1500);
        }
    }).catch(err => {
        console.error("Clipboard copy failed:", err);
    });
}

function updateHUDState(stateLabel) {
    const stateText = document.getElementById('state-text');
    if (stateText) stateText.innerText = stateLabel;
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        if (stateLabel === "REASONING" || stateLabel === "LISTENING") {
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
                <div class="msg-header">Agent Anna Core</div>
                <div class="msg-body">Console history cleared. Standby mode.</div>
            </div>
        `;
    }
}

function appendMsg(text, sender, label, includeCopy = false) {
    const container = document.getElementById('chat-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `message ${sender}`;
    
    let copyBtnHTML = "";
    if (includeCopy) {
        const encodedText = encodeURIComponent(text);
        copyBtnHTML = `<button class="copy-telemetry-btn" onclick="copyToClipboard(decodeURIComponent('${encodedText}'), this)" style="float: right; background: transparent; border: 1px solid #00ffcc; color: #00ffcc; font-size: 10px; padding: 2px 6px; cursor: pointer; border-radius: 3px; font-family: monospace;">[COPY DATA]</button>`;
    }

    div.innerHTML = `
        <div class="msg-header">${label} ${copyBtnHTML}</div>
        <div style="white-space:pre-wrap; margin-top: 6px;">${text}</div>
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    if (includeReflexiveWorkflow(text)) {
        navigator.clipboard.writeText(text).catch(() => {});
    }
}

function includeReflexiveWorkflow(text) {
    return text.includes("BTC Price") || text.includes("DOGE Price") || text.includes("LIVE TELEMETRY");
}
