/**
 * ============================================================================
 * Lumina Workspace Entity Resolver & Cache
 * ============================================================================
 *
 * Single source of truth for resolving workspace entities (folders, notes,
 * source-code files, images, diagrams, PDFs, built-in brain docs, and external URLs)
 * across AI response rendering, inline @mentions, wikilinks, and folder trees.
 *
 * Performance & Reliability:
 * - Caches normalized lookup maps keyed by workspace state array references so
 *   repeated entity lookups within a response or streaming render are O(1).
 * - Resolves duplicate note names across different folders using path context.
 * - Provides graceful fallbacks when an entity has been deleted or cannot be resolved.
 */

import { useWorkspaceStore, type WorkspaceNote } from '../../../core/store/workspaceStore'
import { collectWorkspaceFolders, matchFolderByQuery, normalizeTitle } from './prompt/mentionResolver'
import { getBrainFile } from './brainKnowledge'

export type WorkspaceEntityType =
  | 'folder'
  | 'note'
  | 'code'
  | 'image'
  | 'diagram'
  | 'pdf'
  | 'brain'
  | 'external'
  | 'unresolved'

export interface ResolvedWorkspaceEntity {
  id: string
  type: WorkspaceEntityType
  displayName: string
  relativePath: string
  folderId?: string
  snippet?: WorkspaceNote
  brainDoc?: any
  color?: string | null
  customIcon?: string | null
  childCount?: number
  extension?: string
  language?: string
  exists: boolean
  navigationTarget: string
}

export interface ResolveEntityOptions {
  contextFolder?: string
  preferFolder?: boolean
  strictMatch?: boolean
}

const BRAIN_DOC_KEYS = new Set([
  'purpose',
  'shortcuts',
  'shortcut',
  'introduction',
  'intro',
  'lumina',
  'syntax',
  'code-and-syntax',
  'tables',
  'tasklists',
  'mermaid',
  'math',
  'html',
  'admonitions',
  'best-practices',
  'vision',
  'vision-guide',
  'scope',
  'suggestions',
  'error-reference'
])

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'bmp',
  'ico',
  'avif'
])

const DIAGRAM_EXTENSIONS = new Set([
  'canvas',
  'excalidraw',
  'mermaid',
  'mmd',
  'drawio',
  'diagram'
])

const CODE_EXTENSIONS = new Set([
  'js',
  'jsx',
  'ts',
  'tsx',
  'mjs',
  'cjs',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'php',
  'swift',
  'kt',
  'sql',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'bat',
  'cmd',
  'json',
  'yaml',
  'yml',
  'toml',
  'xml',
  'csv',
  'html',
  'css',
  'scss',
  'less',
  'vue',
  'svelte'
])

const CODE_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'python',
  'sql',
  'json',
  'yaml',
  'html',
  'css',
  'scss',
  'bash',
  'shell',
  'sh',
  'rust',
  'go',
  'java',
  'cpp',
  'c',
  'csharp',
  'php',
  'ruby',
  'swift',
  'kotlin'
])

const LEADING_ENTITY_EMOJI_RE = /^(?:[📁📂📄📝📃🖼️📊📈📉🗂️📕📗📘📙📓📔🔗]+\s*)+/u

export const stripLeadingEntityEmoji = (text?: string): string => {
  if (!text) return ''
  return text.replace(LEADING_ENTITY_EMOJI_RE, '').trim()
}

