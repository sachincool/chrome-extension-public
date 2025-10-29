// LinkedIntel Chat Interface
// Context-aware AI chat using Perplexity API

const chatLogger = window.createLogger('ChatInterface')

class ChatInterface {
  constructor(panelInstance) {
    this.panel = panelInstance
    this.messages = []
    this.isLoading = false
    this.container = null

    // Load chat history from storage
    this.loadChatHistory()
  }

  /**
   * Load chat history from Chrome storage
   */
  async loadChatHistory() {
    try {
      const result = await chrome.storage.local.get([
        'linkedintel_chat_history',
      ])
      if (result.linkedintel_chat_history) {
        this.messages = result.linkedintel_chat_history
      }
    } catch (error) {
      chatLogger.error('Failed to load chat history:', error)
    }
  }

  /**
   * Save chat history to Chrome storage
   */
  async saveChatHistory() {
    try {
      // Keep only last 50 messages to prevent storage bloat
      const recentMessages = this.messages.slice(-50)
      await chrome.storage.local.set({
        linkedintel_chat_history: recentMessages,
      })
    } catch (error) {
      chatLogger.error('Failed to save chat history:', error)
    }
  }

  /**
   * Clear chat history
   */
  async clearChatHistory() {
    this.messages = []
    await chrome.storage.local.remove(['linkedintel_chat_history'])
    this.render()
  }

  /**
   * Generate chat UI HTML
   */
  generateChatHTML() {
    return `
      <div class="linkedintel-chat-container">
        <div class="linkedintel-chat-header">
          <div class="linkedintel-chat-title">
            <svg class="linkedintel-chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
              <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/>
            </svg>
            <span>LinkedIntel AI Assistant</span>
          </div>
          <button class="linkedintel-chat-clear-btn" title="Clear chat history">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>

        ${this.generateAIComposerHTML()}

        <div class="linkedintel-chat-messages" id="linkedintel-chat-messages">
          ${this.renderMessages()}
        </div>

        <div class="linkedintel-chat-input-container">
          <div class="linkedintel-chat-toolbar">
            ${this.generateRefineButtonHTML()}
          </div>
          <div class="linkedintel-chat-context-badge">
            ${this.getContextBadge()}
          </div>
          <div class="linkedintel-chat-input-wrapper">
            <textarea 
              class="linkedintel-chat-input" 
              id="linkedintel-chat-input"
              placeholder="Ask anything about this ${
                this.panel.pageType === 'profile' ? 'profile' : 'company'
              }..."
              rows="1"
            ></textarea>
            <button class="linkedintel-chat-send-btn" id="linkedintel-chat-send-btn">
              <svg class="linkedintel-send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              <div class="linkedintel-send-loader">
                <div class="linkedintel-spinner"></div>
              </div>
            </button>
          </div>
        </div>
      </div>
    `
  }

