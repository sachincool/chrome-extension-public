#!/usr/bin/env node

/**
 * Package Release Script for LinkedIntel Chrome Extension
 *
 * This script:
 * 1. Bumps the version
 * 2. Runs production build
 * 3. Creates zip with new version
 *
 * Usage:
 *   node package-release.js [patch|minor|major]
 *   Default: patch
 */

const { bumpVersion } = require('./bump-version')
const { buildProduction } = require('./build-production')

function log(message) {
  console.log(`[Release] ${message}`)
}

function error(message) {
  console.error(`[Release Error] ${message}`)
}

async function packageRelease(bumpType = 'patch') {
  try {
    log('Starting release packaging...')
    log('═'.repeat(50))

    // Step 1: Bump version
    log('Step 1: Bumping version...')
    const newVersion = await bumpVersion(bumpType)
    log(`✅ Version updated to ${newVersion}`)
    log('')

    // Step 2: Build production
    log('Step 2: Building production bundle...')
    const zipName = await buildProduction()
    log(`✅ Production build complete: ${zipName}`)
    log('')

    // Summary
    log('═'.repeat(50))
    log('🎉 Release package created successfully!')
    log(`📦 Version: ${newVersion}`)
    log(`📁 File: ${zipName}`)
    log('═'.repeat(50))
    log('')
    log('Next steps:')
    log('  1. Test the extension: Load unpacked from chrome-extension/')
    log(
      '  2. Upload to Chrome Web Store: https://chrome.google.com/webstore/devconsole'
    )
    log(
      '  3. Commit version changes: git add . && git commit -m "chore: bump version to v' +
        newVersion +
        '"'
    )
    log('')

    return { version: newVersion, zipName }
  } catch (err) {
    error(err.message)
    throw err
  }
}

// Run if called directly
if (require.main === module) {
  const bumpType = process.argv[2] || 'patch'

  packageRelease(bumpType)
    .then(() => process.exit(0))
    .catch((err) => {
      error(`Release packaging failed: ${err.message}`)
      process.exit(1)
    })
}

module.exports = { packageRelease }
