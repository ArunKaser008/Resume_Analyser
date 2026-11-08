
import { useMemo, useState, type FormEvent } from 'react'
import './App.css'

type Resume = {
  id: number
  name: string
  role: string
  updated: string
  score: number
  status: 'Ready' | 'Needs improvement' | 'Draft'
}

const initialResumes: Resume[] = [
  {
    id: 1,
    name: 'Software Engineer Resume',
    role: 'Software Development',
    updated: 'Updated today',
    score: 86,
    status: 'Ready',
  },
  {
    id: 2,
    name: 'Senior SDET Resume',
    role: 'QA Automation',
    updated: 'Updated yesterday',
    score: 78,
    status: 'Needs improvement',
  },
  {
    id: 3,
    name: 'Data Engineer Resume',
    role: 'Data Engineering',
    updated: 'Updated 3 days ago',
    score: 0,
    status: 'Draft',
  },
]

const navigation = [
  { label: 'Overview', icon: '⌂', group: 'WORKSPACE' },
  { label: 'My resumes', icon: '▤', group: 'WORKSPACE' },
  { label: 'ATS analysis', icon: '◎', group: 'TOOLS' },
  { label: 'Job matching', icon: '⌕', group: 'TOOLS' },
  { label: 'AI optimization', icon: '✳', group: 'TOOLS' },
]

