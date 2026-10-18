import { app, safeStorage } from 'electron'

export const GLOBAL_API_KEYS = [
  'deepSeekKey',
  'openaiKey',
  'anthropicKey',
  'huggingFaceKey',
  'groqKey',
  'groqApiKey',
  'googleUser'
] as const

export type GlobalApiKey = (typeof GLOBAL_API_KEYS)[number]

export function isSafeStorageReady(): boolean {
  try {
    return app.isReady() && safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function encryptKey(value: unknown): unknown {
  if (value === null || value === undefined) return value
  try {
    if (isSafeStorageReady()) {
      if (typeof value === 'string') {
        const encrypted = safeStorage.encryptString(value)
        return `enc:${encrypted.toString('base64')}`
      }
      // Objects (e.g. the Google user profile) are JSON-encoded then encrypted,
      // otherwise they would be written to settings.json as plaintext.
      if (typeof value === 'object') {
        const json = JSON.stringify(value)
        if (json !== undefined) {
          const encrypted = safeStorage.encryptString(json)
          return `enc:json:${encrypted.toString('base64')}`
        }
      }
    }
  } catch (err) {
    console.warn('[SettingsManager] safeStorage encryption failed:', err)
  }
  return value
}

const JSON_ENC_PREFIX = 'enc:json:'

export function decryptKey(value: unknown): unknown {
  if (typeof value !== 'string' || !value.startsWith('enc:')) return value
  try {
    if (isSafeStorageReady()) {
      if (value.startsWith(JSON_ENC_PREFIX)) {
        const buffer = Buffer.from(value.slice(JSON_ENC_PREFIX.length), 'base64')
        return JSON.parse(safeStorage.decryptString(buffer))
      }
      const buffer = Buffer.from(value.slice(4), 'base64')
      return safeStorage.decryptString(buffer)
    }
  } catch (err) {
    console.warn('[SettingsManager] safeStorage decryption failed:', err)
  }
  return value
}