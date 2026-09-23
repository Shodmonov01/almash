import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { Link, useNavigate } from "react-router-dom";
import { mediaUrl } from "@/lib/env";
import { isVideoUrl } from "@/lib/media";
import { useTranslation } from "react-i18next";
import { dateLocale, useLabels } from "@/lib/labels";

function parseEvidence(json?: string | null): string[] {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");
  const [newForbidden, setNewForbidden] = useState("");
  const { t } = useTranslation();
  const labels = useLabels();

  useEffect(() => {
    if (!loading && (!user || user.role !== "ADMIN")) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    setError("");
    api<Record<string, unknown>>(`/api/admin?tab=${tab}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t("common.error")));
  }, [user, tab]);

  if (!user || user.role !== "ADMIN") return null;

  async function run(payload: Record<string, unknown>) {
    setError("");
    try {
      await api("/api/admin", { method: "POST", body: JSON.stringify(payload) });
      const d = await api<Record<string, unknown>>(`/api/admin?tab=${tab}`);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  }

  return (
    <div className="space-y-6 animate-rise">
      <h1 className="font-display text-3xl text-forest">{t("admin.title")}</h1>
      {error && (
        <p className="rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>
      )}
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {["overview", "users", "items", "trades", "disputes", "reports", "moderation", "antifraud", "forbidden"].map(
          (tb) => (
            <button
              key={tb}
              type="button"
              onClick={() => setTab(tb)}
              className={
                tab === tb
                  ? "shrink-0 rounded-lg bg-coral px-3 py-2 text-sm text-white"
                  : "shrink-0 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-forest/10"
              }
            >
              {t(`admin.tabs.${tb}`)}
            </button>
          ),
        )}
        <button
          type="button"
          className="shrink-0 rounded-lg bg-forest px-3 py-2 text-sm text-cream"
          onClick={() => run({ action: "run_jobs" })}
        >
          {t("admin.runJobs")}
        </button>
      </div>

      {tab === "overview" && data.overview != null ? (
        <pre className="overflow-auto rounded-2xl bg-white/80 p-4 text-xs">
          {JSON.stringify(data.overview, null, 2)}
        </pre>
      ) : null}

      {tab === "users" && Array.isArray(data.users) && (
        <div className="space-y-2">
          {(data.users as { id: string; name: string; status: string; username: string }[]).map(
            (u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 p-3 text-sm"
              >
                <span>
                  {u.name} (@{u.username}) — {u.status}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-mist px-2 py-1"
                    onClick={() => run({ action: "warn_user", userId: u.id })}
                  >
                    {t("admin.warn")}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-coral/20 px-2 py-1 text-coral"
                    onClick={() =>
                      run({ action: "block_user", userId: u.id, reason: "admin" })
                    }
                  >
                    {t("admin.block")}
                  </button>
                  {u.status !== "ACTIVE" && (
                    <button
                      type="button"
                      className="rounded-lg bg-forest/10 px-2 py-1 text-forest"
                      onClick={() => run({ action: "unblock_user", userId: u.id })}
                    >
                      {t("admin.unblock")}
                    </button>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {tab === "items" && Array.isArray(data.items) && (
        <div className="space-y-2">
          {(
            data.items as {
              id: string;
              title: string;
              status: string;
              owner: { name: string };
            }[]
          ).map((it) => (
            <div
              key={it.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 p-3 text-sm"
            >
              <span>
                {it.title} · {it.owner.name} · {it.status}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-mist px-2 py-1"
                  onClick={() =>
                    run({
                      action: "moderate_item",
                      itemId: it.id,
                      decision: "APPROVE",
                    })
                  }
                >
                  {t("admin.approve")}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-coral/20 px-2 py-1 text-coral"
                  onClick={() =>
                    run({
                      action: "moderate_item",
                      itemId: it.id,
                      decision: "BLOCK",
                    })
                  }
                >
                  {t("admin.block")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "disputes" && Array.isArray(data.disputes) && (
        <div className="space-y-2">
          {(
            data.disputes as {
              id: string;
              reason: string;
              status: string;
              description: string;
              evidenceJson?: string | null;
              trade: { id: string; publicId: string };
              openedBy: { name: string };
            }[]
          ).map((d) => (
            <div
              key={d.id}
              className="space-y-2 rounded-xl bg-white/80 p-3 text-sm"
            >
              <p>
                <Link to={`/trades/${d.trade.id}`} className="font-bold text-forest hover:underline">
                  {d.trade.publicId}
                </Link>
                : {labels.disputeReason(d.reason)} ({d.status}) — {d.openedBy.name}
              </p>
              <p className="whitespace-pre-wrap text-xs text-ink/70">{d.description}</p>
              {parseEvidence(d.evidenceJson).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {parseEvidence(d.evidenceJson).map((url) => (
                    <a key={url} href={mediaUrl(url)} target="_blank" rel="noreferrer">
                      {isVideoUrl(url) ? (
                        <video src={mediaUrl(url)} muted className="h-16 w-16 rounded-lg bg-black object-cover" />
                      ) : (
                        <img src={mediaUrl(url)} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      )}
                    </a>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {(["RESOLVED_A", "RESOLVED_B", "RETURNED", "CLOSED"] as const).map(
                  (r) => (
                    <button
                      key={r}
                      type="button"
                      className="rounded-lg bg-mist px-2 py-1 text-xs"
                      onClick={() =>
                        run({
                          action: "resolve_dispute",
                          disputeId: d.id,
                          resolution: r,
                          note: r,
                        })
                      }
                    >
                      {t(`admin.resolution.${r}`)}
                    </button>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "antifraud" && data.antifraud != null && (
        <AntifraudView
          data={data.antifraud as AntifraudData}
          onClearRisk={(userId) => run({ action: "clear_risk", userId })}
        />
      )}

      {tab === "forbidden" && Array.isArray(data.categories) && (
        <div className="space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newForbidden.trim();
              if (name.length < 2) return;
              run({ action: "add_forbidden", name }).then(() => setNewForbidden(""));
            }}
          >
            <input
              value={newForbidden}
              onChange={(e) => setNewForbidden(e.target.value)}
              placeholder={t("admin.forbiddenPlaceholder")}
              className="min-w-0 flex-1 rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-xl bg-forest px-4 py-2 text-sm text-cream">
              {t("admin.add")}
            </button>
          </form>
          {(data.categories as { id: string; name: string; enabled: boolean }[]).map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-white/80 p-3 text-sm"
            >
              <span className={c.enabled ? "" : "text-ink/40 line-through"}>{c.name}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-mist px-2 py-1 text-xs"
                  onClick={() => run({ action: "toggle_forbidden", id: c.id, enabled: !c.enabled })}
                >
                  {c.enabled ? t("admin.disable") : t("admin.enable")}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-coral/20 px-2 py-1 text-xs text-coral"
                  onClick={() => {
                    if (window.confirm(t("admin.confirmDelete", { name: c.name }))) {
                      run({ action: "delete_forbidden", id: c.id });
                    }
                  }}
                >
                  {t("admin.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "trades" && Array.isArray(data.trades) && (
        <div className="space-y-2">
          {(
            data.trades as {
              id: string;
              publicId: string;
              status: string;
              updatedAt: string;
              parties: { side: string; user: { id: string; name: string } }[];
            }[]
          ).map((tr) => {
            const partyA = tr.parties.find((p) => p.side === "A")?.user?.name || "A";
            const partyB = tr.parties.find((p) => p.side === "B")?.user?.name || "B";
            return (
              <div
                key={tr.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 p-3 text-sm"
              >
                <div>
                  <span className="font-bold text-forest">{tr.publicId}</span>
                  <span className="ml-2 text-xs text-ink/70">
                    {partyA} ⇄ {partyB}
                  </span>
                  <span className="ml-2 rounded-md bg-mist/80 px-2 py-0.5 text-xs">
                    {labels.tradeStatus(tr.status)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ink/50">
                    {new Date(tr.updatedAt).toLocaleString(dateLocale())}
                  </span>
                  <Link
                    to={`/trades/${tr.id}`}
                    className="rounded-lg bg-forest/10 px-2.5 py-1 text-xs font-semibold text-forest hover:bg-forest/20"
                  >
                    {t("admin.open")}
                  </Link>
                  {!["COMPLETED", "CANCELLED"].includes(tr.status) && (
                    <button
                      type="button"
                      className="rounded-lg bg-coral/10 px-2.5 py-1 text-xs font-semibold text-coral hover:bg-coral/20"
                      onClick={() => {
                        const reason = window.prompt(t("admin.cancelReason"));
                        if (reason && reason.trim().length >= 3) {
                          run({ action: "cancel_trade", tradeId: tr.id, reason: reason.trim() });
                        }
                      }}
                    >
                      {t("admin.cancel")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "reports" && Array.isArray(data.reports) && (
        <div className="space-y-2">
          {(
            data.reports as {
              id: string;
              reason: string;
              description: string | null;
              status: string;
              createdAt: string;
              reporter: { id: string; name: string };
              targetUser: { id: string; name: string } | null;
            }[]
          ).map((r) => (
            <div
              key={r.id}
              className="space-y-2 rounded-xl bg-white/80 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-1">
                <div>
                  <span className="font-semibold text-coral">{labels.reportReason(r.reason)}</span>
                  <span className="ml-2 text-xs text-ink/60">
                    {t("admin.reportFrom", { name: r.reporter.name })}{" "}
                    {r.targetUser ? t("admin.reportOn", { name: r.targetUser.name }) : ""}
                  </span>
                </div>
                <span className="rounded-md bg-mist px-2 py-0.5 text-[11px]">
                  {r.status}
                </span>
              </div>
              {r.description && (
                <p className="text-xs text-ink/70">{r.description}</p>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-ink/40">
                  {new Date(r.createdAt).toLocaleString(dateLocale())}
                </span>
                {r.targetUser && (
                  <button
                    type="button"
                    className="rounded-lg bg-coral/20 px-2 py-1 text-xs text-coral hover:bg-coral/30"
                    onClick={() =>
                      run({
                        action: "block_user",
                        userId: r.targetUser!.id,
                        reason: t("admin.reportBlockReason", { reason: r.reason }),
                      })
                    }
                  >
                    {t("admin.blockUser", { name: r.targetUser.name })}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "moderation" && Array.isArray(data.queue) && (
        <div className="space-y-2">
          {(
            data.queue as {
              id: string;
              type: string;
              status: string;
              detail: string | null;
              score: number;
            }[]
          ).map((q) => (
            <div
              key={q.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 p-3 text-sm"
            >
              <span>
                [{q.type}] {q.status} · score {q.score}
                <br />
                <span className="text-xs text-ink/50">{q.detail}</span>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-mist px-2 py-1 text-xs"
                  onClick={() =>
                    run({
                      action: "review_moderation",
                      queueId: q.id,
                      status: "REVIEWED",
                    })
                  }
                >
                  {t("admin.reviewed")}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-mist px-2 py-1 text-xs"
                  onClick={() =>
                    run({
                      action: "review_moderation",
                      queueId: q.id,
                      status: "DISMISSED",
                    })
                  }
                >
                  {t("admin.dismiss")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type AntifraudData = {
  riskyUsers: {
    id: string;
    name: string;
    username?: string | null;
    status: string;
    riskScoreCached: number;
    warningCount: number;
    signals: string[];
  }[];
  riskyTrades: {
    id: string;
    publicId: string;
    status: string;
    riskScore: number;
    parties: { side: string; user: { name: string } }[];
  }[];
  duplicates: { id: string; type: string; itemId?: string | null; detail?: string | null; createdAt: string }[];
  saleAttempts: {
    id: string;
    type: string;
    detail?: string | null;
    createdAt: string;
    user?: { id: string; name: string } | null;
  }[];
  massActions: { userId: string; name: string; kind: string; count: number }[];
  sharedDevices: { device: string; users: { id: string; name: string; username?: string | null }[] }[];
};

function AfSection({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg text-forest">{title}</h2>
      {empty ? <p className="text-sm text-ink/45">{t("admin.noData")}</p> : children}
    </section>
  );
}

function AntifraudView({
  data,
  onClearRisk,
}: {
  data: AntifraudData;
  onClearRisk: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const labels = useLabels();
  const row = "rounded-xl bg-white/80 p-3 text-sm";
  const when = (d: string) => new Date(d).toLocaleString(dateLocale());
  return (
    <div className="space-y-6">
      <AfSection title={t("admin.af.riskyUsers")} empty={data.riskyUsers.length === 0}>
        {data.riskyUsers.map((u) => (
          <div key={u.id} className={row}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link to={`/users/${u.id}`} className="font-bold text-forest hover:underline">
                {u.name} {u.username ? `(@${u.username})` : ""}
              </Link>
              <span className="flex items-center gap-2 text-xs">
                risk <b>{u.riskScoreCached}</b> · {u.status} · {t("admin.af.warnings", { count: u.warningCount })}
                <button
                  type="button"
                  className="rounded-lg bg-forest/10 px-2 py-1 font-semibold text-forest"
                  title={t("admin.af.checkedHint")}
                  onClick={() => onClearRisk(u.id)}
                >
                  {t("admin.af.checked")}
                </button>
              </span>
            </div>
            {u.signals.length > 0 && (
              <p className="mt-1 text-xs text-coral">{u.signals.join(" · ")}</p>
            )}
          </div>
        ))}
      </AfSection>

      <AfSection title={t("admin.af.riskyTrades")} empty={data.riskyTrades.length === 0}>
        {data.riskyTrades.map((tr) => (
          <div key={tr.id} className={`${row} flex flex-wrap items-center justify-between gap-2`}>
            <Link to={`/trades/${tr.id}`} className="font-bold text-forest hover:underline">
              {tr.publicId}
            </Link>
            <span className="text-xs text-ink/70">
              {tr.parties.map((p) => p.user.name).join(" ⇄ ")} · {labels.tradeStatus(tr.status)} · risk <b>{tr.riskScore}</b>
            </span>
          </div>
        ))}
      </AfSection>

      <AfSection title={t("admin.af.mass")} empty={data.massActions.length === 0}>
        {data.massActions.map((m) => (
          <div key={`${m.userId}-${m.kind}`} className={row}>
            <Link to={`/users/${m.userId}`} className="font-bold text-forest hover:underline">
              {m.name}
            </Link>{" "}
            — {m.count} {m.kind}
          </div>
        ))}
      </AfSection>

      <AfSection title={t("admin.af.devices")} empty={data.sharedDevices.length === 0}>
        {data.sharedDevices.map((g) => (
          <div key={g.device} className={row}>
            <span className="font-mono text-xs text-ink/50">{g.device}…</span>{" "}
            {g.users.map((u, i) => (
              <span key={u.id}>
                {i > 0 && ", "}
                <Link to={`/users/${u.id}`} className="text-forest hover:underline">
                  {u.name}
                </Link>
              </span>
            ))}
          </div>
        ))}
      </AfSection>

      <AfSection title={t("admin.af.duplicates")} empty={data.duplicates.length === 0}>
        {data.duplicates.map((d) => (
          <div key={d.id} className={row}>
            <span className="font-bold">{d.type === "DUPLICATE_PHOTO" ? t("admin.af.photo") : t("admin.af.description")}</span>
            {d.itemId && (
              <>
                {" · "}
                <Link to={`/items/${d.itemId}`} className="text-forest hover:underline">
                  {t("admin.af.listing")}
                </Link>
              </>
            )}
            <span className="ml-2 text-xs text-ink/50">{when(d.createdAt)}</span>
            {d.detail && <p className="mt-1 break-all text-xs text-ink/60">{d.detail}</p>}
          </div>
        ))}
      </AfSection>

      <AfSection title={t("admin.af.sales")} empty={data.saleAttempts.length === 0}>
        {data.saleAttempts.map((e) => (
          <div key={e.id} className={row}>
            {e.user ? (
              <Link to={`/users/${e.user.id}`} className="font-bold text-forest hover:underline">
                {e.user.name}
              </Link>
            ) : (
              "—"
            )}
            <span className="ml-2 text-xs text-ink/50">
              {e.type === "MONEY_IN_LISTING" ? t("admin.af.inListing") : t("admin.af.inChat")} · {when(e.createdAt)}
            </span>
            {e.detail && <p className="mt-1 text-xs text-coral">{e.detail}</p>}
          </div>
        ))}
      </AfSection>
    </div>
  );
}