  /**
   * Generate AI Composer HTML (Writer API)
   */
  generateAIComposerHTML() {
    if (!window.chromeAI || !window.chromeAI.isAvailable('writer')) {
      return ''
    }

    return `
      <div class="linkedintel-ai-composer" style="margin: 16px; padding: 16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
        <div style="display: flex; align-items: center; justify-content: between; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
            <span style="color: white; font-size: 13px; font-weight: 600;">AI Message Composer</span>
            <span style="background: rgba(255, 255, 255, 0.2); color: white; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.5px;">On-Device</span>
          </div>
          <button class="linkedintel-ai-composer-toggle" style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.3); color: white; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 500; cursor: pointer;">
            Expand
          </button>
        </div>
        <div class="linkedintel-ai-composer-content" style="display: none;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
            <div>
              <label style="color: rgba(255, 255, 255, 0.9); font-size: 11px; font-weight: 500; margin-bottom: 4px; display: block;">Message Type</label>
              <select class="linkedintel-ai-message-type" style="width: 100%; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); color: white; border-radius: 6px; padding: 6px; font-size: 12px;">
                <option value="cold-email">Cold Email</option>
                <option value="linkedin">LinkedIn InMail</option>
                <option value="follow-up">Follow-up</option>
                <option value="intro-request">Introduction Request</option>
              </select>
            </div>
            <div>
              <label style="color: rgba(255, 255, 255, 0.9); font-size: 11px; font-weight: 500; margin-bottom: 4px; display: block;">Tone</label>
              <select class="linkedintel-ai-message-tone" style="width: 100%; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); color: white; border-radius: 6px; padding: 6px; font-size: 12px;">
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="friendly">Friendly</option>
                <option value="direct">Direct</option>
              </select>
            </div>
          </div>
          <div style="margin-bottom: 12px;">
            <label style="color: rgba(255, 255, 255, 0.9); font-size: 11px; font-weight: 500; margin-bottom: 4px; display: block;">Length</label>
            <div style="display: flex; gap: 6px;">
              <button class="linkedintel-ai-length-btn active" data-length="short" style="flex: 1; background: rgba(255, 255, 255, 0.3); border: 1px solid rgba(255, 255, 255, 0.4); color: white; border-radius: 6px; padding: 6px; font-size: 11px; font-weight: 500; cursor: pointer;">Short</button>
              <button class="linkedintel-ai-length-btn" data-length="medium" style="flex: 1; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: white; border-radius: 6px; padding: 6px; font-size: 11px; font-weight: 500; cursor: pointer;">Medium</button>
              <button class="linkedintel-ai-length-btn" data-length="long" style="flex: 1; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: white; border-radius: 6px; padding: 6px; font-size: 11px; font-weight: 500; cursor: pointer;">Long</button>
            </div>
          </div>
          <button class="linkedintel-ai-generate-btn" style="width: 100%; background: white; color: #059669; border: none; border-radius: 8px; padding: 10px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
            Generate Message
          </button>
          <div class="linkedintel-ai-result" style="display: none; margin-top: 12px; padding: 12px; background: rgba(255, 255, 255, 0.15); border-radius: 8px; color: white; font-size: 13px; line-height: 1.6;">
          </div>
        </div>
      </div>
    `
  }

  /**
   * Generate Refine button HTML (Rewriter API)
   */
  generateRefineButtonHTML() {
    if (!window.chromeAI || !window.chromeAI.isAvailable('rewriter')) {
      return ''
    }

    return `
      <button class="linkedintel-refine-btn" title="Refine message with AI" style="background: #8b5cf6; color: white; border: none; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 4px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        Refine
      </button>
    `
  }

  /**
   * Get context badge showing what context is available
   */
  getContextBadge() {
    if (this.panel.pageType === 'profile' && this.panel.currentData?.profile) {
      const profile = this.panel.currentData.profile
      return `
        <span class="linkedintel-context-tag">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          ${profile.name || 'Profile'} context
        </span>
      `
    } else if (
      this.panel.pageType === 'company' &&
      this.panel.currentData?.companyName
    ) {
      return `
        <span class="linkedintel-context-tag">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2-2v16"/>
          </svg>
          ${this.panel.currentData.companyName} context
        </span>
      `
    }
    return ''
  }

  /**
   * Render messages list
   */
  renderMessages() {
    if (this.messages.length === 0) {
      return `
        <div class="linkedintel-chat-empty-state">
          <svg class="linkedintel-chat-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"/>
          </svg>
          <h3>Start a conversation</h3>
          <p>Ask me anything about this ${
            this.panel.pageType === 'profile' ? "person's profile" : 'company'
          }.</p>
          <div class="linkedintel-chat-suggestions">
            <button class="linkedintel-chat-suggestion">Tell me more about their background</button>
            <button class="linkedintel-chat-suggestion">What are the key selling points?</button>
            <button class="linkedintel-chat-suggestion">How should I approach them?</button>
          </div>
        </div>
      `
    }

    return this.messages
      .map(
        (msg, index) => `
      <div class="linkedintel-chat-message linkedintel-chat-message-${
        msg.role
      }" data-message-index="${index}">
        <div class="linkedintel-chat-message-avatar">
          ${
            msg.role === 'user'
              ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
              : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>'
          }
        </div>
        <div class="linkedintel-chat-message-content">
          <div class="linkedintel-chat-message-text">${this.formatMessage(
            msg.content
          )}</div>

          ${
            msg.role === 'assistant'
              ? `<div class="linkedintel-chat-message-actions">
                <button class="linkedintel-msg-action" data-action="copy" data-message-index="${index}" title="Copy message">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
                <button class="linkedintel-msg-action" data-action="regenerate" data-message-index="${index}" title="Regenerate response">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"/>
                    <polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                </button>
              </div>`
              : ''
          }
        </div>
      </div>
    `
      )
      .join('')
  }

