import { useState, type FormEvent } from 'react'
import { updateCareerProfile } from '../../api/careerProfiles'
import { ApiError } from '../../api/client'
import { updateResume } from '../../api/resumes'
import type {
  CareerProfile,
  CustomResumeEntry,
  CustomResumeSection,
  CustomResumeSectionType,
  Resume,
  ResumeDesignSettings,
  ResumeTemplate,
} from '../../api/types'
import { defaultResumeDesign } from '../../api/types'
import { resumeTemplates } from './resumeTemplates'

const sectionTypes: { value: CustomResumeSectionType; label: string }[] = [
  { value: 'language', label: 'Languages' },
  { value: 'volunteer', label: 'Volunteer experience' },
  { value: 'publication', label: 'Publications' },
  { value: 'course', label: 'Courses' },
  { value: 'interest', label: 'Interests' },
  { value: 'reference', label: 'References' },
  { value: 'custom', label: 'Custom section' },
]

type Props = {
  resume: Resume
  profile: CareerProfile
  onResumeUpdated: (resume: Resume) => void
  onProfileChanged: (profile: CareerProfile) => void
}

export default function ResumeCustomizationPanel({
  resume,
  profile,
  onResumeUpdated,
  onProfileChanged,
}: Props) {
  const [design, setDesign] = useState<ResumeDesignSettings>({
    ...defaultResumeDesign,
    ...resume.design_settings,
  })
  const [template, setTemplate] = useState<ResumeTemplate>(resume.template_name)
  const [customSections, setCustomSections] = useState<CustomResumeSection[]>(resume.custom_sections || [])
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [newSectionType, setNewSectionType] = useState<CustomResumeSectionType>('language')
  const [profileDraft, setProfileDraft] = useState({
    full_name: profile.full_name,
    email: profile.email || '',
    phone: profile.phone || '',
    city: profile.city || '',
    professional_title: profile.professional_title || '',
    summary: profile.summary || '',
    linkedin_url: profile.linkedin_url || '',
    github_url: profile.github_url || '',
    portfolio_url: profile.portfolio_url || '',
  })
  const [savingDesign, setSavingDesign] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const saveResumeFields = async (
    nextDesign: ResumeDesignSettings,
    nextSections: CustomResumeSection[],
    successMessage: string,
    nextTemplate = template,
  ) => {
    setSavingDesign(true)
    setError('')
    setNotice('')
    try {
      const updated = await updateResume(resume.id, {
        template_name: nextTemplate,
        design_settings: nextDesign,
        custom_sections: nextSections,
      })
      setDesign(nextDesign)
      setTemplate(nextTemplate)
      setCustomSections(nextSections)
      onResumeUpdated(updated)
      setNotice(successMessage)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save resume design.')
    } finally {
      setSavingDesign(false)
    }
  }

  const addSection = (event: FormEvent) => {
    event.preventDefault()
    const title = newSectionTitle.trim()
    if (customSections.length >= 12) {
      setError('A resume can contain at most 12 custom sections.')
      return
    }
    if (title.length < 2 || title.length > 60) {
      setError('Section titles must contain 2 to 60 characters.')
      return
    }
    const next = [...customSections, {
      id: crypto.randomUUID(),
      section_type: newSectionType,
      title,
      entries: [],
    }]
    setNewSectionTitle('')
    void saveResumeFields(design, next, 'Custom section added.')
  }

  const updateSection = (id: string, patch: Partial<CustomResumeSection>) => {
    setCustomSections((current) => current.map((section) => section.id === id ? { ...section, ...patch } : section))
  }

  const saveCustomSections = () => {
    if (customSections.some((section) => section.title.trim().length < 2 || section.title.length > 60)) {
      setError('Each section title must contain 2 to 60 characters.')
      return
    }
    void saveResumeFields(design, customSections, 'Custom sections saved.')
  }

  const removeSection = (id: string) => {
    const next = customSections.filter((section) => section.id !== id)
    void saveResumeFields(design, next, 'Custom section removed.')
  }

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()
    setSavingProfile(true)
    setError('')
    setNotice('')
    try {
      const updated = await updateCareerProfile(profile.id, {
        full_name: profileDraft.full_name.trim(),
        email: profileDraft.email.trim() || null,
        phone: profileDraft.phone.trim() || null,
        city: profileDraft.city.trim() || null,
        professional_title: profileDraft.professional_title.trim() || null,
        summary: profileDraft.summary.trim() || null,
        linkedin_url: profileDraft.linkedin_url.trim() || null,
        github_url: profileDraft.github_url.trim() || null,
        portfolio_url: profileDraft.portfolio_url.trim() || null,
      })
      onProfileChanged(updated)
      setNotice('Personal details saved.')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save personal details.')
    } finally {
      setSavingProfile(false)
    }
  }

  return <section className="builder-customization">
    <section className="panel builder-section">
      <div className="panel-title"><div><span className="eyebrow">PERSONAL DETAILS</span><h2>Contact information and summary</h2><p>These details appear at the top of your resume.</p></div></div>
      <form className="form-grid" onSubmit={(event) => void saveProfile(event)}>
        <label>Full name<input required minLength={2} maxLength={150} value={profileDraft.full_name} onChange={(event) => setProfileDraft({ ...profileDraft, full_name: event.target.value })} /></label>
        <label>Professional title<input maxLength={200} value={profileDraft.professional_title} onChange={(event) => setProfileDraft({ ...profileDraft, professional_title: event.target.value })} /></label>
        <label>Email<input type="email" maxLength={254} value={profileDraft.email} onChange={(event) => setProfileDraft({ ...profileDraft, email: event.target.value })} /></label>
        <label>Phone<input type="tel" minLength={7} maxLength={30} pattern="[+0-9().\\-\\s]+" value={profileDraft.phone} onChange={(event) => setProfileDraft({ ...profileDraft, phone: event.target.value })} /></label>
        <label>City<input maxLength={100} value={profileDraft.city} onChange={(event) => setProfileDraft({ ...profileDraft, city: event.target.value })} /></label>
        <label>LinkedIn URL<input type="url" maxLength={2048} value={profileDraft.linkedin_url} onChange={(event) => setProfileDraft({ ...profileDraft, linkedin_url: event.target.value })} /></label>
        <label>GitHub URL<input type="url" maxLength={2048} value={profileDraft.github_url} onChange={(event) => setProfileDraft({ ...profileDraft, github_url: event.target.value })} /></label>
        <label>Portfolio URL<input type="url" maxLength={2048} value={profileDraft.portfolio_url} onChange={(event) => setProfileDraft({ ...profileDraft, portfolio_url: event.target.value })} /></label>
        <label className="field-wide">Professional summary<textarea rows={4} maxLength={5000} value={profileDraft.summary} onChange={(event) => setProfileDraft({ ...profileDraft, summary: event.target.value })} /><span className="field-hint">{profileDraft.summary.length}/5000 characters</span></label>
        <div className="form-actions field-wide"><button className="button button-primary" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save personal details'}</button></div>
      </form>
    </section>

    <section className="panel builder-section">
      <div className="panel-title"><div><span className="eyebrow">DESIGN</span><h2>Layout and styling</h2><p>Customize the page while keeping content readable and ATS-friendly.</p></div></div>
      <div className="form-grid design-grid">
        <label>Template<select value={template} onChange={(event) => void saveResumeFields(design, customSections, 'Template updated.', event.target.value as ResumeTemplate)}>{resumeTemplates.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}</select></label>
        <label>Layout<select value={design.layout} onChange={(event) => setDesign({ ...design, layout: event.target.value as ResumeDesignSettings['layout'] })}><option value="single-column">Single column</option><option value="two-column">Two columns</option></select></label>
        <label>Font<select value={design.font_family} onChange={(event) => setDesign({ ...design, font_family: event.target.value as ResumeDesignSettings['font_family'] })}><option>Arial</option><option>Georgia</option><option>Inter</option><option>Tahoma</option></select></label>
        <label>Font size<select value={design.font_size} onChange={(event) => setDesign({ ...design, font_size: Number(event.target.value) })}>{[10, 11, 12, 13, 14].map((size) => <option key={size} value={size}>{size} px</option>)}</select></label>
        <label>Section spacing<select value={design.spacing} onChange={(event) => setDesign({ ...design, spacing: event.target.value as ResumeDesignSettings['spacing'] })}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></label>
        <label>Accent color<input type="color" value={design.accent_color} onChange={(event) => setDesign({ ...design, accent_color: event.target.value })} /></label>
        <label>Page size<select value={design.page_size} onChange={(event) => setDesign({ ...design, page_size: event.target.value as ResumeDesignSettings['page_size'] })}><option value="A4">A4</option><option value="Letter">Letter</option></select></label>
      </div>
      <div className="form-actions"><button className="button button-primary" disabled={savingDesign} onClick={() => void saveResumeFields(design, customSections, 'Design settings saved.')}>{savingDesign ? 'Saving…' : 'Save design settings'}</button></div>
    </section>

    <section className="panel builder-section">
      <div className="panel-title"><div><span className="eyebrow">MORE SECTIONS</span><h2>Add custom sections</h2><p>Add languages, volunteering, publications, courses, interests, references, or your own section.</p></div></div>
      <form className="custom-section-add" onSubmit={addSection}>
        <label>Section type<select value={newSectionType} onChange={(event) => setNewSectionType(event.target.value as CustomResumeSectionType)}>{sectionTypes.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
        <label>Section title<input required minLength={2} maxLength={60} value={newSectionTitle} onChange={(event) => setNewSectionTitle(event.target.value)} placeholder="e.g. Languages" /></label>
        <button className="button button-secondary" disabled={savingDesign || customSections.length >= 12}>Add section</button>
      </form>
      {customSections.length > 0 && <div className="custom-section-list">{customSections.map((section) =>
        <CustomSectionEditor
          key={section.id}
          section={section}
          saving={savingDesign}
          onChange={(patch) => updateSection(section.id, patch)}
          onRemove={() => removeSection(section.id)}
        />)}</div>}
      {customSections.length > 0 && <div className="form-actions"><button className="button button-primary" disabled={savingDesign} onClick={saveCustomSections}>{savingDesign ? 'Saving…' : 'Save custom sections'}</button></div>}
    </section>
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {notice && <div className="notice notice-success" role="status">{notice}</div>}
  </section>
}

