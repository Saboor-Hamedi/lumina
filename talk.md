[DB] Open failed: IndexedDB API missing. Please visit https://tinyurl.com/y2uuvskb

stderr | test/renderer/src/features/AI/LuminaChat.test.js > useAIStore > chat functionality > should clear chat messages
[AIStore] Failed to save chat history to db, falling back to localStorage: [DexieError [MissingAPIError]: IndexedDB API missing. Please visit https://tinyurl.com/y2uuvskb] {
  inner: null
}

 ✓ test/renderer/src/features/AI/LuminaChat.test.js (10 tests) 621ms
       ✓ should check for missing API key  404ms
 ✓ test/renderer/src/core/notification/ToastNotification.test.jsx (6 tests) 251ms
 ✓ test/renderer/src/components/atoms/Button.test.jsx (6 tests) 341ms
stderr | test/renderer/src/core/hooks/useTheme.test.jsx > useTheme > falls back to dark theme if invalid theme provided
Theme "invalid_theme" not found, using "dark"

 ✓ test/renderer/src/core/hooks/useTheme.test.jsx (6 tests) 160ms
stderr | test/renderer/src/core/store/useSettingsStore.test.js > useSettingsStore > updateSetting > handles IPC errors gracefully
Failed to save setting fontSize: Error: IPC error
    at B:/electron/lumina/test/renderer/src/core/store/useSettingsStore.test.js:98:55
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:145:11
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:915:26
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1243:20
    at new Promise (<anonymous>)
    at runWithTimeout (file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1209:10)
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1653:37
    at Traces.$ (file:///B:/electron/lumina/node_modules/vitest/dist/chunks/traces.CCmnQaNT.js:142:27)
    at trace (file:///B:/electron/lumina/node_modules/vitest/dist/chunks/test.B8ej_ZHS.js:239:21)
    at runTest (file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1653:12)

 ✓ test/renderer/src/core/store/useVaultStore.test.js (16 tests) 33ms
stderr | test/renderer/src/core/store/useSettingsStore.test.js > useSettingsStore > init > retries on failure
Failed to load settings: Error: First attempt fails
    at B:/electron/lumina/test/renderer/src/core/store/useSettingsStore.test.js:153:32
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:145:11
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:915:26
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1243:20
    at new Promise (<anonymous>)
    at runWithTimeout (file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1209:10)
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1653:37
    at Traces.$ (file:///B:/electron/lumina/node_modules/vitest/dist/chunks/traces.CCmnQaNT.js:142:27)
    at trace (file:///B:/electron/lumina/node_modules/vitest/dist/chunks/test.B8ej_ZHS.js:239:21)
    at runTest (file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1653:12)

 ✓ test/renderer/src/core/store/useSettingsStore.test.js (11 tests) 68ms
 ✓ test/renderer/src/core/store/useUpdateStore.test.js (9 tests) 96ms
 ✓ test/renderer/src/core/utils/graphBuilder.test.js (13 tests) 27ms
 ✓ test/renderer/src/core/hooks/stringUtils.test.js (6 tests) 10ms

 Test Files  12 passed (12)
      Tests  117 passed (117)
   Start at  11:50:15
   Duration  9.36s (transform 2.95s, setup 10.29s, import 4.93s, tests 2.47s, environment 29.57s)

 PASS  Waiting for file changes...