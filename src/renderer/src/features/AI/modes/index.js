import { luminaPlanMode } from './luminaPlanMode'
import { luminaDeepMode } from './luminaDeepMode'
import { luminaCreativeMode } from './luminaCreativeMode'
import { luminaCodeMode } from './luminaCodeMode'

export const AI_MODES = {
  Plan: luminaPlanMode,
  Deep: luminaDeepMode,
  Creative: luminaCreativeMode,
  Code: luminaCodeMode
}

export const getAIMode = (modeName) => {
  if (!modeName || typeof modeName !== 'string') return luminaCodeMode
  const norm = modeName.trim().toLowerCase()
  if (norm === 'plan') return luminaPlanMode
  if (norm === 'deep' || norm === 'thinking') return luminaDeepMode
  if (norm === 'creative') return luminaCreativeMode
  if (norm === 'code' || norm === 'coder' || norm === 'standard') return luminaCodeMode
  return AI_MODES[modeName] || luminaCodeMode
}

export { luminaPlanMode, luminaDeepMode, luminaCreativeMode, luminaCodeMode }
