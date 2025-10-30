# LinkedIntel - AI-Powered LinkedIn Sales Intelligence

[![Chrome Built-in AI](https://img.shields.io/badge/Chrome%20Built--in%20AI-Gemini%20Nano-4285F4?logo=google-chrome&logoColor=white)](https://developer.chrome.com/docs/ai/built-in)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.20-blue.svg)](manifest.json)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/)

LinkedIntel is a Manifest V3 Chrome extension that turns LinkedIn into a sales intelligence workspace. It combines Chrome's on-device Gemini Nano APIs with optional backend enrichment to deliver prospect summaries, chat-style research, and ready-to-send outreach without sending private data to the cloud.

---

## Why LinkedIntel
- Research a LinkedIn profile or company in under a minute with an always-on summary badge.
- Ask follow-up questions or generate outreach through the built-in chat composer.
- Track Chrome AI model availability with a live status widget and onboarding assistant.
- Aggregate profile, company, and activity data into a single context service used across the UI.
- Keep data on-device by default; wire up your own backend endpoints when you need deeper intelligence.

---

## Chrome Built-in AI Integration

LinkedIntel is built around the new `window.LanguageModel` and `window.Summarizer` surfaces that ship with Chrome 138+.

### LanguageModel (Prompt API)
**Used for**
- Conversational research inside the floating chat panel.
- Personalized outreach generation and tone rewrites.
- Factual extraction of buying signals and achievements from recent posts.

**Key implementation files**
- `src/services/chrome-ai-service.js` - creates prompt sessions, tracks model availability, exposes diagnostics.
- `src/services/fact-extraction-service.js` - low-temperature prompt sessions for deterministic fact extraction.
- `src/content/chat-interface.js` - chat UI, multi-turn memory, prompt formatting helpers.
- `src/content/ai-outreach-generator.js` - SDR-friendly outreach builder backed by prompt templates.

### Summarizer API
**Used for**
- Instant profile/company key points rendered in the factual intelligence panel.
- Summary badges injected directly into LinkedIn surfaces.

**Key implementation files**
- `src/services/chrome-ai-service.js` - lazy-creates summarizer sessions with timeout handling.
- `src/content/factual-intelligence-panel.js` - renders summaries, signals, and cached results.
- `src/content/badge-injector.js` - attaches summary affordances to supported LinkedIn layouts.

### Runtime Bridge
Manifest V3 content scripts execute in the isolated world, while Chrome AI requires the main world. LinkedIntel ships a two-part bridge:
- `src/services/chrome-ai-service.js` (main world) exposes `window.chromeAI`.
- `src/services/chrome-ai-bridge.js` relays method calls from the isolated world.
- `src/services/chrome-ai-proxy.js` provides a promise-based proxy so the rest of the codebase can call `window.chromeAI.*` transparently.

Run `window.testChromeAI()` in DevTools on a LinkedIn page to see the built-in diagnostics helper.

---

## Architecture at a Glance

| Layer | What Runs Here | Benefits |
| --- | --- | --- |
| **On-Device (Chrome Built-in AI)** | Summaries, chat, outreach generation, factual extraction | Fast responses, offline capability, private by default |
| **Browser APIs** | Manifest V3 service worker, storage, identity, notifications | Modern extension foundation with background orchestration |
| **Optional Backend** | Company enrichment, analytics, advanced scoring (`background/service-worker.js`) | Extend intelligence depth when you control a server |

`background/service-worker.js` already contains hooks for API calls, GA4 event tracking, caching, and an OAuth flow. All secrets are deliberately omitted so the public build stays self-contained.

---

## Feature Highlights
- **Summary Badge** (`src/content/badge-injector.js`): Adds a quick-insight badge on supported LinkedIn profile and company pages.
- **Factual Intelligence Panel** (`src/content/factual-intelligence-panel.js`): Combines summarizer output, scraped facts, and buying signals.
- **AI Chat & Composer** (`src/content/chat-interface.js`): Multi-turn conversations, tone controls, and ready-to-send outreach built on LanguageModel.
- **AI Outreach Generator** (`src/content/ai-outreach-generator.js`): Re-usable helper for SDR-style intros driven by the unified context.
- **Unified Context Service** (`src/services/unified-context-service.js`): Central cache that merges DOM scraping, AI output, and optional backend data for consistent prompts.
- **Fact Extraction Service** (`src/services/fact-extraction-service.js`): Deterministic prompts that convert LinkedIn posts into structured JSON.
- **AI Status Indicator** (`src/content/ai-status-indicator.js`): Visualizes model readiness (readily / downloadable / downloading) for the Prompt and Summarizer APIs.
- **First-Run Onboarding** (`src/content/ai-onboarding.js`): Guides users through enabling Chrome AI flags and downloading Gemini Nano.

---

## Getting Started

### Prerequisites
- Chrome 138 or later (Chrome Canary recommended while the APIs are in preview).
- ~22 GB free disk space and a supported GPU for Gemini Nano downloads.
- Node.js 18+ and npm 9+ to build Tailwind and PostCSS assets.

### Enable Chrome AI (once per machine)
1. Navigate to each flag in Chrome and set it to **Enabled**:
   - `chrome://flags/#optimization-guide-on-device-model`
   - `chrome://flags/#prompt-api-for-gemini-nano`
   - `chrome://flags/#summarization-api-for-gemini-nano`
   - `chrome://flags/#translation-api`
   - `chrome://flags/#language-detection-api`
2. Restart Chrome completely.
3. (Optional) Open `chrome://on-device-internals` to monitor download progress.

### Install the Extension
```bash
git clone https://github.com/linkedintel/chrome-extension-public-clean.git
cd chrome-extension-public-clean
npm install
npm run build-css
```

Then load the folder as an unpacked extension:
1. Visit `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the repository directory.

### Verify Your Setup
1. Open a LinkedIn profile such as `https://www.linkedin.com/company/google`.
2. Wait for the status indicator to report model availability.
3. Click the summary badge to confirm the Summarizer API works.
4. Open the LinkedIntel panel (floating action button) and ask a question in the chat tab to exercise the Prompt API.
5. In DevTools, run:
   ```javascript
   await window.LanguageModel.availability();
   await window.Summarizer?.availability();
   await window.testChromeAI(); // detailed diagnostics helper
   ```

---

## npm Scripts
- `npm run build-css` - Build Tailwind (`src/styles/output.css`) and component styles.
- `npm run build-production` - Package the extension into `dist/` with fresh styles.
- `npm run clean` - Remove build artifacts and archived zips.
- `npm test` - Stub entry that exercises manifest permission checks.
- `npm run release` - Bump version and create a zip package (supports `patch|minor|major`).

---

## Project Structure

```
chrome-extension-public-clean/
├── icons/                         # Extension icons served via web_accessible_resources
├── manifest.json                  # Manifest V3 definition and placeholder OAuth settings
├── popup.html / popup.js / popup.css
├── scripts/                       # Build and release utilities (Node.js)
├── src/
│   ├── background/
│   │   └── service-worker.js      # Alarms, storage, analytics, optional backend orchestration
│   ├── content/
│   │   ├── ai-onboarding.js       # Chrome AI setup wizard
│   │   ├── ai-outreach-generator.js
│   │   ├── ai-status-indicator.js
│   │   ├── badge-injector.js
│   │   ├── chat-interface.js
│   │   ├── factual-intelligence-panel.js
│   │   ├── linkedin-detector.js
│   │   ├── linkedin-posts-scraper.js
│   │   ├── sdr-insights-panel.js
│   │   └── styles/                # Generated CSS included in content scripts
│   ├── services/
│   │   ├── chrome-ai-bridge.js    # Main-world bridge for Chrome AI
│   │   ├── chrome-ai-proxy.js     # Isolated-world proxy that forwards calls
│   │   ├── chrome-ai-service.js   # Core wrapper around LanguageModel & Summarizer
│   │   ├── fact-extraction-service.js
│   │   └── unified-context-service.js
│   └── shared/
│       └── logger.js              # Lightweight namespaced logger used across modules
├── tailwind.config.js / postcss.config.js
├── tests/                         # Smoke-test scaffolding, grouped by area
└── README.md                      # You are here
```

---

## Privacy & Security
- Chrome Built-in AI processing happens entirely on-device; no prompts or summaries leave the browser.
- All network endpoints in `manifest.json` and `background/service-worker.js` are placeholders. Replace them if you connect your own backend.
- Chrome Identity OAuth keys, GA4 secrets, and other credentials are intentionally omitted from the public repository.
- Local storage is used for lightweight caching and analytics session data; nothing is persisted outside Chrome's sandbox.

---

## Contributing
Contributions are welcome. Please open an issue or pull request if you:
- Discover a regression with the latest Chrome AI preview.
- Extend the backend integrations and want to share configuration tips.
- Improve UX flows such as onboarding or the status indicator.

Standard workflow:
```bash
git checkout -b feature/my-update
# make changes
git commit -am "Describe your change"
git push origin feature/my-update
```

---

## License
Licensed under the [MIT License](LICENSE). Feel free to fork, adapt, and extend LinkedIntel for your own LinkedIn workflows.
