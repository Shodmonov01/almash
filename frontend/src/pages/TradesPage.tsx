import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { mediaUrl } from "@/lib/env";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLabels } from "@/lib/labels";

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
  const navigate = useNavigate();
  const { t } = useTranslation();
  const labels = useLabels();
  const [trades, setTrades] = useState<TradeRow[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;  
    api<{ trades: TradeRow[] }>("/api/trades").then((d) => setTrades(d.trades));
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6 animate-rise">
      <h1 className="font-display text-3xl text-forest">{t("pages.trades.title")}</h1>
      {trades.length === 0 ? (
        <p className="rounded-2xl bg-white/60 p-8 text-center text-ink/60">
          {t("pages.trades.empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {trades.map((tr) => {
            const other = tr.parties.find((p) => p.user.id !== user.id)?.user;
            return (
              <Link
                key={tr.id}
                to={`/trades/${tr.id}`}
                className="flex gap-3 rounded-2xl bg-white/80 p-3 ring-1 ring-forest/10 transition active:scale-[0.99] hover:ring-forest/30 sm:gap-4 sm:p-4"
              >
                <div className="flex shrink-0 -space-x-2">
                  {tr.items.slice(0, 3).map((ti, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={mediaUrl(ti.item.media[0]?.url) || "https://placehold.co/80"}
                      alt=""
                      className="h-12 w-12 rounded-xl object-cover ring-2 ring-cream sm:h-14 sm:w-14"
                    />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{tr.publicId}</p>
                  <p className="text-sm text-ink/60">
                    {t("pages.trades.with", { name: other?.name || "—" })} ·{" "}
                    {labels.tradeStatus(tr.status)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-ink/45">
                    {tr.items.map((i) => i.item.title).join(" ⇄ ")}
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
