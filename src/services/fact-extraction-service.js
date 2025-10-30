/**
 * Fact Extraction Service - Use Chrome AI for structured data extraction
 * 
 * PURPOSE: Extract VERIFIABLE FACTS from LinkedIn pages, not generate content
 * 
 * This service uses Chrome AI's Prompt API to:
 * 1. Extract structured entities (conferences, awards, dates, numbers)
 * 2. Classify posts into factual categories (announcement, achievement, etc.)
 * 3. Detect signals (positive/negative, with evidence)
 * 4. Parse unstructured text into structured JSON
 * 
 * WHAT THIS IS NOT:
 * - NOT for generating outreach messages
 * - NOT for creative writing
 * - NOT for subjective analysis
 * 
 * All outputs must be verifiable against the source text.
 */

const factExtractionLogger = window.createLogger
  ? window.createLogger('FactExtraction')
  : console

class FactExtractionService {
  constructor() {
    this.initialized = false
    this.session = null
  }

  /**
   * Initialize Chrome AI session for fact extraction
   */
  async initialize() {
    if (this.initialized) return true

    try {
      if (!window.chromeAI) {
        throw new Error('Chrome AI service not available')
      }

      await window.chromeAI.initialize()

      if (!window.chromeAI.isAvailable('prompt')) {
        throw new Error('Prompt API not available')
      }

      // Create session with low temperature for factual extraction
      this.session = await window.chromeAI.createPromptSession({
        systemPrompt: this.buildSystemPrompt(),
        temperature: 0.1, // Low temperature = more deterministic, factual
      })

      this.initialized = true
      factExtractionLogger.info('Fact extraction service initialized')
      return true
    } catch (error) {
      factExtractionLogger.error('Failed to initialize:', error)
      return false
    }
  }

  /**
   * Build system prompt for fact extraction
   */
  buildSystemPrompt() {
    return `You are a factual data extraction assistant for sales intelligence.

CORE PRINCIPLE: Extract only VERIFIABLE FACTS from provided text. Never infer, assume, or generate content.

Your job is to:
1. Extract entities (names, dates, numbers, organizations)
2. Classify information into structured categories
3. Identify factual signals with direct evidence
4. Return structured JSON only

RULES:
- Only extract facts explicitly stated in the source text
- Include direct quotes as evidence
- Return null for missing data, never guess
- Use ISO date formats (YYYY-MM-DD)
- Include source context for verification
- No subjective analysis or interpretation

OUTPUT: Always valid JSON, no markdown, no explanations.`
  }

  /**
   * Extract factual signals from LinkedIn profile activity
   * @param {Array} posts - Array of post objects from LinkedIn scraper
   * @param {Object} profileData - Profile metadata
   * @returns {Promise<Object>} Structured factual signals
   */
  async extractProfileSignals(posts, profileData) {
    if (!this.initialized) {
      await this.initialize()
    }

    const prompt = this.buildProfileSignalsPrompt(posts, profileData)

    try {
      const response = await window.chromeAI.prompt(prompt)
      const signals = JSON.parse(response)

      factExtractionLogger.info('Extracted profile signals:', signals)
      return signals
    } catch (error) {
      factExtractionLogger.error('Error extracting profile signals:', error)
      return this.getEmptySignals()
    }
  }

  /**
   * Build prompt for profile signals extraction
   */
  buildProfileSignalsPrompt(posts, profileData) {
    const postsText = posts
      .map(
        (p, i) => `
POST ${i + 1} (${p.date}):
${p.text}
---`
      )
      .join('\n')

    return `Extract factual signals from this LinkedIn profile activity.

PROFILE: ${profileData.name} - ${profileData.headline}
COMPANY: ${profileData.company || 'Not specified'}

RECENT POSTS:
${postsText}

Extract and classify the following FACTS (include ONLY if explicitly mentioned):

{
  "conferences": [
    {
      "name": "Conference name (exact)",
      "date": "YYYY-MM-DD or YYYY-MM",
      "role": "speaker|attendee|sponsor",
      "topic": "Topic if mentioned",
      "evidence": "Direct quote showing this fact",
      "sourcePostIndex": 0
    }
  ],
  "speaking": [
    {
      "event": "Event name",
      "date": "YYYY-MM-DD",
      "topic": "Talk topic",
      "evidence": "Direct quote",
      "sourcePostIndex": 0
    }
  ],
  "awards": [
    {
      "name": "Award name",
      "date": "YYYY-MM-DD",
      "organization": "Issuing org",
      "category": "Award category if mentioned",
      "evidence": "Direct quote",
      "sourcePostIndex": 0
    }
  ],
  "publications": [
    {
      "title": "Article/post title",
      "platform": "Medium, blog, etc.",
      "date": "YYYY-MM-DD",
      "topic": "Main topic",
      "url": "URL if available",
      "evidence": "Direct quote",
      "sourcePostIndex": 0
    }
  ],
  "jobChanges": [
    {
      "previousRole": "Previous title",
      "newRole": "New title",
      "company": "Company name",
      "date": "YYYY-MM-DD",
      "evidence": "Direct quote",
      "sourcePostIndex": 0
    }
  ],
  "painPointsMentioned": [
    {
      "topic": "Problem area",
      "quote": "Exact quote mentioning pain point",
      "context": "Brief context",
      "date": "YYYY-MM-DD",
      "sourcePostIndex": 0
    }
  ],
  "technologyMentions": [
    {
      "technology": "Tool/platform name",
      "context": "How it was mentioned",
      "sentiment": "positive|negative|neutral",
      "evidence": "Direct quote",
      "sourcePostIndex": 0
    }
  ],
  "industryInvolvement": [
    {
      "organization": "Association/board name",
      "role": "Member, board member, etc.",
      "date": "YYYY-MM-DD or null",
      "evidence": "Direct quote",
      "sourcePostIndex": 0
    }
  ]
}

CRITICAL: 
- Include ONLY facts explicitly stated in posts
- Every item MUST have "evidence" field with direct quote
- Empty arrays if no relevant facts found
- No inference or assumptions`
  }

