export async function copyImageToClipboard(imgUrl, onSuccess, onError) {
  try {
    let blob

    if (imgUrl.startsWith('blob:') || imgUrl.startsWith('data:') || imgUrl.startsWith('http')) {
      const response = await fetch(imgUrl)
      blob = await response.blob()
    } else {
      const cleanUrl = imgUrl.startsWith('/') ? imgUrl.slice(1) : imgUrl
      const res = await window.api.readAsset(cleanUrl)
      if (res?.dataUrl) {
        const response = await fetch(res.dataUrl)
        blob = await response.blob()
      } else {
        const buf = res?.buffer || res
        const ext = cleanUrl.split('.').pop().toLowerCase()
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

    // The clipboard API requires image/png on most operating systems.
    // Convert to PNG if it's not already.
    if (blob.type !== 'image/png') {
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bitmap, 0, 0)
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    }

    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])

    if (onSuccess) onSuccess()
  } catch (err) {
    console.error('Failed to copy image to clipboard:', err)
    if (onError) onError(err)
  }
}
