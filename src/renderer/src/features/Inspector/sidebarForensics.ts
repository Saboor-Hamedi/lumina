/**
 * Forensic instrumentation — disabled (no-op).
 * Remove all console noise from resize observer, rAF geometry loop, and window events.
 */
export function initForensicLogging(_shellEl: HTMLElement | null): () => void {
  return () => {}
}
