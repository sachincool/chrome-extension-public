// Chrome AI Service - Unified wrapper for Chrome's built-in AI APIs
// Supports: Prompt API, Summarizer API, Writer API, Rewriter API, Proofreader API

const aiLogger = window.createLogger ? window.createLogger('ChromeAI') : console;

class ChromeAIService {
  constructor() {
    this.sessions = {
      summarizer: null,
      writer: null,
      rewriter: null,
      proofreader: null,
      prompt: null,
    };

    this.availability = {
      summarizer: 'unknown',
      writer: 'unknown',
      rewriter: 'unknown',
      proofreader: 'unknown',
      prompt: 'unknown',
    };

    this.isInitialized = false;
  }

  /**
   * Initialize and check availability of all AI APIs
   * @returns {Promise<Object>} Availability status for each API
   */
  async initialize() {
    if (this.isInitialized) {
      return this.availability;
    }

    aiLogger.info('Initializing Chrome AI Service...');

    try {
      // Check Summarizer API
      if (typeof self !== 'undefined' && 'ai' in self && 'summarizer' in self.ai) {
        this.availability.summarizer = await self.ai.summarizer.capabilities();
        aiLogger.info('Summarizer API availability:', this.availability.summarizer);
      } else {
        this.availability.summarizer = 'no';
        aiLogger.warn('Summarizer API not available');
      }

      // Check Writer API
      if (typeof self !== 'undefined' && 'ai' in self && 'writer' in self.ai) {
        this.availability.writer = await self.ai.writer.capabilities();
        aiLogger.info('Writer API availability:', this.availability.writer);
      } else {
        this.availability.writer = 'no';
        aiLogger.warn('Writer API not available');
      }

      // Check Rewriter API
      if (typeof self !== 'undefined' && 'ai' in self && 'rewriter' in self.ai) {
        this.availability.rewriter = await self.ai.rewriter.capabilities();
        aiLogger.info('Rewriter API availability:', this.availability.rewriter);
      } else {
        this.availability.rewriter = 'no';
        aiLogger.warn('Rewriter API not available');
      }

      // Check Proofreader API
      if (typeof self !== 'undefined' && 'ai' in self && 'languageModel' in self.ai) {
        // Proofreader might be under languageModel
        this.availability.proofreader = 'available';
        aiLogger.info('Proofreader API availability: available');
      } else {
        this.availability.proofreader = 'no';
        aiLogger.warn('Proofreader API not available');
      }

      // Check Prompt API
      if (typeof self !== 'undefined' && 'ai' in self && 'languageModel' in self.ai) {
        this.availability.prompt = await self.ai.languageModel.capabilities();
        aiLogger.info('Prompt API availability:', this.availability.prompt);
      } else {
        this.availability.prompt = 'no';
        aiLogger.warn('Prompt API not available');
      }

      this.isInitialized = true;
      aiLogger.info('Chrome AI Service initialized:', this.availability);
    } catch (error) {
      aiLogger.error('Error initializing Chrome AI Service:', error);
    }

    return this.availability;
  }

  /**
   * Check if a specific API is available
   * @param {string} apiName - Name of the API (summarizer, writer, rewriter, proofreader, prompt)
   * @returns {boolean} True if available
   */
  isAvailable(apiName) {
    const status = this.availability[apiName];
    return status === 'readily' || status === 'available' || status === 'after-download';
  }

  /**
   * Get availability status with detailed information
   * @returns {Object} Detailed availability information
   */
  getDetailedAvailability() {
    return {
      summarizer: {
        available: this.isAvailable('summarizer'),
        status: this.availability.summarizer,
        requiresDownload: this.availability.summarizer === 'after-download',
      },
      writer: {
        available: this.isAvailable('writer'),
        status: this.availability.writer,
        requiresDownload: this.availability.writer === 'after-download',
      },
      rewriter: {
        available: this.isAvailable('rewriter'),
        status: this.availability.rewriter,
        requiresDownload: this.availability.rewriter === 'after-download',
      },
      proofreader: {
        available: this.isAvailable('proofreader'),
        status: this.availability.proofreader,
        requiresDownload: false,
      },
      prompt: {
        available: this.isAvailable('prompt'),
        status: this.availability.prompt,
        requiresDownload: this.availability.prompt === 'after-download',
      },
    };
  }

