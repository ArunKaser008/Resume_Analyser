import { useState, type FormEvent } from 'react'
import { sendCopilotMessage } from '../../api/dashboard'
import type { CopilotChatResponse } from '../../types/dashboard'

export default function ResumeCopilotDrawer({ resumeId, onClose, onApplyPatch }: {
  resumeId: string
  onClose: () => void
  onApplyPatch: (patch: CopilotChatResponse['patches'][number]) => Promise<boolean>
}) {
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState<CopilotChatResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const suggestions = ['Strengthen my latest project bullet', 'What skills should I emphasize?', 'Make this resume more concise']

  const submit = async (event?: FormEvent, prompt = message) => {
    event?.preventDefault()
    if (!prompt.trim() || loading) return
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const response = await sendCopilotMessage(resumeId, prompt.trim())
      setHistory((current) => [...current, response])
    } catch (cause) {
      setMessage(prompt)
      setError(cause instanceof Error ? cause.message : 'The copilot could not respond.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="copilot-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <aside className="copilot-drawer" role="dialog" aria-modal="true" aria-labelledby="copilot-title">
      <header><div><span className="eyebrow">RESUME-AWARE ASSISTANT</span><h2 id="copilot-title">Resume copilot</h2></div><button className="button button-secondary" type="button" onClick={onClose} aria-label="Close copilot">Close</button></header>
      <div className="copilot-messages" aria-live="polite">
        {history.length === 0 && <div className="copilot-welcome"><strong>What would you like to improve?</strong><p>Suggestions are based on your resume and should be checked for accuracy.</p></div>}
        {history.map((item, index) => <article className="copilot-response" key={`${index}-${item.message}`}>
          <p>{item.message}</p>
          {item.patches.map((patch, patchIndex) => <div className="copilot-patch" key={`${patchIndex}-${patch.suggested_text}`}><p>{patch.suggested_text}</p><small>{patch.rationale}</small><button type="button" className="button button-secondary" disabled={applying} onClick={() => {
            setApplying(true)
            setError('')
            void onApplyPatch(patch).then((applied) => {
              if (!applied) setError('This suggestion could not be matched to a resume line. Nothing was changed.')
            }).catch((cause: unknown) => {
              setError(cause instanceof Error ? cause.message : 'Unable to apply this suggestion.')
            }).finally(() => setApplying(false))
          }}>{applying ? 'Applying…' : 'Apply as draft'}</button></div>)}
        </article>)}
        {loading && <p className="dashboard-skeleton" role="status">Copilot is reviewing your resume…</p>}
        {error && <p className="notice notice-error" role="alert">{error}</p>}
      </div>
      <div className="copilot-prompts">{suggestions.map((suggestion) => <button type="button" key={suggestion} disabled={loading} onClick={() => void submit(undefined, suggestion)}>{suggestion}</button>)}</div>
      <form className="copilot-form" onSubmit={(event) => void submit(event)}><label className="sr-only" htmlFor="copilot-message">Message the resume copilot</label><textarea id="copilot-message" value={message} maxLength={4000} onChange={(event) => setMessage(event.target.value)} placeholder="Ask about your resume…" /><button className="button button-primary" disabled={loading || !message.trim()}>Send</button></form>
    </aside>
  </div>
}
