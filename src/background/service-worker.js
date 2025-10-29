/**
 * LinkedIntel Service Worker (Background Script) - Enhanced MV3
 * Handles side panel management, backend API integration, credits system, and caching
 */

// Logger class for service worker (embedded since we can't import in MV3 service workers)
class Logger {
  constructor(namespace = '', level = 'info') {
    this.namespace = namespace
    this.level = level
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 }
  }

  getCurrentLevelPriority() {
    return this.levels[this.level] !== undefined ? this.levels[this.level] : 1
  }

  debug(...args) {
    if (this.getCurrentLevelPriority() <= this.levels.debug) {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] [${this.namespace}] DEBUG:`, ...args)
    }
  }

  info(...args) {
    if (this.getCurrentLevelPriority() <= this.levels.info) {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] [${this.namespace}] INFO:`, ...args)
    }
  }

  warn(...args) {
    if (this.getCurrentLevelPriority() <= this.levels.warn) {
      const timestamp = new Date().toISOString()
      console.warn(`[${timestamp}] [${this.namespace}] WARN:`, ...args)
    }
  }

  error(...args) {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [${this.namespace}] ERROR:`, ...args)
  }

  child(childNamespace) {
    return new Logger(`${this.namespace}:${childNamespace}`, this.level)
  }
}

const EXTENSION_CONFIG = {
  API_BASE_URLS: {
    production: 'https://api.example.com',
    development: 'http://localhost:8080',
  },
  GA4_MEASUREMENT_ID: null,
  GA4_API_SECRET: null,
}

// GA4 Analytics class (embedded to avoid importScripts() issues)
class GA4Analytics {
  constructor(config = {}) {
    this.logger = new Logger('GA4Analytics')
    this.measurementId = config.measurementId || EXTENSION_CONFIG.GA4_MEASUREMENT_ID
    this.apiSecret = config.apiSecret || EXTENSION_CONFIG.GA4_API_SECRET

    if (!this.measurementId || !this.apiSecret) {
      this.isEnabled = false
      this.logger.info(
        'GA4 analytics disabled: measurement ID or API secret not configured'
      )
      return
    }

    this.isEnabled = true
    this.endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`
    this.debugEndpoint = `https://www.google-analytics.com/debug/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`
    this.sessionTimeout = 30 * 60 * 1000
    this.offlineQueue = []
    this.maxQueueSize = 50
    this.initializeTracking()
  }

  async initializeTracking() {
    if (!this.isEnabled) {
      return
    }
    try {
      const result = await chrome.storage.local.get(['ga4_client_id'])
      if (!result.ga4_client_id) {
        const clientId = crypto.randomUUID()
        await chrome.storage.local.set({ ga4_client_id: clientId })
        this.clientId = clientId
      } else {
        this.clientId = result.ga4_client_id
      }
      await this.initializeSession()
      await this.processOfflineQueue()
    } catch (error) {
      this.logger.error('Initialization error:', error)
    }
  }

  async initializeSession() {
    try {
      const sessionResult = await chrome.storage.session.get([
        'ga4_session_id',
        'ga4_session_timestamp',
      ])
      const now = Date.now()
      const lastTimestamp = sessionResult.ga4_session_timestamp || 0
      const timeSinceLastActivity = now - lastTimestamp
      if (
        !sessionResult.ga4_session_id ||
        timeSinceLastActivity > this.sessionTimeout
      ) {
        this.sessionId = now.toString()
        await chrome.storage.session.set({
          ga4_session_id: this.sessionId,
          ga4_session_timestamp: now,
        })
      } else {
        this.sessionId = sessionResult.ga4_session_id
        await chrome.storage.session.set({ ga4_session_timestamp: now })
      }
      this.sessionStartTime = now
    } catch (error) {
      this.logger.warn('Session storage unavailable, using timestamp:', error)
      this.sessionId = Date.now().toString()
      this.sessionStartTime = Date.now()
    }
  }

  async trackEvent(eventName, eventParams = {}, isDebug = false) {
    if (!this.isEnabled) {
      return
    }
    try {
      if (!this.clientId || !this.sessionId) {
        await this.initializeTracking()
      }
      await this.updateSessionTimestamp()
      const engagementTime = Date.now() - this.sessionStartTime
      const manifest = chrome.runtime.getManifest()
      const extensionVersion = manifest.version
      const payload = {
        client_id: this.clientId,
        events: [
          {
            name: eventName,
            params: {
              session_id: this.sessionId,
              engagement_time_msec: engagementTime,
              extension_version: extensionVersion,
              ...eventParams,
            },
          },
        ],
      }
      const endpoint = isDebug ? this.debugEndpoint : this.endpoint
      const response = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        throw new Error(
          `GA4 API error: ${response.status} ${response.statusText}`
        )
      }
      if (isDebug) {
        const debugResponse = await response.json()
        this.logger.debug('Debug response:', debugResponse)
      }
      this.logger.info(`Event tracked: ${eventName}`, eventParams)
    } catch (error) {
      this.logger.error(`Failed to track event: ${eventName}`, error)
      await this.queueOfflineEvent(eventName, eventParams)
    }
  }

  async updateSessionTimestamp() {
    try {
      await chrome.storage.session.set({ ga4_session_timestamp: Date.now() })
    } catch (error) {}
  }

  async queueOfflineEvent(eventName, eventParams) {
    if (!this.isEnabled) {
      return
    }
    try {
      const result = await chrome.storage.local.get(['ga4_offline_queue'])
      const queue = result.ga4_offline_queue || []
      queue.push({ eventName, eventParams, timestamp: Date.now() })
      const limitedQueue = queue.slice(-this.maxQueueSize)
      await chrome.storage.local.set({ ga4_offline_queue: limitedQueue })
      this.logger.info(`Event queued for offline retry: ${eventName}`)
    } catch (error) {
      this.logger.error('Failed to queue offline event:', error)
    }
  }

  async processOfflineQueue() {
    if (!this.isEnabled) {
      return
    }
    try {
      const result = await chrome.storage.local.get(['ga4_offline_queue'])
      const queue = result.ga4_offline_queue || []
      if (queue.length === 0) return
      this.logger.info(`Processing ${queue.length} queued events...`)
      for (const queuedEvent of queue) {
        await this.trackEvent(queuedEvent.eventName, queuedEvent.eventParams)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      await chrome.storage.local.set({ ga4_offline_queue: [] })
      this.logger.info('Offline queue processed successfully')
    } catch (error) {
      this.logger.error('Failed to process offline queue:', error)
    }
  }

  async setUserProperties(properties) {
    if (!this.isEnabled) {
      return
    }
    try {
      if (!this.clientId) {
        await this.initializeTracking()
      }
      const payload = { client_id: this.clientId, user_properties: properties }
      await fetch(this.endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      })
      this.logger.info('User properties set:', properties)
    } catch (error) {
      this.logger.error('Failed to set user properties:', error)
    }
  }
}

// Initialize analytics (after Logger is defined)
const analytics = new GA4Analytics({
  measurementId: EXTENSION_CONFIG.GA4_MEASUREMENT_ID,
  apiSecret: EXTENSION_CONFIG.GA4_API_SECRET,
})

// Create service worker logger instance
const logger = new Logger('ServiceWorker')

