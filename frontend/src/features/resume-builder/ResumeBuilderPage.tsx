import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { updateCareerProfile } from '../../api/careerProfiles'
import { createSectionRecord, deleteSectionRecord, getSectionRecords, updateSectionRecord } from '../../api/resumeContent'
import { getResumeSections, updateResume, updateResumeSections } from '../../api/resumes'
import type { CareerProfile, CustomResumeEntry, CustomResumeSection, CustomResumeSectionType, Resume, ResumeSection, SectionRecord, SectionType } from '../../api/types'
import ResumeCustomizationPanel from './ResumeCustomizationPanel'
import BulletOptimizerModal from './BulletOptimizerModal'

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
type PendingRecord = { id: string; type: SectionType; fields: Record<string, unknown> }
type ItemMap = Record<SectionType, SectionRecord[]>
type OptimizingBullet = { type: 'work_experience' | 'project'; itemId: string; field: string; lineIndex: number; original: string }
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
  const [pendingRecords, setPendingRecords] = useState<PendingRecord[]>([])
  const [savedDraftRecords, setSavedDraftRecords] = useState<Record<string, SectionRecord>>({})
  const [customSectionsDraft, setCustomSectionsDraft] = useState<CustomResumeSection[]>(resume.custom_sections || [])
  const [pendingCustomSectionIds, setPendingCustomSectionIds] = useState<string[]>([])
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState(profile.summary || '')
  const [optimizingBullet, setOptimizingBullet] = useState<OptimizingBullet | null>(null)

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
  const hasPendingChanges = pendingRecords.length > 0
    || pendingCustomSectionIds.length > 0
    || (summaryOpen && summaryDraft !== (profile.summary || ''))
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
  const startEditPending = (item: PendingRecord) => {
    setFormType(item.type)
    setEditId(item.id)
    setDraft(Object.fromEntries(fieldsByType[item.type].map((field) => {
      const value = item.fields[field.name]
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
    const payload: Record<string, unknown> = {}
    for (const field of fieldsByType[formType]) {
      const value = draft[field.name]
      if (field.type === 'checkbox') payload[field.name] = Boolean(value)
      else if (field.type === 'number') payload[field.name] = value === '' ? null : Number(value)
      else payload[field.name] = value === '' ? null : value
    }
    if ((formType === 'education' && draft.is_current) || (formType === 'work_experience' && draft.is_current)) payload.end_date = null
    const pending = editId ? pendingRecords.find((item) => item.id === editId) : undefined
    if (pending) {
      setPendingRecords((current) => current.map((item) => item.id === pending.id ? { ...item, fields: payload } : item))
      closeForm()
      setNotice('Section draft updated. Save the resume to keep your changes.')
      return
    }
    if (!editId) {
      const id = crypto.randomUUID()
      setPendingRecords((current) => [...current, { id, type: formType, fields: payload }])
      setSections((current) => current.some((section) => section.section_type === formType)
        ? current
        : [...current, { section_type: formType, items: [] }])
      closeForm()
      setNotice('Section added to your draft. Add more content, then save the resume.')
      return
    }
    setSaving(true)
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
  const removePendingRecord = async (pending: PendingRecord) => {
    const saved = savedDraftRecords[pending.id]
    if (saved) {
      setSaving(true)
      setError('')
      try {
        await deleteSectionRecord(pending.type, saved.id)
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Unable to remove the saved draft item.')
        setSaving(false)
        return
      }
      setSaving(false)
    }
    setPendingRecords((current) => current.filter((item) => item.id !== pending.id))
    setSavedDraftRecords((current) => {
      const next = { ...current }
      delete next[pending.id]
      return next
    })
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

  const saveResumeDraft = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    const invalidCustomSection = customSectionsDraft.find((section) => pendingCustomSectionIds.includes(section.id)
      && (section.title.trim().length < 2 || section.title.trim().length > 60
        || section.entries.some((entry) => entry.title.trim().length < 2 || entry.title.trim().length > 200)))
    if (invalidCustomSection) {
      setSaving(false)
      setError('Complete each new section title and entry title before saving. Section titles must contain 2 to 60 characters; entry titles must contain 2 to 200.')
      return
    }
    const createdRecords = { ...savedDraftRecords }
    try {
      for (const pending of pendingRecords) {
        createdRecords[pending.id] = createdRecords[pending.id]
          ? await updateSectionRecord(pending.type, createdRecords[pending.id].id, pending.fields)
          : await createSectionRecord(pending.type, profile, pending.fields)
        setSavedDraftRecords({ ...createdRecords })
      }

      const nextSections = sections.map((section) => {
        const newItems = pendingRecords
          .filter((pending) => pending.type === section.section_type)
          .map((pending) => createdRecords[pending.id])
          .filter((record): record is SectionRecord => Boolean(record))
        const existingItems = section.items.filter((item) => !newItems.some((record) => record.id === item.item_id))
        return {
          ...section,
          items: [
            ...existingItems,
            ...newItems.map((record, index) => ({
              item_id: record.id,
              display_order: existingItems.length + index,
            })),
          ],
        }
      })
      const updatedResume = await updateResume(resume.id, {
        section_order: nextSections.map((section) => section.section_type),
        custom_sections: customSectionsDraft.map((section) => ({
          ...section,
          title: section.title.trim(),
          entries: section.entries.map((entry) => ({
            ...entry,
            title: entry.title.trim(),
            subtitle: entry.subtitle?.trim() || null,
            date: entry.date?.trim() || null,
            location: entry.location?.trim() || null,
            url: entry.url?.trim() || null,
            description: entry.description?.trim() || null,
          })),
        })),
      })
      setCustomSectionsDraft(updatedResume.custom_sections || [])
      onResumeUpdated(updatedResume)
      const updatedSections = await updateResumeSections(resume.id, nextSections)
      if (summaryOpen && summaryDraft !== (profile.summary || '')) {
        const updatedProfile = await updateCareerProfile(profile.id, { summary: summaryDraft.trim() || null })
        setSummaryDraft(updatedProfile.summary || '')
        onProfileChanged(updatedProfile)
      }
      const order = nextSections.map((section) => section.section_type)
      setSections(updatedSections.sections.sort((first, second) => order.indexOf(first.section_type) - order.indexOf(second.section_type)))
      setRecords((current) => {
        const next = { ...current }
        for (const pending of pendingRecords) {
          const created = createdRecords[pending.id]
          if (created && !next[pending.type].some((item) => item.id === created.id)) {
            next[pending.type] = [...next[pending.type], created]
          }
        }
        return next
      })
      setPendingRecords([])
      setSavedDraftRecords({})
      setPendingCustomSectionIds([])
      setSummaryOpen(false)
      setNotice('Resume saved successfully.')
    } catch (cause) {
      setError(cause instanceof ApiError
        ? `Some changes may already be saved. ${cause.message} Select Save resume to retry the remaining changes.`
        : `Some changes may already be saved. ${cause instanceof Error ? cause.message : 'Unable to save the resume.'} Select Save resume to retry the remaining changes.`)
    } finally {
      setSaving(false)
    }
  }

  const updateCustomSection = (id: string, patch: Partial<CustomResumeSection>) => {
    setCustomSectionsDraft((current) => current.map((section) => section.id === id ? { ...section, ...patch } : section))
  }

  const updateCustomEntry = (sectionId: string, patch: Partial<CustomResumeEntry>) => {
    setCustomSectionsDraft((current) => current.map((section) => section.id === sectionId
      ? { ...section, entries: section.entries.map((entry, index) => index === 0 ? { ...entry, ...patch } : entry) }
      : section))
  }

  const applyOptimizedBullet = async (replacement: string) => {
    if (!optimizingBullet) return
    const { type, itemId, field, lineIndex, original } = optimizingBullet
    const record = records[type].find((item) => item.id === itemId)
    const currentText = record?.[field]
    if (typeof currentText !== 'string') throw new Error('The original bullet could not be found in this resume.')
    const lines = currentText.split(/\r?\n/)
    if (lines[lineIndex]?.trim() !== original) {
      throw new Error('This bullet changed while the optimizer was open. Reopen it before applying.')
    }
    lines[lineIndex] = replacement
    const updated = await updateSectionRecord(type, itemId, { [field]: lines.join('\n') })
    setRecords((current) => ({
      ...current,
      [type]: current[type].map((item) => item.id === itemId ? updated : item),
    }))
    setNotice('Optimized bullet applied to your resume.')
    setOptimizingBullet(null)
  }

  const addContent = (item: typeof customContentTypes[number]) => {
    setAddContentOpen(false)
    if (item.type) {
      startCreate(item.type)
      return
    }
    if (item.key === 'summary') {
      setSummaryOpen(true)
      setNotice('Add or update your summary below, then save the complete resume.')
      return
    }
    if (!item.customType) return
    if (customSectionsDraft.length >= 12) {
      setError('A resume can contain at most 12 custom sections.')
      return
    }
    const id = crypto.randomUUID()
    const emptyEntry: CustomResumeEntry = { title: '', subtitle: null, date: null, location: null, url: null, description: null }
    setCustomSectionsDraft((current) => [...current, {
      id,
      section_type: item.customType as CustomResumeSectionType,
      title: item.key === 'declaration' ? 'Declaration' : item.title === 'Custom' ? 'Custom section' : item.title,
      entries: [emptyEntry],
    }])
    setPendingCustomSectionIds((current) => [...current, id])
    setNotice(`${item.title} section added to your draft. Complete it and save the resume.`)
  }

  const recordForm = (inline: boolean) => formType && <form className={inline ? 'panel builder-section builder-inline-record-form' : 'modal-card'} onSubmit={(event) => void submitRecord(event)}>
    <div className="panel-title"><div><span className="eyebrow">{editId ? 'EDIT CONTENT' : 'ADD TO RESUME DRAFT'}</span><h2>{sectionInfo.find((entry) => entry.type === formType)?.title}</h2></div><button type="button" className="icon-button" onClick={closeForm} aria-label="Close">×</button></div>
    <div className="form-grid">{fieldsByType[formType].map((field) => <label key={field.name} className={field.type === 'textarea' ? 'field-wide' : field.type === 'checkbox' ? 'check-label' : ''}>{field.type === 'checkbox' ? <><input type="checkbox" checked={Boolean(draft[field.name])} onChange={(event) => setDraft({ ...draft, [field.name]: event.target.checked })} />{field.label}</> : <>{field.label}{field.type === 'textarea' ? <><textarea rows={3} maxLength={field.maxLength} value={String(draft[field.name] || '')} onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })} /><span className="field-hint">{String(draft[field.name] || '').length}/{field.maxLength} characters</span></> : <input required={field.required} type={field.type || 'text'} min={field.type === 'number' ? 0 : field.required ? 2 : undefined} max={field.type === 'number' ? 60 : undefined} step={field.type === 'number' ? 1 : undefined} minLength={field.required && field.type !== 'date' ? 2 : undefined} maxLength={field.maxLength} value={String(draft[field.name] || '')} onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })} />}</>}</label>)}</div>
    {fieldError && <div className="notice notice-error field-validation-error" role="alert">{fieldError}</div>}
    <div className="form-actions"><button type="button" className="button button-secondary" onClick={closeForm}>Cancel</button><button className="button button-primary">{editId ? 'Save changes' : 'Add section'}</button></div>
  </form>

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
        <button type="button" className="builder-back-button" onClick={() => onResumeChanged(resume)}><span aria-hidden="true">←</span> Back to resumes</button>
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
        {summaryOpen && <section className="panel builder-section builder-summary-draft">
          <div className="panel-title"><div><span className="eyebrow">SUMMARY</span><h2>Professional summary</h2><p>Write a short introduction that will appear at the top of your resume.</p></div><button type="button" className="icon-button" onClick={() => setSummaryOpen(false)} aria-label="Close summary editor">×</button></div>
          <label>Summary<textarea rows={5} maxLength={5000} value={summaryDraft} onChange={(event) => setSummaryDraft(event.target.value)} /><span className="field-hint">{summaryDraft.length}/5000 characters</span></label>
        </section>}
        {formType && !editId && recordForm(true)}
        {busy ? <div className="builder-content-loading"><span className="spinner" /><span>Loading resume content…</span></div> : <div className="builder-populated-sections">
          {sections.filter((section) => section.items.length > 0 || pendingRecords.some((item) => item.type === section.section_type)).map((section) => {
            const meta = sectionInfo.find((entry) => entry.type === section.section_type)!
            const selected = section.items
              .slice()
              .sort((a, b) => a.display_order - b.display_order)
              .map((item) => records[section.section_type].find((record) => record.id === item.item_id))
              .filter((record): record is SectionRecord => Boolean(record))
            return <section className="builder-content-section" key={section.section_type}>
              <div className="builder-content-section-heading"><div><h2>{meta.title}</h2><span>{selected.length + pendingRecords.filter((item) => item.type === section.section_type).length} {(selected.length + pendingRecords.filter((item) => item.type === section.section_type).length) === 1 ? 'entry' : 'entries'}</span></div><button type="button" onClick={() => startCreate(section.section_type)}>＋ Add</button></div>
              {selected.map((item) => <article className="content-item" key={item.id}>
                <div className="content-item-heading"><strong>{recordLabel(section.section_type, item)}</strong><span className="content-actions"><button className="text-button" onClick={() => startEdit(section.section_type, item)}>Edit</button><button className="text-button danger-text" onClick={() => void removeRecord(section.section_type, item)}>Delete</button></span></div>
                <p>{summaryFor(section.section_type, item)}</p>
              </article>)}
              {pendingRecords.filter((item) => item.type === section.section_type).map((item) => <article className="content-item draft-content-item" key={item.id}>
                <div className="content-item-heading"><strong>{pendingRecordLabel(item)}</strong><span className="content-actions"><button className="text-button" onClick={() => startEditPending(item)}>Edit</button><button className="text-button danger-text" disabled={saving} onClick={() => void removePendingRecord(item)}>Remove</button></span></div>
                <p>{Object.entries(item.fields).filter(([key, value]) => key !== 'is_current' && key !== 'does_not_expire' && value !== null && value !== '').map(([, value]) => String(value)).join(' · ') || 'Complete this section before saving.'}</p>
                <span className="draft-item-label">Not saved yet</span>
              </article>)}
            </section>
          })}
          {customSectionsDraft.map((section) => <section className="builder-content-section" key={section.id}>
            {pendingCustomSectionIds.includes(section.id) ? <>
              <div className="builder-content-section-heading"><div><h2>{section.title}</h2><span>Not saved yet</span></div><button type="button" className="text-button danger-text" onClick={() => { setCustomSectionsDraft((current) => current.filter((entry) => entry.id !== section.id)); setPendingCustomSectionIds((current) => current.filter((id) => id !== section.id)) }}>Remove</button></div>
              <div className="form-grid builder-custom-entry-draft">
                <label className="field-wide">Section title<input required minLength={2} maxLength={60} value={section.title} onChange={(event) => updateCustomSection(section.id, { title: event.target.value })} /></label>
                <label className="field-wide">Entry title<input required minLength={2} maxLength={200} value={section.entries[0]?.title || ''} onChange={(event) => updateCustomEntry(section.id, { title: event.target.value })} /></label>
                <label>Subtitle<input maxLength={200} value={section.entries[0]?.subtitle || ''} onChange={(event) => updateCustomEntry(section.id, { subtitle: event.target.value || null })} /></label>
                <label>Date<input maxLength={50} value={section.entries[0]?.date || ''} onChange={(event) => updateCustomEntry(section.id, { date: event.target.value || null })} /></label>
                <label>Location<input maxLength={150} value={section.entries[0]?.location || ''} onChange={(event) => updateCustomEntry(section.id, { location: event.target.value || null })} /></label>
                <label>URL<input type="url" maxLength={2048} value={section.entries[0]?.url || ''} onChange={(event) => updateCustomEntry(section.id, { url: event.target.value || null })} /></label>
                <label className="field-wide">Description<textarea rows={3} maxLength={5000} value={section.entries[0]?.description || ''} onChange={(event) => updateCustomEntry(section.id, { description: event.target.value || null })} /></label>
              </div>
            </> : <>
              <div className="builder-content-section-heading"><div><h2>{section.title}</h2><span>{section.entries.length} {section.entries.length === 1 ? 'entry' : 'entries'}</span></div><button type="button" onClick={() => setActiveTab('customize')}>＋ Add</button></div>
              {section.entries.map((entry, index) => <article className="content-item" key={`${section.id}-${index}`}><div className="content-item-heading"><strong>{entry.title}</strong></div>{entry.description && <p>{entry.description}</p>}</article>)}
            </>}
          </section>)}
        </div>}
        <button type="button" className="builder-add-content" onClick={() => setAddContentOpen(true)}><span>＋</span>Add Content</button>
        <div className="builder-save-resume"><span>{hasPendingChanges ? 'Your latest changes are still a draft.' : 'Save your resume when you are ready.'}</span><button type="button" className="button button-primary" disabled={saving || busy || (formType !== null && !editId)} onClick={() => void saveResumeDraft()}>{saving ? 'Saving resume…' : 'Save resume'}</button></div>
      </section>
      <ResumeDocumentPreview
        resume={{ ...resume, custom_sections: customSectionsDraft }}
        profile={{ ...profile, summary: summaryOpen ? summaryDraft : profile.summary }}
        records={records}
        sections={sections}
        pendingRecords={pendingRecords}
        onOptimizeBullet={setOptimizingBullet}
      />
    </div>}

    {activeTab === 'customize' && <div className="builder-customize-content">
      <div className="builder-customize-heading"><div><span className="eyebrow">RESUME BUILDER</span><h1>Customize your resume</h1><p>Update your details, design, and the order of your sections.</p></div><button type="button" className="resume-flow-secondary" onClick={() => setActiveTab('content')}>← Back to content</button></div>
      <ResumeCustomizationPanel
        resume={resume}
        profile={profile}
        onResumeUpdated={(updated) => {
          onResumeUpdated(updated)
          if (!pendingCustomSectionIds.length) setCustomSectionsDraft(updated.custom_sections || [])
        }}
        onProfileChanged={(updated) => {
          onProfileChanged(updated)
          if (!summaryOpen) setSummaryDraft(updated.summary || '')
        }}
      />
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

    {formType && editId && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}>{recordForm(false)}</div>}
    {optimizingBullet && <BulletOptimizerModal
      originalBullet={optimizingBullet.original}
      targetRole={resume.target_role || profile.professional_title || 'Professional'}
      seniorityLevel={profile.profile_type === 'student' ? 'INTERN' : profile.profile_type === 'fresher' ? 'FRESHER' : 'SENIOR'}
      onClose={() => setOptimizingBullet(null)}
      onApply={applyOptimizedBullet}
    />}
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

