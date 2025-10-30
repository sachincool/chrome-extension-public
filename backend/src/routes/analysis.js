/**
 * Analysis Routes - Company and Person Analysis
 */

const express = require('express')
const router = express.Router()
const config = require('../config')
const { perplexityService, cacheService } = require('../services')
const supabaseService = require('../services/supabaseService')
const {
  validateCompanyAnalysis,
  validatePersonAnalysis,
  rateLimitAnonymous,
  getRateLimitStats,
} = require('../middleware')
const { optionalAuth } = require('../middleware/auth')
const { Logger } = require('../utils/logger')
const { handleAnalysisError } = require('./errorHandler')

const logger = new Logger('AnalysisRoute')

/**
 * Analyze company endpoint - MVP format
 * Rate limited for anonymous users to prevent abuse
 */
router.post(
  '/company',
  optionalAuth,
  rateLimitAnonymous,
  validateCompanyAnalysis,
  async (req, res) => {
    const { companyName, companyUrl } = req.body
    const requestId = req.requestId

    try {
      logger.info(`[${requestId}] 🏢 Company analysis request: ${companyName}`)

      // ⚠️ LIMIT ENFORCEMENT: Check if authenticated user has exceeded their limit
      if (req.user && supabaseService.isConfigured()) {
        try {
          const hasExceeded = await supabaseService.hasExceededLimit(
            req.user.id
          )
          if (hasExceeded) {
            const subscription = await supabaseService.getUserSubscription(
              req.user.id
            )
            const usage = await supabaseService.getMonthlyUsage(req.user.id)

            logger.warn(
              `[${requestId}] 🚫 User ${req.user.id} exceeded limit: ${usage.total_credits}/${subscription.analyses_limit}`
            )

            return res.status(429).json({
              success: false,
              error: `Monthly analysis limit exceeded. You've used ${usage.total_credits} of ${subscription.analyses_limit} unique entities this month. Revisits are free. Upgrade your plan for more analyses.`,
              usage: {
                analysesUsed: usage.total_credits, // ✅ Use total_credits (unique entities charged)
                analysesLimit: subscription.analyses_limit,
                planType: subscription.plan_type,
              },
              requestId,
            })
          }
        } catch (limitError) {
          logger.warn(
            `[${requestId}] Could not check user limit, allowing request:`,
            limitError.message
          )
          // Continue anyway - don't block users if limit check fails
        }
      }

      // Check two-tier cache (L1 memory + L2 database) - UNIFIED CACHE SYSTEM
      // All users (authenticated + anonymous) use the same cache keyed by company name
      // Works for ALL users (authenticated + anonymous) - cache is keyed by company name, not user_id
      const cacheKey = cacheService.generateCompanyKey(companyName)
      const cachedResult = await cacheService.get(cacheKey)

      if (cachedResult) {
        // ✅ CACHE VALIDATION: Verify cached data with comprehensive schema validation
        const validation = cacheService.validateCompanyCache(cachedResult)

        if (!validation.valid) {
          logger.warn(
            `[${requestId}] ⚠️  Cache validation failed for company: ${companyName}`
          )
          logger.warn(
            `[${requestId}]   Schema version: ${
              validation.schemaVersion
            }, Errors: ${validation.errors.join(', ')}`
          )
          logger.warn(
            `[${requestId}]   Cached data has schemaVersion: ${
              cachedResult?.metadata?.schemaVersion
            }, expected: ${
              require('../schemas/analysisSchemas').SCHEMA_VERSION
            }`
          )

          // Delete invalid cache from all sources (L1 + L2 + usage_logs references)
          await cacheService.deleteFromAllSources(cacheKey)
          logger.info(
            `[${requestId}] 🗑️  Invalid cache cleared from all sources, will fetch fresh data from APIs`
          )
          // Flow continues to fresh analysis below (no return/break here)
          // cachedResult is ignored, new analysis will be triggered
        } else {
          logger.info(
            `[${requestId}] 💾 Cache hit (schema validated) for company: ${companyName}`
          )

          // Determine if user should be charged (Pay Once Per Entity)
          let creditsToCharge = 1 // Default: charge for authenticated users
          let chargeReason = 'first_time_cache_hit'

          if (req.user && supabaseService.isConfigured()) {
            // Check if user has analyzed this entity before
            const hasSeenBefore = await supabaseService.hasUserAnalyzedBefore(
              req.user.id,
              cacheKey
            )

            if (hasSeenBefore) {
              creditsToCharge = 0 // Free for returning users
              chargeReason = 'previously_analyzed'
              logger.info(
                `[${requestId}] 🎁 User has analyzed "${companyName}" before - FREE (0 credits)`
              )
            } else {
              creditsToCharge = 1 // First time for this user
              chargeReason = 'first_time_cache_hit'
              logger.info(
                `[${requestId}] 💵 User's first time analyzing "${companyName}" - CHARGE (1 credit)`
              )
            }
          }

          // Log cache hit with determined credits
          let usageData = null
          if (req.user && supabaseService.isConfigured()) {
            try {
              await supabaseService.logUsage(req.user.id, {
                analysis_type: 'company',
                company_name: companyName,
                linkedin_url: companyUrl,
                cache_key: cacheKey, // Reference to analysis_cache (v2)
                credits_used: creditsToCharge, // 0 if previously analyzed, 1 if first time
                from_cache: true,
                charge_reason: chargeReason, // Track why charged or not
                data_sources: cachedResult.metadata?.sources || [],
              })

              // Note: No need to increment monthly_usage manually
              // It's a VIEW that auto-aggregates SUM(credits_used) from usage_logs

              logger.info(
                `[${requestId}] 📊 Cache hit logged (${creditsToCharge} credit${
                  creditsToCharge !== 1 ? 's' : ''
                }) for user ${req.user.id}`
              )

              // Get updated usage to return to frontend
              const subscription = await supabaseService.getUserSubscription(
                req.user.id
              )
              const usage = await supabaseService.getMonthlyUsage(req.user.id)

              usageData = {
                analysesUsed: usage.total_credits, // ✅ Use total_credits (unique entities charged)
                analysesLimit: subscription.analyses_limit,
                analysesRemaining: Math.max(
                  0,
                  subscription.analyses_limit - usage.total_credits
                ), // ✅ Send calculated value
                planType: subscription.plan_type,
              }

              logger.info(
                `[${requestId}] 📤 Returning usage to frontend: used=${usageData.analysesUsed}, limit=${usageData.analysesLimit}, remaining=${usageData.analysesRemaining}, charged=${creditsToCharge}`
              )
            } catch (error) {
              logger.warn(
                `[${requestId}] Failed to log cache hit:`,
                error.message
              )
            }
          }

          logger.info(
            `[${requestId}] 📤 Final response: creditsCharged=${creditsToCharge}, chargeReason=${chargeReason}, usage=${JSON.stringify(
              usageData
            )}`
          )

          return res.json({
            success: true,
            data: cachedResult,
            cached: true,
            fromCache: true, // ✅ Frontend expects this field
            chargeReason: chargeReason, // Tell frontend if this was free (previously_analyzed)
            creditsCharged: creditsToCharge, // 0 or 1
            usage: usageData,
            requestId,
          })
        }
      }

      logger.debug(
        `[${requestId}] 🔍 Cache miss (L1 + L2) for company: ${companyName}`
      )

      // Check for pending requests to prevent race condition
      // cacheKey already declared above at line 166
      const pendingResult = await cacheService.waitForPendingRequest(cacheKey)

      if (pendingResult) {
        logger.info(
          `[${requestId}] ⏳ Waited for concurrent request, returning result for: ${companyName}`
        )

        // Determine if user should be charged (Pay Once Per Entity)
        let creditsToCharge = 1
        let chargeReason = 'concurrent_request'

        if (req.user && supabaseService.isConfigured()) {
          const hasSeenBefore = await supabaseService.hasUserAnalyzedBefore(
            req.user.id,
            cacheKey
          )

          if (hasSeenBefore) {
            creditsToCharge = 0
            chargeReason = 'previously_analyzed'
            logger.info(
              `[${requestId}] 🎁 User has analyzed "${companyName}" before - FREE (concurrent request)`
            )
          } else {
            creditsToCharge = 1
            chargeReason = 'concurrent_request'
            logger.info(
              `[${requestId}] 💵 User's first time analyzing "${companyName}" - CHARGE (concurrent request)`
            )
          }
        }

        // Check if we need to log usage for this user
        let usageData = null
        if (req.user && supabaseService.isConfigured()) {
          try {
            await supabaseService.logUsage(req.user.id, {
              analysis_type: 'company',
              company_name: companyName,
              linkedin_url: companyUrl,
              cache_key: cacheKey, // Reference to analysis_cache (v2)
              credits_used: creditsToCharge,
              from_cache: false, // Was freshly generated (by another request)
              charge_reason: chargeReason,
              data_sources: pendingResult.data.metadata?.sources || [],
            })

            // Note: No need to increment monthly_usage manually
            // It's a VIEW that auto-aggregates SUM(credits_used) from usage_logs

            const subscription = await supabaseService.getUserSubscription(
              req.user.id
            )
            const usage = await supabaseService.getMonthlyUsage(req.user.id)

            usageData = {
              analysesUsed: usage.total_credits, // ✅ Use total_credits (unique entities charged)
              analysesLimit: subscription.analyses_limit,
              analysesRemaining: Math.max(
                0,
                subscription.analyses_limit - usage.total_credits
              ), // ✅ Send calculated value
              planType: subscription.plan_type,
            }
          } catch (error) {
            logger.warn(
              `[${requestId}] Failed to log usage after deduplication:`,
              error.message
            )
          }
        }

        return res.json({
          success: true,
          data: pendingResult.data,
          cached: false,
          fromCache: creditsToCharge === 0, // ✅ Frontend: treat as cached if user wasn't charged
          deduplicated: true,
          chargeReason: chargeReason, // Tell frontend if this was free (previously_analyzed or concurrent_request)
          creditsCharged: creditsToCharge, // 0 or 1
          usage: usageData,
          requestId,
        })
      }

      logger.info(
        `[${requestId}] 🎯 Analyzing company with enhanced SDR intelligence: ${companyName}`
      )

      // Register this request as pending to prevent concurrent duplicates
      const analysisPromise =
        perplexityService.analyzeCompanyWithMicroPrompts(companyName)
      cacheService.registerPendingRequest(cacheKey, analysisPromise)

      let result
      try {
        // Perform enhanced micro-prompt analysis
        result = await analysisPromise
      } finally {
        // Always clear pending request, even if analysis fails
        cacheService.clearPendingRequest(cacheKey)
      }

      if (result.success) {
        // Save to two-tier cache (L1 memory + L2 database)
        await cacheService.set(cacheKey, result.data)
        logger.info(
          `[${requestId}] 💾 Saved company analysis to cache (L1 + L2): ${companyName}`
        )

        // Variables for charge tracking (used in response)
        let creditsToCharge = 1
        let chargeReason = 'fresh_analysis'

        // Log usage to database if user is authenticated
        // Check if user has analyzed this before (Pay Once Per Entity)
        let usageData = null
        if (req.user && supabaseService.isConfigured()) {
          try {
            // Determine if user should be charged (Pay Once Per Entity)
            const hasSeenBefore = await supabaseService.hasUserAnalyzedBefore(
              req.user.id,
              cacheKey
            )

            creditsToCharge = hasSeenBefore ? 0 : 1
            chargeReason = hasSeenBefore
              ? 'previously_analyzed'
              : 'fresh_analysis'

            if (hasSeenBefore) {
              logger.info(
                `[${requestId}] 🎁 User has analyzed "${companyName}" before - FREE (0 credits, fresh from API)`
              )
            } else {
              logger.info(
                `[${requestId}] 💵 User's first time analyzing "${companyName}" - CHARGE (1 credit)`
              )
            }

            await supabaseService.logUsage(req.user.id, {
              analysis_type: 'company',
              company_name: companyName,
              linkedin_url: companyUrl,
              cache_key: cacheKey, // Reference to analysis_cache (v2)
              credits_used: creditsToCharge, // 0 if previously analyzed, 1 if first time
              from_cache: false,
              charge_reason: chargeReason,
              data_sources: result.data.metadata?.sources || [],
            })

            // Note: No need to increment monthly_usage manually
            // It's a VIEW that auto-aggregates SUM(credits_used) from usage_logs

            logger.info(
              `[${requestId}] 📊 Usage logged (${creditsToCharge} credit${
                creditsToCharge !== 1 ? 's' : ''
              }) for user ${req.user.id}`
            )

            // Get updated usage to return to frontend
            const subscription = await supabaseService.getUserSubscription(
              req.user.id
            )
            const usage = await supabaseService.getMonthlyUsage(req.user.id)

            usageData = {
              analysesUsed: usage.total_credits, // ✅ Use total_credits (unique entities charged)
              analysesLimit: subscription.analyses_limit,
              analysesRemaining: Math.max(
                0,
                subscription.analyses_limit - usage.total_credits
              ), // ✅ Send calculated value
              planType: subscription.plan_type,
            }
          } catch (dbError) {
            logger.error(
              `[${requestId}] Failed to log usage to database:`,
              dbError.message
            )
            // Don't fail the request if database logging fails
          }
        } else {
          logger.info(
            `[${requestId}] ℹ️ Anonymous analysis - no usage tracking`
          )
        }

        logger.info(
          `[${requestId}] ✅ Enhanced SDR analysis completed: ${companyName}`
        )

        // DEBUG: Log earnings call data being sent to frontend
        if (result.data?.companyChallenges?.earningsCallNegativeNews) {
          const earningsCall =
            result.data.companyChallenges.earningsCallNegativeNews
          logger.info(`[${requestId}] 📊 Sending earnings call to frontend:`, {
            type: typeof earningsCall,
            hasUrl:
              typeof earningsCall === 'object' ? !!earningsCall.url : false,
            url:
              typeof earningsCall === 'object'
                ? earningsCall.url
                : 'string format',
            summaryLength:
              typeof earningsCall === 'string'
                ? earningsCall.length
                : earningsCall.summary?.length || 0,
          })
        }

        res.json({
          success: true,
          data: result.data,
          cached: false,
          fromCache: creditsToCharge === 0, // ✅ Treat as cached if user wasn't charged
          chargeReason: chargeReason, // Tell frontend if this was free (previously_analyzed)
          creditsCharged: creditsToCharge, // 0 or 1
          architecture: 'enhanced-sdr-intelligence',
          usage: usageData, // Return user's usage, not AI usage
          processingTimeMs: result.processingTimeMs,
          microPromptStats: result.microPromptStats,
          requestId,
        })
      } else {
        throw new Error('Analysis failed')
      }
    } catch (error) {
      handleAnalysisError(error, requestId, res, 'Company analysis')
    }
  }
)

