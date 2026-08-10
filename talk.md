import React, { useState } from 'react'
import { Calendar, Sparkles } from 'lucide-react'
import { Calendar, Plus } from 'lucide-react'
const EditorMetadata = ({ snippet, title, setTitle, setIsDirty, titleRef }) => {
  const [error, setError] = useState(false)
          Title cannot be empty
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px', marginBottom: '8px' }}>
        <button
          onClick={(e) => {
            e.preventDefault()
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
          }}
          style={{
            background: 'var(--bg-active)',
            border: '1px solid rgba(255,255,255,0.05)',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--text-faint)',
            fontSize: '11px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            gap: '4px',
            cursor: 'pointer',
            padding: '4px 14px',
            borderRadius: '16px',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            opacity: 0.7,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            padding: '2px 8px',
            borderRadius: '5px',
            transition: 'all 0.15s ease',
            opacity: 0.8
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = 1
            e.currentTarget.style.background = 'color-mix(in srgb, var(--bg-active), transparent 20%)'
            e.currentTarget.style.background = 'var(--bg-active)'