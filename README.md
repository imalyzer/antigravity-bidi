# Antigravity BiDi & RTL Isolation Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D6.svg)](https://microsoft.com)
[![Engine: Electron](https://img.shields.io/badge/Electron-Desktop-47848F.svg)](https://electronjs.org)
[![Editor: Meta Lexical](https://img.shields.io/badge/Editor-Meta%20Lexical-0081FB.svg)](https://lexical.dev)

A lightweight, non-destructive, and self-healing BiDi (Bidirectional) engine for **Google Antigravity 2.0** desktop app.

Provides native, real-time line-by-line RTL (Persian / Arabic / Hebrew) and LTR (English / Code) isolation in the active chat prompt editor and message canvas, while eliminating cursor jumping and preserving 100% LTR code blocks and system chrome.

---

## The Problem: Meta Lexical in Desktop AI Clients

Modern AI desktop clients powered by Electron and Meta's Lexical framework suffer from critical BiDi flaws:

1. **The Single-Paragraph Trap:**  
   Pressing `Shift + Enter` inserts `<br>` within the *same* `<p dir="auto">` container. Chromium determines directionality based solely on the *first strong character* of the block. If Line 1 is Persian, the entire paragraph becomes RTL—forcing subsequent English lines, code snippets, or Windows paths (`C:\Users\...`) to align to the right margin and flipping terminal punctuation backwards.
2. **The Spacebar Caret Jump Bug:**  
   Generic CSS workarounds like `unicode-bidi: plaintext !important` fail in `contenteditable`. Trailing whitespace (`WS`) in a forced LTR container resolves to LTR, causing the typing caret to jump violently to the far-left / beginning of the line whenever typing a space in Persian or Arabic.
3. **Multiline Paste Corruption:**  
   Pasting multi-line text into Lexical embeds line breaks inside a single text node, flattening all directions into the first line's direction.

---

## The Solution: Multi-Paragraph Lexical Architecture

This patch intercepts Lexical's internal command pipeline at `COMMAND_PRIORITY_CRITICAL` (4):

* **Shift + Enter Interception:** Intercepts `INSERT_LINE_BREAK_COMMAND` and dispatches `INSERT_PARAGRAPH_COMMAND`. Every line becomes its own independent `<p dir="auto">`:
  - Persian lines resolve to RTL (`text-align: start` -> right aligned, zero cursor jumps).
  - English, paths, and code resolve to LTR (`text-align: start` -> left aligned).
  - Empty lines retain native line height.
* **Native Multiline Paste Splitting:** Intercepts `PASTE_COMMAND`. Text containing `\r\n` or `\n` is split into individual `ParagraphNode` instances and inserted atomically.
* **Preload Context Isolation Bridge:** Executes in the Electron Main World via `webFrame.executeJavaScript` to securely access `el.__lexicalEditor`.
* **Strict Technical Isolation:** Code blocks (`<pre>`, `<code>`, Monaco editor, Markdown blocks) and app chrome (sidebars, navigation, titlebars) remain strictly LTR.
* **DevTools Access:** Enables Chromium DevTools (`Ctrl+Shift+I` and `F12`) for custom inspection and styling.

---

## Quick Start (1-Click Installation)

### Prerequisites
* Windows 10 / 11
* [Node.js](https://nodejs.org) (v18+ recommended)
* Google Antigravity installed

### Installation
1. Download or clone this repository:
   ```bash
   git clone https://github.com/imalyzer/antigravity-bidi.git
   cd antigravity-bidi
   ```
2. Double-click **`1_Apply_Patch.bat`** (or run `npm run patch`).
3. Launch Google Antigravity. Your input box and chat history now support seamless mixed-direction typing!

### Factory Restore (Uninstall)
To completely revert Antigravity to its pristine, original Google state:
* Double-click **`2_Restore_Original.bat`** (or run `npm run restore`).

---

## Dynamic In-Place Patcher (Update-Proof)

Unlike static binary mods that break or downgrade the application when Google releases an update, this tool uses a **Dynamic In-Place Patcher** (`scripts/smart_patch.js`):

```text
[Google Updates Antigravity]
           │
           ▼
[Run 1_Apply_Patch.bat]
           │
           ├─► 1. Creates automatic backup in resources folder
           ├─► 2. Extracts the newly installed live app.asar
           ├─► 3. Injects BiDi Engine & DevTools into dist/preload.js & dist/utils.js
           ├─► 4. Repacks with native unpacked dependencies preserved
           └─► 5. Deploys updated archive in-place
```

All new vendor features, bug fixes, and security patches from Google updates are 100% preserved.

---

## Technical Architecture

```text
antigravity-bidi/
├── 1_Apply_Patch.bat              # [Windows Launcher] 1-Click smart patcher
├── 2_Restore_Original.bat         # [Windows Launcher] 1-Click factory restore
├── LICENSE                        # MIT License
├── package.json                   # Project metadata & npm run scripts
├── README.md                      # English documentation & technical architecture
├── README_FA.md                   # Persian documentation & user guide
├── AGENT_GUIDE.md                 # Technical guide for AI coding assistants
├── patch/
│   └── bidi_engine.js             # BiDi engine, CSS injector, Lexical hooks & DevTools shortcut
└── scripts/
    ├── smart_patch.js             # Dynamic Node.js ASAR extraction, patching & packing engine
    ├── smart_update_patch.bat     # Windows orchestration batch wrapper
    └── restore_original.bat       # Factory restoration batch wrapper
```

---

## Community & Support

* **Issues & Bug Reports:** Please report any bugs or edge cases via [GitHub Issues](https://github.com/imalyzer/antigravity-bidi/issues).
* **Discussions & Feedback:** Join the conversation on [GitHub Discussions](https://github.com/imalyzer/antigravity-bidi/discussions).

---

## License

This project is licensed under the [MIT License](LICENSE) - Copyright (c) 2026 **imalyzer**.
Google Antigravity is a trademark of Google LLC. This project is an independent open-source enhancement tool and is not affiliated with Google.
