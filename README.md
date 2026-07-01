# Most — мост ПК ↔ VPS для входящих сообщений мессенджеров



Агент на ПК отслеживает входящие сообщения в веб-версиях мессенджеров

(**Telegram, MAX, VK, Avito, Instagram, WhatsApp**) на авторизованных аккаунтах

и в реальном времени отправляет их в **единую точку обработки** на VPS. Сервер

объединяет отправителей в единые контакты с тегами по источнику, обрабатывает

сообщения через **OpenRouter** (категория, теги, черновик ответа) и рассылает

**вебхуки**. Управление — через веб-кабинет.



**Production:** https://most.neeklo.ru



Основано на наработках `parser-COMP` (CDP-подключение к авторизованному Chrome,

паттерн захвата WebSocket-кадров, reverse SSH-туннель, реестр ПК).



## Документация



| Документ | Описание |

|----------|----------|

| **[docs/SETUP.md](docs/SETUP.md)** | Полная инструкция (репозиторий) |
| **[docs/CURSOR-AGENT-PROMPT.md](docs/CURSOR-AGENT-PROMPT.md)** | Промпт для Cursor Agent |
| **https://most.neeklo.ru/#docs** | Документация на сайте (доступна без входа) |



## Быстрый старт (ПК)

```powershell
git clone https://github.com/letoceiling-coder/most.neeklo.ru.git C:\projects\most.neeklo.ru
cd C:\projects\most.neeklo.ru

npm install && npm run build:shared && npm run build:agent

copy packages\agent\config\agent.json.example packages\agent\config\agent.json

# → впишите pcId и token из кабинета (ПК и аккаунты → Подключить ПК)



powershell -ExecutionPolicy Bypass -File deploy\windows\start-chrome-debug.ps1

powershell -ExecutionPolicy Bypass -File deploy\windows\open-messenger-tabs.ps1

# → войдите во все мессенджеры в открытом Chrome (один раз)



powershell -ExecutionPolicy Bypass -File deploy\windows\start-agent.ps1

```



Подробности — в [docs/SETUP.md](docs/SETUP.md).



## Архитектура



```

ПК (агент)                          VPS (сервер)

─────────────────                   ───────────────────────────

Chrome (CDP 9222)                   WS Hub  /agent

  └ web.telegram / wa / vk / ...      │

Watchers (DOM + WS-кадры)             ├ Ingest: дедуп контактов + теги источника

  → нормализация в MessageEvent       ├ PostgreSQL (contacts, messages, ...)

OutboundQueue (буфер на диске)        ├ OpenRouter (анализ сообщения)

  → постоянный WSS ──────────────►    └ Webhook dispatcher (HMAC + ретраи) → клиент

  ◄────────────── команды (ответить/обновить)

                                     REST API + кабинет (React)

```



Канал связи — постоянный **исходящий WebSocket** ПК → VPS (`wss://.../agent`),

проходит NAT/firewall без настройки. Reverse SSH-туннель

(`deploy/windows/start-bridge-tunnel.ps1`) — опциональный fallback.



## Структура монорепо



- `packages/shared` — общие типы и WS-протокол (`MessageEvent`, `Contact`, `AgentCommand`).

- `packages/server` — VPS: Express REST + WS Hub + PostgreSQL + OpenRouter + вебхуки.

- `packages/agent` — ПК-агент: подключение к Chrome по CDP, watchers, очередь, WS-клиент.

- `packages/dashboard` — кабинет оператора (React + Vite).

- `deploy/windows/` — скрипты Windows (Chrome, вкладки, агент, автозапуск).

- `deploy/server/` — деплой на VPS (`install-most.sh`, pm2).



## Запуск VPS



### Production (genserver, уже развёрнуто)



```bash

ssh genserver

cd /opt/most && bash deploy/server/install-most.sh

```



Секреты: `/opt/most/.env` · nginx: `deploy/nginx/most.neeklo.ru.conf` · pm2: `most-server` на `:3035`



### Локально / Docker



```bash

cp .env.example .env

docker compose up -d --build

```



Кабинет на `:3030`. Для production — nginx + certbot (см. `deploy/nginx/`).



## Подключение ПК (кратко)



1. Кабинет → **ПК и аккаунты** → **Подключить ПК** → `pcId` + `token`

2. `packages/agent/config/agent.json` — прописать ключи и `wss://most.neeklo.ru/agent`

3. `start-chrome-debug.ps1` → `open-messenger-tabs.ps1` → авторизация

4. `start-agent.ps1` (или `install-agent-autostart.ps1`)



**Автонастройка через Cursor:** [docs/CURSOR-AGENT-PROMPT.md](docs/CURSOR-AGENT-PROMPT.md)



## Вебхуки



POST на URL с заголовком `X-Most-Signature: sha256=HMAC_SHA256(secret, body)`.

Ретраи до 8 попыток, журнал в кабинете.



## Скрипты Windows



| Скрипт | Назначение |

|--------|------------|

| `deploy/windows/start-chrome-debug.ps1` | Chrome с CDP :9222 |

| `deploy/windows/open-messenger-tabs.ps1` | Открыть 6 вкладок мессенджеров |

| `deploy/windows/start-agent.ps1` | Запуск агента |

| `deploy/windows/install-agent-autostart.ps1` | Автозапуск при входе |



## npm-скрипты



- `npm run build` / `build:all` — сборка пакетов

- `npm test` — тесты + smoke

- `npm run dev:server` / `dev:agent` / `dev:dashboard` — разработка

- `npm run migrate` — схема БД



## Замечание по селекторам мессенджеров



Веб-интерфейсы мессенджеров часто меняют разметку. `TelegramWatcher` — референс;

остальные watchers в `packages/agent/src/watchers/*` — править `domSelectors()`

или `parseWsFrame()` при поломках.