  // ============================================================================
  // SUMMARIZER API
  // ============================================================================

  /**
   * Create a summarizer session
   * @param {Object} options - Summarizer options
   * @returns {Promise<Object>} Summarizer session
   */
  async createSummarizer(options = {}) {
    if (!this.isAvailable('summarizer')) {
      throw new Error('Summarizer API is not available');
    }

    try {
      const defaultOptions = {
        type: 'key-points',
        format: 'markdown',
        length: 'medium',
      };

      const mergedOptions = { ...defaultOptions, ...options };

      aiLogger.info('Creating summarizer with options:', mergedOptions);

      const summarizer = await self.ai.summarizer.create(mergedOptions);
      this.sessions.summarizer = summarizer;

      return summarizer;
    } catch (error) {
      aiLogger.error('Error creating summarizer:', error);
      throw error;
    }
  }

  /**
   * Summarize text
   * @param {string} text - Text to summarize
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Summary
   */
  async summarizeText(text, options = {}) {
    try {
      if (!this.sessions.summarizer) {
        await this.createSummarizer(options);
      }

      aiLogger.info('Summarizing text...');
      const summary = await this.sessions.summarizer.summarize(text, options);
      
      return summary;
    } catch (error) {
      aiLogger.error('Error summarizing text:', error);
      throw error;
    }
  }

  /**
   * Summarize text with streaming
   * @param {string} text - Text to summarize
   * @param {Object} options - Additional options
   * @returns {AsyncIterable<string>} Streaming summary
   */
  async summarizeStreaming(text, options = {}) {
    try {
      if (!this.sessions.summarizer) {
        await this.createSummarizer(options);
      }

      aiLogger.info('Streaming summarization...');
      const stream = await this.sessions.summarizer.summarizeStreaming(text, options);
      
      return stream;
    } catch (error) {
      aiLogger.error('Error streaming summarization:', error);
      throw error;
    }
  }

  // ============================================================================
  // WRITER API
  // ============================================================================

  /**
   * Create a writer session
   * @param {Object} options - Writer options
   * @returns {Promise<Object>} Writer session
   */
  async createWriter(options = {}) {
    if (!this.isAvailable('writer')) {
      throw new Error('Writer API is not available');
    }

    try {
      const defaultOptions = {
        tone: 'neutral',
        format: 'markdown',
        length: 'medium',
      };

      const mergedOptions = { ...defaultOptions, ...options };

      aiLogger.info('Creating writer with options:', mergedOptions);

      const writer = await self.ai.writer.create(mergedOptions);
      this.sessions.writer = writer;

      return writer;
    } catch (error) {
      aiLogger.error('Error creating writer:', error);
      throw error;
    }
  }

  /**
   * Generate content using Writer API
   * @param {string} prompt - Writing prompt
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Generated content
   */
  async write(prompt, options = {}) {
    try {
      if (!this.sessions.writer) {
        await this.createWriter(options);
      }

      aiLogger.info('Generating content...');
      const content = await this.sessions.writer.write(prompt, options);
      
      return content;
    } catch (error) {
      aiLogger.error('Error generating content:', error);
      throw error;
    }
  }

  /**
   * Generate content with streaming
   * @param {string} prompt - Writing prompt
   * @param {Object} options - Additional options
   * @returns {AsyncIterable<string>} Streaming content
   */
  async writeStreaming(prompt, options = {}) {
    try {
      if (!this.sessions.writer) {
        await this.createWriter(options);
      }

      aiLogger.info('Streaming content generation...');
      const stream = await this.sessions.writer.writeStreaming(prompt, options);
      
      return stream;
    } catch (error) {
      aiLogger.error('Error streaming content:', error);
      throw error;
    }
  }

  /**
   * Generate personalized outreach message
   * @param {Object} context - Context about the person/company
   * @param {string} messageType - Type of message (cold-email, linkedin, follow-up)
   * @param {string} tone - Tone (professional, casual, friendly)
   * @param {string} length - Length (short, medium, long)
   * @returns {Promise<string>} Generated message
   */
  async generateOutreach(context, messageType = 'cold-email', tone = 'professional', length = 'medium') {
    try {
      const sharedContext = this.buildSharedContext(context);
      
      const writerOptions = {
        tone: this.mapToneToWriter(tone),
        length: length,
        format: 'plain-text',
        sharedContext: sharedContext,
      };

      await this.createWriter(writerOptions);

      const prompt = this.buildOutreachPrompt(context, messageType);
      
      return await this.write(prompt, { context: sharedContext });
    } catch (error) {
      aiLogger.error('Error generating outreach:', error);
      throw error;
    }
  }

