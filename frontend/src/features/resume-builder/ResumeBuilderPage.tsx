import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { createSectionRecord, deleteSectionRecord, getSectionRecords, updateSectionRecord } from '../../api/resumeContent'
import { getResumeSections, updateResume, updateResumeSections } from '../../api/resumes'
import type { CareerProfile, CustomResumeSectionType, Resume, ResumeSection, SectionRecord, SectionType } from '../../api/types'
import ResumeCustomizationPanel from './ResumeCustomizationPanel'

const sectionInfo: { type: SectionType; title: string; description: string }[] = [
  { type: 'education', title: 'Education', description: 'Degrees, schools, and academic credentials.' },
  { type: 'work_experience', title: 'Professional Experience', description: 'Roles, responsibilities, and career history.' },
  { type: 'technical_skill', title: 'Skills', description: 'Skills to include in this resume.' },
  { type: 'project', title: 'Projects', description: 'Selected projects and their impact.' },
  { type: 'certification', title: 'Certificates', description: 'Professional certifications and credentials.' },
  { type: 'achievement', title: 'Awards', description: 'Awards and other career achievements.' },
]

type Field = { name: string; label: string; type?: 'date' | 'number' | 'checkbox' | 'textarea' | 'url'; required?: boolean; maxLength?: number }
const fieldsByType: Record<SectionType, Field[]> = {
  education: [
    { name: 'institution_name', label: 'Institution', required: true, maxLength: 200 }, { name: 'degree', label: 'Degree', required: true, maxLength: 150 },
    { name: 'field_of_study', label: 'Field of study', maxLength: 150 }, { name: 'start_date', label: 'Start date', type: 'date' },
    { name: 'end_date', label: 'End date', type: 'date' }, { name: 'is_current', label: 'Currently studying', type: 'checkbox' },
    { name: 'grade', label: 'Grade', maxLength: 50 }, { name: 'description', label: 'Description', type: 'textarea', maxLength: 5000 },
  ],
  work_experience: [
    { name: 'company_name', label: 'Company', required: true, maxLength: 200 }, { name: 'job_title', label: 'Job title', required: true, maxLength: 200 },
    { name: 'employment_type', label: 'Employment type', maxLength: 50 }, { name: 'location', label: 'Location', maxLength: 150 },
    { name: 'start_date', label: 'Start date', type: 'date', required: true }, { name: 'end_date', label: 'End date', type: 'date' },
    { name: 'is_current', label: 'Currently working here', type: 'checkbox' }, { name: 'description', label: 'Description / responsibilities', type: 'textarea', maxLength: 5000 },
  ],
  technical_skill: [
    { name: 'skill_name', label: 'Skill name', required: true, maxLength: 150 }, { name: 'category', label: 'Category', maxLength: 100 },
    { name: 'proficiency_level', label: 'Proficiency level', maxLength: 50 }, { name: 'years_of_experience', label: 'Years of experience', type: 'number' },
  ],
  project: [
    { name: 'project_name', label: 'Project name', required: true, maxLength: 200 }, { name: 'role', label: 'Your role', maxLength: 150 },
    { name: 'technologies', label: 'Technologies', maxLength: 500 }, { name: 'project_url', label: 'Project URL', type: 'url' },
    { name: 'description', label: 'Description', type: 'textarea', maxLength: 5000 }, { name: 'responsibilities', label: 'Responsibilities', type: 'textarea', maxLength: 5000 },
    { name: 'achievements', label: 'Achievements', type: 'textarea', maxLength: 5000 },
  ],
  certification: [
    { name: 'certification_name', label: 'Certification', required: true, maxLength: 200 }, { name: 'issuing_organization', label: 'Issuing organization', required: true, maxLength: 200 },
    { name: 'credential_id', label: 'Credential ID', maxLength: 150 }, { name: 'credential_url', label: 'Credential URL', type: 'url' },
    { name: 'issue_date', label: 'Issue date', type: 'date' }, { name: 'expiry_date', label: 'Expiry date', type: 'date' },
    { name: 'does_not_expire', label: 'Does not expire', type: 'checkbox' },
  ],
  achievement: [
    { name: 'title', label: 'Achievement', required: true, maxLength: 200 }, { name: 'category', label: 'Category', maxLength: 100 },
    { name: 'issuing_organization', label: 'Issuing organization', maxLength: 200 }, { name: 'achievement_date', label: 'Date', type: 'date' },
    { name: 'credential_url', label: 'Credential URL', type: 'url' }, { name: 'description', label: 'Description', type: 'textarea', maxLength: 5000 },
  ],
}

