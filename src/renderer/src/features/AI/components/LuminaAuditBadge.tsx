import React, { useState, useMemo } from 'react'
import {
  Compass,
  Link2,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText
} from 'lucide-react'
import { openNoteInEditor } from './LuminaChatLink'

export interface AuditBadgeData {
  totalNotesScanned?: number
  totalLinksFound?: number
  healthyLinksCount?: number
  brokenLinksCount?: number
  orphanNotesCount?: number
  brokenLinks?: Array<{ sourceNote: string; targetNote: string; folder?: string }>
  orphanNotes?: string[]
  missingTargets?: string[]
  isScanning?: boolean
}

export interface LuminaAuditBadgeProps {
  content?: string
  isStreaming?: boolean
}

export const LuminaAuditBadge: React.FC<LuminaAuditBadgeProps> = React.memo(
  ({ content = '', isStreaming = false }) => {
    const [isExpanded, setIsExpanded] = useState<boolean>(false)

    const auditData: AuditBadgeData = useMemo(() => {
      if (!content) return { isScanning: isStreaming }
      const clean = content.trim()
      try {
        if (clean.startsWith('{') && clean.endsWith('}')) {
          const parsed = JSON.parse(clean)
          return { ...parsed, isScanning: isStreaming || Boolean(parsed.isScanning) }
        }
      } catch (_) {}

      // Fallback: parse numbers from markdown summary table
      const notesMatch = clean.match(/Total Notes Scanned\s*\|\s*\*?\*?(\d[\d,]*)\*?\*?/i)
      const linksMatch = clean.match(/Total (?:Wiki)?links (?:Found|Analyzed)\s*\|\s*\*?\*?(\d[\d,]*)\*?\*?/i)
      const healthyMatch = clean.match(/Valid Connected Links\s*\|\s*\*?\*?(\d[\d,]*)\*?\*?/i)
      const brokenMatch = clean.match(/Broken \/ Missing Links\s*\|\s*\*?\*?(\d[\d,]*)\*?\*?/i)
      const orphanMatch = clean.match(/Orphan Notes[^|]*\|\s*\*?\*?(\d[\d,]*)\*?\*?/i)

      const parseNum = (m: RegExpMatchArray | null) =>
        m ? parseInt(m[1].replace(/,/g, ''), 10) : undefined

      return {
        totalNotesScanned: parseNum(notesMatch),
        totalLinksFound: parseNum(linksMatch),
        healthyLinksCount: parseNum(healthyMatch),
        brokenLinksCount: parseNum(brokenMatch),
        orphanNotesCount: parseNum(orphanMatch),
        isScanning: isStreaming
      }
    }, [content, isStreaming])

    const isScanning = Boolean(auditData.isScanning || (isStreaming && !auditData.totalNotesScanned))
    const totalNotes = auditData.totalNotesScanned ?? null
    const totalLinks = auditData.totalLinksFound ?? 0
    const brokenCount = auditData.brokenLinksCount ?? (auditData.brokenLinks?.length || 0)
    const orphanCount = auditData.orphanNotesCount ?? (auditData.orphanNotes?.length || 0)

    return (
      <div className={`lumina-audit-card ${isExpanded ? 'expanded' : 'collapsed'} ${isScanning ? 'scanning' : 'complete'}`}>
        <div
          className="lumina-audit-header"
          onClick={() => {
            if (!isScanning) setIsExpanded((prev) => !prev)
          }}
        >
          <div className="lumina-audit-title-group">
            <div className={`lumina-audit-icon-badge ${isScanning ? 'pulse' : ''}`}>
              <Compass size={13} className={`lumina-audit-icon ${isScanning ? 'spinning-radar' : ''}`} />
            </div>

            <div className="lumina-audit-text-block">
              {isScanning ? (
                <div className="lumina-audit-scanning-row">
                  <span className="lumina-audit-main-title">
                    Scanning workspace links
                  </span>
                  {totalNotes ? (
                    <span className="lumina-audit-subcount">({totalNotes.toLocaleString()} notes)</span>
                  ) : null}
                  <span className="lumina-audit-radar-pulse" />
                </div>
              ) : (
                <div className="lumina-audit-complete-row">
                  <span className="lumina-audit-main-title">
                    Workspace Links Checked
                  </span>
                  {totalNotes !== null && (
                    <span className="lumina-audit-badge-pill pill-neutral">
                      {totalNotes.toLocaleString()} notes
                    </span>
                  )}
                  {totalLinks > 0 && (
                    <span className="lumina-audit-badge-pill pill-healthy">
                      {totalLinks.toLocaleString()} links
                    </span>
                  )}
                  {brokenCount > 0 ? (
                    <span className="lumina-audit-badge-pill pill-warning">
                      {brokenCount} broken
                    </span>
                  ) : (
                    <span className="lumina-audit-badge-pill pill-healthy">
                      0 broken
                    </span>
                  )}
                  {orphanCount > 0 && (
                    <span className="lumina-audit-badge-pill pill-orphan">
                      {orphanCount} orphans
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="lumina-audit-controls">
            {isScanning ? (
              <span className="lumina-audit-scanner-track">
                <span className="lumina-audit-scanner-beam" />
              </span>
            ) : (
              <div className="lumina-audit-status-right">
                <span className="lumina-audit-check-icon">
                  <Check size={11} />
                </span>
                <span className="lumina-audit-chevron">
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Expandable Details Drawer */}
        {!isScanning && isExpanded && (
          <div className="lumina-audit-body">
            {/* Metric Pills Grid */}
            <div className="lumina-audit-metrics-grid">
              <div className="lumina-audit-metric-card metric-notes">
                <span className="metric-val">{(totalNotes ?? 0).toLocaleString()}</span>
                <span className="metric-label">Notes Scanned</span>
              </div>
              <div className="lumina-audit-metric-card metric-links">
                <span className="metric-val">{totalLinks.toLocaleString()}</span>
                <span className="metric-label">Links</span>
              </div>
              <div className="lumina-audit-metric-card metric-broken">
                <span className="metric-val">{brokenCount.toLocaleString()}</span>
                <span className="metric-label">Broken Links</span>
              </div>
              <div className="lumina-audit-metric-card metric-orphans">
                <span className="metric-val">{orphanCount.toLocaleString()}</span>
                <span className="metric-label">Orphan Notes</span>
              </div>
            </div>

            {/* Broken Links List */}
            {auditData.brokenLinks && auditData.brokenLinks.length > 0 && (
              <div className="lumina-audit-detail-section">
                <div className="lumina-audit-section-header">
                  <AlertTriangle size={12} className="warning-icon" />
                  <span>Broken References (Notes that don&apos;t exist yet)</span>
                </div>
                <div className="lumina-audit-items-list">
                  {auditData.brokenLinks.slice(0, 10).map((item, idx) => (
                    <div key={`bl-${idx}`} className="lumina-audit-broken-item">
                      <span
                        className="lumina-audit-source-link"
                        onClick={() => openNoteInEditor(item.sourceNote)}
                        title={`Open ${item.sourceNote}`}
                      >
                        <FileText size={11} />
                        {item.sourceNote}
                      </span>
                      <span className="lumina-audit-arrow">➔</span>
                      <span className="lumina-audit-target-missing">
                        [[{item.targetNote}]]
                      </span>
                    </div>
                  ))}
                  {auditData.brokenLinks.length > 10 && (
                    <div className="lumina-audit-more-indicator">
                      + {auditData.brokenLinks.length - 10} more broken links
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Orphan Notes List */}
            {auditData.orphanNotes && auditData.orphanNotes.length > 0 && (
              <div className="lumina-audit-detail-section">
                <div className="lumina-audit-section-header">
                  <Link2 size={12} className="orphan-icon" />
                  <span>Orphan Notes (Isolated with zero connections)</span>
                </div>
                <div className="lumina-audit-orphans-wrap">
                  {auditData.orphanNotes.slice(0, 16).map((title, idx) => (
                    <span
                      key={`orph-${idx}`}
                      className="lumina-audit-orphan-pill"
                      onClick={() => openNoteInEditor(title)}
                      title={`Open ${title}`}
                    >
                      {title}
                    </span>
                  ))}
                  {auditData.orphanNotes.length > 16 && (
                    <span className="lumina-audit-more-indicator">
                      + {auditData.orphanNotes.length - 16} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
)

export default LuminaAuditBadge
