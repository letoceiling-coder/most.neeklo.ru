import { useState } from 'react';
import { buildCursorSetupPrompt, type SetupOs } from '../docs/cursorPrompt.js';
import { MOST_GIT_REPO, gitCloneCommand } from '../docs/repo.js';

export interface PcSetupData {
  pcId: string;
  token: string;
  agentJson: Record<string, unknown>;
  publicUrl: string;
}

type Os = SetupOs;

const STEPS: Record<
  Os,
  Array<{ title: string; code?: string; text?: string }>
> = {
  windows: [
    {
      title: 'Скачайте и распакуйте проект Most на ПК',
      text: 'Клонировать репозиторий в C:\\projects\\most.neeklo.ru (см. промпт Cursor).',
    },
    {
      title: 'Установите Node.js 20+ и Google Chrome',
      text: 'https://nodejs.org — при установке отметьте «Add to PATH».',
    },
    {
      title: 'Сборка агента',
      code: `cd C:\\projects\\most.neeklo.ru
npm install
npm run build:shared
npm run build:agent`,
    },
    {
      title: 'Сохраните конфиг agent.json',
      text: 'Скопируйте JSON ниже в файл packages\\agent\\config\\agent.json',
    },
    {
      title: 'Запустите Chrome с профилем Most',
      code: `powershell -ExecutionPolicy Bypass -File deploy\\windows\\start-chrome-debug.ps1
powershell -ExecutionPolicy Bypass -File deploy\\windows\\open-messenger-tabs.ps1`,
      text: 'Один раз войдите во все мессенджеры (Telegram, WhatsApp QR, VK и т.д.). Сессии сохранятся.',
    },
    {
      title: 'Запустите агент',
      code: `powershell -ExecutionPolicy Bypass -File deploy\\windows\\start-agent.ps1`,
    },
    {
      title: 'Автозапуск (рекомендуется)',
      code: `powershell -ExecutionPolicy Bypass -File deploy\\windows\\install-agent-autostart.ps1`,
      text: 'Chrome и агент стартуют незаметно после входа в Windows. Лог: %LOCALAPPDATA%\\Most\\logs\\agent.log',
    },
  ],
  linux: [
    {
      title: 'Проект Most на ПК',
      text: 'Например ~/most.neeklo.ru',
    },
    {
      title: 'Node.js 20+, Chrome/Chromium',
    },
    {
      title: 'Сборка',
      code: `cd ~/most.neeklo.ru
npm install && npm run build:shared && npm run build:agent
cp packages/agent/config/agent.json.example packages/agent/config/agent.json`,
    },
    {
      title: 'agent.json — вставьте JSON ниже',
    },
    {
      title: 'Chrome + мессенджеры',
      code: `chmod +x deploy/linux/*.sh
bash deploy/linux/start-chrome-debug.sh 9222
bash deploy/linux/open-messenger-tabs.sh 9222`,
    },
    {
      title: 'Агент',
      code: `bash deploy/linux/start-agent.sh`,
    },
    {
      title: 'Автозапуск',
      code: `bash deploy/linux/install-autostart.sh ~/most.neeklo.ru`,
    },
  ],
  macos: [
    {
      title: 'Проект Most на ПК',
      text: 'Например ~/most.neeklo.ru',
    },
    {
      title: 'Node.js 20+, Google Chrome',
    },
    {
      title: 'Сборка',
      code: `cd ~/most.neeklo.ru
npm install && npm run build:shared && npm run build:agent
cp packages/agent/config/agent.json.example packages/agent/config/agent.json`,
    },
    {
      title: 'agent.json — вставьте JSON ниже',
    },
    {
      title: 'Chrome + мессенджеры',
      code: `chmod +x deploy/macos/*.sh deploy/linux/*.sh
bash deploy/macos/start-chrome-debug.sh
bash deploy/macos/open-messenger-tabs.sh`,
    },
    {
      title: 'Агент',
      code: `bash deploy/macos/start-agent.sh`,
    },
    {
      title: 'Автозапуск',
      code: `bash deploy/macos/install-autostart.sh ~/most.neeklo.ru`,
    },
  ],
};

function CopyBtn({ text, label }: { text: string; label: string }): JSX.Element {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="secondary"
      style={{ marginTop: 6 }}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        });
      }}
    >
      {ok ? 'Скопировано ✓' : label}
    </button>
  );
}

