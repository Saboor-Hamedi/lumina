import React, { useMemo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  FileText,
  Folder,
  Star,
  HardDrive,
  FileCode,
  Image,
  Layers,
  X
} from 'lucide-react'
import { useVaultStore } from '../../../core/store/workspaceStore'
import './VaultStats.css'

export const VaultStats = ({ isOpen, onClose, anchorRef }) => {
  const popoverRef = useRef(null)
  const snippets = useVaultStore((state) => state.snippets)
  const folders = useVaultStore((state) => state.folders)
  const [coords, setCoords] = useState(null)

  const stats = useMemo(() => {
    const noteSnippets = snippets.filter((s) => s.type !== 'image')
    const imageSnippets = snippets.filter((s) => s.type === 'image')

    const totalNotes = noteSnippets.length
    const totalImages = imageSnippets.length
    const folderSet = new Set(folders || [])

    snippets.forEach((s) => {
      if (s.folderId) folderSet.add(s.folderId)
    })
    const totalFolders = folderSet.size

    let pinnedCount = 0
    let learnedCount = 0
    let totalWords = 0
    let totalChars = 0
    let totalLines = 0
    let totalTextBytes = 0
    let totalMediaBytes = 0

    noteSnippets.forEach((s) => {
      if (s.isPinned) pinnedCount++
      if (s.isLearned) learnedCount++

      const text = s.code || ''
      totalChars += text.length
      totalTextBytes += (new TextEncoder().encode(text)).length

      if (text.trim()) {
        const words = text.trim().split(/\s+/).filter(Boolean).length
        totalWords += words
        totalLines += text.split(/\r?\n/).length
      }
    })

    imageSnippets.forEach((img) => {
      if (img.isPinned) pinnedCount++
      totalMediaBytes += img.size || 0
    })

    const formatBytes = (bytes) => {
      if (!bytes || bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
    }

    const formatNumber = (num) => {
      return new Intl.NumberFormat('en-US').format(num)
    }

    const learnedPercent = totalNotes > 0 ? Math.round((learnedCount / totalNotes) * 100) : 0

    return {
      totalNotes: formatNumber(totalNotes),
      totalImages: formatNumber(totalImages),
      totalFolders: formatNumber(totalFolders),
      pinnedCount: formatNumber(pinnedCount),
      learnedCount: formatNumber(learnedCount),
      learnedPercent,
      totalWords: formatNumber(totalWords),
      totalChars: formatNumber(totalChars),
      totalLines: formatNumber(totalLines),
      storageSize: formatBytes(totalTextBytes),
      mediaStorageSize: formatBytes(totalMediaBytes)
    }
  }, [snippets, folders])

  useEffect(() => {
    if (!isOpen || !anchorRef?.current) return

    const updatePosition = () => {
      if (!anchorRef.current) return
      const rect = anchorRef.current.getBoundingClientRect()
      const popoverWidth = 280
      const popoverHeight = 320

      let top = rect.bottom + 6
      let left = rect.left

      if (left + popoverWidth > window.innerWidth - 12) {
        left = window.innerWidth - popoverWidth - 12
      }
      if (left < 12) left = 12

      if (top + popoverHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - popoverHeight - 6)
      }

      setCoords({
        top: Math.round(top),
        left: Math.round(left)
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    return () => window.removeEventListener('resize', updatePosition)
  }, [isOpen, anchorRef])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        (!anchorRef?.current || !anchorRef.current.contains(e.target))
      ) {
        onClose()
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('pointerdown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, anchorRef])

  if (!isOpen || !coords) return null

  return createPortal(
    <div
      ref={popoverRef}
      className="vault-stats-popover"
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`
      }}
      role="dialog"
      aria-label="Workspace Details"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="vault-stats-header">
        <div className="vault-stats-title-wrap">
          <Layers size={13} className="vault-stats-title-icon" />
          <span className="vault-stats-title">Workspace Details</span>
        </div>
        <button
          className="vault-stats-close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={12} />
        </button>
      </div>

      <div className="vault-stats-grid">
        <div className="vault-stats-card">
          <div className="vault-stats-card-icon">
            <FileText size={13} />
          </div>
          <div className="vault-stats-card-data">
            <span className="vault-stats-value">{stats.totalNotes}</span>
            <span className="vault-stats-label">Notes</span>
          </div>
        </div>

        <div className="vault-stats-card">
          <div className="vault-stats-card-icon" style={{ color: '#38bdf8' }}>
            <Image size={13} />
          </div>
          <div className="vault-stats-card-data">
            <span className="vault-stats-value">{stats.totalImages}</span>
            <span className="vault-stats-label">Images</span>
          </div>
        </div>

        <div className="vault-stats-card">
          <div className="vault-stats-card-icon">
            <Folder size={13} />
          </div>
          <div className="vault-stats-card-data">
            <span className="vault-stats-value">{stats.totalFolders}</span>
            <span className="vault-stats-label">Folders</span>
          </div>
        </div>

        <div className="vault-stats-card">
          <div className="vault-stats-card-icon">
            <Star size={13} />
          </div>
          <div className="vault-stats-card-data">
            <span className="vault-stats-value">{stats.pinnedCount}</span>
            <span className="vault-stats-label">Favorites</span>
          </div>
        </div>
      </div>

      <div className="vault-stats-section">
        <div className="vault-stats-section-title">CONTENT VOLUME</div>
        <div className="vault-stats-row">
          <span className="vault-stats-row-label">
            <FileCode size={12} /> Total Words
          </span>
          <span className="vault-stats-row-value">{stats.totalWords}</span>
        </div>
        <div className="vault-stats-row">
          <span className="vault-stats-row-label">Total Characters</span>
          <span className="vault-stats-row-value">{stats.totalChars}</span>
        </div>
        <div className="vault-stats-row">
          <span className="vault-stats-row-label">Total Lines</span>
          <span className="vault-stats-row-value">{stats.totalLines}</span>
        </div>
      </div>

      <div className="vault-stats-section">
        <div className="vault-stats-section-title">STORAGE & MEDIA</div>
        <div className="vault-stats-row">
          <span className="vault-stats-row-label">
            <HardDrive size={12} /> Text Size
          </span>
          <span className="vault-stats-row-value">{stats.storageSize}</span>
        </div>
        <div className="vault-stats-row">
          <span className="vault-stats-row-label">
            <Image size={12} /> Images & Media
          </span>
          <span className="vault-stats-row-value">
            {stats.totalImages} files ({stats.mediaStorageSize})
          </span>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default React.memo(VaultStats)
