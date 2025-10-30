/**
 * Sumble API Service for LinkedIntel
 * Provides primary-source B2B intelligence from job posts and LinkedIn profiles
 *
 * API Documentation: https://api.sumble.com/docs
 */

const cacheService = require('./cacheService')
const { Logger } = require('../utils/logger')

const logger = new Logger('SumbleService')

class SumbleService {
  constructor() {
    this.apiKey = process.env.SUMBLE_API_KEY
    this.baseUrl = 'https://api.sumble.com/v2'
    this.creditsRemaining = null
    this.lastCreditCheck = null

    // Tech stack cache TTL: 7 days (tech stacks don't change frequently)
    this.TECH_STACK_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

    // Sumble API Pricing (as of 2024)
    // Source: https://www.sumble.com/pricing
    // Typical plans: $499/mo for 10K credits, $999/mo for 25K credits
    // Average: $0.04 per credit (based on $999/25K plan)
    this.COST_PER_CREDIT = 0.04 // $0.04 per credit
  }

  /**
   * Calculate cost for Sumble API credits
   * @param {number} creditsUsed - Number of credits consumed
   * @returns {number} Cost in dollars
   */
  calculateCost(creditsUsed) {
    if (!creditsUsed || creditsUsed <= 0) return 0
    return parseFloat((creditsUsed * this.COST_PER_CREDIT).toFixed(2))
  }

