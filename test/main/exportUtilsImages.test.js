import { describe, it, expect, vi, beforeEach } from 'vitest'

const readAsset = vi.fn()

vi.mock('../../src/main/workspace/workspaceManager.js', () => ({
  default: { readAsset: (...args) => readAsset(...args) }
}))

vi.mock('electron', () => ({ dialog: {}, BrowserWindow: class {} }))

import { convertImagesToBase64 } from '../../src/export/exportUtils'

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('convertImagesToBase64', () => {
  beforeEach(() => {
    readAsset.mockReset()
  })

  it('embeds a local image from the object returned by readAsset', async () => {
    // WorkspaceManager.readAsset returns a ReadAssetResult object, not a Buffer.
    readAsset.mockResolvedValue({
      buffer: Buffer.from('x'),
      base64: PNG_BASE64,
      dataUrl: `data:image/png;base64,${PNG_BASE64}`,
      mimeType: 'image/png',
      size: 1
    })

    const out = await convertImagesToBase64('![pic](images/a.png)')
    expect(out).toContain(`data:image/png;base64,${PNG_BASE64}`)
    expect(out).not.toContain('images/a.png')
  })

  it('falls back to the buffer when base64 is missing', async () => {
    readAsset.mockResolvedValue({
      buffer: Buffer.from('hello'),
      mimeType: 'image/jpeg'
    })

    const out = await convertImagesToBase64('![pic](images/a.jpg)')
    expect(out).toContain(`data:image/jpeg;base64,${Buffer.from('hello').toString('base64')}`)
  })

  it('leaves remote and data images untouched', async () => {
    const src = '![a](https://x.com/a.png) ![b](data:image/png;base64,AAAA)'
    const out = await convertImagesToBase64(src)
    expect(out).toBe(src)
    expect(readAsset).not.toHaveBeenCalled()
  })

  it('keeps the original URL when the asset cannot be resolved', async () => {
    readAsset.mockResolvedValue(null)
    const out = await convertImagesToBase64('![pic](images/missing.png)')
    expect(out).toContain('images/missing.png')
  })

  it('never throws when readAsset rejects', async () => {
    readAsset.mockRejectedValue(new Error('boom'))
    const out = await convertImagesToBase64('![pic](images/a.png)')
    expect(out).toContain('images/a.png')
  })
})
