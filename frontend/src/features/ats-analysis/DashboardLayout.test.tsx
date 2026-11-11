import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Resume, ResumeAnalysis } from '../../api/types'
import { getContentOverrides } from '../../api/optimization'
import { analyzeResume } from '../../api/resumeAnalysis'
import AnalysisPage from './AnalysisPage'

vi.mock('../../api/resumes', () => ({
  downloadResume: vi.fn(),
  downloadResumeDocx: vi.fn(),
  finalizeResumeChanges: vi.fn(),
  importResume: vi.fn(),
}))
vi.mock('../../api/resumeAnalysis', () => ({ analyzeResume: vi.fn() }))
vi.mock('../../api/optimization', () => ({ getContentOverrides: vi.fn() }))
vi.mock('../../api/resumeContent', () => ({ createBulletOverride: vi.fn() }))
vi.mock('../../pages/DashboardPage', () => ({
  default: () => <section aria-label="Analysis dashboard">
    <h2>Executive Hero &amp; Overall Score</h2>
    <h2>Priority Fix Feed</h2>
    <h2>Interactive Resume Canvas</h2>
  </section>,
}))
vi.mock('../resume-builder/BulletOptimizerModal', () => ({ default: () => null }))
vi.mock('./ATSEmulatorView', () => ({
  default: () => <section aria-label="Target System Emulator">Compare ATS parsing</section>,
}))
vi.mock('./ParsedDataPreview', () => ({ default: () => null }))
vi.mock('./ProofOfWorkDashboard', () => ({ default: () => null }))

const resume: Resume = {
  id: 'resume-layout',
  career_profile_id: 'profile-layout',
  title: 'Engineer',
  target_role: 'Software Engineer',
  template_name: 'modern',
  is_primary: true,
  custom_sections: [],
  design_settings: {
    layout: 'single-column',
    font_family: 'Arial',
    font_size: 10,
    spacing: 'comfortable',
    accent_color: '#52677C',
    page_size: 'A4',
  },
  section_order: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const analysis: ResumeAnalysis = {
  resume_id: resume.id,
  match_score: 78,
  score_label: 'Good',
  score_breakdown: [],
  matched_keywords: [],
  missing_keywords: [],
  matched_skills: [],
  missing_skills: [],
  strengths: [],
  weaknesses: [],
  recommendations: [],
  summary: 'Analysis complete.',
}

describe('ATS analyzer layout', () => {
  beforeEach(() => {
    vi.mocked(analyzeResume).mockReset().mockResolvedValue(analysis)
    vi.mocked(getContentOverrides).mockReset().mockResolvedValue([])
  })

  it('renders the target system emulator below the analysis dashboard and bullet optimizer', async () => {
    render(
      <AnalysisPage
        resumes={[resume]}
        profiles={[]}
        initialResumeId={resume.id}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Recheck ATS score' }))

    await screen.findByRole('region', { name: 'Analysis dashboard' })
    await screen.findByRole('region', { name: 'Target System Emulator' })
    await waitFor(() => expect(analyzeResume).toHaveBeenCalledWith(resume.id, undefined, true))

    const dashboard = screen.getByRole('region', { name: 'Analysis dashboard' })
    const bulletOptimizer = screen.getByRole('heading', { name: 'Optimize a resume bullet' })
    const emulator = screen.getByRole('region', { name: 'Target System Emulator' })
    expect(dashboard.compareDocumentPosition(bulletOptimizer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(bulletOptimizer.compareDocumentPosition(emulator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
