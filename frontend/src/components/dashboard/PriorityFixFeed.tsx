import type { PriorityFix } from '../../types/dashboard'

export default function PriorityFixFeed({ fixes, onSelect }: {
  fixes: PriorityFix[]
  onSelect: (lineNumber: number) => void
}) {
  return <section className="panel dashboard-panel" aria-labelledby="priority-fixes-title">
    <div className="panel-title"><div><h2 id="priority-fixes-title">Priority fixes</h2><p>Start with the changes most likely to improve recruiter signal.</p></div></div>
    {fixes.length === 0
      ? <p className="dashboard-empty">No priority fixes detected. Your current resume has no high-priority flags.</p>
      : <div className="dashboard-fix-list">{fixes.slice(0, 3).map((fix) => <article className="dashboard-fix-card" key={fix.id}>
        <div><span className="dashboard-impact">{fix.estimated_impact}</span><h3>{fix.title}</h3><p>{fix.description}</p></div>
        <button type="button" className="button button-secondary" onClick={() => onSelect(fix.line_number)}>Review line {fix.line_number}</button>
      </article>)}</div>}
  </section>
}
