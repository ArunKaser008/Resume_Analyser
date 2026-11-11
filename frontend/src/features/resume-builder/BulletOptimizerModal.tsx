import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../api/client'
import {
  optimizeBullet,
  type BulletOptimizeResponse,
  type BulletSeniorityLevel,
  type BulletSuggestion,
} from '../../api/bulletOptimizer'

const styleLabels: Record<BulletSuggestion['style'], string> = {
  metric: 'Metric-focused',
  architecture: 'Architecture-focused',
  leadership_process: 'Leadership / Process-focused',
}

function applyMetric(bullet: string, metric: string): string {
  return metric.trim()
    ? bullet.replace(/\[verified metric\]|\[Y\]/gi, metric.trim())
    : bullet
}

function followsXyzFormula(bullet: string): boolean {
  return /^Accomplished .+ as measured by .+, by doing .+\.?$/i.test(
    bullet.trim().replace(/\s+/g, ' '),
  )
}

export default function BulletOptimizerModal({
  originalBullet,
  targetRole,
  seniorityLevel,
  onClose,
  onApply,
}: {
  originalBullet: string
  targetRole: string
  seniorityLevel: BulletSeniorityLevel
  onClose: () => void
  onApply: (bullet: string) => Promise<void>
}) {
  const [result, setResult] = useState<BulletOptimizeResponse | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<BulletSuggestion['style'] | null>(null)
  const [editedBullet, setEditedBullet] = useState('')
  const [metric, setMetric] = useState('')
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    void optimizeBullet({
      original_bullet: originalBullet,
      target_role: targetRole,
      seniority_level: seniorityLevel,
    }).then((response) => {
      if (!active) return
      setResult(response)
      setError('')
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof ApiError ? cause.message : 'Unable to optimize this bullet.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [originalBullet, seniorityLevel, targetRole])

  const selectedSuggestion = useMemo(
    () => result?.suggestions.find((suggestion) => suggestion.style === selectedStyle),
    [result, selectedStyle],
  )

  const chooseSuggestion = (suggestion: BulletSuggestion) => {
    setSelectedStyle(suggestion.style)
    setEditedBullet(applyMetric(suggestion.optimized_bullet, metric))
    setNotice('')
  }

  const customizeMetric = (value: string) => {
    setMetric(value)
    if (selectedSuggestion) {
      setEditedBullet(applyMetric(selectedSuggestion.optimized_bullet, value))
    }
  }

  const copy = async () => {
    if (!editedBullet) return
    if (!followsXyzFormula(editedBullet)) {
      setError('Keep the rewrite in the Google XYZ format before copying.')
      return
    }
    try {
      await navigator.clipboard.writeText(editedBullet)
      setNotice('Suggestion copied to clipboard.')
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? `Unable to copy suggestion: ${cause.message}` : 'Unable to copy suggestion.')
    }
  }

  const apply = async () => {
    if (!editedBullet.trim()) return
    if (!followsXyzFormula(editedBullet)) {
      setError('Keep the rewrite in the Google XYZ format before applying.')
      return
    }
    setApplying(true)
    setError('')
    try {
      await onApply(editedBullet.trim())
      setNotice('Optimized bullet applied to your resume.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to apply this suggestion.')
    } finally {
      setApplying(false)
    }
  }

  return <div className="modal-backdrop bullet-optimizer-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !applying) onClose()
  }}>
    <section className="modal-card bullet-optimizer-modal" role="dialog" aria-modal="true" aria-labelledby="bullet-optimizer-title">
      <div className="panel-title">
        <div><span className="eyebrow">GOOGLE XYZ FORMULA</span><h2 id="bullet-optimizer-title">Optimize resume bullet</h2></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close optimizer" disabled={applying}>×</button>
      </div>
      <div className="bullet-optimizer-original"><strong>Original bullet</strong><p>{originalBullet}</p></div>
      {loading && <div className="empty-state" role="status"><span className="spinner" /><p>Generating three evidence-based rewrites…</p></div>}
      {result?.fallback_used && <div className="notice notice-info" role="status">The AI request timed out. Use these XYZ templates and replace placeholders only with verified details.</div>}
      {result && <div className="bullet-optimizer-suggestions">
        <div className="bullet-optimizer-options" role="group" aria-label="AI suggestions">
          {result.suggestions.map((suggestion) => <button
            type="button"
            className={`bullet-optimizer-option ${selectedStyle === suggestion.style ? 'selected' : ''}`}
            key={suggestion.style}
            aria-pressed={selectedStyle === suggestion.style}
            onClick={() => chooseSuggestion(suggestion)}
          >
            <strong>{styleLabels[suggestion.style]}</strong>
            <span>{suggestion.optimized_bullet}</span>
            <small>{suggestion.rationale}</small>
          </button>)}
        </div>
        <label className="bullet-optimizer-metric">Verified metric (optional)
          <input aria-label="Verified metric (optional)" value={metric} onChange={(event) => customizeMetric(event.target.value)} placeholder="e.g. 25% or $10K" />
          <span className="field-hint">Only enter a real measurement you can support.</span>
        </label>
        <label className="bullet-optimizer-edit">Selected suggestion
          <textarea aria-label="Selected suggestion" rows={4} value={editedBullet} onChange={(event) => setEditedBullet(event.target.value)} disabled={!selectedStyle} />
        </label>
      </div>}
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {notice && <div className="notice notice-success" role="status">{notice}</div>}
      <div className="form-actions">
        <button type="button" className="button button-secondary" onClick={() => void copy()} disabled={!editedBullet || applying}>Copy to Clipboard</button>
        <button type="button" className="button button-primary" onClick={() => void apply()} disabled={!editedBullet || applying}>{applying ? 'Applying…' : 'Apply to Resume'}</button>
      </div>
    </section>
  </div>
}
