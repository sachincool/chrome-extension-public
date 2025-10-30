/**
 * Fact Enrichment Route
 * 
 * PURPOSE: Enrich factual signals extracted by Chrome AI with external data
 * 
 * Flow:
 * 1. Receive facts extracted from LinkedIn (conferences, awards, job changes, etc.)
 * 2. Enrich with external verification data (Crunchbase, news, company data)
 * 3. Add context (company budget status, hiring trends, tech stack)
 * 4. Return enriched intelligence with sources
 * 
 * This endpoint does NOT generate content - it only adds verifiable context to extracted facts.
 */

const express = require('express')
const { body, validationResult } = require('express-validator')
const { Logger } = require('../utils/logger')
const perplexityService = require('../services/perplexityService')
const sumbleService = require('../services/sumbleService')
const cacheService = require('../services/cacheService')

const logger = new Logger('FactEnrichment')
const router = express.Router()

// Use the orchestrator from perplexity service (it's already initialized)
const orchestrator = perplexityService.microPromptOrchestrator

/**
 * POST /api/enrich/profile-signals
 * Enrich profile-level factual signals with external data
 */
router.post(
  '/profile-signals',
  [
    body('profileUrl').isString().notEmpty(),
    body('profileName').isString().notEmpty(),
    body('company').optional().isString(),
    body('signals').isObject(),
    body('buyingSignals').optional().isObject(),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { profileUrl, profileName, company, signals, buyingSignals } = req.body

    try {
      logger.info(
        `Enriching profile signals for: ${profileName} at ${company || 'Unknown'}`
      )

      // Check cache first
      const cacheKey = `profile_enrichment:${profileUrl}`
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        logger.info('Returning cached enrichment')
        return res.json({ enriched: cached, fromCache: true })
      }

      // Enrich each signal category
      const enriched = {
        profileUrl,
        profileName,
        company,
        enrichedAt: new Date().toISOString(),
        conferences: await enrichConferences(signals.conferences || []),
        speaking: await enrichSpeaking(signals.speaking || []),
        awards: await enrichAwards(signals.awards || []),
        jobChanges: await enrichJobChanges(signals.jobChanges || []),
        painPoints: await enrichPainPoints(signals.painPointsMentioned || []),
        technologyMentions: signals.technologyMentions || [],
        companyContext: company
          ? await enrichCompanyContext(company)
          : null,
        industryTrends: company
          ? await enrichIndustryTrends(company)
          : null,
      }

      // Add buying signal context
      if (buyingSignals) {
        enriched.buyingSignalContext = await enrichBuyingSignals(
          buyingSignals,
          company
        )
      }

      // Cache for 24 hours
      await cacheService.set(cacheKey, enriched, 86400)

      logger.info('Profile signals enriched successfully')
      res.json({ enriched, fromCache: false })
    } catch (error) {
      logger.error('Error enriching profile signals:', error)
      res.status(500).json({
        error: 'Failed to enrich profile signals',
        message: error.message,
      })
    }
  }
)

/**
 * POST /api/enrich/company-signals
 * Enrich company-level signals with external data
 */
router.post(
  '/company-signals',
  [
    body('companyName').isString().notEmpty(),
    body('signals').isObject(),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { companyName, signals } = req.body

    try {
      logger.info(`Enriching company signals for: ${companyName}`)

      // Check cache
      const cacheKey = `company_enrichment:${companyName}`
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        return res.json({ enriched: cached, fromCache: true })
      }

      // Enrich company signals
      const enriched = {
        companyName,
        enrichedAt: new Date().toISOString(),
        expansionSignals: await enrichExpansionSignals(
          signals.expansionSignals || []
        ),
        contractionSignals: await enrichContractionSignals(
          signals.contractionSignals || []
        ),
        hiringActivity: await enrichHiringActivity(
          companyName,
          signals.hiringActivity
        ),
        announcements: signals.recentAnnouncements || [],
        executiveChanges: await enrichExecutiveChanges(
          signals.executiveChanges || []
        ),
        financialContext: await getFinancialContext(companyName),
        budgetSignals: await getBudgetSignals(companyName),
      }

      // Cache for 24 hours
      await cacheService.set(cacheKey, enriched, 86400)

      logger.info('Company signals enriched successfully')
      res.json({ enriched, fromCache: false })
    } catch (error) {
      logger.error('Error enriching company signals:', error)
      res.status(500).json({
        error: 'Failed to enrich company signals',
        message: error.message,
      })
    }
  }
)

/**
 * POST /api/enrich/verify-fact
 * Verify a single fact against external sources
 */
