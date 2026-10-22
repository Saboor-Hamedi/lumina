/**
 * =========================================================================
 * Command Palette Feature Barrel (`index.ts`)
 * =========================================================================
 *
 * Clean architectural barrel exporting the virtualized CommandPalette,
 * full-fidelity read-only PreviewCommandPalette, command & settings registries,
 * and all associated TypeScript interfaces and types.
 * =========================================================================
 */

export { CommandPalette, default } from './CommandPalette'
export { PreviewCommandPalette } from './PreviewCommandPalette'
export { COMMANDS_REGISTRY } from './utils/commandsRegistry'
export type { LuminaCommand, CommandContext } from './utils/commandsRegistry'
export { SETTINGS_REGISTRY } from './utils/settingsRegistry'
export type { LuminaSettingDefinition, SettingType, SettingOption } from './utils/settingsRegistry'

export type {
  PaletteItem,
  CommandPaletteProps
} from './CommandPalette'

export type {
  PreviewCommandPaletteProps
} from './PreviewCommandPalette'
