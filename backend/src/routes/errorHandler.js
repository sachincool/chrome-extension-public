/**
 * Shared Error Handler for Analysis Routes
 * Handles common error scenarios with specific status codes and messages
 */

const Sentry = require('../../instrument')
const { Logger } = require('../utils/logger')
const logger = new Logger('AnalysisErrorHandler')

/**
 * Handle analysis errors with consistent error responses
 * @param {Error} error - The error object
 * @param {string} requestId - Request ID for tracking
 * @param {Object} res - Express response object
 * @param {string} analysisType - Type of analysis (e.g., 'Company', 'Person')
 */
function handleAnalysisError(error, requestId, res, analysisType = 'Analysis') {
  logger.error(`[${requestId}] ❌ ${analysisType} error:`, error)

  // Capture error in Sentry with context
  Sentry.captureException(error, {
    tags: {
      analysisType,
      errorSource: 'analysis_route',
    },
    contexts: {
      request: {
        requestId,
      },
    },
  })

  // Enhanced error handling with specific status codes
  let statusCode = 500
  let errorMessage = `${analysisType} failed. Please try again.`
  let errorType = 'internal_error'

  // Timeout errors
  if (
    error.message.includes('timeout') ||
    error.message.includes('timed out')
  ) {
    statusCode = 408
    errorMessage = `${analysisType} request timed out. The service may be experiencing high load.`
    errorType = 'timeout_error'
  }
  // Rate limit errors
  else if (error.message.includes('API error: 429')) {
    statusCode = 429
    errorMessage =
      'Rate limit exceeded. Please wait before making another request.'
    errorType = 'rate_limit_error'
  }
  // Authentication errors
  else if (
    error.message.includes('API error: 401') ||
    error.message.includes('unauthorized')
  ) {
    statusCode = 502
    errorMessage = 'AI service authentication failed. Please contact support.'
    errorType = 'auth_error'
  }
  // JSON parsing errors
  else if (error.message.includes('Invalid JSON')) {
    statusCode = 502
    errorMessage = 'AI service returned invalid data. Please try again.'
    errorType = 'parse_error'
  }
  // Network errors
  else if (
    error.message.includes('network') ||
    error.message.includes('fetch')
  ) {
    statusCode = 503
    errorMessage =
      'AI service is temporarily unavailable. Please try again later.'
    errorType = 'service_unavailable'
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    errorType,
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    requestId,
    timestamp: new Date().toISOString(),
    retryRecommendation:
      statusCode >= 500
        ? 'retry_with_delay'
        : statusCode === 429
        ? 'retry_after_delay'
        : 'contact_support',
  })
}

module.exports = { handleAnalysisError }
