# dev notes

## current state

lumina is a note-taking app built on electron + react with a multi-model ai chat. the app has dual chat uis (panel + modal) which need unification.

---

## architecture decisions

### dual chat ui problem

there are two chat uis that share the same store (`useaistore.js`):

| ui | path | pros | cons |
|----|------|------|------|
| aichatpanel.jsx | `features/AI/AIChatPanel.jsx` (908 lines) | sidebar, always visible | consumes sidebar real estate |
| aichatmodal.jsx | `features/Overlays/AIChatModal.jsx` (954 lines) | floating, modal | redundant code, duplication |

**goal:** merge both into `aichatmodal.jsx` and remove `aichatpanel.jsx`. the modal should:
- support both sidebar-docked and floating modes
- have integrated history panel
- use the same composer component

### store patterns

- all state in zustand stores (useaistore, usevaultstore, usesettingsstore, uiappstore)
- stores are in `src/renderer/src/core/store/`
- do not access store state outside of react components without `.getState()`
- always use `useShallow` for selector comparison to avoid re-renders

### worker isolation

ai worker (`ai.worker.js`) runs @xenova/transformers in a web worker to keep main thread free. worker communicates via postmessage protocol. worker lifecycle:
1. loaded on app start if `settings.enablelocalai` is true
2. downloads embedding model (~80mb, cached in browser cache)
3. ready signal sent to main thread
4. embed requests queued and processed serially

### file operations

never write files directly in renderer. always go through:

```
store method -> ipc invoke -> main process vaultmanager -> chokidar detects change -> vault rescans -> store updates
```

---

## known issues

### ai chat panel merge

the merge of aichatpanel into aichatmodal is incomplete:
- aichatmodal.jsx has build errors (missing semicolons in import sections)
- history panel needs to be integrated into the modal
- floating mode from aichatmodal needs to work without aichatpanel
- shortcut to toggle chat should consistently open the modal

### comment style

there is inconsistency in the codebase between `//` and `//*` comment styles. when modifying code, use:
- `// comment` for regular comments
- `//* comment` for section headers / separators

### semantic indexing

when enablelocalai is toggled on:
- vault indexer scans all `.md` files
- each file is split into chunks
- embeddings are generated via web worker
- indexed in-memory (not persisted to disk yet)
- embeddings are regenerated on app restart — no persistence yet

---

## conventions

### naming
- react components: PascalCase
- hooks: useXxx
- stores: useXxxStore (lowercase first letter of store name)
- files: kebab-case for utils, PascalCase for components
- test files: `*.test.jsx` next to source

### imports order
1. react / electron
2. third-party libs
3. local stores
4. local components
5. local utils
6. css modules

### state management rules
- prefer zustand over react state for shared state
- use local react state only for ui-only state (dropdown open, hover, etc.)
- never mutate store state directly — always use store actions

---

## future work

### high priority
- [ ] complete aichatpanel → aichatmodal merge
- [ ] persist embeddings to disk (indexeddb)
- [ ] add semantic search result ranking in ui

### medium priority
- [ ] add provider connection testing in settings modal
- [ ] improve error display in chat (toast notifications)
- [ ] add chat export (json / markdown)

### low priority
- [ ] add ollama model discovery (auto-detect available models)
- [ ] streaming status indicator per message
- [ ] message editing in chat history
