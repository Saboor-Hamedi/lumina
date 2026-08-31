/**
 * Knowledge Graph Context Extractor
 * Traverses 1-hop and 2-hop backlinks, forward links, and connected clusters in the vault.
 */

export const extractGraphContext = (targetSnippets, allSnippets, maxHops = 2, maxConnectedNotes = 6) => {
  if (!targetSnippets || targetSnippets.length === 0 || !allSnippets || allSnippets.length === 0) {
    return ''
  }

  const snippetMap = new Map()
  allSnippets.forEach((s) => {
    if (s?.title) {
      snippetMap.set(s.title.toLowerCase().trim(), s)
      snippetMap.set(s.id, s)
    }
  })

  const linkRegex = /\[\[(.*?)\]\]/g
  const forwardLinks = new Map() // noteTitle -> Set of linked note titles
  const backLinks = new Map() // noteTitle -> Set of notes linking to it

  allSnippets.forEach((s) => {
    const sTitle = (s.title || '').trim()
    if (!sTitle) return
    const code = s.code || ''
    const matches = [...code.matchAll(linkRegex)].map((m) => {
      const raw = m[1] || ''
      return raw.split('|')[0].split('#')[0].trim()
    })

    if (!forwardLinks.has(sTitle)) forwardLinks.set(sTitle, new Set())
    matches.forEach((target) => {
      forwardLinks.get(sTitle).add(target)

      if (!backLinks.has(target)) backLinks.set(target, new Set())
      backLinks.get(target).add(sTitle)
    })
  })

  // Traverse 1-hop and 2-hop neighbors for target snippets
  const visited = new Set()
  const graphConnections = []

  targetSnippets.forEach((ts) => {
    const title = (ts.title || '').trim()
    if (!title) return
    visited.add(title.toLowerCase())

    const fwd = Array.from(forwardLinks.get(title) || [])
    const bwd = Array.from(backLinks.get(title) || [])

    const directConnections = [...new Set([...fwd, ...bwd])]
    if (directConnections.length > 0) {
      graphConnections.push(`- **${title}** directly connects to: ${directConnections.map((c) => `[[${c}]]`).join(', ')}`)
    }

    if (maxHops >= 2) {
      directConnections.slice(0, 3).forEach((neighbor) => {
        const nKey = neighbor.toLowerCase()
        if (!visited.has(nKey)) {
          visited.add(nKey)
          const nFwd = Array.from(forwardLinks.get(neighbor) || [])
          const nBwd = Array.from(backLinks.get(neighbor) || [])
          const secondHop = [...new Set([...nFwd, ...nBwd])].filter((n) => n.toLowerCase() !== title.toLowerCase())
          if (secondHop.length > 0) {
            graphConnections.push(`  └─ [[${neighbor}]] connects deeper to: ${secondHop.slice(0, 3).map((c) => `[[${c}]]`).join(', ')}`)
          }
        }
      })
    }
  })

  if (graphConnections.length === 0) return ''

  return `\n**🕸️ Active Knowledge Graph Topology (1-2 Hops):**\n${graphConnections.slice(0, maxConnectedNotes).join('\n')}\n`
}
