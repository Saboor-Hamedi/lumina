/**
 * ============================================================================
 * FileHoverPreview Component (`FileHoverPreview.tsx`)
 * ============================================================================
 *
 * Rich, ultra-lightweight preview card for FileExplorer hover tooltips.
 * Supports:
 * 1. Image Files: Direct image rendering with protocol/IPC fallback, dimensions & file size.
 * 2. Canvas Files: Vector SVG mini-map rendering of spatial nodes, shapes & edge wires.
 * 3. Markdown / Code Notes: Formatted titles, word count, reading time, tags, wikilinks, mentions,
 *    and clean syntax snippet lines.
 * 4. PDF & Binary Files: Format badge, metadata, and file size.
 * ============================================================================
 */

import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  FileCode,
  FolderOpen,
  Tag,
  Clock,
  Hash,
  Share2,
  Link as LinkIcon,
  AtSign
} from 'lucide-react'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'

export interface FileHoverPreviewProps {
  item: any
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * In-memory module cache for note contents to avoid repeated disk reads.
 */
const contentCache = new Map<string, string>()

/**
 * Image Thumbnail Preview Card
 */
const ImagePreviewCard: React.FC<{ item: any }> = ({ item }) => {
  const relPath =
    item.relativePath || (item.folderId && item.folderId !== 'root' ? `${item.folderId}/${item.fileName}` : item.fileName)

  const assetUrl = useMemo(() => {
    if (!relPath) return null
    const clean = String(relPath).replace(/^[/\\]+/, '').replace(/\\/g, '/')
    const encodedSegments = clean.split('/').map(encodeURIComponent).join('/')
    return `asset://local/${encodedSegments}`
  }, [relPath])

  const [src, setSrc] = useState<string | null>(assetUrl)
  const [naturalDim, setNaturalDim] = useState<{ w: number; h: number } | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    setSrc(assetUrl)
    setLoadFailed(false)
    setNaturalDim(null)
  }, [assetUrl])

  const handleError = () => {
    // Fallback to window.api.readAsset IPC if protocol streaming is unavailable
    if (!loadFailed && (window as any).api?.readAsset && relPath) {
      setLoadFailed(true)
      ;(window as any).api
        .readAsset(relPath)
        .then((res: any) => {
          if (res?.dataUrl) {
            setSrc(res.dataUrl)
          } else if (res) {
            setSrc(`data:image/png;base64,${res}`)
          }
        })
        .catch(() => {})
    }
  }

  return (
    <div className="tooltip-card-preview tooltip-media-card">
      <div className="tooltip-card-header">
        <span className="tooltip-card-title">{item.title || item.fileName || 'Image'}</span>
      </div>

      <div className="tooltip-image-frame">
        {src ? (
          <img
            src={src}
            alt={item.title || 'Preview'}
            className="tooltip-preview-img"
            onLoad={(e) => {
              const target = e.currentTarget
              setNaturalDim({ w: target.naturalWidth, h: target.naturalHeight })
            }}
            onError={handleError}
          />
        ) : (
          <div className="tooltip-media-placeholder">
            <ImageIcon size={24} className="opacity-40" />
            <span>Image not available</span>
          </div>
        )}
      </div>

      <div className="tooltip-card-meta">
        {naturalDim ? (
          <span>
            {naturalDim.w} × {naturalDim.h} px
          </span>
        ) : null}
        {item.size ? (
          <span>
            {naturalDim ? '· ' : ''}
            {formatBytes(item.size)}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Canvas Vector Mini-Map Preview Card
 */
const CanvasPreviewCard: React.FC<{ item: any }> = ({ item }) => {
  const storeNote = useWorkspaceStore((state: any) => {
    const draft = state.drafts?.[item.id]
    if (draft) return draft
    const found = state.notes?.find((n: any) => n.id === item.id)
    return found?.code || found?.content || ''
  })

  const initialRaw =
    item.code ||
    item.content ||
    item.body ||
    storeNote ||
    contentCache.get(item.id) ||
    ''

  const [raw, setRaw] = useState<string>(initialRaw)

  useEffect(() => {
    if (initialRaw) {
      setRaw(initialRaw)
      return
    }

    let cancelled = false
    const api = (window as any).api
    const fetcher = api?.readSnippet || api?.readNotePreview

    if (fetcher && item.id) {
      fetcher(item.id)
        .then((res: any) => {
          if (!cancelled && res) {
            const fetched = res.code || res.content || ''
            contentCache.set(item.id, fetched)
            setRaw(fetched)
          }
        })
        .catch(() => {})
    }

    return () => {
      cancelled = true
    }
  }, [item.id, initialRaw])

  const canvasData = useMemo(() => {
    if (!raw) return { nodes: [], edges: [] }
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      return {
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
        edges: Array.isArray(parsed.edges) ? parsed.edges : []
      }
    } catch {
      return { nodes: [], edges: [] }
    }
  }, [raw])

  const { nodes, edges } = canvasData

  // Bounding box calculation for SVG viewBox scaling
  const svgBounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, width: 240, height: 140 }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    nodes.forEach((n: any) => {
      const nx = n.x || 0
      const ny = n.y || 0
      const nw = n.width || 140
      const nh = n.height || 80
      if (nx < minX) minX = nx
      if (ny < minY) minY = ny
      if (nx + nw > maxX) maxX = nx + nw
      if (ny + nh > maxY) maxY = ny + nh
    })

    const pad = 30
    return {
      minX: minX - pad,
      minY: minY - pad,
      width: Math.max(160, maxX - minX + pad * 2),
      height: Math.max(100, maxY - minY + pad * 2)
    }
  }, [nodes])

  const nodeColorMap: Record<string, string> = {
    red: '#f87171',
    orange: '#fb923c',
    yellow: '#facc15',
    green: '#4ade80',
    cyan: '#22d3ee',
    purple: '#c084fc',
    blue: '#60a5fa',
    pink: '#f472b6'
  }

  return (
    <div className="tooltip-card-preview tooltip-canvas-card">
      <div className="tooltip-card-header">
        <span className="tooltip-card-title">{item.title || item.fileName || 'Canvas'}</span>
      </div>

      <div className="tooltip-canvas-viewport">
        {nodes.length > 0 ? (
          <svg
            className="tooltip-canvas-svg"
            viewBox={`${svgBounds.minX} ${svgBounds.minY} ${svgBounds.width} ${svgBounds.height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Background grid dots */}
            <defs>
              <pattern id="canvas-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="rgba(255,255,255,0.08)" />
              </pattern>
            </defs>
            <rect
              x={svgBounds.minX}
              y={svgBounds.minY}
              width={svgBounds.width}
              height={svgBounds.height}
              fill="url(#canvas-grid)"
            />

            {/* Connecting Edge Lines */}
            {edges.map((e: any, idx: number) => {
              const fromNode = nodes.find((n: any) => n.id === e.fromNode)
              const toNode = nodes.find((n: any) => n.id === e.toNode)
              if (!fromNode || !toNode) return null
              const x1 = (fromNode.x || 0) + (fromNode.width || 140) / 2
              const y1 = (fromNode.y || 0) + (fromNode.height || 80) / 2
              const x2 = (toNode.x || 0) + (toNode.width || 140) / 2
              const y2 = (toNode.y || 0) + (toNode.height || 80) / 2

              return (
                <line
                  key={idx}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(167, 139, 250, 0.45)"
                  strokeWidth="2.5"
                  strokeDasharray="4 3"
                />
              )
            })}

            {/* Spatial Nodes */}
            {nodes.map((n: any, idx: number) => {
              const nx = n.x || 0
              const ny = n.y || 0
              const nw = n.width || 140
              const nh = n.height || 80
              const accentColor = nodeColorMap[n.color] || '#8b5cf6'
              const nodeTitle = n.title || n.text || n.label || (n.file ? n.file.split('/').pop() : `Node ${idx + 1}`)

              return (
                <g key={n.id || idx}>
                  <rect
                    x={nx}
                    y={ny}
                    width={nw}
                    height={nh}
                    rx="6"
                    fill="var(--bg-card, #1c1c24)"
                    stroke={accentColor}
                    strokeWidth="1.8"
                    strokeOpacity="0.8"
                  />
                  <rect
                    x={nx}
                    y={ny}
                    width={nw}
                    height="18"
                    rx="6"
                    fill={accentColor}
                    fillOpacity="0.25"
                  />
                  <text
                    x={nx + 8}
                    y={ny + 13}
                    fill="var(--text-main, #f1f5f9)"
                    fontSize="11"
                    fontWeight="600"
                    fontFamily="Inter, sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    {String(nodeTitle).slice(0, 16)}
                  </text>
                </g>
              )
            })}
          </svg>
        ) : (
          <div className="tooltip-media-placeholder">
            <LayoutDashboard size={22} className="opacity-40" />
            <span>Empty Canvas Board</span>
          </div>
        )}
      </div>

      <div className="tooltip-card-meta">
        <span>
          {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'}
        </span>
        {edges.length > 0 && (
          <span>
            · {edges.length} {edges.length === 1 ? 'connection' : 'connections'}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Clean, lightweight markdown & note snippet preview with words, links, tags, and mentions.
 */
const MarkdownPreviewCard: React.FC<{ item: any }> = ({ item }) => {
  const title = item.title || item.fileName || 'Untitled Note'

  // Subscribe to live drafts or store notes in case the note was edited or loaded in workspace
  const storeContent = useWorkspaceStore((state: any) => {
    const draft = state.drafts?.[item.id]
    if (draft) return draft
    const found = state.notes?.find((n: any) => n.id === item.id)
    return found?.code || found?.content || ''
  })

  const initialContent =
    item.code ||
    item.content ||
    item.body ||
    storeContent ||
    contentCache.get(item.id) ||
    ''

  const [rawContent, setRawContent] = useState<string>(initialContent)
  const [isLoading, setIsLoading] = useState<boolean>(!initialContent)

  // Asynchronously fetch content from disk if empty in memory
  useEffect(() => {
    if (initialContent) {
      setRawContent(initialContent)
      setIsLoading(false)
      return
    }

    let isMounted = true
    const api = (window as any).api
    const fetcher = api?.readNotePreview || api?.readSnippet

    if (fetcher && item.id) {
      setIsLoading(true)
      fetcher(item.id)
        .then((res: any) => {
          if (!isMounted) return
          const fetched = res?.code || res?.content || ''
          contentCache.set(item.id, fetched)
          setRawContent(fetched)
          setIsLoading(false)
        })
        .catch(() => {
          if (isMounted) setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }

    return () => {
      isMounted = false
    }
  }, [item.id, initialContent])

  // Comprehensive extraction of words, wikilinks, tags, mentions, and preview snippet
  const analysis = useMemo(() => {
    const text = rawContent || ''

    // 1. Strip YAML frontmatter & loose metadata
    let body = text.replace(/^---[\s\S]*?---\s*/, '')

    // 2. Extract Wikilinks [[Target|Label]] & standard markdown links [label](url)
    const wikilinks: string[] = []
    const wikilinkRegex = /\[\[([^\]|#\r\n]+)(?:#[^\]|\r\n]+)?(?:\|([^\]\r\n]+))?\]\]/g
    let wMatch: RegExpExecArray | null
    while ((wMatch = wikilinkRegex.exec(body)) !== null) {
      const linkName = (wMatch[2] || wMatch[1]).trim()
      if (linkName && !wikilinks.includes(linkName)) {
        wikilinks.push(linkName)
      }
    }

    if (Array.isArray(item.wikilinks)) {
      item.wikilinks.forEach((wl: string) => {
        if (wl && !wikilinks.includes(wl)) wikilinks.push(wl)
      })
    }

    // Standard markdown links
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    let mdMatch: RegExpExecArray | null
    while ((mdMatch = mdLinkRegex.exec(body)) !== null) {
      const label = mdMatch[1].trim()
      if (label && !wikilinks.includes(label) && !/^https?:\/\//i.test(label)) {
        wikilinks.push(label)
      }
    }

    // 3. Extract Tags (frontmatter tags + inline #tags)
    const tagsSet = new Set<string>()
    if (item.tags) {
      if (Array.isArray(item.tags)) {
        item.tags.forEach((t: any) => t && tagsSet.add(String(t).replace(/^#/, '')))
      } else if (typeof item.tags === 'string') {
        item.tags.split(',').forEach((t: string) => {
          const clean = t.trim().replace(/^#/, '')
          if (clean) tagsSet.add(clean)
        })
      }
    }

    // Inline hashtags #tag (ensure not a markdown heading # Heading)
    const inlineTagRegex = /(?:^|[^\w#])#([a-zA-Z0-9_\-\/]+)(?=[^\w\-\/]|$)/g
    let tMatch: RegExpExecArray | null
    while ((tMatch = inlineTagRegex.exec(body)) !== null) {
      const tag = tMatch[1].trim()
      if (tag && !/^\d+$/.test(tag) && !/^[0-9a-fA-F]{3,6}$/.test(tag)) {
        tagsSet.add(tag)
      }
    }

    // 4. Extract Mentions (@user or @[name])
    const mentionsSet = new Set<string>()
    const mentionRegex = /(?:^|[^\w@])@([a-zA-Z0-9_.\-]+|\[[^\]]+\])/g
    let mMatch: RegExpExecArray | null
    while ((mMatch = mentionRegex.exec(body)) !== null) {
      let mention = mMatch[1].trim()
      if (mention.startsWith('[') && mention.endsWith(']')) {
        mention = mention.slice(1, -1).trim()
      }
      if (mention && !mentionsSet.has(mention)) {
        mentionsSet.add(mention)
      }
    }

    // 5. Clean text for Word Count
    const cleanForWords = body
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\[\[(.*?)\]\]/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/!\[.*?\]\(.*?\)/g, ' ')
      .replace(/[#*`_~>]/g, ' ')
      .trim()

    const words = cleanForWords ? cleanForWords.split(/\s+/).filter(Boolean) : []
    const wordCount = words.length
    const readTime = Math.max(1, Math.ceil(wordCount / 200)) + 'm'

    // 6. Formatted snippet lines
    let snippetLines: React.ReactNode[] | null = null
    const cleanForSnippet = body
      .replace(/```[\s\S]*?```/g, (code: string) => {
        const firstLine = code.split('\n')[0].replace('```', '').trim()
        return `[Code: ${firstLine || 'block'}]`
      })
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m: string, target: string, alias?: string) => alias || target)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .trim()

    if (cleanForSnippet) {
      const lines = cleanForSnippet.split('\n').map((l: string) => l.trim()).filter(Boolean).slice(0, 4)
      snippetLines = lines.map((line: string, idx: number) => {
        if (line.startsWith('#')) {
          return (
            <div key={idx} className="tooltip-md-heading">
              {line.replace(/^#+\s*/, '')}
            </div>
          )
        }
        if (line.startsWith('- ') || line.startsWith('* ') || line.match(/^\d+\.\s/)) {
          return (
            <div key={idx} className="tooltip-md-bullet">
              <span className="bullet-dot">•</span>
              <span>{line.replace(/^[-*]|\d+\.\s*/, '').trim()}</span>
            </div>
          )
        }
        if (line.startsWith('>')) {
          return (
            <div key={idx} className="tooltip-md-quote">
              {line.replace(/^>\s*/, '')}
            </div>
          )
        }
        return (
          <div key={idx} className="tooltip-md-p">
            {line.slice(0, 110)}
          </div>
        )
      })
    }

    return {
      wordCount,
      readTime,
      tags: Array.from(tagsSet),
      wikilinks,
      mentions: Array.from(mentionsSet),
      snippetLines
    }
  }, [rawContent, item.tags, item.wikilinks])

  const folderText = item.folderId && item.folderId !== 'root' ? item.folderId : null

  return (
    <div className="tooltip-card-preview">
      <div className="tooltip-card-header">
        <span className="tooltip-card-title">{title}</span>
      </div>

      {folderText && (
        <div className="tooltip-card-meta">
          <span className="tooltip-badge-folder">📁 {folderText}</span>
        </div>
      )}

      {/* Tags section */}
      {analysis.tags.length > 0 && (
        <div className="tooltip-card-tags">
          {analysis.tags.slice(0, 4).map((t, idx) => (
            <span key={idx} className="tooltip-tag">
              #{t}
            </span>
          ))}
          {analysis.tags.length > 4 && (
            <span className="tooltip-tag">+{analysis.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* Mentions section */}
      {analysis.mentions.length > 0 && (
        <div className="tooltip-card-mentions">
          {analysis.mentions.slice(0, 3).map((m, idx) => (
            <span key={idx} className="tooltip-mention-pill">
              <AtSign size={10} strokeWidth={2.2} />
              {m}
            </span>
          ))}
          {analysis.mentions.length > 3 && (
            <span className="tooltip-mention-pill">+{analysis.mentions.length - 3}</span>
          )}
        </div>
      )}

      {/* Wikilinks section */}
      {analysis.wikilinks.length > 0 && (
        <div className="tooltip-card-links">
          {analysis.wikilinks.slice(0, 3).map((link, idx) => (
            <span key={idx} className="tooltip-link-pill" title={link}>
              <LinkIcon size={9} strokeWidth={2.2} />
              {link}
            </span>
          ))}
          {analysis.wikilinks.length > 3 && (
            <span className="tooltip-link-pill">+{analysis.wikilinks.length - 3}</span>
          )}
        </div>
      )}

      {/* Body snippet */}
      {isLoading ? (
        <div className="tooltip-loading-dots">Loading note preview…</div>
      ) : analysis.snippetLines ? (
        <div className="tooltip-card-body">{analysis.snippetLines}</div>
      ) : (
        <div className="tooltip-card-empty">Empty note</div>
      )}
    </div>
  )
}

/**
 * Universal FileHoverPreview Dispatcher
 */
export const FileHoverPreview: React.FC<FileHoverPreviewProps> = ({ item }) => {
  if (!item) return null

  // 1. Folder Preview (handled directly if passed)
  if (item.itemType === 'folder') {
    return <span className="tooltip-label">{item.title || item.name || 'Folder'}</span>
  }

  // 2. Image File Preview
  const isImage =
    item.type === 'image' ||
    item.mimeType?.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(item.fileName || '')
  if (isImage) {
    return <ImagePreviewCard item={item} />
  }

  // 3. Canvas File Preview
  const isCanvas =
    item.type === 'canvas' ||
    item.kind === 'canvas' ||
    /\.canvas$/i.test(item.fileName || '')
  if (isCanvas) {
    return <CanvasPreviewCard item={item} />
  }

  // 4. PDF File Preview
  const isPdf = item.type === 'pdf' || /\.pdf$/i.test(item.fileName || '')
  if (isPdf) {
    return (
      <div className="tooltip-card-preview">
        <div className="tooltip-card-header">
          <span className="tooltip-card-title">{item.title || item.fileName || 'PDF Document'}</span>
        </div>
        <div className="tooltip-card-meta">
          <span>📄 Portable Document Format</span>
          {item.size ? <span>· {formatBytes(item.size)}</span> : null}
        </div>
      </div>
    )
  }

  // 5. Default Markdown / Text / Code Note Preview
  return <MarkdownPreviewCard item={item} />
}

export default React.memo(FileHoverPreview)
