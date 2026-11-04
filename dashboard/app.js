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
    document.getElementById('portal-modal').style.display = 'none';
    const panel = document.getElementById('settings-panel');
    panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
}

function togglePortal() {
    document.getElementById('settings-panel').style.display = 'none';
    const modal = document.getElementById('portal-modal');
    modal.style.display = (modal.style.display === 'block') ? 'none' : 'block';
}

function quickAsk(promptText) {
    document.getElementById('portal-modal').style.display = 'none';
    document.getElementById('settings-panel').style.display = 'none';
    document.getElementById('user-input').value = promptText;
    sendMessage();
}

function saveApiKey() {
    try { localStorage.setItem('dahl_api_key', document.getElementById('api-key').value.trim()); } catch (e) {}
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
            <div class="msg-body">Chat session cleared. Sawadee! How can I help you today?</div>
            <div class="msg-actions">
                <button class="action-btn" onclick="copyMessage(this)">📋 Copy</button>
                <button class="action-btn" onclick="shareTwitter(this)">🐦 Share X</button>
                <button class="action-btn" onclick="shareFacebook(this)">📘 Share FB</button>
                <button class="action-btn" onclick="shareInstagram(this)">📸 Share IG</button>
                <button class="action-btn" onclick="shareTikTok(this)">🎵 Share TT</button>
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

function shareInstagram(btn) {
    const bodyDiv = btn.closest('.message').querySelector('.msg-body');
    navigator.clipboard.writeText(bodyDiv.innerText).then(() => {
        alert("Quote copied to clipboard! Opening Instagram...");
        window.open('https://www.instagram.com', '_blank');
    }).catch(() => {
        window.open('https://www.instagram.com', '_blank');
    });
}

function shareTikTok(btn) {
    const bodyDiv = btn.closest('.message').querySelector('.msg-body');
    navigator.clipboard.writeText(bodyDiv.innerText).then(() => {
        alert("Quote copied to clipboard! Opening TikTok...");
        window.open('https://www.tiktok.com', '_blank');
    }).catch(() => {
        window.open('https://www.tiktok.com', '_blank');
    });
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

    // BACKSTAGE VOICE ENGINE: Priority list matching soft British & International female voices
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

    // 1. Preferred British female voice match
    let selectedVoice = femaleVoices.find(v => 
        preferredVoices.some(pv => v.name.includes(pv)) && (v.lang === 'en-GB' || v.lang.startsWith('en'))
    );

    // 2. Generic British female voice fallback
    if (!selectedVoice) {
        selectedVoice = femaleVoices.find(v => v.lang === 'en-GB');
    }

    // 3. Preferred soft English female fallback
    if (!selectedVoice) {
        selectedVoice = femaleVoices.find(v => 
            preferredVoices.some(pv => v.name.includes(pv))
        );
    }

    // 4. Any English female fallback
    if (!selectedVoice && femaleVoices.length > 0) {
        selectedVoice = femaleVoices[0];
    }

    if (selectedVoice) utterance.voice = selectedVoice;
    
    // Backstage audio tuning for a soft, relaxed tone
    utterance.pitch = 1.05;
    utterance.rate = 0.92;

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
- NAME & IDENTITY