// Configuration - Environment-based API endpoint
const getApiBaseUrl = () => {
  // Check if we're in production environment
  // This will be replaced during build process
  const NODE_ENV = 'development' // BUILD_REPLACE_NODE_ENV
  if (NODE_ENV === 'production') {
    return EXTENSION_CONFIG.API_BASE_URLS.production
  } else {
    return EXTENSION_CONFIG.API_BASE_URLS.development
  }
}

const CONFIG = {
  API_BASE_URL: getApiBaseUrl(),
  // SESSION_CACHE_DURATION removed - frontend cache eliminated, backend Redis cache (24h TTL) is sufficient
  ANONYMOUS_ANALYSES_LIMIT: 3, // Lifetime limit for anonymous users
  REQUEST_TIMEOUT: 120000, // 120 seconds for AI analysis calls
  RETRY_ATTEMPTS: 2,
}

// Service worker installation
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info('[LinkedIntel] Extension installed/updated:', details.reason)

  try {
    logger.debug(
      '[LinkedIntel] Extension initialized - using floating panel overlay'
    )

    // Initialize anonymous usage tracking if not set
    const result = await chrome.storage.local.get([
      'anonymous_analyses_used',
      'auth_token',
    ])
    if (result.anonymous_analyses_used === undefined) {
      await chrome.storage.local.set({
        anonymous_analyses_used: 0,
      })
      logger.info('[LinkedIntel] Anonymous usage tracking initialized')
    }

    // Set up periodic alarms
    if (details.reason === 'install' || details.reason === 'update') {
      // Clear any existing alarms
      await chrome.alarms.clearAll()

      logger.info('[LinkedIntel] Periodic tasks configured')
    }

    // Setup smart icon activation (Web Navigation based)
    await setupSmartIconActivation()

    // Update badge on installation
    await updateBadge()

    // Track extension installation/update with GA4
    if (details.reason === 'install') {
      analytics.trackEvent('extension_install', {
        version: chrome.runtime.getManifest().version,
        install_timestamp: Date.now(),
      })
    } else if (details.reason === 'update') {
      analytics.trackEvent('extension_update', {
        version: chrome.runtime.getManifest().version,
        previous_version: details.previousVersion || 'unknown',
      })
    }
  } catch (error) {
    logger.error('[LinkedIntel] Installation error:', error)
  }
})

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.info('[LinkedIntel] Received message:', message)

  // Handle new message format (with 'type')
  if (message.type) {
    handleMessageByType(message, sender, sendResponse)
  } else {
    logger.info('[LinkedIntel] Unknown message format:', message)
    sendResponse({ error: 'Unknown message format' })
  }

  // Keep the message channel open for async responses
  return true
})

async function handleMessageByType(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'LINKEDIN_PAGE_DETECTED':
        await handlePageDetected(message.data, sender)
        sendResponse({ success: true })
        break

      case 'GET_CREDITS':
      case 'GET_USAGE_STATUS':
        const usageStatus = await getUsageStatus()
        sendResponse(usageStatus)
        break

      case 'ANALYZE_PROFILE':
        const profileResult = await analyzeProfile(message.data)
        sendResponse(profileResult)
        break

      case 'ANALYZE_COMPANY':
        const companyResult = await analyzeCompany(message.data)
        sendResponse(companyResult)
        break

      case 'OPEN_FLOATING_PANEL':
        // This is now handled by content script floating panel
        // Just acknowledge the message
        sendResponse({
          success: true,
          message: 'Floating panel handled by content script',
        })
        break
      case 'OPEN_SIDE_PANEL':
        await openSidePanel(sender.tab.id, message.data)
        sendResponse({ success: true, message: 'Side panel opened' })
        break

      case 'GET_CACHE_STATS':
        const cacheStats = await getCacheStats()
        sendResponse(cacheStats)
        break

      case 'PING':
        sendResponse({
          success: true,
          context: 'service-worker',
          version: '2.0.0',
          timestamp: Date.now(),
        })
        break

      case 'GET_ANALYSIS_STATUS':
        const analysisStatus = await getAnalysisStatus(message.data.tabId)
        sendResponse(analysisStatus)
        break

      case 'GET_CURRENT_CONTEXT':
        const currentContext = await getCurrentContext()
        sendResponse(currentContext)
        break

      case 'UPDATE_BADGE':
        await updateBadge()
        sendResponse({ success: true, message: 'Badge updated' })
        break

      case 'GOOGLE_SIGNIN':
        const signInResult = await handleGoogleSignIn()
        sendResponse(signInResult)
        break

      case 'GOOGLE_SIGNOUT':
        const signOutResult = await handleGoogleSignOut()
        sendResponse(signOutResult)
        break

      case 'TRACK_EVENT':
        // Handle analytics event tracking
        await handleTrackEvent(message.data)
        sendResponse({ success: true, message: 'Event tracked' })
        break

      case 'CHAT':
        // Handle chat query to Perplexity
        const chatResult = await handleChat(message.data)
        sendResponse(chatResult)
        break

      case 'OPEN_POPUP':
        // Handle opening the popup for sign-in
        try {
          await chrome.action.openPopup()
          sendResponse({ success: true, message: 'Popup opened' })
        } catch (error) {
          logger.error('[LinkedIntel] Error opening popup:', error)
          sendResponse({ success: false, error: error.message })
        }
        break

      default:
        logger.info('[LinkedIntel] Unknown message type:', message.type)
        sendResponse({ error: 'Unknown message type' })
    }
  } catch (error) {
    logger.error('[LinkedIntel] Error handling message:', error)
    sendResponse({ error: error.message })
  }
}

/**
 * Store context for current analysis (used by floating panel)
 */
async function storeAnalysisContext(tabId, pageType, url) {
  try {
    await chrome.storage.session.set({
      currentContext: {
        pageType: pageType,
        url: url,
        tabId: tabId,
        timestamp: Date.now(),
      },
    })
    logger.info('[LinkedIntel] Analysis context stored for tab:', tabId)
  } catch (error) {
    logger.error('[LinkedIntel] Error storing analysis context:', error)
  }
}

/**
 * Handle analytics event tracking
 */
async function handleTrackEvent(eventData) {
  try {
    const { eventName, eventParams, isDebug } = eventData

    if (!eventName) {
      logger.warn('[LinkedIntel] Track event called without event name')
      return
    }

    // Track event with GA4
    await analytics.trackEvent(eventName, eventParams || {}, isDebug || false)

    logger.info(`[LinkedIntel] GA4 Event tracked: ${eventName}`, eventParams)
  } catch (error) {
    logger.error('[LinkedIntel] Error tracking event:', error)
  }
}

/**
 * Handle analysis requests
 */
async function handleStartAnalysis(message, tabId) {
  try {
    logger.info('[LinkedIntel] Starting analysis:', message)

    // Store analysis request
    await chrome.storage.session.set({
      pendingAnalysis: {
        ...message,
        tabId: tabId,
        status: 'pending',
      },
    })

    // Send to side panel if it's open
    try {
      await chrome.runtime.sendMessage({
        action: 'analysisStarted',
        data: message,
      })
    } catch (error) {
      // Side panel might not be open, that's okay
      logger.info('[LinkedIntel] Side panel not ready for analysis message')
    }
  } catch (error) {
    logger.error('[LinkedIntel] Error handling analysis request:', error)
  }
}

