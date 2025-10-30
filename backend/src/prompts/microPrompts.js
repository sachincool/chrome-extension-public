/**
 * Micro-Prompt Templates for LinkedIntel
 * Optimized with Perplexity best practices for accuracy and efficiency
 */

// ============================================================================
// SHARED INSTRUCTION TEMPLATES (DRY Principle)
// ============================================================================

const SHARED_INSTRUCTIONS = {
  jsonOnlyResponse: `Return ONLY valid JSON. No markdown blocks, no explanations, no comments.`,

  searchRequired: `Search the web before responding.`,

  dateFormat: `Use YYYY-MM-DD format for dates.`,

  numericFormatting: `Use valid JSON numbers without commas (e.g., 3210.50 not 3,210.50). Strings can have formatting.`,

  noFabrication: `Use real information only. Return null or "Not disclosed" if data unavailable.`,
}

// ============================================================================
// TOKEN LIMITS & TEMPERATURE CONFIG
// ============================================================================

const TOKEN_LIMITS = {
  minimal: 300,
  small: 700,
  medium: 1200,
  large: 1600,
  xlarge: 2000,
}

const TEMPERATURE_CONFIG = {
  factual: 0.0, // Financial data, dates
  lowVariance: 0.1, // News, events
  balanced: 0.2, // Analysis
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build numbered search strategy section
 */
function buildSearchSection(title, searches) {
  const numbered = searches.map((s, i) => `${i + 1}. ${s}`).join('\n')
  return `${title} SEARCH STRATEGY:\n${numbered}`
}

/**
 * Build validation rules section
 */
function buildValidationRules(rules) {
  return `VALIDATION:\n${rules.map((r) => `- ${r}`).join('\n')}`
}

/**
 * Build requirements section
 */
function buildRequirements(reqs) {
  return `REQUIREMENTS:\n${reqs.map((r) => `- ${r}`).join('\n')}`
}

// ============================================================================
// MICRO-PROMPTS
// ============================================================================

const MICRO_PROMPTS = {
  /**
   * Stock & Financial Data Analysis
   * MUST use CURRENT data from TODAY (October 20, 2025)
   */
  stockData: {
    maxTokens: TOKEN_LIMITS.large,
    temperature: TEMPERATURE_CONFIG.factual,
    system: `Financial data specialist. Report CURRENT data from October 20, 2025. Search Yahoo Finance, Crunchbase, press releases. ${SHARED_INSTRUCTIONS.jsonOnlyResponse} ${SHARED_INSTRUCTIONS.noFabrication}`,

    user: (
      companyName
    ) => `Get financial data for "${companyName}" (Oct 20, 2025).

🔍 SEARCH:
PUBLIC: "[company name] stock price", "[company name] market cap revenue", "[company name] earnings"
PRIVATE: "[company name] crunchbase", "[company name] funding", "[company name] revenue"

If subsidiary → find PARENT company stock data (e.g., "Manulife Wealth" → parent "Manulife Financial")

📊 EXTRACT (4-6 metrics with real values):
PUBLIC: Market Cap, Revenue, Profit, Growth %, Stock Performance (from Yahoo Finance, earnings)
PRIVATE: Employee Count, Industry ONLY (funding data handled by separate prompt)

FORMAT: marketCap "94B", percentages "+15%", employees "5,200"

dynamicFinancials CRITICAL RULES:
- ✅ PUBLIC: Include Market Cap, Revenue, Profit, Growth from verified sources
- ✅ PRIVATE: Include ONLY Employee Count from LinkedIn/company page (NO funding data here)
- ❌ NEVER include: "Not disclosed", "Not available", "N/A", "null", "Not yet profitable"
- ❌ PRIVATE: DO NOT include funding data - it will be fetched separately with higher accuracy
- If no real verified data → omit that metric entirely from array

Return this JSON format:

{
  "isPublic": true,
  "isSubsidiary": false,
  "parentCompany": null,
  "symbol": "TRV",
  "exchange": "NYSE", 
  "price": 254.85,
  "ytd": 12.5,
  "yoy": 11.8,
  "marketCap": "60.7B",
  "currency": "USD",
  "industry": "Insurance",
  "employeeCount": "30,800",
  "validation": {
    "marketCapSource": "Yahoo Finance",
    "marketCapReported": "60.7B",
    "sharesOutstanding": "238.5M",
    "calculationCheck": "254.85 × 238.5M = 60.8B",
    "calculationVerified": true,
    "priceSource": "Yahoo Finance",
    "ytdSource": "Yahoo Finance",
    "dataTimestamp": "2025-10-20"
  },
  "performanceTrend": {
    "direction": "upward",
    "momentum": "accelerating",
    "volatility": "moderate",
    "context": "Outperforming sector average by 15%, up from 8% last quarter"
  },
  "dynamicFinancials": [
    {
      "label": "Market Cap",
      "value": "$912M"
    },
    {
      "label": "Annual Revenue (TTM)",
      "value": "$930.6M"
    },
    {
      "label": "YTD Performance",
      "value": "+250%"
    },
    {
      "label": "Revenue Growth (YoY)",
      "value": "+15%"
    },
    {
      "label": "Gross Margin",
      "value": "74.15%"
    }
  ],
  "notableInvestors": ["Sequoia Capital", "Andreessen Horowitz", "Tiger Global"],
  "financialSummary": {
    "priceTrajectory": {
      "direction": "up",
      "percentage": 12.5
    },
    "earningsPerformance": {
      "q1": "beat",
      "q2": "beat"
    },
    "sentiment": "positive",
    "sentimentReason": "Strong earnings growth and market expansion driving positive outlook",
    "revenueChange": {
      "direction": "up",
      "context": "Revenue increased 15% YoY according to Q2 earnings report"
    },
    "lastFunding": {
      "date": "2025-02-06",
      "amount": "$50M",
      "investors": ["Sequoia Capital", "Andreessen Horowitz"]
    }
  }
}

FIELD DEFINITIONS:

isSubsidiary: true if company is a subsidiary/division of a public parent company
parentCompany: Name of parent company if isSubsidiary=true (e.g., "Manulife Financial Corporation")

dynamicFinancials: 5-6 most relevant metrics based on company type
- PUBLIC: Market Cap, Revenue (TTM), YTD Performance, Quarterly Growth, Gross Margin, Free Cash Flow
- PRIVATE: Last Funding, Total Funding, Valuation, Revenue Estimate, Growth Rate, Profitability

notableInvestors: Top 3-5 early/strategic investors (for BOTH public and private)
- PUBLIC: Pre-IPO investors (VCs who backed before going public)
- PRIVATE: Current major investors

financialSummary:
- PUBLIC: priceTrajectory {direction, percentage}, earningsPerformance {q1, q2}, sentiment, sentimentReason, revenueChange
- PRIVATE: sentiment (growth-based), revenueChange, lastFunding {date, amount, investors}

performanceTrend: {direction, momentum, volatility, context}


${buildRequirements([
  'PUBLIC: Use EXACT market cap from Yahoo Finance (do not calculate)',
  'PUBLIC: If subsidiary, set isSubsidiary=true and show parent company data',
  'PUBLIC: Include revenue, profit, growth % from earnings/Yahoo Finance in dynamicFinancials',
  'PRIVATE: ONLY include employee count + industry in top-level fields',
  'PRIVATE: Set dynamicFinancials = [] (empty array) - funding will be fetched separately',
  '🚨 CRITICAL: NEVER include these in dynamicFinancials values: "Not disclosed", "Not available", "N/A", "null", "Not yet profitable"',
  '🚨 CRITICAL: If no real verified data for a metric → omit it entirely from array',
  'Include dates with values: "Revenue (2024): $5.2B", "Market Cap: $912M"',
  'notableInvestors: Top 3-5 pre-IPO investors (PUBLIC companies only)',
  'Use null for unavailable fields (not 0 or empty string)',
])}

${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,
  },

  /**
   * Private Company Financials
   * Funding data from Crunchbase, PitchBook, TechCrunch
   */
  privateCompanyFinancials: {
    maxTokens: TOKEN_LIMITS.large,
    temperature: TEMPERATURE_CONFIG.factual,
    system: `Private company funding analyst. Search Crunchbase, PitchBook, TechCrunch, company press releases for accurate funding data. ${SHARED_INSTRUCTIONS.jsonOnlyResponse} ${SHARED_INSTRUCTIONS.noFabrication}`,

    user: (companyName) => `Find complete funding history for "${companyName}".

🚨 ACCURACY CRITICAL: 
- VERIFY all amounts, dates, and investors from Crunchbase
- Cross-check with press releases and news articles
- If data conflicts, use Crunchbase as primary source
- DO NOT approximate or guess funding amounts
- PRIORITIZE 2024-2025 funding rounds - search these FIRST

🔍 MANDATORY SEARCH STEPS (in order):
1. "[company name] funding 2025" - check for latest rounds
2. "[company name] funding 2024" - check recent rounds
3. "[company name] crunchbase" - verify all rounds, investors, valuation
4. "[company name] raised series" - cross-check press releases
5. "[company name] revenue" OR "[company name] employees" - from LinkedIn, Forbes

Show ALL funding rounds (newest first). If 2024-2025 funding found, MUST include it.

PRIORITY: Latest funding (check 2024-2025 first), total raised, valuation, revenue, employees, notable investors.

Return this JSON format (ALL DATA MUST BE VERIFIED):
{
  "fundingRounds": [
    {
      "round": "Series B",
      "amount": "$50M",
      "date": "2024-06-15",
      "investors": ["Sequoia Capital", "Andreessen Horowitz", "Tiger Global"],
      "leadInvestor": "Sequoia Capital",
      "valuation": "$400M post-money",
      "source": "Crunchbase",
      "url": "https://www.crunchbase.com/organization/example-company/funding_rounds"
    },
    {
      "round": "Series A",
      "amount": "$15M",
      "date": "2022-03-10",
      "investors": ["Sequoia Capital", "Y Combinator"],
      "leadInvestor": "Sequoia Capital",
      "valuation": "$80M post-money",
      "source": "TechCrunch",
      "url": "https://techcrunch.com/2022/03/10/example-company-raises-15m"
    }
  ],
  "totalFunding": "$75M",
  "latestValuation": "$400M post-money",
  "fundingStage": "Series B",
  "revenueEstimate": "$20M ARR (2024)",
  "employees": "150",
  "dynamicFinancials": [
    {
      "label": "Latest Funding",
      "value": "$50M Series B (Jun 2024)"
    },
    {
      "label": "Total Raised",
      "value": "$75M"
    },
    {
      "label": "Valuation",
      "value": "$400M post-money"
    },
    {
      "label": "Annual Revenue",
      "value": "$20M ARR (2024)"
    },
    {
      "label": "Growth Rate",
      "value": "+150% YoY"
    }
  ],
  "growthMetrics": {
    "revenueGrowth": "+150% YoY (2024)",
    "employeeGrowth": "+80 in last 12 months",
    "customerGrowth": "500+ enterprise customers (2024)",
    "arr": "$20M ARR (2024)",
    "profitabilityStatus": "Pre-revenue / Seed stage / Profitable since Q1 2024"
  },
  "notableInvestors": ["Sequoia Capital", "Andreessen Horowitz", "Tiger Global"],
  "financialSummary": {
    "sentiment": "positive",
    "sentimentReason": "Strong revenue growth and successful Series B fundraise indicate healthy trajectory",
    "revenueChange": {
      "direction": "up",
      "context": "Revenue grew 150% YoY to $20M ARR, with accelerating enterprise adoption"
    },
    "lastFunding": {
      "date": "2024-06-15",
      "amount": "$50M",
      "round": "Series B",
      "investors": ["Sequoia Capital", "Andreessen Horowitz", "Tiger Global"]
    }
  },
  "lastUpdated": "2025-10-20",
  "sources": ["Crunchbase", "TechCrunch"]
}

dynamicFinancials: 3-5 key FINANCIAL metrics with real values only
- Focus on: Latest Funding, Total Raised, Valuation, Annual Revenue, Growth Rate, Profit Margin
- Format: "Latest Funding: $50M Series B (Jun 2024)", "Total Raised: $75M", "Revenue: $20M ARR (2024)"
- ❌ NEVER include: "Not disclosed", "Not available", "N/A", "null", "Not yet profitable"
- If no real data for a metric → omit it entirely

fundingStage: "Seed", "Series A/B/C/D+", "Growth", "Bootstrapped", "Family-owned", "Private"

notableInvestors: Top 3-5 investors from Crunchbase/press releases (or [] if none)

${buildRequirements([
  '🚨 VERIFY all funding amounts from Crunchbase + at least one other source',
  '🚨 Cross-check dates and investors across multiple sources',
  '🚨 If Crunchbase and news conflict, use Crunchbase data',
  'Show complete funding history (all rounds from Crunchbase)',
  'Include real URLs from Crunchbase, press releases, news articles',
  'Always include dates: "$50M Series B (Jun 2024)", "Total Raised: $8M"',
  '❌ dynamicFinancials: NEVER include "Not disclosed", "N/A", "Not yet profitable", or "Team Size"',
  '❌ dynamicFinancials: Focus ONLY on financial metrics (funding, valuation, revenue, growth)',
  '❌ If no real data for a metric → omit it entirely from dynamicFinancials array',
  'For large private companies: Search Forbes, Fortune, Bloomberg for revenue',
  'Mark estimates clearly: "~$20M revenue (est.)" if approximate',
])}

${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,
  },

  /**
   * Company Domain Resolution
   */
  companyDomain: {
    maxTokens: TOKEN_LIMITS.minimal,
    system: `You are a domain specialist. ${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,

    user: (
      companyName
    ) => `Find the official website domain for "${companyName}".

Return only the domain (e.g., "anthropic.com") without protocols, www, or paths. Use lowercase.

${SHARED_INSTRUCTIONS.jsonOnlyResponse}

{"domain": "example.com"}`,
  },

  /**
   * Company Challenges - What's Actually Happening
   */
  companyChallenges: {
    maxTokens: TOKEN_LIMITS.xlarge,
    system: `Business analyst. Report facts only - no ratings/scores. Numbers and dates required. ${SHARED_INSTRUCTIONS.noFabrication} ${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,

    user: (
      companyName
    ) => `Find negative news, layoffs, earnings concerns for "${companyName}" (last 12 months). Be brutally factual.

SEARCH STEPS:
1) Negative news with dates/numbers
2) PUBLIC: earnings quotes, revenue misses
3) Layoffs: numbers, dates, departments

🚨 FOR EARNINGS TRANSCRIPT URL (PUBLIC COMPANIES ONLY):
Step 1: Search "[company name] investor relations" to find their IR website (e.g., investors.manulife.com, ir.company.com)
Step 2: Search "[company name] earnings reports" or "[company name] quarterly results"
Step 3: If Canadian company (TSX, Toronto): Search "site:sedarplus.ca [company name]" for specific filings
Step 4: If US company (NYSE, NASDAQ): Search "site:sec.gov [company name] 10-Q" or "site:sec.gov [company name] 8-K"
Step 5: Search "[company name] seekingalpha earnings transcript" for latest call
Step 6: Search "[company name] earnings" and look for investor.company.com or ir.company.com URLs in results
Step 7: If you find ANY real URL in search results (investor relations page, SEDAR+ filing, SEC filing, SeekingAlpha), include it
Step 8: NEVER construct or guess URLs - only use URLs you actually see in search results
Step 9: If absolutely no URL found → use null

JSON:
{
  "isPrivateCompany": false,
  "negativeNewsSummary": "4-line summary with dates/numbers. If none: 'No significant negative news in last 12 months.'",
  "earningsCallNegativeNews": {
    "summary": "PUBLIC only: Quote executives, revenue miss %, guidance cuts. Set to null if private or no negative earnings news.",
    "url": "🚨 CRITICAL URL RULE: ONLY include URL if you see it in your search results. DO NOT construct/guess URLs. Search priority: 1) Company investor relations page (investor.company.com/earnings), 2) SEDAR+ for Canadian companies (sedarplus.ca), 3) SEC EDGAR for US companies, 4) PDF transcripts, 5) SeekingAlpha articles. If no URL found in results, use null. NEVER fabricate URLs."
  },
  "layoffNews": {
    "hasLayoffs": true,
    "summary": "Detailed summary of layoff news if any. Include exact dates, exact number of employees affected (number and percentage), exact departments impacted, exact reasons given. Return null if no layoffs.",
    "layoffEvents": [
      {
        "date": "2025-08-15",
        "employeesAffected": "200 employees (15% of workforce)",
        "departments": ["Engineering", "Sales"],
        "reason": "Exact reason stated in announcement",
        "source": "TechCrunch",
        "url": "https://..."
      }
    ]
  },
  "summary": "Factual 2-4 sentence summary with exact numbers and dates. Example: Company announced 200 layoffs (15% of workforce) on August 15, 2025 affecting engineering and sales teams. Product launch delayed by 6 months on July 20, 2025 due to technical issues.",
  "challenges": [
    {
      "category": "workforce",
      "description": "Exact description with numbers: 200 employees laid off (15% of workforce) across engineering and sales teams",
      "date": "2025-08-15",
      "source": "TechCrunch",
      "url": "https://..."
    },
    {
      "category": "operational",
      "description": "Exact description: Flagship product launch delayed by 6 months due to technical issues",
      "date": "2025-07-20",
      "source": "Bloomberg",
      "url": "https://..."
    }
  ],
  "timelineOfEvents": [
    {
      "date": "2025-08-15",
      "event": "200 employees laid off (15%)"
    },
    {
      "date": "2025-07-20", 
      "event": "Product launch delayed 6 months"
    }
  ]
}

BRUTAL HONESTY EXAMPLES:

Good: "CEO stated in Q2 earnings call: 'We missed revenue targets by $50M (12%) and are cutting 15% of workforce to reduce burn rate from $30M to $20M per quarter.'"

Good: "Company laid off 450 employees (25% of workforce) on March 15, 2025 including entire data science team (35 people) and 80% of marketing."

Good: "Stock dropped 45% after earnings miss. Revenue down 18% YoY. CEO resigned 2 weeks later."

Bad: "Facing some challenges" - TOO VAGUE
Bad: "High severity issue" - NO RATINGS
Bad: "Moderate concerns" - STATE THE ACTUAL FACTS

${buildRequirements([
  'negativeNewsSummary: REQUIRED - state actual facts, include exact numbers and dates',
  '🚨 earningsCallNegativeNews.url: CRITICAL - MUST be a URL you actually found in search results',
  "🚨 DO NOT construct, guess, or fabricate URLs - if you didn't see it in search, use null",
  '🚨 EARNINGS URL SEARCH STRATEGY (AGGRESSIVE - try ALL methods):',
  '  1. Search "[company name] investor relations" - look for investor.company.com or ir.company.com',
  '  2. Search "[company name] earnings reports" or "[company name] quarterly results"',
  '  3. Canadian (TSX): Search "site:sedarplus.ca [company name]" - look for specific filing URLs',
  '  4. US (NYSE/NASDAQ): Search "site:sec.gov [company name] 10-Q" or "site:sec.gov [company name] 8-K"',
  '  5. Search "[company name] seekingalpha earnings transcript" - look for seekingalpha.com URLs',
  '  6. Search "[company name] earnings" and look for ANY investor.company.com or ir.company.com URLs',
  '🚨 PRIORITY: Investor Relations page > SEDAR+/SEC specific filing > SeekingAlpha article',
  '🚨 ONLY include URL if it appears in your search results - NEVER construct/guess',
  '🚨 Examples of GOOD URLs (actually found in search):',
  '  ✅ https://investors.manulife.com/earnings-and-reports (investor relations)',
  '  ✅ https://ir.company.com/financial-information/quarterly-results (investor relations)',
  '  ✅ https://www.sedarplus.ca/csa-party/records/document.html?id=... (specific filing)',
  '  ✅ https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001234567 (specific company)',
  '  ✅ https://seekingalpha.com/article/4567890-company-q3-2024-earnings-call-transcript (specific call)',
  '🚨 Examples of BAD (DO NOT DO):',
  '  ❌ Constructed URLs: https://investors.company.com/earnings (if not in search results)',
  '  ❌ Generic paths: https://company.com/investor-relations (if not verified in search)',
  '  ❌ Landing pages: https://www.sedarplus.ca/landingpage/ (too generic)',
  '  ❌ Guessed URLs without verification',
  '🚨 If no specific URL found after ALL searches → earningsCallNegativeNews.url = null',
  'earningsCallNegativeNews.summary: Exact quotes with attribution, exact numbers, exact percentages',
  'earningsCallNegativeNews.summary: Set to null if private company or no negative earnings news',
  'earningsCallNegativeNews: Entire object can be null if no earnings data',
  'layoffNews: REQUIRED - exact numbers (X employees = Y% of workforce), exact dates, exact departments',
  'Summary: 2-4 sentences with exact numbers and dates',
  'Challenges: 0-6 items - exact descriptions with numbers, no severity ratings',
  'Timeline: exact dates with exact facts (not "layoffs announced" but "200 employees laid off")',
  'Empty arrays if no issues found',
  'No severity levels, no impact scores - just facts',
  'Include exact quotes from earnings calls with attribution',
])}

${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,
  },

  /**
   * Recent News & Sentiment Analysis
   */
  recentNews: {
    maxTokens: TOKEN_LIMITS.medium,
    temperature: TEMPERATURE_CONFIG.lowVariance,
    system: `Business news analyst. Search news sites, company blogs, LinkedIn, press releases. Last 6 months. ${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,

    user: (
      companyName
    ) => `Find 4-8 news items for "${companyName}" (last 6 months). Priority: Funding > Partnerships > Products > Financials > Leadership

🔍 SEARCH FOR:
1. "[company name] news 2024" OR "[company name] news 2025"
2. "[company name] partnership" OR "[company name] announces"
3. "[company name] funding" OR "[company name] raised"
4. "[company name] product launch" OR "[company name] customers"

Sources: TechCrunch, Bloomberg, Reuters, BusinessWire, company blog, LinkedIn posts, press releases

Return JSON array:
[
  {
    "title": "Company Announces Strategic Partnership with Microsoft",
    "summary": "The company partnered with Microsoft to integrate AI capabilities into Azure, expanding enterprise reach.",
    "date": "2025-08-15",
    "sentiment": "positive",
    "category": "partnership",
    "source": "Company Blog",
    "url": "https://..."
  }
]

Sentiment: positive (growth/funding/partnerships/awards), negative (layoffs/losses), neutral (routine)
Category: funding, partnership, product_launch, financial_results, leadership_change, market_expansion, customer_win, layoffs, recognition

${buildRequirements([
  '4-8 news items from any reliable source (news sites, company blog, LinkedIn, press releases)',
  'Real dates (YYYY-MM-DD) and URLs',
  'Summary: 1-2 sentences, focus on business impact',
  'INCLUDE partnerships, customer wins, product launches',
  'Empty array ONLY if absolutely no news found',
])}

${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,
  },

  /**
   * Growth Events Analysis
   */
  growthEvents: {
    maxTokens: TOKEN_LIMITS.medium,
    system: `Corporate intelligence analyst. Find significant events from past 12 months. ${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,

    user: (
      companyName
    ) => `Find 5-10 growth events for "${companyName}" (past 12 months).

🔍 SEARCH FOR:
1. "[company name] partnership 2024" OR "[company name] partnership 2025"
2. "[company name] funding 2024" OR "[company name] funding 2025"
3. "[company name] product launch" OR "[company name] announces"
4. "[company name] acquisition" OR "[company name] expansion"
5. "[company name] customers" OR "[company name] integration"

Include: funding rounds, partnerships, customer wins, acquisitions, product launches, integrations, expansions, executive appointments, layoffs.

Return JSON array (5-10 events):
[
  {
    "type": "funding",
    "activity": "Series A funding round led by Intel Capital",
    "amount": "$19M",
    "date": "2025-02-06"
  },
  {
    "type": "partnership",
    "activity": "Strategic partnership with Microsoft for cloud deployment",
    "amount": "",
    "date": "2025-01-15"
  },
  {
    "type": "product-launch",
    "activity": "Launched AI agent platform for enterprise customers",
    "amount": "",
    "date": "2024-12-10"
  }
]

Types: funding, layoffs, acquisition, product-launch, expansion, hiring, partnership, leadership

${buildRequirements([
  '4-8 events with verifiable dates (YYYY-MM-DD)',
  'Include amounts when available',
  'Order by date (most recent first)',
  'Empty array only if no events found',
])}

${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,
  },

  /**
   * Technology Stack Analysis
   */
  techStack: {
    maxTokens: TOKEN_LIMITS.small,
    system: `Technology analyst. Find confirmed tech from jobs, blogs, GitHub, StackShare, partnerships. [] if none. ${SHARED_INSTRUCTIONS.noFabrication} ${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,

    user: (companyName) => {
      const cleanName = companyName.replace(
        /\s+(Inc\.|Corp\.|LLC|Limited)$/i,
        ''
      )

      return `Find 5-15 confirmed technologies used by "${companyName}".

Sources: Job postings (LinkedIn), engineering blogs, GitHub, StackShare, BuiltWith, cloud partnerships.

Return JSON array:
[
  { "category": "CRM", "tool": "Salesforce" },
  { "category": "Cloud Platform", "tool": "AWS" },
  { "category": "Database", "tool": "PostgreSQL" }
]

Categories: CRM, Cloud Platform, Database, Programming Language, Analytics, Communication, Development, Marketing

Return [] if none found.

${SHARED_INSTRUCTIONS.jsonOnlyResponse}`
    },
  },

  /**
   * Company Activity - Recent Business Events
   */
  companyActivity: {
    maxTokens: TOKEN_LIMITS.large,
    system: `Business intelligence analyst. Find recent events from last 6 months. ${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,

    user: (
      companyName
    ) => `Find 6-10 activities for "${companyName}" (last 6 months): funding, partnerships, customers, products, hiring, exec changes. 1-sentence each.

🔍 SEARCH FOR:
1. "[company name] partnership 2024" OR "[company name] partnership 2025"
2. "[company name] funding" OR "[company name] raised"
3. "[company name] announces" OR "[company name] launches"
4. "[company name] customers" OR "[company name] integration"

PRIORITIZE partnerships and customer wins - these are critical for sales intelligence.

Return JSON array:
[
  {
    "type": "funding",
    "amount": "$50M",
    "fundingType": "Series B",
    "date": "2025-06-15",
    "source": "TechCrunch",
    "url": "https://...",
    "description": "Brief factual description"
  },
  {
    "type": "hiring",
    "roleCount": 25,
    "departments": ["Engineering", "Sales"],
    "date": "2025-08-01",
    "source": "LinkedIn Jobs",
    "url": "https://...",
    "description": "Brief factual description"
  },
  {
    "type": "expansion",
    "location": "Austin, TX",
    "date": "2025-07-10",
    "source": "Business Wire",
    "url": "https://...",
    "description": "Brief factual description"
  },
  {
    "type": "partnership",
    "partner": "Company Name",
    "date": "2025-06-15",
    "source": "PR Newswire",
    "url": "https://...",
    "description": "Brief factual description"
  },
  {
    "type": "product-launch",
    "product": "Product Name",
    "date": "2025-05-20",
    "source": "Company Blog",
    "url": "https://...",
    "description": "Brief factual description"
  },
  {
    "type": "executive-change",
    "role": "New CTO hired",
    "date": "2025-04-10",
    "source": "LinkedIn",
    "url": "https://...",
    "description": "Brief factual description"
  }
]

Types: funding, hiring, expansion, partnership, product-launch, executive-change

${buildRequirements([
  'Max 5-6 events, 1 sentence descriptions',
  'Include dates (YYYY-MM-DD), amounts, sources, URLs',
  'Empty array if no activity',
])}

${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,
  },

  /**
   * Priority Contacts - Executive Intelligence
   */
  priorityContacts: {
    maxTokens: TOKEN_LIMITS.medium,
    system: `Executive research specialist. Find C/VP-level. NO LinkedIn URLs or citations. ${SHARED_INSTRUCTIONS.noFabrication} ${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,

    user: (companyName) => `Find 3-5 top execs at "${companyName}".

Priority: CEO → CTO → CFO → VP Sales → VP Marketing → VP Eng → COO → CPO

Include: Name, title, recent activity + source.

Return JSON array:
[
  {
    "name": "Exact Full Name",
    "title": "Exact Current Title",
    "recentActivity": "Specific recent activity with details and source",
    "department": "Engineering|Sales|Marketing|Operations|Product|Executive"
  }
]

${buildRequirements([
  '3-5 executives with real names',
  'No LinkedIn URLs or citation markers',
  'Include verifiable recent activity with source',
])}

${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,
  },

  /**
   * Company Intelligence - SDR Insights
   */
  companyIntelligence: {
    maxTokens: TOKEN_LIMITS.medium,
    system: `Sales intelligence analyst. Find actionable insights from last 3 months. ${SHARED_INSTRUCTIONS.noFabrication} ${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,

    user: (
      companyName
    ) => `Find sales intelligence for "${companyName}" (last 3 months).

1. Pain Points (3-4): Infrastructure/scaling challenges, tech debt, growth bottlenecks
2. Recent Activities (3-4): Funding, products, hires, partnerships
3. Industry Context (2 sentences): Market position, strategy
4. Executive Quotes (2-3): Direct quotes with attribution

Return JSON:
{
  "painPoints": [
    {
      "challenge": "Infrastructure scaling challenges as team grows from 200 to 500 employees",
      "source": "CTO interview, TechCrunch",
      "date": "2025-08-15",
      "url": "https://..."
    },
    {
      "challenge": "Manual deployment processes slowing product velocity",
      "source": "VP Engineering blog post",
      "date": "2025-07-20",
      "url": "https://..."
    }
  ],
  "recentActivities": [
    "Raised $50M Series B funding led by Intel Capital (Feb 2025)",
    "Launched AI-powered analytics platform for enterprise (Jan 2025)",
    "Appointed new VP of Engineering from Google (Aug 2025)",
    "Opened European headquarters in London (Jul 2025)"
  ],
  "industryContext": "Leading player in healthcare technology analytics with strong focus on AI-powered insights and regulatory compliance. Company is positioned as an innovator in the rapidly growing healthtech sector, competing primarily on data security and integration capabilities while expanding into new vertical markets.",
  "executiveQuotes": [
    {
      "quote": "Our biggest challenge is scaling our infrastructure while maintaining the security and compliance standards our healthcare customers require",
      "executive": "Sarah Chen, CTO",
      "source": "TechCrunch interview",
      "date": "2025-08-15"
    },
    {
      "quote": "We're doubling down on AI capabilities this year with significant R&D investment",
      "executive": "John Smith, CEO",
      "source": "Q2 Earnings Call",
      "date": "2025-07-20"
    }
  ]
}

${buildRequirements([
  'Max 3-4 items per array',
  'Include sources, dates, URLs',
  'Specific and concrete (no generic statements)',
  'Quotes need full attribution (name, title, source, date)',
  'Empty arrays if no data',
])}

${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,
  },

  /**
   * Industry Context - Company Intelligence
   */
  industryContext: {
    maxTokens: TOKEN_LIMITS.xlarge,
    system: `Market research analyst. Find overview, competitors, customers, case studies. Concise. ${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,

    user: (companyName) => {
      const domain = companyName.toLowerCase().replace(/\s+/g, '')

      return `Find market intelligence for "${companyName}".

- Description: 4-5 sentences (~400 chars) - what they do, industry, value prop
- Founded/HQ: Basic info
- Products: 4-5 sentences on offerings/markets
- Customers: 2-3 sentences on who/how they sell
- Competitors: 6-8 direct
- Clients: 6-8 public (search site + news)
- Case Studies: 2-3 with real URLs

Return JSON:
{
  "description": "TrueFoundry is a comprehensive AI and machine learning operations platform that helps data science teams deploy, monitor, and scale ML models in production. The company provides tools for model serving, LLM operations, and AI gateway functionality, targeting enterprises looking to streamline their AI deployment workflows. Founded in 2022, TrueFoundry focuses on simplifying the complexity of ML infrastructure while maintaining enterprise-grade security and compliance standards. The platform supports both traditional ML workloads and modern LLM-based applications with features like cost optimization and observability.",
  "foundedYear": "2022",
  "headquarters": "Bangalore, Karnataka, India",
  "productsAndVerticals": "TrueFoundry builds an end-to-end ML operations platform that helps data science teams deploy, monitor, and scale machine learning models in production environments. Its tools include Model Serving for inference, LLMOps for managing large language models, and AI Gateway for cost optimization and observability. The platform addresses challenges like infrastructure complexity, deployment delays, and cost management for enterprises adopting AI at scale. Together, these solutions enable faster time-to-production for ML models while maintaining security, compliance, and operational efficiency.",
  "customerSegments": "TrueFoundry sells to enterprise data science teams, AI/ML engineering organizations, and technology companies building AI-powered products (via direct sales and cloud marketplaces). It earns revenue from software subscriptions based on infrastructure usage, professional services for implementation, and enterprise support contracts.",
  "competitors": [
    "Databricks",
    "MLflow",
    "Weights & Biases",
    "Neptune.ai",
    "Valohai",
    "Kubeflow",
    "Seldon",
    "BentoML",
    "Ray.io",
    "Tecton",
    "Feast",
    "Metaflow"
  ],
  "customers": [
    "Meesho",
    "Birlasoft",
    "Sigmoid",
    "Tiger Analytics",
    "LatentView Analytics"
  ],
  "caseStudies": [
    {
      "company": "Meesho",
      "description": "Scaled ML deployment from 10 to 100+ models using TrueFoundry's platform, reducing deployment time by 70%",
      "url": "https://www.truefoundry.com/case-studies/meesho",
    }
  ]
}

${buildRequirements([
  'Description/productsAndVerticals: 4 lines (~400-500 chars)',
  'CustomerSegments: 2 lines (~200-250 chars)',
  'Competitors/Customers: 6-8 max',
  'Case Studies: 2-3 max with real URLs',
  'All strings properly closed (no truncation)',
])}

${SHARED_INSTRUCTIONS.jsonOnlyResponse}`
    },
  },

  // ============================================================================
  // PERSON ANALYSIS PROMPTS (Factual modules - no speculation)
  // ============================================================================

  /**
   * Person Basic Information
   */
  personBasicInfo: {
    maxTokens: TOKEN_LIMITS.minimal,
    system: `Professional research specialist. Find verifiable info only. ${SHARED_INSTRUCTIONS.noFabrication} ${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,

    user: (
      name,
      title,
      company
    ) => `Find professional information for "${name}" who is ${title} at "${company}".

Return JSON:
{
  "fullName": "Jane Doe",
  "title": "Chief Technology Officer",
  "company": "Acme Inc",
  "executiveLevel": "C-Suite|VP|Director|Manager|IC",
  "yearsInRole": 3,
  "linkedinUrl": "https://linkedin.com/in/janedoe",
  "twitterHandle": "@janedoe",
  "previousRole": "VP Engineering at TechCorp (2019-2022)"
}

${buildRequirements(['Real info only', 'Use null for unknown fields'])}

${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,
  },

  /**
   * Person Quoted Challenges
   */
  personQuotedChallenges: {
    maxTokens: TOKEN_LIMITS.small,
    system: `Research analyst. Find challenges from interviews/articles/podcasts (last 12-18 months). ${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,

    user: (name, title, company) => {
      const cleanName = name.replace(', PhD', '').replace(', MBA', '')

      return `Find 3-4 challenges or priorities mentioned by "${name}" (${title}) at "${company}" from the last 12-18 months.

Sources: Interviews, podcasts, conference talks, LinkedIn posts, articles.

Return JSON (max 3-4):
{
  "quotedChallenges": [
    {
      "quote": "Our biggest challenge is scaling infrastructure while maintaining HIPAA compliance",
      "source": "TechCrunch Interview",
      "date": "2025-08-15",
      "url": "https://techcrunch.com/...",
      "context": "Discussing Q3 growth plans"
    },
    {
      "quote": "In a conference talk, discussed the challenge of finding senior ML engineers with healthcare experience",
      "source": "Healthcare AI Summit",
      "date": "2025-07-20",
      "url": "https://conference.com/...",
      "context": "Talking about hiring challenges"
    }
  ]
}

${buildRequirements([
  'Max 3-4 most relevant',
  'Include source, date (YYYY-MM-DD), URL, context',
  'Accept quotes, paraphrased content, strategic priorities',
])}

${SHARED_INSTRUCTIONS.jsonOnlyResponse}`
    },
  },

  /**
   * Person Social Activity
   */
  personSocialActivity: {
    maxTokens: TOKEN_LIMITS.xlarge,
    system: `Social media intelligence analyst. Find RECENT LinkedIn posts, media, speaking, awards (2024-2025 prioritized). ${SHARED_INSTRUCTIONS.jsonOnlyResponse}

Sentiment: promotional, thought-leadership, professional, personal, neutral`,

    user: (name, title, company) => {
      const cleanName = name.replace(', PhD', '').replace(', MBA', '')

      return `Find 5-15 RECENT social media activities and public appearances for "${name}" (${title}) at "${company}" (prioritize 2024-2025, max 18 months back).

Include: LinkedIn posts, conference speaking, media interviews, awards, company announcements.

Return JSON:
{
  "posts": [
    {
      "date": "2025-09-15",
      "platform": "LinkedIn",
      "type": "post",
      "content": "Brief summary of post content (2 sentences max)",
      "topics": ["AI", "Healthcare"],
      "sentiment": "promotional",
      "url": "https://linkedin.com/posts/...",
      "isShared": false
    },
    {
      "date": "2025-09-10",
      "platform": "LinkedIn",
      "type": "repost",
      "content": "Shared article about AI regulations with commentary on healthcare implications",
      "topics": ["AI", "Regulation"],
      "sentiment": "thought-leadership",
      "url": "https://linkedin.com/posts/...",
      "isShared": true,
      "originalAuthor": "John Smith"
    },
    {
      "date": "2025-08-20",
      "platform": "LinkedIn",
      "type": "interview",
      "content": "Quoted in TechCrunch article discussing AI leadership challenges",
      "topics": ["AI", "Leadership"],
      "sentiment": "professional",
      "url": "https://techcrunch.com/...",
      "isShared": false
    }
  ]
}

Platform: LinkedIn, Twitter, Facebook
Type: post, article, repost, appointment, award, speaking, interview, announcement
Sentiment: REQUIRED for every post

${buildRequirements([
  '5-15 posts, last 12-18 months',
  'Dates (YYYY-MM-DD), real URLs',
  'Content: 2 sentences max',
  'Sentiment required for every post',
])}

${SHARED_INSTRUCTIONS.jsonOnlyResponse}`
    },
  },

  /**
   * Person Media Presence
   */
  personMediaPresence: {
    maxTokens: TOKEN_LIMITS.xlarge,
    system: `Media intelligence analyst. Find RECENT press, speaking, awards, content (2024-2025 prioritized). ${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,

    user: (name, title, company) => {
      const cleanName = name.replace(', PhD', '').replace(', MBA', '')

      return `Find 5-15 RECENT media presence items for "${name}" (${title}) at "${company}" (prioritize 2024-2025, max 18 months back).

Include: Press interviews, conference speaking, industry awards, published articles/blogs/podcasts.

Sources: LinkedIn, TechCrunch, Forbes, industry publications, conference websites.

Return JSON:
{
  "pressFeatures": [
    {
      "publication": "TechCrunch",
      "title": "How CTOs are scaling AI infrastructure in healthcare",
      "type": "interview",
      "date": "2025-08-15",
      "url": "https://techcrunch.com/...",
      "topics": ["AI infrastructure", "Healthcare"]
    }
  ],
  "speakingEngagements": [
    {
      "event": "Healthcare AI Summit 2025",
      "role": "keynote",
      "topic": "Enterprise AI Governance in Clinical Settings",
      "date": "2025-09-20",
      "location": "San Francisco, CA",
      "url": "https://..."
    }
  ],
  "awards": [
    {
      "award": "Top 50 Healthcare Tech Leaders",
      "organization": "HealthTech Magazine",
      "date": "2025-07-01",
      "url": "https://..."
    }
  ],
  "publishedContent": [
    {
      "title": "The Future of AI Compliance in Healthcare",
      "type": "article",
      "publication": "Forbes",
      "date": "2025-06-10",
      "url": "https://forbes.com/..."
    }
  ]
}

Press type: interview, profile, quote, podcast
Speaking role: keynote, panelist, speaker, moderator
Content type: article, blog, whitepaper, newsletter

${buildRequirements([
  '5-15 items total (speaking, awards, content, press)',
  'Dates (YYYY-MM-DD), real URLs',
  'Empty arrays if no results',
])}

${SHARED_INSTRUCTIONS.jsonOnlyResponse}`
    },
  },

  /**
   * Person Qualification Reality Check
   */
  personRiskSignals: {
    maxTokens: TOKEN_LIMITS.medium,
    system: `Sales qualification analyst. Hard facts only - no scores/ratings/diplomacy. ${SHARED_INSTRUCTIONS.noFabrication} ${SHARED_INSTRUCTIONS.jsonOnlyResponse}`,

    user: (name, title, company) => {
      const cleanName = name.replace(', PhD', '').replace(', MBA', '')

      return `State the brutal facts about "${name}" (${title}) at "${company}". Be direct and honest.

VERIFY THESE FACTS:

1. Company Size & Role Reality:
   - How many employees does the company have?
   - For specialized roles (CDO, Chief Data Officer, Chief AI Officer, ML Director):
     * Companies <200 employees: This role only makes sense if company IS a data/AI/tech company
     * Companies 200-500: Person needs clear technical background
     * Companies >500: More common across industries
   - For C-level in companies <100 employees: Is this person a founder or recently hired?

2. Technical Background Reality:
   - Search LinkedIn for this person's previous roles
   - For technical titles (CTO, CDO, VP Engineering, Chief AI Officer):
     * Has this person ACTUALLY worked with relevant technologies/platforms?
     * Have they ACTUALLY managed technical teams before?
     * Or are their previous roles business/operations focused?

3. Team Reality:
   - Search LinkedIn: Does this company ACTUALLY have the technical team for this role?
   - For data/AI roles: Search "ML Engineer at [company]", "Data Scientist at [company]", "Data Engineer at [company]"
   - For engineering roles: Search "Software Engineer at [company]" in relevant domains
   - Report the actual numbers you find

4. Industry Reality:
   - What industry is this company actually in?
   - Does this role make sense for this industry at this company size?

Return ONLY factual observations (empty array if no concerns):
{
  "realityCheck": [
    {
      "observation": "Direct factual statement of what you found",
      "evidence": "Specific evidence - numbers, LinkedIn search results, profile details, dates",
      "source": "Where you found this (LinkedIn search, profile, company page, etc)"
    }
  ]
}

EXAMPLES OF BRUTAL HONESTY:

Good: "Company has 170 employees. LinkedIn search shows 0 ML Engineers, 0 Data Scientists, 0 Data Engineers at this company. Person's LinkedIn shows no previous experience with AI/ML platforms - all previous roles were in business operations."

Good: "Person is 'Chief AI Officer' at 85-person retail company. LinkedIn search finds 2 software engineers total, both working on e-commerce. No AI/ML team exists. Person's background: 15 years in retail operations, became CAO 3 months ago."

Good: "CDO at 200-person healthcare company. LinkedIn shows 6 Data Engineers, 4 Data Scientists, 3 ML Engineers. Person was previously VP Engineering at major tech company for 8 years. Team and background check out."

Bad: "May not be a good fit" - TOO VAGUE
Bad: "High risk signal" - NO SCORES
Bad: "Consider proceeding with caution" - NO ADVICE, JUST FACTS

${buildRequirements([
  'Empty array if everything checks out',
  'State ONLY verifiable facts - numbers, dates, LinkedIn search results',
  'No scores, ratings, or severity levels',
  'No recommendations or advice - just observations',
  'Be brutally direct - if something looks wrong, say exactly what looks wrong',
  'Use actual LinkedIn search results and numbers',
])}

${SHARED_INSTRUCTIONS.jsonOnlyResponse}`
    },
  },
}

module.exports = { MICRO_PROMPTS }
