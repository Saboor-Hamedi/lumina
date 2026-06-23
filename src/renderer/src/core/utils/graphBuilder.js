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
  if (
    !embeddingsCache ||
    typeof embeddingsCache !== 'object' ||
    Object.keys(embeddingsCache).length === 0
  ) {
    return []
  }

  const semanticLinks = []
  const THRESHOLD = 0.82

  const realNodes = nodes.filter((n) => n.group === 'note')

  // 1. Pre-normalize embeddings into highly optimized Float32Arrays
  // This completely eliminates square roots, divisions, and array allocations in the O(N^2) loop
  const normalizedCache = new Map()
  for (let i = 0; i < realNodes.length; i++) {
    const snipId = realNodes[i].snippetId
    if (snipId && embeddingsCache[snipId]) {
      const vec = embeddingsCache[snipId]
      let magSq = 0
      for (let k = 0; k < vec.length; k++) magSq += vec[k] * vec[k]
      const mag = Math.sqrt(magSq)
      
      const normVec = new Float32Array(vec.length)
      if (mag > 0) {
        for (let k = 0; k < vec.length; k++) normVec[k] = vec[k] / mag
      }
      normalizedCache.set(realNodes[i].id, normVec)
    }
  }

  // 2. Pre-index existing links into a Set for O(1) lookups
  // This eliminates the deadly links.some() array traversal inside the O(N^2) inner loop
  const linkSet = new Set()
  for (let i = 0; i < links.length; i++) {
    const l = links[i]
    linkSet.add(`${l.source}|${l.target}`)
    linkSet.add(`${l.target}|${l.source}`)
  }

  // 3. Ultra-fast inner loop
  for (let i = 0; i < realNodes.length; i++) {
    const nodeA = realNodes[i]
    const vecA = normalizedCache.get(nodeA.id)
    if (!vecA) continue

    const vecLength = vecA.length

    for (let j = i + 1; j < realNodes.length; j++) {
      const nodeB = realNodes[j]
      const vecB = normalizedCache.get(nodeB.id)
      if (!vecB) continue

      // Bare-metal dot product using Float32Arrays (V8 compiles this down to extremely fast machine code)
      let score = 0
      for (let k = 0; k < vecLength; k++) {
        score += vecA[k] * vecB[k]
      }

      if (score > THRESHOLD) {
        if (!linkSet.has(`${nodeA.id}|${nodeB.id}`)) {
          semanticLinks.push({
            source: nodeA.id,
            target: nodeB.id,
            value: 0.2,
            type: 'semantic'
          })
        }
      }
    }
  }

  return semanticLinks
}
