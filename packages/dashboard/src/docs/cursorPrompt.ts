import { MESSENGERS } from './messengers.js';
import { MOST_GIT_REPO, gitCloneCommand } from './repo.js';

export type SetupOs = 'windows' | 'linux' | 'macos';

export interface CursorPromptSetup {
  pcId: string;
  token: string;
  publicUrl: string;
  agentJson: Record<string, unknown>;
}

function installBlock(os: SetupOs, projectRoot: string): string {
  const cloneCmd = gitCloneCommand(projectRoot);
  const common = `| Компонент | Зачем | Откуда |
|-----------|-------|--------|
| Node.js 20 LTS | сборка и запуск агента | https://nodejs.org/en/download (или команды ниже) |
| npm | зависимости проекта | идёт с Node.js |
| Google Chrome | мессенджеры + CDP :9222 | https://www.google.com/chrome/ (или команды ниже) |
| Git | клонирование проекта | https://git-scm.com/downloads |
| Проект Most | код агента и скрипты | git clone ${MOST_GIT_REPO} |
| curl | проверка health/CDP | обычно уже есть; Windows 10+: встроен |`;

  if (os === 'windows') {
    return `${common}

Команды установки (Windows, если чего-то нет):
  winget install OpenJS.NodeJS.LTS --accept-package-agreements
  winget install Google.Chrome --accept-package-agreements
  winget install Git.Git --accept-package-agreements

Если winget недоступен — скачай установщики с nodejs.org и google.com/chrome.

Скачать проект Most (если папки ${projectRoot} ещё нет):
  ${cloneCmd}

Если репозиторий уже есть — git -C "${projectRoot}" pull

Проверка после установки:
  node -v    → v20.x или v22.x
  npm -v
  git --version
  where chrome  OR  dir "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"
  cd /d ${projectRoot} && dir package.json deploy\\windows`;
  }

  if (os === 'macos') {
    return `${common}

Команды установки (macOS, если чего-то нет):
  # Homebrew: https://brew.sh
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  brew install node@20
  brew install --cask google-chrome
  brew install git

Скачать проект Most (если папки ${projectRoot} ещё нет):
  ${cloneCmd}

Если репозиторий уже есть — git -C "${projectRoot}" pull

Проверка:
  node -v && npm -v && git --version
  ls "/Applications/Google Chrome.app"
  cd ${projectRoot} && test -f package.json && ls deploy/macos`;
  }

  return `${common}

Команды установки (Linux, если чего-то нет):
  # Node 20 (Ubuntu/Debian):
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs git curl
  # Chrome:
  wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  sudo apt install -y /tmp/chrome.deb

Скачать проект Most (если папки ${projectRoot} ещё нет):
  ${cloneCmd}

Если репозиторий уже есть — git -C "${projectRoot}" pull

Проверка:
  node -v && npm -v && git --version
  google-chrome --version || chromium --version
  cd ${projectRoot} && test -f package.json && ls deploy/linux`;
}

function osDefaults(os: SetupOs): { projectRoot: string; chromeCmd: string; agentCmd: string; autostartCmd: string } {
  if (os === 'windows') {
    return {
      projectRoot: 'C:\\projects\\most.neeklo.ru',
      chromeCmd: `powershell -ExecutionPolicy Bypass -File deploy\\windows\\start-chrome-debug.ps1
powershell -ExecutionPolicy Bypass -File deploy\\windows\\open-messenger-tabs.ps1`,
      agentCmd: 'powershell -ExecutionPolicy Bypass -File deploy\\windows\\start-agent.ps1',
      autostartCmd:
        'powershell -ExecutionPolicy Bypass -File deploy\\windows\\install-agent-autostart.ps1 -ProjectRoot "<PROJECT_ROOT>"',
    };
  }
  if (os === 'macos') {
    return {
      projectRoot: '~/most.neeklo.ru',
      chromeCmd: `chmod +x deploy/macos/*.sh deploy/linux/*.sh
bash deploy/macos/start-chrome-debug.sh
bash deploy/macos/open-messenger-tabs.sh`,
      agentCmd: 'bash deploy/macos/start-agent.sh',
      autostartCmd: 'bash deploy/macos/install-autostart.sh "<PROJECT_ROOT>"',
    };
  }
  return {
    projectRoot: '~/most.neeklo.ru',
    chromeCmd: `chmod +x deploy/linux/*.sh
bash deploy/linux/start-chrome-debug.sh 9222
bash deploy/linux/open-messenger-tabs.sh 9222`,
    agentCmd: 'bash deploy/linux/start-agent.sh',
    autostartCmd: 'bash deploy/linux/install-autostart.sh "<PROJECT_ROOT>"',
  };
}

