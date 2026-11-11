import { apiRequest } from './client'
import type { ParsedResumeData, ResumeParseResponse } from './types'

export function parseResumeFile(file: File): Promise<ResumeParseResponse> {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<ResumeParseResponse>('/resume/parse', {
    method: 'POST',
    body: form,
  })
}

export function updateParsedResume(
  parseId: string,
  parsedData: ParsedResumeData,
): Promise<ResumeParseResponse> {
  return apiRequest<ResumeParseResponse>(`/resume/parse/${encodeURIComponent(parseId)}`, {
    method: 'PUT',
    body: JSON.stringify({ parsed_data: parsedData }),
  })
}
