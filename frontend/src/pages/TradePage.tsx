import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { mediaUrl } from "@/lib/env";
import { isVideoUrl, uploadMedia, VIDEO_ACCEPT } from "@/lib/media";
import {
  DISPUTE_REASONS,
  REVIEW_TAGS,
  SAFE_MEETING_PLACES,
} from "@/lib/constants";
import { CounterOfferPanel } from "@/components/trade/CounterOfferPanel";
import { SnapshotTimeline } from "@/components/trade/SnapshotTimeline";
import { QrScannerModal } from "@/components/trade/QrScannerModal";
import { DateTimePicker, defaultMeetingValue } from "@/components/DateTimePicker";
import { FancySelect } from "@/components/FancySelect";
import { ReportButton } from "@/components/ReportButton";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Camera, Check, QrCode, Star } from "lucide-react";
import QRCode from "qrcode";
import type {ItemCardData} from "@/components/ItemCard.tsx";
import { useTranslation } from "react-i18next";
import { dateLocale, useLabels } from "@/lib/labels";

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
  mediaUrl?: string | null;
  system: boolean;
  flagged: boolean;
  createdAt: string;
  sender: { id: string; name: string };
};

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [pendingMediaUrl, setPendingMediaUrl] = useState<string | null>(null);
  const [chatImageUploading, setChatImageUploading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [qrByCode, setQrByCode] = useState<Record<string, string>>({});

  // QR is rendered locally from MY one-time code — the other party scans it
  // to confirm; nothing on my own screen can confirm my side.
  const ownCode =
    trade?.mySide === "A" ? trade?.confirmCodeA : trade?.confirmCodeB;
  useEffect(() => {
    if (!trade?.publicId || !ownCode) return;
    const key = `${trade.publicId}:${ownCode}`;
    if (qrByCode[key]) return;
    QRCode.toDataURL(`SWAPTOY:${key}`, { width: 320, margin: 1 })
      .then((url) => setQrByCode((m) => ({ ...m, [key]: url })))
      .catch(() => {});
  }, [trade?.publicId, ownCode, qrByCode]);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [meetingAt, setMeetingAt] = useState(() => defaultMeetingValue());
  const [meetingPlace, setMeetingPlace] = useState(SAFE_MEETING_PLACES[0]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewTags, setReviewTags] = useState<string[]>([]);
  const [disputeReason, setDisputeReason] = useState(DISPUTE_REASONS[0]);
  const [disputeDesc, setDisputeDesc] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const { t } = useTranslation();
  const labels = useLabels();

  const reload = useCallback(async () => {
    const [tr, m] = await Promise.all([
      api<{ trade: Trade }>(`/api/trades/${id}`),
      api<{ messages: Msg[] }>(`/api/trades/${id}/messages`),
    ]);
    setTrade(tr.trade);
    setMessages(m.messages);
  }, [id]);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

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
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  }

  async function sendMsg(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() && !pendingMediaUrl) return;
    setError("");
    try {
      await api(`/api/trades/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          body: text.trim() || t("pages.messages.attachment"),
          mediaUrl: pendingMediaUrl || undefined,
        }),
      });
      setText("");
      setPendingMediaUrl(null);
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("common.error");
      setError(msg);
    }
  }

  if (!trade || !user) {
    return <p className="text-ink/50">{t("trade.loading")}</p>;
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
  const qrDataUrl = canHandoff ? qrByCode[`${trade.publicId}:${myCode}`] : undefined;

  function StatusPill({ label, confirmed }: { label: string; confirmed: boolean }) {
    return (
        <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
                confirmed ? "bg-sand text-ink" : "bg-white/10 text-cream/50"
            }`}
        >
      {label}
          {confirmed ? <Check size={11} /> : <span>…</span>}
    </span>
    );
  }

  return (
    <div className="space-y-4 animate-rise sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-ink/50">{t("trade.deal")}</p>
          <h1 className="break-all font-display text-2xl text-forest sm:text-3xl">
            {trade.publicId}
          </h1>
          <p className="text-sm text-ink/60">
            {labels.tradeStatus(trade.status)} ·{" "}
            {t("trade.version", { n: trade.currentVersion })}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <ReportButton
            tradeId={trade.id}
            targetUserId={
              user.id === trade.initiatorId
                ? trade.recipientId
                : trade.initiatorId
            }
          />
          <Link to="/trades" className="text-sm text-forest underline">
            {t("trade.back")}
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p>
      )}

      {/* Contract */}
      <section className="grid gap-4 rounded-2xl bg-white/80 p-4 ring-1 ring-forest/10 sm:rounded-3xl sm:p-5 md:grid-cols-2">
        <div>
          <h2 className="font-display text-lg text-forest sm:text-xl">{t("trade.sideA")}</h2>
          <ItemList items={sideA} />
        </div>
        <div>
          <h2 className="font-display text-lg text-forest sm:text-xl">{t("trade.sideB")}</h2>
          <ItemList items={sideB} />
        </div>
        <p className="text-sm text-ink/60 md:col-span-2">
          {t("trade.condition")}
        </p>
      </section>

      {/* Actions */}
      <section className="stack-actions">
        {isRecipient && ["OFFER_SENT", "NEGOTIATION"].includes(trade.status) && (
          <>
            <Btn onClick={() => act({ action: "accept" })}>{t("trade.accept")}</Btn>
            <Btn tone="muted" onClick={() => act({ action: "reject", reason: t("trade.rejectReason") })}>
              {t("trade.reject")}
            </Btn>
          </>
        )}
        {["OFFER_SENT", "NEGOTIATION"].includes(trade.status) && myParty && !myParty.confirmedTerms && (
          <Btn
            onClick={() =>
              act({ action: "confirm_terms", viewedItemsAck: true })
            }
          >
            {t("trade.confirmTerms")}
          </Btn>
        )}
        {trade.status === "NEGOTIATION" && (
          <p className="w-full text-xs text-ink/50">
            {t("trade.confirmations")}{" "}
            {trade.parties
              .map((p) => `${p.side}:${p.confirmedTerms ? "✓" : "…"}`)
              .join(" · ")}
          </p>
        )}
        {trade.status === "TERMS_AGREED" && (
          <div className="w-full space-y-2 rounded-2xl bg-mist/40 p-4">
            <p className="text-sm font-medium">{t("trade.scheduleTitle")}</p>
            <DateTimePicker value={meetingAt} onChange={setMeetingAt} />
            <FancySelect
              value={meetingPlace}
              onChange={setMeetingPlace}
              options={SAFE_MEETING_PLACES.map((p) => ({ value: p, label: labels.place(p) }))}
              triggerClassName={"border-forest/15 bg-white hover:border-forest/30 focus:ring-forest/30"}
            />
            <Btn
                onClick={() => {
                  if (!meetingAt) {
                    setError(t("trade.pickDateTime"));
                    return;
                  }
                  const parsed = new Date(meetingAt);
                  if (isNaN(parsed.getTime())) {
                    setError(t("trade.badDate"));
                    return;
                  }
                  act({
                    action: "schedule_meeting",
                    meetingAt: parsed.toISOString(),
                    meetingPlace,
                  });
                }}
            >
              {t("trade.saveMeeting")}
            </Btn>
          </div>
        )}
        {trade.meetingAt && (
          <p className="w-full rounded-xl bg-forest/5 px-3 py-2 text-sm">
            {t("trade.meeting", {
              date: new Date(trade.meetingAt).toLocaleString(dateLocale()),
              place: labels.place(trade.meetingPlace),
            })}
          </p>
        )}
        {trade.status === "MEETING_SCHEDULED" && (
          <Btn onClick={() => act({ action: "start_handoff" })}>
            {t("trade.startHandoff")}
          </Btn>
        )}
        {["OFFER_SENT", "NEGOTIATION", "TERMS_AGREED"].includes(trade.status) && (
          <Btn tone="muted" onClick={() => setShowCounter((v) => !v)}>
            {showCounter ? t("trade.hideCounter") : t("trade.showCounter")}
          </Btn>
        )}
        {!["COMPLETED", "CANCELLED", "BLOCKED"].includes(trade.status) && (
          <Btn
            tone="muted"
            onClick={() =>
              act({ action: "cancel", reason: t("trade.cancelReason") })
            }
          >
            {t("trade.cancel")}
          </Btn>
        )}
        {["MEETING_SCHEDULED", "HANDOFF_PENDING"].includes(trade.status) && (
          <Btn tone="muted" onClick={() => act({ action: "no_show" })}>
            {t("trade.noShow")}
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
          <section className="space-y-5 rounded-[2rem] bg-forest p-5 text-cream shadow-[0_20px_60px_-15px_rgba(15,61,49,0.5)] sm:p-8">
            <div>
              <h2 className="font-display text-xl sm:text-2xl">{t("trade.handoffTitle")}</h2>
              <p className="mt-1 text-sm text-cream/60">
                {t("trade.handoffHint")}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Ваш код / QR */}
              <div className="flex flex-col items-center rounded-3xl bg-white/[0.07] p-6 text-center backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cream/45">
                  {t("trade.yourCode")}
                </p>
                <p className="mt-3 font-display text-5xl font-bold tracking-[0.2em] text-cream sm:text-6xl">
                  {myCode}
                </p>

                {qrDataUrl && (
                    <div className="mt-6 w-full max-w-[200px] rounded-3xl bg-white p-4 shadow-xl">
                      <img
                          src={qrDataUrl}
                          alt={t("trade.qrAlt")}
                          className="mx-auto h-36 w-36 sm:h-40 sm:w-40"
                      />
                      <p className="mt-3 flex items-center justify-center gap-1 text-[11px] font-medium text-ink/50">
                        <QrCode size={12} />
                        {t("trade.qrCaption", { id: trade.publicId })}
                      </p>
                    </div>
                )}
              </div>

              {/* Подтверждение */}
              <div className="flex flex-col gap-3 rounded-3xl bg-white/[0.07] p-6 backdrop-blur-sm">
                <p className="text-sm font-medium text-cream/85">
                  {t("trade.enterCode")}
                </p>

                <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={t("trade.codePlaceholder")}
                    inputMode="numeric"
                    className="w-full rounded-2xl border-0 bg-white px-4 py-3.5 text-center font-display text-2xl tracking-[0.3em] text-ink outline-none ring-0 placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-ink/30 focus:ring-2 focus:ring-sand"
                />

                <button
                    type="button"
                    onClick={() => act({ action: "confirm_handoff", code })}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-coral py-3.5 text-sm font-semibold text-white shadow-lg shadow-coral/25 transition hover:bg-coral/90 active:scale-[0.98]"
                >
                  <Check size={16} />
                  {t("trade.received")}
                </button>

                <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-white/10 py-3 text-xs font-semibold text-cream transition hover:bg-white/15 active:scale-[0.98]"
                >
                  <Camera size={15} />
                  {t("trade.scan")}
                </button>

                <div className="mt-1 flex items-center justify-center gap-3 border-t border-white/10 pt-3">
                  <StatusPill label="A" confirmed={!!trade.partyAConfirmedAt} />
                  <span className="h-1 w-1 rounded-full bg-cream/25" />
                  <StatusPill label="B" confirmed={!!trade.partyBConfirmedAt} />
                </div>
              </div>
            </div>

            <QrScannerModal
                isOpen={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onScan={(scannedToken) => {
                  setScannerOpen(false);
                  act({ action: "confirm_handoff", qrToken: scannedToken.trim() });
                }}
            />
          </section>
      )}

      {/* Chat */}
      <section className="rounded-2xl bg-white/80 ring-1 ring-forest/10 sm:rounded-3xl">
        <div className="border-b border-forest/10 px-4 py-3 font-medium">
          {t("trade.chat")}
        </div>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto overscroll-contain p-3 sm:max-h-80 sm:p-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.system
                  ? "text-center text-xs text-ink/45"
                  : m.sender.id === user.id
                    ? "ml-6 rounded-2xl bg-forest px-3 py-2 text-sm text-cream sm:ml-8"
                    : "mr-6 rounded-2xl bg-mist/70 px-3 py-2 text-sm sm:mr-8"
              }
            >
              {!m.system && (
                <p className="mb-0.5 text-[10px] opacity-70">{m.sender.name}</p>
              )}
              {m.mediaUrl && isVideoUrl(m.mediaUrl) && (
                <video
                  src={mediaUrl(m.mediaUrl)}
                  controls
                  preload="metadata"
                  className="my-1 max-h-60 w-full rounded-xl bg-black ring-1 ring-forest/15"
                />
              )}
              {m.mediaUrl && !isVideoUrl(m.mediaUrl) && (
                <a
                  href={mediaUrl(m.mediaUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="my-1 block overflow-hidden rounded-xl"
                >
                  <img
                    src={mediaUrl(m.mediaUrl)}
                    alt={t("trade.imageAlt")}
                    className="max-h-48 rounded-xl object-cover ring-1 ring-forest/15 hover:opacity-90"
                  />
                </a>
              )}
              {m.body}
              {m.flagged && (
                <p className="mt-1 text-[10px] text-coral">{t("trade.blocked")}</p>
              )}
            </div>
          ))}
        </div>
        {!["COMPLETED", "CANCELLED", "BLOCKED"].includes(trade.status) && (
          <div className="border-t border-forest/10">
            {pendingMediaUrl && (
              <div className="flex items-center gap-2 bg-forest/5 px-4 py-2 text-xs">
                {isVideoUrl(pendingMediaUrl) ? (
                  <video
                    src={mediaUrl(pendingMediaUrl)}
                    muted
                    className="h-10 w-10 rounded-lg bg-black object-cover ring-1 ring-forest/20"
                  />
                ) : (
                  <img
                    src={mediaUrl(pendingMediaUrl)}
                    alt=""
                    className="h-10 w-10 rounded-lg object-cover ring-1 ring-forest/20"
                  />
                )}
                <span className="text-ink/70">
                  {isVideoUrl(pendingMediaUrl) ? t("trade.videoAttached") : t("trade.photoAttached")}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingMediaUrl(null)}
                  className="ml-auto font-bold text-coral hover:underline"
                >
                  {t("trade.remove")}
                </button>
              </div>
            )}
            <form
              onSubmit={sendMsg}
              className="flex items-center gap-2 p-3"
            >
              <label
                className={`flex shrink-0 cursor-pointer items-center justify-center rounded-xl p-3 text-forest transition ${
                  chatImageUploading
                    ? "bg-mist opacity-50"
                    : "bg-forest/10 hover:bg-forest/20"
                }`}
                title={t("trade.attach")}
              >
                <Camera size={18} />
                <input
                  type="file"
                  accept={`image/*,${VIDEO_ACCEPT}`}
                  disabled={chatImageUploading}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setChatImageUploading(true);
                    setError("");
                    try {
                      setPendingMediaUrl(await uploadMedia(file, trade.publicId));
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : t("trade.fileError"),
                      );
                    } finally {
                      setChatImageUploading(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  pendingMediaUrl
                    ? t("trade.commentPhoto")
                    : t("trade.messagePlaceholder")
                }
                className="min-w-0 flex-1 rounded-xl border border-forest/15 px-3 py-3 text-sm"
              />
              <button
                type="submit"
                disabled={chatImageUploading}
                className="shrink-0 rounded-xl bg-forest px-4 py-3 text-sm text-cream disabled:opacity-50"
              >
                →
              </button>
            </form>
          </div>
        )}
      </section>

      {/* Review */}
      {trade.status === "COMPLETED" && !hasMyReview && (
          <section className="space-y-5 rounded-[2rem] bg-white p-6 shadow-[0_20px_60px_-25px_rgba(15,61,49,0.25)] ring-1 ring-forest/5 sm:p-8">
            <div>
              <h2 className="font-display text-xl text-forest sm:text-2xl">{t("trade.reviewTitle")}</h2>
              <p className="mt-1 text-sm text-ink/50">
                {t("trade.reviewHint")}
              </p>
            </div>

            {/* Рейтинг звёздами */}
            <div className="flex flex-col items-center gap-2 rounded-3xl bg-forest/5 py-6">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        type="button"
                        onClick={() => setReviewRating(n)}
                        className="transition active:scale-90"
                        aria-label={t("trade.stars", { n })}
                    >
                      <Star
                          size={32}
                          className={
                            n <= reviewRating
                                ? "fill-coral text-coral"
                                : "fill-transparent text-forest/15"
                          }
                          strokeWidth={1.5}
                      />
                    </button>
                ))}
              </div>
              <p className="text-sm font-medium text-ink/60">
                {t("trade.ratingLine")} <span className="font-bold text-forest">{reviewRating}</span> {t("trade.ofFive")}
              </p>
            </div>

            {/* Теги */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
                {t("trade.whatGood")}
              </p>
              <div className="flex flex-wrap gap-2">
                {REVIEW_TAGS.map((tag) => {
                  const on = reviewTags.includes(tag);
                  return (
                      <button
                          key={tag}
                          type="button"
                          onClick={() =>
                              setReviewTags((prev) =>
                                  on ? prev.filter((x) => x !== tag) : [...prev, tag],
                              )
                          }
                          className={`rounded-full px-3.5 py-2 text-xs font-semibold transition active:scale-95 ${
                              on
                                  ? "bg-forest text-cream shadow-sm"
                                  : "bg-forest/5 text-ink/60 hover:bg-forest/10"
                          }`}
                      >
                        {labels.reviewTag(tag)}
                      </button>
                  );
                })}
              </div>
            </div>

            {/* Текст отзыва */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
                {t("trade.comment")}
              </p>
              <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder={t("trade.commentPlaceholder")}
                  className="w-full rounded-2xl border border-forest/10 bg-forest/[0.03] p-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-forest/30 focus:bg-white focus:ring-2 focus:ring-forest/10"
                  rows={3}
              />
            </div>

            <button
                type="button"
                onClick={async () => {
                  setError("");
                  try {
                    await api(`/api/trades/${id}/reviews`, {
                      method: "POST",
                      body: JSON.stringify({
                        rating: reviewRating,
                        tags: reviewTags,
                        text: reviewText,
                      }),
                    });
                    await reload();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : t("common.error"));
                  }
                }}
                className="w-full rounded-2xl bg-forest py-3.5 text-sm font-semibold text-cream shadow-lg shadow-forest/20 transition hover:bg-forest/90 active:scale-[0.98]"
            >
              {t("trade.sendReview")}
            </button>
          </section>
      )}

      {/* Dispute */}
      {!["CANCELLED", "BLOCKED"].includes(trade.status) && (
          <section className="space-y-3 rounded-3xl bg-white/60 p-5 ring-1 ring-coral/20">
            <h2 className="font-display text-xl text-coral">{t("trade.disputeTitle")}</h2>
            <FancySelect
                value={disputeReason}
                onChange={(v) => setDisputeReason(v as typeof disputeReason)}
                options={DISPUTE_REASONS.map((r) => ({ value: r, label: labels.disputeReason(r) }))}
                triggerClassName={"border-forest/15 bg-white hover:border-forest/30 focus:ring-forest/30"}
            />


            <textarea
                value={disputeDesc}
                onChange={(e) => setDisputeDesc(e.target.value)}
                placeholder={t("trade.disputePlaceholder")}
                className="w-full rounded-xl border border-forest/15 p-2 text-sm"
                rows={3}
            />
            {disputeDesc.length > 0 && disputeDesc.length < 10 && (
                <p className="text-xs text-coral">
                  {t("trade.moreChars", { n: 10 - disputeDesc.length })}
                </p>
            )}

            {/* TZ §21: photo/video evidence linked to this trade */}
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-coral/10 px-3 py-2 text-xs font-semibold text-coral hover:bg-coral/20">
                <Camera size={14} />
                {evidenceUploading ? t("trade.uploading") : t("trade.addEvidence")}
                <input
                    type="file"
                    accept={`image/*,${VIDEO_ACCEPT}`}
                    multiple
                    disabled={evidenceUploading}
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      setEvidenceUploading(true);
                      setError("");
                      try {
                        const urls: string[] = [];
                        for (const f of files) urls.push(await uploadMedia(f, trade.publicId));
                        setEvidence((prev) => [...prev, ...urls].slice(0, 10));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : t("trade.uploadError"));
                      } finally {
                        setEvidenceUploading(false);
                        e.target.value = "";
                      }
                    }}
                />
              </label>
              {evidence.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {evidence.map((url) => (
                        <div key={url} className="relative">
                          {isVideoUrl(url) ? (
                              <video src={mediaUrl(url)} muted className="h-16 w-16 rounded-lg bg-black object-cover" />
                          ) : (
                              <img src={mediaUrl(url)} alt="" className="h-16 w-16 rounded-lg object-cover" />
                          )}
                          <button
                              type="button"
                              aria-label={t("trade.removeEvidence")}
                              onClick={() => setEvidence((prev) => prev.filter((u) => u !== url))}
                              className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-coral text-[10px] font-bold text-white"
                          >
                            ×
                          </button>
                        </div>
                    ))}
                  </div>
              )}
            </div>
          <Btn
              tone="danger"
              onClick={async () => {
                if (disputeDesc.trim().length < 10) {
                  setError(t("trade.descTooShort"));
                  return;
                }
                setError("");
                try {
                  await api(`/api/trades/${id}/disputes`, {
                    method: "POST",
                    body: JSON.stringify({
                      reason: disputeReason,
                      description: disputeDesc,
                      evidence,
                    }),
                  });
                  setEvidence([]);
                  setDisputeDesc("");
                  await reload();
                } catch (err) {
                  setError(err instanceof Error ? err.message : t("trade.disputeError"));
                }
              }}
          >
            {t("trade.disputeTitle")}
          </Btn>
          {trade.disputes[0] && (
            <p className="text-sm text-ink/60">
              {t("trade.activeDispute", {
                reason: labels.disputeReason(trade.disputes[0].reason),
                status: trade.disputes[0].status,
              })}
            </p>
          )}
        </section>
      )}

      {/* Audit */}
      <section className="rounded-3xl bg-white/50 p-5">
        <h2 className="mb-3 font-display text-lg">{t("trade.auditTitle")}</h2>
        <ul className="space-y-1 text-xs text-ink/60">
          {trade.auditLogs.map((l, i) => (
            <li key={i}>
              {new Date(l.createdAt).toLocaleString(dateLocale())} —{" "}
              {t(`audit.${l.action}`, { defaultValue: l.action })}
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
          <img
            src={mediaUrl(ti.item.media[0]?.url) || "https://placehold.co/40"}
            alt=""
            className="h-10 w-10 rounded-lg object-cover"
          />
          <Link to={`/items/${ti.item.id}`} className="hover:underline">
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
      className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium sm:w-auto ${cls}`}
    >
      {children}
    </button>
  );
}
