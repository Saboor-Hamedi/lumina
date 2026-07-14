# vault search

**source:** `src/main/vaultsearch.js` (376 lines)
**role:** semantic similarity search over the vault index. loads jsonl index + binary embeddings, computes cosine similarity, re-ranks results.

---

## lifecycle

### init(userdatapath)

points to the same `vault-index/` directory as vaultindexer. does **not** load the onnx model here — that happens lazily on the first query.

### loadindex()

reads `vault_index.jsonl` → `this.index` (array of chunk objects)
reads `embeddings.bin` → `this.embeddingsbuffer` (node buffer)
sets `this.isloaded = true`

### reload()

clears query cache, re-calls `loadindex()`. called after a re-index completes.

---

## search pipeline

### _getembedder() — lazy onnx loader

first call:
1. imports `@xenova/transformers`
2. creates `feature-extraction` pipeline with `xenova/all-minilm-l6-v2` (384 dims)
3. sets `allowlocalmodels = false` (always downloads from huggingface, ~50-100mb)

subsequent calls return cached pipeline.

### generatequeryembedding(query)

uses embedder pipeline:
- input: query string
- pooling: `'mean'`
- normalize: `true`
- output: 384-dim float32array

### getchunkembedding(chunk)

reads a chunk's embedding vector from the raw binary buffer using:
- `chunk.embeddingoffset` (byte position in `embeddings.bin`)
- `chunk.embeddinglength` (should be 384 × 4 bytes)
- returns `float32array`

bounds-checked against buffer length.

### cosinesimilarity(veca, vecb)

standard formula:

```
dot = sum(ai * bi)
maga = sqrt(sum(ai²))
magb = sqrt(sum(bi²))
return dot / (maga * magb)
```

### search(query, options) — core

```
options: { threshold, limit, rerank, filters }
filters: { filepath, filetype, type }
```

1. **cache check** — keyed by `json.stringify({ query, threshold, filters })`. max 100 entries.
2. **generate query embedding** — lazy-loads onnx model if first query
3. **pre-filter** — apply `filters.filepath` (regex), `filters.filetype` (extension), `filters.type` (chunk type)
4. **score all candidates** — for each surviving chunk, `cosinesimilarity(query_emb, chunk_emb)`
5. **threshold** — results below `options.threshold` (default 0.3) are discarded
6. **sort** — descending by score
7. **re-rank** (if `options.rerank = true`):
   - exact word match in text: +0.1
   - file modified < 7 days: +0.05
   - file modified < 1 day: +0.1
   - filename matches query: +0.15
8. **limit** — top `options.limit` (default 20)
9. **cache** — store result
10. **return** — sorted array of `{ chunk, filepath, text, score }`

### findsimilar(chunkid, limit)

given a chunk id, find the most similar chunks by embedding comparison. threshold: 0.3.

### getchunksbyfile(filepath)

returns all chunks belonging to a specific file.

### getstats()

returns: `{ totalchunks, uniquefiles, typedistribution, cachesize }`

---

## caching

| cache | type | eviction |
|-------|------|----------|
| `this.querycache` | map (keyed by query hash) | oldest entry evicted > 100 items |
| `this.embedder` | onnx pipeline | lazy, never evicted |

## critical notes

- **onnx model is large** (~50-100mb download). first query is slow. subsequent queries are fast.
- **index and search share files** — vaultindexer writes, vaultsearch reads. after re-index, `reload()` must be called.
- **graceful degradation** — if index files are missing/corrupt, `isloaded = false`, search returns empty results.