// Handle tab updates to manage side panel context
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.status === 'complete' &&
    tab.url &&
    tab.url.includes('linkedin.com')
  ) {
    // Update context if side panel is open for this tab
    const { currentContext } = await chrome.storage.session.get([
      'currentContext',
    ])

    if (currentContext && currentContext.tabId === tabId) {
      const updatedContext = {
        ...currentContext,
        url: tab.url,
        timestamp: Date.now(),
      }

      await chrome.storage.session.set({
        currentContext: updatedContext,
      })
    }
  }
})

// Handle tab removal
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { currentContext } = await chrome.storage.session.get([
    'currentContext',
  ])

  if (currentContext && currentContext.tabId === tabId) {
    // Clear context when the tab is closed
    await chrome.storage.session.remove(['currentContext', 'pendingAnalysis'])
  }
})

// Handle extension icon click - show instruction to use FAB on LinkedIn
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && tab.url.includes('linkedin.com')) {
    const pageType = tab.url.includes('/in/')
      ? 'profile'
      : tab.url.includes('/company/')
      ? 'company'
      : 'other'

    // Show notification to use FAB instead of extension icon
    if (pageType === 'profile' || pageType === 'company') {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'LinkedIntel',
        message:
          'Click the floating blue button on the LinkedIn page to start analysis.',
      })
    } else {
      // Show notification that we only work on profile/company pages
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'LinkedIntel',
        message:
          'Navigate to a LinkedIn profile or company page to use LinkedIntel.',
      })
    }
  } else {
    // Not on LinkedIn
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'LinkedIntel',
      message:
        'LinkedIntel only works on LinkedIn. Please navigate to LinkedIn first.',
    })
  }
})

// Keep service worker alive for content script communication
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'linkedintel-content') {
    logger.info('[LinkedIntel] Content script connected')

    port.onDisconnect.addListener(() => {
      logger.info('[LinkedIntel] Content script disconnected')
    })

    port.onMessage.addListener(async (message) => {
      logger.info('[LinkedIntel] Message from content script:', message)

      if (message.action === 'getAnalysisContext') {
        const { currentContext, pendingAnalysis } =
          await chrome.storage.session.get([
            'currentContext',
            'pendingAnalysis',
          ])

        port.postMessage({
          action: 'contextData',
          context: currentContext,
          analysis: pendingAnalysis,
        })
      }
    })
  }
})

// New message handlers
async function handlePageDetected(pageData, sender) {
  logger.info('[LinkedIntel] Page detected:', pageData)

  // Store current page data
  await chrome.storage.local.set({
    currentPage: {
      ...pageData,
      tabId: sender.tab?.id,
      timestamp: Date.now(),
    },
  })
}

/**
 * Get current analysis status for a specific tab
 */
async function getAnalysisStatus(tabId) {
  try {
    const { currentContext, pendingAnalysis } =
      await chrome.storage.session.get(['currentContext', 'pendingAnalysis'])

    if (!currentContext || currentContext.tabId !== tabId) {
      return { status: 'inactive', error: 'No active context for this tab' }
    }

    return {
      status: pendingAnalysis ? pendingAnalysis.status || 'idle' : 'idle',
      context: currentContext,
      analysis: pendingAnalysis,
      timestamp: Date.now(),
    }
  } catch (error) {
    logger.error('[LinkedIntel] Error getting analysis status:', error)
    return { status: 'error', error: error.message }
  }
}

/**
 * Get current context from session storage
 */
async function getCurrentContext() {
  try {
    const { currentContext, pendingAnalysis } =
      await chrome.storage.session.get(['currentContext', 'pendingAnalysis'])

    if (!currentContext) {
      // Try to get from local storage as fallback
      const { currentPage } = await chrome.storage.local.get(['currentPage'])
      if (currentPage) {
        return {
          success: true,
          context: currentPage,
          analysis: pendingAnalysis,
        }
      }

      return { success: false, error: 'No current context available' }
    }

    return {
      success: true,
      context: currentContext,
      analysis: pendingAnalysis,
    }
  } catch (error) {
    logger.error('[LinkedIntel] Error getting current context:', error)
    return { success: false, error: error.message }
  }
}

async function getUsageStatus() {
  try {
    const result = await chrome.storage.local.get([
      'anonymous_analyses_used',
      'auth_token',
      'user_email',
      'user_name',
      'user_avatar',
      'monthly_analyses_used',
      'monthly_analyses_limit',
      'plan_type',
    ])

    const isAuthenticated = !!result.auth_token
    const anonymousUsed = result.anonymous_analyses_used ?? 0
    const anonymousRemaining = Math.max(
      0,
      CONFIG.ANONYMOUS_ANALYSES_LIMIT - anonymousUsed
    )

    if (!isAuthenticated) {
      // Anonymous user
      return {
        isAuthenticated: false,
        analysesUsed: anonymousUsed,
        analysesRemaining: anonymousRemaining,
        analysesLimit: CONFIG.ANONYMOUS_ANALYSES_LIMIT,
        planType: 'anonymous',
        needsUpgrade: anonymousRemaining === 0,
      }
    } else {
      // Authenticated user
      const monthlyUsed = result.monthly_analyses_used ?? 0
      const monthlyLimit = result.monthly_analyses_limit ?? 10 // Default to free tier
      const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed)

      return {
        isAuthenticated: true,
        userEmail: result.user_email,
        userName: result.user_name,
        userAvatar: result.user_avatar,
        analysesUsed: monthlyUsed,
        analysesRemaining: monthlyRemaining,
        analysesLimit: monthlyLimit,
        planType: result.plan_type ?? 'free',
        needsUpgrade: monthlyRemaining === 0,
      }
    }
  } catch (error) {
    logger.error('[LinkedIntel] Error getting usage status:', error)
    return {
      isAuthenticated: false,
      analysesUsed: 0,
      analysesRemaining: 0,
      analysesLimit: CONFIG.ANONYMOUS_ANALYSES_LIMIT,
      planType: 'anonymous',
      needsUpgrade: true,
      error: error.message,
    }
  }
}

/**
 * Update the extension icon badge to show credits remaining
 * Only updates badge on LinkedIn profile/company pages
 */
async function updateBadge(tabId = null) {
  try {
    const usageStatus = await getUsageStatus()
    const remaining = usageStatus.analysesRemaining
    const badgeText = remaining > 0 ? remaining.toString() : '0'

    // Determine badge color based on remaining credits
    let badgeColor
    if (remaining === 0) {
      badgeColor = '#dc2626' // Red for no credits
    } else if (remaining <= 1) {
      badgeColor = '#f59e0b' // Orange for low credits
    } else {
      badgeColor = '#10b981' // Green for healthy credits
    }

    if (tabId) {
      // Update badge for specific tab (already verified to be LinkedIn page)
      await chrome.action.setBadgeText({
        tabId: tabId,
        text: badgeText,
      })
      await chrome.action.setBadgeBackgroundColor({
        tabId: tabId,
        color: badgeColor,
      })
      logger.debug(
        `[LinkedIntel] Badge updated for tab ${tabId}: ${remaining} credits`
      )
    } else {
      // Update badge only on LinkedIn tabs (not all tabs)
      const tabs = await chrome.tabs.query({})
      for (const tab of tabs) {
        try {
          if (tab.url) {
            const url = new URL(tab.url)
            const isLinkedInPage =
              url.hostname.includes('linkedin.com') &&
              (url.pathname.includes('/in/') ||
                url.pathname.includes('/company/'))

            if (isLinkedInPage) {
              // Only update badge on LinkedIn profile/company pages
              await chrome.action.setBadgeText({
                tabId: tab.id,
                text: badgeText,
              })
              await chrome.action.setBadgeBackgroundColor({
                tabId: tab.id,
                color: badgeColor,
              })
            }
            // Don't set badge on non-LinkedIn tabs
          }
        } catch (e) {
          // Skip tabs that can't be accessed
        }
      }
      logger.debug(
        `[LinkedIntel] Badge updated on LinkedIn tabs only: ${remaining} credits remaining`
      )
    }
  } catch (error) {
    logger.error('[LinkedIntel] Error updating badge:', error)
  }
}

