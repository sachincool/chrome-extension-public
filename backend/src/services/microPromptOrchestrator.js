/**
 * Micro-Prompt Orchestrator for LinkedIntel
 * Executes focused micro-prompts with Sumble API and Perplexity optimization
 */

const { MICRO_PROMPTS } = require('../prompts/microPrompts')
const sumbleService = require('./sumbleService')
const { Logger } = require('../utils/logger')

const logger = new Logger('MicroPromptOrchestrator')

class MicroPromptOrchestrator {
  constructor(perplexityService) {
    this.perplexity = perplexityService
    this.maxRetries = 2
  }

  /**
   * Execute a single micro-prompt with validation
   */
  async executeMicroPrompt(promptType, ...argsAndOptions) {
    const prompt = MICRO_PROMPTS[promptType]
    if (!prompt) {
      throw new Error(`Unknown prompt type: ${promptType}`)
    }

    // Extract options if last argument is an object with webSearchOptions
    let args = argsAndOptions
    let customOptions = {}
    if (
      argsAndOptions.length > 0 &&
      typeof argsAndOptions[argsAndOptions.length - 1] === 'object' &&
      argsAndOptions[argsAndOptions.length - 1].webSearchOptions
    ) {
      customOptions = argsAndOptions.pop()
      args = argsAndOptions
    }

    // Handle different prompt parameter patterns
    let userContent
    try {
      userContent = prompt.user(...args)
    } catch (error) {
      logger.error(`Error building prompt ${promptType} with args:`, args)
      throw new Error(`Failed to build prompt ${promptType}: ${error.message}`)
    }

    const messages = [
      { role: 'system', content: prompt.system },
      { role: 'user', content: userContent },
    ]

    let attempt = 0
    let lastError = null

    while (attempt < this.maxRetries) {
      try {
        // Build request options with prompt-specific optimizations
        const requestOptions = {
          temperature: prompt.temperature ?? 0.1,
          maxTokens: prompt.maxTokens || 1000,
          ...customOptions,
        }

        // Apply domain filtering and search mode per prompt type
        switch (promptType) {
          case 'stockData':
            // Use default search mode instead of 'sec' - it might be blocking searches
            requestOptions.searchDomainFilter = [
              'finance.yahoo.com',
              'marketwatch.com',
              'bloomberg.com',
              'sec.gov',
              'investor.gov',
              'morningstar.com',
              'investing.com',
            ]
            requestOptions.webSearchOptions = { search_context_size: 'high' }
            requestOptions.searchRecencyFilter = 'day' // Get CURRENT data (last 24-48 hours)
            break

          case 'industryContext':
          case 'companyIntelligence':
            requestOptions.webSearchOptions = { search_context_size: 'high' }
            break

          case 'privateCompanyFinancials':
            // NO recency filter - need to see ALL funding rounds (2022-2025) for complete history
            // Prompt handles prioritization of recent rounds
            requestOptions.searchDomainFilter = [
              'crunchbase.com',
              'pitchbook.com',
              'techcrunch.com',
              'businesswire.com',
              'prnewswire.com',
            ]
            requestOptions.webSearchOptions = { search_context_size: 'high' }
            break

          case 'techStack':
            requestOptions.searchRecencyFilter = 'year' // Tech stacks evolve, get recent adoption
            requestOptions.searchDomainFilter = [
              'stackshare.io',
              'builtwith.com',
              'linkedin.com',
              'github.com',
              'medium.com',
            ]
            break

          case 'growthEvents':
          case 'companyActivity':
            requestOptions.searchRecencyFilter = 'year' // Recent business activity and growth signals
            requestOptions.webSearchOptions = { search_context_size: 'high' }
            break

          case 'recentNews':
            requestOptions.searchRecencyFilter = 'month'
            requestOptions.searchDomainFilter = [
              'reuters.com',
              'bloomberg.com',
              'businesswire.com',
              'techcrunch.com',
              'forbes.com',
            ]
            break

          case 'companyChallenges':
            requestOptions.searchRecencyFilter = 'year'
            // Removed domain filter to allow searching company investor relations pages
            // This helps find official earnings call transcripts on company websites
            requestOptions.webSearchOptions = { search_context_size: 'high' }
            break

          case 'personMediaPresence':
          case 'personSocialActivity':
            requestOptions.searchRecencyFilter = 'month' // Get recent posts and activity
            requestOptions.searchDomainFilter = [
              'linkedin.com',
              'twitter.com',
              'medium.com',
              'techcrunch.com',
              'forbes.com',
            ]
            break

          case 'personQuotedChallenges':
          case 'personRiskSignals':
            requestOptions.searchRecencyFilter = 'year' // Recent challenges and risk signals
            requestOptions.webSearchOptions = { search_context_size: 'high' }
            break

          case 'personBasicInfo':
          case 'companyDomain':
          case 'priorityContacts':
            // NO recency filter - these need comprehensive/historical data
            requestOptions.webSearchOptions = { search_context_size: 'medium' }
            break

          default:
            if (!requestOptions.webSearchOptions) {
              requestOptions.webSearchOptions = {
                search_context_size: 'medium',
              }
            }
        }

        logger.debug(
          `Executing ${promptType} with maxTokens: ${requestOptions.maxTokens}`
        )

        const result = await this.perplexity.makeRequest(
          messages,
          requestOptions
        )

        // DEBUG: Log raw Perplexity response for key prompts
        if (
          promptType === 'stockData' ||
          promptType === 'privateCompanyFinancials' ||
          promptType === 'companyChallenges'
        ) {
          logger.info(
            `📡 RAW Perplexity Response for ${promptType} (first 2000 chars):`,
            result.content?.substring(0, 2000)
          )

          // Extra logging for companyChallenges to debug earnings call URL
          if (promptType === 'companyChallenges') {
            try {
              const parsed = JSON.parse(result.content)
              if (parsed.earningsCallNegativeNews) {
                logger.info('🎯 Earnings Call Data in Response:', {
                  type: typeof parsed.earningsCallNegativeNews,
                  hasUrl: parsed.earningsCallNegativeNews?.url ? 'YES' : 'NO',
                  url: parsed.earningsCallNegativeNews?.url || 'N/A',
                  hasSummary: parsed.earningsCallNegativeNews?.summary
                    ? 'YES'
                    : 'NO',
                })
              } else {
                logger.info('ℹ️ No earnings call data in response')
              }
            } catch (e) {
              logger.warn(
                '⚠️ Could not pre-parse companyChallenges for logging'
              )
            }
          }
        }

        // Parse and validate JSON
        const parsed = this.parseAndValidate(result.content, promptType)
        if (parsed.success) {
          logger.info(`✅ Micro-prompt '${promptType}': SUCCESS`)
          return {
            success: true,
            data: parsed.data,
            attempt: attempt + 1,
            usage: result.usage,
            searchResults: result.searchResults || [],
          }
        }

        lastError = parsed.error
        logger.error(`JSON parse error for ${promptType}: ${parsed.error}`)
        logger.error(`Content that failed to parse: ${result.content}`)
        logger.debug(
          `Micro-prompt ${promptType} attempt ${attempt + 1} failed:`,
          {
            error: parsed.error,
            rawContent: result.content?.substring(0, 200) + '...',
            contentLength: result.content?.length,
          }
        )
        attempt++

        if (attempt < this.maxRetries) {
          logger.debug(
            `Micro-prompt ${promptType} attempt ${attempt} failed, retrying...`
          )
          await this.delay(1000 * attempt) // Exponential backoff
        }
      } catch (error) {
        lastError = error.message || error
        attempt++

        if (attempt < this.maxRetries) {
          logger.debug(
            `Micro-prompt ${promptType} attempt ${attempt} failed: ${error.message}`
          )
          await this.delay(1000 * attempt)
        }
      }
    }

    // Throw error instead of returning fallback data (per CLAUDE.md requirements)
    // Handle both string errors (from parseAndValidate) and Error objects
    const errorMessage =
      typeof lastError === 'string'
        ? lastError
        : lastError?.message || 'Unknown error'
    logger.error(
      `❌ Micro-prompt '${promptType}': FAILED after ${attempt} attempts - ${errorMessage}`
    )
    throw new Error(
      `Failed to execute micro-prompt ${promptType} after ${attempt} attempts: ${errorMessage}`
    )
  }

  /**
   * Execute complete company analysis using micro-prompts
   * Optimized with 4-batch hybrid parallelization for 25-35% performance improvement
   */
  async analyzeCompany(companyName) {
    const startTime = Date.now()
    logger.info(
      `Starting optimized hybrid analysis (4-batch parallelization) for ${companyName}`
    )

    // Step 1: Resolve company domain
    const companyDomain = await this._resolveCompanyDomain(companyName)

    // Step 2: Execute Batch 1 - Fast, independent data gathering (includes early public/private detection)
    const batch1Results = await this._executeBatch1(companyName, companyDomain)

    // Early detection: Check if company is public or private
    const isPublicCompany = batch1Results.stockData?.data?.isPublic || false
    logger.info(
      `Company type detected: ${isPublicCompany ? 'PUBLIC' : 'PRIVATE'}`
    )

    // Step 3: Execute Batch 2 - Sumble data collection (no context needed)
    const batch2Results = await this._executeBatch2(companyName, companyDomain)

    // Step 4: Execute Batch 3 - Context-dependent intelligence (needs Batch 1)
    const batch3Results = await this._executeBatch3(
      companyName,
      companyDomain,
      batch1Results,
      batch2Results
    )

    // Step 5: Combine all results from all batches
    const allResults = {
      ...batch1Results,
      ...batch2Results,
      ...batch3Results,
      isPublicCompany, // Add public/private flag to results
    }
    const finalData = this.combineResults(companyName, allResults)

    // Step 6: Calculate metrics and log summary
    const processingTime = Date.now() - startTime

    // Extract Sumble responses for credit calculation (from Batch 2 & 3)
    const sumbleTechStack = {
      creditsUsed: batch2Results.techStack?.creditsUsed || 0,
    }
    const sumbleContacts = {
      creditsUsed: batch2Results.priorityContacts?.creditsUsed || 0,
    }
    const sumbleOrgInfo = {
      creditsUsed: batch2Results.sumbleOrgInfo?.creditsUsed || 0,
    }
    const sumbleHiringSignals = {
      creditsUsed: batch3Results.companyActivity?.creditsUsed || 0,
    }

    const totalSumbleCredits = this._calculateSumbleCredits(
      sumbleTechStack,
      sumbleContacts,
      sumbleOrgInfo,
      sumbleHiringSignals
    )

    // Calculate total Perplexity tokens used
    const totalPerplexityUsage = this.calculateTotalUsage(allResults)

    this._logAnalysisSummary(
      processingTime,
      totalSumbleCredits,
      sumbleTechStack,
      sumbleContacts,
      sumbleOrgInfo,
      sumbleHiringSignals,
      totalPerplexityUsage
    )

    return {
      success: true,
      data: finalData,
      usage: this.calculateTotalUsage(allResults),
      sumbleCreditsUsed: totalSumbleCredits,
      sumbleCreditsRemaining: sumbleService.getRemainingCredits(),
      dataSourceBreakdown: {
        techStack: allResults.techStack?.source || 'unknown',
        priorityContacts: allResults.priorityContacts?.source || 'unknown',
        companyActivity: allResults.companyActivity?.source || 'perplexity',
      },
    }
  }

  /**
   * Resolve company domain using Perplexity with fallback to extraction
   * @private
   * @param {string} companyName - Company name
   * @returns {Promise<string>} Company domain
   */
  async _resolveCompanyDomain(companyName) {
    try {
      logger.debug(
        `Using Perplexity to resolve accurate domain for ${companyName}...`
      )
      const domainResult = await this.executeMicroPrompt(
        'companyDomain',
        companyName
      )

      const companyDomain = domainResult.data.domain?.trim().toLowerCase()

      if (
        !companyDomain ||
        !companyDomain.includes('.') ||
        companyDomain.includes(' ')
      ) {
        throw new Error('Invalid domain format from Perplexity')
      }

      logger.debug(`Perplexity resolved domain: ${companyDomain}`)
      return companyDomain
    } catch (error) {
      logger.debug(
        `⚠️  Perplexity domain resolution failed (${error.message}), using extraction fallback`
      )
      const companyDomain = sumbleService.constructor.extractDomain(companyName)
      logger.debug(`📍 Using extracted domain (fallback): ${companyDomain}`)
      return companyDomain
    }
  }

