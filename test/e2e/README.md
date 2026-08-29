# Lumina E2E Tests

End-to-end tests using [Playwright](https://playwright.dev/) that launch the **real Electron app** against an isolated temp vault — no mocks.

## Structure

```
test/e2e/
├── helpers/
│   └── launch.js          # App launcher + IPC helpers
├── app.e2e.test.js        # App launch, window, welcome page
├── vault.e2e.test.js      # Vault directory operations
├── note.e2e.test.js       # Note CRUD lifecycle (create/rename/delete)
└── README.md
```

## Running

> **The app must be built first.**

```bash
# Build once
npm run build

# Run all E2E tests
npm run test:e2e

# Debug a specific file (opens Playwright inspector)
npm run test:e2e:debug -- test/e2e/note.e2e.test.js

# Run everything (unit + E2E)
npm run test:all
```

## What's tested

| Suite | Tests |
|---|---|
| `app.e2e.test.js` | App launches · no JS errors · title bar · welcome page visible |
| `vault.e2e.test.js` | Temp vault writable · notes created · content persists · multi-note |
| `note.e2e.test.js` | Create · frontmatter preserved · rename (old deleted, new exists) · delete · bulk · timestamp sort |

## How it works

Each test:
1. Launches a fresh Electron process via `_electron` from `@playwright/test`
2. Points it at a unique `os.tmpdir()` vault so tests never touch your real notes
3. Asserts against the real window DOM **and** the real filesystem
4. Cleans up (kills process + deletes temp vault) in `afterEach`

## Artifacts on failure

Screenshots, videos, and traces are saved to `test/e2e/report/` when a test fails.
