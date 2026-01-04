import React, { useState, useEffect } from 'react'
import { Hash, Calendar, Sparkles } from 'lucide-react'
import { useAIStore } from '../../../core/store/useAIStore'

const EditorMetadata = ({ snippet, onSave, snippets }) => {
  const [tagInput, setTagInput] = useState('')
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState([])
  const { searchNotes } = useAIStore()

  // Generate Smart Suggestions when focusing input
  const generateSuggestions = async () => {
    // 1. Get content context
    const text = (snippet.title + ' ' + (snippet.code || '')).slice(0, 1000)
    if (text.length < 10) return

    // 2. Find similar notes
    const results = await searchNotes(text, 0.4)

    // 3. Aggregate tags from neighbors
    const tagCounts = {}
    const currentTags = new Set((snippet.tags || '').split(',').map((t) => t.trim()))

    results.forEach((res) => {
      if (res.id === snippet.id) return // Skip self
      const neighbor = snippets.find((s) => s.id === res.id)
      if (neighbor && neighbor.tags) {
        neighbor.tags.split(',').forEach((t) => {
          const tag = t.trim()
          if (!tag || currentTags.has(tag)) return
          tagCounts[tag] = (tagCounts[tag] || 0) + res.score // Weight by similarity
        })
      }
    })

    // 4. Sort by relevance
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3) // Top 3
      .map((e) => e[0])

    setAiSuggestions(topTags)
  }

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
            onFocus={() => {
              setShowTagSuggestions(true)
              generateSuggestions()
            }}
            onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddTag(tagInput)
                setTagInput('')
              }
            }}
          />
          {showTagSuggestions && (
            <div className="tag-suggestions">
              {/* AI Suggestions Section */}
              {aiSuggestions.length > 0 && !tagInput && (
                <div className="suggestion-group">
                  <div
                    className="suggestion-header"
                    style={{
                      fontSize: '10px',
                      padding: '4px 8px',
                      color: 'var(--text-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Sparkles size={10} /> Suggested
                  </div>
                  {aiSuggestions.map((tag, i) => (
                    <div
                      key={`ai-${i}`}
                      className="suggestion-item"
                      onMouseDown={(e) => {
                        e.preventDefault() // Prevent blur
                        handleAddTag(tag)
                        setTagInput('')
                        setShowTagSuggestions(false)
                      }}
                    >
                      {tag}
                    </div>
                  ))}
                  <div className="dropdown-divider" style={{ margin: '4px 0' }} />
                </div>
              )}

              {suggestions.map((suggestion, i) => (
                <div
                  key={i}
                  className="suggestion-item"
                  onMouseDown={(e) => {
                    e.preventDefault() // Prevent blur
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
