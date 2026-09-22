import { useEffect, useState } from "react";
import { Heart, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { ReportButton } from "@/components/ReportButton";
import { TRUST_LEVELS } from "@/lib/constants";
import { Link, useNavigate, useParams } from "react-router-dom";

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
  const [selected, setSelected] = useState<string[]>([]);
  const [offerOpen, setOfferOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ item: ItemDetail }>(`/api/items/${id}`).then((d) => setItem(d.item));
  }, [id]);

  useEffect(() => {
    if (!user || !offerOpen) return;
    api<{ items: MyItem[] }>(`/api/items?ownerId=${user.id}`).then((d) =>
      setMyItems(d.items.filter((i) => (i as MyItem & { status?: string }).status !== "HIDDEN")),
    );
  }, [user, offerOpen]);

  if (!item) return <p className="text-ink/50">Загрузка…</p>;

  const trust =
    TRUST_LEVELS[item.owner.trustLevel as keyof typeof TRUST_LEVELS]?.label ||
    item.owner.trustLevel;
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
      setError("Выберите хотя бы один свой предмет");
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
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 animate-rise sm:gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-3">
        <div className="-mx-3 overflow-hidden bg-mist sm:mx-0 sm:rounded-3xl">
          <img
            src={item.media[0]?.url}
            alt={item.title}
            className="aspect-square w-full object-cover"
          />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
          {item.media.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.url}
              src={m.url}
              alt=""
              className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-forest/10 sm:h-20 sm:w-20"
            />
          ))}
        </div>
      </div>

      <div className="space-y-4 sm:space-y-5">
        <div>
          <p className="text-xs text-ink/50 sm:text-sm">
            {item.category}
            {item.subcategory ? ` · ${item.subcategory}` : ""}
            {item.brand ? ` · ${item.brand}` : ""}
          </p>
          <h1 className="font-display text-2xl leading-tight text-forest sm:text-3xl">
            {item.title}
          </h1>
          <p className="mt-2 text-sm text-ink/60">
            {item.condition} · {item.city}
            {item.district ? `, ${item.district}` : ""}
          </p>
        </div>

        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80 sm:text-base">
          {item.description}
        </p>

        {(item.hasDamage || item.damageNotes) && (
          <div className="rounded-xl bg-coral/10 p-3 text-sm text-coral">
            Повреждения: {item.damageNotes || "указаны"}
          </div>
        )}

        <div className="rounded-2xl bg-forest/5 p-4">
          <p className="text-sm font-medium text-forest">Хочу получить</p>
          <p className="mt-1 text-sm">{item.wantText || "Любые предложения"}</p>
        </div>

        <Link
          to={`/users/${item.owner.id}`}
          className="flex items-center gap-3 rounded-2xl bg-white/70 p-3 ring-1 ring-forest/10"
        >
          <img
            src={item.owner.avatarUrl || ""}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
          <div className="flex-1">
            <p className="font-medium">{item.owner.name}</p>
            <p className="text-xs text-ink/55">
              ★ {item.owner.rating.toFixed(1)} · {item.owner.completedTrades} обменов ·{" "}
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
            Избранное
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
              Предложить обмен
            </button>
          )}
          {!isOwner && item.status === "IN_TRADE" && (
            <p className="w-full rounded-xl bg-sand/80 px-4 py-3 text-sm text-ink/70">
              Предмет уже участвует в сделке. Дождитесь завершения или отмены.
            </p>
          )}
          {!isOwner && item.status === "TRADED" && (
            <p className="w-full rounded-xl bg-mist/80 px-4 py-3 text-sm text-ink/70">
              Предмет уже обменян.
            </p>
          )}
        </div>

        {offerOpen && (
          <div className="space-y-3 rounded-2xl border border-forest/15 bg-white p-4">
            <p className="font-medium">Выберите свои предметы (можно несколько)</p>
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
                        src={mi.media?.[0]?.url || "https://placehold.co/100"}
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
              placeholder="Сообщение к предложению (без денег и контактов)"
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
              {busy ? "Отправка…" : "Отправить предложение"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
