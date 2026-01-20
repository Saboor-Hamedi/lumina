# Lumina Testing Guide

This document contains all testing commands and information for the Lumina project.

## Test Commands

### Run Tests

```bash
# Run tests in watch mode (default)
npm test

# Run tests once and exit
npm run test:run

# Run tests with UI (interactive)
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Run Specific Tests

```bash
# Run a specific test file
npm test -- src/renderer/src/components/atoms/Button.test.jsx

# Run tests matching a pattern
npm test -- --grep "Button"

# Run tests in a specific directory
npm test -- src/renderer/src/core/store/

# Run only tests that match a pattern
npm test -- -t "useVaultStore"
```

### Test Options

```bash
# Run tests in verbose mode
npm test -- --reporter=verbose

# Run tests with coverage and show detailed output
npm run test:coverage -- --reporter=verbose

# Run tests and update snapshots
npm test -- -u

# Run tests in a specific environment
npm test -- --environment=jsdom

# Run tests with specific timeout
npm test -- --testTimeout=10000
```

## Test Structure

### Test Files Location

All test files follow the naming convention `*.test.js` or `*.test.jsx` and are located next to their source files:

```
src/
├── renderer/
│   └── src/
│       ├── components/
│       │   └── atoms/
│       │       ├── Button.jsx
│       │       └── Button.test.jsx
│       └── core/
│           ├── hooks/
│           │   ├── useTheme.js
│           │   ├── useTheme.test.jsx
│           │   ├── stringUtils.js
│           │   └── stringUtils.test.js
│           ├── store/
│           │   ├── useVaultStore.js
│           │   ├── useVaultStore.test.js
│           │   ├── useSettingsStore.js
│           │   └── useSettingsStore.test.js
│           └── utils/
│               ├── graphBuilder.js
│               └── graphBuilder.test.js
└── main/
    ├── VaultManager.js
    ├── VaultManager.test.js
    ├── VaultSearch.js
    └── VaultSearch.test.js
```

## Test Coverage

### Current Test Coverage

- **Components**: Button component (6 tests)
- **Hooks**: useTheme, stringUtils (12 tests)
- **Stores**: useVaultStore, useSettingsStore (27 tests)
- **Utils**: graphBuilder (13 tests)
- **Main Process**: VaultManager, VaultSearch (35 tests)

**Total: 93 tests across 8 test files**

### View Coverage Report

```bash
# Generate coverage report
npm run test:coverage

# Coverage report will be available at:
# coverage/index.html
```

## Test Configuration

### Configuration File

The test configuration is in `vitest.config.mjs`:

- **Environment**: jsdom (for React component testing)
- **Setup File**: `src/test/setup.js`
- **Globals**: Enabled (no need to import `describe`, `it`, `expect`)
- **Coverage Provider**: v8

### Setup File

The setup file (`src/test/setup.js`) includes:
- React Testing Library cleanup
- Jest-DOM matchers
- Electron API mocks
- localStorage mocks
- IndexedDB mocks

## Writing Tests

### Component Test Example

```javascript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button Component', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })
})
```

### Store Test Example

```javascript
import { describe, it, expect, beforeEach } from 'vitest'
import { useVaultStore } from './useVaultStore'

describe('useVaultStore', () => {
  beforeEach(() => {
    useVaultStore.setState({
      snippets: [],
      selectedSnippet: null
    })
  })

  it('sets snippets', () => {
    const snippets = [{ id: '1', title: 'Test' }]
    useVaultStore.getState().setSnippets(snippets)
    expect(useVaultStore.getState().snippets).toEqual(snippets)
  })
})
```

### Hook Test Example

```javascript
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('initializes with default theme', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
  })
})
```

## Performance Workbench

### Run Performance Workbench

```bash
# Run performance workbench
npm run workbench
```

The workbench measures:
- File operations (create, read, write, delete)
- JSON operations (stringify, parse)
- Search operations (filter, sort)
- Store operations (set, find, update)
- Component operations (map, filter, reduce)
- Markdown operations (parse, extract)

## Debugging Tests

### Debug Failed Tests

```bash
# Run tests and stop on first failure
npm test -- --bail

# Run tests with detailed error output
npm test -- --reporter=verbose

# Run a specific failing test
npm test -- src/renderer/src/components/atoms/Button.test.jsx
```

### Watch Mode

```bash
# Run tests in watch mode (default)
npm test

# Watch specific file
npm test -- src/renderer/src/components/atoms/Button.test.jsx

# Watch and run only changed tests
npm test -- --changed
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:run
      - run: npm run test:coverage
```

## Common Test Patterns

### Mocking Electron APIs

```javascript
import { vi } from 'vitest'

// Mock window.api
global.window.api = {
  getSnippets: vi.fn(() => Promise.resolve([])),
  saveSnippet: vi.fn(() => Promise.resolve(true))
}
```

### Mocking Modules

```javascript
import { vi } from 'vitest'

// Mock a module
vi.mock('../db/cache', () => ({
  cacheSnippets: vi.fn(() => Promise.resolve()),
  getCachedSnippets: vi.fn(() => Promise.resolve([]))
}))
```

### Testing Async Operations

```javascript
it('handles async operations', async () => {
  const result = await someAsyncFunction()
  expect(result).toBeDefined()
})
```

### Testing User Interactions

```javascript
import userEvent from '@testing-library/user-event'

it('handles click events', async () => {
  const user = userEvent.setup()
  render(<Button onClick={handleClick}>Click</Button>)
  
  await user.click(screen.getByText('Click'))
  expect(handleClick).toHaveBeenCalled()
})
```

## Troubleshooting

### Tests Not Running

1. Check if Vitest is installed: `npm list vitest`
2. Verify configuration: Check `vitest.config.mjs`
3. Clear cache: `npm test -- --no-cache`

### Import Errors

1. Check file paths are correct
2. Verify aliases in `vitest.config.mjs`
3. Ensure CSS files exist or are mocked

### Coverage Issues

1. Check coverage configuration in `vitest.config.mjs`
2. Verify files aren't excluded unnecessarily
3. Run with verbose output: `npm run test:coverage -- --reporter=verbose`

## Best Practices

1. **Write tests before or alongside code** (TDD approach)
2. **Keep tests isolated** - Each test should be independent
3. **Use descriptive test names** - "should do X when Y"
4. **Mock external dependencies** - Don't test third-party libraries
5. **Test behavior, not implementation** - Focus on what, not how
6. **Keep tests simple** - One assertion per test when possible
7. **Clean up after tests** - Use `beforeEach` and `afterEach`
8. **Maintain high coverage** - Aim for >80% coverage

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Jest-DOM Matchers](https://github.com/testing-library/jest-dom)
- [User Event](https://testing-library.com/docs/user-event/intro/)
