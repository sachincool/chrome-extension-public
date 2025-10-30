// SDR Insights Panel - Display actionable sales intelligence and AI-generated outreach
// Replaces generic "Quick Summary" with useful SDR tools

const sdrInsightsLogger = window.createLogger
  ? window.createLogger('SDRInsights')
  : console;

class SDRInsightsPanel {
  constructor() {
    this.panel = null;
    this.isVisible = false;
    this.isGenerating = false;
  }

  /**
   * Initialize and inject the panel
   * @param {boolean} isProfile - Whether this is a profile page
   * @returns {Promise<void>}
   */
  async initialize(isProfile) {
    if (!isProfile) {
      sdrInsightsLogger.info('SDR Insights only for profiles, skipping');
      return;
    }

    // Check if AI is available
    if (!window.chromeAI || !(await window.chromeAI.isAvailable('prompt'))) {
      sdrInsightsLogger.warn('Chrome AI not available, skipping SDR insights');
      return;
    }

    // Find target location
    const target = this.findTargetElement();
    if (!target) {
      sdrInsightsLogger.warn('Target element not found for SDR insights');
      return;
    }

    // Create and inject button
    this.createButton(target);
    
    sdrInsightsLogger.info('SDR Insights Panel initialized');
  }

  /**
   * Find target element to attach button
   * @returns {HTMLElement|null}
   */
  findTargetElement() {
    // Try multiple selectors for LinkedIn's changing DOM
    const selectors = [
      '.pv-top-card-v2-ctas', // Main CTA section
      '.pv-top-card__cta-container',
      '.pvs-profile-actions',
      '.pv-top-card-profile-picture__container',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        sdrInsightsLogger.debug(`Found target with selector: ${selector}`);
        return el;
      }
    }

