/**
 * Middleware Index - Centralized middleware exports
 */

const corsMiddleware = require('./cors')
const {
  validateCompanyAnalysis,
  validatePersonAnalysis,
  addRequestId,
} = require('./validation')
const { rateLimitAnonymous, getRateLimitStats } = require('./rateLimit')

module.exports = {
  cors: corsMiddleware,
  addRequestId,
  validateCompanyAnalysis,
  validatePersonAnalysis,
  rateLimitAnonymous,
  getRateLimitStats,
}
