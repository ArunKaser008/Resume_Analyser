import { useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { createResume, deleteResume, importResume, updateResume } from '../../api/resumes'
import type { ProfileType, Resume } from '../../api/types'
import mentorMuniLogo from '../../assets/mentormuni-logo.png'
import { getTemplateName, resumeTemplates, type ResumeTemplateCategory, type ResumeTemplateOption } from './resumeTemplates'

interface Props {
  resumes: Resume[]
  onChanged: () => Promise<void>
  onBuild: (resume: Resume) => void
  onPreview: (resume: Resume) => void
}

export default function ResumeLibraryPage({ resumes, onChanged, onBuild, onPreview }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<ResumeTemplateOption | null>(null)
  const [startStep, setStartStep] = useState<'choose' | 'blank' | null>(null)
  const [showResumes, setShowResumes] = useState(false)
  const [filter, setFilter] = useState<'all' | ResumeTemplateCategory>('all')
  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('My Resume')
  const [targetRole, setTargetRole] = useState('')
  const [profileType, setProfileType] = useState<ProfileType>('experienced')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const closeModals = () => {
    setSelectedTemplate(null)
    setStartStep(null)
    setError('')
  }

  const createBlankResume = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedTemplate) return
    setBusy(true)
    setError('')
    try {
      const resume = await createResume({
        full_name: fullName.trim(),
        title: title.trim(),
        target_role: targetRole.trim() || undefined,
        profile_type: profileType,
        template_name: selectedTemplate.id,
      })
      await onChanged()
      closeModals()
      onBuild(resume)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to create this resume.')
    } finally {
      setBusy(false)
    }
  }

  const importFile = async (file?: File) => {
    if (!file) return
    const template = selectedTemplate || resumeTemplates[0]
    setBusy(true)
    setError('')
    try {
      const imported = await importResume(file, profileType, targetRole)
      const resume = await updateResume(imported.resume.id, { template_name: template.id })
      await onChanged()
      closeModals()
      onBuild(resume)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to import this resume.')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const remove = async (resume: Resume) => {
    if (!window.confirm(`Delete “${resume.title}”? This cannot be undone.`)) return
    setError('')
    try {
      await deleteResume(resume.id)
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete this resume.')
    }
  }

  const filteredTemplates = resumeTemplates.filter((template) => filter === 'all' || template.category === filter)

  return <div className="resume-flow">
    <main className="resume-flow-main">
      <header className="resume-gallery-topline">
        <a className="resume-flow-brand" href="#builder" aria-label="Resume builder home">
        <img className="resume-flow-logo" src={mentorMuniLogo} alt="" /><strong>MentorMuni</strong>
        </a>
        <div className="resume-gallery-utilities">
          <button type="button" className="resume-flow-secondary" onClick={() => setShowResumes((visible) => !visible)}>{showResumes ? '← Templates' : `My resumes (${resumes.length})`}</button>
          {!showResumes && <>
            <button type="button" className="resume-import-top" onClick={() => { setSelectedTemplate(resumeTemplates[0]); fileInput.current?.click() }}>
              <span>⇧</span> Import existing resume
            </button>
            <input ref={fileInput} className="resume-file-input" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => void importFile(event.target.files?.[0])} />
          </>}
        </div>
      </header>
      <div className="resume-gallery-heading">
        <div>
          <h1>{showResumes ? 'Your resumes' : 'Start building your resume'}</h1>
          <p>{showResumes ? 'Continue editing or preview a resume you have already created.' : 'Choose a design you like. You can customize or switch it later.'}</p>
        </div>
      </div>

      {error && <div className="resume-flow-error" role="alert">{error}</div>}

      {showResumes ? <section className="resume-existing-list">
        <div className="resume-existing-toolbar">
          <h2>{resumes.length} {resumes.length === 1 ? 'resume' : 'resumes'}</h2>
          <button type="button" className="resume-flow-secondary" onClick={() => setShowResumes(false)}>← Choose a template</button>
        </div>
        {resumes.length === 0 ? <div className="resume-existing-empty">No resumes yet. Choose a template to get started.</div> :
          resumes.map((resume) => <article className="resume-existing-row" key={resume.id}>
            <div className="resume-mini-icon">CV</div>
            <div className="resume-existing-copy"><strong>{resume.title}</strong><span>{resume.target_role || 'Target role not specified'} · Updated {new Date(resume.updated_at).toLocaleDateString()}</span></div>
            <span className="resume-template-tag">{getTemplateName(resume.template_name)}</span>
            <button type="button" className="resume-flow-secondary" onClick={() => onPreview(resume)}>Preview</button>
            <button type="button" className="resume-flow-primary compact" onClick={() => onBuild(resume)}>Edit</button>
            <button type="button" className="resume-remove-button" onClick={() => void remove(resume)} aria-label={`Delete ${resume.title}`}>×</button>
          </article>)}
      </section> : <>
        <div className="resume-template-filters" role="group" aria-label="Filter templates">
          {([
            ['all', 'All templates'],
            ['simple', 'Simple'],
            ['modern', 'Modern'],
            ['creative', 'Creative'],
          ] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <section className="resume-template-grid" aria-label="Resume templates">
          {filteredTemplates.map((template) => <button key={template.id} type="button" className={`resume-template-card ${template.id}`} onClick={() => setSelectedTemplate(template)} aria-label={`Preview ${template.name} template`}>
            <TemplateMockup template={template} />
            <span className="resume-template-name">{template.name}</span>
          </button>)}
        </section>
      </>}
    </main>

    {selectedTemplate && !startStep && <div className="resume-flow-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModals() }}>
      <section className="resume-template-dialog" role="dialog" aria-modal="true" aria-labelledby="template-dialog-title">
        <button type="button" className="resume-dialog-close" onClick={closeModals} aria-label="Close preview">×</button>
        <div className="resume-dialog-preview"><TemplateMockup template={selectedTemplate} large /></div>
        <div className="resume-dialog-copy">
          <span className="resume-dialog-label">RESUME TEMPLATE</span>
          <h2 id="template-dialog-title">{selectedTemplate.name}</h2>
          <p>{selectedTemplate.description}</p>
          <ul><li>A4 / US-Letter size</li><li>Editable text</li><li>Fully customizable</li><li>Print-ready format</li><li>Online resume with shareable link</li></ul>
          <button type="button" className="resume-flow-primary" onClick={() => setStartStep('choose')}>Use this template</button>
        </div>
      </section>
    </div>}

    {selectedTemplate && startStep && <div className="resume-flow-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) closeModals() }}>
      <section className="resume-start-dialog" role="dialog" aria-modal="true" aria-labelledby="resume-start-title">
        <button type="button" className="resume-dialog-close" onClick={closeModals} aria-label="Close">×</button>
        {startStep === 'choose' ? <>
          <h2 id="resume-start-title">Import your existing resume</h2>
          <p>Start faster by prefilling your resume content.</p>
          <button type="button" className="resume-flow-primary resume-dialog-action" disabled={busy} onClick={() => fileInput.current?.click()}><span>🚀</span>{busy ? 'Importing resume…' : 'Import resume'}</button>
          <button type="button" className="resume-flow-secondary resume-dialog-action" onClick={() => setStartStep('blank')}><span>✍️</span>Start from blank</button>
        </> : <>
          <h2 id="resume-start-title">Start with a blank resume</h2>
          <p>Add your name and a title to create your first draft.</p>
          <form className="resume-start-form" onSubmit={(event) => void createBlankResume(event)}>
            <label>Your name *<input required minLength={2} maxLength={150} value={fullName} onChange={(event) => setFullName(event.target.value)} autoFocus /></label>
            <label>Resume title *<input required minLength={2} maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>Target role<input maxLength={200} value={targetRole} onChange={(event) => setTargetRole(event.target.value)} /></label>
            <label>Experience level<select value={profileType} onChange={(event) => setProfileType(event.target.value as ProfileType)}><option value="student">Student</option><option value="fresher">Fresher</option><option value="experienced">Experienced</option></select></label>
            <div className="resume-start-actions"><button type="button" className="resume-flow-secondary" onClick={() => setStartStep('choose')}>Back</button><button type="submit" className="resume-flow-primary" disabled={busy}>{busy ? 'Creating…' : 'Create resume'}</button></div>
          </form>
        </>}
        {error && <div className="resume-flow-error" role="alert">{error}</div>}
      </section>
    </div>}
  </div>
}

function TemplateMockup({ template, large = false }: { template: ResumeTemplateOption; large?: boolean }) {
  const hasSidebar = template.id === 'atlantic-blue' || template.id === 'charcoal'
  const hasHeaderBand = template.id === 'executive' || template.id === 'coral' || template.id === 'indigo'

  return <span className={`resume-mockup ${template.id} ${large ? 'large' : ''}`} aria-hidden="true">
    <span className="mockup-paper">
      {hasHeaderBand && <span className="mockup-header-band" />}
      {hasSidebar && <span className="mockup-sidebar">
        <b>{template.id === 'charcoal' ? 'PROFILE' : 'CONTACT'}</b>
        <i /><i /><i />
        <b>EDUCATION</b>
        <i /><i />
        <b>SKILLS</b>
        <i /><i /><i />
      </span>}
      <span className="mockup-main">
        <span className="mockup-person">{template.id === 'executive' ? 'MAYA WILLIAMS' : template.id === 'elegant' ? 'Sofia Bennett' : 'Emily Carter'}</span>
        <span className="mockup-role">{template.id === 'executive' ? 'SENIOR OPERATIONS LEADER' : template.id === 'charcoal' ? 'Product Designer' : 'Project Manager'}</span>
        {template.id === 'mercury-flow' && <span className="mockup-profile-photo">EC</span>}
        <span className="mockup-contact">✉ emily.carter@email.com　⌕ Toronto, Canada</span>
        <span className="mockup-section-title">{template.id === 'elegant' ? 'PROFILE' : 'SUMMARY'}</span>
        <span className="mockup-lines"><i /><i /><i /></span>
        <span className="mockup-section-title">{template.id === 'executive' ? 'CAREER HIGHLIGHTS' : 'PROFESSIONAL EXPERIENCE'}</span>
        <span className="mockup-entry"><b>Project Manager</b><i /><i /><i /></span>
        <span className="mockup-entry"><b>Project Coordinator</b><i /><i /></span>
        <span className="mockup-section-title">EDUCATION</span>
        <span className="mockup-entry"><b>Bachelor of Commerce</b><i /><i /></span>
        <span className="mockup-section-title">SKILLS</span>
        <span className="mockup-lines"><i /><i /></span>
        <span className="mockup-section-title">CERTIFICATES</span>
        <span className="mockup-lines"><i /><i /></span>
      </span>
    </span>
  </span>
}
