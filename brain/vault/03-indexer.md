# vault indexer

**source:** `src/main/vaultindexer.js` (1010 lines)
**role:** creates and maintains a semantic search index. splits files into intelligently-chunked segments, computes 384-dimensional vector embeddings via onnx worker, persists to disk.

---

## data layout

all files live in `{userdata}/vault-index/`:

| file | format | purpose |
|------|--------|---------|
| `vault_index.jsonl` | jsonl | one json object per chunk with `{ id, filepath, text, embeddingoffset, embeddinglength, type, metadata }` |
| `embeddings.bin` | binary | raw 32-bit floats, little-endian, 384 per chunk, concatenated in index order |
| `vault_state.json` | json | per-file metadata: `{ mtime, size, checksum, indexed, chunkcount }` |

---

## key methods

### init(userdatapath)

creates `vault-index/` directory, sets file paths, runs `validateindex()`.

### validateindex()

checks all 3 files exist, are non-empty, and version matches `this.version` (currently `1.0.0`). returns `{ valid: boolean, reason?: string }`. on version mismatch, a full rebuild is triggered.

### computechecksum(filepath)

sha-256 hash of file content for precise change detection (beyond just mtime/size).

### chunkcontent(filepath, content, metadata) — the chunking algorithm

**code files** (`.js`, `.ts`, `.jsx`, `.tsx`, `.py`, `.java`, `.cpp`, `.c`, `.html`, `.css`):
1. try to split on function/class/const boundary regex
2. fallback: 400-char fixed-size chunks

**markdown / text files:**
1. split by `# headings`
2. fallback: paragraph breaks
3. fallback: 400-char fixed-size chunks

**all types:**
- minimum chunk size: 50 characters
- metadata tagged with chunk type (`function`, `class`, `heading`, `paragraph`, `generic`)

### needsindexing(filepath, force, state)

fast check:
1. if `force` → true
2. compare stored `mtime` vs filesystem `mtime` (1-second tolerance for fat32)
3. compare stored `size` vs filesystem `size`
4. if mismatch → true (then verified with checksum inside `indexfile`)
5. else → false

### indexfile(filepath, force, state)

the per-file indexing pipeline:
1. `fs.stat()` — mtime + size
2. `computechecksum()` — sha-256 content hash
3. read file content
4. `chunkcontent()` — split into chunks
5. **generate embeddings** — send batch to worker thread, receive `float32array[]`
6. return `{ chunkrecords[], embeddingsbuffer, stateupdate }`

### generateembedding(text)

sends a single-text batch to the worker. returns promise resolving to `float32array` (384 dimensions).

### _ensureworker()

lazily creates a worker thread from `indexer-worker.js`. the worker handles onnx model inference:

```
main → worker: { type: 'embed-batch', texts: [...], batchid }
worker → main: { type: 'embeddings', batchid, results: float32array[] }
```

messages are dispatched via a pending-requests map keyed by `batchid`.

### warmworker()

pre-loads the onnx model by sending a `warmup` message. called at idle time after app startup.

### appendtoindex(chunkrecords, embeddingsbuffer, updatedfiles)

write-locked read-modify-write:
1. acquire mutex
2. read existing `vault_index.jsonl`
3. remove old chunks for updated files
4. rebuild binary embeddings buffer (old + new)
5. write both files atomically
6. release mutex

### indexvault(vaultpath, options) — main entry point

guarded by `this.isindexing` flag. if already running, returns `{ queued: true }`.

```
1. validate existing index; if corrupt → clear + rebuild
2. scanvaultfiles() → get all supported file paths
3. filter to only files where needsindexing() → true
4. for each changed file:
     a. indexfile() → chunkrecords + embeddings + state
     b. accumulate results
5. appendtoindex() → write all new data
6. bulk-write vault_state.json
```

### scanvaultfiles(vaultpath, onprogress)

recursive walk. supported extensions: `.md`, `.txt`, `.js`, `.ts`, `.jsx`, `.tsx`, `.json`, `.py`, `.java`, `.cpp`, `.c`, `.html`, `.css`

yields progress every 50 entries.

### rebuildindex(vaultpath, options)

1. backs up old index
2. clears everything
3. calls `indexvault()` with `force: true`

### clearindex()

write-locked: empties all three index files.

### getstats()

returns: `{ totalfiles, indexedfiles, totalchunks, errors, lastindextime }`

---

## concurrency

| guard | type | purpose |
|-------|------|---------|
| `this.isindexing` | boolean | prevents concurrent `indexvault()` runs |
| `this.writelock` | mutex | protects read-modify-write of index files |
| `this._worker` | worker thread | killed/recreated on error |

## versioning

stored in `vault_state.json`. current: `1.0.0`. bump this value in code to force a full index rebuild on next startup.
