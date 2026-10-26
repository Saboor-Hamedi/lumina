import React from 'react'
import { PanelBottom, PanelTop, AlignJustify } from 'lucide-react'
import { useSettingsStore } from '../../core/store/SettingStore'
import Toggle from '../../components/toggle'

/**
 * SettingMeta Component
 * Streamlined, minimalist settings for configuring the editor Meta action bar.
 */
export const SettingMeta: React.FC = () => {
  const settings = useSettingsStore((s) => s.settings)
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  const isEnabled = settings.inlineMetadata !== false
  const position = settings.metaPosition || 'bottom'

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <div className="settings-pane-header-info">
          <h2 className="settings-pane-title">Meta Bar</h2>
          <p className="settings-pane-subtitle">
            Configure the editor quick action bar (Ask AI, Voice, Drive Push, Local Graph, and Learned).
          </p>
        </div>
      </div>

      <div className="settings-section">
        <section>
          <h3>General</h3>
          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Enable Meta Bar</div>
              <div className="row-hint">Display quick action buttons in the note editor.</div>
            </div>
            <Toggle
              checked={isEnabled}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('inlineMetadata', e.target.checked)}
            />
          </div>

          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Position</div>
              <div className="row-hint">Choose where the compact action bar is displayed.</div>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'var(--bg-card)',
                padding: '3px',
                borderRadius: '6px',
                border: '1px solid var(--border-dim)'
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  height: '26px',
                  padding: '0 9px',
                  fontSize: '11px',
                  borderRadius: '4px',
                  border: position === 'bottom' ? '1px solid var(--text-accent)' : '1px solid transparent',
                  background: position === 'bottom' ? 'rgba(var(--text-accent-rgb, 64, 186, 250), 0.15)' : 'transparent',
                  color: position === 'bottom' ? 'var(--text-accent)' : 'var(--text-muted)'
                }}
                onClick={() => updateSetting('metaPosition', 'bottom')}
              >
                <PanelBottom size={12} />
                <span>Float Bottom</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  height: '26px',
                  padding: '0 9px',
                  fontSize: '11px',
                  borderRadius: '4px',
                  border: position === 'top' ? '1px solid var(--text-accent)' : '1px solid transparent',
                  background: position === 'top' ? 'rgba(var(--text-accent-rgb, 64, 186, 250), 0.15)' : 'transparent',
                  color: position === 'top' ? 'var(--text-accent)' : 'var(--text-muted)'
                }}
                onClick={() => updateSetting('metaPosition', 'top')}
              >
                <PanelTop size={12} />
                <span>Float Top</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  height: '26px',
                  padding: '0 9px',
                  fontSize: '11px',
                  borderRadius: '4px',
                  border: position === 'inline' ? '1px solid var(--text-accent)' : '1px solid transparent',
                  background: position === 'inline' ? 'rgba(var(--text-accent-rgb, 64, 186, 250), 0.15)' : 'transparent',
                  color: position === 'inline' ? 'var(--text-accent)' : 'var(--text-muted)'
                }}
                onClick={() => updateSetting('metaPosition', 'inline')}
              >
                <AlignJustify size={12} />
                <span>Inline</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default React.memo(SettingMeta)
