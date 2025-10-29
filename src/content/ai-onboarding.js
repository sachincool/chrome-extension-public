// AI Onboarding Component
// First-time user experience for Chrome AI features

const onboardingLogger = window.createLogger ? window.createLogger('AIOnboarding') : console;

class AIOnboarding {
  constructor() {
    this.hasShownOnboarding = false;
    this.storageKey = 'linkedintel_ai_onboarding_shown';
  }

  /**
   * Initialize onboarding flow
   */
  async initialize() {
    // Check if onboarding has been shown
    const hasShown = await this.checkOnboardingStatus();
    
    if (hasShown) {
      onboardingLogger.info('Onboarding already shown, skipping');
      return;
    }

    // Check Chrome AI availability
    if (!window.chromeAI) {
      onboardingLogger.warn('Chrome AI service not available');
      this.showUnavailableModal();
      return;
    }

    // Initialize Chrome AI
    try {
      const availability = await window.chromeAI.initialize();
      
      // Check if any AI features are available
      const hasAnyFeature = Object.values(availability).some(
        (status) => status !== 'no' && status !== 'unknown'
      );

      if (!hasAnyFeature) {
        this.showUnavailableModal();
      } else {
        // Check if any features require download
        const requiresDownload = Object.values(availability).some(
          (status) => status === 'after-download'
        );

        if (requiresDownload) {
          this.showDownloadModal();
        } else {
          this.showWelcomeModal();
        }
      }

      // Mark onboarding as shown
      await this.markOnboardingShown();
    } catch (error) {
      onboardingLogger.error('Error initializing onboarding:', error);
      this.showUnavailableModal();
    }
  }

