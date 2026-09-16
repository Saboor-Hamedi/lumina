import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { useSettingsStore } from '../../../core/store/SettingStore'
import { AIProviderFactory, resolveProviderConfig } from '../providers/index.js'

function sanitizeTitle(str) {
  return (str || 'Untitled').replace(/[/\\:*?"<>|]/g, '').trim()
}

function generateSummaryTitle(notes) {
  if (!notes || notes.length === 0) return 'Summary'
  const names = notes.map((n) => sanitizeTitle(n.title))
  if (names.length === 1) return `Summary — ${names[0]}`
  if (names.length === 2) return `Summary — ${names[0]} & ${names[1]}`
  const joined = names.join(' & ')
  if (joined.length <= 60) return `Summary — ${joined}`
  return `Summary — ${names.slice(0, 2).join(', ')} +${names.length - 2} more`
}

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).substring(2, 15)
}

function resolveTargetFolder(notes) {
  if (!notes || notes.length === 0) return ''
  const firstFolder = notes[0]?.folderId || ''
  const same = notes.every((n) => (n.folderId || '') === firstFolder)
  return same ? firstFolder : ''
}

export async function summarizeNotes(inputNotes, options = {}) {
  const validNotes = (Array.isArray(inputNotes) ? inputNotes : [inputNotes]).filter(Boolean)
  if (validNotes.length === 0) return null

  const settingsObj = useSettingsStore.getState().settings || {}
  const { providerType, activeModel, apiKey, baseUrl } = resolveProviderConfig(settingsObj)

  if (providerType !== 'ollama' && !apiKey) {
    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: {
          message: `You don't have an API key configured for ${providerType.toUpperCase()}. Please set it in Settings.`,
          type: 'warning'
        }
      })
    )
    return null
  }

  const baseTitle = generateSummaryTitle(validNotes)
  const targetFolderId = resolveTargetFolder(validNotes)

  let finalTitle = baseTitle
  let counter = 1
  const existingNotes = useWorkspaceStore.getState().notes || []
  while (
    existingNotes.some(
      (s) =>
        s.title.toLowerCase() === finalTitle.toLowerCase() &&
        (s.folderId || '') === (targetFolderId || '')
    )
  ) {
    finalTitle = `${baseTitle} (${++counter})`
  }

  const sourceLinks = validNotes.map((n) => `- [[${n.title}]]`).join('\n')
  const headerSection = `# ${finalTitle}\n\n**Source Notes:**\n${sourceLinks}\n\n---\n\n`
  const initialCode = `${headerSection}> ⏳ *Summarizing with Lumina AI...*\n`

  const newId = generateId()
  const newNote = {
    id: newId,
    title: finalTitle,
    code: initialCode,
    folderId: targetFolderId,
    language: 'markdown',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  const storeState = useWorkspaceStore.getState()
  if (storeState.saveNote) await storeState.saveNote(newNote)
  if (storeState.setSelectedNote) storeState.setSelectedNote(newNote)

  try {
    const systemPrompt = `You are Lumina AI, an intelligent personal knowledge assistant.
Analyze the provided note(s) and generate an insightful, highly adaptive, and compact summary in clean Markdown.

Adapt intelligently to the content:
- If the notes contain financial numbers, expenses, prices, or budgets:
  * Highlight exact figures, cost breakdowns, and totals clearly.
  * Use a clean, compact Markdown table for expense items or numerical breakdowns if appropriate.
- If the notes contain metrics, dates, statistics, or measurable data:
  * Prominently extract and bold key numbers, milestones, and metrics.
- If the notes contain tasks, action items, or meeting decisions:
  * Surface clear action items with owners/deadlines if specified.
- If the notes contain code, architecture, or technical details:
  * Synthesize the stack, key components, and design choices.

Formatting & Length Guidelines:
- Keep the summary compact, punchy, and scannable (under 250 words total).
- Start with a concise 1-2 sentence overview of the core subject.
- Organize with clear, tailored Markdown headings and bullet points (e.g., Overview, Key Highlights, Financial Breakdown, Action Items).
- Faithfully preserve all exact figures, currencies, metrics, and vital facts.
- Avoid generic pleasantries, filler phrases, and repetitive prose.`

    const userPrompt =
      validNotes.length === 1
        ? `# ${validNotes[0].title}\n\n${validNotes[0].code || '(Empty note)'}`
        : validNotes
            .map((n, i) => `## Note ${i + 1}: ${n.title}\n\n${n.code || '(Empty note)'}`)
            .join('\n\n---\n\n')

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    const provider = AIProviderFactory.createProvider(providerType, {
      apiKey,
      baseUrl
    })

    let streamed = ''
    let lastUpdateTime = Date.now()
    const UPDATE_INTERVAL = 100

    for await (const chunk of provider.chatStream(messages, {
      model: activeModel,
      max_tokens: 1024,
      signal: options.signal
    })) {
      if (options.signal?.aborted) break
      streamed += chunk
      const currentFull = `${headerSection}${streamed}`
      if (Date.now() - lastUpdateTime > UPDATE_INTERVAL) {
        lastUpdateTime = Date.now()
        useWorkspaceStore.getState().setDraft(newId, currentFull)
        window.dispatchEvent(
          new CustomEvent('ai-saved-snippet', {
            detail: { id: newId, code: currentFull, title: finalTitle, autoScroll: true }
          })
        )
      }
    }

    const finalBody = `${headerSection}${streamed}`
    const finalNote = {
      ...newNote,
      code: finalBody,
      updatedAt: new Date().toISOString()
    }
    if (useWorkspaceStore.getState().saveNote) {
      await useWorkspaceStore.getState().saveNote(finalNote)
    }
    window.dispatchEvent(
      new CustomEvent('ai-saved-snippet', {
        detail: { id: newId, code: finalBody, title: finalTitle, autoScroll: true }
      })
    )
    window.dispatchEvent(new CustomEvent('clear-toast'))
    return finalNote
  } catch (err) {
    const errorNotice = `${headerSection}> ⚠️ **Summary Generation Failed**\n>\n> ${err.message || 'Unknown error occurred while contacting AI service.'}`
    const failedNote = {
      ...newNote,
      code: errorNotice,
      updatedAt: new Date().toISOString()
    }
    if (useWorkspaceStore.getState().saveNote) {
      await useWorkspaceStore.getState().saveNote(failedNote)
    }
    window.dispatchEvent(
      new CustomEvent('ai-saved-snippet', {
        detail: { id: newId, code: errorNotice, title: finalTitle }
      })
    )
    window.dispatchEvent(new CustomEvent('clear-toast'))
    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: { message: `Summary failed: ${err.message || 'Error'}`, type: 'error' }
      })
    )
    return failedNote
  }
}
