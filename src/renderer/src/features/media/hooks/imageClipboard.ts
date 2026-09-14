/**
 * =========================================================================================
 * Image Clipboard Helper (`imageClipboard.ts`)
 * =========================================================================================
 *
 * Copies local assets, base64 data URLs, or remote images to the system clipboard as PNGs.
 */

export async function copyImageToClipboard(
  imgUrl: string,
  onSuccess?: () => void,
  onError?: (err: any) => void
): Promise<void> {
  try {
    let dataUrl = imgUrl

    if (
      !imgUrl.startsWith('data:') &&
      !imgUrl.startsWith('blob:') &&
      !imgUrl.startsWith('http') &&
      !imgUrl.startsWith('asset:')
    ) {
      const cleanUrl = imgUrl.startsWith('/') ? imgUrl.slice(1) : imgUrl
      const res = await (window as any).api?.readAsset?.(cleanUrl)
      if (res?.dataUrl) {
        dataUrl = res.dataUrl
      }
    }

    if (dataUrl?.startsWith('data:') && (window as any).api?.writeImageToClipboard) {
      await (window as any).api.writeImageToClipboard(dataUrl)
      if (onSuccess) onSuccess()
      return
    }

    let blob: Blob
    if (
      dataUrl.startsWith('blob:') ||
      dataUrl.startsWith('data:') ||
      dataUrl.startsWith('http') ||
      dataUrl.startsWith('asset:')
    ) {
      const response = await fetch(dataUrl)
      blob = await response.blob()
    } else {
      const cleanUrl = dataUrl.startsWith('/') ? dataUrl.slice(1) : dataUrl
      const res = await (window as any).api?.readAsset?.(cleanUrl)
      if (res?.dataUrl) {
        const response = await fetch(res.dataUrl)
        blob = await response.blob()
      } else {
        const buf = res?.buffer || res
        const ext = cleanUrl.split('.').pop()?.toLowerCase()
        const mime =
          res?.mimeType ||
          (ext === 'png'
            ? 'image/png'
            : ext === 'jpg' || ext === 'jpeg'
              ? 'image/jpeg'
              : ext === 'webp'
                ? 'image/webp'
                : 'image/png')
        blob = new Blob([buf], { type: mime })
      }
    }

    if (blob.type !== 'image/png') {
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0)
        blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))), 'image/png')
        })
      }
    }

    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])

    if (onSuccess) onSuccess()
  } catch (err) {
    console.error('Failed to copy image to clipboard:', err)
    if (onError) onError(err)
  }
}

export default copyImageToClipboard
