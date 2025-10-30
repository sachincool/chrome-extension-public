/**
 * LinkedIntel Backend Server - Modular Architecture
 * Clean, maintainable Express server with proper separation of concerns
 */

const express = require('express')
const Sentry = require('../instrument')
const config = require('./config')
const middleware = require('./middleware')
const routes = require('./routes')
const { Logger } = require('./utils/logger')

const logger = new Logger('Server')

class LinkedIntelServer {
  constructor() {
    this.app = express()
    this.server = null
  }

  /**
   * Initialize server with all middleware and routes
   */
  initialize() {
    // Basic middleware
    this.app.use(express.json({ limit: '1mb' }))
    this.app.use(express.urlencoded({ extended: true }))

    // Custom middleware
    this.app.use(middleware.addRequestId)
    this.app.use(middleware.cors)

    // Request logging (only in development)
    if (config.server.environment === 'development') {
      this.app.use((req, res, next) => {
        const startTime = Date.now()
        const originalEnd = res.end

        res.end = function (...args) {
          const duration = Date.now() - startTime
          logger.info(
            `[${req.requestId}] ${req.method} ${req.originalUrl || req.url} - ${
              res.statusCode
            } (${duration}ms)`
          )
          originalEnd.apply(this, args)
        }

        next()
      })
    }

    // Mount routes
    this.app.use('/', routes)

    // 404 handler
    this.app.use(this.notFoundHandler)

    // Custom error handling middleware
    this.app.use(this.errorHandler)
  }

  /**
   * Start the server
   */
  start() {
    const { port, host } = config.server

    this.server = this.app.listen(port, host, () => {
      this.logStartupInfo()
    })

    // Graceful shutdown handling
    this.setupGracefulShutdown()

    return this.server
  }

  /**
   * Stop the server gracefully
   */
  async stop() {
    if (!this.server) return

    return new Promise((resolve) => {
      logger.info('🛑 Shutting down server...')

      this.server.close((err) => {
        if (err) {
          logger.error('❌ Error during server shutdown:', err)
        } else {
          logger.info('✅ Server shutdown complete')
        }
        resolve()
      })
    })
  }

  /**
   * Error handling middleware
   */
  errorHandler(err, req, res, next) {
    const requestId = req.requestId || 'unknown'

    logger.error(`[${requestId}] ❌ Server Error:`, err)

    // Capture exception in Sentry with additional context
    Sentry.captureException(err, {
      contexts: {
        request: {
          requestId,
          method: req.method,
          url: req.url,
        },
      },
    })

    // CORS error
    if (err.message.includes('CORS')) {
      return res.status(403).json({
        success: false,
        error: 'CORS policy violation',
        requestId,
      })
    }

    // Validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: err.message,
        requestId,
      })
    }

    // Rate limiting errors
    if (err.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: err.headers['retry-after'],
        requestId,
      })
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      requestId,
      ...(config.server.environment === 'development' && {
        details: err.message,
      }),
    })
  }

  /**
   * 404 handler
   */
  notFoundHandler(req, res) {
    logger.warn(
      `[${req.requestId}] 404 Not Found: ${req.method} ${
        req.originalUrl || req.url
      }`
    )
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      path: req.path,
      method: req.method,
      requestId: req.requestId,
      availableEndpoints: [
        '/',
        '/health',
        '/health/detailed',
        '/analyze/company',
        '/analyze/person',
        '/analyze/cache/stats',
        '/analyze/cache',
        '/auth/google/verify',
        '/auth/usage',
        '/auth/usage/increment',
        '/auth/user',
        '/history',
        '/history/:id',
        '/history/:id/refresh',
      ],
    })
  }

  /**
   * Log startup information
   */
  logStartupInfo() {
    const { port, host, environment } = config.server

    logger.info(`LinkedIntel Backend API v3.0.0 - ${environment}`)
    logger.info(`Server running on http://${host}:${port}`)
    logger.info(`Health check: /health`)
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      logger.info(`\n🛑 Received ${signal}, starting graceful shutdown...`)

      try {
        await this.stop()
        logger.info('👋 Goodbye!')
        process.exit(0)
      } catch (error) {
        logger.error('❌ Error during shutdown:', error)
        process.exit(1)
      }
    }

    // Handle various shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
    process.on('SIGHUP', () => gracefulShutdown('SIGHUP'))

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception:', error)
      Sentry.captureException(error)
      gracefulShutdown('uncaughtException')
    })

    process.on('unhandledRejection', (reason, promise) => {
      logger.error(
        '💥 Unhandled Promise Rejection at:',
        promise,
        'reason:',
        reason
      )
      Sentry.captureException(reason)
      gracefulShutdown('unhandledRejection')
    })
  }
}

module.exports = LinkedIntelServer
