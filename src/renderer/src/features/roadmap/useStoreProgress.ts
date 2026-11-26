import { useSettingsStore } from '../../core/store/SettingStore'
import type { TableModel } from '../table/tableModel'

export const STATUS_UNREAD = 0 as const
export const STATUS_IN_PROGRESS = 1 as const
export const STATUS_COMPLETED = 2 as const

export type RoadmapStatus =
  | typeof STATUS_UNREAD
  | typeof STATUS_IN_PROGRESS
  | typeof STATUS_COMPLETED

export type RoadmapProgressMap = Record<string, Record<string, RoadmapStatus>>

export interface TrackStats {
  total: number
  completed: number
  inProgress: number
}

export interface DocumentRoadmapProgress extends TrackStats {
  percentage: number
}

export function getRoadmapProgress(): RoadmapProgressMap {
  return (useSettingsStore.getState().settings.roadmapProgress as RoadmapProgressMap | undefined) || {}
}

export function getNoteStatus(trackName: string, noteId: string): RoadmapStatus {
  const progress = getRoadmapProgress()
  const track = progress[trackName] || {}
  return track[noteId] || STATUS_UNREAD
}

export function setNoteStatus(trackName: string, noteId: string, status: RoadmapStatus): void {
  const state = useSettingsStore.getState()
  const progress: RoadmapProgressMap = { ...(state.settings.roadmapProgress as RoadmapProgressMap | undefined) }
  if (!progress[trackName]) progress[trackName] = {}

  progress[trackName] = {
    ...progress[trackName],
    [noteId]: status
  }

  state.updateSetting('roadmapProgress', progress)
}

export function toggleNoteStatus(trackName: string, noteId: string): void {
  const current = getNoteStatus(trackName, noteId)
  const next: RoadmapStatus =
    current === STATUS_UNREAD
      ? STATUS_IN_PROGRESS
      : current === STATUS_IN_PROGRESS
        ? STATUS_COMPLETED
        : STATUS_UNREAD
  setNoteStatus(trackName, noteId, next)
}

export function resetTrackProgress(trackName: string): void {
  const state = useSettingsStore.getState()
  const progress: RoadmapProgressMap = { ...(state.settings.roadmapProgress as RoadmapProgressMap | undefined) }
  delete progress[trackName]
  state.updateSetting('roadmapProgress', progress)
}

export function getTrackStats(
  trackName: string,
  tableModel: Pick<TableModel, 'rows'> | null | undefined
): TrackStats {
  if (!tableModel) return { total: 0, completed: 0, inProgress: 0 }

  let total = 0
  let completed = 0
  let inProgress = 0

  const track = getRoadmapProgress()[trackName] || {}

  for (const row of tableModel.rows) {
    if (row.length > 1) {
      const noteTitle = row[1].trim()
      if (noteTitle) {
        total++
        const status = track[noteTitle] || STATUS_UNREAD
        if (status === STATUS_COMPLETED) completed++
        if (status === STATUS_IN_PROGRESS) inProgress++
      }
    }
  }

  return { total, completed, inProgress }
}

export function calculateDocumentRoadmapProgress(
  code: string | null | undefined,
  progressMap?: RoadmapProgressMap
): DocumentRoadmapProgress | null {
  if (!code || typeof code !== 'string') return null
  const progress = progressMap || getRoadmapProgress()

  const lines = code.split('\n')
  let currentTrackName = 'Track'
  let inTable = false
  let hashColIdx = -1

  let total = 0
  let completed = 0
  let inProgress = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line.startsWith('#')) {
      const headingText = line.replace(/^#+\s*/, '').trim()
      if (headingText) currentTrackName = headingText
      inTable = false
      hashColIdx = -1
      continue
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim())

      if (!inTable) {
        hashColIdx = cells.findIndex((c) =>
          /^(#|no\.?|status)$/i.test(c.replace(/[*_`]/g, '').trim())
        )
        inTable = true
        continue
      }

      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        continue
      }

      if (hashColIdx !== -1 && cells.length > 0) {
        const noteTitle = (cells[1] || cells[0] || '').trim()
        if (noteTitle) {
          total++
          const status = progress[currentTrackName]?.[noteTitle] || STATUS_UNREAD
          if (status === STATUS_COMPLETED) completed++
          else if (status === STATUS_IN_PROGRESS) inProgress++
        }
      }
    } else {
      inTable = false
      hashColIdx = -1
    }
  }

  if (total === 0) return null

  const percentage = Math.min(100, Math.round(((completed + inProgress * 0.5) / total) * 100))
  return { total, completed, inProgress, percentage }
}
