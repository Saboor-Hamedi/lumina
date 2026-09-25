/**
 * =========================================================================
 * Command Palette Feature Barrel (`index.ts`)
 * =========================================================================
 *
 * Clean architectural barrel exporting the virtualized CommandPalette,
 * full-fidelity read-only PreviewCommandPalette, and all associated TypeScript
 * interfaces and types.
 * =========================================================================
 */

export { CommandPalette, default } from './CommandPalette'
export { PreviewCommandPalette } from './PreviewCommandPalette'

export type {
  PaletteItem,
  CommandPaletteProps,
  CommandPaletteRowData
} from './CommandPalette'

export type {
  PreviewCommandPaletteProps
} from './PreviewCommandPalette'
