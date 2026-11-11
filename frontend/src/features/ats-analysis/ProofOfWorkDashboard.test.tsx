import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyProofOfWork } from '../../api/proofOfWork'
import type { ProofOfWorkResponse } from '../../api/types'
import ProofOfWorkDashboard from './ProofOfWorkDashboard'

vi.mock('../../api/proofOfWork', () => ({
  verifyProofOfWork: vi.fn(),
}))

const verificationResult: ProofOfWorkResponse = {
  score: 72,
  status: 'Verified',
  github: {
    profile_url: 'https://github.com/ada',
    username: 'ada',
    valid: true,
    recent_commits: 12,
    stars: 4,
    top_languages: { TypeScript: 1200 },
    monthly_activity: [{ month: '2026-11', commits: 12 }],
    history_truncated: false,
  },
  leetcode: null,
  projects: [
    {
      title: 'Portfolio',
      status: 'Verified',
      repository_url: 'https://github.com/ada/portfolio',
      repository_owner: 'ada',
      owner_matches_profile: true,
      is_fork: false,
      stars: 4,
      commits_last_12_months: 12,
      languages: ['TypeScript'],
      reasons: ['Repository ownership and public commit activity match the submitted profile.'],
    },
    {
      title: 'Private app',
      status: 'Unverified',
      repository_url: null,
      repository_owner: null,
      owner_matches_profile: null,
      is_fork: null,
      stars: 0,
      commits_last_12_months: 0,
      languages: [],
      reasons: ['No public GitHub repository URL was found in the project details.'],
    },
  ],
  summary: 'Available public evidence supports the submitted developer claims.',
}

describe('ProofOfWorkDashboard', () => {
  beforeEach(() => {
    vi.mocked(verifyProofOfWork).mockResolvedValue(verificationResult)
  })

  it('displays verified and unverified project badges after verification', async () => {
    const user = userEvent.setup()
    render(<ProofOfWorkDashboard />)

    await user.type(
      screen.getByLabelText('GitHub profile URL'),
      'https://github.com/ada',
    )
    await user.click(screen.getByRole('button', { name: 'Verify public evidence' }))

    await waitFor(() => expect(verifyProofOfWork).toHaveBeenCalled())
    expect(await screen.findByText('Portfolio')).toBeInTheDocument()
    expect(screen.getAllByText('Verified').length).toBeGreaterThan(0)
    expect(screen.getByText('Unverified')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/Verified\. Public repository ownership/)).toHaveLength(2)
  })

  it('shows a useful fallback when no profile or repository links are provided', () => {
    render(<ProofOfWorkDashboard />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Add a GitHub or LeetCode profile link',
    )
    expect(screen.getByRole('button', { name: 'Verify public evidence' })).toBeDisabled()
    expect(verifyProofOfWork).not.toHaveBeenCalled()
  })

  it('surfaces provider errors without showing a success-shaped result', async () => {
    vi.mocked(verifyProofOfWork).mockRejectedValueOnce(new Error('GitHub rate limit reached.'))
    render(<ProofOfWorkDashboard />)
    fireEvent.change(screen.getByLabelText('GitHub profile URL'), {
      target: { value: 'https://github.com/ada' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Verify public evidence' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('GitHub rate limit reached.')
    expect(screen.queryByLabelText(/Proof-of-work score/)).not.toBeInTheDocument()
  })
})
