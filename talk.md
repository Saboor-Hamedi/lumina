npm run test

> lumina@1.0.26 test
> vitest


 DEV  v4.0.17 B:/electron/lumina

stdout | test/main/VaultSearch.test.js > VaultSearch > loadIndex > loads index from file
[VaultSearch] ✓ Initialized (embedder deferred)

stdout | test/main/VaultSearch.test.js > VaultSearch > loadIndex > loads index from file
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > loadIndex > loads index from file
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > loadIndex > handles missing index file
[VaultSearch] ✓ Initialized (embedder deferred)

stderr | test/main/VaultSearch.test.js > VaultSearch > loadIndex > handles missing index file
[VaultSearch] Index file not found

stderr | test/main/VaultSearch.test.js > VaultSearch > loadIndex > handles missing index file
[VaultSearch] Index file not found

stdout | test/main/VaultSearch.test.js > VaultSearch > loadIndex > loads embeddings buffer if exists
[VaultSearch] ✓ Initialized (embedder deferred)

stdout | test/main/VaultSearch.test.js > VaultSearch > loadIndex > loads embeddings buffer if exists
[VaultSearch] ✓ Loaded 1 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > loadIndex > loads embeddings buffer if exists
[VaultSearch] ✓ Loaded 1 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > getChunkEmbedding > extracts embedding from buffer
[VaultSearch] ✓ Initialized (embedder deferred)

stdout | test/main/VaultSearch.test.js > VaultSearch > getChunkEmbedding > extracts embedding from buffer
[VaultSearch] ✓ Loaded 1 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > getChunkEmbedding > extracts embedding from buffer
[VaultSearch] ✓ Loaded 1 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > getChunkEmbedding > returns null if no buffer
[VaultSearch] ✓ Initialized (embedder deferred)

stderr | test/main/VaultSearch.test.js > VaultSearch > getChunkEmbedding > returns null if no buffer
[VaultSearch] Index file not found

stderr | test/main/VaultSearch.test.js > VaultSearch > getChunkEmbedding > returns null if no buffer
[VaultSearch] Index file not found

stdout | test/main/VaultSearch.test.js > VaultSearch > getChunkEmbedding > returns null if offset out of bounds
[VaultSearch] ✓ Initialized (embedder deferred)

stdout | test/main/VaultSearch.test.js > VaultSearch > getChunkEmbedding > returns null if offset out of bounds
[VaultSearch] ✓ Loaded 1 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > getChunkEmbedding > returns null if offset out of bounds
[VaultSearch] ✓ Loaded 1 chunks into memory

stderr | test/main/VaultSearch.test.js > VaultSearch > getChunkEmbedding > returns null if offset out of bounds
[VaultSearch] Chunk embedding out of bounds: offset=10000, required=11536, buffer=1000

stdout | test/main/VaultSearch.test.js > VaultSearch > search > returns empty array if not loaded
[VaultSearch] ✓ Initialized (embedder deferred)

stdout | test/main/VaultSearch.test.js > VaultSearch > search > returns empty array if not loaded
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > search > returns empty array if not loaded
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > search > filters by filePath
[VaultSearch] ✓ Initialized (embedder deferred)

stdout | test/main/VaultSearch.test.js > VaultSearch > search > filters by filePath
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > search > filters by filePath
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > search > filters by filePath
[VaultSearch] Lazy-loading embedder model...

stdout | test/main/VaultSearch.test.js > VaultSearch > search > filters by filePath
[VaultSearch] ✓ Embedder initialized

stdout | test/main/VaultSearch.test.js > VaultSearch > search > filters by fileType
[VaultSearch] ✓ Initialized (embedder deferred)

stdout | test/main/VaultSearch.test.js > VaultSearch > search > filters by fileType
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > search > filters by fileType
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > search > filters by type
[VaultSearch] ✓ Initialized (embedder deferred)

stdout | test/main/VaultManager.test.js > VaultManager > saveSnippet > saves snippet to file
[VaultManager] Saving snippet: Save Test ID: save-test
[VaultManager] Original title: Save Test -> Cleaned: Save Test

