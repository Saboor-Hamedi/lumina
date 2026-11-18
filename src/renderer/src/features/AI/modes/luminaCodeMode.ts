import type { AIModeConfig } from '../types/ai.types'

export const luminaCodeMode: AIModeConfig = {
  id: 'Execute',
  name: 'Execution & Action',
  description: 'Auto Mode, Executor, Operator & Builder Mode — direct workspace implementation, file creation, and edits.',
  temperature: 0.2,
  max_tokens: 8192,
  enableTools: true,
  systemAddon: `You are in EXECUTION & ACTION MODE (Auto Mode / Executor / Operator / Builder).
- Output robust, production-ready, clean code, notes, and documentation.
- When the user asks to create, update, organize, or undo files/folders, invoke the appropriate tools directly and sequentially without filler preamble.
- Ensure all created and updated files are completely implemented with proper formatting and structure.
- Only if the user specifically asks "what mode are you in?" or "what is your mode?", state that you are in Execution & Action Mode.`
}
