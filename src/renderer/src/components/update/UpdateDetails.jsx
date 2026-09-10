import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { Download, Loader2, CheckCircle2 } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import UpdateHeader from './UpdateHeader'
import UpdateFooter from './UpdateFooter'
import ToolTip from '../atoms/ToolTip'
import './UpdateDetails.css'

export const DEFAULT_RELEASE_NOTES = `New
- Floating Card UI Mode: Added a new "Floating Dock & Gaps UI" toggle in Settings → Look & Feel. When enabled, all panels — left sidebar, editor, right sidebar, and status bar — float as distinct rounded cards with 5px uniform gaps on every side, giving the workspace a modern, breathing layout.
- Uniform 5px Gap System: Every edge of every card (top, bottom, left, right) now uses exactly 5px of space — outer shell padding, inter-panel resizer width, and the gap between the workspace card and the status bar dock are all precisely 5px for a perfectly consistent layout.
- Floating Status Bar Dock: The status bar renders as a standalone rounded card (5px radius) floating at the bottom of the center column, fully separated from the editor — matching the visual language of the sidebar and workspace cards.
- Aligned Top Header Row: The left sidebar header, tab bar, and right sidebar header are all locked to 32px height, ensuring a perfectly level top edge across all three columns regardless of content.
- Sidebar Footer Gap: Added a clean 5px inner gap between the sidebar scrollable body and the profile footer card so the profile is visually separated and easy to click.

Improved
- Sidebar Footer Profile Card: The profile card in the sidebar footer is now 28px — matching the status bar height — so the entire bottom row of the app looks visually balanced. Removed conflicting inline height styles from Profile.jsx so CSS controls sizing cleanly across all render contexts.
- 5px Border Radius Everywhere: All floating cards — left sidebar, right sidebar, center workspace, status bar, welcome cards, composer card, session sidebar — use a consistent 5px border radius. No more mismatched 6px or 8px values.
- Status Bar Scrolling: The status bar now supports effortless horizontal scrolling (auto overflow with smooth scroll behavior and touch-action pan-x) so long status content is always accessible.
- Panel Gap Precision: The sidebar drag resizer is exactly 5px wide with zero flex gap, making the visual separation between sidebar cards and the editor card a clean, predictable 5px slot.
- Profile Card Radius Consistency: The profile footer card border radius is now 5px in all three CSS sources (profile.css, Sidebar.css, and the inline style in Profile.jsx) — no more competing values causing visual inconsistency.

Fixed
- Sidebar Bottom Gap Mismatch: Removed explicit height: 100% from sidebar card rules that caused sidebars to overflow the flex padding zone, making the bottom gap larger than the top/left/right 5px gaps. Flex stretch now handles height naturally and all four sides are equal.
- Status Bar Vertical Alignment: Removed a double-applied bottom padding (app-shell padding + shell-main padding) that pushed the status bar 10px from the window bottom instead of 5px, misaligning it with the sidebar card bottoms.
- Profile Height Conflict: Resolved a three-way height conflict (profile.css: 34px, Sidebar.css: 42px, Profile.jsx inline: 34px) by unifying all sources to 28px, ensuring the footer card is consistent everywhere it renders.`

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
  const [currentVersion, setCurrentVersion] = useState('1.0.43')
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

