// AI Status Indicator Component
// Shows Chrome AI model availability, download status, and enabled features

const statusLogger = window.createLogger ? window.createLogger('AIStatus') : console;

class AIStatusIndicator {
  constructor() {
    this.statusElement = null;
    this.isExpanded = false;
    this.availability = null;
    this.updateInterval = null;
  }

  /**
   * Create and render the status indicator
   * @param {HTMLElement} container - Container element
   */
  async render(container) {
    if (!container) {
      statusLogger.error('No container provided for AI status indicator');
      return;
    }

    // Initialize Chrome AI service if not already done
    if (window.chromeAI && !window.chromeAI.isInitialized) {
      try {
        this.availability = await window.chromeAI.initialize();
      } catch (error) {
        statusLogger.error('Failed to initialize Chrome AI:', error);
      }
    } else if (window.chromeAI) {
      this.availability = window.chromeAI.getDetailedAvailability();
    }

    this.statusElement = this.createStatusElement();
    container.appendChild(this.statusElement);

    // Update status every 30 seconds
    this.updateInterval = setInterval(() => this.updateStatus(), 30000);

    statusLogger.info('AI Status Indicator rendered');
  }

  /**
   * Create the status indicator element
   * @returns {HTMLElement} Status element
   */
  createStatusElement() {
    const wrapper = document.createElement('div');
    wrapper.className = 'linkedintel-ai-status-wrapper';
    wrapper.innerHTML = this.getStatusHTML();

    // Bind events
    setTimeout(() => {
      const toggleBtn = wrapper.querySelector('.linkedintel-ai-status-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => this.toggleExpanded());
      }

      const helpBtn = wrapper.querySelector('.linkedintel-ai-help-btn');
      if (helpBtn) {
        helpBtn.addEventListener('click', () => this.showHelp());
      }
    }, 100);

    return wrapper;
  }

  /**
   * Get HTML for status indicator
   * @returns {string} HTML
   */
  getStatusHTML() {
    if (!window.chromeAI) {
      return this.getUnavailableHTML();
    }

    const details = window.chromeAI.getDetailedAvailability();
    const enabledCount = Object.values(details).filter((api) => api.available).length;
    const totalCount = Object.keys(details).length;

    return `
      <div class="linkedintel-ai-status ${this.isExpanded ? 'expanded' : 'collapsed'}">
        <button class="linkedintel-ai-status-toggle" title="AI Features Status">
          <svg class="linkedintel-ai-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
          </svg>
          <span class="linkedintel-ai-status-text">
            Chrome AI: ${enabledCount}/${totalCount} active
          </span>
          <svg class="linkedintel-ai-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>

        <div class="linkedintel-ai-status-details">
          <div class="linkedintel-ai-status-header">
            <h4>Chrome Built-in AI Features</h4>
            <button class="linkedintel-ai-help-btn" title="Help">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </button>
          </div>

          <div class="linkedintel-ai-features-list">
            ${this.getFeatureItemHTML('Summarizer', details.summarizer, 'Instant on-device summaries')}
            ${this.getFeatureItemHTML('Writer', details.writer, 'Generate messages & content')}
            ${this.getFeatureItemHTML('Rewriter', details.rewriter, 'Refine text with tone adjustments')}
            ${this.getFeatureItemHTML('Proofreader', details.proofreader, 'Grammar & spell checking')}
            ${this.getFeatureItemHTML('Prompt API', details.prompt, 'Intelligent chat responses')}
          </div>

          ${this.getModelInfoHTML(details)}
          
          <div class="linkedintel-ai-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span>All processing happens on your device</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get HTML for unavailable state
   * @returns {string} HTML
   */
  getUnavailableHTML() {
    return `
      <div class="linkedintel-ai-status unavailable">
        <div class="linkedintel-ai-status-text">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <span>Chrome AI Unavailable</span>
        </div>
      </div>
    `;
  }

  /**
   * Get feature item HTML
   * @param {string} name - Feature name
   * @param {Object} status - Feature status
   * @param {string} description - Feature description
   * @returns {string} HTML
   */
  getFeatureItemHTML(name, status, description) {
    const isAvailable = status?.available || false;
    const requiresDownload = status?.requiresDownload || false;

    let statusIcon, statusText, statusClass;

    if (isAvailable) {
      statusIcon = `<svg class="linkedintel-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>`;
      statusText = 'Ready';
      statusClass = 'available';
    } else if (requiresDownload) {
      statusIcon = `<svg class="linkedintel-download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>`;
      statusText = 'Download Required';
      statusClass = 'download-required';
    } else {
      statusIcon = `<svg class="linkedintel-unavailable-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>`;
      statusText = 'Unavailable';
      statusClass = 'unavailable';
    }

