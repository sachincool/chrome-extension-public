/**
 * Health Check Routes
 */

const express = require('express')
const router = express.Router()
const config = require('../config')
const { perplexityService, cacheService } = require('../services')

/**
 * Basic health check
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'LinkedIntel Backend API',
    version: '3.0.0',
    environment: config.server.environment,
    uptime: process.uptime(),
  })
})

/**
 * Detailed health check with service status
 */
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'LinkedIntel Backend API',
    version: '3.0.0',
    environment: config.server.environment,
    uptime: process.uptime(),
    services: {},
  }

  // Check cache service
  try {
    const cacheStats = cacheService.getStats()
    health.services.cache = {
      status: 'healthy',
      stats: cacheStats,
    }
  } catch (error) {
    health.services.cache = {
      status: 'unhealthy',
      error: error.message,
    }
    health.status = 'degraded'
  }

  // Check Perplexity API
  try {
    const apiCheck = await perplexityService.testConnection()
    health.services.perplexity = {
      status: apiCheck.success ? 'healthy' : 'unhealthy',
      response: apiCheck.success ? 'connected' : apiCheck.error,
    }

    if (!apiCheck.success) {
      health.status = 'degraded'
    }
  } catch (error) {
    health.services.perplexity = {
      status: 'unhealthy',
      error: error.message,
    }
    health.status = 'degraded'
  }

  // System metrics
  health.system = {
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  }

  res.json(health)
})

module.exports = router
