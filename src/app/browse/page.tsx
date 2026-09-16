"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { ItemCard, type ItemCardData } from "@/components/ItemCard";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { CATEGORIES } from "@/lib/constants";

type Feed = "new" | "nearby" | "for_me";

export default function BrowsePage() {
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
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between animate-rise">
        <div>
          <h1 className="font-display text-4xl text-ink">Каталог</h1>
          <p className="text-sm font-semibold text-ink/55">
            Поиск списком. Основной режим —{" "}
            <Link href="/" className="font-extrabold text-forest underline-offset-2 hover:underline">
              свайп обмен / не обмен
            </Link>
            .
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-sand px-5 text-sm font-extrabold text-ink shadow-[0_5px_0_#b8d63a]"
        >
          <Sparkles size={16} /> К свайпам
        </Link>
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
