// langsmith-extension.js
(() => {
  'use strict';
  
  const CONFIG_KEY = 'langsmithConfig';
  const MAX_CONTENT_LENGTH = 3000;

  // Secure Configuration Manager
  const config = {
    get: () => {
      try {
        const saved = localStorage.getItem(CONFIG_KEY);
        return saved ? JSON.parse(saved) : { apiKey: '' };
      } catch {
        return { apiKey: '' };
      }
    },
    set: (key) => {
      if (key && key.startsWith('lsv2_')) {
        localStorage.setItem(CONFIG_KEY, JSON.stringify({ apiKey: key }));
        return true;
      }
      return false;
    }
  };

  // Add Settings UI to TypingMind
  const injectSettingsUI = () => {
    const settingsPanel = document.querySelector('[data-element-id="settings-panel"]');
    if (!settingsPanel) return;

    const html = `
      <div class="settings-section" style="margin-top: 20px;">
        <h3>LangSmith Configuration</h3>
        <input type="text" 
               id="langsmithApiKey" 
               placeholder="lsv2_your_api_key_here"
               style="width: 100%; padding: 8px; margin: 10px 0;">
        <button id="saveLangsmithKey" 
                style="padding: 8px 15px; background: #4CAF50; color: white; border: none;">
          Save API Key
        </button>
        <div id="langsmithStatus" style="margin-top: 10px;"></div>
      </div>
    `;

    settingsPanel.insertAdjacentHTML('beforeend', html);
    
    const keyInput = document.getElementById('langsmithApiKey');
    const saveButton = document.getElementById('saveLangsmithKey');
    const statusDiv = document.getElementById('langsmithStatus');

    // Load existing config
    keyInput.value = config.get().apiKey;

    // Save handler
    saveButton.addEventListener('click', () => {
      if (config.set(keyInput.value.trim())) {
        statusDiv.textContent = '✓ API key saved securely';
        statusDiv.style.color = 'green';
      } else {
        statusDiv.textContent = '⚠ Invalid API key format';
        statusDiv.style.color = 'red';
      }
    });
  };

  // API Interception
  const interceptLLMCalls = () => {
    const nativeFetch = window.fetch;
    
    window.fetch = async (url, options) => {
      if (url.includes('/chat/completions')) {
        const apiKey = config.get().apiKey;
        if (!apiKey) return nativeFetch(url, options);

        try {
          const startTime = Date.now();
          const response = await nativeFetch(url, options);
          const clonedResponse = response.clone();

          // Async processing to avoid blocking
          setTimeout(async () => {
            try {
              const reqBody = options?.body ? JSON.parse(options.body) : null;
              const resData = await clonedResponse.json();

              // Sanitize and send
              fetch('https://api.smith.langchain.com/runs', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                  inputs: {
                    messages: (reqBody?.messages || []).map(msg => ({
                      role: String(msg.role).slice(0, 20),
                      content: String(msg.content).slice(0, MAX_CONTENT_LENGTH)
                    }))
                  },
                  outputs: {
                    content: String(resData.choices?.[0]?.message?.content || '')
                            .slice(0, MAX_CONTENT_LENGTH),
                    tokens: resData.usage || {}
                  }
                })
              });
            } catch (error) {
              console.error('[LangSmith] Processing error:', error);
            }
          }, 0);

          return response;
        } catch (error) {
          console.error('[LangSmith] Fetch error:', error);
          return nativeFetch(url, options);
        }
      }
      return nativeFetch(url, options);
    };
  };

  // Initialize
  const init = () => {
    injectSettingsUI();
    interceptLLMCalls();
    console.log('[LangSmith] Extension initialized');
  };

  // Wait for TypingMind to load
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
