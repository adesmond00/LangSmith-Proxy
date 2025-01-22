// langsmith-extension.js
// Save this entire file and host anywhere (even GitHub Gist)
(() => {
  'use strict';
  
  // 1. Configuration - Edit these values
  const LANG_SMITH_API_KEY = 'lsv2_YOUR_API_KEY_HERE'; // ⚠️ Replace with your key
  const MAX_CONTENT_LENGTH = 3000; // Truncate long content
  
  // 2. Secure Request Interception
  const interceptLLMCalls = () => {
    const nativeFetch = window.fetch;
    
    window.fetch = async (url, options) => {
      if (url.includes('/chat/completions')) {
        try {
          const startTime = Date.now();
          const response = await nativeFetch(url, options);
          const clonedResponse = response.clone();
          
          // Async processing to avoid blocking
          setTimeout(async () => {
            try {
              const reqBody = options?.body ? JSON.parse(options.body) : null;
              const resData = await clonedResponse.json();
              
              // Sanitize data
              const sanitized = {
                inputs: {
                  messages: (reqBody?.messages || []).map(msg => ({
                    role: String(msg.role).slice(0, 20),
                    content: String(msg.content).slice(0, MAX_CONTENT_LENGTH)
                  }))
                },
                outputs: {
                  content: String(resData.choices?.[0]?.message?.content || '').slice(0, MAX_CONTENT_LENGTH),
                  tokens: resData.usage || {}
                }
              };
              
              // Send to LangSmith
              fetch('https://api.smith.langchain.com/runs', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${LANG_SMITH_API_KEY}`
                },
                body: JSON.stringify(sanitized)
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

  // 3. Auto-initialize when TypingMind loads
  const initialize = () => {
    try {
      interceptLLMCalls();
      console.log('[LangSmith] Extension loaded');
    } catch (error) {
      console.error('[LangSmith] Init error:', error);
    }
  };
  
  // Wait for TypingMind to fully load
  if (document.readyState === 'complete') {
    initialize();
  } else {
    window.addEventListener('load', initialize);
  }
})();
