import React from 'react'
import { ChatLink } from './LuminaChatLink'
import { resolveWorkspaceEntity } from '../services/entityResolver'

export interface ChatInlineCodeProps extends React.HTMLAttributes<HTMLElement> {
  className?: string
  children?: React.ReactNode
}

/**
 * ChatInlineCode intercepts inline code snippets and converts wrapped wikilinks,
 * @mentions, or workspace relative paths to clickable interactive entity references.
 */
export const ChatInlineCode: React.FC<ChatInlineCodeProps> = React.memo(
  ({ className, children, ...props }) => {
    const textContent = String(children || '').trim()

    // If the model wrapped a wikilink, folder link, or markdown link in backticks, render it as a clickable link
    const linkMatch = textContent.match(/^\[(.*?)\]\(((?:wikilink:|folder:|note:|https?:)[^)]+)\)$/)
    if (linkMatch) {
      const label = linkMatch[1]
      const href = linkMatch[2]
      return <ChatLink href={href}>{label}</ChatLink>
    }

    const wikiMatch = textContent.match(/^\[\[(.*?)\]\]$/)
    if (wikiMatch) {
      const [target, alias] = wikiMatch[1].split('|')
      const cleanTarget = target.trim()
      const displayText = (alias || cleanTarget).trim()
      return (
        <ChatLink href={`wikilink:${encodeURIComponent(cleanTarget)}`}>
          {displayText}
        </ChatLink>
      )
    }

    // If the model wrapped an explicit @mention or a workspace relative path (`Folder/File`) in backticks
    if (textContent.startsWith('@') && textContent.length > 1) {
      const target = textContent.slice(1).trim()
      const resolved = resolveWorkspaceEntity(target, undefined, { strictMatch: true })
      if (resolved.exists && resolved.type !== 'external') {
        const scheme = resolved.type === 'folder' ? 'folder:' : 'wikilink:'
        return (
          <ChatLink href={`${scheme}${encodeURIComponent(resolved.relativePath)}`}>
            {resolved.displayName}
          </ChatLink>
        )
      }
    }

    if (
      textContent.includes('/') &&
      !textContent.startsWith('/') &&
      !/\s{2,}|[;{}()=<>]/.test(textContent)
    ) {
      const resolved = resolveWorkspaceEntity(textContent, undefined, { strictMatch: true })
      if (resolved.exists && resolved.type !== 'external') {
        const scheme = resolved.type === 'folder' ? 'folder:' : 'wikilink:'
        return (
          <ChatLink href={`${scheme}${encodeURIComponent(resolved.relativePath)}`}>
            {resolved.displayName}
          </ChatLink>
        )
      }
    }

    return (
      <code className={`chat-inline-code ${className || ''}`} {...props}>
        {children}
      </code>
    )
  }
)

export default ChatInlineCode
