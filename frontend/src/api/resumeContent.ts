import { apiRequest } from './client'
import type { CareerProfile, ResumeContentOverride, SectionType, SectionRecord } from './types'

const resourceBySection: Record<SectionType, string> = {
  education: 'educations',
  work_experience: 'work-experiences',
  technical_skill: 'technical-skills',
  project: 'projects',
  certification: 'certifications',
  achievement: 'achievements',
}

export async function getSectionRecords(
  section: SectionType,
  profileId: string,
): Promise<SectionRecord[]> {
  return apiRequest<SectionRecord[]>(
    `/${resourceBySection[section]}?career_profile_id=${encodeURIComponent(profileId)}&limit=100`,
  )
}

export function createSectionRecord(
  section: SectionType,
  profile: CareerProfile,
  fields: Record<string, unknown>,
): Promise<SectionRecord> {
  return apiRequest<SectionRecord>(`/${resourceBySection[section]}`, {
    method: 'POST',
    body: JSON.stringify({ ...fields, career_profile_id: profile.id }),
  })
}

export function updateSectionRecord(
  section: SectionType,
  id: string,
  fields: Record<string, unknown>,
): Promise<SectionRecord> {
  return apiRequest<SectionRecord>(`/${resourceBySection[section]}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  })
}

export function deleteSectionRecord(section: SectionType, id: string): Promise<void> {
  return apiRequest<void>(`/${resourceBySection[section]}/${id}`, {
    method: 'DELETE',
  })
}

export function createBulletOverride(
  resumeId: string,
  originalText: string,
  suggestedText: string,
): Promise<ResumeContentOverride> {
  return apiRequest<ResumeContentOverride>(`/resumes/${encodeURIComponent(resumeId)}/bullet-overrides`, {
    method: 'POST',
    body: JSON.stringify({
      original_text: originalText,
      suggested_text: suggestedText,
    }),
  })
}
