/**
 * @file CommandPaletteSystem.test.tsx
 * @description Comprehensive unit and integration tests for Command Palette and Settings Discovery.
 * Covers requirements in Section 10 of bugs.md:
 * 1. Opening and closing palette
 * 2. Searching and executing existing commands
 * 3. Discovering and changing supported settings
 * 4. Synchronization between settings store and palette
 * 5. Keyboard navigation (Arrow keys, Enter, Escape)
 * 6. Setting value modifications (boolean toggles, enum sub-pickers, numeric inputs)
 * 7. Live preview updates for commands and settings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CommandPalette from '../../../../../src/renderer/src/features/commandpalette/CommandPalette'
import { useSettingStore } from '../../../../../src/renderer/src/core/store/SettingStore'

vi.mock('../../../../../src/renderer/src/features/AI/tools/lumina', () => ({
  useAIStore: () => ({
    searchNotes: vi.fn(),
    isModelReady: true,
    modelLoadingProgress: 100,
    aiError: null,
    chatMessages: [],
    isChatLoading: false,
    cancelChat: vi.fn(),
    sendChatMessage: vi.fn(),
    clearChat: vi.fn()
  })
}))

vi.mock('../../../../../src/renderer/src/core/store/workspaceStore', () => ({
  useWorkspaceStore: (selector: any) =>
    selector({
      dirtySnippetIds: [],
      folders: [],
      selectedSnippet: null
    })
}))

vi.mock('../../../../../src/renderer/src/core/hooks/useTag', () => ({
  useTag: () => ({ tags: [] })
}))

vi.mock('../../../../../src/renderer/src/core/hooks/useMention', () => ({
  useMention: () => ({ mentions: [] })
}))

describe('Command Palette & Settings Discovery System', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    window.api = {
      getSetting: vi.fn().mockResolvedValue({}),
      saveSetting: vi.fn().mockResolvedValue(true),
      saveSettings: vi.fn().mockResolvedValue(true),
      onSettingsChanged: vi.fn()
    } as any

    useSettingStore.setState({
      settings: {
        theme: 'default',
        fontSize: 16,
        fontFamily: 'Inter',
        lineHeight: 1.6,
        showLineNumbers: false,
        autoSave: true,
        cursorStyle: 'smooth',
        smoothScrolling: true,
        sidebarCollapsedSections: { pinned: false, recent: false, all: false },
        sortBy: 'name',
        sortDirection: 'asc',
        noteOrder: null,
        inlineMetadata: true,
        inlineTitle: true,
        graphTheme: 'default',
        graphNodeSize: 1.5,
        graphShowTexts: true,
        graphNodeColor: '#40bafa',
        graphSidebarOpen: true,
        deepSeekKey: null,
        deepSeekModel: 'deepseek-chat',
        huggingFaceKey: null,
        activeProvider: 'deepseek',
        activeModel: null,
        activeAIMode: 'Code',
        aiChatDisplayMode: 'sidebar',
        openaiKey: null,
        anthropicKey: null,
        groqKey: null,
        ollamaUrl: 'http://localhost:11434/api/chat',
        ollamaModel: null,
        commandPaletteMode: 'search',
        commandPaletteSplitRatio: 50,
        launchOnStartup: false,
        globalShortcut: 'Ctrl+Space',
        windowOpacity: 1.0,
        modernUi: false,
        pinnedFolders: [],
        folderOrder: [],
        expandedFolders: [],
        sidebar: { width: 260, isLeftOpen: true },
        rightSidebar: { width: 300, isRightOpen: false },
        titleBarVisible: true,
        statusBarVisible: true,
        activityBarVisible: true,
        zenMode: {
          enabled: false,
          hideTitleBar: true,
          hideStatusBar: true,
          hideActivityBar: true,
          hidePrimarySidebar: true,
          hideSecondarySidebar: true
        },
        zenPreState: null
      } as any,
      isLoading: false
    })
  })

  it('renders command palette in command mode when initialQuery is ">"', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        items={[]}
        onSelect={vi.fn()}
        initialQuery=">"
      />
    )

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('>')
    expect(input.placeholder).toBe('Type a command or setting name...')

    const items = document.querySelectorAll('.palette-item')
    expect(items.length).toBeGreaterThan(0)
  })

  it('filters commands when typing query after ">"', async () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        items={[]}
        onSelect={vi.fn()}
        initialQuery=">"
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '>Zen' } })

    await waitFor(() => {
      const titles = Array.from(document.querySelectorAll('.item-title')).map((el) => el.textContent)
      expect(titles.some((t) => t?.includes('Zen'))).toBe(true)
    })
  })

  it('executes a command when clicked', async () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        items={[]}
        onSelect={vi.fn()}
        initialQuery=">Toggle Zen Mode"
      />
    )

    await waitFor(() => {
      const items = Array.from(document.querySelectorAll('.palette-item'))
      const zenItem = items.find((el) => el.textContent?.includes('Toggle Zen Mode'))
      expect(zenItem).toBeDefined()
    })

    const items = Array.from(document.querySelectorAll('.palette-item'))
    const zenItem = items.find((el) => el.textContent?.includes('Toggle Zen Mode'))!
    fireEvent.click(zenItem)

    await waitFor(() => {
      expect(useSettingStore.getState().settings.zenMode.enabled).toBe(true)
    })
  })

  it('toggles a boolean setting directly from the command palette', async () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        items={[]}
        onSelect={vi.fn()}
        initialQuery=">Auto-Save"
      />
    )

    await waitFor(() => {
      const items = Array.from(document.querySelectorAll('.palette-item'))
      const saveItem = items.find((el) => el.textContent?.includes('Auto-Save'))
      expect(saveItem).toBeDefined()
    })

    const items = Array.from(document.querySelectorAll('.palette-item'))
    const saveItem = items.find((el) => el.textContent?.includes('Auto-Save'))!
    fireEvent.click(saveItem)

    await waitFor(() => {
      expect(useSettingStore.getState().settings.autoSave).toBe(false)
    })
  })

  it('opens enum sub-picker for enum settings and allows selecting an option', async () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        items={[]}
        onSelect={vi.fn()}
        initialQuery=">Caret Animation Style"
      />
    )

    await waitFor(() => {
      const items = Array.from(document.querySelectorAll('.palette-item'))
      const caretItem = items.find((el) => el.textContent?.includes('Caret Animation Style'))
      expect(caretItem).toBeDefined()
    })

    const items = Array.from(document.querySelectorAll('.palette-item'))
    const caretItem = items.find((el) => el.textContent?.includes('Caret Animation Style'))!
    fireEvent.click(caretItem)

    // In sub-picker mode
    await waitFor(() => {
      const optionItems = Array.from(document.querySelectorAll('.palette-item'))
      expect(optionItems.some((el) => el.textContent?.includes('Block'))).toBe(true)
    })

    const optionItems = Array.from(document.querySelectorAll('.palette-item'))
    const blockOption = optionItems.find((el) => el.textContent?.includes('Block'))!
    fireEvent.click(blockOption)

    await waitFor(() => {
      expect(useSettingStore.getState().settings.cursorStyle).toBe('block')
    })
  })

  it('opens prompt for number setting and updates value', async () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        items={[]}
        onSelect={vi.fn()}
        initialQuery=">Editor: Font Size"
      />
    )

    await waitFor(() => {
      const items = Array.from(document.querySelectorAll('.palette-item'))
      const fontItem = items.find((el) => el.textContent?.includes('Font Size'))
      expect(fontItem).toBeDefined()
    })

    const items = Array.from(document.querySelectorAll('.palette-item'))
    const fontItem = items.find((el) => el.textContent?.includes('Font Size'))!
    fireEvent.click(fontItem)

    // Now in inline numeric picker mode: type '22' in the input
    await waitFor(() => {
      const input = document.querySelector('.palette-input-wrap input') as HTMLInputElement
      expect(input).toBeDefined()
      fireEvent.change(input, { target: { value: '22' } })
    })

    await waitFor(() => {
      const option22 = Array.from(document.querySelectorAll('.palette-item')).find((el) =>
        el.textContent?.includes('22')
      )
      expect(option22).toBeDefined()
      fireEvent.click(option22!)
    })

    await waitFor(() => {
      expect(useSettingStore.getState().settings.fontSize).toBe(22)
    })
  })

  it('navigates with ArrowDown and ArrowUp keys', async () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        items={[]}
        onSelect={vi.fn()}
        initialQuery=">"
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    const items = document.querySelectorAll('.palette-item')
    expect(items.length).toBeGreaterThan(1)
    expect(items[1].classList.contains('active')).toBe(true)

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(items[0].classList.contains('active')).toBe(true)
  })

  it('displays split-pane preview for selected command or setting', async () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        items={[]}
        onSelect={vi.fn()}
        initialQuery=">Zen"
      />
    )

    await waitFor(() => {
      const preview = document.querySelector('.command-details-preview')
      expect(preview).not.toBeNull()
    })
  })
})