type Draft = Record<string, string | boolean>
type ItemMap = Record<SectionType, SectionRecord[]>
type BuilderTab = 'overview' | 'content' | 'customize'

const customContentTypes: {
  key: string
  title: string
  description: string
  icon: string
  type?: SectionType
  customType?: CustomResumeSectionType
}[] = [
  { key: 'summary', title: 'Summary', description: 'Add a short summary of your key strengths, experience, and career goals.', icon: '▣' },
  { key: 'education', title: 'Education', description: 'Add your degrees and schools. Include your focus, honors, or exchange terms.', icon: '🎓', type: 'education' },
  { key: 'work_experience', title: 'Professional Experience', description: 'Add your professional roles and employer history including internships.', icon: '▣', type: 'work_experience' },
  { key: 'technical_skill', title: 'Skills', description: 'Add your hard and soft skills that help you stand out from the crowd.', icon: '✿', type: 'technical_skill' },
  { key: 'language', title: 'Languages', description: 'Add your languages and proficiency level to show your communication range.', icon: '◉', customType: 'language' },
  { key: 'certification', title: 'Certificates', description: 'Add your industry certificates or licenses. Include issuer and date earned.', icon: '♧', type: 'certification' },
  { key: 'interest', title: 'Interests', description: 'Add relevant personal interests that support your career story and cultural fit.', icon: '⌁', customType: 'interest' },
  { key: 'project', title: 'Projects', description: 'Add key projects you participated in and highlight your challenges, role, and impact.', icon: '▰', type: 'project' },
  { key: 'course', title: 'Courses', description: 'Add online or in-person courses and training you joined and completed.', icon: '▦', customType: 'course' },
  { key: 'achievement', title: 'Awards', description: 'Add your awards and recognitions from industry, competitions, or academia.', icon: '♙', type: 'achievement' },
  { key: 'volunteer', title: 'Organisations', description: 'Add your memberships or volunteering with organisations including your role.', icon: '⌂', customType: 'volunteer' },
  { key: 'publication', title: 'Publications', description: 'Add publications, articles, or books you wrote or contributed to.', icon: '▤', customType: 'publication' },
  { key: 'reference', title: 'References', description: 'Add your references from managers or coworkers, including their contact details.', icon: '⌘', customType: 'reference' },
  { key: 'declaration', title: 'Declaration', description: 'Add a declaration or any other additional information.', icon: '✎', customType: 'custom' },
  { key: 'custom', title: 'Custom', description: 'Add a custom section for anything else, or combine sections cleanly.', icon: '✣', customType: 'custom' },
]

const emptyItems = (): ItemMap => ({ education: [], work_experience: [], technical_skill: [], project: [], certification: [], achievement: [] })
const emptySections = (): ResumeSection[] => sectionInfo.map(({ type }) => ({ section_type: type, items: [] }))
const recordLabel = (type: SectionType, item: SectionRecord): string => {
  const keys: Record<SectionType, string> = {
    education: 'degree', work_experience: 'job_title', technical_skill: 'skill_name',
    project: 'project_name', certification: 'certification_name', achievement: 'title',
  }
  const secondary: Record<SectionType, string> = {
    education: 'institution_name', work_experience: 'company_name', technical_skill: 'category',
    project: 'role', certification: 'issuing_organization', achievement: 'category',
  }
  return `${item[keys[type]] || 'Untitled'}${item[secondary[type]] ? ` · ${item[secondary[type]]}` : ''}`
}

