import { useSettingsStore, Settings, ZenModeSettings } from '../../../core/store/SettingStore'

export type SettingType = 'boolean' | 'enum' | 'number' | 'string' | 'action'

export interface SettingOption {
  label: string
  value: any
  description?: string
}

export interface LuminaSettingDefinition {
  id: string
  key: string
  title: string
  description: string
  category:
    | 'Editor'
    | 'Appearance'
    | 'Cursor & Sound'
    | 'Layout'
    | 'Zen Mode'
    | 'AI Assistant'
    | 'Graph'
    | 'Advanced'
    | 'Workspace'
  keywords: string[]
  type: SettingType
  options?: SettingOption[]
  min?: number
  max?: number
  step?: number
  settingsTab?: string
  getValue: (settings: Settings) => any
  setValue: (value: any) => Promise<void>
  formatValue?: (val: any) => string
  validate?: (val: any) => boolean | string
}

export const SETTINGS_REGISTRY: LuminaSettingDefinition[] = [
  // --- Editor & Typography ---
  {
    id: 'editor.fontSize',
    key: 'fontSize',
    title: 'Editor: Font Size',
    description: 'Font size in pixels across note editing surfaces (12 - 28px).',
    category: 'Editor',
    keywords: ['font size', 'text scale', 'editor font', 'zoom text', 'letter size'],
    type: 'number',
    min: 12,
    max: 28,
    step: 1,
    settingsTab: 'look-and-feel',
    getValue: (s) => s.fontSize || 16,
    setValue: async (val) => {
      const num = parseInt(val, 10)
      if (!isNaN(num) && num >= 12 && num <= 28) {
        await useSettingsStore.getState().updateSetting('fontSize', num)
      }
    },
    formatValue: (val) => `${val}px`,
    validate: (val) => {
      const num = parseInt(val, 10)
      if (isNaN(num) || num < 12 || num > 28) return 'Font size must be between 12 and 28'
      return true
    }
  },
  {
    id: 'editor.fontFamily',
    key: 'fontFamily',
    title: 'Editor: Font Family',
    description: 'Font face used across note editing surfaces.',
    category: 'Editor',
    keywords: ['font family', 'typeface', 'font face', 'inter', 'fira code', 'jetbrains mono'],
    type: 'enum',
    settingsTab: 'look-and-feel',
    options: [
      { label: 'Inter (Default)', value: 'Inter' },
      { label: 'Vazirmatn (Arabic / Persian)', value: 'Vazirmatn' },
      { label: 'Roboto', value: 'Roboto' },
      { label: 'JetBrains Mono', value: 'JetBrains Mono' },
      { label: 'Fira Code', value: 'Fira Code' },
      { label: 'System Default', value: 'System Default' }
    ],
    getValue: (s) => s.fontFamily || 'Inter',
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('fontFamily', val)
    },
    formatValue: (val) => String(val || 'Inter')
  },
  {
    id: 'editor.autoSave',
    key: 'autoSave',
    title: 'Editor: Auto-Save',
    description: 'Save content changes automatically to disk as you type.',
    category: 'Editor',
    keywords: ['auto save', 'automatic save', 'save on type'],
    type: 'boolean',
    settingsTab: 'look-and-feel',
    getValue: (s) => s.autoSave !== false,
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('autoSave', Boolean(val))
    },
    formatValue: (val) => (val ? 'On' : 'Off')
  },
  {
    id: 'editor.showLineNumbers',
    key: 'showLineNumbers',
    title: 'Editor: Show Line Numbers',
    description: 'Display line numbers in the editor left gutter.',
    category: 'Editor',
    keywords: ['line numbers', 'gutter', 'line count'],
    type: 'boolean',
    settingsTab: 'look-and-feel',
    getValue: (s) => Boolean(s.showLineNumbers),
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('showLineNumbers', Boolean(val))
    },
    formatValue: (val) => (val ? 'On' : 'Off')
  },
  {
    id: 'editor.smoothScrolling',
    key: 'smoothScrolling',
    title: 'Editor: Smooth Scrolling',
    description: 'Animate viewport scroll transitions smoothly.',
    category: 'Editor',
    keywords: ['smooth scrolling', 'scroll animation', 'viewport'],
    type: 'boolean',
    settingsTab: 'look-and-feel',
    getValue: (s) => s.smoothScrolling !== false,
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('smoothScrolling', Boolean(val))
    },
    formatValue: (val) => (val ? 'On' : 'Off')
  },
  {
    id: 'editor.inlineMetadata',
    key: 'inlineMetadata',
    title: 'Editor: Note Action Buttons & Header',
    description: 'Show quick tool buttons and metadata inside the note header.',
    category: 'Editor',
    keywords: ['inline metadata', 'editor action buttons', 'note header', 'meta tools', 'meta bar'],
    type: 'boolean',
    settingsTab: 'look-and-feel',
    getValue: (s) => s.inlineMetadata !== false,
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('inlineMetadata', Boolean(val))
    },
    formatValue: (val) => (val ? 'On' : 'Off')
  },

  // --- Cursor & Sound ---
  {
    id: 'cursor.cursorStyle',
    key: 'cursorStyle',
    title: 'Cursor: Caret Animation Style',
    description: 'Caret animation shape and behavior (Smooth Line, Block, or Sharp Line).',
    category: 'Cursor & Sound',
    keywords: ['caret style', 'cursor shape', 'block cursor', 'smooth line'],
    type: 'enum',
    settingsTab: 'look-and-feel',
    options: [
      { label: 'Smooth Line', value: 'smooth' },
      { label: 'Block', value: 'block' },
      { label: 'Sharp Line', value: 'sharp' }
    ],
    getValue: (s) => s.cursorStyle || 'smooth',
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('cursorStyle', val)
    },
    formatValue: (val) => String(val || 'smooth')
  },
  {
    id: 'cursor.caretWidth',
    key: 'caretWidth',
    title: 'Cursor: Caret Width',
    description: 'Caret thickness in pixels (1px to 10px).',
    category: 'Cursor & Sound',
    keywords: ['caret width', 'cursor thickness', 'cursor width'],
    type: 'number',
    min: 1,
    max: 10,
    step: 1,
    settingsTab: 'look-and-feel',
    getValue: (s) => s.caretWidth || 2,
    setValue: async (val) => {
      const num = parseInt(val, 10)
      if (!isNaN(num) && num >= 1 && num <= 10) {
        await useSettingsStore.getState().updateSetting('caretWidth', num)
      }
    },
    formatValue: (val) => `${val}px`,
    validate: (val) => {
      const num = parseInt(val, 10)
      if (isNaN(num) || num < 1 || num > 10) return 'Caret width must be between 1 and 10'
      return true
    }
  },
  {
    id: 'cursor.useBorderLeft',
    key: 'useBorderLeft',
    title: 'Cursor: Active Line Left Border',
    description: 'Show a colored accent border on the line where the cursor is placed.',
    category: 'Cursor & Sound',
    keywords: ['active line border', 'line highlight', 'cursor border'],
    type: 'boolean',
    settingsTab: 'look-and-feel',
    getValue: (s) => s.useBorderLeft !== false && s.cursor?.useBorderLeft !== false,
    setValue: async (val) => {
      const b = Boolean(val)
      await useSettingsStore.getState().updateSetting('useBorderLeft', b)
      await useSettingsStore.getState().updateSetting('cursor', { useBorderLeft: b })
    },
    formatValue: (val) => (val ? 'On' : 'Off')
  },
  {
    id: 'cursor.typeSound',
    key: 'typeSound',
    title: 'Cursor: Mechanical Keyboard Sound',
    description: 'Play tactile mechanical audio feedback when typing.',
    category: 'Cursor & Sound',
    keywords: ['type sound', 'keyboard sound', 'mechanical sound', 'audio click'],
    type: 'boolean',
    settingsTab: 'look-and-feel',
    getValue: (s) => Boolean(s.typeSound),
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('typeSound', Boolean(val))
    },
    formatValue: (val) => (val ? 'On' : 'Off')
  },
  {
    id: 'cursor.typeSoundVolume',
    key: 'typeSoundVolume',
    title: 'Cursor: Typing Sound Volume',
    description: 'Mechanical keyboard sound effect volume (0 - 100%).',
    category: 'Cursor & Sound',
    keywords: ['sound volume', 'keyboard volume', 'typing volume'],
    type: 'number',
    min: 0,
    max: 100,
    step: 5,
    settingsTab: 'look-and-feel',
    getValue: (s) => s.typeSoundVolume ?? 50,
    setValue: async (val) => {
      const num = parseInt(val, 10)
      if (!isNaN(num) && num >= 0 && num <= 100) {
        await useSettingsStore.getState().updateSetting('typeSoundVolume', num)
      }
    },
    formatValue: (val) => `${val}%`,
    validate: (val) => {
      const num = parseInt(val, 10)
      if (isNaN(num) || num < 0 || num > 100) return 'Volume must be between 0 and 100'
      return true
    }
  },

  // --- Appearance & Theme ---
  {
    id: 'appearance.theme',
    key: 'theme',
    title: 'Appearance: Base Theme',
    description: 'Application color scheme.',
    category: 'Appearance',
    keywords: ['theme', 'dark', 'light', 'nord', 'monokai', 'cyberpunk', 'dracula'],
    type: 'enum',
    settingsTab: 'look-and-feel',
    options: [
      { label: 'Dark', value: 'dark' },
      { label: 'Light', value: 'light' },
      { label: 'Nord', value: 'nord' },
      { label: 'Monokai', value: 'monokai' },
      { label: 'Cyberpunk', value: 'cyberpunk' }
    ],
    getValue: (s) => s.theme || 'dark',
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('theme', val)
    },
    formatValue: (val) => String(val || 'dark')
  },
  {
    id: 'appearance.modernUi',
    key: 'modernUi',
    title: 'Appearance: Modern UI Enhancements',
    description: 'Enable sleek rounded styling and elevated UI design.',
    category: 'Appearance',
    keywords: ['modern ui', 'rounded corners', 'sleek ui'],
    type: 'boolean',
    settingsTab: 'look-and-feel',
    getValue: (s) => s.modernUi !== false,
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('modernUi', Boolean(val))
    },
    formatValue: (val) => (val ? 'On' : 'Off')
  },
  {
    id: 'appearance.translucency',
    key: 'translucency',
    title: 'Appearance: Window Translucency',
    description: 'Enable window acrylic/vibrancy translucency effects.',
    category: 'Appearance',
    keywords: ['translucency', 'vibrancy', 'acrylic', 'transparent window', 'blur glass'],
    type: 'boolean',
    settingsTab: 'look-and-feel',
    getValue: (s) => Boolean(s.translucency),
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('translucency', Boolean(val))
    },
    formatValue: (val) => (val ? 'On' : 'Off')
  },
  {
    id: 'appearance.windowOpacity',
    key: 'windowOpacity',
    title: 'Appearance: Window Opacity',
    description: 'Overall window opacity level (20% - 100%).',
    category: 'Appearance',
    keywords: ['window opacity', 'transparency', 'alpha'],
    type: 'number',
    min: 20,
    max: 100,
    step: 5,
    settingsTab: 'look-and-feel',
    getValue: (s) => Math.round((s.windowOpacity ?? 1.0) * 100),
    setValue: async (val) => {
      const num = parseInt(val, 10)
      if (!isNaN(num) && num >= 20 && num <= 100) {
        const floatVal = num / 100
        await useSettingsStore.getState().updateSetting('windowOpacity', floatVal)
        const api = (window as any).api
        if (api?.setWindowOpacity) {
          api.setWindowOpacity(floatVal)
        }
      }
    },
    formatValue: (val) => `${val}%`,
    validate: (val) => {
      const num = parseInt(val, 10)
      if (isNaN(num) || num < 20 || num > 100) return 'Opacity must be between 20 and 100'
      return true
    }
  },

  // --- Layout & Component Visibility ---
  {
    id: 'layout.titleBarVisible',
    key: 'titleBarVisible',
    title: 'Layout: Title Bar Visibility',
    description: 'Show or hide the top application title bar.',
    category: 'Layout',
    keywords: ['title bar', 'window title', 'header bar', 'visibility'],
    type: 'boolean',
    getValue: (s) => s.titleBarVisible !== false,
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('titleBarVisible', Boolean(val))
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('resize'))
    },
    formatValue: (val) => (val ? 'Visible' : 'Hidden')
  },
  {
    id: 'layout.statusBarVisible',
    key: 'statusBarVisible',
    title: 'Layout: Status Bar Visibility',
    description: 'Show or hide the bottom document status bar.',
    category: 'Layout',
    keywords: ['status bar', 'bottom bar', 'word count', 'visibility'],
    type: 'boolean',
    getValue: (s) => s.statusBarVisible !== false,
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('statusBarVisible', Boolean(val))
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('resize'))
    },
    formatValue: (val) => (val ? 'Visible' : 'Hidden')
  },
  {
    id: 'layout.activityBarVisible',
    key: 'activityBarVisible',
    title: 'Layout: Activity Bar Visibility',
    description: 'Show or hide the left activity dock icons.',
    category: 'Layout',
    keywords: ['activity bar', 'icon bar', 'dock icons', 'visibility'],
    type: 'boolean',
    getValue: (s) => s.activityBarVisible !== false,
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('activityBarVisible', Boolean(val))
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('resize'))
    },
    formatValue: (val) => (val ? 'Visible' : 'Hidden')
  },
  {
    id: 'layout.primarySidebarOpen',
    key: 'sidebar.isLeftOpen',
    title: 'Layout: Primary (Left) Sidebar Visibility',
    description: 'Show or hide the vault file tree explorer sidebar.',
    category: 'Layout',
    keywords: ['primary sidebar', 'left sidebar', 'file explorer', 'vault tree', 'visibility'],
    type: 'boolean',
    getValue: (s) => s.sidebar?.isLeftOpen ?? true,
    setValue: async (val) => {
      const b = Boolean(val)
      const current = useSettingsStore.getState().settings.sidebar || { width: 260, isLeftOpen: true }
      await useSettingsStore.getState().updateSetting('sidebar', { ...current, isLeftOpen: b })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('left-sidebar-toggle', { detail: { open: b } }))
        window.dispatchEvent(new Event('resize'))
      }
    },
    formatValue: (val) => (val ? 'Open' : 'Closed')
  },
  {
    id: 'layout.secondarySidebarOpen',
    key: 'rightSidebar.isRightOpen',
    title: 'Layout: Secondary (Right) Sidebar Visibility',
    description: 'Show or hide the inspector / backlinks / details sidebar.',
    category: 'Layout',
    keywords: ['secondary sidebar', 'right sidebar', 'inspector', 'details', 'backlinks', 'visibility'],
    type: 'boolean',
    getValue: (s) => s.rightSidebar?.isRightOpen ?? false,
    setValue: async (val) => {
      const b = Boolean(val)
      const current = useSettingsStore.getState().settings.rightSidebar || { width: 300, isRightOpen: false }
      await useSettingsStore.getState().updateSetting('rightSidebar', { ...current, isRightOpen: b })
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('resize'))
    },
    formatValue: (val) => (val ? 'Open' : 'Closed')
  },
  {
    id: 'layout.primarySidebarWidth',
    key: 'sidebar.width',
    title: 'Layout: Primary Sidebar Width',
    description: 'Width of the left file explorer sidebar in pixels (180 - 600px).',
    category: 'Layout',
    keywords: ['sidebar width', 'left sidebar size', 'explorer width'],
    type: 'number',
    min: 180,
    max: 600,
    step: 10,
    getValue: (s) => s.sidebar?.width || 260,
    setValue: async (val) => {
      const num = parseInt(val, 10)
      if (!isNaN(num) && num >= 180 && num <= 600) {
        const current = useSettingsStore.getState().settings.sidebar || { width: 260, isLeftOpen: true }
        await useSettingsStore.getState().updateSetting('sidebar', { ...current, width: num })
      }
    },
    formatValue: (val) => `${val}px`,
    validate: (val) => {
      const num = parseInt(val, 10)
      if (isNaN(num) || num < 180 || num > 600) return 'Width must be between 180 and 600'
      return true
    }
  },

  {
    id: 'zenMode.hideStatusBar',
    key: 'zenMode.hideStatusBar',
    title: 'Zen Mode: Hide Status Bar',
    description: 'Automatically hide the status bar when entering Zen Mode.',
    category: 'Zen Mode',
    keywords: ['zen hide status bar', 'zen status bar'],
    type: 'boolean',
    getValue: (s) => s.zenMode?.hideStatusBar !== false,
    setValue: async (val) => {
      const current = useSettingsStore.getState().settings.zenMode || ({} as ZenModeSettings)
      await useSettingsStore.getState().updateSetting('zenMode', { ...current, hideStatusBar: Boolean(val) })
    },
    formatValue: (val) => (val ? 'On' : 'Off')
  },
  {
    id: 'zenMode.hideActivityBar',
    key: 'zenMode.hideActivityBar',
    title: 'Zen Mode: Hide Activity Bar',
    description: 'Automatically hide the activity bar when entering Zen Mode.',
    category: 'Zen Mode',
    keywords: ['zen hide activity bar', 'zen activity dock'],
    type: 'boolean',
    getValue: (s) => s.zenMode?.hideActivityBar !== false,
    setValue: async (val) => {
      const current = useSettingsStore.getState().settings.zenMode || ({} as ZenModeSettings)
      await useSettingsStore.getState().updateSetting('zenMode', { ...current, hideActivityBar: Boolean(val) })
    },
    formatValue: (val) => (val ? 'On' : 'Off')
  },
  {
    id: 'zenMode.hidePrimarySidebar',
    key: 'zenMode.hidePrimarySidebar',
    title: 'Zen Mode: Hide Primary Sidebar',
    description: 'Automatically collapse the left sidebar when entering Zen Mode.',
    category: 'Zen Mode',
    keywords: ['zen hide primary sidebar', 'zen left sidebar', 'zen explorer'],
    type: 'boolean',
    getValue: (s) => s.zenMode?.hidePrimarySidebar !== false,
    setValue: async (val) => {
      const current = useSettingsStore.getState().settings.zenMode || ({} as ZenModeSettings)
      await useSettingsStore.getState().updateSetting('zenMode', { ...current, hidePrimarySidebar: Boolean(val) })
    },
    formatValue: (val) => (val ? 'On' : 'Off')
  },
  {
    id: 'zenMode.hideSecondarySidebar',
    key: 'zenMode.hideSecondarySidebar',
    title: 'Zen Mode: Hide Secondary Sidebar',
    description: 'Automatically collapse the inspector sidebar when entering Zen Mode.',
    category: 'Zen Mode',
    keywords: ['zen hide secondary sidebar', 'zen right sidebar', 'zen inspector'],
    type: 'boolean',
    getValue: (s) => s.zenMode?.hideSecondarySidebar !== false,
    setValue: async (val) => {
      const current = useSettingsStore.getState().settings.zenMode || ({} as ZenModeSettings)
      await useSettingsStore.getState().updateSetting('zenMode', { ...current, hideSecondarySidebar: Boolean(val) })
    },
    formatValue: (val) => (val ? 'On' : 'Off')
  },

  // --- AI Assistant ---
  {
    id: 'ai.activeProvider',
    key: 'activeProvider',
    title: 'AI Assistant: Active Provider',
    description: 'Selected large language model provider.',
    category: 'AI Assistant',
    keywords: ['ai provider', 'deepseek', 'openai', 'anthropic', 'groq', 'ollama', 'llm'],
    type: 'enum',
    settingsTab: 'assistant',
    options: [
      { label: 'DeepSeek', value: 'deepseek' },
      { label: 'OpenAI (GPT-4o)', value: 'openai' },
      { label: 'Anthropic (Claude 3.5)', value: 'anthropic' },
      { label: 'Groq', value: 'groq' },
      { label: 'Ollama (Local Offline)', value: 'ollama' }
    ],
    getValue: (s) => s.activeProvider || 'deepseek',
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('activeProvider', val)
    },
    formatValue: (val) => String(val || 'deepseek')
  },
  {
    id: 'ai.activeAIMode',
    key: 'activeAIMode',
    title: 'AI Assistant: Active Mode',
    description: 'Default persona/behavior for Lumina AI conversations.',
    category: 'AI Assistant',
    keywords: ['ai mode', 'code mode', 'plan mode', 'creative mode'],
    type: 'enum',
    settingsTab: 'assistant',
    options: [
      { label: 'Code', value: 'Code' },
      { label: 'Plan', value: 'Plan' },
      { label: 'Creative', value: 'Creative' }
    ],
    getValue: (s) => s.activeAIMode || 'Code',
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('activeAIMode', val)
    },
    formatValue: (val) => String(val || 'Code')
  },
  {
    id: 'ai.aiChatDisplayMode',
    key: 'aiChatDisplayMode',
    title: 'AI Assistant: Chat Display Mode',
    description: 'Open AI conversations in a sidebar tab or floating modal.',
    category: 'AI Assistant',
    keywords: ['ai display mode', 'chat sidebar', 'chat modal', 'floating ai'],
    type: 'enum',
    settingsTab: 'assistant',
    options: [
      { label: 'Sidebar Tab', value: 'sidebar' },
      { label: 'Floating Modal', value: 'modal' }
    ],
    getValue: (s) => s.aiChatDisplayMode || 'sidebar',
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('aiChatDisplayMode', val)
    },
    formatValue: (val) => String(val || 'sidebar')
  },
  {
    id: 'ai.ollamaUrl',
    key: 'ollamaUrl',
    title: 'AI Assistant: Ollama Endpoint URL',
    description: 'Local or network Ollama API address.',
    category: 'AI Assistant',
    keywords: ['ollama url', 'ollama endpoint', 'local ai url'],
    type: 'string',
    settingsTab: 'assistant',
    getValue: (s) => s.ollamaUrl || 'http://localhost:11434/api/chat',
    setValue: async (val) => {
      if (val && typeof val === 'string') {
        await useSettingsStore.getState().updateSetting('ollamaUrl', val.trim())
      }
    },
    formatValue: (val) => String(val || 'http://localhost:11434/api/chat')
  },

  // --- Graph Visualization ---
  {
    id: 'graph.graphNodeSize',
    key: 'graphNodeSize',
    title: 'Graph: Node Size Multiplier',
    description: 'Visual radius of knowledge nodes (0.5 to 2.0).',
    category: 'Graph',
    keywords: ['graph node size', 'node scale', 'knowledge node radius'],
    type: 'number',
    min: 0.5,
    max: 2.0,
    step: 0.1,
    settingsTab: 'advanced',
    getValue: (s) => s.graphNodeSize || 1.5,
    setValue: async (val) => {
      const num = parseFloat(val)
      if (!isNaN(num) && num >= 0.5 && num <= 2.0) {
        await useSettingsStore.getState().updateSetting('graphNodeSize', num)
      }
    },
    formatValue: (val) => `${val}x`
  },
  {
    id: 'graph.graphShowTexts',
    key: 'graphShowTexts',
    title: 'Graph: Show Node Labels',
    description: 'Display document titles directly on knowledge nodes.',
    category: 'Graph',
    keywords: ['graph labels', 'show text', 'node names'],
    type: 'boolean',
    settingsTab: 'advanced',
    getValue: (s) => s.graphShowTexts !== false,
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('graphShowTexts', Boolean(val))
    },
    formatValue: (val) => (val ? 'On' : 'Off')
  },

  // --- System & Advanced ---
  {
    id: 'advanced.launchOnStartup',
    key: 'launchOnStartup',
    title: 'Advanced: Launch on Startup',
    description: 'Launch Lumina silently in background when the computer boots.',
    category: 'Advanced',
    keywords: ['startup', 'boot', 'launch on login', 'autostart'],
    type: 'boolean',
    settingsTab: 'advanced',
    getValue: (s) => Boolean(s.launchOnStartup),
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('launchOnStartup', Boolean(val))
    },
    formatValue: (val) => (val ? 'Enabled' : 'Disabled')
  },
  {
    id: 'advanced.enableDevTools',
    key: 'enableDevTools',
    title: 'Advanced: Enable Developer Tools',
    description: 'Allow opening Chromium Developer Tools (F12) in production.',
    category: 'Advanced',
    keywords: ['devtools', 'developer tools', 'inspect element', 'console'],
    type: 'boolean',
    settingsTab: 'advanced',
    getValue: (s) => s.enableDevTools !== false,
    setValue: async (val) => {
      await useSettingsStore.getState().updateSetting('enableDevTools', Boolean(val))
    },
    formatValue: (val) => (val ? 'Enabled' : 'Disabled')
  },
  {
    id: 'workspace.storageLocation',
    key: 'workspacePath',
    title: 'Workspace: Storage Directory',
    description: 'Location where markdown notes and attachments are stored.',
    category: 'Workspace',
    keywords: ['workspace path', 'vault path', 'storage directory', 'change folder'],
    type: 'action',
    settingsTab: 'workspace',
    getValue: (s) => s.workspacePath || s.vaultPath || 'Default Documents/lumina',
    setValue: async () => {
      const api = (window as any).api
      if (api?.selectWorkspace) {
        await api.selectWorkspace()
      }
    },
    formatValue: (val) => String(val || 'Default')
  }
]
