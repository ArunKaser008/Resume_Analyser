import { apiRequest } from './client'
import type { ProofOfWorkRequest, ProofOfWorkResponse } from './types'

export function verifyProofOfWork(
  request: ProofOfWorkRequest,
): Promise<ProofOfWorkResponse> {
  return apiRequest<ProofOfWorkResponse>('/verify/proof-of-work', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}
