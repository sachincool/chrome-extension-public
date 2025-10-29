// LinkedIntel FAB Component - Modern Floating Action Button with Usage Counter
// Provides a responsive, animated FAB with usage tracking and side panel integration

// Initialize logger using shared helper function
const fabLogger = window.createLogger('FAB')

class LinkedIntelFAB {
  constructor() {
    this.analysesRemaining = 3 // Initial anonymous limit
    this.analysesUsed = 0
    this.analysesLimit = 3
    this.isAuthenticated = false
    this.planType = 'anonymous'
    this.fabElement = null
    this.usageBadge = null
    this.isAnimating = false
    this.isVisible = false

    // Bind methods
    this.handleClick = this.handleClick.bind(this)
    this.handleHover = this.handleHover.bind(this)
    this.handleMouseLeave = this.handleMouseLeave.bind(this)
    this.handleUsageUpdate = this.handleUsageUpdate.bind(this)

    // Initialize usage tracking
    this.initializeUsageStatus()

    // Listen for usage updates from service worker
    this.setupMessageListener()
  }

  // Initialize usage status from storage via message passing
  async initializeUsageStatus() {
    try {
      // Check if extension context is valid before making calls
      if (!this.isExtensionContextValid()) {
        fabLogger.debug(
          'LinkedIntel FAB: Extension context invalid, using default usage'
        )
        this.analysesRemaining = 5
        return
      }

      const response = await chrome.runtime.sendMessage({
        type: 'GET_USAGE_STATUS',
      })
      if (response && response.analysesRemaining !== undefined) {
        this.analysesRemaining = response.analysesRemaining
        this.analysesUsed = response.analysesUsed || 0
        this.analysesLimit = response.analysesLimit || 5
        this.isAuthenticated = response.isAuthenticated || false
        this.planType = response.planType || 'anonymous'

        fabLogger.info(
          `[LinkedIntel FAB] Initial usage loaded: ${this.analysesRemaining} remaining (${this.analysesUsed}/${this.analysesLimit})`
        )
      } else {
        this.analysesRemaining = 3
      }
    } catch (error) {
      fabLogger.debug(
        'LinkedIntel FAB: Using default usage due to error:',
        error.message
      )
      this.analysesRemaining = 3
    }
  }

  // Setup message listener for usage updates from service worker
  setupMessageListener() {
    chrome.runtime.onMessage.addListener(this.handleUsageUpdate)
    fabLogger.debug(
      '[LinkedIntel FAB] Message listener setup for usage updates'
    )
  }

  // Handle usage update messages from service worker
  handleUsageUpdate(message, sender, sendResponse) {
    if (message.type === 'USAGE_UPDATED' && message.usage) {
      fabLogger.info(
        `[LinkedIntel FAB] 📨 Received usage update from service worker:`,
        message.usage
      )
      this.updateUsageStatus(message.usage)
      sendResponse({ received: true })
    }
    return true // Keep message channel open for async response
  }

  // Check if extension context is still valid
  isExtensionContextValid() {
    try {
      // Try to access chrome.runtime.id - if this throws, context is invalid
      return chrome.runtime && chrome.runtime.id !== undefined
    } catch (error) {
      return false
    }
  }

