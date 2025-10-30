// Chrome AI Service - Unified wrapper for Chrome's built-in AI APIs
// Supports: Prompt API (for chat & outreach), Summarizer API (for summaries)

const aiLogger = window.createLogger ? window.createLogger('ChromeAI') : console

class ChromeAIService {
  constructor() {
    this.sessions = {
      summarizer: null,
      prompt: null,
    }

    this.availability = {
      summarizer: 'unknown',
      prompt: 'unknown',
    }

    this.isInitialized = false
  }

  /**
   * Initialize and check availability of all AI APIs
   * @returns {Promise<Object>} Availability status for each API
   */
  async initialize() {
    if (this.isInitialized) {
      return this.availability
    }

    aiLogger.info('Initializing Chrome AI Service...')
    const chromeVersion =
      navigator.userAgent.match(/Chrome\/([0-9]+)/)?.[1] || 'Unknown'
    aiLogger.info('Chrome Version:', chromeVersion)

    try {
      // Check for Chrome 138+ API (modern API only)
      if (typeof window.LanguageModel === 'undefined') {
        aiLogger.warn('Chrome AI not available - requires Chrome 138+')
        this.logSetupInstructions()
        this.isInitialized = true
        return this.availability
      }

      aiLogger.info('Detected Chrome AI API (138+)')

      // Check Language Model (Prompt API)
      try {
        const availability = await window.LanguageModel.availability()
        this.availability.prompt =
          availability === 'available' ? 'readily' : availability
        aiLogger.info('Language Model availability:', this.availability.prompt)
      } catch (error) {
        this.availability.prompt = 'unavailable'
        aiLogger.warn('Language Model check failed:', error)
      }

      // Check Summarizer API
      if (typeof window.Summarizer !== 'undefined') {
        try {
          const availability = await window.Summarizer.availability()
          this.availability.summarizer =
            availability === 'available' ? 'readily' : availability
          aiLogger.info(
            'Summarizer API availability:',
            this.availability.summarizer
          )
        } catch (error) {
          this.availability.summarizer = 'unavailable'
          aiLogger.warn('Summarizer API check failed:', error)
        }
      } else {
        this.availability.summarizer = 'unavailable'
        aiLogger.info('Summarizer API not found')
      }

      this.isInitialized = true
      aiLogger.info('Chrome AI Service initialized:', this.availability)
    } catch (error) {
      aiLogger.error('Error initializing Chrome AI Service:', error)
    }

    return this.availability
  }

  /**
   * Check if a specific API is available
   * @param {string} apiName - Name of the API (summarizer, prompt)
   * @param {boolean} includeDownloadable - Whether to consider 'downloadable'/'downloading' as available (default: true)
   * @returns {boolean} True if available
   */
  isAvailable(apiName, includeDownloadable = true) {
    const status = this.availability[apiName]

    // Chrome 138+ returns: 'readily' (mapped from 'available'), 'downloadable', 'downloading', 'unavailable'
    if (typeof status === 'string') {
      const availableStates = includeDownloadable
        ? ['readily', 'available', 'downloadable', 'downloading']
        : ['readily', 'available']

      return availableStates.includes(status)
    }

    return false
  }

  /**
   * Force re-check availability status (useful if model was just downloaded)
   * @returns {Promise<Object>} Updated availability status
   */
  async recheckAvailability() {
    aiLogger.info('Rechecking Chrome AI availability...')
    
    this.isInitialized = false
    this.availability = {
      summarizer: 'unknown',
      prompt: 'unknown',
    }
    
    return await this.initialize()
  }

  /**
   * Get availability status with detailed information
   * @returns {Object} Detailed availability information
   */
  getDetailedAvailability() {
    const details = {
      summarizer: {
        available: this.isAvailable('summarizer'),
        status: this.availability.summarizer,
        requiresDownload: ['downloadable', 'downloading'].includes(
          this.availability.summarizer
        ),
      },
      prompt: {
        available: this.isAvailable('prompt'),
        status: this.availability.prompt,
        requiresDownload: ['downloadable', 'downloading'].includes(
          this.availability.prompt
        ),
      },
    }
    
    aiLogger.debug('Detailed availability check:', details)
    return details
  }

