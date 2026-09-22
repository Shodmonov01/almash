# SwapToy — платформа обмена игрушками

Обмен игрушками и детскими аксессуарами **без денег, продаж и доплат**. ТЗ: [TZ.md](./TZ.md).

Это **два независимых приложения**, как `client/` и `server/` в synapse-animals: у каждого свой `package.json`, свои зависимости, свой запуск. Общего npm workspace нет.

```
almash/
  frontend/   React SPA (Vite)     → http://localhost:5173
  backend/    Fastify + Prisma     → http://localhost:3001
```

Фронт знает про бэк только через `VITE_API_URL`. Бэк не импортирует код фронта.

## Требования

- Node.js 20+
- npm 10+
- Git

База — SQLite внутри `backend/`. PostgreSQL не нужен.

## Запуск локально

Нужны **два терминала**. Порядок: сначала API, потом UI.

### Backend

```bash
cd backend
cp .env.example .env          # Windows: Copy-Item .env.example .env
npm install
npm run db:reset
npm run dev
```

API: http://localhost:3001  
Health: http://localhost:3001/api/health

Подробности: [backend/README.md](./backend/README.md).

### Frontend

```bash
cd frontend
cp .env.example .env          # Windows: Copy-Item .env.example .env
npm install
npm run dev
```

UI: http://localhost:5173

В dev Vite проксирует `/api` и `/uploads` на `VITE_API_URL` (по умолчанию `http://localhost:3001`), поэтому CORS не мешает.

Подробности: [frontend/README.md](./frontend/README.md).

### Демо-вход

http://localhost:5173/login

| Логин | Заметка |
| --- | --- |
| `aliya` | обычный пользователь |
| `bobur` | онбординг не пройден |
| `dilnoza` | обычный пользователь |
| `admin` | админ |

Пароль у всех: **`demo1234`**

## Как они связаны

| | Frontend | Backend |
| --- | --- | --- |
| Зависимости | свой `npm install` | свой `npm install` |
| Env | `frontend/.env` → `VITE_API_URL` | `backend/.env` → БД, JWT, Telegram |
| Dev | Vite + proxy | `tsx watch src/server.ts` |
| Прод | статика `dist/` | REST + `/uploads`; опционально отдаёт `backend/public/` |

Бэкенд **не** смотрит в папку `frontend/`. Если на одном порту нужно отдать и UI, скопируйте собранный фронт в `backend/public/` (так делает серверный деплой).

## Telegram Mini App

Оба канала — одно приложение и одни аккаунты. Настройка бота — в [backend/README.md](./backend/README.md).

## Автодеплой (ветка `main`)

Cron на VPS тянет `origin/main`, собирает фронт и бэк **отдельно**, копирует `frontend/dist` → `backend/public` и поднимает API на `:8081`. GitHub Secrets не нужны. Сиды не запускаются.

`npm run db:reset` на сервере не запускайте: стирает базу.

## Принцип «без денег»

В `Trade` нет `price` / `amount` / `currency`. Модель: `[A1, A2] ⇄ [B1]`.
