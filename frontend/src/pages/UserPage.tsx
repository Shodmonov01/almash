import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { mediaUrl } from "@/lib/env";
import { ItemCard, type ItemCardData } from "@/components/ItemCard";
import { TRUST_LEVELS } from "@/lib/constants";
import { useParams } from "react-router-dom";

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    user: {
      id: string;
      name: string;
      username?: string | null;
      avatarUrl?: string | null;
      city: string;
      trustLevel: string;
      rating: number;
      completedTrades: number;
      createdAt: string;
    };
    items: ItemCardData[];
    reviews: {
      id: string;
      rating: number;
      text?: string | null;
      tags: string[];
      author: { name: string };
      trade: { publicId: string };
    }[];
  } | null>(null);

  useEffect(() => {
    api<typeof data extends null ? never : NonNullable<typeof data>>(
      `/api/users/${id}`,
    ).then(setData);
  }, [id]);

  if (!data) return <p className="text-ink/50">Загрузка…</p>;
  const { user, items, reviews } = data;
  const trust =
    TRUST_LEVELS[user.trustLevel as keyof typeof TRUST_LEVELS]?.label ||
    user.trustLevel;

  return (
    <div className="space-y-8 animate-rise">
      <section className="rounded-3xl bg-white/80 p-6 ring-1 ring-forest/10">
        <div className="flex items-center gap-4">
          <img
            src={mediaUrl(user.avatarUrl) || ""}
            alt=""
            className="h-16 w-16 rounded-full object-cover"
          />
          <div>
            <h1 className="font-display text-3xl text-forest">{user.name}</h1>
            <p className="text-sm text-ink/60">
              {user.city} · {trust} · ★ {user.rating.toFixed(1)} ·{" "}
              {user.completedTrades} обменов
            </p>
            <p className="text-xs text-ink/45">
              на платформе с {new Date(user.createdAt).toLocaleDateString("ru-RU")}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Объявления</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={{
                ...item,
                owner: {
                  id: user.id || id || "",
                  name: user.name,
                  rating: user.rating,
                  completedTrades: user.completedTrades,
                  trustLevel: user.trustLevel,
                },
              }}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Отзывы</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-ink/50">Пока нет отзывов</p>
        ) : (
          reviews.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl bg-white/70 p-4 text-sm ring-1 ring-forest/10"
            >
              <p className="font-medium">
                ★ {r.rating} · {r.author.name} · {r.trade.publicId}
              </p>
              <p className="text-ink/70">{r.text}</p>
              <p className="mt-1 text-xs text-ink/45">{r.tags.join(" · ")}</p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