stdout | test/main/VaultSearch.test.js > VaultSearch > search > filters by type
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultManager.test.js > VaultManager > saveSnippet > saves snippet to file
[VaultManager] ✓ File saved at: C:\Users\Saboor\AppData\Local\Temp\lumina-test-1784697712291\Save Test.md

stdout | test/main/VaultSearch.test.js > VaultSearch > search > filters by type
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > search > applies threshold
[VaultSearch] ✓ Initialized (embedder deferred)

stdout | test/main/VaultManager.test.js > VaultManager > deleteSnippet > deletes snippet file
[VaultManager] Saving snippet: Delete Test ID: delete-test
[VaultManager] Original title: Delete Test -> Cleaned: Delete Test

stdout | test/main/VaultSearch.test.js > VaultSearch > search > applies threshold
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultManager.test.js > VaultManager > deleteSnippet > deletes snippet file
[VaultManager] ✓ File saved at: C:\Users\Saboor\AppData\Local\Temp\lumina-test-1784697712322\Delete Test.md

stdout | test/main/VaultSearch.test.js > VaultSearch > search > applies threshold
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultManager.test.js > VaultManager > deleteSnippet > deletes snippet file
[VaultManager] ✓ File deleted: C:\Users\Saboor\AppData\Local\Temp\lumina-test-1784697712322\Delete Test.md

stdout | test/main/VaultManager.test.js > VaultManager > getSnippets > returns sorted snippets by timestamp
[VaultManager] Saving snippet: First ID: 1
[VaultManager] Original title: First -> Cleaned: First

stdout | test/main/VaultSearch.test.js > VaultSearch > search > respects limit
[VaultSearch] ✓ Initialized (embedder deferred)

stdout | test/main/VaultManager.test.js > VaultManager > getSnippets > returns sorted snippets by timestamp
[VaultManager] ✓ File saved at: C:\Users\Saboor\AppData\Local\Temp\lumina-test-1784697712338\First.md

stdout | test/main/VaultSearch.test.js > VaultSearch > search > respects limit
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultManager.test.js > VaultManager > getSnippets > returns sorted snippets by timestamp
[VaultManager] Saving snippet: Second ID: 2
[VaultManager] Original title: Second -> Cleaned: Second

stdout | test/main/VaultSearch.test.js > VaultSearch > search > respects limit
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultManager.test.js > VaultManager > getSnippets > returns sorted snippets by timestamp
[VaultManager] ✓ File saved at: C:\Users\Saboor\AppData\Local\Temp\lumina-test-1784697712338\Second.md

stdout | test/main/VaultSearch.test.js > VaultSearch > search > sorts results by score
[VaultSearch] ✓ Initialized (embedder deferred)

stdout | test/main/VaultSearch.test.js > VaultSearch > search > sorts results by score
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > search > sorts results by score
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > search > caches query results
[VaultSearch] ✓ Initialized (embedder deferred)

stdout | test/main/VaultSearch.test.js > VaultSearch > search > caches query results
[VaultSearch] ✓ Loaded 2 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > search > caches query results
[VaultSearch] ✓ Loaded 2 chunks into memory

 ✓ test/main/VaultManager.test.js (7 tests) 249ms
stdout | test/main/VaultSearch.test.js > VaultSearch > getStats > returns stats for loaded index
[VaultSearch] ✓ Initialized (embedder deferred)

stdout | test/main/VaultSearch.test.js > VaultSearch > getStats > returns stats for loaded index
[VaultSearch] ✓ Loaded 3 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > getStats > returns stats for loaded index
[VaultSearch] ✓ Loaded 3 chunks into memory

stdout | test/main/VaultSearch.test.js > VaultSearch > clearCache > clears query cache
[VaultSearch] ✓ Initialized (embedder deferred)

stderr | test/main/VaultSearch.test.js > VaultSearch > clearCache > clears query cache
[VaultSearch] Index file not found

