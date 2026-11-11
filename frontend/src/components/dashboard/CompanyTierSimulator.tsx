import { useState } from 'react'
import { simulateCompanyTier } from '../../api/dashboard'
import type { TierSimulationResponse, TierType } from '../../types/dashboard'

const tiers: { id: TierType; label: string }[] = [
  { id: 'MAANG_PRODUCT', label: 'MAANG' },
  { id: 'SERIES_B_STARTUP', label: 'Startup' },
  { id: 'SERVICED_MNC', label: 'Service MNC' },
]

export default function CompanyTierSimulator({ resumeId }: { resumeId: string }) {
  const [tier, setTier] = useState<TierType | null>(null)
  const [result, setResult] = useState<TierSimulationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const chooseTier = async (nextTier: TierType) => {
    setTier(nextTier)
    setLoading(true)
    setError('')
    try {
      setResult(await simulateCompanyTier({ resume_id: resumeId, tier_type: nextTier }))
    } catch (cause) {
      setResult(null)
      setError(cause instanceof Error ? cause.message : 'Unable to simulate this company tier.')
    } finally {
      setLoading(false)
    }
  }

  return <section className="panel dashboard-panel" aria-labelledby="tier-simulator-title">
    <div className="panel-title"><div><h2 id="tier-simulator-title">Company tier simulator</h2><p>Re-score the same resume against a distinct hiring emphasis.</p></div></div>
    <div className="dashboard-segmented" role="tablist" aria-label="Company tier">
      {tiers.map((item) => <button type="button" role="tab" aria-selected={tier === item.id} className={tier === item.id ? 'active' : ''} key={item.id} onClick={() => void chooseTier(item.id)}>{item.label}</button>)}
    </div>
    {loading && <div className="dashboard-skeleton" role="status">Evaluating this resume for {tiers.find((item) => item.id === tier)?.label}…</div>}
    {!loading && error && <p className="notice notice-error" role="alert">{error}</p>}
    {!loading && !error && !result && <p className="dashboard-empty">Choose a company tier to see its tailored score and checklist.</p>}
    {!loading && result && <div className="tier-result" aria-live="polite">
      <div className="tier-score"><strong>{Math.round(result.overall_score)}</strong><span>/100 for {tiers.find((item) => item.id === result.tier_type)?.label}</span></div>
      <ul className="tier-checklist">{result.checks.map((check) => <li key={check.name} className={check.passed ? 'passed' : 'failed'}>
        <span aria-hidden="true">{check.passed ? '✓' : '!'}</span><div><strong>{check.name}</strong><small>{check.detail}</small></div>
      </li>)}</ul>
    </div>}
  </section>
}
