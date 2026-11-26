import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import React from 'react'

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock @atomic-editor/editor for virtual/test environments
vi.mock('@atomic-editor/editor', () => ({
  AtomicCodeMirrorEditor: ({ markdownSource }: { markdownSource?: string }) =>
    React.createElement('div', { 'data-testid': 'atomic-editor' }, markdownSource),
  wikiLinks: () => [],
  inlinePreview: () => [],
  imageBlocks: () => [],
  tables: () => [],
  atomicEditorTheme: [],
  atomicMarkdownSyntax: [],
  autoCloseCodeFence: [],
  extendEmphasisPair: []
}))

// Mock window.api for Tauri
const g = globalThis as Record<string, unknown>
if (!g.window) {
  g.window = {}
}
const win = g.window as Window & Record<string, unknown>
const originalDispatchEvent = win.dispatchEvent ? win.dispatchEvent.bind(win) : () => true
win.dispatchEvent = vi.fn((event: Event) => originalDispatchEvent(event))
win.api = {
  getSnippets: vi.fn(),
  saveSnippet: vi.fn(),
  deleteSnippet: vi.fn(),
  confirmDelete: vi.fn(),
  closeWindow: vi.fn(),
  quitApp: vi.fn(),
  getSetting: vi.fn(),
  saveSetting: vi.fn(),
  setTranslucency: vi.fn(),
  searchVault: vi.fn(),
  indexVault: vi.fn(),
  getIndexStats: vi.fn(),
  sendChatMessage: vi.fn(),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  installUpdate: vi.fn(),
  logError: vi.fn()
}

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string): string | null => {
    return localStorageMock.store[key] || null
  }),
  setItem: vi.fn((key: string, value: string): void => {
    localStorageMock.store[key] = value
  }),
  removeItem: vi.fn((key: string): void => {
    delete localStorageMock.store[key]
  }),
  clear: vi.fn((): void => {
    localStorageMock.store = {}
  })
}
g.localStorage = localStorageMock

// Mock IndexedDB
g.indexedDB = {
  open: vi.fn()
}

// Mock crypto for UUID generation
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).slice(2, 11))
  }
})

// Shared Mock Worker instance
interface MockWorkerInstance {
  url: string | URL
  options: WorkerOptions | undefined
  postMessage: ReturnType<typeof vi.fn>
  onmessage: ((ev: MessageEvent) => unknown) | null
  terminate: ReturnType<typeof vi.fn>
}

const mockWorkerInstance: MockWorkerInstance = {
  url: '',
  options: {},
  postMessage: vi.fn(),
  onmessage: null,
  terminate: vi.fn()
}

// Mock Worker for AI store tests
g.Worker = vi.fn(function (url: string | URL, options?: WorkerOptions) {
  mockWorkerInstance.url = url
  mockWorkerInstance.options = options
  return mockWorkerInstance
})

// Also expose it on global so tests can access it easily without new Worker() if they want
g.__mockWorkerInstance = mockWorkerInstance

// Mock document.addEventListener/removeEventListener for keyboard shortcuts
const originalAddEventListener = document.addEventListener
const originalRemoveEventListener = document.removeEventListener
document.addEventListener = vi.fn(originalAddEventListener) as typeof document.addEventListener
document.removeEventListener = vi.fn(originalRemoveEventListener) as typeof document.removeEventListener

// Polyfill Range getClientRects and getBoundingClientRect for jsdom (used by CodeMirror)
if (typeof Range !== 'undefined') {
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  }
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect
  }
}

// Polyfill scrollIntoView on Element for jsdom
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn()
}
