import React from 'react'
import { Brain, Check } from 'lucide-react'

export const MemoryBadge = React.memo(({ content = '' }) => {
  const clean = (content || '').trim()
  let text = 'Saved to memory'
  if (clean.toLowerCase().includes('clear') || clean.toLowerCase().includes('remov')) {
    text = 'Removed from memory'
  } else if (clean.toLowerCase().includes('update')) {
    text = 'Memory updated'
  }

  const tooltip = clean && clean !== text ? clean : undefined

  return (
    <div className="lumina-memory-badge" title={tooltip}>
      <Brain size={12} className="lumina-memory-badge-icon" />
      <span className="lumina-memory-badge-text">{text}</span>
      <Check size={11} className="lumina-memory-badge-check" />
    </div>
  )
})

export default MemoryBadge
