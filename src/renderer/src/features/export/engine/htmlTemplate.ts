import {
  escapeHtml,
  getPreviewPageChrome,
  isLightColorHexOrRgb,
  normalizeTheme,
  SHARED_SCROLLBAR_CSS,
  themeVarsCss
} from './types'

function formatWebsiteCodeLang(rawClassAttr: string): string {
  const m = rawClassAttr.match(/language-([a-z0-9_+-]+)/i)
  const lang = (m?.[1] || '').toLowerCase()
  if (!lang || lang === 'plaintext' || lang === 'text' || lang === 'txt') return 'CODE'
  return lang.toUpperCase()
}

function enhanceWebsiteHtml(htmlBody: string): string {
  if (!htmlBody) return ''
  let out = htmlBody.replace(
    /<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/gi,
    (_, attrs = '', inner = '') => {
      const langLabel = formatWebsiteCodeLang(attrs)
      return `<div class="code-card"><div class="code-card-head"><span class="code-lang">${escapeHtml(langLabel)}</span><button type="button" class="code-copy-btn" data-copy-code aria-label="Copy code">Copy</button></div><pre><code${attrs}>${inner}</code></pre></div>`
    }
  )
  out = out.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (tableHtml) => {
    return `<div class="table-scroll">${tableHtml}</div>`
  })
  return out
}

function computeReadingStats(htmlBody: string): { words: number; minutes: number } {
  const plain = htmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!plain) return { words: 0, minutes: 0 }
  const words = plain.split(' ').length
  return { words, minutes: Math.max(1, Math.round(words / 220)) }
}

