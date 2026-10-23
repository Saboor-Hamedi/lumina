import fs from 'fs'
import path from 'path'

const WINDOWS_RESERVED_DEVICE_REGEX = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i

/**
 * Validates and decodes a URI component path.
 * Decodes multi-pass percent encoding (up to 5 passes), rejects residual percent characters,
 * null bytes, and normalizes Unicode to NFC.
 */
export function decodeAndValidatePath(rawPath: string): string {
  if (!rawPath) return ''
  let current = rawPath
  let passes = 0

  // Safely decode valid percent-encoded hex sequences (%20, %2e, etc.) up to 3 passes
  while (/%[0-9a-fA-F]{2}/.test(current) && passes < 3) {
    try {
      const decoded = decodeURIComponent(current)
      if (decoded === current) break
      current = decoded
      passes++
    } catch {
      break
    }
  }

  if (current.includes('\0')) {
    throw new Error('Security Violation: Null byte detected in path')
  }

  return current.normalize('NFC')
}

/**
 * Checks if a filename or path segment matches a Windows reserved DOS device name
 * (CON, PRN, AUX, NUL, COM1-9, LPT1-9), including trailing dot/space bypass attempts.
 */
export function isWindowsReservedDeviceName(name: string): boolean {
  if (!name) return false
  const stripped = name.replace(/[\s.]+$/, '')
  return WINDOWS_RESERVED_DEVICE_REGEX.test(stripped)
}

/**
 * Asserts that a relative path resolves strictly inside the workspace directory.
 * Throws a security Error if path traversal is detected, if symlink escapes are detected,
 * if Windows Alternate Data Streams or reserved device names are targeted, or if
 * target equals the workspace root itself (when allowRoot is false).
 */
export function assertSafeWorkspacePath(
  workspacePath: string,
  relativePath: string,
  allowRoot: boolean = false
): string {
  if (!workspacePath) throw new Error('No workspace open')

  const cleanRel = decodeAndValidatePath(relativePath || '')

  // Reject Alternate Data Streams (colon in relative path)
  const withoutDrive = cleanRel
    .replace(/^[a-zA-Z]:[/\\]?/, '')
    .replace(/^\\\\\?\\[a-zA-Z]:[/\\]?/, '')
  if (withoutDrive.includes(':')) {
    throw new Error(`Security Violation: Alternate Data Stream detected: ${relativePath}`)
  }

  // Check each segment for Windows reserved device names
  const normalizedRel = cleanRel.replace(/\\/g, '/')
  const segments = normalizedRel.split('/')
  for (const seg of segments) {
    if (seg && isWindowsReservedDeviceName(seg)) {
      throw new Error(`Security Violation: Windows reserved device name detected: ${seg}`)
    }
  }

  const root = path.resolve(workspacePath)
  const resolved = path.resolve(root, cleanRel)

  // 1. Lexical boundary verification via path.relative
  const rel = path.relative(root, resolved)
  const escapesLexically = rel.startsWith('..') || path.isAbsolute(rel)
  const isRoot = rel === ''

  if (escapesLexically || (!allowRoot && isRoot)) {
    throw new Error(`Security Violation: Path escapes workspace boundaries: ${relativePath}`)
  }

  // 2. Canonical symlink containment verification
  try {
    const realRoot = fs.existsSync(root) ? fs.realpathSync.native(root) : root

    if (fs.existsSync(resolved)) {
      const realResolved = fs.realpathSync.native(resolved)
      const realRel = path.relative(realRoot, realResolved)
      const escapesCanonical = realRel.startsWith('..') || path.isAbsolute(realRel)
      const isRealRoot = realRel === ''
      if (escapesCanonical || (!allowRoot && isRealRoot)) {
        throw new Error(`Security Violation: Symlink escapes workspace boundaries: ${relativePath}`)
      }
    } else {
      // For uncreated paths, verify the nearest existing parent directory
      let ancestor = resolved
      while (!fs.existsSync(ancestor) && ancestor !== path.dirname(ancestor)) {
        ancestor = path.dirname(ancestor)
      }
      if (fs.existsSync(ancestor)) {
        const realAncestor = fs.realpathSync.native(ancestor)
        const realRel = path.relative(realRoot, realAncestor)
        if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
          throw new Error(`Security Violation: Ancestor symlink escapes workspace: ${relativePath}`)
        }
      }
    }
  } catch (err: any) {
    if (err.message && err.message.startsWith('Security Violation:')) {
      throw err
    }
    // Non-security filesystem errors during realpath are non-fatal to lexical check
  }

  return resolved
}

/**
 * Like `assertSafeWorkspacePath` but returns `null` instead of throwing when the
 * resolved path escapes the workspace boundaries.
 */
export function safeResolveWorkspacePath(
  workspacePath: string,
  relativePath: string,
  allowRoot: boolean = false
): string | null {
  try {
    return assertSafeWorkspacePath(workspacePath, relativePath, allowRoot)
  } catch {
    return null
  }
}

/**
 * Checks whether a relative path points to a protected or hidden system directory.
 * Prevents accidental modification or deletion of `.lumina`, `.git`, or dotfiles.
 */
export function isProtectedPath(relPath: string): boolean {
  if (!relPath) return false
  const norm = relPath.replace(/\\/g, '/').replace(/^\/+/, '')
  const segments = norm.split('/')
  return segments.some((segment) => segment.startsWith('.'))
}
