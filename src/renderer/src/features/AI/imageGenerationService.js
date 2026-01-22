/**
 * Image Generation Service
 * Handles image generation using Stable Diffusion API (Hugging Face)
 *
 * This service is separate from chat to maintain performance and modularity.
 */

// Use Hugging Face Inference library
import { HfInference } from '@huggingface/inference'
const TIMEOUT_MS = 90000 // 90 seconds (image generation can take longer)
const MAX_RETRIES = 3

/**
 * Test API connectivity
 * @returns {Promise<boolean>} - True if API is reachable
 */
export async function testAPIConnectivity() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second test timeout

    try {
      const hf = new HfInference()
      await hf.listModels({ signal: controller.signal })
      clearTimeout(timeoutId)
      return true
    } catch (err) {
      clearTimeout(timeoutId)
      // Try a simple GET to check if the domain is reachable
      try {
        await fetch('https://huggingface.co', {
          method: 'HEAD',
          signal: controller.signal,
          mode: 'no-cors' // This will work even with CORS issues
        })
        return true
      } catch {
        return false
      }
    }
  } catch {
    return false
  }
}

/**
 * Generate an image from a text prompt using Stable Diffusion
 * @param {string} prompt - The text description of the image to generate
 * @param {string} [apiKey] - Optional Hugging Face API key (starts with hf_)
 * @param {AbortController} [controller] - Optional abort controller for cancellation
 * @returns {Promise<{imageUrl: string, prompt: string}>} - The generated image URL and prompt
 */
