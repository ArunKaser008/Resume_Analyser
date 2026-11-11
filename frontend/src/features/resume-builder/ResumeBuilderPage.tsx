import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useDropzone } from 'react-dropzone'
import { ApiError, apiRequest } from '../../api/client'
import { getCareerProfiles, updateCareerProfile } from '../../api/careerProfiles'
import { createSectionRecord, getSectionRecords, updateSectionRecord } from '../../api/resumeContent'
import {
  createResume,
  deleteResume,
  downloadResume,
  downloadResumeDocx,
  getResumeSections,
  importResume,
  updateResume,
  updateResumeSections,
} from '../../api/resumes'
import type {
  CareerProfile,
  ProfileType,
  Resume,
  ResumeDesignSettings,
  CandidateJDMatch,
  ResumeSection,
  SectionRecord,
  SectionType,
} from '../../api/types'
import { PersonalDetailsForm, ResumeEntryForm } from './ResumeBuilderForms'
import { displayMonth, entryFormSchema, personalFormSchema, toApiDate, type PersonalFormValues } from './resumeValidation'
import './modern-resume-builder.css'

type Entry = { id: string; type: SectionType; fields: Record<string, string | number | boolean | null> }
type MasterResume = {
  resume: Resume
  profile: CareerProfile
  entries: Record<SectionType, Entry[]>
}
type Persona = Extract<ProfileType, 'student' | 'fresher' | 'experienced'>

const sectionTypes: SectionType[] = ['education', 'technical_skill', 'work_experience', 'project', 'certification', 'achievement']
const sectionOrders: Record<Persona, SectionType[]> = {
  student: ['education', 'project', 'technical_skill', 'work_experience', 'certification', 'achievement'],
  fresher: ['technical_skill', 'project', 'education', 'work_experience', 'certification', 'achievement'],
  experienced: ['work_experience', 'technical_skill', 'project', 'education', 'certification', 'achievement'],
}
const sectionLabels: Record<SectionType, string> = {
  education: 'Education',
  technical_skill: 'Skills',
  work_experience: 'Experience',
  project: 'Projects',
  certification: 'Certifications',
  achievement: 'Achievements',
}
const templatePresets: { id: Resume['template_name']; name: string; description: string; layout: ResumeDesignSettings['layout'] }[] = [
  { id: 'classic-clear', name: 'Placement Drive Standard', description: 'Single-column and education-forward.', layout: 'single-column' },
  { id: 'minimal', name: 'Tech Minimalist', description: 'Compact, monochrome and ATS-first.', layout: 'single-column' },
  { id: 'executive', name: 'Modern Executive', description: 'Metrics-focused with professional spacing.', layout: 'single-column' },
  { id: 'atlantic-blue', name: 'Dual-Column Compact', description: 'Sidebar for skills and contact details.', layout: 'two-column' },
]
const accentPalettes = [
  { name: 'Navy', color: '#1F3A5F' },
  { name: 'Charcoal', color: '#343A40' },
  { name: 'Slate', color: '#52677C' },
  { name: 'Emerald', color: '#1F7A5A' },
  { name: 'Burgundy', color: '#7A263A' },
] as const
const approvedFonts: ResumeDesignSettings['font_family'][] = [
  'Inter', 'Roboto', 'Helvetica', 'Arial', 'Georgia', 'Garamond', 'Merriweather',
]
const emptyEntries = (): Record<SectionType, Entry[]> => ({
  education: [],
  technical_skill: [],
  work_experience: [],
  project: [],
  certification: [],
  achievement: [],
})
const defaultFields: Record<SectionType, Record<string, string | number | boolean | null>> = {
  education: { institution_name: '', degree: '', field_of_study: '', start_date: '', end_date: '', is_current: false, grade: '', description: '' },
  technical_skill: { skill_name: '', category: 'Technical', proficiency_level: '', years_of_experience: null },
  work_experience: { company_name: '', job_title: '', employment_type: '', location: '', start_date: '', end_date: '', is_current: false, description: '' },
  project: { project_name: '', role: '', technologies: '', project_url: '', description: '', responsibilities: '', achievements: '' },
  certification: { certification_name: '', issuing_organization: '', credential_id: '', credential_url: '', issue_date: '', expiry_date: '', does_not_expire: false },
  achievement: { title: '', category: '', issuing_organization: '', achievement_date: '', credential_url: '', description: '' },
}
const requiredFields: Record<SectionType, string[]> = {
  education: ['institution_name', 'degree'],
  technical_skill: ['skill_name'],
  work_experience: ['company_name', 'job_title', 'start_date'],
  project: ['project_name'],
  certification: ['certification_name', 'issuing_organization'],
  achievement: ['title'],
}
const displayFields: Record<SectionType, { key: string; label: string; multiline?: boolean }[]> = {
  education: [
    { key: 'degree', label: 'Degree / qualification' },
    { key: 'institution_name', label: 'School / institution' },
    { key: 'field_of_study', label: 'Field of study' },
    { key: 'grade', label: 'Grade / CGPA / marks' },
    { key: 'start_date', label: 'Start date' },
    { key: 'end_date', label: 'Graduation / end date' },
    { key: 'description', label: 'Academic highlights', multiline: true },
  ],
  technical_skill: [
    { key: 'skill_name', label: 'Skill' },
    { key: 'category', label: 'Category' },
    { key: 'proficiency_level', label: 'Proficiency' },
    { key: 'years_of_experience', label: 'Years of experience' },
  ],
  work_experience: [
    { key: 'job_title', label: 'Job title' },
    { key: 'company_name', label: 'Company' },
    { key: 'employment_type', label: 'Employment type' },
    { key: 'location', label: 'Location' },
    { key: 'start_date', label: 'Start date' },
    { key: 'end_date', label: 'End date' },
    { key: 'description', label: 'Responsibilities and impact', multiline: true },
  ],
  project: [
    { key: 'project_name', label: 'Project name' },
    { key: 'role', label: 'Your role' },
    { key: 'technologies', label: 'Technology stack' },
    { key: 'project_url', label: 'Live / code URL' },
    { key: 'description', label: 'Overview', multiline: true },
    { key: 'responsibilities', label: 'What you built', multiline: true },
    { key: 'achievements', label: 'Results / impact', multiline: true },
  ],
  certification: [
    { key: 'certification_name', label: 'Certification' },
    { key: 'issuing_organization', label: 'Issuing organization' },
    { key: 'credential_id', label: 'Credential ID' },
    { key: 'issue_date', label: 'Issue date' },
    { key: 'expiry_date', label: 'Expiry date' },
  ],
  achievement: [
    { key: 'title', label: 'Achievement' },
    { key: 'category', label: 'Category' },
    { key: 'issuing_organization', label: 'Organization' },
    { key: 'achievement_date', label: 'Date' },
    { key: 'description', label: 'Details', multiline: true },
  ],
}

