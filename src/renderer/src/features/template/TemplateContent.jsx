import React, { useMemo } from 'react'
import { Check, FileText, Plus, Sparkles, Clock } from 'lucide-react'
import { PreviewCommandPalette } from '../commandpalette/PreviewCommandPalette'

const TemplateContent = ({ template, onApply }) => {
  const isBlank = !template || template.id === 'blank' || !template.code

  const stats = useMemo(() => {
    if (!template?.code) return { words: 0, lines: 0, minutes: 1 }
    const words = template.code.split(/\s+/).filter(Boolean).length
    const lines = template.code.split('\n').length
    const minutes = Math.max(1, Math.ceil(words / 200))
    return { words, lines, minutes }
  }, [template?.code])

  const footerAction = (
    <div className="template-content-footer">
      <div className="template-footer-stats">
        <span className="template-stat-item">
          <FileText size={12} /> {stats.lines} lines
        </span>
        <span className="template-stat-sep" />
        <span className="template-stat-item">
          <Sparkles size={12} /> {stats.words} words
        </span>
        <span className="template-stat-sep" />
        <span className="template-stat-item">
          <Clock size={12} /> ~{stats.minutes} min
        </span>
      </div>

      <div className="template-footer-actions">
        <span className="template-footer-hint">Press <kbd>Enter</kbd> to apply</span>
        <button
          className="template-primary-btn"
          onClick={() => onApply(template)}
          aria-label="Use this template"
        >
          <Check size={14} strokeWidth={2.5} />
          <span>Use Template</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="template-content">
      {isBlank ? (
        <div className="template-blank-view">
          <div className="template-blank-card">
            <div className="template-blank-icon-wrap">
              <Plus size={32} />
            </div>
            <h3 className="template-blank-title">Blank Canvas</h3>
            <p className="template-blank-desc">
              Start fresh with a clean, empty note. No predefined headings, tables, or boilerplate.
            </p>
            <button
              className="template-primary-btn"
              onClick={() => onApply(template)}
              style={{ marginTop: '16px' }}
            >
              <Check size={14} strokeWidth={2.5} />
              <span>Create Blank Note</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="template-preview-wrapper">
          <PreviewCommandPalette
            content={template.code}
            footerNav={footerAction}
          />
        </div>
      )}
    </div>
  )
}

export default React.memo(TemplateContent)