stderr | test/main/VaultSearch.test.js > VaultSearch > clearCache > clears query cache
[VaultSearch] Index file not found

 ✓ test/main/VaultSearch.test.js (21 tests) 570ms
 ✓ test/renderer/src/core/notification/ToastNotification.test.jsx (6 tests) 131ms
 ✓ test/renderer/src/components/IndexingStatus.test.jsx (9 tests) 187ms
 ✓ test/renderer/src/components/atoms/Button.test.jsx (6 tests) 239ms
stderr | test/renderer/src/components/ErrorBoundary.test.jsx > ErrorBoundary > renders fallback UI on error
Error: Test error
    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:8:9)
    at Object.react_stack_bottom_frame (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:25904:20)
    at renderWithHooks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7662:22)
    at updateFunctionComponent (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:10166:19)
    at beginWork (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:11778:18)
    at runWithFiberInDEV (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:874:13)
    at performUnitOfWork (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17641:22)
    at workLoopSync (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17469:41)
    at renderRootSync (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17450:11)
    at performWorkOnRoot (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:16583:35) {
  [stack]: [Getter/Setter],
  [message]: 'Test error'
}

The above error occurred in the <BadChild> component.

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.

[ErrorBoundary] Caught error: {
  message: 'Test error',
  stack: 'Error: Test error\n' +
    '    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:8:9)\n' +
    '    at Object.react_stack_bottom_frame (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:25904:20)\n' +
    '    at renderWithHooks (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:7662:22)\n' +
    '    at updateFunctionComponent (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:10166:19)\n' +
    '    at beginWork (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:11778:18)\n' +
    '    at runWithFiberInDEV (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:874:13)\n' +
    '    at performUnitOfWork (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17641:22)\n' +
    '    at workLoopSync (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17469:41)\n' +
    '    at renderRootSync (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17450:11)\n' +
    '    at performWorkOnRoot (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:16583:35)',
  componentStack: '\n' +
    '    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:17:9)\n' +
    '    at ErrorBoundary (B:/electron/lumina/src/renderer/src/components/ErrorBoundary.jsx:10:5)',
  errorId: 'error-1784697712813-lmrb4em4x'
}
[ErrorBoundary] Failed to log error to main process: TypeError: Cannot read properties of undefined (reading 'catch')
    at ErrorBoundary.componentDidCatch (B:/electron/lumina/src/renderer/src/components/ErrorBoundary.jsx:57:12)
    at Object.react_stack_bottom_frame (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:25959:20)
    at ErrorBoundary.inst.componentDidCatch.update.callback (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:9504:11)
    at callCallback (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7423:16)
    at commitCallbacks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7443:11)
    at runWithFiberInDEV (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:874:13)
    at commitClassCallbacks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:13377:11)
    at commitLayoutEffectOnFiber (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:14026:25)
    at recursivelyTraverseLayoutEffects (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:15159:11)
    at commitLayoutEffectOnFiber (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:14031:11)

stderr | test/renderer/src/components/ErrorBoundary.test.jsx > ErrorBoundary > renders Try Again and Reload App buttons on error
Error: Test error
    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:8:9)
    at Object.react_stack_bottom_frame (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:25904:20)
    at renderWithHooks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7662:22)
    at updateFunctionComponent (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:10166:19)
    at beginWork (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:11778:18)
    at runWithFiberInDEV (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:874:13)
    at performUnitOfWork (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17641:22)
    at workLoopSync (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17469:41)
    at renderRootSync (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17450:11)
    at performWorkOnRoot (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:16583:35) {
  [stack]: [Getter/Setter],
  [message]: 'Test error'
}

The above error occurred in the <BadChild> component.

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.