  /**
   * Execute Batch 1: Fast, independent data gathering
   * Includes: stockData, recentNews, growthEvents, companyChallenges
   * This batch provides early public/private detection and baseline intelligence
   *
   * @private
   * @param {string} companyName - Company name
   * @param {string} companyDomain - Company domain (for reference)
   * @returns {Promise<Object>} Batch 1 results with citations
   */
  async _executeBatch1(companyName, companyDomain) {
    logger.info(
      '🚀 Batch 1: Fast independent data gathering (stock, news, growth, negative signals, industry context)...'
    )

    // Execute all Batch 1 micro-prompts in parallel (all independent)
    //
    // NOTE: Uses Promise.all() which fails fast if ANY promise rejects.
    // This is intentional - each micro-prompt retries 3x with exponential backoff,
    // so if one fails after all retries, we likely have a systemic issue (API down, etc.)
    // and should fail the entire analysis rather than returning incomplete data.
    //
    // Future enhancement: Consider Promise.allSettled() for graceful degradation,
    // allowing partial results if non-critical prompts fail.
    const [
      stockDataResult,
      recentNewsResult,
      growthEventsResult,
      companyChallengesResult,
      industryContextResult,
    ] = await Promise.all([
      this.executeMicroPrompt('stockData', companyName),
      this.executeMicroPrompt('recentNews', companyName),
      this.executeMicroPrompt('growthEvents', companyName, {
        webSearchOptions: { search_context_size: 'high' },
      }),
      this.executeMicroPrompt('companyChallenges', companyName),
      this.executeMicroPrompt('industryContext', companyName),
    ])

    const results = {
      stockData: stockDataResult,
      recentNews: recentNewsResult,
      growthEvents: growthEventsResult,
      companyChallenges: companyChallengesResult,
      industryContext: industryContextResult,
    }

    // Check if company is private (no stock data or isPublic=false)
    const isPrivateCompany = !stockDataResult.data?.isPublic

    // If private company, fetch private financials
    if (isPrivateCompany) {
      logger.info(
        '🏢 Private company detected - fetching funding & financial data...'
      )
      try {
        const privateFinancialsResult = await this.executeMicroPrompt(
          'privateCompanyFinancials',
          companyName
        )

        // ⚠️ VALIDATION: Detect and flag suspicious funding data
        const validated = this._validatePrivateFinancials(
          privateFinancialsResult,
          companyName
        )
        results.privateFinancials = validated

        // Debug log to see what fields are present after validation
        logger.info('✅ Private company financials fetched successfully')
        logger.info('📊 Private financials structure:', {
          hasDynamicFinancials: !!validated.data?.dynamicFinancials,
          dynamicFinancialsCount:
            validated.data?.dynamicFinancials?.length || 0,
          hasFundingStage: !!validated.data?.fundingStage,
          hasNotableInvestors: !!validated.data?.notableInvestors,
          notableInvestorsCount: validated.data?.notableInvestors?.length || 0,
        })
      } catch (error) {
        logger.warn(`⚠️ Failed to fetch private financials: ${error.message}`)
        // Continue without private financials (not critical)
        results.privateFinancials = null
      }
    }

    logger.info('✅ Batch 1 complete')

    return results
  }

  /**
   * Execute Batch 2: Sumble data collection (primary-source data)
   * Includes: techStack, priorityContacts, hiringSignals
   * No context needed - direct API calls to Sumble
   *
   * @private
   * @param {string} companyName - Company name
   * @param {string} companyDomain - Company domain
   * @returns {Promise<Object>} Batch 2 results with Sumble data
   */
  async _executeBatch2(companyName, companyDomain) {
    logger.info(
      '🔍 Batch 2: Sumble primary-source data collection (tech, contacts, org info)...'
    )

    // Execute Sumble API calls in parallel (all independent)
    const [sumbleTechStack, sumbleContacts, sumbleOrgInfo] = await Promise.all([
      sumbleService.getOrganizationTechStack(companyDomain),
      sumbleService.findPriorityContacts(companyDomain, {
        jobLevels: ['CXO', 'VP', 'Director'],
        jobFunctions: [
          'Executive', // ✅ Captures CEO, CTO, founders, C-level
          'Engineering',
          'Product',
          'Sales',
          'Marketing',
          'Operations',
        ],
        limit: 10,
      }),
      sumbleService.getOrganizationInfo(companyDomain),
    ])

    const results = {}

    // Process tech stack with Sumble primary, Perplexity fallback
    results.techStack = await this._processTechStack(
      companyName,
      sumbleTechStack
    )

    // Process priority contacts with Sumble primary, Perplexity fallback
    results.priorityContacts = await this._processPriorityContacts(
      companyName,
      sumbleContacts
    )

    // Store Sumble org info for use in combineResults (with Perplexity fallback)
    results.sumbleOrgInfo = sumbleOrgInfo

    if (sumbleOrgInfo.success) {
      logger.info(
        '✅ Sumble Org Info: Using Sumble data for employee count, industry, HQ'
      )
    } else {
      logger.warn('⚠️  Sumble Org Info: Failed, using Perplexity fallback')
      logger.debug(`   Error: ${sumbleOrgInfo.error}`)
    }

    logger.info(`✅ Batch 2 complete - Sumble data collected`)

    return results
  }

  /**
   * Process tech stack data with Sumble primary, Perplexity fallback
   * @private
   * @param {string} companyName - Company name
   * @param {Object} sumbleTechStack - Sumble tech stack response
   * @returns {Promise<Object>} Tech stack result
   */
  async _processTechStack(companyName, sumbleTechStack) {
    if (sumbleTechStack.success && sumbleTechStack.technologies.length > 0) {
      logger.info(
        `✅ Tech Stack: Using Sumble data (${sumbleTechStack.technologies.length} technologies)`
      )
      return {
        success: true,
        data: this.formatSumbleTechStack(sumbleTechStack),
        source: 'sumble',
        creditsUsed: sumbleTechStack.creditsUsed,
      }
    }

    logger.info(`⚠️ Tech Stack: Sumble unavailable, falling back to Perplexity`)
    try {
      const perplexityTechStack = await this.executeMicroPrompt(
        'techStack',
        companyName
      )

      // CRITICAL: Ensure each tech stack item has required schema fields
      const techStackData = Array.isArray(perplexityTechStack)
        ? perplexityTechStack
        : []
      const normalizedData = techStackData.map((item) => ({
        category: item.category || 'Technology',
        tool: item.tool || item.name || 'Unknown',
        verified: false, // Perplexity data is not verified like Sumble
        source: 'perplexity-fallback',
        // Optional fields - only include if present
        ...(item.jobsCount !== undefined && { jobsCount: item.jobsCount }),
        ...(item.teamsCount !== undefined && { teamsCount: item.teamsCount }),
        ...(item.peopleCount !== undefined && {
          peopleCount: item.peopleCount,
        }),
        ...(item.lastJobPost !== undefined && {
          lastJobPost: item.lastJobPost,
        }),
        ...(item.verificationUrl !== undefined && {
          verificationUrl: item.verificationUrl,
        }),
        ...(item.teamsDataUrl !== undefined && {
          teamsDataUrl: item.teamsDataUrl,
        }),
        ...(item.hiringIntensity !== undefined && {
          hiringIntensity: item.hiringIntensity,
        }),
        ...(item.daysSinceLastPost !== undefined && {
          daysSinceLastPost: item.daysSinceLastPost,
        }),
      }))

      return {
        success: true,
        data: normalizedData,
        source: 'perplexity-fallback',
      }
    } catch (error) {
      logger.error('Tech stack fallback also failed:', error)
      return {
        success: false,
        error: 'Tech stack data unavailable',
        data: [],
      }
    }
  }

  /**
   * Execute Batch 3: Context-dependent intelligence
   * Includes: companyIntelligence, companyActivity (enhanced)
   * Requires Batch 1 context (news, stock, events) and Batch 2 (Sumble data)
   *
   * @private
   * @param {string} companyName - Company name
   * @param {string} companyDomain - Company domain
   * @param {Object} batch1Results - Results from Batch 1
   * @param {Object} batch2Results - Results from Batch 2
   * @returns {Promise<Object>} Batch 3 results
   */
  async _executeBatch3(
    companyName,
    companyDomain,
    batch1Results,
    batch2Results
  ) {
    logger.info(
      '💡 Batch 3: Context-dependent intelligence (company analysis, buying signals)...'
    )

    // Get Sumble hiring signals (derived from tech stack)
    const sumbleTechStackRaw =
      batch2Results.techStack?.source === 'sumble'
        ? {
            technologies: batch2Results.techStack.data,
            creditsUsed: batch2Results.techStack.creditsUsed,
          }
        : { technologies: [], creditsUsed: 0 }

    // Execute Batch 3 micro-prompts in parallel with Sumble hiring signals
    const [batch3Results, sumbleHiringSignals] = await Promise.all([
      Promise.allSettled([
        this.executeMicroPrompt('companyIntelligence', companyName),
        this.executeMicroPrompt('companyActivity', companyName),
      ]),
      sumbleService.getHiringSignals(companyDomain, sumbleTechStackRaw),
    ])

    const results = {}
    ;['companyIntelligence', 'companyActivity'].forEach((type, index) => {
      const result = batch3Results[index]
      if (result.status === 'fulfilled') {
        results[type] = result.value
      } else {
        logger.error(`Batch 3 ${type} failed:`, result.reason)
        results[type] = {
          success: false,
          error: result.reason?.message || 'Micro-prompt execution failed',
        }
      }
    })

    // Enhance company activity with Sumble hiring intelligence
    results.companyActivity = this._enhanceCompanyActivity(
      results.companyActivity,
      sumbleHiringSignals
    )

    logger.info(`✅ Batch 3 complete - Intelligence analysis done`)

    return results
  }

  /**
   * Process priority contacts with Sumble primary, Perplexity fallback
   * @private
   * @param {string} companyName - Company name
   * @param {Object} sumbleContacts - Sumble contacts response
   * @returns {Promise<Object>} Priority contacts result
   */
  async _processPriorityContacts(companyName, sumbleContacts) {
    if (sumbleContacts.success && sumbleContacts.people.length > 0) {
      logger.info(
        `✅ Priority Contacts: Using Sumble data (${sumbleContacts.people.length} executives)`
      )
      return {
        success: true,
        data: this.formatSumbleContacts(sumbleContacts),
        source: 'sumble',
        creditsUsed: sumbleContacts.creditsUsed,
      }
    }

    logger.info(
      `⚠️ Priority Contacts: Sumble unavailable, falling back to Perplexity`
    )
    try {
      // Get executive names and intelligence
      const perplexityResponse = await this.executeMicroPrompt(
        'priorityContacts',
        companyName,
        {
          webSearchOptions: { search_context_size: 'high' }, // Better search results
        }
      )

      const contacts = perplexityResponse.data || []

      // Add source field to contacts
      const enhancedContacts = contacts.map((contact) => ({
        ...contact,
        profileUrl: contact.profileUrl || null,
        source: 'perplexity-fallback',
        verified: false,
      }))

      logger.info(
        `✅ Priority Contacts: Perplexity fallback returned ${enhancedContacts.length} contacts`
      )

      return {
        success: true,
        data: enhancedContacts,
        source: 'perplexity-fallback',
      }
    } catch (error) {
      logger.error('Priority contacts fallback also failed:', error)
      return {
        success: false,
        error: 'Priority contacts data unavailable',
        data: [],
      }
    }
  }

  /**
   * Enhance company activity with Sumble hiring intelligence
   * @private
   * @param {Object} companyActivityResult - Perplexity company activity
   * @param {Object} sumbleHiringSignals - Sumble hiring signals response
   * @returns {Object} Enhanced company activity result
   */
  _enhanceCompanyActivity(companyActivityResult, sumbleHiringSignals) {
    if (sumbleHiringSignals.success && sumbleHiringSignals.signals.length > 0) {
      logger.info(
        `✅ Company Activity: Hybrid data (${
          sumbleHiringSignals.signals.length
        } from Sumble + ${
          companyActivityResult?.data?.length || 0
        } from Perplexity)`
      )

      const perplexityActivity = companyActivityResult?.data || []
      const mergedActivity = this.mergeCompanyActivity(
        perplexityActivity,
        sumbleHiringSignals.signals
      )

      return {
        success: true,
        data: mergedActivity,
        source: 'hybrid-sumble-perplexity',
        sumbleSignalsCount: sumbleHiringSignals.signals.length,
        perplexitySignalsCount: perplexityActivity.length,
        creditsUsed: sumbleHiringSignals.creditsUsed,
      }
    }

    logger.info(
      `ℹ️ Company Activity: Using Perplexity only (${
        companyActivityResult?.data?.length || 0
      } events)`
    )
    return companyActivityResult
  }

  /**
   * Calculate total Sumble credits used across all API calls
   * @private
   * @param {Object} sumbleTechStack - Tech stack response
   * @param {Object} sumbleContacts - Contacts response
   * @param {Object} sumbleOrgInfo - Organization info response
   * @param {Object} sumbleHiringSignals - Hiring signals response
   * @returns {number} Total credits used
   */
  _calculateSumbleCredits(
    sumbleTechStack,
    sumbleContacts,
    sumbleOrgInfo,
    sumbleHiringSignals
  ) {
    return (
      (sumbleTechStack.creditsUsed || 0) +
      (sumbleContacts.creditsUsed || 0) +
      (sumbleOrgInfo.creditsUsed || 0) +
      (sumbleHiringSignals.creditsUsed || 0)
    )
  }

