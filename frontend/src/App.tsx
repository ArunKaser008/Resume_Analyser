import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import mentorMuniLogo from './assets/mentormuni-logo.png'
import { ApiError } from './api/client'
import { getCareerProfiles } from './api/careerProfiles'
import { getResumes } from './api/resumes'
import type { CareerProfile, Resume } from './api/types'
import AnalysisPage from './features/ats-analysis/AnalysisPage'
import OptimizationPage from './features/ai-optimization/OptimizationPage'
import ResumeBuilderPage from './features/resume-builder/ResumeBuilderPage'
import ResumePreviewPage from './features/resume-builder/ResumePreviewPage'

type Page = 'ats' | 'builder' | 'builder-edit' | 'preview' | 'optimization' | 'tailoring'
type FeaturePage = Extract<Page, 'ats' | 'builder' | 'tailoring'>

const navigation: { id: FeaturePage; label: string; icon: string }[] = [
  { id: 'ats', label: 'ATS resume analyser', icon: '◌' },
  { id: 'builder', label: 'Resume builder', icon: '✎' },
  { id: 'tailoring', label: 'JD resume update', icon: '↗' },
]

const validPages = new Set<Page>(['ats', 'builder', 'builder-edit', 'preview', 'optimization', 'tailoring'])

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

function App() {
  const initialHash = window.location.hash.slice(1) as Page
  const [page, setPage] = useState<Page>(validPages.has(initialHash) ? initialHash : 'ats')
  const [profiles, setProfiles] = useState<CareerProfile[]>([])
  const [resumes, setResumes] = useState<Resume[]>([])
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null)
  const [analysisResumeId, setAnalysisResumeId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshWorkspace = useCallback(async () => {
    setError('')
    const [profileData, resumeData] = await Promise.all([getCareerProfiles(), getResumes()])
    setProfiles(profileData)
    setResumes(resumeData)
    setSelectedResume((current) => current ? resumeData.find((resume) => resume.id === current.id) || null : null)
  }, [])

  useEffect(() => {
    let active = true
    void Promise.all([getCareerProfiles(), getResumes()])
      .then(([profileData, resumeData]) => {
        if (!active) return
        setProfiles(profileData)
        setResumes(resumeData)
      })
      .catch((cause: unknown) => { if (active) setError(getErrorMessage(cause)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const syncPage = () => {
      const requested = window.location.hash.slice(1) as Page | 'overview' | 'resumes' | 'profiles'
      const aliases: Record<string, Page> = { overview: 'ats', resumes: 'builder', profiles: 'ats' }
      const next = aliases[requested] || requested
      if (validPages.has(next as Page)) setPage(next as Page)
      else setPage('ats')
    }
    window.addEventListener('hashchange', syncPage)
    return () => window.removeEventListener('hashchange', syncPage)
  }, [])

  const navigate = (next: Page) => {
    setPage(next)
    if (window.location.hash !== `#${next}`) window.history.pushState(null, '', `#${next}`)
    setError('')
  }
  const navigateFeature = (next: FeaturePage) => {
    if (next === 'ats') setAnalysisResumeId('')
    navigate(next)
  }
  const title = useMemo(() => {
    if (page === 'builder-edit' || page === 'preview') return 'Resume builder'
    if (page === 'optimization') return 'AI suggestions'
    return navigation.find((entry) => entry.id === page)?.label || 'JD resume update'
  }, [page])
  const openPreview = (resume: Resume) => {
    setSelectedResume(resume)
    navigate('preview')
  }
  const handleResumeImported = async (resume: Resume) => {
    await refreshWorkspace()
    setSelectedResume(resume)
  }
  const openAnalyzer = (resumeId: string) => {
    const resume = resumes.find((item) => item.id === resumeId)
    if (resume) setSelectedResume(resume)
    setAnalysisResumeId(resumeId)
    navigate('ats')
  }
  const activeFeature = page === 'builder-edit' || page === 'preview'
    ? 'builder'
    : page === 'optimization'
      ? 'ats'
      : page === 'tailoring'
        ? 'tailoring'
        : page

  const isResumeBuilderFlow = page === 'builder' || page === 'builder-edit'

  return <>
    <header className="site-header">
      <a className="site-brand" href="#ats" onClick={(event) => { event.preventDefault(); navigateFeature('ats') }}>
        <img src={mentorMuniLogo} alt="" /><span>Mentor<strong>Muni</strong></span>
      </a>
      <nav className="site-nav" aria-label="Main navigation">
        {navigation.map((entry) => <button key={entry.id} type="button" className={activeFeature === entry.id ? 'active' : ''} onClick={() => navigateFeature(entry.id)} aria-current={activeFeature === entry.id ? 'page' : undefined}>{entry.label}</button>)}
      </nav>
    </header>
    <div className={`app-shell ${isResumeBuilderFlow ? 'app-shell-builder' : ''}`}>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>Features</span><span>/</span><strong>{title}</strong></div><div className="topbar-right"><span className="workspace-badge">RESUME WORKSPACE</span><span className="avatar top-avatar">M</span></div></header>
      <div className="page-content">
        {error && <div className="notice notice-error global-notice" role="alert"><span>{error}</span><button className="text-button" onClick={() => void refreshWorkspace().catch((cause: unknown) => setError(getErrorMessage(cause)))}>Retry</button></div>}
        {loading ? <div className="panel empty-state loading-panel"><span className="spinner" /><p>Loading resumes…</p></div> : <>
          {page === 'ats' && <AnalysisPage key={analysisResumeId || 'upload'} resumes={resumes} initialResumeId={analysisResumeId || undefined} onResumeImported={handleResumeImported} onResumeFinalized={handleResumeImported} />}
          {(page === 'builder' || page === 'builder-edit') && <ResumeBuilderPage
            resumes={resumes}
            profiles={profiles}
            initialResume={page === 'builder-edit' ? selectedResume || undefined : undefined}
            onChanged={refreshWorkspace}
            onResumeUpdated={(resume) => {
              setSelectedResume(resume)
              setResumes((current) => current.map((item) => item.id === resume.id ? resume : item))
            }}
            onProfileChanged={(profile) => setProfiles((current) => current.map((item) => item.id === profile.id ? profile : item))}
            onPreview={openPreview}
            onAnalyze={openAnalyzer}
          />}
          {page === 'preview' && (selectedResume
            ? <ResumePreviewPage resume={selectedResume} onResumeChanged={(resume) => { setSelectedResume(resume); setResumes((current) => current.map((item) => item.id === resume.id ? resume : item)) }} onBack={() => navigate('builder-edit')} />
            : <SelectionEmpty title="Select a resume to preview" description="Choose a resume in the builder to preview or download it." onClick={() => navigate('builder')} button="Open resume builder" />)}
          {page === 'optimization' && <OptimizationPage key="optimization" mode="optimization" resumes={resumes} initialResumeId={selectedResume?.id} onResumeImported={handleResumeImported} onPreview={openPreview} onRecheck={openAnalyzer} />}
          {page === 'tailoring' && <OptimizationPage key="tailoring" mode="tailoring" resumes={resumes} initialResumeId={selectedResume?.id} onResumeImported={handleResumeImported} onPreview={openPreview} onRecheck={openAnalyzer} />}
        </>}
        <footer className="page-footer"><span>MentorMuni Resume Workspace</span><span>Analyse · Build · Tailor</span></footer>
      </div>
    </main>
    </div>
  </>
}

function SelectionEmpty({ title, description, button, onClick }: { title: string; description: string; button: string; onClick: () => void }) {
  return <div className="panel empty-state feature-page"><h2>{title}</h2><p>{description}</p><button className="button button-primary" onClick={onClick}>{button}</button></div>
}

export default App
