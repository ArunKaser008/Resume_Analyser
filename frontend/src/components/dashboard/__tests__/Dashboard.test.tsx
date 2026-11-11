import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from '../../../pages/DashboardPage'
import { getDashboard, sendCopilotMessage, simulateCompanyTier } from '../../../api/dashboard'
import type { DashboardResponse } from '../../../types/dashboard'

vi.mock('../../../api/dashboard', () => ({
  getDashboard: vi.fn(),
  sendCopilotMessage: vi.fn(),
  simulateCompanyTier: vi.fn(),
  generateInterviewPrep: vi.fn(),
}))
vi.mock('../../../api/resumes', () => ({
  downloadResume: vi.fn(),
  downloadResumeDocx: vi.fn(),
}))

const dashboard: DashboardResponse = {
  analysis_id: 'resume-1',
  resume_id: 'resume-1',
  overall_score: 78,
  ats_grade: 'B',
  target_role: 'Backend Engineer',
  score_breakdown: { hard_skills: 80, formatting: 75, proof_of_work: 70, leadership: 85 },
  top_priority_fixes: [{
    id: 'fix-1',
    title: 'Quantify impact',
    description: 'Add a verified metric.',
    estimated_impact: '+12 pts',
    line_number: 1,
  }],
  annotated_sections: [{ line_number: 1, text: 'Built an API service.', highlight: 'WEAK_PHRASING' }],
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getDashboard).mockResolvedValue(dashboard)
    vi.mocked(simulateCompanyTier).mockResolvedValue({
      resume_id: 'resume-1',
      tier_type: 'MAANG_PRODUCT',
      overall_score: 75,
      score_breakdown: dashboard.score_breakdown,
      checks: [{ name: 'Scale metrics', passed: false, score: 25, detail: 'No metric detected.' }],
    })
    vi.mocked(sendCopilotMessage).mockResolvedValue({
      resume_id: 'resume-1',
      message: 'A clearer action will help.',
      patches: [],
    })
  })

  it('clicking a priority fix focuses its resume line', async () => {
    render(<DashboardPage resumeId="resume-1" />)
    await screen.findByText('Quantify impact')
    fireEvent.click(screen.getByRole('button', { name: 'Review line 1' }))
    expect(document.getElementById('resume-line-1')).toHaveClass('resume-line-focused')
  })

  it('switching simulator tier calls the matching API', async () => {
    render(<DashboardPage resumeId="resume-1" />)
    await screen.findByText('Quantify impact')
    fireEvent.click(screen.getByRole('tab', { name: 'Startup' }))
    await waitFor(() => expect(simulateCompanyTier).toHaveBeenCalledWith({
      resume_id: 'resume-1',
      tier_type: 'SERIES_B_STARTUP',
    }))
  })

  it('opening the copilot displays an interactive chat interface', async () => {
    render(<DashboardPage resumeId="resume-1" />)
    await screen.findByText('Quantify impact')
    fireEvent.click(screen.getByRole('button', { name: 'Open resume copilot' }))
    expect(screen.getByRole('dialog', { name: 'Resume copilot' })).toBeInTheDocument()
    expect(screen.getByLabelText('Message the resume copilot')).toBeInTheDocument()
  })
})
