import { z } from 'zod'
import type { ProfileType, SectionType } from '../../api/types'

export type PersonalFormValues = {
  full_name: string
  professional_title: string
  email: string
  phone: string
  city: string
  summary: string
  linkedin_url: string
  github_url: string
  leetcode_url: string
  portfolio_url: string
}
export type EntryFormValues = Record<string, string | number | boolean | null>

const optionalEmail = z.string().trim().refine(
  (value) => !value || z.string().email().safeParse(value).success,
  'Enter a valid email address.',
)

const phonePattern = /^(?:\+\d{1,3} ?)?\d{3} ?\d{3} ?\d{4}$/
const optionalPhone = z.string().trim().refine(
  (value) => !value || phonePattern.test(value),
  'Must be a valid 10-digit phone number',
)

function validUrl(value: string, host: string, requiredPath?: RegExp): boolean {
  if (!value) return true
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    return url.protocol === 'https:' && hostname === host && (!requiredPath || requiredPath.test(url.pathname))
  } catch {
    return false
  }
}

function optionalUrl(host: string, message: string, requiredPath?: RegExp) {
  return z.string().trim().refine(
    (value) => validUrl(value, host, requiredPath),
    message,
  )
}

function optionalPortfolioUrl(value: string): boolean {
  if (!value) return true
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()
    return url.protocol === 'https:' &&
      hostname.includes('.') &&
      !hostname.startsWith('.') &&
      !hostname.endsWith('.') &&
      hostname.split('.').every((part) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(part))
  } catch {
    return false
  }
}

export const personalFormSchema = z.object({
  full_name: z.string().trim().refine(
    (value) => !value || value.length >= 2,
    'Enter at least 2 characters.',
  ),
  professional_title: z.string(),
  email: optionalEmail,
  phone: optionalPhone,
  city: z.string(),
  summary: z.string().max(350, 'Summary must be 350 characters or fewer.'),
  linkedin_url: optionalUrl('linkedin.com', 'Enter a valid linkedin.com/in/ profile URL.', /^\/in\/[^/]+\/?$/),
  github_url: optionalUrl('github.com', 'Enter a valid github.com profile URL.', /^\/[A-Za-z0-9-]+\/?$/),
  leetcode_url: optionalUrl('leetcode.com', 'Enter a valid leetcode.com profile URL.'),
  portfolio_url: z.string().trim().refine(optionalPortfolioUrl, 'Enter a valid portfolio URL.'),
})

const datePattern = /^(0[1-9]|1[0-2])\/\d{4}$/
function monthIndex(value: string): number | null {
  if (!datePattern.test(value)) return null
  const [month, year] = value.split('/').map(Number)
  return year * 12 + month
}

function gradeIsValid(value: string): boolean {
  if (!value) return true
  const percentage = value.endsWith('%')
  const numeric = percentage ? value.slice(0, -1) : value
  if (!/^(?:\d+|\d*\.\d+)$/.test(numeric)) return false
  const parsed = Number(numeric)
  return percentage ? parsed >= 0 && parsed <= 100 : parsed >= 0 && parsed <= 10
}

export function entryFormSchema(type: SectionType, profileType: ProfileType) {
  return z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).superRefine((values, context) => {
    for (const field of requiredFields[type]) {
      if (!String(values[field] ?? '').trim()) {
        context.addIssue({ code: 'custom', path: [field], message: 'This field is required.' })
      }
    }

    for (const field of dateFields[type] || []) {
      const value = String(values[field] ?? '')
      const isPresentEnd = field === 'end_date' && value.toLowerCase() === 'present'
      if (value && !isPresentEnd && !datePattern.test(value)) {
        context.addIssue({ code: 'custom', path: [field], message: 'Use MM/YYYY or Present.' })
      }
    }

    if (type === 'work_experience' || type === 'education') {
      const start = String(values.start_date ?? '')
      const end = String(values.end_date ?? '')
      const startIndex = monthIndex(start)
      const endIndex = monthIndex(end)
      if (endIndex !== null && startIndex !== null && endIndex < startIndex) {
        context.addIssue({ code: 'custom', path: ['end_date'], message: 'End date cannot precede the start date.' })
      }
      if (start.toLowerCase() === 'present') {
        context.addIssue({ code: 'custom', path: ['start_date'], message: 'Start date cannot be Present.' })
      }
    }

    if (type === 'education' && profileType === 'student') {
      const grade = String(values.grade ?? '')
      if (!gradeIsValid(grade)) {
        context.addIssue({ code: 'custom', path: ['grade'], message: 'Enter CGPA from 0 to 10 or percentage from 0% to 100%.' })
      }
    }

    for (const [field, rawValue] of Object.entries(values)) {
      if (!field.endsWith('_url') || !String(rawValue || '').trim()) continue
      if (!optionalPortfolioUrl(String(rawValue))) {
        context.addIssue({ code: 'custom', path: [field], message: 'Enter a valid URL.' })
      }
    }
  })
}

export function normalizeUrlInput(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function sanitizePhoneInput(value: string): string {
  const filtered = value.replace(/[^\d+ ]/g, '')
  return filtered.startsWith('+')
    ? `+${filtered.slice(1).replace(/\+/g, '')}`.replace(/\s{2,}/g, ' ')
    : filtered.replace(/\+/g, '').replace(/\s{2,}/g, ' ')
}

export function displayMonth(value: string | null | undefined): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}/.test(value)) {
    const [year, month] = value.split('-')
    return `${month}/${year}`
  }
  return value
}

export function toApiDate(value: string): string | null {
  const normalized = value.trim()
  if (!normalized || normalized.toLowerCase() === 'present') return null
  if (!datePattern.test(normalized)) return normalized
  const [month, year] = normalized.split('/')
  return `${year}-${month}-01`
}

const requiredFields: Record<SectionType, string[]> = {
  education: ['institution_name', 'degree'],
  technical_skill: ['skill_name'],
  work_experience: ['company_name', 'job_title', 'start_date'],
  project: ['project_name'],
  certification: ['certification_name', 'issuing_organization'],
  achievement: ['title'],
}

const dateFields: Partial<Record<SectionType, string[]>> = {
  education: ['start_date', 'end_date'],
  work_experience: ['start_date', 'end_date'],
  certification: ['issue_date', 'expiry_date'],
  achievement: ['achievement_date'],
}
