/**
 * ============================================================================
 * Preview Theme Tokens (`preview/themeTokens.js`)
 * ============================================================================
 * The preview iframe is a separate document and cannot read the app's CSS
 * variables, so the renderer sends its resolved theme tokens along with the
 * preview request. This module normalises them and emits shared CSS (reset,
 * premium scrollbars, themable surfaces) used by every preview format.
 * ============================================================================
 */

export const DEFAULT_THEME = {
  'bg-app': '#0e0f15',
  'bg-panel': '#13141c',
  'bg-sidebar': '#13141c',
  'bg-editor': '#161822',
  'bg-card': '#1a1c27',
  'bg-active': 'rgba(255, 255, 255, 0.06)',
  'text-main': '#f1f5f9',
  'text-muted': '#94a3b8',
  'text-faint': '#475569',
  'text-accent': '#6366f1',
  'border-dim': '#1e202e',
  'border-card': '#26293a',
  'border-subtle': 'rgba(255, 255, 255, 0.12)',
  'font-sans':
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  'font-mono': "'JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', monospace"
}

/**
 * Merges untrusted theme input over the defaults, accepting only short,
 * non-empty string values for known keys.
 *
 * @param {unknown} theme
 * @returns {Record<string, string>}
 */
export function normalizeTheme(theme) {
  const out = { ...DEFAULT_THEME }
  if (theme && typeof theme === 'object') {
    for (const key of Object.keys(DEFAULT_THEME)) {
      const value = theme[key]
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed && trimmed.length <= 96) out[key] = trimmed
      }
    }
  }
  return out
}

/**
 * Emits the `:root` custom-property block for a theme.
 * @param {unknown} theme
 * @returns {string}
 */
export function themeVarsCss(theme) {
  const t = normalizeTheme(theme)
  const lines = Object.entries(t).map(([key, value]) => `    --${key}: ${value};`)
  return `:root {\n${lines.join('\n')}\n  }`
}

/**
 * Heuristically decides whether a theme is light, based on the luminance of its
 * editor background. Used to pick a matching Mermaid diagram theme.
 *
 * @param {unknown} theme
 * @returns {boolean}
 */
export function isLightTheme(theme) {
  const t = normalizeTheme(theme)
  const hex = t['bg-editor']
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return false
  const int = parseInt(match[1], 16)
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  // Relative luminance (sRGB approximation)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.6
}

/**
 * Shared resets, premium scrollbars, and base typography for all previews.
 * @returns {string}
 */
export function basePreviewCss() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scrollbar-width: thin; scrollbar-color: var(--border-subtle) transparent; }
    ::-webkit-scrollbar { width: 11px; height: 11px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb {
      background: var(--border-subtle);
      border-radius: 999px;
      border: 3px solid transparent;
      background-clip: padding-box;
    }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-faint); background-clip: padding-box; }
    ::-webkit-scrollbar-corner { background: transparent; }
    ::selection { background: color-mix(in srgb, var(--text-accent) 35%, transparent); }
    html, body { background: var(--bg-editor); color: var(--text-main); }
    body {
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      padding: 40px 48px;
      min-height: 100vh;
    }
    a { color: var(--text-accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
  `
}

/**
 * Wraps arbitrary preview CSS/body into a complete HTML document.
 * @param {string} css
 * @param {string} body
 * @param {string} [title='Preview']
 * @param {string} [extraHead='']
 * @returns {string}
 */
export function wrapPreviewDocument(css, body, title = 'Preview', extraHead = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${extraHead}
  <style>
${css}
  </style>
</head>
<body>
${body}
<script>
  // Preview documents are rendered inside a sandboxed <iframe srcdoc>. Relative
  // links (including wikilinks emitted as href="#") would otherwise resolve
  // against the parent app URL and navigate the frame to the app itself. Block
  // all in-preview navigation so clicking a link can never load the app.
  (function () {
    function block(e) {
      var node = e.target;
      while (node && node.tagName !== 'A') node = node.parentElement;
      if (node && node.tagName === 'A') {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener('click', block, true);
    document.addEventListener('auxclick', block, true);
  })();
</script>
</body>
</html>`
}
