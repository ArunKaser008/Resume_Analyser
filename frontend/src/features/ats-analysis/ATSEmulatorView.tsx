import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { analyzeResumeForATS } from '../../api/atsEmulator'
import { createSectionRecord, getSectionRecords } from '../../api/resumeContent'
import { getResumeSections, updateResumeSections } from '../../api/resumes'
import type { ATSJDAnalysis, CareerProfile, Resume, TargetATS } from '../../api/types'
import ScoreBreakdownCard from './ScoreBreakdownCard'

const atsOptions: { key: TargetATS; label: string; description: string }[] = [
  { key: 'WORKDAY', label: 'Workday', description: 'Plain-text extraction and exact matching.' },
  { key: 'GREENHOUSE', label: 'Greenhouse', description: 'Contextual skills and structured candidate evidence.' },
  { key: 'LEVER', label: 'Lever', description: 'Contextual skills, experience, and outcome alignment.' },
]

export default function ATSEmulatorView({
  resume,
  profile,
}: {
  resume: Resume
  profile: CareerProfile
}) {
  const [targetATS, setTargetATS] = useState<TargetATS>('WORKDAY')
  const [jobDescription, setJobDescription] = useState('')
  const [result, setResult] = useState<ATSJDAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const runAnalysis = async (ats: TargetATS, description = jobDescription) => {
    setTargetATS(ats)
    if (!description.trim()) {
      setError('Paste a job description before running the ATS emulator.')
      return
    }
    setLoading(true)
    setError('')
    try {
      setResult(await analyzeResumeForATS(resume.id, description, ats))
    } catch (cause) {
      setError(cause instanceof ApiError || cause instanceof Error
        ? cause.message
        : 'ATS simulation could not be completed.')
    } finally {
      setLoading(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void runAnalysis(targetATS)
  }

  const addSkillToResume = async (skill: string) => {
    const resumeSections = await getResumeSections(resume.id)
    const skillSection = resumeSections.sections.find(
      (section) => section.section_type === 'technical_skill',
    )
    const profileSkills = await getSectionRecords('technical_skill', profile.id)
    const existing = profileSkills.find(
      (record) => 'skill_name' in record
        && typeof record.skill_name === 'string'
        && record.skill_name.trim().toLocaleLowerCase() === skill.trim().toLocaleLowerCase(),
    )
    const records = existing || await createSectionRecord('technical_skill', profile, {
      skill_name: skill,
      category: 'Job description suggestion',
    })
    if (skillSection?.items.some((item) => item.item_id === records.id)) return
    const sections = resumeSections.sections.map((section) => (
      section.section_type === 'technical_skill'
        ? {
          ...section,
          items: [...section.items, {
            item_id: records.id,
            display_order: section.items.length,
          }],
        }
        : section
    ))
    if (!sections.some((section) => section.section_type === 'technical_skill')) {
      sections.push({
        section_type: 'technical_skill',
        items: [{ item_id: records.id, display_order: 0 }],
      })
    }
    await updateResumeSections(resume.id, sections)
  }

  return <section className="ats-emulator panel" aria-labelledby="ats-emulator-title">
    <div className="panel-title"><div><span className="eyebrow">TARGET SYSTEM EMULATOR</span><h2 id="ats-emulator-title">Compare ATS parsing</h2><p>Simulate how each system extracts this saved resume and evaluates it against a job description.</p></div></div>
    <div className="ats-tabs" role="tablist" aria-label="Target applicant tracking system">
      {atsOptions.map((option) => <button
        className={`ats-tab ${targetATS === option.key ? 'active' : ''}`}
        id={`ats-tab-${option.key.toLowerCase()}`}
        type="button"
        role="tab"
        aria-selected={targetATS === option.key}
        aria-controls="ats-emulator-panel"
        key={option.key}
        onClick={() => {
          setTargetATS(option.key)
          if (jobDescription.trim()) void runAnalysis(option.key)
        }}
      ><strong>{option.label}</strong><small>{option.description}</small></button>)}
    </div>
    <form className="ats-emulator-form" onSubmit={submit}>
      <label htmlFor="ats-job-description">Job description</label>
      <textarea
        id="ats-job-description"
        value={jobDescription}
        onChange={(event) => setJobDescription(event.target.value)}
        maxLength={20_000}
        rows={6}
        placeholder="Paste the role description to compare against your resume."
      />
      <div className="ats-emulator-form-footer"><span>{jobDescription.length.toLocaleString()} / 20,000 characters · {targetATS} mode</span><button className="button button-primary" type="submit" disabled={loading || !jobDescription.trim()}>{loading ? 'Simulating…' : `Run ${atsOptions.find((item) => item.key === targetATS)?.label} simulation`}</button></div>
    </form>
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {result && <div id="ats-emulator-panel" className="ats-emulator-results" role="tabpanel" aria-labelledby={`ats-tab-${result.target_ats.toLowerCase()}`}>
      <div className="ats-emulator-score"><div><span className="eyebrow">{result.target_ats} OVERALL MATCH</span><strong>{Math.round(result.overall_match_score)}<small>%</small></strong></div><div className="seniority-density"><strong>Leadership signals</strong><span>{result.seniority_signals.signal_count} · {result.seniority_signals.density_per_100_words.toFixed(1)} / 100 words</span><small>{result.seniority_signals.summary}</small></div></div>
      {result.parser_warnings.length > 0 && <div className="ats-parser-warnings"><strong>Parser warnings</strong><ul>{result.parser_warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
      <div className="ats-side-by-side">
        <section className="ats-preview-pane"><div className="ats-pane-heading"><h3>Raw Parser Output</h3><span>{result.target_ats} simulation</span></div><pre>{result.raw_parser_output || 'No text was extracted.'}</pre></section>
        <section className="ats-preview-pane"><div className="ats-pane-heading"><h3>Recruiter View</h3><span>{result.hard_skill_matrix.length} hard skills scanned</span></div><p className="ats-recruiter-copy">{result.recruiter_view}</p><div className="ats-skill-matrix">{result.hard_skill_matrix.map((item) => <article className={`ats-skill-row ats-skill-${item.status}`} key={item.skill}><div><strong>{item.skill}</strong><span>{item.status}</span></div><p>{item.evidence.length ? item.evidence.join(' · ') : item.rationale}</p></article>)}</div></section>
      </div>
      {result.formatting_flags.length > 0 && <section className="ats-formatting-flags"><h3>Formatting risks ({Math.round(result.formatting_risk_score)}/100)</h3>{result.formatting_flags.map((flag, index) => <p key={`${flag.category}-${index}`}><strong>{flag.line_number ? `Line ${flag.line_number}: ` : ''}{flag.category.replaceAll('_', ' ')}</strong> · {flag.message}</p>)}</section>}
      <ScoreBreakdownCard result={result} onAddSkill={addSkillToResume} />
    </div>}
  </section>
}
