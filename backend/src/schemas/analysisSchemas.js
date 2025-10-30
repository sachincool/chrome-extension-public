/**
 * Zod Schemas for Analysis Data Validation
 *
 * Schema Version: 6
 *
 * These schemas define the expected structure of company and person analysis data.
 * Used for cache validation to ensure data integrity and automatic cache invalidation
 * when schema structure changes.
 *
 * To update schemas:
 * 1. Increment SCHEMA_VERSION constant
 * 2. Update schema definitions
 * 3. Old cache entries will auto-invalidate on next read
 *
 * Version History:
 * - v1: Initial schema with dual cache system
 * - v2: Cache consolidation - single source of truth (analysis_cache only)
 * - v3: Expanded financialSummary to include private company fields (fundingRounds, totalFunding, latestValuation, etc.)
 * - v4: Added overview section (isPublic, employeeCount, industry) separate from stockInfo/financials
 * - v5: Removed scores/ratings - brutal facts only (removed severity from challenges, impact from timeline, ICP scores from person)
 * - v6: Fixed nullable validation for dynamicFinancials, priceTrajectory, earningsPerformance, earningsCallNegativeNews
 */

const { z } = require('zod')

// Schema version constant
// Incrementing this invalidates ALL old cache entries
const SCHEMA_VERSION = 6

// ============================================
// SUB-SCHEMAS FOR NESTED OBJECTS
// ============================================

// Overview section - company basics for Overview tab
const OverviewSchema = z.object({
  isPublic: z.boolean(),
  employeeCount: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
})

// Stock/Financial data - for Financial tab (employee count removed)
const StockInfoSchema = z.object({
  symbol: z.string(),
  exchange: z.string(),
  price: z.number().nullable(), // Allow null for unavailable data
  ytd: z.number().nullable(), // Allow null for unavailable data
  yoy: z.number().nullable().optional(),
  marketCap: z.string().nullable(), // Allow null for unavailable data
  currency: z.string(),
  isSubsidiary: z.boolean().optional(), // True if showing parent company data
  parentCompany: z.string().nullable().optional(), // Parent company name
  dynamicFinancials: z
    .array(
      z.object({
        label: z.string(),
        value: z.string().nullable(), // Allow null for unavailable metrics
      })
    )
    .optional()
    .default([]), // Default to empty array if not provided
  performanceTrend: z
    .object({
      direction: z.string().nullable(),
      momentum: z.string().nullable(),
      volatility: z.string().nullable(),
      context: z.string().nullable(),
    })
    .nullable()
    .optional(),
  financials: z
    .object({
      revenueTTM: z.string().nullable().optional(),
      netIncomeQ2: z.string().nullable().optional(),
      freeCashFlowQ2: z.string().nullable().optional(),
      grossMargin: z.string().nullable().optional(),
    })
    .optional(),
  financialSummary: z
    .object({
      // PUBLIC COMPANY FIELDS (isPublic: true)
      priceTrajectory: z
        .object({
          direction: z.string().nullable(), // Allow null for unavailable data
          percentage: z.number().nullable(), // Allow null for unavailable data
        })
        .nullable()
        .optional(),
      earningsPerformance: z
        .object({
          q1: z.string().nullable(), // Allow null for unavailable data
          q2: z.string().nullable(), // Allow null for unavailable data
        })
        .nullable()
        .optional(),

      // PRIVATE COMPANY FIELDS (isPublic: false)
      fundingRounds: z
        .array(
          z.object({
            round: z.string(), // "Seed", "Series A", "Series B", etc.
            amount: z.string(), // "$10M", "$50M", etc.
            date: z.string(), // "2024-05-15"
            investors: z.array(z.string()).optional(),
            leadInvestor: z.string().optional(),
            valuation: z.string().optional(), // Post-money valuation
            source: z.string().optional(),
            url: z.string().optional(),
          })
        )
        .nullable()
        .optional(),
      totalFunding: z.string().nullable().optional(), // "$150M"
      latestValuation: z.string().nullable().optional(), // "$1.2B"
      revenueEstimate: z.string().nullable().optional(), // "$50M ARR (estimated)"
      growthMetrics: z
        .object({
          revenueGrowth: z.string().nullable().optional(), // "150% YoY"
          employeeGrowth: z.string().nullable().optional(), // "2x in past year"
          customerGrowth: z.string().nullable().optional(), // "500+ customers"
        })
        .nullable()
        .optional(),

      // SHARED FIELDS (both public & private)
      sentiment: z.string().nullable().optional(),
      sentimentReason: z.string().nullable().optional(),
      revenueChange: z
        .object({
          direction: z.string().nullable(),
          context: z.string().nullable(),
        })
        .nullable()
        .optional(),
      lastFunding: z
        .object({
          date: z.string().nullable(),
          amount: z.string().nullable(),
          investors: z.array(z.string()).nullable().optional(),
        })
        .nullable()
        .optional(),

      // DATA QUALITY FIELDS
      lastUpdated: z.string().nullable().optional(), // "2025-10-15"
      sources: z.array(z.string()).nullable().optional(), // ["Crunchbase", "TechCrunch"]
    })
    .optional(),
})

