import { BaseProvider } from './BaseProvider'
import type { ProviderConfig } from '../types/ai.types'
import type { ChatMessageParam, ChatStreamOptions } from './BaseProvider'
import { getDefaultModel } from './modelCatalog'

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

function toResponsesTools(tools: Record<string, any> = {}) {
  return Object.entries(tools).flatMap(([name, tool]) => {
    const schema = tool?.inputSchema?.jsonSchema || tool?.inputSchema
    if (!tool?.execute || !schema || typeof schema !== 'object') return []
    return [{ type: 'function', name, description: tool.description || name, parameters: schema }]
  })
}

function getOpenAIModelGeneration(model: string): number {
  const match = /^gpt-(\d+)/i.exec(model)
  return match ? Number(match[1]) : 0
}

/**
 * OpenAI Provider.
 * Streams chat completions and multi-step tool calls using OpenAI's /v1/chat/completions SSE endpoint.
 */
export class OpenAIProvider extends BaseProvider {
  constructor(config: ProviderConfig = {}) {
    super(config)
    this.baseUrl = 'https://api.openai.com/v1/chat/completions'
    this.defaultModel = getDefaultModel('openai') || 'gpt-4o'
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

    const model = options.model || this.defaultModel
    // OpenAI's GPT-6 family requires the Responses API for function calling.
    // Route that family there so tools continue to work with the newest models.
    if (getOpenAIModelGeneration(model) >= 6) {
      yield* this.responsesChatStream(messages, options, sdkTools, openAITools.length ? toResponsesTools(sdkTools) : [])
      return
    }

    for (let step = 0; step < maxSteps; step++) {
      const model = options.model || this.defaultModel
      const isReasoningModel = getOpenAIModelGeneration(model) >= 5 || /^o\d/i.test(model)
      const bodyPayload: Record<string, any> = {
        model,
        messages: conversation,
        ...(isReasoningModel ? {} : { temperature: options.temperature ?? 0.7 }),
        [isReasoningModel ? 'max_completion_tokens' : 'max_tokens']:
          options.max_tokens || 4096,
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

  private async *responsesChatStream(
    messages: ChatMessageParam[],
    options: ChatStreamOptions,
    sdkTools: Record<string, any>,
    responseTools: any[]
  ): AsyncGenerator<string, void, unknown> {
    const onToolActivity = options.onToolActivity as
      | ((toolName: string, args: Record<string, any>, result: any) => void)
      | undefined
    let input: any[] = messages.map((message) => ({
      role: message.role,
      content: message.content
    }))
    for (let step = 0; step < 8; step++) {
      const bodyPayload: Record<string, any> = {
        model: options.model || this.defaultModel,
        input,
        max_output_tokens: options.max_tokens || 4096,
        stream: true,
        store: false
      }
      if (responseTools.length) bodyPayload.tools = responseTools

      const response = await fetch('https://api.openai.com/v1/responses', {
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
        throw new Error(`OpenAI Responses API Error (${response.status}): ${errorText}`)
      }

      let completedResponse: any = null
      for await (const event of this.parseSSE(response)) {
        if (event.type === 'response.output_text.delta' && event.delta) yield event.delta
        if (event.type === 'response.completed') completedResponse = event.response
        if (event.type === 'response.failed') {
          throw new Error(event.response?.error?.message || 'OpenAI response failed')
        }
        if (event.type === 'error') throw new Error(event.message || 'OpenAI response stream failed')
      }
      if (!completedResponse) throw new Error('OpenAI stream ended before a completed response was received')

      const calls = (completedResponse.output || []).filter((item: any) => item.type === 'function_call')
      if (!calls.length) return

      const toolOutputs: any[] = []
      for (const call of calls) {
        let args: Record<string, any> = {}
        try {
          args = call.arguments ? JSON.parse(call.arguments) : {}
        } catch {
          args = {}
        }
        onToolActivity?.(call.name, args, null)
        let result: any = { success: false, error: `Unknown tool: ${call.name}` }
        if (sdkTools[call.name]?.execute) {
          try {
            result = await sdkTools[call.name].execute(args)
          } catch (error: any) {
            result = { success: false, error: error?.message || String(error) }
          }
        }
        onToolActivity?.(call.name, args, result)
        toolOutputs.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: serializeOpenAIToolResult(result)
        })
      }
      input = [...input, ...(completedResponse.output || []), ...toolOutputs]
    }
  }
}
