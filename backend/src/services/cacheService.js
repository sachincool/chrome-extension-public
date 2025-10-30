/**
 * Cache Service for LinkedIntel Backend
 * Two-tier caching: Memory (L1) + Database (L2)
 *
 * L1 Cache: In-memory Map for fast access (lost on restart)
 * L2 Cache: Supabase database for persistence across restarts
 *
 * Cache flow:
 * - get(): Check L1 → if miss, check L2 → if hit, warm L1
 * - set(): Write to L1 AND L2 simultaneously
 * - Graceful fallback: If DB unavailable, use memory-only
 */

const config = require('../config')
const { Logger } = require('../utils/logger')
const supabaseService = require('./supabaseService')
const {
  CompanyAnalysisSchema,
  PersonAnalysisSchema,
  SCHEMA_VERSION,
} = require('../schemas/analysisSchemas')

const logger = new Logger('CacheService')

// Cache version - aligned with SCHEMA_VERSION for consistency
// Incremented when cache format/schema changes to auto-invalidate old entries
const CACHE_VERSION = SCHEMA_VERSION // v2: Cache consolidation - single source of truth

class CacheService {
  constructor() {
    this.cache = new Map() // L1: In-memory cache
    this.pendingRequests = new Map() // Request deduplication to prevent race conditions
    this.ttl = config.cache.ttl
    this.maxSize = config.cache.maxSize
    this.cacheVersion = CACHE_VERSION

    // Start cleanup interval
    this.startCleanupInterval()
  }

  /**
   * Get value from cache (two-tier: memory L1 → database L2)
   */
  async get(key) {
    // L1: Check in-memory cache first
    const memoryEntry = this.cache.get(key)

    if (memoryEntry) {
      // Check version first - invalidate if outdated
      if (memoryEntry.version !== this.cacheVersion) {
        logger.debug(
          `Cache entry version mismatch (${memoryEntry.version} vs ${this.cacheVersion}), invalidating: ${key}`
        )
        this.cache.delete(key)
      } else if (Date.now() > memoryEntry.expiresAt) {
        // Check if entry has expired
        this.cache.delete(key)
      } else {
        // L1 HIT - refresh TTL on access (sliding expiration)
        memoryEntry.accessedAt = Date.now()
        memoryEntry.expiresAt = Date.now() + this.ttl // Extend TTL
        logger.debug(`Cache HIT (L1 memory) for key: ${key}, TTL refreshed`)
        return memoryEntry.value
      }
    }

    // L1 MISS: Try L2 (database)
    try {
      const dbEntry = await supabaseService.getCachedAnalysis(key)

      if (dbEntry) {
        // Check if database entry has correct schema version (unified version system)
        const dbSchemaVersion = dbEntry?.metadata?.schemaVersion || 1 // Default to v1 if no version

        if (dbSchemaVersion !== this.cacheVersion) {
          logger.debug(
            `Database cache entry schema version mismatch (${dbSchemaVersion} vs ${this.cacheVersion}), invalidating: ${key}`
          )
          // Don't return old data, let it re-analyze
          return null
        }

        // L2 HIT: Warm L1 cache
        logger.debug(`Cache HIT (L2 database) for key: ${key}, warming L1`)
        logger.debug(
          `Retrieved from L2 with schemaVersion: ${dbEntry.metadata?.schemaVersion} (unified version system)`
        )
        this.setMemory(key, dbEntry, this.ttl)
        return dbEntry
      }
    } catch (error) {
      logger.warn(`Database cache lookup failed for key ${key}:`, error.message)
      // Fall through to return null
    }

    // L1 MISS + L2 MISS
    logger.debug(`Cache MISS (L1 + L2) for key: ${key}`)
    return null
  }

