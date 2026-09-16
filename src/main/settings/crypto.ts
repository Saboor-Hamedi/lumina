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
  if (!value || typeof value !== 'string') return value
  try {
    if (isSafeStorageReady()) {
      const encrypted = safeStorage.encryptString(value)
      return `enc:${encrypted.toString('base64')}`
    }
  } catch (err) {
    console.warn('[SettingsManager] safeStorage encryption failed:', err)
  }
  return value
}

export function decryptKey(value: unknown): unknown {
  if (!value || typeof value !== 'string') return value
  if (value.startsWith('enc:')) {
    try {
      if (isSafeStorageReady()) {
        const buffer = Buffer.from(value.slice(4), 'base64')
        return safeStorage.decryptString(buffer)
      }
    } catch (err) {
      console.warn('[SettingsManager] safeStorage decryption failed:', err)
    }
  }
  return value
}