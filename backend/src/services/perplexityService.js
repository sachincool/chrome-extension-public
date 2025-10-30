/**
 * Perplexity AI Service
 * Handles communication with Perplexity API for analysis
 */

const config = require('../config')
const MicroPromptOrchestrator = require('./microPromptOrchestrator')
const { Logger } = require('../utils/logger')

const logger = new Logger('PerplexityService')

class PerplexityService {
  constructor() {
    this.apiKey = config.apis.perplexity.apiKey
    this.baseUrl = config.apis.perplexity.baseUrl
    this.model = config.apis.perplexity.model
    this.timeout = config.apis.perplexity.timeout
    this.maxTokens = config.apis.perplexity.maxTokens

    // Performance tracking
    this.requestQueue = []
    this.isProcessingQueue = false
    this.consecutiveErrors = 0
    this.lastErrorTime = null

    // Initialize micro-prompt orchestrator
    this.microPromptOrchestrator = new MicroPromptOrchestrator(this)

    // Perplexity API Pricing (as of 2024, per 1M tokens)
    // Source: https://docs.perplexity.ai/docs/pricing
    this.PRICING = {
      'sonar-pro': {
        input: 3.0, // $3 per 1M input tokens
        output: 15.0, // $15 per 1M output tokens
      },
      sonar: {
        input: 1.0, // $1 per 1M input tokens
        output: 1.0, // $1 per 1M output tokens
      },
    }
  }

  /**
   * Calculate cost for a Perplexity API request
   * @param {Object} usage - Token usage object { prompt_tokens, completion_tokens, total_tokens }
   * @param {string} model - Model used (default: sonar-pro)
   * @returns {Object} Cost breakdown { inputCost, outputCost, totalCost }
   */
  calculateCost(usage, model = 'sonar-pro') {
    if (!usage || !usage.prompt_tokens || !usage.completion_tokens) {
      return { inputCost: 0, outputCost: 0, totalCost: 0 }
    }

    const pricing = this.PRICING[model] || this.PRICING['sonar-pro']

    // Calculate cost per token (price is per 1M tokens)
    const inputCost = (usage.prompt_tokens / 1000000) * pricing.input
    const outputCost = (usage.completion_tokens / 1000000) * pricing.output
    const totalCost = inputCost + outputCost

    return {
      inputCost: parseFloat(inputCost.toFixed(4)),
      outputCost: parseFloat(outputCost.toFixed(4)),
      totalCost: parseFloat(totalCost.toFixed(4)),
    }
  }

  /**
   * Make a request to Perplexity API with optimized search options
   */
  async makeRequest(messages, options = {}) {
    const requestBody = {
      model: options.model || this.model,
      messages: messages,
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature ?? 0.1,
      top_p: options.topP ?? 0.9,
      return_citations: options.returnCitations !== false,
      return_images: false,
      return_related_questions: false,
    }

    // Search mode (sec/academic/web)
    if (options.searchMode) {
      requestBody.search_mode = options.searchMode
    }

    // Web search context sizing
    if (options.webSearchOptions) {
      requestBody.web_search_options = options.webSearchOptions
    }

    // Domain filtering for accuracy
    if (options.searchDomainFilter && options.searchDomainFilter.length > 0) {
      requestBody.search_domain_filter = options.searchDomainFilter
    }

    // Temporal filtering (mutually exclusive with recency filter)
    if (options.searchAfterDate || options.searchBeforeDate) {
      if (options.searchAfterDate) {
        requestBody.search_after_date_filter = options.searchAfterDate
      }
      if (options.searchBeforeDate) {
        requestBody.search_before_date_filter = options.searchBeforeDate
      }
    } else {
      requestBody.search_recency_filter = options.searchRecencyFilter || 'year'
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMsg = errorData?.error?.message || response.statusText

        if (response.status === 401) {
          throw new Error('Perplexity API: Authentication failed')
        } else if (response.status === 429) {
          throw new Error('Perplexity API: Rate limit exceeded')
        } else if (response.status >= 500) {
          throw new Error(`Perplexity API: Server error (${response.status})`)
        }

        throw new Error(`Perplexity API error: ${response.status} ${errorMsg}`)
      }

      const data = await response.json()

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from Perplexity API')
      }

