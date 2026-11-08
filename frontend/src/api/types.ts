export type ProfileType = 'fresher' | 'experienced'
export type ResumeTemplate = 'modern' | 'professional' | 'minimal'

export interface CareerProfile {
  id: string
  profile_type: ProfileType
  full_name: string
  email?: string | null
  phone?: string | null
  city?: string | null
  professional_title?: string | null
  summary?: string | null
  linkedin_url?: string | null
  github_url?: string | null
  portfolio_url?: string | null
  created_at?: string
  updated_at?: string
}

export interface CareerProfileCreate {
  profile_type: ProfileType
  full_name: string
  email?: string
  phone?: string
  city?: string
  professional_title?: string
  summary?: string
  linkedin_url?: string
  github_url?: string
  portfolio_url?: string
}

export interface Resume {
  id: string
  career_profile_id: string
  title: string
  target_role?: string | null
  template_name: ResumeTemplate
  is_primary: boolean
  created_at?: string
  updated_at?: string
}

export interface ResumeCreate {
  career_profile_id: string
  title: string
  target_role?: string
  template_name: ResumeTemplate
  is_primary: boolean
}

export function normalizeList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]

  if (value && typeof value === 'object') {
    const result = value as {
      items?: T[]
      data?: T[]
      results?: T[]
    }

    if (Array.isArray(result.items)) return result.items
    if (Array.isArray(result.data)) return result.data
    if (Array.isArray(result.results)) return result.results
  }

  return []
}