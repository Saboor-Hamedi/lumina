const DEFAULT_MEMORY = {
  user: {
    name: null,
    role: null,
    bio: null
  },
  preferences: [],
  facts: []
}

class LuminaMemory {
  constructor() {
    this.cache = null
  }

  async loadMemory() {
    try {
      if (typeof window !== 'undefined' && window.api?.loadMemory) {
        const loaded = await window.api.loadMemory()
        this.cache = {
          user: { ...DEFAULT_MEMORY.user, ...(loaded?.user || {}) },
          preferences: Array.isArray(loaded?.preferences) ? loaded.preferences : [],
          facts: Array.isArray(loaded?.facts) ? loaded.facts : []
        }
        return this.cache
      }
    } catch (err) {
      console.warn('[LuminaMemory] Failed to load memory:', err)
    }
    if (!this.cache) {
      this.cache = JSON.parse(JSON.stringify(DEFAULT_MEMORY))
    }
    return this.cache
  }

  async getMemory() {
    if (!this.cache) {
      return this.loadMemory()
    }
    return this.cache
  }

  async persist() {
    if (!this.cache) return false
    try {
      if (typeof window !== 'undefined' && window.api?.saveMemory) {
        await window.api.saveMemory(this.cache)
        return true
      }
    } catch (err) {
      console.error('[LuminaMemory] Failed to persist memory:', err)
    }
    return false
  }

  async saveFact({ fact, category = 'facts', key = null }) {
    if (!fact && !key) return { success: false, error: 'No fact or key provided' }
    const mem = await this.getMemory()

    let targetCategory = category
    let targetKey = key
    let cleanFact = (fact || '').trim()

    if (!targetKey && ['name', 'role', 'bio'].includes(category)) {
      targetKey = category
      targetCategory = 'user'
    }

    if (targetKey && ['name', 'role', 'bio'].includes(targetKey)) {
      targetCategory = 'user'
    }

    if (!targetKey && targetCategory !== 'user') {
      const nameMatch = cleanFact.match(/^(?:my\s+name\s+is|call\s+me|name\s*[:=])\s*([a-zA-Z0-9_\-\s]+)/i)
      if (nameMatch) {
        targetCategory = 'user'
        targetKey = 'name'
        cleanFact = nameMatch[1].trim()
      }
    }

    if (targetCategory === 'user') {
      const userKey = targetKey || 'name'
      mem.user[userKey] = cleanFact
      await this.persist()
      return { success: true, summary: `Updated user ${userKey} to "${cleanFact}"` }
    }

    if (!cleanFact) return { success: false, error: 'Empty fact' }

    if (targetCategory === 'preferences') {
      if (!mem.preferences.includes(cleanFact)) {
        mem.preferences.push(cleanFact)
        await this.persist()
      }
      return { success: true, summary: `Saved preference: "${cleanFact}"` }
    }

    const existing = mem.facts.find(
      (f) => (typeof f === 'string' ? f : f.text).toLowerCase() === cleanFact.toLowerCase()
    )
    if (!existing) {
      mem.facts.push({
        text: cleanFact,
        timestamp: Date.now()
      })
      await this.persist()
    }
    return { success: true, summary: `Saved memory: "${cleanFact}"` }
  }

  async updateFact({ oldFact, newFact, category = 'facts', key = null }) {
    const mem = await this.getMemory()

    if (category === 'user' && key) {
      mem.user[key] = newFact
      await this.persist()
      return { success: true, summary: `Updated user ${key} to "${newFact}"` }
    }

    const cleanOld = (oldFact || '').trim().toLowerCase()
    const cleanNew = (newFact || '').trim()
    if (!cleanNew) return { success: false, error: 'No new value provided' }

    if (category === 'preferences' || mem.preferences.some((p) => p.toLowerCase().includes(cleanOld))) {
      const idx = mem.preferences.findIndex((p) => p.toLowerCase().includes(cleanOld))
      if (idx !== -1) {
        mem.preferences[idx] = cleanNew
      } else {
        mem.preferences.push(cleanNew)
      }
      await this.persist()
      return { success: true, summary: `Updated preference to "${cleanNew}"` }
    }

    const factIdx = mem.facts.findIndex(
      (f) => (typeof f === 'string' ? f : f.text).toLowerCase().includes(cleanOld)
    )
    if (factIdx !== -1) {
      mem.facts[factIdx] = {
        text: cleanNew,
        timestamp: Date.now()
      }
    } else {
      mem.facts.push({
        text: cleanNew,
        timestamp: Date.now()
      })
    }
    await this.persist()
    return { success: true, summary: `Updated memory to "${cleanNew}"` }
  }