  /**
   * Get organization technology stack with verification from job posts
   *
   * @param {string} companyDomain - Company domain (e.g., "anthropic.com")
   * @param {string[]} technologies - Array of specific technologies to search for (optional, defaults to Sumble's official tech categories)
   * @returns {Promise<Object>} Technology stack data with job counts and verification
   */
  async getOrganizationTechStack(companyDomain, technologies = null) {
    try {
      if (!this.apiKey) {
        logger.error('SUMBLE_API_KEY not found in environment variables')
        logger.error(
          'Add SUMBLE_API_KEY to backend/.env to enable verified tech stack data'
        )
        logger.error('Get your API key from: https://api.sumble.com/')
        logger.error(
          'System will fall back to Perplexity for tech stack detection'
        )
        return {
          success: false,
          error: 'Sumble API key not configured',
          technologies: [],
        }
      }

      // Check cache first (only if using default categories, not custom tech list)
      if (!technologies) {
        const cacheKey = `sumble:tech:${companyDomain}`
        const cached = await cacheService.get(cacheKey)
        if (cached) {
          // ✅ CACHE VALIDATION: Verify cached data has valid structure
          // If cache is corrupted (missing success field or invalid), invalidate it
          const isValidCache =
            cached &&
            typeof cached === 'object' &&
            typeof cached.success === 'boolean' &&
            Array.isArray(cached.technologies)

          if (!isValidCache) {
            logger.warn(
              `⚠️  Corrupted cache detected for ${companyDomain}, invalidating...`
            )
            logger.debug(`   Cached data: ${JSON.stringify(cached)}`)

            // Delete corrupted cache from both layers
            await cacheService.deleteFromBothLayers(cacheKey)
            logger.info(
              `🗑️  Corrupted cache cleared, will fetch fresh data from API`
            )
            // Continue to API call below (don't return)
          } else {
            logger.debug(
              `💾 Sumble: Using cached tech stack for ${companyDomain}`
            )
            logger.debug(
              `💳 Sumble: 0 credits used (cache hit), ${
                this.creditsRemaining || 'unknown'
              } remaining`
            )
            return {
              ...cached,
              fromCache: true,
            }
          }
        }
      }

      // COST OPTIMIZATION: Reduced to 8 CORE categories (from original 57)
      // Focused on HIGHEST-VALUE tech signals for B2B sales intelligence
      // Expected cost: 30-60 credits per analysis (8-15 technologies found)
      // vs. 50-100 credits with 18 categories, 150-200+ with full 57 categories
      //
      // RATIONALE: These 8 categories capture 80%+ of critical buying signals:
      // - Cloud infra = budget authority & enterprise scale
      // - Data platforms = innovation & data maturity
      // - AI/ML = hottest buying signals & future investment
      // - Security = compliance needs & risk budgets
      // - BI = universal need across all companies
      const SUMBLE_TECH_CATEGORIES = [
        // Cloud & Infrastructure (CRITICAL - primary budget indicator)
        'cloud-vendor', // AWS, Azure, GCP - indicates enterprise scale & spending power

        // Data & Analytics (high-value signals)
        'cloud-data-warehouse', // Snowflake, BigQuery, Redshift - big budget items
        'data-pipeline-orchestration', // Airflow, dbt, Fivetran - data engineering maturity

        // AI & Machine Learning (HOTTEST buying signals)
        'gen-ai', // OpenAI, Anthropic, Hugging Face - innovation indicator

        // Business Intelligence (universal need)
        'business-intelligence', // Tableau, PowerBI, Looker - every company needs this

        // Development & DevOps (engineering culture)
        'ci-cd', // Jenkins, GitHub Actions, CircleCI - DevOps maturity

        // SaaS & Integration (marketing/sales tech stack)
        'customer-data-platform', // Segment, Rudderstack - indicates marketing spend

        // Security (compliance & budget authority)
        'cybersecurity', // Security tools - compliance requirements

        // ===== COMMENTED OUT - Enable if needed for specific verticals =====
        // 'serverless-compute',        // Lambda, Cloud Functions
        // 'cloud-security',            // Cloud-specific security
        // 'olap',                      // Analytical databases
        // 'document-store',            // MongoDB, DynamoDB
        // 'mlops',                     // ML infrastructure
        // 'ipaas',                     // Zapier, MuleSoft
        // 'siem',                      // Security monitoring
        // 'ecommerce-platform',        // Shopify, WooCommerce
        // 'headless-cms',              // Contentful, Strapi
      ]

      logger.debug(
        `🔍 Sumble: Requesting technologies using ${SUMBLE_TECH_CATEGORIES.length} official category slugs at ${companyDomain}`
      )

      // v2 API structure: filters wrapper required
      const requestBody = {
        organization: { domain: companyDomain },
        filters: {},
      }

      // If specific technologies are requested, use them; otherwise use categories
      if (technologies && technologies.length > 0) {
        requestBody.filters.technologies = technologies
        logger.debug(
          `   Using specific technologies: ${technologies.length} items`
        )
      } else {
        requestBody.filters.technology_categories = SUMBLE_TECH_CATEGORIES
        logger.debug(
          `   Using official Sumble technology categories for comprehensive coverage`
        )
      }

      const response = await fetch(`${this.baseUrl}/organizations/enrich`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error(
          `❌ Sumble Tech Stack API: HTTP ${response.status} - ${errorText}`
        )
        throw new Error(`Sumble API error ${response.status}: ${errorText}`)
      }

      const data = await response.json()

      // Log response details for debugging
      logger.debug(
        `Sumble Tech Stack API Response - Status: ${
          response.status
        }, Technologies found: ${data.technologies?.length || 0}`
      )
      this.creditsRemaining = data.credits_remaining
      this.lastCreditCheck = new Date()

      const cost = this.calculateCost(data.credits_used)

      logger.info(
        `✅ Sumble Tech Stack API: SUCCESS - Found ${
          data.technologies?.length || 0
        } technologies`
      )
      logger.info(
        `💳 Sumble Credits: Used ${data.credits_used}, Remaining ${this.creditsRemaining}`
      )
      logger.info(`💵 Sumble Cost: $${cost.toFixed(2)}`)

      // Log which technologies were found for debugging
      if (data.technologies && data.technologies.length > 0) {
        logger.debug(
          `🔍 DEBUG: Technologies returned by Sumble:`,
          data.technologies
            .map((t) => `${t.name} (${t.jobs_count} jobs)`)
            .join(', ')
        )
      }

      const result = {
        success: true,
        technologies: data.technologies || [],
        organization: data.organization,
        creditsUsed: data.credits_used,
        creditsRemaining: data.credits_remaining,
        sourceUrl: data.source_data_url,
      }

      // Cache the result (only if using default categories)
      if (!technologies) {
        const cacheKey = `sumble:tech:${companyDomain}`
        cacheService.set(cacheKey, result, this.TECH_STACK_CACHE_TTL)
        logger.debug(`💾 Cached tech stack for ${companyDomain} (TTL: 7 days)`)
      }

      return result
    } catch (error) {
      logger.error('❌ Sumble Tech Stack API: FAILED -', error.message)
      logger.error('Stack trace:', error.stack)
      logger.debug('Request was for domain:', companyDomain)
      return {
        success: false,
        error: error.message,
        technologies: [],
      }
    }
  }

