# Screenshots Guide for README

Quick guide for taking screenshots to add to your README before submission.

---

## Required Screenshots

### 1. **AI Summary Badge in Action**
**File**: `screenshot-1-summary-badge.png`  
**Location**: LinkedIn company page  
**What to capture**:
- Quick Summary badge visible (top-right of company header)
- Tooltip showing 3-bullet summary
- Green privacy shield visible

**Steps**:
1. Navigate to https://www.linkedin.com/company/google
2. Wait for LinkedIntel to load
3. Click "Quick Summary" badge
4. Capture tooltip with summary

---

### 2. **AI Status Dashboard**
**File**: `screenshot-2-ai-status.png`  
**Location**: LinkedIntel panel  
**What to capture**:
- AI Status indicator showing "Chrome AI: 5/5 active"
- Expanded view with all 5 APIs listed (green checkmarks)
- Model info showing "All Systems Ready"

**Steps**:
1. Open LinkedIntel panel on any LinkedIn page
2. Scroll to AI Status section
3. Click to expand
4. Capture showing all 5 APIs active

---

### 3. **Chat Interface with Prompt API**
**File**: `screenshot-3-chat-interface.png`  
**Location**: LinkedIntel panel - Chat tab  
**What to capture**:
- Chat interface with conversation
- User message + AI response
- Context badge showing profile/company name
- Typing indicator or response visible

**Steps**:
1. Open Chat tab in LinkedIntel panel
2. Ask: "What are the key selling points?"
3. Wait for AI response
4. Capture conversation

---

### 4. **AI Onboarding Modal**
**File**: `screenshot-4-onboarding.png`  
**Location**: First-time user experience  
**What to capture**:
- Welcome modal with Chrome AI features list
- Feature cards showing all 5 APIs
- Privacy badge at bottom

**Steps**:
1. Clear extension storage: `chrome.storage.local.clear()`
2. Reload extension
3. Visit LinkedIn page
4. Wait 3 seconds for onboarding modal
5. Capture modal

---

### 5. **Full Panel Overview**
**File**: `screenshot-5-full-panel.png`  
**Location**: Complete insights panel  
**What to capture**:
- Full LinkedIntel panel on company/profile page
- Multiple tabs visible
- Insights data loaded
- Professional, polished appearance

**Steps**:
1. Navigate to good example: https://www.linkedin.com/company/anthropic-ai
2. Click LinkedIntel FAB button
3. Wait for analysis to complete
4. Capture full panel with data

---

## Screenshot Best Practices

### Technical Settings
- **Resolution**: 1920x1080 or higher
- **Format**: PNG (best quality) or JPG
- **Compression**: Light (maintain text readability)
- **Aspect Ratio**: 16:9 or 4:3

### What to Show
✅ **DO**:
- Show actual functionality working
- Use real LinkedIn pages (Google, Anthropic, Microsoft)
- Capture clean, professional UI
- Include Chrome browser chrome (address bar) for context
- Show green "Ready" status for AI features

❌ **DON'T**:
- Use placeholder/fake data
- Show error states
- Capture during loading (unless showing loading state)
- Include personal information
- Show messy browser (close extra tabs)

### Editing Tips
- Annotate with arrows/boxes if needed (use red/yellow)
- Add captions in README, not on images
- Crop to relevant area (no excessive whitespace)
- Maintain readability (don't shrink too small)

---

## Adding to README

Once screenshots are captured, add to README.md:

```markdown
## 📸 Screenshots

### AI Summary Badge
![AI Summary Badge](screenshots/screenshot-1-summary-badge.png)
*One-click profile summaries using Chrome's Summarizer API*

### AI Status Dashboard
![AI Status Dashboard](screenshots/screenshot-2-ai-status.png)
*All 5 Chrome Built-in AI APIs active and ready*

### Chat Interface
![Chat Interface](screenshots/screenshot-3-chat-interface.png)
*Context-aware conversations with Prompt API*

### First-Run Onboarding
![AI Onboarding](screenshots/screenshot-4-onboarding.png)
*Guided setup for Chrome AI features*

### Full Extension Panel
![Full Panel](screenshots/screenshot-5-full-panel.png)
*Complete sales intelligence interface*
```

---

## Alternative: Demo GIFs

For even better presentation, create short GIFs (< 5 seconds each):

### Tools
- **Windows**: ScreenToGif (free)
- **Mac**: Kap (free), GIPHY Capture
- **Cross-platform**: LICEcap

### GIF Subjects
1. `demo-summary.gif` - Clicking badge → tooltip appears
2. `demo-chat.gif` - Typing question → AI responds
3. `demo-status.gif` - Expanding AI status → shows all APIs
4. `demo-refine.gif` - Rewriting message tone

### GIF Settings
- **Duration**: 3-5 seconds per GIF
- **Frame rate**: 10-15 FPS (smaller file size)
- **Size**: Max 5MB per GIF
- **Resolution**: 1280x720 (balance size vs quality)
- **Loop**: Yes (infinite)

---

## Screenshot Checklist

Before submitting:

- [ ] All 5 screenshots captured
- [ ] Screenshots saved in `/screenshots/` folder
- [ ] Files named consistently (screenshot-1, screenshot-2, etc.)
- [ ] PNG format, readable text
- [ ] No personal data visible
- [ ] Chrome AI features clearly shown
- [ ] README updated with image links
- [ ] Images committed to Git
- [ ] Links tested (images load in README)

---

## Quick Capture Script

For fast screenshot workflow:

1. **Test all features first**
   ```bash
   # Enable debug mode
   localStorage.setItem('linkedintel_log_level', 'debug')
   ```

2. **Navigate to test pages**
   - Company: https://www.linkedin.com/company/google
   - Profile: https://www.linkedin.com/in/satyanadella

3. **Capture systematically**
   - Screenshot 1: Summary badge
   - Screenshot 2: AI status
   - Screenshot 3: Chat
   - Screenshot 4: Onboarding (reset storage first)
   - Screenshot 5: Full panel

4. **Save and organize**
   ```bash
   mkdir -p screenshots
   # Move screenshots to folder
   # Rename consistently
   ```

---

## Example Screenshot Layout in README

```markdown
## ✨ Features in Action

<table>
  <tr>
    <td width="50%">
      <img src="screenshots/screenshot-1-summary-badge.png" alt="AI Summary"/>
      <p align="center"><b>Instant Summaries</b><br/>Summarizer API in action</p>
    </td>
    <td width="50%">
      <img src="screenshots/screenshot-2-ai-status.png" alt="AI Status"/>
      <p align="center"><b>5 APIs Active</b><br/>Complete Chrome AI integration</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="screenshots/screenshot-3-chat-interface.png" alt="Chat Interface"/>
      <p align="center"><b>Smart Chat</b><br/>Prompt API conversations</p>
    </td>
    <td width="50%">
      <img src="screenshots/screenshot-5-full-panel.png" alt="Full Panel"/>
      <p align="center"><b>Complete Intelligence</b><br/>Hybrid AI architecture</p>
    </td>
  </tr>
</table>
```

---

**Note**: Screenshots are optional but highly recommended. They significantly improve your submission's visual appeal and help judges quickly understand your project.

**Time needed**: 15-20 minutes for all 5 screenshots + editing