  /**
   * Check if onboarding has been shown before
   * @returns {Promise<boolean>} True if shown
   */
  async checkOnboardingStatus() {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      return result[this.storageKey] === true;
    } catch (error) {
      onboardingLogger.error('Error checking onboarding status:', error);
      return false;
    }
  }

  /**
   * Mark onboarding as shown
   */
  async markOnboardingShown() {
    try {
      await chrome.storage.local.set({ [this.storageKey]: true });
      this.hasShownOnboarding = true;
    } catch (error) {
      onboardingLogger.error('Error marking onboarding as shown:', error);
    }
  }

  /**
   * Show welcome modal (AI features available and ready)
   */
  showWelcomeModal() {
    const modal = this.createModal({
      title: '🎉 Chrome AI Features Enabled!',
      content: `
        <p class="linkedintel-onboarding-intro">
          LinkedIntel now uses Chrome's built-in AI for instant, on-device intelligence.
        </p>
        
        <div class="linkedintel-onboarding-features">
          <div class="linkedintel-onboarding-feature">
            <div class="linkedintel-onboarding-feature-icon">⚡</div>
            <div class="linkedintel-onboarding-feature-text">
              <strong>Quick Summaries</strong>
              <span>Instant 3-bullet summaries of any profile or company</span>
            </div>
          </div>
          
          <div class="linkedintel-onboarding-feature">
            <div class="linkedintel-onboarding-feature-icon">✍️</div>
            <div class="linkedintel-onboarding-feature-text">
              <strong>Message Composer</strong>
              <span>Generate personalized outreach in seconds</span>
            </div>
          </div>
          
          <div class="linkedintel-onboarding-feature">
            <div class="linkedintel-onboarding-feature-icon">🔄</div>
            <div class="linkedintel-onboarding-feature-text">
              <strong>Message Refinement</strong>
              <span>Rewrite your drafts with different tones</span>
            </div>
          </div>
          
          <div class="linkedintel-onboarding-feature">
            <div class="linkedintel-onboarding-feature-icon">✓</div>
            <div class="linkedintel-onboarding-feature-text">
              <strong>Grammar Check</strong>
              <span>Real-time proofreading as you type</span>
            </div>
          </div>
        </div>

        <div class="linkedintel-onboarding-privacy">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>All processing happens on your device. Your data never leaves your computer.</span>
        </div>
      `,
      buttons: [
        {
          text: 'Get Started',
          primary: true,
          onClick: () => this.closeModal(),
        },
      ],
    });

    this.showModal(modal);
    onboardingLogger.info('Welcome modal shown');
  }

  /**
   * Show download modal (model download required)
   */
  showDownloadModal() {
    const modal = this.createModal({
      title: '📥 One-Time Setup Required',
      content: `
        <p class="linkedintel-onboarding-intro">
          Chrome AI features require downloading Gemini Nano (~1.5GB). 
          This is a one-time download that enables all AI features.
        </p>
        
        <div class="linkedintel-onboarding-steps">
          <div class="linkedintel-onboarding-step">
            <div class="linkedintel-onboarding-step-number">1</div>
            <div class="linkedintel-onboarding-step-text">
              The model will download automatically when you use any AI feature
            </div>
          </div>
          
          <div class="linkedintel-onboarding-step">
            <div class="linkedintel-onboarding-step-number">2</div>
            <div class="linkedintel-onboarding-step-text">
              Download happens in the background, you can continue working
            </div>
          </div>
          
          <div class="linkedintel-onboarding-step">
            <div class="linkedintel-onboarding-step-number">3</div>
            <div class="linkedintel-onboarding-step-text">
              Once complete, all AI features will be instantly available
            </div>
          </div>
        </div>

        <div class="linkedintel-onboarding-info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span>The model is stored locally and works offline once downloaded</span>
        </div>
      `,
      buttons: [
        {
          text: 'Got It',
          primary: true,
          onClick: () => this.closeModal(),
        },
      ],
    });

    this.showModal(modal);
    onboardingLogger.info('Download modal shown');
  }

  /**
   * Show unavailable modal (AI features not available)
   */
  showUnavailableModal() {
    const modal = this.createModal({
      title: '⚠️ Chrome AI Not Available',
      content: `
        <p class="linkedintel-onboarding-intro">
          Chrome's built-in AI features are not currently available. 
          This could be due to your Chrome version or system configuration.
        </p>
        
        <div class="linkedintel-onboarding-requirements">
          <h4>Requirements:</h4>
          <ul>
            <li>Chrome 127 or later (Dev/Canary recommended)</li>
            <li>Enable <code>chrome://flags/#optimization-guide-on-device-model</code></li>
            <li>Enable <code>chrome://flags/#prompt-api-for-gemini-nano</code></li>
            <li>Restart Chrome after enabling flags</li>
          </ul>
        </div>

        <div class="linkedintel-onboarding-info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span>LinkedIntel will continue to work with cloud-based AI features</span>
        </div>

        <div class="linkedintel-onboarding-link">
          <a href="https://developer.chrome.com/docs/ai/built-in" target="_blank" rel="noopener">
            Learn more about Chrome Built-in AI →
          </a>
        </div>
      `,
      buttons: [
        {
          text: 'Continue Without Chrome AI',
          primary: true,
          onClick: () => this.closeModal(),
        },
      ],
    });

    this.showModal(modal);
    onboardingLogger.info('Unavailable modal shown');
  }

  /**
   * Create modal element
   * @param {Object} config - Modal configuration
   * @returns {HTMLElement} Modal element
   */
  createModal(config) {
    const modal = document.createElement('div');
    modal.className = 'linkedintel-ai-onboarding-modal';
    
    const buttonsHTML = config.buttons
      .map((btn) => {
        const classes = ['linkedintel-onboarding-btn'];
        if (btn.primary) classes.push('primary');
        return `<button class="${classes.join(' ')}" data-action="${btn.text}">
          ${btn.text}
        </button>`;
      })
      .join('');

    modal.innerHTML = `
      <div class="linkedintel-onboarding-overlay"></div>
      <div class="linkedintel-onboarding-content">
        <div class="linkedintel-onboarding-header">
          <h2>${config.title}</h2>
        </div>
        <div class="linkedintel-onboarding-body">
          ${config.content}
        </div>
        <div class="linkedintel-onboarding-footer">
          ${buttonsHTML}
        </div>
      </div>
    `;

    // Bind button events
    setTimeout(() => {
      config.buttons.forEach((btn) => {
        const btnEl = modal.querySelector(`[data-action="${btn.text}"]`);
        if (btnEl && btn.onClick) {
          btnEl.addEventListener('click', btn.onClick);
        }
      });

      // Close on overlay click
      const overlay = modal.querySelector('.linkedintel-onboarding-overlay');
      if (overlay) {
        overlay.addEventListener('click', () => this.closeModal());
      }
    }, 100);

    return modal;
  }

  /**
   * Show modal
   * @param {HTMLElement} modal - Modal element
   */
  showModal(modal) {
    if (this.currentModal) {
      this.closeModal();
    }

    document.body.appendChild(modal);
    this.currentModal = modal;

    // Animate in
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });
  }

  /**
   * Close current modal
   */
  closeModal() {
    if (!this.currentModal) return;

    this.currentModal.classList.remove('show');
    
    setTimeout(() => {
      if (this.currentModal && this.currentModal.parentElement) {
        this.currentModal.remove();
      }
      this.currentModal = null;
    }, 300);

    onboardingLogger.info('Modal closed');
  }

  /**
   * Reset onboarding (for testing)
   */
  async reset() {
    try {
      await chrome.storage.local.remove([this.storageKey]);
      this.hasShownOnboarding = false;
      onboardingLogger.info('Onboarding reset');
    } catch (error) {
      onboardingLogger.error('Error resetting onboarding:', error);
    }
  }

  /**
   * Show help for specific feature
   * @param {string} feature - Feature name
   */
  showFeatureHelp(feature) {
    const helpContent = {
      summarizer: {
        title: '⚡ Quick Summaries',
        content: `
          <p>Get instant 3-bullet summaries of any LinkedIn profile or company page.</p>
          <h4>How to use:</h4>
          <ul>
            <li>Click the "Quick Summary" badge near profile/company headers</li>
            <li>Or use the "AI Summary" button in the insights panel</li>
          </ul>
          <p><strong>Processing:</strong> 100% on-device, instant, private</p>
        `,
      },
      writer: {
        title: '✍️ Message Composer',
        content: `
          <p>Generate personalized outreach messages, emails, and LinkedIn InMails.</p>
          <h4>How to use:</h4>
          <ul>
            <li>Open the Chat tab in the LinkedIntel panel</li>
            <li>Click "AI Compose" and select message type</li>
            <li>Choose tone (Professional, Casual, etc.) and length</li>
            <li>Click "Generate" for instant results</li>
          </ul>
          <p><strong>Processing:</strong> On-device generation with context from page</p>
        `,
      },
      rewriter: {
        title: '🔄 Message Refinement',
        content: `
          <p>Rewrite and improve your draft messages with different tones and styles.</p>
          <h4>How to use:</h4>
          <ul>
            <li>Type your message in the chat input</li>
            <li>Click the "Refine" button</li>
            <li>Choose desired tone adjustment</li>
            <li>Compare before/after and apply changes</li>
          </ul>
          <p><strong>Processing:</strong> On-device refinement, maintains your key points</p>
        `,
      },
      proofreader: {
        title: '✓ Grammar Check',
        content: `
          <p>Real-time grammar and spelling checking as you type.</p>
          <h4>How to use:</h4>
          <ul>
            <li>Start typing in any LinkedIntel chat input</li>
            <li>Errors are underlined automatically</li>
            <li>Hover over errors to see suggestions</li>
            <li>Click to apply corrections</li>
          </ul>
          <p><strong>Processing:</strong> On-device checking, instant feedback</p>
        `,
      },
    };

    const config = helpContent[feature] || {
      title: 'Chrome AI Feature',
      content: '<p>Feature information not available</p>',
    };

    const modal = this.createModal({
      title: config.title,
      content: config.content,
      buttons: [
        {
          text: 'Got It',
          primary: true,
          onClick: () => this.closeModal(),
        },
      ],
    });

    this.showModal(modal);
    onboardingLogger.info(`Feature help shown for: ${feature}`);
  }
}

// Auto-initialize when page loads
if (typeof window !== 'undefined') {
  window.AIOnboarding = AIOnboarding;
  
  const aiOnboarding = new AIOnboarding();
  window.aiOnboarding = aiOnboarding;
  
  // Initialize after a delay to not interfere with page load
  setTimeout(() => {
    aiOnboarding.initialize();
  }, 3000);
}

