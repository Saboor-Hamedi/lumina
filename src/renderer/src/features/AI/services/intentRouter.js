/**
 * Dynamic Intent Router & Few-Shot Dynamic Exemplars
 * Classifies user intent and injects optimal prompt directives.
 */

export const IntentCategory = {
  TARGETED_EDIT: 'TARGETED_EDIT',
  CREATE_NOTE: 'CREATE_NOTE',
  CONVERSATIONAL_EXPLAIN: 'CONVERSATIONAL_EXPLAIN',
  REFACTOR_ORGANIZE: 'REFACTOR_ORGANIZE'
}

export const detectUserIntent = (message, mentionedSnippets = [], activeSnippet = null) => {
  const clean = (message || '').trim().toLowerCase()

  const hasMentions = mentionedSnippets && mentionedSnippets.length > 0
  const writeVerbs = /\b(write|add|append|insert|put|include|draft|create|make|compose)\b/i
  const updateVerbs = /\b(edit|change|replace|modify|update|fix|refactor|rewrite)\b/i
  const newNotePatterns = /\b(write a draft|write a note|create a note|create a file|make a file|write topic|comprehensive note on)\b/i
  const questionPatterns = /\b(what is|how does|tell me about|explain|why|compare|difference between|summarize)\b/i

  if (hasMentions && (writeVerbs.test(clean) || updateVerbs.test(clean))) {
    return IntentCategory.TARGETED_EDIT
  }

  if (newNotePatterns.test(clean)) {
    return IntentCategory.CREATE_NOTE
  }

  if (updateVerbs.test(clean) && activeSnippet) {
    return IntentCategory.TARGETED_EDIT
  }

  if (questionPatterns.test(clean) && !newNotePatterns.test(clean)) {
    return IntentCategory.CONVERSATIONAL_EXPLAIN
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

    case IntentCategory.CONVERSATIONAL_EXPLAIN:
    default:
      return `\n**EXEMPLAR FOR CONVERSATIONAL EXPLANATION**:
User: "How does dense retrieval work?"
Execution: Stream complete, high-signal response directly in chat with clear headings and bullet points without creating files.`
  }
}
