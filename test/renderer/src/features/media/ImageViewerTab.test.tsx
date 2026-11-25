import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ImageViewerTab } from '@renderer/features/media/ImageViewerTab'

describe('ImageViewerTab GPU-friendly image decoding', () => {
  beforeEach(() => {
    window.api.readAsset = undefined
  })

  it('loads workspace images from the asset stream with async decoding', async () => {
    render(<ImageViewerTab snippet={{ fileName: 'cover banner.png', folderId: 'Assets' }} />)

    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('decoding', 'async')
    expect(img).toHaveAttribute('draggable', 'false')
    expect(img.getAttribute('src')).toBe('asset://local/Assets/cover%20banner.png')
  })

  it('keeps async decoding when the image is returned through the readAsset IPC fallback', async () => {
    window.api.readAsset = vi.fn().mockResolvedValue({ dataUrl: 'data:image/png;base64,READBACK' })

    render(<ImageViewerTab snippet={{ fileName: 'inline.png', relativePath: 'Notes/inline.png' }} />)

    const img = await screen.findByRole('img')
    expect(window.api.readAsset).toHaveBeenCalledWith('Notes/inline.png')
    expect(img.getAttribute('src')).toBe('data:image/png;base64,READBACK')
    expect(img).toHaveAttribute('decoding', 'async')
  })
})