const NewsItemSchema = z.object({
  title: z.string(),
  summary: z.string(),
  date: z.string(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  category: z.string().optional(),
  source: z.string(),
  url: z.string().optional(),
})

const GrowthEventSchema = z.object({
  type: z.string(),
  activity: z.string(),
  amount: z.string().optional(),
  date: z.string(),
})

const TechStackItemSchema = z.object({
  category: z.string(),
  tool: z.string(),
  verified: z.boolean(),
  source: z.enum(['sumble', 'perplexity', 'perplexity-fallback']),
  jobsCount: z.number().optional(),
  teamsCount: z.number().optional(),
  peopleCount: z.number().optional(),
  lastJobPost: z.string().nullable().optional(),
  verificationUrl: z.string().optional(),
  teamsDataUrl: z.string().optional(),
  hiringIntensity: z.enum(['HOT', 'WARM', 'COLD']).optional(),
  daysSinceLastPost: z.number().nullable().optional(),
})

const CompanyActivitySchema = z.object({
  type: z.string(),
  role: z.string().optional(),
  date: z.string().optional(),
  source: z.string().optional(),
  url: z.string().optional(),
  description: z.string().optional(),
  note: z.string().optional(),
  timestamp: z.string().optional(),
  technology: z.string().optional(),
  jobCount: z.number().optional(),
  amount: z.string().optional(),
  fundingType: z.string().optional(),
  roleCount: z.number().optional(),
  departments: z.array(z.string()).optional(),
  location: z.string().optional(),
  partner: z.string().optional(),
  product: z.string().optional(),
})

const PriorityContactSchema = z.object({
  name: z.string(),
  title: z.string(),
  profileUrl: z.string().nullable(),
  verified: z.boolean().optional(),
  source: z.enum(['sumble', 'perplexity', 'perplexity-fallback']).optional(),
  jobFunction: z.string().optional(),
  jobLevel: z.string().optional(),
  location: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  startDate: z.string().optional(),
  tenure: z.string().optional(),
  tenureCategory: z.string().optional(),
  tenureMonths: z.number().optional(),
  sumbleId: z.number().optional(),
  sumbleUrl: z.string().optional(),
  recentActivity: z.string().optional(),
})

const CompanyChallengeSchema = z.object({
  category: z.string(),
  description: z.string(),
  date: z.string(),
  source: z.string(),
  url: z.string(),
})

const PrivateFinancialsSchema = z.object({
  fundingRounds: z
    .array(
      z.object({
        round: z.string(), // "Seed", "Series A", "Series B", etc.
        amount: z.string(), // "$10M", "$50M", etc.
        date: z.string(), // "2024-05-15"
        investors: z.array(z.string()).optional(), // ["Sequoia Capital", "Andreessen Horowitz"]
        leadInvestor: z.string().optional(),
        valuation: z.string().optional(), // "$500M" (post-money)
        source: z.string().optional(),
        url: z.string().optional(),
      })
    )
    .nullable()
    .optional(),
  totalFunding: z.string().nullable().optional(), // "$150M"
  latestValuation: z.string().nullable().optional(), // "$1.2B"
  revenueEstimate: z.string().nullable().optional(), // "$50M ARR" or "Not disclosed"
  employees: z.string().nullable().optional(), // "200-500"
  growthMetrics: z
    .object({
      revenueGrowth: z.string().optional(), // "150% YoY"
      employeeGrowth: z.string().optional(), // "2x in past year"
      customerGrowth: z.string().optional(), // "500+ customers"
    })
    .optional(),
  lastUpdated: z.string(), // "2025-10-15"
  sources: z.array(z.string()).optional(), // ["Crunchbase", "TechCrunch"]
})

// ============================================
// MAIN COMPANY ANALYSIS SCHEMA (v4)
// ============================================

const CompanyAnalysisSchema = z.object({
  companyName: z.string(),
  overview: OverviewSchema.optional(), // Company basics for Overview tab
  stockInfo: StockInfoSchema.optional(),
  privateFinancials: PrivateFinancialsSchema.nullable().optional(),
  industryContext: z
    .object({
      description: z.string(),
      foundedYear: z.string().nullable().optional(),
      headquarters: z.string().nullable().optional(),
      productsAndVerticals: z.string().nullable().optional(),
      customerSegments: z.string().nullable().optional(),
      competitors: z.array(z.string()),
      customers: z.array(z.string()).optional(),
      caseStudies: z.array(z.any()).optional(),
    })
    .optional(),
  recentNews: z.array(NewsItemSchema),
  growthEvents: z.array(GrowthEventSchema),
  techStack: z.array(TechStackItemSchema),
  companyChallenges: z
    .object({
      isPrivateCompany: z.boolean().optional(),
      negativeNewsSummary: z.string().optional(),
      earningsCallNegativeNews: z
        .object({
          summary: z.string().nullable(), // Allow null when no earnings data
          url: z.string().nullable(), // Allow null when URL not found
        })
        .nullable()
        .optional(),
      layoffNews: z
        .object({
          hasLayoffs: z.boolean(),
          summary: z.string().nullable(),
          layoffEvents: z
            .array(
              z.object({
                date: z.string(),
                employeesAffected: z.string(),
                departments: z.array(z.string()).nullable().optional(),
                reason: z.string().optional(),
                source: z.string(),
                url: z.string(),
              })
            )
            .optional(),
        })
        .optional(),
      summary: z.string(),
      challenges: z.array(CompanyChallengeSchema),
      timelineOfEvents: z
        .array(
          z.object({
            date: z.string(),
            event: z.string(),
          })
        )
        .optional(),
    })
    .optional(),
  companyActivity: z.array(CompanyActivitySchema),
  priorityContacts: z.array(PriorityContactSchema),
  companyIntelligence: z
    .object({
      painPoints: z
        .array(
          z.object({
            challenge: z.string(),
            source: z.string(),
            date: z.string(),
            url: z.string(),
          })
        )
        .optional(),
      recentActivities: z.array(z.string()).optional(),
      industryContext: z.string().optional(),
      executiveQuotes: z
        .array(
          z.object({
            quote: z.string(),
            executive: z.string(),
            source: z.string(),
            date: z.string(),
          })
        )
        .optional(),
    })
    .optional(),
  recommendation: z
    .object({
      action: z.string(),
      reasoning: z.string(),
    })
    .optional(),

  // Metadata for versioning and cache management
  metadata: z
    .object({
      schemaVersion: z.literal(SCHEMA_VERSION), // Must match current SCHEMA_VERSION (2)
      sources: z.array(z.string()).optional(),
    })
    .optional(),
})

// ============================================
// MAIN PERSON ANALYSIS SCHEMA (v1)
// ============================================

const PersonAnalysisSchema = z.object({
  name: z.string(),
  title: z.string(),
  company: z.string(),
  isCXO: z
    .object({
      value: z.boolean(),
      level: z.string(),
      confidence: z.string(),
    })
    .optional(),
  authorityIndicators: z.array(z.string()).optional(),
  budgetAuthority: z.boolean().optional(),
  budgetCycle: z
    .object({
      timing: z.string().nullable(),
      fiscalYear: z.string().nullable(),
      confidence: z.string(),
    })
    .optional(),
  contactPreferences: z
    .object({
      accessibility: z.string(),
      bestTimes: z.array(z.string()),
      preferredChannels: z.array(z.string()),
      responseRate: z.string(),
    })
    .optional(),
  recentActivity: z
    .object({
      posts: z
        .array(
          z.object({
            date: z.string(),
            platform: z.string(),
            type: z.string(),
            content: z.string(),
            topics: z.array(z.string()),
            sentiment: z.string().optional(),
            url: z.string().nullable().optional(),
            isShared: z.boolean().optional(),
            originalAuthor: z.string().nullable().optional(),
          })
        )
        .optional(),
    })
    .optional(),
  publiclyStatedPainPoints: z
    .array(
      z.object({
        tag: z.string(),
        priority: z.string(),
        context: z.string().optional(),
        source: z.string().optional(),
        date: z.string().optional(),
      })
    )
    .optional(),
  quotedChallenges: z
    .array(
      z.object({
        challenge: z.string(),
        quote: z.string(),
        source: z.string(),
        date: z.string(),
        url: z.string().optional(),
      })
    )
    .optional(),
  conversationHooks: z.array(z.string()).optional(),

  // ✅ CRITICAL: These structures are REQUIRED (not optional) for UI consistency
  // Even if data is empty, the structure must always be present
  speakingEngagements: z.object({
    events: z
      .array(
        z.object({
          event: z.string(),
          role: z.string(),
          topic: z.string(),
          date: z.string(),
          url: z.string().optional(),
          sdrValue: z.string().optional(),
        })
      )
      .default([]), // Default to empty array if not provided
    awards: z
      .array(
        z.object({
          award: z.string(),
          organization: z.string(),
          date: z.string(),
          url: z.string().optional(),
        })
      )
      .default([]),
    industryInvolvement: z.array(z.any()).default([]),
  }),

  contentCreation: z.object({
    publishedContent: z.array(z.any()).default([]),
    mediaAppearances: z.array(z.any()).default([]),
    contentFrequency: z.string().nullable().optional(),
    expertiseAreas: z.array(z.string()).default([]),
  }),

  mediaPresence: z.object({
    pressFeatures: z.array(z.any()).default([]),
    thoughtLeadership: z.string().nullable().optional(),
    speakingEngagements: z.array(z.any()).default([]),
    awards: z.array(z.any()).default([]),
    publishedContent: z.array(z.any()).default([]),
  }),
  influenceNetwork: z.array(z.string()).optional(),
  recentAchievements: z
    .array(
      z.object({
        achievement: z.string(),
        date: z.string(),
        source: z.string(),
        url: z.string().optional(),
      })
    )
    .optional(),
  contentTone: z.string().optional(),
  engagement: z.number().optional(),

  // Reality Check - Brutal facts about qualification
  realityCheck: z
    .array(
      z.object({
        observation: z.string(),
        evidence: z.string(),
        source: z.string(),
      })
    )
    .optional(),

  // Metadata
  metadata: z
    .object({
      schemaVersion: z.literal(SCHEMA_VERSION), // Must match current SCHEMA_VERSION (2)
      sources: z.array(z.string()).optional(),
    })
    .optional(),
})

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Main schemas
  CompanyAnalysisSchema,
  PersonAnalysisSchema,

  // Schema version constant
  SCHEMA_VERSION,

  // Export sub-schemas for testing/reuse
  OverviewSchema,
  StockInfoSchema,
  PrivateFinancialsSchema,
  NewsItemSchema,
  GrowthEventSchema,
  TechStackItemSchema,
  CompanyActivitySchema,
  PriorityContactSchema,
  CompanyChallengeSchema,
}
