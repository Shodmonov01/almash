"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { TRADE_STATUS_LABELS } from "@/lib/constants";

type TradeRow = {
  id: string;
  publicId: string;
  status: string;
  updatedAt: string;
  parties: { side: string; user: { id: string; name: string; avatarUrl?: string | null } }[];
  items: {
    side: string;
    item: { title: string; media: { url: string }[] };
  }[];
};

export default function TradesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [trades, setTrades] = useState<TradeRow[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api<{ trades: TradeRow[] }>("/api/trades").then((d) => setTrades(d.trades));
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6 animate-rise">
      <h1 className="font-display text-3xl text-forest">Мои обмены</h1>
      {trades.length === 0 ? (
        <p className="rounded-2xl bg-white/60 p-8 text-center text-ink/60">
          Пока нет сделок. Найдите игрушку и предложите обмен.
        </p>
      ) : (
        <div className="space-y-3">
          {trades.map((t) => {
            const other = t.parties.find((p) => p.user.id !== user.id)?.user;
            return (
              <Link
                key={t.id}
                href={`/trades/${t.id}`}
                className="flex gap-3 rounded-2xl bg-white/80 p-3 ring-1 ring-forest/10 transition active:scale-[0.99] hover:ring-forest/30 sm:gap-4 sm:p-4"
              >
                <div className="flex shrink-0 -space-x-2">
                  {t.items.slice(0, 3).map((ti, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={ti.item.media[0]?.url || "https://placehold.co/80"}
                      alt=""
                      className="h-12 w-12 rounded-xl object-cover ring-2 ring-cream sm:h-14 sm:w-14"
                    />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.publicId}</p>
                  <p className="text-sm text-ink/60">
                    с {other?.name || "—"} ·{" "}
                    {TRADE_STATUS_LABELS[t.status] || t.status}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-ink/45">
                    {t.items.map((i) => i.item.title).join(" ⇄ ")}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
