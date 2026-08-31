import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RoadmapProgressBar, {
  LearnedButton,
  LearningTrackBadge
} from '../../../../../src/renderer/src/features/roadmap/RoadmapProgressBar'
import { useVaultStore } from '../../../../../src/renderer/src/core/store/useVaultStore'

describe('RoadmapProgressBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useVaultStore.setState({
      snippets: [],
      selectedSnippet: null
    })
  })

  describe('LearnedButton', () => {
    it('renders nothing when no snippet id', () => {
      const { container } = render(<LearnedButton snippet={null} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders Mark Learned when not learned', () => {
      render(<LearnedButton snippet={{ id: '1', title: 'Note' }} />)
      expect(screen.getByText('Mark Learned')).toBeInTheDocument()
    })

    it('renders Learned when snippet isLearned', () => {
      useVaultStore.setState({ snippets: [{ id: '1', title: 'Note', isLearned: true }] })
      render(<LearnedButton snippet={{ id: '1', title: 'Note' }} />)
      expect(screen.getByText('Learned')).toBeInTheDocument()
    })

    it('toggles isLearned via saveSnippet', async () => {
      const saveSnippet = vi.fn().mockResolvedValue(undefined)
      useVaultStore.setState({
        snippets: [{ id: '1', title: 'Note', isLearned: false }],
        saveSnippet
      })
      render(<LearnedButton snippet={{ id: '1', title: 'Note' }} />)

      fireEvent.click(screen.getByText('Mark Learned'))
      expect(saveSnippet).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1', isLearned: true })
      )
    })

    it('logs error when save fails', async () => {
      const saveSnippet = vi.fn().mockRejectedValue(new Error('boom'))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      useVaultStore.setState({
        snippets: [{ id: '1', title: 'Note', isLearned: false }],
        saveSnippet
      })
      render(<LearnedButton snippet={{ id: '1', title: 'Note' }} />)

      fireEvent.click(screen.getByText('Mark Learned'))
      await vi.waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith(
          'Failed to toggle learned status:',
          expect.any(Error)
        )
      })
    })
  })

  describe('LearningTrackBadge', () => {
    it('renders nothing when no snippets', () => {
      const { container } = render(<LearningTrackBadge />)
      expect(container.firstChild).toBeNull()
    })

    it('shows 0% when nothing learned', () => {
      useVaultStore.setState({
        snippets: [{ id: '1' }, { id: '2' }]
      })
      render(<LearningTrackBadge />)
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('shows correct percentage', () => {
      useVaultStore.setState({
        snippets: [
          { id: '1', isLearned: true },
          { id: '2', isLearned: true },
          { id: '3' }
        ]
      })
      render(<LearningTrackBadge />)
      // 2 of 3 = 67%
      expect(screen.getByText('67%')).toBeInTheDocument()
    })
  })

  describe('default RoadmapProgressBar', () => {
    it('renders nothing when no snippets', () => {
      const { container } = render(<RoadmapProgressBar />)
      expect(container.firstChild).toBeNull()
    })

    it('renders progress edge with correct width', () => {
      useVaultStore.setState({
        snippets: [
          { id: '1', isLearned: true },
          { id: '2' }
        ]
      })
      const { container } = render(<RoadmapProgressBar />)
      const edge = container.querySelector('.learning-track-progress-edge')
      expect(edge).toBeInTheDocument()
      // fill is first child div
      const fill = edge.querySelector('div')
      expect(fill.style.width).toBe('50%')
    })

    it('shows 100% when all learned', () => {
      useVaultStore.setState({ snippets: [{ id: '1', isLearned: true }] })
      const { container } = render(<RoadmapProgressBar />)
      const fill = container.querySelector('.learning-track-progress-edge div')
      expect(fill.style.width).toBe('100%')
    })
  })
})
