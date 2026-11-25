/**
 * =========================================================================
 * ReleaseNotesTab.tsx — Lumina Islands UI Release Notes & Unified Update Button
 * =========================================================================
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  RefreshCw,
  Download,
  RotateCcw,
  ExternalLink,
  Package,
  ChevronDown,
  ChevronRight,
  Copy,
  Check
} from 'lucide-react'
import {
  useUpdateStore,
  type ReleaseNoteEntry
} from '../../core/store/UpdateSetting'
import { useAppVersion } from '../../features/Settings/hook/useAppVersion'
import { PulseLoader } from '../PulseLoader'
import './ReleaseNotesTab.css'

export interface ReleaseCategory {
  title: string
  items: string[]
}

const decodeHtmlEntities = (str: string): string =>
  str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")

const stripHtmlTags = (str: string): string =>
  decodeHtmlEntities(str.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()

const parseHtmlToMarkdownLines = (html: string): string[] => {
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const lines: string[] = []
      const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = (node.textContent || '').replace(/\s+/g, ' ').trim()
          if (text) lines.push(text)
          return
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return
        const el = node as HTMLElement
        const tag = el.tagName.toLowerCase()
        if (tag === 'script' || tag === 'style') return
        if (/^h[1-6]$/.test(tag)) {
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
          if (text) lines.push(`# ${text}`)
          return
        }
        if (tag === 'li') {
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
          if (text) lines.push(`- ${text}`)
          return
        }
        if (tag === 'p' || tag === 'blockquote') {
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
          if (text) lines.push(text)
          return
        }
        el.childNodes.forEach(walk)
      }
      doc.body.childNodes.forEach(walk)
      if (lines.length > 0) return lines
    } catch {
      // Fall through to regex HTML normalization
    }
  }

  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(h[1-6]|p|li|div|blockquote|ul|ol)>/gi, '\n')
    .replace(/<h[1-6][^>]*>/gi, '# ')
    .replace(/<li[^>]*>/gi, '- ')
    .split('\n')
    .map((line) => stripHtmlTags(line))
    .filter(Boolean)
}

export const parseReleaseNotes = (notes?: unknown): ReleaseCategory[] => {
  if (!notes) return []

  const rawText =
    typeof notes === 'string'
      ? notes
      : Array.isArray(notes)
        ? notes
            .map((n) => (typeof n === 'string' ? n : (n as any)?.note || (n as any)?.version || ''))
            .filter(Boolean)
            .join('\n\n')
        : ''

  const text = rawText.trim()
  if (!text) return []

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(text)
  const lines = looksLikeHtml ? parseHtmlToMarkdownLines(text) : text.split('\n')

  const categories: ReleaseCategory[] = []
  let currentCategory: ReleaseCategory | null = null

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed) continue

    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch) {
      const headingTitle = stripHtmlTags(headingMatch[1].replace(/\*\*/g, ''))
      if (headingTitle) {
        currentCategory = { title: headingTitle, items: [] }
        categories.push(currentCategory)
      }
      continue
    }

    const bulletMatch = trimmed.match(/^[-*•+]\s+(.+)$/)
    if (bulletMatch) {
      const cleanItem = stripHtmlTags(bulletMatch[1])
      if (!cleanItem) continue
      if (!currentCategory) {
        currentCategory = { title: 'Highlights', items: [] }
        categories.push(currentCategory)
      }
      currentCategory.items.push(cleanItem)
      continue
    }

    const cleanHeader = stripHtmlTags(trimmed.replace(/[:：]$/, '').replace(/\*\*/g, ''))
    const lower = cleanHeader.toLowerCase()
    const isCategoryHeader =
      lower === 'new' ||
      lower === 'improved' ||
      lower === 'improvements' ||
      lower === 'fixes' ||
      lower === 'fixed' ||
      lower === 'highlights' ||
      lower === 'features' ||
      lower === 'changes'

    if (isCategoryHeader) {
      currentCategory = { title: cleanHeader, items: [] }
      categories.push(currentCategory)
      continue
    }

    const cleanLine = stripHtmlTags(trimmed)
    if (!cleanLine) continue
    if (currentCategory) {
      currentCategory.items.push(cleanLine)
    } else {
      currentCategory = { title: 'Highlights', items: [cleanLine] }
      categories.push(currentCategory)
    }
  }

  const nonEmpty = categories.filter((c) => c.items.length > 0)
  if (nonEmpty.length > 0) return nonEmpty

  if (categories.length > 0 && categories[0].title) {
    return [{ title: 'Highlights', items: [categories[0].title] }]
  }

  const fallback = stripHtmlTags(text)
  return fallback ? [{ title: 'Notes', items: [fallback] }] : []
}

