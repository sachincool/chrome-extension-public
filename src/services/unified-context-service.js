// Unified Context Service - Single Source of Truth for All Chrome AI Features
// Aggregates: LinkedIn DOM data, Backend insights, Posts data, Intelligence signals
// Used by: AI Composer, Outreach Generator, Summary Badge, All AI features

const contextLogger = window.createLogger ? window.createLogger('UnifiedContext') : console

class UnifiedContextService {
  constructor() {
    this.currentContext = null
    this.lastUpdate = null
    this.subscribers = new Set()
    
    // Context cache
    this.cache = {
      profile: null,
      company: null,
      intelligence: null,
      activity: null,
      timeline: null,
      posts: null,
    }
  }

  /**
   * Initialize the service and set up listeners
   */
  initialize() {
    contextLogger.info('Unified Context Service initialized')
    
    // Listen for context updates from insights panel
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'CONTEXT_UPDATE') {
        this.updateContext(message.data)
        sendResponse({ success: true })
      }
      return true
    })
  }

  /**
   * Update context with new data
   * @param {Object} data - New context data
   */
  updateContext(data) {
    if (data.profile) this.cache.profile = data.profile
    if (data.company) this.cache.company = data.company
    if (data.intelligence) this.cache.intelligence = data.intelligence
    if (data.activity) this.cache.activity = data.activity
    if (data.timeline) this.cache.timeline = data.timeline
    if (data.posts) this.cache.posts = data.posts
    
    this.lastUpdate = Date.now()
    this.notifySubscribers()
    
    contextLogger.debug('Context updated:', this.cache)
  }

  /**
   * Subscribe to context updates
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  /**
   * Notify all subscribers of context change
   */
  notifySubscribers() {
    this.subscribers.forEach(callback => {
      try {
        callback(this.cache)
      } catch (error) {
        contextLogger.error('Error in subscriber callback:', error)
      }
    })
  }

  /**
   * Get profile context (DOM + Backend profile data)
   * @returns {Object} Profile context
   */
  getProfileContext() {
    const profile = this.cache.profile || {}
    const company = this.cache.company || {}
    
    return {
      // Basic profile info
      name: profile.name || null,
      title: profile.headline || profile.title || null,
      currentPosition: profile.currentPosition || null,
      company: profile.company || company.companyName || null,
      location: profile.location || null,
      
      // Professional details
      yearsOfExperience: profile.yearsOfExperience || null,
      executiveLevel: profile.isCXO || profile.executiveLevel || null,
      decisionMakerScore: profile.decisionMakerScore || null,
      
      // Background
      education: profile.education || [],
      skills: profile.skills || [],
      about: profile.about || null,
      
      // Contact & Social
      linkedinUrl: window.location.href,
      
      // Metadata
      hasData: !!(profile.name || profile.headline),
    }
  }

  /**
   * Get company context (Backend company data)
   * @returns {Object} Company context
   */
  getCompanyContext() {
    const company = this.cache.company || {}
    const intelligence = this.cache.intelligence || {}
    
    return {
      // Basic info
      name: company.companyName || null,
      industry: company.industry || null,
      size: company.companySize || null,
      location: company.location || null,
      description: company.description || null,
      website: company.website || null,
      
      // Tech Stack
      techStack: company.techStack || [],
      techStackCount: company.techStack?.length || 0,
      techCategories: this.categorizeTechStack(company.techStack || []),
      
      // Financial Data
      funding: company.fundingInfo || null,
      stockInfo: company.stockInfo || null,
      isPublic: company.stockInfo?.isPublic || false,
      
      // Growth Indicators
      employeeGrowth: company.employeeGrowth || null,
      recentFunding: company.fundingInfo?.recentRounds || [],
      
      // Metadata
      hasData: !!(company.companyName),
    }
  }

  /**
   * Get intelligence context (Backend analysis + signals)
   * @returns {Object} Intelligence context
   */
  getIntelligenceContext() {
    const intelligence = this.cache.intelligence || {}
    const company = this.cache.company || {}
    const posts = this.cache.posts || {}
    
    return {
      // Pain Points
      painPoints: intelligence.painPoints || posts.painPoints || [],
      
      // Buying Signals
      buyingSignals: intelligence.buyingSignals || this.extractBuyingSignals(),
      
      // Risk Signals
      riskSignals: intelligence.riskSignals || company.riskSignals || [],
      
      // Recent News
      recentNews: company.newsItems || [],
      newsCount: company.newsItems?.length || 0,
      
      // Hiring Signals
      hiringSignals: company.hiringSignals || posts.hiringMentions || [],
      
      // Competitive Intelligence
      competitors: company.competitors || [],
      
      // Decision Maker Intel
      decisionMakerInsights: {
        score: this.cache.profile?.decisionMakerScore || null,
        isCXO: this.cache.profile?.isCXO || null,
        level: this.cache.profile?.executiveLevel || null,
        influence: this.calculateInfluence(),
      },
      
      // Metadata
      hasSignals: this.hasAnySignals(),
    }
  }

  /**
   * Get activity context (Posts, engagement, timeline)
   * @returns {Object} Activity context
   */
  getActivityContext() {
    const posts = this.cache.posts || {}
    const activity = this.cache.activity || {}
    const timeline = this.cache.timeline || {}
    
    return {
      // Recent Posts
      recentPosts: posts.recentPosts || activity.recentPosts || [],
      totalPosts: posts.totalPosts || 0,
      lastPostDate: posts.lastPostDate || null,
      
      // Engagement
      engagementLevel: posts.engagementLevel || activity.engagementLevel || 'unknown',
      
      // Key Activities
      conferences: posts.conferences || [],
      speakingEngagements: posts.speaking || [],
      achievements: posts.achievements || [],
      jobChanges: posts.jobChanges || [],
      
      // Timeline Events
      timelineEvents: timeline.events || [],
      recentEvents: this.getRecentTimelineEvents(),
      
      // Best Hooks for Outreach
      bestHook: posts.bestHook || this.findBestHook(),
      
      // Metadata
      hasActivity: this.hasAnyActivity(),
      lastActivityDate: this.getLastActivityDate(),
    }
  }

  /**
   * Get timeline context (Factual intelligence events)
   * @returns {Object} Timeline context
   */
  getTimelineContext() {
    const timeline = this.cache.timeline || {}
    
    return {
      events: timeline.events || [],
      eventCount: timeline.events?.length || 0,
      verificationData: timeline.verification || [],
      hasTimeline: !!(timeline.events && timeline.events.length > 0),
    }
  }

  /**
   * Get full aggregated context (All data combined)
   * @returns {Object} Complete context
   */
  getFullContext() {
    return {
      profile: this.getProfileContext(),
      company: this.getCompanyContext(),
      intelligence: this.getIntelligenceContext(),
      activity: this.getActivityContext(),
      timeline: this.getTimelineContext(),
      
      // Summary metadata
      summary: this.generateContextSummary(),
      
      // Timestamp
      lastUpdate: this.lastUpdate,
      age: this.lastUpdate ? Date.now() - this.lastUpdate : null,
    }
  }

  /**
   * Get context summary for UI display
   * @returns {Object} Context summary
   */
  generateContextSummary() {
    const profile = this.getProfileContext()
    const company = this.getCompanyContext()
    const intelligence = this.getIntelligenceContext()
    const activity = this.getActivityContext()
    
    const summary = {
      available: [],
      missing: [],
      highlights: [],
    }
    
    // Check what's available
    if (profile.hasData) {
      summary.available.push({
        key: 'profile',
        label: 'Profile Data',
        detail: `${profile.name || 'Unknown'}${profile.title ? ', ' + profile.title : ''}`,
        icon: '👤',
      })
    } else {
      summary.missing.push('profile')
    }
    
    if (company.hasData) {
      summary.available.push({
        key: 'company',
        label: 'Company Data',
        detail: `${company.name || 'Unknown'}${company.industry ? ' - ' + company.industry : ''}`,
        icon: '🏢',
      })
    } else {
      summary.missing.push('company')
    }
    
    if (company.techStackCount > 0) {
      summary.available.push({
        key: 'techStack',
        label: 'Tech Stack',
        detail: `${company.techStackCount} technologies detected`,
        icon: '⚙️',
      })
      summary.highlights.push(`Tech Stack: ${company.techStackCount} tools`)
    }
    
    if (activity.hasActivity) {
      const postCount = activity.recentPosts.length
      const confCount = activity.conferences.length
      const achieveCount = activity.achievements.length
      
      const details = []
      if (postCount > 0) details.push(`${postCount} posts`)
      if (confCount > 0) details.push(`${confCount} conferences`)
      if (achieveCount > 0) details.push(`${achieveCount} achievements`)
      
      summary.available.push({
        key: 'activity',
        label: 'Recent Activity',
        detail: details.length > 0 ? details.join(', ') : 'Limited data',
        icon: '📊',
      })
      if (postCount > 0) {
        summary.highlights.push(`Activity: ${postCount} posts`)
      }
    } else {
      // Only show as missing if we have other data (profile/company)
      // If backend doesn't return activity data, it may not be available for this LinkedIn page type
      if (company.hasData || profile.hasData) {
        summary.missing.push('activity')
      }
    }
    
    if (intelligence.buyingSignals.length > 0) {
      summary.available.push({
        key: 'buyingSignals',
        label: 'Buying Signals',
        detail: `${intelligence.buyingSignals.length} signals detected`,
        icon: '🎯',
      })
      summary.highlights.push(`Buying Signals: ${intelligence.buyingSignals.length}`)
    }
    
    if (intelligence.painPoints.length > 0) {
      summary.available.push({
        key: 'painPoints',
        label: 'Pain Points',
        detail: `${intelligence.painPoints.length} pain points identified`,
        icon: '⚠️',
      })
      summary.highlights.push(`Pain Points: ${intelligence.painPoints.length}`)
    }
    
    if (intelligence.newsCount > 0) {
      summary.available.push({
        key: 'news',
        label: 'Recent News',
        detail: `${intelligence.newsCount} news items`,
        icon: '📰',
      })
    }
    
    if (profile.decisionMakerScore) {
      summary.highlights.push(`Decision Maker Score: ${profile.decisionMakerScore}/100`)
    }
    
    if (profile.executiveLevel) {
      summary.highlights.push(`Executive: ${profile.executiveLevel.level || 'Yes'}`)
    }
    
    return summary
  }

  /**
   * Get context for AI prompt engineering
   * Optimized text format for LLM consumption
   * @param {Object} options - Options for context generation
   * @returns {string} Formatted context string
   */
  getPromptContext(options = {}) {
    const {
      includeProfile = true,
      includeCompany = true,
      includeIntelligence = true,
      includeActivity = true,
      maxLength = 2000,
    } = options
    
    let context = ''
    
    if (includeProfile) {
      const profile = this.getProfileContext()
      if (profile.hasData) {
        context += `\n## Profile Information\n`
        context += `Name: ${profile.name || 'Unknown'}\n`
        if (profile.title) context += `Title: ${profile.title}\n`
        if (profile.company) context += `Company: ${profile.company}\n`
        if (profile.location) context += `Location: ${profile.location}\n`
        if (profile.yearsOfExperience) context += `Experience: ${profile.yearsOfExperience} years\n`
        if (profile.executiveLevel) {
          context += `Executive Level: ${profile.executiveLevel.level || 'Executive'}\n`
        }
        if (profile.decisionMakerScore) {
          context += `Decision Maker Score: ${profile.decisionMakerScore}/100\n`
        }
      }
    }
    
    if (includeCompany) {
      const company = this.getCompanyContext()
      if (company.hasData) {
        context += `\n## Company Information\n`
        context += `Company: ${company.name || 'Unknown'}\n`
        if (company.industry) context += `Industry: ${company.industry}\n`
        if (company.size) context += `Size: ${company.size}\n`
        if (company.description) {
          context += `About: ${company.description.substring(0, 200)}${company.description.length > 200 ? '...' : ''}\n`
        }
        
        if (company.techStackCount > 0 && Array.isArray(company.techStack)) {
          const topTech = company.techStack
            .slice(0, 10)
            .filter(t => t) // Filter out null/undefined
            .map(t => {
              if (typeof t === 'string') return t
              if (typeof t === 'object' && t.name) return String(t.name)
              return ''
            })
            .filter(name => name) // Filter out empty strings
            .join(', ')
          if (topTech) {
            context += `Tech Stack (${company.techStackCount} total): ${topTech}\n`
          }
        }
        
        if (company.funding) {
          context += `Funding: ${company.funding.totalFunding || 'N/A'}\n`
        }
      }
    }
    
    if (includeIntelligence) {
      const intelligence = this.getIntelligenceContext()
      
      if (intelligence.buyingSignals.length > 0) {
        context += `\n## Buying Signals\n`
        intelligence.buyingSignals.slice(0, 3).forEach((signal, i) => {
          context += `${i + 1}. ${signal.type || signal}: ${signal.description || ''}\n`
        })
      }
      
      if (intelligence.painPoints.length > 0) {
        context += `\n## Pain Points\n`
        intelligence.painPoints.slice(0, 3).forEach((pain, i) => {
          context += `${i + 1}. ${pain.point || pain}\n`
        })
      }
      
      if (intelligence.recentNews.length > 0) {
        context += `\n## Recent News\n`
        intelligence.recentNews.slice(0, 2).forEach((news, i) => {
          context += `${i + 1}. ${news.title || news.headline}\n`
        })
      }
    }
    
    if (includeActivity) {
      const activity = this.getActivityContext()
      
      if (activity.bestHook) {
        context += `\n## Best Outreach Hook\n`
        context += `Type: ${activity.bestHook.type}\n`
        context += `Context: ${activity.bestHook.text?.substring(0, 150) || ''}\n`
      }
      
      if (activity.conferences.length > 0) {
        context += `\n## Recent Conference Activity\n`
        activity.conferences.slice(0, 2).forEach((conf, i) => {
          context += `${i + 1}. ${conf.name || conf.text?.substring(0, 100)}\n`
        })
      }
      
      if (activity.achievements.length > 0) {
        context += `\n## Recent Achievements\n`
        activity.achievements.slice(0, 2).forEach((ach, i) => {
          context += `${i + 1}. ${ach.text?.substring(0, 100) || ach}\n`
        })
      }
    }
    
    // Truncate if too long
    if (context.length > maxLength) {
      context = context.substring(0, maxLength) + '\n...[truncated]'
    }
    
    return context.trim()
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Categorize tech stack by type
   * @param {Array} techStack - Tech stack array
   * @returns {Object} Categorized tech
   */
  categorizeTechStack(techStack) {
    const categories = {
      frontend: [],
      backend: [],
      database: [],
      cloud: [],
      analytics: [],
      other: [],
    }
    
    if (!Array.isArray(techStack)) {
      return categories
    }
    
    techStack.forEach(tech => {
      // Skip null/undefined items
      if (!tech) {
        return
      }
      
      // Get name safely - handle both string and object formats
      let name = ''
      if (typeof tech === 'string') {
        name = tech.toLowerCase()
      } else if (typeof tech === 'object' && tech.name) {
        name = String(tech.name).toLowerCase()
      } else {
        // Unknown format, skip
        return
      }
      
      const category = tech.category ? String(tech.category).toLowerCase() : ''
      
      if (category.includes('frontend') || name.includes('react') || name.includes('vue') || name.includes('angular')) {
        categories.frontend.push(tech)
      } else if (category.includes('backend') || category.includes('server')) {
        categories.backend.push(tech)
      } else if (category.includes('database') || category.includes('data')) {
        categories.database.push(tech)
      } else if (category.includes('cloud') || category.includes('infrastructure')) {
        categories.cloud.push(tech)
      } else if (category.includes('analytics') || category.includes('tracking')) {
        categories.analytics.push(tech)
      } else {
        categories.other.push(tech)
      }
    })
    
    return categories
  }

  /**
   * Extract buying signals from various sources
   * @returns {Array} Buying signals
   */
  extractBuyingSignals() {
    const signals = []
    const company = this.cache.company || {}
    const posts = this.cache.posts || {}
    
    // Hiring signals
    if (company.hiringSignals || posts.hiringMentions) {
      signals.push({
        type: 'hiring',
        description: 'Active hiring indicates growth and budget availability',
        strength: 'high',
      })
    }
    
    // Funding signals
    if (company.fundingInfo?.recentRounds?.length > 0) {
      signals.push({
        type: 'funding',
        description: 'Recent funding round indicates investment in growth',
        strength: 'high',
      })
    }
    
    // Expansion signals
    if (company.employeeGrowth && company.employeeGrowth > 10) {
      signals.push({
        type: 'expansion',
        description: `${company.employeeGrowth}% employee growth`,
        strength: 'medium',
      })
    }
    
    // News signals
    if (company.newsItems?.length > 0) {
      const recentNews = company.newsItems.filter(n => {
        const date = new Date(n.publishedAt)
        const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
        return daysSince < 30
      })
      
      if (recentNews.length > 0) {
        signals.push({
          type: 'news_momentum',
          description: `${recentNews.length} recent news items`,
          strength: 'medium',
        })
      }
    }
    
    return signals
  }

  /**
   * Calculate influence score
   * @returns {number} Influence score (0-100)
   */
  calculateInfluence() {
    const profile = this.cache.profile || {}
    let score = 0
    
    if (profile.decisionMakerScore) {
      score += profile.decisionMakerScore * 0.6
    }
    
    if (profile.isCXO) {
      score += 30
    }
    
    if (profile.executiveLevel) {
      score += 20
    }
    
    return Math.min(Math.round(score), 100)
  }

  /**
   * Check if any signals are available
   * @returns {boolean} True if signals exist
   */
  hasAnySignals() {
    const intelligence = this.cache.intelligence || {}
    const company = this.cache.company || {}
    const posts = this.cache.posts || {}
    
    return !!(
      intelligence.painPoints?.length ||
      intelligence.buyingSignals?.length ||
      intelligence.riskSignals?.length ||
      company.newsItems?.length ||
      company.hiringSignals ||
      posts.painPoints?.length
    )
  }

  /**
   * Check if any activity data is available
   * @returns {boolean} True if activity exists
   */
  hasAnyActivity() {
    const posts = this.cache.posts || {}
    const activity = this.cache.activity || {}
    
    const hasActivity = !!(
      posts.recentPosts?.length ||
      posts.conferences?.length ||
      posts.speaking?.length ||
      posts.achievements?.length ||
      posts.jobChanges?.length ||
      posts.bestHook ||
      activity.recentPosts?.length ||
      (posts.totalPosts && posts.totalPosts > 0)
    )
    
    contextLogger.debug('Activity check:', {
      hasActivity,
      recentPostsCount: posts.recentPosts?.length || 0,
      conferencesCount: posts.conferences?.length || 0,
      achievementsCount: posts.achievements?.length || 0,
      totalPosts: posts.totalPosts || 0,
    })
    
    return hasActivity
  }

  /**
   * Get recent timeline events (last 30 days)
   * @returns {Array} Recent events
   */
  getRecentTimelineEvents() {
    const timeline = this.cache.timeline || {}
    if (!timeline.events) return []
    
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
    
    return timeline.events.filter(event => {
      const eventDate = new Date(event.date).getTime()
      return eventDate > thirtyDaysAgo
    })
  }

  /**
   * Find best hook for outreach
   * @returns {Object|null} Best hook
   */
  findBestHook() {
    const posts = this.cache.posts || {}
    const activity = this.cache.activity || {}
    
    // Check if already computed
    if (posts.bestHook) return posts.bestHook
    
    // Priority order: conferences > speaking > achievements > recent posts
    if (activity.conferences?.length > 0) {
      return {
        type: 'conference',
        text: activity.conferences[0].text || activity.conferences[0].name,
        relevance: 85,
      }
    }
    
    if (posts.speaking?.length > 0) {
      return {
        type: 'speaking',
        text: posts.speaking[0].text,
        relevance: 80,
      }
    }
    
    if (posts.achievements?.length > 0) {
      return {
        type: 'achievement',
        text: posts.achievements[0].text,
        relevance: 75,
      }
    }
    
    if (posts.recentPosts?.length > 0) {
      return {
        type: 'recent_post',
        text: posts.recentPosts[0].text,
        relevance: 60,
      }
    }
    
    return null
  }

  /**
   * Get last activity date
   * @returns {string|null} Last activity date
   */
  getLastActivityDate() {
    const posts = this.cache.posts || {}
    const activity = this.cache.activity || {}
    
    return posts.lastPostDate || activity.lastPostDate || null
  }

  /**
   * Clear all cached context
   */
  clearContext() {
    this.cache = {
      profile: null,
      company: null,
      intelligence: null,
      activity: null,
      timeline: null,
      posts: null,
    }
    this.lastUpdate = null
    this.notifySubscribers()
    contextLogger.info('Context cleared')
  }

  /**
   * Export context for debugging
   * @returns {Object} Full context export
   */
  exportContext() {
    return {
      cache: this.cache,
      lastUpdate: this.lastUpdate,
      summary: this.generateContextSummary(),
      fullContext: this.getFullContext(),
    }
  }
}

// Create singleton instance
const unifiedContextService = new UnifiedContextService()
unifiedContextService.initialize()

// Export to window for global access
if (typeof window !== 'undefined') {
  window.unifiedContext = unifiedContextService
  window.UnifiedContextService = UnifiedContextService
}

contextLogger.info('Unified Context Service loaded')

