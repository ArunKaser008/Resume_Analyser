import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CareerProfile, ProfileType, Resume } from '../../api/types'
import ResumeBuilderPage from './ResumeBuilderPage'
import { entryFormSchema, personalFormSchema, sanitizePhoneInput } from './resumeValidation'

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

function renderBuilder(options: { initialResume?: Resume; profiles?: CareerProfile[] } = {}) {
  return render(<ResumeBuilderPage
    resumes={options.initialResume ? [options.initialResume] : []}
    profiles={options.profiles || []}
    initialResume={options.initialResume}
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
    mocks.getResumeSections.mockResolvedValue({ resume_id: resume.id, sections: [] })
    mocks.getSectionRecords.mockResolvedValue([])
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

  it('hydrates imported profile and section records into the resume editor', async () => {
    const user = userEvent.setup()
    const importedProfile: CareerProfile = {
      ...profile,
      id: 'imported-profile',
      full_name: 'Alex Example',
      email: 'alex@example.com',
      summary: 'Builds reliable applications.',
    }
    const importedResume: Resume = {
      ...resume,
      id: 'imported-resume',
      career_profile_id: importedProfile.id,
      title: 'Alex Resume',
      target_role: 'Software Engineer',
    }
    mocks.importResume.mockResolvedValue({
      career_profile: importedProfile,
      resume: importedResume,
      extracted_character_count: 300,
    })
    mocks.updateResume.mockResolvedValue(importedResume)
    mocks.getCareerProfiles.mockResolvedValue([importedProfile])
    mocks.getResumeSections.mockResolvedValue({
      resume_id: importedResume.id,
      sections: [
        { section_type: 'work_experience', items: [{ item_id: 'experience-1', display_order: 0 }] },
        { section_type: 'project', items: [{ item_id: 'project-1', display_order: 0 }] },
      ],
    })
    mocks.getSectionRecords.mockImplementation((type: string) => Promise.resolve(
      type === 'work_experience'
        ? [{
            id: 'experience-1',
            company_name: 'Example Labs',
            job_title: 'Software Engineer',
            employment_type: 'Full-time',
            location: 'Toronto',
            start_date: '2023-02-01',
            end_date: null,
            is_current: true,
            description: 'Built a production API.',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          }]
        : type === 'project'
          ? [{
              id: 'project-1',
              project_name: 'Resume Studio',
              role: 'Developer',
              technologies: 'React, FastAPI',
              project_url: null,
              description: 'Built an ATS resume editor.',
              responsibilities: null,
              achievements: null,
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z',
            }]
          : [],
    ))
    renderBuilder()

    const input = document.querySelector('input[type="file"]')
    expect(input).not.toBeNull()
    await user.upload(
      input as HTMLInputElement,
      new File(['resume text'], 'alex-resume.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    )

    expect(await screen.findByDisplayValue('Alex Example')).toBeInTheDocument()
    expect(screen.getByDisplayValue('alex@example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Example Labs')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Resume Studio')).toBeInTheDocument()
    expect(await screen.findByText('Resume successfully imported! Please review your sections below.')).toBeInTheDocument()
    expect(mocks.importResume).toHaveBeenCalledOnce()
  })

  it('shows email validation and prevents an invalid PDF export', async () => {
    const user = userEvent.setup()
    renderBuilder({ initialResume: resume, profiles: [profile] })
    const email = await screen.findByLabelText('Email')
    await user.type(email, 'not-an-email')

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeDisabled()
  })

  it('validates phone digits, profile URL domains, date chronology, and campus grades', () => {
    expect(sanitizePhoneInput('+91 9876543210abc')).toBe('+91 9876543210')
    expect(personalFormSchema.safeParse({
      full_name: '',
      professional_title: '',
      email: '',
      phone: '',
      city: '',
      summary: '',
      linkedin_url: '',
      github_url: '',
      leetcode_url: '',
      portfolio_url: '',
    }).success).toBe(true)
    expect(personalFormSchema.safeParse({
      full_name: 'Alex Morgan',
      professional_title: '',
      email: '',
      phone: '123456789',
      city: '',
      summary: '',
      linkedin_url: '',
      github_url: 'https://notgithub.com/alex',
      leetcode_url: '',
      portfolio_url: '',
    }).success).toBe(false)

    const education = entryFormSchema('education', 'student' satisfies ProfileType)
    const result = education.safeParse({
      institution_name: 'Example University',
      degree: 'BSc',
      start_date: '08/2024',
      end_date: '07/2023',
      grade: '10.5',
      is_current: true,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
        'End date cannot precede the start date.',
        'Enter CGPA from 0 to 10 or percentage from 0% to 100%.',
      ]))
    }
  })
})
