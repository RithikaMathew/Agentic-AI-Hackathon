// background.js - Handle extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  // Only work on FAU pages
  if (tab.url && tab.url.includes('fau.edu')) {
    chrome.tabs.sendMessage(tab.id, { type: 'open_chat', open: true });
  } else {
    // Redirect to FAU homepage if not on FAU site
    chrome.tabs.update(tab.id, { url: 'https://www.fau.edu' });
  }
});