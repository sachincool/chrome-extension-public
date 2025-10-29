# LinkedIntel Setup Guide

Complete setup instructions for the LinkedIntel Chrome Extension with Chrome Built-in AI features.

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Chrome Setup](#chrome-setup)
3. [Extension Installation](#extension-installation)
4. [Chrome AI Configuration](#chrome-ai-configuration)
5. [Verification & Testing](#verification--testing)
6. [Troubleshooting](#troubleshooting)
7. [Optional Backend Setup](#optional-backend-setup)

---

## System Requirements

### Minimum Requirements

- **Operating System**: 
  - Windows 10/11
  - macOS 11 (Big Sur) or later
  - Linux (Ubuntu 20.04+ or equivalent)
  
- **Chrome Version**: 
  - Chrome 127 or later
  - Chrome Dev (recommended): [Download Chrome Dev](https://www.google.com/chrome/dev/)
  - Chrome Canary (bleeding edge): [Download Chrome Canary](https://www.google.com/chrome/canary/)

- **Hardware**:
  - 4GB RAM minimum (8GB+ recommended)
  - 2GB free disk space (for Gemini Nano model)
  - Internet connection (for initial model download)

- **Software**:
  - Node.js 18+ ([Download Node.js](https://nodejs.org/))
  - npm 9+ (comes with Node.js)
  - Git (optional, for cloning)

---

## Chrome Setup

### Step 1: Install Chrome Dev or Canary

While Chrome Built-in AI features are available in Chrome 127+, we recommend using Chrome Dev or Canary for the best experience with the latest features.

**Chrome Dev** (Recommended):
- Stable enough for daily use
- Gets new features 1-2 weeks before stable Chrome
- Download: https://www.google.com/chrome/dev/

**Chrome Canary** (Bleeding Edge):
- Latest experimental features
- Updated daily
- May have bugs
- Download: https://www.google.com/chrome/canary/

### Step 2: Verify Chrome Version

1. Open Chrome
2. Navigate to: `chrome://version`
3. Check **Google Chrome** version is **127 or higher**
4. Note your version for troubleshooting

---

## Extension Installation

### Method 1: From Source (Recommended for Judges/Developers)

1. **Clone or Download Repository**

```bash
# Clone with Git
git clone https://github.com/linkedintel/linkedintel-extension.git
cd linkedintel-extension/chrome-extension-public

# OR download ZIP from GitHub and extract
```

2. **Install Dependencies**

```bash
npm install
```

Expected output:
```
added 47 packages, and audited 48 packages in 3s
```

3. **Build CSS Assets**

```bash
npm run build-css
```

This compiles Tailwind CSS and PostCSS. You should see:
```
> build-css
> npm run build-tailwind && npm run build-components

Done in 234ms
```

4. **Verify Build**

Check that these files exist:
- `src/styles/output.css`
- `src/styles/components.min.css`

### Method 2: From Release Package (Coming Soon)

Download the latest release `.zip` from GitHub releases and extract it.

---

## Chrome AI Configuration

This is the **most critical step** for enabling Chrome Built-in AI features.

### Step 1: Enable Chrome Flags

Open each flag URL in Chrome and set to **Enabled**:

#### 1. Optimization Guide On-Device Model
- **URL**: `chrome://flags/#optimization-guide-on-device-model`
- **Setting**: **Enabled BypassPerfRequirement**
- **Purpose**: Enables on-device AI models

#### 2. Prompt API for Gemini Nano
- **URL**: `chrome://flags/#prompt-api-for-gemini-nano`
- **Setting**: **Enabled**
- **Purpose**: Enables Prompt API (conversational AI)

#### 3. Summarization API for Gemini Nano
- **URL**: `chrome://flags/#summarization-api-for-gemini-nano`
- **Setting**: **Enabled**
- **Purpose**: Enables Summarizer API

#### 4. Writer API for Gemini Nano
- **URL**: `chrome://flags/#writer-api-for-gemini-nano`
- **Setting**: **Enabled**
- **Purpose**: Enables Writer API (content generation)

#### 5. Rewriter API for Gemini Nano
- **URL**: `chrome://flags/#rewriter-api-for-gemini-nano`
- **Setting**: **Enabled**
- **Purpose**: Enables Rewriter API (tone adjustment)

#### 6. Language Detection API (Optional)
- **URL**: `chrome://flags/#language-detection-api`
- **Setting**: **Enabled**
- **Purpose**: Enhances text analysis

### Step 2: Restart Chrome

**CRITICAL**: After enabling flags, you **must restart Chrome** for changes to take effect.

1. Close all Chrome windows
2. Quit Chrome completely (check system tray/dock)
3. Reopen Chrome

**Alternative**: Click the "Relaunch" button at the bottom of any flag page.

### Step 3: Verify Flags Are Active

1. Revisit each flag URL
2. Confirm all show **Enabled** (with blue highlight)
3. If any are still "Default", re-enable and restart again

---

## Extension Installation in Chrome

### Step 1: Enable Developer Mode

1. Open Chrome
2. Navigate to: `chrome://extensions`
3. Toggle **Developer mode** (top-right corner) to **ON**

You should now see three buttons: "Load unpacked", "Pack extension", "Update"

### Step 2: Load Extension

1. Click **Load unpacked**
2. Navigate to the `chrome-extension-public` folder (or wherever you extracted/cloned)
3. Select the folder and click **Select Folder** / **Open**

### Step 3: Verify Installation

You should see the LinkedIntel extension card with:
- ✅ Green "On" toggle
- Extension name: "LinkedIn Sales Intelligence - Lead Research"
- Version: 1.0.13
- No errors displayed

**If you see errors**:
- Check that all files were built: `npm run build-css`
- Verify `manifest.json` exists in the folder
- Check console for specific error messages

### Step 4: Pin Extension (Optional)

1. Click the puzzle piece icon (🧩) in Chrome toolbar
2. Find "LinkedIn Sales Intelligence"
3. Click the pin icon to keep it visible

---

## Verification & Testing

### Test 1: Check AI API Availability

1. Open Chrome DevTools (F12 or Right-click → Inspect)
2. Go to **Console** tab
3. Paste and run each command:

```javascript
// Test Prompt API
await chrome.ai.languageModel.capabilities()
// Should return: {available: "readily"} or {available: "after-download"}

// Test Summarizer API
await chrome.ai.summarizer.capabilities()
// Should return: {available: "readily"} or {available: "after-download"}

// Test Writer API
await chrome.ai.writer.capabilities()
// Should return: {available: "readily"} or {available: "after-download"}

// Test Rewriter API
await chrome.ai.rewriter.capabilities()
// Should return: {available: "readily"} or {available: "after-download"}
```

**Expected Results**:
- `available: "readily"` → Model downloaded, ready to use ✅
- `available: "after-download"` → Model will download on first use ⏳
- `available: "no"` → API not available, check flags ❌

### Test 2: Trigger Model Download

If APIs show `"after-download"`:

1. Visit any LinkedIn page: https://www.linkedin.com/company/anthropic-ai
2. Wait for extension to load
3. Click **AI Status** indicator in the LinkedIntel panel
4. Model download will start automatically (~1.5GB, 2-5 minutes)
5. Progress shown in AI Status dashboard

**Alternative Manual Trigger**:

```javascript
// Force download
const session = await chrome.ai.languageModel.create();
await session.prompt("Hello");
```

Monitor download in `chrome://components` → Look for "Optimization Guide On Device Model"

### Test 3: Test Extension Features

#### A. Quick Summary Feature (Summarizer API)

1. Visit: https://www.linkedin.com/company/google
2. Look for **"Quick Summary"** badge (top-right of company header)
3. Click the badge
4. Wait 2-3 seconds
5. Should see 3-bullet summary tooltip

**Expected**: Instant summary with bullets, green shield icon "Generated on-device"

#### B. Chat Interface (Prompt API)

1. On any LinkedIn profile/company page
2. Click the floating **LinkedIntel** button (bottom-right)
3. Go to **Chat** tab
4. Type: "Tell me about this company"
5. Press Enter or click Send

**Expected**: AI response within 2-3 seconds, context-aware answer

#### C. AI Status Dashboard

1. Open LinkedIntel panel
2. Scroll to bottom
3. Look for **"Chrome AI: X/5 active"** section
4. Click to expand
5. Should show all 5 APIs with status (Ready/Download Required/Unavailable)

**Expected**: All 5 APIs showing **"Ready"** status with green checkmarks

---

## Troubleshooting

### Issue 1: "Chrome AI Unavailable" Message

**Symptoms**: Extension shows warning that Chrome AI is not available

**Solutions**:

1. **Check Chrome Version**
   - Navigate to `chrome://version`
   - Must be 127+
   - Upgrade to Chrome Dev/Canary if needed

2. **Verify Flags**
   - Revisit all flag URLs listed above
   - Ensure all are **Enabled**
   - Restart Chrome completely

3. **Check Platform Compatibility**
   - Chrome AI currently works on: Windows 10/11, macOS 11+, Ubuntu 20.04+
   - Not yet available on: ChromeOS, Android (coming soon)

4. **Try Incognito Mode**
   - Sometimes regular mode has conflicts
   - Open extension in incognito (must allow in extension settings)

### Issue 2: Model Not Downloading

**Symptoms**: APIs stuck on "after-download", never become "readily"

**Solutions**:

1. **Check Disk Space**
   - Need ~2GB free for Gemini Nano
   - Check available space on system drive

2. **Check Internet Connection**
   - Model downloads from Google servers
   - Requires stable connection (2-5 minutes)

3. **Force Download Manually**
   ```javascript
   // In DevTools console
   const session = await chrome.ai.languageModel.create();
   console.log("Download started");
   ```

4. **Monitor Download Progress**
   - Go to: `chrome://components`
   - Find "Optimization Guide On Device Model"
   - Click "Check for update"
   - Watch status change to "Updating..."

5. **Clear Component Cache**
   - Go to: `chrome://components`
   - Find "Optimization Guide On Device Model"
   - Click "Remove" (if present)
   - Restart Chrome
   - Try download again

### Issue 3: Extension Not Loading on LinkedIn

**Symptoms**: Extension loads but doesn't inject features on LinkedIn pages

**Solutions**:

1. **Check Permissions**
   - Go to: `chrome://extensions`
   - Find LinkedIntel
   - Click "Details"
   - Scroll to "Site access"
   - Should show "On linkedin.com"

2. **Refresh LinkedIn**
   - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   - Clear cache for linkedin.com

3. **Check Console Errors**
   - Open DevTools (F12)
   - Look for errors in Console tab
   - Common issues: CSP violations, script load failures

4. **Disable Conflicting Extensions**
   - Temporarily disable other LinkedIn extensions
   - Test if LinkedIntel works alone
   - Re-enable one by one to find conflict

### Issue 4: AI Features Slow or Unresponsive

**Symptoms**: AI responses take >10 seconds or timeout

**Solutions**:

1. **Check System Resources**
   - AI processing is CPU/RAM intensive
   - Close unnecessary tabs/apps
   - Minimum 4GB RAM available

2. **Verify Model Fully Downloaded**
   - Check `chrome://components`
   - "Optimization Guide On Device Model" should show version, not "Checking..."

3. **Clear Extension Cache**
   ```javascript
   // In DevTools console
   chrome.storage.local.clear()
   ```
   - Reload extension
   - Retry AI feature

4. **Recreate AI Sessions**
   ```javascript
   // In DevTools console
   if (window.chromeAI) {
     window.chromeAI.destroySessions();
     await window.chromeAI.initialize();
   }
   ```

### Issue 5: Manifest Errors

**Symptoms**: Extension shows "Manifest errors" in chrome://extensions

**Solutions**:

1. **Rebuild Assets**
   ```bash
   npm run clean
   npm install
   npm run build-css
   ```

2. **Check File Structure**
   - Verify all files referenced in `manifest.json` exist
   - Check `src/` folder has all content scripts

3. **Validate JSON**
   - Open `manifest.json` in editor
   - Check for syntax errors (trailing commas, missing quotes)
   - Use JSON validator: https://jsonlint.com/

### Issue 6: "Origin Trial Token" Errors

**Symptoms**: Console shows origin trial warnings

**Solution**: These are non-blocking warnings. Extension will work without origin trial tokens.

To suppress (optional):
1. Obtain origin trial token from: https://developer.chrome.com/origintrials/
2. Add to `manifest.json` → `trial_tokens` array
3. Reload extension

---

## Optional Backend Setup

The extension includes a hybrid architecture with optional backend for deep intelligence features.

### Public Build (Default)

The public build works **standalone** without backend:
- All Chrome AI features work locally
- Backend intelligence features disabled
- No API calls except for model downloads

### Full Backend Setup

To enable backend features (company tech stack, funding data, etc.):

1. **Navigate to Backend Folder**
   ```bash
   cd ../backend
   ```

2. **Follow Backend Setup**
   See: [backend/README.md](../backend/README.md)

3. **Configure API Endpoint**
   - Edit `src/background/service-worker.js`
   - Update `EXTENSION_CONFIG.API_BASE_URLS.production`
   - Set to your backend URL (default: `http://localhost:8080`)

4. **Reload Extension**
   - Go to `chrome://extensions`
   - Click reload icon on LinkedIntel extension

**Note**: Backend is NOT required for Chrome AI features to work. Only needed for advanced intelligence features.

---

## Advanced Configuration

### Enable Debug Logging

See detailed logs for troubleshooting:

1. **Enable Extension Logging**
   ```javascript
   // In DevTools console
   localStorage.setItem('linkedintel_log_level', 'debug')
   ```

2. **Reload Extension**
   - Go to `chrome://extensions`
   - Click reload

3. **View Logs**
   - Open DevTools (F12)
   - Filter console by "LinkedIntel"

### Performance Tuning

Adjust AI session settings for better performance:

```javascript
// In chrome-ai-service.js, adjust defaults:

// Summarizer - faster but less detailed
{
  type: 'key-points',  // vs 'tl;dr', 'teaser', 'headline'
  length: 'short',     // vs 'medium', 'long'
}

// Writer - balance quality vs speed
{
  length: 'medium',    // vs 'short', 'long'
  tone: 'neutral',     // less processing than 'formal'
}
```

### Custom Chrome AI Settings

Test different configurations in DevTools:

```javascript
// Custom Summarizer
const summarizer = await chrome.ai.summarizer.create({
  type: 'tl;dr',
  format: 'plain-text',
  length: 'short'
});

const summary = await summarizer.summarize("Long text here...");
console.log(summary);

// Custom Writer with context
const writer = await chrome.ai.writer.create({
  tone: 'formal',
  length: 'medium',
  sharedContext: 'Writing a professional email to a CEO'
});

const text = await writer.write("Draft an introduction");
console.log(text);
```

---

## Verification Checklist

Use this checklist to verify complete setup:

- [ ] Chrome Dev/Canary 127+ installed
- [ ] All 5 Chrome flags enabled
- [ ] Chrome restarted after enabling flags
- [ ] Node.js 18+ installed
- [ ] Extension dependencies installed (`npm install`)
- [ ] CSS assets built (`npm run build-css`)
- [ ] Extension loaded in `chrome://extensions`
- [ ] No manifest errors showing
- [ ] Developer mode enabled
- [ ] API capabilities tested in console (all 5 APIs)
- [ ] Gemini Nano model downloaded (or downloading)
- [ ] Extension visible on LinkedIn pages
- [ ] Quick Summary badge visible on profiles
- [ ] Chat interface opens and responds
- [ ] AI Status shows 5/5 active
- [ ] No console errors in DevTools

---

## Getting Help

### Resources

- **Chrome AI Documentation**: https://developer.chrome.com/docs/ai/built-in
- **GitHub Issues**: https://github.com/linkedintel/linkedintel-extension/issues
- **Chrome Extensions Guide**: https://developer.chrome.com/docs/extensions/
- **DevPost Challenge**: https://googlechromeai2025.devpost.com/

### Community

- Check GitHub Discussions for common issues
- Review Chrome AI samples: https://github.com/GoogleChromeLabs/chrome-extensions-samples

### Debugging Tips

1. **Always check DevTools Console first** - Most issues logged there
2. **Verify flags after restart** - Chrome sometimes resets flags
3. **Test in incognito** - Eliminates extension conflicts
4. **Check chrome://components** - Shows model download status
5. **Review manifest.json** - Common source of errors

---

## Notes for Judges

### Quick Test Path (5 minutes)

1. Install Chrome Dev: https://www.google.com/chrome/dev/
2. Enable 5 flags (listed above) → Restart
3. Load extension → `chrome://extensions` → Load unpacked → Select folder
4. Visit: https://www.linkedin.com/company/google
5. Click "Quick Summary" badge (top-right)
6. Open LinkedIntel panel → Chat tab → Ask: "What does this company do?"
7. Check AI Status → Should show 5/5 APIs active

**First use triggers model download** - Please allow 2-5 minutes for Gemini Nano to download (~1.5GB).

### Key Demo Points

- **Summarizer API**: Quick Summary badge on profiles
- **Prompt API**: Chat interface with context awareness
- **Writer API**: Message composition (in Chat tab)
- **Rewriter API**: Tone adjustment (in Chat tab)
- **Proofreader API**: Grammar checking (automatic in inputs)
- **Hybrid Architecture**: Toggle backend features on/off

---

**Setup complete!** 🎉 You're ready to use LinkedIntel with Chrome Built-in AI.

For the full feature list and usage guide, see [README.md](README.md).

