# vault data flows

## save cycle: ui → disk

```
user types in codemirror editor
    │
    ▼
editor onchange → store.setdirty(id, true)
    │
    ▼
autosave timer (or manual ctrl+s) → store.savesnippet(snippet)
    │
    ├─ validate snippet (non-null, has id)
    │
    ▼
window.api.savesnippet(snippet)
    │  (preload bridge: ipcrenderer.invoke)
    │
    ▼
main process: ipcmain.handle('vault:savesnippet')
    │
    ▼
vaultmanager.savesnippet(snippet):
    1. sanitizetitleforfilename(title)
    2. delete old file if renamed/moved
    3. collision check → append -{id[:5]} if conflict
    4. bump timestamp only if content changed
    5. gray-matter.stringify() → markdown with frontmatter
    6. fs.mkdir(targetdir, { recursive: true })
    7. fs.writefile(finalpath, stringified)
    8. update this.snippets map
    9. return cleansed snippet
    │
    ▼
ipc returns updated snippet to renderer
    │
    ▼
store.savesnippet() continues:
    ├─ merge returned snippet into snippets[]
    ├─ auto-update wikilinks if title changed
    │    └─ scan all files for [[oldtitle]] → [[newtitle]]
    │    └─ savesnippet() each affected file (fire-and-forget)
    ├─ clear dirty flag for this id
    ├─ update selected snippet if matching
    │
    ▼
zustand subscription fires (sync):
    ├─ savesetting('opentabs', ...)
    ├─ savesetting('pinnedtabids', ...)
    └─ savesetting('lastsnippetid', ...)
```

---

## delete cycle

```
user clicks delete (trash icon or context menu)
    │
    ▼
store.deletesnippet(id, skipconfirm?)
    ├─ if !skipconfirm: window.api.confirmdelete(msg)
    │    └─ native os dialog, returns boolean
    │
    ▼ (if confirmed)
window.api.deletesnippet(id)
    │
    ▼
vaultmanager.deletesnippet(id):
    1. lookup in this.snippets map
    2. fs.unlink(filepath)
    3. remove from this.snippets
    │
    ▼
store updates:
    ├─ remove from snippets[]
    ├─ closetab(id)
    └─ select next tab intelligently
```

---

## app startup

```
electron app ready
    │
    ├─ vaultmanager.init()
    │    ├─ mkdir vault path
    │    ├─ scanvault() → populate this.snippets
    │    └─ setupwatcher() → chokidar starts
    │
    ├─ settingsmanager.init()
    │    └─ load settings.json
    │
    ▼
window loads (renderer)
    │
    ▼
usevaultstore.loadvault()
    ├─ window.api.getsnippets() → full snippet list
    ├─ window.api.getsetting('notecolors') → color map
    ├─ window.api.getsetting('foldercolors') → folder colors
    └─ set isloading = false
    │
    ▼
tab restoration:
    ├─ store.restoresession(opentabs, pinnedtabids, activetabid)
    │  (reads from settings, persists to settings on every change)
    └─ ui renders tab bar and opens active note
```

---

## chokidar sync (external change detection)

```
external tool modifies a .md file (git sync, another app, etc)
    │
    ▼
chokidar fires 'change' event
    │
    ▼
vaultmanager.setupwatcher() — debounce 1 second
    │
    ▼
vaultmanager.scanvault()
    1. walk all .md files
    2. read + parse frontmatter
    3. auto-heal missing/duplicate ids
    4. rebuild this.snippets map
    5. rebuild this.folders set
    │
    ▼
webcontents.send('vault:updated', { snippets, folders })
    │  (broadcast to all renderer windows)
    │
    ▼
renderer receives 'vault:updated'
    │
    ▼
usevaultstore.getstate().loadvault() — refresh from main
```

important: the renderer store is a **cache**. the main process is the source of truth. chokidar ensures the store is always up to date even when files change externally.

---

## indexing & search flow

```
renderer calls window.api.indexvault(vaultpath, options)
    │
    ▼
vaultindexer.indexvault(vaultpath):
    1. guard: if already indexing → { queued: true }
    2. scanvaultfiles() → all supported file paths
    3. filter: needsindexing() / mtime/size/checksum
    4. for each changed file:
         a. indexfile() → chunks + embeddings
         b. send progress via index:progress channel
    5. appendtoindex() → write jsonl + embeddings.bin
    6. update vault_state.json
    │
    ▼
renderer calls window.api.searchvault(query, options)
    │
    ▼
vaultsearch.search(query, options):
    1. cache check (query + threshold + filters)
    2. lazy-load onnx embedder (first query only)
    3. generate query embedding
    4. apply pre-filters (filepath, filetype, type)
    5. cosine similarity for all candidates
    6. threshold + sort
    7. optional re-rank (recency, text match, filename)
    8. cache result → return top 20
```

---

## image pipeline

```
user drops/pastes image in editor
    │
    ▼
image data is sent to main process
    │
    ▼
vaultmanager.saveimage(buffer, originalname):
    1. slugify filename + timestamp prefix
    2. fs.writefile('.lumina/assets/slug-filename.png', buffer)
    3. return relative path: './assets/slug-filename.png'
    │
    ▼
renderer inserts markdown image tag: ![](./assets/slug-filename.png)
    │
    ▼
in preview mode, image is served via:
    vaultmanager.readasset('./assets/slug-filename.png')
    → fs.readfile → base64 data url → <img> tag
    │
    ▼
on cleanup: vaultmanager.cleanorphanedassets()
    scans all .md bodies, deletes unreferenced images
```
