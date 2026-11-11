import { useState } from 'react'
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
}

export default function ResumeUploader({ onFileSelected, onParsed }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: ACCEPTED_FILES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    multiple: false,
    noClick: true,
    onDropAccepted: ([accepted]) => {
      setFile(accepted || null)
      setError('')
      onFileSelected(accepted || null)
      onParsed(null)
    },
    onDropRejected: (rejections: FileRejection[]) => {
      setFile(null)
      onFileSelected(null)
      onParsed(null)
      const rejection = rejections[0]
      if (rejection?.errors.some((item) => item.code === 'file-too-large')) {
        setError('Resume files cannot exceed 5 MB.')
      } else {
        setError('Choose a PDF, DOCX, or TXT resume.')
      }
    },
  })

  const parse = async () => {
    if (!file) return
    setParsing(true)
    setError('')
    try {
      onParsed(await parseResumeFile(file))
    } catch (cause) {
      setError(cause instanceof ApiError || cause instanceof Error ? cause.message : 'Unable to parse this resume.')
    } finally {
      setParsing(false)
    }
  }

  return <section className="resume-uploader" aria-label="AI resume parser">
    <div {...getRootProps({ className: `resume-dropzone ${isDragActive ? 'drag-active' : ''}` })}>
      <input {...getInputProps({ 'aria-label': 'Upload resume file' })} />
      <span className="resume-dropzone-icon" aria-hidden="true">↑</span>
      <strong>{isDragActive ? 'Drop your resume here' : 'Drag and drop your resume'}</strong>
      <span className="muted">PDF, DOCX, or TXT · Up to 5 MB</span>
      <button type="button" className="button button-secondary" onClick={open}>Choose file</button>
      {file && <span className="resume-upload-filename">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>}
    </div>
    {parsing && <div className="resume-parse-progress" role="progressbar" aria-label="Uploading and parsing resume" aria-valuetext="Uploading and parsing resume"><span /></div>}
    {error && <div className="notice notice-error resume-upload-error" role="alert">{error}</div>}
    <div className="resume-upload-actions">
      <p className="muted">AI extracts contact details, education, skills, experience, and projects.</p>
      <button type="button" className="button button-primary" disabled={!file || parsing} onClick={() => void parse()}>{parsing ? 'Parsing resume…' : 'Parse resume'}</button>
    </div>
  </section>
}
