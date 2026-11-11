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
  const onParsingChange = vi.fn()

  beforeEach(() => {
    onFileSelected.mockClear()
    onParsed.mockClear()
    onParsingChange.mockClear()
    vi.mocked(parseResumeFile).mockReset()
    vi.mocked(parseResumeFile).mockResolvedValue(parsedResume)
  })

  it('uploads an accepted file to the parser and returns its structured result', async () => {
    const user = userEvent.setup()
    render(<ResumeUploader onFileSelected={onFileSelected} onParsed={onParsed} onParsingChange={onParsingChange} />)

    const file = new File(['Avery Example'], 'resume.txt', { type: 'text/plain' })
    await user.upload(screen.getByLabelText('Upload resume file'), file)
    await user.click(screen.getByRole('button', { name: 'Parse resume' }))

    await waitFor(() => expect(parseResumeFile).toHaveBeenCalledWith(
      file,
      expect.any(AbortSignal),
    ))
    expect(onFileSelected).toHaveBeenCalledWith(file)
    expect(onParsed).toHaveBeenCalledWith(parsedResume)
    expect(screen.getByRole('button', { name: 'Resume parsed' })).toBeDisabled()
    expect(onParsingChange).toHaveBeenNthCalledWith(1, true)
    expect(onParsingChange).toHaveBeenLastCalledWith(false)
  })

  it('rejects unsupported image files', async () => {
    render(<ResumeUploader onFileSelected={onFileSelected} onParsed={onParsed} onParsingChange={onParsingChange} />)
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
    render(<ResumeUploader onFileSelected={onFileSelected} onParsed={onParsed} onParsingChange={onParsingChange} />)

    await user.upload(
      screen.getByLabelText('Upload resume file'),
      new File(['Avery Example'], 'resume.txt', { type: 'text/plain' }),
    )
    await user.click(screen.getByRole('button', { name: 'Parse resume' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Parser unavailable.')
  })

  it('locks file selection while parsing and replaces the preview with the next file', async () => {
    const user = userEvent.setup()
    let resolveFirst: ((value: ResumeParseResponse) => void) | undefined
    vi.mocked(parseResumeFile)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce({ ...parsedResume, parse_id: 'parse-second', filename: 'second.txt' })
    render(<ResumeUploader onFileSelected={onFileSelected} onParsed={onParsed} onParsingChange={onParsingChange} />)

    await user.upload(
      screen.getByLabelText('Upload resume file'),
      new File(['First resume'], 'first.txt', { type: 'text/plain' }),
    )
    await user.click(screen.getByRole('button', { name: 'Parse resume' }))
    await waitFor(() => expect(parseResumeFile).toHaveBeenCalledTimes(1))
    const parseButton = screen.getByRole('button', { name: 'Parsing resume…' })
    expect(parseButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Choose file' })).toBeDisabled()
    expect(screen.getByLabelText('Upload resume file')).toBeDisabled()

    await user.upload(
      screen.getByLabelText('Upload resume file'),
      new File(['Second resume'], 'second.txt', { type: 'text/plain' }),
    )
    expect(parseResumeFile).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/first\.txt/)).toBeInTheDocument()

    resolveFirst?.(parsedResume)
    expect(await screen.findByRole('button', { name: 'Resume parsed' })).toBeDisabled()
    expect(onParsed).toHaveBeenCalledWith(parsedResume)

    await user.upload(
      screen.getByLabelText('Upload resume file'),
      new File(['Second resume'], 'second.txt', { type: 'text/plain' }),
    )
    expect(onParsed).toHaveBeenLastCalledWith(null)
    expect(screen.getByRole('button', { name: 'Parse resume' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Parse resume' }))
    await waitFor(() => expect(parseResumeFile).toHaveBeenCalledTimes(2))
    expect(onParsed).toHaveBeenLastCalledWith({
      ...parsedResume,
      parse_id: 'parse-second',
      filename: 'second.txt',
    })
  })
})
