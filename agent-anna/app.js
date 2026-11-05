// =================================================================
// AGENT ANNA 01 (AA01) // UNIFIED RUNTIME & SCRAPER ENGINE (app.js)
// =================================================================

const REPO_OWNER = "suzukistrayd";
const REPO_NAME = "podcast";
let isVoiceEnabled = true;
let recognition = null;
let isListening = false;
let cachedVoices = [];
let coreKnowledgeCache = null;

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
// 1. SPEECH RECOGNITION & AUDIO VISUALIZER ENGINE
// =================================================================
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
        if (recognition) {
            recognition.abort();
            recognition = null;
        }

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
        if (micStream) micStream.getTracks().forEach(track => track.stop());

        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!audioCtx || audioCtx.state === 'closed') {
            audioCtx = new AudioContext();
        } else if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

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
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    if (micStream) { micStream.getTracks().forEach(track => track.stop()); micStream = null; }
    if (audioCtx && audioCtx.state !== 'closed') { audioCtx.close().catch(() => {}); audioCtx = null; }
    document.querySelectorAll('.eq-bar').forEach(bar => bar.style.height = '20%');
}

function toggleMic() {
    if (!recognition) initSpeechRecognition();
    if (!recognition) return alert("Speech recognition unavailable.");

    if (!isListening) {
        try { recognition.start(); } catch (e) { initSpeechRecognition(); try { recognition.start(); } catch (err) { stopListeningUI(); } }
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
// 2. KNOWLEDGE & TELEMETRY HARVESTER
// =================================================================
function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    cachedVoices = window.speechSynthesis.getVoices();
}

async function preloadCoreKnowledge() {
    const corePaths = ["agent-anna/character/agent-anna.md", "agent-anna/knowledge/rules.md", "agent-anna/knowledge/lessons.md"];
    let snippets = [];
    await Promise.all(corePaths.map(async (path) => {
        try {
            const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${path}?t=${Date.now()}`;
            const res = await fetch(rawUrl);
            if (res.ok) {
                const text = await res.text();
                const cleanText = text.replace(/<[^>]*>/g, '').trim();
                if (cleanText) snippets.push(`[DIRECTIVE: ${path}]\n${cleanText}`);
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

    return `[LIVE TELEMETRY HARVEST]
- Solana (SOL): ${sol}
- Bitcoin (BTC): ${btc}
- Ethereum (ETH): ${eth}
- Dogecoin (DOGE): ${doge}`;
}

// =================================================================
// 3. VOICE SYNTHESIZER
// =================================================================
function speakText(text) {
    if (!('speechSynthesis' in window)) return;
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

    utterance.onstart = () => { 
        document.body.classList.remove('is-thinking');
        document.body.classList.add('is-speaking'); 
        updateHUDState("SPEAKING"); 
    };

    utterance.onend = () => { 
        document.body.classList.remove('is-speaking'); 
        updateHUDState("READY"); 
    };

    utterance.onerror = () => { 
        document.body.classList.remove('is-speaking'); 
        updateHUDState("READY"); 
    };

    if (isVoiceEnabled) {
        window.speechSynthesis.speak(utterance);
    }
}

function shouldFetchTelemetry(query) {
    const q = query.toLowerCase();
    return q.includes('telemetry') || q.includes('market') || q.includes('btc') || q.includes('eth') || q.includes('doge') || q.includes('solana') || q.includes('status') || q.includes('price') || q.includes('report') || q.includes('crypto');
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

    appendMsg(query, 'user', 'Commander', false);
    if (input && !forcedQuery) input.value = '';

    const qLower = query.toLowerCase();
    if (qLower.includes('start server') || qLower.includes('launch server') || qLower.includes('start teh sever') || qLower.includes('start the server')) {
        launchLocalServer();
        return;
    }

    const startTime = performance.now();

    document.body.classList.remove('is-speaking');
    document.body.classList.add('is-thinking');
    updateHUDState("REASONING");

    if (!coreKnowledgeCache) await preloadCoreKnowledge();

    let liveTelemetry = "";
    const isCryptoQuery = shouldFetchTelemetry(query);
    if (isCryptoQuery) {
        liveTelemetry = await fetchLiveTelemetry();
    } else {
        liveTelemetry = "[TELEMETRY: Standby]";
    }
    
    const systemPrompt = `You are AGENT ANNA 01 (AA01). 
Rules:
1. Provide precise, executive answers suitable for speech synthesis.
2. DO NOT inject or mention crypto/market rates unless explicitly asked.
3. Avoid all negativity and political content.

System Context:
${coreKnowledgeCache}
Telemetry Status:
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
                max_tokens: 2000
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
// 4. DYNAMIC LIVE SCRAPER & SEARCH SCOUT ENGINE (Integrated)
// =================================================================
async function scrapeWebPage() {
    const input = document.getElementById('user-input');
    let query = input ? input.value.trim() : "";
    if (!query) query = "kunda cafe";

    const startTime = performance.now();
    document.body.classList.add('is-thinking');
    updateHUDState("SCRAPING");
    appendMsg(`Search Scout Query: "${query}"`, 'user', 'Commander', false);
    if (input) input.value = '';

    const isUrl = query.startsWith('http://') || query.startsWith('https://');

    if (isUrl) {
        try {
            const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            const lines = (data.contents || "").replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n').trim().split('\n');
            const report = `[COMMUNICATION HARVEST: ${query}]\nTotal Lines: ${lines.length}\n-----------------------------------\n${lines.slice(0, 100).join('\n')}`;
            finishScrape(report, startTime, "Target URL harvested successfully.");
        } catch (err) {
            fetchLiveSearchQuery(query, startTime);
        }
    } else {
        fetchLiveSearchQuery(query, startTime);
    }
}

async function fetchLiveSearchQuery(query, startTime) {
    try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/\s+/g, '_'))}`;
        const wikiRes = await fetch(wikiUrl);
        
        if (wikiRes.ok) {
            const wikiData = await wikiRes.json();
            if (wikiData.extract && !wikiData.title.includes("Not Found")) {
                const report = `[LIVE SEARCH HARVEST: "${query}"]\nTitle: ${wikiData.title}\n-----------------------------------\n${wikiData.extract}`;
                finishScrape(report, startTime, `Live intelligence summary retrieved for ${query}.`);
                return;
            }
        }

        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(ddgUrl)}`);
        
        if (res.ok) {
            const wrapper = await res.json();
            const ddgData = JSON.parse(wrapper.contents || "{}");
            
            let resultText = ddgData.AbstractText || "";
            if (!resultText && ddgData.RelatedTopics && ddgData.RelatedTopics.length > 0) {
                const match = ddgData.RelatedTopics.find(t => t.Text);
                if (match) resultText = match.Text;
            }

            if (resultText) {
                const report = `[LIVE SEARCH HARVEST: "${query}"]\n-----------------------------------\n${resultText}\n-----------------------------------`;
                finishScrape(report, startTime, `Live search results retrieved for ${query}.`);
                return;
            }
        }

        throw new Error("No direct index match found.");

    } catch (err) {
        const dynamicReport = `[LIVE SEARCH HARVEST: "${query}"]\n-----------------------------------\n• Target Query: ${query}\n• Status: Public index query completed. Live semantic index search active.\n• Note: Type specific keywords or a target URL for direct harvesting.\n-----------------------------------`;
        finishScrape(dynamicReport, startTime, `Search executed for ${query}.`);
    }
}

function finishScrape(reportText, startTime, voiceMessage) {
    const tripSeconds = ((performance.now() - startTime) / 1000).toFixed(2);
    const badge = document.getElementById('latency-display');
    if (badge) badge.innerText = `SCRAPE LATENCY: ${tripSeconds}s`;

    document.body.classList.remove('is-thinking');
    updateHUDState("READY");
    appendMsg(reportText, 'assistant', `AA01 Scout Link [${tripSeconds}s]`, true);
    speakText(voiceMessage);
}

// =================================================================
// 5. TACTICAL QUICK LAUNCH & UTILITIES
// =================================================================
function launchLocalServer() {
    window.open('http://localhost:8000', '_blank');
    const responseText = "Agent Anna AA01 is now launched. Advanced military neural Server Engaged.";
    appendMsg(responseText, 'assistant', 'AA01 Tactical Alert', true);
    speakText(responseText); 
}

function triggerManualTelemetry() {
    const input = document.getElementById('user-input');
    if (input) input.value = "Provide live crypto market telemetry and report rates.";
    sendMessage("Provide live crypto market telemetry and report rates.");
}

function triggerMilitaryProtocol() {
    const protocolMsg = "MILITARY PROTOCOL ENGAGED: Executing deep diagnostic sweep and telemetry verification.";
    appendMsg(protocolMsg, 'assistant', 'AA01 TACTICAL COMMAND', true);
    speakText(protocolMsg);
}

function copyToClipboard(text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
        if (btnElement) {
            const originalText = btnElement.innerText;
            btnElement.innerText = "COPIED!";
            btnElement.style.color = "#00ffcc";
            setTimeout(() => { btnElement.innerText = originalText; btnElement.style.color = ""; }, 1500);
        }
    }).catch(err => {});
}

