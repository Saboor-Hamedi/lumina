import React from 'react'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import '../css/chatMentions.css'

/**
 * Global helper to find and navigate to a note in the editor by title, filename, or ID.
 */
export const openNoteInEditor = (rawTitle?: string | null): void => {
  if (!rawTitle) return
  try {
    const { notes, setSelectedNote, setActiveTabId } = useWorkspaceStore.getState()
    const noteList = Array.isArray(notes) ? notes : []
    const clean = decodeURIComponent(rawTitle)
      .toLowerCase()
      .trim()
      .replace(/^#/, '')
      .replace(/\.md$/, '')
      .replace(/^file:\/\/\/?/, '')
      .split(/[/\\]/)
      .pop()

    if (!clean) return

    // 1. Exact title match
    let target = noteList.find(
      (s: any) => (s.title || '').toLowerCase().trim().replace(/\.md$/, '') === clean
    )
    // 2. Partial title match
    if (!target) {
      target = noteList.find((s: any) =>
        (s.title || '').toLowerCase().trim().replace(/\.md$/, '').includes(clean)
      )
    }
    // 3. ID match
    if (!target) {
      target = noteList.find((s: any) => s.id === rawTitle)
    }

    if (target) {
      if (setSelectedNote) setSelectedNote(target)
      if (setActiveTabId) setActiveTabId(target.id)
    } else {
      // 4. Brain document fallback: open in Documentation modal
      import('../services/brainKnowledge')
        .then(({ getBrainFile }) => {
          const bDoc = getBrainFile(clean)
          if (bDoc) {
            window.dispatchEvent(
              new CustomEvent('open-documentation', {
                detail: { doc: bDoc.path || bDoc.name }
              })
            )
            window.dispatchEvent(
              new CustomEvent('open-doc', {
                detail: { doc: bDoc.path || bDoc.name }
              })
            )
          }
        })
        .catch(() => {})
    }
  } catch (err) {
    console.error('Failed to open note in editor:', err)
  }
}

export interface ChatLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string
  children?: React.ReactNode
}

/**
 * ChatLink formats markdown and wikilinks inside chat bubbles.
 * External links invoke native OS browser navigation; internal notes open directly in Lumina editor.
 */
export const ChatLink: React.FC<ChatLinkProps> = ({ href, children, ...props }) => {
  const isExternal = href && /^(https?|mailto):/i.test(href)

  if (!isExternal || href?.startsWith('wikilink:')) {
    const rawTarget = href?.startsWith('wikilink:')
      ? href.replace('wikilink:', '')
      : href || String(children || '')

    return (
      <span
        className="chat-wikilink-chip"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openNoteInEditor(rawTarget)
        }}
        title={`Open note: ${decodeURIComponent(rawTarget)}`}
      >
        {children}
      </span>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="chat-external-link"
      onClick={(e) => {
        if ((window as any).electron?.ipcRenderer) {
          e.preventDefault()
          ;(window as any).electron.ipcRenderer.send('open-external-url', href)
        }
      }}
      {...props}
    >
      {children}
    </a>
  )
}

export const LuminaChatLink = ChatLink
export default ChatLink
