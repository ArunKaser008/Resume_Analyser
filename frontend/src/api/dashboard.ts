import { apiRequest } from './client'
import type {
  CopilotChatResponse,
  DashboardResponse,
  InterviewPrepResponse,
  TierSimulationRequest,
  TierSimulationResponse,
} from '../types/dashboard'

export function getDashboard(analysisId: string): Promise<DashboardResponse> {
  return apiRequest<DashboardResponse>(`/dashboard/${encodeURIComponent(analysisId)}`)
}

export function simulateCompanyTier(
  request: TierSimulationRequest,
): Promise<TierSimulationResponse> {
  return apiRequest<TierSimulationResponse>('/dashboard/simulate-tier', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function generateInterviewPrep(
  resumeId: string,
  targetJd?: string,
): Promise<InterviewPrepResponse> {
  return apiRequest<InterviewPrepResponse>('/dashboard/interview-prep', {
    method: 'POST',
    body: JSON.stringify({ resume_id: resumeId, target_jd: targetJd || null }),
  })
}

export function sendCopilotMessage(
  resumeId: string,
  message: string,
  contextSectionId?: string,
): Promise<CopilotChatResponse> {
  return apiRequest<CopilotChatResponse>('/dashboard/copilot-chat', {
    method: 'POST',
    body: JSON.stringify({
      resume_id: resumeId,
      message,
      context_section_id: contextSectionId || null,
    }),
  })
}
