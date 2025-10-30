// LinkedIn Posts Scraper - Extract recent posts and activity
// Provides SDR-relevant insights from prospect's recent activity

const postsScraperLogger = window.createLogger
  ? window.createLogger('PostsScraper')
  : console;

class LinkedInPostsScraper {
  constructor() {
    this.maxPosts = 5; // Recent posts to analyze
    this.cache = new Map();
  }

  /**
   * Extract recent posts from LinkedIn profile
   * @param {string} profileUrl - LinkedIn profile URL
   * @returns {Promise<Array>} Array of post objects
   */
  async extractRecentPosts(profileUrl) {
    const cacheKey = profileUrl;
    if (this.cache.has(cacheKey)) {
      postsScraperLogger.debug('Using cached posts');
      return this.cache.get(cacheKey);
    }

    try {
      const posts = [];

      // Find the recent activity section
      const activitySection = document.querySelector('.pvs-list__container');
      
      if (!activitySection) {
        postsScraperLogger.warn('No activity section found');
        return [];
      }

      // Get all post items
      const postElements = activitySection.querySelectorAll('.profile-creator-shared-feed-update__container');
      
      postsScraperLogger.info(`Found ${postElements.length} post elements`);

      for (let i = 0; i < Math.min(postElements.length, this.maxPosts); i++) {
        const postEl = postElements[i];
        const post = this.parsePostElement(postEl);
        
        if (post) {
          posts.push(post);
        }
      }

      // Alternative: Check for recent posts in main feed
      if (posts.length === 0) {
        const feedPosts = this.extractFromFeed();
        posts.push(...feedPosts.slice(0, this.maxPosts));
      }

      this.cache.set(cacheKey, posts);
      postsScraperLogger.info(`Extracted ${posts.length} recent posts`);
      
      return posts;
    } catch (error) {
      postsScraperLogger.error('Error extracting posts:', error);
      return [];
    }
  }

  /**
   * Parse individual post element
   * @param {HTMLElement} postEl - Post DOM element
   * @returns {Object|null} Post data
   */
  parsePostElement(postEl) {
    try {
      // Extract post text
      const textEl = postEl.querySelector('.feed-shared-update-v2__description, .update-components-text');
      const text = textEl ? textEl.innerText.trim() : '';

      // Extract post date
      const dateEl = postEl.querySelector('.feed-shared-actor__sub-description, time');
      const date = dateEl ? dateEl.innerText.trim() : '';

      // Extract engagement metrics
      const likesEl = postEl.querySelector('.social-details-social-counts__reactions-count');
      const commentsEl = postEl.querySelector('.social-details-social-counts__comments');
      const likes = likesEl ? this.parseNumber(likesEl.innerText) : 0;
      const comments = commentsEl ? this.parseNumber(commentsEl.innerText) : 0;

      // Extract hashtags and mentions
      const hashtags = this.extractHashtags(text);
      const mentions = this.extractMentions(text);

      // Detect post type
      const type = this.detectPostType(postEl, text);

      if (!text || text.length < 10) {
        return null; // Skip empty or very short posts
      }

      return {
        text,
        date,
        likes,
        comments,
        hashtags,
        mentions,
        type,
        relevance: this.calculateRelevance(text, type, likes, comments),
      };
    } catch (error) {
      postsScraperLogger.error('Error parsing post:', error);
      return null;
    }
  }

  /**
   * Extract posts from main feed (alternative method)
   * @returns {Array} Array of post objects
   */
  extractFromFeed() {
    const posts = [];
    const feedItems = document.querySelectorAll('.feed-shared-update-v2');

    for (const item of Array.from(feedItems).slice(0, this.maxPosts)) {
      const post = this.parsePostElement(item);
      if (post) {
        posts.push(post);
      }
    }

    return posts;
  }

  /**
   * Detect post type (conference, speaking, achievement, etc.)
   * @param {HTMLElement} postEl - Post element
   * @param {string} text - Post text
   * @returns {string} Post type
   */
  detectPostType(postEl, text) {
    const lowerText = text.toLowerCase();

    // Conference/Event keywords
    if (
      lowerText.match(/\b(conference|summit|event|webinar|meetup|speaking at|keynote)\b/i) ||
      lowerText.match(/\b(attending|joined|participated in)\b/i)
    ) {
      return 'conference';
    }

    // Speaking engagement
    if (
      lowerText.match(/\b(speaking|speaker|talk|presentation|keynote|panel)\b/i)
    ) {
      return 'speaking';
    }

    // Achievement/Award
    if (
      lowerText.match(/\b(excited|proud|thrilled|honored|pleased to announce)\b/i) &&
      lowerText.match(/\b(award|recognition|achievement|milestone)\b/i)
    ) {
      return 'achievement';
    }

    // Job change
    if (
      lowerText.match(/\b(new role|joined|starting|excited to announce|new position)\b/i)
    ) {
      return 'job_change';
    }

    // Thought leadership
    if (
      lowerText.match(/\b(share|thoughts on|perspective|opinion|believe)\b/i) &&
      text.length > 200
    ) {
      return 'thought_leadership';
    }

    // Product/Company update
    if (
      lowerText.match(/\b(launch|release|announce|introducing|proud to share)\b/i)
    ) {
      return 'product_update';
    }

    return 'general';
  }