  /**
   * Extract company-level signals from scraped LinkedIn company page
   * @param {string} pageText - Full page text content
   * @param {string} companyName - Company name
   * @returns {Promise<Object>} Company signals
   */
  async extractCompanySignals(pageText, companyName) {
    if (!this.initialized) {
      await this.initialize()
    }

    const prompt = `Extract factual business signals from this company page.

COMPANY: ${companyName}

PAGE CONTENT:
${pageText.substring(0, 8000)}

Extract these FACTS (only if explicitly stated):

{
  "expansionSignals": [
    {
      "type": "office_opening|hiring|product_launch",
      "description": "Factual description",
      "date": "YYYY-MM-DD",
      "evidence": "Direct quote from page"
    }
  ],
  "contractionSignals": [
    {
      "type": "layoffs|office_closure|product_sunset",
      "description": "Factual description", 
      "date": "YYYY-MM-DD",
      "evidence": "Direct quote from page"
    }
  ],
  "hiringActivity": {
    "totalJobPostings": 0,
    "departments": ["dept1", "dept2"],
    "seniorityLevels": ["entry", "mid", "senior"],
    "evidence": "How this was determined"
  },
  "recentAnnouncements": [
    {
      "title": "Announcement title",
      "date": "YYYY-MM-DD",
      "category": "partnership|funding|product|award",
      "description": "Brief factual description",
      "evidence": "Direct quote"
    }
  ],
  "executiveChanges": [
    {
      "person": "Name",
      "role": "Title",
      "changeType": "joined|departed|promoted",
      "date": "YYYY-MM-DD",
      "evidence": "Direct quote"
    }
  ]
}

Return only valid JSON. Empty arrays if no facts found.`

    try {
      const response = await window.chromeAI.prompt(prompt)
      return JSON.parse(response)
    } catch (error) {
      factExtractionLogger.error('Error extracting company signals:', error)
      return this.getEmptyCompanySignals()
    }
  }

  /**
   * Classify a single post into factual categories
   * @param {Object} post - Post object
   * @returns {Promise<Object>} Classification result
   */
  async classifyPost(post) {
    if (!this.initialized) {
      await this.initialize()
    }

    const prompt = `Classify this LinkedIn post into factual categories.

POST (${post.date}):
${post.text}

Determine which factual categories this post represents:

{
  "categories": [
    "conference_attendance",
    "speaking_engagement", 
    "award_received",
    "job_change",
    "product_launch",
    "company_announcement",
    "thought_leadership",
    "achievement",
    "pain_point_mentioned",
    "technology_opinion"
  ],
  "primaryCategory": "most relevant category",
  "hasQuantifiableData": true,
  "dataPoints": {
    "dates": ["YYYY-MM-DD"],
    "numbers": [{"value": 100, "context": "what this number represents"}],
    "entities": [{"type": "person|company|event|tech", "name": "entity name"}]
  },
  "verificationSources": [
    "Type of source that could verify this (e.g., conference website, company blog)"
  ],
  "keyQuotes": [
    "Most important factual quotes from post"
  ]
}

Return only JSON.`

    try {
      const response = await window.chromeAI.prompt(prompt)
      return JSON.parse(response)
    } catch (error) {
      factExtractionLogger.error('Error classifying post:', error)
      return null
    }
  }

