export function createCaptionElement(altText) {
  if (!altText || altText.trim() === '') return null
  
  const cap = document.createElement('div')
  cap.className = 'image-widget-caption'
  cap.innerText = altText.trim()
  return cap
}
