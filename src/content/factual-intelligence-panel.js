/**
 * Factual Intelligence Panel - Display verifiable sales intelligence
 * 
 * PURPOSE: Show objective, fact-based intelligence that SDRs can verify
 * NOT: AI-generated messages or subjective analysis
 * 
 * Data shown:
 * - Timeline of verifiable events (conferences, awards, job changes)
 * - Positive/negative signals with evidence
 * - Data points with sources
 * - All facts link to verification methods
 */

const factualIntelLogger = window.createLogger
  ? window.createLogger('FactualIntel')
  : console

class FactualIntelligencePanel {
  constructor() {
    this.panel = null
    this.isVisible = false
    this.isLoading = false
    this.currentData = null
  }

  /**
   * Initialize panel for profile page
   */
  async initialize(isProfile) {
    if (!isProfile) {
      factualIntelLogger.info('Factual Intelligence only for profiles')
      return
    }

    // Check if fact extraction service is available
    if (!window.factExtractionService) {
      factualIntelLogger.warn('Fact extraction service not available')
      return
    }

    // Find inject location
    const target = this.findInjectLocation()
    if (!target) {
      factualIntelLogger.warn('Could not find inject location')
      return
    }

    // Create trigger button
    this.createTriggerButton(target)
    factualIntelLogger.info('Factual Intelligence Panel initialized')
  }

  /**
   * Find location to inject button
   */
  findInjectLocation() {
    const selectors = [
      '.pv-top-card-v2-ctas',
      '.pv-top-card__cta-container',
      '.pvs-profile-actions',
      '.pv-top-card-profile-picture__container',
    ]

    for (const selector of selectors) {
      const el = document.querySelector(selector)
      if (el) return el
    }

    return null
  }

