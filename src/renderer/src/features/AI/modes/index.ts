import { luminaPlanMode } from './luminaPlanMode'
import { luminaDeepMode } from './luminaDeepMode'
import { luminaCreativeMode } from './luminaCreativeMode'
import { luminaCodeMode } from './luminaCodeMode'
import { luminaResearchMode } from './luminaResearchMode'
import type { AIModeConfig } from '../types/ai.types'

export const AI_MODES: Record<string, AIModeConfig> = {
  Plan: luminaPlanMode,
  Deep: luminaDeepMode,
  Creative: luminaCreativeMode,
  Research: luminaResearchMode,
  Code: luminaCodeMode
}

export const getAIMode = (modeName?: string | null): AIModeConfig => {
  if (!modeName || typeof modeName !== 'string') return luminaCodeMode
  const norm = modeName.trim().toLowerCase()
  if (norm === 'plan') return luminaPlanMode
  if (norm === 'deep' || norm === 'thinking') return luminaDeepMode
  if (norm === 'creative') return luminaCreativeMode
  if (norm === 'research') return luminaResearchMode
  if (norm === 'code' || norm === 'coder' || norm === 'standard') return luminaCodeMode
  return AI_MODES[modeName] || luminaCodeMode
}

export { luminaPlanMode, luminaDeepMode, luminaCreativeMode, luminaResearchMode, luminaCodeMode }
