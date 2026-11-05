// =================================================================
// AGENT ANNA 01 // WEB SCRAPER MODULE (scrape.js)
// =================================================================

async function scrapeWebPage() {
    const input = document.getElementById('user-input');
    let targetUrl = input ? input.value.trim() : "";
    
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
        targetUrl = "https://strayd.com"; 
    }

    const startTime = performance.now();
    document.body.classList.add('is-thinking');
    updateHUDState("SCRAPING");
    appendMsg(`Initiating secure proxy scout pass for communication portal: ${targetUrl}`, 'user', 'Commander');
    if (input) input.value = '';

    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`Scraper HTTP Error ${res.status}`);
        
        const data = await res.json();
        const rawHtml = data.contents || "";
        
        const cleanText = rawHtml.replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n').trim();
        const lines = cleanText.split('\n');
        
        const first100Lines = lines.slice(0, 100).join('\n');
        const truncatedReport = `[COMMUNICATION PORTAL HARVEST: ${targetUrl}]\nTotal Lines Extracted: ${lines.length}\n\n${first100Lines}`;

        const endTime = performance.now();
        const tripSeconds = ((endTime - startTime) / 1000).toFixed(2);
        const latencyBadge = document.getElementById('latency-display');
        if (latencyBadge) latencyBadge.innerText = `SCRAPE LATENCY: ${tripSeconds}s`;

        document.body.classList.remove('is-thinking');
        updateHUDState("READY");

        appendMsg(truncatedReport, 'assistant', `AA01 Portal Link [${tripSeconds}s]`, true);
        speakText(`Portal communication established with target domain. First 100 lines harvested.`);

    } catch (err) {
        document.body.classList.remove('is-thinking');
        updateHUDState("ERROR");
        appendMsg(`Portal Scraper Error: ${err.message}.`, 'assistant', 'System Alert', false);
        speakText("Warning. Communication portal encountered a network routing restriction.");
    }
}
