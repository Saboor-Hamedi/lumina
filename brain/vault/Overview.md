# vault system overview

## architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     renderer process                         │
│                                                              │
│  usevaultstore (zustand, 440 lines)                          │
│    snippets[], folders[], opentabs[], dirtysnippetids[], etc │
│    loadvault(), savesnippet(), deletesnippet()               │
│    tab management, wikilink auto-update                      │
│                                                              │
│  [components] → store actions → window.api.* (preload)      │
└──────────────────────────┬───────────────────────────────────┘
                           │ ipcrenderer.invoke / send
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                      main process                            │
│                                                              │
│  index.js                                                    │
│    ipcmain.handle('vault:*', ...)                            │
│                                                              │
│  ┌─────────────┬─────────────────┬──────────────┐            │
│  │ vaultmanager │ vaultindexer    │ vaultsearch  │            │
│  │ 495 lines    │ 1010 lines      │ 376 lines    │            │
│  │ file i/o     │ embeddings      │ cosine search│            │
│  │ chokidar     │ worker thread   │ query cache  │            │
│  │ singleton    │ onnx model      │ lazy loader  │            │
│  └──────┬───────┴────────┬────────┴──────┬───────┘            │
│         │                │               │                    │
│         ▼                ▼               ▼                    │
│    ┌────────────────────────────────────────┐                 │
│    │            file system                  │                 │
│    │  ~/documents/lumina/                    │                 │
│    │    ├── note-1.md                        │                 │
│    │    ├── folder/                          │                 │
│    │    │   └── note-2.md                    │                 │
│    │    └── .lumina/                         │                 │
│    │        └── assets/                      │                 │
│    │        └── vault-index/                 │                 │
│    │            ├── vault_index.jsonl        │                 │
│    │            ├── embeddings.bin           │                 │
│    │            └── vault_state.json         │                 │
│    └────────────────────────────────────────┘                 │
└──────────────────────────────────────────────────────────────┘
```

## file map

| doc | source file | lines | role |
|-----|-------------|-------|------|
| 02-manager.md | `src/main/VaultManager.js` | 495 | file i/o, watcher, on-disk operations |
| 03-indexer.md | `src/main/VaultIndexer.js` | 1010 | semantic indexing, chunking, onnx embeddings |
| 04-search.md | `src/main/VaultSearch.js` | 376 | cosine similarity, full-text search |
| 05-store.md | `src/renderer/src/core/store/useVaultStore.js` | 440 | zustand store, tab state, dirty tracking |
| 06-data-flow.md | (cross-cutting) | - | end-to-end flows connecting all pieces |

## ipc channels

| channel | direction | type | handler |
|---------|-----------|------|---------|
| `vault:getsnippets` | r→m | handle | vaultmanager.getsnippets() |
| `vault:savesnippet` | r→m | handle | vaultmanager.savesnippet() |
| `vault:deletesnippet` | r→m | handle | vaultmanager.deletesnippet() |
| `vault:saveimage` | r→m | handle | vaultmanager.saveimage() |
| `vault:readasset` | r→m | handle | vaultmanager.readasset() |
| `vault:cleanorphans` | r→m | handle | vaultmanager.cleanorphanedassets() |
| `vault:createfolder` | r→m | handle | vaultmanager.createfolder() |
| `vault:renamefolder` | r→m | handle | vaultmanager.renamefolder() |
| `vault:deletefolder` | r→m | handle | vaultmanager.deletefolder() |
| `vault:updated` | m→r | send | watcher notifies all windows of changes |
| `vault:index` | r→m | handle | vaultindexer.indexvault() |
| `vault:rebuild-index` | r→m | handle | vaultindexer.rebuildindex() |
| `vault:index-stats` | r→m | handle | vaultindexer.getstats() |
| `vault:search` | r→m | handle | vaultsearch.search() |
| `vault:search-stats` | r→m | handle | vaultsearch.getstats() |
| `vault:find-similar` | r→m | handle | vaultsearch.findsimilar() |
| `index:progress` | m→r | send | progress updates during indexing |

## key design decisions

- **single vaultmanager singleton** — never re-instantiated. `export default new vaultmanager()`
- **main process is source of truth** — renderer store is a cache. chokidar keeps it in sync.
- **auto-healing ids** — scan detects missing/duplicate uuids in frontmatter and writes fresh ones
- **chokidar debounce 1s** — prevents rapid-reindex on bulk operations
- **semantic index is on disk** — jsonl + binary embeddings file. survives restarts.
- **worker thread for onnx** — embedding inference runs off the main process thread
- **lazy embedder** — vaultsearch only loads the onnx model on the first actual query
- **write lock on index** — mutex on index files prevents corruption during concurrent writes
