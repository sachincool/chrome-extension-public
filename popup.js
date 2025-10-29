// LinkedIntel Popup JavaScript - Credits Management & UI Logic

// Simple logger for popup (can't import modules in popup context)
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
}

const logger = new Logger('Popup')

class LinkedIntelPopup {
  constructor() {
    this.usageStatus = null
    this.init()
  }

  async init() {
    await this.loadUsageStatus()
    this.setupEventListeners()
    this.updateUI()
    this.updateAuthUI()
    this.animateElements()

    // Track popup opened
    this.trackEvent('popup_opened', {
      is_authenticated: this.usageStatus.isAuthenticated,
      analyses_remaining: this.usageStatus.analysesRemaining,
    })
  }

  // Load usage status from service worker
  async loadUsageStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_USAGE_STATUS',
      })
      if (response) {
        this.usageStatus = response
      } else {
        // Fallback
        this.usageStatus = {
          isAuthenticated: false,
          analysesRemaining: 3,
          analysesLimit: 3,
          planType: 'anonymous',
        }
      }
    } catch (error) {
      logger.error('Error loading usage status:', error)
      // Fallback
      this.usageStatus = {
        isAuthenticated: false,
        analysesRemaining: 3,
        analysesLimit: 3,
        planType: 'anonymous',
      }
    }
  }

  // Update the UI with current usage status
  updateUI() {
    if (!this.usageStatus) return

    const creditsNumber = document.getElementById('credits-number')
    const progressFill = document.getElementById('progress-fill')
    const creditsLabel = document.querySelector('.credits-label')

    const analysesRemaining = this.usageStatus.analysesRemaining
    const analysesLimit = this.usageStatus.analysesLimit
    const isAuthenticated = this.usageStatus.isAuthenticated

    // Update credits display
    if (creditsNumber) {
      creditsNumber.textContent = analysesRemaining

      // Add visual feedback based on analyses remaining
      if (analysesRemaining === 0) {
        creditsNumber.style.color = '#dc2626'
        this.showLowCreditsWarning()
      } else if (analysesRemaining <= 1) {
        creditsNumber.style.color = '#f59e0b'
      } else {
        creditsNumber.style.color = '#059669'
      }
    }

    // Update label text based on authentication
    if (creditsLabel) {
      creditsLabel.textContent = isAuthenticated
        ? 'unique entities left'
        : 'free trials remaining'
    }

    // Update progress bar
    if (progressFill) {
      const percentage = (analysesRemaining / analysesLimit) * 100
      progressFill.style.width = `${percentage}%`

      // Change progress bar color based on remaining
      if (percentage <= 33) {
        progressFill.style.background =
          'linear-gradient(90deg, #dc2626, #b91c1c)'
      } else if (percentage <= 66) {
        progressFill.style.background =
          'linear-gradient(90deg, #f59e0b, #d97706)'
      } else {
        progressFill.style.background =
          'linear-gradient(90deg, #10b981, #059669)'
      }
    }
  }

  // Show warning when analyses are depleted
  showLowCreditsWarning() {
    if (!this.usageStatus) return

    const creditsCard = document.querySelector('.credits-card')
    const analysesRemaining = this.usageStatus.analysesRemaining

    if (creditsCard && analysesRemaining === 0) {
      creditsCard.style.background =
        'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
      creditsCard.style.borderColor = '#dc2626'

      // Add pulsing effect
      creditsCard.style.animation = 'pulse 2s infinite'

      // Update credits label
      const creditsLabel = document.querySelector('.credits-label')
      if (creditsLabel) {
        const isAuthenticated = this.usageStatus.isAuthenticated
        creditsLabel.textContent = isAuthenticated
          ? 'unique entities - Upgrade!'
          : 'free trials - Sign in for more!'
        creditsLabel.style.color = '#dc2626'
        creditsLabel.style.fontWeight = '600'
      }
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Contact button click handling
    const contactButton = document.getElementById('contact-button')
    if (contactButton) {
      contactButton.addEventListener('click', (e) => {
        e.preventDefault()
        const emailUrl =
          "mailto:link@harshit.cloud?subject=LinkedIntel Credits Request&body=Hi! I'd like to get more credits for LinkedIntel."
        chrome.tabs.create({ url: emailUrl })
        this.trackEvent('contact_clicked', {
          analyses_remaining: this.usageStatus?.analysesRemaining || 0,
          plan_type: this.usageStatus?.planType || 'anonymous',
        })
      })
    }

    // Feedback link click handling
    const feedbackLink = document.querySelector('.feedback-text')
    if (feedbackLink) {
      feedbackLink.addEventListener('click', (e) => {
        e.preventDefault()
        const emailUrl =
          "mailto:link@harshit.cloud?subject=LinkedIntel Feedback&body=Hi! Here's my feedback on LinkedIntel:"
        chrome.tabs.create({ url: emailUrl })
        this.trackEvent('feedback_clicked', {
          analyses_remaining: this.usageStatus?.analysesRemaining || 0,
          plan_type: this.usageStatus?.planType || 'anonymous',
        })
      })
    }

    // Google Sign-In button
    const signInButton = document.getElementById('google-signin-button')
    if (signInButton) {
      signInButton.addEventListener('click', async (e) => {
        e.preventDefault()
        await this.handleGoogleSignIn()
      })
    }

    // Sign out button
    const signOutButton = document.getElementById('signout-button')
    if (signOutButton) {
      signOutButton.addEventListener('click', async (e) => {
        e.preventDefault()
        await this.handleSignOut()
      })
    }

    // Listen for usage updates from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'USAGE_UPDATED') {
        this.refreshUsageStatus()
        sendResponse({ success: true })
      } else if (message.type === 'GET_USAGE') {
        sendResponse({ usage: this.usageStatus })
      } else if (message.type === 'AUTH_STATE_CHANGED') {
        this.refreshUsageStatus()
        this.updateAuthUI()
        sendResponse({ success: true })
      }
    })
  }

  // Refresh usage status from service worker
  async refreshUsageStatus() {
    await this.loadUsageStatus()
    this.updateUI()

    // Show success animation
    this.showUsageUpdateAnimation()

    if (this.usageStatus) {
      this.trackEvent('usage_updated', {
        analyses_remaining: this.usageStatus.analysesRemaining,
        analyses_used: this.usageStatus.analysesUsed,
        plan_type: this.usageStatus.planType,
      })
    }
  }

  // Show animation when usage is updated
  showUsageUpdateAnimation() {
    const creditsNumber = document.getElementById('credits-number')
    if (creditsNumber) {
      creditsNumber.style.transform = 'scale(1.2)'
      creditsNumber.style.transition = 'transform 0.2s ease'

      setTimeout(() => {
        creditsNumber.style.transform = 'scale(1)'
      }, 200)
    }
  }

  // Animate elements on popup open
  animateElements() {
    const elements = document.querySelectorAll(
      '.credits-card, .summary-card, .contact-card'
    )
    elements.forEach((element, index) => {
      element.style.opacity = '0'
      element.style.transform = 'translateY(20px)'

      setTimeout(() => {
        element.style.transition = 'all 0.4s ease'
        element.style.opacity = '1'
        element.style.transform = 'translateY(0)'
      }, index * 100)
    })
  }

  // Track events for analytics with GA4
  trackEvent(eventName, properties = {}) {
    console.log(`LinkedIntel Event: ${eventName}`, properties)

    // Send to service worker for GA4 tracking
    chrome.runtime
      .sendMessage({
        type: 'TRACK_EVENT',
        data: {
          eventName: eventName,
          eventParams: {
            ...properties,
            source: 'popup',
            timestamp: new Date().toISOString(),
            version: chrome.runtime.getManifest().version,
          },
        },
      })
      .catch((error) => {
        console.warn('[LinkedIntel] Failed to track event:', error)
      })
  }

  // Get usage statistics
  async getUsageStats() {
    try {
      const result = await chrome.storage.local.get(['linkedintel_usage_stats'])
      return (
        result.linkedintel_usage_stats || {
          totalAnalyses: 0,
          lastUsed: null,
          firstInstall: new Date().toISOString(),
        }
      )
    } catch (error) {
      logger.error('Error getting usage stats:', error)
      return null
    }
  }

  // Update usage statistics
  async updateUsageStats() {
    if (!this.usageStatus) return

    try {
      const stats = await this.getUsageStats()
      stats.totalAnalyses = this.usageStatus.analysesUsed
      stats.lastUsed = new Date().toISOString()
      stats.planType = this.usageStatus.planType
      stats.isAuthenticated = this.usageStatus.isAuthenticated

      await chrome.storage.local.set({ linkedintel_usage_stats: stats })
    } catch (error) {
      logger.error('Error updating usage stats:', error)
    }
  }

  // Handle Google Sign-In
  async handleGoogleSignIn() {
    const signInButton = document.getElementById('google-signin-button')
    if (!signInButton) return

    try {
      // Disable button and show loading state
      signInButton.disabled = true
      signInButton.innerHTML = '<span class="signin-text">Signing in...</span>'

      // Request sign-in from service worker
      const response = await chrome.runtime.sendMessage({
        type: 'GOOGLE_SIGNIN',
      })

      if (response.success) {
        // Success! Update UI
        this.trackEvent('google_signin_success', {
          user_email: response.user?.email,
        })

        // Refresh usage status and UI
        await this.loadUsageStatus()
        this.updateUI()
        this.updateAuthUI()

        // Show success feedback
        this.showSignInSuccess()
      } else {
        throw new Error(response.error || 'Sign-in failed')
      }
    } catch (error) {
      logger.error('Sign-in error:', error)

      // Show error message
      this.showSignInError(error.message)

      // Re-enable button
      if (signInButton) {
        signInButton.disabled = false
        signInButton.innerHTML = `
          <svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span class="signin-text">Sign in with Google</span>
        `
      }

      this.trackEvent('google_signin_error', {
        error: error.message,
      })
    }
  }

  // Handle Sign Out
  async handleSignOut() {
    const signOutButton = document.getElementById('signout-button')
    if (!signOutButton) return

    try {
      // Disable button
      signOutButton.disabled = true
      signOutButton.textContent = 'Signing out...'

      // Request sign-out from service worker
      const response = await chrome.runtime.sendMessage({
        type: 'GOOGLE_SIGNOUT',
      })

      if (response.success) {
        this.trackEvent('google_signout_success')

        // Refresh usage status and UI
        await this.loadUsageStatus()
        this.updateUI()
        this.updateAuthUI()

        // Show feedback
        this.showSignOutSuccess()
      } else {
        throw new Error(response.error || 'Sign-out failed')
      }
    } catch (error) {
      logger.error('Sign-out error:', error)

      // Re-enable button
      if (signOutButton) {
        signOutButton.disabled = false
        signOutButton.textContent = 'Sign Out'
      }

      this.trackEvent('google_signout_error', {
        error: error.message,
      })
    }
  }

  // Update authentication UI based on auth state
  updateAuthUI() {
    const authSection = document.getElementById('auth-section')
    const userProfileSection = document.getElementById('user-profile-section')

    if (!authSection || !userProfileSection) return

    const isAuthenticated = this.usageStatus?.isAuthenticated || false

    if (isAuthenticated) {
      // Hide sign-in, show profile
      authSection.style.display = 'none'
      userProfileSection.style.display = 'block'

      // Update user profile info
      const userName = document.getElementById('user-name')
      const userEmail = document.getElementById('user-email')
      const userAvatar = document.getElementById('user-avatar')

      if (userName && this.usageStatus.userName) {
        userName.textContent = this.usageStatus.userName
      }

      if (userEmail && this.usageStatus.userEmail) {
        userEmail.textContent = this.usageStatus.userEmail
      }

      if (userAvatar && this.usageStatus.userAvatar) {
        userAvatar.src = this.usageStatus.userAvatar
      } else if (userAvatar) {
        // Default avatar based on email
        const email = this.usageStatus.userEmail || 'user@example.com'
        userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
          email
        )}&background=667eea&color=fff&size=96`
      }
    } else {
      // Show sign-in, hide profile
      authSection.style.display = 'block'
      userProfileSection.style.display = 'none'
    }
  }

  // Show sign-in success message
  showSignInSuccess() {
    const creditsCard = document.querySelector('.credits-card')
    if (creditsCard) {
      creditsCard.style.background =
        'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
      creditsCard.style.borderColor = '#10b981'

      setTimeout(() => {
        creditsCard.style.background =
          'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
        creditsCard.style.borderColor = '#e2e8f0'
      }, 2000)
    }
  }

  // Show sign-out success message
  showSignOutSuccess() {
    const creditsCard = document.querySelector('.credits-card')
    if (creditsCard) {
      creditsCard.style.background =
        'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
      creditsCard.style.borderColor = '#f59e0b'

      setTimeout(() => {
        creditsCard.style.background =
          'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
        creditsCard.style.borderColor = '#e2e8f0'
      }, 2000)
    }
  }

  // Show sign-in error message
  showSignInError(message) {
    const creditsCard = document.querySelector('.credits-card')
    if (creditsCard) {
      creditsCard.style.background =
        'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
      creditsCard.style.borderColor = '#dc2626'

      // Show error text temporarily
      const authSection = document.getElementById('auth-section')
      if (authSection) {
        const errorMsg = document.createElement('p')
        errorMsg.className = 'auth-error'
        errorMsg.textContent = message || 'Sign-in failed. Please try again.'
        errorMsg.style.cssText =
          'color: #dc2626; font-size: 12px; text-align: center; margin-top: 8px;'
        authSection.appendChild(errorMsg)

        setTimeout(() => {
          errorMsg.remove()
        }, 3000)
      }

      setTimeout(() => {
        creditsCard.style.background =
          'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
        creditsCard.style.borderColor = '#e2e8f0'
      }, 3000)
    }
  }
}

// Add CSS for pulse animation
const style = document.createElement('style')
style.textContent = `
  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.02);
    }
  }
`
document.head.appendChild(style)

// Initialize popup when DOM is loaded
let popupInstance = null

document.addEventListener('DOMContentLoaded', () => {
  popupInstance = new LinkedIntelPopup()
})

// Handle popup visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && popupInstance) {
    // Refresh data when popup becomes visible without creating new instance
    popupInstance.loadUsageStatus().then(() => {
      popupInstance.updateUI()
    })
  }
})
