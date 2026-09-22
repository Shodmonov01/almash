# SwapToy — платформа обмена игрушками

MVP+ по [TZ.md](./TZ.md): обмен игрушками и детскими аксессуарами **без денег, продаж и доплат**.

## Стек

- **Next.js 15** (App Router) — UI + API
- **Prisma 5 + SQLite** — данные (легко заменить на PostgreSQL)
- **JWT cookie** — сессия (демо-вход + Telegram `initData` HMAC)
- **sharp** — watermark + perceptual hash
- **vitest** — unit-тесты антифрода / match / transitions

## Быстрый старт

```bash
npm install
npm run db:reset
npm run dev
```

Демо-пользователи: `aliya`, `bobur` (онбординг), `dilnoza`, `admin`.

```bash
npm test          # unit-тесты
npm run jobs      # expire offers + meeting reminders
```

## Что умеет (углублённый MVP)

- Объявления, поиск, лента «Подходит мне» со scoring
- Предложения N⇄M, **UI изменения состава**, версии + frozen snapshots
- Чат с антифродом (доплата/карты/контакты), rate limits, risk score
- Загрузка фото с watermark `SwapToy · itemId` + duplicate phash → moderation queue
- Встречи, одноразовые коды/QR, двустороннее подтверждение
- Таймауты предложений, напоминания 24ч/2ч, handoff reminders (`/api/jobs`)
- Жалобы, споры, админка (users/items/trades/disputes/reports/**moderation**/jobs)
- Онбординг «без денег», уведомления, Telegram auth helper

## Принцип «без денег»

В `Trade` нет `price` / `amount` / `currency`. Модель: `[A1, A2] ⇄ [B1]`.

## Структура

- `src/lib/services` — trades, media, matching, rate-limit, telegram-auth
- `src/lib/jobs` — maintenance (expiry/reminders)
- `src/app/api` — REST
- `vitest/` — тесты