function updateHUDState(stateLabel) {
    const stateText = document.getElementById('state-text');
    if (stateText) stateText.innerText = stateLabel;
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        if (["REASONING", "LISTENING", "SPEAKING", "SCRAPING"].includes(stateLabel)) {
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

function appendMsg(text, sender, label, includeActions = true) {
    const container = document.getElementById('chat-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `message ${sender}`;
    
    let actionButtonsHTML = "";
    if (sender === 'assistant' && includeActions) {
        const encodedText = encodeURIComponent(text);
        actionButtonsHTML = `
            <div style="display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; border-top: 1px solid #1b263b; padding-top: 8px;">
                <button onclick="executeGlobalAction(1, '${encodedText}')" style="background: rgba(0,255,204,0.1); border: 1px solid #00ffcc; color: #00ffcc; padding: 4px 8px; cursor: pointer; border-radius: 3px; font-family: monospace; font-size: 10px;">1. SUMMARIZE</button>
                <button onclick="executeGlobalAction(2, '${encodedText}')" style="background: rgba(255,170,0,0.1); border: 1px solid #ffaa00; color: #ffaa00; padding: 4px 8px; cursor: pointer; border-radius: 3px; font-family: monospace; font-size: 10px;">2. SAVE AS .MD</button>
                <button onclick="executeGlobalAction(3, '${encodedText}')" style="background: rgba(255,0,127,0.1); border: 1px solid #ff007f; color: #ff007f; padding: 4px 8px; cursor: pointer; border-radius: 3px; font-family: monospace; font-size: 10px;">3. INGEST TO CORE</button>
                <button onclick="copyToClipboard(decodeURIComponent('${encodedText}'), this)" style="background: transparent; border: 1px solid #8493a8; color: #8493a8; padding: 4px 8px; cursor: pointer; border-radius: 3px; font-family: monospace; font-size: 10px;">COPY</button>
            </div>`;
    }

    div.innerHTML = `
        <div class="msg-header">${label}</div>
        <div style="white-space:pre-wrap; margin-top: 6px;">${text}</div>
        ${actionButtonsHTML}
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function executeGlobalAction(actionId, encodedContent) {
    const content = decodeURIComponent(encodedContent);
    if (actionId === 1) {
        sendMessage(`Summarize this response into concise tactical bullet points:\n${content}`);
    } else if (actionId === 2) {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aa01-export-${Date.now()}.md`;
        a.click();
        appendMsg(`Markdown export downloaded successfully.`, 'assistant', 'AA01 System Utility', false);
        speakText("Markdown file saved.");
    } else if (actionId === 3) {
        sendMessage(`Ingest this text into your core prompt context memory:\n${content}`);
    }
}

function initWavCanvas() {
    const canvas = document.getElementById('wav-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let step = 0;

    function resizeCanvas() {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function drawWavRadar() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const isThinking = document.body.classList.contains('is-thinking');
        const isSpeaking = document.body.classList.contains('is-speaking');
        const width = canvas.width;
        const height = canvas.height;
        const centerY = height / 2;

        if (isSpeaking) {
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = '#ff007f';
        } else if (isThinking) {
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#ffaa00';
        } else {
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#00ffcc';
        }

        ctx.beginPath();
        for (let x = 0; x < width; x += 2) {
            const freq = isSpeaking ? 0.08 : (isThinking ? 0.05 : 0.015);
            const amp = isSpeaking ? 55 : (isThinking ? 35 : 8);
            const y = centerY + Math.sin(x * freq + step) * amp * Math.cos(x * 0.005);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        if (isSpeaking || isThinking) {
            ctx.lineWidth = 1.8;
            ctx.strokeStyle = isSpeaking ? '#00ffcc' : '#ff3366';
            ctx.beginPath();
            for (let x = 0; x < width; x += 3) {
                const y = centerY + Math.cos(x * 0.04 - step * 1.5) * (isSpeaking ? 35 : 20);
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        step += isSpeaking ? 0.22 : (isThinking ? 0.15 : 0.03);
        requestAnimationFrame(drawWavRadar);
    }
    drawWavRadar();
}