/**
 * Analyze person endpoint - Enhanced with optional company analysis
 * Rate limited for anonymous users to prevent abuse
 */
router.post(
  '/person',
  optionalAuth,
  rateLimitAnonymous,
  validatePersonAnalysis,
  async (req, res) => {
    const { fullName, title, profileUrl, companyName, includeCompanyAnalysis } =
      req.body
    const requestId = req.requestId

    try {
      logger.info(`[${requestId}] 👤 Person analysis request: ${fullName}`)
      logger.info(
        `[${requestId}] 🏢 Company name received: "${companyName}" (length: ${
          companyName?.length || 0
        })`
      )
      logger.info(
        `[${requestId}] 📊 Include company analysis: ${includeCompanyAnalysis}`
      )
      logger.info(`[${requestId}] 🔑 User ID: ${req.user?.id || 'anonymous'}`)

      // ⚠️ LIMIT ENFORCEMENT: Check if authenticated user has exceeded their limit
      if (req.user && supabaseService.isConfigured()) {
        try {
          const hasExceeded = await supabaseService.hasExceededLimit(
            req.user.id
          )
          if (hasExceeded) {
            const subscription = await supabaseService.getUserSubscription(
              req.user.id
            )
            const usage = await supabaseService.getMonthlyUsage(req.user.id)

            logger.warn(
              `[${requestId}] 🚫 User ${req.user.id} exceeded limit: ${usage.total_credits}/${subscription.analyses_limit}`
            )

            return res.status(429).json({
              success: false,
              error: `Monthly analysis limit exceeded. You've used ${usage.total_credits} of ${subscription.analyses_limit} unique entities this month. Revisits are free. Upgrade your plan for more analyses.`,
              usage: {
                analysesUsed: usage.total_credits, // ✅ Use total_credits (unique entities charged)
                analysesLimit: subscription.analyses_limit,
                planType: subscription.plan_type,
              },
              requestId,
            })
          }
        } catch (limitError) {
          logger.warn(
            `[${requestId}] Could not check user limit, allowing request:`,
            limitError.message
          )
          // Continue anyway - don't block users if limit check fails
        }
      }

      // Check two-tier cache (L1 memory + L2 database) - UNIFIED CACHE SYSTEM
      // All users (authenticated + anonymous) use the same cache
      let cachedPersonResult = null
      let cachedCompanyResult = null
      if (!cachedPersonResult) {
        const personCacheKey = cacheService.generatePersonKey(
          fullName,
          companyName
        )
        cachedPersonResult = await cacheService.get(personCacheKey)

        if (cachedPersonResult) {
          // ✅ CACHE VALIDATION: Verify person cache with comprehensive schema validation
          const validation =
            cacheService.validatePersonCache(cachedPersonResult)

          if (!validation.valid) {
            logger.warn(
              `[${requestId}] ⚠️  Person cache validation failed for: ${fullName}`
            )
            logger.warn(
              `[${requestId}]   Schema version: ${
                validation.schemaVersion
              }, Errors: ${validation.errors.join(', ')}`
            )
            logger.warn(
              `[${requestId}]   Cached data has schemaVersion: ${
                cachedPersonResult?.metadata?.schemaVersion
              }, expected: ${
                require('../schemas/analysisSchemas').SCHEMA_VERSION
              }`
            )

            // Delete invalid cache and fetch fresh
            await cacheService.deleteFromAllSources(personCacheKey)
            logger.info(
              `[${requestId}] 🗑️  Invalid person cache cleared, fetching fresh data`
            )
            cachedPersonResult = null // Force re-analysis
          } else {
            logger.info(
              `[${requestId}] 💾 Person cache hit (schema validated) for: ${fullName}`
            )
          }
        }
      }

      if (!cachedCompanyResult && includeCompanyAnalysis && companyName) {
        const companyCacheKey = cacheService.generateCompanyKey(companyName)
        cachedCompanyResult = await cacheService.get(companyCacheKey)

        if (cachedCompanyResult) {
          // ✅ CACHE VALIDATION: Verify company cache with comprehensive schema validation
          const validation =
            cacheService.validateCompanyCache(cachedCompanyResult)

          if (!validation.valid) {
            logger.warn(
              `[${requestId}] ⚠️  Company cache validation failed for: ${companyName}`
            )
            logger.warn(
              `[${requestId}]   Schema version: ${
                validation.schemaVersion
              }, Errors: ${validation.errors.join(', ')}`
            )
            logger.warn(
              `[${requestId}]   Cached data has schemaVersion: ${
                cachedCompanyResult?.metadata?.schemaVersion
              }, expected: ${
                require('../schemas/analysisSchemas').SCHEMA_VERSION
              }`
            )

            // Delete invalid cache and fetch fresh
            await cacheService.deleteFromAllSources(companyCacheKey)
            logger.info(
              `[${requestId}] 🗑️  Invalid company cache cleared, fetching fresh data`
            )
            cachedCompanyResult = null // Force re-analysis
          } else {
            logger.info(
              `[${requestId}] 💾 Company cache hit (schema validated) for: ${companyName}`
            )
          }
        }
      }

      // ✅ OPTIMIZED CACHE LOGIC: Use cached data when available, only analyze what's missing
      // If both are cached (or only person if company not requested), return combined result
      if (
        cachedPersonResult &&
        (!includeCompanyAnalysis || cachedCompanyResult)
      ) {
        logger.info(
          `[${requestId}] ✅ Fully cached result available - returning immediately`
        )

        // Determine charge info for authenticated users (Pay Once Per Entity)
        let creditsToCharge = 1 // Default for non-authenticated or fresh analysis
        let chargeReason = 'first_time_cache_hit' // Default

        // Log cache hit and charge credits for authenticated users
        if (req.user && supabaseService.isConfigured()) {
          try {
            // Determine analysis type (combined if both person and company, otherwise just person)
            const isCombinedAnalysis =
              includeCompanyAnalysis && cachedCompanyResult

            // Determine if user should be charged (Pay Once Per Entity)
            const personCacheKey = cacheService.generatePersonKey(
              fullName,
              companyName
            )
            const hasSeenBefore = await supabaseService.hasUserAnalyzedBefore(
              req.user.id,
              personCacheKey
            )

            creditsToCharge = hasSeenBefore ? 0 : 1
            chargeReason = hasSeenBefore
              ? 'previously_analyzed'
              : 'first_time_cache_hit'

            logger.info(
              `[${requestId}] 🔍 CHARGE DEBUG: personCacheKey="${personCacheKey}", hasSeenBefore=${hasSeenBefore}, creditsToCharge=${creditsToCharge}`
            )

            if (hasSeenBefore) {
              logger.info(
                `[${requestId}] 🎁 User has analyzed "${fullName}" before - FREE (0 credits)`
              )
            } else {
              logger.info(
                `[${requestId}] 💵 User's first time analyzing "${fullName}" - CHARGE (1 credit)`
              )
            }

            // Always log as 'person' for person endpoint (company data is supplementary)
            await supabaseService.logUsage(req.user.id, {
              analysis_type: 'person',
              person_name: fullName,
              person_title: title,
              company_name: companyName,
              linkedin_url: profileUrl,
              cache_key: personCacheKey, // Reference to analysis_cache (v2)
              credits_used: creditsToCharge, // 0 if previously analyzed, 1 if first time
              from_cache: true,
              charge_reason: chargeReason,
              data_sources: [
                ...(cachedPersonResult.metadata?.sources || []),
                ...(cachedCompanyResult?.metadata?.sources || []),
              ],
            })

            // Note: No need to increment monthly_usage manually
            // It's a VIEW that auto-aggregates SUM(credits_used) from usage_logs

            logger.info(
              `[${requestId}] 📊 ${
                isCombinedAnalysis ? 'Combined' : 'Person'
              } cache hit logged (${creditsToCharge} credit${
                creditsToCharge !== 1 ? 's' : ''
              }) for user ${req.user.id}`
            )
          } catch (logError) {
            logger.warn(
              `[${requestId}] Failed to log cache hit:`,
              logError.message
            )
          }
        }

        const responseData = {
          profile: cachedPersonResult,
          pageType: 'profile',
        }

        if (includeCompanyAnalysis && cachedCompanyResult) {
          responseData.company = cachedCompanyResult
        }

        // Get updated usage to return to frontend
        let usageData = null
        if (req.user && supabaseService.isConfigured()) {
          try {
            const subscription = await supabaseService.getUserSubscription(
              req.user.id
            )
            const usage = await supabaseService.getMonthlyUsage(req.user.id)

            usageData = {
              analysesUsed: usage.total_credits, // ✅ Use total_credits (unique entities charged)
              analysesLimit: subscription.analyses_limit,
              analysesRemaining: Math.max(
                0,
                subscription.analyses_limit - usage.total_credits
              ), // ✅ Send calculated value
              planType: subscription.plan_type,
            }
          } catch (error) {
            logger.warn(
              `[${requestId}] Failed to get usage data:`,
              error.message
            )
          }
        }

        return res.json({
          success: true,
          data: responseData,
          cached: true,
          fromCache: true, // ✅ Frontend expects this field
          chargeReason: chargeReason, // Tell frontend if this was free (previously_analyzed)
          creditsCharged: creditsToCharge, // 0 or 1
          usage: usageData,
          requestId,
          combinedAnalysis: !!responseData.company,
        })
      }

      // ✅ PARTIAL CACHE SCENARIO: Person cached, but need to analyze company
      if (
        cachedPersonResult &&
        includeCompanyAnalysis &&
        !cachedCompanyResult
      ) {
        logger.info(
          `[${requestId}] 💾 Person cached, analyzing company only: ${companyName}`
        )

        // Use cached person data
        const responseData = {
          profile: cachedPersonResult,
          pageType: 'profile',
        }

        // Analyze company only
        try {
          logger.info(
            `[${requestId}] 🔍 Company analysis starting for: "${companyName}"`
          )

          const companyResult =
            await perplexityService.analyzeCompanyWithMicroPrompts(companyName)

          if (companyResult.success) {
            // Save company analysis to cache (L1 + L2)
            const companyCacheKey = cacheService.generateCompanyKey(companyName)
            await cacheService.set(companyCacheKey, companyResult.data)
            logger.info(
              `[${requestId}] 💾 Saved company analysis to cache (L1 + L2): ${companyName}`
            )

            logger.info(
              `[${requestId}] ✅ Company analysis completed: ${companyName}`
            )

            responseData.company = companyResult.data
          } else {
            logger.warn(
              `[${requestId}] ⚠️ Company analysis failed for: ${companyName}`
            )
          }
        } catch (companyError) {
          logger.warn(
            `[${requestId}] ⚠️ Company analysis error for ${companyName}:`,
            companyError.message
          )
          // Continue without company data - don't fail the entire request
        }

        // 🎯 CONSOLIDATED USAGE LOGGING: Log once with determined credits
        if (req.user && supabaseService.isConfigured()) {
          try {
            const personCacheKey = cacheService.generatePersonKey(
              fullName,
              companyName
            )

            // Determine if user should be charged (Pay Once Per Entity)
            const hasSeenBefore = await supabaseService.hasUserAnalyzedBefore(
              req.user.id,
              personCacheKey
            )

            const creditsToCharge = hasSeenBefore ? 0 : 1
            const chargeReason = hasSeenBefore
              ? 'previously_analyzed'
              : 'first_time_cache_hit'

            logger.info(
              `[${requestId}] 🔍 CHARGE DEBUG (partial cache): personCacheKey="${personCacheKey}", hasSeenBefore=${hasSeenBefore}, creditsToCharge=${creditsToCharge}`
            )

            if (hasSeenBefore) {
              logger.info(
                `[${requestId}] 🎁 User has analyzed "${fullName}" before - FREE (0 credits)`
              )
            } else {
              logger.info(
                `[${requestId}] 💵 User's first time analyzing "${fullName}" - CHARGE (1 credit)`
              )
            }

            // Aggregate data sources
            const dataSources = [
              ...(cachedPersonResult.metadata?.sources || []),
              ...(responseData.company?.metadata?.sources || []),
            ]

            await supabaseService.logUsage(req.user.id, {
              analysis_type: 'person',
              person_name: fullName,
              person_title: title,
              company_name: companyName,
              linkedin_url: profileUrl,
              cache_key: personCacheKey,
              credits_used: creditsToCharge,
              from_cache: true, // Person was cached
              charge_reason: chargeReason,
              data_sources: dataSources,
            })

            // Note: No need to increment monthly_usage manually
            // It's a VIEW that auto-aggregates SUM(credits_used) from usage_logs

            logger.info(
              `[${requestId}] 📊 Combined analysis logged (${creditsToCharge} credit${
                creditsToCharge !== 1 ? 's' : ''
              }) for user ${
                req.user.id
              } | From cache: true (person), false (company)`
            )
          } catch (logError) {
            logger.warn(`[${requestId}] Failed to log usage:`, logError.message)
          }
        }

        // Get updated usage to return to frontend
        let usageData = null
        if (req.user && supabaseService.isConfigured()) {
          try {
            const subscription = await supabaseService.getUserSubscription(
              req.user.id
            )
            const usage = await supabaseService.getMonthlyUsage(req.user.id)

            usageData = {
              analysesUsed: usage.total_credits, // ✅ Use total_credits (unique entities charged)
              analysesLimit: subscription.analyses_limit,
              analysesRemaining: Math.max(
                0,
                subscription.analyses_limit - usage.total_credits
              ), // ✅ Send calculated value
              planType: subscription.plan_type,
            }
          } catch (error) {
            logger.warn(
              `[${requestId}] Failed to get usage data:`,
              error.message
            )
          }
        }

        return res.json({
          success: true,
          data: responseData,
          cached: true, // Person was cached
          fromCache: true, // ✅ Frontend expects this field
          partial_cache: true, // Indicate mixed scenario
          requestId,
          usage: usageData,
          combinedAnalysis: !!responseData.company,
        })
      }

      // ✅ FRESH ANALYSIS REQUIRED: Person not cached, need to analyze
      if (!cachedPersonResult) {
        logger.debug(`[${requestId}] 🔍 Cache miss for person: ${fullName}`)
      }

      logger.info(`[${requestId}] 🔍 Analyzing person with AI: ${fullName}`)

      // Variables for charge tracking (used in response)
      let creditsToCharge = 1
      let chargeReason = 'fresh_analysis'

      // Perform person analysis
      const personResult = await perplexityService.analyzePerson({
        name: fullName,
        title,
        company: companyName,
        profileUrl,
      })

      if (!personResult.success) {
        throw new Error('Person analysis failed')
      }

      // Save to two-tier cache (L1 memory + L2 database)
      const personCacheKey = cacheService.generatePersonKey(
        fullName,
        companyName
      )
      await cacheService.set(personCacheKey, personResult.data)
      logger.info(
        `[${requestId}] 💾 Saved person analysis to cache (L1 + L2): ${fullName}`
      )

      // NOTE: Don't log usage yet - wait until we know if company analysis is included
      // If combined, we'll log once with 1 credit. If person-only, we'll log after company check.

      logger.info(`[${requestId}] ✅ Person analysis completed: ${fullName}`)

      // Prepare response data
      const responseData = {
        profile: personResult.data,
        pageType: 'profile',
      }

      let companyResult = null
      let totalUsage = personResult.usage || {}

      // If company analysis is requested and we have a company name
      if (includeCompanyAnalysis && companyName && !cachedCompanyResult) {
        // ✅ CRITICAL FIX: ALWAYS check cache (L1 + L2) regardless of authentication status
        // Previous bug: only checked cache for unauthenticated users, wasting $2.68+ per request
        const companyCacheKey = cacheService.generateCompanyKey(companyName)
        cachedCompanyResult = await cacheService.get(companyCacheKey)

        if (cachedCompanyResult) {
          // ✅ CACHE VALIDATION: Verify company cache with comprehensive schema validation
          const validation =
            cacheService.validateCompanyCache(cachedCompanyResult)

          if (!validation.valid) {
            logger.warn(
              `[${requestId}] ⚠️  Company cache validation failed for: ${companyName}`
            )
            logger.warn(
              `[${requestId}]   Schema version: ${
                validation.schemaVersion
              }, Errors: ${validation.errors.join(', ')}`
            )

            // Delete invalid cache and fetch fresh
            await cacheService.deleteFromAllSources(companyCacheKey)
            logger.info(
              `[${requestId}] 🗑️  Invalid company cache cleared, fetching fresh data`
            )
            cachedCompanyResult = null // Force re-analysis
          } else {
            logger.info(
              `[${requestId}] 💾 Cache hit for company (validated): ${companyName}`
            )
            responseData.company = cachedCompanyResult
          }
        }

        // Only run analysis if still no cached result
        if (!cachedCompanyResult) {
          try {
            logger.info(
              `[${requestId}] 🏢 Also analyzing company: "${companyName}"`
            )
            logger.info(
              `[${requestId}] 🔍 Company analysis starting for: "${companyName}"`
            )

            companyResult =
              await perplexityService.analyzeCompanyWithMicroPrompts(
                companyName
              )

            if (companyResult.success) {
              // Save company analysis to cache (L1 + L2) for all users
              const companyCacheKey =
                cacheService.generateCompanyKey(companyName)
              await cacheService.set(companyCacheKey, companyResult.data)
              logger.info(
                `[${requestId}] 💾 Saved company analysis to cache (L1 + L2): ${companyName}`
              )

              logger.info(
                `[${requestId}] ✅ Company analysis completed: ${companyName}`
              )
              logger.info(
                `[${requestId}] 📊 Company data name field: "${
                  companyResult.data?.name ||
                  companyResult.data?.companyName ||
                  'NOT_FOUND'
                }"`
              )

              responseData.company = companyResult.data

              // Combine usage statistics
              if (companyResult.usage) {
                totalUsage = {
                  prompt_tokens:
                    (totalUsage.prompt_tokens || 0) +
                    (companyResult.usage.prompt_tokens || 0),
                  completion_tokens:
                    (totalUsage.completion_tokens || 0) +
                    (companyResult.usage.completion_tokens || 0),
                  total_tokens:
                    (totalUsage.total_tokens || 0) +
                    (companyResult.usage.total_tokens || 0),
                }
              }
            } else {
              logger.warn(
                `[${requestId}] ⚠️ Company analysis failed for: ${companyName}`
              )
            }
          } catch (companyError) {
            logger.warn(
              `[${requestId}] ⚠️ Company analysis error for ${companyName}:`,
              companyError.message
            )
            // Continue without company data - don't fail the entire request
          }
        }
      } else if (includeCompanyAnalysis && cachedCompanyResult) {
        logger.info(
          `[${requestId}] 📦 Using cached company analysis: ${companyName}`
        )
        responseData.company = cachedCompanyResult
      }

      // 🎯 CONSOLIDATED USAGE LOGGING: Log once with determined credits (Pay Once Per Entity)
      if (req.user && supabaseService.isConfigured()) {
        try {
          const isCombinedAnalysis = !!responseData.company

          // Always log as 'person' for person endpoint (company data is supplementary)
          // Determine if analysis came from cache
          const fromCache =
            cachedPersonResult !== null &&
            (!isCombinedAnalysis || cachedCompanyResult !== null)

          // Aggregate data sources from both analyses
          const dataSources = [
            ...(personResult.data?.metadata?.sources || []),
            ...(companyResult?.data?.metadata?.sources || []),
            ...(cachedPersonResult?.metadata?.sources || []),
            ...(cachedCompanyResult?.metadata?.sources || []),
          ]

          const personCacheKey = cacheService.generatePersonKey(
            fullName,
            companyName
          )

          // Determine if user should be charged (Pay Once Per Entity)
          const hasSeenBefore = await supabaseService.hasUserAnalyzedBefore(
            req.user.id,
            personCacheKey
          )

          creditsToCharge = hasSeenBefore ? 0 : 1
          chargeReason = hasSeenBefore
            ? 'previously_analyzed'
            : 'fresh_analysis'

          if (hasSeenBefore) {
            logger.info(
              `[${requestId}] 🎁 User has analyzed "${fullName}" before - FREE (0 credits, fresh from API)`
            )
          } else {
            logger.info(
              `[${requestId}] 💵 User's first time analyzing "${fullName}" - CHARGE (1 credit)`
            )
          }

          logger.info(
            `[${requestId}] 🔍 CHARGE DEBUG (fresh analysis): personCacheKey="${personCacheKey}", hasSeenBefore=${hasSeenBefore}, creditsToCharge=${creditsToCharge}`
          )

          await supabaseService.logUsage(req.user.id, {
            analysis_type: 'person',
            person_name: fullName,
            person_title: title,
            company_name: companyName,
            linkedin_url: profileUrl,
            cache_key: personCacheKey, // Reference to analysis_cache (v2)
            credits_used: creditsToCharge, // 0 if previously analyzed, 1 if first time
            from_cache: fromCache,
            charge_reason: chargeReason,
            data_sources: dataSources,
          })

          // Note: No need to increment monthly_usage manually
          // It's a VIEW that auto-aggregates SUM(credits_used) from usage_logs

          logger.info(
            `[${requestId}] 📊 ${
              isCombinedAnalysis ? 'Combined' : 'Person'
            } analysis logged (${creditsToCharge} credit${
              creditsToCharge !== 1 ? 's' : ''
            }) for user ${req.user.id} | From cache: ${fromCache}`
          )
        } catch (dbError) {
          logger.error(
            `[${requestId}] Failed to log usage to database:`,
            dbError.message
          )
          // Don't fail the request if database logging fails
        }
      } else {
        logger.info(`[${requestId}] ℹ️ Anonymous analysis - no usage tracking`)
      }

      // Get updated user usage to return to frontend
      let userUsage = null
      if (req.user && supabaseService.isConfigured()) {
        try {
          const subscription = await supabaseService.getUserSubscription(
            req.user.id
          )
          const usage = await supabaseService.getMonthlyUsage(req.user.id)

          userUsage = {
            analysesUsed: usage.total_credits, // ✅ Use total_credits (unique entities charged)
            analysesLimit: subscription.analyses_limit,
            analysesRemaining: Math.max(
              0,
              subscription.analyses_limit - usage.total_credits
            ), // ✅ Send calculated value
            planType: subscription.plan_type,
          }
        } catch (error) {
          logger.warn(`[${requestId}] Failed to get usage data:`, error.message)
        }
      }

      res.json({
        success: true,
        data: responseData,
        cached: false,
        fromCache: creditsToCharge === 0, // ✅ Treat as cached if user wasn't charged
        chargeReason: chargeReason, // Tell frontend if this was free (previously_analyzed)
        creditsCharged: creditsToCharge, // 0 or 1
        usage: userUsage, // User's analyses usage
        tokenUsage: totalUsage, // AI token usage (for internal tracking)
        processingTimeMs: personResult.data.metadata?.processingTimeMs,
        requestId,
        combinedAnalysis: !!responseData.company,
      })
    } catch (error) {
      handleAnalysisError(error, requestId, res, 'Person analysis')
    }
  }
)

