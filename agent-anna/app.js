// =================================================================
// AGENT ANNA // ENTERPRISE DAHL & GITHUB REST ENGINE (V14)
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
        const savedKey = localStorage.getItem('dahl_api_key');
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

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;

        recognition.onresult = function(event) {
            const speechText = event.results[0][0].transcript;
            const userInput = document.getElementById('user-input');
            if (userInput) userInput.value = speechText;
            stopListeningUI();
            sendMessage();
        };
        recognition.onerror = stopListeningUI;
        recognition.onend = stopListeningUI;
    } catch (err) {}
}

function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    cachedVoices = window.speechSynthesis.getVoices();
}

async function preloadCoreKnowledge() {
    const corePaths = [
        "knowledge/rules.md",
        "characters/veganna/veganna.md",
        "knowledge/kundacafe.md"
    ];
    let snippets = [];
    await Promise.all(corePaths.map(async (path) => {
        try {
            const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${path}?t=${Date.now()}`;
            const res = await fetch(rawUrl);
            if (res.ok) {
                const text = await res.text();
                const cleanText = text.replace(/<[^>]*>/g, '').trim();
                if (cleanText) snippets.push(`[FILE: ${path}]\n${cleanText}`);
            }
        } catch (e) {}
    }));
    coreKnowledgeCache = snippets.join('\n\n---\n\n');
}

async function fetchTargetedContext(query) {
    let snippets = [];
    const queryLower = query.toLowerCase();
    let pathsToFetch = [];

    if (queryLower.includes("book") || queryLower.includes("chapter")) pathsToFetch.push("knowledge/book-chapters/chapter-2-sovereignty.md");
    if (queryLower.includes("scout") || queryLower.includes("dahl")) pathsToFetch.push("dahl-bridge/dahl-intel-packet.md");
    if (queryLower.includes("rules")) pathsToFetch.push("knowledge/rules.md");

    if (pathsToFetch.length === 0) return "";

    await Promise.all(pathsToFetch.map(async (path) => {
        try {
            const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${path}?t=${Date.now()}`;
            const res = await fetch(rawUrl);
            if (res.ok) {
                const text = await res.text();
                const clean = text.replace(/<[^>]*>/g, '').trim();
                if (clean) snippets.push(`[TARGET CONTEXT: ${path}]\n${clean}`);
            }
        } catch (e) {}
    }));

    return snippets.join('\n\n---\n\n');
}

function toggleSpeechRecognition() {
    if (!recognition) return alert("Speech recognition not supported.");
    const micBtn = document.getElementById('mic-btn');
    if (!isListening) {
        try {
            recognition.start();
            isListening = true;
            if (micBtn) micBtn.style.borderColor = "#ff3366";
        } catch (e) { stopListeningUI(); }
    } else {
        try { recognition.stop(); } catch (e) {}
        stopListeningUI();
    }
}

function stopListeningUI() {
    isListening = false;
    const micBtn = document.getElementById('mic-btn');
    if (micBtn) micBtn.style.borderColor = "var(--border-subtle)";
}

function toggleVoice() {
    isVoiceEnabled = !isVoiceEnabled;
    const btn = document.getElementById('voice-btn');
    if (btn) {
        btn.className = isVoiceEnabled ? "voice-toggle-btn active" : "voice-toggle-btn";
        btn.textContent = isVoiceEnabled ? "🔊 ON" : "🔇 OFF";
    }
    if (!isVoiceEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

function toggleSettings() {
    const p = document.getElementById('portal-modal'); if (p) p.style.display = 'none';
    const panel = document.getElementById('settings-panel');
    if (panel) panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
}

function togglePortal() {
    const s = document.getElementById('settings-panel'); if (s) s.style.display = 'none';
    const modal = document.getElementById('portal-modal');
    if (modal) modal.style.display = (modal.style.display === 'block') ? 'none' : 'block';
}

function quickAsk(promptText) {
    const input = document.getElementById('user-input');
    if (input) input.value = promptText;
    sendMessage();
}

function saveApiKey() {
    const el = document.getElementById('api-key');
    if (el) localStorage.setItem('dahl_api_key', el.value.trim());
}

function handleKey(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
}

function clearChatHistory() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
        chatContainer.innerHTML = `
            <div class="message assistant">
                <div class="message-header"><span>Agent Anna Core</span></div>
                <div class="msg-body">Console history cleared. Engine online.</div>
            </div>
        `;
    }
}

function copyMessage(btn) {
    const bodyDiv = btn.closest('.message').querySelector('.msg-body');
    if (!bodyDiv) return;
    navigator.clipboard.writeText(bodyDiv.innerText).then(() => {
        btn.textContent = "✅ Copied!";
        setTimeout(() => btn.textContent = "📋 Copy", 2000);
    });
}

function speakText(text) {
    if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/<[^>]*>/g, '').replace(/[*_#`~]/g, '').trim();
    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    if (cachedVoices.length === 0) loadVoices();
    const femaleVoice = cachedVoices.find(v => v.name.includes("Female") || v.lang === 'en-GB');
    if (femaleVoice) utterance.voice = femaleVoice;
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
}

async function sendMessage() {
    const keyEl = document.getElementById('api-key');
    const input = document.getElementById('user-input');
    const apiKey = keyEl ? keyEl.value.trim() : "";
    const query = input ? input.value.trim() : "";

    if (!apiKey) {
        alert('Paste your DAHL API Key in Settings (⚙️ KEYS).');
        toggleSettings();
        return;
    }
    if (!query) return;

    appendMsg(query, 'user', 'Commander');
    if (input) input.value = '';

    document.body.classList.add('is-thinking');
    const statusBar = document.getElementById('status-bar');
    if (statusBar) statusBar.classList.add('active');

    if (!coreKnowledgeCache) await preloadCoreKnowledge();
    const targetedContext = await fetchTargetedContext(query);
    const combinedContext = `${coreKnowledgeCache}\n\n${targetedContext}`;

    const systemPrompt = `You are AGENT ANNA, operating under knowledge/rules.md governance.
Provide direct, highly optimized technical responses with zero fluff.

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

        appendMsg(reply, 'assistant', 'Agent Anna Core');
        speakText(reply);

    } catch (err) {
        document.body.classList.remove('is-thinking');
        if (statusBar) statusBar.classList.remove('active');
        appendMsg(`Execution Error: ${err.message}`, 'assistant', 'System Alert');
    }
}

function appendMsg(text, sender, label) {
    const container = document.getElementById('chat-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.innerHTML = `
        <div class="message-header"><span>${label}</span></div>
        <div class="msg-body" style="white-space:pre-wrap;">${text}</div>
        ${sender === 'assistant' ? '<div class="msg-actions"><button class="action-btn" onclick="copyMessage(this)">📋 Copy</button></div>' : ''}
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}
