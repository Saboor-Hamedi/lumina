/**
 * noteCreatedAt.ts
 * Human-readable relative time for note creation timestamps.
 * Intentionally tiny — no dependencies, no i18n overhead.
 */
import { useState, useEffect } from 'react'

export interface RelativeTimeResult {
  /** e.g. "Created 22 minutes ago" */
  label: string
  /** ms until the label would change — use for re-render scheduling */
  nextUpdateMs: number
}

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

/**
 * Returns a human-readable relative creation label and when to refresh it.
 *
 * @param createdAt - ISO 8601 string, Date, or epoch ms number (e.g. stats.mtimeMs)
 * @param now       - reference time (defaults to Date.now())
 */
export function formatNoteCreatedAt(
  createdAt: string | Date | number | null | undefined,
  now: number = Date.now()
): RelativeTimeResult {
  if (createdAt === null || createdAt === undefined || createdAt === '') {
    return { label: '', nextUpdateMs: HOUR }
  }

  let created: number
  if (typeof createdAt === 'number') {
    created = createdAt
  } else if (typeof createdAt === 'string') {
    created = Date.parse(createdAt)
  } else {
    created = createdAt.getTime()
  }

  if (isNaN(created)) {
    return { label: '', nextUpdateMs: HOUR }
  }

  const diff = now - created

  if (diff < 0) {
    // future — shouldn't happen, but handle gracefully
    return { label: 'Created just now', nextUpdateMs: MINUTE }
  }

  if (diff < MINUTE) {
    return { label: 'Created just now', nextUpdateMs: MINUTE - diff }
  }

  if (diff < HOUR) {
    const mins = Math.floor(diff / MINUTE)
    return {
      label: `Created ${mins} minute${mins === 1 ? '' : 's'} ago`,
      nextUpdateMs: MINUTE - (diff % MINUTE)
    }
  }

  if (diff < DAY) {
    const hrs = Math.floor(diff / HOUR)
    return {
      label: `Created ${hrs} hour${hrs === 1 ? '' : 's'} ago`,
      nextUpdateMs: HOUR - (diff % HOUR)
    }
  }

  if (diff < WEEK) {
    const days = Math.floor(diff / DAY)
    return {
      label: `Created ${days} day${days === 1 ? '' : 's'} ago`,
      nextUpdateMs: DAY - (diff % DAY)
    }
  }

  if (diff < MONTH) {
    const weeks = Math.floor(diff / WEEK)
    return {
      label: `Created ${weeks} week${weeks === 1 ? '' : 's'} ago`,
      nextUpdateMs: WEEK - (diff % WEEK)
    }
  }

  if (diff < YEAR) {
    const months = Math.floor(diff / MONTH)
    return {
      label: `Created ${months} month${months === 1 ? '' : 's'} ago`,
      nextUpdateMs: MONTH - (diff % MONTH)
    }
  }

  const years = Math.floor(diff / YEAR)
  return {
    label: `Created ${years} year${years === 1 ? '' : 's'} ago`,
    nextUpdateMs: YEAR - (diff % YEAR)
  }
}

/**
 * React hook: returns a live-updating relative label for a note's createdAt.
 * Auto-schedules re-renders at exactly the right cadence.
 */
export function useNoteCreatedAt(createdAt: string | Date | number | null | undefined): string {
  const compute = () => formatNoteCreatedAt(createdAt)

  const [result, setResult] = useState<RelativeTimeResult>(compute)

  useEffect(() => {
    // Recompute immediately when createdAt changes
    const fresh = compute()
    setResult(fresh)

    if (!fresh.label) return

    const id = setTimeout(() => {
      setResult(compute())
    }, Math.max(fresh.nextUpdateMs, 1000))

    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdAt])

  // Tick on each render interval using a cascade pattern
  useEffect(() => {
    if (!result.label) return
    const id = setTimeout(() => setResult(compute()), Math.max(result.nextUpdateMs, 1000))
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  return result.label
}
