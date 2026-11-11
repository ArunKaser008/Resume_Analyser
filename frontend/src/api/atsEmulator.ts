import { apiRequest } from './client'
import type { ATSJDAnalysis, TargetATS } from './types'

export function analyzeResumeForATS(
  resumeId: string,
  jobDescription: string,
  targetATS: TargetATS,
  signal?: AbortSignal,
): Promise<ATSJDAnalysis> {
  return apiRequest<ATSJDAnalysis>('/resume/analyze-jd', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      resume_id: resumeId,
      job_description: jobDescription,
      target_ats: targetATS,
    }),
  })
}
