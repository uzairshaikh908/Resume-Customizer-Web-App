import { useEffect, useRef, useState } from 'react'
import { customizeResume, generateCoverLetter } from './api.js'
import { AuthForm } from './components/AuthForm.jsx'
import { CoverLetter, ResultView, UploadForm, Versions } from './components/ResumeComponents.jsx'
import { currentUser, loadHistory, logout, saveHistory } from './storage.js'

function versionLabel(result) {
  const title = result.job_title || 'Tailored resume'
  return result.company ? `${title} at ${result.company}` : title
}

function Brand() {
  return (
    <a className="navbar-brand fw-bold" href="#top">
      <span className="brand-icon" aria-hidden="true">
        <i className="bi bi-stars"></i>
      </span>
      ResumeAI
    </a>
  )
}

function LoginPage({ onLogin }) {
  return (
    <div className="app-shell">
      <nav className="navbar bg-white border-bottom fixed-top" aria-label="Main">
        <div className="container py-2">
          <Brand />
          <span className="badge rounded-pill text-bg-light border">AI Resume Builder</span>
        </div>
      </nav>

      <main className="container auth-page" id="top">
        <AuthForm onLogin={onLogin} />
      </main>
    </div>
  )
}

function ResumeApp({ user, onLogout }) {
  const [versions, setVersions] = useState(() => loadHistory(user))
  const [activeId, setActiveId] = useState(() => versions[0]?.id ?? null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ message: '', characters: 0 })
  const [error, setError] = useState('')
  const [letter, setLetter] = useState(null)
  const abortRef = useRef(null)
  const resultsRef = useRef(null)

  useEffect(() => {
    saveHistory(user, versions)
  }, [user, versions])

  const run = async (initialMessage, task) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setBusy(true)
    setError('')
    setProgress({ message: initialMessage, characters: 0 })
    try {
      await task(controller.signal)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err) {
      setError(err.name === 'AbortError' ? 'Cancelled.' : err.message)
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  const handleCustomize = (inputs) =>
    run('Uploading your resume…', async (signal) => {
      const result = await customizeResume(
        inputs,
        (event) =>
          setProgress((current) => ({
            message: event.message ?? current.message,
            characters: event.characters ?? current.characters,
          })),
        signal
      )
      const version = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        label: versionLabel(result),
        jobDescription: inputs.jobDescription,
        result,
      }
      setVersions((current) => [version, ...current])
      setActiveId(version.id)
      setLetter(null)
    })

  const handleCoverLetter = (inputs) =>
    run('Writing your cover letter…', async (signal) => {
      const data = await generateCoverLetter(inputs, signal)
      setLetter({ ...inputs, data, id: crypto.randomUUID() })
    })

  const removeVersion = (id) => {
    const remaining = versions.filter((v) => v.id !== id)
    setVersions(remaining)
    if (id === activeId) setActiveId(remaining[0]?.id ?? null)
  }

  const active = versions.find((v) => v.id === activeId)

  return (
    <div className="app-shell">
      <nav className="navbar bg-white border-bottom fixed-top" aria-label="Main">
        <div className="container py-2">
          <Brand />
          <div className="d-flex align-items-center gap-2">
            <span className="badge rounded-pill text-bg-light border d-none d-sm-inline">AI Resume Builder</span>
            <span className="small fw-semibold text-truncate">
              <i className="bi bi-person-circle me-1" aria-hidden="true"></i>
              {user}
            </span>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onLogout} disabled={busy}>
              <i className="bi bi-box-arrow-right me-1" aria-hidden="true"></i>
              Log out
            </button>
          </div>
        </div>
      </nav>

      <main className="container py-5" id="top">
        <div className="text-center mb-5">
          <span className="eyebrow">YOUR NEXT CAREER MOVE</span>
          <h1 className="display-5 fw-bold mt-3">
            Your experience.
            <br />
            <span className="text-primary">Perfectly presented.</span>
          </h1>
          <p className="text-secondary mt-3 mx-auto hero-description">
            Tailor your resume to every job with AI — without inventing anything. See your match
            score, every change, and download a clean, ATS-friendly PDF or DOCX.
          </p>
        </div>

        <UploadForm
          busy={busy}
          progress={progress}
          onCustomize={handleCustomize}
          onCoverLetter={handleCoverLetter}
          onCancel={() => abortRef.current?.abort()}
        />

        <div ref={resultsRef} className="pt-4">
          {error && (
            <div className="alert alert-danger" role="alert">
              <i className="bi bi-exclamation-triangle me-2" aria-hidden="true"></i>
              {error}
            </div>
          )}

          {letter && (
            <section className="card input-card mb-4" aria-labelledby="letterTitle">
              <div className="card-body p-3 p-md-4">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                  <h2 id="letterTitle" className="h4 fw-bold mb-0">
                    <i className="bi bi-envelope-paper text-primary me-2" aria-hidden="true"></i>
                    Cover letter
                  </h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close cover letter"
                    onClick={() => setLetter(null)}
                  />
                </div>
                <CoverLetter
                  key={letter.id}
                  jobDescription={letter.jobDescription}
                  resume={letter.resume}
                  initial={letter.data}
                />
              </div>
            </section>
          )}

          {active ? (
            <div className="row g-4">
              <div className="col-12 col-xl-8">
                <ResultView key={active.id} version={active} />
              </div>
              <div className="col-12 col-xl-4">
                <Versions
                  versions={versions}
                  activeId={activeId}
                  onSelect={setActiveId}
                  onRemove={removeVersion}
                />
              </div>
            </div>
          ) : (
            !letter && (
              <div className="empty-state text-secondary">
                <i className="bi bi-file-earmark-richtext fs-2" aria-hidden="true"></i>
                <p className="mb-0">
                  Your tailored resume, match score, ATS check and cover letter will appear here.
                </p>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(currentUser)

  const handleLogout = () => {
    logout()
    setUser(null)
  }

  if (!user) return <LoginPage onLogin={setUser} />
  return <ResumeApp key={user} user={user} onLogout={handleLogout} />
}

export default App
