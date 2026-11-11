import { useState } from 'react'
import { generateInterviewPrep } from '../../api/dashboard'
import type { InterviewPrepResponse } from '../../types/dashboard'

export default function InterviewPrepCard({ resumeId }: { resumeId: string }) {
  const [result, setResult] = useState<InterviewPrepResponse | null>(null)
  const [targetJd, setTargetJd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    setLoading(true)
    setError('')
    try {
      setResult(await generateInterviewPrep(resumeId, targetJd))
    } catch (cause) {
      setResult(null)
      setError(cause instanceof Error ? cause.message : 'Unable to generate interview preparation.')
    } finally {
      setLoading(false)
    }
  }

  return <section className="panel dashboard-panel" aria-labelledby="interview-prep-title">
    <div className="panel-title"><div><h2 id="interview-prep-title">Resume-defense interview prep</h2><p>Practice questions grounded in your stated projects and experience.</p></div></div>
    <label className="dashboard-jd-label">Optional job description<textarea value={targetJd} maxLength={20000} onChange={(event) => setTargetJd(event.target.value)} placeholder="Paste a target job description for more focused questions." /></label>
    <button className="button button-primary" type="button" disabled={loading} onClick={() => void generate()}>{loading ? 'Preparing questions…' : 'Generate interview guide'}</button>
    {loading && <div className="dashboard-skeleton" role="status">Analyzing resume claims…</div>}
    {!loading && error && <p className="notice notice-error" role="alert">{error}</p>}
    {!loading && !error && !result && <p className="dashboard-empty">Generate a guide to reveal technical probes and gap traps.</p>}
    {!loading && result && <div className="interview-guide">
      <details open><summary>Technical probes ({result.technical_probes.length})</summary>{result.technical_probes.map((probe, index) => <article key={`${index}-${probe.question}`}><strong>{probe.question}</strong><p><b>Resume claim:</b> {probe.resume_claim}</p><small>Focus: {probe.evaluation_focus}</small></article>)}</details>
      <details><summary>Gap traps ({result.gap_traps.length})</summary>{result.gap_traps.map((trap) => <article key={trap.weak_area}><strong>{trap.weak_area}</strong><p>{trap.interviewer_question}</p><ul>{trap.suggested_talking_points.map((point) => <li key={point}>{point}</li>)}</ul></article>)}</details>
    </div>}
  </section>
}
