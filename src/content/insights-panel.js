// LinkedIntel Insights Panel - Modern, Beautiful Tabbed UI
// Displays ALL profile and company insights with vertical tab navigation

// Initialize logger using shared helper function
const panelLogger = window.createLogger('InsightsPanel')

class LinkedIntelInsightsPanel {
  constructor() {
    this.panel = null
    this.isVisible = false
    this.currentData = null
    this.pageType = null // 'profile' or 'company'
    this.activeTab = 'overview' // Current active tab

    // Enhanced loading experience
    this.loadingStartTime = null
    this.stepTimings = {}
    this.currentTipIndex = 0
    this.tipRotationInterval = null
    this.etaUpdateInterval = null

    // Initialize chat interface
    this.chatInterface = window.ChatInterface
      ? new window.ChatInterface(this)
      : null

    this.handleClose = this.handleClose.bind(this)
    this.handleEscapeKey = this.handleEscapeKey.bind(this)
    this.handleTabClick = this.handleTabClick.bind(this)
  }

  /**
   * Check if a company is public (has stock symbol)
   * @param {Object} company - Company data object
   * @returns {boolean} True if public company
   */
  isPublicCompany(company) {
    return !!(company?.stockInfo?.symbol && company?.stockInfo?.isPublic)
  }

  /**
   * Extract private company financials from stockInfo for Company Context display
   * @param {Object} stockInfo - Stock info object
   * @returns {Object} Private financials object
   */
  extractPrivateFinancials(stockInfo) {
    const financials = {
      totalFunding: null,
      latestValuation: null,
      revenueEstimate: null,
      fundingRounds: []
    }

    // Extract from dynamicFinancials array
    if (stockInfo.dynamicFinancials && Array.isArray(stockInfo.dynamicFinancials)) {
      stockInfo.dynamicFinancials.forEach(metric => {
        if (!metric || !metric.label || !metric.value) return

        const label = metric.label.toLowerCase()
        
        // Map dynamic financials to expected fields
        if (label.includes('total') && (label.includes('funding') || label.includes('raised'))) {
          financials.totalFunding = metric.value
        } else if (label.includes('valuation')) {
          financials.latestValuation = metric.value
        } else if (label.includes('revenue')) {
          financials.revenueEstimate = metric.value
        }
      })
    }

    // Also extract from direct properties as fallback
    if (!financials.totalFunding && stockInfo.totalFunding) {
      financials.totalFunding = stockInfo.totalFunding
    }
    if (!financials.latestValuation && stockInfo.latestValuation) {
      financials.latestValuation = stockInfo.latestValuation
    }

    // Extract funding rounds
    if (stockInfo.fundingRounds && Array.isArray(stockInfo.fundingRounds)) {
      financials.fundingRounds = stockInfo.fundingRounds
    } else if (stockInfo.financialSummary?.fundingRounds) {
      financials.fundingRounds = stockInfo.financialSummary.fundingRounds
    }

    panelLogger.debug('Extracted private financials for Company Context:', financials)
    
    return financials
  }

  /**
   * Check if a company is a subsidiary showing parent company data
   * @param {Object} company - Company data object
   * @returns {boolean} True if subsidiary
   */
  isSubsidiary(company) {
    return !!company?.stockInfo?.isSubsidiary
  }

  /**
   * Get parent company name if subsidiary
   * @param {Object} company - Company data object
   * @returns {string|null} Parent company name or null
   */
  getParentCompany(company) {
    return company?.stockInfo?.parentCompany || null
  }

  // Engaging tips to show while loading
  getLoadingTips() {
    return [
      {
        icon: '💡',
        title: 'Pro Tip',
        text: 'Use insights to personalize your outreach and increase response rates by 3x',
      },
      {
        icon: '🎯',
        title: 'Did You Know?',
        text: 'Decision makers are 67% more likely to respond to messages that reference recent company news',
      },
      {
        icon: '⚡',
        title: 'Quick Win',
        text: 'Mentioning specific tech stack tools shows you did your homework and builds credibility',
      },
      {
        icon: '🚀',
        title: 'Sales Insight',
        text: 'Companies with recent funding rounds are 2x more likely to purchase new solutions',
      },
      {
        icon: '💼',
        title: 'Best Practice',
        text: 'Lead with value, not features. Reference their pain points in your opening line',
      },
      {
        icon: '📊',
        title: 'Fun Fact',
        text: "We're analyzing data from multiple sources including LinkedIn, financial markets, and news",
      },
      {
        icon: '🔥',
        title: 'Power Move',
        text: 'Timing is everything. Reach out during hiring spikes when budgets are approved',
      },
      {
        icon: '🎓',
        title: 'Expert Tip',
        text: 'Personalized cold emails have 6x higher response rates than generic templates',
      },
      {
        icon: '💪',
        title: 'Success Strategy',
        text: 'Reference buying signals in your pitch to create urgency and relevance',
      },
      {
        icon: '🌟',
        title: 'Pro Insight',
        text: 'Companies mentioned in recent news are actively growing and more open to conversations',
      },
    ]
  }

  // Create and inject the panel
  create() {
    if (this.panel) {
      this.remove()
    }

    this.panel = document.createElement('div')
    this.panel.id = 'linkedintel-insights-panel'
    this.panel.className = 'linkedintel-insights-panel'
    this.panel.innerHTML = this.getInitialHTML()

    document.body.appendChild(this.panel)
    this.injectStyles()
    this.attachEventListeners()

    panelLogger.debug('[LinkedIntel] Insights panel created')
  }

  // Get initial HTML structure
  getInitialHTML() {
    return `
      <div class="linkedintel-panel-overlay"></div>
      <div class="linkedintel-panel-container">
        <div class="linkedintel-panel-header">
          <div class="linkedintel-header-content">
            <div class="linkedintel-logo">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
              </svg>
              <span>LinkedIntel</span>
            </div>
            <div id="linkedintel-company-status-badge" class="linkedintel-company-status-badge" style="display: none;"></div>
            <div class="linkedintel-header-actions">
              <div class="linkedintel-usage-counter" id="linkedintel-usage-counter">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 11l3 3L22 4"></path>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                <span class="linkedintel-usage-text">Loading...</span>
              </div>
              <button class="linkedintel-close-btn" aria-label="Close panel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="linkedintel-panel-main">
          <div class="linkedintel-panel-body">
            <div class="linkedintel-loading-state">
              <div class="linkedintel-spinner"></div>
              <p>Analyzing LinkedIn page...</p>
            </div>
          </div>
        </div>
      </div>
    `
  }

  // Inject styles
  injectStyles() {
    if (document.getElementById('linkedintel-insights-styles')) {
      return
    }

    const style = document.createElement('style')
    style.id = 'linkedintel-insights-styles'
    style.textContent = `
      /* Main Panel Container */
      .linkedintel-insights-panel {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 999998;
        pointer-events: none; /* Always none - clicks pass through to LinkedIn */
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }

      /* No pointer-events on parent even when visible - only the panel itself blocks clicks */
      .linkedintel-insights-panel.visible {
        pointer-events: none;
      }

      /* Overlay - fully transparent, no interaction blocking */
      .linkedintel-panel-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        z-index: 1;
      }

      .linkedintel-insights-panel.visible .linkedintel-panel-overlay {
        opacity: 1;
      }

      /* Panel Container */
      .linkedintel-panel-container {
        position: absolute;
        top: 0;
        right: 0;
        width: 700px;
        max-width: 95vw;
        height: 100%;
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        box-shadow: -8px 0 40px rgba(0, 0, 0, 0.15);
        transform: translateX(100%);
        transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 2;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        pointer-events: auto;
      }

      .linkedintel-insights-panel.visible .linkedintel-panel-container {
        transform: translateX(0);
      }

      /* Header */
      .linkedintel-panel-header {
        background: linear-gradient(135deg, #4c6ef5 0%, #667eea 100%);
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        flex-shrink: 0;
      }

      .linkedintel-header-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .linkedintel-logo {
        display: flex;
        align-items: center;
        gap: 10px;
        color: white;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: -0.5px;
      }

      .linkedintel-logo svg {
        width: 28px;
        height: 28px;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
      }

      .linkedintel-header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .linkedintel-company-status-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border: 1px solid rgba(255, 255, 255, 0.3);
        transition: all 0.2s ease;
        margin-left: auto;
        margin-right: auto;
      }

      .linkedintel-company-status-badge.public {
        background: rgba(16, 185, 129, 0.2);
        color: #fff;
      }

      .linkedintel-company-status-badge.private {
        background: rgba(59, 130, 246, 0.2);
        color: #fff;
      }

      .linkedintel-usage-counter {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        padding: 6px 12px;
        color: white;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s ease;
        cursor: default;
      }

      .linkedintel-usage-counter:hover {
        background: rgba(255, 255, 255, 0.25);
      }

      .linkedintel-usage-counter svg {
        width: 16px;
        height: 16px;
        opacity: 0.9;
      }

      .linkedintel-usage-text {
        white-space: nowrap;
      }

      .linkedintel-usage-counter.warning {
        background: rgba(255, 152, 0, 0.2);
        border-color: rgba(255, 152, 0, 0.3);
      }

      .linkedintel-usage-counter.danger {
        background: rgba(244, 67, 54, 0.2);
        border-color: rgba(244, 67, 54, 0.3);
        animation: pulse 2s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }

      .linkedintel-close-btn {
        background: rgba(255, 255, 255, 0.15);
        border: none;
        border-radius: 8px;
        padding: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .linkedintel-close-btn:hover {
        background: rgba(255, 255, 255, 0.25);
        transform: scale(1.05);
      }

      .linkedintel-close-btn svg {
        width: 20px;
        height: 20px;
      }

      /* Main Content Area with Tabs */
      .linkedintel-panel-main {
        flex: 1;
        display: flex;
        overflow: hidden;
      }

      /* Vertical Tab Navigation */
      .linkedintel-tabs-nav {
        width: 180px;
        background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
        border-right: 1px solid #dee2e6;
        padding: 16px 0;
        overflow-y: auto;
        flex-shrink: 0;
      }

      .linkedintel-tabs-nav::-webkit-scrollbar {
        width: 4px;
      }

      .linkedintel-tabs-nav::-webkit-scrollbar-track {
        background: transparent;
      }

      .linkedintel-tabs-nav::-webkit-scrollbar-thumb {
        background: rgba(76, 110, 245, 0.3);
        border-radius: 4px;
      }

      .linkedintel-tab-btn {
        width: 100%;
        background: transparent;
        border: none;
        padding: 12px 16px;
        text-align: left;
        cursor: pointer;
        transition: all 0.2s ease;
        color: #495057;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
        border-left: 3px solid transparent;
        position: relative;
      }

      .linkedintel-tab-btn:hover {
        background: rgba(76, 110, 245, 0.08);
        color: #4c6ef5;
      }

      .linkedintel-tab-btn.active {
        background: rgba(76, 110, 245, 0.12);
        color: #4c6ef5;
        border-left-color: #4c6ef5;
        font-weight: 700;
      }

      /* Section Header in Vertical Tabs (Profile View) */
      .linkedintel-tab-section-header {
        margin: 20px 0 12px 0;
        padding: 0 12px;
      }

      .linkedintel-section-divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, #dee2e6 20%, #dee2e6 80%, transparent);
        margin-bottom: 12px;
      }

      .linkedintel-section-label {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: linear-gradient(135deg, rgba(76, 110, 245, 0.08) 0%, rgba(102, 126, 234, 0.05) 100%);
        border-radius: 8px;
        border-left: 3px solid #4c6ef5;
        box-shadow: 0 2px 4px rgba(76, 110, 245, 0.1);
      }

      .linkedintel-section-label .linkedintel-section-icon {
        width: 16px;
        height: 16px;
        color: #4c6ef5;
        flex-shrink: 0;
      }

      .linkedintel-section-label span {
        font-size: 11px;
        font-weight: 700;
        color: #495057;
        text-transform: uppercase;
        letter-spacing: 0.8px;
      }

      .linkedintel-tab-icon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
      }

      .linkedintel-tab-badge {
        margin-left: auto;
        background: #4c6ef5;
        color: white;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 10px;
        min-width: 18px;
        text-align: center;
      }

      .linkedintel-tab-btn:not(.active) .linkedintel-tab-badge {
        background: #868e96;
      }

      /* Panel Body / Content Area */
      .linkedintel-panel-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background: #ffffff;
      }

      .linkedintel-panel-body::-webkit-scrollbar {
        width: 8px;
      }

      .linkedintel-panel-body::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.05);
      }

      .linkedintel-panel-body::-webkit-scrollbar-thumb {
        background: rgba(76, 110, 245, 0.3);
        border-radius: 4px;
      }

      .linkedintel-panel-body::-webkit-scrollbar-thumb:hover {
        background: rgba(76, 110, 245, 0.5);
      }

      /* Tab Content */
      .linkedintel-tab-content {
        display: none;
        animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .linkedintel-tab-content.active {
        display: block;
      }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(15px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Loading State */
      .linkedintel-loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
      }

      .linkedintel-spinner {
        width: 48px;
        height: 48px;
        border: 4px solid rgba(76, 110, 245, 0.1);
        border-top: 4px solid #4c6ef5;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 20px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Stunning Loader Styles */
      .linkedintel-loading-logo {
        margin-bottom: 20px;
        animation: pulse-glow 2s ease-in-out infinite;
      }
      
      .linkedintel-loading-icon {
        width: 64px;
        height: 64px;
        color: #4c6ef5;
        filter: drop-shadow(0 4px 12px rgba(76, 110, 245, 0.3));
      }
      
      @keyframes pulse-glow {
        0%, 100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.05);
          opacity: 0.9;
        }
      }
      
      .linkedintel-loading-title {
        font-size: 22px;
        font-weight: 700;
        color: #212529;
        margin: 0 0 8px 0;
        text-align: center;
      }
      
      .linkedintel-loading-subtitle {
        font-size: 14px;
        color: #868e96;
        margin: 0 0 32px 0;
        text-align: center;
      }
      
      /* Horizontal Progress Bar */
      .linkedintel-progress-wrapper {
        width: 100%;
        max-width: 500px;
        margin: 0 auto 24px;
      }
      
      .linkedintel-progress-bar {
        position: relative;
        width: 100%;
        height: 12px;
        background: linear-gradient(90deg, #e9ecef 0%, #dee2e6 100%);
        border-radius: 20px;
        overflow: hidden;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06);
        margin-bottom: 12px;
      }
      
      .linkedintel-progress-fill {
        position: relative;
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #4c6ef5 0%, #667eea 50%, #4c6ef5 100%);
        background-size: 200% 100%;
        border-radius: 20px;
        transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        animation: shimmer 2s linear infinite;
        box-shadow: 0 0 20px rgba(76, 110, 245, 0.4);
      }
      
      @keyframes shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
      
      .linkedintel-progress-shimmer {
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0.4),
          transparent
        );
        animation: shimmer-wave 1.5s infinite;
      }
      
      @keyframes shimmer-wave {
        0% {
          left: -100%;
        }
        100% {
          left: 200%;
        }
      }
      
      .linkedintel-progress-percentage {
        text-align: center;
        font-size: 24px;
        font-weight: 700;
        background: linear-gradient(135deg, #4c6ef5 0%, #667eea 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      
      /* Current Step Indicator */
      .linkedintel-current-step {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 16px 24px;
        background: linear-gradient(135deg, rgba(76, 110, 245, 0.1) 0%, rgba(102, 126, 234, 0.05) 100%);
        border-radius: 12px;
        border: 1px solid rgba(76, 110, 245, 0.2);
        margin-bottom: 24px;
      }
      
      .linkedintel-step-icon {
        position: relative;
        font-size: 24px;
        animation: bounce 1s ease-in-out infinite;
      }
      
      .linkedintel-step-pulse {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: rgba(76, 110, 245, 0.3);
        transform: translate(-50%, -50%);
        animation: pulse-ring 1.5s ease-out infinite;
      }
      
      @keyframes pulse-ring {
        0% {
          transform: translate(-50%, -50%) scale(0.8);
          opacity: 1;
        }
        100% {
          transform: translate(-50%, -50%) scale(2);
          opacity: 0;
        }
      }
      
      @keyframes bounce {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-4px);
        }
      }
      
      .linkedintel-step-label {
        font-size: 14px;
        font-weight: 600;
        color: #4c6ef5;
      }
      
      /* Steps Grid */
      /* ETA Display */
      .linkedintel-eta-container {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 20px;
        margin-bottom: 20px;
        background: linear-gradient(135deg, rgba(76, 110, 245, 0.08) 0%, rgba(102, 126, 234, 0.04) 100%);
        border-radius: 10px;
        border: 1px solid rgba(76, 110, 245, 0.15);
      }
      
      .linkedintel-eta-icon {
        width: 18px;
        height: 18px;
        color: #4c6ef5;
        animation: tick 1s ease-in-out infinite;
      }
      
      @keyframes tick {
        0%, 100% { transform: rotate(0deg); }
        50% { transform: rotate(5deg); }
      }
      
      .linkedintel-eta-text {
        font-size: 14px;
        color: #495057;
        font-weight: 500;
      }
      
      .linkedintel-eta-text strong {
        color: #4c6ef5;
        font-weight: 700;
      }
      
      .linkedintel-steps-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
        max-width: 650px;
        margin: 0 auto 20px;
      }
      
      /* Adjust for many steps (profile view with 10 stages) */
      @media (min-width: 768px) {
        .linkedintel-steps-grid {
          grid-template-columns: repeat(4, 1fr);
        }
      }
      
      @media (max-width: 767px) {
        .linkedintel-steps-grid {
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
      }
      
      @media (max-width: 500px) {
        .linkedintel-steps-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
      }
      
      /* Loading Tips Carousel */
      .linkedintel-tips-container {
        margin-top: 32px;
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
      }
      
      .linkedintel-tip-card {
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border: 2px solid #e9ecef;
        border-radius: 12px;
        padding: 20px 24px;
        display: flex;
        align-items: flex-start;
        gap: 16px;
        min-height: 100px;
        transition: opacity 0.3s ease, transform 0.3s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      }
      
      .linkedintel-tip-icon {
        font-size: 32px;
        flex-shrink: 0;
        animation: float 3s ease-in-out infinite;
      }
      
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-5px); }
      }
      
      .linkedintel-tip-content {
        flex: 1;
        text-align: left;
      }
      
      .linkedintel-tip-title {
        font-size: 14px;
        font-weight: 700;
        color: #4c6ef5;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .linkedintel-tip-text {
        font-size: 14px;
        color: #495057;
        line-height: 1.6;
      }
      
      .linkedintel-tip-dots {
        display: flex;
        justify-content: center;
        gap: 6px;
        margin-top: 16px;
      }
      
      .linkedintel-tip-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #dee2e6;
        transition: all 0.3s ease;
        cursor: pointer;
      }
      
      .linkedintel-tip-dot.active {
        background: #4c6ef5;
        width: 20px;
        border-radius: 3px;
      }
      
      .linkedintel-step-card {
        position: relative;
        background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
        border: 2px solid #e9ecef;
        border-radius: 12px;
        padding: 14px 10px;
        text-align: center;
        transition: all 0.3s ease;
        opacity: 0.6;
        min-height: 110px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }
      
      .linkedintel-step-card.active {
        opacity: 1;
        border-color: #4c6ef5;
        background: linear-gradient(135deg, rgba(76, 110, 245, 0.08) 0%, rgba(102, 126, 234, 0.04) 100%);
        transform: scale(1.05);
        box-shadow: 0 4px 16px rgba(76, 110, 245, 0.25), 0 2px 4px rgba(0, 0, 0, 0.05);
      }
      
      .linkedintel-step-card.completed {
        opacity: 1;
        border-color: #20c997;
        background: linear-gradient(135deg, rgba(32, 201, 151, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%);
        box-shadow: 0 2px 8px rgba(32, 201, 151, 0.15), 0 1px 2px rgba(0, 0, 0, 0.05);
      }
      
      .linkedintel-step-card.error {
        opacity: 1;
        border-color: #fa5252;
        background: linear-gradient(135deg, rgba(250, 82, 82, 0.08) 0%, rgba(239, 68, 68, 0.04) 100%);
        box-shadow: 0 2px 8px rgba(250, 82, 82, 0.15), 0 1px 2px rgba(0, 0, 0, 0.05);
      }
      
      .linkedintel-step-indicator {
        position: relative;
        width: 28px;
        height: 28px;
        margin: 0 auto 6px;
        border-radius: 50%;
        background: #e9ecef;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      
      .linkedintel-step-card.active .linkedintel-step-indicator {
        background: linear-gradient(135deg, #4c6ef5 0%, #667eea 100%);
        animation: pulse-indicator 1.5s ease-in-out infinite;
      }
      
      .linkedintel-step-card.completed .linkedintel-step-indicator {
        background: linear-gradient(135deg, #20c997 0%, #10b981 100%);
      }
      
      .linkedintel-step-card.error .linkedintel-step-indicator {
        background: linear-gradient(135deg, #fa5252 0%, #ef4444 100%);
      }
      
      @keyframes pulse-indicator {
        0%, 100% {
          transform: scale(1);
          box-shadow: 0 0 0 0 rgba(76, 110, 245, 0.7);
        }
        50% {
          transform: scale(1.05);
          box-shadow: 0 0 0 8px rgba(76, 110, 245, 0);
        }
      }
      
      .linkedintel-step-number {
        font-size: 12px;
        font-weight: 700;
        color: #868e96;
      }
      
      .linkedintel-step-card.active .linkedintel-step-number,
      .linkedintel-step-card.completed .linkedintel-step-number,
      .linkedintel-step-card.error .linkedintel-step-number {
        color: white;
      }
      
      .linkedintel-step-checkmark {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 16px;
        color: white;
        opacity: 0;
      }
      
      .linkedintel-step-card.completed .linkedintel-step-checkmark {
        opacity: 1;
        animation: checkmark-pop 0.3s ease-out;
      }
      
      .linkedintel-step-card.completed .linkedintel-step-number {
        opacity: 0;
      }
      
      @keyframes checkmark-pop {
        0% {
          transform: translate(-50%, -50%) scale(0);
        }
        50% {
          transform: translate(-50%, -50%) scale(1.2);
        }
        100% {
          transform: translate(-50%, -50%) scale(1);
        }
      }
      
      .linkedintel-step-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }
      
      .linkedintel-step-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      
      .linkedintel-step-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }
      
      .linkedintel-step-emoji {
        font-size: 20px;
        line-height: 1;
        filter: grayscale(0.5);
        transition: filter 0.3s ease;
      }
      
      .linkedintel-step-card.active .linkedintel-step-emoji,
      .linkedintel-step-card.completed .linkedintel-step-emoji {
        filter: grayscale(0);
      }
      
      .linkedintel-step-name {
        font-size: 11px;
        font-weight: 700;
        color: #495057;
        line-height: 1.3;
        word-break: break-word;
      }
      
      .linkedintel-step-card.active .linkedintel-step-name {
        color: #4c6ef5;
      }
      
      .linkedintel-step-card.completed .linkedintel-step-name {
        color: #20c997;
      }
      
      .linkedintel-step-description {
        font-size: 9px;
        font-weight: 400;
        color: #6c757d;
        line-height: 1.3;
        margin-top: 2px;
        opacity: 0.8;
      }
      
      .linkedintel-step-card.active .linkedintel-step-description {
        opacity: 1;
        color: #495057;
      }
      
      .linkedintel-step-category-indicator {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        opacity: 0.4;
        transition: opacity 0.3s ease;
      }
      
      .linkedintel-step-card.active .linkedintel-step-category-indicator,
      .linkedintel-step-card.completed .linkedintel-step-category-indicator {
        opacity: 1;
      }

      /* Content Sections */
      .linkedintel-section {
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        border: 1px solid #e9ecef;
        animation: sectionFadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        opacity: 0;
        transform: translateY(10px);
      }

      @keyframes sectionFadeIn {
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Staggered animation delays for sections */
      .linkedintel-section:nth-child(1) { animation-delay: 0.05s; }
      .linkedintel-section:nth-child(2) { animation-delay: 0.1s; }
      .linkedintel-section:nth-child(3) { animation-delay: 0.15s; }
      .linkedintel-section:nth-child(4) { animation-delay: 0.2s; }
      .linkedintel-section:nth-child(5) { animation-delay: 0.25s; }
      .linkedintel-section:nth-child(6) { animation-delay: 0.3s; }

      .linkedintel-section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        padding-bottom: 10px;
        border-bottom: 2px solid #f1f3f5;
      }

      .linkedintel-section-icon {
        width: 20px;
        height: 20px;
        color: #4c6ef5;
        flex-shrink: 0;
      }

      .linkedintel-section-title {
        font-size: 15px;
        font-weight: 700;
        color: #212529;
        margin: 0;
      }

      /* Hero Cards */
      .linkedintel-hero-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 20px;
        box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
      }

      .linkedintel-hero-card.company {
        background: linear-gradient(135deg, #4c6ef5 0%, #667eea 100%);
      }

      .linkedintel-hero-name {
        font-size: 28px;
        font-weight: 800;
        margin: 0 0 8px 0;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
        line-height: 1.2;
      }

      .linkedintel-hero-subtitle {
        font-size: 16px;
        font-weight: 500;
        opacity: 0.95;
        margin: 0 0 4px 0;
        line-height: 1.4;
      }

      .linkedintel-hero-meta {
        font-size: 14px;
        opacity: 0.9;
        margin: 0;
      }

      .linkedintel-hero-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
      }

      .linkedintel-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        border: 1px solid rgba(255, 255, 255, 0.3);
      }

      .linkedintel-hero-stats {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-top: 16px;
      }

      .linkedintel-stat-box {
        background: rgba(255, 255, 255, 0.25);
        backdrop-filter: blur(10px);
        padding: 12px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.3);
      }

      .linkedintel-stat-label {
        font-size: 11px;
        opacity: 1;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 4px 0;
        font-weight: 700;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
      }

      .linkedintel-stat-value {
        font-size: 18px;
        font-weight: 800;
        margin: 0;
        line-height: 1.2;
      }

      /* Metric Grid - 2 Column Layout */
      .linkedintel-metric-grid-2col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .linkedintel-metric-item {
        background: #f8f9fa;
        padding: 14px;
        border-radius: 10px;
        border: 1px solid #e9ecef;
      }

      .linkedintel-metric-label {
        font-size: 11px;
        color: #6c757d;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
      }

      .linkedintel-metric-value {
        font-size: 15px;
        color: #212529;
        font-weight: 700;
        line-height: 1.4;
      }

      /* Deal Confidence Banner (Premium) */
      .linkedintel-deal-banner {
        background: linear-gradient(135deg, #20c997 0%, #0ca678 100%);
        color: white;
        border-radius: 16px;
        padding: 20px 24px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 20px;
        box-shadow: 0 8px 24px rgba(32, 201, 151, 0.4);
        border: 2px solid rgba(255, 255, 255, 0.2);
      }

      .linkedintel-deal-verdict {
        width: 80px;
        height: 80px;
        background: rgba(255, 255, 255, 0.25);
        backdrop-filter: blur(10px);
        border: 3px solid rgba(255, 255, 255, 0.6);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 42px;
        font-weight: 800;
        flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .linkedintel-deal-content {
        flex: 1;
      }

      .linkedintel-deal-label {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        font-weight: 800;
        opacity: 0.95;
        margin: 0 0 8px 0;
      }

      .linkedintel-deal-explanation {
        font-size: 15px;
        line-height: 1.6;
        opacity: 0.95;
        margin: 0;
        font-weight: 500;
      }

      /* Lists */
      .linkedintel-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .linkedintel-list-item {
        background: white;
        padding: 16px;
        border-radius: 10px;
        border: 1px solid #e9ecef;
        transition: all 0.2s ease;
        color: #212529 !important;
      }
      
      .linkedintel-list-item * {
        color: inherit !important;
      }

      .linkedintel-list-item:hover {
        border-color: #4c6ef5;
        box-shadow: 0 4px 12px rgba(76, 110, 245, 0.1);
        transform: translateX(2px);
      }

      .linkedintel-list-item.clickable {
        cursor: pointer;
      }

      .linkedintel-list-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 8px;
        gap: 12px;
      }

      .linkedintel-list-title {
        font-size: 14px;
        font-weight: 700;
        color: #212529;
        margin: 0;
        line-height: 1.3;
        flex: 1;
      }

      .linkedintel-list-text {
        font-size: 14px;
        color: #212529 !important;
        line-height: 1.6;
        margin: 0;
        font-weight: 400;
      }
      
      .linkedintel-list-text strong {
        color: #1a1a1a !important;
        font-weight: 600;
      }

      .linkedintel-list-meta {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 12px;
        color: #868e96;
        margin-top: 8px;
      }

      /* Tags / Pills */
      .linkedintel-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .linkedintel-tag {
        background: linear-gradient(135deg, #f1f3f5 0%, #e9ecef 100%);
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        color: #495057;
        border: 1px solid #dee2e6;
        transition: all 0.2s ease;
      }

      .linkedintel-tag:hover {
        border-color: #4c6ef5;
        color: #4c6ef5;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(76, 110, 245, 0.15);
      }

      /* Sentiment Badges */
      .linkedintel-sentiment {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        flex-shrink: 0;
      }

      .linkedintel-sentiment.positive {
        background: #d3f9d8;
        color: #2b8a3e;
      }

      .linkedintel-sentiment.negative {
        background: #ffe3e3;
        color: #c92a2a;
      }

      .linkedintel-sentiment.neutral {
        background: #e7f5ff;
        color: #1971c2;
      }

      .linkedintel-sentiment.hot {
        background: #ffe3e3;
        color: #fa5252;
      }

      .linkedintel-sentiment.warm {
        background: #fff3bf;
        color: #fab005;
      }

      .linkedintel-sentiment.cold {
        background: #d0ebff;
        color: #339af0;
      }

      /* Tech Stack Cards - Enhanced Hover Effects */
      .linkedintel-tech-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 12px;
        margin-top: 12px;
      }

      .linkedintel-tech-card {
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border: 2px solid #e9ecef;
        border-radius: 10px;
        padding: 12px;
        text-align: center;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
      }

      .linkedintel-tech-card:hover {
        transform: translateY(-3px) scale(1.02);
        box-shadow: 0 6px 20px rgba(76, 110, 245, 0.15);
        border-color: #4c6ef5;
      }

      .linkedintel-tech-card.hot {
        border-color: #fa5252;
        background: linear-gradient(135deg, #fff5f5 0%, #ffe3e3 100%);
      }

      .linkedintel-tech-card.hot:hover {
        border-color: #ff6b6b;
        box-shadow: 0 6px 20px rgba(250, 82, 82, 0.25);
      }

      .linkedintel-tech-card.warm {
        border-color: #fab005;
        background: linear-gradient(135deg, #fffbeb 0%, #fff3bf 100%);
      }

      .linkedintel-tech-card.warm:hover {
        border-color: #fcc419;
        box-shadow: 0 6px 20px rgba(250, 176, 5, 0.25);
      }

      .linkedintel-tech-name {
        font-size: 13px;
        font-weight: 600;
        color: #212529;
        margin-bottom: 6px;
      }

      .linkedintel-tech-metadata {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: 8px;
      }

      .linkedintel-tech-badge {
        font-size: 10px;
        padding: 3px 6px;
        border-radius: 4px;
        font-weight: 600;
      }

      .linkedintel-tech-badge.hiring {
        background: rgba(250, 82, 82, 0.15);
        color: #fa5252;
      }

      .linkedintel-tech-badge.recency {
        background: rgba(76, 110, 245, 0.1);
        color: #4c6ef5;
      }

      /* Flash Cards System - Quick Scannable Intelligence */
      .linkedintel-flash-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        margin-bottom: 20px;
      }
      
      .linkedintel-flash-card {
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border: 2px solid #e9ecef;
        border-radius: 12px;
        padding: 16px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        position: relative;
        overflow: hidden;
      }
      
      .linkedintel-flash-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        border-color: #4c6ef5;
      }
      
      .linkedintel-flash-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        background: linear-gradient(180deg, #4c6ef5 0%, #667eea 100%);
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .linkedintel-flash-card:hover::before {
        opacity: 1;
      }
      
      .linkedintel-flash-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      
      .linkedintel-flash-card-icon {
        font-size: 24px;
        line-height: 1;
      }
      
      .linkedintel-flash-card-badge {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 4px 8px;
        border-radius: 6px;
        background: #f1f3f5;
        color: #495057;
      }
      
      .linkedintel-flash-card-badge.high {
        background: #ffe3e3;
        color: #fa5252;
      }
      
      .linkedintel-flash-card-badge.medium {
        background: #fff3bf;
        color: #fab005;
      }
      
      .linkedintel-flash-card-badge.low {
        background: #d0ebff;
        color: #339af0;
      }
      
      .linkedintel-flash-card-title {
        font-size: 13px;
        font-weight: 700;
        color: #212529;
        margin: 0 0 8px 0;
        line-height: 1.3;
      }
      
      .linkedintel-flash-card-value {
        font-size: 28px;
        font-weight: 800;
        color: #4c6ef5;
        margin: 0 0 4px 0;
        line-height: 1;
      }
      
      .linkedintel-flash-card-value.positive {
        color: #20c997;
      }
      
      .linkedintel-flash-card-value.negative {
        color: #fa5252;
      }
      
      .linkedintel-flash-card-label {
        font-size: 11px;
        color: #868e96;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
        margin: 0 0 2px 0;
      }
      
      .linkedintel-flash-card-text {
        font-size: 13px;
        color: #495057;
        line-height: 1.5;
        margin: 0;
      }
      
      .linkedintel-flash-card-footer {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #e9ecef;
        font-size: 11px;
        color: #868e96;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .linkedintel-flash-card-action {
        margin-top: 12px;
        padding: 8px 12px;
        background: rgba(76, 110, 245, 0.08);
        border-radius: 8px;
        font-size: 12px;
        color: #4c6ef5;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      /* Insight Cards - Larger featured cards */
      .linkedintel-insight-card {
        background: linear-gradient(135deg, #667eea15 0%, #764ba225 100%);
        border: 2px solid #667eea40;
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 16px;
      }
      
      .linkedintel-insight-card-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      
      .linkedintel-insight-icon {
        font-size: 32px;
        line-height: 1;
      }
      
      .linkedintel-insight-title {
        font-size: 16px;
        font-weight: 700;
        color: #4c6ef5;
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .linkedintel-insight-content {
        font-size: 14px;
        color: #212529;
        line-height: 1.6;
        margin: 0;
      }
      
      /* Stat Grid - For quick metrics */
      .linkedintel-stat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
      }
      
      .linkedintel-stat-card {
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border: 2px solid #e9ecef;
        border-radius: 12px;
        padding: 20px 16px;
        text-align: center;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
      }
      
      .linkedintel-stat-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      .linkedintel-stat-card:hover {
        border-color: #667eea;
        transform: translateY(-3px);
        box-shadow: 0 8px 20px rgba(102, 126, 234, 0.2);
      }
      
      .linkedintel-stat-card:hover::before {
        opacity: 1;
      }
      
      .linkedintel-stat-card-value {
        font-size: 32px;
        font-weight: 800;
        color: #212529;
        margin: 0 0 8px 0;
        line-height: 1;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      
      .linkedintel-stat-card-label {
        font-size: 12px;
        color: #495057;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        font-weight: 700;
        margin: 0;
      }

      /* Contact Cards */
      .linkedintel-contact-card {
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border: 2px solid #e9ecef;
        border-radius: 12px;
        padding: 16px;
        transition: all 0.2s ease;
      }

      .linkedintel-contact-card:hover {
        border-color: #4c6ef5;
        box-shadow: 0 6px 16px rgba(76, 110, 245, 0.12);
        transform: translateY(-2px);
      }

      .linkedintel-contact-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 12px;
        gap: 12px;
      }

      .linkedintel-contact-name {
        font-size: 16px;
        font-weight: 700;
        color: #212529;
        margin: 0 0 4px 0;
        line-height: 1.2;
      }

      .linkedintel-contact-title {
        font-size: 13px;
        color: #495057;
        margin: 0;
        line-height: 1.3;
      }

      .linkedintel-contact-meta {
        font-size: 12px;
        color: #868e96;
        margin: 10px 0;
        line-height: 1.4;
      }

      .linkedintel-contact-action {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #4c6ef5 0%, #667eea 100%);
        color: white;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        text-decoration: none;
        margin-top: 10px;
        transition: all 0.2s ease;
        border: none;
        cursor: pointer;
      }

      .linkedintel-contact-action:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(76, 110, 245, 0.3);
      }

      /* Info Box */
      .linkedintel-info-box {
        background: linear-gradient(135deg, #e7f5ff 0%, #d0ebff 100%);
        border-left: 4px solid #4c6ef5;
        border-radius: 8px;
        padding: 16px;
        margin: 12px 0;
        color: #212529;
      }
      
      .linkedintel-info-box * {
        color: inherit;
      }

      .linkedintel-info-box.success {
        background: linear-gradient(135deg, #d3f9d8 0%, #b2f2bb 100%);
        border-left-color: #20c997;
      }

      .linkedintel-info-box.warning {
        background: linear-gradient(135deg, #fff3bf 0%, #ffec99 100%);
        border-left-color: #fab005;
      }

      .linkedintel-info-box.danger {
        background: linear-gradient(135deg, #ffe3e3 0%, #ffc9c9 100%);
        border-left-color: #fa5252;
      }

      .linkedintel-info-title {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 6px 0;
        color: #212529;
      }

      .linkedintel-info-text {
        font-size: 13px;
        line-height: 1.5;
        margin: 0;
        color: #212529 !important;
        font-weight: 400;
      }
      
      .linkedintel-info-text strong {
        color: #1a1a1a !important;
        font-weight: 600;
      }

      /* Empty State */
      .linkedintel-empty-state {
        text-align: center;
        padding: 40px 20px;
        color: #868e96;
      }

      .linkedintel-empty-icon {
        width: 48px;
        height: 48px;
        margin: 0 auto 12px;
        opacity: 0.5;
      }

      .linkedintel-empty-text {
        font-size: 14px;
        margin: 0;
      }

      /* Error State */
      .linkedintel-error-state {
        text-align: center;
        padding: 40px 20px;
      }

      .linkedintel-error-icon {
        width: 64px;
        height: 64px;
        color: #fa5252;
        margin: 0 auto 16px;
      }

      .linkedintel-error-message {
        font-size: 16px;
        color: #495057;
        margin: 0;
      }

      /* Upgrade/Sign-in State */
      .linkedintel-upgrade-state {
        text-align: center;
        padding: 40px 20px;
        max-width: 500px;
        margin: 0 auto;
      }

      .linkedintel-upgrade-icon {
        font-size: 64px;
        margin-bottom: 16px;
        animation: bounce 2s ease-in-out infinite;
      }

      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }

      .linkedintel-upgrade-title {
        font-size: 24px;
        font-weight: 700;
        color: #212529;
        margin: 0 0 12px 0;
      }

      .linkedintel-upgrade-message {
        font-size: 16px;
        color: #495057;
        margin: 0 0 32px 0;
        line-height: 1.5;
      }

      .linkedintel-upgrade-comparison {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 32px;
      }

      .linkedintel-plan-card {
        background: white;
        border: 2px solid #e9ecef;
        border-radius: 12px;
        padding: 20px;
        text-align: left;
        transition: all 0.2s ease;
      }

      .linkedintel-plan-card.pro {
        border-color: #4c6ef5;
        box-shadow: 0 4px 12px rgba(76, 110, 245, 0.15);
      }

      .linkedintel-plan-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .linkedintel-plan-name {
        font-size: 18px;
        font-weight: 700;
        color: #212529;
      }

      .linkedintel-plan-badge {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        padding: 4px 8px;
        border-radius: 4px;
        background: #e9ecef;
        color: #495057;
      }

      .linkedintel-plan-badge.popular {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .linkedintel-plan-price {
        font-size: 28px;
        font-weight: 700;
        color: #212529;
        margin-bottom: 16px;
      }

      .linkedintel-plan-feature {
        font-size: 14px;
        color: #495057;
        margin-bottom: 8px;
      }

      .linkedintel-benefit-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-bottom: 32px;
        text-align: left;
      }

      .linkedintel-benefit {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .linkedintel-benefit svg {
        width: 24px;
        height: 24px;
        color: #51cf66;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .linkedintel-benefit span {
        font-size: 15px;
        color: #495057;
        line-height: 1.5;
      }

      .linkedintel-upgrade-btn,
      .linkedintel-google-signin-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 14px 24px;
        border: none;
        border-radius: 10px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .linkedintel-upgrade-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      .linkedintel-upgrade-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
      }

      .linkedintel-upgrade-btn svg {
        width: 20px;
        height: 20px;
      }

      .linkedintel-google-signin-btn {
        background: white;
        color: #212529;
        border: 2px solid #e9ecef;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .linkedintel-google-signin-btn:hover {
        border-color: #4285F4;
        box-shadow: 0 4px 12px rgba(66, 133, 244, 0.2);
        transform: translateY(-2px);
      }

      .linkedintel-google-signin-btn svg {
        width: 20px;
        height: 20px;
      }

      .linkedintel-upgrade-note {
        font-size: 13px;
        color: #868e96;
        margin: 16px 0 0 0;
        font-style: italic;
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .linkedintel-panel-container {
          width: 100%;
          max-width: 100vw;
        }

        .linkedintel-tabs-nav {
          width: 140px;
        }

        .linkedintel-tab-btn {
          font-size: 12px;
          padding: 10px 12px;
        }

        .linkedintel-panel-body {
          padding: 16px;
        }

        .linkedintel-hero-name {
          font-size: 22px;
        }

        .linkedintel-fit-score-circle {
          width: 60px;
          height: 60px;
          font-size: 24px;
        }
      }

      /* Copy Button Styles */
      .linkedintel-copy-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: linear-gradient(135deg, #4c6ef5 0%, #667eea 100%);
        color: white;
        border: none;
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-top: 8px;
      }

      .linkedintel-copy-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(76, 110, 245, 0.3);
        background: linear-gradient(135deg, #5c7cfa 0%, #748ffc 100%);
      }

      .linkedintel-copy-btn:active {
        transform: translateY(0);
      }

      .linkedintel-copy-btn.copied {
        background: linear-gradient(135deg, #20c997 0%, #0ca678 100%);
      }

      .linkedintel-copy-btn svg {
        width: 14px;
        height: 14px;
      }

      .linkedintel-copy-icon-wrapper {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      /* Inline copy button for small spaces */
      .linkedintel-copy-btn-small {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(76, 110, 245, 0.1);
        color: #4c6ef5;
        border: 1px solid rgba(76, 110, 245, 0.2);
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-left: 8px;
      }

      .linkedintel-copy-btn-small:hover {
        background: rgba(76, 110, 245, 0.15);
        border-color: rgba(76, 110, 245, 0.3);
      }

      .linkedintel-copy-btn-small.copied {
        background: rgba(32, 201, 151, 0.1);
        color: #20c997;
        border-color: rgba(32, 201, 151, 0.2);
      }

      /* Company Description List */
      .linkedintel-description-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .linkedintel-description-list li {
        padding: 12px 0 12px 24px;
        position: relative;
        line-height: 1.6;
        color: #2d3748;
        font-size: 14px;
      }

      .linkedintel-description-list li::before {
        content: "▸";
        position: absolute;
        left: 0;
        color: #4c6ef5;
        font-weight: bold;
        font-size: 18px;
      }

      .linkedintel-description-list li:not(:last-child) {
        border-bottom: 1px solid #e2e8f0;
      }

      .linkedintel-company-description {
        line-height: 1.6;
        color: #2d3748;
        font-size: 14px;
      }

      /* Reduced Motion */
      @media (prefers-reduced-motion: reduce) {
        .linkedintel-insights-panel *,
        .linkedintel-panel-container,
        .linkedintel-panel-overlay {
          animation: none !important;
          transition: none !important;
        }
      }
    `

    document.head.appendChild(style)
  }

