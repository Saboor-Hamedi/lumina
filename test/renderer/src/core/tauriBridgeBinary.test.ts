import { describe, it, expect } from 'vitest'
import { normalizeBinaryAsset } from '../../../../src/renderer/src/core/tauriBridge'

describe('normalizeBinaryAsset', () => {
  it('converts raw ArrayBuffer from Tauri v2 Response IPC into Uint8Array', () => {
    const buffer = new Uint8Array([137, 80, 78, 71]).buffer
    const result = normalizeBinaryAsset(buffer)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(Array.from(result)).toEqual([137, 80, 78, 71])
  })

  it('preserves Uint8Array input directly', () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const result = normalizeBinaryAsset(bytes)
    expect(result).toBe(bytes)
  })

  it('respects byteOffset and byteLength for ArrayBufferView slices', () => {
    const backing = new Uint8Array([9, 10, 20, 30, 99]).buffer
    const view = new DataView(backing, 1, 3)
    const result = normalizeBinaryAsset(view)
    expect(Array.from(result)).toEqual([10, 20, 30])
  })

  it('supports legacy number[] payloads and returns empty Uint8Array for invalid inputs', () => {
    expect(Array.from(normalizeBinaryAsset([65, 66, 67]))).toEqual([65, 66, 67])
    expect(normalizeBinaryAsset(null)).toHaveLength(0)
    expect(normalizeBinaryAsset(undefined)).toHaveLength(0)
    expect(normalizeBinaryAsset('invalid')).toHaveLength(0)
  })
})
