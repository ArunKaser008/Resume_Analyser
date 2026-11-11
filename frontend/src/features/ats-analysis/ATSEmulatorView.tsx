import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { analyzeResumeForATS } from '../../api/atsEmulator'
import type { ATSJDAnalysis, Resume, TargetATS } from '../../api/types'

const atsOptions: { key: TargetATS; label: string; description: string }[] = [
  { key: 'WORKDAY', label: 'Workday', description: 'Plain-text extraction and exact matching.' },
  { key: 'GREENHOUSE', label: 'Greenhouse', description: 'Contextual skills and structured candidate evidence.' },
  { key: 'LEVER', label: 'Lever', description: 'Contextual skills, experience, and outcome alignment.' },
]

export default function ATSEmulatorView({
  resume,
}: {
  resume: Resume
}) {
  const [targetATS, setTargetATS] = useState<TargetATS>('WORKDAY')
  const [jobDescription, setJobDescription] = useState('')
  const [result, setResult] = useState<ATSJDAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const activeRequest = useRef<AbortController | null>(null)

  useEffect(() => () => activeRequest.current?.abort(), [])

  const runAnalysis = async (ats: TargetATS, description = jobDescription) => {
    setTargetATS(ats)
    activeRequest.current?.abort()
    if (!description.trim()) {
      activeRequest.current = null
      setResult(null)
      setLoading(false)
      setError('Paste a job description before running the ATS emulator.')
      return
    }

    const controller = new AbortController()
    activeRequest.current = controller
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const response = await analyzeResumeForATS(
        resume.id,
        description,
        ats,
        controller.signal,
      )
      if (!controller.signal.aborted) setResult(response)
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : 'ATS simulation could not be completed.')
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null
        setLoading(false)
      }
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void runAnalysis(targetATS)
  }

  return <section className="ats-emulator panel" aria-labelledby="ats-emulator-title">
    <div className="panel-title"><div><span className="eyebrow">TARGET SYSTEM EMULATOR</span><h2 id="ats-emulator-title">Compare ATS parsing</h2><p>Simulate how each system extracts this saved resume and evaluates it against a job description.</p></div></div>
    <div className="ats-tabs" role="tablist" aria-label="Target applicant tracking system">
      {atsOptions.map((option) => <button
        className={`ats-tab ${targetATS === option.key ? 'active' : ''}`}
        id={`ats-tab-${option.key.toLowerCase()}`}
        type="button"
        role="tab"
        aria-selected={targetATS === option.key}
        aria-controls="ats-emulator-panel"
        key={option.key}
        onClick={() => void runAnalysis(option.key)}
      ><strong>{option.label}</strong><small>{option.description}</small></button>)}
    </div>
    <form className="ats-emulator-form" onSubmit={submit}>
      <label htmlFor="ats-job-description">Job description</label>
      <textarea
        id="ats-job-description"
        value={jobDescription}
        onChange={(event) => setJobDescription(event.target.value)}
        maxLength={20_000}
        rows={6}
        placeholder="Paste the role description to compare against your resume."
      />
      <div className="ats-emulator-form-footer"><span>{jobDescription.length.toLocaleString()} / 20,000 characters · {targetATS} mode</span><button className="button button-primary" type="submit" disabled={loading || !jobDescription.trim()}>{loading ? 'Simulating…' : `Run ${atsOptions.find((item) => item.key === targetATS)?.label} simulation`}</button></div>
    </form>
    {loading && <div className="ats-simulation-loading" role="status">Simulating {targetATS}…</div>}
    {error && <div className="notice notice-error" role="alert">{error}<button className="button button-secondary" type="button" onClick={() => void runAnalysis(targetATS)}>Retry {targetATS} simulation</button></div>}
    {result && <div id="ats-emulator-panel" className="ats-emulator-results" role="tabpanel" aria-labelledby={`ats-tab-${result.target_ats.toLowerCase()}`}>
      <div className="ats-emulator-score">
        <article className="ats-emulator-metric">
          <span className="eyebrow">{result.target_ats} OVERALL MATCH</span>
          <strong>{Math.round(result.overall_match_score)}<small>%</small></strong>
        </article>
        <article className="seniority-density">
          <strong>Leadership signals</strong>
          <span>{result.seniority_signals.signal_count} · {result.seniority_signals.density_per_100_words.toFixed(1)} / 100 words</span>
          <small>{result.seniority_signals.summary}</small>
        </article>
      </div>
      {result.parser_warnings.length > 0 && <section className="ats-parser-warnings" role="region" aria-label="Parser warnings">
        <strong>Parser warnings</strong>
        <ul>{result.parser_warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      </section>}
      <div className="ats-side-by-side">
        <section className="ats-preview-pane"><div className="ats-pane-heading"><h3>Raw Parser Output</h3><span>{result.target_ats} simulation</span></div><pre>{result.raw_parser_output || 'No text was extracted.'}</pre></section>
        <section className="ats-preview-pane"><div className="ats-pane-heading"><h3>Recruiter View</h3><span>{result.hard_skill_matrix.length} hard skills scanned</span></div><p className="ats-recruiter-copy">{result.recruiter_view}</p><div className="ats-skill-matrix">{result.hard_skill_matrix.map((item) => <article className={`ats-skill-row ats-skill-${item.status}`} key={item.skill}><div><strong>{item.skill}</strong><span>{item.status}</span></div><p>{item.evidence.length ? item.evidence.join(' · ') : item.rationale}</p></article>)}</div></section>
      </div>
      {result.formatting_flags.length > 0 && <section className="ats-formatting-flags"><h3>Formatting risks ({Math.round(result.formatting_risk_score)}/100)</h3>{result.formatting_flags.map((flag, index) => <p key={`${flag.category}-${index}`}><strong>{flag.line_number ? `Line ${flag.line_number}: ` : ''}{flag.category.replaceAll('_', ' ')}</strong> · {flag.message}</p>)}</section>}
    </div>}
  </section>
}
