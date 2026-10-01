import { create } from 'zustand'

export interface PerformanceMetrics {
  fps: number
  frameTime: number
  nodesRenderTime: number
  linksRenderTime: number
  nodeCount: number
  linkCount: number
  isDragging: boolean
  hoveredNodeId: string | null
}

export interface PerformanceStore {
  metrics: PerformanceMetrics
  updateMetrics: (newMetrics: Partial<PerformanceMetrics>) => void
  setDragging: (isDragging: boolean) => void
  setHoveredNode: (nodeId: string | null) => void
}

export const usePerformanceStore = create<PerformanceStore>((set, get) => ({
  metrics: {
    fps: 0,
    frameTime: 0,
    nodesRenderTime: 0,
    linksRenderTime: 0,
    nodeCount: 0,
    linkCount: 0,
    isDragging: false,
    hoveredNodeId: null
  },

  // Fast imperative updates that don't trigger React renders unless subscribed
  updateMetrics: (newMetrics) => {
    set((state) => ({
      metrics: { ...state.metrics, ...newMetrics }
    }))
  },

  setDragging: (isDragging) => {
    if (get().metrics.isDragging === isDragging) return
    set((state) => ({
      metrics: { ...state.metrics, isDragging }
    }))
  },

  setHoveredNode: (nodeId) => {
    if (get().metrics.hoveredNodeId === nodeId) return
    set((state) => ({
      metrics: { ...state.metrics, hoveredNodeId: nodeId }
    }))
  }
}))

export default usePerformanceStore
