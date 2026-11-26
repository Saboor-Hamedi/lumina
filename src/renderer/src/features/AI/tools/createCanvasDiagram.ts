import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'
import { compileCanvasDiagramSpec, type CanvasDiagramSpec } from '../../canvas/ai'

export interface CreateCanvasDiagramInput extends CanvasDiagramSpec {
  title: string
  folder?: string
  openAfterCreate?: boolean
  ifExists?: 'upsert' | 'rename'
}

/**
 * createCanvasDiagramTool
 * Generates a 100% native Lumina `.canvas` file from a clean semantic diagram
 * blueprint. Lumina's deterministic layout engine computes exact non-overlapping
 * integer coordinates, native shapes, auto-sized frames, smart edge routing,
 * and centered viewport — guaranteeing zero lag and full editability.
 */
export const createCanvasDiagramTool = aiSdk.tool({
  description:
    'Create an interactive native Lumina `.canvas` visual diagram (flowchart, system architecture, mindmap, concept-map, or timeline) from semantic nodes, edges, and optional groups. Do NOT compute pixel coordinates — Lumina automatically computes a clean, non-overlapping native layout with smart edge routing and opens the canvas.',
  inputSchema: aiSdk.jsonSchema<CreateCanvasDiagramInput>({
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Title of the canvas diagram (e.g. "RAG Pipeline Architecture", no .canvas extension).'
      },
      folder: {
        type: 'string',
        description: 'Optional workspace-relative folder path. Leave empty for workspace root.'
      },
      layout: {
        type: 'string',
        enum: ['flowchart', 'architecture', 'mindmap', 'concept-map', 'timeline'],
        description: 'Visual layout strategy (default: "flowchart").'
      },
      direction: {
        type: 'string',
        enum: ['TB', 'LR'],
        description: 'Flow direction: "TB" (top-to-bottom) or "LR" (left-to-right).'
      },
      groups: {
        type: 'array',
        description: 'Optional visual frame groups enclosing related nodeIds.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            color: {
              type: 'string',
              enum: ['default', 'red', 'orange', 'yellow', 'green', 'cyan', 'purple', 'blue', 'pink']
            },
            nodeIds: { type: 'array', items: { type: 'string' } }
          },
          required: ['id', 'label', 'nodeIds']
        }
      },
      nodes: {
        type: 'array',
        description: 'List of diagram nodes (max 60). Each node needs a short unique id and concise label.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            description: { type: 'string' },
            kind: { type: 'string', enum: ['shape', 'sticky', 'text'] },
            shape: {
              type: 'string',
              enum: [
                'rectangle',
                'rounded-rectangle',
                'circle',
                'diamond',
                'hexagon',
                'cylinder',
                'cloud',
                'pill',
                'document',
                'step',
                'shield',
                'actor',
                'queue',
                'server',
                'browser',
                'terminal'
              ]
            },
            color: {
              type: 'string',
              enum: ['default', 'red', 'orange', 'yellow', 'green', 'cyan', 'purple', 'blue', 'pink']
            }
          },
          required: ['id', 'label']
        }
      },
      edges: {
        type: 'array',
        description: 'Directional connectors linking node ids.',
        items: {
          type: 'object',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            label: { type: 'string' },
            color: {
              type: 'string',
              enum: ['default', 'red', 'orange', 'yellow', 'green', 'cyan', 'purple', 'blue', 'pink']
            },
            lineStyle: { type: 'string', enum: ['curved', 'step', 'straight'] },
            strokeDash: { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
            bidirectional: { type: 'boolean' }
          },
          required: ['from', 'to']
        }
      },
      openAfterCreate: {
        type: 'boolean',
        description: 'Whether to open the newly created canvas tab immediately (default: true).'
      },
      ifExists: {
        type: 'string',
        enum: ['upsert', 'rename'],
        description: 'Behavior if a canvas with the same title already exists (default: "upsert").'
      }
    },
    required: ['title', 'nodes']
  }),
  execute: async ({
    title,
    folder,
    layout,
    direction,
    groups,
    nodes,
    edges,
    openAfterCreate = true,
    ifExists = 'upsert'
  }): Promise<AIToolExecutionResult> => {
    try {
      if (!Array.isArray(nodes) || nodes.length === 0) {
        return {
          success: false,
          error: 'At least one node is required to create a canvas diagram.'
        }
      }

      const rawTitle = String(title || 'Untitled Canvas')
        .trim()
        .replace(/^@/, '')
        .replace(/\.canvas$/i, '')
        .replace(/\\/g, '/')

      let rawFolder = String(folder || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '')

      if (/^(?:root|workspace root|vault root|project root|workspace|vault|\.)$/i.test(rawFolder)) {
        rawFolder = ''
      }

      let cleanTitle = rawTitle
      if (rawTitle.includes('/')) {
        const parts = rawTitle.split('/').filter(Boolean)
        cleanTitle = parts.pop() || 'Untitled Canvas'
        const titleFolder = parts.join('/')
        rawFolder = rawFolder ? `${rawFolder}/${titleFolder}` : titleFolder
      }
      cleanTitle = cleanTitle.trim() || 'Untitled Canvas'
      const cleanFolder = rawFolder.replace(/^\/+|\/+$/g, '')

      // Compile semantic spec into 100% native zero-lag CanvasData
      const canvasData = compileCanvasDiagramSpec({
        title: cleanTitle,
        layout,
        direction,
        groups,
        nodes,
        edges
      })

      const serialized = JSON.stringify(canvasData, null, 2)
      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const vs = (useWorkspaceStore as any).getState()
      const existingNotes: any[] = Array.isArray(vs?.notes)
        ? vs.notes
        : Array.isArray(vs?.snippets)
          ? vs.snippets
          : []

      const normTitle = (t: string) =>
        String(t || '')
          .trim()
          .replace(/\.canvas$/i, '')
          .toLowerCase()
      const normFolder = (f: string) =>
        String(f || '')
          .replace(/\\/g, '/')
          .replace(/^\/+|\/+$/g, '')
          .toLowerCase()

      const existingMatch = existingNotes.find(
        (n: any) =>
          (n?.type === 'canvas' || /\.canvas$/i.test(String(n?.fileName || ''))) &&
          normTitle(n.title) === normTitle(cleanTitle) &&
          normFolder(n.folderId) === normFolder(cleanFolder)
      )

      if (existingMatch && ifExists === 'rename') {
        let suffix = 2
        while (
          existingNotes.some(
            (n: any) =>
              normTitle(n.title) === normTitle(`${cleanTitle} (${suffix})`) &&
              normFolder(n.folderId) === normFolder(cleanFolder)
          )
        ) {
          suffix++
        }
        cleanTitle = `${cleanTitle} (${suffix})`
      }

      if (cleanFolder && (window as any).api?.createFolder) {
        try {
          await (window as any).api.createFolder(cleanFolder)
        } catch {}
      }
      if (cleanFolder && vs?.addFolder) {
        vs.addFolder(cleanFolder)
      }

      const relativePath = cleanFolder ? `${cleanFolder}/${cleanTitle}.canvas` : `${cleanTitle}.canvas`
      const id =
        existingMatch && ifExists === 'upsert'
          ? existingMatch.id
          : relativePath

      const canvasSnippet = {
        ...(existingMatch && ifExists === 'upsert' ? existingMatch : {}),
        id,
        title: cleanTitle,
        fileName: `${cleanTitle}.canvas`,
        code: serialized,
        language: 'canvas',
        type: 'canvas',
        tags: existingMatch?.tags || '',
        folderId: cleanFolder,
        relativePath,
        timestamp: Date.now(),
        isPinned: existingMatch?.isPinned ?? false,
        isLearned: existingMatch?.isLearned ?? false
      }

      let savedSnippet: any = canvasSnippet
      if (typeof vs?.saveNote === 'function') {
        const returned = await vs.saveNote(canvasSnippet)
        if (returned && typeof returned === 'object' && returned.id) {
          savedSnippet = returned
        }
      } else if ((window as any).api?.saveNote) {
        const returned = await (window as any).api.saveNote(canvasSnippet)
        if (returned && typeof returned === 'object' && returned.id) {
          savedSnippet = returned
        }
      }

      // Resolve canonical note from store after save so the opened tab ID matches disk 1:1
      // and never closes when workspace reconciliation runs.
      const freshState = (useWorkspaceStore as any).getState()
      const freshNotes: any[] = Array.isArray(freshState?.notes) ? freshState.notes : []
      const canonicalNote =
        freshNotes.find((n: any) => n.id === savedSnippet.id) ||
        freshNotes.find(
          (n: any) =>
            normTitle(n.title) === normTitle(cleanTitle) &&
            normFolder(n.folderId) === normFolder(cleanFolder) &&
            (n.type === 'canvas' || /\.canvas$/i.test(String(n.fileName || '')))
        ) ||
        savedSnippet

      if (openAfterCreate && typeof freshState?.setSelectedNote === 'function') {
        freshState.setSelectedNote(canonicalNote)
      }

      const displayPath = cleanFolder ? `${cleanFolder}/${cleanTitle}` : cleanTitle
      return {
        success: true,
        id,
        title: cleanTitle,
        folderId: cleanFolder,
        summary: `Created interactive canvas [[${displayPath}|${cleanTitle}]] with ${canvasData.nodes.length} elements and ${canvasData.edges.length} smart connections.`,
        result: {
          id,
          title: cleanTitle,
          fileName: `${cleanTitle}.canvas`,
          folder: cleanFolder,
          nodeCount: canvasData.nodes.length,
          edgeCount: canvasData.edges.length
        }
      }
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to create canvas diagram.'
      }
    }
  }
})
