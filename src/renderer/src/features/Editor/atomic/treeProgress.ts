import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { StateEffect } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'

/**
 * Broadcasts that lezer's incremental parser has advanced past where
 * it was last observed. Consumers watch for this effect and rebuild
 * their decorations so content parsed during idle time renders properly.
 */
export const treeGrowthEffect = StateEffect.define<null>()

const GROWTH_THRESHOLD = 8192
const TICK_BUDGET_MS = 30

type IdleHandle =
  | { kind: 'idle'; id: number }
  | { kind: 'raf'; id: number }

function scheduleIdle(cb: () => void): IdleHandle {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    return { kind: 'idle', id: window.requestIdleCallback(() => cb()) }
  }
  return { kind: 'raf', id: window.requestAnimationFrame(() => cb()) }
}

function cancelIdle(handle: IdleHandle): void {
  if (typeof window === 'undefined') return
  if (handle.kind === 'idle' && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(handle.id)
  } else if (handle.kind === 'raf') {
    window.cancelAnimationFrame(handle.id)
  }
}

class TreeProgressPluginValue {
  view: EditorView
  _lastTreeLen: number
  _idleHandle: IdleHandle | null = null
  _destroyed = false

  constructor(view: EditorView) {
    this.view = view
    this._lastTreeLen = syntaxTree(view.state).length
    this._schedule()
  }

  update(update: ViewUpdate): void {
    if (update.docChanged) {
      this._lastTreeLen = syntaxTree(update.state).length
      this._schedule()
    }
  }

  destroy(): void {
    this._destroyed = true
    if (this._idleHandle !== null) {
      cancelIdle(this._idleHandle)
      this._idleHandle = null
    }
  }

  _schedule(): void {
    if (this._idleHandle !== null) return
    this._idleHandle = scheduleIdle(() => {
      this._idleHandle = null
      if (!this._destroyed) {
        this._tick()
      }
    })
  }

  _tick(): void {
    const state = this.view.state
    const docLen = state.doc.length
    if (this._lastTreeLen >= docLen) return

    const ensured = ensureSyntaxTree(state, docLen, TICK_BUDGET_MS)
    const newLen = (ensured ?? syntaxTree(state)).length
    if (newLen >= this._lastTreeLen + GROWTH_THRESHOLD || newLen >= docLen) {
      const previous = this._lastTreeLen
      this._lastTreeLen = newLen
      try {
        this.view.dispatch({ effects: treeGrowthEffect.of(null) })
      } catch {
        this._lastTreeLen = previous
        return
      }
    }
    if (newLen < docLen) {
      this._schedule()
    }
  }
}

export const treeProgressPlugin = ViewPlugin.fromClass(TreeProgressPluginValue)
