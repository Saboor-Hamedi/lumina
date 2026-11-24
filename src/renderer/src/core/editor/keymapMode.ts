/**
 * =========================================================================================
 * Editor Keymap Mode Scaffold (`keymapMode.ts`)
 * =========================================================================================
 *
 * Reserves a dedicated CodeMirror `Compartment` slot for pluggable modal keymaps
 * (specifically `@replit/codemirror-vim`) without bundling or activating Vim yet.
 *
 * Future integration checklist when enabling Vim mode:
 * 1. Install `@replit/codemirror-vim`.
 * 2. Wire `resolveKeymapModeExtension('vim')` to return `vim()` (lazy-loaded or direct).
 * 3. Dispatch `reconfigureKeymapMode(view, mode)` when `settings.editorKeymapMode` changes.
 * 4. Keep this compartment mounted BEFORE `Prec.highest` UI-overlay bindings (Slash menu,
 *    Autocomplete, Find widget) so `Escape` closes overlays first and otherwise reaches Vim.
 * =========================================================================================
 */

import { Compartment, type Extension } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export type EditorKeymapMode = 'default' | 'vim'

export const DEFAULT_KEYMAP_MODE: EditorKeymapMode = 'default'

/**
 * Shared compartment factory so each mounted EditorView instance can dynamically
 * reconfigure its keymap mode without recreating the editor state.
 */
export function createKeymapModeCompartment(): Compartment {
  return new Compartment()
}

/**
 * Resolves the CodeMirror extension for the requested keymap mode.
 * Currently returns an empty extension for both `'default'` and `'vim'`
 * until `@replit/codemirror-vim` is added.
 */
export function resolveKeymapModeExtension(mode: EditorKeymapMode = DEFAULT_KEYMAP_MODE): Extension {
  switch (mode) {
    case 'vim':
      // Placeholder slot for `@replit/codemirror-vim` (`vim()`).
      return []
    case 'default':
    default:
      return []
  }
}

/**
 * Dynamically reconfigures an active `EditorView`'s keymap mode compartment.
 */
export function reconfigureKeymapMode(
  view: EditorView | null | undefined,
  compartment: Compartment,
  mode: EditorKeymapMode
): void {
  if (!view || (view as any).isDestroyed) return
  view.dispatch({
    effects: compartment.reconfigure(resolveKeymapModeExtension(mode))
  })
}
