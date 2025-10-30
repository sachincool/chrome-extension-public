# LinkedIntel Backend – Hybrid AI Intelligence Layer

> **Part of:** Google Chrome Built-in AI Challenge 2025 Submission  
> **Category:** Best Hybrid AI Application - Chrome Extension  
> **Purpose:** Deep intelligence that complements Chrome's Built-in AI

This backend provides the "server-side intelligence" half of LinkedIntel's hybrid architecture. While Chrome's Built-in AI (Gemini Nano) handles instant, private tasks on-device, this backend delivers comprehensive data that on-device models cannot access.

---

## 🎯 Why a Backend? (Hybrid Architecture Rationale)

### What Chrome Built-in AI Does Well ✨
- **Instant summaries** (Summarizer API) – 3-bullet insights in <2 seconds
- **Smart chat** (Prompt API) – Context-aware Q&A with conversation history
- **Message composition** – Personalized outreach with tone control
- **Grammar checking** – Prompt-driven corrections

**Benefits**: Private, fast, offline-capable, no rate limits

### What Requires a Backend 🧠
- **Tech Stack Analysis** – 200+ technology categories (AWS, Salesforce, etc.)
- **Funding & Financial Data** – Rounds, valuations, revenue estimates
- **Executive Contact Discovery** – Real decision makers with LinkedIn URLs
- **Buying Signals** – Hiring spikes, budget cycles, tech refresh timing
- **Real-Time Intelligence** – News, sentiment, competitive insights

**Benefits**: Comprehensive data, external sources, complex analysis

### The Hybrid Advantage 🏆
| Feature | Chrome AI Only | Backend Only | **Hybrid (LinkedIntel)** |
|---------|----------------|--------------|---------------------------|
| Speed | ⚡ Instant | 🐌 2-5s | ⚡ Instant core + fast deep |
| Privacy | 🔒 Perfect | ❌ Data sent | 🔒 Sensitive on-device |
| Offline | ✅ Yes | ❌ No | ✅ Core features work |
| Intelligence | ⚠️ Limited | ✅ Comprehensive | ✅ **Best of both** |

**Result**: Cloud-level intelligence with on-device privacy and speed.

---

## 🛠️ Technology Stack

- **Runtime**: Node.js 18+ (or Bun for faster performance)
- **Framework**: Express.js
- **AI/Data APIs**: Perplexity AI, Sumble API (tech stack data)
- **Database**: Supabase (PostgreSQL) – **optional for demo**
- **Caching**: Two-tier (L1 memory + L2 database)
- **Architecture**: RESTful API with micro-prompt orchestration

---

## 📦 Quick Start

### Prerequisites
- Node.js 18+ or Bun runtime
- API keys (see Setup below)
- ~100MB disk space

### Installation

1. **Clone & Navigate**
   ```bash
   cd chrome-extension-public-clean/backend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   # or with Bun (faster):
   # bun install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

4. **Start Server**
   ```bash
   npm start
   # or with Bun:
   # bun run dev
   ```

5. **Verify Health**
   ```bash
   curl http://localhost:8080/health
   ```

---

## 🔑 API Keys Setup

### Required: Perplexity AI
**Why**: Powers real-time company intelligence, news, and financial data

1. Sign up: https://www.perplexity.ai/
2. Navigate to API settings
3. Create new API key
4. Add to `.env`:
   ```bash
   PERPLEXITY_API_KEY=pplx-xxxxx
   ```

### Optional: Sumble API
**Why**: Provides verified tech stack data (200+ categories) and executive contacts

1. Sign up: https://sumble.com/
2. Get API key from dashboard
3. Add to `.env`:
   ```bash
   SUMBLE_API_KEY=your_sumble_key
   ```

**Note**: Backend works without Sumble (falls back to Perplexity only), but data quality is better with both.

### Optional: Supabase Database
**Why**: Enables persistent caching across server restarts (demo works without it)

1. Create free project: https://supabase.com/
2. Get URL and service role key from Settings → API
3. Add to `.env`:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SECRET_KEY=your_service_role_key
   ```