  // ============================================================================
  // REWRITER API
  // ============================================================================

  /**
   * Create a rewriter session
   * @param {Object} options - Rewriter options
   * @returns {Promise<Object>} Rewriter session
   */
  async createRewriter(options = {}) {
    if (!this.isAvailable('rewriter')) {
      throw new Error('Rewriter API is not available');
    }

    try {
      const defaultOptions = {
        tone: 'as-is',
        format: 'plain-text',
        length: 'as-is',
      };

      const mergedOptions = { ...defaultOptions, ...options };

      aiLogger.info('Creating rewriter with options:', mergedOptions);

      const rewriter = await self.ai.rewriter.create(mergedOptions);
      this.sessions.rewriter = rewriter;

      return rewriter;
    } catch (error) {
      aiLogger.error('Error creating rewriter:', error);
      throw error;
    }
  }

  /**
   * Rewrite text with specified tone
   * @param {string} text - Text to rewrite
   * @param {string} tone - Desired tone (more-casual, more-formal, more-concise, more-persuasive)
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Rewritten text
   */
  async rewriteText(text, tone = 'as-is', options = {}) {
    try {
      const rewriterOptions = {
        ...options,
        tone: tone,
      };

      if (!this.sessions.rewriter) {
        await this.createRewriter(rewriterOptions);
      }

      aiLogger.info('Rewriting text with tone:', tone);
      const rewritten = await this.sessions.rewriter.rewrite(text, options);
      
      return rewritten;
    } catch (error) {
      aiLogger.error('Error rewriting text:', error);
      throw error;
    }
  }

  /**
   * Rewrite text with streaming
   * @param {string} text - Text to rewrite
   * @param {string} tone - Desired tone
   * @param {Object} options - Additional options
   * @returns {AsyncIterable<string>} Streaming rewritten text
   */
  async rewriteStreaming(text, tone = 'as-is', options = {}) {
    try {
      const rewriterOptions = {
        ...options,
        tone: tone,
      };

      if (!this.sessions.rewriter) {
        await this.createRewriter(rewriterOptions);
      }

      aiLogger.info('Streaming text rewriting...');
      const stream = await this.sessions.rewriter.rewriteStreaming(text, options);
      
      return stream;
    } catch (error) {
      aiLogger.error('Error streaming rewrite:', error);
      throw error;
    }
  }

  // ============================================================================
  // PROOFREADER API
  // ============================================================================

  /**
   * Create a proofreader session
   * @returns {Promise<Object>} Proofreader session
   */
  async createProofreader() {
    if (!this.isAvailable('proofreader')) {
      throw new Error('Proofreader API is not available');
    }

    try {
      aiLogger.info('Creating proofreader...');

      // Note: Proofreader API might be accessed differently
      // This is a placeholder implementation based on expected API
      const proofreader = await self.ai.languageModel.create({
        systemPrompt: 'You are a helpful proofreading assistant. Check for grammar, spelling, and punctuation errors.',
      });
      
      this.sessions.proofreader = proofreader;

      return proofreader;
    } catch (error) {
      aiLogger.error('Error creating proofreader:', error);
      throw error;
    }
  }

  /**
   * Proofread text and get corrections
   * @param {string} text - Text to proofread
   * @returns {Promise<Object>} Corrections
   */
  async proofreadText(text) {
    try {
      if (!this.sessions.proofreader) {
        await this.createProofreader();
      }

      aiLogger.info('Proofreading text...');
      
      // Simple implementation using prompt API
      const prompt = `Please proofread the following text and provide corrections:\n\n${text}`;
      const result = await this.sessions.proofreader.prompt(prompt);
      
      return {
        original: text,
        corrected: result,
        hasErrors: text !== result,
      };
    } catch (error) {
      aiLogger.error('Error proofreading text:', error);
      throw error;
    }
  }

  // ============================================================================
  // PROMPT API
  // ============================================================================

