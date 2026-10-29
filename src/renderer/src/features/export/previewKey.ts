/** Compact deterministic key for preview cache entries. */
export function makePreviewKey(parts: Array<string | number | boolean | undefined>): string {
  let hash = 2166136261
  const input = parts.map((part) => String(part ?? '')).join('\u0000')
  for (let i = 0; i < input.length; i++) {
    hash = Math.imul(hash ^ input.charCodeAt(i), 16777619)
  }
  return (hash >>> 0).toString(36)
}
