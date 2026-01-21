# Test Suite Documentation

## Running Tests

### Basic Commands

```bash
# Run all tests in watch mode (default)
npm test

# Run all tests once
npm run test:run

# Run tests with coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui

# Run tests in watch mode explicitly
npm run test:watch
```

## Test Coverage

The test suite includes:

### Main Process Tests
- **IPC Handlers** (`src/main/index.test.js`)
  - Settings IPC handlers
  - Window management handlers
  - Vault operations handlers
  - Dialog handlers

- **SettingsManager** (`src/main/SettingsManager.test.js`)
  - Initialization
  - Get/Set operations
  - File watching
  - Renderer notifications

- **VaultManager** (`src/main/VaultManager.test.js`) - Existing
- **VaultSearch** (`src/main/VaultSearch.test.js`) - Existing

### Renderer Process Tests

#### Components
- **ErrorBoundary** (`src/renderer/src/components/ErrorBoundary.test.jsx`)
  - Error catching and display
  - Error logging
  - Reset and reload functionality

- **ToastNotification** (`src/renderer/src/core/utils/ToastNotification.test.jsx`)
  - Toast rendering (success, error, info)
  - Exit animations
  - Icon display

- **Button** (`src/renderer/src/components/atoms/Button.test.jsx`) - Existing

#### Hooks
- **useToast** (`src/renderer/src/core/hooks/useToast.test.js`)
  - Toast state management
  - Auto-dismiss functionality
  - Toast replacement

- **useKeyboardShortcuts** (`src/renderer/src/core/hooks/useKeyboardShortcuts.test.js`)
  - Keyboard event handling
  - Shortcut registration
  - Cleanup on unmount

- **useTheme** (`src/renderer/src/core/hooks/useTheme.test.jsx`) - Existing
- **stringUtils** (`src/renderer/src/core/hooks/stringUtils.test.js`) - Existing

#### Stores (Zustand)
- **useAIStore** (`src/renderer/src/core/store/useAIStore.test.js`)
  - Embedding generation
  - Vault search
  - Chat functionality
  - Model loading progress

- **useUpdateStore** (`src/renderer/src/core/store/useUpdateStore.test.js`)
  - Update status management
  - Event handling
  - Update actions

- **useSettingsStore** (`src/renderer/src/core/store/useSettingsStore.test.js`) - Existing
- **useVaultStore** (`src/renderer/src/core/store/useVaultStore.test.js`) - Existing

#### Utilities
- **graphBuilder** (`src/renderer/src/core/utils/graphBuilder.test.js`) - Existing
- **fileIconMapper** (`src/renderer/src/core/utils/fileIconMapper.test.jsx`)
  - File type detection
  - Icon mapping

## Coverage Configuration

Coverage is configured in `vitest.config.mjs`:

- **Provider**: v8
- **Reporters**: text, json, html
- **Exclusions**:
  - `node_modules/`
  - `src/test/`
  - Config files
  - Index files
  - Type definitions

## Test Setup

All tests use the setup file at `src/test/setup.js` which provides:

- React Testing Library cleanup
- Jest-DOM matchers
- Electron `window.api` mocks
- localStorage mocks
- IndexedDB mocks
- Worker mocks
- Crypto mocks
- Event listener mocks

## Writing New Tests

When adding new tests:

1. Place test files next to the source file with `.test.js` or `.test.jsx` extension
2. Use Vitest and React Testing Library
3. Follow existing test patterns
4. Mock external dependencies (IPC, Workers, etc.)
5. Test both success and error cases
6. Include cleanup in `afterEach` hooks

## Example Test Structure

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMyHook } from './useMyHook'

describe('useMyHook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should do something', () => {
    const { result } = renderHook(() => useMyHook())
    // Test implementation
  })
})
```
