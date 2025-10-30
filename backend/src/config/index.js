/**
 * Configuration management for LinkedIntel Backend
 * Centralized configuration with environment validation
 */

require('dotenv').config()

// Validate required environment variables
const requiredEnvVars = ['PERPLEXITY_API_KEY']

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
)

if (missingEnvVars.length > 0) {
  console.error(
    '❌ Missing required environment variables:',
    missingEnvVars.join(', ')
  )
  process.exit(1)
}

const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 8080,
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
  },

  // API Configuration
  apis: {
    perplexity: {
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseUrl: 'https://api.perplexity.ai',
      model: 'sonar',
      timeout: 120000, // Increased to 120s for complex queries
      maxTokens: 4000,
    },
  },

  // Supabase Configuration (optional - for auth and database)
  supabase: {
    url: process.env.SUPABASE_URL,
    secretKey: process.env.SUPABASE_SECRET_KEY,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
  },

  // Cache Configuration (v2: Unified Cache System)
  // NOTE: TTL values are in MILLISECONDS
  // v2 Changes:
  // - Single unified TTL across all layers (L1 memory, L2 database)
  // - Removed dual cache system (usage_logs cache removed)
  // - analysis_cache is the single source of truth
  // These are overridden by environment-specific settings below
  cache: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours (unified across L1+L2, in milliseconds)
    maxSize: 1000, // Max number of cached entries (L1 memory)
    cleanupInterval: 60 * 60 * 1000, // Cleanup expired entries every hour (L1+L2)
  },

  // CORS Configuration
  cors: {
    allowedOrigins: [
      'chrome-extension://*',
      'http://localhost:*',
      'https://localhost:*',
      'file://*',
      '*linkedin.com*',
    ],
  },

  // Rate Limiting Configuration
  rateLimit: {
    // Authenticated users - tracked by user_id in database
    authenticated: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // Per window
    },
    // Anonymous users - IP-based rate limiting for API abuse prevention
    anonymous: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 20, // Stricter limit to prevent abuse
    },
    message: 'Too many requests, please try again later',
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },

  // Analysis Configuration
  analysis: {
    maxCompanyNameLength: 100,
    maxPersonNameLength: 80,
    timeoutMs: 120000, // Increased to 120s to match Perplexity timeout
    retryAttempts: 2, // Reduced retries to avoid long wait times
    retryDelay: 2000, // Increased delay between retries
  },
}

// Environment-specific overrides
// IMPORTANT: Cache TTL differs between environments for testing convenience
// v2: Unified TTL applies to ALL layers (L1 memory + L2 database + schema validation)
if (config.server.environment === 'production') {
  config.logging.level = 'warn'
  config.cache.ttl = 24 * 60 * 60 * 1000 // 24 hours in production (unified L1+L2, saves API costs)
} else if (config.server.environment === 'development') {
  config.cache.ttl = 24 * 60 * 1000 // 5 minutes in development (unified L1+L2, allows frequent testing)
  config.logging.level = 'debug'
}

module.exports = config
