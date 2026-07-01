import { useEffect, useState } from 'react';
import { api, type MessageRow } from '../api.js';

const SOURCES = ['', 'telegram', 'max', 'vk', 'avito', 'instagram', 'whatsapp'];

export function FeedPage(): JSX.Element {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyOk, setReplyOk] = useState('');

  const load = async (): Promise<void> => {
    try {
      const params: Record<string, string> = { limit: '100' };
      if (source) params.source = source;
      if (search) params.search = search;
      const { messages: rows } = await api.messages(params);
      setMessages(rows);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, search]);

  const sendReply = async (): Promise<void> => {
    if (!replyTo || !replyText.trim()) return;
    setReplyBusy(true);
    setError('');
    setReplyOk('');
    try {
      await api.replyToMessage(replyTo.id, replyText.trim());
      setReplyOk('Ответ отправлен в мессенджер через ваш ПК');
      setReplyText('');
      setReplyTo(null);
      setTimeout(() => setReplyOk(''), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReplyBusy(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Лента входящих сообщений</h1>
      <p className="muted">
        Сообщения приходят с вашего ПК в реальном времени. Нажмите «Ответить» — текст уйдёт в тот же
        чат через Chrome на ПК (ПК должен быть онлайн).
      </p>
      <div className="card">
        <div className="row">
          <label>Источник</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s || 'все'}
              </option>
            ))}
          </select>
          <input
            placeholder="Поиск по тексту"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="secondary" type="button" onClick={() => void load()}>
            Обновить
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {replyOk && <div className="card" style={{ color: 'var(--ok)' }}>{replyOk}</div>}

      {replyTo && (
        <div className="card">
          <strong>
            Ответ → {replyTo.sender_name ?? replyTo.sender_username ?? 'контакт'} ({replyTo.source})
          </strong>
          <textarea
            rows={3}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Текст ответа"
            style={{ width: '100%', marginTop: 8 }}
          />
          {replyTo.ai?.draftReply && (
            <button
              type="button"
              className="secondary"
              style={{ marginTop: 6 }}
              onClick={() => setReplyText(replyTo.ai?.draftReply ?? '')}
            >
              Вставить черновик ИИ
            </button>
          )}
          <div className="row" style={{ marginTop: 8, gap: 8 }}>
            <button type="button" disabled={replyBusy} onClick={() => void sendReply()}>
              {replyBusy ? 'Отправка…' : 'Отправить'}
            </button>
            <button type="button" className="secondary" onClick={() => setReplyTo(null)}>
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="card">
        {messages.length === 0 && (
          <p className="muted">
            Пока нет сообщений. Подключите ПК и авторизуйте мессенджеры — см. «Мой ПК».
          </p>
        )}
        {messages.map((m) => (
          <div className="msg" key={m.id}>
            <div className="head">
              <span className="pill src">{m.source}</span>
              <strong>{m.sender_name ?? m.sender_username ?? 'неизвестно'}</strong>
              {m.chat_title && <span>· {m.chat_title}</span>}
              <span style={{ marginLeft: 'auto' }}>{new Date(m.ts).toLocaleString()}</span>
            </div>
            <div className="body">{m.text}</div>
            {m.ai && (
              <div className="ai">
                {m.ai.category && <b>[{m.ai.category}] </b>}
                {m.ai.summary}
                {m.ai.tags && m.ai.tags.length > 0 && <> · теги: {m.ai.tags.join(', ')}</>}
                {m.ai.draftReply && <div>↳ черновик: {m.ai.draftReply}</div>}
              </div>
            )}
            {m.direction === 'in' && (
              <button
                type="button"
                className="secondary"
                style={{ marginTop: 8 }}
                onClick={() => {
                  setReplyTo(m);
                  setReplyText(m.ai?.draftReply ?? '');
                }}
              >
                Ответить
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
