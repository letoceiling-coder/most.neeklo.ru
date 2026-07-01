import { useState } from 'react';
import { CURSOR_PROMPT_GENERIC as CURSOR_PROMPT } from '../docs/cursorPrompt.js';
import { MESSENGERS, MOST_GIT_REPO, TOC } from '../docs/content.js';

function Code({ children }: { children: string }): JSX.Element {
  return <pre className="code docs-pre">{children}</pre>;
}

function scrollTo(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function DocsPage({ onBack }: { onBack?: () => void }): JSX.Element {
  const [copied, setCopied] = useState(false);

  const copyPrompt = async (): Promise<void> => {
    await navigator.clipboard.writeText(CURSOR_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="docs">
      <div className="docs-header spread row">
        <div>
          <h1 className="page-title">Документация</h1>
          <p className="muted">
            Установка Most на новый ПК — Windows, Linux, macOS ·{' '}
            <a href="https://most.neeklo.ru">most.neeklo.ru</a>
          </p>
        </div>
        {onBack && (
          <button type="button" className="secondary" onClick={onBack}>
            ← Назад к входу
          </button>
        )}
      </div>

      <div className="docs-layout">
        <nav className="docs-toc card">
          <strong>Содержание</strong>
          <ul>
            {TOC.map((item) => (
              <li key={item.id}>
                <button type="button" className="docs-toc-link" onClick={() => scrollTo(item.id)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="docs-body">
          <section id="overview" className="card docs-section">
            <h2>Как это работает</h2>
            <Code>{`Ваш ПК                              Облако (most.neeklo.ru)
────────                            ──────────────────────
Chrome (профиль Most)               HTTPS + WSS (TLS)
  └ 6 вкладок мессенджеров            Личный кабинет
Agent (watchers)                      PostgreSQL
  └ исходящий WSS ─────────────────►  /agent`}</Code>
            <ul className="docs-list">
              <li>
                Агент подключается к <strong>вашему Chrome</strong> по CDP (порт 9222 на localhost).
              </li>
              <li>
                Связь ПК → сервер — <strong>исходящий</strong> WebSocket{' '}
                <code>wss://most.neeklo.ru/agent</code>. Порты на роутере открывать не нужно.
              </li>
              <li>Каждый пользователь видит только свои ПК, сообщения и настройки.</li>
              <li>Администратор создаёт аккаунты в разделе «Пользователи».</li>
            </ul>
          </section>

          <section id="security" className="card docs-section">
            <h2>Безопасность связи</h2>
            <table>
              <thead>
                <tr>
                  <th>Что</th>
                  <th>Как защищено</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Транспорт</td>
                  <td>TLS (HTTPS / WSS), сертификат Let&apos;s Encrypt</td>
                </tr>
                <tr>
                  <td>ПК</td>
                  <td>
                    Уникальные <code>pcId</code> + <code>token</code> в <code>agent.json</code>
                  </td>
                </tr>
                <tr>
                  <td>Кабинет</td>
                  <td>Email + пароль, JWT-сессия</td>
                </tr>
                <tr>
                  <td>Доступ с интернета к ПК</td>
                  <td>
                    <strong>Нет</strong> — сервер не подключается к вашему компьютеру
                  </td>
                </tr>
                <tr>
                  <td>Chrome</td>
                  <td>Отдельный профиль Most — не смешивается с личным браузером</td>
                </tr>
              </tbody>
            </table>
            <p className="muted warn-note">
              Не передавайте token из agent.json. При утечке — пересоздайте ПК в кабинете.
            </p>
          </section>

          <section id="accounts" className="card docs-section">
            <h2>Аккаунты</h2>
            <ol className="docs-list">
              <li>Администратор создаёт аккаунт (email + пароль) и передаёт клиенту</li>
              <li>
                Пользователь входит на{' '}
                <a href="https://most.neeklo.ru">most.neeklo.ru</a> — видит <strong>только свой</strong>{' '}
                кабинет
              </li>
              <li>
                <strong>Мой ПК</strong> → «+ Подключить ПК» (один ПК на аккаунт) → инструкция
              </li>
              <li>На своём компьютере — agent.json и агент → статус «онлайн»</li>
            </ol>
            <p className="muted">
              Администратор: раздел «Пользователи» + свой «Мой ПК». Обычный пользователь: без
              «Пользователи», только свой ПК.
            </p>
          </section>

          <section id="requirements" className="card docs-section">
            <h2>Требования</h2>
            <table>
              <thead>
                <tr>
                  <th>Компонент</th>
                  <th>Минимум</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Node.js</td>
                  <td>20+</td>
                </tr>
                <tr>
                  <td>Браузер</td>
                  <td>Google Chrome или Chromium</td>
                </tr>
                <tr>
                  <td>ОС</td>
                  <td>Windows 10/11, Linux (Debian/Ubuntu/Fedora), macOS 12+</td>
                </tr>
                <tr>
                  <td>Сеть</td>
                  <td>Исходящий HTTPS/WSS без блокировки</td>
                </tr>
                <tr>
                  <td>Репозиторий Most</td>
                  <td>
                    <code>{MOST_GIT_REPO}</code> — <code>git clone</code> в папку проекта
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="muted">Не нужны: Docker на ПК, открытые порты, VPN-туннель.</p>
          </section>

          <section id="windows" className="card docs-section">
            <h2>Установка — Windows</h2>
            <h3>1. Сборка</h3>
            <Code>{`cd C:\\projects\\most.neeklo.ru
npm install
npm run build:shared
npm run build:agent
copy packages\\agent\\config\\agent.json.example packages\\agent\\config\\agent.json`}</Code>
            <h3>2. agent.json</h3>
            <Code>{`{
  "pcId": "pc-office-1",
  "token": "ТОКЕН_ИЗ_КАБИНЕТА",
  "vpsWsUrl": "wss://most.neeklo.ru/agent",
  "vpsHttpUrl": "https://most.neeklo.ru",
  "chromeCdpEndpoint": "http://127.0.0.1:9222",
  "sources": ["telegram","whatsapp","vk","max","instagram","avito"]
}`}</Code>
            <h3>3. Chrome + агент</h3>
            <Code>{`powershell -ExecutionPolicy Bypass -File deploy\\windows\\start-chrome-debug.ps1
powershell -ExecutionPolicy Bypass -File deploy\\windows\\open-messenger-tabs.ps1
# войти в мессенджеры один раз
powershell -ExecutionPolicy Bypass -File deploy\\windows\\start-agent.ps1`}</Code>
            <p className="muted">
              Профиль Chrome: <code>%LOCALAPPDATA%\Most\chrome-profile</code>
            </p>
          </section>

          <section id="linux" className="card docs-section">
            <h2>Установка — Linux</h2>
            <Code>{`cd ~/most.neeklo.ru
npm install && npm run build:shared && npm run build:agent
cp packages/agent/config/agent.json.example packages/agent/config/agent.json
chmod +x deploy/linux/*.sh
bash deploy/linux/start-chrome-debug.sh 9222
bash deploy/linux/open-messenger-tabs.sh 9222
bash deploy/linux/start-agent.sh`}</Code>
            <p className="muted">
              Профиль: <code>~/.most/chrome-profile</code> · Лог: <code>~/.most/logs/agent.log</code>
            </p>
          </section>

          <section id="macos" className="card docs-section">
            <h2>Установка — macOS</h2>
            <Code>{`cd ~/most.neeklo.ru
npm install && npm run build:shared && npm run build:agent
chmod +x deploy/macos/*.sh deploy/linux/*.sh
bash deploy/macos/start-chrome-debug.sh
bash deploy/macos/open-messenger-tabs.sh
bash deploy/macos/start-agent.sh`}</Code>
          </section>

          <section id="chrome" className="card docs-section">
            <h2>Мессенджеры (авторизация один раз)</h2>
            <table>
              <thead>
                <tr>
                  <th>Сервис</th>
                  <th>URL</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {MESSENGERS.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>
                      <a href={m.url} target="_blank" rel="noreferrer">
                        {m.url}
                      </a>
                    </td>
                    <td className="muted">
                      {m.id === 'whatsapp' ? 'QR с телефона' : 'Логин / QR / 2FA'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted warn-note">
              Используйте только Chrome профиля Most (скрипт start-chrome-debug). Обычный Chrome
              без CDP агент не видит.
            </p>
          </section>

          <section id="autostart" className="card docs-section">
            <h2>Незаметный автозапуск</h2>
            <p>
              После перезагрузки ПК связь с сервером восстанавливается <strong>без всплывающих окон</strong>:
            </p>
            <ul className="docs-list">
              <li>Chrome — минимизирован, отдельный профиль; второе окно не создаётся, если CDP уже работает</li>
              <li>Агент — без консоли, лог в файл</li>
              <li>Задержка ~45 с после входа в Windows (не мешает загрузке рабочего стола)</li>
            </ul>
            <h3>Windows</h3>
            <Code>{`powershell -ExecutionPolicy Bypass -File deploy\\windows\\install-agent-autostart.ps1`}</Code>
            <p className="muted">
              Лог: <code>%LOCALAPPDATA%\Most\logs\agent.log</code>
            </p>
            <h3>Linux</h3>
            <Code>{`bash deploy/linux/install-autostart.sh ~/most.neeklo.ru`}</Code>
            <h3>macOS</h3>
            <Code>{`bash deploy/macos/install-autostart.sh ~/most.neeklo.ru`}</Code>
            <p className="muted warn-note">
              Первый раз всё равно нужно вручную войти в мессенджеры в Chrome.
            </p>
          </section>

          <section id="stability" className="card docs-section">
            <h2>Стабильность связи</h2>
            <ul className="docs-list">
              <li>
                <strong>WebSocket</strong> — автопереподключение (1–30 с) при обрыве сети
              </li>
              <li>
                <strong>Очередь на диске</strong> — сообщения не теряются при отключении
              </li>
              <li>
                <strong>Агент</strong> — автоперезапуск процесса и CDP к Chrome
              </li>
              <li>
                <strong>Сервер</strong> — pm2 + health{' '}
                <a href="https://most.neeklo.ru/health">/health</a>
              </li>
            </ul>
          </section>

          <section id="workflow" className="card docs-section">
            <h2>Как парсятся сообщения</h2>
            <Code>{`Chrome (вкладка мессенджера)
  └ Watcher следит за DOM (новые входящие)
       └ Agent → WSS → most.neeklo.ru
            └ Контакт + сообщение в БД → Лента / Webhook / ИИ`}</Code>
            <ol className="docs-list">
              <li>На ПК Chrome держит вкладки мессенджеров (профиль Most).</li>
              <li>Watcher замечает новое входящее сообщение в DOM.</li>
              <li>Агент отправляет его на сервер по WebSocket.</li>
              <li>
                Сервер объединяет отправителя в контакт, сохраняет сообщение, шлёт вебхук и
                (опционально) ИИ-анализ.
              </li>
              <li>В кабинете сообщение появляется в «Ленте» (обычно 1–5 с).</li>
            </ol>
            <p className="muted">
              Не парсятся: исходящие, пустые, контакты с тегом exclude, номера/username из
              «Исключений».
            </p>
          </section>

          <section id="reply" className="card docs-section">
            <h2>Ответы из кабинета</h2>
            <ol className="docs-list">
              <li>
                <strong>Лента</strong> → «Ответить» у нужного сообщения
              </li>
              <li>Введите текст (можно вставить черновик ИИ)</li>
              <li>
                «Отправить» — текст уходит в тот же чат через Chrome на вашем ПК
              </li>
            </ol>
            <p className="muted warn-note">
              ПК должен быть <strong>онлайн</strong>, Chrome с мессенджером открыт и авторизован.
            </p>
          </section>

          <section id="exclusions" className="card docs-section">
            <h2>Исключение контактов из парсинга</h2>
            <p>Настройка через личный кабинет (отдельная страница на ПК не нужна).</p>
            <table>
              <thead>
                <tr>
                  <th>Способ</th>
                  <th>Где</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Исключить человека</td>
                  <td>
                    <strong>Контакты</strong> → «Исключить из парсинга»
                  </td>
                </tr>
                <tr>
                  <td>Заранее по телефону / username</td>
                  <td>
                    <strong>Настройки</strong> → «Исключения из парсинга»
                  </td>
                </tr>
                <tr>
                  <td>Отключить мессенджер целиком</td>
                  <td>
                    <strong>Настройки</strong> → «Источники»
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section id="uninstall" className="card docs-section">
            <h2>Удаление Most с ПК</h2>
            <p>Остановить автоподъём, затем удалить файлы.</p>
            <h3>Windows</h3>
            <Code>{`powershell -ExecutionPolicy Bypass -File deploy\\windows\\uninstall-agent.ps1
# затем удалить:
#   %LOCALAPPDATA%\\Most
#   папку проекта`}</Code>
            <h3>Linux</h3>
            <Code>{`bash deploy/linux/uninstall-agent.sh
rm -rf ~/.most ~/most.neeklo.ru`}</Code>
            <h3>macOS</h3>
            <Code>{`bash deploy/macos/uninstall-agent.sh
rm -rf ~/.most ~/most.neeklo.ru`}</Code>
            <p className="muted">
              В кабинете: «ПК и аккаунты» → Удалить. Подробно: docs/SETUP.md §19.
            </p>
          </section>

          <section id="verify" className="card docs-section">
            <h2>Проверка</h2>
            <ol className="docs-list">
              <li>
                <strong>ПК и аккаунты</strong> — статус «онлайн»
              </li>
              <li>Мессенджеры — authorized (не needs_login)</li>
              <li>Тестовое входящее → «Лента сообщений»</li>
            </ol>
            <Code>{`curl https://most.neeklo.ru/health`}</Code>
          </section>

          <section id="cursor" className="card docs-section">
            <h2>Промпт для Cursor Agent</h2>
            <p>
              Вставьте в Cursor (режим Agent) на новом ПК — агент выполнит установку по шагам.
              Вам останется только войти в мессенджеры в Chrome.
            </p>
            <p className="muted warn-note">
              В личном кабинете откройте <strong>«Мой ПК» → «Инструкция»</strong> — там промпт уже
              содержит ваш <code>pcId</code>, <code>token</code> и готовый <code>agent.json</code>.
            </p>
            <button type="button" onClick={() => void copyPrompt()}>
              {copied ? 'Скопировано ✓' : 'Копировать промпт'}
            </button>
            <Code>{CURSOR_PROMPT}</Code>
            <p className="muted">
              Полная версия: <code>docs/CURSOR-AGENT-PROMPT.md</code> · Подробности:{' '}
              <code>docs/SETUP.md</code>
            </p>
          </section>

          <section id="troubleshoot" className="card docs-section">
            <h2>Устранение неполадок</h2>
            <table>
              <thead>
                <tr>
                  <th>Симптом</th>
                  <th>Решение</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ПК «офлайн»</td>
                  <td>agent.json, интернет, лог agent.log, задача MostAgent</td>
                </tr>
                <tr>
                  <td>bad token</td>
                  <td>Пересоздать ПК в кабинете, обновить token</td>
                </tr>
                <tr>
                  <td>Неверный пароль кабинета</td>
                  <td>Вход по email (не admin); пароль у администратора</td>
                </tr>
                <tr>
                  <td>Агент не видит Chrome</td>
                  <td>start-chrome-debug; закрыть обычный Chrome с тем же профилем</td>
                </tr>
                <tr>
                  <td>Моргает Chrome</td>
                  <td>Переустановить install-agent-autostart.ps1 (режим Stealth)</td>
                </tr>
                <tr>
                  <td>WhatsApp отвязался</td>
                  <td>QR заново в web.whatsapp.com (профиль Most)</td>
                </tr>
                <tr>
                  <td>Нет сообщений</td>
                  <td>sources в agent.json и Настройки кабинета</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}