  async forgetFact({ target, category = null, key = null }) {
    const mem = await this.getMemory()

    const cleanTarget = (target || '').trim().toLowerCase()
    const targetKey = key || (['name', 'my name'].includes(cleanTarget) ? 'name' : ['role', 'my role'].includes(cleanTarget) ? 'role' : ['bio', 'my bio'].includes(cleanTarget) ? 'bio' : null)

    if (targetKey && mem.user[targetKey] !== undefined) {
      const oldVal = mem.user[targetKey]
      mem.user[targetKey] = null
      await this.persist()
      return { success: true, summary: `Cleared user ${targetKey} (was "${oldVal}")` }
    }

    if (!cleanTarget) return { success: false, error: 'No target to forget' }

    let removed = false

    const initialPrefLen = mem.preferences.length
    mem.preferences = mem.preferences.filter((p) => !p.toLowerCase().includes(cleanTarget))
    if (mem.preferences.length < initialPrefLen) removed = true

    const initialFactsLen = mem.facts.length
    mem.facts = mem.facts.filter(
      (f) => !(typeof f === 'string' ? f : f.text).toLowerCase().includes(cleanTarget)
    )
    if (mem.facts.length < initialFactsLen) removed = true

    if (removed) {
      await this.persist()
      return { success: true, summary: `Removed "${target}" from memory` }
    }

    return { success: false, error: `No matching memory found for "${target}"` }
  }

  getPromptBlock() {
    if (!this.cache) return ''
    const lines = []
    const user = this.cache.user || {}
    if (user.name) lines.push(`- User Name: ${user.name}`)
    if (user.role) lines.push(`- Role: ${user.role}`)
    if (user.bio) lines.push(`- Bio: ${user.bio}`)

    if (this.cache.preferences && this.cache.preferences.length > 0) {
      lines.push('- User Preferences:')
      this.cache.preferences.forEach((p) => lines.push(`  * ${p}`))
    }

    if (this.cache.facts && this.cache.facts.length > 0) {
      lines.push('- Learned Facts & Context:')
      this.cache.facts.forEach((f) => {
        const text = typeof f === 'string' ? f : f.text
        if (text) lines.push(`  * ${text}`)
      })
    }

    if (lines.length === 0) {
      return `**PERSISTENT MEMORY (memory.json)**:
- No personal user details or facts recorded yet.
- When the user introduces themselves, shares preferences, or asks you to remember something, call 'saveMemory' to remember it silently.
- When the user asks to forget or remove something, call 'forgetMemory'.`
    }

    const nameInstruction = user.name
      ? `- Address the user naturally by their name ("${user.name}") occasionally during conversation (e.g., when greeting, opening a thoughtful response, or wrapping up a recommendation). Do not repeat their name in every single sentence, but weave it naturally into conversation as a warm, personalized touch.`
      : `- If the user introduces themselves or gives their name, save it to memory immediately.`

    return `**PERSISTENT MEMORY (memory.json)**:
${lines.join('\n')}
- Instruction: Use these persistent facts and preferences naturally.
${nameInstruction}
- When saving or updating memory, give ONLY a short 1-sentence confirmation (or continue assisting). NEVER output a table or list of memory items unless the user explicitly asks "what do you remember?" or "what is in your memory?".`
  }
}

export const luminaMemory = new LuminaMemory()
export default luminaMemory
