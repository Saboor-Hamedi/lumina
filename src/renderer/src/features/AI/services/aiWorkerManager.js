/**
 * Web Worker Manager for Offline AI Models & Local Generation
 * Manages the background worker, model downloads, and embedding/text tasks.
 */

let worker = null
const pendingTasks = new Map()

export const initAIWorker = ({ onProgress, onReady, onError } = {}) => {
  if (!worker) {
    worker = new Worker(new URL('../../../core/ai/ai.worker.js', import.meta.url), {
      type: 'module'
    })

    worker.onmessage = (e) => {
      const { type, status, id, result, progress } = e.data

      // Handle Progress
      if (type === 'progress') {
        if (status === 'progress' && onProgress) {
          onProgress(progress)
        } else if (status === 'ready' && onReady) {
          onReady()
        }
        return
      }

      // Handle Task Completion
      const pending = pendingTasks.get(id)
      if (pending) {
        if (status === 'complete') {
          pending.resolve(result)
        } else {
          pending.reject(e.data?.error || new Error('Worker task failed'))
        }
        pendingTasks.delete(id)
      } else if (status === 'error') {
        console.error('AI Worker Error:', e.data?.error)
        if (onError) onError(e.data?.error)
      }
    }
  }
  return worker
}

export const getPendingTasks = () => pendingTasks

export const generateEmbedding = (text) => {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    pendingTasks.set(id, { resolve, reject })
    initAIWorker().postMessage({ id, type: 'embed', payload: text })
  })
}

export const generateLocalText = (prompt) => {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    pendingTasks.set(id, { resolve, reject })
    initAIWorker().postMessage({ id, type: 'generate', payload: prompt })
  })
}
