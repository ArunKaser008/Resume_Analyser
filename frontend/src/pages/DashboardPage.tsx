import { useEffect, useRef, useState } from 'react'
import { getDashboard, sendCopilotMessage } from '../api/dashboard'
import { updateResume } from '../api/resumes'
import type { DashboardResponse, ResumePatch } from '../types/dashboard'
import CompanyTierSimulator from '../components/dashboard/CompanyTierSimulator'
import ExecutiveHeader from '../components/dashboard/ExecutiveHeader'
import InteractiveResumeCanvas from '../components/dashboard/InteractiveResumeCanvas'
import InterviewPrepCard from '../components/dashboard/InterviewPrepCard'
import PriorityFixFeed from '../components/dashboard/PriorityFixFeed'
import ResumeCopilotDrawer from '../components/dashboard/ResumeCopilotDrawer'
import { ApiError } from '../api/client'
import './dashboard.css'

export default function DashboardPage({ resumeId }: { resumeId: string }) {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [focusLine, setFocusLine] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const canvasRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    let active = true
    void getDashboard(resumeId)
      .then((result) => { if (active) setDashboard(result) })
      .catch((cause: unknown) => { if (active) setError(cause instanceof ApiError ? cause.message : 'Unable to load the post-analysis dashboard.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [resumeId])

  const focusResumeLine = (lineNumber: number) => {
    setFocusLine(lineNumber)
    if (canvasRef.current && typeof canvasRef.current.scrollIntoView === 'function') {
      canvasRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.setTimeout(() => {
      const line = document.getElementById(`resume-line-${lineNumber}`)
      if (line && typeof line.scrollIntoView === 'function') {
        line.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 80)
  }

  const requestInlineFix = async (text: string, lineNumber: number): Promise<ResumePatch | null> => {
    const response = await sendCopilotMessage(resumeId, `Rewrite this exact line to be clearer and more impactful without adding any unverified facts: "${text}"`, `line-${lineNumber}`)
    return response.patches[0] || null
  }

  const applyDrawerPatch = (patch: ResumePatch): boolean => {
    const line = dashboard?.annotated_sections.find((section) => section.text === patch.original_text)
    if (!line) return false
    setDashboard((current) => current ? ({
      ...current,
      annotated_sections: current.annotated_sections.map((section) => section.line_number === line.line_number
        ? { ...section, text: patch.suggested_text }
        : section),
    }) : current)
    setDrawerOpen(false)
    return true
  }

  if (loading) return <section className="panel dashboard-loading" role="status"><span className="spinner" /><p>Building your post-analysis dashboard…</p></section>
  if (error) return <section className="panel dashboard-error" role="alert"><h2>Dashboard unavailable</h2><p>{error}</p><button className="button button-primary" onClick={() => { setError(''); setLoading(true); void getDashboard(resumeId).then(setDashboard).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load dashboard.')).finally(() => setLoading(false)) }}>Retry</button></section>
  if (!dashboard) return <section className="panel dashboard-empty">No dashboard data is available for this resume.</section>

  return <div className="dashboard-page">
    <ExecutiveHeader dashboard={dashboard} onTargetRoleChange={async (role) => {
      await updateResume(resumeId, { target_role: role })
      setDashboard((current) => current ? { ...current, target_role: role } : current)
    }} />
    <div className="dashboard-score-breakdown" aria-label="Score breakdown">
      {Object.entries(dashboard.score_breakdown).map(([name, score]) => <div className="panel dashboard-score-card" key={name}><span>{name.replaceAll('_', ' ')}</span><strong>{Math.round(score)}%</strong><div className="progress-track"><span style={{ width: `${score}%` }} /></div></div>)}
    </div>
    <PriorityFixFeed fixes={dashboard.top_priority_fixes} onSelect={focusResumeLine} />
    <div ref={(element) => { canvasRef.current = element }}><InteractiveResumeCanvas sections={dashboard.annotated_sections} onRequestFix={requestInlineFix} focusLine={focusLine} /></div>
    <div className="dashboard-two-column">
      <CompanyTierSimulator resumeId={resumeId} />
      <InterviewPrepCard resumeId={resumeId} />
    </div>
    <div className="dashboard-copilot-launch"><div><h2>Need a tailored edit?</h2><p>Ask the copilot for role-specific recommendations grounded in your resume.</p></div><button className="button button-primary" onClick={() => setDrawerOpen(true)}>Open resume copilot</button></div>
    {drawerOpen && <ResumeCopilotDrawer resumeId={resumeId} onClose={() => setDrawerOpen(false)} onApplyPatch={applyDrawerPatch} />}
  </div>
}
