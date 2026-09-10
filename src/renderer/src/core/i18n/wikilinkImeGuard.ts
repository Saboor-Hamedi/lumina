/**
 * wikilinkImeGuard.ts
 *
 * IME (Chinese/Japanese/Korean input method) safety helpers for the
 * wikilink autocomplete. Two distinct failure modes are guarded against:
 *
 *  1. Opening/refreshing the completion popup mid-composition, which can
 *     corrupt or cancel the composition buffer.
 *  2. Enter/Escape keybindings on the completion popup stealing a keypress
 *     that the IME needed for candidate selection/confirmation.
 */

import { EditorView, KeyBinding } from "@codemirror/view";

/**
 * Returns true if the view is currently mid-IME-composition. CodeMirror 6
 * exposes `view.composing` on recent versions; fall back to checking the
 * DOM composition state directly if that field isn't present, so this
 * stays safe across CM6 minor version differences.
 */
export function isComposing(view: EditorView): boolean {
  const anyView = view as unknown as { composing?: boolean };
  if (typeof anyView.composing === "boolean") {
    return anyView.composing;
  }
  // Fallback: some environments track this via a data attribute set by
  // compositionstart/compositionend listeners registered on view.dom.
  return view.dom.getAttribute("data-ime-composing") === "true";
}

/**
 * Call this before opening or refreshing the wikilink autocomplete popup
 * (e.g. inside your `wikiLinkCompletionSource`'s trigger check, or before
 * calling `startCompletion(view)`).
 */
export function shouldTriggerWikilinkCompletion(view: EditorView): boolean {
  return !isComposing(view);
}

/**
 * Wraps a keymap's `run` handler so it never fires while an IME
 * composition is in progress — the keystroke falls through to the
 * browser/IME instead of being captured by your completion popup logic.
 * Use this for Enter/Escape bindings tied to wikilink completion.
 */
export function guardKeyBindingFromIme(binding: KeyBinding): KeyBinding {
  const originalRun = binding.run;
  if (!originalRun) return binding;

  return {
    ...binding,
    run: (view: EditorView) => {
      if (isComposing(view)) {
        // Returning false lets CodeMirror (and ultimately the IME) handle
        // the key instead of treating it as consumed.
        return false;
      }
      return originalRun(view);
    },
  };
}

/**
 * Convenience: attach DOM-level composition tracking as a fallback data
 * attribute, for CodeMirror builds where `view.composing` isn't exposed.
 * Call once during editor setup, passing the constructed EditorView.
 */
export function attachImeCompositionTracking(view: EditorView): () => void {
  const onStart = () => view.dom.setAttribute("data-ime-composing", "true");
  const onEnd = () => view.dom.setAttribute("data-ime-composing", "false");

  view.dom.addEventListener("compositionstart", onStart);
  view.dom.addEventListener("compositionend", onEnd);

  return () => {
    view.dom.removeEventListener("compositionstart", onStart);
    view.dom.removeEventListener("compositionend", onEnd);
  };
}