[ErrorBoundary] Caught error: {
  message: 'Test error',
  stack: 'Error: Test error\n' +
    '    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:8:9)\n' +
    '    at Object.react_stack_bottom_frame (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:25904:20)\n' +
    '    at renderWithHooks (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:7662:22)\n' +
    '    at updateFunctionComponent (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:10166:19)\n' +
    '    at beginWork (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:11778:18)\n' +
    '    at runWithFiberInDEV (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:874:13)\n' +
    '    at performUnitOfWork (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17641:22)\n' +
    '    at workLoopSync (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17469:41)\n' +
    '    at renderRootSync (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17450:11)\n' +
    '    at performWorkOnRoot (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:16583:35)',
  componentStack: '\n' +
    '    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:17:9)\n' +
    '    at ErrorBoundary (B:/electron/lumina/src/renderer/src/components/ErrorBoundary.jsx:10:5)',
  errorId: 'error-1784697712857-0y8oydcvr'
}
[ErrorBoundary] Failed to log error to main process: TypeError: Cannot read properties of undefined (reading 'catch')
    at ErrorBoundary.componentDidCatch (B:/electron/lumina/src/renderer/src/components/ErrorBoundary.jsx:57:12)
    at Object.react_stack_bottom_frame (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:25959:20)
    at ErrorBoundary.inst.componentDidCatch.update.callback (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:9504:11)
    at callCallback (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7423:16)
    at commitCallbacks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7443:11)
    at runWithFiberInDEV (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:874:13)
    at commitClassCallbacks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:13377:11)
    at commitLayoutEffectOnFiber (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:14026:25)
    at recursivelyTraverseLayoutEffects (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:15159:11)
    at commitLayoutEffectOnFiber (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:14031:11)

stderr | test/renderer/src/components/ErrorBoundary.test.jsx > ErrorBoundary > calls custom fallback when provided
Error: Test error
    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:8:9)
    at Object.react_stack_bottom_frame (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:25904:20)
    at renderWithHooks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7662:22)
    at updateFunctionComponent (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:10166:19)
    at beginWork (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:11778:18)
    at runWithFiberInDEV (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:874:13)
    at performUnitOfWork (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17641:22)
    at workLoopSync (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17469:41)
    at renderRootSync (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17450:11)
    at performWorkOnRoot (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:16583:35) {
  [stack]: [Getter/Setter],
  [message]: 'Test error'
}

The above error occurred in the <BadChild> component.

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.

[ErrorBoundary] Caught error: {
  message: 'Test error',
  stack: 'Error: Test error\n' +
    '    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:8:9)\n' +
    '    at Object.react_stack_bottom_frame (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:25904:20)\n' +
    '    at renderWithHooks (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:7662:22)\n' +
    '    at updateFunctionComponent (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:10166:19)\n' +
    '    at beginWork (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:11778:18)\n' +
    '    at runWithFiberInDEV (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:874:13)\n' +
    '    at performUnitOfWork (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17641:22)\n' +
    '    at workLoopSync (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17469:41)\n' +
    '    at renderRootSync (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17450:11)\n' +
    '    at performWorkOnRoot (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:16583:35)',
  componentStack: '\n' +
    '    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:17:9)\n' +
    '    at ErrorBoundary (B:/electron/lumina/src/renderer/src/components/ErrorBoundary.jsx:10:5)',
  errorId: 'error-1784697712871-er6csww2w'
}
[ErrorBoundary] Failed to log error to main process: TypeError: Cannot read properties of undefined (reading 'catch')
    at ErrorBoundary.componentDidCatch (B:/electron/lumina/src/renderer/src/components/ErrorBoundary.jsx:57:12)
    at Object.react_stack_bottom_frame (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:25959:20)
    at ErrorBoundary.inst.componentDidCatch.update.callback (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:9504:11)
    at callCallback (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7423:16)
    at commitCallbacks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7443:11)
    at runWithFiberInDEV (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:874:13)
    at commitClassCallbacks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:13377:11)
    at commitLayoutEffectOnFiber (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:14026:25)
    at recursivelyTraverseLayoutEffects (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:15159:11)
    at commitLayoutEffectOnFiber (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:14031:11)

stderr | test/renderer/src/components/ErrorBoundary.test.jsx > ErrorBoundary > calls onReset when Try Again is clicked
Error: Test error
    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:8:9)
    at Object.react_stack_bottom_frame (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:25904:20)
    at renderWithHooks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7662:22)
    at updateFunctionComponent (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:10166:19)
    at beginWork (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:11778:18)
    at runWithFiberInDEV (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:874:13)
    at performUnitOfWork (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17641:22)
    at workLoopSync (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17469:41)
    at renderRootSync (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17450:11)
    at performWorkOnRoot (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:16583:35) {
  [stack]: [Getter/Setter],
  [message]: 'Test error'
}

