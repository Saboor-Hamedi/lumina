import React from 'react'
import * as ReactWindow from 'react-window'

/**
 * ULTRA-SAFE React-Window Loader
 * Handles every possible Vite/Rollup/CommonJS/ESM permutation.
 */
function resolveList() {
  // 1. Direct Named Export (ESM)
  if (ReactWindow.FixedSizeList) return ReactWindow.FixedSizeList

  // 2. Default Export (CommonJS)
  if (ReactWindow.default) {
    // 2a. Default is the object containing named exports
    if (ReactWindow.default.FixedSizeList) return ReactWindow.default.FixedSizeList
    // 2b. Default itself is the List (Unlikely for this lib but possible for others)
  }

  // 3. Double-Default (Vite sometimes double-wraps CJS)
  if (
    ReactWindow.default &&
    ReactWindow.default.default &&
    ReactWindow.default.default.FixedSizeList
  ) {
    return ReactWindow.default.default.FixedSizeList
  }

  return null
}

const ResolvedList = resolveList()

export const FixedSizeList = (props) => {
  if (ResolvedList) {
    return <ResolvedList {...props} />
  }
  return (
    <div style={{ padding: 20, color: 'red', border: '1px solid red' }}>
      Critical Error: Virtual List Failed to Load
    </div>
  )
}
