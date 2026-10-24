/**
 * @file index.ts
 * @description Central barrel export for the EditorSlash feature.
 * Exports the component, commands registry, and CodeMirror extension.
 * @module features/slash
 */

export { EditorSlash, type EditorSlashProps } from './EditorSlash'
export {
  EDITOR_SLASH_COMMANDS,
  SLASH_CATEGORIES,
  filterSlashCommands,
  type SlashCommand,
  type SlashCategory
} from './utils/slashCommands'
export {
  createEditorSlashPlugin,
  type SlashCoords,
  type SlashState,
  type SlashHandler,
  type CreateEditorSlashPluginProps
} from './utils/editorSlashExtension'
