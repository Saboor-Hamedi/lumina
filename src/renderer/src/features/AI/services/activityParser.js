/**
 * Activity Parser Service
 * Parses raw <lumina-activity> text lines into structured mutation items and hierarchical trees.
 */

export const parseActivityItems = (rawContent) => {
  if (!rawContent) return []
  const lines = rawContent.split('\n').map((l) => l.trim()).filter(Boolean)
  const parsed = []
  const seen = new Set()

  for (const line of lines) {
    let added = 0
    let removed = 0
    let cleanLine = line
    const diffMatch =
      cleanLine.match(/\(\+([0-9]+)(?:,\s*-([0-9]+))?\)/) ||
      cleanLine.match(/\(-([0-9]+)\)/)

    if (diffMatch) {
      if (diffMatch[0].startsWith('(-')) {
        removed = parseInt(diffMatch[1], 10) || 0
      } else {
        added = parseInt(diffMatch[1], 10) || 0
        removed = parseInt(diffMatch[2], 10) || 0
      }
      cleanLine = cleanLine.replace(diffMatch[0], '').trim()
    }

    const extractTarget = (str) => {
      const m =
        str.match(/\[\[(.*?)\]\]/) ||
        str.match(/[`"']([^`"']+)['"`]/) ||
        str.match(/\*\*([^*]+)\*\*/)
      return m ? m[1].trim() : null
    }

    const extractFolder = (str) => {
      const m =
        str.match(/(?:in\s+(?:folder\s+)?|to\s+(?:folder\s+)?)(?:[`"'])([^`"']+)(?:[`"'])/i) ||
        str.match(/(?:in|to)\s+folder\s+([a-zA-Z0-9_\-/\\]+)/i)
      return m ? m[1].trim().replace(/^[/\\]+|[/\\]+$/g, '') : null
    }

    const folder = extractFolder(cleanLine)

    // Active status lines during streaming
    if (cleanLine.includes('*Creating folder') || cleanLine.includes('📁 *Creating')) {
      const target = extractTarget(cleanLine)
      if (target) {
        parsed.push({ type: 'folder', target, action: 'create', isActive: true })
        continue
      }
    }
    if (cleanLine.includes('*Drafting') || cleanLine.includes('📝 *Drafting')) {
      const target = extractTarget(cleanLine)
      if (target) {
        parsed.push({ type: 'file', target, folder, action: 'create', isActive: true })
        continue
      }
    }
    if (cleanLine.includes('*Updating') || cleanLine.includes('✏️ *Updating')) {
      const target = extractTarget(cleanLine)
      if (target) {
        parsed.push({ type: 'file', target, action: 'update', isActive: true })
        continue
      }
    }
    if (cleanLine.includes('*Reading') || cleanLine.includes('📄 *Reading') || cleanLine.includes('📖 *Reading')) {
      const target = extractTarget(cleanLine)
      if (target) {
        parsed.push({ type: 'file', target, action: 'read', isActive: true })
        continue
      }
    }

    // Completed summary lines
    if (cleanLine.toLowerCase().includes('created folder')) {
      const target = extractTarget(cleanLine)
      if (target && !seen.has(`folder:create:${target}`)) {
        seen.add(`folder:create:${target}`)
        parsed.push({ type: 'folder', target, action: 'create', isActive: false })
        continue
      }
    }

    if (cleanLine.toLowerCase().includes('moved folder')) {
      const target = extractTarget(cleanLine)
      if (target && !seen.has(`folder:move:${target}`)) {
        seen.add(`folder:move:${target}`)
        parsed.push({ type: 'folder', target, action: 'move', isActive: false })
        continue
      }
    }

    if (cleanLine.toLowerCase().includes('deleted folder')) {
      const target = extractTarget(cleanLine)
      if (target && !seen.has(`folder:delete:${target}`)) {
        seen.add(`folder:delete:${target}`)
        parsed.push({ type: 'folder', target, action: 'delete', isActive: false })
        continue
      }
    }

    if (cleanLine.toLowerCase().includes('renamed folder')) {
      const target = extractTarget(cleanLine)
      if (target && !seen.has(`folder:rename:${target}`)) {
        seen.add(`folder:rename:${target}`)
        parsed.push({ type: 'folder', target, action: 'rename', isActive: false })
        continue
      }
    }

    if (cleanLine.toLowerCase().includes('renamed')) {
      const target = extractTarget(cleanLine)
      if (target && !seen.has(`file:rename:${target}`)) {
        seen.add(`file:rename:${target}`)
        parsed.push({ type: 'file', target, action: 'rename', isActive: false })
        continue
      }
    }

    if (cleanLine.toLowerCase().includes('moved')) {
      const target = extractTarget(cleanLine)
      if (target && !seen.has(`file:move:${target}`)) {
        seen.add(`file:move:${target}`)
        parsed.push({ type: 'file', target, folder, action: 'move', isActive: false })
        continue
      }
    }

    if (
      cleanLine.toLowerCase().includes('updated') ||
      cleanLine.toLowerCase().includes('appended to') ||
      cleanLine.toLowerCase().includes('cleared')
    ) {
      const target = extractTarget(cleanLine)
      if (target && !seen.has(`file:update:${target}`)) {
        seen.add(`file:update:${target}`)
        parsed.push({ type: 'file', target, action: 'update', added, removed, isActive: false })
        continue
      }
    }

    if (cleanLine.toLowerCase().includes('deleted')) {
      const target = extractTarget(cleanLine)
      if (target && !seen.has(`file:delete:${target}`)) {
        seen.add(`file:delete:${target}`)
        parsed.push({ type: 'file', target, action: 'delete', added, removed, isActive: false })
        continue
      }
    }

    if (cleanLine.toLowerCase().includes('created') || cleanLine.toLowerCase().includes('drafting')) {
      const target = extractTarget(cleanLine)
      if (target && !seen.has(`file:create:${target}`)) {
        seen.add(`file:create:${target}`)
        parsed.push({ type: 'file', target, folder, action: 'create', added, removed, isActive: false })
        continue
      }
    }
  }

  // Deduplicate: If an item has both an in-progress version and a completed version, discard in-progress
  const finalItems = []
  const completedKeys = new Set(
    parsed.filter((p) => !p.isActive).map((p) => `${p.type}:${p.target}`)
  )

  for (const p of parsed) {
    const key = `${p.type}:${p.target}`
    if (p.isActive && completedKeys.has(key)) {
      continue
    }
    finalItems.push(p)
  }

  return finalItems
}

export const buildActivityTree = (mutationItems) => {
  const foldersMap = new Map()
  const rootItems = []

  for (const item of mutationItems) {
    if (item.type === 'folder') {
      if (!foldersMap.has(item.target)) {
        foldersMap.set(item.target, { folder: item, children: [] })
      } else {
        foldersMap.get(item.target).folder = item
      }
    }
  }

  for (const item of mutationItems) {
    if (item.type === 'folder') continue

    if (item.folder) {
      if (!foldersMap.has(item.folder)) {
        foldersMap.set(item.folder, {
          folder: {
            type: 'folder',
            target: item.folder,
            action: 'reference',
            isActive: false
          },
          children: []
        })
      }
      foldersMap.get(item.folder).children.push(item)
    } else {
      rootItems.push(item)
    }
  }

  return {
    folderGroups: Array.from(foldersMap.values()),
    rootItems
  }
}
