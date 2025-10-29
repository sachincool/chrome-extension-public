/**
 * Logger Utility for Chrome Extension
 * Environment-aware logging with configurable levels
 *
 * Usage:
 *   const logger = new window.Logger('ServiceWorker')
 *   logger.debug('Debug message')
 *   logger.info('Info message')
 *   logger.warn('Warning message')
 *   logger.error('Error message')
 *
 * Configuration:
 *   - Set log level in localStorage: localStorage.setItem('linkedintel_log_level', 'debug')
 *   - Levels: debug, info, warn, error (default: warn for production)
 */

// Immediately-invoked to ensure it runs in content script context
;(function () {
  'use strict'

  class Logger {
    constructor(namespace = '', level = null) {
      this.namespace = namespace
      this.level = level || this.getConfiguredLevel()
      this.levels = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
      }
    }

    /**
     * Get configured log level from localStorage or default to 'info'
     */
    getConfiguredLevel() {
      try {
        // Try to get from localStorage (for production control)
        const storedLevel = localStorage.getItem('linkedintel_log_level')
        if (storedLevel && this.levels[storedLevel] !== undefined) {
          return storedLevel
        }
      } catch (e) {
        // localStorage might not be available in service worker
      }

      // Default to 'info' to show most logs (hide only debug)
      // Users can override by setting: localStorage.setItem('linkedintel_log_level', 'debug|info|warn|error')
      return 'info'
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
      // Always show errors
      const timestamp = new Date().toISOString()
      console.error(`[${timestamp}] [${this.namespace}] ERROR:`, ...args)
    }

    /**
     * Create a child logger with extended namespace
     */
    child(childNamespace) {
      return new Logger(`${this.namespace}:${childNamespace}`, this.level)
    }
  }

  // For browsers/content scripts (make globally available)
  // CRITICAL: Must run immediately in global scope for content scripts
  if (typeof window !== 'undefined') {
    window.Logger = Logger

    /**
     * Helper function to create a logger with fallback for content scripts
     * Eliminates duplicate fallback code across all content scripts
     *
     * @param {string} namespace - Logger namespace (e.g., 'FAB', 'BadgeInjector')
     * @returns {Logger|Object} Logger instance or fallback object
     */
    window.createLogger = function (namespace) {
      if (typeof window.Logger !== 'undefined') {
        return new window.Logger(namespace)
      }
      // Fallback if Logger isn't loaded yet
      console.warn(`[${namespace}] Logger not available, using fallback`)
      return {
        debug: (...args) => console.debug(`[${namespace}] DEBUG:`, ...args),
        info: (...args) => console.info(`[${namespace}] INFO:`, ...args),
        warn: (...args) => console.warn(`[${namespace}] WARN:`, ...args),
        error: (...args) => console.error(`[${namespace}] ERROR:`, ...args),
        child: (ns) => window.createLogger(`${namespace}:${ns}`),
      }
    }

    console.log(
      '[Logger] Initialized - window.Logger and window.createLogger are now available'
    )
  }
})() // End IIFE
