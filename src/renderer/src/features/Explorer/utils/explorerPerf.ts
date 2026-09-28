type PerfInteraction = {
  id: string
  kind: 'note' | 'folder'
  startedAt: number
  counts: Map<string, number>
  itemIds: Map<string, Set<string>>
  finished: boolean
}

type PerfState = {
  active: PerfInteraction | null
}

const perfState = ((window as any).__luminaExplorerPerf ||= { active: null }) as PerfState
const enabled = Boolean(import.meta.env.DEV)

const log = (label: string, startedAt: number, detail?: Record<string, unknown>) => {
  if (!enabled) return
  console.info(`[ExplorerPerf] ${label}`, {
    elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
    ...detail
  })
}

export function beginExplorerPerf(kind: 'note' | 'folder', id: string): string | null {
  if (!enabled) return null
  const traceId = `${kind}:${id}:${performance.now().toFixed(2)}`
  perfState.active = { id, kind, startedAt: performance.now(), counts: new Map(), itemIds: new Map(), finished: false }
  log(`${kind}-click-start`, perfState.active.startedAt, { id, traceId })
  return traceId
}

export function markExplorerPerf(label: string, detail?: Record<string, unknown>) {
  const active = perfState.active
  if (!enabled || !active || active.finished) return
  if (active.kind === 'note' && typeof detail?.noteId === 'string' && detail.noteId !== active.id) return
  log(label, active.startedAt, { id: active.id, kind: active.kind, ...detail })
}

export function countExplorerPerfRender(component: string, id?: string) {
  const active = perfState.active
  if (!enabled || !active || active.finished) return
  active.counts.set(component, (active.counts.get(component) || 0) + 1)
  if (id) {
    const ids = active.itemIds.get(component) || new Set<string>()
    ids.add(id)
    active.itemIds.set(component, ids)
  }
}

export function finishExplorerPerfPaint(detail?: Record<string, unknown>) {
  const active = perfState.active
  if (!enabled || !active || active.finished) return

  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (perfState.active !== active || active.finished) return
    active.finished = true
    log('paint', active.startedAt, detail)
    const renderCounts = Object.fromEntries(active.counts)
    const renderedItemCounts = Object.fromEntries(
      Array.from(active.itemIds, ([component, ids]) => [component, { count: ids.size, sample: Array.from(ids).slice(0, 12) }])
    )
    console.info('[ExplorerPerf] render-counts', {
      id: active.id,
      kind: active.kind,
      elapsedMs: Number((performance.now() - active.startedAt).toFixed(2)),
      renderCounts,
      renderedItemCounts
    })
  }))
}

export function isExplorerPerfEnabled() {
  return enabled
}
