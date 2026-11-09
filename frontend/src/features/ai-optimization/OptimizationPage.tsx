import { useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import {
  applySuggestion,
  createOptimizationSession,
  deleteContentOverride,
  getContentOverrides,
  getOptimizationSession,
  getOptimizationSessions,
  optimizeResume,
  setSuggestionDecision,
  tailorResume,
} from '../../api/optimization'
import type { OptimizationSession, Resume, ResumeContentOverride, ResumeOptimization, TailoringResult } from '../../api/types'
import { finalizeResumeChanges } from '../../api/resumes'

const applyFields = new Set(['summary', 'description', 'responsibilities', 'achievements', 'source_text'])

export default function OptimizationPage({ mode, resumes, initialResumeId, onResumeImported, onPreview, onRecheck }: {
  mode: 'optimization' | 'tailoring'
  resumes: Resume[]
  initialResumeId?: string
  onResumeImported?: (resume: Resume) => Promise<void>
  onPreview: (resume: Resume) => void
  onRecheck?: (resumeId: string) => void
}) {
  const [resumeId, setResumeId] = useState(initialResumeId || (mode === 'optimization' ? resumes[0]?.id || '' : ''))
  const [jobDescription, setJobDescription] = useState('')
  const [sessions, setSessions] = useState<OptimizationSession[]>([])
  const [selected, setSelected] = useState<OptimizationSession | null>(null)
  const [overrides, setOverrides] = useState<ResumeContentOverride[]>([])
  const [optimization, setOptimization] = useState<ResumeOptimization | null>(null)
  const [tailoring, setTailoring] = useState<TailoringResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const activeResume = resumes.find((resume) => resume.id === resumeId)
  const copyRootId = activeResume?.parent_resume_id || activeResume?.id
  const savedCopies = resumes.filter((resume) => resume.parent_resume_id === copyRootId).length

  const loadResumeData = async (id: string) => {
    if (!id) { setSessions([]); setSelected(null); setOverrides([]); return }
    const [sessionData, overrideData] = await Promise.all([
      getOptimizationSessions(id),
      getContentOverrides(id),
    ])
    setSessions(sessionData)
    setOverrides(overrideData)
    setSelected((current) => current && current.resume_id === id
      ? sessionData.find((session) => session.id === current.id) || null
      : null)
  }

  useEffect(() => {
    if (!resumeId) return
    let active = true
    void Promise.all([
      getOptimizationSessions(resumeId),
      getContentOverrides(resumeId),
    ]).then(([sessionData, overrideData]) => {
      if (!active) return
      setSessions(sessionData)
      setOverrides(overrideData)
      setSelected((current) => current && current.resume_id === resumeId
        ? sessionData.find((session) => session.id === current.id) || null
        : null)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to load optimization history.')
    })
    return () => { active = false }
  }, [resumeId])

  const validate = () => {
    if (mode === 'optimization' && !resumeId) { setError('Select a resume before continuing.'); return false }
    if (mode === 'tailoring' && !resumeId) { setError('Select a resume before continuing.'); return false }
    if (jobDescription.trim().length < 100 || jobDescription.length > 20000) {
      setError('Job description must be between 100 and 20,000 characters.')
      return false
    }
    return true
  }
  const run = async (action: 'session' | 'optimize' | 'tailor') => {
    setError('')
    setNotice('')
    setOptimization(null)
    setTailoring(null)
    if (!validate()) return
    setBusy(true)
    try {
      if (action === 'session') {
        const session = await createOptimizationSession(resumeId, jobDescription.trim())
        setSelected(session)
        await loadResumeData(resumeId)
        setSelected(session)
        setNotice('Optimization session created. Review each suggestion before applying it.')
      } else if (action === 'optimize') {
        setOptimization(await optimizeResume(resumeId, jobDescription.trim()))
      } else {
        const result = await tailorResume(resumeId, jobDescription.trim())
        setTailoring(result)
        await loadResumeData(resumeId)
        const session = await getOptimizationSession(result.optimization_session.id)
        setSelected(session)
        setNotice('Tailoring analysis completed. Suggestions are saved for your review.')
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'The AI request could not be completed.')
    } finally {
      setBusy(false)
    }
  }
  const openSession = async (id: string) => {
    setError('')
    try { setSelected(await getOptimizationSession(id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load this session.') }
  }
  const decision = async (suggestionId: string, status: 'accepted' | 'rejected') => {
    setError('')
    setBusy(true)
    try {
      const result = await setSuggestionDecision(suggestionId, status)
      if (selected) setSelected({ ...selected, suggestions: selected.suggestions.map((item) => item.id === suggestionId ? result.suggestion : item), status: result.session_status })
      setNotice(`Suggestion ${status}.`)
      await loadResumeData(resumeId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update suggestion decision.')
    } finally { setBusy(false) }
  }
  const apply = async (suggestion: OptimizationSession['suggestions'][number]) => {
    if (!suggestion.target_field || !applyFields.has(suggestion.target_field)) return
    setBusy(true)
    setError('')
    try {
      await applySuggestion(
        suggestion.id,
        suggestion.target_field as 'summary' | 'description' | 'responsibilities' | 'achievements' | 'source_text',
        suggestion.source_item_id || undefined,
      )
      setNotice('Accepted suggestion applied as a resume-specific content override.')
      await loadResumeData(resumeId)
      if (selected) setSelected(await getOptimizationSession(selected.id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to apply this suggestion.')
    } finally { setBusy(false) }
  }
  const removeOverride = async (override: ResumeContentOverride) => {
    if (!window.confirm('Remove this resume-specific content override?')) return
    setBusy(true)
    setError('')
    try {
      await deleteContentOverride(resumeId, override.id)
      setOverrides((current) => current.filter((entry) => entry.id !== override.id))
      setNotice('Content override removed.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove the override.')
    } finally { setBusy(false) }
  }
  const finalizeChanges = async (action: 'update_existing' | 'save_copy') => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await finalizeResumeChanges(resumeId, action)
      setResumeId(result.resume.id)
      setSelected(null)
      setTailoring(null)
      await onResumeImported?.(result.resume)
      await loadResumeData(result.resume.id)
      setNotice(action === 'save_copy'
        ? `Saved as ${result.resume.title}. The original resume was left unchanged.`
        : 'Changes saved to the existing resume.')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save these changes.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="feature-page">
    <div className="page-heading"><div><div className="eyebrow">AI-ASSISTED IMPROVEMENT</div><h1>{mode === 'optimization' ? 'Optimize your resume' : 'Tailor your resume'}</h1><p>{mode === 'optimization' ? 'Get job-specific feedback, review every suggestion, and decide what to apply.' : 'Generate a job-specific fit analysis and review suggestions without overwriting your original resume.'}</p></div></div>
    <section className="panel analysis-form">
      {mode === 'optimization' && <label>Resume<select value={resumeId} onChange={(event) => { setResumeId(event.target.value); setSelected(null); setError('') }}><option value="">Select a resume</option>{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.title}</option>)}</select></label>}
      {mode === 'tailoring' && (activeResume
        ? <p className="muted">Using current workspace resume: <strong>{activeResume.title}</strong></p>
        : resumes.length > 0
          ? <label>Select a resume to continue<select value={resumeId} onChange={(event) => { setResumeId(event.target.value); setSelected(null); setError('') }}><option value="">Select a resume</option>{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.title}</option>)}</select></label>
          : <p className="muted">Create a resume in Resume Builder before tailoring it to a job description.</p>)}
      <label>Target job description <span className="muted">(100–20,000 characters)</span><textarea rows={7} minLength={100} maxLength={20000} value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the job description to receive tailored suggestions…" /></label>
      <div className="form-footer"><span className="character-count">{jobDescription.length.toLocaleString()} / 20,000</span><div className="button-row">{mode === 'optimization' ? <><button className="button button-secondary" disabled={busy || jobDescription.trim().length < 100} onClick={() => void run('optimize')}>Generate recommendations</button><button className="button button-primary" disabled={busy || jobDescription.trim().length < 100} onClick={() => void run('session')}>{busy ? 'Working…' : 'Create review session'}</button></> : <button className="button button-primary" disabled={busy || jobDescription.trim().length < 100} onClick={() => void run('tailor')}>{busy ? 'Tailoring…' : 'Tailor & analyze'}</button>}</div></div>
    </section>
    {error && <div className="notice notice-error" role="alert">{error}</div>}{notice && <div className="notice notice-success" role="status">{notice}</div>}
    {optimization && <OptimizationResult result={optimization} />}
    {tailoring && <section className="panel"><div className="panel-title"><div><h2>Tailoring analysis</h2><p>{tailoring.message}</p></div><strong className="large-score">{Math.round(tailoring.match_analysis.overall_match_score)}%</strong></div><p>{tailoring.match_analysis.summary}</p><p>{tailoring.suggestion_count} reviewable suggestions are available in the session below.</p><div className="button-row"><button className="button button-secondary" onClick={() => { const resume = resumes.find((item) => item.id === resumeId); if (resume) onPreview(resume) }}>Preview tailored resume</button><button className="button button-secondary" onClick={() => onRecheck?.(resumeId)}>Recheck ATS score</button></div></section>}
    {overrides.some((override) => override.is_draft) && <section className="panel"><div className="panel-title"><div><span className="eyebrow">FINAL STEP</span><h2>How would you like to save your changes?</h2><p>Updating the existing resume replaces its current content. Saving a copy leaves the original unchanged.</p></div></div><div className="button-row"><button className="button button-primary" disabled={busy} onClick={() => void finalizeChanges('update_existing')}>{busy ? 'Saving…' : 'Update existing resume'}</button><button className="button button-secondary" disabled={busy || savedCopies >= 2} onClick={() => void finalizeChanges('save_copy')}>{busy ? 'Saving…' : `Save as a copy (${Math.max(0, 2 - savedCopies)} remaining)`}</button></div>{savedCopies >= 2 && <p className="muted">Maximum of two saved copies has been reached for this resume.</p>}</section>}
    <div className="optimization-columns">
      <section className="panel"><div className="panel-title"><div><h2>Session history</h2><p>Open any previous review session.</p></div></div>{sessions.length === 0 ? <p className="muted">No optimization sessions for this resume yet.</p> : <div className="history-list">{sessions.map((session) => <button className={`history-row ${selected?.id === session.id ? 'selected' : ''}`} key={session.id} onClick={() => void openSession(session.id)}><span><strong>{session.target_role || 'Resume optimization'}</strong><small>{new Date(session.created_at).toLocaleString()} · {session.suggestions.length} suggestions</small></span><span className="status-pill">{session.status}</span></button>)}</div>}</section>
      <section className="panel"><div className="panel-title"><div><h2>Content overrides</h2><p>Customized content applied only to this resume.</p></div><button className="button button-secondary" onClick={() => { const resume = resumes.find((item) => item.id === resumeId); if (resume) onPreview(resume) }}>Preview</button></div>{overrides.length === 0 ? <p className="muted">No content overrides applied.</p> : <div className="override-list">{overrides.map((override) => <article className="override-item" key={override.id}><div><strong>{override.section_type} · {override.field_name}</strong><p>{override.content}</p></div><button className="button button-danger" disabled={busy} onClick={() => void removeOverride(override)}>Remove</button></article>)}</div>}</section>
    </div>
    {selected && <section className="panel suggestions-panel"><div className="panel-title"><div><span className="eyebrow">SESSION REVIEW</span><h2>{selected.target_role || 'Optimization session'}</h2><p>Session status: {selected.status}. Accept or reject each suggestion explicitly.</p></div><span className="tag">{selected.suggestions.length} suggestions</span></div>{selected.suggestions.length === 0 ? <p className="muted">This session has no suggestions.</p> : <div className="suggestion-list">{selected.suggestions.map((suggestion) => { const applied = overrides.some((override) => override.suggestion_id === suggestion.id); return <article className="suggestion-card" key={suggestion.id}><div className="suggestion-header"><div><span className="tag">{suggestion.suggestion_type}{suggestion.target_field ? ` · ${suggestion.target_field}` : ''}</span><span className={`status-pill status-${suggestion.status}`}>{suggestion.status}</span>{applied && <span className="status-pill">applied</span>}</div>{suggestion.status === 'pending' && <div className="button-row"><button className="button button-secondary" disabled={busy} onClick={() => void decision(suggestion.id, 'rejected')}>Reject</button><button className="button button-primary" disabled={busy} onClick={() => void decision(suggestion.id, 'accepted')}>Accept</button></div>}</div><div className="suggestion-text"><div><small>Current content</small><p>{suggestion.original_text || 'No original text provided.'}</p></div><div><small>Suggested content</small><p>{suggestion.suggested_text}</p></div></div>{suggestion.explanation && <p className="muted">{suggestion.explanation}</p>}{suggestion.status === 'accepted' && <div className="apply-row">{applied ? <span className="muted">Applied as a resume-specific change.</span> : suggestion.target_field && applyFields.has(suggestion.target_field) ? <button className="button button-secondary" disabled={busy} onClick={() => void apply(suggestion)}>Apply accepted change</button> : <span className="muted">This suggestion has no supported content target and cannot be applied automatically.</span>}</div>}</article>})}</div>}<div className="form-actions"><button className="button button-secondary" onClick={() => onRecheck?.(resumeId)}>Recheck ATS score</button><button className="button button-secondary" onClick={() => { const resume = resumes.find((item) => item.id === resumeId); if (resume) onPreview(resume) }}>Preview & download</button></div></section>}
  </div>
}

function OptimizationResult({ result }: { result: ResumeOptimization }) {
  return <section className="panel"><div className="panel-title"><div><span className="eyebrow">AI RECOMMENDATIONS</span><h2>Optimization insights</h2><p>Recommendations are suggestions only; nothing is applied automatically.</p></div></div><div className="result-grid"><section className="list-panel"><h3>Optimized summary</h3><p>{result.optimized_summary || 'No summary suggestion returned.'}</p></section><SimpleSuggestions title="Experience suggestions" values={result.experience_suggestions.map((entry) => `${entry.suggested_text} — ${entry.explanation}`)} /><SimpleSuggestions title="Project suggestions" values={result.project_suggestions.map((entry) => `${entry.suggested_text} — ${entry.explanation}`)} /><SimpleSuggestions title="Keywords to consider" values={result.keywords_to_consider} /><SimpleSuggestions title="Skill gap recommendations" values={result.skill_gap_recommendations} /><SimpleSuggestions title="General recommendations" values={result.general_recommendations} /><SimpleSuggestions title="Factuality notes" values={result.factuality_notes} /></div></section>
}
function SimpleSuggestions({ title, values }: { title: string; values: string[] }) {
  return <section className="list-panel"><h3>{title}</h3>{values.length ? <ul>{values.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}</ul> : <p className="muted">No items returned.</p>}</section>
}
