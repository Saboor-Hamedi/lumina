/**
 * mermaidFit.ts
 *
 * Pure sizing math for Mermaid diagrams.
 *
 * Mermaid (with its default `useMaxWidth: true`) emits an SVG whose inline
 * `max-width` is locked to the diagram's natural pixel size, so the diagram can
 * shrink but can never grow into a larger container. These helpers let the
 * renderer measure the *natural* size (from the viewBox) and compute a
 * proportional "contain-fit" size that fills the available box while preserving
 * the aspect ratio.
 */

export const MERMAID_DEFAULT_MAX_ZOOM = 2
export const MERMAID_DEFAULT_MIN_ZOOM = 0.1

export interface MermaidFit {
  width: number
  height: number
  scale: number
}

/**
 * Computes a proportional size that fits `naturalWidth`x`naturalHeight` inside
 * `availWidth`x`availHeight` without distorting the aspect ratio.
 *
 * - `min(w/natW, h/natH)` guarantees the result never overflows either axis.
 * - `maxZoom` caps upscaling so tiny flowcharts do not balloon.
 * - `minZoom` is a safety floor for absurdly small containers.
 *
 * Returns `null` when the inputs are unusable (so callers can skip sizing).
 */
export function computeMermaidFit(
  naturalWidth: number,
  naturalHeight: number,
  availWidth: number,
  availHeight: number,
  maxZoom: number = MERMAID_DEFAULT_MAX_ZOOM,
  minZoom: number = MERMAID_DEFAULT_MIN_ZOOM
): MermaidFit | null {
  if (!Number.isFinite(naturalWidth) || naturalWidth <= 0) return null
  if (!Number.isFinite(naturalHeight) || naturalHeight <= 0) return null
  if (!Number.isFinite(availWidth) || availWidth <= 0) return null

  let scale = availWidth / naturalWidth
  if (Number.isFinite(availHeight) && availHeight > 0) {
    scale = Math.min(scale, availHeight / naturalHeight)
  }

  scale = Math.min(scale, maxZoom)
  scale = Math.max(scale, minZoom)

  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
    scale
  }
}

/**
 * Reads a rendered Mermaid SVG's natural (intrinsic) size.
 *
 * Prefers the `viewBox` because it is stable, then falls back to the width /
 * height attributes, then to `getBBox()`. Returns `null` if the size cannot be
 * determined.
 */
export function getMermaidNaturalSize(
  svg: SVGSVGElement | null
): { width: number; height: number } | null {
  if (!svg) return null

  try {
    const vb = svg.viewBox ? svg.viewBox.baseVal : null
    if (vb && vb.width > 0 && vb.height > 0) {
      return { width: vb.width, height: vb.height }
    }
  } catch {
    // jsdom / exotic environments may not implement viewBox.baseVal
  }

  const attrW = parseFloat(svg.getAttribute('width') || '')
  const attrH = parseFloat(svg.getAttribute('height') || '')
  if (Number.isFinite(attrW) && attrW > 0 && Number.isFinite(attrH) && attrH > 0) {
    return { width: attrW, height: attrH }
  }

  try {
    if (typeof svg.getBBox === 'function') {
      const box = svg.getBBox()
      if (box.width > 0 && box.height > 0) {
        return { width: box.width, height: box.height }
      }
    }
  } catch {
    // getBBox throws when the element is detached / not rendered
  }

  return null
}

export default computeMermaidFit