  /**
   * Get value from cache (synchronous, memory-only version for backward compatibility)
   */
  getSync(key) {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check version first
    if (entry.version !== this.cacheVersion) {
      logger.debug(
        `Cache entry version mismatch (${entry.version} vs ${this.cacheVersion}), invalidating: ${key}`
      )
      this.cache.delete(key)
      return null
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    // Update access time for LRU-like behavior
    entry.accessedAt = Date.now()
    return entry.value
  }

  /**
   * Set value in cache (writes to both L1 memory and L2 database)
   *
   * Note: Component caches (Sumble tech, contacts, etc.) are L1-only
   * Full company/person analyses go to both L1 and L2
   */
  async set(key, value, customTtl = null) {
    const ttl = customTtl || this.ttl

    // Write to L1 (memory) with version
    this.setMemory(key, value, ttl)

    // Determine if this should be written to L2 (database)
    const analysisType = this.extractAnalysisType(key)
    const isComponentCache = analysisType === 'unknown' // Component caches like sumble:tech:*

    if (isComponentCache) {
      // Component caches stay in L1 (memory) only
      // Examples: sumble:tech:*, sumble:contacts:*, perplexity:*
      logger.debug(
        `Cache SET (L1 only - component) for key: ${key} [v${this.cacheVersion}]`
      )
      return
    }

    // Write full analyses to L2 (database) asynchronously with version metadata
    try {
      // Convert milliseconds to hours for database storage
      // config.cache.ttl is in ms: 5 min (dev) = 300000ms = 0.083h, 24h (prod) = 86400000ms = 24h
      const ttlHours = ttl / (1000 * 60 * 60)

      // Ensure metadata has schemaVersion (unified with CACHE_VERSION)
      const valueWithMetadata = {
        ...value,
        metadata: {
          ...value.metadata,
          schemaVersion: this.cacheVersion, // Ensure schemaVersion is set
        },
      }

      // Debug: Log schemaVersion being saved
      logger.debug(
        `Saving to L2 with schemaVersion: ${valueWithMetadata.metadata?.schemaVersion} (unified version system)`
      )

      await supabaseService.setCachedAnalysis(
        key,
        analysisType,
        valueWithMetadata,
        ttlHours
      )
      logger.debug(
        `Cache SET (L1 + L2) for key: ${key} [v${this.cacheVersion}]`
      )
    } catch (error) {
      logger.warn(
        `Failed to write cache to database for key ${key}:`,
        error.message
      )
      logger.debug(`Cache SET (L1 only, DB failed) for key: ${key}`)
      // Not critical - cache still works in memory
    }
  }

  /**
   * Set value in memory cache only (L1)
   * Used internally and for warming cache from L2
   */
  setMemory(key, value, ttl = null) {
    const cacheTtl = ttl || this.ttl

    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }

    this.cache.set(key, {
      value,
      version: this.cacheVersion,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      expiresAt: Date.now() + cacheTtl,
    })
  }

  /**
   * Extract analysis type from cache key
   * Keys format: "company:name" or "person:name:company"
   */
  extractAnalysisType(key) {
    if (key.startsWith('company:')) {
      return 'company'
    } else if (key.startsWith('person:')) {
      return 'person'
    }
    return 'unknown'
  }

  /**
   * Check if key exists in cache (checks both L1 and L2)
   */
  async has(key) {
    const value = await this.get(key)
    return value !== null
  }

  /**
   * Check if key exists in memory cache only (L1, synchronous)
   */
  hasSync(key) {
    return this.getSync(key) !== null
  }

  /**
   * Delete key from cache (L1 memory only, synchronous)
   */
  delete(key) {
    return this.cache.delete(key)
  }

  /**
   * Delete key from both L1 (memory) and L2 (database) cache
   * Use this when you need to completely invalidate a cache entry
   */
  async deleteFromBothLayers(key) {
    // Delete from L1 (memory)
    const deletedFromL1 = this.cache.delete(key)
    logger.debug(
      `Cache DELETE (L1): ${key} - ${
        deletedFromL1 ? 'found and deleted' : 'not found'
      }`
    )

    // Delete from L2 (database)
    let deletedFromL2 = false
    if (this.l2Enabled) {
      const supabaseService = require('./supabaseService')
      deletedFromL2 = await supabaseService.deleteCachedAnalysis(key)
      logger.debug(
        `Cache DELETE (L2): ${key} - ${
          deletedFromL2 ? 'deleted' : 'not found or failed'
        }`
      )
    }

    return {
      l1: deletedFromL1,
      l2: deletedFromL2,
      success: deletedFromL1 || deletedFromL2,
    }
  }