The above error occurred in the <BadChild> component.

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.

[ErrorBoundary] Caught error: {
  message: 'Test error',
  stack: 'Error: Test error\n' +
    '    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:8:9)\n' +
    '    at Object.react_stack_bottom_frame (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:25904:20)\n' +
    '    at renderWithHooks (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:7662:22)\n' +
    '    at updateFunctionComponent (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:10166:19)\n' +
    '    at beginWork (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:11778:18)\n' +
    '    at runWithFiberInDEV (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:874:13)\n' +
    '    at performUnitOfWork (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17641:22)\n' +
    '    at workLoopSync (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17469:41)\n' +
    '    at renderRootSync (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17450:11)\n' +
    '    at performWorkOnRoot (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:16583:35)',
  componentStack: '\n' +
    '    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:17:9)\n' +
    '    at ErrorBoundary (B:/electron/lumina/src/renderer/src/components/ErrorBoundary.jsx:10:5)',
  errorId: 'error-1784697712895-1x85dcf5s'
}
[ErrorBoundary] Failed to log error to main process: TypeError: Cannot read properties of undefined (reading 'catch')
    at ErrorBoundary.componentDidCatch (B:/electron/lumina/src/renderer/src/components/ErrorBoundary.jsx:57:12)
    at Object.react_stack_bottom_frame (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:25959:20)
    at ErrorBoundary.inst.componentDidCatch.update.callback (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:9504:11)
    at callCallback (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7423:16)
    at commitCallbacks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7443:11)
    at runWithFiberInDEV (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:874:13)
    at commitClassCallbacks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:13377:11)
    at commitLayoutEffectOnFiber (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:14026:25)
    at recursivelyTraverseLayoutEffects (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:15159:11)
    at commitLayoutEffectOnFiber (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:14031:11)

stderr | test/renderer/src/components/ErrorBoundary.test.jsx > ErrorBoundary > calls onReset when Try Again is clicked
Error: Test error
    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:8:9)
    at Object.react_stack_bottom_frame (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:25904:20)
    at renderWithHooks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7662:22)
    at updateFunctionComponent (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:10166:19)
    at beginWork (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:11778:18)
    at runWithFiberInDEV (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:874:13)
    at performUnitOfWork (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17641:22)
    at workLoopSync (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17469:41)
    at renderRootSync (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17450:11)
    at performWorkOnRoot (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:16583:35) {
  [stack]: [Getter/Setter],
  [message]: 'Test error'
}

The above error occurred in the <BadChild> component.

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.

[ErrorBoundary] Caught error: {
  message: 'Test error',
  stack: 'Error: Test error\n' +
    '    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:8:9)\n' +
    '    at Object.react_stack_bottom_frame (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:25904:20)\n' +
    '    at renderWithHooks (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:7662:22)\n' +
    '    at updateFunctionComponent (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:10166:19)\n' +
    '    at beginWork (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:11778:18)\n' +
    '    at runWithFiberInDEV (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:874:13)\n' +
    '    at performUnitOfWork (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17641:22)\n' +
    '    at workLoopSync (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17469:41)\n' +
    '    at renderRootSync (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17450:11)\n' +
    '    at performWorkOnRoot (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:16583:35)',
  componentStack: '\n' +
    '    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:17:9)\n' +
    '    at ErrorBoundary (B:/electron/lumina/src/renderer/src/components/ErrorBoundary.jsx:10:5)',
  errorId: 'error-1784697713150-exwiwvc8z'
}
[ErrorBoundary] Failed to log error to main process: TypeError: Cannot read properties of undefined (reading 'catch')
    at ErrorBoundary.componentDidCatch (B:/electron/lumina/src/renderer/src/components/ErrorBoundary.jsx:57:12)
    at Object.react_stack_bottom_frame (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:25959:20)
    at ErrorBoundary.inst.componentDidCatch.update.callback (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:9504:11)
    at callCallback (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7423:16)
    at commitCallbacks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7443:11)
    at runWithFiberInDEV (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:874:13)
    at commitClassCallbacks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:13377:11)
    at commitLayoutEffectOnFiber (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:14026:25)
    at recursivelyTraverseLayoutEffects (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:15159:11)
    at commitLayoutEffectOnFiber (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:14031:11)