router.post(
  '/verify-fact',
  [
    body('fact').isString().notEmpty(),
    body('entity').isString().notEmpty(), // Person or company name
    body('factType')
      .isString()
      .isIn([
        'conference',
        'award',
        'job_change',
        'funding',
        'layoff',
        'product_launch',
      ]),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { fact, entity, factType } = req.body

    try {
      logger.info(`Verifying fact: ${factType} for ${entity}`)

      const verification = await verifyFact(fact, entity, factType)

      res.json({ verification })
    } catch (error) {
      logger.error('Error verifying fact:', error)
      res.status(500).json({
        error: 'Failed to verify fact',
        message: error.message,
      })
    }
  }
)

// ============================================================================
// ENRICHMENT FUNCTIONS
// ============================================================================

/**
 * Enrich conference attendance with event data
 */
async function enrichConferences(conferences) {
  const enriched = []

  for (const conf of conferences) {
    try {
      // Search for conference details using Perplexity directly
      const messages = [
        {
          role: 'system',
          content:
            'You are a conference database assistant. Return only valid JSON.',
        },
        {
          role: 'user',
          content: `Find details about this conference: "${conf.name}"
          
Search for:
- Official website URL
- Date (if not already known: ${conf.date})
- Location
- Size/attendance estimate
- Key topics/tracks
- Notable speakers

Return JSON:
{
  "verified": true/false,
  "officialUrl": "url or null",
  "fullName": "full conference name",
  "dates": "YYYY-MM-DD to YYYY-MM-DD",
  "location": "city, country",
  "estimatedAttendance": 500,
  "topics": ["topic1", "topic2"],
  "notableSpeakers": ["name1", "name2"],
  "industryRelevance": "Why this conference matters for sales context"
}`,
        },
      ]

      const details = await perplexityService.makeRequest(messages, {
        temperature: 0.1,
        maxTokens: 1000,
        webSearchOptions: { search_context_size: 'medium' },
      })

      const parsed = JSON.parse(details.content)
      enriched.push({
        ...conf,
        enrichment: parsed,
      })
    } catch (error) {
      logger.warn(`Failed to enrich conference: ${conf.name}`, error)
      enriched.push(conf)
    }
  }

  return enriched
}

/**
 * Enrich speaking engagements
 */
async function enrichSpeaking(speaking) {
  // Similar to conferences, verify event and add context
  return speaking.map((s) => ({
    ...s,
    verificationSources: [
      `Search "${s.event}" speaker list`,
      `Check LinkedIn posts with #${s.event.replace(/\s+/g, '')}`,
    ],
  }))
}

/**
 * Enrich awards with issuing organization data
 */
async function enrichAwards(awards) {
  const enriched = []

  for (const award of awards) {
    try {
      const messages = [
        {
          role: 'system',
          content:
            'You are an awards database assistant. Return only valid JSON.',
        },
        {
          role: 'user',
          content: `Find details about this award: "${award.name}" by "${award.organization}"
          
Search for:
- Issuing organization official URL
- Award prestige (industry recognition level)
- Selection criteria
- Past winners (notable names)
- How competitive is this award?

Return JSON:
{
  "verified": true/false,
  "organizationUrl": "url or null",
  "prestigeLevel": "high|medium|low",
  "selectionCriteria": "brief description",
  "notablePastWinners": ["name1", "name2"],
  "competitiveness": "Description of how selective this award is",
  "salesRelevance": "Why this matters for sales context"
}`,
        },
      ]

      const details = await perplexityService.makeRequest(messages, {
        temperature: 0.1,
        maxTokens: 1000,
        webSearchOptions: { search_context_size: 'medium' },
      })

      const parsed = JSON.parse(details.content)
      enriched.push({
        ...award,
        enrichment: parsed,
      })
    } catch (error) {
      logger.warn(`Failed to enrich award: ${award.name}`, error)
      enriched.push(award)
    }
  }

  return enriched
}

/**
 * Enrich job changes with company context
 */
async function enrichJobChanges(jobChanges) {
  const enriched = []

  for (const change of jobChanges) {
    try {
      // Get company context for new employer
      const companyData = await sumbleService.getOrganizationInfo(change.company)

      enriched.push({
        ...change,
        companyContext: companyData
          ? {
              industry: companyData.industry,
              size: companyData.employeeCount,
              funding: companyData.funding,
              techStack: companyData.technologies?.slice(0, 5),
            }
          : null,
      })
    } catch (error) {
      logger.warn(`Failed to enrich job change for: ${change.company}`, error)
      enriched.push(change)
    }
  }

  return enriched
}

/**
 * Enrich pain points with industry context
 */
