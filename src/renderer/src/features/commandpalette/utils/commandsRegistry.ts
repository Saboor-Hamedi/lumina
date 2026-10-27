import { useSettingsStore } from '../../../core/store/SettingStore'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'

export interface CommandContext {
  onToggleSettings?: (tab?: string) => void
  onToggleGraph?: () => void
  onToggleChat?: () => void
  onToggleDocs?: () => void
  onRename?: () => void
  onNew?: () => void
  onClose: () => void
}

export interface LuminaCommand {
  id: string
  title: string
  category: 'View' | 'File' | 'Editor' | 'Preferences' | 'Theme' | 'Search' | 'Application' | 'Developer'
  shortcut?: string
  keywords?: string[]
  iconName?: string
  execute: (context: CommandContext) => void | Promise<void>
}

export const COMMANDS_REGISTRY: LuminaCommand[] = [
  // --- View: Zen Mode & Component Visibility ---
  {
    id: 'view.toggleZenMode',
    title: 'View: Toggle Zen Mode',
    category: 'View',
    shortcut: 'Ctrl + .',
    keywords: ['zen', 'distraction free', 'focus', 'clean', 'toggle', 'hide ui'],
    iconName: 'Maximize',
    execute: async () => {
      await useSettingsStore.getState().toggleZenMode()
    }
  },
  {
    id: 'view.toggleTitleBar',
    title: 'View: Toggle Title Bar',
    category: 'View',
    keywords: ['title bar', 'window title', 'header', 'top bar', 'toggle', 'show title bar', 'hide title bar', 'restore title bar', 'bring back title bar'],
    iconName: 'PanelTop',
    execute: async () => {
      await useSettingsStore.getState().toggleTitleBar()
    }
  },
  {
    id: 'view.toggleTabs',
    title: 'View: Toggle Tabs',
    category: 'View',
    keywords: ['tabs', 'tab bar', 'editor tabs', 'toggle tabs', 'show tabs', 'hide tabs', 'restore tabs'],
    iconName: 'Layout',
    execute: async () => {
      await useSettingsStore.getState().toggleTabs()
    }
  },
  {
    id: 'view.toggleBreadcrumbs',
    title: 'View: Toggle Breadcrumbs',
    category: 'View',
    keywords: ['breadcrumbs', 'path navigation', 'file path', 'toggle breadcrumbs', 'show breadcrumbs', 'hide breadcrumbs', 'restore breadcrumbs'],
    iconName: 'ChevronRight',
    execute: async () => {
      await useSettingsStore.getState().toggleBreadcrumbs()
    }
  },
  {
    id: 'view.toggleStatusBar',
    title: 'View: Toggle Status Bar',
    category: 'View',
    keywords: ['status bar', 'bottom bar', 'word count', 'toggle', 'show status bar', 'hide status bar', 'restore status bar', 'bring back status bar'],
    iconName: 'PanelBottom',
    execute: async () => {
      await useSettingsStore.getState().toggleStatusBar()
    }
  },
  {
    id: 'view.toggleActivityBar',
    title: 'View: Toggle Activity Bar',
    category: 'View',
    keywords: ['activity bar', 'icon dock', 'left dock', 'navigation icons', 'toggle', 'show activity bar', 'hide activity bar', 'restore activity bar', 'bring back activity bar'],
    iconName: 'LayoutGrid',
    execute: async () => {
      await useSettingsStore.getState().toggleActivityBar()
    }
  },
  {
    id: 'view.togglePrimarySidebar',
    title: 'View: Toggle Primary Sidebar',
    category: 'View',
    shortcut: 'Ctrl + B',
    keywords: ['primary sidebar', 'left sidebar', 'explorer', 'vault', 'file tree', 'toggle', 'show sidebar', 'show left sidebar', 'hide sidebar', 'restore sidebar', 'bring back sidebar'],
    iconName: 'PanelLeft',
    execute: async () => {
      await useSettingsStore.getState().togglePrimarySidebar()
    }
  },
  {
    id: 'view.toggleSecondarySidebar',
    title: 'View: Toggle Secondary Sidebar',
    category: 'View',
    shortcut: 'Ctrl + I',
    keywords: ['secondary sidebar', 'right sidebar', 'inspector', 'details', 'backlinks', 'outline', 'toggle', 'show right sidebar', 'hide right sidebar', 'restore right sidebar'],
    iconName: 'PanelRight',
    execute: async () => {
      await useSettingsStore.getState().toggleSecondarySidebar()
    }
  },
  {
    id: 'view.toggleEditorMetadata',
    title: 'View: Toggle Editor Metadata / Note Actions',
    category: 'View',
    keywords: ['editor metadata', 'note actions', 'action bar', 'meta header', 'meta tools', 'inline metadata', 'show metadata', 'hide metadata'],
    iconName: 'Sparkles',
    execute: async () => {
      await useSettingsStore.getState().toggleEditorMetadata()
    }
  },
  {
    id: 'view.metaPositionFloatTop',
    title: 'Meta: Float top',
    category: 'View',
    keywords: ['meta', 'float top', 'meta float top', 'action bar top', 'header', 'position', 'meta panel'],
    iconName: 'PanelTop',
    execute: async () => {
      await useSettingsStore.getState().updateSetting('metaPosition', 'top')
    }
  },
  {
    id: 'view.metaPositionFloatBottom',
    title: 'Meta: Float bottom',
    category: 'View',
    keywords: ['meta', 'float bottom', 'float buttom', 'meta float bottom', 'meta float buttom', 'footer', 'position', 'meta panel'],
    iconName: 'PanelBottom',
    execute: async () => {
      await useSettingsStore.getState().updateSetting('metaPosition', 'bottom')
    }
  },
  {
    id: 'view.metaPositionInline',
    title: 'Meta: Inline',
    category: 'View',
    keywords: ['meta', 'inline', 'meta inline', 'action bar inline', 'document', 'position', 'meta panel'],
    iconName: 'Layout',
    execute: async () => {
      await useSettingsStore.getState().updateSetting('metaPosition', 'inline')
    }
  },
  {
    id: 'view.toggleLocalGraph',
    title: 'View: Toggle Local Graph',
    category: 'View',
    shortcut: 'Alt + G',
    keywords: ['local graph', 'graph', 'linked mentions', 'backlinks', 'toggle', 'inline graph'],
    iconName: 'Network',
    execute: async () => {
      window.dispatchEvent(new CustomEvent('toggle-local-graph'))
    }
  },
  {
    id: 'view.toggleTerminal',
    title: 'View: Toggle Terminal',
    category: 'View',
    shortcut: 'Ctrl + J',
    keywords: ['terminal', 'console', 'shell', 'bash', 'powershell', 'toggle'],
    iconName: 'Terminal',
    execute: () => {
      window.dispatchEvent(new CustomEvent('toggle-terminal'))
    }
  },
  {
    id: 'view.toggleOutline',
    title: 'View: Toggle Document Outline',
    category: 'View',
    shortcut: 'Ctrl + Shift + O',
    keywords: ['outline', 'table of contents', 'headings', 'toc'],
    iconName: 'PanelRight',
    execute: () => {
      window.dispatchEvent(new CustomEvent('open-outline'))
    }
  },

  // --- File & Workspace Operations ---
  {
    id: 'file.newNote',
    title: 'File: New Note',
    category: 'File',
    shortcut: 'Ctrl + N',
    keywords: ['new note', 'create note', 'add note', 'blank note'],
    iconName: 'Plus',
    execute: (ctx) => {
      if (ctx.onNew) {
        ctx.onNew()
      } else {
        window.dispatchEvent(new CustomEvent('new-note'))
      }
    }
  },
  {
    id: 'file.saveNote',
    title: 'File: Save Current Note',
    category: 'File',
    shortcut: 'Ctrl + S',
    keywords: ['save', 'write to disk', 'persist'],
    iconName: 'Save',
    execute: async () => {
      const activeId = useWorkspaceStore.getState().activeTabId
      if (activeId) {
        await useWorkspaceStore.getState().saveNote({ id: activeId })
      }
    }
  },
  {
    id: 'file.renameNote',
    title: 'File: Rename Active Note',
    category: 'File',
    keywords: ['rename', 'change title', 'title'],
    iconName: 'Edit3',
    execute: (ctx) => {
      ctx.onRename?.()
    }
  },
  {
    id: 'file.deleteNote',
    title: 'File: Delete Active Note',
    category: 'File',
    shortcut: 'Ctrl + Shift + D',
    keywords: ['delete', 'remove', 'trash', 'destroy'],
    iconName: 'Trash2',
    execute: () => {
      const activeId = useWorkspaceStore.getState().activeTabId
      if (activeId) {
        useWorkspaceStore.getState().deleteNote(activeId)
      }
    }
  },
  {
    id: 'file.openFolder',
    title: 'File: Open Workspace Folder',
    category: 'File',
    shortcut: 'Ctrl + O',
    keywords: ['open folder', 'open directory', 'workspace path', 'change folder'],
    iconName: 'FolderOpen',
    execute: async () => {
      const api = (window as any).api
      if (api && api.openDirectory) {
        const dir = await api.openDirectory()
        if (dir) {
          await useSettingsStore.getState().updateSetting('workspacePath', dir)
          window.location.reload()
        }
      }
    }
  },
  {
    id: 'file.syncWorkspace',
    title: 'File: Synchronize Workspace with Disk',
    category: 'File',
    keywords: ['sync', 'reload files', 'refresh directory', 'rescan'],
    iconName: 'FolderSync',
    execute: async () => {
      await useWorkspaceStore.getState().loadWorkspace()
    }
  },

  // --- Navigation & Tabs ---
  {
    id: 'navigation.quickOpen',
    title: 'Navigation: Quick Open (Search Notes)',
    category: 'Search',
    shortcut: 'Ctrl + P',
    keywords: ['quick open', 'find file', 'search notes', 'go to file'],
    iconName: 'Search',
    execute: () => {
      window.dispatchEvent(new CustomEvent('open-quick-search'))
    }
  },
  {
    id: 'navigation.globalSearch',
    title: 'Navigation: Global Search Across Vault',
    category: 'Search',
    shortcut: 'Ctrl + Shift + F',
    keywords: ['find in files', 'search vault', 'grep', 'search all'],
    iconName: 'Search',
    execute: () => {
      window.dispatchEvent(new CustomEvent('open-global-search'))
    }
  },
  {
    id: 'navigation.graphView',
    title: 'Navigation: Open Graph View',
    category: 'View',
    shortcut: 'Ctrl + G',
    keywords: ['graph', 'nexus', 'knowledge graph', 'links', 'nodes'],
    iconName: 'Network',
    execute: (ctx) => {
      if (ctx.onToggleGraph) {
        ctx.onToggleGraph()
      } else {
        useWorkspaceStore.getState().openGraphTab()
      }
    }
  },
  {
    id: 'navigation.nextTab',
    title: 'View: Next Tab',
    category: 'View',
    shortcut: 'Ctrl + Tab',
    keywords: ['next tab', 'switch tab', 'forward tab'],
    iconName: 'ArrowRight',
    execute: () => {
      const { openTabs, activeTabId, setActiveTabId } = useWorkspaceStore.getState()
      if (openTabs.length > 1 && activeTabId) {
        const idx = openTabs.indexOf(activeTabId)
        const nextIdx = (idx + 1) % openTabs.length
        setActiveTabId(openTabs[nextIdx])
      }
    }
  },
  {
    id: 'navigation.previousTab',
    title: 'View: Previous Tab',
    category: 'View',
    shortcut: 'Ctrl + Shift + Tab',
    keywords: ['previous tab', 'switch tab back', 'back tab'],
    iconName: 'ArrowLeft',
    execute: () => {
      const { openTabs, activeTabId, setActiveTabId } = useWorkspaceStore.getState()
      if (openTabs.length > 1 && activeTabId) {
        const idx = openTabs.indexOf(activeTabId)
        const prevIdx = (idx - 1 + openTabs.length) % openTabs.length
        setActiveTabId(openTabs[prevIdx])
      }
    }
  },
  {
    id: 'navigation.closeTab',
    title: 'View: Close Active Tab',
    category: 'View',
    shortcut: 'Ctrl + W',
    keywords: ['close tab', 'dismiss tab', 'exit note'],
    iconName: 'X',
    execute: () => {
      const { activeTabId, closeTab } = useWorkspaceStore.getState()
      if (activeTabId) {
        closeTab(activeTabId)
      }
    }
  },
  {
    id: 'navigation.closeAllTabs',
    title: 'View: Close All Tabs',
    category: 'View',
    keywords: ['close all', 'clear tabs', 'dismiss all'],
    iconName: 'X',
    execute: () => {
      useWorkspaceStore.getState().closeAllTabs()
    }
  },

  // --- AI & Intelligence ---
  {
    id: 'ai.openChat',
    title: 'AI: Open Conversational Assistant',
    category: 'Application',
    shortcut: 'Ctrl + Shift + \\',
    keywords: ['ai chat', 'lumina copilot', 'ask ai', 'assistant', 'prompt'],
    iconName: 'Bot',
    execute: (ctx) => {
      ctx.onToggleChat?.()
    }
  },
  {
    id: 'ai.voiceDictation',
    title: 'AI: Toggle Voice Dictation',
    category: 'Editor',
    shortcut: 'Shift + Alt + V',
    keywords: ['voice', 'speech to text', 'audio transcription', 'dictate', 'mic'],
    iconName: 'Mic',
    execute: () => {
      window.dispatchEvent(new CustomEvent('toggle-voice-dictation'))
    }
  },

  // --- Preferences & Themes ---
  {
    id: 'preferences.openSettings',
    title: 'Preferences: Open Settings',
    category: 'Preferences',
    shortcut: 'Ctrl + ,',
    keywords: ['preferences', 'options', 'configure', 'setup'],
    iconName: 'Settings',
    execute: (ctx) => {
      ctx.onToggleSettings?.('general')
    }
  },
  {
    id: 'preferences.openAppearance',
    title: 'Preferences: Themes & Appearance',
    category: 'Preferences',
    keywords: ['theme', 'dark mode', 'light mode', 'colors', 'accent'],
    iconName: 'Palette',
    execute: (ctx) => {
      ctx.onToggleSettings?.('appearance')
    }
  },
  {
    id: 'preferences.openShortcuts',
    title: 'Preferences: Keyboard Shortcuts Manager',
    category: 'Preferences',
    shortcut: 'Ctrl + /',
    keywords: ['hotkeys', 'keybindings', 'shortcuts', 'keyboard'],
    iconName: 'Keyboard',
    execute: (ctx) => {
      ctx.onToggleSettings?.('shortcuts')
    }
  },
  {
    id: 'theme.toggleTheme',
    title: 'Theme: Toggle Light / Dark Theme',
    category: 'Theme',
    shortcut: 'Ctrl + T',
    keywords: ['switch theme', 'night mode', 'day mode', 'toggle theme'],
    iconName: 'SunMoon',
    execute: async () => {
      const current = useSettingsStore.getState().settings.theme || 'default'
      const next = current === 'dark' || current === 'default' ? 'light' : 'dark'
      await useSettingsStore.getState().updateSetting('theme', next)
    }
  },

  // --- Developer & System ---
  {
    id: 'developer.reloadWindow',
    title: 'Developer: Reload Lumina Window',
    category: 'Developer',
    shortcut: 'Ctrl + R',
    keywords: ['reload', 'refresh', 'reboot', 'restart ui'],
    iconName: 'RefreshCw',
    execute: () => {
      window.location.reload()
    }
  },
  {
    id: 'developer.toggleDevTools',
    title: 'Developer: Toggle Developer Tools',
    category: 'Developer',
    keywords: ['inspect element', 'console', 'debugger', 'devtools'],
    iconName: 'Code',
    execute: () => {
      const api = (window as any).api
      if (api && api.toggleDevTools) {
        api.toggleDevTools()
      }
    }
  },
  {
    id: 'application.documentation',
    title: 'Help: Open Lumina Documentation',
    category: 'Application',
    keywords: ['docs', 'help', 'guide', 'manual', 'learn'],
    iconName: 'Book',
    execute: (ctx) => {
      ctx.onToggleDocs?.()
    }
  },
  {
    id: 'window.close',
    title: 'Window: Close Window',
    category: 'Application',
    shortcut: 'Ctrl + Shift + W',
    keywords: [
      'windows close',
      'close window',
      'window close',
      'close windows',
      'close',
      'exit window',
      'dismiss window',
      'hide window'
    ],
    iconName: 'X',
    execute: () => {
      const winApi = (window as any).api
      if (winApi?.closeWindow) {
        winApi.closeWindow()
      } else {
        window.close()
      }
    }
  },
  {
    id: 'application.quit',
    title: 'Application: Close the App',
    category: 'Application',
    shortcut: 'Ctrl + Q',
    keywords: [
      'close the app',
      'close app',
      'quit app',
      'quit lumina',
      'exit app',
      'exit lumina',
      'quit',
      'exit',
      'close',
      'shutdown',
      'terminate',
      'kill'
    ],
    iconName: 'Power',
    execute: () => {
      const winApi = (window as any).api
      if (winApi?.quitApp) {
        winApi.quitApp()
      } else if (winApi?.closeWindow) {
        winApi.closeWindow()
      } else {
        window.close()
      }
    }
  }
]
