export const IntentCategory = {
  TARGETED_EDIT: 'TARGETED_EDIT',
  CREATE_NOTE: 'CREATE_NOTE',
  CONVERSATIONAL_EXPLAIN: 'CONVERSATIONAL_EXPLAIN',
  CLEAR_FILE: 'CLEAR_FILE',
  RENAME_FILE: 'RENAME_FILE',
  MOVE_FILE: 'MOVE_FILE',
  CREATE_FOLDER: 'CREATE_FOLDER',
  ORGANIZE_FILES: 'ORGANIZE_FILES'
}

export const detectUserIntent = (message, mentionedSnippets = [], activeSnippet = null) => {
  const clean = (message || '').trim().toLowerCase()

  const hasMentions = mentionedSnippets && mentionedSnippets.length > 0
  const clearPatterns = /\b(clear|empty|wipe|erase|reset)\b/i
  const renamePatterns = /\b(rename|change name of)\b/i
  const movePatterns = /\b(move|put|place|transfer|relocate)\b.*\b(folder|directory|root|into|to)\b/i
  const createFolderPatterns = /\b(create|make|add|new)\b.*\b(folder|directory)\b/i
  const organizePatterns = /\b(organize|sort|group|categorize|arrange)\b.*\b(notes|files|workspace|folders)\b/i
  const readQuestionPatterns =
    /\b(what do you see|what's in|what is in|what does|show me|tell me about|what do you read|have you read|so when|did you read|read|explain|summarize|review|check|analyze|look at|how does|compare|difference)\b/i
  const writeVerbs = /\b(write|add|append|insert|put|include|compose)\b/i
  const updateVerbs = /\b(edit|change|replace|modify|update|fix|refactor|rewrite)\b/i
  const newNotePatterns =
    /\b(write a draft|write a note|create a note|create a file|make a file|write topic|comprehensive note on|write about)\b/i

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

  if (readQuestionPatterns.test(clean) && !writeVerbs.test(clean)) {
    return IntentCategory.CONVERSATIONAL_EXPLAIN
  }

  if (hasMentions && (writeVerbs.test(clean) || updateVerbs.test(clean))) {
    return IntentCategory.TARGETED_EDIT
  }

  if (newNotePatterns.test(clean)) {
    return IntentCategory.CREATE_NOTE
  }

  if (updateVerbs.test(clean) && activeSnippet) {
    return IntentCategory.TARGETED_EDIT
  }

  return IntentCategory.CONVERSATIONAL_EXPLAIN
}

export const getDynamicExemplars = (intent) => {
  switch (intent) {
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
Execution: First call \`createFolder\` for each directory in the plan, then call \`createFile\` for each note inside its respective folder with full structured markdown content.`

    case IntentCategory.TARGETED_EDIT:
      return `\n**EXEMPLAR FOR TARGETED EDIT**:
User: "Update the Architecture section in @System Design"
Execution: Call \`updateFile\` with title="System Design", sectionHeader="## Architecture", and replace="[Updated Architecture Section Content]". Provide a concise walkthrough in chat showing the updated part.
User: "Change port 3000 to 8080 in @Config"
Execution: Call \`updateFile\` with title="Config", search="3000", and replace="8080".
User: "Add a new section on Vector Embeddings to @Types of RAG"
Execution: Call \`updateFile\` with title="Types of RAG", sectionHeader="## Vector Embeddings", and replace="...".`

    case IntentCategory.CREATE_NOTE:
      return `\n**EXEMPLAR FOR NOTE CREATION**:
User: "create a file"
Response: "What should the note be named, and what topic would you like it to cover?"
User: "Write a comprehensive note on Graph RAG inside the AI folder"
Execution: Call \`createFile\` with title="Graph RAG", folder="AI", and full markdown content. Render the full guide in chat and editor.`

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
