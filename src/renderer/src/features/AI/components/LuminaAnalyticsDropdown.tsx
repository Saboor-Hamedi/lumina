import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  Cpu,
  Clock,
  RotateCcw,
  Download,
  Check,
  DollarSign,
  Activity,
  X
} from 'lucide-react'
import { useAIStore } from '../tools/lumina'
import { useSettingsStore } from '../../../core/store/SettingStore'
import ToolTip from '../../../components/atoms/ToolTip'

function formatTime(ms: number = 0): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  const seconds = (ms / 1000).toFixed(1)
  return `${seconds}s`
}

function formatCost(usd: number = 0): string {
  if (usd === 0) return '$0.0000'
  if (usd < 0.0001) return '< $0.0001'
  return `$${usd.toFixed(4)}`
}

export interface LuminaAnalyticsDropdownProps {
  onClose: () => void
}

export const LuminaAnalyticsDropdown: React.FC<LuminaAnalyticsDropdownProps> = ({ onClose }) => {
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const { aiUsageStats, resetAIUsage } = useAIStore()
  const settings = useSettingsStore((s: any) => s.settings) || {}

  const [confirmReset, setConfirmReset] = useState<boolean>(false)
  const [copiedReport, setCopiedReport] = useState<boolean>(false)

  const stats = aiUsageStats || {
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTimeMs: 0,
    totalCostUSD: 0,
    totalPrompts: 0
  }

  const activeProvider = settings.activeAIProvider || 'DeepSeek'
  const activeModel = settings.activeAIModel || 'deepseek-chat'

  const promptPct = useMemo(() => {
    if (!stats.totalTokens) return 50
    return Math.round((stats.promptTokens / stats.totalTokens) * 100)
  }, [stats])

  const completionPct = 100 - promptPct

  const avgLatency = useMemo(() => {
    if (!stats.totalPrompts || !stats.totalTimeMs) return '0.0s'
    return formatTime(stats.totalTimeMs / stats.totalPrompts)
  }, [stats])

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handleOutsideClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 3000)
      return
    }
    resetAIUsage()
    setConfirmReset(false)
  }

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation()
    const report = {
      app: 'Lumina AI Telemetry',
      timestamp: new Date().toISOString(),
      provider: activeProvider,
      model: activeModel,
      metrics: {
        totalTokens: stats.totalTokens,
        promptTokens: stats.promptTokens,
        completionTokens: stats.completionTokens,
        totalPrompts: stats.totalPrompts,
        totalCostUSD: stats.totalCostUSD,
        avgLatency
      }
    }
    navigator.clipboard.writeText(JSON.stringify(report, null, 2))
    setCopiedReport(true)
    setTimeout(() => setCopiedReport(false), 2000)
  }

  return (
    <div
      ref={dropdownRef}
      className="lumina-analytics-dropdown"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="analytics-dropdown-header">
        <div className="analytics-header-left">
          <Activity size={13} style={{ color: 'var(--text-accent, #38bdf8)' }} />
          <span className="analytics-header-title">AI Telemetry</span>
          <span className="analytics-model-pill" title={`${activeProvider} / ${activeModel}`}>
            {activeModel}
          </span>
        </div>
        <button
          type="button"
          className="analytics-close-btn"
          onClick={onClose}
          aria-label="Close Analytics"
        >
          <X size={12} />
        </button>
      </div>

      <div className="analytics-metrics-grid">
        <div className="analytics-metric-card">
          <span className="analytics-metric-label">Total Tokens</span>
          <span className="analytics-metric-value">{stats.totalTokens.toLocaleString()}</span>
        </div>

        <div className="analytics-metric-card">
          <span className="analytics-metric-label">Avg Latency</span>
          <span className="analytics-metric-value">{avgLatency}</span>
        </div>

        <div className="analytics-metric-card">
          <span className="analytics-metric-label">Est. Cost</span>
          <span className="analytics-metric-value">{formatCost(stats.totalCostUSD)}</span>
        </div>

        <div className="analytics-metric-card">
          <span className="analytics-metric-label">Prompts</span>
          <span className="analytics-metric-value">{stats.totalPrompts}</span>
        </div>
      </div>

      {stats.totalTokens > 0 && (
        <div className="analytics-bar-section">
          <div className="analytics-bar-labels">
            <span>Prompt: {promptPct}%</span>
            <span>Completion: {completionPct}%</span>
          </div>
          <div className="analytics-progress-bar">
            <div className="analytics-progress-prompt" style={{ width: `${promptPct}%` }} />
            <div className="analytics-progress-completion" style={{ width: `${completionPct}%` }} />
          </div>
        </div>
      )}

      <div className="analytics-dropdown-footer">
        <button
          type="button"
          className="analytics-action-btn"
          onClick={handleExport}
          title="Copy Telemetry JSON"
        >
          {copiedReport ? <Check size={11} color="#22c55e" /> : <Download size={11} />}
          <span>{copiedReport ? 'Copied' : 'Export JSON'}</span>
        </button>

        <button
          type="button"
          className={`analytics-action-btn ${confirmReset ? 'confirm-reset' : ''}`}
          onClick={handleReset}
          title="Reset usage counter"
        >
          <RotateCcw size={11} />
          <span>{confirmReset ? 'Confirm?' : 'Reset'}</span>
        </button>
      </div>
    </div>
  )
}

export default LuminaAnalyticsDropdown
