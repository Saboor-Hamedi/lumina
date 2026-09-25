import React, { useRef, useEffect } from 'react'
import { Search, X, Check, Plus } from 'lucide-react'

const renderMiniPreview = (template) => {
  if (template.id === 'blank') {
    return (
      <div className="template-mini-blank">
        <div className="template-mini-plus-circle">
          <Plus size={14} strokeWidth={2.5} />
        </div>
        <span className="template-mini-blank-label">Empty Note</span>
      </div>
    )
  }

  const code = template.code || ''
  const lowerTitle = (template.title || '').toLowerCase()

  // Checklist / Task / Daily / Weekly
  if (
    code.includes('- [ ]') ||
    code.includes('- [x]') ||
    lowerTitle.includes('daily') ||
    lowerTitle.includes('log') ||
    lowerTitle.includes('weekly') ||
    lowerTitle.includes('habit')
  ) {
    return (
      <div className="template-mini-doc">
        <div className="template-mini-heading-row">
          <div className="template-mini-h1" style={{ width: '56%' }} />
          <div className="template-mini-badge-dot" />
        </div>
        <div className="template-mini-line-subtle" style={{ width: '78%' }} />
        <div className="template-mini-divider" />
        <div className="template-mini-items">
          <div className="template-mini-todo-item">
            <span className="template-mini-checkbox checked" />
            <div className="template-mini-line" style={{ width: '68%' }} />
          </div>
          <div className="template-mini-todo-item">
            <span className="template-mini-checkbox" />
            <div className="template-mini-line" style={{ width: '82%' }} />
          </div>
          <div className="template-mini-todo-item">
            <span className="template-mini-checkbox" />
            <div className="template-mini-line" style={{ width: '52%' }} />
          </div>
        </div>
      </div>
    )
  }

  // Meeting / Interview / Notes / Discussion
  if (
    lowerTitle.includes('meeting') ||
    lowerTitle.includes('interview') ||
    lowerTitle.includes('discussion') ||
    lowerTitle.includes('agenda')
  ) {
    return (
      <div className="template-mini-doc">
        <div className="template-mini-heading-row">
          <div className="template-mini-h1" style={{ width: '62%' }} />
          <div className="template-mini-avatars">
            <span className="template-mini-avatar" />
            <span className="template-mini-avatar" />
          </div>
        </div>
        <div className="template-mini-line-subtle" style={{ width: '45%' }} />
        <div className="template-mini-divider" />
        <div className="template-mini-items">
          <div className="template-mini-bullet-item">
            <span className="template-mini-bullet" />
            <div className="template-mini-line" style={{ width: '74%' }} />
          </div>
          <div className="template-mini-bullet-item">
            <span className="template-mini-bullet" />
            <div className="template-mini-line" style={{ width: '60%' }} />
          </div>
          <div className="template-mini-bullet-item">
            <span className="template-mini-bullet" />
            <div className="template-mini-line" style={{ width: '78%' }} />
          </div>
        </div>
      </div>
    )
  }

  // Table / Project / Matrix / Tracker
  if (
    code.includes('|---') ||
    lowerTitle.includes('project') ||
    lowerTitle.includes('matrix') ||
    lowerTitle.includes('tracker')
  ) {
    return (
      <div className="template-mini-doc">
        <div className="template-mini-h1" style={{ width: '52%' }} />
        <div className="template-mini-table">
          <div className="template-mini-table-head">
            <div className="template-mini-table-cell head" style={{ flex: 1 }} />
            <div className="template-mini-table-cell head" style={{ flex: 1 }} />
            <div className="template-mini-table-cell head" style={{ flex: 1 }} />
          </div>
          <div className="template-mini-table-row">
            <div className="template-mini-table-cell" style={{ flex: 1 }} />
            <div className="template-mini-table-cell" style={{ flex: 1 }} />
            <div className="template-mini-table-cell" style={{ flex: 1 }} />
          </div>
          <div className="template-mini-table-row">
            <div className="template-mini-table-cell" style={{ flex: 1 }} />
            <div className="template-mini-table-cell" style={{ flex: 1 }} />
            <div className="template-mini-table-cell" style={{ flex: 1 }} />
          </div>
        </div>
      </div>
    )
  }

  // Default Standard Markdown Document
  return (
    <div className="template-mini-doc">
      <div className="template-mini-h1" style={{ width: '50%' }} />
      <div className="template-mini-h2" style={{ width: '36%' }} />
      <div className="template-mini-divider" />
      <div className="template-mini-items">
        <div className="template-mini-line" style={{ width: '88%' }} />
        <div className="template-mini-line" style={{ width: '72%' }} />
        <div className="template-mini-line" style={{ width: '54%' }} />
      </div>
    </div>
  )
}

const TemplateSidebar = ({
  templates = [],
  selectedId,
  onSelect,
  onApply,
  searchQuery,
  setSearchQuery,
  isOpen = true
}) => {
  const searchInputRef = useRef(null)
  const activeItemRef = useRef(null)
  const scrollContainerRef = useRef(null)

  useEffect(() => {
    const el = activeItemRef.current
    const container = scrollContainerRef.current
    if (!el || !container) return
    const elTop = el.offsetTop
    const elBottom = elTop + el.offsetHeight
    const containerTop = container.scrollTop
    const containerBottom = containerTop + container.clientHeight

    if (elTop < containerTop) {
      container.scrollTo({ top: elTop - 8, behavior: 'smooth' })
    } else if (elBottom > containerBottom) {
      container.scrollTo({ top: elBottom - container.clientHeight + 8, behavior: 'smooth' })
    }
  }, [selectedId])

  return (
    <aside className={`template-sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="template-sidebar-header">
        <div className="template-search-wrapper">
          <Search size={13} className="template-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="template-search-input"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            spellCheck={false}
          />
          {searchQuery && (
            <button
              className="template-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div ref={scrollContainerRef} className="template-sidebar-scrollable">
        <div className="template-sidebar-count">
          {templates.length} {templates.length === 1 ? 'Template' : 'Templates'}
        </div>

        <div className="template-modal-grid">
          {templates.map((template) => {
            const isSelected = template.id === selectedId
            return (
              <div
                key={template.id}
                ref={isSelected ? activeItemRef : null}
                className={`template-modal-card ${isSelected ? 'active' : ''}`}
                onClick={() => onSelect(template.id)}
                onDoubleClick={() => onApply(template)}
              >
                <div className="template-card-header">
                  <div className="template-title-row">
                    <span className="template-modal-name">{template.title}</span>
                    {isSelected ? (
                      <span className="template-check-badge">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="template-badge">
                        {template.id === 'blank' ? 'BLANK' : 'TEMPLATE'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="template-modal-preview-wrapper">
                  <div className="template-modal-preview">
                    {renderMiniPreview(template)}
                  </div>
                </div>
              </div>
            )
          })}

          {templates.length === 0 && (
            <div className="template-sidebar-empty">
              No matching templates found.
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

export default React.memo(TemplateSidebar)
