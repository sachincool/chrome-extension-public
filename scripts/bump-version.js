#!/usr/bin/env node

/**
 * Version Bumping Script for LinkedIntel Chrome Extension
 *
 * This script:
 * 1. Reads current version from manifest.json
 * 2. Increments version (patch, minor, or major)
 * 3. Updates both manifest.json and package.json
 * 4. Returns the new version
 *
 * Usage:
 *   node bump-version.js [patch|minor|major]
 *   Default: patch
 */

const fs = require('fs').promises
const path = require('path')

const EXTENSION_DIR = path.resolve(__dirname, '..')
const MANIFEST_PATH = path.join(EXTENSION_DIR, 'manifest.json')
const PACKAGE_PATH = path.join(EXTENSION_DIR, 'package.json')

function log(message) {
  console.log(`[Version] ${message}`)
}

function error(message) {
  console.error(`[Version Error] ${message}`)
}

/**
 * Parse semantic version string (e.g., "1.0.1") into components
 */
function parseVersion(versionString) {
  const parts = versionString.split('.').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${versionString}`)
  }
  return {
    major: parts[0],
    minor: parts[1],
    patch: parts[2],
  }
}

/**
 * Increment version based on bump type
 */
function incrementVersion(currentVersion, bumpType = 'patch') {
  const version = parseVersion(currentVersion)

  switch (bumpType) {
    case 'major':
      version.major += 1
      version.minor = 0
      version.patch = 0
      break
    case 'minor':
      version.minor += 1
      version.patch = 0
      break
    case 'patch':
    default:
      version.patch += 1
      break
  }

  return `${version.major}.${version.minor}.${version.patch}`
}

/**
 * Update version in manifest.json
 */
async function updateManifest(newVersion) {
  try {
    const content = await fs.readFile(MANIFEST_PATH, 'utf8')
    const manifest = JSON.parse(content)
    const oldVersion = manifest.version

    manifest.version = newVersion

    await fs.writeFile(
      MANIFEST_PATH,
      JSON.stringify(manifest, null, 2) + '\n',
      'utf8'
    )

    log(`manifest.json: ${oldVersion} → ${newVersion}`)
    return oldVersion
  } catch (err) {
    throw new Error(`Failed to update manifest.json: ${err.message}`)
  }
}

/**
 * Update version in package.json
 */
async function updatePackageJson(newVersion) {
  try {
    const content = await fs.readFile(PACKAGE_PATH, 'utf8')
    const packageJson = JSON.parse(content)
    const oldVersion = packageJson.version

    packageJson.version = newVersion

    await fs.writeFile(
      PACKAGE_PATH,
      JSON.stringify(packageJson, null, 2) + '\n',
      'utf8'
    )

    log(`package.json: ${oldVersion} → ${newVersion}`)
    return oldVersion
  } catch (err) {
    throw new Error(`Failed to update package.json: ${err.message}`)
  }
}

/**
 * Main function to bump version
 */
async function bumpVersion(bumpType = 'patch') {
  try {
    // Validate bump type
    const validTypes = ['patch', 'minor', 'major']
    if (!validTypes.includes(bumpType)) {
      throw new Error(
        `Invalid bump type: ${bumpType}. Must be one of: ${validTypes.join(', ')}`
      )
    }

    // Read current version from manifest
    const manifestContent = await fs.readFile(MANIFEST_PATH, 'utf8')
    const manifest = JSON.parse(manifestContent)
    const currentVersion = manifest.version

    if (!currentVersion) {
      throw new Error('No version found in manifest.json')
    }

    // Calculate new version
    const newVersion = incrementVersion(currentVersion, bumpType)

    log(`Bumping ${bumpType} version: ${currentVersion} → ${newVersion}`)

    // Update both files
    await updateManifest(newVersion)
    await updatePackageJson(newVersion)

    log(`✅ Version bumped successfully to ${newVersion}`)

    return newVersion
  } catch (err) {
    error(err.message)
    throw err
  }
}

// Run if called directly
if (require.main === module) {
  const bumpType = process.argv[2] || 'patch'

  bumpVersion(bumpType)
    .then((version) => {
      console.log(version) // Output just the version for piping
      process.exit(0)
    })
    .catch((err) => {
      error(`Version bump failed: ${err.message}`)
      process.exit(1)
    })
}

module.exports = { bumpVersion, incrementVersion, parseVersion }
