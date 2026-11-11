import { useMemo, useState, type FormEvent } from 'react'
import { verifyProofOfWork } from '../../api/proofOfWork'
import type {
  ParsedResumeData,
  ProofOfWorkResponse,
  ProofProjectClaim,
} from '../../api/types'
import ProofOfWorkBadge from './ProofOfWorkBadge'

export default function ProofOfWorkDashboard({
  parsedData,
}: {
  parsedData?: ParsedResumeData
}) {
  const [githubUrl, setGithubUrl] = useState(parsedData?.contact_info.github_url || '')
  const [leetcodeUrl, setLeetcodeUrl] = useState('')
  const [projects, setProjects] = useState<ProofProjectClaim[]>(
    () => parsedData?.projects.map((project) => ({
      title: project.title || 'Untitled project',
      code_url: project.code_url,
      bullet_points: project.bullet_points,
    })) || [],
  )
  const [result, setResult] = useState<ProofOfWorkResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canVerify = Boolean(
    githubUrl.trim()
    || leetcodeUrl.trim()
    || projects.some((project) => (
      project.code_url?.trim()
      || project.bullet_points.some((bullet) => /https?:\/\/(?:www\.)?(?:github\.com|leetcode\.com)\//i.test(bullet))
    )),
  )
  const maxCommits = useMemo(
    () => Math.max(1, ...(result?.github?.monthly_activity.map((item) => item.commits) || [])),
    [result?.github?.monthly_activity],
  )
  const maxLanguageBytes = useMemo(
    () => Math.max(1, ...Object.values(result?.github?.top_languages || {})),
    [result?.github?.top_languages],
  )

  const updateProject = (
    index: number,
    patch: Partial<ProofProjectClaim>,
  ) => {
    setProjects((current) => current.map((project, itemIndex) => (
      itemIndex === index ? { ...project, ...patch } : project
    )))
  }

  const verify = async (event: FormEvent) => {
    event.preventDefault()
    if (!canVerify) {
      setError('Add a GitHub or LeetCode profile link or a project repository URL.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const verified = await verifyProofOfWork({
        github_url: githubUrl.trim() || null,
        leetcode_url: leetcodeUrl.trim() || null,
        projects: projects.filter((project) => project.title.trim()).map((project) => ({
          ...project,
          title: project.title.trim(),
          code_url: project.code_url?.trim() || null,
        })),
      })
      setResult(verified)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Proof-of-work verification failed.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return <section className="panel proof-dashboard" aria-labelledby="proof-dashboard-title">
    <div className="panel-title">
      <div>
        <span className="eyebrow">PUBLIC EVIDENCE</span>
        <h2 id="proof-dashboard-title">Proof of work</h2>
        <p>Verify project ownership and developer activity against public GitHub and LeetCode data.</p>
      </div>
      {result && <div
        className="proof-score"
        title="Projects: 60%, GitHub activity: 25%, LeetCode solving and contest rating: 15%. Available signals are normalized."
        aria-label={`Proof-of-work score ${result.score} out of 100`}
      >
        <strong>{result.score}</strong><span>/100</span>
      </div>}
    </div>

    <form className="proof-inputs" onSubmit={(event) => void verify(event)}>
      <label>GitHub profile URL
        <input type="url" value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="https://github.com/username" />
      </label>
      <label>LeetCode profile URL
        <input type="url" value={leetcodeUrl} onChange={(event) => setLeetcodeUrl(event.target.value)} placeholder="https://leetcode.com/u/username/" />
      </label>
      <div className="proof-project-inputs">
        <div className="proof-project-inputs-heading">
          <strong>Claimed projects</strong>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setProjects((current) => [...current, {
              title: '',
              code_url: null,
              bullet_points: [],
            }])}
          >Add project</button>
        </div>
        {projects.length === 0 && <p className="muted">No parsed projects yet. Add a project to check its public repository.</p>}
        {projects.map((project, index) => <div className="proof-project-fields" key={`proof-project-${index}`}>
          <label>Project name
            <input
              value={project.title}
              onChange={(event) => updateProject(index, { title: event.target.value })}
              maxLength={200}
              placeholder="Project name"
            />
          </label>
          <label>GitHub repository URL
            <input
              type="url"
              value={project.code_url || ''}
              onChange={(event) => updateProject(index, { code_url: event.target.value || null })}
              placeholder="https://github.com/username/project"
            />
          </label>
        </div>)}
      </div>
      <button className="button button-primary" type="submit" disabled={loading || !canVerify}>
        {loading ? 'Checking public evidence…' : 'Verify public evidence'}
      </button>
    </form>

    {!canVerify && !result && <p className="proof-fallback" role="status">
      Add a GitHub or LeetCode profile link, or a project repository URL, to see verified public evidence here.
    </p>}
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {result && <div className="proof-results">
      <div className="proof-result-summary">
        <ProofOfWorkBadge status={result.status} />
        <p>{result.summary}</p>
      </div>
      {result.github && <section className="proof-metric-card">
        <div className="proof-section-heading">
          <div><h3>GitHub activity</h3><p>{result.github.username ? (result.github.valid ? `@${result.github.username}` : 'Profile not found') : 'Profile link not provided'}</p></div>
          <span>{result.github.recent_commits} commits · {result.github.stars} stars</span>
        </div>
        {(result.github.valid || result.github.recent_commits > 0 || Object.keys(result.github.top_languages).length > 0) && <>
          <p className="proof-chart-caption">Monthly commits across linked public project repositories.</p>
          <div className="proof-chart" aria-label="Monthly GitHub commits">
            {result.github.monthly_activity.map((item) => <div className="proof-chart-column" key={item.month} title={`${item.month}: ${item.commits} commits`}>
              <span className="proof-chart-bar" style={{ height: `${Math.max(3, (item.commits / maxCommits) * 100)}%` }} />
              <small>{item.month.slice(5)}</small>
            </div>)}
          </div>
          {result.github.history_truncated && <p className="muted">Commit history is capped at 500 commits per project.</p>}
          <div className="proof-language-list">
            <strong>Top languages</strong>
            {Object.entries(result.github.top_languages).length === 0
              ? <p className="muted">No language data returned.</p>
              : Object.entries(result.github.top_languages).map(([language, bytes]) => <div className="proof-language" key={language}>
                <span>{language}</span><div className="progress-track"><span style={{ width: `${(bytes / maxLanguageBytes) * 100}%` }} /></div>
              </div>)}
          </div>
        </>}
      </section>}
      {result.leetcode && <section className="proof-metric-card">
        <div className="proof-section-heading"><div><h3>LeetCode</h3><p>{result.leetcode.valid ? `@${result.leetcode.username}` : 'Profile not found'}</p></div>
          {result.leetcode.valid && result.leetcode.contest_rating !== null && <span>Rating {Math.round(result.leetcode.contest_rating)}</span>}
        </div>
        {result.leetcode.valid && <div className="leetcode-stats">
          <div><strong>{result.leetcode.easy_solved}</strong><span>Easy</span></div>
          <div><strong>{result.leetcode.medium_solved}</strong><span>Medium</span></div>
          <div><strong>{result.leetcode.hard_solved}</strong><span>Hard</span></div>
          <div><strong>{result.leetcode.global_ranking?.toLocaleString() || '—'}</strong><span>Global rank</span></div>
          <div><strong>{result.leetcode.contests_attended}</strong><span>Contests</span></div>
        </div>}
      </section>}
      <section className="proof-project-results">
        <div className="proof-section-heading"><div><h3>Project verification</h3><p>Ownership, repository health, and recent public commits.</p></div></div>
        {result.projects.length === 0
          ? <p className="muted">No project repository claims were provided.</p>
          : result.projects.map((project, index) => <article className="proof-project-result" key={`${project.title}-${index}`}>
            <div className="proof-project-result-heading"><strong>{project.title}</strong><ProofOfWorkBadge status={project.status} /></div>
            {project.repository_url && <a href={project.repository_url} target="_blank" rel="noreferrer">{project.repository_url}</a>}
            <div className="proof-project-facts"><span>{project.commits_last_12_months} commits in 12 months</span><span>{project.stars} stars</span>{project.repository_owner && <span>Owner: {project.repository_owner}</span>}</div>
            {project.reasons.map((reason) => <p className="muted" key={reason}>{reason}</p>)}
          </article>)}
      </section>
    </div>}
  </section>
}
