import React from 'react'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useVaultStore } from '../../core/store/useVaultStore'
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
  Fingerprint
} from 'lucide-react'
import './SnippetDetails.css'

const PropertyRow = ({ icon: Icon, name, value, iconColor = 'var(--text-muted)' }) => (
  <div className="property-row">
    <div className="property-name">
      <Icon size={14} className="property-icon" style={{ color: iconColor }} />
      <span>{name}</span>
    </div>
    <div className="property-value">{value}</div>
  </div>
)

const SnippetDetails = ({ snippet, isLoading = false }) => {
  // Get vault path from settings for display
  const vaultPath = useSettingsStore.getState().settings.vaultPath || 'Default Vault'
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
        <div className="panel-empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
          No file selected
        </div>
      </div>
    )
  }

  // Calculate statistics
  const charCount = snippet.code?.length || 0
  const wordCount = snippet.code?.trim() ? snippet.code.trim().split(/\s+/).length : 0
  const readTime = Math.ceil(wordCount / 200) + 'm'
  
  // Calculate true tag count (Frontmatter + Inline Tags, ignoring headings)
  const tagSet = new Set()
  
  // 1. Frontmatter tags
  if (snippet.tags) {
    const rawTags = Array.isArray(snippet.tags) 
      ? snippet.tags 
      : (typeof snippet.tags === 'string' && snippet.tags.trim() !== '' ? snippet.tags.split(',') : [])
    rawTags.forEach(t => {
      const trimmed = String(t).trim()
      if (trimmed) tagSet.add(trimmed.startsWith('#') ? trimmed : `#${trimmed}`)
    })
  }

  // 2. Inline markdown tags (ignores "# Heading" because [\w-] doesn't match space)
  let codeWithoutBlocks = (snippet.code || '').replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '')
  const tagRegex = /(?:^|\s)(#[\w-]+)/g
  let match
  while ((match = tagRegex.exec(codeWithoutBlocks)) !== null) {
    tagSet.add(match[1])
  }
  
  const tagCount = tagSet.size

  return (
    <div className="details-modal-body" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="properties-container">
        <div className="properties-header">Properties</div>
        <div className="properties-list">
          {/* Default Properties */}
          <PropertyRow 
            icon={Fingerprint} 
            name="id" 
            value={snippet.id} 
            iconColor="#8b5cf6" 
          />
          <PropertyRow 
            icon={Type} 
            name="title" 
            value={snippet.title} 
            iconColor="#ec4899" 
          />
          <PropertyRow 
            icon={FolderOpen} 
            name="location" 
            value={snippet.folderId || '/'} 
            iconColor="#eab308" 
          />
          <PropertyRow 
            icon={Clock} 
            name="timestamp" 
            value={new Date(snippet.timestamp).toLocaleDateString()} 
            iconColor="#14b8a6" 
          />
          <PropertyRow 
            icon={Code} 
            name="language" 
            value={snippet.language} 
            iconColor="#3b82f6" 
          />
          
          {/* Extended Properties that mimic Obsidian frontmatter features */}
          <PropertyRow 
            icon={Tag} 
            name="tags" 
            value={tagCount} 
            iconColor="#10b981" 
          />
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
          <PropertyRow 
            icon={AtSign} 
            name="aliases" 
            value="none" 
            iconColor="#f43f5e" 
          />
          <PropertyRow 
            icon={Layout} 
            name="cssclasses" 
            value="none" 
            iconColor="#0ea5e9" 
          />
        </div>

        <div className="properties-header" style={{ marginTop: '24px' }}>Statistics</div>
        <div className="properties-list">
          <PropertyRow 
            icon={Hash} 
            name="characters" 
            value={charCount} 
            iconColor="#a855f7" 
          />
          <PropertyRow 
            icon={Type} 
            name="words" 
            value={wordCount} 
            iconColor="#ef4444" 
          />
          <PropertyRow 
            icon={Eye} 
            name="readTime" 
            value={readTime} 
            iconColor="#22c55e" 
          />
        </div>
      </div>
    </div>
  )
}

export default SnippetDetails
