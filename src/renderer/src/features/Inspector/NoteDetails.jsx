import React, { useState } from 'react'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useVaultStore } from '../../core/store/workspaceStore'
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
  Check
} from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import './NoteDetails.css'

const PropertyRow = ({
  icon: Icon,
  name,
  value,
  rawCopyValue,
  iconColor = 'var(--text-muted)',
  copyable = false
}) => {
  const [copied, setCopied] = useState(false)
  const isDimmed = value === 'none' || value === 0 || value === '0' || value === 'false' || value === 'null'

  const handleCopy = (e) => {
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

export const NoteDetails = ({ snippet, isLoading = false }) => {
  const pinnedTabIds = useVaultStore((state) => state.pinnedTabIds)

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

  if (!snippet) {
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

  // Calculate statistics
  const charCount = snippet.code?.length || 0
  const wordCount = snippet.code?.trim() ? snippet.code.trim().split(/\s+/).length : 0
  const readTime = Math.max(1, Math.ceil(wordCount / 200)) + 'm'

  // Calculate true tag count (Frontmatter + Inline Tags, ignoring headings)
  const tagSet = new Set()

  if (snippet.tags) {
    const rawTags = Array.isArray(snippet.tags)
      ? snippet.tags
      : typeof snippet.tags === 'string' && snippet.tags.trim() !== ''
        ? snippet.tags.split(',')
        : []
    rawTags.forEach((t) => {
      const trimmed = String(t).trim()
      if (trimmed) tagSet.add(trimmed.startsWith('#') ? trimmed : `#${trimmed}`)
    })
  }

  let codeWithoutBlocks = (snippet.code || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
  const tagRegex = /(?:^|\s)(#[\w-]+)/g
  const mentionRegex = /(?:^|\s)(@[\w-]+)/g
  let match

  while ((match = tagRegex.exec(codeWithoutBlocks)) !== null) {
    tagSet.add(match[1])
  }

  const mentionSet = new Set()
  while ((match = mentionRegex.exec(codeWithoutBlocks)) !== null) {
    mentionSet.add(match[1])
  }

  const tagCount = tagSet.size
  const mentionCount = mentionSet.size

  return (
    <div className="details-modal-body" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="properties-container">
        <div className="properties-header">Properties</div>
        <div className="properties-list">
          <PropertyRow
            icon={Fingerprint}
            name="id"
            value={snippet.id}
            rawCopyValue={snippet.id}
            copyable={true}
            iconColor="#8b5cf6"
          />
          <PropertyRow icon={Type} name="title" value={snippet.title || 'Untitled'} iconColor="#ec4899" />
          <PropertyRow
            icon={FolderOpen}
            name="location"
            value={snippet.folderId || '/'}
            iconColor="#eab308"
          />
          <PropertyRow
            icon={Clock}
            name="timestamp"
            value={snippet.timestamp ? new Date(snippet.timestamp).toLocaleDateString() : 'none'}
            iconColor="#14b8a6"
          />
          <PropertyRow icon={Code} name="language" value={snippet.language || 'markdown'} iconColor="#3b82f6" />
          <PropertyRow icon={Tag} name="tags" value={tagCount} iconColor="#10b981" />
          <PropertyRow icon={Users} name="mentions" value={mentionCount} iconColor="#8b5cf6" />
          <PropertyRow
            icon={Pin}
            name="isPinned"
            value={pinnedTabIds.includes(snippet.id) ? 'true' : 'false'}
            iconColor="#f97316"
          />
          <PropertyRow
            icon={FileCode}
            name="customIcon"
            value={snippet.customIcon || 'none'}
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
          <PropertyRow icon={Type} name="words" value={wordCount.toLocaleString()} iconColor="#ef4444" />
          <PropertyRow icon={Eye} name="readTime" value={readTime} iconColor="#22c55e" />
        </div>
      </div>
    </div>
  )
}

export default NoteDetails