function pendingRecordLabel(item: PendingRecord): string {
  const keys: Record<SectionType, string> = {
    education: 'degree',
    work_experience: 'job_title',
    technical_skill: 'skill_name',
    project: 'project_name',
    certification: 'certification_name',
    achievement: 'title',
  }
  const label = item.fields[keys[item.type]]
  return typeof label === 'string' && label.trim() ? label : `New ${sectionInfo.find((entry) => entry.type === item.type)?.title || 'resume'} entry`
}

function ResumeDocumentPreview({ resume, profile, records, sections, pendingRecords, onOptimizeBullet }: {
  resume: Resume
  profile: CareerProfile
  records: ItemMap
  sections: ResumeSection[]
  pendingRecords: PendingRecord[]
  onOptimizeBullet: (bullet: OptimizingBullet) => void
}) {
  const included = sections.map((section) => ({
    section,
    items: section.items
      .slice()
      .sort((first, second) => first.display_order - second.display_order)
      .map((item) => records[section.section_type].find((record) => record.id === item.item_id))
      .filter((item): item is SectionRecord => Boolean(item)),
  })).filter((entry) => entry.items.length > 0 || pendingRecords.some((item) => item.type === entry.section.section_type))

  return <aside className={`builder-preview-panel ${resume.template_name}`}>
    <p className="builder-preview-hint">Highlighted bullets may benefit from a verified result. Select one to optimize it.</p>
    <article className="builder-resume-paper">
      <header className="builder-paper-header">
        <h2>{profile.full_name || 'Your name'}</h2>
        {profile.professional_title && <p>{profile.professional_title}</p>}
        <div>{[profile.email, profile.phone, profile.city, profile.linkedin_url].filter(Boolean).join('  ·  ') || 'Email  ·  Phone  ·  Address'}</div>
      </header>
      {profile.summary && <section className="builder-paper-section"><h3>Summary</h3><p>{profile.summary}</p></section>}
      {included.map(({ section, items }) => <section className="builder-paper-section" key={section.section_type}>
        <h3>{sectionInfo.find((entry) => entry.type === section.section_type)?.title}</h3>
        {items.map((item) => <div className="builder-paper-entry" key={item.id}>
          <strong>{recordLabel(section.section_type, item)}</strong>
          {section.section_type === 'work_experience' || section.section_type === 'project'
            ? <>
              {resumeEntryDetails(section.section_type, item) && <span>{resumeEntryDetails(section.section_type, item)}</span>}
              <div className="builder-paper-bullets">{bulletFields(section.section_type, item).map(({ field, text }) => text.split(/\r?\n/).map((line, lineIndex) => line.trim() ? <button
              type="button"
              className={`builder-paper-bullet ${hasMeasurableResult(line) ? '' : 'weak'}`}
              key={`${field}-${lineIndex}`}
              onClick={() => onOptimizeBullet({
                type: section.section_type as 'work_experience' | 'project',
                itemId: item.id,
                field,
                lineIndex,
                original: line.trim(),
              })}
              aria-label={`Optimize bullet: ${line.trim()}`}
              >{line.trim()}</button> : null))}</div>
            </>
            : <span>{summaryFor(section.section_type, item)}</span>}
        </div>)}
        {pendingRecords.filter((item) => item.type === section.section_type).map((item) => <div className="builder-paper-entry" key={item.id}><strong>{pendingRecordLabel(item)}</strong><span>{Object.entries(item.fields).filter(([key, value]) => key !== 'is_current' && key !== 'does_not_expire' && value !== null && value !== '').map(([, value]) => String(value)).join(' · ')}</span></div>)}
      </section>)}
      {(resume.custom_sections || []).filter((section) => section.entries.length > 0).map((section) => <section className="builder-paper-section" key={section.id}>
        <h3>{section.title}</h3>
        {section.entries.map((entry, index) => <div className="builder-paper-entry" key={`${section.id}-${index}`}><strong>{entry.title}</strong><span>{entry.description || entry.subtitle || ''}</span></div>)}
      </section>)}
      {included.length === 0 && !profile.summary && (resume.custom_sections || []).every((section) => !section.entries.length) && <p className="builder-paper-empty">Your resume preview will appear here as you add content.</p>}
    </article>
  </aside>
}

function bulletFields(
  type: 'work_experience' | 'project',
  item: SectionRecord,
): { field: string; text: string }[] {
  const fields = type === 'work_experience'
    ? ['description']
    : ['description', 'responsibilities', 'achievements']
  return fields.flatMap((field) => {
    const value = item[field]
    return typeof value === 'string' && value.trim() ? [{ field, text: value }] : []
  })
}

function resumeEntryDetails(
  type: 'work_experience' | 'project',
  item: SectionRecord,
): string {
  const fields = type === 'work_experience'
    ? ['employment_type', 'location', 'start_date', 'end_date']
    : ['role', 'technologies', 'project_url']
  return fields.map((field) => item[field]).filter((value) => value !== null && value !== undefined && value !== '').join(' · ')
}

function hasMeasurableResult(bullet: string): boolean {
  return /(?:\b\d+(?:[.,]\d+)?\s*%|\$\s?\d|\b\d+(?:[.,]\d+)?\s*(?:ms|seconds?|minutes?|hours?|users?|customers?|teams?|days?|weeks?|months?|years?)\b)/i.test(bullet)
}
