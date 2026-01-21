import React from 'react'
import { FileText } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import ModalHeader from './ModalHeader'
import './DetailsModal.css'

/**
 * DetailsModal Component
 * Displays file metadata and statistics in a modal overlay.
 * Replaces the metadata tab in the right sidebar for better space utilization.
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback to close the modal
 * @param {Object} props.snippet - The snippet/note to display details for
 * @param {boolean} props.isLoading - Whether data is still loading
 */
const DetailsModal = ({ isOpen, onClose, snippet, isLoading = false }) => {
  // Handle Escape key to close modal
  useKeyboardShortcuts({
    onEscape: () => {
      if (isOpen) {
        onClose()
        return true
      }
      return false
    }
  })

  // Don't render if modal is closed
  if (!isOpen) return null

  // Get vault path from settings for display
  const vaultPath = useSettingsStore.getState().settings.vaultPath || 'Default Vault'

  return (
    <div className="modal-overlay details-modal-overlay" onClick={onClose}>
      <div
        className="modal-container details-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header - Show only note name with icon, aligned with flex */}
        <ModalHeader
          left={
            <div className="modal-title-stack" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText size={16} className="theme-modal-icon" />
              <span className="theme-modal-title">{snippet?.title || 'Untitled'}</span>
            </div>
          }
          onClose={onClose}
        />

        {/* Modal Body */}
        <div className="details-modal-body">
          {isLoading ? (
            // Loading skeleton state
            <div className="skeleton-inspector">
              <div
                className="skeleton skeleton-text"
                style={{ width: '40%', marginBottom: '12px' }}
              />
              <div
                className="skeleton skeleton-text"
                style={{ width: '80%', marginBottom: '12px' }}
              />
              <div className="skeleton skeleton-text" style={{ width: '60%' }} />
            </div>
          ) : snippet ? (
            // Metadata content - Reusing existing meta-info styles
            <div className="meta-info">
              {/* Properties Section */}
              <div className="meta-section">
                <div className="meta-label">Properties</div>
                <div className="meta-row">
                  <span>Modified</span>
                  <span className="meta-value">
                    {new Date(snippet.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="meta-row">
                  <span>Type</span>
                  <span className="meta-value badge">{snippet.language}</span>
                </div>
                <div className="meta-row">
                  <span>Location</span>
                  <span
                    className="meta-value path-hint"
                    title={vaultPath}
                  >
                    {vaultPath.split(/[/\\]/).pop()}
                  </span>
                </div>
              </div>

              {/* Separator */}
              <div className="meta-separator" />

              {/* Statistics Section */}
              <div className="meta-section">
                <div className="meta-label">Statistics</div>
                <div className="meta-grid">
                  <div className="stat-box">
                    <div className="stat-value">{snippet.code?.length || 0}</div>
                    <div className="stat-label">Chars</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-value">
                      {snippet.code?.trim()
                        ? snippet.code.trim().split(/\s+/).length
                        : 0}
                    </div>
                    <div className="stat-label">Words</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-value">
                      {Math.ceil((snippet.code?.trim().split(/\s+/).length || 0) / 200)}m
                    </div>
                    <div className="stat-label">Read</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Empty state when no snippet is selected
            <div className="panel-empty">No file selected</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DetailsModal
