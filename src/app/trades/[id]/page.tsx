"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import {
  DISPUTE_REASONS,
  REVIEW_TAGS,
  SAFE_MEETING_PLACES,
  TRADE_STATUS_LABELS,
} from "@/lib/constants";
import { CounterOfferPanel } from "@/components/trade/CounterOfferPanel";
import { SnapshotTimeline } from "@/components/trade/SnapshotTimeline";
import { ReportButton } from "@/components/ReportButton";

type Trade = {
  id: string;
  publicId: string;
  status: string;
  currentVersion: number;
  meetingAt?: string | null;
  meetingPlace?: string | null;
  confirmCodeA?: string | null;
  confirmCodeB?: string | null;
  qrToken?: string | null;
  partyAConfirmedAt?: string | null;
  partyBConfirmedAt?: string | null;
  mySide?: string | null;
  initiatorId: string;
  recipientId: string;
  parties: {
    side: string;
    userId: string;
    confirmedTerms: boolean;
    viewedItemsAck: boolean;
    user: { id: string; name: string; avatarUrl?: string | null };
  }[];
  items: {
    side: string;
    itemId: string;
    item: {
      id: string;
      title: string;
      media: { url: string }[];
    };
  }[];
  disputes: { id: string; reason: string; status: string }[];
  reviews: { authorId: string }[];
  auditLogs: { action: string; createdAt: string; metaJson?: string | null }[];
};

