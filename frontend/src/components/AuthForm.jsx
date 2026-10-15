import { useState } from 'react'
import { login } from '../storage.js'

export function AuthForm({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      onLogin(await login(username, password))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <section className="card input-card auth-card w-100" aria-labelledby="authTitle">
      <div className="card-body p-4 p-sm-5">
        <div className="text-center mb-4">
          <span className="brand-icon auth-icon" aria-hidden="true">
            <i className="bi bi-stars"></i>
          </span>
          <h1 id="authTitle" className="h3 fw-bold mt-3 mb-1">Welcome to ResumeAI</h1>
          <p className="text-secondary small mb-0">Log in to tailor your resume and keep every version.</p>
        </div>

        <form onSubmit={submit} noValidate>
          <label htmlFor="authUsername" className="form-label small fw-semibold">Username</label>
          <div className="input-group mb-3">
            <span className="input-group-text auth-addon" aria-hidden="true">
              <i className="bi bi-person"></i>
            </span>
            <input
              id="authUsername"
              className="form-control auth-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. daksh"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus={window.matchMedia('(pointer: fine)').matches}
              disabled={busy}
              required
            />
          </div>

          <label htmlFor="authPassword" className="form-label small fw-semibold">Password</label>
          <div className="input-group">
            <span className="input-group-text auth-addon" aria-hidden="true">
              <i className="bi bi-lock"></i>
            </span>
            <input
              id="authPassword"
              type={showPassword ? 'text' : 'password'}
              className="form-control auth-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              autoComplete="current-password"
              disabled={busy}
              required
            />
            <button
              type="button"
              className="btn auth-addon auth-toggle"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true"></i>
            </button>
          </div>

          {error && (
            <div className="alert alert-danger small mt-3 mb-0 py-2" role="alert">
              <i className="bi bi-exclamation-triangle me-2" aria-hidden="true"></i>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg w-100 mt-4 auth-submit" disabled={busy}>
            {busy ? (
              <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
            ) : (
              <i className="bi bi-box-arrow-in-right me-2" aria-hidden="true"></i>
            )}
            Log in
          </button>
        </form>
      </div>
    </section>
  )
}