  /**
   * Find priority contacts (executives) at organization
   *
   * @param {string} companyDomain - Company domain (e.g., "anthropic.com")
   * @param {Object} options - Search options
   * @param {string[]} options.jobLevels - Job levels to search for (default: ['CXO', 'VP'])
   * @param {string[]} options.jobFunctions - Job functions (default: ['Engineering', 'Product', 'Sales'])
   * @param {number} options.limit - Max results (default: 10)
   * @returns {Promise<Object>} People data with verified roles
   */
  async findPriorityContacts(companyDomain, options = {}) {
    try {
      if (!this.apiKey) {
        logger.error('❌ SUMBLE_API_KEY not found in environment variables')
        logger.error(
          'ℹ️  Add SUMBLE_API_KEY to backend/.env to enable verified executive discovery'
        )
        logger.error('ℹ️  Get your API key from: https://api.sumble.com/')
        logger.error(
          'ℹ️  System will fall back to Perplexity for contact discovery'
        )
        return {
          success: false,
          error: 'Sumble API key not configured',
          people: [],
        }
      }

      const {
        jobLevels = ['CXO', 'VP', 'Director'],
        jobFunctions = [
          'Executive', // ✅ FIXED: Added Executive to capture founders/C-level
          'Engineering',
          'Product',
          'Sales',
          'Marketing',
          'Operations',
        ],
        limit = 20, // Increased from 10 to get more results
      } = options

      logger.debug(`👥 Sumble: Finding priority contacts at ${companyDomain}`)
      logger.debug(
        `🔍 Filters: levels=${JSON.stringify(
          jobLevels
        )}, functions=${JSON.stringify(jobFunctions)}`
      )

      // v2 API structure: filters wrapper required
      const requestPayload = {
        organization: { domain: companyDomain },
        filters: {
          job_levels: jobLevels,
          job_functions: jobFunctions,
        },
        limit: limit,
      }

      const response = await fetch(`${this.baseUrl}/people/find`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Sumble API error ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      this.creditsRemaining = data.credits_remaining
      this.lastCreditCheck = new Date()

      const cost = this.calculateCost(data.credits_used)

      logger.info(
        `✅ Sumble Priority Contacts API: SUCCESS - Found ${data.people_count} executives`
      )
      logger.info(
        `💳 Sumble Credits: Used ${data.credits_used}, Remaining ${this.creditsRemaining}`
      )
      logger.info(`💵 Sumble Cost: $${cost.toFixed(2)}`)

      // If we got 0 results with filters, try again WITHOUT filters to get all people
      if (
        data.people_count === 0 &&
        (jobLevels.length > 0 || jobFunctions.length > 0)
      ) {
        logger.warn(
          '⚠️  No results with filters, retrying WITHOUT job level/function filters...'
        )

        // v2 API structure: filters wrapper required (even when empty)
        const fallbackPayload = {
          organization: { domain: companyDomain },
          filters: {
            job_levels: [], // Remove filters
            job_functions: [], // Remove filters
          },
          limit: limit,
        }

        const fallbackResponse = await fetch(`${this.baseUrl}/people/find`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fallbackPayload),
        })

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json()
          this.creditsRemaining = fallbackData.credits_remaining

          const fallbackCost = this.calculateCost(fallbackData.credits_used)
          const totalCredits = data.credits_used + fallbackData.credits_used
          const totalCost = this.calculateCost(totalCredits)

          logger.info(
            `✅ Fallback successful: Found ${fallbackData.people_count} people (no filters)`
          )
          logger.info(
            `💳 Sumble Credits: Used ${fallbackData.credits_used}, Remaining ${this.creditsRemaining}`
          )
          logger.info(`💵 Sumble Cost: $${fallbackCost.toFixed(2)}`)
          logger.info(
            `💳 Total Sumble Credits (both attempts): ${totalCredits}`
          )
          logger.info(`💵 Total Sumble Cost: $${totalCost.toFixed(2)}`)

          return {
            success: true,
            people: fallbackData.people || [],
            peopleCount: fallbackData.people_count,
            creditsUsed: data.credits_used + fallbackData.credits_used,
            creditsRemaining: fallbackData.credits_remaining,
            sourceUrl: fallbackData.people_data_url,
            fallbackUsed: true,
          }
        }
      }

