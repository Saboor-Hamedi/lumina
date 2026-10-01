import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useUpdateStore } from '../../core/store/UpdateSetting'
import { Download, Loader2, CheckCircle2 } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import UpdateHeader from './UpdateHeader'
import UpdateFooter from './UpdateFooter'
import ToolTip from '../atoms/ToolTip'
import './UpdateDetails.css'

export const DEFAULT_RELEASE_NOTES = `New
- Interactive Theme-Synchronized PDF Export: Export notes and entire vaults to polished, publication-ready PDFs with live preview, auto-generated Table of Contents, page numbers, and exact theme matching across Dark, Light, and Porcelain palettes.
- Knowledge Graph Vector & Image Export (SVG & PNG): Download your 2D knowledge topography as scalable vectors or high-resolution images directly from the graph controls.
- Persistent Node Layout & Elastic Central Physics: Dragged nodes retain their coordinates across app sessions via localStorage persistence, while central hub notes spring back elastically to equilibrium upon release.
- Batch Export Engine: Export multiple selected notes or full folder trees into a single combined document or separate files with live progress tracking.
- Workspace Index Query Engine (luminaQueryIndex): Query your workspace like a database. Search and filter notes across tags (#tag), folders, incoming and outgoing wikilinks, YAML frontmatter, and headings with structured graph records.
- Spatial Infinite Canvas (.canvas): 2D infinite spatial whiteboard with pan/zoom (10% to 500%), dot-grid canvas, 12+ geometric vector shapes, dynamic shape ports, magnetic snapping, and 90° orthogonal connector routing.

Improved
- Modularized Graph Subsystem: Fully migrated Graph architecture into strict TypeScript with dedicated 2D canvas (Graph2D), 3D WebGL (Graph3D), and web-worker physics modules.
- Streamlined Graph Sidebar & HUD: Minimalist header with direct search and instant collapse, zero-scroll controls layout, and unobtrusive performance telemetry.
- Automated Publishing Pipeline (npm run publish): One-command automated build and GitHub release deployment with zero manual steps.
- Code Block Image Export: Theme-aware solid backgrounds matching your active color palette instead of gradients.
- Porcelain Theme Polish: Authentic warm paper palette integration across all export engines, graph canvases, and diagnostic badges.

Fixed
- Central Hub Drag Freeze: Fixed issue where dragging central nodes caused them to stay frozen in place instead of smoothly springing back to equilibrium.
- Dynamic Import Resolution: Resolved path casing and module resolution bugs across graph components.
- Theme Fallbacks: Corrected dark background fallbacks on light themes across graph panels and export previews.
- Hex Color Tag Collision: Prevented 3/6-digit hex color codes (#38bdf8, #ffffff) from being falsely matched as tags.
- Breadcrumbs Long-Title Truncation: Long note titles truncate gracefully with responsive clamping and full hover tooltips.`

export interface ReleaseCategory {
  title: string
  items: string[]
}

/**
 * Simple, clean release notes parser for our Markdown release notes.
 */
export const parseReleaseNotes = (notes?: unknown): ReleaseCategory[] => {
  if (!notes) return []

  const text =
    typeof notes === 'string'
      ? notes
      : Array.isArray(notes)
        ? notes
            .map((n) => (typeof n === 'string' ? n : (n as any)?.note || (n as any)?.version || ''))
            .filter(Boolean)
            .join('\n\n')
        : ''

  const categories: ReleaseCategory[] = []
  let currentCategory: ReleaseCategory | null = null

  const lines = text.split('\n')
  for (const rawLine of lines) {
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

export const UpdateDetails: React.FC = () => {
  const { status, updateInfo, progress, download, install, check, lastChecked } = useUpdateStore()
  const [currentVersion, setCurrentVersion] = useState<string>('1.0.65')
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
    if ((window as any).api?.getVersion) {
      (window as any).api
        .getVersion()
        .then((ver: string) => {
          if (ver) setCurrentVersion(ver)
        })
        .catch(() => {})
    }
  }, [])

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

  // Parse notes from incoming update info if available, otherwise use curated release notes
  const parsedNotes = useMemo(() => {
    if (updateInfo?.releaseNotes) {
      const parsed = parseReleaseNotes(updateInfo.releaseNotes)
      if (parsed.length > 0 && parsed[0].items.length > 0) {
        return parsed
      }
    }
    return parseReleaseNotes(DEFAULT_RELEASE_NOTES)
  }, [updateInfo?.releaseNotes])

  // Compute trigger button icon and tooltip dynamically
  const { triggerIcon, triggerTooltip, triggerClass } = useMemo(() => {
    const percentValue =
      typeof progress === 'number'
        ? progress
        : typeof (progress as any)?.percent === 'number'
          ? (progress as any).percent
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