stderr | test/renderer/src/components/ErrorBoundary.test.jsx > ErrorBoundary > shows error details in development mode
Error: Test error
    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:8:9)
    at Object.react_stack_bottom_frame (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:25904:20)
    at renderWithHooks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7662:22)
    at updateFunctionComponent (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:10166:19)
    at beginWork (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:11778:18)
    at runWithFiberInDEV (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:874:13)
    at performUnitOfWork (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17641:22)
    at workLoopSync (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17469:41)
    at renderRootSync (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17450:11)
    at performWorkOnRoot (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:16583:35) {
  [stack]: [Getter/Setter],
  [message]: 'Test error'
}

The above error occurred in the <BadChild> component.

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.

[ErrorBoundary] Caught error: {
  message: 'Test error',
  stack: 'Error: Test error\n' +
    '    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:8:9)\n' +
    '    at Object.react_stack_bottom_frame (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:25904:20)\n' +
    '    at renderWithHooks (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:7662:22)\n' +
    '    at updateFunctionComponent (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:10166:19)\n' +
    '    at beginWork (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:11778:18)\n' +
    '    at runWithFiberInDEV (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:874:13)\n' +
    '    at performUnitOfWork (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17641:22)\n' +
    '    at workLoopSync (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17469:41)\n' +
    '    at renderRootSync (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17450:11)\n' +
    '    at performWorkOnRoot (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:16583:35)',
  componentStack: '\n' +
    '    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:17:9)\n' +
    '    at ErrorBoundary (B:/electron/lumina/src/renderer/src/components/ErrorBoundary.jsx:10:5)',
  errorId: 'error-1784697713412-hzxiu1idd'
}
[ErrorBoundary] Failed to log error to main process: TypeError: Cannot read properties of undefined (reading 'catch')
    at ErrorBoundary.componentDidCatch (B:/electron/lumina/src/renderer/src/components/ErrorBoundary.jsx:57:12)
    at Object.react_stack_bottom_frame (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:25959:20)
    at ErrorBoundary.inst.componentDidCatch.update.callback (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:9504:11)
    at callCallback (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7423:16)
    at commitCallbacks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7443:11)
    at runWithFiberInDEV (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:874:13)
    at commitClassCallbacks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:13377:11)
    at commitLayoutEffectOnFiber (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:14026:25)
    at recursivelyTraverseLayoutEffects (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:15159:11)
    at commitLayoutEffectOnFiber (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:14031:11)

stderr | test/renderer/src/components/ErrorBoundary.test.jsx > ErrorBoundary > calls window.api.logError when available
Error: Test error
    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:8:9)
    at Object.react_stack_bottom_frame (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:25904:20)
    at renderWithHooks (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:7662:22)
    at updateFunctionComponent (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:10166:19)
    at beginWork (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:11778:18)
    at runWithFiberInDEV (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:874:13)
    at performUnitOfWork (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17641:22)
    at workLoopSync (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17469:41)
    at renderRootSync (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:17450:11)
    at performWorkOnRoot (B:\electron\lumina\node_modules\react-dom\cjs\react-dom-client.development.js:16583:35) {
  [stack]: [Getter/Setter],
  [message]: 'Test error'
}

The above error occurred in the <BadChild> component.

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.

