import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock window.api for Electron
global.window = global.window || {}
global.window.api = {
  getSnippets: vi.fn(),
  saveSnippet: vi.fn(),
  deleteSnippet: vi.fn(),
  confirmDelete: vi.fn(),
  closeWindow: vi.fn(),
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
  getItem: vi.fn((key) => {
    return localStorageMock.store[key] || null
  }),
  setItem: vi.fn((key, value) => {
    localStorageMock.store[key] = value
  }),
  removeItem: vi.fn((key) => {
    delete localStorageMock.store[key]
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {}
  }),
  store: {}
}
global.localStorage = localStorageMock

// Mock IndexedDB
global.indexedDB = {
  open: vi.fn()
}

// Mock crypto for UUID generation
global.crypto = {
  randomUUID: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9))
}

// Mock Worker for AI store tests
global.Worker = class MockWorker {
  constructor(url, options) {
    this.url = url
    this.options = options
    this.postMessage = vi.fn()
    this.onmessage = null
    this.terminate = vi.fn()
  }
}

// Mock document.addEventListener/removeEventListener for keyboard shortcuts
const originalAddEventListener = document.addEventListener
const originalRemoveEventListener = document.removeEventListener
document.addEventListener = vi.fn(originalAddEventListener)
document.removeEventListener = vi.fn(originalRemoveEventListener)
