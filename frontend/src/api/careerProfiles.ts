import { apiRequest } from './client'
import type { CareerProfile, CareerProfileCreate } from './types'
import { normalizeList } from './types'

export async function getCareerProfiles(): Promise<CareerProfile[]> {
  const response = await apiRequest<unknown>('/career-profiles')
  return normalizeList<CareerProfile>(response)
}

export function createCareerProfile(
  payload: CareerProfileCreate,
): Promise<CareerProfile> {
  return apiRequest<CareerProfile>('/career-profiles', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}