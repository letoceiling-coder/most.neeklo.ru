import { useEffect, useMemo, useState } from 'react';
import { api, type UserRow } from '../api.js';

interface Handoff {
  email: string;
  password: string;
  displayName: string;
}

function buildHandoffText(h: Handoff): string {
  return `Most — ваш личный кабинет

Ссылка: https://most.neeklo.ru
Email (логин): ${h.email}
Пароль: ${h.password}
Имя: ${h.displayName}

Важно:
• Один аккаунт = один кабинет = один ПК (только ваш, изолирован от других)
• Создавать пользователей можете только вы (администратор)

Клиенту:
1. Войти на https://most.neeklo.ru по email и паролю
2. Раздел «Мой ПК» → «+ Подключить ПК» (один раз)
3. Выполнить инструкцию на своём компьютере (agent.json)
4. Статус «онлайн» — готово

Документация: https://most.neeklo.ru/#docs`;
}

function isManaged(u: UserRow): boolean {
  return !u.protected;
}

function ToggleSwitch(props: {
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
}): JSX.Element {
  const { checked, disabled, onChange, label } = props;
  return (
    <label className={`toggle-switch${disabled ? ' is-disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true" />
      {label !== undefined && <span className="toggle-label">{label}</span>}
    </label>
  );
}

export function UsersPage(): JSX.Element {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const managedUsers = useMemo(() => users.filter(isManaged), [users]);
  const allManagedSelected =
    managedUsers.length > 0 && managedUsers.every((u) => selected.has(u.id));

  const load = async (): Promise<void> => {
    try {
      const { users: list } = await api.users();
      setUsers(list);
      setSelected((prev) => {
        const ids = new Set(list.filter(isManaged).map((u) => u.id));
        return new Set([...prev].filter((id) => ids.has(id)));
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (): Promise<void> => {
    setError('');
    const pwd = password;
    try {
      await api.createUser({ email, password: pwd, displayName });
      setHandoff({ email, password: pwd, displayName });
      setEmail('');
      setDisplayName('');
      setPassword('');
      setSaved('Пользователь создан');
      setTimeout(() => setSaved(''), 2500);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleSelected = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (): void => {
    if (allManagedSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(managedUsers.map((u) => u.id)));
  };

  const setEnabled = async (u: UserRow, enabled: boolean): Promise<void> => {
    if (!isManaged(u) || u.enabled === enabled) return;
    setError('');
    try {
      await api.updateUser(u.id, { enabled });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteOne = async (u: UserRow): Promise<void> => {
    if (!isManaged(u)) return;
    if (!window.confirm(`Удалить пользователя ${u.email}? Его ПК, контакты и сообщения будут удалены.`)) {
      return;
    }
    setError('');
    try {
      await api.deleteUser(u.id);
      setSaved('Пользователь удалён');
      setTimeout(() => setSaved(''), 2500);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const bulkAction = async (action: 'enable' | 'disable' | 'delete'): Promise<void> => {
    const targets = users.filter((u) => selected.has(u.id) && isManaged(u));
    if (!targets.length) return;

    if (action === 'delete') {
      if (
        !window.confirm(
          `Удалить ${targets.length} пользовател(я/ей)? Данные будут удалены без восстановления.`,
        )
      ) {
        return;
      }
    }

    setError('');
    setBusy(true);
    try {
      for (const u of targets) {
        if (action === 'delete') await api.deleteUser(u.id);
        else await api.updateUser(u.id, { enabled: action === 'enable' });
      }
      setSelected(new Set());
      setSaved(
        action === 'delete'
          ? 'Выбранные пользователи удалены'
          : action === 'enable'
            ? 'Выбранные пользователи включены'
            : 'Выбранные пользователи отключены',
      );
      setTimeout(() => setSaved(''), 2500);
      await load();
    } catch (err) {
      setError((err as Error).message);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (u: UserRow): Promise<void> => {
    const next = window.prompt(`Новый пароль для ${u.email}:`);
    if (!next) return;
    setError('');
    try {
      await api.updateUser(u.id, { password: next });
      setHandoff({ email: u.email, password: next, displayName: u.displayName });
      setSaved('Пароль обновлён — передайте клиенту');
      setTimeout(() => setSaved(''), 2500);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const copyHandoff = async (): Promise<void> => {
    if (!handoff) return;
    await navigator.clipboard.writeText(buildHandoffText(handoff));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h1 className="page-title">Пользователи</h1>
      <p className="muted">
        Только администратор создаёт аккаунты. У каждого пользователя — свой изолированный кабинет
        и <strong>один ПК</strong>. Передайте email и пароль — клиент сам подключит ПК в разделе
        «Мой ПК».
      </p>
      {error && <div className="error">{error}</div>}
      {saved && (
        <div className="card" style={{ color: 'var(--ok)' }}>
          {saved}
        </div>
      )}

      {handoff && (
        <div className="card setup-guide">
          <div className="row spread">
            <strong>Передайте клиенту</strong>
            <button type="button" className="secondary" onClick={() => setHandoff(null)}>
              Скрыть
            </button>
          </div>
          <pre className="code docs-pre">{buildHandoffText(handoff)}</pre>
          <button type="button" onClick={() => void copyHandoff()}>
            {copied ? 'Скопировано ✓' : 'Копировать инструкцию для клиента'}
          </button>
        </div>
      )}

      <div className="card">
        <h3>Новый пользователь</h3>
        <div className="row" style={{ marginBottom: 10 }}>
          <label>Email (логин)</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
            style={{ minWidth: 260 }}
          />
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          <label>Имя</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Джон Уик"
            style={{ minWidth: 260 }}
          />
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          <label>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ minWidth: 260 }}
          />
        </div>
        <button type="button" onClick={() => void create()}>
          Создать пользователя
        </button>
      </div>

      <div className="card">
        <div className="row spread" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Аккаунты</h3>
          {selected.size > 0 && (
            <div className="row users-bulk">
              <span className="muted">Выбрано: {selected.size}</span>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void bulkAction('enable')}
              >
                Включить
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void bulkAction('disable')}
              >
                Отключить
              </button>
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() => void bulkAction('delete')}
              >
                Удалить
              </button>
            </div>
          )}
        </div>
        <div className="users-table">
          <div className="users-row users-row-head">
            <div className="users-cell users-cell-select">
              <input
                type="checkbox"
                checked={allManagedSelected}
                disabled={managedUsers.length === 0}
                onChange={toggleSelectAll}
                title="Выбрать всех"
              />
            </div>
            <div className="users-cell users-cell-email">Email</div>
            <div className="users-cell users-cell-name">Имя</div>
            <div className="users-cell users-cell-role">Роль</div>
            <div className="users-cell users-cell-active">Активен</div>
            <div className="users-cell users-cell-actions">Действия</div>
          </div>
          {users.map((u) => (
            <div
              key={u.id}
              className={`users-row${u.protected ? ' user-protected' : ''}`}
            >
              <div className="users-cell users-cell-select">
                {isManaged(u) ? (
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggleSelected(u.id)}
                  />
                ) : (
                  <span className="muted users-select-placeholder" title="Защищённый аккаунт">
                    —
                  </span>
                )}
              </div>
              <div className="users-cell users-cell-email" title={u.email}>
                {u.email}
              </div>
              <div className="users-cell users-cell-name" title={u.displayName}>
                {u.displayName}
              </div>
              <div className="users-cell users-cell-role">
                {u.role === 'admin' ? 'Админ' : 'Пользователь'}
              </div>
              <div className="users-cell users-cell-active">
                {isManaged(u) ? (
                  <ToggleSwitch
                    checked={u.enabled}
                    label={u.enabled ? 'ON' : 'OFF'}
                    onChange={(enabled) => void setEnabled(u, enabled)}
                  />
                ) : (
                  <span title="Статус нельзя изменить">
                    <ToggleSwitch
                      checked={u.enabled}
                      disabled
                      label={u.enabled ? 'ON' : 'OFF'}
                    />
                  </span>
                )}
              </div>
              <div className="users-cell users-cell-actions">
                <button type="button" className="secondary" onClick={() => void resetPassword(u)}>
                  Сменить пароль
                </button>
                {isManaged(u) && (
                  <button type="button" className="danger" onClick={() => void deleteOne(u)}>
                    Удалить
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
