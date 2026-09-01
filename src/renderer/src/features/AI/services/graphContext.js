/**
 * Knowledge Graph Context Extractor (Polished)
 * Traverses 1-hop and 2-hop backlinks, forward links, and connected clusters in the vault.
 */

export const extractGraphContext = (
  targetSnippets,
  allSnippets,
  maxHops = 2,
  maxConnectedNotes = 6
) => {
  if (!targetSnippets || targetSnippets.length === 0 || !allSnippets || allSnippets.length === 0) {
    return ''
  }

  // Canonical title dictionary (lowercased -> original casing)
  const canonicalTitles = new Map()
  allSnippets.forEach((s) => {
    if (s?.title) {
      const clean = s.title.trim()
      canonicalTitles.set(clean.toLowerCase(), clean)
    }
  })

  const linkRegex = /\[\[(.*?)\]\]/g
  const forwardLinks = new Map() // lowerTitle -> Set of lowerTitle targets
  const backLinks = new Map() // lowerTitle -> Set of lowerTitle sources

  allSnippets.forEach((s) => {
    const sTitle = (s.title || '').trim()
    if (!sTitle) return
    const sKey = sTitle.toLowerCase()
    const code = s.code || ''
    const matches = [...code.matchAll(linkRegex)].map((m) => {
      const raw = m[1] || ''
      return raw.split('|')[0].split('#')[0].trim().toLowerCase()
    })

    if (!forwardLinks.has(sKey)) forwardLinks.set(sKey, new Set())
    matches.forEach((targetKey) => {
      if (!targetKey || targetKey === sKey) return // Skip empty or self-links

      forwardLinks.get(sKey).add(targetKey)

      if (!backLinks.has(targetKey)) backLinks.set(targetKey, new Set())
      backLinks.get(targetKey).add(sKey)
    })
  })

  // Traverse 1-hop and 2-hop neighbors for target snippets
  const visited = new Set()
  const graphConnections = []

  targetSnippets.forEach((ts) => {
    const title = (ts.title || '').trim()
    if (!title) return
    const tKey = title.toLowerCase()
    visited.add(tKey)

    const fwd = Array.from(forwardLinks.get(tKey) || [])
    const bwd = Array.from(backLinks.get(tKey) || [])

    const directKeys = [...new Set([...fwd, ...bwd])].filter((k) => k !== tKey)
    if (directKeys.length > 0) {
      const formattedDirect = directKeys
        .map((k) => `[[${canonicalTitles.get(k) || k}]]`)
        .join(', ')
      graphConnections.push(`- **${title}** directly connects to: ${formattedDirect}`)
    }

    if (maxHops >= 2) {
      directKeys.slice(0, 3).forEach((neighborKey) => {
        if (!visited.has(neighborKey)) {
          visited.add(neighborKey)
          const nFwd = Array.from(forwardLinks.get(neighborKey) || [])
          const nBwd = Array.from(backLinks.get(neighborKey) || [])
          const secondHop = [...new Set([...nFwd, ...nBwd])].filter(
            (k) => k !== tKey && k !== neighborKey
          )
          if (secondHop.length > 0) {
            const neighborName = canonicalTitles.get(neighborKey) || neighborKey
            const formattedSecond = secondHop
              .slice(0, 3)
              .map((k) => `[[${canonicalTitles.get(k) || k}]]`)
              .join(', ')
            graphConnections.push(`  └─ [[${neighborName}]] connects deeper to: ${formattedSecond}`)
          }
        }
      })
    }
  })

  if (graphConnections.length === 0) return ''

  return `\n**🕸️ Active Knowledge Graph Topology (1-2 Hops):**\n${graphConnections.slice(0, maxConnectedNotes).join('\n')}\n`
}