  /**
   * Delete key from ALL sources: L1 memory, L2 database, and usage_logs references
   * This is the atomic invalidation method for complete cache cleanup
   *
   * Use this when cache is corrupted or schema has changed to ensure no stale references remain
   */
  async deleteFromAllSources(key) {
    logger.info(`🗑️  Atomic cache invalidation starting for key: ${key}`)

    // Delete from L1 (memory)
    const deletedFromL1 = this.cache.delete(key)
    logger.debug(
      `Cache DELETE (L1): ${key} - ${
        deletedFromL1 ? 'found and deleted' : 'not found'
      }`
    )

    // Delete from L2 (database analysis_cache)
    let deletedFromL2 = false
    let clearedReferences = 0

    try {
      const supabaseService = require('./supabaseService')

      if (supabaseService.isConfigured()) {
        // Delete from analysis_cache table
        deletedFromL2 = await supabaseService.deleteCachedAnalysis(key)
        logger.debug(
          `Cache DELETE (L2): ${key} - ${
            deletedFromL2 ? 'deleted' : 'not found or failed'
          }`
        )

        // Clear cache_key references in usage_logs (set to NULL)
        // This preserves usage history but removes broken cache link
        const { error: updateError } = await supabaseService.client
          .from('usage_logs')
          .update({ cache_key: null })
          .eq('cache_key', key)

        if (!updateError) {
          logger.debug(`Cache references cleared in usage_logs for key: ${key}`)
          clearedReferences++
        }
      }
    } catch (error) {
      logger.warn(
        `Failed to delete from database layers for key ${key}:`,
        error.message
      )
    }

    const success = deletedFromL1 || deletedFromL2 || clearedReferences > 0

    logger.info(
      `🗑️  Atomic invalidation complete for ${key}: L1=${deletedFromL1}, L2=${deletedFromL2}, References=${clearedReferences}`
    )

    return {
      l1: deletedFromL1,
      l2: deletedFromL2,
      usageLogsReferences: clearedReferences,
      success,
    }
  }

  /**
   * Clear all cache entries (L1 memory only)
   */
  clear() {
    this.cache.clear()
  }

