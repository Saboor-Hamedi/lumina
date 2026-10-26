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
  BookText,
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
 * Authentic native Google Chrome 4-color roundel icon.
 * Standard across Windows File Explorer when Chrome is the default PDF viewer.
 */
export const ChromePdfIcon = ({ size = 14, className = '', style = {} }) => (
  <svg
    viewBox="0 0 48 48"
    width={size}
    height={size}
    className={className}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      verticalAlign: 'middle',
      ...style
    }}
  >
    {/* White inner dividing ring */}
    <circle cx="24" cy="24" r="12" fill="#ffffff" />
    {/* Red section (top/left) */}
    <path
      d="M24,12H44.7812a23.9939,23.9939,0,0,0-41.5639.0029L13.6079,30l.0093-.0024A11.9852,11.9852,0,0,1,24,12Z"
      fill="#EA4335"
    />
    {/* Central Blue Circle */}
    <circle cx="24" cy="24" r="9.5" fill="#1A73E8" />
    {/* Yellow section (right/bottom) */}
    <path
      d="M34.3913,30.0029,24.0007,48A23.994,23.994,0,0,0,44.78,12.0031H23.9989l-.0025.0093A11.985,11.985,0,0,1,34.3913,30.0029Z"
      fill="#FBBC04"
    />
    {/* Green section (left/bottom) */}
    <path
      d="M13.6086,30.0031,3.218,12.006A23.994,23.994,0,0,0,24.0025,48L34.3931,30.0029l-.0067-.0068a11.9852,11.9852,0,0,1-10.3778,5.9939A11.9853,11.9853,0,0,1,13.6086,30.0031Z"
      fill="#34A853"
    />
  </svg>
)

/**
 * Recognizable semantic file icon colors (VS Code palette)
 */
export const EXTENSION_COLORS = {
  ts: '#3178c6',
  tsx: '#3178c6',
  js: '#e5a93c',
  jsx: '#e5a93c',
  mjs: '#e5a93c',
  cjs: '#e5a93c',
  py: '#4b8bbe',
  rs: '#dea584',
  go: '#00add8',
  java: '#b07219',
  c: '#5c9eec',
  cpp: '#f34b7d',
  html: '#e44d26',
  css: '#42a5f5',
  scss: '#c6538c',
  vue: '#41b883',
  svelte: '#ff3e00',
  json: '#cbcb41',
  yaml: '#e5c07b',
  yml: '#e5c07b',
  toml: '#9c8e77',
  xml: '#e44d26',
  sql: '#00758f',
  sh: '#4eaa25',
  bash: '#4eaa25',
  ps1: '#4eaa25',
  bat: '#4eaa25',
  canvas: '#818cf8',
  png: '#a855f7',
  jpg: '#a855f7',
  jpeg: '#a855f7',
  gif: '#a855f7',
  svg: '#f59e0b',
  webp: '#a855f7'
}

/**
 * Maps filename, extensions, or keywords to appropriate Lucide React icons
 */
export const getFileIcon = (title = '', language = '') => {
  const cacheKey = `${title}:${language}`
  if (_iconCache.has(cacheKey)) return _iconCache.get(cacheKey)

  const titleLower = title.toLowerCase().trim()
  const lang = (language || 'markdown').toLowerCase()

  if (lang === 'image') {
    _iconCache.set(cacheKey, ImageIcon)
    return ImageIcon
  }

  // PDFs use Google Chrome native icon for instant recognition
  if (lang === 'pdf' || titleLower.endsWith('.pdf')) {
    _iconCache.set(cacheKey, ChromePdfIcon)
    return ChromePdfIcon
  }

  // Canvas files use LayoutDashboard
  if (lang === 'canvas' || titleLower.endsWith('.canvas')) {
    _iconCache.set(cacheKey, LayoutDashboard)
    return LayoutDashboard
  }

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
    pdf: ChromePdfIcon,
    doc: FileText,
    docx: FileText,
    canvas: LayoutDashboard
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

  const isPdf =
    snippet.type === 'pdf' ||
    snippet.itemType === 'pdf' ||
    snippet.language === 'pdf' ||
    snippet.title?.toLowerCase().endsWith('.pdf') ||
    snippet.fileName?.toLowerCase().endsWith('.pdf')

  if (isPdf) {
    return (
      <ChromePdfIcon
        size={size}
        className={className}
        style={{
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

  let Icon = getFileIcon(snippet.title || snippet.fileName, snippet.language)

  // Custom icon selection (Lucide icon name)
  if (snippet.customIcon && snippet.customIcon !== 'null' && snippet.customIcon !== 'undefined') {
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

  // File extension or language for recognizable semantic color
  const titleLower = (snippet.title || snippet.fileName || '').toLowerCase().trim()
  const ext = titleLower.includes('.') ? titleLower.slice(titleLower.lastIndexOf('.') + 1) : ''
  const lang = (snippet.language || '').toLowerCase().trim()
  const semanticColor = EXTENSION_COLORS[ext] || EXTENSION_COLORS[lang]

  // Clean, harmonious color: use user color override if explicitly set, else semantic file color or undefined (theme default)
  const iconColor = snippet.color || colorOverride || semanticColor || undefined

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
