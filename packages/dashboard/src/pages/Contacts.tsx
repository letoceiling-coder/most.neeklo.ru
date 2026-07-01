import { useEffect, useState } from 'react';
import { api, type ContactRow } from '../api.js';

const EXCLUDE_TAG = 'exclude';

export function ContactsPage(): JSX.Element {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState('');

  const load = async (): Promise<void> => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (tag) params.tag = tag;
      const { contacts: rows } = await api.contacts(params);
      setContacts(rows);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tag]);

  const addTag = async (id: string): Promise<void> => {
    const t = prompt('Новый тег');
    if (!t) return;
    await api.addTag(id, t);
    await load();
  };

  const removeTag = async (id: string, t: string): Promise<void> => {
    await api.removeTag(id, t);
    await load();
  };

  const toggleExclude = async (c: ContactRow): Promise<void> => {
    const excluded = !c.tags.includes(EXCLUDE_TAG);
    await api.setContactExcluded(c.contactId, excluded);
    await load();
  };

  return (
    <div>
      <h1 className="page-title">Контакты</h1>
      <p className="muted">
        Отправители объединяются автоматически (по телефону, username). Тег{' '}
        <code>exclude</code> — не сохранять новые сообщения от этого контакта (см. также «Настройки →
        Исключения»).
      </p>
      <div className="card">
        <div className="row">
          <input
            placeholder="Поиск (имя, телефон, username)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input placeholder="Фильтр по тегу" value={tag} onChange={(e) => setTag(e.target.value)} />
          <button type="button" className="secondary" onClick={() => void load()}>
            Обновить
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {contacts.map((c) => {
        const excluded = c.tags.includes(EXCLUDE_TAG);
        return (
          <div className="card" key={c.contactId}>
            <div className="row spread">
              <div className="row">
                <strong>{c.displayName}</strong>
                {excluded && <span className="pill offline">исключён</span>}
              </div>
              <div className="row">
                <button type="button" className="secondary" onClick={() => void toggleExclude(c)}>
                  {excluded ? 'Включить в парсинг' : 'Исключить из парсинга'}
                </button>
                <button type="button" className="secondary" onClick={() => void addTag(c.contactId)}>
                  + тег
                </button>
              </div>
            </div>
            <div style={{ margin: '8px 0' }}>
              {c.tags.map((t) => (
                <span className="tag" key={t}>
                  {t}
                  {t !== EXCLUDE_TAG && (
                    <span className="x" onClick={() => void removeTag(c.contactId, t)}>
                      ×
                    </span>
                  )}
                </span>
              ))}
            </div>
            <div className="muted">
              {c.identities.map((i, idx) => (
                <div key={idx}>
                  <span className="pill src">{i.source}</span> {i.name ?? ''}{' '}
                  {i.username ? `@${i.username}` : ''} {i.phone ?? ''}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {contacts.length === 0 && <p className="muted">Контактов пока нет.</p>}
    </div>
  );
}