async function analyzeProfile(profileData) {
  logger.debug(
    '[LinkedIntel] Analyzing profile with enhanced combined analysis:',
    profileData
  )

  // Check usage limits first
  const usageStatus = await getUsageStatus()
  if (usageStatus.needsUpgrade) {
    const errorMessage = usageStatus.isAuthenticated
      ? `Monthly limit reached (${usageStatus.analysesUsed}/${usageStatus.analysesLimit} unique entities). Revisits are always FREE. Buy 200 credits for just $19!`
      : `All 3 free analyses used. Sign in with Google to get 10/month — free forever!`

    return {
      error: errorMessage,
      needsAuth: !usageStatus.isAuthenticated,
      needsUpgrade: usageStatus.isAuthenticated,
      usageStatus: usageStatus,
    }
  }

  // Note: Backend handles all caching via Redis (24h TTL)
  // No frontend cache needed - backend cache is fast (~50-100ms) and keeps single source of truth
  const personName = profileData.name || 'Unknown Person'
  const companyName = profileData.company || ''

  try {
    // Debug logging for company extraction
    logger.info('[LinkedIntel] Profile data received:', {
      name: profileData.name,
      company: profileData.company,
      headline: profileData.headline,
    })

    // Use the company extracted by LinkedIn detector from DOM
    // The detector should prioritize actual profile structure over content
    logger.debug(
      `[LinkedIntel] Using company from LinkedIn DOM extraction: "${companyName}"`
    )

    // If no company found, that's better than using wrong company from news/content
    if (!companyName) {
      logger.info('[LinkedIntel] No company found - will skip company analysis')
    }

    // Prepare API request data for enhanced person analysis with company data
    // Truncate title to 100 characters to meet backend validation (some LinkedIn titles are very long)
    const rawTitle = profileData.headline || ''
    const truncatedTitle =
      rawTitle.length > 100 ? rawTitle.substring(0, 97) + '...' : rawTitle

    const personApiData = {
      fullName: personName,
      title: truncatedTitle,
      profileUrl: profileData.url || '',
      companyName: companyName,
      includeCompanyAnalysis: !!companyName, // Only request company analysis if we have a company
    }

    logger.debug(
      '[LinkedIntel] API Request Data:',
      JSON.stringify(personApiData, null, 2)
    )

    logger.debug(
      '[LinkedIntel] Making enhanced API call for combined person and company analysis'
    )

    // Make single API call that includes both person and company analysis
    const result = await makeAPICall('/analyze/person', 'POST', personApiData)

    logger.info('[LinkedIntel] API Response:', JSON.stringify(result, null, 2))

    if (result && result.success && !result.error) {
      // Extract cache status from response
      const wasCached = result.fromCache || false

      // Backend returns usage data in every response - sync it!
      let updatedUsageStatus
      if (result.usage) {
        logger.info(
          `[LinkedIntel] Backend usage response: ${JSON.stringify(
            result.usage
          )} | creditsCharged: ${result.creditsCharged} | chargeReason: ${
            result.chargeReason
          }`
        )
        await syncUsageFromResponse(result.usage)

        // Use backend's authoritative usage data directly (don't re-fetch from storage)
        updatedUsageStatus = {
          isAuthenticated: true,
          userEmail: result.usage.userEmail,
          userName: result.usage.userName,
          userAvatar: result.usage.userAvatar,
          analysesUsed: result.usage.analysesUsed,
          analysesRemaining:
            result.usage.analysesRemaining ??
            Math.max(0, result.usage.analysesLimit - result.usage.analysesUsed), // ✅ Use backend's value, fallback to calculation
          analysesLimit: result.usage.analysesLimit,
          planType: result.usage.planType,
          needsUpgrade: result.usage.analysesUsed >= result.usage.analysesLimit,
        }
      } else {
        // Fallback for anonymous users
        logger.info(
          '[LinkedIntel] No usage data from backend, incrementing anonymous counter'
        )
        await incrementAnonymousUsage(usageStatus)
        // Re-fetch for anonymous users only
        updatedUsageStatus = await getUsageStatus()
      }

      logger.info(
        `[LinkedIntel] Updated usage status: ${updatedUsageStatus.analysesUsed}/${updatedUsageStatus.analysesLimit} (remaining: ${updatedUsageStatus.analysesRemaining})`
      )

      // Track successful profile analysis with GA4
      analytics.trackEvent('analysis_completed', {
        analysis_type: 'profile',
        person_name: personName,
        has_company: !!companyName,
        combined_analysis: result.combinedAnalysis || false,
        from_cache: wasCached,
        analyses_remaining: updatedUsageStatus.analysesRemaining,
        is_authenticated: usageStatus.isAuthenticated,
        plan_type: usageStatus.planType || 'anonymous',
      })

      return {
        data: result.data, // This now contains both profile and company data
        pageType: 'profile', // ✅ Indicate this is a profile analysis
        citations: result.citations || [], // ✅ Pass through citations from backend
        analysesRemaining: updatedUsageStatus.analysesRemaining,
        usageStatus: updatedUsageStatus,
        fromCache: wasCached,
        combinedAnalysis: result.combinedAnalysis || false,
        usage: result.usage,
      }
    } else {
      logger.error('[LinkedIntel] Enhanced analysis failed:', result?.error)
      return {
        error: result?.error || 'Failed to analyze profile. Please try again.',
        analysesRemaining: usageStatus.analysesRemaining,
        usageStatus: usageStatus,
      }
    }
  } catch (error) {
    logger.error('[LinkedIntel] Profile analysis error:', error)
    return {
      error: error.message || 'Failed to analyze profile. Please try again.',
      analysesRemaining: usageStatus.analysesRemaining,
      usageStatus: usageStatus,
    }
  }
}

