export const luminaPlanMode = {
  id: 'Plan',
  name: 'Plan',
  description: 'Smart planning, architectural design, outlines, and structured blueprints.',
  temperature: 0.5,
  max_tokens: 4000,
  enableTools: false,
  systemAddon: `CRITICAL DIRECTIVE FOR PLAN MODE:
You are in PLAN MODE.
In Plan Mode, you CANNOT write, create, update, draft, or delete files or folders in the workspace at all. You have NO workspace writing tools.
- All plans, architectures, outlines, roadmaps, frameworks, and designs MUST be written directly in the chat conversation.
- If the user asks you to plan, brainstorm, structure, or outline something, discuss and explain the full plan directly in the chat.
- If the user asks you to create files/folders in their workspace, draft them to disk, or update existing files, you MUST NOT attempt to write them to the workspace. Instead, explain:
  "I am currently in **Plan Mode** (for planning and architecture only, cannot write to workspace). To have me create, draft, or update files directly in your workspace, please switch to **Code** mode!"`
}
