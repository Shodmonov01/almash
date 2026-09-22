"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { ItemCard, type ItemCardData } from "@/components/ItemCard";
import { TRUST_LEVELS } from "@/lib/constants";

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ItemCardData[]>([]);
  const [notifications, setNotifications] = useState<
    { id: string; title: string; body: string; read: boolean; createdAt: string }[]
  >([]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
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
            href="/favorites"
            className="inline-flex min-h-10 items-center rounded-xl bg-cream/15 px-4 py-2 text-sm"
          >
            Избранное
          </Link>
          <Link
            href="/notifications"
            className="inline-flex min-h-10 items-center rounded-xl bg-cream/15 px-4 py-2 text-sm"
          >
            Алерты
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
            className="inline-flex min-h-10 items-center rounded-xl bg-cream/15 px-4 py-2 text-sm"
          >
            Выйти
          </button>
        </div>
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
          <Link href="/items/new" className="text-sm text-coral">
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
