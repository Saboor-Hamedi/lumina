import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => {
  return {
    app: { isReady: () => true },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (value: string) => Buffer.from(`X${value}`),
      decryptString: (buffer: Buffer) => buffer.toString().slice(1)
    }
  }
})

import { encryptKey, decryptKey } from '../../../src/main/settings/crypto'

describe('crypto key encryption', () => {
  it('encrypts and decrypts plain strings', () => {
    const encrypted = encryptKey('super-secret')
    expect(typeof encrypted).toBe('string')
    expect((encrypted as string).startsWith('enc:')).toBe(true)
    expect(decryptKey(encrypted)).toBe('super-secret')
  })

  it('encrypts objects instead of leaving them in plaintext', () => {
    const user = { name: 'Ada', email: 'ada@example.com', token: 'abc.def' }
    const encrypted = encryptKey(user)
    expect(typeof encrypted).toBe('string')
    expect((encrypted as string).startsWith('enc:json:')).toBe(true)
    expect(decryptKey(encrypted)).toEqual(user)
  })

  it('passes through values that cannot be encrypted', () => {
    expect(decryptKey(null)).toBeNull()
    expect(decryptKey(undefined)).toBeUndefined()
    expect(decryptKey(42)).toBe(42)
    expect(decryptKey('not-encrypted')).toBe('not-encrypted')
  })
})
