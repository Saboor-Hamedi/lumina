import React from 'react'
import { Calendar } from 'lucide-react'

const EditorMetadata = ({ snippet, title, setTitle, setIsDirty, titleRef }) => {
  if (!snippet) return null

  return (
    <div className="editor-metadata-bar">
      <input
        type="text"
        ref={titleRef}
        className="editor-large-title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          setIsDirty(true)
        }}
        onDoubleClick={(e) => e.target.select()}
        placeholder="Untitled"
        spellCheck="false"
      />

    </div>
  )
}

export default EditorMetadata;
