/**
 * Rate Limiting Middleware
 * Implements IP-based rate limiting for anonymous users to prevent API abuse
 */

const config = require('../config')
const { Logger } = require('../utils/logger')
const logger = new Logger('RateLimit')

// In-memory store for rate limiting (per IP address)
// Structure: { 'ip_address': { count: number, resetAt: timestamp } }
const rateLimitStore = new Map()

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  let cleanedCount = 0

  for (const [ip, data] of rateLimitStore.entries()) {
    if (now >= data.resetAt) {
      rateLimitStore.delete(ip)
      cleanedCount++
    }
  }

  if (cleanedCount > 0) {
    logger.debug(`Rate limit cleanup: removed ${cleanedCount} expired entries`)
  }
}, 5 * 60 * 1000)

/**
 * Get client IP address from request
 * Handles proxies and load balancers
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    'unknown'
  )
}

/**
 * Rate limit middleware for anonymous users
 * Authenticated users are rate-limited by subscription plan, not IP
 */
function rateLimitAnonymous(req, res, next) {
  // Skip rate limiting for authenticated users (handled by subscription limits)
  if (req.user) {
    return next()
  }

  const ip = getClientIp(req)
  const now = Date.now()
  const { windowMs, maxRequests } = config.rateLimit.anonymous

  // Get or create rate limit entry for this IP
  let rateLimitData = rateLimitStore.get(ip)

  if (!rateLimitData || now >= rateLimitData.resetAt) {
    // First request or window expired - create new entry
    rateLimitData = {
      count: 1,
      resetAt: now + windowMs,
    }
    rateLimitStore.set(ip, rateLimitData)

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests)
    res.setHeader('X-RateLimit-Remaining', maxRequests - 1)
    res.setHeader(
      'X-RateLimit-Reset',
      new Date(rateLimitData.resetAt).toISOString()
    )

    return next()
  }

  // Increment request count
  rateLimitData.count++

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', maxRequests)
  res.setHeader(
    'X-RateLimit-Remaining',
    Math.max(0, maxRequests - rateLimitData.count)
  )
  res.setHeader(
    'X-RateLimit-Reset',
    new Date(rateLimitData.resetAt).toISOString()
  )

  // Check if limit exceeded
  if (rateLimitData.count > maxRequests) {
    const resetIn = Math.ceil((rateLimitData.resetAt - now) / 1000)
    logger.warn(
      `Rate limit exceeded for IP ${ip}: ${rateLimitData.count}/${maxRequests} requests`
    )

    return res.status(429).json({
      success: false,
      error: config.rateLimit.message,
      retryAfter: resetIn,
      requestId: req.requestId,
    })
  }

  next()
}

/**
 * Get current rate limit stats (for monitoring)
 */
function getRateLimitStats() {
  const stats = {
    totalIPs: rateLimitStore.size,
    activeRequests: 0,
    nearLimit: 0, // IPs close to their limit
  }

  const threshold = config.rateLimit.anonymous.maxRequests * 0.8 // 80% of limit

  for (const [ip, data] of rateLimitStore.entries()) {
    stats.activeRequests += data.count
    if (data.count >= threshold) {
      stats.nearLimit++
    }
  }

  return stats
}

module.exports = {
  rateLimitAnonymous,
  getRateLimitStats,
  getClientIp,
}
