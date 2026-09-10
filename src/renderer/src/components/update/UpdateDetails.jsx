import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { Download, Loader2, CheckCircle2 } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import UpdateHeader from './UpdateHeader'
import UpdateFooter from './UpdateFooter'
import ToolTip from '../atoms/ToolTip'
import './UpdateDetails.css'

export const DEFAULT_RELEASE_NOTES = `New
- World-Class Multilingual Typography: Paired all user fonts with an enterprise-grade fallback cascade: Vazirmatn, Segoe UI Variable Text, Geeza Pro, Tahoma, PingFang SC, Hiragino Sans, Microsoft YaHei, Yu Gothic UI, and Malgun Gothic. Added Vazirmatn (premier modern Persian/Arabic font) directly to Settings and Google Fonts.
- Dynamic Bidirectional (RTL/LTR) Editor: Viewport-scoped CodeMirror 6 extension automatically detects line direction using the Unicode Bidirectional Algorithm ("first strong" heuristic). Persian, Arabic, Hebrew, and Urdu paragraphs align right naturally while code and English stay left-aligned at smooth 60 FPS.
- Resilient Bidi Wikilinks: Bracket syntax is isolated with unicode-bidi: isolate, preventing [[ and ]] from visually inverting or mirroring in RTL text. Notes link by canonical keys so Persian and Arabic letter variations (ی/ک vs ي/ك, ZWNJ) resolve to the exact same note without altering displayed titles.
- CJK IME Composition Guard: Chinese (Pinyin) and Japanese (Kana/Romaji) typing sessions are guarded—autocomplete popups and Enter/Escape/Tab keys never cancel or steal active candidate selection.
- Infinite Canvas Multi-Script Cards: Note cards on the spatial canvas now automatically detect text direction (dir="auto") across card titles, markdown body previews, and inline editing textareas with comfortable 1.65 line-height.
- Connected Knowledge Graph & Search: 2D & 3D Knowledge Graph builder links notes via canonical keys, eliminating ghost nodes from spelling variations. Command Palette (Ctrl+P) and Sidebar Search rank Persian, Arabic, and CJK notes instantly.
- Draggable Modals & Position Memory: Theme and Icon Picker modals now feature zero-latency GPU-accelerated dragging via their header bars. Position is remembered across selections and actions without snapping back to center.
- Guide-Matched Premium Modal Architecture: Rebuilt both Theme and Icon Picker modals to mirror the exact typography, breadcrumbs, step counters, and clean geometry of the Lumina Guide modal.
- 50+ New Curated Lucide Icons: Greatly expanded the workspace icon library with new categories for Science & Math, Nature & Travel, Hardware, and Productivity Symbols.
- AI Memory Profile & Management: Dedicated AI Memory tab in Settings to inspect, edit, and curate persistent memory stored in memory.json. Customize your User Identity, User Preferences, and Learned Facts with instant inline editing.

Improved
- Zero-Blur Crisp Modals: Removed disruptive backdrop filters from Theme and Icon modals in favor of clean, performant high-contrast dark backdrops for instant rendering and readability.
- Comfortable Reading Line-Height: Optimized editor and canvas line-height to 1.65, giving breathing room to Arabic/Persian diacritics (tashkeel), high dots, and CJK ideograms.
- Weak & Neutral Script Skipping: First-strong direction detection looks past wikilink brackets, inline code, whitespace, and both ASCII and Persian/Arabic-Indic digits (۱۲۳ سلام correctly resolves to RTL).
- Ergonomic Theme Palettes: Softened Gruvbox Dark into a soothing retro amber palette; calibrated Dark, Cyberpunk, One Monokai, and Minimal Light to prevent eye fatigue.
- Tactile Smooth Toggle Switches: Redesigned the Quick Controls switch housing with a centered 18px knob, eliminating unwanted click deform/stretch animations for a solid tactile feel.
- Ultra-Slim Modal Scrollbars: Reduced scrollbar width in Theme and Icon grids to a sleek 5px transparent track with soft rounded pill thumbs.

Fixed
- Drive Push Runtime Reference Error: Fixed a ReferenceError crash (\`setWasPushedSinceEdit is not defined\`) that prevented the Google Drive Push button from completing successfully.
- Cross-Script Wikilink Duplication: Resolved an issue where linking notes using Arabic keyboard letters created duplicate orphan notes instead of resolving to existing Persian notes.
- RTL Wikilink Bracket Flipping: Fixed visual bracket inversion where typing [[ in Persian or Arabic caused brackets to mirror to the opposite side of the text.
- Icon Picker Modal Snap-Back: Resolved an issue where selecting or previewing an icon reset container coordinates and caused the window to jump back to center.
- Drive Push State Sticky Hover: Resolved an issue where the push button retained green background hover highlights after a successful upload.
- Sequential Thinking Dropdowns: Fixed an issue where multiple fragmented thinking dropdowns would appear across multi-step tool calls or after reflection delays.`

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

