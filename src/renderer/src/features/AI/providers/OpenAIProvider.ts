import { BaseProvider } from './BaseProvider'
import type { ProviderConfig } from '../types/ai.types'
import type { ChatMessageParam, ChatStreamOptions } from './BaseProvider'

function toOpenAITools(tools: Record<string, any> = {}) {
  return Object.entries(tools).flatMap(([name, tool]) => {
    const schema = tool?.inputSchema?.jsonSchema || tool?.inputSchema
    if (!tool?.execute || !schema || typeof schema !== 'object') return []
    return [
      {
        type: 'function' as const,
        function: {
          name,
          description: tool.description || name,
          parameters: schema as Record<string, unknown>
        }
      }
    ]
  })
}

function serializeOpenAIToolResult(result: unknown): string {
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
 * OpenAI Provider.
 * Streams chat completions and multi-step tool calls using OpenAI's /v1/chat/completions SSE endpoint.
 */
export class OpenAIProvider extends BaseProvider {
  constructor(config: ProviderConfig = {}) {
    super(config)
    this.baseUrl = 'https://api.openai.com/v1/chat/completions'
    this.defaultModel = 'gpt-4o'
    this.id = 'openai'
    this.name = 'OpenAI'
  }

  async *chatStream(
    messages: ChatMessageParam[],
    options: ChatStreamOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    if (!this.config.apiKey) {
      throw new Error('Missing OpenAI API Key')
    }

    const sdkTools = (options.tools || {}) as Record<string, any>
    const openAITools = toOpenAITools(sdkTools)
    const onToolActivity = options.onToolActivity as
      | ((toolName: string, args: Record<string, any>, result: any) => void)
      | undefined
    const conversation: any[] = [...messages]
    const maxSteps = 8

    for (let step = 0; step < maxSteps; step++) {
      const bodyPayload: Record<string, any> = {
        model: options.model || this.defaultModel,
        messages: conversation,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens || 4096,
        stream: true
      }
      if (openAITools.length > 0) {
        bodyPayload.tools = openAITools
        bodyPayload.tool_choice = 'auto'
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(bodyPayload),
        signal: options.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI API Error (${response.status}): ${errorText}`)
      }

      let assistantContent = ''
      const toolCallsByIndex = new Map<
        number,
        { id: string; name: string; argumentsText: string }
      >()

      for await (const chunk of this.parseSSE(response)) {
        const delta = chunk?.choices?.[0]?.delta
        const content = delta?.content
        if (content) {
          assistantContent += content
          yield content
        }
        if (Array.isArray(delta?.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = typeof tc.index === 'number' ? tc.index : 0
            const existing = toolCallsByIndex.get(idx) || {
              id: tc.id || `call_${step}_${idx}`,
              name: '',
              argumentsText: ''
            }
            if (tc.id) existing.id = tc.id
            if (tc.function?.name) existing.name += tc.function.name
            if (tc.function?.arguments) existing.argumentsText += tc.function.arguments
            toolCallsByIndex.set(idx, existing)
          }
        }
      }

      const pendingToolCalls = Array.from(toolCallsByIndex.values()).filter((tc) => tc.name)
      if (pendingToolCalls.length === 0) {
        break
      }

      conversation.push({
        role: 'assistant',
        content: assistantContent || null,
        tool_calls: pendingToolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: tc.argumentsText || '{}'
          }
        }))
      })

      for (const tc of pendingToolCalls) {
        let parsedArgs: Record<string, any> = {}
        try {
          parsedArgs = tc.argumentsText ? JSON.parse(tc.argumentsText) : {}
        } catch {
          parsedArgs = {}
        }
        onToolActivity?.(tc.name, parsedArgs, null)
        let toolResult: any = { success: false, error: `Unknown tool: ${tc.name}` }
        if (sdkTools[tc.name]?.execute) {
          try {
            toolResult = await sdkTools[tc.name].execute(parsedArgs)
          } catch (err: any) {
            toolResult = { success: false, error: err?.message || String(err) }
          }
        }
        onToolActivity?.(tc.name, parsedArgs, toolResult)
        conversation.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: serializeOpenAIToolResult(toolResult)
        })
      }
    }
  }
}
