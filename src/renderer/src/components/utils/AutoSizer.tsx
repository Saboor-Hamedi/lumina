import React, { useEffect, useRef, useState } from 'react'

export interface AutoSizerDimensions {
  width: number
  height: number
}

export interface AutoSizerProps {
  children: (dimensions: AutoSizerDimensions) => React.ReactNode
}

/**
 * Robust AutoSizer (Zero-Dependency)
 * Replaces flaky npm packages with a native ResizeObserver implementation.
 * Ensures strict pixel-perfect layout for virtual lists.
 */
export const AutoSizer: React.FC<AutoSizerProps> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState<AutoSizerDimensions>({ width: 0, height: 0 })

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      // Use standard box model content rect
      for (const entry of entries) {
        if (entry.contentRect) {
          const { width, height } = entry.contentRect
          // Only update if dimensions actually changed to prevent loops
          setDimensions((prev) => {
            if (prev.width === width && prev.height === height) return prev
            return { width, height }
          })
        }
      }
    })

    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {dimensions.width > 0 && dimensions.height > 0 && children(dimensions)}
    </div>
  )
}
