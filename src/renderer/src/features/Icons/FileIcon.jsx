/**
 * ============================================================================
 * IconMapper Component & Utilities
 * ============================================================================
 * Clean, consistent, modern Lucide icon mapping for Lumina workspace.
 * Uses unified styling, sensible file-type fallbacks, and harmonious colors.
 * ============================================================================
 */

import React from 'react'
import * as LucideIcons from 'lucide-react'
import './IconPicker.css'
import {
  FileText,
  FileCode,
  FileJson,
  ImageIcon,
  Folder,
  FolderOpen,
  FolderCode,
  Database,
  Key,
  Lock,
  Package,
  Terminal,
  BookOpen,
  Book,
  FileCheck,
  File,
  Code,
  Globe,
  Server,
  Shield,
  Wrench,
  Zap,
  Box,
  Heart,
  Network,
  BarChart3,
  Sparkles,
  Layers,
  LayoutDashboard,
  Target,
  ListTodo,
  Clock,
  Calendar,
  Settings,
  HelpCircle,
  Coffee
} from 'lucide-react'

// Cache icon lookups for instant rendering
const _iconCache = new Map()

/**
 * Maps filename, extensions, or keywords to appropriate Lucide React icons
 */
export const getFileIcon = (title = '', language = '') => {
  const cacheKey = `${title}:${language}`
  if (_iconCache.has(cacheKey)) return _iconCache.get(cacheKey)

  const titleLower = title.toLowerCase().trim()
  const lang = (language || 'markdown').toLowerCase()

  // Base name without extension
  const baseName = titleLower.includes('.') ? titleLower.slice(0, titleLower.lastIndexOf('.')) : titleLower
  const ext = titleLower.includes('.') ? titleLower.slice(titleLower.lastIndexOf('.') + 1) : ''

  // 1. Exact Name Matches (Semantic files)
  const exactMap = {
    // Config & System
    settings: Settings,
    config: Settings,
    configuration: Settings,
    env: Key,
    '.env': Key,
    '.env.local': Key,
    '.env.production': Key,
    '.gitignore': Shield,
    dockerfile: Terminal,
    'docker-compose': Terminal,

    // Documentation & Notes
    readme: BookOpen,
    docs: BookOpen,
    documentation: BookOpen,
    wiki: Book,
    changelog: FileText,
    license: FileText,
    todo: ListTodo,
    tasks: ListTodo,
    roadmap: Target,
    goals: Target,
    daily: Calendar,
    scratch: Coffee,
    notes: FileText,
    graph: Network,

    // Development & Data
    src: FolderCode,
    components: FolderCode,
    utils: FolderCode,
    api: Globe,
    routes: Globe,
    server: Server,
    store: Database,
    stores: Database,
    db: Database,
    database: Database,
    data: Database,
    models: Database,
    schema: Database,
    tests: FileCheck,
    test: FileCheck,
    scripts: Terminal,
    tools: Wrench,
    dashboard: LayoutDashboard
  }

  if (exactMap[titleLower] || exactMap[baseName]) {
    const matched = exactMap[titleLower] || exactMap[baseName]
    _iconCache.set(cacheKey, matched)
    return matched
  }

  // 2. Extension Matches
  const extensionMap = {
    // Code
    js: FileCode,
    jsx: FileCode,
    ts: FileCode,
    tsx: FileCode,
    py: FileCode,
    rs: FileCode,
    go: FileCode,
    cpp: FileCode,
    c: FileCode,
    java: FileCode,
    html: FileCode,
    css: FileCode,
    scss: FileCode,
    vue: FileCode,
    svelte: FileCode,
    php: FileCode,
    rb: FileCode,
    swift: FileCode,
    kt: FileCode,

    // Data
    json: FileJson,
    yaml: FileJson,
    yml: FileJson,
    toml: FileJson,
    xml: FileJson,
    csv: FileJson,
    sql: Database,

    // Shell
    sh: Terminal,
    bash: Terminal,
    zsh: Terminal,
    bat: Terminal,
    cmd: Terminal,
    ps1: Terminal,

    // Media
    png: ImageIcon,
    jpg: ImageIcon,
    jpeg: ImageIcon,
    gif: ImageIcon,
    svg: ImageIcon,
    webp: ImageIcon,
    ico: ImageIcon,

    // Archive
    zip: Package,
    tar: Package,
    gz: Package,
    rar: Package,
    '7z': Package,

    // Document / Notes (Default standard)
    md: FileText,
    markdown: FileText,
    mdx: FileText,
    txt: FileText,
    pdf: FileText,
    doc: FileText,
    docx: FileText
  }

  if (ext && extensionMap[ext]) {
    const matched = extensionMap[ext]
    _iconCache.set(cacheKey, matched)
    return matched
  }

  // 3. Language fallback
  if (lang && lang !== 'markdown' && lang !== 'text') {
    if (extensionMap[lang]) {
      const matched = extensionMap[lang]
      _iconCache.set(cacheKey, matched)
      return matched
    }
    _iconCache.set(cacheKey, FileCode)
    return FileCode
  }

  // 4. Default Clean Note Icon
  _iconCache.set(cacheKey, FileText)
  return FileText
}

/**
 * Get icon component for a snippet with unified sizing and consistent coloring
 */
export const getSnippetIcon = (snippet, size = 14, className = 'item-icon', colorOverride) => {
  if (!snippet) {
    return <FileText size={size} className={className} />
  }

  let Icon = getFileIcon(snippet.title, snippet.language)

  // Custom icon selection (Lucide icon name)
  if (snippet.customIcon) {
    if (LucideIcons[snippet.customIcon]) {
      Icon = LucideIcons[snippet.customIcon]
    } else {
      // Fallback for custom unicode symbols/emojis
      return (
        <span
          className={className}
          style={{
            fontSize: `${size}px`,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: `${size}px`,
            height: `${size}px`,
            textAlign: 'center',
            verticalAlign: 'middle',
            flexShrink: 0,
            overflow: 'hidden'
          }}
        >
          {snippet.customIcon}
        </span>
      )
    }
  }

  // Clean, harmonious color: use user color override if explicitly set, else inherit theme styling
  const iconColor = snippet.color || colorOverride || undefined

  return (
    <Icon
      size={size}
      className={className}
      style={{
        color: iconColor,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        verticalAlign: 'middle',
        width: `${size}px`,
        height: `${size}px`
      }}
    />
  )
}

export default getFileIcon