function shouldShowArticleHeroTitle(title: string, htmlBody: string): boolean {
  const trimmed = (htmlBody || '').trimStart()
  const h1Match = trimmed.match(/^<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
  if (!h1Match) return true
  const firstHeadingText = h1Match[1].replace(/<[^>]+>/g, '').trim().toLowerCase()
  return firstHeadingText !== title.trim().toLowerCase()
}

export function buildCleanHTMLDocument(
  title?: string,
  htmlBody: string = '',
  tocHtml: string = '',
  theme?: Record<string, string>,
  isPreview: boolean = false
): string {
  const safeTitle = (title || 'Untitled').trim() || 'Untitled'
  const useCustomTheme = Boolean(theme && Object.keys(theme).length > 0)
  const tokens = normalizeTheme(theme)
  const { stageBg, pageBorder, pageShadow } = getPreviewPageChrome(theme)
  const defaultLight = useCustomTheme ? isLightColorHexOrRgb(tokens['bg-editor']) : false
  const initialTheme: 'light' | 'dark' = defaultLight ? 'light' : 'dark'

  const previewStageOverride = isPreview
    ? `
html, body {
  background: ${stageBg} !important;
}
body {
  padding: 32px 24px;
  min-height: 100vh;
}
.site-shell {
  width: 100%;
  max-width: 760px;
  min-height: 1040px;
  margin: 12px auto 32px auto;
  border-radius: 4px;
  border: 1px solid ${pageBorder};
  box-shadow: ${pageShadow};
  overflow: hidden;
}
.site-main {
  padding: 32px 36px 48px;
}
.site-header-inner,
.site-footer-inner {
  padding: 10px 24px;
}`
    : ''

  const customPolarityOverride = useCustomTheme
    ? `
html[data-theme="${initialTheme}"] {
  --site-bg: ${tokens['bg-editor']};
  --site-surface: ${tokens['bg-panel']};
  --site-surface-alt: ${tokens['bg-card']};
  --site-hover: ${tokens['bg-active']};
  --site-ink: ${tokens['text-main']};
  --site-muted: ${tokens['text-muted']};
  --site-accent: ${tokens['text-accent']};
  --site-border: ${tokens['border-card']};
}`
    : ''

  const enhancedBody = enhanceWebsiteHtml(htmlBody)
  const stats = computeReadingStats(htmlBody)
  const showHeroTitle = shouldShowArticleHeroTitle(safeTitle, enhancedBody)
  const hasToc = Boolean(tocHtml && tocHtml.trim().length > 0)
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date())

  const script = `<script>
(function () {
  var root = document.documentElement;
  var autoSystem = ${useCustomTheme ? 'false' : 'true'};
  try {
    var stored = localStorage.getItem('lumina-export-theme');
    if (stored === 'light' || stored === 'dark') {
      root.setAttribute('data-theme', stored);
    } else if (autoSystem && window.matchMedia) {
      root.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    }
  } catch (err) {}

  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || typeof target.closest !== 'function') return;

    var themeBtn = target.closest('[data-theme-toggle]');
    if (themeBtn) {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('lumina-export-theme', next); } catch (err) {}
      return;
    }

    var printBtn = target.closest('[data-print-doc]');
    if (printBtn && typeof window.print === 'function') {
      window.print();
      return;
    }

    var copyBtn = target.closest('[data-copy-code]');
    if (copyBtn) {
      var card = copyBtn.closest('.code-card');
      var codeEl = card && card.querySelector('pre code');
      var text = codeEl ? (codeEl.textContent || '') : '';
      if (!text) return;
      var finish = function () {
        copyBtn.textContent = 'Copied';
        copyBtn.classList.add('is-copied');
        setTimeout(function () {
          copyBtn.textContent = 'Copy';
          copyBtn.classList.remove('is-copied');
        }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(finish).catch(function () {});
      }
    }
  });

  if (typeof IntersectionObserver !== 'undefined') {
    var headings = Array.prototype.slice.call(document.querySelectorAll('.article-body h1[id], .article-body h2[id], .article-body h3[id]'));
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.site-toc a[href^="#"]'));
    if (headings.length > 0 && tocLinks.length > 0) {
      var setActive = function (id) {
        for (var i = 0; i < tocLinks.length; i++) {
          var active = tocLinks[i].getAttribute('href') === '#' + id;
          tocLinks[i].classList.toggle('is-active', active);
        }
      };
      var observer = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting && entries[i].target && entries[i].target.id) {
            setActive(entries[i].target.id);
            break;
          }
        }
      }, { rootMargin: '-84px 0px -70% 0px', threshold: 0.01 });
      for (var j = 0; j < headings.length; j++) {
        observer.observe(headings[j]);
      }
      setActive(headings[0].id);
    }
  }
})();
</script>`

  return `<!DOCTYPE html>
<html lang="en" data-theme="${initialTheme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(safeTitle)}</title>
  <style>
${SHARED_SCROLLBAR_CSS}
:root,
html[data-theme="dark"] {
  --site-bg: #0b0d13;
  --site-surface: #12151f;
  --site-surface-alt: #181c29;
  --site-header-bg: rgba(11, 13, 19, 0.82);
  --site-hover: rgba(255, 255, 255, 0.06);
  --site-ink: #edf1f7;
  --site-muted: #94a3b8;
  --site-faint: #64748b;
  --site-accent: #60a5fa;
  --site-accent-soft: rgba(96, 165, 250, 0.14);
  --site-border: rgba(255, 255, 255, 0.1);
  --site-code-bg: #111520;
  --hljs-kw: #ff7b72;
  --hljs-str: #a5d6ff;
  --hljs-fn: #d2a8ff;
  --hljs-cmt: #8b949e;
  --hljs-num: #79c0ff;
  --hljs-type: #ffa657;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
}
html[data-theme="light"] {
  --site-bg: #ffffff;
  --site-surface: #f8fafc;
  --site-surface-alt: #f1f5f9;
  --site-header-bg: rgba(255, 255, 255, 0.86);
  --site-hover: rgba(15, 23, 42, 0.05);
  --site-ink: #0f172a;
  --site-muted: #475569;
  --site-faint: #64748b;
  --site-accent: #2563eb;
  --site-accent-soft: rgba(37, 99, 235, 0.08);
  --site-border: rgba(15, 23, 42, 0.1);
  --site-code-bg: #f8fafc;
  --hljs-kw: #cf222e;
  --hljs-str: #0a3069;
  --hljs-fn: #8250df;
  --hljs-cmt: #6e7781;
  --hljs-num: #0550ae;
  --hljs-type: #953800;
}
${customPolarityOverride}
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; background: var(--site-bg); }
body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  background: var(--site-bg);
  color: var(--site-ink);
  font-size: 16px;
  line-height: 1.72;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.site-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--site-bg);
  color: var(--site-ink);
}
.site-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--site-header-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--site-border);
}
.site-header-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.site-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  text-decoration: none;
  color: var(--site-ink);
  font-weight: 600;
  font-size: 14px;
  letter-spacing: -0.01em;
}
.site-brand-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--site-accent);
  box-shadow: 0 0 0 3px var(--site-accent-soft);
  flex-shrink: 0;
}
.site-brand-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.site-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.site-meta-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--site-muted);
  background: var(--site-surface);
  border: 1px solid var(--site-border);
}
.site-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 11px;
  border-radius: 7px;
  border: 1px solid var(--site-border);
  background: var(--site-surface);
  color: var(--site-ink);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.site-action-btn:hover {
  background: var(--site-hover);
  border-color: var(--site-accent);
}
html[data-theme="dark"] .theme-icon-moon { display: none; }
html[data-theme="light"] .theme-icon-sun { display: none; }
.site-main {
  flex: 1;
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: 40px 24px 72px;
}
.site-layout {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
}
.site-layout.has-toc {
  max-width: 1060px;
}
.container {
  width: 100%;
  min-width: 0;
  margin: 0 auto;
}
.article-hero {
  margin-bottom: 24px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--site-border);
}
.article-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--site-muted);
  margin-bottom: 10px;
}
.meta-dot { opacity: 0.45; }
.article-hero-title {
  margin: 0;
  font-size: clamp(1.85rem, 3.2vw, 2.45rem);
  font-weight: 750;
  line-height: 1.18;
  letter-spacing: -0.025em;
  color: var(--site-ink);
}
.article-body > h1:first-child {
  margin-top: 0;
  font-size: clamp(1.85rem, 3.2vw, 2.45rem);
  font-weight: 750;
  line-height: 1.18;
  letter-spacing: -0.025em;
}
.site-toc {
  display: none;
}
.toc-mobile {
  margin: 0 0 28px;
  background: var(--site-surface);
  border: 1px solid var(--site-border);
  border-radius: 10px;
  padding: 12px 16px;
}
.toc-mobile summary {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--site-muted);
  cursor: pointer;
  list-style: none;
}
.toc-mobile .toc { margin-top: 10px; }
@media (min-width: 960px) {
  .site-layout.has-toc {
    display: grid;
    grid-template-columns: minmax(0, 740px) 232px;
    justify-content: center;
    align-items: start;
    gap: 52px;
  }
  .toc-mobile { display: none; }
  .site-toc {
    display: block;
    position: sticky;
    top: 80px;
    max-height: calc(100vh - 104px);
    overflow-y: auto;
    padding-left: 16px;
    border-left: 1px solid var(--site-border);
  }
}
.toc-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--site-muted);
  margin-bottom: 10px;
}
.toc-list { list-style: none; padding: 0; margin: 0; }
.toc-list li { margin: 4px 0; font-size: 13px; line-height: 1.45; }
.toc-list a {
  display: block;
  color: var(--site-muted);
  text-decoration: none;
  padding: 2px 0;
  transition: color 0.12s ease;
}
.toc-list a:hover,
.toc-list a.is-active {
  color: var(--site-accent);
  font-weight: 500;
}
.toc-l2 { padding-left: 12px; }
.toc-l3 { padding-left: 24px; font-size: 12.5px; }
.article-body h1,
.article-body h2,
.article-body h3,
.article-body h4,
.article-body h5,
.article-body h6 {
  color: var(--site-ink);
  font-weight: 700;
  line-height: 1.28;
  letter-spacing: -0.015em;
  margin-top: 1.8em;
  margin-bottom: 0.6em;
  scroll-margin-top: 80px;
}
.article-body h2 {
  font-size: 1.45rem;
  padding-bottom: 0.35em;
  border-bottom: 1px solid var(--site-border);
}
.article-body h3 { font-size: 1.18rem; }
.article-body p { margin: 0 0 1.15em; color: var(--site-ink); }
.article-body ul, .article-body ol { margin: 0.6em 0 1.2em; padding-left: 1.55em; }
.article-body li { margin: 0.35em 0; }
.article-body a { color: var(--site-accent); text-decoration: none; font-weight: 500; }
.article-body a:hover { text-decoration: underline; text-underline-offset: 3px; }
.article-body hr {
  border: none;
  height: 1px;
  background: var(--site-border);
  margin: 2.2em 0;
}
.article-body :not(pre) > code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  background: var(--site-surface);
  border: 1px solid var(--site-border);
  padding: 2px 6px;
  border-radius: 5px;
  color: var(--site-accent);
}
.code-card {
  margin: 1.4em 0;
  background: var(--site-code-bg);
  border: 1px solid var(--site-border);
  border-radius: 10px;
  overflow: hidden;
}
.code-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 14px;
  background: var(--site-surface);
  border-bottom: 1px solid var(--site-border);
}
.code-lang {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--site-muted);
}
.code-copy-btn {
  padding: 3px 9px;
  border-radius: 5px;
  border: 1px solid var(--site-border);
  background: transparent;
  color: var(--site-muted);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.code-copy-btn:hover,
.code-copy-btn.is-copied {
  color: var(--site-accent);
  border-color: var(--site-accent);
  background: var(--site-accent-soft);
}
.code-card pre {
  margin: 0;
  padding: 16px 18px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 13.5px;
  line-height: 1.62;
  background: transparent;
  color: var(--site-ink);
}
.code-card pre code, .hljs {
  font-family: var(--font-mono);
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  color: var(--site-ink);
}
.hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-section { color: var(--hljs-kw); }
.hljs-string, .hljs-regexp, .hljs-meta .hljs-string { color: var(--hljs-str); }
.hljs-title, .hljs-title.function_, .hljs-title.class_ { color: var(--hljs-fn); }
.hljs-comment, .hljs-quote { color: var(--hljs-cmt); font-style: italic; }
.hljs-number, .hljs-attr, .hljs-attribute, .hljs-variable, .hljs-params { color: var(--hljs-num); }
.hljs-built_in, .hljs-type, .hljs-symbol { color: var(--hljs-type); }
.article-body blockquote {
  border-left: 3px solid var(--site-accent);
  background: var(--site-surface);
  padding: 12px 18px;
  margin: 1.4em 0;
  border-radius: 0 10px 10px 0;
  color: var(--site-muted);
}
.article-body blockquote p:last-child { margin-bottom: 0; }
.table-scroll {
  width: 100%;
  overflow-x: auto;
  margin: 1.5em 0;
  border: 1px solid var(--site-border);
  border-radius: 10px;
  background: var(--site-surface);
}
.table-scroll table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14.5px;
}
.table-scroll th, .table-scroll td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--site-border);
  border-right: 1px solid var(--site-border);
  text-align: left;
  vertical-align: top;
}
.table-scroll th:last-child, .table-scroll td:last-child { border-right: none; }
.table-scroll tr:last-child td { border-bottom: none; }
.table-scroll th {
  font-weight: 600;
  background: var(--site-surface-alt);
  color: var(--site-ink);
}
.article-body img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1.4em auto;
  border-radius: 10px;
  border: 1px solid var(--site-border);
}
.mermaid {
  display: flex;
  justify-content: center;
  margin: 1.4em 0;
  padding: 16px;
  background: var(--site-surface);
  border: 1px solid var(--site-border);
  border-radius: 10px;
}
.mermaid svg { max-width: 100% !important; height: auto !important; }
.mermaid-error {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.08);
  color: #f87171;
  font-size: 13px;
}
.wikilink {
  color: var(--site-accent);
  background: var(--site-accent-soft);
  padding: 1px 6px;
  border-radius: 5px;
  font-weight: 500;
}
.math-block { margin: 1.2em 0; text-align: center; overflow-x: auto; }
.site-footer {
  border-top: 1px solid var(--site-border);
  background: var(--site-surface);
}
.site-footer-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 18px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 13px;
  color: var(--site-muted);
}
.back-to-top {
  color: var(--site-accent);
  text-decoration: none;
  font-weight: 500;
}
.back-to-top:hover { text-decoration: underline; }
@media (max-width: 640px) {
  .site-main { padding: 24px 16px 48px; }
  .site-header-inner { padding: 10px 16px; }
  .site-meta-pill, .site-action-label { display: none; }
}
@media print {
  .site-header, .site-toc, .toc-mobile, .code-copy-btn, .site-footer { display: none !important; }
  html, body, .site-shell { background: #ffffff !important; color: #0f172a !important; }
  .site-main { max-width: none; padding: 0; }
}
${previewStageOverride}
  </style>
</head>
<body>
  <div id="top" class="site-shell">
    <header class="site-header">
      <div class="site-header-inner">
        <a class="site-brand" href="#top">
          <span class="site-brand-dot" aria-hidden="true"></span>
          <span class="site-brand-title">${escapeHtml(safeTitle)}</span>
        </a>
        <div class="site-header-actions">
          ${stats.words > 0 ? `<span class="site-meta-pill">${stats.minutes} min read</span>` : ''}
          <button type="button" class="site-action-btn" data-theme-toggle aria-label="Toggle color theme" title="Toggle light or dark theme">
            <span class="theme-icon-sun" aria-hidden="true">☀</span>
            <span class="theme-icon-moon" aria-hidden="true">☾</span>
            <span class="site-action-label">Theme</span>
          </button>
          <button type="button" class="site-action-btn" data-print-doc aria-label="Print document" title="Print">
            <span>Print</span>
          </button>
        </div>
      </div>
    </header>

    <main class="site-main">
      <div class="site-layout${hasToc ? ' has-toc' : ''}">
        <article class="container">
          <header class="article-hero">
            <div class="article-meta">
              <span>${escapeHtml(dateLabel)}</span>
              ${stats.words > 0 ? `<span class="meta-dot" aria-hidden="true">•</span><span>${stats.words.toLocaleString()} words</span><span class="meta-dot" aria-hidden="true">•</span><span>${stats.minutes} min read</span>` : ''}
            </div>
            ${showHeroTitle ? `<h1 class="article-hero-title">${escapeHtml(safeTitle)}</h1>` : ''}
          </header>
          ${hasToc ? `<details class="toc-mobile"><summary>On this page</summary>${tocHtml}</details>` : ''}
          <div class="article-body">
            ${enhancedBody}
          </div>
        </article>
        ${hasToc ? `<aside class="site-toc" aria-label="On this page"><div class="toc-title">On this page</div>${tocHtml}</aside>` : ''}
      </div>
    </main>

    <footer class="site-footer">
      <div class="site-footer-inner">
        <span>${escapeHtml(safeTitle)}</span>
        <a class="back-to-top" href="#top">Back to top ↑</a>
      </div>
    </footer>
  </div>
${script}
</body>
</html>`
}

