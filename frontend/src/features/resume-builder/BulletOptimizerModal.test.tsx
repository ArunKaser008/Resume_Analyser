import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { optimizeBullet } from '../../api/bulletOptimizer'
import BulletOptimizerModal from './BulletOptimizerModal'

vi.mock('../../api/bulletOptimizer', () => ({
  optimizeBullet: vi.fn(),
}))

const response = {
  fallback_used: false,
  suggestions: [
    {
      style: 'metric' as const,
      optimized_bullet: 'Accomplished [verified outcome] as measured by [verified metric], by doing improved API calls.',
      rationale: 'A measurable outcome is easier for ATS parsing to recognize.',
    },
    {
      style: 'architecture' as const,
      optimized_bullet: 'Accomplished [verified system outcome] as measured by [verified metric], by doing improved API calls.',
      rationale: 'Architecture context clarifies technical implementation.',
    },
    {
      style: 'leadership_process' as const,
      optimized_bullet: 'Accomplished [verified delivery outcome] as measured by [verified metric], by doing improved API calls.',
      rationale: 'Process context highlights delivery contribution.',
    },
  ],
}

describe('BulletOptimizerModal', () => {
  beforeEach(() => {
    vi.mocked(optimizeBullet).mockResolvedValue(response)
  })

  it('updates the selected suggestion in component state and applies the edited bullet', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn().mockResolvedValue(undefined)
    render(
      <BulletOptimizerModal
        originalBullet="Improved API calls."
        targetRole="Backend Engineer"
        seniorityLevel="SENIOR"
        onClose={vi.fn()}
        onApply={onApply}
      />,
    )

    const architecture = await screen.findByRole('button', { name: /Architecture-focused/ })
    await user.click(architecture)
    const editor = screen.getByRole('textbox', { name: 'Selected suggestion' })
    expect(editor).toHaveValue(response.suggestions[1].optimized_bullet)

    await user.clear(screen.getByLabelText('Verified metric (optional)'))
    await user.type(screen.getByLabelText('Verified metric (optional)'), '25%')
    expect(editor).toHaveValue(
      response.suggestions[1].optimized_bullet.replace('[verified metric]', '25%'),
    )
    fireEvent.change(editor, {
      target: {
        value: 'Accomplished reliable APIs as measured by 25% faster requests, by doing improved API calls.',
      },
    })
    await user.click(screen.getByRole('button', { name: 'Apply to Resume' }))

    await waitFor(() => expect(onApply).toHaveBeenCalledWith(
      'Accomplished reliable APIs as measured by 25% faster requests, by doing improved API calls.',
    ))
  })

  it('does not apply an edited suggestion that no longer follows the XYZ formula', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn().mockResolvedValue(undefined)
    render(
      <BulletOptimizerModal
        originalBullet="Improved API calls."
        targetRole="Backend Engineer"
        seniorityLevel="SENIOR"
        onClose={vi.fn()}
        onApply={onApply}
      />,
    )
    await user.click(await screen.findByRole('button', { name: /Metric-focused/ }))
    await user.clear(screen.getByRole('textbox', { name: 'Selected suggestion' }))
    await user.type(screen.getByRole('textbox', { name: 'Selected suggestion' }), 'Improved APIs.')
    await user.click(screen.getByRole('button', { name: 'Apply to Resume' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Keep the rewrite in the Google XYZ format before applying.',
    )
    expect(onApply).not.toHaveBeenCalled()
  })
})
