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

        const inputEl = document.getElementById('user-input');
        if (inputEl) inputEl.focus();
        
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
                const userInput = document.getElementById('user-input');
                if (userInput) userInput.value = speechText;
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
        const cacheBust = `?t=${Date.now()}`; const treeUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/main?recursive=1${cacheBust}`;
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
    if (panel) panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
}

function togglePortal() {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.style.display = 'none';
    const modal = document.getElementById('portal-modal');
    if (modal) modal.style.display = (modal.style.display === 'block') ? 'none' : 'block';
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
                <div class="msg-body">Chat session cleared. How can I help you today?</div>
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
    const textToCopy = bodyDiv.innerText;
    
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
    const text = encodeURIComponent(`"${bodyDiv.innerText}" — Veg Anna / Kunda Cafe #VegAnnaShow #KundaCafe #ChiangRai`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank'); }  function shareFacebook(btn) { const bodyDiv = btn.closest('.message').querySelector('.msg-body'); if (!bodyDiv) return; const shareText = `"${bodyDiv.innerText}" — Veg Anna / Kunda Cafe #VegAnnaShow #KundaCafe #ChiangRai`;
    fallbackCopy(shareText, btn);
    alert("Post text and hashtags copied to clipboard! Opening Facebook...");
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://kundacafe.com')}`, '_blank'); }  function shareInstagram(btn) { const bodyDiv = btn.closest('.message').querySelector('.msg-body'); if (!bodyDiv) return; const shareText = `"${bodyDiv.innerText}" — Veg Anna / Kunda Cafe #VegAnnaShow #KundaCafe #ChiangRai`;
    fallbackCopy(shareText, btn);
    alert("Quote and hashtags copied to clipboard! Opening Instagram...");
    window.open('https://www.instagram.com', '_blank');
}

function shareTikTok(btn) {
    const bodyDiv = btn.closest('.message').querySelector('.msg-body');
    if (!bodyDiv) return;
    const shareText = `"${bodyDiv.innerText}" — Veg Anna / Kunda Cafe
