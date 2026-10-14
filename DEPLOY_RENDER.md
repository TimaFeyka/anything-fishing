# Деплой ANYTHING FISHING на Render

Инструкция от нуля до работающей Telegram Mini App. Проект разворачивается **одним Web Service**
(он же отдаёт собранный фронтенд) плюс **PostgreSQL**.

---

## 1. Что понадобится

| Что | Зачем | Где взять |
|---|---|---|
| Аккаунт GitHub | репозиторий с кодом | github.com |
| Аккаунт Render | хостинг | render.com (регистрация через GitHub) |
| Токен бота | проверка `initData`, платежи Stars | `@BotFather` → `/newbot` |
| Юзернейм бота | реферальные ссылки | `@BotFather` → `/mybots` |
| Имя Mini App (short name) | ссылка `t.me/<bot>/<app>` | `@BotFather` → `/newapp` |
| Секрет сессии | подпись токенов игроков | любая случайная строка 32+ символов |

Обязательные переменные: `TELEGRAM_BOT_TOKEN`, `SESSION_SECRET`, `DATABASE_URL`, `ALLOW_DEV_AUTH=0`.
Остальные имеют безопасные значения по умолчанию.

---

## 2. Вариант A — Blueprint (рекомендуется, 3 клика)

В репозитории уже лежит [`render.yaml`](render.yaml), который описывает Web Service и базу данных.

1. Откройте <https://dashboard.render.com/blueprints> → **New Blueprint Instance**.
2. Выберите репозиторий `anything-fishing` (ветка `main`) → **Connect**.
3. Render покажет план: сервис `anything-fishing` и базу `anything-fishing-db`.
   Нажмите **Apply**.
4. Дождитесь окончания первого деплоя (сборка занимает 2–4 минуты).
5. Откройте сервис и заполните переменные, помеченные `sync: false`. Форма **Apply** спросит их
   сразу при создании Blueprint; если пропустили — сервис → **Environment** → *Environment Variables* → **+ Add Environment Variable**:

   | Key | Значение |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | `123456:AA…` от BotFather |
   | `TELEGRAM_BOT_USERNAME` | `my_fishing_bot` (без `@`) |
   | `TELEGRAM_APP_SHORT_NAME` | имя Mini App из `/newapp`, например `fish` |
   | `PUBLIC_URL` | `https://anything-fishing.onrender.com` (ваш адрес Render) |

6. **Save Changes** → Render перезапустит сервис автоматически.

`DATABASE_URL`, `PGSSL=0`, `SESSION_SECRET`, `ALLOW_DEV_AUTH=0`, лимиты экономики и `NODE_VERSION=22`
Blueprint подставляет сам.

---

## 3. Вариант B — вручную

### 3.1 База данных

