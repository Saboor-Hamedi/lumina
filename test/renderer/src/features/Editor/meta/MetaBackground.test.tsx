import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MetaBackground from '@renderer/features/Editor/meta/MetaBackground'
import { useSettingStore } from '@renderer/core/store/SettingStore'

const ORIGINAL_DATA_URL = 'data:image/png;base64,ORIGINAL'
const RESIZED_DATA_URL = 'data:image/jpeg;base64,RESIZED'

describe('MetaBackground cover image GPU safeguards', () => {
  let updateSettingSpy: ReturnType<typeof vi.fn>
  let imageWidth = 2400
  let imageHeight = 1200
  let getContextSpy: ReturnType<typeof vi.spyOn>
  let toDataURLSpy: ReturnType<typeof vi.spyOn>
  let createdCanvas: HTMLCanvasElement | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    imageWidth = 2400
    imageHeight = 1200
    createdCanvas = null

    useSettingStore.setState({
      settings: {
        noteAppearance: {
          'note-1': { cover: { type: 'gradient', value: 'linear-gradient(120deg, #000, #fff)' } },
          'note-2': { cover: { type: 'gradient', value: 'linear-gradient(120deg, #000, #fff)' } }
        }
      }
    } as any)
    updateSettingSpy = vi
      .spyOn(useSettingStore.getState(), 'updateSetting')
      .mockResolvedValue(undefined)

    class MockFileReader {
      result: string | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL() {
        this.result = ORIGINAL_DATA_URL
        this.onload?.()
      }
    }
    vi.stubGlobal('FileReader', MockFileReader)

    class MockImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = imageWidth
      naturalHeight = imageHeight
      private currentSrc = ''
      set src(value: string) {
        this.currentSrc = value
        queueMicrotask(() => this.onload?.())
      }
      get src() {
        return this.currentSrc
      }
    }
    vi.stubGlobal('Image', MockImage)

    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(function (this: HTMLCanvasElement) {
        createdCanvas = this
        return { drawImage: vi.fn() } as any
      })
    toDataURLSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue(RESIZED_DATA_URL)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const openUploadTab = (container: HTMLElement) => {
    fireEvent.click(screen.getByText('Change cover'))
    fireEvent.click(screen.getByText('Upload'))
    return container.querySelector('input[type="file"]') as HTMLInputElement
  }

  it('renders an existing cover image with async decoding and bounded positioning', () => {
    useSettingStore.setState({
      settings: {
        noteAppearance: {
          'note-1': { cover: { type: 'image', value: ORIGINAL_DATA_URL, positionY: 32 } }
        }
      }
    } as any)

    const { container } = render(<MetaBackground noteId="note-1" />)
    const img = container.querySelector('img.note-cover-img') as HTMLImageElement

    expect(img).toBeTruthy()
    expect(img).toHaveAttribute('decoding', 'async')
    expect(img).toHaveAttribute('draggable', 'false')
    expect(img.style.objectPosition).toBe('center 32%')
    expect(img.parentElement?.className).toContain('note-cover-banner')
  })

  it('downscales an uploaded cover to a 1200px in-memory JPEG before persisting it', async () => {
    const { container } = render(<MetaBackground noteId="note-1" />)
    const input = openUploadTab(container)

    fireEvent.change(input, {
      target: { files: [new File(['png'], 'huge.png', { type: 'image/png' })] }
    })

    await waitFor(() => {
      expect(updateSettingSpy).toHaveBeenCalledWith(
        'noteAppearance',
        expect.objectContaining({
          'note-1': { cover: { type: 'image', value: RESIZED_DATA_URL, positionY: 50 } }
        })
      )
    })
    expect(createdCanvas?.width).toBe(1200)
    expect(createdCanvas?.height).toBe(600)
    expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.88)
  })

  it('keeps the original upload when it is already within the 1200px budget', async () => {
    imageWidth = 800
    imageHeight = 600
    const { container } = render(<MetaBackground noteId="note-2" />)
    const input = openUploadTab(container)

    fireEvent.change(input, {
      target: { files: [new File(['png'], 'small.png', { type: 'image/png' })] }
    })

    await waitFor(() => {
      expect(updateSettingSpy).toHaveBeenCalledWith(
        'noteAppearance',
        expect.objectContaining({
          'note-2': { cover: { type: 'image', value: ORIGINAL_DATA_URL, positionY: 50 } }
        })
      )
    })
    expect(getContextSpy).not.toHaveBeenCalled()
    expect(toDataURLSpy).not.toHaveBeenCalled()
  })
})
