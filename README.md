# SwapToy — платформа обмена игрушками

MVP+ по [TZ.md](./TZ.md): обмен игрушками и детскими аксессуарами **без денег, продаж и доплат**.

## Стек

- **Frontend** — чистый React (Vite + React Router + Tailwind)
- **Backend** — Fastify + Prisma + SQLite
- **Сессия** — JWT в cookie + `Authorization: Bearer` (сайт и Telegram Mini App)

Папки разделены: `frontend/` и `backend/`. Один и тот же фронт открывается как сайт и как Mini App.

## Быстрый старт

```bash
npm install
npm run db:reset
npm run dev
```

- UI: http://localhost:5173
- API: http://localhost:3001

Демо-вход: `aliya`, `bobur` (онбординг), `dilnoza`, `admin`  
Пароль у всех: `demo1234`

На экране входа также есть **«Войти через Telegram»** (Mini App `initData` или Login Widget на сайте).

```bash
npm test          # unit-тесты антифрода / match / auth
npm run db:seed   # только сиды (стирает данные)
npm run db:passwords  # проставить demo1234 демо-юзерам без пароля, данные не трогает
```

## Telegram Mini App + сайт

Оба канала — одно приложение и одни аккаунты.

1. Создайте бота в [@BotFather](https://t.me/BotFather).
2. В `backend/.env` укажите:

```
TELEGRAM_BOT_TOKEN="123456:ABC..."
TELEGRAM_BOT_USERNAME="your_bot"
COOKIE_SECURE="true"
```

`COOKIE_SECURE=true` только если сайт открывается по **HTTPS**.

3. В BotFather:
   - `/newapp` — URL Mini App = адрес сайта, например `https://your-domain/`
   - `/setdomain` — тот же домен (нужен для кнопки Login Widget на сайте)

4. Пользователь может:
   - зарегистрироваться логином/паролем;
   - войти через Telegram;
   - в профиле привязать Telegram к уже существующему аккаунту или задать пароль, если сначала вошёл через Telegram.

## Структура

- `frontend/` — React SPA
- `backend/` — REST API, Prisma, загрузки, джобы
- `TZ.md` — техническое задание

## Автодеплой (ветка `main`)

На сервере cron каждые 2 минуты смотрит `origin/main`. Если коммит новый и в репо уже `frontend/` + `backend/` — собирает и перезапускает `http://IP:8081`. GitHub Secrets не нужны. Сиды не запускаются.

После этого деплоя схема обновится через `prisma db push`. Если на сервере уже есть демо-пользователи без пароля, один раз выполните `npm run db:passwords`.

## Принцип «без денег»

В `Trade` нет `price` / `amount` / `currency`. Модель: `[A1, A2] ⇄ [B1]`.
