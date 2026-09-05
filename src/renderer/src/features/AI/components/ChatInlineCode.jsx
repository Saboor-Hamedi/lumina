import React from 'react'
import { ChatLink } from './ChatLink'

export const ChatInlineCode = React.memo(({ className, children, ...props }) => {
  const textContent = String(children || '')

  // If the model wrapped a wikilink or markdown link in backticks, render it as a clickable link
  const linkMatch = textContent.match(/^\[(.*?)\]\((wikilink:[^)]+|https?:[^)]+)\)$/)
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
    return <ChatLink href={`wikilink:${encodeURIComponent(cleanTarget)}`}>{displayText}</ChatLink>
  }

  return (
    <code className={`chat-inline-code ${className || ''}`} {...props}>
      {children}
    </code>
  )
})

export default ChatInlineCode
