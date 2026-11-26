export type MetadataPropertyType = 'text' | 'select' | 'date' | 'checkbox' | 'url' | 'number'

export type MetadataPropertiesMap = Record<string, string>

export interface MetadataProperty {
  key: string
  value: string
  type: MetadataPropertyType
}

export const SELECT_PRESET_OPTIONS: Record<string, string[]> = {
  status: ['Draft', 'In Progress', 'Review', 'Done'],
  priority: ['Low', 'Medium', 'High', 'Urgent'],
  stage: ['Idea', 'Planning', 'Active', 'Archived']
}

export const QUICK_PROPERTY_PRESETS: Array<{
  key: string
  label: string
  type: MetadataPropertyType
  defaultValue: string
}> = [
  { key: 'status', label: 'Status', type: 'select', defaultValue: 'In Progress' },
  { key: 'priority', label: 'Priority', type: 'select', defaultValue: 'Medium' },
  { key: 'due_date', label: 'Due Date', type: 'date', defaultValue: '' },
  { key: 'url', label: 'URL', type: 'url', defaultValue: '' },
  { key: 'done', label: 'Done', type: 'checkbox', defaultValue: 'false' },
  { key: 'author', label: 'Author', type: 'text', defaultValue: '' }
]
