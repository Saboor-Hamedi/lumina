import { luminaPlanMode } from './luminaPlanMode'
import { luminaCodeMode } from './luminaCodeMode'
import { luminaResearchMode } from './luminaResearchMode'
import type { AIModeConfig } from '../types/ai.types'

export const AI_MODES: Record<string, AIModeConfig> = {
  'Planning & Strategy': luminaPlanMode,
  'Execution & Action': luminaCodeMode,
  'Research & Analysis': luminaResearchMode
}

const MODE_ALIAS_MAP: Record<string, AIModeConfig> = {
  plan: luminaPlanMode,
  planning: luminaPlanMode,
  strategy: luminaPlanMode,
  'planning & strategy': luminaPlanMode,
  architect: luminaPlanMode,
  planner: luminaPlanMode,
  strategist: luminaPlanMode,
  'co-pilot': luminaPlanMode,
  copilot: luminaPlanMode,

  execute: luminaCodeMode,
  execution: luminaCodeMode,
  action: luminaCodeMode,
  'execution & action': luminaCodeMode,
  auto: luminaCodeMode,
  executor: luminaCodeMode,
  operator: luminaCodeMode,
  builder: luminaCodeMode,
  code: luminaCodeMode,
  coder: luminaCodeMode,
  standard: luminaCodeMode,
  creative: luminaCodeMode,

  research: luminaResearchMode,
  analysis: luminaResearchMode,
  'research & analysis': luminaResearchMode,
  'deep dive': luminaResearchMode,
  deep: luminaResearchMode,
  thinking: luminaResearchMode,
  scout: luminaResearchMode,
  investigator: luminaResearchMode,
  analyst: luminaResearchMode
}

export const getAIMode = (modeName?: string | null): AIModeConfig => {
  if (!modeName || typeof modeName !== 'string') return luminaCodeMode
  const norm = modeName.trim().toLowerCase()
  return MODE_ALIAS_MAP[norm] || AI_MODES[modeName] || luminaCodeMode
}

export { luminaPlanMode, luminaCodeMode, luminaResearchMode }