      return {
        success: true,
        people: data.people || [],
        peopleCount: data.people_count,
        creditsUsed: data.credits_used,
        creditsRemaining: data.credits_remaining,
        sourceUrl: data.people_data_url,
        fallbackUsed: false,
      }
    } catch (error) {
      logger.error('❌ Sumble Priority Contacts API: FAILED -', error.message)
      return {
        success: false,
        error: error.message,
        people: [],
      }
    }
  }

  /**
   * Analyze hiring signals from job posting data
   * Identifies recent hiring activity by technology (last 30 days)
   *
   * @param {string} companyDomain - Company domain
   * @param {Object} preFetchedTechStack - Optional pre-fetched tech stack data from getOrganizationTechStack()
   * @returns {Promise<Object>} Hiring signals with job counts and technologies
   */
  async getHiringSignals(companyDomain, preFetchedTechStack = null) {
    try {
      // Use pre-fetched tech stack if available, otherwise fetch it
      const techStack =
        preFetchedTechStack ||
        (await this.getOrganizationTechStack(companyDomain))

      if (!techStack.success) {
        return { success: false, signals: [] }
      }

      // Convert tech data to hiring signals
      const signals = techStack.technologies
        .filter((tech) => {
          const daysSince = this.calculateDaysSince(tech.last_job_post)
          return daysSince <= 30 && tech.jobs_count >= 5
        })
        .map((tech) => ({
          type: 'hiring',
          strength: tech.jobs_count >= 20 ? 'hot' : 'warm',
          note: `Posted ${tech.jobs_count} ${tech.name} jobs in last 30 days`,
          timestamp: tech.last_job_post,
          technology: tech.name,
          jobCount: tech.jobs_count,
          peopleCount: tech.people_count,
          teamsCount: tech.teams_count,
          sourceUrl: tech.jobs_data_url,
          sdrAction: `Reference ${tech.name} team scaling needs`,
          urgency: tech.jobs_count >= 20 ? 'immediate' : 'moderate',
          budgetIndicator: `Active hiring for ${tech.name} suggests infrastructure investment`,
          conversationStarter: `Saw you're hiring ${tech.jobs_count}+ ${tech.name} engineers - how are you scaling your infrastructure?`,
        }))

      const creditsUsed = preFetchedTechStack ? 0 : techStack.creditsUsed

      logger.info(
        `✅ Sumble Hiring Signals: SUCCESS - Generated ${signals.length} hiring signals`
      )
      if (creditsUsed > 0) {
        logger.info(
          `💳 Sumble Credits: Used ${creditsUsed} (for tech stack data)`
        )
      } else {
        logger.info(`💳 Sumble Credits: Used 0 (data from cache)`)
      }

      return {
        success: true,
        signals,
        creditsUsed: creditsUsed,
      }
    } catch (error) {
      logger.error('❌ Sumble Hiring Signals: FAILED -', error.message)
      return {
        success: false,
        error: error.message,
        signals: [],
      }
    }
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
   * Get organization basic information (employee count, industry, headquarters)
   * Uses /v2/organizations/find with advanced query syntax
   *
   * @param {string} companyDomain - Company domain (e.g., "anthropic.com")
   * @returns {Promise<Object>} Organization metadata (employee count, industry, headquarters)
   */
  async getOrganizationInfo(companyDomain) {
    try {
      if (!this.apiKey) {
        logger.error('❌ SUMBLE_API_KEY not found in environment variables')
        return {
          success: false,
          error: 'Sumble API key not configured',
          data: null,
          creditsUsed: 0,
        }
      }

      // Extract company name from domain (e.g., "anthropic.com" -> "anthropic")
      const companyName = companyDomain.split('.')[0]

      logger.debug(
        `🔍 Sumble: Looking up organization info for ${companyDomain} (searching for "${companyName}")`
      )

      // Use advanced query syntax to search by organization name
      const requestPayload = {
        filters: {
          query: `organization EQ '${companyName}'`,
        },
        limit: 5, // Get a few results to find exact domain match (5 orgs × 5 credits = 25 credits)
      }

      const response = await fetch(`${this.baseUrl}/organizations/find`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error(
          `❌ Sumble Org Info API: HTTP ${response.status} - ${errorText}`
        )
        throw new Error(`Sumble API error ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      this.creditsRemaining = data.credits_remaining
      this.lastCreditCheck = new Date()

      // Find exact domain match in results
      const organization = data.organizations?.find(
        (org) => org.domain === companyDomain
      )

      if (!organization) {
        logger.warn(
          `⚠️  Sumble Org Info: No exact domain match found for ${companyDomain} (found ${data.total} results for "${companyName}")`
        )
        return {
          success: false,
          error: `No exact match found for domain ${companyDomain}`,
          data: null,
          creditsUsed: data.credits_used,
          creditsRemaining: data.credits_remaining,
        }
      }

      const cost = this.calculateCost(data.credits_used)

      logger.info(
        `✅ Sumble Org Info API: SUCCESS - Found ${organization.name}`
      )
      logger.info(
        `   Industry: ${organization.industry || 'N/A'}, Employees: ${
          organization.total_employees || 'N/A'
        }, HQ: ${organization.headquarters_state}, ${
          organization.headquarters_country
        }`
      )
      logger.info(
        `💳 Sumble Credits: Used ${data.credits_used}, Remaining ${this.creditsRemaining}`
      )
      logger.info(`💵 Sumble Cost: $${cost.toFixed(2)}`)

      return {
        success: true,
        data: {
          id: organization.id,
          name: organization.name,
          domain: organization.domain,
          industry: organization.industry || null,
          total_employees: organization.total_employees || null,
          headquarters_country: organization.headquarters_country || null,
          headquarters_state: organization.headquarters_state || null,
          linkedin_url: organization.linkedin_organization_url || null,
        },
        creditsUsed: data.credits_used,
        creditsRemaining: data.credits_remaining,
      }
    } catch (error) {
      logger.error('❌ Sumble Org Info API: FAILED -', error.message)
      return {
        success: false,
        error: error.message,
        data: null,
        creditsUsed: 0,
      }
    }
  }

  /**
   * Get remaining API credits with low-credit alerting
   *
   * @returns {number|null} Remaining credits or null if not checked yet
   */
  getRemainingCredits() {
    // Alert if credits are running low
    if (this.creditsRemaining !== null) {
      if (this.creditsRemaining < 50) {
        logger.error(
          `🚨 CRITICAL: Only ${this.creditsRemaining} Sumble credits remaining - purchase more immediately!`
        )
      } else if (this.creditsRemaining < 100) {
        logger.warn(
          `⚠️  LOW SUMBLE CREDITS: Only ${this.creditsRemaining} credits remaining - consider purchasing more soon`
        )
      } else if (this.creditsRemaining < 200) {
        logger.debug(
          `ℹ️  Sumble credits getting low: ${this.creditsRemaining} remaining`
        )
      }
    }

    return this.creditsRemaining
  }

  /**
   * Get last credit check timestamp
   *
   * @returns {Date|null} Last check time
   */
  getLastCreditCheck() {
    return this.lastCreditCheck
  }

  /**
   * Extract domain from company name or URL
   * Handles various formats: "Anthropic", "anthropic.com", "https://anthropic.com"
   * Enhanced to handle international TLDs, subdomains, ports, and query parameters
   *
   * @param {string} companyNameOrUrl - Company name or URL
   * @returns {string} Domain name
   */
  static extractDomain(companyNameOrUrl) {
    if (!companyNameOrUrl) return ''

    // If it's a full URL with protocol, use URL parser
    if (
      companyNameOrUrl.includes('http://') ||
      companyNameOrUrl.includes('https://')
    ) {
      try {
        const url = new URL(companyNameOrUrl)
        let domain = url.hostname
        // Remove www. prefix
        domain = domain.replace(/^www\./, '')
        return domain
      } catch (error) {
        logger.warn(
          `⚠️  Invalid URL format: ${companyNameOrUrl}`,
          error.message
        )
        // Fall through to other parsing methods
      }
    }

    // If it contains a dot but no protocol, treat as domain
    if (companyNameOrUrl.includes('.') && !companyNameOrUrl.includes(' ')) {
      let domain = companyNameOrUrl
      // Remove www. prefix
      domain = domain.replace(/^www\./, '')
      // Extract hostname from path if present
      domain = domain.split('/')[0]
      // Remove port if present
      domain = domain.split(':')[0]
      // Remove any remaining whitespace
      domain = domain.trim()
      return domain
    }

    // Otherwise, construct domain from company name
    // Convert to lowercase, remove special characters, add .com
    const cleaned = companyNameOrUrl
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    return `${cleaned}.com`
  }
}

module.exports = new SumbleService()
