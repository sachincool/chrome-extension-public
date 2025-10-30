/**
 * LinkedIntel Backend API - Main Application Entry Point
 * Hybrid AI Architecture for Chrome Built-in AI Challenge 2025
 * 
 * This backend provides deep intelligence that complements Chrome's Built-in AI:
 * - Tech stack analysis (200+ technologies)
 * - Funding & financial data
 * - Executive contact discovery
 * - Buying signals and timing insights
 */

// Optional: Sentry instrumentation (if SENTRY_DSN is set)
const Sentry = require('./instrument')

const LinkedIntelServer = require('./src/server')
const { Logger } = require('./src/utils/logger')

const logger = new Logger('App')

// Initialize and start the server
const server = new LinkedIntelServer()

try {
  server.initialize()
  server.start()

  logger.info('🚀 LinkedIntel Backend API started successfully')
  logger.info('📡 Hybrid AI intelligence layer ready')
  logger.info('🎯 Built for Google Chrome Built-in AI Challenge 2025')
} catch (error) {
  logger.error('❌ Failed to start LinkedIntel Backend API:', error)
  Sentry.captureException(error)
  process.exit(1)
}

