import React from 'react'
import { useSettingsStore } from '../../core/store/SettingStore'
import Toggle from '../../components/toggle'

/**
 * SettingMeta Component
 * Streamlined, minimalist settings for configuring the editor Meta menu.
 */
export const SettingMeta: React.FC = () => {
  const settings = useSettingsStore((s) => s.settings)
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  const isEnabled = settings.inlineMetadata !== false

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <div className="settings-pane-header-info">
          <h2 className="settings-pane-title">Meta Menu</h2>
          <p className="settings-pane-subtitle">
            Configure the compact note action menu (Ask AI, Voice, Drive Push, Local Graph, and Learned).
          </p>
        </div>
      </div>

      <div className="settings-section">
        <section>
          <h3>General</h3>
          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Enable Note Menu</div>
              <div className="row-hint">Show the compact quick action menu at the top-right of each note.</div>
            </div>
            <Toggle
              checked={isEnabled}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('inlineMetadata', e.target.checked)}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

export default React.memo(SettingMeta)
