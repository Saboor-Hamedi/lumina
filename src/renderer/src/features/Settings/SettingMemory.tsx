import React from 'react'
import { User, Heart, Brain, Trash2, Plus, RefreshCw, Check, Edit2, X } from 'lucide-react'
import { useMemorySettings } from './hook/useMemorySettings'
import type { FactItem } from './types'

/**
 * SettingMemory Component
 * User profile identity settings, persistent facts and conversational preferences
 * stored in Lumina's local cognitive memory graph.
 */
export const SettingMemory: React.FC = () => {
  const {
    memory,
    isLoading,
    newPref,
    setNewPref,
    newFact,
    setNewFact,
    saveStatus,
    editingPrefIndex,
    editingPrefValue,
    setEditingPrefValue,
    editingFactIndex,
    editingFactValue,
    setEditingFactValue,
    loadData,
    handleUserChange,
    handleAddPreference,
    handleRemovePreference,
    handleStartEditPref,
    handleCancelEditPref,
    handleSaveEditPref,
    handleAddFact,
    handleRemoveFact,
    handleStartEditFact,
    handleCancelEditFact,
    handleSaveEditFact,
    handleClearAll
  } = useMemorySettings()

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <div className="settings-pane-header-info">
          <h2 className="settings-pane-title">AI Memory Profile</h2>
          <p className="settings-pane-subtitle">
            Persistent context, preferences, and identity.
          </p>
        </div>
        <div className="settings-pane-actions">
          <button
            type="button"
            onClick={loadData}
            title="Refresh memory"
            className="btn btn-secondary"
          >
            <RefreshCw size={12} className={isLoading ? 'pulse-opacity' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            title="Reset memory.json"
            className="btn btn-secondary btn-danger"
          >
            <Trash2 size={12} />
            <span>Reset All</span>
          </button>
        </div>
      </div>

      {/* User Identity Section */}
      <section style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <User size={14} style={{ color: 'var(--text-accent, #a78bfa)' }} />
          <h3 style={{ margin: 0, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            User Identity
          </h3>
        </div>

        <div className="settings-block" style={{ padding: '16px', background: 'var(--bg-primary, rgba(255, 255, 255, 0.02))', borderRadius: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* User Name */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div className="row-info" style={{ flex: 1, minWidth: '160px' }}>
                <div className="row-label">Your Name</div>
                <div className="row-hint">Display name used in conversation.</div>
              </div>
              <input
                type="text"
                className="settings-select"
                style={{ width: '240px', textAlign: 'left', padding: '6px 10px', fontSize: '12px' }}
                placeholder="e.g. Saboor"
                value={memory.user.name}
                onChange={(e) => handleUserChange('name', e.target.value)}
              />
            </div>

            {/* Role / Occupation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
              <div className="row-info">
                <div className="row-label">Role / Occupation</div>
                <div className="row-hint">Tailors explanations and complexity to your background.</div>
              </div>
              <textarea
                className="settings-select"
                rows={2}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 10px',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  resize: 'none',
                  fontFamily: 'inherit',
                  borderRadius: '5px'
                }}
                placeholder="e.g. Software Engineer building AI tools"
                value={memory.user.role}
                onChange={(e) => handleUserChange('role', e.target.value)}
              />
            </div>

            {/* Bio / Context */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
              <div className="row-info">
                <div className="row-label">Bio / Context</div>
                <div className="row-hint">Key background details, current projects, or focus areas.</div>
              </div>
              <textarea
                className="settings-select"
                rows={2}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 10px',
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
        <p style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', marginTop: '0', marginBottom: '10px' }}>
          Custom instructions, tone, and answer formatting.
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
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic', padding: '6px 0' }}>
              No preferences recorded yet.
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
        <p style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', marginTop: '0', marginBottom: '10px' }}>
          Context, constraints, and project background.
        </p>

        <div className="settings-block" style={{ padding: '16px', background: 'var(--bg-primary, rgba(255, 255, 255, 0.02))', borderRadius: '6px' }}>
          <form onSubmit={handleAddFact} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input
              type="text"
              className="settings-select"
              style={{ flex: 1, textAlign: 'left', padding: '6px 10px' }}
              placeholder="Add a fact (e.g. 'Working on thesis on character education')"
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
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic', padding: '6px 0' }}>
              No learned facts recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {memory.facts.map((factItem, idx) => {
                const text = typeof factItem === 'string' ? factItem : (factItem as FactItem).text
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
