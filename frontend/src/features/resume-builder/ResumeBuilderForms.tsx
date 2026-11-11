import { useRef, type KeyboardEvent } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CareerProfile, ProfileType, SectionType } from '../../api/types'
import {
  displayMonth,
  entryFormSchema,
  normalizeUrlInput,
  personalFormSchema,
  sanitizePhoneInput,
  type EntryFormValues,
  type PersonalFormValues,
} from './resumeValidation'

type PersonalDetailsFormProps = {
  profile: CareerProfile
  targetRole: string
  onProfileChange: (field: keyof PersonalFormValues, value: string) => void
  onTargetRoleChange: (value: string) => void
}

const personalFields: { key: keyof PersonalFormValues; label: string; type?: string; wide?: boolean; placeholder?: string }[] = [
  { key: 'full_name', label: 'Full name' },
  { key: 'professional_title', label: 'Professional title', placeholder: 'e.g. Computer Science Student' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'city', label: 'City / location' },
  { key: 'linkedin_url', label: 'LinkedIn', placeholder: 'linkedin.com/in/your-name' },
  { key: 'github_url', label: 'GitHub', placeholder: 'github.com/username' },
  { key: 'leetcode_url', label: 'LeetCode', placeholder: 'leetcode.com/u/username' },
  { key: 'portfolio_url', label: 'Portfolio', placeholder: 'yourname.com' },
]

export function PersonalDetailsForm({
  profile,
  targetRole,
  onProfileChange,
  onTargetRoleChange,
}: PersonalDetailsFormProps) {
  const { register, setValue, watch, formState: { errors } } = useForm<PersonalFormValues>({
    resolver: zodResolver(personalFormSchema),
    mode: 'onChange',
    defaultValues: profileValues(profile),
  })

  const summary = watch('summary') || ''
  const profileField = (key: keyof PersonalFormValues) => register(key)
  const errorFor = (key: keyof PersonalFormValues) => errors[key]?.message

  return <div className="mb-form-grid">
    {personalFields.map(({ key, label, type, placeholder }) => {
      const field = profileField(key)
      const error = errorFor(key)
      const value = watch(key) || ''
      return <label key={key}>
        {label}
        <input
          {...field}
          type={type || 'text'}
          inputMode={key === 'phone' ? 'tel' : undefined}
          placeholder={placeholder}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `profile-${key}-error` : undefined}
          className={error ? 'has-validation-error' : ''}
          onChange={(event) => {
            if (key === 'phone') {
              const sanitized = sanitizePhoneInput(event.currentTarget.value)
              setValue(key, sanitized, { shouldDirty: true, shouldValidate: true })
              onProfileChange(key, sanitized)
              return
            }
            field.onChange(event)
            onProfileChange(key, event.currentTarget.value)
          }}
          onBlur={(event) => {
            field.onBlur(event)
            if (key.endsWith('_url')) {
              const normalized = normalizeUrlInput(event.currentTarget.value)
              if (normalized !== event.currentTarget.value) {
                setValue(key, normalized, { shouldDirty: true, shouldValidate: true })
                onProfileChange(key, normalized)
              }
            }
          }}
        />
        {error && <span className="mb-field-error" id={`profile-${key}-error`} role="alert">{error}</span>}
      </label>
    })}
    <label className="mb-field-wide">
      Target role
      <input value={targetRole} placeholder="What role are you targeting?" onChange={(event) => onTargetRoleChange(event.target.value)} />
    </label>
    <label className="mb-field-wide">
      Professional summary
      <textarea
        rows={4}
        maxLength={350}
        value={summary}
        aria-invalid={Boolean(errors.summary)}
        aria-describedby={errors.summary ? 'profile-summary-error' : 'profile-summary-count'}
        className={errors.summary ? 'has-validation-error' : ''}
        placeholder="Summarize your strengths, direction, or professional impact."
        {...register('summary', {
          onChange: (event) => onProfileChange('summary', event.currentTarget.value),
        })}
      />
      {errors.summary
        ? <span className="mb-field-error" id="profile-summary-error" role="alert">{errors.summary.message}</span>
        : <span className="mb-character-count" id="profile-summary-count">{summary.length}/350 characters</span>}
    </label>
  </div>
}

type ResumeEntryFormProps = {
  entry: { id: string; type: SectionType; fields: EntryFormValues }
  profileType: ProfileType
  fields: { key: string; label: string; multiline?: boolean }[]
  onUpdate: (key: string, value: string | number | boolean | null) => void
}

