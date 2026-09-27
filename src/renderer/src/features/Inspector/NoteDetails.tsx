import React, { useState, useEffect } from 'react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import {
  Clock,
  Code,
  FolderOpen,
  Type,
  Hash,
  Eye,
  Tag,
  Pin,
  FileCode,
  Layout,
  AtSign,
  Fingerprint,
  Users,
  Copy,
  Check,
  type LucideIcon
} from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import './NoteDetails.css'

export interface PropertyRowProps {
  icon: LucideIcon
  name: string
  value: string | number
  rawCopyValue?: string
  iconColor?: string
  copyable?: boolean
}

const PropertyRow: React.FC<PropertyRowProps> = ({
  icon: Icon,
  name,
  value,
  rawCopyValue,
  iconColor = 'var(--text-muted)',
  copyable = false
}) => {
  const [copied, setCopied] = useState(false)
  const isDimmed = value === 'none' || value === 0 || value === '0' || value === 'false' || value === 'null'

  const handleCopy = (e: React.MouseEvent) => {
    if (!copyable) return
    e.stopPropagation()
    const textToCopy = rawCopyValue || String(value)
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const content = (
    <div
      className={`property-row ${copyable ? 'is-copyable' : ''} ${copied ? 'copied' : ''}`}
      onClick={copyable ? handleCopy : undefined}
    >
      <div className="property-name">
        <Icon size={14} className="property-icon" style={{ color: iconColor }} />
        <span>{name}</span>
      </div>
      <div className="property-value-wrapper">
        <span className={`property-value ${isDimmed ? 'is-dimmed' : ''}`}>{value}</span>
        {copyable && (
          <span className="property-copy-icon">
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </span>
        )}
      </div>
    </div>
  )

  if (copyable) {
    return (
      <ToolTip text={copied ? 'Copied ID' : 'Copy ID'} position="top">
        {content}
      </ToolTip>
    )
  }

  return content
}

export interface NoteDetailsProps {
  note?: {
    id?: string
    title?: string
    code?: string
    folderId?: string
    timestamp?: number
    language?: string
    tags?: string[] | string
    customIcon?: string
    [key: string]: any
  } | null
  snippet?: any
  isLoading?: boolean
}

export const NoteDetails: React.FC<NoteDetailsProps> = React.memo(({
  note: propNote,
  snippet,
  isLoading = false
}) => {
  const note = propNote || snippet
  const pinnedTabIds = useWorkspaceStore((state: any) => state.pinnedTabIds || [])

  const [computedStats, setComputedStats] = useState({
    wordCount: 0,
    readTime: '1m',
    tagCount: 0,
    mentionCount: 0
  })

  useEffect(() => {
    if (!note?.code) {
      setComputedStats({
        wordCount: 0,
        readTime: '1m',
        tagCount: 0,
        mentionCount: 0
      })
      return
    }

    const timer = setTimeout(() => {
      const code = note.code || ''
      const wordCount = code.trim() ? code.trim().split(/\s+/).filter(Boolean).length : 0
      const readTime = Math.max(1, Math.ceil(wordCount / 200)) + 'm'

      const tagSet = new Set<string>()
      if (note.tags) {
        const rawTags = Array.isArray(note.tags)
          ? note.tags
          : typeof note.tags === 'string' && note.tags.trim() !== ''
            ? note.tags.split(',')
            : []
        rawTags.forEach((t: string) => {
          const trimmed = String(t).trim()
          if (trimmed) tagSet.add(trimmed.startsWith('#') ? trimmed : `#${trimmed}`)
        })
      }

      const codeWithoutBlocks = code
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]+`/g, '')
      const tagRegex = /(?:^|\s)(#[\w-]+)/g
      const mentionRegex = /(?:^|\s)(@[\w-]+)/g
      let match: RegExpExecArray | null = null

      while ((match = tagRegex.exec(codeWithoutBlocks)) !== null) {
        tagSet.add(match[1])
      }

      let mentionCount = 0
      while ((match = mentionRegex.exec(codeWithoutBlocks)) !== null) {
        mentionCount++
      }

      setComputedStats({
        wordCount,
        readTime,
        tagCount: tagSet.size,
        mentionCount
      })
    }, 100)

    return () => clearTimeout(timer)
  }, [note?.id, note?.code, note?.tags])

  if (isLoading) {
    return (
      <div className="details-modal-body" style={{ height: '100%', overflowY: 'auto' }}>
        <div className="skeleton-inspector" style={{ padding: '16px' }}>
          <div className="skeleton skeleton-text" style={{ width: '40%', marginBottom: '12px' }} />
          <div className="skeleton skeleton-text" style={{ width: '80%', marginBottom: '12px' }} />
          <div className="skeleton skeleton-text" style={{ width: '60%' }} />
        </div>
      </div>
    )
  }

  if (!note) {
    return (
      <div className="details-modal-body" style={{ height: '100%', overflowY: 'auto' }}>
        <div
          className="panel-empty"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)'
          }}
        >
          No note selected
        </div>
      </div>
    )
  }

  const charCount = note.code?.length || 0

  return (
    <div className="details-modal-body" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="properties-container">
        <div className="properties-header">Properties</div>
        <div className="properties-list">
          <PropertyRow
            icon={Fingerprint}
            name="id"
            value={note.id || 'none'}
            rawCopyValue={note.id}
            copyable={Boolean(note.id)}
            iconColor="#8b5cf6"
          />
          <PropertyRow icon={Type} name="title" value={note.title || 'Untitled'} iconColor="#ec4899" />
          <PropertyRow
            icon={FolderOpen}
            name="location"
            value={note.folderId || '/'}
            iconColor="#eab308"
          />
          <PropertyRow
            icon={Clock}
            name="timestamp"
            value={note.timestamp ? new Date(note.timestamp).toLocaleDateString() : 'none'}
            iconColor="#14b8a6"
          />
          <PropertyRow icon={Code} name="language" value={note.language || 'markdown'} iconColor="#3b82f6" />
          <PropertyRow icon={Tag} name="tags" value={computedStats.tagCount} iconColor="#10b981" />
          <PropertyRow icon={Users} name="mentions" value={computedStats.mentionCount} iconColor="#8b5cf6" />
          <PropertyRow
            icon={Pin}
            name="isPinned"
            value={note.id && pinnedTabIds.includes(note.id) ? 'true' : 'false'}
            iconColor="#f97316"
          />
          <PropertyRow
            icon={FileCode}
            name="customIcon"
            value={note.customIcon || 'none'}
            iconColor="#6366f1"
          />
          <PropertyRow icon={AtSign} name="aliases" value="none" iconColor="#f43f5e" />
          <PropertyRow icon={Layout} name="cssclasses" value="none" iconColor="#0ea5e9" />
        </div>

        <div className="properties-header" style={{ marginTop: '24px' }}>
          Statistics
        </div>
        <div className="properties-list">
          <PropertyRow icon={Hash} name="characters" value={charCount.toLocaleString()} iconColor="#a855f7" />
          <PropertyRow icon={Type} name="words" value={computedStats.wordCount.toLocaleString()} iconColor="#ef4444" />
          <PropertyRow icon={Eye} name="readTime" value={computedStats.readTime} iconColor="#22c55e" />
        </div>
      </div>
    </div>
  )
})

NoteDetails.displayName = 'NoteDetails'
export default NoteDetails
