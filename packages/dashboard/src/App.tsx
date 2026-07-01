import { useEffect, useState } from 'react';
import { getToken, clearToken, api } from './api.js';
import { Login } from './pages/Login.js';
import { PcsPage } from './pages/Pcs.js';
import { FeedPage } from './pages/Feed.js';
import { ContactsPage } from './pages/Contacts.js';
import { WebhooksPage } from './pages/Webhooks.js';
import { SettingsPage } from './pages/Settings.js';
import { DocsPage } from './pages/Docs.js';
import { UsersPage } from './pages/Users.js';

type View = 'pcs' | 'feed' | 'contacts' | 'webhooks' | 'settings' | 'docs' | 'users';

const NAV: Array<{ id: View; label: string }> = [
  { id: 'feed', label: 'Лента сообщений' },
  { id: 'contacts', label: 'Контакты' },
  { id: 'pcs', label: 'Мой ПК' },
  { id: 'webhooks', label: 'Вебхуки' },
  { id: 'settings', label: 'Настройки' },
  { id: 'docs', label: 'Документация' },
];

function navForRole(role: string | undefined): Array<{ id: View; label: string }> {
  const items = [...NAV];
  if (role === 'admin') {
    items.splice(items.length - 1, 0, { id: 'users', label: 'Пользователи' });
  }
  return items;
}

export function App(): JSX.Element {
  const [authed, setAuthed] = useState<boolean>(Boolean(getToken()));
  const [view, setView] = useState<View>(() =>
    window.location.hash === '#docs' || window.location.hash === '#/docs' ? 'docs' : 'feed',
  );
  const [me, setMe] = useState<{ displayName: string; email: string; role: string } | null>(null);

  useEffect(() => {
    if (!authed) return;
    void api.me().then(({ user }) => setMe(user)).catch(() => setMe(null));
  }, [authed]);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span>◆</span> Most
        </div>
        {me && (
          <div className="muted" style={{ fontSize: 12, marginBottom: 10, padding: '0 8px' }}>
            {me.displayName}
            <br />
            {me.email}
            {me.role === 'admin' && (
              <>
                <br />
                <span className="pill src" style={{ marginTop: 4, display: 'inline-block' }}>
                  Администратор
                </span>
              </>
            )}
          </div>
        )}
        {navForRole(me?.role).map((n) => (
          <div
            key={n.id}
            className={`nav-item ${view === n.id ? 'active' : ''}`}
            onClick={() => setView(n.id)}
          >
            {n.label}
          </div>
        ))}
        <div
          className="nav-item logout"
          onClick={() => {
            clearToken();
            setAuthed(false);
          }}
        >
          Выйти
        </div>
      </aside>
      <main className="content">
        {view === 'feed' && <FeedPage />}
        {view === 'contacts' && <ContactsPage />}
        {view === 'pcs' && <PcsPage />}
        {view === 'webhooks' && <WebhooksPage />}
        {view === 'settings' && <SettingsPage />}
        {view === 'docs' && <DocsPage />}
        {view === 'users' && me?.role === 'admin' && <UsersPage />}
      </main>
    </div>
  );
}
