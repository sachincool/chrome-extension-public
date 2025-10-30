/**
 * CORS Middleware for LinkedIntel Backend
 * Handles cross-origin requests from Chrome extension and LinkedIn
 */

const cors = require('cors')
const config = require('../config')
const { Logger } = require('../utils/logger')

const logger = new Logger('CORS')

const corsMiddleware = cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, chrome extensions, postman, etc.)
    if (!origin) {
      return callback(null, true)
    }

    // Check against allowed origins
    const isAllowed = config.cors.allowedOrigins.some((pattern) => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        return regex.test(origin)
      }
      return origin === pattern
    })

    if (isAllowed) {
      callback(null, true)
    } else {
      logger.warn(`❌ CORS blocked origin: ${origin}`)
      callback(new Error(`Origin ${origin} not allowed by CORS`))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
})

module.exports = corsMiddleware
