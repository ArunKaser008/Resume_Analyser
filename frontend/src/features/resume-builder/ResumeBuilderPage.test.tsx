import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CareerProfile, Resume } from '../../api/types'
import ResumeBuilderPage from './ResumeBuilderPage'

const mocks = vi.hoisted(() => ({
  createResume: vi.fn(),
  getCareerProfiles: vi.fn(),
  importResume: vi.fn(),
  updateResume: vi.fn(),
  deleteResume: vi.fn(),
  downloadResume: vi.fn(),
  downloadResumeDocx: vi.fn(),
  getResumeSections: vi.fn(),
  updateResumeSections: vi.fn(),
  createSectionRecord: vi.fn(),
  getSectionRecords: vi.fn(),
  updateSectionRecord: vi.fn(),
  updateCareerProfile: vi.fn(),
}))

vi.mock('../../api/resumes', () => ({
  createResume: mocks.createResume,
  deleteResume: mocks.deleteResume,
  downloadResume: mocks.downloadResume,
  downloadResumeDocx: mocks.downloadResumeDocx,
  getResumeSections: mocks.getResumeSections,
  importResume: mocks.importResume,
  updateResume: mocks.updateResume,
  updateResumeSections: mocks.updateResumeSections,
}))

vi.mock('../../api/careerProfiles', () => ({
  getCareerProfiles: mocks.getCareerProfiles,
  updateCareerProfile: mocks.updateCareerProfile,
}))

vi.mock('../../api/resumeContent', () => ({
  createSectionRecord: mocks.createSectionRecord,
  getSectionRecords: mocks.getSectionRecords,
  updateSectionRecord: mocks.updateSectionRecord,
}))

const profile: CareerProfile = {
  id: 'profile-1',
  profile_type: 'fresher',
  full_name: 'Alex Morgan',
  email: null,
  phone: null,
  city: null,
  professional_title: null,
  summary: null,
  linkedin_url: null,
  github_url: null,
  leetcode_url: null,
  portfolio_url: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const resume: Resume = {
  id: 'resume-1',
  career_profile_id: profile.id,
  title: 'Backend Engineer v1',
  target_role: 'Backend Engineer',
  template_name: 'minimal',
  is_primary: false,
  custom_sections: [],
  design_settings: {
    layout: 'single-column',
    font_family: 'Inter',
    font_size: 11,
    spacing: 'comfortable',
    accent_color: '#147f89',
    page_size: 'A4',
  },
  section_order: ['technical_skill', 'project', 'education', 'work_experience', 'certification', 'achievement'],
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

function renderBuilder() {
  return render(<ResumeBuilderPage
    resumes={[]}
    profiles={[]}
    onChanged={vi.fn().mockResolvedValue(undefined)}
    onResumeUpdated={vi.fn()}
    onProfileChanged={vi.fn()}
    onPreview={vi.fn()}
    onAnalyze={vi.fn()}
  />)
}

describe('ResumeBuilderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createResume.mockResolvedValue(resume)
    mocks.getCareerProfiles.mockResolvedValue([profile])
    mocks.updateResume.mockResolvedValue(resume)
  })

  it('creates a resume using the selected persona and template', async () => {
    const user = userEvent.setup()
    renderBuilder()

    await user.click(screen.getByRole('button', { name: /Fresher \/ Early Career/ }))
    await user.click(screen.getByRole('button', { name: /Tech Minimalist/ }))
    await user.type(screen.getByLabelText('Your name'), 'Alex Morgan')
    await user.clear(screen.getByLabelText('Resume version'))
    await user.type(screen.getByLabelText('Resume version'), 'Backend Engineer v1')
    await user.type(screen.getByLabelText('Target role'), 'Backend Engineer')
    await user.click(screen.getByRole('button', { name: 'Create my resume' }))

    expect(await screen.findByRole('heading', { name: 'Build your story' })).toBeInTheDocument()
    expect(mocks.createResume).toHaveBeenCalledWith(expect.objectContaining({
      profile_type: 'fresher',
      template_name: 'minimal',
      title: 'Backend Engineer v1',
      target_role: 'Backend Engineer',
    }))
  })

  it('rejects unsupported imports with an explicit error', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderBuilder()
    const input = document.querySelector('input[type="file"]')
    expect(input).not.toBeNull()

    await user.upload(input as HTMLInputElement, new File(['invalid'], 'resume.exe', { type: 'application/x-msdownload' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a PDF or DOCX file.')
    expect(mocks.importResume).not.toHaveBeenCalled()
  })
})
