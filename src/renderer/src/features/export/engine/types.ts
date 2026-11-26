export interface ExportResult {
  success: boolean
  filePath?: string
  bundleDir?: string | null
  isZip?: boolean
  canceled?: boolean
  total?: number
  exported?: number
  failed?: number
  combined?: boolean
  outputDir?: string
  error?: string
  failures?: Array<{ id: string; title: string; error: string }>
}

export interface BatchExportNoteInput {
  id?: string
  title?: string
  content?: string
}

export interface BatchExportProgress {
  phase: 'start' | 'rendering' | 'merging' | 'done' | 'error' | 'complete'
  current: number
  total: number
  title?: string
  filePath?: string
  error?: string
}

export interface ExportPayload {
  title?: string
  content?: string
  language?: string
  toc?: boolean
  compressZip?: boolean
  optimizeImages?: boolean
  stripMarkdown?: boolean
  includeTitle?: boolean
  theme?: Record<string, string>
  format?: string
  notes?: BatchExportNoteInput[]
}

export interface BatchExportPayload {
  notes: BatchExportNoteInput[]
  format: string
  toc?: boolean
  title?: string
  compressZip?: boolean
  archiveTitle?: string
  optimizeImages?: boolean
  stripMarkdown?: boolean
  includeTitle?: boolean
  theme?: Record<string, string>
  outputDir?: string
  filePath?: string
}

export interface PreviewResult {
  html: string
  format: string
  truncated: boolean
}

export interface CollectedLocalAsset {
  originalUrl: string
  relativePath: string
  filename: string
  mime: string
  bytes: Uint8Array
}

export const DEFAULT_THEME: Record<string, string> = {
  'bg-shell': '#0e0f15',
  'bg-surface': '#161822',
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
  'accent-color': '#6366f1',
  'border-color': '#26293a',
  'border-dim': '#1e202e',
  'border-card': '#26293a',
  'border-subtle': 'rgba(255, 255, 255, 0.12)',
  'font-sans':
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  'font-mono': "'JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', monospace"
}

export const SHARED_SCROLLBAR_CSS = `
html { scrollbar-width: thin; scrollbar-color: rgba(148, 163, 184, 0.28) transparent; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.28);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.45); background-clip: padding-box; }
::-webkit-scrollbar-corner { background: transparent; }
`

const batchProgressListeners = new Set<(progress: BatchExportProgress) => void>()

export function emitBatchProgress(progress: BatchExportProgress): void {
  batchProgressListeners.forEach((cb) => {
    try {
      cb(progress)
    } catch {
      /* ignore subscriber errors */
    }
  })
}

export function onBatchExportProgress(
  callback: (progress: BatchExportProgress) => void
): () => void {
  batchProgressListeners.add(callback)
  return () => {
    batchProgressListeners.delete(callback)
  }
}

export function safeFileName(name?: string): string {
  const cleaned = String(name || 'Untitled')
    .split('')
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 120)
  return cleaned || 'Untitled'
}

export function escapeHtml(text?: string | null): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/h[1-6]>|<\/div>|<\/li>|<\/blockquote>|<\/tr>/gi, '\n\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]*>?/gm, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizeTheme(theme?: Record<string, string>): Record<string, string> {
  const merged = { ...DEFAULT_THEME }
  if (theme && typeof theme === 'object') {
    for (const key of Object.keys(DEFAULT_THEME)) {
      const v = theme[key]
      if (typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 120) {
        merged[key] = v.trim()
      }
    }
  }
  return merged
}

export function isLightColorHexOrRgb(bg: string): boolean {
  const trimmed = bg.trim()
  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1)
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('')
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140
      }
    }
  }
  const m = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (m) {
    const r = Number(m[1])
    const g = Number(m[2])
    const b = Number(m[3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140
  }
  return false
}

export function themeVarsCss(theme?: Record<string, string>): string {
  const tokens = normalizeTheme(theme)
  const decls = Object.entries(tokens)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n')
  return `:root {\n${decls}\n}`
}

export function resolveHtmlMermaidMode(theme?: Record<string, string>): 'light' | 'dark' {
  if (!theme || Object.keys(theme).length === 0) return 'dark'
  return isLightColorHexOrRgb(normalizeTheme(theme)['bg-editor']) ? 'light' : 'dark'
}

export function resolvePreviewStageBg(theme?: Record<string, string>): string {
  const tokens = normalizeTheme(theme)
  return tokens['bg-editor'] || tokens['bg-surface'] || tokens['bg-app'] || '#161822'
}

export function getPreviewPageChrome(theme?: Record<string, string>): {
  stageBg: string
  isLightStage: boolean
  pageBorder: string
  pageShadow: string
} {
  const stageBg = resolvePreviewStageBg(theme)
  const isLightStage = isLightColorHexOrRgb(stageBg)
  return {
    stageBg,
    isLightStage,
    pageBorder: isLightStage ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.08)',
    pageShadow: isLightStage
      ? '0 8px 28px rgba(15, 23, 42, 0.1), 0 1px 3px rgba(15, 23, 42, 0.06)'
      : '0 12px 34px rgba(0, 0, 0, 0.42)'
  }
}