[ErrorBoundary] Caught error: {
  message: 'Test error',
  stack: 'Error: Test error\n' +
    '    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:8:9)\n' +
    '    at Object.react_stack_bottom_frame (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:25904:20)\n' +
    '    at renderWithHooks (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:7662:22)\n' +
    '    at updateFunctionComponent (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:10166:19)\n' +
    '    at beginWork (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:11778:18)\n' +
    '    at runWithFiberInDEV (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:874:13)\n' +
    '    at performUnitOfWork (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17641:22)\n' +
    '    at workLoopSync (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17469:41)\n' +
    '    at renderRootSync (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:17450:11)\n' +
    '    at performWorkOnRoot (B:\\electron\\lumina\\node_modules\\react-dom\\cjs\\react-dom-client.development.js:16583:35)',
  componentStack: '\n' +
    '    at BadChild (B:/electron/lumina/test/renderer/src/components/ErrorBoundary.test.jsx:17:9)\n' +
    '    at ErrorBoundary (B:/electron/lumina/src/renderer/src/components/ErrorBoundary.jsx:10:5)',
  errorId: 'error-1784697713466-48qrpmg4i'
}

 ✓ test/renderer/src/components/ErrorBoundary.test.jsx (7 tests) 777ms
     ✓ calls onReset when Try Again is clicked  517ms
stderr | test/renderer/src/core/hooks/useSnippetData.test.js > useSnippetData > initializes with empty snippets
An update to TestComponent inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

stderr | test/renderer/src/features/AI/LuminaChat.test.js
[DB] Open failed: IndexedDB API missing. Please visit https://tinyurl.com/y2uuvskb

stderr | test/renderer/src/features/AI/LuminaChat.test.js
[DB] Open failed: IndexedDB API missing. Please visit https://tinyurl.com/y2uuvskb