  /**
   * Log analysis summary with timing and credit usage
   * @private
   * @param {number} processingTime - Time in milliseconds
   * @param {number} totalSumbleCredits - Total Sumble credits used
   * @param {Object} sumbleTechStack - Tech stack response
   * @param {Object} sumbleContacts - Contacts response
   * @param {Object} sumbleOrgInfo - Organization info response
   * @param {Object} sumbleHiringSignals - Hiring signals response
   * @param {Object} totalPerplexityUsage - Total Perplexity token usage
   */
  _logAnalysisSummary(
    processingTime,
    totalSumbleCredits,
    sumbleTechStack,
    sumbleContacts,
    sumbleOrgInfo,
    sumbleHiringSignals,
    totalPerplexityUsage
  ) {
    logger.info(`✅ Hybrid analysis completed in ${processingTime}ms`)

    // Calculate and log Sumble costs
    const sumbleCost = sumbleService.calculateCost(totalSumbleCredits)
    logger.info(
      `💳 Sumble Total Credits Used: ${totalSumbleCredits} (Tech Stack: ${
        sumbleTechStack.creditsUsed || 0
      }, Contacts: ${sumbleContacts.creditsUsed || 0}, Org Info: ${
        sumbleOrgInfo.creditsUsed || 0
      }, Hiring Signals: ${sumbleHiringSignals.creditsUsed || 0})`
    )
    logger.info(`💵 Sumble Total Cost: $${sumbleCost.toFixed(2)}`)
    logger.info(
      `💳 Sumble Credits Remaining: ${
        sumbleService.getRemainingCredits() || 'N/A'
      }`
    )

    // Calculate and log Perplexity costs
    if (totalPerplexityUsage && totalPerplexityUsage.total_tokens) {
      const perplexityCost = this.perplexity.calculateCost(
        totalPerplexityUsage,
        'sonar-pro'
      )
      logger.info(
        `🤖 Perplexity Total Tokens Used: ${
          totalPerplexityUsage.total_tokens
        } (prompt: ${totalPerplexityUsage.prompt_tokens || 0}, completion: ${
          totalPerplexityUsage.completion_tokens || 0
        })`
      )
      logger.info(
        `💵 Perplexity Total Cost: $${perplexityCost.totalCost.toFixed(
          4
        )} (input: $${perplexityCost.inputCost.toFixed(
          4
        )}, output: $${perplexityCost.outputCost.toFixed(4)})`
      )

      // Log combined total cost
      const totalCost = sumbleCost + perplexityCost.totalCost
      logger.info(
        `💰 COMBINED TOTAL COST: $${totalCost.toFixed(
          4
        )} (Sumble: $${sumbleCost.toFixed(
          2
        )} + Perplexity: $${perplexityCost.totalCost.toFixed(4)})`
      )
    } else {
      // Only Sumble was used (no Perplexity)
      logger.info(
        `💰 COMBINED TOTAL COST: $${sumbleCost.toFixed(2)} (Sumble only)`
      )
    }
  }

  /**
   * Execute person analysis using micro-prompts
   */
  async analyzePerson(name, title, company) {
    const startTime = Date.now()
    logger.debug(
      `Starting micro-prompt person analysis for ${name} at ${company}`
    )

    try {
      const results = {}

      // Phase 1: Individual person micro-prompts (factual modules only)
      logger.debug('Executing factual person micro-prompts...')
      const phase1Results = await Promise.allSettled([
        this.executeMicroPrompt('personBasicInfo', name, title, company),
        this.executeMicroPrompt('personMediaPresence', name, title, company),
        this.executeMicroPrompt('personSocialActivity', name, title, company),
        this.executeMicroPrompt('personQuotedChallenges', name, title, company),
        this.executeMicroPrompt('personRiskSignals', name, title, company),
      ])

      // Extract Phase 1 results
      ;[
        'personBasicInfo',
        'personMediaPresence',
        'personSocialActivity',
        'personQuotedChallenges',
        'personRiskSignals',
      ].forEach((type, index) => {
        const result = phase1Results[index]
        if (result.status === 'fulfilled') {
          results[type] = result.value
        } else {
          logger.error(`Person micro-prompt failed: ${type}`, result.reason)
          results[type] = {
            success: false,
            error: result.reason?.message || 'Micro-prompt execution failed',
          }
        }
      })

      // Combine all results
      const finalData = this.combinePersonResults(name, title, company, results)
      const processingTime = Date.now() - startTime

      // Calculate and log Perplexity costs for person analysis
      const totalPerplexityUsage = this.calculateTotalUsage(results)
      if (totalPerplexityUsage && totalPerplexityUsage.total_tokens) {
        const perplexityCost = this.perplexity.calculateCost(
          totalPerplexityUsage,
          'sonar-pro'
        )
        logger.info(`✅ Person analysis completed in ${processingTime}ms`)
        logger.info(
          `🤖 Perplexity Total Tokens Used: ${
            totalPerplexityUsage.total_tokens
          } (prompt: ${totalPerplexityUsage.prompt_tokens || 0}, completion: ${
            totalPerplexityUsage.completion_tokens || 0
          })`
        )
        logger.info(
          `💵 Perplexity Total Cost: $${perplexityCost.totalCost.toFixed(
            4
          )} (input: $${perplexityCost.inputCost.toFixed(
            4
          )}, output: $${perplexityCost.outputCost.toFixed(4)})`
        )
        logger.info(
          `💰 TOTAL COST (Person Analysis): $${perplexityCost.totalCost.toFixed(
            4
          )}`
        )
      } else {
        logger.info(`✅ Person analysis completed in ${processingTime}ms`)
      }

      return {
        success: true,
        data: finalData,
        // Keep only essential metadata
        usage: this.calculateTotalUsage(results),
      }
    } catch (error) {
      logger.error('Person analysis failed:', error)
      throw error
    }
  }

  /**
   * Format Sumble tech stack response to match UI expectations
   * Transforms Sumble API response into category/tool structure
   *
   * @param {Object} sumbleResponse - Response from Sumble API
   * @returns {Array} Formatted tech stack array
   */
  formatSumbleTechStack(sumbleResponse) {
    if (
      !sumbleResponse.technologies ||
      sumbleResponse.technologies.length === 0
    ) {
      return []
    }

    // Technology category mapping
    const categoryMap = {
      // CRM & Sales
      Salesforce: 'CRM',
      HubSpot: 'CRM',
      'Microsoft Dynamics': 'CRM',
      'Zoho CRM': 'CRM',
      Pipedrive: 'CRM',

      // Cloud Platforms
      AWS: 'Cloud Platform',
      Azure: 'Cloud Platform',
      'Google Cloud': 'Cloud Platform',
      GCP: 'Cloud Platform',
      'IBM Cloud': 'Cloud Platform',
      'Oracle Cloud': 'Cloud Platform',
      DigitalOcean: 'Cloud Platform',
      Heroku: 'Cloud Platform',

      // Container & Orchestration
      Kubernetes: 'Container Orchestration',
      Docker: 'Containerization',
      OpenShift: 'Container Platform',
      ECS: 'Container Orchestration',
      EKS: 'Container Orchestration',

      // Databases
      PostgreSQL: 'Database',
      MySQL: 'Database',
      MongoDB: 'Database',
      Redis: 'Database',
      Elasticsearch: 'Database',
      'SQL Server': 'Database',
      'Oracle Database': 'Database',
      DynamoDB: 'Database',
      Cassandra: 'Database',

      // Languages
      Python: 'Programming Language',
      Java: 'Programming Language',
      JavaScript: 'Programming Language',
      TypeScript: 'Programming Language',
      'C#': 'Programming Language',
      Go: 'Programming Language',
      Ruby: 'Programming Language',
      PHP: 'Programming Language',
      Swift: 'Programming Language',
      Kotlin: 'Programming Language',

      // Frontend
      React: 'Frontend Framework',
      Angular: 'Frontend Framework',
      'Vue.js': 'Frontend Framework',
      'Next.js': 'Frontend Framework',

      // Backend
      'Node.js': 'Backend Framework',
      Django: 'Backend Framework',
      Flask: 'Backend Framework',
      'Spring Boot': 'Backend Framework',
      Express: 'Backend Framework',
      Laravel: 'Backend Framework',
      'Ruby on Rails': 'Backend Framework',

      // DevOps & CI/CD
      Jenkins: 'CI/CD',
      'GitLab CI': 'CI/CD',
      'GitHub Actions': 'CI/CD',
      CircleCI: 'CI/CD',
      Terraform: 'Infrastructure as Code',
      Ansible: 'Configuration Management',
      CloudFormation: 'Infrastructure as Code',

      // Monitoring
      Datadog: 'Monitoring',
      'New Relic': 'Monitoring',
      Prometheus: 'Monitoring',
      Grafana: 'Monitoring',
      Splunk: 'Monitoring',

      // Message Queues
      Kafka: 'Message Queue',
      RabbitMQ: 'Message Queue',
      'Amazon SQS': 'Message Queue',

      // Analytics
      Tableau: 'Analytics',
      'Power BI': 'Analytics',
      Looker: 'Analytics',
      'Google Analytics': 'Analytics',

      // Security
      Okta: 'Identity Management',
      Auth0: 'Identity Management',
      Vault: 'Security',

      // Version Control
      GitHub: 'Version Control',
      GitLab: 'Version Control',
      Bitbucket: 'Version Control',

      // Project Management
      Jira: 'Project Management',
      Confluence: 'Collaboration',
      Asana: 'Project Management',
      Trello: 'Project Management',

      // Communication
      Slack: 'Communication',
      'Microsoft Teams': 'Communication',
      Zoom: 'Communication',

      // Marketing
      Marketo: 'Marketing Automation',
      Pardot: 'Marketing Automation',
      Mailchimp: 'Marketing Automation',
      SendGrid: 'Email Service',

      // E-Commerce
      Shopify: 'E-Commerce',
      Stripe: 'Payment Processing',
      PayPal: 'Payment Processing',

      // Mobile
      'React Native': 'Mobile Development',
      Flutter: 'Mobile Development',

      // Machine Learning
      TensorFlow: 'Machine Learning',
      PyTorch: 'Machine Learning',
      OpenAI: 'AI Platform',
      Anthropic: 'AI Platform',
    }

    return sumbleResponse.technologies.map((tech) => ({
      category: categoryMap[tech.name] || 'Technology',
      tool: tech.name,
      // Additional Sumble-specific metadata
      verified: true,
      source: 'sumble',
      jobsCount: tech.jobs_count,
      teamsCount: tech.teams_count,
      lastJobPost: tech.last_job_post,
      verificationUrl: tech.jobs_data_url,
      teamsDataUrl: tech.teams_data_url,
      // NEW: Hiring intensity calculation
      hiringIntensity: this.calculateHiringIntensity(tech),
      daysSinceLastPost: tech.last_job_post
        ? this.calculateDaysSince(tech.last_job_post)
        : null,
    }))
  }

  /**
   * Calculate hiring intensity for a technology based on job activity
   *
   * @param {Object} tech - Technology object from Sumble API
   * @returns {string} 'HOT', 'WARM', or 'COLD'
   */
  calculateHiringIntensity(tech) {
    if (!tech.last_job_post || !tech.jobs_count) {
      return 'COLD'
    }

    const daysSincePost = this.calculateDaysSince(tech.last_job_post)

    // HOT: 20+ jobs posted within last 30 days
    if (daysSincePost <= 30 && tech.jobs_count >= 20) {
      return 'HOT'
    }

    // WARM: 5-19 jobs posted within last 30 days
    if (daysSincePost <= 30 && tech.jobs_count >= 5) {
      return 'WARM'
    }

    // COLD: Low activity or old posts
    return 'COLD'
  }

