import settingsManager, { SettingsManager, DEFAULT_SETTINGS, type Settings } from './settingsManager'
export { SettingsManager, DEFAULT_SETTINGS, type Settings }
export { AppConfigManager, type Shortcuts } from './appConfig'
export {
  GLOBAL_API_KEYS,
  type GlobalApiKey,
  isSafeStorageReady,
  encryptKey,
  decryptKey
} from './crypto'
export default settingsManager
