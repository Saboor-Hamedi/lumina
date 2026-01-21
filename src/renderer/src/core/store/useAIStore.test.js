import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAIStore } from './useAIStore'

// Mock Worker
global.Worker = vi.fn(() => ({
  postMessage: vi.fn(),
  onmessage: null,
  terminate: vi.fn()
}))

// Mock window.api
global.window = {
  ...global.window,
  api: {
    searchVault: vi.fn(),
    indexVault: vi.fn(),
    getIndexStats: vi.fn(),
    sendChatMessage: vi.fn()
  }
}

describe('useAIStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state
    useAIStore.setState({
      aiError: null,
      isModelReady: false,
      modelLoadingProgress: 0,
      pendingTasks: new Map(),
      embeddingsCache: {},
      chatMessages: [],
      isChatLoading: false,
      chatError: null
    })
  })

  describe('generateEmbedding', () => {
    it('should create a pending task and post message to worker', () => {
      const { result } = renderHook(() => useAIStore())
      const worker = new Worker()

      act(() => {
        result.current.generateEmbedding('test text')
      })

      expect(worker.postMessage).toHaveBeenCalled()
      expect(result.current.pendingTasks.size).toBe(1)
    })

    it('should resolve when worker responds with complete status', async () => {
      const { result } = renderHook(() => useAIStore())
      const worker = new Worker()
      const embeddingPromise = result.current.generateEmbedding('test text')

      // Simulate worker response
      act(() => {
        const taskId = Array.from(result.current.pendingTasks.keys())[0]
        worker.onmessage({
          data: {
            type: 'embed',
            id: taskId,
            status: 'complete',
            result: [0.1, 0.2, 0.3]
          }
        })
      })

      await expect(embeddingPromise).resolves.toEqual([0.1, 0.2, 0.3])
      expect(result.current.pendingTasks.size).toBe(0)
    })
  })

  describe('searchNotes', () => {
    it('should return empty array for empty query', async () => {
      const { result } = renderHook(() => useAIStore())

      const results = await act(async () => {
        return await result.current.searchNotes('')
      })

      expect(results).toEqual([])
      expect(window.api.searchVault).not.toHaveBeenCalled()
    })

    it('should call searchVault API and map results', async () => {
      const { result } = renderHook(() => useAIStore())
      const mockResults = [
        { id: '1', score: 0.9, finalScore: 0.95 },
        { id: '2', score: 0.8 }
      ]

      window.api.searchVault.mockResolvedValue(mockResults)

      const results = await act(async () => {
        return await result.current.searchNotes('test query', 0.3)
      })

      expect(window.api.searchVault).toHaveBeenCalledWith('test query', {
        threshold: 0.3,
        limit: 20,
        rerank: true
      })
      expect(results).toHaveLength(2)
      expect(results[0].score).toBe(0.95)
    })

    it('should handle API errors gracefully', async () => {
      const { result } = renderHook(() => useAIStore())
      window.api.searchVault.mockRejectedValue(new Error('Search failed'))

      const results = await act(async () => {
        return await result.current.searchNotes('test query')
      })

      expect(results).toEqual([])
    })
  })

  describe('chat functionality', () => {
    it('should send chat message and update state', async () => {
      const { result } = renderHook(() => useAIStore())
      const mockResponse = { content: 'AI response', role: 'assistant' }

      window.api.sendChatMessage.mockResolvedValue(mockResponse)

      await act(async () => {
        await result.current.sendChatMessage('Hello', [])
      })

      expect(window.api.sendChatMessage).toHaveBeenCalledWith('Hello', [])
      expect(result.current.chatMessages.length).toBeGreaterThan(0)
    })

    it('should handle chat errors', async () => {
      const { result } = renderHook(() => useAIStore())
      window.api.sendChatMessage.mockRejectedValue(new Error('Chat failed'))

      await act(async () => {
        await result.current.sendChatMessage('Hello', [])
      })

      expect(result.current.chatError).toBeTruthy()
    })

    it('should clear chat messages', () => {
      const { result } = renderHook(() => useAIStore())

      act(() => {
        useAIStore.setState({ chatMessages: [{ role: 'user', content: 'test' }] })
      })

      expect(result.current.chatMessages.length).toBe(1)

      act(() => {
        result.current.clearChat()
      })

      expect(result.current.chatMessages.length).toBe(0)
    })
  })

  describe('model loading progress', () => {
    it('should update progress when worker sends progress message', () => {
      const { result } = renderHook(() => useAIStore())
      const worker = new Worker()

      act(() => {
        worker.onmessage({
          data: {
            type: 'progress',
            status: 'progress',
            progress: 50
          }
        })
      })

      expect(result.current.modelLoadingProgress).toBe(50)
    })

    it('should set model ready when status is ready', () => {
      const { result } = renderHook(() => useAIStore())
      const worker = new Worker()

      act(() => {
        worker.onmessage({
          data: {
            type: 'progress',
            status: 'ready'
          }
        })
      })

      expect(result.current.isModelReady).toBe(true)
      expect(result.current.modelLoadingProgress).toBe(100)
    })
  })
})
