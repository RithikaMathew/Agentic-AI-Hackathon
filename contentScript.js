// contentScript.js
// Enhanced automated element highlighting and step-by-step guidance system

(function () {
  // State management
  let steps = [];
  let currentStepIndex = 0;
  let highlightedElement = null;
  let messageOverlay = null;
  let autoAdvanceTimer = null;
  let sessionId = null;

  // Initialize session and load state
  function initializeSession() {
    sessionId = Date.now().toString();
    loadState();
  }

  // Save state to Chrome storage
  function saveState() {
    if (!chrome.storage) return;
    
    const state = {
      steps: steps,
      currentStepIndex: currentStepIndex,
      url: window.location.href,
      timestamp: Date.now(),
      chatMessages: getChatMessages() // Save chat messages
    };
    
    chrome.storage.local.set({ 'fau-guidance-state': state }, () => {
      console.log('[FAU Assistant] State saved');
    });
  }

  // Load state from Chrome storage
  function loadState() {
    if (!chrome.storage) return;
    
    chrome.storage.local.get(['fau-guidance-state'], (result) => {
      const state = result['fau-guidance-state'];
      if (state && Date.now() - state.timestamp < 3600000) { // 1 hour
        steps = state.steps || [];
        currentStepIndex = state.currentStepIndex || 0;
        
        // Restore chat messages
        if (state.chatMessages) {
          restoreChatMessages(state.chatMessages);
        }
        
        if (steps.length > 0) {
          console.log('[FAU Assistant] Restored guidance state');
          setTimeout(() => showCurrentStep(), 1000);
        }
      }
    });
  }

  // Clear saved state
  function clearState() {
    if (!chrome.storage) return;
    chrome.storage.local.remove(['fau-guidance-state']);
  }

  // Helper: Get current chat messages from localStorage
  function getChatMessages() {
    try {
      return JSON.parse(localStorage.getItem('fau-chat-messages') || '[]');
    } catch (e) {
      return [];
    }
  }

  // Helper: Restore chat messages to the chat widget
  function restoreChatMessages(messages) {
    if (!messages || messages.length === 0) return;
    
    // Store in localStorage so ensureChatWidget can load them
    localStorage.setItem('fau-chat-messages', JSON.stringify(messages));
    
    // If chat widget already exists, refresh it
    const existingChat = document.getElementById('fau-assistant-chat');
    if (existingChat) {
      const container = existingChat.querySelector('#fau-messages');
      if (container) {
        container.innerHTML = ''; // Clear existing
        messages.forEach(msg => {
          const div = document.createElement('div');
          div.className = 'msg ' + (msg.from === 'user' ? 'user' : 'assistant');
          const b = document.createElement('div');
          b.className = 'bubble';
          b.textContent = msg.text;
          div.appendChild(b);
          container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
      }
    }
  }

  // Configuration
  const CONFIG = {
    highlightColor: '#00ffff',
    glowColor: 'rgba(0, 255, 255, 0.6)',
    uncertainHighlightColor: '#ff8c00',
    uncertainGlowColor: 'rgba(255, 140, 0, 0.6)',
    autoScrollBehavior: 'smooth',
    autoAdvanceDelay: 0, // set to 0 to disable auto-advance, or ms value
    enableClickAdvance: true,
    uncertainScoreThreshold: 80, // If top match score < this, show orange
  };

  // Initialize comprehensive styles with animations
  function ensureStyles() {
    if (document.getElementById('fau-assistant-styles')) return;
    const style = document.createElement('style');
    style.id = 'fau-assistant-styles';
    style.textContent = `
      /* Neon glowing highlight effect with pulse animation */
      .fau-highlight {
        outline: 3px solid ${CONFIG.highlightColor} !important;
        outline-offset: 3px !important;
        box-shadow: 
          0 0 10px ${CONFIG.glowColor},
          0 0 20px ${CONFIG.glowColor},
          0 0 30px ${CONFIG.glowColor},
          inset 0 0 10px rgba(0, 255, 255, 0.2) !important;
        position: relative !important;
        z-index: 999999 !important;
        animation: fau-neon-pulse 2s ease-in-out infinite !important;
        pointer-events: auto !important;
        border-radius: 4px !important;
      }
      
      /* Orange highlight for uncertain matches */
      .fau-highlight-uncertain {
        outline: 3px solid ${CONFIG.uncertainHighlightColor} !important;
        outline-offset: 3px !important;
        box-shadow: 
          0 0 10px ${CONFIG.uncertainGlowColor},
          0 0 20px ${CONFIG.uncertainGlowColor},
          0 0 30px ${CONFIG.uncertainGlowColor},
          inset 0 0 10px rgba(255, 140, 0, 0.2) !important;
        position: relative !important;
        z-index: 999999 !important;
        animation: fau-orange-pulse 2s ease-in-out infinite !important;
        pointer-events: auto !important;
        border-radius: 4px !important;
      }
      
      .fau-highlight::before {
        content: '';
        position: absolute;
        top: -8px;
        left: -8px;
        right: -8px;
        bottom: -8px;
        border: 2px solid ${CONFIG.highlightColor};
        border-radius: 8px;
        box-shadow: 0 0 15px ${CONFIG.glowColor};
        pointer-events: none;
        z-index: -1;
        animation: fau-neon-glow 2s ease-in-out infinite alternate;
      }
      
      @keyframes fau-neon-pulse {
        0%, 100% {
          outline-color: ${CONFIG.highlightColor};
          box-shadow: 
            0 0 10px ${CONFIG.glowColor},
            0 0 20px ${CONFIG.glowColor},
            0 0 30px ${CONFIG.glowColor},
            inset 0 0 10px rgba(0, 255, 255, 0.2);
        }
        50% {
          outline-color: #00cccc;
          box-shadow: 
            0 0 15px rgba(0, 255, 255, 0.8),
            0 0 30px rgba(0, 255, 255, 0.6),
            0 0 45px rgba(0, 255, 255, 0.4),
            inset 0 0 15px rgba(0, 255, 255, 0.3);
        }
      }
      
      @keyframes fau-orange-pulse {
        0%, 100% {
          outline-color: ${CONFIG.uncertainHighlightColor};
          box-shadow: 
            0 0 10px ${CONFIG.uncertainGlowColor},
            0 0 20px ${CONFIG.uncertainGlowColor},
            0 0 30px ${CONFIG.uncertainGlowColor},
            inset 0 0 10px rgba(255, 140, 0, 0.2);
        }
        50% {
          outline-color: #ff6600;
          box-shadow: 
            0 0 15px rgba(255, 140, 0, 0.8),
            0 0 30px rgba(255, 140, 0, 0.6),
            0 0 45px rgba(255, 140, 0, 0.4),
            inset 0 0 15px rgba(255, 140, 0, 0.3);
        }
      }
      
      @keyframes fau-neon-glow {
        0% {
          box-shadow: 0 0 15px ${CONFIG.glowColor};
        }
        100% {
          box-shadow: 0 0 25px rgba(0, 255, 255, 0.8), 0 0 35px rgba(0, 255, 255, 0.4);
        }
      }
      
      /* Message bubble - modern design */
      .fau-message-overlay {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 2147483647;
        max-width: 400px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        animation: fau-slide-in 0.3s ease-out;
        pointer-events: auto;
      }
      
      @keyframes fau-slide-in {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      .fau-message-overlay .step-number {
        display: inline-block;
        background: rgba(255, 255, 255, 0.2);
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
        margin-right: 8px;
      }
      
      .fau-message-overlay .controls {
        margin-top: 12px;
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      
      .fau-message-overlay button {
        background: rgba(255, 255, 255, 0.9);
        color: #667eea;
        border: none;
        padding: 6px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        font-size: 13px;
        transition: all 0.2s;
      }
      
      .fau-message-overlay button:hover {
        background: white;
        transform: translateY(-1px);
      }
      
      /* Chat widget styles (existing) */
      #fau-assistant-chat { position: fixed; right: 20px; bottom: 20px; width: 380px; height: 500px; background: #fff; box-shadow: 0 12px 40px rgba(0,0,0,0.15); border-radius:12px; z-index:2147483648; display:flex; flex-direction:column; overflow:hidden; border: 1px solid #e0e6ed; }
      #fau-assistant-chat .header { background: linear-gradient(135deg, #0b63ce 0%, #1e88e5 100%); color:#fff; padding:12px 16px; cursor:move; display:flex; align-items:center; justify-content:space-between; font-weight:600; }
      #fau-assistant-chat .messages { padding:16px; flex:1; overflow:auto; background:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      #fau-assistant-chat .controls { display:flex; gap:8px; padding:12px 16px; border-top:1px solid #e0e6ed; background:#fff; }
      #fau-assistant-chat textarea { flex:1; min-height:44px; max-height:120px; border:1px solid #d1d9e0; border-radius:8px; padding:8px 12px; font-family:inherit; resize:vertical; }
      #fau-assistant-chat button { background:#0b63ce; color:#fff; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; font-weight:500; }
      #fau-assistant-chat button:hover { background:#0952b3; }
      #fau-assistant-chat .msg.user { text-align:right; margin:8px 0; }
      #fau-assistant-chat .msg.assistant { text-align:left; margin:8px 0; }
      #fau-assistant-chat .msg .bubble { display:inline-block; padding:10px 14px; border-radius:16px; max-width:85%; word-wrap:break-word; }
      #fau-assistant-chat .msg.user .bubble { background: linear-gradient(135deg, #0b63ce 0%, #1e88e5 100%); color:#fff; }
      #fau-assistant-chat .msg.assistant .bubble { background:#fff; border:1px solid #e0e6ed; color:#374151; }
      #fau-assistant-chat .footer-resize { width:16px; height:16px; position:absolute; right:2px; bottom:2px; cursor:se-resize; background:url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M16 16V10l-6 6h6zM16 6L6 16h4l6-6V6zM16 2L2 16h4L16 6V2z" fill="%23cbd5e1"/></svg>'); }
    `;
    document.head.appendChild(style);
  }


  // Enhanced flexible element detection
  function findElement(targetInfo) {
    if (!targetInfo) return null;

    const target = typeof targetInfo === 'string' ? targetInfo : (targetInfo.target_text || targetInfo.selector || targetInfo.text || '');
    if (!target) return null;

    console.log(`[FAU Assistant] Finding element for: "${target}"`);

    // 1. Try as CSS selector first
    try {
      const element = document.querySelector(target);
      if (element && isElementVisible(element)) {
        console.log('[FAU Assistant] Found by CSS selector:', target);
        return element;
      }
    } catch (e) {
      // Not a valid selector, continue with text search
    }

    // 2. Get all interactive elements - PRIORITIZE individual buttons/links over containers
    const selectors = [
      // High priority: actual interactive elements
      'button', 'a[href]', 'input[type="submit"]', 'input[type="button"]',
      '[role="button"]', '[role="link"]', '.btn', '.button',
      'li a', 'span[onclick]', 'td a', 'th a',
      'img[alt]', 'a img',
      // Lower priority: containers (only if no specific button found)
      'div[onclick]', 'a div', 'a span', '[onclick] div', '[onclick] span',
      'div img', 'span img',
      'div[class*="card"]', 'div[class*="tile"]', 'div[class*="item"]',
      'li', 'div[class*="link"]', 'div.kgo-title'
    ];

    let candidates = Array.from(document.querySelectorAll(selectors.join(', ')))
      .filter(el => {
        // Comprehensive exclusion of chatbot elements and overlays
        if (el.closest('#fau-assistant-chat')) return false;
        if (el.closest('.fau-message-overlay')) return false;
        if (el.id && el.id.includes('fau-')) return false;
        if (el.className && typeof el.className === 'string' && el.className.includes('fau-')) return false;
        if (el.classList.contains('fau-highlight')) return false;
        if (el.classList.contains('fau-highlight-uncertain')) return false;
        if (el.classList.contains('fau-message-overlay')) return false;
        
        // Check if element is inside or contains chat widget
        const chatWidget = document.getElementById('fau-assistant-chat');
        if (chatWidget && chatWidget.contains(el)) return false;
        if (el.contains && el.contains(chatWidget)) return false;
        
        return isElementVisible(el) && el.offsetWidth > 5 && el.offsetHeight > 5;
      });
    
    // Also add their clickable parent elements (links/divs with onclick)
    const clickableParents = new Set();
    candidates.forEach(el => {
      const parent = el.closest('a, [onclick], li, div[class*="card"], div[class*="tile"], div[class*="item"]');
      if (parent && 
          isElementVisible(parent) &&
          !parent.closest('#fau-assistant-chat') &&
          !parent.closest('.fau-message-overlay')) {
        clickableParents.add(parent);
      }
    });
    candidates = [...new Set([...candidates, ...clickableParents])];

    console.log(`[FAU Assistant] Searching ${candidates.length} visible elements`);

    const txt = target.trim().toLowerCase();
    // Normalize text: replace hyphens with spaces for matching
    const normalizedTarget = txt.replace(/-/g, ' ');
    const targetWords = normalizedTarget.split(' ').filter(w => w.length > 2);

    // Scoring system for flexible matching
    const scored = candidates.map(el => {
      const text = getElementText(el).toLowerCase();
      const normalizedText = text.replace(/-/g, ' ');
      const textWords = normalizedText.split(' ').filter(w => w.length > 2);
      
      let score = 0;
      
      // BONUS: Prefer actual buttons/links over parent containers
      const tagName = el.tagName.toLowerCase();
      if (tagName === 'button' || tagName === 'a' || tagName === 'input') {
        score += 50; // Big bonus for actual interactive elements
      } else if (tagName === 'div' || tagName === 'span') {
        score -= 30; // Penalty for container elements
      }
      
      // Penalty for elements with many children (likely a container, not a button)
      const childCount = el.children ? el.children.length : 0;
      if (childCount > 3) {
        score -= 40; // Heavy penalty for elements with many children
      }
      
      // Exact match gets highest score
      if (normalizedText === normalizedTarget) score += 100;
      
      // Contains target gets high score
      if (normalizedText.includes(normalizedTarget)) score += 80;
      
      // Target contains element text
      if (normalizedTarget.includes(normalizedText) && normalizedText.length > 3) score += 70;
      
      // Word matching (more precise) - use normalized text
      let exactWordMatches = 0;
      for (const word of targetWords) {
        if (normalizedText.includes(word)) {
          exactWordMatches++;
          score += 25;
        }
      }
      
      // STRICT: Require ALL words to match for multi-word targets to prevent false positives
      if (targetWords.length > 1 && exactWordMatches < targetWords.length) {
        score -= 100; // Heavy penalty for missing words
      }
      
      // Check if this element matches any future step (prevent premature highlighting)
      if (steps && currentStepIndex < steps.length - 1) {
        for (let i = currentStepIndex + 1; i < steps.length; i++) {
          const futureStep = steps[i];
          const futureTarget = (futureStep.target_text || futureStep.targetText || futureStep.target || '').toLowerCase();
          if (futureTarget && futureTarget.length > 3) {
            // Check if this element is a better match for a future step
            const normalizedFutureTarget = futureTarget.replace(/-/g, ' ');
            const futureWords = normalizedFutureTarget.split(' ').filter(w => w.length > 2);
            let futureMatches = 0;
            for (const word of futureWords) {
              if (normalizedText.includes(word)) futureMatches++;
            }
            // If this matches more words from future step than current step, penalize heavily
            if (futureMatches > exactWordMatches || (futureMatches === futureWords.length && normalizedFutureTarget !== normalizedTarget)) {
              score -= 300;
              console.log(`[FAU Assistant] Rejecting "${text}" - better match for future step ${i + 1}: "${futureTarget}"`);
            }
          }
        }
      }
      
      // Penalty for misleading matches
      const misleadingTerms = ['accessibility', 'academic', 'financial', 'housing', 'dining', 'parking'];
      for (const term of misleadingTerms) {
        if (normalizedText.includes(term) && !normalizedTarget.includes(term)) {
          score -= 40;
        }
      }
      
      // Penalty for very long text (likely not a button)
      if (normalizedText.length > 50) score -= 15;
      
      return { element: el, score, text };
    }).filter(item => item.score > 50) // Higher threshold to prevent false matches
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      const best = scored[0];
      console.log(`[FAU Assistant] BEST MATCH (score: ${best.score}):`, best.text);
      
      // Check if uncertain: low score OR multiple similar candidates
      const isUncertain = best.score < CONFIG.uncertainScoreThreshold || scored.length > 2;
      
      // If uncertain, return ALL similar candidates (within 30 points of best score)
      if (isUncertain && scored.length > 1) {
        const similarCandidates = scored.filter(s => s.score >= best.score - 30);
        console.log(`[FAU Assistant] 🟧 UNCERTAIN: Found ${similarCandidates.length} similar elements:`, 
          similarCandidates.map(s => `"${s.text}" (score: ${s.score})`));
        
        return {
          elements: similarCandidates.map(s => s.element), // Return array of elements
          isUncertain: true,
          isMultiple: true
        };
      }
      
      // Return single confident match
      console.log(`[FAU Assistant] 🟦 CONFIDENT: Single best match`);
      return {
        elements: [best.element],
        isUncertain: false,
        isMultiple: false
      };
    }

    // Final fallback: search all elements with any text match
    const allElements = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const text = getElementText(el).toLowerCase();
        const normalizedText = text.replace(/-/g, ' ');
        return normalizedText.length > 0 && normalizedText.length < 100 && 
               isElementVisible(el) &&
               targetWords.some(word => normalizedText.includes(word));
      });
    
    if (allElements.length > 0) {
      console.log('[FAU Assistant] FALLBACK MATCH:', getElementText(allElements[0]));
      return {
        elements: [allElements[0]],
        isUncertain: true, // Fallback is always uncertain
        isMultiple: false
      };
    }

    console.log('[FAU Assistant] No element found for:', target);
    return null;
  }

  // Helper: Check if element is visible
  function isElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           el.offsetParent !== null;
  }

  // Helper: Get all text from element including alt text and child images
  function getElementText(el) {
    let text = (el.innerText || el.textContent || el.value ||
                el.getAttribute('aria-label') || el.getAttribute('title') ||
                el.getAttribute('placeholder') || el.getAttribute('alt') || '').trim();
    
    // Also check for images inside this element and get their alt text
    const images = el.querySelectorAll('img[alt]');
    images.forEach(img => {
      const altText = img.getAttribute('alt') || '';
      if (altText && !text.toLowerCase().includes(altText.toLowerCase())) {
        text += ' ' + altText;
      }
    });
    
    // Check nested divs with kgo-title class
    const titleDivs = el.querySelectorAll('div.kgo-title, div.kgo-text, .kgo-title');
    titleDivs.forEach(div => {
      const divText = (div.innerText || div.textContent || '').trim();
      if (divText && !text.toLowerCase().includes(divText.toLowerCase())) {
        text += ' ' + divText;
      }
    });
    
    return text.trim();
  }

  // Clear all highlights and overlays
  function clearHighlights() {
    // Remove highlight classes
    document.querySelectorAll('.fau-highlight, .fau-highlight-uncertain').forEach(el => {
      el.classList.remove('fau-highlight');
      el.classList.remove('fau-highlight-uncertain');
    });

    // Remove message overlay
    if (messageOverlay && messageOverlay.parentNode) {
      messageOverlay.remove();
    }
    messageOverlay = null;

    // Clear highlighted element reference
    if (highlightedElement) {
      highlightedElement.removeEventListener('click', handleElementClick);
      highlightedElement = null;
    }

    // Clear auto-advance timer
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
  }

  // Main highlighting function with smart step detection
  function highlightElement(selector, message) {
    try {
      clearHighlights();
      
      // Check if this is a URL navigation step
      const currentUrl = window.location.href;
      const instruction = message || '';
      
      // Handle URL navigation steps
      if ((instruction.toLowerCase().includes('go to') || instruction.toLowerCase().includes('navigate to')) && 
          (instruction.toLowerCase().includes('myfau') || instruction.toLowerCase().includes('portal') || instruction.toLowerCase().includes('student portal'))) {
        
        showFloatingMessage(
          `Step ${currentStepIndex + 1}/${steps.length}: ${instruction}\n\nThis is a website navigation step. Please navigate to MyFAU portal manually, then click Next to continue.`,
          false
        );
        return true;
      }
      
      let result = findElement(selector);
      
      // Don't look for future steps - stick to current step only
      // This prevents skipping steps when multiple elements are on same page
      
      if (!result) {
        console.warn('[FAU Assistant] Element not found:', selector);
        showFloatingMessage(
          `Step ${currentStepIndex + 1}/${steps.length}: Looking for "${selector}"...\n\nThis element might be on a different page. Try navigating manually or click Next to continue.`, 
          true
        );
        return false;
      }

      // Extract elements array and flags
      const elements = result.elements || [result.element || result];
      const isUncertain = result.isUncertain || false;
      const isMultiple = result.isMultiple || false;

      // Apply appropriate highlight class to ALL matched elements
      elements.forEach((element, index) => {
        if (isUncertain) {
          element.classList.add('fau-highlight-uncertain');
          if (index === 0) {
            console.log(`[FAU Assistant] ⚠️ Using UNCERTAIN (orange) highlight on ${elements.length} element(s)`);
          }
        } else {
          element.classList.add('fau-highlight');
          if (index === 0) {
            console.log('[FAU Assistant] ✓ Using CONFIDENT (cyan) highlight');
          }
        }
      });
      
      // Store first element as the primary highlighted element
      const primaryElement = elements[0];
      highlightedElement = primaryElement;

      // Scroll primary element into view
      primaryElement.scrollIntoView({
        behavior: CONFIG.autoScrollBehavior,
        block: 'center',
        inline: 'nearest'
      });

      // Show message overlay with uncertainty indicator
      const uncertaintyNote = isMultiple ? 
        `\n\n⚠️ Found ${elements.length} similar elements highlighted in orange. Please select the correct one.` : 
        (isUncertain ? '\n\n⚠️ Low confidence match. Please verify this is correct.' : '');
      showMessageOverlay(message || `Step ${currentStepIndex + 1}`, primaryElement, uncertaintyNote);

      // Set up click handler for ALL highlighted elements
      elements.forEach(element => {
        if (CONFIG.enableClickAdvance) {
          element.addEventListener('click', handleElementClick, { once: true, capture: true });
        }
      });

      // Auto-advance timer (optional)
      if (CONFIG.autoAdvanceDelay > 0) {
        autoAdvanceTimer = setTimeout(() => {
          console.log('[FAU Assistant] Auto-advancing to next step');
          nextStep();
        }, CONFIG.autoAdvanceDelay);
      }

      console.log('[FAU Assistant] Highlighted element(s):', elements.length);
      return true;
    } catch (error) {
      console.error('[FAU Assistant] Error in highlightElement:', error);
      showFloatingMessage(
        `Step ${currentStepIndex + 1}/${steps.length}: An error occurred.\n\nPlease click Next to continue.`,
        true
      );
      return false;
    }
  }

  // Show message overlay near the highlighted element
  function showMessageOverlay(message, element, uncertaintyNote = '') {
    messageOverlay = document.createElement('div');
    messageOverlay.className = 'fau-message-overlay';
    
    const stepInfo = steps.length > 0 ?
      `<span class="step-number">Step ${currentStepIndex + 1}/${steps.length}</span>` : '';
    
    messageOverlay.innerHTML = `
      <div>${stepInfo}${message}${uncertaintyNote}</div>
      <div class="controls">
        ${currentStepIndex > 0 ? '<button id="fau-prev-btn">Previous</button>' : ''}
        <button id="fau-skip-btn">Skip</button>
        ${currentStepIndex < steps.length - 1 ? '<button id="fau-next-btn">Next</button>' : '<button id="fau-done-btn">Done</button>'}
      </div>
    `;
    
    if (document.body) {
      document.body.appendChild(messageOverlay);
    } else {
      console.error('[FAU Assistant] document.body is null, cannot append overlay');
      return;
    }

    // Position overlay (fixed top-right by default, can be enhanced to position near element)
    // For element-relative positioning, calculate based on element.getBoundingClientRect()

    // Attach button handlers
    const prevBtn = messageOverlay.querySelector('#fau-prev-btn');
    const skipBtn = messageOverlay.querySelector('#fau-skip-btn');
    const nextBtn = messageOverlay.querySelector('#fau-next-btn');
    const doneBtn = messageOverlay.querySelector('#fau-done-btn');

    if (prevBtn) prevBtn.onclick = () => previousStep();
    if (skipBtn) skipBtn.onclick = () => skipStep();
    if (nextBtn) nextBtn.onclick = () => nextStep();
    if (doneBtn) doneBtn.onclick = () => endGuidance();
  }

  // Show floating message when element not found
  function showFloatingMessage(message, isError = false) {
    messageOverlay = document.createElement('div');
    messageOverlay.className = 'fau-message-overlay';
    if (isError) {
      messageOverlay.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
    }
    
    messageOverlay.innerHTML = `
      <div>${message}</div>
      <div class="controls">
        ${currentStepIndex > 0 ? '<button id="fau-prev-btn">Previous</button>' : ''}
        ${currentStepIndex < steps.length - 1 ? '<button id="fau-next-btn">Next</button>' : '<button id="fau-done-btn">Done</button>'}
      </div>
    `;
    
    if (document.body) {
      document.body.appendChild(messageOverlay);
    } else {
      console.error('[FAU Assistant] document.body is null, cannot append overlay');
      return;
    }

    const prevBtn = messageOverlay.querySelector('#fau-prev-btn');
    const nextBtn = messageOverlay.querySelector('#fau-next-btn');
    const doneBtn = messageOverlay.querySelector('#fau-done-btn');

    if (prevBtn) prevBtn.onclick = () => previousStep();
    if (nextBtn) nextBtn.onclick = () => nextStep();
    if (doneBtn) doneBtn.onclick = () => endGuidance();
  }

  // Handle click on highlighted element
  function handleElementClick(event) {
    console.log('[FAU Assistant] Element clicked, advancing to next step');
    // Let the click through for the actual action
    // Then advance after a brief delay
    setTimeout(() => {
      nextStep();
    }, 300);
  }


  // Navigation functions
  function nextStep() {
    if (currentStepIndex < steps.length - 1) {
      currentStepIndex++;
      saveState();
      showCurrentStep();
    } else {
      endGuidance();
    }
  }

  function previousStep() {
    if (currentStepIndex > 0) {
      currentStepIndex--;
      saveState();
      showCurrentStep();
    }
  }

  function skipStep() {
    nextStep();
  }

  function endGuidance() {
    clearHighlights();
    clearState();
    steps = [];
    currentStepIndex = 0;
    console.log('[FAU Assistant] Guidance ended');
  }

  // Show the current step
  function showCurrentStep() {
    if (!steps || steps.length === 0 || currentStepIndex < 0 || currentStepIndex >= steps.length) {
      console.warn('[FAU Assistant] Invalid step index or no steps');
      return;
    }

    ensureStyles();
    const step = steps[currentStepIndex];
    const target = step.target_text || step.targetText || step.target || step.selector || '';
    const instruction = step.instruction || step.text || step.message || `Step ${currentStepIndex + 1}`;

    console.log(`[FAU Assistant] Showing step ${currentStepIndex + 1}/${steps.length}:`, instruction);
    highlightElement(target, instruction);
  }

  // Start guidance with an array of steps
  function startGuidance(stepArray) {
    if (!Array.isArray(stepArray) || stepArray.length === 0) {
      console.warn('[FAU Assistant] No steps provided');
      return;
    }

    steps = stepArray;
    currentStepIndex = 0;
    saveState();
    console.log(`[FAU Assistant] Starting guidance with ${steps.length} steps`);
    showCurrentStep();
  }


  // Listen for messages from popup and background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;
    
    if (msg.type === 'apply_steps') {
      steps = msg.steps || [];
      startGuidance(steps);
      sendResponse({ ok: true, applied: steps.length });
    } else if (msg.type === 'clear_steps') {
      endGuidance();
      sendResponse({ ok: true });
    } else if (msg.type === 'open_chat') {
      const startOpen = msg.open !== false;
      ensureChatWidget();
      if (startOpen) showChat();
      sendResponse({ ok: true });
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (steps.length === 0) return;
    
    // Arrow keys for navigation (when guidance is active)
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      nextStep();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      previousStep();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      endGuidance();
    }
  });

  // ---------- In-page draggable/resizable chat widget ----------
  let chatWidget = null;
  function ensureChatWidget() {
    if (document.getElementById('fau-assistant-chat')) return;
    const css = document.createElement('style');
    css.id = 'fau-assistant-chat-styles';
    css.textContent = `
      #fau-assistant-chat { position: fixed; right: 20px; bottom: 20px; width: 380px; height: 500px; background: #fff; box-shadow: 0 12px 40px rgba(0,0,0,0.15); border-radius:12px; z-index:2147483648; display:flex; flex-direction:column; overflow:hidden; border: 1px solid #e0e6ed; }
      #fau-assistant-chat .header { background: linear-gradient(135deg, #0b63ce 0%, #1e88e5 100%); color:#fff; padding:12px 16px; cursor:move; display:flex; align-items:center; justify-content:space-between; font-weight:600; }
      #fau-assistant-chat .messages { padding:16px; flex:1; overflow:auto; background:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      #fau-assistant-chat .controls { display:flex; gap:8px; padding:12px 16px; border-top:1px solid #e0e6ed; background:#fff; }
      #fau-assistant-chat textarea { flex:1; min-height:44px; max-height:120px; border:1px solid #d1d9e0; border-radius:8px; padding:8px 12px; font-family:inherit; resize:vertical; }
      #fau-assistant-chat button { background:#0b63ce; color:#fff; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; font-weight:500; }
      #fau-assistant-chat button:hover { background:#0952b3; }
      #fau-assistant-chat .msg.user { text-align:right; margin:8px 0; }
      #fau-assistant-chat .msg.assistant { text-align:left; margin:8px 0; }
      #fau-assistant-chat .msg .bubble { display:inline-block; padding:10px 14px; border-radius:16px; max-width:85%; word-wrap:break-word; }
      #fau-assistant-chat .msg.user .bubble { background: linear-gradient(135deg, #0b63ce 0%, #1e88e5 100%); color:#fff; }
      #fau-assistant-chat .msg.assistant .bubble { background:#fff; border:1px solid #e0e6ed; color:#374151; }
      #fau-assistant-chat .footer-resize { width:16px; height:16px; position:absolute; right:2px; bottom:2px; cursor:se-resize; background:url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M16 16V10l-6 6h6zM16 6L6 16h4l6-6V6zM16 2L2 16h4L16 6V2z" fill="%23cbd5e1"/></svg>'); }
    `;
    document.head.appendChild(css);

    chatWidget = document.createElement('div');
    chatWidget.id = 'fau-assistant-chat';
    chatWidget.innerHTML = `
      <div class="header"><div>🎓 FAU Assistant</div><div style="display:flex;gap:8px;"><button id="fau-close-btn" title="Close" style="background:rgba(255,255,255,0.2);border:none;color:#fff;border-radius:4px;width:24px;height:24px;cursor:pointer;">✕</button></div></div>
      <div class="messages" id="fau-messages"></div>
      <div class="controls"><textarea id="fau-input" placeholder="Ask: How do I register for classes?"></textarea><button id="fau-send">Send</button></div>
      <div class="footer-resize" id="fau-resize-handle"></div>
    `;
    
    // Load previous messages
    const savedMessages = JSON.parse(localStorage.getItem('fau-chat-messages') || '[]');
    const container = chatWidget.querySelector('#fau-messages');
    
    if (savedMessages.length === 0) {
      appendMessage('assistant', 'Hi! I\'m your FAU Assistant. Ask me anything about registering for classes, finding resources, or navigating the FAU website.');
    } else {
      savedMessages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'msg ' + (msg.from === 'user' ? 'user' : 'assistant');
        const b = document.createElement('div'); b.className = 'bubble'; b.textContent = msg.text;
        div.appendChild(b); container.appendChild(div);
      });
    }
    
    // Always scroll to bottom after loading
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 300);
    document.body.appendChild(chatWidget);

    // Dragging
    const header = chatWidget.querySelector('.header');
    let dragging = false, dragOffsetX = 0, dragOffsetY = 0;
    header.addEventListener('mousedown', (e) => {
      dragging = true;
      const rect = chatWidget.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      chatWidget.style.left = Math.max(8, e.clientX - dragOffsetX) + 'px';
      chatWidget.style.top = Math.max(8, e.clientY - dragOffsetY) + 'px';
      chatWidget.style.right = 'auto';
      chatWidget.style.bottom = 'auto';
    });
    window.addEventListener('mouseup', () => { dragging = false; document.body.style.userSelect = ''; });

    // Resizing (simple via the resize handle)
    const handle = document.getElementById('fau-resize-handle');
    let resizing = false, startW = 0, startH = 0, startX = 0, startY = 0;
    handle.addEventListener('mousedown', (e) => {
      resizing = true;
      const rect = chatWidget.getBoundingClientRect();
      startW = rect.width; startH = rect.height; startX = e.clientX; startY = e.clientY;
      e.stopPropagation();
      document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const dx = e.clientX - startX; const dy = e.clientY - startY;
      chatWidget.style.width = Math.max(220, startW + dx) + 'px';
      chatWidget.style.height = Math.max(160, startH + dy) + 'px';
    });
    window.addEventListener('mouseup', () => { resizing = false; document.body.style.userSelect = ''; });

    // Controls: send and close
    const closeBtn = chatWidget.querySelector('#fau-close-btn');
    const sendBtn = chatWidget.querySelector('#fau-send');
    const inputField = chatWidget.querySelector('#fau-input');
    
    if (closeBtn && sendBtn && inputField) {
      closeBtn.addEventListener('click', () => { chatWidget.style.display = 'none'; });
      sendBtn.addEventListener('click', async () => {
        const msg = inputField.value.trim();
        if (!msg) return;
        console.log('[FAU Assistant] Sending message:', msg);
        appendMessage('user', msg);
        inputField.value = '';
        
        // Send message to background service worker to avoid mixed-content blocking
        console.log('[FAU Assistant] Requesting orchestration from background');
        chrome.runtime.sendMessage({ type: 'orchestrate', message: msg }, (resp) => {
          if (chrome.runtime.lastError) {
            console.error('[FAU Assistant] Runtime error:', chrome.runtime.lastError);
            appendMessage('assistant', `Error: ${chrome.runtime.lastError.message}`);
            return;
          }
          
          if (!resp || !resp.ok) {
            console.error('[FAU Assistant] Backend error:', resp && resp.error);
            appendMessage('assistant', `Error contacting backend: ${resp && resp.error ? resp.error : 'no response'}`);
            return;
          }
          
          const data = resp.data;
          console.log('[FAU Assistant] Backend response:', data);
          
          // Display summary
          appendMessage('assistant', data.summary || 'Here are the steps');
          
          // Display numbered steps
          if (Array.isArray(data.steps) && data.steps.length > 0) {
            data.steps.forEach((s, i) => {
              appendMessage('assistant', `${i + 1}. ${s.instruction || JSON.stringify(s)}`);
            });
            
            // Save chat messages
            const messages = JSON.parse(localStorage.getItem('fau-chat-messages') || '[]');
            messages.push({ from: 'user', text: msg });
            messages.push({ from: 'assistant', text: data.summary || 'Here are the steps' });
            data.steps.forEach((s, i) => {
              messages.push({ from: 'assistant', text: `${i + 1}. ${s.instruction || JSON.stringify(s)}` });
            });
            localStorage.setItem('fau-chat-messages', JSON.stringify(messages.slice(-20))); // Keep last 20 messages
            
            // Start automated guidance
            startGuidance(data.steps);
          }
        });
      });
    } else {
      console.error('[FAU Assistant] Chat widget elements not found');
    }

    function appendMessage(from, text) {
      if (!chatWidget) {
        console.error('[FAU Assistant] chatWidget is null, cannot append message');
        return;
      }
      
      const container = chatWidget.querySelector('#fau-messages');
      if (!container) {
        console.error('[FAU Assistant] messages container not found');
        return;
      }
      
      const div = document.createElement('div');
      div.className = 'msg ' + (from === 'user' ? 'user' : 'assistant');
      const b = document.createElement('div'); 
      b.className = 'bubble'; 
      b.textContent = text;
      div.appendChild(b); 
      container.appendChild(div); 
      // Force scroll to bottom
      container.scrollTop = container.scrollHeight;
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 100);
      
      // Save to localStorage
      const messages = JSON.parse(localStorage.getItem('fau-chat-messages') || '[]');
      messages.push({ from, text });
      localStorage.setItem('fau-chat-messages', JSON.stringify(messages.slice(-20)));
      
      console.log('[FAU Assistant] Message appended:', from, text);
    }
  }

  function showChat() {
    ensureChatWidget();
    const w = document.getElementById('fau-assistant-chat');
    if (w) w.style.display = 'flex';
  }

  // Initialize on all pages (not just FAU)
  // Wait for page to load before showing chat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeSession();
      setTimeout(() => showChat(), 500);
    });
  } else {
    // Page already loaded
    initializeSession();
    setTimeout(() => showChat(), 500);
  }

})();
