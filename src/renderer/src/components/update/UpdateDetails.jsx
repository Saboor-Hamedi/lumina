import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { Download, Loader2, CheckCircle2 } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import UpdateHeader from './UpdateHeader'
import UpdateFooter from './UpdateFooter'
import ToolTip from '../atoms/ToolTip'
import './UpdateDetails.css'

export const DEFAULT_RELEASE_NOTES = `New
- Google Drive Git-Like Mirroring: Backup your full workspace hierarchy as uncompressed individual Markdown and asset files directly into a clean "lumina/" root folder on Google Drive, preserving all nested folder paths.
- Individual Note Push: Push any active note and its full parent folder hierarchy to Google Drive on demand via a subtle Push button directly in the editor metadata bar, with pulse animations and instant confirmation.
- Dual Backup Formats: Choose between the traditional compressed (.zip) archive or the git-like mirror folder structure directly from the Settings dropdown.
- Cancel Backup Control: Safely abort ongoing Google Drive backups at any point with a dedicated sleek cancel button.
- PDF Workspace & Native Viewer: Open, zoom, pan, and read PDF documents directly in workspace tabs with instant cached tab switching and high-DPI rendering.
- Whisper Voice Dictation: Speak your thoughts directly into notes or Lumina composer with offline Whisper speech-to-text and a live floating soundwave capsule.

Improved
- Intelligent Cloud Hierarchy Resolution: Pushing a deeply nested note automatically ensures all ancestor folders exist on Google Drive without re-uploading unrelated files.
- Pre-Push Auto-Save: Pushing a note instantly synchronizes pending title edits and note contents before uploading to guarantee the cloud copy matches your local draft.
- Clean Status Notifications: Streamlined backup toasts to concise, non-intrusive messages ("Successfully backed up").
- Lightning-Fast Tab Switching: Move instantly between notes, PDFs, images, and graph view with zero UI lag or layout stutter.
- Search & Arrow Navigation: Search notes across nested folders with live highlighting, smooth arrow key traversal, and Enter to open.
- Comprehensive Test Suite: 100% passing tests across all 87 unit and integration test files, along with verified Playwright end-to-end automation.

Fixed
- Note Title & Disk Renaming: Fixed an issue where new notes titled "lumina" or edited titles remained saved as "New Note.md" on disk and pushed to Drive with placeholder names.
- Google Drive In-Place Renaming: Remote files on Google Drive are now renamed in-place when a local note title changes, avoiding duplicate cloud copies.
- File Watcher Loop Prevention: In-flight file renames are now shielded with ignored paths to prevent spurious deletion and watcher reload cycles.
- Active Note Synchronization: Switching tabs or opening search matches reliably highlights and scrolls to the active note in the folder tree.
- In-Place File Renaming: Renaming notes, images, or PDFs in the workspace renames entries directly without duplicating files or affecting source paths.`

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
  const [currentVersion, setCurrentVersion] = useState('1.0.42')
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

