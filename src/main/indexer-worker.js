import { parentPort } from 'worker_threads'

let embedder = null

async function getEmbedder() {
  if (embedder) return embedder

  console.info('[IndexerWorker] Loading embedding model...')
  const { pipeline, env } = await import('@xenova/transformers')
  env.allowLocalModels = false
  env.useBrowserCache = false
  env.useCustomCache = false

  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    progress_callback: null
  })
  console.info('[IndexerWorker] Embedder loaded')
  return embedder
}

parentPort.on('message', async (msg) => {
  if (msg.type === 'warmup') {
    await getEmbedder()
    parentPort.postMessage({ type: 'warmup-done' })
  } else if (msg.type === 'embed-batch') {
    try {
      const model = await getEmbedder()
      const results = []

      for (const text of msg.texts) {
        const safeText = text.length > 500 ? text.slice(0, 500) : text
        const output = await model(safeText, { pooling: 'mean', normalize: true })
        results.push(Array.from(output.data))
      }

      parentPort.postMessage({ type: 'embeddings', results, batchId: msg.batchId })
    } catch (err) {
      parentPort.postMessage({ type: 'error', error: err.message, batchId: msg.batchId })
    }
  } else if (msg.type === 'shutdown') {
    embedder = null
    process.exit(0)
  }
})
