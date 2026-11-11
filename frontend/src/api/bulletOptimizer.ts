import { apiRequest } from './client'

export type BulletSeniorityLevel = 'INTERN' | 'FRESHER' | 'SENIOR'
export type BulletSuggestionStyle = 'metric' | 'architecture' | 'leadership_process'

export interface BulletOptimizeRequest {
  original_bullet: string
  target_role: string
  seniority_level: BulletSeniorityLevel
}

export interface BulletSuggestion {
  style: BulletSuggestionStyle
  optimized_bullet: string
  rationale: string
}

export interface BulletOptimizeResponse {
  suggestions: BulletSuggestion[]
  fallback_used: boolean
}

export function optimizeBullet(
  request: BulletOptimizeRequest,
): Promise<BulletOptimizeResponse> {
  return apiRequest<BulletOptimizeResponse>('/bullet/optimize', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}
