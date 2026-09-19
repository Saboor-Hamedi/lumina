/**
 * Web Worker Manager for Offline AI Models & Local Generation
 * Manages the background worker, model downloads, and embedding/text tasks.
 */

interface PendingTask {
  resolve: (value: any) => void
  reject: (reason?: any) => void
}

let worker: Worker | null = null
const pendingTasks = new Map<string, PendingTask>()

export interface InitAIWorkerCallbacks {
  onProgress?: (progress: number) => void
  onReady?: () => void
  onError?: (err: any) => void
}

export const initAIWorker = ({ onProgress, onReady, onError }: InitAIWorkerCallbacks = {}): Worker => {
  if (!worker) {
    worker = new Worker(new URL('../../../core/ai/ai.worker.js', import.meta.url), {
      type: 'module'
    })

    worker.onmessage = (e: MessageEvent) => {
      const { type, status, id, result, progress } = e.data || {}

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

export const getPendingTasks = (): Map<string, PendingTask> => pendingTasks

export const generateEmbedding = (text: string): Promise<number[]> => {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    pendingTasks.set(id, { resolve, reject })
    initAIWorker().postMessage({ id, type: 'embed', payload: text })
  })
}

export const generateLocalText = (prompt: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    pendingTasks.set(id, { resolve, reject })
    initAIWorker().postMessage({ id, type: 'generate', payload: prompt })
  })
}