export function ResumeEntryForm({ entry, profileType, fields, onUpdate }: ResumeEntryFormProps) {
  const schema = entryFormSchema(entry.type, profileType)
  const { register, setValue, watch, formState: { errors } } = useForm<EntryFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: dateValues(entry.fields),
  })
  const textareas = useRef<Record<string, HTMLTextAreaElement | null>>({})

  const setFieldValue = (key: string, value: string | number | boolean | null) => {
    setValue(key, value, { shouldDirty: true, shouldValidate: true })
    onUpdate(key, value)
  }

  const insertBullet = (key: string, event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    const textarea = event.currentTarget
    const current = textarea.value
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const insertion = '\n• '
    const next = `${current.slice(0, start)}${insertion}${current.slice(end)}`
    setFieldValue(key, capitalizeBulletStarts(next))
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + insertion.length, start + insertion.length)
    })
  }

  return <div className="mb-form-grid">
    {fields.map(({ key, label, multiline }) => {
      const fieldPath = key as FieldPath<EntryFormValues>
      const field = register(fieldPath)
      const value = watch(fieldPath)
      const error = errors[key]?.message
      const required = requiredFields[entry.type].includes(key)
      const numeric = key === 'years_of_experience'
      const isGrade = entry.type === 'education' && key === 'grade' && profileType === 'student'
      const isDate = key === 'start_date' || key === 'end_date' || key.endsWith('_date')
      const isUrl = key.endsWith('_url')
      const warning = multiline && isLongBulletText(String(value ?? ''))

      return <label key={key} className={multiline ? 'mb-field-wide' : ''}>
        {label}
        {multiline
          ? <textarea
              {...field}
              ref={(node) => {
                field.ref(node)
                textareas.current[key] = node
              }}
              rows={3}
              value={String(value ?? '')}
              aria-invalid={Boolean(error)}
              className={error ? 'has-validation-error' : ''}
              onChange={(event) => setFieldValue(key, capitalizeBulletStarts(event.currentTarget.value))}
              onKeyDown={(event) => insertBullet(key, event)}
            />
          : <input
              {...field}
              type={numeric ? 'number' : 'text'}
              inputMode={numeric || isGrade ? 'decimal' : isDate ? 'numeric' : undefined}
              required={required}
              min={numeric ? 0 : undefined}
              placeholder={isDate ? 'MM/YYYY' : isUrl ? 'https://…' : isGrade ? 'e.g. 8.5 or 85%' : undefined}
              value={isDate ? displayMonth(String(value ?? '')) : value == null ? '' : String(value)}
              aria-invalid={Boolean(error)}
              className={error ? 'has-validation-error' : ''}
              onChange={(event) => {
                let nextValue = event.currentTarget.value
                if (isGrade) nextValue = nextValue.replace(/[^\d.%]/g, '').replace(/(?!^)\./g, '')
                if (numeric) setFieldValue(key, nextValue === '' ? null : Number(nextValue))
                else setFieldValue(key, nextValue)
              }}
              onBlur={(event) => {
                field.onBlur(event)
                if (isUrl) {
                  const normalized = normalizeUrlInput(event.currentTarget.value)
                  if (normalized !== event.currentTarget.value) setFieldValue(key, normalized)
                }
              }}
            />}
        {error && <span className="mb-field-error" role="alert">{String(error)}</span>}
        {warning && <span className="mb-field-warning" role="status">This bullet may wrap beyond two lines. Consider shortening it.</span>}
      </label>
    })}
  </div>
}

function profileValues(profile: CareerProfile): PersonalFormValues {
  return {
    full_name: profile.full_name,
    professional_title: profile.professional_title || '',
    email: profile.email || '',
    phone: profile.phone || '',
    city: profile.city || '',
    summary: profile.summary || '',
    linkedin_url: profile.linkedin_url || '',
    github_url: profile.github_url || '',
    leetcode_url: profile.leetcode_url || '',
    portfolio_url: profile.portfolio_url || '',
  }
}

function dateValues(fields: EntryFormValues): EntryFormValues {
  return {
    ...fields,
    start_date: displayMonth(String(fields.start_date ?? '')),
    end_date: displayMonth(String(fields.end_date ?? '')),
    issue_date: displayMonth(String(fields.issue_date ?? '')),
    expiry_date: displayMonth(String(fields.expiry_date ?? '')),
    achievement_date: displayMonth(String(fields.achievement_date ?? '')),
  }
}

function capitalizeBulletStarts(value: string): string {
  return value.replace(/(^|\n\s*[•-]\s*)([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`)
}

function isLongBulletText(value: string): boolean {
  return value.split(/\r?\n/).some((line) => line.length > 150)
}

const requiredFields: Record<SectionType, string[]> = {
  education: ['institution_name', 'degree'],
  technical_skill: ['skill_name'],
  work_experience: ['company_name', 'job_title', 'start_date'],
  project: ['project_name'],
  certification: ['certification_name', 'issuing_organization'],
  achievement: ['title'],
}