  /**
   * Create a prompt session
   * @param {Object} options - Prompt API options
   * @returns {Promise<Object>} Prompt session
   */
  async createPromptSession(options = {}) {
    if (!this.isAvailable('prompt')) {
      throw new Error('Prompt API is not available');
    }

    try {
      aiLogger.info('Creating prompt session...');

      const session = await self.ai.languageModel.create(options);
      this.sessions.prompt = session;

      return session;
    } catch (error) {
      aiLogger.error('Error creating prompt session:', error);
      throw error;
    }
  }

  /**
   * Send a prompt to the language model
   * @param {string} prompt - Prompt text
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Response
   */
  async prompt(prompt, options = {}) {
    try {
      if (!this.sessions.prompt) {
        await this.createPromptSession(options);
      }

      aiLogger.info('Sending prompt...');
      const response = await this.sessions.prompt.prompt(prompt);
      
      return response;
    } catch (error) {
      aiLogger.error('Error sending prompt:', error);
      throw error;
    }
  }

  /**
   * Send a prompt with streaming response
   * @param {string} prompt - Prompt text
   * @param {Object} options - Additional options
   * @returns {AsyncIterable<string>} Streaming response
   */
  async promptStreaming(prompt, options = {}) {
    try {
      if (!this.sessions.prompt) {
        await this.createPromptSession(options);
      }

      aiLogger.info('Streaming prompt...');
      const stream = await this.sessions.prompt.promptStreaming(prompt);
      
      return stream;
    } catch (error) {
      aiLogger.error('Error streaming prompt:', error);
      throw error;
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Build shared context for Writer API from LinkedIntel data
   * @param {Object} context - Context object
   * @returns {string} Shared context string
   */
  buildSharedContext(context) {
    if (!context) return '';

    if (context.type === 'profile') {
      return `This is a professional outreach to ${context.name || 'a prospect'}, who works at ${context.company || 'a company'}. ${
        context.title ? `Their role is ${context.title}.` : ''
      } ${context.highlights ? context.highlights.join(' ') : ''}`;
    } else if (context.type === 'company') {
      return `This is a professional outreach to ${context.name || 'a company'}. ${
        context.industry ? `They operate in the ${context.industry} industry.` : ''
      } ${context.highlights ? context.highlights.join(' ') : ''}`;
    }

    return '';
  }

  /**
   * Build outreach prompt based on message type
   * @param {Object} context - Context object
   * @param {string} messageType - Type of message
   * @returns {string} Prompt
   */
  buildOutreachPrompt(context, messageType) {
    const prompts = {
      'cold-email': `Write a personalized cold email to introduce myself and my product. Focus on value and relevance to their role.`,
      'linkedin': `Write a personalized LinkedIn connection message. Keep it brief, friendly, and professional.`,
      'follow-up': `Write a follow-up message checking in and providing additional value. Be respectful of their time.`,
      'intro-request': `Write a warm introduction request message. Explain why connecting would be mutually beneficial.`,
    };

    return prompts[messageType] || prompts['cold-email'];
  }

  /**
   * Map user-friendly tone to Writer API tone
   * @param {string} tone - User-friendly tone
   * @returns {string} Writer API tone
   */
  mapToneToWriter(tone) {
    const toneMap = {
      professional: 'formal',
      casual: 'casual',
      friendly: 'neutral',
      direct: 'neutral',
    };

    return toneMap[tone] || 'neutral';
  }

  /**
   * Destroy all active sessions
   */
  destroySessions() {
    aiLogger.info('Destroying all AI sessions...');
    
    Object.keys(this.sessions).forEach((key) => {
      if (this.sessions[key] && typeof this.sessions[key].destroy === 'function') {
        try {
          this.sessions[key].destroy();
        } catch (error) {
          aiLogger.warn(`Error destroying ${key} session:`, error);
        }
      }
      this.sessions[key] = null;
    });
  }

  /**
   * Download progress monitor
   * @param {Function} callback - Progress callback
   * @returns {Object} Monitor object
   */
  createDownloadMonitor(callback) {
    return {
      addEventListener: (event, handler) => {
        if (event === 'downloadprogress') {
          callback(handler);
        }
      },
    };
  }
}

// Create singleton instance
const chromeAI = new ChromeAIService();

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.chromeAI = chromeAI;
}

// Also export as module if in module context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = chromeAI;
}