export function buildSourcePreview(
  content: string,
  theme?: Record<string, string>,
  mode: 'markdown' | 'text' = 'markdown',
  title?: string
): string {
  const tokens = normalizeTheme(theme)
  const { stageBg, pageBorder, pageShadow } = getPreviewPageChrome(theme)
  const cssClass = mode === 'markdown' ? 'md' : 'txt'
  const extraCss =
    mode === 'markdown'
      ? `.md { width: 100%; margin: 0; font-family: var(--font-mono); font-size: 12.5px; line-height: 1.72; color: #1e293b; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: anywhere; tab-size: 2; }`
      : `.txt { width: 100%; margin: 0; font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.55; color: #1e293b; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: anywhere; }`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title || 'Preview')}</title>
  <style>
${themeVarsCss(tokens)}
${SHARED_SCROLLBAR_CSS}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: ${stageBg}; min-height: 100%; }
body {
  padding: 32px 24px;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.page {
  width: 100%;
  max-width: 760px;
  min-height: 1040px;
  margin: 12px auto 32px auto;
  background: #ffffff;
  padding: 52px 60px 60px 60px;
  border-radius: 4px;
  border: 1px solid ${pageBorder};
  box-shadow: ${pageShadow};
}
${extraCss}
  </style>
</head>
<body>
  <div class="page">
    <pre class="${cssClass}">${escapeHtml(content || '')}</pre>
  </div>
</body>
</html>`
}
