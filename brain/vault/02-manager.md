# vault manager

**source:** `src/main/vaultmanager.js` (495 lines)
**role:** single source of truth for all on-disk vault operations. singleton module.

---

## lifecycle

### init(userpath, defaultdocpath)

called once at app startup. creates vault directory if missing:

```
~/documents/lumina/         (or custom path)
  └── .lumina/
      └── assets/           (images, uploads)
```

1. ensures vault path and `.lumina/assets/` exist
2. runs initial `scanvault()`
3. starts chokidar watcher

### scanvault()

recursive walk of all `.md` files. skips: `.git`, `assets`, `node_modules`, `dist`, `build`, `log`.

processing:
1. reads each `.md` file
2. parses yaml frontmatter via `gray-matter`
3. **auto-heals** missing/duplicate `id` fields — generates `crypto.randomuuid()` and writes back to disk
4. runs in batches of 10 files, yields to os every 100 files
5. returns `{ snippets: [], folders: [] }`

### setupwatcher()

creates chokidar `fswatcher` on the vault path. ignores dotfiles. on any `.md` or directory change:
- debounces 1 second
- calls `scanvault()`
- broadcasts `vault:updated` to all renderer windows via `webcontents.send`

**critical:** watcher is paused during `renamefolder` / `deletefolder` to avoid windows file-lock race conditions, then restarted.

---

## file operations

### savesnippet(snippet) — the core write path

```
input: { id, title, code, language, tags, ispinned, customicon, selection, folderid }
```

steps:
1. **sanitize title** — `sanitizetitleforfilename(title)` removes invalid filesystem chars
2. **handle rename** — if `filename` differs from existing entry, delete old file
3. **collision detection** — if another snippet already has the same sanitized filename, append `-{id[:5]}` suffix
4. **bump timestamp** — `date.now()` only if `snippet.code` actually changed (not for pin/color/tag-only edits)
5. **serialize** — `gray-matter.stringify()` produces:
   ```yaml
   ---
   id: uuid
   title: my note
   language: markdown
   tags: tag1, tag2
   selection: {row, col}
   ispinned: false
   customicon: null
   timestamp: 1704326400000
   ---
   # note content
   ```
6. **write** — `fs.writefile(pathtofile, stringified)`
7. **update in-memory state** — merge cleaned title/filename back into `this.snippets` map
8. **return** updated snippet object (with cleaned title, new filename, bumped timestamp)

### deletesnippet(id)

1. looks up snippet in `this.snippets` map
2. calls `fs.unlink()` on the file
3. removes from in-memory map

### createfolder(folderpath)

1. calls `fs.mkdir(folderpath, { recursive: true })`
2. adds path to `this.folders` set

### renamefolder(oldpath, newpath)

1. **pauses chokidar watcher** (critical for windows)
2. calls `fs.rename(oldpath, newpath)`
3. updates `folderid` for all affected snippets in `this.snippets`
4. **restarts watcher**

### deletefolder(folderpath)

1. **pauses watcher**
2. recursively removes directory via `fs.rm(folderpath, { recursive: true })`
3. removes all affected snippets from `this.snippets`
4. **restarts watcher**

### saveimage(buffer, originalname)

1. slugifies the filename with timestamp prefix
2. writes to `.lumina/assets/` directory
3. returns markdown-compatible relative path: `./assets/slugified-name.png`

### readasset(relativepath)

reads any file within the vault (used to serve images to renderer via ipc).

### cleanorphanedassets()

scans `.lumina/assets/`, checks each file against all snippet `code` bodies. deletes unreferenced files.

---

## in-memory state

| field | type | description |
|-------|------|-------------|
| `this.vaultpath` | string | root vault directory |
| `this.snippets` | map<string, object> | all snippets keyed by uuid |
| `this.folders` | set<string> | relative directory paths |
| `this.watcher` | fswatcher | chokidar instance |

the class is exported as a singleton:
```javascript
export default new vaultmanager()
```

## edge cases handled

- **invalid filename characters** — stripped via `sanitizetitleforfilename()`
- **duplicate titles** — `-{id[:5]}` disambiguator
- **missing frontmatter id** — auto-generated uuid written to disk during scan
- **duplicate frontmatter id** — regenerated uuid written to disk during scan
- **windows file locking** — watcher paused during folder rename/delete
- **external file changes** (e.g. git sync) — chokidar detects, debounces 1s, rescans
- **rename across folders** — old file deleted, new file written in target directory
- **content vs metadata edit** — timestamp only bumped for content changes, not pin/color/tag
