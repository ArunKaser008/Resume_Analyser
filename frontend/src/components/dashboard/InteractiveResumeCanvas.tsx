import { useMemo, useState } from 'react'
import type { AnnotatedSection, HighlightFlag, ResumePatch } from '../../types/dashboard'

const labels: Record<HighlightFlag, string> = {
  ATS_RISK: 'ATS risk',
  WEAK_PHRASING: 'Weak phrasing',
  STRONG_METRIC: 'Strong metric',
}

interface Props {
  sections: AnnotatedSection[]
  onRequestFix: (text: string, lineNumber: number) => Promise<ResumePatch | null>
  focusLine: number | null
}

export default function InteractiveResumeCanvas({ sections, onRequestFix, focusLine }: Props) {
  const [activeLine, setActiveLine] = useState<number | null>(null)
  const [applied, setApplied] = useState<Record<number, string>>({})
  const [fixing, setFixing] = useState<number | null>(null)
  const [error, setError] = useState('')
  const rows = useMemo(() => sections, [sections])

  const applyFix = async (section: AnnotatedSection) => {
    setFixing(section.line_number)
    setError('')
    try {
      const patch = await onRequestFix(section.text, section.line_number)
      if (patch) setApplied((current) => ({ ...current, [section.line_number]: patch.suggested_text }))
      else setError('The copilot did not return a replacement for this line.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to request an AI fix.')
    } finally {
      setFixing(null)
    }
  }

  return <section className="panel dashboard-panel" aria-labelledby="resume-canvas-title">
    <div className="panel-title"><div><h2 id="resume-canvas-title">Interactive resume canvas</h2><p>Select a highlighted line to inspect or request an evidence-preserving rewrite.</p></div><div className="dashboard-legend"><span className="legend-risk">ATS risk</span><span className="legend-weak">Weak phrasing</span><span className="legend-strong">Strong metric</span></div></div>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {rows.length === 0
      ? <div className="dashboard-empty">No resume text is available to annotate yet.</div>
      : <div className="resume-canvas-layout">
        <div className="resume-canvas" role="list" aria-label="Annotated resume lines">{rows.map((section) => {
        const content = applied[section.line_number] || section.text
        return <article
          className={`resume-canvas-line ${section.highlight ? `highlight-${section.highlight.toLowerCase()}` : ''} ${focusLine === section.line_number ? 'resume-line-focused' : ''}`}
          key={`${section.line_number}-${section.text}`}
          data-line-number={section.line_number}
          id={`resume-line-${section.line_number}`}
          role="listitem"
        >
          <span className="resume-line-number">{section.line_number}</span>
          <div className="resume-line-content">
            <button type="button" className="resume-line-text" onClick={() => setActiveLine(activeLine === section.line_number ? null : section.line_number)}>
              {content}
            </button>
            {section.highlight && <span className={`resume-highlight-label ${section.highlight.toLowerCase()}`}>{labels[section.highlight]}</span>}
            {activeLine === section.line_number && <div className="resume-inline-popover">
              <p>{section.highlight ? `${labels[section.highlight]} detected.` : 'No automated issue detected on this line.'} Review any rewrite for factual accuracy.</p>
              {applied[section.line_number] && <small className="resume-preview-status">Updated in this dashboard preview; the saved resume is unchanged.</small>}
              <button type="button" className="button button-primary" disabled={fixing === section.line_number} onClick={() => void applyFix(section)}>
                {fixing === section.line_number ? 'Generating…' : 'Apply AI fix'}
              </button>
            </div>}
          </div>
        </article>
        })}</div>
        <aside className="resume-canvas-insights" aria-label="Highlight summary">
          <h3>Review signals</h3>
          {rows.filter((section) => section.highlight).length === 0
            ? <p className="dashboard-empty">No flagged lines found.</p>
            : rows.filter((section) => section.highlight).map((section) => <button
              type="button"
              key={section.line_number}
              onClick={() => {
                setActiveLine(section.line_number)
                const line = document.getElementById(`resume-line-${section.line_number}`)
                if (line && typeof line.scrollIntoView === 'function') line.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}
            >
              <span className={`resume-highlight-label ${section.highlight?.toLowerCase()}`}>{section.highlight ? labels[section.highlight] : ''}</span>
              <span>Line {section.line_number}: {section.text}</span>
            </button>)}
        </aside>
      </div>}
  </section>
}
