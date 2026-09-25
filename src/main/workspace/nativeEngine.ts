/**
 * nativeEngine.ts
 * 
 * High-performance Rust Native Bridge for Lumina via NAPI-RS.
 * Seamlessly delegates vault scanning, fuzzy search, and graph linking
 * to compiled native machine code with zero JS overhead.
 * 
 * Includes automatic zero-crash fallback to JavaScript if the native addon
 * has not yet been built.
 */

import path from 'path'
import fs from 'fs'

export interface ScannedNote {
  id: string
  title: string
  code: string
  language: string
  tags: string
  timestamp: number
  createdAt?: string
  isPinned: boolean
  isLearned: boolean
  customIcon: string | null
  color: string | null
  type: string
  is_draft: number
  fileName: string
  folderId: string
  relativePath: string
  size: number
  isOversized: boolean
  ext: string
  wikilinks: string[]
}

export interface ScanResult {
  notes: ScannedNote[]
  folders: string[]
  totalScanned: number
  elapsedMs: number
}

export interface SearchHit {
  id: string
  title: string
  relativePath: string
  snippet: string
  score: number
}

export interface SearchIndexItem {
  id: string
  title: string
  relativePath: string
  tags: string
  content: string
}

export interface GraphNode {
  id: string
  label: string
  val: number
  color?: string
}

export interface GraphLink {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface RustCoreModule {
  getCoreVersion: () => string
  scanVault: (vaultPath: string, maxBytes?: number) => { notes: any[]; folders: string[]; totalScanned: number; elapsedMs: number }
  fuzzySearch: (items: SearchIndexItem[], query: string, limit?: number) => SearchHit[]
  buildGraphData: (notes: Array<{ id: string; title: string; wikilinks: string[] }>) => GraphData
}

let rustCore: RustCoreModule | null = null
let hasAttemptedLoad = false

function loadRustCore(): RustCoreModule | null {
  if (hasAttemptedLoad) return rustCore
  hasAttemptedLoad = true

  const possiblePaths = [
    path.join(__dirname, '../../../../crates/lumina_core'),
    path.join(__dirname, '../../../crates/lumina_core'),
    path.join(process.cwd(), 'crates/lumina_core'),
    path.join(process.cwd(), 'resources/native'),
    ...(process.resourcesPath
      ? [
          path.join(process.resourcesPath, 'native'),
          path.join(process.resourcesPath, 'resources/native'),
          path.join(process.resourcesPath, 'crates/lumina_core')
        ]
      : [])
  ]

  for (const candidatePath of possiblePaths) {
    try {
      if (fs.existsSync(candidatePath)) {
        // Try loading compiled index.js or native .node file
        const indexPath = path.join(candidatePath, 'index.js')
        if (fs.existsSync(indexPath)) {
          rustCore = require(indexPath) as RustCoreModule
          console.log(`[Lumina Native Engine] Loaded Rust native core from: ${indexPath} (${rustCore.getCoreVersion()})`)
          return rustCore
        }

        // Try direct .node load in folder
        const files = fs.readdirSync(candidatePath)
        const nodeFile = files.find((f) => f.endsWith('.node'))
        if (nodeFile) {
          const directNodePath = path.join(candidatePath, nodeFile)
          rustCore = require(directNodePath) as RustCoreModule
          console.log(`[Lumina Native Engine] Loaded direct .node native binary: ${directNodePath}`)
          return rustCore
        }
      }
    } catch (err) {
      console.warn(`[Lumina Native Engine] Note: Could not load from ${candidatePath}:`, (err as any)?.message)
    }
  }

  return null
}

export const NativeEngine = {
  /**
   * Check if native Rust engine is active
   */
  isAvailable(): boolean {
    return loadRustCore() !== null
  },

  /**
   * Get engine banner
   */
  getVersion(): string {
    const core = loadRustCore()
    return core ? core.getCoreVersion() : 'javascript-fallback'
  },

  /**
   * Scan entire vault directory using multithreaded Rayon CPU parallelism
   */
  scanVault(vaultPath: string, maxBytes = 5 * 1024 * 1024): ScanResult | null {
    const core = loadRustCore()
    if (!core) return null

    try {
      const raw = core.scanVault(vaultPath, maxBytes)
      const notes: ScannedNote[] = (raw.notes || []).map((n) => ({
        id: n.id,
        title: n.title,
        code: n.code || '',
        language: n.language || 'markdown',
        tags: n.tags || '',
        timestamp: n.timestamp || Date.now(),
        createdAt: n.createdAt,
        isPinned: Boolean(n.isPinned),
        isLearned: Boolean(n.isLearned),
        customIcon: n.customIcon || null,
        color: n.color || null,
        type: n.noteType || 'snippet',
        is_draft: n.isDraft || 0,
        fileName: n.fileName,
        folderId: n.folderId,
        relativePath: n.relativePath,
        size: n.size || 0,
        isOversized: Boolean(n.isOversized),
        ext: n.ext || '',
        wikilinks: n.wikilinks || []
      }))

      return {
        notes,
        folders: raw.folders || [],
        totalScanned: raw.totalScanned,
        elapsedMs: raw.elapsedMs
      }
    } catch (err) {
      console.error('[Lumina Native Engine] Error during native scan_vault:', err)
      return null
    }
  },

  /**
   * Sub-millisecond ranked fuzzy search across notes
   */
  fuzzySearch(items: SearchIndexItem[], query: string, limit = 30): SearchHit[] | null {
    const core = loadRustCore()
    if (!core) return null

    try {
      return core.fuzzySearch(items, query, limit)
    } catch (err) {
      console.error('[Lumina Native Engine] Error during native fuzzy_search:', err)
      return null
    }
  },

  /**
   * Sub-millisecond graph node and link matrix construction
   */
  buildGraphData(notes: Array<{ id: string; title: string; wikilinks: string[] }>): GraphData | null {
    const core = loadRustCore()
    if (!core) return null

    try {
      return core.buildGraphData(notes)
    } catch (err) {
      console.error('[Lumina Native Engine] Error during native build_graph_data:', err)
      return null
    }
  }
}

export default NativeEngine
