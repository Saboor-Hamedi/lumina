/**
 * ============================================================================
 * Lumina AI Tool Call Interceptor & Leaked Markup Parser
 * ============================================================================
 * 
 * Intercepts, extracts, and dispatches tool calls that leak as plain text or
 * pseudo-markup in the model stream:
 * 
 * 1. DeepSeek DSML Invocations: `<|invoke:toolName|>...<|/invoke|>`
 * 2. Standard XML Pseudo-Calls: `<tool_call name="toolName">...</tool_call>`
 * 3. Direct XML Tagged Calls: `<luminaQueryIndex>...</luminaQueryIndex>`
 * 4. Content Cleaning (`cleanRawToolLeaks`): Strips raw markup so leaked code
 *    does not pollute the user's visible chat text.
 */

export interface ParseAndExecuteResult {
  cleanedText: string
  didExecute: boolean
  toolOutputs: Array<{
    type: 'index' | 'health' | 'audit' | 'activity' | 'memory'
    content: string
    summary?: string
  }>
}

/**
 * Strips raw XML, DSML, and tool tags from streamed content to prevent visual pollution.
 */
export const cleanRawToolLeaks = (text?: string): string => {
  if (!text) return ''
  return text
    .replace(/<[｜|]{1,2}[\s\S]*?[｜|]{1,2}>/g, '')
    .replace(/<[^>]*(?:DSML|tool_calls?)[^>]*>/gi, '')
    .replace(
      /<\/?(?:tool_calls?|invoke|parameter|luminaQueryIndex|queryIndex|luminaDiagnoseSystem|diagnoseSystem|auditWikilinks)[^>]*>/gi,
      ''
    )
    .replace(
      /<(?:query|sortby|limit|tag|folder|linksTo|backlinksFor|hasFrontmatter|hasHeadings)>[\s\S]*?<\/(?:query|sortby|limit|tag|folder|linksTo|backlinksFor|hasFrontmatter|hasHeadings)>/gi,
      ''
    )
    .replace(/limit>\s*\d+\s*<\/limit>/gi, '')
    .replace(/(?:^|\s)[a-zA-Z0-9_-]+">\s*/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Parses tool arguments from XML bodies, attribute strings, and JSON objects.
 */
export const extractParamsFromBody = (body: string, tagAttrText: string = ''): Record<string, any> => {
  const params: Record<string, any> = {}

  if (tagAttrText) {
    const attrRegex = /([a-zA-Z0-9_-]+)=["']([^"']*)["']/g
    for (const attrMatch of tagAttrText.matchAll(attrRegex)) {
      params[attrMatch[1]] = attrMatch[2].trim()
    }
  }

  const paramRegex =
    /<[｜|]{1,2}(?:DSML[｜|]{1,2})?parameter\s+name=["']([a-zA-Z0-9_-]+)["']>([\s\S]*?)(?:<\/[｜|]{1,2}(?:DSML[｜|]{1,2})?parameter>|$)/gi
  for (const pMatch of body.matchAll(paramRegex)) {
    params[pMatch[1]] = pMatch[2].trim()
  }

  const childRegex = /<([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1>/gi
  for (const cMatch of body.matchAll(childRegex)) {
    params[cMatch[1]] = cMatch[2].trim()
  }

  const limitMatch = body.match(/limit>\s*(\d+)\s*<\/limit>/i)
  if (limitMatch && !params.limit) {
    params.limit = Number(limitMatch[1])
  }

  const trimmed = body.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed)
      Object.assign(params, parsed)
    } catch (_) {}
  }

  return params
}

/**
 * Robust parser for leaked tool invocations (DSML, standard XML, direct tags, or pseudo-markup).
 */
export const parseAndExecuteDSML = async (
  text: string,
  sdkTools: Record<string, any>,
  executedActions: string[]
): Promise<ParseAndExecuteResult> => {
  const toolOutputs: ParseAndExecuteResult['toolOutputs'] = []
  if (!text) {
    return { cleanedText: '', didExecute: false, toolOutputs }
  }

  const hasToolIndicator =
    text.includes('DSML') ||
    text.includes('tool_call') ||
    text.includes('invoke') ||
    text.includes('｜') ||
    text.includes('|') ||
    /<(?:luminaQueryIndex|queryIndex|luminaDiagnoseSystem|diagnoseSystem|auditWikilinks|createFile|createFolder|updateFile|deleteFile)\b/i.test(
      text
    ) ||
    /\b(?:luminaQueryIndex|queryIndex|luminaDiagnoseSystem|diagnoseSystem|auditWikilinks)">/i.test(text)

  if (!hasToolIndicator) {
    return {
      cleanedText: cleanRawToolLeaks(text),
      didExecute: false,
      toolOutputs
    }
  }

  let didExecute = false

  const handleToolRun = async (toolName: string, rawParams: Record<string, any>) => {
    const runnableName = toolName === 'luminaDiagnoseSystem' ? 'diagnoseSystem' : toolName
    if (!runnableName || !sdkTools || !sdkTools[runnableName]?.execute) return
    try {
      console.log(`[StreamRunner] Intercepted leaked tool call: ${toolName}`, rawParams)
      const res = await sdkTools[runnableName].execute(rawParams)
      didExecute = true
      if (toolName === 'luminaQueryIndex' || toolName === 'queryIndex') {
        const payload = res?.result
          ? `<<<LUMINA_INDEX_QUERY:${JSON.stringify(res.result)}>>>\n${res?.summaryMarkdown || res?.summary || ''}`
          : res?.summaryMarkdown || res?.summary || ''
        toolOutputs.push({ type: 'index', content: payload })
      } else if (toolName === 'luminaDiagnoseSystem' || toolName === 'diagnoseSystem') {
        toolOutputs.push({ type: 'health', content: res?.summaryMarkdown || res?.summary || '' })
      } else if (toolName === 'auditWikilinks') {
        toolOutputs.push({ type: 'audit', content: res?.summaryMarkdown || res?.summary || '' })
      } else if (toolName.includes('Memory')) {
        toolOutputs.push({ type: 'memory', content: res?.summary || 'Updated memory.' })
      } else if (res?.summary && !executedActions.includes(res.summary)) {
        executedActions.push(res.summary)
        toolOutputs.push({ type: 'activity', content: res.summary, summary: res.summary })
      }
    } catch (err) {
      console.warn(`[StreamRunner] Error executing intercepted tool ${toolName}:`, err)
    }
  }

  // Regex 1: DeepSeek DSML invokes <|invoke:name|>...<|/invoke|>
  const dsmlRegex =
    /<[｜|]{1,2}(?:DSML[｜|]{1,2})?invoke:?([a-zA-Z0-9_-]*)[\s\S]*?>([\s\S]*?)(?:<\/[｜|]{1,2}(?:DSML[｜|]{1,2})?invoke>|$)/gi
  for (const match of text.matchAll(dsmlRegex)) {
    let toolName = (match[1] || '').trim()
    const body = match[2] || ''
    if (!toolName) {
      const nameMatch = match[0].match(/name=["']([a-zA-Z0-9_-]+)["']/i)
      if (nameMatch) toolName = nameMatch[1].trim()
    }
    const params = extractParamsFromBody(body, match[0])
    await handleToolRun(toolName, params)
  }

  // Regex 2: Standard XML pseudo-calls: <tool_call name="luminaQueryIndex">...</tool_call>
  const toolCallRegex =
    /<(?:tool_call|call|invoke)(?:\s*:\s*([a-zA-Z0-9_-]+)|\s+name=["']([a-zA-Z0-9_-]+)["'])?[^>]*>([\s\S]*?)<\/(?:tool_call|call|invoke)>/gi
  for (const match of text.matchAll(toolCallRegex)) {
    const toolName = (match[1] || match[2] || '').trim()
    const body = match[3] || ''
    const params = extractParamsFromBody(body, match[0])
    await handleToolRun(toolName, params)
  }

  // Regex 3: Direct XML tool tag: <luminaQueryIndex>...</luminaQueryIndex> or mangled luminaQueryIndex">...
  const directTagRegex =
    /(?:<tool_call[^>]*name=["']?)?<?\b(luminaQueryIndex|queryIndex|luminaDiagnoseSystem|diagnoseSystem|auditWikilinks|saveMemory|createFile|createFolder|updateFile|deleteFile)["']?>\s*([\s\S]*?)<\/\1>/gi
  for (const match of text.matchAll(directTagRegex)) {
    const toolName = match[1].trim()
    const body = match[2] || ''
    const params = extractParamsFromBody(body, match[0])
    await handleToolRun(toolName, params)
  }

  const cleanedText = cleanRawToolLeaks(text)
  return { cleanedText, didExecute, toolOutputs }
}