1. Dashboard → **New +** → **Postgres** (или <https://dashboard.render.com/new/database>).
2. Name: `anything-fishing-db`, Region — тот же, что у сервиса, Plan: `Basic-256mb` или `Free`.
3. После создания возьмите строку подключения: на странице базы — кнопка **Connect** в правом верхнем углу
   (там же отдельно **Internal Database URL** и **External Database URL**),
   либо блок внутренних реквизитов на вкладке **Info** этой базы.
   Для сервиса на Render берите **Internal Database URL** — быстрее и не выходит в интернет.

### 3.2 Web Service

Dashboard → **New +** → **Web Service** → выберите репозиторий. Настройки:

| Поле | Значение |
|---|---|
| Name | `anything-fishing` |
| Region | Frankfurt (ближе к аудитории) |
| Branch | `main` |
| Runtime | `Node` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Auto-Deploy | `Yes` |
| Instance Type | `Starter` или `Free` |

### 3.3 Где находятся переменные окружения

**Переменные сервиса:** Dashboard → выберите сервис `anything-fishing` → в левом меню **Environment**
→ блок **Environment Variables** → кнопка **+ Add Environment Variable** → указать *Key* и *Value*.
Там же кнопка **Add from .env** — можно загрузить переменные пачкой из локального файла
(`.env.example` из репозитория подходит: часть значений Render перезапишет своими).

Сохранять можно тремя способами (выпадающий список у кнопки сохранения):

* **Save, rebuild, and deploy** — пересобрать и развернуть (нужно, если меняли код или сборку);
* **Save and deploy** — переиспользовать текущую сборку, просто перезапустить сервис с новыми значениями
  (**это то, что нужно для переменных окружения**);
* **Save only** — сохранить без деплоя: сервис подхватит значения только при следующем деплое.

**Переменные базы данных** отдельно не редактируются: строка подключения берётся из самой базы
(кнопка **Connect** на её странице) и передаётся сервису либо через переменную `DATABASE_URL`,
либо автоматически через `fromDatabase` в `render.yaml`.

Другие места, где могут лежать переменные:

| Где | Путь в Dashboard | Когда нужно |
|---|---|---|
| Переменные сервиса | сервис → **Environment** → *Environment Variables* | основной способ (наши 4 переменные) |
| Группы переменных | левое меню аккаунта → **Environment Groups** | если переменные общие для нескольких сервисов |
| Секретные файлы | сервис → **Environment** → *Secret Files* | если нужен файл, а не переменная (у нас не требуется, лимит 1 МБ) |
| Реквизиты Postgres | база → **Connect** (справа сверху) или **Info** | получить `DATABASE_URL` |

Если сервис создавался через Blueprint, переменные с `sync: false` в `render.yaml`
(`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_APP_SHORT_NAME`, `PUBLIC_URL`) Render
спрашивает прямо в форме **Apply** при создании Blueprint. Если пропустить этот шаг — значения
останутся пустыми, и их надо будет добавить на странице **Environment** того же сервиса.

### 3.4 Список переменных

| Key | Значение | Обязательно |
|---|---|---|
| `NODE_ENV` | `production` | да |
| `NODE_VERSION` | `22` | да |
| `DATABASE_URL` | Internal Database URL из 3.1 | да |
| `PGSSL` | `0` (для Internal URL) | да |
| `SESSION_SECRET` | случайная строка 32+ символов | да |
| `ALLOW_DEV_AUTH` | `0` | да |
| `TELEGRAM_BOT_TOKEN` | токен от BotFather | да |
| `TELEGRAM_BOT_USERNAME` | юзернейм бота без `@` | да |
| `TELEGRAM_APP_SHORT_NAME` | short name Mini App | да |
| `PUBLIC_URL` | `https://<имя-сервиса>.onrender.com` | рекомендуется |
| `NPC_FULL_LIMIT` / `NPC_HALF_LIMIT` / `NPC_HALF_MULT` | `100` / `100` / `0.5` | опционально |
| `SERIAL_RETURN_DAYS` | `60` | опционально |
| `MARKET_FEE` | `0.05` | опционально |
| `STARS_ENABLED` | `1` | опционально |
| `TELEGRAM_WEBHOOK_SECRET` | случайная строка (для webhook) | опционально |
| `ADMIN_KEY` | случайная строка (для `/api/admin/sweep-serials`) | опционально |

> `SESSION_SECRET` **сгенерируйте заново**. Blueprint умеет `generateValue: true`,
> при ручной настройке вставьте свой: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

`PORT` задавать не нужно — Render подставляет его сам, сервер читает `process.env.PORT`.

---

## 4. Подключение Telegram

1. `@BotFather` → `/newbot` → скопируйте токен в `TELEGRAM_BOT_TOKEN`.
2. `@BotFather` → `/newapp` → выберите бота:
   * **Title**: `ANYTHING FISHING`
   * **Description**: как в README
   * **Photo**: 640×360 (любая стилизованная картинка, не из игры)
   * **Web App URL**: `https://<имя-сервиса>.onrender.com`
   * **Short name**: например `fish` → в `TELEGRAM_APP_SHORT_NAME`
3. `@BotFather` → `/mybots` → ваш бот → **Bot Settings → Menu Button → Configure menu button**:
   указать тот же URL, чтобы кнопка открывала игру.
4. Откройте мини-приложение из чата с ботом — `initData` проверится автоматически.

### Webhook для платежей Stars (нужен для продажи косметики)

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "content-type: application/json" \
  -d '{"url":"https://<имя-сервиса>.onrender.com/api/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
```

Проверить: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.
Награда выдаётся только после `successful_payment` от Telegram; без webhook покупки
не подтверждаются и косметика не активируется.

---

## 5. Чек-лист после деплоя

```bash
# 1. Сервис жив и подключён к базе
curl -s https://<имя-сервиса>.onrender.com/api/health
# Правильный ответ:
# {"ok":true,"store":"postgres","storage":"postgres","db":"postgres ok (N documents)",...}
#
# Если видите "storage":"file-fallback (DATABASE_URL не сработал)" — база не подключилась,
# в логах сервиса будет блок «PostgreSQL НЕДОСТУПЕН» с точной причиной и инструкцией.

# 2. Фронтенд отдаётся (должен быть HTML с #root)
curl -s https://<имя-сервиса>.onrender.com/ | head -c 200

# 3. Авторизация отключена для посторонних
curl -s -o /dev/null -w "%{http_code}\n" https://<имя-сервиса>.onrender.com/api/me   # 401
```

В приложении проверить:

- [ ] открывается из Telegram, показывается имя игрока, а не экран ошибки;
- [ ] заброс → поклёвка → мини-игра вывалов (полоса натяжения, кнопка «ДЕРЖАТЬ»);
- [ ] после вылова появляется карточка находки, предмет в инвентаре (сохраняется после перезапуска приложения);
- [ ] торговец показывает дневной лимит и продаёт обычные предметы;
- [ ] «На берег» → павильон → экспонат на базе → база видна в рейтинге;
- [ ] тактильная отдача работает на телефоне и отключается в настройках;
- [ ] в логах Render нет циклических ошибок `[api]`.

Проверка, что прогресс действительно в Postgres: выловите предмет, сделайте
**Manual Deploy → Restart service**, обновите страницу — предмет остаётся на месте.
На файловом хранилище (без `DATABASE_URL`) он бы пропал, поэтому база в проде обязательна.

---

## 6. Особенности планов Render

| План | Что важно знать |
|---|---|
| **Free (Web Service)** | сервис засыпает после ~15 минут без трафика; первый запрос после сна — 30–60 секунд. Подходит для теста, не для релиза |
| **Starter и выше** | работает круглосуточно, WebSocket стабильнее |
| **Free Postgres** | база удаляется через 30 дней после создания |
| **Basic-256mb Postgres** | подходит для небольшого живого проекта |

* **WebSocket поддерживается на всех планах** — авторитетный режим вываживания работает.
  Если соединение обрывается, клиент автоматически переходит на HTTP-режим, бой не теряется.
* **Диск эфемерный**: без `DATABASE_URL` данные живут до следующего деплоя. Для прода обязательно Postgres.
* **Zero-downtime deploy** включён по умолчанию: новая версия поднимается до остановки старой.
* Свой домен: **Settings → Custom Domains** → добавьте домен и DNS-запись `CNAME`.
  После этого обновите `PUBLIC_URL` и URL в BotFather.

---

## 7. Обновления, логи, откаты

* Пуш в `main` → Render собирает и выкладывает автоматически (`autoDeploy: true`).
* **Logs** в панели сервиса: стартовая строка `ANYTHING FISHING server on :PORT store=postgres static=yes`,
  ошибки API помечаются `[api]`, античит-события — `[anti-cheat]`, уборка серийников — `[serials]`.
* **Rollback**: Events → выберите предыдущий успешный деплой → **Rollback to this deploy**.
* Ручная проверка уборки серийных экземпляров:
  `curl -X POST https://<сервис>.onrender.com/api/admin/sweep-serials -H "x-admin-key: <ADMIN_KEY>"`.

---

## 8. Типичные проблемы

| Симптом | Причина и решение |
|---|---|
| `fatal Error: getaddrinfo ENOTFOUND base` / любой `ENOTFOUND <слово>` при старте | В `DATABASE_URL` лежит **не строка подключения**, а что-то другое (имя базы, имя переменной, обрезанный фрагмент). Нужна полная строка `postgresql://user:пароль@dpg-xxxx-a/имя_базы` из **Connect → Internal Database URL**. Начиная с версии 1.1 сервис в этом случае не падает: в логах печатается подсказка, а игра продолжает работать на файловом хранилище |
| `sh: 1: vite: not found` (сборка падает сразу после `npm install`) | Render собирает с `NODE_ENV=production`, а npm в этом режиме **не ставит devDependencies** — Vite и TypeScript лежат именно там. Решение: Build Command = `npm ci --include=dev && npm run build`. Дополнительно в репозитории есть `.npmrc` с `include=dev`, поэтому сборка проходит и с дефолтной командой Render. После правки нажмите **Clear build cache & deploy** |
| `tsc: not found` при `npm run build:server` | Та же причина, что выше: TypeScript — devDependency. Лечится тем же `--include=dev` |
| В игре всё работает, но прогресс исчезает после деплоя | `/api/health` показывает `"storage": "file-fallback (DATABASE_URL не сработал)"` — база не подключилась, смотрите в логах блок «PostgreSQL НЕДОСТУПЕН». Обычно: значение `DATABASE_URL` задано неверно, база в другом регионе или не задан `PGSSL=0` для внутреннего URL |
| `401 unauthorized`, экран «Не удалось авторизоваться» | приложение открыто в браузере, а не в Telegram, либо `ALLOW_DEV_AUTH=0`. Откройте через бота; для локальной отладки поставьте `ALLOW_DEV_AUTH=1` |
| `invalid_init_data` | `TELEGRAM_BOT_TOKEN` от другого бота. Токен и Mini App должны принадлежать одному боту |
| Healthcheck падает, сервис перезапускается | не задан `DATABASE_URL` при `NODE_ENV=production`, либо неверный `PGSSL` (для внешнего URL нужен `1`) |
| `EADDRINUSE` в логах | в коде задан фиксированный порт: не задавайте `PORT` вручную, Render подставляет свой |
| Картинки не появляются в Stories | не задан `PUBLIC_URL` (карточка генерируется на клиенте, но для Stories нужен публичный https-URL) |
| Награды не выдаются после оплаты | не установлен webhook (`setWebhook`), либо `TELEGRAM_WEBHOOK_SECRET` не совпадает с `x-telegram-bot-api-secret-token` |
| Прогресс исчез после деплоя | сервис работал без `DATABASE_URL` (файловое хранилище). Создайте Postgres и добавьте переменную |
| Mini App открывается пустым | фронтенд не собрался: проверьте, что Build Command `npm ci && npm run build`, а Start Command `npm start` |

---

## 9. Локальная проверка перед деплоем

```bash
npm ci
npm run typecheck          # типы сервера и клиента
npm test                   # 36 модульных тестов движка
npm run test:balance       # баланс мини-игры (детерминированные сиды)
npm run build
ALLOW_DEV_AUTH=1 PORT=8787 npm start
# в другом терминале:
npm run test:api -- http://127.0.0.1:8787
npm run test:ws  -- http://127.0.0.1:8787
npm run test:ui  -- http://127.0.0.1:8787/ ./shots 390 844 fight
```

Все наборы должны завершиться без провалов — тогда деплой на Render пройдёт без сюрпризов.
