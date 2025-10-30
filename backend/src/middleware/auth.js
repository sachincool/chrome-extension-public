/**
 * Authentication Middleware
 */

const supabaseService = require('../services/supabaseService')
const { Logger } = require('../utils/logger')

const logger = new Logger('AuthMiddleware')

/**
 * Verify JWT token from request headers
 * Attaches user to req.user if authenticated
 */
async function verifyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
        requestId: req.requestId,
      })
    }

    const token = authHeader.split('Bearer ')[1]

    if (!supabaseService.isConfigured()) {
      logger.warn('Supabase not configured, skipping auth')
      return res.status(503).json({
        success: false,
        error: 'Authentication service not available',
        requestId: req.requestId,
      })
    }

    // Verify token with Supabase
    const user = await supabaseService.verifyToken(token)

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        requestId: req.requestId,
      })
    }

    // Attach user to request
    req.user = user
    logger.debug(`User authenticated: ${user.id}`)

    next()
  } catch (error) {
    logger.error('Authentication failed:', error.message)
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      requestId: req.requestId,
    })
  }
}

/**
 * Optional auth middleware - doesn't fail if not authenticated
 * Attaches user to req.user if token is present and valid
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth header, continue without user
      return next()
    }

    const token = authHeader.split('Bearer ')[1]

    if (!supabaseService.isConfigured()) {
      logger.warn('Supabase not configured, skipping auth')
      return next()
    }

    // Try to verify token
    const user = await supabaseService.verifyToken(token)

    if (user) {
      req.user = user
      logger.debug(`User authenticated: ${user.id}`)
    }

    next()
  } catch (error) {
    // Auth failed, but continue without user
    logger.debug('Optional auth failed, continuing without user', {
      error: error.message,
      hasAuthHeader: !!req.headers.authorization,
      tokenLength: req.headers.authorization
        ? req.headers.authorization.split('Bearer ')[1]?.length
        : 0,
    })
    next()
  }
}

module.exports = {
  verifyAuth,
  optionalAuth,
}
