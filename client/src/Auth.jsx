import { useState } from 'react';
import { api } from './api.js';

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const path = mode === 'login' ? '/api/login' : '/api/register';
      const d = await api(path, { method: 'POST', body: { username, password } });
      onLogin(d.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>💬 ChatLibre</h1>
        <p className="sub">
          {mode === 'login'
            ? 'Connectez-vous pour discuter'
            : 'Créez votre compte gratuit'}
        </p>
        <form onSubmit={submit}>
          {error && <div className="error-box">{error}</div>}
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nom d'utilisateur"
            aria-label="Nom d'utilisateur"
            autoFocus
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            aria-label="Mot de passe"
          />
          <button className="btn-primary-full" disabled={busy}>
            {busy ? '…' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>
        <p className="auth-toggle">
          {mode === 'login' ? (
            <>
              Pas de compte ?{' '}
              <button
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
              >
                S'inscrire
              </button>
            </>
          ) : (
            <>
              Déjà un compte ?{' '}
              <button
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                Se connecter
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
