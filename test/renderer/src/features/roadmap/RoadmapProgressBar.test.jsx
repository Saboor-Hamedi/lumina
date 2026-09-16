import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ProgressTracker, {
  LearnedButton,
  LearningTrackBadge
} from '../../../../../src/renderer/src/features/roadmap/ProgressTracker'
import { useWorkspaceStore } from '../../../../../src/renderer/src/core/store/workspaceStore'

describe('ProgressTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceStore.setState({
      notes: [],
      snippets: [],
      selectedNote: null,
      selectedSnippet: null
    })
  })

  describe('LearnedButton', () => {
    it('renders nothing when no snippet id', () => {
      const { container } = render(<LearnedButton snippet={null} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders Learn when not learned', () => {
      render(<LearnedButton snippet={{ id: '1', title: 'Note' }} />)
      expect(screen.getByText('Learn')).toBeInTheDocument()
    })

    it('renders Learned when snippet isLearned', () => {
      const note = { id: '1', title: 'Note', isLearned: true }
      useWorkspaceStore.setState({ notes: [note], snippets: [note] })
      render(<LearnedButton snippet={{ id: '1', title: 'Note' }} />)
      expect(screen.getByText('Learned')).toBeInTheDocument()
    })

    it('toggles isLearned via saveSnippet', async () => {
      const saveSnippet = vi.fn().mockResolvedValue(undefined)
      const note = { id: '1', title: 'Note', isLearned: false }
      useWorkspaceStore.setState({
        notes: [note],
        snippets: [note],
        saveSnippet,
        saveNote: saveSnippet
      })
      render(<LearnedButton snippet={{ id: '1', title: 'Note' }} />)

      fireEvent.click(screen.getByText('Learn'))
      await vi.waitFor(() => {
        expect(saveSnippet).toHaveBeenCalledWith(
          expect.objectContaining({ id: '1', isLearned: true })
        )
      })
    })

    it('logs error when save fails', async () => {
      const saveSnippet = vi.fn().mockRejectedValue(new Error('boom'))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const note = { id: '1', title: 'Note', isLearned: false }
      useWorkspaceStore.setState({
        notes: [note],
        snippets: [note],
        saveSnippet,
        saveNote: saveSnippet
      })
      render(<LearnedButton snippet={{ id: '1', title: 'Note' }} />)

      fireEvent.click(screen.getByText('Learn'))
      await vi.waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith(
          '[ProgressTracker] Failed to toggle learned status:',
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

    it('shows count when nothing learned', () => {
      const list = [{ id: '1' }, { id: '2' }]
      useWorkspaceStore.setState({
        notes: list,
        snippets: list
      })
      render(<LearningTrackBadge />)
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('shows correct count or percentage', () => {
      const list = [
        { id: '1', isLearned: true },
        { id: '2', isLearned: true },
        { id: '3' }
      ]
      useWorkspaceStore.setState({
        notes: list,
        snippets: list
      })
      render(<LearningTrackBadge />)
      expect(screen.getByText('67%')).toBeInTheDocument()
    })
  })

  describe('default ProgressTracker', () => {
    it('renders nothing when no snippets', () => {
      const { container } = render(<ProgressTracker />)
      expect(container.firstChild).toBeNull()
    })

    it('renders progress bar with correct height', () => {
      const list = [
        { id: '1', isLearned: true },
        { id: '2' }
      ]
      useWorkspaceStore.setState({
        notes: list,
        snippets: list
      })
      render(<ProgressTracker />)
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('shows 100% when all learned', () => {
      const list = [{ id: '1', isLearned: true }]
      useWorkspaceStore.setState({ notes: list, snippets: list })
      render(<ProgressTracker />)
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })
})