function CustomSectionEditor({
  section,
  saving,
  onChange,
  onRemove,
}: {
  section: CustomResumeSection
  saving: boolean
  onChange: (patch: Partial<CustomResumeSection>) => void
  onRemove: () => void
}) {
  const emptyEntry: CustomResumeEntry = {
    title: '',
    subtitle: null,
    date: null,
    location: null,
    url: null,
    description: null,
  }
  const [entry, setEntry] = useState<CustomResumeEntry>(emptyEntry)

  const addEntry = (event: FormEvent) => {
    event.preventDefault()
    onChange({ entries: [...section.entries, entry] })
    setEntry(emptyEntry)
  }

  return <article className="custom-section-editor">
    <div className="custom-section-heading">
      <label>Section title<input required minLength={2} maxLength={60} value={section.title} onChange={(event) => onChange({ title: event.target.value })} /></label>
      <button type="button" className="text-button danger-text" disabled={saving} onClick={onRemove}>Remove section</button>
    </div>
    {section.entries.map((item, index) => <div className="content-item" key={`${section.id}-${index}`}><div className="content-item-heading"><strong>{item.title}</strong><button type="button" className="text-button danger-text" disabled={saving} onClick={() => onChange({ entries: section.entries.filter((_, itemIndex) => itemIndex !== index) })}>Remove entry</button></div><p>{[item.subtitle, item.date, item.location, item.description].filter(Boolean).join(' · ')}</p></div>)}
    <form className="custom-entry-form" onSubmit={addEntry}>
      <label>Entry title<input required minLength={2} maxLength={200} value={entry.title} onChange={(event) => setEntry({ ...entry, title: event.target.value })} placeholder="Language, course, publication…" /></label>
      <label>Subtitle<input maxLength={200} value={entry.subtitle || ''} onChange={(event) => setEntry({ ...entry, subtitle: event.target.value || null })} /></label>
      <label>Date or date range<input maxLength={50} value={entry.date || ''} onChange={(event) => setEntry({ ...entry, date: event.target.value || null })} /></label>
      <label>Location<input maxLength={150} value={entry.location || ''} onChange={(event) => setEntry({ ...entry, location: event.target.value || null })} /></label>
      <label>URL<input type="url" maxLength={2048} value={entry.url || ''} onChange={(event) => setEntry({ ...entry, url: event.target.value || null })} /></label>
      <label className="field-wide">Details<textarea rows={2} maxLength={5000} value={entry.description || ''} onChange={(event) => setEntry({ ...entry, description: event.target.value || null })} /></label>
      <button className="button button-secondary" disabled={saving || section.entries.length >= 50}>Add entry</button>
    </form>
  </article>
}
