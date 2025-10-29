// AI Summary Badge - Quick on-device summaries for LinkedIn profiles and companies
// Shows a floating badge that generates instant 3-bullet summaries

const badgeLogger = window.createLogger ? window.createLogger('AISummaryBadge') : console;

class AISummaryBadge {
  constructor() {
    this.badge = null;
    this.tooltip = null;
    this.isGenerating = false;
    this.cachedSummary = null;
    this.currentUrl = null;
  }

  /**
   * Initialize the AI summary badge on the page
   */
  async initialize() {
    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.inject());
    } else {
      await this.inject();
    }

    // Re-inject on navigation
    this.setupNavigationListener();
  }

  /**
   * Setup listener for LinkedIn SPA navigation
   */
  setupNavigationListener() {
    // Listen for URL changes
    let lastUrl = window.location.href;
    new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.currentUrl = null;
        this.cachedSummary = null;
        setTimeout(() => this.inject(), 1000);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Inject the badge into the page
   */
  async inject() {
    // Remove existing badge
    this.remove();

    // Check if we're on a profile or company page
    const isProfile = window.location.pathname.includes('/in/');
    const isCompany = window.location.pathname.includes('/company/');

    if (!isProfile && !isCompany) {
      return;
    }

    // Check if Chrome AI is available
    if (!window.chromeAI) {
      badgeLogger.warn('Chrome AI service not available');
      return;
    }

    // Initialize Chrome AI if needed
    if (!window.chromeAI.isInitialized) {
      try {
        await window.chromeAI.initialize();
      } catch (error) {
        badgeLogger.error('Failed to initialize Chrome AI:', error);
        return;
      }
    }

    // Check if Summarizer API is available
    if (!window.chromeAI.isAvailable('summarizer')) {
      badgeLogger.info('Summarizer API not available, skipping badge injection');
      return;
    }

    // Find the target element to attach the badge
    const targetElement = this.findTargetElement(isProfile);
    if (!targetElement) {
      badgeLogger.warn('Target element not found for badge injection');
      return;
    }

    // Create and inject the badge
    this.badge = this.createBadgeElement();
    targetElement.appendChild(this.badge);

    badgeLogger.info('AI Summary Badge injected');
  }

  /**
   * Find the target element to attach the badge to
   * @param {boolean} isProfile - Whether this is a profile page
   * @returns {HTMLElement|null} Target element
   */
  findTargetElement(isProfile) {
    if (isProfile) {
      // For profiles, attach near the profile header
      const profileHeader = document.querySelector('.pv-top-card');
      if (profileHeader) {
        // Create a wrapper if it doesn't exist
        let wrapper = profileHeader.querySelector('.linkedintel-ai-badge-container');
        if (!wrapper) {
          wrapper = document.createElement('div');
          wrapper.className = 'linkedintel-ai-badge-container';
          wrapper.style.position = 'relative';
          profileHeader.style.position = 'relative';
          profileHeader.appendChild(wrapper);
        }
        return wrapper;
      }
    } else {
      // For companies, attach near the company header
      const companyHeader = document.querySelector('.org-top-card');
      if (companyHeader) {
        let wrapper = companyHeader.querySelector('.linkedintel-ai-badge-container');
        if (!wrapper) {
          wrapper = document.createElement('div');
          wrapper.className = 'linkedintel-ai-badge-container';
          wrapper.style.position = 'relative';
          companyHeader.style.position = 'relative';
          companyHeader.appendChild(wrapper);
        }
        return wrapper;
      }
    }

    return null;
  }

  /**
   * Create the badge element
   * @returns {HTMLElement} Badge element
   */
  createBadgeElement() {
    const badge = document.createElement('div');
    badge.className = 'linkedintel-ai-summary-badge';
    badge.innerHTML = `
      <button class="linkedintel-ai-summary-btn" title="Quick AI Summary">
        <svg class="linkedintel-ai-sparkle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
        </svg>
        <span>Quick Summary</span>
      </button>
    `;

    // Bind click event
    const btn = badge.querySelector('.linkedintel-ai-summary-btn');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleBadgeClick(e);
    });

    return badge;
  }

  /**
   * Handle badge click
   * @param {Event} event - Click event
   */
  async handleBadgeClick(event) {
    if (this.isGenerating) {
      badgeLogger.info('Summary generation already in progress');
      return;
    }

    const btn = event.currentTarget;

    // Check if we have a cached summary for this URL
    if (this.cachedSummary && this.currentUrl === window.location.href) {
      this.showTooltip(this.cachedSummary, btn);
      return;
    }

    // Show loading state
    btn.classList.add('generating');
    this.isGenerating = true;

    try {
      // Extract page content
      const content = this.extractPageContent();
      
      if (!content) {
        throw new Error('Could not extract page content');
      }

      // Generate summary using Chrome AI
      const summary = await this.generateSummary(content);
      
      // Cache the summary
      this.cachedSummary = summary;
      this.currentUrl = window.location.href;

      // Show tooltip with summary
      this.showTooltip(summary, btn);

      badgeLogger.info('Summary generated successfully');
    } catch (error) {
      badgeLogger.error('Error generating summary:', error);
      
      // Show error tooltip
      this.showTooltip(
        {
          bullets: [
            'Unable to generate summary',
            error.message || 'Please try again',
            'You may need to download the AI model first',
          ],
          isError: true,
        },
        btn
      );
    } finally {
      btn.classList.remove('generating');
      this.isGenerating = false;
    }
  }

  /**
   * Extract relevant content from the page
   * @returns {string} Extracted content
   */
  extractPageContent() {
    const isProfile = window.location.pathname.includes('/in/');
    
    if (isProfile) {
      return this.extractProfileContent();
    } else {
      return this.extractCompanyContent();
    }
  }

  /**
   * Extract profile content
   * @returns {string} Profile content
   */
  extractProfileContent() {
    const parts = [];

    // Name and headline
    const name = document.querySelector('.pv-top-card--list > li:first-child')?.textContent?.trim();
    const headline = document.querySelector('.pv-top-card--list-bullet')?.textContent?.trim();
    
    if (name) parts.push(`Name: ${name}`);
    if (headline) parts.push(`Title: ${headline}`);

    // About section
    const about = document.querySelector('.pv-about-section .pv-about__summary-text')?.textContent?.trim();
    if (about) {
      parts.push(`About: ${about.substring(0, 500)}`);
    }

    // Experience (first few)
    const experiences = document.querySelectorAll('.pv-profile-section__list-item');
    if (experiences.length > 0) {
      parts.push('Recent Experience:');
      Array.from(experiences).slice(0, 3).forEach((exp) => {
        const expText = exp.textContent?.trim().substring(0, 200);
        if (expText) parts.push(`- ${expText}`);
      });
    }

    return parts.join('\n').substring(0, 2000);
  }

  /**
   * Extract company content
   * @returns {string} Company content
   */
  extractCompanyContent() {
    const parts = [];

    // Company name and tagline
    const name = document.querySelector('.org-top-card-summary__title')?.textContent?.trim();
    const tagline = document.querySelector('.org-top-card-summary__tagline')?.textContent?.trim();
    
    if (name) parts.push(`Company: ${name}`);
    if (tagline) parts.push(`Tagline: ${tagline}`);

    // About section
    const about = document.querySelector('.org-about-us-organization-description__text')?.textContent?.trim();
    if (about) {
      parts.push(`About: ${about.substring(0, 500)}`);
    }

    // Industry and size
    const details = document.querySelectorAll('.org-about-company-module__company-size-definition-text');
    details.forEach((detail) => {
      const text = detail.textContent?.trim();
      if (text) parts.push(text);
    });

    return parts.join('\n').substring(0, 2000);
  }

  /**
   * Generate summary using Chrome AI Summarizer
   * @param {string} content - Content to summarize
   * @returns {Promise<Object>} Summary object
   */
  async generateSummary(content) {
    try {
      const summary = await window.chromeAI.summarizeText(content, {
        type: 'key-points',
        format: 'plain-text',
        length: 'short',
        context: 'This is a LinkedIn profile or company page. Provide 3 key bullet points.',
      });

      // Parse summary into bullets (try to extract bullet points)
      const bullets = this.parseSummaryIntoBullets(summary);

      return {
        bullets: bullets,
        isError: false,
      };
    } catch (error) {
      badgeLogger.error('Summarizer API error:', error);
      throw error;
    }
  }

  /**
   * Parse summary text into bullet points
   * @param {string} summary - Summary text
   * @returns {Array<string>} Array of bullet points
   */
  parseSummaryIntoBullets(summary) {
    if (!summary) return ['No summary available'];

    // Try to extract bullet points
    const lines = summary.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

    // If we already have bullets, clean them up
    const bullets = lines.map((line) => {
      // Remove common bullet markers
      return line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');
    }).filter((line) => line.length > 10); // Filter out very short lines

    // If we have 0 bullets or too many, just take the first 3 sentences
    if (bullets.length === 0 || bullets.length > 5) {
      const sentences = summary.match(/[^.!?]+[.!?]+/g) || [summary];
      return sentences.slice(0, 3).map((s) => s.trim());
    }

    return bullets.slice(0, 3);
  }

  /**
   * Show tooltip with summary
   * @param {Object} summary - Summary object
   * @param {HTMLElement} anchor - Anchor element
   */
  showTooltip(summary, anchor) {
    // Remove existing tooltip
    this.hideTooltip();

    // Create tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.className = `linkedintel-ai-summary-tooltip ${summary.isError ? 'error' : ''}`;
    
    const bulletsHTML = summary.bullets
      .map((bullet) => `<li>${this.escapeHtml(bullet)}</li>`)
      .join('');

    this.tooltip.innerHTML = `
      <div class="linkedintel-ai-summary-tooltip-content">
        <div class="linkedintel-ai-summary-tooltip-header">
          <div class="linkedintel-ai-summary-tooltip-title">
            ${summary.isError ? '⚠️ Error' : '✨ Quick Summary'}
          </div>
          <button class="linkedintel-ai-summary-tooltip-close" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <ul class="linkedintel-ai-summary-bullets">
          ${bulletsHTML}
        </ul>
        <div class="linkedintel-ai-summary-footer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>Generated on-device with Chrome AI</span>
        </div>
      </div>
    `;

    // Position tooltip
    document.body.appendChild(this.tooltip);
    this.positionTooltip(anchor);

    // Bind close button
    const closeBtn = this.tooltip.querySelector('.linkedintel-ai-summary-tooltip-close');
    closeBtn?.addEventListener('click', () => this.hideTooltip());

    // Auto-hide after 10 seconds
    setTimeout(() => this.hideTooltip(), 10000);

    badgeLogger.info('Tooltip shown');
  }

  /**
   * Position tooltip relative to anchor
   * @param {HTMLElement} anchor - Anchor element
   */
  positionTooltip(anchor) {
    if (!this.tooltip || !anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();

    // Position below anchor, centered
    let top = anchorRect.bottom + 10;
    let left = anchorRect.left + (anchorRect.width / 2) - (tooltipRect.width / 2);

    // Adjust if off-screen
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }

    if (top + tooltipRect.height > window.innerHeight - 10) {
      // Show above instead
      top = anchorRect.top - tooltipRect.height - 10;
    }

    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    if (this.tooltip && this.tooltip.parentElement) {
      this.tooltip.remove();
    }
    this.tooltip = null;
  }

  /**
   * Escape HTML
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Remove the badge
   */
  remove() {
    if (this.badge && this.badge.parentElement) {
      this.badge.remove();
    }
    this.badge = null;

    this.hideTooltip();
  }

  /**
   * Destroy the badge component
   */
  destroy() {
    this.remove();
    badgeLogger.info('AI Summary Badge destroyed');
  }
}

// Auto-initialize on load
if (typeof window !== 'undefined') {
  window.AISummaryBadge = AISummaryBadge;
  
  // Create global instance
  const aiSummaryBadge = new AISummaryBadge();
  window.aiSummaryBadge = aiSummaryBadge;
  
  // Initialize when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => aiSummaryBadge.initialize());
  } else {
    aiSummaryBadge.initialize();
  }
}