function App() {
  const [activePage, setActivePage] = useState('Overview')
  const [search, setSearch] = useState('')
  const [resumes, setResumes] = useState(initialResumes)
  const [showCreate, setShowCreate] = useState(false)
  const [newResumeName, setNewResumeName] = useState('')

  const filteredResumes = useMemo(
    () =>
      resumes.filter((resume) =>
        `${resume.name} ${resume.role}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [resumes, search],
  )

  const pageDescriptions: Record<string, string> = {
    Overview: 'Your career story, stronger.',
    'My resumes': 'Create, manage and improve your resumes.',
    'ATS analysis': 'Understand how your resume performs with applicant tracking systems.',
    'Job matching': 'See how closely your experience matches a job description.',
    'AI optimization': 'Turn insights into stronger, more relevant resume content.',
  }

  function createResume(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newResumeName.trim()) return

    setResumes((current) => [
      {
        id: Date.now(),
        name: newResumeName.trim(),
        role: 'New resume',
        updated: 'Created just now',
        score: 0,
        status: 'Draft',
      },
      ...current,
    ])
    setNewResumeName('')
    setShowCreate(false)
    setActivePage('My resumes')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setActivePage('Overview')}>
          <span className="brand-mark"><span>M</span></span>
          <span className="brand-name">Mentor<span>Muni</span></span>
        </a>

        <div className="workspace-label">YOUR WORKSPACE</div>
        <div className="profile-switcher">
          <div className="avatar">V</div>
          <div className="profile-copy">
            <strong>My workspace</strong>
            <span>Personal account</span>
          </div>
          <span className="switcher-arrow">⌄</span>
        </div>

        <nav className="side-navigation" aria-label="Main navigation">
          {['WORKSPACE', 'TOOLS'].map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-heading">{group}</div>
              {navigation
                .filter((item) => item.group === group)
                .map((item) => (
                  <button
                    className={`nav-item ${activePage === item.label ? 'active' : ''}`}
                    key={item.label}
                    onClick={() => setActivePage(item.label)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.label === 'AI optimization' && (
                      <span className="new-tag">AI</span>
                    )}
                  </button>
                ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon">✦</div>
            <strong>Make every application count.</strong>
            <p>Get more insights and build a stronger career profile.</p>
            <button onClick={() => setActivePage('AI optimization')}>
              Explore features <span>→</span>
            </button>
          </div>
          <button className="help-link" onClick={() => setActivePage('Overview')}>
            <span>?</span> Help & support
          </button>
          <div className="sidebar-footer">A MentorMuni product</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span><span className="breadcrumb-separator">/</span>
            <strong>{activePage}</strong>
          </div>
          <div className="topbar-actions">
            <span className="plan-label"><span className="plan-dot" /> Free workspace</span>
            <button className="icon-button" aria-label="Notifications">♧</button>
            <button className="user-avatar" aria-label="User profile">V</button>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-section">
            <div>
              <div className="eyebrow"><span /> MEASURE <b>→</b> IMPROVE <b>→</b> PROVE</div>
              <h1>{activePage === 'Overview' ? <>Your career story,<br /><span>stronger.</span></> : activePage}</h1>
              <p className="welcome-description">{pageDescriptions[activePage]}</p>
            </div>
            <button className="primary-button" onClick={() => setShowCreate(true)}>
              <span>＋</span> Create resume
            </button>
          </section>

          <section className="metrics-grid" aria-label="Resume overview">
            <article className="metric-card featured-metric">
              <div className="metric-topline">
                <span>OVERALL RESUME SCORE</span>
                <span className="metric-icon cyan">◎</span>
              </div>
              <div className="metric-value">82<span>/100</span></div>
              <div className="metric-bottom">
                <div className="progress-track"><div style={{ width: '82%' }} /></div>
                <span className="metric-caption">Good foundation</span>
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-topline">
                <span>RESUMES CREATED</span>
                <span className="metric-icon blue">▤</span>
              </div>
              <div className="metric-value">{resumes.length.toString().padStart(2, '0')}</div>
              <div className="metric-caption">Across your workspace</div>
            </article>

            <article className="metric-card">
              <div className="metric-topline">
                <span>ATS READINESS</span>
                <span className="metric-icon green">✓</span>
              </div>
              <div className="metric-value">76<span>%</span></div>
              <div className="metric-caption">Sample dashboard metric</div>
            </article>

            <article className="metric-card">
              <div className="metric-topline">
                <span>JOB MATCHES</span>
                <span className="metric-icon purple">⌕</span>
              </div>
              <div className="metric-value">04</div>
              <div className="metric-caption">Sample dashboard metric</div>
            </article>
          </section>

          <section className="content-grid">
            <div className="panel resumes-panel">
              <div className="panel-header">
                <div>
                  <div className="section-kicker">YOUR DOCUMENTS</div>
                  <h2>Recent resumes</h2>
                  <p>Keep your professional story up to date.</p>
                </div>
                <button className="text-button" onClick={() => setActivePage('My resumes')}>
                  View all <span>→</span>
                </button>
              </div>

              <div className="resume-toolbar">
                <div className="search-box">
                  <span>⌕</span>
                  <input
                    aria-label="Search resumes"
                    placeholder="Search your resumes..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <span className="document-count">{filteredResumes.length} documents</span>
              </div>

              <div className="resume-list">
                {filteredResumes.length === 0 ? (
                  <div className="empty-state">No resumes match your search.</div>
                ) : (
                  filteredResumes.map((resume) => (
                    <article className="resume-row" key={resume.id}>
                      <div className="document-icon"><span>▤</span></div>
                      <div className="resume-info">
                        <strong>{resume.name}</strong>
                        <span>{resume.role} <i>·</i> {resume.updated}</span>
                      </div>
                      <div className="resume-score">
                        {resume.score > 0 ? (
                          <><strong>{resume.score}</strong><span>Score</span></>
                        ) : (
                          <span className="not-scored">Not scored</span>
                        )}
                      </div>
                      <span className={`status-pill ${resume.status.toLowerCase().replace(' ', '-')}`}>
                        <i />{resume.status}
                      </span>
                      <button className="more-button" aria-label={`More options for ${resume.name}`}>···</button>
                    </article>
                  ))
                )}
              </div>

              <button className="create-another" onClick={() => setShowCreate(true)}>
                <span>＋</span> Create another resume
              </button>
            </div>

            <div className="right-column">
              <section className="panel readiness-panel">
                <div className="section-kicker">YOUR NEXT STEP</div>
                <h2>Build your readiness</h2>
                <p>Small improvements can make a meaningful difference to your next application.</p>
                <div className="readiness-item">
                  <div className="readiness-symbol cyan">◎</div>
                  <div><strong>Run an ATS analysis</strong><span>Find gaps in your resume</span></div>
                  <button onClick={() => setActivePage('ATS analysis')}>→</button>
                </div>
                <div className="readiness-item">
                  <div className="readiness-symbol green">⌕</div>
                  <div><strong>Match a job description</strong><span>See how well you align</span></div>
                  <button onClick={() => setActivePage('Job matching')}>→</button>
                </div>
                <div className="readiness-item">
                  <div className="readiness-symbol purple">✳</div>
                  <div><strong>Optimize with AI</strong><span>Strengthen your resume content</span></div>
                  <button onClick={() => setActivePage('AI optimization')}>→</button>
                </div>
              </section>

              <section className="insight-card">
                <div className="insight-glow" />
                <div className="insight-label"><span>✦</span> THE MENTORMUNI APPROACH</div>
                <h3>Don't just apply.<br /><span>Show your readiness.</span></h3>
                <p>Measure your strengths. Improve your gaps. Prove your potential.</p>
                <div className="insight-steps">
                  <span>01 Measure</span><i>→</i><span>02 Improve</span><i>→</i><span>03 Prove</span>
                </div>
              </section>
            </div>
          </section>

          <footer className="page-footer">
            <span>© 2026 MentorMuni</span>
            <span>Built to help you move forward.</span>
          </footer>
        </div>
      </main>

      {showCreate && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowCreate(false)
        }}>
          <form className="create-modal" onSubmit={createResume}>
            <button type="button" className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            <div className="modal-icon">＋</div>
            <div className="section-kicker">START WITH THE BASICS</div>
            <h2>Create a resume</h2>
            <p>Give this resume a name. You can add your experience and skills next.</p>
            <label htmlFor="resume-name">Resume name</label>
            <input
              id="resume-name"
              autoFocus
              required
              maxLength={80}
              placeholder="e.g. Software Engineer Resume"
              value={newResumeName}
              onChange={(event) => setNewResumeName(event.target.value)}
            />
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="primary-button">Create resume <span>→</span></button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default App