async function analyzeCompany(companyData) {
  logger.info('[LinkedIntel] Analyzing company:', companyData)

  // Check usage limits first
  const usageStatus = await getUsageStatus()
  if (usageStatus.needsUpgrade) {
    const errorMessage = usageStatus.isAuthenticated
      ? `Monthly limit reached (${usageStatus.analysesUsed}/${usageStatus.analysesLimit} unique entities). Revisits are always FREE. Buy 200 credits for just $19!`
      : `All 3 free analyses used. Sign in with Google to get 10/month — free forever!`

    return {
      error: errorMessage,
      needsAuth: !usageStatus.isAuthenticated,
      needsUpgrade: usageStatus.isAuthenticated,
      usageStatus: usageStatus,
    }
  }

  // Note: Backend handles all caching via Redis (24h TTL)
  // No frontend cache needed - backend cache is fast (~50-100ms) and keeps single source of truth

  try {
    // Prepare API request data
    const apiData = {
      companyName:
        companyData.name || companyData.companyName || 'Unknown Company',
      industry: companyData.industry || '',
      size: companyData.size || '',
      location: companyData.location || '',
      website: companyData.website || '',
      description: companyData.description || '',
    }

    logger.info('[LinkedIntel] Calling backend API for company analysis')

    // Call backend API
    const backendResponse = await makeAPICall(
      '/analyze/company',
      'POST',
      apiData
    )

    if (!backendResponse || backendResponse.error || !backendResponse.success) {
      throw new Error(backendResponse?.error || 'Analysis failed')
    }

    const analysisResult = backendResponse.data

    // Extract cache status from response
    const wasCached = backendResponse.fromCache || false

    // Backend returns usage data in every response - sync it!
    let updatedUsageStatus
    if (backendResponse.usage) {
      logger.info(
        `[LinkedIntel] Backend usage response: ${JSON.stringify(
          backendResponse.usage
        )} | creditsCharged: ${
          backendResponse.creditsCharged
        } | chargeReason: ${backendResponse.chargeReason}`
      )
      await syncUsageFromResponse(backendResponse.usage)

      // Use backend's authoritative usage data directly (don't re-fetch from storage)
      updatedUsageStatus = {
        isAuthenticated: true,
        userEmail: backendResponse.usage.userEmail,
        userName: backendResponse.usage.userName,
        userAvatar: backendResponse.usage.userAvatar,
        analysesUsed: backendResponse.usage.analysesUsed,
        analysesRemaining:
          backendResponse.usage.analysesRemaining ??
          Math.max(
            0,
            backendResponse.usage.analysesLimit -
              backendResponse.usage.analysesUsed
          ), // ✅ Use backend's value, fallback to calculation
        analysesLimit: backendResponse.usage.analysesLimit,
        planType: backendResponse.usage.planType,
        needsUpgrade:
          backendResponse.usage.analysesUsed >=
          backendResponse.usage.analysesLimit,
      }
    } else {
      // Fallback for anonymous users
      logger.info(
        '[LinkedIntel] No usage data from backend, incrementing anonymous counter'
      )
      await incrementAnonymousUsage(usageStatus)
      // Re-fetch for anonymous users only
      updatedUsageStatus = await getUsageStatus()
    }

    logger.info(
      `[LinkedIntel] Updated usage status: ${updatedUsageStatus.analysesUsed}/${updatedUsageStatus.analysesLimit} (remaining: ${updatedUsageStatus.analysesRemaining})`
    )

    logger.info('[LinkedIntel] Company analysis completed successfully')

    // Track successful company analysis with GA4
    analytics.trackEvent('analysis_completed', {
      analysis_type: 'company',
      company_name: apiData.companyName,
      has_industry: !!apiData.industry,
      from_cache: wasCached,
      analyses_remaining: updatedUsageStatus.analysesRemaining,
      is_authenticated: usageStatus.isAuthenticated,
      plan_type: usageStatus.planType || 'anonymous',
    })

    return {
      data: analysisResult,
      pageType: 'company', // ✅ Indicate this is a company analysis
      citations: backendResponse.citations || [], // ✅ Pass through citations from backend
      analysesRemaining: updatedUsageStatus.analysesRemaining,
      usageStatus: updatedUsageStatus,
      fromCache: wasCached,
    }
  } catch (error) {
    logger.error('[LinkedIntel] Company analysis error:', error)
    return {
      error: error.message || 'Failed to analyze company. Please try again.',
      analysesRemaining: usageStatus.analysesRemaining,
      usageStatus: usageStatus,
    }
  }
}

// ====================
// API & CACHING UTILITIES
// ====================

/**
 * Update usage from backend response
 * Called after successful analysis with usage data from API response
 */
async function syncUsageFromResponse(usageData) {
  if (!usageData) return

  try {
    // Save the backend's authoritative count (from database)
    await chrome.storage.local.set({
      monthly_analyses_used: usageData.analysesUsed,
      monthly_analyses_limit: usageData.analysesLimit,
      plan_type: usageData.planType,
    })

    logger.info(
      '[LinkedIntel] ✅ Usage synced from response:',
      usageData.analysesUsed,
      'of',
      usageData.analysesLimit,
      '(Plan:',
      usageData.planType + ')'
    )

    // Update badge with new count
    await updateBadge()

    // Notify popup and content scripts that usage was updated
    try {
      await chrome.runtime.sendMessage({
        type: 'USAGE_UPDATED',
        usage: usageData,
      })
    } catch (e) {
      // Popup might not be open, that's okay
      logger.debug('[LinkedIntel] No listeners for usage update')
    }
  } catch (error) {
    logger.warn('[LinkedIntel] ⚠️  Failed to sync usage:', error)
  }
}

/**
 * Increment usage counter for anonymous users
 * (Authenticated users get usage from API responses)
 */
async function incrementAnonymousUsage(usageStatus) {
  if (!usageStatus.isAuthenticated) {
    // Anonymous user - increment lifetime counter
    const newAnonymousUsed = usageStatus.analysesUsed + 1
    await chrome.storage.local.set({
      anonymous_analyses_used: newAnonymousUsed,
    })
    logger.debug(
      '[LinkedIntel] Anonymous analysis completed. Used:',
      newAnonymousUsed,
      'of',
      CONFIG.ANONYMOUS_ANALYSES_LIMIT
    )
  }
}

/**
 * Handle chat query to backend
 */
async function handleChat(chatData) {
  logger.info('[LinkedIntel] Handling chat query')

  try {
    const { messages, context } = chatData

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return {
        success: false,
        error: 'Messages array is required',
      }
    }

    // Prepare API request
    const apiData = {
      messages: messages,
      context: context || null,
    }

    logger.info('[LinkedIntel] Calling backend API for chat')

    // Call backend API
    const backendResponse = await makeAPICall('/analyze/chat', 'POST', apiData)

    if (!backendResponse || backendResponse.error || !backendResponse.success) {
      throw new Error(backendResponse?.error || 'Chat failed')
    }

    logger.info('[LinkedIntel] Chat response received successfully')

    // Return response
    return {
      success: true,
      message: backendResponse.message,
      citations: backendResponse.citations || [],
      timestamp: backendResponse.timestamp || new Date().toISOString(),
    }
  } catch (error) {
    logger.error('[LinkedIntel] Chat error:', error)
    return {
      success: false,
      error:
        error.message || 'Failed to process chat request. Please try again.',
    }
  }
}

/**
 * Make API call to backend with retry logic and timeout
 */
