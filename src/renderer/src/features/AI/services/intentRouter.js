/**
 * Dynamic Intent Router & Few-Shot Dynamic Exemplars (Polished)
 * Classifies user intent and injects optimal prompt directives.
 */

export const IntentCategory = {
  TARGETED_EDIT: 'TARGETED_EDIT',
  CREATE_NOTE: 'CREATE_NOTE',
  CONVERSATIONAL_EXPLAIN: 'CONVERSATIONAL_EXPLAIN',
  CLEAR_FILE: 'CLEAR_FILE',
  RENAME_FILE: 'RENAME_FILE'
}

export const detectUserIntent = (message, mentionedSnippets = [], activeSnippet = null) => {
  const clean = (message || '').trim().toLowerCase()

  const hasMentions = mentionedSnippets && mentionedSnippets.length > 0
  const clearPatterns = /\b(clear|empty|wipe|erase|reset)\b/i
  const renamePatterns = /\b(rename|change name of)\b/i
  const readQuestionPatterns =
    /\b(what do you see|what's in|what is in|what does|show me|tell me about|what do you read|have you read|so when|did you read|read|explain|summarize|review|check|analyze|look at|how does|compare|difference)\b/i
  const writeVerbs = /\b(write|add|append|insert|put|include|compose)\b/i
  const updateVerbs = /\b(edit|change|replace|modify|update|fix|refactor|rewrite)\b/i
  const newNotePatterns =
    /\b(write a draft|write a note|create a note|create a file|make a file|write topic|comprehensive note on|write about)\b/i

  // 1. Clear / Reset
  if (clearPatterns.test(clean) && (hasMentions || activeSnippet)) {
    return IntentCategory.CLEAR_FILE
  }

  // 2. Rename
  if (renamePatterns.test(clean)) {
    return IntentCategory.RENAME_FILE
  }

  // 3. Read / Query / Explain takes priority if asking about file contents without explicit write command
  if (readQuestionPatterns.test(clean) && !writeVerbs.test(clean)) {
    return IntentCategory.CONVERSATIONAL_EXPLAIN
  }

  // 4. Targeted writing on a mentioned note (e.g. "@Types of RAG write about X")
  if (hasMentions && (writeVerbs.test(clean) || updateVerbs.test(clean))) {
    return IntentCategory.TARGETED_EDIT
  }

  // 5. Explicit note creation
  if (newNotePatterns.test(clean)) {
    return IntentCategory.CREATE_NOTE
  }

  // 6. Targeted editing on active open note
  if (updateVerbs.test(clean) && activeSnippet) {
    return IntentCategory.TARGETED_EDIT
  }

  return IntentCategory.CONVERSATIONAL_EXPLAIN
}

export const getDynamicExemplars = (intent) => {
  switch (intent) {
    case IntentCategory.TARGETED_EDIT:
      return `\n**EXEMPLAR FOR TARGETED EDIT**:
User: "Add a section on Vector Embeddings to @Types of RAG"
Execution: Call \`appendToFile\` or \`updateFile\` directly with the content. Provide a concise confirmation in chat with key concepts.`

    case IntentCategory.CREATE_NOTE:
      return `\n**EXEMPLAR FOR NOTE CREATION**:
User: "Write a comprehensive note on Graph RAG"
Execution: Call \`createFile\` with title="Graph RAG" and full markdown content. Render the full guide in chat and editor.`

    case IntentCategory.CLEAR_FILE:
      return `\n**EXEMPLAR FOR CLEARING A FILE**:
User: "Clear @Quick Notes"
Execution: Call \`clearFile\` with title="Quick Notes" immediately.`

    case IntentCategory.RENAME_FILE:
      return `\n**EXEMPLAR FOR RENAMING A FILE**:
User: "Rename @OldTitle to NewTitle"
Execution: Call \`renameFile\` with oldTitle="OldTitle" and newTitle="NewTitle" immediately.`

    case IntentCategory.CONVERSATIONAL_EXPLAIN:
    default:
      return `\n**EXEMPLAR FOR CONVERSATIONAL / READ QUERY**:
User: "What do you see in @Types of RAG?"
Execution: DO NOT call file tools. The note content is already in the prompt above. Immediately explain and summarize what is inside the note with clear headings and bullet points!`
  }
}
