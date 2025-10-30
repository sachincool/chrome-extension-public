/**
 * Optional Error Tracking Instrumentation
 * For hackathon demo: Sentry is optional
 * Set SENTRY_DSN in .env to enable error tracking
 */

// Stub module for optional Sentry integration
let Sentry = {
  init: () => {},
  captureException: () => {},
  captureMessage: () => {}
}

// Only initialize Sentry if DSN is provided
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node')
    
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: `linkedintel-backend@${require('./package.json').version}`,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      autoSessionTracking: true,
    })
    
    console.log('✓ Sentry error tracking enabled')
  } catch (err) {
    console.warn('⚠ Sentry not available (optional dependency)')
  }
}

module.exports = Sentry