async function enrichPainPoints(painPoints) {
  // Group pain points by topic
  const topics = [...new Set(painPoints.map((p) => p.topic))]

  const enriched = []

  for (const point of painPoints) {
    enriched.push({
      ...point,
      industryTrend: `Common challenge in ${point.topic}`,
      potentialSolutions: [], // Could be populated with relevant product categories
    })
  }

  return enriched
}

/**
 * Enrich company context with external data
 */
async function enrichCompanyContext(companyName) {
  try {
    // Get Sumble data
    const sumbleData = await sumbleService.getOrganizationInfo(companyName)

    // Get recent news
    const newsData = await orchestrator.executeMicroPrompt(
      'recentNews',
      companyName
    )

    return {
      industry: sumbleData?.industry,
      employeeCount: sumbleData?.employeeCount,
      technologies: sumbleData?.technologies?.slice(0, 10),
      recentNews: JSON.parse(newsData.content).news || [],
      dataSource: 'Sumble + Perplexity',
    }
  } catch (error) {
    logger.warn(`Failed to enrich company context for: ${companyName}`, error)
    return null
  }
}

/**
 * Enrich industry trends
 */
async function enrichIndustryTrends(companyName) {
  try {
    const trendsData = await orchestrator.executeMicroPrompt(
      'industryContext',
      companyName
    )
    return JSON.parse(trendsData.content)
  } catch (error) {
    logger.warn(`Failed to get industry trends for: ${companyName}`, error)
    return null
  }
}

/**
 * Enrich buying signals with external context
 */
async function enrichBuyingSignals(buyingSignals, company) {
  if (!company) return null

  try {
    // Get company growth indicators
    const growthData = await orchestrator.executeMicroPrompt(
      'growthEvents',
      company
    )

    const parsed = JSON.parse(growthData.content)

    return {
      externalGrowthSignals: parsed.growthEvents || [],
      hiringTrends: parsed.hiringActivity || 'Unknown',
      fundingStatus: parsed.lastFunding || null,
      dataSource: 'Perplexity',
    }
  } catch (error) {
    logger.warn(`Failed to enrich buying signals for: ${company}`, error)
    return null
  }
}

/**
 * Enrich expansion signals
 */
async function enrichExpansionSignals(signals) {
  return signals.map((signal) => ({
    ...signal,
    industryContext: `Expansion signals indicate growth and potential budget availability`,
    verificationSteps: [
      'Check company careers page for open positions',
      'Search press releases for office opening announcements',
      'Look for product launch news on TechCrunch, Business Wire',
    ],
  }))
}

/**
 * Enrich contraction signals
 */
async function enrichContractionSignals(signals) {
  return signals.map((signal) => ({
    ...signal,
    industryContext: `Contraction signals may indicate budget constraints or strategic shifts`,
    verificationSteps: [
      'Check WARN notices for layoff confirmations (US)',
      'Search LinkedIn for former employee posts',
      'Look for official company statements in press',
    ],
  }))
}

/**
 * Enrich hiring activity
 */
async function enrichHiringActivity(companyName, hiringActivity) {
  if (!hiringActivity || hiringActivity.totalJobPostings === 0) {
    return hiringActivity
  }

  // Compare to industry average (could be enhanced with real data)
  return {
    ...hiringActivity,
    trend: hiringActivity.totalJobPostings > 20 ? 'aggressive' : 'moderate',
    interpretation:
      hiringActivity.totalJobPostings > 20
        ? 'Strong hiring activity indicates growth and budget availability'
        : 'Moderate hiring activity',
    verificationSteps: [
      `Check ${companyName} Jobs tab on LinkedIn`,
      `Search "${companyName} careers" on Google`,
      `Check job boards (Indeed, Glassdoor) for ${companyName}`,
    ],
  }
}

/**
 * Enrich executive changes
 */
async function enrichExecutiveChanges(changes) {
  return changes.map((change) => ({
    ...change,
    salesImplication:
      change.changeType === 'joined'
        ? 'New leadership often brings budget for new initiatives'
        : change.changeType === 'departed'
          ? 'Leadership changes may cause project delays or re-evaluations'
          : 'Promotions indicate company stability',
  }))
}

/**
 * Get financial context for company
 */
async function getFinancialContext(companyName) {
  try {
    const stockData = await orchestrator.executeMicroPrompt(
      'stockData',
      companyName
    )
    const parsed = JSON.parse(stockData.content)

    return {
      isPublic: parsed.isPublic,
      financialHealth: parsed.isPublic
        ? parsed.priceTrajectory?.direction === 'up'
          ? 'positive'
          : 'neutral'
        : 'unknown',
      budgetIndicator: parsed.isPublic
        ? parsed.marketCap && parsed.marketCap.includes('B')
          ? 'large'
          : 'medium'
        : parsed.lastFunding
          ? 'funded'
          : 'unknown',
    }
  } catch (error) {
    logger.warn(`Failed to get financial context for: ${companyName}`, error)
    return null
  }
}