  /**
   * Calculate relevance score for SDR
   * @param {string} text - Post text
   * @param {string} type - Post type
   * @param {number} likes - Like count
   * @param {number} comments - Comment count
   * @returns {number} Relevance score (0-100)
   */
  calculateRelevance(text, type, likes, comments) {
    let score = 50; // Base score

    // Type-based scoring
    const typeScores = {
      conference: 20,
      speaking: 25,
      achievement: 15,
      job_change: 30,
      product_update: 20,
      thought_leadership: 10,
      general: 5,
    };
    score += typeScores[type] || 0;

    // Engagement scoring
    if (likes > 100) score += 10;
    else if (likes > 50) score += 5;

    if (comments > 20) score += 10;
    else if (comments > 10) score += 5;

    // Pain point keywords (buying signals)
    const painPoints = [
      'challenge',
      'struggle',
      'difficult',
      'problem',
      'issue',
      'looking for',
      'need',
      'better way',
    ];
    const hasPainPoint = painPoints.some((keyword) =>
      text.toLowerCase().includes(keyword)
    );
    if (hasPainPoint) score += 15;

    return Math.min(score, 100);
  }

  /**
   * Extract hashtags from text
   * @param {string} text - Post text
   * @returns {Array<string>} Hashtags
   */
  extractHashtags(text) {
    const matches = text.match(/#[\w]+/g);
    return matches ? matches.map((tag) => tag.substring(1)) : [];
  }

  /**
   * Extract mentions from text
   * @param {string} text - Post text
   * @returns {Array<string>} Mentions
   */
  extractMentions(text) {
    const matches = text.match(/@[\w\s]+/g);
    return matches ? matches.map((mention) => mention.substring(1).trim()) : [];
  }

  /**
   * Parse number from text (handles "1.2K", "10K", etc.)
   * @param {string} text - Number text
   * @returns {number} Parsed number
   */
  parseNumber(text) {
    if (!text) return 0;

    const cleaned = text.replace(/[,\s]/g, '');
    const match = cleaned.match(/(\d+(?:\.\d+)?)(K|M)?/i);

    if (!match) return 0;

    const num = parseFloat(match[1]);
    const multiplier = match[2];

    if (multiplier === 'K') return Math.round(num * 1000);
    if (multiplier === 'M') return Math.round(num * 1000000);

    return Math.round(num);
  }

  /**
   * Generate insights summary from posts
   * @param {Array} posts - Array of post objects
   * @returns {Object} Insights summary
   */
  generateInsights(posts) {
    const insights = {
      conferences: [],
      speaking: [],
      achievements: [],
      painPoints: [],
      interests: [],
      recentTopics: [],
      engagementLevel: 'low',
      bestHook: null,
    };

    posts.forEach((post) => {
      // Categorize by type
      if (post.type === 'conference') {
        insights.conferences.push({
          text: post.text.substring(0, 200),
          date: post.date,
        });
      }

      if (post.type === 'speaking') {
        insights.speaking.push({
          text: post.text.substring(0, 200),
          date: post.date,
        });
      }

      if (post.type === 'achievement') {
        insights.achievements.push({
          text: post.text.substring(0, 200),
          date: post.date,
        });
      }

      // Extract pain points
      const painKeywords = ['challenge', 'struggle', 'difficult', 'problem', 'looking for'];
      if (painKeywords.some(kw => post.text.toLowerCase().includes(kw))) {
        insights.painPoints.push(post.text.substring(0, 200));
      }

      // Collect topics from hashtags
      insights.recentTopics.push(...post.hashtags);
    });

    // Calculate engagement level
    const avgLikes = posts.reduce((sum, p) => sum + p.likes, 0) / posts.length;
    insights.engagementLevel = avgLikes > 100 ? 'high' : avgLikes > 50 ? 'medium' : 'low';

    // Find best hook (highest relevance post)
    const bestPost = posts.sort((a, b) => b.relevance - a.relevance)[0];
    if (bestPost) {
      insights.bestHook = {
        type: bestPost.type,
        text: bestPost.text.substring(0, 300),
        date: bestPost.date,
        relevance: bestPost.relevance,
      };
    }

    // Deduplicate topics
    insights.recentTopics = [...new Set(insights.recentTopics)].slice(0, 5);

    postsScraperLogger.info('Generated insights:', insights);
    return insights;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Create singleton instance
const linkedInPostsScraper = new LinkedInPostsScraper();

// Export
if (typeof window !== 'undefined') {
  window.linkedInPostsScraper = linkedInPostsScraper;
}