/**
 * Get comprehensive cache statistics from both L1 (memory) and L2 (database)
 */
router.get('/cache/stats', async (req, res) => {
  try {
    // Get L1 (memory) and L2 (database) cache stats
    const cacheStats = await cacheService.getStats()

    // Get usage logs statistics if database is configured
    let usageStats = null
    if (supabaseService.isConfigured()) {
      const { count: totalAnalyses } = await supabaseService.client
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })

      const { count: companiesAnalyzed } = await supabaseService.client
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('analysis_type', 'company')

      const { count: peopleAnalyzed } = await supabaseService.client
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('analysis_type', 'person')

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { count: staleAnalyses } = await supabaseService.client
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })
        .lt('refreshed_at', thirtyDaysAgo.toISOString())

      usageStats = {
        totalAnalyses: totalAnalyses || 0,
        companiesAnalyzed: companiesAnalyzed || 0,
        peopleAnalyzed: peopleAnalyzed || 0,
        staleAnalyses: staleAnalyses || 0,
        freshAnalyses: (totalAnalyses || 0) - (staleAnalyses || 0),
      }
    }

    // Get pending requests stats
    const pendingStats = cacheService.getPendingRequestsStats()

    res.json({
      success: true,
      cache: cacheStats,
      usage: usageStats,
      pendingRequests: pendingStats,
      architecture: 'two-tier-cache-with-deduplication',
      requestId: req.requestId,
    })
  } catch (error) {
    logger.error('Error getting cache stats:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics',
      requestId: req.requestId,
    })
  }
})