async function makeAPICall(endpoint, method = 'GET', data = null) {
  const url = `${CONFIG.API_BASE_URL}${endpoint}`
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'LinkedIntel-Extension/1.0.0',
    },
  }

  if (data) {
    options.body = JSON.stringify(data)
  }

  for (let attempt = 0; attempt < CONFIG.RETRY_ATTEMPTS; attempt++) {
    try {
      // Include auth token if available (for authenticated users)
      // Re-read on each attempt in case it was refreshed
      try {
        const result = await chrome.storage.local.get(['auth_token'])
        if (result.auth_token) {
          options.headers['Authorization'] = `Bearer ${result.auth_token}`
          logger.debug('[LinkedIntel] Including auth token in API call')
        } else {
          // Remove Authorization header if no token exists
          delete options.headers['Authorization']
        }
      } catch (error) {
        logger.warn('[LinkedIntel] Could not retrieve auth token:', error)
      }

      logger.debug(
        `[LinkedIntel] API call attempt ${attempt + 1}: ${method} ${endpoint}`
      )

      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        CONFIG.REQUEST_TIMEOUT
      )

      options.signal = controller.signal

      const response = await fetch(url, options)
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        let errorData = null

        // Try to parse error as JSON to extract usage data
        try {
          errorData = JSON.parse(errorText)
        } catch (e) {
          // Error is not JSON, treat as plain text
        }

        // Handle 429 Too Many Requests - extract and save usage data
        if (response.status === 429 && errorData && errorData.usage) {
          logger.warn(
            '[LinkedIntel] ⚠️ Limit exceeded - syncing usage from error response:',
            errorData.usage
          )

          // Save the authoritative usage data from backend
          await chrome.storage.local.set({
            monthly_analyses_used: errorData.usage.analysesUsed,
            monthly_analyses_limit: errorData.usage.analysesLimit,
            plan_type: errorData.usage.planType,
          })

          // Update badge to show 0 remaining
          await updateBadge()

          // Notify UI to refresh
          try {
            await chrome.runtime.sendMessage({
              type: 'USAGE_UPDATED',
              usage: errorData.usage,
            })
          } catch (e) {
            logger.debug('[LinkedIntel] No listeners for usage update')
          }

          // Continue to throw the error so UI shows the message
        }

        // Handle 401 Unauthorized - try to refresh token first
        if (response.status === 401 && attempt === 0) {
          logger.warn(
            '[LinkedIntel] 401 Unauthorized - attempting token refresh'
          )

          // Try to refresh the token silently
          const refreshed = await refreshAuthToken()

          if (refreshed) {
            logger.info(
              '[LinkedIntel] Token refreshed successfully, retrying request'
            )
            // Token refreshed - retry the request on next attempt
            continue
          } else {
            // Token refresh failed - clear auth state
            logger.warn(
              '[LinkedIntel] Token refresh failed, clearing auth state'
            )
            await chrome.storage.local.remove([
              'auth_token',
              'user_email',
              'user_name',
              'user_avatar',
              'user_id',
              'monthly_analyses_used',
              'monthly_analyses_limit',
              'plan_type',
              'auth_timestamp',
            ])

            // For usage endpoints, fail silently - anonymous users don't need them
            if (endpoint.includes('/usage')) {
              logger.debug(
                '[LinkedIntel] Skipping usage endpoint for anonymous user'
              )
              return {
                success: true,
                message: 'Anonymous user - no usage tracking',
              }
            }
          }
        }

        throw new Error(`API error (${response.status}): ${errorText}`)
      }

      const result = await response.json()
      logger.debug(`[LinkedIntel] API call successful: ${method} ${endpoint}`)

      return result
    } catch (error) {
      logger.error(
        `[LinkedIntel] API call attempt ${attempt + 1} failed:`,
        error.message
      )

      if (error.name === 'AbortError') {
        throw new Error('Request timeout - backend might be unavailable')
      }

      if (attempt === CONFIG.RETRY_ATTEMPTS - 1) {
        throw new Error(
          `API call failed after ${CONFIG.RETRY_ATTEMPTS} attempts: ${error.message}`
        )
      }

      // Exponential backoff
      await delay(Math.pow(2, attempt) * 1000)
    }
  }
}

/**
 * ✅ Frontend cache removed - backend Redis cache (24h TTL) is sufficient
 *
 * This eliminates redundant dual-cache architecture and maintains single source of truth.
 * Backend cache is already fast (~50-100ms) for repeat requests, making frontend caching
 * unnecessary overhead for analyses that take 10-15 seconds.
 *
 * Previously removed functions:
 * - generateCacheKey()
 * - cacheAnalysisInSession()
 * - getSessionCachedAnalysis()
 */

/**
 * Get cache statistics from backend database
 */
async function getCacheStats() {
  try {
    logger.debug('[LinkedIntel] Fetching cache stats from backend database')

    // Get stats from backend database cache
    const response = await makeAPICall('/analyze/cache/stats', 'GET')

    if (response && response.success) {
      return {
        success: true,
        cacheType: 'database',
        ...response.stats,
      }
    }

    return { success: false, error: 'Failed to fetch cache stats' }
  } catch (error) {
    logger.error('[LinkedIntel] Error getting cache stats:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Utility delay function
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ====================
// ENHANCED MESSAGE HANDLERS & LIFECYCLE
// ====================

// Service worker periodic tasks
chrome.runtime.onStartup.addListener(async () => {
  logger.info('[LinkedIntel] Browser startup - initializing service worker')
  await updateBadge()
  // Session cache auto-clears on browser restart - no manual cleanup needed
})

// Open Chrome side panel and communicate with it
async function openSidePanel(tabId, data) {
  try {
    logger.info('[LinkedIntel] Opening side panel for tab:', tabId)

    // Open the side panel
    await chrome.sidePanel.open({ tabId })

    // Store context data for the side panel to read
    await chrome.storage.session.set({
      [`sidepanel_context_${tabId}`]: {
        url: data.url,
        pageType: data.pageType,
        timestamp: Date.now(),
      },
    })

    logger.info('[LinkedIntel] Side panel opened and context stored')
  } catch (error) {
    logger.error('[LinkedIntel] Error opening side panel:', error)
    throw error
  }
}

// Enhanced error boundary for service worker
self.addEventListener('error', (event) => {
  logger.error('[LinkedIntel] Service worker error:', event.error)
})

self.addEventListener('unhandledrejection', (event) => {
  logger.error(
    '[LinkedIntel] Service worker unhandled rejection:',
    event.reason
  )
})

// Listen for storage changes to update badge
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    // Check if any usage-related fields changed
    if (
      changes.anonymous_analyses_used ||
      changes.monthly_analyses_used ||
      changes.monthly_analyses_limit
    ) {
      logger.debug('[LinkedIntel] Usage data changed, updating badge')
      updateBadge()
    }
  }
})

// ====================
// GOOGLE AUTHENTICATION HANDLERS
// ====================

/**
 * Refresh expired Google OAuth token silently
 * Returns true if token was refreshed successfully, false otherwise
 */
