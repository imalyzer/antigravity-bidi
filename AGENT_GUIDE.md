# Antigravity UI Smart BiDi & RTL Isolation Engine — Agent Guide

## 1. System Overview & Purpose

This toolchain patches Google Antigravity 2.0 (Electron desktop application) to enforce a **Smart Line/Paragraph-Level BiDi Rule** within both:
1. **The Active User Chat Input Box (`div[contenteditable="true"]` powered by Meta Lexical):** Independent, real-time line-by-line directionality for typed drafts and multi-line pasted blocks before sending.
2. **The Chat Message Stream (Canvas):** Both Assistant responses and User Prompt history bubbles.

### Core Problems Solved & Architectural Insights

1. **The Single-Paragraph Trap vs Multi-Paragraph Architecture:**
   - In Meta's Lexical framework, pressing `Shift + Enter` default-dispatches `INSERT_LINE_BREAK_COMMAND`, inserting `<br>` into the *same* `ParagraphNode` (`<p>`).
   - In Chromium, a `<p dir="auto">` evaluates only the *first* strong character of the entire block container. If Line 1 is Persian, the entire `<p>` becomes RTL, forcing subsequent lines (even English code or Windows paths like `C:\Users\...`) to align to the right edge.
   - Forcing `direction: ltr !important; unicode-bidi: plaintext !important;` via CSS caused severe caret bugs: neutral characters (trailing spacebars) in an LTR-forced container placed the caret at the logical LTR boundary (jumping to the far left of the input line).
   - **The Permanent Architecture:** Intercept `INSERT_LINE_BREAK_COMMAND` at `COMMAND_PRIORITY_CRITICAL` (4) to dispatch `INSERT_PARAGRAPH_COMMAND`. Every line becomes its own independent `<p dir="auto">`. Blink evaluates each line natively:
     - Persian lines resolve to RTL (`text-align: start` -> right aligned, zero spacebar caret jumps).
     - English / code / path lines resolve to LTR (`text-align: start` -> left aligned).
     - Empty paragraphs maintain full height and cursor stability.

2. **Multi-line Paste Interception (`PASTE_COMMAND`):**
   - By default, Lexical's paste handler inserts multiline text (`\n`) into a single text node inside one paragraph, forcing all lines into the direction of the first line.
   - The engine hooks `PASTE_COMMAND` at priority 4. If pasted `text/plain` contains `\n` or `\r`, it splits the text by line breaks, constructs individual `ParagraphNode` and `TextNode` instances, and atomically inserts them via `selection.insertNodes(nodes)`. Each pasted line receives its own native direction. Single-line pastes fall through to Lexical's default handling.

3. **User Prompt History Bubbles:**
   - Prompt bubbles in chat history (`[data-testid="user-input-step"] [data-quotable="true"]`) formatted with `white-space: pre-wrap` are rendered line-by-line using `unicode-bidi: plaintext`.

4. **Strict Code & Layout Isolation:**
   - Code blocks (`pre, code`, Monaco editor, `.code-block`) remain strictly 100% LTR isolated. App sidebars, navigation headers, and auxiliary panes remain completely untouched.

5. **DevTools Restoration:**
   - Production Antigravity packages set `devTools: !app.isPackaged` (evaluating to `false`). The patch unlocks `devTools: true` and binds `Ctrl+Shift+I` and `F12`.

---

## 2. Directory Architecture (Crystallized Taxonomy & SKILL-15 Standards)

```text
antigravity-bidi/
├── .project-root                  # [Anchor] Dynamic root marker file (SKILL-15)
├── paths.manifest.json            # [Manifest] Central logical path registry
├── 1_Apply_Patch.bat              # [Root Forwarder] 1-Click transparent launcher (%*)
├── 2_Restore_Original.bat         # [Root Forwarder] 1-Click factory restore launcher (%*)
├── LICENSE                        # MIT License (credited to imalyzer)
├── package.json                   # Project manifest, npm run patch/restore/audit
├── README.md                      # English documentation & technical architecture
├── README_FA.md                   # Persian user guide
├── AGENT_GUIDE.md                 # This technical guide (English)
├── patch/
│   └── bidi_engine.js             # Standalone BiDi engine, CSS injector, Lexical hooks & DevTools relay
└── scripts/
    ├── Invoke-WorkspaceAudit.ps1  # [Audit] Fast automated hygiene & link verification (< 2.0s)
    ├── smart_patch.js             # Dynamic Node.js engine for in-place ASAR patching (# @PATH-REGISTRY)
    ├── smart_update_patch.bat     # Windows batch execution wrapper with root walk-up
    └── restore_original.bat       # Portable factory restore script with root walk-up
```

---

## 3. Data Flow & DOM Injection Vector

```text
[Antigravity.exe Launches]
         │
         ├──► [dist/main.js] Creates BrowserWindow (webPreferences.devTools = true)
         │
         └──► [dist/preload.js] Executes in Renderer Preload Stage
                     │
                     ├──► Injects Scoped CSS to document.head:
                     │      - Isolates `pre, code, Monaco` strictly to LTR
                     │      - Active input box: `div[contenteditable="true"] p { text-align: start !important; }`
                     │      - User prompt history: `unicode-bidi: plaintext`
                     │      - Assistant messages: `.antigravity-rtl-line` / `.antigravity-ltr-line`
                     │
                     ├──► Installs Global Keydown Listener:
                     │      - Captures `Ctrl+Shift+I` and `F12`
                     │      - Invokes IPC `window:toggle-devtools`
                     │
                     ├──► Attaches Multi-Paragraph Hooks to Lexical Editor:
                     │      - Listens on `focusin`, `pointerdown`, and `MutationObserver`
                     │      - Intercepts `INSERT_LINE_BREAK_COMMAND` -> Dispatches `INSERT_PARAGRAPH_COMMAND`
                     │      - Intercepts `PASTE_COMMAND` -> Splits multiline text into `ParagraphNode`s
                     │
                     └──► Runs Debounced MutationObserver (requestAnimationFrame):
                            │
                            ▼
           [Assistant Message Stream (Chat Canvas)]
                            │
                            ├── Scans `p, li, h1-h6, blockquote` (strictly skips contenteditable, user bubbles, code)
                            ├── Detects First Strong Character
                            └── Assigns `.antigravity-rtl-line` or `.antigravity-ltr-line`
```

---

## 4. Maintenance, Upgrades & Rollback

- **Scenario 1: Windows Reinstall or Rapid Deploy (Pre-built asar):**
  Simply run `1_Apply_Patch.bat` from the root directory. It checks `%LOCALAPPDATA%`, creates a local backup, and copies the verified `build/app.asar` without needing Node.js or build tools.
- **Scenario 2: Google Released a New Version (Dynamic In-Place Patcher):**
  When Antigravity auto-updates, Google downloads a new `app.asar`. Running `2_Smart_Update_Patch.bat` extracts Google's new version, preserves all Google's new features and dependencies, injects `patch/bidi_engine.js` into the new `preload.js`, and repacks.
- **Scenario 3: Factory Restore:**
  Double-click `3_Restore_Original.bat` to restore `backup/app.asar.original` with one click.