/**
 * Get budget signals (positive/negative indicators)
 */
async function getBudgetSignals(companyName) {
  try {
    const challengesData = await orchestrator.executeMicroPrompt(
      'companyChallenges',
      companyName
    )
    const parsed = JSON.parse(challengesData.content)

    const signals = []

    // Analyze for budget-related challenges
    if (parsed.challenges?.length > 0) {
      parsed.challenges.forEach((challenge) => {
        const lowerChallenge = challenge.title?.toLowerCase() || ''
        if (
          lowerChallenge.includes('layoff') ||
          lowerChallenge.includes('cost') ||
          lowerChallenge.includes('budget')
        ) {
          signals.push({
            type: 'negative',
            signal: challenge.title,
            source: challenge.source,
          })
        }
      })
    }

    return signals
  } catch (error) {
    logger.warn(`Failed to get budget signals for: ${companyName}`, error)
    return []
  }
}

/**
 * Verify a single fact against external sources
 */
async function verifyFact(fact, entity, factType) {
  const verificationPrompts = {
    conference: `Verify this claim: "${entity} attended/spoke at ${fact}"
    
Search for:
- Conference speaker list or attendee list
- LinkedIn posts from the conference hashtag
- Official conference website

Return JSON:
{
  "verified": true/false,
  "confidence": "high|medium|low",
  "sources": ["url1", "url2"],
  "evidence": "What evidence was found",
  "notes": "Any caveats or additional context"
}`,

    award: `Verify this claim: "${entity} received ${fact}"
    
Search for:
- Official announcement from issuing organization
- Press releases
- LinkedIn post confirmation

Return JSON:
{
  "verified": true/false,
  "confidence": "high|medium|low",
  "sources": ["url1", "url2"],
  "evidence": "What evidence was found",
  "notes": "Any caveats"
}`,

    job_change: `Verify this claim: "${entity} joined ${fact}"
    
Search for:
- LinkedIn profile current position
- Company announcement or blog post
- Press releases about new hire

Return JSON:
{
  "verified": true/false,
  "confidence": "high|medium|low",
  "sources": ["url1", "url2"],
  "evidence": "What evidence was found",
  "notes": "Any caveats"
}`,

    funding: `Verify this claim: "${entity} raised ${fact}"
    
Search for:
- Crunchbase entry
- Press release on Business Wire, PR Newswire
- TechCrunch or similar news coverage

Return JSON:
{
  "verified": true/false,
  "confidence": "high|medium|low",
  "sources": ["url1", "url2"],
  "evidence": "What evidence was found",
  "notes": "Any caveats"
}`,

    layoff: `Verify this claim: "${entity} laid off ${fact}"
    
Search for:
- News articles from Bloomberg, Reuters, TechCrunch
- WARN notices (if US-based)
- LinkedIn posts from affected employees
- Official company statement

Return JSON:
{
  "verified": true/false,
  "confidence": "high|medium|low",
  "sources": ["url1", "url2"],
  "evidence": "What evidence was found",
  "notes": "Any caveats"
}`,

    product_launch: `Verify this claim: "${entity} launched ${fact}"
    
Search for:
- Company blog or press page
- Product Hunt
- TechCrunch, Engadget, The Verge
- Official social media announcements

Return JSON:
{
  "verified": true/false,
  "confidence": "high|medium|low",
  "sources": ["url1", "url2"],
  "evidence": "What evidence was found",
  "notes": "Any caveats"
}`,
  }

  const prompt = verificationPrompts[factType]
  if (!prompt) {
    return {
      verified: false,
      confidence: 'none',
      sources: [],
      evidence: 'Unknown fact type',
      notes: 'Cannot verify this type of fact',
    }
  }

  try {
    // Use Perplexity service directly for fact verification
    const messages = [
      {
        role: 'system',
        content: 'You are a fact-checking assistant. Return only valid JSON.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ]

    const result = await perplexityService.makeRequest(messages, {
      temperature: 0.1,
      maxTokens: 1000,
      webSearchOptions: { search_context_size: 'medium' },
    })

    return JSON.parse(result.content)
  } catch (error) {
    logger.error('Error verifying fact:', error)
    return {
      verified: false,
      confidence: 'none',
      sources: [],
      evidence: 'Error during verification',
      notes: error.message,
    }
  }
}

module.exports = router

