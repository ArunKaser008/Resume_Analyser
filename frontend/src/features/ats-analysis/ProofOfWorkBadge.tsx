import type { ProofStatus } from '../../api/types'

const descriptions: Record<ProofStatus, string> = {
  Verified: 'Public repository ownership and recent commit activity support this project claim.',
  Unverified: 'Available public data is insufficient to confirm this project claim.',
  'High Risk of Misrepresentation': 'The public repository appears empty or is a fork with no changes ahead of its source.',
}

export default function ProofOfWorkBadge({ status }: { status: ProofStatus }) {
  const tone = status === 'Verified'
    ? 'verified'
    : status === 'Unverified'
      ? 'unverified'
      : 'high-risk'

  return <span
    className={`proof-badge proof-badge-${tone}`}
    title={descriptions[status]}
    aria-label={`${status}. ${descriptions[status]}`}
  >
    <span aria-hidden="true">{status === 'Verified' ? '✓' : status === 'Unverified' ? '!' : '×'}</span>
    {status}
  </span>
}
