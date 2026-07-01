# Most — установка с нуля (новый ПК)

Полное руководство: аккаунт → кабинет → ПК-агент → мессенджеры → автозапуск → проверка.

**Сервис:** [https://most.neeklo.ru](https://most.neeklo.ru)  
**Назначение:** безопасный мост «ваш ПК ↔ облако» для входящих сообщений из мессенджеров.

---

## Содержание

1. [Как это работает](#1-как-это-работает)
2. [Безопасность связи](#2-безопасность-связи)
3. [Аккаунты и роли](#3-аккаунты-и-роли)
4. [Требования к ПК](#4-требования-к-пк)
5. [Быстрый старт (Windows)](#5-быстрый-старт-windows)
6. [Установка на Linux](#6-установка-на-linux)
7. [Установка на macOS](#7-установка-на-macos)
8. [Chrome и мессенджеры (один раз)](#8-chrome-и-мессенджеры-один-раз)
9. [Незаметный автозапуск](#9-незаметный-автозапуск)
10. [Стабильность связи](#10-стабильность-связи)
11. [Проверка работы](#11-проверка-работы)
12. [Как парсятся сообщения](#16-как-парсятся-сообщения-после-установки)
13. [Ответы из кабинета](#17-ответы-из-кабинета)
14. [Исключение контактов](#18-исключение-контактов-из-парсинга)
15. [Удаление с ПК](#19-удаление-most-с-пк)
16. [Кабинет: разделы](#12-кабинет-разделы)
17. [Вебхуки](#13-вебхуки)
18. [Обновление](#14-обновление)
19. [Устранение неполадок](#15-устранение-неполадок)

---

## 1. Как это работает

```
Ваш ПК                              Облако (most.neeklo.ru)
────────                            ──────────────────────
Chrome (профиль Most)               nginx + TLS (HTTPS/WSS)
  └ 6 вкладок мессенджеров            API + кабинет
Agent (watchers)                      PostgreSQL
  └ исходящий WSS ─────────────────►  /agent WebSocket
```

- **Агент не открывает свой браузер** — подключается к вашему Chrome по CDP (порт 9222 на localhost).
- **Связь только исходящая:** ПК сам подключается к `wss://most.neeklo.ru/agent`. Не нужно открывать порты, пробрасывать NAT или VPN-туннель.
- **Каждый пользователь** видит только свои ПК, сообщения и настройки.
- **Администратор** создаёт аккаунты в разделе «Пользователи».

---

## 2. Безопасность связи

| Что | Как защищено |
|-----|--------------|
| Транспорт | TLS 1.2+ (HTTPS / WSS), сертификат Let's Encrypt |
| Авторизация ПК | Уникальный `pcId` + секретный `token` (только для вашего ПК) |
| Авторизация кабинета | Email + пароль (хеш scrypt в БД), JWT-сессия |
| Доступ к ПК с интернета | **Нет** — сервер не подключается к вашему ПК |
| Секреты на ПК | `agent.json` хранится локально, **не коммитьте** в git |
| Chrome | Отдельный профиль Most — не смешивается с личным браузером |

**Важно:** не передавайте `token` из `agent.json` третьим лицам. При компрометации — пересоздайте ПК в кабинете (новый token).

---

## 3. Аккаунты и роли

### Вход в кабинет

1. Откройте [https://most.neeklo.ru](https://most.neeklo.ru)
2. Введите **email** и **пароль** (не логин `admin`, а полный email)
3. Администратор выдаёт доступ через раздел **«Пользователи»**

| Роль | Возможности |
|------|-------------|
| **admin** | Все разделы + «Пользователи» (создание аккаунтов) |
| **user** | Свои ПК, сообщения, контакты, настройки |

### Подключение нового ПК (для каждого пользователя)

1. Войти в **свой** кабинет
2. **ПК и аккаунты** → **«+ Подключить ПК»**
3. Задать имя (`pc-office`, `pc-home` — латиница)
4. Скопировать `pcId` и `token` → вставить в `agent.json` на этом компьютере

> ПК **должен быть создан в кабинете до** запуска агента. Иначе агент не сможет подключиться.

---

## 4. Требования к ПК

### Общие (все ОС)

| Компонент | Версия |
|-----------|--------|
| Node.js | **20+** ([nodejs.org](https://nodejs.org)) |
| Google Chrome или Chromium | последняя стабильная |
| Интернет | стабильный, без блокировки WSS |
| Репозиторий Most | **git clone** (см. ниже) |

```bash
git clone https://github.com/letoceiling-coder/most.neeklo.ru.git ~/most.neeklo.ru
# Windows: git clone https://github.com/letoceiling-coder/most.neeklo.ru.git C:\projects\most.neeklo.ru
```

### Windows 10/11

- PowerShell 5.1+
- Права пользователя (админ не обязателен, кроме некоторых политик ExecutionPolicy)

### Linux

- Debian/Ubuntu/Fedora и аналоги
- `curl`, `python3` (для скриптов вкладок)
- Для автозапуска: **systemd user** (`loginctl enable-linger $USER` если нужен запуск без GUI-сессии)

### macOS

- 12+ (Monterey и новее рекомендуется)
- Для автозапуска: LaunchAgent (скрипт `deploy/macos/install-autostart.sh`)

### Что **не** нужно

- Открывать порты на роутере
- SSH-туннель (опционален только для отладки)
- Docker на ПК пользователя

---

## 5. Быстрый старт (Windows)

Пример пути: `C:\projects\most.neeklo.ru`

### Шаг 1 — код и сборка

```powershell
cd C:\projects\most.neeklo.ru
npm install
npm run build:shared
npm run build:agent
copy packages\agent\config\agent.json.example packages\agent\config\agent.json
```

### Шаг 2 — конфиг агента

В кабинете создайте ПК, затем отредактируйте `packages\agent\config\agent.json`:

```json
{
  "pcId": "pc-office-1",
  "token": "ТОКЕН_ИЗ_КАБИНЕТА",
  "vpsWsUrl": "wss://most.neeklo.ru/agent",
  "vpsHttpUrl": "https://most.neeklo.ru",
  "chromeCdpEndpoint": "http://127.0.0.1:9222",
  "agentVersion": "1.0.0",
  "useCdpLock": false,
  "sources": ["telegram", "whatsapp", "vk", "max", "instagram", "avito"]
}
```

### Шаг 3 — Chrome и вкладки

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\start-chrome-debug.ps1
powershell -ExecutionPolicy Bypass -File deploy\windows\open-messenger-tabs.ps1
```

**Первый раз:** войдите во все мессенджеры в открывшемся Chrome (QR / логин). Сессии сохраняются в профиле `%LOCALAPPDATA%\Most\chrome-profile`.

### Шаг 4 — запуск агента

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\start-agent.ps1
```

В логах: `Connected to Chrome over CDP`, `Connected to VPS`.

### Шаг 5 — автозапуск (незаметный)

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\install-agent-autostart.ps1
```

Создаёт задачу **MostAgent**: Chrome минимизирован, агент без окон, лог `%LOCALAPPDATA%\Most\logs\agent.log`.

---

## 6. Установка на Linux

```bash
cd ~/most.neeklo.ru   # ваш путь
npm install && npm run build:shared && npm run build:agent
cp packages/agent/config/agent.json.example packages/agent/config/agent.json
# отредактируйте agent.json (pcId, token)
chmod +x deploy/linux/*.sh
bash deploy/linux/start-chrome-debug.sh 9222
bash deploy/linux/open-messenger-tabs.sh 9222
# авторизация в Chrome — один раз
bash deploy/linux/start-agent.sh
```

**Автозапуск:**

```bash
bash deploy/linux/install-autostart.sh ~/most.neeklo.ru
loginctl enable-linger "$USER"   # если нужен запуск без активной сессии
```

Профиль Chrome: `~/.most/chrome-profile`  
Лог агента: `~/.most/logs/agent.log`

---

## 7. Установка на macOS

```bash
cd ~/most.neeklo.ru
npm install && npm run build:shared && npm run build:agent
cp packages/agent/config/agent.json.example packages/agent/config/agent.json
chmod +x deploy/macos/*.sh deploy/linux/*.sh
bash deploy/macos/start-chrome-debug.sh
bash deploy/macos/open-messenger-tabs.sh
bash deploy/macos/start-agent.sh
```

**Автозапуск:**

```bash
bash deploy/macos/install-autostart.sh ~/most.neeklo.ru
```

---

## 8. Chrome и мессенджеры (один раз)

| ID | Сервис | URL |
|----|--------|-----|
| telegram | Telegram Web | https://web.telegram.org/a/ |
| max | MAX | https://web.max.ru/ |
| vk | VK | https://vk.com/im |
| avito | Avito | https://www.avito.ru/profile/messenger |
| instagram | Instagram Direct | https://www.instagram.com/direct/inbox/ |
| whatsapp | WhatsApp Web | https://web.whatsapp.com/ |

| Мессенджер | Действие |
|------------|----------|
| WhatsApp | QR с телефона |
| Telegram | Номер / QR |
| Instagram, VK | Логин, возможно 2FA |
| Avito, MAX | Логин в аккаунт |

**Правила:**

- Используйте **только** Chrome с профилем Most (скрипт `start-chrome-debug`).
- Обычный Chrome без `--remote-debugging-port=9222` агент **не видит**.
- Не очищайте cookies профиля Most — иначе придётся авторизоваться заново.
- Список `sources` в `agent.json` и в **Настройках** кабинета должны совпадать.

---

## 9. Незаметный автозапуск

Цель: после перезагрузки ПК связь с [most.neeklo.ru](https://most.neeklo.ru) восстанавливается **без всплывающих окон и моргания**.

### Windows

| Механизм | Поведение |
|----------|-----------|
| Задача **MostAgent** | Запуск через `wscript` (без консоли) |
| Задержка входа | ~45 с после logon (не мешает загрузке рабочего стола) |
| Chrome | `--start-minimized`, отдельный профиль; **не создаёт второе окно**, если CDP уже работает |
| Агент | `-Silent` → лог в `%LOCALAPPDATA%\Most\logs\agent.log` |
| Вкладки | Открываются только отсутствующие (без дублирования) |

Проверка лога:

```powershell
Get-Content "$env:LOCALAPPDATA\Most\logs\agent.log" -Tail 30
```

### Linux / macOS

- systemd user / LaunchAgent с `STEALTH=1`
- Chrome стартует минимизированно, агент пишет в `~/.most/logs/`

### Первый запуск после установки

Автозапуск **не заменяет** первичную авторизацию: один раз нужно вручную войти во все мессенджеры в Chrome профиля Most.

---

## 10. Стабильность связи

### На стороне ПК (агент)

- **WebSocket:** автопереподключение с backoff (1 с → 30 с)
- **Очередь на диске:** сообщения не теряются при обрыве сети
- **Chrome:** автопереподключение CDP при падении браузера
- **start-agent / systemd:** перезапуск процесса при падении

### На стороне сервера

- pm2 `most-server` с autorestart
- PostgreSQL в Docker с healthcheck
- nginx + TLS, health: `https://most.neeklo.ru/health`

### Рекомендации пользователю

- Не выключайте ПК, если нужен приём сообщений 24/7 (или используйте выделенный мини-ПК)
- Не удаляйте профиль `%LOCALAPPDATA%\Most` / `~/.most`
- При смене пароля Wi‑Fi / VPN агент переподключится сам (1–30 с)

---

## 11. Проверка работы

### Кабинет

1. **ПК и аккаунты** — статус **«онлайн»**
2. Статусы мессенджеров: `authorized` / `needs_login`
3. Отправьте себе тестовое сообщение → **Лента сообщений**

### С ПК

```bash
curl -s https://most.neeklo.ru/health
# {"ok":true,"service":"most-server",...}
```

### Лог агента (Windows)

```
Connected to Chrome over CDP
Connected to VPS
Welcomed by VPS
```

---

## 12. Кабинет: разделы

| Раздел | Назначение |
|--------|------------|
| Лента сообщений | Входящие с ваших ПК |
| Контакты | Объединённые отправители, теги |
| ПК и аккаунты | Создание ПК, pcId + token |
| Вебхуки | POST-уведомления на ваш URL |
| Настройки | OpenRouter, источники, **исключения из парсинга** |
| Пользователи | *(только admin)* создание аккаунтов |

### OpenRouter (опционально)

**Настройки → OpenRouter:** API-ключ с [openrouter.ai](https://openrouter.ai), модель `openai/gpt-4o-mini`, включить анализ. Без ключа сообщения всё равно сохраняются.

---

## 13. Вебхуки

POST на ваш URL с заголовком:

```
X-Most-Signature: sha256=<HMAC-SHA256(secret, body)>
```

До 8 повторов с задержкой. Журнал — в кабинете.

---

## 14. Обновление

### ПК

```powershell
cd C:\projects\most.neeklo.ru
git pull          # если используете git
npm install
npm run build:agent
# перезапуск: start-agent.ps1 или перелогин в Windows
```

### Сервер (только для администратора инфраструктуры)

```bash
ssh genserver
cd /opt/most
bash deploy/server/install-most.sh
```

---

## 15. Устранение неполадок

| Симптом | Решение |
|---------|---------|
| ПК «офлайн» | Проверить `agent.json`, интернет, лог агента, задачу MostAgent |
| `bad token` | Пересоздать ПК в кабинете, обновить token в `agent.json` |
| `invalid credentials` (кабинет) | Использовать **email**, не `admin`; проверить пароль у администратора |
| Агент не видит Chrome | Запустить `start-chrome-debug.ps1`; закрыть обычный Chrome с тем же профилем |
| Моргает Chrome при автозапуске | Переустановить autostart: `install-agent-autostart.ps1` (версия со `-Stealth`) |
| WhatsApp отвязался | QR заново в web.whatsapp.com (профиль Most) |
| Нет сообщений | Проверить `sources` в agent.json и **Настройки** кабинета |
| Порт 9222 занят | Закрыть лишний Chrome или сменить порт в скриптах и agent.json |
| Linux: агент не стартует без GUI | `loginctl enable-linger $USER` |

---

## 16. Как парсятся сообщения (после установки)

```
Chrome (вкладка мессенджера)
  └ MutationObserver видит новое входящее DOM-сообщение
       └ Watcher (Telegram/WhatsApp/…)
            └ Agent → WSS → most.neeklo.ru
                 └ Ingest: контакт + сообщение в БД
                      ├ Лента в кабинете
                      ├ Webhook (если настроен)
                      └ OpenRouter (если включён) → черновик ответа
```

**Пошагово:**

1. **На ПК** Chrome с профилем Most держит вкладки мессенджеров открытыми.
2. **Watcher** каждого мессенджера следит за DOM (новые пузыри сообщений).
3. **Агент** отправляет событие `event.message` на сервер по WebSocket.
4. **Сервер** (`ingestMessage`):
   - проверяет фильтры исключений;
   - объединяет отправителя в **контакт** (телефон / username / external id);
   - сохраняет сообщение (дубликаты отсекаются по `pcId:source:id`);
   - шлёт **вебхук** и запускает **ИИ-анализ** (если включено).
5. **Кабинет** обновляет «Ленту» (опрос каждые 5 с).

**Что не парсится:** исходящие сообщения (только `direction: in`), пустой текст без вложений, контакты с тегом `exclude`, номера/username из «Исключений» в настройках.

**Задержка:** обычно 1–5 секунд от появления сообщения в Chrome до ленты.

---

## 17. Ответы из кабинета

Ответ идёт **обратно тем же путём**: кабинет → сервер → WebSocket → агент → Chrome → мессенджер.

1. **Лента сообщений** → кнопка **«Ответить»** у нужного сообщения.
2. Введите текст (можно **«Вставить черновик ИИ»**, если OpenRouter включён).
3. **Отправить** — сервер шлёт команду `command.reply` на **ваш онлайн-ПК**.
4. Агент вводит текст в открытый чат в Chrome (тот же `chatId` и `source`).

**Требования:**

- ПК статус **«онлайн»** в «ПК и аккаунты»;
- Chrome с этим мессенджером открыт и авторизован;
- вкладка чата доступна агенту (не закрыта).

Если ПК офлайн — появится ошибка «PC offline».

---

## 18. Исключение контактов из парсинга

Настройка **только через личный кабинет** (отдельная страница на ПК не нужна).

### Способ 1 — контакт уже в ленте

**Контакты** → найдите человека → **«Исключить из парсинга»**.

Ставится тег `exclude`. Новые сообщения от него **не сохраняются**, вебхуки и ИИ не вызываются.

### Способ 2 — заранее (до первого сообщения)

**Настройки → Исключения из парсинга:**

- телефоны (по одному на строку, цифры);
- username (без `@`, по одному на строку).

### Способ 3 — отключить целый мессенджер

**Настройки → Источники** — снять галочку с Telegram / WhatsApp и т.д.

---

## 19. Удаление Most с ПК

Остановить автоподъём и процессы, затем удалить файлы.

### Windows

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\uninstall-agent.ps1
```

Скрипт:

- удаляет задачу **MostAgent** (автозапуск);
- останавливает процессы node (агент) и Chrome профиля Most.

**Вручную удалите:**

- `%LOCALAPPDATA%\Most` — профиль Chrome, логи, очередь;
- папку проекта, например `C:\projects\most.neeklo.ru`.

**В кабинете:** «ПК и аккаунты» → **Удалить** (чтобы token перестал действовать).

### Linux

```bash
bash deploy/linux/uninstall-agent.sh
rm -rf ~/.most ~/most.neeklo.ru
```

### macOS

```bash
bash deploy/macos/uninstall-agent.sh
rm -rf ~/.most ~/most.neeklo.ru
```

После удаления сообщения перестанут поступать; старые останутся в кабинете до удаления ПК/аккаунта.

---

## Файлы в репозитории

| Путь | Назначение |
|------|------------|
| `deploy/windows/*.ps1` | Windows: Chrome, агент, autostart |
| `deploy/linux/*.sh` | Linux |
| `deploy/macos/*.sh` | macOS |
| `packages/agent/config/agent.json` | Конфиг ПК (локально, не в git) |
| `docs/CURSOR-AGENT-PROMPT.md` | Промпт для автоматической установки через Cursor |
| `deploy/windows/uninstall-agent.ps1` | Остановка autostart и процессов (Windows) |
| `deploy/linux/uninstall-agent.sh` | То же для Linux |
| `deploy/macos/uninstall-agent.sh` | То же для macOS |

**Документация на сайте:** [https://most.neeklo.ru/#docs](https://most.neeklo.ru/#docs)
