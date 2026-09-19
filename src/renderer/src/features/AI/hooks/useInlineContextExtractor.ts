import { useState, useEffect, useCallback } from 'react'

export interface InlineContextRange {
  text: string
  fullText: string
  from: number
  to: number
  isSelection: boolean
}

export interface UseInlineContextExtractorProps {
  editorView: any
  isOpen: boolean
  cursorPosition?: number | null
}

export interface UseInlineContextExtractorReturn {
  contextRange: InlineContextRange | null
  setContextRange: React.Dispatch<React.SetStateAction<InlineContextRange | null>>
  getSelectedText: () => InlineContextRange | null
}

/**
 * Custom hook to extract active editor selection or nearest contextual block around the caret.
 * Analyzes surrounding code fences or paragraph boundaries if no text is explicitly highlighted.
 */
export const useInlineContextExtractor = ({
  editorView,
  isOpen,
  cursorPosition
}: UseInlineContextExtractorProps): UseInlineContextExtractorReturn => {
  const [contextRange, setContextRange] = useState<InlineContextRange | null>(null)

  const getSelectedText = useCallback((): InlineContextRange | null => {
    if (!editorView) return null

    const doc = editorView.state.doc
    const selection = editorView.state.selection.main
    const selectedText = doc.sliceString(selection.from, selection.to)
    const fullDocumentText = doc.toString()

    if (selectedText.trim()) {
      return {
        text: selectedText.trim(),
        fullText: fullDocumentText,
        from: selection.from,
        to: selection.to,
        isSelection: true
      }
    }

    // Smart context extraction around cursor position
    try {
      const linePos = doc.lineAt(selection.from)
      let startLineNumber = linePos.number
      let endLineNumber = linePos.number

      let codeStartNum = -1
      let codeEndNum = -1

      // Search for code fences
      for (let i = startLineNumber; i >= 1; i--) {
        const l = doc.line(i)
        if (l.text.trim().startsWith('```')) {
          codeStartNum = i
          break
        }
      }
      if (codeStartNum !== -1) {
        for (let i = startLineNumber; i <= doc.lines; i++) {
          const l = doc.line(i)
          if (i !== codeStartNum && l.text.trim().startsWith('```')) {
            codeEndNum = i
            break
          }
        }
      }

      if (
        codeStartNum !== -1 &&
        codeEndNum !== -1 &&
        codeStartNum <= startLineNumber &&
        codeEndNum >= startLineNumber
      ) {
        startLineNumber = codeStartNum
        endLineNumber = codeEndNum
      } else {
        // Expand to paragraph boundary
        while (startLineNumber > 1 && doc.line(startLineNumber - 1).text.trim() !== '') {
          startLineNumber--
        }
        while (endLineNumber < doc.lines && doc.line(endLineNumber + 1).text.trim() !== '') {
          endLineNumber++
        }
      }

      const startLine = doc.line(startLineNumber)
      const endLine = doc.line(endLineNumber)
      const blockText = doc.sliceString(startLine.from, endLine.to)

      return {
        text: blockText.trim(),
        fullText: fullDocumentText,
        from: startLine.from,
        to: endLine.to,
        isSelection: false
      }
    } catch (err) {
      console.warn('[InlineLumina] Smart context extraction failed:', err)
    }

    return {
      text: '',
      fullText: fullDocumentText,
      from: selection.from,
      to: selection.to,
      isSelection: false
    }
  }, [editorView])

  useEffect(() => {
    if (isOpen) {
      setContextRange(getSelectedText())
    } else {
      setContextRange(null)
    }
  }, [isOpen, getSelectedText, cursorPosition])

  return { contextRange, setContextRange, getSelectedText }
}
