import { useEffect, useRef, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { ApiError } from '../../api/client'
import { parseResumeFile } from '../../api/resumeParser'
import type { ResumeParseResponse } from '../../api/types'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ACCEPTED_FILES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
}

interface Props {
  onFileSelected: (file: File | null) => void
  onParsed: (result: ResumeParseResponse | null) => void
  onParsingChange?: (parsing: boolean) => void
}

export default function ResumeUploader({ onFileSelected, onParsed, onParsingChange }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(false)
  const [error, setError] = useState('')
  const activeParse = useRef<AbortController | null>(null)

  useEffect(() => () => {
    activeParse.current?.abort()
    activeParse.current = null
  }, [])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: ACCEPTED_FILES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    multiple: false,
    noClick: true,
    disabled: parsing,
    onDropAccepted: ([accepted]) => {
      if (activeParse.current) return
      setFile(accepted || null)
      setParsed(false)
      setError('')
      onParsed(null)
      onFileSelected(accepted || null)
    },
    onDropRejected: (rejections: FileRejection[]) => {
      if (activeParse.current) return
      setFile(null)
      setParsed(false)
      onParsed(null)
      onFileSelected(null)
      const rejection = rejections[0]
      if (rejection?.errors.some((item) => item.code === 'file-too-large')) {
        setError('Resume files cannot exceed 5 MB.')
      } else {
        setError('Choose a PDF, DOCX, or TXT resume.')
      }
    },
  })

  const parse = async () => {
    if (!file || parsed || activeParse.current) return
    const controller = new AbortController()
    activeParse.current = controller
    setParsing(true)
    onParsingChange?.(true)
    setError('')
    onParsed(null)
    try {
      const parsed = await parseResumeFile(file, controller.signal)
      if (activeParse.current === controller) {
        setParsed(true)
        onParsed(parsed)
      }
    } catch (cause) {
      if (activeParse.current === controller && !controller.signal.aborted) {
        setError(cause instanceof ApiError || cause instanceof Error ? cause.message : 'Unable to parse this resume.')
      }
    } finally {
      if (activeParse.current === controller) {
        activeParse.current = null
        setParsing(false)
        onParsingChange?.(false)
      }
    }
  }

  return <section className="resume-uploader" aria-label="AI resume parser">
    <div {...getRootProps({ className: `resume-dropzone ${isDragActive ? 'drag-active' : ''}` })}>
      <input {...getInputProps({ 'aria-label': 'Upload resume file', disabled: parsing })} />
      <span className="resume-dropzone-icon" aria-hidden="true">↑</span>
      <strong>{isDragActive ? 'Drop your resume here' : 'Drag and drop your resume'}</strong>
      <span className="muted">PDF, DOCX, or TXT · Up to 5 MB</span>
      <button type="button" className="button button-secondary" disabled={parsing} onClick={open}>Choose file</button>
      {file && <span className="resume-upload-filename">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>}
    </div>
    {parsing && <div className="resume-parse-progress" role="progressbar" aria-label="Uploading and parsing resume" aria-valuetext="Uploading and parsing resume"><span /></div>}
    {error && <div className="notice notice-error resume-upload-error" role="alert">{error}</div>}
    <div className="resume-upload-actions">
      <p className="muted">AI extracts contact details, education, skills, experience, and projects.</p>
      <button type="button" className="button button-primary" disabled={!file || parsing || parsed} onClick={() => void parse()}>
        {parsing && <span className="resume-parse-spinner" aria-hidden="true" />}
        {parsing ? 'Parsing resume…' : parsed ? 'Resume parsed' : 'Parse resume'}
      </button>
    </div>
  </section>
}
