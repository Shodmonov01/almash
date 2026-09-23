import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Heart, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { mediaUrl } from "@/lib/env";
import { ReportButton } from "@/components/ReportButton";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLabels } from "@/lib/labels";

type ItemDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string | null;
  brand?: string | null;
  condition: string;
  completeness?: string | null;
  hasDamage: boolean;
  damageNotes?: string | null;
  city: string;
  district?: string | null;
  wantText?: string | null;
  wantCategories: string[];
  status: string;
  favorited: boolean;
  media: { url: string; type: string }[];
  owner: {
    id: string;
    name: string;
    username?: string | null;
    avatarUrl?: string | null;
    rating: number;
    completedTrades: number;
    trustLevel: string;
    city: string;
    district?: string | null;
  };
};

type MyItem = { id: string; title: string; media: { url: string }[] };

export default function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [myItems, setMyItems] = useState<MyItem[]>([]);
  const [mySets, setMySets] = useState<
    { id: string; title: string; items: { item: { id: string } }[] }[]
  >([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [offerOpen, setOfferOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [activePhoto, setActivePhoto] = useState(0);
  const { t } = useTranslation();
  const labels = useLabels();

  useEffect(() => {
    setActivePhoto(0);
    api<{ item: ItemDetail }>(`/api/items/${id}`).then((d) => setItem(d.item));
  }, [id]);

  useEffect(() => {
    if (!user || !offerOpen) return;
    api<{ items: MyItem[] }>(`/api/items?ownerId=${user.id}`).then((d) =>
      setMyItems(d.items.filter((i) => (i as MyItem & { status?: string }).status !== "HIDDEN")),
    );
    api<{ sets: typeof mySets }>("/api/sets").then((d) =>
      setMySets(d.sets || []),
    );
  }, [user, offerOpen]);

  if (!item) return <p className="text-ink/50">{t("pages.loading")}</p>;

  const photos = item.media.filter((m) => m.type !== "VIDEO");
  const showPhoto = (i: number) =>
    setActivePhoto((i + photos.length) % Math.max(photos.length, 1));

  const trust = labels.trust(item.owner.trustLevel);
  const isOwner = user?.id === item.owner.id;

  async function toggleFav() {
    if (!user) return navigate("/login");
    const d = await api<{ favorited: boolean }>("/api/favorites", {
      method: "POST",
      body: JSON.stringify({ itemId: item!.id }),
    });
    setItem({ ...item!, favorited: d.favorited });
  }

  async function sendOffer() {
    if (!user) return navigate("/login");
    if (selected.length === 0) {
      setError(t("itemPage.pickOne"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const d = await api<{ trade: { id: string; publicId: string } }>("/api/trades", {
        method: "POST",
        body: JSON.stringify({
          targetItemIds: [item!.id],
          offeredItemIds: selected,
          message: message || undefined,
        }),
      });
      navigate(`/trades/${d.trade.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 animate-rise sm:gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-3">
        <div className="relative -mx-3 overflow-hidden bg-mist sm:mx-0 sm:rounded-3xl">
          <img
            src={mediaUrl(photos[activePhoto]?.url)}
            alt={item.title}
            className="aspect-square w-full object-cover"
          />
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label={t("itemPage.prevPhoto")}
                onClick={() => showPhoto(activePhoto - 1)}
                className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow-md backdrop-blur transition hover:bg-white active:scale-95"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                aria-label={t("itemPage.nextPhoto")}
                onClick={() => showPhoto(activePhoto + 1)}
                className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow-md backdrop-blur transition hover:bg-white active:scale-95"
              >
                <ChevronRight size={20} />
              </button>
              <span className="absolute bottom-3 right-3 rounded-full bg-ink/60 px-2.5 py-1 text-xs font-semibold text-white">
                {activePhoto + 1} / {photos.length}
              </span>
            </>
          )}
        </div>
        {/* p-1: room for the active thumbnail's ring inside the scroll box */}
        <div className="-mx-1 flex gap-2.5 overflow-x-auto p-1 scrollbar-none">
          {photos.map((m, i) => (
            <button
              key={m.url}
              type="button"
              aria-label={t("itemPage.photo", { n: i + 1 })}
              aria-current={i === activePhoto}
              onClick={() => showPhoto(i)}
              className={`shrink-0 overflow-hidden rounded-xl transition ${
                i === activePhoto
                  ? "ring-2 ring-forest ring-offset-2 ring-offset-cream"
                  : "opacity-70 ring-1 ring-forest/10 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl(m.url)}
                alt=""
                className="h-16 w-16 object-cover sm:h-20 sm:w-20"
              />
            </button>
          ))}
        </div>
        {item.media
          .filter((m) => m.type === "VIDEO")
          .map((m) => (
            <video
              key={m.url}
              src={mediaUrl(m.url)}
              controls
              preload="metadata"
              className="w-full rounded-2xl bg-black sm:rounded-3xl"
            />
          ))}
      </div>

      <div className="space-y-4 sm:space-y-5">
        <div>
          <p className="text-xs text-ink/50 sm:text-sm">
            {labels.category(item.category)}
            {item.subcategory ? ` · ${labels.subcategory(item.subcategory)}` : ""}
            {item.brand ? ` · ${item.brand}` : ""}
          </p>
          <h1 className="font-display text-2xl leading-tight text-forest sm:text-3xl">
            {item.title}
          </h1>
          <p className="mt-2 text-sm text-ink/60">
            {labels.condition(item.condition)} · {item.city}
            {item.district ? `, ${item.district}` : ""}
          </p>
        </div>

        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80 sm:text-base">
          {item.description}
        </p>

        {(item.hasDamage || item.damageNotes) && (
          <div className="rounded-xl bg-coral/10 p-3 text-sm text-coral">
            {t("itemPage.damage", { notes: item.damageNotes || t("itemPage.damageYes") })}
          </div>
        )}

        <div className="rounded-2xl bg-forest/5 p-4">
          <p className="text-sm font-medium text-forest">{t("itemPage.wantTitle")}</p>
          <p className="mt-1 text-sm">{item.wantText || t("itemPage.wantAny")}</p>
        </div>

        <Link
          to={`/users/${item.owner.id}`}
          className="flex items-center gap-3 rounded-2xl bg-white/70 p-3 ring-1 ring-forest/10"
        >
          <img
            src={mediaUrl(item.owner.avatarUrl) || ""}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
          <div className="flex-1">
            <p className="font-medium">{item.owner.name}</p>
            <p className="text-xs text-ink/55">
              ★ {item.owner.rating.toFixed(1)} ·{" "}
              {t("itemPage.trades", { count: item.owner.completedTrades })} ·{" "}
              {trust}
            </p>
          </div>
          <ReportButton targetUserId={item.owner.id} itemId={item.id} />
        </Link>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={toggleFav}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-forest/15"
          >
            <Heart
              size={16}
              className={item.favorited ? "fill-coral text-coral" : ""}
            />
            {t("itemPage.favorite")}
          </button>
          {!isOwner && item.status === "ACTIVE" && (
            <button
              type="button"
              onClick={() => {
                if (!user) return navigate("/login");
                setOfferOpen(true);
              }}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-coral px-4 py-3 text-sm font-semibold text-white"
            >
              <RefreshCw size={16} />
              {t("itemPage.offer")}
            </button>
          )}
          {!isOwner && item.status === "IN_TRADE" && (
            <p className="w-full rounded-xl bg-sand/80 px-4 py-3 text-sm text-ink/70">
              {t("itemPage.inTrade")}
            </p>
          )}
          {!isOwner && item.status === "TRADED" && (
            <p className="w-full rounded-xl bg-mist/80 px-4 py-3 text-sm text-ink/70">
              {t("itemPage.traded")}
            </p>
          )}
        </div>

        {offerOpen && (
          <div className="space-y-3 rounded-2xl border border-forest/15 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <p className="font-medium">{t("itemPage.pickMine")}</p>
              {mySets.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs text-ink/60">{t("itemPage.pickSet")}</span>
                  {mySets.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const setIds = s.items.map((i) => i.item.id);
                        setSelected((prev) => {
                          const allIncluded = setIds.every((id) => prev.includes(id));
                          return allIncluded
                            ? prev.filter((id) => !setIds.includes(id))
                            : [...new Set([...prev, ...setIds])];
                        });
                      }}
                      className="rounded-lg bg-forest/10 px-2 py-0.5 text-xs font-semibold text-forest hover:bg-forest/20"
                    >
                      📦 {s.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {myItems
                .filter((i) => i.id)
                .map((mi) => {
                  const on = selected.includes(mi.id);
                  return (
                    <button
                      key={mi.id}
                      type="button"
                      onClick={() =>
                        setSelected((s) =>
                          on ? s.filter((x) => x !== mi.id) : [...s, mi.id],
                        )
                      }
                      className={
                        on
                          ? "rounded-xl bg-forest p-2 text-left text-sm text-cream"
                          : "rounded-xl bg-mist/60 p-2 text-left text-sm"
                      }
                    >
                      <img
                        src={mediaUrl(mi.media?.[0]?.url) || "https://placehold.co/100"}
                        alt=""
                        className="mb-1 h-16 w-full rounded-lg object-cover"
                      />
                      {mi.title}
                    </button>
                  );
                })}
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("itemPage.messagePlaceholder")}
              className="w-full rounded-xl border border-forest/15 p-2 text-sm"
              rows={2}
            />
            {error && <p className="text-sm text-coral">{error}</p>}
            <button
              type="button"
              disabled={busy}
              onClick={sendOffer}
              className="w-full rounded-xl bg-forest py-3 text-sm font-semibold text-cream disabled:opacity-60"
            >
              {busy ? t("itemPage.sending") : t("itemPage.send")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
