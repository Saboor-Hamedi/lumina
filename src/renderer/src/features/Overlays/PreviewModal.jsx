import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Clock, FileText, Copy } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import ModalHeader from './ModalHeader'
import './PreviewModal.css'
import hljs from 'highlight.js'

const PreviewModal = ({ isOpen, onClose, content, onNavigate, title: snippetTitle }) => {
  const [shadowRoot, setShadowRoot] = useState(null)

  // Calculate statistics
  const stats = useMemo(() => {
    if (!content) return { words: 0, time: 0 }
    // Strip HTML tags for word count
    const text = content.replace(/<[^>]*>/g, ' ')
    const words = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length
    const time = Math.max(1, Math.ceil(words / 200)) // 200 wpm
    return { words, time }
  }, [content])

  // 1. Hooks MUST be at the top level
  useKeyboardShortcuts(
    isOpen
      ? {
          onEscape: onClose
        }
      : {}
  )

  const onHostRef = useCallback((node) => {
    if (node && !node.shadowRoot) {
      const root = node.attachShadow({ mode: 'open' })
      setShadowRoot(root)
    }
  }, [])
  useEffect(() => {
    if (!shadowRoot) return

    const handleClick = (e) => {
      // Wiki link navigation
      const wikiLink = e.target.closest('.preview-wikilink')
      if (wikiLink && onNavigate) {
        const title = wikiLink.getAttribute('data-title')
        onNavigate(title)
        onClose()
        return
      }

      // Copy code button inside shadow DOM
      const copyBtn = e.target.closest('.copy-code-btn')
      if (copyBtn) {
        const wrapper = copyBtn.closest('.code-block-wrapper')
        if (wrapper) {
          const codeEl = wrapper.querySelector('pre code')
          if (codeEl) {
            const text = codeEl.textContent || codeEl.innerText || ''
            try {
              navigator.clipboard.writeText(text)
            } catch (err) {
              const textarea = document.createElement('textarea')
              textarea.value = text
              document.body.appendChild(textarea)
              textarea.select()
              document.execCommand('copy')
              document.body.removeChild(textarea)
            }
            // small feedback: add a temporary class if button exists in light DOM
            copyBtn.classList.add('copied')
            setTimeout(() => copyBtn.classList.remove('copied'), 1000)
          }
        }
        return
      }
    }

    shadowRoot.addEventListener('click', handleClick)
    return () => shadowRoot.removeEventListener('click', handleClick)
  }, [shadowRoot, onNavigate, onClose])

  // Highlight code blocks inside the shadow root when content changes
  useEffect(() => {
    if (!shadowRoot) return
    // Run in next tick to ensure portal content is rendered
    requestAnimationFrame(() => {
      try {
        const preEls = shadowRoot.querySelectorAll && shadowRoot.querySelectorAll('pre')
        if (preEls && preEls.length) {
          preEls.forEach((pre) => {
            // If already wrapped, skip
            if (pre.closest('.code-block-wrapper')) return

            const code = pre.querySelector('code')

            // Create wrapper and header
            const wrapper = document.createElement('div')
            wrapper.className = 'code-block-wrapper'
            const header = document.createElement('div')
            header.className = 'code-block-header'

            // Determine language from class like 'language-js'
            let lang = ''
            if (code && code.className) {
              const m = code.className.match(/language-(\w+)/)
              if (m) lang = m[1]
            }

            const langLabel = document.createElement('span')
            langLabel.className = 'lang-label'
            langLabel.textContent = (lang || 'code').toUpperCase()

            const copyBtn = document.createElement('button')
            copyBtn.className = 'copy-code-btn'
            copyBtn.type = 'button'
            copyBtn.title = 'Copy code'
            copyBtn.textContent = 'Copy'

            header.appendChild(langLabel)
            header.appendChild(copyBtn)

            // Insert wrapper into DOM
            pre.parentNode.insertBefore(wrapper, pre)
            wrapper.appendChild(header)
            wrapper.appendChild(pre)

            // Highlight after DOM insertion
            if (code) {
              try {
                hljs.highlightElement(code)
              } catch (e) {
                /* ignore */
              }
            }
          })
        }
        // Wrap @mentions in the rendered html (but skip inside code/pre/a)
        try {
          const article = shadowRoot.querySelector && shadowRoot.querySelector('article')
          if (article) {
            const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, null, false)
            const textNodes = []
            let node
            while ((node = walker.nextNode())) {
              // skip if inside code or pre or a
              const parentTag = node.parentElement && node.parentElement.tagName
              if (parentTag && ['CODE', 'PRE', 'A', 'SCRIPT', 'STYLE'].includes(parentTag)) continue
              if (/@[A-Za-z0-9_\-]+/.test(node.nodeValue)) textNodes.push(node)
            }
            textNodes.forEach((textNode) => {
              const frag = document.createDocumentFragment()
              let lastIndex = 0
              const re = /@([A-Za-z0-9_\-]+)/g
              let m
              const str = textNode.nodeValue
              while ((m = re.exec(str)) !== null) {
                const before = str.slice(lastIndex, m.index)
                if (before) frag.appendChild(document.createTextNode(before))
                const mention = document.createElement('span')
                mention.className = 'mention'
                mention.textContent = m[0]
                frag.appendChild(mention)
                lastIndex = m.index + m[0].length
              }
              const rest = str.slice(lastIndex)
              if (rest) frag.appendChild(document.createTextNode(rest))
              textNode.parentNode.replaceChild(frag, textNode)
            })
          }
        } catch (err) {
          /* ignore mention wrap errors */
        }
      } catch (err) {
        // ignore
      }
    })
  }, [shadowRoot, content])
  if (!isOpen) return null

  const handleCopyHTML = () => {
    try {
      navigator.clipboard.writeText(content || '')
    } catch (err) {
      // fallback
      const textarea = document.createElement('textarea')
      textarea.value = content || ''
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }

  const modal = (
    <div className="modal-overlay preview-overlay-glass" onClick={onClose}>
      <div
        className="modal-container preview-container premium-preview-card"
        style={{ width: '92vw', height: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader
          left={
            <div
              className="modal-title-stack"
              style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <span className="preview-indicator-tag">MARKDOWN</span>
              <span className="preview-filename-text">{snippetTitle || 'Untitled'}</span>
            </div>
          }
          right={
            <>
              <div className="preview-stats-bar">
                <div className="preview-stat-item">
                  <FileText size={12} />
                  <span>{stats.words} words</span>
                </div>
                <div className="preview-stat-sep" />
                <div className="preview-stat-item">
                  <Clock size={12} />
                  <span>{stats.time} min read</span>
                </div>
              </div>
              <button className="preview-action-btn" onClick={handleCopyHTML} title="Copy HTML">
                <Copy size={16} />
              </button>
            </>
          }
          onClose={onClose}
        />

        <div
          className="preview-body seamless-scrollbar"
          ref={onHostRef}
          style={{ flex: 1, overflow: 'auto', background: 'var(--bg-app)' }}
        >
          {shadowRoot &&
            createPortal(
              <div className="preview-inner-canvas">
                <style>{previewStyles}</style>
                <article dangerouslySetInnerHTML={{ __html: content }} />
              </div>,
              shadowRoot
            )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

const previewStyles = `
    :host {
      display: block;
      font-family: var(--preview-font-family, var(--font-editor, 'Inter', -apple-system, sans-serif));
      font-size: var(--preview-font-size, 1.05rem);
      line-height: 1.8;
      color: var(--text-main);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    .preview-inner-canvas {
      padding: 4rem 10% 8rem 10%;
      max-width: 900px;
      margin: 0 auto;
      background: var(--bg-app);
    }
    article {
      animation: contentFadeIn 0.5s ease-out;
    }
    @keyframes contentFadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    h1 { 
      font-size: 3em; 
      font-weight: 800; 
      margin-bottom: 0.8em; 
      margin-top: 0;
      letter-spacing: -0.02em;
      color: var(--text-main);
      line-height: 1.2;
    }
    h2 { 
      font-size: 1.8em; 
      font-weight: 700; 
      margin-top: 2.5em; 
      margin-bottom: 1em;
      color: var(--text-main);
      opacity: 0.95;
      line-height: 1.3;
    }
    h3 {
      font-size: 1.4em;
      font-weight: 600;
      margin-top: 2em;
      margin-bottom: 0.8em;
      color: var(--text-main);
      opacity: 0.9;
    }
    h4, h5, h6 {
      font-size: 1.2em;
      font-weight: 600;
      margin-top: 1.5em;
      margin-bottom: 0.6em;
      color: var(--text-main);
      opacity: 0.85;
    }
    p { 
      margin-bottom: 1.6em; 
      font-size: 1.05rem; 
      opacity: 0.9; 
      line-height: 1.8;
    }

    pre { 
      background: rgba(var(--text-accent-rgb), 0.03);
      padding: 1.5em; 
      border-radius: 12px; 
      border: 1px solid var(--border-subtle); 
      overflow-x: auto; 
      margin: 2em 0;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.9em;
      line-height: 1.6;
    }
    .code-block-wrapper {
      margin: 1.6em 0;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border-subtle);
      background: rgba(var(--text-accent-rgb), 0.03); /* restore subtle gray code body */
    }
    .code-block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      background: rgba(var(--text-accent-rgb), 0.04);
      border-bottom: 1px solid rgba(255,255,255,0.02);
      font-size: 12px;
      color: var(--text-faint);
    }
    .code-block-header {
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
    }
    .code-block-wrapper pre {
      margin: 0; /* remove default pre margin so header is flush with code */
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
      border: none !important; /* remove inner pre border so wrapper border is used */
      background: transparent !important; /* let wrapper background show through */
      padding: 1.5em !important; /* ensure padding remains */
    }
    .lang-label {
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .copy-code-btn {
      background: transparent;
      border: none;
      color: var(--text-faint);
      cursor: pointer;
      padding: 6px 8px;
      border-radius: 6px;
    }
    .copy-code-btn:hover { background: rgba(255,255,255,0.02); color: var(--text-main); }
    .copy-code-btn.copied { color: #22c55e; font-weight: 700; }
    .mention { color: var(--text-accent); background: rgba(var(--text-accent-rgb), 0.06); padding: 0 4px; border-radius: 4px; }
    code { 
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      background: rgba(var(--text-accent-rgb), 0.1); 
      padding: 0.2em 0.5em; 
      border-radius: 6px; 
      font-size: 0.9em; 
      color: var(--text-accent);
    }
    pre code {
      background: transparent;
      padding: 0;
      color: inherit;
      font-size: inherit;
    }

    /* Minimal highlight.js theme (self-contained) */
    .hljs {
      display: block;
      overflow-x: auto;
      padding: 0.2em 0.4em;
      background: transparent;
      color: var(--text-main);
    }
    .hljs-comment,
    .hljs-quote { color: #6a737d; font-style: italic }
    .hljs-keyword,
    .hljs-selector-tag,
    .hljs-subst { color: #d73a49; font-weight: 600 }
    .hljs-number,
    .hljs-literal,
    .hljs-variable,
    .hljs-template-variable,
    .hljs-tag .hljs-attr { color: #005cc5 }
    .hljs-string,
    .hljs-doctag { color: #032f62 }
    .hljs-title,
    .hljs-section,
    .hljs-selector-id { color: #6f42c1 }
    .hljs-subst { font-weight: 400 }
    .hljs-built_in,
    .hljs-builtin-name { color: #e36209 }
    .hljs-meta { color: #b31d28 }
    .hljs-emphasis { font-style: italic }
    .hljs-strong { font-weight: 700 }

    /* Make code selection subtle to avoid harsh block selection visuals */
    pre ::selection, pre code ::selection, code ::selection {
      background: rgba(var(--text-accent-rgb), 0.12);
    }

    blockquote {
      border-left: 4px solid var(--text-accent);
      background: rgba(var(--text-accent-rgb), 0.05);
      padding: 1.5em 2em;
      margin: 2em 0;
      border-radius: 0 8px 8px 0;
      font-style: italic;
      font-size: 1.1em;
      color: var(--text-muted);
    }

    ul, ol { 
      margin-bottom: 2em; 
      padding-left: 1.5em; 
    }
    li { 
      margin-bottom: 0.8em; 
      line-height: 1.8;
    }

    hr {
      border: none;
      height: 1px;
      background: var(--border-dim);
      margin: 4rem 0;
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      margin: 2em 0;
    }

    a:not(.preview-wikilink) {
      color: var(--text-accent);
      text-decoration: none;
      border-bottom: 1px solid rgba(var(--text-accent-rgb), 0.3);
      transition: all 0.2s;
    }
    a:not(.preview-wikilink):hover {
      border-bottom-color: var(--text-accent);
      background: rgba(var(--text-accent-rgb), 0.05);
    }

    .preview-wikilink {
      color: var(--text-accent);
      text-decoration: none;
      cursor: pointer;
      font-weight: 600;
      border-bottom: 1px dashed rgba(var(--text-accent-rgb), 0.3);
      transition: all 0.2s;
      font-style: normal;
    }
    .preview-wikilink:hover {
      border-bottom-style: solid;
      background: rgba(var(--text-accent-rgb), 0.05);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 2em 0;
      font-size: 0.95em;
    }
    th {
      text-align: left;
      padding: 12px;
      background: rgba(var(--text-accent-rgb), 0.05);
      border-bottom: 2px solid var(--border-dim);
      font-weight: 600;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid var(--border-dim);
    }
    tr:hover {
      background: rgba(var(--text-accent-rgb), 0.02);
    }

    strong {
      font-weight: 700;
      color: var(--text-main);
    }

    em {
      font-style: italic;
      color: var(--text-muted);
    }

    del {
      text-decoration: line-through;
      opacity: 0.7;
    }
  `

export default PreviewModal
