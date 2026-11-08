import { useState, type CSSProperties, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { downloadResume, downloadResumeDocx, importResume } from '../../api/resumes'
import { analyzeResume } from '../../api/resumeAnalysis'
import type { Resume, ResumeAnalysis } from '../../api/types'

export default function AnalysisPage({ resumes, initialResumeId, onResumeImported, onOptimize }: {
  resumes: Resume[]
  initialResumeId?: string
  onResumeImported?: (resume: Resume) => Promise<void>
  onOptimize?: (resumeId: string) => void
}) {
  const [resumeId, setResumeId] = useState(initialResumeId || '')
  const [source, setSource] = useState<'upload' | 'saved'>(initialResumeId ? 'saved' : 'upload')
  const [file, setFile] = useState<File | null>(null)
  const [profileType, setProfileType] = useState<'fresher' | 'experienced'>('experienced')
  const [targetRole, setTargetRole] = useState('')
  const [description, setDescription] = useState('')
  const [analyzedResumeId, setAnalyzedResumeId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setAnalysis(null)
    if (source === 'upload' && !file) {
      setError('Upload a PDF, DOCX, or TXT resume to continue.')
      return
    }
    if (source === 'saved' && !resumeId) {
      setError('Select a resume to continue.')
      return
    }

    setLoading(true)
    try {
      let activeResumeId = resumeId
      if (source === 'upload' && file) {
        const imported = await importResume(file, profileType, targetRole)
        activeResumeId = imported.resume.id
        setResumeId(activeResumeId)
        setSource('saved')
        setFile(null)
        await onResumeImported?.(imported.resume)
      }
      setAnalysis(await analyzeResume(activeResumeId, description.trim() || undefined))
      setAnalyzedResumeId(activeResumeId)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Analysis could not be completed.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="feature-page">
    <div className="page-heading"><div><div className="eyebrow">FEATURE 01</div><h1>ATS resume analyser</h1><p>Upload a resume to see its ATS-readiness score, strengths, and areas to improve.</p></div></div>
    <form className="panel analysis-form" onSubmit={(event) => void submit(event)}>
      <div className="source-switch" role="group" aria-label="Resume source">
        <button type="button" className={`button ${source === 'upload' ? 'button-primary' : 'button-secondary'}`} onClick={() => setSource('upload')}>Upload resume</button>
        {resumes.length > 0 && <button type="button" className={`button ${source === 'saved' ? 'button-primary' : 'button-secondary'}`} onClick={() => setSource('saved')}>Choose saved resume</button>}
      </div>
      {source === 'upload' ? <div className="form-grid">
        <label>Upload resume *<input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" required onChange={(event) => setFile(event.target.files?.[0] || null)} /><small className="muted">PDF, DOCX, or TXT · 10 MB maximum. Scanned image-only PDFs are not supported.</small></label>
        <label>Candidate type<select value={profileType} onChange={(event) => setProfileType(event.target.value as 'fresher' | 'experienced')}><option value="fresher">Fresher</option><option value="experienced">Experienced</option></select></label>
        <label>Target role <span className="muted">(optional)</span><input maxLength={200} value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="e.g. Product Designer" /></label>
      </div> : <label>Resume<select value={resumeId} onChange={(event) => setResumeId(event.target.value)}><option value="">Select a resume</option>{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.title}{resume.target_role ? ` · ${resume.target_role}` : ''}</option>)}</select></label>}
      <label>Job description <span className="muted">(optional; improves role-specific scoring)</span><textarea rows={7} maxLength={20000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Paste a job description for role-specific ATS results, or leave blank for a baseline score…" /></label>
      <div className="form-footer"><span className="character-count">{description.length.toLocaleString()} / 20,000</span><button className="button button-primary" disabled={loading || (source === 'upload' ? !file : !resumeId)}>{loading ? 'Analyzing…' : 'Analyze resume'}</button></div>
    </form>
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {analysis && <ATSResult result={analysis} resumeId={analyzedResumeId} onOptimize={onOptimize} />}
  </div>
}

function ATSResult({ result, resumeId, onOptimize }: { result: ResumeAnalysis; resumeId: string; onOptimize?: (resumeId: string) => void }) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const download = async (format: 'pdf' | 'docx') => {
    setDownloading(true)
    setError('')
    try {
      const content = format === 'pdf' ? await downloadResume(resumeId) : await downloadResumeDocx(resumeId)
      const url = URL.createObjectURL(content)
      const link = document.createElement('a')
      link.href = url
      link.download = `resume.${format}`
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to download ${format.toUpperCase()}.`)
    } finally { setDownloading(false) }
  }
  return <div className="results"><section className="panel score-panel"><div className="score-ring" style={{ '--score': `${Math.max(0, Math.min(100, result.match_score))}%` } as CSSProperties}><strong>{Math.round(result.match_score)}<small>%</small></strong></div><div className="score-copy"><span className="eyebrow">ATS READINESS</span><h2>{result.score_label}</h2><p>{result.summary}</p><div className="button-row score-actions"><button className="button button-primary" onClick={() => onOptimize?.(resumeId)}>Optimize this resume</button><button className="button button-secondary" disabled={downloading} onClick={() => void download('pdf')}>Download PDF</button><button className="button button-secondary" disabled={downloading} onClick={() => void download('docx')}>Download DOCX</button></div>{error && <p className="notice notice-error" role="alert">{error}</p>}</div></section>
    <section className="panel"><div className="panel-title"><div><h2>Score breakdown</h2><p>Category scores from the backend analysis.</p></div></div><div className="breakdown-list">{result.score_breakdown.map((entry) => <div className="breakdown-row" key={entry.category}><div><strong>{entry.category}</strong><small>{entry.details}</small></div><div className="breakdown-value"><div className="progress-track"><span style={{ width: `${Math.max(0, Math.min(100, entry.score))}%` }} /></div><strong>{Math.round(entry.score)}%</strong></div></div>)}</div></section>
    <div className="result-grid"><ListPanel title="Matched keywords" values={result.matched_keywords} /><ListPanel title="Missing keywords" values={result.missing_keywords} tone="warning" /><ListPanel title="Matched skills" values={result.matched_skills} /><ListPanel title="Missing skills" values={result.missing_skills} tone="warning" /><ListPanel title="Strengths" values={result.strengths} /><ListPanel title="Areas to improve" values={[...result.weaknesses, ...result.recommendations]} tone="warning" /></div>
  </div>
}

function ListPanel({ title, values, tone }: { title: string; values: string[]; tone?: 'warning' }) {
  return <section className={`panel list-panel ${tone || ''}`}><h2>{title}</h2>{values.length ? <ul>{values.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}</ul> : <p className="muted">No items returned.</p>}</section>
}
