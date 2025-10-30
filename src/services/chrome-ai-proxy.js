// Chrome AI Proxy - ISOLATED world proxy that communicates with MAIN world bridge
// This creates a window.chromeAI object in ISOLATED world that forwards calls to MAIN world

(function () {
  'use strict'

  const proxyLogger = window.createLogger
    ? window.createLogger('ChromeAI-Proxy')
    : console

  class ChromeAIProxy {
    constructor() {
      this.pendingRequests = new Map()
      this.requestIdCounter = 0
      this.isInitialized = false
      this.availability = {
        summarizer: 'unknown',
        prompt: 'unknown',
      }
      
      // Cached detailed availability (sync access for UI)
      this.detailedAvailability = {
        summarizer: { available: false, status: 'unknown', requiresDownload: false },
        prompt: { available: false, status: 'unknown', requiresDownload: false },
      }

      // Listen for responses from MAIN world
      window.addEventListener('message', (event) => {
        if (event.source !== window) return

        const message = event.data
        if (!message || message.type !== 'CHROME_AI_BRIDGE_RESPONSE') return

        const { requestId, success, result, error } = message.payload

        const pending = this.pendingRequests.get(requestId)
        if (!pending) return

        this.pendingRequests.delete(requestId)

        if (success) {
          pending.resolve(result)
        } else {
          const err = new Error(error.message)
          err.stack = error.stack
          pending.reject(err)
        }
      })

      proxyLogger.info('Chrome AI Proxy initialized (ISOLATED world)')
    }

    /**
     * Send a request to MAIN world bridge
     * @private
     */
    _sendRequest(method, args = []) {
      return new Promise((resolve, reject) => {
        const requestId = `req_${++this.requestIdCounter}_${Date.now()}`

        this.pendingRequests.set(requestId, { resolve, reject })

        // Send message to MAIN world
        window.postMessage(
          {
            type: 'CHROME_AI_BRIDGE_REQUEST',
            payload: {
              method,
              args,
              requestId,
            },
          },
          '*'
        )

        // Timeout after 30 seconds
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId)
            reject(new Error(`Request timeout: ${method}`))
          }
        }, 30000)
      })
    }

    /**
     * Initialize Chrome AI and check availability
     * @returns {Promise<Object>} Availability status
     */
    async initialize() {
      if (this.isInitialized) {
        return this.availability
      }

      try {
        this.availability = await this._sendRequest('initialize')
        this.isInitialized = true
        
        // Update detailed availability cache
        this._updateDetailedAvailabilityCache()
        
        proxyLogger.info('Chrome AI initialized:', this.availability)
        return this.availability
      } catch (error) {
        proxyLogger.error('Failed to initialize Chrome AI:', error)
        throw error
      }
    }
    
    /**
     * Update the detailed availability cache (for sync UI access)
     * @private
     */
    _updateDetailedAvailabilityCache() {
      const isAvailable = (apiName) => {
        const status = this.availability[apiName]
        const availableStates = ['readily', 'downloadable', 'downloading']
        return availableStates.includes(status)
      }
      
      const requiresDownload = (apiName) => {
        const status = this.availability[apiName]
        return ['downloadable', 'downloading'].includes(status)
      }
      
      this.detailedAvailability = {
        summarizer: {
          available: isAvailable('summarizer'),
          status: this.availability.summarizer || 'unknown',
          requiresDownload: requiresDownload('summarizer'),
        },
        prompt: {
          available: isAvailable('prompt'),
          status: this.availability.prompt || 'unknown',
          requiresDownload: requiresDownload('prompt'),
        },
      }
    }

    /**
     * Get current availability status
     * @returns {Promise<Object>}
     */
    async getAvailability() {
      return this._sendRequest('getAvailability')
    }

    /**
   * Check if a specific API is available
   * @param {string} apiName - Name of the API (summarizer, prompt)
   * @param {boolean} includeDownloadable - Whether to consider 'downloadable'/'downloading' as available (default: true)
     * @returns {Promise<boolean>} True if available
     */
    isAvailable(apiName, includeDownloadable = true) {
      return this._sendRequest('isAvailable', [apiName, includeDownloadable])
    }

    /**
     * Get detailed availability status for all APIs
     * @returns {Promise<Object>} Detailed status for each API
     */
    async getDetailedAvailability() {
      return this._sendRequest('getDetailedAvailability')
    }
    
    /**
     * Get detailed availability (synchronous, cached version for UI)
     * @returns {Object} Cached detailed status for each API
     */
    getDetailedAvailabilitySync() {
      return this.detailedAvailability
    }

    /**
     * Summarize text
     * @param {string} text - Text to summarize
     * @param {Object} options - Summarization options
     * @returns {Promise<string>} Summary
     */
    async summarize(text, options = {}) {
      return this._sendRequest('summarize', [text, options])
    }

    /**
     * Summarize text (alias for summarize)
     * @param {string} text - Text to summarize
     * @param {Object} options - Summarization options
     * @returns {Promise<string>} Summary
     */
    async summarizeText(text, options = {}) {
      return this._sendRequest('summarizeText', [text, options])
    }

    /**
     * Generate text based on prompt
     * @param {string} prompt - Writing prompt
     * @param {Object} options - Writing options
     * @returns {Promise<string>} Generated text
     */
    async write(prompt, options = {}) {
      return this._sendRequest('write', [prompt, options])
    }

    /**
     * Rewrite text with specific tone/length
     * @param {string} text - Text to rewrite
     * @param {Object} options - Rewrite options
     * @returns {Promise<string>} Rewritten text
     */
    async rewrite(text, options = {}) {
      return this._sendRequest('rewrite', [text, options])
    }

    /**
     * Proofread text
     * @param {string} text - Text to proofread
     * @param {Object} options - Proofreading options
     * @returns {Promise<Object>} Corrections and suggestions
     */
    async proofread(text, options = {}) {
      return this._sendRequest('proofread', [text, options])
    }

    /**
     * Send a prompt using the Prompt API
     * @param {string} prompt - User prompt
     * @param {Object} options - Prompt options
     * @returns {Promise<string>} AI response
     */
    async prompt(prompt, options = {}) {
      return this._sendRequest('prompt', [prompt, options])
    }

    /**
     * Stream a prompt response
     * @param {string} prompt - User prompt
     * @param {Object} options - Prompt options
     * @returns {Promise<string>} Complete AI response (streaming not supported in proxy)
     */
    async streamPrompt(prompt, options = {}) {
      proxyLogger.warn(
        'Streaming not supported in proxy mode, falling back to regular prompt'
      )
      return this._sendRequest('streamPrompt', [prompt, options])
    }

    /**
     * Create a new session
     * @param {string} apiType - API type (prompt, summarizer, etc.)
     * @param {Object} options - Session options
     * @returns {Promise<string>} Session ID
     */
    async createSession(apiType, options = {}) {
      return this._sendRequest('createSession', [apiType, options])
    }

    /**
     * Destroy a session
     * @param {string} apiType - API type
     * @returns {Promise<void>}
     */
    async destroySession(apiType) {
      return this._sendRequest('destroySession', [apiType])
    }

    /**
     * Destroy all sessions
     * @returns {Promise<void>}
     */
    async destroyAllSessions() {
      return this._sendRequest('destroyAllSessions')
    }

    /**
     * Run diagnostics
     * @returns {Promise<Object>} Diagnostics report
     */
    async runDiagnostics() {
      return this._sendRequest('runDiagnostics')
    }

    /**
     * Generate personalized outreach message
     * @param {Object} context - Context about the person/company
     * @param {string} messageType - Type of message (cold-email, linkedin, follow-up)
     * @param {string} tone - Tone (professional, casual, friendly)
     * @param {string} length - Length (short, medium, long)
     * @returns {Promise<string>} Generated message
     */
    async generateOutreach(context, messageType, tone, length) {
      return this._sendRequest('generateOutreach', [
        context,
        messageType,
        tone,
        length,
      ])
    }

    /**
     * Rewrite text with different tone
     * @param {string} text - Text to rewrite
     * @param {string} tone - Desired tone (more-casual, more-formal, more-professional, more-friendly)
     * @returns {Promise<string>} Rewritten text
     */
    async rewriteText(text, tone) {
      return this._sendRequest('rewriteText', [text, tone])
    }
  }

  // Create proxy instance and expose globally
  const chromeAIProxy = new ChromeAIProxy()
  window.chromeAI = chromeAIProxy

  proxyLogger.info(
    'window.chromeAI proxy available (routes to MAIN world bridge)'
  )

  // Auto-initialize after a short delay to allow MAIN world to load
  setTimeout(() => {
    chromeAIProxy.initialize().catch((error) => {
      proxyLogger.warn('Auto-initialization failed:', error)
    })
  }, 500)
})()

