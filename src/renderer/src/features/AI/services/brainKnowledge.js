const brainRawFiles = import.meta.glob('../../../../../../brain/**/*.md', {
  query: '?raw',
  eager: true,
  import: 'default'
})

export const getBrainDocuments = () => {
  const docs = []
  for (const rawPath in brainRawFiles) {
    const match = rawPath.match(/brain\/(.*\.md)$/)
    if (!match) continue
    const relativePath = match[1]
    const rawVal = brainRawFiles[rawPath]
    const content = typeof rawVal === 'string' ? rawVal : (rawVal?.default || String(rawVal || ''))
    const parts = relativePath.split('/')
    const fileName = parts[parts.length - 1]
    const name = fileName.replace(/\.md$/, '')
    const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : ''

    docs.push({
      id: `brain:${relativePath}`,
      path: relativePath,
      name,
      fileName,
      folder,
      title: name,
      code: content,
      content,
      isBrain: true
    })
  }
  return docs
}

export const getBrainFile = (query) => {
  if (!query) return null
  const clean = String(query)
    .trim()
    .toLowerCase()
    .replace(/^(?:brain\/|\.\/)+/, '')
    .replace(/\.md$/, '')
  const docs = getBrainDocuments()

  let found = docs.find((d) => d.path.toLowerCase().replace(/\.md$/, '') === clean)
  if (found) return found

  found = docs.find((d) => d.name.toLowerCase() === clean || d.fileName.toLowerCase() === `${clean}.md`)
  if (found) return found

  found = docs.find((d) => d.path.toLowerCase().includes(clean) || d.name.toLowerCase().includes(clean))
  if (found) return found

  return null
}

export const searchBrain = (query) => {
  if (!query || !query.trim()) return []
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const docs = getBrainDocuments()

  return docs.filter((doc) => {
    const hay = `${doc.path} ${doc.name} ${doc.content}`.toLowerCase()
    return terms.some((term) => hay.includes(term))
  })
}

export const retrieveRelevantKnowledge = (query, limit = 3) => {
  if (!query || !query.trim()) return []
  const clean = query.toLowerCase().trim()
  const docs = getBrainDocuments()

  const scored = []
  docs.forEach((doc) => {
    let score = 0
    const lowerName = doc.name.toLowerCase()
    const lowerContent = doc.content.toLowerCase()

    if (clean.includes(lowerName)) score += 10
    if (
      clean.includes('doc') &&
      (lowerName.includes('intro') || lowerName.includes('syntax') || lowerName.includes('shortcut'))
    ) {
      score += 6
    }
    if (clean.includes('shortcut') && lowerName.includes('shortcut')) score += 15
    if (clean.includes('mermaid') && lowerName.includes('mermaid')) score += 15
    if (clean.includes('math') && lowerName.includes('math')) score += 15
    if (clean.includes('table') && lowerName.includes('table')) score += 15
    if (
      (clean.includes('purpose') || clean.includes('vision') || clean.includes('philosophy')) &&
      (lowerName.includes('purpose') || lowerName.includes('vision'))
    ) {
      score += 15
    }
    if (clean.includes('lumina') && (lowerName.includes('intro') || lowerName.includes('purpose'))) {
      score += 5
    }

    const words = clean.split(/\s+/).filter((w) => w.length > 3)
    words.forEach((w) => {
      if (lowerName.includes(w)) score += 4
      if (lowerContent.includes(w)) score += 1
    })

    if (score > 0) {
      scored.push({ doc, score })
    }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((s) => s.doc)
}

export const getBrainSummaryList = () => {
  const docs = getBrainDocuments()
  if (docs.length === 0) return 'No brain documents found.'
  return docs.map((d) => `- ${d.name} (${d.folder || 'general'})`).join('\n')
}
