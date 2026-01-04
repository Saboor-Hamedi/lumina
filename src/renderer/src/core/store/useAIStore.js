import { create } from 'zustand'

export const useAIStore = create((set, get) => {
  // Initialize worker
  const worker = new Worker(new URL('../ai/ai.worker.js', import.meta.url), { type: 'module' });

  worker.onmessage = (e) => {
    const { type, status, id, result, progress } = e.data
    
    // Handle Progress
    if (type === 'progress') {
       if (status === 'progress') {
         set({ modelLoadingProgress: progress })
       } else if (status === 'ready') {
         set({ isModelReady: true, modelLoadingProgress: 100 })
       }
       return
    }

    // Handle Task Completion
    const pending = get().pendingTasks.get(id)
    if (pending) {
        if (status === 'complete') {
            pending.resolve(result)
        } else {
            pending.reject(e.data.error)
        }
        const newMap = new Map(get().pendingTasks)
        newMap.delete(id)
        set({ pendingTasks: newMap })
    }
  }

  return {
    isModelReady: false,
    modelLoadingProgress: 0,
    embeddingsCache: {}, // SnippetID -> Vector[]
    pendingTasks: new Map(),

    generateEmbedding: (text) => {
        return new Promise((resolve, reject) => {
            const id = crypto.randomUUID()
            const { pendingTasks } = get()
            const newMap = new Map(pendingTasks)
            newMap.set(id, { resolve, reject })
            set({ pendingTasks: newMap })
            
            worker.postMessage({ id, type: 'embed', payload: text })
        })
    },

    // Compute Cosine Similarity
    computeSimilarity: (vecA, vecB) => {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        let dot = 0;
        let magA = 0;
        let magB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
            magA += vecA[i] * vecA[i];
            magB += vecB[i] * vecB[i];
        }
        return dot / (Math.sqrt(magA) * Math.sqrt(magB));
    },

    indexVault: async (snippets) => {
        const { generateEmbedding, embeddingsCache } = get()
        const updates = {}
        
        // Process sequentially to be nice to CPU (or parallel with Promise.all if daring)
        // Only index changed/new notes? For simplicity, re-index missing ones.
        for (const snippet of snippets) {
            if (!embeddingsCache[snippet.id]) {
                // Combine Title + Content for rich context
                const text = `${snippet.title}\n${snippet.code || ''}`.slice(0, 1000) // Limit context window
                try {
                    const vector = await generateEmbedding(text)
                    updates[snippet.id] = vector
                } catch (err) {
                    console.error("Embedding failed", err)
                }
            }
        }
        
        if (Object.keys(updates).length > 0) {
            set(state => ({
                embeddingsCache: { ...state.embeddingsCache, ...updates }
            }))
        }
    }
  }
})