function toEntry(type: SectionType, record: SectionRecord): Entry {
  const fields: Record<string, string | number | boolean | null> = {}
  for (const { key } of displayFields[type]) {
    const value = record[key]
    fields[key] = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null
      ? key.endsWith('_date') ? displayMonth(String(value || '')) : value
      : ''
  }
  if ('is_current' in record) fields.is_current = Boolean(record.is_current)
  if ('does_not_expire' in record) fields.does_not_expire = Boolean(record.does_not_expire)
  return { id: record.id, type, fields }
}

function isComplete(entry: Entry): boolean {
  return requiredFields[entry.type].every((field) => String(entry.fields[field] ?? '').trim().length > 0)
}

function getValidationIssues(master: MasterResume): string[] {
  const personal = personalFormSchema.safeParse({
    full_name: master.profile.full_name,
    professional_title: master.profile.professional_title || '',
    email: master.profile.email || '',
    phone: master.profile.phone || '',
    city: master.profile.city || '',
    summary: master.profile.summary || '',
    linkedin_url: master.profile.linkedin_url || '',
    github_url: master.profile.github_url || '',
    leetcode_url: master.profile.leetcode_url || '',
    portfolio_url: master.profile.portfolio_url || '',
  })
  const issues = personal.success ? [] : personal.error.issues.map((issue) => issue.message)
  for (const type of sectionTypes) {
    for (const entry of master.entries[type]) {
      const result = entryFormSchema(type, master.profile.profile_type).safeParse(entry.fields)
      if (result.success) continue
      for (const issue of result.error.issues) {
        if (!isComplete(entry) && issue.message === 'This field is required.') continue
        issues.push(issue.message)
      }
    }
  }
  return [...new Set(issues)]
}

function rekeyDraftEntries(master: MasterResume, savedIds: Map<string, string>): MasterResume {
  const entries = { ...master.entries }
  for (const type of sectionTypes) {
    entries[type] = master.entries[type].map((entry) => {
      const savedId = savedIds.get(entry.id)
      return savedId ? { ...entry, id: savedId } : entry
    })
  }
  return { ...master, entries }
}

function entryTitle(entry: Entry): string {
  const fields = entry.fields
  if (entry.type === 'education') return String(fields.degree || 'Education')
  if (entry.type === 'technical_skill') return String(fields.skill_name || 'Skill')
  if (entry.type === 'work_experience') return String(fields.job_title || 'Experience')
  if (entry.type === 'project') return String(fields.project_name || 'Project')
  if (entry.type === 'certification') return String(fields.certification_name || 'Certification')
  return String(fields.title || 'Achievement')
}

function recordPayload(entry: Entry): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const field of displayFields[entry.type]) {
    const value = entry.fields[field.key]
    payload[field.key] = field.key.endsWith('_date') && typeof value === 'string'
      ? toApiDate(value)
      : value === '' ? null : value
  }
  if (entry.type === 'education' || entry.type === 'work_experience') {
    payload.is_current = Boolean(entry.fields.is_current)
    if (payload.is_current || String(entry.fields.end_date || '').toLowerCase() === 'present') {
      payload.is_current = true
      payload.end_date = null
    }
  }
  if (entry.type === 'certification') {
    payload.does_not_expire = Boolean(entry.fields.does_not_expire)
    if (payload.does_not_expire) payload.expiry_date = null
  }
  if (entry.type === 'technical_skill' && payload.years_of_experience === '') payload.years_of_experience = null
  return payload
}

interface Props {
  resumes: Resume[]
  profiles: CareerProfile[]
  initialResume?: Resume
  onChanged: () => Promise<void>
  onResumeUpdated: (resume: Resume) => void
  onProfileChanged: (profile: CareerProfile) => void
  onPreview: (resume: Resume) => void
  onAnalyze: (resumeId: string) => void
}

