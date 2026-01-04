import React, { useState } from 'react'
import { Hash, Calendar } from 'lucide-react'

const EditorMetadata = ({ snippet, onSave, snippets }) => {
  const [tagInput, setTagInput] = useState('')
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)

  const handleAddTag = (tagToAdd) => {
    const cleanTag = tagToAdd.trim()
    if (!cleanTag) return

    const currentTags = (snippet.tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    if (!currentTags.includes(cleanTag)) {
      const tags = [...currentTags, cleanTag].join(',')
      onSave({ ...snippet, tags })
    }
  }

  const handleRemoveTag = (indexToRemove) => {
    const tags = (snippet.tags || '')
      .split(',')
      .filter((_, idx) => idx !== indexToRemove)
      .join(',')
    onSave({ ...snippet, tags })
  }

  const allTags = Array.from(
    new Set(
      snippets.flatMap((s) =>
        (s.tags || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      )
    )
  )

  const suggestions = allTags
    .filter((t) => t.toLowerCase().includes(tagInput.toLowerCase()))
    .slice(0, 5)

  return (
    <div className="editor-metadata-bar">
      <div className="meta-tag-container">
        <Hash size={12} className="meta-icon" />
        <div className="tag-pills">
          {(snippet.tags || '')
            .split(',')
            .filter((t) => t.trim())
            .map((tag, i) => (
              <span key={i} className="tag-pill">
                {tag.trim()}
                <button className="tag-remove" onClick={() => handleRemoveTag(i)}>
                  &times;
                </button>
              </span>
            ))}
        </div>
        <div className="tag-input-wrap">
          <input
            type="text"
            placeholder="Add tag..."
            value={tagInput}
            onChange={(e) => {
              setTagInput(e.target.value)
              setShowTagSuggestions(true)
            }}
            onFocus={() => setShowTagSuggestions(true)}
            onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddTag(tagInput)
                setTagInput('')
              }
            }}
          />
          {showTagSuggestions && tagInput.trim() && suggestions.length > 0 && (
            <div className="tag-suggestions">
              {suggestions.map((suggestion, i) => (
                <div
                  key={i}
                  className="suggestion-item"
                  onClick={() => {
                    handleAddTag(suggestion)
                    setTagInput('')
                    setShowTagSuggestions(false)
                  }}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="meta-info-pill">
        <Calendar size={12} className="meta-icon" />
        <span>{new Date(snippet.timestamp).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

export default EditorMetadata