export async function generateImage(prompt, apiKey = null, controller = null) {
  // Input validation
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Prompt cannot be empty.')
  }

  const trimmedPrompt = prompt.trim()

  // Check connectivity
  if (!navigator.onLine) {
    throw new Error('No internet connection. Please check your network.')
  }

  // Log API key status (without exposing the key)
  if (apiKey) {
    console.log('[ImageGen] Using Hugging Face API key:', apiKey.substring(0, 7) + '...')
  } else {
    console.log('[ImageGen] Using free tier (no API key)')
  }

  // Create abort controller if not provided
  const abortController = controller || new AbortController()
  let timeoutId = null

  try {
    // Set timeout
    timeoutId = setTimeout(() => {
      abortController.abort()
    }, TIMEOUT_MS)

    // Prepare headers with API key if provided
    const headers = {
      'Content-Type': 'application/json'
    }
    if (apiKey && typeof apiKey === 'string' && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`
    }

    // Use Hugging Face Router API directly (HfInference uses deprecated endpoint)
    const routerUrl =
      'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell'
    console.log('[ImageGen] Using HF Router API with model: black-forest-labs/FLUX.1-schnell')

    let imageBlob
    try {
      const response = await fetch(routerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { Authorization: `Bearer ${apiKey}` })
        },
        body: JSON.stringify({
          inputs: trimmedPrompt,
          parameters: {
            // Add any additional parameters if needed
          }
        }),
        signal: abortController.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      imageBlob = await response.blob()
    } catch (err) {
      const errorMsg = err.message || err.toString() || 'Unknown error'
      console.error('[ImageGen] HF Router API failed:', errorMsg)
      throw new Error(`Failed to generate image: ${errorMsg}`)
    }

    // Clear timeout on successful response
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    // Validate blob size (should be > 0)
    if (imageBlob.size === 0) {
      throw new Error('Received empty image from generation service.')
    }

    // Convert blob to data URL for display
    const imageUrl = await blobToDataURL(imageBlob)

    return {
      imageUrl,
      prompt: trimmedPrompt,
      timestamp: Date.now()
    }
  } catch (error) {
    // Clean up timeout
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // Handle abort errors
    if (error.name === 'AbortError') {
      throw new Error('Image generation was cancelled or timed out.')
    }

    // Log detailed error for debugging
    console.error('[ImageGen] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    })

    // Provide more helpful error messages
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error(
        'Network error: Unable to connect to Hugging Face API. This might be due to CORS restrictions or network issues. Please check your internet connection and try again.'
      )
    }

    // Re-throw with context
    throw error
  }
}

/**
 * Convert a blob to a data URL
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} - The data URL
 */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Generate image with retry logic
 * @param {string} prompt - The text description
 * @param {string} [apiKey] - Optional Hugging Face API key
 * @param {AbortController} [controller] - Optional abort controller
 * @returns {Promise<{imageUrl: string, prompt: string}>}
 */
export async function generateImageWithRetry(prompt, apiKey = null, controller = null) {
  let lastError = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await generateImage(prompt, apiKey, controller)
    } catch (error) {
      lastError = error

      // Don't retry on certain errors
      if (
        error.message.includes('cancelled') ||
        error.message.includes('timeout') ||
        error.message.includes('Rate limit') ||
        error.message.includes('No internet') ||
        error.message.includes('not available')
      ) {
        throw error
      }

      // Wait before retry (exponential backoff)
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 2000 // 2s, 4s, 8s (longer for image generation)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  // Provide helpful error message
  const errorMsg = lastError?.message || 'Image generation failed after retries.'
  console.error('[ImageGen] Final error after retries:', errorMsg)

  if (
    errorMsg.includes('Failed to fetch') ||
    errorMsg.includes('NetworkError') ||
    errorMsg.includes('network')
  ) {
    throw new Error(
      'Network error: Unable to connect to Hugging Face API. Please check:\n1. Your internet connection\n2. Firewall/proxy settings\n3. Try again in a few moments\n\nIf the issue persists, the free API may be temporarily unavailable.'
    )
  }

  if (errorMsg.includes('CORS') || errorMsg.includes('cors')) {
    throw new Error(
      'CORS error: The API request was blocked. This might be an Electron security restriction. Please try again or check your network settings.'
    )
  }

  throw (
    lastError ||
    new Error(
      'Image generation failed. The free service may be temporarily unavailable. Please try again later.'
    )
  )
}

/**
 * Validate if a string looks like an image generation request
 * @param {string} text - The text to check
 * @returns {boolean} - True if it looks like an image prompt
 */
export function isImageGenerationRequest(text) {
  if (!text || typeof text !== 'string') return false

  const trimmed = text.trim().toLowerCase()

  // Check for image generation commands (with / prefix)
  const imageCommands = ['/image', '/img', '/generate', '/draw', '/create image']
  if (imageCommands.some((cmd) => trimmed.startsWith(cmd))) {
    return true
  }

  // Check for natural language image generation requests
  const imagePhrases = [
    'draw ',
    'generate image',
    'create image',
    'make image',
    'show image',
    'image of',
    'picture of',
    'photo of'
  ]

  // Check if message starts with an image phrase
  if (imagePhrases.some((phrase) => trimmed.startsWith(phrase))) {
    return true
  }

  // Check for "draw a/an/the" pattern
  if (/^draw\s+(a|an|the|some|any)\s+/i.test(trimmed)) {
    return true
  }

  // Check for questions about image generation (e.g., "can you generate image?")
  if (
    /^(can you|could you|please|will you)\s+(generate|create|make|draw|show)\s+(an?\s+)?image/i.test(
      trimmed
    )
  ) {
    return true
  }

  // Check if message contains image generation intent
  if (
    /generate.*image|create.*image|make.*image|draw.*image/i.test(trimmed) &&
    trimmed.length < 100
  ) {
    return true
  }

  return false
}

/**
 * Extract prompt from image generation command
 * @param {string} text - The full command text
 * @returns {string} - The extracted prompt
 */
export function extractImagePrompt(text) {
  if (!text || typeof text !== 'string') return ''

  const trimmed = text.trim()

  // Remove command prefix (with /)
  let withoutCommand = trimmed.replace(/^\/(image|img|generate|draw|create image)\s*/i, '').trim()

  // If still has command-like prefix, try removing natural language prefixes
  if (withoutCommand === trimmed || !withoutCommand) {
    // Remove natural language image generation phrases
    withoutCommand = trimmed
      .replace(
        /^(can you|could you|please|will you)\s+(generate|create|make|draw|show)\s+(an?\s+)?image\s+(of\s+)?/i,
        ''
      )
      .replace(
        /^(draw|generate|create|make|show)\s+(an?\s+|the\s+|some\s+|any\s+)?(image\s+of\s+|image\s+|picture\s+of\s+|photo\s+of\s+)?/i,
        ''
      )
      .trim()
  }

  // If empty after removing command, use the original text
  return withoutCommand || trimmed
}
