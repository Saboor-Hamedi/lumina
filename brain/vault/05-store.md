# vault store

**source:** `src/renderer/src/core/store/uservaultstore.js` (440 lines)
**role:** zustand store holding all vault data on the renderer side. the renderer's cache of main-process state.

---

## state

| field | type | default | description |
|-------|------|---------|-------------|
| snippets | array | [] | all vault snippets (notes) |
| folders | array | [] | folder path strings |
| foldercolors | object | {} | { folderid: color } map |
| selectedsnippet | object\|null | null | currently viewed note |
| isloading | boolean | true | vault being loaded |
| searchquery | string | '' | current filter text |
| dirtysnippetids | array | [] | ids with unsaved changes |
| opentabs | array | [] | ordered tab ids (includes `graph_tab_id`) |
| activetabid | string\|null | null | focused tab's id |
| pinnedtabids | array | [] | pinned tab ids (always at front) |

---

## actions

### loadvault()

1. sets `isloading = true`
2. calls `window.api.getsnippets()` → ipc → vaultmanager.getsnippets()
3. merges `notecolors` and `foldercolors` from settings
4. on error: sets `isloading = false`, keeps empty state

### savesnippet(snippet)

the full save cycle from renderer to disk:

1. validate snippet is non-null and has `id`
2. call `window.api.savesnippet(snippet)` → ipc → vaultmanager.savesnippet()
3. sync note color to settings
4. merge returned snippet into local `snippets[]`
5. **auto-update wikilinks** if title changed:
   - scan all other snippets for `[[oldtitle]]` or `[[oldtitle|...]]` patterns
   - for each affected snippet, call `savesnippet()` fire-and-forget
6. clear `dirtysnippetids` for this id
7. update `selectedsnippet` if it matches

### deletesnippet(id, skipconfirm)

1. show native confirm dialog (unless `skipconfirm` is true)
2. call `window.api.deletesnippet(id)` → ipc → vaultmanager.deletesnippet()
3. remove from local `snippets[]`
4. close tab for this snippet
5. intelligently select next tab

### settabs — tab management

| action | behavior |
|--------|----------|
| `setselectedsnippet(s)` | adds to opentabs if not open, sets activetabid |
| `closetab(id)` | removes tab, picks next (same index, or previous, or null) |
| `reordertabs(newtabs)` | reorders while keeping pinned tabs at front |
| `closeothermabs(id)` | keeps only specified tab + pinned tabs |
| `closetabstoright(id)` | closes all unpinned tabs to the right |
| `closealltabs()` | keeps only pinned tabs |
| `togglepintab(id)` | pins/unpins, reorders pinned to front |
| `opengraphtab()` | opens special `graph_tab_id`, clears selectedsnippet |

### restore session

called at app startup:
1. reads `opentabs`, `pinnedtabids`, `lastsnippetid` from settings
2. handles `graph_tab_id` as special sentinel
3. restores tab bar to previous state
4. gracefully skips ids that no longer exist

### setfoldercolor(folderid, color)

persists to settings and updates local `foldercolors`.

### reordersnippets(orderedids)

persists manual note order via settings store.

### updatesnippetselection(id, selection)

updates cursor/selection range in local state only (not persisted to disk).

---

## auto-persist subscription

a zustand subscription outside the react lifecycle saves tab state on every change:

```javascript
usevaultstore.subscribe((state) => {
  window.api.savesetting('opentabs', state.opentabs)
  window.api.savesetting('pinnedtabids', state.pinnedtabids)
  window.api.savesetting('lastsnippetid', state.activetabid)
})
```

this is synchronous (not debounced) for crash resilience.

---

## graph_tab_id special behavior

the constant `graph_tab_id = '__graph__'` is a sentinel tab that:
- lives in `opentabs` alongside real snippet ids
- not a real snippet — `selectedsnippet` is null when active
- handled specially in `closetab()` and `restoresession()`

---

## dirty tracking

- `dirtysnippetids` tracks which tabs have unsaved edits
- set by editor `onchange` → `setdirty(id, true)`
- cleared after successful `savesnippet()` returns
- components use this to show unsaved indicators (dot on tab, confirm before close)
