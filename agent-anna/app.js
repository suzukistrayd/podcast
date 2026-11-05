// =================================================================
// AGENT ANNA 01 (AA01) // ALL-IN-ONE MILITARY ENGINE (app.js)
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

// Secure global registry for action button payload mapping
window.aaRegistry = {};

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
            if (prices.bitcoin) btc = `$${prices.bitcoin.usd.toLocaleString()}`; if (prices.ethereum) eth = `$${prices.ethereum.usd.toLocaleString()}`;
            if (prices.dogecoin) doge = `$${prices.dogecoin.usd.toFixed(4)}`; if (prices.solana) sol = `$${prices.solana.usd.toFixed(2)}`;
        }
    } catch (e) {}

    return `[LIVE TELEMETRY HARVEST]
- Solana (SOL): ${sol}
- Bitcoin (BTC): ${btc}
- Ethereum (ETH): ${eth}
- Dogecoin (DOGE): ${doge}`;
}

// =================================================================
// 3. VOICE SYNTHESIZER & REASONING DISPATCH
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
    
    const systemPrompt = `You are AGENT ANNA 01 (AA01). Provide direct, high-speed, professional executive responses. Never ask clarifying questions or stall. Execute immediately.

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
// 4. BULLETPROOF SCOUT ENGINE (SCRAPE + LLM INTELLIGENCE)
// =================================================================
async function scrapeWebPage() {
    const input = document.getElementById('user-input');
    let query = input ? input.value.trim() : "";
    if (!query) query = "martin strayd kunda cafe";

    const startTime = performance.now();
    document.body.classList.add('is-thinking');
    updateHUDState("SCRAPING");
    appendMsg(`Executing Global Scout: "${query}"`, 'user', 'Commander', false);
    if (input) input.value = '';

    let extractedSnippets = [];

    // Step 1: Direct URL Scrape
    if (query.startsWith('http://') || query.startsWith('https://')) {
        try {
            const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(query)}`);
            if (res.ok) {
                const htmlContent = await res.text();
                const cleanText = htmlContent.replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n').trim();
                const lines = cleanText.split('\n').filter(l => l.trim().length > 15);
                finishScrape(`[PORTAL HARVEST: ${query}]\n-----------------------------------\n${lines.slice(0, 40).join('\n')}`, startTime, "URL harvested successfully.");
                return;
            }
        } catch (e) {}
    }

    // Step 2: Wikipedia Direct Check
    try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/\s+/g, '_'))}`;
        const wRes = await fetch(wikiUrl);
        if (wRes.ok) {
            const wData = await wRes.json();
            if (wData.extract) {
                extractedSnippets.push(`• [Wikipedia]: ${wData.extract}`);
            }
        }
    } catch (e) {}

    // Step 3: DuckDuckGo Instant Answer Check
    if (extractedSnippets.length === 0) {
        try {
            const dRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
            if (dRes.ok) {
                const dData = await dRes.json();
                if (dData.AbstractText) {
                    extractedSnippets.push(`• ${dData.AbstractText}`);
                }
            }
        } catch (e) {}
    }

    // Output immediately if client-side scrapers yielded snippets
    if (extractedSnippets.length > 0) {
        const report = `[LIVE WEB SEARCH RESULTS: "${query}"]\n-----------------------------------\n${extractedSnippets.join('\n\n')}\n-----------------------------------`;
        finishScrape(report, startTime, `Scout complete for ${query}.`);
        return;
    }

    // Step 4: Intelligent LLM Scout Fallback (Ensures full factual detail every time)
    const keyEl = document.getElementById('api-key');
    const apiKey = keyEl ? keyEl.value.trim() : "";

    if (apiKey) {
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
                        { role: "system", content: "You are a web intelligence scout. Provide clear, detailed, factual background and operational context for the requested topic." },
                        { role: "user", content: `Provide detailed background, facts, and operational details for: "${query}"` }
                    ],
                    temperature: 0.1,
                    max_tokens: 1500
                })
            });

            if (res.ok) {
                const data = await res.json();
                const reply = (data.choices[0].message.content || "").replace(/<think>[\s\S]*?<\/think>/g, '').trim();
                const report = `[LIVE SEARCH INTEL: "${query}"]\n-----------------------------------\n${reply}\n-----------------------------------`;
                finishScrape(report, startTime, `Intel retrieved for ${query}.`);
                return;
            }
        } catch (err) {}
    }

    finishScrape(`[SEARCH ALERT: "${query}"]\n-----------------------------------\nNo live proxy snippet returned. Tap ⚙️ KEYS to enable LLM Web Scout synthesis.\n-----------------------------------`, startTime, "Scout complete.");
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
    if
