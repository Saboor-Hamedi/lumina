import React from 'react'
import { Check, Plus } from 'lucide-react'
import { PreviewCommandPalette } from '../commandpalette/PreviewCommandPalette'

const TemplateContent = ({ template, onApply }) => {
  const isBlank = !template || template.id === 'blank' || !template.code

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
          />
        </div>
      )}
    </div>
  )
}

export default React.memo(TemplateContent)