  // Attach event listeners
  attachEventListeners() {
    const closeBtn = this.panel.querySelector('.linkedintel-close-btn')
    if (closeBtn) {
      closeBtn.addEventListener('click', this.handleClose)
    }

    // Panel stays open while browsing LinkedIn - close with X button or ESC key only
    document.addEventListener('keydown', this.handleEscapeKey)

    // Add event delegation for copy buttons
    this.panel.addEventListener('click', (e) => {
      const copyBtn = e.target.closest(
        '.linkedintel-copy-btn, .linkedintel-copy-btn-small, .linkedintel-copy-button'
      )
      if (copyBtn) {
        this.handleCopyClick(copyBtn)
      }

      // AI Summary Generate button
      const generateBtn = e.target.closest(
        '.linkedintel-ai-summary-generate-btn'
      )
      if (generateBtn) {
        this.handleAISummaryGenerate(generateBtn)
      }

      // AI Summary Type buttons
      const typeBtn = e.target.closest('.linkedintel-ai-summary-type-btn')
      if (typeBtn) {
        this.handleAISummaryTypeChange(typeBtn)
      }
    })
  }

  // Handle copy button clicks
  handleCopyClick(button) {
    const textToCopy = button.getAttribute('data-copy-text')
    if (!textToCopy) return

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        // Store original content
        const originalHTML = button.innerHTML
        const wasSmall = button.classList.contains('linkedintel-copy-btn-small')

        // Show success state
        button.classList.add('copied')
        button.innerHTML = wasSmall
          ? '✓ Copied'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!'

        // Reset after 2 seconds
        setTimeout(() => {
          button.classList.remove('copied')
          button.innerHTML = originalHTML
        }, 2000)
      })
      .catch((err) => {
        panelLogger.error('Failed to copy:', err)
        // Show error state briefly
        const originalHTML = button.innerHTML
        button.innerHTML = '✗ Failed'
        setTimeout(() => {
          button.innerHTML = originalHTML
        }, 2000)
      })
  }

  // Handle tab click
  handleTabClick(tabId) {
    this.activeTab = tabId

    // Update active tab button
    const tabButtons = this.panel.querySelectorAll('.linkedintel-tab-btn')
    tabButtons.forEach((btn) => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add('active')
      } else {
        btn.classList.remove('active')
      }
    })

    // Update active tab content
    const tabContents = this.panel.querySelectorAll('.linkedintel-tab-content')
    tabContents.forEach((content) => {
      if (content.dataset.tab === tabId) {
        content.classList.add('active')
      } else {
        content.classList.remove('active')
      }
    })

    // Initialize chat interface when chat tab is clicked
    if ((tabId === 'chat' || tabId === 'person-chat') && this.chatInterface) {
      const chatContainer = this.panel.querySelector(`[data-tab="${tabId}"]`)
      if (chatContainer) {
        this.chatInterface.initialize(chatContainer)
      }
    }

    // Scroll to top of content area
    const bodyElement = this.panel.querySelector('.linkedintel-panel-body')
    if (bodyElement) {
      bodyElement.scrollTop = 0
    }
  }

  // Handle close button click
  handleClose() {
    this.hide()
  }

  // Handle escape key
  handleEscapeKey(e) {
    if (e.key === 'Escape' && this.isVisible) {
      this.hide()
    }
  }

  // Show the panel
  show() {
    if (!this.panel) {
      this.create()
    }

    requestAnimationFrame(() => {
      this.panel.classList.add('visible')
      this.isVisible = true
      this.updateUsageCounter()

      // Track panel opened with GA4
      this.trackEvent('panel_opened', {
        page_type: this.pageType,
      })
    })
  }

  // Update usage counter in header
  async updateUsageCounter() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_USAGE_STATUS',
      })

      const counterEl = document.getElementById('linkedintel-usage-counter')
      const textEl = counterEl?.querySelector('.linkedintel-usage-text')

      if (!counterEl || !textEl) return

      if (response && response.analysesRemaining !== undefined) {
        const { analysesRemaining, analysesLimit, isAuthenticated, planType } =
          response

        // Remove existing state classes
        counterEl.classList.remove('warning', 'danger')

        if (isAuthenticated) {
          // Authenticated user - show monthly limit
          textEl.textContent = `${analysesRemaining}/${analysesLimit} this month`

          // Add warning/danger classes based on usage
          if (analysesRemaining === 0) {
            counterEl.classList.add('danger')
          } else if (analysesRemaining <= 3) {
            counterEl.classList.add('warning')
          }
        } else {
          // Anonymous user - show trial status
          if (analysesRemaining === 0) {
            textEl.textContent = 'Trial expired'
            counterEl.classList.add('danger')
          } else {
            textEl.textContent = `${analysesRemaining}/${analysesLimit} free trials`
            if (analysesRemaining <= 1) {
              counterEl.classList.add('warning')
            }
          }
        }
      } else {
        textEl.textContent = 'Loading...'
      }
    } catch (error) {
      panelLogger.debug('Failed to update usage counter:', error)
      const counterEl = document.getElementById('linkedintel-usage-counter')
      const textEl = counterEl?.querySelector('.linkedintel-usage-text')
      if (textEl) {
        textEl.textContent = '3 free trials'
      }
    }
  }

  // Hide the panel
  hide() {
    if (this.panel) {
      this.panel.classList.remove('visible')
      this.isVisible = false

      // Hide company status badge when panel is closed
      const badge = document.getElementById('linkedintel-company-status-badge')
      if (badge) {
        badge.style.display = 'none'
      }

      // Track panel closed with GA4
      this.trackEvent('panel_closed', {
        page_type: this.pageType,
      })
    }
  }

  // Show stunning loading state with animated progress
  showLoading(message = 'Analyzing LinkedIn page...') {
    // Stop any existing timers first
    this.stopTimers()

    // Hide company status badge during loading
    const badge = document.getElementById('linkedintel-company-status-badge')
    if (badge) {
      badge.style.display = 'none'
    }

    // Start timing
    this.loadingStartTime = Date.now()
    this.currentTipIndex = 0
    this.currentStepIndex = 0

    const mainElement = this.panel.querySelector('.linkedintel-panel-main')
    if (mainElement) {
      const tips = this.getLoadingTips()
      const firstTip = tips[0]

      mainElement.innerHTML = `
        <div class="linkedintel-panel-body">
          <div class="linkedintel-loading-state">
            <!-- Animated Logo -->
            <div class="linkedintel-loading-logo">
              <svg viewBox="0 0 24 24" fill="currentColor" class="linkedintel-loading-icon">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
              </svg>
            </div>
            
            <!-- Main Message -->
            <h2 class="linkedintel-loading-title">${message}</h2>
            <p class="linkedintel-loading-subtitle">Please wait while we gather intelligence...</p>
            
            <!-- ETA Display -->
            <div class="linkedintel-eta-container" id="linkedintel-eta">
              <svg class="linkedintel-eta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span class="linkedintel-eta-text">Estimated time: <strong>60-80s</strong></span>
            </div>
            
            <!-- Horizontal Progress Bar with Shimmer -->
            <div class="linkedintel-progress-wrapper">
              <div class="linkedintel-progress-bar">
                <div class="linkedintel-progress-fill" id="linkedintel-progress-fill">
                  <div class="linkedintel-progress-shimmer"></div>
                </div>
              </div>
              <div class="linkedintel-progress-percentage" id="linkedintel-progress-percentage">0%</div>
            </div>
            
            <!-- Current Step Indicator -->
            <div class="linkedintel-current-step" id="linkedintel-current-step">
              <div class="linkedintel-step-icon">
                <div class="linkedintel-step-pulse"></div>
                <span>⚡</span>
              </div>
              <span class="linkedintel-step-label">Initializing analysis...</span>
            </div>
            
            <!-- Progress Steps Grid -->
            <div class="linkedintel-steps-grid" id="linkedintel-steps-grid">
              <!-- Steps will be injected here -->
            </div>
            
            <!-- Loading Tips Carousel -->
            <div class="linkedintel-tips-container">
              <div class="linkedintel-tip-card" id="linkedintel-tip-card">
                <div class="linkedintel-tip-icon">${firstTip.icon}</div>
                <div class="linkedintel-tip-content">
                  <div class="linkedintel-tip-title">${firstTip.title}</div>
                  <div class="linkedintel-tip-text">${firstTip.text}</div>
                </div>
              </div>
              <div class="linkedintel-tip-dots" id="linkedintel-tip-dots">
                ${tips
                  .map(
                    (_, i) =>
                      `<span class="linkedintel-tip-dot ${
                        i === 0 ? 'active' : ''
                      }"></span>`
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </div>
      `

      // Start tip rotation
      this.startTipRotation()

      // Start ETA updates
      this.startETAUpdates()

      // Initialize progress steps based on page type
      if (this.pageType === 'company' || !this.pageType) {
        this.initializeProgressSteps([
          {
            id: 'stockData',
            label: 'Stock Performance',
            description: 'Real-time market data & financials',
            icon: '📊',
            order: 1,
            category: 'financial',
          },
          {
            id: 'recentNews',
            label: 'Recent News',
            description: 'Latest articles & sentiment analysis',
            icon: '📰',
            order: 2,
            category: 'news',
          },
          {
            id: 'growthEvents',
            label: 'Growth Events',
            description: 'Funding, acquisitions, expansions',
            icon: '📈',
            order: 3,
            category: 'growth',
          },
          {
            id: 'companyChallenges',
            label: 'Challenges',
            description: 'Layoffs, lawsuits, financial issues',
            icon: '⚠️',
            order: 4,
            category: 'risk',
          },
          {
            id: 'techStack',
            label: 'Tech Stack',
            description: 'Technologies & tools in use',
            icon: '💻',
            order: 5,
            category: 'tech',
          },
          {
            id: 'companyActivity',
            label: 'Company Activity',
            description: 'Funding, hiring, partnerships, launches',
            icon: '📊',
            order: 6,
            category: 'activity',
          },
          {
            id: 'priorityContacts',
            label: 'Decision Makers',
            description: 'Key executives & stakeholders',
            icon: '👥',
            order: 7,
            category: 'contacts',
          },
          {
            id: 'fitScore',
            label: 'Fit Score',
            description: 'AI-powered opportunity score',
            icon: '⭐',
            order: 8,
            category: 'score',
          },
          {
            id: 'recommendation',
            label: 'Strategic Insights',
            description: 'Personalized outreach recommendations',
            icon: '💡',
            order: 9,
            category: 'insights',
          },
        ])
      } else if (this.pageType === 'profile') {
        // Profile analysis includes person analysis + full company analysis!
        this.initializeProgressSteps([
          // Person-specific stages (Phase 1)
          {
            id: 'personProfile',
            label: 'Profile Analysis',
            description: 'Role, authority & influence level',
            icon: '👤',
            order: 1,
            category: 'profile',
          },
          {
            id: 'personPainPoints',
            label: 'Pain Points',
            description: 'Challenges & business needs',
            icon: '🎯',
            order: 2,
            category: 'person',
          },
          // Company analysis stages (Phase 2)
          {
            id: 'stockData',
            label: 'Stock Performance',
            description: 'Company market data',
            icon: '📊',
            order: 3,
            category: 'financial',
          },
          {
            id: 'recentNews',
            label: 'Recent News',
            description: 'Company news & updates',
            icon: '📰',
            order: 4,
            category: 'news',
          },
          {
            id: 'growthEvents',
            label: 'Growth Events',
            description: 'Company expansion signals',
            icon: '📈',
            order: 5,
            category: 'growth',
          },
          {
            id: 'techStack',
            label: 'Tech Stack',
            description: 'Company technologies',
            icon: '💻',
            order: 6,
            category: 'tech',
          },
          {
            id: 'companyActivity',
            label: 'Company Activity',
            description: 'Funding, hiring, partnerships, launches',
            icon: '📊',
            order: 7,
            category: 'activity',
          },
          {
            id: 'priorityContacts',
            label: 'Decision Makers',
            description: 'Other key stakeholders',
            icon: '👥',
            order: 8,
            category: 'contacts',
          },
          {
            id: 'fitScore',
            label: 'Fit Score',
            description: 'Opportunity assessment',
            icon: '⭐',
            order: 9,
            category: 'score',
          },
          {
            id: 'recommendation',
            label: 'Strategic Insights',
            description: 'Outreach strategy & hooks',
            icon: '💡',
            order: 10,
            category: 'insights',
          },
        ])
      }
    }
  }

  // Initialize progress list with items
  initializeProgressList(items) {
    const progressList = this.panel.querySelector('#linkedintel-progress-list')
    if (!progressList) return

    this.progressItems = items

    progressList.innerHTML = items
      .map(
        (item) => `
      <div class="linkedintel-progress-item" data-progress-id="${item.id}">
        <div class="linkedintel-progress-icon">
          <svg class="linkedintel-progress-spinner" viewBox="0 0 24 24" width="16" height="16">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 0 20" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>
          </svg>
          <svg class="linkedintel-progress-check" viewBox="0 0 24 24" width="16" height="16" style="display: none;">
            <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          <svg class="linkedintel-progress-error" viewBox="0 0 24 24" width="16" height="16" style="display: none;">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </div>
        <span class="linkedintel-progress-label">${item.label}</span>
      </div>
    `
      )
      .join('')
  }

  // Update progress item status (new version with fallback)
  updateProgress(itemId, status) {
    // Try new stunning visual progress first
    if (this.progressSteps && this.progressSteps.length > 0) {
      return this.updateProgressStep(itemId, status)
    }

    // Fallback to old list-based progress
    return this._updateProgressLegacy(itemId, status)
  }

  // Legacy list-based progress update (private method to prevent recursion)
  _updateProgressLegacy(itemId, status) {
    const progressItem = this.panel.querySelector(
      `[data-progress-id="${itemId}"]`
    )
    if (!progressItem) return

    const spinner = progressItem.querySelector('.linkedintel-progress-spinner')
    const check = progressItem.querySelector('.linkedintel-progress-check')
    const error = progressItem.querySelector('.linkedintel-progress-error')

    // Reset all icons
    spinner.style.display = 'none'
    check.style.display = 'none'
    error.style.display = 'none'

    // Show appropriate icon based on status
    if (status === 'loading') {
      spinner.style.display = 'block'
      progressItem.classList.add('loading')
      progressItem.classList.remove('completed', 'error')
    } else if (status === 'completed') {
      check.style.display = 'block'
      progressItem.classList.add('completed')
      progressItem.classList.remove('loading', 'error')
    } else if (status === 'error') {
      error.style.display = 'block'
      progressItem.classList.add('error')
      progressItem.classList.remove('loading', 'completed')
    }
  }

  // Start rotating tips every 6 seconds
  startTipRotation() {
    // Clear any existing interval
    if (this.tipRotationInterval) {
      clearInterval(this.tipRotationInterval)
    }

    const tips = this.getLoadingTips()
    this.tipRotationInterval = setInterval(() => {
      this.currentTipIndex = (this.currentTipIndex + 1) % tips.length
      this.updateTip()
    }, 6000) // Change tip every 6 seconds
  }

  // Update the displayed tip with smooth animation
  updateTip() {
    const tipCard = this.panel.querySelector('#linkedintel-tip-card')
    const tipDots = this.panel.querySelectorAll('.linkedintel-tip-dot')

    if (!tipCard || !tipDots.length) return

    const tips = this.getLoadingTips()
    const tip = tips[this.currentTipIndex]

    // Fade out
    tipCard.style.opacity = '0'
    tipCard.style.transform = 'translateY(10px)'

    setTimeout(() => {
      // Update content
      tipCard.innerHTML = `
        <div class="linkedintel-tip-icon">${tip.icon}</div>
        <div class="linkedintel-tip-content">
          <div class="linkedintel-tip-title">${tip.title}</div>
          <div class="linkedintel-tip-text">${tip.text}</div>
        </div>
      `

      // Update dots
      tipDots.forEach((dot, i) => {
        dot.classList.toggle('active', i === this.currentTipIndex)
      })

      // Fade in
      tipCard.style.opacity = '1'
      tipCard.style.transform = 'translateY(0)'
    }, 300)
  }

  // Start ETA countdown updates
  startETAUpdates() {
    // Clear any existing interval
    if (this.etaUpdateInterval) {
      clearInterval(this.etaUpdateInterval)
    }

    this.etaUpdateInterval = setInterval(() => {
      this.updateETA()
    }, 1000) // Update every second
  }

  // Update ETA display based on elapsed time and progress
  updateETA() {
    const etaElement = this.panel.querySelector('#linkedintel-eta')
    if (!etaElement || !this.loadingStartTime) return

    const elapsed = Math.floor((Date.now() - this.loadingStartTime) / 1000)
    const completedSteps = this.currentStepIndex || 0
    const totalSteps = this.totalSteps || 8

    // Calculate estimated remaining time
    let remaining = 50 - elapsed // Start with 50s estimate (more realistic)

    // If we have progress, calculate based on average step time
    if (completedSteps > 0 && completedSteps < totalSteps) {
      const avgTimePerStep = elapsed / completedSteps
      const stepsRemaining = totalSteps - completedSteps
      remaining = Math.ceil(avgTimePerStep * stepsRemaining)
    } else if (completedSteps >= totalSteps) {
      // All steps completed
      remaining = 0
    }

    // Don't show negative time or unreasonably high time
    remaining = Math.max(0, Math.min(remaining, 120))

    // Format the ETA text
    let etaText
    const progressPercent =
      totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0

    if (remaining === 0 || progressPercent >= 90) {
      etaText = '<strong>Almost done...</strong>'
    } else if (remaining < 10) {
      etaText = `<strong>${remaining}s remaining</strong>`
    } else if (remaining < 60) {
      etaText = `About <strong>${
        Math.ceil(remaining / 10) * 10
      }s remaining</strong>`
    } else {
      const minutes = Math.floor(remaining / 60)
      const seconds = remaining % 60
      etaText = `About <strong>${minutes}m ${seconds}s remaining</strong>`
    }

    const etaTextElement = etaElement.querySelector('.linkedintel-eta-text')
    if (etaTextElement) {
      etaTextElement.innerHTML = etaText
    }
  }

  // Stop all timers
  stopTimers() {
    if (this.tipRotationInterval) {
      clearInterval(this.tipRotationInterval)
      this.tipRotationInterval = null
    }
    if (this.etaUpdateInterval) {
      clearInterval(this.etaUpdateInterval)
      this.etaUpdateInterval = null
    }
    // Reset loading start time
    this.loadingStartTime = null
  }

  // Initialize progress steps with stunning visual grid
  initializeProgressSteps(steps) {
    const stepsGrid = this.panel.querySelector('#linkedintel-steps-grid')
    if (!stepsGrid) return

    this.progressSteps = steps
    this.currentStepIndex = 0
    this.totalSteps = steps.length

    // Get category colors for visual distinction
    const getCategoryColor = (category) => {
      const colors = {
        financial: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
        news: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
        growth: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
        risk: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
        tech: { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },
        sales: { bg: '#fce7f3', border: '#ec4899', text: '#831843' },
        contacts: { bg: '#ddd6fe', border: '#8b5cf6', text: '#5b21b6' },
        score: { bg: '#fef9c3', border: '#eab308', text: '#713f12' },
        insights: { bg: '#ccfbf1', border: '#14b8a6', text: '#134e4a' },
        profile: { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },
        person: { bg: '#fbcfe8', border: '#db2777', text: '#831843' },
      }
      return colors[category] || colors.insights
    }

    stepsGrid.innerHTML = steps
      .map((step) => {
        const color = getCategoryColor(step.category)
        return `
      <div class="linkedintel-step-card" data-step-id="${
        step.id
      }" data-category="${step.category}">
        <div class="linkedintel-step-indicator">
          <div class="linkedintel-step-number">${step.order}</div>
          <div class="linkedintel-step-checkmark">✓</div>
        </div>
        <div class="linkedintel-step-content">
          <div class="linkedintel-step-header">
            <div class="linkedintel-step-emoji">${step.icon}</div>
            <span class="linkedintel-step-name">${step.label}</span>
          </div>
          ${
            step.description
              ? `<div class="linkedintel-step-description">${step.description}</div>`
              : ''
          }
        </div>
        <div class="linkedintel-step-category-indicator" style="background: ${
          color.bg
        }; border-color: ${color.border}"></div>
      </div>
    `
      })
      .join('')
  }

  // Update progress with backward compatibility
  updateProgressStep(stepId, status) {
    const stepCard = this.panel.querySelector(`[data-step-id="${stepId}"]`)
    const progressFill = this.panel.querySelector('#linkedintel-progress-fill')
    const progressPercentage = this.panel.querySelector(
      '#linkedintel-progress-percentage'
    )
    const currentStepIndicator = this.panel.querySelector(
      '#linkedintel-current-step'
    )

    if (!stepCard || !progressFill || !progressPercentage) {
      // Fallback to legacy method if new elements don't exist
      return this._updateProgressLegacy(stepId, status)
    }

    // Find step info
    const step = this.progressSteps.find((s) => s.id === stepId)
    if (!step) return

    if (status === 'loading') {
      // Mark as active
      stepCard.classList.add('active')
      stepCard.classList.remove('completed', 'error')

      // Update current step label
      if (currentStepIndicator) {
        const stepLabel = currentStepIndicator.querySelector(
          '.linkedintel-step-label'
        )
        const stepIcon = currentStepIndicator.querySelector(
          '.linkedintel-step-icon span'
        )
        if (stepLabel) stepLabel.textContent = `${step.label}...`
        if (stepIcon) stepIcon.textContent = step.icon
      }

      this.currentStepIndex = step.order - 1
    } else if (status === 'completed') {
      // Mark as completed
      stepCard.classList.add('completed')
      stepCard.classList.remove('active', 'error')

      // Update progress bar (cap at 100%)
      const percentComplete = Math.min(
        100,
        Math.round((step.order / this.totalSteps) * 100)
      )
      progressFill.style.width = `${percentComplete}%`
      if (progressPercentage) {
        progressPercentage.textContent = `${percentComplete}%`
      }

      this.currentStepIndex = step.order
    } else if (status === 'error') {
      // Mark as error
      stepCard.classList.add('error')
      stepCard.classList.remove('active', 'completed')
    }
  }

  // Show error state
  async showError(message) {
    const mainElement = this.panel.querySelector('.linkedintel-panel-main')
    if (!mainElement) return

    // Hide company status badge during error states
    const badge = document.getElementById('linkedintel-company-status-badge')
    if (badge) {
      badge.style.display = 'none'
    }

    // Check if this is a limit-reached error
    const isLimitReached =
      message.includes('used all') || message.includes('free analyses')

    if (isLimitReached) {
      // Get usage status to determine which CTA to show
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_USAGE_STATUS',
        })

        const isAuthenticated = response?.isAuthenticated || false

        if (isAuthenticated) {
          // Authenticated user - show upgrade to Pro CTA
          mainElement.innerHTML = `
            <div class="linkedintel-panel-body">
              <div class="linkedintel-upgrade-state">
                <div class="linkedintel-upgrade-icon">🚀</div>
                <h2 class="linkedintel-upgrade-title">Monthly Limit Reached</h2>
                <p class="linkedintel-upgrade-message">Buy credits as you need — no subscriptions!</p>
                
                <div class="linkedintel-upgrade-comparison">
                  <div class="linkedintel-plan-card current">
                    <div class="linkedintel-plan-header">
                      <div class="linkedintel-plan-name">Free</div>
                      <div class="linkedintel-plan-badge">Current</div>
                    </div>
                    <div class="linkedintel-plan-price">$0</div>
                    <div class="linkedintel-plan-feature">✓ 10/month</div>
                  </div>
                  
                  <div class="linkedintel-plan-card pro">
                    <div class="linkedintel-plan-header">
                      <div class="linkedintel-plan-name">Basic Pack</div>
                      <div class="linkedintel-plan-badge popular">Most Popular</div>
                    </div>
                    <div class="linkedintel-plan-price">$19</div>
                    <div class="linkedintel-plan-feature">✓ 200 credits</div>
                    <div class="linkedintel-plan-feature">✓ Never expire</div>
                    <div class="linkedintel-plan-feature">✓ $0.095/analysis</div>
                  </div>
                </div>

                <button class="linkedintel-upgrade-btn" id="linkedintel-upgrade-btn">
                  Buy Credits
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14m-7-7l7 7-7 7"/>
                  </svg>
                </button>
                
                <p class="linkedintel-upgrade-note">Cancel anytime • Instant activation</p>
              </div>
            </div>
          `

          // Attach upgrade button handler
          const upgradeBtn = mainElement.querySelector(
            '#linkedintel-upgrade-btn'
          )
          if (upgradeBtn) {
            upgradeBtn.addEventListener('click', () => {
              // TODO: Open Stripe checkout or upgrade page
              window.open('https://linkedintel.io/pricing', '_blank')
            })
          }
        } else {
          // Anonymous user - show Google sign-in CTA
          mainElement.innerHTML = `
            <div class="linkedintel-panel-body">
            <div class="linkedintel-upgrade-state">
              <div class="linkedintel-upgrade-icon">🎉</div>
              <h2 class="linkedintel-upgrade-title">Free Trial Complete!</h2>
              <p class="linkedintel-upgrade-message">You've used all 3 free analyses. Sign in with Google to get 10 more trials — free forever!</p>
                
                <div class="linkedintel-benefit-list">
              <div class="linkedintel-benefit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span><strong>10 analyses per month</strong> — forever free</span>
              </div>
                  <div class="linkedintel-benefit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <span><strong>Sync across devices</strong> — use anywhere</span>
                  </div>
                  <div class="linkedintel-benefit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <span><strong>Save your insights</strong> — access history</span>
                  </div>
                </div>

                <button class="linkedintel-google-signin-btn" id="linkedintel-google-signin-btn">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
                
                <p class="linkedintel-upgrade-note">No credit card required • Takes 5 seconds</p>
              </div>
            </div>
          `

          // Attach sign-in button handler
          const signinBtn = mainElement.querySelector(
            '#linkedintel-google-signin-btn'
          )
          if (signinBtn) {
            signinBtn.addEventListener('click', async () => {
              await this.handleGoogleSignIn(signinBtn)
            })
          }
        }
      } catch (error) {
        panelLogger.error(
          'Failed to get usage status for error display:',
          error
        )
        // Fall back to generic error
        this.showGenericError(message)
      }
    } else {
      // Regular error - show generic error state
      this.showGenericError(message)
    }
  }

  showGenericError(message) {
    // Hide company status badge during error states
    const badge = document.getElementById('linkedintel-company-status-badge')
    if (badge) {
      badge.style.display = 'none'
    }

    const mainElement = this.panel.querySelector('.linkedintel-panel-main')
    if (mainElement) {
      mainElement.innerHTML = `
        <div class="linkedintel-panel-body">
          <div class="linkedintel-error-state">
            <svg class="linkedintel-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p class="linkedintel-error-message">${message}</p>
          </div>
        </div>
      `
    }
  }

  // Handle Google Sign-In from insights panel
  async handleGoogleSignIn(button, modalOverlay = null, closeModalFn = null) {
    const originalText = button.innerHTML

    try {
      // Update button to show loading state
      button.disabled = true
      button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 0.6s linear infinite;">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
        Signing in...
      `

      panelLogger.info('[InsightsPanel] Initiating Google Sign-In')

      // Request sign-in from service worker
      const response = await chrome.runtime.sendMessage({
        type: 'GOOGLE_SIGNIN',
      })

      if (response && response.success) {
        panelLogger.info('[InsightsPanel] Sign-in successful!')

        // Show success state
        button.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          Success! Retrying analysis...
        `
        button.style.background =
          'linear-gradient(135deg, #10b981 0%, #059669 100%)'

        // Close modal if it exists
        if (closeModalFn) {
          setTimeout(() => closeModalFn(), 1000)
        }

        // Wait a moment for user to see success message
        await new Promise((resolve) => setTimeout(resolve, 1500))

        // Retry the analysis with new credits
        panelLogger.info('[InsightsPanel] Retrying analysis after sign-in')
        await this.startAnalysis(this.pageType)
      } else {
        throw new Error(response?.error || 'Sign-in failed')
      }
    } catch (error) {
      panelLogger.error('[InsightsPanel] Sign-in error:', error)

      // Show error state
      button.disabled = false
      button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        Sign-in failed - Try again
      `
      button.style.background =
        'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'

      // Revert to original state after 3 seconds
      setTimeout(() => {
        button.innerHTML = originalText
        button.style.background = ''
        button.disabled = false
      }, 3000)

      // Show error notification
      this.showNotification(
        'Sign-in failed. Please try again or check your popup blocker.',
        'error'
      )
    }
  }

  // Show notification toast
  showNotification(message, type = 'info') {
    const notification = document.createElement('div')
    notification.className = `linkedintel-notification linkedintel-notification-${type}`
    notification.innerHTML = `
      <div class="linkedintel-notification-content">
        ${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'} ${message}
      </div>
    `

    // Add to DOM
    document.body.appendChild(notification)

    // Animate in
    requestAnimationFrame(() => {
      notification.style.opacity = '1'
      notification.style.transform = 'translateY(0)'
    })

    // Remove after 5 seconds
    setTimeout(() => {
      notification.style.opacity = '0'
      notification.style.transform = 'translateY(-20px)'
      setTimeout(() => notification.remove(), 300)
    }, 5000)

    // Add styles if not present
    if (!document.getElementById('linkedintel-notification-styles')) {
      const style = document.createElement('style')
      style.id = 'linkedintel-notification-styles'
      style.textContent = `
        .linkedintel-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          background: white;
          border-radius: 12px;
          padding: 16px 20px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          z-index: 10000001;
          max-width: 400px;
          opacity: 0;
          transform: translateY(-20px);
          transition: all 0.3s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
        }
        
        .linkedintel-notification-error {
          border-left: 4px solid #ef4444;
        }
        
        .linkedintel-notification-success {
          border-left: 4px solid #10b981;
        }
        
        .linkedintel-notification-info {
          border-left: 4px solid #3b82f6;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `
      document.head.appendChild(style)
    }
  }

  showAuthModal() {
    // Create modal overlay
    const modalOverlay = document.createElement('div')
    modalOverlay.className = 'linkedintel-auth-modal-overlay'
    modalOverlay.innerHTML = `
      <div class="linkedintel-auth-modal">
        <div class="linkedintel-auth-modal-header">
          <h2>Sign in to LinkedIntel</h2>
          <button class="linkedintel-auth-modal-close" id="linkedintel-auth-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="linkedintel-auth-modal-body">
          <div class="linkedintel-auth-icon">🎉</div>
          <h3>Get 10 Analyses per Month — Free Forever! (Or buy more)</h3>
          <p>Sign in with your Google account to unlock:</p>
          
          <div class="linkedintel-auth-benefits">
            <div class="linkedintel-auth-benefit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span><strong>10 analyses per month</strong> (vs 3 one-time) • Or buy 200 for $19</span>
            </div>
            <div class="linkedintel-auth-benefit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span><strong>Sync across devices</strong> — use anywhere</span>
            </div>
            <div class="linkedintel-auth-benefit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span><strong>Save your insights</strong> — access history</span>
            </div>
            <div class="linkedintel-auth-benefit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span><strong>Priority support</strong> — get help fast</span>
            </div>
          </div>

          <button class="linkedintel-auth-google-btn" id="linkedintel-auth-google">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p class="linkedintel-auth-note">No credit card required • 100% free forever • Takes 5 seconds</p>

          <div class="linkedintel-auth-footer">
            <p>By continuing, you agree to our <a href="https://linkedintel.io/terms" target="_blank">Terms</a> and <a href="https://linkedintel.io/privacy" target="_blank">Privacy Policy</a></p>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(modalOverlay)

    // Animate in
    requestAnimationFrame(() => {
      modalOverlay.classList.add('visible')
    })

    // Attach event listeners
    const closeBtn = modalOverlay.querySelector('#linkedintel-auth-close')
    const googleBtn = modalOverlay.querySelector('#linkedintel-auth-google')

    const closeModal = () => {
      modalOverlay.classList.remove('visible')
      setTimeout(() => modalOverlay.remove(), 300)
    }

    closeBtn.addEventListener('click', closeModal)
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeModal()
      }
    })

    googleBtn.addEventListener('click', async () => {
      // Trigger Google Sign-In
      await this.handleGoogleSignIn(googleBtn, modalOverlay, closeModal)
    })

    // Add styles if not already present
    if (!document.getElementById('linkedintel-auth-modal-styles')) {
      const styles = document.createElement('style')
      styles.id = 'linkedintel-auth-modal-styles'
      styles.textContent = `
        .linkedintel-auth-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          z-index: 10000000;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .linkedintel-auth-modal-overlay.visible {
          opacity: 1;
        }

        .linkedintel-auth-modal {
          background: white;
          border-radius: 16px;
          max-width: 480px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          transform: scale(0.9) translateY(20px);
          transition: transform 0.3s ease;
        }

        .linkedintel-auth-modal-overlay.visible .linkedintel-auth-modal {
          transform: scale(1) translateY(0);
        }

        .linkedintel-auth-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px;
          border-bottom: 1px solid #e9ecef;
        }

        .linkedintel-auth-modal-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #212529;
        }

        .linkedintel-auth-modal-close {
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
          color: #868e96;
          transition: all 0.2s ease;
          border-radius: 8px;
        }

        .linkedintel-auth-modal-close:hover {
          background: #f8f9fa;
          color: #212529;
        }

        .linkedintel-auth-modal-close svg {
          width: 20px;
          height: 20px;
        }

        .linkedintel-auth-modal-body {
          padding: 32px 24px;
          text-align: center;
        }

        .linkedintel-auth-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .linkedintel-auth-modal-body h3 {
          margin: 0 0 12px 0;
          font-size: 22px;
          font-weight: 700;
          color: #212529;
        }

        .linkedintel-auth-modal-body > p {
          margin: 0 0 24px 0;
          color: #495057;
          font-size: 15px;
        }

        .linkedintel-auth-benefits {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 32px;
          text-align: left;
        }

        .linkedintel-auth-benefit {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .linkedintel-auth-benefit svg {
          width: 22px;
          height: 22px;
          color: #51cf66;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .linkedintel-auth-benefit span {
          font-size: 14px;
          color: #495057;
          line-height: 1.5;
        }

        .linkedintel-auth-google-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 14px 24px;
          background: white;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          color: #212529;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .linkedintel-auth-google-btn:hover {
          border-color: #4285F4;
          box-shadow: 0 4px 12px rgba(66, 133, 244, 0.2);
          transform: translateY(-2px);
        }

        .linkedintel-auth-google-btn svg {
          width: 22px;
          height: 22px;
        }

        .linkedintel-auth-note {
          margin: 16px 0 0 0;
          font-size: 13px;
          color: #868e96;
          font-style: italic;
        }

        .linkedintel-auth-footer {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #e9ecef;
        }

        .linkedintel-auth-footer p {
          margin: 0;
          font-size: 12px;
          color: #868e96;
        }

        .linkedintel-auth-footer a {
          color: #4c6ef5;
          text-decoration: none;
        }

        .linkedintel-auth-footer a:hover {
          text-decoration: underline;
        }
      `
      document.head.appendChild(styles)
    }
  }

  // Update content with analysis results
  updateContent(response) {
    panelLogger.info('[Panel] updateContent called', {
      hasResponse: !!response,
      hasError: !!response?.error,
    })

    // Stop all loading timers
    this.stopTimers()

    // Update usage counter with new values
    this.updateUsageCounter()

    if (!response || response.error) {
      panelLogger.error('[Panel] Response error or missing', {
        error: response?.error,
      })
      this.showError(response?.error || 'Analysis failed. Please try again.')

      // Track analysis error with GA4
      this.trackEvent('analysis_error', {
        error_message: response?.error || 'Unknown error',
        page_type: this.pageType,
      })
      return
    }

    const data = response.data
    panelLogger.info('[Panel] Data extracted', {
      hasData: !!data,
      dataKeys: data ? Object.keys(data).slice(0, 5) : [],
    })

    // Store data
    this.currentData = data

    // Determine page type
    this.pageType =
      response.pageType ||
      data.pageType ||
      (data.profile ? 'profile' : 'company')
    panelLogger.info('[Panel] Page type determined', {
      pageType: this.pageType,
    })

    // Populate unified context service with all available data
    this.populateUnifiedContext(data)

    // Track successful analysis display with GA4
    this.trackEvent('analysis_displayed', {
      page_type: this.pageType,
      from_cache: response.fromCache || false,
      has_data: !!data,
    })

    const mainElement = this.panel.querySelector('.linkedintel-panel-main')
    if (mainElement) {
      panelLogger.info('[Panel] Generating tab layout')
      try {
        const html = this.generateTabLayout(data)
        panelLogger.info('[Panel] Tab layout generated', {
          htmlLength: html?.length,
        })
        mainElement.innerHTML = html

        // Update company status badge in header
        this.updateCompanyStatusBadge(data)

        // Attach tab click listeners
        const tabButtons = mainElement.querySelectorAll('.linkedintel-tab-btn')
        panelLogger.info('[Panel] Attaching tab listeners', {
          tabCount: tabButtons.length,
        })
        tabButtons.forEach((btn) => {
          btn.addEventListener('click', () => {
            this.handleTabClick(btn.dataset.tab)
          })
        })
        panelLogger.info('[Panel] ✅ Content update complete')
      } catch (error) {
        panelLogger.error(
          '[Panel] ❌ Error in generateTabLayout or rendering',
          error
        )
        this.showError(`Failed to render analysis: ${error.message}`)
      }
    } else {
      panelLogger.error('[Panel] ❌ Main element not found!')
    }
  }

  // Update company status badge in header
  updateCompanyStatusBadge(data) {
    const badge = document.getElementById('linkedintel-company-status-badge')
    if (!badge) return

    // Get company data (either direct company data or company from profile)
    const companyData = data.company || data
    const isPublic = companyData?.overview?.isPublic
    const isSubsidiary = this.isSubsidiary(companyData)
    const parentCompany = this.getParentCompany(companyData)

    // Only show badge for company pages or profile pages with company data
    if (isPublic !== undefined) {
      const statusClass = isPublic ? 'public' : 'private'
      const statusIcon = isPublic ? '📈' : '🔒'

      if (isSubsidiary && parentCompany && isPublic) {
        // Two-line badge showing public status and parent company
        badge.innerHTML = `
          <span style="font-size: 14px; line-height: 1;">${statusIcon}</span>
          <div style="display: flex; flex-direction: column; gap: 2px; line-height: 1.2;">
            <span style="font-size: 11px; font-weight: 600; letter-spacing: 0.4px;">PUBLIC COMPANY</span>
            <span style="font-size: 10px; font-weight: 500; opacity: 0.85;">${parentCompany} <span style="opacity: 0.7;">(parent)</span></span>
          </div>
        `
        badge.className = `linkedintel-company-status-badge ${statusClass}`
        badge.style.cssText =
          'display: flex !important; align-items: center !important; gap: 8px !important; padding: 8px 14px !important;'
      } else {
        // Standard single-line badge
        const statusText = isPublic ? 'Public Company' : 'Private Company'
        badge.innerHTML = `
          <span style="font-size: 14px;">${statusIcon}</span>
          <span style="font-weight: 600; letter-spacing: 0.3px; font-size: 12px;">${statusText}</span>
        `
        badge.className = `linkedintel-company-status-badge ${statusClass}`
        badge.style.display = 'flex'
      }
    } else {
      // Hide badge if no company status data
      badge.style.display = 'none'
    }
  }

  // Generate complete tab layout
  generateTabLayout(data) {
    // For profile pages with combined analysis
    if (this.pageType === 'profile' && data.profile && data.company) {
      return this.generateProfileDualLayout(data.profile, data.company)
    }

    // For company pages or legacy single-view
    const tabs = this.getCompanyTabs(data)

    return `
      <nav class="linkedintel-tabs-nav">
        ${tabs
          .map(
            (tab) => `
          <button class="linkedintel-tab-btn ${
            tab.id === 'overview' ? 'active' : ''
          }" data-tab="${tab.id}">
            ${tab.icon}
            <span>${tab.label}</span>
            ${
              tab.count
                ? `<span class="linkedintel-tab-badge">${tab.count}</span>`
                : ''
            }
          </button>
        `
          )
          .join('')}
      </nav>
      <div class="linkedintel-panel-body">
        ${tabs
          .map(
            (tab) => `
          <div class="linkedintel-tab-content ${
            tab.id === 'overview' ? 'active' : ''
          }" data-tab="${tab.id}">
            ${tab.content}
          </div>
        `
          )
          .join('')}
      </div>
    `
  }

  // Generate Profile Dual-Section Layout
  generateProfileDualLayout(profile, company) {
    const personTabs = this.getPersonTabs(profile, company)
    const companyTabs = this.getCompanyTabsForProfile(company)
    const companyName =
      profile.company || company.companyName || 'Their Company'

    const allTabs = [...personTabs, ...companyTabs]

    return `
      <nav class="linkedintel-tabs-nav">
        ${personTabs
          .map(
            (tab, index) => `
          <button class="linkedintel-tab-btn ${
            index === 0 ? 'active' : ''
          }" data-tab="${tab.id}">
            ${tab.icon}
            <span>${tab.label}</span>
            ${
              tab.count
                ? `<span class="linkedintel-tab-badge">${tab.count}</span>`
                : ''
            }
          </button>
        `
          )
          .join('')}
        
        <!-- Section Header: Their Company -->
        <div class="linkedintel-tab-section-header">
          <div class="linkedintel-section-divider"></div>
          <div class="linkedintel-section-label">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1"/>
            </svg>
            <span>${this.escapeHtml(companyName)}</span>
          </div>
        </div>

        ${companyTabs
          .map(
            (tab) => `
          <button class="linkedintel-tab-btn" data-tab="${tab.id}">
            ${tab.icon}
            <span>${tab.label}</span>
            ${
              tab.count
                ? `<span class="linkedintel-tab-badge">${tab.count}</span>`
                : ''
            }
          </button>
        `
          )
          .join('')}
      </nav>
      <div class="linkedintel-panel-body">
        ${allTabs
          .map(
            (tab, index) => `
          <div class="linkedintel-tab-content ${
            index === 0 ? 'active' : ''
          }" data-tab="${tab.id}">
            ${tab.content}
          </div>
        `
          )
          .join('')}
      </div>
    `
  }

  // Get Person-Specific Tabs (for Profile View)
  getPersonTabs(profile, company) {
    return [
      {
        id: 'person-overview',
        label: 'Profile',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
        content: this.generatePersonProfileOverview(profile, company),
      },
      {
        id: 'person-painpoints',
        label: 'Pain Points',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
        content: this.generatePainPointsKPIs(profile),
        count: profile.publiclyStatedPainPoints?.length || null,
      },
      {
        id: 'person-recent-activity',
        label: 'Recent Activity',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>',
        content: this.generateRecentActivitySection(profile),
        count: profile.recentActivity?.posts?.length || null,
      },
      {
        id: 'person-thought-leadership',
        label: 'Thought Leadership',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
        content: this.generateThoughtLeadershipSection(profile),
        count:
          (profile.speakingEngagements?.events?.length || 0) +
            (profile.speakingEngagements?.awards?.length || 0) +
            (profile.contentCreation?.publishedContent?.length || 0) || null,
      },
      {
        id: 'person-chat',
        label: 'Ask AI',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"/></svg>',
        content: this.chatInterface
          ? this.chatInterface.generateChatHTML()
          : '<div>Loading chat...</div>',
      },
      {
        id: 'person-contact',
        label: 'Contact',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
        content: this.generateContactStrategy(profile),
      },
      {
        id: 'chrome-ai',
        label: 'Chrome AI',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/></svg>',
        content: this.generateChromeAITab({ profile, company }),
      },
    ]
  }

  // Helper to count all risk signals (challenges + risk factors + negative news + layoffs + earnings)
  countRiskSignals(data) {
    const challenges = data.companyChallenges?.challenges?.length || 0
    const riskFactors = data.fitScore?.riskFactors?.length || 0
    const hasNegativeNews = data.companyChallenges?.negativeNewsSummary ? 1 : 0
    const hasLayoffs = data.companyChallenges?.layoffsSummary ? 1 : 0
    const hasEarningsNews = data.companyChallenges?.earningsCallNegativeNews
      ?.summary
      ? 1
      : 0

    const total =
      challenges + riskFactors + hasNegativeNews + hasLayoffs + hasEarningsNews
    return total > 0 ? total : null
  }

  // Get Company Tabs for Profile View (section 2)
  getCompanyTabsForProfile(company) {
    return [
      {
        id: 'company-overview',
        label: 'Overview',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
        content: this.generateOverviewTab(company),
      },
      {
        id: 'company-tech-stack',
        label: 'Tech Stack',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
        count: company.techStack?.length || null,
        content: this.generateTechStackTab(company),
      },
      {
        id: 'company-financial',
        label: 'Financial',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
        content: this.generateFinancialTab(company),
      },
      {
        id: 'company-risk-signals',
        label: 'Risk Signals',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        count: this.countRiskSignals(company),
        content: this.generateRiskSignalsTab(company),
      },
      {
        id: 'company-news',
        label: 'News & Signals',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
        content: this.generateNewsSignals(company),
        count:
          (company.recentNews?.length || 0) +
            (company.companyActivity?.length || 0) || null,
      },
      {
        id: 'company-contacts',
        label: 'Decision Makers',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
        content: company.priorityContacts
          ? this.generateDecisionMakers(company)
          : '<div class="linkedintel-empty-state"><p class="linkedintel-empty-text">No decision makers found</p></div>',
        count: company.priorityContacts?.length || null,
      },
    ]
  }

  // Get tabs configuration for profile view
  getProfileTabs(data) {
    const profile = data.profile || {}
    const company = data.company || {}
    const hasCompanyData = company && Object.keys(company).length > 0

    // Profile-specific tabs
    const profileTabs = [
      {
        id: 'overview',
        label: 'Overview',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
        content: this.generateProfileOverview(profile, company),
      },
      {
        id: 'activity',
        label: 'Activity',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
        count:
          (profile.recentLinkedInActivity?.length || 0) +
          (profile.recentAchievements?.length || 0) +
          (profile.industryInfluence?.length || 0),
        content: this.generateActivityContent(profile),
      },
      {
        id: 'contact',
        label: 'Contact Strategy',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        content: this.generateContactStrategy(profile),
      },
    ]

    // Company tabs (expanded like company profile view)
    const companyTabs = hasCompanyData
      ? [
          {
            id: 'company-overview',
            label: 'Company',
            icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
            content: this.generateOverviewTab(company),
          },
          {
            id: 'company-tech-stack',
            label: 'Tech Stack',
            icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
            count: company.techStack?.length || 0,
            content: this.generateTechStackTab(company),
          },
          {
            id: 'company-financial',
            label: 'Financial',
            icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
            content: this.generateFinancialTab(company),
          },
          {
            id: 'company-risk-signals',
            label: 'Risk Signals',
            icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
            count: this.countRiskSignals(company),
            content: this.generateRiskSignalsTab(company),
          },
          {
            id: 'company-news',
            label: 'News & Signals',
            icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
            count:
              (company.recentNews?.length || 0) +
                (company.companyActivity?.length || 0) || null,
            content: this.generateNewsSignals(company),
          },
          {
            id: 'company-contacts',
            label: 'Decision Makers',
            icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
            count: company.priorityContacts?.length || 0,
            content: this.generateDecisionMakers(company),
          },
        ]
      : [
          {
            id: 'company',
            label: 'Company',
            icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
            content:
              '<div class="linkedintel-empty-state"><svg class="linkedintel-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p class="linkedintel-empty-text">No company data available</p></div>',
          },
        ]

    // Combine profile tabs + company tabs
    return [...profileTabs, ...companyTabs]
  }

  // Get tabs configuration for company view
  getCompanyTabs(data) {
    return [
      {
        id: 'overview',
        label: 'Overview',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
        content: this.generateOverviewTab(data),
      },
      {
        id: 'tech-stack',
        label: 'Tech Stack',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
        count: data.techStack?.length || null,
        content: this.generateTechStackTab(data),
      },
      {
        id: 'financial',
        label: 'Financial',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
        content: this.generateFinancialTab(data),
      },
      {
        id: 'risk-signals',
        label: 'Risk Signals',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        count: this.countRiskSignals(data),
        content: this.generateRiskSignalsTab(data),
      },
      {
        id: 'news-signals',
        label: 'News & Signals',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
        count:
          (data.recentNews?.length || 0) +
            (data.companyActivity?.length || 0) || null,
        content: this.generateNewsSignals(data),
      },
      {
        id: 'chat',
        label: 'Ask AI',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"/></svg>',
        content: this.chatInterface
          ? this.chatInterface.generateChatHTML()
          : '<div>Loading chat...</div>',
      },
      {
        id: 'decision-makers',
        label: 'Decision Makers',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
        count: data.priorityContacts?.length || null,
        content: this.generateDecisionMakers(data),
      },
      {
        id: 'chrome-ai',
        label: 'Chrome AI',
        icon: '<svg class="linkedintel-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/></svg>',
        content: this.generateChromeAITab(data),
      },
    ]
  }

  // Profile Overview Tab
  generateProfileOverview(profile, company) {
    const name = profile.name || 'Unknown'
    const title = profile.title || ''
    const companyName = profile.company || company.companyName || ''
    const isCXO = profile.isCXO?.value || false
    const cxoLevel = profile.isCXO?.level || 'Executive'
    const authorityIndicators = profile.authorityIndicators || []

    let html = `
      <div class="linkedintel-hero-card">
        <h1 class="linkedintel-hero-name">${this.escapeHtml(name)}</h1>
        ${
          title
            ? `<p class="linkedintel-hero-subtitle">${this.escapeHtml(
                title
              )}</p>`
            : ''
        }
        ${
          companyName
            ? `<p class="linkedintel-hero-meta">at ${this.escapeHtml(
                companyName
              )}</p>`
            : ''
        }
        
        <div class="linkedintel-hero-badges">
          ${
            isCXO
              ? `
            <span class="linkedintel-badge" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              Decision Maker
            </span>
          `
              : ''
          }
        </div>

        ${
          decisionScore > 0
            ? `
          <div class="linkedintel-hero-stats">
            <div class="linkedintel-stat-box">
              <p class="linkedintel-stat-label">Decision Score</p>
              <p class="linkedintel-stat-value">${decisionScore}/100</p>
            </div>
          </div>
        `
            : ''
        }
      </div>
    `

    // Stated Pain Points - Prominently Displayed (Organized like company view)
    if (
      profile.publiclyStatedPainPoints &&
      profile.publiclyStatedPainPoints.length > 0
    ) {
      html += `
        <div class="linkedintel-section" style="margin-top: 20px;">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <h3 class="linkedintel-section-title">Stated Pain Points</h3>
          </div>
          <div class="linkedintel-list">
            ${profile.publiclyStatedPainPoints
              .map((pain) => {
                // Handle both string and object formats
                const painText =
                  typeof pain === 'string'
                    ? pain
                    : pain.context || pain.quote || pain.painPoint || ''
                const urgencyLevel =
                  typeof pain === 'object'
                    ? pain.priority || pain.urgency || 'medium'
                    : 'medium'
                const urgencyColor =
                  urgencyLevel === 'high' || urgencyLevel === 'critical'
                    ? '#fa5252'
                    : urgencyLevel === 'medium'
                    ? '#fab005'
                    : '#868e96'
                const source =
                  typeof pain === 'object' ? pain.source : undefined
                const solutionFit =
                  typeof pain === 'object' ? pain.solutionFit : undefined
                return `
                <div class="linkedintel-list-item" style="border-left: 4px solid ${urgencyColor}; padding-left: 16px;">
                  <p class="linkedintel-list-title">${this.escapeHtml(
                    this.stripCitations(painText)
                  )}</p>
                  ${
                    source
                      ? `<p class="linkedintel-list-text" style="margin-top: 8px; color: #868e96; font-size: 13px;">Source: ${this.escapeHtml(
                          this.stripCitations(source)
                        )}</p>`
                      : ''
                  }
                  ${
                    typeof pain === 'object'
                      ? `
                  <div class="linkedintel-list-meta" style="margin-top: 8px;">
                    <span class="linkedintel-sentiment ${
                      urgencyLevel === 'high'
                        ? 'hot'
                        : urgencyLevel === 'medium'
                        ? 'warm'
                        : 'cold'
                    }">
                      Urgency: ${urgencyLevel.toUpperCase()}
                    </span>
                  </div>
                  `
                      : ''
                  }
                  ${
                    solutionFit
                      ? `
                    <div class="linkedintel-info-box success" style="margin-top: 12px;">
                      <p class="linkedintel-info-text">💡 ${this.escapeHtml(
                        solutionFit
                      )}</p>
                    </div>
                  `
                      : ''
                  }
                </div>
              `
              })
              .join('')}
          </div>
        </div>
      `
    }

    // Technology Authority Details

    // Budget Cycle
    if (profile.budgetCycle && profile.budgetCycle.timing) {
      html += `
        <div class="linkedintel-section" style="margin-top: 20px;">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <h3 class="linkedintel-section-title">Date: Budget Cycle</h3>
          </div>
          <div class="linkedintel-info-box" style="background: linear-gradient(135deg, #fff3cd 0%, #ffecb5 100%);">
            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
              <div>
                <p style="font-size: 12px; color: #856404; font-weight: 600; margin-bottom: 4px;">Timing:</p>
                <p style="font-size: 14px; color: #212529;">${this.escapeHtml(
                  profile.budgetCycle.timing || 'N/A'
                )}</p>
              </div>
              <div>
                <p style="font-size: 12px; color: #856404; font-weight: 600; margin-bottom: 4px;">Fiscal Year:</p>
                <p style="font-size: 14px; color: #212529;">${this.escapeHtml(
                  profile.budgetCycle.fiscalYear || 'N/A'
                )}</p>
              </div>
            </div>
          </div>
        </div>
      `
    }

    return html
  }

  // Activity Tab
  generateActivityContent(profile) {
    let html = ''

    // Recent LinkedIn Activity
    if (
      profile.recentLinkedInActivity &&
      profile.recentLinkedInActivity.length > 0
    ) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <h3 class="linkedintel-section-title">LinkedIn Activity</h3>
          </div>
          <div class="linkedintel-list">
            ${profile.recentLinkedInActivity
              .map(
                (activity) => `
              <div class="linkedintel-list-item">
                <p class="linkedintel-list-text">${this.escapeHtml(
                  activity.content || ''
                )}</p>
                ${
                  activity.date
                    ? `
                  <div class="linkedintel-list-meta">
                    <span>Date: ${activity.date}</span>
                    ${
                      activity.engagement
                        ? `<span>💬 ${activity.engagement}</span>`
                        : ''
                    }
                  </div>
                `
                    : ''
                }
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Recent Achievements
    if (profile.recentAchievements && profile.recentAchievements.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <h3 class="linkedintel-section-title">Achievements</h3>
          </div>
          <div class="linkedintel-list">
            ${profile.recentAchievements
              .map(
                (achievement) => `
              <div class="linkedintel-list-item">
                <div class="linkedintel-list-header">
                  <p class="linkedintel-list-title">${this.escapeHtml(
                    achievement.achievement || ''
                  )}</p>
                  ${
                    achievement.impact
                      ? `<span class="linkedintel-sentiment positive">${achievement.impact}</span>`
                      : ''
                  }
                </div>
                ${
                  achievement.date
                    ? `
                  <div class="linkedintel-list-meta">
                    <span>Date: ${achievement.date}</span>
                  </div>
                `
                    : ''
                }
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Specific Quotes
    if (profile.specificQuotes && profile.specificQuotes.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 21h18M3 10h18M3 7l9-4 9 4M3 17h18"/>
            </svg>
            <h3 class="linkedintel-section-title">Notable Quotes</h3>
          </div>
          <div class="linkedintel-list">
            ${profile.specificQuotes
              .map(
                (quoteObj) => `
              <div class="linkedintel-list-item">
                <p class="linkedintel-list-text" style="font-style: italic; border-left: 3px solid #4c6ef5; padding-left: 12px;">
                  "${this.escapeHtml(quoteObj.quote || '')}"
                </p>
                <div class="linkedintel-list-meta">
                  ${
                    quoteObj.source
                      ? `<span>Source: ${this.escapeHtml(
                          quoteObj.source
                        )}</span>`
                      : ''
                  }
                  ${quoteObj.date ? `<span>Date: ${quoteObj.date}</span>` : ''}
                </div>
                ${
                  quoteObj.context
                    ? `
                  <p class="linkedintel-list-text" style="margin-top: 8px; font-size: 12px; color: #868e96;">
                    Context: ${this.escapeHtml(
                      this.stripCitations(quoteObj.context)
                    )}
                  </p>
                `
                    : ''
                }
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Industry Influence
    if (profile.industryInfluence && profile.industryInfluence.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <h3 class="linkedintel-section-title">Industry Influence</h3>
          </div>
          <div class="linkedintel-list">
            ${profile.industryInfluence
              .map(
                (influence) => `
              <div class="linkedintel-list-item">
                <div class="linkedintel-list-header">
                  <p class="linkedintel-list-title">${this.escapeHtml(
                    influence.event || ''
                  )}</p>
                  <span class="linkedintel-sentiment positive">${this.escapeHtml(
                    influence.type || 'Event'
                  )}</span>
                </div>
                ${
                  influence.topic
                    ? `<p class="linkedintel-list-text">Topic: ${this.escapeHtml(
                        influence.topic
                      )}</p>`
                    : ''
                }
                ${
                  influence.role
                    ? `<p class="linkedintel-list-text" style="margin-top: 4px;">Role: ${this.escapeHtml(
                        influence.role
                      )}</p>`
                    : ''
                }
                ${
                  influence.date
                    ? `
                  <div class="linkedintel-list-meta">
                    <span>Date: ${influence.date}</span>
                  </div>
                `
                    : ''
                }
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
    }

    return (
      html ||
      '<div class="linkedintel-empty-state"><svg class="linkedintel-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg><p class="linkedintel-empty-text">No activity data available</p></div>'
    )
  }

  // Contact Strategy Tab
  generateContactStrategy(profile) {
    let html = ''

    // Contact Recommendation Banner
    if (profile.contactRecommendation) {
      const rec = profile.contactRecommendation
      const getPriorityColor = (timing) => {
        if (timing && timing.toLowerCase().includes('immediate')) {
          return {
            bg: '#20c997',
            darkBg: '#0ca678',
            icon: '🎯',
            label: 'IMMEDIATE',
          }
        }
        if (timing && timing.toLowerCase().includes('high')) {
          return {
            bg: '#20c997',
            darkBg: '#0ca678',
            icon: '✓',
            label: 'HIGH PRIORITY',
          }
        }
        if (timing && timing.toLowerCase().includes('moderate')) {
          return {
            bg: '#fab005',
            darkBg: '#f59f00',
            icon: '●',
            label: 'MODERATE',
          }
        }
        return {
          bg: '#868e96',
          darkBg: '#495057',
          icon: '○',
          label: 'STANDARD',
        }
      }
      const priorityColor = getPriorityColor(rec.timing)

      html += `
        <div class="linkedintel-deal-banner" style="background: linear-gradient(135deg, ${
          priorityColor.bg
        } 0%, ${priorityColor.darkBg} 100%);">
          <div class="linkedintel-deal-verdict">${priorityColor.icon}</div>
          <div class="linkedintel-deal-content">
            <p class="linkedintel-deal-label">Contact Priority • ${
              priorityColor.label
            }</p>
            <p class="linkedintel-deal-explanation">${this.escapeHtml(
              this.stripCitations(
                rec.reasoning ||
                  rec.bestApproach ||
                  'Contact via email or LinkedIn'
              )
            )}</p>
          </div>
        </div>
      `
    }

    // Best Contact Times (Organized like company sections)
    if (profile.optimalContactTiming) {
      const timing = profile.optimalContactTiming
      html += `
        <div class="linkedintel-section" style="margin-top: 20px;">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <h3 class="linkedintel-section-title">Best Contact Times</h3>
          </div>
          <div class="linkedintel-info-box" style="background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
              ${
                timing.bestDays && timing.bestDays.length > 0
                  ? `
                <div>
                  <p style="font-size: 12px; color: #155724; font-weight: 600; margin-bottom: 4px;">Best Days:</p>
                  <p style="font-size: 14px; color: #212529;">${timing.bestDays.join(
                    ', '
                  )}</p>
                </div>
              `
                  : ''
              }
              ${
                timing.responseWindow
                  ? `
                <div>
                  <p style="font-size: 12px; color: #155724; font-weight: 600; margin-bottom: 4px;">Response Window:</p>
                  <p style="font-size: 14px; color: #212529;">${timing.responseWindow}</p>
                </div>
              `
                  : ''
              }
            </div>
            ${
              timing.activityPattern
                ? `
              <p style="margin-top: 12px; font-size: 13px; color: #155724; font-style: italic;">📊 ${this.escapeHtml(
                timing.activityPattern
              )}</p>
            `
                : ''
            }
          </div>
        </div>
      `
    } else {
      // Fallback message if no timing available
      html += `
        <div class="linkedintel-section" style="margin-top: 20px;">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <h3 class="linkedintel-section-title">Best Contact Times</h3>
          </div>
          <div class="linkedintel-info-box">
            <p class="linkedintel-info-text">
              <strong>Best Days:</strong><br>
              No recent LinkedIn activity detected in the last 60 days<br><br>
              <strong>Response Window:</strong> Unknown
            </p>
          </div>
        </div>
      `
    }

    // Contact Preferences (Organized like company sections)
    if (profile.contactPreferences) {
      const pref = profile.contactPreferences
      const accessibilityColor =
        pref.accessibility === 'high'
          ? '#20c997'
          : pref.accessibility === 'medium'
          ? '#fab005'
          : '#868e96'

      html += `
        <div class="linkedintel-section" style="margin-top: 20px;">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            <h3 class="linkedintel-section-title">Contact Preferences</h3>
          </div>
          <div class="linkedintel-info-box">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
              <div>
                <p style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 4px;">Accessibility:</p>
                <p style="font-size: 14px; color: ${accessibilityColor}; font-weight: 600; text-transform: capitalize;">${this.escapeHtml(
        pref.accessibility || 'medium'
      )}</p>
              </div>
              ${
                pref.preferredChannels && pref.preferredChannels.length > 0
                  ? `
                <div>
                  <p style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 4px;">Preferred Channels:</p>
                  <p style="font-size: 14px; color: #212529; text-transform: capitalize;">${pref.preferredChannels.join(
                    ', '
                  )}</p>
                </div>
              `
                  : ''
              }
              ${
                pref.responseRate
                  ? `
                <div>
                  <p style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 4px;">Response Rate:</p>
                  <p style="font-size: 14px; color: #212529; text-transform: capitalize;">${this.escapeHtml(
                    pref.responseRate
                  )}</p>
                </div>
              `
                  : ''
              }
            </div>
          </div>
        </div>
      `
    }

    return (
      html ||
      '<div class="linkedintel-empty-state"><svg class="linkedintel-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg><p class="linkedintel-empty-text">No contact strategy available</p></div>'
    )
  }

  // Generate Risk Signals Section (NEW - Negative Intelligence)
  generateRiskSignalsSection(challenges) {
    const hasTraditionalChallenges = challenges?.challenges?.length > 0
    const hasNegativeNews =
      challenges?.negativeNewsSummary &&
      challenges.negativeNewsSummary !==
        'No significant negative news found in the last 12 months.'
    const hasEarningsNews =
      challenges?.earningsCallNegativeNews &&
      (typeof challenges.earningsCallNegativeNews === 'string'
        ? challenges.earningsCallNegativeNews.length > 0
        : challenges.earningsCallNegativeNews?.summary)
    const hasLayoffs = challenges?.layoffNews?.hasLayoffs

    if (
      !challenges ||
      (!hasTraditionalChallenges &&
        !hasNegativeNews &&
        !hasEarningsNews &&
        !hasLayoffs)
    ) {
      return '' // No challenges to display
    }

    const getRiskColor = (level) => {
      switch (level) {
        case 'CRITICAL':
          return {
            bg: '#dc2626',
            light: '#fef2f2',
            icon: '🔴',
            border: '#ef4444',
          }
        case 'HIGH':
          return {
            bg: '#f59e0b',
            light: '#fffbeb',
            icon: '🟠',
            border: '#fbbf24',
          }
        case 'MEDIUM':
          return {
            bg: '#f59e0b',
            light: '#fffbeb',
            icon: '🟡',
            border: '#fbbf24',
          }
        case 'LOW':
          return {
            bg: '#10b981',
            light: '#f0fdf4',
            icon: '🟢',
            border: '#34d399',
          }
        default:
          return {
            bg: '#10b981',
            light: '#f0fdf4',
            icon: '🟢',
            border: '#34d399',
          }
      }
    }

    const color = getRiskColor('MEDIUM')

    let html = `
      <div class="linkedintel-section" style="margin-top: 16px;">
        <div class="linkedintel-section-header">
          <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <h3 class="linkedintel-section-title">Risk Signals</h3>
        </div>

        <!-- Risk Level Banner -->
        <div style="
          background: linear-gradient(135deg, ${color.bg}15 0%, ${
      color.light
    } 100%);
          border-left: 4px solid ${color.border};
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        ">
          <div style="display: flex; align-items: start; gap: 14px;">
            <div style="font-size: 32px; line-height: 1;">${color.icon}</div>
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <p style="
                  margin: 0;
                  font-size: 14px;
                  font-weight: 700;
                  color: ${color.bg};
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                ">
                  ${this.escapeHtml(
                    challenges.overallRiskLevel ||
                      challenges.riskLevel ||
                      'MEDIUM'
                  )} RISK
                </p>
              </div>
              <p               style="
                margin: 0;
                font-size: 13px;
                line-height: 1.6;
                color: #495057;
              ">
                ${this.escapeHtml(this.stripCitations(challenges.summary))}
              </p>
            </div>
          </div>
        </div>
    `

    // Negative Signals Timeline
    if (challenges.challenges && challenges.challenges.length > 0) {
      html += `
        <div class="linkedintel-card" style="
          margin-bottom: 16px;
          background: linear-gradient(135deg, #ffffff 0%, #fafafa 100%);
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
        ">
          <h4 style="
            margin: 0 0 16px 0;
            font-size: 14px;
            font-weight: 700;
            color: #1f2937;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            <svg style="width: 18px; height: 18px; color: #dc2626;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Challenges Detected (${challenges.challenges.length})
          </h4>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${challenges.challenges
              .map((signal) => {
                const severityColor =
                  signal.severity === 'CRITICAL'
                    ? '#dc2626'
                    : signal.severity === 'HIGH'
                    ? '#ea580c'
                    : signal.severity === 'MEDIUM'
                    ? '#f59e0b'
                    : '#10b981'

                const severityGradient =
                  signal.severity === 'CRITICAL'
                    ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                    : signal.severity === 'HIGH'
                    ? 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)'
                    : signal.severity === 'MEDIUM'
                    ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                    : 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'

                const categoryEmoji =
                  {
                    workforce: '👥',
                    financial: '💰',
                    operational: '⚙️',
                    legal: '⚖️',
                    market: '📊',
                    reputation: '🏢',
                  }[signal.category] || '⚠️'

                return `
                  <div style="
                    background: #ffffff;
                    border: 1.5px solid ${severityColor}40;
                    border-radius: 10px;
                    padding: 14px 16px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                    transition: all 0.2s ease;
                  ">
                    <div style="display: flex; align-items: start; gap: 12px;">
                      <span style="
                        font-size: 24px;
                        line-height: 1;
                        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
                      ">${categoryEmoji}</span>
                      <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                          <span style="
                            background: ${severityGradient};
                            color: ${severityColor};
                            padding: 4px 10px;
                            border-radius: 6px;
                            font-size: 11px;
                            font-weight: 700;
                            text-transform: uppercase;
                            border: 1px solid ${severityColor}30;
                            box-shadow: 0 1px 2px ${severityColor}20;
                          ">
                            ${signal.severity}
                          </span>
                          <span style="
                            font-size: 12px;
                            color: #6b7280;
                            font-weight: 600;
                            background: #f3f4f6;
                            padding: 3px 8px;
                            border-radius: 5px;
                          ">
                            ${signal.date} • ${signal.category}
                          </span>
                        </div>
                        <p style="
                          margin: 0 0 10px 0;
                          font-size: 13px;
                          font-weight: 600;
                          color: #111827;
                          line-height: 1.5;
                        ">
                          ${this.escapeHtml(
                            this.stripCitations(signal.description)
                          )}
                        </p>
                        ${
                          signal.source
                            ? `
                          <div style="margin-top: 10px;">
                            <a href="${
                              signal.url || '#'
                            }" target="_blank" rel="noopener noreferrer" style="
                              font-size: 12px;
                              color: #4f46e5;
                              text-decoration: none;
                              font-weight: 600;
                              display: inline-flex;
                              align-items: center;
                              gap: 6px;
                              padding: 6px 10px;
                              background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
                              border-radius: 6px;
                              border: 1px solid #c7d2fe;
                              transition: all 0.2s ease;
                            ">
                              <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                              </svg>
                              ${this.escapeHtml(signal.source)}
                            </a>
                          </div>
                        `
                            : ''
                        }
                      </div>
                    </div>
                  </div>
                `
              })
              .join('')}
          </div>
        </div>
      `
    }

    // Positive Mitigators
    if (
      challenges.positiveMitigators &&
      challenges.positiveMitigators.length > 0
    ) {
      html += `
        <div class="linkedintel-card" style="
          background: linear-gradient(135deg, #10b98108 0%, #10b98104 100%);
          border-left: 3px solid #10b981;
          margin-bottom: 16px;
        ">
          <h4 style="
            margin: 0 0 10px 0;
            font-size: 13px;
            font-weight: 700;
            color: #059669;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">
            ✅ Positive Mitigators
          </h4>
          <ul style="
            margin: 0;
            padding-left: 20px;
            list-style: none;
          ">
            ${challenges.positiveMitigators
              .map(
                (factor) => `
              <li style="
                position: relative;
                margin-bottom: 6px;
                font-size: 13px;
                color: #495057;
                line-height: 1.5;
                padding-left: 8px;
              ">
                <span style="
                  position: absolute;
                  left: -12px;
                  color: #10b981;
                  font-weight: 700;
                ">✓</span>
                ${this.escapeHtml(factor)}
              </li>
            `
              )
              .join('')}
          </ul>
        </div>
      `
    }

    // Deal Impact Assessment
    if (challenges.dealImpact) {
      const impact = challenges.dealImpact
      html += `
        <div class="linkedintel-card">
          <h4 style="
            margin: 0 0 12px 0;
            font-size: 13px;
            font-weight: 700;
            color: #212529;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">
            📊 Deal Impact Analysis
          </h4>
          <div style="display: grid; gap: 10px;">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 14px 16px;
              background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
              border: 1px solid #e5e7eb;
              border-radius: 10px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
              transition: all 0.2s ease;
            ">
              <span style="font-size: 13px; font-weight: 600; color: #374151; display: flex; align-items: center; gap: 6px;">
                <svg style="width: 16px; height: 16px; color: #6b7280;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2v20M2 12h20"></path>
                </svg>
                Budget Availability
              </span>
              <span style="
                font-size: 13px;
                font-weight: 700;
                padding: 4px 12px;
                border-radius: 6px;
                background: ${
                  impact.budgetAvailability === 'STRONG'
                    ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                    : impact.budgetAvailability === 'MODERATE'
                    ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                    : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                };
                color: ${
                  impact.budgetAvailability === 'STRONG'
                    ? '#065f46'
                    : impact.budgetAvailability === 'MODERATE'
                    ? '#92400e'
                    : '#991b1b'
                };
              ">
                ${impact.budgetAvailability}
              </span>
            </div>
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 14px 16px;
              background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
              border: 1px solid #e5e7eb;
              border-radius: 10px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
              transition: all 0.2s ease;
            ">
              <span style="font-size: 13px; font-weight: 600; color: #374151; display: flex; align-items: center; gap: 6px;">
                <svg style="width: 16px; height: 16px; color: #6b7280;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Decision Speed
              </span>
              <span style="
                font-size: 13px;
                font-weight: 700;
                padding: 4px 12px;
                border-radius: 6px;
                background: ${
                  impact.decisionSpeed === 'FAST'
                    ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                    : impact.decisionSpeed === 'SLOW'
                    ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                    : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
                };
                color: ${
                  impact.decisionSpeed === 'FAST'
                    ? '#065f46'
                    : impact.decisionSpeed === 'SLOW'
                    ? '#92400e'
                    : '#4b5563'
                };
              ">
                ${impact.decisionSpeed}
              </span>
            </div>
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 14px 16px;
              background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
              border: 1px solid #e5e7eb;
              border-radius: 10px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
              transition: all 0.2s ease;
            ">
              <span style="font-size: 13px; font-weight: 600; color: #374151; display: flex; align-items: center; gap: 6px;">
                <svg style="width: 16px; height: 16px; color: #6b7280;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Success Probability
              </span>
              <span style="
                font-size: 13px;
                font-weight: 700;
                padding: 4px 12px;
                border-radius: 6px;
                background: ${
                  impact.successProbability === 'HIGH'
                    ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                    : impact.successProbability === 'LOW'
                    ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                    : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                };
                color: ${
                  impact.successProbability === 'HIGH'
                    ? '#065f46'
                    : impact.successProbability === 'LOW'
                    ? '#991b1b'
                    : '#1e40af'
                };
              ">
                ${impact.successProbability}
              </span>
            </div>
          </div>
          ${
            impact.recommendedApproach
              ? `
            <div style="
              margin-top: 16px;
              padding: 16px;
              background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
              border: 1px solid #c7d2fe;
              border-left: 4px solid #6366f1;
              border-radius: 10px;
              box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
            ">
              <p style="
                margin: 0;
                font-size: 13px;
                color: #1e1b4b;
                line-height: 1.6;
              ">
                <strong style="
                  color: #4338ca;
                  font-weight: 700;
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  margin-bottom: 8px;
                ">
                  <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                  Recommended Approach
                </strong>
                ${this.escapeHtml(
                  this.stripCitations(impact.recommendedApproach)
                )}
              </p>
            </div>
          `
              : ''
          }
        </div>
      `
    }

    html += `</div>`
    return html
  }

  // Company Overview Tab
  generateCompanyOverview(data) {
    const companyName = data.companyName || data.name || 'Company'
    let html = `
      <div class="linkedintel-hero-card company">
        <h1 class="linkedintel-hero-name">${this.escapeHtml(companyName)}</h1>
        ${
          data.industry
            ? `<p class="linkedintel-hero-subtitle">${this.escapeHtml(
                data.industry
              )}</p>`
            : ''
        }
        ${
          data.location
            ? `<p class="linkedintel-hero-meta">Location: ${this.escapeHtml(
                data.location
              )}</p>`
            : ''
        }
    `

    // Stock Info Stats with Performance Trend
    if (data.overview && data.overview.isPublic) {
      const isSubsidiary = this.isSubsidiary(data)
      const parentCompany = this.getParentCompany(data)

      html += `
        ${
          isSubsidiary && parentCompany
            ? `
          <div class="linkedintel-subsidiary-notice" style="background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 12px 16px; margin: 12px 0; display: flex; align-items: flex-start; gap: 12px; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);">
            <span style="font-size: 24px; line-height: 1;">ℹ️</span>
            <div style="flex: 1;">
              <div style="font-size: 13px; font-weight: 600; color: #1e40af; margin-bottom: 4px;">
                📊 Parent Company Financial Data
              </div>
              <div style="font-size: 12px; color: #1e3a8a; line-height: 1.5;">
                <strong>${
                  data.companyName || 'This company'
                }</strong> is a division of <strong>${parentCompany}</strong>. 
                All financial metrics shown below are for the parent company <strong>${parentCompany}</strong>, not this specific division.
              </div>
            </div>
          </div>
        `
            : ''
        }
        <div class="linkedintel-hero-stats">
          ${
            data.stockInfo && data.stockInfo.symbol
              ? `
            <div class="linkedintel-stat-box">
              <p class="linkedintel-stat-label">Stock Symbol</p>
              <p class="linkedintel-stat-value">${data.stockInfo.symbol}</p>
            </div>
          `
              : ''
          }
          ${
            data.stockInfo && data.stockInfo.marketCap
              ? `
            <div class="linkedintel-stat-box">
              <p class="linkedintel-stat-label">Market Cap</p>
              <p class="linkedintel-stat-value">${data.stockInfo.marketCap}</p>
            </div>
          `
              : ''
          }
          ${
            data.stockInfo &&
            data.stockInfo.ytd !== undefined &&
            data.stockInfo.ytd !== null &&
            data.stockInfo.ytd !== 0
              ? `
            <div class="linkedintel-stat-box">
              <p class="linkedintel-stat-label">YTD Performance</p>
              <p class="linkedintel-stat-value ${
                data.stockInfo.ytd > 0 ? 'positive' : 'negative'
              }">${data.stockInfo.ytd > 0 ? '+' : ''}${data.stockInfo.ytd}%</p>
            </div>
          `
              : ''
          }
          ${
            data.overview.industry
              ? `
            <div class="linkedintel-stat-box">
              <p class="linkedintel-stat-label">Industry</p>
              <p class="linkedintel-stat-value">${this.escapeHtml(
                data.overview.industry
              )}</p>
            </div>
          `
              : ''
          }
          ${
            data.overview.employeeCount
              ? `
            <div class="linkedintel-stat-box">
              <p class="linkedintel-stat-label">Employees</p>
              <p class="linkedintel-stat-value">${data.overview.employeeCount.toLocaleString()}</p>
            </div>
          `
              : ''
          }
        </div>
      `

      // Stock Performance Trend - Concise inline version
      if (
        data.stockInfo.performanceTrend &&
        data.stockInfo.performanceTrend.context
      ) {
        const trend = data.stockInfo.performanceTrend
        const getTrendEmoji = (direction) => {
          if (direction === 'upward') return '📈'
          if (direction === 'downward') return '📉'
          return '📊'
        }

        html += `
          <div style="margin-top: 12px; padding: 10px 14px; background: rgba(255, 255, 255, 0.2); border-radius: 10px; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">${getTrendEmoji(
              trend.direction
            )}</span>
            <p style="margin: 0; font-size: 13px; line-height: 1.4; opacity: 0.95;">${this.escapeHtml(
              this.stripCitations(trend.context)
            )}</p>
          </div>
        `
      }
    } else if (data.overview && !data.overview.isPublic) {
      // Private Company Stats - Show Industry and Employee Count
      const showStats = data.overview.industry || data.overview.employeeCount

      if (showStats) {
        html += `
          <div class="linkedintel-hero-stats">
            ${
              data.overview.industry
                ? `
              <div class="linkedintel-stat-box">
                <p class="linkedintel-stat-label">Industry</p>
                <p class="linkedintel-stat-value">${this.escapeHtml(
                  data.overview.industry
                )}</p>
              </div>
            `
                : ''
            }
            ${
              data.overview.employeeCount
                ? `
              <div class="linkedintel-stat-box">
                <p class="linkedintel-stat-label">Employees</p>
                <p class="linkedintel-stat-value">${data.overview.employeeCount.toLocaleString()}</p>
              </div>
            `
                : ''
            }
          </div>
        `
      }
    }

    html += `</div>`

    // Risk Signals Section (NEW - Negative Intelligence)
    if (data.companyChallenges) {
      html += this.generateRiskSignalsSection(data.companyChallenges)
    }

    // Company Momentum Analysis - Condensed and Scannable
    if (data.companyMomentum && data.companyMomentum.trajectory !== 'stable') {
      const momentum = data.companyMomentum
      const getMomentumColor = (trajectory) => {
        if (trajectory === 'accelerating' || trajectory === 'improving')
          return { bg: '#20c997', dark: '#0ca678', emoji: '🚀' }
        if (trajectory === 'declining' || trajectory === 'deteriorating')
          return { bg: '#fa5252', dark: '#e03131', emoji: '⚠️' }
        return { bg: '#868e96', dark: '#495057', emoji: '📊' }
      }
      const colors = getMomentumColor(momentum.trajectory)

      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
            <h3 class="linkedintel-section-title">Company Momentum Analysis</h3>
          </div>
          
          <div class="linkedintel-info-box" style="background: linear-gradient(135deg, ${
            colors.bg
          }10 0%, ${colors.dark}15 100%); border-left: 4px solid ${colors.bg};">
            <div style="display: flex; align-items: start; gap: 12px;">
              <div style="font-size: 28px; line-height: 1;">${
                colors.emoji
              }</div>
              <div style="flex: 1;">
                <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: ${
                  colors.dark
                }; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${this.escapeHtml(
                    momentum.trajectory
                  )} <span style="opacity: 0.6; font-weight: 500; text-transform: lowercase;">(${this.escapeHtml(
        momentum.confidence
      )} confidence)</span>
                </p>
                ${
                  momentum.summary
                    ? `<p style="margin: 0; font-size: 13px; line-height: 1.5; color: #495057;">${this.escapeHtml(
                        this.stripCitations(momentum.summary)
                      )}</p>`
                    : ''
                }
              </div>
            </div>
            
            ${
              momentum.indicators && momentum.indicators.length > 0
                ? `
              <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid ${
                colors.bg
              }30;">
                <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #868e96; text-transform: uppercase; letter-spacing: 0.5px;">Top 3 Indicators</p>
                <div style="display: grid; gap: 6px;">
                  ${momentum.indicators
                    .slice(0, 3)
                    .map((indicator) => {
                      if (typeof indicator === 'string') {
                        const parts = indicator.split(':')
                        const label = parts[0]
                        const value = parts.slice(1).join(':').trim()
                        return `<div style="display: flex; gap: 8px; align-items: baseline;">
                        <span style="flex-shrink: 0; color: ${
                          colors.bg
                        }; font-weight: 700;">•</span>
                        <p style="margin: 0; font-size: 12px; color: #212529;"><strong>${this.escapeHtml(
                          label
                        )}:</strong> ${this.escapeHtml(value)}</p>
                      </div>`
                      }
                      const metric = indicator.metric || 'Indicator'
                      const evidence =
                        indicator.evidence || indicator.trend || ''
                      return `<div style="display: flex; gap: 8px; align-items: baseline;">
                      <span style="flex-shrink: 0; color: ${
                        colors.bg
                      }; font-weight: 700;">•</span>
                      <p style="margin: 0; font-size: 12px; color: #212529;"><strong>${this.escapeHtml(
                        metric
                      )}:</strong> ${this.escapeHtml(evidence)}</p>
                    </div>`
                    })
                    .join('')}
                </div>
              </div>
            `
                : ''
            }

            ${
              momentum.implications && momentum.implications.timing
                ? `
              <div style="margin-top: 14px; padding: 10px 12px; background: rgba(76, 110, 245, 0.08); border-radius: 8px;">
                <p style="margin: 0; font-size: 12px; color: #4c6ef5; font-weight: 600;">💡 ${this.escapeHtml(
                  momentum.implications.timing
                )}</p>
              </div>
            `
                : ''
            }
          </div>
        </div>
      `
    }

    // Deal Confidence Assessment (PREMIUM)
    if (data.dealConfidence) {
      const verdict = data.dealConfidence.verdict || 'MAYBE'
      const confidence = data.dealConfidence.confidence || 'MEDIUM'
      const getVerdictColor = (verdict) => {
        if (verdict === 'DEAL')
          return { bg: '#20c997', darkBg: '#0ca678', icon: '✓', label: 'DEAL' }
        if (verdict === 'MAYBE')
          return { bg: '#fab005', darkBg: '#f59f00', icon: '⚠', label: 'MAYBE' }
        return { bg: '#fa5252', darkBg: '#e03131', icon: '✗', label: 'NO DEAL' }
      }
      const verdictColor = getVerdictColor(verdict)

      html += `
        <div class="linkedintel-deal-banner" style="background: linear-gradient(135deg, ${
          verdictColor.bg
        } 0%, ${verdictColor.darkBg} 100%);">
          <div class="linkedintel-deal-verdict">${verdictColor.icon}</div>
          <div class="linkedintel-deal-content">
            <p class="linkedintel-deal-label">Deal Assessment • ${
              verdictColor.label
            } • ${confidence} Confidence</p>
            <p class="linkedintel-deal-explanation">${this.escapeHtml(
              this.stripCitations(
                data.dealConfidence.reasoning ||
                  'Assessment based on budget, timing, and pain points'
              )
            )}</p>
          </div>
        </div>
      `

      // Key Factors Breakdown (Budget, Timing, Pain Points, Growth)
      if (data.dealConfidence.keyFactors) {
        const kf = data.dealConfidence.keyFactors
        html += `<div class="linkedintel-section">`

        // Budget
        if (kf.budget) {
          html += `
            <div class="linkedintel-info-box ${
              kf.budget.status === 'STRONG'
                ? 'success'
                : kf.budget.status === 'WEAK'
                ? 'danger'
                : ''
            }">
              <p class="linkedintel-info-title">Budget: ${this.escapeHtml(
                kf.budget.status || 'UNKNOWN'
              )}</p>
              <p class="linkedintel-info-text">
                ${(kf.budget.evidence || [])
                  .map((e) => '• ' + this.escapeHtml(e))
                  .join('<br>')}
              </p>
            </div>
          `
        }

        // Timing
        if (kf.timing) {
          html += `
            <div class="linkedintel-info-box ${
              kf.timing.status === 'URGENT'
                ? 'success'
                : kf.timing.status === 'POOR'
                ? 'danger'
                : ''
            }" style="margin-top: 12px;">
              <p class="linkedintel-info-title">Timing: ${this.escapeHtml(
                kf.timing.status || 'NEUTRAL'
              )}</p>
              <p class="linkedintel-info-text">
                ${(kf.timing.evidence || [])
                  .map((e) => '• ' + this.escapeHtml(e))
                  .join('<br>')}
              </p>
            </div>
          `
        }

        // Pain Points
        if (kf.painPoints && kf.painPoints.length > 0) {
          html += `
            <div class="linkedintel-info-box" style="margin-top: 12px;">
              <p class="linkedintel-info-title">Pain Points</p>
              ${kf.painPoints
                .map(
                  (pp) =>
                    '<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1);">' +
                    '<p class="linkedintel-info-text"><strong>' +
                    this.escapeHtml(this.stripCitations(pp.problem)) +
                    '</strong></p>' +
                    '<p class="linkedintel-info-text" style="font-size: 12px; color: #868e96; margin-top: 4px;">' +
                    'Source: ' +
                    this.escapeHtml(pp.source || 'Unknown') +
                    '<br>' +
                    'Urgency: ' +
                    this.escapeHtml(pp.urgency || 'Medium') +
                    '<br>' +
                    (pp.ourFit
                      ? 'Fit: ' +
                        this.escapeHtml(this.stripCitations(pp.ourFit))
                      : '') +
                    '</p></div>'
                )
                .join('')}
            </div>
          `
        }

        // Growth
        if (kf.growth) {
          html += `
            <div class="linkedintel-info-box ${
              kf.growth.status === 'RAPID' ? 'success' : ''
            }" style="margin-top: 12px;">
              <p class="linkedintel-info-title">Growth: ${this.escapeHtml(
                kf.growth.status || 'STABLE'
              )}</p>
              <p class="linkedintel-info-text">
                ${(kf.growth.evidence || [])
                  .map((e) => '• ' + this.escapeHtml(e))
                  .join('<br>')}
              </p>
            </div>
          `
        }

        html += `</div>`
      }

      // Action Plan (Premium Feature)
      if (data.dealConfidence.actionPlan) {
        const ap = data.dealConfidence.actionPlan
        html += `
          <div class="linkedintel-section">
            <div class="linkedintel-section-header">
              <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <h3 class="linkedintel-section-title">Action Plan</h3>
            </div>
            <div class="linkedintel-info-box success">
              <p class="linkedintel-info-title">Priority: ${this.escapeHtml(
                ap.priority || 'STANDARD'
              )}</p>
              <p class="linkedintel-info-text">
                <strong>Contact Within:</strong> ${this.escapeHtml(
                  ap.contactWithin || 'This week'
                )}<br>
                <strong>Primary Targets:</strong> ${(
                  ap.primaryTargets || []
                ).join(', ')}<br>
                <strong>Opening Line:</strong> ${this.escapeHtml(
                  ap.openingLine || ''
                )}<br>
                <strong>Value Prop:</strong> ${this.escapeHtml(
                  ap.valueProposition || ''
                )}<br>
                <strong>Expected Outcome:</strong> ${this.escapeHtml(
                  ap.expectedOutcome || ''
                )}
              </p>
            </div>
          </div>
        `
      }

      // Risk Factors
      if (
        data.dealConfidence.riskFactors &&
        data.dealConfidence.riskFactors.length > 0
      ) {
        html += `
          <div class="linkedintel-section">
            <div class="linkedintel-section-header">
              <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <h3 class="linkedintel-section-title">Risk Factors</h3>
            </div>
            <div class="linkedintel-list">
              ${data.dealConfidence.riskFactors
                .map(
                  (rf) =>
                    '<div class="linkedintel-list-item">' +
                    '<p class="linkedintel-list-text"><strong>Risk: ' +
                    this.escapeHtml(rf.risk || rf) +
                    '</strong></p>' +
                    (rf.mitigation
                      ? '<p class="linkedintel-list-text" style="margin-top: 4px; font-size: 12px; color: #20c997;">Mitigation: ' +
                        this.escapeHtml(this.stripCitations(rf.mitigation)) +
                        '</p>'
                      : '') +
                    '</div>'
                )
                .join('')}
            </div>
          </div>
        `
      }
    }

    // Description
    if (data.description) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <h3 class="linkedintel-section-title">About</h3>
          </div>
          <p class="linkedintel-list-text">${this.escapeHtml(
            this.stripCitations(data.description)
          )}</p>
        </div>
      `
    }

    return html
  }

  // Company Trends & Posts Tab (NEW - Premium Feature)
  generateCompanyTrends(data) {
    let html = ''
    const trends = data.companyTrends || {}

    // Recent Company Posts
    if (trends.recentPosts && trends.recentPosts.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <h3 class="linkedintel-section-title">Recent Company Posts</h3>
          </div>
          <div class="linkedintel-list">
            ${trends.recentPosts
              .map(
                (post) => `
              <div class="linkedintel-list-item">
                <div class="linkedintel-list-header">
                  <p class="linkedintel-list-title">${this.escapeHtml(
                    post.type || 'Post'
                  )
                    .replace(/_/g, ' ')
                    .toUpperCase()}</p>
                  <span class="linkedintel-sentiment ${
                    post.engagement === 'high'
                      ? 'hot'
                      : post.engagement === 'medium'
                      ? 'warm'
                      : 'cold'
                  }">${this.escapeHtml(
                  post.engagement || 'medium'
                ).toUpperCase()}</span>
                </div>
                ${
                  post.content
                    ? `<p class="linkedintel-list-text" style="font-style: italic; margin-top: 8px;">"${this.escapeHtml(
                        post.content
                      )}"</p>`
                    : ''
                }
                ${
                  post.date
                    ? `<div class="linkedintel-list-meta"><span>Date: ${post.date}</span></div>`
                    : ''
                }
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Executive Posts
    if (trends.executivePosts && trends.executivePosts.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <h3 class="linkedintel-section-title">Executive Thought Leadership</h3>
          </div>
          <div class="linkedintel-list">
            ${trends.executivePosts
              .map(
                (post) => `
              <div class="linkedintel-list-item">
                <div class="linkedintel-list-header">
                  <p class="linkedintel-list-title">${this.escapeHtml(
                    post.executive || 'Executive'
                  )}</p>
                  ${
                    post.date
                      ? `<span class="linkedintel-badge">Date: ${post.date}</span>`
                      : ''
                  }
                </div>
                ${
                  post.topic
                    ? `<p class="linkedintel-list-text" style="font-weight: 600; margin-top: 8px;">Topic: ${this.escapeHtml(
                        post.topic
                      )}</p>`
                    : ''
                }
                ${
                  post.excerpt
                    ? `<p class="linkedintel-list-text" style="font-style: italic; margin-top: 8px; padding-left: 12px; border-left: 3px solid #4c6ef5;">"${this.escapeHtml(
                        post.excerpt
                      )}"</p>`
                    : ''
                }
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Trending Topics
    if (trends.trendingTopics && trends.trendingTopics.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <h3 class="linkedintel-section-title">Trending Topics</h3>
          </div>
          <div class="linkedintel-tags">
            ${trends.trendingTopics
              .map(
                (topic) => `
              <div class="linkedintel-tag" style="cursor: default;">
                ${this.escapeHtml(topic.topic || 'Topic')}
                ${
                  topic.frequency
                    ? `<span style="margin-left: 6px; opacity: 0.7; font-size: 11px;">(${this.escapeHtml(
                        topic.frequency
                      )})</span>`
                    : ''
                }
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Cultural Insights
    if (trends.culturalInsights) {
      const cultural = trends.culturalInsights
      const hasContent =
        (cultural.values && cultural.values.length > 0) ||
        cultural.workStyle ||
        cultural.teamFocus ||
        (cultural.hiringFocus && cultural.hiringFocus.length > 0)

      if (hasContent) {
        html += `
          <div class="linkedintel-section">
            <div class="linkedintel-section-header">
              <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <h3 class="linkedintel-section-title">Cultural Insights</h3>
            </div>
            <div class="linkedintel-info-box">
              ${
                cultural.values && cultural.values.length > 0
                  ? `
                <p class="linkedintel-info-text"><strong>Values:</strong> ${cultural.values.join(
                  ', '
                )}</p>
              `
                  : ''
              }
              ${
                cultural.workStyle
                  ? `
                <p class="linkedintel-info-text" style="margin-top: 8px;"><strong>Work Style:</strong> ${this.escapeHtml(
                  cultural.workStyle
                )}</p>
              `
                  : ''
              }
              ${
                cultural.teamFocus
                  ? `
                <p class="linkedintel-info-text" style="margin-top: 8px;"><strong>Team Focus:</strong> ${this.escapeHtml(
                  cultural.teamFocus
                )}</p>
              `
                  : ''
              }
              ${
                cultural.hiringFocus && cultural.hiringFocus.length > 0
                  ? `
                <p class="linkedintel-info-text" style="margin-top: 8px;"><strong>Hiring Focus:</strong> ${cultural.hiringFocus.join(
                  ', '
                )}</p>
              `
                  : ''
              }
            </div>
          </div>
        `
      }
    }

    // Engagement Level - REMOVED (subjective metric)
    // Replaced with factual posting frequency data shown in Recent Activity section

    // Process citation markers and append footnotes if we have content
    if (html) {
      html = this.renderCitationMarkers(html)
      html += this.generateCitationFootnotes()
    }

    return (
      html ||
      '<div class="linkedintel-empty-state"><svg class="linkedintel-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg><p class="linkedintel-empty-text">No recent public posts or trends found</p><p class="linkedintel-empty-subtext" style="font-size: 13px; color: #6b7280; margin-top: 8px;">LinkedIn posts require authentication. Showing publicly available news mentions instead.</p></div>'
    )
  }

  // Company Intelligence - SDR Conversation Tools
  generateCompanyIntelligence(intelligence) {
    if (!intelligence) return ''

    let html = ''

    const hasAnyData =
      intelligence.painPoints?.length ||
      intelligence.recentActivities?.length ||
      intelligence.industryContext ||
      intelligence.executiveQuotes?.length

    if (!hasAnyData) return ''

    // Pain Points Aggregation
    if (intelligence.painPoints && intelligence.painPoints.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <h3 class="linkedintel-section-title">🎯 Pain Points</h3>
          </div>
          <div class="linkedintel-pain-points">
            ${intelligence.painPoints
              .slice(0, 5)
              .map(
                (point) => `
                <div class="linkedintel-pain-point-tag">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  ${this.escapeHtml(point)}
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Recent Activities
    if (
      intelligence.recentActivities &&
      intelligence.recentActivities.length > 0
    ) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <h3 class="linkedintel-section-title">📊 Recent Activities</h3>
          </div>
          <div class="linkedintel-activities">
            ${intelligence.recentActivities
              .slice(0, 5)
              .map(
                (activity) => `
                <div class="linkedintel-activity-item">
                  <div class="linkedintel-activity-bullet"></div>
                  <div class="linkedintel-activity-text">${this.escapeHtml(
                    this.stripCitations(activity)
                  )}</div>
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Industry Context
    if (intelligence.industryContext) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18"/>
            </svg>
            <h3 class="linkedintel-section-title">🏭 Industry Context</h3>
          </div>
          <div class="linkedintel-context-box">
            ${this.escapeHtml(
              this.stripCitations(intelligence.industryContext)
            )}
          </div>
        </div>
      `
    }

    // Executive Quotes
    if (
      intelligence.executiveQuotes &&
      intelligence.executiveQuotes.length > 0
    ) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            <h3 class="linkedintel-section-title">💭 Executive Quotes</h3>
          </div>
          <div class="linkedintel-quotes">
            ${intelligence.executiveQuotes
              .slice(0, 3)
              .map(
                (quoteObj) => `
                <div class="linkedintel-quote-card">
                  <div class="linkedintel-quote-mark">"</div>
                  <div class="linkedintel-quote-text">${this.escapeHtml(
                    this.stripCitations(quoteObj.quote)
                  )}</div>
                  ${
                    quoteObj.executive
                      ? `
                    <div class="linkedintel-quote-attribution">
                      — ${this.escapeHtml(quoteObj.executive)}
                      ${
                        quoteObj.source
                          ? `<span class="linkedintel-quote-source">(${this.escapeHtml(
                              this.stripCitations(quoteObj.source)
                            )})</span>`
                          : ''
                      }
                      ${
                        quoteObj.date
                          ? `<span class="linkedintel-quote-date">${this.escapeHtml(
                              quoteObj.date
                            )}</span>`
                          : ''
                      }
                    </div>
                  `
                      : ''
                  }
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Process citation markers and append footnotes
    return html
  }

  // Intelligence Tab - FLASH CARDS SHOWCASE
  generateIntelligenceContent(data) {
    let html = ''

    // Quick Stats Grid - Key Metrics at a Glance
    const hasStats =
      data.stockInfo || data.techStack?.length || data.growthEvents?.length
    if (hasStats) {
      html += `
        <div class="linkedintel-stats-grid">
          ${
            this.isPublicCompany(data) &&
            data.stockInfo.ytd !== null &&
            data.stockInfo.ytd !== undefined
              ? `
            <div class="linkedintel-stat-card">
              <div class="linkedintel-stat-card-value ${
                data.stockInfo.ytd > 0 ? 'positive' : 'negative'
              }">
                ${data.stockInfo.ytd > 0 ? '+' : ''}${data.stockInfo.ytd}%
              </div>
              <div class="linkedintel-stat-card-label">YTD Performance</div>
            </div>
          `
              : ''
          }
          ${
            data.techStack?.length
              ? `
            <div class="linkedintel-stat-card">
              <div class="linkedintel-stat-card-value">${data.techStack.length}</div>
              <div class="linkedintel-stat-card-label">Tech Tools</div>
            </div>
          `
              : ''
          }
          ${
            data.growthEvents?.length
              ? `
            <div class="linkedintel-stat-card">
              <div class="linkedintel-stat-card-value">${data.growthEvents.length}</div>
              <div class="linkedintel-stat-card-label">Growth Events</div>
            </div>
          `
              : ''
          }
        </div>
      `
    }

    // ⭐ TECH STACK FIRST - Most Actionable! ⭐
    if (data.techStack && data.techStack.length > 0) {
      // Sort by hiring intensity (HOT first, then WARM, then COLD)
      const sortedTechStack = [...data.techStack].sort((a, b) => {
        const intensityOrder = { HOT: 3, WARM: 2, COLD: 1 }
        return (
          (intensityOrder[b.hiringIntensity] || 0) -
          (intensityOrder[a.hiringIntensity] || 0)
        )
      })

      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <h3 class="linkedintel-section-title">💻 Tech Stack (${
              data.techStack.length
            })</h3>
          </div>
          <div class="linkedintel-tech-grid">
            ${sortedTechStack
              .slice(0, 30)
              .map((tech) => {
                const intensityClass = (
                  tech.hiringIntensity || 'COLD'
                ).toLowerCase()
                const intensityEmoji =
                  tech.hiringIntensity === 'HOT'
                    ? '🔥'
                    : tech.hiringIntensity === 'WARM'
                    ? '⚡'
                    : ''
                const hasMetadata = tech.jobsCount || tech.daysSinceLastPost

                return `
                  <div class="linkedintel-tech-card ${intensityClass}" title="${
                  hasMetadata
                    ? `${tech.jobsCount || 0} jobs, ${
                        tech.teamsCount || 0
                      } teams`
                    : tech.tool || tech.name
                }">
                    <div class="linkedintel-tech-name">${this.escapeHtml(
                      tech.tool || tech.name || 'Unknown'
                    )}</div>
                    ${
                      hasMetadata
                        ? `
                      <div class="linkedintel-tech-metadata">
                        ${
                          tech.jobsCount
                            ? `
                          <span class="linkedintel-tech-badge hiring">
                            ${intensityEmoji} ${tech.jobsCount} ${
                                tech.jobsCount === 1 ? 'job' : 'jobs'
                              }
                          </span>
                        `
                            : ''
                        }
                        ${
                          tech.daysSinceLastPost !== null &&
                          tech.daysSinceLastPost <= 30
                            ? `
                          <span class="linkedintel-tech-badge recency">
                            📅 ${tech.daysSinceLastPost}d ago
                          </span>
                        `
                            : ''
                        }
                      </div>
                    `
                        : ''
                    }
                  </div>
                `
              })
              .join('')}
            ${
              data.techStack.length > 30
                ? `<div class="linkedintel-tech-card more-indicator">
                    <div class="linkedintel-tech-name">+${
                      data.techStack.length - 30
                    } more</div>
                  </div>`
                : ''
            }
          </div>
        </div>
      `
    }

    // ⭐ COMPANY INTELLIGENCE - SDR Conversation Tools (Pain Points) ⭐
    if (data.companyIntelligence) {
      html += this.generateCompanyIntelligence(data.companyIntelligence)
    }

    // Growth Events Timeline - Enhanced Cards
    if (data.growthEvents && data.growthEvents.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
            <h3 class="linkedintel-section-title">📈 Growth Events (${
              data.growthEvents.length
            })</h3>
          </div>
          <div class="linkedintel-flash-cards">
            ${data.growthEvents
              .slice(0, 6)
              .map((event) => {
                const typeText = event.type || 'Event'
                const activityText = this.stripCitations(
                  event.activity ||
                    event.description ||
                    this.generateEventFallback(event)
                )
                const eventIcon = this.getEventIcon(event.type)
                const eventColor = this.getEventColor(event.type)
                const eventLabel = this.getEventLabel(event.type)

                return `
              <div class="linkedintel-flash-card" style="position: relative; overflow: hidden; border-left: 4px solid ${eventColor};">
                <div class="linkedintel-flash-card-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="linkedintel-flash-card-icon" style="font-size: 24px;">${eventIcon}</span>
                    <div>
                      <span class="linkedintel-flash-card-type" style="display: block; font-weight: 600; font-size: 14px; color: #1a1a1a;">${this.escapeHtml(
                        typeText
                      )}</span>
                      <span style="font-size: 11px; color: ${eventColor}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${eventLabel}</span>
                    </div>
                  </div>
                </div>
                <p class="linkedintel-flash-card-note" style="font-size: 13px; line-height: 1.6; color: #424242; margin: 0 0 12px 0; min-height: 40px;">${this.escapeHtml(
                  activityText
                )}</p>
                <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid #e0e0e0;">
                  ${
                    event.amount
                      ? `<span style="font-size: 13px; font-weight: 600; color: #2e7d32; background: #e8f5e9; padding: 4px 8px; border-radius: 4px;">💰 ${this.escapeHtml(
                          event.amount
                        )}</span>`
                      : '<span></span>'
                  }
                  ${
                    event.date
                      ? `<span style="font-size: 12px; color: #757575; display: flex; align-items: center; gap: 4px;">📅 ${new Date(
                          event.date
                        ).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}</span>`
                      : ''
                  }
                </div>
              </div>
            `
              })
              .join('')}
          </div>
        </div>
      `
    }

    // Process citation markers and append footnotes
    return html
  }

  // News & Signals Tab
  generateNewsSignals(data) {
    let html = ''

    // Recent News with Categories
    if (data.recentNews && data.recentNews.length > 0) {
      // Category badge helper
      const getCategoryBadge = (category) => {
        const categories = {
          financial_results: { label: 'Financial Results', color: '#228be6' },
          funding: { label: 'Funding', color: '#20c997' },
          partnership: { label: 'Partnership', color: '#7950f2' },
          leadership_change: { label: 'Leadership', color: '#f59f00' },
          product_launch: { label: 'Product Launch', color: '#15aabf' },
          market_expansion: { label: 'Market Expansion', color: '#12b886' },
          layoffs: { label: 'Layoffs', color: '#fa5252' },
          regulatory: { label: 'Regulatory', color: '#fd7e14' },
          recognition: { label: 'Recognition', color: '#e64980' },
        }
        const cat = categories[category] || {
          label: category,
          color: '#868e96',
        }
        return `<span class="linkedintel-badge" style="background-color: ${cat.color}20; color: ${cat.color}; border: 1px solid ${cat.color}40; font-size: 10px; padding: 2px 8px; border-radius: 4px; font-weight: 600; text-transform: uppercase;">${cat.label}</span>`
      }

      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
            <h3 class="linkedintel-section-title">Recent News (${
              data.recentNews.length
            })</h3>
          </div>
          <div class="linkedintel-list">
            ${data.recentNews
              .map(
                (news) => `
              <div class="linkedintel-list-item ${
                news.url ? 'clickable' : ''
              }" ${
                  news.url
                    ? `onclick="window.open('${news.url}', '_blank')"`
                    : ''
                }>
                <div class="linkedintel-list-header">
                  <p class="linkedintel-list-title">${this.escapeHtml(
                    news.title || ''
                  )}</p>
                  ${
                    news.sentiment
                      ? `<span class="linkedintel-sentiment ${news.sentiment}">${news.sentiment}</span>`
                      : ''
                  }
                </div>
                ${
                  news.category
                    ? `<div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
                        ${news.category ? getCategoryBadge(news.category) : ''}
                      </div>`
                    : ''
                }
                ${
                  news.summary
                    ? `<p class="linkedintel-list-text" style="margin-top: 8px;">${this.escapeHtml(
                        this.stripCitations(news.summary)
                      )}</p>`
                    : ''
                }
                <div class="linkedintel-list-meta">
                  ${news.date ? `<span>Date: ${news.date}</span>` : ''}
                  ${
                    news.source
                      ? `<span>Source: ${this.escapeHtml(news.source)}</span>`
                      : ''
                  }
                  ${
                    news.relevanceScore
                      ? `<span>Relevance: ${(news.relevanceScore * 100).toFixed(
                          0
                        )}%</span>`
                      : ''
                  }
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Buying Signals
    if (data.companyActivity && data.companyActivity.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <h3 class="linkedintel-section-title">Company Activity (${
              data.companyActivity.length
            })</h3>
          </div>
          <div class="linkedintel-list">
            ${data.companyActivity
              .map(
                (signal) => `
              <div class="linkedintel-list-item">
                <div class="linkedintel-list-header">
                  <p class="linkedintel-list-title">${this.escapeHtml(
                    signal.type || 'Signal'
                  ).toUpperCase()}</p>
                  ${
                    signal.strength
                      ? `<span class="linkedintel-sentiment ${signal.strength}">${signal.strength}</span>`
                      : ''
                  }
                </div>
                <p class="linkedintel-list-text">${this.escapeHtml(
                  this.stripCitations(signal.note || signal.description || '')
                )}</p>
                ${
                  signal.timestamp || signal.date
                    ? `<div class="linkedintel-list-meta">
                        <span>Date: ${signal.timestamp || signal.date}</span>
                      </div>`
                    : ''
                }
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Process citation markers and append footnotes if we have content
    if (html) {
      html = this.renderCitationMarkers(html)
      html += this.generateCitationFootnotes()
    }

    return (
      html ||
      '<div class="linkedintel-empty-state"><svg class="linkedintel-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg><p class="linkedintel-empty-text">No news or signals available</p></div>'
    )
  }

  // Decision Makers Tab
  generateDecisionMakers(data) {
    if (!data.priorityContacts || data.priorityContacts.length === 0) {
      return '<div class="linkedintel-empty-state"><svg class="linkedintel-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><p class="linkedintel-empty-text">No decision makers found</p></div>'
    }

    // Helper function to get country flag emoji
    const getCountryFlag = (countryCode) => {
      if (!countryCode || countryCode.length !== 2) return ''
      const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map((char) => 127397 + char.charCodeAt())
      return String.fromCodePoint(...codePoints)
    }

    // Helper function to get tenure badge class
    const getTenureBadgeClass = (category) => {
      if (category === 'NEW') return 'tenure-new'
      if (category === 'RECENT') return 'tenure-recent'
      if (category === 'ESTABLISHED') return 'tenure-established'
      return ''
    }

    return `
      <div class="linkedintel-list">
        ${data.priorityContacts
          .map(
            (contact) => `
          <div class="linkedintel-contact-card">
            <div class="linkedintel-contact-header">
              <div>
                <h4 class="linkedintel-contact-name">${this.escapeHtml(
                  contact.name || ''
                )}</h4>
                <p class="linkedintel-contact-title">${this.escapeHtml(
                  contact.title || ''
                )}</p>
                ${
                  contact.location || contact.country
                    ? `
                  <div class="linkedintel-contact-location">
                    ${
                      contact.countryCode
                        ? getCountryFlag(contact.countryCode) + ' '
                        : ''
                    }
                    ${
                      contact.location
                        ? this.escapeHtml(contact.location)
                        : this.escapeHtml(contact.country || '')
                    }
                  </div>
                `
                    : ''
                }
                ${
                  contact.tenure &&
                  contact.tenureCategory &&
                  contact.tenureCategory !== 'UNKNOWN'
                    ? `
                  <div class="linkedintel-tenure-badge ${getTenureBadgeClass(
                    contact.tenureCategory
                  )}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    ${contact.tenure} at company
                    ${contact.tenureCategory === 'NEW' ? ' 🆕' : ''}
                    ${contact.tenureCategory === 'RECENT' ? ' 🌱' : ''}
                    ${contact.tenureCategory === 'ESTABLISHED' ? ' 🏢' : ''}
                  </div>
                `
                    : ''
                }
              </div>
              ${
                contact.decisionMaker
                  ? `
                <span class="linkedintel-sentiment positive">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  Decision Maker
                </span>
              `
                  : ''
              }
            </div>
            ${
              contact.recentActivity
                ? `
              <p class="linkedintel-contact-meta">Recent: ${this.escapeHtml(
                contact.recentActivity
              )}</p>
            `
                : ''
            }
            ${
              contact.painPoints && contact.painPoints.length > 0
                ? `
              <div style="margin: 10px 0;">
                <p style="font-size: 12px; font-weight: 700; color: #495057; margin: 0 0 6px 0;">Pain Points:</p>
                <div class="linkedintel-tags">
                  ${contact.painPoints
                    .map(
                      (pain) =>
                        `<span class="linkedintel-tag">${this.escapeHtml(
                          pain
                        )}</span>`
                    )
                    .join('')}
                </div>
              </div>
            `
                : ''
            }
            ${
              contact.profileUrl
                ? `
              <a href="${contact.profileUrl}" target="_blank" class="linkedintel-contact-action">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                View LinkedIn Profile
              </a>
            `
                : ''
            }
          </div>
        `
          )
          .join('')}
      </div>
    `
  }

  // Chrome AI Tab - Settings and Status
  generateChromeAITab(data) {
    // Check if Chrome AI service is available
    const hasChromeAI = typeof window.chromeAI !== 'undefined'
    let availability = null
    let details = null

    if (hasChromeAI) {
      availability = window.chromeAI.availability || {}
      details = window.chromeAI.getDetailedAvailabilitySync
        ? window.chromeAI.getDetailedAvailabilitySync()
        : window.chromeAI.detailedAvailability || {}
    }

    // Count available features (only count real features, not deprecated ones)
    const enabledCount = details
      ? Object.entries(details).filter(([key, api]) => 
          api.available
        ).length
      : 0
    const totalCount = 2 // Only count summarizer and prompt (the active features)
    const allEnabled = enabledCount === totalCount
    const someEnabled = enabledCount > 0 && enabledCount < totalCount
    const noneEnabled = enabledCount === 0

    return `
      <div class="linkedintel-chrome-ai-container">
        <!-- Header Section -->
        <div class="linkedintel-section" style="margin-bottom: 24px;">
          <div style="background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); border-radius: 16px; padding: 24px; border: 1px solid #c084fc; box-shadow: 0 4px 16px rgba(168, 85, 247, 0.3);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
              </svg>
              <div>
                <h2 style="color: white; font-size: 20px; font-weight: 700; margin: 0;">Chrome Built-in AI</h2>
                <p style="color: rgba(255, 255, 255, 0.9); font-size: 14px; margin: 4px 0 0 0;">On-device AI features powered by Gemini Nano</p>
              </div>
            </div>
            
            <div style="background: rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 16px; backdrop-filter: blur(10px);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: white; font-size: 14px; font-weight: 600;">Status:</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: white; font-size: 16px; font-weight: 700;">${enabledCount} / ${totalCount}</span>
                  <span style="background: ${
                    allEnabled ? '#10b981' : someEnabled ? '#f59e0b' : '#ef4444'
                  }; color: white; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
                    ${
                      allEnabled
                        ? '✓ All Ready'
                        : someEnabled
                        ? '⚠ Partial'
                        : '✕ Not Ready'
                    }
                  </span>
                </div>
              </div>
              
              ${
                !hasChromeAI
                  ? `
                <div style="color: rgba(255, 255, 255, 0.9); font-size: 13px; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.2);">
                  <strong>⚠️ Chrome AI Service Not Loaded</strong><br/>
                  Please refresh the page or check the extension installation.
                </div>
              `
                  : ''
              }
            </div>
          </div>
        </div>

        ${
          hasChromeAI
            ? `
          <!-- Feature Status Section -->
          <div class="linkedintel-section" style="margin-bottom: 24px;">
            <div class="linkedintel-section-header">
              <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <h3 class="linkedintel-section-title">Available Features</h3>
            </div>
            
            <div class="linkedintel-list">
              ${this.generateAIFeatureItem(
                'Summarizer',
                details?.summarizer,
                'Instant on-device summaries of profiles and companies'
              )}
              ${this.generateAIFeatureItem(
                'Prompt API',
                details?.prompt,
                'Intelligent chat responses and personalized outreach'
              )}
            </div>
          </div>

          ${
            noneEnabled || someEnabled
              ? `
            <!-- Setup Instructions -->
            <div class="linkedintel-section" style="margin-bottom: 24px;">
              <div class="linkedintel-section-header">
                <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2v20M2 12h20"/>
                  <circle cx="12" cy="12" r="5"/>
                </svg>
                <h3 class="linkedintel-section-title">Setup Instructions</h3>
              </div>
              
              <div class="linkedintel-info-box warning" style="margin-bottom: 16px;">
                <p class="linkedintel-info-title">⚙️ Enable Chrome AI Features</p>
                <p class="linkedintel-info-text">Follow these steps to activate on-device AI capabilities:</p>
              </div>

              <div class="linkedintel-list">
                <div class="linkedintel-list-item" style="flex-direction: column; align-items: flex-start; padding: 16px;">
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <div style="background: #4c6ef5; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">1</div>
                    <strong style="font-size: 14px; color: #212529;">Chrome Version</strong>
                  </div>
                  <p style="margin: 0 0 0 40px; font-size: 13px; color: #495057; line-height: 1.6;">
                    You need <strong>Chrome 127+</strong> (Dev or Canary channel recommended).<br/>
                    <a href="https://www.google.com/chrome/canary/" target="_blank" style="color: #4c6ef5; text-decoration: none;">Download Chrome Canary →</a>
                  </p>
                </div>

                <div class="linkedintel-list-item" style="flex-direction: column; align-items: flex-start; padding: 16px;">
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <div style="background: #4c6ef5; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">2</div>
                    <strong style="font-size: 14px; color: #212529;">Enable Chrome Flags</strong>
                  </div>
                  <div style="margin: 0 0 0 40px; font-size: 13px; color: #495057; line-height: 1.6;">
                    <p style="margin: 0 0 8px 0;">Open each URL in Chrome and set to <strong>Enabled</strong>:</p>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                      <li style="margin: 6px 0;"><code style="background: #f1f3f5; padding: 2px 6px; border-radius: 4px; font-size: 12px;">chrome://flags/#optimization-guide-on-device-model</code></li>
                      <li style="margin: 6px 0;"><code style="background: #f1f3f5; padding: 2px 6px; border-radius: 4px; font-size: 12px;">chrome://flags/#prompt-api-for-gemini-nano</code></li>
                      <li style="margin: 6px 0;"><code style="background: #f1f3f5; padding: 2px 6px; border-radius: 4px; font-size: 12px;">chrome://flags/#summarization-api-for-gemini-nano</code></li>
                    </ul>
                  </div>
                </div>

                <div class="linkedintel-list-item" style="flex-direction: column; align-items: flex-start; padding: 16px;">
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <div style="background: #4c6ef5; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">3</div>
                    <strong style="font-size: 14px; color: #212529;">Restart Chrome</strong>
                  </div>
                  <p style="margin: 0 0 0 40px; font-size: 13px; color: #495057; line-height: 1.6;">
                    After enabling all flags, <strong>completely close and restart Chrome</strong>.
                  </p>
                </div>

                <div class="linkedintel-list-item" style="flex-direction: column; align-items: flex-start; padding: 16px;">
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <div style="background: #4c6ef5; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">4</div>
                    <strong style="font-size: 14px; color: #212529;">Download AI Model</strong>
                  </div>
                  <p style="margin: 0 0 8px 40px; font-size: 13px; color: #495057; line-height: 1.6;">
                    Open DevTools (F12), paste this in the Console, and press Enter:
                  </p>
                  <pre style="margin: 0 0 0 40px; background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 8px; font-size: 12px; font-family: 'Courier New', monospace; overflow-x: auto;">await LanguageModel.create();</pre>
                  <p style="margin: 8px 0 0 40px; font-size: 12px; color: #868e96; line-height: 1.6;">
                    This will download Gemini Nano (~1.5GB) in the background.
                  </p>
                </div>

                <div class="linkedintel-list-item" style="flex-direction: column; align-items: flex-start; padding: 16px;">
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <div style="background: #10b981; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">✓</div>
                    <strong style="font-size: 14px; color: #212529;">Verify Setup</strong>
                  </div>
                  <p style="margin: 0 0 0 40px; font-size: 13px; color: #495057; line-height: 1.6;">
                    Refresh this page and check if all features show <span style="color: #10b981; font-weight: 600;">✓ Ready</span> above.
                  </p>
                </div>
              </div>
            </div>
          `
              : ''
          }

          ${
            allEnabled
              ? `
            <!-- Features Unlocked -->
            <div class="linkedintel-section">
              <div class="linkedintel-info-box success">
                <p class="linkedintel-info-title">🎉 All Features Unlocked!</p>
                <p class="linkedintel-info-text">Chrome AI is fully enabled. You can now use:</p>
                <ul style="margin: 12px 0 0 0; padding-left: 20px;">
                  <li style="margin: 6px 0;">Quick Summary badges on profiles and company pages</li>
                  <li style="margin: 6px 0;">AI Compose for personalized outreach messages</li>
                  <li style="margin: 6px 0;">Message Refinement with tone adjustments (Refine button)</li>
                  <li style="margin: 6px 0;">Intelligent chat responses in the Ask AI tab</li>
                  <li style="margin: 6px 0;">On-device summaries in the Overview tab</li>
                </ul>
              </div>
            </div>
          `
              : ''
          }

          <!-- Debug Information -->
          <div class="linkedintel-section" style="margin-top: 24px;">
            <div class="linkedintel-section-header">
              <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
              <h3 class="linkedintel-section-title">Debug Information</h3>
            </div>
            
            <div class="linkedintel-list">
              <div class="linkedintel-list-item" style="flex-direction: column; align-items: flex-start;">
                <p style="margin: 0; font-size: 12px; color: #868e96; font-family: 'Courier New', monospace; line-height: 1.8;">
                  <strong style="color: #495057;">Service Loaded:</strong> ${
                    hasChromeAI ? '✓ Yes' : '✕ No'
                  }<br/>
                  <strong style="color: #495057;">Initialized:</strong> ${
                    hasChromeAI && window.chromeAI.isInitialized
                      ? '✓ Yes'
                      : '✕ No'
                  }<br/>
                  <strong style="color: #495057;">User Agent:</strong> ${(() => {
                    const match = navigator.userAgent.match(/Chrome\/([0-9]+)/)
                    return navigator.userAgent.includes('Chrome')
                      ? 'Chrome ' + (match ? match[1] : 'Unknown')
                      : 'Not Chrome'
                  })()}
                </p>
              </div>
            </div>
            
            <div style="margin-top: 16px;">
              <a href="https://developer.chrome.com/docs/ai/built-in" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; color: #4c6ef5; text-decoration: none; font-size: 14px; font-weight: 600;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4"/>
                  <path d="M12 8h.01"/>
                </svg>
                Chrome Built-in AI Documentation
              </a>
            </div>
          </div>
        `
            : `
          <!-- Service Not Available -->
          <div class="linkedintel-section">
            <div class="linkedintel-info-box danger">
              <p class="linkedintel-info-title">⚠️ Chrome AI Service Unavailable</p>
              <p class="linkedintel-info-text">
                The Chrome AI service could not be loaded. Please check your extension installation and try refreshing the page.
              </p>
            </div>
          </div>
        `
        }
      </div>
    `
  }

  // Generate AI feature status item
  generateAIFeatureItem(name, status, description) {
    const isAvailable = status?.available || false
    const requiresDownload = status?.requiresDownload || false

    let statusIcon, statusText, statusClass, statusColor

    if (isAvailable) {
      statusIcon = '✓'
      statusText = 'Ready'
      statusClass = 'success'
      statusColor = '#10b981'
    } else if (requiresDownload) {
      statusIcon = '↓'
      statusText = 'Download Required'
      statusClass = 'warning'
      statusColor = '#f59e0b'
    } else {
      statusIcon = '✕'
      statusText = 'Not Available'
      statusClass = 'danger'
      statusColor = '#ef4444'
    }

    return `
      <div class="linkedintel-list-item" style="display: flex; align-items: center; justify-content: space-between; padding: 16px;">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
            <span style="color: ${statusColor}; font-size: 18px; font-weight: 700;">${statusIcon}</span>
            <strong style="font-size: 14px; color: #212529;">${name}</strong>
          </div>
          <p style="margin: 0 0 0 28px; font-size: 13px; color: #868e96; line-height: 1.5;">${description}</p>
        </div>
        <div style="flex-shrink: 0; margin-left: 16px;">
          <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; white-space: nowrap;">
            ${statusText}
          </span>
        </div>
      </div>
    `
  }

  // Strategy Tab (Executive Summary)
  generateStrategyContent(data) {
    let html = ''

    // Executive Summary (Premium)
    if (data.executiveSummary) {
      const summary = data.executiveSummary
      const ratingColor =
        summary.opportunityRating === 'STRONG'
          ? 'success'
          : summary.opportunityRating === 'WEAK'
          ? 'danger'
          : 'warning'

      html += `
        <div class="linkedintel-info-box ${ratingColor}">
          <p class="linkedintel-info-title">📊 ${
            summary.opportunityRating || 'MODERATE'
          } OPPORTUNITY</p>
          <p class="linkedintel-info-text" style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">${this.escapeHtml(
            summary.oneLineSummary || 'Opportunity assessment'
          )}</p>
          <p class="linkedintel-info-text" style="font-weight: 600;">${this.escapeHtml(
            summary.bottomLine || 'Standard outreach recommended'
          )}</p>
        </div>
      `

      // Quick Facts
      if (summary.quickFacts && summary.quickFacts.length > 0) {
        html += `
          <div class="linkedintel-section">
            <div class="linkedintel-section-header">
              <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
              </svg>
              <h3 class="linkedintel-section-title">Quick Facts</h3>
            </div>
            <div class="linkedintel-list">
              ${summary.quickFacts
                .map(
                  (fact) =>
                    '<div class="linkedintel-list-item"><p class="linkedintel-list-text">✓ ' +
                    this.escapeHtml(fact) +
                    '</p></div>'
                )
                .join('')}
            </div>
          </div>
        `
      }

      // Best Approach
      if (summary.bestApproach) {
        const approach = summary.bestApproach
        html += `
          <div class="linkedintel-section">
            <div class="linkedintel-section-header">
              <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <h3 class="linkedintel-section-title">Best Approach</h3>
            </div>
            <div class="linkedintel-info-box success">
              <p class="linkedintel-info-text">
                <strong>Who:</strong> ${this.escapeHtml(
                  approach.who || 'Decision makers'
                )}<br>
                <strong>When:</strong> ${this.escapeHtml(
                  approach.when || 'This week'
                )}<br>
                <strong>How:</strong> ${this.escapeHtml(
                  approach.how || 'Email or LinkedIn'
                )}<br>
                <strong>Why:</strong> ${this.escapeHtml(
                  approach.why || 'Standard timing'
                )}
              </p>
            </div>
          </div>
        `
      }

      // Red Flags
      if (summary.redFlags && summary.redFlags.length > 0) {
        html += `
          <div class="linkedintel-section">
            <div class="linkedintel-section-header">
              <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <h3 class="linkedintel-section-title">Red Flags</h3>
            </div>
            <div class="linkedintel-list">
              ${summary.redFlags
                .map(
                  (flag) =>
                    '<div class="linkedintel-list-item"><p class="linkedintel-list-text">Risk: ' +
                    this.escapeHtml(flag) +
                    '</p></div>'
                )
                .join('')}
            </div>
          </div>
        `
      }
    }

    // Process citation markers and append footnotes if we have content
    if (html) {
      html = this.renderCitationMarkers(html)
      html += this.generateCitationFootnotes()
    }

    return (
      html ||
      '<div class="linkedintel-empty-state"><svg class="linkedintel-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg><p class="linkedintel-empty-text">No strategy available</p></div>'
    )
  }

  // Company Content for Profile View
  generateCompanyContent(company) {
    return (
      this.generateCompanyOverview(company) +
      this.generateIntelligenceContent(company) +
      this.generateNewsSignals(company) +
      (company.priorityContacts ? this.generateDecisionMakers(company) : '') +
      this.generateStrategyContent(company)
    )
  }

  // ============================================
  // PERSON-SPECIFIC CONTENT GENERATORS (Profile View)
  // ============================================

  // Person Profile Overview Tab
  generatePersonProfileOverview(profile, company) {
    const name = profile.name || 'Unknown'
    const title = profile.title || ''
    const companyName = profile.company || company?.companyName || ''
    const isCXO = profile.isCXO?.value || false
    const cxoLevel = profile.isCXO?.level || 'Executive'
    const yearsInRole = profile.yearsInRole || null
    const executiveLevel = profile.executiveLevel || null

    let html = `
      <!-- Person Hero Card - Enhanced -->
      <div class="linkedintel-hero-card" style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 24px;">
        <div class="linkedintel-hero-name" style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">${this.escapeHtml(
          name
        )}</div>
        <div class="linkedintel-hero-subtitle" style="font-size: 16px; margin-bottom: 6px;">${this.escapeHtml(
          title
        )}</div>
        ${
          companyName
            ? `<div class="linkedintel-hero-meta" style="font-size: 14px; opacity: 0.9;">at ${this.escapeHtml(
                companyName
              )}</div>`
            : ''
        }
        
        <div class="linkedintel-hero-badges" style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
          ${
            isCXO
              ? `
          <span class="linkedintel-badge" style="background: rgba(251, 191, 36, 0.25); border: 1px solid rgba(251, 191, 36, 0.4); color: #fbbf24; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            ${this.escapeHtml(cxoLevel)}
          </span>
          `
              : ''
          }
          ${
            executiveLevel
              ? `
          <span class="linkedintel-badge" style="background: rgba(147, 197, 253, 0.25); border: 1px solid rgba(147, 197, 253, 0.4); color: #60a5fa; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
            ${this.escapeHtml(executiveLevel)}
          </span>
          `
              : ''
          }
          ${
            yearsInRole
              ? `
          <span class="linkedintel-badge" style="background: rgba(167, 139, 250, 0.25); border: 1px solid rgba(167, 139, 250, 0.4); color: #a78bfa; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
            ${yearsInRole} ${yearsInRole === 1 ? 'year' : 'years'} in role
          </span>
          `
              : ''
          }
        </div>
      </div>
    `

    // Add company context if available
    if (company && (company.recentNews?.length > 0 || company.stockInfo)) {
      // Extract private company financials from dynamicFinancials for display
      if (!this.isPublicCompany(company) && company.stockInfo) {
        company.privateFinancials = this.extractPrivateFinancials(company.stockInfo)
      }
      
      html += `
        <!-- Company Context Section -->
        <div class="linkedintel-section" style="margin-top: 16px;">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
            <h3 class="linkedintel-section-title">🏢 Company Context</h3>
          </div>
          <div style="background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%); border: 1px solid #fde047; border-radius: 12px; padding: 16px;">
            
            <!-- Company Overview: Status, Employees, Industry -->
            <div style="margin-bottom: 16px;">
              <div style="display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
                ${
                  company.overview
                    ? `
                <!-- Public/Private Status Badge -->
                <div style="background: ${
                  company.overview.isPublic
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                }; border-radius: 8px; padding: 8px 16px; display: inline-flex; align-items: center; gap: 8px;">
                  <span style="font-size: 18px;">${
                    company.overview.isPublic ? '📈' : '🔒'
                  }</span>
                  <span style="margin: 0; font-size: 14px; font-weight: 700; color: white; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${company.overview.isPublic ? 'Public' : 'Private'} Company
                  </span>
                </div>
                `
                    : ''
                }
                ${
                  company.overview && company.overview.employeeCount
                    ? `
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; flex: 1; min-width: 120px;">
                  <p style="margin: 0; font-size: 11px; color: #6b7280; font-weight: 600;">EMPLOYEES</p>
                  <p style="margin: 0; font-size: 16px; font-weight: 700; color: #1f2937;">${this.escapeHtml(
                    company.overview.employeeCount
                  )}</p>
                </div>
                `
                    : ''
                }
                ${
                  company.overview && company.overview.industry
                    ? `
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; flex: 1; min-width: 150px;">
                  <p style="margin: 0; font-size: 11px; color: #6b7280; font-weight: 600;">INDUSTRY</p>
                  <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1f2937;">${this.escapeHtml(
                    company.overview.industry
                  )}</p>
                </div>
                `
                    : ''
                }
              </div>
            </div>

            ${
              this.isPublicCompany(company)
                ? `
            <div style="display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
              ${
                company.stockInfo.price
                  ? `
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; flex: 1; min-width: 120px;">
                <p style="margin: 0; font-size: 11px; color: #6b7280; font-weight: 600;">STOCK PRICE</p>
                <p style="margin: 0; font-size: 16px; font-weight: 700; color: #1f2937;">$${company.stockInfo.price}</p>
              </div>
              `
                  : ''
              }
              ${
                company.stockInfo.ytd !== undefined &&
                company.stockInfo.ytd !== null
                  ? `
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; flex: 1; min-width: 120px;">
                <p style="margin: 0; font-size: 11px; color: #6b7280; font-weight: 600;">YTD</p>
                <p style="margin: 0; font-size: 16px; font-weight: 700; color: ${
                  company.stockInfo.ytd >= 0 ? '#10b981' : '#ef4444'
                };">
                  ${
                    company.stockInfo.ytd >= 0 ? '+' : ''
                  }${company.stockInfo.ytd.toFixed(1)}%
                </p>
              </div>
              `
                  : ''
              }
            </div>
            `
                : ''
            }
            
            ${
              !this.isPublicCompany(company) && company.privateFinancials
                ? `
            <div style="margin-bottom: 16px;">
              <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #78350f; display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 16px;">💰</span> Private Company Financials
              </p>
              <div style="display: flex; gap: 12px; margin-bottom: 14px; flex-wrap: wrap;">
                ${
                  company.privateFinancials.totalFunding
                    ? `
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; flex: 1; min-width: 130px;">
                  <p style="margin: 0; font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Total Funding</p>
                  <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #1f2937;">${this.escapeHtml(
                    company.privateFinancials.totalFunding
                  )}</p>
                </div>
                `
                    : ''
                }
                ${
                  company.privateFinancials.latestValuation
                    ? `
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; flex: 1; min-width: 130px;">
                  <p style="margin: 0; font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Valuation</p>
                  <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #10b981;">${this.escapeHtml(
                    company.privateFinancials.latestValuation
                  )}</p>
                </div>
                `
                    : ''
                }
                ${
                  company.privateFinancials.revenueEstimate &&
                  company.privateFinancials.revenueEstimate !== 'Not disclosed'
                    ? `
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; flex: 1; min-width: 130px;">
                  <p style="margin: 0; font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Revenue</p>
                  <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #1f2937;">${this.escapeHtml(
                    company.privateFinancials.revenueEstimate
                  )}</p>
                </div>
                `
                    : ''
                }
              </div>
              
              ${
                company.privateFinancials.fundingRounds &&
                company.privateFinancials.fundingRounds.length > 0
                  ? `
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                <p style="margin: 0 0 10px 0; font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">📈 Funding History</p>
                ${company.privateFinancials.fundingRounds
                  .slice(0, 3)
                  .map((round, index) => {
                    // Format date
                    let formattedDate = round.date
                    if (round.date) {
                      try {
                        const date = new Date(round.date)
                        formattedDate = date.toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })
                      } catch (e) {
                        formattedDate = round.date
                      }
                    }

                    return `
                    <div style="padding: 8px 0; ${
                      index <
                      company.privateFinancials.fundingRounds.slice(0, 3)
                        .length -
                        1
                        ? 'border-bottom: 1px solid #f3f4f6;'
                        : ''
                    }">
                      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                        <span style="display: inline-block; background: #dbeafe; color: #1e40af; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase;">${this.escapeHtml(
                          round.round
                        )}</span>
                        <span style="font-size: 14px; font-weight: 700; color: #059669;">${this.escapeHtml(
                          round.amount
                        )}</span>
                      </div>
                      <div style="font-size: 10px; color: #6b7280; margin-bottom: 4px;">${formattedDate}</div>
                      ${
                        round.investors && round.investors.length > 0
                          ? `
                      <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">
                        ${round.investors
                          .slice(0, 3)
                          .map(
                            (investor) =>
                              `<span style="background: #f3f4f6; color: #374151; padding: 2px 6px; border-radius: 3px; font-size: 10px;">${this.escapeHtml(
                                investor
                              )}</span>`
                          )
                          .join('')}
                        ${
                          round.investors.length > 3
                            ? `<span style="color: #6b7280; font-size: 10px; padding: 2px;">+${
                                round.investors.length - 3
                              } more</span>`
                            : ''
                        }
                      </div>
                      `
                          : ''
                      }
                    </div>
                  `
                  })
                  .join('')}
              </div>
              `
                  : ''
              }
              
              ${
                company.privateFinancials.sources &&
                company.privateFinancials.sources.length > 0
                  ? `
              <p style="margin: 8px 0 0 0; font-size: 10px; color: #6b7280; font-style: italic;">
                Sources: ${company.privateFinancials.sources.join(', ')}
              </p>
              `
                  : ''
              }
            </div>
            `
                : ''
            }
            
            ${
              company.recentNews && company.recentNews.length > 0
                ? `
            <div>
              <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #78350f;">Recent Company News:</p>
              ${company.recentNews
                .slice(0, 2)
                .map(
                  (news) => `
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin-bottom: 8px;">
                  <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #1f2937;">${this.escapeHtml(
                    news.title
                  )}</p>
                  <p style="margin: 0; font-size: 11px; color: #6b7280;">${this.escapeHtml(
                    this.stripCitations(news.summary || '')?.substring(
                      0,
                      120
                    ) || ''
                  )}...</p>
                </div>
              `
                )
                .join('')}
            </div>
            `
                : ''
            }
          </div>
        </div>
      `
    }

    return html
  }

  // Authority & Budget Tab
  generateAuthorityBudget(profile) {
    let html = ''

    // Budget Authority Details
    if (profile.budgetAuthority) {
      const budget = profile.budgetAuthority
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            <h3 class="linkedintel-section-title">Budget Authority</h3>
          </div>
          <div class="linkedintel-info-box ${
            budget.hasBudget ? 'success' : 'warning'
          }">
            <p class="linkedintel-info-title">${
              budget.hasBudget
                ? '✅ Has Budget Authority'
                : '⚠️ Limited Budget Authority'
            }</p>
            ${
              budget.scope
                ? `<p class="linkedintel-info-text"><strong>Scope:</strong> ${this.escapeHtml(
                    budget.scope
                  )}</p>`
                : ''
            }
            ${
              budget.range
                ? `<p class="linkedintel-info-text"><strong>Budget Range:</strong> ${this.escapeHtml(
                    budget.range
                  )}</p>`
                : ''
            }
            ${
              budget.confidence
                ? `<p class="linkedintel-info-text"><strong>Confidence Level:</strong> ${this.escapeHtml(
                    budget.confidence
                  )}</p>`
                : ''
            }
          </div>
        </div>
      `
    }

    // Technology Authority
    if (profile.technologyAuthority) {
      const tech = profile.technologyAuthority
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            <h3 class="linkedintel-section-title">Technology Authority</h3>
          </div>
          <div class="linkedintel-info-box ${
            tech.canApprove ? 'success' : 'neutral'
          }">
            <p class="linkedintel-info-text">
              <strong>Can Approve Tech Purchases:</strong> ${
                tech.canApprove ? '✅ Yes' : '❌ No'
              }<br>
              ${
                tech.decisionInfluence
                  ? `<strong>Decision Influence:</strong> ${this.escapeHtml(
                      tech.decisionInfluence
                    )}<br>`
                  : ''
              }
              ${
                tech.categories && tech.categories.length > 0
                  ? `<strong>Categories:</strong> ${tech.categories.join(', ')}`
                  : ''
              }
            </p>
          </div>
        </div>
      `
    }

    // Budget Cycle
    if (profile.budgetCycle) {
      const cycle = profile.budgetCycle
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <h3 class="linkedintel-section-title">Budget Cycle</h3>
          </div>
          <div class="linkedintel-info-box neutral">
            <p class="linkedintel-info-text">
              ${
                cycle.timing
                  ? `<strong>⏰ Timing:</strong> ${this.escapeHtml(
                      cycle.timing
                    )}<br>`
                  : ''
              }
              ${
                cycle.fiscalYear
                  ? `<strong>📅 Fiscal Year:</strong> ${this.escapeHtml(
                      cycle.fiscalYear
                    )}<br>`
                  : ''
              }
              ${
                cycle.confidence
                  ? `<strong>Confidence:</strong> ${this.escapeHtml(
                      cycle.confidence
                    )}`
                  : ''
              }
            </p>
          </div>
        </div>
      `
    }

    // Authority Indicators - Factual only
    if (authorityIndicators && authorityIndicators.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <h3 class="linkedintel-section-title">Authority Indicators</h3>
          </div>
          <div class="linkedintel-info-box">
            <ul class="linkedintel-list">
              ${authorityIndicators
                .map(
                  (indicator) => `
                <li class="linkedintel-list-item">
                  <span class="linkedintel-badge-sm success">✓</span>
                  ${this.escapeHtml(indicator)}
                </li>
              `
                )
                .join('')}
            </ul>
          </div>
        </div>
      `
    }

    return (
      html ||
      '<div class="linkedintel-empty-state"><p class="linkedintel-empty-text">No authority data available</p></div>'
    )
  }

  // Pain Points & KPIs Tab
  generatePainPointsKPIs(profile) {
    let html = ''

    // Publicly Stated Pain Points
    if (
      profile.publiclyStatedPainPoints &&
      profile.publiclyStatedPainPoints.length > 0
    ) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h3 class="linkedintel-section-title">🎯 Pain Points</h3>
          </div>
          <div class="linkedintel-list">
            ${profile.publiclyStatedPainPoints
              .map((point) => {
                // Handle both string and object formats
                const text =
                  typeof point === 'string'
                    ? point
                    : point.context || point.quote || point.painPoint || ''
                return `
              <div class="linkedintel-list-item">
                <p class="linkedintel-list-text">• ${this.escapeHtml(
                  this.stripCitations(text)
                )}</p>
              </div>
            `
              })
              .join('')}
          </div>
        </div>
      `
    }

    // Solution Timing section removed - not needed per user feedback

    // If no pain points found, show enhanced empty state with role-based suggestions
    if (!html) {
      const title = profile.title || ''
      const company = profile.company || 'their company'

      // Generate role-based common challenges
      let roleBasedChallenges = []
      const titleLower = String(title || '').toLowerCase()

      if (titleLower.includes('cto') || titleLower.includes('technology')) {
        roleBasedChallenges = [
          'Scaling infrastructure while maintaining security and compliance',
          'Managing technical debt across multiple systems',
          'Balancing innovation with operational stability',
          'Attracting and retaining top engineering talent',
        ]
      } else if (
        titleLower.includes('ceo') ||
        titleLower.includes('president')
      ) {
        roleBasedChallenges = [
          'Accelerating revenue growth while maintaining profitability',
          'Managing organizational change during rapid scaling',
          'Balancing short-term execution with long-term strategy',
          'Building and retaining executive leadership team',
        ]
      } else if (
        titleLower.includes('cfo') ||
        titleLower.includes('financial')
      ) {
        roleBasedChallenges = [
          'Optimizing cash flow and working capital management',
          'Ensuring financial controls during rapid growth',
          'Supporting strategic decisions with accurate forecasting',
          'Managing investor relationships and expectations',
        ]
      } else if (titleLower.includes('vp') || titleLower.includes('head')) {
        roleBasedChallenges = [
          'Aligning team objectives with company strategy',
          'Managing cross-functional dependencies',
          'Developing and retaining high-performing teams',
          'Demonstrating ROI on departmental investments',
        ]
      } else {
        roleBasedChallenges = [
          'Driving operational efficiency and productivity',
          'Managing stakeholder expectations across functions',
          'Implementing new technologies and processes',
          'Supporting team growth and development',
        ]
      }

      html = `
        <div class="linkedintel-empty-state" style="padding: 32px; text-align: left;">
          <div style="display: flex; align-items: start; gap: 16px;">
            <div style="font-size: 48px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">💭</div>
            <div style="flex: 1;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1f2937;">No Publicly Stated Pain Points</h3>
              <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.6; color: #6b7280;">
                We searched interviews, articles, earnings calls, and public statements but couldn't find explicitly stated challenges.
              </p>
              
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 3px solid #f59e0b; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
                <div style="display: flex; align-items: start; gap: 10px;">
                  <span style="font-size: 20px;">💡</span>
                  <div>
                    <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #92400e;">Likely Priorities for ${this.escapeHtml(
                      title
                    )}</p>
                    <p style="margin: 0 0 10px 0; font-size: 11px; color: #78350f;">Based on typical challenges for this role:</p>
                    <ul style="margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.6; color: #78350f;">
                      ${roleBasedChallenges
                        .map((c) => `<li>${c}</li>`)
                        .join('')}
                    </ul>
                  </div>
                </div>
              </div>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px;">
                <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 600; color: #374151;">
                  🔎 Research Suggestions:
                </p>
                <ul style="margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.6; color: #6b7280;">
                  <li>Search for recent interviews or podcast appearances</li>
                  <li>Review ${this.escapeHtml(
                    company
                  )} earnings calls or investor updates</li>
                  <li>Check for strategic priorities mentioned in company announcements</li>
                  <li>Look for industry challenges mentioned in their speaking engagements</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      `
    }

    return html
  }

  // Contact Strategy Tab
  generateContactStrategy(profile) {
    return `
      <div class="linkedintel-section">
        <div class="linkedintel-section-header">
          <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          <h3 class="linkedintel-section-title">📧 Contact Information</h3>
        </div>
        <div class="linkedintel-info-placeholder">
          <p class="linkedintel-info-title">📧 Email/Phone contact details coming soon</p>
        </div>
      </div>
    `
  }

  // Recent Activity Tab - LinkedIn Posts & Social Presence
  generateRecentActivitySection(profile) {
    let html = ''
    const activity = profile.recentActivity

    // Debug logging to understand post counts
    panelLogger.info('Rendering Recent Activity section', {
      hasActivity: !!activity,
      hasPosts: !!(activity && activity.posts),
      postCount: activity?.posts?.length || 0,
    })

    if (!activity || !activity.posts || activity.posts.length === 0) {
      // Enhanced empty state with helpful guidance and alternatives
      let emptyStateHtml = `
        <div class="linkedintel-empty-state" style="padding: 32px; text-align: left;">
          <div style="display: flex; align-items: start; gap: 16px;">
            <div style="font-size: 48px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">🔍</div>
            <div style="flex: 1;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1f2937;">No Recent Activity Found</h3>
              <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.6; color: #6b7280;">
                We searched LinkedIn, Twitter, media mentions, and industry publications but couldn't find recent public activity for this profile.
              </p>
              
              <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 3px solid #3b82f6; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
                <div style="display: flex; align-items: start; gap: 10px;">
                  <span style="font-size: 20px;">💡</span>
                  <div>
                    <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #1e40af;">Research Tips</p>
                    <ul style="margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.6; color: #1e3a8a;">
                      <li>Check their LinkedIn profile directly for recent posts</li>
                      <li>Search for podcast appearances or interviews</li>
                      <li>Review ${this.escapeHtml(
                        profile.company || 'their company'
                      )} blog for authored articles</li>
                      <li>Look for conference speaker listings</li>
                    </ul>
                  </div>
                </div>
              </div>
      `

      // Show alternative data if available
      const hasMediaPresence =
        profile.mediaPresence &&
        (profile.mediaPresence.pressFeatures?.length > 0 ||
          profile.mediaPresence.speakingEngagements?.length > 0 ||
          profile.mediaPresence.awards?.length > 0)

      if (hasMediaPresence) {
        emptyStateHtml += `
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px;">
                <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 600; color: #374151;">
                  ✨ Check the "Thought Leadership" tab for:
                </p>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px;">
                  ${
                    profile.mediaPresence.pressFeatures?.length > 0
                      ? `<span style="background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 12px; font-weight: 500;">📰 ${profile.mediaPresence.pressFeatures.length} Media Features</span>`
                      : ''
                  }
                  ${
                    profile.mediaPresence.speakingEngagements?.length > 0
                      ? `<span style="background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 12px; font-weight: 500;">🎤 ${profile.mediaPresence.speakingEngagements.length} Speaking Events</span>`
                      : ''
                  }
                  ${
                    profile.mediaPresence.awards?.length > 0
                      ? `<span style="background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 12px; font-weight: 500;">🏆 ${profile.mediaPresence.awards.length} Awards</span>`
                      : ''
                  }
                </div>
              </div>
        `
      }

      emptyStateHtml += `
            </div>
          </div>
        </div>
      `

      return emptyStateHtml
    }

    // Recent Posts - Enhanced UI with modern design
    html += `
      <div class="linkedintel-section">
        <div class="linkedintel-section-header">
          <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <h3 class="linkedintel-section-title">📝 Recent Posts</h3>
          <span class="linkedintel-tab-badge">${activity.posts.length}</span>
        </div>
    `

    activity.posts.forEach((post, index) => {
      // Enhanced sentiment configuration with colors and icons
      const sentimentConfig = {
        positive: {
          emoji: '✨',
          color: '#10b981',
          bg: '#d1fae5',
          label: 'Positive',
        },
        negative: {
          emoji: '⚠️',
          color: '#ef4444',
          bg: '#fee2e2',
          label: 'Critical',
        },
        neutral: {
          emoji: '📰',
          color: '#6366f1',
          bg: '#e0e7ff',
          label: 'Neutral',
        },
        'thought-leadership': {
          emoji: '💡',
          color: '#f59e0b',
          bg: '#fef3c7',
          label: 'Thought Leadership',
        },
        promotional: {
          emoji: '📢',
          color: '#8b5cf6',
          bg: '#ede9fe',
          label: 'Promotional',
        },
      }
      const config = sentimentConfig[post.sentiment] || sentimentConfig.neutral

      // Format date to relative time (e.g., "3 days ago")
      const formatDate = (dateStr) => {
        try {
          const date = new Date(dateStr)
          const now = new Date()
          const diffMs = now - date
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

          if (diffDays === 0) return 'Today'
          if (diffDays === 1) return 'Yesterday'
          if (diffDays < 7) return `${diffDays} days ago`
          if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
          if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
          return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        } catch {
          return dateStr
        }
      }

      // Format post type for display
      const formatType = (type) => {
        if (!type) return 'Post'
        // Capitalize first letter and handle special cases
        const typeMap = {
          post: 'Post',
          article: 'Article',
          repost: 'Repost',
          appointment: 'Company Announcement',
          award: 'Award',
          speaking: 'Speaking',
          interview: 'Interview',
          video: 'Video',
          announcement: 'Company Announcement',
        }
        return (
          typeMap[String(type).toLowerCase()] ||
          type.charAt(0).toUpperCase() + type.slice(1)
        )
      }

      html += `
        <div class="linkedintel-card" style="
          margin-bottom: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: linear-gradient(to bottom, #ffffff, #fafbfc);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03);
          transition: all 0.2s ease;
          cursor: default;
        " 
        onmouseover="this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.05)'; this.style.transform='translateY(-2px)'"
        onmouseout="this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)'; this.style.transform='translateY(0)'">
          
          <!-- Header with enhanced sentiment indicator -->
          <div style="padding: 16px; padding-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
              <!-- Sentiment badge with icon -->
              <div style="
                display: flex;
                align-items: center;
                gap: 6px;
                background: ${config.bg};
                color: ${config.color};
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
                border: 1px solid ${config.color}20;
              ">
                <span style="font-size: 14px;">${config.emoji}</span>
                <span>${config.label}</span>
              </div>
              
              <!-- Platform badge -->
              <span style="
                background: #f1f5f9;
                color: #475569;
                padding: 4px 10px;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              ">${this.escapeHtml(post.platform)}</span>
            </div>
            
            <!-- Meta information -->
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748b;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span style="font-weight: 500;">${formatDate(post.date)}</span>
              <span style="color: #cbd5e1;">•</span>
              <span style="
                background: #f8fafc;
                padding: 2px 8px;
                border-radius: 4px;
                font-weight: 500;
              ">${formatType(post.type)}</span>
            </div>
          </div>
          
          <!-- Content with better typography -->
          <div style="padding: 0 16px 16px 16px;">
            <p style="
              color: #1e293b;
              line-height: 1.7;
              margin-bottom: 14px;
              font-size: 14px;
              font-weight: 400;
            ">${this.escapeHtml(this.stripCitations(post.content))}</p>
            
            <!-- Topic badge -->
            ${
              post.topic
                ? `
              <div style="margin-bottom: 12px;">
                <span style="
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  padding: 5px 12px;
                  border-radius: 6px;
                  font-size: 11px;
                  font-weight: 600;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
                ">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                  </svg>
                  ${this.escapeHtml(post.topic)}
                </span>
              </div>
            `
                : ''
            }
          
            <!-- Engagement Metrics with improved design -->
            ${
              post.engagement
                ? `
              <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                gap: 12px;
                padding: 14px;
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                border-radius: 10px;
                border: 1px solid #e2e8f0;
                margin-bottom: 14px;
              ">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
                  ">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                    </svg>
                  </div>
                  <div>
                    <div style="font-size: 16px; font-weight: 700; color: #1e293b;">${
                      post.engagement.likes || 0
                    }</div>
                    <div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">Likes</div>
                  </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 6px;">
                  <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
                  ">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <div>
                    <div style="font-size: 16px; font-weight: 700; color: #1e293b;">${
                      post.engagement.comments || 0
                    }</div>
                    <div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">Comments</div>
                  </div>
                </div>
                
                ${
                  post.engagement.shares
                    ? `
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      width: 28px;
                      height: 28px;
                      background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                      border-radius: 8px;
                      box-shadow: 0 2px 4px rgba(139, 92, 246, 0.3);
                    ">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                      </svg>
                    </div>
                    <div>
                      <div style="font-size: 16px; font-weight: 700; color: #1e293b;">${post.engagement.shares}</div>
                      <div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">Shares</div>
                    </div>
                  </div>
                  `
                    : ''
                }
              </div>
            `
                : ''
            }
          </div>
          
          <!-- SDR Relevance with modern card -->
          ${
            post.sdrRelevance
              ? `
          <div style="
            padding: 14px;
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border: 1px solid #fbbf24;
            border-left: 4px solid #f59e0b;
            border-radius: 10px;
            margin: 0 16px 12px 16px;
          ">
            <div style="display: flex; align-items: start; gap: 10px;">
              <div style="
                flex-shrink: 0;
                width: 32px;
                height: 32px;
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
              ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                  <path d="M22 8.5V12"/>
                  <path d="M22 12l-2 2"/>
                </svg>
              </div>
              <div style="flex: 1;">
                <p style="
                  font-size: 11px;
                  font-weight: 700;
                  color: #78350f;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  margin-bottom: 6px;
                ">SDR Value</p>
                <p style="
                  font-size: 13px;
                  color: #78350f;
                  line-height: 1.6;
                  font-weight: 500;
                ">${this.escapeHtml(post.sdrRelevance)}</p>
              </div>
            </div>
          </div>
          `
              : ''
          }
          
          <!-- Conversation Starter with elegant design -->
          ${
            post.conversationStarter
              ? `
          <div style="
            padding: 14px;
            background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
            border: 1px solid #60a5fa;
            border-left: 4px solid #3b82f6;
            border-radius: 10px;
            margin: 0 16px 12px 16px;
          ">
            <div style="display: flex; align-items: start; gap: 10px;">
              <div style="
                flex-shrink: 0;
                width: 32px;
                height: 32px;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
              ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="white" fill="none" stroke-width="2"/>
                  <line x1="12" y1="17" x2="12.01" y2="17" stroke="white" stroke-width="2"/>
                </svg>
              </div>
              <div style="flex: 1;">
                <p style="
                  font-size: 11px;
                  font-weight: 700;
                  color: #1e3a8a;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  margin-bottom: 6px;
                ">Conversation Starter</p>
                <p style="
                  font-size: 13px;
                  color: #1e3a8a;
                  line-height: 1.6;
                  font-style: italic;
                  font-weight: 500;
                ">"${this.escapeHtml(post.conversationStarter)}"</p>
              </div>
            </div>
          </div>
          `
              : ''
          }
        </div>
      `
    })

    html += '</div>'

    return html
  }

  // Thought Leadership Tab - Speaking, Content, Recognition
  generateThoughtLeadershipSection(profile) {
    let html = ''

    // Check all possible sources for thought leadership data
    const speaking = profile.speakingEngagements
    const media = profile.mediaPresence
    const content = profile.contentCreation

    // CRITICAL: Handle both data structures from backend
    // Backend may return: mediaPresence.speakingEngagements (array)
    // Or: speakingEngagements.events (nested object)
    const speakingEvents = speaking?.events || media?.speakingEngagements || []
    const awards = speaking?.awards || media?.awards || []
    const pressFeatures = media?.pressFeatures || []
    const publishedContent = content?.publishedContent || []
    // Note: mediaAppearances removed - consolidated into pressFeatures to avoid duplication

    const hasContent =
      speakingEvents.length > 0 ||
      awards.length > 0 ||
      pressFeatures.length > 0 ||
      publishedContent.length > 0

    if (!hasContent) {
      return '<div class="linkedintel-empty-state"><svg class="linkedintel-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><p class="linkedintel-empty-text">No thought leadership activity found</p></div>'
    }

    // Speaking Engagements
    if (speakingEvents.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            <h3 class="linkedintel-section-title">🎤 Speaking Engagements</h3>
          </div>
      `

      speakingEvents.forEach((event) => {
        const roleIcons = {
          keynote: '🎯',
          panelist: '💬',
          speaker: '🗣️',
          moderator: '🎭',
          'workshop-leader': '👨‍🏫',
        }
        const roleIcon = roleIcons[event.role] || '🎤'

        html += `
          <div class="linkedintel-card" style="margin-bottom: 16px; border-left: 4px solid #3b82f6;">
            <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 8px;">
              <span style="font-size: 28px; margin-right: 12px;">${roleIcon}</span>
              <div style="flex: 1;">
                <h4 style="font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 4px;">
                  ${this.escapeHtml(event.event)}
                </h4>
                <p style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
                  ${this.escapeHtml(event.date)} • ${this.escapeHtml(
          event.location || 'Location TBA'
        )}
                </p>
                <p style="font-size: 13px; color: #374151; margin-bottom: 8px;">
                  <strong style="color: #7c3aed; text-transform: uppercase; font-size: 11px;">${this.escapeHtml(
                    event.role
                  )}:</strong> ${this.escapeHtml(event.topic)}
                </p>
                ${
                  event.sdrValue
                    ? `
                  <div class="linkedintel-info-box success" style="margin-top: 12px;">
                    <p class="linkedintel-info-title" style="font-size: 11px;">💼 SDR Value</p>
                    <p style="font-size: 13px;">${this.escapeHtml(
                      event.sdrValue
                    )}</p>
                  </div>
                `
                    : ''
                }
              </div>
            </div>
          </div>
        `
      })

      html += '</div>'
    }

    // Awards & Recognition
    if (awards.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="7"/>
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
            </svg>
            <h3 class="linkedintel-section-title">🏆 Awards & Recognition</h3>
          </div>
          <div class="linkedintel-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
            ${awards
              .map(
                (award) => `
              <div class="linkedintel-card" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                  <span style="font-size: 32px;">🏆</span>
                  <div>
                    <h4 style="font-size: 14px; font-weight: 600; color: #78350f; margin-bottom: 2px;">
                      ${this.escapeHtml(award.award)}
                    </h4>
                    <p style="font-size: 11px; color: #92400e;">
                      ${this.escapeHtml(award.organization)}
                    </p>
                  </div>
                </div>
                <p style="font-size: 12px; color: #92400e; margin-bottom: 8px;">
                  📅 ${this.escapeHtml(award.date)}
                </p>
                ${
                  award.credibility
                    ? `
                  <span style="display: inline-block; background: ${
                    award.credibility === 'high'
                      ? '#10b981'
                      : award.credibility === 'medium'
                      ? '#f59e0b'
                      : '#6b7280'
                  }; color: white; padding: 4px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: uppercase;">
                    ${this.escapeHtml(award.credibility)} Credibility
                  </span>
                `
                    : ''
                }
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Industry Involvement (currently only in speakingEngagements structure)
    if (speaking?.industryInvolvement?.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <h3 class="linkedintel-section-title">🤝 Industry Involvement</h3>
          </div>
          ${speaking.industryInvolvement
            .map(
              (involvement) => `
            <div class="linkedintel-card" style="margin-bottom: 12px; border-left: 4px solid #8b5cf6;">
              <div style="display: flex; gap: 12px;">
                <span style="font-size: 24px;">🏛️</span>
                <div style="flex: 1;">
                  <h4 style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 4px;">
                    ${this.escapeHtml(involvement.organization)}
                  </h4>
                  <p style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">
                    <strong>Role:</strong> ${this.escapeHtml(involvement.role)}
                    ${
                      involvement.date
                        ? ` • Since ${this.escapeHtml(involvement.date)}`
                        : ''
                    }
                  </p>
                  ${
                    involvement.relevance
                      ? `
                    <p style="font-size: 13px; color: #374151; background: #f3f4f6; padding: 8px 12px; border-radius: 8px;">
                      <strong>SDR Relevance:</strong> ${this.escapeHtml(
                        involvement.relevance
                      )}
                    </p>
                  `
                      : ''
                  }
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
    }

    // Published Content
    if (publishedContent.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <h3 class="linkedintel-section-title">📝 Published Content</h3>
          </div>
      `

      publishedContent.forEach((item) => {
        const typeIcons = {
          blog: '📝',
          article: '📰',
          whitepaper: '📄',
          podcast: '🎙️',
          webinar: '📹',
          interview: '🎤',
          newsletter: '📧',
          video: '📺',
        }
        const typeIcon = typeIcons[item.type] || '📝'

        html += `
          <div class="linkedintel-card" style="margin-bottom: 16px; border-left: 4px solid #059669;">
            <div style="display: flex; gap: 12px; margin-bottom: 12px;">
              <span style="font-size: 28px;">${typeIcon}</span>
              <div style="flex: 1;">
                <h4 style="font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 4px;">
                  ${this.escapeHtml(item.title)}
                </h4>
                <p style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
                  <strong>${this.escapeHtml(
                    item.publication
                  )}</strong> • ${this.escapeHtml(item.date)}
                  ${
                    item.url
                      ? ` • <a href="${this.escapeHtml(
                          item.url
                        )}" target="_blank" style="color: #3b82f6; text-decoration: underline;">View</a>`
                      : ''
                  }
                </p>
                <span style="display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: uppercase; margin-bottom: 12px;">
                  ${this.escapeHtml(item.type)}
                </span>
                ${
                  item.summary
                    ? `
                  <p style="font-size: 13px; color: #374151; line-height: 1.6; margin-bottom: 12px;">
                    ${this.escapeHtml(item.summary)}
                  </p>
                `
                    : ''
                }
                ${
                  item.sdrRelevance
                    ? `
                  <div class="linkedintel-info-box warning">
                    <p class="linkedintel-info-title" style="font-size: 11px;">💼 SDR Relevance</p>
                    <p style="font-size: 13px;">${this.escapeHtml(
                      item.sdrRelevance
                    )}</p>
                  </div>
                `
                    : ''
                }
              </div>
            </div>
          </div>
        `
      })

      html += '</div>'
    }

    // Media Appearances - REMOVED: consolidated into Press Features & Media section below to avoid duplication

    // Press Features from mediaPresence
    if (pressFeatures.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
            <h3 class="linkedintel-section-title">📰 Press Features & Media</h3>
          </div>
      `

      pressFeatures.forEach((feature) => {
        const typeIcons = {
          interview: '🎤',
          profile: '👤',
          quote: '💬',
          podcast: '🎙️',
          article: '📰',
        }
        const typeIcon = typeIcons[feature.type] || '📰'

        html += `
          <div class="linkedintel-card" style="margin-bottom: 16px; border-left: 4px solid #8b5cf6;">
            <div style="display: flex; gap: 12px;">
              <span style="font-size: 28px;">${typeIcon}</span>
              <div style="flex: 1;">
                <h4 style="font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 4px;">
                  ${this.escapeHtml(feature.title || feature.publication)}
                </h4>
                <p style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
                  <strong>${this.escapeHtml(
                    feature.publication
                  )}</strong> • ${this.escapeHtml(feature.date)}
                  ${
                    feature.url
                      ? ` • <a href="${this.escapeHtml(
                          feature.url
                        )}" target="_blank" style="color: #3b82f6; text-decoration: underline;">View Article ↗</a>`
                      : ''
                  }
                </p>
                <span style="display: inline-block; background: #ede9fe; color: #6b21a8; padding: 4px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: uppercase;">
                  ${this.escapeHtml(feature.type || 'media')}
                </span>
                ${
                  feature.topics && feature.topics.length > 0
                    ? `
                  <div style="margin-top: 12px;">
                    <p style="font-size: 11px; color: #6b7280; margin-bottom: 6px; font-weight: 600;">TOPICS:</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                      ${feature.topics
                        .map(
                          (topic) =>
                            `<span style="background: #f3f4f6; color: #374151; padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 500;">${this.escapeHtml(
                              topic
                            )}</span>`
                        )
                        .join('')}
                    </div>
                  </div>
                `
                    : ''
                }
              </div>
            </div>
          </div>
        `
      })

      html += '</div>'
    }

    // Awards from mediaPresence (if not already shown from speakingEngagements.awards)
    if (media?.awards && media.awards.length > 0 && !speaking?.awards) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="7"/>
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
            </svg>
            <h3 class="linkedintel-section-title">🏆 Awards from Media</h3>
          </div>
          <div class="linkedintel-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
            ${media.awards
              .map(
                (award) => `
              <div class="linkedintel-card" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                  <span style="font-size: 32px;">🏆</span>
                  <div>
                    <h4 style="font-size: 14px; font-weight: 600; color: #78350f; margin-bottom: 2px;">
                      ${this.escapeHtml(award.award)}
                    </h4>
                    <p style="font-size: 11px; color: #92400e;">
                      ${this.escapeHtml(award.organization)}
                    </p>
                  </div>
                </div>
                <p style="font-size: 12px; color: #92400e; margin-bottom: 8px;">
                  📅 ${this.escapeHtml(award.date)}
                </p>
                ${
                  award.url
                    ? `
                  <a href="${this.escapeHtml(
                    award.url
                  )}" target="_blank" style="display: inline-block; margin-top: 8px; color: #b45309; font-size: 11px; text-decoration: underline;">
                    View Award ↗
                  </a>
                `
                    : ''
                }
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Expertise Areas
    if (content?.expertiseAreas && content.expertiseAreas.length > 0) {
      html += `
        <div class="linkedintel-section">
          <div class="linkedintel-section-header">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <h3 class="linkedintel-section-title">🎯 Expertise Areas</h3>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 10px; padding: 16px;">
            ${content.expertiseAreas
              .map(
                (area) =>
                  `<span class="linkedintel-badge" style="background: linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%); color: #3730a3; font-size: 14px; padding: 8px 16px; border-radius: 20px; font-weight: 600;">${this.escapeHtml(
                    area
                  )}</span>`
              )
              .join('')}
          </div>
        </div>
      `
    }

    return html
  }

  // NEW: Overview Tab - Industry Context Only
  // Remove citation markers like [1], [2], [1][2], etc.
  stripCitations(text) {
    if (!text) return text
    return text.replace(/\[\d+\](\[\d+\])*/g, '').trim()
  }

  formatCompanyDescription(description) {
    if (!description) return 'No description available'

    // Remove citation markers first
    const cleanDescription = this.stripCitations(description)

    // Split into sentences that could be bullet points
    const sentences = cleanDescription
      .split(/\.(?=\s[A-Z])/)
      .filter((s) => s.trim())

    // If only 1-2 sentences, keep as paragraph
    if (sentences.length <= 2) {
      return `<p class="linkedintel-company-description">${this.escapeHtml(
        cleanDescription
      )}</p>`
    }

    // Convert to bullet list
    return `<ul class="linkedintel-description-list">
      ${sentences
        .map((sentence) => `<li>${this.escapeHtml(sentence.trim())}.</li>`)
        .join('')}
    </ul>`
  }

  generateOverviewTab(data) {
    const companyName = data.companyName || data.name || 'Company'
    const industryContext = data.industryContext || {}
    const description = industryContext.description || ''
    const foundedYear = industryContext.foundedYear || null
    const headquarters = industryContext.headquarters || null
    const productsAndVerticals = industryContext.productsAndVerticals || null
    const customerSegments = industryContext.customerSegments || null
    const competitors = industryContext.competitors || []
    const customers = industryContext.customers || []
    const caseStudies = industryContext.caseStudies || []

    let html = ''

    // Add Chrome AI Quick Summary Section at the top
    if (
      window.chromeAI &&
      window.chromeAI.isAvailable &&
      window.chromeAI.isAvailable('summarizer')
    ) {
      html += `
        <div class="linkedintel-section linkedintel-ai-summary-section" style="margin-bottom: 24px;">
          <div style="background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); border-radius: 16px; padding: 20px; border: 1px solid #c084fc; box-shadow: 0 4px 16px rgba(168, 85, 247, 0.3);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
                </svg>
                <span style="color: white; font-size: 14px; font-weight: 600;">AI Quick Summary</span>
                <span style="background: rgba(255, 255, 255, 0.2); color: white; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px;">On-Device</span>
              </div>
              <button class="linkedintel-ai-summary-generate-btn" data-summary-type="key-points" style="background: white; color: #9333ea; border: none; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
                Generate Summary
              </button>
            </div>
            <div class="linkedintel-ai-summary-content" style="display: none; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.2);">
              <div class="linkedintel-ai-summary-types" style="display: flex; gap: 8px; margin-bottom: 16px;">
                <button class="linkedintel-ai-summary-type-btn active" data-type="key-points" style="background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s ease;">
                  Key Points
                </button>
                <button class="linkedintel-ai-summary-type-btn" data-type="tldr" style="background: rgba(255, 255, 255, 0.1); color: white; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s ease;">
                  TL;DR
                </button>
                <button class="linkedintel-ai-summary-type-btn" data-type="teaser" style="background: rgba(255, 255, 255, 0.1); color: white; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s ease;">
                  Elevator Pitch
                </button>
              </div>
              <div class="linkedintel-ai-summary-result" style="color: white; font-size: 14px; line-height: 1.7; min-height: 60px; white-space: pre-wrap;"></div>
            </div>
            <div class="linkedintel-ai-summary-loading" style="display: none; text-align: center; padding: 20px;">
              <div class="linkedintel-spinner" style="border-color: rgba(255, 255, 255, 0.3); border-top-color: white; margin: 0 auto 12px;"></div>
              <div style="color: white; font-size: 13px;">Generating summary...</div>
            </div>
          </div>
        </div>
      `
    }

    html += `
      <div class="linkedintel-section" style="margin-bottom: 24px;">
        <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; letter-spacing: -0.02em;">
              What ${this.escapeHtml(companyName)} Does
            </h2>
          </div>
          <div style="color: #475569; font-size: 14px; line-height: 1.7;">
            ${this.formatCompanyDescription(description)}
          </div>
        </div>
      </div>
    `

    // Company Basics Section (Status, Founded, HQ, Employees, Industry)
    const overview = data.overview || {}
    const hasCompanyBasics =
      foundedYear ||
      headquarters ||
      overview.isPublic !== undefined ||
      overview.employeeCount ||
      overview.industry

    if (hasCompanyBasics) {
      html += `
        <div class="linkedintel-section" style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
            <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; letter-spacing: -0.02em;">
              Company Basics
            </h2>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
            ${
              overview.isPublic !== undefined
                ? `
              <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04); transition: all 0.2s ease;">
                <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                  COMPANY STATUS
                </div>
                <div style="display: inline-flex; align-items: center; background: ${
                  overview.isPublic
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                }; padding: 8px 16px; border-radius: 24px; gap: 8px; box-shadow: 0 2px 8px ${
                    overview.isPublic
                      ? 'rgba(16, 185, 129, 0.3)'
                      : 'rgba(59, 130, 246, 0.3)'
                  };">
                  <span style="font-size: 18px;">${
                    overview.isPublic ? '📈' : '🔒'
                  }</span>
                  <span style="font-size: 14px; font-weight: 700; color: white; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${overview.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
              </div>
            `
                : ''
            }
            ${
              foundedYear
                ? `
              <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04); transition: all 0.2s ease;">
                <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                  FOUNDED
                </div>
                <div style="font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
                  ${this.escapeHtml(foundedYear)}
                </div>
              </div>
            `
                : ''
            }
            ${
              headquarters
                ? `
              <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04); transition: all 0.2s ease;">
                <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                  HEADQUARTERS
                </div>
                <div style="font-size: 15px; font-weight: 600; color: #1e293b; line-height: 1.4;">
                  ${this.escapeHtml(headquarters)}
                </div>
              </div>
            `
                : ''
            }
            ${
              overview.employeeCount
                ? `
              <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04); transition: all 0.2s ease;">
                <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                  EMPLOYEES
                </div>
                <div style="font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
                  ${this.escapeHtml(overview.employeeCount)}
                </div>
              </div>
            `
                : ''
            }
            ${
              overview.industry
                ? `
              <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04); transition: all 0.2s ease;">
                <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                  INDUSTRY
                </div>
                <div style="font-size: 15px; font-weight: 600; color: #1e293b; line-height: 1.4;">
                  ${this.escapeHtml(overview.industry)}
                </div>
              </div>
            `
                : ''
            }
          </div>
        </div>
      `
    }

    // Products & Verticals Section
    if (productsAndVerticals) {
      html += `
        <div class="linkedintel-section">
          <h2 class="linkedintel-section-title">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
              <line x1="6" y1="6" x2="6.01" y2="6"></line>
              <line x1="6" y1="18" x2="6.01" y2="18"></line>
            </svg>
            Products & Business Verticals
          </h2>
          <div class="linkedintel-card">
            <p class="linkedintel-company-description">${this.escapeHtml(
              this.stripCitations(productsAndVerticals)
            )}</p>
          </div>
        </div>
      `
    }

    // Business Model Section
    if (customerSegments) {
      html += `
        <div class="linkedintel-section">
          <h2 class="linkedintel-section-title">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="7"></circle>
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
            </svg>
            Business Model
          </h2>
          <div class="linkedintel-card">
            <p class="linkedintel-company-description">${this.escapeHtml(
              this.stripCitations(customerSegments)
            )}</p>
          </div>
        </div>
      `
    }

    // Competitors Section
    if (competitors.length > 0) {
      html += `
        <div class="linkedintel-section">
          <h2 class="linkedintel-section-title">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            Top Competitors (${competitors.length})
          </h2>
          <div class="linkedintel-competitors-grid">
            ${competitors
              .map(
                (competitor) => `
              <div class="linkedintel-competitor-chip">${this.escapeHtml(
                this.stripCitations(competitor)
              )}</div>
            `
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Customers Section
    if (customers.length > 0) {
      html += `
        <div class="linkedintel-section">
          <h2 class="linkedintel-section-title">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Known Customers (${customers.length})
          </h2>
          <div class="linkedintel-customers-grid">
            ${customers
              .map(
                (customer) => `
              <div class="linkedintel-customer-chip">${this.escapeHtml(
                this.stripCitations(customer)
              )}</div>
            `
              )
              .join('')}
          </div>
        </div>
      `
    }

    // Case Studies Section
    if (caseStudies.length > 0) {
      html += `
        <div class="linkedintel-section">
          <h2 class="linkedintel-section-title">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
            Case Studies (${caseStudies.length})
          </h2>
          ${caseStudies
            .map(
              (study) => `
            <div class="linkedintel-case-study-card">
              <h3 class="linkedintel-case-study-company">${this.escapeHtml(
                this.stripCitations(study.company)
              )}</h3>
              <p class="linkedintel-case-study-description">${this.escapeHtml(
                this.stripCitations(study.description)
              )}</p>
              <a href="${this.escapeHtml(
                study.url
              )}" target="_blank" rel="noopener noreferrer" class="linkedintel-case-study-link">
                View Case Study
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="linkedintel-external-icon">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            </div>
          `
            )
            .join('')}
        </div>
      `
    }

    if (
      !description &&
      competitors.length === 0 &&
      customers.length === 0 &&
      caseStudies.length === 0
    ) {
      html = `
        <div class="linkedintel-empty-state">
          <svg class="linkedintel-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p class="linkedintel-empty-text">No industry context available</p>
        </div>
      `
    }

    return html
  }

  // NEW: Tech Stack Tab - Technology Stack Only
  generateTechStackTab(data) {
    const techStack = data.techStack || []
    const companyName = data.companyName || 'this company'
    const industry =
      data.stockInfo?.industry || data.industryContext?.description || ''

    if (techStack.length === 0) {
      return `
        <div class="linkedintel-empty-state" style="padding: 32px; text-align: left;">
          <div style="display: flex; align-items: start; gap: 16px;">
            <div style="font-size: 48px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">🔧</div>
            <div style="flex: 1;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1f2937;">No Technology Stack Data</h3>
              <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.6; color: #6b7280;">
                We searched job postings, engineering blogs, partnership announcements, and tech databases but couldn't verify specific technologies used by ${this.escapeHtml(
                  companyName
                )}.
              </p>
              
              <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 3px solid #3b82f6; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
                <div style="display: flex; align-items: start; gap: 10px;">
                  <span style="font-size: 20px;">💡</span>
                  <div>
                    <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #1e40af;">Where to Find Tech Stack Info</p>
                    <ul style="margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.6; color: #1e3a8a;">
                      <li>Check job postings on ${this.escapeHtml(
                        companyName
                      )}'s careers page for required skills</li>
                      <li>Review their engineering blog or developer documentation</li>
                      <li>Look for technology partnerships or integration announcements</li>
                      <li>Search StackShare, G2, or Capterra for integrations</li>
                      <li>Check customer case studies mentioning specific tools</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              ${
                industry
                  ? `
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px;">
                <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 600; color: #374151;">
                  🏢 Common Tools for ${this.escapeHtml(
                    industry.split(' ')[0]
                  )} Companies:
                </p>
                <div style="display: flex; flex-wrap: wrap; gap: 6px; font-size: 11px;">
                  <span style="background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 12px; font-weight: 500;">AWS / Azure / GCP</span>
                  <span style="background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 12px; font-weight: 500;">Salesforce / HubSpot</span>
                  <span style="background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 12px; font-weight: 500;">PostgreSQL / MongoDB</span>
                  <span style="background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 12px; font-weight: 500;">Python / Java / JavaScript</span>
                  <span style="background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 12px; font-weight: 500;">Docker / Kubernetes</span>
                </div>
                <p style="margin: 10px 0 0 0; font-size: 11px; color: #9ca3af;">
                  ℹ️ These are typical for this industry but not confirmed for ${this.escapeHtml(
                    companyName
                  )}
                </p>
              </div>
              `
                  : ''
              }
            </div>
          </div>
        </div>
      `
    }

    // Group by category, but keep full tech objects
    const byCategory = {}
    techStack.forEach((tech) => {
      const category = tech.category || 'Other'
      if (!byCategory[category]) {
        byCategory[category] = []
      }
      byCategory[category].push(tech)
    })

    let html = '<div class="linkedintel-tech-stack-grid">'

    Object.keys(byCategory)
      .sort()
      .forEach((category) => {
        html += `
        <div class="linkedintel-tech-category">
          <h3 class="linkedintel-tech-category-title">${this.escapeHtml(
            category
          )}</h3>
          <div class="linkedintel-tech-tools">
            ${byCategory[category]
              .map((tech) => {
                const hasJobData = tech.jobsCount
                const hiringBadge =
                  tech.hiringIntensity === 'HOT'
                    ? '<span class="linkedintel-hiring-badge hot">🔥 HOT</span>'
                    : tech.hiringIntensity === 'WARM'
                    ? '<span class="linkedintel-hiring-badge warm">⚡ WARM</span>'
                    : ''

                if (hasJobData) {
                  // Build stats array with available data
                  const stats = []

                  // Teams count
                  if (tech.teamsCount) {
                    stats.push(
                      `${tech.teamsCount} team${tech.teamsCount > 1 ? 's' : ''}`
                    )
                  }

                  // People count
                  if (tech.peopleCount) {
                    stats.push(`${tech.peopleCount} people`)
                  }

                  // Jobs count
                  if (tech.jobsCount) {
                    stats.push(
                      `${tech.jobsCount} job${tech.jobsCount > 1 ? 's' : ''}`
                    )
                  }

                  const statsDisplay = stats.length > 0 ? stats.join(' • ') : ''

                  return `
                    <div class="linkedintel-tech-tool-chip with-data">
                      <div class="linkedintel-tech-chip-header">
                        <span class="linkedintel-tech-name">${this.escapeHtml(
                          tech.tool
                        )}</span>
                        ${hiringBadge}
                      </div>
                      ${
                        statsDisplay
                          ? `
                      <div class="linkedintel-tech-meta">
                        <span class="linkedintel-tech-stats">${statsDisplay}</span>
                      </div>
                      `
                          : ''
                      }
                      ${
                        tech.lastJobPost
                          ? `<div class="linkedintel-tech-meta"><span class="linkedintel-last-post">Posted ${tech.daysSinceLastPost}d ago</span></div>`
                          : ''
                      }
                    </div>
                  `
                } else {
                  return `
                    <div class="linkedintel-tech-tool-chip">
                      <span class="linkedintel-tech-name">${this.escapeHtml(
                        tech.tool || tech
                      )}</span>
                    </div>
                  `
                }
              })
              .join('')}
          </div>
        </div>
      `
      })

    html += '</div>'

    return html
  }

  // NEW: Financial Tab - Enhanced Visual Design
  generateFinancialTab(data) {
    const stockInfo = data.stockInfo || {}
    const overview = data.overview || {}
    const financialSummary = stockInfo.financialSummary || {}
    const isPublic = overview.isPublic || false

    // Extract funding data (used for both public and private companies)
    const fundingRounds =
      stockInfo.fundingRounds || financialSummary.fundingRounds || []
    const fundingStage =
      stockInfo.fundingStage || financialSummary.fundingStage || null
    const notableInvestors =
      stockInfo.notableInvestors || financialSummary.notableInvestors || []
    const totalFunding =
      stockInfo.totalFunding || financialSummary.totalFunding || null
    const latestValuation =
      stockInfo.latestValuation || financialSummary.latestValuation || null
    const lastFunding = financialSummary.lastFunding || {}
    const revenueChange = financialSummary.revenueChange || {}

    let html = '<div class="linkedintel-financial-summary">'

    if (isPublic) {
      // Public Company Financial Display
      const priceTrajectory = financialSummary.priceTrajectory || {}
      const earningsPerformance = financialSummary.earningsPerformance || {}
      const sentiment = financialSummary.sentiment || 'neutral'
      const sentimentReason = financialSummary.sentimentReason || ''
      const revenueChange = financialSummary.revenueChange || {}
      const performanceTrend = stockInfo.performanceTrend || {}

      // Subsidiary Notice (if applicable)
      const isSubsidiary = this.isSubsidiary(data)
      const parentCompany = this.getParentCompany(data)
      if (isSubsidiary && parentCompany) {
        html += `
          <div class="linkedintel-subsidiary-notice" style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border: 2px solid #f97316; border-radius: 12px; padding: 14px 18px; margin: 0 0 20px 0; display: flex; align-items: flex-start; gap: 12px; box-shadow: 0 2px 8px rgba(249, 115, 22, 0.15);">
            <span style="font-size: 28px; line-height: 1;">⚠️</span>
            <div style="flex: 1;">
              <div style="font-size: 14px; font-weight: 700; color: #c2410c; margin-bottom: 6px;">
                📈 Important: Parent Company Financials
              </div>
              <div style="font-size: 13px; color: #9a3412; line-height: 1.6; margin-bottom: 8px;">
                <strong>${
                  data.companyName || 'This company'
                }</strong> is a <strong>division/subsidiary</strong> of <strong>${parentCompany}</strong>.
              </div>
              <div style="font-size: 12px; color: #7c2d12; line-height: 1.5; background: rgba(255, 255, 255, 0.6); padding: 8px 10px; border-radius: 6px; border-left: 3px solid #f97316;">
                <strong>⚡ Key Point:</strong> All financial metrics below (stock price, market cap, revenue, etc.) represent <strong>${parentCompany}'s</strong> consolidated financials, NOT this specific division's performance.
              </div>
            </div>
          </div>
        `
      }

      // 1. Metrics Grid at Top
      html += '<div class="linkedintel-financial-metrics-grid">'

      // Stock Trend Card
      if (priceTrajectory.direction) {
        const directionIcon =
          priceTrajectory.direction === 'up'
            ? '↑'
            : priceTrajectory.direction === 'down'
            ? '↓'
            : '→'
        const directionColor =
          priceTrajectory.direction === 'up'
            ? 'success'
            : priceTrajectory.direction === 'down'
            ? 'danger'
            : 'neutral'
        const percentage = Math.abs(priceTrajectory.percentage || 0).toFixed(1)

        html += `
          <div class="linkedintel-financial-stat-card linkedintel-stat-${directionColor}">
            <div class="linkedintel-stat-label">6-Month Trend</div>
            <div class="linkedintel-stat-value">${directionIcon} ${percentage}%</div>
          </div>
        `
      }

      // YoY Performance Card
      if (stockInfo.yoy != null) {
        const yoyIcon = stockInfo.yoy >= 0 ? '↑' : '↓'
        const yoyColor = stockInfo.yoy >= 0 ? 'success' : 'danger'
        html += `
          <div class="linkedintel-financial-stat-card linkedintel-stat-${yoyColor}">
            <div class="linkedintel-stat-label">YoY Performance</div>
            <div class="linkedintel-stat-value">${yoyIcon} ${Math.abs(
          stockInfo.yoy
        ).toFixed(1)}%</div>
          </div>
        `
      }

      // Dynamic Financial Metrics - Filter out null/invalid values
      const rawDynamicFinancials = stockInfo.dynamicFinancials || []
      const dynamicFinancials = rawDynamicFinancials.filter((m) => {
        if (!m || !m.label || !m.value) return false

        const valueStr = String(m.value).trim().toLowerCase()
        const invalidValues = [
          'null',
          'not available',
          'not disclosed',
          'n/a',
          'na',
          'not applicable',
          'unavailable',
        ]

        return !invalidValues.includes(valueStr)
      })

      // Debug logging
      const filteredOut = rawDynamicFinancials.filter((m) => {
        if (!m || !m.label || !m.value) return true
        const valueStr = String(m.value).trim().toLowerCase()
        const invalidValues = [
          'null',
          'not available',
          'not disclosed',
          'n/a',
          'na',
          'not applicable',
          'unavailable',
        ]
        return invalidValues.includes(valueStr)
      })

      panelLogger.info('Financial Tab - Dynamic Financials (Public):', {
        hasDynamicFinancials: !!stockInfo.dynamicFinancials,
        rawCount: rawDynamicFinancials.length,
        validCount: dynamicFinancials.length,
        filteredCount: filteredOut.length,
        validMetrics: dynamicFinancials.map((m) => ({
          label: m.label,
          value: m.value,
        })),
        filteredMetrics: filteredOut.map((m) => ({
          label: m?.label,
          value: m?.value,
        })),
      })

      if (dynamicFinancials.length === 0 && rawDynamicFinancials.length > 0) {
        panelLogger.warn(
          `⚠️ All ${rawDynamicFinancials.length} dynamic financials were filtered out (placeholder values detected)`,
          filteredOut
        )
      }

      dynamicFinancials.forEach((metric) => {
        if (metric && metric.label && metric.value) {
          html += `
            <div class="linkedintel-financial-stat-card">
              <div class="linkedintel-stat-label">${this.escapeHtml(
                metric.label
              )}</div>
              <div class="linkedintel-stat-value">${this.escapeHtml(
                metric.value
              )}</div>
            </div>
          `
        }
      })

      html += '</div>' // Close metrics grid

      // Performance Indicators Badge Section
      html += '<div class="linkedintel-performance-indicators">'

      // Momentum Badge
      if (performanceTrend.momentum) {
        const momentumIcons = {
          accelerating: '🚀',
          steady: '➡️',
          decelerating: '🐌',
        }
        const momentumColors = {
          accelerating: 'success',
          steady: 'info',
          decelerating: 'warning',
        }
        const icon = momentumIcons[performanceTrend.momentum] || '➡️'
        const color = momentumColors[performanceTrend.momentum] || 'info'
        html += `
          <div class="linkedintel-performance-badge linkedintel-badge-${color}">
            <span class="linkedintel-badge-icon">${icon}</span>
            <span class="linkedintel-badge-label">Momentum: ${this.escapeHtml(
              performanceTrend.momentum
            )}</span>
          </div>
        `
      }

      // Volatility Badge
      if (performanceTrend.volatility) {
        const volatilityIcons = {
          high: '⚡',
          moderate: '〰️',
          low: '📊',
        }
        const volatilityColors = {
          high: 'danger',
          moderate: 'warning',
          low: 'success',
        }
        const icon = volatilityIcons[performanceTrend.volatility] || '〰️'
        const color = volatilityColors[performanceTrend.volatility] || 'warning'
        html += `
          <div class="linkedintel-performance-badge linkedintel-badge-${color}">
            <span class="linkedintel-badge-icon">${icon}</span>
            <span class="linkedintel-badge-label">Volatility: ${this.escapeHtml(
              performanceTrend.volatility
            )}</span>
          </div>
        `
      }

      // Earnings Badges (Q1 and Q2)
      if (earningsPerformance.q1 && earningsPerformance.q1 !== 'n/a') {
        const earningsIcons = { beat: '✅', miss: '❌', met: '➖' }
        const earningsColors = { beat: 'success', miss: 'danger', met: 'info' }
        const icon = earningsIcons[earningsPerformance.q1] || '➖'
        const color = earningsColors[earningsPerformance.q1] || 'info'
        html += `
          <div class="linkedintel-performance-badge linkedintel-badge-${color}">
            <span class="linkedintel-badge-icon">${icon}</span>
            <span class="linkedintel-badge-label">Q1: ${this.escapeHtml(
              earningsPerformance.q1
            )}</span>
          </div>
        `
      }

      if (earningsPerformance.q2 && earningsPerformance.q2 !== 'n/a') {
        const earningsIcons = { beat: '✅', miss: '❌', met: '➖' }
        const earningsColors = { beat: 'success', miss: 'danger', met: 'info' }
        const icon = earningsIcons[earningsPerformance.q2] || '➖'
        const color = earningsColors[earningsPerformance.q2] || 'info'
        html += `
          <div class="linkedintel-performance-badge linkedintel-badge-${color}">
            <span class="linkedintel-badge-icon">${icon}</span>
            <span class="linkedintel-badge-label">Q2: ${this.escapeHtml(
              earningsPerformance.q2
            )}</span>
          </div>
        `
      }

      // Earnings Call Transcript Link (if available)
      const companyChallenges = data.companyChallenges || {}
      const earningsCallData = companyChallenges.earningsCallNegativeNews
      if (earningsCallData) {
        const earningsUrl =
          typeof earningsCallData === 'object' ? earningsCallData?.url : null
        if (earningsUrl) {
          html += `
            <a href="${this.escapeHtml(
              earningsUrl
            )}" target="_blank" rel="noopener noreferrer" 
               class="linkedintel-performance-badge linkedintel-badge-info" 
               style="text-decoration: none; cursor: pointer; transition: all 0.2s ease;">
              <span class="linkedintel-badge-icon">📄</span>
              <span class="linkedintel-badge-label">Earnings Transcript</span>
            </a>
          `
        }
      }

      // Financial Filings Links - Multi-country support (US, India, UK, EU, Canada, Australia, etc.)
      const ticker = stockInfo.ticker || stockInfo.symbol || data.ticker
      const exchange = (stockInfo.exchange || '').toUpperCase()
      const headquarters = (
        overview.headquarters ||
        data.headquarters ||
        ''
      ).toLowerCase()

      // Detect country/region from exchange or headquarters
      const isUSA =
        exchange.includes('NYSE') ||
        exchange.includes('NASDAQ') ||
        exchange.includes('AMEX') ||
        headquarters.includes('united states') ||
        headquarters.includes('usa')
      const isIndia =
        exchange.includes('BSE') ||
        exchange.includes('NSE') ||
        headquarters.includes('india')
      const isUK =
        exchange.includes('LSE') ||
        exchange.includes('LONDON') ||
        headquarters.includes('united kingdom') ||
        headquarters.includes('uk')
      const isCanada =
        exchange.includes('TSX') ||
        exchange.includes('TSE') ||
        headquarters.includes('canada')
      const isAustralia =
        exchange.includes('ASX') || headquarters.includes('australia')
      const isJapan =
        exchange.includes('TSE') ||
        exchange.includes('TOKYO') ||
        headquarters.includes('japan')
      const isHongKong =
        exchange.includes('HKEX') ||
        exchange.includes('HKG') ||
        headquarters.includes('hong kong')

      if (ticker) {
        if (isUSA) {
          // US SEC Filings (10-K, 10-Q)
          const tenKUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(
            ticker
          )}&type=10-K&dateb=&owner=exclude&count=40`
          html += `
            <a href="${tenKUrl}" target="_blank" rel="noopener noreferrer" 
               class="linkedintel-performance-badge linkedintel-badge-success" 
               style="text-decoration: none; cursor: pointer; transition: all 0.2s ease;"
               title="View 10-K Annual Reports on SEC.gov">
              <span class="linkedintel-badge-icon">📊</span>
              <span class="linkedintel-badge-label">10-K Reports (US)</span>
            </a>
          `

          const tenQUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(
            ticker
          )}&type=10-Q&dateb=&owner=exclude&count=40`
          html += `
            <a href="${tenQUrl}" target="_blank" rel="noopener noreferrer" 
               class="linkedintel-performance-badge linkedintel-badge-success" 
               style="text-decoration: none; cursor: pointer; transition: all 0.2s ease;"
               title="View 10-Q Quarterly Reports on SEC.gov">
              <span class="linkedintel-badge-icon">📈</span>
              <span class="linkedintel-badge-label">10-Q Reports (US)</span>
            </a>
          `
        } else if (isIndia) {
          // India - BSE/NSE Filings
          if (exchange.includes('BSE')) {
            // BSE (Bombay Stock Exchange)
            const bseUrl = `https://www.bseindia.com/stock-share-price/stock-news-announcement/${encodeURIComponent(
              ticker
            )}/`
            html += `
              <a href="${bseUrl}" target="_blank" rel="noopener noreferrer" 
                 class="linkedintel-performance-badge linkedintel-badge-success" 
                 style="text-decoration: none; cursor: pointer; transition: all 0.2s ease;"
                 title="View BSE Announcements & Annual Reports">
                <span class="linkedintel-badge-icon">🇮🇳</span>
                <span class="linkedintel-badge-label">BSE Reports (India)</span>
              </a>
            `
          }
          if (exchange.includes('NSE')) {
            // NSE (National Stock Exchange)
            const nseUrl = `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(
              ticker
            )}`
            html += `
              <a href="${nseUrl}" target="_blank" rel="noopener noreferrer" 
                 class="linkedintel-performance-badge linkedintel-badge-success" 
                 style="text-decoration: none; cursor: pointer; transition: all 0.2s ease;"
                 title="View NSE Announcements & Financial Results">
                <span class="linkedintel-badge-icon">🇮🇳</span>
                <span class="linkedintel-badge-label">NSE Reports (India)</span>
              </a>
            `
          }
          // SEBI Filings (Securities and Exchange Board of India)
          html += `
            <a href="https://www.sebi.gov.in/" target="_blank" rel="noopener noreferrer" 
               class="linkedintel-performance-badge linkedintel-badge-info" 
               style="text-decoration: none; cursor: pointer; transition: all 0.2s ease;"
               title="Search SEBI Filings (India)">
              <span class="linkedintel-badge-icon">📄</span>
              <span class="linkedintel-badge-label">SEBI Filings</span>
            </a>
          `
        } else if (isUK) {
          // UK - Companies House & LSE
          const companiesHouseUrl = `https://find-and-update.company-information.service.gov.uk/search?q=${encodeURIComponent(
            data.companyName || ticker
          )}`
          html += `
            <a href="${companiesHouseUrl}" target="_blank" rel="noopener noreferrer" 
               class="linkedintel-performance-badge linkedintel-badge-success" 
               style="text-decoration: none; cursor: pointer; transition: all 0.2s ease;"
               title="View Companies House Filings (UK)">
              <span class="linkedintel-badge-icon">🇬🇧</span>
              <span class="linkedintel-badge-label">Companies House (UK)</span>
            </a>
          `

          const lseUrl = `https://www.londonstockexchange.com/search?q=${encodeURIComponent(
            ticker
          )}`
          html += `
            <a href="${lseUrl}" target="_blank" rel="noopener noreferrer" 
               class="linkedintel-performance-badge linkedintel-badge-info" 
               style="text-decoration: none; cursor: pointer; transition: all 0.2s ease;"
               title="View LSE Reports & RNS Announcements">
              <span class="linkedintel-badge-icon">📊</span>
              <span class="linkedintel-badge-label">LSE Reports (UK)</span>
            </a>
          `
        } else if (isCanada) {
          // Canada - SEDAR+ with company search
          // Try to construct a search URL using company name
          const companyName = data.companyName || ticker
          const sedarSearchUrl = `https://www.sedarplus.ca/csa-party/search/?q=${encodeURIComponent(
            companyName
          )}`
          html += `
            <a href="${sedarSearchUrl}" target="_blank" rel="noopener noreferrer" 
               class="linkedintel-performance-badge linkedintel-badge-success" 
               style="text-decoration: none; cursor: pointer; transition: all 0.2s ease;"
               title="Search SEDAR+ Filings for ${this.escapeHtml(
                 companyName
               )}">
              <span class="linkedintel-badge-icon">🇨🇦</span>
              <span class="linkedintel-badge-label">SEDAR+ Reports (Canada)</span>
            </a>
          `
        } else if (isAustralia) {
          // Australia - ASX
          const asxUrl = `https://www2.asx.com.au/markets/company/${encodeURIComponent(
            ticker
          )}`
          html += `
            <a href="${asxUrl}" target="_blank" rel="noopener noreferrer" 
               class="linkedintel-performance-badge linkedintel-badge-success" 
               style="text-decoration: none; cursor: pointer; transition: all 0.2s ease;"
               title="View ASX Announcements & Reports (Australia)">
              <span class="linkedintel-badge-icon">🇦🇺</span>
              <span class="linkedintel-badge-label">ASX Reports (Australia)</span>
            </a>
          `
        } else if (isJapan) {
          // Japan - EDINET
          const edinetUrl = `https://disclosure2.edinet-fsa.go.jp/WZEK0010.aspx`
          html += `
            <a href="${edinetUrl}" target="_blank" rel="noopener noreferrer" 
               class="linkedintel-performance-badge linkedintel-badge-success" 
               style="text-decoration: none; cursor: pointer; transition: all 0.2s ease;"
               title="View EDINET Filings (Japan)">
              <span class="linkedintel-badge-icon">🇯🇵</span>
              <span class="linkedintel-badge-label">EDINET Reports (Japan)</span>
            </a>
          `
        } else if (isHongKong) {
          // Hong Kong - HKEXnews
          const hkexUrl = `https://www1.hkexnews.hk/search/titlesearch.xhtml?lang=en`
          html += `
            <a href="${hkexUrl}" target="_blank" rel="noopener noreferrer" 
               class="linkedintel-performance-badge linkedintel-badge-success" 
               style="text-decoration: none; cursor: pointer; transition: all 0.2s ease;"
               title="View HKEXnews Filings (Hong Kong)">
              <span class="linkedintel-badge-icon">🇭🇰</span>
              <span class="linkedintel-badge-label">HKEX Reports (HK)</span>
            </a>
          `
        } else {
          // Fallback - Generic US SEC (most international companies file with SEC if listed in US)
          const tenKUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(
            ticker
          )}&type=10-K&dateb=&owner=exclude&count=40`
          html += `
            <a href="${tenKUrl}" target="_blank" rel="noopener noreferrer" 
               class="linkedintel-performance-badge linkedintel-badge-success" 
               style="text-decoration: none; cursor: pointer; transition: all 0.2s ease;"
               title="View Annual Reports">
              <span class="linkedintel-badge-icon">📊</span>
              <span class="linkedintel-badge-label">Annual Reports</span>
            </a>
          `
        }
      }

      // Exchange Badge
      if (stockInfo.exchange) {
        html += `
          <div class="linkedintel-performance-badge linkedintel-badge-info">
            <span class="linkedintel-badge-icon">🏛️</span>
            <span class="linkedintel-badge-label">${this.escapeHtml(
              stockInfo.exchange
            )}</span>
          </div>
        `
      }

      html += '</div>' // Close performance indicators

      // 2. Performance Trend Card (if available)
      if (performanceTrend.context) {
        html += `
          <div class="linkedintel-financial-info-card">
            <div class="linkedintel-info-card-header">
              <div class="linkedintel-info-card-icon">📊</div>
              <div class="linkedintel-info-card-title">Performance Analysis</div>
            </div>
            <p class="linkedintel-info-card-text">${this.escapeHtml(
              performanceTrend.context
            )}</p>
          </div>
        `
      }

      // 3. Market Sentiment Card
      if (sentiment) {
        const sentimentColor =
          sentiment === 'positive'
            ? 'success'
            : sentiment === 'negative'
            ? 'danger'
            : 'neutral'
        const sentimentIcon =
          sentiment === 'positive'
            ? '📈'
            : sentiment === 'negative'
            ? '📉'
            : '➡️'
        const sentimentLabel =
          sentiment.charAt(0).toUpperCase() + sentiment.slice(1)

        html += `
          <div class="linkedintel-financial-sentiment-card linkedintel-sentiment-${sentimentColor}">
            <div class="linkedintel-sentiment-header">
              <div class="linkedintel-sentiment-icon">${sentimentIcon}</div>
              <div>
                <div class="linkedintel-sentiment-label">Market Sentiment</div>
                <div class="linkedintel-sentiment-value">${sentimentLabel}</div>
              </div>
            </div>
            ${
              sentimentReason
                ? `<p class="linkedintel-sentiment-reason">${this.escapeHtml(
                    sentimentReason
                  )}</p>`
                : ''
            }
          </div>
        `
      }

      // 4. Revenue Trend Card
      if (revenueChange.context) {
        html += `
          <div class="linkedintel-financial-info-card">
            <div class="linkedintel-info-card-header">
              <div class="linkedintel-info-card-icon">💰</div>
              <div class="linkedintel-info-card-title">Revenue Trend</div>
            </div>
            <p class="linkedintel-info-card-text">${this.escapeHtml(
              revenueChange.context
            )}</p>
          </div>
        `
      }

      // 5. Notable Investors Section (Pre-IPO backers for public companies)
      const publicNotableInvestors = stockInfo.notableInvestors || []
      if (
        Array.isArray(publicNotableInvestors) &&
        publicNotableInvestors.length > 0
      ) {
        html += `
          <div class="linkedintel-financial-info-card" style="margin: 20px 0;">
            <div class="linkedintel-info-card-header">
              <div class="linkedintel-info-card-icon">🏆</div>
              <div class="linkedintel-info-card-title">Early Investors (Pre-IPO)</div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;">
              ${publicNotableInvestors
                .map(
                  (investor) =>
                    `<div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; color: #0369a1; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                      <span style="font-size: 14px;">💼</span>
                      ${this.escapeHtml(investor)}
                    </div>`
                )
                .join('')}
            </div>
          </div>
        `
      } else {
        // Show informational message for public companies without investor data
        html += `
          <div class="linkedintel-financial-info-card" style="margin: 20px 0; background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border: 1px solid #e5e7eb;">
            <div class="linkedintel-info-card-header">
              <div class="linkedintel-info-card-icon">ℹ️</div>
              <div class="linkedintel-info-card-title">Investor Information</div>
            </div>
            <p class="linkedintel-info-card-text" style="margin-top: 12px; font-size: 13px; color: #6b7280; line-height: 1.5;">
              Pre-IPO investor information is typically not available for established public companies. For current ownership details, check institutional holdings via the earnings reports or SEC/SEDAR+ filings above.
            </p>
          </div>
        `
      }
    } else {
      // ========================================
      // PRIVATE COMPANY FINANCIAL DISPLAY
      // ========================================
      const sentiment = financialSummary.sentiment || 'neutral'
      const sentimentReason = financialSummary.sentimentReason || ''
      const growthMetrics = financialSummary.growthMetrics || {}

      // Check if we have meaningful data
      const hasFinancialData =
        totalFunding ||
        latestValuation ||
        financialSummary.revenueEstimate ||
        lastFunding.amount ||
        revenueChange.context ||
        fundingRounds.length > 0 ||
        notableInvestors.length > 0 ||
        (stockInfo.dynamicFinancials && stockInfo.dynamicFinancials.length > 0)

      if (hasFinancialData) {
        // FUNDING STAGE BADGE (at top if available)
        if (fundingStage) {
          const stageColors = {
            'Pre-seed': 'info',
            Seed: 'info',
            'Series A': 'success',
            'Series B': 'success',
            'Series C': 'success',
            'Series D+': 'success',
            Growth: 'warning',
            'Late Stage': 'warning',
            Bootstrapped: 'neutral',
          }
          const stageEmojis = {
            'Pre-seed': '🌱',
            Seed: '🌱',
            'Series A': '🚀',
            'Series B': '🚀',
            'Series C': '🚀',
            'Series D+': '🚀',
            Growth: '📈',
            'Late Stage': '💼',
            Bootstrapped: '🛠️',
          }
          const color = stageColors[fundingStage] || 'info'
          const emoji = stageEmojis[fundingStage] || '💰'

          html += `
            <div style="margin-bottom: 20px;">
              <div class="linkedintel-performance-badge linkedintel-badge-${color}" style="display: inline-flex; padding: 8px 16px; border-radius: 8px;">
                <span class="linkedintel-badge-icon">${emoji}</span>
                <span class="linkedintel-badge-label" style="font-size: 13px; font-weight: 600;">${this.escapeHtml(
                  fundingStage
                )} Company</span>
              </div>
            </div>
          `
        }

        // METRICS GRID
        html += '<div class="linkedintel-financial-metrics-grid">'

        // Dynamic Financial Metrics (preferred method) - Filter out null/invalid values
        const rawDynamicFinancials = stockInfo.dynamicFinancials || []
        const dynamicFinancials = rawDynamicFinancials.filter((m) => {
          if (!m || !m.label || !m.value) return false

          const valueStr = String(m.value).trim().toLowerCase()
          const invalidValues = [
            'null',
            'not available',
            'not disclosed',
            'n/a',
            'na',
            'not applicable',
            'unavailable',
            'not yet profitable', // Private companies specific
          ]

          return !invalidValues.includes(valueStr)
        })

        // Debug logging for private companies
        const filteredOut = rawDynamicFinancials.filter((m) => {
          if (!m || !m.label || !m.value) return true
          const valueStr = String(m.value).trim().toLowerCase()
          const invalidValues = [
            'null',
            'not available',
            'not disclosed',
            'n/a',
            'na',
            'not applicable',
            'unavailable',
            'not yet profitable',
          ]
          return invalidValues.includes(valueStr)
        })

        panelLogger.info('Private Company - Financial Data:', {
          dynamicFinancials: {
            rawCount: rawDynamicFinancials.length,
            validCount: dynamicFinancials.length,
            filteredCount: filteredOut.length,
            validMetrics: dynamicFinancials.map((m) => ({
              label: m.label,
              value: m.value,
            })),
          },
          fundingData: {
            fundingStage,
            totalFunding,
            latestValuation,
            fundingRoundsCount: fundingRounds.length,
            notableInvestorsCount: notableInvestors.length,
            fundingRounds: fundingRounds.map((r) => ({
              round: r.round,
              amount: r.amount,
              date: r.date,
            })),
            notableInvestors,
          },
          dataLocations: {
            fundingRoundsFrom:
              stockInfo.fundingRounds?.length > 0
                ? 'stockInfo'
                : financialSummary.fundingRounds?.length > 0
                ? 'financialSummary'
                : 'none',
            notableInvestorsFrom:
              stockInfo.notableInvestors?.length > 0
                ? 'stockInfo'
                : financialSummary.notableInvestors?.length > 0
                ? 'financialSummary'
                : 'none',
          },
        })

        if (dynamicFinancials.length === 0 && rawDynamicFinancials.length > 0) {
          panelLogger.warn(
            `⚠️ All ${rawDynamicFinancials.length} private company dynamic financials were filtered out (placeholder values detected)`,
            filteredOut
          )
        }

        if (dynamicFinancials.length > 0) {
          // Use dynamic metrics from Perplexity (preferred)
          panelLogger.info('✅ Using dynamic financials for private company')

          // Render each metric with smart styling
          dynamicFinancials.forEach((metric) => {
            if (metric && metric.label && metric.value) {
              // Detect positive metrics for green styling
              const labelLower = String(metric.label).toLowerCase()
              const valueStr = String(metric.value)
              const isGrowthMetric =
                labelLower.includes('growth') ||
                labelLower.includes('increase') ||
                (valueStr.includes('+') && valueStr.includes('%'))

              const cardClass = isGrowthMetric
                ? 'linkedintel-financial-stat-card linkedintel-stat-success'
                : 'linkedintel-financial-stat-card'

              html += `
                <div class="${cardClass}">
                  <div class="linkedintel-stat-label">${this.escapeHtml(
                    metric.label
                  )}</div>
                  <div class="linkedintel-stat-value">${this.escapeHtml(
                    metric.value
                  )}</div>
                </div>
              `
            }
          })
        } else {
          // Fallback to legacy private company fields
          panelLogger.info('Using legacy private company fields (fallback)')

          // Total Funding Card
          if (totalFunding) {
            html += `
              <div class="linkedintel-financial-stat-card">
                <div class="linkedintel-stat-label">Total Funding</div>
                <div class="linkedintel-stat-value">${this.escapeHtml(
                  totalFunding
                )}</div>
              </div>
            `
          }

          // Latest Valuation Card
          if (latestValuation) {
            html += `
              <div class="linkedintel-financial-stat-card">
                <div class="linkedintel-stat-label">Valuation</div>
                <div class="linkedintel-stat-value">${this.escapeHtml(
                  latestValuation
                )}</div>
                <div class="linkedintel-stat-sublabel" style="font-size: 11px; color: #6b7280; margin-top: 4px;">Post-money</div>
              </div>
            `
          }

          // Revenue Estimate Card (with "Est." label)
          if (financialSummary.revenueEstimate) {
            html += `
              <div class="linkedintel-financial-stat-card">
                <div class="linkedintel-stat-label">Revenue <span style="font-size: 10px; color: #9ca3af;">(Est.)</span></div>
                <div class="linkedintel-stat-value">${this.escapeHtml(
                  financialSummary.revenueEstimate
                )}</div>
              </div>
            `
          }

          // Revenue Growth % Card
          if (growthMetrics.revenueGrowth) {
            html += `
              <div class="linkedintel-financial-stat-card linkedintel-stat-success">
                <div class="linkedintel-stat-label">Revenue Growth</div>
                <div class="linkedintel-stat-value">↑ ${this.escapeHtml(
                  growthMetrics.revenueGrowth
                )}</div>
              </div>
            `
          }

          // Employee Growth Card
          if (growthMetrics.employeeGrowth) {
            html += `
              <div class="linkedintel-financial-stat-card linkedintel-stat-success">
                <div class="linkedintel-stat-label">Headcount Growth</div>
                <div class="linkedintel-stat-value">${this.escapeHtml(
                  growthMetrics.employeeGrowth
                )}</div>
              </div>
            `
          }

          // Customer Growth Card
          if (growthMetrics.customerGrowth) {
            html += `
              <div class="linkedintel-financial-stat-card">
                <div class="linkedintel-stat-label">Customers</div>
                <div class="linkedintel-stat-value">${this.escapeHtml(
                  growthMetrics.customerGrowth
                )}</div>
              </div>
            `
          }
        }

        html += '</div>' // Close metrics grid

        // NOTABLE INVESTORS SECTION (if available)
        if (Array.isArray(notableInvestors) && notableInvestors.length > 0) {
          html += `
            <div class="linkedintel-financial-info-card" style="margin: 20px 0;">
              <div class="linkedintel-info-card-header">
                <div class="linkedintel-info-card-icon">🏆</div>
                <div class="linkedintel-info-card-title">Notable Investors</div>
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;">
                ${notableInvestors
                  .map(
                    (investor) =>
                      `<div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; color: #0369a1; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                        <span style="font-size: 14px;">💼</span>
                        ${this.escapeHtml(investor)}
                      </div>`
                  )
                  .join('')}
              </div>
            </div>
          `
        }

        // FUNDING HISTORY TIMELINE (if multiple rounds available)
        if (Array.isArray(fundingRounds) && fundingRounds.length > 0) {
          html += `
            <div class="linkedintel-funding-timeline" style="margin: 20px 0; padding: 20px; background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border-radius: 12px; border: 1px solid #e5e7eb;">
              <h4 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; color: #1f2937; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">💰</span> Funding History
              </h4>
              <div style="position: relative; padding-left: 32px;">
                <div style="position: absolute; left: 11px; top: 8px; bottom: 8px; width: 2px; background: linear-gradient(to bottom, #3b82f6, #93c5fd);"></div>
          `

          fundingRounds.forEach((round, index) => {
            // Format date
            let formattedDate = round.date
            if (round.date) {
              try {
                const date = new Date(round.date)
                formattedDate = date.toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })
              } catch (e) {
                formattedDate = round.date
              }
            }

            html += `
              <div style="position: relative; margin-bottom: ${
                index < fundingRounds.length - 1 ? '20px' : '0'
              }; display: flex; align-items: start; gap: 12px;">
                <div style="position: absolute; left: -28px; width: 24px; height: 24px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3); z-index: 1;"></div>
                <div style="flex: 1; background: white; padding: 12px 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
                    <span style="display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${this.escapeHtml(
                      round.round
                    )}</span>
                    <span style="font-size: 16px; font-weight: 700; color: #059669;">${this.escapeHtml(
                      round.amount
                    )}</span>
                  </div>
                  <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">
                    ${formattedDate}${
              round.valuation
                ? ` • Valuation: ${this.escapeHtml(round.valuation)}`
                : ''
            }
                  </div>
                  ${
                    round.investors && round.investors.length > 0
                      ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                      ${round.investors
                        .slice(0, 3)
                        .map(
                          (investor) =>
                            `<span style="background: #f3f4f6; color: #374151; padding: 3px 8px; border-radius: 4px; font-size: 11px;">${this.escapeHtml(
                              investor
                            )}</span>`
                        )
                        .join('')}
                      ${
                        round.investors.length > 3
                          ? `<span style="color: #6b7280; font-size: 11px; padding: 3px 4px;">+${
                              round.investors.length - 3
                            } more</span>`
                          : ''
                      }
                    </div>
                  `
                      : ''
                  }
                </div>
              </div>
            `
          })

          html += `
              </div>
            </div>
          `
        } else if (lastFunding.amount) {
          // Fallback: Show single funding card if no fundingRounds but lastFunding exists
          let formattedDate = lastFunding.date
          if (lastFunding.date) {
            try {
              const date = new Date(lastFunding.date)
              formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
              })
            } catch (e) {
              formattedDate = lastFunding.date
            }
          }

          html += `
            <div class="linkedintel-funding-card" style="margin: 20px 0;">
              <div class="linkedintel-funding-header">
                <div class="linkedintel-funding-icon">💰</div>
                <div>
                  <div class="linkedintel-funding-label">Last Funding Round</div>
                  <div class="linkedintel-funding-amount">${this.escapeHtml(
                    lastFunding.amount
                  )}</div>
                </div>
              </div>
              <div class="linkedintel-funding-date">
                <span class="linkedintel-funding-date-label">Announced:</span>
                <span class="linkedintel-funding-date-value">${this.escapeHtml(
                  formattedDate
                )}</span>
              </div>
          `

          if (
            Array.isArray(lastFunding.investors) &&
            lastFunding.investors.length > 0
          ) {
            html += `
              <div class="linkedintel-funding-investors">
                <div class="linkedintel-funding-investors-label">Lead Investors</div>
                <div class="linkedintel-investor-pills">
                  ${lastFunding.investors
                    .map(
                      (investor) =>
                        `<div class="linkedintel-investor-pill">${this.escapeHtml(
                          investor
                        )}</div>`
                    )
                    .join('')}
                </div>
              </div>
            `
          }

          html += `</div>` // Close funding card
        }

        // Revenue Context Card
        if (revenueChange.context) {
          const directionIcon =
            revenueChange.direction === 'up'
              ? '📈'
              : revenueChange.direction === 'down'
              ? '📉'
              : '➡️'
          const directionColor =
            revenueChange.direction === 'up'
              ? 'success'
              : revenueChange.direction === 'down'
              ? 'danger'
              : 'neutral'

          html += `
            <div class="linkedintel-financial-info-card linkedintel-revenue-growth-card linkedintel-card-${directionColor}">
              <div class="linkedintel-info-card-header">
                <div class="linkedintel-info-card-icon">${directionIcon}</div>
                <div class="linkedintel-info-card-title">Revenue Context</div>
              </div>
              <p class="linkedintel-info-card-text">${this.escapeHtml(
                revenueChange.context
              )}</p>
            </div>
          `
        }

        // Market Sentiment Card
        if (sentiment) {
          const sentimentColor =
            sentiment === 'positive'
              ? 'success'
              : sentiment === 'negative'
              ? 'danger'
              : 'neutral'
          const sentimentIcon =
            sentiment === 'positive'
              ? '📈'
              : sentiment === 'negative'
              ? '📉'
              : '➡️'
          const sentimentLabel =
            sentiment.charAt(0).toUpperCase() + sentiment.slice(1)

          html += `
            <div class="linkedintel-financial-sentiment-card linkedintel-sentiment-${sentimentColor}">
              <div class="linkedintel-sentiment-header">
                <div class="linkedintel-sentiment-icon">${sentimentIcon}</div>
                <div>
                  <div class="linkedintel-sentiment-label">Growth Sentiment</div>
                  <div class="linkedintel-sentiment-value">${sentimentLabel}</div>
                </div>
              </div>
              ${
                sentimentReason
                  ? `<p class="linkedintel-sentiment-reason">${this.escapeHtml(
                      sentimentReason
                    )}</p>`
                  : ''
              }
            </div>
          `
        }

        // DATA FRESHNESS INDICATOR
        if (financialSummary.lastUpdated || financialSummary.sources) {
          let formattedUpdateDate = financialSummary.lastUpdated
          if (financialSummary.lastUpdated) {
            try {
              const date = new Date(financialSummary.lastUpdated)
              const now = new Date()
              const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

              if (diffDays === 0) formattedUpdateDate = 'Today'
              else if (diffDays === 1) formattedUpdateDate = 'Yesterday'
              else if (diffDays < 30)
                formattedUpdateDate = `${diffDays} days ago`
              else if (diffDays < 365)
                formattedUpdateDate = `${Math.floor(diffDays / 30)} months ago`
              else
                formattedUpdateDate = `${Math.floor(diffDays / 365)} years ago`
            } catch (e) {
              formattedUpdateDate = financialSummary.lastUpdated
            }
          }

          html += `
            <div style="margin-top: 20px; padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 12px; color: #6b7280;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">🕐</span>
                <div style="flex: 1;">
                  ${
                    formattedUpdateDate
                      ? `<div style="margin-bottom: 4px;"><strong>Data updated:</strong> ${formattedUpdateDate}</div>`
                      : ''
                  }
                  ${
                    financialSummary.sources &&
                    financialSummary.sources.length > 0
                      ? `<div><strong>Sources:</strong> ${financialSummary.sources.join(
                          ', '
                        )}</div>`
                      : ''
                  }
                </div>
              </div>
            </div>
          `
        }
      }
    }

    html += '</div>'

    // Enhanced empty state for private vs public companies
    if (
      !financialSummary ||
      Object.keys(financialSummary).length === 0 ||
      (!isPublic &&
        !totalFunding &&
        !latestValuation &&
        !financialSummary.revenueEstimate &&
        !lastFunding.amount &&
        !revenueChange.context &&
        fundingRounds.length === 0 &&
        notableInvestors.length === 0) ||
      (isPublic &&
        !financialSummary.priceTrajectory &&
        !financialSummary.revenueChange)
    ) {
      if (!isPublic) {
        // Private company empty state - more helpful
        html = `
          <div class="linkedintel-empty-state" style="padding: 40px 20px;">
            <div style="width: 64px; height: 64px; margin: 0 auto 20px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #bae6fd;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" style="width: 32px; height: 32px;">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path>
                <path d="M12 2L12 8M12 16L12 22M2 12L8 12M16 12L22 12"></path>
              </svg>
            </div>
            <h3 style="margin: 0 0 12px 0; font-size: 17px; font-weight: 700; color: #1f2937;">🔒 Private Company</h3>
            <p class="linkedintel-empty-text" style="max-width: 440px; margin: 0 auto 24px; line-height: 1.7; color: #6b7280; font-size: 14px;">
              This company hasn't publicly disclosed financial metrics like funding, valuation, or revenue. Check the other tabs for tech stack, team insights, and hiring signals.
            </p>
            
            <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border-left: 4px solid #f97316; border-radius: 10px; padding: 18px 20px; max-width: 480px; margin: 0 auto 20px; text-align: left; box-shadow: 0 2px 8px rgba(249, 115, 22, 0.1);">
              <div style="display: flex; align-items: start; gap: 14px;">
                <span style="font-size: 28px; line-height: 1; flex-shrink: 0;">💡</span>
                <div style="flex: 1;">
                  <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #9a3412;">How to find financial info:</p>
                  <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.9; color: #7c2d12;">
                    <li><strong>Crunchbase/PitchBook</strong> – Search for funding announcements</li>
                    <li><strong>Company blog/press</strong> – Look for funding or growth updates</li>
                    <li><strong>LinkedIn About</strong> – Company size and description</li>
                    <li><strong>TechCrunch/VentureBeat</strong> – Tech startup coverage</li>
                  </ul>
                </div>
              </div>
            </div>

            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; max-width: 480px; margin: 0 auto; text-align: left;">
              <div style="display: flex; align-items: start; gap: 12px;">
                <span style="font-size: 20px; line-height: 1;">📊</span>
                <div style="flex: 1;">
                  <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #6b7280;">
                    <strong style="color: #374151;">Tip:</strong> Try the <strong>Tech Stack</strong> and <strong>Risk Signals</strong> tabs for verified insights from job postings and hiring data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        `
      } else {
        // Public company empty state - improved with helpful links (multi-country)
        const ticker = stockInfo.ticker || stockInfo.symbol || data.ticker
        const companyName = data.companyName || data.name || 'this company'
        const exchange = (stockInfo.exchange || '').toUpperCase()
        const headquarters = (
          overview.headquarters ||
          data.headquarters ||
          ''
        ).toLowerCase()

        // Detect country/region
        const isUSA =
          exchange.includes('NYSE') ||
          exchange.includes('NASDAQ') ||
          exchange.includes('AMEX') ||
          headquarters.includes('united states') ||
          headquarters.includes('usa')
        const isIndia =
          exchange.includes('BSE') ||
          exchange.includes('NSE') ||
          headquarters.includes('india')
        const isUK =
          exchange.includes('LSE') ||
          exchange.includes('LONDON') ||
          headquarters.includes('united kingdom') ||
          headquarters.includes('uk')
        const isCanada =
          exchange.includes('TSX') ||
          exchange.includes('TSE') ||
          headquarters.includes('canada')
        const isAustralia =
          exchange.includes('ASX') || headquarters.includes('australia')

        html = `
          <div class="linkedintel-empty-state" style="padding: 40px 20px;">
            <div style="width: 64px; height: 64px; margin: 0 auto 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #bbf7d0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="width: 32px; height: 32px;">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <h3 style="margin: 0 0 12px 0; font-size: 17px; font-weight: 700; color: #1f2937;">📈 Public Company</h3>
            <p class="linkedintel-empty-text" style="max-width: 440px; margin: 0 auto 24px; line-height: 1.7; color: #6b7280; font-size: 14px;">
              Limited financial data was found for ${this.escapeHtml(
                companyName
              )}. As a public company, detailed financial reports are available through regulatory filings.
            </p>
            
            ${
              ticker
                ? `
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 4px solid #22c55e; border-radius: 10px; padding: 18px 20px; max-width: 480px; margin: 0 auto 20px; text-align: left; box-shadow: 0 2px 8px rgba(34, 197, 94, 0.1);">
              <div style="display: flex; align-items: start; gap: 14px;">
                <span style="font-size: 28px; line-height: 1; flex-shrink: 0;">📊</span>
                <div style="flex: 1;">
                  <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #166534;">${
                    isUSA
                      ? 'View SEC Filings (US):'
                      : isIndia
                      ? 'View BSE/NSE Reports (India):'
                      : isUK
                      ? 'View Companies House (UK):'
                      : isCanada
                      ? 'View SEDAR+ Filings (Canada):'
                      : isAustralia
                      ? 'View ASX Reports (Australia):'
                      : 'View Financial Filings:'
                  }</p>
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${
                      isUSA
                        ? `
                    <a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(
                      ticker
                    )}&type=10-K&dateb=&owner=exclude&count=40" 
                       target="_blank" rel="noopener noreferrer"
                       style="display: inline-flex; align-items: center; gap: 8px; background: white; border: 2px solid #86efac; color: #166534; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; transition: all 0.2s ease;">
                      <span>📊</span> View 10-K Annual Reports
                    </a>
                    <a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(
                      ticker
                    )}&type=10-Q&dateb=&owner=exclude&count=40" 
                       target="_blank" rel="noopener noreferrer"
                       style="display: inline-flex; align-items: center; gap: 8px; background: white; border: 2px solid #86efac; color: #166534; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; transition: all 0.2s ease;">
                      <span>📈</span> View 10-Q Quarterly Reports
                    </a>
                    `
                        : isIndia
                        ? `
                    <a href="https://www.bseindia.com/stock-share-price/stock-news-announcement/${encodeURIComponent(
                      ticker
                    )}/" 
                       target="_blank" rel="noopener noreferrer"
                       style="display: inline-flex; align-items: center; gap: 8px; background: white; border: 2px solid #86efac; color: #166534; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; transition: all 0.2s ease;">
                      <span>🇮🇳</span> BSE Reports & Announcements
                    </a>
                    <a href="https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(
                      ticker
                    )}" 
                       target="_blank" rel="noopener noreferrer"
                       style="display: inline-flex; align-items: center; gap: 8px; background: white; border: 2px solid #86efac; color: #166534; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; transition: all 0.2s ease;">
                      <span>🇮🇳</span> NSE Financial Results
                    </a>
                    <a href="https://www.sebi.gov.in/" 
                       target="_blank" rel="noopener noreferrer"
                       style="display: inline-flex; align-items: center; gap: 8px; background: white; border: 2px solid #86efac; color: #166534; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; transition: all 0.2s ease;">
                      <span>📄</span> SEBI Filings
                    </a>
                    `
                        : isUK
                        ? `
                    <a href="https://find-and-update.company-information.service.gov.uk/search?q=${encodeURIComponent(
                      companyName
                    )}" 
                       target="_blank" rel="noopener noreferrer"
                       style="display: inline-flex; align-items: center; gap: 8px; background: white; border: 2px solid #86efac; color: #166534; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; transition: all 0.2s ease;">
                      <span>🇬🇧</span> Companies House Filings
                    </a>
                    <a href="https://www.londonstockexchange.com/search?q=${encodeURIComponent(
                      ticker
                    )}" 
                       target="_blank" rel="noopener noreferrer"
                       style="display: inline-flex; align-items: center; gap: 8px; background: white; border: 2px solid #86efac; color: #166534; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; transition: all 0.2s ease;">
                      <span>📊</span> LSE Reports & Announcements
                    </a>
                    `
                        : isCanada
                        ? `
                    <a href="https://www.sedarplus.ca/landingpage/" 
                       target="_blank" rel="noopener noreferrer"
                       style="display: inline-flex; align-items: center; gap: 8px; background: white; border: 2px solid #86efac; color: #166534; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; transition: all 0.2s ease;">
                      <span>🇨🇦</span> SEDAR+ Filings (Canada)
                    </a>
                    `
                        : isAustralia
                        ? `
                    <a href="https://www2.asx.com.au/markets/company/${encodeURIComponent(
                      ticker
                    )}" 
                       target="_blank" rel="noopener noreferrer"
                       style="display: inline-flex; align-items: center; gap: 8px; background: white; border: 2px solid #86efac; color: #166534; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; transition: all 0.2s ease;">
                      <span>🇦🇺</span> ASX Reports (Australia)
                    </a>
                    `
                        : `
                    <a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(
                      ticker
                    )}&type=10-K&dateb=&owner=exclude&count=40" 
                       target="_blank" rel="noopener noreferrer"
                       style="display: inline-flex; align-items: center; gap: 8px; background: white; border: 2px solid #86efac; color: #166534; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; transition: all 0.2s ease;">
                      <span>📊</span> View Annual Reports
                    </a>
                    `
                    }
                  </div>
                </div>
              </div>
            </div>
            `
                : ''
            }

            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; max-width: 480px; margin: 0 auto; text-align: left;">
              <div style="display: flex; align-items: start; gap: 12px;">
                <span style="font-size: 20px; line-height: 1;">💡</span>
                <div style="flex: 1;">
                  <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #6b7280;">
                    <strong style="color: #374151;">Tip:</strong> Check the <strong>Tech Stack</strong>, <strong>Risk Signals</strong>, and <strong>News</strong> tabs for real-time business intelligence and recent updates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        `
      }
    }

    return html
  }

  // NEW: Risk Signals Tab - Negative Intelligence + Risk Factors
  generateRiskSignalsTab(data) {
    const negativeIntel = data.companyChallenges || {}
    const fitScore = data.fitScore || {}
    const riskFactors = fitScore.riskFactors || []

    const companyChall = negativeIntel.challenges || []
    const hasNegativeNews =
      negativeIntel.negativeNewsSummary &&
      negativeIntel.negativeNewsSummary !==
        'No significant negative news found in the last 12 months.'
    const hasEarningsNews =
      negativeIntel.earningsCallNegativeNews &&
      (typeof negativeIntel.earningsCallNegativeNews === 'string'
        ? negativeIntel.earningsCallNegativeNews.length > 0
        : negativeIntel.earningsCallNegativeNews?.summary)
    const hasLayoffs = negativeIntel.layoffNews?.hasLayoffs

    if (
      companyChall.length === 0 &&
      riskFactors.length === 0 &&
      !hasNegativeNews &&
      !hasEarningsNews &&
      !hasLayoffs
    ) {
      return `
        <div class="linkedintel-risk-empty-state">
          <svg class="linkedintel-risk-success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <h3 class="linkedintel-risk-success-title">No Significant Challenges Detected</h3>
          <p class="linkedintel-risk-success-text">This company shows healthy indicators with no major red flags.</p>
        </div>
      `
    }

    let html = ''

    // Negative News Summary (Last 12 Months)
    if (hasNegativeNews) {
      html += `
        <div class="linkedintel-section">
          <h2 class="linkedintel-section-title">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
            Negative News (Last 12 Months)
          </h2>
          <div class="linkedintel-card" style="background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%); border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #1f2937;">${this.escapeHtml(
              this.stripCitations(negativeIntel.negativeNewsSummary)
            )}</p>
          </div>
        </div>
      `
    }

    // Earnings Call Negative News (Public Companies Only)
    if (hasEarningsNews) {
      const earningsData = negativeIntel.earningsCallNegativeNews
      const earningsSummary =
        typeof earningsData === 'string'
          ? earningsData
          : earningsData?.summary || ''

      html += `
        <div class="linkedintel-section">
          <h2 class="linkedintel-section-title">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            Earnings Call Concerns
          </h2>
          <div class="linkedintel-card" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #1f2937;">${this.escapeHtml(
              this.stripCitations(earningsSummary)
            )}</p>
            <div style="margin-top: 10px; font-size: 12px; color: #6b7280;">
              <em>💡 View full transcript in the Financial tab</em>
            </div>
          </div>
        </div>
      `
    }

    // Layoff News
    if (hasLayoffs && negativeIntel.layoffNews) {
      const layoffData = negativeIntel.layoffNews
      html += `
        <div class="linkedintel-section">
          <h2 class="linkedintel-section-title">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
            Layoffs Detected
          </h2>
          ${
            layoffData.summary
              ? `
            <div class="linkedintel-card" style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #1f2937;">${this.escapeHtml(
                this.stripCitations(layoffData.summary)
              )}</p>
            </div>
          `
              : ''
          }
          ${
            layoffData.layoffEvents && layoffData.layoffEvents.length > 0
              ? `
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${layoffData.layoffEvents
                .map(
                  (event) => `
                <div class="linkedintel-card" style="border-left: 3px solid #dc2626; padding: 14px; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <span style="font-size: 13px; font-weight: 600; color: #dc2626;">${this.escapeHtml(
                      event.employeesAffected
                    )}</span>
                    <span style="font-size: 12px; color: #6b7280;">${this.escapeHtml(
                      event.date
                    )}</span>
                  </div>
                  ${
                    event.departments &&
                    Array.isArray(event.departments) &&
                    event.departments.length > 0
                      ? `
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #4b5563;">
                      <strong>Departments:</strong> ${event.departments
                        .map((d) => this.escapeHtml(d))
                        .join(', ')}
                    </p>
                  `
                      : event.departments &&
                        typeof event.departments === 'string'
                      ? `
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #4b5563;">
                      <strong>Departments:</strong> ${this.escapeHtml(
                        event.departments
                      )}
                    </p>
                  `
                      : ''
                  }
                  ${
                    event.reason
                      ? `
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #4b5563; line-height: 1.5;">
                      ${this.escapeHtml(this.stripCitations(event.reason))}
                    </p>
                  `
                      : ''
                  }
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                    <span style="font-size: 12px; color: #6b7280;">${this.escapeHtml(
                      this.stripCitations(event.source)
                    )}</span>
                    ${
                      event.url
                        ? `<a href="${this.escapeHtml(
                            event.url
                          )}" target="_blank" rel="noopener" style="font-size: 12px; color: #3b82f6; text-decoration: none;">View Source →</a>`
                        : ''
                    }
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          `
              : ''
          }
        </div>
      `
    }

    // Challenges from Backend
    if (companyChall.length > 0) {
      html += `
        <div class="linkedintel-section">
          <h2 class="linkedintel-section-title">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Additional Challenges (${companyChall.length})
          </h2>
          ${companyChall
            .map(
              (signal) => `
            <div class="linkedintel-risk-signal-card linkedintel-risk-${(
              signal.severity || 'medium'
            ).toLowerCase()}">
              <div class="linkedintel-risk-signal-header">
                <span class="linkedintel-risk-category">${this.escapeHtml(
                  signal.category || 'Challenge'
                )}</span>
                <span class="linkedintel-risk-severity">${this.escapeHtml(
                  signal.severity || 'Medium'
                )}</span>
              </div>
              <p class="linkedintel-risk-signal-text">${this.escapeHtml(
                this.stripCitations(signal.description || '')
              )}</p>
              <div class="linkedintel-risk-signal-meta">
                <span class="linkedintel-risk-date">${this.escapeHtml(
                  signal.date || ''
                )}</span>
                <span class="linkedintel-risk-source">${this.escapeHtml(
                  this.stripCitations(signal.source || '')
                )}</span>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
    }

    // Risk Factors from Fit Score
    if (riskFactors.length > 0) {
      html += `
        <div class="linkedintel-section">
          <h2 class="linkedintel-section-title">
            <svg class="linkedintel-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Additional Risk Factors (${riskFactors.length})
          </h2>
          <ul class="linkedintel-risk-factors-list">
            ${riskFactors
              .map(
                (factor) => `
              <li class="linkedintel-risk-factor-item">${this.escapeHtml(
                this.stripCitations(factor)
              )}</li>
            `
              )
              .join('')}
          </ul>
        </div>
      `
    }

    return html
  }

  // Helper: Format Earnings Result
  formatEarningsResult(result) {
    if (!result || result === 'n/a') return 'N/A'
    if (result === 'beat')
      return '<span class="linkedintel-metric-success">✓ Beat</span>'
    if (result === 'miss')
      return '<span class="linkedintel-metric-danger">✗ Miss</span>'
    if (result === 'met')
      return '<span class="linkedintel-metric-neutral">= Met</span>'
    return result
  }

  // Escape HTML to prevent XSS
  escapeHtml(text) {
    if (!text) return ''
    const div = document.createElement('div')
    div.textContent = String(text)
    return div.innerHTML
  }

  // Generate fallback text for buying signals when note is missing
  generateSignalFallback(signal) {
    const typeLabels = {
      budget: 'Budget cycle activity detected',
      hiring: 'Active hiring and team expansion',
      expansion: 'Business expansion signals',
      technology: 'Technology adoption indicators',
      funding: 'Recent funding or investment activity',
      leadership: 'Leadership changes and new initiatives',
    }

    const strengthMessages = {
      hot: 'High-priority opportunity - act now',
      warm: 'Good timing for outreach',
      cold: 'Potential future opportunity',
    }

    const baseMessage =
      typeLabels[signal.type?.toLowerCase()] || 'Buying signal detected'
    const urgencyMessage = strengthMessages[signal.strength] || ''

    return `${baseMessage}. ${urgencyMessage}`
  }

  // Generate fallback text for growth events when activity is missing
  generateEventFallback(event) {
    const eventDescriptions = {
      funding: 'Secured investment funding to fuel growth and expansion',
      acquisition: 'Strategic acquisition to expand market presence',
      expansion: 'Geographic or market expansion initiative',
      product: 'New product or service launch announcement',
      partnership: 'Strategic partnership or collaboration formed',
      hiring: 'Significant hiring and workforce expansion',
      layoff: 'Workforce restructuring and optimization',
      leadership: 'Leadership team changes and appointments',
      milestone: 'Company milestone or achievement reached',
    }

    return (
      eventDescriptions[event.type?.toLowerCase()] ||
      'Significant company growth event'
    )
  }

  // Get icon for event type
  getEventIcon(type) {
    const icons = {
      funding: '💰',
      acquisition: '🤝',
      expansion: '🌍',
      product: '🚀',
      partnership: '🔗',
      hiring: '👥',
      layoff: '📉',
      leadership: '👔',
      milestone: '🎯',
    }
    return icons[type?.toLowerCase()] || '📈'
  }

  // Get color for event type
  getEventColor(type) {
    const colors = {
      funding: '#2e7d32', // Green - positive
      acquisition: '#1976d2', // Blue - strategic
      expansion: '#0288d1', // Cyan - growth
      product: '#7b1fa2', // Purple - innovation
      partnership: '#0097a7', // Teal - collaboration
      hiring: '#388e3c', // Light green - positive
      layoff: '#d32f2f', // Red - negative
      leadership: '#f57c00', // Orange - change
      milestone: '#c62828', // Dark red - achievement
    }
    return colors[type?.toLowerCase()] || '#5e35b1'
  }

  // Get label for event type
  getEventLabel(type) {
    const labels = {
      funding: 'Funding Round',
      acquisition: 'Acquisition',
      expansion: 'Expansion',
      product: 'Product Launch',
      partnership: 'Partnership',
      hiring: 'Hiring Surge',
      layoff: 'Restructuring',
      leadership: 'Leadership Change',
      milestone: 'Milestone',
    }
    return labels[type?.toLowerCase()] || 'Growth Event'
  }

  // Track analytics events with GA4
  trackEvent(eventName, eventParams = {}) {
    try {
      chrome.runtime
        .sendMessage({
          type: 'TRACK_EVENT',
          data: {
            eventName: eventName,
            eventParams: {
              ...eventParams,
              source: 'insights_panel',
            },
          },
        })
        .catch((error) => {
          panelLogger.debug('[LinkedIntel] Failed to track event:', error)
        })
    } catch (error) {
      panelLogger.debug('[LinkedIntel] Error sending track event:', error)
    }
  }

  // Render citation markers in content
  // Converts citation markers like [source: url] into clickable numbered citations
  renderCitationMarkers(html) {
    if (!html || typeof html !== 'string') return html

    // Track citations found in this content
    this.citations = this.citations || []
    let citationIndex = this.citations.length

    // Match [source: url] patterns and replace with numbered citations
    return html.replace(/\[source:\s*([^\]]+)\]/gi, (match, url) => {
      citationIndex++
      this.citations.push({
        index: citationIndex,
        url: url.trim(),
      })
      return `<sup class="linkedintel-citation" data-citation="${citationIndex}">[${citationIndex}]</sup>`
    })
  }

  // Generate citation footnotes section
  // Creates a footnotes list at the bottom of content with all citations
  generateCitationFootnotes() {
    if (!this.citations || this.citations.length === 0) {
      return ''
    }

    const footnotes = this.citations
      .map((citation) => {
        const domain = citation.url
          .replace(/^https?:\/\//, '')
          .replace(/\/.*$/, '')
        return `
        <div class="linkedintel-footnote">
          <span class="linkedintel-footnote-number">[${citation.index}]</span>
          <a href="${citation.url}" target="_blank" rel="noopener noreferrer" class="linkedintel-footnote-link">
            ${domain}
          </a>
        </div>
      `
      })
      .join('')

    // Clear citations for next use
    this.citations = []

    return `
      <div class="linkedintel-footnotes">
        <div class="linkedintel-footnotes-title">Sources</div>
        ${footnotes}
      </div>
    `
  }

  // ============================================================================
  // CHROME AI HANDLERS
  // ============================================================================

  /**
   * Handle AI Summary generation
   */
  async handleAISummaryGenerate(button) {
    if (!window.chromeAI || !window.chromeAI.isAvailable('summarizer')) {
      panelLogger.error('Chrome AI Summarizer not available')
      return
    }

    const section = button.closest('.linkedintel-ai-summary-section')
    if (!section) return

    const loadingEl = section.querySelector('.linkedintel-ai-summary-loading')
    const contentEl = section.querySelector('.linkedintel-ai-summary-content')
    const resultEl = section.querySelector('.linkedintel-ai-summary-result')

    // Show loading
    button.style.display = 'none'
    if (loadingEl) loadingEl.style.display = 'block'

    try {
      // Build content to summarize
      const contentToSummarize = this.buildContentForSummary()

      if (!contentToSummarize) {
        throw new Error('No content available to summarize')
      }

      // Get current summary type
      const activeTypeBtn = section.querySelector(
        '.linkedintel-ai-summary-type-btn.active'
      )
      const summaryType =
        activeTypeBtn?.getAttribute('data-type') || 'key-points'

      panelLogger.info(`Generating ${summaryType} summary...`)

      // Check Chrome AI availability
      if (!window.chromeAI) {
        throw new Error('Chrome AI service not available. Please ensure Chrome AI is properly configured.')
      }

      // Initialize Chrome AI if needed
      if (!window.chromeAI.isInitialized) {
        await window.chromeAI.initialize()
      }

      // Check if summarizer is available
      if (!window.chromeAI.isAvailable('summarizer')) {
        throw new Error('Summarizer API is not available. You may need to download the AI model first.')
      }

      // Generate summary using Chrome AI
      const summary = await window.chromeAI.summarizeText(contentToSummarize, {
        type: summaryType,
        format: 'plain-text',
        length: 'short',
      })

      // Display result
      if (resultEl) {
        resultEl.textContent = summary
      }

      // Show content, hide loading
      if (loadingEl) loadingEl.style.display = 'none'
      if (contentEl) contentEl.style.display = 'block'

      panelLogger.info('Summary generated successfully')
    } catch (error) {
      panelLogger.error('Error generating summary:', error)

      // Show error
      if (resultEl) {
        resultEl.textContent = `Error: ${error.message}\n\nPlease try again or check if the Gemini Nano model needs to be downloaded.`
      }

      if (loadingEl) loadingEl.style.display = 'none'
      if (contentEl) contentEl.style.display = 'block'
    }
  }

  /**
   * Handle AI Summary type change
   */
  async handleAISummaryTypeChange(button) {
    const section = button.closest('.linkedintel-ai-summary-section')
    if (!section) return

    // Update active state
    section
      .querySelectorAll('.linkedintel-ai-summary-type-btn')
      .forEach((btn) => {
        btn.classList.remove('active')
        btn.style.background = 'rgba(255, 255, 255, 0.1)'
        btn.style.borderColor = 'rgba(255, 255, 255, 0.2)'
      })

    button.classList.add('active')
    button.style.background = 'rgba(255, 255, 255, 0.2)'
    button.style.borderColor = 'rgba(255, 255, 255, 0.3)'

    // Regenerate summary with new type
    const generateBtn = section.querySelector(
      '.linkedintel-ai-summary-generate-btn'
    )
    if (generateBtn && generateBtn.style.display === 'none') {
      // Summary already generated, regenerate with new type
      await this.handleAISummaryGenerate(generateBtn)
    }
  }

  /**
   * Build content for summary from current data
   * Focus on ACTIONABLE SALES INTELLIGENCE, not generic info
   */
  buildContentForSummary() {
    if (!this.currentData) return null

    const parts = []

    if (this.pageType === 'company') {
      const companyName =
        this.currentData.companyName || this.currentData.name || 'Company'
      
      // Build narrative introduction
      let intro = `${companyName} is`
      if (this.currentData.overview?.industry) {
        intro += ` a ${this.currentData.overview.industry} company`
      }
      if (this.currentData.stockInfo?.companyType) {
        intro += ` (${this.currentData.stockInfo.companyType})`
      }
      if (this.currentData.overview?.employeeCount) {
        intro += ` with ${this.currentData.overview.employeeCount} employees`
      }
      intro += '.'
      parts.push(intro)

      // Company description
      if (this.currentData.industryContext?.description) {
        parts.push(this.currentData.industryContext.description.substring(0, 400))
      }

      // PRIORITY: Buying Signals (most actionable)
      if (this.currentData.buyingSignals && this.currentData.buyingSignals.length > 0) {
        const signals = this.currentData.buyingSignals.slice(0, 3)
          .map(s => `• ${s.signal || s.type || s}: ${s.description || s.context || ''}`)
          .join('\n')
        parts.push(`🎯 BUYING SIGNALS:\n${signals}`)
      }

      // Pain Points (second priority)
      if (this.currentData.painPoints && this.currentData.painPoints.length > 0) {
        const pains = this.currentData.painPoints.slice(0, 3)
          .map(p => `• ${p.point || p.description || p}`)
          .join('\n')
        parts.push(`⚠️ PAIN POINTS:\n${pains}`)
      }

      // Recent news and activities
      if (this.currentData.recentNews && this.currentData.recentNews.length > 0) {
        const news = this.currentData.recentNews.slice(0, 2)
          .map(n => `• ${n.title || n.headline || n}`)
          .join('\n')
        parts.push(`📰 RECENT NEWS:\n${news}`)
      }

      // Growth events
      if (this.currentData.growthEvents && this.currentData.growthEvents.length > 0) {
        const events = this.currentData.growthEvents.slice(0, 2)
          .map(e => `• ${e.event || e.title || e}`)
          .join('\n')
        parts.push(`📈 GROWTH SIGNALS:\n${events}`)
      }

      // Funding info
      if (this.currentData.fundingInfo?.totalFunding) {
        parts.push(`💰 FUNDING: Raised ${this.currentData.fundingInfo.totalFunding} total`)
      }

      // Hiring signals
      if (this.currentData.hiringSignals && this.currentData.hiringSignals.length > 0) {
        parts.push(`👥 HIRING: ${this.currentData.hiringSignals.length} open positions (growth indicator)`)
      }

      // Tech stack (condensed)
      if (this.currentData.techStack && this.currentData.techStack.length > 0) {
        const topTech = this.currentData.techStack
          .slice(0, 5)
          .map((t) => t.name)
          .join(', ')
        parts.push(`💻 TECH STACK: ${topTech}`)
      }
    } else if (this.pageType === 'profile') {
      const profile = this.currentData.profile || {}
      const company = this.currentData.company || {}
      // CRITICAL: Backend sends activity as profile.recentActivity
      const posts = profile.recentActivity || this.currentData.posts || this.currentData.activity || {}

      // Build narrative introduction
      let intro = ''
      if (profile.name) {
        intro = `${profile.name} is`
        if (profile.title) {
          intro += ` the ${profile.title}`
        }
        if (profile.company || company.companyName) {
          intro += ` at ${profile.company || company.companyName}`
        }
        if (company.industry) {
          intro += `, a ${company.industry} company`
        }
        intro += '.'
        parts.push(intro)
      }

      // Decision maker level (CRITICAL for sales)
      if (profile.isCXO?.value) {
        const level = profile.isCXO.level || 'Executive'
        const score = profile.decisionMakerScore || 'High'
        parts.push(`🎯 DECISION MAKER: ${level}-level (Score: ${score}/100) - High buying authority`)
      } else if (profile.decisionMakerScore) {
        parts.push(`🎯 DECISION MAKER SCORE: ${profile.decisionMakerScore}/100`)
      }

      // PRIORITY 1: Recent Posts & Activity (What they're talking about NOW)
      // Posts can be in posts.posts (backend schema) or posts.recentPosts (legacy)
      const actualPosts = posts.posts || posts.recentPosts || []
      if (actualPosts.length > 0) {
        const recentContent = actualPosts.slice(0, 3)
          .map(p => {
            const text = p.text || p.content || ''
            const preview = text.substring(0, 120)
            return `• "${preview}${text.length > 120 ? '...' : ''}"`
          })
          .join('\n')
        parts.push(`📊 RECENT ACTIVITY (${actualPosts.length} posts):\n${recentContent}`)
      }

      // Best Outreach Hook
      if (posts.bestHook) {
        const hookText = posts.bestHook.text?.substring(0, 150) || ''
        parts.push(`🎣 BEST OUTREACH HOOK: ${posts.bestHook.type} - "${hookText}"`)
      }

      // Conferences & Speaking Engagements
      if (posts.conferences && posts.conferences.length > 0) {
        const conferences = posts.conferences.slice(0, 2)
          .map(c => `• ${c.name || c.text?.substring(0, 80)}`)
          .join('\n')
        parts.push(`🎤 CONFERENCES:\n${conferences}`)
      }

      // Achievements & Milestones
      if (posts.achievements && posts.achievements.length > 0) {
        const achievements = posts.achievements.slice(0, 2)
          .map(a => `• ${a.text?.substring(0, 100) || a}`)
          .join('\n')
        parts.push(`🏆 ACHIEVEMENTS:\n${achievements}`)
      }

      // Job Changes (timing opportunity)
      if (posts.jobChanges && posts.jobChanges.length > 0) {
        const jobChange = posts.jobChanges[0]
        parts.push(`💼 RECENT JOB CHANGE: ${jobChange.text?.substring(0, 100) || jobChange}`)
      }

      // Pain Points mentioned in posts
      if (posts.painPoints && posts.painPoints.length > 0) {
        const pains = posts.painPoints.slice(0, 2)
          .map(p => `• ${p.point || p}`)
          .join('\n')
        parts.push(`⚠️ PAIN POINTS:\n${pains}`)
      }

      // About section - ONLY if no other content available
      if (profile.about && parts.length < 5) {
        parts.push(`BACKGROUND: ${profile.about.substring(0, 300)}${profile.about.length > 300 ? '...' : ''}`)
      }

      // Professional background
      if (profile.yearsOfExperience) {
        parts.push(`EXPERIENCE: ${profile.yearsOfExperience} years in the field`)
      }

      // Key Insights (backend intelligence)
      if (this.currentData.intelligence?.keyInsights && this.currentData.intelligence.keyInsights.length > 0) {
        const insights = this.currentData.intelligence.keyInsights.slice(0, 3)
          .map(i => `• ${i}`)
          .join('\n')
        parts.push(`💡 KEY INSIGHTS:\n${insights}`)
      }

      // Company context (brief)
      if (company.overview) {
        const companyInfo = []
        if (company.overview.industry) companyInfo.push(company.overview.industry)
        if (company.overview.employeeCount) companyInfo.push(`${company.overview.employeeCount} employees`)
        if (companyInfo.length > 0) {
          parts.push(`🏢 COMPANY: ${companyInfo.join(', ')}`)
        }
      }

      // Company tech stack (shows technical interests)
      if (company.techStack && company.techStack.length > 0) {
        const topTech = company.techStack
          .slice(0, 5)
          .map((t) => t.name)
          .join(', ')
        parts.push(`💻 COMPANY TECH: ${topTech}`)
      }
    }

    const content = parts.join('\n\n')
    panelLogger.debug('Built sales-focused summary content:', { 
      length: content.length, 
      preview: content.substring(0, 300),
      sectionsIncluded: parts.length 
    })
    return content.substring(0, 4000) // Increased limit for richer context
  }

  /**
   * Populate unified context service with all available data
   * @param {Object} data - Analysis data from backend
   */
  populateUnifiedContext(data) {
    if (!window.unifiedContext) {
      panelLogger.error('❌ CRITICAL: Unified context service not loaded - Chrome AI features will not work')
      panelLogger.error('Check manifest.json content script load order')
      return
    }

    try {
      // Extract profile data
      const profileData = data.profile || {}
      
      // Extract company data (either direct or nested)
      const companyData = data.company || data
      
      // Extract posts/activity data - CRITICAL: Backend sends it as profile.recentActivity
      const postsData = profileData.recentActivity || data.posts || data.activity || {}
      
      // Debug: Log what activity data was received
      panelLogger.debug('Populating unified context - Posts/Activity data:', {
        hasProfileRecentActivity: !!profileData.recentActivity,
        hasPosts: !!data.posts,
        hasActivity: !!data.activity,
        recentPostsCount: postsData.posts?.length || 0,
        totalPosts: postsData.totalPosts || 0,
        conferences: postsData.conferences?.length || 0,
        achievements: postsData.achievements?.length || 0,
        bestHook: !!postsData.bestHook,
      })
      
      // Build context object
      const contextUpdate = {
        profile: {
          name: profileData.name || null,
          headline: profileData.headline || profileData.title || null,
          currentPosition: profileData.currentPosition || null,
          company: profileData.company || companyData.companyName || null,
          location: profileData.location || null,
          yearsOfExperience: profileData.yearsOfExperience || null,
          isCXO: profileData.isCXO || null,
          executiveLevel: profileData.executiveLevel || null,
          decisionMakerScore: profileData.decisionMakerScore || null,
          education: profileData.education || [],
          skills: profileData.skills || [],
          about: profileData.about || profileData.summary || null,
        },
        company: {
          companyName: companyData.companyName || companyData.name || null,
          industry: companyData.industry || null,
          companySize: companyData.companySize || companyData.size || null,
          location: companyData.location || null,
          description: companyData.description || companyData.about || null,
          website: companyData.website || null,
          techStack: companyData.techStack || [],
          fundingInfo: companyData.fundingInfo || null,
          stockInfo: companyData.stockInfo || null,
          employeeGrowth: companyData.employeeGrowth || null,
          newsItems: companyData.newsItems || [],
          hiringSignals: companyData.hiringSignals || null,
          riskSignals: companyData.riskSignals || [],
          competitors: companyData.competitors || [],
        },
        intelligence: {
          painPoints: data.painPoints || postsData.painPoints || [],
          buyingSignals: data.buyingSignals || [],
          riskSignals: companyData.riskSignals || [],
        },
        activity: {
          recentPosts: postsData.posts || postsData.recentPosts || [],
          totalPosts: postsData.posts?.length || postsData.totalPosts || 0,
          lastPostDate: postsData.lastPostDate || null,
          engagementLevel: postsData.engagementLevel || 'unknown',
        },
        posts: {
          recentPosts: postsData.posts || postsData.recentPosts || [],
          totalPosts: postsData.posts?.length || postsData.totalPosts || 0,
          conferences: postsData.conferences || [],
          speaking: postsData.speaking || [],
          achievements: postsData.achievements || [],
          jobChanges: postsData.jobChanges || [],
          bestHook: postsData.bestHook || null,
          painPoints: postsData.painPoints || [],
          hiringMentions: postsData.hiringMentions || [],
        },
        timeline: {
          events: data.timeline?.events || [],
          verification: data.timeline?.verification || [],
        },
      }

      // Update the unified context service
      window.unifiedContext.updateContext(contextUpdate)
      
      panelLogger.info('Unified context populated with panel data', {
        hasProfile: !!contextUpdate.profile.name,
        hasCompany: !!contextUpdate.company.companyName,
        techStackCount: contextUpdate.company.techStack.length,
        postsCount: contextUpdate.posts.recentPosts.length,
      })
    } catch (error) {
      panelLogger.error('Error populating unified context:', error)
    }
  }

  /**
   * Build context for AI features (delegated to unified context service)
   * @returns {Object} Full context from unified service
   */
  buildContext() {
    if (!window.unifiedContext) {
      panelLogger.warn('Unified context service not available, returning minimal context')
      
      // Fallback to minimal context if service unavailable
      if (this.pageType === 'profile') {
        const profile = this.currentData?.profile || {}
        const company = this.currentData?.company || {}
        return {
          type: 'profile',
          name: profile.name,
          title: profile.title || profile.headline,
          company: profile.company || company.companyName,
          location: profile.location,
        }
      } else if (this.pageType === 'company') {
        const data = this.currentData || {}
        return {
          type: 'company',
          name: data.companyName,
          industry: data.industry,
          size: data.companySize,
          location: data.location,
        }
      }
      
      return null
    }

    // Get full context from unified service
    return window.unifiedContext.getFullContext()
  }

  /**
   * Get prompt-optimized context for AI features
   * @param {Object} options - Context options
   * @returns {string} Formatted context string
   */
  getPromptContext(options = {}) {
    if (!window.unifiedContext) {
      return ''
    }
    
    return window.unifiedContext.getPromptContext(options)
  }

  // Remove the panel
  remove() {
    // Stop all timers
    this.stopTimers()

    document.removeEventListener('keydown', this.handleEscapeKey)

    if (this.panel) {
      this.panel.remove()
      this.panel = null
    }

    const styles = document.getElementById('linkedintel-insights-styles')
    if (styles) {
      styles.remove()
    }

    this.isVisible = false
    this.currentData = null
    
    // Clear unified context when panel is removed
    if (window.unifiedContext) {
      window.unifiedContext.clearContext()
    }
  }
}

// Export to window
window.LinkedIntelInsightsPanel = LinkedIntelInsightsPanel

panelLogger.debug('[LinkedIntel] Insights Panel module loaded')
