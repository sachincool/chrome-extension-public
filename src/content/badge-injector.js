// Executive Badge System for LinkedIn
// Detects executive titles and displays professional badges with animations

// Initialize logger using shared helper function
const badgeLogger = window.createLogger('BadgeInjector')

class ExecutiveBadgeInjector {
  constructor() {
    this.badgeStyles = null
    this.observer = null
    this.injectedBadges = new Set()
    this.isEnabled = true

    // Executive title patterns with priority levels
    this.titlePatterns = {
      gold: {
        patterns: [
          /\b(ceo|chief\s+executive\s+officer?)\b/i,
          /\bchief\s+(ai|artificial\s+intelligence|technology|technical|information|marketing|financial|operating|data|product|revenue|strategy|innovation|digital|security)\s+officer?\b/i,
          /\b(?:svp|senior\s+vice\s+president),?\s+chief\b/i,
          /\b(?:vp|vice\s+president),?\s+chief\b/i,
          /\bpresident\b(?!\s+of\s+(sales|marketing|engineering))/i,
          /\bfounder\b/i,
          /\bco-founder\b/i,
          /\bchief\s+executive\b/i,
          /\bc[tfimod]o\b/i,
        ],
        label: 'CXO',
        priority: 1,
      },
      silver: {
        patterns: [
          /\b(?:vp|vice\s+president)\b(?!.*\bchief\b)/i,
          /\b(?:svp|senior\s+vice\s+president)\b(?!.*\bchief\b)/i,
          /\b(?:evp|executive\s+vice\s+president)\b(?!.*\bchief\b)/i,
          /\bgroup\s+president\b(?!.*\bchief\b)/i,
          /\bregional\s+president\b(?!.*\bchief\b)/i,
          /\bdivision\s+president\b(?!.*\bchief\b)/i,
        ],
        label: 'VP',
        priority: 2,
      },
      bronze: {
        patterns: [
          /\bdirector\b/i,
          /\bsenior\s+director\b/i,
          /\bexecutive\s+director\b/i,
          /\bmanaging\s+director\b/i,
          /\bmanager\b(?=.*\b(senior|principal|lead|global|regional|department|team)\b)/i,
          /\bteam\s+lead\b/i,
          /\bprincipal\b/i,
        ],
        label: 'DIR',
        priority: 3,
      },
      slate: {
        patterns: [
          /\bhead\s+of\b/i,
          /\bteam\s+head\b/i,
          /\bdepartment\s+head\b/i,
        ],
        label: 'HEAD',
        priority: 4,
      },
    }

    this.initialize()
  }

  initialize() {
    this.injectStyles()
    this.setupObserver()
    badgeLogger.debug('LinkedIntel: Executive Badge Injector initialized')
  }

