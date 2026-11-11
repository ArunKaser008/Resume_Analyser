import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { updateParsedResume } from '../../api/resumeParser'
import type { ResumeParseResponse } from '../../api/types'
import ParsedDataPreview from './ParsedDataPreview'

vi.mock('../../api/resumeParser', () => ({
  updateParsedResume: vi.fn(),
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

describe('ParsedDataPreview', () => {
  it('lets the user correct extracted values and saves them through the API', async () => {
    const user = userEvent.setup()
    vi.mocked(updateParsedResume).mockImplementation(async (_id, parsedData) => ({
      ...parsedResume,
      parsed_data: parsedData,
    }))
    render(<ParsedDataPreview result={parsedResume} />)

    await user.click(screen.getByRole('button', { name: 'Edit parsed data' }))
    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Avery Corrected' },
    })
    await user.click(screen.getByRole('button', { name: 'Save corrections' }))

    await waitFor(() => expect(updateParsedResume).toHaveBeenCalled())
    expect(vi.mocked(updateParsedResume).mock.calls[0][1].contact_info.full_name).toBe('Avery Corrected')
    expect(await screen.findByText('Parsed details saved.')).toBeInTheDocument()
    expect(screen.getByText('Avery Corrected')).toBeInTheDocument()
  })
})
