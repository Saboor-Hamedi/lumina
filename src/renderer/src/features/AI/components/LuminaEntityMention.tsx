import React, { useMemo } from 'react'
import {
  Folder,
  FileText,
  FileCode,
  FileJson,
  Image as ImageIcon,
  BookText,
  Network,
  LayoutDashboard,
  Database,
  Terminal,
  Brain,
  ExternalLink
} from 'lucide-react'
// @ts-ignore
import { getSnippetIcon } from '../../Icons/FileIcon'
import {
  resolveWorkspaceEntity,
  navigateToWorkspaceEntity,
  stripLeadingEntityEmoji,
  type ResolvedWorkspaceEntity,
  type WorkspaceEntityType
} from '../services/entityResolver'
import '../css/chatMentions.css'

export interface LuminaEntityMentionProps {
  target?: string
  label?: React.ReactNode
  entity?: ResolvedWorkspaceEntity
  contextFolder?: string
  preferFolder?: boolean
  prefixAt?: boolean
  showChildCount?: boolean
  variant?: 'inline' | 'list-item' | 'folder-entry' | 'preview'
  className?: string
  onClick?: (entity: ResolvedWorkspaceEntity, e: React.MouseEvent) => void
}

/**
 * Renders the appropriate Lucide / workspace icon for a resolved entity.
 * Uses actual workspace metadata (`type`, `customIcon`, `color`, `language`, `extension`).
 */
export const renderResolvedEntityIcon = (
  entity: ResolvedWorkspaceEntity,
  size: number = 12
): React.ReactNode => {
  const colorStyle = entity.color ? { color: entity.color } : undefined

  if (entity.type === 'folder') {
    return (
      <Folder
        size={size}
        className="chat-mention-icon folder-icon"
        style={colorStyle}
      />
    )
  }

  if (entity.type === 'brain') {
    return <Brain size={size} className="chat-mention-icon brain-icon" />
  }

  if (entity.type === 'image') {
    return (
      <ImageIcon
        size={size}
        className="chat-mention-icon image-icon"
        style={colorStyle}
      />
    )
  }

  if (entity.type === 'pdf') {
    return (
      <BookText
        size={size}
        className="chat-mention-icon pdf-icon"
        style={colorStyle}
      />
    )
  }

  if (entity.type === 'diagram') {
    const isCanvas =
      entity.extension === 'canvas' ||
      entity.language === 'canvas' ||
      entity.displayName.toLowerCase().endsWith('.canvas')
    const DiagramIcon = isCanvas ? LayoutDashboard : Network
    return (
      <DiagramIcon
        size={size}
        className="chat-mention-icon diagram-icon"
        style={colorStyle}
      />
    )
  }

  if (entity.type === 'code') {
    if (entity.snippet?.customIcon) {
      return getSnippetIcon(entity.snippet, size, 'chat-mention-icon code-icon', entity.color)
    }
    const ext = (entity.extension || '').toLowerCase()
    if (ext === 'sql' || entity.language === 'sql') {
      return <Database size={size} className="chat-mention-icon code-icon" style={colorStyle} />
    }
    if (ext === 'json' || ext === 'yaml' || ext === 'yml' || ext === 'toml') {
      return <FileJson size={size} className="chat-mention-icon code-icon" style={colorStyle} />
    }
    if (ext === 'sh' || ext === 'bash' || ext === 'zsh' || ext === 'ps1') {
      return <Terminal size={size} className="chat-mention-icon code-icon" style={colorStyle} />
    }
    return <FileCode size={size} className="chat-mention-icon code-icon" style={colorStyle} />
  }

  if (entity.type === 'external') {
    return <ExternalLink size={size - 1} className="chat-mention-icon external-icon" />
  }

  if (entity.snippet?.customIcon) {
    return getSnippetIcon(entity.snippet, size, 'chat-mention-icon file-icon', entity.color)
  }

  return (
    <FileText
      size={size}
      className={`chat-mention-icon file-icon ${!entity.exists ? 'unresolved-icon' : ''}`}
      style={colorStyle}
    />
  )
}

/**
 * Helper used by `LuminaChatMessageRow` and `LuminaMention` to resolve an icon by target string or snippet.
 */
