/**
 * Supabase Service - Optional Database Integration
 * For hackathon demo: Supabase is optional (fallback to memory-only caching)
 * 
 * Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env to enable database caching
 */

const { createClient } = require('@supabase/supabase-js')
const { Logger } = require('../utils/logger')

const logger = new Logger('SupabaseService')

class SupabaseService {
  constructor() {
    this.client = null
    this.configured = false

    // Only initialize if credentials are provided
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
      try {
        this.client = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SECRET_KEY
        )
        this.configured = true
        logger.info('✓ Supabase database connection configured')
      } catch (error) {
        logger.warn('⚠ Supabase initialization failed (optional):', error.message)
      }
    } else {
      logger.info('ℹ Supabase not configured - using memory-only caching')
    }
  }

  /**
   * Check if Supabase is configured
   */
  isConfigured() {
    return this.configured
  }

  /**
   * Get cached analysis from database
   */
  async getCachedAnalysis(key) {
    if (!this.isConfigured()) return null

    try {
      const { data, error } = await this.client
        .from('analysis_cache')
        .select('*')
        .eq('cache_key', key)
        .single()

      if (error) {
        if (error.code !== 'PGRST116') {
          // PGRST116 = not found (expected)
          logger.warn('Database cache read error:', error.message)
        }
        return null
      }

      return data
    } catch (error) {
      logger.warn('Failed to read from database cache:', error.message)
      return null
    }
  }

  /**
   * Set cached analysis in database
   */
  async setCachedAnalysis(key, value, entityType, metadata = {}) {
    if (!this.isConfigured()) return false

    try {
      const { error } = await this.client.from('analysis_cache').upsert(
        {
          cache_key: key,
          entity_type: entityType,
          analysis_result: value,
          metadata: metadata,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        },
        {
          onConflict: 'cache_key',
        }
      )

      if (error) {
        logger.warn('Database cache write error:', error.message)
        return false
      }

      return true
    } catch (error) {
      logger.warn('Failed to write to database cache:', error.message)
      return false
    }
  }

  /**
   * Delete cached analysis from database
   */
  async deleteCachedAnalysis(key) {
    if (!this.isConfigured()) return false

    try {
      const { error } = await this.client
        .from('analysis_cache')
        .delete()
        .eq('cache_key', key)

      if (error) {
        logger.warn('Database cache delete error:', error.message)
        return false
      }

      return true
    } catch (error) {
      logger.warn('Failed to delete from database cache:', error.message)
      return false
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    if (!this.isConfigured()) {
      return {
        total_entries: 0,
        company_entries: 0,
        person_entries: 0,
        total_size_bytes: 0,
      }
    }

    try {
      const { count: totalCount } = await this.client
        .from('analysis_cache')
        .select('*', { count: 'exact', head: true })

      const { count: companyCount } = await this.client
        .from('analysis_cache')
        .select('*', { count: 'exact', head: true })
        .eq('entity_type', 'company')

      const { count: personCount } = await this.client
        .from('analysis_cache')
        .select('*', { count: 'exact', head: true })
        .eq('entity_type', 'person')

      return {
        total_entries: totalCount || 0,
        company_entries: companyCount || 0,
        person_entries: personCount || 0,
        total_size_bytes: 0, // Size calculation omitted for demo
      }
    } catch (error) {
      logger.warn('Failed to get cache stats:', error.message)
      return {
        total_entries: 0,
        company_entries: 0,
        person_entries: 0,
        total_size_bytes: 0,
      }
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache() {
    if (!this.isConfigured()) return 0

    try {
      const { count } = await this.client
        .from('analysis_cache')
        .delete()
        .lt('expires_at', new Date().toISOString())

      return count || 0
    } catch (error) {
      logger.warn('Failed to cleanup expired cache:', error.message)
      return 0
    }
  }
}

// Export singleton instance
module.exports = new SupabaseService()

