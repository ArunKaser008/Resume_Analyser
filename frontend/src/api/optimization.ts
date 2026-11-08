import { apiRequest } from './client'
import type {
  OptimizationSession,
  ResumeContentOverride,
  ResumeOptimization,
  TailoringResult,
} from './types'

export function optimizeResume(
  resumeId: string,
  job_description: string,
): Promise<ResumeOptimization> {
  return apiRequest<ResumeOptimization>(`/resumes/${resumeId}/optimize`, {
    method: 'POST',
    body: JSON.stringify({ job_description }),
  })
}

export function createOptimizationSession(
  resumeId: string,
  job_description: string,
): Promise<OptimizationSession> {
  return apiRequest<OptimizationSession>(
    `/resumes/${resumeId}/optimization-sessions`,
    {
      method: 'POST',
      body: JSON.stringify({ job_description }),
    },
  )
}

export function getOptimizationSessions(
  resumeId: string,
): Promise<OptimizationSession[]> {
  return apiRequest<OptimizationSession[]>(
    `/resumes/${resumeId}/optimization-sessions`,
  )
}

export function getOptimizationSession(id: string): Promise<OptimizationSession> {
  return apiRequest<OptimizationSession>(`/optimization-sessions/${id}`)
}

export function setSuggestionDecision(
  id: string,
  status: 'accepted' | 'rejected',
): Promise<{
  message: string
  suggestion: OptimizationSession['suggestions'][number]
  session_status: string
}> {
  return apiRequest(`/optimization-suggestions/${id}/decision`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function applySuggestion(
  id: string,
  target_field:
    | 'summary'
    | 'description'
    | 'responsibilities'
    | 'achievements'
    | 'source_text',
  target_item_id?: string,
): Promise<ResumeContentOverride> {
  return apiRequest<ResumeContentOverride>(
    `/optimization-suggestions/${id}/apply`,
    {
      method: 'POST',
      body: JSON.stringify({ target_field, target_item_id }),
    },
  )
}

export function getContentOverrides(
  resumeId: string,
): Promise<ResumeContentOverride[]> {
  return apiRequest<ResumeContentOverride[]>(
    `/resumes/${resumeId}/content-overrides`,
  )
}

export function deleteContentOverride(
  resumeId: string,
  overrideId: string,
): Promise<void> {
  return apiRequest<void>(
    `/resumes/${resumeId}/content-overrides/${overrideId}`,
    { method: 'DELETE' },
  )
}

export function tailorResume(
  resumeId: string,
  job_description: string,
): Promise<TailoringResult> {
  return apiRequest<TailoringResult>(`/resumes/${resumeId}/tailor`, {
    method: 'POST',
    body: JSON.stringify({ job_description }),
  })
}
