#!/usr/bin/env node

/**
 * Production Build Script for LinkedIntel Chrome Extension
 *
 * This script:
 * 1. Replaces environment variables in source files
 * 2. Builds CSS assets
 * 3. Creates a production-ready zip file
 */

const fs = require('fs').promises
const path = require('path')
const { execSync, spawn } = require('child_process')

const EXTENSION_DIR = path.resolve(__dirname, '..')
const SERVICE_WORKER_PATH = path.join(
  EXTENSION_DIR,
  'src/background/service-worker.js'
)
const BACKUP_PATH = path.join(
  EXTENSION_DIR,
  'src/background/service-worker.js.backup'
)

async function log(message) {
  console.log(`[Build] ${message}`)
}

async function error(message) {
  console.error(`[Build Error] ${message}`)
}

async function backupServiceWorker() {
  try {
    const content = await fs.readFile(SERVICE_WORKER_PATH, 'utf8')
    await fs.writeFile(BACKUP_PATH, content)
    log('Service worker backed up')
  } catch (err) {
    throw new Error(`Failed to backup service worker: ${err.message}`)
  }
}

async function replaceEnvironmentVariables(nodeEnv = 'production') {
  try {
    let content = await fs.readFile(SERVICE_WORKER_PATH, 'utf8')

    // Replace the NODE_ENV placeholder
    content = content.replace(
      /const NODE_ENV = 'development' \/\/ BUILD_REPLACE_NODE_ENV/g,
      `const NODE_ENV = '${nodeEnv}' // BUILD_REPLACE_NODE_ENV`
    )

    await fs.writeFile(SERVICE_WORKER_PATH, content)
    log(`Environment variables replaced (NODE_ENV=${nodeEnv})`)
  } catch (err) {
    throw new Error(`Failed to replace environment variables: ${err.message}`)
  }
}

async function restoreServiceWorker() {
  try {
    const backupExists = await fs
      .access(BACKUP_PATH)
      .then(() => true)
      .catch(() => false)
    if (backupExists) {
      const content = await fs.readFile(BACKUP_PATH, 'utf8')
      await fs.writeFile(SERVICE_WORKER_PATH, content)
      await fs.unlink(BACKUP_PATH)
      log('Service worker restored from backup')
    }
  } catch (err) {
    error(`Failed to restore service worker: ${err.message}`)
  }
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: EXTENSION_DIR,
      stdio: 'inherit',
      shell: true,
      ...options,
    })

    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`Command timed out: ${command} ${args.join(' ')}`))
    }, options.timeout || 60000) // Default 60 second timeout

    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code === 0) {
        resolve()
      } else {
        reject(
          new Error(
            `Command failed with code ${code}: ${command} ${args.join(' ')}`
          )
        )
      }
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Command error: ${err.message}`))
    })
  })
}

async function buildCSS() {
  try {
    log('Building CSS assets...')

    // Build Tailwind CSS with better timeout handling
    await runCommand('npm', ['run', 'build-tailwind'], { timeout: 45000 })

    // Build components CSS
    await runCommand('npm', ['run', 'build-components'], { timeout: 15000 })

    log('CSS assets built successfully')
  } catch (err) {
    throw new Error(`Failed to build CSS: ${err.message}`)
  }
}

async function validateExtension() {
  try {
    log('Validating extension...')
    await runCommand('npm', ['run', 'validate'], { timeout: 10000 })
    log('Extension validation passed')
  } catch (err) {
    throw new Error(`Extension validation failed: ${err.message}`)
  }
}

async function createProductionZip() {
  try {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(EXTENSION_DIR, 'package.json'), 'utf8')
    )
    const version = packageJson.version
    const zipName = `linkedintel-production-v${version}.zip`

    log('Creating production zip...')

    // Create zip excluding development files
    const excludePatterns = [
      '*.git*',
      'node_modules/*',
      '*.md',
      'package-lock.json',
      'bun.lock',
      'scripts/*',
      '.claude/*',
      '*.zip',
      'src/background/service-worker.js.backup',
      'postcss.config.js',
      'tailwind.config.js',
      'src/lib/*',
      'src/shared/types/*',
      'src/shared/analytics.js',
    ]
      .map((pattern) => `-x "${pattern}"`)
      .join(' ')

    execSync(`zip -r ${zipName} . ${excludePatterns}`, {
      cwd: EXTENSION_DIR,
      stdio: 'inherit',
    })

    log(`Production zip created: ${zipName}`)
    return zipName
  } catch (err) {
    throw new Error(`Failed to create production zip: ${err.message}`)
  }
}

async function buildProduction() {
  let success = false

  try {
    log('Starting production build...')

    // Step 1: Backup original service worker
    await backupServiceWorker()

    // Step 2: Replace environment variables for production
    await replaceEnvironmentVariables('production')

    // Step 3: Build CSS assets
    await buildCSS()

    // Step 4: Validate extension
    await validateExtension()

    // Step 5: Create production zip
    const zipName = await createProductionZip()

    success = true
    log('Production build completed successfully!')
    log(`Production extension: ${zipName}`)
    log('API endpoint: configured via EXTENSION_CONFIG.API_BASE_URLS.production (default https://api.example.com)')

    return zipName
  } catch (err) {
    error(err.message)
    throw err
  } finally {
    // Always restore the original service worker
    await restoreServiceWorker()
    if (success) {
      log('Development environment restored')
    }
  }
}

// Run if called directly
if (require.main === module) {
  buildProduction().catch((err) => {
    error(`Build failed: ${err.message}`)
    process.exit(1)
  })
}

module.exports = {
  buildProduction,
  replaceEnvironmentVariables,
  restoreServiceWorker,
}
