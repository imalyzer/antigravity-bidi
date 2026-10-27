/**
 * Antigravity Smart BiDi & RTL Isolation Engine
 * 
 * Architecture:
 * - CSS injection: runs directly in preload (shared DOM).
 * - Lexical Hooks (Shift+Enter, Paste): injected via webFrame.executeJavaScript()
 *   into the MAIN WORLD, because __lexicalEditor is set by React/Lexical in the
 *   main renderer world, not accessible from the preload isolated world.
 * - DevTools shortcut: runs in preload (keydown listener on shared DOM).
 * - MutationObserver for chat history: injected into main world (needs to read
 *   text content that may differ between worlds).
 */

(function () {
    // ==========================================
    // PART 1: CSS Injection (runs in preload — shared DOM)
    // ==========================================
    const BIDI_CSS = `
    /* === Antigravity Scoped BiDi Engine === */

    /* 1. Force all code blocks, pre, code tags, and technical editors to remain strictly LTR */
    pre, pre *, code, code *, kbd, samp, .code-block, [class*="code-block"], [class*="codeblock"], [class*="syntax-"], .monaco-editor, .monaco-editor * {
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: isolate !important;
    }

    /* 2. Force app chrome, sidebars, toolbars, and layout panes to stay strictly default LTR */
    body, #root, #app, nav, aside, header, footer, [role="navigation"], [class*="sidebar"], [class*="titlebar"], [class*="auxiliary"] {
        direction: ltr !important;
        text-align: left !important;
    }

    /* 3. Active Chat Input Box: Let Lexical <p dir="auto"> natively format each paragraph */
    div[contenteditable="true"] p {
        text-align: start !important;
    }

    /* 4. User Prompt Bubbles in Chat History - Line-by-Line Native BiDi */
    [data-testid="user-input-step"] [data-quotable="true"],
    [data-testid="user-input-step"] .whitespace-pre-wrap {
        direction: ltr !important;
        unicode-bidi: plaintext !important;
        text-align: start !important;
    }

    /* Fallback for standard text inputs */
    textarea, input[type="text"] {
        unicode-bidi: plaintext !important;
        text-align: start !important;
    }

    /* 5. Scoped RTL rule for assistant chat history messages */
    .chat-canvas .antigravity-rtl-line,
    [data-message-content] .antigravity-rtl-line,
    .antigravity-rtl-line {
        direction: rtl !important;
        text-align: right !important;
        unicode-bidi: isolate !important;
    }

    /* 6. Scoped LTR rule for assistant chat history messages */
    .chat-canvas .antigravity-ltr-line,
    [data-message-content] .antigravity-ltr-line,
    .antigravity-ltr-line {
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: isolate !important;
    }

    /* 7. Proper list markers in RTL */
    li.antigravity-rtl-line {
        list-style-position: outside !important;
        margin-right: 1.2em !important;
        margin-left: 0 !important;
    }

    /* 8. Inline code inside RTL sentences stays LTR isolated without flipping parent */
    .antigravity-rtl-line code {
        display: inline-block;
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: isolate !important;
        margin: 0 2px;
    }
    `;

    function injectStyles() {
        let style = document.getElementById('antigravity-bidi-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'antigravity-bidi-style';
            (document.head || document.documentElement).appendChild(style);
        }
        style.textContent = BIDI_CSS;
    }

    // ==========================================
    // PART 2: DevTools Shortcut (runs in preload — shared DOM keydown)
    // ==========================================
    function setupDevToolsShortcut() {
        window.addEventListener('keydown', (e) => {
            if (((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')) || e.key === 'F12') {
                try {
                    const electron = require('electron');
                    electron.ipcRenderer.invoke('window:toggle-devtools');
                } catch (err) {
                    window.electronNative?.toggleDevTools?.();
                }
            }
        }, true);
    }

    // ==========================================
    // PART 3: Main World Script (Lexical Hooks + Chat History MutationObserver)
    // Injected via webFrame.executeJavaScript() to access __lexicalEditor
    // ==========================================
    const MAIN_WORLD_SCRIPT = `
    (function() {
        if (window.__antigravityMainWorldLoaded) return;
        window.__antigravityMainWorldLoaded = true;

        // --- Lexical Multi-Paragraph Hooks ---
        function attachLexicalHooks() {
            var el = document.querySelector('div[contenteditable="true"]');
            if (!el || !el.__lexicalEditor) return false;
            var editor = el.__lexicalEditor;
            var editorKey = editor._key;

            // Track by editor key to handle editor recreation
            if (el.getAttribute('data-antigravity-editor-key') === editorKey) return true;
            el.setAttribute('data-antigravity-editor-key', editorKey);

            var insertLineBreakCmd = null;
            var insertParagraphCmd = null;
            var pasteCmd = null;

            for (var entry of editor._commands) {
                var cmd = entry[0];
                if (cmd.type === 'INSERT_LINE_BREAK_COMMAND') insertLineBreakCmd = cmd;
                if (cmd.type === 'INSERT_PARAGRAPH_COMMAND') insertParagraphCmd = cmd;
                if (cmd.type === 'PASTE_COMMAND') pasteCmd = cmd;
            }

            // Hook 1: Shift+Enter -> Insert Paragraph instead of LineBreakNode
            if (insertLineBreakCmd && insertParagraphCmd) {
                editor.registerCommand(
                    insertLineBreakCmd,
                    function() {
                        var pHandlers = editor._commands.get(insertParagraphCmd);
                        if (pHandlers) {
                            for (var p = 0; p < pHandlers.length; p++) {
                                if (pHandlers[p]) {
                                    for (var fn of pHandlers[p]) {
                                        fn();
                                    }
                                }
                            }
                        }
                        return true;
                    },
                    4
                );
            }

            // Hook 2: Multi-line Paste -> Split into individual ParagraphNodes
            if (pasteCmd) {
                editor.registerCommand(
                    pasteCmd,
                    function(event) {
                        if (!(event instanceof ClipboardEvent)) return false;
                        var text = event.clipboardData ? event.clipboardData.getData('text/plain') : null;
                        if (!text || (text.indexOf('\\n') === -1 && text.indexOf('\\r') === -1)) {
                            return false;
                        }
                        event.preventDefault();
                        var lines = text.split(/\\r\\n|\\r|\\n/);
                        editor.update(function() {
                            var ParagraphClass = editor._nodes.get('paragraph').klass;
                            var TextClass = editor._nodes.get('text').klass;
                            var sel = editor._editorState._selection;
                            if (!sel) return;
                            var nodes = [];
                            for (var i = 0; i < lines.length; i++) {
                                var p = new ParagraphClass();
                                if (lines[i].length > 0) {
                                    p.append(new TextClass(lines[i]));
                                }
                                nodes.push(p);
                            }
                            sel.insertNodes(nodes);
                        });
                        return true;
                    },
                    4
                );
            }

            return true;
        }

        // --- Chat History Direction Processing ---
        function isPersianArabicChar(code) {
            return (code >= 0x0600 && code <= 0x06FF) ||
                   (code >= 0xFB50 && code <= 0xFDFF) ||
                   (code >= 0xFE70 && code <= 0xFEFF) ||
                   (code >= 0x0750 && code <= 0x077F);
        }

        function isLatinChar(code) {
            return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
        }

        function detectStrongDirection(text) {
            if (!text) return null;
            for (var i = 0; i < text.length; i++) {
                var code = text.charCodeAt(i);
                if (isPersianArabicChar(code)) return 'rtl';
                if (isLatinChar(code)) return 'ltr';
            }
            return null;
        }

        function shouldProcessElement(el) {
            if (!el || el.nodeType !== 1) return false;
            var tag = el.tagName.toLowerCase();
            if (['pre', 'code', 'script', 'style', 'input', 'textarea', 'svg', 'path'].indexOf(tag) !== -1) return false;
            if (el.closest('nav, aside, header, footer, [role="navigation"], .sidebar, [class*="sidebar"], .monaco-editor')) return false;
            if (el.isContentEditable || el.closest('[contenteditable="true"]')) return false;
            if (el.closest('[data-testid="user-input-step"]')) return false;
            if (el.classList.contains('pointer-events-none') || el.closest('.pointer-events-none')) return false;
            if (['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].indexOf(tag) !== -1) return true;
            return false;
        }

        function processElement(el) {
            if (!shouldProcessElement(el)) return;
            var text = '';
            var childNodes = el.childNodes;
            for (var i = 0; i < childNodes.length; i++) {
                var child = childNodes[i];
                if (child.nodeType === 3) {
                    text += child.textContent;
                } else if (child.nodeType === 1 && child.tagName.toLowerCase() !== 'pre' && child.tagName.toLowerCase() !== 'code') {
                    text += ' ' + child.textContent;
                }
            }
            var dir = detectStrongDirection(text.trim());
            if (!dir) return;
            el.classList.add('antigravity-bidi-item');
            if (dir === 'rtl') {
                el.setAttribute('dir', 'rtl');
                el.classList.add('antigravity-rtl-line');
                el.classList.remove('antigravity-ltr-line');
            } else {
                el.setAttribute('dir', 'ltr');
                el.classList.add('antigravity-ltr-line');
                el.classList.remove('antigravity-rtl-line');
            }
        }

        function processContainer(root) {
            if (!root || !root.querySelectorAll) return;
            var targets = root.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote');
            for (var i = 0; i < targets.length; i++) {
                processElement(targets[i]);
            }
        }

        // --- Init ---
        document.addEventListener('focusin', attachLexicalHooks, true);
        document.addEventListener('pointerdown', attachLexicalHooks, true);
        attachLexicalHooks();
        processContainer(document.body || document.documentElement);

        var scheduled = false;
        var observer = new MutationObserver(function(mutations) {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(function() {
                scheduled = false;
                attachLexicalHooks();
                for (var i = 0; i < mutations.length; i++) {
                    var m = mutations[i];
                    if (m.type === 'childList') {
                        for (var j = 0; j < m.addedNodes.length; j++) {
                            var node = m.addedNodes[j];
                            if (node.nodeType === 1) {
                                processElement(node);
                                processContainer(node);
                            }
                        }
                    } else if (m.type === 'characterData') {
                        var parent = m.target.parentElement;
                        if (parent) processElement(parent);
                    }
                }
            });
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true
        });
    })();
    `;

    // ==========================================
    // INIT
    // ==========================================
    function init() {
        // Part 1: CSS (works in preload — shared DOM)
        injectStyles();

        // Part 2: DevTools shortcut (works in preload — shared DOM events)
        setupDevToolsShortcut();

        // Part 3: Main World injection via webFrame
        try {
            const electronObj = typeof electron_1 !== 'undefined' ? electron_1 : require('electron');
            if (electronObj && electronObj.webFrame) {
                electronObj.webFrame.executeJavaScript(MAIN_WORLD_SCRIPT);
            } else {
                throw new Error('webFrame not found');
            }
        } catch (err) {
            // Fallback: inject as <script> tag into main world
            const script = document.createElement('script');
            script.textContent = MAIN_WORLD_SCRIPT;
            (document.head || document.documentElement).appendChild(script);
            script.remove();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
