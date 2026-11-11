import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseResumeFile } from '../../api/resumeParser'
import type { ResumeParseResponse } from '../../api/types'
import ResumeUploader from './ResumeUploader'

vi.mock('../../api/resumeParser', () => ({
  parseResumeFile: vi.fn(),
}))

const parsedResume: ResumeParseResponse = {
  parse_id: 'parse-123',
  filename: 'resume.txt',
  parsed_data: {
    contact_info: {
      full_name: 'Avery Example',
      email: 'avery@example.com',
      phone: null,
      linkedin_url: null,
      github_url: null,
      leetcode_url: null,
      portfolio_url: null,
    },
    education: [],
    technical_skills: {
      languages: ['Python'],
      frameworks: [],
      cloud_devops: [],
      databases: [],
      tools: [],
    },
    experience: [],
    projects: [],
  },
}

describe('ResumeUploader', () => {
  const onFileSelected = vi.fn()
  const onParsed = vi.fn()

  beforeEach(() => {
    vi.mocked(parseResumeFile).mockResolvedValue(parsedResume)
  })

  it('uploads an accepted file to the parser and returns its structured result', async () => {
    const user = userEvent.setup()
    render(<ResumeUploader onFileSelected={onFileSelected} onParsed={onParsed} />)

    const file = new File(['Avery Example'], 'resume.txt', { type: 'text/plain' })
    await user.upload(screen.getByLabelText('Upload resume file'), file)
    await user.click(screen.getByRole('button', { name: 'Parse resume' }))

    await waitFor(() => expect(parseResumeFile).toHaveBeenCalledWith(file))
    expect(onFileSelected).toHaveBeenCalledWith(file)
    expect(onParsed).toHaveBeenCalledWith(parsedResume)
  })

  it('rejects unsupported image files', async () => {
    render(<ResumeUploader onFileSelected={onFileSelected} onParsed={onParsed} />)
    const file = new File(['image'], 'resume.png', { type: 'image/png' })

    fireEvent.change(screen.getByLabelText('Upload resume file'), {
      target: { files: [file] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a PDF, DOCX, or TXT resume.')
    expect(parseResumeFile).not.toHaveBeenCalled()
  })

  it('displays API errors from the parse operation', async () => {
    vi.mocked(parseResumeFile).mockRejectedValueOnce(new Error('Parser unavailable.'))
    const user = userEvent.setup()
    render(<ResumeUploader onFileSelected={onFileSelected} onParsed={onParsed} />)

    await user.upload(
      screen.getByLabelText('Upload resume file'),
      new File(['Avery Example'], 'resume.txt', { type: 'text/plain' }),
    )
    await user.click(screen.getByRole('button', { name: 'Parse resume' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Parser unavailable.')
  })
})
