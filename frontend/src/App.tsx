import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

import { ApiError } from './api/client'
import {
  createCareerProfile,
  getCareerProfiles,
} from './api/careerProfiles'
import { createResume, getResumes } from './api/resumes'

import type {
  CareerProfile,
  CareerProfileCreate,
  ProfileType,
  Resume,
  ResumeTemplate,
} from './api/types'

type Page = 'overview' | 'resumes' | 'ats' | 'matching' | 'optimization'

const navigation: { id: Page; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◫' },
  { id: 'resumes', label: 'My resumes', icon: '▤' },
  { id: 'ats', label: 'ATS analysis', icon: '◎' },
  { id: 'matching', label: 'Job matching', icon: '⌕' },
  { id: 'optimization', label: 'AI optimization', icon: '✧' },
]

const emptyProfile: CareerProfileCreate = {
  profile_type: 'experienced',
  full_name: '',
  email: '',
  phone: '',
  city: '',
  professional_title: '',
  summary: '',
  linkedin_url: '',
  github_url: '',
  portfolio_url: '',
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

function App() {
  const [activePage, setActivePage] = useState<Page>('overview')
  const [profiles, setProfiles] = useState<CareerProfile[]>([])
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [profileForm, setProfileForm] =
    useState<CareerProfileCreate>(emptyProfile)
  const [resumeTitle, setResumeTitle] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [template, setTemplate] = useState<ResumeTemplate>('modern')
  const [selectedProfile, setSelectedProfile] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [profileData, resumeData] = await Promise.all([
        getCareerProfiles(),
        getResumes(),
      ])

      setProfiles(profileData)
      setResumes(resumeData)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const filteredResumes = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return resumes

    return resumes.filter((resume) =>
      `${resume.title} ${resume.target_role || ''}`
        .toLowerCase()
        .includes(query),
    )
  }, [resumes, search])

  const openCreate = () => {
    setProfileForm(emptyProfile)
    setResumeTitle('')
    setTargetRole('')
    setTemplate('modern')
    setSelectedProfile(profiles[0]?.id || '')
    setStep(profiles.length ? 2 : 1)
    setShowCreate(true)
    setError('')
  }

  const closeCreate = () => {
    if (submitting) return
    setShowCreate(false)
  }

  const updateProfile = (
    field: keyof CareerProfileCreate,
    value: string,
  ) => {
    setProfileForm((current) => ({ ...current, [field]: value }))
  }

  const submitProfile = async () => {
    if (!profileForm.full_name.trim()) {
      setError('Please enter your full name.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const profile = await createCareerProfile({
        ...profileForm,
        full_name: profileForm.full_name.trim(),
      })

      setProfiles((current) => [...current, profile])
      setSelectedProfile(profile.id)
      setStep(2)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const submitResume = async () => {
    if (!selectedProfile) {
      setError('Please select a career profile.')
      return
    }

    if (!resumeTitle.trim()) {
      setError('Please enter a resume name.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const resume = await createResume({
        career_profile_id: selectedProfile,
        title: resumeTitle.trim(),
        target_role: targetRole.trim() || undefined,
        template_name: template,
        is_primary: resumes.length === 0,
      })

      setResumes((current) => [resume, ...current])
      setShowCreate(false)
      setActivePage('resumes')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const pageTitle = navigation.find((item) => item.id === activePage)?.label

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">M</div>
          <div>
            <div className="brand-name">MentorMuni</div>
            <div className="brand-caption">RESUME INTELLIGENCE</div>
          </div>
        </div>

        <div className="workspace-label">MY WORKSPACE</div>

        <nav className="navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'overview' && (
                <span className="nav-active-dot" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-promo">
            <div className="promo-icon">✦</div>
            <h3>Make every application count.</h3>
            <p>Build a stronger resume with measurable improvements.</p>
            <button onClick={() => setActivePage('optimization')}>
              Explore AI tools <span>↗</span>
            </button>
          </div>

          <div className="sidebar-help">
            <span className="help-icon">?</span>
            <span>Help & support</span>
          </div>

          <div className="user-profile">
            <div className="avatar">V</div>
            <div className="user-details">
              <strong>My workspace</strong>
              <span>Personal account</span>
            </div>
            <span className="user-menu">•••</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{pageTitle}</strong>
          </div>

          <div className="topbar-right">
            <span className="workspace-plan">PERSONAL WORKSPACE</span>
            <button className="notification-button" aria-label="Notifications">
              ♧
            </button>
            <div className="avatar top-avatar">V</div>
          </div>
        </header>

        <div className="page-content">
          {error && !showCreate && (
            <div className="alert-error">
              <span>{error}</span>
              <button onClick={() => void loadDashboard()}>Retry</button>
            </div>
          )}

          <section className="welcome-section">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                YOUR CAREER WORKSPACE
              </div>
              <h1>
                {activePage === 'overview'
                  ? 'Build a resume that moves you forward.'
                  : pageTitle}
              </h1>
              <p className="welcome-description">
                {activePage === 'overview'
                  ? 'Turn your experience into a compelling story. Measure, improve and prove your career readiness.'
                  : 'Your career information and resume workspace, all in one place.'}
              </p>
            </div>

            <button className="primary-button" onClick={openCreate}>
              <span>＋</span> Create resume
            </button>
          </section>

          <div className="journey-strip">
            <div className="journey-step">
              <span className="journey-number">01</span>
              <div>
                <strong>BUILD</strong>
                <span>Create your career profile and resume</span>
              </div>
            </div>
            <span className="journey-arrow">→</span>
            <div className="journey-step">
              <span className="journey-number">02</span>
              <div>
                <strong>ANALYZE</strong>
                <span>Understand your ATS readiness</span>
              </div>
            </div>
            <span className="journey-arrow">→</span>
            <div className="journey-step">
              <span className="journey-number">03</span>
              <div>
                <strong>IMPROVE</strong>
                <span>Strengthen your resume with AI</span>
              </div>
            </div>
          </div>

          <section className="metrics-grid">
            <MetricCard
              label="CAREER PROFILES"
              value={loading ? '—' : String(profiles.length)}
              note="Your saved profiles"
              icon="◉"
              accent="cyan"
            />
            <MetricCard
              label="RESUMES CREATED"
              value={loading ? '—' : String(resumes.length)}
              note="Your resume library"
              icon="▤"
              accent="green"
            />
            <MetricCard
              label="ATS ANALYSES"
              value="—"
              note="Analysis history"
              icon="◎"
              accent="purple"
            />
            <MetricCard
              label="JOB MATCHES"
              value="—"
              note="Matching activity"
              icon="⌕"
              accent="blue"
            />
          </section>

          <div className="dashboard-grid">
            <section className="panel resumes-panel">
              <div className="panel-heading">
                <div>
                  <h2>{activePage === 'overview' ? 'Your resumes' : 'Resume library'}</h2>
                  <p>Manage your career documents</p>
                </div>
                <button className="text-button" onClick={() => setActivePage('resumes')}>
                  View all <span>↗</span>
                </button>
              </div>

              <div className="search-box">
                <span>⌕</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search resumes..."
                />
              </div>

              {loading ? (
                <div className="empty-state">
                  <div className="loading-spinner" />
                  <p>Loading your workspace...</p>
                </div>
              ) : filteredResumes.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">▤</div>
                  <h3>{search ? 'No matching resumes' : 'Your resume library is empty'}</h3>
                  <p>
                    {search
                      ? 'Try another search term.'
                      : 'Create your first resume to get started.'}
                  </p>
                  {!search && (
                    <button className="secondary-button" onClick={openCreate}>
                      Create your first resume
                    </button>
                  )}
                </div>
              ) : (
                <div className="resume-list">
                  {filteredResumes.map((resume) => (
                    <div className="resume-row" key={resume.id}>
                      <div className="resume-file-icon">PDF</div>
                      <div className="resume-info">
                        <strong>{resume.title}</strong>
                        <span>{resume.target_role || 'Target role not specified'}</span>
                      </div>
                      <span className="template-tag">
                        {resume.template_name || 'modern'}
                      </span>
                      <span className="resume-status">
                        <i /> Saved
                      </span>
                      <button
                        className="row-menu"
                        title="Resume actions"
                        onClick={() => setActivePage('resumes')}
                      >
                        ↗
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel readiness-panel">
              <div className="panel-heading">
                <div>
                  <h2>Next steps</h2>
                  <p>Move your resume forward</p>
                </div>
                <span className="sparkle">✦</span>
              </div>

              <div className="next-step-list">
                <NextStep
                  number="01"
                  title="Complete your resume"
                  description="Add education, experience and skills."
                  onClick={() => setActivePage('resumes')}
                />
                <NextStep
                  number="02"
                  title="Run an ATS analysis"
                  description="Discover keyword and content gaps."
                  onClick={() => setActivePage('ats')}
                />
                <NextStep
                  number="03"
                  title="Match a job description"
                  description="Measure your fit for a target role."
                  onClick={() => setActivePage('matching')}
                />
                <NextStep
                  number="04"
                  title="Improve with AI"
                  description="Review suggestions and strengthen your story."
                  onClick={() => setActivePage('optimization')}
                />
              </div>
            </section>
          </div>

          <section className="bottom-insight">
            <div className="insight-symbol">✧</div>
            <div>
              <strong>Your next opportunity starts with a stronger story.</strong>
              <p>Build → Analyze → Improve → Apply. Keep every improvement grounded in your real experience.</p>
            </div>
            <span className="insight-decoration">MENTORMUNI</span>
          </section>
        </div>
      </main>

      {showCreate && (
        <div className="modal-backdrop" onMouseDown={closeCreate}>
          <section
            className="create-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="eyebrow">NEW RESUME</div>
                <h2>{step === 1 ? 'Create your career profile' : 'Set up your resume'}</h2>
                <p>
                  {step === 1
                    ? 'Start with the information that defines your professional identity.'
                    : 'Choose a name and target role for this resume.'}
                </p>
              </div>
              <button className="modal-close" onClick={closeCreate} aria-label="Close">
                ×
              </button>
            </div>

            <div className="step-indicator">
              <span className="step-active">1. Career profile</span>
              <span className={step === 2 ? 'step-active' : ''}>2. Resume details</span>
            </div>

            {error && <div className="alert-error modal-error">{error}</div>}

            {step === 1 ? (
              <div className="modal-form">
                <label>
                  Profile type
                  <select
                    value={profileForm.profile_type}
                    onChange={(event) =>
                      updateProfile('profile_type', event.target.value as ProfileType)
                    }
                  >
                    <option value="experienced">Experienced professional</option>
                    <option value="fresher">Fresher / Student</option>
                  </select>
                </label>

                <label>
                  Full name *
                  <input
                    value={profileForm.full_name}
                    onChange={(event) => updateProfile('full_name', event.target.value)}
                    placeholder="Your full name"
                  />
                </label>

                <div className="form-two-columns">
                  <label>
                    Email
                    <input
                      type="email"
                      value={profileForm.email || ''}
                      onChange={(event) => updateProfile('email', event.target.value)}
                      placeholder="you@example.com"
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      value={profileForm.phone || ''}
                      onChange={(event) => updateProfile('phone', event.target.value)}
                      placeholder="+91..."
                    />
                  </label>
                </div>

                <div className="form-two-columns">
                  <label>
                    City
                    <input
                      value={profileForm.city || ''}
                      onChange={(event) => updateProfile('city', event.target.value)}
                      placeholder="Your city"
                    />
                  </label>
                  <label>
                    Professional title
                    <input
                      value={profileForm.professional_title || ''}
                      onChange={(event) =>
                        updateProfile('professional_title', event.target.value)
                      }
                      placeholder="e.g. Software Engineer"
                    />
                  </label>
                </div>

                <label>
                  Professional summary
                  <textarea
                    value={profileForm.summary || ''}
                    onChange={(event) => updateProfile('summary', event.target.value)}
                    placeholder="A short introduction about your professional background..."
                    rows={3}
                  />
                </label>

                <div className="form-two-columns">
                  <label>
                    LinkedIn URL
                    <input
                      value={profileForm.linkedin_url || ''}
                      onChange={(event) =>
                        updateProfile('linkedin_url', event.target.value)
                      }
                      placeholder="https://linkedin.com/in/..."
                    />
                  </label>
                  <label>
                    GitHub URL
                    <input
                      value={profileForm.github_url || ''}
                      onChange={(event) =>
                        updateProfile('github_url', event.target.value)
                      }
                      placeholder="https://github.com/..."
                    />
                  </label>
                </div>

                <div className="modal-actions">
                  <button className="secondary-button" onClick={closeCreate}>
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    disabled={submitting || !profileForm.full_name.trim()}
                    onClick={() => void submitProfile()}
                  >
                    {submitting ? 'Saving...' : 'Save & continue'}
                    <span>→</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="modal-form">
                {profiles.length > 0 && (
                  <label>
                    Career profile
                    <select
                      value={selectedProfile}
                      onChange={(event) => setSelectedProfile(event.target.value)}
                    >
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label>
                  Resume name *
                  <input
                    value={resumeTitle}
                    onChange={(event) => setResumeTitle(event.target.value)}
                    placeholder="e.g. Software Engineer Resume"
                  />
                </label>

                <label>
                  Target role
                  <input
                    value={targetRole}
                    onChange={(event) => setTargetRole(event.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                  />
                </label>

                <label>
                  Resume template
                  <select
                    value={template}
                    onChange={(event) =>
                      setTemplate(event.target.value as ResumeTemplate)
                    }
                  >
                    <option value="modern">Modern</option>
                    <option value="professional">Professional</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </label>

                <div className="modal-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </button>
                  <button
                    className="primary-button"
                    disabled={submitting || !resumeTitle.trim() || !selectedProfile}
                    onClick={() => void submitResume()}
                  >
                    {submitting ? 'Creating...' : 'Create resume'}
                    <span>→</span>
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  note,
  icon,
  accent,
}: {
  label: string
  value: string
  note: string
  icon: string
  accent: string
}) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${accent}`}>{icon}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </div>
  )
}

function NextStep({
  number,
  title,
  description,
  onClick,
}: {
  number: string
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button className="next-step" onClick={onClick}>
      <span className="next-step-number">{number}</span>
      <span className="next-step-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className="next-step-arrow">↗</span>
    </button>
  )
}

export default App