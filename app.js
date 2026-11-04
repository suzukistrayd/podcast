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
        recognition.maxAlternatives = 1;

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
            if (micBtn) micBtn.classList.add('listening');
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
    if (btn) {
        btn.className = isVoiceEnabled ? "voice-toggle-btn active" : "voice-toggle-btn";
        btn.textContent = isVoiceEnabled ? "🔊 ON" : "🔇 OFF";
    }
    if (!isVoiceEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

function toggleSettings() {
    const modal = document.getElementById('portal-modal');
    if (modal) modal.style.display = 'none';
    
    const panel = document.getElementById('settings-panel');
    if (!panel) return;
    
    const currentDisplay = window.getComputedStyle(panel).display;
    panel.style.display = (currentDisplay === 'none') ? 'block' : 'none';
}

function togglePortal() {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.style.display = 'none';
    
    const modal = document.getElementById('portal-modal');
    if (!modal) return;
    
    const currentDisplay = window.getComputedStyle(modal).display;
    modal.style.display = (currentDisplay === 'none') ? 'block' : 'none';
}

function quickAsk(promptText) {
    const modal = document.getElementById('portal-modal');
    const panel = document.getElementById('settings-panel');
    if (modal) modal.style.display = 'none';
    if (panel) panel.style.display = 'none';
    const input = document.getElementById('user-input');
    if (input) input.value = promptText;
    sendMessage();
}

function saveApiKey() {
    try {
        const keyInput = document.getElementById('api-key');
        if (keyInput) localStorage.setItem('dahl_api_key', keyInput.value.trim());
    } catch (e) {}
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
            <div class="message assistant" id="initial-msg">
                <div class="message-header"><span>Veg Anna</span></div>
                <div class="msg-body">Hey there! I am Veg Anna, your personal Kunda guru. Ask me anything!</div>
                <div class="msg-actions">
                    <button class="action-btn" onclick="copyMessage(this)">📋 Copy</button>
                    <button class="action-btn" onclick="shareTwitter(this)">🐦 Share X</button>
                    <button class="action-btn" onclick="shareFacebook(this)">📘 Share FB</button>
                    <button class="action-btn" onclick="shareInstagram(this)">📸 Share IG</button>
                    <button class="action-btn" onclick="shareTikTok(this)">🎵 Share TT</button>
                </div>
            </div>
        `;
    }
    localStorage.removeItem('veganna_chat_history');
    sessionStorage.clear();
}

function copyMessage(btn) {
    const bodyDiv = btn.closest('.message').querySelector('.msg-body');
    if (!bodyDiv) return;
    const textToCopy = bodyDiv.innerText.replace(/[—–]/g, '-');
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = btn.textContent;
            btn.textContent = "✅ Copied!";
            setTimeout(() => btn.textContent = originalText, 2000);
        }).catch(() => fallbackCopy(textToCopy, btn));
    } else {
        fallbackCopy(textToCopy, btn);
    }
}

function fallbackCopy(text, btn) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        const originalText = btn.textContent;
        btn.textContent = "✅ Copied!";
        setTimeout(() => btn.textContent = originalText, 2000);
    } catch (err) {}
    document.body.removeChild(textArea);
}

function shareTwitter(btn) {
    const bodyDiv = btn.closest('.message').querySelector('.msg-body');
    if (!bodyDiv) return;
    const shareText = bodyDiv.innerText.replace(/[—–]/g, '-');
    const text = encodeURIComponent(`"${shareText}" - Veg Anna / Kunda Cafe #VegAnnaShow #KundaCafe`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
}

function shareFacebook(btn) {
    const bodyDiv = btn.closest('.message').querySelector('.msg-body');
    if (!bodyDiv) return;
    const shareText = `"${bodyDiv.innerText.replace(/[—–]/g, '-')}" - Veg Anna / Kunda Cafe #VegAnnaShow #KundaCafe`;
    fallbackCopy(shareText, btn);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://kundacafe.com')}`, '_blank');
}

function shareInstagram(btn) {
    const bodyDiv = btn.closest('.message').querySelector('.msg-body');
    if (bodyDiv) fallbackCopy(bodyDiv.innerText.replace(/[—–]/g, '-'), btn);
    window.open('https://www.instagram.com', '_blank');
}

function shareTikTok(btn) {
    const bodyDiv = btn.closest('.message').querySelector('.msg-body');
    if (bodyDiv) fallbackCopy(bodyDiv.innerText.replace(/[—–]/g, '-'), btn);
    window.open('https://www.tiktok.com', '_blank');
}

function speakText(text) {
    if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const clean = text
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/[—–]/g, '-')
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
        .replace(/[*_#`~]/g, '')
        .trim();

    if (!clean) return;

    if (cachedVoices.length === 0) loadVoices();

    const utterance = new SpeechSynthesisUtterance(clean);

    const preferredVoices = [
        "Google UK English Female",
        "en-GB-Neural2-F",
        "en-GB-News-G",
        "Sonia",
        "Hazel",
        "Serena",
        "Fiona",
        "Moira",
        "Karen",
        "Samantha",
        "Google US English"
    ];

    const femaleVoices = cachedVoices.filter(v => {
        const name = v.name.toLowerCase();
        return !name.includes('male') && 
               !name.includes('david') && 
               !name.includes('mark') && 
               !name.includes('george') && 
               !name.includes('james') && 
               !name.includes('daniel');
    });

    let selectedVoice = femaleVoices.find(v => 
        preferredVoices.some(pv => v.name.includes(pv)) && (v.lang === 'en-GB' || v.lang.startsWith('en'))
    );

    if (!selectedVoice) {
        selectedVoice = femaleVoices.find(v => v.lang === 'en-GB');
    }

    if (!selectedVoice) {
        selectedVoice = femaleVoices.find(v => 
            preferredVoices.some(pv => v.name.includes(pv))
        );
    }

    if (!selectedVoice && femaleVoices.length > 0) {
        selectedVoice = femaleVoices[0];
    }

    if (selectedVoice) utterance.voice = selectedVoice;
    
    utterance.pitch = 1.05;
    utterance.rate = 0.92;

    window.speechSynthesis.speak(utterance);
}

async function sendMessage() {
    const keyEl = document.getElementById('api-key');
    const input = document.getElementById('user-input');
    const apiKey = keyEl ? keyEl.value.trim() : "";
    const query = input ? input.value.trim() : "";

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
    if (input) input.value = '';

    document.body.classList.add('is-thinking');
    const statusBar = document.getElementById('status-bar');
    if (statusBar) statusBar.classList.add('active');

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
- GREETING BAN (CRITICAL): NEVER say "Sawadee!" or use any repetitive greeting. Start directly with the answer or use fresh natural phrasing.
- DASH BAN (CRITICAL): NEVER use long em-dashes (—) or en-dashes (–). ALWAYS use standard short hyphens (-) exclusively.
- STRICT ANTI-HALLUCINATION RULE FOR SONGS: You are forbidden from inventing song titles. Extract exact track info from ingested files.
- OPENING HOURS: Kunda Cafe opens daily at 12:00 PM (Noon). Kitchen closes strictly at 7:30 PM.
- LOCATION & MICHELIN: 372 Trairat Rd, Chiang Rai. Michelin Guide Thailand 2026.
- FOOD ETHOS: Strictly SOY-FREE and TOFU-FREE. No Thai food, no rice, no commercial sodas.`;

    let systemPrompt = `You are roleplaying purely as VEG ANNA.
    
RESPONSE RULES:
- Output ONLY your direct answer. 
- NO GREETINGS: Do not say "Sawadee" or any variation. Jump straight into the response.
- DASH STYLE: NEVER use long em-dashes (—). ALWAYS use standard short hyphens (-) only.
- Keep answers punchy, natural, conversational, and under 35 words for simple questions.
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
        let rawReply = data.choices[0].message.content || "";
        
        // Sanitize thinking tags and enforce short hyphens on all AI responses
        let reply = rawReply
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .replace(/[—–]/g, '-')
            .trim();

        document.body.classList.remove('is-thinking');
        if (statusBar) statusBar.classList.remove('active');

        appendMsg(reply, 'assistant', 'Veg Anna');
        speakText(reply);

    } catch (err) {
        document.body.classList.remove('is-thinking');
        if (statusBar) statusBar.classList.remove('active');
        appendMsg(`Error: ${err.message}`, 'assistant', 'System Error');
    }

    if (input) input.focus();
}

function appendMsg(text, sender, label) {
    const container = document.getElementById('chat-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `message ${sender}`;
    
    // Ensure any rendered text also strips em-dashes globally
    const sanitizedText = text.replace(/[—–]/g, '-');

    if (sender === 'assistant') {
        div.innerHTML = `
            <div class="message-header"><span>${label}</span></div>
            <div class="msg-body" style="white-space:pre-wrap;">${sanitizedText}</div>
            <div class="msg-actions">
                <button class="action-btn" onclick="copyMessage(this)">📋 Copy</button>
                <button class="action-btn" onclick="shareTwitter(this)">🐦 Share X</button>
                <button class="action-btn" onclick="shareFacebook(this)">📘 Share FB</button>
                <button class="action-btn" onclick="shareInstagram(this)">📸 Share IG</button>
                <button class="action-btn" onclick="shareTikTok(this)">🎵 Share TT</button>
            </div>
        `;
    } else {
        div.innerHTML = `
            <div class="message-header"><span>${label}</span></div>
            <div class="msg-body" style="white-space:pre-wrap;">${sanitizedText}</div>
        `;
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}