  /**
   * Get availability status with detailed information (synchronous alias)
   * @returns {Object} Detailed availability information
   */
  getDetailedAvailabilitySync() {
    return this.getDetailedAvailability()
  }

  // ============================================================================
  // SUMMARIZER API
  // ============================================================================

  /**
   * Create a summarizer session
   * @param {Object} options - Summarizer options
   * @param {string} options.type - Type of summary: 'key-points', 'tldr', 'teaser', 'headline'
   * @param {string} options.format - Output format: 'markdown', 'plain-text'
   * @param {string} options.length - Length: 'short', 'medium', 'long'
   * @param {string} options.sharedContext - Additional context to help the summarizer
   * @param {string[]} options.expectedInputLanguages - Expected input languages (e.g., ['en', 'es', 'ja'])
   * @param {string} options.outputLanguage - Desired output language (e.g., 'en')
   * @param {string[]} options.expectedContextLanguages - Expected context languages
   * @returns {Promise<Object>} Summarizer session
   */
  async createSummarizer(options = {}) {
    if (!this.isAvailable('summarizer')) {
      const status = this.availability.summarizer
      let message = 'Chrome AI Summarizer is not available. '
      
      if (status === 'unavailable') {
        message += 'Please enable the Summarizer API flag in chrome://flags/ and restart Chrome.'
      } else if (status === 'downloadable') {
        message += 'The model needs to be downloaded. Click "Download" in the AI features panel.'
      } else if (status === 'downloading') {
        message += 'The model is currently downloading. Please wait and try again.'
      }
      
      throw new Error(message)
    }

    try {
      const defaultOptions = {
        type: 'key-points',
        format: 'markdown',
        length: 'medium',
      }

      const mergedOptions = { ...defaultOptions, ...options }

      aiLogger.info('Creating summarizer with options:', mergedOptions)

      // Use Chrome 138+ API with timeout
      const summarizer = await Promise.race([
        window.Summarizer.create(mergedOptions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Summarizer creation timed out. The model may still be downloading.')), 10000)
        )
      ])
      
      this.sessions.summarizer = summarizer

      return summarizer
    } catch (error) {
      aiLogger.error('Error creating summarizer:', error)
      throw error
    }
  }

  /**
   * Summarize text
   * @param {string} text - Text to summarize
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Summary
   */
  async summarizeText(text, options = {}) {
    try {
      if (!this.sessions.summarizer) {
        await this.createSummarizer(options)
      }

      aiLogger.info('Summarizing text...')
      const summary = await this.sessions.summarizer.summarize(text, options)

      return summary
    } catch (error) {
      aiLogger.error('Error summarizing text:', error)
      throw error
    }
  }

  /**
   * Summarize text with streaming
   * @param {string} text - Text to summarize
   * @param {Object} options - Additional options
   * @returns {AsyncIterable<string>} Streaming summary
   */
  async summarizeStreaming(text, options = {}) {
    try {
      if (!this.sessions.summarizer) {
        await this.createSummarizer(options)
      }

      aiLogger.info('Streaming summarization...')
      const stream = await this.sessions.summarizer.summarizeStreaming(
        text,
        options
      )

      return stream
    } catch (error) {
      aiLogger.error('Error streaming summarization:', error)
      throw error
    }
  }

  // ============================================================================
  // OUTREACH GENERATION (Using Prompt API)
  // ============================================================================

  /**
   * Generate personalized outreach message using Prompt API
   * @param {Object} context - Context about the person/company
   * @param {string} messageType - Type of message (cold-email, linkedin, follow-up)
   * @param {string} tone - Tone (professional, casual, friendly)
   * @param {string} length - Length (short, medium, long)
   * @returns {Promise<string>} Generated message
   */
  async generateOutreach(
    context,
    messageType = 'cold-email',
    tone = 'professional',
    length = 'medium'
  ) {
    if (!this.isAvailable('prompt')) {
      throw new Error('Prompt API is not available for outreach generation')
    }

    try {
      // Build comprehensive prompt with context and instructions
      const prompt = this.buildOutreachPrompt(context, messageType, tone, length)

      // Create a fresh session for outreach generation
      const session = await this.createPromptSession()
      const message = await session.prompt(prompt)
      session.destroy()

      return message.trim()
    } catch (error) {
      aiLogger.error('Error generating outreach:', error)
      throw error
    }
  }