const CURATED_FALLBACK_RELEASES: ReleaseNoteEntry[] = [
  {
    id: 211,
    tagName: 'v2.1.1',
    version: '2.1.1',
    name: 'Lumina 2.1.1',
    publishedAt: '2026-04-20T00:00:00Z',
    prerelease: false,
    isLatest: true,
    isInstalled: true,
    isNewerThanCurrent: false,
    htmlUrl: 'https://github.com/Saboor-Hamedi/lumina/releases/tag/v2.1.1',
    body: `### New
- **Release Notes Tab**: Built-in \`What's New\` tab with local ETag release cache (\`github_releases_cache.json\`) and offline fallback.
- **Window Transparency**: Native Win32 layered window opacity slider (\`20% – 100%\`) in Appearance settings.
- **Command Palette Modes**: \`Ctrl + P\` searches workspace notes, \`#tags\`, and \`@mentions\`; \`Ctrl + Shift + P\` searches settings and commands.

### Improved
- **Theme-Synced PDF & Breadcrumbs**: PDF viewer tabs and Breadcrumbs now follow the active light or dark theme automatically.
- **Note Header & Find Bar**: Locked \`Find.tsx\` search/replace inputs (\`256px × 30px\`), solid creation-time hover badge, and accent-colored timestamp in \`MetaBackground\`.

### Fixed
- **Memory Footprint (<200 MB)**: Capped background mounted editors to a 2-tab LRU, lazy-loaded KaTeX on demand, and removed idle startup preloads.
- **Zen Mode Window Drag**: Fixed \`Alt + Click\` dragging across all surfaces in Zen Mode.
- **Terminal Emoji & Nerd Fonts**: Isolated emoji glyph fallback so Powerline bricks and coding ligatures never break.`,
    assets: []
  },
  {
    id: 210,
    tagName: 'v2.1.0',
    version: '2.1.0',
    name: 'Lumina 2.1.0',
    publishedAt: '2026-04-12T00:00:00Z',
    prerelease: false,
    isLatest: false,
    isInstalled: false,
    isNewerThanCurrent: false,
    htmlUrl: 'https://github.com/Saboor-Hamedi/lumina/releases/tag/v2.1.0',
    body: `### New
- **Islands UI Layout**: Floating workspace panels with \`10px\` border radius and synchronized \`100ms\` collapse transitions.
- **Split-Pane Graph & Editor**: Independent 2D/3D Knowledge Graph and Markdown split views.
- **Note Covers & Avatars**: Per-note cover gradients, images, and profile emojis stored in \`app_config.json\`.`,
    assets: []
  },
  {
    id: 153,
    tagName: 'v1.5.3',
    version: '1.5.3',
    name: 'Lumina 1.5.3',
    publishedAt: '2026-03-28T00:00:00Z',
    prerelease: false,
    isLatest: false,
    isInstalled: false,
    isNewerThanCurrent: false,
    htmlUrl: 'https://github.com/Saboor-Hamedi/lumina/releases/tag/v1.5.3',
    body: `### New
- **Tauri 2.0 Rust Core**: Direct \`crates/lumina_core\` linking with multithreaded Rayon vault indexing and sub-millisecond search.
- **Integrated ConPTY Terminal**: Multi-tab terminal dock with automatic shell discovery.`,
    assets: []
  },
  {
    id: 150,
    tagName: 'v1.5.0',
    version: '1.5.0',
    name: 'Lumina 1.5.0',
    publishedAt: '2026-03-15T00:00:00Z',
    prerelease: false,
    isLatest: false,
    isInstalled: false,
    isNewerThanCurrent: false,
    htmlUrl: 'https://github.com/Saboor-Hamedi/lumina/releases/tag/v1.5.0',
    body: `### New
- **Spatial Canvas (\`.canvas\`)**: Infinite whiteboard with pan/zoom, vector shapes, magnetic snapping, and orthogonal connectors.
- **Document Export**: Export notes to PDF, HTML, Word (\`.doc\`), Markdown Bundle, and ZIP.`,
    assets: []
  },
  {
    id: 142,
    tagName: 'v1.4.2',
    version: '1.4.2',
    name: 'Lumina 1.4.2',
    publishedAt: '2026-02-25T00:00:00Z',
    prerelease: false,
    isLatest: false,
    isInstalled: false,
    isNewerThanCurrent: false,
    htmlUrl: 'https://github.com/Saboor-Hamedi/lumina/releases/tag/v1.4.2',
    body: `### New
- **50 Built-In Themes**: Token-driven theme engine across light and dark palettes.
- **KaTeX & Mermaid**: Live math blocks and zoomable Mermaid diagram lightboxes.`,
    assets: []
  }
]

