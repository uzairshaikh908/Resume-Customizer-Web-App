import { useRef, useState } from 'react'
import { downloadDocument, generateCoverLetter } from '../api.js'

const LIMITS = {
  maxFileSize: 5 * 1024 * 1024,
  minJobDescription: 50,
  maxJobDescription: 15000,
}

const SECTIONS = [
  { id: 'summary', label: 'Summary' },
  { id: 'skills', label: 'Skills' },
  { id: 'experience', label: 'Experience' },
  { id: 'projects', label: 'Projects' },
]

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function diffWords(before, after) {
  const a = tokenize(before)
  const b = tokenize(after)

  const lengths = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  )
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] =
        a[i] === b[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1])
    }
  }

  const parts = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(parts, 'same', a[i++])
      j++
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      push(parts, 'removed', a[i++])
    } else {
      push(parts, 'added', b[j++])
    }
  }
  while (i < a.length) push(parts, 'removed', a[i++])
  while (j < b.length) push(parts, 'added', b[j++])
  return parts
}

function tokenize(text) {
  return (text || '').split(/(\s+|[.,;:!?()"])/).filter(Boolean)
}

function push(parts, type, text) {
  const last = parts[parts.length - 1]
  if (last && last.type === type) last.text += text
  else parts.push({ type, text })
}

function changeType(original, customized) {
  if (!original && customized) return 'added'
  if (original && !customized) return 'removed'
  return original === customized ? 'unchanged' : 'modified'
}

function diffLists(before, after) {
  const key = (item) => item.trim().toLowerCase()
  const beforeKeys = new Set(before.map(key))
  const afterKeys = new Set(after.map(key))
  return {
    kept: after.filter((item) => beforeKeys.has(key(item))),
    added: after.filter((item) => !beforeKeys.has(key(item))),
    removed: before.filter((item) => !afterKeys.has(key(item))),
  }
}

function Section({ title, children }) {
  return (
    <section className="resume-section">
      <h3 className="resume-heading">{title}</h3>
      {children}
    </section>
  )
}

function Entry({ title, subtitle, bullets }) {
  return (
    <div className="mb-3">
      <div className="d-flex flex-wrap justify-content-between gap-1">
        <strong>{title}</strong>
        {subtitle && <span className="text-secondary small">{subtitle}</span>}
      </div>
      {bullets?.length > 0 && (
        <ul className="mb-0 mt-1">
          {bullets.map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ResumePreview({ resume }) {
  const { contact } = resume
  const contactLine = [contact.email, contact.phone, contact.location, ...contact.links]
    .filter(Boolean)
    .join(' · ')

  return (
    <article className="resume-paper" aria-label="Customized resume preview">
      <header className="text-center mb-3">
        <h2 className="h3 fw-bold mb-1">{contact.name || 'Your Name'}</h2>
        {resume.headline && <div className="fw-semibold text-secondary">{resume.headline}</div>}
        {contactLine && <div className="small text-secondary text-break">{contactLine}</div>}
      </header>

      {resume.summary && (
        <Section title="Professional Summary">
          <p className="mb-0">{resume.summary}</p>
        </Section>
      )}

      {resume.skills.length > 0 && (
        <Section title="Skills">
          <p className="mb-0">{resume.skills.join(', ')}</p>
        </Section>
      )}

      {resume.experience.length > 0 && (
        <Section title="Experience">
          {resume.experience.map((job, index) => (
            <Entry
              key={index}
              title={[job.title, job.company].filter(Boolean).join(' — ')}
              subtitle={[job.location, job.dates].filter(Boolean).join(' · ')}
              bullets={job.bullets}
            />
          ))}
        </Section>
      )}

      {resume.projects.length > 0 && (
        <Section title="Projects">
          {resume.projects.map((project, index) => (
            <Entry key={index} title={project.name} bullets={project.bullets} />
          ))}
        </Section>
      )}

      {resume.education.length > 0 && (
        <Section title="Education">
          {resume.education.map((edu, index) => (
            <Entry
              key={index}
              title={[edu.degree, edu.institution].filter(Boolean).join(' — ')}
              subtitle={edu.dates}
              bullets={edu.details ? [edu.details] : []}
            />
          ))}
        </Section>
      )}

      {resume.certifications.length > 0 && (
        <Section title="Certifications">
          <ul className="mb-0">
            {resume.certifications.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Section>
      )}

      {resume.other_sections.map((extra, index) => (
        <Section key={index} title={extra.title}>
          <ul className="mb-0">
            {extra.items.map((item, itemIndex) => (
              <li key={itemIndex}>{item}</li>
            ))}
          </ul>
        </Section>
      ))}
    </article>
  )
}

function DownloadButtons({ onDownload }) {
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState(null)

  const download = async (format) => {
    setBusy(format)
    setMessage(null)
    try {
      const filename = await onDownload(format)
      setMessage({ type: 'success', text: `Downloaded ${filename}` })
    } catch (err) {
      setMessage({ type: 'danger', text: err.message })
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="d-flex flex-wrap align-items-center gap-2">
      {['pdf', 'docx'].map((format) => (
        <button
          key={format}
          type="button"
          className="btn btn-outline-primary"
          onClick={() => download(format)}
          disabled={Boolean(busy)}
        >
          {busy === format ? (
            <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          ) : (
            <i className={`bi ${format === 'pdf' ? 'bi-filetype-pdf' : 'bi-filetype-docx'} me-2`} aria-hidden="true"></i>
          )}
          Download {format.toUpperCase()}
        </button>
      ))}
      {message && (
        <span className={`small text-${message.type}`} role="status">{message.text}</span>
      )}
    </div>
  )
}

export function CoverLetter({ jobDescription, resumeText, resume, company, initial }) {
  const [letter, setLetter] = useState(initial?.cover_letter ?? null)
  const [warnings, setWarnings] = useState(initial?.warnings ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await generateCoverLetter({ jobDescription, resumeText, resume })
      setLetter(data.cover_letter)
      setWarnings(data.warnings)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {!letter && (
        <div className="empty-state">
          <i className="bi bi-envelope-paper fs-2 text-primary" aria-hidden="true"></i>
          <p className="mb-3">
            Generate a cover letter based only on facts from your resume and this job description.
          </p>
        </div>
      )}

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {letter && (
        <>
          {warnings.map((warning) => (
            <div key={warning} className="alert alert-warning small" role="status">{warning}</div>
          ))}
          <article className="resume-paper letter" aria-label="Cover letter preview">
            <p>{letter.greeting}</p>
            {letter.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            <p className="mb-0">{letter.closing}</p>
            {letter.signature && <p className="fw-semibold">{letter.signature}</p>}
          </article>
        </>
      )}

      <div className="d-flex flex-wrap gap-2 mt-3">
        <button type="button" className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
              Writing cover letter...
            </>
          ) : (
            <>
              <i className="bi bi-stars me-2" aria-hidden="true"></i>
              {letter ? 'Regenerate' : 'Generate cover letter'}
            </>
          )}
        </button>
        {letter && (
          <DownloadButtons
            onDownload={(format) =>
              downloadDocument({ kind: 'cover_letter', format, cover_letter: letter, company })
            }
          />
        )}
      </div>
    </div>
  )
}

const BADGES = {
  modified: 'text-bg-warning',
  added: 'text-bg-success',
  removed: 'text-bg-danger',
  unchanged: 'text-bg-light border',
}

function InlineDiff({ original, customized }) {
  const type = changeType(original, customized)

  return (
    <div className="diff-row">
      <span className={`badge ${BADGES[type]} me-2`}>{type}</span>
      {type === 'unchanged' ? (
        <span>{customized}</span>
      ) : (
        diffWords(original, customized).map((part, index) =>
          part.type === 'same' ? (
            <span key={index}>{part.text}</span>
          ) : part.type === 'added' ? (
            <ins key={index} className="diff-added">{part.text}</ins>
          ) : (
            <del key={index} className="diff-removed">{part.text}</del>
          )
        )
      )}
    </div>
  )
}

function SkillsDiff({ original, customized }) {
  const { added, removed } = diffLists(original, customized)
  return (
    <div>
      <div className="mb-2">
        <span className="small text-secondary me-2">New order:</span>
        {customized.map((skill) => (
          <span key={skill} className="badge rounded-pill text-bg-light border me-1 mb-1">{skill}</span>
        ))}
      </div>
      {added.length > 0 && (
        <div className="small">
          Added: {added.map((s) => <ins key={s} className="diff-added me-1">{s}</ins>)}
        </div>
      )}
      {removed.length > 0 && (
        <div className="small">
          Not shown: {removed.map((s) => <del key={s} className="diff-removed me-1">{s}</del>)}
        </div>
      )}
    </div>
  )
}

function EntryDiffs({ entries, label }) {
  return entries.map((entry, index) => (
    <div key={index} className="mb-3">
      <div className="fw-semibold">
        {label(entry)}
      </div>
      {entry.bullets.length ? (
        entry.bullets.map((bullet, bulletIndex) => (
          <InlineDiff key={bulletIndex} original={bullet.original} customized={bullet.customized} />
        ))
      ) : (
        <div className="small text-secondary">No bullet points.</div>
      )}
    </div>
  ))
}

function DiffView({ result }) {
  const [mode, setMode] = useState('changes')
  const { changes } = result
  const customizedText = toPlainText(result.resume)

  const modes = [
    { id: 'changes', label: 'Changes' },
    { id: 'original', label: 'Original' },
    { id: 'customized', label: 'Customized' },
  ]

  return (
    <div>
      <div className="btn-group mb-3" role="group" aria-label="Comparison view">
        {modes.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`btn btn-sm ${mode === item.id ? 'btn-primary' : 'btn-outline-primary'}`}
            aria-pressed={mode === item.id}
            onClick={() => setMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {mode === 'changes' && (
        <div>
          <p className="small text-secondary">
            <ins className="diff-added">Added</ins> and <del className="diff-removed">removed</del>{' '}
            words, compared with your original resume.
          </p>

          <h3 className="h6 fw-bold mt-3">Summary</h3>
          {changes.summary.original || changes.summary.customized ? (
            <InlineDiff original={changes.summary.original} customized={changes.summary.customized} />
          ) : (
            <div className="small text-secondary">No summary.</div>
          )}

          <h3 className="h6 fw-bold mt-4">Skills</h3>
          <SkillsDiff original={changes.skills.original} customized={changes.skills.customized} />

          {changes.experience.length > 0 && (
            <>
              <h3 className="h6 fw-bold mt-4">Experience</h3>
              <EntryDiffs
                entries={changes.experience}
                label={(e) => [e.title, e.company].filter(Boolean).join(' — ')}
              />
            </>
          )}

          {changes.projects.length > 0 && (
            <>
              <h3 className="h6 fw-bold mt-4">Projects</h3>
              <EntryDiffs entries={changes.projects} label={(e) => e.name} />
            </>
          )}
        </div>
      )}

      {mode === 'original' && (
        <pre className="text-view" aria-label="Original resume text">{result.original_text}</pre>
      )}
      {mode === 'customized' && (
        <pre className="text-view" aria-label="Customized resume text">{customizedText}</pre>
      )}
    </div>
  )
}

function toPlainText(resume) {
  const lines = [resume.contact.name, resume.headline]
  if (resume.summary) lines.push('', 'SUMMARY', resume.summary)
  if (resume.skills.length) lines.push('', 'SKILLS', resume.skills.join(', '))
  if (resume.experience.length) {
    lines.push('', 'EXPERIENCE')
    for (const job of resume.experience) {
      lines.push([job.title, job.company, job.dates].filter(Boolean).join(' | '))
      lines.push(...job.bullets.map((b) => `- ${b}`))
    }
  }
  if (resume.projects.length) {
    lines.push('', 'PROJECTS')
    for (const project of resume.projects) {
      lines.push(project.name, ...project.bullets.map((b) => `- ${b}`))
    }
  }
  if (resume.education.length) {
    lines.push('', 'EDUCATION')
    for (const edu of resume.education) {
      lines.push([edu.degree, edu.institution, edu.dates].filter(Boolean).join(' | '))
    }
  }
  return lines.filter((line) => line !== undefined).join('\n').trim()
}

const COMPONENT_LABELS = {
  skills: 'Skills',
  keywords: 'Keywords',
  responsibilities: 'Responsibilities',
}

function scoreClass(score) {
  if (score >= 75) return 'bg-success'
  if (score >= 50) return 'bg-warning'
  return 'bg-danger'
}

function ScoreBar({ label, score }) {
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between small fw-semibold">
        <span>{label}</span>
        <span>{score === null ? 'n/a' : `${score}%`}</span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={label}
        aria-valuenow={score ?? 0}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div className={`progress-bar ${scoreClass(score ?? 0)}`} style={{ width: `${score ?? 0}%` }} />
      </div>
    </div>
  )
}

function Pills({ items, variant, empty }) {
  if (!items.length) return <span className="small text-secondary">{empty}</span>
  return (
    <div className="d-flex flex-wrap gap-1">
      {items.map((item) => (
        <span key={item} className={`badge rounded-pill ${variant}`}>{item}</span>
      ))}
    </div>
  )
}

function ScoreCircle({ score, label }) {
  return (
    <div className="score-circle" style={{ '--score': score }} role="img" aria-label={`${label}: ${score}%`}>
      <span>{score}%</span>
    </div>
  )
}

function MatchScore({ match, skills }) {
  return (
    <div>
      <div className="d-flex flex-column flex-sm-row align-items-center gap-4 mb-4">
        <ScoreCircle score={match.score} label="Estimated match" />
        <div className="flex-grow-1 w-100">
          {match.components.map((component) => (
            <ScoreBar
              key={component.name}
              label={`${COMPONENT_LABELS[component.name]} (${Math.round(component.weight * 100)}%)`}
              score={component.score}
            />
          ))}
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-md-6">
          <h3 className="h6 fw-bold">Job skills found in your resume</h3>
          <Pills items={skills.relevant_supported} variant="text-bg-success" empty="None found." />
        </div>
        <div className="col-12 col-md-6">
          <h3 className="h6 fw-bold">Job skills not evidenced in your resume</h3>
          <Pills items={skills.job_required_missing} variant="text-bg-danger" empty="None — great!" />
        </div>
        <div className="col-12 col-md-6">
          <h3 className="h6 fw-bold">Your verified skills</h3>
          <Pills items={skills.verified_existing} variant="text-bg-light border" empty="No skills section found." />
        </div>
        <div className="col-12 col-md-6">
          <h3 className="h6 fw-bold">Keywords to add only if true</h3>
          <Pills items={skills.suggested_keywords} variant="text-bg-warning" empty="No suggestions." />
        </div>
      </div>

      {match.components.map((component) =>
        component.name === 'responsibilities' && component.matched.length + component.missing.length > 0 ? (
          <div key={component.name} className="mt-4">
            <h3 className="h6 fw-bold">Responsibilities</h3>
            <ul className="list-unstyled small mb-0">
              {component.matched.map((item) => (
                <li key={item} className="mb-1">
                  <i className="bi bi-check-circle-fill text-success me-2" aria-hidden="true"></i>
                  {item}
                  {match.evidence[item] && (
                    <span className="text-secondary"> — “{match.evidence[item]}”</span>
                  )}
                </li>
              ))}
              {component.missing.map((item) => (
                <li key={item} className="mb-1">
                  <i className="bi bi-dash-circle text-danger me-2" aria-hidden="true"></i>
                  {item} <span className="text-secondary">— no evidence found</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null
      )}

      <p className="small text-secondary mt-4 mb-0">
        <i className="bi bi-info-circle me-1" aria-hidden="true"></i>
        {match.method}
      </p>
    </div>
  )
}

function AtsReport({ ats }) {
  return (
    <div>
      <div className="d-flex flex-column flex-sm-row align-items-center gap-4 mb-3">
        <ScoreCircle score={ats.score} label="Estimated ATS readiness" />
        <div className="flex-grow-1 w-100">
          <ul className="list-group">
            {ats.checks.map((check) => (
              <li key={check.name} className="list-group-item d-flex justify-content-between align-items-start gap-2">
                <div>
                  <i
                    className={`bi ${check.passed ? 'bi-check-circle-fill text-success' : 'bi-exclamation-circle-fill text-warning'} me-2`}
                    aria-hidden="true"
                  ></i>
                  <span className="fw-semibold">{check.name}</span>
                  <div className="small text-secondary ms-4">{check.detail}</div>
                </div>
                <span className="badge text-bg-light border">{check.weight} pts</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {ats.improvements.length > 0 && (
        <>
          <h3 className="h6 fw-bold mt-4">Suggested improvements</h3>
          <ul className="small">
            {ats.improvements.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </>
      )}

      <p className="small text-secondary mb-0">
        <i className="bi bi-info-circle me-1" aria-hidden="true"></i>
        {ats.method} The downloadable resume uses a simple single-column layout with standard headings.
      </p>
    </div>
  )
}

function CompareTable({ left, right }) {
  const rows = [
    ['Job', (v) => v.label],
    ['Created', (v) => new Date(v.createdAt).toLocaleTimeString()],
    ['Match score', (v) => `${v.result.match.score}%`],
    ['ATS readiness', (v) => `${v.result.ats.score}%`],
    ['Sections customized', (v) => v.result.sections.join(', ')],
    ['Summary', (v) => v.result.resume.summary || '—'],
    ['Skills (in order)', (v) => v.result.resume.skills.join(', ') || '—'],
    ['Missing job skills', (v) => v.result.skills_analysis.job_required_missing.join(', ') || 'None'],
  ]

  return (
    <div className="table-responsive mt-3">
      <table className="table table-sm align-top small mb-0">
        <thead>
          <tr>
            <th scope="col" className="w-25"></th>
            <th scope="col">{left.label}</th>
            <th scope="col">{right.label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row" className="text-secondary fw-semibold">{label}</th>
              <td>{value(left)}</td>
              <td>{value(right)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Versions({ versions, activeId, onSelect, onRemove }) {
  const [compareIds, setCompareIds] = useState([])

  const toggleCompare = (id) => {
    setCompareIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(-2)
    )
  }

  const compared = compareIds.map((id) => versions.find((v) => v.id === id)).filter(Boolean)

  return (
    <section className="card input-card" aria-labelledby="versionsTitle">
      <div className="card-body p-3 p-md-4">
        <h2 id="versionsTitle" className="h6 fw-bold mb-1">
          <i className="bi bi-collection me-2" aria-hidden="true"></i>
          Saved versions ({versions.length})
        </h2>
        <p className="small text-secondary mb-3">
          Saved to your account in this browser. Tick two to compare.
        </p>

        <ul className="list-group">
          {versions.map((version) => (
            <li
              key={version.id}
              className={`list-group-item d-flex align-items-center gap-2 ${version.id === activeId ? 'active-version' : ''}`}
            >
              <input
                className="form-check-input flex-shrink-0 mt-0"
                type="checkbox"
                aria-label={`Compare ${version.label}`}
                checked={compareIds.includes(version.id)}
                onChange={() => toggleCompare(version.id)}
              />
              <button
                type="button"
                className="btn btn-link text-start text-decoration-none p-0 flex-grow-1 text-truncate"
                onClick={() => onSelect(version.id)}
                aria-current={version.id === activeId}
              >
                <span className="fw-semibold">{version.label}</span>
                <span className="d-block small text-secondary">
                  Match {version.result.match.score}% · {new Date(version.createdAt).toLocaleTimeString()}
                </span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => {
                  setCompareIds((ids) => ids.filter((id) => id !== version.id))
                  onRemove(version.id)
                }}
                aria-label={`Delete ${version.label}`}
              >
                <i className="bi bi-trash" aria-hidden="true"></i>
              </button>
            </li>
          ))}
        </ul>

        {compared.length === 2 && <CompareTable left={compared[0]} right={compared[1]} />}
      </div>
    </section>
  )
}

const TABS = [
  { id: 'resume', label: 'Resume', icon: 'bi-file-earmark-text' },
  { id: 'changes', label: 'Changes', icon: 'bi-file-diff' },
  { id: 'match', label: 'Match score', icon: 'bi-bullseye' },
  { id: 'ats', label: 'ATS check', icon: 'bi-list-check' },
  { id: 'letter', label: 'Cover letter', icon: 'bi-envelope-paper' },
]

export function ResultView({ version }) {
  const [tab, setTab] = useState('resume')
  const { result } = version

  return (
    <section className="card input-card" aria-labelledby="resultTitle">
      <div className="card-body p-3 p-md-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div className="text-break">
            <h2 id="resultTitle" className="h4 fw-bold mb-1">
              <i className="bi bi-stars text-primary me-2" aria-hidden="true"></i>
              {version.label}
            </h2>
            <div className="small text-secondary">
              Based on {result.filename}
              {result.source === 'scanned_pdf' && ' · Scanned document'}
              {' · '}Tailored: {result.sections.map((s) => s[0].toUpperCase() + s.slice(1)).join(', ')}
            </div>
          </div>
          <div className="d-flex gap-2">
            <span className="badge text-bg-primary fs-6">Match {result.match.score}%</span>
            <span className="badge text-bg-secondary fs-6">ATS {result.ats.score}%</span>
          </div>
        </div>

        {result.warnings.length > 0 && (
          <div className="alert alert-warning small" role="status">
            <div className="fw-semibold mb-1">
              <i className="bi bi-shield-exclamation me-1" aria-hidden="true"></i>
              Accuracy checks adjusted the AI output:
            </div>
            <ul className="mb-0">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <ul className="nav nav-pills result-tabs mb-3" role="tablist">
          {TABS.map((item) => (
            <li className="nav-item" key={item.id} role="presentation">
              <button
                type="button"
                role="tab"
                id={`tab-${item.id}`}
                aria-controls={`panel-${item.id}`}
                aria-selected={tab === item.id}
                className={`nav-link ${tab === item.id ? 'active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                <i className={`bi ${item.icon} me-1`} aria-hidden="true"></i>
                {item.label}
              </button>
            </li>
          ))}
        </ul>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'resume' && (
            <>
              <div className="mb-3">
                <DownloadButtons
                  onDownload={(format) =>
                    downloadDocument({
                      kind: 'resume',
                      format,
                      resume: result.resume,
                      company: result.company,
                    })
                  }
                />
              </div>
              <ResumePreview resume={result.resume} />
            </>
          )}
          {tab === 'changes' && <DiffView result={result} />}
          {tab === 'match' && <MatchScore match={result.match} skills={result.skills_analysis} />}
          {tab === 'ats' && <AtsReport ats={result.ats} />}
          {tab === 'letter' && (
            <CoverLetter
              key={version.id}
              jobDescription={version.jobDescription}
              resumeText={result.original_text}
              company={result.company}
              initial={version.coverLetter}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function validateFile(file) {
  if (!/\.(pdf|docx)$/i.test(file.name)) return 'Please upload a PDF or DOCX file.'
  if (file.size === 0) return 'The selected file is empty.'
  if (file.size > LIMITS.maxFileSize) return 'File size must be less than 5 MB.'
  return ''
}

function validateInputs({ jobDescription, resume, sections }) {
  const length = jobDescription.trim().length
  if (!length) return 'Please enter a job description.'
  if (length < LIMITS.minJobDescription) {
    return `Please enter a job description with at least ${LIMITS.minJobDescription} characters.`
  }
  if (length > LIMITS.maxJobDescription) {
    return `The job description is too long (maximum ${LIMITS.maxJobDescription.toLocaleString()} characters).`
  }
  if (!resume) return 'Please upload your resume.'
  if (sections && !sections.length) return 'Please select at least one section to customize.'
  return ''
}

export function UploadForm({ busy, progress, onCustomize, onCoverLetter, onCancel }) {
  const [jobDescription, setJobDescription] = useState('')
  const [resume, setResume] = useState(null)
  const [sections, setSections] = useState(SECTIONS.map((s) => s.id))
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef(null)

  const length = jobDescription.trim().length

  const selectFile = (file) => {
    if (!file) return
    const problem = validateFile(file)
    setError(problem)
    setResume(problem ? null : file)
    if (problem && fileInput.current) fileInput.current.value = ''
  }

  const removeFile = () => {
    setResume(null)
    setError('')
    if (fileInput.current) fileInput.current.value = ''
  }

  const toggleSection = (id) => {
    setSections((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current, id]
    )
  }

  const submit = (action) => (event) => {
    event.preventDefault()
    const inputs = { jobDescription: jobDescription.trim(), resume, sections }
    const problem = validateInputs(action === 'letter' ? { ...inputs, sections: null } : inputs)
    setError(problem)
    if (problem) return
    if (action === 'letter') onCoverLetter(inputs)
    else onCustomize(inputs)
  }

  return (
    <form onSubmit={submit('customize')} noValidate>
      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="card input-card h-100">
            <div className="card-body p-4">
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="section-icon" aria-hidden="true">
                  <i className="bi bi-briefcase"></i>
                </div>
                <div>
                  <h2 className="h5 fw-bold mb-0">Job description</h2>
                  <p className="text-secondary small mb-0">Paste the role you're applying for.</p>
                </div>
              </div>

              <label htmlFor="jobDescription" className="form-label">Job details</label>
              <textarea
                id="jobDescription"
                className="form-control custom-input"
                rows="9"
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Paste the full job description here..."
                aria-describedby="jobDescriptionHelp"
                disabled={busy}
              />
              <div
                id="jobDescriptionHelp"
                className={`form-text ${length > LIMITS.maxJobDescription ? 'text-danger' : ''}`}
              >
                {length.toLocaleString()} / {LIMITS.maxJobDescription.toLocaleString()} characters
                {length < LIMITS.minJobDescription && ` (minimum ${LIMITS.minJobDescription})`}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card input-card h-100">
            <div className="card-body p-4">
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="section-icon" aria-hidden="true">
                  <i className="bi bi-file-earmark-person"></i>
                </div>
                <div>
                  <h2 className="h5 fw-bold mb-0">Your resume</h2>
                  <p className="text-secondary small mb-0">PDF or DOCX, up to 5 MB.</p>
                </div>
              </div>

              <label htmlFor="resumeFile" className="form-label">Resume file</label>
              <label
                htmlFor="resumeFile"
                className={`upload-area ${dragging ? 'dragging' : ''} ${resume ? 'has-file' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragging(false)
                  if (!busy) selectFile(event.dataTransfer.files?.[0])
                }}
              >
                <i
                  className={`bi ${resume ? 'bi-file-earmark-check' : 'bi-cloud-arrow-up'} upload-icon`}
                  aria-hidden="true"
                ></i>
                <span className="fw-semibold text-break">
                  {resume ? resume.name : 'Drag & drop or click to choose a file'}
                </span>
                <span className="text-secondary small">
                  {resume ? `${formatBytes(resume.size)} · ready` : 'PDF or DOCX · Maximum 5 MB'}
                </span>
              </label>
              <input
                ref={fileInput}
                id="resumeFile"
                className="visually-hidden"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => selectFile(event.target.files?.[0])}
                disabled={busy}
              />
              {resume && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary mt-3"
                  onClick={removeFile}
                  disabled={busy}
                >
                  <i className="bi bi-x-lg me-1" aria-hidden="true"></i>
                  Remove file
                </button>
              )}

              <fieldset className="mt-4" disabled={busy}>
                <legend className="form-label fs-6 mb-2">Sections to customize</legend>
                <div className="d-flex flex-wrap gap-2">
                  {SECTIONS.map((section) => (
                    <div key={section.id}>
                      <input
                        type="checkbox"
                        className="btn-check"
                        id={`section-${section.id}`}
                        checked={sections.includes(section.id)}
                        onChange={() => toggleSection(section.id)}
                      />
                      <label
                        className="btn btn-sm btn-outline-primary rounded-pill"
                        htmlFor={`section-${section.id}`}
                      >
                        {section.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="form-text">
                  Unselected sections are kept exactly as they are in your resume.
                </div>
              </fieldset>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mt-4 mb-0" role="alert">
          <i className="bi bi-exclamation-triangle me-2" aria-hidden="true"></i>
          {error}
        </div>
      )}

      <div className="text-center mt-4">
        {busy ? (
          <div className="progress-panel mx-auto" role="status" aria-live="polite">
            <div className="d-flex align-items-center justify-content-center gap-2">
              <span className="spinner-border spinner-border-sm text-primary" aria-hidden="true" />
              <span className="fw-semibold">{progress.message}</span>
            </div>
            {progress.characters > 0 && (
              <div className="small text-secondary mt-1">
                Receiving AI output: {progress.characters.toLocaleString()} characters
              </div>
            )}
            <button type="button" className="btn btn-outline-secondary btn-sm mt-3" onClick={onCancel}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="d-flex flex-column flex-sm-row justify-content-center gap-2">
            <button className="btn btn-primary btn-lg px-5" type="submit">
              <i className="bi bi-magic me-2" aria-hidden="true"></i>
              Customize resume
            </button>
            <button
              className="btn btn-outline-primary btn-lg"
              type="button"
              onClick={submit('letter')}
            >
              <i className="bi bi-envelope-paper me-2" aria-hidden="true"></i>
              Cover letter only
            </button>
          </div>
        )}
        <p className="text-secondary small mt-3 mb-0">
          <i className="bi bi-shield-check me-1" aria-hidden="true"></i>
          Your files are processed in memory and not stored. Resume text is analyzed by a
          AI service.
        </p>
      </div>
    </form>
  )
}
