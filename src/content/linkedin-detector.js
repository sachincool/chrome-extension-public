// LinkedIntel Content Script - LinkedIn Page Detection & SPA Navigation
// Detects profile and company pages, handles SPA navigation, extracts basic data

// Initialize logger using shared helper function
const detectorLogger = window.createLogger('LinkedInDetector')

class LinkedInDetector {
  constructor() {
    this.currentUrl = window.location.href
    this.currentPageType = null
    this.currentPageData = null
    this.observer = null
    this.initialized = false
    this.fabComponent = null
    this.extractionTimeout = null

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init())
    } else {
      this.init()
    }
  }

  init() {
    if (this.initialized) return
    this.initialized = true

    detectorLogger.debug('LinkedIntel: Initializing LinkedIn detector')
    detectorLogger.debug(
      'LinkedIntel: *** EXTENSION CODE UPDATED - VERSION 3.0 with Web Navigation API ***'
    )

    // Initial page detection
    this.detectCurrentPage()

    // Listen for SPA navigation events from service worker (Web Navigation API)
    this.setupWebNavigationListener()

    // Legacy: Keep minimal DOM observer as fallback
    // The service worker's Web Navigation API is the primary detection mechanism
    this.setupFallbackObserver()
  }

  detectCurrentPage() {
    const url = window.location.href
    const pathname = window.location.pathname

    detectorLogger.debug('LinkedIntel: Detecting page type for:', url)

    // Profile page detection
    if (pathname.includes('/in/') && !pathname.includes('/company/')) {
      this.handleProfilePage(url)
    }
    // Company page detection
    else if (pathname.includes('/company/')) {
      this.handleCompanyPage(url)
    }
    // Other LinkedIn pages
    else {
      this.currentPageType = null
      this.currentPageData = null
    }
  }

  handleProfilePage(url) {
    detectorLogger.debug('LinkedIntel: Profile page detected')

    const extractProfileData = () => {
      const data = {
        url: url,
        type: 'profile',
        name: this.extractProfileName(),
        headline: this.extractProfileHeadline(),
        company: this.extractCurrentCompany(),
        location: this.extractLocation(),
        executiveLevel: this.detectExecutiveLevel(),
        timestamp: Date.now(),
      }

      // Only include activity if we have actual data
      const activity = this.extractRecentActivity()
      if (
        activity &&
        (activity.totalPosts > 0 || activity.recentPosts?.length > 0)
      ) {
        data.activity = activity
      }

      if (data.name) {
        this.currentPageType = 'profile'
        this.currentPageData = data
        detectorLogger.debug(
          'LinkedIntel: Enhanced profile data extracted:',
          data
        )
        detectorLogger.debug(
          'LinkedIntel: Company field in extracted data:',
          data.company
        )
        this.notifyServiceWorker('LINKEDIN_PAGE_DETECTED', data)
        // Ensure FAB is present on profile pages
        this.ensureFAB()
      } else {
        // Profile data not loaded yet, try again shortly
        this.extractionTimeout = setTimeout(extractProfileData, 1000)
      }
    }

    // LinkedIn loads content dynamically - wait for it to be ready
    // Try immediate extraction, then retry with increasing delays
    setTimeout(extractProfileData, 500)
    setTimeout(extractProfileData, 1500)
  }

  handleCompanyPage(url) {
    detectorLogger.debug('LinkedIntel: Company page detected')

    const extractCompanyData = () => {
      const data = {
        url: url,
        type: 'company',
        name: this.extractCompanyName(),
        industry: this.extractCompanyIndustry(),
        size: this.extractCompanySize(),
        location: this.extractCompanyLocation(),
        followerCount: this.extractCompanyFollowers(),
        about: this.extractCompanyAbout(),
        website: this.extractCompanyWebsite(),
        timestamp: Date.now(),
      }

      if (data.name) {
        this.currentPageType = 'company'
        this.currentPageData = data
        this.notifyServiceWorker('LINKEDIN_PAGE_DETECTED', data)
        detectorLogger.debug(
          'LinkedIntel: Enhanced company data extracted:',
          data
        )
        // Ensure FAB is present on company pages
        this.ensureFAB()
      } else {
        // Company data not loaded yet, try again shortly
        this.extractionTimeout = setTimeout(extractCompanyData, 1000)
      }
    }

    // Try immediate extraction, then retry if needed
    extractCompanyData()
  }

  // Enhanced profile data extraction methods with modern selectors
  extractProfileName() {
    const selectors = [
      'h1.text-heading-xlarge',
      'h1[data-anonymize="person-name"]',
      '.pv-text-details__left-panel h1',
      '.ph5 h1',
      '.pv-top-card--list h1',
      '.pv-top-card h1',
      'h1[data-test-id="profile-name"]',
      '.scaffold-layout__main h1.text-heading-xlarge',
    ]

    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element && element.textContent && element.textContent.trim()) {
        return element.textContent.trim()
      }
    }
    return null
  }

  extractProfileHeadline() {
    const selectors = [
      '.text-body-medium.break-words',
      '.pv-text-details__left-panel .text-body-medium',
      '[data-anonymize="headline"]',
      '.pv-top-card--list .text-body-medium',
      '.pv-top-card .text-body-medium',
      '.pv-text-details__left-panel > .text-body-medium',
      '.scaffold-layout__main .text-body-medium.break-words',
      '[data-test-id="profile-headline"]',
    ]

    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element && element.textContent && element.textContent.trim()) {
        // Filter out elements that are just location or other non-headline text
        const text = element.textContent.trim()
        if (
          text &&
          !this.isLocationText(text) &&
          !this.isConnectionText(text)
        ) {
          return text
        }
      }
    }
    return null
  }

  extractCurrentCompany() {
    detectorLogger.debug('[LinkedIntel] === EXTRACTING CURRENT COMPANY ===')

    // Strategy 0: LinkedIn's "Current company" button with aria-label (highest priority)
    let company = this._tryAriaLabelExtraction()
    if (company) return company

    // Strategy 0.2: Direct company link selectors
    company = this._tryDirectCompanyLinks()
    if (company) return company

    // Strategy 0.5: Text pattern extraction (when no links available)
    company = this._tryTextPatternExtraction()
    if (company) return company

    // Strategy 0.6: Broader profile text extraction
    company = this._tryBroaderTextExtraction()
    if (company) return company

    // Strategy 1: Experience section (first/current position)
    company = this._tryExperienceSection()
    if (company) return company

    // Strategy 2: Priority selectors for modern LinkedIn
    company = this._tryPrioritySelectors()
    if (company) return company

    // Final Fallback: Extract from profile headline
    company = this._tryHeadlineExtraction()
    if (company) return company

    detectorLogger.debug(
      '[LinkedIntel] ❌ No company found after all strategies'
    )
    return null
  }

  /**
   * Strategy 0: Extract company from aria-label on "Current company" button
   * @private
   * @returns {string|null} Company name or null
   */
  _tryAriaLabelExtraction() {
    detectorLogger.debug(
      '[LinkedIntel] Strategy 0: Checking aria-label on current company button...'
    )

    const buttonSelectors = [
      'button[aria-label*="Current company"]',
      'button[aria-label*="current company"]',
      '#profile-content button[aria-label*="Current company"]',
      'section.artdeco-card button[aria-label*="Current company"]',
      'ul > li:first-child > button[aria-label*="Current company"]',
      '.pv-top-card button[aria-label*="Current company"]',
      '.pv-profile-section button[aria-label*="Current company"]',
    ]

    for (const selector of buttonSelectors) {
      const currentCompanyButton = document.querySelector(selector)
      if (currentCompanyButton) {
        const ariaLabel = currentCompanyButton.getAttribute('aria-label')
        detectorLogger.debug(
          `[LinkedIntel] Found current company button via "${selector}", aria-label:`,
          ariaLabel
        )

        if (ariaLabel) {
          const match = ariaLabel.match(/current company:\s*([^.]+)/i)
          if (match && match[1]) {
            const companyName = match[1].trim()
            detectorLogger.debug(
              '[LinkedIntel] ✅ Company extracted from aria-label:',
              companyName
            )
            return companyName
          }
        }

        const companySpan = currentCompanyButton.querySelector(
          '.hoverable-link-text, .text-body-small, .inline-show-more-text, span[aria-hidden="true"], span'
        )
        if (companySpan) {
          const companyName = companySpan.textContent?.trim()
          if (
            companyName &&
            companyName.length > 0 &&
            companyName.length < 100
          ) {
            detectorLogger.debug(
              '[LinkedIntel] ✅ Company extracted from button inner text:',
              companyName
            )
            return companyName
          }
        }
      }
    }

    // Debug logging
    const allButtons = document.querySelectorAll('button[aria-label]')
    detectorLogger.debug(
      `[LinkedIntel] Found ${allButtons.length} buttons with aria-labels on page`
    )
    let companyButtonsFound = 0

    detectorLogger.debug('[LinkedIntel] All button aria-labels found:')
    allButtons.forEach((btn, idx) => {
      const label = btn.getAttribute('aria-label')
      detectorLogger.debug(`[LinkedIntel]   Button ${idx}: "${label}"`)
      if (label && label.toLowerCase().includes('company')) {
        companyButtonsFound++
        detectorLogger.debug(`[LinkedIntel]     ✅ Contains "company"`)
      }
    })
    detectorLogger.debug(
      `[LinkedIntel] Total buttons with "company" in aria-label: ${companyButtonsFound}`
    )

    return null
  }

  /**
   * Strategy 0.2: Extract company from direct company link selectors
   * @private
   * @returns {string|null} Company name or null
   */
  _tryDirectCompanyLinks() {
    detectorLogger.debug(
      '[LinkedIntel] Strategy 0.2: Trying direct company link selectors...'
    )

    const companyLinkSelectors = [
      '.pv-text-details__left-panel a[href*="/company/"]:first-of-type',
      '.pv-top-card a[href*="/company/"]:first-of-type',
      '.pv-text-details a[href*="/company/"]:first-of-type',
      'a[href*="/company/"]:first-of-type',
    ]

    for (const selector of companyLinkSelectors) {
      const profileCompanyLink = document.querySelector(selector)
      if (
        profileCompanyLink &&
        profileCompanyLink.textContent &&
        profileCompanyLink.textContent.trim()
      ) {
        const companyName = profileCompanyLink.textContent.trim()
        detectorLogger.debug(
          `[LinkedIntel] Current company found via selector "${selector}":`,
          companyName
        )
        return companyName
      } else {
        detectorLogger.debug(
          `[LinkedIntel] No company found with selector: "${selector}"`
        )
      }
    }

    const allCompanyLinks = document.querySelectorAll('a[href*="/company/"]')
    detectorLogger.debug(
      `[LinkedIntel] Found ${allCompanyLinks.length} total company links on page:`
    )
    allCompanyLinks.forEach((link, index) => {
      detectorLogger.debug(
        `  ${index + 1}. "${link.textContent?.trim()}" -> ${link.href}`
      )
    })

    return null
  }

  /**
   * Strategy 0.5: Extract company from profile text patterns (when no links available)
   * @private
   * @returns {string|null} Company name or null
   */
  _tryTextPatternExtraction() {
    const allCompanyLinks = document.querySelectorAll('a[href*="/company/"]')
    if (allCompanyLinks.length > 0) {
      return null // Only use this strategy when no company links exist
    }

    detectorLogger.debug(
      '[LinkedIntel] No company links found, trying text extraction...'
    )
    detectorLogger.debug('[LinkedIntel] Looking for "at [Company]" pattern...')

    const headerElements = document.querySelectorAll(
      '.pv-text-details__left-panel *, .pv-top-card *, .pv-text-details *, h1 + *, .text-heading-xlarge + *'
    )

    for (const element of headerElements) {
      const text = element.textContent?.trim()
      if (text && text.includes(' at ')) {
        detectorLogger.debug(`[LinkedIntel] Found "at" pattern in: "${text}"`)
        const atMatch = text.match(
          /\bat\s+([A-Za-z][A-Za-z0-9\s&.,'-]{1,30}?)(?:\s|$|,|\.)/i
        )
        if (
          atMatch &&
          !text.toLowerCase().includes('former') &&
          !text.toLowerCase().includes('previous')
        ) {
          const companyName = atMatch[1].trim()
          detectorLogger.debug(
            `[LinkedIntel] Company extracted from "at" pattern: "${companyName}"`
          )
          return companyName
        }
      }
    }

    const companyTextSelectors = [
      '.pv-text-details__left-panel .text-body-small:not(a)',
      '.pv-top-card .text-body-small:not(.break-words)',
      '.pv-text-details .text-body-small:not(.break-words)',
      '.pv-top-card-section .text-body-small',
    ]

    for (const selector of companyTextSelectors) {
      const elements = document.querySelectorAll(selector)
      for (const element of elements) {
        const text = element.textContent?.trim()
        if (
          text &&
          text.length > 1 &&
          text.length < 50 &&
          !this.isLocationText(text) &&
          !this.isConnectionText(text) &&
          !text.includes('followers') &&
          !text.includes('connections') &&
          !text.includes('•') &&
          !text.toLowerCase().includes('contact info')
        ) {
          detectorLogger.debug(
            `[LinkedIntel] Potential company name from text: "${text}"`
          )
          if (/^[A-Za-z][A-Za-z0-9\s&.,'-]+$/.test(text)) {
            detectorLogger.debug(
              `[LinkedIntel] Company name extracted from profile text: "${text}"`
            )
            return text
          }
        }
      }
    }

    return null
  }

  /**
   * Strategy 0.6: Extract company from broader profile text areas
   * @private
   * @returns {string|null} Company name or null
   */
  _tryBroaderTextExtraction() {
    detectorLogger.debug(
      '[LinkedIntel] Trying broader profile text extraction...'
    )
    detectorLogger.debug(
      '[LinkedIntel] DEBUG: Inspecting profile header content...'
    )

    const debugSelectors = [
      '.pv-text-details__left-panel',
      '.pv-top-card',
      '.pv-text-details',
    ]

    for (const selector of debugSelectors) {
      const element = document.querySelector(selector)
      if (element) {
        detectorLogger.debug(
          `[LinkedIntel] ${selector} full text:`,
          element.textContent?.trim().substring(0, 200)
        )
      }
    }

    const broadSelectors = [
      '.pv-text-details__left-panel span:not(a)',
      '.pv-top-card span:not(a)',
      '.pv-text-details span:not(a)',
      '.text-body-small span',
      '.pv-entity__summary-info span',
    ]

    for (const selector of broadSelectors) {
      const elements = document.querySelectorAll(selector)
      for (const element of elements) {
        const text = element.textContent?.trim()
        if (
          text &&
          text.length > 2 &&
          text.length < 30 &&
          !this.isLocationText(text) &&
          !this.isConnectionText(text) &&
          !text.includes('•') &&
          !text.includes('followers') &&
          !text.includes('connections') &&
          !text.includes('years') &&
          !text.includes('months') &&
          !text.toLowerCase().includes('contact') &&
          !text.toLowerCase().includes('experience') &&
          !text.toLowerCase().includes('education')
        ) {
          if (
            /^[A-Z][A-Za-z0-9\s&.,'-]{1,28}$/.test(text) &&
            !text.match(/^\d/) &&
            !text.includes('@')
          ) {
            detectorLogger.debug(
              `[LinkedIntel] Potential company from broader search: "${text}"`
            )

            const parentText = element.parentElement?.textContent?.trim()
            if (
              parentText &&
              !parentText.toLowerCase().includes('former') &&
              !parentText.toLowerCase().includes('previous') &&
              !parentText.toLowerCase().includes('ex-')
            ) {
              detectorLogger.debug(
                `[LinkedIntel] Company name found via broad text extraction: "${text}"`
              )
              return text
            }
          }
        }
      }
    }

    return null
  }

  /**
   * Strategy 1: Extract company from experience section
   * @private
   * @returns {string|null} Company name or null
   */
  _tryExperienceSection() {
    const experienceSection =
      document.querySelector('#experience') ||
      document.querySelector('[data-section="experience"]') ||
      document.querySelector('.experience-section')

    if (!experienceSection) {
      return null
    }

    const firstExperienceItem =
      experienceSection.querySelector('.artdeco-list__item:first-child') ||
      experienceSection.querySelector(
        '.pv-entity__position-group-pager:first-child'
      ) ||
      experienceSection.querySelector('.experience-item:first-child')

    if (!firstExperienceItem) {
      return null
    }

    const companyLink =
      firstExperienceItem.querySelector(
        'a[href*="/company/"]:not([href*="school"]):not([href*="university"])'
      ) ||
      firstExperienceItem.querySelector(
        '.pv-entity__secondary-title a[href*="/company/"]'
      ) ||
      firstExperienceItem.querySelector(
        '.t-14.t-black--light a[href*="/company/"]'
      )

    if (companyLink && companyLink.textContent && companyLink.href) {
      const companyName = companyLink.textContent.trim()
      const companyUrl = companyLink.href

      const isValidCompanyLink =
        companyUrl.includes('/company/') &&
        !companyUrl.includes('truefoundry') &&
        !companyName.toLowerCase().includes('capital') &&
        !companyName.toLowerCase().includes('ventures')

      if (companyName && companyName.length > 1 && isValidCompanyLink) {
        detectorLogger.debug(
          '[LinkedIntel] Current company found from experience section:',
          companyName,
          'URL:',
          companyUrl
        )
        return companyName
      }
    }

    return null
  }

  /**
   * Strategy 2: Extract company using priority selectors
   * @private
   * @returns {string|null} Company name or null
   */
  _tryPrioritySelectors() {
    const currentCompanySelectors = [
      'button[aria-label*="Current company"] span',
      '[data-test-id="current-company"] a',
      '.pv-text-details__left-panel .text-body-small a[href*="/company/"]:first-child',
      '.pv-top-card--list-bullet .pv-text-details__left-panel a[href*="/company/"]',
      '.pv-top-card-v2-ctas .pv-text-details__left-panel a[href*="/company/"]',
    ]

    for (const selector of currentCompanySelectors) {
      const element = document.querySelector(selector)
      if (element && element.textContent && element.textContent.trim()) {
        const companyName = element.textContent.trim()
        if (
          companyName.length > 1 &&
          !companyName.includes('Current company')
        ) {
          detectorLogger.debug(
            '[LinkedIntel] Current company found via priority selector:',
            companyName
          )
          return companyName
        }
      }
    }

    const generalSelectors = [
      '[data-anonymize="company-name"]',
      '.pv-entity__summary-info h3 a',
      '.pv-top-card--list .pv-text-details__left-panel .text-body-small a',
      '.experience-section .pv-entity__summary-info h3 a:first-child',
      '.pv-profile-section .pv-entity__summary-info a',
      '.scaffold-layout__main .text-body-small a[href*="/company/"]',
      '.pv-text-details__left-panel .pv-text-details__right-panel a[href*="/company/"]',
      '.pv-top-card .pv-text-details__left-panel a[data-field="experience_company_logo"]',
      '.experience-item .pv-entity__summary-info .pv-entity__summary-info-v2 a[href*="/company/"]',
      '.artdeco-entity-lockup__subtitle a[href*="/company/"]',
    ]

    for (const selector of generalSelectors) {
      const element = document.querySelector(selector)
      if (element && element.textContent && element.textContent.trim()) {
        const companyName = element.textContent.trim()
        if (
          (element.href && element.href.includes('/company/')) ||
          element.getAttribute('data-test-id') === 'current-company'
        ) {
          detectorLogger.debug(
            '[LinkedIntel] Company found via direct selector:',
            companyName
          )
          return companyName
        }
      }
    }

    return null
  }

  /**
   * Final Fallback: Extract company from profile headline
   * @private
   * @returns {string|null} Company name or null
   */
  _tryHeadlineExtraction() {
    detectorLogger.debug(
      '[LinkedIntel] Final fallback: Trying to extract company from headline...'
    )

    const headline = this.extractProfileHeadline()
    if (!headline) {
      return null
    }

    detectorLogger.debug('[LinkedIntel] Headline text:', headline)

    const headlineParts = headline.split('|').map((p) => p.trim())
    detectorLogger.debug('[LinkedIntel] Headline parts:', headlineParts)

    for (let i = 0; i < headlineParts.length; i++) {
      const part = headlineParts[i]
      detectorLogger.debug(`[LinkedIntel] Analyzing part ${i}: "${part}"`)

      if (/\b(former|previous|ex-|past)\b/i.test(part)) {
        detectorLogger.debug(
          `[LinkedIntel]   Skipping - contains "former/previous/ex"`
        )
        continue
      }

      const atMatch = part.match(
        /\bat\s+([A-Z][A-Za-z0-9\s&.'-]{2,30}?)(?:\s*[,|]|$)/i
      )
      if (atMatch && atMatch[1]) {
        const companyName = atMatch[1].trim()
        if (
          !companyName.toLowerCase().includes('leading') &&
          !companyName.toLowerCase().includes('helping') &&
          !companyName.toLowerCase().includes('building')
        ) {
          detectorLogger.debug(
            '[LinkedIntel] ✅ Company extracted from headline "at" pattern:',
            companyName
          )
          return companyName
        }
      }

      const atSymbolMatch = part.match(
        /@\s*([A-Z][A-Za-z0-9\s&.'-]{2,30}?)(?:\s*[,|]|$)/i
      )
      if (atSymbolMatch && atSymbolMatch[1]) {
        const companyName = atSymbolMatch[1].trim()
        detectorLogger.debug(
          '[LinkedIntel] ✅ Company extracted from headline "@" pattern:',
          companyName
        )
        return companyName
      }
    }

    if (headlineParts.length > 0) {
      const firstPart = headlineParts[0]
      if (!/\b(former|previous|ex-|past)\b/i.test(firstPart)) {
        const titleMatch = firstPart.match(
          /(?:CEO|CTO|CFO|COO|CXO|SVP|VP|Chief\s+\w+\s+Officer)[,\s]+([A-Z][A-Za-z0-9\s&.'-]{2,30}?)(?:\s*[,|]|$)/i
        )
        if (titleMatch && titleMatch[1]) {
          const companyName = titleMatch[1].trim()
          if (!this.isLocationText(companyName)) {
            detectorLogger.debug(
              '[LinkedIntel] ✅ Company extracted from title pattern:',
              companyName
            )
            return companyName
          }
        }
      }
    }

    detectorLogger.debug(
      '[LinkedIntel] No company found in headline after filtering former roles'
    )
    return null
  }

  extractLocation() {
    const selectors = [
      '.text-body-small.inline.t-black--light.break-words',
      '[data-anonymize="location"]',
      '.pv-text-details__left-panel .text-body-small:not(a)',
      '.pv-top-card--list .text-body-small.inline',
      '[data-test-id="profile-location"]',
      '.scaffold-layout__main .text-body-small.inline.t-black--light',
    ]

    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (
        element &&
        element.textContent &&
        element.textContent.trim() &&
        !element.querySelector('a')
      ) {
        const text = element.textContent.trim()
        if (this.isLocationText(text)) {
          return text
        }
      }
    }
    return null
  }

  // Enhanced company data extraction methods
  extractCompanyName() {
    const selectors = [
      // Modern LinkedIn company page selectors
      'h1.org-top-card-summary__title',
      'h1[data-anonymize="company-name"]',
      '.org-page-navigation__title',
      '.org-top-card h1',
      '.scaffold-layout__main h1.text-heading-xlarge',
      '[data-test-id="company-name"]',
      '.org-top-card-summary .text-heading-xlarge',
      // Additional modern selectors
      '.org-top-card-summary-info-list__item h1',
      '.org-top-card-summary__info h1',
      'h1.t-24.t-black.t-normal',
      '.org-top-card-primary-content h1',
      // Fallback selectors
      '.org-about-company-module h1',
      '.org-top-card-summary-info-list h1',
    ]

    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element && element.textContent && element.textContent.trim()) {
        return element.textContent.trim()
      }
    }

    // Fallback: try to extract from page title
    const pageTitle = document.title
    if (pageTitle && pageTitle.includes('|')) {
      const titleParts = pageTitle.split('|')
      if (titleParts.length > 0) {
        const companyName = titleParts[0].trim()
        if (companyName && !companyName.toLowerCase().includes('linkedin')) {
          detectorLogger.debug(
            '[LinkedIntel] Company name extracted from title:',
            companyName
          )
          return companyName
        }
      }
    }

    // Fallback: try to extract from URL
    const url = window.location.href
    const urlMatch = url.match(/\/company\/([^\/\?]+)/)
    if (urlMatch && urlMatch[1]) {
      const companySlug = decodeURIComponent(urlMatch[1])
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase())
      detectorLogger.debug(
        '[LinkedIntel] Company name extracted from URL:',
        companySlug
      )
      return companySlug
    }

    return null
  }

  extractCompanyIndustry() {
    detectorLogger.debug('[LinkedIntel] Extracting company industry...')

    const selectors = [
      // Modern LinkedIn 2024+ selectors
      '.org-top-card-summary-info-list__info-item',
      '.org-page-details__definition-text:first-child',
      '[data-anonymize="industry"]',
      '.org-top-card-summary .org-top-card-summary-info-list .text-body-medium',
      '[data-test-id="company-industry"]',
      '.org-top-card-summary__info-item',
    ]

    // Try standard selectors first
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector)
      detectorLogger.debug(
        `[LinkedIntel] Trying selector "${selector}" - found ${elements.length} elements`
      )

      for (const element of elements) {
        if (element && element.textContent && element.textContent.trim()) {
          const text = element.textContent.trim()
          // Filter out non-industry text (employees, followers, location patterns)
          if (
            !text.includes('employees') &&
            !text.includes('followers') &&
            !text.match(/\d+-\d+/) && // Filter "11-50" patterns (employee counts)
            !text.match(/\d+\+/) && // Filter "10,001+" patterns
            !/,\s*[A-Z]{2}/.test(text) && // Filter locations like "City, CA"
            text.length > 3 &&
            text.length < 100
          ) {
            detectorLogger.debug(`[LinkedIntel] ✅ Industry found: "${text}"`)
            return text
          }
        }
      }
    }

    // Try searching for elements containing "Industry" label
    detectorLogger.debug('[LinkedIntel] Trying to find "Industry" label...')
    const aboutSection = document.querySelector(
      '.org-about-company-module, .org-about-us-company-module'
    )
    if (aboutSection) {
      const textElements = aboutSection.querySelectorAll(
        '.text-body-medium, .text-body-small, dt, dd'
      )
      for (let i = 0; i < textElements.length; i++) {
        const element = textElements[i]
        const text = element.textContent.trim()

        // Check if this is an "Industry" label
        if (text.toLowerCase().includes('industry') && text.length < 20) {
          // Next element might be the value
          const nextElement = textElements[i + 1]
          if (nextElement) {
            const industryValue = nextElement.textContent.trim()
            if (
              industryValue &&
              !industryValue.toLowerCase().includes('industry')
            ) {
              detectorLogger.debug(
                `[LinkedIntel] ✅ Industry found from label: "${industryValue}"`
              )
              return industryValue
            }
          }
        }

        // Or it might be formatted as "Industry: Value"
        if (text.toLowerCase().includes('industry:')) {
          const industryValue = text.replace(/^Industry\s*:?\s*/i, '').trim()
          if (industryValue && industryValue.length > 3) {
            detectorLogger.debug(
              `[LinkedIntel] ✅ Industry found from colon format: "${industryValue}"`
            )
            return industryValue
          }
        }
      }
    }

    detectorLogger.debug('[LinkedIntel] ❌ Industry not found')
    return null
  }

  extractCompanySize() {
    detectorLogger.debug('[LinkedIntel] Extracting company size...')

    const selectors = [
      // Modern LinkedIn 2024+ selectors
      '.org-top-card-summary-info-list__info-item',
      '.org-page-details__definition-text:last-child',
      '[data-anonymize="company-size"]',
      '[data-test-id="company-size"]',
      '.org-top-card-summary__info-item',
    ]

    // Enhanced regex patterns for employee counts
    const employeePatterns = [
      /(\d+[-–]\d+)\s*employees?/i, // "11-50 employees"
      /(\d+,?\d*)\+\s*employees?/i, // "10,001+ employees"
      /(\d+[-–]\d+)/, // Just numbers "11-50"
      /(\d+,?\d*)\+/, // Just numbers "10,001+"
    ]

    // Try standard selectors first
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector)
      detectorLogger.debug(
        `[LinkedIntel] Trying selector "${selector}" - found ${elements.length} elements`
      )

      for (const element of elements) {
        if (element && element.textContent && element.textContent.trim()) {
          const text = element.textContent.trim()

          // Check if text matches employee patterns
          if (text.toLowerCase().includes('employee')) {
            detectorLogger.debug(
              `[LinkedIntel] ✅ Company size found: "${text}"`
            )
            return text
          }

          // Check for numeric patterns that indicate size
          for (const pattern of employeePatterns) {
            if (pattern.test(text)) {
              // Make sure it's not a date or other number
              if (!text.match(/\d{4}/) && !text.includes('follower')) {
                detectorLogger.debug(
                  `[LinkedIntel] ✅ Company size found (pattern match): "${text}"`
                )
                return text.includes('employee') ? text : `${text} employees`
              }
            }
          }
        }
      }
    }

    // Search for elements containing "employees" text more broadly
    detectorLogger.debug(
      '[LinkedIntel] Searching broadly for "employees" keyword...'
    )
    const elements = document.querySelectorAll(
      '.org-top-card-summary .text-body-medium, .org-top-card-summary .text-body-small, ' +
        '.org-about-company-module .text-body-medium, .org-top-card-summary-info-list div, ' +
        '.org-top-card-summary-info-list span'
    )

    for (const element of elements) {
      const text = element.textContent.trim()
      if (text && text.toLowerCase().includes('employee')) {
        // Make sure it's a size, not just the word "employees" in a sentence
        for (const pattern of employeePatterns) {
          if (pattern.test(text)) {
            detectorLogger.debug(
              `[LinkedIntel] ✅ Company size found (broad search): "${text}"`
            )
            return text
          }
        }
      }
    }

    // Look for "Company size" label
    detectorLogger.debug('[LinkedIntel] Searching for "Company size" label...')
    const allElements = document.querySelectorAll(
      '.org-about-company-module dt, .org-about-company-module .text-body-small'
    )
    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i]
      const text = element.textContent.trim()

      if (
        text.toLowerCase().includes('company size') ||
        text.toLowerCase() === 'size'
      ) {
        const nextElement = allElements[i + 1]
        if (nextElement) {
          const sizeValue = nextElement.textContent.trim()
          if (sizeValue) {
            detectorLogger.debug(
              `[LinkedIntel] ✅ Company size found from label: "${sizeValue}"`
            )
            return sizeValue
          }
        }
      }
    }

    detectorLogger.debug('[LinkedIntel] ❌ Company size not found')
    return null
  }

  extractCompanyLocation() {
    detectorLogger.debug('[LinkedIntel] Extracting company location...')

    const selectors = [
      // Modern LinkedIn 2024+ selectors
      '.org-top-card-summary-info-list__info-item',
      '.org-top-card-summary__info-item:last-child',
      '[data-anonymize="company-location"]',
      '.org-top-card-summary .text-body-small',
      '[data-test-id="company-location"]',
      '.org-page-details__definition-text',
    ]

    // Try standard selectors first
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector)
      detectorLogger.debug(
        `[LinkedIntel] Trying selector "${selector}" - found ${elements.length} elements`
      )

      for (const element of elements) {
        if (element && element.textContent && element.textContent.trim()) {
          const text = element.textContent.trim()

          // Clean up "Headquarters:" prefix if present
          const cleanText = text.replace(/^Headquarters\s*:?\s*/i, '').trim()

          // Validate that it looks like a location
          if (this.isLocationText(cleanText)) {
            detectorLogger.debug(
              `[LinkedIntel] ✅ Location found: "${cleanText}"`
            )
            return cleanText
          }

          // Also check original text with "Headquarters"
          if (text.toLowerCase().includes('headquarters')) {
            detectorLogger.debug(
              `[LinkedIntel] ✅ Location found (with HQ prefix): "${cleanText}"`
            )
            return cleanText
          }
        }
      }
    }

    // Search for elements near location SVG icons
    detectorLogger.debug('[LinkedIntel] Searching for location icons...')
    const locationIcons = document.querySelectorAll(
      'svg[data-test-icon="location-16"], svg[data-test-icon="geo-16"]'
    )
    for (const icon of locationIcons) {
      const parent = icon.closest(
        '.org-top-card-summary-info-list__info-item, .org-top-card-summary__info-item'
      )
      if (parent) {
        const text = parent.textContent.trim()
        if (this.isLocationText(text)) {
          detectorLogger.debug(
            `[LinkedIntel] ✅ Location found via icon: "${text}"`
          )
          return text
        }
      }
    }

    // Search for elements containing "Headquarters" text in about section
    detectorLogger.debug('[LinkedIntel] Searching for "Headquarters" label...')
    const aboutSection = document.querySelector(
      '.org-about-company-module, .org-about-us-company-module'
    )
    if (aboutSection) {
      const textElements = aboutSection.querySelectorAll(
        '.text-body-medium, .text-body-small, dt, dd'
      )
      for (let i = 0; i < textElements.length; i++) {
        const element = textElements[i]
        const text = element.textContent.trim()

        if (
          text.toLowerCase().includes('headquarters') ||
          text.toLowerCase() === 'location'
        ) {
          // Check if this element has the location
          const cleanText = text.replace(/^Headquarters\s*:?\s*/i, '').trim()
          if (
            cleanText &&
            cleanText !== text &&
            this.isLocationText(cleanText)
          ) {
            detectorLogger.debug(
              `[LinkedIntel] ✅ Location found from label (same element): "${cleanText}"`
            )
            return cleanText
          }

          // Or check next element
          const nextElement = textElements[i + 1]
          if (nextElement) {
            const locationValue = nextElement.textContent.trim()
            if (locationValue && this.isLocationText(locationValue)) {
              detectorLogger.debug(
                `[LinkedIntel] ✅ Location found from label (next element): "${locationValue}"`
              )
              return locationValue
            }
          }
        }
      }
    }

    // Last resort: look for location patterns anywhere in top card
    detectorLogger.debug(
      '[LinkedIntel] Last resort: searching all top card text...'
    )
    const topCard = document.querySelector(
      '.org-top-card-summary, .org-top-card'
    )
    if (topCard) {
      const allText = topCard.querySelectorAll(
        '.text-body-small, .text-body-medium, span, div'
      )
      for (const element of allText) {
        const text = element.textContent.trim()
        // Must be reasonably short and match location pattern
        if (text.length > 5 && text.length < 100 && this.isLocationText(text)) {
          // Make sure it's not employee count or follower count
          if (
            !text.toLowerCase().includes('employee') &&
            !text.toLowerCase().includes('follower')
          ) {
            detectorLogger.debug(
              `[LinkedIntel] ✅ Location found (last resort): "${text}"`
            )
            return text
          }
        }
      }
    }

    detectorLogger.debug('[LinkedIntel] ❌ Location not found')
    return null
  }

  // Additional company data extraction methods
  extractCompanyFollowers() {
    detectorLogger.debug('[LinkedIntel] Extracting follower count...')

    const selectors = [
      // Modern LinkedIn 2024+ selectors
      '.org-top-card-actions-wrapper button',
      '.org-top-card-summary-info-list__info-item',
      '.org-followers-count',
      '[data-test-id="company-followers"]',
      '.org-top-card-actions button',
      '.org-top-card-summary__info-item',
    ]

    // Enhanced follower count patterns
    const followerPatterns = [
      /([\d,]+)\s*followers?/i, // "123,456 followers"
      /([\d]+\.?\d*[KMB])\s*followers?/i, // "1.2K followers", "2.5M followers"
      /([\d,]+)/, // Just numbers (if in follower context)
    ]

    // Try standard selectors first
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector)
      detectorLogger.debug(
        `[LinkedIntel] Trying selector "${selector}" - found ${elements.length} elements`
      )

      for (const element of elements) {
        if (element && element.textContent && element.textContent.trim()) {
          const text = element.textContent.trim()

          if (text.toLowerCase().includes('follower')) {
            for (const pattern of followerPatterns) {
              const match = text.match(pattern)
              if (match) {
                const followerStr = match[1]
                const followerCount = this.parseFollowerCount(followerStr)
                if (followerCount > 0) {
                  detectorLogger.debug(
                    `[LinkedIntel] ✅ Follower count found: ${followerCount}`
                  )
                  return followerCount
                }
              }
            }
          }
        }
      }
    }

    // Search for elements containing "followers" text more broadly
    detectorLogger.debug(
      '[LinkedIntel] Searching broadly for "followers" keyword...'
    )
    const elements = document.querySelectorAll(
      '.org-top-card-summary .text-body-medium, .org-top-card-summary .text-body-small, ' +
        '.org-top-card-actions span, .org-top-card-summary-info-list span, button span'
    )

    for (const element of elements) {
      const text = element.textContent.trim()
      if (text && text.toLowerCase().includes('follower')) {
        for (const pattern of followerPatterns) {
          const match = text.match(pattern)
          if (match) {
            const followerStr = match[1]
            const followerCount = this.parseFollowerCount(followerStr)
            if (followerCount > 0) {
              detectorLogger.debug(
                `[LinkedIntel] ✅ Follower count found (broad search): ${followerCount}`
              )
              return followerCount
            }
          }
        }
      }
    }

    detectorLogger.debug('[LinkedIntel] ❌ Follower count not found')
    return null
  }

  /**
   * Parse follower count string to integer
   * Handles formats like "123,456", "1.2K", "2.5M"
   */
  parseFollowerCount(str) {
    if (!str) return 0

    // Remove commas
    str = str.replace(/,/g, '')

    // Handle K (thousands), M (millions), B (billions)
    const multipliers = { K: 1000, M: 1000000, B: 1000000000 }
    const match = str.match(/([\d.]+)([KMB])/i)

    if (match) {
      const number = parseFloat(match[1])
      const multiplier = multipliers[match[2].toUpperCase()]
      return Math.round(number * multiplier)
    }

    // Regular number
    const parsed = parseInt(str)
    return isNaN(parsed) ? 0 : parsed
  }

  extractCompanyAbout() {
    detectorLogger.debug('[LinkedIntel] Extracting company about section...')

    const selectors = [
      // Modern LinkedIn 2024+ selectors (most specific first)
      '.org-about-us-organization-description__text',
      '[data-test-id="about-us__description"]',
      '.org-about-company-module .break-words',
      '.org-about-us-company-module__description',
      '.org-top-card-summary .break-words',
      '[data-test-id="company-about"]',
      '.org-about-module__description',
    ]

    // Try specific selectors first
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      detectorLogger.debug(
        `[LinkedIntel] Trying selector "${selector}" - found: ${!!element}`
      )

      if (element && element.textContent && element.textContent.trim()) {
        const text = element.textContent.trim()

        // Remove "...see more" or "...Read more" text
        const cleanText = text
          .replace(/\.\.\.\s*(see more|read more|show more)/gi, '')
          .trim()

        // Ensure it's substantial text (more than just a tagline)
        if (cleanText.length > 50) {
          const truncated =
            cleanText.substring(0, 500) + (cleanText.length > 500 ? '...' : '')
          detectorLogger.debug(
            `[LinkedIntel] ✅ About section found: ${truncated.substring(
              0,
              100
            )}...`
          )
          return truncated
        }
      }
    }

    // Search for "About" or "Overview" section heading and extract nearby content
    detectorLogger.debug(
      '[LinkedIntel] Searching for "About" or "Overview" section heading...'
    )
    const aboutHeadings = document.querySelectorAll(
      'h1, h2, h3, h4, .section-title, [class*="about"], [class*="overview"]'
    )
    for (const heading of aboutHeadings) {
      const headingText = heading.textContent.trim()
      if (
        (headingText.toLowerCase().includes('about') ||
          headingText.toLowerCase().includes('overview')) &&
        headingText.length < 30
      ) {
        detectorLogger.debug(
          `[LinkedIntel] Found "About/Overview" heading: "${headingText}"`
        )

        // Try to find content in next sibling or parent's next sibling
        let contentElement = heading.nextElementSibling
        if (!contentElement) {
          contentElement = heading.parentElement?.nextElementSibling
        }

        if (contentElement) {
          const text = contentElement.textContent.trim()
          const cleanText = text
            .replace(/\.\.\.\s*(see more|read more|show more)/gi, '')
            .trim()

          if (cleanText.length > 50) {
            const truncated =
              cleanText.substring(0, 500) +
              (cleanText.length > 500 ? '...' : '')
            detectorLogger.debug(
              `[LinkedIntel] ✅ About section found via heading: ${truncated.substring(
                0,
                100
              )}...`
            )
            return truncated
          }
        }
      }
    }

    // Last resort: look for long text blocks in about module
    detectorLogger.debug(
      '[LinkedIntel] Last resort: searching for long text blocks...'
    )
    const aboutModule = document.querySelector(
      '.org-about-company-module, .org-about-us-company-module, [class*="about-us"]'
    )
    if (aboutModule) {
      const textBlocks = aboutModule.querySelectorAll(
        'p, div[class*="description"], div.break-words, span.break-words'
      )
      for (const block of textBlocks) {
        const text = block.textContent.trim()
        const cleanText = text
          .replace(/\.\.\.\s*(see more|read more|show more)/gi, '')
          .trim()

        // Filter out short text and metadata
        if (
          cleanText.length > 50 &&
          !cleanText.toLowerCase().includes('employee') &&
          !cleanText.toLowerCase().includes('follower') &&
          !cleanText.toLowerCase().includes('headquarters')
        ) {
          const truncated =
            cleanText.substring(0, 500) + (cleanText.length > 500 ? '...' : '')
          detectorLogger.debug(
            `[LinkedIntel] ✅ About section found (last resort): ${truncated.substring(
              0,
              100
            )}...`
          )
          return truncated
        }
      }
    }

    detectorLogger.debug('[LinkedIntel] ❌ About section not found')
    return null
  }

  extractCompanyWebsite() {
    detectorLogger.debug('[LinkedIntel] Extracting company website...')

    const selectors = [
      // Modern LinkedIn 2024+ selectors
      '.org-top-card-summary-info-list a[href*="http"]:not([href*="linkedin.com"])',
      '.org-about-us-company-module__website a',
      '[data-test-id="company-website"]',
      '.org-top-card-summary a[href*="http"]:not([href*="linkedin.com"])',
      '.org-about-company-module a[href*="http"]:not([href*="linkedin.com"])',
      '.org-page-details a[href*="http"]:not([href*="linkedin.com"])',
    ]

    // Helper to check if URL is a real external website
    const isValidWebsite = (url) => {
      if (!url) return false

      // Exclude LinkedIn domains
      const excludedDomains = [
        'linkedin.com',
        'l.linkedin.com',
        'lnkd.in',
        'licdn.com',
        'linkedin-ei.com',
      ]

      for (const domain of excludedDomains) {
        if (url.includes(domain)) {
          return false
        }
      }

      // Must be a real URL
      return url.startsWith('http://') || url.startsWith('https://')
    }

    // Try specific selectors first
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      detectorLogger.debug(
        `[LinkedIntel] Trying selector "${selector}" - found: ${!!element}`
      )

      if (element && element.href && isValidWebsite(element.href)) {
        detectorLogger.debug(
          `[LinkedIntel] ✅ Website found: "${element.href}"`
        )
        return element.href
      }
    }

    // Look for "Website" label and extract adjacent link
    detectorLogger.debug('[LinkedIntel] Searching for "Website" label...')
    const aboutSection = document.querySelector(
      '.org-about-company-module, .org-about-us-company-module, .org-page-details'
    )
    if (aboutSection) {
      const labels = aboutSection.querySelectorAll(
        'dt, .label, [class*="label"]'
      )
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i]
        const labelText = label.textContent.trim().toLowerCase()

        if (labelText === 'website' || labelText.includes('website')) {
          detectorLogger.debug(`[LinkedIntel] Found "Website" label`)

          // Look for link in next element
          const nextElement =
            labels[i + 1] ||
            label.nextElementSibling ||
            label.parentElement?.nextElementSibling
          if (nextElement) {
            const link =
              nextElement.querySelector('a[href]') ||
              (nextElement.tagName === 'A' ? nextElement : null)
            if (link && link.href && isValidWebsite(link.href)) {
              detectorLogger.debug(
                `[LinkedIntel] ✅ Website found from label: "${link.href}"`
              )
              return link.href
            }
          }
        }
      }
    }

    // Last resort: find any external link in top card or about section
    detectorLogger.debug(
      '[LinkedIntel] Last resort: searching for any external links...'
    )
    const topCardAndAbout = document.querySelectorAll(
      '.org-top-card-summary a, .org-about-company-module a, .org-page-details a'
    )
    for (const link of topCardAndAbout) {
      if (link.href && isValidWebsite(link.href)) {
        // Prefer links that look like official websites (not social media)
        const url = link.href.toLowerCase()
        const isSocialMedia =
          url.includes('twitter.com') ||
          url.includes('facebook.com') ||
          url.includes('instagram.com') ||
          url.includes('youtube.com') ||
          url.includes('github.com')

        if (!isSocialMedia) {
          detectorLogger.debug(
            `[LinkedIntel] ✅ Website found (last resort): "${link.href}"`
          )
          return link.href
        }
      }
    }

    detectorLogger.debug('[LinkedIntel] ❌ Website not found')
    return null
  }

  // SPA navigation handling
  /**
   * Setup Web Navigation API listener (PRIMARY detection mechanism)
   * Service worker sends SPA_NAVIGATION messages via Web Navigation API
   * This is more reliable and efficient than polling/MutationObserver
   */
  setupWebNavigationListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'SPA_NAVIGATION') {
        detectorLogger.debug(
          'LinkedIntel: SPA navigation event received from service worker:',
          message.data
        )

        // Handle navigation change
        this.handleUrlChange()
        sendResponse({ success: true })
      }
      return true // Keep message channel open for async response
    })

    detectorLogger.info(
      'LinkedIntel: Web Navigation API listener setup complete (event-driven SPA detection)'
    )
  }

  /**
   * Setup minimal fallback observer for edge cases
   * This is only used as a safety net; Web Navigation API is primary
   */
  setupFallbackObserver() {
    // Lightweight observer that only triggers on major content changes
    this.observer = new MutationObserver(() => {
      // Debounce: only check if URL actually changed
      const newUrl = window.location.href
      if (newUrl !== this.currentUrl) {
        detectorLogger.debug(
          'LinkedIntel: Fallback observer detected URL change (Web Navigation API may have missed it)'
        )
        this.handleUrlChange()
      }
    })

    // Only observe the main content area to reduce overhead
    const mainContent = document.querySelector(
      '.scaffold-layout__main, .application-outlet, #main'
    )
    if (mainContent) {
      this.observer.observe(mainContent, {
        childList: true,
        subtree: false, // Don't observe deeply - just direct children
      })
    }

    detectorLogger.info(
      'LinkedIntel: Fallback observer setup (minimal, only for edge cases)'
    )
  }

  handleUrlChange() {
    const newUrl = window.location.href

    if (newUrl !== this.currentUrl) {
      detectorLogger.debug(
        'LinkedIntel: URL changed from',
        this.currentUrl,
        'to',
        newUrl
      )

      // Cleanup previous page resources
      this.cleanupCurrentPage()

      this.currentUrl = newUrl
      this.currentPageType = null
      this.currentPageData = null

      // Small delay to let LinkedIn load content
      setTimeout(() => {
        this.detectCurrentPage()
      }, 800)
    }
  }

  // Enhanced cleanup for navigation
  cleanupCurrentPage() {
    // Remove any existing FAB components
    if (this.fabComponent) {
      this.fabComponent.remove()
      this.fabComponent = null
    }

    // Remove basic FAB as fallback
    const existingFAB = document.getElementById('linkedintel-fab')
    if (existingFAB) {
      existingFAB.remove()
    }

    // Clean up executive badges for previous page
    if (window.executiveBadgeInjector) {
      window.executiveBadgeInjector.removeAllBadges()
    }

    // Clear any timeouts that might be pending
    if (this.extractionTimeout) {
      clearTimeout(this.extractionTimeout)
      this.extractionTimeout = null
    }

    detectorLogger.debug('LinkedIntel: Previous page resources cleaned up')
  }

  // Create/inject FAB when on supported pages
  async ensureFAB() {
    detectorLogger.debug(
      'LinkedIntel: ensureFAB called, LinkedIntelFAB available:',
      !!window.LinkedIntelFAB
    )
    try {
      if (!window.LinkedIntelFAB) {
        detectorLogger.warn('LinkedIntel: LinkedIntelFAB not available')
        return
      }

      if (!this.fabComponent) {
        detectorLogger.debug('LinkedIntel: Creating new FAB component')
        this.fabComponent = new window.LinkedIntelFAB()
        this.fabComponent.inject()
        detectorLogger.debug('LinkedIntel: FAB component injected')

        // Sync usage status from service worker
        try {
          const resp = await chrome.runtime.sendMessage({
            type: 'GET_USAGE_STATUS',
          })
          if (resp && typeof resp.analysesRemaining === 'number') {
            this.fabComponent.setUsageStatus(resp)
          }
        } catch (_) {}
      } else if (!this.fabComponent.isComponentVisible()) {
        this.fabComponent.inject()
      }
    } catch (e) {
      detectorLogger.warn('LinkedIntel: Unable to ensure FAB', e)
    }
  }

  // Communication with service worker
  notifyServiceWorker(type, data) {
    chrome.runtime
      .sendMessage({
        type: type,
        data: data,
      })
      .catch((error) => {
        detectorLogger.error(
          'LinkedIntel: Error sending message to service worker:',
          error
        )
      })

    // Executive badges are handled by the dedicated badge injector
    // FAB injection is handled by fab-component.js
  }

  // Public API for other scripts
  getCurrentPageData() {
    return {
      type: this.currentPageType,
      data: this.currentPageData,
      url: this.currentUrl,
    }
  }

  // Respond to side panel requests for page info
  setupMessageResponder() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.type === 'GET_PAGE_INFO') {
        try {
          sendResponse({ success: true, data: this.getCurrentPageData() })
        } catch (err) {
          sendResponse({ success: false, error: String(err) })
        }
        return true
      }
    })
  }

  // Helper method to load CSS from extension files
  async loadStyleFromFile(filename, styleId) {
    if (document.getElementById(styleId)) {
      return // Already loaded
    }

    try {
      const cssUrl = chrome.runtime.getURL(`src/content/styles/${filename}`)
      const response = await fetch(cssUrl)
      const cssText = await response.text()

      const style = document.createElement('style')
      style.id = styleId
      style.textContent = cssText
      document.head.appendChild(style)
    } catch (error) {
      detectorLogger.warn(`LinkedIntel: Could not load ${filename}:`, error)
    }
  }

  // Method to trigger analysis
  triggerAnalysis() {
    if (!this.currentPageData) {
      detectorLogger.warn('LinkedIntel: No page data available for analysis')
      return
    }

    const messageType =
      this.currentPageType === 'profile' ? 'ANALYZE_PROFILE' : 'ANALYZE_COMPANY'

    chrome.runtime
      .sendMessage({
        type: messageType,
        data: this.currentPageData,
      })
      .then((response) => {
        if (response.error) {
          detectorLogger.error('LinkedIntel: Analysis error:', response.error)
        } else {
          detectorLogger.debug(
            'LinkedIntel: Analysis completed:',
            response.data
          )
        }
      })
      .catch((error) => {
        detectorLogger.error('LinkedIntel: Error requesting analysis:', error)
      })
  }

  // Legacy method - now handled by dedicated badge injector
  injectCXOBadge() {
    detectorLogger.debug(
      'LinkedIntel: Badge injection handled by ExecutiveBadgeInjector'
    )
  }

  // Helper methods for text validation
  isLocationText(text) {
    if (!text) return false
    // Common patterns for location text
    const locationPatterns = [
      /^[A-Za-z\s,.-]+,\s*[A-Za-z\s]+$/, // City, State/Country
      /^[A-Za-z\s]+,\s*[A-Z]{2}$/, // City, State abbreviation
      /^[A-Za-z\s]+ Area$/, // Metropolitan Area
      /^Greater [A-Za-z\s]+ Area$/, // Greater Metropolitan Area
      /\b(United States|United Kingdom|Canada|Australia|Germany|France|Netherlands|Singapore|India)\b/i,
    ]
    return (
      locationPatterns.some((pattern) => pattern.test(text)) &&
      !this.isConnectionText(text) &&
      !this.isHeadlineText(text)
    )
  }

  isConnectionText(text) {
    if (!text) return false
    return (
      /^\d+\+?\s*(connections?|followers?)$/i.test(text) ||
      text.includes('connection') ||
      text.includes('follower')
    )
  }

  isHeadlineText(text) {
    if (!text) return false
    // Headlines usually contain role/title keywords
    const headlineKeywords = [
      /\b(at|@)\s+[A-Z]/,
      /\b(CEO|CTO|CFO|COO|VP|Director|Manager|Engineer|Developer|Analyst|Consultant)\b/i,
      /\b(Lead|Senior|Principal|Head of|Chief)\b/i,
    ]
    return headlineKeywords.some((pattern) => pattern.test(text))
  }

  // Enhanced activity extraction for recent posts and engagement
  extractRecentActivity() {
    const activity = {
      recentPosts: [],
      totalPosts: 0,
      lastPostDate: null,
      engagementLevel: 'unknown',
    }

    try {
      // Look for recent posts in activity section
      const activitySection = document.querySelector(
        '.pv-recent-activity-section, .scaffold-layout__main [data-test-id="recent-activity"]'
      )
      if (activitySection) {
        const posts = activitySection.querySelectorAll(
          '.feed-shared-update-v2, .pv-recent-activity-detail'
        )

        posts.forEach((post, index) => {
          if (index < 5) {
            // Limit to 5 recent posts
            const postData = this.extractPostData(post)
            if (postData) {
              activity.recentPosts.push(postData)
            }
          }
        })

        activity.totalPosts = posts.length
        if (activity.recentPosts.length > 0) {
          activity.lastPostDate = activity.recentPosts[0].date
          activity.engagementLevel = this.calculateEngagementLevel(
            activity.recentPosts
          )
        }
      }
    } catch (error) {
      detectorLogger.debug('LinkedIntel: Error extracting activity:', error)
    }

    return activity
  }

  extractPostData(postElement) {
    try {
      const postText = postElement
        .querySelector('.feed-shared-text, .pv-recent-activity-detail__text')
        ?.textContent?.trim()
      const dateElement = postElement.querySelector(
        'time, .feed-shared-actor__sub-description time'
      )
      const likesElement = postElement.querySelector(
        '[data-test-id="social-counts-reactions"], .social-counts-reactions'
      )
      const commentsElement = postElement.querySelector(
        '[data-test-id="social-counts-comments"], .social-counts-comments'
      )

      if (postText) {
        return {
          text:
            postText.substring(0, 200) + (postText.length > 200 ? '...' : ''),
          date:
            dateElement?.getAttribute('datetime') ||
            dateElement?.textContent ||
            null,
          likes: this.extractNumber(likesElement?.textContent) || 0,
          comments: this.extractNumber(commentsElement?.textContent) || 0,
          type: this.detectPostType(postText),
        }
      }
    } catch (error) {
      detectorLogger.debug('LinkedIntel: Error extracting post data:', error)
    }
    return null
  }

  extractNumber(text) {
    if (!text) return 0
    const match = text.match(/([\d,]+)/)
    return match ? parseInt(match[1].replace(/,/g, '')) : 0
  }

  detectPostType(text) {
    if (!text) return 'general'

    const lowerText = text.toLowerCase()
    if (
      lowerText.includes('hiring') ||
      lowerText.includes('job') ||
      lowerText.includes('position')
    )
      return 'hiring'
    if (
      lowerText.includes('achievement') ||
      lowerText.includes('award') ||
      lowerText.includes('milestone')
    )
      return 'achievement'
    if (
      lowerText.includes('announce') ||
      lowerText.includes('launch') ||
      lowerText.includes('release')
    )
      return 'announcement'
    if (
      lowerText.includes('thought') ||
      lowerText.includes('opinion') ||
      lowerText.includes('believe')
    )
      return 'thought-leadership'

    return 'general'
  }

  calculateEngagementLevel(posts) {
    if (!posts || posts.length === 0) return 'low'

    const avgEngagement =
      posts.reduce((sum, post) => sum + post.likes + post.comments, 0) /
      posts.length

    if (avgEngagement > 50) return 'high'
    if (avgEngagement > 10) return 'medium'
    return 'low'
  }

  // Enhanced executive detection
  detectExecutiveLevel() {
    const headline = this.extractProfileHeadline()
    if (!headline) return null

    const executivePatterns = {
      CEO: {
        patterns: [
          /\bceo\b/i,
          /chief executive officer/i,
          /founder/i,
          /co-founder/i,
        ],
        level: 'C-Suite',
        priority: 1,
      },
      CTO: {
        patterns: [
          /\bcto\b/i,
          /chief technology officer/i,
          /chief technical officer/i,
        ],
        level: 'C-Suite',
        priority: 1,
      },
      CFO: {
        patterns: [/\bcfo\b/i, /chief financial officer/i],
        level: 'C-Suite',
        priority: 1,
      },
      COO: {
        patterns: [/\bcoo\b/i, /chief operating officer/i],
        level: 'C-Suite',
        priority: 1,
      },
      President: {
        patterns: [/\bpresident\b/i, /\bprez\b/i],
        level: 'Executive',
        priority: 2,
      },
      VP: {
        patterns: [
          /\bvp\b/i,
          /vice president/i,
          /\bsvp\b/i,
          /senior vice president/i,
        ],
        level: 'Senior Leadership',
        priority: 3,
      },
      Director: {
        patterns: [
          /\bdirector\b/i,
          /managing director/i,
          /executive director/i,
        ],
        level: 'Leadership',
        priority: 4,
      },
    }

    let bestMatch = null
    let highestPriority = 999

    for (const [title, config] of Object.entries(executivePatterns)) {
      for (const pattern of config.patterns) {
        if (pattern.test(headline) && config.priority < highestPriority) {
          bestMatch = {
            title,
            level: config.level,
            priority: config.priority,
          }
          highestPriority = config.priority
        }
      }
    }

    return bestMatch
  }

  cleanup() {
    if (this.observer) {
      this.observer.disconnect()
    }

    // Remove FAB component
    if (this.fabComponent) {
      this.fabComponent.remove()
      this.fabComponent = null
    }

    // Remove basic FAB as fallback
    const fab = document.getElementById('linkedintel-fab')
    if (fab) fab.remove()

    // Executive badges are cleaned up by the dedicated badge injector
    if (window.executiveBadgeInjector) {
      window.executiveBadgeInjector.cleanup()
    }
  }
}

// Initialize detector
const linkedInDetector = new LinkedInDetector()

// Make detector available globally for debugging
window.linkedInDetector = linkedInDetector

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  linkedInDetector.cleanup()
})

// Start message responder for GET_PAGE_INFO
try {
  linkedInDetector.setupMessageResponder()
} catch (_) {}

detectorLogger.debug('LinkedIntel: Content script loaded')
