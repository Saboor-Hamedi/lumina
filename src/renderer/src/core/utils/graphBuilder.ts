import { normalizeWikilinkTarget } from '../i18n'

export type GraphNodeGroup = 'note' | 'ghost' | 'tag' | 'mention'

export interface GraphNode {
  id: string
  group: GraphNodeGroup
  val: number
  snippetId?: string
  label?: string
  primaryTag?: string
  ageFactor?: number
  linkCount?: number
  x?: number
  y?: number
  z?: number
  fx?: number
  fy?: number
  fz?: number
}

export interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  value: number
  type?: string
}

export interface GraphSnippetInput {
  id?: string
  title?: string
  code?: string
  tags?: string | string[] | null
}

export type BuildGraphOptions = Record<string, unknown>

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export type EmbeddingsCache = Record<string, ArrayLike<number>>

export const buildGraphData = (
  snippets: GraphSnippetInput[] | null | undefined,
  _options: BuildGraphOptions = {}
): GraphData => {
  const safeSnippets = Array.isArray(snippets) ? snippets : []
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []
  const nodeMap = new Map<string, GraphNode>()
  const nodeMapLower = new Map<string, GraphNode>() // Optimization for O(1) normalized canonical lookups

  // 1. Create Nodes (Existing Notes)
  safeSnippets.forEach((snippet) => {
    const id = snippet.title || 'Untitled'
    if (!nodeMap.has(id)) {
      const node: GraphNode = { id, group: 'note', val: 1, snippetId: snippet.id }
      nodeMap.set(id, node)
      nodeMapLower.set(normalizeWikilinkTarget(id), node)
      nodes.push(node)
    }
  })

  // 2. Parse Links
  safeSnippets.forEach((snippet) => {
    const sourceId = snippet.title || 'Untitled'
    let code = snippet.code || ''

    // Remove code blocks and inline code so bash syntax like [[ $dir ]] isn't parsed as a wikilink
    code = code.replace(/```[\s\S]*?```/g, '')
    code = code.replace(/`[^`]+`/g, '')
    const wikiRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

    let match: RegExpExecArray | null
    while ((match = wikiRegex.exec(code)) !== null) {
      const targetTitle = match[1].trim()
      const targetKey = normalizeWikilinkTarget(targetTitle)

      // If target doesn't exist as a node yet (Ghost Node), create it
      // but mark it as 'ghost' (not a real file yet)
      let targetNode = nodeMapLower.get(targetKey)

      if (!targetNode) {
        // Create a ghost node
        const ghostId = targetTitle // Use the casing from the link
        if (!nodeMapLower.has(targetKey)) {
          const ghostNode: GraphNode = { id: ghostId, group: 'ghost', val: 0.5 }
          nodeMap.set(ghostId, ghostNode)
          nodeMapLower.set(targetKey, ghostNode)
          nodes.push(ghostNode)
        }
        targetNode = nodeMapLower.get(targetKey)!
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
      const rawTags: unknown[] = Array.isArray(snippet.tags)
        ? snippet.tags
        : typeof snippet.tags === 'string'
          ? snippet.tags.split(',')
          : []
      const tags = rawTags.map((t) => String(t).trim()).filter(Boolean)
      tags.forEach((tag) => {
        const tagId = tag.startsWith('#') ? tag : `#${tag}` // Prefix with hash
        if (!nodeMap.has(tagId)) {
          const tagNode: GraphNode = { id: tagId, group: 'tag', val: 1, label: tagId }
          nodeMap.set(tagId, tagNode)
          nodes.push(tagNode)
        }
        links.push({ source: sourceId, target: tagId, value: 0.5 })
      })
    }

    // 2.6 Parse Inline Tags (#tag) and Mentions (@mention)
    const tagRegex = /(?:^|\s)(#[\w-]+)/g
    const mentionRegex = /(?:^|\s)(@[\w-]+)/g

    let inlineMatch: RegExpExecArray | null
    while ((inlineMatch = tagRegex.exec(code)) !== null) {
      const tagId = inlineMatch[1]
      if (!nodeMap.has(tagId)) {
        const tagNode: GraphNode = { id: tagId, group: 'tag', val: 1, label: tagId }
        nodeMap.set(tagId, tagNode)
        nodes.push(tagNode)
      }
      links.push({ source: sourceId, target: tagId, value: 0.5 })
    }

    while ((inlineMatch = mentionRegex.exec(code)) !== null) {
      const mentionId = inlineMatch[1]
      if (!nodeMap.has(mentionId)) {
        const mentionNode: GraphNode = {
          id: mentionId,
          group: 'mention',
          val: 1,
          label: mentionId
        }
        nodeMap.set(mentionId, mentionNode)
        nodes.push(mentionNode)
      }
      links.push({ source: sourceId, target: mentionId, value: 0.5 })
    }
  })

  // 3. Calculate "Mass" (Centrality) — capped to prevent hub nodes from becoming huge
  links.forEach((link) => {
    const sourceKey = typeof link.source === 'string' ? link.source : link.source.id
    const targetKey = typeof link.target === 'string' ? link.target : link.target.id
    const source = nodeMap.get(sourceKey)
    const target = nodeMap.get(targetKey)
    if (source) source.val += 0.5
    if (target) target.val += 0.5
  })

  // Hard cap: no node can exceed val 8 — keeps the visual size reasonable
  nodes.forEach((n) => {
    if (n.val > 8) n.val = 8
  })

  // Sort nodes by mass so larger nodes render on top of smaller ones
  nodes.sort((a, b) => a.val - b.val)

  return { nodes, links }
}

export const buildSemanticLinks = (
  nodes: GraphNode[],
  links: GraphLink[],
  _snippets: GraphSnippetInput[] | null | undefined,
  embeddingsCache: EmbeddingsCache | null | undefined
): GraphLink[] => {
  if (
    !embeddingsCache ||
    typeof embeddingsCache !== 'object' ||
    Object.keys(embeddingsCache).length === 0
  ) {
    return []
  }

  const semanticLinks: GraphLink[] = []
  const THRESHOLD = 0.82

  const realNodes = nodes.filter((n) => n.group === 'note')

  // 1. Pre-normalize embeddings into highly optimized Float32Arrays
  // This completely eliminates square roots, divisions, and array allocations in the O(N^2) loop
  const normalizedCache = new Map<string, Float32Array>()
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
  const linkSet = new Set<string>()
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
