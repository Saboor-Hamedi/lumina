import {
  pipeline,
  env,
  type FeatureExtractionPipeline,
  type Text2TextGenerationPipeline
} from '@xenova/transformers'

interface ProgressCallbackData {
  status?: string
  progress?: number
  file?: string
  [key: string]: unknown
}

type ProgressCallback = (data: ProgressCallbackData) => void

type WorkerRequestMessage =
  | { id: string | number; type: 'embed'; payload: string | string[] }
  | { id: string | number; type: 'generate'; payload: string }

// Models are fetched from the HF CDN and cached in-browser; no local model bundle is shipped.
env.allowLocalModels = false
env.useBrowserCache = true

class TextEmbedder {
  static task = 'feature-extraction' as const
  static model = 'Xenova/all-MiniLM-L6-v2'
  static instance: Promise<FeatureExtractionPipeline> | null = null

  static async getInstance(
    progress_callback: ProgressCallback | null = null
  ): Promise<FeatureExtractionPipeline> {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, {
        progress_callback: progress_callback ?? undefined
      })
    }
    return this.instance
  }
}

class TextGenerator {
  static task = 'text2text-generation' as const
  static model = 'Xenova/flan-t5-small'
  static instance: Promise<Text2TextGenerationPipeline> | null = null

  static async getInstance(
    progress_callback: ProgressCallback | null = null
  ): Promise<Text2TextGenerationPipeline> {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, {
        progress_callback: progress_callback ?? undefined
      })
    }
    return this.instance
  }
}

self.addEventListener('message', async (event: MessageEvent<WorkerRequestMessage>) => {
  const { id, type, payload } = event.data

  try {
    if (type === 'embed') {
      // Payload: string or array of strings
      const embedder = await TextEmbedder.getInstance((data) => {
        // Send loading progress back for UI
        self.postMessage({ type: 'progress', status: data.status, progress: data.progress })
      })

      const output = await embedder(payload, { pooling: 'mean', normalize: true })
      // Output is a Tensor. We need to convert to standard array for transfer.
      const embedding = output.data as Float32Array

      self.postMessage({ id, type, status: 'complete', result: Array.from(embedding) })
    } else if (type === 'generate') {
      const generator = await TextGenerator.getInstance((data) => {
        // Send loading progress back for UI
        self.postMessage({
          type: 'progress',
          status: data.status,
          progress: data.progress,
          file: data.file
        })
      })

      const output = (await generator(payload, {
        max_new_tokens: 512,
        temperature: 0.7,
        repetition_penalty: 1.2
      })) as Array<{ generated_text: string }>

      self.postMessage({ id, type, status: 'complete', result: output[0].generated_text })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    self.postMessage({ id, type, status: 'error', error: message })
  }
})