export default function ResumeBuilderPage({
  resumes,
  profiles,
  initialResume,
  onChanged,
  onResumeUpdated,
  onProfileChanged,
  onPreview,
  onAnalyze,
}: Props) {
  const [activeResumeId, setActiveResumeId] = useState(initialResume?.id || '')
  const [master, setMaster] = useState<MasterResume | null>(null)
  const [persona, setPersona] = useState<Persona>('student')
  const [fullName, setFullName] = useState('')
  const [newTitle, setNewTitle] = useState('My Resume')
  const [newRole, setNewRole] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<Resume['template_name']>('classic-clear')
  const [showLibrary, setShowLibrary] = useState(false)
  const [showStyles, setShowStyles] = useState(false)
  const [showMatcher, setShowMatcher] = useState(false)
  const [jobDescription, setJobDescription] = useState('')
  const [matchResult, setMatchResult] = useState<CandidateJDMatch | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [expanded, setExpanded] = useState<SectionType | 'personal' | 'projects' | null>('personal')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [undoEntry, setUndoEntry] = useState<{ entry: Entry; index: number } | null>(null)
  const [autoFit, setAutoFit] = useState(true)
  const [draggedEntry, setDraggedEntry] = useState<{ type: SectionType; id: string } | null>(null)
  const lastSaved = useRef('')
  const saveLock = useRef(false)
  const queuedState = useRef<MasterResume | null>(null)
  const currentMasterRef = useRef<MasterResume | null>(null)
  const loadedResumeId = useRef('')

  const [pageCount, setPageCount] = useState(1)
  const previewPaperRef = useRef<HTMLElement>(null)
  const baseFontSize = master?.resume.design_settings.font_size ?? 11
  const previewFontSize = autoFit && pageCount > 1
    ? Math.max(9.5, baseFontSize - 0.5)
    : baseFontSize
  const validationIssues = useMemo(() => master ? getValidationIssues(master) : [], [master])

  useEffect(() => {
    const paper = previewPaperRef.current
    if (!paper) return
    const measure = () => setPageCount(Math.max(1, Math.ceil(paper.scrollHeight / 1120)))
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    const mutations = new MutationObserver(measure)
    observer?.observe(paper)
    mutations.observe(paper, { childList: true, subtree: true, characterData: true })
    window.addEventListener('resize', measure)
    measure()
    return () => {
      observer?.disconnect()
      mutations.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [master, autoFit, showStyles])

  useEffect(() => {
    currentMasterRef.current = master
  }, [master])

  const loadResume = useCallback(async (resume: Resume) => {
    setLoading(true)
    setError('')
    setNotice('')
    setMaster(null)
    currentMasterRef.current = null
    setActiveResumeId('')
    try {
      const profile = profiles.find((item) => item.id === resume.career_profile_id)
        || (await getCareerProfiles()).find((item) => item.id === resume.career_profile_id)
      if (!profile) throw new Error('The career profile for this resume could not be loaded.')
      const sectionData = await getResumeSections(resume.id)
      const allRecords = await Promise.all(sectionTypes.map((type) => getSectionRecords(type, profile.id)))
      const entries = emptyEntries()
      sectionTypes.forEach((type, index) => {
        const allById = new Map(allRecords[index].map((record) => [record.id, record]))
        const selected = sectionData.sections.find((section) => section.section_type === type)
        entries[type] = (selected?.items || [])
          .slice()
          .sort((left, right) => left.display_order - right.display_order)
          .map((item) => allById.get(item.item_id))
          .filter((record): record is SectionRecord => Boolean(record))
          .map((record) => toEntry(type, record))
      })
      const safeResume = {
        ...resume,
        design_settings: {
          ...resume.design_settings,
          font_family: approvedFonts.includes(resume.design_settings.font_family)
            ? resume.design_settings.font_family
            : 'Arial',
          font_size: 10,
          accent_color: accentPalettes.some((palette) => palette.color === resume.design_settings.accent_color)
            ? resume.design_settings.accent_color
            : '#52677C',
        },
      }
      const next = { resume: safeResume, profile, entries }
      setMaster(next)
      currentMasterRef.current = next
      lastSaved.current = JSON.stringify(next)
      loadedResumeId.current = resume.id
      setPersona(profile.profile_type)
      setFullName(profile.full_name)
      setNewTitle(safeResume.title)
      setNewRole(safeResume.target_role || '')
      setSelectedTemplate(safeResume.template_name)
      setActiveResumeId(resume.id)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : 'Unable to load this resume.')
      setMaster(null)
    } finally {
      setLoading(false)
    }
  }, [profiles])

  useEffect(() => {
    if (initialResume && initialResume.id !== loadedResumeId.current) void loadResume(initialResume)
  }, [initialResume, loadResume])

  const persist = useCallback(async function persistSnapshot(snapshot: MasterResume) {
    if (getValidationIssues(snapshot).length > 0) {
      setError('Fix the highlighted validation issues before saving or exporting.')
      return false
    }
    if (saveLock.current) {
      queuedState.current = snapshot
      return false
    }
    saveLock.current = true
    setSaving(true)
    setError('')
    const persistedIds = new Map<string, string>()
    try {
      let working: MasterResume = { ...snapshot, entries: { ...snapshot.entries } }
      const savedProfile = await updateCareerProfile(snapshot.profile.id, {
        full_name: snapshot.profile.full_name,
        email: snapshot.profile.email,
        phone: snapshot.profile.phone,
        city: snapshot.profile.city,
        professional_title: snapshot.profile.professional_title,
        summary: snapshot.profile.summary,
        linkedin_url: snapshot.profile.linkedin_url,
        github_url: snapshot.profile.github_url,
        leetcode_url: snapshot.profile.leetcode_url,
        portfolio_url: snapshot.profile.portfolio_url,
      })
      const savedResume = await updateResume(snapshot.resume.id, {
        title: snapshot.resume.title,
        target_role: snapshot.resume.target_role,
        template_name: snapshot.resume.template_name,
        design_settings: snapshot.resume.design_settings,
        section_order: sectionOrders[snapshot.profile.profile_type].filter((type) => snapshot.entries[type].length > 0),
      })
      const finalEntries = emptyEntries()
      for (const type of sectionTypes) {
        for (const entry of snapshot.entries[type]) {
          if (!isComplete(entry)) {
            finalEntries[type].push(entry)
            continue
          }
          const payload = recordPayload(entry)
          const savedRecord = entry.id.startsWith('draft-')
            ? await createSectionRecord(type, savedProfile, payload)
            : await updateSectionRecord(type, entry.id, payload)
          if (entry.id.startsWith('draft-')) persistedIds.set(entry.id, savedRecord.id)
          finalEntries[type].push(toEntry(type, savedRecord))
        }
      }
      const sectionPayload: ResumeSection[] = sectionTypes.map((type) => ({
        section_type: type,
        items: finalEntries[type]
          .filter((entry) => !entry.id.startsWith('draft-') && isComplete(entry))
          .map((entry, index) => ({ item_id: entry.id, display_order: index })),
      }))
      await updateResumeSections(savedResume.id, sectionPayload)
      working = { resume: savedResume, profile: savedProfile, entries: finalEntries }
      const signature = JSON.stringify(working)
      lastSaved.current = signature
      currentMasterRef.current = working
      setMaster((current) => {
        if (current?.resume.id !== working.resume.id) return current
        const updated = {
          ...rekeyDraftEntries(current, persistedIds),
          resume: { ...current.resume, updated_at: savedResume.updated_at },
          profile: { ...current.profile, updated_at: savedProfile.updated_at },
        }
        currentMasterRef.current = updated
        return updated
      })
      onResumeUpdated(savedResume)
      onProfileChanged(savedProfile)
      setNotice('All complete changes are saved automatically.')
      return true
    } catch (cause) {
      if (persistedIds.size > 0) {
        setMaster((current) => {
          if (current?.resume.id !== snapshot.resume.id) return current
          const updated = rekeyDraftEntries(current, persistedIds)
          currentMasterRef.current = updated
          return updated
        })
      }
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : 'Autosave failed. Your editor state is preserved.')
      return false
    } finally {
      saveLock.current = false
      setSaving(false)
      let queued = queuedState.current
      queuedState.current = null
      if (queued?.resume.id === snapshot.resume.id) queued = rekeyDraftEntries(queued, persistedIds)
      if (queued && JSON.stringify(queued) !== lastSaved.current) void persistSnapshot(queued)
    }
  }, [onProfileChanged, onResumeUpdated])

  useEffect(() => {
    if (!master || loading || JSON.stringify(master) === lastSaved.current) return
    const timeout = window.setTimeout(() => void persist(master), 850)
    return () => window.clearTimeout(timeout)
  }, [master, loading, persist])

  useEffect(() => {
    if (!undoEntry) return
    const timeout = window.setTimeout(() => setUndoEntry(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [undoEntry])

  const patchMaster = (patch: Partial<Pick<MasterResume, 'resume' | 'profile' | 'entries'>>) => {
    setMaster((current) => {
      if (!current) return current
      const next = { ...current, ...patch }
      currentMasterRef.current = next
      return next
    })
  }

  const createNewResume = async () => {
    setError('')
    if (fullName.trim().length < 2) {
      setError('Enter your name to create a resume.')
      return
    }
    setLoading(true)
    try {
      const resume = await createResume({
        title: newTitle.trim() || 'My Resume',
        full_name: fullName.trim(),
        profile_type: persona,
        target_role: persona === 'student' ? undefined : newRole.trim() || undefined,
        template_name: selectedTemplate,
        design_settings: {
          layout: templatePresets.find((template) => template.id === selectedTemplate)?.layout || 'single-column',
          font_family: 'Inter',
          font_size: 10,
          spacing: 'comfortable',
          accent_color: '#52677C',
          page_size: 'A4',
        },
        section_order: sectionOrders[persona],
      })
      await onChanged()
      const profile = (await getCareerProfiles()).find((item) => item.id === resume.career_profile_id)
      if (!profile) throw new Error('Resume created, but its profile could not be loaded.')
      const next = { resume, profile, entries: emptyEntries() }
      setMaster(next)
      currentMasterRef.current = next
      lastSaved.current = JSON.stringify(next)
      loadedResumeId.current = resume.id
      setActiveResumeId(resume.id)
      onResumeUpdated(resume)
      onProfileChanged(profile)
      setNotice('Resume created. Your changes will autosave as you edit.')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : 'Unable to create the resume.')
    } finally {
      setLoading(false)
    }
  }

  const importFile = useCallback(async (file?: File) => {
    if (!file) return
    setError('')
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError('Choose a PDF or DOCX file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Resume files cannot exceed 5 MB.')
      return
    }
    setLoading(true)
    try {
      const imported = await importResume(file, persona, newRole)
      const resume = await updateResume(imported.resume.id, { template_name: selectedTemplate })
      await onChanged()
      onResumeUpdated(resume)
      onProfileChanged(imported.career_profile)
      await loadResume(resume)
      setNotice('Resume imported and parsed. Review the extracted details before exporting.')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to import this resume.')
    } finally {
      setLoading(false)
    }
  }, [loadResume, newRole, onChanged, onProfileChanged, onResumeUpdated, persona, selectedTemplate])

  const onDrop = useCallback((files: File[]) => void importFile(files[0]), [importFile])
  const { getRootProps, getInputProps, isDragActive, open: openDropzone } = useDropzone({
    onDrop,
    onDropRejected: (rejections) => {
      const code = rejections[0]?.errors[0]?.code
      setError(code === 'file-too-large' ? 'Resume files cannot exceed 5 MB.' : 'Choose a PDF or DOCX file.')
    },
    accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    noClick: true,
  })

  const addEntry = (type: SectionType) => {
    const entry: Entry = { id: `draft-${crypto.randomUUID()}`, type, fields: { ...defaultFields[type] } }
    patchMaster({ entries: { ...master!.entries, [type]: [...master!.entries[type], entry] } })
    setExpanded(type)
    setNotice(`New ${sectionLabels[type].toLowerCase()} entry added. Complete required fields to save it.`)
  }

  const updateEntry = (type: SectionType, id: string, key: string, value: string | number | boolean | null) => {
    if (!master) return
    patchMaster({
      entries: {
        ...master.entries,
        [type]: master.entries[type].map((entry) => entry.id === id
          ? { ...entry, fields: { ...entry.fields, [key]: value } }
          : entry),
      },
    })
  }

  const removeEntry = (type: SectionType, entry: Entry) => {
    if (!master) return
    const index = master.entries[type].findIndex((item) => item.id === entry.id)
    patchMaster({ entries: { ...master.entries, [type]: master.entries[type].filter((item) => item.id !== entry.id) } })
    setUndoEntry({ entry, index })
    setNotice(`${entryTitle(entry)} removed from this resume. Undo is available for 5 seconds.`)
  }

  const undoRemove = () => {
    if (!master || !undoEntry) return
    const { entry, index } = undoEntry
    const entries = [...master.entries[entry.type]]
    entries.splice(Math.min(index, entries.length), 0, entry)
    patchMaster({ entries: { ...master.entries, [entry.type]: entries } })
    setUndoEntry(null)
    setNotice('Resume entry restored.')
  }

  const reorder = (type: SectionType, targetId: string) => {
    if (!master || !draggedEntry || draggedEntry.type !== type || draggedEntry.id === targetId) return
    const values = [...master.entries[type]]
    const from = values.findIndex((entry) => entry.id === draggedEntry.id)
    const to = values.findIndex((entry) => entry.id === targetId)
    if (from < 0 || to < 0) return
    const [item] = values.splice(from, 1)
    values.splice(to, 0, item)
    patchMaster({ entries: { ...master.entries, [type]: values } })
    setDraggedEntry(null)
  }

  const moveEntry = (type: SectionType, id: string, offset: -1 | 1) => {
    if (!master) return
    const values = [...master.entries[type]]
    const from = values.findIndex((entry) => entry.id === id)
    const to = from + offset
    if (from < 0 || to < 0 || to >= values.length) return
    const moved = values[from]
    values[from] = values[to]
    values[to] = moved
    patchMaster({ entries: { ...master.entries, [type]: values } })
  }

  const chooseTemplate = (id: Resume['template_name']) => {
    if (!master) {
      setSelectedTemplate(id)
      return
    }
    const preset = templatePresets.find((item) => item.id === id)
    patchMaster({
      resume: {
        ...master.resume,
        template_name: id,
        design_settings: { ...master.resume.design_settings, layout: preset?.layout || 'single-column' },
      },
    })
  }

  const exportText = () => {
    if (!master) return
    const lines = [
      master.profile.full_name,
      master.resume.target_role || master.profile.professional_title || '',
      [master.profile.email, master.profile.phone, master.profile.city, master.profile.linkedin_url, master.profile.github_url, master.profile.leetcode_url, master.profile.portfolio_url].filter(Boolean).join(' | '),
      '',
      master.profile.summary || '',
      ...sectionTypes.flatMap((type) => [
        '',
        sectionLabels[type].toUpperCase(),
        ...master.entries[type].filter(isComplete).map((entry) => `- ${entryTitle(entry)}: ${Object.values(entry.fields).filter((value) => typeof value === 'string' && value.trim()).join(' | ')}`),
      ]),
    ].filter((line) => line !== undefined)
    downloadBlob(lines.join('\n'), `${safeFileName(master.resume.title)}.txt`, 'text/plain;charset=utf-8')
  }

  const exportJson = () => {
    if (!master) return
    downloadBlob(JSON.stringify(master, null, 2), `${safeFileName(master.resume.title)}.json`, 'application/json')
  }

  const exportPdf = async (format: 'pdf' | 'docx') => {
    if (!master) return
    if (validationIssues.length > 0) {
      setError('Fix the highlighted validation issues before exporting.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const saved = await persist(master)
      if (!saved) return
      const blob = format === 'pdf' ? await downloadResume(master.resume.id) : await downloadResumeDocx(master.resume.id)
      downloadBlob(blob, `${safeFileName(master.resume.title)}.${format}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to export ${format.toUpperCase()}.`)
    } finally {
      setLoading(false)
    }
  }

  const matchJob = async () => {
    if (!master) return
    if (jobDescription.trim().length < 100) {
      setError('Enter at least 100 characters of job description for matching.')
      return
    }
    setMatchLoading(true)
    setError('')
    try {
      const result = await apiRequest<CandidateJDMatch>(`/resumes/${master.resume.id}/match-job-description`, {
        method: 'POST',
        body: JSON.stringify({ job_description: jobDescription.trim() }),
      })
      setMatchResult(result)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to match this resume to the job description.')
    } finally {
      setMatchLoading(false)
    }
  }

  const deleteSavedResume = async (resume: Resume) => {
    if (!window.confirm(`Delete “${resume.title}”? This cannot be undone.`)) return
    try {
      await deleteResume(resume.id)
      await onChanged()
      if (activeResumeId === resume.id) {
        setMaster(null)
        setActiveResumeId('')
        loadedResumeId.current = ''
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete this resume.')
    }
  }

  const renderWorkspace = () => {
    if (!master) return null
    const updateProfileField = (field: keyof PersonalFormValues, value: string) => {
      if (field === 'full_name') {
        patchMaster({ profile: { ...master.profile, full_name: value } })
        return
      }
      const nullableValue = value || null
      if (field === 'professional_title') patchMaster({ profile: { ...master.profile, professional_title: nullableValue } })
      if (field === 'email') patchMaster({ profile: { ...master.profile, email: nullableValue } })
      if (field === 'phone') patchMaster({ profile: { ...master.profile, phone: nullableValue } })
      if (field === 'city') patchMaster({ profile: { ...master.profile, city: nullableValue } })
      if (field === 'linkedin_url') patchMaster({ profile: { ...master.profile, linkedin_url: nullableValue } })
      if (field === 'github_url') patchMaster({ profile: { ...master.profile, github_url: nullableValue } })
      if (field === 'leetcode_url') patchMaster({ profile: { ...master.profile, leetcode_url: nullableValue } })
      if (field === 'portfolio_url') patchMaster({ profile: { ...master.profile, portfolio_url: nullableValue } })
      if (field === 'summary') patchMaster({ profile: { ...master.profile, summary: nullableValue } })
    }
    const updateResumeField = (field: 'title' | 'target_role', value: string) => {
      if (field === 'title') patchMaster({ resume: { ...master.resume, title: value } })
      else patchMaster({ resume: { ...master.resume, target_role: value || null } })
    }
    const groupTypes = sectionOrders[master.profile.profile_type]
    const skills = master.entries.technical_skill.filter(isComplete)
    const contact = [master.profile.email, master.profile.phone, master.profile.city, master.profile.linkedin_url, master.profile.github_url, master.profile.leetcode_url, master.profile.portfolio_url].filter((item): item is string => Boolean(item))

    return <div className="modern-builder-workspace">
      <header className="modern-builder-toolbar">
        <button type="button" className="mb-quiet-button" onClick={() => { setMaster(null); setActiveResumeId(''); setShowLibrary(true) }}>← My resumes</button>
        <label className="mb-resume-title">Resume name<input value={master.resume.title} maxLength={150} onChange={(event) => updateResumeField('title', event.target.value)} /></label>
        <span className={`mb-save-indicator ${saving ? 'is-saving' : ''}`} role="status">{saving ? 'Saving…' : 'Autosaved'}</span>
        <button type="button" className="mb-quiet-button" onClick={() => setShowStyles((value) => !value)}>Styles</button>
        <button type="button" className="mb-quiet-button" onClick={() => setShowMatcher((value) => !value)}>Match a JD</button>
        <button type="button" className="mb-primary-button" onClick={() => onAnalyze(master.resume.id)}>ATS check</button>
        <button type="button" className="mb-primary-button" disabled={loading || saving || validationIssues.length > 0} onClick={() => void exportPdf('pdf')} aria-describedby={validationIssues.length ? 'mb-validation-summary' : undefined}>Export PDF</button>
        <button type="button" className="mb-more-button" aria-label="More export options" onClick={exportText}>TXT</button>
        <button type="button" className="mb-more-button" onClick={exportJson}>JSON</button>
      </header>
      {validationIssues.length > 0 && <div className="mb-validation-summary" id="mb-validation-summary" role="status">
        Resolve the highlighted fields before exporting. {validationIssues[0]}
      </div>}
      {showStyles && <section className="mb-style-drawer" aria-label="Resume style controls">
        <div><h2>Style and template</h2><button className="mb-quiet-button" onClick={() => setShowStyles(false)}>Close</button></div>
        <div className="mb-template-options">{templatePresets.map((template) => <button key={template.id} className={master.resume.template_name === template.id ? 'selected' : ''} onClick={() => chooseTemplate(template.id)}><strong>{template.name}</strong><span>{template.description}</span></button>)}</div>
        <label>Accent palette<select value={master.resume.design_settings.accent_color} onChange={(event) => patchMaster({ resume: { ...master.resume, design_settings: { ...master.resume.design_settings, accent_color: event.target.value } } })}>{accentPalettes.map((palette) => <option key={palette.name} value={palette.color}>{palette.name}</option>)}</select></label>
        <span className="mb-palette-preview" style={{ backgroundColor: master.resume.design_settings.accent_color }} aria-label="Selected accent color" />
        <label>Font<select value={master.resume.design_settings.font_family} onChange={(event) => patchMaster({ resume: { ...master.resume, design_settings: { ...master.resume.design_settings, font_family: event.target.value as ResumeDesignSettings['font_family'] } } })}>{approvedFonts.map((font) => <option key={font} value={font}>{font}</option>)}</select></label>
        <label>Spacing<select value={master.resume.design_settings.spacing} onChange={(event) => patchMaster({ resume: { ...master.resume, design_settings: { ...master.resume.design_settings, spacing: event.target.value as ResumeDesignSettings['spacing'] } } })}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></label>
        <label className="mb-toggle"><input type="checkbox" checked={autoFit} onChange={(event) => setAutoFit(event.target.checked)} />Single-page guardrail</label>
      </section>}
      {showMatcher && <section className="mb-match-drawer" aria-label="Target job description matcher">
        <div><h2>Target JD matcher</h2><button className="mb-quiet-button" onClick={() => setShowMatcher(false)}>Close</button></div>
        <textarea value={jobDescription} maxLength={20000} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste at least 100 characters from the target job description." />
        <button className="mb-primary-button" disabled={matchLoading} onClick={() => void matchJob()}>{matchLoading ? 'Matching…' : 'Check keyword overlap'}</button>
        {matchResult && <div className="mb-match-result"><strong>{Math.round(matchResult.overall_match_score)}% match</strong><p>{matchResult.summary}</p>{matchResult.missing_skills.length > 0 && <div><b>Skills to review</b><ul>{matchResult.missing_skills.map((skill) => <li key={skill.skill_name}>{skill.skill_name}</li>)}</ul></div>}</div>}
      </section>}
      <div className="modern-builder-columns">
        <section className="modern-builder-editor" aria-label="Resume section editor">
          <div className="mb-editor-heading"><div><span className="mb-eyebrow">MASTER RESUME</span><h1>Build your story</h1><p>Changes are reflected in the live preview and autosaved.</p></div><button className="mb-add-entry" onClick={() => addEntry(persona === 'student' ? 'education' : persona === 'fresher' ? 'project' : 'work_experience')}>＋ Add section</button></div>
          <details className="mb-accordion" open={expanded === 'personal'} onToggle={(event) => { if ((event.currentTarget as HTMLDetailsElement).open) setExpanded('personal') }}>
            <summary><span>Personal information</span><small>Name, contact and professional summary</small></summary>
            <PersonalDetailsForm
              key={master.resume.id}
              profile={master.profile}
              targetRole={master.resume.target_role || ''}
              onProfileChange={updateProfileField}
              onTargetRoleChange={(value) => updateResumeField('target_role', value)}
            />
          </details>
          {groupTypes.map((type) => <details className="mb-accordion" key={type} open={expanded === type} onToggle={(event) => { if ((event.currentTarget as HTMLDetailsElement).open) setExpanded(type) }}>
            <summary><span>{sectionLabels[type]}</span><small>{master.entries[type].filter(isComplete).length} entries</small></summary>
            <div className="mb-entry-list">
              {master.entries[type].map((entry, entryIndex) => <article
                className="mb-entry-card"
                key={entry.id}
                draggable
                onDragStart={() => setDraggedEntry({ type, id: entry.id })}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => reorder(type, entry.id)}
              >
                <div className="mb-entry-card-heading">
                  <span className="mb-drag-handle" aria-label="Drag to reorder">⠿</span>
                  <strong>{entryTitle(entry)}</strong>
                  <button type="button" className="mb-move-entry" aria-label={`Move ${entryTitle(entry)} up`} disabled={entryIndex === 0} onClick={() => moveEntry(type, entry.id, -1)}>↑</button>
                  <button type="button" className="mb-move-entry" aria-label={`Move ${entryTitle(entry)} down`} disabled={entryIndex === master.entries[type].length - 1} onClick={() => moveEntry(type, entry.id, 1)}>↓</button>
                  <button type="button" className="mb-delete-entry" aria-label={`Remove ${entryTitle(entry)}`} onClick={() => removeEntry(type, entry)}>Remove</button>
                </div>
                <ResumeEntryForm
                  key={entry.id}
                  entry={entry}
                  profileType={master.profile.profile_type}
                  fields={displayFields[type]}
                  onUpdate={(key, value) => updateEntry(type, entry.id, key, value)}
                />
                {(type === 'work_experience' || type === 'education') && <label className="mb-toggle"><input type="checkbox" checked={Boolean(entry.fields.is_current)} onChange={(event) => updateEntry(type, entry.id, 'is_current', event.target.checked)} />Current</label>}
                {type === 'certification' && <label className="mb-toggle"><input type="checkbox" checked={Boolean(entry.fields.does_not_expire)} onChange={(event) => updateEntry(type, entry.id, 'does_not_expire', event.target.checked)} />Does not expire</label>}
              </article>)}
              {master.entries[type].length === 0 && <p className="mb-empty-section">No {sectionLabels[type].toLowerCase()} added yet.</p>}
              <button type="button" className="mb-add-entry" onClick={() => addEntry(type)}>＋ Add {sectionLabels[type].toLowerCase()}</button>
            </div>
          </details>)}
        </section>
        <aside className={`modern-builder-preview ${pageCount > 1 ? 'has-overflow' : ''}`} aria-label="Live resume preview">
          <div className="mb-preview-toolbar"><div><strong>Live preview</strong><span>{pageCount} {pageCount === 1 ? 'page' : 'pages'}{pageCount === 1 ? ' · ATS ready' : autoFit ? ' · Auto-fit applied' : ' · Review page fit'}</span></div><button className="mb-quiet-button" onClick={() => onPreview(master.resume)}>Full preview</button></div>
          {pageCount > 1 && master.profile.profile_type !== 'experienced' && <div className="mb-page-warning" role="status">Content exceeds 1 page (A4 safety limit)</div>}
          <article ref={previewPaperRef} className={`mb-resume-paper ${master.resume.design_settings.layout === 'two-column' ? 'two-column' : ''}`} style={{ '--mb-accent': master.resume.design_settings.accent_color, '--mb-font': master.resume.design_settings.font_family, '--mb-font-size': `${previewFontSize * 4 / 3}px`, '--mb-spacing': autoFit && pageCount > 1 ? '.55' : master.resume.design_settings.spacing === 'compact' ? '.55' : master.resume.design_settings.spacing === 'spacious' ? '1.35' : '1' } as CSSProperties}>
            <header><h1>{master.profile.full_name || 'Your name'}</h1><p>{master.resume.target_role || master.profile.professional_title || 'Target role'}</p><small>{contact.map((item) => formatUrlForDisplay(item)).join(' · ') || 'Email · Phone · Location · Links'}</small></header>
            {master.profile.summary && <section><h3>Profile</h3><p>{master.profile.summary}</p></section>}
            {groupTypes.map((type) => {
              const items = master.entries[type].filter(isComplete)
              if (!items.length) return null
              return <section key={type}><h3>{sectionLabels[type]}</h3>{items.map((entry) => <div className="mb-preview-entry" key={entry.id}><strong>{entryTitle(entry)}</strong><span>{String(entry.fields.institution_name || entry.fields.company_name || entry.fields.technologies || entry.fields.category || '')}</span><p>{Object.entries(entry.fields).filter(([key, value]) => !['is_current', 'does_not_expire', 'institution_name', 'company_name', 'job_title', 'degree', 'project_name', 'skill_name', 'certification_name', 'title', 'category'].includes(key) && typeof value === 'string' && value.trim()).map(([, value]) => value).join(' · ')}</p></div>)}</section>
            })}
            {skills.length === 0 && <section><h3>Skills</h3><p>Add technical skills to complete this section.</p></section>}
          </article>
        </aside>
      </div>
      {notice && <div className="mb-toast" role="status">{notice}{undoEntry && <button onClick={undoRemove}>Undo</button>}</div>}
      {error && <div className="mb-error" role="alert">{error}</div>}
    </div>
  }

  if (activeResumeId && master) return renderWorkspace()
  if (loading) return <div className="modern-builder-loading panel" role="status"><span className="spinner" /><p>Loading your resume workspace…</p></div>
  if (activeResumeId && !master && !error) return <div className="modern-builder-loading panel" role="status"><span className="spinner" /><p>Loading resume details…</p></div>

  return <main className="modern-builder-home">
    <header className="mb-home-header"><div><span className="mb-eyebrow">MENTORMUNI RESUME STUDIO</span><h1>Build a resume that opens doors.</h1><p>ATS-first templates, live preview, and a single place for every version.</p></div><button className="mb-primary-button" onClick={() => setShowLibrary((value) => !value)}>{showLibrary ? 'Start a new resume' : `My Resumes (${resumes.length})`}</button></header>
    <div {...getRootProps({ className: `mb-import-dropzone ${isDragActive ? 'drag-active' : ''}` })}>
      <input {...getInputProps()} />
      <div><span aria-hidden="true">↑</span><div><strong>{isDragActive ? 'Drop your resume to import' : 'Import an existing resume'}</strong><p>PDF or DOCX · 5 MB max · Text is extracted for editing</p></div></div>
      <button type="button" className="mb-quiet-button" onClick={openDropzone}>Choose file</button>
    </div>
    {error && <p className="mb-error" role="alert">{error}</p>}
    {showLibrary ? <section className="mb-library" aria-label="Saved resumes">
      {resumes.length === 0 ? <p className="mb-empty-section">No saved resumes yet. Choose a pathway below to start.</p> : resumes.map((resume) => <article className="mb-library-row" key={resume.id}>
        <div><strong>{resume.title}</strong><span>{resume.target_role || 'Target role not set'} · Updated {new Date(resume.updated_at).toLocaleDateString()}</span></div>
        <button className="mb-quiet-button" onClick={() => onPreview(resume)}>Preview</button>
        <button className="mb-primary-button" onClick={() => void loadResume(resume)}>Edit</button>
        <button className="mb-delete-entry" onClick={() => void deleteSavedResume(resume)}>Delete</button>
      </article>)}
    </section> : <>
      <section className="mb-personas" aria-labelledby="persona-heading">
        <div className="mb-section-heading"><div><span className="mb-eyebrow">CHOOSE YOUR PATHWAY</span><h2 id="persona-heading">Who are you building for?</h2></div></div>
        <div className="mb-persona-grid">
          {([
            ['student', 'Campus Drive / Student', 'Education, CGPA, 10th/12th results and project work.'],
            ['fresher', 'Fresher / Early Career', 'Technical skills, GitHub, LeetCode and projects.'],
            ['experienced', 'Working Professional', 'Experience, impact metrics and leadership.'],
          ] as const).map(([id, title, description]) => <button className={`mb-persona-card ${persona === id ? 'selected' : ''}`} key={id} onClick={() => setPersona(id)}><span className="mb-persona-check">{persona === id ? '✓' : '+'}</span><strong>{title}</strong><p>{description}</p></button>)}
        </div>
      </section>
      <section className="mb-template-section"><div className="mb-section-heading"><div><span className="mb-eyebrow">START WITH A TEMPLATE</span><h2>Select a clean, ATS-readable layout</h2></div></div>
        <div className="mb-template-gallery">{templatePresets.map((template) => <button className={`mb-template-card ${selectedTemplate === template.id ? 'selected' : ''}`} key={template.id} onClick={() => setSelectedTemplate(template.id)}><div className={`mb-template-thumbnail ${template.layout === 'two-column' ? 'columns' : ''}`}><i /><i /><i /><i /><i /></div><strong>{template.name}</strong><span>{template.description}</span></button>)}</div>
      </section>
      <section className="mb-create-card"><div className="mb-create-inputs"><label>Your name<input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="e.g. Alex Morgan" /></label><label>Resume version<input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Backend Engineer v1" /></label>{persona !== 'student' && <label>Target role<input value={newRole} onChange={(event) => setNewRole(event.target.value)} placeholder="e.g. Backend Engineer" /></label>}</div><button className="mb-primary-button mb-create-button" disabled={loading} onClick={() => void createNewResume()}>{loading ? 'Creating…' : 'Create my resume'}</button></section>
    </>}
  </main>
}

function downloadBlob(blobOrText: Blob | string, filename: string, mimeType?: string) {
  const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type: mimeType || 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function safeFileName(value: string) {
  return value.trim().replace(/[^\w.-]+/g, '-') || 'resume'
}

function formatUrlForDisplay(value: string): string {
  try {
    const url = new URL(value)
    if (!url.hostname.includes('.')) return value
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`
  } catch {
    return value
  }
}
