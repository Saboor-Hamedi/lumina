import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatPreBlock } from './ChatPreBlock'
import { ChatInlineCode } from './ChatInlineCode'
import { ChatBlockquote } from './ChatBlockquote'
import { ChatLink } from './ChatLink'
import { ThinkingBlock } from './ThinkingBlock'
import { ActivityCard } from './ActivityCard'
import { processMarkdownContent, parseMessageSections, parseMessageBlocks } from '../services/chatMarkdownParser'

export { processMarkdownContent, parseMessageSections, parseMessageBlocks }

export const MessageContent = React.memo(
  ({ content, isStreaming = false }) => {
    const blocks = useMemo(() => {
      return parseMessageBlocks(content)
    }, [content])

    const lastThinkIdx = useMemo(() => {
      let idx = -1
      for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].type === 'think') idx = i
      }
      return idx
    }, [blocks])

    const markdownComponents = useMemo(
      () => ({
        pre: ChatPreBlock,
        code: ChatInlineCode,
        blockquote: ChatBlockquote,
        a: ChatLink,
        hr: ({ ...props }) => <hr className="horizontal" {...props} />,
        table: ({ children }) => (
          <div className="table-wrapper chat-table-wrapper">
            <table>{children}</table>
          </div>
        ),
        input: ({ type, checked, ...props }) => {
          if (type === 'checkbox') {
            return (
              <input
                type="checkbox"
                defaultChecked={checked}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => e.stopPropagation()}
                {...props}
              />
            )
          }
          return <input type={type} {...props} />
        }
      }),
      []
    )

    return (
      <>
        {blocks.map((block, idx) => {
          if (block.type === 'think') {
            return (
              <ThinkingBlock
                key={`think-${idx}`}
                thinkContent={block.content}
                isStreaming={isStreaming && idx === lastThinkIdx}
              />
            )
          }
          if (block.type === 'activity') {
            return (
              <ActivityCard
                key={`act-${idx}`}
                rawContent={block.content}
                isStreaming={isStreaming}
              />
            )
          }
          const processed = processMarkdownContent(block.content)
          return (
            <ReactMarkdown
              key={`md-${idx}`}
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {processed}
            </ReactMarkdown>
          )
        })}
      </>
    )
  },
  (prevProps, nextProps) => {
    return prevProps.content === nextProps.content && prevProps.isStreaming === nextProps.isStreaming
  }
)

export default MessageContent
