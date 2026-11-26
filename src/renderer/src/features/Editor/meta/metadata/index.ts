export { MetadataPanel, type MetadataPanelProps } from './MetadataPanel'
export { CalendarDatePicker, type CalendarDatePickerProps } from './CalendarDatePicker'
export {
  fetchNoteMetadata,
  upsertNoteMetadata,
  deleteNoteMetadata,
  clearNoteMetadata,
  type SqliteMetadataEntry
} from './metadataClient'
export {
  sanitizePropertyKey,
  isReservedMetadataKey,
  formatPropertyLabel,
  inferPropertyType,
  parseCustomYamlFromCode,
  extractCustomYamlProperties,
  toPropertyList,
  serializeYamlPropertiesBlock
} from './yamlMetadata'
export {
  SELECT_PRESET_OPTIONS,
  QUICK_PROPERTY_PRESETS,
  type MetadataPropertyType,
  type MetadataPropertiesMap,
  type MetadataProperty
} from './types'
export {
  default as ProgressBadge,
  ProgressTracker,
  RoadmapProgressBar,
  LearnedButton,
  LearningTrackBadge,
  type LearnedNoteLike,
  type LearnedButtonProps,
  type LearningTrackBadgeProps
} from './progress'
