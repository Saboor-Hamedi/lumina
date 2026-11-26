import React from 'react'
// @ts-expect-error react-window is a legacy/optional dependency not installed in package.json
import * as ReactWindow from 'react-window'

type ListComponent = React.ComponentType<Record<string, unknown>>

interface ReactWindowModuleShape {
  FixedSizeList?: ListComponent
  default?: {
    FixedSizeList?: ListComponent
    default?: {
      FixedSizeList?: ListComponent
    }
  }
}

/**
 * ULTRA-SAFE React-Window Loader
 * Handles every possible Vite/Rollup/CommonJS/ESM permutation.
 */
function resolveList(): ListComponent | null {
  const mod = ReactWindow as ReactWindowModuleShape

  // 1. Direct Named Export (ESM)
  if (mod.FixedSizeList) return mod.FixedSizeList

  // 2. Default Export (CommonJS)
  if (mod.default) {
    // 2a. Default is the object containing named exports
    if (mod.default.FixedSizeList) return mod.default.FixedSizeList
    // 2b. Default itself is the List (Unlikely for this lib but possible for others)
  }

  // 3. Double-Default (Vite sometimes double-wraps CJS)
  if (mod.default && mod.default.default && mod.default.default.FixedSizeList) {
    return mod.default.default.FixedSizeList
  }

  return null
}

const ResolvedList = resolveList()

export const FixedSizeList: React.FC<Record<string, unknown>> = (props) => {
  if (ResolvedList) {
    return <ResolvedList {...props} />
  }
  return (
    <div style={{ padding: 20, color: 'red', border: '1px solid red' }}>
      Critical Error: Virtual List Failed to Load
    </div>
  )
}