async function refreshAuthToken() {
  try {
    logger.info('[LinkedIntel] Attempting to refresh OAuth token silently')

    // Remove cached token first to force refresh
    const result = await chrome.storage.local.get(['auth_token'])
    const oldToken = result.auth_token

    if (oldToken) {
      // Remove from Chrome's cache
      await new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token: oldToken }, () => {
          resolve()
        })
      })
    }

    // Try to get a new token silently (non-interactive)
    const newToken = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve(token)
        }
      })
    })

    if (!newToken) {
      logger.warn(
        '[LinkedIntel] Silent token refresh failed - no token returned'
      )
      return false
    }

    logger.info('[LinkedIntel] New token acquired, verifying with backend')

    // Verify new token with backend
    const verifyResponse = await fetch(
      `${CONFIG.API_BASE_URL}/auth/google/verify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: newToken }),
      }
    )

    if (!verifyResponse.ok) {
      logger.error(
        '[LinkedIntel] Token verification failed:',
        verifyResponse.status
      )
      return false
    }

    const verifyResult = await verifyResponse.json()

    if (!verifyResult.success) {
      logger.error(
        '[LinkedIntel] Token verification unsuccessful:',
        verifyResult.error
      )
      return false
    }

    const sessionToken = verifyResult.token

    if (!sessionToken) {
      logger.error('[LinkedIntel] Backend did not return session token')
      return false
    }

    // Update stored token and user data with the Supabase session token
    await chrome.storage.local.set({
      auth_token: sessionToken, // Store the Supabase token, not the Google token
      user_email: verifyResult.user.email,
      user_name: verifyResult.user.name,
      user_avatar: verifyResult.user.picture,
      user_id: verifyResult.user.id,
      monthly_analyses_used: verifyResult.usage.analysesUsed || 0,
      monthly_analyses_limit: verifyResult.usage.analysesLimit || 10,
      plan_type: verifyResult.usage.planType || 'free',
      auth_timestamp: Date.now(),
    })

    logger.info('[LinkedIntel] Token refresh completed successfully')
    return true
  } catch (error) {
    logger.error('[LinkedIntel] Error refreshing auth token:', error)
    return false
  }
}

/**
 * Handle Google Sign-In using Chrome Identity API
 */
async function handleGoogleSignIn() {
  try {
    logger.info('[LinkedIntel] Starting Google Sign-In flow')

    // Step 1: Get OAuth token from Chrome Identity API
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve(token)
        }
      })
    })

    if (!token) {
      throw new Error('Failed to get authentication token')
    }

    logger.info('[LinkedIntel] OAuth token acquired, verifying with backend')

    // Step 2: Verify token with backend and get user info
    const verifyResponse = await makeAPICall('/auth/google/verify', 'POST', {
      token: token,
    })

    if (!verifyResponse || !verifyResponse.success) {
      throw new Error(verifyResponse?.error || 'Token verification failed')
    }

    const userData = verifyResponse.user
    const usageData = verifyResponse.usage
    const sessionToken = verifyResponse.token // Get the Supabase session token from backend

    logger.info('[LinkedIntel] User authenticated:', userData.email)

    if (!sessionToken) {
      throw new Error('Backend did not return session token')
    }

    // Step 3: Store user data and Supabase session token locally
    await chrome.storage.local.set({
      auth_token: sessionToken, // Store the Supabase token, not the Google token
      user_email: userData.email,
      user_name: userData.name,
      user_avatar: userData.picture,
      user_id: userData.id,
      monthly_analyses_used: usageData.analysesUsed || 0,
      monthly_analyses_limit: usageData.analysesLimit || 10,
      plan_type: usageData.planType || 'free',
      auth_timestamp: Date.now(),
    })

    // Step 4: Update badge
    await updateBadge()

    // Step 5: Notify popup and content scripts
    try {
      await chrome.runtime.sendMessage({
        type: 'AUTH_STATE_CHANGED',
        authenticated: true,
        user: userData,
      })
    } catch (e) {
      // Message might fail if popup isn't open
      logger.debug('[LinkedIntel] Could not notify popup of auth state change')
    }

    logger.info('[LinkedIntel] Google Sign-In completed successfully')

    // Track successful sign-in with GA4
    analytics.trackEvent('google_signin_success', {
      user_id: userData.id,
      plan_type: usageData.planType || 'free',
      analyses_remaining:
        (usageData.analysesLimit || 10) - (usageData.analysesUsed || 0),
    })

    // Set user properties in GA4
    analytics.setUserProperties({
      plan_type: { value: usageData.planType || 'free' },
      is_authenticated: { value: true },
    })

    return {
      success: true,
      user: userData,
      usage: usageData,
    }
  } catch (error) {
    logger.error('[LinkedIntel] Google Sign-In error:', error)

    // Clean up any partial auth state
    await chrome.storage.local.remove([
      'auth_token',
      'user_email',
      'user_name',
      'user_avatar',
      'user_id',
    ])

    return {
      success: false,
      error: error.message || 'Sign-in failed. Please try again.',
    }
  }
}

/**
 * Handle Google Sign-Out
 */
async function handleGoogleSignOut() {
  try {
    logger.info('[LinkedIntel] Starting Google Sign-Out')

    // Step 1: Get current auth token
    const result = await chrome.storage.local.get(['auth_token'])
    const token = result.auth_token

    // Step 2: Revoke token with Chrome Identity API
    if (token) {
      await new Promise((resolve, reject) => {
        chrome.identity.removeCachedAuthToken({ token: token }, () => {
          if (chrome.runtime.lastError) {
            logger.warn(
              '[LinkedIntel] Error removing cached token:',
              chrome.runtime.lastError
            )
            // Don't reject, continue with sign-out
          }
          resolve()
        })
      })

      // Also try to revoke with Google
      try {
        await fetch(
          `https://accounts.google.com/o/oauth2/revoke?token=${token}`
        )
      } catch (e) {
        logger.warn('[LinkedIntel] Could not revoke token with Google:', e)
        // Continue anyway
      }
    }

    // Step 3: Clear all user data from storage
    await chrome.storage.local.remove([
      'auth_token',
      'user_email',
      'user_name',
      'user_avatar',
      'user_id',
      'monthly_analyses_used',
      'monthly_analyses_limit',
      'plan_type',
      'auth_timestamp',
    ])

    // Step 4: Update badge
    await updateBadge()

    // Step 5: Notify popup and content scripts
    try {
      await chrome.runtime.sendMessage({
        type: 'AUTH_STATE_CHANGED',
        authenticated: false,
      })
    } catch (e) {
      logger.debug('[LinkedIntel] Could not notify popup of auth state change')
    }

    logger.info('[LinkedIntel] Google Sign-Out completed successfully')

    // Track sign-out with GA4
    analytics.trackEvent('google_signout_success')

    // Update user properties in GA4
    analytics.setUserProperties({
      is_authenticated: { value: false },
    })

    return {
      success: true,
    }
  } catch (error) {
    logger.error('[LinkedIntel] Google Sign-Out error:', error)

    return {
      success: false,
      error: error.message || 'Sign-out failed. Please try again.',
    }
  }
}

/**
 * Sync user usage data with backend
 * Called periodically to ensure local data matches server
 */
async function syncUserUsage() {
  try {
    const result = await chrome.storage.local.get(['auth_token', 'user_id'])

    if (!result.auth_token) {
      // Not authenticated, nothing to sync
      return
    }

    logger.debug('[LinkedIntel] Syncing user usage data')

    // Get usage data from backend
    const response = await makeAPICall('/auth/usage', 'GET')

    if (response && response.success) {
      await chrome.storage.local.set({
        monthly_analyses_used: response.usage.analysesUsed,
        monthly_analyses_limit: response.usage.analysesLimit,
        plan_type: response.usage.planType,
      })

      await updateBadge()
      logger.debug('[LinkedIntel] Usage data synced successfully')
    }
  } catch (error) {
    logger.error('[LinkedIntel] Error syncing user usage:', error)
  }
}

// Sync usage data when service worker starts
chrome.runtime.onStartup.addListener(async () => {
  await syncUserUsage()
})

