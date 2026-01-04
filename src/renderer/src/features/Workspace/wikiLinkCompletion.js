import { syntaxTree } from "@codemirror/language"

/**
 * WikiLink Autocompletion
 * Provides "Ghost" completion for [[Links]] based on Vault Snippets.
 * Supports passing a getter function to ensure fresh data without re-init.
 */
export function wikiLinkCompletion(getSnippets) {
  return (context) => {
    // 1. Check if we are typing a WikiLink
    let word = context.matchBefore(/\[\[[^\]]*$/)
    if (!word) return null
    
    // 2. Extract search query (text after [[)
    let searchText = word.text.slice(2).toLowerCase()

    // 3. Get snippets (handle array or function)
    const snippets = typeof getSnippets === 'function' ? getSnippets() : getSnippets

    // 4. Filter snippets
    const options = snippets
      .filter(s => s.title.toLowerCase().includes(searchText))
      .map(s => ({
        label: s.title,
        type: 'text',
        // When selected, just insert title. 
        // closeBrackets() usually adds the closing brackets, or user types ']]'
        apply: s.title,
        detail: 'Note' 
      }))

    return {
      from: word.from + 2, // Start replacing AFTER the [[
      options,
      filter: false // We did the filtering manually
    }
  }
}
