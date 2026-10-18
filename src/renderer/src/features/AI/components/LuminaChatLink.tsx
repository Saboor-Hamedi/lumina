import React from 'react'
import { navigateToWorkspaceEntity } from '../services/entityResolver'
import { LuminaEntityMention } from './LuminaEntityMention'
import '../css/chatMentions.css'

/**
 * Global helper to find and navigate to a workspace entity (note, folder, PDF, image, diagram, code file, or brain doc).
 */
export const openNoteInEditor = (rawTitle?: string | null, contextFolder?: string): void => {
  if (!rawTitle) return
  navigateToWorkspaceEntity(rawTitle, contextFolder)
}

export interface ChatLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string
  children?: React.ReactNode
}

/**
 * ChatLink formats markdown links, wikilinks, and entity mentions inside chat bubbles.
 * External links invoke native OS browser navigation; internal workspace entities
 * render with their semantic icon (folder, note, PDF, image, diagram, code) and open on click.
 */
export const ChatLink: React.FC<ChatLinkProps> = ({ href, children, ...props }) => {
  const isExternal = Boolean(href && /^(https?|mailto):/i.test(href))

  if (!isExternal || href?.startsWith('wikilink:') || href?.startsWith('folder:') || href?.startsWith('note:')) {
    const rawTarget = href
      ? href.replace(/^wikilink:/i, '')
      : String(children || '')
    const preferFolder = Boolean(href && /^folder:/i.test(href))

    return (
      <LuminaEntityMention
        target={rawTarget}
        label={children}
        preferFolder={preferFolder}
      />
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
