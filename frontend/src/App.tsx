import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { ApiError } from './api/client'
import { getCareerProfiles } from './api/careerProfiles'
import { getResumes } from './api/resumes'
import type { CareerProfile, Resume } from './api/types'
import AnalysisPage from './features/ats-analysis/AnalysisPage'
import OptimizationPage from './features/ai-optimization/OptimizationPage'
import ResumeBuilderPage from './features/resume-builder/ResumeBuilderPage'
import ResumeLibraryPage from './features/resume-builder/ResumeLibraryPage'
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
    setMobileMenuOpen(false)
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
  const openBuilder = (resume: Resume) => {
    setSelectedResume(resume)
    navigate('builder-edit')
  }
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
  const openOptimization = (resumeId: string) => {
    const resume = resumes.find((item) => item.id === resumeId)
    if (resume) setSelectedResume(resume)
    navigate('optimization')
  }
  const selectedProfile = selectedResume
    ? profiles.find((profile) => profile.id === selectedResume.career_profile_id) || null
    : null
  const activeFeature = page === 'builder-edit' || page === 'preview'
    ? 'builder'
    : page === 'optimization'
      ? 'ats'
      : page === 'tailoring'
        ? 'tailoring'
        : page

  return <div className="app-shell">
    {mobileMenuOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} />}
    <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#ats" onClick={(event) => { event.preventDefault(); navigateFeature('ats') }}>
        <span className="brand-mark">M</span><span><strong>MentorMuni</strong><small>RESUME WORKSPACE</small></span>
      </a>
      <div className="nav-group">
        <div className="nav-label">FEATURES</div>
        <nav>{navigation.map((entry) =>
          <button key={entry.id} className={`nav-item ${activeFeature === entry.id ? 'active' : ''}`} onClick={() => navigateFeature(entry.id)} aria-current={activeFeature === entry.id ? 'page' : undefined}>
            <span className="nav-icon">{entry.icon}</span><span>{entry.label}</span>{activeFeature === entry.id && <i />}
          </button>)}</nav>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-tip"><span>✦</span><strong>Make every application count.</strong><p>Build, analyse, and tailor your resume.</p></div>
        <div className="workspace-user"><span className="avatar">M</span><span><strong>My workspace</strong><small>Resume tools</small></span></div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation">☰</button><div className="breadcrumb"><span>Features</span><span>/</span><strong>{title}</strong></div><div className="topbar-right"><span className="workspace-badge">RESUME WORKSPACE</span><span className="avatar top-avatar">M</span></div></header>
      <div className="page-content">
        {error && <div className="notice notice-error global-notice" role="alert"><span>{error}</span><button className="text-button" onClick={() => void refreshWorkspace().catch((cause: unknown) => setError(getErrorMessage(cause)))}>Retry</button></div>}
        {loading ? <div className="panel empty-state loading-panel"><span className="spinner" /><p>Loading resumes…</p></div> : <>
          {page === 'ats' && <AnalysisPage key={analysisResumeId || 'upload'} resumes={resumes} initialResumeId={analysisResumeId || undefined} onResumeImported={handleResumeImported} onOptimize={openOptimization} />}
          {page === 'builder' && <ResumeLibraryPage resumes={resumes} onChanged={refreshWorkspace} onBuild={openBuilder} onPreview={openPreview} />}
          {page === 'builder-edit' && (selectedResume && selectedProfile
            ? <ResumeBuilderPage resume={selectedResume} profile={selectedProfile} onPreview={() => openPreview(selectedResume)} onResumeChanged={(resume) => { setSelectedResume(resume); navigate('builder') }} />
            : <SelectionEmpty title="Select a resume to edit" description="Choose a resume in the builder to add and organize sections." onClick={() => navigate('builder')} button="Open resume builder" />)}
          {page === 'preview' && (selectedResume
            ? <ResumePreviewPage resume={selectedResume} onResumeChanged={(resume) => { setSelectedResume(resume); setResumes((current) => current.map((item) => item.id === resume.id ? resume : item)) }} onBack={() => navigate('builder-edit')} />
            : <SelectionEmpty title="Select a resume to preview" description="Choose a resume in the builder to preview or download it." onClick={() => navigate('builder')} button="Open resume builder" />)}
          {page === 'optimization' && <OptimizationPage key="optimization" mode="optimization" resumes={resumes} initialResumeId={selectedResume?.id} onResumeImported={handleResumeImported} onPreview={openPreview} onRecheck={openAnalyzer} />}
          {page === 'tailoring' && <OptimizationPage key="tailoring" mode="tailoring" resumes={resumes} onResumeImported={handleResumeImported} onPreview={openPreview} onRecheck={openAnalyzer} />}
        </>}
        <footer className="page-footer"><span>MentorMuni Resume Workspace</span><span>Analyse · Build · Tailor</span></footer>
      </div>
    </main>
  </div>
}

function SelectionEmpty({ title, description, button, onClick }: { title: string; description: string; button: string; onClick: () => void }) {
  return <div className="panel empty-state feature-page"><h2>{title}</h2><p>{description}</p><button className="button button-primary" onClick={onClick}>{button}</button></div>
}

export default App