**Note**: Without Supabase, server uses memory-only caching (lost on restart).

---

## 📡 API Endpoints

### Health Check
```bash
GET /health
```
Returns server status and API availability.

### Company Analysis
```bash
POST /analyze/company
Content-Type: application/json

{
  "companyName": "Anthropic",
  "companyUrl": "https://www.linkedin.com/company/anthropic-ai"
}
```

Returns:
- Tech stack (AWS, Python, PostgreSQL, etc.)
- Funding rounds and valuation
- Growth events
- Buying signals
- Priority contacts

### Person Analysis
```bash
POST /analyze/person
Content-Type: application/json

{
  "fullName": "Dario Amodei",
  "title": "CEO & Co-Founder",
  "profileUrl": "https://www.linkedin.com/in/darioamodei",
  "companyName": "Anthropic"
}
```

Returns:
- Decision maker scoring
- Recent activity
- Conversation hooks
- Pain points
- Influence network

### Cache Stats
```bash
GET /analyze/cache/stats
```

Returns cache hit rates and performance metrics.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│  Chrome Extension (Frontend)            │
│  • Chrome Built-in AI (Prompt, Summ.)  │
│  • Instant summaries, chat, writing     │
│  • 100% on-device processing            │
└──────────────┬──────────────────────────┘
               │ HTTPS API calls
               ▼
┌─────────────────────────────────────────┐
│  Backend Intelligence Layer              │
│  ├─ Routes (analysis, health, enrich)   │
│  ├─ Orchestrator (7-stage pipeline)     │
│  ├─ Services (Perplexity, Sumble)       │
│  ├─ Cache (L1 memory + L2 database)     │
│  └─ Prompts (micro-prompt templates)    │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌─────────────┐  ┌──────────────┐
│ Perplexity  │  │  Sumble API  │
│     AI      │  │  (B2B data)  │
└─────────────┘  └──────────────┘
```

### 7-Stage Analysis Pipeline

For company/person analysis, the orchestrator runs 7 micro-prompts in parallel:

1. **Stock Info** – Market data, financials (public companies)
2. **Recent News** – AI-curated headlines with sentiment
3. **Growth Events** – Funding, acquisitions, layoffs
4. **Tech Stack** – Verified technologies from Sumble API
5. **Contacts** – Executive team with decision-making authority
6. **Buying Signals** – Timing indicators for outreach
7. **Fit Score** – AI-powered opportunity assessment

Each stage has its own optimized prompt and data source, results are combined and cached.

---

## 🔒 Privacy & Data Handling

### What This Backend Does NOT Do
- ❌ Store user profiles or authentication (no login system)
- ❌ Track user behavior or analytics
- ❌ Access LinkedIn credentials or sessions
- ❌ Share data with third parties
- ❌ Retain searches beyond cache TTL (24 hours)

### What It Does
- ✅ Cache analysis results for 24 hours (performance optimization)
- ✅ Call external APIs (Perplexity, Sumble) with company/person data
- ✅ Log errors for debugging (no PII)
- ✅ Operate as stateless REST API

**Note**: This is a hackathon demo backend. For production use, add authentication, rate limiting, and usage tracking.

---

## 🧪 Testing

### Manual Testing
```bash
# Health check
curl http://localhost:8080/health

# Analyze a company
curl -X POST http://localhost:8080/analyze/company \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Anthropic", "companyUrl": "https://www.linkedin.com/company/anthropic-ai"}'

