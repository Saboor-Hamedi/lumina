import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { Download, Loader2, CheckCircle2 } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import UpdateHeader from './UpdateHeader'
import UpdateFooter from './UpdateFooter'
import ToolTip from '../atoms/ToolTip'
import './UpdateDetails.css'

export const DEFAULT_RELEASE_NOTES = `New
- Live-Preview Markdown Highlighting (==highlight==): Real-time live preview for ==text== and == text == syntax in the markdown editor. Delimiters collapse into a clean, colored highlight span when the cursor is away, and gently reveal with Mod-Shift-H (Ctrl+Shift+H / Cmd+Shift+H) keyboard shortcut for quick toggling.
- Theme-Aware Code Block Image Export: Code block "Copy as image" now uses solid theme backgrounds (--bg-app, --bg-card) from your active theme instead of an artificial gradient, perfectly matching your color palette.
- Standalone Editor Zoom HUD Component: Extracted the bottom-right zoom percentage indicator into a standalone component with Lucide ZoomIn icon, theme-adaptive backdrop blur, and smooth entrance animation.
- Standardized ActivityBar 6-Button Stack: ActivityBar navigation has been standardized with a dedicated 6-button stack: 1. New Note, 2. Daily Note, 3. Knowledge Graph, 4. Canvas, 5. Lumina AI Chat, and 6. Lumina Mail. AI Chat and Mail icons are presented in a clean, borderless unaccented style.
- Instant Canvas Note Creation: Canvas button on the ActivityBar immediately creates a new .canvas note via saveSnippet and activates it directly in the editor workspace.
- Draggable Gmail Portal Modal: EmailContainer now renders into document.body via React createPortal with z-index: 100000, preventing sidebar resizers from capturing clicks. Features a dedicated WindowControls drag handle beside the Compose button in EmailSidebar for free viewport repositioning with localStorage coordinate persistence.
- Hardware Caps Lock Startup Detection: Added native Windows PowerShell hardware query ([Console]::CapsLock) via Electron IPC (system:isCapsLockOn) so the ambient glowing Caps Lock blob illuminates immediately on startup even before typing any keys.
- Core Notification System Refactoring: ToastNotification has been promoted to a clean, modular Notification system (Notification.jsx, css/notification.css, useNotification.ts, and index.ts public exports).
- TypeScript Template Architecture: Moved and typed template foundations (defaultTemplates.ts, useTemplate.ts) with full TypeScript interfaces and aligned test suites.
- Lumina Mail Client (Gmail Integration): A full-featured, private email suite seamlessly integrated into Lumina. Access your Gmail inbox, All Inboxes, Categories (Promotions, Social, Updates, Forums), custom labels, sent messages, drafts, and starred emails with rich HTML rendering, live search filtering, and one-click star/unread toggles.
- Modular 3-Pane Email Architecture: Cleanly separated into dedicated components (EmailSidebar, EmailListPane, and EmailDetailPane) with an elevated Compose button container, live folder search bar, and resizable layout panes.
- Programmatic Crystal Audio Synthesizer: Isolated Web Audio API engine (emailSoundService.ts) synthesizing a relaxing 3-note crystal chime on incoming email notifications with zero external audio dependencies and mute/unmute persistence.
- Desktop Notifications & High-Capacity Rounded Badge: Native OS notifications for new emails with click-to-open window focus, paired with a compact rounded unread count badge supporting counts into the millions.
- Email Composer with Note Attachment: Built-in composer with support for file attachments, CC/BCC, and one-click "Attach Current Note" directly from your active workspace note into email drafts.
- CapsLock Organic Blob Indicator: When Caps Lock is active, a glowing organic blob light illuminates at the very center of the status bar. Styled using the active accent color with soft ambient light reflections and zero boxy borders, it automatically turns off when Caps Lock is disabled.
- Compact Responsive StatusBar: Streamlined status bar metrics with 10px typography, compact icons, and responsive breakpoints, keeping the center strictly dedicated to the glowing indicator while preserving the exact profile button dimensions.
- Breadcrumbs Horizontal Keyboard Navigation: Smoothly jump across breadcrumb segments (Workspace → Folders → Note → Heading Outline) by pressing Ctrl + Left Arrow and Ctrl + Right Arrow with immediate dropdown activation.
- Unified Modal Geometry (900px × 76vh): Standardized all major modal dialogs (Preview, Settings, Theme, Graph, Documentation, Guide, Template, Lumina AI, and Lumina Mail) to identical dimensions, responsive maximums (94vw × 78vh), and 12px rounded glass cards.
- Persistent Modal Maximize/Restore State: Window states for Preview, Settings, Theme, Graph, Documentation, Guide, Template, Lumina AI, and Lumina Mail are remembered persistently across sessions via the settings engine.
- Unified Glass Overlay Blur: Elevated all modal backdrops to an identical glass blur aesthetic (blur(12px) saturate(180%)) while preserving IconPicker's dedicated light modal design.
- Premium Unified Scrollbar Engine (premimum-scroll.css): Centralized all custom scrollbar rules across modals and panels into an ultra-sleek, premium scrollbar design modeled after the preview modal.
- Interactive Breadcrumbs & Heading Outline: Breadcrumbs feature an active heading segment (# Section) dynamically tracking the editor cursor with instant search filter and Table of Contents outline dropdown.
- Unified Dropdown Geometry (320px × 340px): Dropdowns for Workspace, folder siblings, and heading outlines share identical, rock-solid dimensions matching the Workspace dropdown width, with invisible scrollbars and elegant ellipsis truncation on long titles.
- Quick Note Creation in Folders: Add a new note directly inside any folder via the + button in the dropdown header or on individual folder rows.
- Breadcrumb Drag-and-Drop: Drag notes or tabs directly onto Workspace or folder segments in the breadcrumb bar to move files instantly.
- Focus Breadcrumbs Shortcut: Focus and open breadcrumb navigation instantly with Ctrl + Shift + . (or Ctrl + Shift + ;). Note/Tab icon picker updated to Ctrl + Win + . to prevent key conflicts.
- Rich Word/HTML Paste with Format Preservation: Pasting from Microsoft Word (Ctrl + V) now preserves tables, headings, bold/italic, images, table of contents, references, and figure captions — converting them seamlessly to clean Markdown.
- Word Image Extraction: Images copied from Word documents are automatically saved to .lumina/assets/ and embedded inline. Supports VML (v:imagedata), standard img tags with file:/// paths, and system clipboard image buffer fallback.
- Paste as Plain Text: Ctrl + Shift + V now pastes raw unformatted text, bypassing all HTML conversion — useful for pasting code snippets or raw content without any rich formatting.
- Breadcrumbs Long-Title Truncation: Note titles of any length are now gracefully truncated in the breadcrumbs bar with ellipsis (…). Hovering reveals the full title. Scales responsively with the viewport (clamp 140px → 380px).

Improved
- Unified Inline Code Typography: Single backtick inline code (\`code\`) now seamlessly inherits the user-configured editor font family and font size instead of switching to a smaller, disparate monospace font.
- Code Block Architecture & TypeScript Migration: Consolidated all code block styling, headers, and image export mechanisms cleanly inside src/renderer/src/core/code/ with full TypeScript typings.
- Email Modal Viewport Dragging: Replaced bulky header drag bars with a sleek WindowControls button directly beside Compose, eliminating awkward modal shifting and providing smooth pointer tracking.
- Outside-Click Email Modal Toggle: Fixed double-toggle conflict where clicking the ActivityBar mail button while the modal was open would trigger both outside-click close and button-click open.
- TypeScript Migration Across Core Hooks: Converted useTemplate, defaultTemplates, and notification hooks to strict TypeScript types, improving developer ergonomics and runtime stability.
- Email Service TypeScript Migration: Converted src/main/email/gmailService.ts to TypeScript with comprehensive interfaces for Gmail API models, RFC 2822 Base64URL MIME message serialization, and IPC handlers.
- Instant Email Deletion & Thread Management: Email deletion executes optimistically without re-fetching entire mailbox lists, and email cards prevent layout shifts on hover.
- Template Modal Architecture: Templates modal now shares the 900px × 76vh geometry, custom window header buttons, and seamless maximize behavior.
- Guide Modal Elevation: Guide modal now supports window maximize/restore toggling with persistent state and updated overlay styling.
- Responsive Scrollbar Aesthetics: High-resolution scrollbar tracks and custom offset thumbs with smooth hover transitions everywhere across the application.
- Interactive Breadcrumb Key Interception: Ctrl + ArrowLeft and Ctrl + ArrowRight events are intelligently captured before internal list/search handlers can interfere.
- Standardized Custom ToolTips: All breadcrumb actions, navigation buttons, and counter pills now use Lumina's high-precision <ToolTip /> component with zero-background shortcut styling.
- Word Table Cell Cleaning: Table cells from Word paste are fully sanitized — no more raw <u>, <span>, <font>, or <br> tags leaking into Markdown tables. Names like Dr. Sajarwo Anggai., S.ST., M.T. paste correctly.
- Figure Captions Preserved: Figure numbers, captions, and the text between figures are now correctly extracted. The non-greedy VML conditional comment regex was hardened to never bridge across multiple figures.
- Table of Contents Formatting: Word TOC entries are converted to clean hierarchical Markdown lists (- and  -) with dot leaders stripped and tight vertical spacing.
- References Auto-Linking: Plain text URLs in references sections are auto-detected and formatted as Markdown hyperlinks, keeping references tight and readable.
- Paragraph Justification: Ragged mid-sentence line breaks from Word are normalized into continuous, smooth paragraphs.
- Voice Dictation Shortcut: Moved to Shift + Alt + V to free Ctrl + Shift + V for plain-text paste. Updated everywhere: keyboard engine, settings panel, tooltip, and documentation.
- Breadcrumbs Icon Stability: Breadcrumb icons now have flex-shrink: 0 and never collapse under layout pressure.

Fixed
- Inline Code Font Shrinking & Mismatched Typeface: Fixed issue where single backtick (\`code\`) rendered text noticeably smaller than surrounding body text due to third-party 0.88em CSS rules, and ensured it matches the configured editor font family.
- Code Image Background Gradient Clashing: Removed artificial hardcoded gradient backgrounds from code-to-image export in favor of clean, solid active theme colors.
- Media Extension 404 Route Resolutions: Removed stale .js file references in favor of strict TypeScript barrel exports in src/renderer/src/features/media/.
- Sidebar Resizer Overlapping Email Modal: Fixed issue where dragging the left sidebar resizer would capture pointer events or sit on top of the email modal by rendering EmailContainer into document.body via createPortal with z-index: 100000.
- CapsLock Initial State on App Launch: Fixed issue where Caps Lock was not detected until the first keypress by adding native PowerShell query via IPC on mount and window focus.
- Dropdown Width Auto-Expansion: Breadcrumb dropdowns no longer resize or balloon to 480px based on filename length. All dropdowns strictly adhere to the polished 320px width standard with ellipsis truncation.
- YAML Title Reversion Bug: Note titles containing YAML block scalar characters (>-, |, >, |+) no longer revert to - when renamed. safeParseFrontmatter correctly handles these as literal strings and sanitizeTitleForFilename preserves the raw title in frontmatter while only cleaning the disk filename.
- Figure Text Deletion: The conditional VML comment regex previously used a greedy pattern that bridged across multiple figures, consuming all text and captions between Figure 1 and Figure 2. Fixed with a negative lookahead so each comment block terminates strictly at its own closing delimiter.
- Jump Anchor Links in Paste: Internal Word anchor links (e.g. [1](#_Ref...)) that jumped to the next image are now flattened to clean plain text (1) with no clickable href.`

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