  // ============================================================================
  // TEXT REWRITING (Using Prompt API)
  // ============================================================================

  /**
   * Rewrite text with different tone using Prompt API
   * @param {string} text - Text to rewrite
   * @param {string} tone - Desired tone (more-casual, more-formal, more-professional, more-friendly)
   * @returns {Promise<string>} Rewritten text
   */
  async rewriteText(text, tone = 'more-professional') {
    if (!this.isAvailable('prompt')) {
      throw new Error('Prompt API is not available for rewriting')
    }

    let session = null
    try {
      const toneInstructions = {
        'more-casual':
          'Make this text more casual and friendly while keeping the main message',
        'more-formal': 'Make this text more formal and professional',
        'more-professional': 'Make this text more professional and polished',
        'more-friendly': 'Make this text more friendly and approachable',
        shorter: 'Make this text shorter and more concise',
        longer: 'Expand this text with more detail and context',
      }

      const instruction =
        toneInstructions[tone] || toneInstructions['more-professional']

      const prompt = `${instruction}:

Original text:
"${text}"

Rewritten text:`

      aiLogger.info(`Rewriting text with tone: ${tone}`)
      
      // Create a fresh session for this operation
      session = await this.createPromptSession()
      const rewritten = await session.prompt(prompt)

      return rewritten.trim()
    } catch (error) {
      aiLogger.error('Error rewriting text:', error)
      throw error
    } finally {
      // Clean up session
      if (session && typeof session.destroy === 'function') {
        try {
          session.destroy()
        } catch (e) {
          aiLogger.warn('Error destroying rewrite session:', e)
        }
      }
    }
  }

  // ============================================================================
  // PROMPT API
  // ============================================================================

  /**
   * Create a prompt session
   * @param {Object} options - Prompt API options
   * @returns {Promise<Object>} Prompt session
   */
  async createPromptSession(options = {}) {
    if (!this.isAvailable('prompt')) {
      const status = this.availability.prompt
      let message = 'Chrome AI is not available. '
      
      if (status === 'unavailable') {
        message += 'Please enable the Prompt API flag in chrome://flags/#prompt-api-for-gemini-nano and restart Chrome.'
      } else if (status === 'downloadable') {
        message += 'The Gemini Nano model needs to be downloaded. Click "Download" in the AI features panel.'
      } else if (status === 'downloading') {
        message += 'The Gemini Nano model is currently downloading. Please wait and try again.'
      } else {
        message += 'Status: ' + status
      }
      
      throw new Error(message)
    }

    try {
      aiLogger.info('Creating prompt session...')

      // Add required language parameter (defaults to English)
      const sessionOptions = {
        language: 'en',
        ...options
      }

      // Use Chrome 138+ API with timeout
      const session = await Promise.race([
        window.LanguageModel.create(sessionOptions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Model creation timed out. The model may still be downloading.')), 10000)
        )
      ])
      
      this.sessions.prompt = session

      return session
    } catch (error) {
      aiLogger.error('Error creating prompt session:', error)
      throw error
    }
  }

  /**
   * Send a prompt to the language model
   * @param {string} prompt - Prompt text
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Response
   */
  async prompt(prompt, options = {}) {
    try {
      if (!this.sessions.prompt) {
        await this.createPromptSession(options)
      }

      aiLogger.info('Sending prompt...')
      const response = await this.sessions.prompt.prompt(prompt)

      return response
    } catch (error) {
      aiLogger.error('Error sending prompt:', error)
      throw error
    }
  }

