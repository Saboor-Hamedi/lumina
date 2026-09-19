/**
 * Intent Router Service
 * Classifies user chat messages into high-level action intents for prompt optimization.
 */

export const IntentCategory = {
  TARGETED_EDIT: 'TARGETED_EDIT',
  CREATE_NOTE: 'CREATE_NOTE',
  CONVERSATIONAL_EXPLAIN: 'CONVERSATIONAL_EXPLAIN',
  CLEAR_FILE: 'CLEAR_FILE',
  RENAME_FILE: 'RENAME_FILE',
  MOVE_FILE: 'MOVE_FILE',
  CREATE_FOLDER: 'CREATE_FOLDER',
  ORGANIZE_FILES: 'ORGANIZE_FILES',
  VAULT_SUMMARY: 'VAULT_SUMMARY',
  PLAN_SCAFFOLD: 'PLAN_SCAFFOLD',
  MEMORY_OP: 'MEMORY_OP'
} as const

export type IntentCategoryType = (typeof IntentCategory)[keyof typeof IntentCategory]

export const detectUserIntent = (
  message?: string,
  mentionedSnippets: any[] = [],
  activeSnippet: any = null
): IntentCategoryType => {
  const clean = (message || '').trim().toLowerCase()

  const memoryPatterns =
    /\b(remember|save (?:this )?to (?:your )?memory|save (?:this )?in (?:your )?memory|keep in mind|store in memory|don'?t forget|my name is|call me|i am called|forget (?:my )?|remove (?:this )?from (?:your )?memory|delete (?:this )?from (?:your )?memory|erase (?:this )?from memory|update (?:my )?memory)\b/i

  if (memoryPatterns.test(clean)) {
    return IntentCategory.MEMORY_OP
  }

  const conversationalOverridePatterns =
    /\b(let'?s talk|just talk|talk first|don'?t write|do not write|don'?t create|do not create|no files?( yet)?|don'?t save|do not save|just discuss|discuss first|in chat( only)?|brainstorm(ing)? (in|only in) chat|keep (it )?in chat|without (writing|creating|saving))\b/i

  if (conversationalOverridePatterns.test(clean)) {
    return IntentCategory.CONVERSATIONAL_EXPLAIN
  }

  const readQuestionPatterns =
    /\b(what is|what are|what was|what do you see|what's in|what is in|what does|what do|why is|why does|how does|how do|how is|how can|tell me about|tell me what|tell me how|who is|show me|explain|summarize|review|check|analyze|look at|compare|difference between|difference)\b/i
  const explicitFileDirective =
    /\b(create|make|build|draft|save|write|put|drop|push|rename|move|delete|clear|empty|wipe)\b[^.!?\n]{0,60}\b(files?|notes?|folder|folders|directory|repo|workspace|vault)\b/i
  const writeVerbs = /\b(write|add|append|insert|put|include|compose)\b/i
  const editVerbs =
    /\b(edit|change|replace|modify|update|fix|refactor|rewrite|remove|delete|strip|clean|clean up|deduplicate|dedup|prune|trim|simplify|correct|format)\b/i

  // If the user is asking an explanation, conceptual, or question query without explicit file-mutation commands
  if (readQuestionPatterns.test(clean) && !explicitFileDirective.test(clean) && !writeVerbs.test(clean) && !editVerbs.test(clean)) {
    return IntentCategory.CONVERSATIONAL_EXPLAIN
  }

  const hasMentions = mentionedSnippets && mentionedSnippets.length > 0
  const clearPatterns = /\b(clear|empty|wipe|erase|reset)\b/i
  const renamePatterns =
    /\b(rename|change name of)\b[^.!?\n]{0,80}\b(folder|folders|directory|file|files|note|notes|lowercase|uppercase)\b/i
  const movePatterns =
    /\b(move|put|place|transfer|relocate)\b[^.!?\n]{0,80}\b(folder|directory|root|into|to)\b/i
  const organizePatterns =
    /\b(organize|sort|group|categorize|arrange)\b[^.!?\n]{0,80}\b(notes|files|workspace|folders)\b/i
  const vaultSummaryPatterns =
    /\b(summary of (my |the )?(vault|workspace|projects?|notes)|summarize (my |the )?(vault|workspace|projects?|everything)|create (a )?summary|generate (a )?(vault |workspace )?summary|vault summary|workspace dashboard|vault overview)\b/i
  const planScaffoldPatterns =
    /\b(create|make|build|draft|generate|set up|scaffold|design)\b[^.!?\n]{0,80}\b(plan|structure|architecture|roadmap|curriculum|tracker|budget|expenses?|spend|spending|rupiah|trip|travel|itinerary|business|study|coding|cloud|devops|finance|daily log|workflow)\b/i
  const compoundWorkflowPatterns =
    /\b(folder|directory)\b[^.!?\n]{0,80}\b(files?|notes?|plan|expenses?|today|tomorrow|summary|graph)\b/i
  const createFolderPatterns =
    /\b(create|make|add|new)\b[^.!?\n]{0,80}\b(folder|directory)\b/i
  const newNotePatterns =
    /\b(write a draft|write a note|create a note|create a file|make a file|write topic|comprehensive note on|write about)\b/i

  const linkPatterns =
    /\b(link|connect|cross-link|wikilink|reference)\b[^.!?\n]{0,80}\b(together|both|notes?|files?|them|each other|purchases?|expenses?|all)\b|^link\b/i

  const directWorkspaceCreationPatterns =
    /\b(go\s+create|create\s+(?:me\s+)?|make\s+(?:me\s+)?|build\s+(?:me\s+)?|add\s+(?:me\s+)?|generate\s+(?:me\s+)?|put\s+(?:all\s+)?(?:the\s+)?files|put\s+all\s+(?:the\s+)?notes|draft\s+(?:me\s+)?|save\s+(?:the\s+)?files|write\s+(?:the\s+)?files|drop\s+(?:the\s+)?files|push\s+(?:the\s+)?files)\b[^.!?\n]{0,120}\b(files?|notes?|folder|folders|project|workspace|vault|explorer|code|repo|scaffold|structure|app)\b/i
  const directProjectCreate =
    /\b(go\s+create\s+(?:the\s+)?project|create\s+(?:the\s+|a\s+|me\s+a\s+)?project|build\s+(?:the\s+|a\s+|me\s+)?project|make\s+(?:the\s+|a\s+|me\s+)?project|set\s*up\s+(?:the\s+|a\s+)?project|scaffold\s+(?:the\s+|a\s+)?project|generate\s+(?:the\s+|a\s+|me\s+)?project)\b/i
  const workspaceDestinationPatterns =
    /\b(put|save|drop|push|add|create|make|write)\b[^.!?\n]{0,80}\b(in|into|to|on)\s+(?:the\s+)?(workspace|explorer|vault)\b/i

  if (directProjectCreate.test(clean)) {
    return IntentCategory.PLAN_SCAFFOLD
  }

  if (workspaceDestinationPatterns.test(clean)) {
    if (/\b(folder|folders|directory|directories)\b/i.test(clean) && !/\b(file|files|notes?)\b/i.test(clean)) {
      return IntentCategory.CREATE_FOLDER
    }
    if (/\b(folder|folders)\b/i.test(clean) || /\b(project|all\s+the\s+files|all\s+files)\b/i.test(clean)) {
      return IntentCategory.PLAN_SCAFFOLD
    }
    return IntentCategory.CREATE_NOTE
  }

  if (directWorkspaceCreationPatterns.test(clean)) {
    if (/\b(folder|folders|directory|directories)\b/i.test(clean) && !/\b(file|files|notes?)\b/i.test(clean)) {
      return IntentCategory.CREATE_FOLDER
    }
    if (
      (/\b(files?|notes?|docs?)\b/i.test(clean) && /\b(folder|folders)\b/i.test(clean)) ||
      /\b(project|all\s+files|all\s+the\s+files)\b/i.test(clean)
    ) {
      return IntentCategory.PLAN_SCAFFOLD
    }
    return IntentCategory.CREATE_NOTE
  }

  if (linkPatterns.test(clean)) {
    return IntentCategory.TARGETED_EDIT
  }

  if (planScaffoldPatterns.test(clean) || compoundWorkflowPatterns.test(clean)) {
    return IntentCategory.PLAN_SCAFFOLD
  }

  if (vaultSummaryPatterns.test(clean)) {
    return IntentCategory.VAULT_SUMMARY
  }

  if (createFolderPatterns.test(clean)) {
    return IntentCategory.CREATE_FOLDER
  }

  if (movePatterns.test(clean)) {
    return IntentCategory.MOVE_FILE
  }

  if (organizePatterns.test(clean)) {
    return IntentCategory.ORGANIZE_FILES
  }

  if (clearPatterns.test(clean) && (hasMentions || activeSnippet)) {
    return IntentCategory.CLEAR_FILE
  }

  if (renamePatterns.test(clean)) {
    return IntentCategory.RENAME_FILE
  }

  if (hasMentions && (writeVerbs.test(clean) || editVerbs.test(clean))) {
    return IntentCategory.TARGETED_EDIT
  }

  const updateAgainPatterns =
    /\b(update\s+ag?ai?n|rewrite\s+ag?ai?n|change\s+ag?ai?n|try\s+ag?ai?n|do\s+it\s+ag?ai?n|improve\s+ag?ai?n|one\s+more\s+time|another\s+(?:version|pass|try))\b/i
  if (updateAgainPatterns.test(clean)) {
    return IntentCategory.TARGETED_EDIT
  }

  const optionSelectionPatterns =
    /\b(go\s+for\s+option|option\s+[a-d1-4]|choose\s+(?:option\s+)?[a-d1-4]|pick\s+(?:option\s+)?[a-d1-4]|use\s+(?:option\s+)?[a-d1-4]|apply\s+(?:option\s+)?[a-d1-4]|take\s+(?:option\s+)?[a-d1-4]|i\s+(?:like|want|prefer)\s+option\s+[a-d1-4]|^[a-d1-4]$)\b/i
  if (optionSelectionPatterns.test(clean)) {
    return IntentCategory.TARGETED_EDIT
  }

  const directUpdatePatterns =
    /\b(update|rewrite|improve|polish|refine|edit|change)\b[^.!?\n]{0,80}\b(paragraph|intro|introduction|opening|section|heading|header|top|first|line|code|note|file|wording|wordings|lumina)\b/i
  if (directUpdatePatterns.test(clean)) {
    return IntentCategory.TARGETED_EDIT
  }

  if (editVerbs.test(clean) && (hasMentions || activeSnippet || /\b(duplicates?|extra|repeated|section|header|tree|link|links|list|them)\b/i.test(clean))) {
    return IntentCategory.TARGETED_EDIT
  }

  if (readQuestionPatterns.test(clean) && !writeVerbs.test(clean) && !editVerbs.test(clean)) {
    return IntentCategory.CONVERSATIONAL_EXPLAIN
  }

  if (newNotePatterns.test(clean)) {
    return IntentCategory.CREATE_NOTE
  }

  if (editVerbs.test(clean) && activeSnippet) {
    return IntentCategory.TARGETED_EDIT
  }

  return IntentCategory.CONVERSATIONAL_EXPLAIN
}

export const getDynamicExemplars = (intent: IntentCategoryType): string => {
  switch (intent) {
    case IntentCategory.VAULT_SUMMARY:
      return `\n**EXEMPLAR FOR VAULT SUMMARY / WORKSPACE DASHBOARD**:
User: "create summary of my vault"
Execution: 
1. Call \`createFile\` with title="Vault Summary" and folder="" (ROOT LEVEL by default) containing an intelligent overview:
   - High-level project metrics & active domains
   - Structured table/tree of all folders with \`[[Note Title]]\` wikilinks
   - Current priorities, active workstreams, and pending action items
2. If the user explicitly requested a specific folder (e.g. "put in Docs/"), call \`createFile\` with folder="Docs".

User: "summarize my projects"
Execution: Call \`createFile\` with title="Project Summary", folder="" (root level), and full markdown summary linking all active project notes.`

    case IntentCategory.PLAN_SCAFFOLD:
      return `\n**EXEMPLAR FOR DOMAIN PLAN SCAFFOLDING (TRIPS, BUSINESS, STUDY, CODING, FINANCE, CLOUD)**:
User: "Create a folder called Trip. Inside that folder make an Afghanistan trip plan with all expenses. Create two different files called today and tomorrow (today spent 1 million rupiah, tomorrow planned 2 million). Make a summary file with beautiful graph at root."
Execution:
1. Call \`createFolder\` with path="Trip"
2. Call \`createFile\` with folder="Trip", title="Afghanistan Trip Plan", and rich markdown content detailing the route, highlights, preparation, and total expenses.
3. Call \`createFile\` with folder="Trip", title="today", and markdown content detailing today's 1,000,000 IDR expenses itemized in a calculation table.
4. Call \`createFile\` with folder="Trip", title="tomorrow", and markdown content detailing tomorrow's planned 2,000,000 IDR expenses.
5. Call \`createFile\` with folder="", title="Trip Summary", containing a mermaid chart comparing expenses (\`\`\`mermaid\\npie title Expenses\\n  \"Today\" : 1000000\\n  \"Tomorrow\" : 2000000\\n\`\`\`) and reciprocal [[Wikilinks]] to [[Afghanistan Trip Plan]], [[today]], and [[tomorrow]].
6. For each file in the plan, output a brief narration sentence, invoke createFile for that item, and repeat until all requested files are created. Never batch all tool calls silently without narration.

User: "Create my business plan structure"
Execution: Call \`createFile\` with folder="" (root level) for notes like \`Business Strategy\`, \`Product Roadmap\`, \`Market Analysis\`, and \`Financial Plan\` with rich tables, templates, and wikilinks. (Folders are only created if explicitly requested).

User: "Set up my daily expense and budget tracker"
Execution: Call \`createFile\` with folder="" for \`Expense Log\`, \`Monthly Budget\`, and \`Savings Goals\` with markdown calculation tables and category breakdowns.

User: "Create my cloud architecture in folder DevOps"
Execution: Call \`createFolder\` with path="DevOps", and call \`createFile\` with folder="DevOps" for \`System Topology\`, \`API Specifications\`, and \`CI-CD Pipeline\`.

User: "Structure my study plan for Distributed Systems"
Execution: Call \`createFile\` with folder="" for syllabus, deep-dive notes, and review flashcards.`

    case IntentCategory.CREATE_FOLDER:
      return `\n**EXEMPLAR FOR CREATING A FOLDER**:
User: "create a folder"
Response: "What would you like to name the folder?"
User: "Create a folder named Science"
Execution: Call \`createFolder\` with path="Science" immediately.`

    case IntentCategory.MOVE_FILE:
      return `\n**EXEMPLAR FOR MOVING A FILE**:
User: "Move my current file to the Science folder"
Execution: Call \`moveFile\` with title="current" and folder="Science" immediately.
User: "Move @Physics into Mathematics/Advanced"
Execution: Call \`moveFile\` with title="Physics" and folder="Mathematics/Advanced" immediately.`

    case IntentCategory.ORGANIZE_FILES:
      return `\n**EXEMPLAR FOR ORGANIZING WORKSPACE**:
User: "Organize my notes into Physics and Literature folders"
Execution: First call \`createFolder\` for each folder needed, then call \`moveFile\` for the corresponding notes into their destination folders.
User: "Draft this study plan into my vault"
Execution: First call \`createFolder\` for each directory in the plan, then for EACH note, output a brief narration sentence and call \`createFile\` for that note inside its respective folder with full structured markdown content adhering strictly to any requested word counts.`

    case IntentCategory.TARGETED_EDIT:
      return `\n**EXEMPLAR FOR TARGETED EDIT & CLEANUP**:
User: "Go for option B" or "Option B" or "choose B" or "use option 2"
Execution: The user has chosen an option for their note! In <think>, acknowledge the choice, verify the target section, and immediately call \`updateFile\` with title="current", sectionHeader="Opening", and replace="<selected Option content>" to update the note in the editor!

User: "update that paragraph again, with different wordings" or "update Lumina"
Execution: The user wants to update the note! NEVER offer choices like Option A, Option B in chat.
In <think>:
- User asked to: update the opening paragraph with refined phrasing.
- Self-debate: If I change the vocabulary, does it maintain the original thesis? Yes. What about the following sections? The next section covers technical specifics, so the opening must stay high-level and punchy without duplicating technical details.
- Section-awareness: Confine changes strictly to sectionHeader="Opening" between the title and the first subheading.
Action: Call \`updateFile\` with title="current", sectionHeader="Opening", and replace="<polished rewrite text>" directly on step 1 to update the file in the editor!

User: "please update again" or "update again" or "rewrite again"
Execution: The user wants another refined iteration or revision of the open note! DO NOT ask questions, request guidance, or talk about tone. In <think>, debate the best stylistic angle and section boundary, then take initiative immediately to elevate the prose, rhythm, and clarity, and call \`updateFile\` with title="current", sectionHeader="Opening", and replace="<polished text>"!
User: "link the files together"
Execution: Identify the target notes in the workspace (e.g. NoteA, NoteB, NoteC). For EACH note, call \`updateFile\` with title="<Note Title>", position="top", and replace="> 🔗 **Related:** [[Linked Note A]] | [[Linked Note B]]" immediately on step 1 without talking out loud!
User: "link both of my purchases"
Execution: Look at the matching notes in the workspace (e.g. "Daily Expenses" and "Big Purchases"). Call \`updateFile\` with title="Daily Expenses", position="top", replace="> 🔗 **Related:** [[Big Purchases]]", and call \`updateFile\` with title="Big Purchases", position="top", replace="> 🔗 **Related:** [[Daily Expenses]]" immediately!
User: "Update the Architecture section in @System Design"
Execution: In <think>, reason about ## Architecture specifically without touching earlier or later sections. Call \`updateFile\` with title="System Design", sectionHeader="## Architecture", and replace="[Updated Architecture Section Content]".
User: "Go fix @summary remove the duplicates"
Execution: Look at the content of @summary provided above. In <think>, isolate the exact duplicated blocks, verify the unique sections to preserve, and call \`updateFile\` with title="summary" and full cleaned content (or search & replace to delete the duplicates) immediately!
User: "remove them" (referring to repeated sections in open note)
Execution: Call \`updateFile\` with title="current" and the cleaned note content without the repeated sections immediately!
User: "Change port 3000 to 8080 in @Config"
Execution: Call \`updateFile\` with title="Config", search="3000", and replace="8080".`

    case IntentCategory.CREATE_NOTE:
      return `\n**EXEMPLAR FOR NOTE CREATION**:
User: "create a file"
Response: "What should the note be named, and what topic would you like it to cover?"
User: "Write a comprehensive note on Graph RAG inside the AI folder"
Execution: Call \`createFile\` with title="Graph RAG", folder="AI", and full markdown content. Render the full guide in chat and editor.
User: "go create the files for my express api"
Execution: Call \`createFile\` directly for each required file (e.g. \`Server\`, \`Routes\`, \`Models\`, \`README\`) with complete markdown implementation and code blocks.
User: "put all the files in the workspace/explorer/vault"
Execution: Call \`createFile\` for each file directly into the workspace root or requested folder with full substantive content!
User: "create me file Notes and folder Archives"
Execution: Call \`createFolder\` with path="Archives", then call \`createFile\` with title="Notes", folder="Archives", and full content.`

    case IntentCategory.CLEAR_FILE:
      return `\n**EXEMPLAR FOR CLEARING A FILE**:
User: "Clear @Quick Notes"
Execution: Call \`clearFile\` with title="Quick Notes" immediately.`

    case IntentCategory.RENAME_FILE:
      return `\n**EXEMPLAR FOR RENAMING A FILE**:
User: "Rename @OldTitle to NewTitle"
Execution: Call \`renameFile\` with oldTitle="OldTitle" and newTitle="NewTitle" immediately.
User: "inside my 1-src folder rename the files keep them a single word"
Execution: Call \`renameFile\` for each file in folder \`1-src\` with simplified single-word names (e.g. oldTitle="1-src/React Components", newTitle="Components").`

    case IntentCategory.MEMORY_OP:
      return `\n**EXEMPLAR FOR MEMORY OPERATIONS**:
User: "okay, remember my name , its saboor"
Execution:
1. Call \`saveMemory\` with category="user", key="name", fact="Saboor".
2. Response in chat: "Got it, Saboor! 🎉 I've saved your name to memory." (Never output tables or lists of memory details when saving!)

User: "remember that I prefer short answers"
Execution:
1. Call \`saveMemory\` with category="preferences", fact="Prefers short answers".
2. Response in chat: "I've saved that preference to memory. I will keep responses concise."

User: "remember my role is fullstack developer"
Execution:
1. Call \`saveMemory\` with category="user", key="role", fact="Fullstack Developer".
2. Response in chat: "Saved! I'll remember that you are a fullstack developer."

User: "forget my name"
Execution:
1. Call \`forgetMemory\` with target="name", key="name".
2. Response in chat: "I've removed your name from memory."

User: "what do you know about me?"
Execution: DO NOT call saveMemory. Answer warmly based on the persistent memory block provided in context.`

    case IntentCategory.CONVERSATIONAL_EXPLAIN:
    default:
      return `\n**EXEMPLAR FOR CONVERSATIONAL / READ QUERY**:
User: "What do you see in @Types of RAG?"
Execution: DO NOT call file tools. The note content is already in the prompt above. Immediately explain and summarize what is inside the note with clear headings and bullet points!`
  }
}
