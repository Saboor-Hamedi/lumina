/**
 * ============================================================================
 * Table Parser Progress Extension (Background Incremental Parser)
 * ============================================================================
 * PURPOSE:
 * In large documents (e.g. 5,000+ lines), CodeMirror's Lezer parser initially parses
 * only the visible viewport within a 200ms budget to ensure instant 0ms load times.
 * This plugin runs on idle browser ticks (`requestIdleCallback`) to track when the
 * background parser advances further down the document. When new tables are parsed
 * into existence, it emits `treeGrowthEffect` so downstream table widgets build
 * visual cards instead of remaining raw `| text |` source markdown.
 *
 * CALLED & USED AT:
 * - `src/renderer/src/features/table/tableExtension.js`
 *    • Line 5:  `import { treeGrowthEffect, treeProgressPlugin } from './tableParserProgress'`
 *    • Line 766: `if (effect.is(treeGrowthEffect)) return buildTableWidgets(tr.state)`
 *    • Line 863: `treeProgressPlugin` (included in `tables()` extension bundle)
 * ============================================================================
 */

import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { StateEffect } from '@codemirror/state'
import { ViewPlugin } from '@codemirror/view'

// Broadcasts that lezer's incremental parser has advanced past where
// it was last observed. Consumers (tables, images, inline-preview)
// watch for this effect and rebuild their decorations so content
// parsed into existence during idle time actually renders.
export const treeGrowthEffect = StateEffect.define()

// How much must the parsed range grow before we dispatch a rebuild
// effect. 8KB is roughly two viewport-heights of text.
const GROWTH_THRESHOLD = 8192

// Budget per idle tick (30ms keeps UI smooth while making steady progress)
const TICK_BUDGET_MS = 30

function scheduleIdle(cb) {
  if (typeof window.requestIdleCallback === 'function') {
    return { kind: 'idle', id: window.requestIdleCallback(() => cb()) }
  }
  return { kind: 'raf', id: window.requestAnimationFrame(() => cb()) }
}

function cancelIdle(handle) {
  if (handle.kind === 'idle' && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(handle.id)
  } else if (handle.kind === 'raf') {
    window.cancelAnimationFrame(handle.id)
  }
}

/**
 * View plugin that monitors lezer's parse progress and dispatches a
 * `treeGrowthEffect` whenever the tree has grown enough that
 * downstream decoration builders should re-run.
 */
export const treeProgressPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view
      this._lastTreeLen = syntaxTree(view.state).length
      this._idleHandle = null
      this._destroyed = false
      this._schedule()
    }

    update(update) {
      if (update.docChanged) {
        this._lastTreeLen = syntaxTree(update.state).length
        this._schedule()
      }
    }

    destroy() {
      this._destroyed = true
      if (this._idleHandle !== null) {
        cancelIdle(this._idleHandle)
        this._idleHandle = null
      }
    }

    _schedule() {
      if (this._idleHandle !== null) return
      this._idleHandle = scheduleIdle(() => {
        this._idleHandle = null
        if (!this._destroyed) this._tick()
      })
    }

    _tick() {
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
      if (newLen < docLen) this._schedule()
    }
  }
)
