import { useEffect, useState } from 'react';
import { api, type WebhookRow } from '../api.js';

export function WebhooksPage(): JSX.Element {
  const [hooks, setHooks] = useState<WebhookRow[]>([]);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const load = async (): Promise<void> => {
    try {
      const { webhooks } = await api.webhooks();
      setHooks(webhooks);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (): Promise<void> => {
    if (!url) return;
    await api.createWebhook(url, name);
    setUrl('');
    setName('');
    await load();
  };

  return (
    <div>
      <h1 className="page-title">Вебхуки</h1>
      <p className="muted">
        Каждое входящее сообщение (event <code>message.in</code>) отправляется POST-запросом с
        подписью <code>X-Most-Signature: sha256=HMAC(secret, body)</code> и ретраями.
      </p>
      <div className="card">
        <div className="row">
          <input placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            placeholder="https://ваш-сервис/webhook"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ minWidth: 320 }}
          />
          <button onClick={() => void create()}>Добавить</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {hooks.map((h) => (
        <div className="card" key={h.id}>
          <div className="row spread">
            <div>
              <strong>{h.name || h.url}</strong>
              <div className="muted">{h.url}</div>
            </div>
            <div className="row">
              <span className={`pill ${h.enabled ? 'online' : 'offline'}`}>
                {h.enabled ? 'вкл' : 'выкл'}
              </span>
              <button className="secondary" onClick={() => void api.testWebhook(h.id)}>
                Тест
              </button>
              <button
                className="secondary"
                onClick={async () => {
                  await api.toggleWebhook(h.id, !h.enabled);
                  await load();
                }}
              >
                {h.enabled ? 'Выключить' : 'Включить'}
              </button>
              <button
                className="danger"
                onClick={async () => {
                  await api.deleteWebhook(h.id);
                  await load();
                }}
              >
                Удалить
              </button>
            </div>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            secret: <span className="code">{h.secret}</span>
          </div>
        </div>
      ))}
      {hooks.length === 0 && <p className="muted">Вебхуков пока нет.</p>}
    </div>
  );
}
