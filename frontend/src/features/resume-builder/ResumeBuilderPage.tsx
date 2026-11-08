import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { createSectionRecord, deleteSectionRecord, getSectionRecords, updateSectionRecord } from '../../api/resumeContent'
import { getResumeSections, updateResumeSections } from '../../api/resumes'
import type { CareerProfile, Resume, ResumeSection, SectionRecord, SectionType } from '../../api/types'

const sectionInfo: { type: SectionType; title: string; description: string }[] = [
  { type: 'education', title: 'Education', description: 'Degrees, schools, and academic credentials.' },
  { type: 'work_experience', title: 'Work experience', description: 'Roles, responsibilities, and career history.' },
  { type: 'technical_skill', title: 'Technical skills', description: 'Skills to include in this resume.' },
  { type: 'project', title: 'Projects', description: 'Selected projects and their impact.' },
  { type: 'certification', title: 'Certifications', description: 'Professional certifications and credentials.' },
  { type: 'achievement', title: 'Achievements', description: 'Awards and other career achievements.' },
]

type Field = { name: string; label: string; type?: 'date' | 'number' | 'checkbox' | 'textarea'; required?: boolean }
const fieldsByType: Record<SectionType, Field[]> = {
  education: [
    { name: 'institution_name', label: 'Institution', required: true }, { name: 'degree', label: 'Degree', required: true },
    { name: 'field_of_study', label: 'Field of study' }, { name: 'start_date', label: 'Start date', type: 'date' },
    { name: 'end_date', label: 'End date', type: 'date' }, { name: 'is_current', label: 'Currently studying', type: 'checkbox' },
    { name: 'grade', label: 'Grade' }, { name: 'description', label: 'Description', type: 'textarea' },
  ],
  work_experience: [
    { name: 'company_name', label: 'Company', required: true }, { name: 'job_title', label: 'Job title', required: true },
    { name: 'employment_type', label: 'Employment type' }, { name: 'location', label: 'Location' },
    { name: 'start_date', label: 'Start date', type: 'date', required: true }, { name: 'end_date', label: 'End date', type: 'date' },
    { name: 'is_current', label: 'Currently working here', type: 'checkbox' }, { name: 'description', label: 'Description / responsibilities', type: 'textarea' },
  ],
  technical_skill: [
    { name: 'skill_name', label: 'Skill name', required: true }, { name: 'category', label: 'Category' },
    { name: 'proficiency_level', label: 'Proficiency level' }, { name: 'years_of_experience', label: 'Years of experience', type: 'number' },
  ],
  project: [
    { name: 'project_name', label: 'Project name', required: true }, { name: 'role', label: 'Your role' },
    { name: 'technologies', label: 'Technologies' }, { name: 'project_url', label: 'Project URL' },
    { name: 'description', label: 'Description', type: 'textarea' }, { name: 'responsibilities', label: 'Responsibilities', type: 'textarea' },
    { name: 'achievements', label: 'Achievements', type: 'textarea' },
  ],
  certification: [
    { name: 'certification_name', label: 'Certification', required: true }, { name: 'issuing_organization', label: 'Issuing organization', required: true },
    { name: 'credential_id', label: 'Credential ID' }, { name: 'credential_url', label: 'Credential URL' },
    { name: 'issue_date', label: 'Issue date', type: 'date' }, { name: 'expiry_date', label: 'Expiry date', type: 'date' },
    { name: 'does_not_expire', label: 'Does not expire', type: 'checkbox' },
  ],
  achievement: [
    { name: 'title', label: 'Achievement', required: true }, { name: 'category', label: 'Category' },
    { name: 'issuing_organization', label: 'Issuing organization' }, { name: 'achievement_date', label: 'Date', type: 'date' },
    { name: 'credential_url', label: 'Credential URL' }, { name: 'description', label: 'Description', type: 'textarea' },
  ],
}

type Draft = Record<string, string | boolean>
type ItemMap = Record<SectionType, SectionRecord[]>
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

export default function ResumeBuilderPage({ resume, profile, onPreview, onResumeChanged }: {
  resume: Resume
  profile: CareerProfile
  onPreview: () => void
  onResumeChanged: (resume: Resume) => void
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
      setSections(stored.sections.length ? stored.sections : emptySections())
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to load resume content.')
    }).finally(() => {
      if (active) setBusy(false)
    })
    return () => { active = false }
  }, [profile.id, resume.id])

  const visibleTypes = useMemo(() => new Set(sections.map((section) => section.section_type)), [sections])
  const persistSections = async (next: ResumeSection[]) => {
    setSaving(true)
    setError('')
    try {
      const result = await updateResumeSections(resume.id, next)
      setSections(result.sections)
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
  }
  const startEdit = (type: SectionType, item: SectionRecord) => {
    setFormType(type)
    setEditId(item.id)
    setDraft(Object.fromEntries(fieldsByType[type].map((field) => {
      const value = item[field.name]
      return [field.name, field.type === 'checkbox' ? Boolean(value) : value == null ? '' : String(value)]
    })))
    setError('')
  }
  const closeForm = () => { setFormType(null); setEditId(null); setDraft({}) }
  const submitRecord = async (event: FormEvent) => {
    event.preventDefault()
    if (!formType) return
    setSaving(true)
    setError('')
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
    void persistSections(next)
  }

  return <div className="feature-page">
    <div className="page-heading"><div><div className="eyebrow">RESUME BUILDER · {profile.full_name}</div><h1>{resume.title}</h1><p>Choose sections, add your content, and arrange the resume to your preference.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={onPreview}>Preview & download</button><button className="button button-primary" onClick={() => onResumeChanged(resume)}>Done editing</button></div></div>
    {error && <div className="notice notice-error" role="alert">{error}</div>}{notice && <div className="notice notice-success" role="status">{notice}</div>}
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
    {formType && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><form className="modal-card" onSubmit={(event) => void submitRecord(event)}><div className="panel-title"><div><span className="eyebrow">{editId ? 'EDIT CONTENT' : 'ADD CONTENT'}</span><h2>{sectionInfo.find((entry) => entry.type === formType)?.title}</h2></div><button type="button" className="icon-button" onClick={closeForm} aria-label="Close">×</button></div><div className="form-grid">{fieldsByType[formType].map((field) => <label key={field.name} className={field.type === 'textarea' ? 'field-wide' : field.type === 'checkbox' ? 'check-label' : ''}>{field.type === 'checkbox' ? <><input type="checkbox" checked={Boolean(draft[field.name])} onChange={(event) => setDraft({ ...draft, [field.name]: event.target.checked })} />{field.label}</> : <>{field.label}{field.type === 'textarea' ? <textarea rows={3} value={String(draft[field.name] || '')} onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })} /> : <input required={field.required} type={field.type || 'text'} min={field.type === 'number' ? 0 : undefined} value={String(draft[field.name] || '')} onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })} />}</>}</label>)}</div><div className="form-actions"><button type="button" className="button button-secondary" onClick={closeForm}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : editId ? 'Save changes' : 'Add to resume'}</button></div></form></div>}
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