/** Personalized Cursor Agent prompt — PC already registered in the user's cabinet. */
export function buildCursorSetupPrompt(setup: CursorPromptSetup, os: SetupOs = 'windows'): string {
  const agentText = JSON.stringify(setup.agentJson, null, 2);
  const { projectRoot, chromeCmd, agentCmd, autostartCmd } = osDefaults(os);
  const sources = Array.isArray(setup.agentJson.sources)
    ? (setup.agentJson.sources as string[]).join(', ')
    : 'telegram, whatsapp, vk, max, instagram, avito';
  const messengersList = MESSENGERS.map((m) => `• ${m.name} — ${m.url}`).join('\n');

  return `Задача: на ЭТОМ компьютере полностью установить, настроить и проверить Most PC-агент для личного кабинета ${setup.publicUrl}.

Most — мост «ПК ↔ облако»: Chrome с мессенджерами + локальный агент → ${String(setup.agentJson.vpsWsUrl ?? 'wss://most.neeklo.ru/agent')}.
Порты наружу не открываем. ПК уже зарегистрирован в кабинете — НЕ создавай второй ПК через API.

=== УЖЕ ГОТОВО (из кабинета Most, не менять pcId/token) ===
MOST_URL=${setup.publicUrl}
PC_ID=${setup.pcId}
PC_TOKEN=${setup.token}
SOURCES=${sources}

agent.json (сохрани ТОЧНО в packages/agent/config/agent.json):
${agentText}

=== ПАРАМЕТРЫ (уточни у пользователя если пусто) ===
OS=${os}
PROJECT_ROOT=${projectRoot}
GIT_REPO=${MOST_GIT_REPO}
NODE_MIN=20

=== ЧТО УСТАНОВИТЬ И ОТКУДА (проверь каждый пункт; если нет — установи командами ниже) ===
${installBlock(os, projectRoot)}

Документация в репо: docs/SETUP.md · docs/CURSOR-AGENT-PROMPT.md
Подробная таблица требований: docs/SETUP.md § «Требования»

=== ПРИНЦИПЫ ===
- У пользователя ОДИН личный кабинет и ОДИН ПК — используй PC_ID выше
- agent.json и token — секреты, не коммитить, не публиковать
- Если CDP http://127.0.0.1:9222 уже отвечает — не запускай второй Chrome
- Не парси мессенджеры без авторизации: status должен быть online, не needs_qr / logged_out / error
- WhatsApp QR, 2FA, SMS — только человек; дождись «готово»

=== ПЛАН (выполни полностью, шаг за шагом) ===

1. ОКРУЖЕНИЕ — ПРОВЕРКА И УСТАНОВКА
   - Пройди таблицу «ЧТО УСТАНОВИТЬ И ОТКУДА» — каждый компонент
   - Если PROJECT_ROOT/package.json нет — выполни: ${gitCloneCommand(projectRoot)}
   - cd PROJECT_ROOT
   - Установи недостающее (Node, Chrome, Git) по командам для ${os}

2. СБОРКА ПРОЕКТА
   npm install
   npm run build:shared
   npm run build:agent

3. КОНФИГ ПОДКЛЮЧЕНИЯ К СЕРВЕРУ
   - Запиши agent.json выше в packages/agent/config/agent.json
   - Проверь: pcId=${setup.pcId}, vpsHttpUrl=${setup.publicUrl}, vpsWsUrl=wss://…/agent
   - НЕ вызывай POST /v1/pcs — ПК уже создан в кабинете

4. CHROME + ВКЛАДКИ МЕССЕНДЖЕРОВ
   ${chromeCmd}

   Проверка CDP:
   curl -s http://127.0.0.1:9222/json/version

   Должны открыться вкладки:
${messengersList}

5. АВТОРИЗАЦИЯ (интерактивно с пользователем)
   Сообщи: «В Chrome профиля Most войдите во все нужные мессенджеры (один раз).»
   Дождись ответа «готово».

   ПРОВЕРКА АВТОРИЗАЦИИ (обязательно до запуска агента):
   - Для каждого source из sources проверь страницу:
     • Telegram — нет QR / auth-form → online, иначе needs_qr
     • WhatsApp — нет QR canvas → online, иначе needs_qr
     • VK / Instagram / Avito / MAX — нет экрана логина → online
   - Если мессенджер не авторизован — попроси пользователя войти или убери source из agent.json.sources
   - Не запускай агент, пока все нужные sources не online

6. ЗАПУСК АГЕНТА
   ${agentCmd}

   В логах ожидай:
   - Connected to Chrome over CDP
   - Connected to VPS / WSS connected
   - Watcher started для каждого online source

7. ТЕСТЫ С СЕРВЕРОМ
   a) curl ${setup.publicUrl}/health → ok:true
   b) Агент подключён — в кабинете «Мой ПК» статус ПК «онлайн»
   c) В карточке ПК аккаунты мессенджеров: status online (не needs_qr)
   d) Попроси пользователя отправить себе тестовое входящее сообщение → «Лента сообщений» в кабинете
   e) Если оффлайн — смотри лог:
      Windows: %LOCALAPPDATA%\\Most\\logs\\agent.log
      Linux/macOS: ~/.most/logs/agent.log

8. АВТОЗАПУСК (спроси «включить незаметный автозапуск?»)
   ${autostartCmd.replace('<PROJECT_ROOT>', projectRoot)}

9. ИТОГ ДЛЯ ПОЛЬЗОВАТЕЛЯ
   - pcId: ${setup.pcId}
   - путь agent.json
   - статус online в кабинете
   - какие мессенджеры online / какие пропущены (не авторизованы)
   - где лог агента
   - ссылка на документацию: ${setup.publicUrl}/#docs

Ограничения:
- Не менять nginx/VPS без явной просьбы
- Не создавать второй ПК (лимит один на аккаунт)
- Не парсить needs_qr / logged_out — только online
- При ошибке CDP — перезапусти start-chrome-debug, не дублируй Chrome`;
}

/** Generic prompt for Docs page (no personal credentials). */
export const CURSOR_PROMPT_GENERIC = buildCursorSetupPrompt(
  {
    pcId: 'pc-XXXX',
    token: 'PASTE_TOKEN_FROM_CABINET',
    publicUrl: 'https://most.neeklo.ru',
    agentJson: {
      pcId: 'pc-XXXX',
      token: 'PASTE_TOKEN_FROM_CABINET',
      vpsWsUrl: 'wss://most.neeklo.ru/agent',
      vpsHttpUrl: 'https://most.neeklo.ru',
      chromeCdpEndpoint: 'http://127.0.0.1:9222',
      agentVersion: '1.0.0',
      useCdpLock: false,
      sources: ['telegram', 'whatsapp', 'vk', 'max', 'instagram', 'avito'],
    },
  },
  'windows',
).replace(
  'PC уже зарегистрирован в кабинете — НЕ создавай второй ПК через API.',
  'Сначала создай ПК в кабинете «Мой ПК» → «+ Подключить ПК» и подставь pcId/token из agent.json.',
);
