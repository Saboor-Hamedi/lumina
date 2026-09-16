import React, { useState, useMemo } from 'react'
import {
  BarChart3,
  Cpu,
  DollarSign,
  Clock,
  RotateCcw,
  Download,
  Check,
  Sparkles,
  BarChart2,
  Activity
} from 'lucide-react'
import { useAIStore } from '../tools/lumina'
import { useSettingsStore } from '../../../core/store/SettingStore'
import ToolTip from '../../../components/atoms/ToolTip'
import '../css/luminaWorkbench.css'

function formatTime(ms = 0) {
  if (ms < 1000) return `${Math.round(ms)}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSec = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSec}s`
  const hours = Math.floor(minutes / 60)
  const remainingMin = minutes % 60
  return `${hours}h ${remainingMin}m`
}

function formatCost(usd = 0) {
  if (usd === 0) return '$0.0000'
  if (usd < 0.0001) return `< $0.0001`
  return `$${usd.toFixed(4)}`
}

export const LuminaWorkbench = ({ onClose = null }) => {
  const { aiUsageStats, resetAIUsage, sessions } = useAIStore()
  const settings = useSettingsStore((s) => s.settings)

  const [confirmReset, setConfirmReset] = useState(false)
  const [copiedReport, setCopiedReport] = useState(false)

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

  const avgLatencySec = useMemo(() => {
    if (!stats.totalPrompts || !stats.totalTimeMs) return '0.0'
    return (stats.totalTimeMs / stats.totalPrompts / 1000).toFixed(1)
  }, [stats])

  const avgTokensPerPrompt = useMemo(() => {
    if (!stats.totalPrompts) return 0
    return Math.round(stats.totalTokens / stats.totalPrompts)
  }, [stats])

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 3000)
      return
    }
    resetAIUsage()
    setConfirmReset(false)
  }

  const handleExport = () => {
    const report = {
      app: 'Lumina AI Workbench',
      timestamp: new Date().toISOString(),
      provider: activeProvider,
      model: activeModel,
      metrics: {
        totalTokensSpent: stats.totalTokens,
        promptTokens: stats.promptTokens,
        completionTokens: stats.completionTokens,
        estimatedCostUSD: stats.totalCostUSD,
        totalTimeMs: stats.totalTimeMs,
        timeFormatted: formatTime(stats.totalTimeMs),
        totalPrompts: stats.totalPrompts,
        avgLatencySec: Number(avgLatencySec),
        avgTokensPerPrompt
      },
      sessionsCount: sessions?.length || 0
    }

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `lumina-ai-usage-${Date.now()}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()

    setCopiedReport(true)
    setTimeout(() => setCopiedReport(false), 2000)
  }

  return (
    <div className="lumina-workbench-container">
      {/* Compact Header */}
      <div className="lumina-workbench-header">
        <div className="workbench-title-area">
          <BarChart3 size={14} className="workbench-icon" />
          <span className="workbench-title">AI Analytics & Usage</span>
          <span className="workbench-provider-tag">
            <Sparkles size={11} />
            <span>{activeProvider}</span>
            <span className="tag-model">({activeModel})</span>
          </span>
        </div>

        <div className="workbench-actions">
          <ToolTip text="Export JSON Report" position="bottom">
            <button className="workbench-btn icon-only" onClick={handleExport} aria-label="Export JSON">
              {copiedReport ? <Check size={13} className="text-accent" /> : <Download size={13} />}
            </button>
          </ToolTip>
        </div>
      </div>

      {/* Primary 3 Compact Metric Cards */}
      <div className="lumina-workbench-cards">
        {/* Card 1: Tokens Spent */}
        <div className="workbench-card">
          <div className="card-top">
            <span className="card-label">Tokens Spent</span>
            <Cpu size={13} className="card-icon tokens" />
          </div>
          <div className="card-value">{stats.totalTokens.toLocaleString()}</div>
          <div className="card-footer">
            <span className="pill input">In {stats.promptTokens.toLocaleString()}</span>
            <span className="pill output">Out {stats.completionTokens.toLocaleString()}</span>
          </div>
        </div>

        {/* Card 2: Cost Spent */}
        <div className="workbench-card">
          <div className="card-top">
            <span className="card-label">Money Spent</span>
            <DollarSign size={13} className="card-icon cost" />
          </div>
          <div className="card-value">{formatCost(stats.totalCostUSD)}</div>
          <div className="card-footer">
            <span className="subtext">Estimated API Cost</span>
          </div>
        </div>

        {/* Card 3: AI Time Used */}
        <div className="workbench-card">
          <div className="card-top">
            <span className="card-label">AI Time Used</span>
            <Clock size={13} className="card-icon time" />
          </div>
          <div className="card-value">{formatTime(stats.totalTimeMs)}</div>
          <div className="card-footer">
            <span className="subtext">{stats.totalPrompts} execution{stats.totalPrompts === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      {/* Distribution & Performance */}
      <div className="lumina-workbench-details">
        {/* Token Distribution */}
        <div className="workbench-panel">
          <div className="panel-title">
            <BarChart2 size={13} />
            <span>Token Ratio</span>
          </div>
          <div className="ratio-bar-container">
            <div className="ratio-bar">
              <div className="ratio-fill input" style={{ width: `${promptPct}%` }} />
              <div className="ratio-fill output" style={{ width: `${completionPct}%` }} />
            </div>
            <div className="ratio-legend">
              <span className="legend-item input">Prompt ({promptPct}%)</span>
              <span className="legend-item output">Completion ({completionPct}%)</span>
            </div>
          </div>
        </div>

        {/* System Performance */}
        <div className="workbench-panel">
          <div className="panel-title">
            <Activity size={13} />
            <span>Efficiency</span>
          </div>
          <div className="efficiency-row">
            <div className="eff-box">
              <span className="eff-val">{avgLatencySec}s</span>
              <span className="eff-lbl">Avg Response</span>
            </div>
            <div className="eff-box">
              <span className="eff-val">{avgTokensPerPrompt.toLocaleString()}</span>
              <span className="eff-lbl">Tokens / Call</span>
            </div>
            <div className="eff-box">
              <span className="eff-val">{sessions?.length || 0}</span>
              <span className="eff-lbl">Sessions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with Reset Action */}
      <div className="workbench-footer">
        <button
          type="button"
          className={`workbench-reset-btn ${confirmReset ? 'danger' : ''}`}
          onClick={handleReset}
          aria-label="Reset Statistics"
        >
          <RotateCcw size={11} />
          <span>{confirmReset ? 'Confirm reset?' : 'Reset statistics'}</span>
        </button>
      </div>
    </div>
  )
}

export default LuminaWorkbench
