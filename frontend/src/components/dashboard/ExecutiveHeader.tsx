import { useState, type CSSProperties } from 'react'
import { downloadResume, downloadResumeDocx } from '../../api/resumes'
import type { DashboardResponse } from '../../types/dashboard'

interface Props {
  dashboard: DashboardResponse
  onTargetRoleChange: (role: string) => Promise<void>
}

export default function ExecutiveHeader({ dashboard, onTargetRoleChange }: Props) {
  const [role, setRole] = useState(dashboard.target_role)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [roleSaving, setRoleSaving] = useState(false)
  const [roleError, setRoleError] = useState('')

  const changeRole = async (nextRole: string) => {
    const previousRole = role
    setRole(nextRole)
    setRoleSaving(true)
    setRoleError('')
    try {
      await onTargetRoleChange(nextRole)
    } catch (error) {
      setRole(previousRole)
      setRoleError(error instanceof Error ? error.message : 'Unable to update the target role.')
    } finally {
      setRoleSaving(false)
    }
  }

  const exportResume = async (format: 'pdf' | 'docx') => {
    setExporting(true)
    setExportError('')
    try {
      const blob = format === 'pdf'
        ? await downloadResume(dashboard.resume_id)
        : await downloadResumeDocx(dashboard.resume_id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `resume.${format}`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Resume export failed.')
    } finally {
      setExporting(false)
    }
  }

  return <section className="dashboard-hero panel" aria-label="Executive resume score">
    <div className="dashboard-score-ring" style={{ '--dashboard-score': `${dashboard.overall_score}%` } as CSSProperties} aria-label={`Score ${Math.round(dashboard.overall_score)} out of 100`}>
      <div><strong>{Math.round(dashboard.overall_score)}</strong><span> / 100</span></div>
    </div>
    <div className="dashboard-hero-copy">
      <span className="eyebrow">POST-ANALYSIS OVERVIEW</span>
      <h1>Resume performance</h1>
      <p>Review your ATS signals, prioritize high-impact improvements, and prepare to defend your experience.</p>
    </div>
    <div className="dashboard-header-actions">
      <label>Target role
        <select value={role} disabled={roleSaving} onChange={(event) => void changeRole(event.target.value)}>
          <option>{dashboard.target_role}</option>
          <option>Software Engineer</option>
          <option>Backend Engineer</option>
          <option>Frontend Engineer</option>
          <option>Data Engineer</option>
          <option>Product Manager</option>
        </select>
      </label>
      <span className={`dashboard-grade dashboard-grade-${dashboard.ats_grade.replace('+', 'plus')}`} aria-label={`ATS grade ${dashboard.ats_grade}`}>{dashboard.ats_grade}</span>
      <div className="button-row">
        <button className="button button-secondary" disabled={exporting} onClick={() => void exportResume('pdf')}>{exporting ? 'Exporting…' : 'PDF'}</button>
        <button className="button button-secondary" disabled={exporting} onClick={() => void exportResume('docx')}>{exporting ? 'Exporting…' : 'DOCX'}</button>
      </div>
    </div>
    {roleError && <p className="notice notice-error dashboard-export-error" role="alert">{roleError}</p>}
    {exportError && <p className="notice notice-error dashboard-export-error" role="alert">{exportError}</p>}
  </section>
}
