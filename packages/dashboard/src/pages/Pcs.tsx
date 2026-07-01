import { useEffect, useState } from 'react';
import { api, type PcRow } from '../api.js';
import { PcSetupGuide, UserWelcome, type PcSetupData } from '../components/PcSetupGuide.js';

export function PcsPage(): JSX.Element {
  const [pcs, setPcs] = useState<PcRow[]>([]);
  const [error, setError] = useState('');
  const [setup, setSetup] = useState<PcSetupData | null>(null);
  const [setupPcName, setSetupPcName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [pcName, setPcName] = useState('');
  const [busy, setBusy] = useState(false);

  const hasPc = pcs.length >= 1;

  const load = async (): Promise<void> => {
    try {
      const { pcs: rows } = await api.pcs();
      setPcs(rows);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, []);

  const addPc = async (): Promise<void> => {
    const name = pcName.trim();
    if (!name) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.createPc(name);
      setSetup({
        pcId: res.pcId,
        token: res.token,
        agentJson: res.agentJson,
        publicUrl: res.publicUrl,
      });
      setSetupPcName(name);
      setShowModal(false);
      setPcName('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const showInstructions = async (id: string, name: string): Promise<void> => {
    setError('');
    try {
      const res = await api.pcCredentials(id);
      setSetup({
        pcId: res.pcId,
        token: res.token,
        agentJson: res.agentJson,
        publicUrl: res.publicUrl,
      });
      setSetupPcName(name);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const removePc = async (id: string): Promise<void> => {
    if (
      !confirm(
        'Удалить привязку ПК? Агент на компьютере перестанет работать. Можно будет создать новый ПК.',
      )
    ) {
      return;
    }
    await api.deletePc(id);
    setSetup(null);
    await load();
  };

  return (
    <div>
      <div className="row spread">
        <h1 className="page-title">Мой ПК</h1>
        {!hasPc && (
          <button type="button" onClick={() => setShowModal(true)}>
            + Подключить ПК
          </button>
        )}
      </div>
      <p className="muted">
        Один аккаунт — <strong>один личный кабинет — один ПК</strong>. Здесь вы связываете свой
        компьютер с кабинетом по инструкции. Создавать других пользователей может только
        администратор.
      </p>
      {error && <div className="error">{error}</div>}

      {!hasPc && !setup && <UserWelcome />}

      {hasPc && !setup && (
        <p className="muted warn-note">
          У вашего аккаунта уже есть ПК. Второй добавить нельзя. Нажмите «Инструкция», чтобы
          снова открыть настройку agent.json.
        </p>
      )}

      {setup && (
        <PcSetupGuide setup={setup} pcName={setupPcName} onClose={() => setSetup(null)} />
      )}

      {pcs.map((pc) => (
        <div className="card" key={pc.id}>
          <div className="row spread">
            <div className="row">
              <strong>{pc.name}</strong>
              <span className="muted">{pc.id}</span>
              <span className={`pill ${pc.online ? 'online' : 'offline'}`}>
                {pc.online ? 'онлайн' : 'оффлайн'}
              </span>
              {pc.agent_version && <span className="muted">v{pc.agent_version}</span>}
            </div>
            <div className="row">
              <button
                type="button"
                className="secondary"
                onClick={() => void showInstructions(pc.id, pc.name)}
              >
                Инструкция
              </button>
              <button type="button" className="danger" onClick={() => void removePc(pc.id)}>
                Отвязать ПК
              </button>
            </div>
          </div>
          {!pc.online && (
            <p className="muted" style={{ marginTop: 8 }}>
              ПК не подключён. Откройте «Инструкция» и выполните шаги на своём компьютере.
            </p>
          )}
          <div style={{ marginTop: 8 }}>
            {pc.accounts.length === 0 && pc.online && (
              <span className="muted">Ожидание данных по мессенджерам…</span>
            )}
            {pc.accounts.length === 0 && !pc.online && (
              <span className="muted">Агент ещё не запущен на ПК.</span>
            )}
            {pc.accounts.map((a) => (
              <span className="tag" key={a.source + a.account_id}>
                <span className="pill src">{a.source}</span> {a.status}
              </span>
            ))}
          </div>
        </div>
      ))}

      {showModal && (
        <div className="modal-backdrop" onClick={() => !busy && setShowModal(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px' }}>Подключить ваш ПК</h3>
            <p className="muted">
              У аккаунта может быть только один ПК. Задайте название (например «Рабочий») — далее
              появится инструкция для установки агента на этом компьютере.
            </p>
            <label className="muted">Название ПК</label>
            <input
              autoFocus
              value={pcName}
              onChange={(e) => setPcName(e.target.value)}
              placeholder="Например: neeklo"
              onKeyDown={(e) => e.key === 'Enter' && void addPc()}
            />
            <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setShowModal(false)}
              >
                Отмена
              </button>
              <button type="button" disabled={busy || !pcName.trim()} onClick={() => void addPc()}>
                {busy ? 'Создание…' : 'Создать и показать инструкцию'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
