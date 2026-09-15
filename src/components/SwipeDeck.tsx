"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, RotateCcw, X, Sparkles } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/client";
import { useAuth } from "@/components/AuthProvider";

export type SwipeCard = {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string | null;
  brand: string | null;
  condition: string;
  city: string;
  district: string | null;
  wantText: string | null;
  media: { url: string }[];
  owner: {
    id: string;
    name: string;
    avatarUrl: string | null;
    city: string;
    rating: number;
    trustLevel: string;
  };
  matchScore: number;
  matchReasons: string[];
  suggestedOffer: { id: string; title: string; media: { url: string }[] } | null;
};

type MatchInfo = {
  theirItemId: string;
  theirItemTitle: string;
  myItemId: string;
  myItemTitle: string;
  theirUserId: string;
  theirUserName: string;
};

const SWIPE_THRESHOLD = 110;

export function SwipeDeck() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [cards, setCards] = useState<SwipeCard[]>([]);
  const [myItemCount, setMyItemCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exit, setExit] = useState<"left" | "right" | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const topIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ cards: SwipeCard[]; myItemCount: number }>(
        "/api/swipe/deck",
      );
      setCards(d.cards || []);
      setMyItemCount(
        typeof d.myItemCount === "number"
          ? d.myItemCount
          : (d.cards || []).some((c) => c.suggestedOffer)
            ? 1
            : 0,
      );
    } catch {
      setCards([]);
      setMyItemCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    load();
  }, [user, authLoading, router, load]);

  const top = cards[0] ?? null;
  topIdRef.current = top?.id ?? null;
  const canLike = myItemCount > 0 || !!top?.suggestedOffer;

  const commit = useCallback(
    async (direction: "LIKE" | "PASS", card: SwipeCard) => {
      if (busy) return;
      if (direction === "LIKE" && myItemCount === 0 && !card.suggestedOffer) {
        setExit(null);
        setDrag({ x: 0, y: 0, active: false });
        return;
      }
      setBusy(true);
      setExit(direction === "LIKE" ? "right" : "left");
      try {
        const result = await api<{
          direction: string;
          match: MatchInfo | null;
        }>("/api/swipe", {
          method: "POST",
          body: JSON.stringify({
            itemId: card.id,
            direction,
            offeredItemId: card.suggestedOffer?.id ?? null,
          }),
        });
        window.setTimeout(() => {
          setCards((prev) => prev.filter((c) => c.id !== card.id));
          setExit(null);
          setDrag({ x: 0, y: 0, active: false });
          setBusy(false);
          if (result.match) setMatch(result.match);
        }, 280);
      } catch (e) {
        setExit(null);
        setDrag({ x: 0, y: 0, active: false });
        setBusy(false);
        if (e instanceof Error && e.message.includes("добавьте")) {
          // keep card; gate UI below handles empty inventory
        }
      }
    },
    [busy, myItemCount],
  );

  function onPointerDown(e: React.PointerEvent) {
    if (busy || !top) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current || busy) return;
    const x = e.clientX - startRef.current.x;
    const y = e.clientY - startRef.current.y;
    setDrag({ x, y: y * 0.35, active: true });
  }

  function onPointerUp() {
    if (!startRef.current || !top || busy) return;
    const { x } = drag;
    startRef.current = null;
    if (x > SWIPE_THRESHOLD) {
      void commit("LIKE", top);
    } else if (x < -SWIPE_THRESHOLD) {
      void commit("PASS", top);
    } else {
      setDrag({ x: 0, y: 0, active: false });
    }
  }

  async function startTrade() {
    if (!match) return;
    setBusy(true);
    try {
      const d = await api<{ trade: { id: string } }>("/api/trades", {
        method: "POST",
        body: JSON.stringify({
          targetItemIds: [match.theirItemId],
          offeredItemIds: [match.myItemId],
          message: "Матч из свайпа — давай обменяемся!",
        }),
      });
      setMatch(null);
      router.push(`/trades/${d.trade.id}`);
    } catch {
      setBusy(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink/50">
        Загрузка…
      </div>
    );
  }

  const rot = drag.x * 0.04;
  const likeOpacity = Math.min(1, Math.max(0, drag.x / SWIPE_THRESHOLD));
  const passOpacity = Math.min(1, Math.max(0, -drag.x / SWIPE_THRESHOLD));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <header className="space-y-1 text-center animate-rise">
        <p className="font-display text-3xl text-forest sm:text-4xl">SwapToy</p>
        <p className="text-sm text-ink/60">
          Вправо — обмен · влево — пропуск
        </p>
      </header>

      {myItemCount === 0 && (
        <div className="rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/20">
          Добавьте свою игрушку, чтобы свайпать вправо.{" "}
          <Link href="/items/new" className="font-semibold underline">
            Добавить
          </Link>
        </div>
      )}

      <div className="relative mx-auto aspect-[3/4] w-full max-h-[min(68vh,560px)]">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-3xl bg-white/50 text-ink/45 ring-1 ring-forest/10">
            Подбираем колоду…
          </div>
        ) : cards.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-3xl bg-white/70 px-6 text-center ring-1 ring-forest/10">
            <Sparkles className="text-forest" />
            <p className="font-display text-2xl text-forest">Колода пуста</p>
            <p className="text-sm text-ink/55">
              Вы просмотрели все доступные вещи. Загляните в каталог или
              подождите новые объявления.
            </p>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={() => load()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest px-4 text-sm font-medium text-cream"
              >
                <RotateCcw size={16} /> Обновить
              </button>
              <Link
                href="/browse"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-forest/10 px-4 text-sm font-medium text-forest"
              >
                Открыть каталог
              </Link>
            </div>
          </div>
        ) : (
          <>
            {cards
              .slice(0, 3)
              .reverse()
              .map((card, revIdx, arr) => {
                const stackIndex = arr.length - 1 - revIdx; // 0 = top
                const isTop = stackIndex === 0;
                const scale = 1 - stackIndex * 0.04;
                const yOff = stackIndex * 10;
                const transform = isTop
                  ? exit === "right"
                    ? `translate(140%, -8%) rotate(18deg)`
                    : exit === "left"
                      ? `translate(-140%, -8%) rotate(-18deg)`
                      : `translate(${drag.x}px, ${drag.y + yOff}px) rotate(${rot}deg) scale(${scale})`
                  : `translate(0, ${yOff}px) scale(${scale})`;

                return (
                  <div
                    key={card.id}
                    className={clsx(
                      "absolute inset-0 overflow-hidden rounded-3xl bg-forest-deep shadow-xl shadow-forest/20 ring-1 ring-black/5",
                      isTop && "touch-none cursor-grab active:cursor-grabbing",
                      exit && isTop && "transition-transform duration-300 ease-out",
                      !exit && isTop && !drag.active && "transition-transform duration-200",
                    )}
                    style={{
                      zIndex: 10 - stackIndex,
                      transform,
                      opacity: exit && isTop ? 0.85 : 1,
                    }}
                    onPointerDown={isTop ? onPointerDown : undefined}
                    onPointerMove={isTop ? onPointerMove : undefined}
                    onPointerUp={isTop ? onPointerUp : undefined}
                    onPointerCancel={isTop ? onPointerUp : undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        card.media[0]?.url ||
                        "https://placehold.co/600x800/1a5f4a/f7faf8?text=SwapToy"
                      }
                      alt={card.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      draggable={false}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

                    {isTop && (
                      <>
                        <div
                          className="pointer-events-none absolute left-5 top-6 rounded-xl border-4 border-emerald-400 px-3 py-1 font-display text-2xl uppercase tracking-wide text-emerald-400"
                          style={{ opacity: likeOpacity }}
                        >
                          Обмен
                        </div>
                        <div
                          className="pointer-events-none absolute right-5 top-6 rounded-xl border-4 border-rose-400 px-3 py-1 font-display text-2xl uppercase tracking-wide text-rose-400"
                          style={{ opacity: passOpacity }}
                        >
                          Нет
                        </div>
                      </>
                    )}

                    <div className="absolute inset-x-0 bottom-0 space-y-2 p-4 text-cream sm:p-5">
                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="font-display text-2xl leading-tight sm:text-3xl">
                            {card.title}
                          </h2>
                          <p className="mt-1 text-sm text-cream/75">
                            {card.condition} · {card.city}
                            {card.district ? `, ${card.district}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-cream/15 px-2 py-1 text-xs backdrop-blur">
                          {card.matchScore}%
                        </span>
                      </div>
                      {card.wantText && (
                        <p className="line-clamp-2 text-sm text-sand">
                          Хочет: {card.wantText}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            card.owner.avatarUrl ||
                            "https://placehold.co/40x40"
                          }
                          alt=""
                          className="h-8 w-8 rounded-full object-cover ring-2 ring-cream/30"
                        />
                        <div className="min-w-0 text-sm">
                          <p className="truncate font-medium">{card.owner.name}</p>
                          <p className="text-xs text-cream/60">
                            {card.matchReasons[0]}
                          </p>
                        </div>
                      </div>
                      {card.suggestedOffer && (
                        <p className="text-xs text-cream/55">
                          Предложим: {card.suggestedOffer.title}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </>
        )}
      </div>

      {cards.length > 0 && (
        <div className="flex items-center justify-center gap-6 pb-2 animate-rise">
          <button
            type="button"
            disabled={busy}
            aria-label="Пропустить"
            onClick={() => top && commit("PASS", top)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-coral shadow-lg shadow-coral/20 ring-1 ring-coral/20 transition hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <X size={28} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            disabled={busy || !canLike}
            aria-label="Хочу обмен"
            onClick={() => top && commit("LIKE", top)}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-forest text-cream shadow-lg shadow-forest/30 transition hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <Heart size={30} fill="currentColor" />
          </button>
        </div>
      )}

      <p className="text-center text-xs text-ink/40">
        <Link href="/browse" className="underline-offset-2 hover:underline">
          Каталог списком
        </Link>
        {" · "}
        <Link href="/matches" className="underline-offset-2 hover:underline">
          Матчи
        </Link>
      </p>

      {match && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm animate-rise rounded-3xl bg-cream p-6 shadow-2xl">
            <p className="text-center font-display text-3xl text-forest">
              Это матч!
            </p>
            <p className="mt-2 text-center text-sm text-ink/65">
              Вы и {match.theirUserName} хотите обменяться
            </p>
            <p className="mt-4 text-center text-base font-medium text-ink">
              {match.myItemTitle}
              <span className="mx-2 text-coral">⇄</span>
              {match.theirItemTitle}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => startTrade()}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-coral px-4 font-semibold text-white"
              >
                Начать обмен
              </button>
              <button
                type="button"
                onClick={() => setMatch(null)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl text-sm text-ink/60"
              >
                Продолжить свайпать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
