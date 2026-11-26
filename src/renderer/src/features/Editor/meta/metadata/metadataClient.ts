import { invoke } from '@tauri-apps/api/core'
import type { MetadataPropertyType } from './types'

export interface SqliteMetadataEntry {
  noteId: string
  key: string
  propType: MetadataPropertyType
  value: string
  position: number
  updatedAt: number
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function fetchNoteMetadata(noteId: string): Promise<SqliteMetadataEntry[]> {
  if (!noteId || !isTauriRuntime()) return []
  try {
    return await invoke<SqliteMetadataEntry[]>('metadata_get', { noteId })
  } catch (err) {
    console.error('[metadataClient] metadata_get failed:', err)
    return []
  }
}

export async function upsertNoteMetadata(
  noteId: string,
  key: string,
  propType: MetadataPropertyType,
  value: string,
  position?: number
): Promise<SqliteMetadataEntry[] | null> {
  if (!noteId || !key || !isTauriRuntime()) return null
  try {
    return await invoke<SqliteMetadataEntry[]>('metadata_upsert', {
      noteId,
      key,
      propType,
      value,
      position: typeof position === 'number' ? position : null
    })
  } catch (err) {
    console.error('[metadataClient] metadata_upsert failed:', err)
    return null
  }
}

export async function deleteNoteMetadata(
  noteId: string,
  key: string
): Promise<SqliteMetadataEntry[] | null> {
  if (!noteId || !key || !isTauriRuntime()) return null
  try {
    return await invoke<SqliteMetadataEntry[]>('metadata_delete', { noteId, key })
  } catch (err) {
    console.error('[metadataClient] metadata_delete failed:', err)
    return null
  }
}

export async function clearNoteMetadata(noteId: string): Promise<void> {
  if (!noteId || !isTauriRuntime()) return
  try {
    await invoke<number>('metadata_clear_note', { noteId })
  } catch (err) {
    console.error('[metadataClient] metadata_clear_note failed:', err)
  }
}
