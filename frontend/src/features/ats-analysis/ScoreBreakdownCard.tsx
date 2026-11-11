import { useState } from 'react'
import type { ATSJDAnalysis } from '../../api/types'

type ScoreKey = keyof ATSJDAnalysis['score_breakdown']

const scoreItems: { key: ScoreKey; title: string; description: string }[] = [
  { key: 'hard_skills', title: 'Hard skills', description: 'Evidence of required technical skills.' },
  { key: 'soft_skills', title: 'Soft skills', description: 'Contextual evidence of collaboration and communication.' },
  { key: 'experience_alignment', title: 'Experience alignment', description: 'Relevance of responsibilities and experience duration.' },
  { key: 'formatting', title: 'Formatting', description: 'ATS-readable format score (100 minus formatting risk).' },
]

export default function ScoreBreakdownCard({
  result,
  onAddSkill,
}: {
  result: ATSJDAnalysis
  onAddSkill: (skill: string) => Promise<void>
}) {
  const [selectedMetric, setSelectedMetric] = useState<ScoreKey>('hard_skills')
  const [addingSkills, setAddingSkills] = useState<string[]>([])
  const [addedSkills, setAddedSkills] = useState<string[]>([])
  const [error, setError] = useState('')

  const addSkill = async (skill: string) => {
    setError('')
    setAddingSkills((current) => [...current, skill])
    try {
      await onAddSkill(skill)
      setAddedSkills((current) => [...current, skill])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not add ${skill}.`)
    } finally {
      setAddingSkills((current) => current.filter((item) => item !== skill))
    }
  }

  const selected = scoreItems.find((item) => item.key === selectedMetric) || scoreItems[0]
  const score = selectedMetric === 'formatting'
    ? 100 - result.formatting_risk_score
    : result.score_breakdown[selectedMetric]

  return <section className="panel ats-score-breakdown" aria-labelledby="ats-score-breakdown-title">
    <div className="panel-title"><div><h2 id="ats-score-breakdown-title">Score breakdown</h2><p>Choose a category to inspect its score and evidence.</p></div></div>
    <div className="ats-score-layout">
      <div className="ats-score-bars" role="group" aria-label="Score categories">
        {scoreItems.map((item) => {
          const value = item.key === 'formatting'
            ? 100 - result.formatting_risk_score
            : result.score_breakdown[item.key]
          return <button
            className={`ats-score-row ${selectedMetric === item.key ? 'active' : ''}`}
            type="button"
            key={item.key}
            onClick={() => setSelectedMetric(item.key)}
            aria-pressed={selectedMetric === item.key}
          >
            <span>{item.title}</span><span className="progress-track"><span style={{ width: `${value}%` }} /></span><strong>{Math.round(value)}%</strong>
          </button>
        })}
      </div>
      <div className="ats-score-detail" aria-live="polite">
        <span className="eyebrow">{selected.title.toUpperCase()}</span>
        <strong>{Math.round(score)}%</strong>
        <p>{selected.description}</p>
        {selectedMetric === 'hard_skills' && <p>{result.hard_skill_matrix.filter((item) => item.status === 'matched').length} of {result.hard_skill_matrix.length} listed hard skills were matched.</p>}
        {selectedMetric === 'formatting' && <p>Formatting risk: {Math.round(result.formatting_risk_score)} / 100.</p>}
      </div>
    </div>
    {result.hard_skill_matrix.some((item) => item.status === 'missing') && <div className="missing-skill-suggestions">
      <div><h3>Missing skills</h3><p>Only add a skill if it accurately reflects your experience.</p></div>
      <div className="missing-skill-tags">{result.hard_skill_matrix.filter((item) => item.status === 'missing').map((item) => {
        const added = addedSkills.includes(item.skill)
        const adding = addingSkills.includes(item.skill)
        return <button
          key={item.skill}
          type="button"
          className={`skill-suggestion-pill ${added ? 'added' : ''}`}
          disabled={added || adding}
          onClick={() => void addSkill(item.skill)}
          title={item.rationale}
        >{added ? '✓ Added: ' : adding ? 'Adding: ' : '+ Add to Resume: '}{item.skill}</button>
      })}</div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
    </div>}
  </section>
}