  /**
   * Send a prompt with streaming response
   * @param {string} prompt - Prompt text
   * @param {Object} options - Additional options
   * @returns {AsyncIterable<string>} Streaming response
   */
  async promptStreaming(prompt, options = {}) {
    try {
      if (!this.sessions.prompt) {
        await this.createPromptSession(options)
      }

      aiLogger.info('Streaming prompt...')
      const stream = await this.sessions.prompt.promptStreaming(prompt)

      return stream
    } catch (error) {
      aiLogger.error('Error streaming prompt:', error)
      throw error
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Build shared context from LinkedIntel data
   * @param {Object} context - Context object
   * @returns {string} Shared context string
   */
  buildSharedContext(context) {
    if (!context) {
      // Try to extract from page if no context provided
      context = this.extractContextFromPage()
    }

    const parts = []

    // Handle unified context format (from unified-context-service)
    if (context.profile || context.company) {
      parts.push(`PROSPECT INFORMATION:`)
      
      const profile = context.profile || {}
      const company = context.company || {}
      
      if (profile.name) parts.push(`Name: ${profile.name}`)
      if (profile.title || profile.currentPosition) parts.push(`Title: ${profile.title || profile.currentPosition}`)
      if (company.name || profile.company) parts.push(`Company: ${company.name || profile.company}`)
      
      // Get industry from multiple sources
      const industry = company.industry || profile.industry || context.industry
      if (industry) parts.push(`Industry: ${industry}`)
      
      if (profile.location || company.location) parts.push(`Location: ${profile.location || company.location}`)
      
      // Add company size
      if (company.size) parts.push(`Company Size: ${company.size}`)
      
      // Add key insights
      if (context.intelligence?.keyInsights) {
        parts.push(`Key Insights: ${context.intelligence.keyInsights.slice(0, 3).join('; ')}`)
      } else if (profile.highlights) {
        parts.push(`Key Insights: ${profile.highlights.join('; ')}`)
      }
      
      aiLogger.debug('Built context from unified format:', { profile, company, industry })
    } 
    // Handle legacy profile format
    else if (context.type === 'profile') {
      parts.push(`PROSPECT INFORMATION:`)
      if (context.name) parts.push(`Name: ${context.name}`)
      if (context.company) parts.push(`Company: ${context.company}`)
      if (context.title) parts.push(`Title: ${context.title}`)
      
      const industry = context.industry || context.companyInfo?.industry
      if (industry) parts.push(`Industry: ${industry}`)
      
      if (context.location) parts.push(`Location: ${context.location}`)
      
      if (context.companyInfo?.size) parts.push(`Company Size: ${context.companyInfo.size}`)
      
      if (context.highlights && context.highlights.length > 0) {
        parts.push(`Key Insights: ${context.highlights.join('; ')}`)
      }
      
      aiLogger.debug('Built context from legacy profile format')
    } 
    // Handle legacy company format
    else if (context.type === 'company') {
      parts.push(`COMPANY INFORMATION:`)
      if (context.name) parts.push(`Company Name: ${context.name}`)
      if (context.industry) parts.push(`Industry: ${context.industry}`)
      if (context.size) parts.push(`Company Size: ${context.size}`)
      if (context.location) parts.push(`Location: ${context.location}`)
      if (context.highlights && context.highlights.length > 0) {
        parts.push(`Key Insights: ${context.highlights.join('; ')}`)
      }
      
      aiLogger.debug('Built context from legacy company format')
    }

    const result = parts.join('\n')
    aiLogger.info('Built shared context:', result)
    return result
  }

  /**
   * Extract context directly from LinkedIn page DOM
   * Fallback when unified context service is not available
   * @returns {Object} Extracted context
   */
  extractContextFromPage() {
    const context = {
      profile: {},
      company: {}
    }

    try {
      // Extract name from LinkedIn profile page
      const nameEl = document.querySelector('h1.text-heading-xlarge')
      if (nameEl) {
        context.profile.name = nameEl.textContent.trim()
      }

      // Extract title/headline
      const titleEl = document.querySelector('.text-body-medium.break-words')
      if (titleEl) {
        context.profile.title = titleEl.textContent.trim()
      }

      // Extract company from profile
      const companyLinks = document.querySelectorAll('a[href*="/company/"]')
      if (companyLinks.length > 0) {
        context.company.name = companyLinks[0].textContent.trim()
      }

      // Extract location
      const locationEl = document.querySelector('.text-body-small.inline')
      if (locationEl) {
        context.profile.location = locationEl.textContent.trim()
      }

      // Try to extract industry from About section
      const aboutSection = document.querySelector('[data-field="experience_section"]')
      if (aboutSection) {
        // Industry might be in various places, this is best-effort
        const text = aboutSection.textContent
        // Look for common industry keywords
        if (text.includes('Technology') || text.includes('Software')) {
          context.company.industry = 'Technology'
        } else if (text.includes('Finance') || text.includes('Banking')) {
          context.company.industry = 'Finance'
        } else if (text.includes('Healthcare') || text.includes('Medical')) {
          context.company.industry = 'Healthcare'
        }
      }

      aiLogger.debug('Extracted context from page DOM:', context)
    } catch (error) {
      aiLogger.error('Error extracting context from page:', error)
    }

    return context
  }

  /**
   * Build outreach prompt based on message type, tone, and length
   * @param {Object} context - Context object
   * @param {string} messageType - Type of message
   * @param {string} tone - Tone (professional, casual, friendly, direct)
   * @param {string} length - Length (short, medium, long)
   * @returns {string} Prompt
   */
  buildOutreachPrompt(context, messageType, tone = 'professional', length = 'medium') {
    const sharedContext = this.buildSharedContext(context)
    
    // Tone mapping
    const toneDescriptions = {
      professional: 'professional and polished',
      casual: 'casual and conversational',
      friendly: 'friendly and warm',
      direct: 'direct and to-the-point',
    }
    
    // Length mapping
    const lengthDescriptions = {
      short: '100-150 words',
      medium: '150-200 words',
      long: '200-250 words',
    }
    
    const toneDesc = toneDescriptions[tone] || 'professional and polished'
    const lengthDesc = lengthDescriptions[length] || '150-200 words'
    
    const baseInstructions = {
      'cold-email': `Write a personalized cold email introduction in a ${toneDesc} tone. Use the prospect's actual name, company, and role. Focus on a specific pain point or opportunity relevant to their industry and position. Keep it around ${lengthDesc}. DO NOT use placeholders like [Their Name] or [Your Product] - write a complete, ready-to-send message.`,
      'linkedin': `Write a personalized LinkedIn connection request message in a ${toneDesc} tone. Use the person's actual name and reference something specific about their work or company. Keep it brief (under 300 characters). DO NOT use placeholders - write a complete message.`,
      'follow-up': `Write a follow-up message in a ${toneDesc} tone. Reference the prospect's name and company. Add value with a relevant insight or resource. Be respectful of their time. Keep it around ${lengthDesc}. DO NOT use placeholders - write a complete, ready-to-send message.`,
      'intro-request': `Write a warm introduction request in a ${toneDesc} tone. Use the prospect's actual name and explain the mutual benefit of connecting. Be specific about why this connection makes sense. Keep it around ${lengthDesc}. DO NOT use placeholders - write a complete, ready-to-send message.`,
    }

    const instruction = baseInstructions[messageType] || baseInstructions['cold-email']

    return `${instruction}

${sharedContext}

IMPORTANT: Write a complete, personalized message using the actual information provided above. Do NOT include placeholders like [Their Name], [Your Product], [Their Company], etc. Write a real, ready-to-send outreach message.`
  }

  /**
   * Destroy all active sessions
   */
  destroySessions() {
    aiLogger.info('Destroying all AI sessions...')

    Object.keys(this.sessions).forEach((key) => {
      if (
        this.sessions[key] &&
        typeof this.sessions[key].destroy === 'function'
      ) {
        try {
          this.sessions[key].destroy()
        } catch (error) {
          aiLogger.warn(`Error destroying ${key} session:`, error)
        }
      }
      this.sessions[key] = null
    })
  }

  /**
   * Download progress monitor
   * @param {Function} callback - Progress callback
   * @returns {Object} Monitor object
   */
  createDownloadMonitor(callback) {
    return {
      addEventListener: (event, handler) => {
        if (event === 'downloadprogress') {
          callback(handler)
        }
      },
    }
  }

  /**
   * Log setup instructions when window.ai is not available
   */
  logSetupInstructions() {
    const chromeVersion = parseInt(
      navigator.userAgent.match(/Chrome\/([0-9]+)/)?.[1] || '0'
    )

    aiLogger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    aiLogger.warn('⚠️  Chrome Built-in AI Not Available')
    aiLogger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    aiLogger.warn('')
    aiLogger.warn('📋 SYSTEM REQUIREMENTS:')
    aiLogger.warn('   • Chrome 138+ (Current: ' + chromeVersion + ')')
    aiLogger.warn('   • 22 GB free disk space')
    aiLogger.warn('   • 4 GB+ GPU VRAM')
    aiLogger.warn('   • macOS 13+, Windows 10/11, or Linux')
    aiLogger.warn('')
    aiLogger.warn('🔧 SETUP STEPS:')
    aiLogger.warn('')
    aiLogger.warn('1️⃣  Update Chrome to 138+')
    aiLogger.warn('   → Check version: chrome://version')
    aiLogger.warn('   → Download Canary: https://www.google.com/chrome/canary/')
    aiLogger.warn('')
    aiLogger.warn('2️⃣  Enable Chrome Flags (copy/paste each URL):')
    aiLogger.warn('   → chrome://flags/#optimization-guide-on-device-model')
    aiLogger.warn('   → chrome://flags/#prompt-api-for-gemini-nano')
    aiLogger.warn('   → chrome://flags/#summarization-api-for-gemini-nano')
    aiLogger.warn('   → chrome://flags/#translation-api')
    aiLogger.warn('   → chrome://flags/#language-detection-api')
    aiLogger.warn('   Set all to: "Enabled"')
    aiLogger.warn('')
    aiLogger.warn('3️⃣  Restart Chrome completely')
    aiLogger.warn('')
    aiLogger.warn('4️⃣  Verify Model Status:')
    aiLogger.warn('   → Visit: chrome://on-device-internals')
    aiLogger.warn('   → Check "Model Status" tab')
    aiLogger.warn('   → Test: await LanguageModel.availability()')
    aiLogger.warn('   → Should return: "available"')
    aiLogger.warn('')
    aiLogger.warn('5️⃣  Refresh this page to verify')
    aiLogger.warn('')
    aiLogger.warn('📖 Full guide: See CHROME_AI_QUICKSTART.md')
    aiLogger.warn('🔍 Test in console: await LanguageModel.availability()')
    aiLogger.warn('')
    aiLogger.warn('💡 LinkedIntel will continue working with cloud AI features')
    aiLogger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }

  /**
   * Test if Chrome AI is properly configured
   * @returns {Promise<Object>} Diagnostic information
   */
  async runDiagnostics() {
    const diagnostics = {
      chromeVersion:
        navigator.userAgent.match(/Chrome\/([0-9]+)/)?.[1] || 'Unknown',
      hasAPI:
        typeof window !== 'undefined' &&
        typeof window.LanguageModel !== 'undefined',
      apis: {
        languageModel: false,
        summarizer: false,
      },
      systemRequirements: {
        chromeVersionOK: false,
        needsDiskSpace: '22 GB free',
        needsVRAM: '4 GB+',
        needsOS: 'macOS 13+, Windows 10/11, or Linux',
      },
      recommendations: [],
    }

    // Check Chrome version
    const chromeVersion = parseInt(diagnostics.chromeVersion)
    diagnostics.systemRequirements.chromeVersionOK = chromeVersion >= 138

    if (isNaN(chromeVersion)) {
      diagnostics.recommendations.push('Cannot detect Chrome version')
    } else if (chromeVersion < 138) {
      diagnostics.recommendations.push(
        `Update to Chrome 138+ (Current: ${chromeVersion})`
      )
      diagnostics.recommendations.push(
        'Download Chrome Canary: https://www.google.com/chrome/canary/'
      )
      return diagnostics
    }

    // Check Chrome 138+ API
    if (!diagnostics.hasAPI) {
      diagnostics.recommendations.push(
        'Chrome AI not available - enable chrome://flags (see setup guide)'
      )
      diagnostics.recommendations.push('Restart Chrome after enabling flags')
      return diagnostics
    }

    // Check Language Model
    try {
      const availability = await window.LanguageModel.availability()
      diagnostics.apis.languageModel = availability === 'available'

      if (availability === 'available') {
        diagnostics.recommendations.push('✅ Language Model is ready!')
      } else {
        diagnostics.recommendations.push(
          `Language Model status: ${availability} - check chrome://on-device-internals`
        )
      }
    } catch (error) {
      diagnostics.languageModelError = error.message
      diagnostics.recommendations.push(
        'Error checking Language Model: ' + error.message
      )
    }

    // Check Summarizer
    if (typeof window.Summarizer !== 'undefined') {
      try {
        const availability = await window.Summarizer.availability()
        diagnostics.apis.summarizer = availability === 'available'
        if (availability === 'available') {
          diagnostics.recommendations.push('✅ Summarizer is ready!')
        } else {
          diagnostics.recommendations.push(`Summarizer status: ${availability}`)
        }
      } catch (error) {
        diagnostics.summarizerError = error.message
      }
    }

    // Summary recommendation
    if (
      diagnostics.recommendations.filter((r) => r.startsWith('✅')).length >= 2
    ) {
      diagnostics.recommendations.unshift('✅ All required APIs ready!')
    }

    return diagnostics
  }
}

// Create singleton instance
const chromeAI = new ChromeAIService()

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.chromeAI = chromeAI

  // Expose diagnostics helper for debugging
  window.testChromeAI = async () => {
    console.log('🔍 Running Chrome AI Diagnostics...\n')
    const diagnostics = await chromeAI.runDiagnostics()

    console.log('📊 Diagnostic Results:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(
      'Chrome Version:',
      diagnostics.chromeVersion,
      diagnostics.systemRequirements.chromeVersionOK ? '✅' : '❌'
    )
    console.log('\nAPI Detection:')
    console.log('  Chrome 138+ API:', diagnostics.hasAPI ? '✅' : '❌')

    console.log('\nAPI Availability:')
    console.log(
      '  Language Model:',
      diagnostics.apis.languageModel ? '✅' : '❌'
    )
    console.log('  Summarizer:', diagnostics.apis.summarizer ? '✅' : '❌')

    console.log('\n📋 System Requirements:')
    console.log(
      '  Chrome Version:',
      diagnostics.systemRequirements.chromeVersionOK
        ? '✅ 138+'
        : '❌ Need 138+'
    )
    console.log('  Disk Space:', diagnostics.systemRequirements.needsDiskSpace)
    console.log('  GPU VRAM:', diagnostics.systemRequirements.needsVRAM)
    console.log('  OS:', diagnostics.systemRequirements.needsOS)

    console.log('\n💡 Recommendations:')
    diagnostics.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`)
    })

    console.log('\n🔗 Useful Links:')
    console.log('  • Check version: chrome://version')
    console.log('  • Model status: chrome://on-device-internals')
    console.log('  • Enable flags: chrome://flags/')
    console.log('  • Download Canary: https://www.google.com/chrome/canary/')

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    return diagnostics
  }

  // Log helper message on load
  if (typeof window.LanguageModel === 'undefined') {
    console.log(
      '%c💡 Chrome AI Troubleshooting',
      'font-weight: bold; font-size: 14px; color: #4c6ef5;'
    )
    console.log('Chrome AI requires Chrome 138+ with flags enabled.')
    console.log(
      'Run %ctestChromeAI()%c in console for diagnostics',
      'background: #f1f3f5; padding: 2px 6px; border-radius: 4px; font-family: monospace;',
      ''
    )
    console.log('Setup guide: CHROME_AI_USAGE.md\n')
  }
}

// Also export as module if in module context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = chromeAI
}