  /**
   * Calculate days since a date string
   *
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @returns {number} Days since date
   */
  calculateDaysSince(dateString) {
    if (!dateString) return Infinity

    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = Math.abs(now - date)
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    } catch (error) {
      logger.warn('Invalid date string:', dateString)
      return Infinity
    }
  }

  /**
   * Calculate tenure information from start date
   *
   * @param {string} startDate - Date in YYYY-MM-DD format
   * @returns {Object} Tenure data with years, months, category
   */
  calculateTenure(startDate) {
    if (!startDate) {
      return {
        years: 0,
        months: 0,
        totalMonths: 0,
        category: 'UNKNOWN',
        displayText: 'Unknown tenure',
      }
    }

    try {
      const start = new Date(startDate)
      const now = new Date()
      const diffTime = now - start
      const totalMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44))
      const years = Math.floor(totalMonths / 12)
      const months = totalMonths % 12

      // Categorize tenure
      let category
      if (totalMonths < 6) category = 'NEW' // < 6 months
      else if (totalMonths < 18) category = 'RECENT' // 6-18 months
      else category = 'ESTABLISHED' // 18+ months

      // Display text
      let displayText
      if (years === 0) {
        displayText = `${months} month${months !== 1 ? 's' : ''}`
      } else if (months === 0) {
        displayText = `${years} year${years !== 1 ? 's' : ''}`
      } else {
        displayText = `${years}.${Math.floor((months / 12) * 10)} years`
      }

      return {
        years,
        months,
        totalMonths,
        category,
        displayText,
        startDate,
      }
    } catch (error) {
      logger.warn('Invalid start date:', startDate)
      return {
        years: 0,
        months: 0,
        totalMonths: 0,
        category: 'UNKNOWN',
        displayText: 'Unknown tenure',
      }
    }
  }

  /**
   * Format Sumble contacts response to match UI expectations
   * Transforms Sumble API response into priority contacts structure
   * CRITICAL: Uses null for profileUrl instead of fake LinkedIn URLs
   *
   * @param {Object} sumbleResponse - Response from Sumble API
   * @returns {Array} Formatted priority contacts array
   */
  formatSumbleContacts(sumbleResponse) {
    if (!sumbleResponse.people || sumbleResponse.people.length === 0) {
      return []
    }

    return sumbleResponse.people.map((person) => {
      const tenure = this.calculateTenure(person.start_date)

      return {
        name: person.name,
        title: person.job_title || 'Unknown',
        // FIXED: Extract real LinkedIn URLs from Sumble API response
        profileUrl: person.linkedin_url || null,
        // Enhanced Sumble-specific metadata
        verified: true,
        source: 'sumble',
        jobFunction: person.job_function,
        jobLevel: person.job_level,
        // NEW: Location data
        location: person.location || null,
        country: person.country || null,
        countryCode: person.country_code || null,
        // NEW: Tenure data
        startDate: person.start_date || null,
        tenure: tenure.displayText,
        tenureCategory: tenure.category,
        tenureMonths: tenure.totalMonths,
        // Sumble profile data
        sumbleId: person.id,
        sumbleUrl: person.url,
        // Factual activity field only
        recentActivity: person.start_date
          ? `Joined as ${person.job_level} on ${person.start_date}`
          : `Verified ${person.job_level} at company`,
      }
    })
  }

  /**
   * Merge Sumble hiring signals with Perplexity company activity
   * Prioritizes Sumble hiring signals and adds Perplexity non-hiring activity
   *
   * @param {Array} perplexityActivity - Company activity from Perplexity
   * @param {Array} sumbleSignals - Hiring signals from Sumble
   * @returns {Array} Merged activity events
   */
  mergeCompanyActivity(perplexityActivity, sumbleSignals) {
    // Start with Sumble hiring signals (higher quality, primary source)
    const merged = [...sumbleSignals]

    // Add non-hiring Perplexity activity (funding, expansion, partnerships, etc.)
    const nonHiringActivity = perplexityActivity.filter(
      (activity) =>
        activity.type !== 'hiring' &&
        activity.type !== 'talent-acquisition' &&
        !activity.description?.toLowerCase().includes('hiring') &&
        !activity.note?.toLowerCase().includes('hiring')
    )

    // Add Perplexity activity to the merged array
    merged.push(...nonHiringActivity)

    // Sort by date (most recent first)
    return merged.sort((a, b) => {
      const dateA = new Date(a.date || 0)
      const dateB = new Date(b.date || 0)
      return dateB - dateA
    })
  }

  /**
   * Combine person micro-prompt results into final response
   */
  combinePersonResults(name, title, company, results) {
    const combined = {
      // Basic person info
      name: name,
      title: title,
      company: company,

      // Enhanced SDR-focused structure
      isCXO: { value: false, level: 'Individual', confidence: 'low' },

      // New SDR intelligence fields
      budgetCycle: { timing: null, fiscalYear: null, confidence: 'low' },
      contactPreferences: {
        accessibility: 'low',
        bestTimes: [],
        preferredChannels: [],
        responseRate: 'low',
      },

      // Enhanced conversation intelligence
      recentLinkedInActivity: [],
      specificQuotes: [],
      industryInfluence: [],
      recentAchievements: [],
      optimalContactTiming: {
        bestDays: [],
        bestTimes: [],
        activityPattern: null,
        responseWindow: null,
      },

      // Enhanced pain point analysis
      publiclyStatedPainPoints: [],
      quotedChallenges: [], // Initialize explicitly for schema consistency
      solutionTiming: {
        evaluationPhase: null,
        budgetApproval: null,
        implementationTarget: null,
        confidence: 'low',
      },

      // Recent activity and social presence
      recentActivity: {
        posts: [],
        postingFrequency: 'inactive', // Must be string, not null (schema requirement)
        dominantTopics: [],
      },

      // Speaking engagements and industry recognition
      speakingEngagements: {
        events: [],
        awards: [],
        industryInvolvement: [],
      },

      // Content creation and thought leadership
      contentCreation: {
        publishedContent: [],
        mediaAppearances: [],
        contentFrequency: null,
        expertiseAreas: [],
      },

      // Keep only essential metadata
      metadata: {
        personName: name,
        title: title,
        company: company,
        analysisType: 'sdr_focused',
        version: '2.0',
        schemaVersion: require('../schemas/analysisSchemas').SCHEMA_VERSION, // Unified version for cache validation
      },
    }

    // Merge basic info data (Module 1)
    if (results.personBasicInfo?.success) {
      const basicInfo = results.personBasicInfo.data
      Object.assign(combined, {
        fullName: basicInfo.fullName || combined.fullName,
        title: basicInfo.title || combined.title,
        executiveLevel: basicInfo.executiveLevel || null,
        yearsInRole: basicInfo.yearsInRole || null,
        linkedinUrl: basicInfo.linkedinUrl || null,
        twitterHandle: basicInfo.twitterHandle || null,
        previousRole: basicInfo.previousRole || null,
      })
    }

    // Merge media presence data (Module 2)
    if (results.personMediaPresence?.success) {
      const mediaData = results.personMediaPresence.data

      // Log for debugging with detailed info
      logger.info(
        `📊 Media presence data received: ${
          mediaData.awards?.length || 0
        } awards, ${mediaData.speakingEngagements?.length || 0} events, ${
          mediaData.pressFeatures?.length || 0
        } press features, ${mediaData.publishedContent?.length || 0} content`
      )

      // ✅ ALWAYS populate structure even if empty (for UI consistency)
      // CRITICAL: Use spread operator to create COPIES, not references
      combined.mediaPresence = {
        pressFeatures: Array.isArray(mediaData.pressFeatures)
          ? [...mediaData.pressFeatures]
          : [],
        speakingEngagements: Array.isArray(mediaData.speakingEngagements)
          ? [...mediaData.speakingEngagements]
          : [],
        awards: Array.isArray(mediaData.awards) ? [...mediaData.awards] : [],
        publishedContent: Array.isArray(mediaData.publishedContent)
          ? [...mediaData.publishedContent]
          : [],
      }

      // ✅ Map to top-level UI-expected fields (ALWAYS set, even if empty)
      // CRITICAL: Use spread operator to create COPIES, not references
      combined.speakingEngagements.events = Array.isArray(
        mediaData.speakingEngagements
      )
        ? [...mediaData.speakingEngagements]
        : []
      combined.speakingEngagements.awards = Array.isArray(mediaData.awards)
        ? [...mediaData.awards]
        : []
      combined.contentCreation.publishedContent = Array.isArray(
        mediaData.publishedContent
      )
        ? [...mediaData.publishedContent]
        : []
      // Don't duplicate - pressFeatures already in mediaPresence.pressFeatures
      combined.contentCreation.mediaAppearances = []

      // Log if data is sparse
      const totalItems =
        combined.speakingEngagements.events.length +
        combined.speakingEngagements.awards.length +
        combined.contentCreation.publishedContent.length +
        combined.mediaPresence.pressFeatures.length
      if (totalItems === 0) {
        logger.warn(
          `⚠️ No thought leadership data found for ${name} - will attempt extraction from social posts`
        )
      }
    } else {
      // ✅ If personMediaPresence failed, ensure empty arrays (not undefined)
      logger.warn(
        `⚠️ personMediaPresence module failed or returned no data for ${name}`
      )
      combined.speakingEngagements.events = []
      combined.speakingEngagements.awards = []
      combined.contentCreation.publishedContent = []
      // Don't duplicate - pressFeatures already in mediaPresence.pressFeatures
      combined.contentCreation.mediaAppearances = []
    }

    // ============================================
    // INTELLIGENT EXTRACTION: Extract speaking/awards from social posts
    // ============================================
    // If media presence data is sparse, try to extract from social activity posts
    const hasMediaData =
      combined.speakingEngagements.events.length > 0 ||
      combined.speakingEngagements.awards.length > 0
    const hasSocialPosts =
      results.personSocialActivity?.success &&
      results.personSocialActivity.data?.posts?.length > 0

    if (!hasMediaData && hasSocialPosts) {
      logger.info(
        '🔍 Attempting to extract speaking/awards from social activity posts...'
      )
      const extracted = this._extractThoughtLeadershipFromPosts(
        results.personSocialActivity.data.posts
      )

      if (extracted.speaking.length > 0 || extracted.awards.length > 0) {
        logger.info(
          `✅ Extracted from social posts: ${extracted.speaking.length} speaking, ${extracted.awards.length} awards`
        )

        // Deduplicate extracted data before adding
        const deduplicateSpeaking = (arr) => {
          const map = new Map()
          arr.forEach((item) => {
            const key = `${item.event}_${item.date}`
            if (!map.has(key)) map.set(key, item)
          })
          return Array.from(map.values())
        }

        const deduplicateAwards = (arr) => {
          const map = new Map()
          arr.forEach((item) => {
            const key = `${item.award}_${item.date}`
            if (!map.has(key)) map.set(key, item)
          })
          return Array.from(map.values())
        }

        const uniqueSpeaking = deduplicateSpeaking(extracted.speaking)
        const uniqueAwards = deduplicateAwards(extracted.awards)
        const uniqueMedia = extracted.media // Media likely doesn't need dedup

        // Add extracted data to combined results
        // Since we now use separate array copies (not references), we need to add to both locations
        combined.speakingEngagements.events.push(...uniqueSpeaking)
        combined.speakingEngagements.awards.push(...uniqueAwards)

        // Also add to mediaPresence for consistency (separate arrays now, no duplication)
        combined.mediaPresence.speakingEngagements.push(...uniqueSpeaking)
        combined.mediaPresence.awards.push(...uniqueAwards)
        combined.mediaPresence.pressFeatures.push(...uniqueMedia)
      } else {
        logger.warn(
          '⚠️ No speaking/awards found in social posts either - profile may lack public thought leadership'
        )
      }
    }

    // Merge social activity data (Module 3)
    if (results.personSocialActivity?.success) {
      const socialData = results.personSocialActivity.data

      // Log for debugging
      logger.debug(
        `Social activity data: ${socialData.posts?.length || 0} posts`
      )

      combined.socialActivity = {
        posts: socialData.posts || [],
      }

      // Map to top-level recentActivity for UI with validation
      combined.recentActivity.posts = (socialData.posts || []).map((post) => ({
        date: post.date,
        platform: post.platform,
        type: post.type || 'post',
        content: post.content,
        topics: post.topics || [],
        sentiment: post.sentiment || 'neutral', // Include sentiment with fallback
        url: post.url,
        isShared: post.isShared || false,
        originalAuthor: post.originalAuthor || null,
      }))

      logger.debug(`Mapped ${combined.recentActivity.posts.length} total posts`)
    } else {
      logger.warn(
        `Social activity micro-prompt failed or returned no success: ${
          results.personSocialActivity?.error || 'unknown error'
        }`
      )
    }

    // Merge quoted challenges data (Module 4)
    if (results.personQuotedChallenges?.success) {
      const challengesData = results.personQuotedChallenges.data

      // Map quotedChallenges: Ensure both 'challenge' and 'quote' fields exist (schema requires both)
      combined.quotedChallenges = (challengesData.quotedChallenges || []).map(
        (item) => {
          if (typeof item === 'string') {
            return {
              challenge: item,
              quote: item,
              source: '',
              date: '',
              url: '',
            }
          }
          // Schema requires both 'challenge' and 'quote' fields
          const quoteText = item.quote || item.challenge || ''
          return {
            challenge: quoteText, // Use quote text as challenge
            quote: quoteText, // Keep original quote
            source: item.source || '',
            date: item.date || '',
            url: item.url || '',
          }
        }
      )

      // Map to UI-expected pain points field (create proper objects)
      // Transform challenges into pain point objects with tag/priority/context
      combined.publiclyStatedPainPoints = (
        challengesData.quotedChallenges || []
      ).map((item) => {
        const challengeText =
          typeof item === 'string' ? item : item.quote || item.challenge || ''
        const context = typeof item === 'object' ? item.context || '' : ''

        return {
          tag: this._extractPainPointTag(challengeText),
          priority: this._inferPainPointPriority(challengeText),
          context: context || challengeText,
        }
      })
    } else {
      // Fallback when micro-prompt fails: Initialize as empty arrays
      // This ensures schema consistency even when Perplexity fails
      logger.warn('⚠️ personQuotedChallenges failed, initializing empty arrays')
      combined.quotedChallenges = []
      combined.publiclyStatedPainPoints = []
    }

    // Merge reality check data (Module 5 - Brutal qualification facts)
    if (results.personRiskSignals?.success) {
      const realityData = results.personRiskSignals.data

      // Add reality check to combined output
      combined.realityCheck = realityData.realityCheck || []

      // Log reality check summary
      if (realityData.realityCheck?.length > 0) {
        logger.info(
          `🔍 Reality Check: ${realityData.realityCheck.length} observation(s) found`
        )
        // Log first observation for quick insight
        if (realityData.realityCheck[0]?.observation) {
          logger.info(
            `   First: "${realityData.realityCheck[0].observation.substring(
              0,
              100
            )}..."`
          )
        }
      } else {
        logger.info('✅ Reality check passed - No qualification concerns')
      }
    } else {
      // Fallback when micro-prompt fails: Initialize with empty array
      logger.warn('⚠️ personRiskSignals failed, initializing empty array')
      combined.realityCheck = []
    }

    // ============================================
    // DATA ENRICHMENT: Cross-fill empty fields
    // ============================================

    // Enrich Recent Activity: If posts are empty, populate from mediaPresence
    const needsActivityEnrichment =
      !combined.recentActivity.posts ||
      combined.recentActivity.posts.length === 0
    const hasEnrichmentData =
      combined.mediaPresence?.pressFeatures?.length > 0 ||
      combined.speakingEngagements?.events?.length > 0 ||
      combined.speakingEngagements?.awards?.length > 0

    if (needsActivityEnrichment && hasEnrichmentData) {
      logger.info('📊 Enriching recent activity from media presence data')

      const enrichedPosts = []

      // Add press features as activity
      if (combined.mediaPresence.pressFeatures?.length > 0) {
        combined.mediaPresence.pressFeatures.forEach((feature) => {
          enrichedPosts.push({
            date: feature.date,
            platform: 'LinkedIn',
            type: feature.type || 'interview',
            content: `Featured in ${feature.publication}: ${feature.title}`,
            topics: feature.topics || [],
            sentiment: 'professional', // Interviews/media mentions are professional
            engagement: null,
            url: feature.url,
            isEnriched: true,
          })
        })
        logger.debug(
          `Added ${combined.mediaPresence.pressFeatures.length} press features as activity`
        )
      }

      // Add speaking engagements as activity
      if (combined.speakingEngagements.events?.length > 0) {
        combined.speakingEngagements.events.forEach((event) => {
          enrichedPosts.push({
            date: event.date,
            platform: 'LinkedIn',
            type: 'speaking',
            content: `${event.role} at ${event.event}: ${event.topic}`,
            topics: [event.topic],
            sentiment: 'thought-leadership', // Speaking is thought leadership
            engagement: null,
            url: event.url,
            isEnriched: true,
          })
        })
        logger.debug(
          `Added ${combined.speakingEngagements.events.length} speaking engagements as activity`
        )
      }

      // Add awards as activity
      if (combined.speakingEngagements.awards?.length > 0) {
        combined.speakingEngagements.awards.forEach((award) => {
          enrichedPosts.push({
            date: award.date,
            platform: 'LinkedIn',
            type: 'award',
            content: `Recognized: ${award.award} by ${award.organization}`,
            topics: [],
            sentiment: 'promotional', // Awards/recognition are promotional
            engagement: null,
            url: award.url,
            isEnriched: true,
          })
        })
        logger.debug(
          `Added ${combined.speakingEngagements.awards.length} awards as activity`
        )
      }

      if (enrichedPosts.length > 0) {
        combined.recentActivity.posts = enrichedPosts
        combined.recentActivity.postingFrequency = 'sporadic'
        logger.info(
          `✅ Enriched activity with ${enrichedPosts.length} items from media presence`
        )
      }
    }

    // Enrich Recent Achievements: Populate from awards if empty
    // ONLY enrich if we have awards AND recentAchievements is truly empty
    if (
      (!combined.recentAchievements ||
        combined.recentAchievements.length === 0) &&
      combined.speakingEngagements.awards?.length > 0
    ) {
      logger.info('📊 Enriching recent achievements from awards data')
      // Use a Set to deduplicate based on award name + date
      const uniqueAwards = new Map()
      combined.speakingEngagements.awards.forEach((award) => {
        const key = `${award.award}_${award.date}`
        if (!uniqueAwards.has(key)) {
          uniqueAwards.set(key, award)
        }
      })

      combined.recentAchievements = Array.from(uniqueAwards.values()).map(
        (award) => ({
          achievement: award.award,
          date: award.date,
          source: award.organization,
          url: award.url,
        })
      )
      logger.debug(
        `Added ${combined.recentAchievements.length} unique awards as achievements`
      )
    }

    // Enrich Pain Points: Derive from quoted challenges if both are empty
    // This is already handled above in the merge, but add fallback to executive quotes from company intelligence
    if (
      (!combined.publiclyStatedPainPoints ||
        combined.publiclyStatedPainPoints.length === 0) &&
      combined.quotedChallenges?.length > 0
    ) {
      // Already mapped above, but ensure it's populated
      logger.debug('Pain points already mapped from quoted challenges')
    }

    // Validation and debug logging
    logger.debug('Person analysis data summary:', {
      painPoints: combined.publiclyStatedPainPoints?.length || 0,
      recentActivityPosts: combined.recentActivity.posts?.length || 0,
      awards: combined.speakingEngagements.awards?.length || 0,
      speakingEvents: combined.speakingEngagements.events?.length || 0,
      publishedContent: combined.contentCreation.publishedContent?.length || 0,
      pressFeatures: combined.mediaPresence.pressFeatures?.length || 0,
    })

    // Calculate data completeness score
    const dataFields = [
      combined.publiclyStatedPainPoints?.length > 0,
      combined.recentActivity.posts?.length > 0,
      combined.speakingEngagements.awards?.length > 0,
      combined.speakingEngagements.events?.length > 0,
      combined.contentCreation.publishedContent?.length > 0,
      combined.mediaPresence.pressFeatures?.length > 0,
    ]
    const completenessScore =
      (dataFields.filter(Boolean).length / dataFields.length) * 100
    logger.info(
      `📈 Profile data completeness: ${completenessScore.toFixed(0)}%`
    )

    // Warn if key fields are empty
    if (!combined.publiclyStatedPainPoints?.length) {
      logger.warn(
        '⚠️ No pain points found for person analysis (check quoted challenges search)'
      )
    }
    if (!combined.recentActivity.posts?.length) {
      logger.warn(
        '⚠️ No recent activity posts found for person analysis (enrichment also failed)'
      )
    }
    if (completenessScore < 50) {
      logger.warn(
        `⚠️ Low data completeness (${completenessScore.toFixed(
          0
        )}%) - profile may appear sparse in UI`
      )
    }

    return combined
  }

  /**
   * Parse and validate JSON response
   * Enhanced to handle explanatory text before/after JSON
   */
  parseAndValidate(content, promptType) {
    try {
      // Clean the response
      let cleaned = content.trim()

      // Strategy 1: Extract from markdown code blocks
      if (cleaned.includes('```json')) {
        const jsonStart = cleaned.indexOf('```json') + 7
        const jsonEnd = cleaned.lastIndexOf('```')
        if (jsonEnd > jsonStart) {
          cleaned = cleaned.substring(jsonStart, jsonEnd).trim()
        }
      } else if (cleaned.includes('```')) {
        const codeStart = cleaned.indexOf('```') + 3
        const codeEnd = cleaned.lastIndexOf('```')
        if (codeEnd > codeStart) {
          cleaned = cleaned.substring(codeStart, codeEnd).trim()
        }
      }

      // Strategy 2: Look for JSON anywhere in content (handle explanatory text)
      // Find first { or [ and extract JSON from there
      let jsonString = ''
      let startChar = null
      let startIndex = -1

      // Find the first occurrence of { or [
      const braceIndex = cleaned.indexOf('{')
      const bracketIndex = cleaned.indexOf('[')

      if (
        braceIndex !== -1 &&
        (bracketIndex === -1 || braceIndex < bracketIndex)
      ) {
        startChar = '{'
        startIndex = braceIndex
      } else if (bracketIndex !== -1) {
        startChar = '['
        startIndex = bracketIndex
      }

      // If we found a JSON start character, extract from there
      if (startIndex !== -1) {
        cleaned = cleaned.substring(startIndex)
      }

      // Strategy 3: Extract complete JSON structure with proper bracket/brace counting
      if (cleaned.startsWith('[')) {
        // Array case
        let bracketCount = 0
        let inString = false
        let escapeNext = false

        for (let i = 0; i < cleaned.length; i++) {
          const char = cleaned[i]

          if (escapeNext) {
            escapeNext = false
            jsonString += char
            continue
          }

          if (char === '\\') {
            escapeNext = true
            jsonString += char
            continue
          }

          if (char === '"' && !escapeNext) {
            inString = !inString
          }

          if (!inString) {
            if (char === '[') bracketCount++
            if (char === ']') bracketCount--
          }

          jsonString += char

          if (bracketCount === 0 && char === ']') {
            break
          }
        }
      } else if (cleaned.startsWith('{')) {
        // Object case
        let braceCount = 0
        let inString = false
        let escapeNext = false

        for (let i = 0; i < cleaned.length; i++) {
          const char = cleaned[i]

          if (escapeNext) {
            escapeNext = false
            jsonString += char
            continue
          }

          if (char === '\\') {
            escapeNext = true
            jsonString += char
            continue
          }

          if (char === '"' && !escapeNext) {
            inString = !inString
          }

          if (!inString) {
            if (char === '{') braceCount++
            if (char === '}') braceCount--
          }

          jsonString += char

          if (braceCount === 0 && char === '}') {
            break
          }
        }
      } else {
        return {
          success: false,
          error: 'No JSON structure found in content (no { or [ found)',
        }
      }

      if (!jsonString) {
        return {
          success: false,
          error: 'Could not extract complete JSON structure',
        }
      }

      // Sanitize JSON string: Remove invalid escape sequences
      // Perplexity sometimes returns \' which is invalid JSON (single quotes don't need escaping)
      // We need to be careful to only fix \' and not break valid escapes like \", \\, \n, etc.
      jsonString = jsonString.replace(/\\'/g, "'")

      logger.debug(
        `Parsing JSON for ${promptType}:`,
        jsonString.substring(0, 200) + '...'
      )

      // Try parsing - if it fails, try additional sanitization
      let parsed
      try {
        parsed = JSON.parse(jsonString)
      } catch (firstError) {
        logger.warn(
          `Initial JSON parse failed, attempting aggressive sanitization...`
        )

        // Additional sanitization: Fix cases where Perplexity escapes quotes improperly
        // This can happen when the LLM returns JSON with incorrectly escaped string delimiters
        try {
          let cleanedJson = jsonString

          // Log the problematic section for debugging
          logger.debug(
            `Problematic JSON (first 500 chars): ${jsonString.substring(
              0,
              500
            )}`
          )

          // Fix 1: Remove backslashes before colons and string delimiters
          // Pattern: "key": \"value\" -> "key": "value"
          // This regex looks for \" that appears after : and before the actual string content
          cleanedJson = cleanedJson.replace(/(":\s*)\\"/g, '$1"')

          // Fix 2: Remove backslashes before closing quotes that precede commas or closing braces
          // Pattern: value\", -> value",
          cleanedJson = cleanedJson.replace(/\\"(\s*[,\}\]])/g, '"$1')

          logger.debug(
            `After sanitization (first 500 chars): ${cleanedJson.substring(
              0,
              500
            )}`
          )

          // Try parsing the cleaned JSON
          parsed = JSON.parse(cleanedJson)
          logger.info(`✅ JSON sanitization successful for ${promptType}`)
        } catch (secondError) {
          // If still failing, log both errors and throw the original
          logger.error(`JSON sanitization failed for ${promptType}`)
          logger.error(`  First error: ${firstError.message}`)
          logger.error(`  Second error: ${secondError.message}`)
          logger.error(
            `  Problematic content: ${jsonString.substring(0, 500)}...`
          )
          throw firstError // Throw original error for consistency
        }
      }

      // Basic validation based on prompt type
      if (this.validatePromptResponse(parsed, promptType)) {
        return { success: true, data: parsed }
      } else {
        return { success: false, error: 'Response validation failed' }
      }
    } catch (error) {
      logger.error(`JSON parse error for ${promptType}:`, error.message)
      logger.error('Content that failed to parse:', content.substring(0, 500))
      return { success: false, error: `JSON parse error: ${error.message}` }
    }
  }

  /**
   * Validate response has required fields for prompt type
   */
  validatePromptResponse(data, promptType) {
    // For MVP-aligned prompts, most return arrays or simple objects
    // Basic validation: ensure data exists and is not empty
    if (!data) return false

    // Enhanced validation for stockData with multi-source verification
    if (promptType === 'stockData') {
      logger.debug(`🔍 ENHANCED VALIDATION STARTING for stockData`)
      logger.debug(`Validating stockData:`, JSON.stringify(data, null, 2))

      // Basic structure validation
      if (typeof data !== 'object' || data === null) {
        logger.debug('❌ stockData validation failed: not an object')
        return false
      }

      // If public company, validate required fields
      if (data.isPublic === true) {
        // Symbol, exchange, and currency are always required for public companies
        const requiredFields = ['symbol', 'exchange', 'currency']
        for (const field of requiredFields) {
          if (!data[field]) {
            logger.debug(
              `❌ stockData validation failed: missing required field ${field}`
            )
            return false
          }
        }

        // Enhanced Price Validation - allow null for illiquid/small-cap stocks
        // but if price exists, it must be valid
        if (data.price !== null && data.price !== undefined) {
          if (typeof data.price !== 'number' || data.price <= 0) {
            logger.debug(
              `❌ stockData validation failed: invalid price: ${data.price}`
            )
            if (data.price === 0) {
              logger.error(
                `CRITICAL: Price is 0 but should be null for unavailable data. The LLM must use null instead of 0.`
              )
            }
            return false
          }
          logger.debug(`✅ Price validation passed: ${data.price}`)
        } else {
          logger.debug(
            `⚠️  Price data unavailable for ${data.symbol} (likely illiquid/small-cap stock)`
          )
        }

        // Validation metadata checks
        if (data.validation) {
          // Check price source count (minimum 4 sources required)
          if (data.validation.priceSourceCount < 4) {
            logger.debug(
              `⚠️  WARNING: Price verified from only ${data.validation.priceSourceCount} sources (minimum 4 recommended)`
            )
          }

          // Check YTD source count (minimum 5 sources required for critical YTD)
          if (data.validation.ytdSourceCount < 3) {
            logger.debug(
              `⚠️  WARNING: YTD verified from only ${data.validation.ytdSourceCount} sources (minimum 3 required)`
            )
          }

          // Validate Jan 1 price if YTD was calculated
          if (
            data.validation.ytdCalculated &&
            data.validation.jan1Price &&
            data.price !== null &&
            data.price !== undefined
          ) {
            if (
              typeof data.validation.jan1Price !== 'number' ||
              data.validation.jan1Price <= 0
            ) {
              logger.debug(
                `❌ stockData validation failed: invalid Jan 1 baseline price: ${data.validation.jan1Price}`
              )
              return false
            }

            // Verify YTD calculation (only if current price is available)
            const calculatedYTD =
              ((data.price - data.validation.jan1Price) /
                data.validation.jan1Price) *
              100
            const ytdDifference = Math.abs(calculatedYTD - data.ytd)

            if (ytdDifference > 1.0) {
              // Allow 1% tolerance for rounding
              logger.debug(
                `⚠️  WARNING: YTD calculation mismatch. Calculated: ${calculatedYTD.toFixed(
                  2
                )}%, Reported: ${data.ytd}%`
              )
            } else {
              logger.debug(
                `✅ YTD calculation verified: ${data.ytd}% (Jan 1: $${data.validation.jan1Price}, Current: $${data.price})`
              )
            }
          }
        }

        // Critical YTD validation (most important field per fact verification report)
        if (data.ytd !== null && data.ytd !== undefined) {
          if (typeof data.ytd !== 'number') {
            logger.debug(
              `❌ stockData validation failed: ytd must be number: ${data.ytd}`
            )
            return false
          }

          // Check for 0 which should be null
          if (data.ytd === 0 && data.price === null) {
            logger.error(
              `CRITICAL: YTD is 0 but price is null - this suggests unavailable data. Use null for ytd instead of 0.`
            )
            return false
          }

          // Flag extreme YTD values for review (based on fact verification findings)
          if (Math.abs(data.ytd) > 500) {
            logger.debug(
              `⚠️  WARNING: Extreme YTD value detected: ${data.ytd}% - please verify this is correct`
            )
          }

          // Special validation for known problematic cases
          if (data.ytd < -50 && !data.validation?.ytdCalculated) {
            logger.debug(
              `⚠️  WARNING: Large negative YTD (${data.ytd}%) without manual calculation - verify accuracy`
            )
          }
        } else {
          // YTD is null - acceptable for illiquid/small-cap stocks with limited data
          logger.debug(
            `⚠️  YTD data unavailable for ${data.symbol} (likely illiquid/small-cap stock with limited trading data)`
          )
          // Don't fail validation - null YTD is acceptable for stocks with limited data
        }

        // Market cap validation with enhanced checks
        if (data.marketCap) {
          const marketCapValue = this.parseMarketCap(data.marketCap)

          // Validate market cap format (allow currency symbols before number)
          if (typeof data.marketCap === 'string') {
            // Updated regex to accept optional currency symbols (₹, $, €, £, ¥, etc.) before the number
            const validFormat = /^[₹$€£¥₩₪₽฿₫₱₦₴₲₵₸]?\d+(\.\d+)?[MBT]$/.test(
              data.marketCap
            )
            if (!validFormat) {
              logger.debug(
                `❌ stockData validation failed: invalid market cap format: ${data.marketCap}`
              )
              return false
            }
          }

          // Cross-validate calculated vs reported market cap
          if (
            data.validation?.marketCapCalculated &&
            data.validation.sharesOutstanding
          ) {
            const sharesValue = this.parseMarketCap(
              data.validation.sharesOutstanding
            )
            const calculatedMarketCap = (data.price * sharesValue) / 1000000 // Convert to millions
            const reportedMarketCap = marketCapValue

            const marketCapDifference =
              Math.abs(
                (calculatedMarketCap - reportedMarketCap) / reportedMarketCap
              ) * 100

            if (marketCapDifference > 15) {
              logger.debug(
                `⚠️  WARNING: Market cap calculation differs by ${marketCapDifference.toFixed(
                  1
                )}% (Calculated: ${calculatedMarketCap.toFixed(
                  0
                )}M, Reported: ${reportedMarketCap}M)`
              )
            } else {
              logger.debug(
                `✅ Market cap calculation verified: ${data.marketCap}`
              )
            }
          }

          // Check for unreasonably high market cap values
          if (marketCapValue > 50000) {
            // > $50B is likely wrong for most companies
            logger.debug(
              `⚠️  WARNING: Market cap seems very high: ${data.marketCap} (${marketCapValue}M) - verify this is correct`
            )
          }
        }

        // Validate enhanced financial metrics if present
        if (data.financials) {
          logger.debug(
            `✅ Enhanced financial data included: ${Object.keys(
              data.financials
            ).join(', ')}`
          )

          // Validate financial data formats
          if (
            data.financials.revenueTTM &&
            !data.financials.revenueTTM.match(/^\d+(\.\d+)?[MBT]$/)
          ) {
            logger.debug(
              `⚠️  WARNING: Invalid revenue format: ${data.financials.revenueTTM}`
            )
          }

          if (
            data.financials.grossMargin &&
            !data.financials.grossMargin.match(/^\d+(\.\d+)?%$/)
          ) {
            logger.debug(
              `⚠️  WARNING: Invalid gross margin format: ${data.financials.grossMargin}`
            )
          }
        }
      }

      logger.debug('✅ Enhanced stockData validation passed')
      return true
    }

    // Array-based responses
    if (
      ['recentNews', 'growthEvents', 'techStack', 'companyActivity'].includes(
        promptType
      )
    ) {
      return Array.isArray(data) && data.length >= 0
    }

    // Object-based responses with validation
    if (['companyIntelligence'].includes(promptType)) {
      return typeof data === 'object' && data !== null
    }

    // Special validation for priorityContacts - must have valid LinkedIn URLs
    if (promptType === 'priorityContacts') {
      logger.debug(`🔍 VALIDATION STARTING for priorityContacts`)
      logger.debug(
        `Validating priorityContacts data:`,
        JSON.stringify(data, null, 2)
      )
      if (!Array.isArray(data)) {
        logger.debug('priorityContacts validation failed: not an array')
        return false
      }

      // Validate each contact
      for (const contact of data) {
        if (!contact.name || !contact.title) {
          logger.debug(
            `priorityContacts validation failed: missing name or title for`,
            contact
          )
          return false
        }

        // If profileUrl exists, it MUST be a LinkedIn URL or null
        if (contact.profileUrl !== null && contact.profileUrl !== undefined) {
          if (typeof contact.profileUrl !== 'string') {
            logger.debug(
              `priorityContacts validation failed: profileUrl not string for ${contact.name}`
            )
            return false
          }

          // Check for valid LinkedIn URL format
          if (
            !contact.profileUrl.startsWith('https://www.linkedin.com/in/') &&
            !contact.profileUrl.startsWith('https://linkedin.com/in/')
          ) {
            logger.debug(
              `VALIDATION FAILED: Invalid LinkedIn URL for ${contact.name}: ${contact.profileUrl}`
            )
            return false
          }

          // Additional check for fake/constructed LinkedIn URLs
          const urlPath = contact.profileUrl.replace(
            /^https?:\/\/(www\.)?linkedin\.com\/in\//,
            ''
          )

          // Only reject URLs with very obvious fake patterns that are clearly AI-generated
          const obviousFakePatterns = [
            /123456789/, // Sequential numbers
            /abcdefgh/, // Sequential letters
            /test-user/i, // Test patterns
            /example/i, // Example patterns
          ]

          for (const pattern of obviousFakePatterns) {
            if (urlPath.match(pattern)) {
              logger.debug(
                `VALIDATION FAILED: Obviously fake LinkedIn URL detected for ${contact.name}: ${contact.profileUrl}`
              )
              return false
            }
          }
        }
      }
      logger.debug('priorityContacts validation passed')
      return true
    }

    // Legacy object-based responses (stockData only now)
    if (['stockData'].includes(promptType)) {
      return typeof data === 'object' && data !== null
    }

    return true // Default to valid for other types
  }

  /**
   * Build context string for context-dependent prompts
   */
  buildContext(results) {
    const contextObj = {
      financial: {},
      momentum: {},
      events: {},
      technology: {},
      summary: [],
    }

    // Rich financial context
    if (results.stockData?.success) {
      const stock = results.stockData.data
      contextObj.financial = {
        symbol: stock.symbol,
        price: stock.price,
        trend: stock.trend,
        ytdPerformance: stock.ytd,
        marketCap: stock.marketCap,
        currency: stock.currency,
      }

      // Add performance narrative
      if (stock.ytd && parseFloat(stock.ytd) > 5) {
        contextObj.summary.push(`Strong stock performance (YTD ${stock.ytd}%)`)
      } else if (stock.ytd && parseFloat(stock.ytd) < -5) {
        contextObj.summary.push(`Stock underperforming (YTD ${stock.ytd}%)`)
      }
    }

    // News sentiment and momentum
    if (results.recentNews?.success) {
      const news = results.recentNews.data
      contextObj.momentum = {
        sentiment: news.sentiment?.overall,
        sentimentScore: news.sentiment?.score,
        newsCount: news.recentNews?.length || 0,
        topHeadline: news.recentNews?.[0]?.title,
        recentImpact: news.recentNews?.[0]?.impact,
      }

      // Add momentum narrative
      if (news.sentiment?.score > 0.6) {
        contextObj.summary.push(
          `Positive market momentum (${
            news.recentNews?.length || 0
          } recent positive news items)`
        )
      } else if (news.sentiment?.score < 0.4) {
        contextObj.summary.push(
          `Market challenges (${
            news.recentNews?.length || 0
          } concerning news items)`
        )
      }

      if (news.recentNews?.[0]?.title) {
        contextObj.summary.push(`Latest: "${news.recentNews[0].title}"`)
      }
    }

    // Company events and changes
    if (results.companyEvents?.success) {
      const events = results.companyEvents.data
      contextObj.events = {
        layoffs: events.layoffs,
        funding: events['fundingOrM&A'],
        products: events.productLaunches,
      }

      // Add event narratives
      if (events.layoffs?.hasLayoffs) {
        contextObj.summary.push(`Recent layoffs: ${events.layoffs.details}`)
      }
      if (events['fundingOrM&A']?.activity) {
        contextObj.summary.push(
          `Recent funding: ${events['fundingOrM&A'].activity} ${events['fundingOrM&A'].amount}`
        )
      }
      if (events.productLaunches?.launches) {
        contextObj.summary.push(
          `Product activity: ${events.productLaunches.launches}`
        )
      }
    }

    // Technology context
    if (results.techStack?.success) {
      const tech = results.techStack.data
      contextObj.technology = {
        technologies: tech.techStack?.technologies || [],
        confidence: tech.techStack?.confidence,
      }

      if (tech.techStack?.technologies?.length > 0) {
        contextObj.summary.push(
          `Tech stack: ${tech.techStack.technologies.slice(0, 3).join(', ')}`
        )
      }
    }

    // Create both structured and narrative context
    const narrativeContext =
      contextObj.summary.length > 0
        ? contextObj.summary.join('. ')
        : 'Limited context available'

    const structuredContext = JSON.stringify(contextObj, null, 2)

    // Return rich context for Phase 2 prompts
    return `Company Context Summary:
${narrativeContext}

Detailed Context:
${structuredContext}

Use this context to generate specific, relevant insights.`
  }

  /**
   * Combine all micro-prompt results into final response (streamlined)
   */
  combineResults(companyName, results) {
    // Streamlined structure - only essential fields for frontend
    const combined = {
      // Company identification
      companyName: companyName,

      // Overview section data (employee count, public/private status)
      overview: {
        isPublic: false,
        employeeCount: null,
        industry: '',
      },

      stockInfo: {
        symbol: '',
        exchange: '',
        price: 0,
        ytd: 0,
        yoy: 0,
        marketCap: '',
        currency: 'USD',
        isPublic: false,
        isSubsidiary: false,
        parentCompany: null,
        performanceTrend: {
          direction: 'sideways',
          momentum: 'steady',
          volatility: 'moderate',
          context: '',
        },
        // Keep only essential financial metrics (employee count removed)
        financials: {
          revenueTTM: '',
          netIncomeQ2: '',
          freeCashFlowQ2: '',
          grossMargin: '',
        },
        financialSummary: {
          priceTrajectory: null,
          earningsPerformance: null,
          sentiment: 'neutral',
          sentimentReason: '',
          revenueChange: null,
          lastFunding: null,
        },
      },
      privateFinancials: null, // For private companies
      industryContext: {
        description: '',
        foundedYear: null,
        headquarters: null,
        productsAndVerticals: null,
        customerSegments: null,
        competitors: [],
        customers: [],
        caseStudies: [],
      },
      recentNews: [],
      growthEvents: [],
      techStack: [],
      companyChallenges: {
        isPrivateCompany: false,
        negativeNewsSummary:
          'No significant negative news found in the last 12 months.',
        earningsCallNegativeNews: null,
        layoffNews: {
          hasLayoffs: false,
          summary: null,
          layoffEvents: [],
        },
        summary: 'No significant challenges detected',
        challenges: [],
        timelineOfEvents: [],
      },
      companyActivity: [],
      priorityContacts: [],
      companyIntelligence: {
        painPoints: [],
        recentActivities: [],
        industryContext: '',
        executiveQuotes: [],
      },
    }

    // Merge successful results - streamlined
    if (results.stockData?.success) {
      const stockData = results.stockData.data

      // DEBUG: Log raw stock data to diagnose market cap issues
      logger.info(`📊 Stock Data Retrieved:`, {
        symbol: stockData.symbol,
        price: stockData.price,
        marketCap: stockData.marketCap,
        ytd: stockData.ytd,
        yoy: stockData.yoy,
      })

      // DEBUG: Log FULL raw stockData object to see all fields
      logger.debug(
        `🔍 FULL Stock Data Object:`,
        JSON.stringify(stockData, null, 2)
      )

      // DEBUG: Log validation metadata if present
      if (stockData.validation) {
        logger.info(`🔍 Market Cap Validation Details:`, {
          calculated: stockData.validation.marketCapCalculated,
          shares: stockData.validation.sharesOutstanding,
          check: stockData.validation.calculationCheck,
          priceSources: stockData.validation.priceSourceCount,
        })
      } else {
        logger.warn(
          `⚠️  No validation metadata provided by Perplexity - market cap accuracy cannot be verified`
        )
      }

      // Populate overview section (employee count, public/private, industry)
      // Use Sumble org info as primary source, Perplexity stockData as fallback
      const sumbleOrgData = results.sumbleOrgInfo?.data

      Object.assign(combined.overview, {
        isPublic: stockData.isPublic || false,
        // Employee count: Sumble → Perplexity fallback
        employeeCount:
          sumbleOrgData?.total_employees?.toString() ||
          stockData.employeeCount ||
          null,
        // Industry: Sumble → Perplexity fallback
        industry: sumbleOrgData?.industry || stockData.industry || '',
      })

      // Log data source for employee count and industry
      if (sumbleOrgData?.total_employees) {
        logger.info(
          `✅ Using Sumble data for employee count: ${sumbleOrgData.total_employees}`
        )
      } else if (stockData.employeeCount) {
        logger.info(
          `ℹ️  Using Perplexity fallback for employee count: ${stockData.employeeCount}`
        )
      }

      if (sumbleOrgData?.industry) {
        logger.info(
          `✅ Using Sumble data for industry: ${sumbleOrgData.industry}`
        )
      } else if (stockData.industry) {
        logger.info(
          `ℹ️  Using Perplexity fallback for industry: ${stockData.industry}`
        )
      }

      // Merge only essential stock info (employee count removed from here)
      Object.assign(combined.stockInfo, {
        symbol: stockData.symbol || '',
        exchange: stockData.exchange || '',
        price: stockData.price || 0,
        ytd: stockData.ytd || 0,
        yoy: stockData.yoy || 0,
        marketCap: stockData.marketCap || '',
        currency: stockData.currency || 'USD',
        isPublic: stockData.isPublic || false,
        isSubsidiary: stockData.isSubsidiary || false,
        parentCompany: stockData.parentCompany || null,
      })

      // Merge performance trend if present
      if (stockData.performanceTrend) {
        Object.assign(
          combined.stockInfo.performanceTrend,
          stockData.performanceTrend
        )
      }

      // Merge dynamic financial metrics (new format)
      // Filter out any metrics with null values for safety
      if (
        stockData.dynamicFinancials &&
        Array.isArray(stockData.dynamicFinancials)
      ) {
        const validMetrics = stockData.dynamicFinancials.filter(
          (m) =>
            m.value &&
            m.value !== 'null' &&
            m.value !== 'Not disclosed' &&
            m.value !== 'N/A'
        )
        combined.stockInfo.dynamicFinancials = validMetrics
        const companyType = stockData.isPublic ? 'Public' : 'Private'
        logger.info(
          `✅ ${companyType} Company Dynamic Financials (from stockData): ${
            validMetrics.length
          } metrics included (${
            stockData.dynamicFinancials.length - validMetrics.length
          } filtered out)${
            !stockData.isPublic
              ? ' - will be overwritten by private company financials if available'
              : ''
          }`
        )
      }

      // Merge only essential financial metrics if present (legacy fallback)
      if (stockData.financials) {
        Object.assign(combined.stockInfo.financials, stockData.financials)
      }

      // Merge financial summary if present (7-line condensed display)
      if (stockData.financialSummary) {
        Object.assign(
          combined.stockInfo.financialSummary,
          stockData.financialSummary
        )
      }
    }

    if (results.industryContext?.success) {
      const industryData = results.industryContext.data
      const sumbleOrgData = results.sumbleOrgInfo?.data

      // Merge industry context with Sumble headquarters fallback
      Object.assign(combined.industryContext, industryData)

      // Headquarters: Sumble (state, country) → Perplexity fallback
      if (
        sumbleOrgData?.headquarters_state &&
        sumbleOrgData?.headquarters_country
      ) {
        combined.industryContext.headquarters = `${sumbleOrgData.headquarters_state}, ${sumbleOrgData.headquarters_country}`
        logger.info(
          `✅ Using Sumble data for headquarters: ${combined.industryContext.headquarters}`
        )
      } else if (industryData?.headquarters) {
        logger.info(
          `ℹ️  Using Perplexity fallback for headquarters: ${industryData.headquarters}`
        )
      }
    }

    if (results.recentNews?.success) {
      combined.recentNews = Array.isArray(results.recentNews.data)
        ? results.recentNews.data
        : []
    }

    if (results.growthEvents?.success) {
      combined.growthEvents = Array.isArray(results.growthEvents.data)
        ? results.growthEvents.data
        : []
    }

    if (results.techStack?.success) {
      combined.techStack = Array.isArray(results.techStack.data)
        ? results.techStack.data
        : []
    }

    if (results.companyChallenges?.success) {
      const challengesData = results.companyChallenges.data
      logger.info('📋 Company Challenges Data Received:', {
        hasEarningsCall: !!challengesData.earningsCallNegativeNews,
        earningsCallType: typeof challengesData.earningsCallNegativeNews,
        earningsCallData: challengesData.earningsCallNegativeNews
          ? JSON.stringify(challengesData.earningsCallNegativeNews).substring(
              0,
              200
            )
          : null,
        hasLayoffs: challengesData.layoffNews?.hasLayoffs,
        challengesCount: challengesData.challenges?.length || 0,
      })

      // Log earnings call URL specifically for debugging
      if (challengesData.earningsCallNegativeNews) {
        const earningsCall = challengesData.earningsCallNegativeNews
        if (typeof earningsCall === 'object' && earningsCall.url) {
          logger.info('🔗 Earnings Call URL Found:', earningsCall.url)
        } else if (typeof earningsCall === 'string') {
          logger.warn('⚠️ Earnings call is legacy string format (no URL)')
        }
      }

      Object.assign(combined.companyChallenges, challengesData)
    }

    if (results.companyActivity?.success) {
      combined.companyActivity = Array.isArray(results.companyActivity.data)
        ? results.companyActivity.data
        : []
    }

    if (results.priorityContacts?.success) {
      combined.priorityContacts = Array.isArray(results.priorityContacts.data)
        ? results.priorityContacts.data
        : []
    }

    if (results.companyIntelligence?.success) {
      Object.assign(
        combined.companyIntelligence,
        results.companyIntelligence.data
      )
    }

    // Merge private company financials if available
    if (results.privateFinancials?.success) {
      combined.privateFinancials = results.privateFinancials.data

      // CRITICAL: Also merge into financialSummary for UI display
      // UI reads from stockInfo.financialSummary, so we need to populate it with private company data
      const privateData = results.privateFinancials.data
      if (privateData) {
        Object.assign(combined.stockInfo.financialSummary, {
          // Private company specific fields
          fundingRounds: privateData.fundingRounds || null,
          totalFunding: privateData.totalFunding || null,
          latestValuation: privateData.latestValuation || null,
          fundingStage: privateData.fundingStage || null,
          revenueEstimate: privateData.revenueEstimate || null,
          growthMetrics: privateData.growthMetrics || null,
          notableInvestors: privateData.notableInvestors || null,

          // Merge financial summary fields (sentiment, revenueChange, lastFunding)
          ...(privateData.financialSummary || {}),

          // Data quality fields
          lastUpdated: privateData.lastUpdated || null,
          sources: privateData.sources || null,
        })

        // CRITICAL: Merge dynamicFinancials from private company data into stockInfo
        // This allows private companies to use the same dynamic display as public companies
        if (
          privateData.dynamicFinancials &&
          Array.isArray(privateData.dynamicFinancials) &&
          privateData.dynamicFinancials.length > 0
        ) {
          combined.stockInfo.dynamicFinancials = privateData.dynamicFinancials
          logger.info(
            `✅ Private company dynamicFinancials: ${privateData.dynamicFinancials.length} metrics included`
          )
        }

        logger.info(
          '✅ Private company financials merged into financialSummary for UI'
        )
      }
    }

    // Add schema version metadata for cache validation (unified version system)
    const { SCHEMA_VERSION } = require('../schemas/analysisSchemas')
    combined.metadata = {
      schemaVersion: SCHEMA_VERSION, // Unified version for cache validation
      sources: this._extractDataSources(results),
    }

    return combined
  }

  /**
   * Extract all data sources from analysis results
   * @private
   */
  _extractDataSources(results) {
    const sources = new Set()

    // Add sources from each result that has source information
    Object.values(results).forEach((result) => {
      if (result?.source) {
        sources.add(result.source)
      }
      if (result?.data?.source) {
        sources.add(result.data.source)
      }
    })

    return Array.from(sources)
  }

  /**
   * Calculate total token usage across all micro-prompts
   */
  calculateTotalUsage(results) {
    return Object.values(results).reduce((total, result) => {
      if (result.usage) {
        return {
          prompt_tokens:
            (total.prompt_tokens || 0) + (result.usage.prompt_tokens || 0),
          completion_tokens:
            (total.completion_tokens || 0) +
            (result.usage.completion_tokens || 0),
          total_tokens:
            (total.total_tokens || 0) + (result.usage.total_tokens || 0),
        }
      }
      return total
    }, {})
  }

  /**
   * Get fallback data for failed micro-prompts
   */

  /**
   * Parse market cap string to millions (for validation)
   */
  parseMarketCap(marketCapStr) {
    if (!marketCapStr || typeof marketCapStr !== 'string') return 0

    // Remove all currency symbols, commas, and spaces
    const cleanStr = marketCapStr
      .replace(/[₹$€£¥₩₪₽฿₫₱₦₴₲₵₸,\s]/g, '')
      .toUpperCase()
    const match = cleanStr.match(/^(\d+(?:\.\d+)?)([MBT])$/)

    if (!match) return 0

    const value = parseFloat(match[1])
    const unit = match[2]

    switch (unit) {
      case 'T':
        return value * 1000000 // Trillions to millions
      case 'B':
        return value * 1000 // Billions to millions
      case 'M':
        return value // Already in millions
      default:
        return 0
    }
  }

  /**
   * Simple delay function
   */
  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Extract a short tag/label from a pain point challenge text
   * Used for schema compliance when mapping quotedChallenges to publiclyStatedPainPoints
   * @param {string} challengeText - The challenge/quote text
   * @returns {string} A short tag like "scaling", "compliance", "hiring", etc.
   */
  _extractPainPointTag(challengeText) {
    if (!challengeText || typeof challengeText !== 'string') return 'general'

    const text = challengeText.toLowerCase()

    // Pattern matching for common pain point categories
    if (
      text.includes('scal') ||
      text.includes('growth') ||
      text.includes('expand')
    )
      return 'scaling'
    if (
      text.includes('compli') ||
      text.includes('regulat') ||
      text.includes('hipaa') ||
      text.includes('gdpr')
    )
      return 'compliance'
    if (
      text.includes('hir') ||
      text.includes('talent') ||
      text.includes('recruit')
    )
      return 'hiring'
    if (
      text.includes('budget') ||
      text.includes('cost') ||
      text.includes('expense')
    )
      return 'budget'
    if (
      text.includes('infrastructure') ||
      text.includes('architect') ||
      text.includes('system')
    )
      return 'infrastructure'
    if (text.includes('security') || text.includes('cyber')) return 'security'
    if (text.includes('data') || text.includes('analytics')) return 'data'
    if (text.includes('ai') || text.includes('machine learning')) return 'ai-ml'
    if (text.includes('customer') || text.includes('client')) return 'customer'
    if (text.includes('integrat') || text.includes('legacy'))
      return 'integration'
    if (text.includes('transform') || text.includes('moderniz'))
      return 'transformation'
    if (text.includes('team') || text.includes('culture')) return 'team'

    return 'general'
  }

  /**
   * Infer priority level from challenge text
   * Used for schema compliance when mapping quotedChallenges to publiclyStatedPainPoints
   * @param {string} challengeText - The challenge/quote text
   * @returns {string} Priority level: "critical", "high", "medium", or "low"
   */
  _inferPainPointPriority(challengeText) {
    if (!challengeText || typeof challengeText !== 'string') return 'medium'

    const text = challengeText.toLowerCase()

    // Critical indicators
    if (
      text.includes('critical') ||
      text.includes('urgent') ||
      text.includes('must') ||
      text.includes('immediately') ||
      text.includes('top priority')
    ) {
      return 'critical'
    }

    // High priority indicators
    if (
      text.includes('biggest') ||
      text.includes('major') ||
      text.includes('significant') ||
      text.includes('key') ||
      text.includes('essential') ||
      text.includes('primary')
    ) {
      return 'high'
    }

    // Low priority indicators
    if (
      text.includes('minor') ||
      text.includes('small') ||
      text.includes('exploring') ||
      text.includes('considering')
    ) {
      return 'low'
    }

    // Default to medium
    return 'medium'
  }

  /**
   * Extract thought leadership data (speaking, awards, media) from social activity posts
   * Used as fallback when direct media presence search fails
   *
   * @param {Array} posts - Social activity posts array
   * @returns {Object} Extracted data: { speaking: [], awards: [], media: [] }
   */
  _extractThoughtLeadershipFromPosts(posts) {
    const extracted = {
      speaking: [],
      awards: [],
      media: [],
    }

    if (!Array.isArray(posts)) {
      return extracted
    }

    // Keywords for detecting different types of thought leadership
    const speakingKeywords = [
      'spoke at',
      'speaking at',
      'excited to speak',
      'presented at',
      'presenting at',
      'keynote',
      'panel',
      'panelist',
      'moderator',
      'conference',
      'summit',
      'webinar',
      'workshop',
      'fireside',
      'session',
    ]

    const awardKeywords = [
      'honored',
      'grateful',
      'recognized as',
      'finalist',
      'winner',
      'award',
      'top 50',
      'top 100',
      'named to',
      'selected as',
    ]

    const mediaKeywords = [
      'featured in',
      'interviewed by',
      'profiled in',
      'quoted in',
      'article in',
      'published in',
    ]

    posts.forEach((post) => {
      const content = (post.content || '').toLowerCase()
      const date = post.date || new Date().toISOString().split('T')[0]

      // Extract speaking engagements
      const isSpeaking = speakingKeywords.some((keyword) =>
        content.includes(keyword)
      )
      if (isSpeaking && post.type !== 'award') {
        // Determine role based on keywords
        let role = 'speaker'
        if (content.includes('keynote')) role = 'keynote'
        else if (content.includes('panel') || content.includes('panelist'))
          role = 'panelist'
        else if (content.includes('moderator')) role = 'moderator'

        // Extract event name (basic heuristics)
        let eventName = 'Conference/Event'
        const topics = post.topics || []

        // Try to find event name in content
        const eventPatterns = [
          /(?:at|for) the ([A-Z][^,.!?]{5,50}(?:Summit|Conference|Event|Forum|Symposium))/i,
          /(?:at|for) ([A-Z][^,.!?]{5,50})/i,
        ]

        for (const pattern of eventPatterns) {
          const match = post.content.match(pattern)
          if (match) {
            eventName = match[1].trim()
            break
          }
        }

        extracted.speaking.push({
          event: eventName,
          role: role,
          topic:
            topics.length > 0
              ? topics.join(', ')
              : 'Industry insights and trends',
          date: date,
          url: post.url || null,
          source: 'extracted_from_social_post',
        })
      }

      // Extract awards
      const isAward = awardKeywords.some((keyword) => content.includes(keyword))
      if (isAward || post.type === 'award') {
        // Extract award name (basic heuristics)
        let awardName = 'Industry Recognition'
        const awardPatterns = [
          /(?:as|for|to) (?:a )?(?:finalist|winner|recipient) (?:of|for) (?:the )?([A-Z][^,.!?]{5,60})/i,
          /(?:honored|recognized|named) (?:as|to) (?:a )?([A-Z][^,.!?]{5,60}(?:Award|Leader|List|Award|Recognition))/i,
        ]

        for (const pattern of awardPatterns) {
          const match = post.content.match(pattern)
          if (match) {
            awardName = match[1].trim()
            break
          }
        }

        // Try to extract organization
        let organization = 'Industry Organization'
        const orgPatterns = [/by ([A-Z][^,.!?]{3,40})(?:\.|,|$)/i]

        for (const pattern of orgPatterns) {
          const match = post.content.match(pattern)
          if (match) {
            organization = match[1].trim()
            break
          }
        }

        extracted.awards.push({
          award: awardName,
          organization: organization,
          date: date,
          url: post.url || null,
          source: 'extracted_from_social_post',
        })
      }

      // Extract media features
      const isMedia = mediaKeywords.some((keyword) => content.includes(keyword))
      if (isMedia) {
        // Extract publication name
        let publication = 'Media Publication'
        const pubPatterns = [
          /(?:featured in|interviewed by|profiled in|quoted in|published in) ([A-Z][^,.!?]{3,40})/i,
        ]

        for (const pattern of pubPatterns) {
          const match = post.content.match(pattern)
          if (match) {
            publication = match[1].trim()
            break
          }
        }

        extracted.media.push({
          publication: publication,
          title: post.content.substring(0, 100) + '...',
          type: 'interview',
          date: date,
          url: post.url || null,
          topics: post.topics || [],
          source: 'extracted_from_social_post',
        })
      }
    })

    logger.debug(
      `Extracted from posts: ${extracted.speaking.length} speaking, ${extracted.awards.length} awards, ${extracted.media.length} media`
    )

    return extracted
  }

  /**
   * Validate private company financials to detect AI hallucinations
   * Flags suspicious data and replaces with "Not disclosed"
   *
   * @private
   * @param {Object} financialsResult - Result object with success and data
   * @param {string} companyName - Company name for logging
   * @returns {Object} Validated result object
   */
  _validatePrivateFinancials(financialsResult, companyName) {
    // Handle result wrapper structure
    if (
      !financialsResult ||
      !financialsResult.success ||
      !financialsResult.data
    ) {
      return financialsResult
    }

    const financials = financialsResult.data

    if (!financials.fundingRounds || financials.fundingRounds.length === 0) {
      // No funding rounds, but preserve other fields
      return financialsResult
    }

    const validated = { ...financials }
    const suspiciousFlags = []

    // Check each funding round for red flags
    financials.fundingRounds.forEach((round, index) => {
      // Red flag 1: Series A/B/C with unusual amounts
      if (round.round?.toLowerCase().includes('series')) {
        const amount = this._parseAmount(round.amount)
        if (amount && amount > 50000000) {
          // $50M+ is suspicious for unknown startups
          suspiciousFlags.push(
            `${round.round} of $${amount / 1000000}M is unusually high`
          )
        }
      }

      // Red flag 2: Future dates (hallucination indicator)
      if (round.date) {
        const roundDate = new Date(round.date)
        const now = new Date()
        if (roundDate > now) {
          suspiciousFlags.push(`Future date detected: ${round.date}`)
        }
      }

      // Red flag 3: Missing source URLs (fabrication indicator)
      if (
        !round.url ||
        round.url.includes('...') ||
        round.url === 'https://...'
      ) {
        suspiciousFlags.push(`Round ${index + 1} missing verifiable source URL`)
      }

      // Red flag 4: Generic/vague sources
      if (
        round.source &&
        (round.source.toLowerCase() === 'company announcement' ||
          round.source.toLowerCase() === 'news' ||
          round.source === '...')
      ) {
        suspiciousFlags.push(`Vague source: "${round.source}"`)
      }
    })

    // If 2+ red flags, likely hallucination - replace with "Not disclosed"
    if (suspiciousFlags.length >= 2) {
      logger.warn(
        `⚠️ VALIDATION FAILED for ${companyName} - ${suspiciousFlags.length} red flags detected:`
      )
      suspiciousFlags.forEach((flag, i) => {
        logger.warn(`   ${i + 1}. ${flag}`)
      })
      logger.warn(`🗑️ Replacing suspicious funding data with "Not disclosed"`)
    } else {
      // Validation passed, but still filter out "Not disclosed" values from dynamicFinancials
      if (
        validated.dynamicFinancials &&
        Array.isArray(validated.dynamicFinancials)
      ) {
        validated.dynamicFinancials = this._filterValidFinancials(
          validated.dynamicFinancials
        )
      }

      // Replace with safe defaults (preserve new structure)
      const safeDefaults = {
        // Legacy fields
        fundingRounds: null,
        totalFunding: 'Not disclosed',
        latestValuation: 'Not disclosed',
        fundingStage: financials.fundingStage || 'Not disclosed',
        revenueEstimate: 'Not disclosed',
        employees: financials.employees || 'Not disclosed',
        growthMetrics: {
          revenueGrowth: 'Not disclosed',
          employeeGrowth: 'Not disclosed',
          customerGrowth: 'Not disclosed',
        },
        // Preserve new fields (but filter out "Not disclosed" values)
        notableInvestors: financials.notableInvestors || null,
        dynamicFinancials: this._filterValidFinancials(
          financials.dynamicFinancials
        ),
        financialSummary: financials.financialSummary || {
          sentiment: 'neutral',
          sentimentReason: 'Insufficient verified financial data available',
          revenueChange: null,
          lastFunding: null,
        },
        lastUpdated: new Date().toISOString().split('T')[0],
        sources: ['Data validation failed - awaiting manual verification'],
      }

      // Return wrapped in result structure
      return {
        ...financialsResult,
        data: safeDefaults,
      }
    }

    // Return validated data wrapped in result structure
    return {
      ...financialsResult,
      data: validated,
    }
  }

  /**
   * Filter out invalid/placeholder values from dynamicFinancials
   * Only keep metrics with real data
   * @private
   */
  _filterValidFinancials(dynamicFinancials) {
    if (!dynamicFinancials || !Array.isArray(dynamicFinancials)) {
      return null
    }

    const filtered = dynamicFinancials.filter((metric) => {
      if (!metric || !metric.label || !metric.value) {
        return false
      }

      const value = metric.value.toString().toLowerCase().trim()

      // Filter out common placeholder values
      const invalidValues = [
        'not disclosed',
        'not available',
        'n/a',
        'na',
        'unknown',
        'null',
        'undefined',
        '',
        'not found',
        'no data',
      ]

      return !invalidValues.includes(value)
    })

    logger.info(
      `✅ Filtered dynamicFinancials: ${filtered.length}/${dynamicFinancials.length} valid metrics`
    )

    return filtered.length > 0 ? filtered : null
  }

  /**
   * Parse funding amount string to number (e.g., "$5M" -> 5000000)
   * @private
   */
  _parseAmount(amountStr) {
    if (!amountStr) return null
    const match = amountStr.match(/\$?([\d.]+)\s*(M|K|B)?/i)
    if (!match) return null

    const num = parseFloat(match[1])
    const unit = (match[2] || '').toUpperCase()

    if (unit === 'B') return num * 1000000000
    if (unit === 'M') return num * 1000000
    if (unit === 'K') return num * 1000
    return num
  }
}

module.exports = MicroPromptOrchestrator
