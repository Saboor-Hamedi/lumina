import React from 'react'
import { useVaultStore } from '../../../core/store/workspaceStore'

export const openNoteInEditor = (rawTitle) => {
  if (!rawTitle) return
  try {
    const { snippets, setSelectedSnippet, setActiveTabId } = useVaultStore.getState()
    const snippetList = Array.isArray(snippets) ? snippets : Object.values(snippets || {})
    const clean = decodeURIComponent(rawTitle)
      .toLowerCase()
      .trim()
      .replace(/^#/, '')
      .replace(/\.md$/, '')
      .replace(/^file:\/\/\/?/, '')
      .split(/[/\\]/)
      .pop()

    // 1. Exact title match
    let target = snippetList.find(
      (s) => (s.title || '').toLowerCase().trim().replace(/\.md$/, '') === clean
    )
    // 2. Partial title match
    if (!target) {
      target = snippetList.find((s) =>
        (s.title || '').toLowerCase().trim().replace(/\.md$/, '').includes(clean)
      )
    }
    // 3. ID match
    if (!target) {
      target = snippetList.find((s) => s.id === rawTitle)
    }

    if (target) {
      if (setSelectedSnippet) setSelectedSnippet(target)
      if (setActiveTabId) setActiveTabId(target.id)
    }
  } catch (err) {
    console.error('Failed to open note in editor:', err)
  }
}

export const ChatLink = ({ href, children, ...props }) => {
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
        if (window.electron?.ipcRenderer) {
          e.preventDefault()
          window.electron.ipcRenderer.send('open-external-url', href)
        }
      }}
      {...props}
    >
      {children}
    </a>
  )
}

export default ChatLink