type Msg = {
  id: string;
  body: string;
  system: boolean;
  flagged: boolean;
  createdAt: string;
  sender: { id: string; name: string };
};

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [meetingPlace, setMeetingPlace] = useState(SAFE_MEETING_PLACES[0]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewTags, setReviewTags] = useState<string[]>([]);
  const [disputeReason, setDisputeReason] = useState(DISPUTE_REASONS[0]);
  const [disputeDesc, setDisputeDesc] = useState("");
  const [showCounter, setShowCounter] = useState(false);

  const reload = useCallback(async () => {
    const [t, m] = await Promise.all([
      api<{ trade: Trade }>(`/api/trades/${id}`),
      api<{ messages: Msg[] }>(`/api/trades/${id}/messages`),
    ]);
    setTrade(t.trade);
    setMessages(m.messages);
  }, [id]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) reload().catch((e) => setError(e.message));
  }, [user, reload]);

  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => {
      api<{ messages: Msg[] }>(`/api/trades/${id}/messages`)
        .then((m) => setMessages(m.messages))
        .catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [user, id]);

  const sideA = useMemo(
    () => trade?.items.filter((i) => i.side === "A") || [],
    [trade],
  );
  const sideB = useMemo(
    () => trade?.items.filter((i) => i.side === "B") || [],
    [trade],
  );

  async function act(payload: Record<string, unknown>) {
    setError("");
    try {
      await api(`/api/trades/${id}/actions`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function sendMsg(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError("");
    try {
      await api(`/api/trades/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      setText("");
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка";
      setError(msg);
    }
  }

  if (!trade || !user) {
    return <p className="text-ink/50">Загрузка сделки…</p>;
  }

  const myParty = trade.parties.find((p) => p.userId === user.id);
  const isRecipient = trade.recipientId === user.id;
  const myCode = trade.mySide === "A" ? trade.confirmCodeA : trade.confirmCodeB;
  const canHandoff = [
    "MEETING_SCHEDULED",
    "HANDOFF_PENDING",
    "PARTY_A_CONFIRMED",
    "PARTY_B_CONFIRMED",
  ].includes(trade.status);
  const hasMyReview = trade.reviews.some((r) => r.authorId === user.id);

  return (
    <div className="space-y-6 animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink/50">Сделка</p>
          <h1 className="font-display text-3xl text-forest">{trade.publicId}</h1>
          <p className="text-sm text-ink/60">
            {TRADE_STATUS_LABELS[trade.status] || trade.status} · версия{" "}
            {trade.currentVersion}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ReportButton
            tradeId={trade.id}
            targetUserId={
              user.id === trade.initiatorId
                ? trade.recipientId
                : trade.initiatorId
            }
          />
          <Link href="/trades" className="text-sm text-forest underline">
            ← ко всем обменам
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p>
      )}

      {/* Contract */}
      <section className="grid gap-4 rounded-3xl bg-white/80 p-5 ring-1 ring-forest/10 md:grid-cols-2">
        <div>
          <h2 className="font-display text-xl text-forest">Сторона A отдаёт</h2>
          <ItemList items={sideA} />
        </div>
        <div>
          <h2 className="font-display text-xl text-forest">Сторона B отдаёт</h2>
          <ItemList items={sideB} />
        </div>
        <p className="md:col-span-2 text-sm text-ink/60">
          Условие: обмен производится одновременно. Денег в сделке нет и быть не
          может.
        </p>
      </section>

      {/* Actions */}
      <section className="flex flex-wrap gap-2">
        {isRecipient && ["OFFER_SENT", "NEGOTIATION"].includes(trade.status) && (
          <>
            <Btn onClick={() => act({ action: "accept" })}>Принять</Btn>
            <Btn tone="muted" onClick={() => act({ action: "reject", reason: "Не подходит" })}>
              Отклонить
            </Btn>
          </>
        )}
        {["OFFER_SENT", "NEGOTIATION"].includes(trade.status) && myParty && !myParty.confirmedTerms && (
          <Btn
            onClick={() =>
              act({ action: "confirm_terms", viewedItemsAck: true })
            }
          >
            Подтвердить условия
          </Btn>
        )}
        {trade.status === "NEGOTIATION" && (
          <p className="w-full text-xs text-ink/50">
            Подтверждения:{" "}
            {trade.parties
              .map((p) => `${p.side}:${p.confirmedTerms ? "✓" : "…"}`)
              .join(" · ")}
          </p>
        )}
        {trade.status === "TERMS_AGREED" && (
          <div className="w-full space-y-2 rounded-2xl bg-mist/40 p-4">
            <p className="text-sm font-medium">Назначить встречу (безопасные места)</p>
            <input
              type="datetime-local"
              value={meetingAt}
              onChange={(e) => setMeetingAt(e.target.value)}
              className="w-full rounded-xl border border-forest/15 px-3 py-2 text-sm"
            />
            <select
              value={meetingPlace}
              onChange={(e) => setMeetingPlace(e.target.value)}
              className="w-full rounded-xl border border-forest/15 px-3 py-2 text-sm"
            >
              {SAFE_MEETING_PLACES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <Btn
              onClick={() =>
                act({
                  action: "schedule_meeting",
                  meetingAt: new Date(meetingAt).toISOString(),
                  meetingPlace,
                })
              }
            >
              Сохранить встречу
            </Btn>
          </div>
        )}
        {trade.meetingAt && (
          <p className="w-full rounded-xl bg-forest/5 px-3 py-2 text-sm">
            Встреча: {new Date(trade.meetingAt).toLocaleString("ru-RU")} ·{" "}
            {trade.meetingPlace}
          </p>
        )}
        {trade.status === "MEETING_SCHEDULED" && (
          <Btn onClick={() => act({ action: "start_handoff" })}>
            Начать передачу
          </Btn>
        )}
        {["OFFER_SENT", "NEGOTIATION", "TERMS_AGREED"].includes(trade.status) && (
          <Btn tone="muted" onClick={() => setShowCounter((v) => !v)}>
            {showCounter ? "Скрыть изменение состава" : "Изменить состав"}
          </Btn>
        )}
        {!["COMPLETED", "CANCELLED", "BLOCKED"].includes(trade.status) && (
          <Btn
            tone="muted"
            onClick={() =>
              act({ action: "cancel", reason: "Отмена по инициативе участника" })
            }
          >
            Отменить
          </Btn>
        )}
        {["MEETING_SCHEDULED", "HANDOFF_PENDING"].includes(trade.status) && (
          <Btn tone="muted" onClick={() => act({ action: "no_show" })}>
            Сообщить о неявке
          </Btn>
        )}
      </section>

      {showCounter && (
        <CounterOfferPanel
          tradeId={trade.id}
          initiatorId={trade.initiatorId}
          recipientId={trade.recipientId}
          currentOfferedIds={sideA.map((i) => i.item.id)}
          currentTargetIds={sideB.map((i) => i.item.id)}
          onDone={async () => {
            setShowCounter(false);
            await reload();
          }}
        />
      )}

      <SnapshotTimeline tradeId={trade.id} />

      {/* QR / code confirmation */}
      {canHandoff && (
        <section className="space-y-3 rounded-3xl bg-forest p-5 text-cream">
          <h2 className="font-display text-xl">Подтверждение передачи</h2>
          <p className="text-sm text-cream/80">
            Нужны подтверждения обеих сторон. Один клик сделку не завершает.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-cream/10 p-4">
              <p className="text-xs uppercase tracking-wide text-cream/60">
                Ваш код для другой стороны
              </p>
              <p className="mt-2 font-display text-4xl tracking-widest">{myCode}</p>
              {trade.qrToken && (
                <div className="mt-3 rounded-xl bg-cream p-3 text-center text-forest">
                  {/* Simple QR stand-in via API image */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(trade.qrToken)}`}
                    alt="QR сделки"
                    className="mx-auto"
                  />
                  <p className="mt-2 text-xs">QR сделки {trade.publicId}</p>
                </div>
              )}
            </div>
            <div className="space-y-2 rounded-2xl bg-cream/10 p-4">
              <p className="text-sm">Введите код собеседника или подтвердите QR</p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Код"
                className="w-full rounded-xl border-0 px-3 py-2 text-ink"
              />
              <Btn
                onClick={() => act({ action: "confirm_handoff", code })}
              >
                Я получил все предметы
              </Btn>
              {trade.qrToken && (
                <Btn
                  tone="muted"
                  onClick={() =>
                    act({ action: "confirm_handoff", qrToken: trade.qrToken })
                  }
                >
                  Подтвердить по QR (демо-скан)
                </Btn>
              )}
              <p className="text-xs text-cream/60">
                A: {trade.partyAConfirmedAt ? "✓" : "…"} · B:{" "}
                {trade.partyBConfirmedAt ? "✓" : "…"}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Chat */}
      <section className="rounded-3xl bg-white/80 ring-1 ring-forest/10">
        <div className="border-b border-forest/10 px-4 py-3 font-medium">
          Чат сделки
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto p-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.system
                  ? "text-center text-xs text-ink/45"
                  : m.sender.id === user.id
                    ? "ml-8 rounded-2xl bg-forest px-3 py-2 text-sm text-cream"
                    : "mr-8 rounded-2xl bg-mist/70 px-3 py-2 text-sm"
              }
            >
              {!m.system && (
                <p className="mb-0.5 text-[10px] opacity-70">{m.sender.name}</p>
              )}
              {m.body}
              {m.flagged && (
                <p className="mt-1 text-[10px] text-coral">⚠ заблокировано фильтром</p>
              )}
            </div>
          ))}
        </div>
        {!["COMPLETED", "CANCELLED", "BLOCKED"].includes(trade.status) && (
          <form onSubmit={sendMsg} className="flex gap-2 border-t border-forest/10 p-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Сообщение (без денег и карт)"
              className="flex-1 rounded-xl border border-forest/15 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-xl bg-forest px-4 py-2 text-sm text-cream"
            >
              Отправить
            </button>
          </form>
        )}
      </section>

      {/* Review */}
      {trade.status === "COMPLETED" && !hasMyReview && (
        <section className="space-y-3 rounded-3xl bg-white/80 p-5 ring-1 ring-forest/10">
          <h2 className="font-display text-xl">Отзыв</h2>
          <input
            type="range"
            min={1}
            max={5}
            value={reviewRating}
            onChange={(e) => setReviewRating(Number(e.target.value))}
            className="w-full"
          />
          <p>Оценка: {reviewRating}</p>
          <div className="flex flex-wrap gap-2">
            {REVIEW_TAGS.map((tag) => {
              const on = reviewTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setReviewTags((t) =>
                      on ? t.filter((x) => x !== tag) : [...t, tag],
                    )
                  }
                  className={
                    on
                      ? "rounded-lg bg-forest px-2 py-1 text-xs text-cream"
                      : "rounded-lg bg-mist/60 px-2 py-1 text-xs"
                  }
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            className="w-full rounded-xl border border-forest/15 p-2 text-sm"
            rows={2}
          />
          <Btn
            onClick={async () => {
              await api(`/api/trades/${id}/reviews`, {
                method: "POST",
                body: JSON.stringify({
                  rating: reviewRating,
                  tags: reviewTags,
                  text: reviewText,
                }),
              });
              await reload();
            }}
          >
            Отправить отзыв
          </Btn>
        </section>
      )}

      {/* Dispute */}
      {!["CANCELLED", "BLOCKED"].includes(trade.status) && (
        <section className="space-y-3 rounded-3xl bg-white/60 p-5 ring-1 ring-coral/20">
          <h2 className="font-display text-xl text-coral">Открыть спор</h2>
          <select
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value as typeof disputeReason)}
            className="w-full rounded-xl border border-forest/15 px-3 py-2 text-sm"
          >
            {DISPUTE_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <textarea
            value={disputeDesc}
            onChange={(e) => setDisputeDesc(e.target.value)}
            placeholder="Описание и доказательства"
            className="w-full rounded-xl border border-forest/15 p-2 text-sm"
            rows={3}
          />
          <Btn
            tone="danger"
            onClick={async () => {
              await api(`/api/trades/${id}/disputes`, {
                method: "POST",
                body: JSON.stringify({
                  reason: disputeReason,
                  description: disputeDesc,
                }),
              });
              await reload();
            }}
          >
            Открыть спор
          </Btn>
          {trade.disputes[0] && (
            <p className="text-sm text-ink/60">
              Активный спор: {trade.disputes[0].reason} ({trade.disputes[0].status})
            </p>
          )}
        </section>
      )}

      {/* Audit */}
      <section className="rounded-3xl bg-white/50 p-5">
        <h2 className="mb-3 font-display text-lg">Журнал действий</h2>
        <ul className="space-y-1 text-xs text-ink/60">
          {trade.auditLogs.map((l, i) => (
            <li key={i}>
              {new Date(l.createdAt).toLocaleString("ru-RU")} — {l.action}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ItemList({
  items,
}: {
  items: { item: { id: string; title: string; media: { url: string }[] } }[];
}) {
  return (
    <ul className="mt-2 space-y-2">
      {items.map((ti) => (
        <li key={ti.item.id} className="flex items-center gap-2 text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ti.item.media[0]?.url || "https://placehold.co/40"}
            alt=""
            className="h-10 w-10 rounded-lg object-cover"
          />
          <Link href={`/items/${ti.item.id}`} className="hover:underline">
            {ti.item.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Btn({
  children,
  onClick,
  tone = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "primary" | "muted" | "danger";
}) {
  const cls =
    tone === "primary"
      ? "bg-coral text-white"
      : tone === "danger"
        ? "bg-coral/90 text-white"
        : "bg-white text-ink ring-1 ring-forest/15";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-medium ${cls}`}
    >
      {children}
    </button>
  );
}
