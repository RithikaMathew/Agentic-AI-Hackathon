// background.js - Handle extension icon clicks and orchestration API calls

// Handle extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  console.log('[Background] Extension clicked on:', tab.url);
  
  // Open chat on any page (extension works on all URLs)
  chrome.tabs.sendMessage(tab.id, { type: 'open_chat', open: true }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Background] Error opening chat:', chrome.runtime.lastError.message);
    } else {
      console.log('[Background] Chat opened successfully');
    }
  });
});

// Handle messages from content script (orchestration requests and email replies)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  
  if (msg.type === 'orchestrate') {
    console.log('[Background] Orchestration request:', msg.message);
    
    const url = 'http://127.0.0.1:8000/orchestrate';
    
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg.message })
    })
      .then(async response => {
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`${response.status} ${response.statusText}: ${text}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('[Background] Backend response:', data);
        sendResponse({ ok: true, data: data });
      })
      .catch(err => {
        console.error('[Background] Backend error:', err);
        sendResponse({ ok: false, error: err.message });
      });
    
    return true; // async response
  }
  
  if (msg.type === 'draft_reply') {
    console.log('[Background] Email reply request:', msg.emailText.substring(0, 100));
    
    const url = 'http://127.0.0.1:8000/draft-reply';
    
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        emailText: msg.emailText,
        userInstructions: msg.userInstructions || ''
      })
    })
      .then(async response => {
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`${response.status} ${response.statusText}: ${text}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('[Background] Reply generated');
        sendResponse({ reply: data.reply });
      })
      .catch(err => {
        console.error('[Background] Reply error:', err);
        sendResponse({ reply: 'Error generating reply. Please try again.' });
      });
    
    return true; // async response
  }
});