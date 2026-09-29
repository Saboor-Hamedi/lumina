import { describe, it, expect } from 'vitest'
import {
  buildSystemPrompt,
  sanitizeSafeSettings
} from '../../../../../../src/renderer/src/features/AI/services/aiPromptBuilder'
import { getAIMode } from '../../../../../../src/renderer/src/features/AI/modes/index'
import { getTheme } from '../../../../../../src/renderer/src/features/theme/hooks/themeDefinitions'

describe('AI Theme Awareness & Visual Theme Disambiguation', () => {
  it('embeds active visual theme into the prompt and directs AI not to confuse it with reasoning mode', async () => {
    const modeCfg = getAIMode('Deep')
    const prompt = await buildSystemPrompt({
      modeCfg,
      activeTheme: 'Porcelain'
    })

    // Confirms visual theme is explicitly named
    expect(prompt).toContain('Porcelain')
    expect(prompt).toContain('The user\'s current visual UI theme of the Lumina app is "Porcelain"')

    // Confirms disambiguation directive between visual theme and operational mode
    expect(prompt).toContain('NEVER confuse their visual theme ("Porcelain") with your AI reasoning mode (Deep Mode)')
  })

  it('works seamlessly in Plan mode and other non-execution modes', async () => {
    const modeCfg = getAIMode('Plan')
    const prompt = await buildSystemPrompt({
      modeCfg,
      activeTheme: 'Dracula'
    })

    expect(prompt).toContain('Dracula')
    expect(prompt).toContain('The user\'s current visual UI theme of the Lumina app is "Dracula"')
    expect(prompt).toContain('NEVER confuse their visual theme ("Dracula") with your AI reasoning mode (Plan Mode)')
  })

  it('resolves theme friendly names dynamically via getTheme()', () => {
    expect(getTheme('porcelain')?.name).toBe('Porcelain')
    expect(getTheme('solarized_dark')?.name).toBe('Solarized Dark')
    expect(getTheme('catppuccin')?.name).toBe('Catppuccin Mocha')
    expect(getTheme('nord')?.name).toBe('Nord Frost')
    expect(getTheme('rose_pine')?.name).toBe('Rosé Pine')
  })

  it('embeds typography and editor settings (font family, font size, line height)', async () => {
    const modeCfg = getAIMode('Code')
    const prompt = await buildSystemPrompt({
      modeCfg,
      activeTheme: 'Porcelain',
      userSettings: {
        fontFamily: 'Fira Code',
        fontSize: 18,
        lineHeight: 1.8,
        showLineNumbers: true,
        autoSave: true,
        cursorStyle: 'block',
        smoothScrolling: true
      }
    })

    expect(prompt).toContain('Font Family: "Fira Code"')
    expect(prompt).toContain('Font Size: 18px')
    expect(prompt).toContain('Line Height: 1.8')
    expect(prompt).toContain('Line Numbers: Enabled')
    expect(prompt).toContain('Cursor Style: block')
    expect(prompt).toContain('what is my font?')
  })

  it('strictly scrubs and sanitizes all API keys, tokens, and encrypted hashes', () => {
    const rawSettings = {
      theme: 'Porcelain',
      fontFamily: 'JetBrains Mono',
      fontSize: 15,
      deepSeekKey: 'sk-secret-key-12345',
      openaiKey: 'sk-proj-abcde98765',
      anthropicKey: 'sk-ant-api03-xyz',
      groqKey: 'gsk_test123456',
      huggingFaceKey: 'hf_token_secret',
      encryptedApiKeyHash: 'enc:k7X8s9Lq01MzPq...',
      googleUser: { email: 'secret@gmail.com' },
      authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    }

    const sanitized = sanitizeSafeSettings(rawSettings)

    // Allowed editor & UI settings
    expect(sanitized.theme).toBe('Porcelain')
    expect(sanitized.fontFamily).toBe('JetBrains Mono')
    expect(sanitized.fontSize).toBe(15)

    // Strictly blocked keys and secrets
    expect(sanitized.deepSeekKey).toBeUndefined()
    expect(sanitized.openaiKey).toBeUndefined()
    expect(sanitized.anthropicKey).toBeUndefined()
    expect(sanitized.groqKey).toBeUndefined()
    expect(sanitized.huggingFaceKey).toBeUndefined()
    expect(sanitized.encryptedApiKeyHash).toBeUndefined()
    expect(sanitized.googleUser).toBeUndefined()
    expect(sanitized.authToken).toBeUndefined()
  })

  it('enforces strict anti-leak security directive in prompt even if raw settings contain secrets', async () => {
    const modeCfg = getAIMode('Code')
    const prompt = await buildSystemPrompt({
      modeCfg,
      activeTheme: 'Porcelain',
      userSettings: {
        fontFamily: 'Inter',
        fontSize: 16,
        deepSeekKey: 'sk-should-never-appear',
        hashedToken: 'enc:c29tZV9lbmNyeXB0ZWRfaGFzaA=='
      } as any
    })

    // Secrets must NOT be in the generated system prompt
    expect(prompt).not.toContain('sk-should-never-appear')
    expect(prompt).not.toContain('enc:c29tZV9lbmNyeXB0ZWRfaGFzaA==')

    // Must contain uncompromised anti-leak security instructions
    expect(prompt).toContain('STRICT SECURITY DIRECTIVE (CONFIDENTIALITY & ANTI-LEAK)')
    expect(prompt).toContain('NEVER reveal, disclose, repeat, or discuss any API keys, tokens, secret credentials, or hashed/encrypted strings')
  })
})
