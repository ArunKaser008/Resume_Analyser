import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Resume, ResumeAnalysis, ResumeImportResponse, ResumeParseResponse } from '../../api/types'
import { getContentOverrides } from '../../api/optimization'
import { parseResumeFile } from '../../api/resumeParser'
import { importResume } from '../../api/resumes'
import { analyzeResume } from '../../api/resumeAnalysis'
import AnalysisPage from './AnalysisPage'

vi.mock('../../api/resumes', () => ({
  downloadResume: vi.fn(),
  downloadResumeDocx: vi.fn(),
  finalizeResumeChanges: vi.fn(),
  importResume: vi.fn(),
}))
vi.mock('../../api/resumeAnalysis', () => ({
  analyzeResume: vi.fn(),
}))
vi.mock('../../api/optimization', () => ({
  getContentOverrides: vi.fn(),
}))
vi.mock('../../api/resumeParser', () => ({
  parseResumeFile: vi.fn(),
  updateParsedResume: vi.fn(),
}))
vi.mock('../../api/resumeContent', () => ({
  createBulletOverride: vi.fn(),
}))
vi.mock('../../pages/DashboardPage', () => ({
  default: ({ resumeId }: { resumeId: string }) => <div>Dashboard for {resumeId}</div>,
}))
vi.mock('../resume-builder/BulletOptimizerModal', () => ({ default: () => null }))
vi.mock('./ProofOfWorkDashboard', () => ({ default: () => null }))
vi.mock('./ATSEmulatorView', () => ({ default: () => null }))

const firstResume: Resume = {
  id: 'resume-first',
  career_profile_id: 'profile-first',
  title: 'First resume',
  target_role: null,
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
  resume_id: firstResume.id,
  match_score: 80,
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

function importResponse(resume: Resume): ResumeImportResponse {
  return {
    resume,
    career_profile: {
      id: resume.career_profile_id,
      profile_type: 'experienced',
      full_name: 'Avery Example',
      email: 'avery@example.com',
      phone: null,
      city: null,
      professional_title: 'Engineer',
      summary: null,
      linkedin_url: null,
      github_url: null,
      leetcode_url: null,
      portfolio_url: null,
      created_at: resume.created_at,
      updated_at: resume.updated_at,
    },
    extracted_character_count: 100,
  }
}

function parsedResponse(filename: string, fullName: string): ResumeParseResponse {
  return {
    parse_id: filename,
    filename,
    parsed_data: {
      contact_info: {
        full_name: fullName,
        email: null,
        phone: null,
        linkedin_url: null,
        github_url: null,
        leetcode_url: null,
        portfolio_url: null,
      },
      education: [],
      technical_skills: {
        languages: [],
        frameworks: [],
        cloud_devops: [],
        databases: [],
        tools: [],
      },
      experience: [],
      projects: [],
    },
  }
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

describe('AnalysisPage', () => {
  beforeEach(() => {
    vi.mocked(importResume).mockReset()
    vi.mocked(parseResumeFile).mockReset()
    vi.mocked(analyzeResume).mockReset().mockResolvedValue(analysis)
    vi.mocked(getContentOverrides).mockReset().mockResolvedValue([])
  })

  it('clears the previous dashboard when a new upload is analyzed and shows loading state', async () => {
    const user = userEvent.setup()
    const secondImport = deferred<ResumeImportResponse>()
    vi.mocked(importResume)
      .mockResolvedValueOnce(importResponse(firstResume))
      .mockReturnValueOnce(secondImport.promise)
    render(<AnalysisPage resumes={[]} profiles={[]} />)

    await user.upload(
      screen.getByLabelText('Upload resume file'),
      new File(['First resume'], 'first.txt', { type: 'text/plain' }),
    )
    await user.click(screen.getByRole('button', { name: 'Analyze resume' }))
    expect(await screen.findByText('Dashboard for resume-first')).toBeInTheDocument()

    await user.upload(
      screen.getByLabelText('Upload resume file'),
      new File(['Second resume'], 'second.txt', { type: 'text/plain' }),
    )
    expect(screen.queryByText('Dashboard for resume-first')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Analyze resume' }))

    expect(await screen.findByText('Analyzing resume…')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard for resume-first')).not.toBeInTheDocument()
    await waitFor(() => expect(importResume).toHaveBeenCalledTimes(2))

    secondImport.resolve(importResponse({ ...firstResume, id: 'resume-second' }))
    expect(await screen.findByText('Dashboard for resume-second')).toBeInTheDocument()
  })

  it('replaces the parsed preview when the user selects and parses another resume', async () => {
    const user = userEvent.setup()
    const secondParse = deferred<ResumeParseResponse>()
    vi.mocked(parseResumeFile)
      .mockResolvedValueOnce(parsedResponse('first.txt', 'First Candidate'))
      .mockReturnValueOnce(secondParse.promise)
    render(<AnalysisPage resumes={[]} profiles={[]} />)

    await user.upload(
      screen.getByLabelText('Upload resume file'),
      new File(['First resume'], 'first.txt', { type: 'text/plain' }),
    )
    await user.click(screen.getByRole('button', { name: 'Parse resume' }))
    expect(await screen.findByText('First Candidate')).toBeInTheDocument()
    expect(screen.getAllByRole('region', { name: 'Parsed resume data' })).toHaveLength(1)

    await user.upload(
      screen.getByLabelText('Upload resume file'),
      new File(['Second resume'], 'second.txt', { type: 'text/plain' }),
    )
    await waitFor(() => {
      expect(screen.queryByText('First Candidate')).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Parsed resume data' })).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Parse resume' }))
    expect(await screen.findByRole('progressbar', { name: 'Uploading and parsing resume' })).toBeInTheDocument()
    const parsingButtons = screen.getAllByRole('button', { name: 'Parsing resume…' })
    expect(parsingButtons).toHaveLength(2)
    expect(parsingButtons[0]).toBeDisabled()
    expect(parsingButtons[1]).toBeDisabled()
    expect(screen.queryByRole('region', { name: 'Parsed resume data' })).not.toBeInTheDocument()

    secondParse.resolve(parsedResponse('second.txt', 'Second Candidate'))
    expect(await screen.findByText('Second Candidate')).toBeInTheDocument()
    expect(screen.getAllByRole('region', { name: 'Parsed resume data' })).toHaveLength(1)
    expect(screen.queryByText('First Candidate')).not.toBeInTheDocument()
  })
})
