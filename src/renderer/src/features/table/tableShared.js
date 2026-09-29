// Cell code talks to the table extension through this small runtime bridge,
// avoiding a direct tableCell ↔ tableExtension module dependency.
const operations = Object.create(null)

export function configureTableShared(nextOperations) {
  Object.assign(operations, nextOperations)
}

function invoke(name, args) {
  const operation = operations[name]
  if (typeof operation !== 'function') {
    throw new Error(`Table operation "${name}" is not initialized`)
  }
  return operation(...args)
}

export const findCurrentTableRange = (...args) => invoke('findCurrentTableRange', args)
export const placeCaretAtEnd = (...args) => invoke('placeCaretAtEnd', args)
export const dispatchModel = (...args) => invoke('dispatchModel', args)
export const dispatchModelFromDom = (...args) => invoke('dispatchModelFromDom', args)
export const flushPendingTableDispatch = (...args) => invoke('flushPendingTableDispatch', args)
export const moveCellFocus = (...args) => invoke('moveCellFocus', args)
