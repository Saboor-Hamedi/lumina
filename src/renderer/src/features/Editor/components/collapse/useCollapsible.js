import { useMemo } from 'react'
import { codeFolding } from '@codemirror/language'
import { headingFoldPlugin } from './Collapsible'

export const useCollapsible = () => {
  return useMemo(() => [
    codeFolding(),
    headingFoldPlugin
  ], [])
}
