import { apiRequest } from './client'
import type { CareerProfile } from './types'

export async function getCareerProfiles(): Promise<CareerProfile[]> {
  return apiRequest<CareerProfile[]>('/career-profiles?limit=100')
}