  // Show extension context error with auto-reload
  showExtensionContextError() {
    fabLogger.debug(
      'LinkedIntel FAB: Extension context invalidated, auto-reloading page...'
    )

    // Show brief notification before reload
    const notification = document.createElement('div')
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      animation: slideDown 0.3s ease;
    `
    notification.textContent = '🔄 LinkedIntel updated, reloading...'
    document.body.appendChild(notification)

    // Auto-reload after brief delay
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  }

  // Create and inject FAB into the page
  inject() {
    if (this.fabElement) {
      this.remove()
    }

    this.createFABElement()
    this.injectStyles()
    this.attachEventListeners()
    this.animateIn()

    fabLogger.debug('LinkedIntel: FAB component injected')
  }

  // Create the FAB DOM structure
  createFABElement() {
    const fab = document.createElement('div')
    fab.id = 'linkedintel-fab'
    fab.className = 'linkedintel-fab-container'

    const tooltipText = this.isAuthenticated
      ? `${this.analysesRemaining}/${this.analysesLimit} unique entities remaining`
      : `${this.analysesRemaining} free trials left`

    const revisitHint = this.isAuthenticated
      ? `<small style="color: #10b981; margin-top: 4px; display: block;">✓ Revisits are always FREE</small>`
      : ''

    fab.innerHTML = `
      <div class="linkedintel-fab-tooltip">
        <div class="linkedintel-tooltip-line">
          <svg class="linkedintel-tooltip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          <span>${tooltipText}</span>
        </div>
        ${revisitHint}
        ${
          !this.isAuthenticated && this.analysesRemaining <= 1
            ? `
        <div class="linkedintel-tooltip-line" style="color: #ffd43b; margin-top: 6px;">
          <svg class="linkedintel-tooltip-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <span>Sign in for 10 more trials</span>
        </div>
        `
            : ''
        }
      </div>
      <div class="linkedintel-fab-button" role="button" tabindex="0" aria-label="Analyze with LinkedIntel">
        <div class="linkedintel-fab-icon">
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
          </svg>
        </div>
        <div class="linkedintel-fab-ripple"></div>
      </div>
      <div class="linkedintel-usage-badge" aria-label="Analyses remaining: ${
        this.analysesRemaining
      }">
        <span class="linkedintel-usage-count">${this.analysesRemaining}</span>
      </div>
    `

    this.fabElement = fab
    this.usageBadge = fab.querySelector('.linkedintel-usage-badge')
    document.body.appendChild(fab)
  }

  // Inject component styles
  injectStyles() {
    if (document.getElementById('linkedintel-fab-styles')) {
      return
    }

    const style = document.createElement('style')
    style.id = 'linkedintel-fab-styles'
    style.textContent = `
      /* LinkedIntel FAB Styles */
      .linkedintel-fab-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        opacity: 0;
        transform: scale(0.8) translateY(20px);
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: none;
      }

      .linkedintel-fab-container.visible {
        opacity: 1;
        transform: scale(1) translateY(0);
        pointer-events: all;
      }

      .linkedintel-fab-button {
        position: relative;
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #4c6ef5 0%, #667eea 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 
          0 4px 12px rgba(76, 110, 245, 0.25),
          0 2px 4px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
        color: white;
        overflow: hidden;
        outline: none;
        border: 3px solid #2d3436;
        position: relative;
      }


      .linkedintel-fab-button:hover {
        transform: scale(1.05);
        box-shadow: 
          0 6px 16px rgba(76, 110, 245, 0.35),
          0 2px 8px rgba(0, 0, 0, 0.15);
        background: linear-gradient(135deg, #5c7cfa 0%, #748ffc 100%);
      }

      .linkedintel-fab-button:active {
        transform: translateY(-1px) scale(0.98);
        transition: all 0.1s ease;
      }

      .linkedintel-fab-button:focus {
        outline: 2px solid rgba(0, 102, 204, 0.5);
        outline-offset: 4px;
      }

      .linkedintel-fab-icon {
        position: relative;
        z-index: 2;
        transition: transform 0.2s ease;
      }

      .linkedintel-fab-button:hover .linkedintel-fab-icon {
        transform: scale(1.1) rotate(5deg);
      }

      .linkedintel-fab-icon svg {
        width: 24px;
        height: 24px;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
      }

      /* Ripple effect */
      .linkedintel-fab-ripple {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        transition: width 0.6s, height 0.6s;
        pointer-events: none;
      }

      .linkedintel-fab-button.ripple .linkedintel-fab-ripple {
        width: 120px;
        height: 120px;
        opacity: 0;
      }

      /* Credit Badge */
      .linkedintel-credit-badge {
        position: absolute;
        top: -6px;
        right: -6px;
        min-width: 24px;
        height: 24px;
        background: linear-gradient(135deg, #ff5a5f 0%, #e84393 100%);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 
          0 2px 6px rgba(255, 90, 95, 0.3),
          0 0 0 2px white;
        transform: scale(1);
        transition: all 0.2s ease;
      }

      .linkedintel-credit-badge.low-credits {
        background: linear-gradient(135deg, #ff4757 0%, #ff3742 100%);
        animation: urgentPulse 1s infinite;
      }

      .linkedintel-credit-badge.no-credits {
        background: linear-gradient(135deg, #747d8c 0%, #57606f 100%);
        animation: none;
      }

      .linkedintel-credit-count {
        font-size: 12px;
        font-weight: 700;
        color: white;
        line-height: 1;
        padding: 0 6px;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      }

      /* Usage Badge (New monetization system) */
      .linkedintel-usage-badge {
        position: absolute;
        top: -6px;
        right: -6px;
        min-width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #51cf66 0%, #37b24d 100%);
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 
          0 2px 8px rgba(81, 207, 102, 0.4),
          0 0 0 3px white;
        transform: scale(1);
        transition: all 0.3s ease;
        animation: slideInBadge 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      @keyframes slideInBadge {
        0% {
          transform: scale(0) rotate(-45deg);
          opacity: 0;
        }
        100% {
          transform: scale(1) rotate(0deg);
          opacity: 1;
        }
      }

      .linkedintel-usage-badge:hover {
        transform: scale(1.1);
      }

      .linkedintel-usage-badge.low-analyses {
        background: linear-gradient(135deg, #ff922b 0%, #fd7e14 100%);
        box-shadow: 
          0 2px 8px rgba(255, 146, 43, 0.4),
          0 0 0 3px white;
        animation: warnPulse 1.5s ease-in-out infinite;
      }

      @keyframes warnPulse {
        0%, 100% {
          transform: scale(1);
          box-shadow: 
            0 2px 8px rgba(255, 146, 43, 0.4),
            0 0 0 3px white;
        }
        50% {
          transform: scale(1.1);
          box-shadow: 
            0 4px 12px rgba(255, 146, 43, 0.6),
            0 0 0 3px white;
        }
      }

      .linkedintel-usage-badge.no-analyses {
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
        box-shadow: 
          0 2px 8px rgba(255, 107, 107, 0.4),
          0 0 0 3px white;
        animation: dangerPulse 1s ease-in-out infinite;
      }

      @keyframes dangerPulse {
        0%, 100% {
          transform: scale(1);
          box-shadow: 
            0 2px 8px rgba(255, 107, 107, 0.4),
            0 0 0 3px white;
        }
        50% {
          transform: scale(1.15);
          box-shadow: 
            0 4px 16px rgba(255, 107, 107, 0.7),
            0 0 0 3px white,
            0 0 0 6px rgba(255, 107, 107, 0.2);
        }
      }

      .linkedintel-usage-count {
        font-size: 13px;
        font-weight: 800;
        color: white;
        line-height: 1;
        padding: 0 6px;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        letter-spacing: -0.5px;
      }

      /* Tooltip for usage information */
      .linkedintel-fab-tooltip {
        position: absolute;
        bottom: calc(100% + 12px);
        right: 0;
        background: rgba(33, 37, 41, 0.95);
        backdrop-filter: blur(8px);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transform: translateY(4px);
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10;
      }

      .linkedintel-fab-tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        right: 20px;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid rgba(33, 37, 41, 0.95);
      }

      .linkedintel-fab-container:hover .linkedintel-fab-tooltip {
        opacity: 1;
        transform: translateY(0);
      }

      .linkedintel-tooltip-line {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }

      .linkedintel-tooltip-line:last-child {
        margin-bottom: 0;
      }

      .linkedintel-tooltip-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      /* Responsive adjustments */
      @media (max-width: 768px) {
        .linkedintel-fab-container {
          bottom: 20px;
          right: 20px;
        }

        .linkedintel-fab-button {
          width: 50px;
          height: 50px;
        }

        .linkedintel-fab-icon svg {
          width: 20px;
          height: 20px;
        }

        .linkedintel-credit-badge {
          top: -6px;
          right: -6px;
          min-width: 20px;
          height: 20px;
        }

        .linkedintel-credit-count {
          font-size: 11px;
        }

        .linkedintel-usage-badge {
          top: -4px;
          right: -4px;
          min-width: 24px;
          height: 24px;
        }

        .linkedintel-usage-count {
          font-size: 11px;
        }

        .linkedintel-fab-tooltip {
          display: none;
        }
      }

      /* Small mobile screens */
      @media (max-width: 480px) {
        .linkedintel-fab-container {
          bottom: 16px;
          right: 16px;
        }

        .linkedintel-fab-button {
          width: 48px;
          height: 48px;
        }

        .linkedintel-fab-icon svg {
          width: 18px;
          height: 18px;
        }

        .linkedintel-credit-badge {
          top: -4px;
          right: -4px;
          min-width: 18px;
          height: 18px;
        }

        .linkedintel-credit-count {
          font-size: 10px;
          padding: 0 4px;
        }

        .linkedintel-no-credits-message,
        .linkedintel-error-message {
          bottom: 70px;
          right: 16px;
          max-width: calc(100vw - 32px);
          font-size: 13px;
        }
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .linkedintel-fab-button {
          border-width: 2px;
          border-color: currentColor;
        }

        .linkedintel-credit-badge {
          border: 2px solid white;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .linkedintel-fab-container,
        .linkedintel-fab-button,
        .linkedintel-fab-icon,
        .linkedintel-credit-badge,
          transition: none;
          animation: none;
        }
      }

    `

    document.head.appendChild(style)
  }

  // Attach event listeners
  attachEventListeners() {
    if (!this.fabElement) {
      fabLogger.error(
        'LinkedIntel FAB: No fabElement found when attaching listeners'
      )
      return
    }

    const button = this.fabElement.querySelector('.linkedintel-fab-button')
    if (!button) {
      fabLogger.error(
        'LinkedIntel FAB: No button found when attaching listeners'
      )
      return
    }

    // Click handler
    button.addEventListener('click', this.handleClick)

    // Keyboard handler
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        this.handleClick()
      }
    })

    // Simple hover handlers
    button.addEventListener('mouseenter', this.handleHover)
    button.addEventListener('mouseleave', this.handleMouseLeave)
  }

  // Handle FAB click
  async handleClick() {
    if (this.isAnimating) {
      return
    }

    // Check extension context first
    if (!this.isExtensionContextValid()) {
      fabLogger.error('LinkedIntel FAB: Extension context invalid during click')
      this.showExtensionContextError()
      return
    }

    // Set animation state to prevent multiple clicks
    this.isAnimating = true

    this.triggerRippleEffect()

    try {
      // Track FAB click (before analysis)
      this.trackFABClick()

      await this.toggleFloatingPanel()
      // Note: trackUsage() is now called AFTER analysis completes with accurate data
    } catch (error) {
      fabLogger.error('LinkedIntel FAB: Error in handleClick:', error)

      // Check if it's a context error
      if (
        error.message.includes('Extension context invalidated') ||
        error.message.includes('context invalidated') ||
        error.message.includes('receiving end does not exist')
      ) {
        this.showExtensionContextError()
      } else {
        this.showErrorMessage('An error occurred. Please try again.')
      }
    } finally {
      // Reset animation state
      this.isAnimating = false
    }
  }

  // Handle hover effect
  handleHover() {
    if (this.isAnimating) return

    const button = this.fabElement.querySelector('.linkedintel-fab-button')
    button.style.transform = 'translateY(-3px) scale(1.05)'
  }

  // Handle mouse leave
  handleMouseLeave() {
    const button = this.fabElement.querySelector('.linkedintel-fab-button')
    button.style.transform = ''
  }

  // Trigger ripple animation
  triggerRippleEffect() {
    const button = this.fabElement.querySelector('.linkedintel-fab-button')
    const ripple = this.fabElement.querySelector('.linkedintel-fab-ripple')

    button.classList.add('ripple')

    setTimeout(() => {
      button.classList.remove('ripple')
    }, 600)
  }

  // Open Chrome side panel with analysis
  async openSidePanel() {
    try {
      // Send message to service worker to open side panel
      await chrome.runtime.sendMessage({
        type: 'OPEN_SIDE_PANEL',
        data: {
          url: window.location.href,
          pageType: window.linkedInDetector?.pageType || 'unknown',
        },
      })

      fabLogger.debug('LinkedIntel FAB: Side panel opened successfully')
    } catch (error) {
      fabLogger.error('LinkedIntel FAB: Error opening side panel:', error)
      // Fallback to floating panel if side panel fails
      await this.openFloatingPanel()
    }
  }

  // Open insights panel (kept as fallback)
  async openFloatingPanel() {
    try {
      // Get current page data from LinkedInDetector with retry logic
      let pageData = window.linkedInDetector?.getCurrentPageData()

      // If data is not ready, wait and retry up to 3 times
      let retries = 0
      const maxRetries = 3
      const retryDelay = 1500 // 1.5 seconds

      while ((!pageData || !pageData.data) && retries < maxRetries) {
        fabLogger.debug(
          `LinkedIntel FAB: Page data not ready, retrying (${
            retries + 1
          }/${maxRetries})...`
        )
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        pageData = window.linkedInDetector?.getCurrentPageData()
        retries++
      }

      if (!pageData || !pageData.data) {
        fabLogger.warn('LinkedIntel FAB: No page data available after retries')
        this.showErrorMessage(
          'Unable to extract page data. Please refresh the page and try again.'
        )
        return
      }

      // Validate that page data URL matches current URL to prevent stale data issues
      const currentUrl = window.location.href
      const pageDataUrl = pageData.url || pageData.data?.url

      if (
        pageDataUrl &&
        !currentUrl.includes(pageDataUrl.split('?')[0].split('#')[0])
      ) {
        fabLogger.warn(
          '[LinkedIntel FAB] Stale page data detected, forcing re-extraction'
        )
        // Force re-detection of current page
        if (window.linkedInDetector) {
          window.linkedInDetector.detectCurrentPage()
          // Wait a bit and retry
          await new Promise((resolve) => setTimeout(resolve, 1000))
          pageData = window.linkedInDetector?.getCurrentPageData()

          if (!pageData || !pageData.data) {
            this.showErrorMessage(
              'Page data not ready. Please try again in a moment.'
            )
            return
          }
        }
      }

      fabLogger.debug(`[LinkedIntel FAB] Analyzing ${pageData.type} page`)
      fabLogger.debug(`[LinkedIntel FAB] Current URL: ${currentUrl}`)

      // Create insights panel if it doesn't exist
      if (!window.linkedIntelInsightsPanel) {
        window.linkedIntelInsightsPanel = new LinkedIntelInsightsPanel()
      }

      // Show insights panel with loading state
      window.linkedIntelInsightsPanel.show()
      window.linkedIntelInsightsPanel.showLoading('Analyzing LinkedIn page...')

      // Re-extract profile data to get the latest company information
      // This ensures we don't use stale data from initial page load
      if (window.linkedInDetector && pageData.type === 'profile') {
        fabLogger.debug(
          '[LinkedIntel FAB] Re-extracting profile data for fresh company info'
        )
        const freshData = {
          url: window.location.href,
          type: 'profile',
          name: window.linkedInDetector.extractProfileName(),
          headline: window.linkedInDetector.extractProfileHeadline(),
          company: window.linkedInDetector.extractCurrentCompany(),
          location: window.linkedInDetector.extractLocation(),
          activity: window.linkedInDetector.extractRecentActivity(),
          executiveLevel: window.linkedInDetector.detectExecutiveLevel(),
          timestamp: Date.now(),
        }
        fabLogger.debug(
          '[LinkedIntel FAB] Fresh extraction - Company:',
          freshData.company
        )
        pageData.data = freshData
      }

      // Send analysis request to service worker with error handling
      const analysisType =
        pageData.type === 'profile' ? 'ANALYZE_PROFILE' : 'ANALYZE_COMPANY'

      fabLogger.info(`[LinkedIntel FAB] ===== SENDING ANALYSIS REQUEST =====`)
      fabLogger.info(`[LinkedIntel FAB] Page Type: ${pageData.type}`)
      fabLogger.info(`[LinkedIntel FAB] Message Type: ${analysisType}`)
      fabLogger.info(`[LinkedIntel FAB] URL: ${window.location.href}`)

      let response

      try {
        // Check extension context before making the call
        if (!this.isExtensionContextValid()) {
          throw new Error(
            'Extension context invalidated. Please reload the page and try again.'
          )
        }

        response = await chrome.runtime.sendMessage({
          type: analysisType,
          data: pageData.data,
        })
      } catch (contextError) {
        if (
          contextError.message.includes('Extension context invalidated') ||
          contextError.message.includes('context invalidated') ||
          contextError.message.includes('receiving end does not exist')
        ) {
          throw new Error(
            'Extension context invalidated. Please reload the page and try again.'
          )
        }
        throw contextError
      }

      if (response && !response.error) {
        fabLogger.debug('LinkedIntel FAB: Analysis completed successfully')

        // Stop progress simulation
        this.stopProgressSimulation()

        // Update insights panel with results
        window.linkedIntelInsightsPanel.updateContent(response)

        // Update usage status with new analyses count
        if (response.usageStatus) {
          this.updateUsageStatus(response.usageStatus)
        }
      } else {
        throw new Error(response?.error || 'Analysis failed')
      }
    } catch (error) {
      fabLogger.error('LinkedIntel FAB: Error during analysis:', error)

      // Stop progress simulation
      this.stopProgressSimulation()

      // Show error in insights panel if it exists
      if (window.linkedIntelInsightsPanel) {
        window.linkedIntelInsightsPanel.showError(error.message)
      }

      // Handle specific error cases
      if (error.message.includes('Extension context invalidated')) {
        this.showExtensionContextError()
      } else if (error.message.includes('No credits remaining')) {
        this.showErrorMessage(
          'No credits remaining. Daily credits reset every 24 hours.'
        )
      } else {
        this.showErrorMessage('Unable to complete analysis. Please try again.')
      }
    }
  }

  // Toggle insights panel (open/close)
  async toggleFloatingPanel() {
    // Check if LinkedIntelInsightsPanel class is available
    if (typeof LinkedIntelInsightsPanel === 'undefined') {
      fabLogger.error(
        'LinkedIntel FAB: LinkedIntelInsightsPanel class not found'
      )
      this.showErrorMessage(
        'Extension components not fully loaded. Please refresh the page.'
      )
      return
    }

    // Create insights panel if it doesn't exist
    if (!window.linkedIntelInsightsPanel) {
      try {
        window.linkedIntelInsightsPanel = new LinkedIntelInsightsPanel()
      } catch (error) {
        fabLogger.error(
          'LinkedIntel FAB: Error creating insights panel:',
          error
        )
        this.showErrorMessage(
          'Failed to create analysis panel. Please refresh the page.'
        )
        return
      }
    }

    // If panel is visible, just toggle it
    if (window.linkedIntelInsightsPanel.isVisible) {
      window.linkedIntelInsightsPanel.hide()
      return
    }

    // If panel is not visible, check analyses remaining before opening
    if (this.analysesRemaining <= 0) {
      // For unauthenticated users, open popup for sign-in
      if (!this.isAuthenticated) {
        fabLogger.info(
          'LinkedIntel FAB: Opening popup for sign-in (no analyses remaining)'
        )
        try {
          await chrome.runtime.sendMessage({
            type: 'OPEN_POPUP',
          })
        } catch (error) {
          fabLogger.error('LinkedIntel FAB: Error opening popup:', error)
          // Fallback to showing the message banner if popup fails
          this.showNoAnalysesMessage()
        }
      } else {
        // For authenticated users, just show the message
        this.showNoAnalysesMessage()
      }
      return
    }

    try {
      // Get current page data from LinkedInDetector with retry logic
      let pageData = window.linkedInDetector?.getCurrentPageData()

      // If data is not ready, wait and retry up to 3 times
      let retries = 0
      const maxRetries = 3
      const retryDelay = 1500 // 1.5 seconds

      while ((!pageData || !pageData.data) && retries < maxRetries) {
        fabLogger.debug(
          `LinkedIntel FAB: Page data not ready, retrying (${
            retries + 1
          }/${maxRetries})...`
        )
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        pageData = window.linkedInDetector?.getCurrentPageData()
        retries++
      }

      if (!pageData || !pageData.data) {
        fabLogger.warn('LinkedIntel FAB: No page data available after retries')
        this.showErrorMessage(
          'Unable to extract page data. Please refresh the page and try again.'
        )
        return
      }

      // Validate that page data URL matches current URL to prevent stale data issues
      const currentUrl = window.location.href
      const pageDataUrl = pageData.url || pageData.data?.url

      if (
        pageDataUrl &&
        !currentUrl.includes(pageDataUrl.split('?')[0].split('#')[0])
      ) {
        fabLogger.warn(
          '[LinkedIntel FAB] Stale page data detected in toggleFloatingPanel, forcing re-extraction'
        )
        // Force re-detection of current page
        if (window.linkedInDetector) {
          window.linkedInDetector.detectCurrentPage()
          // Wait a bit and retry
          await new Promise((resolve) => setTimeout(resolve, 1000))
          pageData = window.linkedInDetector?.getCurrentPageData()

          if (!pageData || !pageData.data) {
            this.showErrorMessage(
              'Page data not ready. Please try again in a moment.'
            )
            return
          }
        }
      }

      fabLogger.debug(
        `[LinkedIntel FAB] Analyzing ${pageData.type} page in toggleFloatingPanel`
      )
      fabLogger.debug(`[LinkedIntel FAB] Current URL: ${currentUrl}`)

      // Show insights panel with loading state
      window.linkedIntelInsightsPanel.show()
      window.linkedIntelInsightsPanel.pageType = pageData.type
      window.linkedIntelInsightsPanel.showLoading('Analyzing LinkedIn page...')

      // Start simulated progress tracking
      this.startProgressSimulation(pageData.type)

      // Re-extract profile data to get the latest company information
      // This ensures we don't use stale data from initial page load
      if (window.linkedInDetector && pageData.type === 'profile') {
        fabLogger.debug(
          '[LinkedIntel FAB] Re-extracting profile data for fresh company info'
        )
        const freshData = {
          url: window.location.href,
          type: 'profile',
          name: window.linkedInDetector.extractProfileName(),
          headline: window.linkedInDetector.extractProfileHeadline(),
          company: window.linkedInDetector.extractCurrentCompany(),
          location: window.linkedInDetector.extractLocation(),
          activity: window.linkedInDetector.extractRecentActivity(),
          executiveLevel: window.linkedInDetector.detectExecutiveLevel(),
          timestamp: Date.now(),
        }
        fabLogger.debug(
          '[LinkedIntel FAB] Fresh extraction - Company:',
          freshData.company
        )
        pageData.data = freshData
      }

      // Send analysis request to service worker with error handling
      const analysisType =
        pageData.type === 'profile' ? 'ANALYZE_PROFILE' : 'ANALYZE_COMPANY'

      fabLogger.info(`[LinkedIntel FAB] ===== SENDING ANALYSIS REQUEST =====`)
      fabLogger.info(`[LinkedIntel FAB] Page Type: ${pageData.type}`)
      fabLogger.info(`[LinkedIntel FAB] Message Type: ${analysisType}`)
      fabLogger.info(`[LinkedIntel FAB] URL: ${window.location.href}`)

      let response

      try {
        // Check extension context before making the call
        if (!this.isExtensionContextValid()) {
          throw new Error(
            'Extension context invalidated. Please reload the page and try again.'
          )
        }

        response = await chrome.runtime.sendMessage({
          type: analysisType,
          data: pageData.data,
        })
      } catch (contextError) {
        if (
          contextError.message.includes('Extension context invalidated') ||
          contextError.message.includes('context invalidated') ||
          contextError.message.includes('receiving end does not exist')
        ) {
          throw new Error(
            'Extension context invalidated. Please reload the page and try again.'
          )
        }
        throw contextError
      }

      if (response && !response.error) {
        fabLogger.debug('LinkedIntel FAB: Analysis completed successfully')

        // Stop progress simulation
        this.stopProgressSimulation()

        // Update insights panel with results
        window.linkedIntelInsightsPanel.updateContent(response)

        // Update usage status with new analyses count
        if (response.usageStatus) {
          this.updateUsageStatus(response.usageStatus)
        }
      } else {
        throw new Error(response?.error || 'Analysis failed')
      }
    } catch (error) {
      fabLogger.error('LinkedIntel FAB: Error during analysis:', error)

      // Stop progress simulation
      this.stopProgressSimulation()

      // Show error in insights panel if it exists
      if (window.linkedIntelInsightsPanel) {
        window.linkedIntelInsightsPanel.showError(error.message)
      }

      // Handle specific error cases
      if (error.message.includes('Extension context invalidated')) {
        this.showExtensionContextError()
      } else if (error.message.includes('No credits remaining')) {
        this.showErrorMessage(
          'No credits remaining. Daily credits reset every 24 hours.'
        )
      } else {
        this.showErrorMessage('Unable to complete analysis. Please try again.')
      }
    }
  }

  // Update usage status and badge appearance
  updateUsageStatus(usageStatus) {
    if (usageStatus) {
      const previousRemaining = this.analysesRemaining
      this.analysesRemaining = Math.max(0, usageStatus.analysesRemaining || 0)
      this.analysesUsed = usageStatus.analysesUsed || 0
      this.analysesLimit = usageStatus.analysesLimit || 3
      this.isAuthenticated = usageStatus.isAuthenticated || false
      this.planType = usageStatus.planType || 'anonymous'

      // Log counter changes for debugging
      if (previousRemaining !== this.analysesRemaining) {
        fabLogger.info(
          `[LinkedIntel FAB] 💰 Counter updated: ${previousRemaining} → ${this.analysesRemaining} (used: ${this.analysesUsed}/${this.analysesLimit})`
        )
      } else {
        fabLogger.info(
          `[LinkedIntel FAB] ✅ Counter unchanged: ${this.analysesRemaining} (used: ${this.analysesUsed}/${this.analysesLimit}) - likely a revisit`
        )
      }
    }

    if (this.usageBadge) {
      const countElement = this.usageBadge.querySelector(
        '.linkedintel-usage-count'
      )
      countElement.textContent = this.analysesRemaining

      // Update badge styling based on remaining analyses
      this.usageBadge.classList.remove('low-analyses', 'no-analyses')

      if (this.analysesRemaining === 0) {
        this.usageBadge.classList.add('no-analyses')
      } else if (this.analysesRemaining <= 1) {
        this.usageBadge.classList.add('low-analyses')
      }

      // Update tooltip text
      const tooltip = this.fabElement.querySelector('.linkedintel-fab-tooltip')
      if (tooltip) {
        const tooltipText = this.isAuthenticated
          ? `${this.analysesRemaining}/${this.analysesLimit} unique entities remaining`
          : `${this.analysesRemaining} free trials left`

        const revisitHint = this.isAuthenticated
          ? `<small style="color: #10b981; margin-top: 4px; display: block;">✓ Revisits are always FREE</small>`
          : ''

        const showUpgradeHint =
          !this.isAuthenticated && this.analysesRemaining <= 1

        tooltip.innerHTML = `
          <div class="linkedintel-tooltip-line">
            <svg class="linkedintel-tooltip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            <span>${tooltipText}</span>
          </div>
          ${revisitHint}
          ${
            showUpgradeHint
              ? `
          <div class="linkedintel-tooltip-line" style="color: #ffd43b; margin-top: 6px;">
            <svg class="linkedintel-tooltip-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <span>Sign in for 10 more trials</span>
          </div>
          `
              : ''
          }
        `
      }

      // Update ARIA label with context
      const statusText = this.isAuthenticated
        ? `${this.analysesRemaining} of ${this.analysesLimit} unique entities remaining this month. Revisits are free.`
        : `${this.analysesRemaining} of ${this.analysesLimit} free analyses remaining`

      this.usageBadge.setAttribute('aria-label', statusText)
    }

    fabLogger.debug(
      `LinkedIntel FAB: Usage updated - ${this.analysesRemaining} remaining (${this.planType})`
    )
  }

  // Refresh usage status from service worker
  async refreshUsageStatus() {
    try {
      if (!this.isExtensionContextValid()) {
        fabLogger.debug(
          'LinkedIntel FAB: Cannot refresh usage - extension context invalid'
        )
        return
      }

      const response = await chrome.runtime.sendMessage({
        type: 'GET_USAGE_STATUS',
      })
      if (response) {
        this.updateUsageStatus(response)
      }
    } catch (error) {
      if (
        error.message.includes('Extension context invalidated') ||
        error.message.includes('context invalidated') ||
        error.message.includes('receiving end does not exist')
      ) {
        fabLogger.debug(
          'LinkedIntel FAB: Cannot refresh usage - extension context lost'
        )
      } else {
        fabLogger.error('LinkedIntel FAB: Error refreshing usage:', error)
      }
    }
  }

  // Show no analyses remaining message
  showNoAnalysesMessage() {
    const message = document.createElement('div')
    message.className = 'linkedintel-no-analyses-message'

    const messageText = this.isAuthenticated
      ? `<span>Monthly limit reached (${this.analysesUsed}/${this.analysesLimit} unique entities)</span>
         <small>Revisits are free • Buy 200 credits for just $19!</small>`
      : `<span>All 3 free analyses used</span>
         <small>Sign in with Google to get 10 more — free forever!</small>`

    message.innerHTML = `
      <div class="linkedintel-message-content">
        ${messageText}
      </div>
    `

    // Add click handler for unauthenticated users to open popup
    if (!this.isAuthenticated) {
      message.style.cursor = 'pointer'
      message.addEventListener('click', async () => {
        fabLogger.info('LinkedIntel FAB: Opening popup for sign-in')
        try {
          // Send message to service worker to open popup
          await chrome.runtime.sendMessage({
            type: 'OPEN_POPUP',
          })
        } catch (error) {
          fabLogger.error('LinkedIntel FAB: Error opening popup:', error)
        }
      })
    }

    // Add message styles
    const style = document.createElement('style')
    style.textContent = `
      .linkedintel-no-analyses-message {
        position: fixed;
        bottom: 90px;
        right: 24px;
        background: rgba(255, 71, 87, 0.95);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 1000000;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        animation: slideInUp 0.3s ease, fadeOutUp 0.3s ease 2.7s;
        ${
          this.isAuthenticated
            ? 'pointer-events: none;'
            : 'pointer-events: auto;'
        }
        transition: transform 0.2s ease;
      }

      .linkedintel-no-analyses-message:hover {
        ${!this.isAuthenticated ? 'transform: translateY(-2px);' : ''}
      }

      .linkedintel-message-content small {
        display: block;
        opacity: 0.8;
        font-size: 12px;
        margin-top: 2px;
      }

      @keyframes slideInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes fadeOutUp {
        to {
          opacity: 0;
          transform: translateY(-10px);
        }
      }
    `

    document.head.appendChild(style)
    document.body.appendChild(message)

    setTimeout(() => {
      message.remove()
      style.remove()
    }, 3000)
  }

  // Show error message
  showErrorMessage(text) {
    const message = document.createElement('div')
    message.className = 'linkedintel-error-message'
    message.textContent = text

    // Add message styles
    const style = document.createElement('style')
    style.textContent = `
      .linkedintel-error-message {
        position: fixed;
        bottom: 90px;
        right: 24px;
        background: rgba(255, 107, 53, 0.95);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 1000000;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        animation: slideInUp 0.3s ease, fadeOutUp 0.3s ease 2.7s;
        pointer-events: none;
        max-width: 250px;
      }
    `

    document.head.appendChild(style)
    document.body.appendChild(message)

    setTimeout(() => {
      message.remove()
      style.remove()
    }, 3000)
  }

  // Animate FAB into view with shimmer effect
  animateIn() {
    if (!this.fabElement) return

    requestAnimationFrame(() => {
      this.fabElement.classList.add('visible')
      this.isVisible = true

      // Add shimmer effect on first appearance
      const button = this.fabElement.querySelector('.linkedintel-fab-button')
      if (button) {
        button.classList.add('shimmer')
        setTimeout(() => {
          button.classList.remove('shimmer')
        }, 2000)
      }
    })
  }

  // Animate FAB out of view
  animateOut() {
    if (!this.fabElement) return

    this.fabElement.classList.remove('visible')
    this.isVisible = false

    setTimeout(() => {
      this.remove()
    }, 300)
  }

  // Track FAB click analytics with GA4 (called when FAB is clicked, before analysis)
  trackFABClick() {
    // Check extension context before tracking
    if (!this.isExtensionContextValid()) {
      fabLogger.debug(
        'LinkedIntel FAB: Cannot track FAB click - extension context invalid'
      )
      return
    }

    chrome.runtime
      .sendMessage({
        type: 'TRACK_EVENT',
        data: {
          eventName: 'fab_clicked',
          eventParams: {
            page_type: window.linkedInDetector?.getCurrentPageData()?.type,
            analyses_remaining: this.analysesRemaining, // ✅ Current value, not decremented
            plan_type: this.planType,
            source: 'fab',
            timestamp: Date.now(),
          },
        },
      })
      .catch((error) => {
        if (
          error.message.includes('Extension context invalidated') ||
          error.message.includes('context invalidated') ||
          error.message.includes('receiving end does not exist')
        ) {
          fabLogger.debug(
            'LinkedIntel FAB: Cannot track FAB click - extension context lost'
          )
        } else {
          fabLogger.debug('LinkedIntel FAB: Analytics tracking failed:', error)
        }
      })
  }

  // Remove FAB from DOM
  remove() {
    if (this.fabElement) {
      this.fabElement.remove()
      this.fabElement = null
      this.usageBadge = null
      this.isVisible = false
    }

    const styles = document.getElementById('linkedintel-fab-styles')
    if (styles) {
      styles.remove()
    }

    // Remove message listener to prevent memory leaks
    if (this.handleUsageUpdate) {
      chrome.runtime.onMessage.removeListener(this.handleUsageUpdate)
      fabLogger.debug('[LinkedIntel FAB] Message listener removed')
    }

    fabLogger.debug('LinkedIntel FAB: Component removed')
  }

  // Check if FAB is visible
  isComponentVisible() {
    return this.isVisible && this.fabElement !== null
  }

  // Get current usage status
  getCurrentUsageStatus() {
    return {
      analysesRemaining: this.analysesRemaining,
      analysesUsed: this.analysesUsed,
      analysesLimit: this.analysesLimit,
      isAuthenticated: this.isAuthenticated,
      planType: this.planType,
    }
  }

  // Set usage status (for external updates)
  setUsageStatus(usageStatus) {
    this.updateUsageStatus(usageStatus)
  }

  // Show loading message
  showLoadingMessage(text) {
    this.hideLoadingMessage() // Remove any existing loading message

    this.loadingMessage = document.createElement('div')
    this.loadingMessage.className = 'linkedintel-loading-message'
    this.loadingMessage.innerHTML = `
      <div class="linkedintel-loading-spinner"></div>
      <span>${text}</span>
    `

    const style = document.createElement('style')
    style.id = 'linkedintel-loading-styles'
    style.textContent = `
      .linkedintel-loading-message {
        position: fixed;
        bottom: 90px;
        right: 24px;
        background: rgba(76, 110, 245, 0.95);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 1000000;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .linkedintel-loading-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `

    document.head.appendChild(style)
    document.body.appendChild(this.loadingMessage)
  }

  // Hide loading message
  hideLoadingMessage() {
    if (this.loadingMessage) {
      this.loadingMessage.remove()
      this.loadingMessage = null
    }

    const style = document.getElementById('linkedintel-loading-styles')
    if (style) {
      style.remove()
    }
  }

  // Start simulated progress tracking
  startProgressSimulation(pageType) {
    // Clear any existing simulation
    this.stopProgressSimulation()

    const progressSteps =
      pageType === 'company'
        ? [
            // Company analysis: 9 stages
            { id: 'stockData', delay: 2500 },
            { id: 'recentNews', delay: 3500 },
            { id: 'growthEvents', delay: 2500 },
            { id: 'companyChallenges', delay: 2800 },
            { id: 'techStack', delay: 3000 },
            { id: 'companyActivity', delay: 3500 },
            { id: 'priorityContacts', delay: 3000 },
            { id: 'fitScore', delay: 2500 },
            { id: 'recommendation', delay: 2000 },
          ]
        : [
            // Profile analysis: 2 person stages + 8 company stages = 10 total
            // Phase 1: Person analysis
            { id: 'personProfile', delay: 2800 },
            { id: 'personPainPoints', delay: 2800 },
            // Phase 2: Company analysis (for their company)
            { id: 'stockData', delay: 2200 },
            { id: 'recentNews', delay: 2500 },
            { id: 'growthEvents', delay: 2000 },
            { id: 'techStack', delay: 2500 },
            { id: 'companyActivity', delay: 2800 },
            { id: 'priorityContacts', delay: 2500 },
            { id: 'fitScore', delay: 2000 },
            { id: 'recommendation', delay: 1800 },
          ]

    let cumulativeDelay = 0
    this.progressTimeouts = []

    progressSteps.forEach((step, index) => {
      // Mark as loading
      const loadingTimeout = setTimeout(() => {
        if (
          window.linkedIntelInsightsPanel &&
          window.linkedIntelInsightsPanel.updateProgress
        ) {
          window.linkedIntelInsightsPanel.updateProgress(step.id, 'loading')
        }
      }, cumulativeDelay)

      this.progressTimeouts.push(loadingTimeout)

      // Mark as completed after delay
      cumulativeDelay += step.delay
      const completedTimeout = setTimeout(() => {
        if (
          window.linkedIntelInsightsPanel &&
          window.linkedIntelInsightsPanel.updateProgress
        ) {
          window.linkedIntelInsightsPanel.updateProgress(step.id, 'completed')
        }
      }, cumulativeDelay)

      this.progressTimeouts.push(completedTimeout)
    })
  }

  // Stop progress simulation
  stopProgressSimulation() {
    if (this.progressTimeouts) {
      this.progressTimeouts.forEach((timeout) => clearTimeout(timeout))
      this.progressTimeouts = []
    }
  }
}

// Export for use in other scripts
window.LinkedIntelFAB = LinkedIntelFAB

fabLogger.debug('LinkedIntel FAB Component: Module loaded')
