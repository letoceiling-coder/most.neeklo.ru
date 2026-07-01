import { useState } from 'react';
import { api, setToken } from '../api.js';
import { DocsPage } from './Docs.js';

export function Login({ onLogin }: { onLogin: () => void }): JSX.Element {
  const [email, setEmail] = useState('admin@most.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDocs, setShowDocs] = useState(
    () => window.location.hash === '#docs' || window.location.hash === '#/docs',
  );

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await api.login(email, password);
      setToken(token);
      onLogin();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (showDocs) {
    return (
      <div className="login-docs">
        <DocsPage
          onBack={() => {
            window.location.hash = '';
            setShowDocs(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <div className="brand">
          <span>◆</span> Most
        </div>
        <p className="muted">Кабинет оператора</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
        />
        <button disabled={busy} type="submit">
          {busy ? 'Вход...' : 'Войти'}
        </button>
        <button
          type="button"
          className="secondary"
          style={{ width: '100%', marginTop: 8 }}
          onClick={() => {
            window.location.hash = 'docs';
            setShowDocs(true);
          }}
        >
          Документация по установке
        </button>
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
}
