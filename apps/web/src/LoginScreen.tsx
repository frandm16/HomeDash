import { useState, type FormEvent } from 'react'
import { login, type AuthUser } from './api'
import { Icon } from './Icon'

export default function LoginScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(username, password)
      onAuthenticated(result.user)
    } catch {
      setError('Incorrect username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <form onSubmit={submit} className="login-card">
        <div className="brand-lockup">
          <span className="brand-symbol"><Icon name="grid" size={17}/></span>
          <span>HOMEDASH<small>PRIVATE HOMELAB</small></span>
        </div>
        <p className="kicker">PRIVATE ACCESS</p>
        <h1>Your homelab,<br/>in one place.</h1>
        <p className="subtle">Sign in to open your dashboard.</p>
        <label>Username
          <input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required/>
        </label>
        <label>Password
          <input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required/>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary" disabled={loading}>
          {loading ? 'Checking…' : 'Sign in'}<Icon name="arrow" size={14}/>
        </button>
      </form>
    </main>
  )
}