    return `
      <div class="linkedintel-ai-feature-item ${statusClass}">
        <div class="linkedintel-ai-feature-icon">
          ${statusIcon}
        </div>
        <div class="linkedintel-ai-feature-info">
          <div class="linkedintel-ai-feature-name">${name}</div>
          <div class="linkedintel-ai-feature-desc">${description}</div>
        </div>
        <div class="linkedintel-ai-feature-status">${statusText}</div>
      </div>
    `;
  }

  /**
   * Get model information HTML
   * @param {Object} details - Availability details
   * @returns {string} HTML
   */
  getModelInfoHTML(details) {
    const anyAvailable = Object.values(details).some((api) => api.available);
    const anyDownloadRequired = Object.values(details).some((api) => api.requiresDownload);

    if (!anyAvailable && !anyDownloadRequired) {
      return `
        <div class="linkedintel-ai-model-info warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <div class="linkedintel-ai-model-title">Chrome AI Not Available</div>
            <div class="linkedintel-ai-model-desc">
              Update to Chrome 127+ and enable chrome://flags/#optimization-guide-on-device-model
            </div>
          </div>
        </div>
      `;
    }

    if (anyDownloadRequired) {
      return `
        <div class="linkedintel-ai-model-info info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <div>
            <div class="linkedintel-ai-model-title">Model Download Required</div>
            <div class="linkedintel-ai-model-desc">
              Gemini Nano (~1.5GB) will download automatically when you use an AI feature
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="linkedintel-ai-model-info success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <div>
          <div class="linkedintel-ai-model-title">All Systems Ready</div>
          <div class="linkedintel-ai-model-desc">
            Gemini Nano is downloaded and ready to use
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Toggle expanded state
   */
  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
    if (this.statusElement) {
      const statusDiv = this.statusElement.querySelector('.linkedintel-ai-status');
      if (statusDiv) {
        statusDiv.classList.toggle('expanded', this.isExpanded);
        statusDiv.classList.toggle('collapsed', !this.isExpanded);
      }
    }
  }

  /**
   * Update status
   */
  async updateStatus() {
    if (!window.chromeAI) return;

    try {
      this.availability = window.chromeAI.getDetailedAvailability();
      if (this.statusElement && this.statusElement.parentElement) {
        const newElement = this.createStatusElement();
        this.statusElement.replaceWith(newElement);
        this.statusElement = newElement;
      }
    } catch (error) {
      statusLogger.error('Error updating AI status:', error);
    }
  }

  /**
   * Show help modal
   */
  showHelp() {
    const modal = document.createElement('div');
    modal.className = 'linkedintel-ai-help-modal';
    modal.innerHTML = `
      <div class="linkedintel-ai-help-overlay"></div>
      <div class="linkedintel-ai-help-content">
        <div class="linkedintel-ai-help-header">
          <h3>Chrome Built-in AI Features</h3>
          <button class="linkedintel-ai-help-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="linkedintel-ai-help-body">
          <h4>🚀 What is Chrome Built-in AI?</h4>
          <p>
            Chrome's built-in AI uses Gemini Nano, an on-device language model that runs 
            directly in your browser. This means faster responses, better privacy, and 
            no internet required for basic AI features.
          </p>

          <h4>⚡ Requirements</h4>
          <ul>
            <li>Chrome 127 or later (Dev/Canary recommended)</li>
            <li>Enable <code>chrome://flags/#optimization-guide-on-device-model</code></li>
            <li>Enable <code>chrome://flags/#prompt-api-for-gemini-nano</code></li>
            <li>~1.5GB disk space for Gemini Nano model</li>
          </ul>

          <h4>🎯 Features in LinkedIntel</h4>
          <ul>
            <li><strong>Summarizer:</strong> Instant profile and company summaries</li>
            <li><strong>Writer:</strong> Generate personalized outreach messages</li>
            <li><strong>Rewriter:</strong> Refine your messages with different tones</li>
            <li><strong>Proofreader:</strong> Check grammar before sending</li>
            <li><strong>Prompt API:</strong> Fast responses for common questions</li>
          </ul>

          <h4>🔒 Privacy & Security</h4>
          <p>
            All Chrome AI processing happens entirely on your device. Your data never 
            leaves your computer, and no information is sent to Google servers.
          </p>

          <h4>📚 Learn More</h4>
          <a href="https://developer.chrome.com/docs/ai/built-in" target="_blank" rel="noopener">
            Chrome Built-in AI Documentation →
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Bind close events
    const closeBtn = modal.querySelector('.linkedintel-ai-help-close');
    const overlay = modal.querySelector('.linkedintel-ai-help-overlay');

    const closeModal = () => modal.remove();

    closeBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    statusLogger.info('AI help modal shown');
  }

  /**
   * Destroy the status indicator
   */
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.statusElement && this.statusElement.parentElement) {
      this.statusElement.remove();
    }

    this.statusElement = null;
    statusLogger.info('AI Status Indicator destroyed');
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.AIStatusIndicator = AIStatusIndicator;
}

