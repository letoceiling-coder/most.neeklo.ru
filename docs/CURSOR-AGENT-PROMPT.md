# Промпт Cursor Agent — установка Most на новый ПК

Скопируйте блок **«ПРОМПТ»** целиком в Cursor (режим **Agent**) на компьютере, где нужно подключить агент.

**Персональный промпт (рекомендуется):** в кабинете **«Мой ПК» → «Инструкция»** — уже подставлены `pcId`, `token` и ваш `agent.json`. Пользователю не нужно создавать ПК через API повторно.

**Документация:** [docs/SETUP.md](./SETUP.md) · **Сайт:** [https://most.neeklo.ru/#docs](https://most.neeklo.ru/#docs)

---

## Перед запуском

Подготовьте (или дайте агенту спросить один раз):

| Данные | Пример |
|--------|--------|
| Email кабинета | `user@company.ru` (выдаёт администратор) |
| Пароль кабинета | `***` |
| URL сервиса | `https://most.neeklo.ru` |
| Путь к репозиторию | `C:\projects\most.neeklo.ru` или `~/most.neeklo.ru` |
| Git-репозиторий | `https://github.com/letoceiling-coder/most.neeklo.ru.git` |
| ОС | Windows 10/11 · Linux · macOS |

Агент **не может** за вас: WhatsApp QR, 2FA Instagram/VK, SMS Telegram — попросит войти в Chrome и дождётся «готово».

---

## ПРОМПТ (скопировать отсюда)

```
Задача: с нуля установить и запустить Most PC-агент на ЭТОМ компьютере для безопасного подключения к https://most.neeklo.ru.

Most — мост «ПК пользователя ↔ облако»: Chrome с мессенджерами + локальный агент → исходящий WSS wss://most.neeklo.ru/agent. Порты на ПК открывать не нужно.

=== ДАННЫЕ (заполни или спроси у пользователя один раз) ===
OS=                          # windows | linux | macos
MOST_URL=https://most.neeklo.ru
USER_EMAIL=                  # email личного кабинета (НЕ admin без домена)
USER_PASSWORD=               # пароль от кабинета (выдаёт администратор)
PROJECT_ROOT=                # напр. C:\projects\most.neeklo.ru или ~/most.neeklo.ru
GIT_REPO=https://github.com/letoceiling-coder/most.neeklo.ru.git
PC_ID=                       # если пусто — создай через API, напр. pc-<hostname>
NODE_EXE=                    # если node не в PATH — полный путь

Документация в репо: docs/SETUP.md
Скрипты: deploy/windows/* (Windows), deploy/linux/* (Linux), deploy/macos/* (macOS)

=== ПРИНЦИПЫ ===
- Каждый пользователь видит только СВОИ ПК — логин по email+пароль
- ПК создаётся в кабинете ДО запуска агента (POST /v1/pcs)
- agent.json хранит pcId+token локально — НЕ коммитить
- Автозапуск — незаметный: Chrome minimized, без консольных окон, лог в ~/.most/logs или %LOCALAPPDATA%\Most\logs
- Если CDP :9222 уже работает — НЕ запускать второй Chrome

=== ПЛАН (выполни полностью, не останавливайся на полпути) ===

1. ОКРУЖЕНИЕ
   - Определи ОС
   - node -v (>= 20), npm -v; если нет Node — сообщи пользователю ссылку nodejs.org
   - Проверь Google Chrome / Chromium
   - Если PROJECT_ROOT нет — git clone https://github.com/letoceiling-coder/most.neeklo.ru.git в PROJECT_ROOT
   - cd PROJECT_ROOT

2. СБОРКА
   - npm install
   - npm run build:shared && npm run build:agent

3. КАБИНЕТ — ПК И ТОКЕН
   - POST {MOST_URL}/v1/auth/login  body: {"email":"USER_EMAIL","password":"USER_PASSWORD"}
   - Получи Bearer token
   - Если PC_ID пуст: POST {MOST_URL}/v1/pcs  Authorization: Bearer  body: {"id":"PC_ID","name":"..."}
   - Сохрани pcId и token

4. КОНФИГ agent.json
   - packages/agent/config/agent.json:
     {
       "pcId": "<PC_ID>",
       "token": "<TOKEN>",
       "vpsWsUrl": "wss://most.neeklo.ru/agent",
       "vpsHttpUrl": "https://most.neeklo.ru",
       "chromeCdpEndpoint": "http://127.0.0.1:9222",
       "agentVersion": "1.0.0",
       "useCdpLock": false,
       "sources": ["telegram","whatsapp","vk","max","instagram","avito"]
     }

5. CHROME + ВКЛАДКИ (по ОС)

   Windows:
     powershell -ExecutionPolicy Bypass -File deploy\windows\start-chrome-debug.ps1
     powershell -ExecutionPolicy Bypass -File deploy\windows\open-messenger-tabs.ps1

   Linux:
     chmod +x deploy/linux/*.sh
     bash deploy/linux/start-chrome-debug.sh 9222
     bash deploy/linux/open-messenger-tabs.sh 9222

   macOS:
     chmod +x deploy/macos/*.sh deploy/linux/*.sh
     bash deploy/macos/start-chrome-debug.sh
     bash deploy/macos/open-messenger-tabs.sh

   Проверка CDP: curl http://127.0.0.1:9222/json/version

6. АВТОРИЗАЦИЯ МЕССЕНДЖЕРОВ (интерактивно)
   Сообщи пользователю: «В Chrome профиля Most войдите во все мессенджеры (один раз):»
   • Telegram  https://web.telegram.org/a/
   • MAX       https://web.max.ru/
   • VK        https://vk.com/im
   • Avito     https://www.avito.ru/profile/messenger
   • Instagram https://www.instagram.com/direct/inbox/
   • WhatsApp  https://web.whatsapp.com/ (QR с телефона)
   Дождись ответа «готово»

7. ЗАПУСК АГЕНТА

   Windows:
     powershell -ExecutionPolicy Bypass -File deploy\windows\start-agent.ps1

   Linux/macOS:
     bash deploy/linux/start-agent.sh   # или deploy/macos/start-agent.sh

   В логах должны быть: Connected to Chrome over CDP, Connected to VPS

8. ПРОВЕРКА
   - curl {MOST_URL}/health → ok:true
   - GET {MOST_URL}/v1/pcs с Bearer → этот PC status online
   - Попроси тестовое входящее сообщение → Лента в кабинете

9. АВТОЗАПУСК (спроси пользователя «включить незаметный автозапуск?»)

   Windows (Chrome minimized, без окон, лог agent.log):
     powershell -ExecutionPolicy Bypass -File deploy\windows\install-agent-autostart.ps1 -ProjectRoot "<PROJECT_ROOT>"

   Linux:
     bash deploy/linux/install-autostart.sh "<PROJECT_ROOT>"

   macOS:
     bash deploy/macos/install-autostart.sh "<PROJECT_ROOT>"

10. ИТОГ для пользователя
    - pcId, путь agent.json
    - статус online в кабинете
    - где лог: %LOCALAPPDATA%\Most\logs\agent.log (Win) или ~/.most/logs/agent.log
    - напоминание: не удалять профиль Chrome Most; при проблемах — docs/SETUP.md §15

Ограничения:
- Не менять VPS/nginx без явной просьбы
- Не коммить agent.json и пароли
- Не использовать admin@most.local если пользователь — обычный клиент (нужен его email)
- При ошибке CDP — перезапустить start-chrome-debug, не создавать дубликат Chrome
```

---

## Быстрый промпт (ПК уже настроен, нужен только перезапуск)

```
На этом ПК уже есть Most в PROJECT_ROOT=<путь>.
1) Если CDP не отвечает — start-chrome-debug (Windows/Linux/macOS по ОС)
2) open-messenger-tabs если вкладок нет
3) start-agent
4) GET https://most.neeklo.ru/v1/pcs — PC online
Email: <email>  Пароль: <пароль>  pcId: <если известен>
```

---

## Промпт для администратора (создать пользователя + инструкцию клиенту)

```
Я администратор Most на https://most.neeklo.ru.
1) Войди как admin@most.local (пароль спрошу / из .env сервера)
2) Создай пользователя: email=<>, имя=<>, пароль=<>
3) Выведи клиенту краткую инструкцию: URL, email, пароль, ссылка на https://most.neeklo.ru/#docs
4) Не показывай пароль admin в ответе
```

---

## Что агент делает автоматически

- Сборка проекта и `agent.json`
- Регистрация ПК через API
- Запуск Chrome CDP и вкладок
- Запуск агента с автоперезапуском
- Установка незаметного autostart (по согласию)
- Проверка health и статуса online

## Что только человек

- Сканирование WhatsApp QR
- 2FA / SMS в мессенджерах
- Выдача email/пароля клиенту (роль администратора)
