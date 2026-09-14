"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";

type Match = {
  type: "DIRECT" | "CHAIN";
  score: number;
  reason: string;
  myItem?: { id: string; title: string };
  theirItem: {
    id: string;
    title: string;
    city: string;
    media: { url: string }[];
    owner: { id: string; name: string; rating: number; trustLevel: string };
  };
  chain?: { viaUserId: string; viaItemTitle: string }[];
};

export default function MatchesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api<{ matches: Match[] }>("/api/matches").then((d) => setMatches(d.matches));
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6 animate-rise">
      <div>
        <h1 className="font-display text-3xl text-forest">Match</h1>
        <p className="text-ink/60">
          Прямые взаимные совпадения и простые цепочки (фаза 2, упрощённо).
        </p>
      </div>

      {matches.length === 0 ? (
        <p className="rounded-2xl bg-white/60 p-8 text-center text-ink/60">
          Пока нет матчей. Добавьте объявления с блоком «хочу получить».
        </p>
      ) : (
        <div className="space-y-3">
          {matches.map((m, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-4 rounded-2xl bg-white/80 p-4 ring-1 ring-forest/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.theirItem.media[0]?.url || "https://placehold.co/80"}
                alt=""
                className="h-16 w-16 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-coral">
                  {m.type === "DIRECT" ? "Прямой match" : "Цепочка"} · score{" "}
                  {m.score}
                </p>
                <p className="font-medium">{m.reason}</p>
                <p className="text-sm text-ink/60">
                  {m.myItem ? `${m.myItem.title} ⇄ ` : ""}
                  {m.theirItem.title} · {m.theirItem.owner.name} ·{" "}
                  {m.theirItem.city}
                </p>
                {m.chain && (
                  <p className="text-xs text-ink/45">
                    через: {m.chain.map((c) => c.viaItemTitle).join(" → ")}
                  </p>
                )}
              </div>
              <Link
                href={`/items/${m.theirItem.id}`}
                className="rounded-xl bg-forest px-4 py-2 text-sm text-cream"
              >
                Открыть
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
