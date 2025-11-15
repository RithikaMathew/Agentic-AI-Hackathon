// background.js - Handle extension icon clicks and orchestration API calls

// Handle extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  // Only work on FAU pages
  if (tab.url && tab.url.includes('fau.edu')) {
    chrome.tabs.sendMessage(tab.id, { type: 'open_chat', open: true });
  } else {
    // Redirect to FAU homepage if not on FAU site
    chrome.tabs.update(tab.id, { url: 'https://www.fau.edu' });
  }
});

// Handle messages from content script (orchestration requests)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'orchestrate') return;
  
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
  
  // Return true to indicate async response
  return true;
});