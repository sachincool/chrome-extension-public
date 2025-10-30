// Chrome AI Bridge - Enables ISOLATED world content scripts to access MAIN world chromeAI
// This runs in MAIN world and listens for messages from ISOLATED world

(function () {
  'use strict'

  const bridgeLogger = console // Use console directly since we're in MAIN world

  // Wait for chromeAI to be available
  const waitForChromeAI = () => {
    return new Promise((resolve) => {
      if (window.chromeAI) {
        resolve(window.chromeAI)
        return
      }

      // Poll for chromeAI (it should load quickly)
      const checkInterval = setInterval(() => {
        if (window.chromeAI) {
          clearInterval(checkInterval)
          resolve(window.chromeAI)
        }
      }, 50)

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval)
        resolve(null)
      }, 5000)
    })
  }

  // Initialize bridge
  waitForChromeAI().then((chromeAI) => {
    if (!chromeAI) {
      bridgeLogger.error('[ChromeAI Bridge] chromeAI not available')
      return
    }

    bridgeLogger.info('[ChromeAI Bridge] Initialized, listening for messages')

    // Listen for messages from ISOLATED world
    window.addEventListener('message', async (event) => {
      // Only accept messages from same origin
      if (event.source !== window) return

      const message = event.data

      // Check if this is a chromeAI bridge message
      if (!message || message.type !== 'CHROME_AI_BRIDGE_REQUEST') return

      const { method, args, requestId } = message.payload

      try {
        let result

        // Route to appropriate chromeAI method
        switch (method) {
          case 'initialize':
            result = await chromeAI.initialize()
            break

          case 'getAvailability':
            result = chromeAI.availability
            break

          case 'isAvailable':
            result = chromeAI.isAvailable(...args)
            break

          case 'getDetailedAvailability':
            result = chromeAI.getDetailedAvailability()
            break

          case 'summarize':
            result = await chromeAI.summarize(...args)
            break

          case 'summarizeText':
            result = await chromeAI.summarizeText(...args)
            break

          case 'write':
            result = await chromeAI.write(...args)
            break

          case 'rewrite':
            result = await chromeAI.rewrite(...args)
            break

          case 'proofread':
            result = await chromeAI.proofread(...args)
            break

          case 'prompt':
            result = await chromeAI.prompt(...args)
            break

          case 'streamPrompt':
            result = await chromeAI.streamPrompt(...args)
            break

          case 'createSession':
            result = await chromeAI.createSession(...args)
            break

          case 'destroySession':
            result = await chromeAI.destroySession(...args)
            break

          case 'destroyAllSessions':
            result = await chromeAI.destroyAllSessions()
            break

          case 'runDiagnostics':
            result = await chromeAI.runDiagnostics()
            break

          case 'generateOutreach':
            result = await chromeAI.generateOutreach(...args)
            break

          case 'rewriteText':
            result = await chromeAI.rewriteText(...args)
            break

          default:
            throw new Error(`Unknown method: ${method}`)
        }

        // Send success response
        window.postMessage(
          {
            type: 'CHROME_AI_BRIDGE_RESPONSE',
            payload: {
              requestId,
              success: true,
              result,
            },
          },
          '*'
        )
      } catch (error) {
        // Send error response
        window.postMessage(
          {
            type: 'CHROME_AI_BRIDGE_RESPONSE',
            payload: {
              requestId,
              success: false,
              error: {
                message: error.message,
                stack: error.stack,
              },
            },
          },
          '*'
        )
      }
    })
  })
})()

