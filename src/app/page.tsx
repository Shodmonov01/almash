"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { ItemCard, type ItemCardData } from "@/components/ItemCard";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { CATEGORIES } from "@/lib/constants";

type Feed = "new" | "nearby" | "for_me";

export default function HomePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ItemCardData[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [feed, setFeed] = useState<Feed>("new");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    params.set("feed", feed);
    if (user?.city) params.set("meCity", user.city);
    if (user?.id) params.set("meId", user.id);
    setLoading(true);
    api<{ items: (ItemCardData & { matchScore?: number; matchReasons?: string[] })[] }>(
      `/api/items?${params}`,
    )
      .then((d) => setItems(d.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [q, category, feed, user?.city, user?.id]);

  return (
    <div className="space-y-5 sm:space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-forest text-cream animate-rise sm:rounded-3xl">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative grid gap-5 px-4 py-7 sm:gap-6 sm:px-6 sm:py-10 md:grid-cols-[1.2fr_0.8fr] md:px-10 md:py-14">
          <div className="space-y-3 sm:space-y-4">
            <p className="font-display text-3xl leading-tight sm:text-4xl md:text-5xl">
              SwapToy
            </p>
            <h1 className="max-w-xl text-base leading-snug text-cream/90 sm:text-lg md:text-xl">
              Безопасный обмен игрушками и аксессуарами. Без продаж, без доплат,
              только вещи на вещи.
            </h1>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:gap-3 sm:pt-2">
              <Link
                href="/items/new"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-coral px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-coral/30 transition hover:brightness-110"
              >
                Добавить игрушку
              </Link>
              <Link
                href="/matches"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cream/15 px-5 py-3 text-sm font-medium text-cream ring-1 ring-cream/30 backdrop-blur transition hover:bg-cream/25"
              >
                Найти взаимный обмен
              </Link>
            </div>
          </div>
          <div className="hidden items-end justify-end md:flex">
            <div className="animate-softpulse rounded-2xl bg-cream/10 p-6 ring-1 ring-cream/20 backdrop-blur">
              <Sparkles className="mb-3 text-sand" />
              <p className="font-display text-2xl">1 ⇄ 1 · N ⇄ M</p>
              <p className="mt-2 text-sm text-cream/70">
                Несколько предметов в одной сделке. QR-подтверждение. Без денег
                в архитектуре.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3 animate-rise sm:space-y-4" style={{ animationDelay: "80ms" }}>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск…"
              className="w-full rounded-xl border border-forest/10 bg-white/80 py-3 pl-10 pr-4 outline-none ring-forest/30 focus:ring-2 sm:text-sm"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-forest/10 bg-white/80 px-4 py-3 outline-none sm:w-auto sm:text-sm"
          >
            <option value="">Все категории</option>
            {Object.keys(CATEGORIES).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
          {(
            [
              ["new", "Новые"],
              ["nearby", "Рядом"],
              ["for_me", "Подходит мне"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFeed(id)}
              className={
                feed === id
                  ? "shrink-0 rounded-full bg-forest px-4 py-2 text-sm text-cream"
                  : "shrink-0 rounded-full bg-white/70 px-4 py-2 text-sm text-ink/70 ring-1 ring-forest/10"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <p className="text-ink/50">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl bg-white/60 p-6 text-center text-sm text-ink/60 sm:p-8">
          Пока ничего не найдено. Добавьте первую игрушку!
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
