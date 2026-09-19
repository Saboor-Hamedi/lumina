import React from 'react'
import { Brain, Check } from 'lucide-react'
import '../css/memoryBadge.css'

export interface MemoryBadgeProps {
  content?: string
}

/**
 * MemoryBadge component indicates whether user preference or profile fact
 * was successfully committed or cleared from local memory.
 */
export const MemoryBadge: React.FC<MemoryBadgeProps> = React.memo(({ content = '' }) => {
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
      <Brain size={11} className="lumina-memory-badge-icon" />
      <span className="lumina-memory-badge-text">{text}</span>
      <Check size={10} className="lumina-memory-badge-check" />
    </div>
  )
})

export const LuminaMemoryBadge = MemoryBadge
export default MemoryBadge