// Sync usage data periodically (every 5 minutes)
chrome.alarms.create('linkedintel-usage-sync', {
  delayInMinutes: 5,
  periodInMinutes: 5,
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'linkedintel-usage-sync') {
    await syncUserUsage()
  }
})

// ====================
// SMART ICON ACTIVATION - WEB NAVIGATION BASED (#4 + #9)
// ====================

/**
 * Setup smart icon activation using Web Navigation API
 * Icon is only enabled on LinkedIn profile/company pages
 * Disables action globally and on all existing non-LinkedIn tabs
 */
async function setupSmartIconActivation() {
  try {
    logger.info(
      '[LinkedIntel] Setting up smart icon activation (Web Navigation based)'
    )

    // Step 1: Disable action globally by default
    await chrome.action.disable()
    logger.debug('[LinkedIntel] Extension action disabled globally by default')

    // Step 2: Enable/disable action on all existing tabs and manage badges
    const tabs = await chrome.tabs.query({})
    for (const tab of tabs) {
      try {
        // Check if this tab is a LinkedIn profile/company page
        if (tab.url) {
          const url = new URL(tab.url)
          const isLinkedInPage =
            url.hostname.includes('linkedin.com') &&
            (url.pathname.includes('/in/') ||
              url.pathname.includes('/company/'))

          if (isLinkedInPage) {
            await chrome.action.enable(tab.id)
            await updateBadge(tab.id) // Show badge on LinkedIn pages
          } else {
            await chrome.action.disable(tab.id)
            // Clear badge on non-LinkedIn pages
            await chrome.action.setBadgeText({ tabId: tab.id, text: '' })
          }
        } else {
          await chrome.action.disable(tab.id)
          await chrome.action.setBadgeText({ tabId: tab.id, text: '' })
        }
      } catch (e) {
        // Skip tabs that can't be accessed
      }
    }
    logger.info(
      '[LinkedIntel] Action state and badges updated for all existing tabs - using Web Navigation API for dynamic control'
    )
  } catch (error) {
    logger.error('[LinkedIntel] Error setting up smart icon activation:', error)
  }
}

// ====================
// WEB NAVIGATION API - SPA HANDLING (#9)
// ====================

/**
 * Handle LinkedIn SPA navigation using Web Navigation API
 * More reliable and efficient than MutationObserver polling
 */

// Track which tabs have LinkedIn pages to optimize processing
const linkedInTabs = new Set()

// Listen for history state updates (LinkedIn SPA navigation)
chrome.webNavigation.onHistoryStateUpdated.addListener(
  async (details) => {
    try {
      logger.debug('[LinkedIntel] SPA navigation detected:', details.url)

      const url = new URL(details.url)
      const isProfilePage = url.pathname.includes('/in/')
      const isCompanyPage = url.pathname.includes('/company/')

      if (isProfilePage || isCompanyPage) {
        linkedInTabs.add(details.tabId)

        // Notify content script about navigation change
        try {
          await chrome.tabs.sendMessage(details.tabId, {
            type: 'SPA_NAVIGATION',
            data: {
              url: details.url,
              pageType: isProfilePage ? 'profile' : 'company',
              timestamp: Date.now(),
            },
          })
          logger.debug(
            '[LinkedIntel] SPA navigation notification sent to content script'
          )
        } catch (error) {
          // Content script might not be ready yet, that's okay
          logger.debug(
            '[LinkedIntel] Content script not ready for SPA notification'
          )
        }

        // Update stored context if this tab has an active session
        const { currentContext } = await chrome.storage.session.get([
          'currentContext',
        ])
        if (currentContext && currentContext.tabId === details.tabId) {
          await chrome.storage.session.set({
            currentContext: {
              ...currentContext,
              url: details.url,
              pageType: isProfilePage ? 'profile' : 'company',
              timestamp: Date.now(),
            },
          })
        }

        // Enable action and update badge for this tab
        await chrome.action.enable(details.tabId)
        await updateBadge(details.tabId)
      } else {
        // Not a LinkedIn page we care about
        linkedInTabs.delete(details.tabId)

        // Disable action and clear badge for non-relevant pages
        await chrome.action.disable(details.tabId)
        await chrome.action.setBadgeText({ tabId: details.tabId, text: '' })
      }
    } catch (error) {
      logger.error('[LinkedIntel] Error handling SPA navigation:', error)
    }
  },
  {
    url: [{ hostEquals: 'www.linkedin.com' }, { hostEquals: 'linkedin.com' }],
  }
)

// Listen for page load completion (initial page loads and hard refreshes)
chrome.webNavigation.onCompleted.addListener(
  async (details) => {
    // Only process main frame navigation (ignore iframes)
    if (details.frameId !== 0) return

    try {
      logger.debug('[LinkedIntel] Page load completed:', details.url)

      const url = new URL(details.url)
      const isProfilePage = url.pathname.includes('/in/')
      const isCompanyPage = url.pathname.includes('/company/')

      if (isProfilePage || isCompanyPage) {
        linkedInTabs.add(details.tabId)
        logger.info('[LinkedIntel] LinkedIn page detected on load:', {
          tabId: details.tabId,
          pageType: isProfilePage ? 'profile' : 'company',
        })

        // Enable action and update badge for this tab
        await chrome.action.enable(details.tabId)
        await updateBadge(details.tabId)
      } else {
        linkedInTabs.delete(details.tabId)

        // Disable action and clear badge for non-profile/company pages
        await chrome.action.disable(details.tabId)
        await chrome.action.setBadgeText({ tabId: details.tabId, text: '' })
      }
    } catch (error) {
      logger.error('[LinkedIntel] Error handling page load completion:', error)
    }
  },
  {
    url: [{ hostEquals: 'www.linkedin.com' }, { hostEquals: 'linkedin.com' }],
  }
)

// Clean up tracking when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  linkedInTabs.delete(tabId)
})

// ====================
// SCRIPTING API - DYNAMIC INJECTION HELPERS (#8)
// ====================

/**
 * Dynamically inject content scripts into LinkedIn pages on demand
 * Currently used as fallback, but foundation for future optimization
 */
async function injectContentScripts(tabId) {
  try {
    logger.debug(
      '[LinkedIntel] Dynamically injecting content scripts into tab:',
      tabId
    )

    // Check if scripts are already injected
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' })
      if (response && response.success) {
        logger.debug('[LinkedIntel] Content scripts already injected')
        return true
      }
    } catch (e) {
      // Scripts not injected, continue
    }

    // Inject scripts in correct order (logger first, then others)
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: [
        'src/shared/logger.js',
        'src/content/badge-injector.js',
        'src/content/insights-panel.js',
        'src/content/fab-component.js',
        'src/content/linkedin-detector.js',
      ],
    })

    logger.info(
      '[LinkedIntel] Content scripts dynamically injected successfully'
    )
    return true
  } catch (error) {
    logger.error('[LinkedIntel] Error injecting content scripts:', error)
    return false
  }
}

/**
 * Check if content scripts are injected in a tab
 */
async function areContentScriptsInjected(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' })
    return response && response.success
  } catch (error) {
    return false
  }
}

logger.debug(
  '[LinkedIntel] Service worker loaded successfully - v3.1.0 (Backend Database Caching with 2-min Session Cache)'
)