export default function ResumeBuilderPage({ resume, profile, onPreview, onResumeChanged, onResumeUpdated, onProfileChanged }: {
  resume: Resume
  profile: CareerProfile
  onPreview: () => void
  onResumeChanged: (resume: Resume) => void
  onResumeUpdated: (resume: Resume) => void
  onProfileChanged: (profile: CareerProfile) => void
}) {
  const [records, setRecords] = useState<ItemMap>(emptyItems)
  const [sections, setSections] = useState<ResumeSection[]>(emptySections)
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [formType, setFormType] = useState<SectionType | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [fieldError, setFieldError] = useState('')
  const [activeTab, setActiveTab] = useState<BuilderTab>('content')
  const [addContentOpen, setAddContentOpen] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.all([
      getResumeSections(resume.id),
      ...sectionInfo.map(({ type }) => getSectionRecords(type, profile.id)),
    ]).then(([stored, ...lists]) => {
      if (!active) return
      const map = emptyItems()
      sectionInfo.forEach(({ type }, index) => { map[type] = lists[index] })
      setRecords(map)
      const currentSections = stored.sections.length ? stored.sections : emptySections()
      const storedOrder = resume.section_order || []
      currentSections.sort((first, second) => {
        const firstOrder = storedOrder.indexOf(first.section_type)
        const secondOrder = storedOrder.indexOf(second.section_type)
        return (firstOrder < 0 ? storedOrder.length : firstOrder) - (secondOrder < 0 ? storedOrder.length : secondOrder)
      })
      setSections(currentSections)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to load resume content.')
    }).finally(() => {
      if (active) setBusy(false)
    })
    return () => { active = false }
  }, [profile.id, resume.id, resume.section_order])

  const visibleTypes = useMemo(() => new Set(sections.map((section) => section.section_type)), [sections])
  const persistSections = async (next: ResumeSection[]) => {
    setSaving(true)
    setError('')
    try {
      const result = await updateResumeSections(resume.id, next)
      const order = next.map((section) => section.section_type)
      setSections(result.sections.sort((first, second) => order.indexOf(first.section_type) - order.indexOf(second.section_type)))
      setNotice('Section layout saved.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save section layout.')
    } finally {
      setSaving(false)
    }
  }
  const toggleSection = (type: SectionType) => {
    const exists = sections.some((section) => section.section_type === type)
    const next = exists
      ? sections.filter((section) => section.section_type !== type)
      : [...sections, { section_type: type, items: [] }]
    setSections(next)
  }
  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    const next = [...sections]
    ;[next[index], next[target]] = [next[target], next[index]]
    setSections(next)
  }
  const startCreate = (type: SectionType) => {
    setFormType(type)
    setEditId(null)
    setDraft(Object.fromEntries(fieldsByType[type].map((field) => [field.name, field.type === 'checkbox' ? false : ''])))
    setError('')
    setFieldError('')
  }
  const startEdit = (type: SectionType, item: SectionRecord) => {
    setFormType(type)
    setEditId(item.id)
    setDraft(Object.fromEntries(fieldsByType[type].map((field) => {
      const value = item[field.name]
      return [field.name, field.type === 'checkbox' ? Boolean(value) : value == null ? '' : String(value)]
    })))
    setError('')
    setFieldError('')
  }
  const closeForm = () => { setFormType(null); setEditId(null); setDraft({}); setFieldError('') }
  const submitRecord = async (event: FormEvent) => {
    event.preventDefault()
    if (!formType) return
    setError('')
    setFieldError('')
    const startDate = String(draft.start_date || '')
    const endDate = String(draft.end_date || '')
    if (startDate && endDate && endDate < startDate) {
      setFieldError('End date cannot be before start date.')
      return
    }
    if (draft.is_current && endDate) {
      setFieldError('Remove the end date when this is marked current.')
      return
    }
    if (formType === 'certification' && draft.issue_date && draft.expiry_date && String(draft.expiry_date) < String(draft.issue_date)) {
      setFieldError('Expiry date cannot be before issue date.')
      return
    }
    if (formType === 'certification' && draft.does_not_expire && draft.expiry_date) {
      setFieldError('Remove the expiry date for a certification that does not expire.')
      return
    }
    const years = Number(draft.years_of_experience)
    if (formType === 'technical_skill' && draft.years_of_experience !== '' && (years < 0 || years > 60 || !Number.isInteger(years))) {
      setFieldError('Years of experience must be a whole number from 0 to 60.')
      return
    }
    setSaving(true)
    const payload: Record<string, unknown> = {}
    for (const field of fieldsByType[formType]) {
      const value = draft[field.name]
      if (field.type === 'checkbox') payload[field.name] = Boolean(value)
      else if (field.type === 'number') payload[field.name] = value === '' ? null : Number(value)
      else payload[field.name] = value === '' ? null : value
    }
    if ((formType === 'education' && draft.is_current) || (formType === 'work_experience' && draft.is_current)) payload.end_date = null
    try {
      if (editId) {
        const updated = await updateSectionRecord(formType, editId, payload)
        setRecords((current) => ({ ...current, [formType]: current[formType].map((item) => item.id === editId ? updated : item) }))
        setNotice('Resume content updated.')
      } else {
        const created = await createSectionRecord(formType, profile, payload)
        setRecords((current) => ({ ...current, [formType]: [...current[formType], created] }))
        const nextSections = sections.map((section) => section.section_type === formType
          ? { ...section, items: [...section.items, { item_id: created.id, display_order: section.items.length }] }
          : section)
        if (!visibleTypes.has(formType)) nextSections.push({ section_type: formType, items: [{ item_id: created.id, display_order: 0 }] })
        const result = await updateResumeSections(resume.id, nextSections)
        setSections(result.sections)
        setNotice('Content added to this resume.')
      }
      closeForm()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save this resume content.')
    } finally {
      setSaving(false)
    }
  }
  const toggleItem = async (type: SectionType, item: SectionRecord, included: boolean) => {
    const section = sections.find((entry) => entry.section_type === type) || { section_type: type, items: [] }
    const items = included
      ? [...section.items, { item_id: item.id, display_order: section.items.length }]
      : section.items.filter((entry) => entry.item_id !== item.id)
    const next = sections.some((entry) => entry.section_type === type)
      ? sections.map((entry) => entry.section_type === type ? { ...entry, items } : entry)
      : [...sections, { section_type: type, items }]
    await persistSections(next)
  }
  const removeRecord = async (type: SectionType, item: SectionRecord) => {
    if (!window.confirm(`Delete “${recordLabel(type, item)}” from this resume?`)) return
    setSaving(true)
    setError('')
    try {
      await deleteSectionRecord(type, item.id)
      setRecords((current) => ({ ...current, [type]: current[type].filter((entry) => entry.id !== item.id) }))
      const next = sections.map((section) => section.section_type === type
        ? { ...section, items: section.items.filter((entry) => entry.item_id !== item.id) }
        : section)
      await persistSections(next)
      setNotice('Content deleted.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete content.')
    } finally {
      setSaving(false)
    }
  }
  const saveLayout = () => {
    const next = sections.map((section) => ({
      ...section,
      items: section.items.map((item, index) => ({ ...item, display_order: index })),
    }))
    setSaving(true)
    setError('')
    void updateResume(resume.id, {
      section_order: next.map((section) => section.section_type),
    }).then((updated) => {
      onResumeUpdated(updated)
      return updateResumeSections(resume.id, next)
    }).then((result) => {
      setSections(result.sections.sort((first, second) => {
        const order = next.map((section) => section.section_type)
        return order.indexOf(first.section_type) - order.indexOf(second.section_type)
      }))
      setNotice('Section layout saved.')
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Unable to save section layout.')
    }).finally(() => setSaving(false))
  }

  const addContent = async (item: typeof customContentTypes[number]) => {
    setAddContentOpen(false)
    if (item.type) {
      startCreate(item.type)
      return
    }
    if (item.key === 'summary') {
      setActiveTab('customize')
      setNotice('Add your professional summary under Personal details.')
      return
    }
    if (!item.customType) return
    const customSections = resume.custom_sections || []
    if (customSections.length >= 12) {
      setError('A resume can contain at most 12 custom sections.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = await updateResume(resume.id, {
        custom_sections: [...customSections, {
          id: crypto.randomUUID(),
          section_type: item.customType,
          title: item.key === 'declaration' ? 'Declaration' : item.title === 'Custom' ? 'Custom section' : item.title,
          entries: [],
        }],
      })
      onResumeUpdated(updated)
      setActiveTab('customize')
      setNotice(`${item.title} section added. Add its details below.`)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to add this section.')
    } finally {
      setSaving(false)
    }
  }

  const openAiTools = () => {
    window.location.hash = '#optimization'
  }

  return <div className="builder-workspace">
    <header className="builder-toolbar">
      <nav className="builder-tabs" aria-label="Resume editor">
        <button type="button" className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}><span>▦</span>Overview</button>
        <button type="button" className={activeTab === 'content' ? 'active' : ''} onClick={() => setActiveTab('content')}><span>▤</span>Content</button>
        <button type="button" className={activeTab === 'customize' ? 'active' : ''} onClick={() => setActiveTab('customize')}><span>⚒</span>Customize</button>
        <button type="button" onClick={openAiTools}><span>✣</span>AI Tools</button>
      </nav>
      <div className="builder-toolbar-actions">
        <span className="builder-resume-name">{resume.title}<span>⌄</span></span>
        <button type="button" className="builder-download" onClick={onPreview}>Download <span>⇩</span></button>
        <button type="button" className="icon-button" aria-label="Back to resumes" title="Back to resumes" onClick={() => onResumeChanged(resume)}>⋮</button>
      </div>
    </header>

    {error && <div className="notice notice-error builder-notice" role="alert">{error}</div>}
    {notice && <div className="notice notice-success builder-notice" role="status">{notice}</div>}

    {activeTab === 'overview' && <section className="builder-overview">
      <div><span className="eyebrow">RESUME OVERVIEW</span><h1>{resume.title}</h1><p>Keep your details up to date and build each section of your resume.</p></div>
      <div className="builder-overview-card"><strong>{profile.full_name}</strong><span>{profile.professional_title || 'Add a professional title'}</span><span>{sections.reduce((count, section) => count + section.items.length, 0)} content items · {resume.template_name} template</span><button type="button" className="resume-flow-primary" onClick={() => setActiveTab('content')}>Continue editing</button></div>
    </section>}

    {activeTab === 'content' && <div className="builder-editor-grid">
      <section className="builder-content-column">
        <article className="builder-contact-card">
          <div className="builder-contact-copy">
            <h1>{profile.full_name || 'Your name'}</h1>
            {profile.professional_title && <p className="builder-contact-title">{profile.professional_title}</p>}
            <div className="builder-contact-details">
              <span>✉ {profile.email || 'Email'}</span>
              <span>♧ {profile.phone || 'Phone'}</span>
              <span>⌖ {profile.city || 'Address'}</span>
            </div>
          </div>
          <button type="button" className="builder-edit-contact" aria-label="Edit contact information" onClick={() => setActiveTab('customize')}>✎</button>
        </article>
        {busy ? <div className="builder-content-loading"><span className="spinner" /><span>Loading resume content…</span></div> : <div className="builder-populated-sections">
          {sections.filter((section) => section.items.length > 0).map((section) => {
            const meta = sectionInfo.find((entry) => entry.type === section.section_type)!
            const selected = section.items
              .slice()
              .sort((a, b) => a.display_order - b.display_order)
              .map((item) => records[section.section_type].find((record) => record.id === item.item_id))
              .filter((record): record is SectionRecord => Boolean(record))
            return <section className="builder-content-section" key={section.section_type}>
              <div className="builder-content-section-heading"><div><h2>{meta.title}</h2><span>{selected.length} {selected.length === 1 ? 'entry' : 'entries'}</span></div><button type="button" onClick={() => startCreate(section.section_type)}>＋ Add</button></div>
              {selected.map((item) => <article className="content-item" key={item.id}>
                <div className="content-item-heading"><strong>{recordLabel(section.section_type, item)}</strong><span className="content-actions"><button className="text-button" onClick={() => startEdit(section.section_type, item)}>Edit</button><button className="text-button danger-text" onClick={() => void removeRecord(section.section_type, item)}>Delete</button></span></div>
                <p>{summaryFor(section.section_type, item)}</p>
              </article>)}
            </section>
          })}
          {(resume.custom_sections || []).map((section) => <section className="builder-content-section" key={section.id}>
            <div className="builder-content-section-heading"><div><h2>{section.title}</h2><span>{section.entries.length} {section.entries.length === 1 ? 'entry' : 'entries'}</span></div><button type="button" onClick={() => setActiveTab('customize')}>＋ Add</button></div>
            {section.entries.map((entry, index) => <article className="content-item" key={`${section.id}-${index}`}><div className="content-item-heading"><strong>{entry.title}</strong></div>{entry.description && <p>{entry.description}</p>}</article>)}
          </section>)}
        </div>}
        <button type="button" className="builder-add-content" onClick={() => setAddContentOpen(true)}><span>＋</span>Add Content</button>
      </section>
      <ResumeDocumentPreview resume={resume} profile={profile} records={records} sections={sections} />
    </div>}

    {activeTab === 'customize' && <div className="builder-customize-content">
      <div className="builder-customize-heading"><div><span className="eyebrow">RESUME BUILDER</span><h1>Customize your resume</h1><p>Update your details, design, and the order of your sections.</p></div><button type="button" className="resume-flow-secondary" onClick={() => setActiveTab('content')}>← Back to content</button></div>
      <ResumeCustomizationPanel resume={resume} profile={profile} onResumeUpdated={onResumeUpdated} onProfileChanged={onProfileChanged} />
      <section className="panel layout-panel"><div className="panel-title"><div><h2>Sections and order</h2><p>Choose visible sections, then arrange them in your preferred order.</p></div><button className="button button-secondary" disabled={saving} onClick={saveLayout}>{saving ? 'Saving…' : 'Save layout'}</button></div>
        <div className="section-toggles">{sectionInfo.map(({ type, title }) => <label className="check-label" key={type}><input type="checkbox" checked={visibleTypes.has(type)} onChange={() => toggleSection(type)} />{title}</label>)}</div>
        <div className="order-list">{sections.map((section, index) => <div className="order-row" key={section.section_type}><span className="order-index">{String(index + 1).padStart(2, '0')}</span><strong>{sectionInfo.find((entry) => entry.type === section.section_type)?.title}</strong><span className="muted">{section.items.length} selected</span><button className="icon-button" disabled={index === 0} onClick={() => moveSection(index, -1)} aria-label="Move section up">↑</button><button className="icon-button" disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)} aria-label="Move section down">↓</button></div>)}</div>
      </section>
      {busy ? <div className="panel empty-state"><span className="spinner" /><p>Loading resume content…</p></div> : <div className="builder-sections">
        {sections.map((section, index) => {
          const meta = sectionInfo.find((entry) => entry.type === section.section_type)!
          const selected = section.items
            .slice()
            .sort((a, b) => a.display_order - b.display_order)
            .map((item) => records[section.section_type].find((record) => record.id === item.item_id))
            .filter((record): record is SectionRecord => Boolean(record))
          const available = records[section.section_type].filter((record) => !section.items.some((item) => item.item_id === record.id))
          return <section className="panel builder-section" key={section.section_type}><div className="panel-title"><div><span className="eyebrow">SECTION {String(index + 1).padStart(2, '0')}</span><h2>{meta.title}</h2><p>{meta.description}</p></div><button className="button button-secondary" onClick={() => startCreate(section.section_type)}>＋ Add</button></div>
            {selected.length === 0 ? <p className="muted empty-copy">No items selected for this resume yet.</p> : <div className="content-list">{selected.map((item) => <article className="content-item" key={item.id}><div className="content-item-heading"><strong>{recordLabel(section.section_type, item)}</strong><span className="content-actions"><button className="text-button" onClick={() => startEdit(section.section_type, item)}>Edit</button><button className="text-button danger-text" onClick={() => void removeRecord(section.section_type, item)}>Delete</button></span></div><p>{summaryFor(section.section_type, item)}</p></article>)}</div>}
            {available.length > 0 && <div className="available-items"><label>Add existing content<select defaultValue="" onChange={(event) => { const selectedRecord = available.find((record) => record.id === event.target.value); if (selectedRecord) void toggleItem(section.section_type, selectedRecord, true); event.target.value = '' }}><option value="" disabled>Choose an item…</option>{available.map((item) => <option key={item.id} value={item.id}>{recordLabel(section.section_type, item)}</option>)}</select></label></div>}
          </section>
        })}
      </div>}
    </div>}

    {addContentOpen && <div className="resume-flow-overlay builder-add-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddContentOpen(false) }}>
      <section className="builder-add-dialog" role="dialog" aria-modal="true" aria-labelledby="add-content-title">
        <button type="button" className="resume-dialog-close" onClick={() => setAddContentOpen(false)} aria-label="Close">×</button>
        <h2 id="add-content-title">Add content</h2>
        <p className="builder-add-import">Already have a resume? <button type="button" onClick={() => { setAddContentOpen(false); window.location.hash = '#builder' }}>Import resume</button></p>
        <div className="builder-content-type-grid">{customContentTypes.map((item) => <button type="button" className={`builder-content-type ${item.key === 'custom' ? 'custom' : ''}`} key={item.key} onClick={() => void addContent(item)}>
          <span className="builder-content-type-title"><i>{item.icon}</i><strong>{item.title}</strong></span><span>{item.description}</span>
        </button>)}</div>
      </section>
    </div>}

    {formType && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><form className="modal-card" onSubmit={(event) => void submitRecord(event)}><div className="panel-title"><div><span className="eyebrow">{editId ? 'EDIT CONTENT' : 'ADD CONTENT'}</span><h2>{sectionInfo.find((entry) => entry.type === formType)?.title}</h2></div><button type="button" className="icon-button" onClick={closeForm} aria-label="Close">×</button></div><div className="form-grid">{fieldsByType[formType].map((field) => <label key={field.name} className={field.type === 'textarea' ? 'field-wide' : field.type === 'checkbox' ? 'check-label' : ''}>{field.type === 'checkbox' ? <><input type="checkbox" checked={Boolean(draft[field.name])} onChange={(event) => setDraft({ ...draft, [field.name]: event.target.checked })} />{field.label}</> : <>{field.label}{field.type === 'textarea' ? <><textarea rows={3} maxLength={field.maxLength} value={String(draft[field.name] || '')} onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })} /><span className="field-hint">{String(draft[field.name] || '').length}/{field.maxLength} characters</span></> : <input required={field.required} type={field.type || 'text'} min={field.type === 'number' ? 0 : field.required ? 2 : undefined} max={field.type === 'number' ? 60 : undefined} step={field.type === 'number' ? 1 : undefined} minLength={field.required && field.type !== 'date' ? 2 : undefined} maxLength={field.maxLength} value={String(draft[field.name] || '')} onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })} />}</>}</label>)}</div>{fieldError && <div className="notice notice-error field-validation-error" role="alert">{fieldError}</div>}<div className="form-actions"><button type="button" className="button button-secondary" onClick={closeForm}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : editId ? 'Save changes' : 'Add to resume'}</button></div></form></div>}
  </div>
}

