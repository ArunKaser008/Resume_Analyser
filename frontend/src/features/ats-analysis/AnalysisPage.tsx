import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { importResume } from '../../api/resumes'
import type { CareerProfile, ProfileType, Resume, ResumeParseResponse } from '../../api/types'
import DashboardPage from '../../pages/DashboardPage'
import ATSEmulatorView from './ATSEmulatorView'
import ParsedDataPreview from './ParsedDataPreview'
import ProofOfWorkDashboard from './ProofOfWorkDashboard'
import ResumeUploader from './ResumeUploader'

export default function AnalysisPage({ resumes, profiles, initialResumeId, onResumeImported }: {
  resumes: Resume[]
  profiles: CareerProfile[]
  initialResumeId?: string
  onResumeImported?: (resume: Resume) => Promise<void>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [profileType, setProfileType] = useState<ProfileType>('experienced')
  const [targetRole, setTargetRole] = useState('')
  const [analyzedResumeId, setAnalyzedResumeId] = useState(initialResumeId || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [parseResult, setParseResult] = useState<ResumeParseResponse | null>(null)

  const currentResume = resumes.find((resume) => resume.id === analyzedResumeId)
  const currentProfile = currentResume
    ? profiles.find((profile) => profile.id === currentResume.career_profile_id)
    : undefined

  const importAndAnalyze = async (event?: FormEvent) => {
    event?.preventDefault()
    setError('')
    if (!initialResumeId && !file) {
      setError('Select a PDF, DOCX, or TXT resume to continue.')
      return
    }

    setLoading(true)
    try {
      if (!initialResumeId && file) {
        const imported = await importResume(
          file,
          profileType,
          profileType === 'student' ? undefined : targetRole,
        )
        setAnalyzedResumeId(imported.resume.id)
        setFile(null)
        await onResumeImported?.(imported.resume)
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Resume upload could not be completed.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="feature-page">
    <div className="page-heading"><div><div className="eyebrow">FEATURE 01</div><h1>ATS resume analyser</h1><p>Review your parsed resume, proof of work, and ATS-specific recruiter view.</p></div></div>
    {!initialResumeId && <form className="panel analysis-form" onSubmit={(event) => void importAndAnalyze(event)}>
      <ResumeUploader onFileSelected={setFile} onParsed={setParseResult} />
      <div className="form-grid">
        <label>Candidate type<select value={profileType} onChange={(event) => {
          const type = event.target.value as ProfileType
          setProfileType(type)
          if (type === 'student') setTargetRole('')
        }}><option value="student">Student</option><option value="fresher">Fresher</option><option value="experienced">Experienced</option></select></label>
        {profileType !== 'student' && <label>Target role <span className="muted">(optional)</span><input maxLength={200} value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="e.g. Product Designer" /></label>}
      </div>
      <div className="form-footer"><span className="muted">Upload a resume to open its analysis dashboard.</span><button className="button button-primary" disabled={loading || !file}>{loading ? 'Uploading…' : 'Analyze resume'}</button></div>
    </form>}
    {parseResult && <ParsedDataPreview key={parseResult.parse_id} result={parseResult} />}
    {analyzedResumeId && <DashboardPage key={`dashboard-${analyzedResumeId}`} resumeId={analyzedResumeId} />}
    <ProofOfWorkDashboard key={parseResult?.parse_id || 'proof-of-work'} parsedData={parseResult?.parsed_data} />
    {currentResume && currentProfile && <ATSEmulatorView key={currentResume.id} resume={currentResume} profile={currentProfile} />}
    {error && <div className="notice notice-error" role="alert">{error}</div>}
  </div>
}