  /**
   * Extract buying signals with evidence
   * @param {Array} posts - Posts array
   * @param {Object} profileData - Profile metadata  
   * @returns {Promise<Object>} Buying signals
   */
  async extractBuyingSignals(posts, profileData) {
    if (!this.initialized) {
      await this.initialize()
    }

    const postsText = posts
      .map((p, i) => `POST ${i + 1} (${p.date}): ${p.text}\n---`)
      .join('\n')

    const prompt = `Identify factual buying signals from this activity.

PROFILE: ${profileData.name} at ${profileData.company}

POSTS:
${postsText}

Identify POSITIVE and NEGATIVE signals with direct evidence:

{
  "positiveSignals": [
    {
      "type": "expansion|hiring|funding|product_launch|partnership|award",
      "indicator": "Brief factual description",
      "evidence": "Direct quote from post",
      "date": "YYYY-MM-DD",
      "confidence": "high|medium|low",
      "verificationMethod": "How an SDR could verify this"
    }
  ],
  "negativeSignals": [
    {
      "type": "layoff|budget_cut|executive_departure|product_sunset|negative_press",
      "indicator": "Brief factual description",
      "evidence": "Direct quote from post",
      "date": "YYYY-MM-DD",
      "confidence": "high|medium|low",
      "verificationMethod": "How an SDR could verify this"
    }
  ],
  "neutralSignals": [
    {
      "type": "job_change|thought_leadership|conference_attendance",
      "indicator": "Brief description",
      "evidence": "Direct quote",
      "date": "YYYY-MM-DD",
      "relevance": "Why this might matter for sales context"
    }
  ]
}

RULES:
- Only include signals with direct textual evidence
- confidence=high only if explicitly stated with numbers/dates
- verificationMethod must be realistic (e.g., "Check company careers page", "Search Crunchbase")
- Empty arrays if no signals found

Return JSON only.`

    try {
      const response = await window.chromeAI.prompt(prompt)
      return JSON.parse(response)
    } catch (error) {
      factExtractionLogger.error('Error extracting buying signals:', error)
      return {
        positiveSignals: [],
        negativeSignals: [],
        neutralSignals: [],
      }
    }
  }

  /**
   * Extract timeline of factual events
   * @param {Array} posts - Posts array
   * @param {Object} profileData - Profile data
   * @returns {Promise<Array>} Timeline events
   */
  async extractTimeline(posts, profileData) {
    if (!this.initialized) {
      await this.initialize()
    }

    const postsText = posts
      .map((p, i) => `POST ${i + 1} (${p.date}): ${p.text}`)
      .join('\n\n')

    const prompt = `Create a timeline of factual events from this activity.

PROFILE: ${profileData.name}

POSTS:
${postsText}

Extract chronological events:

[
  {
    "date": "YYYY-MM-DD",
    "dateConfidence": "exact|month|quarter|year",
    "eventType": "conference|speaking|award|job_change|publication|announcement",
    "title": "Brief event title",
    "description": "Factual description (1 sentence)",
    "evidence": "Direct quote from source",
    "verificationUrl": "URL if mentioned, or type of source to check",
    "importance": "high|medium|low",
    "importanceReason": "Why this matters for SDR context"
  }
]

Sort by date (most recent first).
Only include events with clear dates.
Return JSON array.`

    try {
      const response = await window.chromeAI.prompt(prompt)
      return JSON.parse(response)
    } catch (error) {
      factExtractionLogger.error('Error extracting timeline:', error)
      return []
    }
  }

  /**
   * Extract specific data points for SDR research
   * @param {string} text - Source text
   * @param {Array} dataPoints - List of data points to extract
   * @returns {Promise<Object>} Extracted data
   */
  async extractDataPoints(text, dataPoints) {
    if (!this.initialized) {
      await this.initialize()
    }

    const dataPointsList = dataPoints.join('\n- ')

    const prompt = `Extract these specific data points from the text.

TEXT:
${text.substring(0, 5000)}

EXTRACT THESE DATA POINTS:
- ${dataPointsList}

For each data point:
{
  "dataPointName": {
    "value": "extracted value or null",
    "evidence": "direct quote showing where this came from",
    "confidence": "high|medium|low|none",
    "notes": "any caveats or additional context"
  }
}

Return only JSON. Set value=null if not found.`

    try {
      const response = await window.chromeAI.prompt(prompt)
      return JSON.parse(response)
    } catch (error) {
      factExtractionLogger.error('Error extracting data points:', error)
      return {}
    }
  }

  /**
   * Get empty signals structure
   */
  getEmptySignals() {
    return {
      conferences: [],
      speaking: [],
      awards: [],
      publications: [],
      jobChanges: [],
      painPointsMentioned: [],
      technologyMentions: [],
      industryInvolvement: [],
    }
  }

  /**
   * Get empty company signals structure
   */
  getEmptyCompanySignals() {
    return {
      expansionSignals: [],
      contractionSignals: [],
      hiringActivity: {
        totalJobPostings: 0,
        departments: [],
        seniorityLevels: [],
        evidence: 'No data available',
      },
      recentAnnouncements: [],
      executiveChanges: [],
    }
  }

  /**
   * Destroy session
   */
  destroy() {
    if (this.session && typeof this.session.destroy === 'function') {
      try {
        this.session.destroy()
      } catch (error) {
        factExtractionLogger.warn('Error destroying session:', error)
      }
    }
    this.session = null
    this.initialized = false
  }
}

// Create singleton
const factExtractionService = new FactExtractionService()

// Export
if (typeof window !== 'undefined') {
  window.factExtractionService = factExtractionService
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = factExtractionService
}

