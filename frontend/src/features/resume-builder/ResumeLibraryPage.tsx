import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { createResume, deleteResume, updateResume } from '../../api/resumes'
import type { Resume, ResumeTemplate } from '../../api/types'

interface Props {
  resumes: Resume[]
  onChanged: () => Promise<void>
  onBuild: (resume: Resume) => void
  onPreview: (resume: Resume) => void
}

export default function ResumeLibraryPage({ resumes, onChanged, onBuild, onPreview }: Props) {
  const [editing, setEditing] = useState<Resume | 'new' | null>(null)
  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [template, setTemplate] = useState<ResumeTemplate>('modern')
  const [primary, setPrimary] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const start = (resume?: Resume) => {
    setError('')
    setEditing(resume || 'new')
    setFullName('')
    setTitle(resume?.title || '')
    setTargetRole(resume?.target_role || '')
    setTemplate(resume?.template_name || 'modern')
    setPrimary(resume?.is_primary || false)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (title.trim().length < 2 || (editing === 'new' && fullName.trim().length < 2)) {
      setError(editing === 'new' ? 'Enter your name and a resume title (at least two characters each).' : 'Enter a resume title with at least two characters.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editing === 'new') {
        await createResume({
          full_name: fullName.trim(),
          title: title.trim(),
          target_role: targetRole.trim() || undefined,
          template_name: template,
          is_primary: primary,
        })
      } else if (editing) {
        await updateResume(editing.id, {
          title: title.trim(),
          target_role: targetRole.trim() || null,
          template_name: template,
          is_primary: primary,
        })
      }
      await onChanged()
      setEditing(null)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save this resume.')
    } finally {
      setSaving(false)
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

  const query = search.trim().toLowerCase()
  const filtered = resumes.filter((resume) =>
    `${resume.title} ${resume.target_role || ''} ${resume.template_name}`.toLowerCase().includes(query),
  )

  return <div className="feature-page">
    <div className="page-heading"><div><div className="eyebrow">FEATURE 02</div><h1>Resume builder</h1><p>Start from scratch, add the sections you need, then preview and download your resume.</p></div><button className="button button-primary" onClick={() => start()}>＋ Create resume</button></div>
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    <div className="toolbar"><label className="search-field"><span>⌕</span><input aria-label="Search resumes" placeholder="Search title, role, or template" value={search} onChange={(event) => setSearch(event.target.value)} /></label><span className="muted">{filtered.length} of {resumes.length} resumes</span></div>
    {editing && <form className="panel form-panel" onSubmit={(event) => void save(event)}>
      <div className="panel-title"><div><h2>{editing === 'new' ? 'Create resume' : 'Edit resume details'}</h2><p>{editing === 'new' ? 'Your name is used as the heading in the exported resume.' : 'Update the title, target role, or template.'}</p></div><button type="button" className="icon-button" onClick={() => setEditing(null)} aria-label="Close form">×</button></div>
      <div className="form-grid">
        {editing === 'new' && <label>Your name *<input required minLength={2} maxLength={150} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>}
        <label>Resume title *<input required minLength={2} maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Target role<input maxLength={200} value={targetRole} onChange={(event) => setTargetRole(event.target.value)} /></label>
        <label>Template<select value={template} onChange={(event) => setTemplate(event.target.value as ResumeTemplate)}><option value="modern">Modern</option><option value="professional">Professional</option><option value="minimal">Minimal</option></select></label>
        <label className="check-label"><input type="checkbox" checked={primary} onChange={(event) => setPrimary(event.target.checked)} /> Set as primary resume</label>
      </div>
      <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : editing === 'new' ? 'Create resume' : 'Save changes'}</button></div>
    </form>}
    {filtered.length === 0 ? <div className="panel empty-state"><h2>{query ? 'No matching resumes' : 'No resumes yet'}</h2><p>{query ? 'Try another search.' : 'Create a resume to begin adding your sections.'}</p>{!query && <button className="button button-primary" onClick={() => start()}>Create your first resume</button>}</div> :
      <div className="resume-grid">{filtered.map((resume) => <article className="panel resume-card" key={resume.id}>
        <div className="resume-card-top"><span className="document-icon">CV</span><span className="tag">{resume.template_name}</span></div>
        <h2>{resume.title}</h2><p>{resume.target_role || 'Target role not specified'}</p>
        <div className="resume-meta">{resume.is_primary && <span className="status-pill">Primary</span>}<span>Updated {new Date(resume.updated_at).toLocaleDateString()}</span></div>
        <div className="card-actions card-actions-wrap"><button className="button button-primary" onClick={() => onBuild(resume)}>Edit content</button><button className="button button-secondary" onClick={() => onPreview(resume)}>Preview / download</button><button className="button button-secondary" onClick={() => start(resume)}>Details</button><button className="button button-danger" onClick={() => void remove(resume)}>Delete</button></div>
      </article>)}</div>}
  </div>
}
