import { useEffect, useState } from 'react';
import { api, type ExcludedFilters } from '../api.js';

const ALL_SOURCES = ['telegram', 'max', 'vk', 'avito', 'instagram', 'whatsapp'] as const;
const SOURCE_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  max: 'MAX',
  vk: 'VK',
  avito: 'Avito',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
};

export function SettingsPage(): JSX.Element {
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [excludedPhones, setExcludedPhones] = useState('');
  const [excludedUsernames, setExcludedUsernames] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  const load = async (): Promise<void> => {
    try {
      const s = await api.settings();
      setModel(s.openrouter.model);
      setEnabled(s.openrouter.enabled);
      setHasKey(s.openrouter.hasKey);
      setSources(s.sources);
      setExcludedPhones(s.excludedFilters.phones.join('\n'));
      setExcludedUsernames(s.excludedFilters.usernames.join('\n'));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveOpenRouter = async (): Promise<void> => {
    await api.saveOpenRouter({ model, enabled, ...(apiKey ? { apiKey } : {}) });
    setApiKey('');
    setSaved('Настройки OpenRouter сохранены');
    await load();
    setTimeout(() => setSaved(''), 2500);
  };

  const toggleSource = (s: string): void => {
    setSources((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const saveSources = async (): Promise<void> => {
    await api.saveSources(sources);
    setSaved('Список источников сохранён');
    setTimeout(() => setSaved(''), 2500);
  };

  const saveExclusions = async (): Promise<void> => {
    const filters: ExcludedFilters = {
      phones: excludedPhones.split(/\n/).map((s) => s.trim()).filter(Boolean),
      usernames: excludedUsernames.split(/\n/).map((s) => s.trim()).filter(Boolean),
      chats: [],
    };
    await api.saveExclusions(filters);
    setSaved('Исключения сохранены');
    setTimeout(() => setSaved(''), 2500);
  };

  return (
    <div>
      <h1 className="page-title">Настройки</h1>
      {error && <div className="error">{error}</div>}
      {saved && <div className="card" style={{ color: 'var(--ok)' }}>{saved}</div>}

      <div className="card">
        <h3>OpenRouter (обработка сообщений ИИ)</h3>
        <div className="row" style={{ marginBottom: 10 }}>
          <label>Модель</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} style={{ minWidth: 280 }} />
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          <label>API ключ</label>
          <input
            type="password"
            placeholder={hasKey ? '•••••• (сохранён, введите для замены)' : 'sk-or-...'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ minWidth: 280 }}
          />
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />{' '}
            Включить анализ (категория, теги, черновик ответа)
          </label>
        </div>
        <button onClick={() => void saveOpenRouter()}>Сохранить</button>
      </div>

      <div className="card">
        <h3>Источники (мессенджеры)</h3>
        <p className="muted">Какие мессенджеры разрешено отслеживать агентам.</p>
        <div className="row">
          {ALL_SOURCES.map((s) => (
            <label key={s} className="tag">
              <input
                type="checkbox"
                checked={sources.includes(s)}
                onChange={() => toggleSource(s)}
              />{' '}
              {SOURCE_LABELS[s] ?? s}
            </label>
          ))}
        </div>
        <button style={{ marginTop: 10 }} onClick={() => void saveSources()}>
          Сохранить
        </button>
      </div>

      <div className="card">
        <h3>Исключения из парсинга</h3>
        <p className="muted">
          Сообщения от этих телефонов и username не попадут в ленту и вебхуки. Для уже известных
          контактов удобнее кнопка «Исключить» в разделе «Контакты».
        </p>
        <div style={{ marginBottom: 10 }}>
          <label className="muted">Телефоны (по одному на строку, цифры)</label>
          <textarea
            rows={3}
            value={excludedPhones}
            onChange={(e) => setExcludedPhones(e.target.value)}
            placeholder="79991234567"
            style={{ width: '100%', marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="muted">Username (по одному на строку, без @)</label>
          <textarea
            rows={3}
            value={excludedUsernames}
            onChange={(e) => setExcludedUsernames(e.target.value)}
            placeholder="spam_bot"
            style={{ width: '100%', marginTop: 4 }}
          />
        </div>
        <button type="button" onClick={() => void saveExclusions()}>
          Сохранить исключения
        </button>
      </div>
    </div>
  );
}
