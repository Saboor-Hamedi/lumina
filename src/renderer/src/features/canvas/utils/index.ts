/**
 * ============================================================================
 * Lumina Canvas Utilities Module (`utils/index.ts`)
 * ============================================================================
 * Public barrel exports for all pure TypeScript canvas algorithms:
 * - `canvasUtils.ts`: Node normalization, port coordinates, 22 shape ratios, colors
 * - `canvasRouting.ts`: Wire paths (curved, step, straight) & dynamic facing ports
 * - `canvasAlignment.ts`: Node alignment, distribution, and collective bounding boxes
 * - `canvasExport.ts`: PNG rasterization, standalone SVG, and clipboard snapshots
 * ============================================================================
 */

export * from './canvasUtils'
export * from './canvasPorts'
export * from './canvasRouting'
export * from './canvasAlignment'
export * from './canvasExport'