      if (data.usage) {
        const cost = this.calculateCost(data.usage, requestBody.model)
        logger.info(
          `✅ Perplexity: ${
            data.usage.total_tokens
          } tokens | $${cost.totalCost.toFixed(4)} (in: ${
            data.usage.prompt_tokens
          }, out: ${data.usage.completion_tokens})`
        )
      }

      const citations = data.citations || []
      const searchResults = data.search_results || []

      if (citations.length > 0) {
        logger.debug(`📚 ${citations.length} citations`)
      }

      return {
        content: data.choices[0].message.content,
        usage: data.usage,
        citations: citations,
        searchResults: searchResults,
        finishReason: data.choices[0].finish_reason,
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Perplexity API: Request timeout (${this.timeout}ms)`)
      }

      if (error.message.includes('fetch failed')) {
        throw new Error('Perplexity API: Network error')
      }

      logger.error('❌ Perplexity API error:', error.message)
      throw error
    }
  }

  /**
   * Analyze a company using micro-prompt orchestrator (MVP-aligned)
   */
  async analyzeCompany(companyName) {
    logger.debug(
      `[PerplexityService] Starting company analysis: ${companyName}`
    )
    return await this.microPromptOrchestrator.analyzeCompany(companyName)
  }

  /**
   * Analyze a company using enhanced micro-prompts (new method)
   */
  async analyzeCompanyWithMicroPrompts(companyName) {
    logger.debug(
      `[PerplexityService] Starting enhanced micro-prompt analysis: ${companyName}`
    )
    return await this.microPromptOrchestrator.analyzeCompany(companyName)
  }

  /**
   * Legacy analyze company method (kept for backward compatibility)
   */
  async analyzeCompanyLegacy(companyName) {
    const startTime = Date.now()
    const systemPrompt = {
      role: 'system',
      content:
        'You are a business intelligence specialist with access to real-time web search. Always respond with valid JSON only. Focus on factual, current information with confidence indicators.',
    }

    // Focused prompt for comprehensive company analysis
    const userPrompt = {
      role: 'user',
      content: `Analyze ${companyName} and provide comprehensive business intelligence in this exact JSON format:

{
  "stockInfo": {
    "symbol": "SYMBOL or empty string",
    "price": "current price or empty",
    "ytd": "YTD performance with + or - sign",
    "yoy": "year over year percentage with + or - sign",
    "marketCap": "market cap with unit (B/T)",
    "trend": "up/down/stable",
    "confidence": "high/medium/low"
  },
  "recentNews": [
    {
      "title": "news headline",
      "date": "YYYY-MM-DD",
      "impact": "positive/negative/neutral",
      "confidence": "high/medium/low"
    }
  ],
  "sentiment": {
    "overall": "positive/negative/neutral/mixed",
    "score": 0.85,
    "confidence": "high/medium/low"
  },
  "layoffs": {
    "hasLayoffs": false,
    "details": "details if layoffs occurred, empty otherwise",
    "recentDate": "YYYY-MM-DD or empty",
    "confidence": "high/medium/low"
  },
  "fundingOrM&A": {
    "activity": "recent funding or M&A activity, empty if none",
    "amount": "funding amount or empty",
    "date": "YYYY-MM-DD or empty",
    "confidence": "high/medium/low"
  },
  "productLaunches": {
    "launches": "recent product launches, empty if none",
    "date": "YYYY-MM-DD or empty",
    "confidence": "high/medium/low"
  },
  "techStack": {
    "technologies": ["technology1", "technology2"],
    "confidence": "high/medium/low"
  },
  "keyFacts": ["fact1", "fact2", "fact3"]
}

Provide factual, current information. Include confidence levels for all major insights. If data is unavailable, use empty strings or empty arrays.`,
    }

    const result = await this.makeRequest([systemPrompt, userPrompt])

    // Parse and validate JSON response
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanContent = result.content.trim()

      // Handle markdown code blocks
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '')
        // Find the closing ``` and remove everything after
        const closingIndex = cleanContent.indexOf('```')
        if (closingIndex !== -1) {
          cleanContent = cleanContent.substring(0, closingIndex)
        }
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '')
        const closingIndex = cleanContent.indexOf('```')
        if (closingIndex !== -1) {
          cleanContent = cleanContent.substring(0, closingIndex)
        }
      }

      // Additional cleaning - remove any trailing explanation text after JSON
      // Look for the last } and truncate there
      const lastBraceIndex = cleanContent.lastIndexOf('}')
      if (lastBraceIndex !== -1 && lastBraceIndex < cleanContent.length - 1) {
        const afterBrace = cleanContent.substring(lastBraceIndex + 1).trim()
        if (afterBrace && !afterBrace.startsWith(',')) {
          cleanContent = cleanContent.substring(0, lastBraceIndex + 1)
        }
      }

      // Remove any remaining trailing notes that start with asterisk or other markers
      cleanContent = cleanContent
        .replace(/\s*\*[^}]*$/, '')
        .replace(/\s*Note:[^}]*$/, '')
        .trim()

      const analysis = JSON.parse(cleanContent)

      // Add metadata to the response
      const enrichedData = {
        ...analysis,
        metadata: {
          companyName,
          analysisTimestamp: new Date().toISOString(),
          dataFreshness: 'real-time',
          processingTimeMs: Date.now() - startTime,
          sources: result.citations?.length || 0,
          cacheStatus: 'fresh',
        },
      }

      return {
        success: true,
        data: enrichedData,
        usage: result.usage,
        citations: result.citations,
      }
    } catch (parseError) {
      logger.error('Failed to parse Perplexity response as JSON:', parseError)
      logger.error('Raw response:', result.content)

      // Throw error instead of returning fallback data (per CLAUDE.md requirements)
      logger.error(
        'Company analysis failed - throwing error instead of fallback'
      )
      throw new Error(
        `Company analysis failed for ${companyName}: Unable to parse AI response after multiple attempts`
      )
    }
  }

  /**
   * Analyze a person/profile using micro-prompts
   */
  async analyzePerson(personData) {
    const { name, title = '', company = '' } = personData
    logger.debug(`Person analysis request: ${name}, ${title} at ${company}`)

    try {
      // Use micro-prompt orchestrator for person analysis
      const result = await this.microPromptOrchestrator.analyzePerson(
        name,
        title,
        company
      )

      return {
        success: result.success,
        data: result.data,
        usage: result.usage,
        citations: [], // Micro-prompts handle citations internally
        processingTimeMs: result.processingTimeMs,
        microPromptStats: result.microPromptStats,
      }
    } catch (error) {
      logger.error('Person analysis failed:', error)
      throw new Error(
        `Person analysis failed for ${name} at ${company}: ${error.message}`
      )
    }
  }

  /**
   * Chat with Perplexity AI (context-aware conversational interface)
   * @param {Array} messages - Array of chat messages [{ role: 'user'|'assistant', content: string }]
   * @param {Object} context - Optional LinkedIn context (profile/company data)
   * @returns {Object} Chat response with content, usage, and citations
   */
  async chat(messages, context = null) {
    logger.debug('[PerplexityService] Chat request received')

    try {
      // Build system prompt with context if available
      let systemPrompt = {
        role: 'system',
        content:
          'You are LinkedIntel AI, a sales intelligence assistant specializing in LinkedIn profile and company analysis. You help sales professionals with insights, research, and actionable intelligence.',
      }

      // Add context to system prompt if available
      if (context) {
        let contextInfo = '\n\nCurrent Context:\n'

        if (context.type === 'profile') {
          contextInfo += `You are currently viewing a LinkedIn profile:\n`
          contextInfo += `- Name: ${context.name || 'Unknown'}\n`
          contextInfo += `- Title: ${context.title || 'Unknown'}\n`
          contextInfo += `- Company: ${context.company || 'Unknown'}\n`
          if (context.location) {
            contextInfo += `- Location: ${context.location}\n`
          }
        } else if (context.type === 'company') {
          contextInfo += `You are currently viewing a company page:\n`
          contextInfo += `- Company: ${context.name || 'Unknown'}\n`
          if (context.industry) {
            contextInfo += `- Industry: ${context.industry}\n`
          }
          if (context.size) {
            contextInfo += `- Size: ${context.size}\n`
          }
          if (context.location) {
            contextInfo += `- Location: ${context.location}\n`
          }
        }

        // Add analysis data if available
        if (context.analysis) {
          contextInfo += `\nAvailable Analysis Data:\n`
          contextInfo += JSON.stringify(context.analysis, null, 2)
        }

        systemPrompt.content += contextInfo
        systemPrompt.content +=
          '\n\nUse this context to provide personalized, relevant answers. Reference specific details when helpful.'
      }

      // Prepare messages for Perplexity
      const apiMessages = [systemPrompt, ...messages]

      // Make request with optimized settings for chat
      const result = await this.makeRequest(apiMessages, {
        temperature: 0.7, // More conversational
        topP: 0.9,
        maxTokens: 2000, // Allow longer responses
        searchRecencyFilter: 'month', // Focus on recent info
        returnCitations: true,
      })

      return {
        success: true,
        content: result.content,
        usage: result.usage,
        citations: result.citations || [],
        searchResults: result.searchResults || [],
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      logger.error('[PerplexityService] Chat error:', error.message)
      throw error
    }
  }

  /**
   * Test API connectivity
   */
  async testConnection() {
    try {
      const testMessages = [
        {
          role: 'system',
          content:
            'Respond with valid JSON only. Do not use markdown code blocks.',
        },
        {
          role: 'user',
          content:
            'Return this JSON: {"status": "connected", "timestamp": "' +
            new Date().toISOString() +
            '"}',
        },
      ]

      const result = await this.makeRequest(testMessages, { maxTokens: 100 })

      // Clean the response using the same logic as analyzeCompany
      let cleanContent = result.content.trim()

      // Handle markdown code blocks
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '')
        const closingIndex = cleanContent.indexOf('```')
        if (closingIndex !== -1) {
          cleanContent = cleanContent.substring(0, closingIndex)
        }
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '')
        const closingIndex = cleanContent.indexOf('```')
        if (closingIndex !== -1) {
          cleanContent = cleanContent.substring(0, closingIndex)
        }
      }

      // Additional cleaning - remove any trailing explanation text after JSON
      const lastBraceIndex = cleanContent.lastIndexOf('}')
      if (lastBraceIndex !== -1 && lastBraceIndex < cleanContent.length - 1) {
        const afterBrace = cleanContent.substring(lastBraceIndex + 1).trim()
        if (afterBrace && !afterBrace.startsWith(',')) {
          cleanContent = cleanContent.substring(0, lastBraceIndex + 1)
        }
      }

      // Remove any remaining trailing notes
      cleanContent = cleanContent
        .replace(/\s*\*[^}]*$/, '')
        .replace(/\s*Note:[^}]*$/, '')
        .trim()

      const parsed = JSON.parse(cleanContent)

      return {
        success: true,
        status: 'connected',
        response: parsed,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Queue request for processing (simple rate limiting)
   */
  async queueRequest(requestFn) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ requestFn, resolve, reject })
      this.processQueue()
    })
  }

  /**
   * Process queued requests
   */
  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true

    while (this.requestQueue.length > 0) {
      const { requestFn, resolve, reject } = this.requestQueue.shift()

      try {
        // Add delay if we've had consecutive errors
        if (this.consecutiveErrors > 0) {
          const delay = Math.min(
            1000 * Math.pow(2, this.consecutiveErrors),
            10000
          )
          logger.debug(
            `Rate limiting: waiting ${delay}ms after ${this.consecutiveErrors} errors`
          )
          await new Promise((r) => setTimeout(r, delay))
        }

        const result = await requestFn()
        this.consecutiveErrors = 0
        resolve(result)
      } catch (error) {
        this.consecutiveErrors++
        this.lastErrorTime = Date.now()
        reject(error)
      }

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    this.isProcessingQueue = false
  }
}

module.exports = new PerplexityService()
