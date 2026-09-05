import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatPreBlock } from './ChatPreBlock'
import { ChatInlineCode } from './ChatInlineCode'
import { ChatBlockquote } from './ChatBlockquote'
import { ChatLink } from './ChatLink'
import { ThinkingBlock } from './ThinkingBlock'
import { ActivityCard } from './ActivityCard'

export const processMarkdownContent = (raw) => {
  if (!raw) return ''
  let processed = raw.replace(/<readFile>([\s\S]*?)<\/readFile>/g, (match, inner) => {
    const titleMatch = inner.match(/title:\s*"([^"]+)"/)
    const fileName = titleMatch ? titleMatch[1] : 'File'
    return `\n> 📄 **Reading:** ${fileName}\n`
  })

  // If backticks wrap a wikilink like `[[Title]]`, unwrap the backticks first
  processed = processed.replace(/`(\[\[.*?\]\])`/g, '$1')

  processed = processed.replace(/\[\[(.*?)\]\]/g, (match, inner) => {
    const [target, alias] = inner.split('|')
    const cleanTarget = target.trim()
    const displayText = (alias || cleanTarget).trim()
    return `[${displayText}](wikilink:${encodeURIComponent(cleanTarget)})`
  })

  processed = processed.replace(/([^\n])\s*([├└]──|│\s+[├└]──)/g, '$1\n$2')
  processed = processed.replace(/([├└]──[^\n]+?)\s+([├└]──)/g, '$1\n$2')

  const rawLines = processed.split('\n')
  let inFence = false
  const resultLines = []
  let treeBuffer = []

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    if (line.trim().startsWith('```')) {
      if (treeBuffer.length > 0) {
        resultLines.push('```lumina-tree\n' + treeBuffer.join('\n') + '\n```')
        treeBuffer = []
      }
      inFence = !inFence
      resultLines.push(line)
      continue
    }

    if (!inFence) {
      const isTreeLine =
        /[├└]──/.test(line) ||
        (treeBuffer.length > 0 && (/^[│\s]*[├└─]/.test(line) || /^📁/.test(line.trim()))) ||
        (/^📁\s+[^/\n]+\s*(?:\(root\)|→|--|\/)/i.test(line.trim()) &&
          i + 1 < rawLines.length &&
          /[├└]──/.test(rawLines[i + 1]))

      if (isTreeLine) {
        treeBuffer.push(line)
        continue
      }
    }

    if (treeBuffer.length > 0) {
      resultLines.push('```lumina-tree\n' + treeBuffer.join('\n') + '\n```')
      treeBuffer = []
    }
    resultLines.push(line)
  }

  if (treeBuffer.length > 0) {
    resultLines.push('```lumina-tree\n' + treeBuffer.join('\n') + '\n```')
  }

  return resultLines.join('\n')
}

export const MessageContent = React.memo(
  ({ content, isStreaming = false }) => {
    const { thinkContent, beforeContent, activityContent, afterContent } = useMemo(() => {
      if (!content) return { thinkContent: '', beforeContent: '', activityContent: '', afterContent: '' }

      let think = ''
      let remaining = content

      const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/i)
      if (thinkMatch) {
        think = thinkMatch[1]
        remaining = remaining.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim()
      }

      let beforeText = ''
      let activityText = ''
      let afterText = ''

      const actMatches = [...remaining.matchAll(/<lumina-activity>([\s\S]*?)<\/lumina-activity>/gi)]
      if (actMatches.length > 0) {
        activityText = actMatches.map((m) => (m[1] || '').trim()).filter(Boolean).join('\n')
        const firstIdx = remaining.search(/<lumina-activity>/i)
        const lastIdx = remaining.toLowerCase().lastIndexOf('</lumina-activity>')
        beforeText = firstIdx !== -1 ? remaining.slice(0, firstIdx).trim() : ''
        afterText = lastIdx !== -1 ? remaining.slice(lastIdx + '</lumina-activity>'.length).trim() : ''
      } else {
        const partialAct = remaining.match(/([\s\S]*?)<lumina-activity>([\s\S]*)$/i)
        if (partialAct) {
          beforeText = (partialAct[1] || '').trim()
          activityText = (partialAct[2] || '').trim()
        } else {
          const lines = remaining.split('\n')
          const actionLines = []
          let firstActionIdx = -1
          let lastActionIdx = -1

          const isActionLine = (l) => {
            return (
              l.startsWith('- Created') ||
              l.startsWith('Created folder') ||
              l.startsWith('Renamed folder') ||
              l.startsWith('Renamed note') ||
              l.startsWith('Renamed file') ||
              l.startsWith('- 📁') ||
              l.startsWith('- 📝') ||
              l.startsWith('📁 *Creating') ||
              l.startsWith('📝 *Drafting') ||
              /^(?:[-*•]\s*)?(?:Created|Renamed)\s+(?:folder|\*\*|\[\[|[a-zA-Z0-9_]+)/i.test(l)
            )
          }

          for (let i = 0; i < lines.length; i++) {
            const l = lines[i].trim()
            if (!l) continue
            if (isActionLine(l)) {
              if (firstActionIdx === -1) firstActionIdx = i
              lastActionIdx = i
              actionLines.push(l)
            } else if (firstActionIdx !== -1) {
              break
            }
          }

          if (actionLines.length >= 1 && firstActionIdx !== -1) {
            activityText = actionLines.join('\n')
            beforeText = lines.slice(0, firstActionIdx).join('\n').trim()
            afterText = lines.slice(lastActionIdx + 1).join('\n').trim()
          } else {
            beforeText = remaining
          }
        }
      }

      beforeText = beforeText.replace(/<\/?lumina-activity>/gi, '').trim()
      afterText = afterText.replace(/<\/?lumina-activity>/gi, '').trim()

      return {
        thinkContent: think,
        beforeContent: beforeText,
        activityContent: activityText,
        afterContent: afterText
      }
    }, [content])

    const processedBefore = useMemo(() => processMarkdownContent(beforeContent), [beforeContent])
    const processedAfter = useMemo(() => processMarkdownContent(afterContent), [afterContent])

    const markdownComponents = useMemo(
      () => ({
        pre: ChatPreBlock,
        code: ChatInlineCode,
        blockquote: ChatBlockquote,
        a: ChatLink,
        table: ({ children }) => (
          <div className="table-wrapper chat-table-wrapper">
            <table>{children}</table>
          </div>
        )
      }),
      []
    )

    return (
      <>
        {thinkContent && (
          <ThinkingBlock thinkContent={thinkContent} isStreaming={isStreaming} />
        )}
        {processedBefore && (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {processedBefore}
          </ReactMarkdown>
        )}
        {activityContent && (
          <ActivityCard rawContent={activityContent} isStreaming={isStreaming} />
        )}
        {processedAfter && (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {processedAfter}
          </ReactMarkdown>
        )}
      </>
    )
  },
  (prevProps, nextProps) => {
    return prevProps.content === nextProps.content && prevProps.isStreaming === nextProps.isStreaming
  }
)

export default MessageContent
