import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { ItemCard, type ItemCardData } from "@/components/ItemCard";
import { TRUST_LEVELS } from "@/lib/constants";
import { Link, useNavigate } from "react-router-dom";
import {
  getTelegramInitData,
  isTelegramMiniApp,
  requestTelegramWidgetAuth,
} from "@/lib/telegram";

export default function ProfilePage() {
  const { user, loading, logout, refresh, loginTelegram, telegram } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ItemCardData[]>([]);
  const [notifications, setNotifications] = useState<
    { id: string; title: string; body: string; read: boolean; createdAt: string }[]
  >([]);
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [securityMsg, setSecurityMsg] = useState("");
  const [securityErr, setSecurityErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    api<{ items: ItemCardData[] }>(`/api/items?ownerId=${user.id}`).then((d) =>
      setItems(d.items),
    );
    api<{ notifications: typeof notifications }>("/api/notifications").then((d) =>
      setNotifications(d.notifications),
    );
  }, [user]);

  if (!user) return null;

  const trust =
    TRUST_LEVELS[user.trustLevel as keyof typeof TRUST_LEVELS]?.label ||
    user.trustLevel;

  return (
    <div className="space-y-6 animate-rise sm:space-y-8">
      <section className="flex flex-col gap-4 rounded-2xl bg-forest p-4 text-cream sm:flex-row sm:flex-wrap sm:items-center sm:rounded-3xl sm:p-6">
        <img
          src={user.avatarUrl || ""}
          alt=""
          className="h-16 w-16 rounded-full object-cover ring-4 ring-cream/20 sm:h-20 sm:w-20"
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl sm:text-3xl">{user.name}</h1>
          <p className="text-sm text-cream/70">
            @{user.username} · {user.city} · {trust}
          </p>
          <p className="mt-1 text-sm text-cream/60">
            ★ {(user.rating ?? 0).toFixed(1)} · {user.completedTrades ?? 0} обменов
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/favorites"
            className="inline-flex min-h-10 items-center rounded-xl bg-cream/15 px-4 py-2 text-sm"
          >
            Избранное
          </Link>
          <Link
            to="/notifications"
            className="inline-flex min-h-10 items-center rounded-xl bg-cream/15 px-4 py-2 text-sm"
          >
            Алерты
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
            className="inline-flex min-h-10 items-center rounded-xl bg-cream/15 px-4 py-2 text-sm"
          >
            Выйти
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-display text-2xl text-forest">Вход и безопасность</h2>
        <p className="text-sm font-semibold text-ink/60">
          Telegram: {user.telegramLinked ? "привязан" : "не привязан"} · пароль:{" "}
          {user.hasPassword ? "задан" : "ещё нет"}
        </p>
        {securityErr && (
          <p className="text-sm font-semibold text-coral">{securityErr}</p>
        )}
        {securityMsg && (
          <p className="text-sm font-semibold text-forest">{securityMsg}</p>
        )}
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setSecurityErr("");
            setSecurityMsg("");
            try {
              await api("/api/me", {
                method: "PATCH",
                body: JSON.stringify({
                  password,
                  ...(user.hasPassword ? { currentPassword } : {}),
                }),
              });
              setPassword("");
              setCurrentPassword("");
              setSecurityMsg("Пароль сохранён. Им можно входить на сайте.");
              await refresh();
            } catch (e) {
              setSecurityErr(e instanceof Error ? e.message : "Ошибка");
            } finally {
              setBusy(false);
            }
          }}
        >
          {user.hasPassword && (
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Текущий пароль"
              className="rounded-2xl border border-ink/10 bg-cream px-4 py-3 font-semibold"
            />
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={user.hasPassword ? "Новый пароль" : "Задать пароль"}
            minLength={8}
            required
            className="rounded-2xl border border-ink/10 bg-cream px-4 py-3 font-semibold"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-ink px-4 py-3 text-sm font-extrabold text-cream disabled:opacity-60 sm:col-span-2"
          >
            {user.hasPassword ? "Сменить пароль" : "Сохранить пароль"}
          </button>
        </form>
        {!user.telegramLinked && (
          <button
            type="button"
            disabled={busy || (!isTelegramMiniApp() && !telegram.botId)}
            onClick={async () => {
              setBusy(true);
              setSecurityErr("");
              setSecurityMsg("");
              try {
                const initData = getTelegramInitData();
                if (initData) {
                  await loginTelegram({ initData });
                } else if (telegram.botId) {
                  const widget = await requestTelegramWidgetAuth(telegram.botId);
                  await loginTelegram({ telegramWidget: widget });
                } else {
                  throw new Error("Telegram-бот ещё не настроен");
                }
                setSecurityMsg("Telegram привязан к этому аккаунту");
                await refresh();
              } catch (e) {
                setSecurityErr(e instanceof Error ? e.message : "Ошибка");
              } finally {
                setBusy(false);
              }
            }}
            className="w-full rounded-full bg-[#2AABEE] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"
          >
            Привязать Telegram
          </button>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl text-forest">Уведомления</h2>
        {notifications.length === 0 ? (
          <p className="text-sm text-ink/50">Пока пусто</p>
        ) : (
          <ul className="space-y-2">
            {notifications.slice(0, 8).map((n) => (
              <li
                key={n.id}
                className="rounded-xl bg-white/70 px-4 py-3 text-sm ring-1 ring-forest/10"
              >
                <p className="font-medium">{n.title}</p>
                <p className="text-ink/60">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-forest">Мои объявления</h2>
          <Link to="/items/new" className="text-sm text-coral">
            + Добавить
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
