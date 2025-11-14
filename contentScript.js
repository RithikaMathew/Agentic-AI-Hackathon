// contentScript.js
// Listens for steps from the popup and highlights elements matching target_text.

(function () {
  // Keep state across steps
  let steps = [];
  let current = 0;
  let overlayContainer = null;

  function ensureStyles() {
    if (document.getElementById('fau-assistant-styles')) return;
    const style = document.createElement('style');
    style.id = 'fau-assistant-styles';
    style.textContent = `
      .fau-assistant-highlight { box-shadow: 0 0 0 3px rgba(255,165,0,0.9); position: relative; z-index:2147483646; }
      .fau-assistant-bubble { position: absolute; background: #0b63ce; color: white; padding:8px 12px; border-radius:8px; z-index:2147483647; font-family: Arial, sans-serif; font-size:13px; max-width:320px; }
      .fau-assistant-arrow { position: absolute; z-index:2147483646; pointer-events:none; }
    `;
    document.head.appendChild(style);
  }

  function clearOverlay() {
    if (overlayContainer) {
      overlayContainer.remove();
      overlayContainer = null;
    }
    const prev = document.querySelectorAll('.fau-assistant-highlight');
    prev.forEach((el) => el.classList.remove('fau-assistant-highlight'));
  }

  function createOverlayContainer() {
    clearOverlay();
    overlayContainer = document.createElement('div');
    overlayContainer.id = 'fau-assistant-overlay';
    overlayContainer.style.position = 'fixed';
    overlayContainer.style.left = '0';
    overlayContainer.style.top = '0';
    overlayContainer.style.width = '100%';
    overlayContainer.style.height = '100%';
    overlayContainer.style.pointerEvents = 'none';
    overlayContainer.style.zIndex = '2147483645';
    document.body.appendChild(overlayContainer);
  }

  function findElementByText(targetText) {
    if (!targetText) return null;
    const txt = targetText.trim().toLowerCase();
    console.log(`[FAU Assistant] Looking for text: "${txt}"`);
    
    // search buttons, links, inputs, and generic elements with better matching
    const selectors = ['button', 'a', 'input[type="submit"]', 'input[type="button"]', '[role="button"]', '[role="link"]', '.btn', '.button', 'li', 'span', 'div'];
    const candidates = Array.from(document.querySelectorAll(selectors.join(', ')))
      .filter(el => {
        // Exclude elements that are part of the FAU Assistant widget
        return !el.closest('#fau-assistant-chat') && 
               !el.closest('#fau-assistant-overlay') && 
               !el.classList.contains('fau-assistant-highlight') &&
               !el.classList.contains('fau-assistant-bubble') &&
               !el.classList.contains('fau-assistant-arrow');
      });
    
    console.log(`[FAU Assistant] Found ${candidates.length} potential elements to check (excluding assistant UI)`);
    
    // First pass: exact matches
    for (const el of candidates) {
      try {
        const text = (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().toLowerCase();
        if (text) console.log(`[FAU Assistant] Element text: "${text}"`);
        if (text === txt) {
          console.log(`[FAU Assistant] EXACT MATCH found: "${text}"`);
          return el;
        }
      } catch (e) {}
    }
    
    // Second pass: contains matches
    for (const el of candidates) {
      try {
        const text = (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().toLowerCase();
        if (text && (text.includes(txt) || txt.includes(text))) {
          console.log(`[FAU Assistant] PARTIAL MATCH found: "${text}" for target "${txt}"`);
          return el;
        }
      } catch (e) {}
    }
    
    console.log(`[FAU Assistant] NO MATCH found for "${txt}"`);
    return null;
  }

  function showStep(index) {
    ensureStyles();
    createOverlayContainer();
    clearOverlay();
    if (!steps || index < 0 || index >= steps.length) return;
    current = index;
    const step = steps[index];
    const target = findElementByText(step.target_text || step.targetText || step.target || '');

    if (target) {
      // highlight
      target.classList.add('fau-assistant-highlight');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // bubble
      const rect = target.getBoundingClientRect();
      const bubble = document.createElement('div');
      bubble.className = 'fau-assistant-bubble';
      bubble.textContent = step.instruction || step.text || 'Next step';
      overlayContainer.appendChild(bubble);
      bubble.style.left = Math.max(8, rect.left + window.scrollX) + 'px';
      bubble.style.top = Math.max(8, rect.top + window.scrollY - 48) + 'px';

      // arrow (simple line)
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.classList.add('fau-assistant-arrow');
      svg.setAttribute('width', '200');
      svg.setAttribute('height', '100');
      svg.style.left = Math.max(0, rect.left + window.scrollX - 20) + 'px';
      svg.style.top = Math.max(0, rect.top + window.scrollY - 40) + 'px';
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', '10');
      line.setAttribute('y1', '80');
      line.setAttribute('x2', String(Math.min(180, rect.width + 10)));
      line.setAttribute('y2', '20');
      line.setAttribute('stroke', '#ff9900');
      line.setAttribute('stroke-width', '4');
      line.setAttribute('marker-end', 'url(#arrowhead)');
      const marker = document.createElementNS(svgNS, 'marker');
      marker.setAttribute('id', 'arrowhead');
      marker.setAttribute('markerWidth', '10');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('refX', '0');
      marker.setAttribute('refY', '3.5');
      marker.setAttribute('orient', 'auto');
      const arrowPath = document.createElementNS(svgNS, 'path');
      arrowPath.setAttribute('d', 'M0,0 L0,7 L10,3.5 z');
      arrowPath.setAttribute('fill', '#ff9900');
      marker.appendChild(arrowPath);
      const defs = document.createElementNS(svgNS, 'defs');
      defs.appendChild(marker);
      svg.appendChild(defs);
      svg.appendChild(line);
      overlayContainer.appendChild(svg);

      // make target clickable for advancing
      function onClickAdvance(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        target.removeEventListener('click', onClickAdvance, true);
        // clear current highlight
        target.classList.remove('fau-assistant-highlight');
        // remove bubble/arrow
        clearOverlay();
        // advance
        if (current + 1 < steps.length) {
          showStep(current + 1);
        } else {
          // finished
          steps = [];
          current = 0;
          clearOverlay();
        }
      }

      // attach as capture so it fires before page handlers
      target.addEventListener('click', onClickAdvance, true);

    } else {
      // If no target found, show a floating bubble in top-right
      const bubble = document.createElement('div');
      bubble.className = 'fau-assistant-bubble';
      bubble.style.right = '12px';
      bubble.style.left = 'auto';
      bubble.style.top = '12px';
      bubble.textContent = step.instruction || 'Step: ' + (index + 1);
      overlayContainer.appendChild(bubble);

      // auto-advance button inside bubble
      bubble.style.pointerEvents = 'auto';
      const btn = document.createElement('button');
      btn.textContent = 'Next';
      btn.style.marginLeft = '8px';
      btn.onclick = () => {
        clearOverlay();
        if (current + 1 < steps.length) showStep(current + 1);
      };
      bubble.appendChild(btn);
    }
  }

  // Listen for messages from popup
  // Message handler: supports apply_steps, clear_steps, and open_chat
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'apply_steps') {
      steps = msg.steps || [];
      current = 0;
      if (steps.length > 0) {
        showStep(0);
      }
      sendResponse({ ok: true, applied: steps.length });
    } else if (msg.type === 'clear_steps') {
      steps = [];
      current = 0;
      clearOverlay();
      sendResponse({ ok: true });
    } else if (msg.type === 'open_chat') {
      const startOpen = msg.open !== false;
      ensureChatWidget();
      if (startOpen) showChat();
      sendResponse({ ok: true });
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
    if (savedMessages.length === 0) {
      appendMessage('assistant', 'Hi! I\'m your FAU Assistant. Ask me anything about registering for classes, finding resources, or navigating the FAU website.');
    } else {
      savedMessages.forEach(msg => {
        const container = chatWidget.querySelector('#fau-messages');
        const div = document.createElement('div');
        div.className = 'msg ' + (msg.from === 'user' ? 'user' : 'assistant');
        const b = document.createElement('div'); b.className = 'bubble'; b.textContent = msg.text;
        div.appendChild(b); container.appendChild(div);
      });
      chatWidget.querySelector('#fau-messages').scrollTop = chatWidget.querySelector('#fau-messages').scrollHeight;
    }
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
      // call backend directly from content script
      console.log('[FAU Assistant] Sending message to backend:', msg);
      try {
        const resp = await fetch('http://127.0.0.1:8000/orchestrate', {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ message: msg })
        });
        console.log('[FAU Assistant] Backend response status:', resp.status);
        
        if (!resp.ok) {
          throw new Error(`Backend returned ${resp.status}: ${resp.statusText}`);
        }
        
        const data = await resp.json();
        console.log('[FAU Assistant] Backend response data:', data);
        
        appendMessage('assistant', data.summary || 'Here are the steps');
        // show numbered steps
        if (Array.isArray(data.steps)) {
          data.steps.forEach((s, i) => {
            appendMessage('assistant', `${i + 1}. ${s.instruction || JSON.stringify(s)}`);
          });
          // also apply steps to highlighting flow directly
          steps = data.steps || [];
          current = 0;
          console.log('[FAU Assistant] Applying steps:', steps);
          if (steps.length > 0) {
            showStep(0);
          }
        }
      } catch (e) {
        console.error('[FAU Assistant] Backend error:', e);
        appendMessage('assistant', `Error contacting backend: ${e.message}`);
      }
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
      container.scrollTop = container.scrollHeight;
      
      console.log('[FAU Assistant] Message appended:', from, text);
    }
  }

  function showChat() {
    ensureChatWidget();
    const w = document.getElementById('fau-assistant-chat');
    if (w) w.style.display = 'flex';
  }

  // Auto-show chat widget on FAU pages
  if (window.location.hostname.includes('fau.edu')) {
    setTimeout(() => showChat(), 1000);
  }

})();
