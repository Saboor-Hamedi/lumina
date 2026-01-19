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
  setTranslucency: vi.fn()
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