# Check cache stats
curl http://localhost:8080/analyze/cache/stats
```

### Expected Response Time
- Health check: <50ms
- Company analysis (cache miss): 5-8 seconds
- Company analysis (cache hit): <100ms
- Person analysis (cache miss): 4-6 seconds

---

## 🚀 Deployment (Optional)

This backend can run anywhere:
- **Local**: `npm start` (for development)
- **VPS**: Ubuntu/Debian server with PM2 or systemd
- **Platform**: Fly.io, Railway, Render, Heroku
- **Serverless**: Vercel, Netlify Functions (with cold start caveats)

For hackathon demo, **local deployment is sufficient**.

---

## 📁 Project Structure

```
backend/
├── README.md                  # This file
├── .env.example               # Environment template
├── .gitignore                 # Excludes .env, node_modules
├── package.json               # Dependencies
├── app.js                     # Entry point
├── instrument.js              # Optional error tracking
└── src/
    ├── config/
    │   └── index.js           # Environment config
    ├── middleware/
    │   ├── cors.js            # CORS configuration
    │   ├── validation.js      # Request validation
    │   └── index.js           # Middleware exports
    ├── routes/
    │   ├── analysis.js        # Company/person analysis
    │   ├── health.js          # Health checks
    │   ├── factEnrichment.js  # Signal enrichment
    │   └── index.js           # Route mounting
    ├── services/
    │   ├── microPromptOrchestrator.js  # 7-stage pipeline
    │   ├── perplexityService.js        # Perplexity AI calls
    │   ├── sumbleService.js            # Sumble API calls
    │   ├── cacheService.js             # Two-tier caching
    │   ├── supabaseService.js          # Optional DB (stub if not configured)
    │   └── index.js                    # Service exports
    ├── prompts/
    │   └── microPrompts.js    # AI prompt templates
    ├── schemas/
    │   └── analysisSchemas.js # Response validation
    └── utils/
        └── logger.js          # Logging utility
```

---

## 🐛 Troubleshooting

### Server won't start
- ✅ Check Node.js version: `node --version` (need 18+)
- ✅ Check port 8080 is available: `lsof -i :8080`
- ✅ Verify .env file exists: `ls -la .env`

### "API key missing" error
- ✅ Copy `.env.example` to `.env`
- ✅ Add your Perplexity API key
- ✅ Restart server after updating .env

### "No data returned" in analysis
- ✅ Check API key is valid (test on Perplexity dashboard)
- ✅ Check network connectivity
- ✅ Check server logs for detailed error

### Database connection error
- ℹ️ Supabase is **optional** for demo – backend works without it
- ✅ If using Supabase, verify URL and key in .env
- ✅ Test connection: `curl "$SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_SECRET_KEY"`

---

## 🏆 Hackathon Submission Notes

### What Makes This "Hybrid"?
This backend demonstrates **clear necessity** for server-side intelligence:
1. **Tech Stack Data** – Requires external B2B databases (Sumble API)
2. **Real-Time News** – Requires web search and scraping (Perplexity AI)
3. **Executive Contacts** – Requires verified data sources
4. **Complex Analysis** – Multi-stage orchestration beyond on-device models

### Why Not Pure Chrome AI?
- ❌ Gemini Nano has no internet access (can't get real-time data)
- ❌ On-device models can't query specialized B2B databases
- ❌ Tech stack detection requires proprietary data sources
- ❌ Financial data requires market data feeds

### Why Not Pure Cloud AI?
- ❌ Sends all LinkedIn profile data to servers (privacy concern)
- ❌ 2-5 second latency for every interaction
- ❌ Doesn't work offline
- ❌ API quota costs add up quickly

**Hybrid = Best of Both Worlds** ✅

---

## 📄 License

MIT License – see parent repository for details.

---

## 🙏 Credits

- **Perplexity AI** for real-time intelligence API
- **Sumble** for B2B tech stack data
- **Supabase** for optional database layer
- **Google Chrome Team** for Built-in AI APIs & Gemini Nano

---

**Built for Google Chrome Built-in AI Challenge 2025**  
**⭐ Star the parent repo if this helps your sales prospecting!**

