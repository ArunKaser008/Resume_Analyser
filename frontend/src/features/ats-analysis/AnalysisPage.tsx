import { useMemo, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { createBulletOverride } from '../../api/resumeContent'
import { getContentOverrides } from '../../api/optimization'
import {
  downloadResume,
  downloadResumeDocx,
  finalizeResumeChanges,
  importResume,
} from '../../api/resumes'
import { analyzeResume } from '../../api/resumeAnalysis'
import type { CareerProfile, ProfileType, Resume, ResumeAnalysis, ResumeContentOverride, ResumeParseResponse } from '../../api/types'
import './ats-analysis.css'
import DashboardPage from '../../pages/DashboardPage'
import BulletOptimizerModal from '../resume-builder/BulletOptimizerModal'
import ATSEmulatorView from './ATSEmulatorView'
import ParsedDataPreview from './ParsedDataPreview'
import ProofOfWorkDashboard from './ProofOfWorkDashboard'
import ResumeUploader from './ResumeUploader'

export default function AnalysisPage({ resumes, profiles, initialResumeId, onResumeImported, onResumeFinalized }: {
  resumes: Resume[]
  profiles: CareerProfile[]
  initialResumeId?: string
  onResumeImported?: (resume: Resume) => Promise<void>
  onResumeFinalized?: (resume: Resume) => Promise<void>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ResumeParseResponse | null>(null)
  const [bulletText, setBulletText] = useState('')
  const [bulletOptimizerOpen, setBulletOptimizerOpen] = useState(false)
  const [profileType, setProfileType] = useState<ProfileType>('experienced')
  const [targetRole, setTargetRole] = useState('')
  const [analyzedResumeId, setAnalyzedResumeId] = useState(initialResumeId || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null)
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

  const finalize = async (action: 'update_existing' | 'save_copy') => {
    setSavingAction(true)
    setError('')
    setNotice('')
    try {
      const result = await finalizeResumeChanges(analyzedResumeId, action)
      setAnalyzedResumeId(result.resume.id)
      setDraftOverrides([])
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

  const applyOptimizedBullet = async (suggestedText: string) => {
    const updated = await createBulletOverride(analyzedResumeId, bulletText, suggestedText)
    setDraftOverrides((current) => {
      const withoutTarget = current.filter((item) => item.field_name !== 'source_text')
      return [...withoutTarget, updated]
    })
    setBulletOptimizerOpen(false)
    setNotice('Optimized bullet added as a draft. Finalize the draft to save it to your resume.')
  }

  const refreshDrafts = async () => {
    const overrides = await getContentOverrides(analyzedResumeId)
    setDraftOverrides(overrides.filter((item) => item.is_draft))
    setNotice('The suggested change was added as a draft. Finalize the draft to save it to your resume.')
  }

  return <div className="feature-page">
    <div className="page-heading"><div><div className="eyebrow">FEATURE 01</div><h1>ATS resume analyser</h1><p>Upload a resume to parse it, simulate ATS screening, and optimize resume content.</p></div></div>
    {!initialResumeId && <form className="panel analysis-form" onSubmit={(event) => void analyze(event)}>
      <ResumeUploader onFileSelected={setFile} onParsed={setParseResult} />
      <div className="form-grid">
        <label>Candidate type<select value={profileType} onChange={(event) => { const type = event.target.value as ProfileType; setProfileType(type); if (type === 'student') setTargetRole('') }}><option value="student">Student</option><option value="fresher">Fresher</option><option value="experienced">Experienced</option></select></label>
        {profileType !== 'student' && <label>Target role <span className="muted">(optional)</span><input maxLength={200} value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="e.g. Product Designer" /></label>}
      </div>
      <div className="form-footer"><span className="muted">Upload a resume for parsing and a baseline ATS analysis.</span><button className="button button-primary" disabled={loading || !file}>{loading ? 'Analyzing…' : 'Analyze resume'}</button></div>
    </form>}
    {initialResumeId && <section className="panel analysis-form"><p>Rechecking the selected resume, including any unsaved draft changes.</p><button className="button button-primary" disabled={loading} onClick={() => void analyze()}>{loading ? 'Analyzing…' : 'Recheck ATS score'}</button></section>}
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {notice && <div className="notice notice-success" role="status">{notice}</div>}
    {parseResult && <ParsedDataPreview key={parseResult.parse_id} result={parseResult} />}
    {analysis && <div className="button-row ats-result-actions">
      {draftOverrides.length > 0 && <span className="status-pill">Draft changes not saved</span>}
      <button className="button button-secondary" disabled={downloading || draftOverrides.length > 0} onClick={() => void download('pdf')}>Download PDF</button>
      <button className="button button-secondary" disabled={downloading || draftOverrides.length > 0} onClick={() => void download('docx')}>Download DOCX</button>
      {draftOverrides.length > 0 && <span className="muted">Save or discard your draft changes before downloading.</span>}
    </div>}
    {draftOverrides.length > 0 && <section className="panel">
      <div className="panel-title"><div><span className="eyebrow">DRAFT CHANGES</span><h2>Save your resume updates</h2><p>Updating the existing resume replaces its current content. Saving a copy leaves the original unchanged.</p></div></div>
      <div className="button-row">
        <button className="button button-primary" disabled={savingAction} onClick={() => void finalize('update_existing')}>{savingAction ? 'Saving…' : 'Update existing resume'}</button>
        <button className="button button-secondary" disabled={savingAction || savedCopies >= 2} onClick={() => void finalize('save_copy')}>{savingAction ? 'Saving…' : `Save as a copy (${Math.max(0, 2 - savedCopies)} remaining)`}</button>
      </div>
      {savedCopies >= 2 && <p className="muted">Maximum of two saved copies has been reached for this resume.</p>}
    </section>}
    {parseResult && <ProofOfWorkDashboard key={parseResult.parse_id} parsedData={parseResult.parsed_data} />}
    {currentResume && <ATSEmulatorView key={currentResume.id} resume={currentResume} />}
    {analysis && <section className="panel bullet-optimizer-launch">
      <div className="panel-title"><div><span className="eyebrow">GOOGLE XYZ FORMULA</span><h2>Optimize a resume bullet</h2><p>Generate three evidence-preserving rewrites for a bullet in your resume.</p></div></div>
      <label htmlFor="bullet-optimizer-source">Original bullet</label>
      <textarea id="bullet-optimizer-source" rows={3} maxLength={2000} value={bulletText} onChange={(event) => setBulletText(event.target.value)} placeholder="Paste an exact bullet from the uploaded resume." />
      <div className="form-footer"><span className="muted">Applying a rewrite creates an unsaved draft.</span><button className="button button-secondary" disabled={!bulletText.trim() || draftOverrides.length > 0} onClick={() => setBulletOptimizerOpen(true)}>Optimize bullet</button></div>
    </section>}
    {analyzedResumeId && analysis && <DashboardPage key={`dashboard-${analyzedResumeId}`} resumeId={analyzedResumeId} onDraftChanged={refreshDrafts} />}
    {bulletOptimizerOpen && <BulletOptimizerModal
      originalBullet={bulletText}
      targetRole={currentResume?.target_role || targetRole || currentProfile?.professional_title || 'Software Engineer'}
      seniorityLevel={profileType === 'experienced' ? 'SENIOR' : 'FRESHER'}
      onClose={() => setBulletOptimizerOpen(false)}
      onApply={applyOptimizedBullet}
    />}
  </div>
}
