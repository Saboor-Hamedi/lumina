/**
 * =========================================================================================
 * Image Caption Helper (`imageCaption.ts`)
 * =========================================================================================
 *
 * Renders an optional, clean image caption element below the preview card
 * when alt text is provided.
 */

export function createCaptionElement(altText: string | null | undefined): HTMLElement | null {
  if (!altText || altText.trim() === '') return null

  const cap = document.createElement('div')
  cap.className = 'image-widget-caption'
  cap.innerText = altText.trim()
  return cap
}

export default createCaptionElement
