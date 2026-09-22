# SwapToy UI

React (Vite + React Router + Tailwind). Не зависит от бэкенда как от npm-пакета: ходит в API по HTTP.

## Запуск

Сначала поднимите [backend](../backend/README.md) на порту 3001.

```bash
cd frontend
cp .env.example .env          # Windows: Copy-Item .env.example .env
npm install
npm run dev
```

UI: http://localhost:5173

В режиме `dev` Vite проксирует `/api` и `/uploads` на `VITE_API_URL`. Браузер остаётся same-origin, cookie и CORS не мешают.

## Env

`frontend/.env`:

```
VITE_API_URL=http://localhost:3001
```

- **dev** — только цель proxy, fetch идёт на `/api/...`
- **production build** — если задано, UI вызывает этот URL напрямую; если пусто, запросы relative (UI и API на одном origin)

## Команды

```bash
npm run dev        # http://localhost:5173
npm run build      # dist/
npm run preview    # раздать dist, proxy тот же
```

Другой порт API — поменяйте `VITE_API_URL`.

## Демо

http://localhost:5173/login — `aliya` / `bobur` / `dilnoza` / `admin`, пароль `demo1234`.
