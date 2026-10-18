import SettingsManager from '../settings/settingsManager'

/**
 * SSRF guard for renderer-supplied Ollama URLs.
 *
 * The renderer may point Ollama calls at a user-configured server, but a
 * compromised renderer must not be able to make the main process fetch
 * arbitrary hosts (cloud metadata, internal services, etc). Only http/https
 * to loopback or the host configured in settings (`ollamaUrl`) is allowed.
 */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])
const DEFAULT_BASE_URL = 'http://127.0.0.1:11434'
const DEFAULT_PORT = '11434'

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase())
}

/**
 * Normalize a configured URL the same way the renderer does: trim, and assume
 * `http://` when the user typed a scheme-less host such as `gpu-box.local:11434`.
 */
function withScheme(value: string): string {
  return /^https?:\/\//i.test(value.trim()) ? value.trim() : `http://${value.trim()}`
}

/** Read the user-configured Ollama URL synchronously (never throws). */
function getConfiguredOllamaUrl(): string | null {
  try {
    const value = SettingsManager.getAll().ollamaUrl
    if (typeof value !== 'string' || !value.trim()) return null
    return withScheme(value)
  } catch {
    return null
  }
}

/** Hostname of the user-configured Ollama URL, or null when unusable. */
function getConfiguredOllamaHost(): string | null {
  const configured = getConfiguredOllamaUrl()
  if (!configured) return null
  try {
    const parsed = new URL(configured)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    const hostname = (parsed.hostname || '').toLowerCase()
    return hostname || null
  } catch {
    return null
  }
}

/**
 * Validate and normalize a renderer-supplied Ollama URL into a `${proto}//${host}:${port}` base.
 * When no URL is supplied, the configured `ollamaUrl` is used, then loopback.
 * Throws when the protocol is not http(s) or the host is neither loopback nor the configured host.
 */
export function resolveAllowedOllamaUrl(rawUrl?: string | null): string {
  const source = rawUrl || getConfiguredOllamaUrl() || DEFAULT_BASE_URL
  const parsed = new URL(source)

  const protocol = parsed.protocol
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`Unsupported Ollama protocol: ${protocol}`)
  }

  const hostname = parsed.hostname || '127.0.0.1'
  const port = parsed.port || DEFAULT_PORT

  const configuredHost = getConfiguredOllamaHost()
  const allowed = isLoopbackHost(hostname) || (configuredHost !== null && configuredHost === hostname.toLowerCase())
  if (!allowed) {
    throw new Error(
      `Blocked Ollama host: ${hostname}. Only localhost or the host configured in Settings is allowed.`
    )
  }

  return `${protocol}//${hostname}:${port}`
}
