// AI Outreach Generator - Create personalized conversation starters for SDRs
// Uses Chrome Built-in AI APIs to generate contextual, relevant messages

const outreachLogger = window.createLogger
  ? window.createLogger('AIOutreach')
  : console;

class AIOutreachGenerator {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize AI services
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.initialized) return true;

    try {
      if (window.chromeAI) {
        await window.chromeAI.initialize();
        this.initialized = true;
        outreachLogger.info('AI Outreach Generator initialized');
        return true;
      }
      return false;
    } catch (error) {
      outreachLogger.error('Failed to initialize AI:', error);
      return false;
    }
  }

  /**
   * Generate personalized outreach message
   * @param {Object} profileData - Profile information
   * @param {Object} postsInsights - Insights from recent posts
   * @param {string} messageType - Type of message (cold_outreach, followup, comment_reply)
   * @returns {Promise<Object>} Generated message and reasoning
   */
  async generateOutreachMessage(profileData, postsInsights, messageType = 'cold_outreach') {
    await this.initialize();

    if (!window.chromeAI || !window.chromeAI.isAvailable('prompt')) {
      throw new Error('Chrome AI Prompt API not available');
    }

    try {
      // Build context from profile and posts
      const context = this.buildContext(profileData, postsInsights);
      
      // Generate message using Prompt API
      const prompt = this.buildPrompt(context, messageType);
      
      outreachLogger.debug('Generating message with context:', context);

      const systemPrompt = `You are an expert SDR (Sales Development Representative) writing personalized LinkedIn outreach messages. 

CRITICAL RULES:
- Message must be 40-60 words maximum
- Start with a specific, relevant hook (NO generic "I saw your post" or "I came across your profile")
- Reference specific details: recent conference, speaking engagement, achievement, or pain point
- Be conversational and authentic (not salesy)
- End with a light question or soft CTA
- Do NOT mention your company, product, or services
- Focus on THEIR interests and recent activity
- Sound like a human, not a bot

OUTPUT FORMAT: Return ONLY the message text. No subject line, no explanations.`;

      const message = await window.chromeAI.prompt(prompt, {
        systemPrompt: systemPrompt,
      });

      // Extract hook reasoning
      const hook = this.extractHook(postsInsights, profileData);

      return {
        message: message.trim(),
        hook: hook,
        context: context,
        confidence: this.calculateConfidence(postsInsights, profileData),
      };
    } catch (error) {
      outreachLogger.error('Error generating message:', error);
      throw error;
    }
  }

  /**
   * Build context from profile and posts data
   * Now uses unified context service for richer data
   * @param {Object} profileData - Profile information (legacy, optional)
   * @param {Object} postsInsights - Post insights (legacy, optional)
   * @returns {Object} Structured context
   */
  buildContext(profileData, postsInsights) {
    // Prefer unified context service if available
    if (window.unifiedContext) {
      const fullContext = window.unifiedContext.getFullContext()
      
      return {
        name: fullContext.profile?.name || 'Professional',
        currentRole: fullContext.profile?.title || fullContext.profile?.currentPosition || '',
        company: fullContext.profile?.company || fullContext.company?.name || '',
        location: fullContext.profile?.location || '',
        about: fullContext.profile?.about ? fullContext.profile.about.substring(0, 300) : '',
        
        // Recent activity insights from unified context
        recentConference: fullContext.activity?.conferences?.[0]?.text || null,
        recentSpeaking: fullContext.activity?.speakingEngagements?.[0]?.text || null,
        recentAchievement: fullContext.activity?.achievements?.[0]?.text || null,
        painPoints: fullContext.intelligence?.painPoints?.[0] || null,
        recentTopics: fullContext.activity?.recentPosts?.slice(0, 3).map(p => p.text) || [],
        engagementLevel: fullContext.activity?.engagementLevel || 'low',
        
        // Best hook
        bestHook: fullContext.activity?.bestHook || null,
        
        // Additional intelligence from unified context
        buyingSignals: fullContext.intelligence?.buyingSignals || [],
        techStack: fullContext.company?.techStack?.slice(0, 5) || [],
        recentNews: fullContext.intelligence?.recentNews?.slice(0, 2) || [],
        decisionMakerScore: fullContext.profile?.decisionMakerScore || null,
      }
    }
    
    // Fallback to legacy parameters if unified context not available
    return {
      name: profileData?.name || 'Professional',
      currentRole: profileData?.headline || profileData?.currentPosition || '',
      company: profileData?.company || '',
      location: profileData?.location || '',
      about: profileData?.about ? profileData.about.substring(0, 300) : '',
      
      // Recent activity insights
      recentConference: postsInsights?.conferences?.[0]?.text || null,
      recentSpeaking: postsInsights?.speaking?.[0]?.text || null,
      recentAchievement: postsInsights?.achievements?.[0]?.text || null,
      painPoints: postsInsights?.painPoints?.[0] || null,
      recentTopics: postsInsights?.recentTopics?.slice(0, 3) || [],
      engagementLevel: postsInsights?.engagementLevel || 'low',
      
      // Best hook
      bestHook: postsInsights?.bestHook || null,
    }
  }

  /**
   * Build prompt for AI
   * @param {Object} context - Context object
   * @param {string} messageType - Message type
   * @returns {string} AI prompt
   */
  buildPrompt(context, messageType) {
    let prompt = `Write a short, personalized LinkedIn message for this professional:\n\n`;
    
    // Add profile context
    prompt += `Name: ${context.name}\n`;
    if (context.currentRole) prompt += `Role: ${context.currentRole}\n`;
    if (context.company) prompt += `Company: ${context.company}\n`;
    
    prompt += `\n`;
    
    // Add recent activity (MOST IMPORTANT)
    if (context.bestHook) {
      prompt += `MOST RECENT ACTIVITY (${context.bestHook.type}):\n"${context.bestHook.text}"\n\n`;
    }
    
    if (context.recentConference) {
      prompt += `Recent Conference: "${context.recentConference}"\n`;
    }
    
    if (context.recentSpeaking) {
      prompt += `Recent Speaking: "${context.recentSpeaking}"\n`;
    }
    
    if (context.recentAchievement) {
      prompt += `Recent Achievement: "${context.recentAchievement}"\n`;
    }
    
    if (context.painPoints) {
      prompt += `Mentioned Challenge: "${context.painPoints}"\n`;
    }
    
    if (context.recentTopics.length > 0) {
      prompt += `Topics of Interest: ${context.recentTopics.join(', ')}\n`;
    }
    
    prompt += `\n`;
    
    // Add instructions based on message type
    switch (messageType) {
      case 'cold_outreach':
        prompt += `Write a conversational message that:\n`;
        prompt += `1. Opens with a specific reference to their recent activity\n`;
        prompt += `2. Shows genuine interest in their work\n`;
        prompt += `3. Asks a thoughtful question related to their recent post or achievement\n`;
        break;
        
      case 'comment_reply':
        prompt += `Write a thoughtful comment on their recent post that adds value and invites conversation.\n`;
        break;
        
      case 'followup':
        prompt += `Write a natural follow-up message that references their recent activity and re-engages the conversation.\n`;
        break;
    }
    
    return prompt;
  }

  /**
   * Extract the best hook/angle for outreach
   * @param {Object} postsInsights - Post insights
   * @param {Object} profileData - Profile data
   * @returns {Object} Hook information
   */
  extractHook(postsInsights, profileData) {
    if (postsInsights.bestHook) {
      return {
        type: postsInsights.bestHook.type,
        reason: this.getHookReason(postsInsights.bestHook.type),
        relevance: postsInsights.bestHook.relevance,
        text: postsInsights.bestHook.text.substring(0, 100) + '...',
      };
    }

    // Fallback hooks
    if (postsInsights.conferences?.length > 0) {
      return {
        type: 'conference',
        reason: 'Recent conference attendance',
        relevance: 80,
        text: postsInsights.conferences[0].text.substring(0, 100) + '...',
      };
    }

    if (postsInsights.achievements?.length > 0) {
      return {
        type: 'achievement',
        reason: 'Recent achievement or milestone',
        relevance: 75,
        text: postsInsights.achievements[0].text.substring(0, 100) + '...',
      };
    }

    if (profileData.currentPosition) {
      return {
        type: 'role',
        reason: 'Current role and responsibilities',
        relevance: 50,
        text: profileData.currentPosition,
      };
    }

    return {
      type: 'general',
      reason: 'Professional background',
      relevance: 30,
      text: profileData.about?.substring(0, 100) || 'Professional experience',
    };
  }

  /**
   * Get human-readable hook reason
   * @param {string} type - Hook type
   * @returns {string} Reason
   */
  getHookReason(type) {
    const reasons = {
      conference: 'Recently attended or mentioned a conference',
      speaking: 'Recent speaking engagement',
      achievement: 'Celebrated an achievement or milestone',
      job_change: 'Started a new role',
      product_update: 'Announced a product or company update',
      thought_leadership: 'Shared valuable insights on their expertise',
      general: 'Recent LinkedIn activity',
    };
    return reasons[type] || 'Recent professional activity';
  }

  /**
   * Calculate confidence score
   * @param {Object} postsInsights - Post insights
   * @param {Object} profileData - Profile data
   * @returns {number} Confidence score (0-100)
   */
  calculateConfidence(postsInsights, profileData) {
    let confidence = 50;

    // Recent activity boosts confidence
    if (postsInsights.bestHook && postsInsights.bestHook.relevance > 70) {
      confidence += 30;
    } else if (postsInsights.bestHook) {
      confidence += 15;
    }

    // Multiple data points boost confidence
    const dataPoints = [
      postsInsights.conferences?.length,
      postsInsights.speaking?.length,
      postsInsights.achievements?.length,
      postsInsights.painPoints?.length,
    ].filter(Boolean).length;

    confidence += Math.min(dataPoints * 5, 20);

    return Math.min(confidence, 100);
  }

  /**
   * Generate multiple message variations
   * @param {Object} profileData - Profile data
   * @param {Object} postsInsights - Post insights
   * @param {number} count - Number of variations
   * @returns {Promise<Array>} Array of message variations
   */
  async generateVariations(profileData, postsInsights, count = 3) {
    const variations = [];

    for (let i = 0; i < count; i++) {
      try {
        const result = await this.generateOutreachMessage(profileData, postsInsights);
        variations.push(result);
        
        // Small delay to get different variations
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        outreachLogger.error(`Failed to generate variation ${i + 1}:`, error);
      }
    }

    return variations;
  }
}

// Create singleton instance
const aiOutreachGenerator = new AIOutreachGenerator();

// Export
if (typeof window !== 'undefined') {
  window.aiOutreachGenerator = aiOutreachGenerator;
}