  /**
   * Format message content (CopilotKit-inspired rich rendering)
   */
  formatMessage(text) {
    if (!text) return ''

    // Escape HTML first
    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // Remove citation numbers like [1], [2], [3], etc.
    formatted = formatted.replace(/\[(\d+)\]/g, '')

    // Convert code blocks with syntax highlighting
    formatted = formatted.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      (match, lang, code) => {
        const language = lang || 'plaintext'
        return `
          <div class="linkedintel-code-block">
            <div class="linkedintel-code-header">
              <span class="linkedintel-code-lang">${language}</span>
              <button class="linkedintel-code-copy" data-code="${this.escapeAttr(
                code
              )}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy
              </button>
            </div>
            <pre><code class="language-${language}">${code.trim()}</code></pre>
          </div>
        `
      }
    )

    // Convert inline code
    formatted = formatted.replace(
      /`([^`]+)`/g,
      '<code class="linkedintel-inline-code">$1</code>'
    )

    // Convert headers
    formatted = formatted.replace(
      /^### (.*$)/gim,
      '<h3 class="linkedintel-msg-h3">$1</h3>'
    )
    formatted = formatted.replace(
      /^## (.*$)/gim,
      '<h2 class="linkedintel-msg-h2">$1</h2>'
    )
    formatted = formatted.replace(
      /^# (.*$)/gim,
      '<h1 class="linkedintel-msg-h1">$1</h1>'
    )

    // Convert bullet lists
    formatted = formatted.replace(/^\* (.*$)/gim, '<li>$1</li>')
    formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')

    // Convert numbered lists
    formatted = formatted.replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    formatted = formatted.replace(/(<li>.*<\/li>)(?!<\/ul>)/s, '<ol>$1</ol>')

    // Convert **bold** to <strong>
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

    // Convert *italic* to <em>
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>')

    // Convert blockquotes
    formatted = formatted.replace(
      /^&gt; (.*$)/gim,
      '<blockquote>$1</blockquote>'
    )

    // Convert tables (basic support)
    formatted = this.formatTables(formatted)

    // Convert newlines to <br> (but not inside special blocks)
    formatted = formatted.replace(/\n(?![<])/g, '<br>')

    // Convert URLs to links
    formatted = formatted.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener" class="linkedintel-msg-link">$1</a>'
    )

    return formatted
  }

  /**
   * Format markdown tables
   */
  formatTables(text) {
    // Simple markdown table detection and conversion
    const tableRegex = /(\|[^\n]+\|\n)(\|[-:\s|]+\|\n)((?:\|[^\n]+\|\n?)+)/g

    return text.replace(tableRegex, (match, header, separator, rows) => {
      const headerCells = header
        .split('|')
        .slice(1, -1)
        .map((cell) => `<th>${cell.trim()}</th>`)
        .join('')

      const rowCells = rows
        .trim()
        .split('\n')
        .map((row) => {
          const cells = row
            .split('|')
            .slice(1, -1)
            .map((cell) => `<td>${cell.trim()}</td>`)
            .join('')
          return `<tr>${cells}</tr>`
        })
        .join('')

      return `
        <table class="linkedintel-msg-table">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${rowCells}</tbody>
        </table>
      `
    })
  }

  /**
   * Escape attribute values
   */
  escapeAttr(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  /**
   * Render the chat interface
   */
  render() {
    // Find or create container
    this.container = document.querySelector('.linkedintel-chat-container')

    if (!this.container) {
      // Chat tab content needs to be rendered first
      return
    }

    // Update messages
    const messagesContainer = this.container.querySelector(
      '#linkedintel-chat-messages'
    )
    if (messagesContainer) {
      messagesContainer.innerHTML = this.renderMessages()
      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    }

    // Bind event listeners
    this.bindEventListeners()
  }

  /**
   * Bind event listeners for chat interactions
   */
  bindEventListeners() {
    if (!this.container) return

    // Send button
    const sendBtn = this.container.querySelector('#linkedintel-chat-send-btn')
    const input = this.container.querySelector('#linkedintel-chat-input')

    if (sendBtn && input) {
      // Remove old listeners
      const newSendBtn = sendBtn.cloneNode(true)
      sendBtn.replaceWith(newSendBtn)

      const newInput = input.cloneNode(true)
      input.replaceWith(newInput)

      // Add new listeners
      newSendBtn.addEventListener('click', () => this.handleSendMessage())

      newInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          this.handleSendMessage()
        }
      })

      // Auto-resize textarea
      newInput.addEventListener('input', () => {
        newInput.style.height = 'auto'
        newInput.style.height = Math.min(newInput.scrollHeight, 120) + 'px'
      })
    }

    // Clear button
    const clearBtn = this.container.querySelector('.linkedintel-chat-clear-btn')
    if (clearBtn) {
      const newClearBtn = clearBtn.cloneNode(true)
      clearBtn.replaceWith(newClearBtn)
      newClearBtn.addEventListener('click', () => this.handleClearChat())
    }

    // Suggestion buttons
    const suggestions = this.container.querySelectorAll(
      '.linkedintel-chat-suggestion'
    )
    suggestions.forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = this.container.querySelector('#linkedintel-chat-input')
        if (input) {
          input.value = btn.textContent
          this.handleSendMessage()
        }
      })
    })

    // Message action buttons (copy, regenerate)
    const actionButtons = this.container.querySelectorAll(
      '.linkedintel-msg-action'
    )
    actionButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action
        const messageIndex = parseInt(btn.dataset.messageIndex)

        if (action === 'copy') {
          this.copyMessage(messageIndex)
        } else if (action === 'regenerate') {
          this.regenerateMessage(messageIndex)
        }
      })
    })

    // Code copy buttons
    const codeCopyButtons = this.container.querySelectorAll(
      '.linkedintel-code-copy'
    )
    codeCopyButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code
        this.copyToClipboard(code)

        // Show feedback
        const originalText = btn.innerHTML
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Copied!
        `
        setTimeout(() => {
          btn.innerHTML = originalText
        }, 2000)
      })
    })

    // AI Composer toggle
    const composerToggle = this.container.querySelector('.linkedintel-ai-composer-toggle')
    if (composerToggle) {
      composerToggle.addEventListener('click', () => {
        const content = this.container.querySelector('.linkedintel-ai-composer-content')
        if (content) {
          const isExpanded = content.style.display !== 'none'
          content.style.display = isExpanded ? 'none' : 'block'
          composerToggle.textContent = isExpanded ? 'Expand' : 'Collapse'
        }
      })
    }

    // AI Length buttons
    const lengthBtns = this.container.querySelectorAll('.linkedintel-ai-length-btn')
    lengthBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        lengthBtns.forEach((b) => {
          b.classList.remove('active')
          b.style.background = 'rgba(255, 255, 255, 0.1)'
          b.style.borderColor = 'rgba(255, 255, 255, 0.2)'
        })
        btn.classList.add('active')
        btn.style.background = 'rgba(255, 255, 255, 0.3)'
        btn.style.borderColor = 'rgba(255, 255, 255, 0.4)'
      })
    })

    // AI Generate button
    const generateBtn = this.container.querySelector('.linkedintel-ai-generate-btn')
    if (generateBtn) {
      generateBtn.addEventListener('click', () => this.handleAIGenerate())
    }

    // Refine button
    const refineBtn = this.container.querySelector('.linkedintel-refine-btn')
    if (refineBtn) {
      refineBtn.addEventListener('click', () => this.handleRefine())
    }
  }

  /**
   * Copy message to clipboard
   */
  async copyMessage(messageIndex) {
    const message = this.messages[messageIndex]
    if (!message) return

    await this.copyToClipboard(message.content)
    chatLogger.info('Message copied to clipboard')

    // Show feedback (you could add a toast notification here)
    const messageEl = this.container.querySelector(
      `[data-message-index="${messageIndex}"]`
    )
    if (messageEl) {
      const copyBtn = messageEl.querySelector('[data-action="copy"]')
      if (copyBtn) {
        const originalHTML = copyBtn.innerHTML
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        `
        setTimeout(() => {
          copyBtn.innerHTML = originalHTML
        }, 2000)
      }
    }
  }

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      chatLogger.error('Failed to copy to clipboard:', error)
      // Fallback method
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }

  /**
   * Regenerate a message (resend the previous user message)
   */
  async regenerateMessage(messageIndex) {
    const message = this.messages[messageIndex]
    if (!message || message.role !== 'assistant') return

    // Find the user message before this assistant message
    let userMessageIndex = -1
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (this.messages[i].role === 'user') {
        userMessageIndex = i
        break
      }
    }

    if (userMessageIndex === -1) return

    // Remove all messages after the user message
    this.messages = this.messages.slice(0, userMessageIndex + 1)

    // Re-render and send the user message again
    this.render()

    // Trigger the send with the stored user message
    const userMessage = this.messages[userMessageIndex].content

    chatLogger.info('Regenerating response for:', userMessage)

    // Show loading state
    this.isLoading = true
    requestAnimationFrame(() => {
      this.showTypingIndicator()
    })

    try {
      const context = this.buildContext()

      const response = await chrome.runtime.sendMessage({
        type: 'CHAT',
        data: {
          messages: this.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: context,
        },
      })

      this.hideTypingIndicator()

      if (response.success) {
        this.messages.push({
          role: 'assistant',
          content: response.message,
          citations: response.citations || [],
          timestamp: response.timestamp,
        })

        await this.saveChatHistory()
        this.render()
      } else {
        throw new Error(response.error || 'Failed to regenerate response')
      }
    } catch (error) {
      chatLogger.error('Regenerate error:', error)
      this.hideTypingIndicator()

      this.messages.push({
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date().toISOString(),
      })

      this.render()
    } finally {
      this.isLoading = false
    }
  }

  /**
   * Handle sending a message
   */
  async handleSendMessage() {
    const input = this.container.querySelector('#linkedintel-chat-input')
    const sendBtn = this.container.querySelector('#linkedintel-chat-send-btn')
    if (!input) return

    const message = input.value.trim()
    if (!message || this.isLoading) return

    chatLogger.info('Sending message:', message)

    // Add user message
    this.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    })

    // Clear input
    input.value = ''
    input.style.height = 'auto'

    // Show loading state with animation
    this.isLoading = true
    if (sendBtn) {
      sendBtn.classList.add('linkedintel-sending')
    }

    // Render messages (including the new user message) and then show typing indicator
    this.render()

    // Show typing indicator after DOM is ready (next frame)
    requestAnimationFrame(() => {
      this.showTypingIndicator()
    })

    try {
      // Prepare context
      const context = this.buildContext()

      // Send to backend via service worker
      const response = await chrome.runtime.sendMessage({
        type: 'CHAT',
        data: {
          messages: this.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: context,
        },
      })

      this.hideTypingIndicator()

      if (response.success) {
        // Add assistant response
        this.messages.push({
          role: 'assistant',
          content: response.message,
          citations: response.citations || [],
          timestamp: response.timestamp,
        })

        // Save history
        await this.saveChatHistory()

        // Re-render
        this.render()
      } else {
        throw new Error(response.error || 'Failed to get response')
      }
    } catch (error) {
      chatLogger.error('Chat error:', error)
      this.hideTypingIndicator()

      // Show error message
      this.messages.push({
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date().toISOString(),
      })

      this.render()
    } finally {
      this.isLoading = false
      if (sendBtn) {
        sendBtn.classList.remove('linkedintel-sending')
      }
    }
  }

  /**
   * Build context object from current LinkedIn page data
   * Optimized to send minimal context and reduce token usage
   */
  buildContext() {
    if (!this.panel.currentData) return null

    if (this.panel.pageType === 'profile') {
      const profile = this.panel.currentData.profile || {}
      const company = this.panel.currentData.company || {}

      // Extract only essential profile information
      const minimalContext = {
        type: 'profile',
        name: profile.name,
        title: profile.title,
        company: profile.company,
        location: profile.location,
        linkedinUrl: window.location.href,
      }

      // Add key highlights only
      const highlights = []

      if (profile.isCXO?.value) {
        highlights.push(
          `${profile.isCXO.level || 'Executive'} level decision maker`
        )
      }

      if (profile.decisionMakerScore) {
        highlights.push(
          `Decision maker score: ${profile.decisionMakerScore}/100`
        )
      }

      if (profile.yearsOfExperience) {
        highlights.push(`${profile.yearsOfExperience} years of experience`)
      }

      if (profile.education?.length > 0) {
        const topEd = profile.education[0]
        highlights.push(
          `Education: ${topEd.school || topEd.degree || 'Available'}`
        )
      }

      if (highlights.length > 0) {
        minimalContext.highlights = highlights.slice(0, 5) // Max 5 highlights
      }

      // Add minimal company context
      if (company.companyName) {
        minimalContext.companyInfo = {
          name: company.companyName,
          industry: company.industry,
          size: company.companySize,
          location: company.location,
        }
      }

      return minimalContext
    } else if (this.panel.pageType === 'company') {
      const data = this.panel.currentData

      // Extract only essential company information
      const minimalContext = {
        type: 'company',
        name: data.companyName,
        industry: data.industry,
        size: data.companySize,
        location: data.location,
        linkedinUrl: window.location.href,
      }

      // Add key highlights only
      const highlights = []

      if (data.description) {
        highlights.push(
          data.description.substring(0, 200) +
            (data.description.length > 200 ? '...' : '')
        )
      }

      if (data.stockInfo?.symbol) {
        highlights.push(`Public company (${data.stockInfo.symbol})`)
      }

      if (data.techStack?.length > 0) {
        highlights.push(
          `Tech stack: ${data.techStack
            .slice(0, 5)
            .map((t) => t.name)
            .join(', ')}`
        )
      }

      if (data.fundingInfo?.totalFunding) {
        highlights.push(`Funding: ${data.fundingInfo.totalFunding}`)
      }

      if (highlights.length > 0) {
        minimalContext.highlights = highlights.slice(0, 5) // Max 5 highlights
      }

      return minimalContext
    }

    return null
  }

  /**
   * Show typing indicator
   */
  showTypingIndicator() {
    const messagesContainer = this.container.querySelector(
      '#linkedintel-chat-messages'
    )
    if (!messagesContainer) return

    // Remove any existing indicator first to prevent duplicates
    const existingIndicator = messagesContainer.querySelector(
      '.linkedintel-chat-typing-indicator'
    )
    if (existingIndicator) {
      existingIndicator.remove()
    }

    const indicator = document.createElement('div')
    indicator.className = 'linkedintel-chat-typing-indicator'
    indicator.innerHTML = `
      <div class="linkedintel-chat-message linkedintel-chat-message-assistant">
        <div class="linkedintel-chat-message-avatar linkedintel-avatar-pulse">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
          </svg>
        </div>
        <div class="linkedintel-chat-message-content">
          <div class="linkedintel-chat-typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    `

    messagesContainer.appendChild(indicator)
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }

  /**
   * Hide typing indicator
   */
  hideTypingIndicator() {
    const indicator = this.container.querySelector(
      '.linkedintel-chat-typing-indicator'
    )
    if (indicator) {
      indicator.remove()
    }
  }

  /**
   * Handle clearing chat history
   */
  async handleClearChat() {
    if (confirm('Clear all chat history?')) {
      await this.clearChatHistory()
      chatLogger.info('Chat history cleared')
    }
  }

  /**
   * Initialize chat when tab is shown
   */
  initialize(container) {
    this.container = container
    this.render()
  }

  // ============================================================================
  // CHROME AI HANDLERS
  // ============================================================================

  /**
   * Handle AI message generation (Writer API)
   */
  async handleAIGenerate() {
    if (!window.chromeAI || !window.chromeAI.isAvailable('writer')) {
      chatLogger.error('Chrome AI Writer not available')
      return
    }

    const messageType = this.container.querySelector('.linkedintel-ai-message-type')?.value || 'cold-email'
    const tone = this.container.querySelector('.linkedintel-ai-message-tone')?.value || 'professional'
    const lengthBtn = this.container.querySelector('.linkedintel-ai-length-btn.active')
    const length = lengthBtn?.getAttribute('data-length') || 'short'
    const resultEl = this.container.querySelector('.linkedintel-ai-result')
    const generateBtn = this.container.querySelector('.linkedintel-ai-generate-btn')

    if (!resultEl) return

    try {
      // Show loading
      generateBtn.textContent = 'Generating...'
      generateBtn.disabled = true
      resultEl.style.display = 'none'

      // Build context
      const context = this.panel.buildContext ? this.panel.buildContext() : {}

      chatLogger.info(`Generating ${messageType} with ${tone} tone...`)

      // Generate message using Chrome AI
      const message = await window.chromeAI.generateOutreach(context, messageType, tone, length)

      // Display result
      resultEl.textContent = message
      resultEl.style.display = 'block'

      // Add copy button
      resultEl.innerHTML = `
        <div style="margin-bottom: 8px; white-space: pre-wrap;">${message}</div>
        <button class="linkedintel-ai-copy-result-btn" style="background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); color: white; border-radius: 6px; padding: 6px 12px; font-size: 11px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 4px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy to Clipboard
        </button>
      `

      // Bind copy button
      const copyBtn = resultEl.querySelector('.linkedintel-ai-copy-result-btn')
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          this.copyToClipboard(message)
          copyBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Copied!
          `
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy to Clipboard
            `
          }, 2000)
        })
      }

      chatLogger.info('Message generated successfully')
    } catch (error) {
      chatLogger.error('Error generating message:', error)
      resultEl.textContent = `Error: ${error.message}\n\nPlease try again.`
      resultEl.style.display = 'block'
    } finally {
      generateBtn.textContent = 'Generate Message'
      generateBtn.disabled = false
    }
  }

  /**
   * Handle message refinement (Rewriter API)
   */
  async handleRefine() {
    if (!window.chromeAI || !window.chromeAI.isAvailable('rewriter')) {
      chatLogger.error('Chrome AI Rewriter not available')
      return
    }

    const input = this.container.querySelector('#linkedintel-chat-input')
    if (!input || !input.value.trim()) {
      alert('Please type a message first before refining.')
      return
    }

    const originalText = input.value.trim()

    // Show refine modal
    const modal = this.createRefineModal(originalText)
    document.body.appendChild(modal)

    chatLogger.info('Refine modal opened')
  }

  /**
   * Create refine modal
   */
  createRefineModal(originalText) {
    const modal = document.createElement('div')
    modal.className = 'linkedintel-refine-modal'
    modal.innerHTML = `
      <div class="linkedintel-refine-overlay"></div>
      <div class="linkedintel-refine-content" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2); max-width: 700px; width: 90%; max-height: 80vh; overflow: hidden; z-index: 1000001;">
        <div style="padding: 20px; border-bottom: 1px solid #e2e8f0;">
          <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Refine Message</h3>
          <p style="margin: 0; font-size: 13px; color: #64748b;">Choose a tone and compare the results</p>
        </div>
        <div style="padding: 20px; max-height: calc(80vh - 180px); overflow-y: auto;">
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-size: 12px; font-weight: 600; color: #475569;">Select Tone</label>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="linkedintel-refine-tone-btn active" data-tone="more-casual" style="flex: 1; min-width: 120px; background: #8b5cf6; color: white; border: none; border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 500; cursor: pointer;">More Casual</button>
              <button class="linkedintel-refine-tone-btn" data-tone="more-formal" style="flex: 1; min-width: 120px; background: #e2e8f0; color: #475569; border: none; border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 500; cursor: pointer;">More Formal</button>
              <button class="linkedintel-refine-tone-btn" data-tone="more-concise" style="flex: 1; min-width: 120px; background: #e2e8f0; color: #475569; border: none; border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 500; cursor: pointer;">More Concise</button>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <label style="display: block; margin-bottom: 8px; font-size: 12px; font-weight: 600; color: #475569;">Original</label>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; min-height: 150px; font-size: 13px; line-height: 1.6; color: #0f172a;">${originalText}</div>
            </div>
            <div>
              <label style="display: block; margin-bottom: 8px; font-size: 12px; font-weight: 600; color: #475569;">Refined</label>
              <div class="linkedintel-refined-text" style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px; min-height: 150px; font-size: 13px; line-height: 1.6; color: #0f172a;">
                <div style="text-align: center; padding: 40px 0; color: #64748b;">Click "Refine" to see results...</div>
              </div>
            </div>
          </div>
        </div>
        <div style="padding: 16px 20px; border-top: 1px solid #e2e8f0; display: flex; gap: 12px; justify-content: flex-end;">
          <button class="linkedintel-refine-cancel-btn" style="background: #f1f5f9; color: #475569; border: none; border-radius: 8px; padding: 10px 20px; font-size: 13px; font-weight: 600; cursor: pointer;">Cancel</button>
          <button class="linkedintel-refine-action-btn" style="background: #8b5cf6; color: white; border: none; border-radius: 8px; padding: 10px 20px; font-size: 13px; font-weight: 600; cursor: pointer;">Refine</button>
          <button class="linkedintel-refine-apply-btn" style="display: none; background: #10b981; color: white; border: none; border-radius: 8px; padding: 10px 20px; font-size: 13px; font-weight: 600; cursor: pointer;">Apply Changes</button>
        </div>
      </div>
    `

    // Bind events
    setTimeout(() => {
      // Tone buttons
      const toneBtns = modal.querySelectorAll('.linkedintel-refine-tone-btn')
      toneBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          toneBtns.forEach((b) => {
            b.style.background = '#e2e8f0'
            b.style.color = '#475569'
            b.classList.remove('active')
          })
          btn.style.background = '#8b5cf6'
          btn.style.color = 'white'
          btn.classList.add('active')
        })
      })

      // Refine action
      const refineBtn = modal.querySelector('.linkedintel-refine-action-btn')
      const refinedTextEl = modal.querySelector('.linkedintel-refined-text')
      const applyBtn = modal.querySelector('.linkedintel-refine-apply-btn')
      
      refineBtn.addEventListener('click', async () => {
        const activeTone = modal.querySelector('.linkedintel-refine-tone-btn.active')
        const tone = activeTone?.getAttribute('data-tone') || 'more-casual'

        refineBtn.textContent = 'Refining...'
        refineBtn.disabled = true
        refinedTextEl.innerHTML = '<div style="text-align: center; padding: 40px 0; color: #64748b;">Refining...</div>'

        try {
          const refined = await window.chromeAI.rewriteText(originalText, tone)
          refinedTextEl.textContent = refined
          applyBtn.style.display = 'block'
          applyBtn.dataset.refined = refined
        } catch (error) {
          chatLogger.error('Error refining text:', error)
          refinedTextEl.innerHTML = `<div style="color: #ef4444;">Error: ${error.message}</div>`
        } finally {
          refineBtn.textContent = 'Refine Again'
          refineBtn.disabled = false
        }
      })

      // Apply button
      applyBtn.addEventListener('click', () => {
        const refined = applyBtn.dataset.refined
        if (refined && this.container) {
          const input = this.container.querySelector('#linkedintel-chat-input')
          if (input) {
            input.value = refined
            input.style.height = 'auto'
            input.style.height = Math.min(input.scrollHeight, 120) + 'px'
          }
        }
        modal.remove()
      })

      // Cancel button
      const cancelBtn = modal.querySelector('.linkedintel-refine-cancel-btn')
      cancelBtn.addEventListener('click', () => modal.remove())

      // Overlay click
      const overlay = modal.querySelector('.linkedintel-refine-overlay')
      overlay.addEventListener('click', () => modal.remove())
    }, 100)

    return modal
  }
}

// Export for use in insights-panel.js
window.ChatInterface = ChatInterface
