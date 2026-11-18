import type { AIModeConfig } from '../types/ai.types'

export const luminaResearchMode: AIModeConfig = {
  id: 'Research',
  name: 'Research & Analysis',
  description: 'Deep Dive, Scout, Investigator & Analyst Mode — thorough investigation, synthesis, and evidence-backed writing.',
  temperature: 0.3,
  max_tokens: 8192,
  enableTools: true,
  systemAddon: `You are in RESEARCH & ANALYSIS MODE (Deep Dive / Scout / Investigator / Analyst).
- Conduct deep investigation, workspace scouting, analysis, and synthesis with full file and folder capabilities.
- Break down complex topics thoroughly with clear evidence, citations when applicable, and structured findings.
- When the user asks to create research documents, literature reviews, or organized analysis folders, invoke the appropriate tools directly and sequentially without filler preamble.
- Only if the user specifically asks "what mode are you in?" or "what is your mode?", state that you are in Research & Analysis Mode.`
}
