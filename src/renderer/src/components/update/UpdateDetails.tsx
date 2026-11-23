import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useUpdateStore } from '../../core/store/UpdateSetting'
import { Download, CheckCircle2 } from 'lucide-react'
import { PulseLoader } from '../PulseLoader'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import { useAppVersion } from '../../features/Settings/hook/useAppVersion'
import UpdateHeader from './UpdateHeader'
import UpdateFooter from './UpdateFooter'
import ToolTip from '../atoms/ToolTip'
import './UpdateDetails.css'

export const DEFAULT_RELEASE_NOTES = `New
- Tauri 2.0 Native Rust Engine: Migrated to Tauri 2.0 with direct crates/lumina_core linking, non-blocking async IPC, raw binary asset streaming, and ConPTY/PTY terminal support.
- In-App Update Downloader & Installer: Download platform installers directly inside Lumina with live progress tracking and one-click install & restart.
- Independent Split Graph Views (2D & 3D): Split Knowledge Graph panes vertically or horizontally and toggle 2D/3D mode or controls independently per pane.
- Dual Activity Bars & Docked Graph Sidebar: Dedicated left and right activity bars with compact icon-pill active states, parallel StatusBar alignment, and a docked scrollable Graph sidebar with embedded telemetry.
- Spatial Infinite Canvas (.canvas): 2D infinite spatial whiteboard with pan/zoom (10% to 500%), dot-grid canvas, vector shapes, magnetic snapping, and 90° orthogonal connector routing.
- Interactive Theme-Synchronized PDF & Batch Export: Export notes and folders to HTML, Markdown, Plain Text, Word (.doc), ZIP, or print-ready PDF with live preview and Table of Contents.

Improved
- Precision Paper & Ink UI System: Unified solid-surface context menus, submenus (2px gap, 11px typography), uniform 160px workspace tabs, and standardized Popover/Dialog/Button primitives.
- Sleek Lumina Chat Header & Command Palette: Moved chat actions into a compact icon dropdown, added split-pane and export commands to the Command Palette, and unified keycap styling.
- Faster Boot & Smoother Sidebars: Deferred heavy editor chunk preloading on the Welcome screen, enabled 220px default sidebars with smooth 100ms collapse transitions, and replaced custom spinners with global PulseLoader.

Fixed
- Zen Mode Individual Toggles & Breadcrumbs: Toggling Tabs, Title Bar, Activity Bar, Status Bar, or Breadcrumbs from the Command Palette now works individually inside Zen Mode, and Breadcrumbs renders on root notes by default.
- Google OAuth & Linker Reliability: Fixed Windows URL parameter handling in external OAuth sign-in and ensured clean cross-platform native builds.
- Breadcrumbs Long-Title Truncation: Long note titles truncate gracefully with responsive clamping and full hover tooltips.`

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

/**
 * Release notes parser supporting Markdown, GitHub HTML release bodies, arrays,
 * and empty/short/long inputs without exposing raw HTML tags.
 */
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

    // Detect markdown headings: # Title, ## Title, ### Title
    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch) {
      const headingTitle = stripHtmlTags(headingMatch[1].replace(/\*\*/g, ''))
      if (headingTitle) {
        currentCategory = { title: headingTitle, items: [] }
        categories.push(currentCategory)
      }
      continue
    }

    // Detect bullet points: - item, * item, • item, + item
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

    // Category header without markdown (e.g. "New", "Improved", "Fixed")
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

    // Fallback item in current or default category
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

  // If the release only had a heading with no body text, surface it cleanly under Highlights
  if (categories.length > 0 && categories[0].title) {
    return [{ title: 'Highlights', items: [categories[0].title] }]
  }

  const fallback = stripHtmlTags(text)
  return fallback ? [{ title: 'Notes', items: [fallback] }] : []
}