function summaryFor(type: SectionType, item: SectionRecord): string {
  const fields: Record<SectionType, string[]> = {
    education: ['field_of_study', 'start_date', 'end_date', 'description'],
    work_experience: ['employment_type', 'location', 'start_date', 'end_date', 'description'],
    technical_skill: ['proficiency_level', 'years_of_experience'],
    project: ['technologies', 'description', 'responsibilities', 'achievements'],
    certification: ['credential_id', 'issue_date', 'expiry_date'],
    achievement: ['issuing_organization', 'achievement_date', 'description'],
  }
  return fields[type].map((key) => item[key]).filter((value) => value !== null && value !== undefined && value !== '').join(' · ')
}

function ResumeDocumentPreview({ resume, profile, records, sections }: {
  resume: Resume
  profile: CareerProfile
  records: ItemMap
  sections: ResumeSection[]
}) {
  const included = sections.map((section) => ({
    section,
    items: section.items
      .slice()
      .sort((first, second) => first.display_order - second.display_order)
      .map((item) => records[section.section_type].find((record) => record.id === item.item_id))
      .filter((item): item is SectionRecord => Boolean(item)),
  })).filter((entry) => entry.items.length > 0)

  return <aside className={`builder-preview-panel ${resume.template_name}`}>
    <article className="builder-resume-paper">
      <header className="builder-paper-header">
        <h2>{profile.full_name || 'Your name'}</h2>
        {profile.professional_title && <p>{profile.professional_title}</p>}
        <div>{[profile.email, profile.phone, profile.city, profile.linkedin_url].filter(Boolean).join('  ·  ') || 'Email  ·  Phone  ·  Address'}</div>
      </header>
      {profile.summary && <section className="builder-paper-section"><h3>Summary</h3><p>{profile.summary}</p></section>}
      {included.map(({ section, items }) => <section className="builder-paper-section" key={section.section_type}>
        <h3>{sectionInfo.find((entry) => entry.type === section.section_type)?.title}</h3>
        {items.map((item) => <div className="builder-paper-entry" key={item.id}><strong>{recordLabel(section.section_type, item)}</strong><span>{summaryFor(section.section_type, item)}</span></div>)}
      </section>)}
      {(resume.custom_sections || []).filter((section) => section.entries.length > 0).map((section) => <section className="builder-paper-section" key={section.id}>
        <h3>{section.title}</h3>
        {section.entries.map((entry, index) => <div className="builder-paper-entry" key={`${section.id}-${index}`}><strong>{entry.title}</strong><span>{entry.description || entry.subtitle || ''}</span></div>)}
      </section>)}
      {included.length === 0 && !profile.summary && (resume.custom_sections || []).every((section) => !section.entries.length) && <p className="builder-paper-empty">Your resume preview will appear here as you add content.</p>}
    </article>
  </aside>
}
