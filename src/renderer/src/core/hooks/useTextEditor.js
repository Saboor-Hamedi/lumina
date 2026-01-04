// src/hooks/useTextEditor.js
import { useState, useRef, useEffect } from 'react'

export const useTextEditor = (initialValue = '') => {
  const [code, setCode] = useState(initialValue)
  const [cursor, setCursor] = useState(null)
  const textareaRef = useRef(null)

  // 1. Sync local state if initialValue changes (e.g., loading a saved snippet)
  useEffect(() => {
    setCode(initialValue)
  }, [initialValue])

  // 2. Cursor Positioning Effect
  // This runs immediately after 'code' updates to put the cursor in the right place
  useEffect(() => {
    if (cursor !== null && textareaRef.current) {
      textareaRef.current.selectionStart = cursor
      textareaRef.current.selectionEnd = cursor
      setCursor(null) // Reset to avoid sticking
    }
  }, [code, cursor])

  // 3. The Logic Function
  const handleKeyDown = (e) => {
    const { selectionStart, selectionEnd, value } = e.target

    // --- TAB KEY (Insert 2 spaces) ---
    if (e.key === 'Tab') {
      e.preventDefault()
      const indent = '  ' // 2 spaces

      const newValue = value.substring(0, selectionStart) + indent + value.substring(selectionEnd)

      setCode(newValue)
      setCursor(selectionStart + indent.length)
    }

    // --- SMART BACKSPACE (Delete 2 spaces) ---
    else if (e.key === 'Backspace') {
      if (selectionStart === selectionEnd && selectionStart >= 2) {
        const twoCharsBefore = value.substring(selectionStart - 2, selectionStart)
        if (twoCharsBefore === '  ') {
          e.preventDefault()
          const newValue = value.substring(0, selectionStart - 2) + value.substring(selectionStart)

          setCode(newValue)
          setCursor(selectionStart - 2)
        }
      }
    }

    // --- ENTER KEY (Auto Indentation) ---
    else if (e.key === 'Enter') {
      e.preventDefault()

      // Get the current line up to the cursor
      const linesBefore = value.substring(0, selectionStart).split('\n')
      const currentLine = linesBefore[linesBefore.length - 1]

      // Calculate indentation of current line (spaces at the start)
      const indentationMatch = currentLine.match(/^\s*/)
      const indentation = indentationMatch ? indentationMatch[0] : ''

      const newValue =
        value.substring(0, selectionStart) + '\n' + indentation + value.substring(selectionEnd)

      setCode(newValue)
      setCursor(selectionStart + 1 + indentation.length)
    }
  }

  // 4. Helper to manually insert text (e.g. if you add a "Paste" button later)
  const insertText = (textToInsert) => {
    if (!textareaRef.current) return
    const { selectionStart, selectionEnd, value } = textareaRef.current

    const newValue =
      value.substring(0, selectionStart) + textToInsert + value.substring(selectionEnd)

    setCode(newValue)
    setCursor(selectionStart + textToInsert.length)
  }

  return {
    code,
    setCode,
    textareaRef,
    handleKeyDown,
    insertText
  }
}
