/**
 * exportSelection.ts
 *
 * Resolves a user's File Explorer selection (notes and/or folders) into a flat,
 * de-duplicated list of notes that can be handed to the batch exporter.
 *
 * Why this exists:
 * - Explorer selection is tracked as two independent Sets (`selectedNoteIds` and
 *   `selectedFolderIds`) because folders and notes are different tree nodes.
 * - Selecting a folder should export *everything inside it*, including nested
 *   sub-folders — not just the folder node itself.
 * - A single note can be reachable both directly and via a selected folder, so
 *   the result is de-duplicated by note id.
 * - System folders (Templates, `.lumina`, dotfolders) are never exported.
 */

/** Minimal shape of a workspace note/snippet as stored in the renderer. */
export interface ExportSourceNote {
  id: string
  title?: string
  /** Markdown body (the editor field is named `code`). */
  code?: string
  /** Optional alternate content field. */
  content?: string
  folderId?: string
}

/** Normalised note payload handed to `window.api.exportBatch`. */
export interface ExportTargetNote {
  id: string
  title: string
  content: string
}

/** Folder prefixes that are internal/system and must never be exported. */
const HIDDEN_FOLDER_PREFIXES = ['Templates', '.lumina', '.']

/**
 * Returns true when a note lives in an internal/system folder.
 * @param folderId Folder path (may be undefined for root-level notes).
 */
export function isHiddenFolder(folderId?: string): boolean {
  if (!folderId) return false
  return HIDDEN_FOLDER_PREFIXES.some((prefix) => {
    // Any dotfolder (e.g. `.lumina`, `.trash`) is internal.
    if (prefix === '.') return folderId.startsWith('.')
    return folderId === prefix || folderId.startsWith(`${prefix}/`)
  })
}

/**
 * Collects every note contained in a folder and its descendants.
 *
 * Folder ids are treated as `/`-delimited paths (e.g. `Research/AI`), so a note
 * belongs to `folderId` when its own `folderId` exactly matches, or when it is
 * nested under it (`folderId/…`).
 *
 * @param notes All known notes.
 * @param folderId Folder path to expand.
 * @returns Notes inside that folder subtree (order preserved from `notes`).
 */
export function notesInFolder(
  notes: readonly ExportSourceNote[],
  folderId: string
): ExportSourceNote[] {
  if (!folderId) return []
  const prefix = `${folderId}/`
  return notes.filter((note) => {
    const id = note.folderId || ''
    return id === folderId || id.startsWith(prefix)
  })
}

/**
 * Converts internal notes to the exporter payload, assigning safe defaults.
 * @param notes Notes to normalise.
 */
function toExportTargets(notes: readonly ExportSourceNote[]): ExportTargetNote[] {
  return notes
    .filter((note) => !isHiddenFolder(note.folderId))
    .map((note) => ({
      id: note.id,
      title: note.title || 'Untitled',
      content: note.content ?? note.code ?? ''
    }))
}

/**
 * Resolves the current multi-selection into exportable notes.
 *
 * @param params.notes All known notes.
 * @param params.selectedNoteIds Directly selected note ids.
 * @param params.selectedFolderIds Selected folder paths (expanded recursively).
 * @returns De-duplicated, normalised notes ready for batch export.
 */
export function resolveExportNotes(params: {
  notes: readonly ExportSourceNote[]
  selectedNoteIds?: ReadonlySet<string>
  selectedFolderIds?: ReadonlySet<string>
}): ExportTargetNote[] {
  const { notes, selectedNoteIds, selectedFolderIds } = params
  if (!notes || notes.length === 0) return []

  const byId = new Map(notes.map((note) => [note.id, note]))
  const chosen = new Map<string, ExportSourceNote>()

  // 1. Directly selected notes win.
  selectedNoteIds?.forEach((id) => {
    const note = byId.get(id)
    if (note) chosen.set(note.id, note)
  })

  // 2. Expand each selected folder into its full subtree.
  selectedFolderIds?.forEach((folderId) => {
    for (const note of notesInFolder(notes, folderId)) {
      chosen.set(note.id, note)
    }
  })

  return toExportTargets(Array.from(chosen.values()))
}

/**
 * Resolves the contents of a single folder (used when a folder is right-clicked
 * without a multi-selection).
 *
 * @param notes All known notes.
 * @param folderId Folder path to export.
 */
export function resolveFolderExportNotes(
  notes: readonly ExportSourceNote[],
  folderId: string
): ExportTargetNote[] {
  return toExportTargets(notesInFolder(notes, folderId))
}
