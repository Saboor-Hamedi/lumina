import type { EditorView } from '@codemirror/view'
import type { TableCellPosition, TableModel, TableWidgetRange } from './tableModel'

// Cell code talks to the table extension through this small runtime bridge,
// avoiding a direct tableCell ↔ tableExtension module dependency.
interface TableOperations {
  findCurrentTableRange(view: EditorView, dom: Element): TableWidgetRange | null
  placeCaretAtEnd(element: HTMLElement): void
  dispatchModel(
    view: EditorView,
    wrap: HTMLElement,
    model: TableModel,
    focus?: TableCellPosition | null
  ): void
  dispatchModelFromDom(view: EditorView, cell: HTMLElement, options?: { immediate?: boolean }): void
  flushPendingTableDispatch(): void
  moveCellFocus(
    view: EditorView,
    cell: HTMLElement,
    direction: number,
    options?: { appendOnOverflow?: boolean }
  ): void
  openTableLink(view: EditorView, url: string): void
}

const operations: Partial<TableOperations> = {}

export function configureTableShared(nextOperations: TableOperations): void {
  Object.assign(operations, nextOperations)
}

function invoke<K extends keyof TableOperations>(
  name: K,
  ...args: Parameters<TableOperations[K]>
): ReturnType<TableOperations[K]> {
  const operation = operations[name]
  if (typeof operation !== 'function') {
    throw new Error(`Table operation "${name}" is not initialized`)
  }
  return (
    operation as (...values: Parameters<TableOperations[K]>) => ReturnType<TableOperations[K]>
  )(...args)
}

export const findCurrentTableRange = (view: EditorView, dom: Element) =>
  invoke('findCurrentTableRange', view, dom)
export const placeCaretAtEnd = (element: HTMLElement) => invoke('placeCaretAtEnd', element)
export const dispatchModel = (
  view: EditorView,
  wrap: HTMLElement,
  model: TableModel,
  focus?: TableCellPosition | null
) => invoke('dispatchModel', view, wrap, model, focus)
export const dispatchModelFromDom = (
  view: EditorView,
  cell: HTMLElement,
  options?: { immediate?: boolean }
) => invoke('dispatchModelFromDom', view, cell, options)
export const flushPendingTableDispatch = () => invoke('flushPendingTableDispatch')
export const moveCellFocus = (
  view: EditorView,
  cell: HTMLElement,
  direction: number,
  options?: { appendOnOverflow?: boolean }
) => invoke('moveCellFocus', view, cell, direction, options)
export const openTableLink = (view: EditorView, url: string) => invoke('openTableLink', view, url)
