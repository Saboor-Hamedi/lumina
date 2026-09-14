import React from 'react'
import type { InlineShapeType, InlineColor } from './inlineTypes'

export interface InlineShapeDefinition {
  id: InlineShapeType
  label: string
  defaultWidth: number
  defaultHeight: number
  description: string
}

export const INLINE_SHAPES: InlineShapeDefinition[] = [
  { id: 'rectangle', label: 'Rectangle', defaultWidth: 150, defaultHeight: 90, description: 'Block / Box' },
  { id: 'rounded-rectangle', label: 'Rounded', defaultWidth: 150, defaultHeight: 90, description: 'Card / State' },
  { id: 'circle', label: 'Circle', defaultWidth: 110, defaultHeight: 110, description: 'Node / Event' },
  { id: 'diamond', label: 'Diamond', defaultWidth: 120, defaultHeight: 120, description: 'Decision / Branch' },
  { id: 'triangle', label: 'Triangle', defaultWidth: 120, defaultHeight: 100, description: 'Alert / Delta' },
  { id: 'hexagon', label: 'Hexagon', defaultWidth: 140, defaultHeight: 100, description: 'Module / Unit' },
  { id: 'cylinder', label: 'Cylinder', defaultWidth: 110, defaultHeight: 120, description: 'Database / Storage' },
  { id: 'cloud', label: 'Cloud', defaultWidth: 150, defaultHeight: 100, description: 'Cloud / Network' },
  { id: 'star', label: 'Star', defaultWidth: 110, defaultHeight: 110, description: 'Highlight / Star' },
  { id: 'parallelogram', label: 'Parallel', defaultWidth: 150, defaultHeight: 90, description: 'Input / Output' },
  { id: 'speech-bubble', label: 'Callout', defaultWidth: 140, defaultHeight: 100, description: 'Comment / Note' },
  { id: 'pill', label: 'Capsule', defaultWidth: 140, defaultHeight: 75, description: 'Tag / Pill' },
  { id: 'document', label: 'Document', defaultWidth: 130, defaultHeight: 100, description: 'Page / Report' },
  { id: 'step', label: 'Step Arrow', defaultWidth: 140, defaultHeight: 80, description: 'Next / Action' },
  { id: 'shield', label: 'Shield', defaultWidth: 120, defaultHeight: 120, description: 'Security / Protect' },
  { id: 'heart', label: 'Heart', defaultWidth: 120, defaultHeight: 110, description: 'Favorite / Core' }
]

export const INLINE_COLORS: { id: InlineColor; label: string; hex: string }[] = [
  { id: 'default', label: 'Cyan Accent', hex: '#38bdf8' },
  { id: 'yellow', label: 'Yellow', hex: '#facc15' },
  { id: 'blue', label: 'Blue', hex: '#60a5fa' },
  { id: 'green', label: 'Green', hex: '#4ade80' },
  { id: 'purple', label: 'Purple', hex: '#c084fc' },
  { id: 'red', label: 'Red', hex: '#f87171' },
  { id: 'orange', label: 'Orange', hex: '#fb923c' },
  { id: 'cyan', label: 'Mint', hex: '#22d3ee' }
]

export function renderInlineShapeSVG(
  shape: InlineShapeType,
  colorHex: string = '#38bdf8',
  strokeWidth: number = 1.3
): React.ReactNode {
  const stroke = colorHex
  const fill = colorHex
  const fillOpacity = 0.08

  switch (shape) {
    case 'rectangle':
      return <rect x="4" y="4" width="92" height="92" rx="4" fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth} />
    case 'rounded-rectangle':
      return <rect x="4" y="4" width="92" height="92" rx="16" fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth} />
    case 'circle':
      return <ellipse cx="50" cy="50" rx="46" ry="46" fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth} />
    case 'diamond':
      return <polygon points="50,4 96,50 50,96 4,50" fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
    case 'triangle':
      return <polygon points="50,6 95,94 5,94" fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
    case 'hexagon':
      return <polygon points="26,6 74,6 96,50 74,94 26,94 4,50" fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
    case 'cylinder':
      return (
        <g stroke={stroke} strokeWidth={strokeWidth} fill={fill} fillOpacity={fillOpacity}>
          <path d="M12,22 L12,78 C12,88 88,88 88,78 L88,22" />
          <ellipse cx="50" cy="22" rx="38" ry="14" />
        </g>
      )
    case 'cloud':
      return (
        <path
          d="M25 74 L75 74 A16 16 0 0 0 85 45 A20 20 0 0 0 53 26 A24 24 0 0 0 25 46 A16 16 0 0 0 25 74 Z"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      )
    case 'star':
      return (
        <polygon
          points="50,4 64,34 96,38 72,60 78,92 50,76 22,92 28,60 4,38 36,34"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      )
    case 'parallelogram':
      return <polygon points="22,6 96,6 78,94 4,94" fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
    case 'speech-bubble':
      return (
        <path
          d="M8,14 C8,8 14,4 22,4 L78,4 C86,4 92,8 92,14 L92,66 C92,72 86,76 78,76 L36,76 L18,94 L22,76 L22,76 C14,76 8,72 8,66 Z"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      )
    case 'pill':
      return <rect x="4" y="16" width="92" height="68" rx="34" fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth} />
    case 'document':
      return (
        <g stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round">
          <polygon points="12,6 66,6 88,28 88,94 12,94" fill={fill} fillOpacity={fillOpacity} />
          <polyline points="66,6 66,28 88,28" fill="none" />
        </g>
      )
    case 'step':
      return (
        <polygon
          points="6,26 62,26 62,8 94,50 62,92 62,74 6,74"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      )
    case 'shield':
      return (
        <path
          d="M50,6 L88,18 C88,60 50,92 50,92 C50,92 12,60 12,18 Z"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      )
    case 'heart':
      return (
        <path
          d="M50,86 C50,86 10,60 10,34 C10,18 24,10 36,10 C44,10 50,18 50,18 C50,18 56,10 64,10 C76,10 90,18 90,34 C90,60 50,86 50,86 Z"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      )
    default:
      return <rect x="4" y="4" width="92" height="92" rx="4" fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth} />
  }
}
