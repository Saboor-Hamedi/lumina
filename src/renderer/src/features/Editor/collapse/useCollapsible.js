import { useMemo } from 'react'
import { Prec } from '@codemirror/state'
import { codeFolding } from '@codemirror/language'
import { headingFoldPlugin } from './collapsible'

export const useCollapsible = () => {
  return useMemo(
    () => [
      Prec.high(
        codeFolding({
          placeholderDOM: (_view, onclick) => {
            const span = document.createElement('span')
            span.className = 'cm-foldPlaceholder'
            span.textContent = '…'
            span.title = 'Click to expand'
            span.onclick = (e) => {
              e.preventDefault()
              e.stopPropagation()
              onclick(e)
            }
            return span
          }
        })
      ),
      headingFoldPlugin
    ],
    []
  )
}