function formatReleaseDate(iso?: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return iso
  }
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

export const ReleaseNotesTab: React.FC = () => {
  const {
    status,
    updateInfo,
    progress,
    releases,
    releasesLoading,
    selectedReleaseVersion,
    setSelectedReleaseVersion,
    fetchReleases,
    check,
    download,
    install
  } = useUpdateStore()

  const appVersion = useAppVersion() || '2.1.1'
  const [assetsExpanded, setAssetsExpanded] = useState(false)
  const [copiedSha, setCopiedSha] = useState<string | null>(null)

  useEffect(() => {
    void fetchReleases(false)
  }, [fetchReleases])

  const normalizedCurrent = useMemo(
    () => String(appVersion || '2.1.1').replace(/^v/i, '').trim(),
    [appVersion]
  )

  const displayReleases: ReleaseNoteEntry[] = useMemo(() => {
    const source = releases && releases.length > 0 ? releases : CURATED_FALLBACK_RELEASES
    return source.map((r, idx) => {
      const cleanVer = String(r.version || r.tagName || '').replace(/^v/i, '').trim()
      return {
        ...r,
        version: cleanVer,
        isLatest: idx === 0,
        isInstalled: cleanVer === normalizedCurrent
      }
    })
  }, [releases, normalizedCurrent])

  const selectedRelease: ReleaseNoteEntry = useMemo(() => {
    if (selectedReleaseVersion) {
      const found = displayReleases.find((r) => r.version === selectedReleaseVersion)
      if (found) return found
    }
    return displayReleases[0]
  }, [displayReleases, selectedReleaseVersion])

  const latestVersion = displayReleases[0]?.version || updateInfo?.version || normalizedCurrent
  const isChecking = status === 'checking' || releasesLoading
  const isDownloading = status === 'downloading'
  const isReady = status === 'ready'
  const isAvailable =
    status === 'available' ||
    Boolean(displayReleases[0]?.isNewerThanCurrent)

  const handlePrimaryAction = useCallback(() => {
    if (isReady) {
      void install()
    } else if (isAvailable) {
      void download()
    } else {
      void check()
      void fetchReleases(true)
    }
  }, [isReady, isAvailable, install, download, check, fetchReleases])

  const handleOpenExternal = useCallback((url: string) => {
    const api = (window as any).api
    if (api?.openExternal) {
      void api.openExternal(url)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }, [])

  const handleCopySha = useCallback(async (sha: string) => {
    try {
      await navigator.clipboard?.writeText?.(sha)
      setCopiedSha(sha)
      setTimeout(() => setCopiedSha(null), 1500)
    } catch {}
  }, [])

  const percent = Math.min(100, Math.max(0, Math.round(progress?.percent || 0)))

  return (
    <div className="release-notes-tab" data-testid="release-notes-tab">
      {/* Compact 44px Locked Toolbar Header — Only Check for Updates / Action button */}
      <header className="release-notes-banner">
        <div className="release-notes-banner-actions">
          <button
            type="button"
            className="release-notes-btn is-primary"
            onClick={handlePrimaryAction}
            disabled={isChecking || isDownloading}
            data-testid="release-notes-primary-action"
          >
            {isChecking ? (
              <>
                <PulseLoader size="xs" inline delayMs={0} message="" tone="current" />
                <span>Checking…</span>
              </>
            ) : isDownloading ? (
              <>
                <Download size={12} />
                <span>Downloading {percent}%</span>
              </>
            ) : isReady ? (
              <>
                <RotateCcw size={12} />
                <span>Restart &amp; Install</span>
              </>
            ) : isAvailable ? (
              <>
                <Download size={12} />
                <span>Download v{updateInfo?.version || latestVersion}</span>
              </>
            ) : (
              <>
                <RefreshCw size={12} />
                <span>Check for Updates</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Download Progress Strip */}
      {isDownloading && (
        <div className="release-notes-progress-strip" role="status">
          <span>
            Downloading v{updateInfo?.version || latestVersion} ({percent}%)
            {progress?.total
              ? ` — ${formatBytes(progress.transferred)} / ${formatBytes(progress.total)}`
              : ''}
          </span>
          <div className="release-notes-progress-track">
            <div className="release-notes-progress-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {/* Split View: Left Release Rail + Right Changelog */}
      <div className="release-notes-split">
        <aside className="release-notes-rail" aria-label="Release History">
          <div className="release-notes-rail-header">
            <span>Versions</span>
            <span>{displayReleases.length}</span>
          </div>
          <div className="release-notes-rail-list">
            {displayReleases.map((rel) => {
              const isSelected = rel.version === selectedRelease?.version
              return (
                <button
                  key={rel.tagName || rel.version}
                  type="button"
                  className={`release-notes-rail-item${isSelected ? ' is-selected' : ''}`}
                  onClick={() => setSelectedReleaseVersion(rel.version)}
                  data-testid={`release-rail-item-${rel.version}`}
                >
                  <span className="release-notes-rail-version">v{rel.version}</span>
                  <span className="release-notes-rail-meta">
                    {rel.isInstalled ? (
                      <span className="release-notes-rail-pill">Current</span>
                    ) : rel.isLatest ? (
                      <span className="release-notes-rail-pill is-latest">Latest</span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Right Changelog Content Pane */}
        <section className="release-notes-content" aria-label="Release Changelog">
          {selectedRelease && (
            <>
              <div className="release-notes-article-header">
                <div className="release-notes-article-title-wrap">
                  <h2 className="release-notes-article-title">
                    {selectedRelease.name || `Lumina ${selectedRelease.version}`}
                  </h2>
                  <div className="release-notes-article-meta">
                    <span>v{selectedRelease.version}</span>
                    {selectedRelease.publishedAt && (
                      <>
                        <span>•</span>
                        <span>{formatReleaseDate(selectedRelease.publishedAt)}</span>
                      </>
                    )}
                    {selectedRelease.isInstalled && (
                      <>
                        <span>•</span>
                        <span>Installed</span>
                      </>
                    )}
                  </div>
                </div>

                {selectedRelease.htmlUrl && (
                  <button
                    type="button"
                    className="release-notes-btn"
                    onClick={() => handleOpenExternal(selectedRelease.htmlUrl)}
                  >
                    <ExternalLink size={12} />
                    <span>View Tag</span>
                  </button>
                )}
              </div>

              <div className="release-notes-markdown selectable-text">
                <ReactMarkdown
                  components={{
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        onClick={(e) => {
                          e.preventDefault()
                          if (href) handleOpenExternal(href)
                        }}
                      >
                        {children}
                      </a>
                    )
                  }}
                >
                  {selectedRelease.body || `Release notes for Lumina v${selectedRelease.version}.`}
                </ReactMarkdown>
              </div>

              {/* Collapsible Release Assets & SHA-256 Checksums */}
              {selectedRelease.assets && selectedRelease.assets.length > 0 && (
                <div className="release-notes-assets-card">
                  <button
                    type="button"
                    className="release-notes-assets-toggle"
                    onClick={() => setAssetsExpanded((prev) => !prev)}
                    aria-expanded={assetsExpanded}
                  >
                    <span className="release-notes-assets-toggle-left">
                      <Package size={13} />
                      <span>
                        Release Assets &amp; Checksums ({selectedRelease.assets.length})
                      </span>
                    </span>
                    {assetsExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>

                  {assetsExpanded && (
                    <div className="release-notes-assets-list">
                      {selectedRelease.assets.map((asset) => (
                        <div key={asset.name} className="release-notes-asset-row">
                          <div className="release-notes-asset-info">
                            <span className="release-notes-asset-name">{asset.name}</span>
                            <div className="release-notes-asset-sub">
                              <span>{formatBytes(asset.size)}</span>
                              {asset.downloadCount > 0 && (
                                <span>{asset.downloadCount.toLocaleString()} downloads</span>
                              )}
                              {asset.sha256 && (
                                <span
                                  className="release-notes-asset-sha"
                                  title={`SHA-256: ${asset.sha256}`}
                                >
                                  SHA-256: {asset.sha256.slice(0, 12)}…{asset.sha256.slice(-8)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {asset.sha256 && (
                              <button
                                type="button"
                                className="release-notes-btn"
                                onClick={() => handleCopySha(asset.sha256!)}
                                title="Copy SHA-256 checksum"
                              >
                                {copiedSha === asset.sha256 ? (
                                  <Check size={11} />
                                ) : (
                                  <Copy size={11} />
                                )}
                                <span>SHA-256</span>
                              </button>
                            )}
                            <button
                              type="button"
                              className="release-notes-btn"
                              onClick={() => handleOpenExternal(asset.browserDownloadUrl)}
                              title={`Download ${asset.name}`}
                            >
                              <Download size={11} />
                              <span>Download</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default React.memo(ReleaseNotesTab)