/**
 * Clear stale analyses from database (admin endpoint)
 * NOTE: This clears analyses older than 30 days for ALL users
 */
router.delete('/cache', async (req, res) => {
  try {
    if (!supabaseService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured',
        requestId: req.requestId,
      })
    }

    // Delete analyses older than 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: staleAnalyses, error: countError } =
      await supabaseService.client
        .from('usage_logs')
        .select('id', { count: 'exact' })
        .lt('refreshed_at', thirtyDaysAgo.toISOString())

    const beforeCount = staleAnalyses?.length || 0

    const { error } = await supabaseService.client
      .from('usage_logs')
      .delete()
      .lt('refreshed_at', thirtyDaysAgo.toISOString())

    if (error) throw error

    res.json({
      success: true,
      message: `Cleared ${beforeCount} stale analyses (>30 days old)`,
      beforeCount,
      afterCount: 0,
      requestId: req.requestId,
    })
  } catch (error) {
    logger.error('Failed to clear stale analyses:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      requestId: req.requestId,
    })
  }
})

/**
 * Get rate limiting statistics (admin/monitoring endpoint)
 */
router.get('/rate-limit/stats', async (req, res) => {
  try {
    const stats = getRateLimitStats()

    res.json({
      success: true,
      stats: {
        ...stats,
        config: {
          anonymous: config.rateLimit.anonymous,
          authenticated: config.rateLimit.authenticated,
        },
      },
      requestId: req.requestId,
    })
  } catch (error) {
    logger.error('Failed to get rate limit stats:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to get rate limit statistics',
      requestId: req.requestId,
    })
  }
})

