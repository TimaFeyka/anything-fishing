# «Рыбалка: что угодно» в Игротеке

Источник: https://github.com/amirksusinok-art/anything-fishing, commit `c09ede6ecc95b3748ff76c9f1965dedda3300fb0`, MIT. Неизменяемые исходники и хеши 53 файлов — `miniapp/anything-fishing/upstream` и `provenance.json`. Собственные адаптеры — `integration`, воспроизводимые преобразования — `tools/anything-fishing/build.mjs`; generated runtime/client не служат каноническими исходниками.

Игра запускается через `#games/anything-fishing` и параметр `game-anything-fishing` в общей Игротеке. Использует полноэкранный контейнер, паузу аудио и сохранённый iframe. Собственные игровые разделы остаются внутри игры; шапка/навигация Мироздания скрыты. Возврат — кнопка «Игротека» и штатный Back с закрытием верхнего игрового диалога.

Русский интерфейс, 113 находок и семь локаций сохранены из исходной игры. Платёжные маршруты Stars, новый Telegram webhook и серверная загрузка карточек удалены из адаптированной сборки. Поделиться можно чистой публичной ссылкой существующего бота Telegram/MAX либо локальной карточкой через браузер. Raw initData, cookie и пользовательские токены не передаются в ссылки.

Hosted Worker `/api/anything-fishing/*` использует существующую проверку miniapp-сессии/подписки. Сервис принимает исключительно подписанную Worker identity: внутренний ID, platform, allowlisted origin, issuer/audience, timestamp, одноразовый nonce, method/path/query/body hash. Подпись создаётся отдельным `FISHING_PROXY_SECRET`; секреты ботов/CRM не нужны. Cookie/Authorization/initData браузера не форвардятся. WS также проходит Worker и подписанную проверку до Upgrade; URL содержит только castId.

Node24 runtime работает одной репликой за существующим HTTPS/WSS ingress. `FISHING_BACKEND_URL` и секрет — новые точечные Site env entries, остальные сохраняются. Своя схема `anything_fishing` в существующей PostgreSQL и ограниченная роль. При недоступности PG production не переходит на файловое хранилище. Advisory locks обеспечивают единственный процесс и последовательные транзакции мутаций/наград. Повторный resolve и поздние WS-записи не создают второй улов. Живой бой ведётся сервером; незавершённый бой может прерваться при перезапуске, завершённые результаты и инвентарь сохраняются.

Новая migration `migrations/anything-fishing/0001_game.sql` применяется администратором явно. Она не входит в hosted migration journal; старые pending SQL не применяются. Source integration и fork не означают публикацию. Перед публикацией того же Site обязательна квитанция OpenClaw текущей сессии `agent:server-admin:main`: пакет/DDL/grants, identity rejection, HTTP/WS, persistence, restart, прежние сервисы/bindings. n8n не участвует.

Локальные команды:

```sh
MIROZDANIE_BUILD_PREFIX=fishing- ./tools/with-node node tools/project.mjs prepare:miniapp
./tools/with-node node --test .build/fishing-miniapp/tests/anything-fishing-auth.test.mjs
./tools/with-node node .build/anything-fishing-runtime/scripts/engine-test.mjs
```

Builder устанавливает pinned game-зависимости в `.build/anything-fishing-runtime` через `npm ci --ignore-scripts`. Для loopback QA дополнительно явно задаются `FISHING_LOCAL_QA=true`, изолированный файл состояния и тестовый signing secret. Production их не использует. Backend release содержит compiled server, lockfile, MIT, отдельную неприменённую migration, unit/env templates и manifest. Администратор ведёт runtime/ingress/PG/backup, локальный Codex — исходники, проверки и согласованную hosted-синхронизацию. Квитанции — `docs/provenance/anything-fishing-20261024`, QA — `qa-reports/anything-fishing`.
