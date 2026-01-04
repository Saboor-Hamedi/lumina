import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

/**
 * Lumina Syntax Theme - Pro VSCode Dark+ Inspired
 * A professional, high-fidelity syntax highlighting theme.
 */

// VSCode Dark+ Palette
const chalky = "#e5c07b",
  coral = "#e06c75",
  cyan = "#56b6c2",
  invalid = "#ffffff",
  ivory = "#abb2bf",
  stone = "#7d8799", // Comments
  malibu = "#61afef", 
  sage = "#98c379", 
  whiskey = "#d19a66",
  violet = "#c678dd",
  darkBackground = "#21252b",
  highlightBackground = "#2c313a",
  background = "#282c34",
  tooltipBackground = "#353a42",
  selection = "#3E4451",
  cursor = "#528bff"

export const luminaHighlightStyle = HighlightStyle.define([
  // Keywords (Purple/Violet)
  { tag: [tags.keyword, tags.operatorKeyword, tags.modifier, tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: violet },
  
  // Control Flow (Purple)
  { tag: [tags.controlKeyword, tags.moduleKeyword], color: violet },

  // Names / Variables (Red for HTML tags, Blue for variables?)
  // Actually VSCode: Variables are Blue (#9CDCFE), Properties are Light Blue (#9CDCFE)
  { tag: [tags.variableName, tags.attributeName], color: malibu },
  
  // Functions (Yellow)
  { tag: [tags.function(tags.variableName), tags.labelName], color: chalky }, // Yellow/Gold

  // Strings (Orange/Peach)
  { tag: [tags.string, tags.special(tags.string)], color: sage }, // Green string (Atom/OneDark style) or Orange? VSCode uses Orange (#ce9178). Let's use Sage (Green) for OneDark vibe or #ce9178 for VSCode?
  // User asked for "Real". VSCode is standard. 
  // Let's swap Sage for #ce9178 (Orange)
  // Strings (Orange - VSCode Style)
  { tag: [tags.string, tags.inserted], color: "#ce9178" },
  
  // Numbers (Light Green)
  { tag: [tags.number, tags.changed, tags.annotation, tags.self, tags.namespace], color: "#b5cea8" },
  
  // Types / Classes (Teal)
  { tag: [tags.typeName, tags.className], color: "#4ec9b0" },
  
  // Operators (White/Ivory)
  { tag: tags.operator, color: "#d4d4d4" },
  
  // Comments (Green)
  { tag: [tags.comment, tags.meta], color: "#6a9955", fontStyle: 'italic' },
  
  // HTML Tags (Blue)
  { tag: tags.tagName, color: "#569cd6" },
  
  // Attributes (Light Blue)
  { tag: tags.attributeName, color: "#9cdcfe" },
  
  // Regular Text
  { tag: [tags.name, tags.separator, tags.bracket, tags.punctuation], color: "#d4d4d4" },
  
  // Heading (Markdown)
  { tag: tags.heading, fontWeight: 'bold', color: malibu },
  
  // Link
  { tag: tags.link, color: malibu, textDecoration: 'underline' },
  
  { tag: tags.invalid, color: "#f44336" },
])

export const luminaSyntax = syntaxHighlighting(luminaHighlightStyle)
