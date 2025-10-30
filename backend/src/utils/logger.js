/**
 * Logger Utility for LinkedIntel Backend
 * Environment-aware logging with configurable log levels
 *
 * Usage:
 *   const { Logger } = require('../utils/logger')
 *   const logger = new Logger('ServiceName')
 *
 *   logger.debug('Detailed debug info')  // Only in development
 *   logger.info('General information')   // Development + staging
 *   logger.warn('Warning message')       // Always logged
 *   logger.error('Error occurred')       // Always logged
 *
 * Environment Configuration:
 *   LOG_LEVEL=debug   # Show all logs (development)
 *   LOG_LEVEL=info    # Show info, warn, error (staging)
 *   LOG_LEVEL=warn    # Show warn, error (production)
 *   LOG_LEVEL=error   # Show only errors (production)
 */

class Logger {
  constructor(namespace = '', level = process.env.LOG_LEVEL || 'info') {
    this.namespace = namespace
    this.level = level.toLowerCase()
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    }
  }

  /**
   * Get current log level priority
   */
  getCurrentLevelPriority() {
    return this.levels[this.level] !== undefined ? this.levels[this.level] : 1
  }

  /**
   * Debug logs - verbose development information
   * Only shown when LOG_LEVEL=debug
   */
  debug(...args) {
    if (this.getCurrentLevelPriority() <= this.levels.debug) {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] [${this.namespace}] DEBUG:`, ...args)
    }
  }

  /**
   * Info logs - general information
   * Shown when LOG_LEVEL=debug or LOG_LEVEL=info
   */
  info(...args) {
    if (this.getCurrentLevelPriority() <= this.levels.info) {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] [${this.namespace}] INFO:`, ...args)
    }
  }

  /**
   * Warning logs - important non-critical issues
   * Shown when LOG_LEVEL=debug, info, or warn
   */
  warn(...args) {
    if (this.getCurrentLevelPriority() <= this.levels.warn) {
      const timestamp = new Date().toISOString()
      console.warn(`[${timestamp}] [${this.namespace}] WARN:`, ...args)
    }
  }

  /**
   * Error logs - critical issues
   * Always shown regardless of LOG_LEVEL
   */
  error(...args) {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [${this.namespace}] ERROR:`, ...args)
  }

  /**
   * Create child logger with extended namespace
   * Useful for sub-modules or methods
   */
  child(childNamespace) {
    return new Logger(`${this.namespace}:${childNamespace}`, this.level)
  }
}

module.exports = { Logger }
