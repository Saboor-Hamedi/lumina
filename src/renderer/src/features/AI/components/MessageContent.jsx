import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatPreBlock } from './ChatPreBlock'
import { ChatInlineCode } from './ChatInlineCode'
import { ChatBlockquote } from './ChatBlockquote'
import { ChatLink } from './ChatLink'
import { ThinkingBlock } from './ThinkingBlock'
import { ActivityCard } from './ActivityCard'
import { processMarkdownContent, parseMessageSections } from '../services/chatMarkdownParser'

export { processMarkdownContent, parseMessageSections }

export const MessageContent = React.memo(
  ({ content, isStreaming = false }) => {
    const { thinkContent, beforeContent, activityContent, afterContent } = useMemo(() => {
      return parseMessageSections(content)
    }, [content])

    const processedBody = useMemo(() => {
      const combined = [beforeContent, afterContent].filter(Boolean).join('\n\n')
      return processMarkdownContent(combined)
    }, [beforeContent, afterContent])

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
        {thinkContent && (
          <ThinkingBlock thinkContent={thinkContent} isStreaming={isStreaming} />
        )}
        {activityContent && (
          <ActivityCard rawContent={activityContent} isStreaming={isStreaming} />
        )}
        {processedBody && (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {processedBody}
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