export const UpdateDetails: React.FC = () => {
  const { status, updateInfo, progress, download, install, check, lastChecked } = useUpdateStore()
  const currentVersion = useAppVersion()
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useKeyboardShortcuts({
    onEscape: isOpen
      ? () => {
          setIsOpen(false)
          return true
        }
      : null
  })

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        setIsOpen((open) => {
          if (open) {
            e.preventDefault()
            e.stopPropagation()
            return false
          }
          return open
        })
      }
    }

    document.addEventListener('pointerdown', handleClickOutside, { capture: true })
    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, { capture: true })
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [])

  const newVersion = updateInfo?.version || currentVersion

  // Curated release notes: Always use hardcoded release notes instead of remote GitHub notes
  const parsedNotes = useMemo(() => {
    return parseReleaseNotes(DEFAULT_RELEASE_NOTES)
  }, [])

  // Compute trigger button icon and tooltip dynamically
  const { triggerIcon, triggerTooltip, triggerClass } = useMemo(() => {
    const percentValue =
      typeof progress === 'number'
        ? progress
        : typeof (progress as any)?.percent === 'number'
          ? (progress as any).percent
          : 0
    const safePercent = isNaN(percentValue) ? 0 : Math.round(percentValue)

    if (status === 'installing') {
      return {
        triggerIcon: <PulseLoader size="xs" inline delayMs={0} message="" tone="current" />,
        triggerTooltip: 'Installing update...',
        triggerClass: 'has-update is-downloading'
      }
    }
    if (status === 'ready') {
      return {
        triggerIcon: <CheckCircle2 size={13} strokeWidth={2.2} />,
        triggerTooltip: 'Update ready — click to restart & install',
        triggerClass: 'has-update is-ready'
      }
    }
    if (status === 'downloading') {
      return {
        triggerIcon: <PulseLoader size="xs" inline delayMs={0} message="" tone="current" />,
        triggerTooltip: `Downloading update (${safePercent}%)...`,
        triggerClass: 'has-update is-downloading'
      }
    }
    if (status === 'available') {
      return {
        triggerIcon: <Download size={13} strokeWidth={2.2} />,
        triggerTooltip: `Update available (${newVersion})`,
        triggerClass: 'has-update'
      }
    }
    if (status === 'checking') {
      return {
        triggerIcon: <PulseLoader size="xs" inline delayMs={0} message="" tone="current" />,
        triggerTooltip: 'Checking for updates...',
        triggerClass: 'is-checking'
      }
    }
    return {
      triggerIcon: <Download size={13} strokeWidth={2} />,
      triggerTooltip: 'Check for updates',
      triggerClass: ''
    }
  }, [status, progress, newVersion])

  return (
    <div className="update-details-container" ref={dropdownRef}>
      <ToolTip text={triggerTooltip} position="bottom">
        <button
          className={`update-trigger-btn ${triggerClass}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Check for updates"
          aria-expanded={isOpen}
        >
          {triggerIcon}
        </button>
      </ToolTip>

      {isOpen && (
        <div className="update-details-dropdown" data-testid="update-details">
          <UpdateHeader
            currentVersion={currentVersion}
            newVersion={newVersion}
            status={status}
            progress={progress}
            download={download}
            install={install}
            check={check}
            onClose={() => setIsOpen(false)}
          />

          <div className="update-details-body selectable-text">
            {parsedNotes.map((category, i) => {
              const catKey = category.title.toLowerCase()
              const isNew = catKey.includes('new') || catKey.includes('feature')
              const isFixed = catKey.includes('fix')
              const isImproved = catKey.includes('improv') || catKey.includes('enhanc')

              const badgeType = isNew ? 'new' : isFixed ? 'fixed' : isImproved ? 'improved' : 'default'

              return (
                <div
                  key={i}
                  className={`release-category release-category-${badgeType}`}
                >
                  <div className="category-header">
                    <span className={`category-badge badge-${badgeType}`}>
                      {category.title}
                    </span>
                  </div>
                  <ul className="category-items">
                    {category.items.map((item, j) => {
                      const colonIdx = item.indexOf(': ')
                      if (colonIdx > 0 && colonIdx <= 48 && !item.slice(0, colonIdx).includes('http')) {
                        const title = item.slice(0, colonIdx)
                        const desc = item.slice(colonIdx + 1)
                        return (
                          <li key={j} className="release-item">
                            <span className="release-bullet">•</span>
                            <span className="release-text">
                              <strong className="release-item-title">{title}:</strong>
                              <span className="release-item-desc">{desc}</span>
                            </span>
                          </li>
                        )
                      }
                      return (
                        <li key={j} className="release-item">
                          <span className="release-bullet">•</span>
                          <span className="release-text">{item}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
            <div className="changelog-footer">
              <a
                href="https://github.com/Saboor-Hamedi/lumina/releases"
                target="_blank"
                rel="noreferrer"
                className="changelog-link"
              >
                View Full Changelog
              </a>
            </div>
          </div>

          <UpdateFooter
            currentVersion={currentVersion}
            lastChecked={lastChecked}
            status={status}
            progress={progress}
            install={install}
            download={download}
            check={check}
            newVersion={newVersion}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  )
}

export default UpdateDetails