  injectStyles() {
    if (this.badgeStyles) return

    this.badgeStyles = document.createElement('style')
    this.badgeStyles.id = 'linkedintel-executive-badges'
    this.badgeStyles.textContent = `
      .linkedintel-executive-badge {
        display: inline-flex;
        align-items: center;
        margin-left: 8px;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        animation: badgeFadeIn 0.5s ease-out;
        cursor: default;
        position: relative;
        z-index: 10;
        border: 1px solid rgba(255,255,255,0.25);
        backdrop-filter: blur(4px);
      }

      .linkedintel-executive-badge::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: linear-gradient(45deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 100%);
        opacity: 0;
        transition: opacity 0.3s ease;
        z-index: -1;
      }

      .linkedintel-executive-badge:hover {
        transform: scale(1.05);
        animation: badgeShimmer 0.6s ease-out;
      }

      .linkedintel-executive-badge:hover::before {
        opacity: 1;
      }

      /* Gold Badge - CXO Level */
      .linkedintel-badge-gold {
        background: linear-gradient(135deg,
          #fde68a 0%,
          #f59e0b 100%);
        color: #7c4a03;
        box-shadow: 
          0 2px 8px rgba(245, 158, 11, 0.35),
          inset 0 1px 0 rgba(255, 255, 255, 0.45);
      }

      .linkedintel-badge-gold:hover {
        box-shadow: 
          0 4px 16px rgba(255, 215, 0, 0.5),
          inset 0 1px 0 rgba(255, 255, 255, 0.8);
      }

      /* Silver Badge - VP Level */
      .linkedintel-badge-silver {
        background: linear-gradient(135deg,
          #e5e7eb 0%,
          #9ca3af 100%);
        color: #374151;
        box-shadow: 
          0 2px 8px rgba(156, 163, 175, 0.35),
          inset 0 1px 0 rgba(255, 255, 255, 0.4);
      }

      .linkedintel-badge-silver:hover {
        box-shadow: 
          0 4px 16px rgba(156, 163, 175, 0.5),
          inset 0 1px 0 rgba(255, 255, 255, 0.9);
      }

      /* Bronze Badge - Director Level */
      .linkedintel-badge-bronze {
        background: linear-gradient(135deg,
          #fbbf24 0%,
          #d97706 100%);
        color: #7a3a0c;
        box-shadow: 
          0 2px 8px rgba(245, 158, 11, 0.35),
          inset 0 1px 0 rgba(255, 255, 255, 0.4);
      }

      .linkedintel-badge-bronze:hover {
        box-shadow: 
          0 4px 16px rgba(245, 158, 11, 0.5),
          inset 0 1px 0 rgba(255, 255, 255, 0.7);
      }

      /* Slate Badge - Head Level */
      .linkedintel-badge-slate {
        background: linear-gradient(135deg,
          #64748b 0%,
          #475569 100%);
        color: #f1f5f9;
        box-shadow: 
          0 2px 8px rgba(100, 116, 139, 0.35),
          inset 0 1px 0 rgba(255, 255, 255, 0.25);
      }

      .linkedintel-badge-slate:hover {
        box-shadow: 
          0 4px 16px rgba(100, 116, 139, 0.5),
          inset 0 1px 0 rgba(255, 255, 255, 0.4);
      }

      /* Animations */
      @keyframes badgeFadeIn {
        from {
          opacity: 0;
          transform: scale(0.9);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      @keyframes badgeShimmer {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }

      /* Shimmer effect overlay for hover */
      .linkedintel-executive-badge::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.4) 50%,
          transparent 100%
        );
        background-size: 200% 100%;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      }

      .linkedintel-executive-badge:hover::after {
        opacity: 1;
        animation: badgeShimmer 1s ease-out;
      }

      /* Responsive adjustments */
      @media (max-width: 768px) {
        .linkedintel-executive-badge {
          padding: 4px 8px;
          font-size: 10px;
          margin-left: 8px;
          letter-spacing: 0.5px;
        }
      }

    `

    if (document.head) {
      document.head.appendChild(this.badgeStyles)
    } else {
      // Wait for document to be ready
      const observer = new MutationObserver(() => {
        if (document.head) {
          document.head.appendChild(this.badgeStyles)
          observer.disconnect()
        }
      })
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      })
    }
  }

  setupObserver() {
    // Disconnect existing observer if any
    if (this.observer) {
      this.observer.disconnect()
    }

    // Wait for document.body to be available
    const startObserving = () => {
      if (!document.body) {
        setTimeout(startObserving, 100)
        return
      }

      this.observer = new MutationObserver((mutations) => {
        let shouldInjectBadges = false

        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            // Check for LinkedIn profile content changes
            const target = mutation.target

            // Profile page main content changes
            if (
              target.classList &&
              (target.classList.contains('scaffold-layout__main') ||
                target.classList.contains('pv-profile-section') ||
                target.classList.contains('pv-text-details') ||
                target.id === 'main' ||
                target.querySelector('h1.text-heading-xlarge') ||
                target.querySelector('[data-anonymize="person-name"]'))
            ) {
              shouldInjectBadges = true
              break
            }

            // Check added nodes for profile elements
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                if (
                  node.querySelector &&
                  (node.querySelector('h1.text-heading-xlarge') ||
                    node.querySelector('[data-anonymize="person-name"]') ||
                    node.querySelector('.pv-text-details__left-panel'))
                ) {
                  shouldInjectBadges = true
                  break
                }
              }
            }
          }
        }

        if (shouldInjectBadges) {
          // Debounce badge injection (increased to 1000ms for better reliability)
          clearTimeout(this.badgeTimeout)
          this.badgeTimeout = setTimeout(() => {
            this.injectExecutiveBadges()
          }, 1000)
        }
      })

      // Start observing
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
      })

      // Initial badge injection (increased delay for LinkedIn's slow loading)
      setTimeout(() => {
        this.injectExecutiveBadges()
      }, 1500)
    }

    startObserving()
  }

  injectExecutiveBadges() {
    if (!this.isEnabled) return

    const currentUrl = window.location.href

    // Only inject on profile pages
    if (!currentUrl.includes('/in/') || currentUrl.includes('/company/')) {
      return
    }

    // Try to get executive level from main detector first
    let executiveLevel = null
    if (window.linkedInDetector && window.linkedInDetector.currentPageData) {
      executiveLevel = window.linkedInDetector.currentPageData.executiveLevel
    }

    // Find profile name element
    const nameSelectors = [
      'h1.text-heading-xlarge',
      'h1[data-anonymize="person-name"]',
      '.pv-text-details__left-panel h1',
      '.ph5 h1',
      '.pv-top-card h1',
      '.pv-text-details__left-panel .text-heading-xlarge',
    ]

    let nameElement = null
    for (const selector of nameSelectors) {
      const element = document.querySelector(selector)
      if (element && element.textContent && element.textContent.trim()) {
        nameElement = element
        break
      }
    }

    if (!nameElement) {
      badgeLogger.debug(
        'LinkedIntel: Profile name element not found for badge injection'
      )
      return
    }

    // Check if badge already exists
    const existingBadge = nameElement.parentElement?.querySelector(
      '.linkedintel-executive-badge'
    )
    if (existingBadge) {
      badgeLogger.debug(
        'LinkedIntel: Badge already exists, removing to refresh'
      )
      existingBadge.remove()
    }

    // Always run our own comprehensive detection first, then use detector as fallback
    let badgeInfo = null
    let detectorBadgeInfo = null

    badgeLogger.debug(
      'LinkedIntel: Executive level from detector:',
      executiveLevel
    )

    if (executiveLevel) {
      detectorBadgeInfo = this.convertDetectorLevelToBadgeInfo(executiveLevel)
      badgeLogger.debug(
        'LinkedIntel: Badge info from detector:',
        detectorBadgeInfo
      )
    }

    // Always run our own comprehensive pattern detection
    const headlineFromDetector =
      window.linkedInDetector?.currentPageData?.headline
    const headlineFromExtraction = this.extractHeadline()

    badgeLogger.debug(
      'LinkedIntel: Headline from detector:',
      headlineFromDetector
    )
    badgeLogger.debug(
      'LinkedIntel: Headline from extraction:',
      headlineFromExtraction
    )

    const headlineText = headlineFromDetector || headlineFromExtraction
    if (headlineText) {
      badgeLogger.debug(`LinkedIntel: Processing headline: "${headlineText}"`)
      badgeLogger.debug(
        `LinkedIntel: Headline length: ${headlineText.length} characters`
      )
      this.debugPatternMatching(headlineText)
      badgeInfo = this.detectExecutiveLevel(headlineText)
      badgeLogger.debug(
        'LinkedIntel: Badge info from comprehensive pattern matching:',
        badgeInfo
      )
      badgeLogger.debug(
        'LinkedIntel: Badge type:',
        badgeInfo?.type,
        'Label:',
        badgeInfo?.label
      )
    }

    // Use comprehensive detection result, fall back to detector result if no match found
    if (!badgeInfo && detectorBadgeInfo) {
      badgeInfo = detectorBadgeInfo
      badgeLogger.debug(
        'LinkedIntel: Using detector result as fallback:',
        badgeInfo
      )
    } else if (badgeInfo && detectorBadgeInfo) {
      badgeLogger.debug(
        `LinkedIntel: Using comprehensive detection (${badgeInfo.label}) over detector result (${detectorBadgeInfo.label})`
      )
    }

    if (!badgeInfo) {
      return
    }

    // Create and inject badge
    this.createBadge(nameElement, badgeInfo, badgeInfo.fullTitle || 'Executive')
  }

  // Convert main detector executive level to badge info
  convertDetectorLevelToBadgeInfo(executiveLevel) {
    const mapping = {
      CEO: { type: 'gold', label: 'CXO', priority: 1 },
      CTO: { type: 'gold', label: 'CXO', priority: 1 },
      CFO: { type: 'gold', label: 'CXO', priority: 1 },
      COO: { type: 'gold', label: 'CXO', priority: 1 },
      President: { type: 'silver', label: 'VP', priority: 2 },
      VP: { type: 'silver', label: 'VP', priority: 3 },
      Director: { type: 'bronze', label: 'DIR', priority: 4 },
    }

    return mapping[executiveLevel.title] || null
  }

  // Helper to extract headline if not available from detector
  extractHeadline() {
    const selectors = [
      '.text-body-medium.break-words',
      '.pv-text-details__left-panel .text-body-medium',
      '[data-anonymize="headline"]',
    ]

    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element && element.textContent && element.textContent.trim()) {
        return element.textContent.trim()
      }
    }
    return null
  }

  detectExecutiveLevel(title) {
    if (!title) return null

    const titleLower = title.toLowerCase()
    let bestMatch = null
    let highestPriority = 999

    // Check each badge type
    for (const [badgeType, config] of Object.entries(this.titlePatterns)) {
      for (const pattern of config.patterns) {
        if (pattern.test(titleLower)) {
          if (config.priority < highestPriority) {
            bestMatch = {
              type: badgeType,
              ...config,
            }
            highestPriority = config.priority
          }
        }
      }
    }

    return bestMatch
  }

  createBadge(nameElement, badgeInfo, fullTitle) {
    const badge = document.createElement('span')
    badge.className = `linkedintel-executive-badge linkedintel-badge-${badgeInfo.type}`

    // Set badge text (no icons, just label)
    badge.textContent = badgeInfo.label

    // Insert badge after name element
    if (nameElement.nextSibling) {
      nameElement.parentNode.insertBefore(badge, nameElement.nextSibling)
    } else {
      nameElement.parentNode.appendChild(badge)
    }

    // Add to injected badges tracking
    this.injectedBadges.add(badge)

    badgeLogger.debug(
      `LinkedIntel: ${badgeInfo.type} executive badge injected for "${fullTitle}"`
    )
  }

  // Debug method to test pattern matching
  debugPatternMatching(title) {
    badgeLogger.debug(`LinkedIntel: Testing patterns for title: "${title}"`)
    const titleLower = title.toLowerCase()
    badgeLogger.debug(`LinkedIntel: Title lowercase: "${titleLower}"`)

    for (const [badgeType, config] of Object.entries(this.titlePatterns)) {
      badgeLogger.debug(
        `LinkedIntel: Testing ${badgeType} patterns (priority ${config.priority}):`
      )
      for (let i = 0; i < config.patterns.length; i++) {
        const pattern = config.patterns[i]
        const matches = pattern.test(titleLower)
        badgeLogger.debug(
          `LinkedIntel:   Pattern ${i}: ${pattern} -> ${matches}`
        )
        if (matches) {
          badgeLogger.debug(
            `LinkedIntel:   ✓ MATCH: ${badgeType} (${config.label})`
          )
        }
      }
    }
  }

  // Public API methods
  enable() {
    this.isEnabled = true
    this.injectExecutiveBadges()
  }

  disable() {
    this.isEnabled = false
    this.removeAllBadges()
  }

  removeAllBadges() {
    // Remove all injected badges
    this.injectedBadges.forEach((badge) => {
      if (badge.parentNode) {
        badge.parentNode.removeChild(badge)
      }
    })
    this.injectedBadges.clear()

    // Remove badges by class name as fallback
    const badges = document.querySelectorAll('.linkedintel-executive-badge')
    badges.forEach((badge) => badge.remove())
  }

  // Refresh badges (useful for testing)
  refresh() {
    badgeLogger.debug('LinkedIntel: Manually refreshing badges...')
    this.removeAllBadges()
    setTimeout(() => {
      this.injectExecutiveBadges()
    }, 200)
  }

  // Test badge detection with current page title
  testBadgeDetection() {
    const headline = this.extractHeadline()
    if (headline) {
      badgeLogger.debug('LinkedIntel: Testing badge detection with:', headline)
      this.debugPatternMatching(headline)
      const result = this.detectExecutiveLevel(headline)
      badgeLogger.debug('LinkedIntel: Detection result:', result)
      return result
    } else {
      badgeLogger.debug('LinkedIntel: No headline found for testing')
      return null
    }
  }

  // Get current badge count
  getBadgeCount() {
    return this.injectedBadges.size
  }

  // Cleanup method
  cleanup() {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }

    clearTimeout(this.badgeTimeout)
    this.removeAllBadges()

    if (this.badgeStyles && this.badgeStyles.parentNode) {
      this.badgeStyles.parentNode.removeChild(this.badgeStyles)
      this.badgeStyles = null
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExecutiveBadgeInjector
}

// Initialize badge injector
badgeLogger.debug('LinkedIntel: Badge injector script loading...')

// Initialize when DOM is ready or immediately if already ready
function initializeBadgeInjector() {
  try {
    badgeLogger.debug('LinkedIntel: Initializing badge injector...')
    window.executiveBadgeInjector = new ExecutiveBadgeInjector()
    badgeLogger.debug(
      'LinkedIntel: Executive Badge Injector loaded successfully'
    )
  } catch (error) {
    badgeLogger.error('LinkedIntel: Error creating badge injector:', error)
  }
}

// Try to initialize immediately
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBadgeInjector)
} else {
  initializeBadgeInjector()
}

// Also try after a short delay for LinkedIn's dynamic content
setTimeout(initializeBadgeInjector, 1000)
