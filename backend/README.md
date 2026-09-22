# SwapToy API

Fastify + Prisma + SQLite. Не зависит от фронтенда: свой `package.json`, свой `.env`, свой `node_modules`.

## Запуск

```bash
cd backend
cp .env.example .env          # Windows: Copy-Item .env.example .env
npm install
npm run db:reset
npm run dev
```

- API: http://localhost:3001
- Health: http://localhost:3001/api/health
- Загрузки: http://localhost:3001/uploads/...

`db:reset` полностью пересоздаёт SQLite и заливает демо. **Локальные данные будут стёрты.**

Демо-логины: `aliya`, `bobur`, `dilnoza`, `admin` — пароль `demo1234`.

## Env

Файл `.env` (из `.env.example`):

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-me"
SESSION_COOKIE="toyswap_session"
PORT=3001
TELEGRAM_BOT_TOKEN=""
TELEGRAM_BOT_USERNAME=""
COOKIE_SECURE="false"
```

`COOKIE_SECURE=true` только за HTTPS. Локально оставляйте `false`.

Опционально `FRONTEND_DIST` — абсолютный путь к собранному SPA. Если не задан, бэкенд отдаёт `backend/public/index.html`, если файл есть. Иначе работает как чистый API.

## Команды

```bash
npm run dev           # watch
npm start             # без watch
npm run db:reset      # схема заново + сиды
npm run db:push       # схема без сброса данных
npm run db:seed       # только сиды (стирает данные сидером)
npm run db:passwords  # demo1234 демо-юзерам без пароля
npm test              # антифрод / match / auth
npm run jobs          # разово maintenance
```

## Telegram

1. Бот в [@BotFather](https://t.me/BotFather).
2. В `.env`:

```
TELEGRAM_BOT_TOKEN="123456:ABC..."
TELEGRAM_BOT_USERNAME="your_bot"
COOKIE_SECURE="true"
```

3. В BotFather:
   - `/newapp` — URL Mini App = адрес сайта
   - `/setdomain` — тот же домен (Login Widget)

Пользователь может войти логином, через Telegram, или привязать Telegram в профиле.
