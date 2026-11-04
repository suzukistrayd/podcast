// =================================================================
// AGENT ANNA // RESTORED WORKING MISSION CONTROL ENGINE
// =================================================================

const REPO_OWNER = "suzukistrayd";
const REPO_NAME = "podcast";
let isVoiceEnabled = true;
let recognition = null;
let isListening = false;
let cachedVoices = [];
let coreKnowledgeCache = null;

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

// WORKING SPEECH RECOGNITION
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
            const stateText = document.getElementById('state-text');
            if (stateText) stateText.innerText = "LISTENING";
        };

        recognition.onresult = function(event) {
            const speechText = event.results[0][0].transcript;
            const userInput = document.getElementById('user-input');
            if (userInput) userInput.value = speechText;
            stopListeningUI();
            sendMessage();
        };

        recognition.onerror = function(event) {
            stopListeningUI();
        };

        recognition.onend = function() {
            stopListeningUI();
        };
    } catch (err) {}
}

function toggleMic() {
    if (!recognition) initSpeechRecognition();
    if (!recognition) return alert("Speech recognition is unavailable in this environment.");

    if (!isListening) {
        try { recognition.start(); } catch (e) { stopListeningUI(); }
    } else {
        try { recognition.stop(); } catch (e) {}
        stopListeningUI();
    }
}

function stopListeningUI() {
    isListening = false;
    const micBtn = document.getElementById('mic-btn');
    if (micBtn) micBtn.classList.remove('listening');
    const stateText = document.getElementById('state-text');
    if (stateText && stateText.innerText === "LISTENING") {
        stateText.innerText = "READY";
    }
}

function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    cachedVoices = window.speechSynthesis.getVoices();
}

// PRELOAD CORE KNOWLEDGE
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

// FETCH TELEMETRY RELAY
async function fetchLiveTelemetry() {
    try {
        const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/portal-relay.json?t=${Date.now()}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            return `[LIVE TELEMETRY RELAY]\n- Status: ${data.status || 'ACTIVE'}\n- Active Bot: ${data.active_bot || 'N/A'}\n- Equity: ${data.solana_equity || '$142.85'}\n- Signal: ${data.latest_signal || 'None'}`;
        }
    } catch (e) {}
    return "";
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

// AUDIO SYNTHESIZER
function speakText(text) {
    if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/<[^>]*>/g, '').replace(/[*_#`~]/g, '').trim();
    if (!clean) return;

    if (cachedVoices.length === 0) loadVoices();
    const utterance = new SpeechSynthesisUtterance(clean);

    const preferred = ["Google UK English Female", "en-GB-Neural2-F", "Sonia", "Hazel", "Samantha", "Google US English"];
    let selectedVoice = cachedVoices.find(v => preferred.some(p => v.name.includes(p)));
    if (!selectedVoice) selectedVoice = cachedVoices.find(v => v.lang.startsWith('en') && !v.name.toLowerCase().includes('male'));

    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.pitch = 1.05;
    utterance.rate = 0.94;
    window.speechSynthesis.speak(utterance);
}

// INFERENCE DISPATCH
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
    const statusBar = document.getElementById('status-bar');
    if (statusBar) statusBar.classList.add('active');
    
    const stateText = document.getElementById('state-text');
    if (stateText) stateText.innerText = "REASONING";

    if (!coreKnowledgeCache) await preloadCoreKnowledge();
    const liveTelemetry = await fetchLiveTelemetry();
    const combinedContext = `${coreKnowledgeCache}\n\n${liveTelemetry}`;

    const systemPrompt = `You are AGENT ANNA, a military-grade execution engine operating under character/agent-anna.md.
Provide direct, single-sentence execution answers suitable for clear voice synthesis readout.

Context:
${combinedContext}`;

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
        if (statusBar) statusBar.classList.remove('active');
        if (stateText) stateText.innerText = "READY";

        appendMsg(reply, 'assistant', 'Agent Anna Core');
        speakText(reply);

    } catch (err) {
        document.body.classList.remove('is-thinking');
        if (statusBar) statusBar.classList.remove('active');
        if (stateText) stateText.innerText = "ERROR";
        appendMsg(`Execution Error: ${err.message}`, 'assistant', 'System Alert');
    }
}

function appendMsg(text, sender, label) {
    const container = document.getElementById('chat-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.innerHTML = `
        <div class="msg-header">${label}</div>
        <div style="white-space:pre-wrap;">${text}</div>
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}
