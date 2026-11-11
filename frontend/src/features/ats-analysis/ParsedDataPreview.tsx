import { useState } from 'react'
import { ApiError } from '../../api/client'
import { updateParsedResume } from '../../api/resumeParser'
import type { ParsedEducation, ParsedExperience, ParsedProject, ParsedResumeData, ResumeParseResponse } from '../../api/types'

interface Props {
  result: ResumeParseResponse
}

const skillGroups: { key: keyof ParsedResumeData['technical_skills']; label: string }[] = [
  { key: 'languages', label: 'Languages' },
  { key: 'frameworks', label: 'Frameworks' },
  { key: 'cloud_devops', label: 'Cloud / DevOps' },
  { key: 'databases', label: 'Databases' },
  { key: 'tools', label: 'Tools' },
]

export default function ParsedDataPreview({ result }: Props) {
  const [data, setData] = useState(result.parsed_data)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const updateEducation = (index: number, patch: Partial<ParsedEducation>) => {
    setData((current) => ({ ...current, education: current.education.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }))
  }
  const updateExperience = (index: number, patch: Partial<ParsedExperience>) => {
    setData((current) => ({ ...current, experience: current.experience.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }))
  }
  const updateProject = (index: number, patch: Partial<ParsedProject>) => {
    setData((current) => ({ ...current, projects: current.projects.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }))
  }
  const save = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const updated = await updateParsedResume(result.parse_id, data)
      setData(updated.parsed_data)
      setEditing(false)
      setNotice('Parsed details saved.')
    } catch (cause) {
      setError(cause instanceof ApiError || cause instanceof Error ? cause.message : 'Unable to save parsed details.')
    } finally {
      setSaving(false)
    }
  }

  const textInput = (label: string, value: string | null, onChange: (value: string) => void, type = 'text') => editing
    ? <label className="parsed-field">{label}<input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} /></label>
    : <div className="parsed-field"><span>{label}</span><strong>{value || 'Not found'}</strong></div>
  const listInput = (label: string, values: string[], onChange: (values: string[]) => void) => editing
    ? <label className="parsed-field parsed-field-wide">{label}<textarea rows={3} value={values.join('\n')} onChange={(event) => onChange(event.target.value.split('\n').map((value) => value.trim()).filter(Boolean))} /><small>Enter one item per line.</small></label>
    : <div className="parsed-field parsed-field-wide"><span>{label}</span><div className="parsed-tags">{values.length ? values.map((value) => <span className="parsed-tag" key={value}>{value}</span>) : <strong>Not found</strong>}</div></div>

  return <section className="panel parsed-preview" aria-label="Parsed resume data">
    <div className="panel-title"><div><span className="eyebrow">AI PARSE PREVIEW</span><h2>{result.filename}</h2><p>Review and correct extracted details before using them.</p></div><div className="button-row">{editing ? <><button type="button" className="button button-secondary" disabled={saving} onClick={() => { setData(result.parsed_data); setEditing(false); setError(''); setNotice('') }}>Cancel</button><button type="button" className="button button-primary" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save corrections'}</button></> : <button type="button" className="button button-secondary" onClick={() => { setEditing(true); setNotice('') }}>Edit parsed data</button>}</div></div>
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {notice && <div className="notice notice-success" role="status">{notice}</div>}
    <div className="parsed-data-grid">
      <article className="parsed-data-card parsed-card-wide"><h3>Contact information</h3><div className="parsed-fields">
        {textInput('Full name', data.contact_info.full_name, (value) => setData((current) => ({ ...current, contact_info: { ...current.contact_info, full_name: value || null } })))}
        {textInput('Email', data.contact_info.email, (value) => setData((current) => ({ ...current, contact_info: { ...current.contact_info, email: value || null } })), 'email')}
        {textInput('Phone', data.contact_info.phone, (value) => setData((current) => ({ ...current, contact_info: { ...current.contact_info, phone: value || null } })), 'tel')}
        {textInput('LinkedIn', data.contact_info.linkedin_url, (value) => setData((current) => ({ ...current, contact_info: { ...current.contact_info, linkedin_url: value || null } })), 'url')}
        {textInput('GitHub', data.contact_info.github_url, (value) => setData((current) => ({ ...current, contact_info: { ...current.contact_info, github_url: value || null } })), 'url')}
        {textInput('Portfolio', data.contact_info.portfolio_url, (value) => setData((current) => ({ ...current, contact_info: { ...current.contact_info, portfolio_url: value || null } })), 'url')}
      </div></article>
      <article className="parsed-data-card"><h3>Technical skills</h3><div className="parsed-fields">{skillGroups.map(({ key, label }) => listInput(
        label,
        data.technical_skills[key],
        (values) => setData((current) => ({
          ...current,
          technical_skills: { ...current.technical_skills, [key]: values },
        })),
      ))}</div></article>
      <article className="parsed-data-card"><h3>Education</h3>{data.education.length ? data.education.map((item, index) => <div className="parsed-record" key={`education-${index}`}>
        {textInput('Degree', item.degree, (value) => updateEducation(index, { degree: value || null }))}
        {textInput('Institution', item.institution, (value) => updateEducation(index, { institution: value || null }))}
        {editing ? <label className="parsed-field">Graduation year<input type="number" min={1900} max={2200} value={item.graduation_year ?? ''} onChange={(event) => updateEducation(index, { graduation_year: event.target.value ? Number(event.target.value) : null })} /></label> : <div className="parsed-field"><span>Graduation year</span><strong>{item.graduation_year || 'Not found'}</strong></div>}
        {textInput('Grade', item.grade, (value) => updateEducation(index, { grade: value || null }))}
      </div>) : <p className="muted">No education details found.</p>}</article>
      <article className="parsed-data-card"><h3>Experience</h3>{data.experience.length ? data.experience.map((item, index) => <div className="parsed-record" key={`experience-${index}`}>
        {textInput('Title', item.title, (value) => updateExperience(index, { title: value || null }))}
        {textInput('Company', item.company, (value) => updateExperience(index, { company: value || null }))}
        {textInput('Start date', item.start_date, (value) => updateExperience(index, { start_date: value || null }))}
        {textInput('End date', item.end_date, (value) => updateExperience(index, { end_date: value || null }))}
        {listInput('Bullet points', item.bullet_points, (values) => updateExperience(index, { bullet_points: values }))}
      </div>) : <p className="muted">No experience details found.</p>}</article>
      <article className="parsed-data-card parsed-card-wide"><h3>Projects</h3>{data.projects.length ? data.projects.map((item, index) => <div className="parsed-record" key={`project-${index}`}>
        {textInput('Project title', item.title, (value) => updateProject(index, { title: value || null }))}
        {textInput('Live URL', item.live_url, (value) => updateProject(index, { live_url: value || null }), 'url')}
        {textInput('Code URL', item.code_url, (value) => updateProject(index, { code_url: value || null }), 'url')}
        {listInput('Tech stack', item.tech_stack, (values) => updateProject(index, { tech_stack: values }))}
        {listInput('Bullet points', item.bullet_points, (values) => updateProject(index, { bullet_points: values }))}
      </div>) : <p className="muted">No projects found.</p>}</article>
    </div>
  </section>
}
