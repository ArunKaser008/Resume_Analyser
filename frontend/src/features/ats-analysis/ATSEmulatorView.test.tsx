import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeResumeForATS } from '../../api/atsEmulator'
import type { ATSJDAnalysis, Resume } from '../../api/types'
import ATSEmulatorView from './ATSEmulatorView'

vi.mock('../../api/atsEmulator', () => ({
  analyzeResumeForATS: vi.fn(),
}))

const resume: Resume = {
  id: 'resume-1',
  career_profile_id: 'profile-1',
  title: 'Engineer',
  target_role: null,
  template_name: 'modern',
  is_primary: true,
  custom_sections: [],
  design_settings: {
    layout: 'single-column',
    font_family: 'Arial',
    font_size: 12,
    spacing: 'comfortable',
    accent_color: '#00A7A2',
    page_size: 'A4',
  },
  section_order: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function response(target: ATSJDAnalysis['target_ats']): ATSJDAnalysis {
  return {
    resume_id: resume.id,
    target_ats: target,
    overall_match_score: 70,
    score_breakdown: {
      hard_skills: 50,
      soft_skills: 60,
      experience_alignment: 80,
      formatting: 90,
    },
    hard_skill_matrix: [
      { skill: 'Python', status: 'matched', evidence: ['Python'], rationale: 'Found.' },
      { skill: 'React', status: 'missing', evidence: [], rationale: 'Not found.' },
    ],
    seniority_signals: {
      density_per_100_words: 1.2,
      signal_count: 2,
      signals: ['led', 'mentored'],
      summary: '2 leadership signals detected.',
    },
    formatting_risk_score: 10,
    formatting_flags: [],
    raw_parser_output: `${target} plain-text extraction`,
    recruiter_view: `${target} recruiter interpretation`,
    parser_warnings: [],
  }
}

describe('ATSEmulatorView', () => {
  beforeEach(() => {
    vi.mocked(analyzeResumeForATS).mockImplementation(
      async (_resumeId, _jobDescription, targetATS) => response(targetATS),
    )
  })

  it('switches ATS tabs and refreshes the parser and recruiter previews without replacing the pane layout', async () => {
    const user = userEvent.setup()
    render(<ATSEmulatorView resume={resume} />)

    await user.type(
      screen.getByLabelText('Job description'),
      'Looking for Python and React engineering experience.',
    )
    await user.click(screen.getByRole('button', { name: 'Run Workday simulation' }))

    expect(await screen.findByText('WORKDAY plain-text extraction')).toBeInTheDocument()
    expect(screen.getByText('WORKDAY recruiter interpretation')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Score breakdown' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Missing skills' })).not.toBeInTheDocument()
    const rawPane = screen.getByRole('heading', { name: 'Raw Parser Output' }).parentElement?.parentElement

    await user.click(screen.getByRole('tab', { name: /Greenhouse/ }))
    await waitFor(() => expect(analyzeResumeForATS).toHaveBeenLastCalledWith(
      resume.id,
      'Looking for Python and React engineering experience.',
      'GREENHOUSE',
    ))
    expect(await screen.findByText('GREENHOUSE plain-text extraction')).toBeInTheDocument()
    expect(screen.getByText('GREENHOUSE recruiter interpretation')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Raw Parser Output' }).parentElement?.parentElement).toBe(rawPane)
  })

  it('keeps the parser form usable for an empty job description and explains why analysis is unavailable', async () => {
    render(<ATSEmulatorView resume={resume} />)
    const runButton = screen.getByRole('button', { name: 'Run Workday simulation' })

    expect(runButton).toBeDisabled()
    fireEvent.submit(runButton.closest('form') as HTMLFormElement)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Paste a job description before running the ATS emulator.',
    )
    expect(analyzeResumeForATS).not.toHaveBeenCalled()
  })
})