/**
 * Chat endpoint - Context-aware conversational AI
 * Accepts chat messages and optional LinkedIn context
 */
router.post('/chat', optionalAuth, rateLimitAnonymous, async (req, res) => {
  const { messages, context } = req.body
  const requestId = req.requestId

  try {
    // Validate request
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required',
        requestId,
      })
    }

    // Validate message format
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return res.status(400).json({
          success: false,
          error: 'Each message must have role and content',
          requestId,
        })
      }
      if (!['user', 'assistant'].includes(msg.role)) {
        return res.status(400).json({
          success: false,
          error: 'Message role must be "user" or "assistant"',
          requestId,
        })
      }
    }

    logger.info(
      `[${requestId}] 💬 Chat request: ${messages.length} messages, context: ${
        context ? context.type : 'none'
      }`
    )

    // Note: Chat doesn't check analysis limits since it's free/supplementary
    // Rate limiting (from middleware) still applies to prevent abuse

    // Get chat response from Perplexity
    const result = await perplexityService.chat(messages, context)

    // Note: Chat is conversational and doesn't consume analysis credits
    // The entity analysis is already charged when viewing the profile/company
    // Chat is included as part of the analysis experience
    logger.info(
      `[${requestId}] ✅ Chat response generated (no credit charge - supplementary to analysis)`
    )

    // Return chat response
    res.json({
      success: true,
      message: result.content,
      citations: result.citations,
      timestamp: result.timestamp,
      requestId,
    })
  } catch (error) {
    logger.error(`[${requestId}] ❌ Chat error:`, error.message)
    handleAnalysisError(error, res, requestId)
  }
})

module.exports = router
