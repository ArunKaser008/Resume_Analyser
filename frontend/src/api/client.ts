const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'
).replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  headers.set('Accept', 'application/json')

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ApiError(
      'Unable to connect to the backend. Check that the FastAPI server is running.',
      0,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const detail =
      typeof body === 'object' && body !== null
        ? (body as { detail?: unknown }).detail
        : body

    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail
              .map((item) => {
                if (typeof item !== 'object' || item === null) {
                  return String(item)
                }
                const issue = item as { loc?: unknown[]; msg?: string }
                const field = issue.loc?.slice(1).join('.')
                return field ? `${field}: ${issue.msg || 'Invalid value'}` : issue.msg
              })
              .join(', ')
          : `Request failed with status ${response.status}`

    throw new ApiError(message, response.status, body)
  }

  return body as T
}

export async function apiBlob(path: string): Promise<Blob> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'application/pdf' },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(
      'Unable to connect to the backend. Check that the FastAPI server is running.',
      0,
    )
  }
  if (!response.ok) {
    const body = await response.text()
    throw new ApiError(body || `Request failed with status ${response.status}`, response.status)
  }
  return response.blob()
}

export async function apiText(path: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'text/html' },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(
      'Unable to connect to the backend. Check that the FastAPI server is running.',
      0,
    )
  }
  const text = await response.text()
  if (!response.ok) throw new ApiError(text || `Request failed with status ${response.status}`, response.status)
  return text
}