  /**
   * Create trigger button
   */
  createTriggerButton(target) {
    const button = document.createElement('button')
    button.className = 'linkedintel-factual-intel-btn'
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 3v18h18"/>
        <path d="M18 17V9"/>
        <path d="M13 17V5"/>
        <path d="M8 17v-3"/>
      </svg>
      <span>Intelligence</span>
    `

    button.addEventListener('click', () => this.toggle())
    target.appendChild(button)
    this.button = button
  }

  /**
   * Toggle panel
   */
  async toggle() {
    if (this.isVisible) {
      this.hide()
    } else {
      await this.show()
    }
  }

  /**
   * Show panel with intelligence data
   */
  async show() {
    if (this.isLoading) return

    this.isLoading = true
    this.button.classList.add('loading')

    try {
      // Initialize fact extraction service
      const initialized = await window.factExtractionService.initialize()
      if (!initialized) {
        throw new Error('Failed to initialize fact extraction service')
      }

      // Extract profile data
      const profileData = this.extractProfileData()

      // Scrape recent posts
      const posts = await window.linkedInPostsScraper.extractRecentPosts(
        window.location.href
      )

      // Extract factual signals using Chrome AI
      const signals = await window.factExtractionService.extractProfileSignals(
        posts,
        profileData
      )

      // Extract buying signals
      const buyingSignals = await window.factExtractionService.extractBuyingSignals(
        posts,
        profileData
      )

      // Extract timeline
      const timeline = await window.factExtractionService.extractTimeline(
        posts,
        profileData
      )

      // Combine all intelligence
      this.currentData = {
        profile: profileData,
        signals,
        buyingSignals,
        timeline,
        extractedAt: new Date().toISOString(),
      }

      // Optionally: Send to backend for enrichment
      // const enriched = await this.enrichWithBackend(this.currentData)

      // Create and show panel
      this.panel = this.createPanel(this.currentData)
      document.body.appendChild(this.panel)

      requestAnimationFrame(() => {
        this.panel.classList.add('visible')
      })

      this.isVisible = true
      factualIntelLogger.info('Displayed factual intelligence:', this.currentData)
    } catch (error) {
      factualIntelLogger.error('Error loading intelligence:', error)
      this.showError(error.message)
    } finally {
      this.isLoading = false
      this.button.classList.remove('loading')
    }
  }

  /**
   * Hide panel
   */
  hide() {
    if (this.panel) {
      this.panel.classList.remove('visible')
      setTimeout(() => {
        this.panel?.remove()
        this.panel = null
      }, 300)
    }
    this.isVisible = false
  }

  /**
   * Extract basic profile data from page
   */
  extractProfileData() {
    return {
      name: document.querySelector('.text-heading-xlarge')?.innerText.trim() || '',
      headline: document.querySelector('.text-body-medium')?.innerText.trim() || '',
      company: document.querySelector('.pv-text-details__right-panel span')?.innerText.trim() || '',
      location: document.querySelector('.text-body-small.inline')?.innerText.trim() || '',
    }
  }

  /**
   * Create panel HTML
   */
  createPanel(data) {
    const panel = document.createElement('div')
    panel.className = 'linkedintel-factual-intel-panel'

    panel.innerHTML = `
      <div class="panel-overlay" data-close></div>
      <div class="panel-content">
        ${this.renderHeader(data)}
        ${this.renderTabs()}
        <div class="panel-body">
          <div class="tab-content active" data-tab="signals">
            ${this.renderSignals(data)}
          </div>
          <div class="tab-content" data-tab="timeline">
            ${this.renderTimeline(data)}
          </div>
          <div class="tab-content" data-tab="buying">
            ${this.renderBuyingSignals(data)}
          </div>
          <div class="tab-content" data-tab="verification">
            ${this.renderVerification(data)}
          </div>
        </div>
        ${this.renderFooter(data)}
      </div>
    `

    this.attachEventListeners(panel)
    return panel
  }

  /**
   * Render panel header
   */
  renderHeader(data) {
    return `
      <div class="panel-header">
        <div class="header-left">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 3v18h18"/>
            <path d="M18 17V9"/>
            <path d="M13 17V5"/>
            <path d="M8 17v-3"/>
          </svg>
          <div>
            <h2>Factual Intelligence</h2>
            <span class="profile-name">${this.escapeHtml(data.profile.name)}</span>
          </div>
        </div>
        <button class="close-btn" data-close>×</button>
      </div>
    `
  }

  /**
   * Render tabs
   */
  renderTabs() {
    return `
      <div class="panel-tabs">
        <button class="tab-btn active" data-tab="signals">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20V10"/>
            <path d="M18 20V4"/>
            <path d="M6 20v-4"/>
          </svg>
          Signals
        </button>
        <button class="tab-btn" data-tab="timeline">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Timeline
        </button>
        <button class="tab-btn" data-tab="buying">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
          Buying Signals
        </button>
        <button class="tab-btn" data-tab="verification">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          Verify
        </button>
      </div>
    `
  }

  /**
   * Render signals tab
   */
  renderSignals(data) {
    const { signals } = data
    const allSignals = [
      ...signals.conferences.map(s => ({ ...s, type: 'Conference' })),
      ...signals.speaking.map(s => ({ ...s, type: 'Speaking' })),
      ...signals.awards.map(s => ({ ...s, type: 'Award' })),
      ...signals.publications.map(s => ({ ...s, type: 'Publication' })),
      ...signals.jobChanges.map(s => ({ ...s, type: 'Job Change' })),
    ]

    if (allSignals.length === 0) {
      return '<div class="empty-state">No factual signals detected from recent activity.</div>'
    }

    return `
      <div class="signals-grid">
        ${allSignals
          .map(
            (signal) => `
          <div class="signal-card">
            <div class="signal-header">
              <span class="signal-type-badge">${this.escapeHtml(signal.type)}</span>
              ${signal.date ? `<span class="signal-date">${this.escapeHtml(signal.date)}</span>` : ''}
            </div>
            <div class="signal-body">
              <strong>${this.escapeHtml(signal.name || signal.title || signal.event)}</strong>
              ${signal.topic ? `<p class="signal-detail">Topic: ${this.escapeHtml(signal.topic)}</p>` : ''}
              ${signal.organization ? `<p class="signal-detail">By: ${this.escapeHtml(signal.organization)}</p>` : ''}
            </div>
            <details class="signal-evidence">
              <summary>View Evidence</summary>
              <blockquote>"${this.escapeHtml(signal.evidence)}"</blockquote>
            </details>
          </div>
        `
          )
          .join('')}
      </div>
    `
  }

  /**
   * Render timeline tab
   */
  renderTimeline(data) {
    const { timeline } = data

    if (timeline.length === 0) {
      return '<div class="empty-state">No timeline events available.</div>'
    }

    return `
      <div class="timeline-container">
        ${timeline
          .map(
            (event) => `
          <div class="timeline-event">
            <div class="timeline-date">
              <span class="date-badge">${this.formatDate(event.date)}</span>
              <span class="confidence-badge" data-confidence="${event.dateConfidence}">
                ${event.dateConfidence}
              </span>
            </div>
            <div class="timeline-content">
              <div class="event-header">
                <span class="event-type">${this.escapeHtml(event.eventType)}</span>
                <span class="importance-badge" data-importance="${event.importance}">
                  ${event.importance}
                </span>
              </div>
              <h4>${this.escapeHtml(event.title)}</h4>
              <p>${this.escapeHtml(event.description)}</p>
              ${
                event.verificationUrl
                  ? `<a href="${this.escapeHtml(event.verificationUrl)}" target="_blank" class="verify-link">Verify →</a>`
                  : ''
              }
              <details class="event-evidence">
                <summary>Evidence</summary>
                <blockquote>"${this.escapeHtml(event.evidence)}"</blockquote>
                <p class="importance-reason"><strong>Why this matters:</strong> ${this.escapeHtml(event.importanceReason)}</p>
              </details>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `
  }

  /**
   * Render buying signals tab
   */
  renderBuyingSignals(data) {
    const { buyingSignals } = data
    const { positiveSignals, negativeSignals, neutralSignals } = buyingSignals

    return `
      <div class="buying-signals">
        ${
          positiveSignals.length > 0
            ? `
        <section class="signal-section positive">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Positive Signals (${positiveSignals.length})
          </h3>
          ${positiveSignals
            .map(
              (signal) => `
            <div class="buying-signal-card positive">
              <div class="signal-header">
                <span class="signal-type">${this.escapeHtml(signal.type)}</span>
                <span class="confidence-badge" data-confidence="${signal.confidence}">
                  ${signal.confidence} confidence
                </span>
              </div>
              <p class="signal-indicator">${this.escapeHtml(signal.indicator)}</p>
              <div class="signal-meta">
                <span class="signal-date">${this.escapeHtml(signal.date)}</span>
              </div>
              <details class="signal-verification">
                <summary>Evidence & Verification</summary>
                <blockquote>"${this.escapeHtml(signal.evidence)}"</blockquote>
                <div class="verification-method">
                  <strong>How to verify:</strong>
                  <p>${this.escapeHtml(signal.verificationMethod)}</p>
                </div>
              </details>
            </div>
          `
            )
            .join('')}
        </section>
        `
            : ''
        }

        ${
          negativeSignals.length > 0
            ? `
        <section class="signal-section negative">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            Negative Signals (${negativeSignals.length})
          </h3>
          ${negativeSignals
            .map(
              (signal) => `
            <div class="buying-signal-card negative">
              <div class="signal-header">
                <span class="signal-type">${this.escapeHtml(signal.type)}</span>
                <span class="confidence-badge" data-confidence="${signal.confidence}">
                  ${signal.confidence} confidence
                </span>
              </div>
              <p class="signal-indicator">${this.escapeHtml(signal.indicator)}</p>
              <div class="signal-meta">
                <span class="signal-date">${this.escapeHtml(signal.date)}</span>
              </div>
              <details class="signal-verification">
                <summary>Evidence & Verification</summary>
                <blockquote>"${this.escapeHtml(signal.evidence)}"</blockquote>
                <div class="verification-method">
                  <strong>How to verify:</strong>
                  <p>${this.escapeHtml(signal.verificationMethod)}</p>
                </div>
              </details>
            </div>
          `
            )
            .join('')}
        </section>
        `
            : ''
        }

        ${
          neutralSignals.length > 0
            ? `
        <section class="signal-section neutral">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            Context Signals (${neutralSignals.length})
          </h3>
          ${neutralSignals
            .map(
              (signal) => `
            <div class="buying-signal-card neutral">
              <div class="signal-header">
                <span class="signal-type">${this.escapeHtml(signal.type)}</span>
              </div>
              <p class="signal-indicator">${this.escapeHtml(signal.indicator)}</p>
              <p class="signal-relevance"><strong>Relevance:</strong> ${this.escapeHtml(signal.relevance)}</p>
              <div class="signal-meta">
                <span class="signal-date">${this.escapeHtml(signal.date)}</span>
              </div>
              <details class="signal-verification">
                <summary>Evidence</summary>
                <blockquote>"${this.escapeHtml(signal.evidence)}"</blockquote>
              </details>
            </div>
          `
            )
            .join('')}
        </section>
        `
            : ''
        }

        ${
          positiveSignals.length === 0 &&
          negativeSignals.length === 0 &&
          neutralSignals.length === 0
            ? '<div class="empty-state">No buying signals detected from recent activity.</div>'
            : ''
        }
      </div>
    `
  }

  /**
   * Render verification tab
   */
  renderVerification(data) {
    return `
      <div class="verification-guide">
        <section class="verification-section">
          <h3>🔍 How to Verify This Intelligence</h3>
          <p>All data points shown in this panel are extracted from publicly visible LinkedIn activity. Here's how to verify each type:</p>
        </section>

        <section class="verification-section">
          <h4>Conference Attendance / Speaking</h4>
          <ul class="verification-list">
            <li>Check conference website attendee/speaker list</li>
            <li>Search LinkedIn posts with conference hashtag</li>
            <li>Look for conference photos/session recordings</li>
            <li>Check event platforms (Eventbrite, Hopin, etc.)</li>
          </ul>
        </section>

        <section class="verification-section">
          <h4>Awards & Recognition</h4>
          <ul class="verification-list">
            <li>Visit issuing organization's website</li>
            <li>Search press releases and announcements</li>
            <li>Check award winner lists (if publicly available)</li>
            <li>Look for official badge on LinkedIn profile</li>
          </ul>
        </section>

        <section class="verification-section">
          <h4>Job Changes</h4>
          <ul class="verification-list">
            <li>Check current employer's "Recent Hires" on LinkedIn</li>
            <li>Search Google for "[name] joins [company]"</li>
            <li>Look for company announcement posts</li>
            <li>Verify on company's team page</li>
          </ul>
        </section>

        <section class="verification-section">
          <h4>Buying Signals (Expansion/Contraction)</h4>
          <ul class="verification-list">
            <li><strong>Hiring:</strong> Check company's "Jobs" tab on LinkedIn</li>
            <li><strong>Funding:</strong> Search Crunchbase, TechCrunch, press releases</li>
            <li><strong>Layoffs:</strong> Search news sites, check WARN notices (US)</li>
            <li><strong>Partnerships:</strong> Check both companies' press pages</li>
          </ul>
        </section>

        <section class="verification-section">
          <h3>⚠️ Important Notes</h3>
          <ul class="verification-list">
            <li>All signals are based on <strong>publicly visible</strong> LinkedIn activity</li>
            <li>Dates may be approximate if not explicitly stated</li>
            <li>Always cross-reference with multiple sources before using in outreach</li>
            <li>Some facts may be outdated if profile hasn't been updated recently</li>
          </ul>
        </section>

        <section class="verification-section">
          <h3>📊 Data Sources</h3>
          <p>This intelligence is extracted from:</p>
          <ul class="verification-list">
            <li>LinkedIn profile posts and activity</li>
            <li>Profile experience and education sections</li>
            <li>Publicly visible engagement (when available)</li>
          </ul>
          <p class="verification-note"><strong>Note:</strong> This panel uses on-device Chrome AI for extraction. No data is sent to external servers without your consent.</p>
        </section>

        <section class="verification-section">
          <button class="export-btn" data-export>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Intelligence Report
          </button>
        </section>
      </div>
    `
  }

  /**
   * Render footer
   */
  renderFooter(data) {
    const extractedDate = new Date(data.extractedAt)
    return `
      <div class="panel-footer">
        <div class="footer-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>Extracted ${this.formatRelativeTime(extractedDate)}</span>
        </div>
        <button class="refresh-btn" data-refresh>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          Refresh
        </button>
      </div>
    `
  }

  /**
   * Attach event listeners
   */
  attachEventListeners(panel) {
    // Close buttons
    panel.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', () => this.hide())
    })

    // Tab switching
    panel.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab')
        this.switchTab(panel, tab)
      })
    })

    // Refresh button
    panel.querySelector('[data-refresh]')?.addEventListener('click', () => {
      this.hide()
      setTimeout(() => this.show(), 300)
    })

    // Export button
    panel.querySelector('[data-export]')?.addEventListener('click', () => {
      this.exportReport()
    })
  }

  /**
   * Switch active tab
   */
  switchTab(panel, tabName) {
    // Update tab buttons
    panel.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName)
    })

    // Update tab content
    panel.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.toggle('active', content.getAttribute('data-tab') === tabName)
    })
  }

  /**
   * Export intelligence report
   */
  exportReport() {
    if (!this.currentData) return

    const report = {
      profile: this.currentData.profile,
      signals: this.currentData.signals,
      buyingSignals: this.currentData.buyingSignals,
      timeline: this.currentData.timeline,
      exportedAt: new Date().toISOString(),
      source: 'LinkedIntel Factual Intelligence',
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${this.currentData.profile.name.replace(/\s+/g, '_')}_Intelligence_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)

    factualIntelLogger.info('Exported intelligence report')
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorPanel = document.createElement('div')
    errorPanel.className = 'linkedintel-factual-intel-panel error'
    errorPanel.innerHTML = `
      <div class="panel-overlay" data-close></div>
      <div class="panel-content">
        <div class="panel-header">
          <h2>Error</h2>
          <button class="close-btn" data-close>×</button>
        </div>
        <div class="panel-body">
          <p class="error-message">${this.escapeHtml(message)}</p>
          <p class="error-help">Make sure Chrome AI is properly configured. Run <code>testChromeAI()</code> in console for diagnostics.</p>
        </div>
      </div>
    `

    errorPanel.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', () => errorPanel.remove())
    })

    document.body.appendChild(errorPanel)
    requestAnimationFrame(() => errorPanel.classList.add('visible'))
  }

  /**
   * Format date
   */
  formatDate(dateStr) {
    if (!dateStr) return 'Date unknown'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch (error) {
      return dateStr
    }
  }

  /**
   * Format relative time
   */
  formatRelativeTime(date) {
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleDateString()
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return ''
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  /**
   * Clean up
   */
  destroy() {
    this.hide()
    this.button?.remove()
  }
}

// Initialize
if (typeof window !== 'undefined') {
  window.factualIntelligencePanel = new FactualIntelligencePanel()

  // Auto-initialize on LinkedIn profile pages
  if (window.location.href.includes('linkedin.com/in/')) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.factualIntelligencePanel?.initialize(true)
      }, 2000)
    })
  }
}