export const normalizeEntityPath = (raw?: string): string =>
  String(raw || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')

export const extractExtension = (name?: string): string => {
  const clean = String(name || '').trim().toLowerCase()
  const base = clean.split('/').pop() || clean
  if (!base.includes('.')) return ''
  return base.slice(base.lastIndexOf('.') + 1)
}

/**
 * Determines the semantic entity type for a workspace snippet using its actual
 * metadata (`type`, `language`, `fileName`, `title`, and `code`).
 */
export const classifySnippetEntityType = (snippet?: WorkspaceNote | null): WorkspaceEntityType => {
  if (!snippet) return 'unresolved'
  if ((snippet as any).isFolder || snippet.itemType === 'folder') return 'folder'
  if ((snippet as any).isBrain) return 'brain'

  const rawType = String(snippet.type || '').toLowerCase().trim()
  const rawLang = String(snippet.language || '').toLowerCase().trim()
  const fileName = String(snippet.fileName || snippet.title || '').toLowerCase().trim()
  const title = String(snippet.title || '').toLowerCase().trim()
  const ext = extractExtension(fileName) || extractExtension(title)

  if (rawType === 'image' || rawLang === 'image' || IMAGE_EXTENSIONS.has(ext)) {
    return 'image'
  }

  if (rawType === 'pdf' || rawLang === 'pdf' || ext === 'pdf') {
    return 'pdf'
  }

  if (
    rawType === 'diagram' ||
    rawType === 'canvas' ||
    rawLang === 'canvas' ||
    rawLang === 'mermaid' ||
    rawLang === 'diagram' ||
    DIAGRAM_EXTENSIONS.has(ext)
  ) {
    return 'diagram'
  }

  const code = String(snippet.code || '').trim()
  if (
    code &&
    (/^```mermaid[\s\S]*```$/i.test(code) ||
      (/\b(?:flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|mindmap)\b/.test(code) &&
        /\b(?:diagram|flowchart|architecture|graph|schema)\b/i.test(title)))
  ) {
    return 'diagram'
  }

  if (CODE_EXTENSIONS.has(ext) || CODE_LANGUAGES.has(rawLang)) {
    return 'code'
  }

  return 'note'
}

/**
 * Infers a fallback entity type from a target string when the entity is not found
 * in the workspace store (e.g. deleted file or uncreated reference).
 */
export const inferFallbackEntityType = (
  rawTarget: string,
  hadFolderPrefix = false
): WorkspaceEntityType => {
  if (hadFolderPrefix || rawTarget.endsWith('/')) return 'folder'
  const ext = extractExtension(rawTarget)
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (DIAGRAM_EXTENSIONS.has(ext)) return 'diagram'
  if (CODE_EXTENSIONS.has(ext)) return 'code'
  return ' unresolved'.trim() as WorkspaceEntityType
}

interface WorkspaceEntityLookupCache {
  notesRef: any[]
  foldersRef: string[]
  folderColorsRef: Record<string, string>
  canonicalFolders: string[]
  folderByLowerPath: Map<string, string>
  folderByBaseLower: Map<string, string[]>
  folderByNormBase: Map<string, string[]>
  folderChildCounts: Map<string, number>
  noteById: Map<string, WorkspaceNote>
  noteByExactPath: Map<string, WorkspaceNote>
  notesByTitleLower: Map<string, WorkspaceNote[]>
  notesByNormTitle: Map<string, WorkspaceNote[]>
  notesByFileNameLower: Map<string, WorkspaceNote[]>
}

let _cachedIndex: WorkspaceEntityLookupCache | null = null
let _cacheVersion = 0

export const getWorkspaceEntityCacheVersion = (): number => {
  getWorkspaceEntityIndex()
  return _cacheVersion
}

const getWorkspaceEntityIndex = (): WorkspaceEntityLookupCache => {
  let notes: WorkspaceNote[] = []
  let folders: string[] = []
  let folderColors: Record<string, string> = {}

  try {
    const state = useWorkspaceStore.getState() as any
    notes = (Array.isArray(state?.notes) && state.notes.length > 0 ? state.notes : state?.snippets) || []
    folders = Array.isArray(state?.folders) ? state.folders : []
    folderColors = state?.folderColors || {}
  } catch {
    // Store unavailable in isolated unit test environment
  }

  if (
    _cachedIndex &&
    _cachedIndex.notesRef === notes &&
    _cachedIndex.foldersRef === folders &&
    _cachedIndex.folderColorsRef === folderColors
  ) {
    return _cachedIndex
  }

  _cacheVersion += 1

  const canonicalFolders = collectWorkspaceFolders(notes, folders)
  const folderByLowerPath = new Map<string, string>()
  const folderByBaseLower = new Map<string, string[]>()
  const folderByNormBase = new Map<string, string[]>()
  const folderChildCounts = new Map<string, number>()

  for (const folderPath of canonicalFolders) {
    const lower = folderPath.toLowerCase()
    folderByLowerPath.set(lower, folderPath)
    const base = lower.split('/').pop() || lower
    if (!folderByBaseLower.has(base)) folderByBaseLower.set(base, [])
    folderByBaseLower.get(base)!.push(folderPath)

    const normBase = normalizeTitle(base)
    if (normBase) {
      if (!folderByNormBase.has(normBase)) folderByNormBase.set(normBase, [])
      folderByNormBase.get(normBase)!.push(folderPath)
    }
    folderChildCounts.set(lower, 0)
  }

  const noteById = new Map<string, WorkspaceNote>()
  const noteByExactPath = new Map<string, WorkspaceNote>()
  const notesByTitleLower = new Map<string, WorkspaceNote[]>()
  const notesByNormTitle = new Map<string, WorkspaceNote[]>()
  const notesByFileNameLower = new Map<string, WorkspaceNote[]>()

  for (const note of notes) {
    if (!note) continue
    if (note.id) noteById.set(String(note.id), note)

    const folderPath = normalizeEntityPath(note.folderId)
    const lowerFolder = folderPath.toLowerCase()
    if (lowerFolder) {
      // Increment count for folder and any ancestor folders
      let curr = ''
      for (const part of lowerFolder.split('/')) {
        curr = curr ? `${curr}/${part}` : part
        folderChildCounts.set(curr, (folderChildCounts.get(curr) || 0) + 1)
      }
    }

    const rawTitle = String(note.title || '').trim()
    const cleanTitleLower = rawTitle.toLowerCase().replace(/\.md$/i, '')
    const normTitle = normalizeTitle(rawTitle)
    const fileNameLower = String(note.fileName || '').trim().toLowerCase()

    if (cleanTitleLower) {
      if (!notesByTitleLower.has(cleanTitleLower)) notesByTitleLower.set(cleanTitleLower, [])
      notesByTitleLower.get(cleanTitleLower)!.push(note)

      if (lowerFolder) {
        noteByExactPath.set(`${lowerFolder}/${cleanTitleLower}`, note)
        noteByExactPath.set(`${lowerFolder}/${rawTitle.toLowerCase()}`, note)
      } else {
        noteByExactPath.set(cleanTitleLower, note)
      }
    }

    if (normTitle) {
      if (!notesByNormTitle.has(normTitle)) notesByNormTitle.set(normTitle, [])
      notesByNormTitle.get(normTitle)!.push(note)
    }

    if (fileNameLower) {
      if (!notesByFileNameLower.has(fileNameLower)) notesByFileNameLower.set(fileNameLower, [])
      notesByFileNameLower.get(fileNameLower)!.push(note)
      if (lowerFolder) {
        noteByExactPath.set(`${lowerFolder}/${fileNameLower}`, note)
      }
    }
  }

  _cachedIndex = {
    notesRef: notes,
    foldersRef: folders,
    folderColorsRef: folderColors,
    canonicalFolders,
    folderByLowerPath,
    folderByBaseLower,
    folderByNormBase,
    folderChildCounts,
    noteById,
    noteByExactPath,
    notesByTitleLower,
    notesByNormTitle,
    notesByFileNameLower
  }

  return _cachedIndex
}

const buildFolderEntity = (
  folderPath: string,
  displayLabel: string | undefined,
  cache: WorkspaceEntityLookupCache
): ResolvedWorkspaceEntity => {
  const lower = folderPath.toLowerCase()
  const baseName = folderPath.split('/').pop() || folderPath
  const cleanDisplay = stripLeadingEntityEmoji(displayLabel) || baseName
  const color =
    cache.folderColorsRef[folderPath] ||
    cache.folderColorsRef[lower] ||
    null
  return {
    id: `folder:${folderPath}`,
    type: 'folder',
    displayName: cleanDisplay,
    relativePath: folderPath,
    folderId: folderPath,
    color,
    childCount: cache.folderChildCounts.get(lower) ?? 0,
    exists: true,
    navigationTarget: folderPath
  }
}

const buildNoteEntity = (
  note: WorkspaceNote,
  displayLabel?: string
): ResolvedWorkspaceEntity => {
  const entityType = classifySnippetEntityType(note)
  const folderId = normalizeEntityPath(note.folderId)
  const title = String(note.title || note.fileName || 'Untitled').trim()
  const relativePath = folderId ? `${folderId}/${title}` : title
  const rawDisplay = stripLeadingEntityEmoji(displayLabel) || title
  // Strip folder prefix from display name if rawDisplay was a full path like "MySql/Introduction Mysql"
  const cleanDisplay =
    folderId && rawDisplay.toLowerCase().startsWith(`${folderId.toLowerCase()}/`)
      ? rawDisplay.slice(folderId.length + 1)
      : rawDisplay

  return {
    id: String(note.id || relativePath),
    type: entityType,
    displayName: cleanDisplay,
    relativePath,
    folderId,
    snippet: note,
    color: note.color || null,
    customIcon: note.customIcon || null,
    extension: extractExtension(note.fileName || title),
    language: note.language,
    exists: true,
    navigationTarget: relativePath
  }
}

/**
 * Resolves a reference target (from `[[...]]`, `wikilink:...`, `folder:...`, `@mention`,
 * or tree line) into a structured `ResolvedWorkspaceEntity`.
 */
export const resolveWorkspaceEntity = (
  rawTarget?: string | null,
  displayLabel?: string,
  options: ResolveEntityOptions = {}
): ResolvedWorkspaceEntity => {
  const raw = String(rawTarget || '').trim()
  if (!raw) {
    return {
      id: 'unresolved:empty',
      type: 'unresolved',
      displayName: stripLeadingEntityEmoji(displayLabel) || 'Untitled',
      relativePath: '',
      exists: false,
      navigationTarget: ''
    }
  }

  // 1. External URLs remain distinct
  if (/^(https?|mailto):/i.test(raw)) {
    return {
      id: `external:${raw}`,
      type: 'external',
      displayName: displayLabel || raw,
      relativePath: raw,
      exists: true,
      navigationTarget: raw
    }
  }

  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    decoded = raw
  }

  const hadFolderPrefix = /^folder:/i.test(decoded) || /[📁📂]/u.test(decoded) || /[📁📂]/u.test(displayLabel || '')
  const hadNotePrefix = /^note:/i.test(decoded)
  const hadTrailingSlash = decoded.endsWith('/') && decoded.length > 1

  let cleaned = decoded
    .replace(/^(?:wikilink:|folder:|note:|file:\/\/\/?)/i, '')
    .replace(/^@/, '')
    .replace(/^#/, '')
    .trim()

  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    cleaned = cleaned.slice(1, -1).trim()
  }

  // Handle `Target|Alias` syntax if present
  let effectiveDisplay = displayLabel
  if (cleaned.includes('|')) {
    const [targetPart, aliasPart] = cleaned.split('|')
    cleaned = targetPart.trim()
    if (!effectiveDisplay || effectiveDisplay === raw || effectiveDisplay === decoded) {
      effectiveDisplay = aliasPart.trim()
    }
  }

  cleaned = stripLeadingEntityEmoji(cleaned)
  const normPath = normalizeEntityPath(cleaned)
  const lowerPath = normPath.toLowerCase()
  const cleanNoMd = lowerPath.replace(/\.md$/i, '')
  const baseName = cleanNoMd.split('/').pop() || cleanNoMd
  const normBase = normalizeTitle(baseName)
  const explicitFolderPart = cleanNoMd.includes('/')
    ? cleanNoMd.slice(0, cleanNoMd.lastIndexOf('/'))
    : normalizeEntityPath(options.contextFolder).toLowerCase()

  const cache = getWorkspaceEntityIndex()

  // 2. If explicitly marked as folder (`folder:...`, trailing `/`, or `preferFolder`)
  if ((hadFolderPrefix || hadTrailingSlash || options.preferFolder) && !hadNotePrefix) {
    const exactFolder =
      cache.folderByLowerPath.get(lowerPath) ||
      cache.folderByBaseLower.get(baseName)?.[0] ||
      cache.folderByNormBase.get(normBase)?.[0] ||
      (!options.strictMatch ? matchFolderByQuery(normPath, cache.canonicalFolders) : null)

    if (exactFolder) {
      return buildFolderEntity(exactFolder, effectiveDisplay, cache)
    }
  }

  // 3. Exact Note Path Match (`Folder/Title`) - handles duplicate note names across folders!
  if (cleanNoMd.includes('/')) {
    const exactPathNote =
      cache.noteByExactPath.get(cleanNoMd) ||
      cache.noteByExactPath.get(lowerPath)
    if (exactPathNote) {
      return buildNoteEntity(exactPathNote, effectiveDisplay)
    }

    // Check if the path is a nested folder path (e.g. `Courses/MySql`)
    const exactNestedFolder = cache.folderByLowerPath.get(lowerPath)
    if (exactNestedFolder) {
      return buildFolderEntity(exactNestedFolder, effectiveDisplay, cache)
    }

    // Check if folder part + normalized note title matches
    const candidates =
      cache.notesByTitleLower.get(baseName) ||
      cache.notesByNormTitle.get(normBase) ||
      cache.notesByFileNameLower.get(lowerPath.split('/').pop() || '')
    if (candidates && candidates.length > 0) {
      const matchedInFolder = candidates.find((n) => {
        const nf = normalizeEntityPath(n.folderId).toLowerCase()
        return nf === explicitFolderPart || nf.endsWith(`/${explicitFolderPart}`)
      })
      if (matchedInFolder) {
        return buildNoteEntity(matchedInFolder, effectiveDisplay)
      }
    }
  }

  // 4. Exact Folder Match (when target matches a known folder name like `MySql` or `entrichment`)
  if (!hadNotePrefix) {
    const exactFolderPath =
      cache.folderByLowerPath.get(lowerPath) ||
      (cache.folderByBaseLower.get(baseName)?.length === 1
        ? cache.folderByBaseLower.get(baseName)![0]
        : undefined)

    // If it matches a known folder AND there is no note with that exact title (or folder is preferred)
    const hasExactNoteWithSameName =
      cache.notesByTitleLower.has(cleanNoMd) || cache.notesByFileNameLower.has(lowerPath)
    if (exactFolderPath && (!hasExactNoteWithSameName || hadFolderPrefix || hadTrailingSlash)) {
      return buildFolderEntity(exactFolderPath, effectiveDisplay, cache)
    }
  }

  // 5. Note Match by ID, Exact Title, Filename, or Normalized Title (disambiguated by contextFolder if provided)
  const idMatch = cache.noteById.get(normPath) || cache.noteById.get(raw)
  if (idMatch) {
    return buildNoteEntity(idMatch, effectiveDisplay)
  }

  const pickBestNoteCandidate = (candidates?: WorkspaceNote[]): WorkspaceNote | null => {
    if (!candidates || candidates.length === 0) return null
    if (candidates.length === 1) return candidates[0]
    if (explicitFolderPart) {
      const inContext = candidates.find((n) => {
        const nf = normalizeEntityPath(n.folderId).toLowerCase()
        return nf === explicitFolderPart || nf.endsWith(`/${explicitFolderPart}`)
      })
      if (inContext) return inContext
    }
    return candidates[0]
  }

  const exactTitleMatch =
    pickBestNoteCandidate(cache.notesByTitleLower.get(cleanNoMd)) ||
    pickBestNoteCandidate(cache.notesByFileNameLower.get(lowerPath)) ||
    pickBestNoteCandidate(cache.notesByNormTitle.get(normBase))

  if (exactTitleMatch) {
    return buildNoteEntity(exactTitleMatch, effectiveDisplay)
  }

  // 6. Check if it matches a folder (even if a note didn't match, or via normalized folder name / typo-tolerant match)
  if (!hadNotePrefix) {
    const normFolderMatch =
      cache.folderByBaseLower.get(baseName)?.[0] ||
      cache.folderByNormBase.get(normBase)?.[0] ||
      (!options.strictMatch ? matchFolderByQuery(normPath, cache.canonicalFolders) : null)
    if (normFolderMatch) {
      return buildFolderEntity(normFolderMatch, effectiveDisplay, cache)
    }
  }

  // 7. Built-in Brain Documentation Match
  const cleanBrainKey = cleanNoMd.replace(/^brain\//, '')
  if (
    BRAIN_DOC_KEYS.has(cleanBrainKey) ||
    BRAIN_DOC_KEYS.has(baseName) ||
    lowerPath.startsWith('brain/')
  ) {
    const bDoc = getBrainFile(cleanBrainKey) || getBrainFile(baseName)
    return {
      id: `brain:${cleanBrainKey}`,
      type: 'brain',
      displayName: stripLeadingEntityEmoji(effectiveDisplay) || bDoc?.name || normPath,
      relativePath: bDoc?.path || `brain/${cleanBrainKey}`,
      brainDoc: bDoc,
      exists: true,
      navigationTarget: bDoc?.path || cleanBrainKey
    }
  }

  // 8. Non-strict partial note match (only when explicitly linked via wikilink/@mention, not strict list scan)
  if (!options.strictMatch && cleanNoMd.length >= 3) {
    for (const [titleLower, list] of cache.notesByTitleLower.entries()) {
      if (titleLower.includes(cleanNoMd) || cleanNoMd.includes(titleLower)) {
        const candidate = pickBestNoteCandidate(list)
        if (candidate) {
          return buildNoteEntity(candidate, effectiveDisplay)
        }
      }
    }
  }

  // 9. Graceful fallback for missing / deleted entities
  const fallbackType = inferFallbackEntityType(normPath, hadFolderPrefix || hadTrailingSlash)
  const fallbackDisplay =
    stripLeadingEntityEmoji(effectiveDisplay) ||
    normPath.split('/').pop()?.replace(/\.md$/i, '') ||
    normPath

  return {
    id: `unresolved:${normPath}`,
    type: fallbackType,
    displayName: fallbackDisplay,
    relativePath: normPath,
    folderId: explicitFolderPart || undefined,
    extension: extractExtension(normPath),
    exists: false,
    navigationTarget: normPath
  }
}

/**
 * Navigates to a resolved workspace entity or raw target string.
 * - Notes, images, PDFs, diagrams, and code files open in the editor.
 * - Folders select/focus the folder in the workspace store and Explorer.
 * - Brain docs open the Documentation modal.
 */
export const navigateToWorkspaceEntity = (
  targetOrEntity?: string | ResolvedWorkspaceEntity | null,
  contextFolder?: string
): void => {
  if (!targetOrEntity) return
  try {
    const entity =
      typeof targetOrEntity === 'string'
        ? resolveWorkspaceEntity(targetOrEntity, undefined, { contextFolder })
        : targetOrEntity

    if (entity.type === 'external' && entity.navigationTarget) {
      if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
        ;(window as any).electron.ipcRenderer.send('open-external-url', entity.navigationTarget)
      } else if (typeof window !== 'undefined') {
        window.open(entity.navigationTarget, '_blank', 'noopener,noreferrer')
      }
      return
    }

    const state = useWorkspaceStore.getState() as any

    if (entity.type === 'folder' && entity.exists) {
      if (state?.setSelectedFolder) {
        state.setSelectedFolder(entity.relativePath)
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('lumina-navigate-folder', {
            detail: { folderPath: entity.relativePath }
          })
        )
      }
      return
    }

    if (entity.snippet) {
      if (state?.setSelectedNote) state.setSelectedNote(entity.snippet)
      if (state?.setActiveTabId) state.setActiveTabId(entity.snippet.id)
      return
    }

    if (entity.type === 'brain') {
      const docTarget = entity.brainDoc?.path || entity.brainDoc?.name || entity.navigationTarget
      if (typeof window !== 'undefined' && docTarget) {
        window.dispatchEvent(new CustomEvent('open-documentation', { detail: { doc: docTarget } }))
        window.dispatchEvent(new CustomEvent('open-doc', { detail: { doc: docTarget } }))
      }
      return
    }

    // Final fallback: attempt brain lookup if unresolved
    if (!entity.exists && entity.navigationTarget) {
      const bDoc = getBrainFile(entity.navigationTarget)
      if (bDoc && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('open-documentation', { detail: { doc: bDoc.path || bDoc.name } })
        )
        window.dispatchEvent(
          new CustomEvent('open-doc', { detail: { doc: bDoc.path || bDoc.name } })
        )
      }
    }
  } catch (err) {
    console.error('[EntityResolver] Failed to navigate to entity:', err)
  }
}
