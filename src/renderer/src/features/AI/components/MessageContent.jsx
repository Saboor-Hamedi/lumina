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

    const processedBefore = useMemo(() => {
      return beforeContent ? processMarkdownContent(beforeContent) : ''
    }, [beforeContent])

    const processedAfter = useMemo(() => {
      return afterContent ? processMarkdownContent(afterContent) : ''
    }, [afterContent])

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