  /**
   * Get cache statistics (both L1 and L2)
   */
  async getStats() {
    const now = Date.now()
    let expired = 0
    let valid = 0

    // L1 stats (memory)
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        expired++
      } else {
        valid++
      }
    }

    const memoryStats = {
      totalEntries: this.cache.size,
      validEntries: valid,
      expiredEntries: expired,
      maxSize: this.maxSize,
      ttlMs: this.ttl,
      memoryUsage: this.estimateMemoryUsage(),
    }

    // L2 stats (database)
    let databaseStats = null
    try {
      databaseStats = await supabaseService.getCacheStats()
    } catch (error) {
      logger.debug('Could not get database cache stats:', error.message)
    }

    return {
      l1_memory: memoryStats,
      l2_database: databaseStats,
      total: {
        l1_entries: memoryStats.totalEntries,
        l2_entries: databaseStats?.total_entries || 0,
      },
    }
  }

  /**
   * Get all cache keys
   */
  getKeys() {
    return Array.from(this.cache.keys())
  }

  /**
   * Validate cached company analysis against comprehensive Zod schema
   * Returns { valid: boolean, errors: string[], schemaVersion: number }
   *
   * @param {*} data - Cached data to validate
   * @returns {Object} Validation result with detailed errors
   */
  validateCompanyCache(data) {
    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        errors: ['Data is not an object'],
        schemaVersion: null,
      }
    }

    // Debug: Log the entire metadata object
    logger.debug(
      `Validating company cache - metadata: ${JSON.stringify(data.metadata)}`
    )
    logger.debug(`Has metadata: ${!!data.metadata}`)
    logger.debug(`metadata.schemaVersion: ${data.metadata?.schemaVersion}`)

    // Check schema version first (unified version system - CACHE_VERSION === SCHEMA_VERSION)
    const dataSchemaVersion = data.metadata?.schemaVersion
    const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION

    if (
      dataSchemaVersion !== undefined &&
      dataSchemaVersion !== CURRENT_SCHEMA_VERSION
    ) {
      logger.debug(
        `Cache schema version mismatch: ${dataSchemaVersion} vs ${CURRENT_SCHEMA_VERSION}`
      )
      return {
        valid: false,
        errors: [
          `Schema version outdated: ${dataSchemaVersion} (current: ${CURRENT_SCHEMA_VERSION})`,
        ],
        schemaVersion: dataSchemaVersion,
      }
    }

    // If no schema version in data, it's old cache (v1) - invalidate it
    if (dataSchemaVersion === undefined) {
      logger.debug(
        'Cache entry has no schema version - invalidating old cache (pre-v2)'
      )
      return {
        valid: false,
        errors: ['Missing schema version (old cache format from v1)'],
        schemaVersion: null,
      }
    }

    // Validate structure with Zod
    try {
      CompanyAnalysisSchema.parse(data)
      return {
        valid: true,
        errors: [],
        schemaVersion: CURRENT_SCHEMA_VERSION,
      }
    } catch (error) {
      // Zod provides detailed validation errors in error.errors array
      let errors = ['Validation failed']

      if (error.errors && Array.isArray(error.errors)) {
        errors = error.errors.map((e) => {
          const path = e.path && e.path.length > 0 ? e.path.join('.') : 'root'
          return `${path}: ${e.message}`
        })
      } else if (error.message) {
        errors = [error.message]
      }

      logger.debug('Company cache validation failed:', errors)
      return {
        valid: false,
        errors,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      }
    }
  }

  /**
   * Validate cached person analysis against comprehensive Zod schema
   * Returns { valid: boolean, errors: string[], schemaVersion: number }
   *
   * @param {*} data - Cached data to validate
   * @returns {Object} Validation result with detailed errors
   */
  validatePersonCache(data) {
    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        errors: ['Data is not an object'],
        schemaVersion: null,
      }
    }

    // Debug: Log the entire metadata object
    logger.debug(
      `Validating person cache - metadata: ${JSON.stringify(data.metadata)}`
    )
    logger.debug(`Has metadata: ${!!data.metadata}`)
    logger.debug(`metadata.schemaVersion: ${data.metadata?.schemaVersion}`)

    // Check schema version first (unified version system - CACHE_VERSION === SCHEMA_VERSION)
    const dataSchemaVersion = data.metadata?.schemaVersion
    const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION

    if (
      dataSchemaVersion !== undefined &&
      dataSchemaVersion !== CURRENT_SCHEMA_VERSION
    ) {
      logger.debug(
        `Cache schema version mismatch: ${dataSchemaVersion} vs ${CURRENT_SCHEMA_VERSION}`
      )
      return {
        valid: false,
        errors: [
          `Schema version outdated: ${dataSchemaVersion} (current: ${CURRENT_SCHEMA_VERSION})`,
        ],
        schemaVersion: dataSchemaVersion,
      }
    }

    // If no schema version in data, it's old cache (v1) - invalidate it
    if (dataSchemaVersion === undefined) {
      logger.debug(
        'Cache entry has no schema version - invalidating old cache (pre-v2)'
      )
      return {
        valid: false,
        errors: ['Missing schema version (old cache format from v1)'],
        schemaVersion: null,
      }
    }

    // Validate structure with Zod
    try {
      PersonAnalysisSchema.parse(data)
      return {
        valid: true,
        errors: [],
        schemaVersion: CURRENT_SCHEMA_VERSION,
      }
    } catch (error) {
      // Zod provides detailed validation errors in error.errors array
      let errors = ['Validation failed']

      if (error.errors && Array.isArray(error.errors)) {
        errors = error.errors.map((e) => {
          const path = e.path && e.path.length > 0 ? e.path.join('.') : 'root'
          return `${path}: ${e.message}`
        })
      } else if (error.message) {
        errors = [error.message]
      }

      logger.debug('Person cache validation failed:', errors)
      return {
        valid: false,
        errors,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      }
    }
  }

  /**
   * Normalize company name for consistent cache keys
   * Prevents cache misses due to minor formatting differences
   *
   * Examples:
   * - "Acme Corp" → "acme-corp"
   * - "ACME  CORPORATION" → "acme-corporation"
   * - "Acme, Inc." → "acme-inc"
   */
  normalizeCompanyName(name) {
    if (!name || typeof name !== 'string') {
      return ''
    }

    return name
      .toLowerCase()
      .trim()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Remove punctuation
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
  }

  /**
   * Normalize person name for consistent cache keys
   * Similar to company normalization but preserves name structure
   */
  normalizePersonName(name) {
    if (!name || typeof name !== 'string') {
      return ''
    }

    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
  }

  /**
   * Generate cache key for company analysis
   * Uses normalized company name for consistency
   */
  generateCompanyKey(companyName) {
    const normalized = this.normalizeCompanyName(companyName)
    return `company:${normalized}`
  }

  /**
   * Generate cache key for person analysis
   * Uses normalized names for consistency
   */
  generatePersonKey(name, company = '') {
    const normalizedName = this.normalizePersonName(name)
    const key = `person:${normalizedName}`

    if (company) {
      const normalizedCompany = this.normalizeCompanyName(company)
      return `${key}:${normalizedCompany}`
    }

    return key
  }

  /**
   * Evict oldest entry (LRU-like behavior)
   */
  evictOldest() {
    let oldestKey = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      logger.info(`Cache evicted oldest entry: ${oldestKey}`)
    }
  }

  /**
   * Clean up expired entries (both memory L1 and database L2)
   */
  async cleanup() {
    // Clean up L1 (memory)
    const now = Date.now()
    let removedCount = 0

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        removedCount++
      }
    }

    if (removedCount > 0) {
      logger.info(`Cache cleanup (L1): removed ${removedCount} expired entries`)
    }

    // Clean up L2 (database) - run asynchronously
    try {
      const dbRemovedCount = await supabaseService.cleanupExpiredCache()
      if (dbRemovedCount > 0) {
        logger.info(
          `Cache cleanup (L2): removed ${dbRemovedCount} expired entries from database`
        )
      }
    } catch (error) {
      logger.warn('Failed to cleanup database cache:', error.message)
    }

    return removedCount
  }

  /**
   * Start automatic cleanup interval for both L1 (memory) and L2 (database)
   * Runs every hour (config.cache.cleanupInterval)
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanup()
    }, config.cache.cleanupInterval)

    logger.info(
      `Cache cleanup interval started (runs every ${
        config.cache.cleanupInterval / 60000
      } minutes for L1+L2)`
    )
  }

  /**
   * Estimate memory usage (rough calculation)
   */
  estimateMemoryUsage() {
    let totalSize = 0

    for (const [key, entry] of this.cache) {
      // Rough estimate: key + value + metadata
      totalSize += key.length * 2 // Assuming UTF-16
      totalSize += JSON.stringify(entry.value).length * 2
      totalSize += 64 // Metadata overhead
    }

    return {
      bytes: totalSize,
      kb: Math.round(totalSize / 1024),
      mb: Math.round(totalSize / (1024 * 1024)),
    }
  }

  /**
   * Request deduplication: Wait for or register a pending request
   * Prevents race condition where multiple concurrent requests for the same key
   * all make expensive API calls instead of waiting for the first one
   *
   * Usage:
   *   const pending = await cacheService.waitForPendingRequest(key)
   *   if (pending) return pending // Another request is fetching this
   *
   *   const promise = fetchData() // Your expensive operation
   *   cacheService.registerPendingRequest(key, promise)
   *   const result = await promise
   *   cacheService.clearPendingRequest(key)
   *   return result
   */
  async waitForPendingRequest(key) {
    const pending = this.pendingRequests.get(key)
    if (!pending) {
      return null // No pending request
    }

    logger.debug(`Waiting for pending request to complete: ${key}`)

    try {
      // Wait for the pending promise to complete
      const result = await pending.promise
      logger.debug(`Pending request completed: ${key}`)
      return result
    } catch (error) {
      logger.warn(`Pending request failed for ${key}:`, error.message)
      // Return null so caller can retry
      return null
    }
  }

  /**
   * Register a pending request to prevent duplicate API calls
   */
  registerPendingRequest(key, promise) {
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    })

    logger.debug(`Registered pending request: ${key}`)

    // Auto-cleanup after 2 minutes (safety net for stuck requests)
    setTimeout(() => {
      if (this.pendingRequests.has(key)) {
        logger.warn(`Force-clearing stuck pending request: ${key}`)
        this.pendingRequests.delete(key)
      }
    }, 2 * 60 * 1000)
  }

  /**
   * Clear a completed pending request
   */
  clearPendingRequest(key) {
    const existed = this.pendingRequests.delete(key)
    if (existed) {
      logger.debug(`Cleared pending request: ${key}`)
    }
  }

  /**
   * Get pending requests statistics
   */
  getPendingRequestsStats() {
    return {
      count: this.pendingRequests.size,
      keys: Array.from(this.pendingRequests.keys()),
    }
  }
}

module.exports = new CacheService()