export function PcSetupGuide({
  setup,
  pcName,
  onClose,
}: {
  setup: PcSetupData;
  pcName?: string;
  onClose?: () => void;
}): JSX.Element {
  const [os, setOs] = useState<Os>('windows');
  const agentText = JSON.stringify(setup.agentJson, null, 2);
  const cursorPrompt = buildCursorSetupPrompt(setup, os);
  const cloneCmd = gitCloneCommand(os === 'windows' ? 'C:\\projects\\most.neeklo.ru' : '~/most.neeklo.ru');

  return (
    <div className="card setup-guide">
      <div className="row spread">
        <div>
          <h3 style={{ margin: 0 }}>
            Инструкция: подключение ПК{pcName ? ` «${pcName}»` : ''}
          </h3>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Выполните шаги на компьютере, где установлены мессенджеры. После запуска агента статус
            станет <span className="pill online">онлайн</span>.
          </p>
        </div>
        {onClose && (
          <button type="button" className="secondary" onClick={onClose}>
            Скрыть
          </button>
        )}
      </div>

      <div className="setup-cursor-prompt">
        <strong>Промпт для Cursor Agent (рекомендуется)</strong>
        <p className="muted" style={{ margin: '8px 0' }}>
          Откройте проект Most в <strong>Cursor</strong> на этом ПК → режим <strong>Agent</strong>{' '}
          → вставьте промпт ниже. В промпте указано <strong>что установить и откуда</strong>{' '}
          (Node.js, Chrome, проект), настроен ваш <code>agent.json</code>, проверка авторизации
          мессенджеров и тесты с сервером.
        </p>
        <div className="row" style={{ marginBottom: 10, gap: 8 }}>
          <span className="muted">ОС на ПК:</span>
          {(['windows', 'linux', 'macos'] as Os[]).map((o) => (
            <button
              key={o}
              type="button"
              className={os === o ? '' : 'secondary'}
              onClick={() => setOs(o)}
            >
              {o === 'windows' ? 'Windows' : o === 'linux' ? 'Linux' : 'macOS'}
            </button>
          ))}
        </div>
        <div className="setup-git-repo">
          <strong>Репозиторий проекта</strong>
          <p className="muted" style={{ margin: '6px 0' }}>
            Скачать код на ПК (в промпте ниже — полная установка):
          </p>
          <code>{MOST_GIT_REPO}</code>
          <pre className="code docs-pre" style={{ marginTop: 8 }}>{cloneCmd}</pre>
          <CopyBtn text={cloneCmd} label="Копировать git clone" />
        </div>
        <pre className="code docs-pre setup-cursor-pre">{cursorPrompt}</pre>
        <CopyBtn text={cursorPrompt} label="Копировать промпт для Cursor" />
      </div>

      <p className="muted" style={{ margin: '16px 0 8px' }}>
        Или выполните шаги вручную (ОС: {os === 'windows' ? 'Windows' : os === 'linux' ? 'Linux' : 'macOS'}):
      </p>

      <div className="setup-agent-json">
        <strong>packages/agent/config/agent.json</strong>
        <pre className="code docs-pre">{agentText}</pre>
        <CopyBtn text={agentText} label="Копировать agent.json" />
      </div>

      <ol className="setup-steps">
        {STEPS[os].map((step, i) => (
          <li key={i} className="setup-step">
            <strong>
              {i + 1}. {step.title}
            </strong>
            {step.text && <p className="muted">{step.text}</p>}
            {step.code && (
              <>
                <pre className="code docs-pre">{step.code}</pre>
                <CopyBtn text={step.code} label="Копировать команды" />
              </>
            )}
            {step.title.includes('agent.json') && (
              <CopyBtn text={agentText} label="Копировать agent.json" />
            )}
          </li>
        ))}
      </ol>

      <div className="setup-check muted">
        <strong>Проверка:</strong> обновите эту страницу — статус ПК «онлайн». Отправьте себе
        тестовое сообщение в мессенджер → раздел «Лента сообщений».
        <br />
        Подробная документация — раздел <strong>«Документация»</strong> в меню слева.
      </div>
    </div>
  );
}

export function UserWelcome(): JSX.Element {
  return (
    <div className="card setup-guide">
      <h3 style={{ margin: '0 0 8px' }}>Подключение вашего ПК к кабинету</h3>
      <p className="muted">
        Администратор выдал вам email и пароль. Этот кабинет — <strong>только ваш</strong>: свои
        сообщения, контакты и один ПК. Другие пользователи их не видят.
      </p>
      <ol className="setup-steps">
        <li>
          Нажмите <strong>«+ Подключить ПК»</strong> (доступно один раз на аккаунт).
        </li>
        <li>
          Скопируйте <strong>промпт для Cursor Agent</strong> из инструкции — он содержит ваш{' '}
          <code>agent.json</code> и все шаги установки автоматически.
        </li>
        <li>
          Либо выполните <strong>ручные шаги</strong> из той же инструкции.
        </li>
        <li>
          Статус станет <span className="pill online">онлайн</span> — сообщения появятся в «Ленте».
        </li>
      </ol>
      <p className="muted warn-note">
        Создавать других пользователей нельзя — только администратор (раздел «Пользователи» у него).
      </p>
    </div>
  );
}
