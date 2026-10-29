import { BaseProvider } from './BaseProvider'
import type { ProviderConfig } from '../types/ai.types'
import type { ChatMessageParam, ChatStreamOptions } from './BaseProvider'
import { getDefaultModel } from './modelCatalog'

function toAnthropicTools(tools: Record<string, any> = {}) {
  return Object.entries(tools).flatMap(([name, tool]) => {
    const schema = tool?.inputSchema?.jsonSchema || tool?.inputSchema
    if (!tool?.execute || !schema || typeof schema !== 'object') return []
    return [
      {
        name,
        description: tool.description || name,
        input_schema: schema as Record<string, unknown>
      }
    ]
  })
}

function serializeAnthropicToolResult(result: unknown): string {
  try {
    if (typeof result === 'string') return result.slice(0, 12000)
    if (result && typeof result === 'object') {
      const compact = { ...(result as Record<string, unknown>) }
      delete compact.writtenContent
      return JSON.stringify(compact).slice(0, 12000)
    }
    return JSON.stringify(result) || String(result)
  } catch {
    return String(result)
  }
}

/**
 * Anthropic Provider.
 * Streams messages and multi-step tool calls using Claude's /v1/messages SSE endpoint.
 */
export class AnthropicProvider extends BaseProvider {
  constructor(config: ProviderConfig = {}) {
    super(config)
    this.baseUrl = 'https://api.anthropic.com/v1/messages'
    this.defaultModel = getDefaultModel('anthropic') || 'claude-3-5-sonnet-20240620'
    this.id = 'anthropic'
    this.name = 'Anthropic'
  }

  async *chatStream(
    messages: ChatMessageParam[],
    options: ChatStreamOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    if (!this.config.apiKey) {
      throw new Error('Missing Anthropic API Key')
    }

    // Extract system message if present
    let system = ''
    const cleanMessages: any[] = messages.filter((m) => {
      if (m.role === 'system') {
        system = m.content
        return false
      }
      return true
    })

    const sdkTools = (options.tools || {}) as Record<string, any>
    const anthropicTools = toAnthropicTools(sdkTools)
    const onToolActivity = options.onToolActivity as
      | ((toolName: string, args: Record<string, any>, result: any) => void)
      | undefined
    const maxSteps = 8

    for (let step = 0; step < maxSteps; step++) {
      const bodyPayload: Record<string, any> = {
        model: options.model || this.defaultModel,
        messages: cleanMessages,
        system,
        max_tokens: options.max_tokens || 4096,
        stream: true
      }
      if (anthropicTools.length > 0) {
        bodyPayload.tools = anthropicTools
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true' // Required for client-side calls
        },
        body: JSON.stringify(bodyPayload),
        signal: options.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Anthropic API Error (${response.status}): ${errorText}`)
      }

      let assistantText = ''
      const toolBlocks = new Map<number, { id: string; name: string; jsonText: string }>()

      for await (const chunk of this.parseSSE(response)) {
        if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
          const idx = typeof chunk.index === 'number' ? chunk.index : toolBlocks.size
          toolBlocks.set(idx, {
            id: chunk.content_block.id || `toolu_${step}_${idx}`,
            name: chunk.content_block.name || '',
            jsonText: ''
          })
        } else if (chunk.type === 'content_block_delta') {
          if (chunk.delta?.text) {
            assistantText += chunk.delta.text
            yield chunk.delta.text
          } else if (chunk.delta?.type === 'input_json_delta' && chunk.delta?.partial_json) {
            const idx = typeof chunk.index === 'number' ? chunk.index : 0
            const existing = toolBlocks.get(idx)
            if (existing) {
              existing.jsonText += chunk.delta.partial_json
            }
          }
        }
      }

      const pendingTools = Array.from(toolBlocks.values()).filter((tb) => tb.name)
      if (pendingTools.length === 0) {
        break
      }

      const assistantContentBlocks: any[] = []
      if (assistantText) {
        assistantContentBlocks.push({ type: 'text', text: assistantText })
      }
      const toolResultBlocks: any[] = []

      for (const tb of pendingTools) {
        let parsedInput: Record<string, any> = {}
        try {
          parsedInput = tb.jsonText ? JSON.parse(tb.jsonText) : {}
        } catch {
          parsedInput = {}
        }
        assistantContentBlocks.push({
          type: 'tool_use',
          id: tb.id,
          name: tb.name,
          input: parsedInput
        })

        onToolActivity?.(tb.name, parsedInput, null)
        let toolResult: any = { success: false, error: `Unknown tool: ${tb.name}` }
        if (sdkTools[tb.name]?.execute) {
          try {
            toolResult = await sdkTools[tb.name].execute(parsedInput)
          } catch (err: any) {
            toolResult = { success: false, error: err?.message || String(err) }
          }
        }
        onToolActivity?.(tb.name, parsedInput, toolResult)

        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: tb.id,
          content: serializeAnthropicToolResult(toolResult)
        })
      }

      cleanMessages.push({
        role: 'assistant',
        content: assistantContentBlocks
      })
      cleanMessages.push({
        role: 'user',
        content: toolResultBlocks
      })
    }
  }
}
