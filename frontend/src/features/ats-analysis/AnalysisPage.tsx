import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import {
  applySuggestion,
  createOptimizationSession,
  getContentOverrides,
  getOptimizationSession,
  setSuggestionDecision,
} from '../../api/optimization'
import {
  downloadResume,
  downloadResumeDocx,
  finalizeResumeChanges,
  importResume,
} from '../../api/resumes'
import { analyzeResume } from '../../api/resumeAnalysis'
import type { CareerProfile, OptimizationSession, ProfileType, Resume, ResumeAnalysis, ResumeContentOverride, ResumeParseResponse } from '../../api/types'
import ParsedDataPreview from './ParsedDataPreview'
import ProofOfWorkDashboard from './ProofOfWorkDashboard'
import ATSEmulatorView from './ATSEmulatorView'
import ResumeUploader from './ResumeUploader'

const applicableFields = new Set([
  'summary',
  'description',
  'responsibilities',
  'achievements',
  'source_text',
])

export default function AnalysisPage({ resumes, profiles, initialResumeId, onResumeImported, onResumeFinalized }: {
  resumes: Resume[]
  profiles: CareerProfile[]
  initialResumeId?: string
  onResumeImported?: (resume: Resume) => Promise<void>
  onResumeFinalized?: (resume: Resume) => Promise<void>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [profileType, setProfileType] = useState<ProfileType>('experienced')
  const [targetRole, setTargetRole] = useState('')
  const [analyzedResumeId, setAnalyzedResumeId] = useState(initialResumeId || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null)
  const [parseResult, setParseResult] = useState<ResumeParseResponse | null>(null)
  const [session, setSession] = useState<OptimizationSession | null>(null)
  const [draftOverrides, setDraftOverrides] = useState<ResumeContentOverride[]>([])
  const [savingAction, setSavingAction] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const currentResume = resumes.find((resume) => resume.id === analyzedResumeId)
  const currentProfile = currentResume
    ? profiles.find((profile) => profile.id === currentResume.career_profile_id)
    : undefined
  const copyRootId = currentResume?.parent_resume_id || currentResume?.id
  const savedCopies = useMemo(
    () => resumes.filter((resume) => resume.parent_resume_id === copyRootId).length,
    [copyRootId, resumes],
  )

  const analyze = async (event?: FormEvent) => {
    event?.preventDefault()
    setError('')
    setNotice('')
    setSession(null)
    if (!initialResumeId && !file) {
      setError('Select a PDF, DOCX, or TXT resume to continue.')
      return
    }

    setLoading(true)
    try {
      let activeResumeId = analyzedResumeId
      if (!initialResumeId && file) {
        const imported = await importResume(
          file,
          profileType,
          profileType === 'student' ? undefined : targetRole,
        )
        activeResumeId = imported.resume.id
        setAnalyzedResumeId(activeResumeId)
        setFile(null)
        await onResumeImported?.(imported.resume)
      }
      const result = await analyzeResume(activeResumeId, undefined, true)
      setAnalysis(result)
      setDraftOverrides((await getContentOverrides(activeResumeId)).filter((item) => item.is_draft))
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Analysis could not be completed.')
    } finally {
      setLoading(false)
    }
  }

  const suggestForWeakness = async (weakness: string) => {
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const created = await createOptimizationSession(
        analyzedResumeId,
        undefined,
        weakness,
      )
      setSession(created)
      setNotice(`AI suggestions generated for: ${weakness}`)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to generate an AI suggestion.')
    } finally {
      setLoading(false)
    }
  }

  const decide = async (suggestionId: string, status: 'accepted' | 'rejected') => {
    if (!session) return
    setLoading(true)
    setError('')
    try {
      const result = await setSuggestionDecision(suggestionId, status)
      setSession((current) => current ? {
        ...current,
        suggestions: current.suggestions.map((suggestion) => suggestion.id === suggestionId
          ? result.suggestion
          : suggestion),
        status: result.session_status,
      } : current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update suggestion.')
    } finally {
      setLoading(false)
    }
  }

  const apply = async (suggestion: OptimizationSession['suggestions'][number]) => {
    if (!suggestion.target_field || !applicableFields.has(suggestion.target_field)) return
    setLoading(true)
    setError('')
    try {
      await applySuggestion(
        suggestion.id,
        suggestion.target_field as 'summary' | 'description' | 'responsibilities' | 'achievements' | 'source_text',
        suggestion.source_item_id || undefined,
      )
      setDraftOverrides((await getContentOverrides(analyzedResumeId)).filter((item) => item.is_draft))
      setSession(await getOptimizationSession(suggestion.session_id))
      setNotice('Change added as a draft. Your saved resume is unchanged until you choose how to save.')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to add this change.')
    } finally {
      setLoading(false)
    }
  }

  const finalize = async (action: 'update_existing' | 'save_copy') => {
    setSavingAction(true)
    setError('')
    setNotice('')
    try {
      const result = await finalizeResumeChanges(analyzedResumeId, action)
      setAnalyzedResumeId(result.resume.id)
      setDraftOverrides([])
      setSession(null)
      await onResumeFinalized?.(result.resume)
      setAnalysis(await analyzeResume(result.resume.id))
      setNotice(action === 'save_copy'
        ? `Saved as ${result.resume.title}. The original resume was left unchanged.`
        : 'Changes saved to the existing resume.')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save these changes.')
    } finally {
      setSavingAction(false)
    }
  }

  const download = async (format: 'pdf' | 'docx') => {
    setDownloading(true)
    setError('')
    try {
      const content = format === 'pdf'
        ? await downloadResume(analyzedResumeId)
        : await downloadResumeDocx(analyzedResumeId)
      const url = URL.createObjectURL(content)
      const link = document.createElement('a')
      link.href = url
      link.download = `${currentResume?.title || 'resume'}.${format}`
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to download ${format.toUpperCase()}.`)
    } finally {
      setDownloading(false)
    }
  }

  return <div className="feature-page">
    <div className="page-heading"><div><div className="eyebrow">FEATURE 01</div><h1>ATS resume analyser</h1><p>Upload a resume to see its ATS-readiness score, strengths, and areas to improve.</p></div></div>
    {!initialResumeId && <form className="panel analysis-form" onSubmit={(event) => void analyze(event)}>
      <ResumeUploader onFileSelected={setFile} onParsed={setParseResult} />
      <div className="form-grid">
        <label>Candidate type<select value={profileType} onChange={(event) => { const type = event.target.value as ProfileType; setProfileType(type); if (type === 'student') setTargetRole('') }}><option value="student">Student</option><option value="fresher">Fresher</option><option value="experienced">Experienced</option></select></label>
        {profileType !== 'student' && <label>Target role <span className="muted">(optional)</span><input maxLength={200} value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="e.g. Product Designer" /></label>}
      </div>
      <div className="form-footer"><span className="muted">Upload a resume for a baseline ATS readiness check.</span><button className="button button-primary" disabled={loading || !file}>{loading ? 'Analyzing…' : 'Analyze resume'}</button></div>
    </form>}
    {parseResult && <ParsedDataPreview key={parseResult.parse_id} result={parseResult} />}
    <ProofOfWorkDashboard key={parseResult?.parse_id || 'proof-of-work'} parsedData={parseResult?.parsed_data} />
    {currentResume && currentProfile && <ATSEmulatorView key={currentResume.id} resume={currentResume} profile={currentProfile} />}
    {initialResumeId && <section className="panel analysis-form"><p>Rechecking the selected resume, including any unsaved draft changes.</p><button className="button button-primary" disabled={loading} onClick={() => void analyze()}>{loading ? 'Analyzing…' : 'Recheck ATS score'}</button></section>}
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {notice && <div className="notice notice-success" role="status">{notice}</div>}
    {analysis && <ATSResult
      result={analysis}
      draftOverrides={draftOverrides}
      session={session}
      loading={loading}
      savingAction={savingAction}
      downloading={downloading}
      savedCopies={savedCopies}
      onSuggest={suggestForWeakness}
      onDecision={decide}
      onApply={apply}
      onFinalize={finalize}
      onDownload={download}
    />}
  </div>
}

function ATSResult({ result, draftOverrides, session, loading, savingAction, downloading, savedCopies, onSuggest, onDecision, onApply, onFinalize, onDownload }: {
  result: ResumeAnalysis
  draftOverrides: ResumeContentOverride[]
  session: OptimizationSession | null
  loading: boolean
  savingAction: boolean
  downloading: boolean
  savedCopies: number
  onSuggest: (weakness: string) => void
  onDecision: (suggestionId: string, status: 'accepted' | 'rejected') => void
  onApply: (suggestion: OptimizationSession['suggestions'][number]) => void
  onFinalize: (action: 'update_existing' | 'save_copy') => void
  onDownload: (format: 'pdf' | 'docx') => void
}) {
  const weaknesses = [...new Set([...result.weaknesses, ...result.recommendations])]
  const appliedSuggestionIds = new Set(draftOverrides.map((item) => item.suggestion_id).filter(Boolean))

  return <div className="results">
    <section className="panel score-panel"><div className="score-ring" style={{ '--score': `${Math.max(0, Math.min(100, result.match_score))}%` } as CSSProperties}><strong>{Math.round(result.match_score)}<small>%</small></strong></div><div className="score-copy"><span className="eyebrow">ATS READINESS</span><h2>{result.score_label}</h2><p>{result.summary}</p><div className="button-row score-actions">{draftOverrides.length > 0 && <span className="status-pill">Draft changes not saved</span>}<button className="button button-secondary" disabled={downloading || draftOverrides.length > 0} onClick={() => onDownload('pdf')}>Download PDF</button><button className="button button-secondary" disabled={downloading || draftOverrides.length > 0} onClick={() => onDownload('docx')}>Download DOCX</button></div>{draftOverrides.length > 0 && <p className="muted">Save or discard your draft changes before downloading.</p>}</div></section>
    <section className="panel"><div className="panel-title"><div><h2>Score breakdown</h2><p>Category scores from the backend analysis.</p></div></div><div className="breakdown-list">{result.score_breakdown.map((entry) => <div className="breakdown-row" key={entry.category}><div><strong>{entry.category}</strong><small>{entry.details}</small></div><div className="breakdown-value"><div className="progress-track"><span style={{ width: `${Math.max(0, Math.min(100, entry.score))}%` }} /></div><strong>{Math.round(entry.score)}%</strong></div></div>)}</div></section>
    <div className="result-grid"><ListPanel title="Strengths" values={result.strengths} /><ListPanel title="Matched keywords" values={result.matched_keywords} /><ListPanel title="Missing keywords" values={result.missing_keywords} tone="warning" /><ListPanel title="Matched skills" values={result.matched_skills} /><ListPanel title="Missing skills" values={result.missing_skills} tone="warning" /></div>
    <section className="panel"><div className="panel-title"><div><h2>Areas to improve</h2><p>Choose an issue to ask AI for specific, reviewable resume edits.</p></div></div>{weaknesses.length === 0 ? <p className="muted">No weaknesses identified.</p> : <div className="suggestion-list">{weaknesses.map((weakness) => <article className="suggestion-card" key={weakness}><div className="suggestion-header"><strong>{weakness}</strong><button className="button button-secondary" disabled={loading} onClick={() => onSuggest(weakness)}>Suggest an improvement</button></div></article>)}</div>}</section>
    {session && <section className="panel suggestions-panel"><div className="panel-title"><div><span className="eyebrow">AI SUGGESTIONS</span><h2>Review suggested content</h2><p>Only apply a suggestion if it accurately reflects your experience.</p></div><span className="tag">{session.suggestions.length} suggestions</span></div>{session.suggestions.length === 0 ? <p className="muted">AI did not find a factual, relevant edit for this weakness.</p> : <div className="suggestion-list">{session.suggestions.map((suggestion) => {
      const isApplied = appliedSuggestionIds.has(suggestion.id)
      return <article className="suggestion-card" key={suggestion.id}><div className="suggestion-header"><div><span className="tag">{suggestion.suggestion_type}{suggestion.target_field ? ` · ${suggestion.target_field}` : ''}</span>{isApplied && <span className="status-pill">added as draft</span>}</div>{suggestion.status === 'pending' && <div className="button-row"><button className="button button-secondary" disabled={loading} onClick={() => onDecision(suggestion.id, 'rejected')}>Reject</button><button className="button button-primary" disabled={loading} onClick={() => onDecision(suggestion.id, 'accepted')}>Accept</button></div>}</div><div className="suggestion-text"><div><small>Current content</small><p>{suggestion.original_text || 'No original text provided.'}</p></div><div><small>Suggested content</small><p>{suggestion.suggested_text}</p></div></div>{suggestion.explanation && <p className="muted">{suggestion.explanation}</p>}{suggestion.status === 'accepted' && !isApplied && suggestion.target_field && applicableFields.has(suggestion.target_field) && <button className="button button-secondary" disabled={loading} onClick={() => onApply(suggestion)}>Add this change</button>}</article>
    })}</div>}</section>}
    {draftOverrides.length > 0 && <section className="panel"><div className="panel-title"><div><span className="eyebrow">FINAL STEP</span><h2>How would you like to save your changes?</h2><p>Updating the existing resume replaces its current content. Saving a copy leaves the original unchanged.</p></div></div><div className="button-row"><button className="button button-primary" disabled={savingAction} onClick={() => onFinalize('update_existing')}>{savingAction ? 'Saving…' : 'Update existing resume'}</button><button className="button button-secondary" disabled={savingAction || savedCopies >= 2} onClick={() => onFinalize('save_copy')}>{savingAction ? 'Saving…' : `Save as a copy (${Math.max(0, 2 - savedCopies)} remaining)`}</button></div>{savedCopies >= 2 && <p className="muted">Maximum of two saved copies has been reached for this resume.</p>}</section>}
  </div>
}

function ListPanel({ title, values, tone }: { title: string; values: string[]; tone?: 'warning' }) {
  return <section className={`panel list-panel ${tone || ''}`}><h2>{title}</h2>{values.length ? <ul>{values.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}</ul> : <p className="muted">No items returned.</p>}</section>
}
