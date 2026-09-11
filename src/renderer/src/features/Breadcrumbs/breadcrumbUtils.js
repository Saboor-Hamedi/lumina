const COLLATOR = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

export const normalizePath = (p) =>
  p ? String(p).replace(/\\/g, '/').replace(/^[/\\]+|[/\\]+$/g, '') : ''

export const isRootPath = (id) => {
  if (!id) return true
  const clean = normalizePath(id)
  return !clean || clean === 'root'
}

export function getFolderPath(folderId, folders = []) {
  if (isRootPath(folderId)) return []

  const folderMap = new Map()
  let hasObjectHierarchy = false

  if (Array.isArray(folders)) {
    for (const f of folders) {
      if (typeof f === 'object' && f !== null && f.id) {
        folderMap.set(f.id, f)
        if (f.parentId !== undefined) {
          hasObjectHierarchy = true
        }
      }
    }
  }

  if (hasObjectHierarchy && folderMap.has(folderId)) {
    const path = []
    let curr = folderMap.get(folderId)
    const visited = new Set()
    while (curr && !visited.has(curr.id) && path.length < 50) {
      visited.add(curr.id)
      path.unshift({
        id: curr.id,
        name: curr.name || curr.id,
        parentId: curr.parentId ?? null
      })
      curr = curr.parentId ? folderMap.get(curr.parentId) : null
    }
    return path
  }

  const clean = normalizePath(folderId)
  if (!clean) return []

  const parts = clean.split('/').filter(Boolean)
  const path = []
  let acc = ''
  for (let i = 0; i < parts.length; i++) {
    const parentId = acc || null
    acc = acc ? `${acc}/${parts[i]}` : parts[i]
    path.push({
      id: acc,
      name: parts[i],
      parentId
    })
  }

  return path
}

export function getChildFolders(parentFolderId, folders = []) {
  if (!Array.isArray(folders)) return []
  const normParent = isRootPath(parentFolderId) ? null : normalizePath(parentFolderId)
  const result = []
  const seenIds = new Set()

  for (const f of folders) {
    if (!f) continue

    if (typeof f === 'object' && f !== null && f.id) {
      const pId = isRootPath(f.parentId) ? null : normalizePath(f.parentId)
      const isMatch = normParent === null ? pId === null : pId === normParent
      if (isMatch && !seenIds.has(f.id)) {
        seenIds.add(f.id)
        result.push({
          kind: 'folder',
          id: f.id,
          name: f.name || f.id
        })
      }
    } else if (typeof f === 'string') {
      const clean = normalizePath(f)
      if (!clean) continue

      if (normParent === null) {
        const firstSegment = clean.split('/')[0]
        if (!seenIds.has(firstSegment)) {
          seenIds.add(firstSegment)
          result.push({
            kind: 'folder',
            id: firstSegment,
            name: firstSegment
          })
        }
      } else if (clean.startsWith(`${normParent}/`)) {
        const remainder = clean.slice(normParent.length + 1)
        const firstSegment = remainder.split('/')[0]
        const childId = `${normParent}/${firstSegment}`
        if (!seenIds.has(childId)) {
          seenIds.add(childId)
          result.push({
            kind: 'folder',
            id: childId,
            name: firstSegment
          })
        }
      }
    }
  }

  return result.sort((a, b) => COLLATOR.compare(a.name || '', b.name || ''))
}

export function getChildNotes(parentFolderId, snippets = []) {
  if (!Array.isArray(snippets)) return []
  const normParent = isRootPath(parentFolderId) ? null : normalizePath(parentFolderId)
  const result = []

  for (const s of snippets) {
    if (!s || !s.id) continue
    const sFolder = isRootPath(s.folderId) ? null : normalizePath(s.folderId)
    const isMatch = normParent === null ? sFolder === null : sFolder === normParent

    if (isMatch) {
      result.push({
        kind: 'note',
        id: s.id,
        name: s.title || s.fileName || 'Untitled',
        snippet: s
      })
    }
  }

  return result.sort((a, b) => COLLATOR.compare(a.name || '', b.name || ''))
}
