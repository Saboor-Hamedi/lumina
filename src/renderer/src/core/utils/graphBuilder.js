/**
 * Graph Data Builder
 * Parses all snippets to generate a node/link graph for visualization.
 */

export const buildGraphData = (snippets) => {
  const nodes = []
  const links = []
  const nodeMap = new Map()

  // 1. Create Nodes (Existing Notes)
  snippets.forEach((snippet) => {
    // Use Title as ID for visual simplicity (or ID if we want robustness, but links use titles)
    // We'll use Title as the unique key because WikiLinks use Titles.
    // To handle case-insensitivity, we might normalize, but for display we want original.
    const id = snippet.title || 'Untitled'
    if (!nodeMap.has(id)) {
      nodeMap.set(id, { id, group: 'note', val: 1, snippetId: snippet.id })
      nodes.push(nodeMap.get(id))
    }
  })

  // 2. Parse Links
  snippets.forEach((snippet) => {
    const sourceId = snippet.title || 'Untitled'
    let code = snippet.code || ''

    // Remove code blocks and inline code so bash syntax like [[ $dir ]] isn't parsed as a wikilink
    code = code.replace(/```[\s\S]*?```/g, '')
    code = code.replace(/`[^`]+`/g, '')
    const wikiRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

    let match
    while ((match = wikiRegex.exec(code)) !== null) {
      const targetTitle = match[1].trim()

      // If target doesn't exist as a node yet (Ghost Node), create it
      // but mark it as 'ghost' (not a real file yet)
      let targetNode = nodes.find((n) => n.id && n.id.toLowerCase() === targetTitle.toLowerCase())

      if (!targetNode) {
        // Create a ghost node
        const ghostId = targetTitle // Use the casing from the link
        if (!nodeMap.has(ghostId)) {
          nodeMap.set(ghostId, { id: ghostId, group: 'ghost', val: 0.5 })
          nodes.push(nodeMap.get(ghostId))
        }
        targetNode = nodeMap.get(ghostId)
      }

      // Create Link
      links.push({
        source: sourceId,
        target: targetNode.id,
        value: 1
      })
    }

    // 2.5 Parse Metadata Tags (from snippet.tags)
    if (snippet.tags) {
      const rawTags = Array.isArray(snippet.tags)
        ? snippet.tags
        : typeof snippet.tags === 'string'
          ? snippet.tags.split(',')
          : []
      const tags = rawTags.map((t) => String(t).trim()).filter(Boolean)
      tags.forEach((tag) => {
        const tagId = tag.startsWith('#') ? tag : `#${tag}` // Prefix with hash
        if (!nodeMap.has(tagId)) {
          nodeMap.set(tagId, { id: tagId, group: 'tag', val: 1, label: tagId })
          nodes.push(nodeMap.get(tagId))
        }
        links.push({ source: sourceId, target: tagId, value: 0.5 })
      })
    }

    // 2.6 Parse Inline Tags (#tag) and Mentions (@mention)
    const tagRegex = /(?:^|\s)(#[\w-]+)/g
    const mentionRegex = /(?:^|\s)(@[\w-]+)/g

    let inlineMatch
    while ((inlineMatch = tagRegex.exec(code)) !== null) {
      const tagId = inlineMatch[1]
      if (!nodeMap.has(tagId)) {
        nodeMap.set(tagId, { id: tagId, group: 'tag', val: 1, label: tagId })
        nodes.push(nodeMap.get(tagId))
      }
      links.push({ source: sourceId, target: tagId, value: 0.5 })
    }

    while ((inlineMatch = mentionRegex.exec(code)) !== null) {
      const mentionId = inlineMatch[1]
      if (!nodeMap.has(mentionId)) {
        nodeMap.set(mentionId, { id: mentionId, group: 'mention', val: 1, label: mentionId })
        nodes.push(nodeMap.get(mentionId))
      }
      links.push({ source: sourceId, target: mentionId, value: 0.5 })
    }
  })

  // 3. Calculate "Mass" (Centrality)
  links.forEach((link) => {
    const source = nodeMap.get(link.source)
    const target = nodeMap.get(link.target)
    if (source) source.val += 0.5
    if (target) target.val += 0.5
  })

  return { nodes, links }
}

export const buildSemanticLinks = (nodes, links, snippets, embeddingsCache) => {
  // Safety check: ensure embeddingsCache exists and is an object
  // Also check if it has any entries (empty object means no embeddings available)
  if (
    !embeddingsCache ||
    typeof embeddingsCache !== 'object' ||
    Object.keys(embeddingsCache).length === 0
  ) {
    // Silently return empty array - this is expected when embeddings are handled by main process
    return []
  }

  // We modify the existing links array in-place or return new ones.
  const semanticLinks = []
  const THRESHOLD = 0.82 // Increased significantly to clean up the hairball

  // We only compare existing Real Nodes (snippets)
  const realNodes = nodes.filter((n) => n.group === 'note')

  for (let i = 0; i < realNodes.length; i++) {
    for (let j = i + 1; j < realNodes.length; j++) {
      const nodeA = realNodes[i]
      const nodeB = realNodes[j]

      // Safety check: ensure snippetId exists before accessing embeddingsCache
      if (!nodeA.snippetId || !nodeB.snippetId) continue

      // Safety check: ensure embeddingsCache has the required keys
      const vecA = embeddingsCache[nodeA.snippetId]
      const vecB = embeddingsCache[nodeB.snippetId]

      if (vecA && vecB) {
        // Compute Cosine Sim inline for speed
        let dot = 0,
          magA = 0,
          magB = 0
        for (let k = 0; k < vecA.length; k++) {
          dot += vecA[k] * vecB[k]
          magA += vecA[k] * vecA[k]
          magB += vecB[k] * vecB[k]
        }
        const score = dot / (Math.sqrt(magA) * Math.sqrt(magB))

        if (score > THRESHOLD) {
          // Check if explicit link already exists
          const exists = links.some(
            (l) =>
              (l.source === nodeA.id && l.target === nodeB.id) ||
              (l.source === nodeB.id && l.target === nodeA.id)
          )

          if (!exists) {
            semanticLinks.push({
              source: nodeA.id,
              target: nodeB.id,
              value: 0.2, // Weak pull
              type: 'semantic' // Flag for dashed line
            })
          }
        }
      }
    }
  }

  return semanticLinks
}