stderr | test/renderer/src/core/hooks/useSnippetData.test.js > useSnippetData > shows error toast when getSnippets fails
Failed to load data: Error: Failed
    at B:/electron/lumina/test/renderer/src/core/hooks/useSnippetData.test.js:38:53
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:145:11
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:915:26
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1243:20
    at new Promise (<anonymous>)
    at runWithTimeout (file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1209:10)
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1653:37
    at Traces.$ (file:///B:/electron/lumina/node_modules/vitest/dist/chunks/traces.CCmnQaNT.js:142:27)
    at trace (file:///B:/electron/lumina/node_modules/vitest/dist/chunks/test.B8ej_ZHS.js:239:21)
    at runTest (file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1653:12)

stderr | test/renderer/src/features/AI/LuminaChat.test.js
[DB] Open failed: IndexedDB API missing. Please visit https://tinyurl.com/y2uuvskb

stderr | test/renderer/src/features/AI/LuminaChat.test.js
[AIStore] Failed to save initial session to db: [DexieError [MissingAPIError]: IndexedDB API missing. Please visit https://tinyurl.com/y2uuvskb] {
  inner: null
}

stderr | test/renderer/src/core/hooks/useSnippetData.test.js > useSnippetData > shows error toast when getSnippets fails
Failed to load data: Error: Failed
    at B:/electron/lumina/test/renderer/src/core/hooks/useSnippetData.test.js:38:53
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:145:11
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:915:26
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1243:20
    at new Promise (<anonymous>)
    at runWithTimeout (file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1209:10)
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1653:37
    at Traces.$ (file:///B:/electron/lumina/node_modules/vitest/dist/chunks/traces.CCmnQaNT.js:142:27)
    at trace (file:///B:/electron/lumina/node_modules/vitest/dist/chunks/test.B8ej_ZHS.js:239:21)
    at runTest (file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1653:12)

stderr | test/renderer/src/components/AppVersion.test.jsx > AppVersion > renders version from window.api.getVersion
An update to AppVersion inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

 ✓ test/renderer/src/core/hooks/useSnippetData.test.js (8 tests) 220ms
 ✓ test/renderer/src/core/hooks/useTextEditor.test.js (9 tests) 131ms
stderr | test/renderer/src/components/AppVersion.test.jsx > AppVersion > handles API rejection gracefully
Error: fail
    at B:/electron/lumina/test/renderer/src/components/AppVersion.test.jsx:32:62
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:145:11
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:915:26
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1243:20
    at new Promise (<anonymous>)
    at runWithTimeout (file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1209:10)
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1653:37
    at Traces.$ (file:///B:/electron/lumina/node_modules/vitest/dist/chunks/traces.CCmnQaNT.js:142:27)
    at trace (file:///B:/electron/lumina/node_modules/vitest/dist/chunks/test.B8ej_ZHS.js:239:21)
    at runTest (file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1653:12)

 ✓ test/renderer/src/components/AppVersion.test.jsx (4 tests) 201ms
 ✓ test/renderer/src/core/hooks/useKeyboardShortcuts.test.jsx (20 tests) 199ms
stderr | test/renderer/src/features/AI/LuminaChat.test.js > useAIStore > searchNotes > should handle API errors gracefully
[AIStore] Vault search failed: Error: Search failed
    at B:/electron/lumina/test/renderer/src/features/AI/LuminaChat.test.js:110:48
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:145:11
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:915:26
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1243:20
    at new Promise (<anonymous>)
    at runWithTimeout (file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1209:10)
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1653:37
    at Traces.$ (file:///B:/electron/lumina/node_modules/vitest/dist/chunks/traces.CCmnQaNT.js:142:27)
    at trace (file:///B:/electron/lumina/node_modules/vitest/dist/chunks/test.B8ej_ZHS.js:239:21)
    at runTest (file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1653:12)

stderr | test/renderer/src/features/AI/LuminaChat.test.js > useAIStore > chat functionality > should clear chat messages
[DB] Open failed: IndexedDB API missing. Please visit https://tinyurl.com/y2uuvskb

stderr | test/renderer/src/features/AI/LuminaChat.test.js > useAIStore > chat functionality > should clear chat messages
[AIStore] Failed to save chat history to db, falling back to localStorage: [DexieError [MissingAPIError]: IndexedDB API missing. Please visit https://tinyurl.com/y2uuvskb] {
  inner: null
}

 ✓ test/renderer/src/features/AI/LuminaChat.test.js (10 tests) 203ms
stderr | test/renderer/src/core/hooks/useTheme.test.jsx > useTheme > falls back to dark theme if invalid theme provided
Theme "invalid_theme" not found, using "dark"

 ✓ test/renderer/src/core/hooks/useTheme.test.jsx (6 tests) 188ms
 ✓ test/renderer/src/core/hooks/useTag.test.js (9 tests) 173ms
 ✓ test/renderer/src/core/store/useUpdateStore.test.js (9 tests) 161ms
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

stderr | test/renderer/src/core/hooks/handleRenameSnippet.test.js > handleRenameSnippet > reverts optimistic update on save failure
Failed to save item after rename: Error: Save failed
    at B:/electron/lumina/test/renderer/src/core/hooks/handleRenameSnippet.test.js:94:51
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:145:11
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:915:26
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1243:20
    at new Promise (<anonymous>)
    at runWithTimeout (file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1209:10)
    at file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1653:37
    at Traces.$ (file:///B:/electron/lumina/node_modules/vitest/dist/chunks/traces.CCmnQaNT.js:142:27)
    at trace (file:///B:/electron/lumina/node_modules/vitest/dist/chunks/test.B8ej_ZHS.js:239:21)
    at runTest (file:///B:/electron/lumina/node_modules/@vitest/runner/dist/index.js:1653:12)

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

 ✓ test/renderer/src/core/hooks/handleRenameSnippet.test.js (6 tests) 48ms
 ✓ test/renderer/src/core/store/useSettingsStore.test.js (11 tests) 89ms
 ✓ test/renderer/src/core/hooks/useToast.test.js (6 tests) 123ms
 ✓ test/renderer/src/core/store/useVaultStore.test.js (16 tests) 58ms
 ✓ test/renderer/src/core/utils/searchRanker.test.js (33 tests) 47ms
 ✓ test/renderer/src/core/utils/graphBuilder.test.js (13 tests) 31ms
 ✓ test/renderer/src/core/hooks/stringUtils.test.js (6 tests) 11ms
 ✓ test/renderer/src/core/utils/noteColors.test.js (5 tests) 19ms

 Test Files  22 passed (22)
      Tests  227 passed (227)
   Start at  12:21:46
   Duration  22.04s (transform 3.35s, setup 25.70s, import 7.33s, tests 4.06s, environment 71.10s)

 PASS  Waiting for file changes...
       press h to show help, press q to quit
