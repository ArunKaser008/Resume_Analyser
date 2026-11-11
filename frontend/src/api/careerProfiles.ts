import { apiRequest } from './client'
import type { CareerProfile } from './types'

export async function getCareerProfiles(): Promise<CareerProfile[]> {
  return apiRequest<CareerProfile[]>('/career-profiles?limit=100')
}

export function updateCareerProfile(
  id: string,
  payload: Partial<Pick<CareerProfile, 'full_name' | 'email' | 'phone' | 'city' | 'professional_title' | 'summary' | 'linkedin_url' | 'github_url' | 'leetcode_url' | 'portfolio_url'>>,
): Promise<CareerProfile> {
  return apiRequest<CareerProfile>(`/career-profiles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}