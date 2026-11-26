/**
 * React hook for PDFViewerTab & PDFToolbar.
 * Automatically indexes the open PDF on mount and streams lightweight status
 * updates (`extracting` -> `embedding` -> `ready`) without polling.
 */

import { useEffect, useState } from 'react'
import {
  enqueuePdfIndexing,
  getCachedPdfIndexingState,
  subscribePdfIndexStatus
} from '../pdfEmbeddingQueue'
import { normalizePdfRelativePath, pdfIndexClient } from '../pdfIndexClient'
import type { PdfIndexingState } from '../types'

export function usePdfIndexStatus(relativePath?: string | null): PdfIndexingState | null {
  const cleanPath = normalizePdfRelativePath(relativePath)
  const [status, setStatus] = useState<PdfIndexingState | null>(() =>
    cleanPath ? getCachedPdfIndexingState(cleanPath) : null
  )

  useEffect(() => {
    if (!cleanPath || !pdfIndexClient.isAvailable()) {
      setStatus(null)
      return
    }

    const cached = getCachedPdfIndexingState(cleanPath)
    if (cached) {
      setStatus(cached)
    }

    const unsubscribe = subscribePdfIndexStatus((next) => {
      if (next.relativePath === cleanPath) {
        setStatus(next)
      }
    })

    // Automatically index & lazily embed this PDF in the background
    void enqueuePdfIndexing(cleanPath, { embedInBackground: true })

    return () => {
      unsubscribe()
    }
  }, [cleanPath])

  return status
}
