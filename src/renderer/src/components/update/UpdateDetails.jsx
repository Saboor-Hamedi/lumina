import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { Download, Loader2, CheckCircle2, Sparkles } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import UpdateHeader from './UpdateHeader'
import UpdateFooter from './UpdateFooter'
import ToolTip from '../atoms/ToolTip'
import './UpdateDetails.css'

export const DEFAULT_RELEASE_NOTES = `New
- PDF Workspace & Native Viewer: Open, zoom, pan, and read PDF documents directly in workspace tabs with fast text search, thumbnail previews, and high-DPI rendering.
- Whisper Voice Dictation: Speak your thoughts directly into notes or Lumina composer with offline Whisper speech-to-text and a live floating soundwave capsule.
- Smart File Tree & Navigation: Seamlessly manage nested folders with drag-and-drop, folder pinning, smart auto-reveal, and instant keyboard navigation.
- Multi-Note AI Summarizer: Select single or multiple notes across folders and generate structured AI summaries, insights, and key takeaways with one click.
- Interactive Graph View: Explore connections, backlinks, and tags across your entire workspace in a fluid 2D network graph.
- KaTeX Math Formulas: Insert scientific formulas and mathematical equations with real-time rendering and syntax previews.

Improved
- Lightning-Fast Tab Switching: Move instantly between notes, PDFs, images, and graph view with zero UI lag or layout stutter.
- Search & Arrow Navigation: Search notes across nested folders with live highlighting, smooth arrow key traversal, and Enter to open.
- Editor Margins & Layout: Balanced sidebar margins and responsive padding when toggling sidebars or working in split views.
- Consistent Centered Windows: Settings, Documentation, and Template dialogs open centered on screen with smooth slide animations.
- Modern Glassmorphic UI: Polished dark theme styling, refined badge accents, and custom minimal scrollbars.

Fixed
- Active Note Synchronization: Switching tabs or opening search matches now reliably highlights and scrolls to the active note in the folder tree.
- PDF Security & Framing: Eliminated Content Security Policy conflicts and reload loops when loading workspace PDF files.
- In-Place File Renaming: Renaming notes, images, or PDFs in the workspace now renames entries directly without duplicating files or affecting source paths.
- Tooltip Bounds & Text Clamping: Long file and folder names now clamp neatly with ellipsis and stay within screen boundaries without clipping.
- Popup & Window Stability: Prevented dropdowns and dialogs from shifting positions or misaligning when opening.`

/**
 * Robust release notes parser handling markdown headings, bullets, HTML, and plain lists.
 */
export const parseReleaseNotes = (notes) => {
  if (!notes) return []

  let text = ''
  if (Array.isArray(notes)) {
    text = notes
      .map((n) => (typeof n === 'string' ? n : n?.note || n?.version || ''))
      .filter(Boolean)
      .join('\n\n')
  } else if (typeof notes === 'string') {
    text = notes
  } else {
    return []
  }

  // Strip HTML tags if HTML is detected
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li>/gi, '- ')
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n$1\n')
      .replace(/<[^>]+>/g, '')
  }

  const categories = []
  let currentCategory = null

  const lines = text.split('\n')
  for (let rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed) continue

    // Detect markdown headings: # Title, ## Title, ### Title
    const isHeading = /^#{1,6}\s+/.test(trimmed)
    if (isHeading) {
      const headingTitle = trimmed.replace(/^#{1,6}\s+/, '').replace(/\*\*/g, '').trim()
      currentCategory = { title: headingTitle, items: [] }
      categories.push(currentCategory)
      continue
    }

    // Detect bullet points: - item, * item, • item, + item, 1. item
    const isBullet = /^[-*•+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)
    if (isBullet) {
      const itemContent = trimmed.replace(/^[-*•+]\s+/, '').replace(/^\d+\.\s+/, '').trim()
      if (itemContent) {
        if (!currentCategory) {
          currentCategory = { title: 'Highlights', items: [] }
          categories.push(currentCategory)
        }
        currentCategory.items.push(itemContent)
      }
      continue
    }

    // Category header without markdown (e.g. "New", "Improved", "Fixed")
    const cleanHeader = trimmed.replace(/[:：]$/, '').replace(/\*\*/g, '').trim()
    const lower = cleanHeader.toLowerCase()
    const isCommonCategory =
      lower === 'new' ||
      lower === 'improved' ||
      lower === 'improvements' ||
      lower === 'fixes' ||
      lower === 'fixed' ||
      lower === 'highlights' ||
      lower === 'features' ||
      lower === 'changes' ||
      lower.startsWith('what')

    if (isCommonCategory || (!currentCategory && !trimmed.startsWith('-'))) {
      currentCategory = { title: cleanHeader, items: [] }
      categories.push(currentCategory)
      continue
    }

    // Fallback item in current or default category
    if (currentCategory) {
      currentCategory.items.push(trimmed)
    } else {
      currentCategory = { title: 'Updates', items: [trimmed] }
      categories.push(currentCategory)
    }
  }

  return categories.length > 0 ? categories : [{ title: 'Notes', items: [text] }]
}

const UpdateDetails = () => {
  const { status, updateInfo, progress, download, install, check, lastChecked } = useUpdateStore()
  const [currentVersion, setCurrentVersion] = useState('1.0.40')
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

  // Resolve release notes string from updateInfo or fallback
  const resolvedNotes = useMemo(() => {
    let raw = updateInfo?.releaseNotes
    if (Array.isArray(raw)) {
      raw = raw
        .map((r) => (typeof r === 'string' ? r : r?.note || r?.version || ''))
        .filter(Boolean)
        .join('\n')
    }

    if (typeof raw === 'string' && raw.trim()) {
      const lower = raw.toLowerCase()
      const isGeneric =
        lower.includes('latest development build') ||
        lower.includes('latest version') ||
        raw.trim().length < 15
      if (!isGeneric) {
        return raw
      }
    }

    return DEFAULT_RELEASE_NOTES
  }, [updateInfo?.releaseNotes])

  const parsedNotes = useMemo(() => parseReleaseNotes(resolvedNotes), [resolvedNotes])

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
        triggerIcon: <Sparkles size={13} strokeWidth={2.2} />,
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

