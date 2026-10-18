import { describe, it, expect, vi } from 'vitest'
import {
  cleanRawToolLeaks,
  parseAndExecuteDSML
} from '../../../../../../src/renderer/src/features/AI/services/streaming/toolCallInterceptor'

describe('toolCallInterceptor', () => {
  it('strips leaked checkFile/updateFile pseudo-markup from visible text', () => {
    const leaked =
      '<checkFile"> {"title": "01 action words"}</checkFile>\n\n' +
      '<updateFile"> {"title": "01 action words", "content": "# Action Words"}</updateFile>\n\n' +
      'Now I have the real picture.'

    const cleaned = cleanRawToolLeaks(leaked)

    expect(cleaned).not.toContain('checkFile')
    expect(cleaned).not.toContain('updateFile')
    expect(cleaned).not.toContain('01 action words')
    expect(cleaned).toBe('Now I have the real picture.')
  })

  it('strips well-formed file tool tags and their bodies', () => {
    const leaked =
      'Before <createFile title="New Note">body content</createFile> after'
    const cleaned = cleanRawToolLeaks(leaked)
    expect(cleaned).not.toContain('createFile')
    expect(cleaned).not.toContain('body content')
    expect(cleaned).toContain('Before')
    expect(cleaned).toContain('after')
  })

  it('executes a leaked checkFile invocation and cleans the markup', async () => {
    const checkFile = { execute: vi.fn().mockResolvedValue({ success: true, summary: 'Analyzed' }) }
    const sdkTools = { checkFile }

    const text =
      'Let me look at that.\n<checkFile"> {"title": "01 action words"}</checkFile>'
    const result = await parseAndExecuteDSML(text, sdkTools, [])

    expect(checkFile.execute).toHaveBeenCalledTimes(1)
    expect(checkFile.execute).toHaveBeenCalledWith({ title: '01 action words' })
    expect(result.didExecute).toBe(true)
    expect(result.cleanedText).not.toContain('checkFile')
    expect(result.cleanedText).not.toContain('01 action words')
  })
})
