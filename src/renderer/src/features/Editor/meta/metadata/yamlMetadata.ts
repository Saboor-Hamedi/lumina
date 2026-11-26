import { KNOWN_METADATA_KEYS, stripMarkdownFrontmatter } from '../../../../../../shared/frontmatter'
import type { Snippet } from '../../../../core/editor/types'
import {
  SELECT_PRESET_OPTIONS,
  type MetadataPropertiesMap,
  type MetadataProperty,
  type MetadataPropertyType
} from './types'

export function sanitizePropertyKey(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '')
  return cleaned
}

export function isReservedMetadataKey(key: string): boolean {
  return KNOWN_METADATA_KEYS.has(key.trim().toLowerCase())
}

export function formatPropertyLabel(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export function inferPropertyType(key: string, value: string): MetadataPropertyType {
  const lowerKey = key.trim().toLowerCase()
  const trimmedVal = String(value ?? '').trim()

  if (lowerKey in SELECT_PRESET_OPTIONS) return 'select'
  if (lowerKey === 'done' || lowerKey === 'completed' || lowerKey === 'published') return 'checkbox'
  if (trimmedVal === 'true' || trimmedVal === 'false') return 'checkbox'
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedVal) || lowerKey.includes('date') || lowerKey === 'due') {
    return 'date'
  }
  if (/^https?:\/\//i.test(trimmedVal) || lowerKey === 'url' || lowerKey === 'link' || lowerKey === 'source') {
    return 'url'
  }
  if (trimmedVal !== '' && /^-?\d+(\.\d+)?$/.test(trimmedVal)) {
    return 'number'
  }
  return 'text'
}

export function parseCustomYamlFromCode(rawCode?: string | null): MetadataPropertiesMap {
  const out: MetadataPropertiesMap = {}
  if (!rawCode) return out

  const { yamlBlocks } = stripMarkdownFrontmatter(rawCode)
  for (const block of yamlBlocks) {
    const lines = block.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const colonIdx = trimmed.indexOf(':')
      if (colonIdx <= 0) continue
      const key = trimmed.slice(0, colonIdx).trim()
      if (!key || isReservedMetadataKey(key)) continue
      if (!/^[a-zA-Z0-9_.-]+$/.test(key)) continue
      let val = trimmed.slice(colonIdx + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      }
      out[key] = val
    }
  }
  return out
}

export function extractCustomYamlProperties(snippet?: Snippet | null): MetadataPropertiesMap {
  if (!snippet) return {}
  const fromCode = parseCustomYamlFromCode(snippet.code)
  const fromProp =
    snippet.properties && typeof snippet.properties === 'object'
      ? (snippet.properties as Record<string, unknown>)
      : {}

  const merged: MetadataPropertiesMap = { ...fromCode }
  for (const [key, val] of Object.entries(fromProp)) {
    const cleanKey = sanitizePropertyKey(key)
    if (!cleanKey || isReservedMetadataKey(cleanKey)) continue
    if (val === null || val === undefined) continue
    merged[cleanKey] = String(val)
  }
  return merged
}

export function toPropertyList(props: MetadataPropertiesMap): MetadataProperty[] {
  return Object.entries(props).map(([key, value]) => ({
    key,
    value,
    type: inferPropertyType(key, value)
  }))
}

export function serializeYamlPropertiesBlock(props: MetadataPropertiesMap): string {
  const keys = Object.keys(props)
    .filter((k) => {
      const clean = sanitizePropertyKey(k)
      return Boolean(clean) && !isReservedMetadataKey(clean)
    })
    .sort()

  if (keys.length === 0) return ''

  return keys
    .map((key) => {
      const cleanKey = sanitizePropertyKey(key)
      const rawVal = String(props[key] ?? '')
      const escaped = rawVal
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\r?\n/g, ' ')
      return `${cleanKey}: "${escaped}"`
    })
    .join('\n')
}