export const getEntityIconForTarget = (
  targetOrSnippet: string | any,
  size: number = 12
): React.ReactNode => {
  if (targetOrSnippet && typeof targetOrSnippet === 'object') {
    if (targetOrSnippet.isFolder || targetOrSnippet.itemType === 'folder') {
      return <Folder size={size} className="chat-mention-icon folder-icon" />
    }
    if (targetOrSnippet.isBrain) {
      return <Brain size={size} className="chat-mention-icon brain-icon" />
    }
    const resolved = resolveWorkspaceEntity(
      targetOrSnippet.id || targetOrSnippet.title || targetOrSnippet.name,
      targetOrSnippet.title || targetOrSnippet.name
    )
    return renderResolvedEntityIcon(resolved, size)
  }

  const resolved = resolveWorkspaceEntity(String(targetOrSnippet || ''))
  return renderResolvedEntityIcon(resolved, size)
}

const getEntityTypeLabel = (type: WorkspaceEntityType): string => {
  switch (type) {
    case 'folder':
      return 'Folder'
    case 'pdf':
      return 'PDF'
    case 'image':
      return 'Image'
    case 'diagram':
      return 'Diagram'
    case 'code':
      return 'Code'
    case 'brain':
      return 'Guide'
    case 'note':
      return 'Note'
    default:
      return 'Reference'
  }
}

const extractTextFromReactNode = (node: React.ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractTextFromReactNode).join('')
  if (React.isValidElement(node)) {
    return extractTextFromReactNode((node.props as any)?.children)
  }
  return ''
}

/**
 * LuminaEntityMention
 * Reusable, theme-aware workspace entity renderer for inline mentions, wikilinks,
 * folder entries, and structured file lists in AI responses.
 */
export const LuminaEntityMention: React.FC<LuminaEntityMentionProps> = React.memo(
  ({
    target,
    label,
    entity: propEntity,
    contextFolder,
    preferFolder,
    prefixAt = false,
    showChildCount = false,
    variant = 'inline',
    className = '',
    onClick
  }) => {
    const labelText = useMemo(() => extractTextFromReactNode(label), [label])

    const entity = useMemo(() => {
      if (propEntity) return propEntity
      return resolveWorkspaceEntity(target || labelText, labelText || undefined, {
        contextFolder,
        preferFolder
      })
    }, [propEntity, target, labelText, contextFolder, preferFolder])

    const cleanDisplay = useMemo(() => {
      const base = stripLeadingEntityEmoji(labelText || entity.displayName)
      if (prefixAt) {
        return base.replace(/^@/, '')
      }
      return base || entity.displayName
    }, [labelText, entity.displayName, prefixAt])

    const tooltipTitle = useMemo(() => {
      const typeLabel = getEntityTypeLabel(entity.type)
      if (!entity.exists) {
        return `${typeLabel}: ${entity.relativePath || cleanDisplay}`
      }
      if (entity.type === 'folder') {
        const countSuffix =
          typeof entity.childCount === 'number'
            ? ` (${entity.childCount} ${entity.childCount === 1 ? 'item' : 'items'})`
            : ''
        return `Open folder: ${entity.relativePath}${countSuffix}`
      }
      return `Open ${typeLabel.toLowerCase()}: ${entity.relativePath || cleanDisplay}`
    }, [entity, cleanDisplay])

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (onClick) {
        onClick(entity, e)
        return
      }
      navigateToWorkspaceEntity(entity, contextFolder)
    }

    const iconSize = entity.type === 'folder' ? 11 : 11.5

    return (
      <span
        className={[
          'mention-chip',
          'chat-wikilink-chip',
          'chat-entity-mention',
          `entity-type-${entity.type}`,
          `entity-variant-${variant}`,
          entity.exists ? 'is-resolved' : 'is-unresolved',
          prefixAt ? 'chat-user-mention-pill' : '',
          className
        ]
          .filter(Boolean)
          .join(' ')}
        data-entity-type={entity.type}
        data-entity-path={entity.relativePath}
        data-entity-resolved={String(entity.exists)}
        onClick={handleClick}
        title={tooltipTitle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            navigateToWorkspaceEntity(entity, contextFolder)
          }
        }}
      >
        <span className="chat-mention-icon-wrapper">
          {renderResolvedEntityIcon(entity, iconSize)}
        </span>
        <span className="chat-user-mention-text chat-entity-mention-text">
          {prefixAt ? `@${cleanDisplay}` : cleanDisplay}
        </span>
        {showChildCount && entity.type === 'folder' && typeof entity.childCount === 'number' && (
          <span className="chat-entity-child-count">{entity.childCount}</span>
        )}
      </span>
    )
  }
)

export default LuminaEntityMention