    return null;
  }

  /**
   * Create SDR insights button
   * @param {HTMLElement} target - Target element
   */
  createButton(target) {
    const button = document.createElement('button');
    button.className = 'linkedintel-sdr-insights-btn';
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
        <path d="M18 3v4M16 5h4"/>
      </svg>
      <span>SDR Insights</span>
    `;

    button.addEventListener('click', () => this.togglePanel());

    target.appendChild(button);
    this.button = button;
  }

  /**
   * Toggle panel visibility
   */
  async togglePanel() {
    if (this.isVisible) {
      this.hidePanel();
    } else {
      await this.showPanel();
    }
  }

  /**
   * Show insights panel
   */
  async showPanel() {
    if (this.isGenerating) return;

    this.isGenerating = true;
    this.button.classList.add('loading');

    try {
      // Scrape profile data
      const profileData = this.extractProfileData();
      
      // Extract recent posts
      const posts = await window.linkedInPostsScraper.extractRecentPosts(window.location.href);
      const insights = window.linkedInPostsScraper.generateInsights(posts);
      
      // Generate outreach message
      const outreach = await window.aiOutreachGenerator.generateOutreachMessage(
        profileData,
        insights,
        'cold_outreach'
      );

      // Create and show panel
      this.panel = this.createPanel(profileData, insights, outreach);
      document.body.appendChild(this.panel);
      
      // Animate in
      requestAnimationFrame(() => {
        this.panel.classList.add('visible');
      });

      this.isVisible = true;
    } catch (error) {
      sdrInsightsLogger.error('Error generating insights:', error);
      this.showError('Failed to generate insights. Please try again.');
    } finally {
      this.isGenerating = false;
      this.button.classList.remove('loading');
    }
  }

  /**
   * Hide insights panel
   */
  hidePanel() {
    if (this.panel) {
      this.panel.classList.remove('visible');
      setTimeout(() => {
        this.panel?.remove();
        this.panel = null;
      }, 300);
    }
    this.isVisible = false;
  }

  /**
   * Extract profile data from page
   * @returns {Object} Profile data
   */
  extractProfileData() {
    const data = {
      name: '',
      headline: '',
      currentPosition: '',
      company: '',
      location: '',
      about: '',
    };

    // Name
    const nameEl = document.querySelector('.pv-top-card--list li:first-child, .text-heading-xlarge');
    data.name = nameEl ? nameEl.innerText.trim() : '';

    // Headline
    const headlineEl = document.querySelector('.pv-top-card--list-bullet, .text-body-medium');
    data.headline = headlineEl ? headlineEl.innerText.trim() : '';

    // Location
    const locationEl = document.querySelector('.pv-top-card--list-bullet + li, .text-body-small.inline');
    data.location = locationEl ? locationEl.innerText.trim() : '';

    // About section
    const aboutEl = document.querySelector('.pv-about__summary-text, .inline-show-more-text');
    data.about = aboutEl ? aboutEl.innerText.trim() : '';

    // Current position (from experience section)
    const currentPosEl = document.querySelector('.pvs-entity__caption-wrapper');
    if (currentPosEl) {
      data.currentPosition = currentPosEl.innerText.trim();
    }

    return data;
  }

  /**
   * Create panel HTML
   * @param {Object} profileData - Profile data
   * @param {Object} insights - Post insights
   * @param {Object} outreach - Generated outreach
   * @returns {HTMLElement} Panel element
   */
  createPanel(profileData, insights, outreach) {
    const panel = document.createElement('div');
    panel.className = 'linkedintel-sdr-insights-panel';
    
    panel.innerHTML = `
      <div class="panel-overlay" data-close></div>
      <div class="panel-content">
        <div class="panel-header">
          <div class="header-left">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
            </svg>
            <h2>SDR Insights</h2>
            <span class="confidence-badge" data-confidence="${outreach.confidence}">
              ${outreach.confidence}% confidence
            </span>
          </div>
          <button class="close-btn" data-close>×</button>
        </div>

        <div class="panel-body">
          <!-- Personalized Outreach Message -->
          <section class="outreach-section">
            <h3>🎯 Personalized Outreach</h3>
            <div class="outreach-message">
              <div class="message-text">${this.escapeHtml(outreach.message)}</div>
              <div class="message-actions">
                <button class="copy-btn" data-copy="${this.escapeHtml(outreach.message)}">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Copy
                </button>
                <button class="regenerate-btn" data-regenerate>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 2v6h-6"></path>
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                    <path d="M3 22v-6h6"></path>
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                  </svg>
                  Regenerate
                </button>
              </div>
            </div>
            ${outreach.hook ? `
              <div class="hook-context">
                <strong>Hook:</strong> ${this.escapeHtml(outreach.hook.reason)}
                <span class="relevance">(${outreach.hook.relevance}% relevant)</span>
              </div>
            ` : ''}
          </section>

          <!-- Recent Activity -->
          ${this.renderRecentActivity(insights)}

          <!-- Key Topics -->
          ${insights.recentTopics.length > 0 ? `
            <section class="topics-section">
              <h3>💡 Topics of Interest</h3>
              <div class="topics-list">
                ${insights.recentTopics.map(topic => `
                  <span class="topic-tag">#${this.escapeHtml(topic)}</span>
                `).join('')}
              </div>
            </section>
          ` : ''}

          <!-- Talking Points -->
          ${this.renderTalkingPoints(profileData, insights)}
        </div>
      </div>
    `;

    // Add event listeners
    panel.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', () => this.hidePanel());
    });

    panel.querySelector('[data-copy]')?.addEventListener('click', (e) => {
      const text = e.currentTarget.getAttribute('data-copy');
      this.copyToClipboard(text);
    });

    panel.querySelector('[data-regenerate]')?.addEventListener('click', () => {
      this.regenerateMessage(profileData, insights);
    });

    return panel;
  }

  /**
   * Render recent activity section
   * @param {Object} insights - Insights data
   * @returns {string} HTML string
   */
  renderRecentActivity(insights) {
    const activities = [];

    if (insights.conferences?.length > 0) {
      activities.push({
        icon: '🎤',
        title: 'Conference',
        text: insights.conferences[0].text,
        date: insights.conferences[0].date,
      });
    }

    if (insights.speaking?.length > 0) {
      activities.push({
        icon: '🎙️',
        title: 'Speaking',
        text: insights.speaking[0].text,
        date: insights.speaking[0].date,
      });
    }

    if (insights.achievements?.length > 0) {
      activities.push({
        icon: '🏆',
        title: 'Achievement',
        text: insights.achievements[0].text,
        date: insights.achievements[0].date,
      });
    }

    if (activities.length === 0) return '';

    return `
      <section class="activity-section">
        <h3>📊 Recent Activity</h3>
        <div class="activity-list">
          ${activities.map(activity => `
            <div class="activity-item">
              <span class="activity-icon">${activity.icon}</span>
              <div class="activity-content">
                <div class="activity-header">
                  <strong>${this.escapeHtml(activity.title)}</strong>
                  ${activity.date ? `<span class="activity-date">${this.escapeHtml(activity.date)}</span>` : ''}
                </div>
                <p class="activity-text">${this.escapeHtml(activity.text.substring(0, 150))}${activity.text.length > 150 ? '...' : ''}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  /**
   * Render talking points section
   * @param {Object} profileData - Profile data
   * @param {Object} insights - Insights data
   * @returns {string} HTML string
   */
  renderTalkingPoints(profileData, insights) {
    const points = [];

    if (insights.conferences?.length > 0) {
      points.push(`Ask about their experience at the conference`);
    }

    if (insights.speaking?.length > 0) {
      points.push(`Reference their speaking engagement and expertise`);
    }

    if (insights.painPoints?.length > 0) {
      points.push(`Address mentioned challenges or pain points`);
    }

    if (points.length === 0) {
      points.push(`Discuss their current role and responsibilities`);
      points.push(`Explore their professional interests`);
    }

    return `
      <section class="talking-points-section">
        <h3>💬 Suggested Talking Points</h3>
        <ul class="talking-points-list">
          ${points.map(point => `<li>${this.escapeHtml(point)}</li>`).join('')}
        </ul>
      </section>
    `;
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      
      // Show success feedback
      const copyBtn = this.panel?.querySelector('[data-copy]');
      if (copyBtn) {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Copied!
        `;
        copyBtn.classList.add('success');
        
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
          copyBtn.classList.remove('success');
        }, 2000);
      }
    } catch (error) {
      sdrInsightsLogger.error('Failed to copy:', error);
    }
  }

  /**
   * Regenerate outreach message
   * @param {Object} profileData - Profile data
   * @param {Object} insights - Insights data
   */
  async regenerateMessage(profileData, insights) {
    const regenerateBtn = this.panel?.querySelector('[data-regenerate]');
    if (!regenerateBtn) return;

    regenerateBtn.classList.add('loading');
    regenerateBtn.disabled = true;

    try {
      const newOutreach = await window.aiOutreachGenerator.generateOutreachMessage(
        profileData,
        insights,
        'cold_outreach'
      );

      // Update message in panel
      const messageEl = this.panel?.querySelector('.message-text');
      if (messageEl) {
        messageEl.textContent = newOutreach.message;
      }

      // Update copy button
      const copyBtn = this.panel?.querySelector('[data-copy]');
      if (copyBtn) {
        copyBtn.setAttribute('data-copy', newOutreach.message);
      }

      // Update hook context
      const hookEl = this.panel?.querySelector('.hook-context');
      if (hookEl && newOutreach.hook) {
        hookEl.innerHTML = `
          <strong>Hook:</strong> ${this.escapeHtml(newOutreach.hook.reason)}
          <span class="relevance">(${newOutreach.hook.relevance}% relevant)</span>
        `;
      }
    } catch (error) {
      sdrInsightsLogger.error('Failed to regenerate:', error);
    } finally {
      regenerateBtn.classList.remove('loading');
      regenerateBtn.disabled = false;
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    // Create simple error panel
    const panel = document.createElement('div');
    panel.className = 'linkedintel-sdr-insights-panel error';
    panel.innerHTML = `
      <div class="panel-overlay" data-close></div>
      <div class="panel-content">
        <div class="panel-header">
          <h2>Error</h2>
          <button class="close-btn" data-close>×</button>
        </div>
        <div class="panel-body">
          <p class="error-message">${this.escapeHtml(message)}</p>
        </div>
      </div>
    `;

    panel.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', () => {
        panel.remove();
        this.isVisible = false;
      });
    });

    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('visible'));
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize on page load
if (typeof window !== 'undefined') {
  window.sdrInsightsPanel = new SDRInsightsPanel();
  
  // Auto-initialize on LinkedIn profile pages
  if (window.location.href.includes('linkedin.com/in/')) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.sdrInsightsPanel?.initialize(true);
      }, 2000);
    });
  }
}

