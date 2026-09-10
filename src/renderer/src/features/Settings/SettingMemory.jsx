import React, { useState, useEffect, useRef } from 'react'
import { User, Heart, Brain, Trash2, Plus, Sparkles, RefreshCw, Check, Edit2, X } from 'lucide-react'
import { luminaMemory } from '../../core/ai/memory'
import { useToast } from '../../core/hooks/useToast'

export const SettingMemory = () => {
  const [memory, setMemory] = useState({
    user: { name: '', role: '', bio: '' },
    preferences: [],
    facts: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [newPref, setNewPref] = useState('')
  const [newFact, setNewFact] = useState('')
  const [saveStatus, setSaveStatus] = useState(null)
  const [editingPrefIndex, setEditingPrefIndex] = useState(null)
  const [editingPrefValue, setEditingPrefValue] = useState('')
  const [editingFactIndex, setEditingFactIndex] = useState(null)
  const [editingFactValue, setEditingFactValue] = useState('')
  const saveTimeoutRef = useRef(null)
  const isInitialLoad = useRef(true)
  const { showToast } = useToast()

  const loadData = async () => {
    setIsLoading(true)
    try {
      const data = await luminaMemory.loadMemory()
      setMemory({
        user: {
          name: data?.user?.name || '',
          role: data?.user?.role || '',
          bio: data?.user?.bio || ''
        },
        preferences: Array.isArray(data?.preferences) ? data.preferences : [],
        facts: Array.isArray(data?.facts) ? data.facts : []
      })
    } catch (err) {
      console.error('[SettingMemory] Load failed:', err)
    } finally {
      setIsLoading(false)
      setTimeout(() => {
        isInitialLoad.current = false
      }, 100)
    }
  }

  useEffect(() => {
    loadData()
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const persistUserProfile = async (userObj) => {
    try {
      setSaveStatus('saving')
      const cleanName = (userObj.name || '').trim()
      const cleanRole = (userObj.role || '').trim()
      const cleanBio = (userObj.bio || '').trim()

      const mem = await luminaMemory.getMemory()
      mem.user = {
        name: cleanName || null,
        role: cleanRole || null,
        bio: cleanBio || null
      }
      await luminaMemory.persist()
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 1800)
    } catch (err) {
      setSaveStatus('error')
      showToast('Failed to auto-save profile')
    }
  }

  const handleUserChange = (field, value) => {
    const updatedUser = { ...memory.user, [field]: value }
    setMemory((prev) => ({
      ...prev,
      user: updatedUser
    }))

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      persistUserProfile(updatedUser)
    }, 400)
  }

  const handleAddPreference = async (e) => {
    e.preventDefault()
    const clean = (newPref || '').trim()
    if (!clean) {
      showToast('Preference cannot be empty')
      return
    }

    if (memory.preferences.some((p) => p.toLowerCase() === clean.toLowerCase())) {
      showToast('Preference already exists')
      return
    }

    await luminaMemory.saveFact({ fact: clean, category: 'preferences' })
    setNewPref('')
    await loadData()
    showToast('Preference saved')
  }

  const handleRemovePreference = async (prefText) => {
    if (!prefText) return
    await luminaMemory.forgetFact({ target: prefText, category: 'preferences' })
    await loadData()
    showToast('Preference removed')
  }

  const handleAddFact = async (e) => {
    e.preventDefault()
    const clean = (newFact || '').trim()
    if (!clean) {
      showToast('Fact cannot be empty')
      return
    }

    const exists = memory.facts.some((f) => {
      const t = typeof f === 'string' ? f : f?.text || ''
      return t.toLowerCase() === clean.toLowerCase()
    })
    if (exists) {
      showToast('Fact already exists')
      return
    }

    await luminaMemory.saveFact({ fact: clean, category: 'facts' })
    setNewFact('')
    await loadData()
    showToast('Learned fact saved')
  }

  const handleRemoveFact = async (factItem) => {
    const text = typeof factItem === 'string' ? factItem : factItem?.text
    if (!text) return
    await luminaMemory.forgetFact({ target: text, category: 'facts' })
    await loadData()
    showToast('Memory item removed')
  }

  const handleCancelEditPref = () => {
    setEditingPrefIndex(null)
    setEditingPrefValue('')
  }

  const handleSaveEditPref = async (idx, oldVal) => {
    const clean = (editingPrefValue || '').trim()
    if (!clean) {
      showToast('Preference cannot be empty')
      return
    }
    if (clean.toLowerCase() !== oldVal.toLowerCase() && memory.preferences.some((p) => p.toLowerCase() === clean.toLowerCase())) {
      showToast('Preference already exists')
      return
    }

    await luminaMemory.updateFact({ oldFact: oldVal, newFact: clean, category: 'preferences' })
    setEditingPrefIndex(null)
    setEditingPrefValue('')
    await loadData()
    showToast('Preference updated')
  }

  const handleStartEditFact = (idx, currentVal) => {
    setEditingFactIndex(idx)
    setEditingFactValue(currentVal)
  }

  const handleCancelEditFact = () => {
    setEditingFactIndex(null)
    setEditingFactValue('')
  }

  const handleSaveEditFact = async (idx, oldVal) => {
    const clean = (editingFactValue || '').trim()
    if (!clean) {
      showToast('Fact cannot be empty')
      return
    }
    const exists = memory.facts.some((f, fIdx) => {
      if (fIdx === idx) return false
      const t = typeof f === 'string' ? f : f?.text || ''
      return t.toLowerCase() === clean.toLowerCase()
    })
    if (exists) {
      showToast('Fact already exists')
      return
    }

    await luminaMemory.updateFact({ oldFact: oldVal, newFact: clean, category: 'facts' })
    setEditingFactIndex(null)
    setEditingFactValue('')
    await loadData()
    showToast('Fact updated')
  }

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all learned memory? This will reset memory.json.')) {
      await luminaMemory.clearAllMemory()
      await loadData()
      showToast('Memory reset')
    }
  }

  return (
    <div className="settings-pane">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main, #f8fafc)', margin: 0 }}>
            AI Memory Profile
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginTop: '4px', marginBottom: 0 }}>
            Manage persistent knowledge, preferences, and details Lumina remembers about you in <code>memory.json</code>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={loadData}
            title="Refresh memory"
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '28px', padding: '0 10px', fontSize: '11px' }}
          >
            <RefreshCw size={12} className={isLoading ? 'pulse-opacity' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleClearAll}
            title="Reset memory.json"
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '28px', padding: '0 10px', fontSize: '11px', color: '#ef4444' }}
          >
            <Trash2 size={12} />
            <span>Reset All</span>
          </button>
        </div>
      </div>

      {/* User Identity Section */}
      <section style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <User size={14} style={{ color: 'var(--text-accent, #a78bfa)' }} />
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            User Identity
          </h3>
        </div>

        <div className="settings-block" style={{ padding: '18px', background: 'var(--bg-primary, rgba(255, 255, 255, 0.02))', borderRadius: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* User Name - Input */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div className="row-info" style={{ flex: 1, minWidth: '180px' }}>
                <div className="row-label">Your Name</div>
                <div className="row-hint">How Lumina addresses you in conversation.</div>
              </div>
              <input
                type="text"
                className="settings-select"
                style={{ width: '260px', textAlign: 'left', padding: '7px 12px', fontSize: '12px' }}
                placeholder="e.g. Saboor"
                value={memory.user.name}
                onChange={(e) => handleUserChange('name', e.target.value)}
              />
            </div>

            {/* Role / Occupation - Textarea */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
              <div className="row-info">
                <div className="row-label">Role / Occupation</div>
                <div className="row-hint">Helps tailor explanations, complexity, and recommendations to your profession or academic field.</div>
              </div>
              <textarea
                className="settings-select"
                rows={2}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  resize: 'none',
                  fontFamily: 'inherit',
                  borderRadius: '5px'
                }}
                placeholder="e.g. Software Engineer building AI tools, Master in Management student"
                value={memory.user.role}
                onChange={(e) => handleUserChange('role', e.target.value)}
              />
            </div>

            {/* Bio / Context - Textarea */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
              <div className="row-info">
                <div className="row-label">Bio / Context</div>
                <div className="row-hint">Broad interests, current focus, research goals, or personal context Lumina should keep in mind.</div>
              </div>
              <textarea
                className="settings-select"
                rows={2}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  resize: 'none',
                  fontFamily: 'inherit',
                  borderRadius: '5px'
                }}
                placeholder="e.g. Working on a Master's thesis on character education in Indonesia, building offline RAG pipelines with JavaScript and SQLite."
                value={memory.user.bio}
                onChange={(e) => handleUserChange('bio', e.target.value)}
              />
            </div>

            {/* Auto-save status feedback */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '18px', fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
              {saveStatus === 'saving' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}>
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#22c55e' }}>
                  <Check size={12} />
                  Saved automatically
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Preferences Section */}
      <section style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <Heart size={14} style={{ color: '#ec4899' }} />
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            User Preferences ({memory.preferences.length})
          </h3>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', marginTop: '0', marginBottom: '12px', lineHeight: '1.4' }}>
          Your preferred styles or instructions for AI answers (e.g. "always explain simply", "favor TypeScript over JavaScript", "use Indonesian for explanations").
        </p>

        <div className="settings-block" style={{ padding: '16px', background: 'var(--bg-primary, rgba(255, 255, 255, 0.02))', borderRadius: '6px' }}>
          <form onSubmit={handleAddPreference} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input
              type="text"
              className="settings-select"
              style={{ flex: 1, textAlign: 'left', padding: '6px 10px' }}
              placeholder="Add a preference (e.g. 'Prefers concise responses with code examples')"
              value={newPref}
              onChange={(e) => setNewPref(e.target.value)}
            />
            <button
              type="submit"
              disabled={!newPref.trim()}
              className="btn btn-primary"
              style={{ height: '30px', padding: '0 12px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={12} />
              <span>Add</span>
            </button>
          </form>

          {memory.preferences.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic', padding: '8px 0' }}>
              No custom preferences recorded yet. Tell Lumina "I prefer short answers" in chat or add one above.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {memory.preferences.map((pref, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '5px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '12px',
                    color: 'var(--text-main, #f8fafc)',
                    gap: '8px'
                  }}
                >
                  {editingPrefIndex === idx ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                      <input
                        type="text"
                        autoFocus
                        className="settings-select"
                        style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: '12px' }}
                        value={editingPrefValue}
                        onChange={(e) => setEditingPrefValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEditPref(idx, pref)
                          if (e.key === 'Escape') handleCancelEditPref()
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEditPref(idx, pref)}
                        title="Save changes"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#22c55e',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          flexShrink: 0
                        }}
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditPref}
                        title="Cancel"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted, #94a3b8)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          flexShrink: 0
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: '1.45', flex: 1, marginRight: '12px' }}>
                        {pref}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleStartEditPref(idx, pref)}
                          title="Edit preference"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted, #94a3b8)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-accent, #a78bfa)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #94a3b8)')}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePreference(pref)}
                          title="Remove preference"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted, #94a3b8)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #94a3b8)')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Learned Facts Section */}
      <section style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <Brain size={14} style={{ color: 'var(--text-accent, #a78bfa)' }} />
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Learned Facts & Knowledge ({memory.facts.length})
          </h3>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', marginTop: '0', marginBottom: '12px', lineHeight: '1.4' }}>
          Key facts Lumina automatically learns from your conversations or notes (e.g. your active projects, technologies, or subjects) so you don't have to repeat them.
        </p>

        <div className="settings-block" style={{ padding: '16px', background: 'var(--bg-primary, rgba(255, 255, 255, 0.02))', borderRadius: '6px' }}>
          <form onSubmit={handleAddFact} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input
              type="text"
              className="settings-select"
              style={{ flex: 1, textAlign: 'left', padding: '6px 10px' }}
              placeholder="Add a fact (e.g. 'Working on Indonesian thesis on character education')"
              value={newFact}
              onChange={(e) => setNewFact(e.target.value)}
            />
            <button
              type="submit"
              disabled={!newFact.trim()}
              className="btn btn-primary"
              style={{ height: '30px', padding: '0 12px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={12} />
              <span>Add</span>
            </button>
          </form>

          {memory.facts.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic', padding: '8px 0' }}>
              No learned facts recorded yet. Lumina saves facts automatically when you ask it to "remember that..." in chat, or you can add them manually above.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {memory.facts.map((factItem, idx) => {
                const text = typeof factItem === 'string' ? factItem : factItem.text
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '5px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      fontSize: '12px',
                      color: 'var(--text-main, #f8fafc)',
                      gap: '8px'
                    }}
                  >
                    {editingFactIndex === idx ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                        <input
                          type="text"
                          autoFocus
                          className="settings-select"
                          style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: '12px' }}
                          value={editingFactValue}
                          onChange={(e) => setEditingFactValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEditFact(idx, text)
                            if (e.key === 'Escape') handleCancelEditFact()
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditFact(idx, text)}
                          title="Save changes"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#22c55e',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditFact}
                          title="Cancel"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted, #94a3b8)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0
                          }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: '1.45', flex: 1, marginRight: '12px' }}>
                          {text}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleStartEditFact(idx, text)}
                            title="Edit fact"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted, #94a3b8)',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-accent, #a78bfa)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #94a3b8)')}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFact(factItem)}
                            title="Remove fact"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted, #94a3b8)',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #94a3b8)')}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default React.memo(SettingMemory)
