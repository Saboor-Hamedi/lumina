import { pipeline, env } from '@xenova/transformers'

// Skip local checks for now to ensure it downloads from HF CDN if needed
// In production, we would bundle the models.
env.allowLocalModels = false;
env.useBrowserCache = true;

class TextEmbedder {
  static task = 'feature-extraction';
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

// Minimal Summarizer (DistilBART is ~300MB, might be too heavy? Let's try or stick to embeddings first)
// For "Chat" we usually need generation, which is heavy. 
// We will focus on Embeddings for Search/Graph first as promised (20MB).

self.addEventListener('message', async (event) => {
  const { id, type, payload } = event.data;

  try {
    if (type === 'embed') {
      // Payload: string or array of strings
      const embedder = await TextEmbedder.getInstance((data) => {
        // Send loading progress back for UI
        self.postMessage({ type: 'progress', status: data.status, progress: data.progress });
      });

      const output = await embedder(payload, { pooling: 'mean', normalize: true });
      // Output is a Tensor. We need to convert to standard array for transfer.
      const embedding = output.data; // Float32Array
      
      self.postMessage({ id, type, status: 'complete', result: Array.from(embedding) });
    }
  } catch (error) {
    self.postMessage({ id, type, status: 'error', error: error.message });
  }
});
