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
        if (savedKey) document.getElementById('api-key').value = savedKey;

        const savedVoice = localStorage.getItem('selected_voice_profile');
        if (savedVoice) document.getElementById('voice-profile').value = savedVoice;

        document.getElementById('user-input').focus();
        
        if ('speechSynthesis' in window) {
            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }

        preloadCoreKnowledge();

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onresult = function(event) {
                const speechText = event.results[0][0].transcript;
                document.getElementById('user-input').value = speechText;
                stopListeningUI();
                sendMessage();
            };

            recognition.onerror = () => stopListeningUI();
            recognition.onend = () => stopListeningUI();
        }
    } catch (e) {}
};

function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    cachedVoices = window.speechSynthesis.getVoices();
}

async function preloadCoreKnowledge() {
    const corePaths = [
        "characters/veganna/veganna.md",
        "characters/veganna/-index.md",
        "knowledge/kundacafe.md"
    ];
    let snippets = [];
    await Promise.all(corePaths.map(async (path) => {
        try {
            const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${path}?t=${Date.now()}`;
            const res = await fetch(rawUrl);
            if (res.ok) {
                const text = await res.text();
                if (text && text.trim().length > 0) snippets.push(`\n[FILE: ${path}]\n${text}`);
            }
        } catch (e) {}
    }));
    coreKnowledgeCache = snippets.join('\n\n---\n\n');
}

async function fetchDeepKnowledgeContext() {
    let snippets = [];
    try {
        const cacheBust = `?t=${Date.now()}`;
        const treeUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/main?recursive=1${cacheBust}`;
        const treeRes = await fetch(treeUrl);

        if (treeRes.ok) {
            const treeData = await treeRes.json();
            const filePaths = (treeData.tree || []).filter(item => item.type === 'blob').map(item => item.path);
            
            const filesToIngest = filePaths.filter(path => 
                (path.startsWith('knowledge/') || path.startsWith('characters/')) &&
                !path.includes('veganna.md') && 
                !path.includes('-index.md') && 
                !path.includes('kundacafe.md')
            );

            await Promise.all(filesToIngest.map(async (path) => {
                try {
                    const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${path}?t=${Date.now()}`;
                    const res = await fetch(rawUrl);
                    if (res.ok) {
                        const text = await res.text();
                        if (text && text.trim().length > 0) snippets.push(`\n[FILE: ${path}]\n${text}`);
                    }
                } catch (e) {}
            }));
        }
    } catch (err) {}
    return snippets.length > 0 ? snippets.join('\n\n---\n\n') : "";
}

function toggleSpeechRecognition() {
    if (!recognition) {
        alert("Speech recognition is not supported on this browser.");
        return;
    }
    const micBtn = document.getElementById('mic-btn');
    if (!isListening) {
        try {
            recognition.start();
            isListening = true;
            micBtn.classList.add('listening');
        } catch (e) {
            stopListeningUI();
        }
    } else {
        try { recognition.stop(); } catch (e) {}
        stopListeningUI();
    }
}

function stopListeningUI() {
    isListening = false;
    const micBtn = document.getElementById('mic-btn');
    if (micBtn) micBtn.classList.remove('listening');
}

function toggleVoice() {
    isVoiceEnabled = !isVoiceEnabled;
    const btn = document.getElementById('voice-btn');
    btn.className = isVoiceEnabled ? "voice-toggle-btn active" : "voice-toggle-btn";
    btn.textContent = isVoiceEnabled ? "🔊 ON" : "🔇 OFF";
    if (!isVoiceEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

function toggleSettings() {
    document.getElementById('store-panel').style.display = 'none';
    const panel = document.getElementById('settings-panel');
    panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
}

function toggleStore() {
    document.getElementById('settings-panel').style.display = 'none';
    const panel = document.getElementById('store-panel');
    panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
}

function saveApiKey() {
    try { localStorage.setItem('dahl_api_key', document.getElementById('api-key').value.trim()); } catch (e) {}
}

function saveVoiceProfile() {
    try { localStorage.setItem('selected_voice_profile', document.getElementById('voice-profile').value); } catch (e) {}
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
    chatContainer.innerHTML = `
        <div class="message assistant" id="initial-msg">
            <div class="message-header"><span>Veg Anna</span></div>
            <div class="msg-body">Chat history cleared. Sawadee. Ask me anything?</div>
            <div class="msg-actions">
                <button class="action-btn" onclick="copyMessage(this)">📋 Copy</button>
                <button class="action-btn" onclick="shareTwitter(this)">🐦 Share X</button>
                <button class="action-btn" onclick="shareFacebook(this)">📘 Share FB</button>
            </div>
        </div>
    `;
    localStorage.removeItem('veganna_chat_history');
    sessionStorage.clear();
}

function copyMessage(btn) {
    const bodyDiv = btn.closest('.message').querySelector('.msg-body');
    const textToCopy = bodyDiv.innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = btn.textContent;
        btn.textContent = "✅ Copied!";
        setTimeout(() => btn.textContent = originalText, 2000);
    }).catch(err => {
        alert("Failed to copy text.");
    });
}

function shareTwitter(btn) {
    const bodyDiv = btn.closest('.message').querySelector('.msg-body');
    const text = encodeURIComponent(`"${bodyDiv.innerText}" — Veg Anna / Kunda Cafe #VegAnnaShow #KundaCafe`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
}

function shareFacebook(btn) {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://kundacafe.com')}`, '_blank');
}

function speakText(text) {
    if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const clean = text
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
        .replace(/[*_#`~]/g, '')
        .trim();

    if (!clean) return;

    if (cachedVoices.length === 0) loadVoices();

    const utterance = new SpeechSynthesisUtterance(clean);
    const profile = document.getElementById('voice-profile').value;

    let selectedVoice = null;
    const validVoices = cachedVoices.filter(v => {
        const name = v.name.toLowerCase();
        const lang = v.lang.toLowerCase();
        if (name.includes('male') || name.includes('david') || name.includes('mark') || name.includes('george') || name.includes('james') || name.includes('daniel') || name.includes('oliver') || name.includes('ryan')) {
            return false;
        }
        return lang.startsWith('en');
    });

    if (profile === 'uk_female') {
        selectedVoice = validVoices.find(v => v.lang === 'en-GB' || v.name.includes('Sonia') || v.name.includes('Hazel') || v.name.includes('Libby'));
    } 
    
    if (!selectedVoice) {
        selectedVoice = validVoices.find(v => v.lang === 'en-US' || v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Karen') || v.name.includes('Zira'));
    }

    if (!selectedVoice && validVoices.length > 0) {
        selectedVoice = validVoices[0];
    }

    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.pitch = 1.15;
    utterance.rate = 0.98;

    window.speechSynthesis.speak(utterance);
}

async function sendMessage() {
    const apiKey = document.getElementById('api-key').value.trim();
    const input = document.getElementById('user-input');
    const query = input.value.trim();

    if (!apiKey) {
        alert('Please tap ⚙️ Settings in the top right to paste your DAHL API Key.');
        toggleSettings();
        return;
    }
    if (!query) return;

    if (query.toLowerCase().includes("play music") || query.toLowerCase().includes("playlist")) {
        window.open("https://open.spotify.com/search/kunda%20cafe", "_blank");
    }

    appendMsg(query, 'user', 'You');
    input.value = '';

    document.body.classList.add('is-thinking');
    document.getElementById('status-bar').classList.add('active');

    const queryLower = query.toLowerCase();
    const needsDeepLore = queryLower.includes("song") || 
                         queryLower.includes("track") || 
                         queryLower.includes("archive") || 
                         queryLower.includes("martin") || 
                         queryLower.includes("strayd") || 
                         queryLower.includes("history");

    const dynamicMaxTokens = needsDeepLore ? 1000 : 180;

    if (!coreKnowledgeCache) await preloadCoreKnowledge();
    
    let combinedContext = coreKnowledgeCache || "";
    
    if (needsDeepLore) {
        const deepContext = await fetchDeepKnowledgeContext();
        combinedContext += `\n\n[DEEP LORE FILES]:\n${deepContext}`;
    }

    const now = new Date();
    const currentDateTimeStr = now.toLocaleString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    const coreFacts = ` MANDATORY KUNDA BOUNDARIES & STRICT TRUTH:
- CURRENT REAL-TIME CONTEXT: Today's live date and time is ${currentDateTimeStr}.
- NAME & IDENTITY: Your name is strictly VEG ANNA. Always say "Veg Anna".
- STRICT ANTI-HALLUCINATION RULE FOR SONGS: You are forbidden from inventing song titles. Extract exact track info from ingested files.
- OPENING HOURS: Kunda Cafe opens daily at 12:00 PM (Noon). Kitchen closes strictly at 7:30 PM.
- LOCATION & MICHELIN: 372 Trairat Rd, Chiang Rai. Michelin Guide Thailand 2026.
- FOOD ETHOS: Strictly SOY-FREE and TOFU-FREE. No Thai food, no rice, no commercial sodas.`;

    let systemPrompt = `You are roleplaying purely as VEG ANNA.
    
RESPONSE RULES:
- Keep answers punchy, natural, conversational, and under 35 words for simple questions.
- ABSOLUTE TRUTH: Never hallucinate character names or song titles.
- NEVER output internal reasoning, <think> tags, or conversational AI crutches.

${coreFacts}

[CORE KNOWLEDGE FILES]:
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
                temperature: 0.0,
                max_tokens: dynamicMaxTokens
            })
        });

        if (!res.ok) throw new Error(`API Error ${res.status}`);

        const data = await res.json();
        let reply = data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        document.body.classList.remove('is-thinking');
        document.getElementById('status-bar').classList.remove('active');

        appendMsg(reply, 'assistant', 'Veg Anna');
        speakText(reply);

    } catch (err) {
        document.body.classList.remove('is-thinking');
        document.getElementById('status-bar').classList.remove('active');
        appendMsg(`Error: ${err.message}`, 'assistant', 'System Error');
    }

    input.focus();
}

function appendMsg(text, sender, label) {
    const container = document.getElementById('chat-container');
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    
    if (sender === 'assistant') {
        div.innerHTML = `
            <div class="message-header"><span>${label}</span></div>
            <div class="msg-body" style="white-space:pre-wrap;">${text}</div>
            <div class="msg-actions">
                <button class="action-btn" onclick="copyMessage(this)">📋 Copy</button>
                <button class="action-btn" onclick="shareTwitter(this)">🐦 Share X</button>
                <button class="action-btn" onclick="shareFacebook(this)">📘 Share FB</button>
            </div>
        `;
    } else {
        div.innerHTML = `
            <div class="message-header"><span>${label}</span></div>
            <div class="msg-body" style="white-space:pre-wrap;">${text}</div>
        `;
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}
