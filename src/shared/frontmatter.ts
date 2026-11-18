/**
 * =========================================================================
 * Shared Markdown Frontmatter Utilities (`src/shared/frontmatter.ts`)
 * =========================================================================
 *
 * Single source of truth for stripping YAML (`---...---`) and loose metadata
 * headers across Main (scanner/operations) and Renderer (EditorCanvas).
 *
 * Preserves intentional leading blank lines in the note body so auto-save
 * and app restarts never cause text to jump to the top of the editor.
 * =========================================================================
 */

export const KNOWN_METADATA_KEYS: ReadonlySet<string> = new Set([
  'id',
  'title',
  'language',
  'tags',
  'selection',
  'ispinned',
  'pinned',
  'islearned',
  'learned',
  'customicon',
  'icon',
  'createdat',
  'created_at',
  'timestamp',
  'color',
  'type',
  'folderid',
  'folder_id'
])

export interface StrippedMarkdownResult {
  readonly content: string
  readonly yamlBlocks: readonly string[]
  readonly looseLines: readonly string[]
}

function isLikelyYamlBlock(block: string): boolean {
  if (!block.trim()) return false
  const lines = block.split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    // Allow indented YAML list items / multiline continuations
    if (/^\s+/.test(rawLine) && (line.startsWith('-') || /^[a-zA-Z0-9_.-]+\s*:/.test(line) || line.length > 0)) {
      continue
    }
    if (/^[a-zA-Z0-9_.-]+\s*:/.test(line)) continue
    return false
  }
  return true
}

/**
 * Strips standard `---...---` YAML frontmatter blocks and loose top-of-file
 * metadata lines while preserving all intentional leading blank lines.
 */
export function stripMarkdownFrontmatter(rawContent: string): StrippedMarkdownResult {
  if (!rawContent || typeof rawContent !== 'string') {
    return { content: '', yamlBlocks: [], looseLines: [] }
  }

  let text = rawContent.replace(/^\uFEFF/, '')
  const yamlBlocks: string[] = []
  const looseLines: string[] = []

  // 1. Strip standard `---...---` frontmatter blocks (preserving body leading newlines)
  while (/^\s*---\r?\n/.test(text)) {
    const match = text.match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
    if (!match || !isLikelyYamlBlock(match[1])) break
    yamlBlocks.push(match[1])
    text = match[2] || ''
  }

  // 2. Only check for loose metadata `key: value` lines if the file did NOT have standard YAML frontmatter
  // and the very first non-empty line starts at line 0 (to avoid wiping intentional leading blank lines or body key-values).
  if (yamlBlocks.length === 0) {
    const lines = text.split(/\r?\n/)
    if (lines.length > 0 && lines[0].trim().length > 0) {
      let lineIdx = 0
      let foundLooseMetadata = false

      while (lineIdx < lines.length) {
        const trimmed = lines[lineIdx].trim()
        if (!trimmed) break

        const colonIdx = trimmed.indexOf(':')
        if (colonIdx !== -1) {
          const key = trimmed.slice(0, colonIdx).trim().toLowerCase()
          if (KNOWN_METADATA_KEYS.has(key)) {
            foundLooseMetadata = true
            looseLines.push(trimmed)
            lineIdx++
            continue
          }
        }
        break
      }

      if (foundLooseMetadata) {
        text = lines.slice(lineIdx).join('\n')
      }
    }
  }

  return { content: text, yamlBlocks, looseLines }
}
