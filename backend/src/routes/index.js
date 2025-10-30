/**
 * Routes Index - API Route Configuration
 * Hackathon Demo Version - Core Intelligence Routes Only
 */

const express = require('express')
const router = express.Router()

const healthRoutes = require('./health')
const analysisRoutes = require('./analysis')
const factEnrichmentRoutes = require('./factEnrichment')

// Mount routes
router.use('/health', healthRoutes)
router.use('/analyze', analysisRoutes)
router.use('/enrich', factEnrichmentRoutes)

// API root endpoint
router.get('/', (req, res) => {
  res.json({
    service: 'LinkedIntel Backend API - Hackathon Demo',
    version: '1.0.0',
    challenge: 'Google Chrome Built-in AI Challenge 2025',
    category: 'Best Hybrid AI Application - Chrome Extension',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      healthDetailed: '/health/detailed',
      companyAnalysis: '/analyze/company',
      personAnalysis: '/analyze/person',
      cacheStats: '/analyze/cache/stats',
      enrichProfileSignals: '/enrich/profile-signals',
      enrichCompanySignals: '/enrich/company-signals',
      verifyFact: '/enrich/verify-fact',
    },
    documentation: 'https://github.com/linkedintel/chrome-extension-public-clean',
    architecture: 'Hybrid (Chrome Built-in AI + Backend Intelligence)',
  })
})

module.exports = router

