import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatPreBlock } from './LuminaChatPreBlock'
import { ChatInlineCode } from './LuminaChatInlineCode'
import { ChatBlockquote } from './LuminaChatBlockquote'
import { ChatLink } from './LuminaChatLink'
import { ThinkingBlock } from './LuminaThinkingBlock'
import { ActivityCard } from './LuminaActivityCard'
import { MemoryBadge } from './LuminaMemoryBadge'
import { LuminaAuditBadge } from './LuminaAuditBadge'
import { LuminaHealthBadge } from './LuminaHealthBadge'
import { LuminaIndexBadge } from './LuminaIndexBadge'
import {
  processMarkdownContent,
  parseMessageSections,
  parseMessageBlocks
} from '../services/chatMarkdownParser'

export { processMarkdownContent, parseMessageSections, parseMessageBlocks }

export interface MessageContentProps {
  content?: string
  isStreaming?: boolean
  imageUrl?: string
  imagePrompt?: string
  onCopy?: (content: string) => void
}

/**
 * MessageContent orchestrates multi-modal rendering of an AI message:
 * memory badges, reasoning thinking blocks, workspace activities, and Markdown.
 */
export const MessageContent: React.FC<MessageContentProps> = React.memo(
  ({ content, isStreaming = false }) => {
    const blocks = useMemo(() => {
      return parseMessageBlocks(content)
    }, [content])

    const hasExplicitMemoryBlock = useMemo(() => {
      return blocks.some((b) => b.type === 'memory')
    }, [blocks])

    const hasMemoryFallback = useMemo(() => {
      return (
        !hasExplicitMemoryBlock &&
        Boolean(content) &&
        /\b(memory\.json|Saved to memory|Updated user (?:name|role|bio)|Cleared user (?:name|role|bio)|Updated preference:)\b/i.test(
          content || ''
        ) &&
        !(content || '').includes('```')
      )
    }, [hasExplicitMemoryBlock, content])

    const memoryContent = useMemo(() => {
      const memBlock = blocks.find((b) => b.type === 'memory')
      if (memBlock) return memBlock.content
      const m = (content || '').match(
        /(?:Updated user [^\n]+|Saved to memory[^\n]*|Saved preference:[^\n]+|Cleared user [^\n]+|Removed "[^"]+" from memory)/i
      )
      return m ? m[0] : ''
    }, [blocks, content])

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
        hr: ({ ...props }: any) => <hr className="horizontal" {...props} />,
        table: ({ children }: any) => (
          <div className="table-wrapper chat-table-wrapper">
            <table>{children}</table>
          </div>
        ),
        input: ({ type, checked, ...props }: any) => {
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
          if (block.type === 'memory') {
            return (
              <div key={`mem-${idx}`} className="lumina-memory-block-wrap">
                <MemoryBadge content={block.content} />
              </div>
            )
          }
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
          if (block.type === 'audit') {
            return (
              <LuminaAuditBadge
                key={`audit-${idx}`}
                content={block.content}
                isStreaming={isStreaming}
              />
            )
          }
          if (block.type === 'health') {
            return (
              <LuminaHealthBadge
                key={`health-${idx}`}
                content={block.content}
                isStreaming={isStreaming}
              />
            )
          }
          if (block.type === 'index') {
            return (
              <LuminaIndexBadge
                key={`index-${idx}`}
                content={block.content}
                isStreaming={isStreaming}
              />
            )
          }
          const processed = processMarkdownContent(block.content)
          return (
            <ReactMarkdown
              key={`md-${idx}`}
              remarkPlugins={[remarkGfm]}
              components={markdownComponents as any}
            >
              {processed}
            </ReactMarkdown>
          )
        })}
        {hasMemoryFallback && (
          <div className="lumina-memory-block-wrap">
            <MemoryBadge content={memoryContent} />
          </div>
        )}
      </>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.content === nextProps.content &&
      prevProps.isStreaming === nextProps.isStreaming
    )
  }
)

export const LuminaMessageContent = MessageContent
export default MessageContent
