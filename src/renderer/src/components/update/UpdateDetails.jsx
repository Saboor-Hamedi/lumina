import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useUpdateStore } from '../../core/store/UpdateSetting'
import { Download, Loader2, CheckCircle2 } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import UpdateHeader from './UpdateHeader'
import UpdateFooter from './UpdateFooter'
import ToolTip from '../atoms/ToolTip'
import './UpdateDetails.css'

export const DEFAULT_RELEASE_NOTES = `New
- Workspace Index Query Engine (luminaQueryIndex): Query your workspace like a database. Search and filter notes across tags (#tag), folders, incoming and outgoing wikilinks, YAML frontmatter, and headings with structured graph records.
- Dynamic Inline LuminaIndexBadge: Sleek inline search badge with live scan beam, active filter pills, matched note counters, and an expandable drawer with clickable note rows that open directly in the editor. Appears in natural document flow right where the query ran.
- In-App System Health Diagnostics (luminaDiagnoseSystem / /doctor): Live multi-subsystem diagnostic tool measuring latency across Disk I/O, IndexedDB, Notes Store, and Memory without cluttering disk files unless requested.
- Wikilink & Orphan Note Auditor (auditWikilinks / /audit): Scans workspace connectivity, highlights broken links and orphan notes, and offers immediate scaffolding for missing files.
- Spatial Infinite Canvas (.canvas): 2D infinite spatial whiteboard with pan/zoom (10% to 500%), dot-grid canvas, 12+ geometric vector shapes, dynamic shape ports, magnetic snapping, and 90° orthogonal connector routing.
- Live-Preview Markdown Highlighting (==highlight==): Real-time live preview for ==text== in the editor. Delimiters collapse into clean colored spans and reveal on cursor focus (Mod+Shift+H).

Improved
- Modularized CSS Architecture: Decomposed monolithic chat stylesheets into domain modules (indexBadge.css, healthBadge.css, auditBadge.css, treeBadge.css, memoryBadge.css, chatCode.css, chatThinking.css), cutting duplicate rules.
- Sleek TreeBadge Header: Low-profile 28px tree badge header with micro-stats and ghost copy button.
- Theme Polish & Porcelain Support: Authentic Porcelain theme integration across all badges with warm paper background variables (--bg-card: #eae6dd).
- Slash Commands & Natural Intent Routing: Added /index, /query, and /audit shortcuts with natural language intent routing.
- Code Block Image Export: Theme-aware solid backgrounds matching your active color palette instead of gradients.
- Canvas Ergonomics: Marquee selection, multi-node alignment toolbar, minimap radar HUD, and sticky note shortcuts (Ctrl+Enter).

Fixed
- Natural Badge Flow: Index badges now render sequentially inline at the inquiry point instead of being pinned to the top.
- Hex Color Tag Collision: Prevented 3/6-digit hex color codes (#38bdf8, #ffffff) from being falsely matched as tags.
- YAML Frontmatter Primitives: Correctly parses booleans and numbers in frontmatter attributes.
- LevelDB Dev Manifest Recovery: Automatically repairs and resets corrupted dev LevelDB manifests on startup.
- Breadcrumbs Long-Title Truncation: Long note titles truncate gracefully with responsive clamping and full hover tooltips.`

/**
 * Simple, clean release notes parser for our Markdown release notes.
 */
export const parseReleaseNotes = (notes) => {
  if (!notes) return []

  const text = typeof notes === 'string'
    ? notes
    : Array.isArray(notes)
      ? notes.map((n) => (typeof n === 'string' ? n : n?.note || n?.version || '')).filter(Boolean).join('\n\n')
      : ''

  const categories = []
  let currentCategory = null

  const lines = text.split('\n')
  for (let rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed) continue

    // Detect markdown headings: # Title, ## Title, ### Title
    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch) {
      currentCategory = { title: headingMatch[1].replace(/\*\*/g, '').trim(), items: [] }
      categories.push(currentCategory)
      continue
    }

    // Detect bullet points: - item, * item, • item, + item
    const bulletMatch = trimmed.match(/^[-*•+]\s+(.+)$/)
    if (bulletMatch) {
      if (!currentCategory) {
        currentCategory = { title: 'Highlights', items: [] }
        categories.push(currentCategory)
      }
      currentCategory.items.push(bulletMatch[1].trim())
      continue
    }

    // Category header without markdown (e.g. "New", "Improved", "Fixed")
    const cleanHeader = trimmed.replace(/[:：]$/, '').replace(/\*\*/g, '').trim()
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
    if (currentCategory) {
      currentCategory.items.push(trimmed)
    } else {
      currentCategory = { title: 'Highlights', items: [trimmed] }
      categories.push(currentCategory)
    }
  }

  return categories.length > 0 ? categories : [{ title: 'Notes', items: [text] }]
}

const UpdateDetails = () => {
  const { status, updateInfo, progress, download, install, check, lastChecked } = useUpdateStore()
  const [currentVersion, setCurrentVersion] = useState('1.0.62')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useKeyboardShortcuts({
    onEscape: isOpen
      ? () => {
          setIsOpen(false)
          return true
        }
      : null
  })

  useEffect(() => {
    if (window.api?.getVersion) {
      window.api
        .getVersion()
        .then((ver) => {
          if (ver) setCurrentVersion(ver)
        })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e) => {
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

  // Always use our curated release notes directly in the body (ignoring GitHub tag blurbs)
  const parsedNotes = useMemo(() => parseReleaseNotes(DEFAULT_RELEASE_NOTES), [])

  // Compute trigger button icon and tooltip dynamically
  const { triggerIcon, triggerTooltip, triggerClass } = useMemo(() => {
    const percentValue =
      typeof progress === 'number'
        ? progress
        : typeof progress?.percent === 'number'
          ? progress.percent
          : 0
    const safePercent = isNaN(percentValue) ? 0 : Math.round(percentValue)

    if (status === 'ready') {
      return {
        triggerIcon: <CheckCircle2 size={13} strokeWidth={2.2} />,
        triggerTooltip: 'Update ready — click to restart & install',
        triggerClass: 'has-update is-ready'
      }
    }
    if (status === 'downloading') {
      return {
        triggerIcon: <Loader2 size={13} strokeWidth={2.2} className="spin-animation" />,
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
        triggerIcon: <Loader2 size={13} strokeWidth={2} className="spin-animation" />,
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
                      const colonIdx = item.indexOf(':')
                      if (colonIdx !== -1) {
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

