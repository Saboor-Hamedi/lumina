import path from 'path'

/**
 * Main-process allowlist for filesystem paths produced by the app itself
 * (e.g. export outputs). `shell:openPath` / `shell:showItemInFolder` only
 * accept paths registered here, so a compromised renderer cannot ask the
 * main process to open arbitrary executables/files.
 */
const allowedPaths = new Set<string>()

function normalize(value: string): string {
  let resolved = value
  try {
    resolved = path.resolve(value)
  } catch {
    resolved = value
  }
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

/** Register a single path (file or directory) as app-produced. */
export function allowPath(value?: string | null): void {
  if (typeof value !== 'string' || !value) return
  allowedPaths.add(normalize(value))
}

/** Known keys in export results that carry filesystem paths. */
const PATH_KEYS = new Set(['filePath', 'bundleDir', 'outputDir', 'assetsDir'])

/**
 * A key is treated as a path when it is known or ends with a path-like
 * suffix (`...Path`, `...Dir`, `...Directory`). This keeps new exporters
 * working without having to remember to extend PATH_KEYS.
 */
function isPathKey(key: string): boolean {
  return PATH_KEYS.has(key) || /(path|dir|directory)$/i.test(key)
}

/** Recursively register every path found in an export handler's result. */
export function allowPathsFromResult(result: unknown): void {
  const seen = new Set<unknown>()
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return
    if (seen.has(value)) return
    seen.add(value)
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (typeof val === 'string' && isPathKey(key)) {
        allowPath(val)
      } else if (val && typeof val === 'object') {
        visit(val)
      }
    }
  }
  visit(result)
}

/** True when the path is an exact allowed path or lives inside an allowed directory. */
export function isAllowedPath(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false
  const target = normalize(value)
  if (allowedPaths.has(target)) return true
  for (const allowed of allowedPaths) {
    const base = allowed.endsWith(path.sep) ? allowed : allowed + path.sep
    if (target.startsWith(base)) return true
  }
  return false
}

/** Test helper / teardown. */
export function clearAllowedPaths(): void {
  allowedPaths.clear()
}
