import { useSettingsStore } from '../../core/store/useSettingsStore'

export const STATUS_UNREAD = 0
export const STATUS_IN_PROGRESS = 1
export const STATUS_COMPLETED = 2

export function getRoadmapProgress() {
  return useSettingsStore.getState().settings.roadmapProgress || {}
}

export function getNoteStatus(trackName, noteId) {
  const progress = getRoadmapProgress()
  const track = progress[trackName] || {}
  return track[noteId] || STATUS_UNREAD
}

export function setNoteStatus(trackName, noteId, status) {
  const state = useSettingsStore.getState()
  const progress = { ...state.settings.roadmapProgress }
  if (!progress[trackName]) progress[trackName] = {}

  progress[trackName] = {
    ...progress[trackName],
    [noteId]: status
  }

  state.updateSetting('roadmapProgress', progress)
}

export function toggleNoteStatus(trackName, noteId) {
  const current = getNoteStatus(trackName, noteId)
  const next =
    current === STATUS_UNREAD
      ? STATUS_IN_PROGRESS
      : current === STATUS_IN_PROGRESS
        ? STATUS_COMPLETED
        : STATUS_UNREAD
  setNoteStatus(trackName, noteId, next)
}

export function resetTrackProgress(trackName) {
  const state = useSettingsStore.getState()
  const progress = { ...state.settings.roadmapProgress }
  delete progress[trackName]
  state.updateSetting('roadmapProgress', progress)
}

export function getTrackStats(trackName, tableModel) {
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

export function calculateDocumentRoadmapProgress(code, progressMap) {
  if (!code || typeof code !== 'string') return null
  const progress = progressMap || getRoadmapProgress()

  const lines = code.split('\n')
  let currentTrackName = 'Track'
  let inTable = false
  let tableHeader = null
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
      tableHeader = null
      hashColIdx = -1
      continue
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim())

      if (!inTable) {
        tableHeader = cells
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
      tableHeader = null
      hashColIdx = -1
    }
  }

  if (total === 0) return null

  const percentage = Math.min(100, Math.round(((completed + inProgress * 0.5) / total) * 100))
  return { total, completed, inProgress, percentage }
}
